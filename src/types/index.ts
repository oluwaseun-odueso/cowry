export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  LOCKED = 'locked'
}

export enum FraudRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  location?: GeoLocation | undefined;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface FraudDetectionRule {
  name: string;
  description: string;
  severity: FraudRiskLevel;
  action: 'log' | 'alert' | 'block';
}