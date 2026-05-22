const BANNED = ['password', 'credit card', 'ssn', 'kill yourself', 'nazi'];

export function moderateReply(text: string): { ok: boolean; reason?: string; text: string } {
  if (!text?.trim()) return { ok: false, reason: 'empty', text: '' };

  let out = text.trim();
  if (out.length > 2000) out = out.slice(0, 2000);

  const lower = out.toLowerCase();
  for (const w of BANNED) {
    if (lower.includes(w)) return { ok: false, reason: 'banned_keyword', text: '' };
  }

  // Basic spam: same char repeated 30+ times
  if (/(.)\1{29,}/.test(out)) return { ok: false, reason: 'spam_pattern', text: '' };

  return { ok: true, text: out };
}
