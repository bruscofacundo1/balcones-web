/* ============================================================================
   POST /api/crear-pago
   ----------------------------------------------------------------------------
   Acá llega el `formData` que arma el Payment Brick de Mercado Pago en
   checkout.html (token de la tarjeta, medio de pago, cuotas, datos del
   pagador) más la reserva elegida (modalidad, fechas, huéspedes) y los datos
   de contacto del formulario.

   Todo lo que tiene que ver con guita se recalcula acá, ignorando cualquier
   monto que haya viajado desde el navegador:
     1. La modalidad tiene que existir.
     2. Las fechas tienen que seguir libres — cruzando la base de
        disponibilidad.js con lo que ya se pagó online (lib/reservas.js).
     3. El total y la seña salen de precios.js con los datos de config.js.

   Sólo si Mercado Pago aprueba el pago se bloquean las noches. Si no
   aprueba (rechazado, en proceso, etc.) no se toca la disponibilidad.
   ============================================================================ */

const { CONFIG } = require('../js/config.js');
const { DISPONIBILIDAD } = require('../js/disponibilidad.js');
const Precios = require('../js/precios.js');
const { clientePago } = require('../lib/mercadopago.js');
const { nochesPagadas, marcarPagada } = require('../lib/reservas.js');

function origenDe(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function idExterno() {
  return `bda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const body = req.body || {};
  const { token, payment_method_id, issuer_id, installments, payer, reserva, datos } = body;

  if (!token || !payment_method_id) {
    res.status(400).json({ error: 'Faltan los datos de la tarjeta.' });
    return;
  }
  if (!reserva || !reserva.modalidad || !reserva.entrada || !reserva.salida) {
    res.status(400).json({ error: 'Faltan los datos de la reserva.' });
    return;
  }

  try {
    const modalidad = Precios.modalidadPorId(reserva.modalidad, CONFIG);
    if (!modalidad) {
      res.status(400).json({ error: 'Esa modalidad no existe.' });
      return;
    }

    const huespedes = Math.min(Math.max(1, Number(reserva.huespedes) || 2), modalidad.plazas);

    // disponibilidad.js (lo cargado a mano) + lo que ya se pagó online
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

    const externalRef = idExterno();
    const pagoApi = clientePago();

    const resultado = await pagoApi.create({
      body: {
        transaction_amount: sena,
        token,
        description: `Seña ${modalidad.nombre} · Balcones del Arroyo`,
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id: issuer_id || undefined,
        payer: payer || {},
        external_reference: externalRef,
        statement_descriptor: 'BALCONES ARROYO',
        notification_url: `${origenDe(req)}/api/webhook-mercadopago`,
        metadata: {
          modalidad: modalidad.id,
          entrada: reserva.entrada,
          salida: reserva.salida,
          huespedes,
          total: cotizacion.total,
          sena,
          nombre: (datos && datos.nombre) || '',
          telefono: (datos && datos.telefono) || '',
          email: (datos && datos.email) || '',
          localidad: (datos && datos.localidad) || '',
          mensaje: (datos && datos.mensaje) || ''
        }
      }
    });

    // A esta altura Mercado Pago YA le cobró (o no) al huésped: eso no se
    // puede deshacer. Si guardar el registro en Redis falla acá (por ejemplo
    // porque todavía no está conectada la base), no puede convertirse en un
    // error 500 — el huésped ya pagó, así que igual hay que avisarle que
    // salió bien. Queda como advertencia en los logs para revisar a mano; el
    // webhook además vuelve a intentar guardarlo apenas llegue la notificación.
    let avisoGuardado = null;
    if (resultado.status === 'approved') {
      try {
        const noches = Precios.nochesLista(reserva.entrada, reserva.salida);
        await marcarPagada(modalidad, noches, {
          id: externalRef,
          pagoId: resultado.id,
          modalidad: modalidad.id,
          entrada: reserva.entrada,
          salida: reserva.salida,
          huespedes,
          total: cotizacion.total,
          sena,
          datos: datos || {},
          creado: new Date().toISOString()
        });
      } catch (errGuardado) {
        console.error(
          `crear-pago: SE COBRÓ el pago ${resultado.id} (ref ${externalRef}) pero no se pudo ` +
          'guardar la reserva. Bloquear la fecha a mano y revisar la conexión con Redis.',
          errGuardado
        );
        avisoGuardado = 'Se acreditó el pago, pero hubo un problema técnico al registrar la ' +
          'reserva. Avisanos por WhatsApp con tu comprobante para confirmarla a mano.';
      }
    }

    res.status(200).json({
      status: resultado.status,
      status_detail: resultado.status_detail,
      id: resultado.id,
      sena,
      avisoGuardado
    });
  } catch (err) {
    console.error('crear-pago:', err);
    const mensajeMp = err && err.cause && err.cause[0] && err.cause[0].description;
    res.status(500).json({
      error: mensajeMp || 'No pudimos procesar el pago. Probá de nuevo en un momento.'
    });
  }
};
