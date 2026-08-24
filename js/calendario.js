/* ============================================================================
   Balcones del Arroyo — calendario de disponibilidad y cotizador
   Depende de: config.js, disponibilidad.js, precios.js

   La casa se alquila entera o por planta. La disponibilidad se lleva por
   planta ('alta' y 'baja'); la casa completa necesita las dos libres.

   Las cuentas de fechas y precios (aIso, cotizar, hayOcupadasEntre, etc.) no
   están acá: viven en precios.js, que también usa el servidor para calcular
   el pago. Este archivo las envuelve con los mismos nombres de siempre (y sin
   tener que repetir CONFIG/OCUPADAS/estado.huespedes en cada llamado) para no
   tener que tocar el resto del código que ya las usa.
   ============================================================================ */

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_CORTOS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

/* ------------------------------------------------------------- utilidades */

const aIso = Precios.aIso;
const deIso = Precios.deIso;
const sumarDias = Precios.sumarDias;
const nochesEntre = Precios.nochesEntre;

function formatoFechaLarga(iso) {
  const f = deIso(iso);
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
}

function pesos(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: CONFIG.reglas.moneda, maximumFractionDigits: 0
  }).format(n);
}

/**
 * Aclara un color hexadecimal mezclándolo con blanco.
 * `fuerza` 0 = blanco puro, 1 = el color tal cual.
 * Se usa para pintar cada día del calendario con el tono de su temporada
 * sin que el número deje de leerse.
 */
function tinte(hex, fuerza) {
  const n = parseInt(hex.slice(1), 16);
  const canal = v => Math.round(v + (255 - v) * (1 - fuerza));
  return `rgb(${canal((n >> 16) & 255)}, ${canal((n >> 8) & 255)}, ${canal(n & 255)})`;
}

/* ------------------------------------------------------- disponibilidad -- */

/** Índice de noches ocupadas por planta, armado desde disponibilidad.js. */
const OCUPADAS = Precios.construirOcupadas(DISPONIBILIDAD);

function modalidadPorId(id) {
  return Precios.modalidadPorId(id, CONFIG) || CONFIG.modalidades[0];
}

/** ¿La modalidad elegida está libre esa noche? */
function libre(iso, modalidad) {
  return Precios.libre(iso, modalidad, OCUPADAS);
}

/** ¿Queda algo para alquilar esa noche, aunque sea una sola planta? */
function libreAlguna(iso) {
  return Precios.libreAlguna(iso, CONFIG, OCUPADAS);
}

/**
 * Estado de un día del calendario.
 *
 * Ojo con la diferencia entre "día" y "noche": lo que se ocupa son noches. El
 * día en que alguien se va queda libre desde el mediodía, así que sirve como
 * fecha de entrada para el siguiente; y el día en que alguien entra sirve como
 * fecha de salida. Por eso hay días partidos al medio.
 *
 * -> { entrada, salida, clase }
 *      entrada = se puede empezar la estadía ese día
 *      salida  = se puede terminar la estadía ese día
 */
function estadoDia(iso, modalidad, union) {
  const hayLugar = union ? libreAlguna : (d => libre(d, modalidad));

  const estaNoche = hayLugar(iso);
  const nocheAnterior = hayLugar(aIso(sumarDias(deIso(iso), -1)));

  let clase;
  if (estaNoche && nocheAnterior)        clase = 'dia--libre';
  else if (!estaNoche && !nocheAnterior) clase = 'dia--ocupado';
  else if (estaNoche)                    clase = 'dia--medio-entra';  // se van a la mañana
  else                                   clase = 'dia--medio-sale';   // entran a la tarde

  return { entrada: estaNoche, salida: nocheAnterior, clase };
}

/* ---------------------------------------------------------- temporadas -- */

function temporadaDe(iso) {
  return Precios.temporadaDe(iso, CONFIG);
}

/** Temporada por defecto cuando una fecha no cae en ningún rango. */
function temporadaFallback() {
  return Precios.temporadaFallback(CONFIG);
}

/* --------------------------------------------------------------- estado -- */

const estado = {
  modalidad: modalidadPorId('completa'),
  entrada: null,        // ISO
  salida: null,         // ISO
  huespedes: 2,
  mesBase: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
};

const HOY = aIso(new Date());
const LIMITE = (() => {
  const f = new Date();
  f.setDate(1);
  f.setMonth(f.getMonth() + (CONFIG.reglas.mesesVisibles - 1));
  return f;
})();

