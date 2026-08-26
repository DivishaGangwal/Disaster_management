import { resolve } from 'node:path';
import { DEPLOYMENT } from '@dsm/contracts';
import { createBackend } from './server.js';

const backend = createBackend({
  databasePath: process.env['DSM_DATABASE_PATH'] ?? resolve(process.cwd(), 'data', DEPLOYMENT.defaultDatabaseFile),
});
const port = Number(process.env['PORT'] ?? 8787);
void backend.listen(port).then((actual) => {
  process.stdout.write(`Disaster SOS Mesh backend listening on http://localhost:${actual}\n`);
  process.stdout.write('Probe endpoint for gateway proof: GET /health\n');
});
