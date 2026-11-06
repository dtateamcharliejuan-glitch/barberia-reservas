# Alex Barber · reservas sin login

Reserva paso a paso, una pantalla por paso: servicio → día → hora libre → nombre y celular → listo.
Coste 0: la web vive en **GitHub Pages**, las citas en **Google Sheets** y el aviso llega al celular con **ntfy**.

## Cambiar nombre, precios y horario

Todo está en [`js/config.js`](js/config.js): nombre, barrio, días y horas de apertura, duración de cada hueco, servicios y precios.

> En modo real, cambia **también** `SERVICES`, `OPEN_DAYS`, `OPEN`, `CLOSE` y `SLOT_MINUTES` arriba de `apps-script/Code.gs`: el servidor revisa cada reserva y no se fía del navegador.

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
5. Elige la función `probarAviso` y pulsa **Ejecutar**. Acepta los permisos; tiene que llegar una notificación al celular.
6. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
7. Copia la URL que termina en `/exec` y pégala en `sheetsUrl` de `js/config.js`.

Las citas aparecen en la pestaña **Citas** de la hoja (el barbero la ve en la app de Google Sheets).
**Para cancelar una cita, borra su fila**: la hora vuelve a quedar libre en la web.

> Si cambias `Code.gs` más tarde: Implementar → Gestionar implementaciones → editar → Nueva versión. La URL no cambia.

### 3. Publicar
Sube los cambios a GitHub (`main`). GitHub Pages publica la web sola en un minuto.

## Pruebas

```bash
npm install
npm test      # lógica de horarios
npm run e2e   # reserva completa en el navegador (Playwright + Edge), móvil y escritorio
```

`npm run e2e` necesita la web servida en http://localhost:5173/barberia/ (o define BASE con otra URL). Las capturas quedan en `shots/`.

## Seguridad y privacidad

- La web solo descarga **fecha y hora** de las citas ocupadas; nombres y celulares se quedan en la hoja de Alex.
- El servidor solo acepta horas reales del horario, calcula el precio él mismo y limita a 2 citas futuras por celular.
- Si alguien abusa con otros números, Alex borra esas filas y las horas vuelven a quedar libres.
