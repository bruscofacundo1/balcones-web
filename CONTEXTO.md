# Balcones del Arroyo — contexto del proyecto

Sitio de la casa de campo en Arroyo de los Patos (Nono, Traslasierra, Córdoba).
HTML, CSS y JavaScript sin frameworks ni compilación: se abre `index.html` y anda.

Este documento cuenta **qué se hizo, por qué, y qué falta**. Si retomás el
proyecto (vos, otra persona o Claude en otra sesión), leé esto primero.

---

## 1. Cómo se levanta

No hay build. Para verlo en el navegador alcanza con abrir `index.html`, pero
para que funcione el paso de una página a otra conviene levantar un servidor:

```bash
python -m http.server 5173 --directory "Nueva WEB Balcones del arroyo"
```

y entrar a `http://localhost:5173`.

> Con `file://` el navegador bloquea la navegación entre páginas y el flujo de
> reserva se corta al pasar a `reserva.html`.

**Caché:** los `<script>` y el CSS se cargan con `?v=32`. Cuando publiques un
cambio, **subí ese número** en todos los HTML (index, reserva, checkout,
preguntas, legales, arrepentimiento) o los visitantes van a seguir viendo la
versión vieja.

**Funciones serverless (`api/`):** necesitan sus dependencias instaladas una
vez:

```bash
npm install
```

Eso sólo afecta a `api/` y `lib/` — el sitio en sí sigue sin build. Para
probar el pago de verdad en tu compu hace falta además `vercel dev` (que lee
las variables de un `.env.local`, ver §6) en vez del `python -m http.server`
de arriba, porque ese servidor no sabe correr las funciones de `api/`.

## 1.b Publicación (Vercel)

El repo está listo para importar en Vercel sin configurar nada: no hay build ni
dependencias. Los pasos están en el `README.md`.

`vercel.json` define dos cosas:

- **Caché**: las fotos de `img/` se guardan un año (nunca cambian de nombre);
  el HTML, el CSS y el JS se revalidan en cada visita, así un cambio se ve al
  toque aunque te olvides de subir el `?v=`.
- **`cleanUrls`**: las páginas quedan en `/reserva` en vez de `/reserva.html`.
  Los links del código siguen apuntando a `reserva.html` a propósito, para que
  también funcionen abriendo los archivos localmente; Vercel redirige solo.

Las funciones serverless del pago (§6) viven en `api/` y Vercel las toma
automáticamente por estar ahí — no hace falta tocar `vercel.json` para eso.
Lo que sí hay que hacer a mano en el panel de Vercel: cargar las variables de
entorno y conectar la base de Neon (los dos pasos están detallados en §6).

---

## 2. Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | La home entera |
| `reserva.html` | Paso 2: qué se alquila, con el precio de cada opción |
| `checkout.html` | Paso 3: detalle, datos y (más adelante) el pago |
| `preguntas.html` | Las 13 preguntas frecuentes completas (en el inicio sólo se ven algunas, según la variante) |
| `legales.html` | Términos y condiciones, privacidad y cancelación |
| `arrepentimiento.html` | Botón de arrepentimiento (Res. 424/2020) |
| `admin.html` | Panel para cargar la disponibilidad. Genera el texto de `disponibilidad.js` |
| `css/estilos.css` | Todos los estilos |
| `js/config.js` | **Los datos del negocio**: precios, temporadas, textos, contacto, FAQ, Public Key de Mercado Pago |
| `js/disponibilidad.js` | Qué noches están ocupadas, por planta (la base cargada a mano) |
| `js/precios.js` | Fechas, disponibilidad y cotización — funciones puras, sin DOM. Las usa tanto el navegador como el servidor (ver §6) |
| `js/variantes.js` | Sistema de variantes (provisorio, ver §5) |
| `js/calendario.js` | Calendario, drawer y modal de reserva (usa `precios.js` para las cuentas) |
| `js/app.js` | Arma el resto de la página: galería, carrusel, ambientes, FAQ… |
| `js/reserva-pagina.js` | Lógica de `reserva.html` |
| `js/checkout.js` | Lógica de `checkout.html`: datos, Payment Brick y pago |
| `js/preguntas-pagina.js` | Lógica de `preguntas.html` |
| `js/pie.js` | El pie del sitio, igual para todas las páginas |
| `js/legales.js` | Rellena los datos variables de `legales.html` y `arrepentimiento.html` |
| `js/arrepentimiento.js` | Formulario y código de trámite del botón de arrepentimiento |
| `lib/mercadopago.js` | Cliente de Mercado Pago del lado del servidor |
| `lib/reservas.js` | Disponibilidad "en vivo" en Postgres (Neon): lo que ya se pagó online |
| `api/crear-pago.js` | Cobra la seña (recalcula todo del lado del servidor) |
| `api/webhook-mercadopago.js` | Recibe los avisos de Mercado Pago cuando cambia el estado de un pago |
| `api/reservar.js` | Bloquea la fecha sin cobrar (variante WhatsApp de "Cómo se paga") |
| `api/admin/reservas.js` | Lista, confirma y cancela reservas — lo usa el panel nuevo de `admin.html` |
| `package.json` | Dependencias de `api/` y `lib/` (no hay build del sitio) |

**Todo lo que se toca seguido está en `js/config.js`.** Precios, temporadas,
comodidades, preguntas frecuentes, teléfono, mail. Los lugares marcados con
`<< REVISAR >>` tienen datos de ejemplo y hay que reemplazarlos por los reales.

---

## 3. Qué se cambió y por qué

El punto de partida era un sitio correcto pero que "olía a plantilla". Se
trabajó sobre eso.

### Lo que se sacó

- **Kicker en mayúsculas en cada sección** (`LA CASA`, `GALERÍA`, `DÓNDE
  ESTAMOS`…). Estaban en las 8 secciones; quedaron en 6 y se sacaron de las más
  obvias. Es el recurso más repetido en sitios hechos con IA.
- **La franja oscura de estadísticas** (9 huéspedes · 4 dormitorios · 2 baños…).
  Es un "trust bar" de producto SaaS, no algo que pondría el dueño de una casa
  de campo. Esos datos ahora van como una línea de texto dentro de "La casa".
- **El badge flotante de ubicación** sobre el hero. El dato ya estaba dos veces
  más (bajo el logo y en la bajada), así que era redundancia pura.
- **El "DESLIZÁ"** del pie del hero. Nadie necesita que le expliquen que se
  scrollea.
- **Los botones-píldora** (`border-radius: 100px`). Ahora son rectangulares con
  la esquina apenas suavizada, como en los sitios de hotelería reales.

