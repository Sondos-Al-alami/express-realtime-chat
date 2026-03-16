import { z } from 'zod';

const fileUrlSchema = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => !val || val.startsWith('/uploads/') || val.startsWith('http'),
    { message: 'fileUrl must be an upload path or URL' }
  );

export const sendMessageSchema = z
  .object({
    roomId: z.string().uuid('Invalid room ID format'),
    content: z
      .string()
      .max(5000, 'Message must be less than 5000 characters')
      .trim()
      .optional()
      .nullable(),
    fileUrl: fileUrlSchema,
  })
  .refine((data) => (data.content?.length ?? 0) > 0 || data.fileUrl, {
    message: 'Either content or fileUrl is required',
    path: ['content'],
  });

export const getMessagesSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0)),
});

export const sendFileSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  fileUrl: z.string().min(1, 'File URL is required').refine(
    (val) => val.startsWith('/uploads/'),
    { message: 'File URL must be a valid upload path' }
  ),
  content: z
    .string()
    .max(5000, 'Caption must be less than 5000 characters')
    .trim()
    .optional()
    .nullable(),
});

export const typingSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendFileInput = z.infer<typeof sendFileSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
export type TypingInput = z.infer<typeof typingSchema>;

