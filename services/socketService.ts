import type { SocketIOServer } from '../config/socket.js';
import type { AuthenticatedSocket } from '../middleware/socketAuth.js';
import prisma from '../config/db.js';
import { sendMessageSchema, sendFileSchema, typingSchema } from '../validators/messageValidator.js';
import { sanitizeMessageContent } from '../utils/sanitize.js';
import { z } from 'zod';


export class SocketService {
  private io: SocketIOServer;
  private activeUsers: Map<string, Set<string>> = new Map();
  private typingUsers: Map<string, Map<string, NodeJS.Timeout>> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      if (!socket.userId) {
        socket.disconnect();
        return;
      }

      // Track user connection
      this.handleUserOnline(socket);

      // Handle join room
      socket.on('join-room', async (data: { roomId: string }) => {
        await this.handleJoinRoom(socket, data.roomId);
      });

      // Handle leave room
      socket.on('leave-room', async (data: { roomId: string }) => {
        await this.handleLeaveRoom(socket, data.roomId);
      });

      // Handle send message
      socket.on('send-message', async (data: unknown) => {
        await this.handleSendMessage(socket, data);
      });

      // Handle send file (file message; broadcasts as new-file-message)
      socket.on('send-file', async (data: unknown) => {
        await this.handleSendFile(socket, data);
      });

      // Handle typing indicator
      socket.on('typing', async (data: unknown) => {
        await this.handleTyping(socket, data);
      });

      // Handle stop typing
      socket.on('stop-typing', async (data: unknown) => {
        await this.handleStopTyping(socket, data);
      });

