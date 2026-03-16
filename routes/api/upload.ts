import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import * as fileController from '../../controllers/fileController.js';

const router = express.Router();

router.post(
  '/',
  authenticateToken,
  fileController.handleUploadMiddleware,
  fileController.uploadFile
);

export default router;
