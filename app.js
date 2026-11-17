'use strict';
/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
const fmtMoney = n => { const neg = n < 0; n = Math.abs(n); const cents = Math.abs(n - Math.round(n)) > 0.004; return (neg ? '-' : '') + '$' + n.toLocaleString('en-CA', {minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0}); };
const isoOf = d => { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const todayISO = () => isoOf(Date.now());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); };
const daysSince = s => s ? Math.floor((parseISO(todayISO()) - parseISO(s)) / 864e5) : 0;
const fmtDate = (s, long) => { if (!s) return ''; const d = parseISO(s); const o = {month: 'short', day: 'numeric'}; if (long) o.weekday = 'short'; if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric'; return d.toLocaleDateString('en-CA', o); };
const fmtTs = ts => new Date(ts).toLocaleString('en-CA', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});

const P = {
  jobs: '<path d="M9 3.5h6v3H9z"/><path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2"/><path d="M8.5 11.5h7M8.5 15.5h5"/>',
  cal: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  money: '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 1.6 2.7 4.5 3.2 4.5 1.6 4.5 3.3-2 3-4.5 3-4.5-1.3-4.5-3"/>',
  more: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1"/>',
  msg: '<path d="M4 5h16v11H8l-4 4z"/>',
  pin: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  img: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M20 16l-5-5-8 8"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
  fence: '<path d="M5 21V7l2-3 2 3v14M15 21V7l2-3 2 3v14M3 10h18M3 16h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c1.9.8 3 2.9 3 6"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z"/>',
  send: '<path d="M4 12l16-8-6 16-3-7z"/>',
};
const icon = (n, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/* ---------- constants ---------- */
const ST = {
  lead:   {l: 'Lead',        c: '#56636C', b: '#EAEEF0'},
  quoted: {l: 'Quoted',      c: '#2B679B', b: '#E3EDF7'},
  booked: {l: 'Booked',      c: '#8A6414', b: '#F6ECD3'},
  active: {l: 'In progress', c: '#B5541F', b: '#F8E6DA'},
  done:   {l: 'Completed',   c: '#2E7D4F', b: '#E0F0E6'},
  paid:   {l: 'Paid',        c: '#1E3A2B', b: '#D9E4DC'},
  lost:   {l: 'Lost',        c: '#A23B3B', b: '#F5E0E0'},
};
const ORDER = ['lead', 'quoted', 'booked', 'active', 'done', 'paid', 'lost'];
const OPEN = ['lead', 'quoted', 'booked', 'active', 'done'];
const WON = ['booked', 'active', 'done', 'paid'];
const TYPES = ['Fence', 'Deck', 'Fence + Deck', 'Renovation', 'Other'];
const MATERIALS = ['Pressure-treated', 'Cedar', 'Wood privacy', 'Composite', 'Chain link', 'Vinyl', 'Aluminum', 'PVC', 'Mixed', 'Other'];
const SOURCES = ['Facebook / Instagram ad', 'Referral', 'Repeat customer', 'Door hanger', 'Yard sign', 'Website', 'Google', 'Contractor / partner', 'Other'];
const METHODS = ['e-Transfer', 'Cash', 'Cheque', 'Card', 'Other'];
const VIEWS = {}, ACT = {}, INPUT_HOOKS = [], CHANGE_HOOKS = [], MORE_SECTIONS = [], JOB_CARDS = {beforeMoney: [], afterMoney: []}, DEFAULTS = {};
const DEFAULT_CHECKLIST = ['Site measured', 'Quote sent', 'Deposit received', 'Locates booked (Ontario One Call)', 'Permit (if needed)', 'Materials ordered', 'Final walkthrough + photos', 'Final payment received'];

/* ---------- storage ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('redwood-jobs', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', {keyPath: 'id'});
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', {keyPath: 'id'}).createIndex('jobId', 'jobId');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r ? r.result : undefined);
      t.onerror = t.onabort = () => rej(t.error);
    });
  },
  all(s) { return this.req(s, 'readonly', st => st.getAll()); },
  get(s, k) { return this.req(s, 'readonly', st => st.get(k)); },
  put(s, v, k) { return this.req(s, 'readwrite', st => k === undefined ? st.put(v) : st.put(v, k)); },
  del(s, k) { return this.req(s, 'readwrite', st => st.delete(k)); },
  photosFor(jobId) { return this.req('photos', 'readonly', st => st.index('jobId').getAll(jobId)); },
};

let jobs = [];
let settings = {bizName: 'Redwood & Co. Builders', bizPhone: '647-967-2120', checklist: DEFAULT_CHECKLIST.join('\n'), lastBackup: 0};
const ui = {filter: 'open', q: ''};
let curPhotos = [];
let lastJobId = null;

function blankJob() {
  return {
    id: uid(), createdAt: Date.now(), updatedAt: Date.now(), status: 'lead',
    client: {name: '', phone: '', email: '', address: ''}, source: '',
    type: 'Fence', material: '', height: '', style: '',
    runs: [], gates: [], deck: [], railingFt: '', stairs: '',
    price: '', matCost: '', labCost: '', otherCost: '', payments: [],
    quoteDate: '', startDate: '', endDate: '', crew: '', crewPhone: '',
    checklist: settings.checklist.split('\n').map(t => t.trim()).filter(Boolean).map(t => ({id: uid(), t, done: false})),
    notes: [], photoCount: 0, posts: '', taxAmt: 0, est: null,
  };
}
function normalize(j) {
  const b = blankJob();
  const o = Object.assign(b, j);
  o.client = Object.assign({name: '', phone: '', email: '', address: ''}, j.client || {});
  ['runs', 'gates', 'deck', 'payments', 'checklist', 'notes'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
  if (!ST[o.status]) o.status = 'lead';
  return o;
}
const pending = new Map();
let saveTimer = null;
function saveJob(j, now) {
  j.updatedAt = Date.now();
  pending.set(j.id, j);
  clearTimeout(saveTimer);
  if (now) return flush();
  saveTimer = setTimeout(flush, 350);
}
function flush() {
  clearTimeout(saveTimer);
  const list = [...pending.values()]; pending.clear();
  return Promise.all(list.map(j => DB.put('jobs', j))).catch(e => toast('Save failed: ' + e.message));
}
let setTimer = null;
function saveSettings() { clearTimeout(setTimer); setTimer = setTimeout(() => DB.put('kv', settings, 'settings'), 300); }
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', flush);

/* ---------- calc ---------- */
function calc(j) {
  const ft = j.runs.reduce((a, r) => a + num(r.ft), 0);
  const sqft = j.deck.reduce((a, d) => a + num(d.l) * num(d.w), 0);
  const price = num(j.price);
  const cost = num(j.matCost) + num(j.labCost) + num(j.otherCost);
  const paid = j.payments.reduce((a, p) => a + num(p.amount), 0);
  const tax = num(j.taxAmt);
  return {ft: r1(ft), gates: j.gates.length, sqft: r1(sqft), price, tax, cost, profit: price - cost,
    margin: price ? (price - cost) / price * 100 : 0, paid, balance: price + tax - paid,
    perFt: ft ? price / ft : 0, perSq: sqft ? price / sqft : 0};
}
const hasFence = j => j.type === 'Fence' || j.type === 'Fence + Deck';
const hasDeck = j => j.type === 'Deck' || j.type === 'Fence + Deck';
const pill = k => `<span class="pill" style="color:${ST[k].c};background:${ST[k].b}">${ST[k].l}</span>`;
const jobName = j => j.client.name.trim() || 'Unnamed job';
function metaLine(j) {
  const c = calc(j);
  return [j.type, j.material, c.ft ? c.ft + ' ft' : '', c.gates ? c.gates + (c.gates > 1 ? ' gates' : ' gate') : '', c.sqft ? Math.round(c.sqft) + ' sq ft' : ''].filter(Boolean).join(' · ');
}
const isEmptyJob = j => !j.est && !j.client.name && !j.client.phone && !j.client.address && !j.client.email && !j.runs.length && !j.deck.length && !j.gates.length && !j.price && !j.payments.length && !j.photoCount && !j.notes.some(n => !n.sys) && j.status === 'lead';

/* ---------- toast / sheets ---------- */
let tt;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2800); }
function sheet(html, cls = 'sheet') { const m = $('#modal'); m.innerHTML = `<div class="scrim" data-close></div><div class="${cls}">${html}</div>`; m.hidden = false; return m; }
function closeSheet() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; m.onclick = null; }
$('#modal').addEventListener('click', e => { const m = $('#modal'); if (!m.onclick && e.target.closest('[data-close]')) closeSheet(); });
function ask(msg, ok = 'Delete', danger = true) {
  return new Promise(res => {
    const m = sheet(`<p class="ask">${esc(msg)}</p><div class="btns"><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(ok)}</button></div>`);
    m.onclick = e => { const b = e.target.closest('[data-r],[data-close]'); if (!b) return; const v = b.dataset.r === '1'; closeSheet(); res(v); };
  });
}

