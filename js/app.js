/* ============================================================================
   Balcones del Arroyo — armado de la página
   Depende de: config.js, calendario.js
   ============================================================================ */

const IMG = f => `img/${f}.jpg`;
const THUMB = f => `img/thumb/${f}.jpg`;

/* -------------------------------------------------------------- navegación */
function iniciarNav() {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('nav-burger');
  const links = document.getElementById('nav-links');

  // El "Reservar" del menú late una sola vez, la primera vez que se deja
  // atrás el inicio: ahí desaparece de la vista el botón grande del hero y
  // éste pasa a ser la única puerta a reservar. Después no molesta más.
  let yaLlamo = false;
  const alScrollear = () => {
    const solida = window.scrollY > 60;
    nav.classList.toggle('nav--solida', solida);
    if (solida && !yaLlamo) {
      yaLlamo = true;
      nav.classList.add('nav--llamar');
    }
  };
  alScrollear();
  window.addEventListener('scroll', alScrollear, { passive: true });

  burger.addEventListener('click', () => {
    const abierto = links.classList.toggle('abierto');
    burger.setAttribute('aria-expanded', String(abierto));
  });
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('abierto');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ------------------------------------------------------------ animaciones */
function iniciarRevelado() {
  const items = document.querySelectorAll('.revelar');
  const mostrarTodo = () => items.forEach(i => i.classList.add('visible'));

  if (!('IntersectionObserver' in window)) return;   // sin animación, todo visible

  document.documentElement.classList.add('anim');

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach(i => obs.observe(i));

  // red de seguridad: si por algún motivo el observer no se dispara,
  // a los 3 segundos mostramos todo igual.
  setTimeout(mostrarTodo, 3000);
}

/* ----------------------------------------------------------- datos varios */
function pintarCifras() {
  const c = CONFIG.casa;
  document.getElementById('casa-cifras').textContent =
    `${c.huespedes} huéspedes · ${c.dormitorios} dormitorios · ${c.banos} baños · ${c.cocinas} cocinas · ${c.plantas} plantas`;
}

function pintarComodidades() {
  document.getElementById('comodidades').innerHTML =
    CONFIG.comodidades.map(c => `<li>${c}</li>`).join('');
}

function pintarTextosCasa() {
  document.getElementById('casa-titulo').textContent = CONFIG.textos.casaTitulo;
  document.getElementById('casa-texto').innerHTML =
    CONFIG.textos.casaTexto.map(p => `<p>${p}</p>`).join('');
  document.getElementById('hero-titulo').textContent = CONFIG.textos.heroTitulo;
  document.getElementById('hero-bajada').textContent = CONFIG.textos.heroBajada;
}

function pintarDistancias() {
  document.getElementById('distancias').innerHTML = CONFIG.distancias.map(d => `
    <li><span class="lugar">${d.lugar}</span><span class="dist">${d.km}</span></li>`).join('');
  document.getElementById('mapa-direccion').textContent = CONFIG.contacto.direccion;

  const { lat, lng, zoom } = CONFIG.contacto.mapa;
  document.getElementById('mapa-frame').src =
    `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=es&output=embed`;
  document.getElementById('mapa-link').href =
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/* -------------------------------------------------------------- ambientes */
function pintarAmbientes(planta = 'todas') {
  const lista = planta === 'todas'
    ? AMBIENTES
    : AMBIENTES.filter(a => a.planta === planta);

  document.getElementById('ambientes').innerHTML = lista.map(a => `
    <article class="ambiente">
      <img src="${THUMB(a.foto)}" alt="${a.titulo}" loading="lazy"
           data-foto="${a.foto}" data-titulo="${a.titulo}">
      <div class="ambiente__cuerpo">
        <p class="ambiente__meta">${a.meta}</p>
        <h3>${a.titulo}</h3>
        <p>${a.texto}</p>
      </div>
    </article>`).join('');

  document.querySelectorAll('#ambientes img').forEach(img => {
    img.addEventListener('click', () => abrirLightbox(
      [{ f: img.dataset.foto, t: img.dataset.titulo }], 0));
  });
}

function iniciarTabsAmbientes() {
  const tabs = document.querySelectorAll('#tabs-ambientes .tab');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(o => o.setAttribute('aria-selected', 'false'));
      t.setAttribute('aria-selected', 'true');
      plantaAmbientes = t.dataset.planta;
      pintarAmbientes(plantaAmbientes);
      pintarCarruselAmbientes(plantaAmbientes);
    });
  });
}

