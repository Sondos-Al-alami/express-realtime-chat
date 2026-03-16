import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

/**
 * Socket.io authentication middleware
 * Validates JWT token from handshake auth
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; username?: string };

    socket.userId = decoded.userId;
    if (decoded.username) {
      socket.username = decoded.username;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new Error('Authentication error: Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new Error('Authentication error: Token expired'));
    } else {
      next(new Error('Authentication error: Token verification failed'));
    }
  }
};

