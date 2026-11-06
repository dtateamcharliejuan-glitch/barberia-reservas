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

// Huecos de un día. `booked` es una lista de { date, time }.
export function daySlots(date, cfg, booked, now) {
  const taken = new Set(booked.filter(b => b.date === date).map(b => b.time));
  const isToday = date === toISODate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots = [];
  for (let m = toMinutes(cfg.open); m + cfg.slotMinutes <= toMinutes(cfg.close); m += cfg.slotMinutes) {
    const time = fromMinutes(m);
    let reason = null;
    if (taken.has(time)) reason = 'booked';
    else if (isToday && m <= nowMin) reason = 'past';
    slots.push({ time, available: reason === null, reason });
  }
  return slots;
}
