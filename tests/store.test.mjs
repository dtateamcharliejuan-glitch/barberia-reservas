import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { addMine, listMine, removeMine } from '../js/mine.js';
import { bookableDays, daySlots } from '../js/slots.js';

// localStorage de mentira para Node.
const memStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};
const b = { date: '2026-11-06', time: '10:00', service: 'Corte', price: 18000, name: 'Ana', phone: '3001234567' };

test('reservar devuelve un id y ocupa la hora', async () => {
  const s = createStore('', { storage: memStorage(), seed: false, delay: 0 });
  const r = await s.book(b);
  assert.equal(r.ok, true);
  assert.ok(r.id && r.id.length >= 16, 'id largo y difícil de adivinar');
  assert.deepEqual(await s.list(), { booked: [{ date: '2026-11-06', time: '10:00' }], blocked: [] });
});

test('no se puede reservar dos veces la misma hora', async () => {
  const s = createStore('', { storage: memStorage(), seed: false, delay: 0 });
  await s.book(b);
  assert.deepEqual(await s.book({ ...b, name: 'Otro' }), { ok: false, error: 'taken' });
});

test('cancelar con el id libera la hora', async () => {
  const s = createStore('', { storage: memStorage(), seed: false, delay: 0 });
  const { id } = await s.book(b);
  assert.deepEqual(await s.cancel(id), { ok: true });
  assert.deepEqual((await s.list()).booked, []);
});

test('cancelar con un id que no existe no borra nada', async () => {
  const s = createStore('', { storage: memStorage(), seed: false, delay: 0 });
  await s.book(b);
  assert.deepEqual(await s.cancel('inventado'), { ok: false, error: 'notfound' });
  assert.equal((await s.list()).booked.length, 1);
});

test('mis citas: guarda, oculta las pasadas y se puede quitar', () => {
  const st = memStorage();
  addMine(st, { id: 'a', date: '2026-11-04', time: '10:00', service: 'Corte' });
  addMine(st, { id: 'b', date: '2026-11-06', time: '09:00', service: 'Corte' });
  addMine(st, { id: 'c', date: '2026-11-05', time: '12:00', service: 'Corte' });
  const now = new Date(2026, 10, 5, 11, 0);
  assert.deepEqual(listMine(st, now).map(x => x.id), ['c', 'b'], 'ordenadas y sin la de ayer');
  removeMine(st, 'c');
  assert.deepEqual(listMine(st, now).map(x => x.id), ['b']);
});

test('al pasar la medianoche el calendario empieza en el día nuevo', () => {
  const cfg = { openDays: [1, 2, 3, 4, 5, 6], open: '09:00', close: '19:00', slotMinutes: 30, daysAhead: 14 };
  assert.equal(bookableDays(new Date(2026, 10, 5, 23, 59), cfg)[0], '2026-11-05');
  assert.equal(bookableDays(new Date(2026, 10, 6, 0, 1), cfg)[0], '2026-11-06');
  // Ya de noche, hoy no tiene horas libres.
  assert.ok(daySlots('2026-11-05', cfg, [], new Date(2026, 10, 5, 18, 31)).every(s => !s.available));
});

test('modo real: una hora "9:00" de la hoja se toma como "09:00"', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ json: async () => ({ booked: [{ date: '2026-11-07', time: '9:00' }], blocked: [{ date: '2026-11-09', from: '9:00', to: '11:00' }] }) });
  try {
    const s = createStore('https://example.test/exec');
    assert.deepEqual(await s.list(), { booked: [{ date: '2026-11-07', time: '09:00' }], blocked: [{ date: '2026-11-09', from: '09:00', to: '11:00' }] });
  } finally {
    globalThis.fetch = realFetch;
  }
});
