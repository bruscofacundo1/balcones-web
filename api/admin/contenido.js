/* ============================================================================
   GET/POST /api/admin/contenido
   ----------------------------------------------------------------------------
     GET  -> { campos, valores, guardados }
             `campos`   = qué se puede editar, con tipo y límites
             `valores`  = lo que está rigiendo hoy (config.js + cambios)
             `guardados`= sólo los campos que se cambiaron, para poder marcar
                          en el panel cuáles están pisando al original
     POST -> { cambios: { camino: valor } }, con null para volver al original

   Todo lo que entra se valida contra el mismo catálogo que usa el navegador
   (js/contenido.js). Un camino que no esté en ese catálogo se rechaza: sin
   eso, cualquiera con la sesión abierta podría escribir cualquier rama de
   CONFIG — por ejemplo `modalidades`, que define qué planta ocupa cada
   alquiler y rompería el cálculo de disponibilidad.
   ============================================================================ */

const { CONFIG } = require('../../js/config.js');
const Contenido = require('../../js/contenido.js');
const { exigirSesion } = require('../../lib/sesion.js');
const {
  hayBaseDatos, obtenerOverrides, guardarOverrides
} = require('../../lib/contenido.js');

module.exports = async (req, res) => {
  if (!exigirSesion(req, res)) return;

  if (!hayBaseDatos()) {
    res.status(503).json({ error: 'No hay base de datos configurada (DATABASE_URL).' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const guardados = await obtenerOverrides();
      const efectivo = Contenido.aplicar(JSON.parse(JSON.stringify(CONFIG)), guardados);
      const campos = Contenido.catalogo(CONFIG);

      const valores = {};
      for (const camino of Object.keys(campos)) {
        valores[camino] = Contenido.leerCamino(efectivo, camino);
      }
      res.status(200).json({ campos, valores, guardados });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido.' });
      return;
    }

    const cambios = (req.body || {}).cambios || {};
    const limpios = {};
    const errores = [];

    for (const camino of Object.keys(cambios)) {
      if (cambios[camino] === null) { limpios[camino] = null; continue; }
      const r = Contenido.validar(camino, cambios[camino], CONFIG);
      if (r.ok) limpios[camino] = r.valor;
      else errores.push(r.error);
    }

    // Todo o nada: si algo no pasa la validación no se guarda nada, para no
    // dejar la mitad de un formulario aplicada y la otra mitad no.
    if (errores.length) {
      res.status(400).json({ error: errores.join(' ') });
      return;
    }

    await guardarOverrides(limpios);
    res.status(200).json({ ok: true, guardados: Object.keys(limpios).length });
  } catch (err) {
    console.error('admin/contenido:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
