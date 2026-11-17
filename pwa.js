'use strict';
/* ================= Web app (iPhone / browser) support. Does nothing inside the Android app. ================= */
const IS_WEB = !window.AndroidBridge;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
const WEB_APP_URL = 'https://prince0313.github.io/redwood-jobs-web/';
let deferredInstall = null;

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (typeof rerender === 'function' && jobs) rerender(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; if (typeof rerender === 'function') rerender(); });

if (IS_WEB && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => {
          if (w.state === 'activated' && navigator.serviceWorker.controller) toast('Update installed — close and reopen the app to use it');
        });
      });
    }).catch(() => {});
  });
}

function webAppUrl() {
  if (IS_WEB && /^https:/.test(location.protocol) && !/localhost/.test(location.hostname)) return location.origin + location.pathname.replace(/index\.html$/, '');
  return WEB_APP_URL;
}
function webBuild() { const m = document.querySelector('meta[name="build"]'); return m ? m.content : 'web'; }

/** Banner telling iPhone users to add the app to the Home Screen (their data is only kept safely there). */
function installBanner() {
  if (!IS_WEB || isStandalone()) return '';
  if (isIOS) {
    const share = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
    return `<div class="banner" style="background:#E3EDF7;border-color:#C5D9EC"><div><b style="color:#2B679B">Install on your iPhone first.</b> Tap ${share} <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>. Open Redwood Jobs from your home screen — your jobs are only kept safely there.</div></div>`;
  }
  if (deferredInstall) return `<div class="banner" style="background:#E3EDF7;border-color:#C5D9EC"><div style="flex:1"><b style="color:#2B679B">Install Redwood Jobs</b> on this device so it opens like an app and works offline.</div><button class="btn" data-a="pwainstall" style="padding:9px 14px">Install</button></div>`;
  return '';
}
ACT.pwainstall = async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; rerender(); };

/** Share a file through the phone's share sheet (WhatsApp, Mail, Messages, Files), or download it. */
async function offerFile(blob, name, opts = {}) {
  let file = null;
  try { file = new File([blob], name, {type: blob.type || 'application/octet-stream'}); } catch (e) {}
  const data = file ? {files: [file], title: opts.title || name} : null;
  if (data && opts.text) data.text = opts.text;
  const canShare = data && navigator.canShare && navigator.canShare({files: [file]});
  if (canShare && opts.mode !== 'download') {
    try { await navigator.share(data); return 'shared'; }
    catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      return new Promise(res => {
        const m = sheet(`<h4>${esc(name)}</h4><p class="hint">Ready. Tap to choose WhatsApp, Mail, Messages or Save to Files.</p><button class="btn gold wide" data-k="s">${icon('share', 18)} Send / save</button>`);
        m.onclick = async ev => {
          if (ev.target.closest('[data-close]')) { closeSheet(); return res('cancelled'); }
          if (!ev.target.closest('[data-k]')) return;
          closeSheet();
          try { await navigator.share(data); res('shared'); } catch (er) { res('cancelled'); }
        };
      });
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'downloaded';
}

/** Open WhatsApp / Messages / Mail with a ready message (web version of the Android share buttons). */
function webShareText(target, phone, email, subject, text) {
  const enc = encodeURIComponent;
  if (target === 'whatsapp') { window.open(`https://wa.me/${phone || ''}?text=${enc(text)}`, '_blank', 'noopener'); return true; }
  if (target === 'sms') { location.href = `sms:${phone ? '+' + phone : ''}${isIOS ? '&' : '?'}body=${enc(text)}`; return true; }
  if (target === 'email') { location.href = `mailto:${email || ''}?subject=${enc(subject || '')}&body=${enc(text)}`; return true; }
  return false;
}
