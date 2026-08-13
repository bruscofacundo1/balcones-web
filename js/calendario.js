/* ============================================================================
   Balcones del Arroyo — calendario de disponibilidad y cotizador
   Depende de: config.js, disponibilidad.js

   La casa se alquila entera o por planta. La disponibilidad se lleva por
   planta ('alta' y 'baja'); la casa completa necesita las dos libres.
   ============================================================================ */

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_CORTOS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

/* ------------------------------------------------------------- utilidades */

/** Fecha -> 'AAAA-MM-DD' usando la hora local (nunca UTC). */
function aIso(fecha) {
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

/** 'AAAA-MM-DD' -> Date local a medianoche. */
function deIso(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function sumarDias(fecha, n) {
  const f = new Date(fecha);
  f.setDate(f.getDate() + n);
  return f;
}

function nochesEntre(desde, hasta) {
  return Math.round((deIso(hasta) - deIso(desde)) / 86400000);
}

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

/**
 * Índice de noches ocupadas por planta.
 * Acepta también el formato viejo (una sola lista `ocupadas`), que se
 * interpreta como la casa entera ocupada.
 */
const OCUPADAS = (() => {
  const d = DISPONIBILIDAD || {};
  if (Array.isArray(d.ocupadas)) {
    const todas = new Set(d.ocupadas);
    return { alta: todas, baja: new Set(todas) };
  }
  return { alta: new Set(d.alta || []), baja: new Set(d.baja || []) };
})();

function modalidadPorId(id) {
  return CONFIG.modalidades.find(m => m.id === id) || CONFIG.modalidades[0];
}

/** ¿La modalidad elegida está libre esa noche? */
function libre(iso, modalidad) {
  return modalidad.ocupa.every(planta => !OCUPADAS[planta].has(iso));
}

/** ¿Queda algo para alquilar esa noche, aunque sea una sola planta? */
function libreAlguna(iso) {
  return CONFIG.modalidades.some(m => libre(iso, m));
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

/**
 * Devuelve la temporada que corresponde a una fecha ISO.
 * Los rangos se definen como 'MM-DD' y se repiten todos los años; si el rango
 * termina antes de empezar (12-20 -> 02-28) se entiende que cruza el año.
 */
function temporadaDe(iso) {
  const md = iso.slice(5); // 'MM-DD'
  for (const t of CONFIG.temporadas) {
    for (const r of t.rangos) {
      const cruzaAnio = r.hasta < r.desde;
      const dentro = cruzaAnio
        ? (md >= r.desde || md <= r.hasta)
        : (md >= r.desde && md <= r.hasta);
      if (dentro) return t;
    }
  }
  return null;
}

/** Temporada por defecto cuando una fecha no cae en ningún rango. */
function temporadaFallback() {
  return CONFIG.temporadas.find(t => t.id === 'media') || CONFIG.temporadas[0];
}

/* --------------------------------------------------------------- estado -- */

const estado = {
  modalidad: modalidadPorId('completa'),
  entrada: null,        // ISO
  salida: null,         // ISO
  huespedes: 2,
  mesBase: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
};

/* --------------------------------------------------------------- variante
   Tres formas de reservar, para comparar cuál funciona mejor:
     'c' = modal en pasos: fechas, después qué alquilás, y el pago aparte
     'b' = panel lateral: fechas y después las opciones con precio
     'a' = panel lateral: primero qué alquilás y después las fechas
   Cuál está activa lo maneja variantes.js.                                */
let VARIANTE = Variantes.get('reservas');

Variantes.alCambiar('reservas', v => {
  VARIANTE = v;
  cerrarDrawer();
  cerrarModalReserva();
  aplicarVariante();
  dibujarCalendario();
  actualizarResumen();
});

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
  ajustarModalidadSiHaceFalta();
  // La sección de la home siempre usa el flujo 'a' (ahí se elige la modalidad
  // con los tabs); la variante sólo cambia el drawer.
  dibujarEn({ meses: 'cal-meses', titulo: 'cal-titulo', prev: 'cal-prev', next: 'cal-next' }, 2);
  dibujarEn({ meses: 'dr-meses',  titulo: 'dr-titulo',  prev: 'dr-prev',  next: 'dr-next'  }, 1,
            { union: VARIANTE === 'b' });
  // el modal siempre elige las fechas antes que la modalidad
  dibujarEn({ meses: 'mr-meses', titulo: 'mr-titulo-mes', prev: 'mr-prev', next: 'mr-next' }, 1,
            { union: true });
  pintarOpciones();
}

/* ----------------------------------------------------------- interacción */

function hayOcupadasEntre(desde, hasta, modalidad = estado.modalidad) {
  let f = deIso(desde);
  const fin = deIso(hasta);
  while (f < fin) {
    if (!libre(aIso(f), modalidad)) return true;
    f = sumarDias(f, 1);
  }
  return false;
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

  document.querySelectorAll('#modalidades .tab, #dr-modalidades .tab').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.modalidad === id));
  });

  // si la selección actual dejó de estar disponible, la limpiamos
  if (estado.entrada && estado.salida && hayOcupadasEntre(estado.entrada, estado.salida)) {
    estado.entrada = null;
    estado.salida = null;
  } else if (estado.entrada && !libre(estado.entrada, estado.modalidad)) {
    estado.entrada = null;
    estado.salida = null;
  }

  llenarHuespedes();
  pintarReferenciasTemporada();
  dibujarCalendario();
  actualizarResumen();

  // reserva.html escucha esto para repintar el detalle
  document.dispatchEvent(new CustomEvent('balcones:modalidad'));
}

