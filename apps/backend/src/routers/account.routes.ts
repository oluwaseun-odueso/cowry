import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';

const router = Router();
const accountController = new AccountController();

/**
 * @route POST /api/v1/accounts
 * @desc Create a new account
 * @access Private
 */
router.post(
  '/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  ValidationMiddleware.validate(ValidationMiddleware.createAccountRules),
  accountController.createAccount
);

/**
 * @route GET /api/v1/accounts
 * @desc Get all accounts for the authenticated user
 * @access Private
 */
router.get(
  '/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  accountController.getAccounts
);

/**
 * @route GET /api/v1/accounts/:id
 * @desc Get a single account by ID
 * @access Private
 */
router.get(
  '/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  accountController.getAccount
);

/**
 * @route POST /api/v1/accounts/:id/deposit
 * @desc Deposit funds into an account
 * @access Private
 */
router.post(
  '/:id/deposit',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  ValidationMiddleware.validate(ValidationMiddleware.depositRules),
  accountController.deposit
);

/**
 * @route POST /api/v1/accounts/:id/withdraw
 * @desc Withdraw funds from an account
 * @access Private
 */
router.post(
  '/:id/withdraw',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  ValidationMiddleware.validate(ValidationMiddleware.withdrawRules),
  accountController.withdraw
);

/**
 * @route POST /api/v1/accounts/:id/transfer
 * @desc Transfer funds to another account
 * @access Private
 */
router.post(
  '/:id/transfer',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  ValidationMiddleware.validate(ValidationMiddleware.transferRules),
  accountController.createTransfer
);

/**
 * @route GET /api/v1/accounts/:id/transactions
 * @desc Get transactions for an account
 * @access Private
 */
router.get(
  '/:id/transactions',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  accountController.getTransactions
);

/**
 * @route GET /api/v1/accounts/:id/statement
 * @desc Get statement for an account
 * @access Private
 */
router.get(
  '/:id/statement',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  ValidationMiddleware.validate(ValidationMiddleware.statementRules),
  accountController.getStatement
);

export default router;
