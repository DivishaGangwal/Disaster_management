import { getDb } from './db.js';
import { createBackend } from './server.js';

const db = getDb(process.env['DB_PATH']);   // defaults to ./dsm.db
const port = Number(process.env['PORT'] ?? 8787);

const backend = createBackend({ db, port });

void backend.listen(port).then((actual) => {
  process.stdout.write(`Disaster SOS Mesh backend listening on http://localhost:${actual}\n`);
  process.stdout.write(`Live probe (GTW-001): GET http://localhost:${actual}/health\n`);
  process.stdout.write(`API docs: http://localhost:${actual}/\n`);
  process.stdout.write(`Database: ${process.env['DB_PATH'] ?? 'dsm.db'}\n`);
  if (process.env['DEMO_MODE'] === 'true') {
    process.stdout.write('Demo mode: POST /demo/reset is enabled\n');
  }
});
