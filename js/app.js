import { config } from './config.js';
import { bookableDays, daySlots, toISODate } from './slots.js';
import { createStore } from './store.js';

const $ = sel => document.querySelector(sel);
const store = createStore(config.sheetsUrl);

const state = { service: null, date: null, time: null, booked: [] };

const money = n => `${config.currency}${n}`;
const parseDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const longDay = iso => parseDate(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const short = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' };

function el(tag, attrs = {}, html = '') {
  const node = Object.assign(document.createElement(tag), attrs);
  if (html) node.innerHTML = html;
  return node;
}

// Texto fijo que sale de config.js
function fillStatic() {
  document.querySelectorAll('[data-name]').forEach(n => (n.textContent = config.name));
  document.querySelectorAll('[data-district]').forEach(n => (n.textContent = config.district));
  const days = config.openDays.slice().sort((a, b) => a - b);
  const range = `${short[days[0]]}–${short[days.at(-1)]}`;
  const hours = `${config.open}–${config.close}`;
  $('[data-hours]').textContent = range;
  $('[data-hours-time]').textContent = hours;
  $('[data-hours-full]').textContent = `${range} ${hours}`;
  $('[data-from]').textContent = `Desde ${money(Math.min(...config.services.map(s => s.price)))}`;
  document.title = `${config.name} · Reserva tu cita`;
  $('[data-demo-note]').hidden = !store.demo;

  const list = $('[data-service-list]');
  for (const s of config.services) {
    list.append(el('li', {}, `<h3>${s.name}</h3><span class="price">${money(s.price)}</span><p>${s.includes}</p>`));
  }
}

function renderServices() {
  const box = $('[data-services]');
  box.replaceChildren(...config.services.map(s => {
    const b = el('button', { type: 'button', className: 'choice' }, `<b>${s.name}</b><span>${money(s.price)}</span>`);
    b.setAttribute('aria-pressed', String(state.service === s.id));
    b.onclick = () => { state.service = s.id; render(); };
    return b;
  }));
}

function renderDays(now) {
  const box = $('[data-days]');
  const days = bookableDays(now, config);
  const cells = [];
  // Alinea el primer día con su columna (Lun … Sáb).
  const lead = (parseDate(days[0]).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(el('span'));
  for (const iso of days) {
    const free = daySlots(iso, config, state.booked, now).filter(s => s.available).length;
    const isToday = iso === toISODate(now);
    const b = el('button', { type: 'button', className: 'day', disabled: free === 0 },
      `<b>${parseDate(iso).getDate()}</b><small>${free === 0 ? 'lleno' : isToday ? 'hoy' : parseDate(iso).toLocaleDateString('es', { month: 'short' }).replace('.', '')}</small>`);
    b.setAttribute('aria-pressed', String(state.date === iso));
    b.setAttribute('aria-label', `${longDay(iso)}${free === 0 ? ', sin horas libres' : `, ${free} horas libres`}`);
    b.onclick = () => { state.date = iso; state.time = null; render(); };
    cells.push(b);
  }
  box.replaceChildren(...cells);
}

function renderTimes(now) {
  const box = $('[data-times]');
  if (!state.date) { box.replaceChildren(el('p', { className: 'empty' }, 'Primero elige un día.')); return; }
  const slots = daySlots(state.date, config, state.booked, now);
  box.replaceChildren(...slots.map(s => {
    const b = el('button', { type: 'button', className: 'slot', disabled: !s.available, textContent: s.time });
    b.setAttribute('aria-pressed', String(state.time === s.time));
    if (!s.available) b.setAttribute('aria-label', `${s.time}, no disponible`);
    b.onclick = () => { state.time = s.time; render(); };
    return b;
  }));
}

// Tarjeta del hero: las próximas horas libres, que llevan directo a la reserva.
function renderNext(now) {
  const dayEl = $('[data-next-day]');
  const box = $('[data-next-times]');
  for (const iso of bookableDays(now, config)) {
    const free = daySlots(iso, config, state.booked, now).filter(s => s.available).slice(0, 6);
    if (!free.length) continue;
    dayEl.textContent = iso === toISODate(now) ? `Hoy, ${longDay(iso)}` : cap(longDay(iso));
    box.replaceChildren(...free.map(s => {
      const b = el('button', { type: 'button', className: 'slot', textContent: s.time });
      b.onclick = () => {
        state.date = iso; state.time = s.time;
        render();
        $('#reservar').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      };
      return b;
    }));
    return;
  }
  dayEl.textContent = 'No quedan horas libres estas dos semanas.';
  box.replaceChildren();
}

function formReady() {
  const f = $('[data-form]');
  return f.elements.name.value.trim().length >= 2 && f.elements.phone.value.replace(/\D/g, '').length >= 7;
}

function renderSummary() {
  const s = config.services.find(x => x.id === state.service);
  $('[data-sum-service]').textContent = s ? s.name : '—';
  $('[data-sum-price]').textContent = s ? money(s.price) : '—';
  $('[data-sum-day]').textContent = state.date ? cap(longDay(state.date)) : '—';
  $('[data-sum-time]').textContent = state.time ?? '—';
  const picked = s && state.date && state.time;
  $('[data-submit]').disabled = !(picked && formReady());
  $('[data-hint]').textContent = !picked ? 'Elige servicio, día y hora.' : !formReady() ? 'Escribe tu nombre y teléfono.' : 'Todo listo.';
}

function render() {
  const now = new Date();
  // Si la hora elegida acaba de ocuparse, se suelta.
  if (state.date && state.time && !daySlots(state.date, config, state.booked, now).find(s => s.time === state.time)?.available) state.time = null;
  renderServices();
  renderDays(now);
  renderTimes(now);
  renderNext(now);
  renderSummary();
}

async function refresh() {
  try { state.booked = await store.list(); } catch { /* sin red: se mantiene lo último */ }
  render();
}

function showError(msg) {
  const e = $('[data-error]');
  e.textContent = msg;
  e.hidden = !msg;
}

async function submit(ev) {
  ev.preventDefault();
  const f = $('[data-form]');
  const btn = $('[data-submit]');
  if (btn.disabled) return;
  const service = config.services.find(x => x.id === state.service);
  const booking = {
    date: state.date, time: state.time,
    service: service.name, price: service.price,
    name: f.elements.name.value.trim(), phone: f.elements.phone.value.trim(),
  };
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = 'Reservando…';
  showError('');
  const res = await store.book(booking);
  btn.removeAttribute('aria-busy');
  btn.textContent = 'Confirmar cita';

  if (res.ok) {
    state.booked.push({ date: booking.date, time: booking.time });
    f.hidden = true;
    const done = $('[data-done]');
    $('[data-done-text]').textContent = `${booking.name}, te esperamos el ${longDay(booking.date)} a las ${booking.time} para ${service.name.toLowerCase()}.`;
    done.hidden = false;
    done.focus({ preventScroll: true });
    $('#reservar').scrollIntoView({ block: 'start' });
    return;
  }
  if (res.error === 'taken') {
    showError('Alguien acaba de reservar esa hora. Elige otra.');
    await refresh();
  } else {
    showError('No se pudo reservar. Revisa tu conexión e inténtalo de nuevo.');
    renderSummary();
  }
}

function again() {
  Object.assign(state, { service: null, date: null, time: null });
  const f = $('[data-form]');
  f.reset();
  f.hidden = false;
  $('[data-done]').hidden = true;
  render();
}

// La barra fija del móvil se esconde cuando ya estás en la reserva.
function watchBar() {
  const bar = $('[data-bar]');
  const io = new IntersectionObserver(([e]) => bar.classList.toggle('hide', e.isIntersecting), { threshold: 0.05 });
  io.observe($('#reservar'));
}

fillStatic();
$('[data-form]').addEventListener('submit', submit);
$('[data-form]').addEventListener('input', renderSummary);
$('[data-again]').addEventListener('click', again);
watchBar();
refresh();
setInterval(refresh, 60_000);
addEventListener('focus', refresh);
