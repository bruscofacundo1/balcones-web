/* ============================================================================
   Balcones del Arroyo — paso 3: datos y pago
   Depende de: config.js, disponibilidad.js, precios.js, variantes.js,
   calendario.js, y del SDK de Mercado Pago (window.MercadoPago).

   Llega con las fechas y la unidad ya elegidas. Vuelve a validar las dos cosas
   (que el tramo siga libre y que la unidad sirva) y recalcula el precio con
   config.js, sin confiar en nada que venga del navegador. El monto que se
   cobra tampoco sale de acá: /api/crear-pago lo vuelve a calcular del lado
   del servidor con la misma cuenta (precios.js), así que aunque alguien
   manipulara este archivo en su propio navegador no podría pagar de menos.

   El campo de tarjeta es el Payment Brick de Mercado Pago: un iframe de ellos
   incrustado en la página. El número de tarjeta nunca pasa por este código ni
   por nuestro servidor — el Brick nos da sólo un token de un solo uso.
   ============================================================================ */

let calculo = null;

/** Lee y revalida lo que viene del paso anterior. */
function leerReserva() {
  let datos;
  try {
    datos = JSON.parse(sessionStorage.getItem(CLAVE_RESERVA) || 'null');
  } catch (e) {
    return null;
  }
  if (!datos || !datos.entrada || !datos.salida) return null;

  const modalidad = CONFIG.modalidades.find(m => m.id === datos.modalidad);
  if (!modalidad) return null;

  estado.modalidad = modalidad;
  estado.entrada = datos.entrada;
  estado.salida = datos.salida;
  estado.huespedes = Math.min(Math.max(1, Number(datos.huespedes) || 2), modalidad.plazas);

  // el tramo tiene que seguir libre para esta unidad
  if (hayOcupadasEntre(estado.entrada, estado.salida)) return null;
  const c = cotizar(estado.entrada, estado.salida);
  if (c.noches < c.minNoches) return null;

  return { modalidad, cotizacion: c };
}

/* ------------------------------------------------------------- pintado -- */

function pintarResumen(r) {
  const m = r.modalidad;
  const c = r.cotizacion;
  const pct = CONFIG.reglas.senaPorcentaje || 30;
  const sena = Math.round(c.total * pct / 100);

  const foto = document.getElementById('ck-foto');
  foto.src = FOTO_UNIDAD[m.id] || FOTO_UNIDAD.completa;
  foto.alt = m.nombre;

  document.getElementById('ck-unidad').textContent = m.nombre;
  document.getElementById('ck-fechas').textContent =
    `${formatoFechaLarga(estado.entrada)} al ${formatoFechaLarga(estado.salida)} · ` +
    `${c.noches} ${c.noches === 1 ? 'noche' : 'noches'} · ` +
    `${estado.huespedes} ${estado.huespedes === 1 ? 'huésped' : 'huéspedes'}`;

  document.getElementById('ck-desglose').innerHTML = htmlDesglose(c);
  document.getElementById('ck-sena-pct').textContent = pct;
  document.getElementById('ck-sena').textContent = pesos(sena);
  document.getElementById('ck-resto').textContent = pesos(c.total - sena);
  document.getElementById('ck-total-pie').textContent = pesos(sena);
  document.getElementById('ck-checkin').textContent = CONFIG.reglas.horaCheckIn;
  document.getElementById('ck-checkout').textContent = CONFIG.reglas.horaCheckOut;

  return { cotizacion: c, sena };
}

/* ---------------------------------------------------------- formulario -- */

function avisoForm(texto, tipo) {
  const el = document.getElementById('form-aviso');
  if (!texto) { el.className = 'aviso'; el.textContent = ''; return; }
  el.className = `aviso aviso--${tipo || 'error'}`;
  el.textContent = texto;
}

function datosFormulario() {
  const v = id => document.getElementById(id).value.trim();
  return {
    nombre: v('f-nombre'),
    telefono: v('f-tel'),
    email: v('f-email'),
    localidad: v('f-localidad'),
    mensaje: v('f-mensaje')
  };
}

