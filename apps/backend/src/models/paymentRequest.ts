import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface PaymentRequest {
  id: string;
  reference: string;
  requesterUserId: string;
  payerAccountNumber?: string;
  payerUserId?: string;
  amount: number;
  description?: string;
  status: 'pending' | 'paid' | 'declined' | 'expired';
  expiresAt?: Date;
  createdAt: Date;
}

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'PAY';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

function mapRow(r: RowDataPacket): PaymentRequest {
  return {
    id: r.id,
    reference: r.reference,
    requesterUserId: r.requester_user_id,
    payerAccountNumber: r.payer_account_number ?? undefined,
    payerUserId: r.payer_user_id ?? undefined,
    amount: parseFloat(r.amount),
    description: r.description ?? undefined,
    status: r.status,
    expiresAt: r.expires_at ?? undefined,
    createdAt: r.created_at,
  };
}

export class PaymentRequestRepository {
  static async create(data: {
    requesterUserId: string;
    payerAccountNumber?: string;
    payerUserId?: string;
    amount: number;
    description?: string;
    expiresAt?: Date;
  }): Promise<PaymentRequest> {
    const id = uuidv4();
    const reference = generateReference();
    const expiresAt = data.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 day default
    await pool.execute<ResultSetHeader>(
      `INSERT INTO payment_requests (id, reference, requester_user_id, payer_account_number, payer_user_id, amount, description, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, data.requesterUserId, data.payerAccountNumber ?? null, data.payerUserId ?? null,
       data.amount, data.description ?? null, expiresAt]
    );
    return (await PaymentRequestRepository.findById(id))!;
  }

  static async findById(id: string): Promise<PaymentRequest | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM payment_requests WHERE id = ?', [id]);
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByUser(userId: string): Promise<PaymentRequest[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM payment_requests WHERE requester_user_id = ? OR payer_user_id = ? ORDER BY created_at DESC`,
      [userId, userId]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async updateStatus(id: string, status: PaymentRequest['status']): Promise<void> {
    await pool.execute('UPDATE payment_requests SET status = ? WHERE id = ?', [status, id]);
  }
}
