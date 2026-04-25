import { Router } from 'express';
import { CardController } from '../controllers/card.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { requireStepUp } from '../middleware/stepup.middleware';

const router = Router();
const cardController = new CardController();

// ─── Account-scoped card routes ───────────────────────────────────────────────

router.post('/accounts/:id/cards', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.issueCard);
router.get('/accounts/:id/cards', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.listCards);
router.post('/accounts/:id/cards/disposable', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.issueDisposableCard);

// ─── Card-level routes ────────────────────────────────────────────────────────

router.get('/cards/:cardId', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.getCard);
router.get('/cards/:cardId/reveal', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, requireStepUp('reveal_card'), cardController.revealCard);

router.post('/cards/:cardId/freeze', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.freezeCard);
router.post('/cards/:cardId/unfreeze', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, requireStepUp('unfreeze_card'), cardController.unfreezeCard);
router.post('/cards/:cardId/block', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, requireStepUp('unblock_card'), cardController.blockCard);
router.post('/cards/:cardId/unblock', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, requireStepUp('unblock_card'), cardController.unblockCard);
router.post('/cards/:cardId/cancel', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, requireStepUp('cancel_card'), cardController.cancelCard);
router.post('/cards/:cardId/cancel-disposable', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.cancelDisposableCard);

// ─── Merchant block routes ────────────────────────────────────────────────────

router.get('/merchant-blocks', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.listMerchantBlocks);
router.post('/merchant-blocks', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.createMerchantBlock);
router.delete('/merchant-blocks/:blockId', AuthMiddleware.authenticate, AuthMiddleware.requireMfa, cardController.deleteMerchantBlock);

export default router;
