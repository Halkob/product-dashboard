/**
 * REQ-003 AC2/AC3/AC5 — Issue CRUD, workflow, assignment, story points
 */
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../app';
import { signAccessToken } from '../auth/tokens';

const prisma = new PrismaClient();

let workspaceId: number;
let projectId: number;
let ceoToken: string;
let ceoUserId: number;

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
    where: { name_roleId: { name: 'Issue Test WS', roleId: ceoRole.id } },
    update: {},
    create: { name: 'Issue Test WS', roleId: ceoRole.id },
  });
  workspaceId = ws.id;

  const hash = await bcrypt.hash('TestPass1', 10);
  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@issuetest.com' },
    update: {},
    create: { email: 'ceo@issuetest.com', passwordHash: hash, firstName: 'CEO', lastName: 'Issue', roleId: ceoRole.id },
  });
  const member = await prisma.user.upsert({
    where: { email: 'member@issuetest.com' },
    update: {},
    create: { email: 'member@issuetest.com', passwordHash: hash, firstName: 'Member', lastName: 'Issue', roleId: memberRole.id },
  });
  ceoUserId = ceo.id;
  ceoToken = signAccessToken({ userId: ceo.id, email: ceo.email, role: 'CEO' });
  // member user created for future role-based tests
  signAccessToken({ userId: member.id, email: member.email, role: 'Team Member' });

  const project = await prisma.project.create({
    data: { key: 'ISS', name: 'Issue Test Project', workspaceId, createdById: ceo.id },
  });
  projectId = project.id;
});

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { issue: { projectId } } });
  await prisma.issueLink.deleteMany({ where: { source: { projectId } } });
  await prisma.comment.deleteMany({ where: { issue: { projectId } } });
  await prisma.issue.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@issuetest.com' } } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.$disconnect();
});

// ── POST /api/projects/:projectId/issues ──────────────────────────────────────

describe('POST /api/projects/:projectId/issues', () => {
  it('requires authentication', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/issues`).send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  it('creates an issue with auto-generated key', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'First Issue', type: 'Story', priority: 'High' });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('ISS-1');
    expect(res.body.data.issueNumber).toBe(1);
    expect(res.body.data.type).toBe('Story');
    expect(res.body.data.priority).toBe('High');
    expect(res.body.data.status).toBe('Backlog');
    expect(res.body.data.reporter.id).toBe(ceoUserId);
  });

  it('increments key for each new issue', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'Second Issue' });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('ISS-2');
  });

  it('rejects missing title', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ type: 'Bug' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid issue type', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'Bad Type', type: 'Invalid' });

    expect(res.status).toBe(400);
  });

  it('rejects non-Fibonacci estimate', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'Bad Estimate', estimate: 4 });

    expect(res.status).toBe(400);
  });

  it('accepts valid Fibonacci estimates', async () => {
    for (const estimate of [0, 1, 2, 3, 5, 8, 13, 21]) {
      const res = await request(app)
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({ title: `Issue ${estimate}pts`, estimate });

      expect(res.status).toBe(201);
      expect(res.body.data.estimate).toBe(estimate);
    }
  });

  it('returns 404 for unknown project', async () => {
    const res = await request(app)
      .post('/api/projects/999999/issues')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ── GET /api/projects/:projectId/issues ───────────────────────────────────────

describe('GET /api/projects/:projectId/issues', () => {
  it('returns paginated issues', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ limit: 5, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('filters by type', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ type: 'Story' });

    expect(res.status).toBe(200);
    res.body.data.forEach((i: { type: string }) => expect(i.type).toBe('Story'));
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ status: 'Backlog' });

    expect(res.status).toBe(200);
    res.body.data.forEach((i: { status: string }) => expect(i.status).toBe('Backlog'));
  });

  it('supports search by title', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ search: 'First Issue' });

    expect(res.status).toBe(200);
    expect(res.body.data.some((i: { title: string }) => i.title === 'First Issue')).toBe(true);
  });
});

// ── GET /api/projects/:projectId/issues/:issueId ──────────────────────────────

describe('GET /api/projects/:projectId/issues/:issueId', () => {
  let issueId: number;

  beforeAll(async () => {
    const issue = await prisma.issue.findFirst({ where: { projectId, issueNumber: 1 } });
    issueId = issue!.id;
  });

  it('returns issue with links and activity', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.key).toBe('ISS-1');
    expect(res.body.data.outwardLinks).toBeInstanceOf(Array);
    expect(res.body.data.inwardLinks).toBeInstanceOf(Array);
    expect(res.body.data.activityLogs).toBeInstanceOf(Array);
  });

  it('returns 404 for unknown issue', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues/999999`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/projects/:projectId/issues/:issueId ──────────────────────────────

describe('PUT /api/projects/:projectId/issues/:issueId — status workflow', () => {
  let issueId: number;

  beforeAll(async () => {
    const issue = await prisma.issue.findFirst({ where: { projectId, issueNumber: 1 } });
    issueId = issue!.id;
  });

  it('transitions Backlog → Ready', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'Ready' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Ready');
  });

  it('transitions Ready → In Progress', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'In Progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('In Progress');
  });

  it('rejects invalid status transition (In Progress → Closed)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'Closed' });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Invalid status transition/);
  });

  it('updates estimate (story points)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ estimate: 8 });

    expect(res.status).toBe(200);
    expect(res.body.data.estimate).toBe(8);
  });

  it('assigns an issue to a user', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ assigneeId: ceoUserId });

    expect(res.status).toBe(200);
    expect(res.body.data.assignee?.id).toBe(ceoUserId);
  });
});

