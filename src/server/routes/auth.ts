import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { RegisterSchema, LoginSchema, RefreshSchema } from '../auth/schemas';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  parseExpiryMs,
} from '../auth/tokens';

const router = Router();
const prisma = new PrismaClient();

const BCRYPT_ROUNDS = parseInt(process.env['BCRYPT_ROUNDS'] ?? '10', 10);
const REFRESH_TTL = process.env['JWT_REFRESH_EXPIRATION'] ?? '7d';

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

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name },
  });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
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

  res.status(200).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name },
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { message: 'Refresh token required', statusCode: 400, timestamp: new Date().toISOString() },
    });
    return;
  }

  const { refreshToken } = parsed.data;

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

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { message: 'Refresh token required', statusCode: 400, timestamp: new Date().toISOString() },
    });
    return;
  }

  const { refreshToken } = parsed.data;

  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
