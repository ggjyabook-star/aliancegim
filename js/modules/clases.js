/* =============================================================
   ALLIANCE GYM — AG.Mod.Clases
   Horario semanal de clases grupales para las tres vistas:

     director/clases  ->  KPIs, alta/edición/baja de clases y padrón de inscritos
     coach/clases     ->  horario completo con sus clases destacadas y pase de lista
     socio/clases     ->  horario con inscripción / cancelación y "mi próxima clase"

   API compartida que consumen otras pantallas:
     AG.Mod.Clases.proximaDe(usuario) -> { clase, cuando, ... } | null
     AG.Mod.Clases.deCoach(coachId)   -> [Clase] ordenadas por día y hora

   Depende solo de AG.Utils, AG.Icons, AG.Calc, AG.DB, AG.Auth y AG.Router.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  /* =============================================================
     1. Constantes del horario
     ============================================================= */

  /* La semana del gimnasio arranca en lunes (índice 0). */
  var DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  var DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /* Franja visible por omisión: 06:00 a 21:00 (se amplía si alguna clase se sale). */
  var FRANJA_INICIO = 6 * 60;
  var FRANJA_FIN = 21 * 60;

  /* Escala vertical de la cuadrícula: 1.2 px por minuto (una hora = 72 px). */
  var PX_POR_MINUTO = 1.2;
  var ALTO_HORA = Math.round(60 * PX_POR_MINUTO);
  var ALTO_MINIMO_BLOQUE = 38;

  /* Colores sugeridos para el selector del formulario. */
  var COLORES_SUGERIDOS = [
    '#e4322b', '#f0a03c', '#eab308', '#3fbf7f',
    '#06b6d4', '#5aa9f0', '#9b7bf0', '#ec4899'
  ];

  var COLOR_POR_DEFECTO = '#e4322b';
  var ID_ESTILO = 'ag-estilo-clases';

  /* Filtros vivos por rol: sobreviven a AG.Router.refrescar(). */
  var filtros = {
    director: { coachId: '', tipo: '', soloMias: false, resaltarHoy: true },
    coach: { coachId: '', tipo: '', soloMias: false, resaltarHoy: true },
    socio: { coachId: '', tipo: '', soloMias: false, resaltarHoy: true }
  };

  /* =============================================================
     2. Atajos y utilidades
     ============================================================= */

  function esc(v) { return AG.Utils.esc(v); }
  function icono(nombre, tam) { return AG.Icons.get(nombre, tam || 18); }

  function normalizar(v) {
    return AG.Utils.normalizar ? AG.Utils.normalizar(v) : String(v || '').toLowerCase().trim();
  }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function rellenar2(n) {
    var s = String(Math.max(0, Math.floor(Number(n) || 0)));
    return s.length < 2 ? '0' + s : s;
  }

  /** 'miércoles', 'Miercoles', 'mie' o 3 -> índice 0..6 (lunes = 0). -1 si no se reconoce. */
  function indiceDia(dia) {
    if (typeof dia === 'number' && isFinite(dia)) {
      var n = Math.floor(dia);
      return (n >= 0 && n <= 6) ? n : -1;
    }
    var t = normalizar(dia);
    if (!t) return -1;
    var i;
    for (i = 0; i < DIAS.length; i++) {
      if (normalizar(DIAS[i]) === t) return i;
    }
    for (i = 0; i < DIAS_CORTOS.length; i++) {
      if (normalizar(DIAS_CORTOS[i]) === t) return i;
    }
    /* Tolerancia extra: prefijo de tres letras ('mie', 'sab', 'dom'). */
    for (i = 0; i < DIAS.length; i++) {
      if (normalizar(DIAS[i]).slice(0, 3) === t.slice(0, 3)) return i;
    }
    return -1;
  }

  /** 'HH:MM' -> minutos desde medianoche. null si el texto no sirve. */
  function minutosDe(hora) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hora === null || hora === undefined ? '' : hora).trim());
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (!isFinite(h) || !isFinite(mi) || h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /** minutos -> 'HH:MM' (se dobla al día siguiente si hiciera falta). */
  function textoHora(minutos) {
    var m = Math.max(0, Math.floor(Number(minutos) || 0)) % 1440;
    return rellenar2(Math.floor(m / 60)) + ':' + rellenar2(m % 60);
  }

  /** Índice del día de hoy con lunes = 0. */
  function diaDeHoy() {
    return (new Date().getDay() + 6) % 7;
  }

  /** Minutos transcurridos del día actual. */
  function minutosDeAhora() {
    var f = new Date();
    return f.getHours() * 60 + f.getMinutes();
  }

  /** Hora actual como 'HH:MM'. */
  function horaActual() {
    var f = new Date();
    return rellenar2(f.getHours()) + ':' + rellenar2(f.getMinutes());
  }

  /** '#abc' o '#aabbcc' -> {r,g,b}. null si no es un color válido. */
  function aRGB(hex) {
    var h = String(hex === null || hex === undefined ? '' : hex).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  /** Devuelve siempre un '#rrggbb' seguro para meter en un atributo style. */
  function colorSeguro(hex) {
    var c = aRGB(hex);
    if (!c) return COLOR_POR_DEFECTO;
    return '#' + [c.r, c.g, c.b].map(function (n) {
      var s = n.toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }

  /** Versión translúcida del color de la clase, para el fondo del bloque. */
  function tinte(hex, alfa) {
    var c = aRGB(hex) || aRGB(COLOR_POR_DEFECTO);
    var a = Math.max(0, Math.min(1, Number(alfa) || 0));
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function redondear(n, dec) {
    var f = Math.pow(10, dec || 4);
    return Math.round((Number(n) || 0) * f) / f;
  }

  function nombreDe(usuario) {
    return AG.Utils.nombreCompleto(usuario) || 'Sin nombre';
  }

  /** Primer nombre + inicial del apellido: cabe en los bloques angostos. */
  function nombreCorto(usuario) {
    if (!usuario) return 'Sin coach';
    var n = String(usuario.nombre || '').trim().split(/\s+/)[0] || '';
    var a = String(usuario.apellidos || '').trim().charAt(0);
    if (!n) return nombreDe(usuario);
    return a ? n + ' ' + a.toUpperCase() + '.' : n;
  }

  /* =============================================================
     3. Lectura y normalización de las clases
     ============================================================= */

  /**
   * Convierte una Clase de la base en una vista lista para pintar.
   * @returns {Object} { clase, id, dia, ini, fin, dur, cupo, inscritos, ocupados, pct, color, valida }
   */
  function vistaDe(clase) {
    var dia = indiceDia(clase.dia);
    var ini = minutosDe(clase.hora);
    var dur = Math.round(Number(clase.duracionMin));
    if (!isFinite(dur) || dur <= 0) dur = 45;
    dur = Math.max(5, Math.min(300, dur));

    var cupo = Math.round(Number(clase.cupo));
    if (!isFinite(cupo) || cupo < 0) cupo = 0;

    var inscritos = esArreglo(clase.inscritos) ? clase.inscritos.filter(function (id) {
      return typeof id === 'string' && id;
    }) : [];

    var ocupados = inscritos.length;
    var pct = cupo > 0 ? Math.round((ocupados / cupo) * 100) : (ocupados > 0 ? 100 : 0);

    return {
      clase: clase,
      id: clase.id,
      nombre: String(clase.nombre || 'Clase'),
      salon: String(clase.salon || ''),
      coachId: clase.coachId || '',
      dia: dia,
      ini: ini === null ? 0 : ini,
      fin: (ini === null ? 0 : ini) + dur,
      dur: dur,
      cupo: cupo,
      inscritos: inscritos,
      ocupados: ocupados,
      pct: pct,
      lleno: cupo > 0 && ocupados >= cupo,
      color: colorSeguro(clase.color),
      valida: dia >= 0 && ini !== null,
      carril: 0,
      carriles: 1
    };
  }

  /** Todas las clases activas de la base, ya normalizadas. */
  function todasLasVistas(incluirInactivas) {
    var lista = AG.DB.get('clases');
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i];
      if (!c || typeof c !== 'object') continue;
      if (!incluirInactivas && c.activa === false) continue;
      salida.push(vistaDe(c));
    }
    return salida;
  }

  /** Ordena por día y hora; las inválidas quedan al final. */
  function ordenarPorHorario(vistas) {
    return vistas.slice().sort(function (a, b) {
      if (a.valida !== b.valida) return a.valida ? -1 : 1;
      if (a.dia !== b.dia) return a.dia - b.dia;
      if (a.ini !== b.ini) return a.ini - b.ini;
      return a.nombre < b.nombre ? -1 : (a.nombre > b.nombre ? 1 : 0);
    });
  }

  /** Nombres de clase distintos, para el filtro por tipo. */
  function tiposDeClase(vistas) {
    var vistos = {}, salida = [];
    for (var i = 0; i < vistas.length; i++) {
      var n = vistas[i].nombre;
      var k = normalizar(n);
      if (!k || vistos[k]) continue;
      vistos[k] = true;
      salida.push(n);
    }
    return AG.Utils.ordenar(salida, function (x) { return normalizar(x); }, 'asc');
  }

  /** Aplica los filtros del rol sobre la lista de vistas. */
  function aplicarFiltros(vistas, f, usuario) {
    var salida = [];
    for (var i = 0; i < vistas.length; i++) {
      var v = vistas[i];
      if (f.coachId && v.coachId !== f.coachId) continue;
      if (f.tipo && normalizar(v.nombre) !== normalizar(f.tipo)) continue;
      if (f.soloMias && usuario) {
        if (usuario.rol === 'coach' && v.coachId !== usuario.id) continue;
        if (usuario.rol === 'socio' && v.inscritos.indexOf(usuario.id) < 0) continue;
      }
      salida.push(v);
    }
    return salida;
  }

  /**
   * Reparte las clases de un día en carriles para que dos que se encimen
   * no queden una encima de la otra.
   */
  function repartirCarriles(delDia) {
    var finPorCarril = [];
    var i, j, colocado;
    var ordenadas = delDia.slice().sort(function (a, b) { return a.ini - b.ini || a.fin - b.fin; });

    for (i = 0; i < ordenadas.length; i++) {
      colocado = false;
      for (j = 0; j < finPorCarril.length; j++) {
        if (finPorCarril[j] <= ordenadas[i].ini) {
          ordenadas[i].carril = j;
          finPorCarril[j] = ordenadas[i].fin;
          colocado = true;
          break;
        }
      }
      if (!colocado) {
        ordenadas[i].carril = finPorCarril.length;
        finPorCarril.push(ordenadas[i].fin);
      }
    }

    var total = Math.max(1, finPorCarril.length);
    for (i = 0; i < ordenadas.length; i++) ordenadas[i].carriles = total;
    return ordenadas;
  }

  /* =============================================================
     4. Estilos propios (mínimos) de la cuadrícula semanal
     ============================================================= */

  var CSS_HORARIO = '' +
    '.cl-marco{border:1px solid var(--borde);border-radius:var(--radio);background:var(--panel);' +
      'box-shadow:var(--sombra);overflow:hidden}' +
    '.cl-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}' +
    '.cl-rejilla{min-width:720px}' +
    '.cl-cab,.cl-cuerpo{display:grid;grid-template-columns:54px repeat(7,minmax(0,1fr))}' +
    '.cl-cab{border-bottom:1px solid var(--borde);background:var(--carbon-2)}' +
    '.cl-cab-hora{padding:8px 6px}' +
    '.cl-cab-dia{padding:8px 4px;text-align:center;border-left:1px solid var(--borde);' +
      'font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--texto-2)}' +
    '.cl-cab-dia small{display:block;font-size:9.5px;font-weight:700;letter-spacing:.04em;' +
      'text-transform:none;color:var(--texto-3)}' +
    '.cl-marco.resalta-hoy .cl-cab-dia.hoy{color:var(--rojo)}' +
    '.cl-marco.resalta-hoy .cl-cab-dia.hoy small{color:var(--rojo)}' +
    '.cl-horas{position:relative}' +
    '.cl-hora{height:var(--cl-alto-hora);border-top:1px solid var(--borde);padding:2px 6px 0 0;' +
      'text-align:right;font-size:10px;font-weight:700;color:var(--texto-3);font-variant-numeric:tabular-nums}' +
    '.cl-hora:first-child{border-top:0}' +
    '.cl-col{position:relative;border-left:1px solid var(--borde);' +
      'background-image:repeating-linear-gradient(to bottom,var(--borde) 0 1px,transparent 1px var(--cl-alto-hora))}' +
    '.cl-marco.resalta-hoy .cl-col.hoy{background-color:rgba(var(--rojo-rgb),.07)}' +
    '.cl-bloque{position:absolute;display:flex;flex-direction:column;gap:2px;overflow:hidden;' +
      'padding:5px 6px;border-radius:9px;border:1px solid var(--borde-2);border-left:3px solid var(--cl-c);' +
      'background:var(--cl-bg);color:var(--texto);text-align:left;cursor:pointer;' +
      'transition:transform var(--trans),box-shadow var(--trans),opacity var(--trans)}' +
    '.cl-bloque:hover{transform:translateY(-1px);box-shadow:var(--sombra);z-index:4;opacity:1}' +
    '.cl-bloque:focus-visible{outline:2px solid var(--rojo);outline-offset:2px;z-index:4}' +
    '.cl-bloque.mia{border-color:var(--cl-c);box-shadow:inset 0 0 0 1px var(--cl-c)}' +
    '.cl-bloque.atenuada{opacity:.55}' +
    '.cl-bloque .cl-nom{font-size:11.5px;font-weight:800;line-height:1.2;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cl-bloque .cl-meta{font-size:10px;line-height:1.25;color:var(--texto-2);' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cl-bloque .cl-pie{margin-top:auto;display:flex;align-items:center;gap:5px}' +
    '.cl-track{flex:1 1 auto;height:4px;border-radius:999px;background:var(--panel-2);' +
      'border:1px solid var(--borde);overflow:hidden}' +
    '.cl-track i{display:block;height:100%;background:var(--cl-c)}' +
    '.cl-bloque .cl-ocu{font-size:9.5px;font-weight:800;color:var(--texto-2);font-variant-numeric:tabular-nums}' +
    '.cl-punto{width:11px;height:11px;border-radius:50%;flex:0 0 auto;display:inline-block}' +
    '.cl-vacio-col{padding:26px 10px;text-align:center;color:var(--texto-3);font-size:12px}' +
    '@media (max-width:900px){.cl-rejilla{min-width:0}}';

  function inyectarEstilos() {
    if (document.getElementById(ID_ESTILO)) return;
    var st = document.createElement('style');
    st.id = ID_ESTILO;
    st.textContent = CSS_HORARIO;
    document.head.appendChild(st);
  }

  /* =============================================================
     5. Piezas de interfaz reutilizables
     ============================================================= */

  function vacio(mensaje, iconoNombre, extraHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre || 'clase', 32) + '</div>' +
      '<p class="empty-texto">' + mensaje + '</p>' +
      (extraHTML || '') +
      '</div>';
  }

  function claseDeBarra(pct, lleno) {
    if (lleno) return 'error';
    if (pct >= 85) return 'warn';
    return 'ok';
  }

  /** Barra de ocupación con etiqueta, con las clases del contrato de CSS. */
  function barraOcupacion(v, gruesa) {
    var ancho = Math.max(0, Math.min(100, v.pct));
    return '<div>' +
      '<div class="bar-etiqueta"><span>Ocupación</span>' +
        '<b>' + v.ocupados + ' / ' + (v.cupo || '—') + ' · ' + AG.Utils.pct(v.pct, 0) + '</b></div>' +
      '<div class="bar' + (gruesa ? ' bar-gruesa' : '') + '">' +
        '<span class="bar-fill ' + claseDeBarra(v.pct, v.lleno) + '" style="width:' + ancho + '%"></span>' +
      '</div>' +
      '</div>';
  }

  function etiquetaDia(v) {
    return v.valida ? DIAS_LARGOS[v.dia] : 'Día sin definir';
  }

  function rangoHorario(v) {
    return textoHora(v.ini) + ' – ' + textoHora(v.fin);
  }

  /** Píldoras con día, horario, duración y salón. */
  function pildorasDe(v) {
    var html = '<div class="row wrap row-sm">' +
      '<span class="pill">' + icono('calendario', 13) + esc(etiquetaDia(v)) + '</span>' +
      '<span class="pill">' + icono('reloj', 13) + esc(rangoHorario(v)) + '</span>' +
      '<span class="pill"><b>' + v.dur + '</b> min</span>';
    if (v.salon) {
      html += '<span class="pill">' + icono('ubicacion', 13) + esc(v.salon) + '</span>';
    }
    if (v.clase.activa === false) {
      html += '<span class="badge badge-muted">Fuera del horario</span>';
    }
    html += '</div>';
    return html;
  }

  /** Ficha del coach de la clase. */
  function fichaCoach(v) {
    var coach = AG.DB.usuario(v.coachId);
    if (!coach) {
      return '<div class="aviso aviso-warn">' + icono('alerta', 16) +
        '<span>Esta clase no tiene un coach asignado.</span></div>';
    }
    return '<div class="persona">' + AG.Utils.avatar(coach, 'sm') +
      '<div class="persona-txt"><b>' + esc(nombreDe(coach)) + '</b>' +
      '<span>' + esc(coach.especialidad || 'Coach') + '</span></div></div>';
  }

  /* =============================================================
     6. Cuadrícula semanal (escritorio) y lista por día (móvil)
     ============================================================= */

  /**
   * Devuelve el HTML del horario completo.
   * @param {Array} vistas  clases ya filtradas
   * @param {Object} opts   { usuario, rol, resaltarHoy }
   */
  function horarioHTML(vistas, opts) {
    var o = opts || {};
    var usuario = o.usuario || null;
    var rol = o.rol || (usuario ? usuario.rol : 'socio');
    var validas = [], i;

    for (i = 0; i < vistas.length; i++) {
      if (vistas[i].valida) validas.push(vistas[i]);
    }

    if (!validas.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('No hay clases que coincidan con lo que buscas. Prueba con otro coach o con otro tipo de clase.',
          'filtro',
          '<button class="btn btn-outline btn-sm" type="button" data-limpiar>Quitar filtros</button>') +
        '</div></div>';
    }

    /* Rango vertical: 06:00–21:00 salvo que alguna clase se salga de la franja. */
    var ini = FRANJA_INICIO, fin = FRANJA_FIN;
    for (i = 0; i < validas.length; i++) {
      ini = Math.min(ini, Math.floor(validas[i].ini / 60) * 60);
      fin = Math.max(fin, Math.ceil(validas[i].fin / 60) * 60);
    }
    var bandas = Math.max(1, Math.round((fin - ini) / 60));
    var hoy = diaDeHoy();

    /* --- Cabecera de días --- */
    var cab = '<div class="cl-cab"><div class="cl-cab-hora"></div>';
    for (i = 0; i < 7; i++) {
      cab += '<div class="cl-cab-dia' + (i === hoy ? ' hoy' : '') + '" data-dia="' + i + '">' +
        esc(DIAS_CORTOS[i]) + (i === hoy ? '<small>hoy</small>' : '<small>&nbsp;</small>') +
        '</div>';
    }
    cab += '</div>';

    /* --- Columna de horas --- */
    var horas = '<div class="cl-horas">';
    for (i = 0; i < bandas; i++) {
      horas += '<div class="cl-hora">' + textoHora(ini + i * 60) + '</div>';
    }
    horas += '</div>';

    /* --- Columnas de días con sus bloques --- */
    var porDia = AG.Utils.agrupar(validas, function (v) { return String(v.dia); });
    var cols = '';
    for (i = 0; i < 7; i++) {
      var delDia = repartirCarriles(porDia[String(i)] || []);
      cols += '<div class="cl-col' + (i === hoy ? ' hoy' : '') + '" data-dia="' + i + '">';
      for (var j = 0; j < delDia.length; j++) {
        cols += bloqueHTML(delDia[j], ini, usuario, rol);
      }
      cols += '</div>';
    }

    var estiloMarco = '--cl-alto-hora:' + ALTO_HORA + 'px';
    var alto = bandas * ALTO_HORA;

    return '<div class="cl-marco' + (o.resaltarHoy ? ' resalta-hoy' : '') + '" style="' + estiloMarco + '" data-marco>' +
      '<div class="cl-scroll"><div class="cl-rejilla">' +
        cab +
        '<div class="cl-cuerpo" style="min-height:' + alto + 'px">' + horas + cols + '</div>' +
      '</div></div>' +
      '</div>';
  }

  /** Un bloque de color dentro de la cuadrícula. */
  function bloqueHTML(v, minutoBase, usuario, rol) {
    var top = Math.round((v.ini - minutoBase) * PX_POR_MINUTO);
    var alto = Math.max(ALTO_MINIMO_BLOQUE, Math.round(v.dur * PX_POR_MINUTO) - 2);
    var n = Math.max(1, v.carriles);
    var frac = redondear(v.carril / n);
    var anchoFrac = redondear(1 / n);

    var clases = 'cl-bloque';
    var esMia = false;
    if (usuario) {
      if (rol === 'coach' && v.coachId === usuario.id) esMia = true;
      if (rol === 'socio' && v.inscritos.indexOf(usuario.id) >= 0) esMia = true;
    }
    if (esMia) clases += ' mia';
    else if (rol === 'coach' || rol === 'socio') clases += ' atenuada';
    if (v.clase.activa === false) clases += ' atenuada';

    var coach = AG.DB.usuario(v.coachId);
    var meta = textoHora(v.ini) + ' · ' + (coach ? nombreCorto(coach) : 'Sin coach');
    var pctAncho = Math.max(0, Math.min(100, v.pct));

    var estilo = 'top:' + top + 'px;height:' + alto + 'px;' +
      'left:calc(2px + (100% - 4px) * ' + frac + ');' +
      'width:calc((100% - 4px) * ' + anchoFrac + ' - 2px);' +
      '--cl-c:' + v.color + ';--cl-bg:' + tinte(v.color, 0.16);

    var titulo = v.nombre + ' · ' + etiquetaDia(v) + ' ' + rangoHorario(v) +
      ' · ' + v.ocupados + ' de ' + (v.cupo || '—') + ' lugares';

    var html = '<button type="button" class="' + clases + '" style="' + estilo + '"' +
      ' data-clase="' + esc(v.id) + '" title="' + esc(titulo) + '">' +
      '<span class="cl-nom">' + esc(v.nombre) + '</span>';

    if (alto >= 52) {
      html += '<span class="cl-meta">' + esc(meta) + '</span>';
    }
    html += '<span class="cl-pie">' +
        '<span class="cl-track"><i style="width:' + pctAncho + '%"></i></span>' +
        '<span class="cl-ocu">' + v.ocupados + '/' + (v.cupo || '—') + '</span>' +
      '</span>' +
      '</button>';

    return html;
  }

  /** Misma información en formato lista, agrupada por día (móvil). */
  function listaMovilHTML(vistas, opts) {
    var o = opts || {};
    var usuario = o.usuario || null;
    var rol = o.rol || (usuario ? usuario.rol : 'socio');
    var validas = ordenarPorHorario(vistas.filter(function (v) { return v.valida; }));

    if (!validas.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('No hay clases que coincidan con lo que buscas.', 'filtro',
          '<button class="btn btn-outline btn-sm" type="button" data-limpiar>Quitar filtros</button>') +
        '</div></div>';
    }

    var porDia = AG.Utils.agrupar(validas, function (v) { return String(v.dia); });
    var hoy = diaDeHoy();
    var html = '<div class="stack">';

    for (var d = 0; d < 7; d++) {
      var delDia = porDia[String(d)];
      if (!delDia || !delDia.length) continue;

      html += '<div class="card">' +
        '<div class="card-head"><div>' +
          '<h3 class="card-title">' + esc(DIAS_LARGOS[d]) + '</h3>' +
          '<p class="card-sub">' + delDia.length + (delDia.length === 1 ? ' clase' : ' clases') + '</p>' +
        '</div>' + (d === hoy ? '<span class="badge badge-rojo">Hoy</span>' : '') + '</div>' +
        '<div class="list">';

      for (var i = 0; i < delDia.length; i++) {
        html += filaMovilHTML(delDia[i], usuario, rol);
      }
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function filaMovilHTML(v, usuario, rol) {
    var coach = AG.DB.usuario(v.coachId);
    var esMia = false;
    if (usuario) {
      if (rol === 'coach' && v.coachId === usuario.id) esMia = true;
      if (rol === 'socio' && v.inscritos.indexOf(usuario.id) >= 0) esMia = true;
    }

    var detalle = [textoHora(v.ini) + '–' + textoHora(v.fin)];
    if (coach) detalle.push(nombreCorto(coach));
    if (v.salon) detalle.push(v.salon);

    return '<button type="button" class="list-item clickable" data-clase="' + esc(v.id) + '">' +
      '<span class="cl-punto" style="background:' + v.color + '"></span>' +
      '<span class="list-item-main">' +
        '<b>' + esc(v.nombre) + (esMia ? ' ' + AG.Utils.badge(rol === 'socio' ? 'Inscrito' : 'Mi clase', 'ok') : '') + '</b>' +
        '<span>' + esc(detalle.join(' · ')) + '</span>' +
      '</span>' +
      '<span class="list-item-side">' +
        '<span class="mini bold">' + v.ocupados + '/' + (v.cupo || '—') + '</span>' +
      '</span>' +
      '</button>';
  }

  /** Envoltorio que agrupa cuadrícula (escritorio) y lista (móvil). */
  function bloqueHorarioCompleto(vistas, opts) {
    return '<div class="solo-escritorio">' + horarioHTML(vistas, opts) + '</div>' +
      '<div class="solo-movil bloque">' + listaMovilHTML(vistas, opts) + '</div>';
  }

  /* =============================================================
     7. Filtros
     ============================================================= */

  function filtrosHTML(vistas, f, rol) {
    var coaches = AG.Utils.ordenar(AG.DB.coaches(), function (c) { return normalizar(nombreDe(c)); }, 'asc');
    var tipos = tiposDeClase(vistas);
    var i;

    var opcCoaches = '<option value="">Todos los coaches</option>';
    for (i = 0; i < coaches.length; i++) {
      opcCoaches += '<option value="' + esc(coaches[i].id) + '"' +
        (f.coachId === coaches[i].id ? ' selected' : '') + '>' + esc(nombreDe(coaches[i])) + '</option>';
    }

    var opcTipos = '<option value="">Todos los tipos</option>';
    for (i = 0; i < tipos.length; i++) {
      opcTipos += '<option value="' + esc(tipos[i]) + '"' +
        (normalizar(f.tipo) === normalizar(tipos[i]) ? ' selected' : '') + '>' + esc(tipos[i]) + '</option>';
    }

    var extra = '';
    if (rol === 'coach') {
      extra = '<button type="button" class="chip' + (f.soloMias ? ' on' : '') + '" data-solo-mias>' +
        icono('coach', 14) + 'Solo mis clases</button>';
    } else if (rol === 'socio') {
      extra = '<button type="button" class="chip' + (f.soloMias ? ' on' : '') + '" data-solo-mias>' +
        icono('check', 14) + 'Solo mis inscripciones</button>';
    }

    return '<div class="card">' +
      '<div class="card-body">' +
        '<div class="form-row">' +
          '<div class="field"><label class="label" for="cl-f-coach">Coach</label>' +
            '<select class="select" id="cl-f-coach" data-filtro="coachId">' + opcCoaches + '</select></div>' +
          '<div class="field"><label class="label" for="cl-f-tipo">Tipo de clase</label>' +
            '<select class="select" id="cl-f-tipo" data-filtro="tipo">' + opcTipos + '</select></div>' +
          '<div class="field" style="flex:0 0 auto">' +
            '<span class="label">Vista</span>' +
            '<div class="row row-sm wrap">' +
              extra +
              '<button type="button" class="chip" data-limpiar>' + icono('x', 14) + 'Limpiar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  /* =============================================================
     8. Modal: detalle de una clase
     ============================================================= */

  /** Estado de membresía legible de un socio. */
  function estadoSocio(socio) {
    try {
      return AG.Calc.estadoMembresia(socio);
    } catch (e) {
      return { estado: 'vencido', clase: 'badge-muted', texto: 'Sin datos de membresía' };
    }
  }

  /** ¿La membresía permite inscribirse a clases? */
  function puedeInscribirse(socio) {
    if (!socio) return { ok: false, motivo: 'No encontramos tu ficha de socio.' };
    var e = estadoSocio(socio);
    if (e.estado === 'activo' || e.estado === 'por_vencer') return { ok: true, estado: e };
    if (e.estado === 'congelado') {
      return { ok: false, estado: e, motivo: 'Tu membresía está congelada. Actívala en recepción para volver a inscribirte a clases.' };
    }
    if (e.estado === 'baja') {
      return { ok: false, estado: e, motivo: 'Tu cuenta está dada de baja. Pasa a recepción para reactivarla.' };
    }
    return {
      ok: false,
      estado: e,
      motivo: 'Tu membresía está vencida. Renuévala para poder inscribirte a las clases del gimnasio.'
    };
  }

  /** Asistencia registrada hoy para un socio (o null). */
  function asistenciaDeHoy(socioId) {
    var hoy = AG.Utils.hoy();
    var lista = AG.DB.asistenciasDe(socioId);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && String(lista[i].fecha || '').slice(0, 10) === hoy) return lista[i];
    }
    return null;
  }

  /**
   * Registra la entrada del socio.
   * Usa AG.Mod.Asistencia.checkIn cuando está disponible; si el módulo aún no
   * se cargó, escribe la asistencia por AG.DB para no dejar al coach sin lista.
   */
  function marcarAsistencia(socioId) {
    var previa = asistenciaDeHoy(socioId);
    if (previa) return { ok: false, motivo: 'repetida', asistencia: previa };

    var mod = AG.Mod && AG.Mod.Asistencia;
    if (mod && typeof mod.checkIn === 'function') {
      try {
        mod.checkIn(socioId);
      } catch (e) {
        return { ok: false, motivo: 'error' };
      }
      return { ok: true, delegado: true, asistencia: asistenciaDeHoy(socioId) };
    }

    var registro = AG.DB.insertar('asistencias', {
      socioId: socioId,
      fecha: AG.Utils.hoy(),
      entrada: horaActual(),
      salida: null
    });
    return { ok: true, delegado: false, asistencia: registro };
  }

  /** Lista de inscritos para el director (con baja) o para el coach (con pase de lista). */
  function inscritosHTML(v, usuario, modo) {
    if (!v.inscritos.length) {
      return vacio('Todavía nadie se ha inscrito a esta clase.', 'socios');
    }

    var socios = [];
    for (var i = 0; i < v.inscritos.length; i++) {
      var s = AG.DB.usuario(v.inscritos[i]);
      if (s) socios.push(s);
    }
    socios = AG.Utils.ordenar(socios, function (s) { return normalizar(nombreDe(s)); }, 'asc');

    if (!socios.length) {
      return vacio('Los socios inscritos ya no están en el padrón.', 'socios');
    }

    var html = '<div class="list">';
    for (var j = 0; j < socios.length; j++) {
      html += filaInscritoHTML(socios[j], usuario, modo);
    }
    html += '</div>';
    return html;
  }

  function filaInscritoHTML(socio, usuario, modo) {
    var est = estadoSocio(socio);
    var visible = AG.Auth.puedeVer(usuario, socio.id);
    var detalle = [];

    if (socio.codigo) detalle.push(socio.codigo);
    if (modo === 'coach') {
      /* El teléfono solo se muestra si el coach tiene asignado a ese socio. */
      detalle.push(visible ? (socio.telefono || 'Sin teléfono') : 'Contacto reservado');
    }

    var lado = '';
    if (modo === 'director') {
      lado = '<button type="button" class="btn-icono peligro" data-baja="' + esc(socio.id) + '"' +
        ' title="Dar de baja de la clase" aria-label="Dar de baja a ' + esc(nombreDe(socio)) + '">' +
        icono('basura', 16) + '</button>';
    } else if (modo === 'coach') {
      var asis = asistenciaDeHoy(socio.id);
      lado = asis
        ? '<span class="badge badge-ok">' + icono('check', 13) + 'Asistió ' + esc(asis.entrada || '') + '</span>'
        : '<button type="button" class="btn btn-sm btn-outline" data-asistencia="' + esc(socio.id) + '">Marcar</button>';
    }

    return '<div class="list-item">' +
      AG.Utils.avatar(socio, 'sm') +
      '<div class="list-item-main">' +
        '<b>' + esc(nombreDe(socio)) + '</b>' +
        '<span>' + esc(detalle.join(' · ')) + '</span>' +
      '</div>' +
      '<div class="list-item-side">' +
        '<span class="badge ' + esc(est.clase) + '">' + esc(est.texto) + '</span>' +
        lado +
      '</div>' +
      '</div>';
  }

  /**
   * Abre el detalle de una clase con las acciones que su rol permita.
   * @param {String} claseId
   * @param {Object} usuario
   */
  function abrirClase(claseId, usuario) {
    var clase = AG.DB.buscar('clases', claseId);
    if (!clase) {
      AG.Utils.toast('Esa clase ya no existe en el horario.', 'warn');
      AG.Router.refrescar();
      return;
    }
    if (!usuario) return;

    var v = vistaDe(clase);
    var rol = usuario.rol;
    var huboCambios = false;

    var cuerpo = '<div class="stack" data-detalle>' +
      pildorasDe(v) +
      fichaCoach(v) +
      barraOcupacion(v, true) +
      '<div data-zona-rol"></div>' +
      '</div>';

    var acciones = [];

    if (rol === 'director') {
      acciones.push({
        texto: 'Eliminar', clase: 'btn-danger', icono: 'basura',
        onClick: function (api) { api.cerrar(); eliminarClase(v); }
      });
      acciones.push({
        texto: 'Editar', clase: 'btn-primary', icono: 'editar',
        onClick: function (api) { api.cerrar(); formulario(clase.id); }
      });
    } else if (rol === 'coach' && v.coachId === usuario.id && v.inscritos.length) {
      acciones.push({
        texto: 'Marcar asistencia a todos', clase: 'btn-ok', icono: 'check',
        onClick: function (api) {
          var pendientes = 0, listos = 0;
          for (var i = 0; i < v.inscritos.length; i++) {
            var r = marcarAsistencia(v.inscritos[i]);
            if (r.ok) listos++;
            else if (r.motivo === 'repetida') pendientes++;
          }
          if (listos) {
            huboCambios = true;
            AG.Utils.toast('Asistencia registrada para ' + listos + (listos === 1 ? ' socio.' : ' socios.'), 'ok');
          } else if (pendientes) {
            AG.Utils.toast('Todos los inscritos ya tenían su asistencia de hoy.', 'info');
          } else {
            AG.Utils.toast('No se pudo registrar la asistencia.', 'error');
          }
          repintarZona(api.root);
          return false;
        }
      });
    } else if (rol === 'socio') {
      var inscrito = v.inscritos.indexOf(usuario.id) >= 0;
      var permiso = puedeInscribirse(AG.DB.usuario(usuario.id));

      if (inscrito) {
        acciones.push({
          texto: 'Cancelar inscripción', clase: 'btn-danger', icono: 'x',
          onClick: function (api) {
            api.cerrar();
            cancelarInscripcion(v, usuario);
          }
        });
      } else {
        acciones.push({
          texto: v.lleno ? 'Cupo lleno' : 'Inscribirme',
          clase: 'btn-primary',
          icono: 'check',
          deshabilitado: v.lleno || !permiso.ok,
          onClick: function (api) {
            api.cerrar();
            inscribir(v, usuario);
          }
        });
      }
    }

    acciones.unshift({ texto: 'Cerrar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } });

    /** Repinta solo la parte que depende del rol (no cierra el modal). */
    function repintarZona(root) {
      var actual = AG.DB.buscar('clases', claseId);
      if (!actual) return;
      v = vistaDe(actual);
      var zona = root.querySelector('[data-zona-rol]');
      if (zona) zona.innerHTML = zonaPorRol(v, usuario);
      var barra = root.querySelector('[data-barra]');
      if (barra) barra.innerHTML = barraOcupacion(v, true);
    }

    AG.Utils.modal({
      titulo: v.nombre,
      ancho: 'lg',
      cuerpo: '<div class="stack">' +
        pildorasDe(v) +
        fichaCoach(v) +
        '<div data-barra>' + barraOcupacion(v, true) + '</div>' +
        '<div data-zona-rol>' + zonaPorRol(v, usuario) + '</div>' +
        '</div>',
      acciones: acciones,
      onOpen: function (root, api) {
        /* Baja de un inscrito (director). */
        AG.Utils.delegar(root, 'click', '[data-baja]', function (e, el) {
          e.preventDefault();
          var socioId = el.getAttribute('data-baja');
          var socio = AG.DB.usuario(socioId);
          AG.Utils.confirmar(
            '¿Dar de baja a ' + nombreDe(socio) + ' de la clase «' + v.nombre + '»?',
            'Quitar de la clase',
            { textoOk: 'Sí, dar de baja', peligro: true }
          ).then(function (ok) {
            if (!ok) return;
            if (quitarInscrito(claseId, socioId, true)) {
              huboCambios = true;
              repintarZona(root);
            }
          });
        });

        /* Pase de lista (coach). */
        AG.Utils.delegar(root, 'click', '[data-asistencia]', function (e, el) {
          e.preventDefault();
          var socioId = el.getAttribute('data-asistencia');
          var socio = AG.DB.usuario(socioId);
          var r = marcarAsistencia(socioId);

          if (r.ok) {
            huboCambios = true;
            AG.Utils.toast('Asistencia registrada para ' + nombreDe(socio) + '.', 'ok');
          } else if (r.motivo === 'repetida') {
            AG.Utils.toast(nombreDe(socio) + ' ya tenía su asistencia de hoy.', 'info');
          } else {
            AG.Utils.toast('No se pudo registrar la asistencia.', 'error');
          }
          repintarZona(root);
        });

        /* Ir a la membresía desde el aviso del socio. */
        AG.Utils.delegar(root, 'click', '[data-ir-membresia]', function (e) {
          e.preventDefault();
          api.cerrar();
          AG.Router.ir('socio/membresia');
        });
      },
      onCerrar: function () {
        if (huboCambios) AG.Router.refrescar();
      }
    });
  }

  /** Contenido del modal que cambia según quién lo abre. */
  function zonaPorRol(v, usuario) {
    var rol = usuario.rol;

    if (rol === 'director') {
      return '<div class="stack-sm">' +
        '<div class="row between wrap">' +
          '<b>Inscritos</b>' +
          '<span class="mini muted">' + v.ocupados + ' de ' + (v.cupo || '—') + ' lugares</span>' +
        '</div>' +
        inscritosHTML(v, usuario, 'director') +
        '</div>';
    }

    if (rol === 'coach') {
      if (v.coachId !== usuario.id) {
        /* Un coach no ve el padrón de las clases de otro coach. */
        return '<div class="aviso aviso-info">' + icono('candado', 16) +
          '<span>Esta clase la imparte otro coach. Puedes consultar el horario, pero la lista de inscritos ' +
          'solo la ve quien la dirige.</span></div>';
      }
      return '<div class="stack-sm">' +
        '<div class="row between wrap">' +
          '<b>Pase de lista</b>' +
          '<span class="mini muted">Se registra con fecha de hoy · ' + esc(AG.Utils.fecha(AG.Utils.hoy(), 'corto')) + '</span>' +
        '</div>' +
        inscritosHTML(v, usuario, 'coach') +
        '</div>';
    }

    /* Socio */
    var socio = AG.DB.usuario(usuario.id);
    var inscrito = v.inscritos.indexOf(usuario.id) >= 0;
    var permiso = puedeInscribirse(socio);
    var html = '';

    if (inscrito) {
      html += '<div class="aviso aviso-ok">' + icono('check', 16) +
        '<span>Ya estás inscrito en esta clase. Llega 10 minutos antes para calentar.</span></div>';
    } else if (!permiso.ok) {
      html += '<div class="aviso aviso-warn">' + icono('alerta', 16) +
        '<span><b>No puedes inscribirte todavía.</b><br>' + esc(permiso.motivo) + '</span></div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-ir-membresia>' +
          icono('tarjeta', 15) + 'Ver mi membresía</button>';
    } else if (v.lleno) {
      html += '<div class="aviso aviso-warn">' + icono('info', 16) +
        '<span>Esta clase ya no tiene lugares disponibles. Consulta otro horario del mismo tipo.</span></div>';
    } else {
      var libres = Math.max(0, v.cupo - v.ocupados);
      html += '<div class="aviso aviso-info">' + icono('info', 16) +
        '<span>Quedan <b>' + libres + '</b> ' + (libres === 1 ? 'lugar disponible' : 'lugares disponibles') +
        '. Puedes inscribirte desde el botón de abajo.</span></div>';
    }

    return html;
  }

  /* =============================================================
     9. Altas, cambios y bajas (director) e inscripciones (socio)
     ============================================================= */

  /** Guarda la nueva lista de inscritos de una clase. */
  function guardarInscritos(claseId, inscritos) {
    return AG.DB.actualizar('clases', claseId, { inscritos: inscritos.slice() });
  }

  /**
   * Quita a un socio de una clase.
   * @param {Boolean} avisar  manda notificación al socio
   */
  function quitarInscrito(claseId, socioId, avisar) {
    var clase = AG.DB.buscar('clases', claseId);
    if (!clase) {
      AG.Utils.toast('Esa clase ya no existe.', 'error');
      return false;
    }
    var lista = esArreglo(clase.inscritos) ? clase.inscritos.slice() : [];
    var i = lista.indexOf(socioId);
    if (i < 0) {
      AG.Utils.toast('Ese socio ya no estaba inscrito.', 'info');
      return false;
    }
    lista.splice(i, 1);
    guardarInscritos(claseId, lista);

    if (avisar) {
      AG.DB.notificar(socioId, {
        titulo: 'Te dimos de baja de una clase',
        cuerpo: 'Ya no estás inscrito en «' + clase.nombre + '» de los ' + etiquetaDia(vistaDe(clase)).toLowerCase() +
          ' a las ' + clase.hora + '. Si fue un error, avísanos en recepción.',
        tipo: 'aviso',
        link: '#/socio/clases'
      });
    }

    AG.Utils.toast('Socio dado de baja de la clase.', 'ok');
    return true;
  }

  /** Inscribe al socio en la clase, validando cupo y membresía. */
  function inscribir(v, usuario) {
    var clase = AG.DB.buscar('clases', v.id);
    if (!clase) {
      AG.Utils.toast('Esa clase ya no existe en el horario.', 'error');
      AG.Router.refrescar();
      return;
    }

    var socio = AG.DB.usuario(usuario.id);
    var permiso = puedeInscribirse(socio);
    if (!permiso.ok) {
      AG.Utils.toast(permiso.motivo, 'warn');
      return;
    }

    var actual = vistaDe(clase);
    if (actual.inscritos.indexOf(usuario.id) >= 0) {
      AG.Utils.toast('Ya estabas inscrito en esta clase.', 'info');
      AG.Router.refrescar();
      return;
    }
    if (actual.lleno) {
      AG.Utils.toast('La clase se llenó mientras la revisabas.', 'warn');
      AG.Router.refrescar();
      return;
    }

    var lista = actual.inscritos.slice();
    lista.push(usuario.id);
    guardarInscritos(clase.id, lista);

    AG.Utils.toast('¡Listo! Quedaste inscrito en ' + clase.nombre + ' · ' +
      etiquetaDia(actual) + ' ' + textoHora(actual.ini) + '.', 'ok');
    AG.Router.refrescar();
  }

  /** Cancela la inscripción del socio con confirmación. */
  function cancelarInscripcion(v, usuario) {
    AG.Utils.confirmar(
      '¿Cancelar tu inscripción en «' + v.nombre + '» de los ' + etiquetaDia(v).toLowerCase() +
      ' a las ' + textoHora(v.ini) + '?',
      'Cancelar inscripción',
      { textoOk: 'Sí, cancelar', peligro: true }
    ).then(function (ok) {
      if (!ok) return;
      var clase = AG.DB.buscar('clases', v.id);
      if (!clase) {
        AG.Utils.toast('Esa clase ya no existe en el horario.', 'error');
        AG.Router.refrescar();
        return;
      }
      var lista = esArreglo(clase.inscritos) ? clase.inscritos.slice() : [];
      var i = lista.indexOf(usuario.id);
      if (i < 0) {
        AG.Utils.toast('No estabas inscrito en esta clase.', 'info');
        AG.Router.refrescar();
        return;
      }
      lista.splice(i, 1);
      guardarInscritos(clase.id, lista);
      AG.Utils.toast('Cancelamos tu inscripción. El lugar queda libre para alguien más.', 'ok');
      AG.Router.refrescar();
    });
  }

  /** Elimina una clase con confirmación y avisa a sus inscritos. */
  function eliminarClase(v) {
    var detalle = v.ocupados
      ? 'Se avisará a los ' + v.ocupados + ' socios inscritos.'
      : 'Esta clase no tiene inscritos.';

    AG.Utils.confirmar(
      '¿Eliminar la clase «' + v.nombre + '» de los ' + etiquetaDia(v).toLowerCase() +
      ' a las ' + textoHora(v.ini) + '?',
      'Eliminar clase',
      { textoOk: 'Sí, eliminar', peligro: true, detalle: detalle }
    ).then(function (ok) {
      if (!ok) return;
      var clase = AG.DB.buscar('clases', v.id);
      if (!clase) {
        AG.Utils.toast('Esa clase ya se había eliminado.', 'info');
        AG.Router.refrescar();
        return;
      }

      var inscritos = esArreglo(clase.inscritos) ? clase.inscritos.slice() : [];
      var nombre = clase.nombre;
      var dia = etiquetaDia(v).toLowerCase();
      var hora = textoHora(v.ini);

      AG.DB.eliminar('clases', clase.id);

      for (var i = 0; i < inscritos.length; i++) {
        AG.DB.notificar(inscritos[i], {
          titulo: 'Se canceló una clase',
          cuerpo: 'La clase «' + nombre + '» de los ' + dia + ' a las ' + hora +
            ' salió del horario. Consulta las opciones disponibles en tu panel de clases.',
          tipo: 'aviso',
          link: '#/socio/clases'
        });
      }

      AG.Utils.toast('Clase eliminada del horario.', 'ok');
      AG.Router.refrescar();
    });
  }

  /**
   * Modal de alta o edición de clase (solo dirección).
   * @param {String|null} claseId
   */
  function formulario(claseId) {
    var usuario = AG.Auth.actual();
    if (!usuario || usuario.rol !== 'director') {
      AG.Utils.toast('Solo la dirección puede editar el horario de clases.', 'warn');
      return;
    }

    var clase = claseId ? AG.DB.buscar('clases', claseId) : null;
    if (claseId && !clase) {
      AG.Utils.toast('Esa clase ya no existe.', 'error');
      AG.Router.refrescar();
      return;
    }

    var esNueva = !clase;
    var v = clase ? vistaDe(clase) : null;
    var coaches = AG.Utils.ordenar(AG.DB.coaches(), function (c) { return normalizar(nombreDe(c)); }, 'asc');

    if (!coaches.length) {
      AG.Utils.toast('Primero registra al menos un coach para poder crear clases.', 'warn');
      return;
    }

    var coachElegido = v ? v.coachId : coaches[0].id;
    var diaElegido = v && v.valida ? v.dia : diaDeHoy();
    var horaElegida = v && v.valida ? textoHora(v.ini) : '07:00';
    var color = v ? v.color : COLOR_POR_DEFECTO;
    var i;

    var opcCoaches = '';
    for (i = 0; i < coaches.length; i++) {
      opcCoaches += '<option value="' + esc(coaches[i].id) + '"' +
        (coaches[i].id === coachElegido ? ' selected' : '') + '>' + esc(nombreDe(coaches[i])) + '</option>';
    }

    var opcDias = '';
    for (i = 0; i < DIAS.length; i++) {
      opcDias += '<option value="' + esc(DIAS[i]) + '"' +
        (i === diaElegido ? ' selected' : '') + '>' + esc(DIAS_LARGOS[i]) + '</option>';
    }

    var chipsColor = '';
    for (i = 0; i < COLORES_SUGERIDOS.length; i++) {
      chipsColor += '<button type="button" class="btn-icono" data-color="' + COLORES_SUGERIDOS[i] + '"' +
        ' title="Usar este color" aria-label="Color ' + (i + 1) + '"' +
        ' style="background:' + COLORES_SUGERIDOS[i] + ';border-color:' + COLORES_SUGERIDOS[i] + ';width:26px;height:26px"></button>';
    }

    var minimoCupo = v ? Math.max(1, v.ocupados) : 1;

    var cuerpo = '<form class="form-grid dos" data-form-clase novalidate>' +
      '<div class="field ancho-total">' +
        '<label class="label" for="cl-nombre">Nombre de la clase <span class="req">*</span></label>' +
        '<input class="input" id="cl-nombre" name="nombre" maxlength="40" autocomplete="off"' +
        ' placeholder="Spinning, Yoga, HIIT…" value="' + esc(v ? v.nombre : '') + '">' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="cl-coach">Coach a cargo</label>' +
        '<select class="select" id="cl-coach" name="coachId">' + opcCoaches + '</select>' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="cl-dia">Día</label>' +
        '<select class="select" id="cl-dia" name="dia">' + opcDias + '</select>' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="cl-hora">Hora de inicio</label>' +
        '<input class="input" id="cl-hora" name="hora" type="time" step="300" value="' + esc(horaElegida) + '">' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="cl-dur">Duración (minutos)</label>' +
        '<input class="input" id="cl-dur" name="duracionMin" type="number" min="15" max="180" step="5"' +
        ' value="' + (v ? v.dur : 45) + '">' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="cl-cupo">Cupo</label>' +
        '<input class="input" id="cl-cupo" name="cupo" type="number" min="' + minimoCupo + '" max="120" step="1"' +
        ' value="' + (v ? Math.max(v.cupo, minimoCupo) : 20) + '">' +
        (v && v.ocupados ? '<p class="help">Hay ' + v.ocupados + ' inscritos: el cupo no puede quedar por debajo.</p>' : '') +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="cl-salon">Salón o área</label>' +
        '<input class="input" id="cl-salon" name="salon" maxlength="40" autocomplete="off"' +
        ' placeholder="Salón 1, Zona funcional…" value="' + esc(v ? v.salon : '') + '">' +
      '</div>' +

      '<div class="field ancho-total">' +
        '<label class="label" for="cl-color">Color en el horario</label>' +
        '<div class="row row-sm wrap">' +
          '<input class="input" id="cl-color" name="color" type="color" value="' + color + '" style="max-width:64px">' +
          chipsColor +
        '</div>' +
      '</div>' +

      '<div class="field ancho-total">' +
        '<label class="check"><input type="checkbox" name="activa"' + (!v || v.clase.activa !== false ? ' checked' : '') + '>' +
        '<span>Mostrar esta clase en el horario</span></label>' +
      '</div>' +
      '</form>';

    AG.Utils.modal({
      titulo: esNueva ? 'Nueva clase' : 'Editar clase',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } },
        {
          texto: esNueva ? 'Crear clase' : 'Guardar cambios',
          clase: 'btn-primary',
          icono: 'check',
          onClick: function (api) {
            var form = api.root.querySelector('[data-form-clase]');
            if (!form) return false;
            if (guardarDesdeFormulario(form, clase, minimoCupo)) api.cerrar();
            return false;
          }
        }
      ],
      onOpen: function (root) {
        AG.Utils.delegar(root, 'click', '[data-color]', function (e, el) {
          e.preventDefault();
          var campo = root.querySelector('#cl-color');
          if (campo) campo.value = el.getAttribute('data-color');
        });
      }
    });
  }

  /** Valida el formulario y persiste la clase. @returns {Boolean} guardado */
  function guardarDesdeFormulario(form, clase, minimoCupo) {
    var d = AG.Utils.formToObject(form);

    var nombre = String(d.nombre || '').trim();
    if (!nombre) {
      AG.Utils.toast('Escribe el nombre de la clase.', 'error');
      var campoNombre = form.querySelector('#cl-nombre');
      if (campoNombre) campoNombre.focus();
      return false;
    }

    var dia = indiceDia(d.dia);
    if (dia < 0) {
      AG.Utils.toast('Elige un día de la semana válido.', 'error');
      return false;
    }

    var minutos = minutosDe(d.hora);
    if (minutos === null) {
      AG.Utils.toast('Escribe la hora de inicio con el formato HH:MM.', 'error');
      return false;
    }

    var dur = Math.round(Number(d.duracionMin));
    if (!isFinite(dur) || dur < 15 || dur > 180) {
      AG.Utils.toast('La duración debe estar entre 15 y 180 minutos.', 'error');
      return false;
    }

    var cupo = Math.round(Number(d.cupo));
    if (!isFinite(cupo) || cupo < 1 || cupo > 120) {
      AG.Utils.toast('El cupo debe estar entre 1 y 120 personas.', 'error');
      return false;
    }
    if (cupo < minimoCupo) {
      AG.Utils.toast('Ya hay ' + minimoCupo + ' inscritos: el cupo no puede ser menor.', 'error');
      return false;
    }

    var coach = AG.DB.usuario(d.coachId);
    if (!coach || coach.rol !== 'coach') {
      AG.Utils.toast('Elige un coach del listado.', 'error');
      return false;
    }

    var datos = {
      nombre: nombre,
      coachId: coach.id,
      dia: DIAS[dia],
      hora: textoHora(minutos),
      duracionMin: dur,
      cupo: cupo,
      salon: String(d.salon || '').trim(),
      color: colorSeguro(d.color),
      activa: d.activa !== false
    };

    if (clase) {
      AG.DB.actualizar('clases', clase.id, datos);
      AG.Utils.toast('Clase actualizada.', 'ok');
    } else {
      datos.inscritos = [];
      AG.DB.insertar('clases', datos);
      AG.Utils.toast('Clase agregada al horario.', 'ok');
    }

    AG.Router.refrescar();
    return true;
  }

  /* =============================================================
     10. Indicadores del director
     ============================================================= */

  function kpisHTML(vistas) {
    var validas = vistas.filter(function (v) { return v.valida; });

    if (!validas.length) {
      return '';
    }

    var ocupacionMedia = AG.Utils.promedio(validas, function (v) { return v.pct; });

    var masLlena = null;
    var i;
    for (i = 0; i < validas.length; i++) {
      if (!masLlena || validas[i].pct > masLlena.pct ||
         (validas[i].pct === masLlena.pct && validas[i].ocupados > masLlena.ocupados)) {
        masLlena = validas[i];
      }
    }

    var porCoach = AG.Utils.agrupar(validas, function (v) { return v.coachId || 'sin_coach'; });
    var mejorCoach = null, mejorConteo = 0;
    for (var id in porCoach) {
      if (!Object.prototype.hasOwnProperty.call(porCoach, id)) continue;
      if (porCoach[id].length > mejorConteo) {
        mejorConteo = porCoach[id].length;
        mejorCoach = id === 'sin_coach' ? null : AG.DB.usuario(id);
      }
    }

    var lugares = AG.Utils.suma(validas, function (v) { return v.cupo; });
    var ocupados = AG.Utils.suma(validas, function (v) { return v.ocupados; });

    function kpi(claseExtra, iconoNombre, valor, etiqueta) {
      return '<div class="kpi ' + claseExtra + '">' +
        '<div class="kpi-icono">' + icono(iconoNombre, 22) + '</div>' +
        '<div class="kpi-datos">' +
          '<div class="kpi-val">' + valor + '</div>' +
          '<div class="kpi-label">' + etiqueta + '</div>' +
        '</div>' +
        '</div>';
    }

    return '<div class="grid g4">' +
      kpi('kpi-info', 'grafica', esc(AG.Utils.pct(ocupacionMedia, 0)), 'Ocupación media') +
      kpi('kpi-ok', 'trofeo',
        masLlena ? esc(masLlena.nombre) : '—',
        masLlena ? 'Más llena · ' + esc(AG.Utils.pct(masLlena.pct, 0)) : 'Clase más llena') +
      kpi('kpi-warn', 'coach',
        mejorCoach ? esc(nombreCorto(mejorCoach)) : '—',
        mejorConteo ? 'Con ' + mejorConteo + (mejorConteo === 1 ? ' clase' : ' clases') : 'Coach con más clases') +
      kpi('', 'socios', ocupados + ' / ' + lugares, 'Lugares ocupados') +
      '</div>';
  }

  /* =============================================================
     11. Próxima clase
     ============================================================= */

  /**
   * Próxima clase de un usuario (socio: donde está inscrito; coach: las que imparte).
   * @param {Object|String} usuario  objeto Usuario o su id
   * @returns {{clase:Object, cuando:String, dia:String, hora:String, minutos:Number, enCurso:Boolean}|null}
   */
  function proximaDe(usuario) {
    var u = (usuario && typeof usuario === 'object') ? usuario : AG.DB.usuario(usuario);
    if (!u || !u.id) return null;

    var todas = todasLasVistas(false);
    var candidatas = [];
    var i;

    for (i = 0; i < todas.length; i++) {
      var v = todas[i];
      if (!v.valida) continue;
      if (u.rol === 'coach') {
        if (v.coachId === u.id) candidatas.push(v);
      } else if (u.rol === 'socio') {
        if (v.inscritos.indexOf(u.id) >= 0) candidatas.push(v);
      } else {
        candidatas.push(v);
      }
    }
    if (!candidatas.length) return null;

    var diaHoy = diaDeHoy();
    var minAhora = minutosDeAhora();
    var mejor = null, mejorMin = Infinity, mejorEnCurso = false;

    for (i = 0; i < candidatas.length; i++) {
      var c = candidatas[i];
      var enCurso = (c.dia === diaHoy && minAhora >= c.ini && minAhora < c.fin);
      var espera;

      if (enCurso) {
        espera = 0;
      } else {
        var saltoDias = (c.dia - diaHoy + 7) % 7;
        espera = saltoDias * 1440 + c.ini - minAhora;
        if (espera < 0) espera += 7 * 1440;
      }

      if (espera < mejorMin || (espera === mejorMin && enCurso && !mejorEnCurso)) {
        mejorMin = espera;
        mejor = c;
        mejorEnCurso = enCurso;
      }
    }
    if (!mejor) return null;

    return {
      clase: mejor.clase,
      cuando: textoCuando(mejor, mejorMin, mejorEnCurso, minAhora),
      dia: DIAS_LARGOS[mejor.dia],
      hora: textoHora(mejor.ini),
      minutos: mejorMin,
      enCurso: mejorEnCurso,
      vista: mejor
    };
  }

  /** 'En curso', 'En 25 minutos', 'Hoy a las 19:00', 'Mañana…', 'Jueves…'. */
  function textoCuando(v, espera, enCurso, minAhora) {
    if (enCurso) return 'En curso · termina a las ' + textoHora(v.fin);
    if (espera < 60) {
      var m = Math.max(1, Math.round(espera));
      return 'En ' + m + (m === 1 ? ' minuto' : ' minutos');
    }
    var saltoDias = Math.floor((minAhora + espera) / 1440);
    if (saltoDias === 0) return 'Hoy a las ' + textoHora(v.ini);
    if (saltoDias === 1) return 'Mañana a las ' + textoHora(v.ini);
    return DIAS_LARGOS[v.dia] + ' a las ' + textoHora(v.ini);
  }

  /** Tarjeta destacada de "mi próxima clase". */
  function proximaHTML(usuario) {
    var prox = proximaDe(usuario);
    if (!prox) return '';

    var v = prox.vista;
    var coach = AG.DB.usuario(v.coachId);
    var detalle = [etiquetaDia(v) + ' ' + rangoHorario(v)];
    if (v.salon) detalle.push(v.salon);
    if (usuario.rol === 'socio' && coach) detalle.push('Coach ' + nombreCorto(coach));
    if (usuario.rol === 'coach') detalle.push(v.ocupados + ' de ' + (v.cupo || '—') + ' inscritos');

    return '<div class="card card-rojo">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">' + icono('rayo', 18) + 'Mi próxima clase</h3>' +
        '<p class="card-sub">' + esc(prox.cuando) + '</p>' +
      '</div></div>' +
      '<div class="card-body">' +
        '<div class="row between wrap">' +
          '<div class="row row-sm">' +
            '<span class="cl-punto" style="background:' + v.color + '"></span>' +
            '<div class="persona-txt">' +
              '<b>' + esc(v.nombre) + '</b>' +
              '<span>' + esc(detalle.join(' · ')) + '</span>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-outline" data-clase="' + esc(v.id) + '">' +
            icono('ojo', 15) + 'Ver detalle</button>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  /* =============================================================
     12. Vistas de las tres rutas
     ============================================================= */

  /** Aviso del director con las clases mal capturadas (día u hora inválidos). */
  function avisoInvalidasHTML(vistas) {
    var malas = vistas.filter(function (v) { return !v.valida; });
    if (!malas.length) return '';

    var html = '<div class="card"><div class="card-head"><div>' +
      '<h3 class="card-title">' + icono('alerta', 18) + 'Clases fuera de la cuadrícula</h3>' +
      '<p class="card-sub">Les falta un día o una hora válidos, por eso no aparecen en el horario.</p>' +
      '</div></div><div class="list">';

    for (var i = 0; i < malas.length; i++) {
      var v = malas[i];
      html += '<button type="button" class="list-item clickable" data-editar="' + esc(v.id) + '">' +
        '<span class="cl-punto" style="background:' + v.color + '"></span>' +
        '<span class="list-item-main"><b>' + esc(v.nombre) + '</b>' +
        '<span>' + esc(String(v.clase.dia || 'sin día') + ' · ' + String(v.clase.hora || 'sin hora')) + '</span></span>' +
        '<span class="list-item-side"><span class="badge badge-warn">Corregir</span></span>' +
        '</button>';
    }
    html += '</div></div>';
    return html;
  }

  /** Encabezado común de las tres pantallas. */
  function cabeceraHTML(subtitulo, acciones) {
    return '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title">' + icono('clase', 22) + 'Clases</h1>' +
        '<p class="page-sub">' + esc(subtitulo) + '</p>' +
      '</div>' +
      '<div class="page-acciones">' + acciones + '</div>' +
      '</div>';
  }

  function botonHoyHTML(activo) {
    return '<button type="button" class="btn ' + (activo ? 'btn-primary' : 'btn-outline') + '" data-hoy>' +
      icono('calendario', 16) + 'Hoy</button>';
  }

  /**
   * Render compartido de las tres rutas.
   * @param {Object} ctx  contexto del router
   * @param {String} rol  'director' | 'coach' | 'socio'
   */
  function render(ctx, rol) {
    inyectarEstilos();

    var usuario = ctx.usuario;
    var f = filtros[rol];
    var todas = todasLasVistas(rol === 'director');
    var visibles = aplicarFiltros(todas, f, usuario);
    var hayClases = todas.length > 0;

    var acciones = '';
    if (rol === 'director') {
      acciones += '<button type="button" class="btn btn-primary" data-nueva>' +
        icono('mas', 16) + 'Nueva clase</button>';
    }
    acciones += botonHoyHTML(f.resaltarHoy);

    var subtitulo;
    if (rol === 'director') {
      subtitulo = 'Horario semanal del gimnasio: cupos, coaches e inscritos.';
    } else if (rol === 'coach') {
      subtitulo = 'Todo el horario del gimnasio, con tus clases resaltadas.';
    } else {
      subtitulo = 'Consulta el horario e inscríbete a las clases con lugar disponible.';
    }

    var html = '<div class="page" data-clases>' + cabeceraHTML(subtitulo, acciones);

    if (!hayClases) {
      html += '<div class="card"><div class="card-body">' +
        vacio(
          rol === 'director'
            ? 'Todavía no hay clases en el horario. Crea la primera para que coaches y socios la vean.'
            : 'Todavía no hay clases grupales publicadas. En cuanto dirección arme el horario aparecerá aquí.',
          'clase',
          rol === 'director'
            ? '<button type="button" class="btn btn-primary" data-nueva>' + icono('mas', 16) + 'Crear la primera clase</button>'
            : ''
        ) +
        '</div></div></div>';
      return { html: html, listo: engancharFactory(rol) };
    }

    /* Bloques propios de cada rol */
    if (rol === 'director') {
      html += kpisHTML(todas);
    }

    if (rol === 'coach' || rol === 'socio') {
      html += proximaHTML(usuario);
    }

    if (rol === 'socio') {
      html += avisoSocioHTML(usuario, todas);
    }

    html += filtrosHTML(todas, f, rol);

    html += '<div data-horario>' +
      bloqueHorarioCompleto(visibles, { usuario: usuario, rol: rol, resaltarHoy: f.resaltarHoy }) +
      '</div>';

    html += leyendaHTML(rol);

    if (rol === 'director') {
      html += avisoInvalidasHTML(todas);
    }

    html += '</div>';

    return { html: html, listo: engancharFactory(rol) };
  }

  /** Aviso de membresía y resumen de inscripciones del socio. */
  function avisoSocioHTML(usuario, todas) {
    var socio = AG.DB.usuario(usuario.id);
    var permiso = puedeInscribirse(socio);
    var mias = 0;

    for (var i = 0; i < todas.length; i++) {
      if (todas[i].inscritos.indexOf(usuario.id) >= 0) mias++;
    }

    var html = '';

    if (!permiso.ok) {
      html += '<div class="aviso aviso-warn">' + icono('alerta', 18) +
        '<span><b>No puedes inscribirte a clases por ahora.</b><br>' + esc(permiso.motivo) +
        '</span></div>' +
        '<div class="row"><button type="button" class="btn btn-outline btn-sm" data-ir-membresia>' +
        icono('tarjeta', 15) + 'Ver mi membresía</button></div>';
    } else if (!mias) {
      html += '<div class="aviso aviso-info">' + icono('info', 18) +
        '<span>Aún no estás inscrito en ninguna clase. Toca cualquier bloque del horario para ver los detalles ' +
        'e inscribirte si hay lugar.</span></div>';
    }

    return html;
  }

  /** Pequeña leyenda de lectura del horario. */
  function leyendaHTML(rol) {
    var texto;
    if (rol === 'socio') texto = 'Las clases con borde de color son en las que ya estás inscrito.';
    else if (rol === 'coach') texto = 'Las clases con borde de color son las que tú impartes.';
    else texto = 'Toca cualquier bloque para ver a los inscritos, editar la clase o darla de baja.';

    return '<p class="mini muted">' + icono('info', 13) + ' ' + esc(texto) +
      ' La barra de cada bloque muestra los lugares ocupados.</p>';
  }

  /* =============================================================
     13. Eventos (delegación sobre la raíz de la página)
     ============================================================= */

  function engancharFactory(rol) {
    return function (root) {
      var raiz = root.querySelector('[data-clases]');
      if (!raiz) return;

      var usuario = AG.Auth.actual();
      if (!usuario) return;
      var f = filtros[rol];

      /* --- Abrir el detalle de una clase --- */
      AG.Utils.delegar(raiz, 'click', '[data-clase]', function (e, el) {
        e.preventDefault();
        abrirClase(el.getAttribute('data-clase'), usuario);
      });

      /* --- Nueva clase (director) --- */
      AG.Utils.delegar(raiz, 'click', '[data-nueva]', function (e) {
        e.preventDefault();
        formulario(null);
      });

      /* --- Corregir una clase sin día u hora (director) --- */
      AG.Utils.delegar(raiz, 'click', '[data-editar]', function (e, el) {
        e.preventDefault();
        formulario(el.getAttribute('data-editar'));
      });

      /* --- Membresía del socio --- */
      AG.Utils.delegar(raiz, 'click', '[data-ir-membresia]', function (e) {
        e.preventDefault();
        AG.Router.ir('socio/membresia');
      });

      /* --- Botón Hoy: resalta la columna del día y la trae a la vista --- */
      AG.Utils.delegar(raiz, 'click', '[data-hoy]', function (e, el) {
        e.preventDefault();
        f.resaltarHoy = !f.resaltarHoy;

        el.className = 'btn ' + (f.resaltarHoy ? 'btn-primary' : 'btn-outline');
        var marco = raiz.querySelector('[data-marco]');
        if (marco) marco.classList.toggle('resalta-hoy', f.resaltarHoy);

        if (f.resaltarHoy) {
          AG.Utils.toast('Resaltamos ' + DIAS_LARGOS[diaDeHoy()].toLowerCase() + ' en el horario.', 'info');
          desplazarAHoy(raiz);
        }
      });

      /* --- Filtros por coach y por tipo --- */
      AG.Utils.delegar(raiz, 'change', '[data-filtro]', function (e, el) {
        var campo = el.getAttribute('data-filtro');
        f[campo] = el.value || '';
        repintarHorario(raiz, rol, usuario);
      });

      /* --- Chip "solo mis clases" / "solo mis inscripciones" --- */
      AG.Utils.delegar(raiz, 'click', '[data-solo-mias]', function (e, el) {
        e.preventDefault();
        f.soloMias = !f.soloMias;
        el.classList.toggle('on', f.soloMias);
        repintarHorario(raiz, rol, usuario);
      });

      /* --- Limpiar filtros --- */
      AG.Utils.delegar(raiz, 'click', '[data-limpiar]', function (e) {
        e.preventDefault();
        f.coachId = '';
        f.tipo = '';
        f.soloMias = false;
        AG.Router.refrescar();
      });

      if (f.resaltarHoy) desplazarAHoy(raiz);
    };
  }

  /** Repinta solo el horario (cuadrícula + lista) sin perder el resto de la página. */
  function repintarHorario(raiz, rol, usuario) {
    var zona = raiz.querySelector('[data-horario]');
    if (!zona) return;
    var f = filtros[rol];
    var todas = todasLasVistas(rol === 'director');
    var visibles = aplicarFiltros(todas, f, usuario);
    zona.innerHTML = bloqueHorarioCompleto(visibles, {
      usuario: usuario, rol: rol, resaltarHoy: f.resaltarHoy
    });
    if (f.resaltarHoy) desplazarAHoy(raiz);
  }

  /** Deja visible la columna del día actual dentro del scroll horizontal. */
  function desplazarAHoy(raiz) {
    var caja = raiz.querySelector('.cl-scroll');
    var col = raiz.querySelector('.cl-col.hoy');
    if (!caja || !col) return;
    try {
      var destino = col.offsetLeft - (caja.clientWidth - col.offsetWidth) / 2;
      caja.scrollLeft = Math.max(0, destino);
    } catch (e) { /* si el navegador no lo permite, el horario se ve igual */ }
  }

  /* =============================================================
     14. API pública del módulo
     ============================================================= */

  AG.Mod.Clases = {

    /** Próxima clase del usuario. Ver proximaDe(). */
    proximaDe: proximaDe,

    /**
     * Clases activas que imparte un coach, ordenadas por día y hora.
     * @param {String} coachId
     * @returns {Array} arreglo de Clase
     */
    deCoach: function (coachId) {
      if (!coachId) return [];
      var vistas = todasLasVistas(false).filter(function (v) { return v.coachId === coachId; });
      return ordenarPorHorario(vistas).map(function (v) { return v.clase; });
    },

    /**
     * Clases activas en las que está inscrito un socio, ordenadas por día y hora.
     * @param {String} socioId
     * @returns {Array} arreglo de Clase
     */
    deSocio: function (socioId) {
      if (!socioId) return [];
      var vistas = todasLasVistas(false).filter(function (v) {
        return v.inscritos.indexOf(socioId) >= 0;
      });
      return ordenarPorHorario(vistas).map(function (v) { return v.clase; });
    },

    /** Abre el modal de detalle de una clase desde otra pantalla. */
    abrir: function (claseId) {
      abrirClase(claseId, AG.Auth.actual());
    },

    /** Modal de alta o edición (solo dirección). */
    formulario: formulario,

    /** Renders de las rutas. */
    renderDirector: function (ctx) { return render(ctx, 'director'); },
    renderCoach: function (ctx) { return render(ctx, 'coach'); },
    renderSocio: function (ctx) { return render(ctx, 'socio'); }
  };

  /* =============================================================
     15. Registro de rutas
     ============================================================= */

  AG.Router.registrar({
    path: 'director/clases',
    roles: ['director'],
    titulo: 'Clases y horario',
    nav: { etiqueta: 'Clases', icono: 'clase', grupo: 'Operación', orden: 4 },
    render: AG.Mod.Clases.renderDirector
  });

  AG.Router.registrar({
    path: 'coach/clases',
    roles: ['coach'],
    titulo: 'Clases',
    nav: { etiqueta: 'Clases', icono: 'clase', grupo: 'Entrenamiento', orden: 6 },
    render: AG.Mod.Clases.renderCoach
  });

  AG.Router.registrar({
    path: 'socio/clases',
    roles: ['socio'],
    titulo: 'Clases',
    nav: { etiqueta: 'Clases', icono: 'clase', grupo: 'Mi entrenamiento', orden: 6 },
    render: AG.Mod.Clases.renderSocio
  });

})(window.AG);
