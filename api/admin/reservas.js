/* ============================================================================
   GET/POST /api/admin/reservas
   ----------------------------------------------------------------------------
   Todo lo que el panel puede hacer con las reservas:

     GET                      -> lista (agregá ?canceladas=1 para ver las bajas)
     POST {accion:'crear'}    -> cargar una reserva a mano, o bloquear fechas
     POST {accion:'cancelar'} -> dar de baja y liberar las noches
     POST {accion:'confirmar'}-> pendiente -> confirmada (llegó la seña)
     POST {accion:'actualizar'} -> editar plata, nota y datos del huésped

   Protegido por la cookie de sesión (ver lib/sesion.js). Sin sesión válida no
   contesta nada, ni siquiera el listado.
   ============================================================================ */

const { CONFIG } = require('../../js/config.js');
const { DISPONIBILIDAD } = require('../../js/disponibilidad.js');
const Precios = require('../../js/precios.js');
const { exigirSesion } = require('../../lib/sesion.js');
const {
  listarReservas, obtenerReserva, cancelarReserva, confirmarReserva,
  actualizarReserva, crearReservaManual, nochesPagadas
} = require('../../lib/reservas.js');

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function nuevoId(tipo) {
  const prefijo = tipo === 'bloqueo' ? 'blo' : 'man';
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Número que puede venir vacío/nulo desde el formulario. */
function numeroOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

async function crear(req, res) {
  const b = req.body || {};
  const tipo = b.tipo === 'bloqueo' ? 'bloqueo' : 'reserva';

  if (!ES_FECHA.test(b.entrada || '') || !ES_FECHA.test(b.salida || '')) {
    res.status(400).json({ error: 'Las fechas no son válidas.' });
    return;
  }
  if (Precios.nochesEntre(b.entrada, b.salida) < 1) {
    res.status(400).json({ error: 'La salida tiene que ser posterior a la entrada.' });
    return;
  }

  const modalidad = Precios.modalidadPorId(b.modalidad, CONFIG);
  if (!modalidad) {
    res.status(400).json({ error: 'Esa modalidad no existe.' });
    return;
  }
  if (tipo === 'reserva' && !String(b.nombre || '').trim()) {
    res.status(400).json({ error: 'Falta el nombre del huésped.' });
    return;
  }

  const huespedes = Math.min(Math.max(1, Number(b.huespedes) || 2), modalidad.plazas);
  const noches = Precios.nochesLista(b.entrada, b.salida);

  // Aviso previo, para que el panel pueda preguntar "¿la cargo igual?". El
  // choque de verdad lo detecta la base al insertar, más abajo.
  if (!b.forzar) {
    const ocupadas = Precios.unirOcupadas(
      Precios.construirOcupadas(DISPONIBILIDAD),
      await nochesPagadas()
    );
    if (Precios.hayOcupadasEntre(b.entrada, b.salida, modalidad, ocupadas)) {
      res.status(409).json({
        error: 'Esas fechas ya están ocupadas.',
        ocupado: true
      });
      return;
    }
  }

  // El precio sale de la tarifa, pero se puede pisar: una reserva por
  // teléfono muchas veces tiene precio arreglado aparte (descuento a
  // conocidos, estadía larga, temporada floja).
  const cotizacion = Precios.cotizar(b.entrada, b.salida, modalidad, CONFIG, huespedes);
  const pctSena = CONFIG.reglas.senaPorcentaje || 30;
  const total = tipo === 'bloqueo' ? 0
    : (numeroOpcional(b.total) !== undefined ? numeroOpcional(b.total) : cotizacion.total);
  const sena = tipo === 'bloqueo' ? 0
    : (numeroOpcional(b.sena) !== undefined ? numeroOpcional(b.sena) : Math.round(total * pctSena / 100));

  const id = nuevoId(tipo);
  const guardado = await crearReservaManual(modalidad, noches, {
    id,
    pagoId: null,
    modalidad: modalidad.id,
    entrada: b.entrada,
    salida: b.salida,
    huespedes: tipo === 'bloqueo' ? 0 : huespedes,
    total,
    sena,
    datos: tipo === 'bloqueo'
      ? { motivo: String(b.motivo || b.nombre || 'Bloqueo').trim() }
      : {
          nombre: String(b.nombre || '').trim(),
          telefono: String(b.telefono || '').trim(),
          email: String(b.email || '').trim(),
          localidad: String(b.localidad || '').trim()
        },
    origen: tipo === 'bloqueo' ? 'bloqueo' : 'manual',
    estado: b.estado === 'pendiente' ? 'pendiente' : 'confirmada',
    creado: new Date().toISOString()
  }, Boolean(b.forzar));

  if (!guardado.ok) {
    res.status(409).json({
      error: `Esas fechas ya están ocupadas (${guardado.conflictos.join(', ')}).`,
      ocupado: true,
      conflictos: guardado.conflictos
    });
    return;
  }

  // Con `forzar` puede haber quedado superpuesta: se avisa para que el panel
  // lo muestre, pero la reserva se creó igual porque así lo pidió el admin.
  const pagado = numeroOpcional(b.pagado);
  if (pagado !== undefined || b.nota) {
    await actualizarReserva(id, { pagado, nota: b.nota });
  }

  res.status(200).json({ ok: true, id, total, sena, conflictos: guardado.conflictos });
}

module.exports = async (req, res) => {
  if (!exigirSesion(req, res)) return;

  try {
    if (req.method === 'GET') {
      const incluirCanceladas = Boolean(req.query && req.query.canceladas);
      const reservas = await listarReservas({ incluirCanceladas });
      res.status(200).json({ reservas, hoy: Precios.aIso(new Date()) });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido.' });
      return;
    }

    const { accion, id } = req.body || {};

    if (accion === 'crear') { await crear(req, res); return; }

    if (!id) {
      res.status(400).json({ error: 'Faltan datos.' });
      return;
    }

    if (accion === 'cancelar') {
      const reserva = await obtenerReserva(id);
      if (!reserva) { res.status(404).json({ error: 'No existe esa reserva.' }); return; }
      const modalidad = Precios.modalidadPorId(reserva.modalidad, CONFIG);
      const ok = modalidad ? await cancelarReserva(id, modalidad) : false;
      res.status(200).json({ ok });
      return;
    }

    if (accion === 'confirmar') {
      res.status(200).json({ ok: await confirmarReserva(id) });
      return;
    }

    if (accion === 'actualizar') {
      const b = req.body || {};
      const ok = await actualizarReserva(id, {
        pagado: numeroOpcional(b.pagado),
        nota: b.nota,
        total: numeroOpcional(b.total),
        sena: numeroOpcional(b.sena),
        datos: b.datos
      });
      res.status(200).json({ ok });
      return;
    }

    res.status(400).json({ error: 'Acción desconocida.' });
  } catch (err) {
    console.error('admin/reservas:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
