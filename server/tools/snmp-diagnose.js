import { Devices } from '../repo.js';
import { SnmpClient } from '../snmp.js';

const id = Number(process.argv[2] || 1);
const device = Devices.get(id);
if (!device) {
  console.error(`Device ${id} not found`);
  process.exit(1);
}

const oids = {
  sysName: '1.3.6.1.2.1.1.5.0',
  sysDescr: '1.3.6.1.2.1.1.1.0',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  ifName: '1.3.6.1.2.1.31.1.1.1.1',
  ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',
  ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10',
};

const client = new SnmpClient(device);
console.log(`SNMP diagnose for ${device.name} ${device.host}:${device.snmp_port || 161} community=${device.snmp_community || 'public'}`);

for (const [name, oid] of Object.entries(oids)) {
  try {
    if (oid.endsWith('.0')) {
      const rows = await client.get([oid]);
      console.log(`${name}: GET ok`, rows.map((r) => String(r.value)).join(', '));
    } else {
      const rows = await client.subtree(oid);
      console.log(`${name}: WALK rows=${rows.length}`, rows.slice(0, 5).map((r) => `${r.oid}=${Buffer.isBuffer(r.value) ? r.value.toString('utf8') : r.value}`).join(' | '));
    }
  } catch (e) {
    console.log(`${name}: ERROR ${e.message}`);
  }
}

const interfaces = await client.getInterfaces();
console.log(`interfaces parsed=${interfaces.length}`);
console.log(JSON.stringify(interfaces.slice(0, 10), null, 2));
