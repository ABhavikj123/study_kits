import { MongoClient, ServerApiVersion } from 'mongodb';

let client;
let clientPromise;
let indexesPromise;

const databaseName = () => {
  if (process.env.MONGODB_DB_NAME) return process.env.MONGODB_DB_NAME;
  try {
    return new URL(process.env.MONGODB_URI).pathname.replace(/^\//, '') || 'interview_prep_kit';
  } catch {
    return 'interview_prep_kit';
  }
};

export async function getMongoClient() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  if (!clientPromise) {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      },
      maxPoolSize: 60,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
      retryReads: true,
      retryWrites: true
    });
    clientPromise = client.connect().catch((error) => {
      client = undefined;
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

export async function getDb() {
  const db = (await getMongoClient()).db(databaseName());
  await ensureIndexes(db);
  return db;
}

async function ensureIndexes(db) {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' }),
      db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'sessions_ttl' }),
      db.collection('sessions').createIndex({ userId: 1 }, { name: 'sessions_user_id' }),
      db.collection('kits').createIndex({ userId: 1, createdAt: -1 }, { name: 'kits_user_created' })
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }
  return indexesPromise;
}

export async function closeMongoClient() {
  if (client) await client.close();
  client = undefined;
  clientPromise = undefined;
  indexesPromise = undefined;
}