/* ---------- native bridge ---------- */
const NB = window.AndroidBridge;
function saveFile(name, text, mime) {
  if (NB && NB.saveText) { const r = NB.saveText(name, text, mime); toast(r); return !String(r).startsWith('ERROR'); }
  if (typeof offerFile === 'function') { offerFile(new Blob([text], {type: mime}), name, {title: name, mode: isIOS ? 'share' : 'download'}).then(r => { if (r === 'downloaded') toast('Downloaded ' + name); }); return true; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type: mime})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Downloaded ' + name); return true;
}
function shareText(subject, text) {
  if (NB && NB.shareText) return NB.shareText(subject, text);
  if (navigator.share) return navigator.share({title: subject, text}).catch(() => {});
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'));
}

/* ---------- router ---------- */
function route(keep) {
  if (!keep) { flush(); closeSheet(); }
  const parts = (location.hash || '#/jobs').slice(2).split('/');
  const view = parts[0] || 'jobs', id = parts[1];
  if (typeof roleGate === 'function' && roleGate(view, id, keep)) return;
  // drop untouched new jobs when leaving them
  if (lastJobId && !(view === 'job' && id === lastJobId)) {
    const old = jobs.find(j => j.id === lastJobId);
    if (old && isEmptyJob(old)) { jobs = jobs.filter(j => j !== old); DB.del('jobs', old.id); }
    lastJobId = null;
  }
  if (view === 'new') {
    const j = blankJob(); jobs.push(j); saveJob(j, true); location.replace('#/job/' + j.id); return;
  }
  document.body.classList.toggle('detail', view === 'job' || !!(VIEWS[view] && VIEWS[view].detail));
  renderTabs(view);
  if (VIEWS[view]) {
    if (VIEWS[view].render(id) === false) location.replace('#/jobs');
  } else if (view === 'job') {
    const j = jobs.find(x => x.id === id);
    if (!j) { location.replace('#/jobs'); return; }
    lastJobId = j.id;
    $('#top').innerHTML = `<a class="ib" href="#/jobs" data-a="back" aria-label="Back">${icon('back', 24)}</a><div class="title" id="jtitle">${esc(jobName(j))}</div><button class="ib" data-a="share" aria-label="Share">${icon('share')}</button>`;
    main.innerHTML = viewJob(j);
    loadPhotos(j);
  } else if (view === 'schedule') {
    $('#top').innerHTML = `<div class="title">Schedule</div>`; main.innerHTML = viewSchedule();
  } else if (view === 'money') {
    $('#top').innerHTML = `<div class="title">Money</div>`; main.innerHTML = viewMoney();
  } else if (view === 'more') {
    $('#top').innerHTML = `<div class="title">More</div>`; main.innerHTML = viewMore(); fillStorage();
  } else {
    $('#top').innerHTML = `<div class="brand"><small>${esc(settings.bizName)}</small><b>Jobs</b></div><a class="ib" href="#/new" aria-label="New job">${icon('plus', 26)}</a>`;
    main.innerHTML = viewJobs();
  }
  if (!keep) main.scrollTop = 0;
}
window.addEventListener('hashchange', () => route());
function rerender() { const st = main.scrollTop; route(true); main.scrollTop = st; }
function cur() { const m = (location.hash || '').match(/^#\/job\/(.+)$/); return m ? jobs.find(j => j.id === m[1]) : null; }
function renderTabs(view) {
  const t = [['jobs', 'Jobs', 'jobs'], ['schedule', 'Schedule', 'cal'], ['money', 'Money', 'money'], ['more', 'More', 'more']];
  $('#tabs').innerHTML = t.map(([k, l, i]) => `<a href="#/${k}" class="${view === k ? 'on' : ''}"><span class="ic">${icon(i, 21)}</span>${l}</a>`).join('');
}

/* ---------- jobs list ---------- */
function viewJobs() {
  const counts = {}; ORDER.forEach(k => counts[k] = 0); jobs.forEach(j => counts[j.status]++);
  const open = OPEN.reduce((a, k) => a + counts[k], 0);
  const chips = [['open', 'Open', open], ...ORDER.map(k => [k, ST[k].l, counts[k]]), ['all', 'All', jobs.length]];
  const needBackup = jobs.length >= 3 && Date.now() - (settings.lastBackup || 0) > 14 * 864e5;
  return `${typeof installBanner === 'function' ? installBanner() : ''}${needBackup ? `<a class="banner" href="#/more">${icon('doc', 20)}<div><b>Back up your jobs.</b> Data lives on this phone only — export a copy.</div></a>` : ''}
  <div class="search">${icon('search', 18)}<input id="q" type="search" placeholder="Search name, address, phone…" value="${esc(ui.q)}" autocomplete="off"></div>
  <div class="chips">${chips.map(([k, l, n]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-a="filter" data-v="${k}">${l}<i>${n}</i></button>`).join('')}</div>
  <div id="joblist">${jobListHTML()}</div>
  <a class="fab" href="#/new" aria-label="New job">${icon('plus', 30)}</a>`;
}
function jobListHTML() {
  if (!jobs.length) return `<div class="empty"><div class="big">${icon('fence', 40)}</div><b>No jobs yet</b>Track every fence and deck job — leads, quotes, measurements, payments and photos.<br><br><a class="btn gold" href="#/new">${icon('plus', 20)} Add first job</a></div>`;
  const q = ui.q.trim().toLowerCase();
  let list = jobs.filter(j => ui.filter === 'all' || (ui.filter === 'open' ? OPEN.includes(j.status) : j.status === ui.filter));
  if (q) list = list.filter(j => [j.client.name, j.client.address, j.client.phone, j.client.email, j.material, j.type, j.crew, j.source].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  if (!list.length) return `<div class="empty">No jobs match.</div>`;
  return list.map(j => {
    const c = calc(j), s = ST[j.status];
    const extra = [];
    if (j.startDate && (j.status === 'booked' || j.status === 'active')) extra.push(`<div class="jd">Start ${fmtDate(j.startDate, true)}${j.crew ? ' · ' + esc(j.crew) : ''}</div>`);
    if (c.price && c.balance > 0.009 && (j.status === 'active' || j.status === 'done')) extra.push(`<div class="jd due">Balance ${fmtMoney(c.balance)}</div>`);
    return `<a class="job" href="#/job/${j.id}" style="--sc:${s.c}">
      <div class="jt"><b>${esc(jobName(j))}</b><span class="amt">${c.price ? fmtMoney(c.price) : ''}</span></div>
      ${j.client.address ? `<div class="ja">${esc(j.client.address)}</div>` : ''}
      <div class="jm">${pill(j.status)}<span>${esc(metaLine(j))}</span></div>${extra.join('')}${typeof estBadge === 'function' ? estBadge(j) : ''}${typeof jobBadges === 'function' ? jobBadges(j) : ''}</a>`;
  }).join('');
}

/* ---------- job detail ---------- */
const fld = (label, f, v, o = {}) => `<label class="f"><span>${label}</span><input data-f="${f}" value="${esc(v)}" type="${o.type || 'text'}"${o.im ? ` inputmode="${o.im}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} autocomplete="off"></label>`;
const area = (label, f, v, rows = 2, ph = '') => `<label class="f"><span>${label}</span><textarea data-f="${f}" rows="${rows}" placeholder="${esc(ph)}">${esc(v)}</textarea></label>`;
const sel = (label, f, v, opts, blank = true) => `<label class="f"><span>${label}</span><select data-f="${f}">${blank ? '<option value="">—</option>' : ''}${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}${v && !opts.includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select></label>`;
const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
const setp = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

function quickHTML(j) {
  const tel = (j.client.phone || '').replace(/[^0-9+]/g, '');
  const addr = (j.client.address || '').trim();
  return `${tel ? `<a class="qa" href="tel:${tel}">${icon('phone')}Call</a>` : `<button class="qa" disabled>${icon('phone')}Call</button>`}
    ${tel ? `<a class="qa" href="sms:${tel}">${icon('msg')}Text</a>` : `<button class="qa" disabled>${icon('msg')}Text</button>`}
    ${addr ? `<a class="qa" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}" target="_blank" rel="noopener">${icon('pin')}Map</a>` : `<button class="qa" disabled>${icon('pin')}Map</button>`}
    <button class="qa" data-a="share">${icon('share')}Share</button>`;
}
function viewJob(j) {
  const c = calc(j);
  const doneCk = j.checklist.filter(x => x.done).length;
  return `
  <div class="sbar">${ORDER.map(k => `<button class="sbtn ${j.status === k ? 'on' : ''}" data-a="status" data-v="${k}" style="--sc:${ST[k].c};--sb:${ST[k].b}">${ST[k].l}</button>`).join('')}</div>
  <div class="quick" id="quick">${quickHTML(j)}</div>

  <section class="card"><h3>Client</h3>
    ${fld('Name', 'client.name', j.client.name, {ph: 'Client name'})}
    <div class="row">${fld('Phone', 'client.phone', j.client.phone, {type: 'tel', ph: '416-555-0123'})}${fld('Email', 'client.email', j.client.email, {type: 'email'})}</div>
    ${area('Job address', 'client.address', j.client.address, 2, 'Street, city')}
    ${sel('Lead source', 'source', j.source, SOURCES)}
  </section>

  <section class="card"><h3>Job</h3>
    <div class="row">${sel('Type', 'type', j.type, TYPES, false)}${sel('Material', 'material', j.material, MATERIALS)}</div>
    <div class="row">${fld('Height (ft)', 'height', j.height, {im: 'decimal', ph: hasDeck(j) && !hasFence(j) ? 'Deck height' : '6'})}${fld('Style / colour', 'style', j.style, {ph: 'e.g. board-on-board, grey'})}</div>
    ${fld('Posts / framing', 'posts', j.posts, {ph: 'e.g. 4x4 PT posts set in concrete, 2x4 rails'})}
  </section>

  ${hasFence(j) ? `<section class="card"><h3>Fence measurements <em data-c="fthead">${c.ft} ft</em></h3>
    <div class="qchips">${['Back', 'Left side', 'Right side', 'Front', 'Return'].map(l => `<button data-a="add" data-l="runs" data-v="${l}">+ ${l}</button>`).join('')}</div>
    ${j.runs.map(r => `<div class="li"><input data-l="runs" data-id="${r.id}" data-k="label" value="${esc(r.label)}" placeholder="Run name"><input class="n" data-l="runs" data-id="${r.id}" data-k="ft" value="${esc(r.ft)}" inputmode="decimal" placeholder="0"><span class="u">ft</span><button class="ix" data-a="rm" data-l="runs" data-id="${r.id}" aria-label="Remove">${icon('x', 18)}</button></div>`).join('')}
    <button class="add" data-a="add" data-l="runs">+ Add run</button>
    <div class="sub">Gates</div>
    ${j.gates.map(g => `<div class="li"><input data-l="gates" data-id="${g.id}" data-k="label" value="${esc(g.label)}" placeholder="e.g. Single walk gate"><input class="n" data-l="gates" data-id="${g.id}" data-k="w" value="${esc(g.w)}" inputmode="decimal" placeholder="width"><span class="u">ft</span><button class="ix" data-a="rm" data-l="gates" data-id="${g.id}" aria-label="Remove">${icon('x', 18)}</button></div>`).join('')}
    <button class="add" data-a="add" data-l="gates">+ Add gate</button>
    <div class="tot"><span>Total fence</span><b data-c="ftot">${c.ft} ft · ${c.gates} gate${c.gates === 1 ? '' : 's'}</b></div>
  </section>` : ''}

  ${hasDeck(j) ? `<section class="card"><h3>Deck measurements <em data-c="sqhead">${Math.round(c.sqft)} sq ft</em></h3>
    ${j.deck.map(d => `<div class="li"><input data-l="deck" data-id="${d.id}" data-k="label" value="${esc(d.label)}" placeholder="Section"><input class="s" data-l="deck" data-id="${d.id}" data-k="l" value="${esc(d.l)}" inputmode="decimal" placeholder="L"><span class="x">×</span><input class="s" data-l="deck" data-id="${d.id}" data-k="w" value="${esc(d.w)}" inputmode="decimal" placeholder="W"><span class="eq" data-sq="${d.id}">${Math.round(num(d.l) * num(d.w))}</span><button class="ix" data-a="rm" data-l="deck" data-id="${d.id}" aria-label="Remove">${icon('x', 18)}</button></div>`).join('')}
    <button class="add" data-a="add" data-l="deck">+ Add section (L × W ft)</button>
    <div class="row" style="margin-top:12px">${fld('Railing (ft)', 'railingFt', j.railingFt, {im: 'decimal'})}${fld('Stairs (steps)', 'stairs', j.stairs, {im: 'numeric'})}</div>
    <div class="tot" style="margin-top:2px"><span>Total deck</span><b data-c="sqtot">${Math.round(c.sqft)} sq ft</b></div>
  </section>` : ''}

  ${JOB_CARDS.beforeMoney.map(f => f(j)).join('')}
  <section class="card"><h3>Money</h3>
    <div class="row">${fld(num(j.taxAmt) ? 'Contract price, before HST ($)' : 'Contract price ($)', 'price', j.price, {im: 'decimal', ph: '0'})}${fld('Materials ($)', 'matCost', j.matCost, {im: 'decimal', ph: '0'})}</div>
    <div class="row">${fld('Labour / sub ($)', 'labCost', j.labCost, {im: 'decimal', ph: '0'})}${fld('Other costs ($)', 'otherCost', j.otherCost, {im: 'decimal', ph: 'disposal, rentals'})}</div>
    <div class="kpis" data-c="kpis">${kpisHTML(j)}</div>
    <div class="sub">Payments</div>
    <div id="pays">${j.payments.length ? j.payments.map(p => `<div class="pay"><div class="pi"><b>${esc(p.method || 'Payment')}${p.note ? ' — ' + esc(p.note) : ''}</b><span>${fmtDate(p.date) || '—'}</span></div><span class="pa">${fmtMoney(num(p.amount))}</span><button class="ix" data-a="rmpay" data-id="${p.id}" aria-label="Remove payment">${icon('x', 18)}</button></div>`).join('') : '<p class="hint" style="margin:0">No payments yet.</p>'}</div>
    <div class="payform">
      <div class="row"><label class="f"><span>Amount ($)</span><input id="payAmt" inputmode="decimal" placeholder="0"></label><label class="f"><span>Method</span><select id="payMethod">${METHODS.map(m => `<option>${m}</option>`).join('')}</select></label></div>
      <div class="row"><label class="f"><span>Date</span><input id="payDate" type="date" value="${todayISO()}"></label><label class="f"><span>Note</span><input id="payNote" placeholder="Deposit, final…"></label></div>
      <button class="btn wide" data-a="pay">${icon('plus', 18)} Record payment</button>
    </div>
  </section>

  ${JOB_CARDS.afterMoney.map(f => f(j)).join('')}
  <section class="card"><h3>Schedule &amp; crew</h3>
    <div class="row">${fld('Quote date', 'quoteDate', j.quoteDate, {type: 'date'})}${fld('Start date', 'startDate', j.startDate, {type: 'date'})}</div>
    <div class="row">${fld('Finish date', 'endDate', j.endDate, {type: 'date'})}<span></span></div>
    <div class="row">${fld('Crew / subcontractor', 'crew', j.crew, {ph: 'Who is doing it'})}${fld('Crew phone', 'crewPhone', j.crewPhone, {type: 'tel'})}</div>
  </section>

  <section class="card"><h3>Checklist <em>${doneCk}/${j.checklist.length}</em></h3>
    ${j.checklist.map(x => `<div class="ck ${x.done ? 'done' : ''}"><input type="checkbox" data-ck="${x.id}"${x.done ? ' checked' : ''} aria-label="${esc(x.t)}"><span>${esc(x.t)}</span><button class="ix" data-a="rmck" data-id="${x.id}" aria-label="Remove">${icon('x', 16)}</button></div>`).join('')}
    <div class="addrow"><input id="ckNew" placeholder="Add a task"><button class="btn" data-a="ckadd">Add</button></div>
  </section>

  <section class="card"><h3>Photos <em id="phcount">${j.photoCount || 0}</em></h3>
    <div class="photos" id="photos"></div>
    <div class="btns">
      <label class="btn gold">${icon('cam', 20)} Camera<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
      <label class="btn ghost">${icon('img', 20)} Gallery<input type="file" accept="image/*" multiple data-photo hidden></label>
    </div>
  </section>

  <section class="card"><h3>Notes</h3>
    <textarea id="noteNew" rows="2" placeholder="Site conditions, customer requests, grade, trees, pool code…"></textarea>
    <button class="btn wide" style="margin-top:8px" data-a="note">Add note</button>
    <div style="margin-top:6px">${j.notes.map(n => `<div class="note ${n.sys ? 'sys' : ''}"><div><small>${fmtTs(n.ts)}</small>${esc(n.t)}</div>${n.sys ? '' : `<button class="ix" data-a="rmnote" data-id="${n.id}" aria-label="Delete note">${icon('x', 16)}</button>`}</div>`).join('')}</div>
  </section>

  <div class="btns" style="margin:6px 0 20px">
    <button class="btn ghost" data-a="dup">${icon('copy', 18)} Duplicate</button>
    <button class="btn ghost" style="color:var(--red)" data-a="del">${icon('trash', 18)} Delete job</button>
  </div>`;
}
function kpisHTML(j) {
  const c = calc(j);
  const unit = j.type === 'Fence' && c.ft ? `<div class="kpi"><span>Price per ft</span><b>${fmtMoney(r1(c.perFt))}</b></div>`
    : j.type === 'Deck' && c.sqft ? `<div class="kpi"><span>Price per sq ft</span><b>${fmtMoney(r1(c.perSq))}</b></div>` : `<div class="kpi"><span>Total cost</span><b>${fmtMoney(c.cost)}</b></div>`;
  return `<div class="kpi"><span>Profit${c.price ? ` · ${Math.round(c.margin)}%` : ''}</span><b class="${c.profit < 0 ? 'neg' : 'pos'}">${fmtMoney(c.profit)}</b></div>${unit}
    ${c.tax ? `<div class="kpi"><span>HST</span><b>${fmtMoney(c.tax)}</b></div><div class="kpi"><span>Total with HST</span><b>${fmtMoney(c.price + c.tax)}</b></div>` : ''}
    <div class="kpi"><span>Paid</span><b>${fmtMoney(c.paid)}</b></div><div class="kpi"><span>Balance</span><b class="${c.balance > 0.009 ? 'neg' : ''}">${fmtMoney(c.balance)}</b></div>`;
}
function updateComputed(j) {
  const c = calc(j);
  const set = (k, v) => { const el = main.querySelector(`[data-c="${k}"]`); if (el) el.innerHTML = v; };
  set('fthead', c.ft + ' ft'); set('ftot', `${c.ft} ft · ${c.gates} gate${c.gates === 1 ? '' : 's'}`);
  set('sqhead', Math.round(c.sqft) + ' sq ft'); set('sqtot', Math.round(c.sqft) + ' sq ft');
  set('kpis', kpisHTML(j));
  j.deck.forEach(d => { const el = main.querySelector(`[data-sq="${d.id}"]`); if (el) el.textContent = Math.round(num(d.l) * num(d.w)); });
}
function setStatus(j, k) {
  if (j.status === k) return;
  const prev = j.status; j.status = k;
  if (k === 'quoted' && !j.quoteDate) j.quoteDate = todayISO();
  if (k === 'active' && !j.startDate) j.startDate = todayISO();
  if ((k === 'done' || k === 'paid') && !j.endDate) j.endDate = todayISO();
  j.notes.unshift({id: uid(), ts: Date.now(), t: `Status: ${ST[prev].l} → ${ST[k].l}`, sys: true});
  saveJob(j, true); rerender();
  const c = calc(j);
  if (k === 'paid' && c.price && c.balance > 0.009) toast(`Marked paid — but ${fmtMoney(c.balance)} isn't recorded yet`);
}

/* ---------- photos ---------- */
let curPhotosJob = null;
function drawPhotos() {
  const box = $('#photos'); if (!box) return;
  const cnt = $('#phcount'); if (cnt) cnt.textContent = curPhotos.length;
  box.innerHTML = curPhotos.map((p, i) => `<button class="ph" data-a="viewph" data-i="${i}"><img src="${p.thumb}" alt="Job photo ${i + 1}"></button>`).join('');
  box.style.display = curPhotos.length ? '' : 'none';
}
async function loadPhotos(j) {
  if (curPhotosJob === j.id) drawPhotos(); else { curPhotos = []; drawPhotos(); }
  curPhotosJob = j.id;
  curPhotos = (await DB.photosFor(j.id)).sort((a, b) => a.ts - b.ts);
  if (cur() !== j) return;
  if (j.photoCount !== curPhotos.length) { j.photoCount = curPhotos.length; saveJob(j); }
  drawPhotos();
}
function loadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => res(img); img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Unreadable image')); };
    img.src = url;
  });
}
function scaleImg(img, max, q) {
  const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', q);
}
async function addPhotos(files) {
  const j = cur(); if (!j || !files || !files.length) return;
  const list = [...files]; toast(`Adding ${list.length} photo${list.length > 1 ? 's' : ''}…`);
  let ok = 0;
  for (const f of list) {
    try {
      const img = await loadImg(f);
      const p = {id: uid(), jobId: j.id, ts: Date.now(), data: scaleImg(img, 1600, 0.78), thumb: scaleImg(img, 360, 0.72)};
      URL.revokeObjectURL(img.src); await DB.put('photos', p); ok++;
    } catch (e) { toast('Could not add a photo: ' + e.message); }
  }
  j.photoCount = (j.photoCount || 0) + ok; saveJob(j, true);
  if (cur() === j) loadPhotos(j);
  if (ok) toast(`${ok} photo${ok > 1 ? 's' : ''} added`);
}
function viewPhoto(i) {
  const p = curPhotos[i]; if (!p) return;
  const m = sheet(`<div class="vtop"><span>${i + 1} / ${curPhotos.length} · ${fmtTs(p.ts)}</span><button class="ib" data-close aria-label="Close">${icon('x', 24)}</button></div>
    <div class="vimg"><img src="${p.data}" alt="Job photo">${i > 0 ? `<button class="nav prev" data-v="${i - 1}">${icon('left', 26)}</button>` : ''}${i < curPhotos.length - 1 ? `<button class="nav next" data-v="${i + 1}">${icon('right', 26)}</button>` : ''}</div>
    <div class="vbot"><button class="btn ghost wide" data-v="share">${icon('img', 18)} Save to gallery</button><button class="btn danger wide" data-v="del">${icon('trash', 18)} Delete</button></div>`, 'viewer');
  m.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    const b = e.target.closest('[data-v]'); if (!b) return;
    const v = b.dataset.v;
    if (v === 'del') {
      if (!await ask('Delete this photo?')) return viewPhoto(i);
      await DB.del('photos', p.id); const j = cur(); if (j) { j.photoCount = Math.max(0, (j.photoCount || 1) - 1); saveJob(j, true); loadPhotos(j); }
    } else if (v === 'share') {
      if (NB && NB.saveImage) toast(NB.saveImage('job-photo-' + p.ts + '.jpg', p.data.split(',')[1]));
      else { const a = document.createElement('a'); a.href = p.data; a.download = 'job-photo-' + p.ts + '.jpg'; a.click(); }
    } else viewPhoto(+v);
  };
}

