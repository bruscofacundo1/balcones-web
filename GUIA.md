# Balcones del Arroyo — sitio web

> Esta guía reemplaza a `LEEME.md` (esa versión quedó vieja: podés borrarla).

Sitio estático (HTML, CSS y JavaScript) para el alquiler de la casa.
No necesita base de datos ni servidor: se sube tal cual a cualquier hosting.

## Archivos

```
index.html                 La página del sitio
admin.html                 Panel de administración (se entra por /admin, con contraseña)
css/estilos.css            Todos los estilos
js/config.js               ← LO QUE TENÉS QUE EDITAR (teléfono, precios, textos, FAQ)
js/disponibilidad.js       Ya no se toca: las fechas viven en la base de datos
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

## El panel de administración

Entrá a **tusitio.com/admin** y poné la contraseña. Anda igual desde la
computadora que desde el celular. Todo lo que hagas ahí se ve en el sitio **al
instante**: no hay que descargar ni volver a subir nada.

### Ver cómo viene el mes

La pantalla que aparece primero es el calendario del año. Los colores:

- **Verde**: libre.
- **Naranja claro**: hay una sola planta ocupada (la otra se puede alquilar).
- **Rojo claro**: ocupado todo.
- **Gris**: bloqueado por vos (mantenimiento, uso de la familia).
- **Rayita naranja abajo**: esa noche hay una reserva **sin la seña confirmada**.

Tocá cualquier día para ver quién está esa noche, o para cargar algo ahí mismo.

### Cargar una reserva que llegó por teléfono o WhatsApp

1. Apretá **+ Nueva reserva**.
2. Poné entrada, salida y qué alquila (casa completa o una planta).
3. Escribí el nombre y el teléfono.
4. El **total lo calcula solo** según la tarifa. Si arreglaste otro precio,
   pisalo y listo: desde ese momento el formulario no te lo vuelve a cambiar.
5. Elegí si la seña ya está o queda pendiente.
6. **Cargar reserva**.

Si las fechas ya estaban ocupadas te avisa y no te deja seguir de una: te
pregunta si querés cargarla igual, superpuesta.

### Bloquear fechas sin que haya huésped

Para cuando va la familia o hay que hacer arreglos: **Bloquear fechas**, elegís
el rango y ponés el motivo. En el sitio esas fechas aparecen ocupadas.

### Cuando alguien reserva desde la web

Llega sola al panel, marcada como **pendiente**: la fecha ya queda bloqueada,
pero falta que te llegue la seña. Cuando te llega, entrá a la reserva y apretá
**Marcar seña cobrada**.

Si una reserva lleva **más de una semana pendiente**, el panel te lo avisa
arriba de todo con un cartel. Convienen mirarlo: esas reservas están tapando
fechas que quizá se podrían vender.

### Dar de baja

Entrá a la reserva y apretá **Dar de baja y liberar fechas**. Las fechas quedan
libres en el sitio enseguida. Nada se borra del todo: podés verlas después con
el filtro **Canceladas**.

### La contraseña

La configura quien administra el sitio (variable `ADMIN_PASSWORD` en Vercel).
Si la escribís mal muchas veces seguidas, el panel se traba 15 minutos — es a
propósito, para que nadie la saque probando.

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
