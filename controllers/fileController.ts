import { type Request, type Response, type NextFunction } from 'express';
import prisma from '../config/db.js';
import env from '../config/env.js';
import { uploadMiddleware } from '../config/multer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const handleUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  uploadMiddleware.single('file')(req, res, (err: unknown) => {
    if (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large' });
        return;
      }
      if (message.includes('File type not allowed')) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(400).json({ error: 'Upload failed' });
      return;
    }
    next();
  });
};

/**
 * POST /api/upload
 * Upload a file, store on disk and save metadata in database.
 * Returns file URL and metadata for use in chat.
 */
export const uploadFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { filename, originalname, mimetype, size } = req.file;
    console.log(env.PUBLIC_API_URL);
    const pathSegment = `/uploads/${filename}`;
    const fileUrl = env.PUBLIC_API_URL
      ? `${env.PUBLIC_API_URL.replace(/\/$/, '')}${pathSegment}`
      : pathSegment;

    const fileRecord = await prisma.file.create({
      data: {
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        uploadedBy: req.userId,
      },
    });

    res.status(201).json({
      id: fileRecord.id,
      fileUrl,
      filename: fileRecord.filename,
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      size: fileRecord.size,
      createdAt: fileRecord.createdAt,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};
