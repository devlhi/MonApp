import { db } from './db.js';
import { config } from './config.js';

// ---------- Devices ----------
export const Devices = {
  all() {
    return db.prepare('SELECT * FROM devices ORDER BY name').all();
  },
  get(id) {
    return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  },
  enabled() {
    return db.prepare('SELECT * FROM devices WHERE enabled = 1').all();
  },
  create(d) {
    const stmt = db.prepare(`
      INSERT INTO devices (name, type, host, latitude, longitude, site, snmp_community, snmp_port, api_port, username, password, use_tls, poll_traffic, enabled)
      VALUES (@name, @type, @host, @latitude, @longitude, @site, @snmp_community, @snmp_port, @api_port, @username, @password, @use_tls, @poll_traffic, @enabled)
    `);
    const info = stmt.run({
      name: d.name,
      type: d.type || 'snmp',
      host: d.host,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      site: d.site ?? null,
      snmp_community: d.snmp_community || 'public',
      snmp_port: d.snmp_port ?? 161,
      api_port: d.api_port ?? config.mikrotikDefaultPort,
      username: d.username ?? null,
      password: d.password ?? null,
      use_tls: d.use_tls ? 1 : 0,
      poll_traffic: d.poll_traffic === false ? 0 : 1,
      enabled: d.enabled === false ? 0 : 1,
    });
    return this.get(info.lastInsertRowid);
  },
  update(id, d) {
    const cur = this.get(id);
    if (!cur) return null;
    db.prepare(`
      UPDATE devices SET
        name=@name, type=@type, host=@host, latitude=@latitude, longitude=@longitude, site=@site, snmp_community=@snmp_community, snmp_port=@snmp_port, api_port=@api_port,
        username=@username, password=@password, use_tls=@use_tls,
        poll_traffic=@poll_traffic, enabled=@enabled, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id,
      name: d.name ?? cur.name,
      type: d.type ?? cur.type,
      host: d.host ?? cur.host,
      latitude: d.latitude !== undefined ? d.latitude : cur.latitude,
      longitude: d.longitude !== undefined ? d.longitude : cur.longitude,
      site: d.site !== undefined ? d.site : cur.site,
      snmp_community: d.snmp_community ?? cur.snmp_community ?? 'public',
      snmp_port: d.snmp_port ?? cur.snmp_port ?? 161,
      api_port: d.api_port ?? cur.api_port,
      username: d.username ?? cur.username,
      password: d.password ?? cur.password,
      use_tls: d.use_tls != null ? (d.use_tls ? 1 : 0) : cur.use_tls,
      poll_traffic: d.poll_traffic != null ? (d.poll_traffic ? 1 : 0) : cur.poll_traffic,
      enabled: d.enabled != null ? (d.enabled ? 1 : 0) : cur.enabled,
    });
    return this.get(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM devices WHERE id = ?').run(id);
  },
  updateMapResource(id, resource) {
    return db.prepare('UPDATE devices SET map_display_resource = ? WHERE id = ?').run(resource, id);
  },
};

// ---------- Targets ----------
export const Targets = {
  all() {
    return db.prepare('SELECT * FROM targets ORDER BY name').all();
  },
  get(id) {
    return db.prepare('SELECT * FROM targets WHERE id = ?').get(id);
  },
  byDevice(deviceId) {
    return db.prepare('SELECT * FROM targets WHERE device_id = ?').all(deviceId);
  },
  enabled() {
    return db.prepare('SELECT * FROM targets WHERE enabled = 1').all();
  },
  create(t) {
    const info = db.prepare(`
      INSERT INTO targets (device_id, kind, name, host, port, iface, enabled)
      VALUES (@device_id, @kind, @name, @host, @port, @iface, @enabled)
    `).run({
      device_id: t.device_id ?? null,
      kind: t.kind || 'ping',
      name: t.name,
      host: t.host ?? null,
      port: t.port ?? null,
      iface: t.iface ?? null,
      enabled: t.enabled === false ? 0 : 1,
    });
    return this.get(info.lastInsertRowid);
  },
  update(id, t) {
    const cur = this.get(id);
    if (!cur) return null;
    db.prepare(`
      UPDATE targets SET
        device_id=@device_id, kind=@kind, name=@name, host=@host, port=@port, iface=@iface, enabled=@enabled
      WHERE id=@id
    `).run({
      id,
      device_id: t.device_id !== undefined ? t.device_id : cur.device_id,
      kind: t.kind ?? cur.kind,
      name: t.name ?? cur.name,
      host: t.host !== undefined ? t.host : cur.host,
      port: t.port !== undefined ? t.port : cur.port,
      iface: t.iface !== undefined ? t.iface : cur.iface,
      enabled: t.enabled != null ? (t.enabled ? 1 : 0) : cur.enabled,
    });
    return this.get(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM targets WHERE id = ?').run(id);
  },
};

// ---------- Device Links ----------
export const DeviceLinks = {
  all() {
    return db.prepare(`
      SELECT l.*, fd.name AS from_name, td.name AS to_name
      FROM device_links l
      JOIN devices fd ON fd.id = l.from_device_id
      JOIN devices td ON td.id = l.to_device_id
      ORDER BY COALESCE(l.name, fd.name || ' - ' || td.name)
    `).all();
  },
  enabled() {
    return db.prepare('SELECT * FROM device_links WHERE enabled = 1').all();
  },
  create(link) {
    const from = Number(link.from_device_id);
    const to = Number(link.to_device_id);
    if (!from || !to) throw new Error('Device asal dan tujuan wajib dipilih');
    if (from === to) throw new Error('Device asal dan tujuan tidak boleh sama');
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    const info = db.prepare(`
      INSERT OR IGNORE INTO device_links (from_device_id, to_device_id, name, cable_type, enabled)
      VALUES (@from_device_id, @to_device_id, @name, @cable_type, @enabled)
    `).run({
      from_device_id: a,
      to_device_id: b,
      name: link.name || null,
      cable_type: link.cable_type || 'fiber',
      enabled: link.enabled === false ? 0 : 1,
    });
    if (!info.changes) throw new Error('Link antar device sudah ada');
    return db.prepare('SELECT * FROM device_links WHERE id = ?').get(info.lastInsertRowid);
  },
  remove(id) {
    return db.prepare('DELETE FROM device_links WHERE id = ?').run(id);
  },
};

// ---------- State ----------
export const State = {
  all() {
    return db.prepare('SELECT * FROM target_state').all();
  },
  get(targetId) {
    return db.prepare('SELECT * FROM target_state WHERE target_id = ?').get(targetId);
  },
  upsert(targetId, s) {
    const prev = this.get(targetId);
    const statusChanged = prev && prev.status !== s.status;
    const lastChange = statusChanged || !prev ? new Date().toISOString() : prev.last_change;

    db.prepare(`
      INSERT INTO target_state (target_id, status, link_up, rtt_ms, loss_pct, rx_bps, tx_bps, last_change, updated_at)
      VALUES (@target_id, @status, @link_up, @rtt_ms, @loss_pct, @rx_bps, @tx_bps, @last_change, datetime('now'))
      ON CONFLICT(target_id) DO UPDATE SET
        status=@status, link_up=@link_up, rtt_ms=@rtt_ms, loss_pct=@loss_pct,
        rx_bps=@rx_bps, tx_bps=@tx_bps, last_change=@last_change, updated_at=datetime('now')
    `).run({
      target_id: targetId,
      status: s.status ?? null,
      link_up: s.link_up != null ? (s.link_up ? 1 : 0) : null,
      rtt_ms: s.rtt_ms ?? null,
      loss_pct: s.loss_pct ?? null,
      rx_bps: s.rx_bps ?? null,
      tx_bps: s.tx_bps ?? null,
      last_change: lastChange,
    });

    return { statusChanged: !!statusChanged, prevStatus: prev?.status };
  },
};

// ---------- Samples ----------
export const Samples = {
  insert(targetId, s) {
    db.prepare(`
      INSERT INTO samples (target_id, status, rtt_ms, loss_pct, rx_bps, tx_bps)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetId, s.status ?? null, s.rtt_ms ?? null, s.loss_pct ?? null, s.rx_bps ?? null, s.tx_bps ?? null);
  },
  recent(targetId, hours = 1) {
    return db.prepare(`
      SELECT ts, status, rtt_ms, loss_pct, rx_bps, tx_bps
      FROM samples
      WHERE target_id = ? AND ts >= datetime('now', ?)
      ORDER BY ts ASC
    `).all(targetId, `-${hours} hours`);
  },
  prune(days) {
    return db.prepare(`DELETE FROM samples WHERE ts < datetime('now', ?)`).run(`-${days} days`);
  },
};