/** Valida lo mínimo y devuelve los datos, o null si falta algo. */
function leerFormulario() {
  const datos = datosFormulario();

  if (!datos.nombre || !datos.telefono || !datos.email) {
    avisoForm('Completá nombre, teléfono y email para seguir.', 'error');
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    avisoForm('Revisá el email, parece que tiene un error.', 'error');
    document.getElementById('f-email').focus();
    return null;
  }
  if (!document.getElementById('f-acepto').checked) {
    avisoForm('Marcá la casilla para poder seguir.', 'error');
    return null;
  }

  avisoForm('', null);
  return datos;
}

/* ------------------------------------------------------------- mensaje -- */

function mensajeCompleto(datos) {
  const l = [];
  l.push('¡Hola! Quiero reservar en Balcones del Arroyo.');
  l.push('');
  l.push(`• ${estado.modalidad.nombre}`);
  l.push(`• Entrada: ${formatoFechaLarga(estado.entrada)}`);
  l.push(`• Salida: ${formatoFechaLarga(estado.salida)}`);
  l.push(`• Noches: ${calculo.cotizacion.noches}`);
  l.push(`• Huéspedes: ${estado.huespedes}`);
  l.push(`• Total estimado: ${pesos(calculo.cotizacion.total)}`);
  l.push(`• Seña (${CONFIG.reglas.senaPorcentaje || 30}%): ${pesos(calculo.sena)}`);
  l.push('');
  l.push('Mis datos:');
  l.push(`• Nombre: ${datos.nombre}`);
  l.push(`• Teléfono: ${datos.telefono}`);
  l.push(`• Email: ${datos.email}`);
  if (datos.localidad) l.push(`• Vengo de: ${datos.localidad}`);
  if (datos.mensaje) { l.push(''); l.push(datos.mensaje); }
  return l.join('\n');
}

/* ----------------------------------------------------------------- pago -- */

/** true si hay una Public Key cargada en config.js (aunque sea la de prueba). */
function hayMercadoPagoConfigurado() {
  return Boolean(CONFIG.mercadoPago && CONFIG.mercadoPago.publicKey);
}

function estadoPago(texto, tipo) {
  const el = document.getElementById('pago-estado');
  el.className = `pago-estado${tipo ? ` pago-estado--${tipo}` : ''}`;
  el.textContent = texto || '';
}

/**
 * Manda el pago recién creado por el Brick a nuestro servidor. El servidor
 * es quien de verdad cobra: acá sólo se le pasan el token de la tarjeta y los
 * datos de la reserva, nunca un monto — eso lo vuelve a calcular él.
 */
function confirmarPago(formData, datos) {
  return fetch('/api/crear-pago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      reserva: {
        modalidad: estado.modalidad.id,
        entrada: estado.entrada,
        salida: estado.salida,
        huespedes: estado.huespedes
      },
      datos
    })
  }).then(async r => {
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(cuerpo.error || 'No pudimos procesar el pago.');
    return cuerpo;
  });
}

function pintarExito(datos, resultado) {
  // Si el pago se acreditó pero el servidor no pudo guardar la reserva (ver
  // el comentario en api/crear-pago.js), el huésped ya pagó igual: hay que
  // decírselo tal cual y empujarlo fuerte hacia el WhatsApp, no esconderlo.
  const conProblema = Boolean(resultado.avisoGuardado);

  const caja = document.getElementById('pago-brick-caja');
  caja.innerHTML = `
    <div class="pago-exito">
      <h3>${conProblema ? 'Se acreditó el pago' : '¡Listo, quedaste reservado!'}</h3>
      <p>Pagaste la seña de ${pesos(resultado.sena)}.
        ${conProblema
          ? resultado.avisoGuardado
          : 'Las fechas ya están tomadas a tu nombre. Te va a llegar la confirmación de Mercado Pago por email.'}</p>
      <a class="boton boton--wsp" id="btn-avisar-wsp" href="#" target="_blank" rel="noopener">
        ${conProblema ? 'Avisar por WhatsApp' : 'Avisar por WhatsApp igual'}
      </a>
    </div>`;
  document.getElementById('btn-avisar-wsp').href =
    enlaceWsp(`¡Ya pagué la seña con Mercado Pago!\n\n${mensajeCompleto(datos)}`);
  document.getElementById('checkout-pie').hidden = true;
  document.getElementById('panel-pago').querySelector('.panel__titulo').textContent =
    conProblema ? 'Confirmá por WhatsApp' : 'Reserva confirmada';
  document.querySelector('.pasos .paso--activo')?.classList.replace('paso--activo', 'paso--hecho');
}

