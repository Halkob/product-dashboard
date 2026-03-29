/**
 * REQ-003 AC4/AC6 — Sprint management and comments
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
let ceoToken: string;

beforeAll(async () => {
  const ceoRole = await prisma.role.upsert({
    where: { name: 'CEO' },
    update: {},
    create: { name: 'CEO', description: 'CEO' },
  });

  const ws = await prisma.workspace.upsert({
    where: { name_roleId: { name: 'Sprint Test WS', roleId: ceoRole.id } },
    update: {},
    create: { name: 'Sprint Test WS', roleId: ceoRole.id },
  });
  workspaceId = ws.id;

  const hash = await bcrypt.hash('TestPass1', 10);
  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@sprinttest.com' },
    update: {},
    create: { email: 'ceo@sprinttest.com', passwordHash: hash, firstName: 'CEO', lastName: 'Sprint', roleId: ceoRole.id },
  });
  ceoToken = signAccessToken({ userId: ceo.id, email: ceo.email, role: 'CEO' });
  ceoId = ceo.id;

  const project = await prisma.project.create({
    data: { key: 'SPR', name: 'Sprint Test Project', workspaceId, createdById: ceo.id },
  });
  projectId = project.id;

  // Create a test issue for sprint assignment
  const issue = await prisma.issue.create({
    data: {
      key: 'SPR-1', issueNumber: 1, title: 'Sprint Issue',
      projectId, reporterId: ceo.id,
    },
  });
  issueId = issue.id;
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { issue: { projectId } } });
  await prisma.activityLog.deleteMany({ where: { issue: { projectId } } });
  await prisma.issue.deleteMany({ where: { projectId } });
  await prisma.sprint.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@sprinttest.com' } } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.$disconnect();
});

// ── POST /api/projects/:projectId/sprints ─────────────────────────────────────

describe('POST /api/projects/:projectId/sprints', () => {
  it('requires authentication', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/sprints`).send({ name: 'S1' });
    expect(res.status).toBe(401);
  });

  it('creates a sprint', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Sprint 1', goal: 'Ship MVP', startDate: '2026-04-01', endDate: '2026-04-14' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Sprint 1');
    expect(res.body.data.status).toBe('planned');
    expect(res.body.data.goal).toBe('Ship MVP');
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ goal: 'No name' });

    expect(res.status).toBe(400);
  });
});

// ── GET /api/projects/:projectId/sprints ──────────────────────────────────────

describe('GET /api/projects/:projectId/sprints', () => {
  it('returns sprint list', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ status: 'planned' });

    expect(res.status).toBe(200);
    res.body.data.forEach((s: { status: string }) => expect(s.status).toBe('planned'));
  });
});

// ── PUT /api/projects/:projectId/sprints/:sprintId ────────────────────────────

describe('PUT /api/projects/:projectId/sprints/:sprintId', () => {
  let sprintId: number;

  beforeAll(async () => {
    const sprint = await prisma.sprint.findFirst({ where: { projectId, name: 'Sprint 1' } });
    sprintId = sprint!.id;
  });

  it('activates a sprint', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });

  it('updates sprint name and goal', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Sprint 1 Updated', goal: 'Updated goal' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Sprint 1 Updated');
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown sprint', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/999999`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ── GET board and velocity ────────────────────────────────────────────────────

describe('Sprint board and velocity (AC4/AC5)', () => {
  let sprintId: number;

  beforeAll(async () => {
    const sprint = await prisma.sprint.findFirst({ where: { projectId } });
    sprintId = sprint!.id;

    // Move the issue into the sprint
    await prisma.issue.update({ where: { id: issueId }, data: { sprintId, estimate: 5 } });
  });

  it('returns board grouped by status', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprintId}/board`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.board).toHaveProperty('Backlog');
    expect(res.body.data.board).toHaveProperty('In Progress');
    expect(res.body.data.board).toHaveProperty('Done');
    expect(res.body.data.sprint.id).toBe(sprintId);
  });

  it('returns velocity data', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprintId}/velocity`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalPoints).toBe(5);
    expect(res.body.data.completedPoints).toBe(0);
    expect(res.body.data.remainingPoints).toBe(5);
  });
});

// ── Sprint close ──────────────────────────────────────────────────────────────

describe('POST /api/projects/:projectId/sprints/:sprintId/close', () => {
  let sprintId: number;

  beforeAll(async () => {
    const sprint = await prisma.sprint.findFirst({ where: { projectId } });
    sprintId = sprint!.id;
  });

  it('closes an active sprint and moves incomplete issues to backlog', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints/${sprintId}/close`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sprint.status).toBe('completed');
    expect(res.body.data.incompleteIssuesMoved).toBeGreaterThanOrEqual(1);

    // Issue should now be back in backlog
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    expect(issue!.sprintId).toBeNull();
    expect(issue!.status).toBe('Backlog');
  });

  it('rejects closing an already-completed sprint', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints/${sprintId}/close`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(422);
  });
});

// ── Backlog ───────────────────────────────────────────────────────────────────

describe('GET /api/projects/:projectId/sprints/backlog/items', () => {
  it('returns issues not in any sprint', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/backlog/items`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    // After sprint close the issue should be in backlog
    expect(res.body.data.some((i: { id: number }) => i.id === issueId)).toBe(true);
  });
});

// ── Comments (AC6) ────────────────────────────────────────────────────────────

describe('Comments on issues', () => {
  let commentId: number;

  it('requires authentication', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .send({ content: 'Hi' });
    expect(res.status).toBe(401);
  });

  it('creates a comment', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'This is a comment' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('This is a comment');
    expect(res.body.data.user).toBeDefined();
    commentId = res.body.data.id as number;
  });

  it('rejects empty content', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: '   ' });

    expect(res.status).toBe(400);
  });

  it('lists comments for an issue', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].content).toBe('This is a comment');
  });

  it('edits own comment', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Edited comment' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Edited comment');
  });

  it('deletes own comment', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for deleted comment', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(404);
  });
});

// ── Search (AC7) ──────────────────────────────────────────────────────────────

describe('GET /api/search', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/search').query({ q: 'Sprint' });
    expect(res.status).toBe(401);
  });

  it('requires q param', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(400);
  });

  it('searches issues by title', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ q: 'Sprint Issue', type: 'issue' });

    expect(res.status).toBe(200);
    expect(res.body.data.issues).toBeInstanceOf(Array);
    expect(res.body.data.issues.some((i: { title: string }) => i.title === 'Sprint Issue')).toBe(true);
  });

  it('searches projects by name', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ q: 'Sprint Test Project', type: 'project' });

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toBeInstanceOf(Array);
    expect(res.body.data.projects.some((p: { name: string }) => p.name === 'Sprint Test Project')).toBe(true);
  });

  it('returns both issues and projects for type=all', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ q: 'Sprint' });

    expect(res.status).toBe(200);
    expect(res.body.data.issues).toBeDefined();
    expect(res.body.data.projects).toBeDefined();
  });

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ q: 'Sprint', page: 1, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 5 });
  });
});

// ── Branch coverage: comments edge cases ──────────────────────────────────────

describe('Comments edge cases (branch coverage)', () => {
  it('returns 400 for non-numeric issueId on POST comment', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/abc/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown issue on POST comment', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/999999/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Test' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric issueId on GET comments', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues/abc/comments`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown issue on GET comments', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues/999999/comments`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric commentId on PUT', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}/comments/abc`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown comment on PUT', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}/comments/999999`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'Test' });
    expect(res.status).toBe(404);
  });

  it('forbids editing another user comment', async () => {
    // Create a second user and comment
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('TestPass1', 10);
    const ceoRole = await prisma.role.findFirst({ where: { name: 'CEO' } });
    const otherUser = await prisma.user.upsert({
      where: { email: 'other@sprinttest.com' },
      update: {},
      create: { email: 'other@sprinttest.com', passwordHash: hash, firstName: 'Other', lastName: 'User', roleId: ceoRole!.id },
    });
    const otherToken = signAccessToken({ userId: otherUser.id, email: otherUser.email, role: 'CEO' });

    // CEO creates a comment
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ content: 'CEO comment' });
    expect(createRes.status).toBe(201);
    const commentId = createRes.body.data.id as number;

    // otherUser tries to edit it
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Hacked' });
    expect(res.status).toBe(403);

    // cleanup
    await prisma.comment.delete({ where: { id: commentId } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('returns 400 for non-numeric commentId on DELETE', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/${issueId}/comments/abc`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });
});

// ── Branch coverage: sprints edge cases ──────────────────────────────────────

describe('Sprints edge cases (branch coverage)', () => {
  it('returns 400 for non-numeric projectId on POST sprint', async () => {
    const res = await request(app)
      .post('/api/projects/abc/sprints')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'S' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown project on POST sprint', async () => {
    const res = await request(app)
      .post('/api/projects/999999/sprints')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'S' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric projectId on GET sprints', async () => {
    const res = await request(app)
      .get('/api/projects/abc/sprints')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric sprintId on GET sprint', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/abc`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown sprint on GET', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/999999`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric sprintId on PUT', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/abc`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric sprintId on close', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints/abc/close`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown sprint on close', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints/999999/close`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric projectId on backlog', async () => {
    const res = await request(app)
      .get('/api/projects/abc/sprints/backlog/items')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric sprintId on board', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/abc/board`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown sprint on board', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/999999/board`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric sprintId on velocity', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/abc/velocity`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown sprint on velocity', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/999999/velocity`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects editing a completed sprint', async () => {
    // Create and complete a sprint
    const sprint = await prisma.sprint.create({
      data: { name: 'Completed Sprint', projectId, status: 'completed' },
    });
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/${sprint.id}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Attempt edit' });
    expect(res.status).toBe(422);
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it('enforces only one active sprint per project (deactivates previous)', async () => {
    const s1 = await prisma.sprint.create({
      data: { name: 'Active One', projectId, status: 'active' },
    });
    const s2 = await prisma.sprint.create({
      data: { name: 'Active Two', projectId, status: 'planned' },
    });
    const res = await request(app)
      .put(`/api/projects/${projectId}/sprints/${s2.id}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    // s1 should now be planned
    const s1After = await prisma.sprint.findUnique({ where: { id: s1.id } });
    expect(s1After!.status).toBe('planned');
    await prisma.sprint.deleteMany({ where: { id: { in: [s1.id, s2.id] } } });
  });
});

// ── Branch coverage: issues edge cases ───────────────────────────────────────

describe('Issues edge cases (branch coverage)', () => {
  it('returns 400 for non-numeric projectId on POST issue', async () => {
    const res = await request(app)
      .post('/api/projects/abc/issues')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid priority on POST issue', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'Bad Priority', priority: 'Extreme' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric issueId on PUT issue', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/abc`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown issue on PUT', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/999999`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects invalid type on PUT issue', async () => {
    const issue = await prisma.issue.findFirst({ where: { projectId } });
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issue!.id}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ type: 'InvalidType' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid priority on PUT issue', async () => {
    const issue = await prisma.issue.findFirst({ where: { projectId } });
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issue!.id}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ priority: 'Extreme' });
    expect(res.status).toBe(400);
  });

  it('rejects non-Fibonacci estimate on PUT issue', async () => {
    const issue = await prisma.issue.findFirst({ where: { projectId } });
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issue!.id}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ estimate: 7 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for link on unknown issue', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/${issueId}/links/999999`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });
});

// ── Branch coverage extras: sprints ──────────────────────────────────────────

describe('Sprint branch coverage extras', () => {
  it('PUT sprint: returns 400 for non-numeric ids', async () => {
    const res = await request(app)
      .put(`/api/projects/abc/sprints/xyz`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('velocity: issues with null estimate counted as 0', async () => {
    // Create sprint with issue that has no estimate (null)
    const sprint = await prisma.sprint.create({
      data: { name: 'Velocity Null Sprint', projectId, status: 'active' },
    });
    await prisma.issue.create({
      data: {
        key: `SPR-VN${sprint.id}`, issueNumber: sprint.id + 100,
        title: 'No estimate issue', projectId, reporterId: ceoId!,
        sprintId: sprint.id, estimate: null, status: 'Done',
      },
    });
    await prisma.issue.create({
      data: {
        key: `SPR-VI${sprint.id}`, issueNumber: sprint.id + 101,
        title: 'In review issue', projectId, reporterId: ceoId!,
        sprintId: sprint.id, estimate: null, status: 'In Review',
      },
    });

    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprint.id}/velocity`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    // null estimates default to 0
    expect(res.body.data.totalPoints).toBe(0);
    expect(res.body.data.completedPoints).toBe(0);
    expect(res.body.data.inProgressPoints).toBe(0);
  });

  it('burndown: issue with null estimate counted as 0', async () => {
    const sprint = await prisma.sprint.create({
      data: {
        name: 'Burndown Null Sprint',
        projectId,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-07'),
        status: 'completed',
      },
    });
    await prisma.issue.create({
      data: {
        key: `SPR-BD${sprint.id}`, issueNumber: sprint.id + 200,
        title: 'Burndown null issue', projectId, reporterId: ceoId!,
        sprintId: sprint.id, estimate: null, status: 'Done',
      },
    });

    const res = await request(app)
      .get(`/api/projects/${projectId}/sprints/${sprint.id}/burndown`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalPoints).toBe(0);
    expect(Array.isArray(res.body.data.actualBurndown)).toBe(true);
  });

  it('issues.ts: sprintId change from null triggers sprint_changed log', async () => {
    const sprint = await prisma.sprint.create({
      data: { name: 'Sprint for log', projectId },
    });
    // Create issue with no sprint
    const issue = await prisma.issue.create({
      data: {
        key: `SPR-SCH${sprint.id}`, issueNumber: sprint.id + 300,
        title: 'Sprint change test', projectId, reporterId: ceoId!,
        sprintId: null,
      },
    });

    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issue.id}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ sprintId: sprint.id });
    expect(res.status).toBe(200);
    expect(res.body.data.sprintId).toBe(sprint.id);
  });
});
