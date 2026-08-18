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

   Cuatro tablas, creadas solas la primera vez que hace falta (`asegurarTablas`):
     ocupadas(planta, noche, reserva_id) — una fila por noche ocupada, por planta
     reservas(id, ...)        — un registro por reserva (con `origen` y
                                 `estado`, ver más abajo)
     pagos_vistos(id)         — qué notificaciones de pago ya se procesaron
     intentos_login(ip, ...)  — para frenar el que prueba contraseñas a lo bruto
   ============================================================================ */

const { neon } = require('@neondatabase/serverless');
const Precios = require('../js/precios.js');
const { CONFIG } = require('../js/config.js');

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
    // Cuánto entró de plata y las notas que escribe Naty desde el panel.
    await db`ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pagado numeric NOT NULL DEFAULT 0`;
    await db`ALTER TABLE reservas ADD COLUMN IF NOT EXISTS nota text`;
    // De qué reserva es cada noche ocupada. Sin esto, dar de baja una reserva
    // borraba las noches por (planta, noche) a ciegas: si por una carrera dos
    // reservas se habían quedado con la misma noche, cancelar una liberaba la
    // fecha de la otra. Las filas viejas quedan en NULL y se siguen borrando
    // por el camino de antes (ver cancelarReserva).
    await db`ALTER TABLE ocupadas ADD COLUMN IF NOT EXISTS reserva_id text`;
    await db`
      CREATE TABLE IF NOT EXISTS pagos_vistos (
        id       text PRIMARY KEY,
        visto_en timestamptz NOT NULL DEFAULT now()
      )`;
    await db`
      CREATE TABLE IF NOT EXISTS intentos_login (
        id      bigserial PRIMARY KEY,
        ip      text,
        momento timestamptz NOT NULL DEFAULT now()
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
 * Las noches ocupadas para el calendario del sitio.
 *
 * Distinta de `nochesPagadas()` en dos cosas, y las dos importan:
 *
 * - **Devuelve arrays, no Sets**, porque esto viaja en JSON.
 * - **Sólo de hoy en adelante.** El pasado no se puede reservar, y `ocupadas`
 *   no se limpia nunca: mandar el histórico entero sería peso que crece para
 *   siempre en un pedido que hace cada visitante.
 *
 * No expone nada privado: qué noches están libres es justamente lo que un
 * sitio de alojamiento muestra. No van ni nombres ni teléfonos.
 */
async function nochesOcupadasPublicas() {
  if (!hayBaseDatos()) return null;
  const db = cliente();
  await asegurarTablas();
  // -1 día de colchón para no depender de la zona horaria del servidor.
  const filas = await db`SELECT planta, noche FROM ocupadas WHERE noche >= current_date - 1`;
  const salida = { alta: [], baja: [] };
  for (const f of filas) {
    if (salida[f.planta]) salida[f.planta].push(fechaAIso(f.noche));
  }
  salida.alta.sort();
  salida.baja.sort();
  return salida;
}

/**
 * Bloquea las noches de una reserva y guarda el registro completo.
 *
 * Toma las noches de una sola vez y mira cuántas volvió a insertar de verdad:
 * si alguna ya estaba tomada, Postgres no la devuelve y ahí se sabe que hubo
 * un choque. Antes esto pasaba en silencio (`ON CONFLICT DO NOTHING` sin
 * mirar el resultado) y quedaba una sobreventa que nadie veía.
 *
 * `forzar` = true guarda igual aunque haya choque. Se usa SOLO cuando el
 * huésped ya pagó: la plata no se puede "des-cobrar", así que la reserva se
 * registra igual y el panel de admin la muestra marcada como superpuesta.
 *
 * Devuelve { ok, conflictos: ['AAAA-MM-DD', ...] }.
 * Es idempotente por `registro.id`: llamarla dos veces no duplica nada.
 */
async function guardarReserva(modalidad, noches, registro, forzar = false) {
  const db = cliente();
  await asegurarTablas();

  // Una fila por (planta, noche): las tres listas van en paralelo y se
  // expanden con UNNEST, así es un solo viaje a la base en vez de uno por
  // noche y por planta.
  const plantas = [];
  const fechas = [];
  const ids = [];
  for (const planta of modalidad.ocupa) {
    for (const noche of noches) {
      plantas.push(planta);
      fechas.push(noche);
      ids.push(registro.id);
    }
  }

  const puestas = await db`
    INSERT INTO ocupadas (planta, noche, reserva_id)
    SELECT * FROM UNNEST(${plantas}::text[], ${fechas}::date[], ${ids}::text[])
    ON CONFLICT (planta, noche) DO NOTHING
    RETURNING noche`;

  if (puestas.length < plantas.length) {
    const logradas = new Set(puestas.map(f => fechaAIso(f.noche)));
    const conflictos = [...new Set(noches.filter(n => !logradas.has(n)))].sort();

    if (!forzar) {
      // Deshacer lo que sí entró: la reserva no se concreta, así que no puede
      // quedar bloqueando noches sueltas.
      await db`DELETE FROM ocupadas WHERE reserva_id = ${registro.id}`;
      return { ok: false, conflictos };
    }

    await db`
      INSERT INTO reservas (id, pago_id, modalidad, entrada, salida, huespedes, total, sena, datos, origen, estado, creado)
      VALUES (${registro.id}, ${registro.pagoId ? String(registro.pagoId) : null}, ${registro.modalidad},
              ${registro.entrada}, ${registro.salida}, ${registro.huespedes},
              ${registro.total}, ${registro.sena}, ${JSON.stringify(registro.datos || {})},
              ${registro.origen}, ${registro.estado}, ${registro.creado})
      ON CONFLICT (id) DO NOTHING`;
    return { ok: true, conflictos };
  }

  await db`
    INSERT INTO reservas (id, pago_id, modalidad, entrada, salida, huespedes, total, sena, datos, origen, estado, creado)
    VALUES (${registro.id}, ${registro.pagoId ? String(registro.pagoId) : null}, ${registro.modalidad},
            ${registro.entrada}, ${registro.salida}, ${registro.huespedes},
            ${registro.total}, ${registro.sena}, ${JSON.stringify(registro.datos || {})},
            ${registro.origen}, ${registro.estado}, ${registro.creado})
    ON CONFLICT (id) DO NOTHING`;
  return { ok: true, conflictos: [] };
}

/** La seña se acreditó con Mercado Pago: queda confirmada de una.
    Va con `forzar`: el huésped ya pagó, no hay vuelta atrás posible. */
function marcarPagada(modalidad, noches, registro) {
  return guardarReserva(modalidad, noches, { ...registro, origen: 'mercadopago', estado: 'confirmada' }, true);
}

/** Alguien mandó el WhatsApp de reserva: bloquea la fecha, pero queda
    pendiente hasta que Naty confirme que le llegó la seña. */
function marcarPendienteWhatsapp(modalidad, noches, registro) {
  return guardarReserva(modalidad, noches, { ...registro, origen: 'whatsapp', estado: 'pendiente' });
}

/**
 * Reserva cargada a mano desde el panel: alguien llamó por teléfono, escribió
 * por WhatsApp o vino en persona. También sirve para bloquear fechas sin
 * huésped (mantenimiento, uso de la familia) con origen 'bloqueo'.
 */
function crearReservaManual(modalidad, noches, registro, forzar = false) {
  return guardarReserva(modalidad, noches, {
    ...registro,
    origen: registro.origen || 'manual',
    estado: registro.estado || 'confirmada'
  }, forzar);
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
  return listarReservas({ incluirCanceladas: false });
}

/**
 * Listado para el panel. Ordena por fecha de entrada (no por cuándo se cargó):
 * lo que Naty necesita ver primero es lo que está por llegar.
 */
async function listarReservas({ incluirCanceladas = false } = {}) {
  const db = cliente();
  await asegurarTablas();
  const filas = incluirCanceladas
    ? await db`SELECT * FROM reservas ORDER BY entrada DESC`
    : await db`SELECT * FROM reservas WHERE estado != 'cancelada' ORDER BY entrada DESC`;
  return filas.map(f => ({
    ...f,
    entrada: fechaAIso(f.entrada),
    salida: fechaAIso(f.salida),
    total: f.total === null ? null : Number(f.total),
    sena: f.sena === null ? null : Number(f.sena),
    pagado: Number(f.pagado || 0)
  }));
}

/** Cambia lo que Naty puede editar de una reserva ya cargada. */
async function actualizarReserva(id, campos) {
  const db = cliente();
  await asegurarTablas();
  const actual = await obtenerReserva(id);
  if (!actual) return false;

  const datos = { ...(actual.datos || {}), ...(campos.datos || {}) };
  const filas = await db`
    UPDATE reservas SET
      pagado = ${campos.pagado === undefined ? actual.pagado || 0 : campos.pagado},
      nota   = ${campos.nota === undefined ? actual.nota : campos.nota},
      total  = ${campos.total === undefined ? actual.total : campos.total},
      sena   = ${campos.sena === undefined ? actual.sena : campos.sena},
      datos  = ${JSON.stringify(datos)}
    WHERE id = ${id} RETURNING id`;
  return filas.length > 0;
}

async function obtenerReserva(id) {
  const db = cliente();
  await asegurarTablas();
  const filas = await db`SELECT * FROM reservas WHERE id = ${id}`;
  if (!filas.length) return null;
  return { ...filas[0], entrada: fechaAIso(filas[0].entrada), salida: fechaAIso(filas[0].salida) };
}

/**
 * Vuelve a marcar las noches que OTRA reserva activa todavía reclama.
 *
 * Hace falta porque en `ocupadas` cada noche tiene un solo dueño (la clave es
 * planta+noche, que es justamente lo que impide sobrevender). Cuando se fuerza
 * una reserva superpuesta —un pago de Mercado Pago que entró igual, o un
 * bloqueo que el admin cargó a propósito— esa segunda reserva queda anotada en
 * `reservas` pero sus noches en conflicto siguen figurando a nombre de la
 * primera. Si después se cancela la primera y nadie repara esto, las noches
 * quedan libres para el sitio público aunque la segunda siga en pie.
 */
async function reasegurarNoches(db, cancelada) {
  const otras = await db`
    SELECT id, modalidad, entrada, salida FROM reservas
    WHERE estado != 'cancelada' AND id != ${cancelada.id}
      AND entrada < ${cancelada.salida} AND salida > ${cancelada.entrada}`;
  if (!otras.length) return;

  const plantas = [];
  const fechas = [];
  const ids = [];
  for (const o of otras) {
    const modalidad = Precios.modalidadPorId(o.modalidad, CONFIG);
    if (!modalidad) continue;
    for (const planta of modalidad.ocupa) {
      for (const noche of Precios.nochesLista(fechaAIso(o.entrada), fechaAIso(o.salida))) {
        plantas.push(planta);
        fechas.push(noche);
        ids.push(o.id);
      }
    }
  }
  if (!plantas.length) return;

  await db`
    INSERT INTO ocupadas (planta, noche, reserva_id)
    SELECT * FROM UNNEST(${plantas}::text[], ${fechas}::date[], ${ids}::text[])
    ON CONFLICT (planta, noche) DO NOTHING`;
}

/** Da de baja una reserva: libera sus noches en `ocupadas` y la marca cancelada. */
async function cancelarReserva(id, modalidad) {
  const db = cliente();
  await asegurarTablas();
  const reserva = await obtenerReserva(id);
  if (!reserva || reserva.estado === 'cancelada') return false;

  // Camino nuevo: borra exactamente las noches de ESTA reserva.
  const borradas = await db`DELETE FROM ocupadas WHERE reserva_id = ${id} RETURNING noche`;

  // Camino viejo, para las reservas que se guardaron antes de que `ocupadas`
  // tuviera reserva_id: ahí no queda más remedio que borrar por (planta, noche).
  if (!borradas.length) {
    const noches = Precios.nochesLista(reserva.entrada, reserva.salida);
    for (const planta of modalidad.ocupa) {
      for (const noche of noches) {
        await db`DELETE FROM ocupadas WHERE planta = ${planta} AND noche = ${noche} AND reserva_id IS NULL`;
      }
    }
  }

  await db`UPDATE reservas SET estado = 'cancelada' WHERE id = ${id}`;
  await reasegurarNoches(db, reserva);
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

/* ------------------------------------------------ freno de fuerza bruta -- */

/** Cuántos intentos fallados de login lleva esa IP en los últimos 15 minutos. */
async function intentosRecientes(ip) {
  if (!hayBaseDatos()) return 0;
  const db = cliente();
  await asegurarTablas();
  const filas = await db`
    SELECT count(*)::int AS n FROM intentos_login
    WHERE ip = ${ip} AND momento > now() - interval '15 minutes'`;
  return filas[0] ? filas[0].n : 0;
}

async function anotarIntentoFallado(ip) {
  if (!hayBaseDatos()) return;
  const db = cliente();
  await asegurarTablas();
  await db`INSERT INTO intentos_login (ip) VALUES (${ip})`;
  // Aprovecha el viaje para limpiar lo viejo y que la tabla no crezca sola.
  await db`DELETE FROM intentos_login WHERE momento < now() - interval '1 day'`;
}

/** Login exitoso: se borra el historial de esa IP para no dejarla penalizada. */
async function limpiarIntentos(ip) {
  if (!hayBaseDatos()) return;
  const db = cliente();
  await asegurarTablas();
  await db`DELETE FROM intentos_login WHERE ip = ${ip}`;
}

module.exports = {
  hayBaseDatos, nochesPagadas, nochesOcupadasPublicas,
  marcarPagada, marcarPendienteWhatsapp,
  crearReservaManual, pagoYaProcesado, marcarPagoProcesado,
  listarReservasActivas, listarReservas, obtenerReserva,
  cancelarReserva, confirmarReserva, actualizarReserva,
  intentosRecientes, anotarIntentoFallado, limpiarIntentos
};