/** El selector de huéspedes se limita a las plazas de la modalidad elegida. */
function llenarHuespedes() {
  const max = estado.modalidad.plazas;
  if (estado.huespedes > max) estado.huespedes = max;

  ['res-huespedes', 'dr-huespedes', 'rp-huespedes'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    for (let i = 1; i <= max; i++) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${i} ${i === 1 ? 'huésped' : 'huéspedes'}`;
      if (i === estado.huespedes) o.selected = true;
      sel.appendChild(o);
    }
  });
}

/* ------------------------------------------------------------- cotización */

/** Precio por noche de una temporada para la modalidad elegida. */
function precioNoche(temporada, modalidad) {
  const base = temporada.precios[modalidad.id];
  return CONFIG.reglas.precioPorUnidad ? base : base * estado.huespedes;
}

/**
 * Agrupa las noches por temporada y calcula el total.
 * Devuelve { noches, tramos: [{temporada, noches, subtotal}], total, minNoches }
 */
function cotizar(entrada, salida, modalidad = estado.modalidad) {
  const tramos = new Map();
  let total = 0;
  let minNoches = CONFIG.reglas.minNochesGeneral;

  let f = deIso(entrada);
  const fin = deIso(salida);
  while (f < fin) {
    const t = temporadaDe(aIso(f)) || temporadaFallback();
    const precio = precioNoche(t, modalidad);

    const acc = tramos.get(t.id) || { temporada: t, noches: 0, subtotal: 0 };
    acc.noches += 1;
    acc.subtotal += precio;
    tramos.set(t.id, acc);

    total += precio;
    minNoches = Math.max(minNoches, t.minNoches || 0);
    f = sumarDias(f, 1);
  }

  return {
    noches: nochesEntre(entrada, salida),
    tramos: [...tramos.values()],
    total,
    minNoches
  };
}

/* --------------------------------------------------------------- resumen */

function mostrarAviso(texto, tipo) {
  ['reserva-aviso', 'dr-aviso'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!texto) {
      el.className = 'aviso';
      el.textContent = '';
      return;
    }
    el.className = `aviso aviso--${tipo || 'error'}`;
    el.textContent = texto;
  });
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

/**
 * En el flujo 'b' la modalidad se elige después de las fechas: si la que está
 * marcada no sirve para el tramo, pasamos a la primera que sí.
 */
function ajustarModalidadSiHaceFalta() {
  if (VARIANTE !== 'b' || !estado.entrada || !estado.salida) return;
  if (modalidadElegidaSirve()) return;

  const alternativa = CONFIG.modalidades.find(m => {
    if (hayOcupadasEntre(estado.entrada, estado.salida, m)) return false;
    const c = cotizar(estado.entrada, estado.salida, m);
    return c.noches >= c.minNoches;
  });
  if (alternativa) estado.modalidad = alternativa;
}

/** Filas del desglose de precios, compartidas por la sección y el drawer. */
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

  // avisos (los pinta en la sección y en el drawer a la vez)
  if (r.motivo === 'falta-entrada')      mostrarAviso('', null);
  else if (r.motivo === 'falta-salida')  mostrarAviso('Ahora elegí la fecha de salida.', 'ok');
  else if (r.motivo === 'corta')         mostrarAviso(`Para estas fechas la estadía mínima es de ${r.cotizacion.minNoches} noches.`, 'error');
  else if (r.motivo === 'ocupada')       mostrarAviso(`${estado.modalidad.nombre} no está libre en esas fechas. Mirá las otras opciones.`, 'error');
  else                                   mostrarAviso('', null);

  pintarPanel({
    entrada: 'res-entrada', salida: 'res-salida', desglose: 'res-desglose',
    unidad: 'res-unidad', continuar: 'res-continuar', wsp: 'res-wsp'
  }, r);

  pintarPanel({
    entrada: 'dr-entrada', salida: 'dr-salida', desglose: 'dr-desglose',
    unidad: 'dr-unidad', continuar: 'dr-continuar'
  }, r);

  actualizarModal();
}

/** Pinta un panel de resumen (el de la sección o el del drawer). */
function pintarPanel(ids, r) {
  const elEntrada = document.getElementById(ids.entrada);
  if (!elEntrada) return;

  const elSalida = document.getElementById(ids.salida);
  const elDesglose = document.getElementById(ids.desglose);
  const elUnidad = document.getElementById(ids.unidad);
  const btn = document.getElementById(ids.continuar);
  const wsp = ids.wsp ? document.getElementById(ids.wsp) : null;

  if (elUnidad) {
    elUnidad.textContent = `${estado.modalidad.nombre} · hasta ${estado.modalidad.plazas} personas`;
  }

  elEntrada.textContent = estado.entrada ? formatoFechaLarga(estado.entrada) : 'Elegí una fecha';
  elEntrada.classList.toggle('campo__valor--vacio', !estado.entrada);
  if (elSalida) {
    elSalida.textContent = estado.salida ? formatoFechaLarga(estado.salida) : 'Elegí una fecha';
    elSalida.classList.toggle('campo__valor--vacio', !estado.salida);
  }

  if (elDesglose) elDesglose.innerHTML = r.listo ? htmlDesglose(r.cotizacion) : '';
  if (wsp) wsp.hidden = !r.listo;

  if (!btn) return;
  btn.disabled = !r.listo;
  btn.textContent = r.listo ? 'Continuar con la reserva'
    : r.motivo === 'corta' ? 'Estadía muy corta'
    : r.motivo === 'ocupada' ? 'No disponible'
    : 'Elegí las fechas';
}

/* ------------------------------------------------------------- WhatsApp -- */

function mensajeReserva() {
  const l = [];
  l.push('¡Hola! Quiero consultar disponibilidad en Balcones del Arroyo.');
  l.push('');
  l.push(`• Modalidad: ${estado.modalidad.nombre}`);
  if (estado.entrada && estado.salida) {
    const c = cotizar(estado.entrada, estado.salida);
    l.push(`• Entrada: ${formatoFechaLarga(estado.entrada)}`);
    l.push(`• Salida: ${formatoFechaLarga(estado.salida)}`);
    l.push(`• Noches: ${c.noches}`);
    l.push(`• Huéspedes: ${estado.huespedes}`);
    l.push(`• Estimado según la web: ${pesos(c.total)}`);
  } else {
    l.push(`• Huéspedes: ${estado.huespedes}`);
  }
  l.push('');
  l.push('¿Está disponible? ¡Gracias!');
  return l.join('\n');
}

function enlaceWsp(texto) {
  return `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(texto)}`;
}

/* ------------------------------------------------------------ arranque -- */

function pintarModalidades() {
  ['modalidades', 'dr-modalidades'].forEach(id => {
    const cont = document.getElementById(id);
    if (!cont) return;
    cont.innerHTML = CONFIG.modalidades.map(m => `
      <button class="tab" data-modalidad="${m.id}"
              aria-selected="${m.id === estado.modalidad.id}">
        ${m.nombre} <small>· ${m.plazas} plazas</small>
      </button>`).join('');

    cont.querySelectorAll('.tab').forEach(b => {
      b.addEventListener('click', () => cambiarModalidad(b.dataset.modalidad));
    });
  });
}

/**
 * Leyenda de colores del calendario con el precio por noche de cada
 * temporada, para la modalidad elegida. Se actualiza al cambiar de modalidad
 * así se ve cuánto sale cada época sin tener que elegir fechas primero.
 */
function pintarReferenciasTemporada() {
  ['cal-temporadas', 'dr-temporadas'].forEach(id => {
    const cont = document.getElementById(id);
    if (!cont) return;
    cont.innerHTML = CONFIG.temporadas.map(t => `
      <span class="ref ref--temp">
        <span class="ref__caja" style="background:${tinte(t.color, .16)};border-color:${tinte(t.color, .45)}"></span>
        <span class="ref__nombre">${t.nombre.replace(/^Temporada /, '')}</span>
        <strong>${pesos(t.precios[estado.modalidad.id])}</strong>
      </span>`).join('');
  });
}

/* ------------------------------------------ opciones con precio (flujo b) */

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
  [['dr-opciones', false], ['rp-opciones', true]].forEach(([id, conFoto]) => {
    const cont = document.getElementById(id);
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
        <button type="button" class="opcion${conFoto ? ' opcion--foto' : ''}${elegida && !nodisp ? ' opcion--elegida' : ''}${nodisp ? ' opcion--nodisp' : ''}"
                data-modalidad="${m.id}" ${nodisp ? 'disabled' : ''}>
          ${conFoto ? `<img class="opcion__img" src="${FOTO_UNIDAD[m.id]}" alt="" loading="lazy">` : ''}
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
  });
}

/** ¿La modalidad elegida sirve para las fechas elegidas? (sólo flujo 'b') */
function modalidadElegidaSirve() {
  if (!estado.entrada || !estado.salida) return false;
  if (hayOcupadasEntre(estado.entrada, estado.salida)) return false;
  const c = cotizar(estado.entrada, estado.salida);
  return c.noches >= c.minNoches;
}

/* --------------------------------------------------- mostrar la variante */

/** Muestra u oculta los bloques del drawer según el flujo elegido. */
function aplicarVariante() {
  const dr = document.getElementById('drawer');
  if (!dr) return;
  dr.dataset.variante = VARIANTE;

  // La 'c' abre el modal, no el drawer, pero dejamos rótulos por las dudas.
  const rotulos = {
    a: { modalidad: '1 · Qué querés alquilar', fechas: '2 · Elegí las fechas', opciones: '' },
    b: { modalidad: '', fechas: '1 · Elegí las fechas', opciones: '2 · Qué querés alquilar' }
  }[VARIANTE] || { modalidad: '', fechas: '1 · Elegí las fechas', opciones: '2 · Qué querés alquilar' };

  const set = (id, texto) => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  };
  set('dr-paso-modalidad', rotulos.modalidad);
  set('dr-paso-fechas', rotulos.fechas);
  set('dr-paso-opciones', rotulos.opciones);

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

/* --------------------------------------------------------------- drawer -- */

function abrirDrawer() {
  const dr = document.getElementById('drawer');
  if (!dr) return;
  dr.classList.add('abierto');
  dr.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const cerrar = document.getElementById('dr-cerrar');
  if (cerrar) cerrar.focus();
}

function cerrarDrawer() {
  const dr = document.getElementById('drawer');
  if (!dr) return;
  dr.classList.remove('abierto');
  dr.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function iniciarDrawer() {
  const dr = document.getElementById('drawer');
  if (!dr) return;

  // Cualquier botón con data-reservar abre el panel en vez de saltar a la
  // sección. Va por delegación para que también sirva en lo que se pinta
  // después (por ejemplo las tarjetas de tarifas).
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-reservar]');
    if (!b) return;
    e.preventDefault();
    if (VARIANTE === 'c') abrirModalReserva();
    else abrirDrawer();
  });

  document.getElementById('dr-cerrar').addEventListener('click', cerrarDrawer);
  dr.querySelector('.drawer__fondo').addEventListener('click', cerrarDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dr.classList.contains('abierto')) cerrarDrawer();
  });

  document.getElementById('dr-prev').addEventListener('click', () => {
    estado.mesBase = new Date(estado.mesBase.getFullYear(), estado.mesBase.getMonth() - 1, 1);
    dibujarCalendario();
  });
  document.getElementById('dr-next').addEventListener('click', () => {
    estado.mesBase = new Date(estado.mesBase.getFullYear(), estado.mesBase.getMonth() + 1, 1);
    dibujarCalendario();
  });
  document.getElementById('dr-limpiar').addEventListener('click', limpiarSeleccion);

  document.getElementById('dr-huespedes').addEventListener('change', e => {
    estado.huespedes = Number(e.target.value);
    actualizarResumen();
  });

  document.getElementById('dr-continuar').addEventListener('click', irAReserva);
  aplicarVariante();
}

function iniciarReservas() {
  pintarModalidades();
  llenarHuespedes();
  pintarReferenciasTemporada();
  iniciarDrawer();
  iniciarModalReserva();

  if (document.getElementById('cal-meses')) {
    document.getElementById('cal-prev').addEventListener('click', () => {
      estado.mesBase = new Date(estado.mesBase.getFullYear(), estado.mesBase.getMonth() - 1, 1);
      dibujarCalendario();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      estado.mesBase = new Date(estado.mesBase.getFullYear(), estado.mesBase.getMonth() + 1, 1);
      dibujarCalendario();
    });
    document.getElementById('cal-limpiar').addEventListener('click', limpiarSeleccion);

    document.getElementById('res-huespedes').addEventListener('change', e => {
      estado.huespedes = Number(e.target.value);
      actualizarResumen();
    });

    document.getElementById('res-continuar').addEventListener('click', irAReserva);
    document.getElementById('res-wsp').addEventListener('click', e => {
      e.preventDefault();
      window.open(enlaceWsp(mensajeReserva()), '_blank', 'noopener');
    });

    const act = document.getElementById('disp-actualizado');
    if (act && DISPONIBILIDAD.actualizado) {
      act.textContent = `Disponibilidad actualizada al ${formatoFechaLarga(DISPONIBILIDAD.actualizado)}.`;
    }
  }

  dibujarCalendario();
  actualizarResumen();
}
