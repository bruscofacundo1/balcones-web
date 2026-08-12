/* ============================================================================
   BALCONES DEL ARROYO — ARCHIVO DE CONFIGURACIÓN
   ----------------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitás tocar para actualizar el sitio:
   teléfono, redes, precios por temporada, textos y datos de la casa.

   Todo lo que dice  << REVISAR >>  son datos que puse como ejemplo y que
   tenés que reemplazar por los reales antes de publicar.
   ============================================================================ */

const CONFIG = {

  /* -------------------------------------------------------------- contacto */
  contacto: {
    // Número de WhatsApp en formato internacional, SIN +, SIN espacios ni guiones.
    // Ejemplo Córdoba (3544): 549 3544 123456  ->  '5493544123456'
    whatsapp: '5493544000000',                    // << REVISAR >>
    // Cómo se muestra el teléfono en pantalla
    telefonoVisible: '+54 9 3544 00-0000',        // << REVISAR >>
    email: 'balconesdelarroyo@gmail.com',         // << REVISAR >>
    instagram: '',                                 // ej: 'https://instagram.com/balconesdelarroyo'
    facebook: 'https://www.facebook.com/Balcones-del-Arroyo', // << REVISAR >>
    direccion: 'Arroyo de los Patos, Nono, Valle de Traslasierra, Córdoba',
    // Coordenadas aproximadas para el mapa (reemplazá por las exactas de la casa)
    mapa: {
      lat: -31.8060,                              // << REVISAR >>
      lng: -65.0180,                              // << REVISAR >>
      zoom: 13
    }
  },

  /* ------------------------------------------------------ datos de la casa */
  casa: {
    huespedes: 9,           // capacidad total con la casa completa
    dormitorios: 4,         // << REVISAR >> 2 arriba + 2 abajo
    banos: 2,               // uno completo por planta
    plantas: 2,
    cocinas: 2              // una por planta
  },

  /* --------------------------------------------------------- modalidades
     La casa se alquila entera o por planta. Cada planta es independiente:
     tiene su cocina, su baño completo y su acceso.
     `id` se usa también en disponibilidad.js — no lo cambies.               */
  modalidades: [
    {
      id: 'completa',
      nombre: 'Casa completa',
      plazas: 9,
      // Para estar libre necesita las dos plantas libres
      ocupa: ['alta', 'baja'],
      detalle: '2 plantas · 4 dormitorios · 2 baños · 2 cocinas',
      texto: 'Las dos plantas para vos. Ideal para familias grandes o dos familias que viajan juntas.'
    },
    {
      id: 'alta',
      nombre: 'Planta alta',
      plazas: 5,
      ocupa: ['alta'],
      detalle: '2 dormitorios · 1 baño · cocina · galería con vista',
      texto: 'La suite con cama king y el dormitorio de tres plazas, más el living y la galería del atardecer.'
    },
    {
      id: 'baja',
      nombre: 'Planta baja',
      plazas: 4,
      ocupa: ['baja'],
      detalle: '2 dormitorios · 1 baño · cocina · acceso propio',
      texto: 'Dos dormitorios, cocina completa y entrada independiente. Fresca y tranquila.'
    }
  ],

  /* --------------------------------------------------------- reglas básicas */
  reglas: {
    horaCheckIn: '14:00',
    horaCheckOut: '10:00',
    minNochesGeneral: 2,     // mínimo por defecto (cada temporada puede pisarlo)
    mesesVisibles: 12,       // cuántos meses adelante muestra el calendario
    moneda: 'ARS',
    // true  = el precio es por noche de la unidad, sin importar cuántos vengan
    // false = el precio se multiplica por la cantidad de huéspedes
    precioPorUnidad: true,
    // Porcentaje del total que se pide como seña para confirmar la reserva
    senaPorcentaje: 30                            // << REVISAR >>
  },

  /* --------------------------------------------------------------- tarifas
     Cada temporada se define por rangos de fecha que se repiten todos los años
     (formato 'MM-DD'). Si 'hasta' es menor que 'desde', el rango cruza el año
     (por ejemplo 12-20 al 02-28).
     `precios` = valor por noche de cada modalidad.                           */
  temporadas: [
    {
      id: 'alta',
      nombre: 'Temporada alta',
      periodo: 'Enero, febrero, Semana Santa y vacaciones de invierno',
      precios: {                                   // << REVISAR >>
        completa: 180000,
        alta: 110000,
        baja: 90000
      },
      minNoches: 3,
      color: '#b4552f',
      destacada: true,
      rangos: [
        { desde: '12-20', hasta: '02-28' },
        { desde: '07-10', hasta: '07-25' }         // vacaciones de invierno
      ],
      incluye: [
        ['Mínimo de noches', '3'],
        ['Ropa blanca', 'Incluida'],
        ['Servicios', 'Todo incluido']
      ]
    },
    {
      id: 'media',
      nombre: 'Temporada media',
      periodo: 'Marzo, abril, octubre, noviembre y fines de semana largos',
      precios: {                                   // << REVISAR >>
        completa: 140000,
        alta: 85000,
        baja: 70000
      },
      minNoches: 2,
      color: '#d89a4a',
      destacada: false,
      rangos: [
        { desde: '03-01', hasta: '04-30' },
        { desde: '10-01', hasta: '12-19' }
      ],
      incluye: [
        ['Mínimo de noches', '2'],
        ['Ropa blanca', 'Incluida'],
        ['Servicios', 'Todo incluido']
      ]
    },
    {
      id: 'baja',
      nombre: 'Temporada baja',
      periodo: 'Mayo, junio, agosto y septiembre',
      precios: {                                   // << REVISAR >>
        completa: 110000,
        alta: 70000,
        baja: 58000
      },
      minNoches: 2,
      color: '#5c6b4a',
      destacada: false,
      rangos: [
        { desde: '05-01', hasta: '07-09' },
        { desde: '07-26', hasta: '09-30' }
      ],
      incluye: [
        ['Mínimo de noches', '2'],
        ['Ropa blanca', 'Incluida'],
        ['Estadías largas', 'Consultar descuento']
      ]
    }
  ],

  // Aclaraciones que se muestran debajo de las tarifas
  notasTarifas: [
    'Los valores son por noche y por unidad (casa completa o planta), no por persona.',
    'Cada planta tiene su cocina, su baño completo y su acceso independiente.',
    'Incluye ropa de cama y toallas, gas, luz, agua y wifi.',
    'Se abona una seña del 30% para confirmar la reserva y el saldo al ingresar.',
    'Fines de semana largos y Semana Santa se cobran con tarifa de temporada alta.',
    'Los precios pueden actualizarse; confirmá el valor final por WhatsApp.'
  ],

  /* --------------------------------------------------------------- textos */
  textos: {
    heroTitulo: 'Una casa de campo con el valle entero de frente',
    heroBajada: 'Una casa de campo en Arroyo de los Patos, entre Nono y Mina Clavero. ' +
                'Dos plantas independientes para 9 personas —o una sola planta, si son menos— ' +
                'con galerías largas y las Sierras Grandes de frente.',
    casaTitulo: 'Dos plantas independientes, una sola vista',
    casaTexto: [
      'Cada planta funciona sola: tiene su cocina completa, su baño y su acceso propio. ' +
      'Podés alquilar la casa entera para 9 personas, o solamente una de las dos: ' +
      'la planta alta para 5 o la planta baja para 4.',
      'Lo mejor pasa afuera. Las galerías cubiertas miran al oeste, así que el atardecer ' +
      'sobre las sierras se ve desde la mesa, desde la hamaca paraguaya y desde la parrilla. ' +
      'Alrededor hay parque con árboles, espacio para los chicos y silencio de campo.'
    ]
  },

  /* --------------------------------------------------------- comodidades
     Borrá de esta lista lo que no corresponda y agregá lo que falte.        */
  comodidades: [
    'Wifi', 'Una cocina completa por planta', 'Un baño completo por planta',
    'Aire acondicionado frío/calor', 'Calefacción a gas', 'Ventiladores de techo',
    'Agua caliente permanente', 'Agua de red y perforación propia',
    'Asador y parrilla disco', 'Galería cubierta con vista', 'Hamaca paraguaya',
    'Mesa de ping pong', 'Cochera cubierta', 'Ropa de cama y toallas',
    'TV y living amplio', 'Parque con árboles', 'Vestidor en la suite',
    'Acceso independiente por planta', 'Se admiten mascotas',
    'Estacionamiento para varios autos'
  ],

  /* ---------------------------------------------------------- distancias */
  distancias: [
    { lugar: 'Nono', km: '8 km' },                        // << REVISAR >>
    { lugar: 'Mina Clavero', km: '18 km' },               // << REVISAR >>
    { lugar: 'Museo Rocsen', km: '12 km' },               // << REVISAR >>
    { lugar: 'Villa Cura Brochero', km: '22 km' },        // << REVISAR >>
    { lugar: 'Las Calles / Los Hornillos', km: '15 km' }, // << REVISAR >>
    { lugar: 'Villa Dolores', km: '45 km' },              // << REVISAR >>
    { lugar: 'Córdoba capital (por Altas Cumbres)', km: '180 km' }
  ]
};

