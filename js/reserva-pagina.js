/* ============================================================================
   Balcones del Arroyo — página de reserva (paso 2)
   Depende de: config.js, disponibilidad.js, calendario.js

   Recibe del drawer sólo la selección (modalidad, fechas, huéspedes) y vuelve
   a calcular los precios acá con config.js. Nunca confía en un total que venga
   del navegador.
   ============================================================================ */

/* FOTO_UNIDAD se define en calendario.js, que se carga antes que este archivo. */

/** Lee y valida lo que eligió el visitante. Devuelve null si no sirve. */
function leerSeleccion() {
  let datos;
  try {
    datos = JSON.parse(sessionStorage.getItem(CLAVE_RESERVA) || 'null');
  } catch (e) {
    return null;
  }
  if (!datos || !datos.entrada || !datos.salida) return null;

  const modalidad = CONFIG.modalidades.find(m => m.id === datos.modalidad);
  if (!modalidad) return null;

  // Las fechas tienen que seguir libres: alguien pudo dejar la pestaña abierta
  // o volver con el botón "atrás" después de que se cargara otra reserva.
  estado.modalidad = modalidad;
  if (hayOcupadasEntre(datos.entrada, datos.salida)) return null;

  const noches = nochesEntre(datos.entrada, datos.salida);
  if (noches < 1) return null;

  estado.entrada = datos.entrada;
  estado.salida = datos.salida;
  estado.huespedes = Math.min(Number(datos.huespedes) || 1, modalidad.plazas);

  // `modalidad` va al final a propósito: en `datos` viene como id (string) y
  // acá la queremos como objeto.
  return { ...datos, modalidad, noches };
}

/* ------------------------------------------------------------- pintado -- */

function pintarReserva(sel) {
  const c = cotizar(estado.entrada, estado.salida);
  const pct = CONFIG.reglas.senaPorcentaje || 30;
  const sena = Math.round(c.total * pct / 100);

  document.getElementById('det-foto').src = FOTO_UNIDAD[sel.modalidad.id] || FOTO_UNIDAD.completa;
  document.getElementById('det-foto').alt = sel.modalidad.nombre;
  document.getElementById('det-unidad').textContent = sel.modalidad.nombre;
  document.getElementById('det-detalle').textContent = sel.modalidad.detalle;

  document.getElementById('det-entrada').textContent = formatoFechaLarga(estado.entrada);
  document.getElementById('det-salida').textContent = formatoFechaLarga(estado.salida);
  document.getElementById('det-noches').textContent =
    `${c.noches} ${c.noches === 1 ? 'noche' : 'noches'}`;
  document.getElementById('det-huespedes').textContent =
    `${estado.huespedes} ${estado.huespedes === 1 ? 'huésped' : 'huéspedes'}`;

  document.getElementById('det-checkin').textContent = CONFIG.reglas.horaCheckIn;
  document.getElementById('det-checkout').textContent = CONFIG.reglas.horaCheckOut;

  document.getElementById('res-fechas').textContent =
    `${formatoFechaLarga(estado.entrada)} al ${formatoFechaLarga(estado.salida)}`;

  document.getElementById('det-desglose').innerHTML = htmlDesglose(c);

  document.getElementById('det-sena-pct').textContent = pct;
  document.getElementById('det-sena').textContent = pesos(sena);
  document.getElementById('det-resto').textContent = pesos(c.total - sena);

  return { cotizacion: c, sena };
}

/* ---------------------------------------------------------- formulario -- */

function avisoForm(texto, tipo) {
  const el = document.getElementById('form-aviso');
  if (!texto) { el.className = 'aviso'; el.textContent = ''; return; }
  el.className = `aviso aviso--${tipo || 'error'}`;
  el.textContent = texto;
}

/** Lee los campos tal cual están, sin exigir nada. */
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

  avisoForm('', null);
  return datos;
}

/* ------------------------------------------------------------- mensaje -- */

function mensajeCompleto(sel, calc, datos) {
  const l = [];
  l.push('¡Hola! Quiero reservar en Balcones del Arroyo.');
  l.push('');
  l.push(`• ${sel.modalidad.nombre}`);
  l.push(`• Entrada: ${formatoFechaLarga(estado.entrada)}`);
  l.push(`• Salida: ${formatoFechaLarga(estado.salida)}`);
  l.push(`• Noches: ${calc.cotizacion.noches}`);
  l.push(`• Huéspedes: ${estado.huespedes}`);
  l.push(`• Total estimado: ${pesos(calc.cotizacion.total)}`);
  l.push(`• Seña (${CONFIG.reglas.senaPorcentaje || 30}%): ${pesos(calc.sena)}`);
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

  const sel = leerSeleccion();
  if (!sel) {
    document.getElementById('sin-reserva').hidden = false;
    return;
  }

  document.getElementById('reserva-layout').hidden = false;
  const calc = pintarReserva(sel);

  // Paso 3 (seña). Hoy termina en WhatsApp; cuando entre Mercado Pago,
  // este handler llama a la función serverless que crea el pago.
  document.getElementById('btn-continuar').addEventListener('click', () => {
    const datos = leerFormulario();
    if (!datos) return;
    window.open(enlaceWsp(mensajeCompleto(sel, calc, datos)), '_blank', 'noopener');
  });

  // Acá no exigimos el formulario: es la salida para quien quiere preguntar antes.
  document.getElementById('btn-wsp').addEventListener('click', () => {
    window.open(enlaceWsp(mensajeCompleto(sel, calc, datosFormulario())), '_blank', 'noopener');
  });
});
