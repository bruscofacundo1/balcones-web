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
    // Si la fila es un video, 'url' es el MP4 y 'thumb' el fotograma de portada.
    await db`ALTER TABLE fotos ADD COLUMN IF NOT EXISTS video text`;
    await db`
      CREATE TABLE IF NOT EXISTS medios (
        clave text PRIMARY KEY,
        valor jsonb NOT NULL,
        actualizado timestamptz NOT NULL DEFAULT now()
      )`;
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
      thumb: f.thumb || undefined,
      video: f.video || undefined
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

  // Un solo viaje a la base con `unnest`, no 56 INSERT seguidos: en una
  // función con límite de tiempo de ejecución (como un Worker de Cloudflare),
  // 56 vueltas al driver HTTP de Neon podían no terminar a tiempo — pasó de
  // verdad en producción, se cortó en la foto 49 y dejó la tabla a medias
  // (y como ya no estaba vacía, un reintento se negaba a completarla).
  const ids = FOTOS.map(() => nuevoId());
  await db`
    INSERT INTO fotos (id, nombre, categoria, titulo, orden)
    SELECT * FROM unnest(
      ${ids}::text[],
      ${FOTOS.map(f => f.f)}::text[],
      ${FOTOS.map(f => f.c)}::text[],
      ${FOTOS.map(f => f.t)}::text[],
      ${FOTOS.map((_, i) => i)}::int[]
    )`;
  return { ok: true, cantidad: FOTOS.length };
}

async function agregarFoto({ url, thumb, categoria, titulo, video }) {
  const db = cliente();
  await asegurarTabla();
  const ultimo = await db`SELECT coalesce(max(orden), -1) + 1 AS siguiente FROM fotos`;
  const id = nuevoId();
  await db`
    INSERT INTO fotos (id, nombre, url, thumb, categoria, titulo, orden, video)
    VALUES (${id}, null, ${url}, ${thumb}, ${categoria}, ${titulo}, ${ultimo[0].siguiente}, ${video || null})`;
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
  const filas = await db`DELETE FROM fotos WHERE id = ${id} RETURNING url, thumb, video`;
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
  const filas = await db`DELETE FROM fotos RETURNING url, thumb, video`;
  return filas;
}

/** ¿Es una url de nuestro bucket? Sin esto, alguien con la sesión abierta
    podría hacer que el sitio muestre un video de cualquier lado. */
function esUrlDelBucket(url) {
  const base = process.env.FOTOS_PUBLIC_URL;
  return Boolean(base && typeof url === 'string' && url.startsWith(base.replace(/\/$/, '') + '/'));
}

/** Sube en streaming, sin cargar el archivo entero en memoria: un video pesa
    decenas de MB y un Worker tiene 128 MB. El largo tiene que venir conocido. */
async function subirStream(stream, contentType, sufijo) {
  const clave = claveAlAzar(sufijo).replace('fotos/', 'videos/');
  await bucket().put(clave, stream, { httpMetadata: { contentType } });
  return `${urlPublicaBase()}/${clave}`;
}

/* ---- video del hero: una sola fila en `medios`, { url, poster } o nada ---- */

async function leerHeroVideo() {
  if (!hayBaseDatos()) return null;
  try {
    const db = cliente();
    await asegurarTabla();
    const filas = await db`SELECT valor FROM medios WHERE clave = 'heroVideo'`;
    return filas.length ? filas[0].valor : null;
  } catch (err) {
    console.error('fotos/heroVideo:', err);
    return null;   // sin video el hero sigue con sus fotos de siempre
  }
}

/** Guarda el video (o null para sacarlo). Devuelve el anterior, para poder
    borrar sus archivos del bucket. */
async function guardarHeroVideo(valor) {
  const db = cliente();
  await asegurarTabla();
  const antes = await db`SELECT valor FROM medios WHERE clave = 'heroVideo'`;
  if (valor === null) {
    await db`DELETE FROM medios WHERE clave = 'heroVideo'`;
  } else {
    await db`
      INSERT INTO medios (clave, valor, actualizado)
      VALUES ('heroVideo', ${JSON.stringify(valor)}, now())
      ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now()`;
  }
  return antes.length ? antes[0].valor : null;
}

module.exports = {
  leerHeroVideo, guardarHeroVideo, esUrlDelBucket, subirStream,
  hayBaseDatos, haySubidaDeFotos, listarFotos, importarDeConfig,
  agregarFoto, actualizarFoto, borrarFoto, reordenarFotos, vaciarFotos,
  subirArchivo, borrarArchivosPorUrl
};
