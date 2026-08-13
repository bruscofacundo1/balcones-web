/* ============================================================================
   Balcones del Arroyo — página de reserva
   Depende de: config.js, disponibilidad.js, variantes.js, calendario.js

   Del modal sólo llegan las fechas. Acá se elige qué alquilar (viendo el
   precio de cada opción y cuáles quedan libres) y después se cargan los datos.

   Los precios se vuelven a calcular con config.js: nunca se confía en un
   total que venga del navegador.
   ============================================================================ */

/** Lee las fechas que dejó el modal. Devuelve null si no sirven. */
function leerSeleccion() {
  let datos;
  try {
    datos = JSON.parse(sessionStorage.getItem(CLAVE_RESERVA) || 'null');
  } catch (e) {
    return null;
  }
  if (!datos || !datos.entrada || !datos.salida) return null;
  if (nochesEntre(datos.entrada, datos.salida) < 1) return null;

  estado.entrada = datos.entrada;
  estado.salida = datos.salida;

  // La modalidad que viene es sólo una sugerencia: si no sirve para estas
  // fechas, más abajo se pasa a la primera que sí.
  const sugerida = CONFIG.modalidades.find(m => m.id === datos.modalidad);
  if (sugerida) estado.modalidad = sugerida;
  estado.huespedes = Math.max(1, Number(datos.huespedes) || 2);

  return datos;
}

/** Modalidades que se pueden alquilar en las fechas elegidas. */
function modalidadesDisponibles() {
  return CONFIG.modalidades.filter(m => {
    if (hayOcupadasEntre(estado.entrada, estado.salida, m)) return false;
    const c = cotizar(estado.entrada, estado.salida, m);
    return c.noches >= c.minNoches;
  });
}

/* --------------------------------------------------------- paso 2 y 3 --- */

/** Barra de arriba con las fechas elegidas. */
function pintarBusqueda() {
  const noches = nochesEntre(estado.entrada, estado.salida);
  document.getElementById('bq-entrada').textContent = formatoFechaLarga(estado.entrada);
  document.getElementById('bq-salida').textContent = formatoFechaLarga(estado.salida);
  document.getElementById('bq-noches').textContent =
    `${noches} ${noches === 1 ? 'noche' : 'noches'}`;
}

/**
 * El detalle de la derecha. Sólo se muestra cuando hay una modalidad elegida
 * que sirva para estas fechas.
 */
function pintarDetalle() {
  const layout = document.getElementById('reserva-layout');
  const sirve = !hayOcupadasEntre(estado.entrada, estado.salida) &&
                cotizar(estado.entrada, estado.salida).noches >=
                cotizar(estado.entrada, estado.salida).minNoches;

  layout.hidden = !sirve;
  document.getElementById('paso-3').classList.toggle('paso--activo', sirve);
  if (!sirve) return null;

  const m = estado.modalidad;
  const c = cotizar(estado.entrada, estado.salida);
  const pct = CONFIG.reglas.senaPorcentaje || 30;
  const sena = Math.round(c.total * pct / 100);

  const foto = document.getElementById('det-foto');
  foto.src = FOTO_UNIDAD[m.id] || FOTO_UNIDAD.completa;
  foto.alt = m.nombre;
  document.getElementById('det-unidad').textContent = m.nombre;
  document.getElementById('det-detalle').textContent = `${m.plazas} plazas · ${m.detalle}`;

  document.getElementById('res-fechas').textContent =
    `${formatoFechaLarga(estado.entrada)} al ${formatoFechaLarga(estado.salida)} · ` +
    `${estado.huespedes} ${estado.huespedes === 1 ? 'huésped' : 'huéspedes'}`;

  document.getElementById('det-desglose').innerHTML = htmlDesglose(c);
  document.getElementById('det-sena-pct').textContent = pct;
  document.getElementById('det-sena').textContent = pesos(sena);
  document.getElementById('det-resto').textContent = pesos(c.total - sena);
  document.getElementById('det-checkin').textContent = CONFIG.reglas.horaCheckIn;
  document.getElementById('det-checkout').textContent = CONFIG.reglas.horaCheckOut;

  return { cotizacion: c, sena };
}

/** Refresca todo lo que depende de la modalidad o de los huéspedes. */
function refrescar() {
  pintarOpciones();
  ultimoCalculo = pintarDetalle();
}

let ultimoCalculo = null;

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

function mensajeCompleto(datos) {
  const calc = ultimoCalculo;
  const l = [];
  l.push('¡Hola! Quiero reservar en Balcones del Arroyo.');
  l.push('');
  l.push(`• ${estado.modalidad.nombre}`);
  l.push(`• Entrada: ${formatoFechaLarga(estado.entrada)}`);
  l.push(`• Salida: ${formatoFechaLarga(estado.salida)}`);
  if (calc) {
    l.push(`• Noches: ${calc.cotizacion.noches}`);
    l.push(`• Huéspedes: ${estado.huespedes}`);
    l.push(`• Total estimado: ${pesos(calc.cotizacion.total)}`);
    l.push(`• Seña (${CONFIG.reglas.senaPorcentaje || 30}%): ${pesos(calc.sena)}`);
  }
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

  if (!leerSeleccion()) {
    document.getElementById('sin-reserva').hidden = false;
    return;
  }

  document.getElementById('reserva-todo').hidden = false;
  pintarBusqueda();

  // si lo que venía sugerido no sirve, pasamos a la primera opción libre
  const libres = modalidadesDisponibles();
  if (libres.length && !libres.some(m => m.id === estado.modalidad.id)) {
    estado.modalidad = libres[0];
  }

  if (!libres.length) {
    const av = document.getElementById('rp-aviso');
    av.className = 'aviso aviso--error';
    av.textContent = 'No queda nada libre para esas fechas. Probá con otras.';
    document.getElementById('rp-bajada').textContent = '';
  }

  llenarHuespedes();
  refrescar();

  // al tocar una opción, calendario.js cambia la modalidad y avisa por acá
  document.addEventListener('balcones:modalidad', () => {
    ultimoCalculo = pintarDetalle();
  });

  document.getElementById('rp-huespedes').addEventListener('change', e => {
    estado.huespedes = Number(e.target.value);
    refrescar();
  });

  // Paso 3 (seña). Hoy termina en WhatsApp; cuando entre Mercado Pago, este
  // handler llama a la función serverless que crea el pago.
  document.getElementById('btn-continuar').addEventListener('click', () => {
    const datos = leerFormulario();
    if (!datos) return;
    window.open(enlaceWsp(mensajeCompleto(datos)), '_blank', 'noopener');
  });

  // Acá no exigimos el formulario: es la salida para quien quiere preguntar antes.
  document.getElementById('btn-wsp').addEventListener('click', () => {
    window.open(enlaceWsp(mensajeCompleto(datosFormulario())), '_blank', 'noopener');
  });
});
