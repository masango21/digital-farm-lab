import { resolveMx } from 'node:dns/promises';

/** Common throwaway-inbox domains. Extend as needed. */
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'throwawaymail.com', 'maildrop.cc',
  'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'emailondeck.com',
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * First line of defence for "real emails": the domain must not be a known
 * disposable provider and must have MX records (can receive mail).
 * The 6-digit verification code is the final proof the inbox is real.
 */
export async function checkEmailDeliverable(email: string): Promise<{ ok: boolean; reason?: string }> {
  const domain = email.split('@')[1];
  if (!domain) return { ok: false, reason: 'Invalid email address' };
  if (DISPOSABLE.has(domain)) return { ok: false, reason: 'Disposable email addresses are not allowed' };
  // Set EMAIL_DNS_CHECK=false only for offline development/tests.
  if (process.env.NODE_ENV === 'test' || process.env.EMAIL_DNS_CHECK === 'false') return { ok: true };
  try {
    const mx = await resolveMx(domain);
    if (!mx || mx.length === 0) return { ok: false, reason: 'This email domain cannot receive mail' };
    return { ok: true };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { ok: false, reason: 'This email domain does not exist' };
    // DNS hiccup – don't block sign-up; verification code still proves the inbox.
    return { ok: true };
  }
}