      // Handle get online users
      socket.on('get-online-users', async (data: unknown) => {
        await this.handleGetOnlineUsers(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleUserOnline(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    // Track this socket for the user
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // If this is the first socket for this user, broadcast online status
    if (this.userSockets.get(userId)!.size === 1) {
      // Get all rooms this user is in from database
      this.broadcastUserOnlineStatus(userId, socket.username || undefined);
    }
  }

  private async broadcastUserOnlineStatus(userId: string, username?: string) {
    try {
      // Get all rooms this user is a member of
      const userRooms = await prisma.userRoom.findMany({
        where: { userId },
        select: { roomId: true },
      });

      // Broadcast user-online to all rooms the user is in
      userRooms.forEach(({ roomId }) => {
        this.io.to(roomId).emit('user-online', {
          userId,
          username,
          roomId,
        });
      });
    } catch (error) {
      console.error('Error broadcasting user online status:', error);
    }
  }

  private async broadcastUserOfflineStatus(userId: string, username?: string) {
    try {
      // Get all rooms this user is a member of
      const userRooms = await prisma.userRoom.findMany({
        where: { userId },
        select: { roomId: true },
      });

      // Broadcast user-offline to all rooms the user is in
      userRooms.forEach(({ roomId }) => {
        this.io.to(roomId).emit('user-offline', {
          userId,
          username,
          roomId,
        });
      });
    } catch (error) {
      console.error('Error broadcasting user offline status:', error);
    }
  }

  private async handleJoinRoom(socket: AuthenticatedSocket, roomId: string) {
    try {
      // Verify user has access to the room
      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: socket.userId!,
            roomId: roomId,
          },
        },
        include: {
          room: true,
        },
      });

      if (!userRoom) {
        socket.emit('error', { message: 'You do not have access to this room' });
        return;
      }

      // Join Socket.io room
      socket.join(roomId);

      // Track active user in room
      if (!this.activeUsers.has(roomId)) {
        this.activeUsers.set(roomId, new Set());
      }
      this.activeUsers.get(roomId)!.add(socket.userId!);

      // Notify others in the room that user joined
      socket.to(roomId).emit('user-joined', {
        userId: socket.userId,
        username: socket.username,
        roomId: roomId,
      });

      // Broadcast user-online if this is user's first connection
      if (this.userSockets.get(socket.userId!)?.size === 1) {
        socket.to(roomId).emit('user-online', {
          userId: socket.userId,
          username: socket.username,
          roomId: roomId,
        });
      }

      // Send current active users to the joining user
      const activeUserIds = Array.from(this.activeUsers.get(roomId) || []);
      socket.emit('room-users', {
        roomId: roomId,
        userIds: activeUserIds,
      });

      // Send online users list to the joining user
      socket.emit('online-users', {
        roomId: roomId,
        userIds: activeUserIds,
      });

      console.log(`User ${socket.userId} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private async handleLeaveRoom(socket: AuthenticatedSocket, roomId: string) {
    try {
      // Leave Socket.io room
      socket.leave(roomId);

      // Remove from active users
      const roomUsers = this.activeUsers.get(roomId);
      if (roomUsers) {
        roomUsers.delete(socket.userId!);
        if (roomUsers.size === 0) {
          this.activeUsers.delete(roomId);
        }
      }

      // Clear typing indicator
      this.clearTypingIndicator(roomId, socket.userId!);

      // Notify others in the room
      socket.to(roomId).emit('user-left', {
        userId: socket.userId,
        username: socket.username,
        roomId: roomId,
      });

      console.log(`User ${socket.userId} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: unknown) {
    try {
      // Validate input
      const validatedData = sendMessageSchema.parse(data);

      // Verify user has access to the room
      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: socket.userId!,
            roomId: validatedData.roomId,
          },
        },
      });

      if (!userRoom) {
        socket.emit('error', { message: 'You do not have access to this room' });
        return;
      }

      const content = sanitizeMessageContent(validatedData.content ?? '') ?? validatedData.content ?? null;
      const fileUrl = validatedData.fileUrl ?? null;
      if (content == null && fileUrl == null) {
        socket.emit('error', { message: 'Message content is required after sanitization' });
        return;
      }

      // Create message in database
      const message = await prisma.message.create({
        data: {
          content,
          fileUrl,
          userId: socket.userId!,
          roomId: validatedData.roomId,
        },
      });

      // Broadcast message to all users in the room (including sender)
      this.io.to(validatedData.roomId).emit('new-message', {
        id: message.id,
        content: message.content,
        fileUrl: message.fileUrl,
        userId: message.userId,
        roomId: message.roomId,
        username: socket.username ?? 'Unknown',
        createdAt: message.createdAt,
      });

      // Clear typing indicator
      this.clearTypingIndicator(validatedData.roomId, socket.userId!);

      console.log(`Message sent by ${socket.userId} in room ${validatedData.roomId}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        socket.emit('error', { message: 'Invalid message data', details: error.issues });
      } else {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    }
  }

  private async handleSendFile(socket: AuthenticatedSocket, data: unknown) {
    try {
      const validatedData = sendFileSchema.parse(data);

      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: socket.userId!,
            roomId: validatedData.roomId,
          },
        },
      });

      if (!userRoom) {
        socket.emit('error', { message: 'You do not have access to this room' });
        return;
      }

      const content = sanitizeMessageContent(validatedData.content ?? '') ?? validatedData.content ?? null;

      const message = await prisma.message.create({
        data: {
          content,
          fileUrl: validatedData.fileUrl,
          userId: socket.userId!,
          roomId: validatedData.roomId,
        },
      });

      this.io.to(validatedData.roomId).emit('new-file-message', {
        id: message.id,
        content: message.content,
        fileUrl: message.fileUrl,
        userId: message.userId,
        roomId: message.roomId,
        username: socket.username ?? 'Unknown',
        createdAt: message.createdAt,
      });

      this.clearTypingIndicator(validatedData.roomId, socket.userId!);
      console.log(`File message sent by ${socket.userId} in room ${validatedData.roomId}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        socket.emit('error', { message: 'Invalid file message data', details: error.issues });
      } else {
        console.error('Error sending file message:', error);
        socket.emit('error', { message: 'Failed to send file message' });
      }
    }
  }

  private async handleTyping(socket: AuthenticatedSocket, data: unknown) {
    try {
      // Validate input
      const validatedData = typingSchema.parse(data);

      // Verify user has access to the room
      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: socket.userId!,
            roomId: validatedData.roomId,
          },
        },
      });

      if (!userRoom) {
        return; // Silently fail if user doesn't have access
      }

      // Clear existing typing timeout for this user in this room
      this.clearTypingIndicator(validatedData.roomId, socket.userId!);

      // Initialize typing map for room if needed
      if (!this.typingUsers.has(validatedData.roomId)) {
        this.typingUsers.set(validatedData.roomId, new Map());
      }

      // Broadcast typing indicator to others in the room
      socket.to(validatedData.roomId).emit('typing', {
        userId: socket.userId,
        username: socket.username,
        roomId: validatedData.roomId,
      });

      // Set timeout to auto-stop typing after 3 seconds
      const timeout = setTimeout(() => {
        this.clearTypingIndicator(validatedData.roomId, socket.userId!);
        socket.to(validatedData.roomId).emit('stop-typing', {
          userId: socket.userId,
          username: socket.username,
          roomId: validatedData.roomId,
        });
      }, 3000);

      this.typingUsers.get(validatedData.roomId)!.set(socket.userId!, timeout);
    } catch (error) {
      // Silently fail for typing indicators
      if (error instanceof z.ZodError) {
        console.error('Invalid typing data:', error.issues);
      }
    }
  }

  private async handleStopTyping(socket: AuthenticatedSocket, data: unknown) {
    try {
      // Validate input
      const validatedData = typingSchema.parse(data);

      // Clear typing indicator
      this.clearTypingIndicator(validatedData.roomId, socket.userId!);

      // Broadcast stop typing to others in the room
      socket.to(validatedData.roomId).emit('stop-typing', {
        userId: socket.userId,
        username: socket.username,
        roomId: validatedData.roomId,
      });
    } catch (error) {
      // Silently fail for typing indicators
      if (error instanceof z.ZodError) {
        console.error('Invalid stop-typing data:', error.issues);
      }
    }
  }

  private async handleGetOnlineUsers(socket: AuthenticatedSocket, data: unknown) {
    try {
      // Validate input
      const validatedData = typingSchema.parse(data);

      // Verify user has access to the room
      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: socket.userId!,
            roomId: validatedData.roomId,
          },
        },
      });

      if (!userRoom) {
        socket.emit('error', { message: 'You do not have access to this room' });
        return;
      }

      // Get online users in the room
      const onlineUserIds = this.getActiveUsers(validatedData.roomId);

      // Send online users list to requesting socket
      socket.emit('online-users', {
        roomId: validatedData.roomId,
        userIds: onlineUserIds,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        socket.emit('error', { message: 'Invalid room ID' });
      } else {
        console.error('Error getting online users:', error);
        socket.emit('error', { message: 'Failed to get online users' });
      }
    }
  }

  private clearTypingIndicator(roomId: string, userId: string) {
    const roomTyping = this.typingUsers.get(roomId);
    if (roomTyping) {
      const timeout = roomTyping.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        roomTyping.delete(userId);
        if (roomTyping.size === 0) {
          this.typingUsers.delete(roomId);
        }
      }
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    // Remove socket from user's socket set
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);

      // If this was the last socket for this user, broadcast offline status
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.broadcastUserOfflineStatus(userId, socket.username || undefined);
      }
    }

    // Get all rooms this socket was in
    const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);

    // Remove user from all active user lists and clear typing indicators
    rooms.forEach((roomId) => {
      const roomUsers = this.activeUsers.get(roomId);
      if (roomUsers) {
        roomUsers.delete(userId);
        if (roomUsers.size === 0) {
          this.activeUsers.delete(roomId);
        }
      }

      // Clear typing indicator
      this.clearTypingIndicator(roomId, userId);

      // Notify others in the room that user left
      socket.to(roomId).emit('user-left', {
        userId: userId,
        username: socket.username,
        roomId: roomId,
      });
    });

    console.log(`User ${userId} disconnected from all rooms`);
  }

  /**
   * Get active users in a room
   */
  getActiveUsers(roomId: string): string[] {
    return Array.from(this.activeUsers.get(roomId) || []);
  }

  /**
   * Get Socket.io instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}
