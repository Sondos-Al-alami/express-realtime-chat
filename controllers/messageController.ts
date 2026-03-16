import { type Response } from 'express';
import prisma from '../config/db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { roomIdSchema } from '../validators/roomValidator.js';
import { getMessagesSchema } from '../validators/messageValidator.js';

export const getRoomMessages = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedParams = roomIdSchema.parse(req.params);
    const roomId = validatedParams.id;

    const validatedQuery = getMessagesSchema.parse(req.query);
    const limit = validatedQuery.limit;
    const offset = validatedQuery.offset;

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
        res.status(403).json({ error: 'You do not have access to this room' });
        return;
      }
    }

    const messages = await prisma.message.findMany({
      where: {
        roomId: roomId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const totalCount = await prisma.message.count({
      where: {
        roomId: roomId,
      },
    });

    const reversedMessages = messages.reverse();

    res.json({
      messages: reversedMessages,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid request parameters' });
      return;
    }
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

