/* ============================================================================
   Balcones del Arroyo — paso 3: datos y pago
   Depende de: config.js, disponibilidad.js, variantes.js, calendario.js

   Llega con las fechas y la unidad ya elegidas. Vuelve a validar las dos cosas
   (que el tramo siga libre y que la unidad sirva) y recalcula el precio con
   config.js, sin confiar en nada que venga del navegador.

   Hoy termina armando el mensaje de WhatsApp. Cuando entre Mercado Pago, el
   handler de "Confirmar reserva" llama a la función serverless que crea el
   pago de la seña — el resto de la página no cambia.
   ============================================================================ */

let calculo = null;

/** Lee y revalida lo que viene del paso anterior. */
function leerReserva() {
  let datos;
  try {
    datos = JSON.parse(sessionStorage.getItem(CLAVE_RESERVA) || 'null');
  } catch (e) {
    return null;
  }
  if (!datos || !datos.entrada || !datos.salida) return null;

  const modalidad = CONFIG.modalidades.find(m => m.id === datos.modalidad);
  if (!modalidad) return null;

  estado.modalidad = modalidad;
  estado.entrada = datos.entrada;
  estado.salida = datos.salida;
  estado.huespedes = Math.min(Math.max(1, Number(datos.huespedes) || 2), modalidad.plazas);

  // el tramo tiene que seguir libre para esta unidad
  if (hayOcupadasEntre(estado.entrada, estado.salida)) return null;
  const c = cotizar(estado.entrada, estado.salida);
  if (c.noches < c.minNoches) return null;

  return { modalidad, cotizacion: c };
}

/* ------------------------------------------------------------- pintado -- */

function pintarResumen(r) {
  const m = r.modalidad;
  const c = r.cotizacion;
  const pct = CONFIG.reglas.senaPorcentaje || 30;
  const sena = Math.round(c.total * pct / 100);

  const foto = document.getElementById('ck-foto');
  foto.src = FOTO_UNIDAD[m.id] || FOTO_UNIDAD.completa;
  foto.alt = m.nombre;

  document.getElementById('ck-unidad').textContent = m.nombre;
  document.getElementById('ck-fechas').textContent =
    `${formatoFechaLarga(estado.entrada)} al ${formatoFechaLarga(estado.salida)} · ` +
    `${c.noches} ${c.noches === 1 ? 'noche' : 'noches'} · ` +
    `${estado.huespedes} ${estado.huespedes === 1 ? 'huésped' : 'huéspedes'}`;

  document.getElementById('ck-desglose').innerHTML = htmlDesglose(c);
  document.getElementById('ck-sena-pct').textContent = pct;
  document.getElementById('ck-sena').textContent = pesos(sena);
  document.getElementById('ck-resto').textContent = pesos(c.total - sena);
  document.getElementById('ck-total-pie').textContent = pesos(sena);
  document.getElementById('ck-checkin').textContent = CONFIG.reglas.horaCheckIn;
  document.getElementById('ck-checkout').textContent = CONFIG.reglas.horaCheckOut;

  return { cotizacion: c, sena };
}

/* ---------------------------------------------------------- formulario -- */

function avisoForm(texto, tipo) {
  const el = document.getElementById('form-aviso');
  if (!texto) { el.className = 'aviso'; el.textContent = ''; return; }
  el.className = `aviso aviso--${tipo || 'error'}`;
  el.textContent = texto;
}

function datosFormulario() {
  const v = id => document.getElementById(id).value.trim();
  return {
    nombre: v('f-nombre'),
    telefono: v('f-tel'),
    email: v('f-email'),
    localidad: v('f-localidad'),
    mensaje: v('f-mensaje')
  };
}

/** Valida lo mínimo y devuelve los datos, o null si falta algo. */
function leerFormulario() {
  const datos = datosFormulario();

  if (!datos.nombre || !datos.telefono || !datos.email) {
    avisoForm('Completá nombre, teléfono y email para seguir.', 'error');
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    avisoForm('Revisá el email, parece que tiene un error.', 'error');
    document.getElementById('f-email').focus();
    return null;
  }
  if (!document.getElementById('f-acepto').checked) {
    avisoForm('Marcá la casilla para poder seguir.', 'error');
    return null;
  }

  avisoForm('', null);
  return datos;
}

/* ------------------------------------------------------------- mensaje -- */

function mensajeCompleto(datos) {
  const l = [];
  l.push('¡Hola! Quiero reservar en Balcones del Arroyo.');
  l.push('');
  l.push(`• ${estado.modalidad.nombre}`);
  l.push(`• Entrada: ${formatoFechaLarga(estado.entrada)}`);
  l.push(`• Salida: ${formatoFechaLarga(estado.salida)}`);
  l.push(`• Noches: ${calculo.cotizacion.noches}`);
  l.push(`• Huéspedes: ${estado.huespedes}`);
  l.push(`• Total estimado: ${pesos(calculo.cotizacion.total)}`);
  l.push(`• Seña (${CONFIG.reglas.senaPorcentaje || 30}%): ${pesos(calculo.sena)}`);
  l.push('');
  l.push('Mis datos:');
  l.push(`• Nombre: ${datos.nombre}`);
  l.push(`• Teléfono: ${datos.telefono}`);
  l.push(`• Email: ${datos.email}`);
  if (datos.localidad) l.push(`• Vengo de: ${datos.localidad}`);
  if (datos.mensaje) { l.push(''); l.push(datos.mensaje); }
  return l.join('\n');
}

/* ------------------------------------------------------------ arranque -- */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('anio').textContent = new Date().getFullYear();

  const r = leerReserva();
  if (!r) {
    document.getElementById('sin-reserva').hidden = false;
    return;
  }

  document.getElementById('checkout-todo').hidden = false;
  calculo = pintarResumen(r);

  document.getElementById('btn-finalizar').addEventListener('click', () => {
    const datos = leerFormulario();
    if (!datos) return;
    window.open(enlaceWsp(mensajeCompleto(datos)), '_blank', 'noopener');
  });
});
