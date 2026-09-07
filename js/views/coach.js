/* =============================================================
   ALLIANCE GYM — AG.Views.Coach (rediseño v2)
   -------------------------------------------------------------
   Centro de trabajo del entrenador, con la regla del dueño:
   menos texto, una sola acción principal y el detalle escondido
   hasta que se pide. Dos pantallas:

     'coach/inicio'  -> saludo, tarjeta HOY (lo más urgente, una
                        sola cosa), 4 tiles, pendientes en
                        desplegables cerrados, destacados y riesgo.
     'coach/agenda'  -> semana lunes-domingo alrededor de las
                        SESIONES con entrenador (ya no hay clases),
                        cumpleaños, recordatorios de medición,
                        eventos especiales y resumen de carga.

   Control de acceso REAL: el coach solo ve a los socios que tiene
   asignados (AG.DB.sociosDe). Nunca se listan socios ajenos.

   No duplica lógica de los módulos: delega en
     AG.Mod.Mediciones.capturar(socioId, tipo, periodo)
     AG.Mod.Rutinas.asignar(socioId)
     AG.Mod.Nutricion.editorPlan(socioId)
     AG.Mod.Sesiones.deCoach(coachId, desde, hasta)  (respaldo: AG.DB.sesionesDeCoach)
     AG.Mod.Socios.adherenciaDe(socio)
     AG.Ilustra.porPatron(patron, opts)

   Reglas: JavaScript clásico (sin módulos ni dependencias), todo
   el texto que viene de la base pasa por AG.Utils.esc(), nada de
   alert/confirm/prompt y ningún acceso directo a localStorage.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var C = AG.Calc;
  var DB = AG.DB;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  var CSS_ID = 'ag-coach-css';

  /* Días de la semana empezando en lunes (así trabaja la agenda). */
  var DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /* Días sin asistir a partir de los cuales el socio entra a la lista de rescate. */
  var DIAS_SIN_VENIR = 7;

  /* Últimos días del mes en los que el cierre ya urge. */
  var DIAS_AVISO_CIERRE = 5;

  /* Filas visibles dentro de cada desplegable antes del "Ver más". */
  var MAX_FILAS = 8;

  /* Tres destacados y tres en riesgo. */
  var TOPE_DESTACADOS = 3;

  var TIPO_SESION = { entrenamiento: 'Entrenamiento', valoracion: 'Valoración', seguimiento: 'Seguimiento' };
  var ESTADO_SESION = { agendada: 'Agendada', completada: 'Completada', cancelada: 'Cancelada', no_asistio: 'No asistió' };
  var BADGE_ESTADO = { agendada: 'info', completada: 'ok', cancelada: 'muted', no_asistio: 'warn' };
  var TIPO_EVENTO = { reto: 'Reto', clinica: 'Clínica', competencia: 'Competencia', social: 'Convivencia', taller: 'Taller' };

  /* Estado vivo de la agenda (sobrevive a los repintados del router). */
  var estado = { semana: '', dia: '' };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function ico(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function dos(n) { return (Number(n) < 10 ? '0' : '') + Number(n); }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function plural(n, singular, pluralTxt) {
    return n + ' ' + (n === 1 ? singular : pluralTxt);
  }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function nombreGym() {
    try {
      var s = DB.state && DB.state.settings;
      if (s && s.nombreGym) return String(s.nombreGym);
    } catch (e) { /* se usa el respaldo */ }
    return 'el gimnasio';
  }

  function primerNombre(usuario) {
    var n = String((usuario && usuario.nombre) || U.nombreCompleto(usuario) || '').trim();
    var partes = n.split(/\s+/);
    return partes[0] || 'entrenador';
  }

  function etiquetaObjetivo(objetivo) {
    if (AG.Mod && AG.Mod.Socios && typeof AG.Mod.Socios.etiquetaObjetivo === 'function') {
      try { return AG.Mod.Socios.etiquetaObjetivo(objetivo); } catch (e) { /* respaldo abajo */ }
    }
    return (C.ETIQUETA_OBJETIVO && C.ETIQUETA_OBJETIVO[objetivo]) || 'Sin objetivo';
  }

  /** 'domingo 6 de septiembre' */
  function fechaHablada(iso) {
    var p = U.partesDe(iso);
    if (!p) return '';
    var dia = new Date(p.a, p.m - 1, p.d).getDay();
    return U.DIAS_SEMANA[dia].toLowerCase() + ' ' + p.d + ' de ' + U.MESES[p.m - 1].toLowerCase();
  }

  /** Índice 0..6 (lunes = 0) de una fecha 'YYYY-MM-DD'. */
  function indiceDiaDeFecha(fechaISO) {
    var d = U.aDate(fechaISO);
    if (!d) return 0;
    return (d.getDay() + 6) % 7;
  }

  /** Lunes de la semana natural que contiene a la fecha. */
  function lunesDe(fechaISO) {
    var base = fechaISO || U.hoy();
    if (typeof DB.lunesDe === 'function') {
      try {
        var l = DB.lunesDe(base);
        if (l) return l;
      } catch (e) { /* respaldo abajo */ }
    }
    return U.sumaDias(base, -indiceDiaDeFecha(base)) || base;
  }

  /** 'HH:MM' -> minutos desde medianoche (null si no es una hora). */
  function minutosDe(hora) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hora === null || hora === undefined ? '' : hora).trim());
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (!isFinite(h) || !isFinite(mi)) return null;
    return Math.max(0, Math.min(1439, h * 60 + mi));
  }

  function minutosAhora() {
    var f = new Date();
    return f.getHours() * 60 + f.getMinutes();
  }

  /** Hora siempre con dos dígitos ('7:00' -> '07:00'). */
  function horaTexto(hora) {
    var t = U.fecha(hora, 'hora');
    return t || String(hora || '');
  }

  /** Teléfono listo para wa.me (agrega lada 52 a los números de 10 dígitos). */
  function telWhatsApp(tel) {
    var d = String(tel === null || tel === undefined ? '' : tel).replace(/[^0-9]/g, '');
    if (!d) return '';
    if (d.length === 10) d = '52' + d;
    return d.length >= 11 ? d : '';
  }

  /** Fecha sugerida para una medición del periodo (día 5 y último día del mes). */
  function anclaMedicion(periodo, tipo) {
    var p = U.partesDe(periodo + '-01');
    if (!p) return U.hoy();
    if (tipo === 'inicial') return periodo + '-05';
    return periodo + '-' + dos(U.diasDelMes(p.a, p.m));
  }

  /** ¿El navegador pide poco movimiento? */
  function prefiereQuieto() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /* =============================================================
     2. Estilos propios de la vista (lo que styles.css no cubre)
     ============================================================= */

  function asegurarEstilos() {
    if (!document || document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Icono grande dentro de la tarjeta HOY cuando no hay ilustración */
      '.cc-hoy-ico{width:58%;max-width:96px;color:var(--rojo);display:grid;place-items:center}' +
      '.cc-hoy-ico svg{width:100%;height:auto}' +

      /* Listas compactas dentro de los desplegables y las tarjetas */
      '.cc-lista .list-item{padding:8px 10px}' +
      '.cc-lista .list-item-main span{-webkit-line-clamp:1}' +
      '.cc-lista .list-item-side .btn-sm{white-space:nowrap}' +
      '.cc-ver-mas{display:inline-flex;margin-top:10px}' +
      '.cc-socio .bar{margin-top:5px}' +
      '.cc-socio .list-item-side{flex:0 0 auto}' +

      /* Agenda */
      '.cc-semana-txt{min-width:150px;text-align:center;font-weight:800;' +
        'font-variant-numeric:tabular-nums}' +
      '.cc-panel-dia{margin-top:14px;min-width:0}' +
      '.cc-otros{margin-top:12px}' +
      '.cc-pill-fecha{flex:0 0 auto;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      '.cc-carga{display:flex;flex-direction:column;gap:14px}' +
      '.cc-carga .tiles{gap:10px}' +
      '.cc-carga .tile{padding:12px;gap:6px}' +
      '.cc-carga .tile-val{font-size:24px}' +

      '@media (max-width:700px){' +
        '.cc-semana-txt{min-width:0;flex:1 1 auto}' +
        '.cc-carga .tiles{grid-template-columns:repeat(3,minmax(0,1fr))}' +
        '.cc-carga .tiles > .tile:last-child:nth-child(odd){grid-column:auto}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Datos del coach (solo sus socios)
     ============================================================= */

  /** Constancia del mes en curso; usa el módulo de socios si está cargado. */
  function adherenciaDe(socio) {
    if (AG.Mod && AG.Mod.Socios && typeof AG.Mod.Socios.adherenciaDe === 'function') {
      try {
        var r = AG.Mod.Socios.adherenciaDe(socio);
        if (r && typeof r.pct === 'number') return r;
      } catch (e) { /* se calcula abajo */ }
    }
    var activa = DB.rutinaActivaDe(socio.id);
    var dxs = (activa && activa.rutina && Number(activa.rutina.diasPorSemana) > 0)
      ? Number(activa.rutina.diasPorSemana) : 3;
    var desde = U.mesActual() + '-01';
    var hasta = U.hoy();
    if (hasta < desde) hasta = desde;
    return C.adherencia(DB.bitacorasDe(socio.id), desde, hasta, dxs);
  }

  /** Todo lo que las tarjetas necesitan saber de un socio. */
  function fichaDe(socio, periodo) {
    var hoy = U.hoy();
    var asistencias = DB.asistenciasDe(socio.id);
    var ultima = asistencias.length ? String(asistencias[0].fecha || '').slice(0, 10) : '';

    var medIni = DB.medicionDelMes(socio.id, periodo, 'inicial');
    var medFin = DB.medicionDelMes(socio.id, periodo, 'final');

    var previo = U.mesDe(U.sumaMeses(periodo + '-01', -1));
    var prevIni = previo ? DB.medicionDelMes(socio.id, previo, 'inicial') : null;
    var prevFin = previo ? DB.medicionDelMes(socio.id, previo, 'final') : null;

    var cmp = null;
    var periodoCmp = '';

    if (medIni && medFin) {
      var actual = C.compararMediciones(medIni, medFin, socio.objetivo);
      if (actual && actual.ok) { cmp = actual; periodoCmp = periodo; }
    }
    if (!cmp && prevIni && prevFin) {
      /* A principio de mes todavía no hay cierre: se usa el mes anterior. */
      var anterior = C.compararMediciones(prevIni, prevFin, socio.objetivo);
      if (anterior && anterior.ok) { cmp = anterior; periodoCmp = previo; }
    }

    /* Cierre pendiente: el del mes pasado (ya vencido) o el de este mes. */
    var cierre = null;
    if (prevIni && !prevFin) {
      cierre = { periodo: previo, medIni: prevIni, vencido: true };
    } else if (medIni && !medFin) {
      var p = U.partesDe(hoy);
      var urge = !!p && p.d > U.diasDelMes(p.a, p.m) - DIAS_AVISO_CIERRE;
      cierre = { periodo: periodo, medIni: medIni, vencido: urge };
    }

    var activa = DB.rutinaActivaDe(socio.id);

    var diasSinVenir = null;
    if (ultima) diasSinVenir = Math.max(0, U.diasEntre(ultima, hoy));
    else if (socio.fechaAlta) diasSinVenir = Math.max(0, U.diasEntre(socio.fechaAlta, hoy));

    return {
      socio: socio,
      membresia: C.estadoMembresia(socio),
      adherencia: adherenciaDe(socio),
      medIni: medIni,
      medFin: medFin,
      cierre: cierre,
      comparativo: cmp,
      periodoComparativo: periodoCmp,
      puntaje: (cmp && cmp.resumen) ? cmp.resumen.puntaje : null,
      nivel: (cmp && cmp.resumen) ? cmp.resumen.nivel : '',
      rutina: activa ? activa.rutina : null,
      plan: DB.planNutricionDe(socio.id),
      ultimaAsistencia: ultima,
      sinVisitas: !ultima,
      diasSinVenir: diasSinVenir
    };
  }

  /** Tablero completo del coach para un periodo 'YYYY-MM'. */
  function tableroDe(coach, periodo) {
    var asignados = coach ? DB.sociosDe(coach.id) : [];
    var fichas = [];
    var i, f;

    for (i = 0; i < asignados.length; i++) {
      var s = asignados[i];
      if (!s || s.estado === 'baja' || s.activo === false) continue;
      fichas.push(fichaDe(s, periodo));
    }
    fichas = U.ordenar(fichas, function (x) { return U.normalizar(U.nombreCompleto(x.socio)); }, 'asc');

    var activos = [], sinInicial = [], cierres = [], cierresVencidos = [],
        sinRutina = [], sinPlan = [], ausentes = [];
    var medicionesHechas = 0;

    for (i = 0; i < fichas.length; i++) {
      f = fichas[i];
      if (f.socio.estado !== 'activo') continue;

      activos.push(f);
      if (f.medIni) medicionesHechas++;
      if (f.medFin) medicionesHechas++;

      if (!f.medIni) sinInicial.push(f);
      if (f.cierre) {
        cierres.push(f);
        if (f.cierre.vencido) cierresVencidos.push(f);
      }
      if (!f.rutina) sinRutina.push(f);
      if (!f.plan) sinPlan.push(f);
      if (f.diasSinVenir !== null && f.diasSinVenir >= DIAS_SIN_VENIR) ausentes.push(f);
    }

    ausentes = U.ordenar(ausentes, 'diasSinVenir', 'desc');

    var esperadas = activos.length * 2;
    var calificacion = C.promedioCalificacion(DB.calificacionesDe(coach ? coach.id : ''));

    return {
      periodo: periodo,
      fichas: fichas,
      asignados: asignados.length,
      activos: activos,
      sinInicial: sinInicial,
      cierres: cierres,
      cierresVencidos: cierresVencidos,
      sinRutina: sinRutina,
      sinPlan: sinPlan,
      ausentes: ausentes,
      pendientes: sinInicial.length + cierres.length,
      totalPendientes: sinInicial.length + cierres.length + sinRutina.length + sinPlan.length + ausentes.length,
      adherencia: Math.round(U.promedio(activos, function (x) { return x.adherencia.pct; })),
      medicionesHechas: medicionesHechas,
      medicionesEsperadas: esperadas,
      calificacion: calificacion,
      mejores: mejoresDe(fichas),
      riesgo: riesgoDe(fichas)
    };
  }

  /** Tres socios con mejor puntaje de comparativo (o mejor constancia). */
  function mejoresDe(fichas) {
    var conPuntaje = [], i;
    for (i = 0; i < fichas.length; i++) {
      if (fichas[i].puntaje !== null && fichas[i].puntaje !== undefined) conPuntaje.push(fichas[i]);
    }
    if (conPuntaje.length) {
      return { base: 'comparativo', lista: U.ordenar(conPuntaje, 'puntaje', 'desc').slice(0, TOPE_DESTACADOS) };
    }
    var conConstancia = [];
    for (i = 0; i < fichas.length; i++) {
      if (fichas[i].socio.estado === 'activo' && fichas[i].adherencia.pct > 0) conConstancia.push(fichas[i]);
    }
    return {
      base: 'constancia',
      lista: U.ordenar(conConstancia, function (f) { return f.adherencia.pct; }, 'desc').slice(0, TOPE_DESTACADOS)
    };
  }

  /** Tres socios en riesgo: peor constancia, ausencia o retroceso en el cierre. */
  function riesgoDe(fichas) {
    var lista = [], i;
    for (i = 0; i < fichas.length; i++) {
      var f = fichas[i];
      if (f.socio.estado !== 'activo') continue;

      var motivo = null;
      var score = f.adherencia.pct;

      if (f.diasSinVenir !== null && f.diasSinVenir >= DIAS_SIN_VENIR) {
        motivo = {
          texto: f.sinVisitas ? 'Sin visitas desde su alta' : plural(f.diasSinVenir, 'día sin venir', 'días sin venir'),
          etiqueta: 'Sin venir'
        };
        score = Math.min(score, f.sinVisitas ? 5 : 20);
      } else if (f.puntaje !== null && f.puntaje < 45) {
        motivo = { texto: 'Cierre flojo · ' + f.puntaje + '/100', etiqueta: 'Cierre' };
        score = Math.min(score, f.puntaje);
      } else if (f.adherencia.pct < 60) {
        motivo = {
          texto: f.adherencia.hechas + ' de ' + f.adherencia.esperadas + ' entrenos este mes',
          etiqueta: 'Constancia'
        };
      }
      if (!motivo) continue;

      lista.push({ ficha: f, score: Math.max(0, Math.min(100, score)), motivo: motivo });
    }
    return U.ordenar(lista, 'score', 'asc').slice(0, TOPE_DESTACADOS);
  }

  /* ---------- Sesiones con entrenador ---------- */

  /** Datos derivados de una sesión, siempre con valores válidos. */
  function sesionVista(s) {
    var socio = s.socioId ? DB.usuario(s.socioId) : null;
    var min = minutosDe(s.hora);
    var dur = Math.round(Number(s.duracionMin));
    if (!isFinite(dur) || dur <= 0) dur = 60;
    var tipo = TIPO_SESION[s.tipo] ? s.tipo : 'entrenamiento';
    var est = ESTADO_SESION[s.estado] ? s.estado : 'agendada';
    return {
      sesion: s,
      id: s.id,
      socio: socio,
      nombre: socio ? U.nombreCompleto(socio) : 'Socio',
      fecha: String(s.fecha || '').slice(0, 10),
      hora: horaTexto(s.hora),
      min: min === null ? 0 : min,
      dur: Math.max(15, Math.min(240, dur)),
      tipo: tipo,
      estado: est,
      objetivo: String(s.objetivo || ''),
      notasCoach: String(s.notasCoach || ''),
      notasSocio: String(s.notasSocio || '')
    };
  }

  /** Sesiones del coach en un rango (módulo de sesiones o respaldo de la base). */
  function sesionesDeCoach(coachId, desde, hasta) {
    if (!coachId) return [];
    var crudas = null;
    if (AG.Mod && AG.Mod.Sesiones && typeof AG.Mod.Sesiones.deCoach === 'function') {
      try { crudas = AG.Mod.Sesiones.deCoach(coachId, desde, hasta); } catch (e) { crudas = null; }
    }
    if (!esArreglo(crudas)) {
      crudas = typeof DB.sesionesDeCoach === 'function' ? DB.sesionesDeCoach(coachId, desde, hasta) : [];
    }
    var vistas = [], i;
    for (i = 0; i < crudas.length; i++) {
      var s = crudas[i];
      if (!s || !s.id || s.coachId !== coachId) continue;
      var f = String(s.fecha || '').slice(0, 10);
      if (!f) continue;
      if (desde && f < desde) continue;
      if (hasta && f > hasta) continue;
      vistas.push(sesionVista(s));
    }
    return U.ordenar(vistas, function (v) { return v.fecha + ' ' + v.hora; }, 'asc');
  }

  function sesionPorId(coachId, sesionId) {
    if (!sesionId) return null;
    var s = DB.buscar('sesiones', sesionId);
    if (!s || (coachId && s.coachId !== coachId)) return null;
    return sesionVista(s);
  }

  /** Huecos libres de un coach en una fecha (0 si no atiende ese día). */
  function huecosLibresDe(coachId, fecha) {
    if (typeof DB.huecosDe !== 'function') return 0;
    var huecos = DB.huecosDe(coachId, fecha);
    var n = 0;
    for (var i = 0; i < huecos.length; i++) if (huecos[i] && huecos[i].libre) n++;
    return n;
  }

  /** Cuenta la ocupación real de la semana (agendadas y completadas). */
  function cuentaSesiones(vistas) {
    var n = 0;
    for (var i = 0; i < vistas.length; i++) {
      if (vistas[i].estado === 'agendada' || vistas[i].estado === 'completada') n++;
    }
    return n;
  }

  /* =============================================================
     4. Piezas de interfaz reutilizables
     ============================================================= */

  function paginaSinSesion() {
    return '<div class="page">' +
      '<div class="vacio-amable">' +
        '<div class="vacio-amable-icono">' + ico('usuario', 34) + '</div>' +
        '<p>Tu sesión terminó</p>' +
        '<span>Vuelve a entrar para ver tu panel.</span>' +
      '</div>' +
    '</div>';
  }

  function vacioAmableHTML(iconoNombre, titulo, sub, accionHTML) {
    return '<div class="vacio-amable">' +
      '<div class="vacio-amable-icono">' + ico(iconoNombre || 'info', 34) + '</div>' +
      '<p>' + esc(titulo) + '</p>' +
      (sub ? '<span>' + esc(sub) + '</span>' : '') +
      (accionHTML || '') +
    '</div>';
  }

  function botonHTML(clase, texto, iconoNombre, atributos) {
    return '<button type="button" class="btn ' + clase + ' btn-sm" ' + atributos + '>' +
      ico(iconoNombre, 15) + ' ' + esc(texto) + '</button>';
  }

  /** Fila compacta: avatar, nombre, una línea corta y UN botón. */
  function filaSocioHTML(ficha, detalle, botones) {
    return '<div class="list-item">' +
      U.avatar(ficha.socio, 'sm') +
      '<div class="list-item-main">' +
        '<b>' + esc(U.nombreCompleto(ficha.socio)) + '</b>' +
        (detalle ? '<span>' + esc(detalle) + '</span>' : '') +
      '</div>' +
      '<div class="list-item-side">' + botones + '</div>' +
    '</div>';
  }

  /** Tarjeta compacta de socio con su barra de avance (enlaza a su ficha). */
  function tarjetaSocioHTML(ficha, linea, pct, tono, badgeHTML) {
    var ancho = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return '<a class="list-item cc-socio" href="#/coach/socio?id=' + encodeURIComponent(ficha.socio.id) + '">' +
      U.avatar(ficha.socio, 'sm') +
      '<div class="list-item-main">' +
        '<b>' + esc(U.nombreCompleto(ficha.socio)) + '</b>' +
        '<span>' + esc(linea) + '</span>' +
        '<div class="bar bar-fina"><span class="bar-fill ' + esc(tono) + '" style="width:' + ancho + '%"></span></div>' +
      '</div>' +
      '<div class="list-item-side">' + badgeHTML + '</div>' +
    '</a>';
  }

  /** Desplegable cerrado con el conteo en la cabecera. '' si no hay nada. */
  function desplegableHTML(cfg) {
    var items = cfg.items || [];
    if (!items.length) return '';

    var filas = '', i;
    var tope = Math.min(items.length, MAX_FILAS);
    for (i = 0; i < tope; i++) filas += cfg.fila(items[i]);
    var resto = items.length - tope;

    return '<details class="desplegable">' +
      '<summary class="desplegable-cab">' + ico(cfg.icono, 18) +
        '<span class="desplegable-titulo">' + esc(cfg.titulo) + '</span>' +
        '<span class="badge badge-' + esc(cfg.badge) + '">' + items.length + '</span>' +
      '</summary>' +
      '<div class="desplegable-cuerpo">' +
        '<div class="list cc-lista">' + filas + '</div>' +
        (resto > 0
          ? '<a class="ver-mas cc-ver-mas" href="' + esc(cfg.verMas) + '">' +
              esc('Ver ' + resto + ' más') + ico('flecha-der', 14) + '</a>'
          : '') +
      '</div>' +
    '</details>';
  }

  /** Ilustración de la tarjeta HOY: patrón de AG.Ilustra o un icono grande. */
  function ilustraHoy(patron, iconoNombre) {
    if (patron && AG.Ilustra && typeof AG.Ilustra.porPatron === 'function') {
      try {
        var svg = AG.Ilustra.porPatron(patron, {
          alto: 120, fondo: false, animado: true, fase: prefiereQuieto() ? 'fin' : 'ambas'
        });
        if (svg) return svg;
      } catch (e) { /* se usa el icono */ }
    }
    return '<div class="cc-hoy-ico">' + ico(iconoNombre || 'trofeo', 64) + '</div>';
  }

  /* =============================================================
     5. Pantalla de inicio
     ============================================================= */

  function saludoHTML(coach) {
    return '<div class="saludo">' +
      '<div class="saludo-hola">Hola, <span class="saludo-nombre">' + esc(primerNombre(coach)) + '</span>' +
        ' <span class="saludo-emoji">👋</span></div>' +
      '<div class="saludo-fecha">Hoy es ' + esc(fechaHablada(U.hoy())) + '</div>' +
    '</div>';
  }

  /**
   * Lo más urgente del día, UNA sola cosa. Prioridad:
   * sesiones de hoy > cierres vencidos > mediciones iniciales > sin rutina > ausentes.
   */
  function resumenHoy(coach, d, sesionesHoy) {
    var agendadas = [], i;
    for (i = 0; i < sesionesHoy.length; i++) {
      if (sesionesHoy[i].estado === 'agendada') agendadas.push(sesionesHoy[i]);
    }

    if (agendadas.length) {
      var ahora = minutosAhora();
      var prox = null, porCerrar = false;
      for (i = 0; i < agendadas.length; i++) {
        if (agendadas[i].min + 15 >= ahora) { prox = agendadas[i]; break; }
      }
      if (!prox) { prox = agendadas[agendadas.length - 1]; porCerrar = true; }

      var quien = prox.socio ? primerNombre(prox.socio) : 'tu socio';
      var despues = 0;
      for (i = 0; i < agendadas.length; i++) if (agendadas[i].min > prox.min) despues++;

      var meta = [{ icono: 'reloj', texto: prox.dur + ' min' }];
      if (despues) meta.push({ icono: 'calendario', texto: despues + ' más después' });

      return {
        tipo: 'sesion',
        eyebrow: porCerrar ? 'Hoy · sesión por cerrar' : 'Hoy · ' + plural(agendadas.length, 'sesión', 'sesiones'),
        titulo: porCerrar
          ? 'Cierra la sesión de ' + quien + ' (' + prox.hora + ')'
          : 'Sesión con ' + quien + ' a las ' + prox.hora,
        sub: TIPO_SESION[prox.tipo] + (prox.objetivo ? ' · ' + U.truncar(prox.objetivo, 48) : ''),
        meta: meta,
        acciones: [
          { texto: porCerrar ? 'Cerrar sesión' : 'Ver sesión', icono: porCerrar ? 'check' : 'ojo',
            clase: 'btn-primary', attrs: 'data-cc-sesion="' + esc(prox.id) + '"' },
          { texto: 'Mi agenda', icono: 'calendario', clase: 'btn-ghost', href: '#/coach/agenda' }
        ],
        ilustra: ilustraHoy('kettlebell_swing', 'pesa')
      };
    }

    var f;
    if (d.cierresVencidos.length) {
      f = d.cierresVencidos[0];
      return {
        tipo: 'cierre',
        eyebrow: 'Hoy · cierre de mes',
        titulo: 'Cierra el mes de ' + primerNombre(f.socio),
        sub: 'Falta su medición final de ' + U.nombreMes(f.cierre.periodo).toLowerCase(),
        meta: [{ icono: 'balanza', texto: plural(d.cierres.length, 'cierre pendiente', 'cierres pendientes') }],
        acciones: [
          { texto: 'Cerrar mes', icono: 'check', clase: 'btn-primary',
            attrs: 'data-cc-medir="' + esc(f.socio.id) + '" data-cc-tipo="final" data-cc-periodo="' + esc(f.cierre.periodo) + '"' }
        ],
        ilustra: ilustraHoy(null, 'balanza')
      };
    }

    if (d.sinInicial.length) {
      f = d.sinInicial[0];
      return {
        tipo: 'medicion',
        eyebrow: 'Hoy · medición inicial',
        titulo: 'Mide a ' + primerNombre(f.socio),
        sub: 'Su medición de inicio de ' + U.nombreMes(d.periodo).toLowerCase(),
        meta: [{ icono: 'regla', texto: plural(d.sinInicial.length, 'socio sin medir', 'socios sin medir') }],
        acciones: [
          { texto: 'Medir ahora', icono: 'regla', clase: 'btn-primary',
            attrs: 'data-cc-medir="' + esc(f.socio.id) + '" data-cc-tipo="inicial" data-cc-periodo="' + esc(d.periodo) + '"' }
        ],
        ilustra: ilustraHoy(null, 'regla')
      };
    }

    if (d.sinRutina.length) {
      f = d.sinRutina[0];
      return {
        tipo: 'rutina',
        eyebrow: 'Hoy · rutina',
        titulo: 'Asigna rutina a ' + primerNombre(f.socio),
        sub: etiquetaObjetivo(f.socio.objetivo) + (f.socio.nivel ? ' · ' + U.capitalizar(f.socio.nivel) : ''),
        meta: [{ icono: 'mancuerna', texto: plural(d.sinRutina.length, 'socio sin rutina', 'socios sin rutina') }],
        acciones: [
          { texto: 'Asignar rutina', icono: 'mancuerna', clase: 'btn-primary',
            attrs: 'data-cc-rutina="' + esc(f.socio.id) + '"' }
        ],
        ilustra: ilustraHoy('sentadilla', 'mancuerna')
      };
    }

    if (d.ausentes.length) {
      f = d.ausentes[0];
      return {
        tipo: 'ausente',
        eyebrow: 'Hoy · un mensaje',
        titulo: 'Escríbele a ' + primerNombre(f.socio),
        sub: f.sinVisitas ? 'Aún no registra visitas' : 'Hace ' + plural(f.diasSinVenir, 'día', 'días') + ' que no viene',
        meta: [{ icono: 'corazon', texto: plural(d.ausentes.length, 'socio por rescatar', 'socios por rescatar') }],
        acciones: [
          { texto: 'Enviar WhatsApp', icono: 'whatsapp', clase: 'btn-primary',
            attrs: 'data-cc-wa="' + esc(f.socio.id) + '"' }
        ],
        ilustra: ilustraHoy(null, 'whatsapp')
      };
    }

    if (!d.asignados) {
      return {
        tipo: 'tranquilo',
        clase: 'descanso',
        eyebrow: 'Todo listo',
        titulo: 'Aún no tienes socios asignados',
        sub: 'En cuanto dirección te asigne alguno, aquí verás qué hacer.',
        meta: [],
        acciones: [{ texto: 'Mi disponibilidad', icono: 'calendario', clase: 'btn-primary', href: '#/coach/sesiones' }],
        ilustra: ilustraHoy('movilidad', 'calendario')
      };
    }

    return {
      tipo: 'tranquilo',
      clase: 'descanso',
      eyebrow: 'Todo en orden',
      titulo: 'Vas al día, ' + primerNombre(coach) + ' 🙌',
      sub: 'Tus socios están atendidos. Buen momento para revisar avances.',
      meta: [{ icono: 'socios', texto: plural(d.activos.length, 'socio activo', 'socios activos') }],
      acciones: [{ texto: 'Ver avances', icono: 'grafica', clase: 'btn-primary', href: '#/coach/mediciones' }],
      ilustra: ilustraHoy('movilidad', 'trofeo')
    };
  }

  function hoyHTML(h) {
    var meta = '', acciones = '', i;
    for (i = 0; i < h.meta.length; i++) {
      meta += '<span>' + ico(h.meta[i].icono, 15) + esc(h.meta[i].texto) + '</span>';
    }
    for (i = 0; i < h.acciones.length; i++) {
      var a = h.acciones[i];
      if (a.href) {
        acciones += '<a class="btn ' + esc(a.clase) + '" href="' + esc(a.href) + '">' +
          ico(a.icono, 18) + ' ' + esc(a.texto) + '</a>';
      } else {
        acciones += '<button type="button" class="btn ' + esc(a.clase) + '" ' + (a.attrs || '') + '>' +
          ico(a.icono, 18) + ' ' + esc(a.texto) + '</button>';
      }
    }
    return '<section class="hoy compacta' + (h.clase ? ' ' + esc(h.clase) : '') + '" data-cc-hoy="' + esc(h.tipo) + '">' +
      '<span class="hoy-eyebrow">' + esc(h.eyebrow) + '</span>' +
      '<h2 class="hoy-titulo">' + esc(h.titulo) + '</h2>' +
      (h.sub ? '<p class="hoy-sub">' + esc(h.sub) + '</p>' : '') +
      (meta ? '<div class="hoy-meta">' + meta + '</div>' : '') +
      (acciones ? '<div class="hoy-accion">' + acciones + '</div>' : '') +
      '<div class="hoy-ilustra">' + h.ilustra + '</div>' +
    '</section>';
  }

  /** Tile: número grande + etiqueta corta. 'valorHTML' ya viene seguro. */
  function tileHTML(href, tono, iconoNombre, valorHTML, etiqueta, extra) {
    return '<a class="tile ' + esc(tono) + '" href="' + esc(href) + '">' +
      '<span class="tile-icono">' + ico(iconoNombre, 18) + '</span>' +
      '<span class="tile-val">' + valorHTML + '</span>' +
      '<span class="tile-label">' + esc(etiqueta) + '</span>' +
      (extra ? '<span class="tile-extra">' + esc(extra) + '</span>' : '') +
    '</a>';
  }

  function tilesHTML(d, sesionesSemana) {
    var cal = d.calificacion;
    var valorCal = cal.total ? esc(U.num(cal.promedio, 1)) + '<small>/5</small>' : '—';
    return '<div class="tiles">' +
      tileHTML('#/coach/socios', 'info', 'socios', String(d.activos.length), 'mis socios',
        d.asignados > d.activos.length ? 'de ' + d.asignados + ' asignados' : '') +
      tileHTML('#/coach/sesiones', 'calma', 'calendario', String(sesionesSemana), 'sesiones esta semana', '') +
      tileHTML('#/coach/mediciones', d.pendientes ? 'warn' : 'ok', 'regla', String(d.pendientes), 'mediciones pendientes',
        d.pendientes ? d.sinInicial.length + ' iniciales · ' + d.cierres.length + ' cierres' : 'todo al día') +
      tileHTML('#/coach/calificaciones', 'destacada', 'estrella', valorCal, 'mi calificación',
        cal.total ? plural(cal.total, 'reseña', 'reseñas') : 'sin reseñas aún') +
    '</div>';
  }

  function pendientesHTML(d) {
    var periodo = d.periodo;
    var grupos = '';

    grupos += desplegableHTML({
      titulo: 'Medición inicial', icono: 'regla', badge: 'warn',
      items: d.sinInicial, verMas: '#/coach/mediciones',
      fila: function (f) {
        return filaSocioHTML(f, 'Sin medición este mes',
          botonHTML('btn-primary', 'Medir', 'regla',
            'data-cc-medir="' + esc(f.socio.id) + '" data-cc-tipo="inicial" data-cc-periodo="' + esc(periodo) + '"'));
      }
    });

    grupos += desplegableHTML({
      titulo: 'Cierre de mes', icono: 'balanza', badge: 'warn',
      items: d.cierres, verMas: '#/coach/mediciones',
      fila: function (f) {
        var detalle = f.cierre.periodo !== periodo
          ? U.nombreMes(f.cierre.periodo) + ' sin cerrar'
          : (f.cierre.medIni && f.cierre.medIni.fecha ? 'Inicio ' + U.fecha(f.cierre.medIni.fecha, 'diaMes') : 'Falta el cierre');
        return filaSocioHTML(f, detalle,
          botonHTML('btn-primary', 'Cerrar mes', 'check',
            'data-cc-medir="' + esc(f.socio.id) + '" data-cc-tipo="final" data-cc-periodo="' + esc(f.cierre.periodo) + '"'));
      }
    });

    grupos += desplegableHTML({
      titulo: 'Sin rutina', icono: 'mancuerna', badge: 'info',
      items: d.sinRutina, verMas: '#/coach/rutinas',
      fila: function (f) {
        return filaSocioHTML(f, etiquetaObjetivo(f.socio.objetivo),
          botonHTML('btn-outline', 'Asignar', 'mas', 'data-cc-rutina="' + esc(f.socio.id) + '"'));
      }
    });

    grupos += desplegableHTML({
      titulo: 'Sin plan de comida', icono: 'manzana', badge: 'info',
      items: d.sinPlan, verMas: '#/coach/nutricion',
      fila: function (f) {
        return filaSocioHTML(f, etiquetaObjetivo(f.socio.objetivo),
          botonHTML('btn-outline', 'Armar plan', 'nutricion', 'data-cc-nutricion="' + esc(f.socio.id) + '"'));
      }
    });

    grupos += desplegableHTML({
      titulo: 'No asisten hace ' + DIAS_SIN_VENIR + '+ días', icono: 'corazon', badge: 'danger',
      items: d.ausentes, verMas: '#/coach/socios',
      fila: function (f) {
        var detalle = f.sinVisitas ? 'Sin visitas aún' : 'Hace ' + plural(f.diasSinVenir, 'día', 'días');
        return filaSocioHTML(f, detalle,
          botonHTML('btn-outline', 'WhatsApp', 'whatsapp', 'data-cc-wa="' + esc(f.socio.id) + '"'));
      }
    });

    var cuerpo;
    if (grupos) {
      cuerpo = '<div class="desplegables">' + grupos + '</div>';
    } else if (!d.activos.length) {
      cuerpo = vacioAmableHTML('socios', 'Todavía no tienes socios activos', 'Cuando te asignen alguno, sus pendientes aparecen aquí.');
    } else {
      cuerpo = vacioAmableHTML('check', 'Sin pendientes por hoy', 'Tus socios están al día 🙌');
    }

    return '<section>' +
      '<div class="seccion-cab">' +
        '<h2>Mis pendientes</h2>' +
        '<span class="mini muted">' + esc(d.totalPendientes ? plural(d.totalPendientes, 'cosa por hacer', 'cosas por hacer') : 'nada por hacer') + '</span>' +
      '</div>' +
      cuerpo +
    '</section>';
  }

  function tonoNivel(nivel) {
    if (nivel === 'excelente') return 'ok';
    if (nivel === 'bueno') return 'info';
    if (nivel === 'regular') return 'warn';
    return 'error';
  }

  function tonoPct(pct) {
    if (pct >= 80) return 'ok';
    if (pct >= 50) return 'warn';
    return 'error';
  }

  function destacadosHTML(d) {
    var mejores = d.mejores;
    var cuerpoMejores, i, f;

    if (!mejores.lista.length) {
      cuerpoMejores = vacioAmableHTML('trofeo', 'Aún no hay cierres para comparar',
        'Con la medición inicial y el cierre del mes salen los destacados.',
        '<a class="btn btn-outline btn-sm" href="#/coach/mediciones">' + ico('regla', 15) + ' Ir a mediciones</a>');
    } else {
      cuerpoMejores = '<div class="list cc-lista">';
      for (i = 0; i < mejores.lista.length; i++) {
        f = mejores.lista[i];
        if (mejores.base === 'comparativo') {
          cuerpoMejores += tarjetaSocioHTML(f,
            C.textoNivel(f.nivel) + ' · ' + U.nombreMes(f.periodoComparativo).toLowerCase(),
            f.puntaje, tonoNivel(f.nivel),
            '<span class="badge ' + esc(C.claseNivel(f.nivel)) + '">' + esc(f.puntaje + '/100') + '</span>');
        } else {
          cuerpoMejores += tarjetaSocioHTML(f,
            f.adherencia.hechas + ' de ' + f.adherencia.esperadas + ' entrenos este mes',
            f.adherencia.pct, tonoPct(f.adherencia.pct),
            '<span class="badge ' + esc(f.adherencia.clase) + '">' + esc(U.pct(f.adherencia.pct, 0)) + '</span>');
        }
      }
      cuerpoMejores += '</div>';
    }

    var cuerpoRiesgo;
    if (!d.riesgo.length) {
      cuerpoRiesgo = d.activos.length
        ? vacioAmableHTML('escudo', 'Nadie en riesgo', 'Buen seguimiento 💪')
        : vacioAmableHTML('socios', 'Sin socios activos', 'Aquí verás a quien necesite un empujón.');
    } else {
      cuerpoRiesgo = '<div class="list cc-lista">';
      for (i = 0; i < d.riesgo.length; i++) {
        var r = d.riesgo[i];
        cuerpoRiesgo += tarjetaSocioHTML(r.ficha, r.motivo.texto, r.score, tonoPct(r.score),
          '<span class="badge badge-danger">' + esc(r.motivo.etiqueta) + '</span>');
      }
      cuerpoRiesgo += '</div>';
    }

    return '<div class="grid g2">' +
      '<div class="card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + ico('trofeo', 18) + '<span>Mis socios destacados</span></div>' +
          '<a class="ver-mas" href="#/coach/socios">Ver todos' + ico('flecha-der', 14) + '</a>' +
        '</div>' +
        '<div class="card-body">' + cuerpoMejores + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + ico('alerta', 18) + '<span>En riesgo</span></div>' +
          '<a class="ver-mas" href="#/coach/socios">Ver todos' + ico('flecha-der', 14) + '</a>' +
        '</div>' +
        '<div class="card-body">' + cuerpoRiesgo + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderInicio(ctx) {
    asegurarEstilos();

    var coach = (ctx && ctx.usuario) || usuarioActual();
    if (!coach) return paginaSinSesion();

    var hoy = U.hoy();
    var periodo = U.mesActual();
    var d = tableroDe(coach, periodo);

    var lunes = lunesDe(hoy);
    var domingo = U.sumaDias(lunes, 6) || lunes;
    var semana = sesionesDeCoach(coach.id, lunes, domingo);
    var sesionesHoy = [], i;
    for (i = 0; i < semana.length; i++) if (semana[i].fecha === hoy) sesionesHoy.push(semana[i]);

    var html = '<div class="page" data-cc-inicio>' +
      saludoHTML(coach) +
      hoyHTML(resumenHoy(coach, d, sesionesHoy)) +
      tilesHTML(d, cuentaSesiones(semana)) +
      pendientesHTML(d) +
      destacadosHTML(d) +
    '</div>';

    return { html: html, listo: enganchar };
  }

  /* =============================================================
     6. Agenda semanal (gira alrededor de las sesiones)
     ============================================================= */

  /** Nombres cortos de una lista de fichas: 'Ana, Luis y 3 más'. */
  function nombresDe(fichas, tope) {
    var max = tope || 3;
    var nombres = [], i;
    for (i = 0; i < fichas.length && i < max; i++) nombres.push(primerNombre(fichas[i].socio));
    var resto = fichas.length - nombres.length;
    var texto = nombres.join(', ');
    if (resto > 0) texto += ' y ' + resto + ' más';
    return texto;
  }

  /** Recordatorios de las mediciones pendientes del mes dentro de la semana. */
  function itemsMedicion(d, lunes, domingo) {
    var salida = [];
    var hoy = U.hoy();

    function agregar(tipo, lista, periodo, singular, pluralTxt) {
      if (!lista.length) return;
      var ancla = anclaMedicion(periodo, tipo);
      var atrasada = ancla < hoy;
      if (atrasada) ancla = hoy;
      if (!ancla || ancla < lunes || ancla > domingo) return;
      salida.push({
        fecha: ancla,
        orden: 9000,
        tipo: 'medicion',
        titulo: plural(lista.length, singular, pluralTxt),
        detalle: nombresDe(lista) + (atrasada ? ' · ya toca' : ''),
        href: '#/coach/mediciones'
      });
    }

    agregar('inicial', d.sinInicial, d.periodo, 'medición inicial', 'mediciones iniciales');

    /* Los cierres se agrupan por su periodo (el mes pasado puede seguir abierto). */
    var porPeriodo = U.agrupar(d.cierres, function (f) { return f.cierre.periodo; });
    for (var k in porPeriodo) {
      if (!Object.prototype.hasOwnProperty.call(porPeriodo, k)) continue;
      agregar('final', porPeriodo[k], k, 'cierre de mes', 'cierres de mes');
    }
    return salida;
  }

  /** Cumpleaños de los socios del coach dentro de la semana mostrada. */
  function itemsCumple(d, lunes) {
    var salida = [], i, j;
    for (j = 0; j < 7; j++) {
      var fecha = U.sumaDias(lunes, j);
      var pf = U.partesDe(fecha);
      if (!pf) continue;
      for (i = 0; i < d.fichas.length; i++) {
        var socio = d.fichas[i].socio;
        var pn = U.partesDe(socio.fechaNacimiento);
        if (!pn || pn.m !== pf.m || pn.d !== pf.d) continue;
        var anios = U.edad(socio.fechaNacimiento, fecha);
        salida.push({
          fecha: fecha,
          orden: 0,
          tipo: 'cumple',
          titulo: 'Cumple ' + U.nombreCompleto(socio),
          detalle: anios > 0 ? anios + ' años · felicítalo' : 'Felicítalo',
          href: '#/coach/socio?id=' + encodeURIComponent(socio.id)
        });
      }
    }
    return salida;
  }

  /** Eventos especiales del coach dentro de la semana. */
  function itemsEvento(coachId, lunes, domingo) {
    var salida = [];
    var lista = DB.donde('eventos', function (e) {
      if (!e || e.coachId !== coachId || e.activo === false) return false;
      var f = String(e.fecha || '').slice(0, 10);
      return f >= lunes && f <= domingo;
    });
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      var min = minutosDe(e.hora);
      var inscritos = esArreglo(e.inscritos) ? e.inscritos.length : 0;
      var cupo = Math.round(Number(e.cupo));
      if (!isFinite(cupo) || cupo < 0) cupo = 0;
      salida.push({
        fecha: String(e.fecha).slice(0, 10),
        orden: 100 + (min === null ? 0 : min),
        tipo: 'evento',
        titulo: (TIPO_EVENTO[e.tipo] ? TIPO_EVENTO[e.tipo] + ': ' : '') + String(e.nombre || 'Evento'),
        detalle: (e.hora ? horaTexto(e.hora) + ' · ' : '') + (e.lugar ? String(e.lugar) + ' · ' : '') +
          inscritos + (cupo ? '/' + cupo : '') + ' inscritos',
        eventoId: e.id
      });
    }
    return salida;
  }

  function itemsSesion(vistas) {
    var salida = [];
    for (var i = 0; i < vistas.length; i++) {
      var v = vistas[i];
      salida.push({
        fecha: v.fecha,
        orden: 100 + v.min,
        tipo: 'sesion',
        titulo: v.hora + ' · ' + v.nombre,
        detalle: TIPO_SESION[v.tipo] + ' · ' + v.dur + ' min',
        vista: v
      });
    }
    return salida;
  }

  /** Clave numérica para ordenar los elementos por fecha y hora. */
  function claveCronologica(it) {
    return U.diasEntre('2000-01-01', it.fecha) * 10000 + (Number(it.orden) || 0);
  }

  /** Todo lo que la agenda necesita de una semana. */
  function agendaDe(coach, lunes) {
    var domingo = U.sumaDias(lunes, 6) || lunes;
    var hoy = U.hoy();
    var d = tableroDe(coach, U.mesActual());
    var sesiones = sesionesDeCoach(coach.id, lunes, domingo);

    var items = itemsSesion(sesiones)
      .concat(itemsCumple(d, lunes))
      .concat(itemsMedicion(d, lunes, domingo))
      .concat(itemsEvento(coach.id, lunes, domingo));
    items = U.ordenar(items, claveCronologica, 'asc');

    var dias = [], j, i;
    var huecosLibres = 0;
    for (j = 0; j < 7; j++) {
      var fecha = U.sumaDias(lunes, j);
      var delDia = [], nSes = 0;
      for (i = 0; i < items.length; i++) {
        if (items[i].fecha !== fecha) continue;
        delDia.push(items[i]);
        if (items[i].tipo === 'sesion' && items[i].vista.estado !== 'cancelada') nSes++;
      }
      var libres = fecha >= hoy ? huecosLibresDe(coach.id, fecha) : 0;
      huecosLibres += libres;
      dias.push({ fecha: fecha, idx: j, items: delDia, sesiones: nSes, huecosLibres: libres, esHoy: fecha === hoy });
    }

    var atendidos = {}, cuantos = 0, cumples = 0;
    for (i = 0; i < sesiones.length; i++) {
      var v = sesiones[i];
      if ((v.estado === 'agendada' || v.estado === 'completada') && v.socio && !atendidos[v.socio.id]) {
        atendidos[v.socio.id] = true;
        cuantos++;
      }
    }
    for (i = 0; i < items.length; i++) if (items[i].tipo === 'cumple') cumples++;

    return {
      lunes: lunes,
      domingo: domingo,
      tablero: d,
      sesiones: sesiones,
      items: items,
      dias: dias,
      totalSesiones: cuentaSesiones(sesiones),
      huecosLibres: huecosLibres,
      sociosAtendidos: cuantos,
      cumples: cumples
    };
  }

  /* ---------- Piezas de la agenda ---------- */

  function sesionCardHTML(v, opts) {
    var o = opts || {};
    var idx = indiceDiaDeFecha(v.fecha);
    var p = U.partesDe(v.fecha);
    var hoy = U.hoy();
    var linea = TIPO_SESION[v.tipo] + ' · ' + v.dur + ' min' + (v.objetivo ? ' · ' + U.truncar(v.objetivo, 40) : '');

    var acciones = '';
    if (!o.sinAcciones) {
      acciones = '<div class="sesion-acciones">' +
        (v.estado !== 'agendada' ? U.badge(ESTADO_SESION[v.estado], BADGE_ESTADO[v.estado]) : '') +
        botonHTML('btn-ghost', 'Ver', 'ojo', 'data-cc-sesion="' + esc(v.id) + '"') +
      '</div>';
    }

    var notas = '';
    if (o.conNotas && (v.notasCoach || v.notasSocio)) {
      notas = '<div class="sesion-notas">' +
        (v.notasCoach ? '<b>Tus notas:</b> ' + esc(v.notasCoach) : '') +
        (v.notasCoach && v.notasSocio ? '<br>' : '') +
        (v.notasSocio ? '<b>Del socio:</b> ' + esc(v.notasSocio) : '') +
      '</div>';
    }

    return '<div class="sesion-card ' + esc(v.estado) + (v.fecha === hoy ? ' es-hoy' : '') + '">' +
      '<div class="sesion-hora">' + esc(v.hora) +
        '<small>' + esc(DIAS_CORTOS[idx] + ' ' + (p ? p.d : '')) + '</small></div>' +
      '<div class="sesion-info">' +
        '<b>' + esc(v.nombre) + '</b>' +
        '<span>' + esc(linea) + '</span>' +
      '</div>' +
      acciones + notas +
    '</div>';
  }

  function chipsDiasHTML(ag, diaSel) {
    var html = '<div class="chip-dias" role="tablist" aria-label="Días de la semana">';
    for (var j = 0; j < ag.dias.length; j++) {
      var dia = ag.dias[j];
      var p = U.partesDe(dia.fecha);
      var clases = 'chip-dia' + (dia.fecha === diaSel ? ' on' : '') + (dia.esHoy ? ' es-hoy' : '') +
        (dia.sesiones ? ' con-sesion' : '');
      html += '<button type="button" class="' + clases + '" data-cc-dia="' + esc(dia.fecha) + '"' +
        ' role="tab" aria-selected="' + (dia.fecha === diaSel ? 'true' : 'false') + '"' +
        ' title="' + esc(DIAS_LARGOS[j] + (dia.sesiones ? ' · ' + plural(dia.sesiones, 'sesión', 'sesiones') : '')) + '">' +
        '<b>' + esc(p ? p.d : '') + '</b><span>' + esc(DIAS_CORTOS[j]) + '</span>' +
      '</button>';
    }
    html += '</div>';
    return html;
  }

  function iconoItem(tipo) {
    if (tipo === 'cumple') return 'estrella';
    if (tipo === 'medicion') return 'regla';
    if (tipo === 'evento') return 'trofeo';
    return 'calendario';
  }

  function badgeItem(tipo) {
    if (tipo === 'cumple') return U.badge('Cumpleaños', 'info');
    if (tipo === 'medicion') return U.badge('Recordatorio', 'warn');
    if (tipo === 'evento') return U.badge('Evento', 'muted');
    return '';
  }

  /** Fila de cumpleaños, recordatorio o evento (sin sesión). */
  function otroItemHTML(it, conFecha) {
    var etiqueta = conFecha ? DIAS_CORTOS[indiceDiaDeFecha(it.fecha)] + ' ' + U.fecha(it.fecha, 'diaMes') + ' · ' : '';
    var interior =
      '<div class="list-item-main">' +
        '<b>' + ico(iconoItem(it.tipo), 14) + ' ' + esc(it.titulo) + '</b>' +
        '<span>' + esc(etiqueta + it.detalle) + '</span>' +
      '</div>' +
      '<div class="list-item-side">' + badgeItem(it.tipo) + '</div>';
    if (it.href) return '<a class="list-item" href="' + esc(it.href) + '">' + interior + '</a>';
    return '<div class="list-item">' + interior + '</div>';
  }

  function diaPanelHTML(ag, fecha) {
    var dia = null, i;
    for (i = 0; i < ag.dias.length; i++) if (ag.dias[i].fecha === fecha) dia = ag.dias[i];
    if (!dia) dia = ag.dias[0];
    if (!dia) return '';

    var sesiones = '', otros = '';
    for (i = 0; i < dia.items.length; i++) {
      var it = dia.items[i];
      if (it.tipo === 'sesion') sesiones += sesionCardHTML(it.vista);
      else otros += otroItemHTML(it, false);
    }

    var resumen = [];
    if (dia.sesiones) resumen.push(plural(dia.sesiones, 'sesión', 'sesiones'));
    if (dia.huecosLibres) resumen.push(plural(dia.huecosLibres, 'hueco libre', 'huecos libres'));
    if (!resumen.length) resumen.push(dia.fecha < U.hoy() ? 'sin sesiones' : 'sin huecos ese día');

    var cuerpo = '';
    if (sesiones) cuerpo += '<div class="sesiones">' + sesiones + '</div>';
    if (otros) cuerpo += '<div class="list cc-lista' + (sesiones ? ' cc-otros' : '') + '">' + otros + '</div>';
    if (!cuerpo) {
      cuerpo = dia.huecosLibres
        ? vacioAmableHTML('calendario', 'Día libre de sesiones',
            plural(dia.huecosLibres, 'hueco disponible', 'huecos disponibles') + ' · tus socios pueden apartar desde su panel.')
        : vacioAmableHTML('luna', 'Nada agendado', dia.fecha < U.hoy() ? 'Ese día no tuviste sesiones.' : 'No atiendes ese día.');
    }

    return '<div class="seccion-cab">' +
        '<h3>' + esc(U.capitalizar(fechaHablada(dia.fecha))) + (dia.esHoy ? ' · hoy' : '') + '</h3>' +
        '<span class="mini muted">' + esc(resumen.join(' · ')) + '</span>' +
      '</div>' +
      cuerpo;
  }

  function listaSemanaHTML(ag) {
    if (!ag.items.length) {
      return vacioAmableHTML('calendario', 'Semana tranquila', 'Sin sesiones, recordatorios ni cumpleaños.');
    }
    var html = '<div class="list cc-lista">', i;
    for (i = 0; i < ag.items.length; i++) {
      var it = ag.items[i];
      if (it.tipo === 'sesion') {
        var v = it.vista;
        html += '<button type="button" class="list-item clickable" data-cc-sesion="' + esc(v.id) + '">' +
          '<span class="pill pill-rojo cc-pill-fecha">' +
            esc(DIAS_CORTOS[indiceDiaDeFecha(v.fecha)] + ' ' + U.fecha(v.fecha, 'diaMes')) + '</span>' +
          '<div class="list-item-main">' +
            '<b>' + esc(v.hora + ' · ' + v.nombre) + '</b>' +
            '<span>' + esc(it.detalle) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' + U.badge(ESTADO_SESION[v.estado], BADGE_ESTADO[v.estado]) + '</div>' +
        '</button>';
      } else {
        html += otroItemHTML(it, true);
      }
    }
    html += '</div>';
    return html;
  }

  function cargaHTML(ag) {
    return '<div class="cc-carga">' +
      '<div class="tiles tiles-3">' +
        tileHTML('#/coach/sesiones', 'calma', 'calendario', String(ag.totalSesiones), 'sesiones', '') +
        tileHTML('#/coach/sesiones', ag.huecosLibres ? 'ok' : 'neutro', 'reloj', String(ag.huecosLibres), 'huecos libres', '') +
        tileHTML('#/coach/socios', 'info', 'socios', String(ag.sociosAtendidos), 'socios atendidos', '') +
      '</div>' +
      '<div class="animo">' +
        '<div class="animo-icono">' + ico('reloj', 20) + '</div>' +
        '<div class="animo-txt"><b>¿Abrir más huecos?</b><span>Cambia tus horarios cuando quieras.</span></div>' +
        '<a class="btn btn-outline btn-sm" href="#/coach/sesiones">' + ico('config', 15) + ' Mi disponibilidad</a>' +
      '</div>' +
    '</div>';
  }

  /** Día seleccionado válido dentro de la semana mostrada. */
  function diaSeleccionado(lunes, domingo) {
    var hoy = U.hoy();
    if (estado.dia && estado.dia >= lunes && estado.dia <= domingo) return estado.dia;
    if (hoy >= lunes && hoy <= domingo) return hoy;
    return lunes;
  }

  function renderAgenda(ctx) {
    asegurarEstilos();

    var coach = (ctx && ctx.usuario) || usuarioActual();
    if (!coach) return paginaSinSesion();

    if (!estado.semana || !U.partesDe(estado.semana)) estado.semana = lunesDe(U.hoy());
    var lunes = estado.semana;
    var ag = agendaDe(coach, lunes);
    var domingo = ag.domingo;
    var diaSel = diaSeleccionado(lunes, domingo);

    var esSemanaActual = lunes === lunesDe(U.hoy());
    var etiquetaSemana = U.fecha(lunes, 'diaMes') + ' – ' + U.fecha(domingo, 'diaMes');
    var etiquetaMes = U.mesDe(lunes) === U.mesDe(domingo)
      ? U.nombreMes(lunes)
      : U.nombreMes(lunes) + ' – ' + U.nombreMes(domingo);

    var html = '<div class="page" data-cc-agenda>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + ico('calendario', 24) + '<span>Mi agenda</span></h1>' +
          '<p class="page-sub">' + esc(etiquetaMes) + '</p>' +
        '</div>' +
        '<div class="page-acciones wrap">' +
          '<button type="button" class="btn-icono" data-cc-semana="-1" ' +
            'aria-label="Semana anterior" title="Semana anterior">' + ico('flecha-izq', 18) + '</button>' +
          '<span class="cc-semana-txt">' + esc(etiquetaSemana) + '</span>' +
          '<button type="button" class="btn-icono" data-cc-semana="1" ' +
            'aria-label="Semana siguiente" title="Semana siguiente">' + ico('flecha-der', 18) + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-cc-semana="0"' +
            (esSemanaActual ? ' disabled' : '') + '>Esta semana</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + ico('calendario', 18) + '<span>Semana de lunes a domingo</span></div>' +
          '<a class="ver-mas" href="#/coach/sesiones">Sesiones' + ico('flecha-der', 14) + '</a>' +
        '</div>' +
        '<div class="card-body">' +
          chipsDiasHTML(ag, diaSel) +
          '<div class="cc-panel-dia" data-cc-panel-dia>' + diaPanelHTML(ag, diaSel) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="grid g2">' +
        '<div class="card">' +
          '<div class="card-head">' +
            '<div class="card-title">' + ico('historial', 18) + '<span>Esta semana</span></div>' +
            '<span class="mini muted">' + esc(plural(ag.items.length, 'actividad', 'actividades')) + '</span>' +
          '</div>' +
          '<div class="card-body">' + listaSemanaHTML(ag) + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-head">' +
            '<div class="card-title">' + ico('grafica', 18) + '<span>Resumen de carga</span></div>' +
          '</div>' +
          '<div class="card-body">' + cargaHTML(ag) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    return { html: html, listo: enganchar };
  }

  /* =============================================================
     7. Acciones
     ============================================================= */

  function abrirMedicion(socioId, tipo, periodo) {
    if (!socioPropio(socioId)) return;
    if (!AG.Mod || !AG.Mod.Mediciones || typeof AG.Mod.Mediciones.capturar !== 'function') {
      U.toast('El módulo de mediciones no está disponible.', 'error');
      return;
    }
    AG.Mod.Mediciones.capturar(socioId, tipo === 'final' ? 'final' : 'inicial', periodo || U.mesActual());
  }

  function abrirRutina(socioId) {
    if (!socioPropio(socioId)) return;
    if (!AG.Mod || !AG.Mod.Rutinas || typeof AG.Mod.Rutinas.asignar !== 'function') {
      U.toast('El módulo de rutinas no está disponible.', 'error');
      return;
    }
    AG.Mod.Rutinas.asignar(socioId);
  }

  function abrirNutricion(socioId) {
    if (!socioPropio(socioId)) return;
    if (!AG.Mod || !AG.Mod.Nutricion || typeof AG.Mod.Nutricion.editorPlan !== 'function') {
      U.toast('El módulo de nutrición no está disponible.', 'error');
      return;
    }
    AG.Mod.Nutricion.editorPlan(socioId);
  }

  /** Solo se puede actuar sobre los socios propios. */
  function socioPropio(socioId) {
    var coach = usuarioActual();
    var socio = DB.usuario(socioId);
    if (!socio || socio.rol !== 'socio') {
      U.toast('No encontramos a ese socio en el sistema.', 'error');
      return null;
    }
    var permitido = AG.Auth && typeof AG.Auth.puedeVer === 'function'
      ? AG.Auth.puedeVer(coach, socioId)
      : !!(coach && socio.coachId === coach.id);
    if (!permitido) {
      U.toast('Solo puedes trabajar con los socios que tienes asignados.', 'error');
      return null;
    }
    return socio;
  }

  function abrirWhatsApp(socioId) {
    var socio = socioPropio(socioId);
    if (!socio) return;

    var tel = telWhatsApp(socio.telefono);
    if (!tel) {
      U.toast('Este socio no tiene un teléfono válido registrado.', 'warn');
      return;
    }

    var coach = usuarioActual();
    var mensaje = 'Hola ' + primerNombre(socio) + ', soy ' + primerNombre(coach) + ' de ' + nombreGym() +
      '. Te extrañamos por acá 💪 ¿Te agendo tu sesión de esta semana?';

    var url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje);
    var ventana = null;
    try { ventana = window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { ventana = null; }
    if (!ventana) U.toast('El navegador bloqueó la ventana de WhatsApp.', 'warn');
  }

  /** Detalle de una sesión: delega en el módulo si lo ofrece; si no, modal propio. */
  function abrirSesion(sesionId) {
    var coach = usuarioActual();
    if (!coach) {
      U.toast('Vuelve a iniciar sesión para ver esa sesión.', 'error');
      return;
    }
    var v = sesionPorId(coach.id, sesionId);
    if (!v) {
      U.toast('No encontramos esa sesión.', 'error');
      return;
    }

    var S = AG.Mod && AG.Mod.Sesiones;
    if (S && typeof S.abrir === 'function') {
      try { S.abrir(v.id); return; } catch (e) { /* se muestra el modal propio */ }
    }
    if (S && typeof S.detalle === 'function') {
      try { S.detalle(v.id); return; } catch (e) { /* se muestra el modal propio */ }
    }

    var socioId = v.socio ? v.socio.id : '';
    var cuerpo = '<div class="sesiones">' + sesionCardHTML(v, { sinAcciones: true, conNotas: true }) + '</div>' +
      '<div class="hoy-meta">' +
        '<span>' + ico('calendario', 15) + esc(U.capitalizar(fechaHablada(v.fecha))) + '</span>' +
        '<span>' + ico('reloj', 15) + esc(v.hora + ' · ' + v.dur + ' min') + '</span>' +
        U.badge(ESTADO_SESION[v.estado], BADGE_ESTADO[v.estado]) +
      '</div>' +
      (v.objetivo ? '<p class="mt">' + ico('meta', 15) + ' <b>Objetivo:</b> ' + esc(v.objetivo) + '</p>' : '');

    var acciones = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } }];
    if (socioId) {
      acciones.push({
        texto: 'Ficha del socio', clase: 'btn-outline', icono: 'usuario',
        onClick: function (api) { api.cerrar(); AG.Router.ir('coach/socio?id=' + encodeURIComponent(socioId)); }
      });
    }
    acciones.push({
      texto: v.estado === 'agendada' ? 'Gestionar sesión' : 'Ver sesiones', clase: 'btn-primary', icono: 'calendario',
      onClick: function (api) { api.cerrar(); AG.Router.ir('coach/sesiones'); }
    });

    U.modal({
      titulo: 'Sesión con ' + (v.socio ? primerNombre(v.socio) : 'socio'),
      cuerpo: cuerpo,
      acciones: acciones
    });
  }

  function moverSemana(paso) {
    if (paso === 0) {
      estado.semana = lunesDe(U.hoy());
    } else {
      estado.semana = U.sumaDias(lunesDe(estado.semana || U.hoy()), paso * 7) || lunesDe(U.hoy());
    }
    estado.dia = '';
    AG.Router.refrescar();
  }

  /** Cambia el día del panel sin repintar toda la pantalla. */
  function elegirDia(raiz, fecha) {
    if (!U.partesDe(fecha)) return;
    var coach = usuarioActual();
    if (!coach) return;
    estado.dia = fecha;

    var chips = U.$$('[data-cc-dia]', raiz);
    for (var i = 0; i < chips.length; i++) {
      var activo = chips[i].getAttribute('data-cc-dia') === fecha;
      chips[i].classList.toggle('on', activo);
      chips[i].setAttribute('aria-selected', activo ? 'true' : 'false');
    }

    var panel = U.$('[data-cc-panel-dia]', raiz);
    if (!panel) { AG.Router.refrescar(); return; }
    var lunes = (estado.semana && U.partesDe(estado.semana)) ? estado.semana : lunesDe(U.hoy());
    panel.innerHTML = diaPanelHTML(agendaDe(coach, lunes), fecha);
  }

  /* =============================================================
     8. Delegación de eventos
     -------------------------------------------------------------
     El router reutiliza SIEMPRE el mismo contenedor (#vista), así
     que los manejadores se enganchan una sola vez por contenedor.
     ============================================================= */

  function enganchar(raiz) {
    if (!raiz || raiz.__ccEnganchado) return;
    raiz.__ccEnganchado = true;

    U.delegar(raiz, 'click', '[data-cc-medir]', function (e, el) {
      e.preventDefault();
      abrirMedicion(el.getAttribute('data-cc-medir'),
        el.getAttribute('data-cc-tipo'),
        el.getAttribute('data-cc-periodo'));
    });

    U.delegar(raiz, 'click', '[data-cc-rutina]', function (e, el) {
      e.preventDefault();
      abrirRutina(el.getAttribute('data-cc-rutina'));
    });

    U.delegar(raiz, 'click', '[data-cc-nutricion]', function (e, el) {
      e.preventDefault();
      abrirNutricion(el.getAttribute('data-cc-nutricion'));
    });

    U.delegar(raiz, 'click', '[data-cc-wa]', function (e, el) {
      e.preventDefault();
      abrirWhatsApp(el.getAttribute('data-cc-wa'));
    });

    U.delegar(raiz, 'click', '[data-cc-sesion]', function (e, el) {
      e.preventDefault();
      abrirSesion(el.getAttribute('data-cc-sesion'));
    });

    U.delegar(raiz, 'click', '[data-cc-dia]', function (e, el) {
      e.preventDefault();
      elegirDia(raiz, el.getAttribute('data-cc-dia'));
    });

    U.delegar(raiz, 'click', '[data-cc-semana]', function (e, el) {
      e.preventDefault();
      var paso = Number(el.getAttribute('data-cc-semana'));
      moverSemana(isFinite(paso) ? paso : 0);
    });
  }

  /* =============================================================
     9. API pública y rutas
     ============================================================= */

  AG.Views.Coach = {
    renderInicio: renderInicio,
    renderAgenda: renderAgenda,
    tablero: tableroDe,
    ficha: fichaDe,
    agenda: agendaDe,
    sesionesDe: sesionesDeCoach,
    resumenHoy: resumenHoy
  };

  AG.Router.registrar({
    path: 'coach/inicio',
    roles: ['coach'],
    titulo: 'Mi panel',
    nav: { etiqueta: 'Inicio', icono: 'inicio', grupo: 'Principal', orden: 1 },
    render: renderInicio
  });

  AG.Router.registrar({
    path: 'coach/agenda',
    roles: ['coach'],
    titulo: 'Mi agenda',
    nav: { etiqueta: 'Agenda', icono: 'calendario', grupo: 'Principal', orden: 2 },
    render: renderAgenda
  });

})(window.AG);
