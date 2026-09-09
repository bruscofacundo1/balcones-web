/* ============================================================================
   Balcones del Arroyo — lectura del calendario de Booking.com (iCal)
   ----------------------------------------------------------------------------
   Booking.com da, por alojamiento, un link `.ics` de sólo lectura con las
   reservas confirmadas (Extranet → Calendario → Sincronizar calendarios →
   "Exportar calendario"). Este archivo lo trae y lo interpreta: no habla con
   ninguna API de Booking, sólo lee un archivo de texto con el formato
   estándar iCal (RFC 5545) que cualquier plataforma de alojamiento entiende.

   Lo que se sincroniza es un solo sentido acá (Booking -> este sitio). El
   otro sentido (avisarle a Booking lo que se reserva por acá) es
   api/calendario.ics.js, que expone el mismo formato para que Booking lo
   importe.

   El link en sí (BOOKING_ICAL_URL) es un secreto: cualquiera que lo tenga
   puede leer el calendario de reservas. Vive sólo como variable de entorno
   en Cloudflare, nunca en el código ni en Git.
   ============================================================================ */

function hayBookingConfigurado() {
  return Boolean(process.env.BOOKING_ICAL_URL);
}

/**
 * Deshace el "folding" de líneas de iCal: una línea lógica puede venir
 * partida en varias líneas físicas, y las de continuación arrancan con un
 * espacio o un tab. Sin este paso, una descripción larga corta el parseo de
 * la línea siguiente a la mitad.
 */
function desplegarLineas(texto) {
  const crudas = texto.split(/\r\n|\n|\r/);
  const lineas = [];
  for (const linea of crudas) {
    if ((linea.startsWith(' ') || linea.startsWith('\t')) && lineas.length) {
      lineas[lineas.length - 1] += linea.slice(1);
    } else {
      lineas.push(linea);
    }
  }
  return lineas;
}

/** 'AAAAMMDD' o 'AAAAMMDDTHHMMSSZ' -> 'AAAA-MM-DD'. Booking manda las fechas
    de check-in/check-out como DATE (todo el día), pero alcanza con leer los
    primeros 8 dígitos aunque algún día vengan con hora. */
function fechaIcalAIso(valor) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(valor || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Interpreta el .ics entero y devuelve un evento por VEVENT:
 * { uid, entrada, salida, resumen }.
 *
 * `entrada`/`salida` son las de DTSTART/DTEND, ya en 'AAAA-MM-DD'. Un evento
 * sin UID o sin las dos fechas se descarta: sin UID no se puede saber después
 * si Booking lo canceló, y sin las dos fechas no hay noches que bloquear.
 */
function interpretarIcs(texto) {
  const lineas = desplegarLineas(texto);
  const eventos = [];
  let actual = null;

  for (const linea of lineas) {
    if (linea === 'BEGIN:VEVENT') { actual = {}; continue; }
    if (linea === 'END:VEVENT') {
      if (actual && actual.uid && actual.entrada && actual.salida) eventos.push(actual);
      actual = null;
      continue;
    }
    if (!actual) continue;

    // La propiedad puede traer parámetros ("DTSTART;VALUE=DATE:20260310"):
    // sólo importa el nombre antes del primer ';' o ':', y el valor después
    // de los ':' (puede haber otro ':' adentro, como en un UID con horario).
    const separador = linea.indexOf(':');
    if (separador === -1) continue;
    const clave = linea.slice(0, separador).split(';')[0].toUpperCase();
    const valor = linea.slice(separador + 1);

    if (clave === 'UID') actual.uid = valor.trim();
    else if (clave === 'DTSTART') actual.entrada = fechaIcalAIso(valor);
    else if (clave === 'DTEND') actual.salida = fechaIcalAIso(valor);
    else if (clave === 'SUMMARY') actual.resumen = valor.trim();
  }

  return eventos;
}

/**
 * Trae el .ics de Booking y lo interpreta. Nunca lanza: si Booking está
 * caído, cambió el link o tarda de más, se corta la sincronización de esta
 * vuelta y se reintenta en la próxima — nunca por eso se cae la reserva de un
 * visitante que está usando el sitio en simultáneo.
 */
async function traerEventosBooking() {
  if (!hayBookingConfigurado()) return { ok: false, error: 'BOOKING_ICAL_URL no está configurado.' };

  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 15000);
    const r = await fetch(process.env.BOOKING_ICAL_URL, { signal: control.signal });
    clearTimeout(reloj);
    if (!r.ok) return { ok: false, error: `Booking contestó ${r.status}.` };
    const texto = await r.text();
    return { ok: true, eventos: interpretarIcs(texto) };
  } catch (e) {
    return { ok: false, error: 'No se pudo traer el calendario de Booking: ' + e.message };
  }
}

module.exports = {
  hayBookingConfigurado, traerEventosBooking, interpretarIcs, desplegarLineas, fechaIcalAIso
};
