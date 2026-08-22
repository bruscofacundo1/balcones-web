/* ============================================================================
   Cliente de Mercado Pago, del lado del servidor.
   ----------------------------------------------------------------------------
   Antes usaba el SDK oficial de npm (`mercadopago`). Al mudar a Cloudflare
   Workers se sacó esa dependencia: no había forma de confirmar que el SDK
   corriera en ese runtime sin probarlo en producción, y este es justo el
   camino donde un problema sale caro (cobros de verdad). En su lugar, esto
   habla directo con la API REST de Mercado Pago por `fetch` — que es nativo
   del runtime, cero dudas de compatibilidad — más `node:crypto` para la firma
   del webhook, que Cloudflare sí soporta entero.

   El Access Token vive sólo en la variable de entorno MP_ACCESS_TOKEN
   (cargada en el panel de Cloudflare) — nunca en un archivo del repo ni en
   el navegador.
   ============================================================================ */

const crypto = require('node:crypto');

const BASE = 'https://api.mercadopago.com';

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error('Falta la variable de entorno MP_ACCESS_TOKEN.');
  return t;
}

async function pedir(ruta, opciones = {}) {
  const resp = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opciones.headers || {})
    }
  });

  let cuerpo = null;
  try { cuerpo = await resp.json(); } catch { /* respuesta sin cuerpo */ }

  if (!resp.ok) {
    // Mismo criterio que antes con el SDK: un nombre que arranca con "MP" es
    // señal de "este mensaje viene de Mercado Pago y es seguro de mostrar".
    const err = new Error(
      (cuerpo && (cuerpo.message || cuerpo.error)) || `Mercado Pago respondió ${resp.status}.`
    );
    err.name = 'MPApiError';
    err.status = resp.status;
    err.detalle = cuerpo;
    throw err;
  }
  return cuerpo;
}

/** Cobra un pago. `idempotencyKey` evita que un reintento de red duplique el
    cobro: Mercado Pago devuelve el mismo resultado si ve la misma clave. */
function crearPago(datos, idempotencyKey) {
  return pedir('/v1/payments', {
    method: 'POST',
    body: JSON.stringify(datos),
    headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}
  });
}

function obtenerPago(id) {
  return pedir(`/v1/payments/${encodeURIComponent(id)}`);
}

/**
 * Valida la firma `x-signature` de un webhook de Mercado Pago.
 *
 * El formato es `ts=<epoch>,v1=<firma>`, y la firma es un HMAC-SHA256 en hex
 * del texto `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` con el secreto del
 * webhook (MP_WEBHOOK_SECRET).
 *
 * Sin secreto configurado, devuelve true (no se puede validar, así que no se
 * intenta) — no es un agujero: quien llama esta función igual busca el pago
 * por su id directo en la API con el Access Token antes de creerle nada, y
 * ese pedido sólo puede traer pagos de ESTA cuenta de Mercado Pago. La firma
 * es una verificación rápida de más, no la única barrera.
 */
function firmaValida({ xSignature, xRequestId, dataId, secreto }) {
  if (!secreto) return true;
  if (!xSignature || !dataId) return false;

  const partes = {};
  for (const trozo of String(xSignature).split(',')) {
    const i = trozo.indexOf('=');
    if (i < 0) continue;
    partes[trozo.slice(0, i).trim()] = trozo.slice(i + 1).trim();
  }
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const manifiesto = `id:${dataId};` + (xRequestId ? `request-id:${xRequestId};` : '') + `ts:${ts};`;
  const esperada = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');

  if (esperada.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(v1));
}

module.exports = { crearPago, obtenerPago, firmaValida };