/* ------------------------------------------------ carrusel de ambientes -- */
/* Variante A: una foto grande por vez, con las vecinas asomando a los lados.
   Ocupa mucho menos alto que la grilla, sobre todo en celular. */

let plantaAmbientes = 'todas';
let carrIndice = 0;
let carrLista = [];

function pintarCarruselAmbientes(planta = 'todas') {
  const pista = document.getElementById('carr-pista');
  if (!pista) return;

  carrLista = planta === 'todas' ? AMBIENTES : AMBIENTES.filter(a => a.planta === planta);
  carrIndice = 0;

  // La variante 'c' muestra la foto casi a pantalla completa: con la miniatura
  // (760px de ancho) se vería borrosa, así que ahí va la foto grande.
  const src = Variantes.get('ambientes') === 'c' ? IMG : THUMB;

  pista.innerHTML = carrLista.map((a, i) => `
    <figure class="carrusel__item" data-i="${i}">
      <img src="${src(a.foto)}" alt="${a.titulo}" loading="lazy"
           data-foto="${a.foto}" data-titulo="${a.titulo}">
      <figcaption class="carrusel__pie">
        <p class="carrusel__meta">${a.meta}</p>
        <h3>${a.titulo}</h3>
        <p class="carrusel__texto">${a.texto}</p>
      </figcaption>
    </figure>`).join('');

  document.getElementById('carr-puntos').innerHTML = carrLista.map((_, i) =>
    `<button class="carrusel__punto" data-i="${i}" aria-label="Foto ${i + 1}"></button>`).join('');

  document.querySelectorAll('#carr-puntos .carrusel__punto').forEach(b => {
    b.addEventListener('click', () => moverCarrusel(Number(b.dataset.i), true));
  });

  // la foto del medio se abre grande
  pista.querySelectorAll('.carrusel__item img').forEach(img => {
    img.addEventListener('click', () => {
      const i = Number(img.closest('.carrusel__item').dataset.i);
      if (i === carrIndice) abrirLightbox(carrLista.map(a => ({ f: a.foto, t: a.titulo })), i);
      else moverCarrusel(i, true);
    });
  });

  moverCarrusel(0);
}

function moverCarrusel(i, animar) {
  if (!carrLista.length) return;
  carrIndice = (i + carrLista.length) % carrLista.length;

  const pista = document.getElementById('carr-pista');
  const items = [...pista.children];
  items.forEach((el, n) => {
    el.classList.toggle('carrusel__item--activo', n === carrIndice);
    el.classList.toggle('carrusel__item--prev', n === (carrIndice - 1 + items.length) % items.length);
    el.classList.toggle('carrusel__item--next', n === (carrIndice + 1) % items.length);
  });

  document.querySelectorAll('#carr-puntos .carrusel__punto').forEach((b, n) => {
    b.classList.toggle('carrusel__punto--activo', n === carrIndice);
  });

  if (animar) pista.classList.add('carrusel__pista--anim');
}

function iniciarCarruselAmbientes() {
  const prev = document.getElementById('carr-prev');
  if (!prev) return;
  prev.addEventListener('click', () => moverCarrusel(carrIndice - 1, true));
  document.getElementById('carr-next').addEventListener('click', () => moverCarrusel(carrIndice + 1, true));

  // flechas del teclado cuando el carrusel está a la vista
  document.addEventListener('keydown', e => {
    if (document.getElementById('lightbox').classList.contains('abierto')) return;
    if (Variantes.get('ambientes') === 'b') return;   // la grilla no se navega
    const caja = document.getElementById('ambientes-carrusel');
    const r = caja.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0) return;
    if (e.key === 'ArrowLeft') moverCarrusel(carrIndice - 1, true);
    if (e.key === 'ArrowRight') moverCarrusel(carrIndice + 1, true);
  });
}

