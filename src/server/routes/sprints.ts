/**
 * REQ-003 AC4 — Sprint management
 * Routes: POST/GET /api/projects/:projectId/sprints
 *         GET/PUT /api/projects/:projectId/sprints/:sprintId
 *         POST /api/projects/:projectId/sprints/:sprintId/close
 *         GET  /api/projects/:projectId/backlog
 *         GET  /api/projects/:projectId/sprints/:sprintId/board
 *         GET  /api/projects/:projectId/sprints/:sprintId/velocity
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// ── POST /api/projects/:projectId/sprints ─────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(projectId)) { res.status(400).json({ error: { message: 'Invalid projectId', statusCode: 400 } }); return; }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, archivedAt: true } });
  if (!project || project.archivedAt) {
    res.status(404).json({ error: { message: 'Project not found', statusCode: 404 } }); return;
  }

  const { name, goal, startDate, endDate } = req.body as {
    name?: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!name) {
    res.status(400).json({ error: { message: 'name is required', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.create({
    data: {
      name: name.trim(),
      goal: goal?.trim(),
      projectId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  res.status(201).json({ data: sprint });
});

// ── GET /api/projects/:projectId/sprints ──────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(projectId)) { res.status(400).json({ error: { message: 'Invalid projectId', statusCode: 400 } }); return; }

  const where: Record<string, unknown> = { projectId };
  if (req.query['status']) where['status'] = String(req.query['status']);

  const sprints = await prisma.sprint.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { issues: true } } },
  });

  res.json({ data: sprints });
});

// ── GET /api/projects/:projectId/sprints/:sprintId ────────────────────────────

router.get('/:sprintId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const sprintId = parseInt(req.params['sprintId'], 10);
  if (isNaN(projectId) || isNaN(sprintId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId },
    include: { _count: { select: { issues: true } } },
  });

  if (!sprint) { res.status(404).json({ error: { message: 'Sprint not found', statusCode: 404 } }); return; }
  res.json({ data: sprint });
});

// ── PUT /api/projects/:projectId/sprints/:sprintId ────────────────────────────

router.put('/:sprintId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const sprintId = parseInt(req.params['sprintId'], 10);
  if (isNaN(projectId) || isNaN(sprintId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) { res.status(404).json({ error: { message: 'Sprint not found', statusCode: 404 } }); return; }
  if (sprint.status === 'completed') {
    res.status(422).json({ error: { message: 'Cannot edit a completed sprint', statusCode: 422 } }); return;
  }

  const { name, goal, startDate, endDate, status } = req.body as {
    name?: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  };

  const validStatuses = ['planned', 'active', 'completed'];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: { message: `status must be one of: ${validStatuses.join(', ')}`, statusCode: 400 } }); return;
  }

  // Only one active sprint per project
  if (status === 'active') {
    await prisma.sprint.updateMany({
      where: { projectId, status: 'active', id: { not: sprintId } },
      data: { status: 'planned' },
    });
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      ...(name && { name: name.trim() }),
      ...(goal !== undefined && { goal: goal?.trim() }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status && { status }),
    },
    include: { _count: { select: { issues: true } } },
  });

  res.json({ data: updated });
});

// ── POST /api/projects/:projectId/sprints/:sprintId/close ─────────────────────
// Close sprint: moves incomplete issues to backlog

router.post('/:sprintId/close', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const sprintId = parseInt(req.params['sprintId'], 10);
  if (isNaN(projectId) || isNaN(sprintId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) { res.status(404).json({ error: { message: 'Sprint not found', statusCode: 404 } }); return; }
  if (sprint.status === 'completed') {
    res.status(422).json({ error: { message: 'Sprint is already closed', statusCode: 422 } }); return;
  }

  // Move incomplete issues back to backlog (unassign from sprint)
  const incomplete = await prisma.issue.updateMany({
    where: {
      sprintId,
      status: { notIn: ['Done', 'Closed'] },
      archivedAt: null,
    },
    data: { sprintId: null, status: 'Backlog' },
  });

  await prisma.sprint.update({ where: { id: sprintId }, data: { status: 'completed' } });

  res.json({
    data: {
      sprint: { ...sprint, status: 'completed' },
      incompleteIssuesMoved: incomplete.count,
    },
  });
});

// ── GET /api/projects/:projectId/backlog ──────────────────────────────────────
// Issues not assigned to any sprint

router.get('/backlog/items', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(projectId)) { res.status(400).json({ error: { message: 'Invalid projectId', statusCode: 400 } }); return; }

  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { projectId, sprintId: null, archivedAt: null };
  if (req.query['type']) where['type'] = String(req.query['type']);
  if (req.query['priority']) where['priority'] = String(req.query['priority']);

  const [total, issues] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.findMany({
      where,
      orderBy: { issueNumber: 'asc' },
      skip,
      take: limit,
      select: {
        id: true, key: true, issueNumber: true, title: true,
        type: true, status: true, priority: true, estimate: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  res.json({ data: issues, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

// ── GET /api/projects/:projectId/sprints/:sprintId/board ──────────────────────
// Issues grouped by status for kanban board view

router.get('/:sprintId/board', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const sprintId = parseInt(req.params['sprintId'], 10);
  if (isNaN(projectId) || isNaN(sprintId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) { res.status(404).json({ error: { message: 'Sprint not found', statusCode: 404 } }); return; }

  const issues = await prisma.issue.findMany({
    where: { sprintId, archivedAt: null },
    orderBy: { issueNumber: 'asc' },
    select: {
      id: true, key: true, issueNumber: true, title: true,
      type: true, status: true, priority: true, estimate: true,
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const COLUMNS = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done', 'Closed'] as const;
  type BoardIssue = (typeof issues)[number];
  const board = Object.fromEntries(COLUMNS.map((col) => [col, issues.filter((i: BoardIssue) => i.status === col)]));

  res.json({ data: { sprint, board } });
});

// ── GET /api/projects/:projectId/sprints/:sprintId/velocity ──────────────────
// Story points completed vs committed for burndown/velocity data (AC5)

router.get('/:sprintId/velocity', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const sprintId = parseInt(req.params['sprintId'], 10);
  if (isNaN(projectId) || isNaN(sprintId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) { res.status(404).json({ error: { message: 'Sprint not found', statusCode: 404 } }); return; }

  const issues = await prisma.issue.findMany({
    where: { sprintId, archivedAt: null },
    select: { status: true, estimate: true },
  });

  type VelocityIssue = { status: string; estimate: number | null };
  const totalPoints = (issues as VelocityIssue[]).reduce((s: number, i: VelocityIssue) => s + (i.estimate ?? 0), 0);
  const completedPoints = (issues as VelocityIssue[])
    .filter((i: VelocityIssue) => i.status === 'Done' || i.status === 'Closed')
    .reduce((s: number, i: VelocityIssue) => s + (i.estimate ?? 0), 0);
  const inProgressPoints = (issues as VelocityIssue[])
    .filter((i: VelocityIssue) => i.status === 'In Progress' || i.status === 'In Review')
    .reduce((s: number, i: VelocityIssue) => s + (i.estimate ?? 0), 0);

  res.json({
    data: {
      sprintId,
      totalIssues: issues.length,
      totalPoints,
      completedPoints,
      inProgressPoints,
      remainingPoints: totalPoints - completedPoints,
      velocity: completedPoints,
    },
  });
});

// ── GET /api/projects/:projectId/sprints/:sprintId/burndown ───────────────────
// Burndown chart data: points remaining per day across the sprint (AC5)

router.get('/:sprintId/burndown', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const sprintId  = parseInt(req.params['sprintId'],  10);
  if (isNaN(projectId) || isNaN(sprintId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) {
    res.status(404).json({ error: { message: 'Sprint not found', statusCode: 404 } }); return;
  }

  // Burndown requires sprint dates to plot
  if (!sprint.startDate || !sprint.endDate) {
    res.status(422).json({
      error: { message: 'Sprint must have startDate and endDate for burndown data', statusCode: 422 },
    }); return;
  }

  // Committed total at sprint start
  const issues = await prisma.issue.findMany({
    where: { sprintId, archivedAt: null },
    select: { id: true, status: true, estimate: true, updatedAt: true },
  });

  type BurndownIssue = { id: number; status: string; estimate: number | null; updatedAt: Date };
  const totalPoints = (issues as BurndownIssue[]).reduce((s, i) => s + (i.estimate ?? 0), 0);

  // Build daily data points from startDate to today (or endDate, whichever is earlier)
  const start = new Date(sprint.startDate);
  const end   = new Date(Math.min(sprint.endDate.getTime(), Date.now()));

  const days: { date: string; pointsRemaining: number; pointsCompleted: number }[] = [];
  let cumCompleted = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    // Points completed up to end of this day
    const doneByDay = (issues as BurndownIssue[])
      .filter(
        (i) =>
          (i.status === 'Done' || i.status === 'Closed') &&
          i.updatedAt <= dayEnd,
      )
      .reduce((s, i) => s + (i.estimate ?? 0), 0);

    cumCompleted = doneByDay;

    days.push({
      date: new Date(d).toISOString().split('T')[0]!,
      pointsCompleted: cumCompleted,
      pointsRemaining: Math.max(0, totalPoints - cumCompleted),
    });
  }

  res.json({
    data: {
      sprintId,
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      totalPoints,
      idealBurndown: days.map((d, idx) => ({
        date: d.date,
        idealRemaining: Math.round(totalPoints * (1 - idx / Math.max(days.length - 1, 1))),
      })),
      actualBurndown: days,
    },
  });
});

export default router;
