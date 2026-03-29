import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../auth/tokens';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Unauthorized', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { message: 'Unauthorized', statusCode: 401, timestamp: new Date().toISOString() },
    });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: { message: 'Forbidden', statusCode: 403, timestamp: new Date().toISOString() },
      });
      return;
    }
    next();
  };
}
