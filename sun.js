// Cálculo puro: posición del Sol, horas temporales y oficios. Sin DOM, para poder probarlo con node.

const rad = Math.PI / 180, dayMs = 86400000;
const J1970 = 2440588, J2000 = 2451545, J0 = 0.0009, OBL = rad * 23.4397;

// Salida, puesta y mediodía solar del día solar más cercano a `date` (fórmulas de SunCalc,
// refracción estándar de -0,833° en el horizonte).
export function sunTimes(date, lat, lon) {
  const lw = rad * -lon, phi = rad * lat;
  const d = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBL) * Math.sin(L));
  const fromJ = j => new Date((j + 0.5 - J1970) * dayMs);
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const h0 = -0.833 * rad;
  const cosw = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosw > 1) return { polar: 'night', noon: fromJ(Jnoon) };
  if (cosw < -1) return { polar: 'day', noon: fromJ(Jnoon) };
  const w = Math.acos(cosw);
  const a = J0 + (w + lw) / (2 * Math.PI) + n;
  const Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return { polar: null, rise: fromJ(Jnoon - (Jset - Jnoon)), set: fromJ(Jset), noon: fromJ(Jnoon) };
}

// Fecha civil de un instante en una zona horaria.
export function ymdIn(date, tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month - 1, d: +p.day };
}

// Un instante cerca del mediodía solar de un día civil: basta para que sunTimes elija ese día.
export const solarNoon = (y, m, d, lon) => new Date(Date.UTC(y, m, d, 12) - lon / 360 * dayMs);

export const at = (seg, f) => seg ? new Date(seg.start.getTime() + f * (seg.end - seg.start)) : null;

// El día de hoy en el lugar: tramo de luz, noche anterior y noche siguiente, y en cuál estamos.
export function buildCtx(now, lat, lon, tz) {
  const { y, m, d } = ymdIn(now, tz);
  const S = k => sunTimes(solarNoon(y, m, d + k, lon), lat, lon);
  const yd = S(-1), td = S(0), tm = S(1);
  if (td.polar) return { polar: td.polar, noon: td.noon };
  const ctx = { day: { start: td.rise, end: td.set, kind: 'day' }, noon: td.noon };
  ctx.nightPrev = yd.polar ? null : { start: yd.set, end: td.rise, kind: 'night' };
  ctx.nightNext = tm.polar ? null : { start: td.set, end: tm.rise, kind: 'night' };
  if (now < td.rise) ctx.cur = ctx.nightPrev;
  else if (now >= td.set) ctx.cur = ctx.nightNext;
  else ctx.cur = ctx.day;
  ctx.night = ctx.cur && ctx.cur.kind === 'night' ? ctx.cur : (ctx.nightNext || ctx.nightPrev);
  return ctx;
}

// Hora temporal (1-12) y fracción dentro de ella.
export function temporal(seg, t) {
  const f = (t - seg.start) / (seg.end - seg.start);
  const x = Math.min(Math.max(f, 0), 0.999999) * 12, h = Math.floor(x);
  return { hour: h + 1, frac: x - h, minute: Math.floor((x - h) * 60) };
}

// Posición en el ciclo completo, en horas temporales: 0-12 el día, 12-24 la noche.
export function cyclePos(ctx, t) {
  const tp = temporal(ctx.cur, t);
  return (ctx.cur.kind === 'day' ? 0 : 12) + tp.hour - 1 + tp.frac;
}

// Los ocho oficios, por su posición en el ciclo (reparto de la Regla de San Benito).
export const OFFICES = [
  { name: 'Prima', p: 0 },
  { name: 'Tercia', p: 3 },
  { name: 'Sexta', p: 6 },
  { name: 'Nona', p: 9 },
  { name: 'Vísperas', p: 11 },
  { name: 'Completas', p: 13 },
  { name: 'Maitines', p: 19 },
  { name: 'Laudes', p: 23 }
];

// Oficio en cuyo tramo cae una posición del ciclo. La tolerancia absorbe el redondeo a milisegundos
// de los instantes: sin ella, en el minuto exacto de Sexta saldría Tercia.
export function officeAt(p) {
  let o = OFFICES[OFFICES.length - 1];
  for (const x of OFFICES) if (x.p <= p + 1e-6) o = x;
  return o;
}

// Instante de un oficio dentro de un tramo concreto.
const timeIn = (seg, p) => at(seg, (p % 12) / 12);

// Horario de hoy: Maitines y Laudes de la noche anterior, los del día y Completas de esta noche.
export function todayOffices(ctx) {
  return OFFICES.map(o => {
    const seg = o.p < 12 ? ctx.day : o.name === 'Completas' ? ctx.nightNext : ctx.nightPrev;
    return { name: o.name, p: o.p, kind: o.p < 12 ? 'd' : 'n', t: timeIn(seg, o.p) };
  }).sort((a, b) => (a.t ? a.t.getTime() : Infinity) - (b.t ? b.t.getTime() : Infinity));
}

// Horas de reloj que enseña la esfera: el oficio en curso, la hora a la que empezó; los demás, la
// próxima vez que tocan; y la próxima puesta de sol. Así, antes del amanecer, Completas no enseña
// la de anoche, que en un cambio de hora puede ir una hora desfasada.
export function dialTimes(now, lat, lon, tz) {
  const ctxs = [-1, 0, 1].map(k => buildCtx(new Date(now.getTime() + k * dayMs), lat, lon, tz)).filter(c => !c.polar);
  const all = ctxs.flatMap(todayOffices).filter(o => o.t).sort((a, b) => a.t - b.t);
  const past = all.filter(o => o.t <= now), from = past.length ? past[past.length - 1].t : now;
  const out = {};
  for (const o of all) if (o.t >= from && !(o.name in out)) out[o.name] = o.t;
  out.ocaso = ctxs.map(c => c.day.end).find(t => t >= from) || null;
  return out;
}

// Siguiente oficio después de `now`, aunque caiga en la noche siguiente.
export function nextOffice(ctx, now) {
  const cands = todayOffices(ctx).concat(
    OFFICES.filter(o => o.p > 13).map(o => ({ name: o.name, p: o.p, t: timeIn(ctx.nightNext, o.p) }))
  );
  return cands.filter(o => o.t && o.t > now).sort((a, b) => a.t - b.t)[0] || null;
}
