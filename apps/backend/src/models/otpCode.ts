import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface OtpCode {
  id: string;
  userId: string;
  action: string;
  codeHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export class OtpCodeRepository {
  static async create(userId: string, action: string, codeHash: string, expiresAt: Date): Promise<OtpCode> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO otp_codes (id, user_id, action, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [id, userId, action, codeHash, expiresAt]
    );
    return {
      id,
      userId,
      action,
      codeHash,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };
  }

  static async findPending(userId: string, action: string): Promise<OtpCode | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM otp_codes WHERE user_id = ? AND action = ? AND used = 0 AND expires_at > UTC_TIMESTAMP() ORDER BY created_at DESC LIMIT 1`,
      [userId, action]
    );
    if (rows.length === 0) return null;
    const r = rows[0] as RowDataPacket;
    return {
      id: r.id,
      userId: r.user_id,
      action: r.action,
      codeHash: r.code_hash,
      expiresAt: r.expires_at,
      used: r.used === 1,
      createdAt: r.created_at,
    };
  }

  static async markUsed(id: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      `UPDATE otp_codes SET used = 1 WHERE id = ?`,
      [id]
    );
  }
}
