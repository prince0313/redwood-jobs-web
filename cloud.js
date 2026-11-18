'use strict';
/* ================= Cloud: team accounts (admin / subcontractor), jobs to subs, online signing ================= */
Object.assign(DEFAULTS, {role: '', cloudUrl: '', token: '', me: null, mustChange: false, subBiz: '', ownerEmail: ''});
let cloud = {users: [], subs: [], assigns: [], lastSync: 0, apk: null};
let subData = {jobs: [], at: 0, seen: {}, drafts: {}};
let pendingPw = '';
const NBCB = {};
window.__nb = (id, ok, text) => { const c = NBCB[id]; if (!c) return; delete NBCB[id]; ok ? c.res(text) : c.rej(new Error(text || 'Network error')); };
const signedIn = () => !!(settings.cloudUrl && settings.token && settings.me);
const isAdmin = () => signedIn() && settings.me.role === 'admin';
const isOwnerCloud = () => settings.role !== 'sub' && isAdmin() && !settings.mustChange;
const appVersion = () => (NB && NB.version) ? NB.version() : 'web ' + (typeof webBuild === 'function' ? webBuild() : '');
const saveCloud = () => DB.put('kv', cloud, 'cloud').catch(() => {});
const saveSub = () => DB.put('kv', subData, 'subdata').catch(() => {});
const setUsers = list => { cloud.users = list; cloud.subs = list.filter(u => u.role === 'sub'); };
const normUser = v => String(v || '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._@-]/g, '');
const pwProblem = p => p.length < 8 ? 'Use at least 8 characters' : (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) ? 'Use letters and numbers' : '';

function rawPost(url, body) {
  if (NB && NB.httpPost) {
    return new Promise((res, rej) => {
      const id = uid(); NBCB[id] = {res, rej}; NB.httpPost(id, url, body);
      setTimeout(() => { if (NBCB[id]) { delete NBCB[id]; rej(new Error('Timed out — check your connection')); } }, 100000);
    });
  }
  return fetch(url, {method: 'POST', body, headers: {'Content-Type': 'text/plain;charset=utf-8'}, redirect: 'follow'})
    .then(r => { if (!r.ok) throw new Error('Server error ' + r.status); return r.text(); });
}
function api(action, data = {}) {
  if (!settings.cloudUrl) return Promise.reject(new Error('Cloud server not connected'));
  return rawPost(settings.cloudUrl, JSON.stringify(Object.assign({action}, data, {token: settings.token}))).then(t => {
    let r; try { r = JSON.parse(t); } catch (e) { throw new Error('The server link did not answer correctly. Check the URL and that the web app access is set to "Anyone".'); }
    if (!r.ok) {
      const msg = String(r.error || 'Server error');
      if (/^AUTH:/.test(msg)) { if (settings.token) { Object.assign(settings, {token: '', mustChange: false}); saveSettings(); setTimeout(() => route(), 60); } throw new Error(msg.replace(/^AUTH:\s*/, '')); }
      if (/^PWCHANGE:/.test(msg)) { settings.mustChange = true; saveSettings(); setTimeout(() => route(), 60); throw new Error(msg.replace(/^PWCHANGE:\s*/, '')); }
      throw new Error(msg);
    }
    return r.data;
  });
}
function shareTextVia(target, phone, email, subject, text) {
  if (NB && NB.shareTextTo) return NB.shareTextTo(target, phone || '', email || '', subject || '', text);
  if (typeof webShareText === 'function' && webShareText(target, phone, email, subject, text)) return;
  if (target === 'copy' || !navigator.share) { copyText(text); return; }
  navigator.share({title: subject, text}).catch(() => {});
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied'), () => shareText('', text));
  else shareText('', text);
}
function cancelLink(id) { if (isOwnerCloud() && id) api('estCancel', {id}).catch(() => {}); }

/* ---------- startup & role ---------- */
async function onAppReady() {
  try { const c = await DB.get('kv', 'cloud'); if (c) cloud = Object.assign(cloud, c); } catch (e) {}
  try { const s = await DB.get('kv', 'subdata'); if (s) subData = Object.assign(subData, s); } catch (e) {}
  if (settings.subToken) { delete settings.subToken; saveSettings(); }
  if (isOwnerCloud()) setTimeout(() => syncCloud(), 800);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (isOwnerCloud()) syncCloud();
  else if (settings.role === 'sub' && signedIn() && !settings.mustChange) subRefresh();
});
function roleGate(view, id, keep) {
  if (signedIn() && settings.mustChange) { renderPwChange(); return true; }
  if (view === 'signin') { renderSignIn(); return true; }
  if (!settings.role) {
    if (jobs.length || settings.lastBackup) { settings.role = 'owner'; saveSettings(); return false; }
    renderWelcome(); return true;
  }
  if (settings.role === 'sub') { subRoute(view, id, keep); return true; }
  return false;
}
function renderWelcome() {
  document.body.classList.add('detail');
  $('#top').innerHTML = `<div class="brand"><small>Redwood Jobs</small><b>Welcome</b></div>`;
  main.innerHTML = `${typeof installBanner === 'function' ? installBanner() : ''}<div class="empty" style="padding-top:24px"><div class="big">${icon('fence', 40)}</div><b>How will you use the app?</b>You can change this later.</div>
    <button class="opt card" style="display:flex;gap:14px;align-items:center;width:100%;text-align:left" data-a="signinopen">${icon('users', 28)}<div><b style="font-size:17px">Sign in</b><div class="hint" style="margin:2px 0 0">Subcontractors and team members: use the username and password you were sent.</div></div></button>
    <button class="opt card" style="display:flex;gap:14px;align-items:center;width:100%;text-align:left" data-a="roleowner">${icon('jobs', 28)}<div><b style="font-size:17px">I run the business</b><div class="hint" style="margin:2px 0 0">Track jobs, estimates and payments. Connect your server later to manage your team.</div></div></button>`;
}
ACT.roleowner = () => { settings.role = 'owner'; saveSettings(); location.hash = '#/jobs'; route(); };
ACT.signinopen = () => { location.hash = '#/signin'; };

