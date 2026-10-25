// Pruebas del cálculo: node test.mjs
import assert from 'node:assert/strict';
import { buildCtx, cyclePos, officeAt, todayOffices, nextOffice } from './sun.js';
import { dialNatural } from './dial.js';

const MAD = [40.4168, -3.7038, 'Europe/Madrid'];
const hm = (d, tz = 'Europe/Madrid') => new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const near = (d, hhmm, tol = 3, tz) => {
  const [h, m] = hm(d, tz).split(':').map(Number), [H, M] = hhmm.split(':').map(Number);
  assert.ok(Math.abs(h * 60 + m - (H * 60 + M)) <= tol, `${hm(d, tz)} ≠ ${hhmm}`);
};

// Madrid, solsticio de verano de 2026 (CEST): sale 06:44, se pone 21:48 (tablas del IGN/OAN).
{
  const c = buildCtx(new Date('2026-06-21T10:00:00Z'), ...MAD);
  near(c.day.start, '06:44'); near(c.day.end, '21:48');
  assert.equal(c.cur.kind, 'day');
}

// Antes de amanecer manda la noche anterior; después del ocaso, la siguiente.
{
  const c1 = buildCtx(new Date('2026-10-25T04:00:00Z'), ...MAD);
  assert.equal(c1.cur, c1.nightPrev);
  const c2 = buildCtx(new Date('2026-10-25T21:00:00Z'), ...MAD);
  assert.equal(c2.cur, c2.nightNext);
  assert.ok(cyclePos(c2, new Date('2026-10-25T21:00:00Z')) >= 12);
}

// Sexta cae en el mediodía solar, a mitad del tramo de luz; el ciclo empieza en Prima.
{
  const now = new Date('2026-10-25T12:00:00Z'), c = buildCtx(now, ...MAD);
  const offs = todayOffices(c), sexta = offs.find(o => o.name === 'Sexta');
  assert.ok(Math.abs(sexta.t.getTime() - (c.day.start.getTime() + c.day.end.getTime()) / 2) < 1);
  assert.equal(officeAt(0).name, 'Prima');
  assert.equal(officeAt(12.5).name, 'Vísperas');
  assert.equal(officeAt(23.9).name, 'Laudes');
  assert.equal(officeAt(cyclePos(c, sexta.t)).name, 'Sexta');
  const nx = nextOffice(c, now);
  assert.ok(nx && nx.t > now);
}

// Después de Completas, el siguiente es Maitines de esta noche.
{
  const c = buildCtx(new Date('2026-10-25T22:30:00Z'), ...MAD);
  const nx = nextOffice(c, new Date('2026-10-25T22:30:00Z'));
  assert.equal(nx.name, 'Maitines');
}

// Lugar en otra zona horaria: las horas salen en la del lugar (Tokio, sin horario de verano).
{
  const c = buildCtx(new Date('2026-06-21T03:00:00Z'), 35.68, 139.69, 'Asia/Tokyo');
  near(c.day.start, '04:25', 4, 'Asia/Tokyo'); near(c.day.end, '19:00', 4, 'Asia/Tokyo');
}

// Tromsø en diciembre: noche polar, sin tramos.
{
  const c = buildCtx(new Date('2026-12-21T12:00:00Z'), 69.65, 18.96, 'Europe/Oslo');
  assert.equal(c.polar, 'night');
}

// La esfera se pinta: en invierno caben los ocho nombres y el arco de luz es menor que el de noche.
{
  const now = new Date('2026-12-21T09:40:00Z'), c = buildCtx(now, ...MAD);
  const svg = dialNatural({ ...c, now, office: 'Tercia', time: '10:40', sub: 'hora IV · minuto 24', isDay: true, next: 'Sexta' });
  for (const n of ['Prima', 'Tercia', 'Sexta', 'Nona', 'Vísperas', 'Completas', 'Maitines', 'Laudes']) assert.ok(svg.includes(`>${n}<`), n);
  assert.ok(!svg.includes('NaN'));
  assert.ok(c.day.end - c.day.start < 10 * 3600000);
}

// En verano también caben los ocho, aunque Laudes desborde su tramo de 46 minutos.
{
  const now = new Date('2026-06-21T10:00:00Z'), c = buildCtx(now, ...MAD);
  const svg = dialNatural({ ...c, now, office: 'Tercia', time: '12:00', sub: '', isDay: true });
  for (const n of ['Prima', 'Sexta', 'Vísperas', 'Laudes']) assert.ok(svg.includes(`>${n}<`), n);
  assert.ok(!svg.includes('NaN'));
}

// Tromsø a finales de noviembre: el día se comprime, los nombres que chocan se omiten
// y el oficio en curso se queda.
{
  const now = new Date('2026-11-24T10:00:00Z'), c = buildCtx(now, 69.65, 18.96, 'Europe/Oslo');
  assert.ok(!c.polar && c.day.end - c.day.start < 3 * 3600000);
  const svg = dialNatural({ ...c, now, office: 'Sexta', time: '11:00', sub: '', isDay: true });
  const shown = ['Prima', 'Tercia', 'Sexta', 'Nona', 'Vísperas', 'Completas', 'Maitines', 'Laudes'].filter(n => svg.includes(`>${n}<`));
  assert.ok(shown.includes('Sexta') && shown.length < 8 && !svg.includes('NaN'), shown.join());
}

console.log('ok');
