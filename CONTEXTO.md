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

**Caché:** los `<script>` y el CSS se cargan con `?v=6`. Cuando publiques un
cambio, **subí ese número** en `index.html` y `reserva.html` o los visitantes
van a seguir viendo la versión vieja.

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

Cuando entre el pago (§6), las funciones serverless van en una carpeta `api/`
en la raíz y Vercel las toma automáticamente — no hace falta cambiar el
`vercel.json`.

---

## 2. Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | La home entera |
| `reserva.html` | Paso 2: qué se alquila, con el precio de cada opción |
| `checkout.html` | Paso 3: detalle, datos y (más adelante) el pago |
| `admin.html` | Panel para cargar la disponibilidad. Genera el texto de `disponibilidad.js` |
| `css/estilos.css` | Todos los estilos |
| `js/config.js` | **Los datos del negocio**: precios, temporadas, textos, contacto, FAQ |
| `js/disponibilidad.js` | Qué noches están ocupadas, por planta |
| `js/variantes.js` | Sistema de variantes (provisorio, ver §5) |
| `js/calendario.js` | Calendario, precios, drawer y modal de reserva |
| `js/app.js` | Arma el resto de la página: galería, carrusel, ambientes, FAQ… |
| `js/reserva-pagina.js` | Lógica de `reserva.html` |
| `js/checkout.js` | Lógica de `checkout.html` |

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
- **Una franja de foto a todo lo ancho** entre secciones, con una frase corta.
  Usa una foto **del entorno**, no de la casa, para no competir con el hero.
- **Radios más chicos** (14px → 6px) en todas las tarjetas.
- **Galería despareja**: cada tanto una foto ocupa el doble de ancho o de alto,
  en vez de la grilla pareja donde todas miden igual.

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

## 5. Las variantes

Varias secciones están hechas de más de una forma para poder compararlas antes
de decidir. Se cambian con el **botón "⚙ Variantes" abajo a la izquierda**, y
la elección queda guardada en el navegador.

| Sección | Variantes | Por defecto |
|---|---|---|
| **Reservas** | `c` modal en pasos · `b` panel lateral, fechas primero · `a` panel lateral, unidad primero | `c` |
| **La casa por dentro** | `a` carrusel · `b` grilla | `a` |
| **La casa y el lugar** | `a` mosaico en 3 niveles · `b` grilla completa | `a` |

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
- **`b` grilla:** todas las fichas juntas (lo que había antes).

El carrusel ocupa muchísimo menos alto, que era el problema: con 15 ambientes
la grilla se hacía eterna, sobre todo en celular.

### La casa y el lugar

Tres niveles, como Booking o Airbnb:

1. **Mosaico** con 8 fotos elegidas (prioriza entorno y aire libre) y un
   `+48 fotos` sobre la última.
2. **Todas las fotos** en chiquito, a pantalla completa y con filtros.
3. **Visor** de una por una, con tira de miniaturas abajo y contador `12 / 56`.

Con 56 fotos, mostrarlas todas de una hacía la home larguísima.

### Cuando decidan

Borrar `js/variantes.js`, el bloque `<div class="variantes">` de `index.html`,
los estilos `.variantes`/`.pvar__*`, y el código de la variante que pierda.
Está todo marcado con comentarios.

---

## 6. Lo que falta

### Cobrar la seña (decidido: Mercado Pago con backend serverless)

Hoy no se cobra nada. El plan acordado:

1. Una función serverless (Netlify Functions o Cloudflare Workers, gratis en el
   tier básico) que genera la preferencia de pago con el monto real.
2. **No se puede hacer sólo desde el navegador**: habría que poner el access
   token de Mercado Pago en el front y cualquiera podría leerlo y emitir cobros
   a nombre del dueño.
3. `checkout.html` **ya recalcula los precios** con `config.js` en vez de
   confiar en el total que le llega, y revalida la disponibilidad. Eso es a
   propósito: es la base para que el monto no se pueda manipular desde el
   navegador. El handler de "Confirmar reserva" en `js/checkout.js` es el punto
   donde se enchufa la llamada a la función serverless.

**Importante:** cobrar online obliga a resolver la disponibilidad automática.
Hoy las fechas ocupadas se cargan a mano en `admin.html`; si alguien paga por
fechas que todavía no se marcaron, hay sobreventa. Hace falta que la reserva
pagada bloquee las fechas sola, o sea una base de datos chica (Supabase o
Netlify Blobs alcanzan).

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
