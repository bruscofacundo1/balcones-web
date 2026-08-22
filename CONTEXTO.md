# Balcones del Arroyo — contexto del proyecto

Sitio de la casa de campo en Arroyo de los Patos (Nono, Traslasierra, Córdoba).
HTML, CSS y JavaScript sin frameworks ni compilación: se abre `index.html` y anda.

Este documento cuenta **qué se hizo, por qué, y qué falta**. Si retomás el
proyecto (vos, otra persona o Claude en otra sesión), leé esto primero.

---

## La migración de Vercel a Cloudflare (22/08/2026)

El sitio se mudó de hosting: repo, Neon y todo lo demás pasaron a la cuenta
de Enrique (antes estaban en una cuenta de prueba). De paso, el hosting pasó
de Vercel a Cloudflare (Worker + R2) — con el tráfico esperado (boca en boca,
sin picos) los dos son gratis, pero Cloudflare no cobra nunca por
transferencia de datos, que es lo primero que se gasta en una galería de
fotos si hay un pico de visitas, y su plan pago de respaldo es más barato.

El detalle completo de qué cambió en el código, qué hay que configurar a
mano en el dashboard de Cloudflare (el bucket de R2, su dominio público, las
variables de entorno) y qué conviene probar antes de dar la migración por
cerrada está en **`MIGRACION-CLOUDFLARE.md`**, aparte de este archivo porque
es una migración de infraestructura, no un cambio de producto. Resumen para
quien no vaya a leerlo entero: la lógica de negocio (precios, disponibilidad,
el lock atómico de reservas, el escapado contra XSS) no se tocó — sólo cómo
entra el pedido y sale la respuesta, y cómo se suben las fotos. La única
pieza reescrita a mano sin poder probarla contra Mercado Pago real es la
validación de firma del webhook (antes la hacía el SDK oficial); conviene
confirmarla con un pago de prueba antes de darla por buena del todo.

## Lo último: la revisión del 18/08/2026

El detalle de cada cosa está en su sección temática; esto es sólo el mapa. La
sesión arrancó por el panel de edición y terminó revisando el flujo de reservas
entero.

**Dos problemas serios que aparecieron revisando, y que no eran el pedido
original:**

| Qué | Dónde está contado |
|---|---|
| **El calendario público mostraba todo libre siempre.** Al unificar la disponibilidad en la base se vació `disponibilidad.js`, pero del lado del navegador nadie lo reemplazó. El visitante elegía fechas ya vendidas y se enteraba al confirmar | §6 · *Disponibilidad: una sola capa* |
| **XSS almacenado en el panel** desde `/api/reservar`, que es público. El nombre del huésped se pintaba con `innerHTML` sin escapar | §6 · *El panel escapaba el contenido pero no las reservas* |

**Errores de cálculo encontrados:**

- **El 29 de febrero no caía en ninguna temporada** y se cobraba al precio del
  fallback en plena temporada alta (§6.d · *Cuándo rige cada temporada*).
- **El mínimo de 3 noches de temporada alta** rechazaba los findes largos de
  sábado a lunes. Bajó a 2 (§6.d · *Las fechas móviles ya cargadas*).
- **El mínimo de noches estaba escrito dos veces** — en `minNoches` y a mano en
  `incluye`— y sólo uno era editable desde el panel.

**El panel de edición, que era el pedido original:**

- Vista previa del sitio mientras se edita (`/?preview=1`), §6.d
- Precios en tabla, y las cuatro pestañas Precios · Fechas · Textos · Datos, §6.d
- Revisión con el viejo → nuevo antes de publicar, §6.d
- Preguntas y opiniones: agregar, sacar y reordenar, §6.d
- Rangos de temporada editables, con nombre y con excepciones por año, §6.d
- Semana Santa y findes largos ya cargados; el panel calcula las próximas, §6.d
- En fotos, cuáles salen en la portada y un "llevar al principio", §6.d

**Robustez del flujo de reservas** (§6 · *El resto de la revisión*): tope de 5
reservas por hora y por IP, expiración de las pendientes a los 14 días, y el
orden de escritura invertido para que un fallo a mitad de camino no deje noches
bloqueadas invisibles.

**Lo que se probó contra la base real** (§6 · *Lo que se revisó y está bien*):
las dos personas reservando la misma noche, el pago de Mercado Pago superpuesto,
la cancelación que devuelve las noches a la reserva que sigue en pie, la
expiración y el tope por IP. **No hay sobreventa**: la clave primaria
`(planta, noche)` es el lock atómico.

### El bug que se destapó al final (19/08/2026)

En el sitio publicado, las tarjetas de "Cómo se alquila" **quedaban invisibles**:
la sección aparecía con el título, un hueco enorme en blanco y las notas de
"Bueno a saber" abajo.

Es el bug del `IntersectionObserver` de `.revelar` otra vez, por tercera vez, y
esta vez llegó desde el otro lado. `iniciarRevelado()` escanea el DOM **una sola
vez**; lo que se pinte con `.revelar` después queda en `opacity: 0` y nadie lo
vuelve visible. `pintarMosaico()` ya consultaba `animacionesListas` para
evitarlo, pero **otros cuatro pintores no**: `pintarTarifas`, `pintarUnidades`,
`pintarBandas` y `pintarActividades` agregaban la clase siempre.

Eso era una bomba con la mecha larga: sólo estallaba si la página se repintaba
tarde, que pasaba rara vez. **Y el cambio de la disponibilidad le prendió la
mecha**: `usarLoQueLlegue` llamaba a `repintar()` cuando llegaban las fechas
ocupadas, o sea prácticamente en cada visita.

Se arreglaron las dos puntas:

- **Los cuatro pintores consultan `animacionesListas`**, como ya hacía
  `pintarMosaico`. Un repintado tardío pinta visible, sin animar.
- **Las fechas ocupadas ya no disparan `repintar()`.** No hacía falta: no
  cambian nada de lo que esa función dibuja. Lo único que sí hay que actualizar
  es el calendario, y para eso está `redibujarCalendario()`, que es puntual.

**Por qué no se veía en local:** sin `/api/contenido` (que el `http.server` de
Python no sirve) el pedido falla, `usarLoQueLlegue` no corre nunca y no hay
repintado tardío. El bug sólo aparece donde la API contesta.

**Y una trampa al medirlo:** `.revelar` tiene `transition: opacity .7s`. Si se
le saca la clase `visible` a un elemento que ya está en pantalla y se lee
`getComputedStyle` en el acto, devuelve **1**, porque la transición recién
arranca. Parece que no reproduce. Para verlo hay que pintar el HTML de cero
—como hace el código real— y ahí sí da `opacity: 0` enseguida.

### Qué quedó pendiente

**Para hacer sí o sí:**

- **Rotar la contraseña de Neon.** Se compartió para poder probar contra la base
  real. Dashboard → Roles → Reset password, y actualizar `DATABASE_URL` en
  Vercel **con un deployment nuevo** (guardar la variable sola no alcanza).
