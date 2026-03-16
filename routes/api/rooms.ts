import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate, validateParams } from '../../middleware/validation.js';
import { createRoomSchema, roomIdSchema } from '../../validators/roomValidator.js';
import * as roomController from '../../controllers/roomController.js';
import messagesRouter from './messages.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', roomController.getAllRooms);

router.post('/', validate(createRoomSchema), roomController.createRoom);

router.get('/:id', validateParams(roomIdSchema), roomController.getRoomById);

router.post('/:id/join', validateParams(roomIdSchema), roomController.joinRoom);

router.post('/:id/leave', validateParams(roomIdSchema), roomController.leaveRoom);

router.use('/:id/messages', messagesRouter);

export default router;

