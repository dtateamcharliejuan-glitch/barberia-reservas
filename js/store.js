// Dos almacenes con la misma interfaz:
//   list()          -> { booked: [{ date, time }], blocked: [{ date, from, to }] }  horas ocupadas y bloqueos de Alex
//   book(booking)   -> { ok: true, id } | { ok: false, error: 'taken' | 'limit' | 'bad' | 'network' }
//   cancel(id)      -> { ok: true } | { ok: false, error: 'notfound' | 'network' }

import { toISODate } from './slots.js?v=d4756753';

const KEY = 'barberia.bookings';

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);

// Unas cuantas citas de ejemplo para que la demo enseñe horas ocupadas.
function demoSeed() {
  const t = new Date();
  const d = n => toISODate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n));
  return [
    [0, '17:00'], [0, '17:30'], [1, '10:00'], [1, '12:30'], [1, '16:00'],
    [2, '09:30'], [2, '11:00'], [2, '11:30'], [3, '18:00'], [4, '10:30'], [4, '13:00'],
  ].map(([n, time]) => ({ id: newId(), date: d(n), time }));
}

// En la demo, un día de tatuaje: así se ve cómo queda un día que Alex bloquea.
function demoBlocked() {
  const t = new Date();
  let n = 5;
  while (new Date(t.getFullYear(), t.getMonth(), t.getDate() + n).getDay() === 0) n++;
  return [{ date: toISODate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n)) }];
}

function localStore({ storage = globalThis.localStorage, seed = true, delay = 450 } = {}) {
  const read = () => { try { return JSON.parse(storage.getItem(KEY)) ?? null; } catch { return null; } };
  const write = list => { try { storage.setItem(KEY, JSON.stringify(list)); } catch { /* modo privado */ } };
  const wait = () => new Promise(r => setTimeout(r, delay)); // simula la red

  let mem = read();
  if (!mem) { mem = seed ? demoSeed() : []; write(mem); }

  return {
    demo: true,
    async list() { return { booked: mem.map(({ date, time }) => ({ date, time })), blocked: seed ? demoBlocked() : [] }; },
    async book(b) {
      await wait();
      if (mem.some(x => x.date === b.date && x.time === b.time)) return { ok: false, error: 'taken' };
      const id = newId();
      mem.push({ ...b, id });
      write(mem);
      return { ok: true, id };
    },
    async cancel(id) {
      await wait();
      const before = mem.length;
      mem = mem.filter(x => x.id !== id);
      if (mem.length === before) return { ok: false, error: 'notfound' };
      write(mem);
      return { ok: true };
    },
  };
}

function sheetsStore(url) {
  // text/plain evita la petición previa CORS que Apps Script no responde.
  const post = async body => {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
      return await r.json();
    } catch {
      return { ok: false, error: 'network' };
    }
  };
  return {
    demo: false,
    async list() {
      const r = await fetch(`${url}?action=list&t=${Date.now()}`);
      const j = await r.json();
      return { booked: j.booked ?? [], blocked: j.blocked ?? [] };
    },
    book: b => post({ action: 'book', ...b }),
    cancel: id => post({ action: 'cancel', id }),
  };
}

export const createStore = (url, opts) => (url ? sheetsStore(url) : localStore(opts));
