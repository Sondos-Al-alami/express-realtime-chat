import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  username?: string;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; username?: string };

    req.userId = decoded.userId;
    if (decoded.username) {
      req.username = decoded.username;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(403).json({ error: 'Token expired' });
    } else {
      res.status(403).json({ error: 'Token verification failed' });
    }
  }
};

