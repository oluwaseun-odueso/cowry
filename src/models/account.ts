import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { Account, AccountType, BankAccountStatus } from '../types';

export type CreateAccountInput = {
  userId: string;
  accountType: AccountType;
  currency?: string;
};

function mapRow(row: RowDataPacket): Account {
  return {
    id: row.id,
    userId: row.user_id,
    accountNumber: row.account_number,
    accountType: row.account_type as AccountType,
    currency: row.currency,
    balance: parseFloat(row.balance),
    status: row.status as BankAccountStatus,
    createdAt: row.created_at,
  };
}

function generateAccountNumber(): string {
  // 10-digit number padded with leading zeros
  return String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
}

export class AccountRepository {
  static async create(data: CreateAccountInput): Promise<Account> {
    const id = uuidv4();
    let accountNumber: string;

    // Retry on collision (extremely rare)
    let attempts = 0;
    while (true) {
      accountNumber = generateAccountNumber();
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM accounts WHERE account_number = ?',
        [accountNumber]
      );
      if ((existing as RowDataPacket[]).length === 0) break;
      if (++attempts > 10) throw new Error('Unable to generate unique account number');
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO accounts (id, user_id, account_number, account_type, currency)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.userId, accountNumber!, data.accountType, data.currency ?? 'GBP']
    );

    return (await AccountRepository.findById(id))!;
  }

  static async findById(id: string): Promise<Account | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM accounts WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByUserId(userId: string): Promise<Account[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM accounts WHERE account_number = ?',
      [accountNumber]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findAll(options?: { page?: number; limit?: number }): Promise<{ accounts: Account[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM accounts');
    const total = (countRows[0] as RowDataPacket).total as number;

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM accounts ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return { accounts: rows.map(r => mapRow(r as RowDataPacket)), total };
  }

  static async updateStatus(id: string, status: BankAccountStatus): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE accounts SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async updateBalance(id: string, newBalance: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE accounts SET balance = ? WHERE id = ?',
      [newBalance, id]
    );
    return result.affectedRows > 0;
  }
}
