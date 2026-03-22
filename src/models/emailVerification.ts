import { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import pool from "../config/database";

export interface EmailVerification {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

function mapRow(row: RowDataPacket): EmailVerification {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    used: Boolean(row.used),
    createdAt: row.created_at,
  };
}

export class EmailVerificationRepository {
  /** Store a hashed verification token, invalidating any prior unused token for this user. */
  static async create(userId: string, plainToken: string): Promise<void> {
    await pool.execute(
      "UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0",
      [userId],
    );
    const hash = await bcrypt.hash(plainToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await pool.execute<ResultSetHeader>(
      "INSERT INTO email_verifications (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [uuidv4(), userId, hash, expiresAt],
    );
  }

  /**
   * Verify a plain-text token against all active (unused, unexpired) records.
   * Returns the matching record, or null if no match.
   */
  static async findAndVerify(plainToken: string): Promise<EmailVerification | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM email_verifications WHERE used = 0 AND expires_at > NOW()",
    );
    for (const row of rows) {
      const record = mapRow(row as RowDataPacket);
      const match = await bcrypt.compare(plainToken, record.tokenHash);
      if (match) return record;
    }
    return null;
  }

  /** Mark a token as used after successful verification. */
  static async markUsed(id: string): Promise<void> {
    await pool.execute("UPDATE email_verifications SET used = 1 WHERE id = ?", [id]);
  }
}
