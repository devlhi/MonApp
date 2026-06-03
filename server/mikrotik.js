import pkg from 'node-routeros';
const { RouterOSAPI } = pkg;

/**
 * Thin wrapper around a RouterOS API connection for one device.
 * Keeps a persistent connection and computes per-interface bps deltas.
 */
export class MikrotikClient {
  constructor(device) {
    this.device = device;
    this.conn = null;
    this.connected = false;
    // last counters per interface name: { rxBytes, txBytes, ts }
    this.counters = new Map();
  }

  async connect() {
    if (this.connected && this.conn) return this.conn;
    const d = this.device;
    this.conn = new RouterOSAPI({
      host: d.host,
      user: d.username || 'admin',
      password: d.password || '',
      port: d.api_port || (d.use_tls ? 8729 : 8728),
      tls: d.use_tls ? {} : undefined,
      timeout: 8,
    });
    await this.conn.connect();
    this.connected = true;
    return this.conn;
  }

  async close() {
    try {
      if (this.conn) await this.conn.close();
    } catch {
      /* ignore */
    }
    this.connected = false;
    this.conn = null;
  }

  /**
   * Returns a list of interfaces with running flag and bps rates.
   * [{ name, running, disabled, rx_bps, tx_bps, comment, type }]
   */
  async getInterfaces() {
    const conn = await this.connect();
    const rows = await conn.write('/interface/print');
    const now = Date.now();
    const result = [];

    for (const r of rows) {
      const name = r.name;
      const rxBytes = Number(r['rx-byte'] ?? 0);
      const txBytes = Number(r['tx-byte'] ?? 0);

      let rx_bps = 0;
      let tx_bps = 0;
      const prev = this.counters.get(name);
      if (prev) {
        const dt = (now - prev.ts) / 1000;
        if (dt > 0) {
          // bytes -> bits per second; guard against counter resets
          const dRx = rxBytes - prev.rxBytes;
          const dTx = txBytes - prev.txBytes;
          rx_bps = dRx >= 0 ? (dRx * 8) / dt : 0;
          tx_bps = dTx >= 0 ? (dTx * 8) / dt : 0;
        }
      }
      this.counters.set(name, { rxBytes, txBytes, ts: now });

      result.push({
        name,
        type: r.type,
        comment: r.comment || '',
        running: r.running === 'true' || r.running === true,
        disabled: r.disabled === 'true' || r.disabled === true,
        rx_bps,
        tx_bps,
      });
    }
    return result;
  }

  /** Basic identity/health check used when adding a device. */
  async identity() {
    const conn = await this.connect();
    const rows = await conn.write('/system/identity/print');
    return rows?.[0]?.name || this.device.host;
  }
}
