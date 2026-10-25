import { OFFICES, buildCtx, temporal, cyclePos, officeAt, todayOffices, nextOffice, dialTimes, hourSpan, sunTimes, solarNoon, ymdIn } from './sun.js';
import { dialNatural } from './dial.js';

const $ = id => document.getElementById(id);
const dayMs = 86400000;
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MADRID = { id: 'madrid', name: 'Madrid', lat: 40.4168, lon: -3.7038, tz: 'Europe/Madrid' };
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
const KEY = 'horarium:v1';
// ?t=2026-06-21T12:00Z pone el reloj en otro instante, para ver cómo cambia con las estaciones.
const T0 = Date.parse(new URLSearchParams(location.search).get('t') || '');
const SHIFT = isNaN(T0) ? 0 : T0 - Date.now();

// ---------- Estado guardado: modo (aquí o un lugar), lugares y última posición conocida ----------

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.places)) return s;
  } catch (e) {}
  return { mode: 'here', places: [], fix: null };
}
let store = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const allPlaces = () => [MADRID, ...store.places];

// ---------- Ubicación ----------

let geo = { status: 'idle' }, watchId = null;
function startGeo() {
  if (watchId != null || geo.status === 'denied') return;
  if (!('geolocation' in navigator) || !window.isSecureContext) { geo = { status: 'unsupported' }; render(true); return; }
  geo = { status: 'waiting' };
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
    geo = { status: 'ok' };
    store.fix = { lat, lon, acc: Math.round(acc), t: Date.now() };
    save(); render(true);
  }, err => {
    geo = { status: err.code === 1 ? 'denied' : 'error', msg: err.message };
    if (err.code === 1) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    render(true);
  }, { enableHighAccuracy: false, maximumAge: 600000, timeout: 30000 });
}

function currentPlace() {
  if (store.mode !== 'here') {
    const p = allPlaces().find(x => x.id === store.mode);
    if (p) return { ...p, kind: 'fixed' };
  }
  if (store.fix) return { id: 'here', name: 'Aquí', lat: store.fix.lat, lon: store.fix.lon, tz: DEVICE_TZ, kind: 'here' };
  return { ...MADRID, kind: 'fallback' };
}

function geoMessage(pl) {
  if (store.mode !== 'here') return '';
  const s = geo.status;
  if (s === 'denied') return 'Sin permiso de ubicación' + (pl.kind === 'fallback' ? ': se muestra Madrid' : ': se muestra la última posición conocida') + '. Actívalo en los ajustes del navegador para usar «Aquí».';
  if (s === 'unsupported') return 'Este navegador no da la ubicación: se muestra ' + (pl.kind === 'fallback' ? 'Madrid.' : 'la última posición conocida.');
  if (s === 'error') return 'No se pudo obtener la ubicación (' + (geo.msg || 'sin respuesta') + '). Se reintenta sola.';
  if (s === 'waiting' && pl.kind === 'fallback') return 'Buscando tu ubicación… Mientras, Madrid.';
  return '';
}

// ---------- Formatos, siempre en la zona horaria del lugar ----------

const pad = n => String(n).padStart(2, '0');
function clockParts(d, tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(d)) p[x.type] = +x.value;
  return p;
}
const fmtT = (d, tz) => { const p = clockParts(d, tz); return pad(p.hour) + ':' + pad(p.minute); };
function fmtDur(ms) { const t = Math.max(0, Math.round(ms / 60000)), h = Math.floor(t / 60), m = t % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; }
function durHTML(ms) { const t = Math.round(ms / 60000), h = Math.floor(t / 60), m = t % 60; return h ? `${h}<span class="u">h</span>${m}<span class="u">min</span>` : `${m}<span class="u">min</span>`; }
const fmtCoord = (v, p, q) => Math.abs(v).toFixed(2).replace('.', ',') + '° ' + (v >= 0 ? p : q);
const coords = pl => fmtCoord(pl.lat, 'N', 'S') + ' · ' + fmtCoord(pl.lon, 'E', 'O');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Pintado ----------

let lastKey = '', yearKey = '', view = 'reloj', peek = null;