/* ---------- sign in / password ---------- */
function renderSignIn() {
  document.body.classList.add('detail');
  $('#tabs').innerHTML = '';
  $('#top').innerHTML = `<a class="ib" href="#/jobs" data-a="signinback" aria-label="Back">${icon('back', 24)}</a><div class="title">Sign in</div>`;
  main.innerHTML = `${typeof installBanner === 'function' ? installBanner() : ''}<section class="card"><h3>Paste your sign-in message</h3>
    <p class="hint">Copy the whole message you got by WhatsApp, text or email (press and hold → Copy), then paste it here. The details below fill in.</p>
    <textarea id="inv" rows="4" placeholder="Paste the message here"></textarea>
    <button class="btn ghost wide" style="margin-top:8px" data-a="invpaste">Paste from clipboard</button></section>
    <section class="card"><h3>Your sign-in</h3>
    <label class="f"><span>Server link</span><input id="siUrl" value="${esc(settings.cloudUrl)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
    <div class="row"><label class="f"><span>Username</span><input id="siUser" autocomplete="username" autocapitalize="none"></label><label class="f"><span>Password</span><input id="siPass" type="password" autocomplete="current-password"></label></div>
    <button class="btn gold wide" data-a="signin">Sign in</button></section>`;
}
function parseInvite(t) {
  return {url: (t.match(/https?:\/\/[^\s]+\/exec\b/) || [])[0] || '',
    username: ((t.match(/username\s*:\s*(\S+)/i) || [])[1] || ''),
    password: ((t.match(/password\s*:\s*(\S+)/i) || [])[1] || '')};
}
function fillFromInvite(text) {
  const v = parseInvite(text || '');
  if (v.url) $('#siUrl').value = v.url; if (v.username) $('#siUser').value = v.username; if (v.password) $('#siPass').value = v.password;
  return v;
}
INPUT_HOOKS.push(t => { if (t.id !== 'inv') return false; fillFromInvite(t.value); return true; });
ACT.invpaste = () => {
  const done = t => { $('#inv').value = t; const v = fillFromInvite(t); if (!v.username) toast('No sign-in details found in that text'); };
  const t = NB && NB.readClipboard ? NB.readClipboard() : '';
  if (t) return done(t);
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(done, () => toast('Press and hold in the box, then Paste'));
  else toast('Press and hold in the box, then Paste');
};
ACT.signinback = (b, j, e) => { e.preventDefault(); if (settings.role === 'sub' && !signedIn()) settings.role = ''; saveSettings(); location.hash = '#/jobs'; route(); };
async function doLogin(url, username, password) {
  if (!/^https?:\/\/\S+$/.test(url)) return toast('Enter the server link (it ends in /exec)');
  if (!username || !password) return toast('Enter your username and password');
  const prevUrl = settings.cloudUrl; settings.cloudUrl = url;
  toast('Signing in…');
  try {
    const r = await api('login', {username, password});
    Object.assign(settings, {token: r.token, me: r.user, mustChange: !!r.mustChange, subBiz: r.biz, role: r.user.role === 'admin' ? 'owner' : 'sub'});
    if (r.user.role === 'admin') settings.ownerEmail = r.email || '';
    saveSettings(); pendingPw = password;
    toast(`Signed in as ${r.user.name}`);
    location.hash = '#/jobs'; route();
    if (!r.mustChange) afterSignIn();
  } catch (e) { settings.cloudUrl = prevUrl || url; saveSettings(); toast(e.message); }
}
function afterSignIn() { if (isOwnerCloud()) syncCloud(true); else if (settings.role === 'sub') subRefresh(); }
ACT.signin = () => doLogin(($('#siUrl').value || '').trim(), ($('#siUser').value || '').trim(), $('#siPass').value || '');
function renderPwChange() {
  document.body.classList.add('detail');
  $('#tabs').innerHTML = '';
  $('#top').innerHTML = `<div class="brand"><small>${esc(settings.subBiz || 'Redwood Jobs')}</small><b>Set your password</b></div>`;
  main.innerHTML = `<section class="card"><h3>Choose your own password</h3>
    <p class="hint">Hi ${esc((settings.me && settings.me.name || '').split(/\s+/)[0])}. You signed in with a temporary password. Set your own to continue — at least 8 characters, with letters and numbers.</p>
    ${pendingPw ? '' : `<label class="f"><span>Temporary password</span><input id="pwOld" type="password" autocomplete="current-password"></label>`}
    <label class="f"><span>New password</span><input id="pwNew" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Type it again</span><input id="pwNew2" type="password" autocomplete="new-password"></label>
    <button class="btn gold wide" data-a="pwsave">Save password</button></section>
    <button class="add" style="width:100%" data-a="signout">Sign out</button>`;
}
async function changePw(oldPassword, newPassword, again) {
  if (newPassword !== again) { toast('The two new passwords don\'t match'); return false; }
  const p = pwProblem(newPassword); if (p) { toast(p); return false; }
  try {
    const r = await api('changePassword', {oldPassword, newPassword});
    Object.assign(settings, {me: r.user, mustChange: false}); saveSettings(); pendingPw = '';
    toast('Password saved'); return true;
  } catch (e) { toast(e.message); return false; }
}
ACT.pwsave = async () => {
  const ok = await changePw(pendingPw || ($('#pwOld') ? $('#pwOld').value : ''), $('#pwNew').value, $('#pwNew2').value);
  if (ok) { location.hash = '#/jobs'; route(); afterSignIn(); }
};
ACT.pwchange = () => {
  const m = sheet(`<h4>Change password</h4>
    <label class="f"><span>Current password</span><input id="cpOld" type="password" autocomplete="current-password"></label>
    <label class="f"><span>New password</span><input id="cpNew" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Type it again</span><input id="cpNew2" type="password" autocomplete="new-password"></label>
    <button class="btn gold wide" data-k="save">Save</button>`);
  m.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    if (!e.target.closest('[data-k]')) return;
    if (await changePw($('#cpOld').value, $('#cpNew').value, $('#cpNew2').value)) closeSheet();
  };
};
ACT.signout = async () => {
  if (!await ask('Sign out of your account on this phone?', 'Sign out')) return;
  api('logout').catch(() => {});
  Object.assign(settings, {token: '', me: null, mustChange: false}); pendingPw = ''; saveSettings();
  location.hash = '#/jobs'; route();
};

/* ================= OWNER / ADMIN ================= */
MORE_SECTIONS.unshift(() => {
  if (!isOwnerCloud()) return `<section class="card"><h3>Cloud &amp; team</h3>
    <p class="hint">Sign in to your server to give subcontractors their own sign-ins, send them jobs, collect their prices, and get estimates signed online. Runs free in your own Google account (see setup steps).</p>
    <label class="f"><span>Server link</span><input id="cUrl" value="${esc(settings.cloudUrl)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
    <div class="row"><label class="f"><span>Username</span><input id="cUser" value="${esc(settings.me && settings.me.username || '')}" autocomplete="username" autocapitalize="none"></label><label class="f"><span>Password</span><input id="cPass" type="password" autocomplete="current-password"></label></div>
    <button class="btn wide" data-a="ownersignin">${icon('cloud', 18)} Sign in</button>
    <button class="add" style="width:100%;margin-top:10px" data-a="adminsetup">First time on this server? Create the admin account</button></section>`;
  const n = cloud.users.filter(u => u.active).length;
  return `<section class="card"><h3>Cloud &amp; team <em style="color:#2E7D4F">● Connected</em></h3>
    <p class="hint">Signed in as <b>${esc(settings.me.name)}</b> (${esc(settings.me.username)}, admin). Last sync: ${cloud.lastSync ? fmtTs(cloud.lastSync) : 'never'}</p>
    <a class="btn gold wide" href="#/team">${icon('users', 18)} Team &amp; sign-ins (${n})</a>
    <div class="btns" style="margin-top:10px"><button class="btn ghost" data-a="cloudsync">${icon('refresh', 18)} Sync now</button><button class="btn ghost" data-a="pwchange">Change password</button></div>
    <button class="add" style="margin-top:10px;width:100%" data-a="signout">Sign out of cloud</button></section>`;
});
ACT.ownersignin = () => doLogin(($('#cUrl').value || '').trim(), ($('#cUser').value || '').trim(), $('#cPass').value || '');
ACT.adminsetup = () => {
  const url = ($('#cUrl').value || '').trim();
  if (!/^https?:\/\/\S+$/.test(url)) return toast('Paste the server link first (it ends in /exec)');
  const m = sheet(`<h4>Create the admin account</h4><p class="hint">This is your own sign-in. Admins can see and do everything; subcontractors only see jobs you send them.</p>
    <label class="f"><span>Your name</span><input id="saName" autocomplete="name"></label>
    <label class="f"><span>Username</span><input id="saUser" autocapitalize="none" autocomplete="username"></label>
    <label class="f"><span>Password (8+ letters and numbers)</span><input id="saPass" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Type it again</span><input id="saPass2" type="password" autocomplete="new-password"></label>
    <button class="btn gold wide" data-k="go">Create admin account</button>`);
  m.oninput = e => { if (e.target.id === 'saName' && !$('#saUser').dataset.edited) $('#saUser').value = normUser(e.target.value.split(/\s+/)[0]); if (e.target.id === 'saUser') e.target.dataset.edited = 1; };
  m.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    if (!e.target.closest('[data-k]')) return;
    const name = $('#saName').value.trim(), username = normUser($('#saUser').value), password = $('#saPass').value;
    if (!name || !username) return toast('Enter your name and a username');
    if (password !== $('#saPass2').value) return toast('The passwords don\'t match');
    const p = pwProblem(password); if (p) return toast(p);
    const prevUrl = settings.cloudUrl; settings.cloudUrl = url;
    try {
      const r = await api('setupAdmin', {name, username, password, bizName: settings.bizName, key: settings.ownerKey || ''});
      Object.assign(settings, {token: r.token, me: r.user, mustChange: false, role: 'owner', ownerEmail: r.email || '', subBiz: r.biz}); saveSettings();
      closeSheet(); toast('Admin account created'); await syncCloud(true); rerender();
    } catch (err) { settings.cloudUrl = prevUrl; saveSettings(); toast(err.message); }
  };
};
ACT.cloudsync = async () => { toast('Syncing…'); await syncCloud(true); rerender(); };