- **Completar lo marcado `<< REVISAR >>` en `config.js`**: CUIT y titular reales
  (sin eso `legales.html` muestra un aviso y el pie no dibuja la línea fiscal),
  coordenadas exactas del mapa, precios reales, y las reseñas verdaderas en
  lugar de las tres de ejemplo. **No inventar ninguno de esos datos.**

**Deuda conocida, ninguna urgente:**

- **21 noches en `ocupadas` no tienen `reserva_id`** (son de antes de que
  existiera esa columna) y las 3 reservas cargadas figuran con cero noches.
  `cancelarReserva` las cubre por el camino viejo, así que funciona; emparejarlas
  con un script las dejaría prolijas.
- **Los fines de semana largos hay que cargarlos a mano cada año**: los fija el
  gobierno por decreto y no se pueden calcular. La Semana Santa sí la calcula el
  panel sola.
- **El texto de `periodo` se podría generar** a partir de los nombres de los
  rangos, en vez de escribirse aparte. Hoy hay que acordarse de mantener los dos.
- **`abrirDia()` en `admin.html` suma un listener por cada día que se abre** y
  nunca los saca. Hoy no hace daño porque los viejos buscan atributos que otras
  hojas no tienen, pero es una trampa para la próxima hoja que los use.
- **`actualizarReserva` lee y escribe sin transacción**: dos personas editando la
  misma reserva a la vez pisarían una a la otra. Riesgo bajo con una sola
  administradora.

---

## 1. Cómo se levanta

No hay build. Para verlo en el navegador alcanza con abrir `index.html`, pero
para que funcione el paso de una página a otra conviene levantar un servidor:

```bash
python -m http.server 8788
```

y entrar a `http://localhost:8788` (el puerto sale de `.claude/launch.json`).

> Con `file://` el navegador bloquea la navegación entre páginas y el flujo de
> reserva se corta al pasar a `reserva.html`.

**Caché:** los `<script>` y el CSS se cargan con `?v=46`. Cuando publiques un
cambio, **subí ese número** en **los siete** HTML (index, reserva, checkout,
preguntas, legales, arrepentimiento y admin) o los visitantes van a seguir
viendo la versión vieja.

> `admin.html` tiene el grueso de su código *adentro* del propio archivo, así
> que el `?v=` no lo cubre: para ver un cambio del panel a veces hace falta
> recarga forzada (Ctrl+Shift+R). Pasó mientras se probaba el arreglo del XSS.

**Funciones serverless (`api/`):** necesitan sus dependencias instaladas una
vez:

```bash
npm install
```

Eso sólo afecta a `api/`, `lib/` y `worker.js` — el sitio en sí sigue sin
build. Para probar el pago de verdad en tu compu hace falta además
`npx wrangler dev` (que lee las variables de un `.dev.vars`, ver §6) en vez
del `python -m http.server` de arriba, porque ese servidor no sabe correr
`worker.js`.

## 1.b Publicación (Cloudflare)

Desde el 22/08/2026 el sitio se publica en Cloudflare (antes era Vercel; ver
`MIGRACION-CLOUDFLARE.md` para el detalle de qué cambió). Cloudflare unificó
Pages y Workers: el proyecto se crea como un **Worker con Git conectado**, no
como el "Pages clásico" de antes — `wrangler.toml` declara el punto de
entrada (`worker.js`) y los bindings, así que no hay nada de build que
configurar a mano. Los pasos están en el `README.md`.

`_headers` y `_redirects` definen lo mismo que antes hacía `vercel.json`, y
el binding de assets de `wrangler.toml` los sigue soportando igual que Pages:

- **Caché**: las fotos de `img/` se guardan un año (nunca cambian de nombre);
  el HTML, el CSS y el JS se revalidan en cada visita, así un cambio se ve al
  toque aunque te olvides de subir el `?v=`.
- **URLs limpias**: las páginas quedan en `/reserva` en vez de `/reserva.html`.
  Los links del código siguen apuntando a `reserva.html` a propósito, para que
  también funcionen abriendo los archivos localmente; `_redirects` reescribe
  solo.

Las funciones del pago (§6) viven en `api/` — `worker.js` las importa y las
despacha según la URL para las rutas `/api/*` (`run_worker_first` en
`wrangler.toml` asegura que esas rutas siempre lleguen ahí). Lo que sí hay
que hacer a mano en el dashboard de Cloudflare: crear el bucket de R2 (antes
del primer deploy, porque el binding necesita que ya exista), cargar las
variables de entorno y conectar la base de Neon (los pasos están detallados
en §6 y en `MIGRACION-CLOUDFLARE.md`).

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
| `admin.html` | El panel entero: calendario, reservas, precios y textos, fotos (§6.c y §6.d) |
| `css/estilos.css` | Todos los estilos |
| `js/config.js` | **Los datos del negocio**: precios, temporadas y sus rangos, textos, contacto, FAQ, opiniones, Public Key de Mercado Pago |
| `js/disponibilidad.js` | **Vacío a propósito.** Quedó como red de seguridad; las noches ocupadas viven en la base (§6) |
| `js/precios.js` | Fechas, temporadas y cotización — funciones puras, sin DOM. Las usa el navegador y el servidor (§6) |
| `js/contenido.js` | **Qué se puede editar desde el panel y cómo se valida.** Dual como `precios.js`. También la vista previa, las colecciones y el cálculo de Semana Santa (§6.d) |
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
| `lib/reservas.js` | Reservas y noches ocupadas en Postgres (Neon). También el tope por IP y la expiración de pendientes |
| `lib/contenido.js` | Lee y guarda lo editado desde el panel. `configEfectivo()` es lo que tiene que usar todo lo que cotiza o cobra |
| `lib/fotos.js` | La galería editable, en la base y en Vercel Blob (§6.e) |
| `lib/sesion.js` | Cookie de sesión firmada del panel, y `ipDe()` (§6.c) |
| `api/contenido.js` | **Público.** Textos, fotos y **noches ocupadas** — todo en un pedido, antes de pintar |
| `api/crear-pago.js` | Cobra la seña (recalcula todo del lado del servidor) |
| `api/webhook-mercadopago.js` | Recibe los avisos de Mercado Pago cuando cambia el estado de un pago |
| `api/reservar.js` | **Público.** Bloquea la fecha sin cobrar (variante WhatsApp), con tope por IP |
| `api/admin/reservas.js` | Lista, crea, confirma y cancela reservas |
| `api/admin/contenido.js` | Guarda precios y textos; valida contra el mismo catálogo que el panel |
| `api/admin/fotos.js` | Subir, reordenar, editar y sacar fotos |
| `api/admin/sesion.js` | Entrar y salir del panel, con freno de fuerza bruta |
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

