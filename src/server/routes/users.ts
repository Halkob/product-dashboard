/**
 * Users listing route — used by frontend to populate assignee dropdowns.
 * GET /api/users — returns all users (id, firstName, lastName, email)
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  res.json({ data: users });
});

export default router;