/* ------------------------------------------------------------ renderizado */

/* Siempre seis semanas: se completa con los días del mes anterior y del
   siguiente. Además de dejar ver el arranque del mes que viene, hace que el
   calendario mida siempre lo mismo, así no salta al cambiar de mes. */
const SEMANAS_VISIBLES = 6;

function dibujarMes(anio, mes, opts = {}) {
  const primero = new Date(anio, mes, 1);
  // getDay(): 0=domingo. Queremos semanas que arranquen en lunes.
  const offset = (primero.getDay() + 6) % 7;
  const inicioGrilla = sumarDias(primero, -offset);

  const cont = document.createElement('div');
  cont.className = 'cal__mes';

  const titulo = document.createElement('h4');
  titulo.textContent = `${MESES[mes]} ${anio}`;
  cont.appendChild(titulo);

  const cab = document.createElement('div');
  cab.className = 'cal__cabecera';
  cab.setAttribute('aria-hidden', 'true');
  DIAS_CORTOS.forEach(d => {
    const s = document.createElement('span');
    s.textContent = d;
    cab.appendChild(s);
  });
  cont.appendChild(cab);

  const grilla = document.createElement('div');
  grilla.className = 'cal__dias';

  for (let i = 0; i < SEMANAS_VISIBLES * 7; i++) {
    const fecha = sumarDias(inicioGrilla, i);
    const iso = aIso(fecha);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dia';
    btn.dataset.fecha = iso;

    // los días de relleno funcionan igual, sólo se ven más apagados
    if (fecha.getMonth() !== mes) btn.classList.add('dia--otro-mes');

    const numero = document.createElement('span');
    numero.className = 'dia__num';
    numero.textContent = fecha.getDate();
    btn.appendChild(numero);

    const pasada = iso < HOY;
    // En los flujos donde las fechas van antes que la modalidad se muestra
    // libre el día en el que quede algo, aunque sea una sola planta.
    const est = estadoDia(iso, estado.modalidad, opts.union);
    const usable = !pasada && (est.entrada || est.salida);

    btn.classList.add(pasada ? 'dia--pasado' : est.clase);

    if (!usable) {
      btn.disabled = true;
      btn.setAttribute('aria-label',
        `${formatoFechaLarga(iso)} — ${pasada ? 'fecha pasada' : 'ocupado'}`);
    } else {
      const t = temporadaDe(iso) || temporadaFallback();
      const barra = document.createElement('span');
      barra.className = 'dia__temp';
      barra.style.background = t.color;
      barra.title = t.nombre;
      btn.appendChild(barra);

      const detalle = est.entrada && est.salida ? 'libre'
        : est.entrada ? 'libre desde el mediodía'
        : 'sólo para la salida';
      btn.setAttribute('aria-label',
        `${formatoFechaLarga(iso)} — ${detalle}, ${t.nombre.toLowerCase()}`);
      btn.addEventListener('click', () => elegirFecha(iso, opts.union));
    }

    if (iso === HOY) btn.classList.add('dia--hoy');

    // marcas de selección
    if (estado.entrada && estado.salida) {
      if (iso > estado.entrada && iso < estado.salida) btn.classList.add('dia--rango');
    }
    if (iso === estado.entrada) btn.classList.add('dia--entrada');
    if (iso === estado.salida) btn.classList.add('dia--salida');

    grilla.appendChild(btn);
  }

  cont.appendChild(grilla);
  return cont;
}

/**
 * Dibuja el calendario en un contenedor cualquiera. Se usa dos veces: la
 * sección de disponibilidad muestra dos meses y el drawer lateral, uno solo.
 * Si el contenedor no existe simplemente no hace nada.
 */
function dibujarEn(ids, cantMeses, opts = {}) {
  const cont = document.getElementById(ids.meses);
  if (!cont) return;
  cont.innerHTML = '';

  const a = estado.mesBase.getFullYear();
  const m = estado.mesBase.getMonth();

  let ultimo = new Date(a, m, 1);
  for (let i = 0; i < cantMeses; i++) {
    ultimo = new Date(a, m + i, 1);
    cont.appendChild(dibujarMes(ultimo.getFullYear(), ultimo.getMonth(), opts));
  }

  const rotulo = document.getElementById(ids.titulo);
  if (rotulo) {
    rotulo.textContent = cantMeses > 1
      ? `${MESES[m]} — ${MESES[ultimo.getMonth()]} ${ultimo.getFullYear()}`
      : `${MESES[m]} ${a}`;
  }

  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const prev = document.getElementById(ids.prev);
  const next = document.getElementById(ids.next);
  if (prev) prev.disabled = estado.mesBase <= inicioMes;
  if (next) next.disabled = ultimo >= LIMITE;
}

