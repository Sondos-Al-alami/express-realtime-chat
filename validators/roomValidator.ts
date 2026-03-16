import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(100, 'Room name must be less than 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
});

export const roomIdSchema = z.object({
  id: z.string().uuid('Invalid room ID format'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type RoomIdInput = z.infer<typeof roomIdSchema>;

