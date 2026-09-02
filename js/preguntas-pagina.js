/* ============================================================================
   Balcones del Arroyo — página de preguntas frecuentes
   Depende de: config.js

   Muestra el listado completo de FAQ (en el inicio sólo aparecen las
   destacadas — ver FAQ_DESTACADAS en js/app.js).
   ============================================================================ */

/* Aparte y con nombre (no adentro del DOMContentLoaded) para que el modo
   edición (js/editor.js) pueda volver a llamarla después de agregar, editar
   o borrar una pregunta, sin duplicar esta plantilla en otro archivo. */
function pintarFaqCompleto() {
  const cont = document.getElementById('faq-completo');
  if (!cont) return;
  cont.innerHTML = FAQ.map((f, i) => `
    <details data-i="${i}">
      <summary>${f.p}</summary>
      <div class="faq__respuesta">${f.r.split('\n').map(x => `<p>${x}</p>`).join('')}</div>
    </details>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  // El link de WhatsApp y los datos de contacto se pueden editar desde /admin.
  await Contenido.preparar(CONFIG);

  pintarPie({ cta: false });
  pintarFaqCompleto();

  const c = CONFIG.contacto;
  const mensaje = '¡Hola! Tengo una consulta sobre Balcones del Arroyo.';
  document.querySelectorAll('[data-wsp]').forEach(a => {
    a.href = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  });

  if (typeof iniciarEditor === 'function') iniciarEditor();
});