/**
 * Muestra la grilla o el carrusel según la variante elegida.
 * 'a' y 'c' son el mismo carrusel con distinta piel: cambia sólo el CSS
 * (y la foto que se carga), así que la lógica de navegación es una sola.
 */
function aplicarVarianteAmbientes(v = Variantes.get('ambientes')) {
  const carr = document.getElementById('ambientes-carrusel');
  const grilla = document.getElementById('ambientes');
  if (!carr || !grilla) return;

  carr.hidden = v === 'b';
  grilla.hidden = v !== 'b';
  carr.classList.toggle('carrusel--pantalla', v === 'c');

  if (v !== 'b') pintarCarruselAmbientes(plantaAmbientes);
}

/* ---------------------------------------------------------- actividades -- */
/* Cuatro arriba, en la home; el resto sólo aparece si tocás "Ver más" —
   ocho tarjetas de 3:4 eran la sección más larga del inicio en celular,
   después del FAQ. */
function tarjetasActividades(lista) {
  return lista.map(a => `
    <article class="actividad">
      <img src="${THUMB(a.foto)}" alt="${a.titulo}" loading="lazy">
      <div class="actividad__cuerpo">
        <h3>${a.titulo}</h3>
        <p>${a.texto}</p>
      </div>
    </article>`).join('');
}

function pintarActividades() {
  document.getElementById('actividades').innerHTML = tarjetasActividades(ACTIVIDADES.slice(0, 4));
  document.getElementById('todas-actividades-grid').innerHTML = tarjetasActividades(ACTIVIDADES);
}

function abrirTodasActividades() {
  const caja = document.getElementById('todas-actividades');
  if (!caja) return;
  caja.classList.add('abierto');
  caja.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('ta-cerrar').focus();
}

function cerrarTodasActividades() {
  const caja = document.getElementById('todas-actividades');
  if (!caja) return;
  caja.classList.remove('abierto');
  caja.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function iniciarTodasActividades() {
  const boton = document.getElementById('btn-ver-actividades');
  if (!boton) return;
  boton.addEventListener('click', abrirTodasActividades);
  document.getElementById('ta-cerrar').addEventListener('click', cerrarTodasActividades);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('todas-actividades').classList.contains('abierto')) {
      cerrarTodasActividades();
    }
  });
}

/* --------------------------------------------------------------- galería */
let fotosVisibles = FOTOS;

function pintarGaleria(categoria = 'todas') {
  fotosVisibles = categoria === 'todas' ? FOTOS : FOTOS.filter(f => f.c === categoria);

  document.getElementById('galeria-grid').innerHTML = fotosVisibles.map((foto, i) => `
    <figure class="galeria__item" data-i="${i}">
      <img src="${THUMB(foto.f)}" alt="${foto.t}" loading="lazy">
      <figcaption>${foto.t}</figcaption>
    </figure>`).join('');

  document.querySelectorAll('.galeria__item').forEach(el => {
    el.addEventListener('click', () => abrirLightbox(fotosVisibles, Number(el.dataset.i)));
  });
}

function iniciarFiltros() {
  const filtros = document.querySelectorAll('#filtros .tab');
  filtros.forEach(f => {
    f.addEventListener('click', () => {
      filtros.forEach(o => o.setAttribute('aria-selected', 'false'));
      f.setAttribute('aria-selected', 'true');
      pintarGaleria(f.dataset.cat);
    });
  });
}

/* ------------------------------------------------- galería en 3 niveles -- */
/* Variante A. Nivel 1: un mosaico corto con lo mejor. Nivel 2: todas las
   fotos chiquitas. Nivel 3: una por una. Así la home no se hace eterna,
   que es el problema que tenía con 56 fotos en fila. */

