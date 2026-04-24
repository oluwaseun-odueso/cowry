export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum AccountStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  LOCKED = "locked",
}

export enum AccountType {
  SAVINGS = "savings",
  CURRENT = "current",
}

export enum BankAccountStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
}

export enum TransactionType {
  CREDIT = "credit",
  DEBIT = "debit",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  sortCode: string;
  accountType: AccountType;
  currency: string;
  balance: number;
  status: BankAccountStatus;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  status: TransactionStatus;
  metadata?: object;
  createdAt: Date;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  reference: string;
  status: TransactionStatus;
  createdAt: Date;
}

export enum OtpAction {
  LARGE_TRANSFER  = "large_transfer",
  CHANGE_PASSWORD = "change_password",
  UNFREEZE_CARD   = "unfreeze_card",
  CANCEL_CARD     = "cancel_card",
  DISABLE_MFA     = "disable_mfa",
  REVEAL_CARD     = "reveal_card",
  UNBLOCK_CARD    = "unblock_card",
}

export const OTP_ACTION_LABELS: Record<OtpAction, string> = {
  [OtpAction.LARGE_TRANSFER]:  "a large transfer",
  [OtpAction.CHANGE_PASSWORD]: "a password change",
  [OtpAction.UNFREEZE_CARD]:   "unfreezing your card",
  [OtpAction.CANCEL_CARD]:     "cancelling your card",
  [OtpAction.DISABLE_MFA]:     "disabling two-factor authentication",
  [OtpAction.REVEAL_CARD]:     "viewing your full card details",
  [OtpAction.UNBLOCK_CARD]:    "unblocking your card",
};

export enum FraudRiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  type?: "access" | "mfa_challenge";
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
  action: "log" | "alert" | "block";
}