const MENSAJES_RECHAZO = {
  cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
  cc_rejected_bad_filled_security_code: 'El código de seguridad está mal escrito.',
  cc_rejected_bad_filled_date: 'La fecha de vencimiento está mal escrita.',
  cc_rejected_bad_filled_card_number: 'El número de tarjeta está mal escrito.',
  cc_rejected_call_for_authorize: 'El banco pide autorizar el pago antes. Llamalo o probá con otra tarjeta.',
  cc_rejected_card_disabled: 'Esa tarjeta está deshabilitada. Probá con otra o llamá al banco.',
  cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Probá con otro medio de pago.'
};

/** Arma el Payment Brick dentro de #pago-brick, para cobrar `sena`. */
function iniciarBrick(sena, datos) {
  const mp = new MercadoPago(CONFIG.mercadoPago.publicKey, { locale: 'es-AR' });

  return mp.bricks().create('payment', 'pago-brick', {
    initialization: {
      amount: sena,
      payer: { email: datos.email, entityType: 'individual' }
    },
    customization: {
      // Para sacar un medio de pago no se pone 'none': directamente no se
      // incluye la clave. 'none' rompía la inicialización del Brick porque
      // lo interpretaba como un método de "ticket" llamado "none".
      paymentMethods: {
        creditCard: 'all',
        debitCard: 'all',
        mercadoPago: 'all'
      }
    },
    callbacks: {
      onReady: () => estadoPago(''),
      onError: err => {
        console.error('Payment Brick:', err);
        estadoPago('No se pudo cargar el formulario de pago. Recargá la página o escribinos por WhatsApp.', 'error');
      },
      onSubmit: ({ formData }) => new Promise((resolve, reject) => {
        estadoPago('Procesando el pago…');
        confirmarPago(formData, datos)
          .then(resultado => {
            if (resultado.status === 'approved') {
              pintarExito(datos, resultado);
              resolve();
              return;
            }
            if (resultado.status === 'in_process' || resultado.status === 'pending') {
              estadoPago('Tu pago está en revisión. Te confirmamos apenas se acredite.', 'aviso');
              resolve();
              return;
            }
            estadoPago(
              MENSAJES_RECHAZO[resultado.status_detail] ||
              'El pago fue rechazado. Podés probar de nuevo con otra tarjeta.',
              'error'
            );
            reject();
          })
          .catch(err => {
            estadoPago(err.message || 'No pudimos procesar el pago. Probá de nuevo.', 'error');
            reject();
          });
      })
    }
  });
}

/** Arma el mensaje y abre WhatsApp — el camino de la variante A, y también
    el respaldo de la B cuando no hay Public Key o el Brick no arrancó. */
/**
 * Bloquea la fecha en el servidor (mismo chequeo que si fuera a cobrar, sin
 * cobrar nada) y recién si sale bien abre WhatsApp. Si justo se ocupó un
 * segundo antes, no llega a abrir un mensaje para una fecha que ya no está
 * — avisa y listo. Si el problema es técnico (la base, la red), no le
 * bloquea el paso a alguien que sólo quiere preguntar: deja pasar igual,
 * como siempre fue antes de que existiera este bloqueo.
 */
function reservarEnServidor(datos) {
  return fetch('/api/reservar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reserva: {
        modalidad: estado.modalidad.id,
        entrada: estado.entrada,
        salida: estado.salida,
        huespedes: estado.huespedes
      },
      datos
    })
  }).then(async r => {
    const cuerpo = await r.json().catch(() => ({}));
    if (r.status === 409) return { ocupada: true };
    if (!r.ok) throw new Error(cuerpo.error || 'no se pudo bloquear');
    return { ocupada: false };
  }).catch(err => {
    console.error('reservarEnServidor:', err);
    return { ocupada: false }; // fallo técnico: no le tapamos el WhatsApp a nadie
  });
}

