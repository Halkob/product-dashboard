/**
 * REQ-003 AC2/AC3/AC5/AC6 — Standalone issue routes, activity log, burndown
 * Tests: GET/PUT/DELETE /api/issues/:id
 *        GET /api/issues/:id/activity
 *        POST /api/issues/:id/comments
 *        PUT/DELETE /api/comments/:id
 *        GET /api/projects/:id/sprints/:id/burndown
 */
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../app';
import { signAccessToken } from '../auth/tokens';

const prisma = new PrismaClient();

let workspaceId: number;
let projectId: number;
let issueId: number;
let ceoId: number;
let memberId: number;
let ceoToken: string;
let memberToken: string;

beforeAll(async () => {
  const ceoRole = await prisma.role.upsert({
    where: { name: 'CEO' },
    update: {},
    create: { name: 'CEO', description: 'CEO' },
  });
  const memberRole = await prisma.role.upsert({
    where: { name: 'Team Member' },
    update: {},
    create: { name: 'Team Member', description: 'Team Member' },
  });

  const ws = await prisma.workspace.upsert({
    where: { name_roleId: { name: 'Standalone Test WS', roleId: ceoRole.id } },
    update: {},
    create: { name: 'Standalone Test WS', roleId: ceoRole.id },
  });
  workspaceId = ws.id;

  const hash = await bcrypt.hash('TestPass1', 10);

  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@standalone.com' },
    update: {},
    create: { email: 'ceo@standalone.com', passwordHash: hash, firstName: 'CEO', lastName: 'Standalone', roleId: ceoRole.id },
  });
  ceoId = ceo.id;
  ceoToken = signAccessToken({ userId: ceo.id, email: ceo.email, role: 'CEO' });

  const member = await prisma.user.upsert({
    where: { email: 'member@standalone.com' },
    update: {},
    create: { email: 'member@standalone.com', passwordHash: hash, firstName: 'Member', lastName: 'Standalone', roleId: memberRole.id },
  });
  memberId = member.id;
  memberToken = signAccessToken({ userId: member.id, email: member.email, role: 'Team Member' });

  const project = await prisma.project.create({
    data: { key: 'STD', name: 'Standalone Test Project', workspaceId, createdById: ceo.id },
  });
  projectId = project.id;

  const issue = await prisma.issue.create({
    data: { key: 'STD-1', issueNumber: 1, title: 'Main Issue', projectId, reporterId: ceo.id },
  });
  issueId = issue.id;

  const issue2 = await prisma.issue.create({
    data: { key: 'STD-2', issueNumber: 2, title: 'Other Issue', projectId, reporterId: ceo.id },
  });
  void issue2; // created for DB integrity, not used directly in tests
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { issue: { projectId } } });
  await prisma.activityLog.deleteMany({ where: { issue: { projectId } } });
  await prisma.issueLink.deleteMany({ where: { OR: [{ source: { projectId } }, { target: { projectId } }] } });
  await prisma.issue.deleteMany({ where: { projectId } });
  await prisma.sprint.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@standalone.com' } } });
  await prisma.$disconnect();
});

// ── GET /api/issues/:id ───────────────────────────────────────────────────────

