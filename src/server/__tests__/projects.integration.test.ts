/**
 * REQ-003 AC1 — Project CRUD integration tests
 * Coverage: create, list (pagination/filter), get, update, soft-delete, permissions
 */
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../app';
import { signAccessToken } from '../auth/tokens';

const prisma = new PrismaClient();

// ── Test fixtures ─────────────────────────────────────────────────────────────

let workspaceId: number;
let ceoRoleId: number;
let ceoUserId: number;
let ceoToken: string;
let memberToken: string;

beforeAll(async () => {
  const ceoRole = await prisma.role.upsert({
    where: { name: 'CEO' },
    update: {},
    create: { name: 'CEO', description: 'Chief Executive Officer' },
  });
  const memberRole = await prisma.role.upsert({
    where: { name: 'Team Member' },
    update: {},
    create: { name: 'Team Member', description: 'Team Member' },
  });
  ceoRoleId = ceoRole.id;

  const ws = await prisma.workspace.upsert({
    where: { name_roleId: { name: 'Proj Test WS', roleId: ceoRoleId } },
    update: {},
    create: { name: 'Proj Test WS', roleId: ceoRoleId },
  });
  workspaceId = ws.id;

  const hash = await bcrypt.hash('TestPass1', 10);

  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@projtest.com' },
    update: {},
    create: { email: 'ceo@projtest.com', passwordHash: hash, firstName: 'CEO', lastName: 'Test', roleId: ceoRoleId },
  });
  const member = await prisma.user.upsert({
    where: { email: 'member@projtest.com' },
    update: {},
    create: { email: 'member@projtest.com', passwordHash: hash, firstName: 'Member', lastName: 'Test', roleId: memberRole.id },
  });
  ceoUserId = ceo.id;

  ceoToken = signAccessToken({ userId: ceo.id, email: ceo.email, role: 'CEO' });
  memberToken = signAccessToken({ userId: member.id, email: member.email, role: 'Team Member' });
});

afterAll(async () => {
  await prisma.issue.deleteMany({ where: { project: { workspaceId } } });
  await prisma.project.deleteMany({ where: { workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@projtest.com' } } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.$disconnect();
});

// ── POST /api/projects ────────────────────────────────────────────────────────

describe('POST /api/projects', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects').send({ key: 'TST', name: 'Test', workspaceId });
    expect(res.status).toBe(401);
  });

  it('creates a project with valid data', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: 'PROJ', name: 'My Project', description: 'Desc', workspaceId });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('PROJ');
    expect(res.body.data.name).toBe('My Project');
    expect(res.body.data.createdBy.id).toBe(ceoUserId);
    expect(res.body.data._count.issues).toBe(0);
  });

  it('converts key to uppercase', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: 'lower', name: 'Lower Key Project', workspaceId });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('LOWER');
  });

  it('rejects invalid key format (starts with digit)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: '1BAD', name: 'Bad Key', workspaceId });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate key in same workspace', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: 'PROJ', name: 'Duplicate', workspaceId });

    expect(res.status).toBe(409);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'No Key or Workspace' });

    expect(res.status).toBe(400);
  });

  it('accepts optional startDate and endDate', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: 'DATED', name: 'Dated Project', workspaceId, startDate: '2026-01-01', endDate: '2026-12-31' });

    expect(res.status).toBe(201);
    expect(res.body.data.startDate).toBeDefined();
  });
});

// ── GET /api/projects ─────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('returns paginated project list', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ workspaceId, limit: 10, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10 });
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('filters by workspaceId returning empty for unknown workspace', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ workspaceId: 999999 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('supports search by name', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ search: 'My Project' });

    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { name: string }) => p.name === 'My Project')).toBe(true);
  });

  it('excludes archived projects', async () => {
    // Archive a project directly
    const p = await prisma.project.findFirst({ where: { key: 'LOWER', workspaceId } });
    await prisma.project.update({ where: { id: p!.id }, data: { archivedAt: new Date() } });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .query({ workspaceId });

    const keys = res.body.data.map((p: { key: string }) => p.key);
    expect(keys).not.toContain('LOWER');
  });
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────

describe('GET /api/projects/:id', () => {
  let projectId: number;

  beforeAll(async () => {
    const p = await prisma.project.findFirst({ where: { key: 'PROJ', workspaceId } });
    projectId = p!.id;
  });

  it('returns a project by id', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(projectId);
    expect(res.body.data.key).toBe('PROJ');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/projects/999999')
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .get('/api/projects/abc')
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(400);
  });
});

// ── PUT /api/projects/:id ─────────────────────────────────────────────────────

describe('PUT /api/projects/:id', () => {
  let projectId: number;

  beforeAll(async () => {
    const p = await prisma.project.findFirst({ where: { key: 'PROJ', workspaceId } });
    projectId = p!.id;
  });

  it('updates name and description (creator)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Updated Name', description: 'New desc' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('rejects invalid status value', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ status: 'invalid-status' });

    expect(res.status).toBe(400);
  });

  it('accepts valid status values', async () => {
    for (const status of ['paused', 'active']) {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({ status });
      expect(res.status).toBe(200);
    }
  });

  it('forbids update by non-creator non-admin', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown project', async () => {
    const res = await request(app)
      .put('/api/projects/999999')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────

describe('DELETE /api/projects/:id (soft delete)', () => {
  it('soft-deletes a project (creator)', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: 'DELME', name: 'To Delete', workspaceId });

    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id as number;

    const deleteRes = await request(app)
      .delete(`/api/projects/${id}`)
      .set('Authorization', `Bearer ${ceoToken}`);

    expect(deleteRes.status).toBe(204);

    // Should now return 404
    const getRes = await request(app)
      .get(`/api/projects/${id}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for unknown project', async () => {
    const res = await request(app)
      .delete('/api/projects/999999')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(404);
  });

  it('forbids delete by non-creator non-admin', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ key: 'NODELM', name: 'No Delete', workspaceId });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id as number;

    const res = await request(app)
      .delete(`/api/projects/${id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});
