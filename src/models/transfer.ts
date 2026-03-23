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

