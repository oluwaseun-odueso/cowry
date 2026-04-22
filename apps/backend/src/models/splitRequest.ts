import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface SplitRequest {
  id: string;
  initiatorUserId: string;
  totalAmount: number;
  description?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  participants?: SplitParticipant[];
}

export interface SplitParticipant {
  id: string;
  splitRequestId: string;
  userId?: string;
  accountNumber?: string;
  amount: number;
  status: 'pending' | 'paid' | 'declined';
  paidAt?: Date;
}

function mapSplit(r: RowDataPacket): SplitRequest {
  return {
    id: r.id,
    initiatorUserId: r.initiator_user_id,
    totalAmount: parseFloat(r.total_amount),
    description: r.description ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapParticipant(r: RowDataPacket): SplitParticipant {
  return {
    id: r.id,
    splitRequestId: r.split_request_id,
    userId: r.user_id ?? undefined,
    accountNumber: r.account_number ?? undefined,
    amount: parseFloat(r.amount),
    status: r.status,
    paidAt: r.paid_at ?? undefined,
  };
}

export class SplitRequestRepository {
  static async create(
    initiatorUserId: string,
    totalAmount: number,
    description: string | undefined,
    participants: Array<{ userId?: string; accountNumber?: string; amount: number }>
  ): Promise<SplitRequest> {
    const id = uuidv4();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `INSERT INTO split_requests (id, initiator_user_id, total_amount, description) VALUES (?, ?, ?, ?)`,
        [id, initiatorUserId, totalAmount, description ?? null]
      );
      for (const p of participants) {
        await conn.execute(
          `INSERT INTO split_participants (id, split_request_id, user_id, account_number, amount) VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), id, p.userId ?? null, p.accountNumber ?? null, p.amount]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return (await SplitRequestRepository.findById(id))!;
  }

  static async findById(id: string): Promise<SplitRequest | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM split_requests WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const split = mapSplit(rows[0] as RowDataPacket);
    const [pRows] = await pool.execute<RowDataPacket[]>('SELECT * FROM split_participants WHERE split_request_id = ?', [id]);
    split.participants = pRows.map(r => mapParticipant(r as RowDataPacket));
    return split;
  }

  static async findByUser(userId: string): Promise<SplitRequest[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT sr.* FROM split_requests sr
       LEFT JOIN split_participants sp ON sp.split_request_id = sr.id
       WHERE sr.initiator_user_id = ? OR sp.user_id = ?
       ORDER BY sr.created_at DESC`,
      [userId, userId]
    );
    const splits = rows.map(r => mapSplit(r as RowDataPacket));
    for (const s of splits) {
      const [pRows] = await pool.execute<RowDataPacket[]>('SELECT * FROM split_participants WHERE split_request_id = ?', [s.id]);
      s.participants = pRows.map(r => mapParticipant(r as RowDataPacket));
    }
    return splits;
  }

  static async updateParticipantStatus(participantId: string, status: 'paid' | 'declined'): Promise<void> {
    await pool.execute(
      `UPDATE split_participants SET status = ?, paid_at = ? WHERE id = ?`,
      [status, status === 'paid' ? new Date() : null, participantId]
    );
  }
}
