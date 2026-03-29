/**
 * REQ-003 AC1 — Project CRUD
 * Routes: POST/GET /api/projects, GET/PUT/DELETE /api/projects/:id
 * All routes require authentication. Mutation routes require creator or admin.
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────────────────────

function projectSelect() {
  return {
    id: true,
    key: true,
    name: true,
    description: true,
    status: true,
    workspaceId: true,
    startDate: true,
    endDate: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    createdBy: {
      select: { id: true, firstName: true, lastName: true, email: true },
    },
    _count: { select: { issues: true, sprints: true } },
  } as const;
}

function isAdminOrCreator(userRole: string, userId: number, createdById: number): boolean {
  const adminRoles = ['CEO', 'CTO', 'COO'];
  return adminRoles.includes(userRole) || userId === createdById;
}

// ── POST /api/projects ───────────────────────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { key, name, description, workspaceId, startDate, endDate } = req.body as {
    key?: string;
    name?: string;
    description?: string;
    workspaceId?: number;
    startDate?: string;
    endDate?: string;
  };

  if (!key || !name || !workspaceId) {
    res.status(400).json({
      error: { message: 'key, name and workspaceId are required', statusCode: 400 },
    });
    return;
  }

  const projectKey = key.toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(projectKey)) {
    res.status(400).json({
      error: {
        message: 'key must be 2-10 uppercase letters/digits starting with a letter',
        statusCode: 400,
      },
    });
    return;
  }

  const existing = await prisma.project.findFirst({
    where: { key: projectKey, workspaceId: Number(workspaceId) },
  });
  if (existing) {
    res.status(409).json({
      error: { message: `Project key '${projectKey}' already exists in this workspace`, statusCode: 409 },
    });
    return;
  }

  const project = await prisma.project.create({
    data: {
      key: projectKey,
      name: name.trim(),
      description: description?.trim(),
      workspaceId: Number(workspaceId),
      createdById: req.user!.userId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
    select: projectSelect(),
  });

  res.status(201).json({ data: project });
});

// ── GET /api/projects ────────────────────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { archivedAt: null };
  if (req.query['workspaceId']) where['workspaceId'] = Number(req.query['workspaceId']);
  if (req.query['status']) where['status'] = String(req.query['status']);
  if (req.query['search']) {
    where['OR'] = [
      { name: { contains: String(req.query['search']), mode: 'insensitive' } },
      { key: { contains: String(req.query['search']), mode: 'insensitive' } },
    ];
  }

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      select: projectSelect(),
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: projects,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /api/projects/:id ────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) { res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return; }

  const project = await prisma.project.findUnique({ where: { id }, select: projectSelect() });
  if (!project || project.archivedAt) {
    res.status(404).json({ error: { message: 'Project not found', statusCode: 404 } });
    return;
  }
  res.json({ data: project });
});

// ── PUT /api/projects/:id ────────────────────────────────────────────────────

router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) { res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return; }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.archivedAt) {
    res.status(404).json({ error: { message: 'Project not found', statusCode: 404 } });
    return;
  }

  if (!isAdminOrCreator(req.user!.role, req.user!.userId, project.createdById)) {
    res.status(403).json({ error: { message: 'Forbidden', statusCode: 403 } });
    return;
  }

  const { name, description, status, startDate, endDate } = req.body as {
    name?: string;
    description?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };

  const validStatuses = ['active', 'paused', 'completed', 'archived'];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: { message: `status must be one of: ${validStatuses.join(', ')}`, statusCode: 400 } });
    return;
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(status && { status }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    },
    select: projectSelect(),
  });

  res.json({ data: updated });
});

// ── DELETE /api/projects/:id  (soft delete) ──────────────────────────────────

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) { res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return; }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.archivedAt) {
    res.status(404).json({ error: { message: 'Project not found', statusCode: 404 } });
    return;
  }

  if (!isAdminOrCreator(req.user!.role, req.user!.userId, project.createdById)) {
    res.status(403).json({ error: { message: 'Forbidden', statusCode: 403 } });
    return;
  }

  await prisma.project.update({ where: { id }, data: { archivedAt: new Date() } });
  res.status(204).send();
});

export default router;