/** Las que van en el mosaico: primero el entorno y las de afuera. */
function fotosDestacadas() {
  const orden = ['entorno', 'aire-libre', 'casa', 'interiores'];
  const elegidas = [];
  orden.forEach(cat => {
    FOTOS.filter(f => f.c === cat).slice(0, 3).forEach(f => elegidas.push(f));
  });
  return (elegidas.length ? elegidas : FOTOS).slice(0, 8);
}

function pintarMosaico() {
  const cont = document.getElementById('mosaico');
  if (!cont) return;

  const destacadas = fotosDestacadas();
  const restantes = FOTOS.length - destacadas.length;

  cont.innerHTML = destacadas.map((foto, i) => `
    <figure class="mosaico__item" data-i="${i}">
      <img src="${THUMB(foto.f)}" alt="${foto.t}" loading="lazy">
      ${i === destacadas.length - 1 && restantes > 0
        ? `<figcaption class="mosaico__mas">+${restantes} fotos</figcaption>` : ''}
    </figure>`).join('');

  // Cualquier foto del mosaico abre el listado completo, no la foto sola.
  // El mosaico es la vidriera: mostrás ocho, y el que se engancha con
  // cualquiera de ellas quiere ver el resto, no esa foto en grande. Desde el
  // listado sí se abre una por una.
  cont.querySelectorAll('.mosaico__item').forEach(el => {
    el.addEventListener('click', abrirTodasLasFotos);
  });

  const pie = document.createElement('button');
  pie.className = 'boton boton--linea mosaico__boton';
  pie.textContent = `Ver las ${FOTOS.length} fotos`;
  pie.addEventListener('click', abrirTodasLasFotos);
  cont.appendChild(pie);
}

/* ------------------------------------------------ nivel 2: todas juntas -- */
let tfCategoria = 'todas';

function pintarTodasLasFotos(categoria = 'todas') {
  tfCategoria = categoria;
  const lista = categoria === 'todas' ? FOTOS : FOTOS.filter(f => f.c === categoria);

  document.getElementById('tf-grilla').innerHTML = lista.map((foto, i) => `
    <figure class="tf__item" data-i="${i}">
      <img src="${THUMB(foto.f)}" alt="${foto.t}" loading="lazy">
      <figcaption class="tf__pie">${foto.t}</figcaption>
    </figure>`).join('');

  document.querySelectorAll('#tf-grilla .tf__item').forEach(el => {
    el.addEventListener('click', () => abrirLightbox(lista, Number(el.dataset.i)));
    marcarPanoramica(el.querySelector('img'));
  });
}

/**
 * Las fotos bien apaisadas ocupan dos columnas.
 *
 * De las 56, la mayoría son 4:3, pero hay unas pocas panorámicas (2.22:1).
 * En el mismo cuadrito que las demás perdían un 40% del ancho: justo el
 * paisaje que hace que valga la pena la foto. Con el doble de ancho entran
 * casi enteras (se recorta un poco de cielo y de piso, que no molesta) y, de
 * paso, la grilla deja de ser un damero perfecto.
 *
 * El corte va en 2.0 y no más abajo a propósito: a las 16:9 les convenía
 * quedarse en el cuadro chico, porque en el ancho perdían más de alto del que
 * ganaban de paisaje.
 */
function marcarPanoramica(img) {
  const medir = () => {
    if (!img.naturalWidth) return;
    if (img.naturalWidth / img.naturalHeight >= 2) {
      img.closest('.tf__item').classList.add('tf__item--ancha');
    }
  };
  if (img.complete) medir();
  else img.addEventListener('load', medir, { once: true });
}

function abrirTodasLasFotos() {
  const caja = document.getElementById('todas-fotos');
  if (!caja) return;
  pintarTodasLasFotos(tfCategoria);
  caja.classList.add('abierto');
  caja.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('tf-cerrar').focus();
}

