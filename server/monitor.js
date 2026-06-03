import ping from 'ping';
import net from 'node:net';
import { config } from './config.js';
import { Devices, Targets, State, Samples, Events } from './repo.js';
import { MikrotikClient } from './mikrotik.js';
import { SnmpClient } from './snmp.js';

/**
 * MonitorEngine drives all polling loops and pushes updates through an emitter.
 * emit(event, payload) is supplied by the server (socket.io).
 */
export class MonitorEngine {
  constructor(emit) {
    this.emit = emit || (() => {});
    this.mtClients = new Map(); // device_id -> MikrotikClient
    this.snmpClients = new Map(); // device_id -> SnmpClient
    this.resourceCache = new Map(); // device_id -> { cpu_pct, mem_pct }
    this.timers = [];
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    // Stagger loops slightly
    this.timers.push(setInterval(() => this.runPingCycle(), config.pingInterval));
    this.timers.push(setInterval(() => this.runSnmpCycle(), config.mikrotikInterval));
    this.timers.push(setInterval(() => this.runMikrotikCycle(), config.mikrotikInterval));
    // Daily prune
    this.timers.push(setInterval(() => Samples.prune(config.historyRetentionDays), 24 * 3600 * 1000));
    // Kick off immediately
    this.runPingCycle();
    this.runSnmpCycle();
    this.runMikrotikCycle();
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    for (const c of this.mtClients.values()) c.close();
    this.mtClients.clear();
    this.snmpClients.clear();
  }

  // ---- shared state writer ----
  applyResult(target, sample) {
    const { statusChanged, prevStatus } = State.upsert(target.id, sample);
    Samples.insert(target.id, sample);

    if (statusChanged && prevStatus) {
      const msg = sample.status === 'up'
        ? `${target.name} recovered`
        : `${target.name} went down`;
      Events.insert(target.id, sample.status, msg);
      this.emit('event', {
        target_id: target.id,
        target_name: target.name,
        status: sample.status,
        message: msg,
        ts: new Date().toISOString(),
      });
    }

    this.emit('state', { target_id: target.id, ...State.get(target.id) });
  }

  // ---------- PING ----------
  async runPingCycle() {
    const pingTargets = Targets.enabled().filter((t) => t.kind === 'ping' && t.host);
    const tcpTargets = Targets.enabled().filter((t) => t.kind === 'tcp' && t.host && t.port);
    await Promise.allSettled([
      ...pingTargets.map((t) => this.pingOne(t)),
      ...tcpTargets.map((t) => this.tcpOne(t)),
    ]);
  }

  async pingOne(target) {
    try {
      const res = await ping.promise.probe(target.host, {
        timeout: config.pingTimeout,
        min_reply: config.pingCount,
        extra: process.platform === 'win32'
          ? ['-n', String(config.pingCount)]
          : ['-c', String(config.pingCount)],
      });

      const alive = res.alive;
      const rtt = alive && res.time !== 'unknown' ? Number(res.time) : null;
      const loss = res.packetLoss != null ? Number(res.packetLoss) : (alive ? 0 : 100);

      this.applyResult(target, {
        status: alive ? 'up' : 'down',
        rtt_ms: rtt,
        loss_pct: Number.isFinite(loss) ? loss : (alive ? 0 : 100),
      });
    } catch {
      this.applyResult(target, { status: 'down', rtt_ms: null, loss_pct: 100 });
    }
  }

  async tcpOne(target) {
    const start = Date.now();
    const timeoutMs = Math.max(1000, config.pingTimeout * 1000);

    const probe = () => new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;

      const finish = (ok) => {
        if (done) return;
        done = true;
        const rtt = Date.now() - start;
        socket.destroy();
        resolve({ ok, rtt });
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(Number(target.port), target.host);
    });

