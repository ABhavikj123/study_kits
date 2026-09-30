import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { authRouter } from './auth/authRoutes.js';
import { kitRouter } from './routes/kitRoutes.js';
import { ApiError, sendError } from './utils/apiError.js';

export const app = express();

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';

app.set('trust proxy', 1);

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/kits', kitRouter);

app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));

app.use((error, _req, res, _next) => {
  if (process.env.NODE_ENV !== 'test' && !(error instanceof ApiError)) console.error(error);
  return sendError(res, error);
});