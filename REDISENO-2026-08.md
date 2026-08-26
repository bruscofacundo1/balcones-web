# Rediseño de agosto 2026 — dónde está esto y cómo seguir

**Para quien agarre esto de cero:** es un rediseño visual en curso, vive en la
rama `rediseno-2026-08`, **no está mergeado a `main`** y el sitio en vivo
(`balconesdelarroyo.com.ar`) sigue con el diseño anterior. Hay una preview
publicada de la rama que se actualiza sola con cada push — es el link que se
le vino pasando al dueño para que revise cada cambio:

**https://rediseno-2026-08-balconesdelarroyo-web.ebrusco.workers.dev**

El dueño es Facundo. Trabaja mirando esa preview y contestando con
correcciones puntuales, de a una por vez — no aprueba paquetes grandes de
una. Cuando algo no anda escribe en mayúsculas ("NO FUNCIONA"), no es enojo.
Una vez establecida esta rama como "zona de pruebas", dio luz verde a subir
cada iteración sin volver a pedir permiso en cada commit — pero seguí
avisándole con el link cada vez que subas algo, para que lo pueda revisar.

Este documento es un anexo de `CONTEXTO.md`. La sección 5 de `CONTEXTO.md`
("Decisiones de diseño", 23/08/2026) es un rediseño **anterior y ya
publicado** en `main` (sacar el sistema de variantes A/B, dejar una sola
versión de cada sección). Este documento es el **siguiente** rediseño, sobre
estética pura, y todavía no llegó a `main`.

## 1. Por qué existe esta rama

Con las variantes ya sacadas y el sitio publicado "en limpio", el dueño no
estaba conforme con la estética general y pidió mirar sitios de referencia
del mismo rubro (casas de campo, cabañas de diseño, hoteles boutique
rurales) para sacar ideas concretas — colores, tipografías, tratamiento de
fotos — en vez de rediseñar a ciegas.

## 2. Los sitios de referencia y qué se sacó de cada uno

Se revisaron 13 sitios en el navegador, leyendo estilos computados (no sólo
mirando capturas). Los primeros 3 fueron el punto de partida real — resultó
que **los hizo la misma agencia** (TurisApps), y sus números terminaron
siendo la base de la paleta actual:

| Sitio | Tipografía título | Acento | Radio | Hero |
|---|---|---|---|---|
| masaguilo.com | Cormorant Garamond 400 | `#867446` (bronce) | 0 | foto fija, texto centrado |
| villadeplan.com | Cormorant Garamond 400 | `#5f7548` (verde) | 0 | foto fija, texto centrado |
| hotelnafarrola.com | Open Sans Condensed 300 | `#261911` (casi negro) | 0 | foto fija |
| casaeterea.com | Vulpa (custom, toda la página) | `#2E3191` sólo en links | 0 | foto fija + buscador embebido |
| unyoked.co | Plain (display) + Pitch (cuerpo) | `#06270B` (verde bosque) | 0 | foto fija centrada + quiz |
| canopyandstars.co.uk | CiraSerif 300 + Roboto | `#56954E` | píldora en el CTA, 0 en el resto | foto + overlay + buscador |
| abaton.es | PatronLight (toda la página) | ninguno (monocromo) | 0 | **video** en loop |
| postcard-cabins (Marriott) | Recoleta + Swiss 721 | crema + oliva | **píldora en botones (52px), 0 en fotos** | foto fija, texto a la izquierda |
| vivood.com | beaufort-pro 300 + neue-haas-unica | ninguno (monocromo) | 0 | **video** + slider |
| ladonaira.com | Proxima Nova (títulos, sans) + EB Garamond (cuerpo, serif — invertido) | `#655353` (malva) | 14px | **video** + cita superpuesta |
| sonblancmenorca.com | Azeret Mono (toda la página) | ninguno (azul puntual) | píldora (42px) | **video** |
| unicohotels.com (Finca Serena) | Ramillas + Inter | negro sólido `#1C1A17` | 0 | foto fija centrada |
| beckons.com | Reckless + Inter | borgoña `#5F0002`, puntual | 0 | **video** a pantalla completa |

**Patrones que se repiten en casi todos** (y que guiaron las decisiones de
abajo): radio 0 en fotos y tarjetas (12 de 13), ningún acento saturado —
siempre tonos tierra apagados y casi siempre limitado a un solo botón—, cero
gente ni autos en las fotos de las propiedades, y ninguno usa una sola
tipografía genérica (todos invierten en algo con carácter).

El detalle completo (con capturas y notas por sitio) quedó en un Artifact de
Claude ("Especímenes de campo") publicado desde esta conversación — puede no
estar accesible desde otra sesión, así que esta tabla es el resumen que
importa conservar.

## 3. Qué se aplicó ya (en orden, commit por commit)

Todo esto vive en la rama `rediseno-2026-08`:

