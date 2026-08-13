/* ============================================================================
   Balcones del Arroyo — disponibilidad "en vivo" (server-side)
   ----------------------------------------------------------------------------
   disponibilidad.js es la base: las noches que vos marcaste a mano con
   admin.html. Acá arriba se guardan, aparte, las noches que se bloquearon
   online — ya sea porque se pagó con Mercado Pago, o porque alguien mandó el
   WhatsApp de reserva (variante 'a' de "Cómo se paga", ver checkout.js) — así
   una reserva no depende de que alguien actualice el archivo a tiempo.

   Usa Postgres (Neon). El driver `@neondatabase/serverless` habla por HTTP en
   vez de mantener una conexión TCP abierta, que es lo que conviene en una
   función serverless: cada invocación es corta y puede morir en cualquier
   momento, y una conexión TCP tradicional se puede quedar abierta de más o
   agotar el pool de la base con poco tráfico.

   Tres tablas, creadas solas la primera vez que hace falta (`asegurarTablas`):
     ocupadas(planta, noche)  — una fila por noche ocupada, por planta
     reservas(id, ...)        — un registro por reserva (con `origen` y
                                 `estado`, ver más abajo)
     pagos_vistos(id)         — qué notificaciones de pago ya se procesaron
   ============================================================================ */

const { neon } = require('@neondatabase/serverless');
const Precios = require('../js/precios.js');

function hayBaseDatos() {
  return Boolean(process.env.DATABASE_URL);
}

let sql = null;
function cliente() {
  if (sql) return sql;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta conectar la base de disponibilidad: cargá DATABASE_URL (el ' +
      'connection string de Neon) en las variables de entorno del proyecto.'
    );
  }
  sql = neon(process.env.DATABASE_URL);
  return sql;
}

let tablasListas = null;
async function asegurarTablas() {
  if (tablasListas) return tablasListas;
  const db = cliente();
  tablasListas = (async () => {
    await db`
      CREATE TABLE IF NOT EXISTS ocupadas (
        planta text NOT NULL,
        noche  date NOT NULL,
        PRIMARY KEY (planta, noche)
      )`;
    await db`
      CREATE TABLE IF NOT EXISTS reservas (
        id         text PRIMARY KEY,
        pago_id    text,
        modalidad  text NOT NULL,
        entrada    date NOT NULL,
        salida     date NOT NULL,
        huespedes  integer,
        total      numeric,
        sena       numeric,
        datos      jsonb,
        creado     timestamptz NOT NULL DEFAULT now()
      )`;
    // 'origen': 'mercadopago' | 'whatsapp' — de dónde vino la reserva.
    // 'estado': 'confirmada' (Mercado Pago la acredita sola) | 'pendiente'
    //   (WhatsApp: bloqueó la fecha, pero todavía no se sabe si le pagaron a
    //   Naty) | 'cancelada' (se dio de baja, la fecha ya está libre de nuevo).
    // ADD COLUMN IF NOT EXISTS porque la tabla `reservas` ya existía de antes
    // de que estas dos columnas se agregaran.
    await db`ALTER TABLE reservas ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'mercadopago'`;
    await db`ALTER TABLE reservas ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'confirmada'`;
    await db`
      CREATE TABLE IF NOT EXISTS pagos_vistos (
        id       text PRIMARY KEY,
        visto_en timestamptz NOT NULL DEFAULT now()
      )`;
  })();
  return tablasListas;
}

