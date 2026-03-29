import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../auth/tokens';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

// Role hierarchy: index 0 = highest authority
// A role at a lower index (higher authority) satisfies requirements for all roles below it.
export const ROLE_HIERARCHY: string[] = ['CEO', 'CTO', 'COO', 'Project Manager', 'Team Member'];

/**
 * Returns true when the user's role meets the required minimum role level.
 * e.g. hasMinimumRole('CEO', 'Team Member') → true (CEO outranks Team Member)
 */
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userIdx = ROLE_HIERARCHY.indexOf(userRole);
  const reqIdx = ROLE_HIERARCHY.indexOf(requiredRole);
  // If either role is unknown fall back to exact match
  if (userIdx === -1 || reqIdx === -1) return userRole === requiredRole;
  return userIdx <= reqIdx;
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
    if (!req.user) {
      res.status(403).json({
        error: { message: 'Forbidden', statusCode: 403, timestamp: new Date().toISOString() },
      });
      return;
    }
    // Pass if the user's role has sufficient authority for ANY of the listed roles
    const allowed = roles.some((required) => hasMinimumRole(req.user!.role, required));
    if (!allowed) {
      res.status(403).json({
        error: { message: 'Forbidden', statusCode: 403, timestamp: new Date().toISOString() },
      });
      return;
    }
    next();
  };
}
