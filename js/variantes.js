/* ============================================================================
   Balcones del Arroyo — variantes de diseño

   Algunas secciones están hechas de dos o tres formas distintas para poder
   compararlas en vivo antes de decidir cuál queda. Este archivo guarda cuál
   está activa (en el navegador, no en el servidor) y dibuja el panelcito de
   abajo a la izquierda para cambiarlas.

   Cuando se decida, se borra la variante que pierda y este archivo entero.
   ============================================================================ */

const VARIANTES_DEF = {
  pago: {
    nombre: 'Cómo se paga',
    porDefecto: 'a',
    opciones: [
      { id: 'a', nombre: 'WhatsApp',     detalle: 'Se manda todo por WhatsApp y se coordina la seña a mano' },
      { id: 'b', nombre: 'Mercado Pago', detalle: 'Tarjeta ahí mismo, con el Payment Brick' }
    ]
  },
  preguntas: {
    nombre: 'Preguntas frecuentes (inicio)',
    porDefecto: 'a',
    opciones: [
      { id: 'a', nombre: 'Algunas + botón', detalle: '4 preguntas cortas y un botón a la página completa' },
      { id: 'b', nombre: 'Sólo botón',      detalle: 'Nada de preguntas acá, un botón que lleva a verlas todas' },
      { id: 'c', nombre: 'Nada',            detalle: 'La sección no aparece; "Preguntas" del menú va directo a la página' }
    ]
  },
  panelInicio: {
    nombre: 'Reservas en el inicio',
    porDefecto: 'a',
    opciones: [
      { id: 'a', nombre: 'Sin panel',  detalle: 'No se muestra el calendario en el inicio; se reserva con los botones "Reservar"' },
      { id: 'b', nombre: 'Con panel',  detalle: 'Calendario y resumen completos, como antes' }
    ]
  },
  alquiler: {
    nombre: 'Cómo se alquila',
    porDefecto: 'a',
    opciones: [
      { id: 'a', nombre: 'Unidades + precios', detalle: 'Las tres unidades una vez, y debajo los precios por temporada' },
      { id: 'b', nombre: 'Bandas con foto',    detalle: 'Una banda por unidad con "desde $X"; los precios finos, plegados' }
    ]
  },
  reservas: {
    nombre: 'Reservas',
    porDefecto: 'c',
    opciones: [
      { id: 'c', nombre: 'Modal en pasos',    detalle: 'Fechas → qué alquilás → página aparte' },
      { id: 'b', nombre: 'Panel: fechas',     detalle: 'Panel lateral, fechas y después las opciones' },
      { id: 'a', nombre: 'Panel: unidad',     detalle: 'Panel lateral, primero qué alquilás' }
    ]
  },
  ambientes: {
    nombre: 'La casa por dentro',
    porDefecto: 'a',
    opciones: [
      { id: 'a', nombre: 'Carrusel',  detalle: 'Una foto grande por vez, con el texto abajo' },
      { id: 'c', nombre: 'Pantalla',  detalle: 'Casi toda la pantalla, con el texto sobre la foto' },
      { id: 'b', nombre: 'Grilla',    detalle: 'Todas las fichas juntas' }
    ]
  },
  galeria: {
    nombre: 'La casa y el lugar',
    porDefecto: 'a',
    opciones: [
      { id: 'a', nombre: 'Mosaico',  detalle: 'Pocas fotos y "ver todas"' },
      { id: 'b', nombre: 'Grilla',   detalle: 'Todas las fotos de una' }
    ]
  }
};

const Variantes = (() => {
  const clave = s => `balcones:var:${s}`;
  const oyentes = {};

  function valida(seccion, id) {
    return VARIANTES_DEF[seccion].opciones.some(o => o.id === id);
  }

  function get(seccion) {
    const def = VARIANTES_DEF[seccion];
    if (!def) return null;
    let guardada;
    try { guardada = localStorage.getItem(clave(seccion)); } catch (e) { guardada = null; }
    return guardada && valida(seccion, guardada) ? guardada : def.porDefecto;
  }

  function set(seccion, id) {
    if (!VARIANTES_DEF[seccion] || !valida(seccion, id)) return;
    try { localStorage.setItem(clave(seccion), id); } catch (e) { /* modo incógnito */ }
    (oyentes[seccion] || []).forEach(fn => fn(id));
    pintarPanel();
  }

  /** Se llama cuando cambia la variante de esa sección. */
  function alCambiar(seccion, fn) {
    (oyentes[seccion] = oyentes[seccion] || []).push(fn);
  }

  /* ------------------------------------------------------------- panel -- */

  function pintarPanel() {
    const cont = document.getElementById('panel-variantes');
    if (!cont) return;

    cont.innerHTML = Object.entries(VARIANTES_DEF).map(([sec, def]) => {
      const activa = get(sec);
      return `
        <div class="pvar__grupo">
          <p class="pvar__titulo">${def.nombre}</p>
          <div class="pvar__ops">
            ${def.opciones.map(o => `
              <button type="button" class="pvar__op${o.id === activa ? ' pvar__op--activa' : ''}"
                      data-seccion="${sec}" data-op="${o.id}" title="${o.detalle}">
                ${o.nombre}
              </button>`).join('')}
          </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('.pvar__op').forEach(b => {
      b.addEventListener('click', () => set(b.dataset.seccion, b.dataset.op));
    });
  }

  function iniciar() {
    const caja = document.getElementById('variantes');
    if (!caja) return;

    const boton = document.getElementById('pvar-boton');
    const panel = document.getElementById('panel-variantes');

    boton.addEventListener('click', () => {
      const abierto = caja.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', String(abierto));
    });

    document.addEventListener('click', e => {
      if (!caja.contains(e.target) && caja.classList.contains('abierto')) {
        caja.classList.remove('abierto');
        boton.setAttribute('aria-expanded', 'false');
      }
    });

    pintarPanel();
    if (panel) panel.hidden = false;
  }

  return { get, set, alCambiar, iniciar };
})();
