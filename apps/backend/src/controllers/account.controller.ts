import { Request, Response } from 'express';
import { AccountService } from '../services/account.service';
import { AccountType, TransactionType } from '@cowry/types';

export class AccountController {
  private accountService: AccountService;

  constructor() {
    this.accountService = new AccountService();
  }

  createAccount = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      const { type, currency } = req.body;
      const account = await this.accountService.createAccount(userId, type as AccountType, currency);
      return res.status(201).json({ status: 'success', data: { account } });
    } catch (error: any) {
      const status = error.message.includes('already have') ? 409 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  getAccounts = async (req: Request, res: Response): Promise<Response> => {
    try {
      const accounts = await this.accountService.getAccounts(req.user!.id);
      return res.status(200).json({ status: 'success', data: { accounts } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  getAccount = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const account = await this.accountService.getAccount(req.user!.id, req.params.id);
      return res.status(200).json({ status: 'success', data: { account } });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  deposit = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const { amount, description } = req.body;
      const { transaction, balance } = await this.accountService.deposit(
        req.user!.id,
        req.params.id,
        parseFloat(amount),
        description
      );
      return res.status(200).json({ status: 'success', data: { transaction, balance } });
    } catch (error: any) {
      const status = error.message.includes('suspended') || error.message.includes('not found') ? 400 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  withdraw = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const { amount, description } = req.body;
      const { transaction, balance } = await this.accountService.withdraw(
        req.user!.id,
        req.params.id,
        parseFloat(amount),
        description
      );
      return res.status(200).json({ status: 'success', data: { transaction, balance } });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  };

  createTransfer = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const { toAccountId, amount, description } = req.body;
      const { transfer, balance } = await this.accountService.transfer(
        req.user!.id,
        req.params.id,
        toAccountId,
        parseFloat(amount),
        description
      );
      return res.status(200).json({ status: 'success', data: { transfer, balance } });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  getTransactions = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const { type, from, to, minAmount, maxAmount, page, limit } = req.query;

      const options: any = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      };
      if (type && ['credit', 'debit'].includes(type as string)) {
        options.type = type as TransactionType;
      }
      if (from) options.from = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        options.to = toDate;
      }
      if (minAmount) options.minAmount = parseFloat(minAmount as string);
      if (maxAmount) options.maxAmount = parseFloat(maxAmount as string);

      const result = await this.accountService.getTransactions(req.user!.id, req.params.id, options);

      return res.status(200).json({
        status: 'success',
        data: {
          transactions: result.transactions,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            pages: Math.ceil(result.total / result.limit),
          },
        },
      });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  getTransaction = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const transaction = await this.accountService.getTransaction(req.user!.id, req.params.id);
      return res.status(200).json({ status: 'success', data: { transaction } });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  getStatement = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const { from, to } = req.query;
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      const statement = await this.accountService.getStatement(
        req.user!.id,
        req.params.id,
        new Date(from as string),
        toDate
      );
      return res.status(200).json({ status: 'success', data: statement });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };
}
