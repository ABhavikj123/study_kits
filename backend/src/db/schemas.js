export const COLLECTIONS = Object.freeze({
  USERS: 'users',
  SESSIONS: 'sessions',
  KITS: 'kits'
});

export const KIT_STATUSES = Object.freeze([
  'pending',
  'completed',
  'failed',
  'cancelled'
]);

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;