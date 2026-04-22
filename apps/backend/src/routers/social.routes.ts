import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ContactRepository } from '../models/contact';
import { SplitRequestRepository } from '../models/splitRequest';
import { PaymentRequestRepository } from '../models/paymentRequest';
import { UserRepository, toPublicUser } from '../models';

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
      contactUserId,
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
  const deleted = await ContactRepository.delete(req.params.id, req.user!.id);
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
    const split = await SplitRequestRepository.create(
      req.user!.id,
      parseFloat(totalAmount),
      description,
      participants
    );
    return res.status(201).json({ status: 'success', data: { split } });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/splits/:id/pay', async (req: Request, res: Response) => {
  try {
    const split = await SplitRequestRepository.findById(req.params.id);
    if (!split) return res.status(404).json({ status: 'error', message: 'Split not found.' });
    const participant = split.participants?.find(p => p.userId === req.user!.id);
    if (!participant) return res.status(403).json({ status: 'error', message: 'You are not a participant in this split.' });
    await SplitRequestRepository.updateParticipantStatus(participant.id, 'paid');
    return res.json({ status: 'success', message: 'Split payment recorded.' });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/splits/:id/decline', async (req: Request, res: Response) => {
  try {
    const split = await SplitRequestRepository.findById(req.params.id);
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
    const { payerAccountNumber, amount, description } = req.body;
    if (!payerAccountNumber || !amount) {
      return res.status(400).json({ status: 'error', message: 'payerAccountNumber and amount are required.' });
    }
    const pr = await PaymentRequestRepository.create({
      requesterUserId: req.user!.id,
      payerAccountNumber,
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
    const pr = await PaymentRequestRepository.findById(req.params.id);
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
    const pr = await PaymentRequestRepository.findById(req.params.id);
    if (!pr) return res.status(404).json({ status: 'error', message: 'Request not found.' });
    await PaymentRequestRepository.updateStatus(pr.id, 'declined');
    return res.json({ status: 'success', message: 'Payment request declined.' });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

export default router;
