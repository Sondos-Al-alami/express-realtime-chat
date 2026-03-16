import { type Response } from 'express';
import prisma from '../config/db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createRoomSchema, roomIdSchema } from '../validators/roomValidator.js';

export const getAllRooms = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        _count: {
          select: {
            userRooms: true,
            messages: true,
          },
        },
        userRooms: req.userId
          ? {
              where: {
                userId: req.userId,
              },
              select: {
                id: true,
                userId: true,
                roomId: true,
                joinedAt: true,
              },
            }
          : false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      isMember: req.userId ? room.userRooms.length > 0 : false,
    }));

    res.json({ rooms: roomsWithMembership });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
};

export const createRoom = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedData = createRoomSchema.parse(req.body);

    const room = await prisma.room.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
      },
    });

    if (req.userId) {
      await prisma.userRoom.create({
        data: {
          userId: req.userId,
          roomId: room.id,
        },
      });
    }

    const roomWithDetails = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        _count: {
          select: {
            userRooms: true,
            messages: true,
          },
        },
        userRooms: req.userId
          ? {
              where: {
                userId: req.userId,
              },
              select: {
                id: true,
                userId: true,
                roomId: true,
                joinedAt: true,
              },
            }
          : false,
      },
    });

    const roomWithMembership = roomWithDetails
      ? {
          ...roomWithDetails,
          isMember: req.userId ? roomWithDetails.userRooms.length > 0 : false,
        }
      : null;

    res.status(201).json({ room: roomWithMembership });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed' });
      return;
    }
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

export const getRoomById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedParams = roomIdSchema.parse(req.params);
    const roomId = validatedParams.id;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        _count: {
          select: {
            userRooms: true,
            messages: true,
          },
        },
        userRooms: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'desc',
          },
        },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (req.userId) {
      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: req.userId,
            roomId: roomId,
          },
        },
      });

      if (!userRoom) {
        res.status(403).json({ error: 'You do not have access to this room' });
        return;
      }
    }

    res.json({ room });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid room ID format' });
      return;
    }
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
};

export const joinRoom = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedParams = roomIdSchema.parse(req.params);
    const roomId = validatedParams.id;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (req.userId) {
      const existingUserRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: req.userId,
            roomId: roomId,
          },
        },
      });

      if (existingUserRoom) {
        res.json({ message: 'Already a member of this room', room });
        return;
      }

      await prisma.userRoom.create({
        data: {
          userId: req.userId,
          roomId: roomId,
        },
      });
    }

    const roomWithDetails = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        _count: {
          select: {
            userRooms: true,
            messages: true,
          },
        },
        userRooms: req.userId
          ? {
              where: {
                userId: req.userId,
              },
              select: {
                id: true,
                userId: true,
                roomId: true,
                joinedAt: true,
              },
            }
          : false,
      },
    });

    const roomWithMembership = roomWithDetails
      ? {
          ...roomWithDetails,
          isMember: true,
        }
      : null;

    res.json({ message: 'Successfully joined room', room: roomWithMembership });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      res.status(409).json({ error: 'Already a member of this room' });
      return;
    }
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
};

export const leaveRoom = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedParams = roomIdSchema.parse(req.params);
    const roomId = validatedParams.id;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (req.userId) {
      const userRoom = await prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId: req.userId,
            roomId: roomId,
          },
        },
      });

      if (!userRoom) {
        res.status(404).json({ error: 'You are not a member of this room' });
        return;
      }

      await prisma.userRoom.delete({
        where: {
          userId_roomId: {
            userId: req.userId,
            roomId: roomId,
          },
        },
      });
    }

    const roomWithDetails = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        _count: {
          select: {
            userRooms: true,
            messages: true,
          },
        },  
        userRooms: req.userId
          ? {
              where: {
                userId: req.userId,
              },
              select: {
                id: true,
                userId: true,
                roomId: true,
                joinedAt: true,
              },
            }
          : false,
      },
    });

    const roomWithMembership = roomWithDetails
      ? {
          ...roomWithDetails,
          isMember: false,
        }
      : null;

    res.json({ message: 'Successfully left room', room: roomWithMembership });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
};
