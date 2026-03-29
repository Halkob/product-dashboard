import { Response, NextFunction } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
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
});