/* ============================================================================
   AMBIENTES — se muestran en la sección "La casa por dentro"
   planta: 'alta' | 'baja' | 'exterior'
   ============================================================================ */
const AMBIENTES = [
  { foto: 'dorm-principal',   planta: 'alta', titulo: 'Suite principal',
    meta: '2 plazas · Cama king · Vestidor', texto: 'Cama king, tres ventanas al valle y vestidor propio.' },
  { foto: 'dorm-alta-2',      planta: 'alta', titulo: 'Dormitorio de tres plazas',
    meta: '3 plazas · Persianas', texto: 'Amplio, con dos ventanas con persianas y mucha luz de mañana.' },
  { foto: 'living',           planta: 'alta', titulo: 'Living comedor',
    meta: 'Techo de madera', texto: 'El corazón de la planta alta: mesa larga, techo de madera a dos aguas y salida a la galería.' },
  { foto: 'cocina-alta',      planta: 'alta', titulo: 'Cocina de planta alta',
    meta: 'Totalmente equipada', texto: 'Con horno, heladera con freezer, microondas y todo lo necesario para cocinar para varios.' },
  { foto: 'bano-alta',        planta: 'alta', titulo: 'Baño de planta alta',
    meta: 'Completo', texto: 'Baño completo con ducha, bidet y bacha de apoyo.' },
  { foto: 'dorm-baja-1',      planta: 'baja', titulo: 'Dormitorio con cucheta',
    meta: '2 plazas · Cucheta', texto: 'El preferido de los chicos. Cucheta, placard amplio y acceso directo al baño.' },
  { foto: 'dorm-baja-2',      planta: 'baja', titulo: 'Dormitorio de planta baja',
    meta: '2 plazas', texto: 'Tranquilo y fresco, con ventana al parque.' },
  { foto: 'cocina-baja',      planta: 'baja', titulo: 'Cocina de planta baja',
    meta: 'Completa', texto: 'La segunda cocina, la que hace que la planta baja funcione sola.' },
  { foto: 'bano-baja',        planta: 'baja', titulo: 'Baño de planta baja',
    meta: 'Completo', texto: 'Segundo baño completo, para no hacer cola a la mañana.' },
  { foto: 'escalera',         planta: 'baja', titulo: 'Accesos independientes',
    meta: 'Escalera interna y externa', texto: 'Una escalera interna une las plantas y otra externa da entrada propia a cada una.' },
  { foto: 'balcon-atardecer-3', planta: 'exterior', titulo: 'Galería del atardecer',
    meta: 'Vista al oeste', texto: 'La galería larga mirando a las Sierras Grandes. Acá se pasan las tardes.' },
  { foto: 'asador',           planta: 'exterior', titulo: 'Asador y parrilla disco',
    meta: 'Asador de material', texto: 'Asador de material bajo techo y parrilla disco para cocinar al aire libre.' },
  { foto: 'ping-pong',        planta: 'exterior', titulo: 'Mesa de ping pong',
    meta: 'Bajo techo', texto: 'Para los días de siesta larga o cuando refresca.' },
  { foto: 'galeria-hamaca',   planta: 'exterior', titulo: 'Hamaca paraguaya',
    meta: 'En la galería', texto: 'Con la vista del valle de frente. No hace falta explicar mucho más.' },
  { foto: 'garage',           planta: 'exterior', titulo: 'Cochera cubierta',
    meta: 'Varios autos', texto: 'Cochera cubierta amplia y lugar de sobra para estacionar.' }
];