function dibujarCalendario() {
  // El modal elige las fechas antes que la modalidad, así que muestra libre
  // cualquier día donde alguna planta esté disponible.
  dibujarEn({ meses: 'mr-meses', titulo: 'mr-titulo-mes', prev: 'mr-prev', next: 'mr-next' }, 1,
            { union: true });
  pintarOpciones();
}

/* ----------------------------------------------------------- interacción */

function hayOcupadasEntre(desde, hasta, modalidad = estado.modalidad) {
  return Precios.hayOcupadasEntre(desde, hasta, modalidad, OCUPADAS);
}

function elegirFecha(iso, union = false) {
  const est = estadoDia(iso, estado.modalidad, union);

  // Un día que sólo sirve para salir no puede arrancar una estadía.
  const empezandoDeNuevo = !estado.entrada || estado.salida || iso <= estado.entrada;

  if (empezandoDeNuevo) {
    if (!est.entrada) {
      mostrarAviso('Ese día no se puede entrar: esa noche ya está ocupada.', 'error');
      return;
    }
    estado.entrada = iso;
    estado.salida = null;
  } else if (hayOcupadasEntre(estado.entrada, iso)) {
    // hay una reserva en el medio: empezamos de nuevo desde esta fecha
    estado.entrada = est.entrada ? iso : null;
    estado.salida = null;
    dibujarCalendario();
    actualizarResumen();
    // el aviso va al final para que no lo pise actualizarResumen()
    mostrarAviso('Entre esas fechas hay días ocupados. Elegí un tramo libre.', 'error');
    return;
  } else {
    estado.salida = iso;
  }
  dibujarCalendario();
  actualizarResumen();
}

function limpiarSeleccion() {
  estado.entrada = null;
  estado.salida = null;
  dibujarCalendario();
  actualizarResumen();
}

/** Cambia entre casa completa / planta alta / planta baja. */
function cambiarModalidad(id) {
  estado.modalidad = modalidadPorId(id);

  // si la selección actual dejó de estar disponible, la limpiamos
  if (estado.entrada && estado.salida && hayOcupadasEntre(estado.entrada, estado.salida)) {
    estado.entrada = null;
    estado.salida = null;
  } else if (estado.entrada && !libre(estado.entrada, estado.modalidad)) {
    estado.entrada = null;
    estado.salida = null;
  }

  llenarHuespedes();
  dibujarCalendario();
  actualizarResumen();

  // reserva.html escucha esto para repintar el detalle
  document.dispatchEvent(new CustomEvent('balcones:modalidad'));
}

