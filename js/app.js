import { config, money } from './config.js?v=6f482298';
import { heroScene, ICONS } from './art.js?v=6f482298';
import { to12h, splitTime, nowIn } from './time.js?v=6f482298';
import { bookableDays, daySlots, toISODate } from './slots.js?v=6f482298';
import { createStore } from './store.js?v=6f482298';
import { addMine, listMine, removeMine } from './mine.js?v=6f482298';

const $ = sel => document.querySelector(sel);
// La hora de la barbería (Colombia), aunque el celular tenga otra zona horaria.
const now0 = () => nowIn(config.timeZone);
const store = createStore(config.sheetsUrl);
const storage = (() => { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return localStorage; } catch { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; } })();

// Orden del flujo. Cada paso es una pantalla.
const STEPS = ['inicio', 'servicio', 'dia', 'hora', 'datos', 'listo'];
const NUMBERED = ['servicio', 'dia', 'hora', 'datos']; // los que cuentan como "Paso n de 4"

const state = { step: 'inicio', service: null, date: null, time: null, booked: [], last: null, today: toISODate(now0()) };

const parseDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const longDay = iso => parseDate(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const friendlyDay = (iso, now = now0()) => {
  const diff = Math.round((parseDate(iso) - parseDate(toISODate(now))) / 864e5);
  return diff === 0 ? `Hoy, ${longDay(iso)}` : diff === 1 ? `Mañana, ${longDay(iso)}` : cap(longDay(iso));
};
const service = () => config.services.find(s => s.id === state.service);

function el(tag, attrs = {}, html = '') {
  const node = Object.assign(document.createElement(tag), attrs);
  if (html) node.innerHTML = html;
  return node;
}

const ICON = {
  service: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
  day: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  price: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
};

function summaryHTML(b) {
  const row = (icon, label, value, cls = '') => `<div class="row ${cls}">${ICON[icon]}<dt>${label}</dt><dd>${value}</dd></div>`;
  return `<dl>${row('service', 'Servicio', b.service)}${row('day', 'Día', friendlyDay(b.date))}${row('time', 'Hora', to12h(b.time))}${row('price', 'Precio', money(b.price), 'total')}</dl>`;
}

/* ---------- Avisos (toast) ---------- */

let toastTimer;
function toast(msg) {
  const t = $('[data-toast]');
  clearTimeout(toastTimer);
  t.classList.remove('out');
  t.hidden = false;
  t.textContent = msg;
  toastTimer = setTimeout(() => { t.classList.add('out'); setTimeout(() => (t.hidden = true), 220); }, 3200);
}

/* ---------- Navegación entre pantallas ---------- */

// Muestra una pantalla. `dir` decide de qué lado entra (adelante o atrás).
function show(step, dir = 'fwd') {
  state.step = step;
  for (const s of document.querySelectorAll('[data-screen]')) {
    const on = s.dataset.screen === step;
    s.hidden = !on;
    s.classList.remove('enter-fwd', 'enter-back');
    if (on) { void s.offsetWidth; s.classList.add(`enter-${dir}`); }
  }
  const n = NUMBERED.indexOf(step);
  $('[data-back]').hidden = n < 0;
  $('[data-count]').hidden = n < 0;
  $('[data-progress]').hidden = n < 0;
  if (n >= 0) {
    $('[data-count]').textContent = `Paso ${n + 1} de ${NUMBERED.length}`;
    $('[data-progress] span').style.width = `${((n + 1) / NUMBERED.length) * 100}%`;
  }
  document.body.dataset.step = step; // el CSS decide qué se ve en cada tamaño de pantalla
  render();
  scrollTo(0, 0);
  // Foco al primer título que de verdad se ve (en el celular el del inicio está en el panel de la barbería).
  const h = [...document.querySelectorAll(`[data-screen="${step}"] h1, [data-screen="${step}"] h2`)].find(e => e.getClientRects().length)
    ?? (step === 'inicio' ? $('#t-inicio') : null);
  h?.setAttribute('tabindex', '-1');
  h?.focus({ preventScroll: true });
}

// Avanzar deja una entrada en el historial: el botón atrás del celular vuelve un paso.
function go(step) {
  history.pushState({ step }, '', `#${step}`);
  show(step, 'fwd');
}

function back() {
  if (history.state?.step && history.state.step !== 'inicio') history.back();
  else show(STEPS[Math.max(0, STEPS.indexOf(state.step) - 1)], 'back');
}

// El paso más lejano al que se puede llegar con lo que ya está elegido.
function reachable(step) {
  if (['dia', 'hora', 'datos'].includes(step) && !state.service) return 'servicio';
  if (['hora', 'datos'].includes(step) && !state.date) return 'dia';
  if (step === 'datos' && !state.time) return 'hora';
  if (step === 'listo' && !state.last) return 'inicio';
  return step;
}

addEventListener('popstate', e => {
  const step = reachable(e.state?.step ?? 'inicio');
  closeSheet();
  show(step, STEPS.indexOf(step) < STEPS.indexOf(state.step) ? 'back' : 'fwd');
});

/* ---------- Pantallas ---------- */

function fillStatic() {
  document.querySelectorAll('[data-name]').forEach(n => (n.textContent = config.name));
  document.querySelectorAll('[data-district]').forEach(n => (n.textContent = config.district));
  document.title = `${config.name} · Reserva tu cita`;
  $('[data-demo-note]').hidden = !store.demo;

  $('[data-hero]').innerHTML = heroScene;

  const logo = $('[data-logo]');
  if (config.logo) logo.replaceChildren(el('img', { src: config.logo, alt: '' }));
  else logo.textContent = config.initials;

  $('[data-price-list]').replaceChildren(...config.services.map(s =>
    el('li', {}, `<span class="icon-tile" aria-hidden="true">${ICONS[s.icon]}</span><span><b>${s.name}</b><small>${s.includes}</small></span><span class="price">${money(s.price)}</span>`)));

  const how = [['service', 'Servicio', 'Corte, cejas o barba'], ['day', 'Día', 'De lunes a sábado'], ['time', 'Hora', 'Solo ves las libres'], ['user', 'Tus datos', 'Nombre y celular']];
  $('[data-how]').replaceChildren(...how.map(([icon, title, text]) =>
    el('li', {}, `<span class="icon-tile" aria-hidden="true">${ICON[icon]}</span><span><b>${title}</b><small>${text}</small></span>`)));

  fillWhere();
}

// Dirección, mapa de Google (sin clave) y "Cómo llegar".
function fillWhere() {
  const area = `${config.district}, ${config.city}`;
  const query = `${config.address ? `${config.address}, ` : ''}${area}, Colombia`;
  // El número ("# 5N-45") no se parte en dos líneas.
  const street = config.address.replace(/ ?# ?/g, ' # ').replace(/-/g, '‑');
  document.querySelectorAll('[data-address]').forEach(n => (n.textContent = config.address ? `${street}00a0· ${area}` : `Barrio ${area}`));
  document.querySelectorAll('.pin').forEach(n => (n.innerHTML = ICON.pin));
  document.querySelectorAll('[data-directions]').forEach(a => (a.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`));
  $('[data-map]').replaceChildren(el('iframe', {
    src: `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&hl=es&output=embed`,
    title: `Mapa: ${config.name} en ${area}`, loading: 'lazy', referrerPolicy: 'no-referrer-when-downgrade',
  }));

  // En el computador el panel de la izquierda no tiene sitio: el bloque pasa a la columna del inicio.
  const where = $('[data-where]');
  const spot = { panel: where.parentElement, desk: $('.home-intro') };
  const wide = matchMedia('(min-width: 1024px)');
  const place = () => { const to = wide.matches ? spot.desk : spot.panel; if (where.parentElement !== to) to.append(where); };
  place();
  wide.addEventListener('change', place);
}

// "Abierto ahora" o cuándo abre.
function renderStatus(now) {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const open = config.openDays.includes(now.getDay()) && hhmm >= config.open && hhmm < config.close;
  $('[data-status]').classList.toggle('open', open);
  if (open) { $('[data-status-text]').textContent = `Abierto · hasta las ${to12h(config.close)}`; return; }
  // Próxima apertura: hoy más tarde, mañana o el día de la semana.
  const startToday = config.openDays.includes(now.getDay()) && hhmm < config.open;
  let n = startToday ? 0 : 1;
  while (n < 8 && !config.openDays.includes((now.getDay() + n) % 7)) n++;
  const when = n === 0 ? 'hoy' : n === 1 ? 'mañana' : `el ${new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toLocaleDateString('es', { weekday: 'long' })}`;
  $('[data-status-text]').textContent = `Cerrado · abre ${when} a las ${to12h(config.open)}`;
}

function renderMine(now) {
  const mine = listMine(storage, now);
  const box = $('[data-mine]');
  box.hidden = !mine.length;
  box.replaceChildren(...mine.map(m => {
    const card = el('div', { className: 'mine-card' }, `<small>Tu próxima cita</small><b>${friendlyDay(m.date, now)} · ${to12h(m.time)}</b><span>${m.service}</span>`);
    const btn = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: 'Cancelar' });
    btn.setAttribute('aria-label', `Cancelar la cita del ${longDay(m.date)} a las ${to12h(m.time)}`);
    btn.onclick = () => askCancel(m);
    card.append(btn);
    return card;
  }));
}

function renderServices() {
  $('[data-services]').replaceChildren(...config.services.map(s => {
    const b = el('button', { type: 'button', className: 'option' },
      `<span class="icon-tile icon-lg" aria-hidden="true">${ICONS[s.icon]}</span><span><b>${s.name}</b><span class="meta">${s.includes} · ${config.slotMinutes} min</span></span><span class="price">${money(s.price)}</span>`);
    b.setAttribute('aria-pressed', String(state.service === s.id));
    b.onclick = () => { state.service = s.id; go('dia'); };
    return b;
  }));
}

function renderDays(now) {
  const days = bookableDays(now, config);
  const cells = [];
  const lead = (parseDate(days[0]).getDay() + 6) % 7; // alinea con Lun … Sáb
  for (let i = 0; i < lead; i++) cells.push(el('span'));
  for (const iso of days) {
    const free = daySlots(iso, config, state.booked, now).filter(s => s.available).length;
    const isToday = iso === toISODate(now);
    const label = free === 0 ? 'lleno' : isToday ? 'hoy' : parseDate(iso).toLocaleDateString('es', { month: 'short' }).replace('.', '');
    const b = el('button', { type: 'button', className: `day${isToday ? ' today' : ''}`, disabled: free === 0 }, `<b>${parseDate(iso).getDate()}</b><small>${label}</small>`);
    b.setAttribute('aria-pressed', String(state.date === iso));
    b.setAttribute('aria-label', `${longDay(iso)}${free === 0 ? ', sin horas libres' : `, ${free} horas libres`}`);
    b.onclick = () => { state.date = iso; state.time = null; go('hora'); };
    cells.push(b);
  }
  $('[data-days]').replaceChildren(...cells);
  const s = service();
  $('[data-pick-service]').textContent = s ? `${s.name} · ${money(s.price)}` : '';
}

function renderTimes(now) {
  const box = $('[data-times]');
  if (!state.date) { box.replaceChildren(); return; }
  $('[data-pick-day]').textContent = friendlyDay(state.date, now);
  const slots = daySlots(state.date, config, state.booked, now);
  if (!slots.some(s => s.available)) {
    box.replaceChildren(el('p', { className: 'empty' }, 'Este día ya no tiene horas libres. Toca «Atrás» y elige otro día.'));
    return;
  }
  // Mañana y tarde por separado: más fácil de leer.
  const groups = [['Mañana', slots.filter(s => s.time < '12:00')], ['Tarde', slots.filter(s => s.time >= '12:00')]];
  const parts = [];
  for (const [label, list] of groups) {
    if (!list.length) continue;
    const free = list.filter(s => s.available).length;
    parts.push(el('h3', { className: 'period' }, `<span>${label}</span><span>${free ? `${free} libres` : 'llena'}</span>`));
    const grid = el('div', { className: 'times' });
    grid.append(...list.map(s => {
      const t = splitTime(s.time);
      const b = el('button', { type: 'button', className: 'slot', disabled: !s.available }, `<b>${t.clock}</b><small>${t.period}</small>`);
      b.dataset.time = s.time;
      b.setAttribute('aria-pressed', String(state.time === s.time));
      b.setAttribute('aria-label', `${to12h(s.time)}${s.available ? '' : s.reason === 'past' ? ', ya pasó' : ', ocupada'}`);
      b.onclick = () => { state.time = s.time; go('datos'); };
      return b;
    }));
    parts.push(grid);
  }
  box.replaceChildren(...parts);
}

function formReady() {
  const f = $('[data-form]').elements;
  return f.name.value.trim().length >= 2 && f.phone.value.replace(/\D/g, '').length >= 7;
}

function renderForm() {
  const s = service();
  if (s && state.date && state.time) {
    $('[data-summary-datos]').innerHTML = summaryHTML({ service: s.name, date: state.date, time: state.time, price: s.price });
  }
  const f = $('[data-form]').elements;
  const ready = formReady();
  $('[data-submit]').disabled = !ready;
  $('[data-hint]').textContent = ready ? 'Todo listo. Toca «Confirmar cita».'
    : f.name.value.trim().length < 2 ? 'Escribe tu nombre para confirmar.'
    : 'Escribe tu celular (mínimo 7 números).';
}

function render() {
  const now = now0();
  renderStatus(now);
  renderMine(now);
  renderServices();
  renderDays(now);
  renderTimes(now);
  renderForm();
}

/* ---------- Mantener el calendario al día ---------- */

// Si cambió el día o la hora elegida ya no vale (pasó o alguien la tomó), se vuelve al paso correcto.
function keepFresh() {
  const now = now0();
  const today = toISODate(now);
  const newDay = today !== state.today;
  state.today = today;

  if (state.date && !bookableDays(now, config).includes(state.date)) {
    state.date = null; state.time = null;
    if (['hora', 'datos'].includes(state.step)) {
      history.replaceState({ step: 'dia' }, '', '#dia');
      show('dia', 'back');
      toast('El día que elegiste ya pasó. Elige otro.');
      return;
    }
  }
  if (state.date && state.time && !daySlots(state.date, config, state.booked, now).find(s => s.time === state.time)?.available) {
    state.time = null;
    if (state.step === 'datos') {
      history.replaceState({ step: 'hora' }, '', '#hora');
      show('hora', 'back');
      toast('Esa hora ya no está disponible. Elige otra.');
      return;
    }
  }
  render();
  if (newDay) scheduleMidnight();
}

async function refresh() {
  try { state.booked = await store.list(); } catch { /* sin red: se mantiene lo último */ }
  keepFresh();
}

// Un repaso justo después de medianoche, además del de cada minuto.
let midnightTimer;
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  const now = now0();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  midnightTimer = setTimeout(refresh, next - now);
}

/* ---------- Reservar ---------- */

function showError(msg) {
  const e = $('[data-error]');
  e.textContent = msg;
  e.hidden = !msg;
}

async function submit(ev) {
  ev.preventDefault();
  const btn = $('[data-submit]');
  if (btn.disabled || !formReady()) return;
  const f = $('[data-form]').elements;
  const s = service();
  const booking = { date: state.date, time: state.time, service: s.name, price: s.price, name: f.name.value.trim(), phone: f.phone.value.trim() };

  btn.disabled = true;
  btn.textContent = 'Reservando…';
  showError('');
  const res = await store.book(booking);
  btn.textContent = 'Confirmar cita';

  if (res.ok) {
    state.booked.push({ date: booking.date, time: booking.time });
    state.last = { id: res.id, date: booking.date, time: booking.time, service: booking.service, price: booking.price };
    addMine(storage, state.last);
    $('[data-done-title]').textContent = `¡Listo, ${booking.name.split(' ')[0]}!`;
    $('[data-summary-listo]').innerHTML = summaryHTML(booking);
    // "Listo" reemplaza al paso de datos: atrás no vuelve a un formulario ya enviado.
    history.replaceState({ step: 'listo' }, '', '#listo');
    show('listo', 'fwd');
    return;
  }
  if (res.error === 'taken') {
    state.time = null;
    try { state.booked = await store.list(); } catch { /* se queda lo último */ }
    history.replaceState({ step: 'hora' }, '', '#hora');
    show('hora', 'back');
    toast('Alguien acaba de reservar esa hora. Elige otra.');
  } else if (res.error === 'limit') {
    showError('Ya tienes 2 citas pendientes con este celular. Si necesitas otra, escríbele a Alex.');
    renderForm();
  } else {
    showError('No se pudo reservar. Revisa tu conexión e inténtalo de nuevo.');
    renderForm();
  }
}

/* ---------- Cancelar ---------- */

let pending = null;
function askCancel(m) {
  pending = m;
  // "a. m." ya lleva punto: no se añade otro al cerrar la frase.
  const when = `${m.service}, ${friendlyDay(m.date).toLowerCase()} a las ${to12h(m.time)}`;
  $('[data-sheet-text]').textContent = `${when.endsWith('.') ? when : `${when}.`} La hora quedará libre para otra persona.`;
  $('[data-sheet]').hidden = false;
  $('[data-sheet-no]').focus();
}

function closeSheet() {
  $('[data-sheet]').hidden = true;
  pending = null;
}

async function confirmCancel() {
  if (!pending) return;
  const m = pending;
  const yes = $('[data-sheet-yes]');
  yes.disabled = true;
  yes.textContent = 'Cancelando…';
  const res = await store.cancel(m.id);
  yes.disabled = false;
  yes.textContent = 'Sí, cancelar';
  if (!res.ok && res.error !== 'notfound') { toast('No se pudo cancelar. Revisa tu conexión.'); return; }

  // notfound: Alex ya la había borrado; igual se quita de "mis citas".
  removeMine(storage, m.id);
  state.booked = state.booked.filter(b => !(b.date === m.date && b.time === m.time));
  closeSheet();
  if (state.last?.id === m.id) state.last = null;
  if (state.step !== 'inicio') { history.replaceState({ step: 'inicio' }, '', location.pathname); show('inicio', 'back'); }
  else render();
  toast('Cita cancelada. La hora quedó libre.');
  refresh();
}

function restart() {
  Object.assign(state, { service: null, date: null, time: null });
  $('[data-form]').reset();
  showError('');
  history.replaceState({ step: 'inicio' }, '', location.pathname);
  show('inicio', 'back');
}

/* ---------- Arranque ---------- */

fillStatic();
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('[data-back]').addEventListener('click', back);
$('[data-form]').addEventListener('submit', submit);
$('[data-form]').addEventListener('input', renderForm);
$('[data-restart]').addEventListener('click', restart);
$('[data-cancel-last]').addEventListener('click', () => state.last && askCancel(state.last));
$('[data-sheet-yes]').addEventListener('click', confirmCancel);
$('[data-sheet-no]').addEventListener('click', closeSheet);
$('[data-sheet]').addEventListener('click', e => { if (e.target === e.currentTarget) closeSheet(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('[data-sheet]').hidden) closeSheet(); });

history.replaceState({ step: 'inicio' }, '', location.pathname);
show('inicio');
refresh();
scheduleMidnight();
setInterval(refresh, 60_000);
// En el celular la pestaña se duerme: al volver se actualiza todo.
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('paused', document.hidden); // la animación de portada no gasta batería en segundo plano
  if (!document.hidden) refresh();
});
addEventListener('focus', refresh);
addEventListener('pageshow', e => { if (e.persisted) refresh(); });
