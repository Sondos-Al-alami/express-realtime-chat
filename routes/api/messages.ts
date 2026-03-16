import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validateParams } from '../../middleware/validation.js';
import { roomIdSchema } from '../../validators/roomValidator.js';
import * as messageController from '../../controllers/messageController.js';

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);

router.get('/', validateParams(roomIdSchema), messageController.getRoomMessages);

export default router;

