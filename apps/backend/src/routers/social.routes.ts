import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ContactRepository } from '../models/contact';
import { SplitRequestRepository } from '../models/splitRequest';
import { PaymentRequestRepository } from '../models/paymentRequest';
import { UserRepository, toPublicUser } from '../models';
import { AccountRepository } from '../models/account';
import pool from '../config/database';

const router = Router();

// Require auth + MFA on every route in this router
router.use(AuthMiddleware.authenticate, AuthMiddleware.requireMfa);

// ─── User tag search ──────────────────────────────────────────────────────────

router.get('/users/search', async (req: Request, res: Response) => {
  const { tag } = req.query;
  if (!tag || typeof tag !== 'string') {
    return res.status(400).json({ status: 'error', message: 'tag query param is required.' });
  }
  const users = await UserRepository.searchByTag(tag);
  return res.json({ status: 'success', data: { users: users.map(toPublicUser) } });
});

// ─── Contacts ────────────────────────────────────────────────────────────────

router.get('/contacts', async (req: Request, res: Response) => {
  const contacts = await ContactRepository.findByOwner(req.user!.id);
  return res.json({ status: 'success', data: { contacts } });
});

router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const { nickname, accountNumber, sortCode, tag } = req.body;
    if (!accountNumber && !tag) {
      return res.status(400).json({ status: 'error', message: 'accountNumber or tag is required.' });
    }
    let contactUserId: string | undefined;
    if (tag) {
      const user = await UserRepository.findByTag(tag);
      if (!user) return res.status(404).json({ status: 'error', message: 'No user found with that tag.' });
      contactUserId = user.id;
    }
    const contact = await ContactRepository.create({
      ownerUserId: req.user!.id,
      ...(contactUserId ? { contactUserId } : {}),
      nickname: nickname ?? undefined,
      accountNumber: accountNumber ?? undefined,
      sortCode: sortCode ?? undefined,
      tag: tag ?? undefined,
    });
    return res.status(201).json({ status: 'success', data: { contact } });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.delete('/contacts/:id', async (req: Request, res: Response) => {
  const deleted = await ContactRepository.delete(String(req.params.id), req.user!.id);
  if (!deleted) return res.status(404).json({ status: 'error', message: 'Contact not found.' });
  return res.json({ status: 'success', message: 'Contact removed.' });
});

// ─── Splits ───────────────────────────────────────────────────────────────────

router.get('/splits', async (req: Request, res: Response) => {
  const splits = await SplitRequestRepository.findByUser(req.user!.id);
  return res.json({ status: 'success', data: { splits } });
});

