import 'dotenv/config';
import { app } from './app.js';
import { closeMongoClient } from './db/mongo.js';

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => console.log('API listening on port ' + port));

async function shutdown(signal) {
  console.log(signal + ' received; closing server');
  server.close(async () => {
    await closeMongoClient();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));