/* ---------- share ---------- */
function summary(j, forCrew) {
  const c = calc(j), L = [];
  L.push(forCrew ? `JOB SHEET — ${jobName(j)}` : `${settings.bizName} — Job summary`, '');
  if (!forCrew && j.client.name) L.push(`Client: ${j.client.name}`);
  if (j.client.address) L.push(`Address: ${j.client.address}`);
  if (forCrew && j.client.phone) L.push(`Client phone: ${j.client.phone}`);
  L.push(`Job: ${[j.type, j.material, j.height ? j.height + ' ft high' : '', j.style].filter(Boolean).join(', ')}`);
  if (j.startDate) L.push(`Start: ${fmtDate(j.startDate, true)}`);
  if (j.runs.length) { L.push('', 'Fence runs:'); j.runs.forEach(r => L.push(`• ${r.label || 'Run'}: ${num(r.ft)} ft`)); L.push(`Total: ${c.ft} ft`); }
  if (j.gates.length) L.push(`Gates (${j.gates.length}): ${j.gates.map(g => (g.label || 'Gate') + (g.w ? ` ${g.w} ft` : '')).join(', ')}`);
  if (j.deck.length) { L.push('', 'Deck:'); j.deck.forEach(d => L.push(`• ${d.label || 'Section'}: ${num(d.l)} × ${num(d.w)} ft = ${Math.round(num(d.l) * num(d.w))} sq ft`)); L.push(`Total: ${Math.round(c.sqft)} sq ft`); if (j.railingFt) L.push(`Railing: ${j.railingFt} ft`); if (j.stairs) L.push(`Stairs: ${j.stairs} steps`); }
  if (forCrew) { const notes = j.notes.filter(n => !n.sys).map(n => '• ' + n.t); if (notes.length) L.push('', 'Notes:', ...notes); }
  else if (c.price) { L.push('', `Price: ${fmtMoney(c.price)}`); if (c.paid) L.push(`Paid: ${fmtMoney(c.paid)}`, `Balance: ${fmtMoney(c.balance)}`); }
  L.push('', settings.bizName + (settings.bizPhone ? ' · ' + settings.bizPhone : ''));
  return L.join('\n');
}
function shareMenu(j) {
  const m = sheet(`<h4>Share job</h4>
    <button class="opt" data-s="client">${icon('users')}<div><b>Client summary</b><span>Measurements, price, payments</span></div></button>
    <button class="opt" data-s="crew">${icon('fence')}<div><b>Crew job sheet</b><span>Address, measurements, notes — no money</span></div></button>`);
  m.onclick = e => { if (e.target.closest('[data-close]')) return closeSheet(); const b = e.target.closest('[data-s]'); if (!b) return; const crew = b.dataset.s === 'crew'; closeSheet(); shareText(crew ? 'Job sheet — ' + jobName(j) : 'Job summary — ' + jobName(j), summary(j, crew)); };
}

