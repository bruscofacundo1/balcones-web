/* ============================================================================
   Balcones del Arroyo — botón de arrepentimiento
   Depende de: config.js, legales.js (para los data-legal y el pie)

   La Resolución 424/2020 pide tres cosas que acá se cumplen:
     · que se pueda usar sin registrarse ni hacer ningún trámite previo,
     · que el proveedor entregue un código de identificación del trámite,
     · que el plazo sea de 10 días corridos (art. 1110 del CCyC).

   El código se arma en el navegador y se manda dentro del mensaje de
   WhatsApp: no hay servidor donde guardarlo, así que el respaldo real es el
   mensaje que le queda al huésped en su propio teléfono. Cuando el pedido
   llega, hay que responderlo dentro de las 24 horas.
   ============================================================================ */

/** Código de trámite legible: ARR-AAAAMMDD-XXXX. */
function codigoTramite() {
  const f = new Date();
  const fecha = `${f.getFullYear()}${String(f.getMonth() + 1).padStart(2, '0')}${String(f.getDate()).padStart(2, '0')}`;
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ARR-${fecha}-${azar}`;
}

function avisoArrep(texto) {
  const el = document.getElementById('a-aviso');
  if (!texto) { el.className = 'aviso'; el.textContent = ''; return; }
  el.className = 'aviso aviso--error';
  el.textContent = texto;
}

function mensajeArrepentimiento(datos, codigo) {
  const l = [];
  l.push('SOLICITUD DE ARREPENTIMIENTO (Resolución 424/2020)');
  l.push('');
  l.push(`• Código de trámite: ${codigo}`);
  l.push(`• Nombre: ${datos.nombre}`);
  l.push(`• Contacto: ${datos.contacto}`);
  if (datos.reserva) l.push(`• Reserva: ${datos.reserva}`);
  if (datos.mensaje) { l.push(''); l.push(datos.mensaje); }
  l.push('');
  l.push('Solicito la revocación de la reserva y la devolución de lo abonado.');
  return l.join('\n');
}

document.addEventListener('DOMContentLoaded', async () => {
  // El número de WhatsApp al que va el pedido se puede cambiar desde /admin.
  await Contenido.preparar(CONFIG);

  const form = document.getElementById('form-arrepentimiento');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const v = id => document.getElementById(id).value.trim();
    const datos = {
      nombre: v('a-nombre'),
      contacto: v('a-contacto'),
      reserva: v('a-reserva'),
      mensaje: v('a-mensaje')
    };

    if (!datos.nombre || !datos.contacto) {
      avisoArrep('Necesitamos tu nombre y un teléfono o email para poder responderte.');
      return;
    }
    avisoArrep('');

    const codigo = codigoTramite();
    const texto = mensajeArrepentimiento(datos, codigo);
    const url = `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(texto)}`;

    document.getElementById('a-codigo').textContent = codigo;
    document.getElementById('a-wsp').href = url;
    document.getElementById('panel-form').hidden = true;
    document.getElementById('panel-listo').hidden = false;
    document.getElementById('panel-listo').scrollIntoView({ behavior: 'smooth', block: 'center' });

    window.open(url, '_blank', 'noopener');
  });
});
