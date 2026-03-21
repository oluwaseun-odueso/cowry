import fs from 'fs';
import path from 'path';
import pool from '../config/database';

export type { User, CreateUserInput, PublicUser } from './user';
export { UserRepository, comparePassword, isLocked, resetLoginAttempts, toPublicUser } from './user';

export type { Session, CreateSessionInput } from './session';
export { SessionRepository } from './session';

export type { FraudAlert, CreateFraudAlertInput } from './fraudAlert';
export { FraudAlertRepository } from './fraudAlert';

export type { MfaBackupCode } from './mfaBackupCode';
export { MfaBackupCodeRepository } from './mfaBackupCode';

export const initializeDatabase = async (): Promise<void> => {
  const schemaPath = path.join(__dirname, '../config/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await pool.execute(statement);
  }

  console.log('Database schema initialized.');
};
