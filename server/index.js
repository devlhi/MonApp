import express from 'express';
import compression from 'compression';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';

import { config } from './config.js';
import { buildRouter } from './routes.js';
import { MonitorEngine } from './monitor.js';
import { Targets, State, Events } from './repo.js';
import { ensureDefaultAdmin } from './seed.js';
import { verifyToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vueDistDir = path.resolve(config.root, 'web', 'dist');
const legacyPublicDir = path.resolve(config.root, 'public');
const publicDir = fs.existsSync(vueDistDir) ? vueDistDir : legacyPublicDir;

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(compression());
app.use(express.json());

ensureDefaultAdmin();

// Monitor engine emits straight to socket.io rooms
const engine = new MonitorEngine((event, payload) => io.emit(event, payload));

app.use('/api', buildRouter(engine));

// Serve Leaflet static assets from node_modules when using built frontend.
app.use('/leaflet', express.static(path.resolve(config.root, 'node_modules', 'leaflet', 'dist')));

app.use(express.static(publicDir));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

io.on('connection', (socket) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return socket.disconnect(true);
    verifyToken(token);
  } catch {
    return socket.disconnect(true);
  }

  // Send current snapshot on connect
  socket.emit('snapshot', {
    targets: Targets.all(),
    states: State.all(),
    events: Events.recent(50),
  });
});

server.listen(config.port, config.host, () => {
  console.log(`\n  AppMon running at http://${config.host}:${config.port}\n`);
  engine.start();
});

function shutdown() {
  console.log('\nShutting down...');
  engine.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
