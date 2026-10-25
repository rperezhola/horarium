// «Mi regla»: el horario de cada uno. Modos (listas de oficios a hora de reloj), una semana que dice
// qué modo toca cada día, temporadas con su propia semana, días sueltos cambiados a mano y el caos,
// que siempre tiene fecha de vuelta. Cálculo puro, sin DOM, para poder probarlo con node.

import { ymdIn } from './sun.js';

const dayMs = 86400000;
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// La que trae la app hasta que cada uno ponga la suya. «ocio» marca el hueco que, los días con el
// interruptor encendido, pasa a llamarse como `alterno` (Gym): el hueco existe igual, solo cambia de uso.
export function ejemplo() {
  const s = (modo, gym = false) => ({ modo, gym });
  return {
    v: 1, alterno: 'Gym',
    modos: [
      { id: 'trabajo', nombre: 'Trabajo', oficios: [
        { n: 'Despertar', h: '07:00' }, { n: 'Trabajo', h: '09:00' }, { n: 'Comida', h: '14:00' },
        { n: 'Tarde de trabajo', h: '15:00' }, { n: 'Ocio', h: '18:00', ocio: true }, { n: 'Cena', h: '21:00' },
        { n: 'A dormir', h: '23:00' }] },
      { id: 'corta', nombre: 'Jornada corta', oficios: [
        { n: 'Despertar', h: '07:00' }, { n: 'Trabajo', h: '08:00' }, { n: 'Comida', h: '15:00' },
        { n: 'Tarde libre', h: '16:30' }, { n: 'Ocio', h: '18:00', ocio: true }, { n: 'Cena', h: '21:00' },
        { n: 'A dormir', h: '23:30' }] },
      { id: 'libre', nombre: 'Libre', oficios: [
        { n: 'Despertar', h: '08:30' }, { n: 'Ocio', h: '10:00', ocio: true }, { n: 'Comida', h: '14:00' },
        { n: 'Tarde libre', h: '16:00' }, { n: 'Cena', h: '21:00' }, { n: 'A dormir', h: '23:30' }] }
    ],
    semana: [s('trabajo'), s('trabajo'), s('trabajo'), s('trabajo'), s('corta'), s('libre'), s('libre')],
    temporadas: [], dias: {}, caos: null
  };
}

// ---------- Fechas: días civiles como número de día (UTC) para poder sumar y restar ----------

export const dnOf = ({ y, m, d }) => Math.round(Date.UTC(y, m, d) / dayMs);
export const dnStr = s => Math.round(Date.parse(s + 'T00:00:00Z') / dayMs);
export const ymd = dn => new Date(dn * dayMs).toISOString().slice(0, 10);
export const weekday = dn => (new Date(dn * dayMs).getUTCDay() + 6) % 7; // 0 = lunes
const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };

// Desfase de una zona en un instante, en ms.
function offset(t, tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t))) p[x.type] = +x.value;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

// Instante de una hora de reloj (minutos desde las 0:00, puede pasar de 1440) de un día civil en una
// zona. Dos pasadas, porque el día del cambio de hora el desfase no es el mismo a las 0:00 que a las 7.
export function instante(dn, min, tz) {
  const guess = dn * dayMs + min * 60000;
  let t = guess;
  for (let i = 0; i < 2; i++) t = guess - offset(t, tz);
  return new Date(t);
}

// ---------- Qué toca un día ----------

// Una temporada va de `desde` a `hasta` (MM-DD) y puede cruzar el año. Con `semanas`, se amplía a las
// semanas enteras (de lunes a domingo) que contienen esas dos fechas.
export function enTemporada(tp, dn) {
  const y = new Date(dn * dayMs).getUTCFullYear();
  for (const y0 of [y - 1, y]) {
    let a = dnStr(`${y0}-${tp.desde}`), b = dnStr(`${tp.desde <= tp.hasta ? y0 : y0 + 1}-${tp.hasta}`);
    if (tp.semanas) { a -= weekday(a); b += 6 - weekday(b); }
    if (dn >= a && dn <= b) return true;
  }
  return false;
}

// Manda, por este orden: el caos, el día cambiado a mano, la temporada y la semana de siempre.
export function plan(regla, dn, sinCaos = false) {
  const c = regla.caos;
  if (!sinCaos && c && dn >= dnStr(c.desde) && dn < dnStr(c.vuelta)) return { caos: true, vuelta: c.vuelta, origen: 'caos' };
  const o = regla.dias && regla.dias[ymd(dn)];
  if (o) return { modo: o.modo, gym: !!o.gym, origen: 'dia' };
  const tp = (regla.temporadas || []).find(t => enTemporada(t, dn));
  const s = (tp ? tp.semana : regla.semana)[weekday(dn)];
  return { modo: s.modo, gym: !!s.gym, origen: tp ? 'temporada' : 'semana', temporada: tp ? tp.nombre : null };
}

// Lo que toca por defecto (sin el día cambiado a mano ni el caos): para saber si un cambio vuelve a lo de siempre.
export function porDefecto(regla, dn) {
  return plan({ ...regla, dias: {}, caos: null }, dn);
}

