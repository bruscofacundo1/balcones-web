/* ============================================================================
   Balcones del Arroyo — armado de la página
   Depende de: config.js, calendario.js
   ============================================================================ */

/* Aceptan dos cosas: el nombre corto de una foto que vive en img/ (como
   siempre), o el objeto entero de la galería — que, si la foto se subió desde
   el panel, trae sus propias urls en vez de un nombre. Así el resto del
   código no tiene que saber de dónde salió cada foto. */
function IMG(foto) {
  if (foto && typeof foto === 'object') return foto.url || IMG(foto.f);
  return /^https?:/.test(foto) ? foto : `img/${foto}.jpg`;
}
function THUMB(foto) {
  if (foto && typeof foto === 'object') return foto.thumb || foto.url || THUMB(foto.f);
  return /^https?:/.test(foto) ? foto : `img/thumb/${foto}.jpg`;
}

/* -------------------------------------------------------------- navegación */
function iniciarNav() {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('nav-burger');
  const links = document.getElementById('nav-links');
  const velo = document.getElementById('nav-velo');

  // La barra se pone sólida recién cuando la foto del hero termina de pasar
  // por completo, no a los pocos píxeles de scroll: antes se ponía blanca
  // con la foto todavía de fondo detrás y quedaba un sánguche oscuro-blanco-
  // oscuro. "Sólida" se activa justo cuando el borde de abajo del hero llega
  // al borde de abajo de la barra — el mismo instante que en masaguilo.com.
  // El "Reservar" late una sola vez en ese momento: ahí desaparece de la
  // vista el botón grande del hero y éste pasa a ser la única puerta a
  // reservar.
  let yaLlamo = false;
  const hero = document.getElementById('inicio');
  if (hero) {
    const raiz = getComputedStyle(document.documentElement);
    const espacioNav = parseFloat(raiz.getPropertyValue('--nav-h')) + parseFloat(raiz.getPropertyValue('--nav-gap'));
    const alScrollear = () => {
      const solida = hero.getBoundingClientRect().bottom <= espacioNav;
      nav.classList.toggle('nav--solida', solida);
      if (solida && !yaLlamo) {
        yaLlamo = true;
        nav.classList.add('nav--llamar');
      }
    };
    alScrollear();
    window.addEventListener('scroll', alScrollear, { passive: true });
  }

  function abrirMenu() {
    links.classList.add('abierto');
    velo.classList.add('abierto');
    burger.setAttribute('aria-expanded', 'true');
  }
  function cerrarMenu() {
    links.classList.remove('abierto');
    velo.classList.remove('abierto');
    burger.setAttribute('aria-expanded', 'false');
  }
  burger.addEventListener('click', () => {
    links.classList.contains('abierto') ? cerrarMenu() : abrirMenu();
  });
  velo.addEventListener('click', cerrarMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', cerrarMenu));

  // En desktop con mouse de verdad, alcanza con pasar por los puntos para
  // que el cajón se abra solo, sin clickear — igual que vivood.com — y se
  // cierra solo al sacar el mouse de ahí. El clic sigue andando igual (hace
  // falta para teclado y para touch, que no tiene "pasar el mouse").
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let cerrando = null;
    const abrirPorHover = () => { clearTimeout(cerrando); abrirMenu(); };
    // Un respiro antes de cerrar: al ir del botón de puntos al cajón se pasa
    // un instante por afuera de los dos, y sin esto el menú parpadeaba.
    const programarCierre = () => {
      clearTimeout(cerrando);
      cerrando = setTimeout(cerrarMenu, 250);
    };
    burger.addEventListener('mouseenter', abrirPorHover);
    burger.addEventListener('mouseleave', programarCierre);
    links.addEventListener('mouseenter', abrirPorHover);
    links.addEventListener('mouseleave', programarCierre);
  }
}

/* ------------------------------------------------------------ animaciones */
// Se pone en true al final de iniciarRevelado(). Las funciones que pueden
// repintar tarjetas más tarde (al cambiar una variante, no en el pintado
// inicial) la consultan para no agregarles la clase .revelar a esa altura:
// el observer de acá abajo ya escaneó el DOM una sola vez, así que un
// .revelar que aparece después no lo ve nadie y quedaría invisible siempre.
let animacionesListas = false;

