// Pruebas del cálculo: node test.mjs
import assert from 'node:assert/strict';
import { buildCtx, cyclePos, officeAt, todayOffices, nextOffice, dialTimes, hourSpan } from './sun.js';
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

// Horas de la esfera el día del cambio de hora, antes del amanecer: Laudes (en curso) enseña cuándo
// empezó; Completas, la de esta noche (no la de anoche, con horario de verano); la puesta, la de hoy.
{
  const now = new Date('2026-10-25T05:53:00Z'), t = dialTimes(now, ...MAD);
  near(t.Laudes, '06:31'); near(t.Completas, '19:29'); near(t.ocaso, '18:22'); near(t.Prima, '07:37');
  assert.ok(t.Maitines > now);
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
  const svg = dialNatural({ ...c, now, office: 'Tercia', time: '10:40', sub: 'hora IV · minuto 24', isDay: true, next: 'Sexta', fmt: d => d.toISOString().slice(11, 16) });
  for (const n of ['Prima', 'Tercia', 'Sexta', 'Nona', 'Vísperas', 'Completas', 'Maitines', 'Laudes']) assert.ok(svg.includes(`>${n}</textPath>`), n);
  assert.ok(!svg.includes('NaN'));
  assert.ok(c.day.end - c.day.start < 10 * 3600000);
}

// En verano también caben los ocho, aunque Laudes desborde su tramo de 46 minutos.
{
  const now = new Date('2026-06-21T10:00:00Z'), c = buildCtx(now, ...MAD);
  const svg = dialNatural({ ...c, now, office: 'Tercia', time: '12:00', sub: '', isDay: true, fmt: d => d.toISOString().slice(11, 16) });
  for (const n of ['Prima', 'Sexta', 'Vísperas', 'Laudes']) assert.ok(svg.includes(`>${n}</textPath>`), n);
  assert.ok(!svg.includes('NaN'));
}

// Tromsø a finales de noviembre: el día se comprime, los nombres que chocan se omiten
// y el oficio en curso se queda.
{
  const now = new Date('2026-11-24T10:00:00Z'), c = buildCtx(now, 69.65, 18.96, 'Europe/Oslo');
  assert.ok(!c.polar && c.day.end - c.day.start < 3 * 3600000);
  const svg = dialNatural({ ...c, now, office: 'Sexta', time: '11:00', sub: '', isDay: true, fmt: d => d.toISOString().slice(11, 16) });
  const shown = ['Prima', 'Tercia', 'Sexta', 'Nona', 'Vísperas', 'Completas', 'Maitines', 'Laudes'].filter(n => svg.includes(`>${n}</textPath>`));
  assert.ok(shown.includes('Sexta') && shown.length < 8 && !svg.includes('NaN'), shown.join());
}

console.log('ok');

// Hora temporal consultada: la en curso o la próxima (antes del amanecer, la 1.ª del día es la de hoy).
{
  const now = new Date('2026-10-25T05:53:00Z');
  const h = hourSpan(now, ...MAD, 'day', 0);
  near(h.from, '07:37'); assert.ok(h.to - h.from > 50 * 60000 && h.to - h.from < 56 * 60000);
  const n = hourSpan(now, ...MAD, 'night', 11);
  assert.ok(n.from <= now && n.to > now);
}
console.log('ok horas');

