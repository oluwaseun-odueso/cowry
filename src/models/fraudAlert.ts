import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { FraudRiskLevel } from '../types';

export interface FraudAlert {
  id: string;
  userId?: string;
  sessionId?: string;
  ruleName: string;
  riskLevel: FraudRiskLevel;
  description: string;
  ipAddress: string;
  location?: object;
  metadata?: object;
  action: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateFraudAlertInput = {
  userId?: string | undefined;
  sessionId?: string | undefined;
  ruleName: string;
  riskLevel: FraudRiskLevel;
  description: string;
  ipAddress: string;
  location?: object | undefined;
  metadata?: object | undefined;
  action: string;
};

function mapRow(row: RowDataPacket): FraudAlert {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    ruleName: row.rule_name,
    riskLevel: row.risk_level as FraudRiskLevel,
    description: row.description,
    ipAddress: row.ip_address,
    location: row.location ?? undefined,
    metadata: row.metadata ?? undefined,
    action: row.action,
    isResolved: Boolean(row.is_resolved),
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class FraudAlertRepository {
  static async create(data: CreateFraudAlertInput): Promise<FraudAlert> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO fraud_alerts (id, user_id, session_id, rule_name, risk_level, description, ip_address, location, metadata, action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId ?? null,
        data.sessionId ?? null,
        data.ruleName,
        data.riskLevel,
        data.description,
        data.ipAddress,
        data.location ? JSON.stringify(data.location) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.action,
      ]
    );
    return (await FraudAlertRepository.findById(id))!;
  }

  static async findById(id: string): Promise<FraudAlert | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM fraud_alerts WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByUserId(
    userId: string,
    options?: { riskLevel?: FraudRiskLevel; isResolved?: boolean; limit?: number }
  ): Promise<FraudAlert[]> {
    let sql = 'SELECT * FROM fraud_alerts WHERE user_id = ?';
    const params: any[] = [userId];

    if (options?.riskLevel !== undefined) {
      sql += ' AND risk_level = ?';
      params.push(options.riskLevel);
    }
    if (options?.isResolved !== undefined) {
      sql += ' AND is_resolved = ?';
      params.push(options.isResolved ? 1 : 0);
    }
    if (options?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async resolve(id: string, resolvedBy: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE fraud_alerts SET is_resolved = 1, resolved_at = NOW(), resolved_by = ? WHERE id = ?',
      [resolvedBy, id]
    );
    return result.affectedRows > 0;
  }
}
