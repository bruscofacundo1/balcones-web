/* ============================================================================
   POST /api/reservar
   ----------------------------------------------------------------------------
   Es el hermano de api/crear-pago.js, pero sin Mercado Pago: lo usa la
   variante 'a' de "Cómo se paga" (WhatsApp) en checkout.js, justo antes de
   abrir el mensaje. Misma revalidación que si fuera a cobrar (modalidad,
   disponibilidad, mínimo de noches) — lo único que no hay acá es un pago.

   La reserva queda con estado 'pendiente': bloquea la fecha ya mismo, pero
   Naty todavía tiene que confirmar a mano que le llegó la seña (o cancelarla
   si no) desde el panel nuevo de admin.html.
   ============================================================================ */

const { DISPONIBILIDAD } = require('../js/disponibilidad.js');
const Precios = require('../js/precios.js');
const {
  nochesPagadas, marcarPendienteWhatsapp, puedeReservar, anotarReserva
} = require('../lib/reservas.js');
const { configEfectivo } = require('../lib/contenido.js');
const { ipDe } = require('../lib/sesion.js');

function idExterno() {
  return `wsp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const body = req.body || {};
  const { reserva, datos } = body;

  if (!reserva || !reserva.modalidad || !reserva.entrada || !reserva.salida) {
    res.status(400).json({ error: 'Faltan los datos de la reserva.' });
    return;
  }

  try {
    // Este endpoint es público y cada llamada bloquea noches de verdad: sin un
    // tope, un bucle deja el año entero reservado y hay que limpiarlo a mano.
    const ip = ipDe(req);
    if (!(await puedeReservar(ip))) {
      res.status(429).json({
        error: 'Recibimos varios pedidos seguidos desde tu conexión. Esperá un rato y volvé a intentar, o escribinos por WhatsApp.'
      });
      return;
    }

    // Con los precios que rigen ahora (config.js + lo editado en el panel),
    // no con los que tenga cacheados el navegador del visitante.
    const CONFIG = await configEfectivo();
    const modalidad = Precios.modalidadPorId(reserva.modalidad, CONFIG);
    if (!modalidad) {
      res.status(400).json({ error: 'Esa modalidad no existe.' });
      return;
    }

    const huespedes = Math.min(Math.max(1, Number(reserva.huespedes) || 2), modalidad.plazas);

    const base = Precios.construirOcupadas(DISPONIBILIDAD);
    const pagadas = await nochesPagadas();
    const ocupadas = Precios.unirOcupadas(base, pagadas);

    if (Precios.hayOcupadasEntre(reserva.entrada, reserva.salida, modalidad, ocupadas)) {
      res.status(409).json({ error: 'Uy, justo se ocupó una de esas fechas. Elegí otras y probá de nuevo.' });
      return;
    }

    const cotizacion = Precios.cotizar(reserva.entrada, reserva.salida, modalidad, CONFIG, huespedes);
    if (cotizacion.noches < cotizacion.minNoches) {
      res.status(400).json({ error: `Para esas fechas el mínimo es de ${cotizacion.minNoches} noches.` });
      return;
    }

    const pctSena = CONFIG.reglas.senaPorcentaje || 30;
    const sena = Math.round(cotizacion.total * pctSena / 100);
    const id = idExterno();
    const noches = Precios.nochesLista(reserva.entrada, reserva.salida);

    const guardado = await marcarPendienteWhatsapp(modalidad, noches, {
      id,
      pagoId: null,
      modalidad: modalidad.id,
      entrada: reserva.entrada,
      salida: reserva.salida,
      huespedes,
      total: cotizacion.total,
      sena,
      datos: datos || {},
      creado: new Date().toISOString()
    });

    // Segundo filtro, ahora sí a prueba de carreras: entre el chequeo de más
    // arriba y este INSERT puede haberse metido otra reserva por las mismas
    // noches. La base es la que decide, y si perdió la carrera no se guarda.
    if (!guardado.ok) {
      res.status(409).json({ error: 'Uy, justo se ocupó una de esas fechas. Elegí otras y probá de nuevo.' });
      return;
    }

    // Se anota recién acá, con la reserva ya hecha: un pedido que rebotó por
    // fecha ocupada o por mínimo de noches no debería gastarle el cupo a
    // alguien que está buscando fechas de buena fe.
    await anotarReserva(ip).catch(e => console.error('anotarReserva:', e));

    res.status(200).json({ ok: true, id, sena, total: cotizacion.total });
  } catch (err) {
    console.error('reservar:', err);
    res.status(500).json({ error: 'No pudimos bloquear la fecha por un problema técnico.' });
  }
};
