/* ============================================================================
   Balcones del Arroyo — disponibilidad "en vivo" (server-side)
   ----------------------------------------------------------------------------
   disponibilidad.js es la base: las noches que vos marcaste a mano con
   admin.html. Acá arriba se guardan, aparte, las noches que se pagaron
   online — así una reserva pagada bloquea la fecha sola, sin que dependa de
   que alguien actualice el archivo a tiempo.

   Usa Redis (vía la integración "Redis" del Marketplace de Vercel — el
   reemplazo de la vieja "Vercel KV", que quedó discontinuada). Dos claves
   por planta ('ocupadas:alta' / 'ocupadas:baja', un set de noches en 'AAAA-
   MM-DD'), más un registro por reserva y una marca por pago ya procesado
   (para no contarlo dos veces si el webhook llega más de una vez).
   ============================================================================ */

const { Redis } = require('@upstash/redis');

/**
 * Distintas formas en que puede llamarse la variable de entorno según cómo
 * se conectó la base: "Redis" desde el Marketplace de Vercel usa el prefijo
 * KV_* por compatibilidad con la integración vieja; conectando directo desde
 * Upstash usa UPSTASH_REDIS_*. Se admiten las dos.
 */
function credenciales() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}

function hayRedis() {
  const { url, token } = credenciales();
  return Boolean(url && token);
}

let cliente = null;
function redis() {
  if (cliente) return cliente;
  const { url, token } = credenciales();
  if (!url || !token) {
    throw new Error(
      'Falta conectar la base de disponibilidad: creá la integración "Redis" ' +
      'desde Storage en el panel de Vercel y conectala a este proyecto.'
    );
  }
  cliente = new Redis({ url, token });
  return cliente;
}

const CLAVE_NOCHES = planta => `ocupadas:${planta}`;
const CLAVE_RESERVA = id => `reserva:${id}`;
const CLAVE_PAGO_VISTO = id => `pago-visto:${id}`;
const CLAVE_LISTA_RESERVAS = 'reservas:lista'; // para que admin.html las pueda listar más adelante

/** Noches ya pagadas, en el mismo formato que Precios.construirOcupadas(). */
async function nochesPagadas() {
  if (!hayRedis()) return { alta: new Set(), baja: new Set() };
  const r = redis();
  const [alta, baja] = await Promise.all([
    r.smembers(CLAVE_NOCHES('alta')),
    r.smembers(CLAVE_NOCHES('baja'))
  ]);
  return { alta: new Set(alta || []), baja: new Set(baja || []) };
}

/**
 * Marca las noches de una reserva pagada como ocupadas y guarda el registro
 * completo (para poder mirarlo después). Es idempotente por `registro.id`:
 * llamarla dos veces con el mismo id no duplica nada.
 */
async function marcarPagada(modalidad, noches, registro) {
  const r = redis();
  const tareas = [];
  for (const planta of modalidad.ocupa) {
    if (noches.length) tareas.push(r.sadd(CLAVE_NOCHES(planta), ...noches));
  }
  tareas.push(r.set(CLAVE_RESERVA(registro.id), JSON.stringify(registro)));
  tareas.push(r.lpush(CLAVE_LISTA_RESERVAS, registro.id));
  await Promise.all(tareas);
}

async function pagoYaProcesado(id) {
  if (!hayRedis()) return false;
  return Boolean(await redis().get(CLAVE_PAGO_VISTO(id)));
}

async function marcarPagoProcesado(id) {
  // 90 días alcanza de sobra para que MP deje de reintentar notificaciones viejas
  await redis().set(CLAVE_PAGO_VISTO(id), '1', { ex: 60 * 60 * 24 * 90 });
}

module.exports = { hayRedis, nochesPagadas, marcarPagada, pagoYaProcesado, marcarPagoProcesado };