// ---------- Events ----------
export const Events = {
  insert(targetId, status, message) {
    db.prepare('INSERT INTO events (target_id, status, message) VALUES (?, ?, ?)')
      .run(targetId, status, message ?? null);
  },
  recent(limit = 100) {
    return db.prepare(`
      SELECT e.*, t.name AS target_name
      FROM events e JOIN targets t ON t.id = e.target_id
      ORDER BY e.ts DESC LIMIT ?
    `).all(limit);
  },
  forTarget(targetId, limit = 50) {
    return db.prepare('SELECT * FROM events WHERE target_id = ? ORDER BY ts DESC LIMIT ?')
      .all(targetId, limit);
  },
  forDevice(deviceId, limit = 50) {
    return db.prepare(`
      SELECT e.*, t.name AS target_name
      FROM events e
      JOIN targets t ON t.id = e.target_id
      WHERE t.device_id = ?
      ORDER BY e.ts DESC LIMIT ?
    `).all(deviceId, limit);
  },
};

// ---------- SLA ----------
// Uptime % over a window, computed from samples (up samples / total samples).
export const Sla = {
  forTarget(targetId, hours) {
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up
      FROM samples
      WHERE target_id = ? AND ts >= datetime('now', ?)
    `).get(targetId, `-${hours} hours`);

    const total = row?.total || 0;
    const up = row?.up || 0;
    const uptime = total > 0 ? (up / total) * 100 : null;

    const avg = db.prepare(`
      SELECT AVG(rtt_ms) AS avg_rtt, AVG(loss_pct) AS avg_loss
      FROM samples
      WHERE target_id = ? AND ts >= datetime('now', ?) AND status = 'up'
    `).get(targetId, `-${hours} hours`);

    return {
      uptime_pct: uptime != null ? Number(uptime.toFixed(3)) : null,
      samples: total,
      avg_rtt_ms: avg?.avg_rtt != null ? Number(avg.avg_rtt.toFixed(2)) : null,
      avg_loss_pct: avg?.avg_loss != null ? Number(avg.avg_loss.toFixed(2)) : null,
    };
  },
};


// ---------- Settings ----------
export const Settings = {
  get(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },
  getAll() {
    const rows = db.prepare('SELECT * FROM settings').all();
    const out = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    }
    return out;
  },
  set(key, value) {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, v);
  },
  remove(key) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  },
};

// ---------- Users ----------
export const Users = {
  all() {
    return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all();
  },
  get(id) {
    return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
  },
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },
  create({ username, password_hash, role = 'noc' }) {
    const info = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, password_hash, role);
    return this.get(info.lastInsertRowid);
  },
  updatePassword(id, password_hash) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
    return this.get(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

// ---------- Audit Log ----------
export const Audit = {
  log(action, { user, entity, entityId, detail, ip } = {}) {
    db.prepare(`INSERT INTO audit_log (user_name, action, entity, entity_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(user || 'system', action, entity || null, entityId || null, detail || null, ip || null);
  },
  all({ limit = 200, offset = 0, action, entity, search } = {}) {
    let sql = `SELECT * FROM audit_log WHERE 1=1`;
    const params = [];
    if (action) { sql += ` AND action = ?`; params.push(action); }
    if (entity) { sql += ` AND entity = ?`; params.push(entity); }
    if (search) { sql += ` AND (detail LIKE ? OR user_name LIKE ? OR entity LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ` ORDER BY ts DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  },
  count({ action, entity, search } = {}) {
    let sql = `SELECT COUNT(*) as total FROM audit_log WHERE 1=1`;
    const params = [];
    if (action) { sql += ` AND action = ?`; params.push(action); }
    if (entity) { sql += ` AND entity = ?`; params.push(entity); }
    if (search) { sql += ` AND (detail LIKE ? OR user_name LIKE ? OR entity LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    return db.prepare(sql).get(...params).total;
  },
  recent(limit = 20) {
    return db.prepare(`SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?`).all(limit);
  },
  actions() {
    return db.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all().map(r => r.action);
  },
};
