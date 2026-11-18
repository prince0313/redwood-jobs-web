'use strict';
/* ================= Estimates, PDF, signatures ================= */
const HST_RATE = 13;
const UNITS = ['ft', 'sq ft', 'each', 'job', 'step', 'post', 'section', 'hr', 'day', 'yd', 'load'];
const EXTRAS = [['Remove & dispose of old fence', 'ft'], ['Disposal bin', 'job'], ['Permit & locates', 'job'], ['Post hole digging — rock/concrete', 'post'], ['Stain / seal', 'sq ft'], ['Gate hardware upgrade', 'each']];
const DEFAULT_TERMS = `1. Scope of Work: {biz} will supply the labour and materials and complete the work described in this estimate. Anything not listed is not included.

2. Price & Validity: This estimate is valid for {valid} days from the estimate date.

3. Payment: The deposit shown is due on signing. The balance is due on the day the work is completed. Payment by e-Transfer, cheque or cash.

4. Property Lines: The client is responsible for identifying property lines and the fence location, and for any agreement with neighbours. {biz} is not responsible for disputes about placement.

5. Underground Services & Permits: {biz} will book public utility locates before digging. The client is responsible for marking private lines (sprinklers, lighting, gas, septic) and for permits or HOA approval unless listed in this estimate.

6. Site Conditions: If rock, large roots, concrete or other obstructions are found while digging, any extra cost will be discussed and agreed before that work continues.

7. Timeline: Work will start on a mutually agreed date. Delays due to weather, locates or material supply will be communicated promptly.

8. Materials: All materials are professional grade. Natural wood can twist, check, shrink and vary in colour; this is not a defect. Substitutions will only be made with the client's approval.

9. Changes: Any change to the scope must be agreed in writing (text or email is fine) and may change the price.

10. Access & Cleanup: The client will provide clear access to the work area during working hours. {biz} will remove its construction debris when the work is complete.

11. Warranty: Workmanship is warranted for 1 year from completion. Manufacturer warranties apply to materials. The warranty does not cover damage from misuse, alterations by others, or unusual ground movement.

12. Cancellation: If the client cancels after materials have been ordered, the deposit may be kept to cover materials and costs already incurred.

13. Acceptance: By signing, the client confirms they have read, understood and agree to this estimate and these terms. An electronic signature has the same effect as a handwritten one.`;
Object.assign(DEFAULTS, {
  bizEmail: '', bizWeb: 'redwoodbuilders.ca', bizAddress: '', hstNo: '', logo: '', logoW: 0, logoH: 0,
  markup: '25', depositPct: '30', defaultTax: 'hst', validDays: '30', nextEstNo: 1001, terms: DEFAULT_TERMS, rateMem: {},
});
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const termsText = e => (e.terms || '').replace(/\{biz\}/g, settings.bizName).replace(/\{valid\}/g, e.validDays || settings.validDays || 30);
const estJob = () => { const m = (location.hash || '').match(/^#\/est\/(.+)$/); return m ? jobs.find(j => j.id === m[1]) : null; };
const digits = s => String(s || '').replace(/\D/g, '');

/* ---------- model ---------- */
function scopeLines(j) {
  const c = calc(j), L = [], mat = (j.material || '').toLowerCase();
  if (hasFence(j) && c.ft) L.push({src: 'fence', desc: `Supply & install ${j.height ? j.height + ' ft ' : ''}${mat ? mat + ' ' : ''}fence${j.style ? ' — ' + j.style : ''}`, qty: c.ft, unit: 'ft'});
  if (hasFence(j)) j.gates.forEach(g => L.push({src: 'gate-' + g.id, desc: `${g.label || 'Gate'}${num(g.w) ? ', ' + num(g.w) + ' ft wide' : ''} — supply & install`, qty: 1, unit: 'each'}));
  if (hasDeck(j) && c.sqft) L.push({src: 'deck', desc: `Build ${mat ? mat + ' ' : ''}deck (${j.deck.map(d => `${d.label ? d.label + ' ' : ''}${num(d.l)} × ${num(d.w)} ft`).join(', ')})`, qty: Math.round(c.sqft), unit: 'sq ft'});
  if (hasDeck(j) && num(j.railingFt)) L.push({src: 'rail', desc: `Railing${mat ? ' — ' + mat : ''}`, qty: num(j.railingFt), unit: 'ft'});
  if (hasDeck(j) && num(j.stairs)) L.push({src: 'stairs', desc: 'Stairs', qty: num(j.stairs), unit: 'step'});
  if (!L.length) L.push({src: 'job', desc: j.type === 'Renovation' ? 'Renovation work as described' : 'Work as described', qty: 1, unit: 'job'});
  return L;
}
const memKey = (l, j) => (l.src || '').replace(/^gate-.*/, 'gate') + '|' + (j.material || '');
function linesFromJob(j) {
  return scopeLines(j).map(l => ({id: uid(), src: l.src, desc: l.desc, qty: l.qty, unit: l.unit, cost: '', rate: (settings.rateMem || {})[memKey(l, j)] || ''}));
}
function defaultScope(j) {
  const bits = [];
  if (j.posts) bits.push('Posts / framing: ' + j.posts + '.');
  if (j.style) bits.push('Style / colour: ' + j.style + '.');
  return bits.join(' ');
}
function newEstimate(j) {
  const e = {no: num(settings.nextEstNo) || 1001, date: todayISO(), validDays: settings.validDays || '30', tax: settings.defaultTax || 'hst',
    markup: settings.markup || '25', deposit: settings.depositPct || '30', lines: linesFromJob(j), scope: defaultScope(j), terms: settings.terms || DEFAULT_TERMS,
    disc: {type: 'pct', value: '', label: ''}, sig: null, bidFrom: '', cloud: null, sentAt: 0};
  settings.nextEstNo = e.no + 1; saveSettings();
  return e;
}
const hasOverride = l => l.rate !== '' && l.rate != null && String(l.rate).trim() !== '';
const lineRate = (l, e) => hasOverride(l) ? num(l.rate) : num(l.cost) * (1 + num(e.markup) / 100);
function estCalc(e) {
  let sub = 0, cost = 0;
  const rows = e.lines.map(l => { const rate = round2(lineRate(l, e)); const amt = round2(num(l.qty) * rate); sub += amt; cost += num(l.qty) * num(l.cost); return {l, rate, amt}; });
  sub = round2(sub); cost = round2(cost);
  const d = e.disc || {}, dv = num(d.value);
  const disc = dv > 0 ? round2(Math.min(sub, d.type === 'amt' ? dv : sub * dv / 100)) : 0, net = round2(sub - disc);
  const tax = e.tax === 'hst' ? round2(net * HST_RATE / 100) : 0, total = round2(net + tax);
  return {rows, sub, disc, net, tax, total, dep: round2(total * num(e.deposit) / 100), cost, profit: round2(net - cost), margin: net ? (net - cost) / net * 100 : 0};
}
const discLabel = e => { const d = e.disc || {}; return (d.label || '').trim() || (d.type === 'amt' ? 'Discount' : `Discount (${num(d.value)}%)`); };
const money2 = n => '$' + (n || 0).toLocaleString('en-CA', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const validUntil = e => addDays(e.date || todayISO(), num(e.validDays) || 30);
function applyEstimate(j, quiet) {
  const e = j.est, c = estCalc(e);
  j.price = String(c.net); j.taxAmt = c.tax;
  let note = '';
  if (e.bidFrom && c.cost > 0) { j.labCost = String(c.cost); const b = (typeof bidById === 'function') && bidById(e.bidFrom); if (b && b.subName) j.crew = b.subName; }
  else if (c.cost > 0 && !num(j.matCost) && !num(j.labCost) && !num(j.otherCost)) { j.labCost = String(c.cost); note = ' · cost put in Labour / sub'; }
  saveJob(j, true);
  if (!quiet) toast(`Contract price set to ${fmtMoney(c.net)}${c.tax ? ' + HST ' + fmtMoney(c.tax) : ''}${note}`);
}
function markSent(j) {
  const e = j.est; e.sentAt = Date.now();
  if (j.status === 'lead') { j.status = 'quoted'; if (!j.quoteDate) j.quoteDate = todayISO(); j.notes.unshift({id: uid(), ts: Date.now(), t: `Status: Lead → Quoted (estimate #${e.no} sent)`, sys: true}); }
  saveJob(j, true);
}

/* ---------- job card ---------- */
JOB_CARDS.beforeMoney.push(j => {
  if (!j.est) return `<section class="card"><h3>Estimate</h3><p class="hint">Build a priced estimate from these measurements — HST or cash, PDF to share, client signs on your phone or online.</p><button class="btn gold wide" data-a="estopen">${icon('doc', 18)} Create estimate</button></section>`;
  const e = j.est, c = estCalc(e);
  const st = e.sig ? `<span class="pill" style="color:#2E7D4F;background:#E0F0E6">Signed</span>` : e.cloud ? `<span class="pill" style="color:#2B679B;background:#E3EDF7">Waiting for signature</span>` : e.sentAt ? `<span class="pill" style="color:#8A6414;background:#F6ECD3">Sent</span>` : `<span class="pill" style="color:#56636C;background:#EAEEF0">Draft</span>`;
  return `<section class="card"><h3>Estimate <em>#${e.no}</em></h3>
    <div class="jm" style="margin:0 0 10px">${st}<span>${e.tax === 'hst' ? 'HST 13%' : 'Cash — no HST'}${e.sig ? ' · signed by ' + esc(e.sig.name) + ' ' + fmtDate(isoOf(e.sig.at)) : ''}</span></div>
    <div class="kpis"><div class="kpi"><span>Client total</span><b>${money2(c.total)}</b></div><div class="kpi"><span>Your profit · ${Math.round(c.margin)}%</span><b class="${c.profit < 0 ? 'neg' : 'pos'}">${fmtMoney(c.profit)}</b></div></div>
    <div class="btns" style="margin-top:10px"><button class="btn" data-a="estopen">Open estimate</button><button class="btn ghost" data-a="estshare">${icon('share', 18)} Send PDF</button></div></section>`;
});
ACT.estopen = (b, j) => { if (!j) return; if (!j.est) { j.est = newEstimate(j); saveJob(j, true); } location.hash = '#/est/' + j.id; };
ACT.estshare = (b, j) => { j = j || estJob(); if (j && j.est) shareSheet(j); };

/* ---------- estimate screen ---------- */
VIEWS.est = {detail: true, render(id) {
  const j = jobs.find(x => x.id === id); if (!j) return false;
  if (!j.est) { j.est = newEstimate(j); saveJob(j, true); }
  const e = j.est;
  $('#top').innerHTML = `<a class="ib" href="#/job/${j.id}" data-a="back" aria-label="Back">${icon('back', 24)}</a><div class="title">Estimate #${e.no}<small style="display:block;font-size:12px;font-weight:600;color:var(--gold)">${esc(jobName(j))}</small></div><button class="ib" data-a="estshare" aria-label="Share PDF">${icon('share')}</button>`;
  main.innerHTML = estHTML(j);
}};
function estHTML(j) {
  const e = j.est, c = estCalc(e), lock = !!e.sig, dis = lock ? ' disabled' : '';
  const bids = typeof bidsForJob === 'function' ? bidsForJob(j.id) : [];
  const f = (label, k, v, o = {}) => `<label class="f"><span>${label}</span><input data-e="${k}" value="${esc(v)}" type="${o.type || 'text'}"${o.im ? ` inputmode="${o.im}"` : ''}${dis}></label>`;
  let html = '';
  if (e.sig) html += `<div class="banner" style="background:#E0F0E6;border-color:#B8DCC6">${icon('doc', 20)}<div><b style="color:#2E7D4F">Signed by ${esc(e.sig.name)}</b> · ${new Date(e.sig.at).toLocaleString('en-CA', {dateStyle: 'medium', timeStyle: 'short'})} · ${e.sig.method === 'online' ? 'online link' : 'in person'}<br><button class="btn ghost" style="margin-top:8px;padding:7px 12px" data-a="estunlock">Revise (removes signature)</button></div></div>`;
  else if (e.cloud) html += `<div class="banner" style="background:#E3EDF7;border-color:#C5D9EC">${icon('doc', 20)}<div><b style="color:#2B679B">Signing link sent</b> ${e.cloud.sentAt ? fmtDate(isoOf(e.cloud.sentAt)) : ''} — waiting for the client.<br><button class="btn ghost" style="margin-top:8px;padding:7px 12px" data-a="estcheck">Check now</button> <button class="btn ghost" style="margin-top:8px;padding:7px 12px" data-a="esturl">Copy link</button></div></div>`;
  html += `<section class="card"><h3>Pricing <em>markup on cost</em></h3>
    ${bids.length ? `<div class="sub" style="margin-top:0">Subcontractor prices</div><div class="qchips">${bids.map(b => `<button data-a="estbid" data-v="${b.id}"${dis} style="${e.bidFrom === b.id ? 'background:var(--g);color:#fff;border-color:var(--g)' : ''}">${esc(b.subName)} · ${fmtMoney(b.bid.total)}</button>`).join('')}</div><p class="hint">Tap a price to use it as your cost on each line.</p>` : ''}
    <div class="row">${f('Markup %', 'markup', e.markup, {im: 'decimal'})}<div class="f"><span style="display:block;font-size:12.5px;color:var(--mut);margin-bottom:4px;font-weight:600">Quick</span><div class="qchips" style="margin:0">${[15, 20, 25, 30, 40].map(m => `<button data-a="estmk" data-v="${m}"${dis}>${m}%</button>`).join('')}</div></div></div>
    <p class="hint" style="margin:0">Client rate = cost × (1 + markup). Type a client rate to set it yourself.</p>
  </section>
  <section class="card"><h3>Line items <em data-ec="sub">${money2(c.sub)}</em></h3>
    ${c.rows.map(({l, rate, amt}) => `<div class="eline">
      <div class="li"><input data-el="${l.id}" data-k="desc" value="${esc(l.desc)}" placeholder="Description"${dis}>${lock ? '' : `<button class="ix" data-a="estrm" data-id="${l.id}" aria-label="Remove line">${icon('x', 18)}</button>`}</div>
      <div class="egrid">
        <label><span>Qty</span><input data-el="${l.id}" data-k="qty" value="${esc(l.qty)}" inputmode="decimal"${dis}></label>
        <label><span>Unit</span><select data-el="${l.id}" data-k="unit"${dis}>${(UNITS.includes(l.unit) ? UNITS : [l.unit, ...UNITS]).map(u => `<option${u === l.unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
        <label><span>Cost / unit</span><input data-el="${l.id}" data-k="cost" value="${esc(l.cost)}" inputmode="decimal" placeholder="0"${dis}></label>
        <label><span>Client / unit</span><input data-el="${l.id}" data-k="rate" value="${esc(l.rate)}" inputmode="decimal" placeholder="${rate ? rate.toFixed(2) : '0'}" class="${hasOverride(l) ? 'ovr' : ''}"${dis}></label>
      </div>
      <div class="etot" data-et="${l.id}">${lineTotHTML(l, rate, amt)}</div></div>`).join('')}
    ${lock ? '' : `<button class="add" data-a="estadd">+ Add line</button>
    <div class="qchips" style="margin-top:10px">${EXTRAS.map(([d, u]) => `<button data-a="estadd" data-v="${esc(d)}" data-u="${u}">+ ${esc(d)}</button>`).join('')}</div>
    <button class="btn ghost wide" style="margin-top:6px" data-a="estrebuild">Rebuild lines from measurements</button>`}
  </section>
  <section class="card"><h3>Discount <em data-ec="disc">${c.disc ? '−' + money2(c.disc) : 'none'}</em></h3>
    <div class="seg">${[['pct', '% off'], ['amt', '$ off']].map(([k, l]) => `<button class="${(e.disc || {}).type === k ? 'on' : ''}" data-a="estdisctype" data-v="${k}"${dis}>${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><label class="f"><span>${(e.disc || {}).type === 'amt' ? 'Amount ($)' : 'Percent (%)'}</span><input data-ed="value" value="${esc((e.disc || {}).value)}" inputmode="decimal" placeholder="0"${dis}></label>
      <label class="f"><span>Label on estimate</span><input data-ed="label" value="${esc((e.disc || {}).label)}" placeholder="e.g. Fall promotion"${dis}></label></div>
    ${lock ? '' : `<div class="qchips" style="margin:0">${[['pct', 5], ['pct', 10], ['pct', 15], ['amt', 250], ['amt', 500]].map(([t, v]) => `<button data-a="estdiscq" data-t="${t}" data-v="${v}">${t === 'pct' ? v + '%' : '$' + v}</button>`).join('')}<button data-a="estdiscq" data-t="pct" data-v="">Clear</button></div>`}
    <p class="hint" style="margin:8px 0 0">Taken off before HST. Shows on the PDF and signing page.</p>
  </section>
  <section class="card"><h3>Tax &amp; deposit</h3>
    <div class="seg">${[['hst', 'HST 13%'], ['none', 'Cash — no HST']].map(([k, l]) => `<button class="${e.tax === k ? 'on' : ''}" data-a="esttax" data-v="${k}"${dis}>${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px">${f('Deposit %', 'deposit', e.deposit, {im: 'decimal'})}${f('Valid (days)', 'validDays', e.validDays, {im: 'numeric'})}</div>
    ${f('Estimate date', 'date', e.date, {type: 'date'})}
  </section>
  <section class="card"><h3>Totals</h3><div data-ec="totals">${totalsHTML(e)}</div>
    ${lock ? '' : `<button class="btn ghost wide" style="margin-top:10px" data-a="estapply">Use as job's contract price</button>`}</section>
  <section class="card"><h3>Scope &amp; notes <em>shown to client</em></h3><textarea data-e="scope" rows="3" placeholder="What's included, colours, gate hardware, cleanup…"${dis}>${esc(e.scope)}</textarea></section>
  <section class="card"><h3>Terms of agreement</h3><textarea data-e="terms" rows="9"${dis}>${esc(e.terms)}</textarea>
    ${lock ? '' : `<button class="btn ghost wide" style="margin-top:8px" data-a="estterms">Reset to my default terms</button>`}<p class="hint" style="margin:8px 0 0">{biz} and {valid} fill in automatically. Edit defaults in More.</p></section>
  <section class="card"><h3>Send &amp; sign</h3>
    ${pdfButtons(v => `data-a="estpdf" data-v="${v}"`)}
    ${e.sig ? '' : `<button class="btn gold wide" style="margin-top:10px" data-a="estsign">${icon('fence', 18)} Client signs on this phone</button>
    <button class="btn wide" style="margin-top:10px" data-a="estlink">Send signing link (client signs online)</button>`}
  </section>`;
  return html;
}
function lineTotHTML(l, rate, amt) {
  const ct = num(l.qty) * num(l.cost);
  return `<span>${num(l.qty)} ${esc(l.unit)} × ${money2(rate)}</span><b>${money2(amt)}</b>${ct ? `<small>cost ${fmtMoney(ct)} · +${fmtMoney(amt - ct)}</small>` : ''}`;
}
function totalsHTML(e) {
  const c = estCalc(e);
  return `<div class="trow"><span>Subtotal</span><b>${money2(c.sub)}</b></div>
    ${c.disc ? `<div class="trow" style="color:#2E7D4F"><span>${esc(discLabel(e))}</span><b>−${money2(c.disc)}</b></div><div class="trow"><span>After discount</span><b>${money2(c.net)}</b></div>` : ''}
    ${e.tax === 'hst' ? `<div class="trow"><span>HST 13%</span><b>${money2(c.tax)}</b></div>` : `<div class="trow mut"><span>No HST (cash price)</span><b>—</b></div>`}
    <div class="trow big"><span>Total</span><b>${money2(c.total)}</b></div>
    <div class="trow"><span>Deposit on signing (${num(e.deposit)}%)</span><b>${money2(c.dep)}</b></div>
    <div class="private"><div class="trow"><span>Your cost</span><b>${money2(c.cost)}</b></div><div class="trow"><span>Your profit · ${Math.round(c.margin)}%</span><b class="${c.profit < 0 ? 'neg' : 'pos'}">${money2(c.profit)}</b></div><small>Only you see this — not on the PDF.</small></div>`;
}
function updateEst(j) {
  const e = j.est, c = estCalc(e);
  c.rows.forEach(({l, rate, amt}) => {
    const t = main.querySelector(`[data-et="${l.id}"]`); if (t) t.innerHTML = lineTotHTML(l, rate, amt);
    const r = main.querySelector(`[data-el="${l.id}"][data-k="rate"]`); if (r) { r.placeholder = rate ? rate.toFixed(2) : '0'; r.classList.toggle('ovr', hasOverride(l)); }
  });
  const s = main.querySelector('[data-ec="sub"]'); if (s) s.textContent = money2(c.sub);
  const dd = main.querySelector('[data-ec="disc"]'); if (dd) dd.textContent = c.disc ? '−' + money2(c.disc) : 'none';
  const t = main.querySelector('[data-ec="totals"]'); if (t) t.innerHTML = totalsHTML(e);
}
INPUT_HOOKS.push(t => {
  if (!t.dataset.e && !t.dataset.el && !t.dataset.ed) return false;
  const j = estJob(); if (!j || !j.est || j.est.sig) return true;
  const e = j.est;
  if (t.dataset.ed) { e.disc = e.disc || {type: 'pct', value: '', label: ''}; e.disc[t.dataset.ed] = t.value; }
  else if (t.dataset.e) e[t.dataset.e] = t.value;
  else { const l = e.lines.find(x => x.id === t.dataset.el); if (l) { l[t.dataset.k] = t.value; if (t.dataset.k === 'rate' && hasOverride(l)) { settings.rateMem = settings.rateMem || {}; settings.rateMem[memKey(l, j)] = l.rate; saveSettings(); } } }
  saveJob(j); updateEst(j); return true;
});
ACT.estdisctype = b => { const j = estJob(); if (!j || j.est.sig) return; j.est.disc = Object.assign({type: 'pct', value: '', label: ''}, j.est.disc, {type: b.dataset.v, value: ''}); saveJob(j); rerender(); };
ACT.estdiscq = b => { const j = estJob(); if (!j || j.est.sig) return; j.est.disc = Object.assign({label: ''}, j.est.disc, {type: b.dataset.t, value: b.dataset.v}); saveJob(j); rerender(); };
ACT.estmk = b => { const j = estJob(); if (!j || j.est.sig) return; j.est.markup = b.dataset.v; saveJob(j); rerender(); };
ACT.esttax = b => { const j = estJob(); if (!j || j.est.sig) return; j.est.tax = b.dataset.v; saveJob(j); rerender(); };
ACT.estadd = b => {
  const j = estJob(); if (!j) return; const l = {id: uid(), src: '', desc: b.dataset.v || '', qty: b.dataset.u === 'ft' ? calc(j).ft || 1 : 1, unit: b.dataset.u || 'job', cost: '', rate: ''};
  j.est.lines.push(l); saveJob(j); rerender();
  const inp = main.querySelector(`[data-el="${l.id}"][data-k="${l.desc ? 'rate' : 'desc'}"]`); if (inp) inp.focus();
};
ACT.estrm = b => { const j = estJob(); if (!j) return; j.est.lines = j.est.lines.filter(l => l.id !== b.dataset.id); saveJob(j); rerender(); };
ACT.estrebuild = async () => {
  const j = estJob(); if (!j) return;
  if (!await ask('Replace all line items with fresh lines from the job measurements?', 'Rebuild', false)) return;
  const old = j.est.lines; j.est.lines = linesFromJob(j);
  j.est.lines.forEach(l => { const o = old.find(x => x.src && x.src === l.src); if (o) { l.cost = o.cost; l.rate = o.rate || l.rate; } });
  j.est.scope = j.est.scope || defaultScope(j); saveJob(j); rerender();
};
ACT.estterms = async () => { const j = estJob(); if (!j) return; if (!await ask('Replace these terms with your default terms?', 'Reset', false)) return; j.est.terms = settings.terms || DEFAULT_TERMS; saveJob(j); rerender(); };
ACT.estapply = () => { const j = estJob(); if (j) applyEstimate(j); };
ACT.estunlock = async () => {
  const j = estJob(); if (!j) return;
  if (!await ask('Revising removes the client\'s signature. They will need to sign again.', 'Revise', true)) return;
  j.notes.unshift({id: uid(), ts: Date.now(), t: `Estimate #${j.est.no} reopened for revision (signature by ${j.est.sig.name} removed)`, sys: true});
  j.est.sig = null; j.est.cloud = null; saveJob(j, true); rerender();
};
ACT.estpdf = b => { const j = estJob() || cur(); if (j && j.est) sendPdf(j, b.dataset.v); };
ACT.estsign = () => { const j = estJob(); if (j) signSheet(j); };

/* ---------- PDF ---------- */
function pdfName(j, e) { return `Estimate-${e.no}-${(jobName(j) || 'client').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}${e.sig ? '-signed' : ''}.pdf`; }
function buildPdf(j, e) {
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit: 'pt', format: 'letter'});
  const W = 612, H = 792, M = 42, G = [30, 58, 43], GOLD = [201, 162, 74], INK = [27, 35, 31], MUT = [110, 118, 113], LINE = [226, 222, 211];
  const c = estCalc(e);
  // header band
  doc.setFillColor(...G); doc.rect(0, 0, W, 96, 'F');
  doc.setFillColor(...GOLD); doc.rect(0, 96, W, 3, 'F');
  let tx = M;
  if (settings.logo && settings.logoW) {
    const h = 62, w = Math.min(150, h * settings.logoW / settings.logoH);
    try { doc.addImage(settings.logo, settings.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', M, 17, w, h); tx = M + w + 14; } catch (err) {}
  }
  doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text(doc.splitTextToSize(settings.bizName.toUpperCase(), 300)[0], tx, 45);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(222, 230, 224);
  const contact = [settings.bizPhone, settings.bizEmail, settings.bizWeb].filter(Boolean).join('   ·   ');
  if (contact) doc.text(contact, tx, 63);
  if (settings.bizAddress) doc.text(settings.bizAddress, tx, 77);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.text('ESTIMATE', W - M, 47, {align: 'right'});
  doc.setFontSize(10.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GOLD); doc.text(`No. ${e.no}`, W - M, 65, {align: 'right'});

  // client + details
  let y = 128;
  doc.setTextColor(...MUT); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
  doc.text('PREPARED FOR', M, y); doc.text('ESTIMATE DETAILS', 360, y);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK); doc.setFontSize(10.5);
  const cl = [jobName(j), ...(j.client.address || '').split('\n'), j.client.phone, j.client.email].filter(Boolean);
  let yl = y + 16; doc.setFont('helvetica', 'bold'); doc.text(cl[0], M, yl); doc.setFont('helvetica', 'normal');
  cl.slice(1).forEach(t => { yl += 14; doc.text(doc.splitTextToSize(t, 280)[0], M, yl); });
  const fd = d => d ? parseISO(d).toLocaleDateString('en-CA', {year: 'numeric', month: 'short', day: 'numeric'}) : '';
  const det = [['Date', fd(e.date)], ['Valid until', fd(validUntil(e))], ['Project', [j.type, j.material].filter(Boolean).join(' · ')]];
  if (e.tax === 'hst' && settings.hstNo) det.push(['HST #', settings.hstNo]);
  let yr = y + 16;
  det.forEach(([k, v]) => { doc.setTextColor(...MUT); doc.text(k, 360, yr); doc.setTextColor(...INK); doc.text(String(v), W - M, yr, {align: 'right'}); yr += 14; });
  y = Math.max(yl, yr) + 18;

  // line items
  doc.autoTable({
    startY: y, margin: {left: M, right: M},
    head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: c.rows.map(r => [r.l.desc || '—', String(num(r.l.qty)), r.l.unit, money2(r.rate), money2(r.amt)]),
    theme: 'plain',
    styles: {font: 'helvetica', fontSize: 9.8, cellPadding: {top: 7, bottom: 7, left: 6, right: 6}, textColor: INK, lineColor: LINE, lineWidth: {bottom: 0.6}},
    headStyles: {fillColor: G, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, lineWidth: 0},
    alternateRowStyles: {fillColor: [250, 249, 246]},
    didParseCell: d => { if (d.section === 'head' && [1, 3, 4].includes(d.column.index)) d.cell.styles.halign = 'right'; },
    columnStyles: {0: {cellWidth: 'auto'}, 1: {halign: 'right', cellWidth: 46}, 2: {cellWidth: 48}, 3: {halign: 'right', cellWidth: 72}, 4: {halign: 'right', cellWidth: 84, fontStyle: 'bold'}},
  });
  y = doc.lastAutoTable.finalY + 14;

  // totals
  const need = c.disc ? 145 : 110; if (y + need > H - 60) { doc.addPage(); y = 56; }
  const bx = 340, rows = [['Subtotal', money2(c.sub)]];
  if (c.disc) rows.push([discLabel(e), '-' + money2(c.disc)], ['After discount', money2(c.net)]);
  rows.push(e.tax === 'hst' ? [`HST ${HST_RATE}%`, money2(c.tax)] : ['HST', 'Not included']);
  rows.forEach(([k, v]) => { doc.setFontSize(10.5); doc.setTextColor(...MUT); doc.text(k, bx, y); doc.setTextColor(...INK); doc.text(v, W - M, y, {align: 'right'}); y += 17; });
  doc.setFillColor(...G); doc.roundedRect(bx - 10, y - 6, W - M - bx + 10, 30, 4, 4, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text('TOTAL', bx, y + 14);
  doc.setTextColor(...GOLD); doc.setFontSize(14); doc.text(money2(c.total) + ' CAD', W - M - 6, y + 14, {align: 'right'});
  y += 42; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(`Deposit due on signing (${num(e.deposit)}%)`, bx, y); doc.setFont('helvetica', 'bold'); doc.text(money2(c.dep), W - M, y, {align: 'right'});
  doc.setFont('helvetica', 'normal'); y += 15; doc.setTextColor(...MUT); doc.text('Balance due on completion', bx, y); doc.text(money2(round2(c.total - c.dep)), W - M, y, {align: 'right'});
  y += 26;

  const section = (title, text, size = 9.5, lh = 13) => {
    if (!text || !text.trim()) return;
    if (y > H - 110) { doc.addPage(); y = 56; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...G); doc.text(title.toUpperCase(), M, y);
    doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.line(M, y + 5, M + 40, y + 5); y += 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...INK);
    text.split('\n').forEach(par => {
      const lines = par.trim() ? doc.splitTextToSize(par, W - 2 * M) : [''];
      lines.forEach(ln => { if (y > H - 56) { doc.addPage(); y = 56; doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...INK); } doc.text(ln, M, y); y += lh; });
    });
    y += 10;
  };
  section('Scope & notes', e.scope);
  section('Terms of agreement', termsText(e), 8.6, 11.6);

  // acceptance
  if (y > H - 190) { doc.addPage(); y = 56; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...G); doc.text('ACCEPTANCE', M, y); doc.setDrawColor(...GOLD); doc.line(M, y + 5, M + 40, y + 5); y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(`I accept this estimate (No. ${e.no}, total ${money2(c.total)}) and the terms of agreement above, and authorize ${settings.bizName} to proceed.`, W - 2 * M), M, y); y += 30;
  const sy = y + 58;
  if (e.sig && e.sig.img) { try { const d = sigDims(e.sig); doc.addImage(e.sig.img, 'PNG', M, sy - d.h - 2, d.w, d.h); } catch (err) {} }
  doc.setDrawColor(...INK); doc.setLineWidth(0.7); doc.line(M, sy, M + 250, sy); doc.line(330, sy, W - M, sy);
  doc.setFontSize(8.5); doc.setTextColor(...MUT); doc.text('Client signature', M, sy + 12); doc.text('Date', 330, sy + 12);
  doc.setFontSize(10.5); doc.setTextColor(...INK);
  if (e.sig) {
    doc.text(new Date(e.sig.at).toLocaleDateString('en-CA', {year: 'numeric', month: 'long', day: 'numeric'}), 330, sy - 6);
    y = sy + 30; doc.setFontSize(10); doc.text(`Name: ${e.sig.name}`, M, y); y += 14;
    doc.setFontSize(8); doc.setTextColor(...MUT);
    doc.text(`Signed electronically ${new Date(e.sig.at).toLocaleString('en-CA', {dateStyle: 'medium', timeStyle: 'long'})} — ${e.sig.method === 'online' ? 'via secure online link' : 'in person on ' + settings.bizName + ' device'}. Ref ${j.id}-${e.no}`, M, y);
  } else {
    y = sy + 34; doc.line(M, y, M + 250, y); doc.setFontSize(8.5); doc.setTextColor(...MUT); doc.text('Print name', M, y + 12);
  }

  // footer
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal');
    doc.text(`${settings.bizName}${settings.bizPhone ? ' · ' + settings.bizPhone : ''} · Estimate ${e.no}`, M, H - 24);
    doc.text(`Page ${i} of ${n}`, W - M, H - 24, {align: 'right'});
  }
  return doc;
}
const sigDims = s => { const w0 = s.w || 300, h0 = s.h || 100, h = Math.min(54, 200 * h0 / w0); return {w: h * w0 / h0, h}; };
function shareMsg(j, e) {
  const c = estCalc(e), first = (j.client.name || '').trim().split(/\s+/)[0];
  return `Hi${first ? ' ' + first : ''}, here is your estimate #${e.no} from ${settings.bizName}: ${money2(c.total)}${e.tax === 'hst' ? ' incl. HST' : ''}. ${e.sig ? 'Signed copy attached.' : 'Let me know if you have any questions.'}\n\n${settings.bizName}${settings.bizPhone ? ' · ' + settings.bizPhone : ''}`;
}
function sendPdf(j, target) {
  const e = j.est;
  if (!window.jspdf) return toast('PDF library failed to load');
  let doc; try { doc = buildPdf(j, e); } catch (err) { return toast('PDF error: ' + err.message); }
  const name = pdfName(j, e);
  if (NB && NB.shareFile) {
    const r = NB.shareFile(name, doc.output('datauristring').split(',')[1], 'application/pdf', target, phoneIntl(j.client.phone), j.client.email || '', `Estimate #${e.no} — ${settings.bizName}`, shareMsg(j, e));
    if (r) toast(r);
  } else {
    const blob = doc.output('blob');
    if (target === 'view' && !isIOS) window.open(URL.createObjectURL(blob), '_blank');
    else offerFile(blob, name, {title: `Estimate #${e.no} — ${settings.bizName}`, text: ['save', 'view'].includes(target) ? '' : shareMsg(j, e), mode: target === 'save' && !isIOS ? 'download' : 'share'});
  }
  if (!['view', 'save'].includes(target) && !e.sig) markSent(j);
}
const phoneIntl = p => { let d = digits(p); if (d.length === 10) d = '1' + d; return d; };
function pdfButtons(attr) {
  if (!NB) return `<button class="btn gold wide" ${attr('any')}>${icon('share', 18)} Send PDF (WhatsApp, Mail, Messages…)</button>
    <div class="btns" style="margin-top:10px"><button class="btn ghost" ${attr('view')}>Preview</button><button class="btn ghost" ${attr('save')}>Save to Files</button></div>`;
  return `<div class="sharegrid">
      <button ${attr('whatsapp')}>${icon('msg')}WhatsApp</button><button ${attr('email')}>${icon('doc')}Email</button>
      <button ${attr('sms')}>${icon('phone')}Text</button><button ${attr('any')}>${icon('share')}Other</button>
    </div>
    <div class="btns" style="margin-top:10px"><button class="btn ghost" ${attr('view')}>Preview PDF</button><button class="btn ghost" ${attr('save')}>Save to phone</button></div>`;
}
function shareSheet(j) {
  const m = sheet(`<h4>Send estimate #${j.est.no}${j.est.sig ? ' (signed)' : ''}</h4><p class="hint" style="margin:0 0 4px">PDF to ${esc(jobName(j))}</p>
    <div style="margin-top:10px">${pdfButtons(v => `data-s="${v}"`)}</div>`);
  m.onclick = ev => { if (ev.target.closest('[data-close]')) return closeSheet(); const b = ev.target.closest('[data-s]'); if (!b) return; closeSheet(); sendPdf(j, b.dataset.s); };
}

/* ---------- signature ---------- */
function sigPad(canvas) {
  const ctx = canvas.getContext('2d'); let drawing = false, pts = [], empty = true;
  const r = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * r; canvas.height = canvas.clientHeight * r;
  ctx.setTransform(r, 0, 0, r, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#141a17'; ctx.fillStyle = '#141a17'; ctx.lineWidth = 2.6;
  const pos = ev => { const b = canvas.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  canvas.addEventListener('pointerdown', ev => { ev.preventDefault(); drawing = true; try { canvas.setPointerCapture(ev.pointerId); } catch (err) {} pts = [pos(ev)]; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 1.3, 0, Math.PI * 2); ctx.fill(); empty = false; });
  canvas.addEventListener('pointermove', ev => {
    if (!drawing) return; ev.preventDefault(); pts.push(pos(ev));
    const n = pts.length;
    if (n === 2) { ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...mid(pts[0], pts[1])); ctx.stroke(); }
    if (n >= 3) { const a = pts[n - 3], b = pts[n - 2], c = pts[n - 1], m1 = mid(a, b), m2 = mid(b, c); ctx.beginPath(); ctx.moveTo(...m1); ctx.quadraticCurveTo(b[0], b[1], m2[0], m2[1]); ctx.stroke(); }
  });
  const end = () => { drawing = false; pts = []; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', end);
  return {
    clear() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); empty = true; },
    isEmpty: () => empty,
    export() { // crop to ink
      const w = canvas.width, h = canvas.height, d = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 <= x0) return null;
      const p = 6 * r; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(w, x1 + p); y1 = Math.min(h, y1 + p);
      const out = document.createElement('canvas'); out.width = x1 - x0; out.height = y1 - y0;
      out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return {img: out.toDataURL('image/png'), w: out.width, h: out.height};
    },
  };
}
function signSheet(j) {
  const e = j.est, c = estCalc(e);
  const m = sheet(`<div class="vtop" style="color:var(--ink)"><b style="font-size:17px">Accept estimate #${e.no}</b><button class="ib" style="color:var(--ink)" data-close aria-label="Close">${icon('x', 24)}</button></div>
    <div class="signbody">
      <div class="tiles" style="margin-bottom:10px"><div class="tile"><span>Total${e.tax === 'hst' ? ' incl. HST' : ' (cash)'}</span><b>${money2(c.total)}</b></div><div class="tile"><span>Deposit on signing</span><b>${money2(c.dep)}</b></div></div>
      <button class="btn ghost wide" data-v="view">View full estimate (PDF)</button>
      <div class="sub">Terms of agreement</div><div class="termsbox">${esc(termsText(e))}</div>
      <label class="f" style="margin-top:12px"><span>Client name</span><input id="sgName" value="${esc(j.client.name)}" autocomplete="off"></label>
      <div class="sub" style="display:flex;justify-content:space-between;align-items:center">Sign below<button class="chip" data-v="clear" style="padding:4px 12px">Clear</button></div>
      <canvas id="sgPad" class="sigpad"></canvas>
      <label class="ck" style="border:0"><input type="checkbox" id="sgAgree"><span>I have read and agree to this estimate and the terms of agreement.</span></label>
      <button class="btn gold wide" data-v="sign" style="margin-top:6px">Sign &amp; accept</button>
    </div>`, 'viewer light');
  const pad = sigPad($('#sgPad'));
  m.onclick = async ev => {
    if (ev.target.closest('[data-close]')) return closeSheet();
    const b = ev.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'clear') return pad.clear();
    if (b.dataset.v === 'view') return sendPdf(j, 'view');
    if (b.dataset.v === 'sign') {
      const name = $('#sgName').value.trim();
      if (!name) return toast('Enter the client\'s name');
      if (pad.isEmpty()) return toast('Please sign in the box');
      if (!$('#sgAgree').checked) return toast('Tick the box to agree to the terms');
      const s = pad.export(); if (!s) return toast('Please sign in the box');
      if (e.cloud && typeof cancelLink === 'function') cancelLink(e.cloud.id);
      e.cloud = null;
      recordSignature(j, Object.assign(s, {name, at: new Date().toISOString(), method: 'in-person', agent: navigator.userAgent.slice(0, 160)}));
      closeSheet(); rerender();
      setTimeout(() => { toast('Signed — send the client a copy'); shareSheet(j); }, 250);
    }
  };
}
function recordSignature(j, sig) {
  const e = j.est; e.sig = sig;
  if (!j.client.name) j.client.name = sig.name;
  applyEstimate(j, true);
  j.notes.unshift({id: uid(), ts: Date.now(), t: `Estimate #${e.no} signed by ${sig.name} (${sig.method === 'online' ? 'online' : 'in person'})`, sys: true});
  if (['lead', 'quoted'].includes(j.status)) { const prev = j.status; j.status = 'booked'; j.notes.unshift({id: uid(), ts: Date.now(), t: `Status: ${ST[prev].l} → Booked`, sys: true}); }
  const ck = j.checklist.find(x => /quote sent/i.test(x.t)); if (ck) ck.done = true;
  saveJob(j, true);
}