/* ============================================================================
   GALERÍA — categoría: 'casa' | 'interiores' | 'aire-libre' | 'entorno'
   ============================================================================ */
const FOTOS = [
  { f: 'casa-atardecer',      c: 'casa',       t: 'La casa bajo el cielo del valle' },
  { f: 'casa-frente',         c: 'casa',       t: 'Frente de la casa' },
  { f: 'casa-noche',          c: 'casa',       t: 'La casa iluminada de noche' },
  { f: 'casa-fachada',        c: 'casa',       t: 'Fachada completa' },
  { f: 'casa-lateral',        c: 'casa',       t: 'Vista lateral y galería' },
  { f: 'casa-vista-lateral',  c: 'casa',       t: 'Los ventanales de los dormitorios' },
  { f: 'casa-parque',         c: 'casa',       t: 'La casa desde el parque' },
  { f: 'casa-noche-gente',    c: 'casa',       t: 'Noches de encuentro' },

  { f: 'living',              c: 'interiores', t: 'Living comedor de planta alta' },
  { f: 'living-tv',           c: 'interiores', t: 'Estar con TV' },
  { f: 'cocina-alta',         c: 'interiores', t: 'Cocina principal' },
  { f: 'cocina-alta-2',       c: 'interiores', t: 'Cocina equipada' },
  { f: 'cocina-baja',         c: 'interiores', t: 'Cocina de planta baja' },
  { f: 'dorm-principal',      c: 'interiores', t: 'Suite principal con cama king' },
  { f: 'dorm-principal-2',    c: 'interiores', t: 'Suite principal' },
  { f: 'vestidor',            c: 'interiores', t: 'Vestidor de la suite' },
  { f: 'dorm-alta-2',         c: 'interiores', t: 'Dormitorio de tres plazas' },
  { f: 'dorm-alta-3',         c: 'interiores', t: 'Dormitorio de planta alta' },
  { f: 'dorm-alta-4',         c: 'interiores', t: 'Dormitorio de planta alta' },
  { f: 'dorm-baja-1',         c: 'interiores', t: 'Dormitorio con cucheta' },
  { f: 'dorm-baja-2',         c: 'interiores', t: 'Dormitorio de planta baja' },
  { f: 'bano-alta',           c: 'interiores', t: 'Baño de planta alta' },
  { f: 'bano-baja',           c: 'interiores', t: 'Baño de planta baja' },
  { f: 'escalera',            c: 'interiores', t: 'Escalera principal' },

  { f: 'balcon-atardecer-1',  c: 'aire-libre', t: 'Atardecer desde la galería' },
  { f: 'balcon-atardecer-2',  c: 'aire-libre', t: 'La galería al caer el sol' },
  { f: 'balcon-atardecer-3',  c: 'aire-libre', t: 'Luz dorada sobre el valle' },
  { f: 'balcon-atardecer-4',  c: 'aire-libre', t: 'Otro atardecer desde el balcón' },
  { f: 'galeria-hamaca',      c: 'aire-libre', t: 'Hamaca paraguaya con vista' },
  { f: 'galeria-vista',       c: 'aire-libre', t: 'Mañana en la galería' },
  { f: 'balcon-grupo',        c: 'aire-libre', t: 'Mirando el atardecer en familia' },
  { f: 'galeria-mesa',        c: 'aire-libre', t: 'La mesa de la galería' },
  { f: 'galeria-mate',        c: 'aire-libre', t: 'Mates con vista al valle' },
  { f: 'balcon-vista-valle',  c: 'aire-libre', t: 'Vista abierta al valle' },
  { f: 'galeria-perro',       c: 'aire-libre', t: 'Siesta en la galería' },
  { f: 'asador',              c: 'aire-libre', t: 'Asador de material' },
  { f: 'disco-fuego',         c: 'aire-libre', t: 'Parrilla disco al fuego' },
  { f: 'ping-pong',           c: 'aire-libre', t: 'Mesa de ping pong' },
  { f: 'garage',              c: 'aire-libre', t: 'Cochera cubierta' },

  { f: 'rio-vacas',           c: 'entorno',    t: 'El ganado cruzando el río' },
  { f: 'rio-caballos',        c: 'entorno',    t: 'Caballos en el arroyo' },
  { f: 'rio-sierras',         c: 'entorno',    t: 'El río con las sierras de fondo' },
  { f: 'rio-rocas',           c: 'entorno',    t: 'Ollas de agua entre las rocas' },
  { f: 'rio-playa',           c: 'entorno',    t: 'Playita de arena sobre el río' },
  { f: 'barrancas',           c: 'entorno',    t: 'Barrancas de arcilla' },
  { f: 'arroyo-puente',       c: 'entorno',    t: 'Puente sobre el arroyo' },
  { f: 'puente-colgante',     c: 'entorno',    t: 'Puente colgante del río de los Sauces' },
  { f: 'sierras-rosa',        c: 'entorno',    t: 'Las Sierras Grandes al atardecer' },
  { f: 'sierras-atardecer',   c: 'entorno',    t: 'Cordón de las sierras en rosa' },
  { f: 'caballos-campo',      c: 'entorno',    t: 'Caballos en el campo vecino' },
  { f: 'cascada',             c: 'entorno',    t: 'Cascadas en la quebrada' },
  { f: 'lago',                c: 'entorno',    t: 'El embalse de La Viña' },
  { f: 'lechuza',             c: 'entorno',    t: 'Fauna del lugar' },
  { f: 'sendero-jilgueros',   c: 'entorno',    t: 'Sendero Los Jilgueros' },
  { f: 'atardecer-valle',     c: 'entorno',    t: 'El valle al anochecer' },
  { f: 'camino',              c: 'entorno',    t: 'Camino de tierra hasta la casa' }
];

