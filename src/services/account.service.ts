import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AccountRepository } from '../models/account';
import { TransactionRepository } from '../models/transaction';
import { TransferRepository } from '../models/transfer';
import { FraudAlertRepository } from '../models/fraudAlert';
import {
  Account,
  AccountType,
  BankAccountStatus,
  Transaction,
  TransactionType,
  TransactionStatus,
  Transfer,
  FraudRiskLevel,
} from '../types';

const DAILY_WITHDRAWAL_LIMIT = 5_000;
const LARGE_TRANSACTION_THRESHOLD = 10_000;
const HIGH_DAILY_VOLUME_THRESHOLD = 15_000;
const RAPID_TX_COUNT = 5;
const RAPID_TX_WINDOW_MINUTES = 10;
const RAPID_TRANSFER_COUNT = 3;
const RAPID_TRANSFER_WINDOW_MINUTES = 10;

export class AccountService {
  // ─── Reference Generation ────────────────────────────────────────────────

  private generateReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const short = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `TXN-${date}-${short}`;
  }
}