function cerrarTodasLasFotos() {
  const caja = document.getElementById('todas-fotos');
  if (!caja) return;
  caja.classList.remove('abierto');
  caja.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function iniciarTodasLasFotos() {
  const caja = document.getElementById('todas-fotos');
  if (!caja) return;

  document.getElementById('tf-cerrar').addEventListener('click', cerrarTodasLasFotos);

  const filtros = caja.querySelectorAll('#tf-filtros .tab');
  filtros.forEach(f => {
    f.addEventListener('click', () => {
      filtros.forEach(o => o.setAttribute('aria-selected', 'false'));
      f.setAttribute('aria-selected', 'true');
      pintarTodasLasFotos(f.dataset.cat);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('lightbox').classList.contains('abierto')) return;
    if (caja.classList.contains('abierto')) cerrarTodasLasFotos();
  });
}

/** Muestra el mosaico o la galería completa según la variante. */
function aplicarVarianteGaleria(v = Variantes.get('galeria')) {
  const mosaico = document.getElementById('mosaico');
  const completa = document.getElementById('galeria-completa');
  if (!mosaico || !completa) return;
  mosaico.hidden = v !== 'a';
  completa.hidden = v !== 'b';
  if (v === 'a') pintarMosaico();
}

/* -------------------------------------------------------------- lightbox */
let lbFotos = [];
let lbIndice = 0;

function abrirLightbox(fotos, indice) {
  lbFotos = fotos;
  lbIndice = indice;
  const lb = document.getElementById('lightbox');
  lb.classList.add('abierto');
  document.body.style.overflow = 'hidden';
  pintarLightbox();
  document.getElementById('lb-cerrar').focus();
}

function pintarLightbox() {
  const foto = lbFotos[lbIndice];
  document.getElementById('lb-img').src = IMG(foto.f);
  document.getElementById('lb-img').alt = foto.t;
  document.getElementById('lb-pie').textContent =
    lbFotos.length > 1 ? `${lbIndice + 1} / ${lbFotos.length}  ·  ${foto.t}` : foto.t;
  const solaFoto = lbFotos.length < 2;
  document.getElementById('lb-prev').hidden = solaFoto;
  document.getElementById('lb-next').hidden = solaFoto;
  pintarTiraLightbox();
}

/** Tira de miniaturas abajo, para saltar de una foto a otra. */
function pintarTiraLightbox() {
  const tira = document.getElementById('lb-tira');
  if (!tira) return;

  if (lbFotos.length < 2) { tira.innerHTML = ''; tira.hidden = true; return; }
  tira.hidden = false;

  // se redibuja sólo cuando cambia el conjunto de fotos, no en cada paso
  if (tira.dataset.total !== String(lbFotos.length) || tira.dataset.primera !== lbFotos[0].f) {
    tira.dataset.total = lbFotos.length;
    tira.dataset.primera = lbFotos[0].f;
    tira.innerHTML = lbFotos.map((f, i) =>
      `<button class="lightbox__mini" data-i="${i}" aria-label="${f.t}">
         <img src="${THUMB(f.f)}" alt="" loading="lazy">
       </button>`).join('');
    tira.querySelectorAll('.lightbox__mini').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        lbIndice = Number(b.dataset.i);
        pintarLightbox();
      });
    });
  }

  tira.querySelectorAll('.lightbox__mini').forEach((b, i) => {
    b.classList.toggle('lightbox__mini--activa', i === lbIndice);
  });
  const activa = tira.querySelector('.lightbox__mini--activa');
  if (activa) activa.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function cerrarLightbox() {
  document.getElementById('lightbox').classList.remove('abierto');
  // si venimos del listado de todas las fotos, ése sigue abierto detrás
  const tf = document.getElementById('todas-fotos');
  if (!tf || !tf.classList.contains('abierto')) document.body.style.overflow = '';
}

function moverLightbox(paso) {
  lbIndice = (lbIndice + paso + lbFotos.length) % lbFotos.length;
  pintarLightbox();
}

