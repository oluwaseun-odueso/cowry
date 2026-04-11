import { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import pool from "../config/database";

export interface MfaBackupCode {
  id: string;
  userId: string;
  codeHash: string;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

function mapRow(row: RowDataPacket): MfaBackupCode {
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    used: Boolean(row.used),
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
  };
}

export class MfaBackupCodeRepository {
  static async createMany(userId: string, plainCodes: string[]): Promise<void> {
    await MfaBackupCodeRepository.deleteByUserId(userId);
    for (const code of plainCodes) {
      const hash = await bcrypt.hash(code, 10);
      await pool.execute<ResultSetHeader>(
        "INSERT INTO mfa_backup_codes (id, user_id, code_hash) VALUES (?, ?, ?)",
        [uuidv4(), userId, hash],
      );
    }
  }

  static async findUnusedByUserId(userId: string): Promise<MfaBackupCode[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM mfa_backup_codes WHERE user_id = ? AND used = 0",
      [userId],
    );
    return rows.map(mapRow);
  }

  static async verifyAndConsume(userId: string, plainCode: string): Promise<boolean> {
    const codes = await MfaBackupCodeRepository.findUnusedByUserId(userId);
    for (const record of codes) {
      const match = await bcrypt.compare(plainCode, record.codeHash);
      if (match) {
        await pool.execute<ResultSetHeader>(
          "UPDATE mfa_backup_codes SET used = 1, used_at = NOW() WHERE id = ?",
          [record.id],
        );
        return true;
      }
    }
    return false;
  }

  static async deleteByUserId(userId: string): Promise<void> {
    await pool.execute("DELETE FROM mfa_backup_codes WHERE user_id = ?", [userId]);
  }
}
