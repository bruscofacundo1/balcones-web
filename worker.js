/* ============================================================================
   Balcones del Arroyo — punto de entrada del Worker
   ----------------------------------------------------------------------------
   Cloudflare unificó Pages y Workers: este proyecto se despliega como un
   único Worker con un binding de "assets" (ver wrangler.toml, `[assets]`) que
   sirve el sitio estático (HTML/CSS/JS/img) solo. Este archivo sólo entra en
   juego para las rutas de `/api/*` — `run_worker_first` en wrangler.toml hace
   que esas rutas lleguen siempre acá en vez de buscarse entre los archivos
   estáticos, y todo lo demás (`_headers`, `_redirects`, el resto del sitio)
   lo resuelve el binding de assets solo, sin pasar por este código.

   Va en formato ES module (import/export) porque es el punto de entrada que
   Cloudflare carga directo — el formato que recomienda su documentación.
   Cada handler de `/api/` sigue viviendo en `api/` con el estilo Node clásico
   (`module.exports = async (req, res) => {}`, sin tocar) para no arriesgar
   romper nada de lo ya probado (precios, disponibilidad, el lock atómico de
   reservas, el escapado contra XSS): esbuild empaqueta esos módulos CommonJS
   sin problema al importarlos desde acá. `wrap()` (lib/adaptador-cf.js) los
   adapta a la Fetch API que espera un Worker.
   ============================================================================ */

import handlerContenido from './api/contenido.js';
import handlerCrearPago from './api/crear-pago.js';
import handlerReservar from './api/reservar.js';
import handlerWebhook from './api/webhook-mercadopago.js';
import handlerCalendarioIcs from './api/calendario.ics.js';
import handlerAdminReservas from './api/admin/reservas.js';
import handlerAdminContenido from './api/admin/contenido.js';
import handlerAdminFotos from './api/admin/fotos.js';
import handlerAdminVideo from './api/admin/video.js';
import handlerAdminSesion from './api/admin/sesion.js';
import handlerAdminBookingSync from './api/admin/booking-sync.js';
import { wrap } from './lib/adaptador-cf.js';
import { sincronizarBooking } from './lib/reservas.js';

const rutas = {
  '/api/contenido': wrap(handlerContenido),
  '/api/crear-pago': wrap(handlerCrearPago),
  '/api/reservar': wrap(handlerReservar),
  '/api/webhook-mercadopago': wrap(handlerWebhook),
  '/api/calendario.ics': wrap(handlerCalendarioIcs),
  '/api/admin/reservas': wrap(handlerAdminReservas),
  '/api/admin/contenido': wrap(handlerAdminContenido),
  '/api/admin/fotos': wrap(handlerAdminFotos),
  '/api/admin/video': wrap(handlerAdminVideo),
  '/api/admin/sesion': wrap(handlerAdminSesion),
  '/api/admin/booking-sync': wrap(handlerAdminBookingSync)
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const manejador = rutas[url.pathname];
    if (manejador) return manejador({ request, env, ctx });

    // No es una ruta de API: no debería pasar (run_worker_first sólo manda
    // /api/* para acá), pero si pasa, que lo sirva el binding de assets en
    // vez de devolver un error de una ruta que este Worker no conoce.
    return env.ASSETS.fetch(request);
  },

  /**
   * El cron de wrangler.toml (`[triggers]`) dispara esto solo, sin que nadie
   * tenga que acordarse de apretar "Sincronizar con Booking" en el panel.
   * `exponerEnv` no corre acá (no pasa por `wrap`, que es sólo para pedidos
   * HTTP) así que las variables de entorno se copian a mano — sin esto,
   * `sincronizarBooking()` no encontraría ni BOOKING_ICAL_URL ni DATABASE_URL.
   */
  async scheduled(event, env, ctx) {
    for (const clave of Object.keys(env || {})) {
      if (typeof env[clave] === 'string') process.env[clave] = env[clave];
    }
    const resultado = await sincronizarBooking();
    if (!resultado.ok) console.error('sync Booking (cron):', resultado.error);
    else console.log('sync Booking (cron):', JSON.stringify(resultado));
  }
};
