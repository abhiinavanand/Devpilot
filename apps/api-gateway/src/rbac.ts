import type { Request, Response, NextFunction } from 'express';

export type Role = 'admin' | 'manager' | 'viewer';

export const getRole = (req: Request): Role => {
  const role = (req.header('x-role') || 'viewer').toLowerCase();
  if (role === 'admin' || role === 'manager') return role;
  return 'viewer';
};

export const requireRole = (allowed: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  const role = getRole(req);
  if (!allowed.includes(role)) {
    return res.status(403).json({ message: 'Insufficient role for this action.' });
  }
  return next();
};