/** Postgres devuelve las fechas como Date; esto las vuelve a 'AAAA-MM-DD'. */
function fechaAIso(fecha) {
  if (typeof fecha === 'string') return fecha.slice(0, 10);
  const d = new Date(fecha);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${dd}`;
}

/** Noches ya bloqueadas (pagadas o pendientes de WhatsApp), en el mismo
    formato que Precios.construirOcupadas(). Una reserva cancelada libera la
    fecha: sus noches ya no están en `ocupadas`, así que no hace falta
    filtrar nada acá. */
async function nochesPagadas() {
  if (!hayBaseDatos()) return { alta: new Set(), baja: new Set() };
  const db = cliente();
  await asegurarTablas();
  const filas = await db`SELECT planta, noche FROM ocupadas`;
  const ocupadas = { alta: new Set(), baja: new Set() };
  for (const f of filas) {
    if (ocupadas[f.planta]) ocupadas[f.planta].add(fechaAIso(f.noche));
  }
  return ocupadas;
}

/**
 * Bloquea las noches de una reserva y guarda el registro completo. Es
 * idempotente por `registro.id` (y por cada `planta, noche`): llamarla dos
 * veces con el mismo id no duplica ni rompe nada.
 */
async function guardarReserva(modalidad, noches, registro) {
  const db = cliente();
  await asegurarTablas();

  for (const planta of modalidad.ocupa) {
    for (const noche of noches) {
      await db`INSERT INTO ocupadas (planta, noche) VALUES (${planta}, ${noche})
                ON CONFLICT (planta, noche) DO NOTHING`;
    }
  }

  await db`
    INSERT INTO reservas (id, pago_id, modalidad, entrada, salida, huespedes, total, sena, datos, origen, estado, creado)
    VALUES (${registro.id}, ${registro.pagoId ? String(registro.pagoId) : null}, ${registro.modalidad},
            ${registro.entrada}, ${registro.salida}, ${registro.huespedes},
            ${registro.total}, ${registro.sena}, ${JSON.stringify(registro.datos || {})},
            ${registro.origen}, ${registro.estado}, ${registro.creado})
    ON CONFLICT (id) DO NOTHING`;
}

/** La seña se acreditó con Mercado Pago: queda confirmada de una. */
function marcarPagada(modalidad, noches, registro) {
  return guardarReserva(modalidad, noches, { ...registro, origen: 'mercadopago', estado: 'confirmada' });
}

/** Alguien mandó el WhatsApp de reserva: bloquea la fecha, pero queda
    pendiente hasta que Naty confirme que le llegó la seña. */
function marcarPendienteWhatsapp(modalidad, noches, registro) {
  return guardarReserva(modalidad, noches, { ...registro, origen: 'whatsapp', estado: 'pendiente' });
}

async function pagoYaProcesado(id) {
  if (!hayBaseDatos()) return false;
  const db = cliente();
  await asegurarTablas();
  const filas = await db`SELECT 1 FROM pagos_vistos WHERE id = ${String(id)}`;
  return filas.length > 0;
}

async function marcarPagoProcesado(id) {
  const db = cliente();
  await asegurarTablas();
  await db`INSERT INTO pagos_vistos (id) VALUES (${String(id)}) ON CONFLICT (id) DO NOTHING`;
}

/* ------------------------------------------------------- panel de admin -- */

/** Todas las reservas activas (pendientes o confirmadas), las más nuevas primero. */
async function listarReservasActivas() {
  const db = cliente();
  await asegurarTablas();
  const filas = await db`
    SELECT id, pago_id, modalidad, entrada, salida, huespedes, total, sena, datos, origen, estado, creado
    FROM reservas WHERE estado != 'cancelada' ORDER BY creado DESC`;
  return filas.map(f => ({
    ...f,
    entrada: fechaAIso(f.entrada),
    salida: fechaAIso(f.salida)
  }));
}

async function obtenerReserva(id) {
  const db = cliente();
  await asegurarTablas();
  const filas = await db`SELECT * FROM reservas WHERE id = ${id}`;
  if (!filas.length) return null;
  return { ...filas[0], entrada: fechaAIso(filas[0].entrada), salida: fechaAIso(filas[0].salida) };
}

/** Da de baja una reserva: libera sus noches en `ocupadas` y la marca cancelada. */
async function cancelarReserva(id, modalidad) {
  const db = cliente();
  await asegurarTablas();
  const reserva = await obtenerReserva(id);
  if (!reserva || reserva.estado === 'cancelada') return false;

  const noches = Precios.nochesLista(reserva.entrada, reserva.salida);
  for (const planta of modalidad.ocupa) {
    for (const noche of noches) {
      await db`DELETE FROM ocupadas WHERE planta = ${planta} AND noche = ${noche}`;
    }
  }
  await db`UPDATE reservas SET estado = 'cancelada' WHERE id = ${id}`;
  return true;
}

/** Naty confirma que le llegó la seña de una reserva pendiente de WhatsApp. */
async function confirmarReserva(id) {
  const db = cliente();
  await asegurarTablas();
  const filas = await db`
    UPDATE reservas SET estado = 'confirmada'
    WHERE id = ${id} AND estado = 'pendiente'
    RETURNING id`;
  return filas.length > 0;
}

module.exports = {
  hayBaseDatos, nochesPagadas, marcarPagada, marcarPendienteWhatsapp,
  pagoYaProcesado, marcarPagoProcesado,
  listarReservasActivas, obtenerReserva, cancelarReserva, confirmarReserva
};
