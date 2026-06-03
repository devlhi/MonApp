const state = {
  view: 'dashboard',
  summary: null,
  devices: [],
  targets: [],
  events: [],
  states: new Map(),
  selectedTargetId: null,
  socketConnected: false,
  chart: null,
};

const els = {
  content: document.getElementById('content'),
  pageTitle: document.getElementById('pageTitle'),
  pageSub: document.getElementById('pageSub'),
  addBtn: document.getElementById('addBtn'),
  addBtnLabel: document.getElementById('addBtnLabel'),
  connStatus: document.getElementById('connStatus'),
  clock: document.getElementById('clock'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modal: document.getElementById('modal'),
  toasts: document.getElementById('toasts'),
};

const fmt = {
  n(v, d = 0) {
    if (v == null || Number.isNaN(v)) return '-';
    return Number(v).toFixed(d);
  },
  bps(v) {
    if (v == null || Number.isNaN(v)) return '-';
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    let n = Number(v);
    let i = 0;
    while (n >= 1000 && i < units.length - 1) {
      n /= 1000;
      i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  },
  ts(s) {
    if (!s) return '-';
    const d = new Date(s);
    return d.toLocaleString();
  },
};

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'down' ? 'down' : ''}`;
  el.textContent = message;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function statusBadge(status) {
  const s = status || 'unknown';
  return `<span class="badge ${s}">${s}</span>`;
}

function setConn(online) {
  state.socketConnected = online;
  els.connStatus.classList.toggle('online', online);
  const txt = els.connStatus.querySelector('.conn-text');
  if (txt) txt.textContent = online ? 'realtime connected' : 'realtime disconnected';
}

function wireNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      render();
    });
  });

  els.addBtn.addEventListener('click', () => {
    if (state.view === 'devices') return openAddDeviceModal();
    return openAddTargetModal();
  });
}

function updateTopbarMeta() {
  const meta = {
    dashboard: ['Dashboard', 'Live network status & SLA'],
    targets: ['Monitors', 'Ping / TCP Port / Mikrotik Interface'],
    devices: ['Devices', 'Router, switch, AP, server, OLT, etc.'],
    events: ['Events', 'Status change timeline'],
  };
  const [title, sub] = meta[state.view] || meta.dashboard;
  els.pageTitle.textContent = title;
  els.pageSub.textContent = sub;
  els.addBtnLabel.textContent = state.view === 'devices' ? 'Add Device' : 'Add Monitor';
}

async function refreshAll() {
  const [summary, devices, targets, events] = await Promise.all([
    api('/summary'),
    api('/devices'),
    api('/targets'),
    api('/events?limit=100'),
  ]);
  state.summary = summary;
  state.devices = devices;
  state.targets = targets;
  state.events = events;
  state.states = new Map(targets.map((t) => [t.id, t.state || null]));
  if (!state.selectedTargetId && targets.length) state.selectedTargetId = targets[0].id;
}

function render() {
  updateTopbarMeta();
  if (state.view === 'dashboard') return renderDashboard();
  if (state.view === 'targets') return renderTargets();
  if (state.view === 'devices') return renderDevices();
  return renderEvents();
}

function renderDashboard() {
  const s = state.summary || { devices: 0, targets: 0, up: 0, down: 0, unknown: 0 };
  const topTargets = [...state.targets].slice(0, 10);

  els.content.innerHTML = `
    <section class="grid-4">
      <div class="card">
        <h3>Total Devices</h3>
        <div class="kpi-value">${s.devices}</div>
        <div class="kpi-sub">registered assets</div>
      </div>
      <div class="card">
        <h3>Total Monitors</h3>
        <div class="kpi-value">${s.targets}</div>
        <div class="kpi-sub">ping, tcp, interface</div>
      </div>
      <div class="card">
        <h3>UP</h3>
        <div class="kpi-value" style="color:var(--ok)">${s.up}</div>
        <div class="kpi-sub">healthy checks</div>
      </div>
      <div class="card">
        <h3>DOWN</h3>
        <div class="kpi-value" style="color:var(--down)">${s.down}</div>
        <div class="kpi-sub">requires attention</div>
      </div>
    </section>

    <section class="layout-2">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Traffic</th>
              <th>SLA (24h)</th>
            </tr>
          </thead>
          <tbody>
            ${topTargets.map((t) => {
              const st = state.states.get(t.id);
              return `
                <tr>
                  <td><strong>${escapeHtml(t.name)}</strong><div class="muted">${escapeHtml(t.device_name || t.host || t.iface || '-')}</div></td>
                  <td><span class="mono">${escapeHtml(t.kind)}</span></td>
                  <td>${statusBadge(st?.status)}</td>
                  <td class="mono">${fmt.n(st?.rtt_ms, 1)} ms</td>
                  <td class="mono">↓ ${fmt.bps(st?.rx_bps)} / ↑ ${fmt.bps(st?.tx_bps)}</td>
                  <td class="mono">${t.sla?.uptime_pct != null ? `${fmt.n(t.sla.uptime_pct, 3)}%` : '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3 class="panel-title">Recent Events</h3>
        <div class="events-list">
          ${state.events.slice(0, 12).map((e) => `
            <div class="event-item">
              <div class="event-head">
                <span>${statusBadge(e.status)}</span>
                <span>${fmt.ts(e.ts)}</span>
              </div>
              <div class="event-body">
                <strong>${escapeHtml(e.target_name || '-')}</strong><br />
                <span class="muted">${escapeHtml(e.message || '')}</span>
              </div>
            </div>
          `).join('') || '<div class="muted">No events yet.</div>'}
        </div>
      </div>
    </section>
  `;
}

function renderTargets() {
  els.content.innerHTML = `
    <section class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Source Device</th>
            <th>Target</th>
            <th>Status</th>
            <th>RTT</th>
            <th>Traffic</th>
            <th>SLA 24h</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${state.targets.map((t) => {
            const st = state.states.get(t.id);
            const targetText = t.kind === 'mikrotik_iface'
              ? `iface:${t.iface}`
              : t.kind === 'tcp'
                ? `${t.host}:${t.port}`
                : t.host;
            return `
              <tr data-target-row="${t.id}">
                <td><strong>${escapeHtml(t.name)}</strong></td>
                <td><span class="mono">${escapeHtml(t.kind)}</span></td>
                <td>${escapeHtml(t.device_name || '-')}</td>
                <td class="mono">${escapeHtml(targetText || '-')}</td>
                <td>${statusBadge(st?.status)}</td>
                <td class="mono">${fmt.n(st?.rtt_ms, 1)} ms</td>
                <td class="mono">↓ ${fmt.bps(st?.rx_bps)} / ↑ ${fmt.bps(st?.tx_bps)}</td>
                <td class="mono">${t.sla?.uptime_pct != null ? `${fmt.n(t.sla.uptime_pct, 3)}%` : '-'}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn-ghost" data-action="graph" data-id="${t.id}">Graph</button>
                    <button class="btn-ghost" data-action="delete" data-id="${t.id}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </section>

    <section class="chart-box">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;">
        <h3 class="panel-title" style="margin:0">History Chart</h3>
        <div>
          <label class="muted" for="hoursSel">Window:</label>
          <select id="hoursSel" style="margin-left:6px;">
            <option value="1">1h</option>
            <option value="6">6h</option>
            <option value="24" selected>24h</option>
          </select>
        </div>
      </div>
      <canvas id="historyChart" height="110"></canvas>
    </section>
  `;

  els.content.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!confirm('Delete this monitor?')) return;
      await api(`/targets/${id}`, { method: 'DELETE' });
      await refreshAll();
      render();
    });
  });

  els.content.querySelectorAll('[data-action="graph"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.selectedTargetId = Number(btn.dataset.id);
      await drawHistoryChart(Number(document.getElementById('hoursSel').value));
    });
  });

  const hoursSel = document.getElementById('hoursSel');
  hoursSel.addEventListener('change', async () => {
    await drawHistoryChart(Number(hoursSel.value));
  });

  drawHistoryChart(24);
}

async function drawHistoryChart(hours = 24) {
  const canvas = document.getElementById('historyChart');
  if (!canvas) return;

  const targetId = state.selectedTargetId || state.targets[0]?.id;
  if (!targetId) return;

  const history = await api(`/targets/${targetId}/history?hours=${hours}`);
  const labels = history.map((x) => new Date(x.ts).toLocaleTimeString());
  const rtt = history.map((x) => x.rtt_ms ?? null);
  const rx = history.map((x) => x.rx_bps ?? null);
  const tx = history.map((x) => x.tx_bps ?? null);

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'RTT ms', data: rtt, borderColor: '#60a5fa', yAxisID: 'y', tension: 0.2 },
        { label: 'RX bps', data: rx, borderColor: '#10b981', yAxisID: 'y1', tension: 0.2 },
        { label: 'TX bps', data: tx, borderColor: '#f59e0b', yAxisID: 'y1', tension: 0.2 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#c7d5f4' } } },
      scales: {
        x: { ticks: { color: '#9db0dd', maxTicksLimit: 12 }, grid: { color: '#263252' } },
        y: { ticks: { color: '#9db0dd' }, grid: { color: '#263252' } },
        y1: { position: 'right', ticks: { color: '#9db0dd' }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

function renderDevices() {
  els.content.innerHTML = `
    <section class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Host</th>
            <th>API Port</th>
            <th>Traffic Poll</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${state.devices.map((d) => `
            <tr>
              <td><strong>${escapeHtml(d.name)}</strong></td>
              <td><span class="mono">${escapeHtml(d.type)}</span></td>
              <td class="mono">${escapeHtml(d.host)}</td>
              <td class="mono">${d.api_port || '-'}</td>
              <td>${d.poll_traffic ? 'yes' : 'no'}</td>
              <td>
                <div class="row-actions">
                  ${d.type === 'mikrotik' ? `<button class="btn-ghost" data-action="ifaces" data-id="${d.id}">Interfaces</button>` : ''}
                  <button class="btn-ghost" data-action="delete-device" data-id="${d.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;

  els.content.querySelectorAll('[data-action="delete-device"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!confirm('Delete this device?')) return;
      await api(`/devices/${id}`, { method: 'DELETE' });
      await refreshAll();
      render();
    });
  });

  els.content.querySelectorAll('[data-action="ifaces"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const list = await api(`/devices/${id}/interfaces`);
      openModal(`
        <h2>Mikrotik Interfaces</h2>
        <div class="table-wrap" style="max-height:380px;overflow:auto;">
          <table class="table">
            <thead><tr><th>Name</th><th>Type</th><th>Running</th><th>Comment</th></tr></thead>
            <tbody>
              ${list.map((i) => `<tr><td class="mono">${escapeHtml(i.name)}</td><td>${escapeHtml(i.type || '')}</td><td>${i.running ? statusBadge('up') : statusBadge('down')}</td><td>${escapeHtml(i.comment || '')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions"><button class="btn" id="closeModalBtn">Close</button></div>
      `);
      document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    });
  });
}

function renderEvents() {
  els.content.innerHTML = `
    <section class="card">
      <h3 class="panel-title">Status Events</h3>
      <div class="events-list">
        ${state.events.map((e) => `
          <div class="event-item">
            <div class="event-head">
              <span>${statusBadge(e.status)}</span>
              <span>${fmt.ts(e.ts)}</span>
            </div>
            <div class="event-body">
              <strong>${escapeHtml(e.target_name || '')}</strong><br />
              <span class="muted">${escapeHtml(e.message || '')}</span>
            </div>
          </div>
        `).join('') || '<div class="muted">No events yet.</div>'}
      </div>
    </section>
  `;
}

function openModal(html) {
  els.modal.innerHTML = html;
  els.modalBackdrop.hidden = false;
}
function closeModal() {
  els.modalBackdrop.hidden = true;
  els.modal.innerHTML = '';
}
els.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});

