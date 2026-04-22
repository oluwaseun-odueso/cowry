import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();
const accountController = new AccountController();

/**
 * @route GET /api/v1/transactions/:id
 * @desc Get a single transaction by ID
 * @access Private
 */
router.get(
  '/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireMfa,
  accountController.getTransaction
);

export default router;
