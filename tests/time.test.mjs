import { test } from 'node:test';
import assert from 'node:assert/strict';
import { to12h, splitTime, nowIn } from '../js/time.js';

test('to12h: formato colombiano con a. m. y p. m.', () => {
  assert.equal(to12h('09:00'), '9:00 a. m.');
  assert.equal(to12h('11:30'), '11:30 a. m.');
  assert.equal(to12h('12:00'), '12:00 p. m.');
  assert.equal(to12h('13:30'), '1:30 p. m.');
  assert.equal(to12h('18:30'), '6:30 p. m.');
  assert.equal(to12h('19:00'), '7:00 p. m.');
  assert.equal(to12h('00:15'), '12:15 a. m.');
});

test('splitTime separa la hora del a. m./p. m. para los botones', () => {
  assert.deepEqual(splitTime('16:00'), { clock: '4:00', period: 'p. m.' });
});

test('nowIn: la hora de Bogotá no depende de la zona del celular', () => {
  // 2026-11-06 03:30 UTC = 2026-11-05 22:30 en Bogotá (UTC-5)
  const d = nowIn('America/Bogota', new Date(Date.UTC(2026, 10, 6, 3, 30)));
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 10, 5, 22, 30]);
});
