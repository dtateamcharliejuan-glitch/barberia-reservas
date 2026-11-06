// Responsive: recorre el flujo completo en 14 tamaños de pantalla y revisa proporciones.
// Uso: npm run responsive   (con la web servida; por defecto en http://localhost:5173/barberia/)
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173/barberia/';
const SHOTS = new URL('../shots/responsive/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(SHOTS, { recursive: true });

const SIZES = [
  { name: '320-se', width: 320, height: 568, mobile: true },
  { name: '375-iphone8', width: 375, height: 667, mobile: true },
  { name: '390-iphone14', width: 390, height: 844, mobile: true },
  { name: '412-android', width: 412, height: 915, mobile: true },
  { name: '844-horizontal', width: 844, height: 390, mobile: true },
  { name: '768-tablet', width: 768, height: 1024, mobile: true },
  { name: '1024-tablet-h', width: 1024, height: 768 },
  { name: '1280-laptop', width: 1280, height: 720 },
  { name: '1366-laptop', width: 1366, height: 768 },
  { name: '1440-desktop', width: 1440, height: 900 },
  { name: '1536-laptop', width: 1536, height: 864 },
  { name: '1920-fullhd', width: 1920, height: 1080 },
  { name: '1280x500-ventana-baja', width: 1280, height: 500 },
  { name: '3840-4k', width: 3840, height: 2160 },
];

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
let failed = 0;
const problems = [];

// Revisiones que valen para cualquier pantalla y paso.
async function audit(page, size, step) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const visible = el => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden'; };
    const small = [...document.querySelectorAll('button, a, input')].filter(visible)
      .filter(el => !el.closest('[hidden]'))
      .map(el => ({ el, b: el.getBoundingClientRect() }))
      .filter(({ b }) => b.height < 44 || b.width < 44)
      .map(({ el, b }) => `${el.className || el.tagName} ${Math.round(b.width)}×${Math.round(b.height)}`);
    const tinyText = [...document.querySelectorAll('body *')].filter(el => el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && visible(el))
      .filter(el => parseFloat(getComputedStyle(el).fontSize) < 11).map(el => el.textContent.trim().slice(0, 20));
    const sticking = [...document.querySelectorAll('body *')].filter(el => visible(el) && el.getBoundingClientRect().right > vw + 1 && !el.closest('.stage .screen.enter-fwd, .stage .screen.enter-back'))
      .map(el => el.className || el.tagName).slice(0, 3);
    return { sw: document.documentElement.scrollWidth, vw, sh: document.documentElement.scrollHeight, vh: innerHeight, small, tinyText, sticking };
  });
  const p = [];
  if (r.sw > r.vw) p.push(`scroll lateral (${r.sw} > ${r.vw}): ${r.sticking.join(', ')}`);
  if (r.small.length) p.push(`toques < 44px: ${r.small.slice(0, 4).join(' · ')}`);
  if (r.tinyText.length) p.push(`texto < 11px: ${r.tinyText.slice(0, 3).join(' · ')}`);
  // El foco queda en un título visible (lectores de pantalla), nunca perdido en <body>.
  const focus = await page.evaluate(() => { const a = document.activeElement; return a && a !== document.body && a.getClientRects().length > 0; });
  if (!focus && step !== '6-cancelar') p.push('el foco se pierde (queda en <body> o en algo oculto)');
  if (step === '0-inicio' && size.width >= 1024 && size.height >= 720 && r.sh > r.vh + 2) p.push(`en computador no cabe sin scroll (${r.sh} > ${r.vh})`);
  return p;
}

