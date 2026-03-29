/**
 * REQ-003 AC7 — Global search and filtering
 * Routes: GET /api/search?q=&type=&projectId=&status=&page=&limit=
 */
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/search
 * Query params:
 *   q          — full-text search across issue title, key, description, project name
 *   type       — filter by entity type: 'issue' | 'project' (default: both)
 *   projectId  — restrict issues to a project
 *   status     — issue status filter
 *   priority   — issue priority filter
 *   assigneeId — issue assignee filter
 *   page       — 1-based page number (default: 1)
 *   limit      — results per page (default: 20, max: 100)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const q = String(req.query['q'] ?? '').trim();
  const entityType = String(req.query['type'] ?? 'all');
  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
  const skip = (page - 1) * limit;

  if (!q) {
    res.status(400).json({ error: { message: 'q (search query) is required', statusCode: 400 } });
    return;
  }

  const results: {
    issues?: unknown[];
    projects?: unknown[];
    issueTotal?: number;
    projectTotal?: number;
  } = {};

  const searchMode = 'insensitive' as const;

  // ── Issue search ──────────────────────────────────────────────────────────
  if (entityType === 'all' || entityType === 'issue') {
    const issueWhere: Record<string, unknown> = {
      archivedAt: null,
      OR: [
        { title: { contains: q, mode: searchMode } },
        { key: { contains: q, mode: searchMode } },
        { description: { contains: q, mode: searchMode } },
      ],
    };
    if (req.query['projectId']) issueWhere['projectId'] = Number(req.query['projectId']);
    if (req.query['status']) issueWhere['status'] = String(req.query['status']);
    if (req.query['priority']) issueWhere['priority'] = String(req.query['priority']);
    if (req.query['assigneeId']) issueWhere['assigneeId'] = Number(req.query['assigneeId']);
    if (req.query['type'] && req.query['type'] !== 'issue') issueWhere['type'] = String(req.query['type']);

    const [issueTotal, issues] = await Promise.all([
      prisma.issue.count({ where: issueWhere }),
      prisma.issue.findMany({
        where: issueWhere,
        select: {
          id: true, key: true, title: true, type: true,
          status: true, priority: true, estimate: true, projectId: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
          project: { select: { id: true, key: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    results.issues = issues;
    results.issueTotal = issueTotal;
  }

  // ── Project search ────────────────────────────────────────────────────────
  if (entityType === 'all' || entityType === 'project') {
    const projectWhere: Record<string, unknown> = {
      archivedAt: null,
      OR: [
        { name: { contains: q, mode: searchMode } },
        { key: { contains: q, mode: searchMode } },
        { description: { contains: q, mode: searchMode } },
      ],
    };

    const [projectTotal, projects] = await Promise.all([
      prisma.project.count({ where: projectWhere }),
      prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true, key: true, name: true, description: true,
          status: true, workspaceId: true,
          _count: { select: { issues: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    results.projects = projects;
    results.projectTotal = projectTotal;
  }

  res.json({
    data: results,
    pagination: { page, limit },
  });
});

export default router;