### Lo que se agregó o rehízo

- **Logo** en la barra de navegación. Se le sacó el fondo blanco al PNG
  original y se generaron cuatro versiones (clara/oscura, completa/sólo el
  ícono). En el hero va la blanca; cuando la barra se vuelve sólida al
  scrollear, cambia a la oscura.
- **"La casa"** pasó a un layout asimétrico: el texto respeta el ancho de la
  página y la foto **sangra hasta el borde derecho de la pantalla**, con una
  segunda foto chica superpuesta y desfasada. Rompe la sensación de grilla
  perfecta.
- **Una franja de foto a todo lo ancho** entre secciones, con una frase corta
  ("Cae la tarde y las sierras se ponen rosas"). Usaba una foto **del
  entorno**, no de la casa, para no competir con el hero. → *Se sacó el
  14/08/2026: esa misma foto pasó a ser el fondo de "Preguntas frecuentes"
  (`.seccion--foto`), así el respiro visual y la sección son la misma cosa y
  la home tiene una parada menos. El CSS de `.franja-foto` se borró; si se
  quiere recuperar, está en el historial de git.*
- **Radios más chicos** (14px → 6px) en todas las tarjetas.
- **Galería despareja**: cada tanto una foto ocupa el doble de ancho o de alto,
  en vez de la grilla pareja donde todas miden igual.
- **"Qué hacer en la zona" recortada a 4 tarjetas** (`#actividades`), con un
  botón "Ver todo lo que hay para hacer" que abre las 8 completas en una capa
  encima (`#todas-actividades`) — no navega a otra página. Mismo criterio que
  ya usa la galería ("Ver las 56 fotos"): la sección larga se corta en el
  inicio y el resto queda a un clic, no borrado. Pedido explícito (14/08/2026)
  pensando sobre todo en celular, donde 8 tarjetas de aspect-ratio 3/4 eran de
  las secciones más largas de la home. La capa nueva reusa el cabezal fijo de
  `.todas-fotos` pero con su propio cuerpo (`.todas-actividades__cuerpo`): el
  grid va **adentro** del contenedor que scrollea, no siendo él mismo el que
  scrollea — si el grid fuera directamente el hijo `flex: 1 1 auto`, vuelve el
  mismo bug que ya pasó una vez en la galería (el navegador le compacta el
  alto a las filas). Quedó comentado en el CSS para que no se repita.

### De dónde salieron las ideas

De cuatro sitios de alojamiento reales que funcionan bien: `masaguilo.com`,
`hotelnafarrola.com`, `villadeplan.com` y `plazabalmisapartments.com`. Lo que
tienen en común **no es el diseño, es el contenido**:

1. Todos tienen un bloque **"Reserva directa"** con razones para reservar en la
   web y no por Booking/Airbnb. Nosotros todavía no.
2. **Especificidad obsesiva**: Villa de Plan lista hasta "estropajo y bayeta".
   Nuestro "cocina equipada" es genérico.
3. **Gente con nombre**: Nafarrola nombra a los dueños y qué hace cada uno.
   Probablemente sea lo que más se nota que nos falta.
4. **Negocios locales con nombre propio**, no "hay supermercados y verdulerías".
5. **Opiniones reales con fuente y fecha.**

### Animaciones (14/08/2026)

Pedido explícito: "algún chiche" de movimiento, sin librerías. El sitio ya
tenía `.revelar` (fade + `translateY`, con `IntersectionObserver` en
`iniciarRevelado()`, `js/app.js`); se extendió con lo mismo, sin sumar nada:

- **`.revelar--foto`**: además del fade, un leve *scale* (de .96 a 1). Se
  usa sólo en fotos (unidades, bandas, actividades, mosaico, "La casa") —
  los bloques de texto se quedan con el `translateY` solo, para no mezclar
  dos lenguajes de animación en la misma pantalla.
- **`.cascada`**: en un contenedor con hijos `.revelar`, cada uno entra
  70ms después que el anterior (`:nth-child`, hasta 8 — de ahí no sigue
  creciendo). En `unidades-tira`, `bandas-unidades`, `actividades`,
  `mosaico`, `tarifas-grid`.
- **El hero anima al cargar**, no al scrollear (es lo primero que se ve):
  la foto con un `scale(1.04)→1` suave, el título/bajada/botones con
  `translateY` y un pequeño delay entre uno y otro (`@keyframes hero-entra`
  / `hero-texto-entra`).

**Un cuidado real, no cosmético, que costó encontrar:** varias tarjetas se
pintan dentro de algo que arranca oculto (`tarifas-grid-b` en un `<details>`
cerrado; la capa de "ver más" de actividades, `display:none` hasta que se
abre). Un elemento sin caja mientras está oculto nunca cruza el umbral del
`IntersectionObserver` — si arrancara en `opacity:0` como el resto de
`.revelar`, quedaría invisible **para siempre**, incluso después de abrirse.
Por eso `pintarTarifas()` y `tarjetasActividades()` reciben un parámetro
(`conRevelado`) que sólo agrega la clase en la tarjeta que se ve de entrada;
la copia que vive escondida se pinta sin animación, directamente visible.

Mismo problema, versión "tarde": `pintarMosaico()` se puede repintar después
de la carga inicial si alguien cambia la variante de "La casa y el lugar" en
la misma visita (`aplicarVarianteGaleria` → `Variantes.alCambiar`). El
`IntersectionObserver` de `iniciarRevelado()` escanea el DOM **una sola vez**
al cargar; un `.revelar` que aparece después no lo observa nadie. Se resuelve
con la bandera `animacionesListas` (`js/app.js`): en true recién al terminar
`iniciarRevelado()`, y `pintarMosaico()` sólo pone la clase si todavía es
`false` (el pintado inicial). Un repintado tardío aparece directo, sin
animar — mejor eso que una tarjeta invisible.

**Si se agrega `.revelar`/`.revelar--foto` a algo nuevo que se pinta por JS,
hay que hacerse esta pregunta primero: ¿puede existir ese elemento oculto
(`hidden`, `display:none`, `<details>` cerrado) en el momento en que se
pinta, ya sea al cargar la página o después? Si la respuesta es sí, no le
pongas la clase ahí — pintalo visible directo, como se hizo acá.**

### Opiniones (14/08/2026)