router.post('/splits', async (req: Request, res: Response) => {
  try {
    const { totalAmount, description, participants } = req.body;
    if (!totalAmount || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ status: 'error', message: 'totalAmount and participants[] are required.' });
    }

    // Resolve each participant's tag → userId so the split appears in their list
    const resolved: Array<{ userId?: string; accountNumber?: string; amount: number }> = [];
    for (const p of participants) {
      let userId: string | undefined = p.userId;
      if (!userId && p.tag) {
        const found = await UserRepository.findByTag(String(p.tag).replace(/^@/, ''));
        if (!found) {
          return res.status(404).json({ status: 'error', message: `No user found with tag @${p.tag}.` });
        }
        userId = found.id;
      }
      resolved.push({
        ...(userId ? { userId } : {}),
        ...(p.accountNumber ? { accountNumber: p.accountNumber } : {}),
        amount: parseFloat(p.amount),
      });
    }

    const split = await SplitRequestRepository.create(
      req.user!.id,
      parseFloat(totalAmount),
      description,
      resolved
    );
    return res.status(201).json({ status: 'success', data: { split } });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/splits/:id/pay', async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const split = await SplitRequestRepository.findById(String(req.params.id));
    if (!split) return res.status(404).json({ status: 'error', message: 'Split not found.' });
    if (split.status !== 'pending') {
      return res.status(400).json({ status: 'error', message: 'This split is no longer pending.' });
    }

    const participant = split.participants?.find(p => p.userId === req.user!.id);
    if (!participant) return res.status(403).json({ status: 'error', message: 'You are not a participant in this split.' });
    if (participant.status === 'paid') {
      return res.status(400).json({ status: 'error', message: 'You have already paid your share.' });
    }

    // Resolve accounts
    const payerAccounts = await AccountRepository.findByUserId(req.user!.id);
    const payerAccount = payerAccounts.find(a => a.status === 'active');
    if (!payerAccount) return res.status(400).json({ status: 'error', message: 'No active account found.' });
    if (payerAccount.balance < participant.amount) {
      return res.status(400).json({ status: 'error', message: 'Insufficient funds.' });
    }

    const initiatorAccounts = await AccountRepository.findByUserId(split.initiatorUserId);
    const initiatorAccount = initiatorAccounts.find(a => a.status === 'active');
    if (!initiatorAccount) return res.status(400).json({ status: 'error', message: 'Initiator has no active account.' });

    const desc = split.description ? `Split: ${split.description}` : `Split ${split.reference}`;

    await conn.beginTransaction();

    // Debit payer, credit initiator
    await conn.execute('UPDATE accounts SET balance = ? WHERE id = ?', [payerAccount.balance - participant.amount, payerAccount.id]);
    await conn.execute('UPDATE accounts SET balance = ? WHERE id = ?', [initiatorAccount.balance + participant.amount, initiatorAccount.id]);

    // Transaction records
    await conn.execute(
      `INSERT INTO transactions (id, account_id, type, amount, currency, reference, description, status)
       VALUES (?, ?, 'debit', ?, ?, ?, ?, 'completed')`,
      [uuidv4(), payerAccount.id, participant.amount, payerAccount.currency, `${split.reference}-${uuidv4().slice(0, 6).toUpperCase()}`, desc]
    );
    await conn.execute(
      `INSERT INTO transactions (id, account_id, type, amount, currency, reference, description, status)
       VALUES (?, ?, 'credit', ?, ?, ?, ?, 'completed')`,
      [uuidv4(), initiatorAccount.id, participant.amount, initiatorAccount.currency, `${split.reference}-${uuidv4().slice(0, 6).toUpperCase()}`, desc]
    );

    // Mark this participant as paid
    await conn.execute(
      'UPDATE split_participants SET status = ?, paid_at = UTC_TIMESTAMP() WHERE id = ?',
      ['paid', participant.id]
    );

    // Check if all participants are now paid → complete the split
    const [pRows] = await conn.execute<RowDataPacket[]>(
      'SELECT status FROM split_participants WHERE split_request_id = ?',
      [split.id]
    );
    const allPaid = (pRows as RowDataPacket[]).every(r => r.status === 'paid');
    if (allPaid) {
      await conn.execute('UPDATE split_requests SET status = ? WHERE id = ?', ['completed', split.id]);
    }

    await conn.commit();
    conn.release();

    const updated = await SplitRequestRepository.findById(split.id);
    return res.json({ status: 'success', data: { split: updated } });
  } catch (err: any) {
    await conn.rollback();
    conn.release();
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/splits/:id/decline', async (req: Request, res: Response) => {
  try {
    const split = await SplitRequestRepository.findById(String(req.params.id));
    if (!split) return res.status(404).json({ status: 'error', message: 'Split not found.' });
    const participant = split.participants?.find(p => p.userId === req.user!.id);
    if (!participant) return res.status(403).json({ status: 'error', message: 'You are not a participant.' });
    await SplitRequestRepository.updateParticipantStatus(participant.id, 'declined');
    return res.json({ status: 'success', message: 'Split declined.' });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// ─── Payment requests ─────────────────────────────────────────────────────────

router.get('/payment-requests', async (req: Request, res: Response) => {
  const requests = await PaymentRequestRepository.findByUser(req.user!.id);
  return res.json({ status: 'success', data: { requests } });
});

router.post('/payment-requests', async (req: Request, res: Response) => {
  try {
    const { payerSortCode, payerAccountNumber, amount, description } = req.body;
    if (!payerSortCode || !payerAccountNumber || !amount) {
      return res.status(400).json({ status: 'error', message: 'payerSortCode, payerAccountNumber, and amount are required.' });
    }
    // Validate the sort code matches a known Cowry sort code
    const normalised = String(payerSortCode).replace(/-/g, '');
    if (normalised !== '400001') {
      return res.status(400).json({ status: 'error', message: 'Sort code does not belong to a Cowry account.' });
    }
    // Look up the payer's userId from their account number so the request appears in their list
    const payerAccount = await AccountRepository.findByAccountNumber(payerAccountNumber);
    if (!payerAccount) {
      return res.status(404).json({ status: 'error', message: 'No account found with that account number.' });
    }

    const pr = await PaymentRequestRepository.create({
      requesterUserId: req.user!.id,
      payerAccountNumber,
      payerUserId: payerAccount.userId,
      amount: parseFloat(amount),
      description,
    });
    return res.status(201).json({ status: 'success', data: { request: pr } });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/payment-requests/:id/pay', async (req: Request, res: Response) => {
  try {
    const pr = await PaymentRequestRepository.findById(String(req.params.id));
    if (!pr) return res.status(404).json({ status: 'error', message: 'Request not found.' });
    if (pr.status !== 'pending') return res.status(400).json({ status: 'error', message: 'Request is no longer pending.' });
    await PaymentRequestRepository.updateStatus(pr.id, 'paid');
    return res.json({ status: 'success', message: 'Payment request fulfilled.' });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/payment-requests/:id/decline', async (req: Request, res: Response) => {
  try {
    const pr = await PaymentRequestRepository.findById(String(req.params.id));
    if (!pr) return res.status(404).json({ status: 'error', message: 'Request not found.' });
    await PaymentRequestRepository.updateStatus(pr.id, 'declined');
    return res.json({ status: 'success', message: 'Payment request declined.' });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

export default router;
