import snmp from 'net-snmp';

const OIDS = {
  sysName: '1.3.6.1.2.1.1.5.0',
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifMtu: '1.3.6.1.2.1.2.2.1.4',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  ifInErrors: '1.3.6.1.2.1.2.2.1.14',
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20',
  ifName: '1.3.6.1.2.1.31.1.1.1.1',
  ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',
  ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10',
  ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15',
  ifAlias: '1.3.6.1.2.1.31.1.1.1.18',
};

const SMART_OID_CATALOG = [
  { key: 'sysDescr', label: 'System Description', oid: OIDS.sysDescr, type: 'get', group: 'system', required: true, advice: 'OID system dasar. Jika timeout, SNMP service/community/firewall belum benar.' },
  { key: 'sysName', label: 'System Name', oid: OIDS.sysName, type: 'get', group: 'system', required: true, advice: 'Identitas device. Biasanya selalu tersedia jika SNMP aktif.' },
  { key: 'sysUpTime', label: 'System Uptime', oid: OIDS.sysUpTime, type: 'get', group: 'system', required: false, advice: 'Dipakai untuk validasi device reboot dan health.' },
  { key: 'ifDescr', label: 'Interface Description', oid: OIDS.ifDescr, type: 'walk', group: 'interface', required: true, advice: 'Wajib untuk daftar interface. Jika kosong, permission community tidak membaca interface table.' },
  { key: 'ifName', label: 'Interface Name', oid: OIDS.ifName, type: 'walk', group: 'interface', required: false, advice: 'Nama interface modern. Jika kosong, app fallback ke ifDescr.' },
  { key: 'ifOperStatus', label: 'Interface Operational Status', oid: OIDS.ifOperStatus, type: 'walk', group: 'interface', required: true, advice: 'Wajib untuk status up/down interface.' },
  { key: 'ifAdminStatus', label: 'Interface Admin Status', oid: OIDS.ifAdminStatus, type: 'walk', group: 'interface', required: false, advice: 'Menentukan interface disabled/enabled.' },
  { key: 'ifSpeed', label: 'Interface Speed 32-bit', oid: OIDS.ifSpeed, type: 'walk', group: 'traffic', required: false, advice: 'Speed standar, kadang terbatas untuk port >4Gbps.' },
  { key: 'ifHighSpeed', label: 'Interface High Speed', oid: OIDS.ifHighSpeed, type: 'walk', group: 'traffic', required: false, advice: 'Speed Mbps untuk interface modern.' },
  { key: 'ifInOctets', label: 'RX Octets 32-bit', oid: OIDS.ifInOctets, type: 'walk', group: 'traffic', required: true, advice: 'Counter RX fallback. Dibutuhkan untuk traffic jika HC counter tidak ada.' },
  { key: 'ifOutOctets', label: 'TX Octets 32-bit', oid: OIDS.ifOutOctets, type: 'walk', group: 'traffic', required: true, advice: 'Counter TX fallback. Dibutuhkan untuk traffic jika HC counter tidak ada.' },
  { key: 'ifHCInOctets', label: 'RX High Capacity 64-bit', oid: OIDS.ifHCInOctets, type: 'walk', group: 'traffic', required: false, advice: 'Counter RX 64-bit terbaik untuk traffic cepat.' },
  { key: 'ifHCOutOctets', label: 'TX High Capacity 64-bit', oid: OIDS.ifHCOutOctets, type: 'walk', group: 'traffic', required: false, advice: 'Counter TX 64-bit terbaik untuk traffic cepat.' },
  { key: 'ifInErrors', label: 'RX Errors', oid: OIDS.ifInErrors, type: 'walk', group: 'quality', required: false, advice: 'Untuk deteksi error kabel/interface.' },
  { key: 'ifOutErrors', label: 'TX Errors', oid: OIDS.ifOutErrors, type: 'walk', group: 'quality', required: false, advice: 'Untuk deteksi error transmit.' },
  { key: 'ifAlias', label: 'Interface Alias/Comment', oid: OIDS.ifAlias, type: 'walk', group: 'interface', required: false, advice: 'Komentar interface jika RouterOS expose alias.' },
  { key: 'mtxrOpticalTable', label: 'MikroTik Optical/SFP Table', oid: '1.3.6.1.4.1.14988.1.1.19', type: 'walk', group: 'sfp', required: false, advice: 'Jika kosong, RouterOS/model/SFP mungkin tidak expose optical DOM lewat SNMP.' },
  { key: 'mtxrHealth', label: 'MikroTik Health', oid: '1.3.6.1.4.1.14988.1.1.3', type: 'walk', group: 'health', required: false, advice: 'Sensor board seperti voltage/temperature jika tersedia.' },
  { key: 'mtxrNeighbor', label: 'MikroTik Neighbor', oid: '1.3.6.1.4.1.14988.1.1.7', type: 'walk', group: 'neighbor', required: false, advice: 'Neighbor discovery MikroTik jika MIB tersedia.' },
];

