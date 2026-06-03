import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  root,
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  dbPath: path.resolve(root, process.env.DB_PATH || './data/appmon.db'),
  pingInterval: int(process.env.PING_INTERVAL, 5000),
  mikrotikInterval: int(process.env.MIKROTIK_INTERVAL, 5000),
  pingTimeout: int(process.env.PING_TIMEOUT, 2),
  pingCount: int(process.env.PING_COUNT, 1),
  slaWindowHours: int(process.env.SLA_WINDOW_HOURS, 24),
  historyRetentionDays: int(process.env.HISTORY_RETENTION_DAYS, 30),
  mikrotikDefaultPort: int(process.env.MIKROTIK_DEFAULT_PORT, 8728),
};
