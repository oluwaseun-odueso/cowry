import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM;

let client: ReturnType<typeof twilio> | null = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

export async function sendOtpSms(to: string, code: string, action: string): Promise<void> {
  const actionLabels: Record<string, string> = {
    large_transfer:   'a large transfer',
    change_password:  'a password change',
    unfreeze_card:    'unfreezing your card',
    cancel_card:      'cancelling your card',
    disable_mfa:      'disabling MFA',
    reveal_card:      'viewing your card details',
  };
  const label = actionLabels[action] ?? 'a sensitive action';

  if (!client || !fromNumber) {
    // Dev fallback: log the code so developers can proceed without Twilio credentials
    console.warn(`[OTP] Twilio not configured. Code for ${action}: ${code}`);
    return;
  }

  await client.messages.create({
    body: `Your Cowry verification code for ${label} is: ${code}. It expires in 10 minutes. Never share this code.`,
    from: fromNumber,
    to,
  });
}
