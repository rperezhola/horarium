// Esferas en SVG (viewBox 320×320). La natural se basta sola: es la que algún día irá a un reloj de muñeca.

import { OFFICES } from './sun.js';

const C = 160, rad = Math.PI / 180;
const f = n => n.toFixed(2);
const P = (r, a) => [C + r * Math.sin(a * rad), C - r * Math.cos(a * rad)];
const norm = a => ((a % 360) + 360) % 360;

// Corona entre r0 y r1, de a0 a a1 en sentido horario (grados de reloj: 0 arriba).
function sector(r0, r1, a0, a1) {
  const lg = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${lg} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${lg} 0 ${f(x3)} ${f(y3)}Z`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Esfera natural: el día arriba (amanecer a la izquierda, mediodía arriba, ocaso a la derecha) y la
// noche abajo. Cada hora temporal ocupa 15°; lo que cambia con la estación es la velocidad de la aguja.
// o = { p, office, time, sub, isDay, next, polar }  ·  p: posición en el ciclo (0-24) o null.
export function dialNatural(o, id = 'n') {
  const ang = p => 270 + 15 * p;
  let s = `<circle class="face" cx="${C}" cy="${C}" r="156"/>`;

  if (o.polar || o.p == null) {
    const k = o.polar === 'day' ? 'd0' : 'n0';
    s += `<path class="seg ${k}" d="${sector(108, 128, 0, 180)}"/><path class="seg ${k}" d="${sector(108, 128, 180, 360)}"/>`;
  } else {
    const cur = Math.floor(o.p);
    for (let k = 0; k < 24; k++) {
      const kind = k < 12 ? 'd' : 'n', now = k === cur;
      s += `<path class="seg ${kind}${k % 2}${now ? ' now' : ''}" d="${sector(108, now ? 131 : 128, ang(k), ang(k + 1))}"/>`;
    }
  }

  // Oficios: cada nombre centrado en su tramo, hasta el oficio siguiente.
  const curOffice = o.polar ? null : o.office;
  OFFICES.forEach((x, i) => {
    const pn = i + 1 < OFFICES.length ? OFFICES[i + 1].p : 24;
    const a = ang((x.p + pn) / 2), bottom = norm(a) > 90 && norm(a) < 270, sp = 40;
    const r = bottom ? 147 : 137;
    const [x0, y0] = P(r, bottom ? a + sp : a - sp), [x1, y1] = P(r, bottom ? a - sp : a + sp);
    s += `<path id="${id}-o${i}" d="M${f(x0)} ${f(y0)}A${r} ${r} 0 0 ${bottom ? 0 : 1} ${f(x1)} ${f(y1)}" fill="none"/>`;
    const cls = 'o-lab' + (x.name === curOffice ? (o.isDay ? ' cur day' : ' cur') : '');
    s += `<text class="${cls}"><textPath href="#${id}-o${i}" startOffset="50%" text-anchor="middle">${x.name}</textPath></text>`;
    const [lx0, ly0] = P(103, ang(x.p)), [lx1, ly1] = P(134, ang(x.p));
    s += `<line class="o-sep${x.name === o.next ? ' next' : ''}" x1="${f(lx0)}" y1="${f(ly0)}" x2="${f(lx1)}" y2="${f(ly1)}"/>`;
  });

  if (!o.polar && o.p != null) {
    const a = ang(o.p), [hx0, hy0] = P(92, a), [hx1, hy1] = P(132, a);
    s += `<line class="hand" x1="${f(hx0)}" y1="${f(hy0)}" x2="${f(hx1)}" y2="${f(hy1)}"/><circle class="hand-dot" cx="${f(hx0)}" cy="${f(hy0)}" r="4.5"/>`;
  }

  s += `<text class="c-office${o.isDay ? ' day' : ''}${o.polar ? ' small' : ''}" x="${C}" y="${C - 18}">${esc(o.office)}</text>`;
  s += `<text class="c-time" x="${C}" y="${C + 22}">${esc(o.time)}</text>`;
  s += `<text class="c-sub" x="${C}" y="${C + 50}">${esc(o.sub)}</text>`;
  return s;
}

// Esfera de 24 horas de reloj con las horas temporales pintadas encima: explica las estaciones.
// hours(d) devuelve la hora decimal de reloj de un instante en la zona del lugar.
export function dial24(ctx, now, list, next, hours, fmt) {
  const RI = 92, RO = 116;
  const ang = d => (hours(d) / 24 * 360 + 180) % 360;
  let s = `<circle class="d-civ" cx="${C}" cy="${C}" r="148"/>`;
  for (let h = 0; h < 24; h++) {
    const a = (h / 24 * 360 + 180) % 360, major = h % 6 === 0;
    const [x0, y0] = P(major ? 139 : 143, a), [x1, y1] = P(148, a);
    s += `<line class="d-tick${major ? ' major' : ''}" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`;
    if (h % 3 === 0) { const [lx, ly] = P(129, a); s += `<text class="d-lab${major ? ' major' : ''}" x="${f(lx)}" y="${f(ly)}">${h}</text>`; }
  }
  if (ctx.polar || !ctx.cur) {
    const k = ctx.polar === 'day' ? 'd0' : 'n0';
    s += `<path class="seg ${k}" d="${sector(RI, RO, 0, 180)}"/><path class="seg ${k}" d="${sector(RI, RO, 180, 360)}"/>`;
  } else {
    [ctx.day, ctx.night].forEach(seg => {
      if (!seg) return;
      const k = seg.kind === 'day' ? 'd' : 'n', hm = (seg.end - seg.start) / 12;
      for (let i = 0; i < 12; i++) {
        const a = new Date(seg.start.getTime() + i * hm), b = new Date(seg.start.getTime() + (i + 1) * hm);
        const a0 = ang(a); let sw = (ang(b) - a0 + 360) % 360; if (sw > 180) sw = 0.2;
        const isNow = ctx.cur === seg && now >= a && now < b;
        s += `<path class="seg ${k}${i % 2}${isNow ? ' now' : ''}" d="${sector(RI, isNow ? RO + 6 : RO, a0, a0 + Math.max(sw, 0.2))}"/>`;
      }
    });
    list.forEach(o => {
      if (!o.t) return;
      const [x, y] = P(82, ang(o.t)), r = 3.4, isN = next && next.t.getTime() === o.t.getTime();
      s += `<polygon class="can${isN ? ' next' : ''}" points="${f(x)},${f(y - r)} ${f(x + r)},${f(y)} ${f(x)},${f(y + r)} ${f(x - r)},${f(y)}"><title>${o.name} · ${fmt(o.t)}</title></polygon>`;
    });
  }
  const an = ang(now), [hx0, hy0] = P(60, an), [hx1, hy1] = P(RO + 3, an), [dx, dy] = P(RO + 8, an);
  s += `<line class="hand" x1="${f(hx0)}" y1="${f(hy0)}" x2="${f(hx1)}" y2="${f(hy1)}"/><circle class="hand-dot" cx="${f(dx)}" cy="${f(dy)}" r="4.5"/>`;
  s += `<text class="c-civ" x="${C}" y="${C + 6}">${fmt(now)}</text>`;
  return s;
}
