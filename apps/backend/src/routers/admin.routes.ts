import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();
const adminController = new AdminController();

// All admin routes require authentication + admin role
router.use(AuthMiddleware.authenticate, AuthMiddleware.isAdmin);

/**
 * @route GET /api/v1/admin/audit-log
 * @desc Paginated fraud alert log with optional filters
 * @access Private/Admin
 */
router.get('/audit-log', adminController.getAuditLog);

/**
 * @route PATCH /api/v1/admin/audit-log/:alertId/resolve
 * @desc Mark a fraud alert as resolved
 * @access Private/Admin
 */
router.patch('/audit-log/:alertId/resolve', adminController.resolveAlert);

/**
 * @route GET /api/v1/admin/users
 * @desc List all users
 * @access Private/Admin
 */
router.get('/users', adminController.getUsers);

export default router;
