/* ============================================================================
   Balcones del Arroyo — página de preguntas frecuentes
   Depende de: config.js

   Muestra el listado completo de FAQ (en el inicio sólo aparecen algunas,
   según la variante elegida — ver js/variantes.js y js/app.js).
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  pintarPie({ cta: false });

  document.getElementById('faq-completo').innerHTML = FAQ.map(f => `
    <details>
      <summary>${f.p}</summary>
      <div class="faq__respuesta">${f.r.split('\n').map(x => `<p>${x}</p>`).join('')}</div>
    </details>`).join('');

  const c = CONFIG.contacto;
  const mensaje = '¡Hola! Tengo una consulta sobre Balcones del Arroyo.';
  document.querySelectorAll('[data-wsp]').forEach(a => {
    a.href = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  });
});
