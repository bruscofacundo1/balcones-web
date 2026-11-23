/* ============================================================================
   /api/admin/video
   ----------------------------------------------------------------------------
     PUT  ?tipo=video/mp4   (cuerpo = el archivo crudo)
          -> sube el video a R2 en streaming y devuelve { url }
     POST {accion:'hero', video, poster}  -> lo deja como video de portada
     POST {accion:'quitarHero'}           -> vuelven las fotos de siempre

   El video viaja crudo (no como data URL dentro de un JSON, que pesa un 33%
   más y obligaría a cargarlo entero en memoria) y se pasa directo al bucket.
   Cloudflare acepta cuerpos de hasta 100 MB en el plan gratis; el tope de acá
   es menor para que sobre margen.
   ============================================================================ */

const { exigirSesion } = require('../../lib/sesion.js');
const {
  hayBaseDatos, haySubidaDeFotos, guardarHeroVideo, esUrlDelBucket,
  subirArchivo, subirStream, borrarArchivosPorUrl
} = require('../../lib/fotos.js');

const MAX_VIDEO = 80 * 1024 * 1024;
const EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

async function subirVideo(req, res) {
  if (!haySubidaDeFotos()) {
    res.status(503).json({
      error: 'Falta conectar el bucket de R2 (FOTOS_BUCKET y FOTOS_PUBLIC_URL).'
    });
    return;
  }
  const tipo = String((req.query || {}).tipo || '');
  const largo = Number(req.headers['content-length']);
  const raw = req._raw;
  if (!EXT[tipo] || !raw || !raw.body) {
    res.status(400).json({ error: 'Sólo se aceptan videos MP4, WebM o MOV.' });
    return;
  }
  if (!largo || largo > MAX_VIDEO) {
    res.status(413).json({ error: `El video pesa demasiado: el máximo es ${MAX_VIDEO / 1048576} MB.` });
    return;
  }
  const url = await subirStream(raw.body, tipo, EXT[tipo]);
  res.status(200).json({ ok: true, url });
}

module.exports = async (req, res) => {
  if (!exigirSesion(req, res)) return;
  if (!hayBaseDatos()) {
    res.status(503).json({ error: 'No hay base de datos configurada (DATABASE_URL).' });
    return;
  }

  try {
    if (req.method === 'PUT') { await subirVideo(req, res); return; }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido.' });
      return;
    }
    const body = req.body || {};

    if (body.accion === 'hero') {
      const m = /^data:(image\/jpeg);base64,(.+)$/.exec(String(body.poster || ''));
      const poster = m ? Buffer.from(m[2], 'base64') : null;
      if (!esUrlDelBucket(body.video) || !poster || !poster.length || poster.length > 3 * 1024 * 1024) {
        res.status(400).json({ error: 'El video o su portada no son válidos.' });
        return;
      }
      const urlPoster = await subirArchivo(poster, m[1], '-poster.jpg');
      const antes = await guardarHeroVideo({ url: body.video, poster: urlPoster });
      if (antes) await borrarArchivosPorUrl([antes.url, antes.poster]);
      res.status(200).json({ ok: true });
      return;
    }

    if (body.accion === 'quitarHero') {
      const antes = await guardarHeroVideo(null);
      if (antes) await borrarArchivosPorUrl([antes.url, antes.poster]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Acción desconocida.' });
  } catch (err) {
    console.error('admin/video:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
