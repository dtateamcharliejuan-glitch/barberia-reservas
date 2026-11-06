# Alex Studios · reservas sin login

Reserva paso a paso, una pantalla por paso: servicio → día → hora libre → nombre, celular (10 números) y nota opcional → listo.
Quien reserva puede **cancelar** desde la pantalla de confirmación o desde «Tu próxima cita» en el inicio (solo desde el celular con el que reservó).
Coste 0: la web vive en **GitHub Pages**, las citas en **Google Sheets** y el aviso llega al celular con **ntfy**.

## Cambiar nombre, precios y horario

Todo está en [`js/config.js`](js/config.js): nombre, barrio, dirección del mapa, días y horas de apertura, almuerzo (`breaks`), duración de cada hueco, servicios y precios.

> En modo real, cambia **también** `SERVICES`, `OPEN_DAYS`, `OPEN`, `CLOSE`, `SLOT_MINUTES` y `BREAKS` arriba de `apps-script/Code.gs`: el servidor revisa cada reserva y no se fía del navegador.

## Logo y fotos

- **Logo:** guarda el archivo en `img/` y pon la ruta en `logo` de `js/config.js` (por ejemplo `img/logo.png`). Mientras tanto se ven las iniciales `AS`.
- **Ilustraciones:** la portada (poste y tijeras animados) y los iconos de servicio están dibujados a mano en `js/art.js`; no hay fotos de stock. El icono de cada servicio se elige con `icon` en `js/config.js` (`scissors`, `brow`, `beard`).

## Modo demo y modo real

- `sheetsUrl: ''` → **demo**: las citas se guardan solo en el navegador de quien la abre (sirve para enseñarla).
- `sheetsUrl: 'https://script.google.com/…/exec'` → **real**: todas las personas ven las mismas horas ocupadas.

## Montarlo de verdad (unos 15 minutos, una sola vez)

### 1. Aviso al celular (ntfy)
1. Instala la app **ntfy** en el celular del barbero (Android o iPhone, gratis).
2. Pulsa **+** y suscríbete a un tema con un nombre largo e inventado, por ejemplo `alexbarber-7f3k9q2x`. Quien conozca el nombre puede leer los avisos, así que no uses algo fácil de adivinar.

### 2. La hoja de citas (Google Sheets)
1. Con la cuenta de Google del barbero, crea una hoja de cálculo nueva.
2. **Extensiones → Apps Script**. Borra lo que haya y pega [`apps-script/Code.gs`](apps-script/Code.gs).
3. Cambia `NTFY_TOPIC` por el tema del paso 1 y guarda. (No subas el tema real a GitHub.)
4. En **Configuración del proyecto** (rueda dentada) pon la zona horaria **(GMT-05:00) Bogotá**.
5. Elige la función `preparar` y pulsa **Ejecutar**. Acepta los permisos: crea las pestañas **Citas** y **Bloqueos** y tiene que llegar una notificación al celular.
6. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
7. Copia la URL que termina en `/exec` y pégala en `sheetsUrl` de `js/config.js`.

Las citas aparecen en la pestaña **Citas** de la hoja (el barbero la ve en la app de Google Sheets).
**Para cancelar una cita, borra su fila**: la hora vuelve a quedar libre en la web. Si el cliente cancela desde la web, la fila se borra sola y llega un aviso «Cita cancelada».

### Días u horas en que Alex no atiende (tatuajes, diligencias…)
En la pestaña **Bloqueos** de la hoja, una fila por bloqueo:

| Fecha | Desde | Hasta | Motivo |
|---|---|---|---|
| 14/11/2026 | | | Tatuaje (día entero) |
| 18/11/2026 | 2:00 p. m. | 4:00 p. m. | Diligencia |

La fecha sale con calendario y las horas con lista. Sin «Desde/Hasta» se bloquea el día entero: en la web sale **cerrado**. El motivo no se muestra a nadie. Para desbloquear, borra la fila. Las citas ya reservadas no se tocan: si había alguna, avísale al cliente.

> Si cambias `Code.gs` más tarde: Implementar → Gestionar implementaciones → editar → Nueva versión. La URL no cambia.

### 3. Publicar
Antes de subir, ejecuta `npm run stamp`: marca CSS y JS con una versión (`?v=…`) para que ningún navegador mezcle archivos nuevos con viejos guardados en caché. `npm test` falla si se te olvida.

Sube los cambios a GitHub (`main`). GitHub Pages publica la web sola en un minuto.

## Pruebas

```bash
npm install
npm test      # horarios, cancelar, cambio de día y el servidor de Google (simulado)
npm run e2e   # reservar, cancelar y medianoche en el navegador (Playwright + Edge), móvil y escritorio
npm run responsive  # el flujo completo en 14 tamaños de pantalla (320 px a 4K, horizontal y ventana baja)
npm run iphone      # lo mismo con el motor de Safari (WebKit), como en un iPhone (una vez: npx playwright-core install webkit)
```

`npm run e2e` necesita la web servida en http://localhost:5173/barberia/ (o define BASE con otra URL). Las capturas quedan en `shots/`.

## Seguridad y privacidad

- La web solo descarga **fecha y hora** de las citas ocupadas y de los bloqueos; nombres, celulares, notas y motivos se quedan en la hoja de Alex.
- El servidor solo acepta horas reales del horario, calcula el precio él mismo y limita a 2 citas futuras por celular.
- Cancelar exige el código secreto que se guardó en el celular al reservar: nadie puede cancelar la cita de otro.
- Si alguien abusa con otros números, Alex borra esas filas y las horas vuelven a quedar libres.
