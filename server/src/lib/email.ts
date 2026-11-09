import { env } from '../config/env';

interface SendArgs {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends a transactional email with Brevo's HTTP API (free tier: 300/day).
 * Uses HTTPS (port 443), which works on Render's free tier where SMTP ports are blocked.
 */
export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<void> {
  if (env.EMAIL_DEV_LOG_ONLY || !env.BREVO_API_KEY) {
    console.log(`\n📧 [DEV EMAIL] to=${to.email} subject="${subject}"\n${text}\n`);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.EMAIL_FROM_ADDRESS, name: env.EMAIL_FROM_NAME },
      to: [to],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Brevo send failed (${res.status}): ${body}`);
    throw new Error('Could not send email. Please try again later.');
  }
}

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f2;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;">
  <table width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px;">
    <tr><td style="font-size:22px;font-weight:bold;color:#2f6b2f;">🌱 Digital Farm Lab</td></tr>
    <tr><td style="padding-top:16px;font-size:18px;color:#1d2a1d;font-weight:bold;">${title}</td></tr>
    <tr><td style="padding-top:12px;font-size:15px;color:#3b4a3b;line-height:1.5;">${body}</td></tr>
  </table></td></tr></table></body></html>`;
}

const codeBlock = (code: string) =>
  `<div style="margin:20px 0;font-size:32px;letter-spacing:8px;font-weight:bold;color:#2f6b2f;text-align:center;">${code}</div>`;

export function verificationEmail(name: string, code: string, minutes: number) {
  return {
    subject: `${code} is your Digital Farm Lab verification code`,
    html: layout('Confirm your email', `Hi ${escapeHtml(name)},<br/>Enter this code in the app to verify your email:${codeBlock(code)}It expires in ${minutes} minutes. If you didn't sign up, ignore this email.`),
    text: `Hi ${name},\nYour Digital Farm Lab verification code is ${code}. It expires in ${minutes} minutes.`,
  };
}

export function resetEmail(name: string, code: string, minutes: number) {
  return {
    subject: `${code} is your Digital Farm Lab password reset code`,
    html: layout('Reset your password', `Hi ${escapeHtml(name)},<br/>Use this code in the app to reset your password:${codeBlock(code)}It expires in ${minutes} minutes. If you didn't ask for this, you can safely ignore this email – your password stays the same.`),
    text: `Hi ${name},\nYour Digital Farm Lab password reset code is ${code}. It expires in ${minutes} minutes.`,
  };
}

export function passwordChangedEmail(name: string) {
  return {
    subject: 'Your Digital Farm Lab password was changed',
    html: layout('Password changed', `Hi ${escapeHtml(name)},<br/>Your password was just changed. If this wasn't you, reset your password immediately from the app.`),
    text: `Hi ${name},\nYour Digital Farm Lab password was just changed. If this wasn't you, reset it immediately.`,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
