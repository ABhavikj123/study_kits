import bcrypt from 'bcrypt';
import { COLLECTIONS } from '../db/schemas.js';
import { getDb } from '../db/mongo.js';
import { ApiError } from '../utils/apiError.js';
import { validateCredentials } from '../utils/validation.js';
import { createSessionId, sessionCookieOptions, sessionExpiry, SESSION_COOKIE } from './session.js';

const profile = (user) => ({ id: user._id.toString(), email: user.email });

async function establishSession(res, userId) {
  const db = await getDb();
  const session = {
    _id: createSessionId(),
    userId,
    createdAt: new Date(),
    expiresAt: sessionExpiry()
  };
  await db.collection(COLLECTIONS.SESSIONS).insertOne(session);
  res.cookie(SESSION_COOKIE, session._id, sessionCookieOptions());
}

export async function register(req, res, next) {
  try {
    const { email, password } = validateCredentials(req.body);
    const db = await getDb();
    const user = {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date()
    };
    try {
      user._id = (await db.collection(COLLECTIONS.USERS).insertOne(user)).insertedId;
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
      throw error;
    }
    await establishSession(res, user._id);
    return res.status(201).json({ user: profile(user) });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = validateCredentials(req.body);
    const db = await getDb();
    const user = await db.collection(COLLECTIONS.USERS).findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await establishSession(res, user._id);
    return res.json({ user: profile(user) });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.cookies?.[SESSION_COOKIE]) {
      const db = await getDb();
      await db.collection(COLLECTIONS.SESSIONS).deleteOne({ _id: req.cookies[SESSION_COOKIE] });
    }
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export const me = (req, res) => res.json({ user: profile(req.user) });