/* ---------- schedule ---------- */
function schedRow(j, sub) {
  const d = j.startDate ? parseISO(j.startDate) : null;
  return `<a class="srow" href="#/job/${j.id}"><div class="sdate ${d ? '' : 'nod'}">${d ? `<b>${d.getDate()}</b><span>${d.toLocaleDateString('en-CA', {month: 'short'})}</span>` : '<b>–</b>'}</div>
    <div class="sinfo"><b>${esc(jobName(j))}</b><span>${esc(j.client.address || 'No address')}</span><span>${esc(sub || metaLine(j))}</span></div>${pill(j.status)}</a>`;
}
function viewSchedule() {
  const t = todayISO(), wk = addDays(t, 7);
  const g = {active: [], overdue: [], today: [], week: [], later: [], nodate: []};
  jobs.forEach(j => {
    if (j.status === 'active') return g.active.push(j);
    if (j.status !== 'booked') return;
    if (!j.startDate) g.nodate.push(j); else if (j.startDate < t) g.overdue.push(j); else if (j.startDate === t) g.today.push(j); else if (j.startDate <= wk) g.week.push(j); else g.later.push(j);
  });
  Object.values(g).forEach(a => a.sort((x, y) => (x.startDate || '').localeCompare(y.startDate || '')));
  const follow = jobs.filter(j => (j.status === 'quoted' && daysSince(j.quoteDate || isoOf(j.createdAt)) >= 5) || (j.status === 'lead' && daysSince(isoOf(j.updatedAt)) >= 2))
    .map(j => [j, j.status === 'quoted' ? daysSince(j.quoteDate || isoOf(j.createdAt)) : daysSince(isoOf(j.updatedAt))]).sort((a, b) => b[1] - a[1]);
  const sec = (title, list, cls = '', subFn) => list.length ? `<div class="grp ${cls}"><span>${title}</span><span>${list.length}</span></div>${list.map(j => schedRow(j, subFn && subFn(j))).join('')}` : '';
  const crewSub = j => [j.crew, metaLine(j)].filter(Boolean).join(' · ');
  let html = sec('In progress', g.active, '', j => (j.endDate ? 'Finish ' + fmtDate(j.endDate) + ' · ' : '') + crewSub(j))
    + sec('Start date passed', g.overdue, 'warn', crewSub) + sec('Today', g.today, '', crewSub) + sec('Next 7 days', g.week, '', crewSub)
    + sec('Later', g.later, '', crewSub) + sec('Booked — no date yet', g.nodate, '', crewSub);
  if (follow.length) html += `<div class="grp"><span>Follow up</span><span>${follow.length}</span></div>` + follow.map(([j, d]) => schedRow(j, `${j.status === 'quoted' ? 'Quoted' : 'Lead, no update'} ${d} days ago${num(j.price) ? ' · ' + fmtMoney(num(j.price)) : ''}`)).join('');
  return html || `<div class="empty"><div class="big">${icon('cal', 40)}</div><b>Nothing scheduled</b>Set a job to <b style="display:inline;font-size:inherit">Booked</b> and give it a start date to see it here. Stale quotes and leads show up here too.</div>`;
}

