import crypto from 'node:crypto';
import { SESSION_TTL_MS } from '../db/schemas.js';

export const SESSION_COOKIE = 'sessionId';

export const createSessionId = () => crypto.randomBytes(32).toString('hex');

export const sessionExpiry = () =>
  new Date(Date.now() + SESSION_TTL_MS);

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: SESSION_TTL_MS,
  path: '/'
});