/* ---------- settings ---------- */
MORE_SECTIONS.push(() => `<section class="card"><h3>Business (on estimates)</h3>
    <label class="f"><span>Business name</span><input data-s="bizName" value="${esc(settings.bizName)}"></label>
    <div class="row"><label class="f"><span>Phone</span><input data-s="bizPhone" type="tel" value="${esc(settings.bizPhone)}"></label><label class="f"><span>Email</span><input data-s="bizEmail" type="email" value="${esc(settings.bizEmail)}"></label></div>
    <div class="row"><label class="f"><span>Website</span><input data-s="bizWeb" value="${esc(settings.bizWeb)}"></label><label class="f"><span>HST #</span><input data-s="hstNo" value="${esc(settings.hstNo)}" placeholder="123456789 RT0001"></label></div>
    <label class="f"><span>Business address (optional)</span><input data-s="bizAddress" value="${esc(settings.bizAddress)}"></label>
    <div class="f"><span style="display:block;font-size:12.5px;color:var(--mut);margin-bottom:4px;font-weight:600">Logo for PDF</span>
      <div class="btns">${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="max-height:52px;max-width:140px;flex:0 0 auto;background:#1E3A2B;border-radius:8px;padding:4px">` : ''}<label class="btn ghost">${settings.logo ? 'Change logo' : 'Add logo'}<input type="file" accept="image/*" data-logo hidden></label>${settings.logo ? '<button class="btn ghost" data-a="logorm">Remove</button>' : ''}</div></div>
  </section>
  <section class="card"><h3>Estimate defaults</h3>
    <div class="row"><label class="f"><span>Markup %</span><input data-s="markup" inputmode="decimal" value="${esc(settings.markup)}"></label><label class="f"><span>Deposit %</span><input data-s="depositPct" inputmode="decimal" value="${esc(settings.depositPct)}"></label></div>
    <div class="row"><label class="f"><span>Valid (days)</span><input data-s="validDays" inputmode="numeric" value="${esc(settings.validDays)}"></label><label class="f"><span>Next estimate #</span><input data-s="nextEstNo" inputmode="numeric" value="${esc(settings.nextEstNo)}"></label></div>
    <label class="f"><span>Default tax</span><select data-s="defaultTax"><option value="hst"${settings.defaultTax === 'hst' ? ' selected' : ''}>HST 13%</option><option value="none"${settings.defaultTax === 'none' ? ' selected' : ''}>Cash — no HST</option></select></label>
    <label class="f"><span>Default terms of agreement</span><textarea data-s="terms" rows="10">${esc(settings.terms)}</textarea></label>
    <button class="btn ghost wide" data-a="termsreset">Restore original terms</button>
  </section>`);
CHANGE_HOOKS.push(t => {
  if (!t.matches('[data-logo]')) return false;
  const f = t.files[0]; t.value = ''; if (!f) return true;
  loadImg(f).then(img => {
    const s = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    settings.logo = cv.toDataURL('image/png'); settings.logoW = cv.width; settings.logoH = cv.height; saveSettings(); rerender(); toast('Logo saved');
  }).catch(() => toast('Could not read that image'));
  return true;
});
ACT.logorm = () => { settings.logo = ''; settings.logoW = settings.logoH = 0; saveSettings(); rerender(); };
ACT.termsreset = async () => { if (!await ask('Replace your default terms with the original text?', 'Restore', false)) return; settings.terms = DEFAULT_TERMS; saveSettings(); rerender(); };