function iniciarLightbox() {
  document.getElementById('lb-cerrar').addEventListener('click', cerrarLightbox);
  document.getElementById('lb-prev').addEventListener('click', () => moverLightbox(-1));
  document.getElementById('lb-next').addEventListener('click', () => moverLightbox(1));
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') cerrarLightbox();
  });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('abierto')) return;
    if (e.key === 'Escape') cerrarLightbox();
    if (e.key === 'ArrowLeft') moverLightbox(-1);
    if (e.key === 'ArrowRight') moverLightbox(1);
  });
}

/* --------------------------------------------------------------- tarifas */
/* --------------------------------------------- cómo se alquila + precios */
/* Las dos variantes cuentan lo mismo con distinto peso: la 'a' presenta las
   unidades y después el cuadro de temporadas; la 'b' deja mandar a las fotos
   y muestra un "desde", con el detalle por temporada plegado. En las dos, las
   plazas y el detalle de cada unidad se dicen una sola vez. */

/** El valor más barato de una unidad en todo el año, para el "desde". */
function precioDesde(idModalidad) {
  return Math.min(...CONFIG.temporadas.map(t => t.precios[idModalidad]));
}

/** Cuadro de precios por temporada. Va en las dos variantes, así que recibe
    dónde dibujarse. Ya no repite las plazas: eso se dice una vez arriba. */
function pintarTarifas(idContenedor) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  cont.innerHTML = CONFIG.temporadas.map(t => `
    <article class="tarifa ${t.destacada ? 'tarifa--destacada' : ''}">
      <h3 class="tarifa__nombre">${t.nombre}</h3>
      <p class="tarifa__periodo">${t.periodo}</p>
      <ul class="tarifa__precios">
        ${CONFIG.modalidades.map(m => `
          <li>
            <span>${m.nombre}</span>
            <strong>${pesos(t.precios[m.id])}</strong>
          </li>`).join('')}
      </ul>
      <p class="tarifa__unidad">por noche</p>
      <ul class="tarifa__detalle">
        ${t.incluye.map(([k, v]) => `<li>${k}<span>${v}</span></li>`).join('')}
      </ul>
      <a class="boton boton--linea" href="#reservas" data-reservar>Ver disponibilidad</a>
    </article>`).join('');
}

/** Variante A: las tres unidades, la casa completa más ancha que las plantas. */
function pintarUnidades() {
  const cont = document.getElementById('unidades-tira');
  if (!cont) return;

  cont.innerHTML = CONFIG.modalidades.map((m, i) => `
    <article class="unidad${i === 0 ? ' unidad--principal' : ''}">
      <img class="unidad__foto" src="${FOTO_UNIDAD[m.id]}" alt="" loading="lazy">
      <div class="unidad__cuerpo">
        <h3>${m.nombre}</h3>
        <p class="unidad__meta">${m.plazas} plazas · ${m.detalle}</p>
        <p class="unidad__texto">${m.texto}</p>
      </div>
    </article>`).join('');
}

/** Variante B: una banda por unidad, alternando el lado de la foto. */
function pintarBandas() {
  const cont = document.getElementById('bandas-unidades');
  if (!cont) return;

  cont.innerHTML = CONFIG.modalidades.map((m, i) => `
    <article class="banda${i === 0 ? ' banda--principal' : ''}">
      <img class="banda__foto" src="${FOTO_UNIDAD[m.id]}" alt="${m.nombre}" loading="lazy">
      <div class="banda__cuerpo">
        <h3>${m.nombre}</h3>
        <p class="banda__meta">${m.plazas} plazas · ${m.detalle}</p>
        <p class="banda__texto">${m.texto}</p>
        <p class="banda__desde">desde <strong>${pesos(precioDesde(m.id))}</strong> la noche</p>
      </div>
    </article>`).join('');
}

function aplicarVarianteAlquiler() {
  const v = Variantes.get('alquiler');
  const a = document.getElementById('alquiler-a');
  const b = document.getElementById('alquiler-b');
  if (!a || !b) return;
  a.hidden = v !== 'a';
  b.hidden = v !== 'b';
}