function iniciarRevelado() {
  const items = document.querySelectorAll('.revelar');
  const mostrarTodo = () => items.forEach(i => i.classList.add('visible'));

  if (!('IntersectionObserver' in window)) { animacionesListas = true; return; }

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

  animacionesListas = true;
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

/* ------------------------------------------------------- portada (hero) --
   Pasa sola de una foto a la otra cada 6 segundos. Tres cuidados:
   - la primera foto ya viene escrita en el HTML, así que acá se saltea: si la
     volviéramos a crear, el navegador la bajaría de nuevo;
   - las demás van con loading="lazy" — no se ven hasta pasados 6 segundos y no
     tienen por qué competir con el resto de la página al abrir;
   - el intervalo se corta cuando la pestaña queda en segundo plano. Si no, al
     volver el navegador dispara todos los cambios juntos y la portada
     parpadea.                                                              */
let heroTimer = null;

function pintarHero() {
  const fondo = document.getElementById('hero-fondo');
  const puntos = document.getElementById('hero-puntos');
  const fotos = (CONFIG.heroFotos || []).filter(x => x && x.f);
  if (!fondo || !puntos || fotos.length < 2) return;
  if (fondo.querySelectorAll('.hero__slide').length > 1) return;   // ya estaba armada

  fotos.slice(1).forEach(foto => {
    const img = document.createElement('img');
    img.className = 'hero__slide';
    img.src = `img/${foto.f}.jpg`;
    img.alt = foto.alt || '';
    img.loading = 'lazy';
    fondo.appendChild(img);
  });

  const slides = [...fondo.querySelectorAll('.hero__slide')];
  puntos.innerHTML = fotos.map((foto, i) => `
    <button class="hero__punto${i === 0 ? ' hero__punto--activo' : ''}" role="tab"
            aria-selected="${i === 0}" aria-label="Foto ${i + 1} de ${fotos.length}"
            data-i="${i}"></button>`).join('');
  const bolitas = [...puntos.querySelectorAll('.hero__punto')];

  let actual = 0;
  function mostrar(i) {
    actual = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle('hero__slide--activa', n === actual));
    bolitas.forEach((b, n) => {
      b.classList.toggle('hero__punto--activo', n === actual);
      b.setAttribute('aria-selected', String(n === actual));
    });
  }

  function arrancar() {
    detener();
    heroTimer = setInterval(() => mostrar(actual + 1), 6000);
  }
  function detener() {
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
  }

  bolitas.forEach(b => b.addEventListener('click', () => {
    mostrar(Number(b.dataset.i));
    arrancar();   // reinicia la cuenta: si tocaste, no queremos que cambie enseguida
  }));

  document.addEventListener('visibilitychange', () => {
    document.hidden ? detener() : arrancar();
  });

  arrancar();
}

/* La franja de "por qué reservar acá", debajo de la portada.

   Los números NO se escriben en el texto: vienen de las mismas variables que
   usan legales.html y el checkout. Un dato de venta que dice una cosa y las
   condiciones que dicen otra es un problema de defensa del consumidor, no un
   detalle de redacción, y separarlos es exactamente cómo se desincronizan.

   Se arma con textContent y no con innerHTML: el texto sale del panel, y así
   no hay forma de que un título con un `<` rompa —o inyecte— nada.          */
function pintarReservaDirecta() {
  const cont = document.getElementById('directo-lista');
  const items = (CONFIG.textos && CONFIG.textos.directo) || [];
  if (!cont) return;
  if (!items.length) { cont.closest('.seccion--directo').hidden = true; return; }

  const valores = {
    dias: CONFIG.legales.cancelacion.diasReprogramar,
    sena: CONFIG.reglas.senaPorcentaje
  };
  const conValores = txt => String(txt || '')
    .replace(/\{(\w+)\}/g, (m, k) => (k in valores ? valores[k] : m));

  cont.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    const h = document.createElement('h3');
    h.textContent = conValores(item.titulo);
    const p = document.createElement('p');
    p.textContent = conValores(item.texto);
    li.append(h, p);
    cont.appendChild(li);
  }
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
function iniciarTabsAmbientes() {
  const tabs = document.querySelectorAll('#tabs-ambientes .tab');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(o => o.setAttribute('aria-selected', 'false'));
      t.setAttribute('aria-selected', 'true');
      plantaAmbientes = t.dataset.planta;
      pintarCarruselAmbientes(plantaAmbientes);
    });
  });
}

