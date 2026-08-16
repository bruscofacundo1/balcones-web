/* ============================================================================
   POST/GET/DELETE /api/admin/sesion
   ----------------------------------------------------------------------------
   Entrar, preguntar si sigo adentro, y salir.

     GET     -> { activa: true|false }   (lo usa admin.html al abrir)
     POST    -> { clave } y devuelve la cookie de sesión
     DELETE  -> borra la cookie

   El POST tiene freno de fuerza bruta: con una sola contraseña compartida y
   sin límite de intentos, cualquiera con un script la saca por prueba y
   error. Se cuentan los fallos por IP en la base (ver lib/reservas.js), no
   en memoria, porque cada invocación serverless puede caer en una instancia
   distinta y una cuenta en memoria no serviría de nada.
   ============================================================================ */

const {
  hayClaveConfigurada, claveCorrecta, crearToken, sesionActiva,
  cookieDeSesion, cookieBorrada, ipDe
} = require('../../lib/sesion.js');
const {
  hayBaseDatos, intentosRecientes, anotarIntentoFallado, limpiarIntentos
} = require('../../lib/reservas.js');

const MAX_INTENTOS = 8;

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json({
      activa: sesionActiva(req),
      configurada: hayClaveConfigurada(),
      base: hayBaseDatos()
    });
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieBorrada(req));
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  // Sin contraseña cargada en el servidor el panel no abre. Falla cerrado a
  // propósito: es preferible que Naty no pueda entrar a que pueda cualquiera.
  if (!hayClaveConfigurada()) {
    res.status(503).json({
      error: 'Falta configurar la contraseña del panel (ADMIN_PASSWORD) en el servidor.'
    });
    return;
  }

  const ip = ipDe(req);

  try {
    if (await intentosRecientes(ip) >= MAX_INTENTOS) {
      res.status(429).json({
        error: 'Demasiados intentos fallados. Esperá 15 minutos y probá de nuevo.'
      });
      return;
    }

    const clave = (req.body || {}).clave;
    if (!claveCorrecta(clave)) {
      await anotarIntentoFallado(ip);
      // El mensaje no dice si el problema fue la clave o algo más: cuanta
      // menos información se le dé a quien está probando, mejor.
      res.status(401).json({ error: 'Contraseña incorrecta.' });
      return;
    }

    await limpiarIntentos(ip);
    res.setHeader('Set-Cookie', cookieDeSesion(req, crearToken()));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin/sesion:', err);
    res.status(500).json({ error: 'Hubo un problema técnico. Probá de nuevo.' });
  }
};
