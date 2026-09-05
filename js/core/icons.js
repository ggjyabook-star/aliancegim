/* =============================================================
   ALLIANCE GYM — Catálogo de iconos SVG (AG.Icons)
   -------------------------------------------------------------
   Iconos dibujados a mano, sin librerías ni peticiones de red.
   Estilo uniforme: lienzo 24x24, trazo de 1.8, puntas y uniones
   redondeadas, color heredado con currentColor.

   API pública:
     AG.Icons.get(nombre, tamano, opciones) -> string '<svg …></svg>'
     AG.Icons.lista                         -> array con los nombres
     AG.Icons.existe(nombre)                -> Boolean

   Opciones admitidas por get():
     { relleno: Boolean,  // rellena la figura (estrellas llenas, etc.)
       clase:   String,   // clases extra además de 'ico'
       titulo:  String,   // texto accesible; sin él el icono es decorativo
       grosor:  Number }  // grosor de trazo alterno

   Si se pide un nombre inexistente se devuelve un círculo neutro:
   nunca regresa undefined ni lanza una excepción.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  var VIEWBOX = '0 0 24 24';
  var GROSOR = 1.8;
  var TAMANO = 20;

  /* Círculo neutro para nombres desconocidos. */
  var NEUTRO = '<circle cx="12" cy="12" r="8.4"/>';

  /* -------------------------------------------------------------
     Mapa de iconos. Cada valor es el interior del <svg>.
     El orden de las llaves define el orden de AG.Icons.lista.
     ------------------------------------------------------------- */
  var MAPA = {

    /* --- Navegación y personas --- */

    // Casa con techo a dos aguas y puerta
    inicio:
      '<path d="M3.2 10.4 12 3.2l8.8 7.2"/>' +
      '<path d="M5.4 9.1v10.3a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6V9.1"/>' +
      '<path d="M9.6 21v-6.2h4.8V21"/>',

    // Dos personas: socio al frente y otro detrás
    socios:
      '<circle cx="9" cy="7.6" r="3.6"/>' +
      '<path d="M2.5 20.4v-1.1A5.2 5.2 0 0 1 7.7 14.1h2.6a5.2 5.2 0 0 1 5.2 5.2v1.1"/>' +
      '<path d="M16.6 4.4a3.6 3.6 0 0 1 0 6.4"/>' +
      '<path d="M18 14.3a5.2 5.2 0 0 1 3.5 4.9v1.2"/>',

    // Silbato de entrenador con su argolla
    coach:
      '<circle cx="8.8" cy="13.6" r="5"/>' +
      '<path d="M13.2 11.1h7.2a1.7 1.7 0 0 1 1.7 1.7v1a1.7 1.7 0 0 1-1.7 1.7h-4.6"/>' +
      '<path d="M8.8 8.6V6.6"/>' +
      '<circle cx="8.8" cy="4.9" r="1.7"/>',

    /* --- Entrenamiento --- */

    // Barra olímpica con discos y topes
    pesa:
      '<path d="M2.5 10v4"/>' +
      '<path d="M5.5 7v10"/>' +
      '<path d="M8 9v6"/>' +
      '<path d="M16 9v6"/>' +
      '<path d="M18.5 7v10"/>' +
      '<path d="M21.5 10v4"/>' +
      '<path d="M8 12h8"/>',

    // Mancuerna de cabezas macizas
    mancuerna:
      '<rect x="2.2" y="8.8" width="3.2" height="6.4" rx="1.1"/>' +
      '<rect x="18.6" y="8.8" width="3.2" height="6.4" rx="1.1"/>' +
      '<rect x="5.8" y="10.3" width="2.4" height="3.4" rx="0.9"/>' +
      '<rect x="15.8" y="10.3" width="2.4" height="3.4" rx="0.9"/>' +
      '<path d="M8.2 12h7.6"/>',

    // Corazón (salud y frecuencia cardiaca)
    corazon:
      '<path d="M12 20.6C12 20.6 3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.5 2.5c0 5.8-8.5 11-8.5 11z"/>',

    /* --- Dinero y negocio --- */

    // Billete con moneda al centro
    dinero:
      '<rect x="2" y="6" width="20" height="12" rx="2.4"/>' +
      '<circle cx="12" cy="12" r="2.8"/>' +
      '<path d="M5.6 10.2v3.6"/>' +
      '<path d="M18.4 10.2v3.6"/>',

    // Tarjeta bancaria con banda magnética
    tarjeta:
      '<rect x="2" y="5" width="20" height="14" rx="2.6"/>' +
      '<path d="M2 9.8h20"/>' +
      '<path d="M6 15.2h3.6"/>' +
      '<path d="M12.6 15.2h1.8"/>',

    // Gráfica de barras con eje
    grafica:
      '<path d="M3 20.6h18"/>' +
      '<rect x="5" y="13" width="3.4" height="7" rx="1"/>' +
      '<rect x="10.3" y="7.4" width="3.4" height="12.6" rx="1"/>' +
      '<rect x="15.6" y="10.2" width="3.4" height="9.8" rx="1"/>',

    // Documento con esquina doblada y renglones
    reporte:
      '<path d="M14.2 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V7.8z"/>' +
      '<path d="M14.2 3v4.8H19"/>' +
      '<path d="M9 13.2h6"/>' +
      '<path d="M9 16.9h4"/>',

    /* --- Medición --- */

    // Regla diagonal con marcas
    regla:
      '<path d="M16.2 2.6l5.2 5.2a1.6 1.6 0 0 1 0 2.3L10.1 21.4a1.6 1.6 0 0 1-2.3 0L2.6 16.2a1.6 1.6 0 0 1 0-2.3L13.9 2.6a1.6 1.6 0 0 1 2.3 0z"/>' +
      '<path d="M11.6 4.9 13.3 6.6"/>' +
      '<path d="M9.4 7.1 11.1 8.8"/>' +
      '<path d="M7.1 9.4 8.8 11.1"/>' +
      '<path d="M4.9 11.6 6.6 13.3"/>',

    // Balanza de dos platillos
    balanza:
      '<circle cx="12" cy="3.4" r="1.3"/>' +
      '<path d="M12 4.7v15.1"/>' +
      '<path d="M4 6.8h16"/>' +
      '<path d="M8.3 20.6h7.4"/>' +
      '<path d="M4 6.8 1.7 12.2a3.2 3.2 0 0 0 4.6 0z"/>' +
      '<path d="M20 6.8 17.7 12.2a3.2 3.2 0 0 0 4.6 0z"/>',

    // Manzana con tallo y hoja
    manzana:
      '<path d="M12 8.6c-.9-1.5-2.4-2.2-3.9-1.8-2.1.5-3.3 2.7-3.1 5.5.3 3.6 2.6 7.3 4.7 7.4.9-.1 1.5-.6 2.3-.6s1.4.5 2.3.6c2.1-.1 4.4-3.8 4.7-7.4.2-2.8-1-5-3.1-5.5-1.5-.4-3 .3-3.9 1.8z"/>' +
      '<path d="M12 8.6V5.8"/>' +
      '<path d="M12.3 5.9c1.5.3 3-.7 3.4-2.2-1.5-.3-3 .7-3.4 2.2z"/>',

    // Calculadora con pantalla y teclas
    calculadora:
      '<rect x="4" y="2.4" width="16" height="19.2" rx="2.6"/>' +
      '<rect x="7.4" y="5.6" width="9.2" height="3.4" rx="1"/>' +
      '<path d="M8.4 13h.01"/>' +
      '<path d="M12 13h.01"/>' +
      '<path d="M15.6 13h.01"/>' +
      '<path d="M8.4 16.4h.01"/>' +
      '<path d="M12 16.4h.01"/>' +
      '<path d="M15.6 16.4h.01"/>' +
      '<path d="M8.4 19.2h7.2"/>',

    /* --- Tiempo --- */

    // Calendario mensual
    calendario:
      '<rect x="3" y="5" width="18" height="16" rx="2.5"/>' +
      '<path d="M3 10h18"/>' +
      '<path d="M8 3v4"/>' +
      '<path d="M16 3v4"/>' +
      '<path d="M8 14.4h.01"/>' +
      '<path d="M12 14.4h.01"/>' +
      '<path d="M16 14.4h.01"/>' +
      '<path d="M8 17.8h.01"/>' +
      '<path d="M12 17.8h.01"/>',

    // Reloj con manecillas
    reloj:
      '<circle cx="12" cy="12" r="8.6"/>' +
      '<path d="M12 6.8v5.6l3.6 2.1"/>',

    // Estrella de cinco puntas
    estrella:
      '<path d="M12 3 14 9.2 20.6 9.2 15.3 13.1 17.3 19.3 12 15.4 6.7 19.3 8.7 13.1 3.4 9.2 10 9.2z"/>',

    /* --- Comunicación --- */

    // Globo de diálogo
    chat:
      '<path d="M20.8 11.6a8.5 8.5 0 0 1-12.7 7.4L3.4 20.6l1.5-4.4A8.5 8.5 0 1 1 20.8 11.6z"/>' +
      '<path d="M8.6 10.6h6.8"/>' +
      '<path d="M8.6 14h4.4"/>',

    // Campana de avisos
    campana:
      '<path d="M18.2 8.6a6.2 6.2 0 1 0-12.4 0c0 6.3-2.7 8-2.7 8h17.8s-2.7-1.7-2.7-8z"/>' +
      '<path d="M10.2 20.1a2.1 2.1 0 0 0 3.6 0"/>',

    // Engrane de configuración
    config:
      '<circle cx="12" cy="12" r="6.6"/>' +
      '<circle cx="12" cy="12" r="2.6"/>' +
      '<path d="M12 5.4V3"/>' +
      '<path d="M12 18.6V21"/>' +
      '<path d="M5.4 12H3"/>' +
      '<path d="M18.6 12H21"/>' +
      '<path d="M7.4 7.4 5.5 5.5"/>' +
      '<path d="M16.6 7.4 18.5 5.5"/>' +
      '<path d="M7.4 16.6 5.5 18.5"/>' +
      '<path d="M16.6 16.6 18.5 18.5"/>',

    // Salida de sesión
    salir:
      '<path d="M12 3.6H6.6a2.2 2.2 0 0 0-2.2 2.2v12.4a2.2 2.2 0 0 0 2.2 2.2H12"/>' +
      '<path d="M15.8 16.4 20.2 12l-4.4-4.4"/>' +
      '<path d="M20.2 12H9.4"/>',

    /* --- Acciones --- */

    // Lupa
    buscar:
      '<circle cx="10.6" cy="10.6" r="6.6"/>' +
      '<path d="M15.9 15.9 20.8 20.8"/>',

    // Signo de más
    mas:
      '<path d="M12 5v14"/>' +
      '<path d="M5 12h14"/>',

    // Lápiz de edición
    editar:
      '<path d="M16.4 3.6a2.2 2.2 0 0 1 3.1 3.1L7.6 18.6 3.2 20.1l1.5-4.4z"/>' +
      '<path d="M14.6 5.4 17.7 8.5"/>',

    // Bote de basura
    basura:
      '<path d="M4 6.5h16"/>' +
      '<path d="M9.4 6.5V4.8a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.7"/>' +
      '<path d="M6.4 6.5l.9 12.9a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.9-12.9"/>' +
      '<path d="M10.4 10.4v6.6"/>' +
      '<path d="M13.6 10.4v6.6"/>',

    // Ojo (ver detalle)
    ojo:
      '<path d="M2.2 12C4.6 8 8 6 12 6s7.4 2 9.8 6c-2.4 4-5.8 6-9.8 6s-7.4-2-9.8-6z"/>' +
      '<circle cx="12" cy="12" r="2.9"/>',

    // Palomita
    check:
      '<path d="M4.6 12.6 9.6 17.6 19.4 6.6"/>',

    // Cruz de cerrar
    x:
      '<path d="M6.2 6.2 17.8 17.8"/>' +
      '<path d="M17.8 6.2 6.2 17.8"/>',

    // Triángulo de advertencia
    alerta:
      '<path d="M12 3.4 2.1 20.6h19.8z"/>' +
      '<path d="M12 9.8v4.8"/>' +
      '<path d="M12 17.8h.01"/>',

    /* --- Flechas --- */

    'flecha-arriba':
      '<path d="M12 20V4"/>' +
      '<path d="M5.6 10.4 12 4l6.4 6.4"/>',

    'flecha-abajo':
      '<path d="M12 4v16"/>' +
      '<path d="M18.4 13.6 12 20l-6.4-6.4"/>',

    'flecha-der':
      '<path d="M4 12h16"/>' +
      '<path d="M13.6 5.6 20 12l-6.4 6.4"/>',

    'flecha-izq':
      '<path d="M20 12H4"/>' +
      '<path d="M10.4 18.4 4 12l6.4-6.4"/>',

    /* --- Archivos --- */

    // Bandeja con flecha hacia abajo
    descargar:
      '<path d="M20.6 15.4v3.4a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2v-3.4"/>' +
      '<path d="M7.6 10.6 12 15l4.4-4.4"/>' +
      '<path d="M12 15V3.2"/>',

    // Bandeja con flecha hacia arriba
    subir:
      '<path d="M20.6 15.4v3.4a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2v-3.4"/>' +
      '<path d="M7.6 7.6 12 3.2l4.4 4.4"/>' +
      '<path d="M12 3.2v11.8"/>',

    // Impresora con hoja saliendo
    imprimir:
      '<path d="M7 8.6V3.4h10v5.2"/>' +
      '<path d="M7 17.6H5.2A2.2 2.2 0 0 1 3 15.4v-4.6a2.2 2.2 0 0 1 2.2-2.2h13.6a2.2 2.2 0 0 1 2.2 2.2v4.6a2.2 2.2 0 0 1-2.2 2.2H17"/>' +
      '<path d="M7 13.4h10V21H7z"/>' +
      '<path d="M17.6 11.4h.01"/>',

    /* --- Cuenta --- */

    // Silueta de persona
    usuario:
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M4.6 20.6v-1.2A5.2 5.2 0 0 1 9.8 14.2h4.4a5.2 5.2 0 0 1 5.2 5.2v1.2"/>',

    // Candado cerrado
    candado:
      '<rect x="4.2" y="10.4" width="15.6" height="10.6" rx="2.4"/>' +
      '<path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8"/>' +
      '<path d="M12 14.6v2.8"/>',

    // Sobre de correo
    correo:
      '<rect x="2.4" y="4.8" width="19.2" height="14.4" rx="2.4"/>' +
      '<path d="M3.2 6.4 12 12.8l8.8-6.4"/>',

    // Auricular de teléfono
    telefono:
      '<path d="M21.4 17.1v2.5a1.8 1.8 0 0 1-2 1.8 17.6 17.6 0 0 1-7.7-2.7 17.3 17.3 0 0 1-5.3-5.3A17.6 17.6 0 0 1 3.7 5.6a1.8 1.8 0 0 1 1.8-2h2.5a1.8 1.8 0 0 1 1.8 1.6c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.4 14.4 0 0 0 5.4 5.4l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.6 1.9z"/>',

    // Pin de ubicación
    ubicacion:
      '<path d="M20 10.4c0 6-8 12.1-8 12.1s-8-6.1-8-12.1a8 8 0 0 1 16 0z"/>' +
      '<circle cx="12" cy="10.2" r="2.8"/>',

    /* --- Logros y hábitos --- */

    // Copa de trofeo con asas
    trofeo:
      '<path d="M6.5 3.5h11v5a5.5 5.5 0 0 1-11 0z"/>' +
      '<path d="M6.5 5.5H4.3a2.8 2.8 0 0 0 2.6 3.3"/>' +
      '<path d="M17.5 5.5h2.2a2.8 2.8 0 0 1-2.6 3.3"/>' +
      '<path d="M12 14v3.5"/>' +
      '<path d="M10 20.5v-3h4v3"/>' +
      '<path d="M8.8 20.5h6.4"/>',

    // Llama (racha de constancia)
    fuego:
      '<path d="M12 21.6a6.5 6.5 0 0 0 6.5-6.5c0-4.2-4-6.4-5.2-10.5-1.9 1.9-2.3 4-1.8 5.7-1.2-.4-2.1-1.6-2.3-3-1.9 2.2-2.7 4.6-2.7 7.8a6.5 6.5 0 0 0 5.5 6.5z"/>',

    // Gota (hidratación, grasa corporal)
    gota:
      '<path d="M12 3.4c-3 3.4-6.2 6.9-6.2 10.4a6.2 6.2 0 0 0 12.4 0c0-3.5-3.2-7-6.2-10.4z"/>',

    // Luna (tema oscuro)
    luna:
      '<path d="M20.6 14.2A9 9 0 1 1 9.8 3.4a7.8 7.8 0 0 0 10.8 10.8z"/>',

    // Sol (tema claro)
    sol:
      '<circle cx="12" cy="12" r="4.2"/>' +
      '<path d="M12 1.8v2.4"/>' +
      '<path d="M12 19.8v2.4"/>' +
      '<path d="M1.8 12h2.4"/>' +
      '<path d="M19.8 12h2.4"/>' +
      '<path d="M4.9 4.9 6.6 6.6"/>' +
      '<path d="M17.4 17.4 19.1 19.1"/>' +
      '<path d="M19.1 4.9 17.4 6.6"/>' +
      '<path d="M6.6 17.4 4.9 19.1"/>',

    /* --- Interfaz --- */

    // Menú de tres líneas
    menu:
      '<path d="M4 7h16"/>' +
      '<path d="M4 12h16"/>' +
      '<path d="M4 17h16"/>',

    // Embudo de filtros
    filtro:
      '<path d="M3.4 4.6h17.2l-6.9 8.1v5.9l-3.4 2v-7.9z"/>',

    // Vaso con agua
    agua:
      '<path d="M6.8 3.5h10.4l-1.3 16.1a1.7 1.7 0 0 1-1.7 1.6H9.8a1.7 1.7 0 0 1-1.7-1.6z"/>' +
      '<path d="M7.6 10.3c1.2 1 2.4 1 3.6 0s2.4-1 3.6 0c.5.4 1 .6 1.5.5"/>',

    // Luna con zeta: descanso y sueño
    sueno:
      '<path d="M16.5 15.9A7 7 0 1 1 8.1 7.5a6.1 6.1 0 0 0 8.4 8.4z"/>' +
      '<path d="M15.4 2.6h5.2l-5.2 5h5.2"/>',

    // Cámara fotográfica
    foto:
      '<path d="M4.5 7.5h2.6l1.4-2.5h7l1.4 2.5h2.6A2.5 2.5 0 0 1 22 10v8.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5V10a2.5 2.5 0 0 1 2.5-2.5z"/>' +
      '<circle cx="12" cy="13.8" r="3.7"/>',

    // Código QR
    qr:
      '<rect x="3.6" y="3.6" width="6.4" height="6.4" rx="1.2"/>' +
      '<rect x="14" y="3.6" width="6.4" height="6.4" rx="1.2"/>' +
      '<rect x="3.6" y="14" width="6.4" height="6.4" rx="1.2"/>' +
      '<path d="M6.8 6.8h.01"/>' +
      '<path d="M17.2 6.8h.01"/>' +
      '<path d="M6.8 17.2h.01"/>' +
      '<path d="M14 14h2.8"/>' +
      '<path d="M14 14v2.8"/>' +
      '<path d="M20.4 14h.01"/>' +
      '<path d="M20.4 17.4h.01"/>' +
      '<path d="M17 20.4h.01"/>' +
      '<path d="M20.4 20.4h.01"/>',

    // Globo de mensajería con auricular
    whatsapp:
      '<path d="M20.6 11.7a8.6 8.6 0 0 1-12.8 7.5L3.4 20.6l1.4-4.3A8.6 8.6 0 1 1 20.6 11.7z"/>' +
      '<path d="M9.4 9.3c0-.5.4-.9.9-.9h.7l1 2.2-1 1a7 7 0 0 0 3.4 3.4l1-1 2.2 1v.7c0 .5-.4.9-.9.9A7.3 7.3 0 0 1 9.4 9.3z"/>',

    // Información
    info:
      '<circle cx="12" cy="12" r="8.6"/>' +
      '<path d="M12 11.4v5.4"/>' +
      '<path d="M12 7.9h.01"/>',

    // Reloj con flecha de retroceso: historial
    historial:
      '<path d="M3.3 3.8v4.8h4.8"/>' +
      '<path d="M3.4 13.2A8.7 8.7 0 1 0 6 5.7L3.3 8.6"/>' +
      '<path d="M12 7.4v5l3.4 2"/>',

    // Diana: metas y objetivos
    meta:
      '<circle cx="12" cy="12" r="8.6"/>' +
      '<circle cx="12" cy="12" r="5"/>' +
      '<circle cx="12" cy="12" r="1.6"/>',

    // Cinta métrica: carcasa con carrete y lengüeta
    cinta:
      '<rect x="1.8" y="6.4" width="15.4" height="11.2" rx="3.2"/>' +
      '<circle cx="8" cy="12" r="3.6"/>' +
      '<path d="M8 12h.01"/>' +
      '<path d="M17.2 12h4.2"/>' +
      '<path d="M20.4 9.6v4.8"/>',

    // Rayo: energía e intensidad
    rayo:
      '<path d="M13.4 2.4 4.6 13.6h6.4l-.9 8 8.8-11.2h-6.4z"/>',

    // Escudo de Alliance Gym con la A al centro
    escudo:
      '<path d="M12 2.6 20 5.8v5.9c0 5.1-3.4 9.2-8 10.5-4.6-1.3-8-5.4-8-10.5V5.8z"/>' +
      '<path d="M9.2 16 12 8.6 14.8 16"/>' +
      '<path d="M10.2 13.6h3.6"/>',

    // Grupo de tres personas: clase grupal
    clase:
      '<circle cx="6.2" cy="9" r="2.4"/>' +
      '<circle cx="12" cy="7.4" r="2.8"/>' +
      '<circle cx="17.8" cy="9" r="2.4"/>' +
      '<path d="M2.2 18.2a4 4 0 0 1 4-3.6c.7 0 1.3.2 1.9.5"/>' +
      '<path d="M21.8 18.2a4 4 0 0 0-4-3.6c-.7 0-1.3.2-1.9.5"/>' +
      '<path d="M7.4 20.6a4.6 4.6 0 0 1 9.2 0"/>',

    // Cubiertos: plan de nutrición
    nutricion:
      '<path d="M5.2 3v5.4a2.7 2.7 0 0 0 5.4 0V3"/>' +
      '<path d="M7.9 3v5.4"/>' +
      '<path d="M7.9 11.1V21"/>' +
      '<path d="M17.6 3.2c-2.1 1.5-3.3 4.2-3.3 7.2 0 2.4 1.3 4.1 3.3 4.1z"/>' +
      '<path d="M17.6 14.5V21"/>'
  };

  /* Nombres alternativos aceptados por comodidad. */
  var ALIAS = {
    casa: 'inicio',
    home: 'inicio',
    usuarios: 'socios',
    personas: 'socios',
    entrenador: 'coach',
    barra: 'pesa',
    salud: 'corazon',
    pago: 'dinero',
    peso: 'balanza',
    bascula: 'balanza',
    ajustes: 'config',
    engrane: 'config',
    cerrar: 'x',
    agregar: 'mas',
    nuevo: 'mas',
    lapiz: 'editar',
    eliminar: 'basura',
    borrar: 'basura',
    ver: 'ojo',
    exito: 'check',
    advertencia: 'alerta',
    arriba: 'flecha-arriba',
    abajo: 'flecha-abajo',
    derecha: 'flecha-der',
    izquierda: 'flecha-izq',
    exportar: 'descargar',
    importar: 'subir',
    perfil: 'usuario',
    email: 'correo',
    mensaje: 'chat',
    notificacion: 'campana',
    racha: 'fuego',
    objetivo: 'meta',
    diana: 'meta',
    camara: 'foto',
    tiempo: 'reloj',
    dieta: 'nutricion',
    alimento: 'manzana'
  };

  /* -------------------------------------------------------------
     Utilidades internas
     ------------------------------------------------------------- */

  // Escapa el texto accesible antes de insertarlo en el SVG.
  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Quita acentos para tolerar 'gráfica', 'configuración', etc.
  function sinAcentos(texto) {
    return texto
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n');
  }

  // Normaliza el nombre pedido: minúsculas, sin acentos ni espacios.
  function normalizar(nombre) {
    var limpio = String(nombre == null ? '' : nombre).trim().toLowerCase();
    return sinAcentos(limpio).replace(/[\s_]+/g, '-');
  }

  // Devuelve el cuerpo SVG del icono o null si no existe.
  function cuerpoDe(nombre) {
    var clave = normalizar(nombre);
    if (!clave) return null;
    if (Object.prototype.hasOwnProperty.call(MAPA, clave)) return MAPA[clave];
    if (Object.prototype.hasOwnProperty.call(ALIAS, clave)) {
      var real = ALIAS[clave];
      if (Object.prototype.hasOwnProperty.call(MAPA, real)) return MAPA[real];
    }
    return null;
  }

  // Convierte un valor a número positivo con respaldo.
  function numero(valor, respaldo) {
    var n = parseFloat(valor);
    if (!isFinite(n) || n <= 0) return respaldo;
    return Math.round(n * 100) / 100;
  }

  /* -------------------------------------------------------------
     API pública
     ------------------------------------------------------------- */

  /**
   * Devuelve el marcado completo de un icono.
   * @param {String} nombre   Nombre del icono (ver AG.Icons.lista).
   * @param {Number} [tamano] Lado en píxeles (20 por defecto).
   * @param {Object} [opciones] {relleno, clase, titulo, grosor}
   * @returns {String} '<svg …></svg>' — nunca vacío ni indefinido.
   */
  function get(nombre, tamano, opciones) {
    var opts = (opciones && typeof opciones === 'object') ? opciones : {};
    var lado = numero(tamano, TAMANO);
    var grosor = numero(opts.grosor, GROSOR);
    var cuerpo = cuerpoDe(nombre) || NEUTRO;

    var clases = 'ico';
    if (opts.clase) clases += ' ' + esc(String(opts.clase).replace(/["<>]/g, ''));

    var relleno = opts.relleno ? 'currentColor' : 'none';

    var titulo = '';
    var accesible = 'aria-hidden="true" focusable="false"';
    if (opts.titulo) {
      titulo = '<title>' + esc(opts.titulo) + '</title>';
      accesible = 'role="img" aria-label="' + esc(opts.titulo) + '" focusable="false"';
    }

    return '<svg class="' + clases + '" width="' + lado + '" height="' + lado +
      '" viewBox="' + VIEWBOX + '" fill="' + relleno +
      '" stroke="currentColor" stroke-width="' + grosor +
      '" stroke-linecap="round" stroke-linejoin="round" ' + accesible + '>' +
      titulo + cuerpo + '</svg>';
  }

  /** ¿Existe el icono (o alguno de sus alias)? */
  function existe(nombre) {
    return cuerpoDe(nombre) !== null;
  }

  AG.Icons = {
    get: get,
    existe: existe,
    lista: Object.keys(MAPA),
    alias: Object.keys(ALIAS),
    viewBox: VIEWBOX,
    tamanoBase: TAMANO,
    grosorBase: GROSOR
  };
})(window.AG);
