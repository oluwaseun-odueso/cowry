import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountType, BankAccountStatus } from '@cowry/types';
import { makeMockAccount } from '../../helpers/auth-helpers';

// ── vi.hoisted() runs before any vi.mock() factory ────────────────────────────

const mockConn = vi.hoisted(() => ({
  beginTransaction: vi.fn(),
  execute: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
}));

// Vitest hoists vi.mock() calls before imports at runtime, so these mocks
// are in effect when the service module is first loaded.

vi.mock('../../../models/account', () => ({
  AccountRepository: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    findByAccountNumber: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../../models/transaction', () => ({
  TransactionRepository: {
    sumDebitsForAccountToday: vi.fn(),
    findByAccountId: vi.fn(),
    findRecentByAccountId: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../../models/transfer', () => ({
  TransferRepository: {
    findById: vi.fn(),
    hasTransferredToAccount: vi.fn(),
    countRecentFromAccount: vi.fn(),
  },
}));

vi.mock('../../../models/fraudAlert', () => ({
  FraudAlertRepository: { create: vi.fn() },
}));

// Mock the database pool (used directly in deposit/withdraw/transfer for transactions)
vi.mock('../../../config/database', () => ({
  default: {
    getConnection: vi.fn(),
    execute: vi.fn(),
  },
}));

// ── These imports resolve to the mocked versions ──────────────────────────────

import { AccountService } from '../../../services/account.service';
import { AccountRepository } from '../../../models/account';
import { TransactionRepository } from '../../../models/transaction';
import { TransferRepository } from '../../../models/transfer';
import { FraudAlertRepository } from '../../../models/fraudAlert';
import db from '../../../config/database';

const mAccountRepo = vi.mocked(AccountRepository);
const mTxRepo = vi.mocked(TransactionRepository);
const mTransferRepo = vi.mocked(TransferRepository);
const mFraud = vi.mocked(FraudAlertRepository);
const mDb = vi.mocked(db);

const mockTxRow = {
  id: 'tx-001', account_id: 'acc-001', type: 'credit',
  amount: '100.00', currency: 'GBP',
  reference: 'TXN-20250101-ABCD1234', description: null,
  status: 'completed', created_at: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(() => {
    service = new AccountService();
    mFraud.create.mockResolvedValue(undefined as any);
    mTxRepo.sumDebitsForAccountToday.mockResolvedValue(0);
    mTxRepo.findRecentByAccountId.mockResolvedValue([]);
    mTransferRepo.hasTransferredToAccount.mockResolvedValue(true);
    mTransferRepo.countRecentFromAccount.mockResolvedValue(0);

    // Reset connection mock before each test (clearMocks/restoreMocks can wipe these)
    mockConn.beginTransaction.mockResolvedValue(undefined);
    mockConn.execute.mockResolvedValue([[], []]);
    mockConn.commit.mockResolvedValue(undefined);
    mockConn.rollback.mockResolvedValue(undefined);
    mockConn.release.mockReturnValue(undefined);
    mDb.getConnection.mockResolvedValue(mockConn as any);
    mDb.execute.mockResolvedValue([[mockTxRow], []] as any);
  });

  // ── createAccount() ──────────────────────────────────────────────────────────

  describe('createAccount()', () => {
    it('creates and returns a new account', async () => {
      const account = makeMockAccount({ accountType: AccountType.SAVINGS });
      mAccountRepo.findByUserId.mockResolvedValue([]);
      mAccountRepo.create.mockResolvedValue(account as any);

      const result = await service.createAccount('user-001', AccountType.SAVINGS);

      expect(mAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001', accountType: AccountType.SAVINGS }),
      );
      expect(result).toEqual(account);
    });

    it('throws when the user already has that account type', async () => {
      const existing = makeMockAccount({ accountType: AccountType.SAVINGS });
      mAccountRepo.findByUserId.mockResolvedValue([existing as any]);

      await expect(
        service.createAccount('user-001', AccountType.SAVINGS),
      ).rejects.toThrow('already have a savings account');
    });
  });

  // ── getAccount() ─────────────────────────────────────────────────────────────

  describe('getAccount()', () => {
    it('returns the account when the user is the owner', async () => {
      const account = makeMockAccount();
      mAccountRepo.findById.mockResolvedValue(account as any);

      const result = await service.getAccount('user-001', 'acc-001');

      expect(result).toEqual(account);
    });

    it('throws when the account does not exist', async () => {
      mAccountRepo.findById.mockResolvedValue(null);

      await expect(service.getAccount('user-001', 'acc-999')).rejects.toThrow('Account not found');
    });

    it('throws when the account belongs to a different user', async () => {
      const account = makeMockAccount({ userId: 'other-user' });
      mAccountRepo.findById.mockResolvedValue(account as any);

      await expect(service.getAccount('user-001', 'acc-001')).rejects.toThrow('Account not found');
    });
  });

  // ── deposit() ────────────────────────────────────────────────────────────────

  describe('deposit()', () => {
    it('commits a credit transaction and returns updated balance', async () => {
      const account = makeMockAccount({ balance: 500, status: BankAccountStatus.ACTIVE });
      mAccountRepo.findById.mockResolvedValue(account as any);

      const result = await service.deposit('user-001', 'acc-001', 200);

      expect(result.balance).toBe(700);
      expect(result.transaction).toBeDefined();
    });

    it('throws when the account is suspended', async () => {
      const account = makeMockAccount({ status: BankAccountStatus.SUSPENDED });
      mAccountRepo.findById.mockResolvedValue(account as any);

      await expect(service.deposit('user-001', 'acc-001', 100)).rejects.toThrow('suspended');
    });
  });

  // ── withdraw() ───────────────────────────────────────────────────────────────

  describe('withdraw()', () => {
    it('commits a debit transaction and returns the new balance', async () => {
      const account = makeMockAccount({
        balance: 1000, status: BankAccountStatus.ACTIVE, accountType: AccountType.SAVINGS,
      });
      mAccountRepo.findById.mockResolvedValue(account as any);
      mTxRepo.sumDebitsForAccountToday.mockResolvedValue(0);

      const result = await service.withdraw('user-001', 'acc-001', 400);

      expect(result.balance).toBe(600);
    });

    it('throws when balance is insufficient', async () => {
      const account = makeMockAccount({ balance: 50, status: BankAccountStatus.ACTIVE });
      mAccountRepo.findById.mockResolvedValue(account as any);

      await expect(service.withdraw('user-001', 'acc-001', 100)).rejects.toThrow('Insufficient funds');
    });

    it('throws when the daily debit limit would be exceeded (savings: £2,500)', async () => {
      const account = makeMockAccount({
        balance: 5000,
        status: BankAccountStatus.ACTIVE,
        accountType: AccountType.SAVINGS,
      });
      mAccountRepo.findById.mockResolvedValue(account as any);
      // Already withdrawn £2,400 today; adding £200 pushes past the £2,500 limit
      mTxRepo.sumDebitsForAccountToday.mockResolvedValue(2_400);

      await expect(service.withdraw('user-001', 'acc-001', 200)).rejects.toThrow('daily limit');
    });

    it('throws when the account is suspended', async () => {
      const account = makeMockAccount({ status: BankAccountStatus.SUSPENDED });
      mAccountRepo.findById.mockResolvedValue(account as any);

      await expect(service.withdraw('user-001', 'acc-001', 50)).rejects.toThrow('suspended');
    });
  });

  // ── transfer() ───────────────────────────────────────────────────────────────

  describe('transfer()', () => {
    const fromAccount = makeMockAccount({
      id: 'acc-001', userId: 'user-001', accountNumber: '11111111',
      balance: 2000, currency: 'GBP',
      status: BankAccountStatus.ACTIVE, accountType: AccountType.CURRENT,
    });
    const toAccount = makeMockAccount({
      id: 'acc-002', userId: 'user-002', accountNumber: '22222222',
      balance: 500, currency: 'GBP', status: BankAccountStatus.ACTIVE,
    });

    beforeEach(() => {
      mAccountRepo.findById.mockResolvedValue(fromAccount as any);
      mAccountRepo.findByAccountNumber.mockResolvedValue(toAccount as any);
      mTxRepo.sumDebitsForAccountToday.mockResolvedValue(0);
      mTransferRepo.findById.mockResolvedValue({
        id: 'tr-001', fromAccountId: 'acc-001', toAccountId: 'acc-002',
        amount: 500, currency: 'GBP', status: 'completed',
      } as any);
    });

    it('transfers funds and returns the transfer record', async () => {
      const result = await service.transfer('user-001', 'acc-001', '22222222', 500);

      expect(result.balance).toBe(1500);
      expect(result.transfer).toBeDefined();
    });

    it('throws when transferring to the same account', async () => {
      mAccountRepo.findByAccountNumber.mockResolvedValue({ ...toAccount, id: 'acc-001' } as any);

      await expect(
        service.transfer('user-001', 'acc-001', '11111111', 100),
      ).rejects.toThrow('same account');
    });

    it('throws on currency mismatch between accounts', async () => {
      mAccountRepo.findByAccountNumber.mockResolvedValue({ ...toAccount, currency: 'EUR' } as any);

      await expect(
        service.transfer('user-001', 'acc-001', '22222222', 100),
      ).rejects.toThrow('Currency mismatch');
    });

    it('throws when the destination account is not found', async () => {
      mAccountRepo.findByAccountNumber.mockResolvedValue(null);

      await expect(
        service.transfer('user-001', 'acc-001', '99999999', 100),
      ).rejects.toThrow('Destination account not found');
    });

    it('throws when source balance is insufficient', async () => {
      mAccountRepo.findById.mockResolvedValue({ ...fromAccount, balance: 10 } as any);

      await expect(
        service.transfer('user-001', 'acc-001', '22222222', 500),
      ).rejects.toThrow('Insufficient funds');
    });

    it('throws when the source account is suspended', async () => {
      mAccountRepo.findById.mockResolvedValue(
        { ...fromAccount, status: BankAccountStatus.SUSPENDED } as any,
      );

      await expect(
        service.transfer('user-001', 'acc-001', '22222222', 100),
      ).rejects.toThrow('suspended');
    });
  });
});
