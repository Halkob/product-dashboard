/**
 * REQ-003 AC2/AC3/AC5 — Issue CRUD, status workflow, assignment, story points
 * Routes: POST/GET /api/projects/:projectId/issues
 *         GET/PUT/DELETE /api/projects/:projectId/issues/:issueId
 *         POST /api/projects/:projectId/issues/:issueId/links
 *         DELETE /api/projects/:projectId/issues/:issueId/links/:linkId
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// ── Constants ────────────────────────────────────────────────────────────────

export const ISSUE_TYPES = ['Epic', 'Story', 'Task', 'Bug'] as const;
export const ISSUE_STATUSES = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done', 'Closed'] as const;
export const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21] as const;
export const LINK_TYPES = ['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by'] as const;

// Valid status transitions (AC3)
const STATUS_TRANSITIONS: Record<string, string[]> = {
  Backlog:     ['Ready'],
  Ready:       ['In Progress', 'Backlog'],
  'In Progress': ['In Review', 'Ready'],
  'In Review': ['Done', 'In Progress'],
  Done:        ['Closed', 'In Progress'],
  Closed:      [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function issueSelect() {
  return {
    id: true,
    key: true,
    issueNumber: true,
    title: true,
    description: true,
    type: true,
    status: true,
    priority: true,
    estimate: true,
    projectId: true,
    sprintId: true,
    parentId: true,
    dueDate: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
    reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
    parent: { select: { id: true, key: true, title: true, type: true } },
    _count: { select: { children: true, comments: true } },
  } as const;
}

async function getProjectOrFail(projectId: number, res: Response): Promise<{ id: number; key: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    res.status(404).json({ error: { message: 'Project not found', statusCode: 404 } });
    return null;
  }
  return project;
}

async function nextIssueNumber(projectId: number): Promise<number> {
  const last = await prisma.issue.findFirst({
    where: { projectId },
    orderBy: { issueNumber: 'desc' },
    select: { issueNumber: true },
  });
  return (last?.issueNumber ?? 0) + 1;
}

async function logActivity(
  issueId: number,
  userId: number,
  action: string,
  field?: string,
  oldValue?: string,
  newValue?: string,
): Promise<void> {
  await prisma.activityLog.create({
    data: { issueId, userId, action, field, oldValue, newValue },
  });
}

// ── POST /api/projects/:projectId/issues ─────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(projectId)) { res.status(400).json({ error: { message: 'Invalid projectId', statusCode: 400 } }); return; }

  const project = await getProjectOrFail(projectId, res);
  if (!project) return;

  const { title, description, type, priority, estimate, sprintId, parentId, assigneeId, dueDate } = req.body as {
    title?: string;
    description?: string;
    type?: string;
    priority?: string;
    estimate?: number;
    sprintId?: number;
    parentId?: number;
    assigneeId?: number;
    dueDate?: string;
  };

  if (!title) {
    res.status(400).json({ error: { message: 'title is required', statusCode: 400 } });
    return;
  }

  if (type && !(ISSUE_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: { message: `type must be one of: ${ISSUE_TYPES.join(', ')}`, statusCode: 400 } });
    return;
  }
  if (priority && !(ISSUE_PRIORITIES as readonly string[]).includes(priority)) {
    res.status(400).json({ error: { message: `priority must be one of: ${ISSUE_PRIORITIES.join(', ')}`, statusCode: 400 } });
    return;
  }
  if (estimate !== undefined && !(FIBONACCI as readonly number[]).includes(estimate)) {
    res.status(400).json({ error: { message: `estimate must be a Fibonacci number: ${FIBONACCI.join(', ')}`, statusCode: 400 } });
    return;
  }

  const issueNumber = await nextIssueNumber(projectId);
  const key = `${project.key}-${issueNumber}`;

  const issue = await prisma.issue.create({
    data: {
      key,
      issueNumber,
      title: title.trim(),
      description: description?.trim(),
      type: type ?? 'Task',
      priority: priority ?? 'Medium',
      estimate: estimate ?? null,
      projectId,
      sprintId: sprintId ? Number(sprintId) : null,
      parentId: parentId ? Number(parentId) : null,
      assigneeId: assigneeId ? Number(assigneeId) : null,
      reporterId: req.user!.userId,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    select: issueSelect(),
  });

  await logActivity(issue.id, req.user!.userId, 'created');

  res.status(201).json({ data: issue });
});

// ── GET /api/projects/:projectId/issues ──────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(projectId)) { res.status(400).json({ error: { message: 'Invalid projectId', statusCode: 400 } }); return; }

  const project = await getProjectOrFail(projectId, res);
  if (!project) return;

  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { projectId, archivedAt: null };
  if (req.query['type']) where['type'] = String(req.query['type']);
  if (req.query['status']) where['status'] = String(req.query['status']);
  if (req.query['priority']) where['priority'] = String(req.query['priority']);
  if (req.query['assigneeId']) where['assigneeId'] = Number(req.query['assigneeId']);
  if (req.query['sprintId']) {
    where['sprintId'] = req.query['sprintId'] === 'null' ? null : Number(req.query['sprintId']);
  }
  if (req.query['parentId']) {
    where['parentId'] = req.query['parentId'] === 'null' ? null : Number(req.query['parentId']);
  }
  if (req.query['search']) {
    where['OR'] = [
      { title: { contains: String(req.query['search']), mode: 'insensitive' } },
      { key: { contains: String(req.query['search']), mode: 'insensitive' } },
    ];
  }

  const [total, issues] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.findMany({
      where,
      select: issueSelect(),
      orderBy: { issueNumber: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: issues,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /api/projects/:projectId/issues/:issueId ─────────────────────────────

router.get('/:issueId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const issueId = parseInt(req.params['issueId'], 10);
  if (isNaN(projectId) || isNaN(issueId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, projectId, archivedAt: null },
    select: {
      ...issueSelect(),
      outwardLinks: {
        include: { target: { select: { id: true, key: true, title: true, status: true } } },
      },
      inwardLinks: {
        include: { source: { select: { id: true, key: true, title: true, status: true } } },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!issue) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } });
    return;
  }
  res.json({ data: issue });
});

// ── PUT /api/projects/:projectId/issues/:issueId ─────────────────────────────

router.put('/:issueId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const issueId = parseInt(req.params['issueId'], 10);
  if (isNaN(projectId) || isNaN(issueId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const current = await prisma.issue.findFirst({ where: { id: issueId, projectId, archivedAt: null } });
  if (!current) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } });
    return;
  }

  const { title, description, type, status, priority, estimate, sprintId, parentId, assigneeId, dueDate } =
    req.body as {
      title?: string;
      description?: string;
      type?: string;
      status?: string;
      priority?: string;
      estimate?: number | null;
      sprintId?: number | null;
      parentId?: number | null;
      assigneeId?: number | null;
      dueDate?: string | null;
    };

  // Validate status transition
  if (status && status !== current.status) {
    const allowed = STATUS_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      res.status(422).json({
        error: {
          message: `Invalid status transition from '${current.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
          statusCode: 422,
        },
      });
      return;
    }
  }

  if (type && !(ISSUE_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: { message: `type must be one of: ${ISSUE_TYPES.join(', ')}`, statusCode: 400 } });
    return;
  }
  if (priority && !(ISSUE_PRIORITIES as readonly string[]).includes(priority)) {
    res.status(400).json({ error: { message: `priority must be one of: ${ISSUE_PRIORITIES.join(', ')}`, statusCode: 400 } });
    return;
  }
  if (estimate !== undefined && estimate !== null && !(FIBONACCI as readonly number[]).includes(estimate)) {
    res.status(400).json({ error: { message: `estimate must be a Fibonacci number: ${FIBONACCI.join(', ')}`, statusCode: 400 } });
    return;
  }

  // Track changes for activity log
  const changes: Array<{ action: string; field: string; oldValue: string; newValue: string }> = [];
  if (status && status !== current.status) {
    changes.push({ action: 'status_changed', field: 'status', oldValue: current.status, newValue: status });
  }
  if (assigneeId !== undefined && assigneeId !== current.assigneeId) {
    changes.push({
      action: 'assigned',
      field: 'assigneeId',
      oldValue: String(current.assigneeId ?? ''),
      newValue: String(assigneeId ?? ''),
    });
  }
  if (sprintId !== undefined && sprintId !== current.sprintId) {
    changes.push({
      action: 'sprint_changed',
      field: 'sprintId',
      oldValue: String(current.sprintId ?? ''),
      newValue: String(sprintId ?? ''),
    });
  }
  if (estimate !== undefined && estimate !== current.estimate) {
    changes.push({
      action: 'estimate_changed',
      field: 'estimate',
      oldValue: String(current.estimate ?? ''),
      newValue: String(estimate ?? ''),
    });
  }

  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: {
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(type && { type }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(estimate !== undefined && { estimate }),
      ...(sprintId !== undefined && { sprintId }),
      ...(parentId !== undefined && { parentId }),
      ...(assigneeId !== undefined && { assigneeId }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    select: issueSelect(),
  });

  // Write activity logs
  await Promise.all(
    changes.map((c) => logActivity(issueId, req.user!.userId, c.action, c.field, c.oldValue, c.newValue)),
  );

  res.json({ data: updated });
});

// ── DELETE /api/projects/:projectId/issues/:issueId (soft delete) ─────────────

router.delete('/:issueId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const issueId = parseInt(req.params['issueId'], 10);
  if (isNaN(projectId) || isNaN(issueId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({ where: { id: issueId, projectId, archivedAt: null } });
  if (!issue) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } });
    return;
  }

  await prisma.issue.update({ where: { id: issueId }, data: { archivedAt: new Date() } });
  await logActivity(issueId, req.user!.userId, 'archived');
  res.status(204).send();
});

// ── POST /api/projects/:projectId/issues/:issueId/links ──────────────────────

router.post('/:issueId/links', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const projectId = parseInt(req.params['projectId'], 10);
  const issueId = parseInt(req.params['issueId'], 10);
  if (isNaN(projectId) || isNaN(issueId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const { targetId, linkType } = req.body as { targetId?: number; linkType?: string };

  if (!targetId || !linkType) {
    res.status(400).json({ error: { message: 'targetId and linkType are required', statusCode: 400 } });
    return;
  }
  if (!(LINK_TYPES as readonly string[]).includes(linkType)) {
    res.status(400).json({ error: { message: `linkType must be one of: ${LINK_TYPES.join(', ')}`, statusCode: 400 } });
    return;
  }
  if (issueId === Number(targetId)) {
    res.status(400).json({ error: { message: 'Cannot link an issue to itself', statusCode: 400 } });
    return;
  }

  const link = await prisma.issueLink.create({
    data: { sourceId: issueId, targetId: Number(targetId), linkType },
  });

  await logActivity(issueId, req.user!.userId, 'link_added', 'linkType', undefined, `${linkType}:${targetId}`);
  res.status(201).json({ data: link });
});

// ── DELETE /api/projects/:projectId/issues/:issueId/links/:linkId ────────────

router.delete('/:issueId/links/:linkId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const linkId = parseInt(req.params['linkId'], 10);
  if (isNaN(linkId)) { res.status(400).json({ error: { message: 'Invalid linkId', statusCode: 400 } }); return; }

  const link = await prisma.issueLink.findUnique({ where: { id: linkId } });
  if (!link) { res.status(404).json({ error: { message: 'Link not found', statusCode: 404 } }); return; }

  await prisma.issueLink.delete({ where: { id: linkId } });
  res.status(204).send();
});

export default router;