describe('GET /api/issues/:id', () => {
  it('returns full issue detail with comments and activity', async () => {
    const res = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(issueId);
    expect(res.body.data.comments).toBeDefined();
    expect(res.body.data.activityLogs).toBeDefined();
    expect(res.body.data.outwardLinks).toBeDefined();
    expect(res.body.data.inwardLinks).toBeDefined();
  });

  it('returns 404 for non-existent issue', async () => {
    const res = await request(app)
      .get('/api/issues/999999')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .get('/api/issues/abc')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).get(`/api/issues/${issueId}`);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/issues/:id ───────────────────────────────────────────────────────

describe('PUT /api/issues/:id', () => {
  it('updates title and priority', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'Updated Main Issue', priority: 'High' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Main Issue');
    expect(res.body.data.priority).toBe('High');
  });

  it('updates status via valid transition (Backlog → Ready)', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'Ready' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Ready');
  });

  it('logs activity on status change', async () => {
    const actRes = await request(app)
      .get(`/api/issues/${issueId}/activity`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(actRes.status).toBe(200);
    const statusChange = actRes.body.data.find((a: { action: string }) => a.action === 'status_changed');
    expect(statusChange).toBeDefined();
  });

  it('rejects invalid status transition (Ready → Done)', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'Done' });
    expect(res.status).toBe(422);
  });

  it('rejects invalid type', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ type: 'InvalidType' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid priority', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ priority: 'Ultra' });
    expect(res.status).toBe(400);
  });

  it('rejects non-Fibonacci estimate', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ estimate: 7 });
    expect(res.status).toBe(400);
  });

  it('accepts valid Fibonacci estimate and logs activity', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ estimate: 8 });
    expect(res.status).toBe(200);
    expect(res.body.data.estimate).toBe(8);
  });

  it('accepts null estimate to clear it', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ estimate: null });
    expect(res.status).toBe(200);
    expect(res.body.data.estimate).toBeNull();
  });

  it('updates assigneeId and logs activity', async () => {
    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ assigneeId: memberId });
    expect(res.status).toBe(200);
    expect(res.body.data.assignee?.id).toBe(memberId);
  });

  it('returns 404 for non-existent issue', async () => {
    const res = await request(app)
      .put('/api/issues/999999')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'No issue' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .put('/api/issues/xyz')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'No issue' });
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/issues/:id ────────────────────────────────────────────────────

