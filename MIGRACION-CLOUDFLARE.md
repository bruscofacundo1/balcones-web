# Migración de Vercel a Cloudflare — 22/08/2026

Este documento cuenta qué se cambió para mudar el backend de Vercel a
Cloudflare (un Worker con Git conectado + R2 para las fotos), y sobre todo
**qué falta configurar a mano** del lado de Cloudflare para que funcione.
Neon sigue siendo la base de datos en los dos casos — no cambia nada ahí.

Nota sobre el nombre: Cloudflare venía ofreciendo dos productos separados,
Pages y Workers. Los unificó — los proyectos nuevos con Git conectado se
crean como Worker, no como el "Pages clásico" de antes (que enrutaba solo por
una carpeta `functions/`). Este documento y el resto del repo ya están
escritos para el modelo nuevo (`worker.js` + `wrangler.toml`).

## Por qué

Con el tráfico esperado (una casa que se llena por boca en boca) los dos son
gratis, pero Cloudflare no cobra nunca por transferencia de datos (bandwidth),
que es justo lo que más consume una galería de fotos si el sitio tuviera un
pico de visitas. El plan pago de respaldo también es más barato ($5/mes vs
$20/mes de Vercel Pro) por si algún día hiciera falta.

## Qué cambió en el código

- **`worker.js`** (nuevo, en la raíz) — el punto de entrada. Cloudflare
  unificó Pages y Workers: los proyectos nuevos se crean como un Worker con
  un binding de "assets" para el sitio estático, no como el "Pages clásico"
  (Connect to Git → Functions por carpeta) que existía antes. `worker.js`
  sólo atiende `/api/*` (el resto lo sirve el binding de assets solo, ver
  `wrangler.toml`); para cada ruta importa el handler original de `api/` y lo
  envuelve con `lib/adaptador-cf.js`. **La lógica de negocio de `api/*.js` y
  `lib/*.js` no se tocó** salvo lo que sigue — sólo cambió cómo entra el
  pedido y sale la respuesta.
- **`lib/mercadopago.js`** — antes usaba el SDK oficial de npm (`mercadopago`).
  No había forma de confirmar que ese SDK corriera en el runtime de
  Cloudflare (Workers) sin probarlo en producción, así que se reemplazó por
  llamadas directas a la API REST de Mercado Pago con `fetch` — nativo del
  runtime, cero dudas de compatibilidad. La validación de firma del webhook
  (que antes hacía el SDK) ahora es HMAC-SHA256 a mano con `node:crypto`.
  **Ver "Para probar" más abajo: esto es lo único que no se pudo probar
  contra Mercado Pago real.**
- **`lib/fotos.js`** — antes subía a Vercel Blob (`@vercel/blob`). Ahora usa
  el binding nativo de R2 (`env.FOTOS_BUCKET`). A diferencia de Blob, R2 no
  devuelve una URL pública sola: hace falta conectar un dominio al bucket
  (ver más abajo, `FOTOS_PUBLIC_URL`).
- **`lib/sesion.js`** — la IP del visitante ahora se lee de `cf-connecting-ip`
  (el header que pone el borde de Cloudflare) en vez de `x-forwarded-for`.
- **`_headers` y `_redirects`** (nuevos, reemplazan a `vercel.json`, que se
  borró) — mismo cacheo de `img/` a un año y de HTML/CSS/JS sin caché, y las
  mismas URLs limpias (`/reserva` en vez de `/reserva.html`). El binding de
  assets los sigue soportando igual que Pages.
- **`wrangler.toml`** (nuevo) — declara el punto de entrada (`worker.js`), el
  binding de assets con `run_worker_first = ["/api/*"]` (así esas rutas
  siempre llegan al Worker) y el binding de R2. Sirve además para probar en
  la computadora con `npx wrangler dev`.
- **`.assetsignore`** (nuevo) — qué no subir como archivo estático (el código
  de `api/` y `lib/`, `.git`, etc.). Sin esto el binding de assets serviría
  el código fuente del servidor como archivos descargables.
- **`package.json`** — se sacaron `@vercel/blob` y `mercadopago`; sólo queda
  `@neondatabase/serverless`.
