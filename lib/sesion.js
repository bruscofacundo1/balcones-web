/* ============================================================================
   Balcones del Arroyo — sesión del panel de administración
   ----------------------------------------------------------------------------
   Antes el panel mandaba la clave en cada pedido, a veces por la URL
   (`?clave=...`). Eso deja la contraseña escrita en el historial del
   navegador, en los logs del servidor y en el encabezado Referer de
   cualquier link que se abra desde ahí. Ahora la clave viaja UNA vez, al
   entrar, y lo que queda es una cookie de sesión firmada.

   La cookie es `httpOnly`: el JavaScript de la página no la puede leer, así
   que aunque a alguien se le colara un script en el sitio no se puede robar
   la sesión. Y va firmada con HMAC, así que nadie puede fabricarse una.

   La llave de la firma se deriva de la propia contraseña. Efecto secundario
   buscado: si cambiás ADMIN_PASSWORD, todas las sesiones abiertas se caen
   solas, sin tener que acordarse de rotar un segundo secreto.

   Ojo con lo importante: esconder admin.html no protege nada. Lo que protege
   es que CADA endpoint de /api/admin/ llame a `sesionActiva()` antes de
   contestar. El HTML puede ser público; los datos no.
   ============================================================================ */

const crypto = require('crypto');

const NOMBRE_COOKIE = 'bda_sesion';
const HORAS_SESION = 12;

/** La contraseña del panel, tal como está cargada en Cloudflare. */
function claveEsperada() {
  return process.env.ADMIN_PASSWORD || '';
}

function hayClaveConfigurada() {
  return claveEsperada().length > 0;
}

/** Comparación que tarda lo mismo acierte o no, para no filtrar la clave
    letra por letra midiendo cuánto demora en responder. */
function igualSeguro(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function claveCorrecta(intento) {
  if (!hayClaveConfigurada()) return false;
  return igualSeguro(intento || '', claveEsperada());
}

function firmar(texto) {
  return crypto.createHmac('sha256', `sesion:${claveEsperada()}`)
    .update(String(texto)).digest('hex');
}

/** Token = hasta cuándo vale + su firma. No guarda nada más: no hace falta. */
function crearToken() {
  const expira = Date.now() + HORAS_SESION * 3600 * 1000;
  return `${expira}.${firmar(expira)}`;
}

function tokenValido(token) {
  if (!token || !hayClaveConfigurada()) return false;
  const punto = String(token).indexOf('.');
  if (punto < 1) return false;

  const expira = token.slice(0, punto);
  const firma = token.slice(punto + 1);
  if (!/^\d+$/.test(expira) || Number(expira) < Date.now()) return false;

  const esperada = firmar(expira);
  if (firma.length !== esperada.length) return false;
  return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada));
}

function leerCookie(req, nombre) {
  const crudo = req.headers.cookie || '';
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nombre) {
      return decodeURIComponent(parte.slice(i + 1).trim());
    }
  }
  return null;
}

/** ¿Este pedido viene de alguien que ya se logueó? */
function sesionActiva(req) {
  return tokenValido(leerCookie(req, NOMBRE_COOKIE));
}

/** En local el sitio corre por http, y una cookie `Secure` ahí no se guarda. */
function esLocal(req) {
  const host = String(req.headers.host || '');
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function cookieDeSesion(req, token) {
  const partes = [
    `${NOMBRE_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${HORAS_SESION * 3600}`
  ];
  if (!esLocal(req)) partes.push('Secure');
  return partes.join('; ');
}

function cookieBorrada(req) {
  const partes = [`${NOMBRE_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (!esLocal(req)) partes.push('Secure');
  return partes.join('; ');
}

/** Con qué IP contamos los intentos fallados. Detrás de Cloudflare la IP real
    viene en cf-connecting-ip, un header que pone el borde y que el visitante
    no puede falsificar. x-forwarded-for queda de respaldo por si algún día
    esto corre detrás de otra cosa. */
function ipDe(req) {
  const deCloudflare = req.headers['cf-connecting-ip'];
  if (deCloudflare) return String(deCloudflare).trim();
  const reenviada = req.headers['x-forwarded-for'];
  if (reenviada) return String(reenviada).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'desconocida';
}

/** Guardia para usar al principio de cada endpoint de /api/admin/. */
function exigirSesion(req, res) {
  if (sesionActiva(req)) return true;
  res.status(401).json({ error: 'Sesión vencida o no iniciada.' });
  return false;
}

module.exports = {
  NOMBRE_COOKIE, HORAS_SESION,
  hayClaveConfigurada, claveCorrecta,
  crearToken, tokenValido, sesionActiva, exigirSesion,
  cookieDeSesion, cookieBorrada, ipDe
};
