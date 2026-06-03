import crypto from 'node:crypto';
import { db } from './db.js';

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function ensureDefaultAdmin() {
  // Ensure admin user
  const adminRow = db.prepare("SELECT COUNT(*) AS c FROM users WHERE username = 'admin'").get();
  if ((adminRow?.c || 0) === 0) {
    const passwordHash = hashPassword('admin123');
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run('admin', passwordHash, 'admin');
    console.log('Default login created -> username: admin, password: admin123');
  }

  // Ensure noc user
  const nocRow = db.prepare("SELECT COUNT(*) AS c FROM users WHERE username = 'noc'").get();
  if ((nocRow?.c || 0) === 0) {
    const passwordHash = hashPassword('noc123');
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run('noc', passwordHash, 'noc');
    console.log('Default NOC login created -> username: noc, password: noc123');
  }
}
