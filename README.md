# balcones-web

Sitio de **Balcones del Arroyo**, casa de campo en Arroyo de los Patos (Nono,
Valle de Traslasierra, Córdoba).

HTML, CSS y JavaScript sin frameworks ni compilación.

## Cómo verlo

```bash
python -m http.server 5173
```

Y entrar a `http://localhost:5173`.

> Abrir `index.html` con doble clic también funciona, pero el navegador bloquea
> el paso a `reserva.html`. Para probar el flujo de reserva completo, usá el
> servidor.

## Dónde se tocan las cosas

| Quiero cambiar… | Archivo |
|---|---|
| Precios, temporadas, textos, contacto, preguntas frecuentes | `js/config.js` |
| Qué fechas están ocupadas | `js/disponibilidad.js` (o generarlo con `admin.html`) |
| Fotos | `img/` |
| Estilos | `css/estilos.css` |

Todo lo marcado con `<< REVISAR >>` en `js/config.js` tiene datos de ejemplo y
hay que reemplazarlo por los reales.

## Publicar en Vercel

El repo ya viene listo. En [vercel.com](https://vercel.com):

1. **Add New… → Project** e importá `bruscofacundo1/balcones-web`.
2. Vercel lo detecta como sitio estático solo. **No toques nada**: dejá el
   framework en *Other* y los campos de build vacíos.
3. **Deploy**.

No hace falta configurar nada más: no hay build, ni variables de entorno, ni
dependencias. Cada `git push` a `main` publica automáticamente.

El `vercel.json` ya deja resuelto el caché (las fotos se guardan un año, el
HTML y el código se revalidan siempre) y las URLs sin `.html`.

### Dominio propio

En **Settings → Domains** del proyecto, agregá el dominio y seguí las
instrucciones de DNS que te da Vercel. Después conviene actualizar la línea
`<link rel="canonical">` de `index.html` con la dirección definitiva.

## Documentación

**[CONTEXTO.md](CONTEXTO.md)** explica qué se hizo, por qué, cómo funciona el
flujo de reserva, el sistema de variantes y qué falta. Leerlo antes de meter
mano.
