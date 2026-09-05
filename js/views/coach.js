/* =============================================================
   ALLIANCE GYM — AG.Views.Coach
   -------------------------------------------------------------
   Centro de trabajo del entrenador. Dos pantallas:

     'coach/inicio'  -> saludo, KPIs, pendientes de hoy, clases de
                        hoy, destacados del mes y accesos rápidos.
     'coach/agenda'  -> semana lunes-domingo con clases, mediciones
                        pendientes, cumpleaños y resumen de carga.

   Control de acceso REAL: el coach solo ve a los socios que tiene
   asignados (AG.DB.sociosDe). Nunca se listan socios ajenos.

   No duplica lógica de los módulos: delega en
     AG.Mod.Mediciones.capturar(socioId, tipo, periodo)
     AG.Mod.Rutinas.asignar(socioId)
     AG.Mod.Nutricion.editorPlan(socioId)
     AG.Mod.Clases.deCoach(coachId) / AG.Mod.Clases.abrir(claseId)
     AG.Mod.Socios.adherenciaDe(socio)

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
  var Charts = AG.Charts;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  var CSS_ID = 'ag-coach-css';

  /* Días de la semana empezando en lunes (así trabaja la agenda). */
  var DIAS_CLAVE = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  var DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /* Días sin asistir a partir de los cuales el socio entra a la lista de rescate. */
  var DIAS_SIN_VENIR = 7;

  /* Cuántas filas se muestran por grupo antes de mandar a la pantalla completa. */
  var MAX_FILAS = 5;

  /* Estado vivo de la pantalla (sobrevive a los repintados del router). */
  var estado = { semana: '' };

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

  /** 'Buenos días' / 'Buenas tardes' / 'Buenas noches'. */
  function saludo() {
    var h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function primerNombre(usuario) {
    var n = String((usuario && usuario.nombre) || U.nombreCompleto(usuario) || '').trim();
    var partes = n.split(/\s+/);
    return partes[0] || 'entrenador';
  }

  function etiquetaObjetivo(objetivo) {
    return (C.ETIQUETA_OBJETIVO && C.ETIQUETA_OBJETIVO[objetivo]) || 'Sin objetivo definido';
  }

  /** Índice 0..6 (lunes = 0) del nombre de un día guardado en la base. */
  function indiceDia(nombre) {
    var t = U.normalizar(nombre);
    var i;
    if (!t) return 0;
    for (i = 0; i < DIAS_CLAVE.length; i++) if (DIAS_CLAVE[i] === t) return i;
    for (i = 0; i < DIAS_CLAVE.length; i++) if (DIAS_CLAVE[i].slice(0, 3) === t.slice(0, 3)) return i;
    return 0;
  }

  /** Índice 0..6 (lunes = 0) de una fecha 'YYYY-MM-DD'. */
  function indiceDiaDeFecha(fechaISO) {
    var d = U.aDate(fechaISO);
    if (!d) return 0;
    return (d.getDay() + 6) % 7;
  }

  /** Lunes de la semana que contiene a la fecha dada. */
  function lunesDe(fechaISO) {
    var base = fechaISO || U.hoy();
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

  /** Hora siempre con dos dígitos ('7:00' -> '07:00'). */
  function horaTexto(hora) {
    var t = U.fecha(hora, 'hora');
    return t || String(hora || '');
  }

  /** Color válido de la base o el rojo del sistema. */
  function colorSeguro(valor) {
    var c = String(valor === null || valor === undefined ? '' : valor).trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : 'var(--rojo)';
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

  /* =============================================================
     2. Estilos propios de la vista
     ============================================================= */

  function asegurarEstilos() {
    if (!document || document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Encabezado de bienvenida */
      '.cc-hero{display:flex;align-items:center;gap:18px;flex-wrap:wrap}' +
      '.cc-hero-txt{flex:1 1 240px;min-width:0}' +
      '.cc-hero-anillo{flex:0 0 auto;width:132px;max-width:42vw}' +
      '.cc-saludo{margin:0;font-size:clamp(19px,3vw,26px);font-weight:800;' +
        'letter-spacing:-.02em;color:var(--texto);line-height:1.15}' +
      '.cc-estrellas{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +

      /* Grupos de pendientes */
      '.cc-grupo{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);overflow:hidden}' +
      '.cc-grupo+.cc-grupo{margin-top:12px}' +
      '.cc-grupo-head{display:flex;align-items:center;gap:9px;padding:10px 12px;' +
        'border-bottom:1px solid var(--borde);font-size:12.5px;font-weight:800;color:var(--texto)}' +
      '.cc-grupo-head svg{flex:0 0 auto}' +
      '.cc-grupo-head .cc-cuenta{margin-left:auto}' +
      '.cc-grupo .list{border:0;border-radius:0;background:transparent}' +
      '.cc-grupo .list-item{padding:9px 12px}' +
      '.cc-pie{padding:8px 12px;border-top:1px solid var(--borde)}' +
      '.cc-tono-warn .cc-grupo-head svg{color:var(--warn)}' +
      '.cc-tono-info .cc-grupo-head svg{color:var(--info)}' +
      '.cc-tono-error .cc-grupo-head svg{color:var(--error)}' +
      '.cc-tono-ok .cc-grupo-head svg{color:var(--ok)}' +

      /* Semana de la agenda */
      '.cc-sem{display:grid;grid-template-columns:repeat(7,minmax(138px,1fr));gap:10px;align-items:start}' +
      '.cc-dia{display:flex;flex-direction:column;gap:8px;min-width:0;padding:10px;' +
        'border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2)}' +
      '.cc-dia.hoy{border-color:var(--rojo);background:var(--rojo-bg)}' +
      '.cc-dia-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px}' +
      '.cc-dia-nom{font-size:10.5px;font-weight:800;letter-spacing:.1em;' +
        'text-transform:uppercase;color:var(--texto-3)}' +
      '.cc-dia.hoy .cc-dia-nom{color:var(--rojo-2)}' +
      '.cc-dia-num{font-size:17px;font-weight:800;line-height:1;color:var(--texto);' +
        'font-variant-numeric:tabular-nums}' +
      '.cc-vacio-dia{font-size:11px;color:var(--texto-3);padding:2px 1px}' +

      /* Tarjetas de evento */
      '.cc-ev{display:flex;flex-direction:column;gap:2px;min-width:0;width:100%;' +
        'padding:7px 9px;border:1px solid var(--borde);border-left:3px solid var(--borde-2);' +
        'border-radius:var(--radio-sm);background:var(--panel);color:var(--texto);text-align:left;' +
        'transition:border-color var(--trans),transform var(--trans)}' +
      'a.cc-ev,button.cc-ev{cursor:pointer}' +
      'a.cc-ev:hover,button.cc-ev:hover{transform:translateY(-1px)}' +
      '.cc-ev b{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.cc-ev span{font-size:11px;color:var(--texto-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.cc-ev-medicion{border-left-color:var(--warn)}' +
      '.cc-ev-cumple{border-left-color:var(--info)}' +

      /* Accesos rápidos */
      '.cc-accesos{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}' +
      '.cc-acceso{display:flex;align-items:center;gap:10px;padding:13px;font-size:13px;' +
        'font-weight:700;color:var(--texto);border:1px solid var(--borde);' +
        'border-radius:var(--radio-sm);background:var(--panel-2);' +
        'transition:border-color var(--trans),transform var(--trans)}' +
      '.cc-acceso:hover{border-color:var(--rojo);transform:translateY(-2px)}' +
      '.cc-acceso svg{flex:0 0 auto;color:var(--rojo)}' +

      '.cc-semana-txt{min-width:170px;text-align:center;font-weight:800;' +
        'font-variant-numeric:tabular-nums}' +

      '@media (max-width:1000px){' +
        '.cc-sem{display:flex;flex-direction:column}' +
        '.cc-hero-anillo{width:110px}' +
        '.cc-semana-txt{min-width:0;flex:1 1 auto}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Datos del coach (solo sus socios)
     ============================================================= */

  /** Adherencia del mes en curso; usa el módulo de socios si está cargado. */
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
    var asistencias = DB.asistenciasDe(socio.id);
    var ultima = asistencias.length ? String(asistencias[0].fecha || '').slice(0, 10) : '';

    var medIni = DB.medicionDelMes(socio.id, periodo, 'inicial');
    var medFin = DB.medicionDelMes(socio.id, periodo, 'final');

    var cmp = null;
    var periodoCmp = '';

    if (medIni && medFin) {
      var actual = C.compararMediciones(medIni, medFin, socio.objetivo);
      if (actual && actual.ok) { cmp = actual; periodoCmp = periodo; }
    }
    if (!cmp) {
      /* A principio de mes todavía no hay cierre: se usa el mes anterior. */
      var previo = U.mesDe(U.sumaMeses(periodo + '-01', -1));
      var pi = previo ? DB.medicionDelMes(socio.id, previo, 'inicial') : null;
      var pf = previo ? DB.medicionDelMes(socio.id, previo, 'final') : null;
      if (pi && pf) {
        var anterior = C.compararMediciones(pi, pf, socio.objetivo);
        if (anterior && anterior.ok) { cmp = anterior; periodoCmp = previo; }
      }
    }

    var activa = DB.rutinaActivaDe(socio.id);

    return {
      socio: socio,
      membresia: C.estadoMembresia(socio),
      adherencia: adherenciaDe(socio),
      medIni: medIni,
      medFin: medFin,
      comparativo: cmp,
      periodoComparativo: periodoCmp,
      puntaje: (cmp && cmp.resumen) ? cmp.resumen.puntaje : null,
      nivel: (cmp && cmp.resumen) ? cmp.resumen.nivel : '',
      rutina: activa ? activa.rutina : null,
      plan: DB.planNutricionDe(socio.id),
      ultimaAsistencia: ultima,
      diasSinVenir: ultima ? Math.max(0, U.diasEntre(ultima, U.hoy())) : null
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

    var activos = [], sinInicial = [], sinCierre = [], sinRutina = [],
        sinPlan = [], ausentes = [], vencidos = [];
    var medicionesHechas = 0;

    for (i = 0; i < fichas.length; i++) {
      f = fichas[i];
      var esActivo = f.socio.estado === 'activo';

      if (f.membresia.estado === 'vencido') vencidos.push(f);
      if (!esActivo) continue;

      activos.push(f);
      if (f.medIni) medicionesHechas++;
      if (f.medFin) medicionesHechas++;

      if (!f.medIni) sinInicial.push(f);
      else if (!f.medFin) sinCierre.push(f);

      if (!f.rutina) sinRutina.push(f);
      if (!f.plan) sinPlan.push(f);
      if (f.diasSinVenir === null || f.diasSinVenir >= DIAS_SIN_VENIR) ausentes.push(f);
    }

    var esperadas = activos.length * 2;
    var calificacion = C.promedioCalificacion(DB.calificacionesDe(coach ? coach.id : ''));

    return {
      periodo: periodo,
      fichas: fichas,
      asignados: asignados.length,
      activos: activos,
      sinInicial: sinInicial,
      sinCierre: sinCierre,
      sinRutina: sinRutina,
      sinPlan: sinPlan,
      ausentes: ausentes,
      vencidos: vencidos,
      pendientes: sinInicial.length + sinCierre.length,
      adherencia: Math.round(U.promedio(activos, function (x) { return x.adherencia.pct; })),
      medicionesHechas: medicionesHechas,
      medicionesEsperadas: esperadas,
      pctMediciones: esperadas > 0 ? Math.round(medicionesHechas / esperadas * 100) : 0,
      calificacion: calificacion,
      mejores: mejoresDe(fichas),
      riesgo: riesgoDe(fichas)
    };
  }

  /** Tres socios con mejor puntaje de comparativo (o mejor adherencia). */
  function mejoresDe(fichas) {
    var conPuntaje = [], i;
    for (i = 0; i < fichas.length; i++) {
      if (fichas[i].puntaje !== null && fichas[i].puntaje !== undefined) conPuntaje.push(fichas[i]);
    }
    if (conPuntaje.length) {
      return { base: 'comparativo', lista: U.ordenar(conPuntaje, 'puntaje', 'desc').slice(0, 3) };
    }
    var conAdherencia = [];
    for (i = 0; i < fichas.length; i++) {
      if (fichas[i].socio.estado === 'activo' && fichas[i].adherencia.pct > 0) conAdherencia.push(fichas[i]);
    }
    return {
      base: 'adherencia',
      lista: U.ordenar(conAdherencia, function (f) { return f.adherencia.pct; }, 'desc').slice(0, 3)
    };
  }

  /** Tres socios en riesgo: peor adherencia o retroceso en el comparativo. */
  function riesgoDe(fichas) {
    var lista = [], i;
    for (i = 0; i < fichas.length; i++) {
      var f = fichas[i];
      if (f.socio.estado !== 'activo') continue;

      var motivos = [];
      var score = f.adherencia.pct;

      if (f.puntaje !== null && f.puntaje < 45) {
        motivos.push('retroceso en el comparativo (' + f.puntaje + '/100)');
        if (f.puntaje < score) score = f.puntaje;
      }
      if (f.adherencia.pct < 60) {
        motivos.push('adherencia ' + U.pct(f.adherencia.pct, 0));
      }
      if (f.diasSinVenir === null) {
        motivos.push('sin registro de asistencia');
        score = Math.min(score, 5);
      } else if (f.diasSinVenir >= DIAS_SIN_VENIR) {
        motivos.push('sin venir hace ' + f.diasSinVenir + (f.diasSinVenir === 1 ? ' día' : ' días'));
        score = Math.min(score, 20);
      }
      if (!motivos.length) continue;

      lista.push({ ficha: f, score: score, motivos: motivos });
    }
    return U.ordenar(lista, 'score', 'asc').slice(0, 3);
  }

  /* =============================================================
     4. Piezas de interfaz reutilizables
     ============================================================= */

  function vacioHTML(mensaje, iconoNombre, extraHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ico(iconoNombre || 'info', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (extraHTML || '') +
    '</div>';
  }

  function paginaSinSesion() {
    return '<div class="page"><div class="card"><div class="card-body">' +
      vacioHTML('Tu sesión terminó. Vuelve a entrar para ver tu panel.', 'usuario') +
      '</div></div></div>';
  }

  function kpiHTML(iconoNombre, valor, etiqueta, tono, pie) {
    return '<div class="kpi' + (tono ? ' kpi-' + esc(tono) : '') + '">' +
      '<div class="kpi-icono">' + ico(iconoNombre, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        (pie ? '<div class="kpi-trend plana">' + esc(pie) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function botonHTML(clase, texto, iconoNombre, atributos) {
    return '<button type="button" class="btn ' + clase + ' btn-sm" ' + atributos + '>' +
      ico(iconoNombre, 15) + ' ' + esc(texto) + '</button>';
  }

  function filaSocioHTML(ficha, detalle, botones) {
    return '<div class="list-item">' +
      U.avatar(ficha.socio, 'sm') +
      '<div class="list-item-main">' +
        '<b>' + esc(U.nombreCompleto(ficha.socio)) + '</b>' +
        '<span class="mini muted">' + esc(detalle) + '</span>' +
      '</div>' +
      '<div class="list-item-side">' + botones + '</div>' +
    '</div>';
  }

  /** Bloque de pendientes de un tipo. Devuelve '' cuando no hay nada que hacer. */
  function grupoHTML(cfg) {
    var items = cfg.items || [];
    if (!items.length) return '';

    var filas = '', i;
    var tope = Math.min(items.length, MAX_FILAS);
    for (i = 0; i < tope; i++) filas += cfg.fila(items[i]);
    var resto = items.length - tope;

    return '<div class="cc-grupo cc-tono-' + esc(cfg.tono) + '">' +
      '<div class="cc-grupo-head">' + ico(cfg.icono, 16) +
        '<span>' + esc(cfg.titulo) + '</span>' +
        '<span class="badge badge-' + esc(cfg.badge) + ' cc-cuenta">' + items.length + '</span>' +
      '</div>' +
      '<div class="list">' + filas + '</div>' +
      (resto > 0
        ? '<div class="cc-pie"><a class="btn btn-ghost btn-sm btn-block" href="' + esc(cfg.verMas) + '">' +
            esc('Ver ' + resto + (resto === 1 ? ' socio más' : ' socios más')) + '</a></div>'
        : '') +
    '</div>';
  }

  /* =============================================================
     5. Pantalla de inicio
     ============================================================= */

  function heroHTML(coach, d) {
    var cal = d.calificacion;
    var chips = '';

    if (coach.especialidad) {
      chips += '<span class="chip chip-sm">' + ico('trofeo', 14) + esc(coach.especialidad) + '</span>';
    }
    chips += '<span class="chip chip-sm">' + ico('socios', 14) +
      esc(d.activos.length + (d.activos.length === 1 ? ' socio activo' : ' socios activos')) + '</span>';
    if (coach.cupoMaximo) {
      chips += '<span class="chip chip-sm">' + ico('meta', 14) +
        esc('Cupo ' + d.asignados + ' / ' + coach.cupoMaximo) + '</span>';
    }

    var textoResenias = cal.total
      ? 'de ' + cal.total + (cal.total === 1 ? ' reseña de tus socios' : ' reseñas de tus socios')
      : 'Todavía nadie te ha calificado';

    return '<div class="card card-rojo"><div class="card-body">' +
      '<div class="cc-hero">' +
        '<div class="cc-hero-txt stack-sm">' +
          '<p class="cc-saludo">' + esc(saludo() + ', ' + primerNombre(coach)) + '</p>' +
          '<p class="page-sub">' + esc(U.capitalizar(U.fecha(U.hoy(), 'largo'))) + '</p>' +
          '<div class="cc-estrellas">' +
            U.estrellas(cal.promedio, { size: 18 }) +
            '<b class="nums">' + esc(U.num(cal.promedio, 1)) + '</b>' +
            '<span class="mini muted">' + esc(textoResenias) + '</span>' +
          '</div>' +
          '<div class="chips">' + chips + '</div>' +
        '</div>' +
        '<div class="cc-hero-anillo">' +
          Charts.progreso(d.pctMediciones, { alto: 132, etiqueta: 'Mediciones' }) +
          '<p class="micro muted txt-centro">' +
            esc(d.medicionesHechas + ' de ' + d.medicionesEsperadas + ' del mes') + '</p>' +
        '</div>' +
      '</div>' +
    '</div></div>';
  }

  function kpisHTML(d) {
    var tonoPend = d.pendientes === 0 ? 'ok' : (d.pendientes > 4 ? 'error' : 'warn');
    var tonoAdh = d.adherencia >= 80 ? 'ok' : (d.adherencia >= 50 ? 'warn' : 'error');

    return '<div class="grid g4">' +
      kpiHTML('socios', d.activos.length, 'Mis socios activos', '',
        d.asignados + (d.asignados === 1 ? ' asignado en total' : ' asignados en total')) +
      kpiHTML('regla', d.pendientes, 'Mediciones pendientes', tonoPend,
        d.sinInicial.length + ' iniciales · ' + d.sinCierre.length + ' cierres') +
      kpiHTML('fuego', U.pct(d.adherencia, 0), 'Adherencia promedio', tonoAdh,
        'Sesiones cumplidas este mes') +
      kpiHTML('estrella', U.num(d.calificacion.promedio, 1), 'Mi calificación', 'info',
        d.calificacion.total
          ? d.calificacion.total + (d.calificacion.total === 1 ? ' reseña' : ' reseñas')
          : 'Sin reseñas todavía') +
    '</div>';
  }

  function pendientesHTML(d) {
    var periodo = d.periodo;
    var grupos = '';

    grupos += grupoHTML({
      titulo: 'Medición inicial pendiente', icono: 'regla', tono: 'warn', badge: 'warn',
      items: d.sinInicial, verMas: '#/coach/mediciones',
      fila: function (f) {
        return filaSocioHTML(f,
          'Sin medición de inicio de ' + U.nombreMes(periodo),
          botonHTML('btn-primary', 'Medir', 'regla',
            'data-cc-medir="' + esc(f.socio.id) + '" data-cc-tipo="inicial" data-cc-periodo="' + esc(periodo) + '"'));
      }
    });

    grupos += grupoHTML({
      titulo: 'Cierre de mes pendiente', icono: 'balanza', tono: 'warn', badge: 'warn',
      items: d.sinCierre, verMas: '#/coach/mediciones',
      fila: function (f) {
        var detalle = f.medIni && f.medIni.fecha
          ? 'Inicio tomado el ' + U.fecha(f.medIni.fecha, 'corto') + ' · falta el cierre'
          : 'Falta el cierre de ' + U.nombreMes(periodo);
        return filaSocioHTML(f, detalle,
          botonHTML('btn-primary', 'Cerrar mes', 'check',
            'data-cc-medir="' + esc(f.socio.id) + '" data-cc-tipo="final" data-cc-periodo="' + esc(periodo) + '"'));
      }
    });

    grupos += grupoHTML({
      titulo: 'Socios sin rutina', icono: 'mancuerna', tono: 'info', badge: 'info',
      items: d.sinRutina, verMas: '#/coach/rutinas',
      fila: function (f) {
        return filaSocioHTML(f,
          'Sin rutina activa · ' + etiquetaObjetivo(f.socio.objetivo),
          botonHTML('btn-outline', 'Asignar', 'mas', 'data-cc-rutina="' + esc(f.socio.id) + '"'));
      }
    });

    grupos += grupoHTML({
      titulo: 'Socios sin plan de nutrición', icono: 'manzana', tono: 'info', badge: 'info',
      items: d.sinPlan, verMas: '#/coach/nutricion',
      fila: function (f) {
        return filaSocioHTML(f,
          'Sin plan alimenticio activo · ' + etiquetaObjetivo(f.socio.objetivo),
          botonHTML('btn-outline', 'Armar plan', 'nutricion', 'data-cc-nutricion="' + esc(f.socio.id) + '"'));
      }
    });

    grupos += grupoHTML({
      titulo: 'No asisten hace ' + DIAS_SIN_VENIR + '+ días', icono: 'corazon', tono: 'error', badge: 'danger',
      items: d.ausentes, verMas: '#/coach/socios',
      fila: function (f) {
        var detalle = f.diasSinVenir === null
          ? 'Sin ninguna asistencia registrada'
          : 'Última visita ' + U.fechaRelativa(f.ultimaAsistencia) +
            ' (' + f.diasSinVenir + (f.diasSinVenir === 1 ? ' día' : ' días') + ')';
        return filaSocioHTML(f, detalle,
          botonHTML('btn-outline', 'WhatsApp', 'whatsapp', 'data-cc-wa="' + esc(f.socio.id) + '"'));
      }
    });

    grupos += grupoHTML({
      titulo: 'Membresía vencida', icono: 'tarjeta', tono: 'error', badge: 'danger',
      items: d.vencidos, verMas: '#/coach/socios',
      fila: function (f) {
        return filaSocioHTML(f, f.membresia.texto,
          botonHTML('btn-outline', 'Avisar a recepción', 'campana',
            'data-cc-recepcion="' + esc(f.socio.id) + '"'));
      }
    });

    if (!grupos) {
      grupos = !d.activos.length
        ? vacioHTML('Todavía no tienes socios asignados. En cuanto dirección te asigne alguno, aquí aparecerán sus pendientes.', 'socios')
        : vacioHTML('Vas al día: no tienes pendientes con tus socios. Aprovecha para revisar sus comparativos.', 'check',
            '<a class="btn btn-outline btn-sm" href="#/coach/mediciones">Ver mediciones</a>');
    }

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<div class="card-title">' + ico('meta', 18) + '<span>Mis pendientes de hoy</span></div>' +
          '<div class="card-sub">Cada botón te lleva directo a resolverlo</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-body">' + grupos + '</div>' +
    '</div>';
  }

  /* ---------- Clases ---------- */

  /** Clases activas del coach (delegando en el módulo de clases). */
  function clasesDeCoach(coachId) {
    if (!coachId) return [];
    if (AG.Mod && AG.Mod.Clases && typeof AG.Mod.Clases.deCoach === 'function') {
      try {
        var lista = AG.Mod.Clases.deCoach(coachId);
        if (esArreglo(lista)) return lista;
      } catch (e) { /* se usa el respaldo */ }
    }
    return DB.donde('clases', function (c) {
      return c && c.coachId === coachId && c.activa !== false;
    });
  }

  /** Datos derivados de una clase, siempre con números válidos. */
  function claseVista(clase) {
    var inscritos = esArreglo(clase.inscritos) ? clase.inscritos.length : 0;
    var cupo = Math.round(Number(clase.cupo));
    if (!isFinite(cupo) || cupo < 0) cupo = 0;
    var dur = Math.round(Number(clase.duracionMin));
    if (!isFinite(dur) || dur <= 0) dur = 45;
    var min = minutosDe(clase.hora);
    return {
      clase: clase,
      id: clase.id,
      nombre: String(clase.nombre || 'Clase'),
      salon: String(clase.salon || ''),
      color: colorSeguro(clase.color),
      dia: indiceDia(clase.dia),
      hora: horaTexto(clase.hora),
      min: min === null ? 0 : min,
      dur: Math.max(5, Math.min(300, dur)),
      inscritos: inscritos,
      cupo: cupo
    };
  }

  function vistasDeClases(coachId) {
    var crudas = clasesDeCoach(coachId);
    var vistas = [], i;
    for (i = 0; i < crudas.length; i++) {
      if (crudas[i] && crudas[i].id) vistas.push(claseVista(crudas[i]));
    }
    return U.ordenar(vistas, function (v) { return v.dia * 10000 + v.min; }, 'asc');
  }

  function badgeCupo(v) {
    var tipo = 'muted';
    if (v.cupo > 0) {
      var pct = v.inscritos / v.cupo * 100;
      tipo = pct >= 100 ? 'danger' : (pct >= 70 ? 'warn' : 'ok');
    }
    return '<span class="badge badge-' + tipo + '">' +
      esc(v.inscritos + (v.cupo > 0 ? ' / ' + v.cupo : '') + ' inscritos') + '</span>';
  }

  function clasesHoyHTML(coach) {
    var todas = vistasDeClases(coach.id);
    var hoyIdx = indiceDiaDeFecha(U.hoy());
    var hoy = [], i;
    for (i = 0; i < todas.length; i++) if (todas[i].dia === hoyIdx) hoy.push(todas[i]);

    var cuerpo;
    if (!hoy.length) {
      cuerpo = todas.length
        ? vacioHTML('Hoy no tienes clases en tu horario. Revisa tu semana completa en la agenda.', 'calendario',
            '<a class="btn btn-outline btn-sm" href="#/coach/agenda">Ver mi agenda</a>')
        : vacioHTML('Todavía no tienes clases asignadas en el horario del gimnasio.', 'clase');
    } else {
      cuerpo = '<div class="list">';
      for (i = 0; i < hoy.length; i++) {
        var v = hoy[i];
        cuerpo += '<div class="list-item">' +
          '<div class="pill pill-rojo nowrap">' + ico('reloj', 13) + '<b>' + esc(v.hora) + '</b></div>' +
          '<div class="list-item-main">' +
            '<b>' + esc(v.nombre) + '</b>' +
            '<span class="mini muted">' +
              esc((v.salon ? v.salon + ' · ' : '') + v.dur + ' min') + '</span>' +
          '</div>' +
          '<div class="list-item-side wrap">' +
            badgeCupo(v) +
            botonHTML('btn-outline', 'Pasar lista', 'check', 'data-cc-clase="' + esc(v.id) + '"') +
          '</div>' +
        '</div>';
      }
      cuerpo += '</div>';
    }

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<div class="card-title">' + ico('clase', 18) + '<span>Mis clases de hoy</span></div>' +
          '<div class="card-sub">' + esc(DIAS_LARGOS[hoyIdx]) + ' · ' +
            esc(hoy.length + (hoy.length === 1 ? ' clase' : ' clases')) + '</div>' +
        '</div>' +
        '<a class="btn btn-ghost btn-sm" href="#/coach/clases">Horario</a>' +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  /* ---------- Destacados y riesgo ---------- */

  function enlaceSocioHTML(ficha, detalle, ladoHTML) {
    return '<a class="list-item" href="#/coach/socio?id=' + encodeURIComponent(ficha.socio.id) + '">' +
      U.avatar(ficha.socio, 'sm') +
      '<div class="list-item-main">' +
        '<b>' + esc(U.nombreCompleto(ficha.socio)) + '</b>' +
        '<span class="mini muted">' + esc(detalle) + '</span>' +
      '</div>' +
      '<div class="list-item-side">' + ladoHTML + '</div>' +
    '</a>';
  }

  function destacadosHTML(d) {
    var mejores = d.mejores;
    var cuerpoMejores, i, f;

    if (!mejores.lista.length) {
      cuerpoMejores = vacioHTML(
        'Aún no hay cierres de mes para comparar. Registra la medición inicial y el cierre de tus socios.',
        'trofeo',
        '<a class="btn btn-outline btn-sm" href="#/coach/mediciones">Ir a mediciones</a>');
    } else {
      cuerpoMejores = '<div class="list">';
      for (i = 0; i < mejores.lista.length; i++) {
        f = mejores.lista[i];
        if (mejores.base === 'comparativo') {
          cuerpoMejores += enlaceSocioHTML(f,
            C.textoNivel(f.nivel) + ' en ' + U.nombreMes(f.periodoComparativo),
            '<span class="badge ' + esc(C.claseNivel(f.nivel)) + '">' + esc(f.puntaje + '/100') + '</span>');
        } else {
          cuerpoMejores += enlaceSocioHTML(f,
            'Mejor constancia del mes · ' + f.adherencia.hechas + ' de ' + f.adherencia.esperadas + ' sesiones',
            '<span class="badge ' + esc(f.adherencia.clase) + '">' + esc(U.pct(f.adherencia.pct, 0)) + '</span>');
        }
      }
      cuerpoMejores += '</div>';
    }

    var cuerpoRiesgo;
    if (!d.riesgo.length) {
      cuerpoRiesgo = d.activos.length
        ? vacioHTML('Ningún socio en riesgo por ahora. Buen trabajo con el seguimiento.', 'escudo')
        : vacioHTML('Sin socios activos que vigilar todavía.', 'socios');
    } else {
      cuerpoRiesgo = '<div class="list">';
      for (i = 0; i < d.riesgo.length; i++) {
        var r = d.riesgo[i];
        cuerpoRiesgo += enlaceSocioHTML(r.ficha, r.motivos.join(' · '),
          '<span class="badge badge-danger">' + esc('Atención') + '</span>');
      }
      cuerpoRiesgo += '</div>';
    }

    var subtituloMejores = mejores.base === 'comparativo'
      ? 'Mejor puntaje en el comparativo de cierre'
      : 'Ranking por constancia mientras llega el primer cierre';

    return '<div class="grid g2">' +
      '<div class="card">' +
        '<div class="card-head"><div>' +
          '<div class="card-title">' + ico('trofeo', 18) + '<span>Destacados del mes</span></div>' +
          '<div class="card-sub">' + esc(subtituloMejores) + '</div>' +
        '</div></div>' +
        '<div class="card-body">' + cuerpoMejores + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><div>' +
          '<div class="card-title">' + ico('alerta', 18) + '<span>Necesitan atención</span></div>' +
          '<div class="card-sub">Peor adherencia o retroceso en sus números</div>' +
        '</div></div>' +
        '<div class="card-body">' + cuerpoRiesgo + '</div>' +
      '</div>' +
    '</div>';
  }

  function accesosHTML() {
    var accesos = [
      { href: '#/coach/socios', icono: 'socios', texto: 'Mis socios' },
      { href: '#/coach/mediciones', icono: 'regla', texto: 'Mediciones' },
      { href: '#/coach/rutinas', icono: 'mancuerna', texto: 'Rutinas' },
      { href: '#/coach/nutricion', icono: 'manzana', texto: 'Nutrición' }
    ];
    var html = '', i;
    for (i = 0; i < accesos.length; i++) {
      html += '<a class="cc-acceso" href="' + esc(accesos[i].href) + '">' +
        ico(accesos[i].icono, 20) + '<span>' + esc(accesos[i].texto) + '</span>' +
        '</a>';
    }
    return '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + ico('rayo', 18) +
        '<span>Accesos rápidos</span></div></div>' +
      '<div class="card-body"><div class="cc-accesos">' + html + '</div></div>' +
    '</div>';
  }

  function renderInicio(ctx) {
    asegurarEstilos();

    var coach = (ctx && ctx.usuario) || usuarioActual();
    if (!coach) return paginaSinSesion();

    var periodo = U.mesActual();
    var d = tableroDe(coach, periodo);

    var html = '<div class="page" data-cc-inicio>' +
      heroHTML(coach, d) +
      kpisHTML(d) +
      '<div class="grid g2">' +
        pendientesHTML(d) +
        clasesHoyHTML(coach) +
      '</div>' +
      destacadosHTML(d) +
      accesosHTML() +
    '</div>';

    return { html: html, listo: enganchar };
  }

  /* =============================================================
     6. Agenda semanal
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
  function eventosMedicion(d, lunes, domingo) {
    var salida = [];
    var hoy = U.hoy();
    var periodo = d.periodo;

    function agregar(tipo, lista, singular, plural) {
      if (!lista.length) return;
      var ancla = anclaMedicion(periodo, tipo);
      var atrasada = ancla < hoy;
      if (atrasada) ancla = hoy;
      if (!ancla || ancla < lunes || ancla > domingo) return;

      salida.push({
        fecha: ancla,
        orden: 2000,
        tipo: 'medicion',
        titulo: lista.length + ' ' + (lista.length === 1 ? singular : plural),
        detalle: nombresDe(lista) + (atrasada ? ' · fecha sugerida rebasada' : ''),
        href: '#/coach/mediciones'
      });
    }

    agregar('inicial', d.sinInicial, 'medición inicial', 'mediciones iniciales');
    agregar('final', d.sinCierre, 'cierre de mes', 'cierres de mes');
    return salida;
  }

  /** Cumpleaños de los socios del coach dentro de la semana mostrada. */
  function eventosCumple(d, lunes) {
    var salida = [], i, j;
    for (j = 0; j < 7; j++) {
      var fecha = U.sumaDias(lunes, j);
      var pf = U.partesDe(fecha);
      if (!pf) continue;
      for (i = 0; i < d.fichas.length; i++) {
        var socio = d.fichas[i].socio;
        var pn = U.partesDe(socio.fechaNacimiento);
        if (!pn) continue;
        if (pn.m !== pf.m || pn.d !== pf.d) continue;
        var anios = U.edad(socio.fechaNacimiento, fecha);
        salida.push({
          fecha: fecha,
          orden: 0,
          tipo: 'cumple',
          titulo: 'Cumple ' + U.nombreCompleto(socio),
          detalle: anios > 0 ? anios + ' años · felicítalo' : 'Felicítalo hoy',
          href: '#/coach/socio?id=' + encodeURIComponent(socio.id)
        });
      }
    }
    return salida;
  }

  function eventosClase(vistas, lunes) {
    var salida = [], i;
    for (i = 0; i < vistas.length; i++) {
      var v = vistas[i];
      var fecha = U.sumaDias(lunes, v.dia);
      if (!fecha) continue;
      salida.push({
        fecha: fecha,
        orden: 100 + v.min,
        tipo: 'clase',
        titulo: v.hora + ' · ' + v.nombre,
        detalle: (v.salon ? v.salon + ' · ' : '') + v.inscritos +
          (v.cupo > 0 ? '/' + v.cupo : '') + ' inscritos',
        claseId: v.id,
        color: v.color,
        vista: v
      });
    }
    return salida;
  }

  function eventoHTML(ev) {
    if (ev.tipo === 'clase') {
      return '<button type="button" class="cc-ev" data-cc-clase="' + esc(ev.claseId) + '"' +
        ' style="border-left-color:' + esc(ev.color) + '">' +
        '<b>' + esc(ev.titulo) + '</b><span>' + esc(ev.detalle) + '</span></button>';
    }
    var clase = ev.tipo === 'medicion' ? 'cc-ev-medicion' : 'cc-ev-cumple';
    return '<a class="cc-ev ' + clase + '" href="' + esc(ev.href) + '">' +
      '<b>' + esc(ev.titulo) + '</b><span>' + esc(ev.detalle) + '</span></a>';
  }

  function semanaHTML(eventos, lunes) {
    var hoy = U.hoy();
    var html = '<div class="cc-sem">';
    var i, j;

    for (i = 0; i < 7; i++) {
      var fecha = U.sumaDias(lunes, i);
      var p = U.partesDe(fecha);
      var delDia = [];
      for (j = 0; j < eventos.length; j++) if (eventos[j].fecha === fecha) delDia.push(eventos[j]);
      delDia = U.ordenar(delDia, 'orden', 'asc');

      html += '<div class="cc-dia' + (fecha === hoy ? ' hoy' : '') + '">' +
        '<div class="cc-dia-head">' +
          '<span class="cc-dia-nom">' + esc(DIAS_CORTOS[i]) + '</span>' +
          '<span class="cc-dia-num">' + esc(p ? dos(p.d) : '--') + '</span>' +
        '</div>';

      if (!delDia.length) {
        html += '<div class="cc-vacio-dia">Sin actividades</div>';
      } else {
        for (j = 0; j < delDia.length; j++) html += eventoHTML(delDia[j]);
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /** Clave numérica para ordenar los eventos por fecha y hora. */
  function claveCronologica(ev) {
    return U.diasEntre('2000-01-01', ev.fecha) * 10000 + (Number(ev.orden) || 0);
  }

  function listaSemanaHTML(eventos) {
    if (!eventos.length) {
      return vacioHTML('Esta semana no tienes clases, mediciones pendientes ni cumpleaños.', 'calendario');
    }

    var ordenados = U.ordenar(eventos, claveCronologica, 'asc');
    var html = '<div class="list">';
    var i;

    for (i = 0; i < ordenados.length; i++) {
      var ev = ordenados[i];
      var idx = indiceDiaDeFecha(ev.fecha);
      var etiquetaDia = DIAS_LARGOS[idx] + ' ' + U.fecha(ev.fecha, 'diaMes');
      var iconoEv = ev.tipo === 'clase' ? 'clase' : (ev.tipo === 'medicion' ? 'regla' : 'estrella');
      var lado = ev.tipo === 'clase'
        ? badgeCupo(ev.vista)
        : '<span class="badge badge-' + (ev.tipo === 'medicion' ? 'warn' : 'info') + '">' +
            esc(ev.tipo === 'medicion' ? 'Recordatorio' : 'Cumpleaños') + '</span>';

      if (ev.tipo === 'clase') {
        html += '<button type="button" class="list-item clickable" data-cc-clase="' + esc(ev.claseId) + '">' +
          '<div class="list-item-main">' +
            '<b>' + ico(iconoEv, 14) + ' ' + esc(ev.titulo) + '</b>' +
            '<span class="mini muted">' + esc(etiquetaDia + ' · ' + ev.detalle) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' + lado + '</div>' +
        '</button>';
      } else {
        html += '<a class="list-item" href="' + esc(ev.href) + '">' +
          '<div class="list-item-main">' +
            '<b>' + ico(iconoEv, 14) + ' ' + esc(ev.titulo) + '</b>' +
            '<span class="mini muted">' + esc(etiquetaDia + ' · ' + ev.detalle) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' + lado + '</div>' +
        '</a>';
      }
    }
    html += '</div>';
    return html;
  }

  function datoHTML(etiqueta, valor) {
    return '<div class="dato">' +
      '<div class="dato-label">' + esc(etiqueta) + '</div>' +
      '<div class="dato-val">' + esc(valor) + '</div>' +
    '</div>';
  }

  function cargaHTML(d, vistas, cumples) {
    var minutos = 0, i;
    for (i = 0; i < vistas.length; i++) minutos += vistas[i].dur;
    var horas = minutos / 60;

    return '<div class="card">' +
      '<div class="card-head"><div>' +
        '<div class="card-title">' + ico('grafica', 18) + '<span>Resumen de carga</span></div>' +
        '<div class="card-sub">Tu semana tipo según el horario del gimnasio</div>' +
      '</div></div>' +
      '<div class="card-body">' +
        '<div class="datos-grid">' +
          datoHTML('Horas de clase', U.num(horas, 1) + ' h') +
          datoHTML('Clases a la semana', String(vistas.length)) +
          datoHTML('Socios atendidos', d.activos.length + ' de ' + d.asignados) +
          datoHTML('Mediciones por hacer', String(d.pendientes)) +
          datoHTML('Cumpleaños esta semana', String(cumples)) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderAgenda(ctx) {
    asegurarEstilos();

    var coach = (ctx && ctx.usuario) || usuarioActual();
    if (!coach) return paginaSinSesion();

    if (!estado.semana || !U.partesDe(estado.semana)) estado.semana = lunesDe(U.hoy());
    var lunes = estado.semana;
    var domingo = U.sumaDias(lunes, 6) || lunes;

    var periodo = U.mesActual();
    var d = tableroDe(coach, periodo);
    var vistas = vistasDeClases(coach.id);

    var eventos = eventosClase(vistas, lunes)
      .concat(eventosMedicion(d, lunes, domingo))
      .concat(eventosCumple(d, lunes));

    var cumples = 0, i;
    for (i = 0; i < eventos.length; i++) if (eventos[i].tipo === 'cumple') cumples++;

    var esSemanaActual = lunes === lunesDe(U.hoy());
    var etiquetaSemana = U.fecha(lunes, 'diaMes') + ' — ' + U.fecha(domingo, 'corto');

    /* La semana puede caer entre dos meses: se nombran los dos. */
    var etiquetaMes = U.mesDe(lunes) === U.mesDe(domingo)
      ? U.nombreMes(lunes)
      : U.nombreMes(lunes) + ' — ' + U.nombreMes(domingo);

    var html = '<div class="page" data-cc-agenda>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + ico('calendario', 24) + '<span>Mi agenda</span></h1>' +
          '<p class="page-sub">Tus clases, las mediciones que faltan del mes y los cumpleaños de tus socios.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
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
        '<div class="card-head"><div>' +
          '<div class="card-title">' + ico('calendario', 18) + '<span>Semana de lunes a domingo</span></div>' +
          '<div class="card-sub">' + esc(etiquetaMes) + '</div>' +
        '</div></div>' +
        '<div class="card-body"><div class="scroll-x">' + semanaHTML(eventos, lunes) + '</div></div>' +
      '</div>' +

      '<div class="grid g2">' +
        '<div class="card">' +
          '<div class="card-head"><div>' +
            '<div class="card-title">' + ico('historial', 18) + '<span>Esta semana</span></div>' +
            '<div class="card-sub">' + esc(eventos.length + (eventos.length === 1 ? ' actividad' : ' actividades') +
              ' en orden cronológico') + '</div>' +
          '</div></div>' +
          '<div class="card-body">' + listaSemanaHTML(eventos) + '</div>' +
        '</div>' +
        cargaHTML(d, vistas, cumples) +
      '</div>' +
    '</div>';

    return { html: html, listo: enganchar };
  }

  /* =============================================================
     7. Acciones
     ============================================================= */

  function abrirMedicion(socioId, tipo, periodo) {
    if (!AG.Mod || !AG.Mod.Mediciones || typeof AG.Mod.Mediciones.capturar !== 'function') {
      U.toast('El módulo de mediciones no está disponible.', 'error');
      return;
    }
    AG.Mod.Mediciones.capturar(socioId, tipo === 'final' ? 'final' : 'inicial', periodo || U.mesActual());
  }

  function abrirRutina(socioId) {
    if (!AG.Mod || !AG.Mod.Rutinas || typeof AG.Mod.Rutinas.asignar !== 'function') {
      U.toast('El módulo de rutinas no está disponible.', 'error');
      return;
    }
    AG.Mod.Rutinas.asignar(socioId);
  }

  function abrirNutricion(socioId) {
    if (!AG.Mod || !AG.Mod.Nutricion || typeof AG.Mod.Nutricion.editorPlan !== 'function') {
      U.toast('El módulo de nutrición no está disponible.', 'error');
      return;
    }
    AG.Mod.Nutricion.editorPlan(socioId);
  }

  function abrirClase(claseId) {
    if (!AG.Mod || !AG.Mod.Clases || typeof AG.Mod.Clases.abrir !== 'function') {
      U.toast('El módulo de clases no está disponible.', 'error');
      return;
    }
    AG.Mod.Clases.abrir(claseId);
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
    var asistencias = DB.asistenciasDe(socio.id);
    var ultima = asistencias.length ? String(asistencias[0].fecha || '').slice(0, 10) : '';
    var dias = ultima ? U.diasEntre(ultima, U.hoy()) : null;

    var motivo;
    if (dias === null) {
      motivo = 'Todavía no registro tus visitas y quiero acompañarte en tu arranque.';
    } else if (dias >= 1) {
      motivo = 'Llevas ' + dias + (dias === 1 ? ' día' : ' días') + ' sin venir y me gustaría saber cómo vas.';
    } else {
      motivo = 'Quiero saber cómo vas con tu entrenamiento.';
    }

    var mensaje = 'Hola ' + primerNombre(socio) + ', soy ' + U.nombreCompleto(coach) +
      ' de ' + nombreGym() + '. ' + motivo + ' ¿Te agendo tu próxima sesión esta semana?';

    var url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje);
    var ventana = null;
    try { ventana = window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { ventana = null; }
    if (!ventana) U.toast('El navegador bloqueó la ventana de WhatsApp.', 'warn');
  }

  function yaAvisado(clave) {
    var lista = DB.get('notificaciones');
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].clave === clave) return true;
    }
    return false;
  }

  function marcarBotonAvisado(boton) {
    if (!boton) return;
    boton.disabled = true;
    boton.className = 'btn btn-ghost btn-sm';
    boton.innerHTML = ico('check', 15) + ' Avisado';
  }

  function avisarRecepcion(socioId, boton) {
    var socio = socioPropio(socioId);
    if (!socio) return;

    var directores = DB.donde('usuarios', function (u) {
      return u && u.rol === 'director' && u.activo !== false;
    });
    if (!directores.length) {
      U.toast('No hay una cuenta de dirección que pueda recibir el aviso.', 'warn');
      return;
    }

    var clave = 'coach-recepcion:' + socio.id + ':' + U.hoy();
    if (yaAvisado(clave)) {
      U.toast('Recepción ya recibió este aviso hoy.', 'info');
      marcarBotonAvisado(boton);
      return;
    }

    var em = C.estadoMembresia(socio);
    var coach = usuarioActual();
    var cuerpo = U.nombreCompleto(socio) + ' (' + (socio.codigo || 'sin código') + ') tiene la membresía vencida. ' +
      em.texto + '. Lo reporta ' + U.nombreCompleto(coach) + '.';

    for (var i = 0; i < directores.length; i++) {
      DB.notificar(directores[i].id, {
        titulo: 'Renovación pendiente: ' + U.nombreCompleto(socio),
        cuerpo: cuerpo,
        tipo: 'pago',
        link: '#/director/socios',
        clave: clave
      });
    }

    U.toast('Recepción ya tiene el aviso de ' + primerNombre(socio) + '.', 'ok');
    marcarBotonAvisado(boton);
  }

  function moverSemana(paso) {
    if (paso === 0) {
      estado.semana = lunesDe(U.hoy());
    } else {
      estado.semana = U.sumaDias(lunesDe(estado.semana || U.hoy()), paso * 7) || lunesDe(U.hoy());
    }
    AG.Router.refrescar();
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

    U.delegar(raiz, 'click', '[data-cc-clase]', function (e, el) {
      e.preventDefault();
      abrirClase(el.getAttribute('data-cc-clase'));
    });

    U.delegar(raiz, 'click', '[data-cc-wa]', function (e, el) {
      e.preventDefault();
      abrirWhatsApp(el.getAttribute('data-cc-wa'));
    });

    U.delegar(raiz, 'click', '[data-cc-recepcion]', function (e, el) {
      e.preventDefault();
      avisarRecepcion(el.getAttribute('data-cc-recepcion'), el);
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
    clasesDe: vistasDeClases
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
