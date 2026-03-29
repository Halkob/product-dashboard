/**
 * REQ-003 AC6 — Comments on issues
 * Routes: POST/GET /api/projects/:projectId/issues/:issueId/comments
 *         PUT/DELETE /api/projects/:projectId/issues/:issueId/comments/:commentId
 *         GET /api/projects/:projectId/issues/:issueId/activity
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// ── POST /api/projects/:projectId/issues/:issueId/comments ───────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const issueId = parseInt(req.params['issueId'], 10);
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(issueId) || isNaN(projectId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({ where: { id: issueId, projectId, archivedAt: null } });
  if (!issue) { res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return; }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: { message: 'content is required', statusCode: 400 } }); return;
  }

  const comment = await prisma.comment.create({
    data: { content: content.trim(), issueId, userId: req.user!.userId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  // Activity log
  await prisma.activityLog.create({
    data: { issueId, userId: req.user!.userId, action: 'comment_added', newValue: String(comment.id) },
  });

  res.status(201).json({ data: comment });
});

// ── GET /api/projects/:projectId/issues/:issueId/comments ────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const issueId = parseInt(req.params['issueId'], 10);
  const projectId = parseInt(req.params['projectId'], 10);
  if (isNaN(issueId) || isNaN(projectId)) {
    res.status(400).json({ error: { message: 'Invalid id', statusCode: 400 } }); return;
  }

  const issue = await prisma.issue.findFirst({ where: { id: issueId, projectId, archivedAt: null } });
  if (!issue) { res.status(404).json({ error: { message: 'Issue not found', statusCode: 404 } }); return; }

  const comments = await prisma.comment.findMany({
    where: { issueId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  res.json({ data: comments });
});

// ── PUT /api/projects/:projectId/issues/:issueId/comments/:commentId ──────────

router.put('/:commentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const commentId = parseInt(req.params['commentId'], 10);
  if (isNaN(commentId)) { res.status(400).json({ error: { message: 'Invalid commentId', statusCode: 400 } }); return; }

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) { res.status(404).json({ error: { message: 'Comment not found', statusCode: 404 } }); return; }

  // Only the author can edit
  if (comment.userId !== req.user!.userId) {
    res.status(403).json({ error: { message: 'Forbidden', statusCode: 403 } }); return;
  }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: { message: 'content is required', statusCode: 400 } }); return;
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content: content.trim() },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  res.json({ data: updated });
});

// ── DELETE /api/projects/:projectId/issues/:issueId/comments/:commentId ───────

router.delete('/:commentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const commentId = parseInt(req.params['commentId'], 10);
  if (isNaN(commentId)) { res.status(400).json({ error: { message: 'Invalid commentId', statusCode: 400 } }); return; }

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) { res.status(404).json({ error: { message: 'Comment not found', statusCode: 404 } }); return; }

  const adminRoles = ['CEO', 'CTO', 'COO'];
  if (comment.userId !== req.user!.userId && !adminRoles.includes(req.user!.role)) {
    res.status(403).json({ error: { message: 'Forbidden', statusCode: 403 } }); return;
  }

  await prisma.comment.delete({ where: { id: commentId } });
  res.status(204).send();
});

export default router;
