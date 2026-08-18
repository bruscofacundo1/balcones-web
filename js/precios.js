/* ============================================================================
   Balcones del Arroyo — fechas, disponibilidad y cotización
   ----------------------------------------------------------------------------
   Funciones puras, sin nada de DOM: corren igual en el navegador (las usa
   calendario.js) que en el servidor (las usan las funciones de api/, para
   crear el pago). Es a propósito: el monto y la disponibilidad que valida el
   servidor tienen que salir de la MISMA cuenta que ve el navegador, nunca de
   una copia aparte que se pueda desincronizar.

   Se carga con <script> normal en el navegador (define `window.Precios`) y
   con require() en Node (module.exports). No uses import/export acá.
   ============================================================================ */

(function (global) {

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

  /** Lista de noches (ISO) entre dos fechas, sin incluir la de salida. */
  function nochesLista(desde, hasta) {
    const noches = [];
    let f = deIso(desde);
    const fin = deIso(hasta);
    while (f < fin) {
      noches.push(aIso(f));
      f = sumarDias(f, 1);
    }
    return noches;
  }

  /* ------------------------------------------------------- disponibilidad -- */

  function modalidadPorId(id, config) {
    return config.modalidades.find(m => m.id === id) || null;
  }

  /**
   * Arma el índice { alta: Set, baja: Set } de noches ocupadas a partir de un
   * objeto con esa forma (acepta también el formato viejo de una sola lista
   * `ocupadas`, que se interpreta como la casa entera ocupada).
   */
  function construirOcupadas(disponibilidad) {
    const d = disponibilidad || {};
    if (Array.isArray(d.ocupadas)) {
      const todas = new Set(d.ocupadas);
      return { alta: todas, baja: new Set(todas) };
    }
    return { alta: new Set(d.alta || []), baja: new Set(d.baja || []) };
  }

  /** Junta dos índices de ocupadas (por ejemplo: el archivo estático + lo que
      ya se pagó online) en uno solo. */
  function unirOcupadas(a, b) {
    return {
      alta: new Set([...(a.alta || []), ...(b.alta || [])]),
      baja: new Set([...(a.baja || []), ...(b.baja || [])])
    };
  }

  /** ¿La modalidad elegida está libre esa noche? */
  function libre(iso, modalidad, ocupadas) {
    return modalidad.ocupa.every(planta => !ocupadas[planta].has(iso));
  }

  /** ¿Queda algo para alquilar esa noche, aunque sea una sola planta? */
  function libreAlguna(iso, config, ocupadas) {
    return config.modalidades.some(m => libre(iso, m, ocupadas));
  }

  function hayOcupadasEntre(desde, hasta, modalidad, ocupadas) {
    let f = deIso(desde);
    const fin = deIso(hasta);
    while (f < fin) {
      if (!libre(aIso(f), modalidad, ocupadas)) return true;
      f = sumarDias(f, 1);
    }
    return false;
  }

  /* ---------------------------------------------------------- temporadas -- */

  /** Un rango con año ('2027-03-25') vale sólo ese año; uno sin año
      ('03-25') se repite todos. */
  function rangoConAnio(r) {
    return /^\d{4}-/.test(String(r.desde || ''));
  }

  /**
   * Devuelve la temporada que corresponde a una fecha ISO.
   *
   * Hay dos clases de rango y **el más específico gana**:
   *
   * - **Con año** (`AAAA-MM-DD`): vale sólo ese año. Es para lo que se mueve —
   *   Semana Santa, los fines de semana largos— que no se puede escribir como
   *   `MM-DD` porque cambia de fecha cada año.
   * - **Sin año** (`MM-DD`): se repite todos los años. Si el rango termina
   *   antes de empezar (12-20 -> 02-29) se entiende que cruza el año.
   *
   * Se revisan primero los que tienen año, así una Semana Santa puede pisar un
   * mes entero sin tener que partir el rango del mes en dos. No se le hace un
   * agujero a julio: se le pone una excepción encima.
   */
  function temporadaDe(iso, config) {
    const md = iso.slice(5); // 'MM-DD'

    for (const t of config.temporadas) {
      for (const r of (t.rangos || [])) {
        if (rangoConAnio(r) && iso >= r.desde && iso <= r.hasta) return t;
      }
    }

    for (const t of config.temporadas) {
      for (const r of (t.rangos || [])) {
        if (rangoConAnio(r)) continue;
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
  function temporadaFallback(config) {
    return config.temporadas.find(t => t.id === 'media') || config.temporadas[0];
  }

  /* --------------------------------------------------------------- precio -- */

  /** Precio por noche de una temporada para la modalidad elegida. */
  function precioNoche(temporada, modalidad, config, huespedes) {
    const base = temporada.precios[modalidad.id];
    return config.reglas.precioPorUnidad ? base : base * huespedes;
  }

  /**
   * Agrupa las noches por temporada y calcula el total.
   * Devuelve { noches, tramos: [{temporada, noches, subtotal}], total, minNoches }
   */
  function cotizar(entrada, salida, modalidad, config, huespedes) {
    const tramos = new Map();
    let total = 0;
    let minNoches = config.reglas.minNochesGeneral;

    let f = deIso(entrada);
    const fin = deIso(salida);
    while (f < fin) {
      const iso = aIso(f);
      const t = temporadaDe(iso, config) || temporadaFallback(config);
      const precio = precioNoche(t, modalidad, config, huespedes);

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

  const Precios = {
    aIso, deIso, sumarDias, nochesEntre, nochesLista,
    modalidadPorId, construirOcupadas, unirOcupadas,
    libre, libreAlguna, hayOcupadasEntre,
    temporadaDe, temporadaFallback, rangoConAnio,
    precioNoche, cotizar
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Precios;
  else global.Precios = Precios;

})(typeof window !== 'undefined' ? window : globalThis);
