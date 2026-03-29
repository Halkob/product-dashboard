/**
 * REQ-003 AC6 — Standalone comment routes
 * Routes: PUT    /api/comments/:id  — edit own comment
 *         DELETE /api/comments/:id  — delete own comment (admin can delete any)
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CEO', 'CTO', 'COO'];

// ── PUT /api/comments/:id ─────────────────────────────────────────────────────

router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid comment id', statusCode: 400 } }); return;
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    res.status(404).json({ error: { message: 'Comment not found', statusCode: 404 } }); return;
  }

  // Only the author can edit
  if (comment.userId !== req.user!.userId) {
    res.status(403).json({ error: { message: 'Forbidden: only the author can edit a comment', statusCode: 403 } }); return;
  }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: { message: 'content is required', statusCode: 400 } }); return;
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { content: content.trim() },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  res.json({ data: updated });
});

// ── DELETE /api/comments/:id ──────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'], 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid comment id', statusCode: 400 } }); return;
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    res.status(404).json({ error: { message: 'Comment not found', statusCode: 404 } }); return;
  }

  const isAdmin = ADMIN_ROLES.includes(req.user!.role);
  if (comment.userId !== req.user!.userId && !isAdmin) {
    res.status(403).json({ error: { message: 'Forbidden', statusCode: 403 } }); return;
  }

  await prisma.comment.delete({ where: { id } });
  res.status(204).send();
});

export default router;
