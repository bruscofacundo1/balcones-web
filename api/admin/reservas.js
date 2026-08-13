/* ============================================================================
   GET/POST /api/admin/reservas
   ----------------------------------------------------------------------------
   Lo usa el panel nuevo de admin.html: lista las reservas que bloquearon
   fecha en la base (pagadas con Mercado Pago o pendientes de WhatsApp) y
   deja cancelarlas o confirmarlas.

   Protegido con una clave compartida (ADMIN_TOKEN, variable de entorno) — no
   es un login de verdad, es lo mínimo para que la URL no quede abierta a
   cualquiera: sin esa variable cargada en Vercel, el panel de admin.html no
   funciona (falla cerrado, no abierto).
   ============================================================================ */

const { CONFIG } = require('../../js/config.js');
const Precios = require('../../js/precios.js');
const {
  listarReservasActivas, obtenerReserva, cancelarReserva, confirmarReserva
} = require('../../lib/reservas.js');

function autorizado(req) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado) return false;
  const recibido = req.headers['x-admin-token'] || (req.query && req.query.clave);
  return Boolean(recibido) && recibido === esperado;
}

module.exports = async (req, res) => {
  if (!autorizado(req)) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const reservas = await listarReservasActivas();
      res.status(200).json({ reservas });
      return;
    }

    if (req.method === 'POST') {
      const { accion, id } = req.body || {};
      if (!id || !accion) {
        res.status(400).json({ error: 'Faltan datos.' });
        return;
      }

      if (accion === 'cancelar') {
        const reserva = await obtenerReserva(id);
        if (!reserva) { res.status(404).json({ error: 'No existe esa reserva.' }); return; }
        const modalidad = Precios.modalidadPorId(reserva.modalidad, CONFIG);
        const ok = modalidad ? await cancelarReserva(id, modalidad) : false;
        res.status(200).json({ ok });
        return;
      }

      if (accion === 'confirmar') {
        const ok = await confirmarReserva(id);
        res.status(200).json({ ok });
        return;
      }

      res.status(400).json({ error: 'Acción desconocida.' });
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    console.error('admin/reservas:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
