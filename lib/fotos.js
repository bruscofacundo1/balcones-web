/* ============================================================================
   Balcones del Arroyo — galería editable (lado servidor)
   ----------------------------------------------------------------------------
   Las fotos que vienen con el sitio están en `img/` y listadas en `FOTOS`
   (config.js). Eso sigue siendo el arranque: mientras la tabla `fotos` esté
   vacía, la galería es exactamente la de siempre.

   Cuando desde el panel se importa la galería, cada foto de config.js pasa a
   ser una fila —apuntando al MISMO archivo de `img/`, sin copiar nada— y a
   partir de ahí manda la base: se pueden sumar fotos nuevas, sacar, reordenar
   y cambiarles el epígrafe. Vaciar la tabla vuelve todo a config.js.

   Los archivos nuevos van a Cloudflare R2, no a `img/`: el servidor no puede
   escribir en su propio código. El navegador los achica ANTES de subirlos
   (ver admin.html), así que acá llegan ya en tamaño web.

   R2 se usa por su binding nativo (`env.FOTOS_BUCKET`, ver lib/adaptador-cf.js
   y wrangler.toml), no por la API compatible con S3 — así no hace falta
   ninguna librería aparte para subir/borrar. Lo único que el binding no da
   es una URL pública: para eso hace falta conectar un dominio propio al
   bucket desde el panel de Cloudflare (R2 → el bucket → Settings → Public
   access → Custom domain) y cargar esa URL en FOTOS_PUBLIC_URL.
   ============================================================================ */

const { neon } = require('@neondatabase/serverless');

function hayBaseDatos() {
  return Boolean(process.env.DATABASE_URL);
}

function bucket() {
  const env = globalThis.__CF_ENV__;
  const b = env && env.FOTOS_BUCKET;
  if (!b) {
    throw new Error(
      'Falta el binding FOTOS_BUCKET: conectá un bucket de R2 al proyecto ' +
      '(Cloudflare Pages → el proyecto → Settings → Functions → R2 bucket bindings).'
    );
  }
  return b;
}

function urlPublicaBase() {
  const base = process.env.FOTOS_PUBLIC_URL;
  if (!base) {
    throw new Error(
      'Falta la variable FOTOS_PUBLIC_URL: el dominio público del bucket de R2 ' +
      '(R2 → el bucket → Settings → Public access → Custom domain o r2.dev).'
    );
  }
  return base.replace(/\/$/, '');
}

/** ¿Está todo conectado para poder subir fotos nuevas? Reordenar, editar
    epígrafes y sacar fotos funciona igual sin esto: sólo lo necesita subir. */
function haySubidaDeFotos() {
  return Boolean(
    globalThis.__CF_ENV__ && globalThis.__CF_ENV__.FOTOS_BUCKET && process.env.FOTOS_PUBLIC_URL
  );
}

function claveAlAzar(sufijo) {
  return `fotos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${sufijo}`;
}

/** Sube un archivo a R2 y devuelve su URL pública. */
async function subirArchivo(buffer, contentType, sufijo) {
  const clave = claveAlAzar(sufijo);
  await bucket().put(clave, buffer, { httpMetadata: { contentType } });
  return `${urlPublicaBase()}/${clave}`;
}

/** Saca archivos de R2 a partir de sus URLs públicas. Que falle no es grave:
    la foto ya no se muestra, sólo queda ocupando lugar en el bucket. */
async function borrarArchivosPorUrl(urls) {
  if (!globalThis.__CF_ENV__ || !globalThis.__CF_ENV__.FOTOS_BUCKET || !process.env.FOTOS_PUBLIC_URL) return;
  const prefijo = `${urlPublicaBase()}/`;
  const claves = urls.filter(u => u && u.startsWith(prefijo)).map(u => u.slice(prefijo.length));
  if (!claves.length) return;
  try {
    await globalThis.__CF_ENV__.FOTOS_BUCKET.delete(claves);
  } catch (err) {
    console.error('fotos/borrar archivo:', err);
  }
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
  tablaLista = (async () => {
    await db`
      CREATE TABLE IF NOT EXISTS fotos (
        id        text PRIMARY KEY,
        nombre    text,
        url       text,
        thumb     text,
        categoria text NOT NULL,
        titulo    text NOT NULL,
        orden     integer NOT NULL DEFAULT 0,
        creado    timestamptz NOT NULL DEFAULT now()
      )`;
    // 'nombre' es para las que viven en img/ (las de siempre); 'url' para las
    // que se subieron. Cada fila tiene una de las dos, nunca ninguna.
    await db`CREATE INDEX IF NOT EXISTS fotos_orden ON fotos (orden)`;
  })();
  return tablaLista;
}