**Cómo se libera o confirma una reserva pendiente:** desde el panel de
`/admin`, que habla con `api/admin/reservas.js` (protegido por la cookie de
sesión; sin `ADMIN_PASSWORD` cargada en Vercel el panel no abre — falla
cerrado y no abierto). Ver §6.c. Ahí Naty ve todas las
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

### Disponibilidad: una sola capa (desde 16/08/2026)

Durante un tiempo hubo **dos** listas de "ocupado": `disponibilidad.js`, que
se editaba bajando un archivo desde `admin.html` y requería un deploy, y la
tabla `ocupadas` en Postgres, que se llenaba sola con las reservas de la web.

Eso se unificó: **todo vive en la base**. Las reservas de la web, las que se
cargan a mano por teléfono y los bloqueos por uso propio son todos el mismo
tipo de registro. `disponibilidad.js` quedó vacío y ya no se edita; sigue
sumándose por si alguna vez hace falta bloquear algo sin base de datos.

El motivo no es prolijidad: dos listas que se actualizan por caminos
distintos —una necesita deploy y la otra no— terminan desincronizándose, y en
un sistema de reservas eso se llama sobreventa.

**Faltaba la mitad de esa unificación (arreglado el 18/08/2026).** Al vaciar
`disponibilidad.js` quedó bien el lado del servidor —`api/reservar.js` y
`api/crear-pago.js` cruzan el archivo con la base antes de aceptar— pero
**nadie reemplazó el lado del navegador**: `js/calendario.js` armaba `OCUPADAS`
sólo desde ese archivo vacío, y ningún pedido traía las noches tomadas. El
calendario mostraba **todo libre siempre**. El visitante elegía fechas ya
vendidas, completaba el checkout y se enteraba recién al confirmar, con un
mensaje ("Uy, justo se ocupó una de esas fechas") escrito para una carrera rara
que en realidad era el camino normal de toda fecha ocupada.

Ahora `/api/contenido` devuelve también `ocupadas` (`nochesOcupadasPublicas()`
en `lib/reservas.js`) y `Contenido.aplicarOcupadas()` lo vuelca en `OCUPADAS`.
Detalles que importan:

- **Va en el pedido que ya se hacía**, no en uno nuevo: se necesita en el mismo
  momento, antes de pintar. Que quede cacheado 60s en el borde es aceptable
  porque el chequeo de verdad lo sigue haciendo la base al confirmar.
- **Sólo de hoy en adelante y como arrays.** `ocupadas` no se limpia nunca; sin
  el filtro, el pedido de cada visitante crecería para siempre.
- **La disponibilidad cacheada en `localStorage` no se aplica.** Es lo único
  del contenido que caduca de verdad: una noche libre ayer puede estar vendida
  hoy. Los textos y los precios sí se pintan del caché al instante.
- **`ocupadas: null` significa "no se pudo saber"**, distinto de
  `{alta:[],baja:[]}` ("no hay ninguna ocupada"). Con `null` el sitio no
  promete una disponibilidad que no pudo verificar.
- La leyenda debajo del calendario decía *"Disponibilidad actualizada al
  11/08/2026"*, una fecha congelada dentro del archivo que ya no se edita.
  Mentía dos veces. Ahora sólo afirma algo si el servidor contestó.

### El panel escapaba el contenido pero no las reservas (18/08/2026)

`admin.html` pintaba el nombre del huésped, el teléfono y la nota con
`innerHTML` **sin escapar**, mientras que las secciones de contenido y de fotos
sí usaban `escapar()`. Y los datos del huésped entran por `/api/reservar`, que
es **público**: no pide sesión y guarda `datos` tal como llega.

O sea que un `POST` con `datos.nombre = "<img src=x onerror=…>"` ejecutaba
código en el navegador de quien abriera el panel. La cookie es `httpOnly` y no
se podía robar, pero el script actuaba *como* la administradora: cancelar
reservas, leer los datos de todos los huéspedes, mandarlos afuera.

Se escapó todo lo que viene del huésped: las tarjetas de la lista, los bloques
del detalle del día, las filas de datos, la nota dentro del `textarea` y el
`title` de las celdas del calendario (que escapaba sólo las comillas). **Si se
agrega algo nuevo que muestre datos de una reserva, va con `escapar()`.**

### El resto de la revisión del flujo de reservas (18/08/2026)

**Tope en `/api/reservar`.** Es público —lo usa el visitante, no puede pedir
sesión— y cada llamada bloquea noches de verdad. Sin tope, un bucle dejaba el
año entero reservado y había que limpiarlo a mano, una por una. Ahora son
**5 por hora por IP**, que deja pasar de sobra a alguien que reserva, se
arrepiente y prueba otras fechas. Reusa la tabla `intentos_login`, que ganó una
columna `tipo`: una tabla y una sola limpieza para los dos frenos. **El cupo se
gasta recién con la reserva ya hecha**, no al intentar: un pedido que rebotó
por fecha ocupada no debería penalizar a quien está buscando de buena fe.

**Las pendientes de WhatsApp expiran a los 14 días** (`expirarPendientes()`).
El panel ya avisaba a los 7, pero avisar no alcanza si nadie mira. Toca **sólo**
las de origen `whatsapp` en estado `pendiente`: nunca las pagadas, ni las
cargadas a mano, ni los bloqueos. Y no borra: las marca `cancelada` con una nota
que explica por qué, así quedan a la vista en el filtro "Canceladas" y se pueden
volver a cargar. El barrido va colgado del pedido más frecuente del sitio
(`nochesOcupadasPublicas`), como mucho una vez cada diez minutos por instancia,
para no sumar un cron por algo que se mide en días.

**El orden de escritura de `guardarReserva` se dio vuelta.** El driver HTTP de
Neon manda cada sentencia en su propia transacción, así que entre las dos
escrituras la función puede morir. Con el orden anterior —noches primero— eso
dejaba **noches bloqueadas sin ninguna reserva asociada**: invisibles en el
panel (que lista desde `reservas`) e imposibles de liberar sin entrar a la base
a mano. Ahora se anota la reserva primero, así lo que puede quedar huérfano es
una reserva que no bloquea sus noches: se ve en el panel y se da de baja de un
clic. De los dos, es el único que se arregla sin ayuda. (Un `transaction()` de
verdad no sirve acá: hay que mirar el resultado del primer INSERT para decidir
si se sigue.)

**El esquema se crea en un solo viaje.** Eran once sentencias con su `await`
cada una: once round-trips a Neon en cada arranque en frío, justo antes de la
primera reserva del día. Ahora van en un `db.transaction([...])`.

**`nochesPagadas()` filtra a `noche >= current_date - 1`.** `ocupadas` no se
limpia nunca; sin el filtro esa consulta crecía para siempre.

Y en `index.html`, el `<img id="lb-img" src="">` del visor perdió el `src`
vacío: con la cadena vacía el navegador pide la URL de la propia página, un
pedido de más en cada visita.

### Lo que se revisó y está bien

