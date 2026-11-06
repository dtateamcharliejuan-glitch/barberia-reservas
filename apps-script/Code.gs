// Google Apps Script: guarda las citas en la hoja y avisa al celular por ntfy.
// Se pega en Extensiones → Apps Script de la hoja de cálculo (ver README).

// Tema privado de ntfy: pon algo largo y difícil de adivinar, y suscríbete a él en la app ntfy.
// No subas el tema real a GitHub: cámbialo solo aquí, en el editor de Apps Script.
const NTFY_TOPIC = 'cambia-esto-barberia-xxxxxxxx';

// Los avisos también llegan por correo de Gmail (gratis, hasta 100 al día).
// Vacío = al correo de la cuenta de Google dueña de la hoja. '-' = sin correo.
const NOTIFY_EMAIL = '';

// Deben coincidir con js/config.js. El servidor no se fía de lo que manda el navegador.
const SERVICES = { 'Corte': 18000, 'Corte + cejas': 20000, 'Corte + barba': 25000 };
const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // 0 = domingo
const OPEN = '09:00';
const CLOSE = '19:00';
const SLOT_MINUTES = 30;
const BREAKS = [['12:00', '13:00']]; // almuerzo: esas horas no se reservan
const DAYS_AHEAD = 14;
const MAX_PER_PHONE = 2; // citas futuras por número de celular

const SHEET_NAME = 'Citas';
const HEADERS = ['Fecha', 'Hora', 'Servicio', 'Precio', 'Nombre', 'Teléfono', 'Nota', 'Creada', 'Id', 'Aviso 30 min'];
const COL = { date: 0, time: 1, service: 2, name: 4, phone: 5, note: 6, id: 8, reminded: 9 };
const REMIND_BEFORE = 30; // minutos antes de la cita en que le llega el aviso a Alex

// El "panel" de Alex: en la pestaña Bloqueos escribe un día (y si quiere, desde/hasta qué hora)
// en que no atiende, por ejemplo un día de tatuajes. Sin horas = el día entero.
const BLOCK_SHEET = 'Bloqueos';
const BLOCK_HEADERS = ['Fecha', 'Desde', 'Hasta', 'Motivo (solo lo ves tú)'];

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

// Horas de 9:00 a. m. a 7:00 p. m. para las listas desplegables de Bloqueos.
function hourOptions_() {
  const out = [];
  for (let m = minutes_(OPEN); m <= minutes_(CLOSE); m += SLOT_MINUTES) out.push(to12h_(hhmm_(m)));
  return out;
}

function blockSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(BLOCK_SHEET);
  if (!sh) {
    sh = ss.insertSheet(BLOCK_SHEET);
    sh.appendRow(BLOCK_HEADERS);
    sh.setFrozenRows(1);
    // Fecha con calendario y horas con lista: así no hay que escribir formatos raros.
    sh.getRange('A2:A').setNumberFormat('dd/mm/yyyy').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
    sh.getRange('B2:C').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(hourOptions_(), true).setAllowInvalid(false).build());
  }
  return sh;
}

// "2:00 p. m." o "14:00" → "14:00". Vacío → null.
function parseHour_(v) {
  const m = String(v || '').trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(a|p)?/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === 'p' && h < 12) h += 12;
  if (m[3] === 'a' && h === 12) h = 0;
  return hhmm_(h * 60 + Number(m[2]));
}

// Bloqueos de hoy en adelante: [{ date, from, to }].
function blocked_() {
  const sh = blockSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = Session.getScriptTimeZone();
  const range = sh.getRange(2, 1, last - 1, 3);
  const values = range.getValues();
  const shown = range.getDisplayValues();
  const today = today_();
  const out = [];
  values.forEach((r, i) => {
    let date = null;
    if (r[0] instanceof Date) date = Utilities.formatDate(r[0], tz, 'yyyy-MM-dd');
    else {
      const d = String(r[0] || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (d) date = d[3] + '-' + d[2].padStart(2, '0') + '-' + d[1].padStart(2, '0');
    }
    if (!date || date < today) return;
    out.push({ date: date, from: parseHour_(shown[i][1]), to: parseHour_(shown[i][2]) });
  });
  return out;
}

const inRange_ = (m, from, to) => (!from || m >= minutes_(from)) && (!to || m < minutes_(to));

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getDisplayValues();
}