1. **`2872230`** — Primer paquete de rediseño (venía armado en un zip aparte,
   `balcones-redisenio.zip`, con su propio `REDISENO-2026-08.md` que ya no
   existe como archivo separado): paleta más apagada (terracota `#8a5233`,
   ocre bronce `#867446`), radio 0 en todo, títulos en peso 400 en vez de
   600, tercera tipografía (IBM Plex Mono) para antetítulos y precios,
   portada con carrusel de fotos, franja "por qué reservar acá", mosaico de
   portada mostrando sólo casa + entorno.
2. **`73792ad`** — Portada minimalista: se saca la bajada larga y el segundo
   botón; el `<h1>` pasa a ser literalmente el nombre de la casa
   ("Balcones del Arroyo") y la bajada sólo la ubicación. El logo del nav
   pasa a ir solo (sin el texto "Balcones del Arroyo" al lado) y centrado,
   como unyoked.co. El menú (La casa / Tarifas / Galería / Ubicación /
   Preguntas) deja de mostrarse siempre y pasa a vivir detrás de un botón de
   tres puntos, en cualquier tamaño de pantalla (antes sólo se escondía en
   mobile). "Reservar" queda suelto a la derecha del logo.
3. **`d4cd289`** — Logo más grande (38px → 54px, se veía chico sin el texto
   al lado). El menú deja de bajar desde arriba a todo el ancho y pasa a
   abrirse como un cajón lateral desde la izquierda con un velo oscuro
   detrás (estilo vivood.com), no como superposición sobre la foto de fondo
   (estilo masaguilo.com) — la razón: acá el menú se puede abrir parado en
   cualquier sección, no sólo en la portada, y oscurecer una tabla de
   precios detrás se ve descuidado.
4. **`d7221ce`** — La barra pasa a flotar separada del borde de arriba
   (`--nav-gap: 16px`), en vez de tocarlo. El cajón del menú suma abajo de
   los links la dirección y el WhatsApp (mismos datos que el pie del sitio),
   con overflow-y:auto por si no entra en una pantalla baja.
5. **`8bdc722`** — *(Enfoque descartado, ver el punto 6)*: un intento de
   esconder toda la barra y hacerla reaparecer acercando el cursor arriba.
   No era lo que se había pedido — se sacó en el commit siguiente.
6. **`d4145dd`** — Se reemplaza lo anterior por lo que realmente se pidió: el
   **cajón** del menú se abre solo al pasar el mouse por el botón de puntos
   (sin clickear), y se cierra solo al sacar el mouse — sólo en desktop con
   mouse de verdad (`@media (hover: hover) and (pointer: fine)`); en touch
   el click sigue siendo la única forma, como siempre. De paso se corrigió
   un bug real: el logo no quedaba centrado en el nav porque `grid-template-
   columns: 1fr auto 1fr` deja que la columna con más contenido ("Reservar")
   se quede con más lugar del que le toca — se arregló con
   `minmax(0, 1fr)` en los dos costados.
7. **`81e1c10`** — La barra pasaba a fondo sólido a los 60px de scroll, con
   la foto del hero todavía de fondo detrás: se veía un sánguche
   oscuro-blanco-oscuro. Ahora se pone sólida recién cuando el borde de
   abajo de la foto llega al borde de abajo de la barra (calculado con
   `getBoundingClientRect()` contra `--nav-h + --nav-gap`), igual que en
   masaguilo.com.
8. **`d6da4e6`** — La barra sólida dejaba el mismo hueco de 16px de arriba,
   y ahí se colaba una tira de lo que iba scrolleando (se notaba feo con
   títulos grandes pasando justo por esa franja). Al ponerse sólida, sube y
   se pega del todo al borde (`top: 0`).

## 4. Cómo quedó el criterio de diseño (para no romperlo sin querer)

- **Radio 0** en todo. **Paleta apagada**, un solo acento por vez, siempre en
  el botón, nunca repartido en varios elementos.
- **Cuatro tipografías, cada una con un rol fijo**: Fraunces (títulos),
  Inter (cuerpo), IBM Plex Mono (antetítulos, precios, datos), y **Archivo**
  (nueva, sólo para el botón "Reservar" del nav — imitando la sans de trazo
  grueso que usa unyoked.co en el suyo; su fuente real, "Plain", es paga).
- **Portada sin frases de venta**: el `<h1>` es el nombre, la bajada es sólo
  la ubicación. Nada de "una casa con el valle entero de frente" — ese tipo
  de copy se consideró "muy IA" en esta sesión.
- **Nav**: logo solo (sin texto) y centrado con CSS Grid de 3 columnas
  (`minmax(0,1fr) auto minmax(0,1fr)` — ver el bug de la sección 6). El menú
  vive en un cajón lateral izquierdo con velo, no en un dropdown ni
  superpuesto a una foto. En desktop se abre con hover sobre los puntos, en
  cualquier dispositivo también con click. La barra flota separada del
  borde arriba **mientras está transparente sobre la foto**, y se pega al
  borde **una vez que se pone sólida** (cuando la foto del hero ya pasó
  del todo).