async function inView(page, selector) {
  return page.locator(selector).first().evaluate(el => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 1; });
}

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: !!size.mobile, hasTouch: !!size.mobile, locale: 'es-CO', timezoneId: 'America/Bogota', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-09T10:10:00-05:00') }); // lunes, abierto
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  const shot = n => page.screenshot({ path: `${SHOTS}${size.name}-${n}.png` });
  const out = [];
  const step = async (name, fn) => {
    await fn();
    await page.waitForTimeout(150);
    await shot(name);
    const p = await audit(page, size, name);
    if (p.length) out.push(`${name}: ${p.join(' | ')}`);
  };

  await step('0-inicio', async () => {
    if (!(await inView(page, '[data-go="servicio"]'))) out.push('inicio: «Reservar cita» no se ve sin bajar');
    if (!(await page.locator('h1').isVisible())) out.push('inicio: no se ve el nombre');
    const overlap = await page.evaluate(() => { const a = document.querySelector('[data-logo]').getBoundingClientRect(); const b = document.querySelector('.scissors').getBoundingClientRect(); return a.top < b.bottom - 2 && a.left < b.right && a.right > b.left; });
    if (overlap) out.push('inicio: el logo tapa las tijeras');
    // En computador el panel de la barbería cabe entero, sin barra de scroll propia.
    if (size.width >= 1024 && size.height >= 700) {
      const extra = await page.evaluate(() => { const a = document.querySelector('.brand-panel'); return a.scrollHeight - a.clientHeight; });
      if (extra > 0) out.push(`inicio: el panel de la barbería no cabe (sobran ${extra}px)`);
      const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.layout')).gridTemplateColumns.split(' ').length);
      if (cols !== 2) out.push('inicio: en computador no salen las dos columnas');
    }
    // Al bajar del todo, el último precio no queda tapado por la barra del botón.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const covered = await page.evaluate(() => { const li = document.querySelector('.price-list li:last-child').getBoundingClientRect(); const foot = document.querySelector('[data-screen="inicio"] .screen-foot').getBoundingClientRect(); return foot.height > 0 && foot.top < li.bottom - 1 && foot.bottom > li.top && foot.left < li.right && foot.right > li.left; });
    if (covered) out.push('inicio: la barra del botón tapa el último precio');
    await page.evaluate(() => scrollTo(0, 0));
  });
  await step('1-servicio', async () => { await page.locator('[data-go="servicio"]').click(); await page.locator('[data-screen="servicio"]').waitFor(); });
  await step('2-dia', async () => { await page.locator('.option').nth(1).click(); await page.locator('[data-screen="dia"]').waitFor(); });
  await step('3-hora', async () => { await page.locator('.day:not([disabled])').nth(1).click(); await page.locator('[data-screen="hora"]').waitFor(); });
  await step('4-datos', async () => {
    await page.locator('.slot:not([disabled])').first().click();
    await page.locator('[data-screen="datos"]').waitFor();
    await page.locator('input[name=name]').fill('Juan Pérez');
    await page.locator('input[name=phone]').fill('300 123 4567');
    if (!(await inView(page, '[data-submit]'))) out.push('datos: «Confirmar cita» no se ve sin bajar');
  });
  await step('5-listo', async () => {
    await page.locator('[data-submit]').click();
    await page.locator('[data-screen="listo"]').waitFor();
    if (!(await inView(page, '[data-restart]'))) out.push('listo: «Volver al inicio» no se ve sin bajar');
  });
  await step('6-cancelar', async () => {
    await page.locator('[data-cancel-last]').click();
    await page.locator('[data-sheet]').waitFor();
    if ((await page.locator('[data-sheet-text]').innerText()).includes('..')) out.push('cancelar: punto doble en el texto');
  });

  if (out.length) { failed++; problems.push(`✖ ${size.name}\n  ${out.join('\n  ')}`); }
  else console.log(`✔ ${size.name} (${size.width}×${size.height})`);
  await ctx.close();
}

await browser.close();
for (const p of problems) console.log(p);
console.log(failed ? `\n${failed} tamaño(s) con problemas` : `\nTodo OK en los ${SIZES.length} tamaños`);
process.exit(failed ? 1 : 0);
