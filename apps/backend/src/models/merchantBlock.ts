import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface MerchantBlock {
  id: string;
  userId: string;
  merchantName: string;
  createdAt: Date;
}

function mapRow(r: RowDataPacket): MerchantBlock {
  return { id: r.id, userId: r.user_id, merchantName: r.merchant_name, createdAt: r.created_at };
}

export class MerchantBlockRepository {
  static async findByUserId(userId: string): Promise<MerchantBlock[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM merchant_blocks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async create(userId: string, merchantName: string): Promise<MerchantBlock> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      'INSERT INTO merchant_blocks (id, user_id, merchant_name) VALUES (?, ?, ?)',
      [id, userId, merchantName]
    );
    return { id, userId, merchantName, createdAt: new Date() };
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM merchant_blocks WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}
