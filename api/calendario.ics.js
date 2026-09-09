/* ============================================================================
   GET /api/calendario.ics
   ----------------------------------------------------------------------------
   El calendario de este sitio, en formato iCal, para pegar en Booking.com
   (Extranet → Calendario → Sincronizar calendarios → "Importar calendario")
   o en cualquier otra plataforma que acepte un link `.ics`. Es la otra mitad
   de lib/booking-ical.js: aquél trae lo que reserva Booking, éste avisa lo
   que se reserva acá (por el sitio, por WhatsApp, o lo que se cargue a mano
   desde el panel).

   Es público y de sólo lectura — no lleva nombres, teléfonos ni nada de lo
   que paga cada huésped, sólo qué noches están ocupadas. Es exactamente lo
   mismo que ya expone /api/contenido para pintar el calendario del sitio;
   esto sólo lo empaqueta en el formato que otra plataforma sabe leer.

   Se unen las noches de las dos plantas: hoy Booking vende la casa entera,
   así que una noche ocupada en cualquiera de las dos plantas tiene que
   figurar acá como "ocupado" — sino Booking podría vender una fecha en la
   que ya está la otra planta alquilada.
   ============================================================================ */

const { nochesOcupadasPublicas } = require('../lib/reservas.js');

/** 'AAAA-MM-DD' -> 'AAAAMMDD', el formato de fecha (todo el día) de iCal. */
function aFechaIcal(iso) {
  return iso.replace(/-/g, '');
}

function sumarUnDia(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  f.setUTCDate(f.getUTCDate() + 1);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
}

/** Noches sueltas y ordenadas -> rangos contiguos [{desde, hasta}], con
    `hasta` YA como el día de salida (exclusivo, como espera DTEND). Sin
    agrupar, cada noche sería un evento de un día, y Booking mostraría un
    check-in/check-out en cada noche de una misma estadía en vez de un solo
    bloque. */
function aRangos(noches) {
  const rangos = [];
  let inicio = null, anterior = null;
  for (const noche of noches) {
    if (inicio === null) {
      inicio = noche;
    } else if (noche !== sumarUnDia(anterior)) {
      rangos.push({ desde: inicio, hasta: sumarUnDia(anterior) });
      inicio = noche;
    }
    anterior = noche;
  }
  if (inicio !== null) rangos.push({ desde: inicio, hasta: sumarUnDia(anterior) });
  return rangos;
}

function dtstampAhora() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

module.exports = async (req, res) => {
  try {
    const ocupadas = await nochesOcupadasPublicas();
    const todas = [...new Set([...(ocupadas ? ocupadas.alta : []), ...(ocupadas ? ocupadas.baja : [])])].sort();
    const rangos = aRangos(todas);
    const ahora = dtstampAhora();

    const lineas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Balcones del Arroyo//Calendario//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    rangos.forEach((r, i) => {
      lineas.push(
        'BEGIN:VEVENT',
        `UID:bda-${r.desde}-${i}@balconesdelarroyo.com.ar`,
        `DTSTAMP:${ahora}`,
        `DTSTART;VALUE=DATE:${aFechaIcal(r.desde)}`,
        `DTEND;VALUE=DATE:${aFechaIcal(r.hasta)}`,
        'SUMMARY:Ocupado',
        'END:VEVENT'
      );
    });
    lineas.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');   // media hora: no hace falta al segundo
    res.status(200).send(lineas.join('\r\n') + '\r\n');
  } catch (err) {
    console.error('calendario.ics:', err);
    res.status(500).send('Hubo un problema técnico generando el calendario.');
  }
};
