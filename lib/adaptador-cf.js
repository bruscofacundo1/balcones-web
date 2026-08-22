/* ============================================================================
   Adaptador Vercel -> Cloudflare Workers
   ----------------------------------------------------------------------------
   Todo el código de negocio (api/*.js, lib/*.js) está escrito para el estilo
   Node clásico de Vercel: `module.exports = async (req, res) => {...}`, con
   `req.body` ya parseado, `req.query`, `req.headers` como objeto plano, y
   `res.status().json()`.

   Cloudflare Workers usa la Fetch API: un `fetch(request, env)` que devuelve
   un `Response`. En vez de reescribir cada endpoint (arriesgando romper la
   lógica de precios, el lock atómico de reservas o el escapado contra XSS,
   todo cosa ya probada), este archivo traduce de un mundo al otro. `worker.js`
   lo usa para envolver cada handler de `api/` antes de despacharlo según la URL.

   De paso, deja disponible el `env` de Cloudflare (bindings de R2, variables)
   en `globalThis.__CF_ENV__`, porque un binding (el bucket de fotos) no es un
   string y no puede viajar por `process.env`. Las variables de texto además
   se copian a `process.env` como red de más: con `nodejs_compat` y fecha de
   compatibilidad reciente Cloudflare ya las expone solo ahí, pero copiarlas
   a mano no tiene costo y cubre el caso de una fecha de compatibilidad vieja.
   ============================================================================ */

function requestAReq(request, env) {
  const url = new URL(request.url);
  const headers = {};
  for (const [clave, valor] of request.headers.entries()) headers[clave] = valor;

  return {
    method: request.method,
    headers,
    query: Object.fromEntries(url.searchParams),
    socket: { remoteAddress: headers['cf-connecting-ip'] || '' },
    _raw: request
  };
}

async function conCuerpo(req, request) {
  if (req.method === 'GET' || req.method === 'HEAD') return req;
  const tipo = req.headers['content-type'] || '';
  if (tipo.includes('application/json')) {
    try {
      const texto = await request.text();
      req.body = texto ? JSON.parse(texto) : {};
    } catch {
      req.body = {};
    }
  }
  return req;
}

function crearRes() {
  const estado = { codigo: 200, headers: new Headers(), cuerpo: '', esJson: false };
  const res = {
    status(codigo) { estado.codigo = codigo; return res; },
    setHeader(nombre, valor) { estado.headers.append(nombre, valor); return res; },
    json(obj) { estado.esJson = true; estado.cuerpo = JSON.stringify(obj); return res; },
    send(texto) { estado.esJson = false; estado.cuerpo = texto === undefined ? '' : String(texto); return res; }
  };
  return { res, estado };
}

/** Copia las variables de texto del binding a process.env, sin pisar lo que
    ya esté puesto (por si acaso corre más de una vez en la misma isolate). */
function exponerEnv(env) {
  globalThis.__CF_ENV__ = env;
  for (const clave of Object.keys(env || {})) {
    const valor = env[clave];
    if (typeof valor === 'string') {
      try { process.env[clave] = valor; } catch { /* nodejs_compat lo maneja solo */ }
    }
  }
}

/**
 * Envuelve un handler `(req, res) => {}` de Vercel para que sirva de
 * `onRequest` de Cloudflare Pages Functions.
 */
function wrap(handler) {
  return async ({ request, env }) => {
    exponerEnv(env);
    const req = await conCuerpo(requestAReq(request, env), request);
    const { res, estado } = crearRes();

    await handler(req, res);

    if (estado.esJson && !estado.headers.has('Content-Type')) {
      estado.headers.set('Content-Type', 'application/json; charset=utf-8');
    }
    return new Response(estado.cuerpo, { status: estado.codigo, headers: estado.headers });
  };
}

module.exports = { wrap };
