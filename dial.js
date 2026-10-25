// Esfera en SVG (viewBox 320×320). Se basta sola: es la que algún día irá a un reloj de muñeca.

import { OFFICES, at } from './sun.js';

const C = 160, rad = Math.PI / 180, dayMs = 86400000;
const f = n => n.toFixed(2);
const P = (r, a) => [C + r * Math.sin(a * rad), C - r * Math.cos(a * rad)];
const norm = a => ((a % 360) + 360) % 360;

// Corona entre r0 y r1, de a0 a a1 en sentido horario (grados de reloj: 0 arriba).
function sector(r0, r1, a0, a1) {
  const lg = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${lg} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${lg} 0 ${f(x3)} ${f(y3)}Z`;
}

// Ancho de cada nombre en la esfera (Alegreya SC 500 a 14 px), medido en Chrome.
const LAB_W = { Prima: 41, Tercia: 46, Sexta: 40, Nona: 37, 'Vísperas': 61, Completas: 74, Maitines: 63, Laudes: 49 };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Esfera natural: el mediodía solar arriba y la medianoche abajo, y cada tramo ocupa lo que dura de
// verdad. La aguja gira a ritmo constante; lo que cambia con la estación es el tamaño de las horas:
// en invierno el arco de luz se encoge y en verano crece.
// o = { day, night, noon, now, office, time, sub, isDay, next, polar }
export function dialNatural(o, id = 'n') {
  const ang = t => norm((t - o.noon) / dayMs * 360);
  const sweep = (a, b) => norm(b - a);
  let s = `<circle class="face" cx="${C}" cy="${C}" r="156"/>`;
  const live = !o.polar && o.day;

  if (!live) {
    const k = o.polar === 'day' ? 'd0' : 'n0';
    s += `<path class="seg ${k}" d="${sector(108, 128, 0, 180)}"/><path class="seg ${k}" d="${sector(108, 128, 180, 360)}"/>`;
  } else {
    let nowPath = '';
    for (const seg of [o.day, o.night]) {
      if (!seg) continue;
      const k = seg.kind === 'day' ? 'd' : 'n', hm = (seg.end - seg.start) / 12;
      for (let i = 0; i < 12; i++) {
        const a = seg.start.getTime() + i * hm, b = a + hm, a0 = ang(a), sw = sweep(a0, ang(b));
        const now = o.now >= a && o.now < b;
        const p = `<path class="seg ${k}${i % 2}${now ? ' now' : ''}" d="${sector(108, now ? 131 : 128, a0, a0 + sw)}"/>`;
        if (now) nowPath = p; else s += p;
      }
    }
    s += nowPath;

    // Horizonte: salida y puesta de sol, donde el oro se vuelve azul.
    for (const t of [o.day.start, o.day.end]) {
      const [x0, y0] = P(98, ang(t)), [x1, y1] = P(136, ang(t));
      s += `<line class="horizon" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`;
    }

    // Oficios: cada nombre centrado en su tramo, hasta el siguiente. Puede desbordar el tramo (las
    // divisorias no llegan a la franja de los nombres), pero si choca con un vecino se omite: cuando el
    // día se comprime, como en Tromsø. El oficio en curso va primero; luego, los tramos más anchos.
    const marks = OFFICES.map(x => ({ name: x.name, t: x.p < 12 ? at(o.day, x.p / 12) : at(o.night, (x.p - 12) / 12) })).filter(x => x.t);
    marks.forEach((x, i) => {
      const nx = marks[(i + 1) % marks.length];
      x.a0 = ang(x.t); x.sw = sweep(x.a0, ang(nx.t)); x.mid = x.a0 + x.sw / 2;
      x.bottom = norm(x.mid) > 90 && norm(x.mid) < 270; x.r = x.bottom ? 147 : 137;
      x.half = (LAB_W[x.name] / 2 + 5) / x.r / rad;
      x.i = i;
    });
    const placed = [];
    for (const x of [...marks].sort((a, b) => (b.name === o.office) - (a.name === o.office) || b.sw - a.sw)) {
      if (placed.some(y => Math.abs(norm(x.mid - y.mid + 180) - 180) < x.half + y.half)) continue;
      placed.push(x);
      const sp = 60, mid = x.mid, r = x.r, bottom = x.bottom;
      const [x0, y0] = P(r, bottom ? mid + sp : mid - sp), [x1, y1] = P(r, bottom ? mid - sp : mid + sp);
      s += `<path id="${id}-o${x.i}" d="M${f(x0)} ${f(y0)}A${r} ${r} 0 0 ${bottom ? 0 : 1} ${f(x1)} ${f(y1)}" fill="none"/>`;
      const cls = 'o-lab' + (x.name === o.office ? (o.isDay ? ' cur day' : ' cur') : '');
      s += `<text class="${cls}"><textPath href="#${id}-o${x.i}" startOffset="50%" text-anchor="middle">${x.name}</textPath></text>`;
    }
    for (const x of marks) {
      const [lx0, ly0] = P(103, x.a0), [lx1, ly1] = P(134, x.a0);
      s += `<line class="o-sep${x.name === o.next ? ' next' : ''}" x1="${f(lx0)}" y1="${f(ly0)}" x2="${f(lx1)}" y2="${f(ly1)}"/>`;
    }

    const a = ang(o.now), [hx0, hy0] = P(92, a), [hx1, hy1] = P(132, a);
    s += `<line class="hand" x1="${f(hx0)}" y1="${f(hy0)}" x2="${f(hx1)}" y2="${f(hy1)}"/><circle class="hand-dot" cx="${f(hx0)}" cy="${f(hy0)}" r="4.5"/>`;
  }

  s += `<text class="c-office${o.isDay ? ' day' : ''}${live ? '' : ' small'}" x="${C}" y="${C - 18}">${esc(o.office)}</text>`;
  s += `<text class="c-time" x="${C}" y="${C + 22}">${esc(o.time)}</text>`;
  s += `<text class="c-sub" x="${C}" y="${C + 50}">${esc(o.sub)}</text>`;
  return s;
}
