/* ============================================================================
   Balcones del Arroyo — pie del sitio
   Depende de: config.js

   El pie es el mismo en todas las páginas, así que se escribe una sola vez
   acá y cada página lo pide con `pintarPie()`. Antes estaba copiado a mano en
   cada HTML y se desincronizaba solo.

   Incluye los links legales que exige vender por internet en Argentina
   (ver §7 de CONTEXTO.md). El de "Botón de arrepentimiento" va aparte y
   destacado: la Resolución 424/2020 pide que sea de acceso fácil y directo
   desde la página inicial, no escondido entre los demás.
   ============================================================================ */

/**
 * Dibuja el pie dentro de <footer class="pie" id="pie"></footer>.
 * `opciones.cta` = true agrega arriba el bloque de "Escribinos y coordinamos"
 * (va en el inicio; en las páginas de reserva estorba).
 */
function pintarPie(opciones = {}) {
  const pie = document.getElementById('pie');
  if (!pie) return;

  const c = CONFIG.contacto;
  const l = CONFIG.legales || {};
  const mensaje = '¡Hola! Vi la web de Balcones del Arroyo y quiero consultar disponibilidad.';
  const wsp = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensaje)}`;

  // en subpáginas los anclas del inicio necesitan el archivo por delante
  const raiz = opciones.enInicio ? '' : 'index.html';

  const redes = [];
  if (c.instagram) redes.push(`<a href="${c.instagram}" target="_blank" rel="noopener">Instagram</a>`);
  if (c.facebook) redes.push(`<a href="${c.facebook}" target="_blank" rel="noopener">Facebook</a>`);
  redes.push(`<a href="${wsp}" target="_blank" rel="noopener">WhatsApp</a>`);

  // Sólo se publica lo que esté cargado de verdad: un CUIT vacío o un número
  // de registro inventado son peores que no mostrar nada.
  const fiscal = [];
  if (l.cuit) fiscal.push(`CUIT ${l.cuit}`);
  if (l.registroTuristico) fiscal.push(`Registro de alojamiento turístico ${l.registroTuristico}`);

  pie.innerHTML = `
    <div class="contenedor">
      ${opciones.cta ? `
      <div class="pie__cta">
        <h2>Escribinos y coordinamos</h2>
        <p>Contestamos por WhatsApp todos los días. Contanos las fechas, cuántos
          son y si venís con mascota, y te pasamos la disponibilidad al toque.</p>
        <a class="boton boton--wsp" href="${wsp}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
      </div>` : ''}

      <div class="pie__cols">
        <div class="pie__col pie__col--marca">
          <p class="pie__nombre">Balcones del Arroyo</p>
          <p class="pie__desc">Casa de campo en Arroyo de los Patos, entre Nono y
            Mina Clavero, Valle de Traslasierra, Córdoba.</p>
          <div class="pie__redes">${redes.join('')}</div>
        </div>

        <div class="pie__col">
          <h3>Contacto</h3>
          <ul class="pie__lista">
            <li><a href="${wsp}" target="_blank" rel="noopener">${c.telefonoVisible}</a></li>
            <li><a href="mailto:${c.email}">${c.email}</a></li>
            <li>${c.direccion}</li>
          </ul>
        </div>

        <div class="pie__col">
          <h3>El sitio</h3>
          <ul class="pie__lista">
            <li><a href="${raiz}#la-casa">La casa</a></li>
            <li><a href="${raiz}#tarifas">Tarifas</a></li>
            <li><a href="${raiz}#galeria">Galería</a></li>
            <li><a href="${raiz}#ubicacion">Ubicación</a></li>
            <li><a href="${raiz}#opiniones">Opiniones</a></li>
            <li><a href="preguntas.html">Preguntas frecuentes</a></li>
          </ul>
        </div>

        <div class="pie__col">
          <h3>Información legal</h3>
          <ul class="pie__lista">
            <li><a href="legales.html#terminos">Términos y condiciones</a></li>
            <li><a href="legales.html#privacidad">Política de privacidad</a></li>
            <li><a href="legales.html#cancelacion">Política de cancelación</a></li>
          </ul>
          <a class="pie__arrepentimiento" href="arrepentimiento.html">Botón de arrepentimiento</a>
        </div>
      </div>

      <div class="pie__barra">
        <p>© ${new Date().getFullYear()} ${l.titular || 'Balcones del Arroyo'} ·
          ${l.domicilio || c.direccion}</p>
        ${fiscal.length ? `<p class="pie__fiscal">${fiscal.join(' · ')}</p>` : ''}
      </div>
    </div>`;
}