const minutes_ = hhmm => { const p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; };
const hhmm_ = min => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const to12h_ = hhmm => { const p = hhmm.split(':').map(Number); return (p[0] % 12 || 12) + ':' + String(p[1]).padStart(2, '0') + (p[0] < 12 ? ' a. m.' : ' p. m.'); };
// "2026-11-12" → "jueves 12 de noviembre", como se dice en Colombia.
const DIAS_ = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fecha_ = iso => { const p = iso.split('-').map(Number); return DIAS_[new Date(p[0], p[1] - 1, p[2]).getDay()] + ' ' + p[2] + ' de ' + MESES_[p[1] - 1]; };
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
  if (BREAKS.some(b => inRange_(t, b[0], b[1]))) return false;
  if (blocked_().some(b => b.date === date && inRange_(t, b.from, b.to))) return false;
  const today = today_();
  if (date < today || (date === today && t <= nowMin_())) return false;
  const p0 = today.split('-').map(Number);
  const limit = new Date(p0[0], p0[1] - 1, p0[2] + DAYS_AHEAD - 1);
  return d <= limit;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Aviso doble: notificación ntfy al celular y correo de Gmail. Si uno falla, el otro igual sale.
function aviso_(title, text, tag) {
  ntfy_(title, text, tag);
  correo_(title, text);
}

function correo_(title, text) {
  if (NOTIFY_EMAIL === '-') return;
  try {
    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(to, title + ' · Alex Studios', text + '\n\nLas citas están en la pestaña Citas de tu hoja de Google.');
  } catch (err) { /* sin cupo de correo o sin permiso: queda el aviso ntfy */ }
}

// Se publica en JSON: así los títulos con tildes o emojis ("José", "✂️") no rompen el envío.
// Devuelve el código y la respuesta de ntfy (200 = enviado) para poder revisarlo en el registro.
function ntfy_(title, text, tag) {
  try {
    const res = UrlFetchApp.fetch('https://ntfy.sh/', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ topic: NTFY_TOPIC, title: title, message: text, tags: [tag], priority: 4 }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) console.warn('ntfy respondió ' + res.getResponseCode() + ': ' + res.getContentText());
    return res.getResponseCode() + ' ' + res.getContentText();
  } catch (err) {
    console.warn('ntfy falló: ' + err); // la hoja ya está actualizada aunque falle el aviso
    return 'error: ' + err;
  }
}

// Solo devuelve fechas y horas: nunca nombres, teléfonos, notas ni ids.
function doGet() {
  return json_({
    booked: rows_().filter(r => r[COL.date] && r[COL.time]).map(r => ({ date: r[COL.date], time: r[COL.time] })),
    blocked: blocked_(),
  });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad' }); }
  return b.action === 'cancel' ? cancel_(b.id) : book_(b);
}

function book_(b) {
  const name = String(b.name || '').trim();
  const phone = digits_(b.phone).replace(/^57(?=\d{10}$)/, ''); // celular colombiano: 10 números
  const note = String(b.note || '').trim().slice(0, 200);
  const price = SERVICES[b.service];
  const valid = price && name.length >= 2 && name.length <= 60 && phone.length === 10 && validSlot_(b.date, b.time);
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
    sheet_().appendRow([b.date, b.time, b.service, price, clean(name), phone, clean(note), new Date(), id]);
  } finally {
    lock.releaseLock();
  }

  aviso_('Nueva cita', `${name} · ${b.service}\n${fecha_(b.date)} a las ${to12h_(b.time)}\nCel: ${phone}${note ? `\nNota: ${note}` : ''}`, 'scissors');
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
  aviso_('Cita cancelada', `${row[COL.name]} canceló ${row[COL.service]}\n${fecha_(row[COL.date])} a las ${to12h_(row[COL.time])}`, 'x');
  return json_({ ok: true });
}

// Cada 5 minutos (reloj de Google, gratis): avisa a Alex de las citas que empiezan en 30 minutos o menos.
function recordar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const today = today_();
    const now = nowMin_();
    rows_().forEach((r, i) => {
      const left = minutes_(r[COL.time]) - now;
      if (r[COL.date] !== today || r[COL.reminded] || left <= 0 || left > REMIND_BEFORE) return;
      aviso_(`En ${left} min: ${r[COL.name]}`, `${r[COL.service]} a las ${to12h_(r[COL.time])}\nCel: ${r[COL.phone]}${r[COL.note] ? `\nNota: ${r[COL.note]}` : ''}`, 'alarm_clock');
      sheet_().getRange(i + 2, COL.reminded + 1).setValue('Enviado');
    });
  } finally {
    lock.releaseLock();
  }
}

// Ejecútala una vez desde el editor: crea las pestañas Citas y Bloqueos, pone en marcha el aviso
// de 30 minutos, da permisos y manda un aviso de prueba.
function preparar() {
  sheet_();
  blockSheet_();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'recordar')) {
    ScriptApp.newTrigger('recordar').timeBased().everyMinutes(5).create();
  }
  probarAviso();
}

function probarAviso() {
  aviso_('Prueba', 'Los avisos de Alex Studios funcionan ✂️', 'scissors');
}

// Si no llega la notificación: ejecútala y mira el "Registro de ejecución" abajo.
function probarNtfy() {
  console.log('Tema: ' + NTFY_TOPIC);
  console.log('Respuesta de ntfy: ' + ntfy_('Prueba ntfy', 'Si ves esto, ntfy funciona desde Google ✂️', 'scissors'));
}
