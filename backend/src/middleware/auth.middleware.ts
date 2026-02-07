import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = verifyToken(token);
    req.userId = decoded.userId;

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