const IF_TYPE = {
  1: 'other', 6: 'ethernet', 23: 'ppp', 24: 'loopback', 53: 'propVirtual',
  71: 'wifi', 131: 'tunnel', 135: 'l2vlan', 161: 'lag', 209: 'bridge',
};

const OPER_STATUS = {
  1: 'up', 2: 'down', 3: 'testing', 4: 'unknown', 5: 'dormant', 6: 'notPresent', 7: 'lowerLayerDown',
};

function oidIndex(oid) {
  return Number(String(oid).split('.').pop());
}

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  if (Buffer.isBuffer(value)) return Number.parseInt(value.toString('hex') || '0', 16);
  return Number(value) || 0;
}

function valueText(value) {
  if (value == null) return '';
  if (Buffer.isBuffer(value)) return value.toString('utf8').replace(/\0/g, '').trim();
  return String(value).trim();
}

function safeError(err) {
  return err?.message || String(err || 'SNMP request failed');
}

export class SnmpClient {
  constructor(device) {
    this.device = device;
    this.counters = new Map();
  }

  session(options = {}) {
    return snmp.createSession(this.device.host, this.device.snmp_community || 'public', {
      port: this.device.snmp_port || 161,
      version: snmp.Version2c,
      timeout: options.timeout ?? 2000,
      retries: options.retries ?? 1,
    });
  }