function openAddDeviceModal() {
  openModal(`
    <h2>Add Device</h2>
    <form id="deviceForm">
      <div class="form-grid">
        <div class="field"><label>Name</label><input name="name" required placeholder="Core-RTR-1" /></div>
        <div class="field"><label>Type</label>
          <select name="type" id="devType">
            <option value="generic">generic</option>
            <option value="mikrotik">mikrotik</option>
          </select>
        </div>
        <div class="field"><label>Host/IP</label><input name="host" required placeholder="10.10.10.1" /></div>
        <div class="field"><label>API Port</label><input name="api_port" type="number" placeholder="8728" /></div>
        <div class="field"><label>Username (mikrotik)</label><input name="username" placeholder="admin" /></div>
        <div class="field"><label>Password (mikrotik)</label><input name="password" type="password" placeholder="••••••" /></div>
        <div class="field"><label>Use TLS API</label>
          <select name="use_tls"><option value="0">No</option><option value="1">Yes</option></select>
        </div>
        <div class="field"><label>Poll Traffic</label>
          <select name="poll_traffic"><option value="1">Yes</option><option value="0">No</option></select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" id="cancelDevice">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Device</button>
      </div>
    </form>
  `);

  document.getElementById('cancelDevice').addEventListener('click', closeModal);
  document.getElementById('deviceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      type: fd.get('type'),
      host: fd.get('host'),
      api_port: fd.get('api_port') ? Number(fd.get('api_port')) : null,
      username: fd.get('username') || null,
      password: fd.get('password') || null,
      use_tls: fd.get('use_tls') === '1',
      poll_traffic: fd.get('poll_traffic') === '1',
    };
    try {
      await api('/devices', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      await refreshAll();
      render();
      toast('Device added');
    } catch (err) {
      toast(`Error: ${err.message}`, 'down');
    }
  });
}