export const modoDe = (regla, id) => regla.modos.find(m => m.id === id) || regla.modos[0];

// Oficios de un día con su instante. Cada oficio dura hasta el siguiente; una hora menor que la
// anterior es ya del día siguiente (acostarse a las 0:30).
export function oficiosDia(regla, dn, tz, sinCaos = false) {
  const p = plan(regla, dn, sinCaos);
  const m = !p.caos && modoDe(regla, p.modo);
  if (!m) return { plan: p, oficios: [] };
  let prev = -1, add = 0;
  const oficios = m.oficios.map(o => {
    let mi = toMin(o.h) + add;
    if (mi < prev) { add += 1440; mi += 1440; }
    prev = mi;
    return { name: o.ocio && p.gym ? (regla.alterno || 'Gym') : o.n, t: instante(dn, mi, tz), ocio: !!o.ocio };
  });
  return { plan: { ...p, nombre: m.nombre }, oficios };
}

// El día de la regla empieza con su primer oficio: a las 2 de la noche aún manda «A dormir» de ayer.
function inicio(regla, dn, tz) {
  const o = oficiosDia(regla, dn, tz, true).oficios[0];
  return o ? o.t : instante(dn, 0, tz);
}

// Dónde estoy ahora: el día de la regla, su plan, el oficio en curso (con su fin) y el siguiente.
export function ahora(regla, now, tz) {
  const dn0 = dnOf(ymdIn(now, tz));
  const dn = now >= inicio(regla, dn0, tz) ? dn0 : dn0 - 1;
  const hoy = oficiosDia(regla, dn, tz), fin = inicio(regla, dn + 1, tz);
  if (!hoy.oficios.length) return { dn, plan: hoy.plan, oficios: [], cur: null, next: null, fin };
  const list = hoy.oficios;
  const i = Math.max(0, list.findLastIndex(o => o.t <= now));
  const cur = { ...list[i], to: i + 1 < list.length ? list[i + 1].t : fin };
  const next = i + 1 < list.length ? list[i + 1] : (oficiosDia(regla, dn + 1, tz).oficios[0] || null);
  return { dn, plan: hoy.plan, oficios: list, cur, next, fin };
}

// ---------- Limpieza, validación y copia entre dispositivos ----------

// Quita lo caducado: días cambiados de hace más de una semana y un caos ya vuelto.
export function poda(regla, dnHoy) {
  for (const k of Object.keys(regla.dias || {})) if (dnStr(k) < dnHoy - 7) delete regla.dias[k];
  if (regla.caos && dnStr(regla.caos.vuelta) <= dnHoy - 1) regla.caos = null;
  return regla;
}

const HH = /^([01]\d|2[0-3]):[0-5]\d$/, MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const semOk = (s, ids) => Array.isArray(s) && s.length === 7 && s.every(d => d && ids.has(d.modo));

// Una regla que llega de fuera (un enlace, un fichero) se acepta entera o no se acepta.
export function valida(r) {
  if (!r || !Array.isArray(r.modos) || !r.modos.length) return null;
  const ids = new Set();
  for (const m of r.modos) {
    if (!m || typeof m.id !== 'string' || typeof m.nombre !== 'string' || ids.has(m.id) || !Array.isArray(m.oficios) || !m.oficios.length) return null;
    if (!m.oficios.every(o => o && typeof o.n === 'string' && o.n.trim() && HH.test(o.h))) return null;
    ids.add(m.id);
  }
  if (!semOk(r.semana, ids)) return null;
  const temporadas = r.temporadas || [];
  if (!Array.isArray(temporadas) || !temporadas.every(t => t && MD.test(t.desde) && MD.test(t.hasta) && semOk(t.semana, ids))) return null;
  return {
    v: 1, alterno: typeof r.alterno === 'string' && r.alterno.trim() ? r.alterno : 'Gym',
    modos: r.modos.map(m => ({ id: m.id, nombre: m.nombre, oficios: m.oficios.map(o => ({ n: o.n, h: o.h, ...(o.ocio ? { ocio: true } : {}) })) })),
    semana: r.semana.map(d => ({ modo: d.modo, gym: !!d.gym })),
    temporadas: temporadas.map(t => ({ nombre: String(t.nombre || 'Temporada'), desde: t.desde, hasta: t.hasta, semanas: !!t.semanas, semana: t.semana.map(d => ({ modo: d.modo, gym: !!d.gym })) })),
    dias: {}, caos: null
  };
}

// El enlace lleva la regla en el fragmento (#regla=…), que el navegador no manda al servidor.
// Sin los días cambiados ni el caos: eso es de hoy, no de la regla.
const b64e = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export function codifica(regla) {
  const { modos, semana, temporadas, alterno } = regla;
  return b64e(JSON.stringify({ v: 1, alterno, modos, semana, temporadas }));
}
export function descodifica(s) {
  try { return valida(JSON.parse(b64d(s))); } catch (e) { return null; }
}
