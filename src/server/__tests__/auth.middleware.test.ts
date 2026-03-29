import { Response, NextFunction } from 'express';
import { authenticate, authorize, hasMinimumRole, ROLE_HIERARCHY, AuthRequest } from '../middleware/auth';
import { signAccessToken } from '../auth/tokens';

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const next: NextFunction = jest.fn();

describe('authenticate middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should call next() with a valid Bearer token', () => {
    const token = signAccessToken({ userId: 1, email: 'a@b.com', role: 'CEO' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe(1);
  });

  it('should return 401 when Authorization header is missing', () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should call next() when user role is in the allowed list', () => {
    const req = { user: { userId: 1, email: 'a@b.com', role: 'CEO' } } as AuthRequest;
    const res = makeRes();
    authorize('CEO', 'CTO')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user role is not in the allowed list', () => {
    const req = { user: { userId: 2, email: 'b@b.com', role: 'COO' } } as AuthRequest;
    const res = makeRes();
    authorize('CEO')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when req.user is undefined', () => {
    const req = { user: undefined } as AuthRequest;
    const res = makeRes();
    authorize('CEO')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // Role hierarchy tests
  it('CEO should pass a CTO-only check (hierarchy)', () => {
    const req = { user: { userId: 3, email: 'c@b.com', role: 'CEO' } } as AuthRequest;
    const res = makeRes();
    authorize('CTO')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('CEO should pass a Team Member check (hierarchy)', () => {
    const req = { user: { userId: 4, email: 'd@b.com', role: 'CEO' } } as AuthRequest;
    const res = makeRes();
    authorize('Team Member')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('Team Member should fail a CEO-only check (hierarchy)', () => {
    const req = { user: { userId: 5, email: 'e@b.com', role: 'Team Member' } } as AuthRequest;
    const res = makeRes();
    authorize('CEO')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('Project Manager should pass a Team Member check (hierarchy)', () => {
    const req = { user: { userId: 6, email: 'f@b.com', role: 'Project Manager' } } as AuthRequest;
    const res = makeRes();
    authorize('Team Member')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('hasMinimumRole', () => {
  it('returns true for same role', () => {
    expect(hasMinimumRole('CEO', 'CEO')).toBe(true);
  });

  it('returns true for higher role than required', () => {
    expect(hasMinimumRole('CEO', 'Team Member')).toBe(true);
    expect(hasMinimumRole('CTO', 'COO')).toBe(true);
  });

  it('returns false for lower role than required', () => {
    expect(hasMinimumRole('Team Member', 'CEO')).toBe(false);
    expect(hasMinimumRole('COO', 'CTO')).toBe(false);
  });

  it('falls back to exact match for unknown roles', () => {
    expect(hasMinimumRole('Admin', 'Admin')).toBe(true);
    expect(hasMinimumRole('Admin', 'CEO')).toBe(false);
  });
});

describe('ROLE_HIERARCHY export', () => {
  it('has correct order', () => {
    expect(ROLE_HIERARCHY).toEqual(['CEO', 'CTO', 'COO', 'Project Manager', 'Team Member']);
  });
});
