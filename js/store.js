// Dos almacenes con la misma interfaz:
//   list()          -> [{ date, time }]  horas ocupadas
//   book(booking)   -> { ok: true } | { ok: false, error: 'taken' | 'network' }

import { toISODate } from './slots.js';

const KEY = 'barberia.bookings';

function localStore() {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
  };
  const write = list => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* modo privado */ }
  };

  // Unas cuantas citas de ejemplo para que la demo enseñe horas ocupadas.
  let mem = read();
  if (!mem) {
    const t = new Date();
    const d = n => toISODate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n));
    mem = [
      { date: d(0), time: '17:00' }, { date: d(0), time: '17:30' },
      { date: d(1), time: '10:00' }, { date: d(1), time: '12:30' }, { date: d(1), time: '16:00' },
      { date: d(2), time: '09:30' }, { date: d(2), time: '11:00' }, { date: d(2), time: '11:30' },
      { date: d(3), time: '18:00' }, { date: d(4), time: '10:30' }, { date: d(4), time: '13:00' },
    ];
    write(mem);
  }

  return {
    demo: true,
    async list() { return mem.map(({ date, time }) => ({ date, time })); },
    async book(b) {
      await new Promise(r => setTimeout(r, 450)); // simula la red
      if (mem.some(x => x.date === b.date && x.time === b.time)) return { ok: false, error: 'taken' };
      mem.push(b);
      write(mem);
      return { ok: true };
    },
  };
}

function sheetsStore(url) {
  return {
    demo: false,
    async list() {
      const r = await fetch(`${url}?action=list`);
      const data = await r.json();
      return data.booked ?? [];
    },
    async book(b) {
      try {
        // text/plain evita la petición previa CORS que Apps Script no responde.
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(b) });
        return await r.json();
      } catch {
        return { ok: false, error: 'network' };
      }
    },
  };
}

export const createStore = url => (url ? sheetsStore(url) : localStore());