/* ============================================================================
   PREGUNTAS FRECUENTES
   ----------------------------------------------------------------------------
   `p` = pregunta, `r` = respuesta (usá \n para separar párrafos).

   `revisar` es una nota interna para vos: NO se publica en el sitio, sólo
   aparece como aviso en la consola del navegador. Cuando confirmes el dato,
   corregí la respuesta y borrá esa línea.

   Podés agregar, sacar o reordenar preguntas libremente: se muestran en el
   orden de esta lista.
   ============================================================================ */
const FAQ = [
  {
    p: '¿Se puede alquilar una sola planta?',
    r: 'Sí. La casa se alquila entera para 9 personas, o por planta: la planta alta para 5 ' +
       'y la planta baja para 4. Cada planta es independiente, con su cocina completa, su ' +
       'baño y su acceso propio, así que no se comparten ambientes.'
  },
  {
    p: '¿Cuántas camas hay y cómo están distribuidas?',
    r: 'Planta alta: la suite principal con cama king (2 plazas) y un dormitorio de 3 plazas.\n' +
       'Planta baja: dos dormitorios de 2 plazas, uno de ellos con cucheta.\n' +
       'En total, 9 plazas en 4 dormitorios.'
  },
  {
    p: '¿Qué incluye el alquiler?',
    r: 'Ropa de cama y toallas, gas, luz, agua y wifi. Las cocinas están equipadas con ' +
       'heladera, horno, microondas, vajilla y utensilios.',
    revisar: '¿Incluye ropa blanca de verdad o el huésped la trae? ¿Hay lavarropas? ' +
             '¿Se entrega la casa con algún consumible (papel, jabón, leña)?'
  },
  {
    p: '¿Cómo es el ingreso y la salida?',
    r: 'El ingreso es a partir de las 14:00 y la salida hasta las 10:00. Si necesitás otro ' +
       'horario, avisanos antes y vemos si se puede acomodar.'
  },
  {
    p: '¿Cómo se reserva y cómo se paga?',
    r: 'La reserva se confirma con una seña por transferencia bancaria y el saldo se abona ' +
       'al ingresar. Escribinos por WhatsApp con las fechas y coordinamos.',
    revisar: '¿De cuánto es la seña (30%, 50%, una noche)? ¿Qué pasa si el huésped cancela? ' +
             '¿Se pide algún depósito en garantía?'
  },
  {
    p: '¿Se admiten mascotas?',
    r: 'Sí, se admiten mascotas. Solo te pedimos que nos avises al momento de reservar ' +
       'para tenerlo en cuenta.'
  },
  {
    p: '¿Está climatizada? ¿Cómo se calefacciona?',
    r: 'La casa tiene aire acondicionado frío/calor, calefacción a gas y ventiladores de techo, ' +
       'así que se usa cómoda tanto en verano como en invierno.',
    revisar: '¿El aire está en todos los dormitorios o sólo en algunos ambientes? ' +
             '¿Hay aire en las dos plantas?'
  },
  {
    p: '¿Cómo son los servicios? ¿Hay agua caliente siempre?',
    r: 'Sí: hay agua caliente permanente en las dos plantas. La casa tiene agua de red y ' +
       'además perforación propia, así que nunca falta. El gas es envasado y la luz es de red.',
    revisar: '¿El agua es apta para tomar o conviene traer bidón? ' +
             '¿Hay cortes de luz seguido? ¿Hay grupo electrógeno?'
  },
  {
    p: '¿Cómo se llega? ¿Hace falta camioneta?',
    r: 'Se llega por camino de tierra en buen estado, transitable con auto común. ' +
       'Te pasamos la ubicación exacta al confirmar la reserva.',
    revisar: '¿Cuántos km de tierra son? ¿Cómo queda el camino los días de lluvia? ' +
             '¿Hay que cruzar algún vado o arroyo?'
  },
  {
    p: '¿Hay señal de celular y wifi?',
    r: 'Hay wifi en la casa y señal de celular.',
    revisar: '¿Qué compañías andan bien (Personal, Claro, Movistar)? ' +
             '¿El wifi llega a las dos plantas? ¿Hay TV por cable o streaming?'
  },
  {
    p: '¿Se puede hacer asado?',
    r: 'Sí, hay asador de material bajo techo y también parrilla disco. La leña ' +
       'y el carbón corren por cuenta del huésped.',
    revisar: '¿Dejan leña disponible o la compra el huésped? ¿Hay heladera o freezer extra?'
  },
  {
    p: '¿Dónde se hacen las compras?',
    r: 'Nono y Mina Clavero tienen supermercados, verdulerías, carnicerías y farmacias, ' +
       'a pocos minutos en auto. Conviene llegar con lo básico ya comprado.'
  },
  {
    p: '¿Hay lugar para estacionar?',
    r: 'Sí, hay cochera cubierta y espacio de sobra en el parque para varios autos.'
  }
];

