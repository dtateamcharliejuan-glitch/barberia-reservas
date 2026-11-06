// Horas para personas: "14:30" → "2:30 p. m." (por dentro todo sigue en 24 h).

export function splitTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return { clock: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, period: h < 12 ? 'a. m.' : 'p. m.' };
}

export const to12h = hhmm => { const t = splitTime(hhmm); return `${t.clock} ${t.period}`; };

// Un Date cuyos campos locales (año, mes, día, hora) son los de `tz`,
// para que el calendario use la hora de la barbería aunque el celular tenga otra zona.
export function nowIn(tz, at = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(at).map(x => [x.type, Number(x.value)]),
  );
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
