/* ============================================================================
   DISPONIBILIDAD — fechas ya reservadas, planta por planta
   ----------------------------------------------------------------------------
   NO edites este archivo a mano.
   Abrí  admin.html  en el navegador, marcá las fechas ocupadas haciendo clic
   y apretá "Descargar disponibilidad.js". Después reemplazá este archivo por
   el que se descargó (queda en tu carpeta de Descargas) y volvé a subir el sitio.

   Cada lista tiene las noches ocupadas de esa planta, en formato 'AAAA-MM-DD'.
   Cuando se alquila la casa completa, la fecha va en las dos listas.
   ============================================================================ */

const DISPONIBILIDAD = {
  actualizado: '2026-08-11',
  alta: [],
  baja: []
};

/* Del lado del servidor esto es sólo la base: las noches que ya se pagaron
   online se guardan aparte, en Vercel KV (ver lib/reservas.js), y se suman a
   esta lista antes de aceptar un pago nuevo. No hace falta que admin.html
   sepa nada de eso. */
if (typeof module !== 'undefined' && module.exports) module.exports = { DISPONIBILIDAD };