function openAddTargetModal() {
  const deviceOptions = state.devices
    .map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.type)})</option>`)
    .join('');

  openModal(`
    <h2>Add Monitor</h2>
    <form id="targetForm">
      <div class="form-grid">
        <div class="field"><label>Name</label><input name="name" required placeholder="POP-01 Ping" /></div>
        <div class="field"><label>Kind</label>
          <select name="kind" id="targetKind">
            <option value="ping">ping (icmp)</option>
            <option value="tcp">tcp port</option>
            <option value="mikrotik_iface">mikrotik interface</option>
          </select>
        </div>

        <div class="field full" id="groupDevice" style="display:none;">
          <label>Source Device (Mikrotik)</label>
          <select name="device_id" id="deviceSelect">
            <option value="">-- Select device --</option>
            ${deviceOptions}
          </select>
        </div>

        <div class="field" id="groupHost"><label>Target Host/IP</label><input name="host" id="hostInput" placeholder="8.8.8.8" /></div>
        <div class="field" id="groupPort" style="display:none;"><label>TCP Port</label><input name="port" type="number" id="portInput" placeholder="80" /></div>

        <div class="field full" id="groupIface" style="display:none;">
          <label>Interface Name</label>
          <input name="iface" id="ifaceInput" placeholder="ether1" />
          <div class="muted" style="font-size:12px;">Tip: klik "Load Interfaces" setelah pilih device.</div>
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px;" id="ifaceActions" hidden>
        <button type="button" class="btn" id="loadIfacesBtn">Load Interfaces</button>
        <select id="ifacePicker" style="display:none;"></select>
      </div>

      <div class="form-actions">
        <button type="button" class="btn" id="cancelTarget">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Monitor</button>
      </div>
    </form>
  `);

  const kindEl = document.getElementById('targetKind');
  const groupDevice = document.getElementById('groupDevice');
  const groupHost = document.getElementById('groupHost');
  const groupPort = document.getElementById('groupPort');
  const groupIface = document.getElementById('groupIface');
  const ifaceActions = document.getElementById('ifaceActions');

  const applyKind = () => {
    const k = kindEl.value;
    groupHost.style.display = (k === 'ping' || k === 'tcp') ? '' : 'none';
    groupPort.style.display = k === 'tcp' ? '' : 'none';
    groupDevice.style.display = k === 'mikrotik_iface' ? '' : 'none';
    groupIface.style.display = k === 'mikrotik_iface' ? '' : 'none';
    ifaceActions.hidden = k !== 'mikrotik_iface';
  };
  kindEl.addEventListener('change', applyKind);
  applyKind();

  document.getElementById('cancelTarget').addEventListener('click', closeModal);

  const ifacePicker = document.getElementById('ifacePicker');
  document.getElementById('loadIfacesBtn').addEventListener('click', async () => {
    const devId = Number(document.getElementById('deviceSelect').value || 0);
    if (!devId) return toast('Pilih device Mikrotik dulu', 'down');
    try {
      const ifaces = await api(`/devices/${devId}/interfaces`);
      ifacePicker.style.display = '';
      ifacePicker.innerHTML = '<option value="">-- pilih interface --</option>' +
        ifaces.map((i) => `<option value="${escapeHtml(i.name)}">${escapeHtml(i.name)} (${i.running ? 'up' : 'down'})</option>`).join('');
      ifacePicker.onchange = () => {
        document.getElementById('ifaceInput').value = ifacePicker.value;
      };
    } catch (err) {
      toast(`Load interfaces gagal: ${err.message}`, 'down');
    }
  });

  document.getElementById('targetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const kind = fd.get('kind');
    const payload = {
      name: fd.get('name'),
      kind,
      enabled: true,
    };

    if (kind === 'ping') {
      payload.host = fd.get('host');
    } else if (kind === 'tcp') {
      payload.host = fd.get('host');
      payload.port = Number(fd.get('port'));
    } else if (kind === 'mikrotik_iface') {
      payload.device_id = Number(fd.get('device_id'));
      payload.iface = fd.get('iface');
      if (!payload.device_id || !payload.iface) {
        return toast('Device dan interface wajib diisi', 'down');
      }
    }

    try {
      await api('/targets', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      await refreshAll();
      render();
      toast('Monitor added');
    } catch (err) {
      toast(`Error: ${err.message}`, 'down');
    }
  });
}

function wireSocket() {
  const socket = io();

  socket.on('connect', () => setConn(true));
  socket.on('disconnect', () => setConn(false));

  socket.on('snapshot', (snap) => {
    if (Array.isArray(snap?.states)) {
      state.states = new Map(snap.states.map((s) => [s.target_id, s]));
    }
    if (Array.isArray(snap?.events)) {
      state.events = snap.events;
    }
    render();
  });

  socket.on('state', (s) => {
    state.states.set(s.target_id, s);
    if (state.view === 'targets' || state.view === 'dashboard') render();
  });

  socket.on('event', (e) => {
    state.events.unshift(e);
    state.events = state.events.slice(0, 200);
    toast(`${e.target_name || 'target'} ${e.status?.toUpperCase()}`, e.status === 'down' ? 'down' : 'info');
    if (state.view === 'events' || state.view === 'dashboard') render();
  });
}

function wireClock() {
  const tick = () => {
    els.clock.textContent = new Date().toLocaleTimeString();
  };
  tick();
  setInterval(tick, 1000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function bootstrap() {
  wireNav();
  wireClock();
  wireSocket();
  try {
    await refreshAll();
  } catch (err) {
    toast(`Init error: ${err.message}`, 'down');
  }
  render();
}

bootstrap();
