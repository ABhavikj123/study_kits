import { Router } from 'express';
import { login, logout, me, register } from './authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);