Sección nueva, `#opiniones`, entre "Qué hacer en la zona" y "Preguntas
frecuentes". Reseñas **reales**, copiadas de Google Maps y de Booking — no un
formulario propio en el sitio para que la gente opine acá. Dos razones: una
reseña con el sello de un tercero (Google, Booking) pesa más que un
testimonio suelto en la propia web, que cualquiera podría haber escrito; y no
hace falta construir ni moderar un sistema de reseñas nuevo — el botón
"Dejanos tu opinión" manda directo a escribirla donde ya se escriben.

Los textos viven en `js/config.js`, array `RESENAS` (`{ texto, autor, fuente,
fecha: 'AAAA-MM', estrellas }`). Hoy tiene 3 de ejemplo bien marcadas
`<< REVISAR >>` — **no inventar reseñas nuevas**, reemplazar por las reales
tal cual las escribió cada huésped. Si `RESENAS` queda vacío, la sección
entera se oculta sola (`pintarResenas()` en `js/app.js`) en vez de mostrar un
carrusel vacío.

Los dos botones ("Dejanos tu opinión en Google" / "...en Booking") salen de
`CONFIG.contacto.googleResenas` / `bookingResenas` — vacíos por defecto, cada
uno se muestra sólo si tiene link cargado. El de Google es el link de
"Escribir una reseña" de la ficha en Google Maps.

**Es una tira que desliza sola, no una grilla fija** — pedido explícito,
pensando en que el día que haya muchas reseñas una grilla se vería rota,
mientras que la tira se ve igual de bien con 3 que con 30. Cómo funciona el
loop infinito sin librería: `pintarResenas()` duplica la lista una vez
(`tarjetas + tarjetas`) y la animación mueve la tira exactamente `-50%`
(`@keyframes opiniones-desliza`, `css/estilos.css`) — cuando la primera copia
termina de salir por la izquierda, la segunda copia está exactamente donde
empezó la primera, así que el corte no se nota. La duración depende de la
cantidad de reseñas (`--cant`, variable CSS que pone `pintarResenas()`) para
que la velocidad de desplazamiento no cambie según cuántas haya, sólo el
recorrido se hace más largo. Se pausa con `:hover`/`:focus-within` para poder
leer.

**`prefers-reduced-motion`:** acá no alcanza con la regla global que apaga
las animaciones (`* { animation: none !important }`) — si sólo se apagara la
animación, quedarían visibles nada más las tarjetas que entran en el ancho de
pantalla, sin scroll y sin loop, inalcanzables el resto. `pintarResenas()`
chequea `matchMedia('(prefers-reduced-motion: reduce)')`: si está activado,
no duplica la lista y el carrusel pasa a `overflow-x: auto` (scroll
horizontal nativo, con el dedo o la rueda) en vez de animar solo.

---

## 4. El flujo de reserva

### Cómo funcionan los precios

`js/config.js` define **temporadas** (alta, media, baja) por rangos de fecha
`MM-DD` que se repiten todos los años, y el precio por noche de cada
**modalidad** en cada temporada.

Las modalidades están **anidadas**: `completa` = `alta` + `baja`. Por eso la
casa completa sólo está libre si lo están las dos plantas. Esto es lo que hace
que el orden de los pasos importe (ver §5).

El total se calcula noche por noche: si la estadía cruza de una temporada a
otra, cada tramo se cobra a su precio y el desglose lo muestra por separado.

### Días y noches

Lo que se ocupa son **noches**, no días. El día en que alguien se va queda
libre desde el mediodía, así que sirve de fecha de entrada para el siguiente; y
el día en que alguien entra sirve de fecha de salida. Por eso en el calendario
hay días **partidos en diagonal**.

> Esto arregló un problema real: antes no se podían vender las noches pegadas a
> otra reserva. Con dos reservas seguidas se perdía una noche en cada borde.

### Colores del calendario

- **Fondo** = disponibilidad. Verde libre, rojo ocupado, partido al medio si es
  día de recambio.
- **Barrita de abajo** = temporada (terracota alta, ocre media, oliva baja).

Son dos informaciones distintas y por eso van en lugares distintos. La leyenda
de abajo muestra el precio por noche de cada temporada y **se actualiza sola**
al cambiar de modalidad.

### Las tres pantallas

1. **Modal** (en la home): sólo el calendario. Nada de precios ni opciones.
2. **`reserva.html`**: la barra con las fechas buscadas arriba, y las tres
   modalidades con su precio para ese tramo, marcando las que no están libres.
   Al elegir una aparece abajo una barra con el total y el botón *Reservar*.
3. **`checkout.html`**: el detalle de lo elegido, los datos y el pago.

Cada pantalla **revalida** lo que le llega en vez de confiar en el paso
anterior: `checkout.html` vuelve a chequear que el tramo siga libre para esa
unidad y recalcula el precio con `config.js`. Si alguien edita el
`sessionStorage` a mano o vuelve con el botón "atrás" después de que esas
fechas se ocuparon, la página lo rechaza.

### Dónde termina

Hoy el flujo termina **armando un mensaje de WhatsApp** con todo el detalle. No
se cobra nada online todavía (ver §6).

---

### El botón "Reservar" del menú

Va en **ocre** (`--ocre`) y no en terracota: la terracota ya la usan todos los
botones principales del sitio, así que en ocre éste no se confunde con los
demás y se ve como *el* botón. El texto va en carbón y no en blanco porque
sobre el ocre el blanco casi no se lee (con carbón el contraste da 6.16, de
sobra).

Late **una sola vez**, la primera vez que se pasa el inicio y el menú se
vuelve sólido: justo cuando desaparece de la vista el botón grande del hero y
éste pasa a ser la única puerta a reservar. La marca la pone `nav--llamar`
desde `iniciarNav()` en `js/app.js`, con una bandera para que no se repita al
seguir scrolleando.

No parpadea todo el tiempo a propósito, y conviene que siga así: un botón
titilando sin parar es de las cosas que hacen que un sitio se vea barato —
justo lo que veníamos sacando de encima— y encima deja de llamar la atención a
los diez segundos, porque el ojo lo aprende y lo ignora. La regla global de
`prefers-reduced-motion` ya apaga la animación para quien tenga configurado
que no quiere movimiento.

Del menú se sacó **"Disponibilidad"**: tenía el mismo `data-reservar` que
"Reservar", así que los dos abrían el mismo calendario.

### Favicon

Es el logo de la casa en blanco sobre el terracota de la marca (`#b4552f`, el
mismo del `theme-color`), con las esquinas redondeadas. Se genera a partir de
`img/logo-icono-blanco.png`, recortándole el transparente que traía de sobra
al borde y componiendo a 512px para después bajar de tamaño, así no queda
dentado. Salen tres archivos: `favicon.ico` (16/32/48, para Windows y
pestañas viejas), `img/favicon-32.png` y `img/favicon-180.png` (para cuando
alguien guarda el sitio en la pantalla del celular).

