import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { RegisterSchema, LoginSchema } from '../auth/schemas';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  parseExpiryMs,
} from '../auth/tokens';

// Rate limiter: max 5 failed-equivalent requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // only count failures toward the limit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many login attempts, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    },
  },
});

const router = Router();
const prisma = new PrismaClient();

const BCRYPT_ROUNDS = parseInt(process.env['BCRYPT_ROUNDS'] /* istanbul ignore next */ ?? '10', 10);
const REFRESH_TTL = process.env['JWT_REFRESH_EXPIRATION'] /* istanbul ignore next */ ?? '7d';
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

/** Set the refresh token as a secure httpOnly cookie */
function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    maxAge: parseExpiryMs(REFRESH_TTL),
    path: '/api/auth',
  });
}

/** Clear the refresh token cookie */
function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/api/auth',
  });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const { email, password, firstName, lastName, roleId } = parsed.data;

  // Check role exists
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    res.status(400).json({
      error: { message: 'Invalid roleId', statusCode: 400, timestamp: new Date().toISOString() },
    });
    return;
  }

  // Check duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({
      error: { message: 'Email already registered', statusCode: 409, timestamp: new Date().toISOString() },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, roleId },
    include: { role: true },
  });

  const payload = { userId: user.id, email: user.email, role: user.role.name };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + parseExpiryMs(REFRESH_TTL)),
    },
  });

  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    accessToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name },
  });
});

// POST /api/auth/login  (rate-limited: max 5 failures per 15 min per IP)
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({
      error: { message: 'Invalid credentials', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  const payload = { userId: user.id, email: user.email, role: user.role.name };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + parseExpiryMs(REFRESH_TTL)),
    },
  });

  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    accessToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name },
  });
});

// POST /api/auth/refresh  — reads refresh token from httpOnly cookie
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (!refreshToken) {
    res.status(400).json({
      error: { message: 'Refresh token required', statusCode: 400, timestamp: new Date().toISOString() },
    });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({
      error: { message: 'Invalid or expired refresh token', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
    res.status(401).json({
      error: { message: 'Refresh token revoked or expired', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });

  res.status(200).json({ accessToken: newAccessToken });
});

// POST /api/auth/logout  — reads refresh token from httpOnly cookie
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (!refreshToken) {
    res.status(400).json({
      error: { message: 'Refresh token required', statusCode: 400, timestamp: new Date().toISOString() },
    });
    return;
  }

  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  clearRefreshCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
});

// POST /api/auth/logout-all  (requires valid access token via Authorization header)
router.post('/logout-all', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Unauthorized', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(authHeader.slice(7));
  } catch {
    res.status(401).json({
      error: { message: 'Unauthorized', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  await prisma.refreshToken.updateMany({
    where: { userId: payload.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  clearRefreshCookie(res);
  res.status(200).json({ message: 'Logged out from all devices' });
});

export default router;
