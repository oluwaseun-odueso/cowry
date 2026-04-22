import { Router } from "express";
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import accountRoutes from './account.routes';
import transactionRoutes from './transaction.routes';
import cardRoutes from './card.routes';

const router = Router()

router.use('/auth', authRoutes)
router.use('/admin', adminRoutes)
router.use('/accounts', accountRoutes)
router.use('/transactions', transactionRoutes)
// Card routes mount at root (some are /accounts/:id/cards, some are /cards/:cardId, some are /merchant-blocks)
router.use('/', cardRoutes)

export default router