**Ojo:** el logo es un dibujo de línea fina y bastante apaisado (2.13:1). En
180px se ve perfecto, pero **a 16 o 32px se empasta y no se reconoce la
casa** — es una limitación del dibujo, no del archivo. Si en algún momento
molesta, la salida es un logo simplificado para tamaño chico (por ejemplo sólo
el techo, o una inicial), no seguir peleando con el escalado.

## 5. Las variantes

Varias secciones están hechas de más de una forma para poder compararlas antes
de decidir. Se cambian con el **botón "⚙ Variantes" abajo a la izquierda**, y
la elección queda guardada en el navegador.

| Sección | Variantes | Por defecto |
|---|---|---|
| **Cómo se paga** (`checkout.html`) | `a` directo a WhatsApp · `b` Mercado Pago (Payment Brick) | `a` |
| **Preguntas frecuentes (inicio)** | `a` 4 preguntas + botón · `b` sólo botón · `c` nada, el nav va directo a la página | `b` |
| **Reservas en el inicio** | `a` sin panel · `b` con panel | `a` |
| **Cómo se alquila** | `a` unidades + precios por temporada · `b` bandas con foto y "desde" | `a` |
| **Reservas** | `c` modal en pasos · `b` panel lateral, fechas primero · `a` panel lateral, unidad primero | `c` |
| **La casa por dentro** | `a` carrusel · `c` carrusel a pantalla · `b` grilla | `a` |
| **La casa y el lugar** | `a` mosaico en 3 niveles · `b` grilla completa | `a` |

### Preguntas frecuentes (inicio)

`preguntas.html` es una página nueva con las 13 preguntas completas (reusa el
mismo `<details>`/`<summary>` que ya existía, ahora en `js/preguntas-pagina.js`).
En el inicio, la sección `#preguntas` tiene tres formas de mostrarse:

- **`a` — 4 preguntas + botón.** Las 4 que más pesan en si alguien reserva o
  no: entera/por planta, ingreso y salida, cómo se paga la seña, mascotas
  (`FAQ_DESTACADAS = [0, 3, 4, 5]` en `js/app.js`, por índice — si se
  reordena `FAQ` en `config.js` hay que revisar esos números). Debajo, "Ver
  todas las preguntas" a `preguntas.html`.
- **`b` — sólo el botón (la que queda activa).** Ni una pregunta en el
  inicio, sólo el título, la bajada y el botón a la página completa.
- **`c` — nada.** La sección `#preguntas` entera desaparece del inicio
  (`hidden`), y el link "Preguntas" del menú deja de hacer scroll-anchor y
  pasa a apuntar directo a `preguntas.html` (`aplicarVariantePreguntas()` le
  cambia el `href` al link con `id="nav-preguntas"` según la variante activa).

Pedido explícito (14/08/2026) pensando en achicar el scroll del inicio,
sobre todo en celular — 12-13 preguntas en acordeón eran de las secciones más
largas, incluso colapsadas. Mismo criterio que ya se usó para "Qué hacer en
la zona" y la galería: la sección larga se recorta y el resto queda a un
clic, no se borra nada.

**La sección tiene la foto de las sierras de fondo** (`.seccion--foto`,
`img/sierras-rosa.jpg` difuminada y bajada de brillo). Es la foto que antes
usaba la franja suelta que había justo antes; al fusionarlas, la home perdió
una parada entera sin perder el respiro visual. Con la variante `b` la
sección queda ocupando ~57% de la ventana, más presencia que la franja vieja
(44vh).

Dos cosas a tener en cuenta si se toca esto:

- **El texto va en blanco sobre la foto.** El `brightness(.45)` no es
  decorativo: con esa foto da 10.1 de contraste en el promedio y 5.4 en su
  punto más claro (el mínimo accesible es 4.5). Si se cambia la foto por una
  más clara, hay que rehacer esa cuenta o el título deja de leerse.
- **El fondo lleva `transform: scale(1.05)`.** Sin eso, el `blur()` despinta
  los bordes de la imagen y se ve una franja lavada contra la sección de al
  lado. (La `.franja-foto` vieja tenía ese defecto sin que nadie lo notara.)
- Queda una sección oscura (foto) pegada a otra oscura (`#contacto`, carbón
  plano). Se dejó así a propósito — la textura de la foto y el color plano se
  distinguen, y leído de corrido funciona como un cierre que se va apagando —
  pero si en pantalla no convence, la salida es aclarar el `brightness` de la
  foto y pasar el texto a oscuro, o mover `#contacto` a fondo claro.

### Reservas en el inicio

La home tenía una sección `#reservas` con el calendario de dos meses y el panel
de resumen al costado. Con el modal (flujo `c`) esa sección quedó duplicando lo
mismo y alargando muchísimo el inicio, así que por defecto **no se muestra**:
todos los botones "Reservar" / "Ver disponibilidad" / "Disponibilidad" abren el
modal. La variante `b` la vuelve a mostrar tal cual estaba, para comparar.

La sección sigue existiendo en `index.html` con el atributo `hidden`; la
enciende `aplicarPanelInicio()` en `js/calendario.js`.

### Cómo se alquila

**Dónde va.** Justo después de "La casa", antes de "La casa por dentro". El
motivo no es estético: la sección siguiente tiene las pestañas "Planta alta /
Planta baja", y esas etiquetas no significan nada hasta que se explicó que la
casa se divide en dos plantas independientes que se alquilan por separado.
Antes esa explicación llegaba cinco secciones más tarde. De paso, el que quiere
ir rápido hace casa → qué alquilás y cuánto → Reservar, sin pasar por 56 fotos.

Al moverla se corrieron los fondos de las secciones que siguen
(`seccion--arena` sale de ambientes y ubicación, y entra en galería y
actividades) para que sigan alternando claro/arena y no queden dos pegadas.

Antes eran **dos secciones** que decían lo mismo: "Cómo se alquila" (cards con
las plazas y la descripción de cada unidad) y "Tarifas" (cards por temporada
que volvían a listar `Casa completa · 9 plazas`, y así con las tres, una vez
por temporada). El nombre, las plazas y el detalle aparecían cuatro veces.

Ahora es **una sola sección** (`#tarifas`, donde estaba Tarifas, justo antes de
reservar) y las plazas se dicen una vez:

