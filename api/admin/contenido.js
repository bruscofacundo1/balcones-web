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

const { CONFIG, FAQ, RESENAS } = require('../../js/config.js');
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

      // Las colecciones (FAQ, RESENAS) no viven adentro de CONFIG: son const
      // sueltos de config.js. `leerCamino` no las encuentra, y `aplicar` acá no
      // las toca a propósito — mutar esos arrays los dejaría cambiados para la
      // próxima invocación, porque el módulo queda cacheado entre pedidos.
      // Por eso se resuelven a mano y siempre copiando.
      const base = { FAQ, RESENAS };

      const valores = {};
      for (const camino of Object.keys(campos)) {
        if (campos[camino].tipo === 'coleccion') {
          valores[camino] = guardados[camino]
            || (base[camino] || []).map(x => Object.assign({}, x));
        } else {
          valores[camino] = Contenido.leerCamino(efectivo, camino);
        }
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

    // La cobertura del año cruza las tres temporadas, así que no se puede
    // revisar campo por campo: hay que armar cómo quedaría CONFIG con todo
    // aplicado. Una noche sin temporada se cobra al precio del fallback y una
    // noche en dos temporadas cobra la que esté primera en el array — las dos
    // formas de cobrar mal sin que nadie se entere.
    if (Object.keys(limpios).some(c => c.endsWith('.rangos'))) {
      const yaGuardados = await obtenerOverrides();
      const futuro = Contenido.aplicar(
        JSON.parse(JSON.stringify(CONFIG)),
        Object.assign({}, yaGuardados, limpios)
      );
      const cobertura = Contenido.revisarCobertura(futuro);
      if (!cobertura.ok) {
        const partes = [];
        if (cobertura.huecos.length) {
          partes.push(`Quedan ${cobertura.huecos.length} día(s) sin temporada: ${cobertura.huecos.slice(0, 6).join(', ')}${cobertura.huecos.length > 6 ? '…' : ''}.`);
        }
        if (cobertura.choques.length) {
          const c = cobertura.choques[0];
          partes.push(`${cobertura.choques.length} día(s) caen en más de una temporada, por ejemplo el ${c.dia} (${c.temporadas.join(' y ')}).`);
        }
        res.status(400).json({ error: partes.join(' ') + ' No se guardó nada.' });
        return;
      }
    }

    await guardarOverrides(limpios);
    res.status(200).json({ ok: true, guardados: Object.keys(limpios).length });
  } catch (err) {
    console.error('admin/contenido:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
