// Marca CSS y JS con una versión sacada de su contenido (styles.css?v=1a2b3c4d).
// Así el navegador nunca mezcla un HTML nuevo con un CSS o JS viejo guardado en caché.
//   node scripts/stamp.mjs          → actualiza las marcas
//   node scripts/stamp.mjs --check  → falla si alguna marca está desactualizada (lo usa npm test)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsFiles = readdirSync(join(root, 'js')).filter(f => f.endsWith('.js')).sort().map(f => `js/${f}`);
const assets = ['css/styles.css', ...jsFiles];

const STAMP = /\?v=[0-9a-f]+/g;
const read = f => readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n');

// El hash ignora las propias marcas, para que marcar no cambie el resultado.
const hash = createHash('sha1');
for (const f of assets) hash.update(f).update(read(f).replace(STAMP, ''));
const v = hash.digest('hex').slice(0, 8);

const stamp = text => text
  .replace(/(href="css\/styles\.css)(\?v=[0-9a-f]+)?"/, `$1?v=${v}"`)
  .replace(/(src="js\/app\.js)(\?v=[0-9a-f]+)?"/, `$1?v=${v}"`)
  .replace(/(from '\.\/[\w-]+\.js)(\?v=[0-9a-f]+)?'/g, `$1?v=${v}'`);

const check = process.argv.includes('--check');
const stale = [];
for (const f of ['index.html', ...jsFiles]) {
  const before = readFileSync(join(root, f), 'utf8');
  const after = stamp(before);
  if (after !== before) { stale.push(f); if (!check) writeFileSync(join(root, f), after); }
}

if (check && stale.length) {
  console.error(`✖ Marcas de versión desactualizadas en: ${stale.join(', ')}\n  Ejecuta: npm run stamp`);
  process.exit(1);
}
console.log(check ? `✔ Marcas de versión al día (v=${v})` : `Versión ${v}${stale.length ? ` → ${stale.join(', ')}` : ' (sin cambios)'}`);