  get(oids) {
    const session = this.session();
    return new Promise((resolve, reject) => {
      session.get(oids, (err, varbinds) => {
        session.close();
        if (err) return reject(err);
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) return reject(new Error(snmp.varbindError(vb)));
        }
        resolve(varbinds);
      });
    });
  }

  subtree(baseOid) {
    const session = this.session();
    const rows = [];
    return new Promise((resolve, reject) => {
      session.subtree(
        baseOid,
        (varbinds) => {
          for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) rows.push(vb);
          }
        },
        (err) => {
          session.close();
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  quickGet(oids) {
    const session = this.session({ timeout: 900, retries: 0 });
    return new Promise((resolve, reject) => {
      session.get(oids, (err, varbinds) => {
        session.close();
        if (err) return reject(err);
        resolve(varbinds);
      });
    });
  }

  quickSubtree(baseOid) {
    const session = this.session({ timeout: 900, retries: 0 });
    const rows = [];
    return new Promise((resolve, reject) => {
      session.subtree(
        baseOid,
        (varbinds) => {
          for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) rows.push(vb);
            if (rows.length >= 12) break;
          }
        },
        (err) => {
          session.close();
          if (err) return reject(err);
          resolve(rows.slice(0, 12));
        }
      );
    });
  }

  async safeSubtree(baseOid) {
    try {
      return await this.subtree(baseOid);
    } catch {
      return [];
    }
  }

  async systemInfo() {
    const rows = await this.get([OIDS.sysName, OIDS.sysDescr, OIDS.sysUpTime, OIDS.sysContact, OIDS.sysLocation]);
    const byOid = new Map(rows.map((r) => [r.oid, r.value]));
    return {
      name: valueText(byOid.get(OIDS.sysName)) || this.device.host,
      description: valueText(byOid.get(OIDS.sysDescr)),
      uptime_ticks: toNumber(byOid.get(OIDS.sysUpTime)),
      contact: valueText(byOid.get(OIDS.sysContact)),
      location: valueText(byOid.get(OIDS.sysLocation)),
    };
  }

  async identity() {
    const info = await this.systemInfo();
    return info.name || this.device.host;
  }

  mergeRows(map, rows, apply) {
    for (const vb of rows) {
      const idx = oidIndex(vb.oid);
      const item = map.get(idx) || { index: idx, name: `if${idx}` };
      apply(item, vb.value);
      map.set(idx, item);
    }
  }

  async getInterfaces() {
    const now = Date.now();
    const [ifNames, ifDescr, ifType, ifMtu, ifSpeed, ifHighSpeed, adminRows, operRows, aliasRows, hcRxRows, hcTxRows, rx32Rows, tx32Rows, inErrRows, outErrRows] = await Promise.all([
      this.safeSubtree(OIDS.ifName),
      this.safeSubtree(OIDS.ifDescr),
      this.safeSubtree(OIDS.ifType),
      this.safeSubtree(OIDS.ifMtu),
      this.safeSubtree(OIDS.ifSpeed),
      this.safeSubtree(OIDS.ifHighSpeed),
      this.safeSubtree(OIDS.ifAdminStatus),
      this.safeSubtree(OIDS.ifOperStatus),
      this.safeSubtree(OIDS.ifAlias),
      this.safeSubtree(OIDS.ifHCInOctets),
      this.safeSubtree(OIDS.ifHCOutOctets),
      this.safeSubtree(OIDS.ifInOctets),
      this.safeSubtree(OIDS.ifOutOctets),
      this.safeSubtree(OIDS.ifInErrors),
      this.safeSubtree(OIDS.ifOutErrors),
    ]);

    const map = new Map();
    this.mergeRows(map, ifDescr, (item, value) => { item.descr = valueText(value); item.name = item.descr || item.name; });
    this.mergeRows(map, ifNames, (item, value) => { item.if_name = valueText(value); item.name = item.if_name || item.descr || item.name; });
    this.mergeRows(map, ifType, (item, value) => { item.if_type = toNumber(value); item.type = IF_TYPE[item.if_type] || `ifType-${item.if_type}`; });
    this.mergeRows(map, ifMtu, (item, value) => { item.mtu = toNumber(value); });
    this.mergeRows(map, ifSpeed, (item, value) => { item.speed_bps = toNumber(value); });
    this.mergeRows(map, ifHighSpeed, (item, value) => { const mbps = toNumber(value); if (mbps > 0) item.speed_bps = mbps * 1_000_000; });
    this.mergeRows(map, adminRows, (item, value) => { item.admin_status = toNumber(value); item.disabled = item.admin_status !== 1; });
    this.mergeRows(map, operRows, (item, value) => { item.oper_status = toNumber(value); item.oper_status_text = OPER_STATUS[item.oper_status] || 'unknown'; item.running = item.oper_status === 1; });
    this.mergeRows(map, aliasRows, (item, value) => { item.comment = valueText(value); });
    this.mergeRows(map, hcRxRows.length ? hcRxRows : rx32Rows, (item, value) => { item.rxBytes = toNumber(value); });
    this.mergeRows(map, hcTxRows.length ? hcTxRows : tx32Rows, (item, value) => { item.txBytes = toNumber(value); });
    this.mergeRows(map, inErrRows, (item, value) => { item.in_errors = toNumber(value); });
    this.mergeRows(map, outErrRows, (item, value) => { item.out_errors = toNumber(value); });

    return [...map.values()].filter((item) => item.name || item.descr).map((item) => {
      const prev = this.counters.get(item.index);
      let rx_bps = 0;
      let tx_bps = 0;
      if (prev) {
        const dt = (now - prev.ts) / 1000;
        if (dt > 0) {
          const dRx = (item.rxBytes || 0) - (prev.rxBytes || 0);
          const dTx = (item.txBytes || 0) - (prev.txBytes || 0);
          rx_bps = dRx >= 0 ? (dRx * 8) / dt : 0;
          tx_bps = dTx >= 0 ? (dTx * 8) / dt : 0;
        }
      }
      this.counters.set(item.index, { rxBytes: item.rxBytes || 0, txBytes: item.txBytes || 0, ts: now });
      return {
        index: item.index,
        name: item.name,
        descr: item.descr || item.name,
        type: item.type || 'snmp',
        comment: item.comment || '',
        mtu: item.mtu || null,
        speed_bps: item.speed_bps || null,
        admin_status: item.admin_status || null,
        oper_status: item.oper_status || null,
        oper_status_text: item.oper_status_text || 'unknown',
        running: !!item.running,
        disabled: !!item.disabled,
        rx_bytes: item.rxBytes || 0,
        tx_bytes: item.txBytes || 0,
        rx_bps,
        tx_bps,
        in_errors: item.in_errors || 0,
        out_errors: item.out_errors || 0,
      };
    });
  }

  async getSfpPower() {
    // Walk MikroTik SFP DOM table (OID 19 = mtxrOpticalTable in RouterOS 7)
    // OID: 1.3.6.1.4.1.14988.1.1.19.1.1.2.{idx}  = Name (e.g. "sfp1")
    //       1.3.6.1.4.1.14988.1.1.19.1.1.9.{idx}  = Tx Power (millidBm, 0.001 dBm)
    //       1.3.6.1.4.1.14988.1.1.19.1.1.10.{idx} = Rx Power (millidBm, 0.001 dBm)
    const MTXR_OPTICAL_NAME = '1.3.6.1.4.1.14988.1.1.19.1.1.2';
    const MTXR_OPTICAL_TX = '1.3.6.1.4.1.14988.1.1.19.1.1.9';
    const MTXR_OPTICAL_RX = '1.3.6.1.4.1.14988.1.1.19.1.1.10';
    const result = new Map(); // ifIndex -> { rx, tx, name }
    try {
      const [nameRows, txRows, rxRows] = await Promise.all([
        this.safeSubtree(MTXR_OPTICAL_NAME),
        this.safeSubtree(MTXR_OPTICAL_TX),
        this.safeSubtree(MTXR_OPTICAL_RX),
      ]);
      for (const vb of nameRows) {
        if (snmp.isVarbindError(vb)) continue;
        const idx = oidIndex(vb.oid);
        const name = Buffer.isBuffer(vb.value) ? vb.value.toString('utf8') : String(vb.value);
        const entry = result.get(idx) || {};
        entry.name = name;
        result.set(idx, entry);
      }
      for (const vb of txRows) {
        if (snmp.isVarbindError(vb)) continue;
        const idx = oidIndex(vb.oid);
        const val = toNumber(vb.value);
        const entry = result.get(idx) || {};
        entry.tx = val / 1000; // millidBm → dBm
        result.set(idx, entry);
      }
      for (const vb of rxRows) {
        if (snmp.isVarbindError(vb)) continue;
        const idx = oidIndex(vb.oid);
        const val = toNumber(vb.value);
        const entry = result.get(idx) || {};
        entry.rx = val / 1000; // millidBm → dBm
        result.set(idx, entry);
      }
      this.sfpCache = result;
      this.sfpCacheAt = Date.now();
    } catch {
      // Device may not support SFP DOM - silently ignore
    }
    return result;
  }

  async getSystemResources() {
    let cpu_pct = null;
    let mem_pct = null;
    try {
      // 1. CPU
      const hrProcessorLoad = '1.3.6.1.2.1.25.3.3.1.2';
      
      let cpuRows = await this.safeSubtree(hrProcessorLoad);
      if (cpuRows && cpuRows.length > 0) {
        let sum = 0;
        let count = 0;
        for (const vb of cpuRows) {
          if (snmp.isVarbindError(vb)) continue;
          sum += toNumber(vb.value);
          count++;
        }
        if (count > 0) cpu_pct = Math.round(sum / count);
      }

      // 2. Memory
      const hrStorageDescr = '1.3.6.1.2.1.25.2.3.1.3';
      const hrStorageSize = '1.3.6.1.2.1.25.2.3.1.5';
      const hrStorageUsed = '1.3.6.1.2.1.25.2.3.1.6';

      const [descRows, sizeRows, usedRows] = await Promise.all([
        this.safeSubtree(hrStorageDescr),
        this.safeSubtree(hrStorageSize),
        this.safeSubtree(hrStorageUsed)
      ]);

      // Find the row representing physical memory
      let memIdx = null;
      for (const vb of descRows) {
        if (snmp.isVarbindError(vb)) continue;
        const desc = valueText(vb.value).toLowerCase();
        // Typically "physical memory" or "ram"
        if (desc.includes('physical memory') || desc === 'main memory' || desc.includes('ram')) {
          memIdx = oidIndex(vb.oid);
          break;
        }
      }

      // If we found the physical memory index
      if (memIdx !== null) {
        const sizeRow = sizeRows.find(r => oidIndex(r.oid) === memIdx);
        const usedRow = usedRows.find(r => oidIndex(r.oid) === memIdx);
        if (sizeRow && usedRow) {
          const size = toNumber(sizeRow.value);
          const used = toNumber(usedRow.value);
          if (size > 0) {
            mem_pct = Math.round((used / size) * 100);
          }
        }
      } else {
        // Fallback for some routers where total memory is hrStorage size at index 1 or memory is not explicitly labelled "Physical"
        // Or mikrotik: mikrotik usually reports "main memory" at index 65536
        const mikrotikMem = descRows.find(r => valueText(r.value).toLowerCase() === 'main memory');
        if (mikrotikMem) {
           const mIdx = oidIndex(mikrotikMem.oid);
           const sizeRow = sizeRows.find(r => oidIndex(r.oid) === mIdx);
           const usedRow = usedRows.find(r => oidIndex(r.oid) === mIdx);
           if (sizeRow && usedRow) {
             const size = toNumber(sizeRow.value);
             const used = toNumber(usedRow.value);
             if (size > 0) mem_pct = Math.round((used / size) * 100);
           }
        }
      }
    } catch (e) {
      // Ignore resource fetch errors
    }
    
    return { cpu_pct, mem_pct };
  }

  async probe() {
    try {
      const [system, interfaces] = await Promise.all([this.systemInfo(), this.getInterfaces()]);
      return {
        ok: true,
        system,
        interfaces,
        readable_oids: {
          system: true,
          interface_count: interfaces.length,
          counters: interfaces.some((i) => i.rx_bytes || i.tx_bytes),
          high_capacity: interfaces.some((i) => i.rx_bytes > 4_294_967_295 || i.tx_bytes > 4_294_967_295),
        },
      };
    } catch (err) {
      return { ok: false, error: safeError(err) };
    }
  }

  async diagnose() {
    const checks = [];
    const walkOids = [
      ['ifDescr', OIDS.ifDescr],
      ['ifName', OIDS.ifName],
      ['ifOperStatus', OIDS.ifOperStatus],
      ['ifInOctets', OIDS.ifInOctets],
      ['ifOutOctets', OIDS.ifOutOctets],
      ['ifHCInOctets', OIDS.ifHCInOctets],
      ['ifHCOutOctets', OIDS.ifHCOutOctets],
    ];

    try {
      const system = await this.systemInfo();
      checks.push({ name: 'system', ok: true, rows: 1, sample: system.name || system.description || this.device.host });
    } catch (e) {
      checks.push({ name: 'system', ok: false, rows: 0, error: safeError(e) });
    }

    for (const [name, oid] of walkOids) {
      try {
        const rows = await this.subtree(oid);
        checks.push({
          name,
          ok: rows.length > 0,
          rows: rows.length,
          sample: rows.slice(0, 3).map((r) => `${r.oid}=${valueText(r.value) || toNumber(r.value)}`).join(' | '),
        });
      } catch (e) {
        checks.push({ name, ok: false, rows: 0, error: safeError(e) });
      }
    }

    const online = checks.some((c) => c.ok);
    const hasInterfaceTable = checks.some((c) => ['ifDescr', 'ifName'].includes(c.name) && c.rows > 0);
    const hasCounters = checks.some((c) => ['ifInOctets', 'ifOutOctets', 'ifHCInOctets', 'ifHCOutOctets'].includes(c.name) && c.rows > 0);

    return {
      online,
      hasInterfaceTable,
      hasCounters,
      checks,
      advice: online
        ? 'SNMP merespons, tapi pastikan interface dan counter OID diizinkan oleh community.'
        : 'SNMP timeout. Aktifkan SNMP di RouterOS, pastikan community benar, dan izinkan UDP 161 dari IP server AppMon.',
    };
  }

  async smartOidScan() {
    const results = [];
    for (const item of SMART_OID_CATALOG) {
      const started = Date.now();
      try {
        const rows = item.type === 'get' ? await this.quickGet([item.oid]) : await this.quickSubtree(item.oid);
        const usableRows = rows.filter((r) => !snmp.isVarbindError(r));
        results.push({
          ...item,
          ok: usableRows.length > 0,
          rows: usableRows.length,
          ms: Date.now() - started,
          sample: usableRows.slice(0, 4).map((r) => `${r.oid}=${valueText(r.value) || toNumber(r.value)}`).join(' | '),
          status: usableRows.length > 0 ? 'readable' : 'empty',
        });
      } catch (e) {
        results.push({
          ...item,
          ok: false,
          rows: 0,
          ms: Date.now() - started,
          error: safeError(e),
          status: /timeout/i.test(safeError(e)) ? 'timeout' : 'error',
        });
      }
    }

    const readable = results.filter((r) => r.ok);
    const missingRequired = results.filter((r) => r.required && !r.ok);
    const missingOptional = results.filter((r) => !r.required && !r.ok);
    const systemOk = results.some((r) => r.group === 'system' && r.ok);
    const interfaceOk = results.some((r) => r.key === 'ifDescr' && r.ok) || results.some((r) => r.key === 'ifName' && r.ok);
    const trafficOk = (results.some((r) => r.key === 'ifHCInOctets' && r.ok) && results.some((r) => r.key === 'ifHCOutOctets' && r.ok))
      || (results.some((r) => r.key === 'ifInOctets' && r.ok) && results.some((r) => r.key === 'ifOutOctets' && r.ok));
    const sfpOk = results.some((r) => r.group === 'sfp' && r.ok);

    const recommendations = [];
    if (!systemOk) recommendations.push('SNMP tidak merespons sama sekali. Cek IP device, SNMP enabled, community, UDP 161, dan firewall RouterOS.');
    if (systemOk && !interfaceOk) recommendations.push('SNMP system terbaca, tapi interface table kosong. Pastikan community punya akses read dan tidak dibatasi source/address yang salah.');
    if (interfaceOk && !trafficOk) recommendations.push('Interface terbaca, tapi counter traffic belum terbaca. Izinkan IF-MIB counter OID atau pakai RouterOS/SNMP v2c.');
    if (trafficOk && !sfpOk) recommendations.push('Traffic sudah bisa, tapi SFP optical power belum tersedia. Tidak semua RouterOS/SFP expose DOM optical lewat SNMP.');
    if (!missingRequired.length && trafficOk) recommendations.push('OID utama sudah cukup untuk traffic graph dan visual kabel.');

    return {
      score: Math.round((readable.length / results.length) * 100),
      capability: {
        system: systemOk,
        interface: interfaceOk,
        traffic: trafficOk,
        sfp_power: sfpOk,
      },
      readable: readable.length,
      total: results.length,
      missing_required: missingRequired.map((r) => ({ key: r.key, label: r.label, oid: r.oid, status: r.status, error: r.error, advice: r.advice })),
      missing_optional: missingOptional.map((r) => ({ key: r.key, label: r.label, oid: r.oid, status: r.status, error: r.error, advice: r.advice })),
      recommendations,
      results,
    };
  }
}
