import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import env from './config/env.js';
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import roomsRouter from './routes/api/rooms.js';
import authRouter from './routes/api/auth.js';
import uploadRouter from './routes/api/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = env.NODE_ENV === 'production';

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration - Support multiple origins (comma-separated)
const corsOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true,
}));

app.use(logger(isProduction ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting – general API (skip /health and static)
const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Health check for load balancers and orchestration
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/upload', uploadRouter);

// 404
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(Object.assign(new Error('Not Found') as Error & { status?: number }, { status: 404 }));
});

// Global error handler (no stack trace in production)
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  res.status(status).json({
    error: status === 500 && isProduction ? 'Internal Server Error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

export default app;

