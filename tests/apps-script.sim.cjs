// Simula Google (hojas, candado, ntfy) para probar book_/cancel_/doGet de Code.gs en Node.
const fs = require('fs'), vm = require('vm');
const pad = n => String(n).padStart(2, '0');
const NOW = new Date(2026, 10, 5, 10, 10); // jueves 5 de noviembre, 10:10 a. m.
const sheets = {}, sent = [], triggers = [], mails = [];
let uuid = 0;
const range = sh => ({ setNumberFormat() { return this; }, setDataValidation() { return this; } });
const makeSheet = () => {
  const sh = { data: [] };
  Object.assign(sh, {
    appendRow: r => sh.data.push(r.map(v => (v instanceof Date ? v : String(v)))),
    getLastRow: () => sh.data.length,
    getRange: (r, c, n, w) => (typeof r === 'string' ? range(sh) : {
      getDisplayValues: () => sh.data.slice(1, 1 + n).map(x => x.slice(0, w).map(v => (v instanceof Date ? `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}` : v))),
      getValues: () => sh.data.slice(1, 1 + n).map(x => x.slice(0, w)),
      setValue: v => { sh.data[r - 1][c - 1] = String(v); },
    }),
    setFrozenRows() {}, deleteRow: i => sh.data.splice(i - 1, 1),
  });
  return sh;
};
const validation = { requireDate() { return this; }, requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } };
const ctx = { Date,
  Utilities: { formatDate: (d, tz, f) => { const x = Math.abs(d - Date.now()) < 60000 ? NOW : d; /* new Date() del script = el "ahora" simulado */ return f === 'yyyy-MM-dd' ? `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` : `${pad(NOW.getHours())}:${pad(NOW.getMinutes())}`; }, getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
  Session: { getScriptTimeZone: () => 'America/Bogota', getEffectiveUser: () => ({ getEmail: () => 'duenio@gmail.com' }) },
  MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] ?? null, insertSheet: n => (sheets[n] = makeSheet()) }), newDataValidation: () => validation },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  ScriptApp: { getProjectTriggers: () => triggers, newTrigger: fn => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => triggers.push({ fn, m, getHandlerFunction: () => fn }) }) }) }) },
  UrlFetchApp: { fetch: (u, o) => sent.push({ title: o.headers.Title, text: o.payload }) },
  ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 1 } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../apps-script/Code.gs'), 'utf8'), ctx);
const post = b => ctx.doPost({ postData: { contents: JSON.stringify(b) } });
const citas = () => sheets.Citas.data;
const B = { action: 'book', date: '2026-11-06', time: '10:00', service: 'Corte', price: 0, name: 'Ana', phone: '300 123 4567', note: 'Degradado bajo' };
const t = (n, c) => { console.log(c ? '✔' : '✖', n); if (!c) process.exitCode = 1; };

