# Barbería · reservas sin login

Web de una página para reservar cita: servicio → día → hora libre → nombre y teléfono.
Coste 0: la web vive en **GitHub Pages**, las citas en **Google Sheets** y el aviso llega al celular con **ntfy**.

## Cambiar nombre, precios y horario

Todo está en [`js/config.js`](js/config.js): nombre, barrio, días y horas de apertura, duración de cada hueco, servicios y precios.

## Modo demo y modo real

- `sheetsUrl: ''` → **demo**: las citas se guardan solo en el navegador de quien la abre (sirve para enseñarla).
- `sheetsUrl: 'https://script.google.com/…/exec'` → **real**: todas las personas ven las mismas horas ocupadas.

## Montarlo de verdad (unos 15 minutos, una sola vez)

### 1. Aviso al celular (ntfy)
1. Instala la app **ntfy** en el celular del barbero (Android o iPhone, gratis).
2. Pulsa **+** y suscríbete a un tema con un nombre largo e inventado, por ejemplo `barberia-navaja-7f3k9q2x`. Quien conozca el nombre puede leer los avisos, así que no uses algo fácil de adivinar.

### 2. La hoja de citas (Google Sheets)
1. Con la cuenta de Google del barbero, crea una hoja de cálculo nueva.
2. **Extensiones → Apps Script**. Borra lo que haya y pega [`apps-script/Code.gs`](apps-script/Code.gs).
3. Cambia `NTFY_TOPIC` por el tema del paso 1 y guarda.
4. Elige la función `probarAviso` y pulsa **Ejecutar**. Acepta los permisos; tiene que llegar una notificación al celular.
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Copia la URL que termina en `/exec` y pégala en `sheetsUrl` de `js/config.js`.

Las citas aparecen en la pestaña **Citas** de la hoja (el barbero la ve en la app de Google Sheets).
**Para cancelar una cita, borra su fila**: la hora vuelve a quedar libre en la web.

> Si cambias `Code.gs` más tarde: Implementar → Gestionar implementaciones → editar → Nueva versión. La URL no cambia.

### 3. Publicar
Sube los cambios a GitHub (`main`). GitHub Pages publica la web sola en un minuto.

## Pruebas

```bash
npm test
```

Prueba la lógica de horarios: días abiertos, huecos de 30 min, horas ocupadas y horas ya pasadas.

## Privacidad

La web solo descarga **fecha y hora** de las citas ocupadas; los nombres y teléfonos se quedan en la hoja del barbero.