// Tema: 'sol' (por defecto) es claro con el sol arriba y oscuro con el sol puesto, en el lugar que se ve.
const THEMES = {
  sol: { label: 'Tema automático: claro de día, oscuro de noche', icon: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.6 6.2A5.8 5.8 0 0 1 12.4 6.2Z" fill="currentColor"/></svg>' },
  light: { label: 'Tema claro', icon: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="currentColor"/><g stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M7 .9v1.6M7 11.5v1.6M.9 7h1.6M11.5 7h1.6M2.7 2.7l1.1 1.1M10.2 10.2l1.1 1.1M2.7 11.3l1.1-1.1M10.2 3.8l1.1-1.1"/></g></svg>' },
  dark: { label: 'Tema oscuro', icon: '<svg viewBox="0 0 14 14"><path d="M9.6 1.4A5.8 5.8 0 1 0 12.6 9.2 4.6 4.6 0 0 1 9.6 1.4Z" fill="currentColor"/></svg>' }
};
const THEME_ORDER = ['sol', 'light', 'dark'];
function applyTheme(sunUp) {
  const mode = THEMES[store.theme] ? store.theme : 'sol', t = mode === 'sol' ? (sunUp ? 'light' : 'dark') : mode;
  const root = document.documentElement;
  if (root.dataset.theme !== t) {
    root.dataset.theme = t;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = t === 'dark' ? '#0D121E' : '#ECEEF2'; });
  }
  const b = $('theme');
  if (b.dataset.theme !== mode) { b.dataset.theme = mode; b.innerHTML = THEMES[mode].icon; b.title = THEMES[mode].label; b.setAttribute('aria-label', THEMES[mode].label); }
}

