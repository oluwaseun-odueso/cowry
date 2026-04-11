import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { Transaction, TransactionType, TransactionStatus } from '@cowry/types';

export type CreateTransactionInput = {
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  status?: TransactionStatus;
  metadata?: object;
};

function mapRow(row: RowDataPacket): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type as TransactionType,
    amount: parseFloat(row.amount),
    currency: row.currency,
    reference: row.reference,
    description: row.description ?? undefined,
    status: row.status as TransactionStatus,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}

export class TransactionRepository {
  static async create(data: CreateTransactionInput): Promise<Transaction> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO transactions (id, account_id, type, amount, currency, reference, description, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.accountId,
        data.type,
        data.amount,
        data.currency,
        data.reference,
        data.description ?? null,
        data.status ?? TransactionStatus.COMPLETED,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return (await TransactionRepository.findById(id))!;
  }

  static async findById(id: string): Promise<Transaction | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByAccountId(
    accountId: string,
    options?: {
      type?: TransactionType;
      from?: Date;
      to?: Date;
      minAmount?: number;
      maxAmount?: number;
      page?: number;
      limit?: number;
    }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['account_id = ?'];
    const params: any[] = [accountId];

    if (options?.type) { conditions.push('type = ?'); params.push(options.type); }
    if (options?.from) { conditions.push('created_at >= ?'); params.push(options.from); }
    if (options?.to) { conditions.push('created_at <= ?'); params.push(options.to); }
    if (options?.minAmount !== undefined) { conditions.push('amount >= ?'); params.push(options.minAmount); }
    if (options?.maxAmount !== undefined) { conditions.push('amount <= ?'); params.push(options.maxAmount); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM transactions ${where}`,
      params
    );
    const total = (countRows[0] as RowDataPacket).total as number;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return { transactions: rows.map(r => mapRow(r as RowDataPacket)), total };
  }

  static async findRecentByAccountId(accountId: string, withinMinutes: number, limit: number): Promise<Transaction[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM transactions
       WHERE account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ORDER BY created_at DESC LIMIT ?`,
      [accountId, withinMinutes, limit]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async sumDebitsForAccountToday(accountId: string): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE account_id = ? AND type = 'debit' AND DATE(created_at) = CURDATE()`,
      [accountId]
    );
    return parseFloat((rows[0] as RowDataPacket).total);
  }

  static async findAll(options?: {
    page?: number;
    limit?: number;
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM transactions');
    const total = (countRows[0] as RowDataPacket).total as number;

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return { transactions: rows.map(r => mapRow(r as RowDataPacket)), total };
  }
}