const r1 = post(B); t('reserva ok con id', r1.ok && /^[0-9a-f-]{36}$/.test(r1.id));
t('precio lo pone el servidor (18000, no 0)', citas()[1][3] === '18000');
t('celular guardado solo con números', citas()[1][5] === '3001234567');
t('la nota se guarda y llega en el aviso', citas()[1][6] === 'Degradado bajo' && sent.at(-1).text.includes('Nota: Degradado bajo'));
t('corte + barba vale 25000', (post({ ...B, time: '17:00', phone: '3009990000', service: 'Corte + barba' }), citas().at(-1)[3] === '25000'));
t('hora repetida → taken', post({ ...B, phone: '3110000000' }).error === 'taken');
t('celular de 7 números → bad', post({ ...B, time: '10:30', phone: '1234567' }).error === 'bad');
t('celular de 11 números → bad', post({ ...B, time: '10:30', phone: '30012345678' }).error === 'bad');
t('celular con +57 delante → ok', post({ ...B, time: '10:30', phone: '+57 315 000 0000' }).ok && citas().at(-1)[5] === '3150000000');
t('almuerzo 12:00 → bad', post({ ...B, time: '12:00', phone: '3120000000' }).error === 'bad');
t('almuerzo 12:30 → bad', post({ ...B, time: '12:30', phone: '3120000000' }).error === 'bad');
t('domingo → bad', post({ ...B, date: '2026-11-08' }).error === 'bad');
t('servicio inventado → bad', post({ ...B, time: '11:00', service: 'Gratis' }).error === 'bad');
post({ ...B, time: '11:00' }); t('3ª cita mismo celular → limit', post({ ...B, time: '13:30' }).error === 'limit');
t('fórmula neutralizada', (post({ ...B, time: '13:00', phone: '3200000000', name: '=HYPERLINK("x")' }), citas().at(-1)[4].startsWith("'=")));
t('get no expone nombres, celulares ni notas', !/Ana|3001234567|Degradado/.test(JSON.stringify(ctx.doGet())));
t('cancelar id falso → notfound', post({ action: 'cancel', id: 'x' }).error === 'notfound');
const n = citas().length; t('cancelar id real libera la fila', post({ action: 'cancel', id: r1.id }).ok && citas().length === n - 1 && !citas().some(r => r[8] === r1.id));
t('el aviso dice la fecha como en Colombia', sent.some(s => s.text.includes('viernes 6 de noviembre a las 10:00 a. m.')));
t('cada aviso llega también al Gmail del dueño', mails.length === sent.length && mails.every(m => m.to === 'duenio@gmail.com') && mails[0].subject === 'Nueva cita · Alex Studios');
t('avisos enviados: nueva y cancelada', sent.some(s => s.title === 'Nueva cita') && sent.some(s => s.title === 'Cita cancelada'));

// Bloqueos: el "panel" de Alex en la hoja.
ctx.preparar();
const bl = sheets.Bloqueos;
t('preparar crea la pestaña Bloqueos', bl && bl.data[0][0] === 'Fecha');
bl.appendRow([new Date(2026, 10, 7), '', '', 'Tatuaje']); // sábado entero
bl.appendRow([new Date(2026, 10, 9), '2:00 p. m.', '4:00 p. m.', 'Diligencia']); // lunes por la tarde
bl.appendRow([new Date(2026, 10, 2), '', '', 'Ya pasó']);
const g = ctx.doGet();
t('get devuelve los bloqueos futuros', JSON.stringify(g.blocked) === JSON.stringify([{ date: '2026-11-07', from: null, to: null }, { date: '2026-11-09', from: '14:00', to: '16:00' }]));
t('día bloqueado entero → bad', post({ ...B, date: '2026-11-07', phone: '3130000000' }).error === 'bad');
t('hora dentro del bloqueo → bad', post({ ...B, date: '2026-11-09', time: '15:30', phone: '3130000000' }).error === 'bad');
t('hora fuera del bloqueo → ok', post({ ...B, date: '2026-11-09', time: '16:00', phone: '3130000000' }).ok);

// Aviso a Alex 30 minutos antes (lo corre el reloj de Google cada 5 minutos).
t('preparar programa el aviso cada 5 minutos, una sola vez', (ctx.preparar(), triggers.length === 1 && triggers[0].fn === 'recordar' && triggers[0].m === 5));
post({ ...B, date: '2026-11-05', time: '10:30', phone: '3140000000', name: 'Pedro', note: '' }); // hoy, en 20 min
post({ ...B, date: '2026-11-05', time: '11:00', phone: '3150000001', name: 'Luis' }); // hoy, en 50 min
const before = sent.length;
ctx.recordar();
const reminders = sent.slice(before);
t('avisa la cita de dentro de 20 min', reminders.length === 1 && reminders[0].title === 'En 20 min: Pedro');
t('no avisa la de dentro de 50 min todavía', !reminders.some(s => s.title.includes('Luis')));
t('la fila queda marcada', citas().find(r => r[4] === 'Pedro')[9] === 'Enviado');
ctx.recordar();
t('no repite el aviso', sent.length === before + 1);
