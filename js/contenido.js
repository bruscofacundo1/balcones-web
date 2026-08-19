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

  /* ---------------------------------------------------------- colecciones -- */

  /**
   * Las listas de fichas repetidas: preguntas frecuentes, opiniones.
   *
   * Son distintas del resto del catálogo, donde cada campo guarda **un** valor
   * (un número, un texto, una lista de textos). Acá cada ítem es un objeto con
   * varios sub-campos, y además se pueden agregar, sacar y reordenar.
   *
   * No viven adentro de CONFIG: son `const` sueltos de config.js (`FAQ`,
   * `RESENAS`), y hay funciones que ya se quedaron con la referencia al array.
   * Por eso se leen y se escriben como FOTOS —mutando el array en su lugar— y
   * no con `leerCamino`/`escribirCamino`.
   */
  const COLECCIONES = {
    FAQ: {
      etiqueta: 'Preguntas frecuentes',
      grupo: 'Preguntas frecuentes',
      singular: 'pregunta',
      plural: 'preguntas',
      maxItems: 40,
      campos: {
        p: { tipo: 'texto', max: 200, etiqueta: 'Pregunta' },
        r: { tipo: 'largo', max: 1500, etiqueta: 'Respuesta' }
      }
    },
    RESENAS: {
      etiqueta: 'Opiniones',
      grupo: 'Opiniones',
      singular: 'opinión',
      plural: 'opiniones',
      maxItems: 60,
      campos: {
        texto:     { tipo: 'largo', max: 900, etiqueta: 'Lo que escribió' },
        autor:     { tipo: 'texto', max: 80, etiqueta: 'Quién' },
        fuente:    { tipo: 'texto', max: 40, etiqueta: 'De dónde (Google, Booking…)' },
        fecha:     { tipo: 'texto', max: 7, etiqueta: 'Cuándo (AAAA-MM)' },
        estrellas: { tipo: 'entero', min: 1, max: 5, etiqueta: 'Estrellas' }
      }
    }
  };

  /**
   * El array vivo de una colección, o null si no está cargado.
   *
   * Se referencian por identificador y no por `window[nombre]` porque un
   * `const` en el tope de un script clásico no queda colgado de `window`. En
   * Node devuelve null —config.js no está en este ámbito— y eso está bien:
   * el servidor sólo necesita **validar** colecciones, no pintarlas. Es
   * exactamente lo que ya pasaba con FOTOS.
   */
  function listaViva(nombre) {
    if (nombre === 'FAQ') return typeof FAQ !== 'undefined' ? FAQ : null;
    if (nombre === 'RESENAS') return typeof RESENAS !== 'undefined' ? RESENAS : null;
    return null;   // los rangos de temporada sí viven adentro de CONFIG
  }

  /* --------------------------------------------- revisores por ficha -- */

  /**
   * Comprobaciones que cruzan **dos sub-campos de la misma ficha**, y que por
   * eso no entran en la validación campo por campo.
   *
   * Se nombran con un string en el esquema (`revisarItem: 'rango'`) y no con
   * la función directamente porque el catálogo viaja al panel como JSON, y una
   * función no sobrevive a `JSON.stringify`.
   */
  function revisarRango(item) {
    const conAnio = s => /^\d{4}-/.test(String(s || ''));
    if (conAnio(item.desde) !== conAnio(item.hasta)) {
      return 'las dos fechas tienen que ser del mismo tipo: o las dos con año (sólo ese año), o las dos sin año (todos los años).';
    }
    // Sin año, que `hasta` sea menor que `desde` es válido: significa que el
    // rango cruza el año (12-20 -> 02-29). Con año, es un error.
    if (conAnio(item.desde) && item.desde > item.hasta) {
      return 'la fecha de inicio quedó después de la de fin.';
    }
    return null;
  }

  const REVISORES = { rango: revisarRango };

  /* ------------------------------------------------------- Semana Santa -- */

  /**
   * Domingo de Pascua (Meeus/Jones/Butcher, calendario gregoriano).
   *
   * Está acá porque es la única fecha móvil del calendario argentino que se
   * puede calcular: los feriados trasladables y los "puentes" los fija el
   * gobierno por decreto cada año y hay que cargarlos a mano.
   */
  function domingoDePascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  /** Semana Santa de ese año como rango listo para cargar: jueves a domingo. */
  function semanaSanta(anio) {
    const iso = f => f.toISOString().slice(0, 10);
    const pascua = domingoDePascua(anio);
    const jueves = new Date(pascua);
    jueves.setUTCDate(pascua.getUTCDate() - 3);
    return { nombre: `Semana Santa ${anio}`, desde: iso(jueves), hasta: iso(pascua) };
  }

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

      // El texto que se muestra ("Enero, febrero, Semana Santa…"). Es aparte de
      // los rangos y puede quedar desincronizado, así que conviene revisarlo
      // cada vez que se tocan las fechas.
      campos[`temporadas.${t.id}.periodo`] = {
        tipo: 'texto', max: 160,
        etiqueta: 'Cómo se describe en el sitio', grupo: `Fechas · ${t.nombre}`
      };

      // Cuándo rige cada temporada. Es una colección, pero a diferencia de FAQ
      // y RESENAS ésta sí vive adentro de CONFIG.
      campos[`temporadas.${t.id}.rangos`] = {
        tipo: 'coleccion', etiqueta: `Cuándo rige ${t.nombre}`,
        grupo: `Fechas · ${t.nombre}`,
        singular: 'período', plural: 'períodos',
        maxItems: 30, revisarItem: 'rango',
        campos: {
          nombre: { tipo: 'texto', max: 60, etiqueta: 'Nombre' },
          desde:  { tipo: 'fecha', etiqueta: 'Desde' },
          hasta:  { tipo: 'fecha', etiqueta: 'Hasta' }
        }
      };
    }

    // Las colecciones entran al catálogo como un campo más, con tipo propio.
    for (const nombre of Object.keys(COLECCIONES)) {
      const c = COLECCIONES[nombre];
      campos[nombre] = {
        tipo: 'coleccion', etiqueta: c.etiqueta, grupo: c.grupo,
        singular: c.singular, plural: c.plural, maxItems: c.maxItems, campos: c.campos
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
  /**
   * Valida **un valor suelto** contra su descripción.
   *
   * Está separado de `validar` porque los sub-campos de una colección se
   * revisan con exactamente las mismas reglas que un campo de primer nivel: si
   * fueran dos implementaciones, un texto adentro de una pregunta aceptaría
   * cosas que el mismo texto suelto rechaza.
   */
  function validarValor(campo, valor, etiqueta) {
    const nombre = etiqueta || campo.etiqueta;

    if (campo.tipo === 'entero') {
      const n = Math.round(Number(valor));
      if (!Number.isFinite(n)) return { ok: false, error: `${nombre}: tiene que ser un número.` };
      if (n < campo.min || n > campo.max) {
        return { ok: false, error: `${nombre}: tiene que estar entre ${campo.min} y ${campo.max}.` };
      }
      return { ok: true, valor: n };
    }

    if (campo.tipo === 'lista') {
      const lista = (Array.isArray(valor) ? valor : String(valor || '').split('\n'))
        .map(x => limpiarTexto(x, campo.max))
        .filter(Boolean);
      if (!lista.length) return { ok: false, error: `${nombre}: no puede quedar vacío.` };
      return { ok: true, valor: lista };
    }

    if (campo.tipo === 'fecha') {
      const s = String(valor === null || valor === undefined ? '' : valor).trim();
      if (!/^(\d{4}-)?\d{2}-\d{2}$/.test(s)) {
        return {
          ok: false,
          error: `${nombre}: va como MM-DD (se repite todos los años) o AAAA-MM-DD (sólo ese año).`
        };
      }
      const mes = Number(s.slice(-5, -3));
      const dia = Number(s.slice(-2));
      // Se permite 02-29 a propósito: en los años bisiestos existe, y en los
      // demás simplemente no coincide con ninguna noche.
      const largo = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (mes < 1 || mes > 12 || dia < 1 || dia > largo[mes - 1]) {
        return { ok: false, error: `${nombre}: "${s}" no es una fecha real.` };
      }
      return { ok: true, valor: s };
    }

    const texto = limpiarTexto(valor, campo.max);
    if (!texto && !campo.opcional) return { ok: false, error: `${nombre}: no puede quedar vacío.` };
    return { ok: true, valor: texto };
  }

  /**
   * Una colección entera: la lista y cada uno de sus sub-campos.
   *
   * Puede quedar vacía a propósito — la sección de opiniones se esconde sola
   * si no hay ninguna, que es mejor que mostrar un carrusel vacío.
   *
   * Los ítems se reconstruyen campo por campo, así que cualquier clave que no
   * esté en el esquema se descarta. Eso saca de paso las notas `revisar` de las
   * preguntas de ejemplo: si alguien la editó, ya no hay nada que revisar.
   */
  function validarColeccion(campo, valor) {
    if (!Array.isArray(valor)) {
      return { ok: false, error: `${campo.etiqueta}: se esperaba una lista.` };
    }
    if (valor.length > campo.maxItems) {
      return { ok: false, error: `${campo.etiqueta}: no puede tener más de ${campo.maxItems}.` };
    }

    const limpios = [];
    for (let i = 0; i < valor.length; i++) {
      const item = valor[i] || {};
      const salida = {};
      for (const clave of Object.keys(campo.campos)) {
        const sub = campo.campos[clave];
        const r = validarValor(sub, item[clave], `${campo.singular} ${i + 1} — ${sub.etiqueta}`);
        if (!r.ok) return r;
        salida[clave] = r.valor;
      }

      // Lo que cruza dos sub-campos de la misma ficha.
      const revisor = REVISORES[campo.revisarItem];
      if (revisor) {
        const problema = revisor(salida);
        if (problema) {
          return { ok: false, error: `${campo.etiqueta}, ${campo.singular} ${i + 1}: ${problema}` };
        }
      }

      limpios.push(salida);
    }
    return { ok: true, valor: limpios };
  }

  /* ------------------------------------------------- cobertura del año -- */

  /** Los 366 'MM-DD' de un año bisiesto: el 29/2 tiene que estar cubierto. */
  function diasDelAnio() {
    const largo = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const dias = [];
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= largo[m]; d++) {
        dias.push(String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
      }
    }
    return dias;
  }

  /**
   * Revisa que los rangos que se repiten todos los años cubran el año
   * **exactamente una vez**.
   *
   * Es la comprobación que no puede hacer la validación campo por campo, porque
   * cruza las tres temporadas. Y es la que más importa de todo el catálogo: si
   * una noche queda sin temporada se cobra al precio del fallback, y si queda
   * en dos gana la que esté primero en el array — las dos formas de cobrar mal
   * sin que nadie se entere.
   *
   * Los rangos con año no entran: son excepciones y se espera que pisen.
   */
  function revisarCobertura(config) {
    const huecos = [];
    const choques = [];

    for (const md of diasDelAnio()) {
      const cubren = [];
      for (const t of (config.temporadas || [])) {
        for (const r of (t.rangos || [])) {
          if (/^\d{4}-/.test(String(r.desde || ''))) continue;
          const cruza = r.hasta < r.desde;
          const dentro = cruza
            ? (md >= r.desde || md <= r.hasta)
            : (md >= r.desde && md <= r.hasta);
          if (dentro) cubren.push(r.nombre ? `${t.nombre} (${r.nombre})` : t.nombre);
        }
      }
      if (!cubren.length) huecos.push(md);
      else if (cubren.length > 1) choques.push({ dia: md, temporadas: cubren });
    }

    return { ok: !huecos.length && !choques.length, huecos, choques };
  }

  function validar(camino, valor, config) {
    const campo = catalogo(config)[camino];
    if (!campo) return { ok: false, error: `"${camino}" no es un campo editable.` };
    return campo.tipo === 'coleccion'
      ? validarColeccion(campo, valor)
      : validarValor(campo, valor);
  }

  /* ------------------------------------------------------------- aplicar -- */

  // Los valores originales de config.js, guardados la primera vez que se
  // aplica algo. Sin esto no se podría DESHACER un cambio: al aplicar los
  // overrides encima una y otra vez, un campo borrado en la base se quedaría
  // con el último valor que llegó a tener.
  let original = null;

  /** Lee un campo del catálogo, venga de CONFIG o de una lista global. */
  function leerCampo(config, camino) {
    const campo = catalogo(config)[camino];
    if (campo && campo.tipo === 'coleccion') {
      const viva = listaViva(camino);
      if (viva) return viva.map(x => Object.assign({}, x));
      // Colecciones que sí viven adentro de CONFIG: los rangos de temporada.
      const dentro = leerCamino(config, camino);
      return Array.isArray(dentro) ? dentro.map(x => Object.assign({}, x)) : undefined;
    }
    return leerCamino(config, camino);
  }

  /** Escribe un campo del catálogo, vaya a CONFIG o a una lista global. */
  function escribirCampo(config, camino, valor) {
    const campo = catalogo(config)[camino];
    if (campo && campo.tipo === 'coleccion') {
      const viva = listaViva(camino);
      if (viva) {
        if (!Array.isArray(valor)) return false;
        // Se muta el array en su lugar en vez de reasignarlo: es un `const` de
        // config.js y hay funciones que ya se quedaron con la referencia. Igual
        // que con FOTOS.
        viva.length = 0;
        for (const item of valor) viva.push(item);
        return true;
      }
      // Los rangos viven adentro de CONFIG y nadie guarda la referencia al
      // array (`temporadaDe` lo recorre fresco), así que se puede reemplazar.
      return escribirCamino(config, camino, valor);
    }
    return escribirCamino(config, camino, valor);
  }

  function guardarOriginal(config) {
    const copia = {};
    for (const camino of Object.keys(catalogo(config))) {
      const valor = leerCampo(config, camino);
      copia[camino] = Array.isArray(valor) ? valor.slice() : valor;
    }
    return copia;
  }

  /** Deja `config` con los valores de config.js y encima los cambios guardados. */
  function aplicar(config, overrides) {
    if (!original) original = guardarOriginal(config);
    for (const camino of Object.keys(original)) {
      escribirCampo(config, camino, original[camino]);
    }
    for (const camino of Object.keys(overrides || {})) {
      const r = validar(camino, overrides[camino], config);
      if (r.ok) escribirCampo(config, camino, r.valor);
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
      return {
        contenido: datos.contenido || {},
        fotos: datos.fotos || [],
        // null = "no se pudo saber". Distinto de {alta:[],baja:[]}, que
        // significa "no hay ninguna noche ocupada".
        ocupadas: datos.ocupadas === undefined ? null : datos.ocupadas
      };
    } catch (e) {
      return null;   // sin conexión, tardó demasiado o no hay base
    }
  }

  /* ---------------------------------------------------------- vista previa -- */

  /*
     Entrando a /?preview=1 el sitio se pinta con el borrador que el panel dejó
     en localStorage, en vez de con lo que está publicado. Es el mismo mecanismo
     que cualquier CMS llama "draft mode": la página se comporta distinto cuando
     el flag está puesto.

     Dos decisiones que importan:

     - **No se lee el caché.** Si se aplicara primero lo cacheado y encima el
       borrador, se vería un parpadeo justo en el momento en que alguien está
       mirando si su cambio quedó bien. Sí se sigue pidiendo /api/contenido,
       porque de ahí salen las fotos: el borrador sólo lleva los textos y los
       precios, que es lo que se edita en la pestaña "Precios y textos".

     - **Es seguro por construcción.** El borrador vive en el localStorage de
       quien edita, así que un visitante cualquiera que entre a /?preview=1 no
       tiene nada guardado y ve el sitio normal. No hay nada que proteger acá.
  */

  const PREVIEW_CLAVE = 'bda-contenido-preview';

  function enPreview() {
    try { return new URLSearchParams(location.search).has('preview'); }
    catch (e) { return false; }
  }

  function leerPreview() {
    try { return JSON.parse(localStorage.getItem(PREVIEW_CLAVE) || 'null'); }
    catch (e) { return null; }
  }

  function guardarPreview(borrador) {
    try { localStorage.setItem(PREVIEW_CLAVE, JSON.stringify(borrador)); }
    catch (e) { /* modo privado o sin espacio */ }
  }

  function borrarPreview() {
    try { localStorage.removeItem(PREVIEW_CLAVE); }
    catch (e) { /* da igual */ }
  }

  /**
   * Cuando el panel guarda un borrador nuevo, esta pestaña se RECARGA entera
   * en vez de repintar la parte que cambió.
   *
   * Es a propósito, y es lo que más problemas evita: el sitio no tiene
   * framework ni estado que se pueda perder, así que recargar desde el caché
   * del navegador es instantáneo y vuelve a pasar por el mismo camino de
   * siempre. Un repintado parcial reviviría el bug del IntersectionObserver de
   * `.revelar` (ver CONTEXTO.md §3, "Animaciones"): un elemento pintado después
   * de que corrió `iniciarRevelado()` no lo observa nadie y se queda invisible
   * para siempre. Ese bug ya apareció dos veces; no hace falta una tercera.
   */
  function escucharPreview() {
    window.addEventListener('storage', e => {
      if (e.key === PREVIEW_CLAVE) location.reload();
    });
  }

  /** Cinta fija para que nadie confunda el preview con el sitio publicado. */
  function marcarPreview() {
    const poner = () => {
      if (document.getElementById('cinta-preview')) return;
      const cinta = document.createElement('div');
      cinta.id = 'cinta-preview';
      cinta.textContent = 'Vista previa — cambios sin publicar';
      // Va con estilos propios y no en estilos.css porque es una pieza del
      // panel que se cuela en el sitio, no parte del sitio.
      cinta.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
        'background:#b4552f', 'color:#fff', 'text-align:center',
        'font:600 .78rem/1 system-ui,sans-serif', 'letter-spacing:.04em',
        'padding:9px 12px',
        // Sin esto taparía el botón de variantes, que vive en la misma esquina.
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(cinta);
    };
    if (document.body) poner();
    else document.addEventListener('DOMContentLoaded', poner);
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
  /**
   * Las fotos que van en el mosaico de la home.
   *
   * **No son las primeras 8 de la lista**: se toman hasta 3 de cada categoría
   * en un orden fijo (primero el entorno y las de afuera) y recién ahí se corta
   * en 8. Reordenar una foto en el panel puede sacarla o meterla en el mosaico
   * sin que su número de orden lo explique.
   *
   * Vive acá y no en app.js porque el panel necesita la misma cuenta para poder
   * marcar cuáles salen en la portada. Si fueran dos copias, la marca del panel
   * y lo que se ve en el sitio se desincronizarían al primer cambio.
   */
  function fotosDestacadas(lista) {
    const orden = ['entorno', 'aire-libre', 'casa', 'interiores'];
    const elegidas = [];
    orden.forEach(cat => {
      lista.filter(f => f.c === cat).slice(0, 3).forEach(f => elegidas.push(f));
    });
    return (elegidas.length ? elegidas : lista).slice(0, 8);
  }

  function aplicarFotos(lista) {
    if (typeof FOTOS === 'undefined') return;
    if (!fotosOriginales) fotosOriginales = FOTOS.slice();
    const nuevas = (lista && lista.length) ? lista : fotosOriginales;
    FOTOS.length = 0;
    for (const foto of nuevas) FOTOS.push(foto);
  }

  /* --------------------------------------------------- disponibilidad -- */

  // Si alguna vez llegó la lista del servidor, aunque después falle un pedido.
  // Evita que un error de red vuelva a mostrar el calendario entero libre.
  let ocupadasConocidas = false;

  /**
   * Vuelca en `OCUPADAS` las noches que están tomadas.
   *
   * **Sin esto el calendario mostraba todo libre siempre.** `OCUPADAS` se
   * armaba sólo desde `disponibilidad.js`, que quedó vacío a propósito cuando
   * la disponibilidad pasó a vivir en la base — pero del lado del navegador
   * nadie la reemplazó. El visitante elegía fechas ya vendidas y se enteraba
   * recién al confirmar, con un mensaje pensado para una carrera rara.
   *
   * Se vacía y se vuelve a llenar el Set en su lugar en vez de reasignarlo:
   * `OCUPADAS` es un `const` de calendario.js y varias funciones ya se
   * quedaron con la referencia. Igual que con FOTOS.
   *
   * Lo que quede en `disponibilidad.js` se suma, no se pisa: ese archivo sigue
   * siendo la red de seguridad para bloquear algo sin base de datos.
   */
  function aplicarOcupadas(ocupadas) {
    if (!ocupadas) return false;
    let destino;
    try {
      if (typeof OCUPADAS === 'undefined') return false;
      destino = OCUPADAS;
    } catch (e) {
      return false;   // calendario.js no está cargado en esta página
    }

    let base = { alta: [], baja: [] };
    try {
      if (typeof DISPONIBILIDAD !== 'undefined') base = DISPONIBILIDAD;
    } catch (e) { /* tampoco pasa nada */ }

    for (const planta of ['alta', 'baja']) {
      if (!destino[planta]) continue;
      destino[planta].clear();
      for (const n of (base[planta] || [])) destino[planta].add(n);
      for (const n of (ocupadas[planta] || [])) destino[planta].add(n);
    }
    ocupadasConocidas = true;
    return true;
  }

  /** ¿Se pudo confirmar la disponibilidad con el servidor? Lo usa el sitio
      para no prometer una fecha que no pudo verificar. */
  function hayDisponibilidadFresca() {
    return ocupadasConocidas;
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

    // Draft mode: cortocircuita el caché y la lógica de espera de más abajo.
    // Se espera la respuesta sí o sí (las fotos salen de ahí) y no importa que
    // tarde: acá no hay un visitante esperando, hay alguien mirando su cambio.
    if (enPreview()) {
      escucharPreview();
      const borrador = leerPreview();
      const fresco = await traer(ESPERA_MAX);
      aplicar(config, (borrador && borrador.contenido) || (fresco && fresco.contenido) || {});
      aplicarFotos((fresco && fresco.fotos) || []);
      aplicarOcupadas(fresco && fresco.ocupadas);
      marcarPreview();
      // No se llama a `repintar`: todas las páginas esperan a `preparar()`
      // antes de pintar nada, así que acá todavía no hay nada pintado.
      return config;
    }

    const cache = leerCache();
    if (cache) {
      aplicar(config, cache.contenido || cache);
      aplicarFotos(cache.fotos);
      // La disponibilidad cacheada NO se aplica: es lo único de acá que
      // caduca de verdad (una noche libre ayer puede estar vendida hoy).
      // Se espera la del servidor y hasta entonces `hayDisponibilidadFresca()`
      // devuelve false.
    }

    const pedido = traer(ESPERA_MAX).then(fresco => {
      if (fresco) guardarCache(fresco);
      return fresco;
    });

    const usarLoQueLlegue = fresco => {
      if (!fresco) return;
      // La disponibilidad se aplica siempre, aunque el resto no haya cambiado:
      // el calendario arranca sin ella y es el dato que no puede quedar viejo.
      const cambioDisponibilidad = aplicarOcupadas(fresco.ocupadas);
      if (cache && JSON.stringify(fresco) === JSON.stringify(cache)) {
        if (cambioDisponibilidad && typeof repintar === 'function') repintar();
        return;
      }
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
    catalogo, leerCamino, escribirCamino, leerCampo, escribirCampo,
    validar, validarValor, aplicar, aplicarFotos, COLECCIONES,
    revisarCobertura, revisarRango, semanaSanta, domingoDePascua,
    preparar, leerCache, guardarCache, CLAVE_CACHE, fotosDestacadas,
    aplicarOcupadas, hayDisponibilidadFresca,
    enPreview, leerPreview, guardarPreview, borrarPreview, PREVIEW_CLAVE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Contenido;
  else global.Contenido = Contenido;

})(typeof window !== 'undefined' ? window : globalThis);
