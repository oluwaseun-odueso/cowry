import { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import pool from "../config/database";
import { UserRole, AccountStatus } from '@cowry/types';

export interface User {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: AccountStatus;
  googleId?: string;
  profilePicture?: string;
  lastLogin?: Date;
  lastLoginIp?: string;
  loginAttempts: number;
  lockUntil?: Date;
  phoneNumber: string;
  tag?: string;
  passcodeHash?: string;
  avatar?: string;
  isMfaEnabled: boolean;
  mfaSecret?: string;
  emailVerified: boolean;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserInput = {
  email: string;
  password?: string | null | undefined;
  firstName: string;
  lastName: string;
  role?: UserRole | undefined;
  status?: AccountStatus | undefined;
  googleId?: string | undefined;
  profilePicture?: string | undefined;
  phoneNumber: string;
  isMfaEnabled?: boolean | undefined;
  emailVerified?: boolean | undefined;
};

export type PublicUser = Omit<User, "password" | "refreshToken" | "mfaSecret">;

const COLUMN_MAP: Record<string, string> = {
  email: "email",
  password: "password",
  firstName: "first_name",
  lastName: "last_name",
  role: "role",
  status: "status",
  googleId: "google_id",
  profilePicture: "profile_picture",
  lastLogin: "last_login",
  lastLoginIp: "last_login_ip",
  loginAttempts: "login_attempts",
  lockUntil: "lock_until",
  phoneNumber: "phone_number",
  tag: "tag",
  passcodeHash: "passcode_hash",
  avatar: "avatar",
  isMfaEnabled: "is_mfa_enabled",
  mfaSecret: "mfa_secret",
  emailVerified: "email_verified",
  refreshToken: "refresh_token",
};

function mapRow(row: RowDataPacket): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role as UserRole,
    status: row.status as AccountStatus,
    googleId: row.google_id ?? undefined,
    profilePicture: row.profile_picture ?? undefined,
    lastLogin: row.last_login ?? undefined,
    lastLoginIp: row.last_login_ip ?? undefined,
    loginAttempts: row.login_attempts,
    lockUntil: row.lock_until ?? undefined,
    phoneNumber: row.phone_number ?? undefined,
    tag: row.tag ?? undefined,
    passcodeHash: row.passcode_hash ?? undefined,
    avatar: row.avatar ?? undefined,
    isMfaEnabled: Boolean(row.is_mfa_enabled),
    mfaSecret: row.mfa_secret ?? undefined,
    emailVerified: Boolean(row.email_verified),
    refreshToken: row.refresh_token ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository {
  static async create(data: CreateUserInput): Promise<User> {
    const id = uuidv4();
    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;

    try {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO users (id, email, password, first_name, last_name, role, status, google_id, profile_picture, phone_number, is_mfa_enabled, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.email,
          hashedPassword,
          data.firstName,
          data.lastName,
          data.role ?? UserRole.USER,
          data.status ?? AccountStatus.ACTIVE,
          data.googleId ?? null,
          data.profilePicture ?? null,
          data.phoneNumber,
          data.isMfaEnabled ? 1 : 0,
          data.emailVerified ? 1 : 0,
        ],
      );
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        if (err.message?.includes("uq_users_phone_number")) {
          throw new Error("A user with this phone number already exists");
        }
        throw new Error("A user with this email already exists");
      }
      throw err;
    }

    return (await UserRepository.findById(id))!;
  }

  static async findById(id: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByGoogleId(googleId: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE google_id = ?",
      [googleId],
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE phone_number = ?",
      [phoneNumber],
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByTag(tag: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE tag = ?",
      [tag.startsWith("@") ? tag.slice(1) : tag],
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async searchByTag(query: string): Promise<User[]> {
    const q = (query.startsWith("@") ? query.slice(1) : query).toLowerCase();
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE tag LIKE ? LIMIT 10",
      [`${q}%`],
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async setTag(id: string, tag: string): Promise<void> {
    await pool.execute("UPDATE users SET tag = ? WHERE id = ?", [tag, id]);
  }

  static async setPasscode(id: string, passcodeHash: string): Promise<void> {
    await pool.execute("UPDATE users SET passcode_hash = ? WHERE id = ?", [passcodeHash, id]);
  }

  static async setAvatar(id: string, avatar: string): Promise<void> {
    await pool.execute("UPDATE users SET avatar = ? WHERE id = ?", [avatar, id]);
  }

  static async findAll(): Promise<User[]> {
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM users");
    return rows.map(mapRow);
  }

  static async update(id: string, data: Partial<User>): Promise<boolean> {
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      const col = COLUMN_MAP[key];
      if (!col) continue;

      if (key === "password" && value) {
        setClauses.push(`${col} = ?`);
        values.push(await bcrypt.hash(value as string, 10));
      } else {
        setClauses.push(`${col} = ?`);
        values.push(value ?? null);
      }
    }

    if (setClauses.length === 0) return false;

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`,
      values,
    );
    return result.affectedRows > 0;
  }

  static async clearMfaSecret(id: string): Promise<void> {
    await pool.execute("UPDATE users SET mfa_secret = NULL WHERE id = ?", [id]);
  }

  static async save(user: User): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET
        email = ?, password = ?, first_name = ?, last_name = ?, role = ?, status = ?,
        google_id = ?, profile_picture = ?, last_login = ?, last_login_ip = ?,
        login_attempts = ?, lock_until = ?, phone_number = ?, is_mfa_enabled = ?,
        mfa_secret = ?, email_verified = ?, refresh_token = ?
       WHERE id = ?`,
      [
        user.email,
        user.password ?? null,
        user.firstName,
        user.lastName,
        user.role,
        user.status,
        user.googleId ?? null,
        user.profilePicture ?? null,
        user.lastLogin ?? null,
        user.lastLoginIp ?? null,
        user.loginAttempts,
        user.lockUntil ?? null,
        user.phoneNumber ?? null,
        user.isMfaEnabled ? 1 : 0,
        user.mfaSecret ?? null,
        user.emailVerified ? 1 : 0,
        user.refreshToken ?? null,
        user.id,
      ],
    );
    return result.affectedRows > 0;
  }
}

export async function comparePassword(
  user: User,
  candidatePassword: string,
): Promise<boolean> {
  if (!user.password) return false;
  return bcrypt.compare(candidatePassword, user.password);
}

export function isLocked(user: User): boolean {
  return !!(user.lockUntil && user.lockUntil > new Date());
}


export async function resetLoginAttempts(user: User): Promise<User> {
  await pool.execute(
    "UPDATE users SET login_attempts = 0, lock_until = NULL, status = ? WHERE id = ?",
    [AccountStatus.ACTIVE, user.id],
  );
  const updated = { ...user, loginAttempts: 0, status: AccountStatus.ACTIVE };
  delete updated.lockUntil;
  return updated;
}

export function toPublicUser(user: User): PublicUser {
  const { password, refreshToken, mfaSecret, ...publicUser } = user;
  return publicUser;
}
