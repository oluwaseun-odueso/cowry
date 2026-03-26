import Mailjet from 'node-mailjet';

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
