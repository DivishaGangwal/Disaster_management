import { resolve } from 'node:path';
import { DEPLOYMENT } from '@dsm/contracts';
import { createBackend } from '../apps/backend/dist/server.js';

const dbPath = process.env['DSM_DATABASE_PATH'] ?? resolve('/tmp', DEPLOYMENT.defaultDatabaseFile);

const instance = createBackend({
  databasePath: dbPath,
});

export default function handler(req: any, res: any) {
  instance.server.emit('request', req, res);
}
