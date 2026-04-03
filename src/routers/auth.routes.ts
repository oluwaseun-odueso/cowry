import { Router } from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { UserRepository, toPublicUser } from '../models'

// Tight limiter for credential submission endpoints (login, MFA verify, token refresh)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { status: 'error', message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Broader limiter for registration and password-recovery endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 'error', message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
const authController = new AuthController();

// ============================================
// Public Routes
// ============================================

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  '/register',
  authLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.registerRules),
  authController.register
);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  loginLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.loginRules),
  authController.login
);

/**
 * @route POST /api/v1/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post(
  '/refresh-token',
  loginLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.refreshTokenRules),
  authController.refreshToken
);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.forgotPasswordRules),
  authController.forgotPassword
);

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post(
  '/reset-password',
  authLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.resetPasswordRules),
  authController.resetPassword
);

// ============================================
// Google OAuth Routes
// ============================================

/**
 * @route GET /api/v1/auth/google
 * @desc Initiate Google OAuth
 * @access Public
 */
router.get('/google', (req, res, next) => {
  const { phoneNumber } = req.query;
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Phone number is required' });
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: Buffer.from(JSON.stringify({ phoneNumber })).toString('base64'),
  } as any)(req, res, next);
});

/**
 * @route GET /api/v1/auth/oauth-redirect?token=...
 * @desc Dev-only: returns the OAuth access token as JSON (no frontend needed)
 * @access Public
 */
router.get('/oauth-redirect', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ status: 'error', message: 'No token provided' });
  return res.status(200).json({ status: 'success', accessToken: token });
});

/**
 * @route GET /api/v1/auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login'
  }),
  authController.googleCallback
);

// ============================================
// Protected Routes (Require Authentication)
// ============================================

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post(
  '/logout',
  AuthMiddleware.authenticate,
  authController.logout
);

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get(
  '/profile',
  AuthMiddleware.authenticate,
  authController.getProfile
);

/**
 * @route GET /api/v1/auth/sessions
 * @desc List all active sessions for the authenticated user
 * @access Private
 */
router.get(
  '/sessions',
  AuthMiddleware.authenticate,
  authController.getSessions
);

/**
 * @route DELETE /api/v1/auth/sessions/:sessionId
 * @desc Revoke a specific session
 * @access Private
 */
router.delete(
  '/sessions/:sessionId',
  AuthMiddleware.authenticate,
  authController.revokeSession
);

/**
 * @route POST /api/v1/auth/logout-all
 * @desc Logout from all devices
 * @access Private
 */
router.post(
  '/logout-all',
  AuthMiddleware.authenticate,
  authController.logoutAll
);

/**
 * @route PUT /api/v1/auth/change-password
 * @desc Change password
 * @access Private
 */
router.put(
  '/change-password',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validate(ValidationMiddleware.changePasswordRules),
  authController.changePassword
);

/**
 * @route GET /api/v1/auth/verify-email?token=...
 * @desc Verify email when user clicks the link in their inbox (browser GET)
 * @access Public
 */
router.get('/verify-email', authLimiter, authController.verifyEmailGet);

/**
 * @route POST /api/v1/auth/verify-email
 * @desc Verify email address with token from verification link
 * @access Public
 */
router.post(
  '/verify-email',
  authLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.verifyEmailRules),
  authController.verifyEmail
);

/**
 * @route POST /api/v1/auth/setup-mfa
 * @desc Generate TOTP secret and QR code URI (step 1 of MFA setup)
 * @access Private
 */
router.post(
  '/setup-mfa',
  AuthMiddleware.authenticate,
  authController.setupMfa
);

/**
 * @route POST /api/v1/auth/enable-mfa
 * @desc Confirm MFA with first TOTP code, activate MFA, receive backup codes (step 2)
 * @access Private
 */
router.post(
  '/enable-mfa',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validate(ValidationMiddleware.enableMfaRules),
  authController.enableMfa
);

/**
 * @route POST /api/v1/auth/verify-mfa
 * @desc Exchange MFA challenge token + TOTP/backup code for full session tokens
 * @access Public
 */
router.post(
  '/verify-mfa',
  loginLimiter,
  ValidationMiddleware.validate(ValidationMiddleware.verifyMfaRules),
  authController.verifyMfa
);

/**
 * @route POST /api/v1/auth/disable-mfa
 * @desc Disable MFA — requires current TOTP or backup code
 * @access Private
 */
router.post(
  '/disable-mfa',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validate(ValidationMiddleware.disableMfaRules),
  authController.disableMfa
);

// ============================================
// Admin Routes (Require Admin Role)
// ============================================

/**
 * @route GET /api/v1/auth/users
 * @desc Get all users (admin only)
 * @access Private/Admin
 */
router.get(
  '/users',
  AuthMiddleware.authenticate,
  AuthMiddleware.isAdmin,
  async (req, res) => {
    try {
      const users = (await UserRepository.findAll()).map(toPublicUser);
      res.json({
        status: 'success',
        data: { users }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch users'
      });
    }
  }
);

/**
 * @route PUT /api/v1/auth/users/:userId/status
 * @desc Update user status (admin only)
 * @access Private/Admin
 */
// router.put(
//   '/users/:userId/status',
//   AuthMiddleware.authenticate,
//   AuthMiddleware.isAdmin,
//   async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const { status } = req.body;

//       const user = await User.findByPk(userId);
//       if (!user) {
//         return res.status(404).json({
//           status: 'error',
//           message: 'User not found'
//         });
//       }

//       user.status = status;
//       await user.save();

//       res.json({
//         status: 'success',
//         message: 'User status updated successfully',
//         data: { user: user.toJSON() }
//       });
//     } catch (error) {
//       res.status(500).json({
//         status: 'error',
//         message: 'Failed to update user status'
//       });
//     }
//   }
// );

export default router;