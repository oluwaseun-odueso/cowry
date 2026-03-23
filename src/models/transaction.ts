import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { Transaction, TransactionType, TransactionStatus } from '../types';

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