- `js/precios.js`, `js/contenido.js`, `js/config.js` y toda la lógica de
  reservas/atomicidad en `lib/reservas.js` — **sin cambios**. Es la parte más
  delicada del sitio (el lock atómico de fechas, el escapado contra XSS) y no
  hacía falta tocarla: ya estaba escrita sin nada específico de Vercel.

## Qué hay que hacer en Cloudflare (una sola vez)

Cloudflare unificó Pages y Workers: los proyectos nuevos se crean como un
**Worker con Git conectado** (dashboard → Workers & Pages → Create
application → conectar el repo), no como el "Pages clásico" de antes. El
`wrangler.toml` del repo ya declara el punto de entrada (`worker.js`), el
binding de assets para servir el sitio estático y el binding del bucket de
R2 — Cloudflare los lee solo al desplegar, así que casi no hay nada que
tocar a mano en el dashboard salvo lo que sigue:

1. **Crear el bucket de R2 antes del primer deploy**: R2 → Create bucket →
   nombre **exactamente** `balcones-fotos` (si querés otro nombre, avisá
   para actualizar `wrangler.toml` a juego). El binding de `wrangler.toml`
   necesita que el bucket ya exista para poder conectarse.
2. **Dominio público del bucket**: R2 → el bucket → Settings → Public access
   → Enable → o bien un dominio propio (subdominio, ej.
   `fotos.balconesdelarroyo.com.ar`, apuntado a Cloudflare) o el subdominio
   `r2.dev` que te ofrece la misma pantalla para arrancar rápido. Copiá esa
   URL.
3. **Variables de entorno**: el proyecto → Settings → Variables and Secrets
   (revisá que estén tanto en *Production* como en *Preview*, si las separa):
   - `DATABASE_URL` — el connection string de Neon
   - `ADMIN_PASSWORD` — la contraseña del panel
   - `MP_ACCESS_TOKEN` — el Access Token de Mercado Pago
   - `MP_WEBHOOK_SECRET` — opcional pero recomendado
   - `FOTOS_PUBLIC_URL` — la URL del paso 2, sin `/` al final
4. **Redeploy**: como en Vercel, una variable cargada después del primer
   deploy necesita un deployment nuevo para que la función la vea.
7. **Webhook de Mercado Pago**: en el panel de Mercado Pago, apuntar a
   `https://tu-dominio/api/webhook-mercadopago`, evento `payments` — esto no
   cambia respecto a como estaba pensado para Vercel.

## Para probar antes de dar por cerrada la migración

- **La firma del webhook de Mercado Pago es la única pieza reescrita a mano
  sin poder probarla contra Mercado Pago real** (antes la calculaba el SDK
  oficial). El formato que usa está confirmado por la documentación pública
  de MP y por pruebas propias de consistencia (`node
  test-migracion.mjs` en la conversación de la migración), pero conviene
  confirmarlo con un pago de prueba real: hacé un pago con una tarjeta de
  test, mirá los logs de la función en Cloudflare y fijate que no diga
  "firma inválida". Si dijera eso con la firma bien puesta, no es grave —
  el pago se sigue confirmando igual porque el webhook busca el pago por su
  id directo en la API con el Access Token — pero convendría avisarme para
  revisar el cálculo.
- **Las URLs limpias** (`_redirects`): entrar a `/reserva`, `/checkout`, etc.
  sin el `.html` y confirmar que carguen.
- **Subir una foto nueva** desde `/admin` → Fotos, para confirmar que R2 y
  `FOTOS_PUBLIC_URL` estén bien conectados.
- **El flujo completo de reserva**, como ya se hacía antes de publicar
  cualquier cambio grande (ver CONTEXTO.md §6).

## Lo que NO cambió

Los archivos HTML/CSS/JS del sitio público (`index.html`, `js/app.js`,
`js/calendario.js`, etc.) no se tocaron: siguen pidiendo `/api/...` igual
que antes, y `worker.js` despacha esas rutas a `api/...` automáticamente
(ver `wrangler.toml`, `run_worker_first`). Tampoco cambió nada de precios,
temporadas, ni la lógica de reservas.
