/* ============================================================================
   Balcones del Arroyo — paso 2: qué se alquila
   Depende de: config.js, disponibilidad.js, variantes.js, calendario.js

   Del modal llegan sólo las fechas. Acá se elige la unidad viendo el precio de
   cada una y cuáles quedan libres. Los datos y el pago van en checkout.html.

   Los precios se recalculan con config.js: nunca se confía en un total que
   venga del navegador.
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

/* ------------------------------------------------------------- pintado -- */

/** Barra de arriba con las fechas elegidas. */
function pintarBusqueda() {
  const noches = nochesEntre(estado.entrada, estado.salida);
  document.getElementById('bq-entrada').textContent = formatoFechaLarga(estado.entrada);
  document.getElementById('bq-salida').textContent = formatoFechaLarga(estado.salida);
  document.getElementById('bq-noches').textContent =
    `${noches} ${noches === 1 ? 'noche' : 'noches'}`;
}

/**
 * Barra de abajo: aparece recién cuando hay una opción elegida que sirva, con
 * el total y el botón para seguir.
 */
function pintarConfirmar() {
  const barra = document.getElementById('confirmar');
  const sirve = modalidadesDisponibles().some(m => m.id === estado.modalidad.id);

  barra.hidden = !sirve;
  document.body.classList.toggle('con-barra', sirve);
  if (!sirve) return;

  const m = estado.modalidad;
  const c = cotizar(estado.entrada, estado.salida);

  document.getElementById('cf-unidad').textContent = m.nombre;
  document.getElementById('cf-detalle').textContent =
    `${estado.huespedes} ${estado.huespedes === 1 ? 'huésped' : 'huéspedes'} · hasta ${m.plazas}`;
  document.getElementById('cf-total').textContent = pesos(c.total);
  document.getElementById('cf-noches').textContent =
    `${c.noches} ${c.noches === 1 ? 'noche' : 'noches'} · ${pesos(Math.round(c.total / c.noches))} la noche`;
}

function refrescar() {
  pintarOpciones();
  pintarConfirmar();
}

/** Guarda la unidad elegida y pasa a los datos. */
function irAlCheckout() {
  if (!modalidadesDisponibles().some(m => m.id === estado.modalidad.id)) return;

  sessionStorage.setItem(CLAVE_RESERVA, JSON.stringify({
    modalidad: estado.modalidad.id,
    entrada: estado.entrada,
    salida: estado.salida,
    huespedes: estado.huespedes
  }));

  window.location.href = 'checkout.html';
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
  document.addEventListener('balcones:modalidad', pintarConfirmar);

  document.getElementById('rp-huespedes').addEventListener('change', e => {
    estado.huespedes = Number(e.target.value);
    refrescar();
  });

  document.getElementById('cf-reservar').addEventListener('click', irAlCheckout);
});
