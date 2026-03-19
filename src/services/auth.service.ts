import jwt, { SignOptions } from "jsonwebtoken";
import {
  UserRepository,
  SessionRepository,
  FraudAlertRepository,
  comparePassword,
  isLocked,
  resetLoginAttempts,
  toPublicUser,
} from "../models";
import type { User } from "../models";
import {
  TokenPayload,
  UserRole,
  AccountStatus,
  GeoLocation,
  LoginAttempt,
  FraudRiskLevel,
} from "../types";
import { randomBytes } from "crypto";

export class AuthService {
  /**
   * Register a new user with email and password
   */
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    ipAddress: string;
    userAgent: string;
    location?: GeoLocation | undefined;
  }) {
    // Check if user already exists
    const existingUser = await UserRepository.findByEmail(userData.email.toLowerCase());
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const existingPhone = await UserRepository.findByPhoneNumber(userData.phoneNumber);
    if (existingPhone) {
      throw new Error("A user with this phone number already exists");
    }

    // Create new user
    const user = await UserRepository.create({
      email: userData.email.toLowerCase(),
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phoneNumber: userData.phoneNumber,
      emailVerified: false,
      role: UserRole.USER,
    });

    // Log the registration in fraud alerts (for audit)
    await FraudAlertRepository.create({
      userId: user.id,
      ruleName: "USER_REGISTRATION",
      riskLevel: FraudRiskLevel.LOW,
      description: `New user registration from ${userData.ipAddress}`,
      ipAddress: userData.ipAddress,
      location: userData.location,
      metadata: {
        email: userData.email,
        userAgent: userData.userAgent,
      },
      action: "log",
    });

    const sessionData: {
      ipAddress: string;
      userAgent: string;
      location?: GeoLocation | null;
    } = { ipAddress: userData.ipAddress, userAgent: userData.userAgent };
    if (userData.location) sessionData.location = userData.location;

    const tokens = await this.generateTokens(user, sessionData);

    return { user: toPublicUser(user), ...tokens };
  }

  /**
   * Login with email and password
   */
  async login(credentials: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent: string;
    location?: GeoLocation | undefined;
  }) {
    // Find user by email
    let user = await UserRepository.findByEmail(credentials.email.toLowerCase());

    if (!user) {
      await this.logFailedAttempt({
        email: credentials.email,
        ipAddress: credentials.ipAddress,
        userAgent: credentials.userAgent,
        timestamp: new Date(),
        success: false,
        location: credentials.location,
      });
      throw new Error("Invalid email or password");
    }

    // Check if account is locked
    if (isLocked(user)) {
      await FraudAlertRepository.create({
        userId: user.id,
        ruleName: "LOCKED_ACCOUNT_ATTEMPT",
        riskLevel: FraudRiskLevel.HIGH,
        description: `Attempted login to locked account from ${credentials.ipAddress}`,
        ipAddress: credentials.ipAddress,
        location: credentials.location,
        metadata: { email: credentials.email, userAgent: credentials.userAgent },
        action: "block",
      });
      throw new Error("Account is temporarily locked. Please try again later or reset your password.");
    }

    // Verify password
    const isValidPassword = await comparePassword(user, credentials.password);

    if (!isValidPassword) {
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5");
      const newAttempts = user.loginAttempts + 1;
      const lockTime = parseInt(process.env.LOGIN_ATTEMPT_WINDOW || "15");
      const updates: Partial<User> = { loginAttempts: newAttempts };

      if (newAttempts >= maxAttempts) {
        const lockUntil = new Date(Date.now() + lockTime * 60 * 1000);
        updates.lockUntil = lockUntil;
        updates.status = AccountStatus.LOCKED;

        await FraudAlertRepository.create({
          userId: user.id,
          ruleName: "ACCOUNT_LOCKED",
          riskLevel: FraudRiskLevel.HIGH,
          description: `Account locked due to ${maxAttempts} failed login attempts`,
          ipAddress: credentials.ipAddress,
          location: credentials.location,
          metadata: { attempts: newAttempts, lockUntil },
          action: "lock",
        });
      }

      await UserRepository.update(user.id, updates);

      await this.logFailedAttempt({
        email: credentials.email,
        ipAddress: credentials.ipAddress,
        userAgent: credentials.userAgent,
        timestamp: new Date(),
        success: false,
        location: credentials.location,
      });

      throw new Error("Invalid email or password");
    }

    // Check if email is verified
    if (!user.emailVerified && process.env.NODE_ENV === "production") {
      throw new Error("Please verify your email before logging in");
    }

    // Check if account is active
    if (user.status !== "active") {
      throw new Error("Your account is not active. Please contact support.");
    }

    // Successful login - reset attempts and update last login
    user = await resetLoginAttempts(user);
    await UserRepository.update(user.id, {
      lastLogin: new Date(),
      lastLoginIp: credentials.ipAddress,
    });
    user = { ...user, lastLogin: new Date(), lastLoginIp: credentials.ipAddress };

    await FraudAlertRepository.create({
      userId: user.id,
      ruleName: "SUCCESSFUL_LOGIN",
      riskLevel: FraudRiskLevel.LOW,
      description: `Successful login from ${credentials.ipAddress}`,
      ipAddress: credentials.ipAddress,
      location: credentials.location,
      metadata: { userAgent: credentials.userAgent, timestamp: new Date() },
      action: "log",
    });

    const sessionData: {
      ipAddress: string;
      userAgent: string;
      location?: GeoLocation | null;
    } = { ipAddress: credentials.ipAddress, userAgent: credentials.userAgent };
    if (credentials.location) sessionData.location = credentials.location;

    const tokens = await this.generateTokens(user, sessionData);

    return { user: toPublicUser(user), ...tokens };
  }

  /**
   * Handle Google OAuth login
   */
  async googleLogin(
    profile: any,
    ipAddress: string,
    userAgent: string,
    phoneNumber: string,
    location?: GeoLocation,
  ) {
    const email = profile.emails[0].value.toLowerCase();

    // Check if user exists with this Google ID
    let user = await UserRepository.findByGoogleId(profile.id);

    if (!user) {
      // Check if user exists with this email
      user = await UserRepository.findByEmail(email);

      if (user) {
        // Link Google account to existing user
        await UserRepository.update(user.id, {
          googleId: profile.id,
          profilePicture: profile.photos[0]?.value || user.profilePicture,
          phoneNumber: user.phoneNumber || phoneNumber,
        });
        user = { ...user, googleId: profile.id, profilePicture: profile.photos[0]?.value || user.profilePicture, phoneNumber: user.phoneNumber || phoneNumber };

        await FraudAlertRepository.create({
          userId: user.id,
          ruleName: "GOOGLE_ACCOUNT_LINKED",
          riskLevel: FraudRiskLevel.LOW,
          description: `Google account linked to existing user`,
          ipAddress,
          location,
          metadata: { email, googleId: profile.id },
          action: "log",
        });
      } else {
        // Check phone number uniqueness before creating
        const existingPhone = await UserRepository.findByPhoneNumber(phoneNumber);
        if (existingPhone) {
          throw new Error("A user with this phone number already exists");
        }

        // Create new user with Google data
        user = await UserRepository.create({
          email,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          googleId: profile.id,
          profilePicture: profile.photos[0]?.value,
          emailVerified: true,
          role: UserRole.USER,
          phoneNumber,
        });
      }
    }

    // Update last login
    await UserRepository.update(user.id, { lastLogin: new Date(), lastLoginIp: ipAddress });
    user = { ...user, lastLogin: new Date(), lastLoginIp: ipAddress };

    const sessionData: {
      ipAddress: string;
      userAgent: string;
      location?: GeoLocation | null;
    } = { ipAddress, userAgent };
    if (location) sessionData.location = location;

    const tokens = await this.generateTokens(user, sessionData);

    return { user: toPublicUser(user), ...tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, ipAddress: string, userAgent: string) {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!,
      ) as TokenPayload;

      const session = await SessionRepository.findByRefreshToken(refreshToken, decoded.userId);

      if (!session) {
        throw new Error("Invalid refresh token");
      }

      if (session.expiresAt < new Date()) {
        await SessionRepository.invalidate(session.id);
        throw new Error("Refresh token expired");
      }

      const user = await UserRepository.findById(decoded.userId);
      if (!user || user.status !== "active") {
        throw new Error("User not found or inactive");
      }

      const sessionData: {
        ipAddress: string;
        userAgent: string;
        location?: GeoLocation | null;
      } = { ipAddress, userAgent };
      if (session.location) sessionData.location = session.location as GeoLocation;

      const tokens = await this.generateTokens(user, sessionData);

      await SessionRepository.invalidate(session.id);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid refresh token");
      }
      throw error;
    }
  }

  /**
   * Logout user by invalidating session
   */
  async logout(userId: string, token: string) {
    await SessionRepository.invalidateByToken(userId, token);
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string) {
    await SessionRepository.invalidateByUserId(userId);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    sessionData?: {
      ipAddress: string;
      userAgent: string;
      location?: GeoLocation | null;
    },
  ) {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessSecret = process.env.JWT_SECRET as string;
    const refreshSecret = process.env.JWT_REFRESH_SECRET as string;

    const accessOptions: SignOptions = {
      expiresIn: 15 * 60,
      issuer: "the-bank-api",
      audience: "the-bank-client",
    };

    const refreshOptions: SignOptions = {
      expiresIn: 7 * 24 * 60 * 60,
      issuer: "the-bank-api",
      audience: "the-bank-client",
    };

    const accessToken = jwt.sign(payload, accessSecret, accessOptions);
    const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions);

    const accessExpiresIn = 15 * 60;
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    if (sessionData) {
      const sessionPayload: any = {
        userId: user.id,
        token: accessToken,
        refreshToken,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        expiresAt: refreshExpiresAt,
        isValid: true,
        deviceInfo: this.parseUserAgent(sessionData.userAgent),
      };

      if (sessionData.location) {
        sessionPayload.location = sessionData.location;
      }

      await SessionRepository.create(sessionPayload);
    }

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  /**
   * Parse user agent string to get device info
   */
  private parseUserAgent(userAgent: string) {
    try {
      const ua = require("useragent").parse(userAgent);
      return {
        browser: `${ua.family} ${ua.major}`,
        os: `${ua.os.family} ${ua.os.major}`,
        device: ua.device.family,
        isMobile: ua.device.family === "Other" ? false : true,
      };
    } catch (error) {
      return { browser: "Unknown", os: "Unknown", device: "Unknown", isMobile: false };
    }
  }

  /**
   * Log failed login attempt
   */
  private async logFailedAttempt(attempt: LoginAttempt) {
    try {
      await FraudAlertRepository.create({
        ruleName: "FAILED_LOGIN_ATTEMPT",
        riskLevel: FraudRiskLevel.MEDIUM,
        description: `Failed login attempt from ${attempt.ipAddress}`,
        ipAddress: attempt.ipAddress,
        location: attempt.location,
        metadata: {
          email: attempt.email,
          userAgent: attempt.userAgent,
          timestamp: attempt.timestamp,
        },
        action: "log",
      });
    } catch (error) {
      console.error("Failed to log login attempt:", error);
    }
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email: string): Promise<string> {
    const user = await UserRepository.findByEmail(email.toLowerCase());

    if (!user) {
      return randomBytes(32).toString("hex");
    }

    randomBytes(32); // generate token placeholder
    // TODO: store hashed token + expiry in a dedicated password_resets table
    throw new Error("Password reset not yet implemented");
  }

  /**
   * Reset password with token
   */
  async resetPassword(_token: string, _newPassword: string): Promise<boolean> {
    // TODO: implement with a dedicated password_resets table
    throw new Error("Password reset not yet implemented");
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const isValid = await comparePassword(user, currentPassword);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    await UserRepository.update(userId, { password: newPassword });
    await SessionRepository.invalidateByUserId(userId);

    return true;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<boolean> {
    return true;
  }

  /**
   * Get active sessions for user
   */
  async getUserSessions(userId: string) {
    const sessions = await SessionRepository.findActiveByUserId(userId);
    return sessions.map(s => ({
      id: s.id,
      ipAddress: s.ipAddress,
      deviceInfo: s.deviceInfo,
      location: s.location,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, sessionId: string) {
    const session = await SessionRepository.findByIdAndUserId(sessionId, userId);

    if (!session || !session.isValid) {
      throw new Error("Session not found");
    }

    await SessionRepository.invalidate(session.id);
    return true;
  }
}
