import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Ensure data directory exists
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'generic',  -- generic | snmp | mikrotik(legacy)
  host          TEXT NOT NULL,
  latitude      REAL,
  longitude     REAL,
  site          TEXT,
  snmp_community TEXT NOT NULL DEFAULT 'public',
  snmp_port     INTEGER NOT NULL DEFAULT 161,
  api_port      INTEGER,
  username      TEXT,
  password      TEXT,
  use_tls       INTEGER NOT NULL DEFAULT 0,
  poll_traffic  INTEGER NOT NULL DEFAULT 1,
  map_display_resource TEXT NOT NULL DEFAULT 'total_traffic',
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A "target" is a thing we watch: a ping host, TCP port, or SNMP interface.
CREATE TABLE IF NOT EXISTS targets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id     INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'ping',     -- ping | tcp | snmp_iface | mikrotik_iface(legacy)
  name          TEXT NOT NULL,
  host          TEXT,                             -- for ping targets
  port          INTEGER,                          -- for tcp targets
  iface         TEXT,                             -- for mikrotik interfaces
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Latest live state per target (single row, upserted constantly)
CREATE TABLE IF NOT EXISTS target_state (
  target_id     INTEGER PRIMARY KEY REFERENCES targets(id) ON DELETE CASCADE,
  status        TEXT,                  -- up | down | unknown
  link_up       INTEGER,              -- for interfaces: running flag
  rtt_ms        REAL,
  loss_pct      REAL,
  rx_bps        REAL,
  tx_bps        REAL,
  last_change   TEXT,                 -- when status last flipped
  updated_at    TEXT
);

-- Time-series samples for graphs (ping latency + interface traffic)
CREATE TABLE IF NOT EXISTS samples (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id     INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT,
  rtt_ms        REAL,
  loss_pct      REAL,
  rx_bps        REAL,
  tx_bps        REAL
);
CREATE INDEX IF NOT EXISTS idx_samples_target_ts ON samples(target_id, ts);

-- State-change events (for SLA + history timeline)
CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id     INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL,        -- up | down
  message       TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_target_ts ON events(target_id, ts);

CREATE TABLE IF NOT EXISTS device_links (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  from_device_id  INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  to_device_id    INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name            TEXT,
  cable_type      TEXT NOT NULL DEFAULT 'fiber',
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_device_id, to_device_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  user_name   TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   INTEGER,
  detail      TEXT,
  ip          TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
`);

// Lightweight schema migration for existing DB files.
const targetCols = db.prepare(`PRAGMA table_info(targets)`).all().map((c) => c.name);
if (!targetCols.includes('port')) {
  db.exec('ALTER TABLE targets ADD COLUMN port INTEGER');
}

const deviceCols = db.prepare(`PRAGMA table_info(devices)`).all().map((c) => c.name);
if (!deviceCols.includes('latitude')) {
  db.exec('ALTER TABLE devices ADD COLUMN latitude REAL');
}
if (!deviceCols.includes('longitude')) {
  db.exec('ALTER TABLE devices ADD COLUMN longitude REAL');
}
if (!deviceCols.includes('site')) {
  db.exec('ALTER TABLE devices ADD COLUMN site TEXT');
}
if (!deviceCols.includes('snmp_community')) {
  db.exec("ALTER TABLE devices ADD COLUMN snmp_community TEXT NOT NULL DEFAULT 'public'");
}
if (!deviceCols.includes('snmp_port')) {
  db.exec('ALTER TABLE devices ADD COLUMN snmp_port INTEGER NOT NULL DEFAULT 161');
}
if (!deviceCols.includes('map_display_resource')) {
  db.exec("ALTER TABLE devices ADD COLUMN map_display_resource TEXT NOT NULL DEFAULT 'total_traffic'");
}

export default db;