let syncing = null;
const WORK = {accepted: 'accepted the job', started: 'started work', done: 'finished the job'};
const jobLabel = id => { const j = jobs.find(x => x.id === id); return j ? (j.client.address ? j.client.address.split('\n')[0] : jobName(j)) : 'a job'; };
function syncCloud(force) {
  if (!isOwnerCloud()) return Promise.resolve();
  if (syncing) return syncing;
  if (!force && Date.now() - cloud.lastSync < 20000) return Promise.resolve();
  syncing = (async () => {
    try {
      const first = !cloud.lastSync;
      const before = new Map(cloud.assigns.map(a => [a.id, a]));
      const [assigns, users] = await Promise.all([api('assignsList'), api('usersList')]);
      cloud.assigns = assigns; setUsers(users); cloud.lastSync = Date.now();
      const news = [];
      assigns.forEach(a => {
        const o = before.get(a.id), j = jobs.find(x => x.id === a.jobId);
        if (!first && a.bid && (!o || !o.bid || o.bid.at !== a.bid.at)) news.push(`${a.subName} sent ${fmtMoney(a.bid.total)} for ${jobLabel(a.jobId)}`);
        if (!first && o && a.status === 'declined' && o.status !== 'declined') news.push(`${a.subName} declined ${jobLabel(a.jobId)}`);
        if (j && a.status === 'awarded' && a.work && (!o || o.work !== a.work)) {
          if (!first) news.push(`${a.subName} ${WORK[a.work] || a.work} — ${jobLabel(a.jobId)}`);
          const to = a.work === 'started' && j.status === 'booked' ? 'active' : a.work === 'done' && (j.status === 'booked' || j.status === 'active') ? 'done' : '';
          if (to) { j.notes.unshift({id: uid(), ts: Date.now(), t: `Status: ${ST[j.status].l} → ${ST[to].l} (${a.subName} ${WORK[a.work]})`, sys: true}); j.status = to; if (to === 'active' && !j.startDate) j.startDate = todayISO(); if (to === 'done' && !j.endDate) j.endDate = todayISO(); saveJob(j); }
        }
      });
      const waiting = jobs.filter(j => j.est && j.est.cloud && j.est.cloud.id && !j.est.sig);
      if (waiting.length) {
        const st = await api('estStatus', {ids: waiting.map(j => j.est.cloud.id)});
        for (const s of st) {
          const j = waiting.find(x => x.est.cloud.id === s.id); if (!j) continue;
          if (s.viewedAt && !j.est.cloud.viewedAt) { j.est.cloud.viewedAt = s.viewedAt; saveJob(j); }
          if (s.status === 'signed' && s.sig && s.sig.img) { await recordOnline(j, s); news.push(`${s.sig.name} signed estimate #${j.est.no}`); }
        }
      }
      await saveCloud(); await flush();
      if (news.length) toast(news.join(' · '));
      const a = document.activeElement;
      if (!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) && $('#modal').hidden) rerender();
    } catch (e) {
      if (force) toast('Sync failed: ' + e.message);
    } finally { syncing = null; }
  })();
  return syncing;
}
function recordOnline(j, s) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { recordSignature(j, {img: s.sig.img, w: img.naturalWidth, h: img.naturalHeight, name: s.sig.name, at: s.sig.at, method: 'online', agent: s.sig.agent, pdfUrl: s.pdfUrl || ''}); res(); };
    img.onerror = () => { recordSignature(j, {img: s.sig.img, w: 300, h: 100, name: s.sig.name, at: s.sig.at, method: 'online', agent: s.sig.agent}); res(); };
    img.src = s.sig.img;
  });
}
const bidsForJob = jobId => cloud.assigns.filter(a => a.jobId === jobId && a.bid && !['cancelled', 'declined'].includes(a.status));
const bidById = id => cloud.assigns.find(a => a.id === id);

