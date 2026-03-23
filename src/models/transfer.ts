import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { Transfer, TransactionStatus } from '../types';

export type CreateTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  reference: string;
  status?: TransactionStatus;
};

function mapRow(row: RowDataPacket): Transfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    reference: row.reference,
    status: row.status as TransactionStatus,
    createdAt: row.created_at,
  };
}

export class TransferRepository {
  static async create(data: CreateTransferInput): Promise<Transfer> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO transfers (id, from_account_id, to_account_id, amount, currency, reference, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.fromAccountId,
        data.toAccountId,
        data.amount,
        data.currency,
        data.reference,
        data.status ?? TransactionStatus.COMPLETED,
      ]
    );
    return (await TransferRepository.findById(id))!;
  }

  static async findById(id: string): Promise<Transfer | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM transfers WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByAccountId(accountId: string, limit = 20): Promise<Transfer[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM transfers
       WHERE from_account_id = ? OR to_account_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [accountId, accountId, limit]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async countRecentFromAccount(fromAccountId: string, withinMinutes: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM transfers
       WHERE from_account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [fromAccountId, withinMinutes]
    );
    return (rows[0] as RowDataPacket).total as number;
  }

  static async hasTransferredToAccount(fromAccountId: string, toAccountId: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM transfers WHERE from_account_id = ? AND to_account_id = ? LIMIT 1',
      [fromAccountId, toAccountId]
    );
    return (rows as RowDataPacket[]).length > 0;
  }
}