function render(force) {
  const now = new Date(Date.now() + SHIFT), pl = currentPlace();
  const ctx = buildCtx(now, pl.lat, pl.lon, pl.tz);
  const fmt = d => fmtT(d, pl.tz);
  const ok = !ctx.polar && ctx.cur;
  const tp = ok ? temporal(ctx.cur, now) : null;
  applyTheme(ok ? ctx.cur.kind === 'day' : ctx.polar === 'day');
  if (peek && Date.now() > peek.until) peek = null;
  const key = [fmt(now), tp && tp.hour, tp && tp.minute, pl.id, pl.lat, pl.lon, store.mode, geo.status, view, peek && peek.key, store.theme].join('|');
  if (!force && key === lastKey) return;
  lastKey = key;

  $('where').textContent = pl.kind === 'here' ? 'Aquí · ' + coords(pl) : pl.name;
  const ds = new Intl.DateTimeFormat('es-ES', { timeZone: pl.tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  $('date').textContent = ds.charAt(0).toUpperCase() + ds.slice(1);

  renderChips(pl);
  const msg = geoMessage(pl);
  $('msg').textContent = msg; $('msg').hidden = !msg;

  const nx = ok ? nextOffice(ctx, now) : null;
  if (ok) {
    const isDay = ctx.cur.kind === 'day', p = cyclePos(ctx, now), off = officeAt(p);
    const base = { day: ctx.day, night: ctx.night, noon: ctx.noon, now, next: nx && nx.name, fmt, times: dialTimes(now, pl.lat, pl.lon, pl.tz) };
    // Consultando un oficio o una hora: su horario en el centro, unos segundos.
    const center = peek
      ? { office: peek.name, time: `${fmt(peek.from)} – ${fmt(peek.to)}`, small: true, peek: peek.name, peekHour: peek.hour,
          isDay: peek.hour ? peek.hour[0] === 'd' : OFFICES.find(x => x.name === peek.name).p < 12,
          sub: (peek.hour ? peek.label + ' · ' : '') + 'dura ' + fmtDur(peek.to - peek.from) }
      : { office: off.name, time: fmt(now), sub: `hora ${ROM[tp.hour - 1]} · minuto ${tp.minute}`, isDay };
    $('dial').innerHTML = dialNatural({ ...base, ...center });
    $('dial').setAttribute('aria-label', `${off.name}, ${fmt(now)}, hora ${ROM[tp.hour - 1]} ${isDay ? 'del día' : 'de la noche'}, minuto ${tp.minute}`);
  } else {
    const title = ctx.polar === 'day' ? 'Sol de medianoche' : ctx.polar === 'night' ? 'Noche polar' : 'Sin medida';
    $('dial').innerHTML = dialNatural({ office: title, time: fmt(now), sub: 'hoy no hay horas temporales', isDay: ctx.polar === 'day', polar: ctx.polar || 'night' });
    $('dial').setAttribute('aria-label', `${title}, ${fmt(now)}`);
  }

  if (view === 'dia') renderDay(ctx, now, pl, nx, fmt);
}

function renderChips(pl) {
  const items = [{ id: 'here', name: 'Aquí' }, ...allPlaces()];
  $('chips').innerHTML = items.map(x => {
    const on = store.mode === x.id || (x.id === 'here' && store.mode === 'here');
    return `<button class="chip${on ? ' on' : ''}" data-mode="${esc(x.id)}" aria-pressed="${on}">${esc(x.name)}</button>`;
  }).join('');
}

function renderDay(ctx, now, pl, nx, fmt) {
  $('day-title').textContent = pl.kind === 'here' ? 'Hoy, aquí' : 'Hoy en ' + pl.name;
  if (ctx.polar) {
    $('f-light').innerHTML = ctx.polar === 'day' ? '24<span class="u">h</span>' : '0<span class="u">h</span>';
    $('f-day').textContent = '—'; $('f-night').textContent = '—';
    $('hours').innerHTML = '<li class="empty">Hoy no hay oficios que situar: sin amanecer ni ocaso no hay horas temporales.</li>';
  } else {
    $('f-light').innerHTML = durHTML(ctx.day.end - ctx.day.start) + `<small>sale ${fmt(ctx.day.start)}<br>se pone ${fmt(ctx.day.end)}</small>`;
    $('f-day').innerHTML = durHTML((ctx.day.end - ctx.day.start) / 12);
    $('f-night').innerHTML = ctx.night ? durHTML((ctx.night.end - ctx.night.start) / 12) : '—';
    $('hours').innerHTML = todayOffices(ctx).map(o => {
      const past = o.t && o.t <= now, isN = nx && o.t && nx.t.getTime() === o.t.getTime();
      return `<li class="k-${o.kind}${past ? ' past' : ''}${isN ? ' next' : ''}"><span class="n">${o.name}${isN ? '<span class="tag">siguiente</span>' : ''}</span><span class="t">${o.t ? fmt(o.t) : '—'}</span></li>`;
    }).join('');
  }
  const { y, m, d } = ymdIn(now, pl.tz);
  const k = `${y}-${m}-${d}|${pl.lat}|${pl.lon}`;
  if (k !== yearKey) { yearKey = k; renderYear(y, m, d, pl); }
}

function renderYear(year, mo, da, pl) {
  const W = 420, H = 240, ml = 34, mr = 10, mt = 18, mb = 26;
  const start = Date.UTC(year, 0, 1), n = Math.round((Date.UTC(year + 1, 0, 1) - start) / dayMs);
  const dH = [], nH = [];
  for (let i = 0; i < n; i++) {
    const st = sunTimes(solarNoon(year, 0, 1 + i, pl.lon), pl.lat, pl.lon);
    if (st.polar) { dH.push(null); nH.push(null); }
    else { const dl = (st.set - st.rise) / 60000; dH.push(dl / 12); nH.push((1440 - dl) / 12); }
  }
  const vals = dH.concat(nH).filter(v => v != null).concat([60]);
  let lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil(Math.max(...vals) / 10) * 10;
  const step = (hi - lo) > 60 ? 20 : 10; lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = i => ml + i / (n - 1) * (W - ml - mr), Y = v => mt + (hi - v) / (hi - lo) * (H - mt - mb);
  const f = v => v.toFixed(1);
  let s = '';
  for (let v = lo; v <= hi; v += step) s += `<line class="gl" x1="${ml}" y1="${f(Y(v))}" x2="${W - mr}" y2="${f(Y(v))}"/><text class="ax e" x="${ml - 6}" y="${f(Y(v))}">${v}</text>`;
  s += `<text class="ax" x="${ml - 6}" y="${f(Y(hi) - 10)}" text-anchor="end">min</text>`;
  let cum = 0;
  for (let m = 0; m < 12; m++) {
    const len = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    s += `<line class="gl" x1="${f(X(cum))}" y1="${H - mb}" x2="${f(X(cum))}" y2="${H - mb + 4}"/>`;
    s += `<text class="ax m" x="${f(X(Math.min(cum + len / 2, n - 1)))}" y="${H - 8}">${MON[m]}</text>`;
    cum += len;
  }
  s += `<line class="ref" x1="${ml}" y1="${f(Y(60))}" x2="${W - mr}" y2="${f(Y(60))}"/>`;
  const path = arr => { let p = '', pen = false; arr.forEach((v, i) => { if (v == null) { pen = false; return; } p += (pen ? 'L' : 'M') + f(X(i)) + ' ' + f(Y(v)); pen = true; }); return p; };
  s += `<path class="l-night" d="${path(nH)}"/><path class="l-day" d="${path(dH)}"/>`;
  if (!dH.some(v => v == null)) {
    let iMax = 0, iMin = 0; dH.forEach((v, i) => { if (v > dH[iMax]) iMax = i; if (v < dH[iMin]) iMin = i; });
    const lab = (i, v, dy) => { const x = X(i), anc = x > W - 40 ? 'end' : x < ml + 30 ? 'start' : 'middle'; return `<text class="ann" x="${f(x)}" y="${f(Math.min(Math.max(Y(v) + dy, mt + 8), H - mb - 4))}" text-anchor="${anc}">${Math.round(v)} min</text>`; };
    s += lab(iMax, dH[iMax], -9) + lab(iMin, dH[iMin], 17);
    $('chart-cap').textContent = `Aquí la hora de día va de ${Math.round(dH[iMin])} minutos en el solsticio de invierno a ${Math.round(dH[iMax])} en el de verano, y la de noche al revés. Solo en los equinoccios duran lo mismo que una hora de reloj.`;
  } else {
    $('chart-cap').textContent = 'Los huecos son los días sin amanecer o sin ocaso: ahí no hay nada que repartir en doce partes.';
  }
  const ti = Math.round((Date.UTC(year, mo, da) - start) / dayMs);
  s += `<line class="today" x1="${f(X(ti))}" y1="${mt}" x2="${f(X(ti))}" y2="${H - mb}"/><text class="ax m" x="${f(X(ti))}" y="${mt - 6}">hoy</text>`;
  if (dH[ti] != null) s += `<circle class="dot-n" cx="${f(X(ti))}" cy="${f(Y(nH[ti]))}" r="4"/><circle class="dot-d" cx="${f(X(ti))}" cy="${f(Y(dH[ti]))}" r="4"/>`;
  $('year').innerHTML = s;
}

// ---------- Lugares ----------

function renderPlaces() {
  const s = geo.status, fx = store.fix;
  const st = s === 'ok' && fx ? `Ubicación activa: ${coords(fx)} (±${fx.acc} m).`
    : s === 'denied' ? 'Sin permiso de ubicación. Actívalo en los ajustes del navegador para este sitio.'
    : s === 'unsupported' ? 'Este navegador no da la ubicación.'
    : s === 'waiting' ? 'Buscando tu ubicación…'
    : s === 'error' ? 'No se pudo obtener la ubicación. Se reintenta sola.'
    : 'La ubicación se pide al usar «Aquí» o al guardar un sitio.';
  $('geo-status').textContent = st;
  $('save-here').disabled = !(s === 'ok' && fx);
  $('saved').innerHTML = allPlaces().map(p => `<li><button class="pick" data-mode="${esc(p.id)}"><span class="pn">${esc(p.name)}</span><span class="pc">${coords(p)}</span></button>${p.id === 'madrid' ? '' : `<button class="del" data-del="${esc(p.id)}" aria-label="Quitar ${esc(p.name)}">×</button>`}</li>`).join('');
}

function setMode(id) {
  store.mode = id; save();
  if (id === 'here') startGeo();
  yearKey = '';
  render(true);
}

function showView(v) {
  view = v;
  for (const id of ['reloj', 'dia', 'lugares']) $('v-' + id).hidden = id !== v;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'));
  $('chips').hidden = v === 'lugares';
  if (v === 'lugares') { startGeo(); renderPlaces(); }
  yearKey = '';
  render(true);
  window.scrollTo(0, 0);
}

let undo = null, undoTimer = null;
function toast(text, action) {
  $('toast-text').textContent = text;
  $('toast').hidden = false;
  undo = action;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { $('toast').hidden = true; undo = null; }, 6000);
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.v) { showView(b.dataset.v); return; }
  if (b.dataset.mode) { setMode(b.dataset.mode); if (view === 'lugares') showView('reloj'); return; }
  if (b.dataset.del) {
    const i = store.places.findIndex(p => p.id === b.dataset.del);
    if (i < 0) return;
    const [gone] = store.places.splice(i, 1), wasMode = store.mode === gone.id;
    if (wasMode) store.mode = 'madrid';
    save(); renderPlaces(); render(true);
    toast(`Quitado: ${gone.name}`, () => { store.places.splice(i, 0, gone); if (wasMode) store.mode = gone.id; save(); renderPlaces(); render(true); });
    return;
  }
  if (b.id === 'theme') { store.theme = THEME_ORDER[(THEME_ORDER.indexOf(store.theme || 'sol') + 1) % 3]; save(); render(true); return; }
  if (b.id === 'toast-undo') { if (undo) undo(); undo = null; $('toast').hidden = true; return; }
  if (b.id === 'use-here') { setMode('here'); showView('reloj'); return; }
  if (b.dataset.add) {
    const r = results[+b.dataset.add];
    const id = 'g' + r.id;
    if (!store.places.some(p => p.id === id)) store.places.push({ id, name: r.name, lat: r.latitude, lon: r.longitude, tz: r.timezone || DEVICE_TZ });
    setMode(id); showView('reloj');
  }
});

