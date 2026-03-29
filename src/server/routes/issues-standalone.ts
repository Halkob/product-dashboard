/**
 * REQ-003 AC2/AC3/AC5/AC6 — Standalone issue routes (non-project-nested)
 * Routes: GET    /api/issues/:id          — get issue details with comments + history
 *         PUT    /api/issues/:id          — update issue
 *         DELETE /api/issues/:id          — archive issue (soft delete)
 *         POST   /api/issues/:id/comments — add comment
 *         PUT    /api/comments/:id        — edit own comment  (via /api/comments router)
 *         DELETE /api/comments/:id        — delete own comment (via /api/comments router)
 *         GET    /api/issues/:id/activity — get activity log
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ISSUE_TYPES, ISSUE_PRIORITIES, FIBONACCI } from './issues';

const router = Router();
const prisma = new PrismaClient();

const STATUS_TRANSITIONS: Record<string, string[]> = {
  Backlog:       ['Ready'],
  Ready:         ['In Progress', 'Backlog'],
  'In Progress': ['In Review', 'Ready'],
  'In Review':   ['Done', 'In Progress'],
  Done:          ['Closed', 'In Progress'],
  Closed:        [],
};

function issueDetailSelect() {
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
    voiceCreated: true,
    voiceTranscript: true,
    assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
    reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
    parent:   { select: { id: true, key: true, title: true, type: true } },
    children: { select: { id: true, key: true, title: true, type: true, status: true } },
    comments: {
      orderBy: { createdAt: 'asc' as const },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    },
    outwardLinks: {
      include: { target: { select: { id: true, key: true, title: true, status: true } } },
    },
    inwardLinks: {
      include: { source: { select: { id: true, key: true, title: true, status: true } } },
    },
    activityLogs: {
      orderBy: { createdAt: 'desc' as const },
      take: 50,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    },
    _count: { select: { children: true, comments: true } },
  } as const;
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

// ── GET /api/issues/:id ───────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid issue id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({
    where: { id, archivedAt: null },
    select: issueDetailSelect(),
  });

  if (!issue) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return;
  }

  res.json({ data: issue });
});

// ── PUT /api/issues/:id ───────────────────────────────────────────────────────

router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid issue id', statusCode: 400 } }); return;
  }

  const current = await prisma.issue.findFirst({ where: { id, archivedAt: null } });
  if (!current) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return;
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
    res.status(400).json({ error: { message: `type must be one of: ${ISSUE_TYPES.join(', ')}`, statusCode: 400 } }); return;
  }
  if (priority && !(ISSUE_PRIORITIES as readonly string[]).includes(priority)) {
    res.status(400).json({ error: { message: `priority must be one of: ${ISSUE_PRIORITIES.join(', ')}`, statusCode: 400 } }); return;
  }
  if (estimate !== undefined && estimate !== null && !(FIBONACCI as readonly number[]).includes(estimate)) {
    res.status(400).json({ error: { message: `estimate must be a Fibonacci number: ${FIBONACCI.join(', ')}`, statusCode: 400 } }); return;
  }

  // Track changes for activity log
  const changes: Array<{ action: string; field: string; oldValue: string; newValue: string }> = [];
  if (status && status !== current.status) {
    changes.push({ action: 'status_changed', field: 'status', oldValue: current.status, newValue: status });
  }
  if (assigneeId !== undefined && assigneeId !== current.assigneeId) {
    changes.push({ action: 'assigned', field: 'assigneeId', oldValue: String(current.assigneeId ?? ''), newValue: String(assigneeId ?? '') });
  }
  if (sprintId !== undefined && sprintId !== current.sprintId) {
    changes.push({ action: 'sprint_changed', field: 'sprintId', oldValue: String(current.sprintId ?? ''), newValue: String(sprintId ?? '') });
  }
  if (estimate !== undefined && estimate !== current.estimate) {
    changes.push({ action: 'estimate_changed', field: 'estimate', oldValue: String(current.estimate ?? ''), newValue: String(estimate ?? '') });
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: {
      ...(title       && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(type        && { type }),
      ...(status      && { status }),
      ...(priority    && { priority }),
      ...(estimate    !== undefined && { estimate }),
      ...(sprintId    !== undefined && { sprintId }),
      ...(parentId    !== undefined && { parentId }),
      ...(assigneeId  !== undefined && { assigneeId }),
      ...(dueDate     !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    select: issueDetailSelect(),
  });

  await Promise.all(changes.map((c) => logActivity(id, req.user!.userId, c.action, c.field, c.oldValue, c.newValue)));

  res.json({ data: updated });
});

// ── DELETE /api/issues/:id ────────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid issue id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({ where: { id, archivedAt: null } });
  if (!issue) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return;
  }

  await prisma.issue.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity(id, req.user!.userId, 'archived');
  res.status(204).send();
});

// ── GET /api/issues/:id/activity ──────────────────────────────────────────────

router.get('/:id/activity', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid issue id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({ where: { id, archivedAt: null }, select: { id: true } });
  if (!issue) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return;
  }

  const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10)));
  const skip  = (page - 1) * limit;

  const [total, activity] = await Promise.all([
    prisma.activityLog.count({ where: { issueId: id } }),
    prisma.activityLog.findMany({
      where: { issueId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);

  res.json({ data: activity, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

// ── POST /api/issues/:id/comments ─────────────────────────────────────────────

router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid issue id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({ where: { id, archivedAt: null } });
  if (!issue) {
    res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return;
  }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: { message: 'content is required', statusCode: 400 } }); return;
  }

  const comment = await prisma.comment.create({
    data: { content: content.trim(), issueId: id, userId: req.user!.userId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  await logActivity(id, req.user!.userId, 'comment_added', undefined, undefined, String(comment.id));

  res.status(201).json({ data: comment });
});

export default router;
