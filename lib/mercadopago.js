/* ============================================================================
   Cliente de Mercado Pago, del lado del servidor.
   El Access Token vive sólo acá (variable de entorno MP_ACCESS_TOKEN, cargada
   en Vercel) — nunca en un archivo del repo ni en el navegador.
   ============================================================================ */

const { MercadoPagoConfig, Payment } = require('mercadopago');

let clienteApi = null;

function clientePago() {
  if (clienteApi) return clienteApi;

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('Falta la variable de entorno MP_ACCESS_TOKEN en Vercel.');
  }

  const config = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
  clienteApi = new Payment(config);
  return clienteApi;
}

module.exports = { clientePago };
