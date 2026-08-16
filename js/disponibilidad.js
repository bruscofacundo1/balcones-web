/* ============================================================================
   DISPONIBILIDAD — punto de partida, hoy vacío a propósito
   ----------------------------------------------------------------------------
   YA NO SE EDITA. Las fechas ocupadas viven todas en la base de datos y se
   manejan desde el panel: entrá a /admin y cargá, bloqueá o das de baja
   desde ahí. Se ve al instante, sin volver a subir el sitio.

   Antes este archivo era la lista principal y se editaba bajándolo desde
   admin.html. El problema es que había DOS lugares donde decía "ocupado"
   —este archivo y la base— que se actualizaban por caminos distintos: uno
   necesitaba un deploy y el otro no. Dos listas así terminan, tarde o
   temprano, en una sobreventa. Ver §"Panel de administración" en CONTEXTO.md.

   Queda como red de seguridad: si alguna vez hiciera falta bloquear algo sin
   base de datos, lo que se ponga acá se suma a lo que venga de la base.
   Formato: noches ocupadas de esa planta, en 'AAAA-MM-DD'.
   ============================================================================ */

const DISPONIBILIDAD = {
  actualizado: '2026-08-11',
  alta: [],
  baja: []
};

/* Del lado del servidor esto es sólo la base: las noches ocupadas de verdad
   salen de Postgres (ver lib/reservas.js) y se suman a esta lista antes de
   aceptar una reserva nueva. */
if (typeof module !== 'undefined' && module.exports) module.exports = { DISPONIBILIDAD };