// Consultar en la esfera: tocar (5 s en el centro) o, con ratón, pasar por encima. Por fuera del
// anillo, el oficio entero; sobre el anillo, solo esa hora temporal.
function peekAt(target, ms) {
  const h = target.closest && target.closest('.hit');
  if (!h) return false;
  const key = h.dataset.h ? 'h:' + h.dataset.h : 'o:' + h.dataset.o;
  if (peek && peek.key === key) { peek.until = Date.now() + ms; return true; }
  if (h.dataset.h) {
    const kind = h.dataset.h[0] === 'd' ? 'day' : 'night', i = +h.dataset.h.slice(1), pl = currentPlace();
    const span = hourSpan(new Date(Date.now() + SHIFT), pl.lat, pl.lon, pl.tz, kind, i);
    if (!span) return false;
    peek = { key, hour: h.dataset.h, name: officeAt((kind === 'day' ? 0 : 12) + i + 0.5).name, ...span,
      label: `hora ${ROM[i]}` };
  } else {
    peek = { key, name: h.dataset.o, from: new Date(+h.dataset.from), to: new Date(+h.dataset.to) };
  }
  peek.until = Date.now() + ms;
  render(true);
  return true;
}
$('dial').addEventListener('click', e => { if (!peekAt(e.target, 5000) && peek) { peek = null; render(true); } });
$('dial').addEventListener('pointerover', e => { if (e.pointerType === 'mouse') peekAt(e.target, 60000); });
$('dial').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && peek) { peek = null; render(true); } });

