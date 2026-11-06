import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookableDays, daySlots, toISODate } from '../js/slots.js';

const cfg = {
  openDays: [1, 2, 3, 4, 5, 6], // lunes a sábado
  open: '09:00',
  close: '19:00',
  slotMinutes: 30,
  daysAhead: 14,
};

test('toISODate usa la fecha local', () => {
  assert.equal(toISODate(new Date(2026, 10, 5, 23, 59)), '2026-11-05');
});

test('bookableDays salta los domingos y cubre 14 días naturales', () => {
  const days = bookableDays(new Date(2026, 10, 5, 10, 0), cfg); // jueves
  assert.equal(days[0], '2026-11-05');
  assert.ok(!days.includes('2026-11-08'), 'el domingo 8 no se abre');
  assert.equal(days.at(-1), '2026-11-18');
  assert.equal(days.length, 12);
});

test('daySlots crea huecos de 30 min de 9:00 a 18:30', () => {
  const slots = daySlots('2026-11-06', cfg, [], new Date(2026, 10, 5, 10, 0));
  assert.equal(slots.length, 20);
  assert.equal(slots[0].time, '09:00');
  assert.equal(slots.at(-1).time, '18:30');
  assert.ok(slots.every(s => s.available));
});

test('las horas reservadas no están disponibles', () => {
  const booked = [{ date: '2026-11-06', time: '10:30' }, { date: '2026-11-07', time: '11:00' }];
  const slots = daySlots('2026-11-06', cfg, booked, new Date(2026, 10, 5, 10, 0));
  const s = slots.find(x => x.time === '10:30');
  assert.equal(s.available, false);
  assert.equal(s.reason, 'booked');
  assert.equal(slots.find(x => x.time === '11:00').available, true, 'una reserva de otro día no bloquea');
});

test('las horas que ya pasaron hoy no están disponibles', () => {
  const slots = daySlots('2026-11-05', cfg, [], new Date(2026, 10, 5, 10, 10));
  assert.equal(slots.find(x => x.time === '10:00').reason, 'past');
  assert.equal(slots.find(x => x.time === '10:30').available, true);
});

test('el almuerzo (12:00 a 1:00) no sale como hora', () => {
  const slots = daySlots('2026-11-06', { ...cfg, breaks: [['12:00', '13:00']] }, [], new Date(2026, 10, 5, 10, 0));
  assert.ok(!slots.some(s => s.time === '12:00' || s.time === '12:30'));
  assert.ok(slots.some(s => s.time === '11:30') && slots.some(s => s.time === '13:00'));
  assert.equal(slots.length, 18);
});

test('un bloqueo de día entero cierra todas las horas', () => {
  const slots = daySlots('2026-11-06', cfg, [], new Date(2026, 10, 5, 10, 0), [{ date: '2026-11-06' }]);
  assert.ok(slots.every(s => !s.available && s.reason === 'blocked'));
});

test('un bloqueo por horas cierra solo ese rango', () => {
  const blocked = [{ date: '2026-11-06', from: '14:00', to: '16:00' }, { date: '2026-11-07' }];
  const slots = daySlots('2026-11-06', cfg, [], new Date(2026, 10, 5, 10, 0), blocked);
  assert.equal(slots.find(s => s.time === '13:30').available, true);
  assert.equal(slots.find(s => s.time === '14:00').reason, 'blocked');
  assert.equal(slots.find(s => s.time === '15:30').reason, 'blocked');
  assert.equal(slots.find(s => s.time === '16:00').available, true);
});
