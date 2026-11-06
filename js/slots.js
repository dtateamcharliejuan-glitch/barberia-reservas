// Lógica pura de horarios: sin DOM ni red, para poder probarla con `npm test`.

const pad = n => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toMinutes = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const fromMinutes = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// Días en los que se puede reservar, desde hoy y durante `daysAhead` días naturales.
export function bookableDays(now, cfg) {
  const days = [];
  for (let i = 0; i < cfg.daysAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (cfg.openDays.includes(d.getDay())) days.push(toISODate(d));
  }
  return days;
}

// ¿Cae la hora dentro de un rango [desde, hasta)? Sin rango = todo el día.
const inRange = (m, from, to) => (!from || m >= toMinutes(from)) && (!to || m < toMinutes(to));

// Huecos de un día. `booked` es una lista de { date, time }; `blocked`, los bloqueos de Alex
// ({ date, from, to }: sin from/to es el día entero). Las pausas fijas (almuerzo) ni se muestran.
export function daySlots(date, cfg, booked, now, blocked = []) {
  const taken = new Set(booked.filter(b => b.date === date).map(b => b.time));
  const blocks = blocked.filter(b => b.date === date);
  const isToday = date === toISODate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots = [];
  for (let m = toMinutes(cfg.open); m + cfg.slotMinutes <= toMinutes(cfg.close); m += cfg.slotMinutes) {
    if ((cfg.breaks ?? []).some(([from, to]) => inRange(m, from, to))) continue;
    const time = fromMinutes(m);
    let reason = null;
    if (blocks.some(b => inRange(m, b.from, b.to))) reason = 'blocked';
    else if (taken.has(time)) reason = 'booked';
    else if (isToday && m <= nowMin) reason = 'past';
    slots.push({ time, available: reason === null, reason });
  }
  return slots;
}