- **`a` — unidades + precios.** Arriba las tres unidades presentadas una sola
  vez (foto, nombre, plazas, detalle), con la casa completa más ancha que las
  plantas para que no queden tres columnas iguales. Abajo, las cards por
  temporada como estaban, pero ya sin repetir las plazas: sólo nombre y precio.
- **`b` — bandas con foto.** Una banda por unidad, alternando el lado de la
  foto (la casa completa más grande), con `desde $X la noche` en vez del cuadro
  completo. El detalle por temporada queda plegado en "Ver precios por
  temporada". Es la que menos hace leer: la idea es que el que quiere reservar
  rápido vea unidad, foto y precio de referencia, y el número exacto salga del
  calendario.

El `desde` sale de `precioDesde()` en `js/app.js`: el mínimo de esa unidad
entre todas las temporadas de `config.js`, no un número escrito a mano.

### Cómo se paga

En `checkout.html`, después de "Tus datos". Es la variante que decide **si
esta reserva pasa por Mercado Pago o no** (ver §6 para el detalle técnico del
pago en sí):

- **`a` — WhatsApp (la que queda activa).** Al tocar "Confirmar por
  WhatsApp" primero se bloquea la fecha en el servidor (`api/reservar.js`) y
  recién si eso sale bien se abre el mensaje con toda la reserva (unidad,
  fechas, noches, total, seña, datos de contacto). La seña se coordina a
  mano, como se venía haciendo antes de meter Mercado Pago — no se cobra
  nada desde el sitio.
- **`b` — Mercado Pago.** El Payment Brick de siempre: tarjeta ahí mismo,
  seña acreditada al toque, fecha bloqueada sola en la base.

El pedido de bajar el cobro online por ahora (14/08/2026, después de que la
familia viera la demo) fue explícito: no borrar nada, dejarlo listo para
prender cuando decidan cobrar de verdad. Por eso quedó como variante y no
como una rama de código aparte — es exactamente el mecanismo que ya existía
para comparar dos formas de hacer algo, tenía sentido reusarlo acá en vez de
inventar un interruptor nuevo. Se elige desde el mismo panel "⚙ Variantes" de
la home (aunque el efecto sólo se ve en `checkout.html`) y queda guardado en
el navegador.

### El bloqueo sin pago (`api/reservar.js`)

Es el hermano de `api/crear-pago.js` sin Mercado Pago: misma revalidación
(modalidad, disponibilidad cruzando `disponibilidad.js` con la base, mínimo
de noches), pero en vez de cobrar guarda la reserva con `estado: 'pendiente'`
y `origen: 'whatsapp'` (columnas nuevas en la tabla `reservas`; ver
`lib/reservas.js`: `marcarPendienteWhatsapp`, y `marcarPagada` ahora guarda
`origen: 'mercadopago'`, `estado: 'confirmada'`).

**Por qué el bloqueo va al mandar el mensaje y no al elegir la fecha:** un
hold temporal (bloquear apenas se elige la fecha, liberar solo si nadie
termina el formulario) se descartó a propósito — agrega expiración y
limpieza para un problema de choque de fechas que con el volumen de esta
casa es rarísimo. En cambio, `checkout.js` (`irPorWhatsapp`) llama a
`api/reservar.js` **antes** de abrir WhatsApp: si la fecha se acaba de
ocupar (409), avisa y manda de vuelta a `reserva.html` sin abrir un mensaje
para una fecha que ya no está; si el problema es técnico (la base caída, sin
red), deja pasar igual — no le tapa el WhatsApp a alguien que sólo quiere
preguntar, es la misma degradación elegante que ya tenía el Payment Brick.

**Cómo se libera o confirma una reserva pendiente:** `admin.html` tiene un
panel nuevo, "Reservas del sitio", que habla con `api/admin/reservas.js`
(protegido con la variable `ADMIN_TOKEN` — sin esa clave cargada en Vercel,
el panel no funciona, falla cerrado y no abierto). Ahí Naty ve todas las
reservas activas (pendientes y confirmadas, de WhatsApp o Mercado Pago), con
nombre y teléfono del huésped, y dos botones: **"Marcar pagada"** (pasa de
`pendiente` a `confirmada`, sólo tiene sentido para las de WhatsApp) y **"Dar
de baja"** (libera esas noches en `ocupadas` y marca la reserva `cancelada`
— la fecha vuelve a estar libre de inmediato). El calendario del panel
principal de `admin.html` también muestra estas fechas con una rayita debajo
del número (`.dia--online`), aunque el archivo `disponibilidad.js` todavía no
las tenga marcadas — así no hay que adivinar mirando dos listas separadas.

### Reservas

- **`c` — modal en pasos (el principal).** Paso 1: calendario grande y
  huéspedes. Paso 2: qué alquilás, con el precio de cada opción para esas
  fechas. Después salta a `reserva.html`, ya fuera de la home.
- **`b` — panel lateral, fechas primero.** Mismo orden que `c` pero en un panel
  al costado, sin cambiar de página hasta el final.
- **`a` — panel lateral, unidad primero.** El orden original: elegís qué
  alquilar y después las fechas.

**Por qué `c` y `b` ponen las fechas antes que la unidad:** como las
modalidades están anidadas, si elegís "casa completa" primero y esa semana la
planta baja está ocupada, ves los días bloqueados y te vas — sin enterarte de
que podías alquilar la planta alta. Poniendo las fechas primero, el sistema
muestra las tres opciones con precio y marca cuáles están libres. En `a` esa
alternativa queda escondida.

### La casa por dentro

- **`a` carrusel:** una foto grande por vez, con las vecinas asomando a los
  lados, flechas, puntitos y teclas ←/→. El título y la descripción van
  **abajo** de la foto, no encima, para que se lean siempre.
- **`c` carrusel a pantalla:** el mismo carrusel con otra piel. La foto ocupa
  casi todo el alto de la ventana (`76vh`, así se acomoda solo al zoom y a
  cada monitor, no a una medida fija), se sale del contenedor a todo el ancho,
  y la descripción va **encima** de la foto sobre un degradado oscuro.
- **`b` grilla:** todas las fichas juntas (lo que había antes).

`a` y `c` **comparten toda la lógica**: es un solo carrusel y la variante sólo
cambia una clase CSS (`.carrusel--pantalla`) y qué foto se carga — en `c` se
usa la original en vez de la miniatura de 760px, que a ese tamaño se vería
borrosa. No hay código duplicado que mantener al par.

Dos cosas que se resolvieron distinto en celular para `c`, porque la pantalla
angosta y alta rompía las dos ideas que la definen:

