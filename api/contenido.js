/* ============================================================================
   GET /api/contenido
   ----------------------------------------------------------------------------
   Público: lo pide cada visitante antes de que la página pinte, para tener
   los precios y textos actualizados sin esperar un deploy.

   Devuelve dos cosas:
     `contenido` — sólo los campos que se cambiaron desde el panel (el resto
                   sale de config.js, que ya viajó con la página)
     `fotos`     — la galería, si alguien la editó; [] si sigue siendo la de
                   config.js

   Van juntas a propósito: es un pedido solo en vez de dos, y las dos cosas
   se necesitan en el mismo momento (antes de pintar). Nada de esto es
   secreto: son los mismos precios, textos y fotos que se ven en pantalla.

   Va cacheado en el borde de Vercel: `s-maxage=60` hace que la mayoría de las
   visitas ni toquen la base, y `stale-while-revalidate` permite servir la
   copia anterior mientras se busca la nueva, así nadie espera. El costo es
   que un cambio del panel puede tardar hasta un minuto en verse en todos
   lados — aceptable para precios y textos, y a cambio la página no depende
   de que la base conteste rápido.
   ============================================================================ */

const { obtenerOverrides } = require('../lib/contenido.js');
const { listarFotos } = require('../lib/fotos.js');
const { nochesOcupadasPublicas } = require('../lib/reservas.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  try {
    // `ocupadas` va en el mismo pedido y no en uno aparte: se necesita en el
    // mismo momento (antes de pintar el calendario) y así el visitante hace un
    // viaje en vez de dos. Que quede cacheado 60s en el borde es aceptable —
    // el chequeo de verdad lo hace igual la base al confirmar la reserva.
    const [contenido, fotos, ocupadas] = await Promise.all([
      obtenerOverrides(), listarFotos(), nochesOcupadasPublicas()
    ]);
    // `max-age=0, must-revalidate` es para el navegador del visitante: que
    // pregunte siempre (le sale un 304 barato) en vez de quedarse con una
    // copia vieja por un rato indeterminado. Sin esto, al no haber max-age,
    // los navegadores aplican un plazo propio y un cambio de precio podría
    // tardar en llegarle a quien ya visitó el sitio.
    // `s-maxage` sí es para el borde de Vercel, que es quien absorbe el
    // tráfico y evita que cada visita golpee la base.
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=600');
    res.status(200).json({ contenido, fotos, ocupadas });
  } catch (err) {
    console.error('contenido:', err);
    // Nunca un error: el sitio tiene que poder seguir con lo de config.js.
    // `ocupadas: null` es "no se pudo saber", distinto de "no hay ninguna
    // ocupada": con null el calendario no promete una disponibilidad que no
    // pudo confirmar, y el choque lo sigue frenando la base al reservar.
    res.status(200).json({ contenido: {}, fotos: [], ocupadas: null });
  }
};
