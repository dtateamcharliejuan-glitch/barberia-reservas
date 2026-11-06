// Simula Google (hoja, candado, ntfy) para probar book_/cancel_ de Code.gs en Node.
const fs = require('fs'), vm = require('vm');
const pad = n => String(n).padStart(2, '0');
const NOW = new Date(2026, 10, 5, 10, 10);
let data = [], sent = [], uuid = 0;
const sheet = { appendRow: r => data.push(r.map(String)), getLastRow: () => data.length, getRange: (r, c, n, w) => ({ getDisplayValues: () => data.slice(1, 1 + n).map(x => x.slice(0, w)), setNumberFormat() {} }), setFrozenRows() {}, deleteRow: i => data.splice(i - 1, 1) };
const ctx = { Date,
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? `${NOW.getFullYear()}-${pad(NOW.getMonth()+1)}-${pad(NOW.getDate())}` : `${pad(NOW.getHours())}:${pad(NOW.getMinutes())}`, getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
  Session: { getScriptTimeZone: () => 'America/Bogota' },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (data.length ? sheet : null), insertSheet: () => sheet }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  UrlFetchApp: { fetch: (u, o) => sent.push(o.headers.Title) },
  ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 1 } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../apps-script/Code.gs'), 'utf8'), ctx);
const post = b => ctx.doPost({ postData: { contents: JSON.stringify(b) } });
const B = { action: 'book', date: '2026-11-06', time: '10:00', service: 'Corte', price: 0, name: 'Ana', phone: '3001234567' };
const t = (n, c) => { console.log(c ? '✔' : '✖', n); if (!c) process.exitCode = 1; };
const r1 = post(B); t('reserva ok con id', r1.ok && /^[0-9a-f-]{36}$/.test(r1.id));
t('precio lo pone el servidor (18000, no 0)', data[1][3] === '18000');
t('hora repetida → taken', post({ ...B, phone: '3110000000' }).error === 'taken');
t('domingo → bad', post({ ...B, date: '2026-11-08' }).error === 'bad');
t('servicio inventado → bad', post({ ...B, time: '11:00', service: 'Gratis' }).error === 'bad');
post({ ...B, time: '11:00' }); t('3ª cita mismo celular → limit', post({ ...B, time: '12:00' }).error === 'limit');
t('fórmula neutralizada', (post({ ...B, time: '13:00', phone: '3200000000', name: '=HYPERLINK("x")' }), data.at(-1)[4].startsWith("'=")));
t('get no expone nombres', JSON.stringify(ctx.doGet()).indexOf('Ana') < 0);
t('cancelar id falso → notfound', post({ action: 'cancel', id: 'x' }).error === 'notfound');
const n = data.length; t('cancelar id real libera la fila', post({ action: 'cancel', id: r1.id }).ok && data.length === n - 1 && !data.some(r => r[7] === r1.id));
t('avisos enviados: nueva y cancelada', sent.includes('Nueva cita') && sent.includes('Cita cancelada'));
