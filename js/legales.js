/* ============================================================================
   Balcones del Arroyo — datos de las páginas legales
   Depende de: config.js, pie.js

   El texto legal está escrito en el HTML (es texto, no datos), pero todo lo
   que puede cambiar —titular, CUIT, plazos de cancelación, contacto— sale de
   `CONFIG.legales` y se inyecta acá. Así el CUIT o los días de cancelación se
   tocan en un solo lugar y no hay que ir a buscarlos por el HTML.
   ============================================================================ */

/** Rellena todos los <span data-legal="..."> de la página. */
function pintarDatosLegales() {
  const c = CONFIG.contacto;
  const l = CONFIG.legales || {};
  const can = l.cancelacion || {};

  const mensaje = '¡Hola! Tengo una consulta sobre Balcones del Arroyo.';
  const wsp = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensaje)}`;

  const valores = {
    hoy: new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
    titular: l.titular || 'Balcones del Arroyo',
    // si todavía no hay CUIT cargado, la frase entera desaparece en vez de
    // quedar un "CUIT:" colgado
    'cuit-frase': l.cuit ? ` (CUIT ${l.cuit})` : '',
    domicilio: l.domicilio || c.direccion,
    'sena-pct': CONFIG.reglas.senaPorcentaje || 30,
    checkin: CONFIG.reglas.horaCheckIn,
    checkout: CONFIG.reglas.horaCheckOut,
    'dias-sin-cargo': can.diasSinCargo,
    'dias-mitad': can.diasMitad,
    'dias-reprogramar': can.diasReprogramar,
    'dias-arrepentimiento': l.diasArrepentimiento || 10,
    'texto-sin-cargo': can.senaReembolsable
      ? 'se reintegra el 100% de la seña.'
      : 'la seña no se reintegra, pero podés usarla para otra fecha del mismo año.'
  };

  Object.entries(valores).forEach(([clave, valor]) => {
    document.querySelectorAll(`[data-legal="${clave}"]`).forEach(el => {
      el.textContent = valor;
    });
  });

  document.querySelectorAll('[data-legal="tel-link"]').forEach(a => {
    a.textContent = c.telefonoVisible;
    a.href = wsp;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  document.querySelectorAll('[data-legal="mail-link"]').forEach(a => {
    a.textContent = c.email;
    a.href = `mailto:${c.email}`;
  });
}

/**
 * Aviso visible mientras falten datos reales. Es a propósito que se vea en la
 * página y no sólo en la consola: son textos legales, y publicarlos con datos
 * de ejemplo es peor que no tenerlos.
 */
function avisarPendientes() {
  const l = CONFIG.legales || {};
  const falta = [];
  if (!l.cuit) falta.push('el CUIT');
  if (!l.registroTuristico) falta.push('el número de registro de alojamiento turístico');
  if (l.titular === 'Balcones del Arroyo') falta.push('el nombre o razón social del titular');

  const el = document.getElementById('aviso-pendiente');
  if (!el || !falta.length) return;

  el.hidden = false;
  el.innerHTML =
    `<strong>Falta completar antes de publicar:</strong> ${falta.join(', ')}. ` +
    'Se cargan en <code>js/config.js</code>, en la sección <code>legales</code>. ' +
    'Los plazos de cancelación son un borrador: revisalos antes de sostenerlos ante un huésped.';

  console.warn('[Balcones del Arroyo] Datos legales sin completar: ' + falta.join(', '));
}

document.addEventListener('DOMContentLoaded', async () => {
  await Contenido.preparar(CONFIG);

  pintarDatosLegales();
  avisarPendientes();
  pintarPie({ cta: false });
});