Vale dejarlo escrito para no volver a dudarlo: **la carrera de dos personas
reservando la misma noche está resuelta**, y `CONTEXTO.md` era más pesimista
que el código. La clave primaria `(planta, noche)` **es** el lock atómico:
Postgres serializa los dos INSERT, el segundo recibe menos filas de las que
mandó, deshace lo suyo y responde 409. No hay sobreventa. Con Mercado Pago es
distinto a propósito: si dos pagan a la vez se cobran las dos (`forzar`) porque
la plata no se des-cobra, y el panel muestra la superpuesta.

`lib/reservas.js` usa `@neondatabase/serverless`, que habla por HTTP en vez
de mantener una conexión TCP abierta — lo que conviene en una función
serverless, donde cada invocación es corta. Las cuatro tablas (`ocupadas`,
`reservas`, `pagos_vistos`, `intentos_login`) se crean solas la primera vez
que hace falta (`asegurarTablas`); no hay que correr ninguna migración a
mano, y las columnas nuevas se agregan con `ADD COLUMN IF NOT EXISTS`.

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
7. **`ADMIN_PASSWORD`**, como variable de entorno del proyecto en Vercel — la
   contraseña para entrar a `/admin`. Larga y al azar: con ella se cancelan
   reservas y se ven los datos de los huéspedes. Sin esto cargado el panel no
   abre. (Reemplazó a `ADMIN_TOKEN`, que ya no se lee — ver §6.c.)

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

## 6.c El panel de administración (`/admin`, 16/08/2026)

`admin.html` se rehízo entero. Antes era una herramienta para marcar celdas y
descargar un archivo; ahora es el lugar donde se gestionan las reservas.

### Cómo se entra

`vercel.json` ya tiene `cleanUrls: true`, así que `/admin` sirve `admin.html`
sin configurar nada más.

La autenticación va por **cookie de sesión firmada** (`lib/sesion.js`), no por
la clave suelta en cada pedido como antes. La clave viaja una sola vez, en el
POST a `/api/admin/sesion`, y se canjea por una cookie `httpOnly` que el
JavaScript de la página **no puede leer**. Antes la clave se guardaba en
`localStorage` y a veces viajaba en la URL (`?clave=...`), que queda escrita
en el historial del navegador, en los logs del servidor y en el `Referer` de
cualquier link que se abra desde ahí.

La llave de la firma se deriva de la propia contraseña, así que **cambiar
`ADMIN_PASSWORD` cierra todas las sesiones abiertas** — a propósito, y evita
tener que rotar un segundo secreto.

`/api/admin/sesion` cuenta los intentos fallados **en la base**, no en
memoria: cada invocación serverless puede caer en una instancia distinta, así
que un contador en memoria no frenaría nada. A los 8 fallos en 15 minutos, esa
IP queda afuera.

> **Lo importante:** esconder `admin.html` no protege nada — el HTML es
> público y no pasa nada con eso. Lo que protege es que **cada** endpoint de
> `/api/admin/` llame a `exigirSesion()` antes de contestar. Si alguna vez se
> agrega un endpoint nuevo ahí adentro, esa línea no es opcional.

### El bug de la sobreventa silenciosa

`ocupadas` tiene clave primaria `(planta, noche)`: una noche, un dueño. Eso es
lo que impide vender dos veces la misma fecha. Pero el insert usaba
`ON CONFLICT (planta, noche) DO NOTHING` **sin mirar el resultado**, así que
cuando dos reservas se pisaban, la segunda se guardaba igual y sin error. La
sobreventa quedaba en la base y nadie se enteraba.

Ahora el insert va con `RETURNING` y se compara cuántas noches volvieron
contra cuántas se mandaron. Si faltan, hubo choque:

- **Reserva normal** (web o carga manual): se deshace lo que entró y se
  responde 409. La base es el árbitro final, no el chequeo previo — entre
  consultar disponibilidad y guardar hay una ventana donde otro puede
  meterse.
- **Pago de Mercado Pago** (`forzar: true`): se guarda igual. La plata ya se
  cobró y eso no se puede deshacer; lo correcto es registrar la reserva y que
  el panel la muestre, no perderla.

### `reasegurarNoches()`: la consecuencia del punto anterior

Cuando una reserva se fuerza superpuesta, sus noches en conflicto siguen
figurando **a nombre de la primera** (porque el `INSERT` no las pudo tomar).
Si después se cancela la primera, el `DELETE ... WHERE reserva_id = X` libera
esas noches y la segunda reserva queda existiendo pero sin ocupar nada: el
sitio público las vería libres.

Por eso `cancelarReserva()` termina llamando a `reasegurarNoches()`, que
vuelve a marcar las noches que otra reserva activa superpuesta todavía
reclama. **Esto se descubrió probándolo, no leyéndolo** — el primer intento de
arreglo pasó el test de "cancelar libera las fechas" y falló el de "cancelar
no le roba las fechas a la otra reserva".

Si alguna vez se toca `ocupadas`, tener presente el modelo: `reservas` es la
verdad, `ocupadas` es un índice que además sirve de candado.

### Qué puede hacer el panel

- **Calendario del año** con los estados en color, y la rayita naranja abajo
  para "pendiente de seña". Es la vista principal a propósito: la pregunta
  real de Naty es "¿está libre tal finde?", no "listame los registros".
- **Cargar reservas a mano** (teléfono, WhatsApp, en persona). El precio se
  calcula desde la tarifa **pero es editable**, y una vez que se edita el
  formulario deja de pisarlo: las reservas por teléfono suelen tener precio
  arreglado aparte, y un formulario que te corrige el número es inusable.
- **Bloquear fechas sin huésped** (`origen: 'bloqueo'`), que es lo que
  reemplazó al viejo archivo.
- **Confirmar, editar (cobrado/nota) y dar de baja.**
- **Aviso de pendientes vencidas**: las reservas por WhatsApp bloquean la
  fecha apenas se mandan, pero esa seña puede no llegar nunca. A los 7 días el
  panel las trae arriba de todo. Sin eso, se comen disponibilidad en silencio.

Todo funciona en el celular (la hoja de detalle se ancla abajo, el calendario
pasa a una columna, las celdas quedan de ~41px).

---

## 6.d Precios y textos editables (16/08/2026)

`config.js` sigue siendo la base y lo único versionado en Git. Encima se
aplican los cambios guardados desde el panel, que viven en la tabla
`contenido` (una fila por campo, con el camino dentro de CONFIG como clave:
`temporadas.alta.precios.completa`).

Se descartó el camino de "el panel commitea a GitHub": obliga a guardar un
token con permiso de escritura sobre el repo, que es un secreto bastante más
peligroso que el de la base — si se filtra, se pierde el repositorio entero.
Además, con este esquema una caída de Neon no rompe nada: se ve lo de
`config.js`, viejo pero válido.

### El catálogo es uno solo

`js/contenido.js` es dual (navegador + `require`), igual que `precios.js`.
Define **qué se puede editar, con qué tipo y qué límites**, y lo usan tanto el
panel como la validación del servidor. Si fueran dos listas, el panel dejaría
guardar cosas que el servidor rechaza (o peor, al revés).

