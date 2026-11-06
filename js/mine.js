// "Mis citas": las reservas hechas desde este celular, con el id que permite cancelarlas.
import { toISODate } from './slots.js?v=137c21ab';

const KEY = 'barberia.mine';

const read = st => { try { return JSON.parse(st.getItem(KEY)) ?? []; } catch { return []; } };
const write = (st, list) => { try { st.setItem(KEY, JSON.stringify(list)); } catch { /* modo privado */ } };

export function addMine(st, booking) {
  write(st, [...read(st).filter(x => x.id !== booking.id), booking]);
}

export function removeMine(st, id) {
  write(st, read(st).filter(x => x.id !== id));
}

// Solo las de hoy en adelante, de la más próxima a la más lejana.
export function listMine(st, now) {
  const today = toISODate(now);
  return read(st)
    .filter(x => x.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
