import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface Contact {
  id: string;
  ownerUserId: string;
  contactUserId?: string;
  nickname?: string;
  accountNumber?: string;
  sortCode?: string;
  tag?: string;
  createdAt: Date;
}

function mapRow(r: RowDataPacket): Contact {
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    contactUserId: r.contact_user_id ?? undefined,
    nickname: r.nickname ?? undefined,
    accountNumber: r.account_number ?? undefined,
    sortCode: r.sort_code ?? undefined,
    tag: r.tag ?? undefined,
    createdAt: r.created_at,
  };
}

export class ContactRepository {
  static async findByOwner(ownerUserId: string): Promise<Contact[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM contacts WHERE owner_user_id = ? ORDER BY created_at DESC',
      [ownerUserId]
    );
    return rows.map(r => mapRow(r as RowDataPacket));
  }

  static async create(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const id = uuidv4();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO contacts (id, owner_user_id, contact_user_id, nickname, account_number, sort_code, tag)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.ownerUserId, data.contactUserId ?? null, data.nickname ?? null,
       data.accountNumber ?? null, data.sortCode ?? null, data.tag ?? null]
    );
    return { id, ...data, createdAt: new Date() };
  }

  static async delete(id: string, ownerUserId: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM contacts WHERE id = ? AND owner_user_id = ?',
      [id, ownerUserId]
    );
    return result.affectedRows > 0;
  }
}
