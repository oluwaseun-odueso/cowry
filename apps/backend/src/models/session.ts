import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  location?: object;
  deviceInfo?: object;
  expiresAt: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateSessionInput = Omit<Session, 'id' | 'createdAt' | 'updatedAt'>;

function mapRow(row: RowDataPacket): Session {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    refreshToken: row.refresh_token,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    location: row.location ?? undefined,
    deviceInfo: row.device_info ?? undefined,
    expiresAt: row.expires_at,
    isValid: Boolean(row.is_valid),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SessionRepository {
  static async create(data: CreateSessionInput): Promise<Session> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO sessions (id, user_id, token, refresh_token, ip_address, user_agent, location, device_info, expires_at, is_valid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId,
        data.token,
        data.refreshToken,
        data.ipAddress,
        data.userAgent,
        data.location ? JSON.stringify(data.location) : null,
        data.deviceInfo ? JSON.stringify(data.deviceInfo) : null,
        data.expiresAt,
        data.isValid ? 1 : 0,
      ]
    );
    return (await SessionRepository.findById(id))!;
  }

  static async findById(id: string): Promise<Session | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sessions WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByToken(token: string, isValid?: boolean): Promise<Session | null> {
    let sql = 'SELECT * FROM sessions WHERE token = ?';
    const params: any[] = [token];
    if (isValid !== undefined) {
      sql += ' AND is_valid = ?';
      params.push(isValid ? 1 : 0);
    }
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByRefreshToken(refreshToken: string, userId: string): Promise<Session | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sessions WHERE refresh_token = ? AND user_id = ? AND is_valid = 1',
      [refreshToken, userId]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  /** Find a session by refresh token regardless of validity — used for reuse detection */
  static async findByRefreshTokenIgnoreValidity(refreshToken: string, userId: string): Promise<Session | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sessions WHERE refresh_token = ? AND user_id = ?',
      [refreshToken, userId]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByIdAndUserId(id: string, userId: string): Promise<Session | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  /** Fetch sessions created within the last `windowMinutes` for a user (any validity). */
  static async findRecentByUserId(userId: string, windowMinutes: number): Promise<Session[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sessions
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, windowMinutes],
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async findActiveByUserId(userId: string): Promise<Session[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sessions WHERE user_id = ? AND is_valid = 1',
      [userId]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async invalidate(id: string): Promise<void> {
    await pool.execute(
      'UPDATE sessions SET is_valid = 0 WHERE id = ?',
      [id]
    );
  }

  static async invalidateByUserId(userId: string): Promise<void> {
    await pool.execute(
      'UPDATE sessions SET is_valid = 0 WHERE user_id = ?',
      [userId]
    );
  }

  static async invalidateByToken(userId: string, token: string): Promise<void> {
    await pool.execute(
      'UPDATE sessions SET is_valid = 0 WHERE user_id = ? AND token = ?',
      [userId, token]
    );
  }

  static async invalidateById(id: string, userId: string): Promise<void> {
    await pool.execute(
      'UPDATE sessions SET is_valid = 0 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  }

  static async save(session: Session): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sessions SET
        user_id = ?, token = ?, refresh_token = ?, ip_address = ?, user_agent = ?,
        location = ?, device_info = ?, expires_at = ?, is_valid = ?
       WHERE id = ?`,
      [
        session.userId,
        session.token,
        session.refreshToken,
        session.ipAddress,
        session.userAgent,
        session.location ? JSON.stringify(session.location) : null,
        session.deviceInfo ? JSON.stringify(session.deviceInfo) : null,
        session.expiresAt,
        session.isValid ? 1 : 0,
        session.id,
      ]
    );
    return result.affectedRows > 0;
  }
}