// ---------- Mi regla ----------
import { ejemplo, plan, ahora, oficiosDia, enTemporada, dnStr, valida, codifica, descodifica, poda } from './regla.js';
{
  const r = ejemplo(), tz = 'Europe/Madrid';
  // Lunes 26-10-2026: Trabajo; viernes 30: Jornada corta; sábado 31: Libre.
  assert.equal(plan(r, dnStr('2026-10-26')).modo, 'trabajo');
  assert.equal(plan(r, dnStr('2026-10-30')).modo, 'corta');
  assert.equal(plan(r, dnStr('2026-10-31')).modo, 'libre');

  // Las horas son de reloj en la zona del lugar, también el día del cambio de hora (25-10, domingo).
  const d = oficiosDia(r, dnStr('2026-10-25'), tz).oficios;
  assert.equal(hm(d[0].t), '08:30'); assert.equal(d[0].name, 'Despertar');
  assert.equal(hm(oficiosDia(r, dnStr('2026-10-24'), tz).oficios[0].t), '08:30');

  // A las 3 de la noche del martes aún manda «A dormir» del lunes; a las 10, el Trabajo del martes.
  let a = ahora(r, new Date('2026-10-27T02:00:00Z'), tz);
  assert.equal(a.cur.name, 'A dormir'); assert.equal(a.dn, dnStr('2026-10-26')); assert.equal(a.next.name, 'Despertar');
  a = ahora(r, new Date('2026-10-27T09:00:00Z'), tz);
  assert.equal(a.cur.name, 'Trabajo'); assert.equal(hm(a.cur.to), '14:00'); assert.equal(a.next.name, 'Comida');

  // Gym: el hueco de ocio cambia de nombre, no se añaden horas.
  r.semana[0].gym = true;
  const g = oficiosDia(r, dnStr('2026-10-26'), tz).oficios;
  assert.ok(g.some(o => o.name === 'Gym') && !g.some(o => o.name === 'Ocio') && g.length === 7);

  // Un día cambiado a mano manda sobre la semana.
  r.dias['2026-10-27'] = { modo: 'libre', gym: false };
  assert.equal(plan(r, dnStr('2026-10-27')).modo, 'libre');

  // El caos manda sobre todo y vuelve solo: desde el 30-10, vuelta el 10-11.
  r.caos = { desde: '2026-10-30', vuelta: '2026-11-10' };
  assert.ok(plan(r, dnStr('2026-11-09')).caos);
  assert.ok(!plan(r, dnStr('2026-11-10')).caos && !plan(r, dnStr('2026-10-29')).caos);
  assert.equal(ahora(r, new Date('2026-11-02T10:00:00Z'), tz).cur, null);
  poda(r, dnStr('2026-11-12'));
  assert.equal(r.caos, null);

  // Acostarse después de medianoche: la hora menor que la anterior es del día siguiente.
  r.modos[2].oficios.push({ n: 'Tarde', h: '00:30' });
  const late = oficiosDia(r, dnStr('2026-11-01'), tz).oficios.at(-1);
  assert.equal(late.t.toISOString(), '2026-11-01T23:30:00.000Z');
}

// Temporada por semanas enteras: «de la semana del 30-06 a la del 01-09» en 2027 va del lunes 28-06 al domingo 05-09.
{
  const tp = { desde: '06-30', hasta: '09-01', semanas: true };
  assert.ok(!enTemporada(tp, dnStr('2027-06-27')) && enTemporada(tp, dnStr('2027-06-28')));
  assert.ok(enTemporada(tp, dnStr('2027-09-05')) && !enTemporada(tp, dnStr('2027-09-06')));
  // Una que cruza el año.
  const inv = { desde: '12-20', hasta: '01-06' };
  assert.ok(enTemporada(inv, dnStr('2027-01-03')) && enTemporada(inv, dnStr('2026-12-25')) && !enTemporada(inv, dnStr('2027-01-07')));
}

// El enlace ida y vuelta, con tildes; una regla rota no entra.
{
  const r = ejemplo(); r.modos[0].nombre = 'Oficina y tráfico';
  const back = descodifica(codifica(r));
  assert.equal(back.modos[0].nombre, 'Oficina y tráfico'); assert.deepEqual(back.semana, r.semana);
  assert.equal(descodifica('basura'), null);
  assert.equal(valida({ ...r, semana: r.semana.slice(0, 6) }), null);
  assert.equal(valida({ ...r, modos: [{ ...r.modos[0], oficios: [{ n: 'X', h: '25:00' }] }] }), null);
}

// La esfera con oficios propios: los nombres que caben y ni un NaN.
{
  const r = ejemplo(), now = new Date('2026-10-27T09:00:00Z'), c = buildCtx(now, ...MAD), a = ahora(r, now, MAD[2]);
  const svg = dialNatural({ ...c, now, office: a.cur.name, time: '10:00', sub: '', isDay: true, next: a.next.name, marks: a.oficios });
  assert.ok(svg.includes('>Trabajo</textPath>') && !svg.includes('>Prima</textPath>') && !svg.includes('NaN'));
}
console.log('ok regla');