El catálogo se **deriva de CONFIG**: los precios salen de recorrer
`temporadas × modalidades`, así que si mañana se agrega una temporada aparece
sola en el panel sin tocar nada.

Lo que no está en el catálogo no se puede escribir aunque se mande el pedido a
mano. Quedaron afuera a propósito `modalidades` (define qué planta ocupa cada
alquiler; tocarlo rompe el cálculo de disponibilidad) y `legales`.

Los textos se insertan con `innerHTML`, así que al validar se les sacan `<` y
`>`. Ninguno necesita HTML.

### Deshacer un cambio

`Contenido.aplicar()` guarda una foto de los valores originales la primera vez
que corre, y **restaura desde esa foto antes de aplicar los overrides**. Sin
eso, borrar un campo de la tabla no lo devolvería a su valor de `config.js`:
se quedaría con el último valor que llegó a tener. En el panel esto es el
"volver al original", que borra la fila.

### Cómo llega al visitante sin frenar la página

`Contenido.preparar(config, opciones)`:

- **Inicio**: si hay copia de una visita anterior se aplica al instante y la
  página pinta sin esperar; la versión fresca se busca en paralelo y sólo se
  repinta si de verdad cambió algo. En la primera visita se espera un poco
  (`BLOQUEO_MAX`, 900 ms) antes de pintar.
- **`{ esperar: true }`** en `reserva.html` y `checkout.html`: ahí se muestra
  plata y se espera la respuesta sí o sí. Mostrar un importe y después cobrar
  otro es peor que tardar medio segundo más.

**El detalle que importa:** el tope de espera decide **cuánto se demora la
pintura, no si el dato se usa**. La primera versión abortaba el pedido al
vencer el tope, y con una conexión lenta el visitante se quedaba con los
precios viejos sin enterarse nunca — se descubrió probando en local, donde el
pedido tardaba 1184 ms contra un tope de 900. Ahora el pedido sigue vivo y se
aplica (repintando) cuando llega.

### Tres pestañas, no una lista larga (18/08/2026)

"Precios y textos" era una sola columna con los 26 campos del catálogo, uno
abajo del otro, agrupados nada más que por la etiqueta de `grupo`. Un precio y
el título de la home pesaban lo mismo en la pantalla.

Ahora se parte en tres, con un segundo nivel de pestañas dentro de la vista:

| Pestaña | Qué lleva | Cómo se muestra |
|---|---|---|
| **Precios** | los 12 campos `temporadas.*` | una tabla |
| **Textos** | los 5 de prosa | campos anchos, uno abajo del otro |
| **Datos** | contacto y reglas (9) | campos angostos en grilla |

**La tabla es el cambio que más se nota.** Los precios se miran comparando —una
temporada contra otra, una modalidad contra otra— y en cajas sueltas por
temporada esa comparación no existía: había que recordar el número de arriba
mientras se leía el de abajo. Filas = modalidades, columnas = temporadas, y el
mínimo de noches abajo separado por una línea, porque no es plata y no tiene
que leerse como una modalidad más.

Detalles que no son cosméticos:

- **`seccionDe()` clasifica por el camino (`temporadas.…`), no por la etiqueta
  del grupo.** El grupo es texto para mostrar y podría cambiar; el camino no.
- **Los ejes de la tabla salen del catálogo, no de CONFIG** (`ejesPrecios()`
  los saca de los propios caminos). Así la tabla muestra exactamente lo que el
  servidor acepta editar, y no aparece una celda muerta si algo quedó afuera.
- **La primera columna es `sticky`.** En el celular la tabla se desplaza a lo
  ancho dentro de su caja —la página nunca desborda— y sin eso se perdería de
  vista qué modalidad se está editando.
- **En la tabla no hay etiqueta visible**: se la dan los encabezados de fila y
  columna, así que el nombre accesible va por `aria-label` con las dos cosas
  ("Casa completa, Temporada alta") y el "volver al original" queda como un
  icono chico. Por lo mismo, el `confirm` de volver al original agrega la
  temporada: la etiqueta sola ("Casa completa") se repite en las tres columnas
  y no diría cuál.
- **El punto naranja en la pestaña** marca dónde quedaron cambios sin guardar.
  Cambiar de pestaña **no** los pierde (los pendientes viven en el estado, no
  en el DOM), y sin ese punto no habría forma de saber que quedó algo tocado en
  otra pestaña.

**Cuidado si se agregan campos:** el listener de edición ubica la caja del
campo con `closest('[data-caja]')` y no con `.campo-ed`. Las celdas de la tabla
no son `.campo-ed`, y buscando esa clase `closest` devuelve `null` y rompe al
tipear. Cualquier control nuevo tiene que llevar `data-caja` en su contenedor.

### Cuándo rige cada temporada (18/08/2026)

Los rangos pasaron de `{ desde, hasta }` a `{ nombre, desde, hasta }` y ahora se
editan desde el panel, en una pestaña **Fechas** propia (separada de Precios:
"cuándo rige" y "cuánto sale" son dos preguntas distintas, y juntas hacían una
pestaña larguísima).

**Hay dos clases de rango y el más específico gana:**

| Clase | Formato | Vale |
|---|---|---|
| Fijo | `MM-DD` | todos los años. Si `hasta < desde`, cruza el año (`12-20 → 02-29`) |
| Con año | `AAAA-MM-DD` | sólo ese año, y **le gana al fijo** |

Eso resuelve lo que el modelo viejo no podía expresar: Semana Santa y los fines
de semana largos **se mueven de fecha cada año**, así que no se pueden escribir
como `MM-DD`. La regla de precedencia evita tener que partir un mes en dos para
hacerle un agujero: se le pone la excepción encima, como en un evento repetido
de calendario. `temporadaDe()` (`js/precios.js`) recorre primero los rangos con
año y después los fijos.

Los fines de semana largos argentinos los fija el gobierno por decreto, así que
no se pueden calcular: hay que cargarlos una vez al año. La fecha de Pascua sí
se puede calcular, si alguna vez conviene sugerirla.

**El bug que apareció al mirar esto:** la temporada alta terminaba el `02-28`.
En un año bisiesto el **29 de febrero no caía en ninguna temporada** y se cobraba
al precio del fallback (media) en plena temporada alta. Se corrigió a `02-29`,
que en los años no bisiestos simplemente no coincide con ninguna noche. El
próximo bisiesto es 2028.

**`revisarCobertura()` es la pieza que hace esto responsable.** Recorre los 366
días de un año bisiesto y comprueba que los rangos fijos cubran el año
**exactamente una vez**. Es la única comprobación del catálogo que cruza las
tres temporadas, así que no puede hacerla la validación campo por campo:

- una noche **sin** temporada se cobra al precio del fallback;
- una noche en **dos** temporadas cobra la que esté primera en el array.

