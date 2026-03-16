import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { registerSchema, loginSchema } from '../../validators/userValidator.js';
import * as userController from '../../controllers/userController.js';

const router = express.Router();

router.post('/register', validate(registerSchema), userController.register);
router.post('/login', validate(loginSchema), userController.login);

router.get('/me', authenticateToken, userController.getCurrentUser);

export default router;

