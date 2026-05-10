import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { ValidationMiddleware } from '../../../middleware/validation.middleware';

/** Creates a minimal Express app that applies given rules then returns 200 on success. */
function makeApp(rules: any[]) {
  const app = express();
  app.use(express.json());
  app.post('/test', ValidationMiddleware.validate(rules), (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  return app;
}

// ── registerRules ─────────────────────────────────────────────────────────────

describe('ValidationMiddleware.registerRules', () => {
  const valid = {
    email: 'jane@example.com',
    password: 'Passw0rd!',
    firstName: 'Jane',
    lastName: "O'Brien",
    phoneNumber: '+447700900123',
  };

  it('passes a fully valid payload', async () => {
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send(valid);
    expect(res.status).toBe(200);
  });

  it('rejects an invalid email', async () => {
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send({ ...valid, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('email');
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send({ ...valid, password: 'Ab1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('password');
  });

  it('rejects a password missing a special character', async () => {
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send({ ...valid, password: 'Password123' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing firstName', async () => {
    const { firstName: _, ...rest } = valid;
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send(rest);
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: any) => e.field);
    expect(fields).toContain('firstName');
  });

  it('rejects a firstName that contains numbers', async () => {
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send({ ...valid, firstName: 'Jane123' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid phone number', async () => {
    const res = await request(makeApp(ValidationMiddleware.registerRules))
      .post('/test')
      .send({ ...valid, phoneNumber: 'abc-not-a-phone' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('phoneNumber');
  });
});

// ── loginRules ────────────────────────────────────────────────────────────────

describe('ValidationMiddleware.loginRules', () => {
  it('passes valid login credentials', async () => {
    const res = await request(makeApp(ValidationMiddleware.loginRules))
      .post('/test')
      .send({ email: 'user@example.com', password: 'anything' });
    expect(res.status).toBe(200);
  });

  it('rejects missing email', async () => {
    const res = await request(makeApp(ValidationMiddleware.loginRules))
      .post('/test')
      .send({ password: 'anything' });
    expect(res.status).toBe(400);
  });

  it('rejects missing password', async () => {
    const res = await request(makeApp(ValidationMiddleware.loginRules))
      .post('/test')
      .send({ email: 'user@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects malformed email', async () => {
    const res = await request(makeApp(ValidationMiddleware.loginRules))
      .post('/test')
      .send({ email: 'bad', password: 'any' });
    expect(res.status).toBe(400);
  });
});

// ── depositRules ──────────────────────────────────────────────────────────────

describe('ValidationMiddleware.depositRules', () => {
  it('passes a valid positive amount', async () => {
    const res = await request(makeApp(ValidationMiddleware.depositRules))
      .post('/test')
      .send({ amount: 50.5 });
    expect(res.status).toBe(200);
  });

  it('rejects amount of zero', async () => {
    const res = await request(makeApp(ValidationMiddleware.depositRules))
      .post('/test')
      .send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative amount', async () => {
    const res = await request(makeApp(ValidationMiddleware.depositRules))
      .post('/test')
      .send({ amount: -10 });
    expect(res.status).toBe(400);
  });

  it('rejects a missing amount', async () => {
    const res = await request(makeApp(ValidationMiddleware.depositRules))
      .post('/test')
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects description longer than 255 characters', async () => {
    const res = await request(makeApp(ValidationMiddleware.depositRules))
      .post('/test')
      .send({ amount: 10, description: 'x'.repeat(256) });
    expect(res.status).toBe(400);
  });
});

// ── transferRules ─────────────────────────────────────────────────────────────

describe('ValidationMiddleware.transferRules', () => {
  const valid = { toAccountNumber: '12345678', amount: 100 };

  it('passes a valid transfer payload', async () => {
    const res = await request(makeApp(ValidationMiddleware.transferRules))
      .post('/test')
      .send(valid);
    expect(res.status).toBe(200);
  });

  it('rejects a non-numeric account number', async () => {
    const res = await request(makeApp(ValidationMiddleware.transferRules))
      .post('/test')
      .send({ ...valid, toAccountNumber: 'ABC123' });
    expect(res.status).toBe(400);
  });

  it('rejects an account number shorter than 6 digits', async () => {
    const res = await request(makeApp(ValidationMiddleware.transferRules))
      .post('/test')
      .send({ ...valid, toAccountNumber: '1234' });
    expect(res.status).toBe(400);
  });

  it('rejects a zero amount', async () => {
    const res = await request(makeApp(ValidationMiddleware.transferRules))
      .post('/test')
      .send({ ...valid, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects when toAccountNumber is missing', async () => {
    const res = await request(makeApp(ValidationMiddleware.transferRules))
      .post('/test')
      .send({ amount: 100 });
    expect(res.status).toBe(400);
  });
});

// ── verifyMfaRules ────────────────────────────────────────────────────────────

describe('ValidationMiddleware.verifyMfaRules', () => {
  it('passes a 6-digit TOTP code', async () => {
    const res = await request(makeApp(ValidationMiddleware.verifyMfaRules))
      .post('/test')
      .send({ challengeToken: 'tok', code: '123456' });
    expect(res.status).toBe(200);
  });

  it('passes an 8-char uppercase backup code', async () => {
    const res = await request(makeApp(ValidationMiddleware.verifyMfaRules))
      .post('/test')
      .send({ challengeToken: 'tok', code: 'ABCD1234' });
    expect(res.status).toBe(200);
  });

  it('rejects a 5-digit code', async () => {
    const res = await request(makeApp(ValidationMiddleware.verifyMfaRules))
      .post('/test')
      .send({ challengeToken: 'tok', code: '12345' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing challengeToken', async () => {
    const res = await request(makeApp(ValidationMiddleware.verifyMfaRules))
      .post('/test')
      .send({ code: '123456' });
    expect(res.status).toBe(400);
  });
});
