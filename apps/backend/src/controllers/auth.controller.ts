import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { UserRepository, toPublicUser } from '../models';
import { emailService } from '../services/email.service';
// import { FraudDetectionService } from '../services/fraud.service';
import { GeoLocation } from '@cowry/types';
import geoip from 'geoip-lite';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OtpAction } from '@cowry/types';
import { OtpCodeRepository } from '../models/otpCode';

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

      const { verificationToken, ...rest } = result;
      try {
        await emailService.sendVerificationEmail(email, firstName, verificationToken);
      } catch (emailError: any) {
        console.error('Failed to send verification email:', emailError.message);
        // Dev fallback: log the verification link so registration can be tested without email
        const devLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        console.warn(`[DEV] Verify email manually: ${devLink}`);
      }
      return res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: rest,
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

      if (result.mfaRequired) {
        return res.status(200).json({
          status: 'success',
          message: 'MFA required. Submit the 6-digit code to /verify-mfa.',
          data: { mfaRequired: true, challengeToken: result.challengeToken }
        });
      }

      // Set secure cookie with refresh token
      this.setRefreshTokenCookie(res, result.refreshToken);

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
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
          refreshToken: tokens.refreshToken,
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
   * Update authenticated user's profile fields (firstName, lastName, phoneNumber)
   */
  updateProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { firstName, lastName, phoneNumber } = req.body;
      if (!firstName && !lastName && !phoneNumber) {
        return res.status(400).json({ status: 'error', message: 'Provide at least one field to update.' });
      }
      const patch: Record<string, string> = {};
      if (firstName)   patch.firstName   = firstName;
      if (lastName)    patch.lastName    = lastName;
      if (phoneNumber) patch.phoneNumber = phoneNumber;
      await UserRepository.update(req.user!.id, patch);
      const user = await UserRepository.findById(req.user!.id);
      return res.status(200).json({
        status: 'success',
        message: 'Profile updated.',
        data: { user: user ? toPublicUser(user) : null },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Request password reset
   */
  forgotPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email } = req.body;
      const token = await this.authService.generatePasswordResetToken(email);

      const user = await UserRepository.findByEmail(email);
      if (user) {
        await emailService.sendPasswordResetEmail(email, user.firstName, token);
      }

      return res.status(200).json({
        status: 'success',
        message: 'If the email exists, a password reset link has been sent.',
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Reset password with token
   */
  resetPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { token, password } = req.body;
      await this.authService.resetPassword(token, password);
      return res.status(200).json({
        status: 'success',
        message: 'Password reset successful. Please log in with your new password.',
      });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
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
   * Get all active sessions for the authenticated user
   */
  getSessions = async (req: Request, res: Response): Promise<Response> => {
    try {
      const sessions = await this.authService.getUserSessions(req.user!.id);
      return res.status(200).json({ status: 'success', data: { sessions } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Revoke a specific session by ID
   */
  revokeSession = async (req: Request, res: Response): Promise<Response> => {
    try {
      const sessionId = req.params.sessionId as string;
      if (!sessionId) {
        return res.status(400).json({ status: 'error', message: 'Session ID is required.' });
      }
      await this.authService.revokeSession(req.user!.id, sessionId);
      return res.status(200).json({ status: 'success', message: 'Session revoked.' });
    } catch (error: any) {
      const status = error.message === 'Session not found' ? 404 : 500;
      return res.status(status).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Logout from all devices — invalidates every active session for the user
   */
  logoutAll = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.authService.logoutAll(req.user!.id);
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      return res.status(200).json({ status: 'success', message: 'Logged out from all devices.' });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Verify email address using the plain-text token from the verification link
   */
  verifyEmail = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { token } = req.body;
      await this.authService.verifyEmail(token);
      return res.status(200).json({
        status: 'success',
        message: 'Email verified successfully. You can now log in.',
      });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  };

  verifyEmailGet = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string' || token.length !== 64) {
        return res.status(400).json({ status: 'error', message: 'Invalid verification token' });
      }
      await this.authService.verifyEmail(token);
      return res.status(200).json({
        status: 'success',
        message: 'Email verified successfully. You can now log in.',
      });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
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
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn
        }
      });
    } catch (error: any) {
      return res.status(401).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Request a step-up OTP — generates a 6-digit code, stores a bcrypt hash,
   * and sends it via SMS to the authenticated user's phone number.
   */
  requestOtp = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { action } = req.body;
      const validActions = Object.values(OtpAction) as string[];
      if (!action || !validActions.includes(action)) {
        return res.status(400).json({ status: 'error', message: 'Invalid action.' });
      }

      const user = await UserRepository.findById(req.user!.id);
      if (!user) return res.status(404).json({ status: 'error', message: 'User not found.' });

      const code = String(crypto.randomInt(100000, 999999));
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await OtpCodeRepository.create(user.id, action, codeHash, expiresAt);

      try {
        await emailService.sendOtpEmail(user.email, user.firstName, code, action as OtpAction);
      } catch (emailErr) {
        console.warn(`[DEV] OTP email failed — code for ${action}: ${code}`, emailErr);
      }

      return res.status(200).json({ status: 'success', data: { sent: true } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  /**
   * Verify a step-up OTP and issue a short-lived step-up JWT (10 min, type "step_up").
   * The frontend sends this token as X-OTP-Token on the guarded request.
   */
  verifyOtp = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { action, code } = req.body;
      if (!action || !code) {
        return res.status(400).json({ status: 'error', message: 'action and code are required.' });
      }

      const record = await OtpCodeRepository.findPending(req.user!.id, action);
      if (!record) {
        return res.status(400).json({ status: 'error', message: 'No pending OTP found. Please request a new code.' });
      }

      const valid = await bcrypt.compare(String(code), record.codeHash);
      if (!valid) {
        return res.status(400).json({ status: 'error', message: 'Invalid code.' });
      }

      await OtpCodeRepository.markUsed(record.id);

      const otpToken = jwt.sign(
        { userId: req.user!.id, action, type: 'step_up' },
        process.env.JWT_SECRET!,
        { expiresIn: '10m' }
      );

      return res.status(200).json({ status: 'success', data: { otpToken } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };

  setPasscode = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { passcode } = req.body;
      if (!passcode || !/^\d{6}$/.test(passcode)) {
        return res.status(400).json({ status: 'error', message: 'Passcode must be exactly 6 digits.' });
      }
      const hash = await bcrypt.hash(passcode, 10);
      await UserRepository.setPasscode(req.user!.id, hash);
      return res.json({ status: 'success', message: 'Passcode set.' });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  };

  verifyPasscode = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { passcode } = req.body;
      if (!passcode) {
        return res.status(400).json({ status: 'error', message: 'Passcode is required.' });
      }
      const user = await UserRepository.findById(req.user!.id);
      if (!user?.passcodeHash) {
        return res.status(400).json({ status: 'error', message: 'No passcode set.' });
      }
      const valid = await bcrypt.compare(passcode, user.passcodeHash);
      if (!valid) {
        return res.status(401).json({ status: 'error', message: 'Incorrect passcode.' });
      }
      return res.json({ status: 'success', data: { valid: true } });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  };

  setAvatar = async (req: Request, res: Response): Promise<Response> => {
    const VALID_AVATARS = [
      'hereLocsAvatar', 'blackBoyOnLowcut', 'indianBoy',
      'retiredOldMan', 'retiredOldWoman', 'whiteBoy', 'whiteGirl', 'youngGirl1',
    ];
    try {
      const { avatar } = req.body;
      if (!avatar || !VALID_AVATARS.includes(avatar)) {
        return res.status(400).json({ status: 'error', message: 'Invalid avatar slug.' });
      }
      await UserRepository.setAvatar(req.user!.id, avatar);
      return res.json({ status: 'success', message: 'Avatar updated.' });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
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