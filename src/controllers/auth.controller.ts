import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { UserRepository, toPublicUser } from '../models';
// import { FraudDetectionService } from '../services/fraud.service';
import { GeoLocation } from '../types';
import geoip from 'geoip-lite';

export class AuthController {
  private authService: AuthService;
  // private fraudService: FraudDetectionService;

  constructor() {
    this.authService = new AuthService();
    // this.fraudService = new FraudDetectionService();
  }

  /**
   * Register a new user
   */
  register = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;
      const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);
      console.log("IP Address: ", ipAddress)
      console.log("User Agent: ", userAgent)
      
      // Get location from IP (you can implement this using a geolocation service)
      const location = this.getLocationFromIp(ipAddress);
      console.log("Location: ", location)

      const result = await this.authService.register({
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        ipAddress,
        userAgent,
        location
      });

      return res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: result
      });
    } catch (error: any) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Login user
   */
  login = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, password } = req.body;
      const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);
      
      const location = this.getLocationFromIp(ipAddress);

      const result = await this.authService.login({
        email,
        password,
        ipAddress,
        userAgent,
        location
      });

      // Set secure cookie with refresh token
      this.setRefreshTokenCookie(res, result.refreshToken);

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn
        }
      });
    } catch (error: any) {
      return res.status(401).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Google OAuth callback
   */
  googleCallback = async (req: Request, res: Response): Promise<void> => {
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3001';

    try {
      const { profile, ipAddress, userAgent } = req.user as any;

      let phoneNumber = '';
      try {
        const state = req.query.state as string;
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        phoneNumber = decoded.phoneNumber || '';
      } catch {}

      if (!phoneNumber) {
        return res.redirect(`${frontendUrl}/login?error=phone_required`);
      }

      const location = this.getLocationFromIp(ipAddress);
      const result = await this.authService.googleLogin(profile, ipAddress, userAgent, phoneNumber, location);

      this.setRefreshTokenCookie(res, result.refreshToken);
      res.redirect(`${frontendUrl}/oauth-redirect?token=${result.accessToken}`);
    } catch (error: any) {
      const msg: string = error?.message || '';

      let code: string;
      if (msg.includes('phone number already exists')) {
        code = 'phone_exists';
      } else if (msg.includes('email already exists')) {
        code = 'email_exists';
      } else if (msg.includes('not active')) {
        code = 'account_inactive';
      } else {
        code = 'auth_failed';
      }

      res.redirect(`${frontendUrl}/login?error=${code}`);
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { refreshToken } = req.body;
      const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);

      const tokens = await this.authService.refreshToken(refreshToken, ipAddress, userAgent);

      this.setRefreshTokenCookie(res, tokens.refreshToken);

      return res.status(200).json({
        status: 'success',
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn
        }
      });
    } catch (error: any) {
      return res.status(401).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Logout user
   */
  logout = async (req: Request, res: Response): Promise<Response> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (token && req.user) {
        await this.authService.logout(req.user.id, token);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
      const user = await UserRepository.findById(req.user!.id);

      return res.status(200).json({
        status: 'success',
        data: { user: user ? toPublicUser(user) : null }
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Request password reset
   */
  forgotPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email } = req.body;
      const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);

      // In a real implementation, you would:
      // 1. Generate a reset token
      // 2. Save it to the database with expiration
      // 3. Send email with reset link

      // For now, just log the request
      console.log(`Password reset requested for ${email} from ${ipAddress}`);

      // Always return success to prevent email enumeration
      return res.status(200).json({
        status: 'success',
        message: 'If the email exists, a password reset link will be sent'
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Reset password with token
   */
  resetPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { token, password } = req.body;
      const { ipAddress } = AuthMiddleware.extractClientInfo(req);

      // In a real implementation, you would:
      // 1. Verify the reset token
      // 2. Find the user
      // 3. Update password
      // 4. Invalidate all sessions

      return res.status(200).json({
        status: 'success',
        message: 'Password reset successful'
      });
    } catch (error: any) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Change password (authenticated)
   */
  changePassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.authService.changePassword(req.user!.id, currentPassword, newPassword);

      return res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      const status = error.message === 'Current password is incorrect' ? 401
        : error.message === 'User not found' ? 404 : 500;
      return res.status(status).json({
        status: 'error',
        message: error.message
      });
    }
  };

  /**
   * Initiate MFA setup — generates TOTP secret and returns QR code URI
   */
  setupMfa = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.authService.setupMfa(req.user!.id);
      return res.status(200).json({
        status: 'success',
        message: 'Scan the QR code with your authenticator app, then call /enable-mfa with the 6-digit code to activate.',
        data: result
      });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Confirm MFA setup with first TOTP code — enables MFA and returns backup codes
   */
  enableMfa = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { code } = req.body;
      const result = await this.authService.enableMfa(req.user!.id, code);
      return res.status(200).json({
        status: 'success',
        message: 'MFA enabled. Save these backup codes — they will not be shown again.',
        data: result
      });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Disable MFA — requires current TOTP code or a backup code
   */
  disableMfa = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { code } = req.body;
      await this.authService.disableMfa(req.user!.id, code);
      return res.status(200).json({ status: 'success', message: 'MFA disabled.' });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Verify MFA code after password login — exchanges challenge token for full session tokens
   */
  verifyMfa = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { challengeToken, code } = req.body;
      const { ipAddress, userAgent } = AuthMiddleware.extractClientInfo(req);
      const location = this.getLocationFromIp(ipAddress);

      const result = await this.authService.verifyMfaChallenge(
        challengeToken,
        code,
        ipAddress,
        userAgent,
        location
      );

      this.setRefreshTokenCookie(res, result.refreshToken);

      return res.status(200).json({
        status: 'success',
        message: 'MFA verification successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn
        }
      });
    } catch (error: any) {
      return res.status(401).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Helper: Set refresh token cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  private getLocationFromIp(ipAddress: string): GeoLocation | undefined {
    const geo = geoip.lookup(ipAddress);
    if (!geo) return undefined;
    return {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.ll[0],
      longitude: geo.ll[1],
    };
  }
}