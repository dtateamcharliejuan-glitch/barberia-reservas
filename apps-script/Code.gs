// Google Apps Script: guarda las citas en la hoja y avisa al celular por ntfy.
// Se pega en Extensiones → Apps Script de la hoja de cálculo (ver README).

// Tema privado de ntfy: pon algo largo y difícil de adivinar, y suscríbete a él en la app ntfy.
const NTFY_TOPIC = 'cambia-esto-barberia-xxxxxxxx';
const SHEET_NAME = 'Citas';
const HEADERS = ['Fecha', 'Hora', 'Servicio', 'Precio', 'Nombre', 'Teléfono', 'Creada'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@'); // fecha y hora como texto, sin conversiones
  }
  return sh;
}

// Solo devuelve fecha y hora: nunca nombres ni teléfonos.
function booked_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 2).getDisplayValues()
    .filter(r => r[0] && r[1])
    .map(r => ({ date: r[0], time: r[1] }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ booked: booked_() });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad' }); }

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(b.date) && /^\d{2}:\d{2}$/.test(b.time)
    && String(b.name || '').trim().length >= 2 && String(b.phone || '').replace(/\D/g, '').length >= 7;
  if (!valid) return json_({ ok: false, error: 'bad' });

  // El candado evita que dos personas reserven la misma hora a la vez.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (booked_().some(x => x.date === b.date && x.time === b.time)) return json_({ ok: false, error: 'taken' });
    const clean = v => String(v).replace(/^[=+\-@]/, "'$&").slice(0, 80); // evita fórmulas inyectadas
    sheet_().appendRow([b.date, b.time, clean(b.service), Number(b.price) || '', clean(b.name), clean(b.phone), new Date()]);
  } finally {
    lock.releaseLock();
  }

  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + NTFY_TOPIC, {
      method: 'post',
      payload: `${b.name} · ${b.service}\n${b.date} a las ${b.time}\nTel: ${b.phone}`,
      headers: { Title: 'Nueva cita', Tags: 'scissors', Priority: 'high' },
      muteHttpExceptions: true,
    });
  } catch (err) { /* la cita ya está guardada aunque falle el aviso */ }

  return json_({ ok: true });
}

// Ejecútala una vez desde el editor para dar permisos y probar el aviso.
function probarAviso() {
  UrlFetchApp.fetch('https://ntfy.sh/' + NTFY_TOPIC, { method: 'post', payload: 'Prueba: los avisos de la barbería funcionan ✂️' });
}
