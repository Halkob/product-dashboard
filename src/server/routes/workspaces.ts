/**
 * GET /api/workspaces — returns workspaces available to the authenticated user's role.
 * Added during REQ-009 UAT to support the Create Project dialog (workspaceId resolution).
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  // Return workspaces that belong to the user's role, or all workspaces for admin roles
  const adminRoles = ['CEO', 'CTO', 'COO'];
  const userRole = req.user!.role;

  const workspaces = await prisma.workspace.findMany({
    where: adminRoles.includes(userRole)
      ? undefined
      : { role: { name: userRole } },
    select: {
      id: true,
      name: true,
      description: true,
      roleId: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({ data: workspaces });
});

export default router;
