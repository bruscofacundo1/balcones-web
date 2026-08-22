/* ============================================================================
   POST /api/webhook-mercadopago
   ----------------------------------------------------------------------------
   Mercado Pago llama acá cuando cambia el estado de un pago. Con el Payment
   Brick la respuesta de /api/crear-pago ya suele venir con el estado final
   (aprobado o rechazado) y las noches quedan bloqueadas en el momento — este
   webhook es la red de seguridad para cuando el estado cambia después (por
   ejemplo un pago que queda "en proceso" y se aprueba un rato más tarde).

   Verifica la firma de la notificación con MP_WEBHOOK_SECRET antes de creer
   nada de lo que llega (si no está configurada esa variable, igual funciona:
   busca el pago por su id directo en la API de Mercado Pago con el Access
   Token, así que no hay forma de inventar una reserva pagada sólo con pegarle
   a esta URL — pero configurar el secreto es lo recomendado).
   ============================================================================ */

const { CONFIG } = require('../js/config.js');
const Precios = require('../js/precios.js');
const { obtenerPago, firmaValida: firmaValidaMP } = require('../lib/mercadopago.js');
const { marcarPagada, pagoYaProcesado, marcarPagoProcesado } = require('../lib/reservas.js');

function idDelPago(req) {
  const q = req.query || {};
  return q['data.id'] || q.id || (req.body && req.body.data && req.body.data.id) || null;
}

function firmaValida(req, dataId) {
  return firmaValidaMP({
    xSignature: req.headers['x-signature'],
    xRequestId: req.headers['x-request-id'],
    dataId,
    secreto: process.env.MP_WEBHOOK_SECRET
  });
}

module.exports = async (req, res) => {
  // Mercado Pago sólo necesita un 200; cualquier otra cosa la reintenta.
  // Devolvemos 200 siempre que la notificación esté bien formada, incluso si
  // el pago termina rechazado — "no hacer nada" también es una respuesta
  // válida acá, no un error.
  const dataId = idDelPago(req);
  if (!dataId) { res.status(200).send('sin id'); return; }

  if (!firmaValida(req, dataId)) { res.status(401).send('firma inválida'); return; }

  try {
    if (await pagoYaProcesado(dataId)) { res.status(200).send('ya procesado'); return; }

    const pago = await obtenerPago(dataId);

    if (pago.status === 'approved') {
      const meta = pago.metadata || {};
      const modalidad = Precios.modalidadPorId(meta.modalidad, CONFIG);
      if (modalidad && meta.entrada && meta.salida) {
        const noches = Precios.nochesLista(meta.entrada, meta.salida);
        await marcarPagada(modalidad, noches, {
          id: pago.external_reference || `mp-${pago.id}`,
          pagoId: pago.id,
          modalidad: modalidad.id,
          entrada: meta.entrada,
          salida: meta.salida,
          huespedes: meta.huespedes,
          total: meta.total,
          sena: pago.transaction_amount,
          datos: {
            nombre: meta.nombre, telefono: meta.telefono,
            email: meta.email, localidad: meta.localidad, mensaje: meta.mensaje
          },
          creado: new Date().toISOString()
        });
      }
    }

    await marcarPagoProcesado(dataId);
    res.status(200).send('ok');
  } catch (err) {
    console.error('webhook-mercadopago:', err);
    // 200 igual: si devolvemos error, MP reintenta en bucle una notificación
    // que puede estar rota del lado nuestro, no del de MP. Queda en los logs.
    res.status(200).send('error interno, ver logs');
  }
};
