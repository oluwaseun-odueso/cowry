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
