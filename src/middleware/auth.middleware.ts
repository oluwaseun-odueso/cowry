import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { SessionRepository } from '../models';
import jwt from 'jsonwebtoken';
import { TokenPayload, UserRole } from '../types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      status: string;
    }
  }
}

export class AuthMiddleware {
  /**
   * Authenticate JWT token
   */
  static authenticate = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, async (err: any, user: Express.User, info: any) => {
      try {
        if (err) {
          return res.status(500).json({
            status: 'error',
            message: 'Authentication error'
          });
        }

        if (!user) {
          return res.status(401).json({
            status: 'error',
            message: 'Unauthorized access'
          });
        }

        // Check if user is active
        if (user.status !== 'active') {
          return res.status(403).json({
            status: 'error',
            message: 'Account is not active. Please contact support.'
          });
        }

        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
          // Verify session is still valid
          const session = await SessionRepository.findByToken(token, true);
          if (!session || session.userId !== user.id) {
            return res.status(401).json({
              status: 'error',
              message: 'Session expired or invalid'
            });
          }

          // Check if token is about to expire (less than 5 minutes)
          const decoded = jwt.decode(token) as any;
          if (decoded && decoded.exp) {
            const expirationTime = decoded.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            
            if (expirationTime - now < fiveMinutes) {
              // Token will expire soon, but we'll still allow it
              // The client should refresh the token
              res.setHeader('X-Token-Expiring', 'true');
            }
          }
        }

        req.user = user;
        next();
      } catch (error) {
        return res.status(500).json({
          status: 'error',
          message: 'Authentication failed'
        });
      }
    })(req, res, next);
  };

  /**
   * Optional authentication - doesn't require token but attaches user if present
   */
  static optional = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: any, user: Express.User) => {
      if (user) {
        req.user = user;
      }
      next();
    })(req, res, next);
  };

  /**
   * Authorize by role - must be used after authenticate middleware
   */
  static authorize = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Unauthorized access'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Forbidden: Insufficient permissions'
        });
      }

      next();
    };
  };

  /**
   * Check if user is admin - convenience method
   */
  static isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized access'
      });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: Admin access required'
      });
    }

    next();
  };

  /**
   * Validate refresh token
   */
  static validateRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
      
      // Check if session exists and is valid
      const session = await SessionRepository.findByRefreshToken(refreshToken, decoded.userId);

      if (!session) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token'
        });
      }

      if (session.expiresAt < new Date()) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token expired'
        });
      }

      req.body.decoded = decoded;
      req.body.sessionId = session.id;
      next();
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid refresh token'
      });
    }
  };

  /**
   * Extract client info (IP, user agent) from request
   */
  static extractClientInfo = (req: Request) => {
    const raw = req.ip || req.socket.remoteAddress || 'unknown';
    // Normalise IPv6-mapped IPv4 (::ffff:1.2.3.4 → 1.2.3.4)
    const ipAddress = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
    return {
      ipAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  };
}