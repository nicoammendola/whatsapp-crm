import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM || 'WhatsApp CRM <onboarding@resend.dev>';

const resend = apiKey ? new Resend(apiKey) : null;

export function isEmailConfigured(): boolean {
  return !!resend;
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: 'Reset your password — WhatsApp CRM',
      html: `
        <p>You requested a password reset for your WhatsApp CRM account.</p>
        <p><a href="${resetLink}">Reset your password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      `,
    });

    if (error) {
      console.error('Resend send error:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    console.error('sendPasswordResetEmail error:', err);
    return { ok: false, error: message };
  }
}
