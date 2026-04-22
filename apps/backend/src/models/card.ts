import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../config/database';

export interface Card {
  id: string;
  accountId: string;
  cardType: 'debit' | 'prepaid' | 'disposable';
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  isFrozen: boolean;
  status: 'active' | 'frozen' | 'blocked' | 'cancelled' | 'used';
  isDisposable: boolean;
  createdAt: Date;
}

export interface CardWithPan extends Card {
  cardNumber: string;
  cvv: string;
}

// ─── AES-256-CBC helpers ──────────────────────────────────────────────────────

function getKey(): Buffer {
  const key = process.env.CARD_ENCRYPTION_KEY;
  if (!key) throw new Error('CARD_ENCRYPTION_KEY is not set');
  return Buffer.from(key, 'hex');
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(ciphertext: string): string {
  const [ivHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ─── Luhn PAN generation ──────────────────────────────────────────────────────

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function generatePan(): string {
  const bin = '400047'; // Cowry Visa-style BIN prefix
  let pan = bin;
  while (pan.length < 15) {
    pan += String(Math.floor(Math.random() * 10));
  }
  // Find check digit
  for (let d = 0; d <= 9; d++) {
    const candidate = pan + String(d);
    if (luhnCheck(candidate)) return candidate;
  }
  throw new Error('Failed to generate Luhn-valid PAN');
}

function generateCvv(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: RowDataPacket): Card {
  return {
    id: row.id,
    accountId: row.account_id,
    cardType: row.card_type,
    lastFour: row.last_four,
    expiryMonth: row.expiry_month,
    expiryYear: row.expiry_year,
    isFrozen: row.is_frozen === 1,
    status: row.status,
    isDisposable: row.is_disposable === 1,
    createdAt: row.created_at,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class CardRepository {
  static async create(accountId: string, cardType: 'debit' | 'disposable' = 'debit'): Promise<Card> {
    const pan = generatePan();
    const cvv = generateCvv();
    const lastFour = pan.slice(-4);
    const now = new Date();
    const expiryYear = now.getFullYear() + (cardType === 'disposable' ? 0 : 3);
    // Disposable cards expire in ~24h — set expiry to current month/year (1 day TTL enforced by status)
    const expiryMonth = now.getMonth() + 1;
    const id = uuidv4();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO cards (id, account_id, card_type, card_number, last_four, expiry_month, expiry_year, cvv, is_disposable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, accountId, cardType, encrypt(pan), lastFour, expiryMonth, expiryYear, encrypt(cvv), cardType === 'disposable' ? 1 : 0]
    );

    return (await CardRepository.findById(id))!;
  }

  static async findById(id: string): Promise<Card | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM cards WHERE id = ?', [id]);
    return rows.length > 0 ? mapRow(rows[0] as RowDataPacket) : null;
  }

  static async findByAccountId(accountId: string): Promise<Card[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM cards WHERE account_id = ? ORDER BY created_at ASC',
      [accountId]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  /** Returns decrypted PAN + CVV — only call this for authenticated reveal requests. */
  static async reveal(id: string): Promise<CardWithPan | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM cards WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const r = rows[0] as RowDataPacket;
    return {
      ...mapRow(r),
      cardNumber: decrypt(r.card_number as string),
      cvv: decrypt(r.cvv as string),
    };
  }

  static async updateStatus(id: string, status: Card['status'], isFrozen?: boolean): Promise<boolean> {
    const frozen = isFrozen !== undefined ? isFrozen : undefined;
    if (frozen !== undefined) {
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE cards SET status = ?, is_frozen = ? WHERE id = ?',
        [status, frozen ? 1 : 0, id]
      );
      return result.affectedRows > 0;
    }
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE cards SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }
}