$('save-form').addEventListener('submit', ev => {
  ev.preventDefault();
  if (!store.fix) return;
  const name = $('save-name').value.trim() || 'Mi sitio';
  const id = 'p' + Date.now();
  store.places.push({ id, name, lat: store.fix.lat, lon: store.fix.lon, tz: DEVICE_TZ });
  $('save-name').value = '';
  save(); renderPlaces(); render(true);
  toast(`Guardado: ${name}`, () => { store.places = store.places.filter(p => p.id !== id); if (store.mode === id) store.mode = 'here'; save(); renderPlaces(); render(true); });
});

let results = [];
$('search-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const q = $('q').value.trim();
  const out = $('results'), err = $('search-err');
  err.hidden = true;
  if (q.length < 2) { out.innerHTML = ''; return; }
  out.innerHTML = '<li class="empty">Buscando…</li>';
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=es&format=json`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    results = (await r.json()).results || [];
    out.innerHTML = results.length
      ? results.map((x, i) => `<li><button class="pick" data-add="${i}"><span class="pn">${esc(x.name)}</span><span class="pc">${esc([x.admin1, x.country].filter(Boolean).join(', '))}</span></button></li>`).join('')
      : '<li class="empty">Nada con ese nombre.</li>';
  } catch (e) {
    out.innerHTML = '';
    err.textContent = 'No se pudo buscar (' + (navigator.onLine ? e.message : 'sin conexión') + '). El buscador necesita internet; el GPS y los lugares guardados funcionan sin red.';
    err.hidden = false;
  }
});

// ---------- Arranque ----------

window.addEventListener('error', e => { const m = $('msg'); m.textContent = 'Error: ' + e.message; m.hidden = false; });
if (store.mode === 'here') startGeo();
showView('reloj');
setInterval(render, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(true); });
// En local no se registra: el caché del service worker serviría la versión vieja mientras se edita.
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
if ('serviceWorker' in navigator && !LOCAL) navigator.serviceWorker.register('sw.js').catch(() => {});