// ── Issue Links ───────────────────────────────────────────────────────────────

describe('Issue links (AC3)', () => {
  let sourceId: number;
  let targetId: number;

  beforeAll(async () => {
    const source = await prisma.issue.findFirst({ where: { projectId, issueNumber: 1 } });
    const target = await prisma.issue.findFirst({ where: { projectId, issueNumber: 2 } });
    sourceId = source!.id;
    targetId = target!.id;
  });

  it('creates a link between two issues', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${sourceId}/links`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ targetId, linkType: 'blocks' });

    expect(res.status).toBe(201);
    expect(res.body.data.linkType).toBe('blocks');
  });

  it('rejects self-link', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${sourceId}/links`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ targetId: sourceId, linkType: 'relates_to' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid link type', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${sourceId}/links`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ targetId, linkType: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('deletes a link', async () => {
    const link = await prisma.issueLink.findFirst({ where: { sourceId } });
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/${sourceId}/links/${link!.id}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(204);
  });
});

// ── DELETE /api/projects/:projectId/issues/:issueId ───────────────────────────

describe('DELETE /api/projects/:projectId/issues/:issueId (soft delete)', () => {
  it('soft-deletes an issue', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ title: 'To Be Deleted' });

    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id as number;

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/issues/${id}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/projects/${projectId}/issues/${id}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(getRes.status).toBe(404);
  });
});

// ── Branch coverage: issues edge cases ───────────────────────────────────────

describe('Issues branch coverage extras', () => {
  let issueId: number;

  beforeAll(async () => {
    const issue = await prisma.issue.findFirst({ where: { projectId, issueNumber: 1 } });
    issueId = issue!.id;
  });

  it('returns 400 for non-numeric projectId on GET issues', async () => {
    const res = await request(app)
      .get('/api/projects/abc/issues')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric id on GET issue', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues/abc`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric id on DELETE issue', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/abc`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown issue on DELETE', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/999999`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id on POST link', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/abc/links`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ targetId: issueId, linkType: 'blocks' });
    expect(res.status).toBe(400);
  });

  it('filters issues by sprintId=null (backlog items)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ sprintId: 'null' });
    expect(res.status).toBe(200);
  });

  it('filters issues by parentId=null (top-level issues)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ parentId: 'null' });
    expect(res.status).toBe(200);
  });

  it('filters issues by assigneeId', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ assigneeId: 1 });
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing targetId on POST link', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/links`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ targetId: 99 }); // missing linkType
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric linkId on DELETE link', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/issues/${issueId}/links/abc`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });
});
