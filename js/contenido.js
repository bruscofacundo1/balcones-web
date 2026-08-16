/* ============================================================================
   Balcones del Arroyo — contenido editable desde el panel
   ----------------------------------------------------------------------------
   `config.js` sigue siendo la base: es lo que se ve si la base de datos no
   contesta, y es lo que queda versionado en Git. Encima de eso se aplican los
   cambios que Naty haya guardado desde /admin, que viven en la tabla
   `contenido` (una fila por campo).

   Por qué así y no editando config.js: el servidor no puede escribir en su
   propio código, y la alternativa —que el panel commitee a GitHub— obliga a
   guardar un token con permiso de escritura sobre el repositorio, que es un
   secreto mucho más peligroso que el de la base. Además, con este esquema una
   caída de la base no rompe el sitio: se ve el contenido de `config.js`, que
   estará viejo pero es válido.

   Este archivo se carga con <script> en el navegador y con require() en las
   funciones de api/ — igual que precios.js. Es a propósito: la lista de qué
   se puede editar y cómo se valida tiene que ser UNA sola, o el panel deja
   guardar cosas que el servidor después rechaza (o peor, al revés).
   ============================================================================ */

(function (global) {

  /* ------------------------------------------------------------ catálogo -- */

  /**
   * Qué campos se pueden tocar desde el panel, con su tipo y sus límites.
   * Se arma a partir del config real, así los precios siguen a las temporadas
   * y modalidades que existan de verdad (si mañana se agrega una temporada,
   * aparece sola en el panel).
   *
   * Lo que NO está acá no se puede escribir, aunque alguien mande el pedido a
   * mano: `modalidades` define qué planta ocupa cada alquiler y tocarlo
   * rompería el cálculo de disponibilidad; `legales` son datos que tienen
   * consecuencias legales y no deberían cambiarse sin pensarlo.
   */
  function catalogo(config) {
    const campos = {
      'contacto.whatsapp':        { tipo: 'texto', max: 20, etiqueta: 'WhatsApp (sólo números, con código de país)', grupo: 'Contacto' },
      'contacto.telefonoVisible': { tipo: 'texto', max: 30, etiqueta: 'Teléfono como se muestra', grupo: 'Contacto' },
      'contacto.email':           { tipo: 'texto', max: 80, etiqueta: 'Email', grupo: 'Contacto' },
      'contacto.instagram':       { tipo: 'texto', max: 120, etiqueta: 'Link de Instagram', grupo: 'Contacto', opcional: true },
      'contacto.facebook':        { tipo: 'texto', max: 120, etiqueta: 'Link de Facebook', grupo: 'Contacto', opcional: true },
      'contacto.googleResenas':   { tipo: 'texto', max: 200, etiqueta: 'Link para dejar reseña en Google', grupo: 'Contacto', opcional: true },

      'reglas.senaPorcentaje':    { tipo: 'entero', min: 0, max: 100, etiqueta: 'Seña (% del total)', grupo: 'Reglas' },
      'reglas.horaCheckIn':       { tipo: 'texto', max: 10, etiqueta: 'Hora de ingreso', grupo: 'Reglas' },
      'reglas.horaCheckOut':      { tipo: 'texto', max: 10, etiqueta: 'Hora de salida', grupo: 'Reglas' },

      'textos.heroTitulo':        { tipo: 'texto', max: 120, etiqueta: 'Título principal', grupo: 'Textos' },
      'textos.heroBajada':        { tipo: 'largo', max: 400, etiqueta: 'Bajada del inicio', grupo: 'Textos' },
      'textos.casaTitulo':        { tipo: 'texto', max: 120, etiqueta: 'Título de "La casa"', grupo: 'Textos' },
      'textos.casaTexto':         { tipo: 'lista', max: 700, etiqueta: 'Párrafos de "La casa"', grupo: 'Textos' },

      'notasTarifas':             { tipo: 'lista', max: 300, etiqueta: 'Aclaraciones debajo de las tarifas', grupo: 'Textos' }
    };

    // Precios: una entrada por temporada y modalidad.
    for (const t of (config.temporadas || [])) {
      for (const m of (config.modalidades || [])) {
        campos[`temporadas.${t.id}.precios.${m.id}`] = {
          tipo: 'entero', min: 0, max: 100000000,
          etiqueta: m.nombre, grupo: `Precios · ${t.nombre}`
        };
      }
      campos[`temporadas.${t.id}.minNoches`] = {
        tipo: 'entero', min: 1, max: 30,
        etiqueta: 'Mínimo de noches', grupo: `Precios · ${t.nombre}`
      };
    }

    return campos;
  }

  /* -------------------------------------------------------- leer/escribir -- */

  /** 'temporadas.alta.precios.completa' -> el valor, buscando por el camino.
      Los tramos que son un id de temporada o modalidad se buscan por `id`,
      no por posición: el orden del array no debería importar. */
  function leerCamino(obj, camino) {
    let actual = obj;
    for (const tramo of camino.split('.')) {
      if (actual === null || actual === undefined) return undefined;
      actual = Array.isArray(actual) ? actual.find(x => x && x.id === tramo) : actual[tramo];
    }
    return actual;
  }

  function escribirCamino(obj, camino, valor) {
    const tramos = camino.split('.');
    const ultimo = tramos.pop();
    let actual = obj;
    for (const tramo of tramos) {
      if (actual === null || actual === undefined) return false;
      actual = Array.isArray(actual) ? actual.find(x => x && x.id === tramo) : actual[tramo];
    }
    if (actual === null || actual === undefined) return false;
    actual[ultimo] = valor;
    return true;
  }

  /* ------------------------------------------------------------ validar -- */

  /** Limpia un texto: sin etiquetas HTML y sin espacios de más.
      Los textos del sitio se insertan con innerHTML, así que un `<` suelto
      podría romper el maquetado (o algo peor). Ninguno necesita HTML. */
  function limpiarTexto(valor, max) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, max);
  }

  /**
   * Revisa un valor contra el catálogo. Devuelve { ok: true, valor } con el
   * valor ya normalizado, o { ok: false, error }.
   */
  function validar(camino, valor, config) {
    const campo = catalogo(config)[camino];
    if (!campo) return { ok: false, error: `"${camino}" no es un campo editable.` };

    if (campo.tipo === 'entero') {
      const n = Math.round(Number(valor));
      if (!Number.isFinite(n)) return { ok: false, error: `${campo.etiqueta}: tiene que ser un número.` };
      if (n < campo.min || n > campo.max) {
        return { ok: false, error: `${campo.etiqueta}: tiene que estar entre ${campo.min} y ${campo.max}.` };
      }
      return { ok: true, valor: n };
    }

    if (campo.tipo === 'lista') {
      const lista = (Array.isArray(valor) ? valor : String(valor || '').split('\n'))
        .map(x => limpiarTexto(x, campo.max))
        .filter(Boolean);
      if (!lista.length) return { ok: false, error: `${campo.etiqueta}: no puede quedar vacío.` };
      return { ok: true, valor: lista };
    }

    const texto = limpiarTexto(valor, campo.max);
    if (!texto && !campo.opcional) return { ok: false, error: `${campo.etiqueta}: no puede quedar vacío.` };
    return { ok: true, valor: texto };
  }

  /* ------------------------------------------------------------- aplicar -- */

  // Los valores originales de config.js, guardados la primera vez que se
  // aplica algo. Sin esto no se podría DESHACER un cambio: al aplicar los
  // overrides encima una y otra vez, un campo borrado en la base se quedaría
  // con el último valor que llegó a tener.
  let original = null;

  function guardarOriginal(config) {
    const copia = {};
    for (const camino of Object.keys(catalogo(config))) {
      const valor = leerCamino(config, camino);
      copia[camino] = Array.isArray(valor) ? valor.slice() : valor;
    }
    return copia;
  }

  /** Deja `config` con los valores de config.js y encima los cambios guardados. */
  function aplicar(config, overrides) {
    if (!original) original = guardarOriginal(config);
    for (const camino of Object.keys(original)) {
      escribirCamino(config, camino, original[camino]);
    }
    for (const camino of Object.keys(overrides || {})) {
      const r = validar(camino, overrides[camino], config);
      if (r.ok) escribirCamino(config, camino, r.valor);
    }
    return config;
  }

  /* ------------------------------------------- carga desde el navegador -- */

  const CLAVE_CACHE = 'bda-contenido';
  const BLOQUEO_MAX = 900;   // cuánto se demora la primera pintura, como mucho
  const ESPERA_MAX = 8000;   // cuánto se espera la respuesta antes de rendirse

  function leerCache() {
    try { return JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null'); }
    catch (e) { return null; }
  }

  function guardarCache(contenido) {
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(contenido)); }
    catch (e) { /* modo privado o sin espacio: no importa */ }
  }

  async function traer(espera) {
    try {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), espera);
      const r = await fetch('/api/contenido', { signal: control.signal });
      clearTimeout(reloj);
      if (!r.ok) return null;
      const datos = await r.json();
      return { contenido: datos.contenido || {}, fotos: datos.fotos || [] };
    } catch (e) {
      return null;   // sin conexión, tardó demasiado o no hay base
    }
  }

  /* ---------------------------------------------------------- la galería -- */

  // Igual que con el resto del contenido, hay que poder VOLVER: si se vacía
  // la galería en el panel, el sitio tiene que mostrar de nuevo la de
  // config.js, no quedarse con la última lista que llegó a tener.
  let fotosOriginales = null;

  /**
   * Reemplaza la galería por la editada desde el panel. Una lista vacía
   * significa "nadie la tocó": ahí vuelve la de config.js.
   *
   * Muta el array en lugar de reasignarlo porque `FOTOS` es un `const` de
   * config.js y hay funciones que ya se quedaron con la referencia.
   */
  function aplicarFotos(lista) {
    if (typeof FOTOS === 'undefined') return;
    if (!fotosOriginales) fotosOriginales = FOTOS.slice();
    const nuevas = (lista && lista.length) ? lista : fotosOriginales;
    FOTOS.length = 0;
    for (const foto of nuevas) FOTOS.push(foto);
  }

  /**
   * Deja `config` listo para pintar.
   *
   * `opciones.repintar` — función que vuelve a dibujar lo que sale de CONFIG,
   *   por si la respuesta llega después de la primera pintura.
   * `opciones.esperar`  — true en las páginas donde se muestra plata (elegir
   *   fechas y pagar). Ahí se espera la respuesta sí o sí: mostrar un importe
   *   viejo y después cobrar otro es peor que tardar medio segundo más.
   *
   * En el inicio, en cambio, la página pinta enseguida y si el contenido
   * llega tarde se repinta. Lo importante es que **el tope de espera sólo
   * decide cuánto se demora la pintura, no si el dato se usa**: aunque venza,
   * el pedido sigue vivo y se aplica cuando llega. La primera versión de esto
   * abortaba el pedido al vencer el tope y, con una conexión lenta, el
   * visitante se quedaba con los precios viejos sin enterarse nunca.
   *
   * Nunca lanza: que esto falle no puede impedir que la página se vea.
   */
  async function preparar(config, opciones) {
    const { repintar, esperar } = opciones || {};
    const cache = leerCache();
    if (cache) {
      aplicar(config, cache.contenido || cache);
      aplicarFotos(cache.fotos);
    }

    const pedido = traer(ESPERA_MAX).then(fresco => {
      if (fresco) guardarCache(fresco);
      return fresco;
    });

    const usarLoQueLlegue = fresco => {
      if (!fresco) return;
      if (cache && JSON.stringify(fresco) === JSON.stringify(cache)) return;
      aplicar(config, fresco.contenido);
      aplicarFotos(fresco.fotos);
      if (typeof repintar === 'function') repintar();
    };

    if (esperar) {
      usarLoQueLlegue(await pedido);
      return config;
    }

    if (cache) {
      pedido.then(usarLoQueLlegue);
      return config;
    }

    // Primera visita: no hay nada que mostrar todavía, así que conviene
    // esperar un poco. Si tarda de más se pinta con config.js y el contenido
    // se aplica —repintando— en cuanto llegue.
    const TARDE = Symbol('tarde');
    const cual = await Promise.race([
      pedido,
      new Promise(r => setTimeout(() => r(TARDE), BLOQUEO_MAX))
    ]);

    if (cual === TARDE) pedido.then(usarLoQueLlegue);
    else usarLoQueLlegue(cual);
    return config;
  }

  const Contenido = {
    catalogo, leerCamino, escribirCamino, validar, aplicar, aplicarFotos,
    preparar, leerCache, guardarCache, CLAVE_CACHE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Contenido;
  else global.Contenido = Contenido;

})(typeof window !== 'undefined' ? window : globalThis);
