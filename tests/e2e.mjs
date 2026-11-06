// Prueba de punta a punta con Playwright (Edge instalado en el equipo).
// Uso: npm run e2e   (con la web servida; por defecto en http://localhost:5173/barberia/)
import { chromium, webkit } from 'playwright-core';
import assert from 'node:assert/strict';
import fs, { mkdirSync } from 'node:fs';
import { to12h } from '../js/time.js';
import { forceDemo } from './demo-mode.mjs';

// "09:00" → expresión que busca "9:00 a. m." tal como la ve la persona.
const shown = hhmm => to12h(hhmm).replace(/\./g, '\\.').replace(' ', '\\s+');

const BASE = process.env.BASE ?? 'http://localhost:5173/barberia/';
const SHOTS = new URL('../shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(SHOTS, { recursive: true });

// --webkit (o ENGINE=webkit) prueba con el motor de Safari (iPhone); por defecto Chromium (Android, Chrome, Edge).
const WEBKIT = process.env.ENGINE === 'webkit' || process.argv.includes('--webkit');
const browser = WEBKIT ? await webkit.launch() : await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message.split('\n')[0]}`); }
};
const settle = page => page.waitForTimeout(450); // deja terminar la animación antes de la captura

for (const vp of [{ name: 'movil', width: 390, height: 844, isMobile: true, hasTouch: true }, { name: 'escritorio', width: 1280, height: 860 }]) {
  // En WebKit, el celular se presenta como iPhone: así se prueba el camino del archivo .ics.
  const iphone = WEBKIT && vp.isMobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {};
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, locale: 'es-CO', acceptDownloads: true, ...iphone });
  await forceDemo(ctx, { whatsapp: '3001112233' }); // número de prueba; el real va en js/config.js
  await ctx.route('https://calendar.google.com/**', route => route.fulfill({ body: 'ok' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  // Espera a que la página esté en ese paso (en el celular la pantalla de inicio no tiene alto propio).
  const visible = async name => {
    await page.waitForFunction(n => document.body.dataset.step === n, name);
    await page.locator(`[data-screen="${name}"]:not([hidden])`).waitFor({ state: 'attached' });
  };
  const shot = async n => { await settle(page); await page.screenshot({ path: `${SHOTS}${vp.name}-${n}.png` }); };

  await check(`[${vp.name}] inicio: nombre, logo, ilustración animada, barrio y precios en pesos`, async () => {
    assert.equal(await page.locator('h1').innerText(), 'Alex Studios');
    assert.equal(await page.locator('[data-logo]').innerText(), 'AS');
    assert.ok(await page.locator('[data-hero] svg.scene').isVisible(), 'la ilustración se ve');
    assert.equal(await page.locator('.blade-top').evaluate(e => getComputedStyle(e).animationName), 'snip-top', 'las tijeras se mueven');
    assert.equal(await page.locator('img').count(), 0, 'sin fotos de stock');
    assert.equal(await page.locator('[data-price-list] .icon-tile svg').count(), 3);
    assert.match(await page.locator('.place').innerText(), /Floralia/);
    assert.deepEqual(await page.locator('[data-price-list] .price').allInnerTexts(), ['$18.000', '$20.000', '$25.000']);
    assert.equal(await page.locator('[data-mine]').isHidden(), true, 'sin citas todavía');
    await shot('0-inicio');
  });

  await check(`[${vp.name}] Reservar cita → paso 1, con icono en cada servicio`, async () => {
    await page.getByRole('button', { name: 'Reservar cita' }).click();
    await visible('servicio');
    assert.equal(await page.locator('[data-count]').innerText(), 'Paso 1 de 4');
    assert.equal(await page.locator('.option .icon-tile svg').count(), 3);
    assert.equal(await page.locator('#t-servicio').innerText(), '¿Qué servicio deseas?');
    await shot('1-servicio');
  });

  await check(`[${vp.name}] elegir servicio avanza solo al día`, async () => {
    await page.locator('.option', { hasText: 'Corte + cejas' }).click();
    await visible('dia');
    assert.match(await page.locator('[data-pick-service]').innerText(), /Corte \+ cejas · \$20\.000/);
    // Día que Alex bloqueó (en la demo, un día de tatuaje): sale «cerrado» y no se puede tocar.
    const closed = page.locator('.day', { hasText: 'cerrado' });
    assert.equal(await closed.count(), 1, 'un día bloqueado en la demo');
    assert.ok(await closed.isDisabled());
    await shot('2-dia');
  });

  await check(`[${vp.name}] «Atrás» vuelve al servicio y conserva la elección`, async () => {
    await page.locator('[data-back]').click();
    await visible('servicio');
    assert.equal(await page.locator('.option[aria-pressed="true"]').count(), 1);
    await page.locator('.option', { hasText: 'Corte + cejas' }).click();
    await visible('dia');
  });

  let chosenTime;
  await check(`[${vp.name}] día → horas en mañana y tarde; ocupadas no se pueden tocar`, async () => {
    await page.locator('.day:not([disabled])').first().click();
    await visible('hora');
    assert.equal(await page.locator('[data-count]').innerText(), 'Paso 3 de 4');
    assert.ok(await page.locator('.period').count() >= 1);
    assert.ok(await page.locator('.slot[disabled]').first().isDisabled());
    assert.equal(await page.locator('.slot[data-time="12:00"], .slot[data-time="12:30"]').count(), 0, 'a las 12 Alex almuerza');
    assert.match(await page.locator('.break-note').innerText(), /Almuerzo de 12:00 a 1:00 p\. m\./);
    const firstFree = page.locator('.slot:not([disabled])').first();
    chosenTime = await firstFree.getAttribute('data-time');
    assert.match(await firstFree.innerText(), new RegExp(shown(chosenTime)), 'la hora se ve con a. m./p. m.');
    await shot('3-hora');
  });

  await check(`[${vp.name}] hora → datos con resumen; confirmar bloqueado sin datos`, async () => {
    await page.locator('.slot:not([disabled])').first().click();
    await visible('datos');
    assert.match(await page.locator('[data-summary-datos]').innerText(), new RegExp(shown(chosenTime)));
    assert.match(await page.locator('[data-summary-datos]').innerText(), /\$20\.000/);
    assert.ok(await page.locator('[data-submit]').isDisabled());
    assert.match(await page.locator('[data-hint]').innerText(), /nombre/);
  });

  await check(`[${vp.name}] etiquetas Nombre y Celular; con 7 números no deja confirmar`, async () => {
    assert.deepEqual(await page.locator('.field > span').allInnerTexts(), ['Nombre', 'Celular', 'Nota (opcional)']);
    await page.locator('input[name=name]').fill('Juan Pérez');
    await page.locator('input[name=phone]').fill('300 123 4');
    assert.ok(await page.locator('[data-submit]').isDisabled(), '7 números no bastan');
    assert.match(await page.locator('[data-hint]').innerText(), /10 números/);
    await page.locator('input[name=phone]').fill('300 123 45678');
    assert.ok(await page.locator('[data-submit]').isDisabled(), '11 números tampoco');
    assert.match(await page.locator('.policy').first().innerText(), /Recuerda asistir a tu cita/);
  });

  await check(`[${vp.name}] con nombre, celular de 10 y nota se confirma`, async () => {
    await page.locator('input[name=phone]').fill('300 123 4567');
    await page.locator('textarea[name=note]').fill('Degradado bajo');
    await shot('4-datos');
    await page.getByRole('button', { name: 'Confirmar cita' }).click();
    await visible('listo');
    assert.equal(await page.locator('[data-done-title]').innerText(), '¡Listo, Juan!');
    assert.match(await page.locator('[data-summary-listo]').innerText(), new RegExp(`Corte \\+ cejas[\\s\\S]*${shown(chosenTime)}`));
    assert.match(await page.locator('[data-screen="listo"] .policy').innerText(), /Si faltas sin avisar, se cobrará un valor adicional/);
    await shot('5-listo');
  });

  await check(`[${vp.name}] WhatsApp abre el chat de Alex (inicio y listo)`, async () => {
    const wa = page.locator('[data-screen="listo"] [data-whatsapp]');
    assert.ok(await wa.isVisible());
    assert.match(await wa.getAttribute('href'), /^https:\/\/wa\.me\/573001112233\?text=Hola/);
    assert.equal(await page.locator('[data-whatsapp]').count(), 2);
  });

  await check(`[${vp.name}] «Agregar a mi calendario» con aviso 30 min antes`, async () => {
    const apple = await page.evaluate(() => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
    if (apple) {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-calendar]').click()]);
      const ics = fs.readFileSync(await dl.path(), 'utf8');
      assert.equal(dl.suggestedFilename(), 'cita.ics');
      assert.match(ics, /TRIGGER:-PT30M/);
      assert.match(ics, /SUMMARY:Corte \+ cejas en Alex Studios/);
      const [hh, mm] = chosenTime.split(':').map(Number);
      assert.match(ics, new RegExp(`DTSTART:\\d{8}T${String(hh + 5).padStart(2, '0')}${String(mm).padStart(2, '0')}00Z`), 'hora de Colombia pasada a UTC');
    } else {
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-calendar]').click()]);
      await popup.waitForURL(/calendar.google.com/);
      const url = new URL(popup.url());
      assert.equal(url.host, 'calendar.google.com');
      assert.equal(url.searchParams.get('text'), 'Corte + cejas en Alex Studios');
      assert.match(url.searchParams.get('dates'), /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
      await popup.close();
    }
  });

  await check(`[${vp.name}] cancelar por error: pide confirmación y «No» la mantiene`, async () => {
    await page.getByRole('button', { name: 'Cancelar esta cita' }).click();
    await page.locator('[data-sheet]').waitFor();
    await shot('6-cancelar');
    await page.getByRole('button', { name: 'No, mantenerla' }).click();
    assert.ok(await page.locator('[data-sheet]').isHidden());
    await visible('listo');
  });

  await check(`[${vp.name}] al volver al inicio sale «Tu próxima cita»`, async () => {
    await page.getByRole('button', { name: 'Listo, volver al inicio' }).click();
    await visible('inicio');
    assert.match(await page.locator('.mine-card').innerText(), new RegExp(`${shown(chosenTime)}[\\s\\S]*Corte \\+ cejas`));
    await shot('7-inicio-con-cita');
  });

  await check(`[${vp.name}] la hora reservada queda ocupada para el siguiente`, async () => {
    await page.getByRole('button', { name: 'Reservar cita' }).click();
    await page.locator('.option').first().click();
    await page.locator('.day:not([disabled])').first().click();
    await visible('hora');
    assert.ok(await page.locator(`.slot[data-time="${chosenTime}"]`).isDisabled());
  });

  await check(`[${vp.name}] cancelar desde el inicio libera la hora`, async () => {
    await page.goBack(); await page.goBack(); await page.goBack();
    await visible('inicio');
    await page.locator('.mine-card').getByRole('button', { name: /Cancelar/ }).click();
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await page.locator('[data-toast]').filter({ hasText: 'Cita cancelada' }).waitFor();
    assert.ok(await page.locator('[data-mine]').isHidden());
    await page.getByRole('button', { name: 'Reservar cita' }).click();
    await page.locator('.option').first().click();
    await page.locator('.day:not([disabled])').first().click();
    await visible('hora');
    assert.ok(await page.locator(`.slot[data-time="${chosenTime}"]`).isEnabled(), 'la hora vuelve a estar libre');
  });

  await check(`[${vp.name}] sin scroll lateral ni errores en consola`, async () => {
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.ok(sw <= cw, `scrollWidth ${sw} > ${cw}`);
    assert.deepEqual(errors, [], JSON.stringify(errors));
  });

  await ctx.close();
}

// El calendario no se queda pegado: con la página abierta, pasa la medianoche.
await check('[reloj] a medianoche el calendario pasa solo al día nuevo', async () => {
  // El celular está en Madrid, pero la web debe usar la hora de Bogotá.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO', timezoneId: 'Europe/Madrid' });
  await forceDemo(ctx);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-06T23:50:00-05:00') }); // viernes 6 nov, 11:50 p. m. en Bogotá
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Reservar cita' }).click();
  await page.locator('.option').first().click();
  await page.locator('[data-screen="dia"]').waitFor();
  const first = () => page.locator('.day:not([disabled]) b').first().innerText();
  assert.equal(await first(), '7', 'el viernes de noche ya está lleno: primer día libre, sábado 7');
  assert.equal(await page.locator('.day.today small').innerText(), 'LLENO');
  await page.locator('.day:not([disabled])').first().click(); // elige el sábado 7
  await page.locator('[data-screen="hora"]').waitFor();
  await page.clock.runFor('25:00:00'); // ya es domingo 8, 00:50: el sábado elegido pasó
  await page.locator('[data-screen="dia"]').waitFor();
  assert.match(await page.locator('[data-toast]').innerText(), /ya pasó/);
  assert.equal(await page.locator('.day').first().locator('b').innerText(), '9', 'domingo cerrado: el calendario empieza el lunes 9');
  await ctx.close();
});

await browser.close();
console.log(failed ? `\n${failed} fallo(s)` : '\nTodo OK');
process.exit(failed ? 1 : 0);
