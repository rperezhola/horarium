// Pestaña «Regla»: editar los modos y sus oficios, la semana, las temporadas y copiar la regla a otro
// dispositivo. Cada cambio se guarda al momento; lo que se borra tiene Deshacer.

import { DIAS } from './regla.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const fromMin = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
// Las fechas de temporada se guardan MM-DD y se escriben dd-mm.
const md2dm = s => s.split('-').reverse().join('-');
const dm2md = s => {
  const m = /^\s*(\d{1,2})[-/.](\d{1,2})\s*$/.exec(s);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') : null;
};

// El primer oficio abre el día; los demás van en orden a partir de él (lo que pasa de medianoche, al final).
function ordena(m) {
  const f = toMin(m.oficios[0].h);
  const [first, ...rest] = m.oficios;
  rest.sort((a, b) => (toMin(a.h) - f + 1440) % 1440 - (toMin(b.h) - f + 1440) % 1440);
  m.oficios = [first, ...rest];
}

function week(r, sem, w, t) {
  const opts = sel => r.modos.map(m => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('');
  return `<ul class="week">${sem.map((d, i) => `<li><span class="wd">${DIAS[i]}</span>`
    + `<select data-f="wk" data-w="${w}" data-t="${t}" data-d="${i}" aria-label="${DIAS[i]}">${opts(d.modo)}</select>`
    + `<button class="mini${d.gym ? ' on' : ''}" data-act="wgym" data-w="${w}" data-t="${t}" data-d="${i}" aria-pressed="${!!d.gym}">${esc(r.alterno)}</button></li>`).join('')}</ul>`;
}

export function renderEditor(el, r, api) {
  const draw = () => {
    let s = `<h2>Modos</h2><p class="note">Cada oficio dura hasta el siguiente. Marca con «ocio» el hueco que pasa a ser «${esc(r.alterno)}» los días que lo enciendas.</p>`;
    r.modos.forEach((m, mi) => {
      s += `<div class="modo"><input class="m-name" data-f="mnombre" data-m="${mi}" value="${esc(m.nombre)}" aria-label="Nombre del modo"><ol class="ofs">`;
      m.oficios.forEach((o, oi) => {
        const a = `data-m="${mi}" data-o="${oi}"`;
        s += `<li><input type="time" data-f="h" ${a} value="${o.h}" aria-label="Hora"><input data-f="n" ${a} value="${esc(o.n)}" aria-label="Oficio">`
          + `<button class="mini${o.ocio ? ' on' : ''}" data-act="ocio" ${a} aria-pressed="${!!o.ocio}">ocio</button>`
          + `<button class="del" data-act="del-of" ${a} aria-label="Quitar ${esc(o.n)}">×</button></li>`;
      });
      s += `</ol><div class="m-btns"><button class="ghost" data-act="add-of" data-m="${mi}">Añadir oficio</button>`
        + `<button class="ghost" data-act="dup" data-m="${mi}">Duplicar</button><button class="ghost" data-act="del-m" data-m="${mi}">Borrar modo</button></div></div>`;
    });
    s += `<button class="ghost wide" data-act="add-m">Nuevo modo</button>`;

    s += `<h2>Semana</h2>${week(r, r.semana, 'sem', '')}`;

    s += `<h2>Temporadas</h2><p class="note">Fechas con su propia semana; se repiten cada año.</p>`;
    r.temporadas.forEach((t, ti) => {
      s += `<div class="modo"><input class="m-name" data-f="tnombre" data-t="${ti}" value="${esc(t.nombre)}" aria-label="Nombre de la temporada">`
        + `<div class="row"><label class="lab">Del<input data-f="tdesde" data-t="${ti}" value="${md2dm(t.desde)}" placeholder="dd-mm" inputmode="numeric"></label>`
        + `<label class="lab">al<input data-f="thasta" data-t="${ti}" value="${md2dm(t.hasta)}" placeholder="dd-mm" inputmode="numeric"></label></div>`
        + `<label class="chk"><input type="checkbox" data-f="tsem" data-t="${ti}"${t.semanas ? ' checked' : ''}> Por semanas enteras (de lunes a domingo)</label>`
        + week(r, t.semana, 'temp', ti)
        + `<div class="m-btns"><button class="ghost" data-act="del-t" data-t="${ti}">Borrar temporada</button></div></div>`;
    });
    s += `<button class="ghost wide" data-act="add-t">Nueva temporada</button>`;

    s += `<h2>El hueco de ocio</h2><div class="row"><label class="lab grow">Cuando cambia, se llama<input data-f="alterno" value="${esc(r.alterno)}"></label></div>`;

    s += `<h2>Copiar a otro dispositivo</h2><p class="note">Un enlace que lleva tu regla dentro: ábrelo en el otro dispositivo y se carga allí, sin pasar por ningún servidor.</p>`
      + `<button class="wide" data-act="copy">Copiar enlace</button>`
      + `<div class="row"><input id="imp" placeholder="Pega aquí un enlace de regla" autocomplete="off"><button data-act="imp">Cargar</button></div>`
      + `<button class="ghost wide" data-act="ejemplo">Volver a la regla de ejemplo</button>`;
    el.innerHTML = s;
  };

  // Lo que se borra se puede recuperar: se guarda la regla entera de antes.
  const snap = () => JSON.stringify({ modos: r.modos, semana: r.semana, temporadas: r.temporadas, dias: r.dias });
  const undoTo = before => () => { Object.assign(r, JSON.parse(before)); api.save(); draw(); };
  const done = (redraw = true) => { api.save(); if (redraw) draw(); };
  const semOf = d => d.dataset.w === 'sem' ? r.semana : r.temporadas[+d.dataset.t].semana;

  el.onchange = ev => {
    const x = ev.target, f = x.dataset.f, v = x.value;
    if (!f) return;
    const m = r.modos[+x.dataset.m], o = m && m.oficios[+x.dataset.o], t = r.temporadas[+x.dataset.t];
    if (f === 'mnombre') { m.nombre = v.trim() || m.nombre; return done(); }
    if (f === 'n') { if (v.trim()) o.n = v.trim(); return done(false); }
    if (f === 'h') {
      if (!/^\d\d:\d\d$/.test(v)) return draw();
      o.h = v; ordena(m); return done();
    }
    if (f === 'wk') { semOf(x)[+x.dataset.d].modo = v; return done(false); }
    if (f === 'tnombre') { t.nombre = v.trim() || t.nombre; return done(false); }
    if (f === 'tdesde' || f === 'thasta') {
      const md = dm2md(v);
      if (!md) { api.toast('Fecha no válida: escríbela como 30-06'); return draw(); }
      t[f === 'tdesde' ? 'desde' : 'hasta'] = md; return done();
    }
    if (f === 'tsem') { t.semanas = x.checked; return done(false); }
    if (f === 'alterno') { r.alterno = v.trim() || r.alterno; return done(); }
  };

  el.onclick = ev => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act, mi = +b.dataset.m, m = r.modos[mi], oi = +b.dataset.o;
    if (act === 'ocio') { const on = !m.oficios[oi].ocio; m.oficios.forEach((z, i) => { delete z.ocio; if (i === oi && on) z.ocio = true; }); return done(); }
    if (act === 'del-of') {
      if (m.oficios.length === 1) return api.toast('Un modo necesita al menos un oficio');
      const before = snap(), [gone] = m.oficios.splice(oi, 1); done();
      return api.toast(`Quitado: ${gone.n}`, undoTo(before));
    }
    if (act === 'add-of') {
      const last = m.oficios[m.oficios.length - 1];
      m.oficios.push({ n: 'Oficio', h: fromMin((toMin(last.h) + 60) % 1440) }); ordena(m); done();
      const inp = el.querySelectorAll(`.modo:nth-of-type(${mi + 1}) input[data-f="n"]`);
      const nw = [...inp].find(i => i.value === 'Oficio');
      if (nw) { nw.focus(); nw.select(); }
      return;
    }
    if (act === 'dup') {
      const c = JSON.parse(JSON.stringify(m)); c.id = 'm' + Date.now().toString(36); c.nombre = m.nombre + ' (copia)';
      r.modos.splice(mi + 1, 0, c); return done();
    }
    if (act === 'del-m') {
      if (r.modos.length === 1) return api.toast('Hace falta al menos un modo');
      const before = snap();
      r.modos.splice(mi, 1);
      const fb = r.modos[0].id, fix = d => { if (d.modo === m.id) d.modo = fb; };
      r.semana.forEach(fix); r.temporadas.forEach(t => t.semana.forEach(fix)); Object.values(r.dias).forEach(fix);
      done(); return api.toast(`Borrado: ${m.nombre}`, undoTo(before));
    }
    if (act === 'add-m') {
      r.modos.push({ id: 'm' + Date.now().toString(36), nombre: 'Nuevo modo', oficios: [{ n: 'Despertar', h: '07:00' }, { n: 'A dormir', h: '23:00' }] });
      return done();
    }
    if (act === 'wgym') { const d = semOf(b)[+b.dataset.d]; d.gym = !d.gym; return done(); }
    if (act === 'add-t') {
      r.temporadas.push({ nombre: 'Verano', desde: '07-01', hasta: '08-31', semanas: false, semana: JSON.parse(JSON.stringify(r.semana)) });
      return done();
    }
    if (act === 'del-t') {
      const before = snap(), [gone] = r.temporadas.splice(+b.dataset.t, 1); done();
      return api.toast(`Borrada: ${gone.nombre}`, undoTo(before));
    }
    if (act === 'copy') {
      const url = api.link();
      const fallback = () => { const i = el.querySelector('#imp'); i.value = url; i.select(); api.toast('Enlace seleccionado: cópialo'); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => api.toast('Enlace copiado'), fallback); else fallback();
      return;
    }
    if (act === 'imp') { const v = el.querySelector('#imp').value.trim(); if (v && !api.importa(v)) api.toast('Eso no es una regla válida'); return; }
    if (act === 'ejemplo') return api.ejemplo();
  };

  draw();
}
