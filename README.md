# balcones-web

Sitio de **Balcones del Arroyo**, casa de campo en Arroyo de los Patos (Nono,
Valle de Traslasierra, Córdoba).

HTML, CSS y JavaScript sin frameworks ni compilación.

## Cómo verlo

```bash
python -m http.server 5173
```

Y entrar a `http://localhost:5173`.

> Abrir `index.html` con doble clic también funciona, pero el navegador bloquea
> el paso a `reserva.html`. Para probar el flujo de reserva completo, usá el
> servidor.

## Dónde se tocan las cosas

| Quiero cambiar… | Dónde |
|---|---|
| Precios por temporada y mínimo de noches | `/admin` → Precios y textos → **Precios** |
| Cuándo rige cada temporada, Semana Santa, findes largos | `/admin` → Precios y textos → **Fechas** |
| Textos del inicio, preguntas frecuentes, opiniones | `/admin` → Precios y textos → **Textos** |
| Contacto, seña, horarios de ingreso y salida | `/admin` → Precios y textos → **Datos** |
| La galería (agregar, sacar, reordenar, epígrafes) | `/admin` → **Fotos** |
| Qué fechas están ocupadas | `/admin` → Calendario o Reservas (ya no se edita `js/disponibilidad.js`) |
| Comodidades, actividades, ambientes | `js/config.js` |
| Los valores de arranque de todo lo editable | `js/config.js` (el panel los pisa) |
| Las fotos que vienen con el sitio | `img/` y `img/thumb/` |
| Estilos | `css/estilos.css` |

Antes de publicar un cambio de precios o textos, el botón **"Ver cómo queda"**
abre el sitio con lo que estás editando, sin publicar nada; y **"Revisar y
publicar"** te muestra el viejo → nuevo campo por campo antes de tocar la base.

Todo lo marcado con `<< REVISAR >>` en `js/config.js` tiene datos de ejemplo y
hay que reemplazarlo por los reales.

## Publicar en Vercel

El repo ya viene listo. En [vercel.com](https://vercel.com):

1. **Add New… → Project** e importá `bruscofacundo1/balcones-web`.
2. Vercel lo detecta como sitio estático solo. **No toques nada**: dejá el
   framework en *Other* y los campos de build vacíos.
3. **Deploy**.

El sitio en sí no necesita nada más: no hay build. Cada `git push` a `main`
publica automáticamente.

El `vercel.json` ya deja resuelto el caché (las fotos se guardan un año, el
HTML y el código se revalidan siempre) y las URLs sin `.html`.

### Para que funcione el bloqueo de fechas y el cobro de la seña

Esto sí necesita configurarse una vez, después del primer deploy — la parte
de Neon y `ADMIN_PASSWORD` hace falta siempre (el sitio hoy manda todo por
WhatsApp); la de Mercado Pago sólo si van a activar la variante de cobro
online:

1. Crear una base en [Neon](https://neon.tech) (gratis) y copiar el
   connection string — ahí quedan la disponibilidad y todas las reservas
   (las de la web, las que se cargan a mano y los bloqueos).
2. **Settings → Environment Variables**, agregar:
   - `DATABASE_URL` — el connection string de Neon.
   - `ADMIN_PASSWORD` — la contraseña para entrar a `/admin`. Que sea larga
     y al azar, y guardala en un gestor de contraseñas: con esa clave se
     cancelan reservas y se ven los datos de los huéspedes. Cambiarla cierra
     todas las sesiones abiertas.
   - El acceso a **Vercel Blob** — **no se carga a mano**. Se crea el store
     desde *Storage → Create Database → Blob* y Vercel inyecta las variables
     solo (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`, o el viejo
     `BLOB_READ_WRITE_TOKEN` según cómo se haya conectado — el código acepta
     las dos formas). Es lo que permite subir fotos nuevas desde el panel; sin
     esto el resto de la galería (reordenar, epígrafes, sacar) igual funciona.

     > **El store va PÚBLICO, no privado.** Las fotos las carga el navegador
     > del visitante con `<img src>`; un store privado entrega URLs
     > `*.private.blob.vercel-storage.com` que sólo se pueden leer con el SDK
     > y un token, así que las fotos no se verían. El código ya las sube con
     > `access: 'public'`. Acá no hay nada sensible: son las fotos de la casa
     > que se muestran en el sitio.
   - `MP_ACCESS_TOKEN` — el Access Token de
     [mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel)
     (empezá con el de prueba, `TEST-...`). Sólo hace falta si van a prender
     la variante "Mercado Pago" de "Cómo se paga" en `checkout.html`.
   - `MP_WEBHOOK_SECRET` — opcional, la clave que da Mercado Pago al
     configurar el webhook.

   **Importante:** después de cargar o corregir una variable hace falta un
   deployment nuevo para que la función la vea — guardarla sola no alcanza.
   Un *Redeploy* del último deployment, o un `git push` cualquiera, sirven.
3. En el panel de Mercado Pago, configurar el webhook apuntando a
   `https://tu-dominio/api/webhook-mercadopago`, evento `payments`.
4. En `js/config.js`, `CONFIG.mercadoPago.publicKey` con la Public Key (no es
   secreta, así que va directo en el código).

El detalle completo — cómo está armado, qué pasa si algo falla a mitad de
camino, cómo probarlo — está en la sección 6 de `CONTEXTO.md`.

### Dominio propio

En **Settings → Domains** del proyecto, agregá el dominio y seguí las
instrucciones de DNS que te da Vercel. Después conviene actualizar la línea
`<link rel="canonical">` de `index.html` con la dirección definitiva.

## Documentación

**[CONTEXTO.md](CONTEXTO.md)** explica qué se hizo, por qué, cómo funciona el
flujo de reserva, el sistema de variantes y qué falta. Leerlo antes de meter
mano.
