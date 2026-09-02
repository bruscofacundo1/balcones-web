/* ============================================================================
   Balcones del Arroyo — modo edición (editar el sitio desde la propia página)
   Depende de: config.js, contenido.js (y de que la página ya haya pintado su
   contenido antes de llamar a iniciarEditor() — ver el final de cada
   DOMContentLoaded en app.js y preguntas-pagina.js)
   ----------------------------------------------------------------------------
   Antes, para cambiar un texto había que ir a /admin, buscar el campo en un
   formulario largo y guardar sin ver cómo quedaba hasta después. Esto deja
   tocar el texto ahí mismo, en la página real, y confirmar los cambios todos
   juntos al final con un solo botón.

   Sólo hace algo si se entra desde /admin (botón "Editar el sitio", que abre
   el sitio con ?editar=1) Y encima hay una sesión de /admin activa — se
   chequea con GET /api/admin/sesion, la misma cookie que ya usa el panel.
   Las dos cosas hacen falta a propósito: un admin que entra al sitio por su
   cuenta (sin pasar por ese botón) lo ve igual que cualquier visitante, sin
   nada distinto en la pantalla — el modo edición no se activa solo.

   Lo que se puede editar acá es lo que YA está en Contenido.catalogo(): los
   textos sueltos (hero, "La casa", notas de tarifas) y las dos colecciones,
   Preguntas frecuentes y Opiniones — con "agregar" y "eliminar" incluido.

   Las tarifas por temporada (precios, rangos de fecha) quedan afuera a
   propósito: tienen reglas cruzadas (que no falte ni se pise ningún día del
   año — ver Contenido.revisarCobertura) que conviene seguir cargando desde
   el panel, con esas validaciones completas a la vista, no con un click
   suelto en la página pública.

   Cómo pinta los cambios: en vez de reinventar cómo se ve cada campo, este
   archivo muta CONFIG/FAQ/RESENAS en memoria —los mismos datos de siempre,
   los que ya lee cada pintarX()— y vuelve a llamar a la función que YA sabe
   dibujarlos (pintarTextosCasa, pintarFaq, pintarResenas...). Nada nuevo
   que mantener sincronizado con el resto del sitio.
   ============================================================================ */

