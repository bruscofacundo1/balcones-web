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
   los bytes crudos, pero como el navegador ya la redujo a tamaño web queda
   MUY por debajo del límite de 4,5 MB que tiene el cuerpo de un pedido en
   Vercel, y a cambio no hace falta parsear multipart a mano.
   ============================================================================ */

const { FOTOS } = require('../../js/config.js');
const { exigirSesion } = require('../../lib/sesion.js');
const {
  hayBaseDatos, haySubidaDeFotos, listarFotos, importarDeConfig,
  agregarFoto, actualizarFoto, borrarFoto, reordenarFotos, vaciarFotos
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
      error: 'Falta conectar el almacenamiento de fotos. En Vercel: Storage → ' +
             'Create Database → Blob, y volvé a desplegar el sitio.'
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

  // El nombre lleva un sufijo al azar (`addRandomSuffix`) para que subir dos
  // veces un archivo que se llama igual no pise al anterior.
  const { put } = require('@vercel/blob');
  const base = `fotos/${Date.now()}`;
  const [puestaGrande, puestaChica] = await Promise.all([
    put(`${base}.jpg`, grande.buffer, {
      access: 'public', contentType: grande.tipo, addRandomSuffix: true
    }),
    put(`${base}-chica.jpg`, chica.buffer, {
      access: 'public', contentType: chica.tipo, addRandomSuffix: true
    })
  ]);

  const id = await agregarFoto({
    url: puestaGrande.url, thumb: puestaChica.url, categoria, titulo
  });
  res.status(200).json({ ok: true, id, url: puestaGrande.url });
}

/** Saca los archivos de Blob. Que falle no es grave: la foto ya no se muestra,
    sólo queda ocupando lugar. Por eso no se corta la operación por esto. */
async function borrarArchivos(urls) {
  const limpias = urls.filter(u => u && /^https?:/.test(u));
  if (!limpias.length || !haySubidaDeFotos()) return;
  try {
    const { del } = require('@vercel/blob');
    await del(limpias);
  } catch (err) {
    console.error('fotos/borrar archivo:', err);
  }
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

    if (accion === 'editar') {
      const b = req.body || {};
      const categoria = b.categoria && CATEGORIAS.includes(b.categoria) ? b.categoria : null;
      res.status(200).json({ ok: await actualizarFoto(id, { categoria, titulo: limpiar(b.titulo, 120) }) });
      return;
    }

    if (accion === 'borrar') {
      const fila = await borrarFoto(id);
      if (!fila) { res.status(404).json({ error: 'No existe esa foto.' }); return; }
      await borrarArchivos([fila.url, fila.thumb]);
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
      await borrarArchivos(filas.flatMap(f => [f.url, f.thumb]));
      res.status(200).json({ ok: true, borradas: filas.length });
      return;
    }

    res.status(400).json({ error: 'Acción desconocida.' });
  } catch (err) {
    console.error('admin/fotos:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
