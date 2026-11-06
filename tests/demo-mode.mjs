// Las pruebas de navegador siempre corren en modo demo: así nunca llenan la hoja real de
// citas ni mandan correos o eventos de calendario de verdad.
export async function forceDemo(ctx, { whatsapp } = {}) {
  await ctx.route('**/js/config.js*', async route => {
    const res = await route.fetch();
    let body = (await res.text()).replace(/sheetsUrl: '[^']*'/, "sheetsUrl: ''");
    if (whatsapp) body = body.replace(/whatsapp: '\d*'/, `whatsapp: '${whatsapp}'`);
    await route.fulfill({ response: res, body });
  });
  // Por si acaso: cualquier llamada a Google Apps Script se corta.
  await ctx.route('https://script.google.com/**', route => route.abort());
}
