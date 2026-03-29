import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
}

const ACCESS_SECRET = process.env['JWT_SECRET'] ?? 'dev-access-secret';
const REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? 'dev-refresh-secret';
const ACCESS_TTL = process.env['JWT_EXPIRATION'] ?? '15m';
const REFRESH_TTL = process.env['JWT_REFRESH_EXPIRATION'] ?? '7d';

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions);
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}

/** Returns milliseconds from now for a given JWT expiry string e.g. '7d', '15m' */
export function parseExpiryMs(expiry: string): number {
  const units: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) throw new Error(`Invalid expiry format: ${expiry}`);
  return parseInt(match[1], 10) * (units[match[2]] ?? 0);
}
