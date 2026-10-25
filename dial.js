// Esfera en SVG (viewBox 320×320). Se basta sola: es la que algún día irá a un reloj de muñeca.

import { OFFICES, at } from './sun.js';

const C = 160, rad = Math.PI / 180, dayMs = 86400000;
const f = n => n.toFixed(2);
const P = (r, a) => [C + r * Math.sin(a * rad), C - r * Math.cos(a * rad)];
const norm = a => ((a % 360) + 360) % 360;
const gap = (a, b) => Math.abs(norm(a - b + 180) - 180);

// Radios, de fuera adentro: nombres de los oficios, horas de reloj, anillo de horas temporales.
const R = { face: 156, name: 144, time: 128, ring1: 121, ring0: 100, nowOut: 124, mark0: 96, hand0: 86 };
const BOTTOM_LIFT = 8; // abajo el texto mira hacia dentro: su línea base va 8 más afuera

// Corona entre r0 y r1, de a0 a a1 en sentido horario (grados de reloj: 0 arriba).
function sector(r0, r1, a0, a1) {
  const lg = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${lg} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${lg} 0 ${f(x3)} ${f(y3)}Z`;
}

// Texto curvado centrado en el ángulo `a`: arriba se lee por fuera, abajo por dentro, siempre derecho.
function curved(pid, r, a, cls, text) {
  const bottom = norm(a) > 90 && norm(a) < 270, rr = bottom ? r + BOTTOM_LIFT : r, sp = 60;
  const [x0, y0] = P(rr, bottom ? a + sp : a - sp), [x1, y1] = P(rr, bottom ? a - sp : a + sp);
  return `<path id="${pid}" d="M${f(x0)} ${f(y0)}A${rr} ${rr} 0 0 ${bottom ? 0 : 1} ${f(x1)} ${f(y1)}" fill="none"/>`
    + `<text class="${cls}"><textPath href="#${pid}" startOffset="50%" text-anchor="middle">${text}</textPath></text>`;
}

// Coloca por orden de prioridad lo que no choca con lo ya puesto; lo que choca se omite.
function place(items, r) {
  const done = [];
  for (const x of items.sort((a, b) => a.pri - b.pri)) {
    const half = (x.w / 2 + 4) / (r + 4) / rad;
    if (done.some(y => gap(x.a, y.a) < half + y.half)) continue;
    done.push({ ...x, half });
  }
  return done;
}

// Ancho de los textos de la esfera, medido en Chrome: nombres en Alegreya SC 500 a 14, horas a 13.
const LAB_W = { Prima: 41, Tercia: 46, Sexta: 40, Nona: 37, 'Vísperas': 61, Completas: 74, Maitines: 63, Laudes: 49 };
const TIME_W = 30;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Esfera natural: el mediodía solar arriba y la medianoche abajo, y cada tramo ocupa lo que dura de
// verdad. La aguja gira a ritmo constante; lo que cambia con la estación es el tamaño de las horas:
// en invierno el arco de luz se encoge y en verano crece. Junto a cada cambio de oficio, su hora de
// reloj; la salida y la puesta de sol, en negrita.
// o = { day, night, noon, now, office, time, sub, isDay, next, polar, fmt, times }
// times: hora a enseñar por oficio y para 'ocaso' (ver dialTimes); sin él, la del tramo dibujado.
export function dialNatural(o, id = 'n') {
  const ang = t => norm((t - o.noon) / dayMs * 360);
  const sweep = (a, b) => norm(b - a);
  let s = `<circle class="face" cx="${C}" cy="${C}" r="${R.face}"/>`;
  const live = !o.polar && o.day;

  if (!live) {
    const k = o.polar === 'day' ? 'd0' : 'n0';
    s += `<path class="seg ${k}" d="${sector(R.ring0, R.ring1, 0, 180)}"/><path class="seg ${k}" d="${sector(R.ring0, R.ring1, 180, 360)}"/>`;
  } else {
    let nowPath = '';
    for (const seg of [o.day, o.night]) {
      if (!seg) continue;
      const k = seg.kind === 'day' ? 'd' : 'n', hm = (seg.end - seg.start) / 12;
      for (let i = 0; i < 12; i++) {
        const a = seg.start.getTime() + i * hm, b = a + hm, a0 = ang(a), sw = sweep(a0, ang(b));
        const now = o.now >= a && o.now < b;
        const p = `<path class="seg ${k}${i % 2}${now ? ' now' : ''}" d="${sector(R.ring0, now ? R.nowOut : R.ring1, a0, a0 + sw)}"/>`;
        if (now) nowPath = p; else s += p;
      }
    }
    s += nowPath;

    const marks = OFFICES.map(x => ({ name: x.name, t: x.p < 12 ? at(o.day, x.p / 12) : at(o.night, (x.p - 12) / 12) })).filter(x => x.t);
    marks.forEach((x, i) => { x.a = ang(x.t); x.sw = sweep(x.a, ang(marks[(i + 1) % marks.length].t)); x.i = i; });

    // Divisorias de los oficios y horizonte (salida y puesta), solo sobre el anillo.
    for (const x of marks) {
      const [x0, y0] = P(R.mark0, x.a), [x1, y1] = P(R.nowOut, x.a);
      s += `<line class="o-sep${x.name === o.next ? ' next' : ''}" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`;
    }
    for (const t of [o.day.start, o.day.end]) {
      const [x0, y0] = P(R.mark0 - 4, ang(t)), [x1, y1] = P(R.nowOut, ang(t));
      s += `<line class="horizon" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`;
    }

    // Nombres, centrados en su tramo: pueden desbordarlo, pero si chocan con un vecino se omiten
    // (cuando el día se comprime, como en Tromsø). Primero el oficio en curso, luego los tramos anchos.
    const names = place(marks.map(x => ({ ...x, a: x.a + x.sw / 2, w: LAB_W[x.name], pri: x.name === o.office ? -1 : -x.sw })), R.name);
    for (const x of names) {
      const cls = 'o-lab' + (x.name === o.office ? (o.isDay ? ' cur day' : ' cur') : '');
      s += curved(`${id}-o${x.i}`, R.name, x.a, cls, x.name);
    }

    // Horas de reloj en cada divisoria, y la puesta de sol a mitad de Vísperas: los nombres marcan el
    // tramo y las horas sus bordes (Prima, de la salida a Tercia). Prioridad: el oficio siguiente,
    // salida y puesta, Sexta (mediodía) y el resto.
    const sunset = { name: 'ocaso', a: ang(o.day.end), hz: true };
    const times = place([...marks.map(x => ({ ...x, hz: x.name === 'Prima' })), sunset].map(x => ({
      ...x, w: TIME_W, pri: x.name === o.next ? -1 : x.hz ? 0 : x.name === 'Sexta' ? 2 : 3 + (x.i || 0) / 10
    })), R.time);
    times.forEach((x, k) => {
      const cls = 't-lab' + (x.hz ? ' hz' : '') + (x.name === o.next ? ' next' : '');
      const t = (o.times && o.times[x.name]) || (x.name === 'ocaso' ? o.day.end : x.t);
      s += curved(`${id}-t${k}`, R.time, x.a, cls, o.fmt(t));
    });

    const a = ang(o.now), [hx0, hy0] = P(R.hand0, a), [hx1, hy1] = P(R.nowOut, a);
    s += `<line class="hand" x1="${f(hx0)}" y1="${f(hy0)}" x2="${f(hx1)}" y2="${f(hy1)}"/><circle class="hand-dot" cx="${f(hx0)}" cy="${f(hy0)}" r="4.5"/>`;
  }

  s += `<text class="c-office${o.isDay ? ' day' : ''}${live ? '' : ' small'}" x="${C}" y="${C - 14}">${esc(o.office)}</text>`;
  s += `<text class="c-time" x="${C}" y="${C + 24}">${esc(o.time)}</text>`;
  s += `<text class="c-sub" x="${C}" y="${C + 47}">${esc(o.sub)}</text>`;
  return s;
}