/** El selector de huéspedes se limita a las plazas de la modalidad elegida. */
function llenarHuespedes() {
  const max = estado.modalidad.plazas;
  if (estado.huespedes > max) estado.huespedes = max;

  const sel = document.getElementById('rp-huespedes');
  if (!sel) return;
  sel.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${i} ${i === 1 ? 'huésped' : 'huéspedes'}`;
    if (i === estado.huespedes) o.selected = true;
    sel.appendChild(o);
  }
}

/* ------------------------------------------------------------- cotización */

/** Precio por noche de una temporada para la modalidad elegida. */
function precioNoche(temporada, modalidad) {
  return Precios.precioNoche(temporada, modalidad, CONFIG, estado.huespedes);
}

/**
 * Agrupa las noches por temporada y calcula el total.
 * Devuelve { noches, tramos: [{temporada, noches, subtotal}], total, minNoches }
 */
function cotizar(entrada, salida, modalidad = estado.modalidad) {
  return Precios.cotizar(entrada, salida, modalidad, CONFIG, estado.huespedes);
}

/* --------------------------------------------------------------- resumen */

function mostrarAviso(texto, tipo) {
  const el = document.getElementById('mr-aviso');
  if (!el) return;
  if (!texto) {
    el.className = 'aviso';
    el.textContent = '';
    return;
  }
  el.className = `aviso aviso--${tipo || 'error'}`;
  el.textContent = texto;
}

/**
 * Estado calculado de la selección actual. Lo usan el resumen de la sección,
 * el del drawer y el armado de la reserva que viaja a reserva.html.
 * -> { listo, motivo, cotizacion }
 */
function estadoReserva() {
  if (!estado.entrada || !estado.salida) {
    return {
      listo: false,
      motivo: estado.entrada ? 'falta-salida' : 'falta-entrada',
      cotizacion: null
    };
  }
  // En el flujo 'b' el calendario muestra libre lo que tenga alguna planta
  // disponible, así que la modalidad elegida puede no servir para ese tramo.
  if (hayOcupadasEntre(estado.entrada, estado.salida)) {
    return { listo: false, motivo: 'ocupada', cotizacion: null };
  }
  const c = cotizar(estado.entrada, estado.salida);
  if (c.noches < c.minNoches) return { listo: false, motivo: 'corta', cotizacion: c };
  return { listo: true, motivo: null, cotizacion: c };
}

/** Filas del desglose de precios. También la usa checkout.js. */
function htmlDesglose(c) {
  let html = '';
  c.tramos.forEach(tr => {
    html += `<div class="desglose__fila">
      <span>${tr.noches} ${tr.noches === 1 ? 'noche' : 'noches'} · ${tr.temporada.nombre.toLowerCase()}</span>
      <span>${pesos(tr.subtotal)}</span>
    </div>`;
  });
  html += `<div class="desglose__fila">
      <span>Total de noches</span><span>${c.noches}</span>
    </div>`;
  html += `<div class="desglose__fila desglose__fila--total">
      <span>Estimado</span><span>${pesos(c.total)}</span>
    </div>`;
  return html;
}

function actualizarResumen() {
  const r = estadoReserva();

  if (r.motivo === 'falta-entrada')      mostrarAviso('', null);
  else if (r.motivo === 'falta-salida')  mostrarAviso('Ahora elegí la fecha de salida.', 'ok');
  else if (r.motivo === 'corta')         mostrarAviso(`Para estas fechas la estadía mínima es de ${r.cotizacion.minNoches} noches.`, 'error');
  else if (r.motivo === 'ocupada')       mostrarAviso(`${estado.modalidad.nombre} no está libre en esas fechas. Mirá las otras opciones.`, 'error');
  else                                   mostrarAviso('', null);

  actualizarModal();
}

/* ------------------------------------------------------------- WhatsApp -- */
/* enlaceWsp también lo usa checkout.js. */
function enlaceWsp(texto) {
  return `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(texto)}`;
}

/* ------------------------------------------------------------ arranque -- */

/**
 * Lista las modalidades con el precio total para las fechas elegidas y cuáles
 * quedan libres. Es lo que evita que alguien se vaya al ver la casa completa
 * ocupada sin enterarse de que podía alquilar una planta.
 */
/** Foto de portada de cada modalidad. */
const FOTO_UNIDAD = {
  completa: 'img/casa-atardecer.jpg',
  alta: 'img/galeria-mesa.jpg',
  baja: 'img/living.jpg'
};

function pintarOpciones() {
  const cont = document.getElementById('rp-opciones');
  if (!cont) return;

  if (!estado.entrada || !estado.salida) {
    cont.innerHTML = '<p class="opcion__vacio">Elegí la entrada y la salida y te mostramos ' +
                     'cada opción con su precio.</p>';
    return;
  }

  cont.innerHTML = CONFIG.modalidades.map(m => {
    const ocupada = hayOcupadasEntre(estado.entrada, estado.salida, m);
    const c = cotizar(estado.entrada, estado.salida, m);
    const corta = c.noches < c.minNoches;
    const elegida = m.id === estado.modalidad.id;
    const nodisp = ocupada || corta;

    let estadoTexto = '';
    if (ocupada) estadoTexto = '<span class="opcion__no">No disponible en esas fechas</span>';
    else if (corta) estadoTexto = `<span class="opcion__no">Mínimo ${c.minNoches} noches</span>`;

    return `
      <button type="button" class="opcion opcion--foto${elegida && !nodisp ? ' opcion--elegida' : ''}${nodisp ? ' opcion--nodisp' : ''}"
              data-modalidad="${m.id}" ${nodisp ? 'disabled' : ''}>
        <img class="opcion__img" src="${FOTO_UNIDAD[m.id]}" alt="" loading="lazy">
        <span class="opcion__info">
          <strong>${m.nombre}</strong>
          <small>${m.plazas} plazas · ${m.detalle}</small>
          ${estadoTexto}
        </span>
        ${nodisp ? '' : `
        <span class="opcion__precio">
          <strong>${pesos(c.total)}</strong>
          <small>${pesos(Math.round(c.total / c.noches))} la noche</small>
          <small>${c.noches} ${c.noches === 1 ? 'noche' : 'noches'}</small>
        </span>`}
      </button>`;
  }).join('');

  cont.querySelectorAll('.opcion:not([disabled])').forEach(b => {
    b.addEventListener('click', () => cambiarModalidad(b.dataset.modalidad));
  });
}

/* ------------------------------------------------------ paso a la reserva */

/** Clave con la que viaja la reserva elegida hasta reserva.html. */
const CLAVE_RESERVA = 'balcones:reserva';

/**
 * Guarda la selección y abre la página de reserva. Se guardan sólo los datos
 * elegidos, no los precios: reserva.html los vuelve a calcular con config.js
 * para que nadie pueda manipularlos desde el navegador.
 */
function irAReserva() {
  // Alcanza con las fechas: qué se alquila se elige en reserva.html, donde se
  // ve el precio de cada opción. La modalidad viaja sólo como sugerencia.
  if (!estado.entrada || !estado.salida) return;

  sessionStorage.setItem(CLAVE_RESERVA, JSON.stringify({
    modalidad: estado.modalidad.id,
    entrada: estado.entrada,
    salida: estado.salida,
    huespedes: estado.huespedes
  }));

  window.location.href = 'reserva.html';
}

/* ----------------------------------------- modal de fechas (flujo 'c') -- */
/* El modal hace una sola cosa: elegir las fechas. Qué se alquila, el detalle
   y el pago van en reserva.html. Es el flujo principal. */

function abrirModalReserva() {
  const m = document.getElementById('modal-res');
  if (!m) return;
  m.classList.add('abierto');
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  actualizarModal();
  const cerrar = document.getElementById('mr-cerrar');
  if (cerrar) cerrar.focus();
}

function cerrarModalReserva() {
  const m = document.getElementById('modal-res');
  if (!m) return;
  m.classList.remove('abierto');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/** Refresca el pie del modal según lo que haya elegido. */
function actualizarModal() {
  const m = document.getElementById('modal-res');
  if (!m || !m.classList.contains('abierto')) return;

  const hayFechas = !!(estado.entrada && estado.salida);
  const siguiente = document.getElementById('mr-siguiente');
  const limpiar = document.getElementById('mr-limpiar');
  const estadoTxt = document.getElementById('mr-estado');

  // limpiar aparece recién cuando hay algo que limpiar
  if (limpiar) limpiar.hidden = !estado.entrada;

  siguiente.disabled = !hayFechas;

  const noches = hayFechas ? nochesEntre(estado.entrada, estado.salida) : 0;
  estadoTxt.textContent = hayFechas
    ? `${formatoFechaLarga(estado.entrada)} al ${formatoFechaLarga(estado.salida)} · ${noches} ${noches === 1 ? 'noche' : 'noches'}`
    : estado.entrada ? 'Ahora elegí la fecha de salida'
    : 'Elegí las fechas para continuar';
}

function iniciarModalReserva() {
  const m = document.getElementById('modal-res');
  if (!m) return;

  // Cualquier botón con data-reservar abre el modal, en vez de saltar a una
  // sección. Va por delegación para que también sirva en lo que se pinta
  // después (por ejemplo las tarjetas de tarifas).
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-reservar]');
    if (!b) return;
    e.preventDefault();
    abrirModalReserva();
  });

  document.getElementById('mr-cerrar').addEventListener('click', cerrarModalReserva);
  m.querySelector('.modal-res__fondo').addEventListener('click', cerrarModalReserva);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && m.classList.contains('abierto')) cerrarModalReserva();
  });

  document.getElementById('mr-prev').addEventListener('click', () => {
    estado.mesBase = new Date(estado.mesBase.getFullYear(), estado.mesBase.getMonth() - 1, 1);
    dibujarCalendario();
  });
  document.getElementById('mr-next').addEventListener('click', () => {
    estado.mesBase = new Date(estado.mesBase.getFullYear(), estado.mesBase.getMonth() + 1, 1);
    dibujarCalendario();
  });
  document.getElementById('mr-limpiar').addEventListener('click', limpiarSeleccion);
  document.getElementById('mr-siguiente').addEventListener('click', irAReserva);
}

function iniciarReservas() {
  llenarHuespedes();
  iniciarModalReserva();
  dibujarCalendario();
  actualizarResumen();
}