/* ---------- money ---------- */
function viewMoney() {
  const y = String(new Date().getFullYear()), mo = todayISO().slice(0, 7), monthName = new Date().toLocaleDateString('en-CA', {month: 'long'});
  let pipeline = 0, pipeN = 0, booked = 0, bookedN = 0, owed = 0, mCol = 0, yCol = 0, profY = 0, revY = 0, finN = 0;
  const owing = [], src = {};
  jobs.forEach(j => {
    const c = calc(j);
    if (j.status === 'lead' || j.status === 'quoted') { pipeline += c.price; pipeN++; }
    if (j.status === 'booked' || j.status === 'active') { booked += c.price; bookedN++; }
    if ((j.status === 'active' || j.status === 'done' || j.status === 'paid') && c.price && c.balance > 0.009) { owed += c.balance; owing.push([j, c]); }
    j.payments.forEach(p => { const d = p.date || ''; if (d.startsWith(mo)) mCol += num(p.amount); if (d.startsWith(y)) yCol += num(p.amount); });
    if (j.status === 'done' || j.status === 'paid') { const d = j.endDate || j.startDate || isoOf(j.createdAt); if (d.startsWith(y)) { profY += c.profit; revY += c.price; finN++; } }
    const s = j.source || 'Not set'; src[s] = src[s] || {n: 0, won: 0, rev: 0}; src[s].n++; if (WON.includes(j.status)) { src[s].won++; src[s].rev += c.price; }
  });
  const won = jobs.filter(j => WON.includes(j.status)).length, lost = jobs.filter(j => j.status === 'lost').length;
  const counts = ORDER.map(k => [k, jobs.filter(j => j.status === k).length]); const maxC = Math.max(1, ...counts.map(x => x[1]));
  owing.sort((a, b) => b[1].balance - a[1].balance);
  return `<div class="tiles">
    <div class="tile hero"><span>Owed to you (work started or done)</span><b>${fmtMoney(owed)}</b><small>${owing.length} job${owing.length === 1 ? '' : 's'} with a balance</small></div>
    <div class="tile"><span>Collected in ${monthName}</span><b>${fmtMoney(mCol)}</b><small>${y}: ${fmtMoney(yCol)}</small></div>
    <div class="tile"><span>Profit ${y}</span><b>${fmtMoney(profY)}</b><small>${finN} finished · ${revY ? Math.round(profY / revY * 100) : 0}% margin</small></div>
    <div class="tile"><span>Booked work</span><b>${fmtMoney(booked)}</b><small>${bookedN} job${bookedN === 1 ? '' : 's'} booked / in progress</small></div>
    <div class="tile"><span>Open quotes &amp; leads</span><b>${fmtMoney(pipeline)}</b><small>${pipeN} job${pipeN === 1 ? '' : 's'}</small></div>
  </div>
  ${owing.length ? `<section class="card"><h3>Waiting on payment</h3>${owing.map(([j, c]) => `<a class="pay" href="#/job/${j.id}" style="text-decoration:none"><div class="pi"><b>${esc(jobName(j))}</b><span>${ST[j.status].l}${j.endDate ? ' · finished ' + fmtDate(j.endDate) : ''} · paid ${fmtMoney(c.paid)} of ${fmtMoney(c.price)}</span></div><span class="pa" style="color:var(--red)">${fmtMoney(c.balance)}</span></a>`).join('')}</section>` : ''}
  <section class="card"><h3>Jobs by status <em>${won + lost ? `Win rate ${Math.round(won / (won + lost) * 100)}%` : ''}</em></h3>
    ${counts.map(([k, n]) => `<div class="bar"><span>${ST[k].l}</span><div class="track"><i style="width:${n / maxC * 100}%;background:${ST[k].c}"></i></div><b>${n}</b></div>`).join('')}
  </section>
  <section class="card"><h3>Lead sources</h3>${Object.keys(src).length ? `<table class="t"><tr><th>Source</th><th class="r">Jobs</th><th class="r">Won</th><th class="r">Revenue</th></tr>${Object.entries(src).sort((a, b) => b[1].rev - a[1].rev || b[1].n - a[1].n).map(([s, v]) => `<tr><td>${esc(s)}</td><td class="r">${v.n}</td><td class="r">${v.won}</td><td class="r">${fmtMoney(v.rev)}</td></tr>`).join('')}</table>` : '<p class="hint" style="margin:0">Set a lead source on each job to see which ads and channels bring in work.</p>'}</section>`;
}