/* ---------- team & sign-ins (admin) ---------- */
VIEWS.team = VIEWS.subs = {detail: true, render() {
  $('#top').innerHTML = `<a class="ib" href="#/more" data-a="back" aria-label="Back">${icon('back', 24)}</a><div class="title">Team &amp; sign-ins</div><button class="ib" data-a="teamload" aria-label="Refresh">${icon('refresh')}</button>`;
  main.innerHTML = teamHTML();
  if (isOwnerCloud() && !VIEWS.team.loaded) { VIEWS.team.loaded = true; ACT.teamload(); }
}};
const ROLE_LBL = {admin: ['Admin', '#8A6414', '#F6ECD3'], sub: ['Subcontractor', '#2B679B', '#E3EDF7']};
const rpill = r => { const x = ROLE_LBL[r] || [r, '#56636C', '#EAEEF0']; return `<span class="pill" style="color:${x[1]};background:${x[2]}">${x[0]}</span>`; };
function userStatus(u) {
  if (!u.active) return '<span class="pill" style="color:#A23B3B;background:#F5E0E0">Turned off</span>';
  if (u.mustChange) return `<span class="pill" style="color:#8A6414;background:#F6ECD3">${u.lastLogin ? 'Must set password' : 'Not signed in yet'}</span>`;
  return '<span class="pill" style="color:#2E7D4F;background:#E0F0E6">Active</span>';
}
function teamHTML() {
  if (!isOwnerCloud()) return `<div class="empty">Sign in to the cloud first (More → Cloud &amp; team).</div>`;
  const list = cloud.users.slice().sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1) || a.name.localeCompare(b.name));
  return `<section class="card"><h3>Add a person</h3>
      <div class="row"><label class="f"><span>Name</span><input id="nuName" placeholder="Raj Singh" autocomplete="off"></label><label class="f"><span>Username</span><input id="nuUser" placeholder="raj.singh" autocapitalize="none" autocomplete="off"></label></div>
      <div class="row"><label class="f"><span>Role</span><select id="nuRole"><option value="sub">Subcontractor</option><option value="admin">Admin (full access)</option></select></label><label class="f"><span>Trade</span><input id="nuTrade" placeholder="Fence crew" autocomplete="off"></label></div>
      <div class="row"><label class="f"><span>Phone</span><input id="nuPhone" type="tel" autocomplete="off"></label><label class="f"><span>Email</span><input id="nuEmail" type="email" autocomplete="off"></label></div>
      <button class="btn wide" data-a="useradd">${icon('plus', 18)} Create sign-in</button>
      <p class="hint" style="margin:8px 0 0">They get a temporary password and must set their own the first time they sign in.</p></section>
    ${list.map(u => { const me = settings.me && u.id === settings.me.id; return `<section class="card" style="${u.active ? '' : 'opacity:.65'}"><h3>${esc(u.name)}${me ? ' (you)' : ''} <em>${rpill(u.role)}</em></h3>
      <div class="jm" style="margin:0 0 8px">${userStatus(u)}<span>@${esc(u.username)}</span></div>
      <div class="hint" style="margin-bottom:10px">${[u.trade, u.phone, u.email].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}${u.lastLogin ? '<br>Last sign-in ' + fmtTs(u.lastLogin) : ''}</div>
      <div class="btns">${me ? `<button class="btn ghost" data-a="pwchange">Change my password</button>` : `<button class="btn ghost" data-a="userreset" data-id="${u.id}">${icon('send', 18)} New password &amp; send</button><button class="btn ghost" data-a="usermenu" data-id="${u.id}">More…</button>`}</div></section>`; }).join('')}`;
}
INPUT_HOOKS.push(t => {
  if (t.id === 'nuName') { const u = $('#nuUser'); if (u && !u.dataset.edited) u.value = normUser(t.value.trim().split(/\s+/).slice(0, 2).join('.')); return true; }
  if (t.id === 'nuUser') { t.dataset.edited = 1; return true; }
  return false;
});
ACT.teamload = async () => { try { setUsers(await api('usersList')); saveCloud(); if (/^#\/(team|subs)/.test(location.hash)) rerender(); } catch (e) { toast(e.message); } };
ACT.useradd = async () => {
  const user = {name: $('#nuName').value.trim(), username: normUser($('#nuUser').value || $('#nuName').value), role: $('#nuRole').value, trade: $('#nuTrade').value.trim(), phone: $('#nuPhone').value.trim(), email: $('#nuEmail').value.trim()};
  if (!user.name) return toast('Enter a name');
  try {
    const r = await api('userSave', {user});
    setUsers(cloud.users.concat([r.user])); saveCloud(); rerender();
    setTimeout(() => credsSheet(r.user, r.tempPassword), 250);
  } catch (e) { toast(e.message); }
};
ACT.userreset = async b => {
  const u = cloud.users.find(x => x.id === b.dataset.id); if (!u) return;
  if (!await ask(`Give ${u.name} a new temporary password? Their old password stops working and they'll set a new one.`, 'New password', false)) return;
  try { const r = await api('userResetPassword', {id: u.id}); Object.assign(u, r.user); saveCloud(); rerender(); setTimeout(() => credsSheet(r.user, r.tempPassword), 250); }
  catch (e) { toast(e.message); }
};
ACT.usermenu = b => {
  const u = cloud.users.find(x => x.id === b.dataset.id); if (!u) return;
  const m = sheet(`<h4>${esc(u.name)}</h4>
    <button class="opt" data-k="role">${icon('users')}<div><b>${u.role === 'admin' ? 'Make subcontractor' : 'Make admin'}</b><span>${u.role === 'admin' ? 'Only sees jobs sent to them' : 'Full access to everything'}</span></div></button>
    <button class="opt" data-k="toggle">${icon('x')}<div><b>${u.active ? 'Turn off sign-in' : 'Turn sign-in back on'}</b><span>${u.active ? 'Signs them out everywhere' : 'They can sign in again'}</span></div></button>
    <button class="opt" data-k="del" style="color:var(--red)">${icon('trash')}<div><b>Remove</b><span>Deletes this sign-in</span></div></button>`);
  m.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    const k = e.target.closest('[data-k]'); if (!k) return; closeSheet();
    try {
      if (k.dataset.k === 'role') { if (!await ask(u.role === 'admin' ? `Make ${u.name} a subcontractor? They lose admin access.` : `Make ${u.name} an admin? They will see all prices, clients and team sign-ins.`, 'Change', u.role !== 'admin')) return; const r = await api('userSave', {user: {id: u.id, role: u.role === 'admin' ? 'sub' : 'admin'}}); Object.assign(u, r.user); }
      if (k.dataset.k === 'toggle') { const r = await api('userSave', {user: {id: u.id, active: !u.active}}); Object.assign(u, r.user); }
      if (k.dataset.k === 'del') { if (!await ask(`Remove ${u.name}? They lose access right away.`, 'Remove')) return; await api('userDelete', {id: u.id}); cloud.users = cloud.users.filter(x => x.id !== u.id); }
      setUsers(cloud.users); saveCloud(); rerender();
    } catch (err) { toast(err.message); }
  };
};
async function apkLink() {
  try {
    if (NB && NB.apkBase64 && (!cloud.apk || cloud.apk.version !== appVersion() || !cloud.apk.url)) {
      toast('Preparing app download link…');
      const b64 = NB.apkBase64();
      if (b64) { cloud.apk = await api('appLink', {b64, version: appVersion()}); saveCloud(); return cloud.apk.url; }
    }
    if (!cloud.apk || !cloud.apk.url) { cloud.apk = await api('appLink', {}); saveCloud(); }
    return cloud.apk.url;
  } catch (e) { return ''; }
}
function signInMessage(u, temp, link) {
  const first = (u.name || '').split(/\s+/)[0];
  return `Hi ${first}, it's ${settings.bizName}. Here's your sign-in for our Redwood Jobs app.\n\n` +
    `1) Install the app\n   iPhone: open ${webAppUrl()} in Safari, tap Share, then "Add to Home Screen". Open it from your home screen.\n` +
    `   Android: ${link ? link + ' (allow installing from your browser if asked)' : 'ask me for the app file'}\n` +
    `2) Open Redwood Jobs, tap "Sign in" and paste this whole message. You'll set your own password.\n\n` +
    `Server: ${settings.cloudUrl}\nUsername: ${u.username}\nTemporary password: ${temp}`;
}
async function credsSheet(u, temp) {
  const link = await apkLink();
  const msg = signInMessage(u, temp, link);
  const m = sheet(`<h4>Sign-in for ${esc(u.name)}</h4>
    <div class="creds"><div><span>Username</span><b>${esc(u.username)}</b></div><div><span>Temporary password</span><b>${esc(temp)}</b></div></div>
    <p class="hint" style="margin:8px 0">Shown only now. Send it to them — they'll set their own password when they sign in.</p>
    <div class="sharegrid"><button data-s="whatsapp">${icon('msg')}WhatsApp</button><button data-s="sms">${icon('phone')}Text</button><button data-s="email">${icon('doc')}Email</button><button data-s="copy">${icon('copy')}Copy</button></div>
    ${NB && NB.shareApk ? `<button class="btn ghost wide" style="margin-top:10px" data-s="apk">Send the app file too (WhatsApp, Bluetooth…)</button>` : ''}`);
  m.onclick = e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    const b = e.target.closest('[data-s]'); if (!b) return; const t = b.dataset.s;
    if (t === 'apk') { const r = NB.shareApk(msg, 'any', phoneIntl(u.phone)); if (r) toast(r); return; }
    if (t === 'copy') return copyText(msg);
    shareTextVia(t, t === 'email' ? '' : phoneIntl(u.phone), u.email, 'Your Redwood Jobs sign-in', msg);
  };
}

/* ---------- job card: send to subs, prices ---------- */
const OWN_ST = {sent: ['Waiting for price', '#8A6414', '#F6ECD3'], bid: ['Price received', '#2B679B', '#E3EDF7'], awarded: ['Awarded', '#2E7D4F', '#E0F0E6'], notawarded: ['Not awarded', '#56636C', '#EAEEF0'], declined: ['Declined', '#A23B3B', '#F5E0E0']};
const opill = s => { const x = OWN_ST[s] || [s, '#56636C', '#EAEEF0']; return `<span class="pill" style="color:${x[1]};background:${x[2]}">${x[0]}</span>`; };
JOB_CARDS.beforeMoney.push(j => {
  if (!isOwnerCloud()) return `<section class="card"><h3>Subcontractors</h3><p class="hint" style="margin-bottom:10px">Send this job to your subs and get their prices back in the app.</p><a class="btn ghost wide" href="#/more">${icon('cloud', 18)} Sign in to cloud</a></section>`;
  const list = cloud.assigns.filter(a => a.jobId === j.id && a.status !== 'cancelled');
  return `<section class="card"><h3>Subcontractors <em>${list.length ? list.filter(a => a.bid).length + ' of ' + list.length + ' priced' : ''}</em></h3>
    ${list.map(a => {
      const stale = a.bid && a.sentAt > a.bid.at;
      return `<div class="asg"><div class="asg-h"><b>${esc(a.subName)}</b>${opill(a.status)}</div>
        ${a.bid ? `<div class="asg-bid"><b>${fmtMoney(a.bid.total)}</b><span> · ${fmtDate(isoOf(a.bid.at))}${a.bid.startDate ? ' · can start ' + fmtDate(a.bid.startDate) : ''}</span>
          ${a.bid.note ? `<div class="mut">"${esc(a.bid.note)}"</div>` : ''}${stale ? '<div class="jd due">You re-sent the job after this price</div>' : ''}</div>`
          : `<div class="mut" style="font-size:13.5px">Sent ${fmtDate(isoOf(a.sentAt))}${a.status === 'sent' ? (a.seenAt ? ' · opened' : ' · not opened yet') : ''}</div>`}
        ${a.status === 'awarded' ? `<div class="jd">${a.work ? 'Sub ' + (WORK[a.work] || a.work) : 'Waiting for sub to accept'}</div>` : ''}
        <div class="btns" style="margin-top:8px">${a.bid && ['bid', 'awarded'].includes(a.status) ? `<button class="btn ghost" data-a="asguse" data-id="${a.id}">Use in estimate</button>` : ''}${a.status === 'bid' ? `<button class="btn" data-a="asgaward" data-id="${a.id}">Award</button>` : ''}<button class="btn ghost" data-a="asgmenu" data-id="${a.id}">…</button></div></div>`;
    }).join('')}
    <button class="btn ${list.length ? 'ghost' : 'gold'} wide" style="margin-top:${list.length ? 10 : 0}px" data-a="asgsend">${icon('send', 18)} ${list.length ? 'Send / update for subs' : 'Send to subcontractors'}</button>
    ${list.length ? `<button class="add" style="margin-top:8px;width:100%" data-a="cloudsync">${icon('refresh', 16)} Check for prices</button>` : ''}</section>`;
});
function sheetLines(j) {
  if (j.est && j.est.lines.length) return j.est.lines.filter(l => l.src !== 'bid-extra').map(l => ({id: l.src || l.id, desc: l.desc, qty: num(l.qty), unit: l.unit}));
  return scopeLines(j).map(l => ({id: l.src, desc: l.desc, qty: l.qty, unit: l.unit}));
}
function buildSheet(j, opt) {
  const first = (j.client.name || '').trim().split(/\s+/)[0];
  return {ref: j.id.slice(-5).toUpperCase(), address: j.client.address || '', clientFirst: first, clientPhone: opt.phone ? j.client.phone : '',
    type: j.type, material: j.material, height: j.height, style: j.style, posts: j.posts, startDate: j.startDate || '',
    runs: j.runs.map(r => ({label: r.label, ft: num(r.ft)})), gates: j.gates.map(g => ({label: g.label, w: num(g.w)})),
    deck: j.deck.map(d => ({label: d.label, l: num(d.l), w: num(d.w)})), railingFt: num(j.railingFt), stairs: num(j.stairs),
    lines: sheetLines(j), notes: opt.notes || '', from: settings.bizName, fromPhone: settings.bizPhone};
}
ACT.asgsend = async (b, j) => {
  if (!j) return;
  if (!cloud.subs.length) { try { setUsers(await api('usersList')); } catch (e) {} }
  const subs = cloud.subs.filter(s => s.active);
  if (!subs.length) { if (await ask('You have no subcontractor sign-ins yet. Add one now?', 'Add', false)) location.hash = '#/team'; return; }
  const sent = new Set(cloud.assigns.filter(a => a.jobId === j.id && a.status !== 'cancelled').map(a => a.subId));
  const opt = j.subShare || {phone: false, photos: true, notes: j.notes.filter(n => !n.sys).map(n => n.t).reverse().join('\n')};
  const lines = sheetLines(j);
  const m = sheet(`<h4>Send job to subcontractors</h4><p class="hint">They see the address, measurements, notes and photos — never your prices.</p>
    <div style="max-height:150px;overflow:auto">${subs.map(s => `<label class="ck"><input type="checkbox" data-sub="${s.id}"${sent.has(s.id) ? ' checked' : ''}><span>${esc(s.name)}${s.trade ? ' <small class="mut">· ' + esc(s.trade) + '</small>' : ''}${sent.has(s.id) ? ' <small class="mut">(update)</small>' : ''}</span></label>`).join('')}</div>
    <label class="ck"><input type="checkbox" id="ssPhotos"${opt.photos ? ' checked' : ''}><span>Include photos (${j.photoCount || 0})</span></label>
    <label class="ck"><input type="checkbox" id="ssPhone"${opt.phone ? ' checked' : ''}><span>Share client's phone number</span></label>
    <label class="f" style="margin-top:8px"><span>Notes for subs</span><textarea id="ssNotes" rows="3">${esc(opt.notes)}</textarea></label>
    <p class="hint" style="margin:0 0 10px">They'll price ${lines.length} line${lines.length === 1 ? '' : 's'}: ${lines.map(l => esc(l.desc.split(' — ')[0]) + ' (' + l.qty + ' ' + esc(l.unit) + ')').join(', ')}</p>
    <button class="btn gold wide" data-k="go">${icon('send', 18)} Send</button>`);
  m.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    if (!e.target.closest('[data-k="go"]')) return;
    const subIds = [...m.querySelectorAll('[data-sub]:checked')].map(x => x.dataset.sub);
    if (!subIds.length) return toast('Pick at least one subcontractor');
    j.subShare = {phone: $('#ssPhone').checked, photos: $('#ssPhotos').checked, notes: $('#ssNotes').value.trim()};
    closeSheet(); saveJob(j, true);
    toast('Sending…');
    try {
      let photos = [];
      if (j.subShare.photos) {
        const up = new Set(j.cloudPhotos || []);
        photos = (await DB.photosFor(j.id)).sort((a, b) => a.ts - b.ts).slice(0, 15).map(p => up.has(p.id) ? {key: p.id} : {key: p.id, data: p.data.split(',')[1]});
      }
      const res = await api('assign', {jobId: j.id, subIds, sheet: buildSheet(j, j.subShare), photos});
      j.cloudPhotos = photos.map(p => p.key); saveJob(j, true);
      res.forEach(a => { cloud.assigns = cloud.assigns.filter(x => x.id !== a.id); cloud.assigns.push(a); });
      saveCloud(); rerender(); toast(`Sent to ${res.length} subcontractor${res.length === 1 ? '' : 's'}`);
    } catch (err) { toast('Send failed: ' + err.message); }
  };
};
function applyBid(j, a) {
  if (!j.est) j.est = newEstimate(j);
  const e = j.est, bid = a.bid;
  e.lines = e.lines.filter(l => l.src !== 'bid-extra');
  const used = new Set();
  e.lines.forEach(l => { const bl = bid.lines.find(x => x.id === l.id || (l.src && x.id === l.src)); if (bl) { l.cost = String(bl.rate); used.add(bl.id); } });
  bid.lines.filter(bl => !used.has(bl.id)).forEach(bl => { const sl = (a.lines || []).find(x => x.id === bl.id); if (sl) e.lines.push({id: uid(), src: '', desc: sl.desc, qty: sl.qty, unit: sl.unit, cost: String(bl.rate), rate: ''}); });
  (bid.extras || []).forEach(x => e.lines.push({id: uid(), src: 'bid-extra', desc: x.desc, qty: 1, unit: 'job', cost: String(x.amount), rate: ''}));
  e.bidFrom = a.id; saveJob(j, true);
}
ACT.asguse = (b, j) => { const a = bidById(b.dataset.id); if (!j || !a || !a.bid) return; applyBid(j, a); location.hash = '#/est/' + j.id; setTimeout(() => toast(`Using ${a.subName}'s price as your cost — set your markup`), 300); };
ACT.estbid = b => { const j = estJob(); const a = bidById(b.dataset.v); if (!j || !a || j.est.sig) return; applyBid(j, a); rerender(); toast(`Using ${a.subName}'s price (${fmtMoney(a.bid.total)}) as cost`); };
ACT.asgaward = async (b, j) => {
  const a = bidById(b.dataset.id); if (!j || !a) return;
  if (!await ask(`Award this job to ${a.subName} for ${fmtMoney(a.bid.total)}? Other subs on this job will see "Not awarded".`, 'Award', false)) return;
  try {
    const res = await api('assignSet', {id: a.id, status: 'awarded', othersNotAwarded: true, startDate: j.startDate || '', sheet: buildSheet(j, j.subShare || {phone: true})});
    res.forEach(x => { cloud.assigns = cloud.assigns.filter(y => y.id !== x.id); cloud.assigns.push(x); });
    const s = cloud.subs.find(x => x.id === a.subId);
    j.crew = a.subName; if (s && s.phone) j.crewPhone = s.phone;
    if (!num(j.labCost)) j.labCost = String(a.bid.total);
    j.notes.unshift({id: uid(), ts: Date.now(), t: `Awarded to ${a.subName} at ${fmtMoney(a.bid.total)}`, sys: true});
    saveJob(j, true); saveCloud(); rerender(); toast(`Awarded to ${a.subName}`);
  } catch (e) { toast(e.message); }
};
ACT.asgmenu = (b, j) => {
  const a = bidById(b.dataset.id); if (!j || !a) return;
  const s = cloud.subs.find(x => x.id === a.subId);
  const m = sheet(`<h4>${esc(a.subName)}</h4>
    ${s && s.phone ? `<a class="opt" href="tel:${digits(s.phone)}" style="text-decoration:none;color:inherit">${icon('phone')}<div><b>Call</b><span>${esc(s.phone)}</span></div></a>` : ''}
    ${a.bid ? `<button class="opt" data-k="detail">${icon('doc')}<div><b>Price breakdown</b><span>${fmtMoney(a.bid.total)}</span></div></button>` : ''}
    ${a.status === 'awarded' ? `<button class="opt" data-k="unaward">${icon('refresh')}<div><b>Undo award</b><span>Back to price received</span></div></button>` : ''}
    <button class="opt" data-k="cancel" style="color:var(--red)">${icon('x')}<div><b>Remove from this job</b><span>They stop seeing it</span></div></button>`);
  m.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    const k = e.target.closest('[data-k]'); if (!k) return;
    if (k.dataset.k === 'detail') {
      const L = (a.lines || []);
      return sheet(`<h4>${esc(a.subName)} — ${fmtMoney(a.bid.total)}</h4><table class="t">${a.bid.lines.map(bl => { const l = L.find(x => x.id === bl.id) || {desc: '?', qty: 0, unit: ''}; return `<tr><td>${esc(l.desc)}<br><small class="mut">${l.qty} ${esc(l.unit)} × ${money2(bl.rate)}</small></td><td class="r">${money2(bl.rate * l.qty)}</td></tr>`; }).join('')}
        ${(a.bid.extras || []).map(x => `<tr><td>${esc(x.desc)}</td><td class="r">${money2(x.amount)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r"><b>${money2(a.bid.total)}</b></td></tr></table>
        ${a.bid.note ? `<p class="hint" style="margin-top:10px">"${esc(a.bid.note)}"</p>` : ''}<button class="btn wide" style="margin-top:12px" data-close>Close</button>`);
    }
    closeSheet();
    try {
      if (k.dataset.k === 'cancel') { if (!await ask(`Remove ${a.subName} from this job?`, 'Remove')) return; await api('assignSet', {id: a.id, status: 'cancelled'}); cloud.assigns = cloud.assigns.filter(x => x.id !== a.id); }
      if (k.dataset.k === 'unaward') { const res = await api('assignSet', {id: a.id, status: a.bid ? 'bid' : 'sent'}); res.forEach(x => { cloud.assigns = cloud.assigns.filter(y => y.id !== x.id); cloud.assigns.push(x); }); }
      saveCloud(); rerender();
    } catch (err) { toast(err.message); }
  };
};

/* ---------- online signing ---------- */
function clientEst(j) {
  const e = j.est, c = estCalc(e);
  const fd = d => d ? parseISO(d).toLocaleDateString('en-CA', {year: 'numeric', month: 'short', day: 'numeric'}) : '';
  return {id: e.cloud && e.cloud.id || '', no: e.no, date: fd(e.date), validUntil: fd(validUntil(e)), tax: e.tax, depositPct: num(e.deposit),
    client: {name: jobName(j), address: j.client.address, phone: j.client.phone, email: j.client.email},
    biz: {name: settings.bizName, phone: settings.bizPhone, email: settings.bizEmail, web: settings.bizWeb, address: settings.bizAddress, hstNo: settings.hstNo},
    rows: c.rows.map(r => ({desc: r.l.desc, qty: num(r.l.qty), unit: r.l.unit, rate: r.rate, amt: r.amt})),
    sub: c.sub, disc: c.disc, discLabel: discLabel(e), net: c.net, taxAmt: c.tax, total: c.total, dep: c.dep, scope: e.scope, terms: termsText(e), project: [j.type, j.material].filter(Boolean).join(' · '), jobId: j.id};
}
ACT.estlink = async () => {
  const j = estJob(); if (!j || j.est.sig) return;
  if (!isOwnerCloud()) { if (await ask('Online signing uses your cloud server. Set it up now?', 'Set up', false)) location.hash = '#/more'; return; }
  if (!estCalc(j.est).total) return toast('Add prices before sending');
  toast('Creating signing link…');
  try {
    const r = await api('estSave', {est: clientEst(j)});
    const url = settings.cloudUrl + (settings.cloudUrl.includes('?') ? '&' : '?') + 'page=sign&id=' + r.id;
    j.est.cloud = {id: r.id, url, sentAt: Date.now()};
    markSent(j); rerender(); linkSheet(j);
  } catch (e) { toast('Could not create link: ' + e.message); }
};
function linkSheet(j) {
  const e = j.est, c = estCalc(e), first = (j.client.name || '').trim().split(/\s+/)[0];
  const msg = `Hi${first ? ' ' + first : ''}, here is your estimate #${e.no} from ${settings.bizName} (${money2(c.total)}${e.tax === 'hst' ? ' incl. HST' : ''}). You can review and sign it on your phone:\n${e.cloud.url}\n\n${settings.bizName}${settings.bizPhone ? ' · ' + settings.bizPhone : ''}`;
  const m = sheet(`<h4>Send signing link</h4><p class="hint">The client opens the link, reviews the estimate and terms, and signs with their finger. You get the signed PDF by email and the job turns Booked here.</p>
    <div class="sharegrid"><button data-s="whatsapp">${icon('msg')}WhatsApp</button><button data-s="sms">${icon('phone')}Text</button><button data-s="email">${icon('doc')}Email</button><button data-s="copy">${icon('copy')}Copy</button></div>`);
  m.onclick = ev => {
    if (ev.target.closest('[data-close]')) return closeSheet();
    const b = ev.target.closest('[data-s]'); if (!b) return; closeSheet();
    if (b.dataset.s === 'copy') copyText(msg); else shareTextVia(b.dataset.s, phoneIntl(j.client.phone), j.client.email, `Estimate #${e.no} — ${settings.bizName}`, msg);
  };
}
ACT.estcheck = async () => {
  const j = estJob(); if (!j || !j.est.cloud) return;
  try {
    const st = await api('estStatus', {ids: [j.est.cloud.id]});
    const s = st[0];
    if (s && s.status === 'signed' && s.sig && s.sig.img) { await recordOnline(j, s); rerender(); toast(`Signed by ${s.sig.name}`); }
    else if (s && s.status === 'cancelled') { toast('That link was cancelled'); }
    else toast(s && s.viewedAt ? 'Client opened it — not signed yet' : 'Not opened yet');
  } catch (e) { toast(e.message); }
};
ACT.esturl = () => { const j = estJob(); if (j && j.est.cloud) linkSheet(j); };

/* ================= SUBCONTRACTOR MODE ================= */
const SUB_ST = {sent: ['Needs your price', '#B5541F', '#F8E6DA'], bid: ['Price sent', '#2B679B', '#E3EDF7'], awarded: ['Awarded to you', '#2E7D4F', '#E0F0E6'], notawarded: ['Not awarded', '#56636C', '#EAEEF0'], declined: ['Declined', '#A23B3B', '#F5E0E0']};
const spill = s => { const x = SUB_ST[s] || [s, '#56636C', '#EAEEF0']; return `<span class="pill" style="color:${x[1]};background:${x[2]}">${x[0]}</span>`; };
function subTabs(view) {
  $('#tabs').innerHTML = [['jobs', 'My jobs', 'jobs'], ['more', 'Account', 'more']].map(([k, l, i]) => `<a href="#/${k}" class="${view === k ? 'on' : ''}"><span class="ic">${icon(i, 21)}</span>${l}</a>`).join('');
}
function subRoute(view, id, keep) {
  if (!signedIn()) return renderSignIn();
  if (view === 'sj' && id) return renderSubJob(id, keep);
  document.body.classList.remove('detail');
  if (view === 'more') {
    subTabs('more');
    $('#top').innerHTML = `<div class="title">Account</div>`;
    main.innerHTML = `<section class="card"><h3>Signed in</h3><p style="margin:0 0 2px"><b>${esc(settings.me.name)}</b> <span class="mut">@${esc(settings.me.username)}</span></p><p class="hint">Subcontractor for ${esc(settings.subBiz || 'the company')}</p>
      <div class="btns"><button class="btn ghost" data-a="pwchange">Change password</button><button class="btn ghost" data-a="signout">Sign out</button></div></section>
      <section class="card"><h3>Use as my own tracker</h3><p class="hint">Switch this phone to business mode to track your own jobs. This signs you out.</p><button class="btn ghost wide" data-a="subtoowner">Switch to business mode</button></section>
      <div class="about">Redwood Jobs ${esc(appVersion())}</div>`;
    return;
  }
  subTabs('jobs');
  $('#top').innerHTML = `<div class="brand"><small>${esc(settings.subBiz || 'Redwood Jobs')}</small><b>My jobs</b></div><button class="ib" data-a="subrefresh" aria-label="Refresh">${icon('refresh')}</button>`;
  main.innerHTML = subJobsHTML();
  if (!keep && Date.now() - subData.at > 10000) subRefresh();
}
ACT.subtoowner = async () => {
  if (!await ask('Switch this phone to business mode? You will be signed out of your subcontractor account.', 'Switch', false)) return;
  api('logout').catch(() => {});
  Object.assign(settings, {role: 'owner', token: '', me: null, mustChange: false}); saveSettings(); location.hash = '#/jobs'; route();
};
ACT.subrefresh = () => subRefresh(true);
let subLoading = null;
function subRefresh(loud) {
  if (subLoading) return subLoading;
  subLoading = api('subJobs').then(list => {
    const before = new Map(subData.jobs.map(a => [a.id, a]));
    const fresh = list.filter(a => !before.has(a.id)).length, awarded = list.filter(a => a.status === 'awarded' && before.get(a.id) && before.get(a.id).status !== 'awarded').length;
    subData.jobs = list; subData.at = Date.now(); saveSub();
    if (subData.at && (fresh || awarded) && before.size) toast([fresh ? `${fresh} new job${fresh > 1 ? 's' : ''}` : '', awarded ? 'You were awarded a job!' : ''].filter(Boolean).join(' · '));
    else if (loud) toast('Up to date');
    const a = document.activeElement;
    if (!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) && $('#modal').hidden) rerender();
  }).catch(e => {
    if (loud || !subData.jobs.length) toast(e.message);
  }).finally(() => { subLoading = null; });
  return subLoading;
}
function sheetSummary(s) {
  const ft = (s.runs || []).reduce((a, r) => a + num(r.ft), 0), sq = (s.deck || []).reduce((a, d) => a + d.l * d.w, 0);
  return [s.type, s.material, ft ? r1(ft) + ' ft' : '', (s.gates || []).length ? s.gates.length + ' gate' + (s.gates.length > 1 ? 's' : '') : '', sq ? Math.round(sq) + ' sq ft' : ''].filter(Boolean).join(' · ');
}
function subJobsHTML() {
  const L = subData.jobs;
  const ib = typeof installBanner === 'function' ? installBanner() : '';
  if (!L.length) return ib + `<div class="empty"><div class="big">${icon('jobs', 40)}</div><b>No jobs yet</b>When ${esc(settings.subBiz || 'the company')} sends you a job, it shows up here.<br><br><button class="btn ghost" data-a="subrefresh">${icon('refresh', 18)} Check now</button></div>`;
  const groups = [['Needs your price', a => a.status === 'sent'], ['Awarded to you', a => a.status === 'awarded'], ['Price sent', a => a.status === 'bid'], ['Closed', a => ['notawarded', 'declined'].includes(a.status)]];
  return ib + groups.map(([t, f]) => { const g = L.filter(f).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); return g.length ? `<div class="grp"><span>${t}</span><span>${g.length}</span></div>` + g.map(a => {
    const s = a.sheet || {};
    return `<a class="job" href="#/sj/${a.id}" style="--sc:${(SUB_ST[a.status] || [0, '#56636C'])[1]}"><div class="jt"><b>${esc((s.address || 'Job ' + s.ref).split('\n')[0])}</b>${a.bid ? `<span class="amt">${fmtMoney(a.bid.total)}</span>` : ''}</div>
      <div class="jm">${spill(a.status)}<span>${esc(sheetSummary(s))}</span></div>
      ${a.status === 'awarded' && (a.startDate || s.startDate) ? `<div class="jd">Start ${fmtDate(a.startDate || s.startDate, true)}${a.work ? ' · ' + esc(a.work) : ''}</div>` : `<div class="jd" style="color:var(--mut);font-weight:500">Sent ${fmtDate(isoOf(a.sentAt))}</div>`}</a>`;
  }).join('') : ''; }).join('');
}
const subJob = id => subData.jobs.find(x => x.id === id);
const subCur = () => { const m = (location.hash || '').match(/^#\/sj\/(.+)$/); return m ? subJob(m[1]) : null; };
function draftFor(a) {
  if (!subData.drafts[a.id]) subData.drafts[a.id] = {rates: Object.fromEntries((a.bid ? a.bid.lines : []).map(l => [l.id, String(l.rate)])), extras: a.bid ? a.bid.extras.map(x => ({desc: x.desc, amount: String(x.amount)})) : [], note: a.bid ? a.bid.note : '', start: a.bid ? a.bid.startDate : ''};
  return subData.drafts[a.id];
}
function draftTotal(a) {
  const d = draftFor(a), s = a.sheet || {};
  return (s.lines || []).reduce((t, l) => t + num(d.rates[l.id]) * num(l.qty), 0) + d.extras.reduce((t, x) => t + num(x.amount), 0);
}
function renderSubJob(id, keep) {
  const a = subJob(id); if (!a) { location.replace('#/jobs'); return; }
  document.body.classList.add('detail');
  const s = a.sheet || {};
  $('#top').innerHTML = `<a class="ib" href="#/jobs" data-a="back" aria-label="Back">${icon('back', 24)}</a><div class="title">${esc((s.address || 'Job').split('\n')[0])}</div>`;
  const editable = a.status === 'sent' || a.status === 'bid', d = draftFor(a);
  const addr = (s.address || '').trim();
  const meas = [];
  if ((s.runs || []).length) meas.push(`<div class="sub" style="margin-top:0">Fence runs</div>${s.runs.map(r => `<div class="trow"><span>${esc(r.label || 'Run')}</span><b>${r.ft} ft</b></div>`).join('')}<div class="trow big"><span>Total</span><b>${r1(s.runs.reduce((t, r) => t + num(r.ft), 0))} ft</b></div>`);
  if ((s.gates || []).length) meas.push(`<div class="sub">Gates</div>${s.gates.map(g => `<div class="trow"><span>${esc(g.label || 'Gate')}</span><b>${g.w ? g.w + ' ft' : ''}</b></div>`).join('')}`);
  if ((s.deck || []).length) meas.push(`<div class="sub">Deck</div>${s.deck.map(x => `<div class="trow"><span>${esc(x.label || 'Section')} ${x.l} × ${x.w} ft</span><b>${Math.round(x.l * x.w)} sq ft</b></div>`).join('')}${s.railingFt ? `<div class="trow"><span>Railing</span><b>${s.railingFt} ft</b></div>` : ''}${s.stairs ? `<div class="trow"><span>Stairs</span><b>${s.stairs} steps</b></div>` : ''}`);
  main.innerHTML = `<div class="jm" style="margin:0 0 12px">${spill(a.status)}${a.status === 'awarded' && a.work ? `<span>You: ${esc(a.work)}</span>` : ''}</div>
    <div class="quick" style="grid-template-columns:repeat(${s.clientPhone ? 3 : 2},1fr)">
      ${addr ? `<a class="qa" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}" target="_blank" rel="noopener">${icon('pin')}Map</a>` : `<button class="qa" disabled>${icon('pin')}Map</button>`}
      ${s.clientPhone ? `<a class="qa" href="tel:${digits(s.clientPhone)}">${icon('phone')}Client</a>` : ''}
      ${s.fromPhone ? `<a class="qa" href="tel:${digits(s.fromPhone)}">${icon('phone')}Office</a>` : `<button class="qa" disabled>${icon('phone')}Office</button>`}
    </div>
    <section class="card"><h3>Job <em>Ref ${esc(s.ref || '')}</em></h3>
      ${addr ? `<p style="margin:0 0 8px;white-space:pre-wrap"><b>${esc(addr)}</b></p>` : ''}
      ${[['Client', s.clientFirst], ['Type', s.type], ['Material', s.material], ['Height', s.height ? s.height + ' ft' : ''], ['Style / colour', s.style], ['Posts / framing', s.posts], ['Start date', (a.startDate || s.startDate) ? fmtDate(a.startDate || s.startDate, true) : '']].filter(x => x[1]).map(([k, v]) => `<div class="trow"><span class="mut">${k}</span><b style="text-align:right">${esc(v)}</b></div>`).join('')}
    </section>
    ${meas.length ? `<section class="card"><h3>Measurements</h3>${meas.join('')}</section>` : ''}
    ${s.notes ? `<section class="card"><h3>Notes from ${esc(s.from || 'the office')}</h3><div style="white-space:pre-wrap">${esc(s.notes)}</div></section>` : ''}
    ${(a.photoIds || []).length ? `<section class="card"><h3>Photos <em>${a.photoIds.length}</em></h3><div class="photos" id="sphotos">${a.photoIds.map((f, i) => `<button class="ph" data-a="sphoto" data-i="${i}"><span class="mut" style="font-size:12px">Loading…</span></button>`).join('')}</div></section>` : ''}
    <section class="card"><h3>Your price <em data-sbt>${money2(draftTotal(a))}</em></h3>
      ${a.bid ? `<p class="hint">You sent ${money2(a.bid.total)} on ${fmtDate(isoOf(a.bid.at))}.${editable ? ' You can update it until the job is awarded.' : ''}</p>` : `<p class="hint">Enter your rate for each item — materials and labour included unless you note otherwise.</p>`}
      ${(s.lines || []).map(l => `<div class="eline"><div style="font-weight:600;margin-bottom:6px">${esc(l.desc)}</div>
        <div class="egrid" style="grid-template-columns:1fr 1.2fr 1.2fr"><label><span>Qty</span><input value="${l.qty} ${esc(l.unit)}" disabled></label>
        <label><span>Your rate / ${esc(l.unit)}</span><input data-sb="${l.id}" value="${esc(d.rates[l.id] || '')}" inputmode="decimal" placeholder="0"${editable ? '' : ' disabled'}></label>
        <label><span>Amount</span><input data-sba="${l.id}" value="${money2(num(d.rates[l.id]) * num(l.qty))}" disabled></label></div></div>`).join('')}
      <div class="sub">Extras</div>
      ${d.extras.map((x, i) => `<div class="li"><input data-sx="${i}" data-k="desc" value="${esc(x.desc)}" placeholder="e.g. Haul away old fence"${editable ? '' : ' disabled'}><input class="n" data-sx="${i}" data-k="amount" value="${esc(x.amount)}" inputmode="decimal" placeholder="$"${editable ? '' : ' disabled'}>${editable ? `<button class="ix" data-a="sxrm" data-i="${i}" aria-label="Remove">${icon('x', 18)}</button>` : ''}</div>`).join('')}
      ${editable ? `<button class="add" data-a="sxadd">+ Add extra</button>` : ''}
      <div class="row" style="margin-top:12px"><label class="f"><span>Earliest start</span><input type="date" data-sn="start" value="${esc(d.start || '')}"${editable ? '' : ' disabled'}></label><span></span></div>
      <label class="f"><span>Note to ${esc(s.from || 'office')}</span><textarea data-sn="note" rows="2" placeholder="What's included, timing, questions…"${editable ? '' : ' disabled'}>${esc(d.note || '')}</textarea></label>
      <div class="trow big"><span>Total</span><b data-sbt2>${money2(draftTotal(a))}</b></div>
      ${editable ? `<button class="btn gold wide" style="margin-top:10px" data-a="subsend">${icon('send', 18)} ${a.bid ? 'Update my price' : 'Send my price'}</button>
        <button class="add" style="width:100%;margin-top:10px;color:var(--red)" data-a="subdecline">Not interested — decline</button>` : ''}
    </section>
    ${a.status === 'awarded' ? `<section class="card"><h3>Work status</h3><div class="seg">${[['accepted', 'Accepted'], ['started', 'Started'], ['done', 'Finished']].map(([k, l]) => `<button class="${a.work === k ? 'on' : ''}" data-a="subwork" data-v="${k}">${l}</button>`).join('')}</div><p class="hint" style="margin:10px 0 0">Updates the office right away.</p></section>` : ''}
    ${a.status === 'notawarded' ? `<section class="card"><p class="hint" style="margin:0">This job went to someone else this time. Thanks for pricing it.</p></section>` : ''}`;
  loadSubPhotos(a);
  if (!subData.seen[a.id] && a.status === 'sent') { subData.seen[a.id] = 1; saveSub(); api('subUpdate', {id: a.id, work: 'seen'}).catch(() => {}); }
}
const subPhotoCache = {};
async function loadSubPhotos(a) {
  for (let i = 0; i < (a.photoIds || []).length; i++) {
    const f = a.photoIds[i];
    let src = subPhotoCache[f];
    if (!src) { try { src = await DB.get('kv', 'ph:' + f); } catch (e) {} }
    if (!src) { try { const r = await api('subPhoto', {fileId: f}); src = `data:${r.mime || 'image/jpeg'};base64,${r.data}`; DB.put('kv', src, 'ph:' + f).catch(() => {}); } catch (e) { continue; } }
    subPhotoCache[f] = src;
    const btn = main.querySelector(`[data-a="sphoto"][data-i="${i}"]`); if (btn) btn.innerHTML = `<img src="${src}" alt="Job photo ${i + 1}">`;
  }
}
ACT.sphoto = b => {
  const a = subCur(); if (!a) return; const f = a.photoIds[+b.dataset.i], src = subPhotoCache[f]; if (!src) return;
  sheet(`<div class="vtop"><span>Photo ${+b.dataset.i + 1} / ${a.photoIds.length}</span><button class="ib" data-close aria-label="Close">${icon('x', 24)}</button></div><div class="vimg"><img src="${src}" alt="Job photo"></div>`, 'viewer');
};
INPUT_HOOKS.push(t => {
  if (!t.dataset.sb && !t.dataset.sx && !t.dataset.sn) return false;
  const a = subCur(); if (!a) return true; const d = draftFor(a);
  if (t.dataset.sb) { d.rates[t.dataset.sb] = t.value; const l = (a.sheet.lines || []).find(x => x.id === t.dataset.sb); const o = main.querySelector(`[data-sba="${t.dataset.sb}"]`); if (o && l) o.value = money2(num(t.value) * num(l.qty)); }
  if (t.dataset.sx) d.extras[+t.dataset.sx][t.dataset.k] = t.value;
  if (t.dataset.sn) d[t.dataset.sn] = t.value;
  const tot = money2(draftTotal(a)); main.querySelectorAll('[data-sbt],[data-sbt2]').forEach(x => { x.textContent = tot; });
  saveSub(); return true;
});
ACT.sxadd = () => { const a = subCur(); if (!a) return; draftFor(a).extras.push({desc: '', amount: ''}); saveSub(); rerender(); const i = main.querySelectorAll('[data-sx][data-k="desc"]'); if (i.length) i[i.length - 1].focus(); };
ACT.sxrm = b => { const a = subCur(); if (!a) return; draftFor(a).extras.splice(+b.dataset.i, 1); saveSub(); rerender(); };
ACT.subsend = async () => {
  const a = subCur(); if (!a) return; const d = draftFor(a);
  const total = draftTotal(a); if (!total) return toast('Enter at least one rate');
  if (!await ask(`Send your price of ${money2(total)} to ${a.sheet.from || 'the office'}?`, 'Send', false)) return;
  try {
    const r = await api('subBid', {id: a.id, lines: (a.sheet.lines || []).map(l => ({id: l.id, rate: num(d.rates[l.id])})), extras: d.extras.filter(x => x.desc && num(x.amount)).map(x => ({desc: x.desc, amount: num(x.amount)})), note: d.note || '', startDate: d.start || ''});
    Object.assign(a, r); saveSub(); rerender(); toast('Price sent');
  } catch (e) { toast(e.message); }
};
ACT.subdecline = async () => {
  const a = subCur(); if (!a) return;
  if (!await ask('Decline this job? The office will see that you passed on it.', 'Decline')) return;
  try { const r = await api('subUpdate', {id: a.id, work: 'declined'}); Object.assign(a, r); saveSub(); location.hash = '#/jobs'; } catch (e) { toast(e.message); }
};
ACT.subwork = async b => {
  const a = subCur(); if (!a) return;
  try { const r = await api('subUpdate', {id: a.id, work: b.dataset.v}); Object.assign(a, r); saveSub(); rerender(); toast('Office updated'); } catch (e) { toast(e.message); }
};

function jobBadges(j) {
  if (!isOwnerCloud()) return '';
  const L = cloud.assigns.filter(a => a.jobId === j.id && a.status !== 'cancelled');
  if (!L.length) return '';
  const priced = L.filter(a => a.bid && a.status === 'bid').length, aw = L.find(a => a.status === 'awarded');
  if (aw) return `<div class="jd">Sub: ${esc(aw.subName)}${aw.work ? ' · ' + esc(WORK[aw.work] || aw.work) : ''}</div>`;
  return `<div class="jd" style="color:#2B679B">${priced ? priced + ' sub price' + (priced > 1 ? 's' : '') + ' in' : 'Waiting on ' + L.length + ' sub price' + (L.length > 1 ? 's' : '')}</div>`;
}
function estBadge(j) {
  if (!j.est) return '';
  if (j.est.sig) return '';
  if (j.est.cloud) return `<div class="jd" style="color:#2B679B">Estimate #${j.est.no} waiting for signature${j.est.cloud.viewedAt ? ' · opened' : ''}</div>`;
  return '';
}
