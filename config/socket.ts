import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import env from './env.js';
import { socketAuthMiddleware, type AuthenticatedSocket } from '../middleware/socketAuth.js';
import { SocketService } from '../services/socketService.js';

let socketServiceInstance: SocketService | null = null;

/**
 * Initialize Socket.io server with CORS and authentication
 */
export const initializeSocketIO = (httpServer: HTTPServer): SocketIOServer => {
  const corsOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Initialize socket service to handle events
  socketServiceInstance = new SocketService(io);

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId} (Socket ID: ${socket.id})`);

    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

export const getSocketService = (): SocketService => {
  if (!socketServiceInstance) {
    throw new Error('Socket.io has not been initialized yet');
  }
  return socketServiceInstance;
};

export type { SocketIOServer };