- El alto deja de ir en `vh` y lo manda el formato de la foto. Con `66vh` la
  imagen quedaba vertical (260×421 sobre un original 4:3) y recortaba los
  costados de cada ambiente.
- El texto vuelve abajo de la foto. Encima de una imagen de 300px de ancho, el
  bloque de descripción tapaba el 97% de la foto.

**Bug que apareció de paso:** en la variante `a` la descripción estaba escrita
pero no se veía. Todas las fotos del carrusel eran `position: absolute`, así
que el contenedor no tenía alto propio y se quedaba en su `min-height`; el
`overflow: hidden` (que está para recortar a lo ancho las fotos vecinas, que
se salen a propósito) cortaba el texto por abajo. Se arregló dejando **sólo la
foto activa en el flujo** (`.carrusel__item--activo { position: relative }`),
así el contenedor crece hasta donde llega el texto. El `min-height` del pie
está para que el alto no salte al pasar de una foto a otra cuando un texto
ocupa una línea más.

El carrusel ocupa muchísimo menos alto, que era el problema: con 15 ambientes
la grilla se hacía eterna, sobre todo en celular.

### La casa y el lugar

Tres niveles, como Booking o Airbnb:

1. **Mosaico** con 8 fotos elegidas (prioriza entorno y aire libre) y un
   `+48 fotos` sobre la última.
2. **Todas las fotos** en chiquito, a pantalla completa y con filtros.
3. **Visor** de una por una, con tira de miniaturas abajo y contador `12 / 56`.

**Cualquier** foto del mosaico abre el nivel 2, no la foto sola. El mosaico es
la vidriera: el que hace clic en una de las ocho quiere ver el resto, no esa
foto en grande. La foto sola se abre desde el nivel 2, que es donde ya elegiste.

Dos cosas del nivel 2 que se ajustaron mirando cómo quedaba de verdad:

- **Las fotos se pisaban unas con otras.** Éste era el problema de fondo, y
  no se veía leyendo el CSS: la grilla es un `flex: 1 1 auto` dentro de la
  ventana completa, así que el navegador le achicaba el alto para que entrara
  y dejaba las filas en 34px con fotos de 238px encima. Se arregla con
  `grid-auto-rows: max-content`: cada fila mide lo que mide su foto y la
  grilla se desplaza hacia abajo, que es lo que corresponde en una vista que
  existe para mirar fotos.
- **La grilla tiene tope de ancho y cantidad fija de columnas** (4 · 3 · 2
  según la pantalla), en vez de `auto-fill`. Sin tope, en un monitor grande
  entraban nueve columnas de fotos diminutas: parecía una planilla de
  contactos. Y con `auto-fill` el tamaño de la foto cambiaba solo según el
  ancho de la ventana. Bajar scrolleando acá no molesta.
- **`grid-auto-flow: dense`** para que la panorámica que no entra al final de
  una fila no deje un hueco: se rellena con la foto siguiente.
- **Las panorámicas ocupan dos columnas.** De las 56 fotos, 43 son 4:3 y sólo
  4 son panorámicas de 2.22:1. Metidas en el mismo cuadrito que las demás
  perdían un 40% del ancho, justo el paisaje que hace que valga la pena la
  foto. Con el doble de ancho entran casi enteras (se recorta algo de cielo y
  de piso, que no molesta) y de paso la grilla deja de ser un damero perfecto.
  El corte está en 2.0 y no más abajo a propósito: a las 16:9 les conviene
  quedarse en el cuadro chico, porque en el ancho perdían más alto del que
  ganaban de paisaje. La marca la pone `marcarPanoramica()` en `js/app.js`
  midiendo la foto cuando carga, no con una lista escrita a mano.

  El `aspect-ratio: 2.72/1` de la ficha ancha no es un número al azar: es lo
  que mide una ficha de dos columnas más el espacio del medio, comparado con
  el alto de las 4:3 de al lado. Con eso las filas quedan parejas. (Dejarlo en
  `auto` esperando que `stretch` le diera el alto no funciona: la ficha se
  desplomaba a 24px.)

  En celular la panorámica vuelve al cuadro normal: entran dos columnas
  justas, y si una se llevaba las dos quedaba una foto sola por fila.

Con 56 fotos, mostrarlas todas de una hacía la home larguísima.

### Cuando decidan

Borrar `js/variantes.js`, el bloque `<div class="variantes">` de `index.html`,
los estilos `.variantes`/`.pvar__*`, y el código de la variante que pierda.
Está todo marcado con comentarios.

---

## 6. Cobrar la seña (Mercado Pago)

Ya está armado de punta a punta: `checkout.html` muestra el formulario de
tarjeta de Mercado Pago (Payment Brick), y al pagar la seña la fecha queda
bloqueada sola, sin que nadie tenga que actualizar `admin.html` a mano.

### Cómo está armado

```
navegador (checkout.js)                    servidor (api/, lib/)
────────────────────────                   ──────────────────────
Payment Brick arma un token    ──POST──▶   api/crear-pago.js
de la tarjeta (no ve el número                │
real: es un iframe de MP)                     │ 1. busca la modalidad en config.js
                                               │ 2. junta disponibilidad.js (la base,
                                               │    cargada a mano) con lo que ya se
                                               │    pagó online (Postgres/Neon)
                                               │ 3. si la fecha sigue libre, cotiza con
                                               │    precios.js — el mismo cálculo que
                                               │    usa el navegador, no una copia
                                               │ 4. le pide a Mercado Pago que cobre la
                                               │    seña (nunca un monto que mandó el
                                               │    navegador)
                                               │ 5. si se aprobó, marca esas noches
                                               │    ocupadas en la base
                                               ▼
                                          responde {status, sena}
```

`js/precios.js` es la pieza clave de ese diseño: son las cuentas de fechas y
plata (antes vivían sólo en `calendario.js`) sacadas a un archivo sin nada de
DOM, que corre igual con `<script>` en el navegador que con `require()` en
Node. Así el servidor no tiene una copia de la lógica de precios que se pueda
desincronizar de la que ve el visitante — es la misma cuenta.

**El navegador nunca decide el precio.** `checkout.js` manda el token de la
tarjeta y la reserva elegida (modalidad, fechas, huéspedes); el monto que se
cobra lo calcula `api/crear-pago.js` desde cero. Aunque alguien manipulara
`checkout.js` en su propio navegador, lo único que lograría es que el
servidor le cobre el precio real igual, o rechace la fecha si ya no está
libre.

### Disponibilidad: dos capas

