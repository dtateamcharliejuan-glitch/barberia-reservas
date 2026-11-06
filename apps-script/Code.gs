// Google Apps Script: guarda las citas en la hoja y avisa al celular por ntfy.
// Se pega en Extensiones → Apps Script de la hoja de cálculo (ver README).

// Tema privado de ntfy: pon algo largo y difícil de adivinar, y suscríbete a él en la app ntfy.
// No subas el tema real a GitHub: cámbialo solo aquí, en el editor de Apps Script.
const NTFY_TOPIC = 'cambia-esto-barberia-xxxxxxxx';

// Deben coincidir con js/config.js. El servidor no se fía de lo que manda el navegador.
const SERVICES = { 'Corte': 18000, 'Corte + cejas': 20000, 'Corte + barba': 23000 };
const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // 0 = domingo
const OPEN = '09:00';
const CLOSE = '19:00';
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 14;
const MAX_PER_PHONE = 2; // citas futuras por número de celular

const SHEET_NAME = 'Citas';
const HEADERS = ['Fecha', 'Hora', 'Servicio', 'Precio', 'Nombre', 'Teléfono', 'Creada', 'Id'];
const COL = { date: 0, time: 1, service: 2, name: 4, phone: 5, id: 7 };

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@'); // fecha y hora como texto, sin conversiones
    sh.getRange('F:F').setNumberFormat('@');
  }
  return sh;
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getDisplayValues();
}

const minutes_ = hhmm => { const p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; };
const digits_ = s => String(s || '').replace(/\D/g, '');
const today_ = () => Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
const nowMin_ = () => minutes_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'));

// ¿Es una hora que la barbería ofrece de verdad?
function validSlot_(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const p = date.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  if (!OPEN_DAYS.includes(d.getDay())) return false;
  const t = minutes_(time);
  if (t < minutes_(OPEN) || t + SLOT_MINUTES > minutes_(CLOSE) || (t - minutes_(OPEN)) % SLOT_MINUTES) return false;
  const today = today_();
  if (date < today || (date === today && t <= nowMin_())) return false;
  const p0 = today.split('-').map(Number);
  const limit = new Date(p0[0], p0[1] - 1, p0[2] + DAYS_AHEAD - 1);
  return d <= limit;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ntfy_(title, text, tag) {
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + NTFY_TOPIC, {
      method: 'post',
      payload: text,
      headers: { Title: title, Tags: tag, Priority: 'high' },
      muteHttpExceptions: true,
    });
  } catch (err) { /* la hoja ya está actualizada aunque falle el aviso */ }
}

// Solo devuelve fecha y hora: nunca nombres, teléfonos ni ids.
function doGet() {
  return json_({ booked: rows_().filter(r => r[COL.date] && r[COL.time]).map(r => ({ date: r[COL.date], time: r[COL.time] })) });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad' }); }
  return b.action === 'cancel' ? cancel_(b.id) : book_(b);
}

function book_(b) {
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const price = SERVICES[b.service];
  const valid = price && validSlot_(b.date, b.time) && name.length >= 2 && name.length <= 60
    && digits_(phone).length >= 7 && digits_(phone).length <= 15;
  if (!valid) return json_({ ok: false, error: 'bad' });

  // El candado evita que dos personas reserven la misma hora a la vez.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let id;
  try {
    const rows = rows_();
    if (rows.some(r => r[COL.date] === b.date && r[COL.time] === b.time)) return json_({ ok: false, error: 'taken' });
    const today = today_();
    if (rows.filter(r => r[COL.date] >= today && digits_(r[COL.phone]) === digits_(phone)).length >= MAX_PER_PHONE) {
      return json_({ ok: false, error: 'limit' });
    }
    const clean = v => v.replace(/^[=+\-@]/, "'$&"); // evita fórmulas inyectadas en la hoja
    id = Utilities.getUuid();
    sheet_().appendRow([b.date, b.time, b.service, price, clean(name), clean(phone), new Date(), id]);
  } finally {
    lock.releaseLock();
  }

  ntfy_('Nueva cita', `${name} · ${b.service}\n${b.date} a las ${b.time}\nCel: ${phone}`, 'scissors');
  return json_({ ok: true, id: id });
}

// Solo quien tiene el id (el celular que reservó) puede cancelar.
function cancel_(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return json_({ ok: false, error: 'notfound' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let row;
  try {
    const rows = rows_();
    const i = rows.findIndex(r => r[COL.id] === id);
    if (i < 0) return json_({ ok: false, error: 'notfound' });
    row = rows[i];
    sheet_().deleteRow(i + 2); // +1 por la cabecera, +1 porque las filas empiezan en 1
  } finally {
    lock.releaseLock();
  }
  ntfy_('Cita cancelada', `${row[COL.name]} canceló ${row[COL.service]}\n${row[COL.date]} a las ${row[COL.time]}`, 'x');
  return json_({ ok: true });
}

// Ejecútala una vez desde el editor para dar permisos y probar el aviso.
function probarAviso() {
  ntfy_('Prueba', 'Los avisos de Alex Barber funcionan ✂️', 'scissors');
}