/* ---------- more ---------- */
function viewMore() {
  const lb = settings.lastBackup ? new Date(settings.lastBackup).toLocaleDateString('en-CA', {month: 'short', day: 'numeric', year: 'numeric'}) : 'never';
  return `<section class="card"><h3>Backup &amp; export</h3>
    <p class="hint">Jobs and photos are stored on this phone. Uninstalling the app erases them, so export a backup now and then and keep it in Google Drive or email. Last backup: <b>${lb}</b>.</p>
    <div class="btns" style="margin-bottom:10px"><button class="btn" data-a="backup">${icon('doc', 18)} Export backup</button>
    <label class="btn ghost">Restore backup<input type="file" accept=".json,application/json" data-restore hidden></label></div>
    <button class="btn ghost wide" data-a="csv">Export spreadsheet (CSV)</button>
  </section>
  ${MORE_SECTIONS.map(f => f()).join('')}
  <section class="card"><h3>Default checklist</h3>
    <p class="hint">Added to every new job. One task per line.</p>
    <textarea data-s="checklist" rows="8">${esc(settings.checklist)}</textarea>
  </section>
  <section class="card"><h3>Storage</h3><div id="storage" class="hint" style="margin:0">Checking…</div></section>
  <div class="about">Redwood Jobs ${NB && NB.version ? 'v' + esc(NB.version()) : 'web'} · works offline</div>`;
}
async function fillStorage() {
  const el = $('#storage'); if (!el) return;
  let photos = 0; try { photos = (await DB.req('photos', 'readonly', s => s.count())) || 0; } catch (e) {}
  let use = '';
  if (navigator.storage && navigator.storage.estimate) { try { const e = await navigator.storage.estimate(); use = ` · ${(e.usage / 1048576).toFixed(1)} MB used`; } catch (e) {} }
  el.textContent = `${jobs.length} job${jobs.length === 1 ? '' : 's'} · ${photos} photo${photos === 1 ? '' : 's'}${use}`;
}
const stamp = () => { const d = new Date(); return isoOf(d) + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };
async function exportBackup() {
  await flush();
  const photos = await DB.all('photos');
  const data = {app: 'redwood-jobs', version: 1, exportedAt: new Date().toISOString(), settings, jobs, photos};
  if (saveFile(`redwood-jobs-backup-${stamp()}.json`, JSON.stringify(data), 'application/json')) { settings.lastBackup = Date.now(); saveSettings(); rerender(); }
}
async function restoreBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return toast('That file is not a valid backup'); }
  if (!data || data.app !== 'redwood-jobs' || !Array.isArray(data.jobs)) return toast('That file is not a Redwood Jobs backup');
  if (!await ask(`Restore ${data.jobs.length} jobs and ${(data.photos || []).length} photos? Jobs already on this phone with the same ID will be replaced; others are kept.`, 'Restore', false)) return;
  for (const j of data.jobs) await DB.put('jobs', normalize(j));
  for (const p of (data.photos || [])) if (p && p.id && p.jobId) await DB.put('photos', p);
  if (data.settings) { settings = Object.assign(settings, data.settings, {lastBackup: settings.lastBackup}); await DB.put('kv', settings, 'settings'); }
  jobs = (await DB.all('jobs')).map(normalize);
  toast('Backup restored'); rerender();
}
function exportCSV() {
  const cols = ['Client', 'Phone', 'Email', 'Address', 'Lead source', 'Status', 'Type', 'Material', 'Height ft', 'Fence ft', 'Gates', 'Deck sq ft', 'Price', 'HST', 'Materials', 'Labour/sub', 'Other costs', 'Profit', 'Paid', 'Balance', 'Quote date', 'Start', 'Finish', 'Crew', 'Created'];
  const q = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = jobs.slice().sort((a, b) => a.createdAt - b.createdAt).map(j => { const c = calc(j); return [j.client.name, j.client.phone, j.client.email, j.client.address.replace(/\n/g, ', '), j.source, ST[j.status].l, j.type, j.material, j.height, c.ft, c.gates, Math.round(c.sqft), c.price, c.tax, num(j.matCost), num(j.labCost), num(j.otherCost), c.profit, c.paid, c.balance, j.quoteDate, j.startDate, j.endDate, j.crew, isoOf(j.createdAt)]; });
  saveFile(`redwood-jobs-${stamp()}.csv`, [cols, ...rows].map(r => r.map(q).join(',')).join('\n'), 'text/csv');
}