- **`disponibilidad.js`** sigue siendo la base, cargada a mano con
  `admin.html`, para reservas que se coordinan por WhatsApp/transferencia.
- **Postgres (Neon)** guarda aparte las noches que se pagaron online.
  `api/crear-pago.js` junta las dos antes de aceptar un pago nuevo
  (`Precios.unirOcupadas`), así una reserva pagada bloquea la fecha al
  instante sin depender de que alguien actualice el archivo.

No hace falta migrar `admin.html` a la base: las dos conviven. Si algún día
se quiere ver todo en un solo lugar, el siguiente paso sería que `admin.html`
también lea la tabla `reservas` — no es necesario para que esto funcione hoy.

`lib/reservas.js` usa `@neondatabase/serverless`, que habla por HTTP en vez
de mantener una conexión TCP abierta — lo que conviene en una función
serverless, donde cada invocación es corta. Las tres tablas (`ocupadas`,
`reservas`, `pagos_vistos`) se crean solas la primera vez que hace falta
(`asegurarTablas`); no hay que correr ninguna migración a mano.

(Se probó primero con Redis — la integración "Redis" del Marketplace de
Vercel, reemplazo de la vieja "Vercel KV" — pero nunca se pudo confirmar que
las variables llegaran bien al proyecto, así que se cambió a Neon con el
mismo contrato en `lib/reservas.js`. Si en algún momento conviene volver a
algo tipo Redis, `hayBaseDatos`/`nochesPagadas`/`marcarPagada`/
`pagoYaProcesado`/`marcarPagoProcesado` es toda la superficie que hay que
reimplementar — `api/crear-pago.js` y `api/webhook-mercadopago.js` no se
tocan.)

### Qué hace falta cargar (una sola vez)

