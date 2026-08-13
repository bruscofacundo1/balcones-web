/* ============================================================================
   Balcones del Arroyo — disponibilidad "en vivo" (server-side)
   ----------------------------------------------------------------------------
   disponibilidad.js es la base: las noches que vos marcaste a mano con
   admin.html. Acá arriba se guardan, aparte, las noches que se pagaron
   online — así una reserva pagada bloquea la fecha sola, sin que dependa de
   que alguien actualice el archivo a tiempo.

   Usa Postgres (Neon). El driver `@neondatabase/serverless` habla por HTTP en
   vez de mantener una conexión TCP abierta, que es lo que conviene en una
   función serverless: cada invocación es corta y puede morir en cualquier
   momento, y una conexión TCP tradicional se puede quedar abierta de más o
   agotar el pool de la base con poco tráfico.

   Tres tablas, creadas solas la primera vez que hace falta (`asegurarTablas`):
     ocupadas(planta, noche)      — una fila por noche ocupada, por planta
     reservas(id, ...)            — un registro por reserva pagada
     pagos_vistos(id)             — qué notificaciones de pago ya se procesaron
   ============================================================================ */

const { neon } = require('@neondatabase/serverless');

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
    await db`
      CREATE TABLE IF NOT EXISTS pagos_vistos (
        id       text PRIMARY KEY,
        visto_en timestamptz NOT NULL DEFAULT now()
      )`;
  })();
  return tablasListas;
}

/** Noches ya pagadas, en el mismo formato que Precios.construirOcupadas(). */
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

/** Postgres devuelve las fechas como Date; esto las vuelve a 'AAAA-MM-DD'. */
function fechaAIso(fecha) {
  if (typeof fecha === 'string') return fecha.slice(0, 10);
  const d = new Date(fecha);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${dd}`;
}

/**
 * Marca las noches de una reserva pagada como ocupadas y guarda el registro
 * completo (para poder mirarlo después). Es idempotente por `registro.id`
 * (y por cada `planta, noche`): llamarla dos veces con el mismo id no
 * duplica ni rompe nada.
 */
async function marcarPagada(modalidad, noches, registro) {
  const db = cliente();
  await asegurarTablas();

  for (const planta of modalidad.ocupa) {
    for (const noche of noches) {
      await db`INSERT INTO ocupadas (planta, noche) VALUES (${planta}, ${noche})
                ON CONFLICT (planta, noche) DO NOTHING`;
    }
  }

  await db`
    INSERT INTO reservas (id, pago_id, modalidad, entrada, salida, huespedes, total, sena, datos, creado)
    VALUES (${registro.id}, ${String(registro.pagoId)}, ${registro.modalidad},
            ${registro.entrada}, ${registro.salida}, ${registro.huespedes},
            ${registro.total}, ${registro.sena}, ${JSON.stringify(registro.datos || {})},
            ${registro.creado})
    ON CONFLICT (id) DO NOTHING`;
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

module.exports = { hayBaseDatos, nochesPagadas, marcarPagada, pagoYaProcesado, marcarPagoProcesado };
