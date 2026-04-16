import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config';

// Fixed application-specific salt (not the session secret, which serves a different purpose)
const PASSWORD_SALT = Buffer.from('zebra-bu-mapping-ui-v1');

// Compute the expected hash once at module load — scrypt is expensive by design
const EXPECTED_HASH = crypto.scryptSync(config.uiPassword, PASSWORD_SALT, 32);

// Random token generated at process start; invalidated on restart
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

// 8 hours
const SESSION_MAX_AGE = 8 * 60 * 60;

if (
  config.uiPassword === 'admin' ||
  config.uiSessionSecret === 'default-ui-session-secret'
) {
  console.warn(
    '[WARN] UI_PASSWORD or UI_SESSION_SECRET is using an insecure default value. ' +
      'Set these environment variables before running in production.'
  );
}

function parseCookies(req: Request): Record<string, string> {
  return (req.headers.cookie || '').split(';').reduce(
    (acc: Record<string, string>, part: string) => {
      const [key, ...rest] = part.trim().split('=');
      if (key) acc[key.trim()] = rest.join('=').trim();
      return acc;
    },
    {}
  );
}

export function requireUiAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req);
  const token = cookies['ui_session'] ?? '';
  if (
    token.length === SESSION_TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(SESSION_TOKEN))
  ) {
    next();
    return;
  }
  res.redirect('/ui/login');
}

function cookieFlags(): string {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Strict${secure}`;
}

export function setUiSession(res: Response): void {
  res.setHeader('Set-Cookie', `ui_session=${SESSION_TOKEN}; ${cookieFlags()}`);
}

export function clearUiSession(res: Response): void {
  res.setHeader('Set-Cookie', 'ui_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
}

export function checkPassword(input: string): boolean {
  // Derive hash from the input using the same salt and length; compare with timingSafeEqual
  const provided = crypto.scryptSync(input, PASSWORD_SALT, 32);
  return crypto.timingSafeEqual(EXPECTED_HASH, provided);
}