1. **Crear la base en Neon** ([neon.tech](https://neon.tech), gratis) y
   copiar el connection string (Dashboard → Connect). Se puede crear directo
   ahí, o conectarla desde Vercel (Storage → Connect Store → Neon), que la
   carga sola en el proyecto.
2. **`DATABASE_URL`**, como variable de entorno del proyecto en Vercel
   (Project Settings → Environment Variables), con ese connection string.
3. **`MP_ACCESS_TOKEN`**, como variable de entorno del proyecto en Vercel.
   Es el Access Token de
   [mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel).
   Usar el de **prueba** (`TEST-...`) hasta haber probado un pago de punta a
   punta; recién después cambiar al de producción (`APP_USR-...`).
4. **`MP_WEBHOOK_SECRET`** (opcional pero recomendado): la "Clave secreta"
   que Mercado Pago muestra al configurar el webhook. Sin ella el webhook
   sigue funcionando — valida cada pago llamando directo a la API de
   Mercado Pago con el Access Token — pero no puede confirmar de entrada que
   la notificación vino realmente de ellos.
5. **La URL del webhook** en el panel de Mercado Pago (Tu aplicación →
   Webhooks): `https://tu-dominio/api/webhook-mercadopago`, evento `payments`.
6. **`CONFIG.mercadoPago.publicKey`** en `js/config.js` — la Public Key (no
   es secreta, viaja al navegador). Ya tiene cargada la de prueba.
7. **`ADMIN_TOKEN`**, como variable de entorno del proyecto en Vercel —
   cualquier texto largo, es la clave del panel "Reservas del sitio" de
   `admin.html`. Sin esto cargado ese panel no funciona.

`.env.example` en la raíz lista estas mismas variables para probar en la
computadora con `vercel dev` (copiarlo a `.env.local`, que queda fuera de
Git).

**Después de cargar o corregir cualquier variable en Vercel hace falta un
deployment nuevo para que la función la vea** — guardarla sola no alcanza.
Esto costó bastante tiempo de diagnóstico: `MP_ACCESS_TOKEN` quedó bien a la
primera porque se guardó y se hizo *Redeploy* enseguida; con `DATABASE_URL`
pasaron dos cosas separadas — primero un typo en el nombre (`DABASE_URL`, sin
la T) y, ya con el nombre corregido, tres intentos de `git push` (que sí
generan un deployment nuevo) que igual no la veían. Se destrabó recién
volviendo a guardar la variable *y después* haciendo el commit — o sea, el
guardado en sí no había quedado firme la primera vez. Si algo parecido vuelve
a pasar: agregar temporalmente a la función un campo de diagnóstico que liste
`Object.keys(process.env)` filtrado por el nombre esperado (así se ve el
nombre exacto tal como lo ve el servidor, espacios invisibles incluidos) es
mucho más rápido que adivinar desde los Runtime Logs.

### Qué pasa si algo falla a mitad de camino

- **Sin Public Key o si el Brick no carga** (`js/checkout.js`,
  `mostrarFallbackWsp`): el pago con tarjeta desaparece y vuelve el mensaje
  de "todavía no cobramos online, te escribimos por WhatsApp" que había
  antes. El sitio nunca queda con un botón de pagar roto.
- **Mercado Pago aprueba el pago pero guardar en la base falla** (por
  ejemplo, si `DATABASE_URL` no está bien cargada — es exactamente lo que
  pasó probando esto en producción, ver más arriba): esto se probó a
  propósito con un test que simulaba la falla, y **no se puede convertir en
  un error 500** — el huésped ya pagó, eso no se puede deshacer.
  `api/crear-pago.js` separa esa parte en su propio `try/catch`: igual
  responde que el pago salió bien, pero con un aviso para que confirme por
  WhatsApp con el comprobante, y deja un `console.error` bien explícito en
  los logs de Vercel para revisar la reserva a mano. El webhook, además,
  reintenta guardarla solo cuando llegue la notificación.
- **Dos personas pagan la misma fecha casi al mismo tiempo:** la segunda
  reserva la rechaza `api/crear-pago.js` con 409 antes de cobrarle nada
  (revalida disponibilidad justo antes de llamar a Mercado Pago). No elimina
  el margen de una carrera perfectamente simultánea — para eso haría falta un
  lock atómico en la base — pero para el volumen de esta casa (una reserva
  online cada tanto, no un sitio con miles de visitas por minuto) es
  suficiente.

### Cómo probar

1. `npm install`.
2. Cargar `.env.local` con `MP_ACCESS_TOKEN` de prueba.
3. En Mercado Pago, [las tarjetas de test](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/your-integrations/test/cards)
   simulan aprobado/rechazado según el nombre del titular que se cargue.
4. Con `vercel dev` (no alcanza el `python -m http.server` de §1, porque ese
   no corre las funciones de `api/`), probar una reserva completa en
   `checkout.html` y confirmar que la fecha queda ocupada en el calendario
   después.

### Contenido (lo que más falta)

Nada de esto se puede inventar sin arruinar el efecto:

- Quién atiende la casa, con nombre. Y la historia, si es familiar o heredada.
- Desde cuándo se alquila.
- Tres o cuatro lugares de Nono y Mina Clavero **con nombre propio**.
- Reseñas reales de Airbnb, Booking o WhatsApp, con fecha.
- Detalles que sólo sabe el dueño: que la escalera cruje, a qué hora pega el
  sol en cada galería, qué se ve de noche.
- Un bloque **"Reserva directa"** con razones para reservar por la web.

### Datos pendientes en `config.js`

Todo lo marcado con `<< REVISAR >>`: teléfono de WhatsApp, mail, coordenadas
exactas del mapa, precios reales, el porcentaje de seña (`senaPorcentaje`, hoy
en 30) y siete respuestas del FAQ. Las que faltan confirmar salen por consola
al abrir la página, con la pregunta concreta que hay que responder.

### Otras cosas menores

- `admin.html` no tiene contraseña. No es grave porque sólo genera texto para
  copiar y pegar, pero cualquiera con la URL lo abre.
- Las fotos pesan 18 MB en total. Ninguna llega al mega, pero si en algún
  momento va a un hosting con límite de tráfico, conviene comprimirlas.

---

## 6.b El pie y las páginas legales

### Qué exige la normativa argentina

Se investigó antes de escribirlo, porque acá no se puede improvisar. Lo que
aplica a un alojamiento que se comercializa por internet:

| Norma | Qué obliga | Dónde está resuelto |
|---|---|---|
| [Res. 424/2020](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-424-2020-342869/texto) de Comercio Interior | Botón de arrepentimiento, con acceso **fácil, directo y destacado desde la home**, sin exigir registro previo. 10 días corridos. El proveedor da un código de trámite y responde en 24hs | `arrepentimiento.html` + link separado en el pie |
| Ley 24.240 de Defensa del Consumidor | Identificar al proveedor (nombre/razón social, CUIT, domicilio) y las condiciones de contratación | `legales.html#terminos` y la barra del pie |
| [Ley 25.326](https://www.argentina.gob.ar/aaip/datospersonales) de Protección de Datos | Informar qué datos se recolectan, para qué, y cómo se ejercen acceso/rectificación/supresión | `legales.html#privacidad` |
| Ley 6483 y Decreto 1359 (Córdoba) + Registro Nacional de Viviendas de Alquiler Turístico Temporario | Registrar el alojamiento y publicar el número | campo `registroTuristico` en `config.js` |

**Un detalle que sorprende:** en la Unión Europea el alojamiento con fecha
determinada está exento del derecho de revocación, pero el
[art. 1116 del Código Civil y Comercial](https://leyes-ar.com/codigo_civil_y_comercial/1116.htm)
argentino **no incluye esa excepción** — la doctrina lo señala como una
omisión del legislador. O sea que acá el turismo con fecha fija queda dentro.
Por eso el botón de arrepentimiento está puesto aunque sea una casa de campo
con fechas cerradas: es barato tenerlo y caro que lo reclamen.

### Cómo está armado

- **`js/pie.js`** escribe el pie completo, igual para todo el sitio. Antes
  estaba copiado a mano en cada HTML y se desincronizaba solo. Cada página lo
  pide con `pintarPie({ cta, enInicio })`.
- **El pie reemplazó a la sección `#contacto`**, que era una banda carbón con
  una foto de la casa de noche al costado. Con "Preguntas frecuentes" ya
  oscura, quedaban tres bandas oscuras seguidas, y esa foto no mostraba nada
  que la galería no mostrara mejor (sigue estando ahí). Ahora el CTA de
  WhatsApp vive arriba del pie y es un solo cierre.
- **`legales.html`** tiene los tres textos en una página con índice
  (`#terminos`, `#privacidad`, `#cancelacion`). El texto está en el HTML —es
  texto, no datos— pero todo lo variable (titular, CUIT, plazos, contacto)
  sale de `CONFIG.legales` vía `js/legales.js`, que rellena los
  `<span data-legal="...">`. Así el CUIT se toca en un solo lugar.
- **`arrepentimiento.html`** tiene página propia y link aparte del resto de
  los legales, porque la resolución pide que sea *destacado*, no uno más de la
  lista. Genera el código de trámite (`ARR-AAAAMMDD-XXXX`) en el navegador y
  lo mete dentro del mensaje de WhatsApp: no hay servidor donde guardarlo, así
  que el respaldo real es el mensaje que le queda al huésped en su teléfono.
- **En `reserva.html` y `checkout.html` el pie sigue corto** (un pie de veinte
  links en medio del checkout distrae), pero se les agregaron los tres links
  legales: es justo el momento donde el huésped se está por comprometer.

### Lo que falta completar

`CONFIG.legales` en `js/config.js` tiene marcado con `<< REVISAR >>`:

- **`titular`, `cuit`, `registroTuristico`** — datos reales, no se inventan.
  Mientras falten, `legales.html` muestra un aviso amarillo arriba diciendo
  qué falta, y la línea fiscal del pie directamente no se dibuja. Eso es a
  propósito: publicar un CUIT inventado es peor que no publicar ninguno.
- **`cancelacion`** — los plazos (30 días sin cargo, 15 al 50%, 20 para
  reprogramar) son **un borrador razonable del rubro**, no una decisión
  tomada. Hay que confirmarlos antes de sostenerlos frente a un huésped.

**Y lo más importante: esto no reemplaza a un abogado.** Cubre lo que la
normativa exige y está redactado en el tono del sitio, pero conviene que lo
lea alguien del rubro antes de publicarlo.

---

## 7. Decisiones que conviene no deshacer sin pensarlo

- **La sección de disponibilidad de la home se quedó** aunque el flujo principal
  sea el modal. Sirve para ver el calendario de dos meses de un vistazo y para
  que Google encuentre la palabra "disponibilidad".
- **El contenido es visible por defecto y la animación de aparición sólo se
  activa si el navegador la soporta** (`html.anim` la agrega `app.js`). Si el
  script falla, nunca queda una sección invisible.
- **La foto de "La casa" sangra con un `margin-right` calculado**, no con un
  `50%`: dentro de un grid, los porcentajes se resuelven contra la columna y no
  contra el contenedor.
- **El calendario dibuja el mismo componente en tres lugares** (sección, drawer
  y modal) desde una sola función. Si agregás un cuarto, pasale los ids a
  `dibujarEn()`.