## 5. Pendiente

- **Las 3 fotos que faltan para el carrusel de portada.** El dueño las pasó
  como imágenes pegadas en el chat, no como archivos, así que no se
  pudieron bajar directo (no hay forma de extraer el archivo real de una
  imagen pegada en la conversación). De las 4 que pidió:
  - ✅ La primera (casa amarilla con la camioneta al atardecer) ya está en
    el repo: `img/casa-atardecer.jpg`.
  - ❌ Faltan: otra foto de la casa con un auto oscuro en el garage, una de
    la galería con el atardecer en tonos naranja/amarillo fuerte (columnas
    de madera, piso con mosaico), y una del río con las sierras de fondo y
    un par de zapatillas en la arena (sin gente).
  - Hay que pedirle al dueño que las arrastre directo a
    `Nueva WEB Balcones del arroyo\img\` y diga con qué nombre las guardó.
  - Mientras tanto, `CONFIG.heroFotos` en `js/config.js` sigue con las 4
    fotos viejas (`balcon-atardecer-3`, `casa-fachada`, `sierras-atardecer`,
    `rio-sierras`) y el `<img>` hardcodeado del hero en `index.html` también.
    Una vez estén los archivos nuevos, actualizar los dos lugares (tienen
    que apuntar a la misma foto en la posición 0, ver el comentario en el
    propio HTML).
- **Comentario colgado, no relacionado con esta rama**: en
  `js/contenido.js` línea ~588 todavía dice
  `// Sin esto taparía el botón de variantes, que vive en la misma esquina.`
  — el sistema de variantes se sacó hace rato (commit `70363f7` en `main`).
  Es cosmético, no rompe nada, pero convendría limpiarlo.
- **Ideas anotadas durante la investigación de referencias, no
  implementadas todavía** (están en más detalle en el Artifact mencionado
  arriba):
  - Fotos verticales (~4:5) para las tarjetas de "Cómo se alquila" —
    precedente: La Donaira, Único, Vivood.
  - Nombre propio para cada unidad en vez de "planta alta / planta baja" —
    precedente: La Donaira.
  - Extender el CTA-como-texto-subrayado (ya aplicado en la fila de
    precios) a más lugares, como "ver todas las fotos" — precedente: Vivood.
  - Video en el hero en vez de fotos — **fase 2, no ahora**: 5 de 13
    referencias lo usan, pero el problema de fondo (fotos actuales con
    auto, antena, gente de espaldas) sigue sin resolverse y un video pide
    todavía más producción.
- El dueño no dio ningún "esto ya está terminado" — es trabajo iterativo,
  conviene seguir de a un cambio por vez, subiendo y esperando su ok antes
  de encadenar el siguiente.

## 6. Un detalle de la herramienta de navegador, para no perder tiempo

Durante esta sesión, cuando el panel del navegador (Claude Browser) no está
visible en pantalla, la pestaña **no compositea frames**. Eso hace que
parezcan "no funcionar" varias cosas que en realidad están bien:

- Las **transiciones CSS** quedan congeladas en el frame inicial —
  `getComputedStyle(el).transform` devuelve el valor de ANTES de la
  transición aunque la clase ya haya cambiado.
- **`IntersectionObserver`** puede no disparar el callback nunca.
- Hasta el evento **`scroll`** nativo puede no dispararse tras un
  `window.scrollTo()` programático.

Ninguno de los tres es un bug real del sitio — es la pestaña de prueba sin
compositar. Para verificar algo animado o basado en eventos en ese estado:
forzar `el.style.transition = 'none'` antes de leer el estilo computado, o
replicar el cálculo a mano (con `getBoundingClientRect()`) en vez de confiar
en que el listener/observer disparó. Así se detectó y confirmó el arreglo
del punto 3.6 y 3.7 de más arriba.

## 7. Cómo seguir trabajando esta rama

```bash
git checkout rediseno-2026-08
# editar...
```

Después de cada edición a `css/estilos.css` o a cualquier `.js`/`.html`
enlazado, hay que subir el número de `?v=` en las **7 páginas** que lo usan
(`admin.html`, `arrepentimiento.html`, `checkout.html`, `index.html`,
`legales.html`, `preguntas.html`, `reserva.html`) — hoy está en **`57`**, el
próximo cambio va en `58`:

```bash
for f in admin.html arrepentimiento.html checkout.html index.html legales.html preguntas.html reserva.html; do
  sed -i 's/?v=57/?v=58/g' "$f"
done
```

Probar local con el preview del navegador (nombre `balcones-web` en
`.claude/launch.json`, sirve con `python -m http.server`), después:

```bash
git add -A && git commit -m "mensaje explicando qué cambió y por qué"
git push origin rediseno-2026-08
git checkout main   # para dejar el working tree en el estado de producción
```

La preview de Cloudflare se actualiza sola con cada push a esa rama (ver el
link al principio de este documento) — es lo que se le pasa a Facundo para
que revise.
