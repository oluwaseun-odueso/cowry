import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Middleware factory that verifies a short-lived step-up JWT.
 * The frontend obtains this token via POST /auth/verify-otp and sends it
 * as the X-OTP-Token header on high-risk requests.
 *
 * Usage:  router.post('/...', authenticate, requireMfa, requireStepUp('large_transfer'), handler)
 */
export function requireStepUp(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const otpToken = req.headers['x-otp-token'] as string | undefined;

    if (!otpToken) {
      return res.status(403).json({
        status: 'error',
        message: 'Step-up verification required',
        stepUpRequired: true,
        action,
      });
    }

    try {
      const decoded = jwt.verify(otpToken, process.env.JWT_SECRET!) as {
        userId: string;
        action: string;
        type: string;
      };

      if (decoded.type !== 'step_up') {
        throw new Error('Wrong token type');
      }

      if (decoded.action !== action) {
        throw new Error('Token issued for a different action');
      }

      if (decoded.userId !== req.user?.id) {
        throw new Error('Token user mismatch');
      }

      next();
    } catch {
      return res.status(403).json({
        status: 'error',
        message: 'Step-up token is invalid or expired',
        stepUpRequired: true,
        action,
      });
    }
  };
}
