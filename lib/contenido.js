/* ============================================================================
   Balcones del Arroyo — contenido editable (lado servidor)
   ----------------------------------------------------------------------------
   Guarda y lee la tabla `contenido`: una fila por campo editado, con el
   camino dentro de CONFIG como clave ('temporadas.alta.precios.completa').
   Sólo se guarda lo que se cambió; lo que no está en la tabla sale de
   config.js.

   `configEfectivo()` es lo que tienen que usar TODAS las funciones que
   cotizan o cobran. Si una usara el CONFIG crudo, el servidor calcularía con
   los precios viejos mientras el visitante ve los nuevos — que es exactamente
   la clase de desfasaje que este sitio evita teniendo una sola fuente de
   precios (ver js/precios.js).
   ============================================================================ */

const { neon } = require('@neondatabase/serverless');
const { CONFIG } = require('../js/config.js');
const Contenido = require('../js/contenido.js');

function hayBaseDatos() {
  return Boolean(process.env.DATABASE_URL);
}

let sql = null;
function cliente() {
  if (sql) return sql;
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  sql = neon(process.env.DATABASE_URL);
  return sql;
}

let tablaLista = null;
async function asegurarTabla() {
  if (tablaLista) return tablaLista;
  const db = cliente();
  tablaLista = db`
    CREATE TABLE IF NOT EXISTS contenido (
      clave       text PRIMARY KEY,
      valor       jsonb NOT NULL,
      actualizado timestamptz NOT NULL DEFAULT now()
    )`;
  return tablaLista;
}

/** Los cambios guardados, como { camino: valor }. */
async function obtenerOverrides() {
  if (!hayBaseDatos()) return {};
  try {
    const db = cliente();
    await asegurarTabla();
    const filas = await db`SELECT clave, valor FROM contenido`;
    const overrides = {};
    for (const f of filas) overrides[f.clave] = f.valor;
    return overrides;
  } catch (err) {
    // Que la base falle no puede tumbar el sitio ni impedir una reserva: se
    // sigue con los valores de config.js, que son válidos aunque estén viejos.
    console.error('contenido/obtener:', err);
    return {};
  }
}

/**
 * CONFIG con los cambios del panel aplicados encima.
 *
 * Devuelve una copia, no el CONFIG compartido: en una función serverless el
 * módulo queda cacheado entre invocaciones, así que mutar el original haría
 * que los cambios de un pedido se filtraran al siguiente.
 */
async function configEfectivo() {
  const copia = JSON.parse(JSON.stringify(CONFIG));
  return Contenido.aplicar(copia, await obtenerOverrides());
}

/** Guarda un lote de cambios ya validados. Un valor null borra el campo, que
    equivale a volver a lo que dice config.js. */
async function guardarOverrides(cambios) {
  const db = cliente();
  await asegurarTabla();
  for (const clave of Object.keys(cambios)) {
    const valor = cambios[clave];
    if (valor === null) {
      await db`DELETE FROM contenido WHERE clave = ${clave}`;
    } else {
      await db`
        INSERT INTO contenido (clave, valor, actualizado)
        VALUES (${clave}, ${JSON.stringify(valor)}, now())
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now()`;
    }
  }
}

module.exports = { hayBaseDatos, obtenerOverrides, configEfectivo, guardarOverrides };
