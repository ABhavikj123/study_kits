import { ObjectId } from 'mongodb';
import { SESSION_COOKIE } from '../auth/session.js';
import { COLLECTIONS } from '../db/schemas.js';
import { getDb } from '../db/mongo.js';
import { ApiError } from '../utils/apiError.js';

export async function requireAuth(req, _res, next) {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (!sessionId) throw new ApiError(401, 'SESSION_INVALID', 'Unauthorized');

    const db = await getDb();
    const session = await db.collection(COLLECTIONS.SESSIONS).findOne({ _id: sessionId });

    if (!session || session.expiresAt <= new Date()) {
      if (session) await db.collection(COLLECTIONS.SESSIONS).deleteOne({ _id: sessionId });
      throw new ApiError(401, 'SESSION_INVALID', 'Unauthorized');
    }

    const user = await db.collection(COLLECTIONS.USERS).findOne(
      { _id: new ObjectId(session.userId) },
      { projection: { passwordHash: 0 } }
    );

    if (!user) throw new ApiError(401, 'SESSION_INVALID', 'Unauthorized');

    req.userId = user._id;
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}