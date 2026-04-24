import Mailjet from 'node-mailjet';
import { OtpAction, OTP_ACTION_LABELS } from '@cowry/types';

class EmailService {
  private client = Mailjet.apiConnect(
    process.env.MAILJET_API_KEY!,
    process.env.MAILJET_SECRET_KEY!
  );

  async sendVerificationEmail(toEmail: string, firstName: string, token: string): Promise<void> {
    const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    await this.client.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME,
          },
          To: [{ Email: toEmail, Name: firstName }],
          Subject: 'Verify your Cowry email',
          HTMLPart: `<p>Hi ${firstName},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${link}">Verify Email</a></p><p>This link expires in 24 hours.</p>`,
        },
      ],
    });
  }

  async sendOtpEmail(toEmail: string, firstName: string, code: string, action: OtpAction): Promise<void> {
    const label = OTP_ACTION_LABELS[action] ?? 'a sensitive action';
    await this.client.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME,
          },
          To: [{ Email: toEmail, Name: firstName }],
          Subject: 'Your Cowry verification code',
          HTMLPart: `<p>Hi ${firstName},</p><p>Your Cowry verification code for <strong>${label}</strong> is:</p><p style="font-size:2rem;font-weight:bold;letter-spacing:0.2em;">${code}</p><p>It expires in 10 minutes. Never share this code with anyone.</p><p>If you did not request this, please contact support immediately.</p>`,
        },
      ],
    });
  }

  async sendPasswordResetEmail(toEmail: string, firstName: string, token: string): Promise<void> {
    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await this.client.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME,
          },
          To: [{ Email: toEmail, Name: firstName }],
          Subject: 'Reset your Cowry password',
          HTMLPart: `<p>Hi ${firstName},</p><p>Click the link below to reset your password:</p><p><a href="${link}">Reset Password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
        },
      ],
    });
  }
}

export const emailService = new EmailService();