function pintarAlquiler() {
  pintarUnidades();
  pintarBandas();
  pintarTarifas('tarifas-grid');
  pintarTarifas('tarifas-grid-b');

  document.getElementById('notas-tarifas').innerHTML =
    CONFIG.notasTarifas.map(n => `<li>${n}</li>`).join('');

  aplicarVarianteAlquiler();
  Variantes.alCambiar('alquiler', aplicarVarianteAlquiler);
}

/* ------------------------------------------------------------------ faq -- */
/* Las 4 que más deciden si alguien reserva o no: entera/por planta, entrada
   y salida, seña, mascotas. El resto (servicios, cómo se llega, wifi...)
   queda para el que ya decidió y quiere el detalle, en preguntas.html. */
const FAQ_DESTACADAS = [0, 3, 4, 5];

function htmlFaq(lista) {
  return lista.map(f => `
    <details>
      <summary>${f.p}</summary>
      <div class="faq__respuesta">${f.r.split('\n').map(x => `<p>${x}</p>`).join('')}</div>
    </details>`).join('');
}

function aplicarVariantePreguntas() {
  const v = Variantes.get('preguntas');
  const seccion = document.getElementById('preguntas');
  if (!seccion) return;

  seccion.hidden = v === 'c';
  document.getElementById('nav-preguntas').href = v === 'c' ? 'preguntas.html' : '#preguntas';

  document.getElementById('faq').innerHTML = v === 'a' ? htmlFaq(FAQ_DESTACADAS.map(i => FAQ[i])) : '';
  document.getElementById('preguntas-bajada').textContent = v === 'a'
    ? 'Las que más nos preguntan. El resto, un clic más allá.'
    : 'Reunimos todo lo que solemos responder por WhatsApp en una sola página.';
}

function pintarFaq() {
  // Sólo se publica `p` y `r`. El campo `revisar` es una nota interna.
  aplicarVariantePreguntas();
  Variantes.alCambiar('preguntas', aplicarVariantePreguntas);

  const pendientes = FAQ.filter(f => f.revisar);
  if (pendientes.length) {
    console.warn(
      `[Balcones del Arroyo] Hay ${pendientes.length} respuestas del FAQ sin confirmar. ` +
      'Editá js/config.js, corregí la respuesta y borrá la línea "revisar".'
    );
    pendientes.forEach(f => console.warn(`  · ${f.p}\n    ${f.revisar}`));
  }
}

/* -------------------------------------------------------------- contacto */
/* Los datos de contacto y las redes ahora los dibuja js/pie.js, que es el
   mismo pie para todas las páginas. Acá quedan los botones sueltos de
   WhatsApp repartidos por la home (el flotante, el del hero…) y los horarios
   del panel de reservas. */
function pintarContacto() {
  const c = CONFIG.contacto;
  const mensajeBase = '¡Hola! Vi la web de Balcones del Arroyo y quiero consultar disponibilidad.';
  const url = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensajeBase)}`;

  document.querySelectorAll('[data-wsp]').forEach(a => { a.href = url; });

  document.getElementById('check-in').textContent = CONFIG.reglas.horaCheckIn;
  document.getElementById('check-out').textContent = CONFIG.reglas.horaCheckOut;
}

/* ------------------------------------------------------------- arranque -- */
document.addEventListener('DOMContentLoaded', () => {
  pintarTextosCasa();
  pintarCifras();
  pintarComodidades();
  pintarAmbientes('todas');
  iniciarTabsAmbientes();
  iniciarCarruselAmbientes();
  aplicarVarianteAmbientes();
  Variantes.alCambiar('ambientes', aplicarVarianteAmbientes);
  pintarFaq();
  pintarGaleria('todas');
  iniciarFiltros();
  iniciarTodasLasFotos();
  iniciarTodasActividades();
  aplicarVarianteGaleria();
  Variantes.alCambiar('galeria', aplicarVarianteGaleria);
  pintarActividades();
  pintarDistancias();
  pintarAlquiler();
  pintarPie({ cta: true, enInicio: true });
  pintarContacto();
  iniciarLightbox();
  iniciarNav();
  iniciarRevelado();
  iniciarReservas();
  Variantes.iniciar();
});
