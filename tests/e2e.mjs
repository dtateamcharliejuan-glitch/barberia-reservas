// Prueba de punta a punta con Playwright (Edge instalado en el equipo).
// Uso: npm run e2e   (con la web servida; por defecto en http://localhost:5173/barberia/)
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173/barberia/';
const SHOTS = new URL('../shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message}`); }
};

for (const vp of [{ name: 'movil', width: 390, height: 844, isMobile: true, hasTouch: true }, { name: 'escritorio', width: 1280, height: 800 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, locale: 'es-CO' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  const visible = name => page.locator(`[data-screen="${name}"]`);
  const shot = n => page.screenshot({ path: `${SHOTS}${vp.name}-${n}.png` });

  await check(`[${vp.name}] inicio muestra nombre, barrio y precios en pesos`, async () => {
    await assert.equal(await page.locator('h1').innerText(), 'Alex Barber');
    assert.match(await page.locator('.eyebrow').innerText(), /floralia/i);
    const prices = await page.locator('[data-price-list] .price').allInnerTexts();
    assert.deepEqual(prices, ['$18.000', '$20.000', '$23.000']);
    await shot('0-inicio');
  });

  await check(`[${vp.name}] Reservar cita → paso 1 servicio`, async () => {
    await page.getByRole('button', { name: 'Reservar cita' }).click();
    await visible('servicio').waitFor();
    assert.equal(await page.locator('[data-count]').innerText(), 'Paso 1 de 4');
    await shot('1-servicio');
  });

  await check(`[${vp.name}] elegir servicio avanza solo al día`, async () => {
    await page.locator('.option', { hasText: 'Corte + cejas' }).click();
    await visible('dia').waitFor();
    assert.match(await page.locator('[data-pick-service]').innerText(), /Corte \+ cejas · \$20\.000/);
    await shot('2-dia');
  });

  await check(`[${vp.name}] atrás vuelve al servicio y conserva la elección`, async () => {
    await page.locator('[data-back]').click();
    await visible('servicio').waitFor();
    assert.equal(await page.locator('.option[aria-pressed="true"]').count(), 1);
    await page.locator('.option', { hasText: 'Corte + cejas' }).click();
    await visible('dia').waitFor();
  });

  let chosenTime;
  await check(`[${vp.name}] elegir día avanza a la hora; ocupadas no se pueden tocar`, async () => {
    await page.locator('.day:not([disabled])').first().click();
    await visible('hora').waitFor();
    assert.equal(await page.locator('[data-count]').innerText(), 'Paso 3 de 4');
    const free = page.locator('.slot:not([disabled])');
    assert.ok(await free.count() > 0, 'hay horas libres');
    await shot('3-hora');
    chosenTime = await free.first().innerText();
  });

  await check(`[${vp.name}] elegir hora avanza a los datos con el resumen`, async () => {
    await page.locator('.slot:not([disabled])').first().click();
    await visible('datos').waitFor();
    assert.equal(await page.locator('[data-sum-time]').innerText(), chosenTime);
    assert.equal(await page.locator('[data-sum-price]').innerText(), '$20.000');
    assert.ok(await page.locator('[data-submit]').isDisabled(), 'confirmar bloqueado sin datos');
  });

  await check(`[${vp.name}] con nombre y celular se confirma la cita`, async () => {
    await page.locator('input[name=name]').fill('Juan Pérez');
    await page.locator('input[name=phone]').fill('300 123 4567');
    await shot('4-datos');
    await page.getByRole('button', { name: 'Confirmar cita' }).click();
    await visible('listo').waitFor();
    assert.match(await page.locator('[data-done-text]').innerText(), new RegExp(`Juan Pérez.*${chosenTime}.*corte \\+ cejas`));
    await page.waitForTimeout(500);
    await shot('5-listo');
  });

  await check(`[${vp.name}] la hora reservada queda ocupada para el siguiente`, async () => {
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await visible('inicio').waitFor();
    await page.getByRole('button', { name: 'Reservar cita' }).click();
    await page.locator('.option').first().click();
    await page.locator('.day:not([disabled])').first().click();
    await visible('hora').waitFor();
    assert.ok(await page.locator('.slot', { hasText: chosenTime }).isDisabled());
  });

  await check(`[${vp.name}] botón atrás del navegador vuelve un paso`, async () => {
    await page.goBack();
    await visible('dia').waitFor();
  });

  await check(`[${vp.name}] sin scroll lateral ni errores en consola`, async () => {
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.ok(sw <= cw, `scrollWidth ${sw} > ${cw}`);
    assert.deepEqual(errors, []);
  });

  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} fallo(s)` : '\nTodo OK');
process.exit(failed ? 1 : 0);