    const res = await probe();
    this.applyResult(target, {
      status: res.ok ? 'up' : 'down',
      rtt_ms: res.ok ? res.rtt : null,
      loss_pct: res.ok ? 0 : 100,
    });
  }

  // ---------- SNMP (no device login, community only) ----------
  getSnmpClient(device) {
    let c = this.snmpClients.get(device.id);
    if (!c) {
      c = new SnmpClient(device);
      this.snmpClients.set(device.id, c);
    } else {
      c.device = device;
    }
    return c;
  }

  async runSnmpCycle() {
    const devices = Devices.enabled().filter((d) => d.type === 'snmp');
    await Promise.allSettled(devices.map((d) => this.pollSnmp(d)));
  }

  async pollSnmp(device) {
    const ifaceTargets = Targets.byDevice(device.id).filter(
      (t) => t.enabled && t.kind === 'snmp_iface'
    );
    if (ifaceTargets.length === 0) return;

    const client = this.getSnmpClient(device);
    let interfaces;
    let resources;
    try {
      [interfaces, resources] = await Promise.all([
        client.getInterfaces(),
        client.getSystemResources(),
        // Await SFP power so we can include it in the real-time event below
        client.getSfpPower().catch(() => {})
      ]);
    } catch (err) {
      this.emit('device_status', { device_id: device.id, online: false, error: err.message });
      for (const t of ifaceTargets) {
        this.applyResult(t, { status: 'down', link_up: 0, rx_bps: null, tx_bps: null });
      }
      return;
    }

    if (resources) {
      this.resourceCache.set(device.id, resources);
    }

    this.emit('device_status', { 
      device_id: device.id, 
      online: true,
      cpu_pct: resources?.cpu_pct,
      mem_pct: resources?.mem_pct
    });
    const byName = new Map(interfaces.map((i) => [i.name, i]));
    const byIndex = new Map(interfaces.map((i) => [String(i.index), i]));
    // Cache name→index map for SFP power lookup in map API
    client.ifaceNameToIndex = new Map(interfaces.map(i => [i.name, i.index]));

    for (const t of ifaceTargets) {
      const iface = byName.get(t.iface) || byIndex.get(String(t.iface));
      if (!iface) {
        this.applyResult(t, { status: 'down', link_up: 0, rx_bps: null, tx_bps: null });
        continue;
      }
      
      let sfp_power = null;
      if (client.sfpCache) {
        for (const sfp of client.sfpCache.values()) {
          if (sfp.name === iface.name && sfp.rx !== undefined && sfp.tx !== undefined) {
            sfp_power = { rx: sfp.rx, tx: sfp.tx };
            break;
          }
        }
      }

      this.applyResult(t, {
        status: iface.running ? 'up' : 'down',
        link_up: iface.running ? 1 : 0,
        rx_bps: iface.rx_bps,
        tx_bps: iface.tx_bps,
        sfp_power,
      });
    }
  }

  // ---------- MIKROTIK LEGACY ----------
  getClient(device) {
    let c = this.mtClients.get(device.id);
    if (!c) {
      c = new MikrotikClient(device);
      this.mtClients.set(device.id, c);
    } else {
      c.device = device; // refresh creds if edited
    }
    return c;
  }

  async runMikrotikCycle() {
    const devices = Devices.enabled().filter((d) => d.type === 'mikrotik');
    await Promise.allSettled(devices.map((d) => this.pollMikrotik(d)));
  }

  async pollMikrotik(device) {
    const ifaceTargets = Targets.byDevice(device.id).filter(
      (t) => t.enabled && t.kind === 'mikrotik_iface'
    );
    if (ifaceTargets.length === 0) return;

    const client = this.getClient(device);
    let interfaces;
    let resources;
    try {
      [interfaces, resources] = await Promise.all([
        client.getInterfaces(),
        client.getSystemResources ? client.getSystemResources() : Promise.resolve({})
      ]);
    } catch (err) {
      // Connection failed -> mark all interface targets down/unknown
      await client.close();
      this.emit('device_status', { device_id: device.id, online: false, error: err.message });
      for (const t of ifaceTargets) {
        this.applyResult(t, { status: 'down', link_up: 0, rx_bps: null, tx_bps: null });
      }
      return;
    }

    if (resources && (resources.cpu_pct != null || resources.mem_pct != null)) {
      this.resourceCache.set(device.id, resources);
    }

    this.emit('device_status', { 
      device_id: device.id, 
      online: true,
      cpu_pct: resources?.cpu_pct,
      mem_pct: resources?.mem_pct
    });
    const byName = new Map(interfaces.map((i) => [i.name, i]));

    for (const t of ifaceTargets) {
      const iface = byName.get(t.iface);
      if (!iface) {
        this.applyResult(t, { status: 'down', link_up: 0, rx_bps: null, tx_bps: null });
        continue;
      }
      this.applyResult(t, {
        status: iface.running ? 'up' : 'down',
        link_up: iface.running ? 1 : 0,
        rx_bps: device.poll_traffic ? iface.rx_bps : null,
        tx_bps: device.poll_traffic ? iface.tx_bps : null,
      });
    }
  }

  /** On-demand: list interfaces of a device (for the "add target" picker). */
  async listInterfaces(device) {
    if (device.type === 'snmp') {
      const client = this.getSnmpClient(device);
      return client.getInterfaces();
    }
    const client = this.getClient(device);
    return client.getInterfaces();
  }
}
