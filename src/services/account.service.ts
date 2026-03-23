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

  async createAccount(userId: string, type: AccountType, currency = 'GBP'): Promise<Account> {
    const existing = await AccountRepository.findByUserId(userId);
    const duplicate = existing.find(a => a.accountType === type);
    if (duplicate) {
      throw new Error(`You already have a ${type} account.`);
    }
    return AccountRepository.create({ userId, accountType: type, currency: currency.toUpperCase() });
  }

  async getAccounts(userId: string): Promise<Account[]> {
    return AccountRepository.findByUserId(userId);
  }

  async getAccount(userId: string, accountId: string): Promise<Account> {
    const account = await AccountRepository.findById(accountId);
    if (!account) throw new Error('Account not found.');
    if (account.userId !== userId) throw new Error('Account not found.');
    return account;
  }

  async deposit(
    userId: string,
    accountId: string,
    amount: number,
    description?: string
  ): Promise<Transaction> {
    const account = await this.getAccount(userId, accountId);
    if (account.status !== BankAccountStatus.ACTIVE) {
      throw new Error('Account is suspended.');
    }

    const reference = this.generateReference();
    const newBalance = account.balance + amount;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE accounts SET balance = ? WHERE id = ?',
        [newBalance, accountId]
      );
      await conn.execute(
        `INSERT INTO transactions (id, account_id, type, amount, currency, reference, description, status)
         VALUES (?, ?, 'credit', ?, ?, ?, ?, 'completed')`,
        [uuidv4(), accountId, amount, account.currency, reference, description ?? null]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM transactions WHERE reference = ?',
      [reference]
    );
    const tx = rows[0];

    // Non-blocking fraud check
    this.runTransactionFraudChecks(userId, accountId, amount, TransactionType.CREDIT).catch(() => {});

    return {
      id: tx.id,
      accountId: tx.account_id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      reference: tx.reference,
      description: tx.description ?? undefined,
      status: tx.status,
      createdAt: tx.created_at,
    };
  }

  private async runTransactionFraudChecks(
    userId: string,
    accountId: string,
    amount: number,
    type: TransactionType
  ): Promise<void> {
    const dummyIp = '0.0.0.0';

    // Rule 1: Large transaction
    if (amount > LARGE_TRANSACTION_THRESHOLD) {
      await FraudAlertRepository.create({
        userId,
        ruleName: 'large_transaction',
        riskLevel: FraudRiskLevel.HIGH,
        description: `${type === TransactionType.CREDIT ? 'Deposit' : 'Withdrawal'} of £${amount.toFixed(2)} exceeds large transaction threshold.`,
        ipAddress: dummyIp,
        metadata: { accountId, amount, type },
        action: 'alert',
      });
    }

    // Rule 2: Rapid transactions
    const recentTx = await TransactionRepository.findRecentByAccountId(
      accountId,
      RAPID_TX_WINDOW_MINUTES,
      RAPID_TX_COUNT + 1
    );
    if (recentTx.length > RAPID_TX_COUNT) {
      await FraudAlertRepository.create({
        userId,
        ruleName: 'rapid_transactions',
        riskLevel: FraudRiskLevel.MEDIUM,
        description: `More than ${RAPID_TX_COUNT} transactions on account ${accountId} within ${RAPID_TX_WINDOW_MINUTES} minutes.`,
        ipAddress: dummyIp,
        metadata: { accountId, count: recentTx.length },
        action: 'alert',
      });
    }

    // Rule 3: High daily debit volume
    if (type === TransactionType.DEBIT) {
      const dailyDebits = await TransactionRepository.sumDebitsForAccountToday(accountId);
      if (dailyDebits > HIGH_DAILY_VOLUME_THRESHOLD) {
        await FraudAlertRepository.create({
          userId,
          ruleName: 'high_daily_debit_volume',
          riskLevel: FraudRiskLevel.MEDIUM,
          description: `Total daily debits of £${dailyDebits.toFixed(2)} exceed threshold of £${HIGH_DAILY_VOLUME_THRESHOLD}.`,
          ipAddress: dummyIp,
          metadata: { accountId, dailyDebits },
          action: 'alert',
        });
      }
    }
  }

  private async runTransferFraudChecks(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number
  ): Promise<void> {
    const dummyIp = '0.0.0.0';

    // Rule 4: New payee
    const isNewPayee = !(await TransferRepository.hasTransferredToAccount(fromAccountId, toAccountId));
    if (isNewPayee) {
      await FraudAlertRepository.create({
        userId,
        ruleName: 'new_payee_transfer',
        riskLevel: FraudRiskLevel.LOW,
        description: `First transfer from account ${fromAccountId} to account ${toAccountId}.`,
        ipAddress: dummyIp,
        metadata: { fromAccountId, toAccountId, amount },
        action: 'log',
      });
    }

    // Rule 5: Rapid transfers
    const recentCount = await TransferRepository.countRecentFromAccount(
      fromAccountId,
      RAPID_TRANSFER_WINDOW_MINUTES
    );
    if (recentCount > RAPID_TRANSFER_COUNT) {
      await FraudAlertRepository.create({
        userId,
        ruleName: 'rapid_transfers',
        riskLevel: FraudRiskLevel.MEDIUM,
        description: `${recentCount} transfers from account ${fromAccountId} within ${RAPID_TRANSFER_WINDOW_MINUTES} minutes.`,
        ipAddress: dummyIp,
        metadata: { fromAccountId, count: recentCount },
        action: 'alert',
      });
    }
  }
}
