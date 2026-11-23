/* ============================================================================
   GET/POST /api/admin/fotos
   ----------------------------------------------------------------------------
     GET                       -> { fotos, importada, puedeSubir, categorias }
     POST {accion:'importar'}  -> copia la galería de config.js a la base
     POST {accion:'subir'}     -> sube una foto nueva (llega ya achicada)
     POST {accion:'editar'}    -> cambia epígrafe y categoría
     POST {accion:'borrar'}    -> saca una foto
     POST {accion:'ordenar'}   -> guarda el orden completo
     POST {accion:'restaurar'} -> vacía la tabla y vuelve a la de config.js

   La imagen llega como data URL en el JSON. Es un 33% más pesado que mandar
   los bytes crudos, pero como el navegador ya la redujo a tamaño web (ver
   admin.html) el pedido queda liviano igual, y a cambio no hace falta
   parsear multipart a mano.
   ============================================================================ */

const { FOTOS } = require('../../js/config.js');
const { exigirSesion } = require('../../lib/sesion.js');
const {
  hayBaseDatos, haySubidaDeFotos, guardarSecciones, leerHeroVideo, esUrlDelBucket, listarFotos, importarDeConfig,
  agregarFoto, actualizarFoto, borrarFoto, reordenarFotos, vaciarFotos,
  subirArchivo, borrarArchivosPorUrl
} = require('../../lib/fotos.js');

const CATEGORIAS = ['casa', 'interiores', 'aire-libre', 'entorno'];
const MAX_BYTES = 3 * 1024 * 1024;

/** 'data:image/jpeg;base64,....' -> { buffer, tipo }. Null si no sirve. */
function leerDataUrl(texto) {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(texto || ''));
  if (!m) return null;
  const buffer = Buffer.from(m[3], 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) return null;
  return { buffer, tipo: m[1] };
}

function limpiar(texto, max) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replace(/[<>]/g, '').trim().slice(0, max);
}

async function subir(req, res) {
  if (!haySubidaDeFotos()) {
    res.status(503).json({
      error: 'Falta conectar el almacenamiento de fotos. En Cloudflare: creá un ' +
             'bucket de R2, conectalo al proyecto (Settings → Functions → R2 bucket ' +
             'bindings, nombre FOTOS_BUCKET) y cargá FOTOS_PUBLIC_URL con su dominio público.'
    });
    return;
  }

  const b = req.body || {};
  const grande = leerDataUrl(b.imagen);
  const chica = leerDataUrl(b.miniatura);
  if (!grande || !chica) {
    res.status(400).json({ error: 'La imagen no se pudo leer o es demasiado pesada.' });
    return;
  }

  const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : 'casa';
  const titulo = limpiar(b.titulo, 120) || 'Balcones del Arroyo';

  // Cada nombre lleva un sufijo al azar (ver `subirArchivo` en lib/fotos.js)
  // para que subir dos veces un archivo que se llama igual no pise al anterior.
  const [urlGrande, urlChica] = await Promise.all([
    subirArchivo(grande.buffer, grande.tipo, '.jpg'),
    subirArchivo(chica.buffer, chica.tipo, '-chica.jpg')
  ]);

  const id = await agregarFoto({ url: urlGrande, thumb: urlChica, categoria, titulo });
  res.status(200).json({ ok: true, id, url: urlGrande });
}

/** El video ya está en el bucket (lo subió /api/admin/video); acá sólo se
    registra, con su fotograma de portada que sí llega como data URL. */
async function subirVideo(req, res) {
  const b = req.body || {};
  if (!esUrlDelBucket(b.video)) {
    res.status(400).json({ error: 'El video no es válido.' });
    return;
  }
  const portada = leerDataUrl(b.miniatura);
  if (!portada) {
    res.status(400).json({ error: 'No se pudo leer la portada del video.' });
    return;
  }
  const urlPortada = await subirArchivo(portada.buffer, portada.tipo, '-video.jpg');
  const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : 'casa';
  const titulo = limpiar(b.titulo, 120) || 'Balcones del Arroyo';
  const id = await agregarFoto({
    url: b.video, thumb: urlPortada, video: b.video, categoria, titulo
  });
  res.status(200).json({ ok: true, id });
}

module.exports = async (req, res) => {
  if (!exigirSesion(req, res)) return;

  if (!hayBaseDatos()) {
    res.status(503).json({ error: 'No hay base de datos configurada (DATABASE_URL).' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const fotos = await listarFotos();
      res.status(200).json({
        fotos,
        importada: fotos.length > 0,
        puedeSubir: haySubidaDeFotos(),
        puedeSubirVideo: haySubidaDeFotos(),
        heroVideo: await leerHeroVideo(),
        categorias: CATEGORIAS,
        enConfig: FOTOS.length
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido.' });
      return;
    }

    const { accion, id } = req.body || {};

    if (accion === 'importar') {
      res.status(200).json(await importarDeConfig(FOTOS));
      return;
    }

    if (accion === 'subir') { await subir(req, res); return; }
    if (accion === 'secciones') {
      const b = req.body || {};
      const ids = x => Array.isArray(x) ? [...new Set(x.filter(i => typeof i === 'string'))] : null;
      const hero = ids(b.hero), dest = ids(b.dest);
      if (!hero || !dest) { res.status(400).json({ error: 'Faltan las listas.' }); return; }
      if (hero.length > 6) { res.status(400).json({ error: 'La portada admite hasta 6 fotos.' }); return; }
      if (dest.length > 8) { res.status(400).json({ error: 'El inicio admite hasta 8 fotos.' }); return; }
      await guardarSecciones(hero, dest);
      res.status(200).json({ ok: true });
      return;
    }
    if (accion === 'subirVideo') { await subirVideo(req, res); return; }

    if (accion === 'editar') {
      const b = req.body || {};
      const categoria = b.categoria && CATEGORIAS.includes(b.categoria) ? b.categoria : null;
      res.status(200).json({ ok: await actualizarFoto(id, { categoria, titulo: limpiar(b.titulo, 120) }) });
      return;
    }

    if (accion === 'borrar') {
      const fila = await borrarFoto(id);
      if (!fila) { res.status(404).json({ error: 'No existe esa foto.' }); return; }
      await borrarArchivosPorUrl([fila.url, fila.thumb, fila.video]);
      res.status(200).json({ ok: true });
      return;
    }

    if (accion === 'ordenar') {
      const ids = (req.body || {}).ids;
      if (!Array.isArray(ids)) { res.status(400).json({ error: 'Faltan los ids.' }); return; }
      await reordenarFotos(ids);
      res.status(200).json({ ok: true });
      return;
    }

    if (accion === 'restaurar') {
      const filas = await vaciarFotos();
      await borrarArchivosPorUrl(filas.flatMap(f => [f.url, f.thumb, f.video]));
      res.status(200).json({ ok: true, borradas: filas.length });
      return;
    }

    res.status(400).json({ error: 'Acción desconocida.' });
  } catch (err) {
    console.error('admin/fotos:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
