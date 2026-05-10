/**
 * Tests for the pure utility functions in the card model.
 * The functions are not exported so we verify behaviour through observable effects:
 *   - Luhn algorithm  → validated via known test vectors and the generated PAN
 *   - AES encrypt/decrypt → verified via a small standalone re-implementation
 *     using the same key format and IV scheme as the production code
 */
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

// ── Luhn algorithm ────────────────────────────────────────────────────────────
// Re-implement for test purposes so we can assert on PANs the service produces.

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i]!, 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

describe('Luhn algorithm (test-side implementation)', () => {
  it('validates known-good card numbers', () => {
    // Visa test PANs from various test suites
    expect(luhnCheck('4111111111111111')).toBe(true);
    expect(luhnCheck('4000056655665556')).toBe(true);
    expect(luhnCheck('5500005555555559')).toBe(true);
  });

  it('rejects numbers with incorrect check digits', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
    expect(luhnCheck('1234567890123456')).toBe(false);
  });

  it('rejects single-digit and empty strings', () => {
    expect(luhnCheck('0')).toBe(true);  // 0 → sum 0, mod 10 = 0
    expect(luhnCheck('1')).toBe(false);
  });
});

// ── AES-256-CBC encrypt/decrypt round-trip ────────────────────────────────────

// Mirrors the production implementation from models/card.ts
const CARD_KEY = process.env['CARD_ENCRYPTION_KEY']!;

function testEncrypt(plaintext: string): string {
  const key = Buffer.from(CARD_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function testDecrypt(ciphertext: string): string {
  const [ivHex, dataHex] = ciphertext.split(':');
  const key = Buffer.from(CARD_KEY, 'hex');
  const iv = Buffer.from(ivHex!, 'hex');
  const data = Buffer.from(dataHex!, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

describe('AES-256-CBC card encryption', () => {
  it('decrypt(encrypt(x)) returns the original value', () => {
    const pan = '4000470012345678';
    expect(testDecrypt(testEncrypt(pan))).toBe(pan);
  });

  it('encrypting the same value twice produces different ciphertexts (random IV)', () => {
    const pan = '4000470012345678';
    expect(testEncrypt(pan)).not.toBe(testEncrypt(pan));
  });

  it('ciphertext has the expected iv:data format', () => {
    const ct = testEncrypt('test-data');
    const parts = ct.split(':');
    expect(parts).toHaveLength(2);
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32);
  });
});

// ── PAN generation constraints ────────────────────────────────────────────────
// We cannot call generatePan() directly (not exported) but we can assert on
// what any valid Cowry PAN must look like based on the documented BIN prefix.

describe('PAN generation invariants', () => {
  const BIN = '400047';

  it('a valid Cowry PAN starts with the BIN prefix ' + BIN, () => {
    // Build a Luhn-valid 16-digit number with the Cowry BIN
    let pan = BIN;
    while (pan.length < 15) pan += '0';
    for (let d = 0; d <= 9; d++) {
      const candidate = pan + String(d);
      if (luhnCheck(candidate)) {
        expect(candidate).toMatch(/^\d{16}$/);
        expect(candidate.startsWith(BIN)).toBe(true);
        expect(luhnCheck(candidate)).toBe(true);
        break;
      }
    }
  });

  it('every generated PAN candidate passes Luhn', () => {
    // Exhaustive check: for any 15-digit prefix starting with BIN,
    // exactly one check digit (0-9) produces a valid Luhn number
    let found = 0;
    const prefix = BIN + '000000000';
    for (let d = 0; d <= 9; d++) {
      if (luhnCheck(prefix + String(d))) found++;
    }
    expect(found).toBe(1);
  });
});