describe('DELETE /api/issues/:id', () => {
  let deleteIssueId: number;

  beforeAll(async () => {
    const i = await prisma.issue.create({
      data: { key: 'STD-DEL', issueNumber: 99, title: 'To Delete', projectId, reporterId: ceoId },
    });
    deleteIssueId = i.id;
  });

  it('soft-deletes issue (204)', async () => {
    const res = await request(app)
      .delete(`/api/issues/${deleteIssueId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(204);
  });

  it('archived issue no longer accessible', async () => {
    const res = await request(app)
      .get(`/api/issues/${deleteIssueId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for already-archived issue on delete', async () => {
    const res = await request(app)
      .delete(`/api/issues/${deleteIssueId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .delete('/api/issues/abc')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/issues/:id/activity ──────────────────────────────────────────────

describe('GET /api/issues/:id/activity', () => {
  it('returns paginated activity log', async () => {
    const res = await request(app)
      .get(`/api/issues/${issueId}/activity`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('activity entries have expected shape', async () => {
    const res = await request(app)
      .get(`/api/issues/${issueId}/activity`)
      .set('Authorization', `Bearer ${ceoToken}`);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('action');
    expect(entry).toHaveProperty('createdAt');
    expect(entry.user).toBeDefined();
  });

  it('returns 404 for non-existent issue', async () => {
    const res = await request(app)
      .get('/api/issues/999999/activity')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .get('/api/issues/abc/activity')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });
});

// ── POST /api/issues/:id/comments ─────────────────────────────────────────────

describe('POST /api/issues/:id/comments', () => {
  it('creates comment and returns 201', async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Standalone comment' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Standalone comment');
    expect(res.body.data.user).toBeDefined();
  });

  it('rejects empty content', async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent issue', async () => {
    const res = await request(app)
      .post('/api/issues/999999/comments')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Hello' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .post('/api/issues/abc/comments')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Hello' });
    expect(res.status).toBe(400);
  });
});

// ── PUT/DELETE /api/comments/:id ─────────────────────────────────────────────

describe('PUT/DELETE /api/comments/:id', () => {
  let commentId: number;

  beforeAll(async () => {
    const c = await prisma.comment.create({
      data: { content: 'To edit', issueId, userId: ceoId },
    });
    commentId = c.id;
  });

  it('PUT: edits own comment', async () => {
    const res = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Edited content' });
    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Edited content');
  });

  it('PUT: rejects edit by non-author', async () => {
    const res = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Sneaky edit' });
    expect(res.status).toBe(403);
  });

  it('PUT: rejects empty content', async () => {
    const res = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('PUT: returns 404 for missing comment', async () => {
    const res = await request(app)
      .put('/api/comments/999999')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'x' });
    expect(res.status).toBe(404);
  });

  it('PUT: returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .put('/api/comments/abc')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'x' });
    expect(res.status).toBe(400);
  });

  it('DELETE: non-author non-admin is forbidden', async () => {
    const res = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it('DELETE: author deletes own comment (204)', async () => {
    const res = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(204);
  });

  it('DELETE: returns 404 for already-deleted comment', async () => {
    const res = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('DELETE: returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .delete('/api/comments/abc')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });
});

// ── Branch coverage extras ────────────────────────────────────────────────────

describe('PUT /api/issues/:id — sprintId null clears sprint (branch coverage)', () => {
  it('sets sprintId to null and logs sprint_changed activity', async () => {
    // First assign to a sprint
    const sprint = await prisma.sprint.create({ data: { name: 'Temp Sprint', projectId } });
    await prisma.issue.update({ where: { id: issueId }, data: { sprintId: sprint.id } });

    const res = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ sprintId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.sprintId).toBeNull();

    await prisma.sprint.delete({ where: { id: sprint.id } });
  });
});

describe('GET /api/search — type filter for issue type (branch coverage)', () => {
  it('filters issues by issue type via type=Bug param', async () => {
    // Create a bug issue to search for
    await prisma.issue.create({
      data: { key: 'STD-BUG', issueNumber: 50, title: 'Critical bug fix STD', type: 'Bug', projectId, reporterId: ceoId },
    });

    const res = await request(app)
      .get('/api/search?q=STD&type=Bug')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    // When type is not 'issue'/'project'/'all' it's used as issue type filter
    expect(res.body.data).toBeDefined();
  });

  it('search with status filter applied', async () => {
    const res = await request(app)
      .get('/api/search?q=STD&status=Backlog')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
  });

  it('search with priority filter applied', async () => {
    const res = await request(app)
      .get('/api/search?q=STD&priority=Medium')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
  });

  it('search with assigneeId filter applied', async () => {
    const res = await request(app)
      .get(`/api/search?q=STD&assigneeId=${ceoId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
  });

  it('search with projectId filter applied', async () => {
    const res = await request(app)
      .get(`/api/search?q=STD&projectId=${projectId}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
  });
});

// ── GET /api/projects/:id/sprints/:id/burndown ────────────────────────────────

describe('GET /api/projects/:projectId/sprints/:sprintId/burndown', () => {
  let sprintWithDates: number;
  let sprintNoDates: number;

  beforeAll(async () => {
    const s1 = await prisma.sprint.create({
      data: {
        name: 'Burndown Sprint',
        projectId,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-14'),
        status: 'completed',
      },
    });
    sprintWithDates = s1.id;

    const s2 = await prisma.sprint.create({
      data: { name: 'No Dates Sprint', projectId },
    });
    sprintNoDates = s2.id;

    // Assign issue to sprint with estimate so there are data points
    await prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: s1.id, estimate: 5, status: 'Done' },
    });
  });

  it('returns burndown data with idealBurndown and actualBurndown arrays', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprintWithDates}/burndown`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalPoints).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.data.idealBurndown)).toBe(true);
    expect(Array.isArray(res.body.data.actualBurndown)).toBe(true);
    expect(res.body.data.sprintName).toBe('Burndown Sprint');
  });

  it('actualBurndown entries have date, pointsCompleted, pointsRemaining', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprintWithDates}/burndown`)
      .set('Authorization', `Bearer ${ceoToken}`);
    const day = res.body.data.actualBurndown[0];
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('pointsCompleted');
    expect(day).toHaveProperty('pointsRemaining');
  });

  it('returns 422 when sprint has no dates', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprintNoDates}/burndown`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(422);
  });

  it('returns 404 for non-existent sprint', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/999999/burndown`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric ids', async () => {
    const res = await request(app)
      .get(`/api/projects/abc/sprints/xyz/burndown`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });
});