function iniciarEditor() {
  if (typeof CONFIG === 'undefined' || typeof Contenido === 'undefined') return;

  const CLAVE_ENTRADA = 'bda-editor-entrada';

  // La entrada real es el ?editar=1 que pone el botón "Editar el sitio" de
  // /admin. Se guarda en sessionStorage (no localStorage: dura lo que dura
  // la pestaña, no queda prendido para siempre) para que se mantenga al
  // navegar a otra página del sitio sin tener que volver a pasar por admin
  // en cada clic. Sin ese `?editar=1` en algún momento de esta pestaña, no
  // se hace ni el pedido de sesión: el sitio se ve exactamente igual que
  // para cualquier visitante, sesión de admin o no.
  try {
    if (new URLSearchParams(location.search).has('editar')) {
      sessionStorage.setItem(CLAVE_ENTRADA, '1');
      // Saca el ?editar=1 de la barra de direcciones — ya cumplió su función.
      const url = new URL(location.href);
      url.searchParams.delete('editar');
      history.replaceState(null, '', url);
    }
  } catch (e) { /* localStorage/URL bloqueados: no se activa nada */ }

  let entrada = false;
  try { entrada = sessionStorage.getItem(CLAVE_ENTRADA) === '1'; } catch (e) { /* modo privado */ }
  if (!entrada) return;

  const CLAVE_MODO = 'bda-modo-edicion';
  const pendientes = new Set();   // caminos con cambios sin guardar: 'textos.heroTitulo', 'FAQ', etc.
  let popoverAbierto = null;
  let modoOn = false;

  /* ---------------------------------------------------- pintar de nuevo -- */
  /* Qué función ya existente hay que volver a llamar para que un camino se
     vea actualizado. Varias no existen en todas las páginas (pintarFaq y
     pintarResenas sólo están en index.html; pintarFaqCompleto sólo en
     preguntas.html) — por eso el chequeo `typeof window[nombre] ===
     'function'` antes de llamarlas, en vez de asumir que están. */
  const REPINTAR = {
    'textos.heroTitulo': ['pintarTextosCasa'],
    'textos.heroBajada': ['pintarTextosCasa'],
    'textos.casaTitulo': ['pintarTextosCasa'],
    'textos.casaTexto': ['pintarTextosCasa'],
    notasTarifas: ['pintarAlquiler'],
    FAQ: ['pintarFaq', 'pintarFaqCompleto'],
    RESENAS: ['pintarResenas'],
    // El teléfono y el WhatsApp aparecen en dos lugares (el pie y el cajón
    // del menú) que se pintan con funciones separadas — hay que repintar
    // las dos para que no quede uno actualizado y el otro con el dato viejo.
    'contacto.whatsapp': ['pintarNavContacto', 'pintarPie', 'pintarContacto'],
    'contacto.telefonoVisible': ['pintarNavContacto', 'pintarPie'],
    'contacto.email': ['pintarPie'],
    'contacto.instagram': ['pintarNavContacto', 'pintarPie'],
    'contacto.facebook': ['pintarNavContacto', 'pintarPie']
  };
  /* "textos.directo.<id>.titulo" y "modalidades.<id>.texto" son caminos
     dinámicos (uno por cada ítem/modalidad que exista) — más simple probar
     el prefijo acá que enumerar cada id a mano en REPINTAR, que además se
     desactualizaría solo si alguna vez cambia la cantidad de ítems. */
  function repintar(camino) {
    (REPINTAR[camino] || []).forEach(nombre => {
      if (typeof window[nombre] === 'function') window[nombre]();
    });
    if (camino.indexOf('textos.directo.') === 0 && typeof pintarReservaDirecta === 'function') {
      pintarReservaDirecta();
    }
    if (camino.indexOf('modalidades.') === 0 && typeof pintarAlquiler === 'function') {
      pintarAlquiler();
    }
  }

  /* -------------------------------------------------------------- estilos */
  /* Con estilos propios e inyectados acá, no en estilos.css: es una pieza
     del panel que se cuela en el sitio público, no parte del sitio — mismo
     criterio que ya usa Contenido.marcarPreview() para la cinta de vista
     previa. El azul es a propósito distinto de la terracota de la marca,
     para que se note de un vistazo que es una herramienta, no diseño. */
  function inyectarEstilos() {
    if (document.getElementById('ed-estilos')) return;
    const s = document.createElement('style');
    s.id = 'ed-estilos';
    s.textContent = `
      .ed-boton-modo {
        position: fixed; left: 20px; bottom: 20px; z-index: 9999;
        background: #1d1b19; color: #fff; border: 0; border-radius: 999px;
        padding: 12px 20px; font: 600 14px/1 system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,.28);
      }
      .ed-boton-modo.ed-activo { background: #2d7dd2; }
      body.ed-modo [data-campo] {
        cursor: text; border-radius: 4px;
        outline: 1px dashed transparent; outline-offset: 3px;
      }
      body.ed-modo [data-campo]:hover { outline-color: #2d7dd2; }
      body.ed-modo [data-coleccion] details,
      body.ed-modo [data-coleccion] .opinion {
        cursor: pointer; outline: 1px dashed transparent; outline-offset: 2px;
      }
      body.ed-modo [data-coleccion] details:hover,
      body.ed-modo [data-coleccion] .opinion:hover { outline-color: #2d7dd2; }
      .ed-agregar {
        display: inline-flex; align-items: center; gap: 6px; margin-top: 16px;
        background: transparent; border: 1px dashed #2d7dd2; color: #2d7dd2;
        border-radius: 8px; padding: 10px 16px; font: 600 14px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      .ed-agregar:hover { background: rgba(45,125,210,.08); }
      .ed-velo { position: fixed; inset: 0; z-index: 9999; }
      .ed-popover {
        position: fixed; z-index: 10000; background: #fff; color: #1d1b19;
        border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.28);
        padding: 16px; width: min(420px, calc(100vw - 32px));
        max-height: calc(100vh - 32px); overflow-y: auto;
        font: 14px/1.4 system-ui, sans-serif;
      }
      .ed-popover label {
        display: block; font-weight: 600; font-size: 12px;
        margin: 12px 0 4px; color: #55504a;
      }
      .ed-popover label:first-child { margin-top: 0; }
      .ed-popover input, .ed-popover textarea {
        width: 100%; box-sizing: border-box; padding: 8px 10px;
        border: 1px solid #d8d3ca; border-radius: 6px;
        font: 14px/1.4 system-ui, sans-serif; resize: vertical;
      }
      .ed-popover textarea { min-height: 90px; }
      .ed-popover-botones {
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px; margin-top: 14px;
      }
      .ed-popover-der { display: flex; gap: 8px; }
      .ed-popover button {
        border: 0; border-radius: 6px; padding: 8px 14px;
        font: 600 13px/1 system-ui, sans-serif; cursor: pointer;
      }
      .ed-btn-guardar { background: #2d7dd2; color: #fff; }
      .ed-btn-cancelar { background: #efece5; color: #1d1b19; }
      .ed-btn-eliminar { background: transparent; color: #b3392c; }
      .ed-barra {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 9998;
        background: #1d1b19; color: #fff; padding: 14px 20px;
        display: flex; align-items: center; justify-content: center; gap: 16px;
        font: 14px/1 system-ui, sans-serif; box-shadow: 0 -4px 16px rgba(0,0,0,.25);
      }
      .ed-barra button {
        border: 0; border-radius: 6px; padding: 10px 18px;
        font: 600 13px/1 system-ui, sans-serif; cursor: pointer;
      }
      .ed-barra .ed-btn-guardar { background: #2d7dd2; color: #fff; }
      .ed-barra .ed-btn-descartar { background: transparent; color: #d9d2c8; text-decoration: underline; }
      .ed-aviso {
        position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%);
        background: #1d1b19; color: #fff; padding: 10px 18px; border-radius: 8px;
        z-index: 10001; font: 600 13px/1 system-ui, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,.28);
      }
    `;
    document.head.appendChild(s);
  }

  /* -------------------------------------------------------------- popover */
  function escaparHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escaparAttr(s) { return escaparHtml(s).replace(/"/g, '&quot;'); }

  function cerrarPopover() {
    if (popoverAbierto) { popoverAbierto.remove(); popoverAbierto = null; }
    const velo = document.getElementById('ed-velo');
    if (velo) velo.remove();
  }

  /** `especificacion` = { campos: [{clave, etiqueta, tipo: 'texto'|'largo', valor}],
      onGuardar(valores), onEliminar (opcional) } */
  function abrirPopover(anchorEl, especificacion) {
    cerrarPopover();

    const velo = document.createElement('div');
    velo.id = 'ed-velo';
    velo.className = 'ed-velo';
    velo.addEventListener('click', cerrarPopover);
    document.body.appendChild(velo);

    const pop = document.createElement('div');
    pop.className = 'ed-popover';
    pop.innerHTML = especificacion.campos.map((c, i) => `
      <label for="ed-campo-${i}">${escaparHtml(c.etiqueta)}</label>
      ${c.tipo === 'texto'
        ? `<input id="ed-campo-${i}" type="text" value="${escaparAttr(c.valor)}">`
        : `<textarea id="ed-campo-${i}">${escaparHtml(c.valor)}</textarea>`}
    `).join('') + `
      <div class="ed-popover-botones">
        <div>${especificacion.onEliminar ? '<button type="button" class="ed-btn-eliminar">Eliminar</button>' : ''}</div>
        <div class="ed-popover-der">
          <button type="button" class="ed-btn-cancelar">Cancelar</button>
          <button type="button" class="ed-btn-guardar">Guardar</button>
        </div>
      </div>
    `;
    document.body.appendChild(pop);
    popoverAbierto = pop;

    // Debajo del elemento clickeado, pegado a la izquierda; si no entra a la
    // derecha se corre para adentro. El alto es variable (una pregunta larga
    // pesa más que un título), así que el popover scrollea solo si hace
    // falta (max-height + overflow-y en el CSS) en vez de salirse de pantalla.
    const r = anchorEl.getBoundingClientRect();
    const ancho = 420;
    pop.style.left = Math.max(16, Math.min(r.left, window.innerWidth - ancho - 16)) + 'px';
    pop.style.top = Math.max(16, r.bottom + 8) + 'px';

    pop.querySelector('.ed-btn-cancelar').addEventListener('click', cerrarPopover);
    const btnEliminar = pop.querySelector('.ed-btn-eliminar');
    if (btnEliminar) {
      btnEliminar.addEventListener('click', () => {
        especificacion.onEliminar();
        cerrarPopover();
      });
    }
    pop.querySelector('.ed-btn-guardar').addEventListener('click', () => {
      const valores = {};
      especificacion.campos.forEach((c, i) => {
        valores[c.clave] = document.getElementById(`ed-campo-${i}`).value;
      });
      especificacion.onGuardar(valores);
      cerrarPopover();
    });

    const primero = pop.querySelector('input, textarea');
    if (primero) { primero.focus(); if (primero.select) primero.select(); }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && popoverAbierto) cerrarPopover();
  });

  /* ------------------------------------------------- campos sueltos ---- */
  function abrirPopoverCampo(el, camino) {
    const campo = Contenido.catalogo(CONFIG)[camino];
    if (!campo) return;
    const actual = Contenido.leerCampo(CONFIG, camino);
    const esLista = campo.tipo === 'lista';
    const valorTexto = esLista ? (actual || []).join('\n') : (actual || '');

    abrirPopover(el, {
      campos: [{
        clave: 'valor', etiqueta: campo.etiqueta,
        tipo: campo.tipo === 'texto' ? 'texto' : 'largo',
        valor: valorTexto
      }],
      onGuardar(valores) {
        const nuevo = esLista
          ? valores.valor.split('\n').map(x => x.trim()).filter(Boolean)
          : valores.valor.trim();
        Contenido.escribirCampo(CONFIG, camino, nuevo);
        pendientes.add(camino);
        actualizarBarra();
        repintar(camino);
      }
    });
  }

  /* --------------------------------------------------------------- FAQ -- */
  function abrirPopoverFaqItem(el, indice) {
    const item = FAQ[indice];
    if (!item) return;
    abrirPopover(el, {
      campos: [
        { clave: 'p', etiqueta: 'Pregunta', tipo: 'texto', valor: item.p },
        { clave: 'r', etiqueta: 'Respuesta', tipo: 'largo', valor: item.r }
      ],
      onGuardar(valores) {
        item.p = valores.p.trim();
        item.r = valores.r.trim();
        pendientes.add('FAQ');
        actualizarBarra();
        repintar('FAQ');
      },
      onEliminar() {
        FAQ.splice(indice, 1);
        pendientes.add('FAQ');
        actualizarBarra();
        repintar('FAQ');
      }
    });
  }

  function agregarFaqNueva() {
    FAQ.push({ p: 'Nueva pregunta', r: 'Escribí la respuesta acá.' });
    pendientes.add('FAQ');
    actualizarBarra();
    repintar('FAQ');
    const indice = FAQ.length - 1;
    // Sólo el listado completo (preguntas.html) puede llegar a mostrar el
    // último ítem — el de la home es una selección fija (FAQ_DESTACADAS) y
    // una pregunta recién agregada normalmente no entra ahí.
    const el = document.querySelector(`[data-coleccion="FAQ"] [data-i="${indice}"]`);
    if (el) abrirPopoverFaqItem(el, indice);
  }

  /* --------------------------------------------------------- Opiniones -- */
  function abrirPopoverResenaItem(el, indice) {
    const item = RESENAS[indice];
    if (!item) return;
    abrirPopover(el, {
      campos: [
        { clave: 'texto', etiqueta: 'Lo que escribió', tipo: 'largo', valor: item.texto || '' },
        { clave: 'autor', etiqueta: 'Quién', tipo: 'texto', valor: item.autor || '' },
        { clave: 'fuente', etiqueta: 'De dónde (Google, Booking…)', tipo: 'texto', valor: item.fuente || '' },
        { clave: 'fecha', etiqueta: 'Cuándo (AAAA-MM)', tipo: 'texto', valor: item.fecha || '' },
        { clave: 'estrellas', etiqueta: 'Estrellas (1 a 5)', tipo: 'texto', valor: String(item.estrellas || 5) }
      ],
      onGuardar(valores) {
        item.texto = valores.texto.trim();
        item.autor = valores.autor.trim();
        item.fuente = valores.fuente.trim();
        item.fecha = valores.fecha.trim();
        item.estrellas = Math.max(1, Math.min(5, parseInt(valores.estrellas, 10) || 5));
        pendientes.add('RESENAS');
        actualizarBarra();
        repintar('RESENAS');
      },
      onEliminar() {
        RESENAS.splice(indice, 1);
        pendientes.add('RESENAS');
        actualizarBarra();
        repintar('RESENAS');
      }
    });
  }

  function agregarResenaNueva() {
    const hoy = new Date();
    const aaaaMm = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    RESENAS.push({ texto: '', autor: '', fuente: 'Google', fecha: aaaaMm, estrellas: 5 });
    pendientes.add('RESENAS');
    actualizarBarra();
    repintar('RESENAS');
    const indice = RESENAS.length - 1;
    const el = document.querySelector(`#opiniones-pista [data-i="${indice}"]`);
    if (el) abrirPopoverResenaItem(el, indice);
  }

  /* ------------------------------------------------- guardar de verdad -- */
  function avisar(mensaje) {
    const aviso = document.createElement('div');
    aviso.className = 'ed-aviso';
    aviso.textContent = mensaje;
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 2500);
  }

  function actualizarBarra() {
    let barra = document.getElementById('ed-barra');
    if (pendientes.size === 0) {
      if (barra) barra.remove();
      return;
    }
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'ed-barra';
      barra.className = 'ed-barra';
      document.body.appendChild(barra);
    }
    barra.innerHTML = `
      <span>${pendientes.size} cambio${pendientes.size === 1 ? '' : 's'} sin guardar</span>
      <button type="button" class="ed-btn-descartar">Descartar</button>
      <button type="button" class="ed-btn-guardar">Guardar cambios</button>
    `;
    barra.querySelector('.ed-btn-descartar').addEventListener('click', () => {
      if (confirm('¿Descartar los cambios sin guardar? Hay que recargar la página para volver a como estaba.')) {
        location.reload();
      }
    });
    barra.querySelector('.ed-btn-guardar').addEventListener('click', guardarTodo);
  }

  async function guardarTodo() {
    const btn = document.querySelector('#ed-barra .ed-btn-guardar');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    // Se lee el valor VIVO de cada camino recién ahora (no el que tenía al
    // marcarlo pendiente): si se editó dos veces antes de guardar, se manda
    // la última versión, no una intermedia.
    const cambios = {};
    pendientes.forEach(camino => {
      if (camino === 'FAQ') cambios.FAQ = FAQ;
      else if (camino === 'RESENAS') cambios.RESENAS = RESENAS;
      else cambios[camino] = Contenido.leerCampo(CONFIG, camino);
    });

    try {
      const r = await fetch('/api/admin/contenido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cambios })
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo guardar.');
      pendientes.clear();
      actualizarBarra();
      avisar('Listo, se guardó todo.');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
      alert('No se pudo guardar: ' + err.message);
    }
  }

  /* ------------------------------------------------------------- clicks */
  function insertarBotonesAgregar() {
    document.querySelectorAll('[data-agregar-en]').forEach(marcador => {
      const cual = marcador.dataset.agregarEn;
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'ed-agregar';
      boton.dataset.coleccion = cual;
      boton.textContent = cual === 'FAQ' ? '+ Nueva pregunta' : '+ Nueva opinión';
      marcador.appendChild(boton);
    });
  }

  document.addEventListener('click', e => {
    if (!modoOn) return;

    const agregarBtn = e.target.closest('.ed-agregar');
    if (agregarBtn) {
      if (agregarBtn.dataset.coleccion === 'FAQ') agregarFaqNueva();
      else if (agregarBtn.dataset.coleccion === 'RESENAS') agregarResenaNueva();
      return;
    }

    const faqItem = e.target.closest('#faq details, [data-coleccion="FAQ"] details');
    if (faqItem) {
      e.preventDefault();   // que no se abra/cierre el <details> con el clic
      abrirPopoverFaqItem(faqItem, Number(faqItem.dataset.i));
      return;
    }

    const resenaItem = e.target.closest('[data-coleccion="RESENAS"] .opinion');
    if (resenaItem) {
      abrirPopoverResenaItem(resenaItem, Number(resenaItem.dataset.i));
      return;
    }

    const campoEl = e.target.closest('[data-campo]');
    if (campoEl) {
      // Varios campos de contacto están marcados sobre un <a href> (el
      // teléfono, el mail, las redes) — sin esto, el clic para editar
      // terminaba además siguiendo el link de verdad.
      e.preventDefault();
      abrirPopoverCampo(campoEl, campoEl.dataset.campo);
    }
  });

  /* --------------------------------------------------------- el botón -- */
  function aplicarModo(on, boton) {
    modoOn = on;
    document.body.classList.toggle('ed-modo', on);
    boton.classList.toggle('ed-activo', on);
    boton.textContent = on ? '✕ Salir del modo edición' : '✏️ Editar esta página';
    document.querySelectorAll('.ed-agregar').forEach(b => b.remove());
    if (on) insertarBotonesAgregar();
    if (!on) cerrarPopover();
    try { localStorage.setItem(CLAVE_MODO, on ? '1' : '0'); } catch (e) { /* modo privado */ }
  }

  /* La sesión se chequea ANTES de tocar nada de la página — ni el botón, ni
     la clase del <body>, ni el estado guardado en localStorage se restauran
     sin haber confirmado que hay sesión de verdad. Antes se restauraba el
     modo (y se insertaban los botones "+ Agregar") de una, sin esperar la
     respuesta, y sólo el botón flotante quedaba condicionado a la sesión:
     alguien sin sesión pero con el modo activado en una visita anterior
     hubiera visto la página parcialmente en modo edición, sin ningún botón
     visible para salir. */
  fetch('/api/admin/sesion')
    .then(r => r.ok ? r.json() : { activa: false })
    .then(d => { if (d.activa) arrancar(); })
    .catch(() => { /* sin conexión o sin API: no se activa nada */ });

  function arrancar() {
    inyectarEstilos();
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ed-boton-modo';
    document.body.appendChild(boton);
    boton.addEventListener('click', () => aplicarModo(!modoOn, boton));

    let arranqueOn = false;
    try { arranqueOn = localStorage.getItem(CLAVE_MODO) === '1'; } catch (e) { /* modo privado */ }
    aplicarModo(arranqueOn, boton);
  }
}