async function irPorWhatsapp(datos) {
  const boton = document.getElementById('btn-finalizar');
  const { ocupada } = await reservarEnServidor(datos);

  if (ocupada) {
    avisoForm('Uy, justo se ocupó una de esas fechas mientras completabas los datos. Elegí otras.', 'error');
    boton.hidden = false;
    setTimeout(() => { window.location.href = 'reserva.html'; }, 2600);
    return;
  }

  window.open(enlaceWsp(mensajeCompleto(datos)), '_blank', 'noopener');

  document.getElementById('panel-pago').innerHTML = `
    <h2 class="panel__titulo">Coordiná la seña por WhatsApp</h2>
    <div class="pago-exito">
      <p>Te abrimos WhatsApp con todos los datos de tu reserva. Mandá el mensaje
        para coordinar la seña — apenas la confirmemos, quedan tomadas las fechas.</p>
      <a class="boton boton--wsp" id="btn-reabrir-wsp" href="#" target="_blank" rel="noopener">
        Abrir WhatsApp de nuevo
      </a>
    </div>`;
  document.getElementById('btn-reabrir-wsp').href = enlaceWsp(mensajeCompleto(datos));
  document.getElementById('checkout-pie').hidden = true;
  document.querySelector('.pasos .paso--activo')?.classList.replace('paso--activo', 'paso--hecho');
}

/** Texto de la casilla de aceptar, según cuál de las dos variantes esté activa. */
function textoAcepto(variante) {
  return variante === 'b'
    ? 'Entiendo que la reserva se confirma recién cuando se acredita la seña.'
    : 'Entiendo que la reserva se confirma cuando coordinamos la seña por WhatsApp.';
}

/** Muestra el bloque de WhatsApp o el de Mercado Pago según la variante elegida. */
function aplicarVariantePago() {
  const v = Variantes.get('pago');
  const a = document.getElementById('pago-a');
  const b = document.getElementById('pago-b');
  if (!a || !b) return; // ya se reemplazó #panel-pago por la pantalla final
  a.hidden = v !== 'a';
  b.hidden = v !== 'b';
  document.getElementById('acepto-texto').textContent = textoAcepto(v);
  document.getElementById('btn-finalizar').textContent = v === 'b' ? 'Continuar al pago' : 'Confirmar por WhatsApp';
  document.getElementById('nota-letra-chica').textContent = v === 'b'
    ? 'El valor es estimativo hasta que confirmemos la disponibilidad. No se cobra nada hasta que completes el pago.'
    : 'El valor es estimativo hasta que confirmemos la disponibilidad y coordinemos la seña por WhatsApp.';
}

/* ------------------------------------------------------------ arranque -- */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('anio').textContent = new Date().getFullYear();

  const r = leerReserva();
  if (!r) {
    document.getElementById('sin-reserva').hidden = false;
    return;
  }

  document.getElementById('checkout-todo').hidden = false;
  calculo = pintarResumen(r);

  aplicarVariantePago();
  Variantes.alCambiar('pago', aplicarVariantePago);

  document.getElementById('btn-finalizar').addEventListener('click', () => {
    const datos = leerFormulario();
    if (!datos) return;

    document.getElementById('btn-finalizar').hidden = true;

    // 'a' es la variante activa hoy: directo a WhatsApp, sin pasar por
    // Mercado Pago. Queda todo armado abajo para cuando se prenda la 'b'.
    if (Variantes.get('pago') !== 'b' || !hayMercadoPagoConfigurado()) {
      irPorWhatsapp(datos);
      return;
    }

    document.getElementById('pago-b-previo').hidden = true;
    document.getElementById('pago-brick-caja').hidden = false;
    document.getElementById('pago-brick-caja').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      iniciarBrick(calculo.sena, datos);
    } catch (err) {
      console.error('No se pudo iniciar Mercado Pago:', err);
      irPorWhatsapp(datos);
    }
  });
});