/* ============================================================================
   ACTIVIDADES — qué hacer en la zona
   ============================================================================ */
const ACTIVIDADES = [
  { foto: 'rio-playa',        titulo: 'Río y balnearios',      texto: 'Playas de arena y ollas de agua clara a pocos minutos de la casa.' },
  { foto: 'puente-colgante',  titulo: 'Puente colgante',       texto: 'El clásico puente sobre el río de los Sauces, en Nono.' },
  { foto: 'sierras-rosa',     titulo: 'Altas Cumbres',         texto: 'El camino de las Altas Cumbres y la Quebrada del Condorito.' },
  { foto: 'sendero-jilgueros',titulo: 'Senderos y avistaje',   texto: 'Caminatas cortas, aves y sierras a pocos kilómetros.' },
  { foto: 'cascada',          titulo: 'Cascadas y quebradas',  texto: 'Saltos de agua escondidos entre las piedras de la sierra.' },
  { foto: 'lago',             titulo: 'Embalse La Viña',       texto: 'Deportes náuticos y atardeceres sobre el agua.' },
  { foto: 'caballos-campo',   titulo: 'Cabalgatas',            texto: 'Salidas a caballo por los campos y el filo de las sierras.' },
  { foto: 'barrancas',        titulo: 'Museo Rocsen y Nono',   texto: 'Ferias, museos y la vida de pueblo del Valle de Traslasierra.' }
];