/* ---------- events ---------- */
main.addEventListener('input', e => {
  const t = e.target;
  for (const h of INPUT_HOOKS) if (h(t, e)) return;
  if (t.id === 'q') { ui.q = t.value; $('#joblist').innerHTML = jobListHTML(); return; }
  if (t.dataset.s) { settings[t.dataset.s] = t.value; saveSettings(); return; }
  const j = cur(); if (!j) return;
  if (t.dataset.f) {
    setp(j, t.dataset.f, t.value); saveJob(j); updateComputed(j);
    if (t.dataset.f === 'client.name') $('#jtitle').textContent = jobName(j);
    if (t.dataset.f === 'client.phone' || t.dataset.f === 'client.address') $('#quick').innerHTML = quickHTML(j);
  } else if (t.dataset.l) {
    const it = j[t.dataset.l].find(x => x.id === t.dataset.id);
    if (it) { it[t.dataset.k] = t.value; saveJob(j); updateComputed(j); }
  }
});
main.addEventListener('change', e => {
  const t = e.target;
  for (const h of CHANGE_HOOKS) if (h(t, e)) return;
  if (t.matches('[data-photo]')) { addPhotos(t.files); t.value = ''; return; }
  if (t.matches('[data-restore]')) { if (t.files[0]) restoreBackup(t.files[0]); t.value = ''; return; }
  const j = cur(); if (!j) return;
  if (t.dataset.ck) { const it = j.checklist.find(x => x.id === t.dataset.ck); if (it) { it.done = t.checked; saveJob(j); t.closest('.ck').classList.toggle('done', t.checked); const em = t.closest('.card').querySelector('h3 em'); if (em) em.textContent = `${j.checklist.filter(x => x.done).length}/${j.checklist.length}`; } return; }
  if (t.dataset.f === 'type') { flush(); rerender(); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b || b.closest('#modal')) return;
  const a = b.dataset.a, j = cur();
  if (a === 'filter') { ui.filter = b.dataset.v; rerender(); return; }
  if (a === 'backup') return exportBackup();
  if (a === 'csv') return exportCSV();
  if (ACT[a]) return ACT[a](b, j, e);
  if (a === 'back') { e.preventDefault(); if (history.length > 1) history.back(); else location.hash = '#/jobs'; return; }
  if (!j) return;
  switch (a) {
    case 'status': setStatus(j, b.dataset.v); break;
    case 'share': shareMenu(j); break;
    case 'add': {
      const L = b.dataset.l, it = {id: uid(), label: b.dataset.v || ''};
      if (L === 'runs') it.ft = ''; if (L === 'gates') { it.w = ''; if (!it.label) it.label = 'Gate'; } if (L === 'deck') { it.l = ''; it.w = ''; if (!it.label) it.label = j.deck.length ? 'Section ' + (j.deck.length + 1) : 'Main deck'; }
      j[L].push(it); saveJob(j); rerender();
      const inp = main.querySelector(`[data-l="${L}"][data-id="${it.id}"][data-k="${L === 'deck' ? 'l' : L === 'gates' ? 'w' : (it.label ? 'ft' : 'label')}"]`);
      if (inp) inp.focus();
      break;
    }
    case 'rm': j[b.dataset.l] = j[b.dataset.l].filter(x => x.id !== b.dataset.id); saveJob(j); rerender(); break;
    case 'pay': {
      const amt = num($('#payAmt').value); if (amt <= 0) { toast('Enter an amount'); $('#payAmt').focus(); return; }
      j.payments.push({id: uid(), amount: amt, method: $('#payMethod').value, date: $('#payDate').value || todayISO(), note: $('#payNote').value.trim()});
      j.payments.sort((x, y) => (x.date || '').localeCompare(y.date || ''));
      saveJob(j, true); rerender();
      const c = calc(j); toast(`${fmtMoney(amt)} recorded · balance ${fmtMoney(c.balance)}`);
      if (c.price && c.balance <= 0.009 && j.status === 'done') setTimeout(async () => { if (await ask('Fully paid. Mark this job as Paid?', 'Mark paid', false)) setStatus(j, 'paid'); }, 300);
      break;
    }
    case 'rmpay': if (await ask('Remove this payment?', 'Remove')) { j.payments = j.payments.filter(p => p.id !== b.dataset.id); saveJob(j, true); rerender(); } break;
    case 'ckadd': { const v = $('#ckNew').value.trim(); if (!v) return; j.checklist.push({id: uid(), t: v, done: false}); saveJob(j); rerender(); $('#ckNew').focus(); break; }
    case 'rmck': j.checklist = j.checklist.filter(x => x.id !== b.dataset.id); saveJob(j); rerender(); break;
    case 'note': { const v = $('#noteNew').value.trim(); if (!v) return; j.notes.unshift({id: uid(), ts: Date.now(), t: v}); saveJob(j, true); rerender(); break; }
    case 'rmnote': if (await ask('Delete this note?')) { j.notes = j.notes.filter(n => n.id !== b.dataset.id); saveJob(j, true); rerender(); } break;
    case 'viewph': viewPhoto(+b.dataset.i); break;
    case 'dup': {
      const n = normalize(JSON.parse(JSON.stringify(j)));
      Object.assign(n, {id: uid(), createdAt: Date.now(), status: 'lead', payments: [], notes: [], photoCount: 0, quoteDate: '', startDate: '', endDate: '', checklist: blankJob().checklist});
      n.client.name = (j.client.name ? j.client.name + ' ' : '') + '(copy)';
      ['runs', 'gates', 'deck'].forEach(k => n[k].forEach(x => x.id = uid()));
      jobs.push(n); await saveJob(n, true); location.hash = '#/job/' + n.id; toast('Job duplicated'); break;
    }
    case 'del':
      if (await ask(`Delete "${jobName(j)}" and its photos? This can't be undone.`)) {
        const ph = await DB.photosFor(j.id); for (const p of ph) await DB.del('photos', p.id);
        await DB.del('jobs', j.id); pending.delete(j.id); jobs = jobs.filter(x => x !== j); lastJobId = null;
        location.hash = '#/jobs'; toast('Job deleted');
      }
      break;
  }
});
main.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'ckNew') { e.preventDefault(); main.querySelector('[data-a="ckadd"]').click(); }
  if (e.target.dataset && e.target.dataset.l && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); }
});

/* ---------- start ---------- */
async function init() {
  try {
    await DB.open();
    const s = await DB.get('kv', 'settings'); settings = Object.assign({}, settings, DEFAULTS, s || {});
    jobs = (await DB.all('jobs')).map(normalize);
  } catch (e) {
    main.innerHTML = `<div class="card"><b>Storage error</b><p class="hint">${esc(e && e.message || e)}</p></div>`; return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (typeof onAppReady === 'function') await onAppReady();
  route();
}
window.addEventListener('DOMContentLoaded', init);