/* ------------------------------------------------ carrusel de ambientes -- */
/* Una foto grande por vez, casi a pantalla completa, con las vecinas
   asomando a los lados y el texto abajo. */

let plantaAmbientes = 'todas';
let carrIndice = 0;
let carrLista = [];

function pintarCarruselAmbientes(planta = 'todas') {
  const pista = document.getElementById('carr-pista');
  if (!pista) return;

  carrLista = planta === 'todas' ? AMBIENTES : AMBIENTES.filter(a => a.planta === planta);
  carrIndice = 0;

  pista.innerHTML = carrLista.map((a, i) => `
    <figure class="carrusel__item" data-i="${i}">
      <img src="${IMG(a.foto)}" alt="${a.titulo}" loading="lazy"
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
    const caja = document.getElementById('ambientes-carrusel');
    const r = caja.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0) return;
    if (e.key === 'ArrowLeft') moverCarrusel(carrIndice - 1, true);
    if (e.key === 'ArrowRight') moverCarrusel(carrIndice + 1, true);
  });
}

/* ---------------------------------------------------------- actividades -- */
/* Cuatro arriba, en la home; el resto sólo aparece si tocás "Ver más" —
   ocho tarjetas de 3:4 eran la sección más larga del inicio en celular,
   después del FAQ. */
/**
 * `conRevelado` va sólo en la tira de 4 que se ve de entrada. La capa de
 * "Ver más" arranca con `display:none` (se abre con JS), y un elemento sin
 * caja mientras está oculto nunca cruza el umbral del IntersectionObserver
 * — si arrancara en opacity:0 quedaría invisible aunque después se abra.
 */
function tarjetasActividades(lista, conRevelado) {
  return lista.map(a => `
    <article class="actividad ${conRevelado ? 'revelar revelar--foto' : ''}">
      <img src="${THUMB(a.foto)}" alt="${a.titulo}" loading="lazy">
      <div class="actividad__cuerpo">
        <h3>${a.titulo}</h3>
        <p>${a.texto}</p>
      </div>
    </article>`).join('');
}

function pintarActividades() {
  document.getElementById('actividades').innerHTML = tarjetasActividades(ACTIVIDADES.slice(0, 4), !animacionesListas);
  document.getElementById('todas-actividades-grid').innerHTML = tarjetasActividades(ACTIVIDADES, false);
}

/* -------------------------------------------------------------- opiniones */

const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/** 'AAAA-MM' -> 'feb 2026'. Si no matchea ese formato, se muestra tal cual. */
function mesCorto(iso) {
  const m = /^(\d{4})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}`;
}

function tarjetaOpinion(r) {
  const estrellas = Math.max(0, Math.min(5, r.estrellas || 5));
  return `
    <article class="opinion">
      <div class="opinion__estrellas" aria-label="${estrellas} de 5 estrellas">
        ${'★'.repeat(estrellas)}${'☆'.repeat(5 - estrellas)}
      </div>
      <p class="opinion__texto">"${r.texto}"</p>
      <p class="opinion__fuente">${r.autor ? `${r.autor} · ` : ''}${r.fuente} · ${mesCorto(r.fecha)}</p>
    </article>`;
}

function pintarResenas() {
  const seccion = document.getElementById('opiniones');
  const carrusel = document.getElementById('opiniones-carrusel');
  const pista = document.getElementById('opiniones-pista');
  if (!seccion || !pista) return;

  // Sin reseñas cargadas, no hay nada que mostrar: mejor que la sección
  // desaparezca a que se vea un carrusel vacío.
  if (!RESENAS || !RESENAS.length) { seccion.hidden = true; return; }

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tarjetas = RESENAS.map(tarjetaOpinion).join('');
  // El loop infinito es duplicar la lista y mover la tira exactamente -50%:
  // cuando la primera copia termina de salir, la segunda ocupa su lugar.
  // Con "reducir movimiento" no hay animación, así que no tiene sentido
  // duplicar — se deja scroll horizontal nativo para llegar a todas.
  pista.innerHTML = reducido ? tarjetas : tarjetas + tarjetas;
  pista.style.setProperty('--cant', RESENAS.length);
  carrusel.classList.toggle('opiniones-carrusel--estatica', reducido);

  const c = CONFIG.contacto;
  const btnGoogle = document.getElementById('btn-opinion-google');
  const btnBooking = document.getElementById('btn-opinion-booking');
  if (c.googleResenas) { btnGoogle.href = c.googleResenas; btnGoogle.hidden = false; }
  if (c.bookingResenas) { btnBooking.href = c.bookingResenas; btnBooking.hidden = false; }
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

/* ------------------------------------------------- galería en 3 niveles -- */
/* Variante A. Nivel 1: un mosaico corto con lo mejor. Nivel 2: todas las
   fotos chiquitas. Nivel 3: una por una. Así la home no se hace eterna,
   que es el problema que tenía con 56 fotos en fila. */

/** Las que van en el mosaico: primero el entorno y las de afuera.
    La cuenta vive en contenido.js porque el panel la necesita igual, para
    marcar qué fotos salen en la portada (ver Contenido.fotosDestacadas). */
function fotosDestacadas() {
  return Contenido.fotosDestacadas(FOTOS);
}

function pintarMosaico() {
  const cont = document.getElementById('mosaico');
  if (!cont) return;

  const destacadas = fotosDestacadas();
  const restantes = FOTOS.length - destacadas.length;

  // Si esto se repinta después de que iniciarRevelado() ya armó el
  // IntersectionObserver (pasa si alguien cambia la variante de "La casa y
  // el lugar" en la misma visita), un .revelar nuevo no lo observa nadie y
  // quedaría en opacity:0 para siempre. La animación sólo va en el pintado
  // inicial; un repintado tardío aparece directo, sin animar.
  const claseRevelado = animacionesListas ? '' : 'revelar revelar--foto';

  cont.innerHTML = destacadas.map((foto, i) => `
    <figure class="mosaico__item ${claseRevelado}" data-i="${i}">
      <img src="${THUMB(foto)}" alt="${foto.t}" loading="lazy">
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
      <img src="${THUMB(foto)}" alt="${foto.t}" loading="lazy">
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
  document.getElementById('lb-img').src = IMG(foto);
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
         <img src="${THUMB(f)}" alt="" loading="lazy">
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

/* --------------------------------------------- cómo se alquila + precios */
/* Primero las unidades (casa completa y cada planta), después el cuadro de
   precios por temporada. Las plazas y el detalle de cada unidad se dicen
   una sola vez, arriba. */

/** Cuadro de precios por temporada. */
function pintarTarifas(idContenedor) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  // `&& !animacionesListas`: si esto se repinta después de que corrió
  // iniciarRevelado(), un .revelar nuevo no lo observa nadie y la tarjeta
  // queda en opacity:0 PARA SIEMPRE. Un repintado tardío aparece sin animar.
  const conRevelado = !animacionesListas;

  cont.innerHTML = CONFIG.temporadas.map(t => `
    <article class="tarifa ${conRevelado ? 'revelar' : ''} ${t.destacada ? 'tarifa--destacada' : ''}">
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
        <!-- El mínimo sale de minNoches, no de incluye: es editable desde
             /admin, y tenerlo escrito dos veces hacía que la tarjeta siguiera
             mostrando el número viejo después de cambiarlo. -->
        <li>Mínimo de noches<span>${t.minNoches}</span></li>
        ${t.incluye.map(([k, v]) => `<li>${k}<span>${v}</span></li>`).join('')}
      </ul>
      <a class="boton boton--linea" href="reserva.html" data-reservar>Ver disponibilidad</a>
    </article>`).join('');
}

/** Variante A: las tres unidades, la casa completa más ancha que las plantas. */
function pintarUnidades() {
  const cont = document.getElementById('unidades-tira');
  if (!cont) return;

  const rev = animacionesListas ? '' : ' revelar revelar--foto';
  cont.innerHTML = CONFIG.modalidades.map((m, i) => `
    <article class="unidad${rev}${i === 0 ? ' unidad--principal' : ''}">
      <img class="unidad__foto" src="${FOTO_UNIDAD[m.id]}" alt="" loading="lazy">
      <div class="unidad__cuerpo">
        <h3>${m.nombre}</h3>
        <p class="unidad__meta">${m.plazas} plazas · ${m.detalle}</p>
        <p class="unidad__texto">${m.texto}</p>
      </div>
    </article>`).join('');
}

function pintarAlquiler() {
  pintarUnidades();
  pintarTarifas('tarifas-grid');

  document.getElementById('notas-tarifas').innerHTML =
    CONFIG.notasTarifas.map(n => `<li>${n}</li>`).join('');
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

function pintarFaq() {
  // Sólo se publica `p` y `r`. El campo `revisar` es una nota interna.
  document.getElementById('faq').innerHTML = htmlFaq(FAQ_DESTACADAS.map(i => FAQ[i]).filter(Boolean));
  document.getElementById('preguntas-bajada').textContent =
    'Las que más nos preguntan. El resto, un clic más allá.';

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
}

/* El bloque de abajo del menú lateral, con la dirección y el WhatsApp — la
   misma idea que tiene vivood.com en su cajón. Mismos datos que el pie
   (CONFIG.contacto), para que no haga falta mantenerlos en dos lugares. */
function pintarNavContacto() {
  const cont = document.getElementById('nav-contacto');
  if (!cont) return;
  const c = CONFIG.contacto;
  const mensaje = '¡Hola! Vi la web de Balcones del Arroyo y quiero consultar disponibilidad.';
  const wsp = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensaje)}`;

  const redes = [];
  if (c.instagram) redes.push(`<a href="${c.instagram}" target="_blank" rel="noopener">Instagram</a>`);
  if (c.facebook) redes.push(`<a href="${c.facebook}" target="_blank" rel="noopener">Facebook</a>`);

  cont.innerHTML = `
    <span class="antetitulo">Contacto</span>
    <p class="nav__contacto-direccion">${c.direccion}</p>
    <a class="nav__contacto-wsp" href="${wsp}" target="_blank" rel="noopener">${c.telefonoVisible}</a>
    ${redes.length ? `<div class="nav__contacto-redes">${redes.join('')}</div>` : ''}
  `;
}

/* ------------------------------------------------------------- arranque -- */
/** Todo lo que sale de CONFIG y de FOTOS. Se puede volver a llamar sin
    efectos raros: hace falta si el contenido editado desde /admin llega
    después de la primera pintura (ver Contenido.preparar).

    La galería va incluida: si la editaron y sólo se repintaran los textos,
    quedaría la lista vieja de fotos en pantalla aunque FOTOS ya tenga la
    nueva. Si el visor de "todas las fotos" está abierto en una categoría
    puntual, se respeta esa categoría al repintar. */
function pintarDesdeConfig() {
  pintarReservaDirecta();
  pintarTextosCasa();
  pintarCifras();
  pintarComodidades();
  pintarFaq();
  pintarActividades();
  pintarResenas();
  pintarDistancias();
  pintarAlquiler();
  pintarPie({ cta: true, enInicio: true });
  pintarContacto();
  pintarNavContacto();

  pintarMosaico();
  if (typeof tfCategoria !== 'undefined') pintarTodasLasFotos(tfCategoria);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Precios y textos que se hayan editado desde /admin. En la primera visita
  // espera un instante; después ya no espera nada.
  await Contenido.preparar(CONFIG, { repintar: pintarDesdeConfig });

  pintarHero();          // una sola vez: agrega las fotos al DOM y arranca el intervalo
  pintarReservaDirecta();
  pintarTextosCasa();
  pintarCifras();
  pintarComodidades();
  iniciarTabsAmbientes();
  iniciarCarruselAmbientes();
  pintarCarruselAmbientes('todas');
  pintarFaq();
  pintarMosaico();
  iniciarTodasLasFotos();
  iniciarTodasActividades();
  pintarActividades();
  pintarResenas();
  pintarDistancias();
  pintarAlquiler();
  pintarPie({ cta: true, enInicio: true });
  pintarContacto();
  pintarNavContacto();
  iniciarLightbox();
  iniciarNav();
  iniciarRevelado();
  iniciarReservas();
});