Las dos son formas de cobrar mal sin que nadie se entere, y es exactamente el
error que un editor de rangos multiplicaría. Corre en dos lugares: en el panel
mientras se edita (aviso verde/rojo arriba de la pestaña Fechas, con los días
concretos) y en `api/admin/contenido.js` antes de guardar, que rechaza el
cambio entero. Los rangos con año no cuentan para la cobertura: son excepciones
y se espera que pisen.

`revisarRango` comprueba lo que cruza dos sub-campos de la misma ficha (que las
dos fechas sean del mismo tipo; que con año `desde` no quede después de
`hasta`). Se nombra con un string en el esquema (`revisarItem: 'rango'`) y no
con la función directamente, porque **el catálogo viaja al panel como JSON y una
función no sobrevive a `JSON.stringify`**.

Se agregó también `temporadas.<id>.periodo`, el texto que se muestra ("Enero,
febrero, Semana Santa…"). **Ese texto y los rangos pueden desincronizarse, y de
hecho lo estaban**: decía "Semana Santa" cuando no había ningún rango para
Semana Santa, y no mencionaba el 20 al 31 de diciembre, que sí es alta. Ahora
que cada rango tiene nombre, ese texto se podría generar en vez de escribirlo
aparte — queda pendiente.

### Las fechas móviles ya cargadas (18/08/2026)

Quedaron cargadas en temporada alta, con año, las Semanas Santas de 2027 y 2028
y los fines de semana largos de lo que queda de 2026 y de 2027. **Las fechas
están verificadas; que esos días sean temporada alta es una decisión de precio**
y se cambia desde /admin → Fechas sin tocar código.

Cómo se verificó cada cosa, porque no todas se comprueban igual:

- **Semana Santa se calcula.** Es la única fecha móvil del calendario argentino
  que se puede deducir. `Contenido.semanaSanta(año)` usa el algoritmo de
  Meeus/Jones/Butcher y devuelve de jueves santo a domingo de Pascua. Contrastado
  contra años conocidos (2024: 31/3, 2025: 20/4, 2026: 5/4, 2027: 28/3).
- **Los feriados trasladables y los "puentes" no se pueden calcular**: los fija
  el gobierno por decreto cada año. Salieron del calendario oficial y se
  verificó que cada fecha caiga en el día de la semana que corresponde.

**En 2027 la Semana Santa son cinco días**, no cuatro: el miércoles 24 es el Día
de la Memoria y el jueves 25 no laborable, pegados al Viernes Santo. Por eso ese
rango arranca el 24 y no el 25 que devuelve el cálculo.

**El panel calcula la próxima Semana Santa solo.** En la pestaña Fechas hay un
botón "+ Semana Santa AAAA" que ofrece el primer año que falte y lo agrega con
las fechas ya puestas — así no hay que volver a cargarlas a mano cada año.
Compara **por solapamiento y no por fecha exacta**: un rango cargado a mano
puede arrancar antes (como el de 2027) y sigue siendo la misma Semana Santa.

**El mínimo de temporada alta bajó de 3 a 2 noches**, justamente por esto: con
3, un finde largo de sábado a lunes (2 noches) quedaba rechazado — en las fechas
que más se piden. Ahora las tres temporadas piden 2.

Y al tocarlo apareció una duplicación: el número estaba escrito **dos veces**,
en `minNoches` y a mano dentro de `incluye`, que es lo que pinta la tarjeta de
tarifas. Como `minNoches` ahora se edita desde el panel y `incluye` no está en
el catálogo, cambiarlo desde /admin habría dejado la tarjeta mostrando el número
viejo para siempre. Se sacó de `incluye` en las tres temporadas y la tarjeta lo
lee de `minNoches` (`pintarTarifas`, `js/app.js`). **Si se agregan más datos a
`incluye`, que ninguno repita algo que ya viva en otro campo.**

Y los textos de `periodo` se corrigieron: decían "Semana Santa" cuando no había
ningún rango de Semana Santa, y no mencionaban el 20 al 31 de diciembre.

### Colecciones: preguntas y opiniones (18/08/2026)

Hasta acá el catálogo era un mapa plano de `camino → un valor` (un número, un
texto, una lista de textos). Las preguntas frecuentes y las opiniones no entran
en ese molde: cada ítem es un objeto con varios sub-campos, y además hay que
poder **agregar, sacar y reordenar**.

Se agregó el tipo **`coleccion`** (`COLECCIONES` en `js/contenido.js`), con su
esquema de sub-campos. Hoy son `FAQ` (`p`, `r`) y `RESENAS` (`texto`, `autor`,
`fuente`, `fecha`, `estrellas`); sumar `ACTIVIDADES` o `AMBIENTES` es agregar
una entrada más a ese objeto.

Lo que hizo falta resolver, y por qué:

- **La base no se tocó.** La tabla `contenido` guarda `valor jsonb`, así que
  una colección entera entra como un valor más. Fue suerte del diseño anterior,
  pero conviene saberlo antes de inventar una tabla nueva.
- **`validarValor()` se separó de `validar()`.** Los sub-campos se revisan con
  exactamente las mismas reglas que un campo de primer nivel. Si fueran dos
  implementaciones, un texto adentro de una pregunta aceptaría cosas que el
  mismo texto suelto rechaza — incluido el saneo de `<` y `>`.
- **`FAQ` y `RESENAS` no viven adentro de `CONFIG`**: son `const` sueltos de
  `config.js`, y `app.js` y `preguntas-pagina.js` ya se quedaron con la
  referencia al array. Por eso se leen y escriben con `leerCampo`/`escribirCampo`,
  que para colecciones **mutan el array en su lugar** en vez de reasignarlo —
  igual que `aplicarFotos` con `FOTOS`. Gracias a eso "volver al original"
  también funciona para una colección.
- **En Node `listaViva()` devuelve null**, porque `config.js` no está en el
  ámbito de ese módulo. Está bien: el servidor sólo necesita **validar**
  colecciones, no pintarlas.
- **`api/admin/contenido.js` las resuelve aparte.** `leerCamino` no las
  encuentra, así que se leen de los exports de `config.js` y **siempre
  copiando**: en una función serverless el módulo queda cacheado entre
  invocaciones, y devolver (o mutar) el array compartido filtraría los cambios
  de un pedido al siguiente. Es el mismo cuidado que ya tenía `configEfectivo()`.

En el panel van en la pestaña **Textos**, no en una propia: son contenido de
lectura como el resto, y una cuarta pestaña no entra en el celular.

Dos detalles de la interfaz que no son cosméticos:

- **Escribir en un sub-campo no repinta.** Repintar en cada tecla le sacaría el
  foco al campo. Sólo agregar, sacar y reordenar repintan, que son las que
  cambian la cantidad de fichas o su orden.
- **La marca de "modificado" es por ficha, no por colección.** Si se agregó una
  al final, las de arriba no cambiaron y no tienen por qué verse tocadas.

En la revisión previa una colección no se muestra como JSON —no le diría nada a
nadie— sino como `13 preguntas → 14 preguntas` más un resumen (`1 agregada`,
`2 modificadas`, `reordenadas`). El contador solo no alcanzaba: al editar el
texto de una pregunta, "13 → 13" parecería que no cambió nada. Y el caso de
sólo reordenar se detecta comparando el conjunto de fichas, porque si no se
reportaría como "13 modificadas".

### Revisar antes de publicar (18/08/2026)

"Guardar cambios" guardaba directo, y la única señal era el contador de la
barra ("3 cambios sin guardar") — que dice **cuántos**, no **cuáles**. En una
pantalla con 26 campos, tocar un precio de más y no enterarse es fácil.

Ahora el botón dice **"Revisar y publicar"** y abre la hoja con la lista de
viejo → nuevo, campo por campo, antes de tocar la base. Reusa `abrirHoja()`,
así que no hay pantalla nueva que mantener.

- Los **precios se muestran con formato de plata** y con la temporada al lado
  ("Casa completa · Temporada alta"); el mínimo de noches y el % de seña, no,
  porque no son plata.
- Los **textos largos y las listas van apilados**, con el viejo y el nuevo en
  bloques de color, porque un tachado sobre un párrafo entero es ilegible.
- El error de publicación va **dentro de la hoja** y ya no en un `alert`: así
  queda a la vista junto a la lista de lo que se estaba por publicar.

### Las fotos de la portada (18/08/2026)

Se agregó una marca **"En la portada"** en las fotos que salen en el mosaico
del inicio, y un botón **"llevar al principio"** además de las flechas.

**La marca no es un adorno, y la idea original era otra.** Se había pensado
poner una línea divisoria después de la posición 8 ("hasta acá se ven en la
portada"), dando por sentado que el mosaico eran las 8 primeras de la lista. No
lo son: `fotosDestacadas()` toma hasta 3 de cada categoría en un orden fijo
(entorno, aire libre, casa, interiores) y recién ahí corta en 8. Con la galería
de hoy, las 8 de la portada están en las posiciones **1, 2, 25, 26, 27, 40, 41
y 42**. La línea habría sido activamente engañosa.

Por eso la función **se mudó de `app.js` a `contenido.js`**
(`Contenido.fotosDestacadas(lista)`): el panel necesita exactamente la misma
cuenta para marcar bien, y dos copias se desincronizan al primer cambio — el
mismo criterio por el que `precios.js` es dual. `app.js` la sigue llamando con
el mismo nombre, pasándole `FOTOS`.

El botón "llevar al principio" existe porque con 56 fotos moverlas con las
flechas son cincuenta y pico de toques; en el celular, que es donde se usa
esto, directamente no se hace. De paso, en el celular los botones del pie de
cada tarjeta pasaron de 26px a 40px de alto: con tres flechas pegadas, errarle
a la de al lado era muy fácil.

### La vista previa (`/?preview=1`, 18/08/2026)

Editar precios y textos a ciegas era el reclamo concreto: los campos del panel
("Bajada del inicio", "Aclaraciones debajo de las tarifas") no dicen nada si no
se ve dónde caen en el sitio.

Se resolvió con lo que cualquier CMS llama **draft mode**: entrando a
`/?preview=1`, el sitio se pinta con un borrador que el panel deja en
`localStorage` (`bda-contenido-preview`) en vez de con lo publicado. El botón
**"Ver cómo queda"** de la pestaña "Precios y textos" escribe ese borrador y
abre la vista previa en otra pestaña (siempre la misma, por el nombre de
ventana). Mientras se sigue editando, el borrador se reescribe con 400 ms de
retardo y la otra pestaña se entera por el evento `storage`.

Cuatro decisiones que conviene no deshacer sin pensarlas:

- **Se recarga entera, no se repinta.** Es lo que más problemas evita. El
  sitio no tiene framework ni estado que perder, así que recargar desde caché
  es instantáneo y vuelve a pasar por el mismo camino de siempre. Un repintado
  parcial reviviría el bug del `IntersectionObserver` de `.revelar` (§3,
  "Animaciones"), que ya apareció dos veces.
- **No se lee el caché de `bda-contenido`.** Si se aplicara primero lo
  cacheado y encima el borrador, habría un parpadeo justo en el momento en que
  alguien está mirando si su cambio quedó bien. Es la misma regla que sigue
  Next.js en draft mode: saltear el caché, no invalidarlo. Sí se sigue pidiendo
  `/api/contenido`, porque de ahí salen las fotos — el borrador lleva sólo
  textos y precios.
- **El borrador es el conjunto completo, no el diff.** El panel manda
  `{...guardados, ...pendientes}`. Así la otra pestaña aplica una sola cosa en
  vez de combinar el borrador con lo que conteste el servidor, que es
  exactamente donde aparecerían las carreras.
- **Es seguro por construcción, no por permisos.** El borrador vive en el
  `localStorage` de quien edita, así que un visitante cualquiera que entre a
  `/?preview=1` no tiene nada guardado y ve el sitio normal. No hay endpoint
  nuevo ni nada que proteger. La cinta naranja fija abajo está para que nadie
  confunda la vista previa con el sitio publicado.

El borrador se reescribe al guardar, al descartar y al volver un campo al
original (todos pasan por `cargarContenido()`), y **se borra al cerrar
sesión** — es texto sin publicar, y una pestaña olvidada lo seguiría mostrando
después de haber salido. `refrescarPreview()` sólo reescribe si la clave ya
existe: si nadie abrió nunca la vista previa, el panel no deja nada en el
navegador.

Esto es a propósito **el escalón más bajo** de las cuatro capas que usa la
industria (formulario pelado → preview en otra pestaña → panel partido con
iframe → clic-para-editar sobre la página). Se eligió así porque las capas de
arriba se construyen todas encima de ésta: si algún día se quiere el iframe al
costado, no hay que tirar nada. Y porque de los ~20 campos del catálogo sólo
cinco son prosa (`heroTitulo`, `heroBajada`, `casaTitulo`, `casaTexto`,
`notasTarifas`); a un precio o a un email no se le previsualiza nada. Ningún
CMS grande le puso preview a la pantalla de configuración.

Si alguna vez se pasa al iframe embebido, revisar antes las cabeceras de
`vercel.json`: una CSP estricta bloquea el embebido, que es el problema con el
que se choca todo el mundo al hacer esto.

### Y del lado del servidor

`lib/contenido.js` expone `configEfectivo()`, que devuelve **una copia** de
CONFIG con los overrides aplicados. Copia y no el objeto compartido: en una
función serverless el módulo queda cacheado entre invocaciones, y mutar el
original filtraría los cambios de un pedido al siguiente.

Todo lo que cotiza o cobra tiene que usarlo: `api/crear-pago.js`,
`api/reservar.js` y el alta manual de `api/admin/reservas.js` ya lo hacen. Si
alguna usara el CONFIG crudo, el servidor calcularía con los precios viejos
mientras el visitante ve los nuevos.

(`api/webhook-mercadopago.js` usa CONFIG sólo para `modalidadPorId`, que lee
`modalidades` — no editable. Ahí el CONFIG estático está bien.)

### Caché

`/api/contenido` va con
`max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=600`:
el navegador pregunta siempre (le sale un 304 barato) y el borde de Vercel
absorbe el tráfico. Sin el `max-age=0` explícito los navegadores aplican un
plazo propio y un cambio de precio podría tardar en llegarle a quien ya
visitó el sitio.

Ese mismo endpoint devuelve también la galería (`fotos`), en el mismo pedido:
las dos cosas se necesitan en el mismo momento —antes de pintar— y no tiene
sentido pagar dos viajes.

---

## 6.e La galería editable (16/08/2026)

Las 56 fotos de siempre viven en `img/` y están listadas en `FOTOS`
(config.js). **Mientras la tabla `fotos` esté vacía, la galería es exactamente
esa**: no cambia nada.

### Importar en vez de reemplazar

Desde el panel hay que "pasar la galería al panel" una vez. Eso copia cada
foto de config.js a una fila que **apunta al mismo archivo de `img/`** — no se
mueve ni se duplica nada. A partir de ahí manda la base: se puede sumar,
sacar, reordenar y cambiar epígrafes. Vaciar la tabla vuelve todo a config.js.

Se hizo así en vez de que la base pise a config.js desde el arranque porque el
paso explícito deja claro qué manda en cada momento, y porque "volver a la
galería original" tiene que ser un botón, no una restauración desde un backup.

### Dónde van las fotos nuevas

En **Vercel Blob**, no en `img/`: el servidor no puede escribir en su propio
código. Requiere crear un Blob store en el proyecto (Storage → Create Database
→ Blob), lo que inyecta las variables solo. Si faltan, el panel lo dice con esa
instrucción exacta y **deja igual reordenar, editar y sacar** — sólo se bloquea
subir.

**Qué variables inyecta cambió (19/08/2026), y `haySubidaDeFotos()` (`lib/fotos.js`)
tiene que reconocer las dos formas.** Antes Vercel ponía `BLOB_READ_WRITE_TOKEN`
al conectar un store; ahora usa OIDC por defecto (token de corta vida, más
seguro) y pone `VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`. El SDK de `@vercel/blob`
entiende las dos —`put()`/`del()` no cambian—, pero el chequeo sólo buscaba la
variable vieja: el panel decía "no se puede subir" con la subida en realidad
andando. Se vio en vivo, con un store recién conectado que traía las dos
variables nuevas. El chequeo ahora es
`BLOB_READ_WRITE_TOKEN || (VERCEL_OIDC_TOKEN && BLOB_STORE_ID)`.

**El store va público, no privado.** Vercel agregó los blobs privados después
de que se escribió esto, y al crear el store ahora hay que elegir. Las fotos
las carga el navegador del visitante con `<img src>`, y un store privado
entrega URLs `*.private.blob.vercel-storage.com` que sólo se leen con el SDK y
un token: las fotos no se verían. Por eso `api/admin/fotos.js` las sube con
`access: 'public'`. Acá no hay nada sensible que proteger — son las fotos de la
casa que se muestran en el sitio.

Se eligió Blob antes que guardar las imágenes en Postgres: son binarios
grandes, inflan los backups y Neon sirve para datos, no para archivos. Y antes
que commitearlas a GitHub, por lo mismo del token (ver §6.d).

### El navegador achica antes de subir

`achicarFoto()` en admin.html reduce a 1800px (grande) y 760px (miniatura) con
un canvas, y sube JPEG. Probado con una foto de 4032×3024: sale 1800×1350 y
760×570 en ~250 ms.

Sin esto: Naty sube desde el celular, donde una foto pesa 8 MB, no entraría en
el límite de 4,5 MB que tiene el cuerpo de un pedido en Vercel, y el sitio
terminaría sirviéndole imágenes de 4000px a cada visitante.

`createImageBitmap(archivo, { imageOrientation: 'from-image' })` respeta la
rotación que guarda la cámara. Sin esa opción, las fotos sacadas de costado se
suben acostadas.

La imagen viaja como data URL dentro del JSON. Es 33% más pesado que mandar
los bytes crudos, pero ya viene reducida y así no hay que parsear multipart.

### `IMG()` y `THUMB()` ahora aceptan dos cosas

El nombre corto de una foto de `img/` (como siempre) **o el objeto entero** de
la galería, que si se subió trae sus propias urls. Así ni el mosaico, ni la
grilla, ni el visor, ni el overlay tuvieron que enterarse de dónde salió cada
foto.

### El repintado tiene que incluir la galería

`pintarDesdeConfig()` en app.js incluye `pintarGaleria`, `aplicarVarianteGaleria`
y `pintarTodasLasFotos` — respetando el filtro y la variante activos. **Esto se
descubrió probando:** al principio sólo repintaba textos, así que `FOTOS` se
actualizaba pero la grilla seguía mostrando el orden viejo hasta recargar.

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

### Del panel y las reservas (18/08/2026)

- **Todo lo que muestre datos de una reserva va con `escapar()`.** Los datos del
  huésped entran por `/api/reservar`, que es público y no los valida. Ahí ya
  hubo un XSS.
- **`guardarReserva` escribe la reserva ANTES que las noches.** Al revés, un
  fallo entre las dos escrituras deja noches bloqueadas que no se ven ni se
  pueden liberar desde el panel.
- **La vista previa recarga la página entera en vez de repintar.** Un repintado
  parcial revive el bug del `IntersectionObserver` de `.revelar`, que ya
  apareció dos veces.
- **La disponibilidad no se toma del caché de `localStorage`.** Es lo único del
  contenido que caduca de verdad: una noche libre ayer puede estar vendida hoy.
- **En el panel, escribir en un sub-campo de una colección no repinta** — se
  perdería el foco. Sólo agregar, sacar y reordenar repintan.
- **El listener de edición busca la caja con `closest('[data-caja]')`**, no con
  `.campo-ed`: las celdas de la tabla de precios no llevan esa clase y `closest`
  devolvería `null`.
- **`revisarItem` se nombra con un string, no con la función.** El catálogo
  viaja al panel como JSON y una función no sobrevive a `JSON.stringify`.
- **Los rangos fijos tienen que cubrir el año exactamente una vez.**
  `revisarCobertura()` lo comprueba en el panel y en el servidor. Una noche sin
  temporada se cobra al fallback; una en dos, la primera del array.
- **Nada en `incluye` debe repetir un dato que ya viva en otro campo.** El
  mínimo de noches estaba en los dos lados y sólo uno era editable.
- **El mosaico de la portada no son las primeras 8 fotos**: se eligen hasta 3
  por categoría. Por eso la cuenta vive en `contenido.js` y la usan el sitio y
  el panel.
