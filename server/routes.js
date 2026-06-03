import express from 'express';
import { DeviceLinks, Devices, Targets, State, Samples, Events, Sla, Users, Settings, Audit } from './repo.js';
import { MikrotikClient } from './mikrotik.js';
import { SnmpClient } from './snmp.js';
import { config } from './config.js';
import { authRequired, signUser, adminRequired } from './auth.js';
import { hashPassword } from './seed.js';

export function buildRouter(engine) {
  const r = express.Router();

  // ---------- Auth ----------
  r.post('/auth/login', (req, res) => {
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const user = Users.findByUsername(username);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const passHash = hashPassword(password);
    if (passHash !== user.password_hash) {
      Audit.log('login_failed', { user: username, ip: req.ip, detail: 'Failed login attempt' });
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token = signUser(user);
    Audit.log('login', { user: username, ip: req.ip, detail: 'User logged in' });
    return res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  r.get('/auth/me', authRequired, (req, res) => {
    res.json({ user: req.user });
  });

  // Protected routes below
  r.use(authRequired);

  // ---------- Dashboard summary ----------
  r.get('/summary', (req, res) => {
    const targets = Targets.all();
    const states = new Map(State.all().map((s) => [s.target_id, s]));
    let up = 0, down = 0, unknown = 0;
    for (const t of targets) {
      const st = states.get(t.id);
      if (!st || st.status == null) unknown++;
      else if (st.status === 'up') up++;
      else down++;
    }
    res.json({
      devices: Devices.all().length,
      targets: targets.length,
      up, down, unknown,
    });
  });

  // ---------- Devices ----------
  r.get('/devices', (req, res) => res.json(Devices.all()));

  r.post('/devices', adminRequired, (req, res) => {
    try {
      const d = Devices.create(req.body);
      Targets.create({
        device_id: d.id,
        kind: 'ping',
        name: `${d.name} Ping`,
        host: d.host,
        enabled: true,
      });
      Audit.log('device_create', { user: req.user?.username, entity: 'device', entityId: d.id, detail: d.name, ip: req.ip });
      res.status(201).json(d);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/devices/:id', adminRequired, (req, res) => {
    const d = Devices.update(Number(req.params.id), req.body);
    if (!d) return res.status(404).json({ error: 'not found' });
    Audit.log('device_update', { user: req.user?.username, entity: 'device', entityId: d.id, detail: d.name, ip: req.ip });
    res.json(d);
  });

  r.delete('/devices/:id', adminRequired, (req, res) => {
    Devices.remove(Number(req.params.id));
    Audit.log('device_delete', { user: req.user?.username, entity: 'device', entityId: Number(req.params.id), ip: req.ip });
    res.status(204).end();
  });

  // Test connection + list interfaces of a mikrotik device (by id or ad-hoc body)
  r.post('/devices/test', async (req, res) => {
    const device = req.body;
    if ((device.type || 'snmp') === 'snmp') {
      const client = new SnmpClient(device);
      try {
        const probe = await client.probe();
        if (!probe.ok) return res.status(400).json(probe);
        return res.json({
          ok: true,
          identity: probe.system.name,
          system: probe.system,
          readable_oids: probe.readable_oids,
          interfaces: probe.interfaces.map((i) => ({
            index: i.index,
            name: i.name,
            descr: i.descr,
            type: i.type,
            running: i.running,
            disabled: i.disabled,
            comment: i.comment,
            speed_bps: i.speed_bps,
            mtu: i.mtu,
            rx_bps: i.rx_bps,
            tx_bps: i.tx_bps,
            in_errors: i.in_errors,
            out_errors: i.out_errors,
          })),
        });
      } catch (e) {
        return res.status(400).json({ ok: false, error: e.message });
      }
    }

    const client = new MikrotikClient({
      ...device,
      api_port: device.api_port || config.mikrotikDefaultPort,
    });
    try {
      const identity = await client.identity();
      const interfaces = await client.getInterfaces();
      await client.close();
      res.json({
        ok: true,
        identity,
        interfaces: interfaces.map((i) => ({
          name: i.name, type: i.type, running: i.running, comment: i.comment,
        })),
      });
    } catch (e) {
      await client.close();
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  r.put('/devices/:id/map-resource', adminRequired, (req, res) => {
    const d = Devices.get(Number(req.params.id));
    if (!d) return res.status(404).json({ error: 'not found' });
    const resource = req.body?.resource || 'total_traffic';
    Devices.updateMapResource(d.id, resource);
    res.json({ ok: true });
  });

  r.get('/devices/:id/interfaces', async (req, res) => {
    const device = Devices.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'not found' });
    try {
      const interfaces = await engine.listInterfaces(device);
      res.json(interfaces.map((i) => ({
        index: i.index,
        name: i.name,
        descr: i.descr,
        type: i.type,
        running: i.running,
        disabled: i.disabled,
        comment: i.comment,
        speed_bps: i.speed_bps,
        mtu: i.mtu,
        rx_bps: i.rx_bps,
        tx_bps: i.tx_bps,
        in_errors: i.in_errors,
        out_errors: i.out_errors,
      })));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.get('/devices/:id/snmp-diagnose', async (req, res) => {
    const device = Devices.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'not found' });
    if (device.type !== 'snmp') return res.status(400).json({ error: 'device bukan SNMP' });

    try {
      const client = new SnmpClient(device);
      res.json(await client.diagnose());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.get('/devices/:id/smart-oid-scan', async (req, res) => {
    const device = Devices.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'not found' });
    if (device.type !== 'snmp') return res.status(400).json({ error: 'device bukan SNMP' });

    try {
      const client = new SnmpClient(device);
      res.json(await client.smartOidScan());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/devices/:id/auto-targets', adminRequired, async (req, res) => {
    const device = Devices.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'not found' });

    const created = [];
    const warnings = [];
    const existing = Targets.all();
    const hasPing = existing.some((t) => t.kind === 'ping' && (Number(t.device_id) === Number(device.id) || t.host === device.host));
    if (!hasPing) {
      created.push(Targets.create({
        device_id: device.id,
        kind: 'ping',
        name: `${device.name} Ping`,
        host: device.host,
        enabled: true,
      }));
    }

    if (device.type === 'snmp') {
      try {
        const interfaces = await engine.listInterfaces(device);
        if (device.type === 'snmp' && interfaces.length === 0) {
          warnings.push('SNMP interface belum terbaca. Status ping tetap aktif; traffic akan muncul setelah RouterOS SNMP interface table bisa dibaca.');
          return res.status(201).json({ created, count: created.length, warnings });
        }
        const selected = interfaces
          .filter((i) => i.name && !i.disabled && !['loopback', 'bridge'].includes(String(i.type || '').toLowerCase()))
          .slice(0, Number(req.body?.limit) || 8);

        for (const iface of selected) {
          const exists = existing.some((t) => t.kind === 'snmp_iface' && Number(t.device_id) === Number(device.id) && t.iface === iface.name);
          if (exists) continue;
          created.push(Targets.create({
            kind: 'snmp_iface',
            name: `${device.name} ${iface.name}`,
            device_id: device.id,
            iface: iface.name,
            enabled: true,
          }));
        }
      } catch (e) {
        warnings.push(`SNMP belum bisa dibaca: ${e.message}. Status ping tetap aktif.`);
        return res.status(201).json({ created, count: created.length, warnings });
      }
    }

    res.status(201).json({ created, count: created.length, warnings });
  });

  r.get('/devices/:id/events', (req, res) => {
    const device = Devices.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'not found' });
    try {
      const events = Events.forDevice(device.id, 50);
      res.json(events);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- Targets ----------
  r.get('/targets', (req, res) => {
    const targets = Targets.all();
    const states = new Map(State.all().map((s) => [s.target_id, s]));
    const devices = new Map(Devices.all().map((d) => [d.id, d]));
    const enriched = targets.map((t) => ({
      ...t,
      device_name: t.device_id ? devices.get(t.device_id)?.name : null,
      state: states.get(t.id) || null,
      sla: Sla.forTarget(t.id, config.slaWindowHours),
    }));
    res.json(enriched);
  });

  r.post('/targets', adminRequired, (req, res) => {
    try {
      res.status(201).json(Targets.create(req.body));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/targets/:id', adminRequired, (req, res) => {
    const t = Targets.update(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: 'not found' });
    res.json(t);
  });

  r.delete('/targets/:id', adminRequired, (req, res) => {
    Targets.remove(Number(req.params.id));
    res.status(204).end();
  });

  // ---------- History / graphs ----------
  r.get('/targets/:id/history', (req, res) => {
    const hours = Number(req.query.hours) || 1;
    res.json(Samples.recent(Number(req.params.id), hours));
  });

  r.get('/targets/:id/sla', (req, res) => {
    const hours = Number(req.query.hours) || config.slaWindowHours;
    res.json(Sla.forTarget(Number(req.params.id), hours));
  });

  r.get('/targets/:id/events', (req, res) => {
    res.json(Events.forTarget(Number(req.params.id), Number(req.query.limit) || 50));
  });

  // ---------- Events feed ----------
  r.get('/events', (req, res) => {
    res.json(Events.recent(Number(req.query.limit) || 100));
  });

  // ---------- SLA table ----------
  r.get('/sla', (req, res) => {
    const hours = Number(req.query.hours) || config.slaWindowHours;
    const rows = Targets.all().map((t) => ({
      ...t,
      sla: Sla.forTarget(t.id, hours),
    }));
    res.json(rows);
  });

  // ---------- Map markers ----------
  r.get('/links', (req, res) => res.json(DeviceLinks.all()));

  r.post('/links', adminRequired, (req, res) => {
    try {
      res.status(201).json(DeviceLinks.create(req.body));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.delete('/links/:id', adminRequired, (req, res) => {
    DeviceLinks.remove(Number(req.params.id));
    res.status(204).end();
  });

  r.get('/map/devices', async (req, res) => {
    const devices = Devices.all().filter(
      (d) => d.latitude != null && d.longitude != null
    );

    const states = new Map(State.all().map((s) => [s.target_id, s]));
    const byDevice = new Map();
    const trafficByDevice = new Map();
    const interfacesByDevice = new Map();
    for (const t of Targets.all()) {
      if (!t.device_id) continue;
      const st = states.get(t.id);
      if (!byDevice.has(t.device_id)) byDevice.set(t.device_id, []);
      byDevice.get(t.device_id).push(st?.status || 'unknown');

      if (t.kind === 'snmp_iface' && st) {
        const cur = trafficByDevice.get(t.device_id) || { rx_bps: 0, tx_bps: 0, interfaces: 0 };
        cur.rx_bps += Number(st.rx_bps || 0);
        cur.tx_bps += Number(st.tx_bps || 0);
        cur.interfaces += 1;
        trafficByDevice.set(t.device_id, cur);

        const arr = interfacesByDevice.get(t.device_id) || [];
        arr.push({
          target_id: t.id,
          name: t.iface,
          status: st.status || 'unknown',
          rx_bps: Number(st.rx_bps || 0),
          tx_bps: Number(st.tx_bps || 0),
          link_up: !!st.link_up,
          sfp_power: null,
          updated_at: st.updated_at,
        });
        interfacesByDevice.set(t.device_id, arr);
      }
    }

    // Merge SFP optical power from SNMP cache using interface index
    for (const d of devices) {
      if (d.type !== 'snmp') continue;
      let sfpClient = engine.snmpClients?.get(d.id);
      if (!sfpClient) {
        sfpClient = engine.getSnmpClient(d);
      }
      if (!sfpClient.sfpCache || sfpClient.sfpCache.size === 0) {
        await sfpClient.getSfpPower().catch(() => null);
      }
      if (!sfpClient?.sfpCache?.size) continue;
      const ifaces = interfacesByDevice.get(d.id) || [];
      // Use cached name→index map from last poll cycle
      const ifaceNameToIndex = sfpClient.ifaceNameToIndex;
      if (!ifaceNameToIndex) continue;
      // Build reverse map: ifIndex → name for SFP discovery
      const indexToName = new Map();
      for (const [n, i] of ifaceNameToIndex) indexToName.set(i, n);

      const existingNames = new Set(ifaces.map(i => i.name));

      // Merge SFP data into existing targeted interfaces
      for (const iface of ifaces) {
        const idx = ifaceNameToIndex.get(iface.name);
        if (idx != null && sfpClient.sfpCache.has(idx)) {
          iface.sfp_power = sfpClient.sfpCache.get(idx);
        }
      }

      // Auto-discover SFP interfaces that have no explicit target yet
      for (const [idx, sfpEntry] of sfpClient.sfpCache) {
        const sfpName = sfpEntry.name || indexToName.get(idx);
        if (!sfpName || existingNames.has(sfpName)) continue;
        if (sfpEntry.tx == null && sfpEntry.rx == null) continue;
        ifaces.push({
          target_id: null,
          name: sfpName,
          status: 'up',
          rx_bps: 0,
          tx_bps: 0,
          link_up: true,
          sfp_power: sfpEntry,
          updated_at: new Date().toISOString(),
        });
        existingNames.add(sfpName);
      }
      interfacesByDevice.set(d.id, ifaces);
    }

    const markers = devices.map((d) => {
      const arr = byDevice.get(d.id) || [];
      const status = arr.length === 0
        ? 'unknown'
        : arr.includes('down') ? 'down' : arr.includes('up') ? 'up' : 'unknown';
      const cachedRes = engine.resourceCache ? engine.resourceCache.get(d.id) : null;
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        host: d.host,
        site: d.site,
        latitude: d.latitude,
        longitude: d.longitude,
        status,
        traffic: trafficByDevice.get(d.id) || { rx_bps: 0, tx_bps: 0, interfaces: 0 },
        interfaces: interfacesByDevice.get(d.id) || [],
        map_display_resource: d.map_display_resource || 'total_traffic',
        cpu_pct: cachedRes?.cpu_pct ?? null,
        mem_pct: cachedRes?.mem_pct ?? null,
      };
    });

    const cableLinks = [];
    const markerById = new Map(markers.map((m) => [m.id, m]));
    const manualLinks = DeviceLinks.enabled();

    // Pre-compute targets and events once — avoid N×DB queries inside the loop
    const allTargets = Targets.all();
    const targetsByDevice = new Map();
    for (const t of allTargets) {
      if (!t.device_id) continue;
      if (!targetsByDevice.has(t.device_id)) targetsByDevice.set(t.device_id, []);
      targetsByDevice.get(t.device_id).push(t.id);
    }
    const allRecentEvents = Events.recent(200);

    for (const l of manualLinks) {
      const from = markerById.get(l.from_device_id);
      const to = markerById.get(l.to_device_id);
      if (!from || !to) continue;
      const rx = Number(from.traffic?.rx_bps || 0) + Number(to.traffic?.rx_bps || 0);
      const tx = Number(from.traffic?.tx_bps || 0) + Number(to.traffic?.tx_bps || 0);
      const status = [from.status, to.status].includes('down') ? 'down'
        : [from.status, to.status].includes('up') ? 'up'
        : 'unknown';
      
      // Get recent events for both devices — use pre-computed maps
      const fromTargetIds = targetsByDevice.get(from.id) || [];
      const toTargetIds = targetsByDevice.get(to.id) || [];
      const linkTargetSet = new Set([...fromTargetIds, ...toTargetIds]);
      const recentEvents = allRecentEvents.filter(e => linkTargetSet.has(e.target_id)).slice(0, 5);
      
      // Get SFP power from interfaces
      const fromSfp = from.interfaces.map(i => ({ name: i.name, power: i.sfp_power, status: i.status }));
      const toSfp = to.interfaces.map(i => ({ name: i.name, power: i.sfp_power, status: i.status }));
      
      cableLinks.push({
        id: `manual-${l.id}`,
        link_id: l.id,
        name: l.name || `${from.name} ⇄ ${to.name}`,
        cable_type: l.cable_type || 'fiber',
        from_id: from.id,
        to_id: to.id,
        from_name: from.name,
        to_name: to.name,
        from: [from.latitude, from.longitude],
        to: [to.latitude, to.longitude],
        site: from.site || to.site || null,
        status,
        rx_bps: rx,
        tx_bps: tx,
        total_bps: rx + tx,
        events: recentEvents,
        sfp_from: fromSfp,
        sfp_to: toSfp,
      });
    }

    res.json({ devices: markers, links: cableLinks });
  });

  // ---------- Settings (AI + Telegram config) ----------
  r.get('/settings', (req, res) => {
    res.json(Settings.getAll());
  });

  r.get('/settings/:key', (req, res) => {
    const val = Settings.get(req.params.key);
    if (val === null) return res.status(404).json({ error: 'not found' });
    res.json({ key: req.params.key, value: val });
  });

  r.put('/settings', adminRequired, (req, res) => {
    const body = req.body || {};
    for (const [k, v] of Object.entries(body)) {
      Settings.set(k, v);
    }
    res.json(Settings.getAll());
  });

  r.put('/settings/:key', adminRequired, (req, res) => {
    Settings.set(req.params.key, req.body?.value ?? req.body);
    res.json({ key: req.params.key, value: Settings.get(req.params.key) });
  });

  r.delete('/settings/:key', adminRequired, (req, res) => {
    Settings.remove(req.params.key);
    res.status(204).end();
  });

  // ---------- Telegram Test ----------
  r.post('/telegram/test', adminRequired, async (req, res) => {
    const cfg = Settings.get('telegram_settings') || {};
    const token = req.body?.bot_token || cfg.bot_token;
    const chatId = req.body?.chat_id || cfg.chat_id;
    if (!token || !chatId) return res.status(400).json({ error: 'bot_token dan chat_id wajib diisi' });

    const message = req.body?.message || `✅ *AppMon Test*\nServer: ${config.host}\nWaktu: ${new Date().toLocaleString('id-ID')}\n\nTelegram webhook berhasil terhubung.`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API error');
      res.json({ ok: true, message: 'Pesan terkirim ke Telegram', data: data.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- Telegram SFP Alert Check ----------
  r.post('/telegram/alert-sfp', adminRequired, async (req, res) => {
    const cfg = Settings.get('telegram_settings') || {};
    const alertRules = Settings.get('telegram_settings') || {};
    if (!cfg.bot_token || !cfg.chat_id) return res.status(400).json({ error: 'Telegram belum dikonfigurasi' });

    const devices = Devices.all();
    const alerts = [];

    for (const device of devices) {
      if (device.type !== 'snmp') continue;
      try {
        const client = new SnmpClient(device);
        const sfpResult = await client.smartOidScan();
        const sfpData = sfpResult.results?.find((r) => r.group === 'sfp');
        if (sfpData?.ok && alertRules.alert_sfp_low_power) {
          alerts.push({ device: device.name, host: device.host, type: 'sfp', status: 'readable', detail: `${sfpData.rows} SFP entries found` });
        }
        const trafficData = sfpResult.results?.filter((r) => r.group === 'traffic');
        const downInterfaces = sfpResult.results?.filter((r) => r.group === 'interface' && !r.ok);
        if (downInterfaces?.length && alertRules.alert_interface_down) {
          alerts.push({ device: device.name, host: device.host, type: 'interface', status: 'missing', detail: `${downInterfaces.length} OID interface tidak terbaca` });
        }
      } catch {
        if (alertRules.alert_snmp_timeout) {
          alerts.push({ device: device.name, host: device.host, type: 'snmp_timeout', status: 'timeout', detail: 'SNMP timeout' });
        }
        continue;
      }
    }

    if (!alerts.length) return res.json({ ok: true, sent: false, message: 'Tidak ada alert yang perlu dikirim' });

    const lines = alerts.map((a) => `⚠️ *${a.device}* (${a.host})\n   Type: ${a.type} | Status: ${a.status}\n   ${a.detail}`).join('\n\n');
    const message = `🔔 *AppMon Alert*\n${new Date().toLocaleString('id-ID')}\n\n${lines}`;

    try {
      const url = `https://api.telegram.org/bot${cfg.bot_token}/sendMessage`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.chat_id, text: message, parse_mode: 'Markdown' }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API error');
      res.json({ ok: true, sent: true, alerts, data: data.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- Telegram Webhook Config ----------
  r.post('/telegram/set-webhook', adminRequired, async (req, res) => {
    const cfg = Settings.get('telegram_settings') || {};
    const token = cfg.bot_token;
    const { url: webhookUrl } = req.body;
    if (!token) return res.status(400).json({ error: 'Token bot belum dikonfigurasi' });
    if (!webhookUrl) return res.status(400).json({ error: 'URL Webhook wajib diisi' });

    try {
      const url = `https://api.telegram.org/bot${token}/setWebhook`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API error');
      res.json({ ok: true, message: 'Webhook berhasil dipasang', data: data.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/telegram/unset-webhook', adminRequired, async (req, res) => {
    const cfg = Settings.get('telegram_settings') || {};
    const token = cfg.bot_token;
    if (!token) return res.status(400).json({ error: 'Token bot belum dikonfigurasi' });

    try {
      const url = `https://api.telegram.org/bot${token}/deleteWebhook`;
      const resp = await fetch(url, { method: 'POST' });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API error');
      res.json({ ok: true, message: 'Webhook berhasil dihapus', data: data.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/telegram/set-commands', adminRequired, async (req, res) => {
    const cfg = Settings.get('telegram_settings') || {};
    const token = cfg.bot_token;
    if (!token) return res.status(400).json({ error: 'Token bot belum dikonfigurasi' });

    try {
      const url = `https://api.telegram.org/bot${token}/setMyCommands`;
      const commands = [
        { command: 'cekredaman', description: 'Cek power SFP (Redaman) pada Router/Switch' }
      ];
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API error');
      res.json({ ok: true, message: 'Menu bot berhasil diupdate', data: data.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- Telegram Webhook Endpoint ----------
  const telegramSessions = new Map();

  async function sendTelegramMsg(token, chatId, text, replyMarkup = null) {
    const payload = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  r.post('/telegram/webhook', async (req, res) => {
    res.json({ ok: true }); // Always acknowledge to Telegram immediately
    const update = req.body;
    if (!update) return;

    const cfg = Settings.get('telegram_settings') || {};
    const token = cfg.bot_token;
    if (!token) return;

    try {
      if (update.message && update.message.text) {
        const text = update.message.text;
        const chatId = update.message.chat.id;

        if (text.startsWith('/cekredaman')) {
          const snmpDevices = Devices.all().filter(d => d.type === 'snmp');
          if (snmpDevices.length === 0) {
            await sendTelegramMsg(token, chatId, 'Belum ada perangkat SNMP yang didaftarkan.');
            return;
          }

          const keyboard = snmpDevices.map(d => ([{ text: d.name, callback_data: `cek_router_${d.id}` }]));
          telegramSessions.set(chatId, { step: 'select_router' });

          await sendTelegramMsg(token, chatId, 'Pilih Router/Switch:', { inline_keyboard: keyboard });
        }
      } else if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        const data = cb.data;

        // Acknowledge callback
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cb.id }),
        });

        if (data.startsWith('cek_router_')) {
          const deviceId = Number(data.replace('cek_router_', ''));
          const device = Devices.get(deviceId);
          if (!device) return await sendTelegramMsg(token, chatId, 'Device tidak ditemukan.');

          await sendTelegramMsg(token, chatId, `Mengambil daftar port untuk *${device.name}*...`);

          try {
            let sfpClient = engine.snmpClients?.get(device.id);
            if (!sfpClient) {
              sfpClient = new SnmpClient(device);
            }
            const sfpPower = await sfpClient.getSfpPower();
            if (!sfpPower || sfpPower.size === 0) {
              await sendTelegramMsg(token, chatId, `Tidak ada modul SFP yang terdeteksi di *${device.name}*.`);
              return;
            }

            const keyboard = [];
            for (const [idx, sfp] of sfpPower.entries()) {
              const name = sfp.name || `Port ${idx}`;
              keyboard.push([{ text: name, callback_data: `cek_port_${device.id}_${idx}` }]);
            }

            telegramSessions.set(chatId, { step: 'select_port', deviceId });
            await sendTelegramMsg(token, chatId, `SFP ditemukan. Pilih port:`, { inline_keyboard: keyboard });
          } catch (err) {
            await sendTelegramMsg(token, chatId, `Gagal membaca SNMP: ${err.message}`);
          }
        } else if (data.startsWith('cek_port_')) {
          const parts = data.split('_');
          const deviceId = Number(parts[2]);
          const portIdx = Number(parts[3]);

          const device = Devices.get(deviceId);
          if (!device) return await sendTelegramMsg(token, chatId, 'Device tidak ditemukan.');

          let sfpClient = engine.snmpClients?.get(device.id);
          if (!sfpClient) {
            sfpClient = new SnmpClient(device);
          }

          await sendTelegramMsg(token, chatId, `Membaca power SFP...`);
          try {
            const sfpPower = await sfpClient.getSfpPower();
            const sfp = sfpPower.get(portIdx);

            if (!sfp) {
              await sendTelegramMsg(token, chatId, 'Data SFP tidak ditemukan untuk port ini.');
              return;
            }

            const rx = sfp.rx != null ? `${sfp.rx.toFixed(2)} dBm` : 'N/A';
            const tx = sfp.tx != null ? `${sfp.tx.toFixed(2)} dBm` : 'N/A';

            const msg = `📊 *Hasil Redaman SFP*\n\n` +
                        `Router: *${device.name}*\n` +
                        `Port: *${sfp.name || portIdx}*\n` +
                        `Tx Power: *${tx}*\n` +
                        `Rx Power: *${rx}*`;

            await sendTelegramMsg(token, chatId, msg);
            telegramSessions.delete(chatId);
          } catch (err) {
            await sendTelegramMsg(token, chatId, `Gagal membaca SFP: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error('Telegram webhook error:', err);
    }
  });

  // ---------- Audit Log ----------
  r.get('/audit-log', (req, res) => {
    const { limit = 200, offset = 0, action, entity, search } = req.query;
    const rows = Audit.all({
      limit: Math.min(Number(limit) || 200, 1000),
      offset: Number(offset) || 0,
      action: action || null,
      entity: entity || null,
      search: search || null,
    });
    const total = Audit.count({ action: action || null, entity: entity || null, search: search || null });
    res.json({ rows, total });
  });

  r.get('/audit-log/actions', (req, res) => {
    const rows = Audit.actions();
    res.json(rows);
  });

  // ---------- User Management (admin only) ----------
  r.get('/users', adminRequired, (req, res) => {
    res.json(Users.all());
  });

  r.post('/users', adminRequired, (req, res) => {
    const { username, password, role = 'noc' } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username dan password wajib diisi' });
    if (!['admin', 'noc'].includes(role)) return res.status(400).json({ error: 'role harus admin atau noc' });
    const existing = Users.findByUsername(username);
    if (existing) return res.status(409).json({ error: 'username sudah dipakai' });
    const password_hash = hashPassword(password);
    try {
      const user = Users.create({ username, password_hash, role });
      Audit.log('user_create', { user: req.user?.username, entity: 'user', entityId: user.id, detail: `${username} (${role})`, ip: req.ip });
      res.status(201).json(user);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/users/:id/password', adminRequired, (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password wajib diisi' });
    const user = Users.get(id);
    if (!user) return res.status(404).json({ error: 'user tidak ditemukan' });
    const password_hash = hashPassword(password);
    const updated = Users.updatePassword(id, password_hash);
    Audit.log('user_change_password', { user: req.user?.username, entity: 'user', entityId: id, detail: user.username, ip: req.ip });
    res.json(updated);
  });

  r.delete('/users/:id', adminRequired, (req, res) => {
    const id = Number(req.params.id);
    if (id === Number(req.user?.sub)) return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
    const user = Users.get(id);
    if (!user) return res.status(404).json({ error: 'user tidak ditemukan' });
    Users.remove(id);
    Audit.log('user_delete', { user: req.user?.username, entity: 'user', entityId: id, detail: user.username, ip: req.ip });
    res.status(204).end();
  });

  return r;
}
