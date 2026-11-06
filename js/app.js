import { config, money } from './config.js';
import { bookableDays, daySlots, toISODate } from './slots.js';
import { createStore } from './store.js';

const $ = sel => document.querySelector(sel);
const store = createStore(config.sheetsUrl);

// Orden del flujo. Cada paso es una pantalla.
const STEPS = ['inicio', 'servicio', 'dia', 'hora', 'datos', 'listo'];
const NUMBERED = ['servicio', 'dia', 'hora', 'datos']; // los que cuentan como "Paso n de 4"

const state = { step: 'inicio', service: null, date: null, time: null, booked: [] };

const parseDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const longDay = iso => parseDate(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const short = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
const service = () => config.services.find(s => s.id === state.service);

function el(tag, attrs = {}, html = '') {
  const node = Object.assign(document.createElement(tag), attrs);
  if (html) node.innerHTML = html;
  return node;
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
  $('[data-back]').hidden = step === 'inicio' || step === 'listo';
  $('[data-count]').hidden = n < 0;
  $('[data-progress]').hidden = n < 0;
  if (n >= 0) {
    $('[data-count]').textContent = `Paso ${n + 1} de ${NUMBERED.length}`;
    $('[data-progress] span').style.width = `${((n + 1) / NUMBERED.length) * 100}%`;
  }
  render();
  scrollTo(0, 0);
  const h = $(`[data-screen="${step}"] h1, [data-screen="${step}"] h2`);
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

addEventListener('popstate', e => {
  let step = e.state?.step ?? 'inicio';
  // No se puede saltar a un paso sin haber completado los anteriores.
  if (['dia', 'hora', 'datos'].includes(step) && !state.service) step = 'servicio';
  if (['hora', 'datos'].includes(step) && !state.date) step = 'dia';
  if (step === 'datos' && !state.time) step = 'hora';
  if (step === 'listo') step = 'inicio';
  show(step, STEPS.indexOf(step) < STEPS.indexOf(state.step) ? 'back' : 'fwd');
});

/* ---------- Pantallas ---------- */

function fillStatic() {
  document.querySelectorAll('[data-name]').forEach(n => (n.textContent = config.name));
  document.querySelectorAll('[data-district]').forEach(n => (n.textContent = config.district));
  const days = config.openDays.slice().sort((a, b) => a - b);
  $('[data-hours]').textContent = `${short[days[0]]}–${short[days.at(-1)]} · ${config.open}–${config.close}`;
  document.title = `${config.name} · Reserva tu cita`;
  $('[data-demo-note]').hidden = !store.demo;
  $('[data-price-list]').replaceChildren(...config.services.map(s =>
    el('li', {}, `<span><b>${s.name}</b><small>${s.includes}</small></span><span class="price">${money(s.price)}</span>`)));
}

function renderServices() {
  $('[data-services]').replaceChildren(...config.services.map(s => {
    const b = el('button', { type: 'button', className: 'option' },
      `<b>${s.name}</b><span class="meta">${s.includes} · ${config.slotMinutes} min</span><span class="price">${money(s.price)}</span>`);
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
    const label = free === 0 ? 'lleno' : iso === toISODate(now) ? 'hoy' : parseDate(iso).toLocaleDateString('es', { month: 'short' }).replace('.', '');
    const b = el('button', { type: 'button', className: 'day', disabled: free === 0 }, `<b>${parseDate(iso).getDate()}</b><small>${label}</small>`);
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
  $('[data-pick-day]').textContent = cap(longDay(state.date));
  const slots = daySlots(state.date, config, state.booked, now);
  if (!slots.some(s => s.available)) {
    box.replaceChildren(el('p', { className: 'empty' }, 'Este día ya no tiene horas libres. Vuelve atrás y elige otro.'));
    return;
  }
  box.replaceChildren(...slots.map(s => {
    const b = el('button', { type: 'button', className: 'slot', disabled: !s.available, textContent: s.time });
    b.setAttribute('aria-pressed', String(state.time === s.time));
    if (!s.available) b.setAttribute('aria-label', `${s.time}, ocupada`);
    b.onclick = () => { state.time = s.time; go('datos'); };
    return b;
  }));
}

function formReady() {
  const f = $('[data-form]').elements;
  return f.name.value.trim().length >= 2 && f.phone.value.replace(/\D/g, '').length >= 7;
}

function renderSummary() {
  const s = service();
  $('[data-sum-service]').textContent = s?.name ?? '';
  $('[data-sum-price]').textContent = s ? money(s.price) : '';
  $('[data-sum-day]').textContent = state.date ? cap(longDay(state.date)) : '';
  $('[data-sum-time]').textContent = state.time ?? '';
  $('[data-submit]').disabled = !formReady();
}

function render() {
  const now = new Date();
  renderServices();
  renderDays(now);
  renderTimes(now);
  renderSummary();
}

/* ---------- Datos y envío ---------- */

async function refresh() {
  try { state.booked = await store.list(); } catch { /* sin red: se mantiene lo último */ }
  // Si la hora elegida se acaba de ocupar, se vuelve a elegir hora.
  if (state.step === 'datos' && !daySlots(state.date, config, state.booked, new Date()).find(s => s.time === state.time)?.available) {
    state.time = null;
    show('hora', 'back');
    return;
  }
  render();
}

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
    $('[data-done-text]').textContent = `${booking.name}, te esperamos el ${longDay(booking.date)} a las ${booking.time} para ${s.name.toLowerCase()}.`;
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
    $('[data-pick-day]').textContent = `Alguien acaba de reservar esa hora. Elige otra · ${cap(longDay(state.date))}`;
  } else if (res.error === 'limit') {
    showError('Ya tienes 2 citas pendientes con este celular. Si necesitas otra, escríbele a Alex.');
    renderSummary();
  } else {
    showError('No se pudo reservar. Revisa tu conexión e inténtalo de nuevo.');
    renderSummary();
  }
}

function restart() {
  Object.assign(state, { service: null, date: null, time: null });
  $('[data-form]').reset();
  history.replaceState({ step: 'inicio' }, '', location.pathname);
  show('inicio', 'back');
}

/* ---------- Arranque ---------- */

fillStatic();
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('[data-back]').addEventListener('click', back);
$('[data-form]').addEventListener('submit', submit);
$('[data-form]').addEventListener('input', renderSummary);
$('[data-restart]').addEventListener('click', restart);

history.replaceState({ step: 'inicio' }, '', location.pathname);
show('inicio');
refresh();
setInterval(refresh, 60_000);
addEventListener('focus', refresh);
