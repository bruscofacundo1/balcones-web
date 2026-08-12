# Balcones del Arroyo — sitio web

> Esta guía reemplaza a `LEEME.md` (esa versión quedó vieja: podés borrarla).

Sitio estático (HTML, CSS y JavaScript) para el alquiler de la casa.
No necesita base de datos ni servidor: se sube tal cual a cualquier hosting.

## Archivos

```
index.html                 La página del sitio
admin.html                 Panel privado para marcar fechas ocupadas
css/estilos.css            Todos los estilos
js/config.js               ← LO QUE TENÉS QUE EDITAR (teléfono, precios, textos, FAQ)
js/disponibilidad.js       Fechas reservadas (lo genera admin.html)
js/calendario.js           Calendario y cálculo de precios
js/app.js                  Armado de las secciones
img/                       Fotos grandes (para el visor)
img/thumb/                 Miniaturas (para la grilla)
```

## Antes de publicar: qué hay que completar

Abrí `js/config.js` y buscá los comentarios `<< REVISAR >>`. Son los datos que
puse de ejemplo y hay que reemplazar:

1. **`whatsapp`** — el número real, en formato internacional sin `+` ni espacios.
   Para un celular de Córdoba (3544): `5493544123456`.
2. **`telefonoVisible`**, **`email`**, **`instagram`**, **`facebook`**.
3. **`mapa.lat` y `mapa.lng`** — la ubicación exacta. Para sacarlas: abrí Google Maps,
   hacé clic derecho sobre el lugar y copiá los dos números que aparecen arriba de todo.
4. **`casa`** — dormitorios y baños (la capacidad sale de `modalidades`).
5. **`temporadas`** — el precio por noche de **cada modalidad** (casa completa,
   planta alta, planta baja), el mínimo de noches y los rangos de fecha.
6. **`distancias`** — los kilómetros reales a cada lugar.
7. **`FAQ`** — las respuestas que dicen `<< REVISAR >>` están redactadas como
   borrador y hay que confirmarlas o corregirlas.

Todo lo demás (textos, comodidades, actividades) también se edita ahí.

## Cómo se maneja el alquiler por planta

La casa se puede alquilar entera (9 plazas) o por planta: alta (5) y baja (4).
La disponibilidad se lleva **por planta**. Si alguien alquila solo la planta
alta, esas fechas quedan libres para quien quiera la planta baja, pero la casa
completa aparece ocupada. Eso lo resuelve el sitio solo: vos únicamente tenés
que marcar qué se alquiló.

## Cargar las fechas ocupadas

1. Abrí `admin.html` en el navegador (podés hacerle doble clic).
2. Elegí arriba **qué se alquiló**: casa completa, planta alta o planta baja.
3. Hacé clic en el primer día del bloque reservado y después en el último.
   Para un solo día, hacé clic dos veces sobre el mismo.
4. Para liberar fechas, cambiá a modo **Liberar** y repetí, o usá "Quitar" en la lista.
5. Apretá **Descargar disponibilidad.js**.
6. Reemplazá `js/disponibilidad.js` por el archivo descargado y volvé a subir el sitio.

En el calendario del panel, un día **rayado** significa que la unidad elegida
está ocupada, y un día **beige** que está ocupada la otra planta.

Lo que marques queda guardado en el navegador hasta que descargues el archivo,
así que podés cerrar y seguir después. Ojo: `admin.html` no tiene contraseña.
Si preferís que nadie lo encuentre, no lo subas al hosting y usalo solo desde tu
computadora, o renombralo a algo difícil de adivinar.

## Cómo probarlo en tu computadora

Doble clic en `index.html` alcanza para ver casi todo. Si algo no carga bien,
levantá un servidor local desde esta carpeta:

```bash
python -m http.server 8000
```

y entrá a `http://localhost:8000`.

## Cómo publicarlo

La opción más simple y gratuita es **Netlify Drop**: entrás a
`https://app.netlify.com/drop` y arrastrás esta carpeta entera. En un minuto
tenés el sitio online con una dirección tipo `balcones-del-arroyo.netlify.app`.
Después se le puede conectar un dominio propio (`balconesdelarroyo.com.ar`).

Otras opciones: GitHub Pages, Cloudflare Pages, o cualquier hosting con FTP
(subís el contenido de esta carpeta a `public_html`).

## Las fotos

Las 56 fotos del sitio se generaron a partir de las originales de la carpeta de
arriba, redimensionadas para que el sitio cargue rápido (1600 px las grandes,
760 px las miniaturas). Si querés agregar o cambiar alguna:

1. Guardá la foto grande en `img/` y una versión chica en `img/thumb/`,
   **con el mismo nombre** en las dos carpetas (por ejemplo `pileta.jpg`).
2. Agregala a la lista `FOTOS` en `js/config.js`:
   `{ f: 'pileta', c: 'aire-libre', t: 'Texto que aparece abajo' }`

Categorías disponibles: `casa`, `interiores`, `aire-libre`, `entorno`.