/**
 * La galería tal como la tiene que ver el sitio, en el mismo formato que
 * `FOTOS` de config.js ({ f, c, t }) más las urls cuando la foto se subió.
 * Devuelve [] si nadie importó nada todavía: ahí manda config.js.
 */
async function listarFotos() {
  if (!hayBaseDatos()) return [];
  try {
    const db = cliente();
    await asegurarTabla();
    const filas = await db`SELECT * FROM fotos ORDER BY orden, creado`;
    return filas.map(f => ({
      id: f.id,
      f: f.nombre || f.url,
      c: f.categoria,
      t: f.titulo,
      url: f.url || undefined,
      thumb: f.thumb || undefined
    }));
  } catch (err) {
    // Igual que con el resto del contenido: que la base falle no puede dejar
    // el sitio sin galería. Se cae a la de config.js.
    console.error('fotos/listar:', err);
    return [];
  }
}

function nuevoId() {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Copia la galería de config.js a la base, respetando el orden actual. */
async function importarDeConfig(FOTOS) {
  const db = cliente();
  await asegurarTabla();
  const existentes = await db`SELECT count(*)::int AS n FROM fotos`;
  if (existentes[0].n > 0) return { ok: false, error: 'La galería ya está importada.' };

  let orden = 0;
  for (const foto of FOTOS) {
    await db`
      INSERT INTO fotos (id, nombre, url, thumb, categoria, titulo, orden)
      VALUES (${nuevoId()}, ${foto.f}, null, null, ${foto.c}, ${foto.t}, ${orden++})`;
  }
  return { ok: true, cantidad: FOTOS.length };
}

async function agregarFoto({ url, thumb, categoria, titulo }) {
  const db = cliente();
  await asegurarTabla();
  const ultimo = await db`SELECT coalesce(max(orden), -1) + 1 AS siguiente FROM fotos`;
  const id = nuevoId();
  await db`
    INSERT INTO fotos (id, nombre, url, thumb, categoria, titulo, orden)
    VALUES (${id}, null, ${url}, ${thumb}, ${categoria}, ${titulo}, ${ultimo[0].siguiente})`;
  return id;
}

async function actualizarFoto(id, { categoria, titulo }) {
  const db = cliente();
  await asegurarTabla();
  const filas = await db`
    UPDATE fotos SET
      categoria = coalesce(${categoria || null}, categoria),
      titulo    = coalesce(${titulo || null}, titulo)
    WHERE id = ${id} RETURNING id`;
  return filas.length > 0;
}

/** Borra la fila. Devuelve las urls para poder limpiar también el archivo. */
async function borrarFoto(id) {
  const db = cliente();
  await asegurarTabla();
  const filas = await db`DELETE FROM fotos WHERE id = ${id} RETURNING url, thumb`;
  return filas.length ? filas[0] : null;
}

/** Reordena por la lista completa de ids, en el orden que quedó en el panel. */
async function reordenarFotos(ids) {
  const db = cliente();
  await asegurarTabla();
  for (let i = 0; i < ids.length; i++) {
    await db`UPDATE fotos SET orden = ${i} WHERE id = ${ids[i]}`;
  }
}

async function vaciarFotos() {
  const db = cliente();
  await asegurarTabla();
  const filas = await db`DELETE FROM fotos RETURNING url, thumb`;
  return filas;
}

module.exports = {
  hayBaseDatos, haySubidaDeFotos, listarFotos, importarDeConfig,
  agregarFoto, actualizarFoto, borrarFoto, reordenarFotos, vaciarFotos,
  subirArchivo, borrarArchivosPorUrl
};
