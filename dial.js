// Esfera en SVG (viewBox 320×320). Se basta sola: es la que algún día irá a un reloj de muñeca.

import { OFFICES, at } from './sun.js';

const C = 160, rad = Math.PI / 180, dayMs = 86400000;
const f = n => n.toFixed(2);
const P = (r, a) => [C + r * Math.sin(a * rad), C - r * Math.cos(a * rad)];
const norm = a => ((a % 360) + 360) % 360;
const gap = (a, b) => Math.abs(norm(a - b + 180) - 180);

// Radios, de fuera adentro: nombres de los oficios, horas de reloj (si se piden), anillo de horas
// temporales. Sin horas, el anillo crece y ocupa la franja que dejan.
const R_CLEAN = { face: 156, name: 137, ring1: 128, ring0: 108, nowOut: 131, mark0: 103, hand0: 92 };
const R_TIMES = { face: 156, name: 144, time: 128, ring1: 121, ring0: 100, nowOut: 124, mark0: 96, hand0: 86 };
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

// Números romanos de las horas, en Alegreya 600 a 11: ancho aproximado por letra (I estrecha, V y X anchas).
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const romW = s => [...s].reduce((w, c) => w + (c === 'I' ? 4 : 7.5), 0);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Esfera natural: el mediodía solar arriba y la medianoche abajo, y cada tramo ocupa lo que dura de
// verdad. La aguja gira a ritmo constante; lo que cambia con la estación es el tamaño de las horas:
// en invierno el arco de luz se encoge y en verano crece. Con showTimes, junto a cada cambio de oficio
// va su hora de reloj, y la salida y la puesta de sol en negrita. Cada tramo de oficio es tocable:
// lleva data-o, data-from y data-to (ms) para que la app enseñe su horario en el centro.
// o = { day, night, noon, now, office, time, sub, isDay, next, polar, fmt, times, showTimes, peek, small }
// times: hora a enseñar por oficio y para 'ocaso' (ver dialTimes); sin él, la del tramo dibujado.
// peek: oficio que se está consultando (se resalta su nombre); peekHour: hora consultada ('d0'…'n11'),
// que se levanta en el anillo; small: la línea de la hora, más pequeña.
export function dialNatural(o, id = 'n') {
  const R = o.showTimes ? R_TIMES : R_CLEAN;
  const ang = t => norm((t - o.noon) / dayMs * 360);
  const sweep = (a, b) => norm(b - a);
  let s = `<circle class="face" cx="${C}" cy="${C}" r="${R.face}"/>`;
  const live = !o.polar && o.day;

  if (!live) {
    const k = o.polar === 'day' ? 'd0' : 'n0';
    s += `<path class="seg ${k}" d="${sector(R.ring0, R.ring1, 0, 180)}"/><path class="seg ${k}" d="${sector(R.ring0, R.ring1, 180, 360)}"/>`;
  } else {
    let nowPath = '', hourHits = '', nums = '';
    for (const seg of [o.day, o.night]) {
      if (!seg) continue;
      const k = seg.kind === 'day' ? 'd' : 'n', hm = (seg.end - seg.start) / 12;
      for (let i = 0; i < 12; i++) {
        const a = seg.start.getTime() + i * hm, b = a + hm, a0 = ang(a), sw = sweep(a0, ang(b));
        const now = o.now >= a && o.now < b, pk = o.peekHour === k + i;
        const p = `<path class="seg ${k}${i % 2}${now ? ' now' : ''}${pk ? ' peek' : ''}" d="${sector(R.ring0, now || pk ? R.nowOut : R.ring1, a0, a0 + sw)}"/>`;
        if (now || pk) nowPath += p; else s += p;
        hourHits += `<path class="hit" data-h="${k}${i}" d="${sector(R.mark0 - 6, R.nowOut + 2, a0, a0 + sw)}"/>`;
        // Número romano de la hora, derecho (girado, XI y IX se confunden en los costados) y dentro de
        // su trozo: lo que ocupa a lo largo del anillo tiene que caber; si no (Tromsø), se omite.
        const rm = (R.ring0 + R.ring1) / 2, mid = a0 + sw / 2, w = romW(ROM[i]);
        if (w * Math.abs(Math.cos(mid * rad)) + 8 * Math.abs(Math.sin(mid * rad)) + 2 <= sw * rad * rm) {
          const [nx, ny] = P(rm, mid);
          nums += `<text class="rn ${k}${i % 2}" x="${f(nx)}" y="${f(ny)}">${ROM[i]}</text>`;
        }
      }
    }
    s += nowPath + nums;

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
    const hl = o.peek || o.office, dayName = n => OFFICES.find(x => x.name === n).p < 12;
    const names = place(marks.map(x => ({ ...x, a: x.a + x.sw / 2, w: LAB_W[x.name], pri: x.name === hl ? -1000 : -x.sw })), R.name);
    for (const x of names) {
      const cls = 'o-lab' + (x.name === hl ? (dayName(x.name) ? ' cur day' : ' cur') : '');
      s += curved(`${id}-o${x.i}`, R.name, x.a, cls, x.name);
    }

    // Horas de reloj en cada divisoria, y la puesta de sol a mitad de Vísperas: los nombres marcan el
    // tramo y las horas sus bordes (Prima, de la salida a Tercia). Prioridad: el oficio siguiente,
    // salida y puesta, Sexta (mediodía) y el resto.
    if (o.showTimes) {
      const sunset = { name: 'ocaso', a: ang(o.day.end), hz: true };
      const times = place([...marks.map(x => ({ ...x, hz: x.name === 'Prima' })), sunset].map(x => ({
        ...x, w: TIME_W, pri: x.name === o.next ? -1 : x.hz ? 0 : x.name === 'Sexta' ? 2 : 3 + (x.i || 0) / 10
      })), R.time);
      times.forEach((x, k) => {
        const cls = 't-lab' + (x.hz ? ' hz' : '') + (x.name === o.next ? ' next' : '');
        const t = (o.times && o.times[x.name]) || (x.name === 'ocaso' ? o.day.end : x.t);
        s += curved(`${id}-t${k}`, R.time, x.a, cls, o.fmt(t));
      });
    }

    const a = ang(o.now), [hx0, hy0] = P(R.hand0, a), [hx1, hy1] = P(R.nowOut, a);
    s += `<line class="hand" x1="${f(hx0)}" y1="${f(hy0)}" x2="${f(hx1)}" y2="${f(hy1)}"/><circle class="hand-dot" cx="${f(hx0)}" cy="${f(hy0)}" r="4.5"/>`;

    // Oficio consultado entero: su tramo del anillo, enmarcado en negro de borde a borde.
    const pk = o.peek && !o.peekHour && marks.find(x => x.name === o.peek);
    if (pk) s += `<path class="span-peek" d="${sector(R.ring0, R.nowOut, pk.a, pk.a + pk.sw)}"/>`;

    // Zonas tocables, encima de todo: cada hora temporal en el anillo y cada oficio entero por fuera.
    s += hourHits;
    marks.forEach((x, i) => {
      // Fin: la hora del oficio siguiente si viene después; si no (el siguiente es el que está en curso
      // y su hora es la de comienzo, ya pasada), el inicio más lo que dura el tramo dibujado.
      const nx = marks[(i + 1) % marks.length], from = ((o.times && o.times[x.name]) || x.t).getTime();
      const nt = o.times && o.times[nx.name] && o.times[nx.name].getTime();
      const to = nt > from ? nt : from + (nx.t - x.t + dayMs) % dayMs;
      s += `<path class="hit" data-o="${x.name}" data-from="${from}" data-to="${to}" d="${sector(R.nowOut + 2, R.face, x.a, x.a + x.sw)}"><title>${x.name}</title></path>`;
    });
  }

  s += `<text class="c-office${o.isDay ? ' day' : ''}${live ? '' : ' small'}" x="${C}" y="${C - 14}">${esc(o.office)}</text>`;
  s += `<text class="c-time${o.small ? ' small' : ''}" x="${C}" y="${C + 24}">${esc(o.time)}</text>`;
  s += `<text class="c-sub" x="${C}" y="${C + 47}">${esc(o.sub)}</text>`;
  return s;
}
