/* ============================================================================
   POST /api/admin/booking-sync
   ----------------------------------------------------------------------------
   Trae el calendario de Booking.com y bloquea/libera noches acá según lo que
   diga (ver lib/reservas.js, sincronizarBooking(), y lib/booking-ical.js).

   Lo mismo corre solo cada tres horas por el cron del Worker (ver
   worker.js, `scheduled`) — este endpoint es para el botón "Sincronizar
   ahora" del panel, cuando alguien quiere confirmar al toque que una reserva
   nueva de Booking ya bloqueó la fecha acá.

   Protegido por la cookie de sesión: sin eso, cualquiera podría disparar
   pedidos a Booking desde afuera.
   ============================================================================ */

const { exigirSesion } = require('../../lib/sesion.js');
const { sincronizarBooking } = require('../../lib/reservas.js');

module.exports = async (req, res) => {
  if (!exigirSesion(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    const resultado = await sincronizarBooking();
    if (!resultado.ok) {
      res.status(503).json({ error: resultado.error });
      return;
    }
    res.status(200).json(resultado);
  } catch (err) {
    console.error('admin/booking-sync:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
