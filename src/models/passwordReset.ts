import { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import pool from "../config/database";

export interface PasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

function mapRow(row: RowDataPacket): PasswordReset {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    used: Boolean(row.used),
    createdAt: row.created_at,
  };
}

export class PasswordResetRepository {
  /** Store a hashed reset token for the user, invalidating any prior unused tokens first. */
  static async create(userId: string, plainToken: string): Promise<void> {
    await pool.execute(
      "UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0",
      [userId],
    );
    const hash = await bcrypt.hash(plainToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.execute<ResultSetHeader>(
      "INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [uuidv4(), userId, hash, expiresAt],
    );
  }

  /** Find all active (unused, unexpired) reset records for a user. */
  static async findActiveByUserId(userId: string): Promise<PasswordReset[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM password_resets WHERE user_id = ? AND used = 0 AND expires_at > NOW()",
      [userId],
    );
    return rows.map(mapRow);
  }

  /**
   * Verify a plain-text token against all active records for any user.
   * Returns the matching record, or null if no match.
   */
  static async findAndVerify(plainToken: string): Promise<PasswordReset | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM password_resets WHERE used = 0 AND expires_at > NOW()",
    );
    for (const row of rows) {
      const record = mapRow(row as RowDataPacket);
      const match = await bcrypt.compare(plainToken, record.tokenHash);
      if (match) return record;
    }
    return null;
  }

  /** Mark a token as used after a successful password reset. */
  static async markUsed(id: string): Promise<void> {
    await pool.execute("UPDATE password_resets SET used = 1 WHERE id = ?", [id]);
  }
}
