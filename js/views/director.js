/* =============================================================
   ALLIANCE GYM — AG.Views.Director (rediseño v2)
   -------------------------------------------------------------
   El inicio del dueño. Ruta: 'director/inicio'.

   Principio del rediseño: en 5 segundos se ve cómo va el negocio y
   solo se profundiza si se quiere. Orden de la pantalla:
     1. Saludo humano + fecha (.saludo)
     2. Tarjeta HOY: lo único que hay que atender primero (.hoy)
     3. Cuatro tiles con número grande (.tiles)
     4. "Requiere tu atención": renglones de una línea, máximo 5
     5. Gráfica de ingresos + dona de socios por plan (.grid.g2)
     6. Desplegables cerrados con el resto (.desplegable)

   Todo sale de la base real (AG.DB) y de los módulos ya escritos:
     AG.Mod.Pagos.registrar / .cobranza / .CONCEPTOS
     AG.Mod.Socios.formulario
     AG.Mod.Avisos.formulario
     AG.Mod.Coaches.metricas
     AG.Calc.compararMediciones / .promedioCalificacion / .estadoMembresia
   Las clases grupales ya no existen: la ocupación de sesiones con
   entrenador y los eventos se leen con los helpers de AG.DB
   (sesiones, huecosDe, eventosProximos).

   Reglas: JavaScript clásico, sin módulos, todo escapado con
   AG.Utils.esc(), nada de alert/confirm/prompt, nada de
   localStorage directo y ningún bloque sin su estado vacío.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var DB = AG.DB;
  var Calc = AG.Calc;
  var Charts = AG.Charts;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes del tablero
     ============================================================= */

  var MESES_GRAFICA = 6;        /* meses de la gráfica de ingresos */
  var DIAS_SIN_VENIR = 15;      /* umbral de socio activo ausente */
  var DIAS_EVENTOS = 30;        /* ventana de "eventos próximos" */
  var TOPE_PENDIENTES = 5;      /* renglones visibles en "Requiere tu atención" */
  var TOPE_PAGOS = 5;
  var TOPE_RESENAS = 3;
  var TOPE_ALTAS = 5;
  var TOPE_EVENTOS = 4;
  var TOPE_SESIONES_HOY = 5;
  var TOPE_NOMBRES = 2;         /* nombres que se citan dentro de una frase */

  /* Etiqueta legible de cada concepto de pago (respaldo del módulo). */
  var CONCEPTOS_RESPALDO = {
    mensualidad: 'Mensualidad',
    inscripcion: 'Inscripción',
    clase: 'Visita',
    producto: 'Producto',
    personalizado: 'Otro concepto'
  };

  /* Etiqueta corta del tipo de evento. */
  var TIPOS_EVENTO = {
    reto: 'Reto',
    clinica: 'Clínica',
    competencia: 'Competencia',
    social: 'Convivencia',
    taller: 'Taller'
  };

  /* Desplegables que el dueño dejó abiertos: se respetan al repintar. */
  var abiertos = {};

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function ic(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) {
    try { U.toast(mensaje, tipo || 'info'); } catch (e) { /* sin aviso disponible */ }
  }

  /* Número finito o 0 (nunca NaN). */
  function n0(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }

  function ajustes() {
    try {
      var s = DB.state && DB.state.settings;
      return (s && typeof s === 'object') ? s : {};
    } catch (e) { return {}; }
  }

  function coleccion(nombre) {
    try {
      var lista = DB.get(nombre);
      return lista && lista.length !== undefined ? lista : [];
    } catch (e) { return []; }
  }

  /* '2026-09' desplazado n meses. */
  function moverMes(mes, n) {
    return U.mesDe(U.sumaMeses(mes + '-01', n));
  }

  /* 'sep 26' para los ejes de la gráfica. */
  function etiquetaMesCorta(mes) {
    var p = U.partesDe(mes + '-01');
    if (!p) return String(mes || '');
    return U.MESES_CORTOS[p.m - 1] + ' ' + String(p.a).slice(2);
  }

  /* 'Septiembre' (sin año) para frases cortas. */
  function nombreMesCorto(mes) {
    var p = U.partesDe(mes + '-01');
    if (!p) return '';
    return U.MESES[p.m - 1].toLowerCase();
  }

  function esPagado(p) {
    return !!p && (p.estado || 'pagado') === 'pagado';
  }

  function etiquetaConcepto(id) {
    var lista = null;
    try {
      if (AG.Mod && AG.Mod.Pagos && AG.Mod.Pagos.CONCEPTOS) lista = AG.Mod.Pagos.CONCEPTOS;
    } catch (e) { lista = null; }
    if (lista && lista.length) {
      for (var i = 0; i < lista.length; i++) {
        if (lista[i] && lista[i].id === id) return lista[i].etiqueta;
      }
    }
    return CONCEPTOS_RESPALDO[id] || 'Cobro';
  }

  /* Variación porcentual; null cuando no hay base para comparar. */
  function variacion(actual, anterior) {
    var a = n0(anterior);
    if (a <= 0) return null;
    return ((n0(actual) - a) / a) * 100;
  }

  /* '3 socios' / '1 socio'. */
  function plural(n, singular, plurales) {
    var v = n0(n);
    return U.num(v, 0) + ' ' + (v === 1 ? singular : plurales);
  }

  /* Nombres de los primeros socios de una lista, para dar contexto en una línea. */
  function nombresDe(lista, tope) {
    var t = tope || TOPE_NOMBRES;
    var partes = [];
    for (var i = 0; i < lista.length && i < t; i++) {
      var s = lista[i] && lista[i].socio ? lista[i].socio : lista[i];
      var nombre = (s && s.nombre) ? String(s.nombre).trim() : U.nombreCompleto(s);
      if (nombre) partes.push(nombre);
    }
    var texto = partes.join(', ');
    if (lista.length > t) texto += ' y ' + (lista.length - t) + ' más';
    return texto;
  }

  /* 'Hoy es sábado 6 de septiembre' */
  function fechaSaludo(hoy) {
    var p = U.partesDe(hoy);
    if (!p) return '';
    var dia = new Date(p.a, p.m - 1, p.d).getDay();
    return 'Hoy es ' + U.DIAS_SEMANA[dia].toLowerCase() + ' ' + p.d + ' de ' + U.MESES[p.m - 1].toLowerCase();
  }

  /* Lunes de la semana natural de una fecha (usa el helper de la base si existe). */
  function lunesDe(fecha) {
    if (typeof DB.lunesDe === 'function') {
      try {
        var l = DB.lunesDe(fecha);
        if (l) return l;
      } catch (e) { /* se calcula abajo */ }
    }
    var d = U.aDate(fecha);
    if (!d) return fecha;
    var dow = d.getDay();
    return U.sumaDias(fecha, -(dow === 0 ? 6 : dow - 1));
  }

  /* Solo se aceptan colores #hex para inyectarlos en un style. */
  function colorSeguro(color) {
    var t = (typeof color === 'string') ? color.trim() : '';
    return /^#[0-9a-fA-F]{3,8}$/.test(t) ? t : '';
  }

  /* 'Sáb' de una fecha ISO. */
  function diaCorto(fecha) {
    var p = U.partesDe(fecha);
    if (!p) return '';
    return U.DIAS_SEMANA_CORTOS[new Date(p.a, p.m - 1, p.d).getDay()];
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-director';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Icono grande dentro de la tarjeta HOY */
      '.dir-hoy-ic svg{width:62%;height:auto;color:var(--rojo)}' +
      '.hoy.alerta .dir-hoy-ic svg{color:var(--warn)}' +
      '.hoy.descanso .dir-hoy-ic svg{color:var(--calma)}' +

      /* Renglones de "Requiere tu atención": una línea, un botón */
      '.dir-atencion{display:flex;flex-direction:column;gap:6px;min-width:0}' +
      '.dir-fila{display:flex;align-items:center;gap:10px;min-width:0;padding:8px 10px;' +
        'border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2)}' +
      '.dir-fila-ic{flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;' +
        'border-radius:50%;background:var(--panel);border:1px solid var(--borde);color:var(--texto-2)}' +
      '.dir-fila-ic svg{width:15px;height:15px}' +
      '.dir-fila-txt{flex:1 1 auto;min-width:0;font-size:13.5px;color:var(--texto-2);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.dir-fila-txt b{color:var(--texto);font-weight:800;font-variant-numeric:tabular-nums}' +
      '.dir-fila .btn{flex:0 0 auto}' +
      '.dir-fila.tono-error .dir-fila-ic{color:var(--error);border-color:rgba(239,68,68,.34);background:var(--error-bg)}' +
      '.dir-fila.tono-warn .dir-fila-ic{color:var(--warn);border-color:rgba(245,158,11,.34);background:var(--warn-bg)}' +
      '.dir-fila.tono-info .dir-fila-ic{color:var(--info);border-color:rgba(59,130,246,.34);background:var(--info-bg)}' +
      '.dir-fila.extra{display:none}' +
      '.dir-atencion.todo .dir-fila.extra{display:flex}' +
      '.dir-atencion-pie{margin-top:8px;display:flex;justify-content:center}' +

      /* Marcadores de tres números (progreso, sesiones) */
      '.dir-marcadores{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}' +
      '.dir-marcador{padding:10px;border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);text-align:center;min-width:0}' +
      '.dir-marcador b{display:block;font-size:22px;font-weight:800;line-height:1.1;' +
        'font-variant-numeric:tabular-nums;color:var(--texto)}' +
      '.dir-marcador span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;' +
        'text-transform:uppercase;color:var(--texto-3);margin-top:3px}' +

      /* Fila de coach con avatar dentro de la tabla */
      '.dir-coach{display:flex;align-items:center;gap:9px;min-width:0}' +
      '.dir-coach b{font-weight:700;color:var(--texto);white-space:nowrap;overflow:hidden;' +
        'text-overflow:ellipsis}' +

      /* Reseña compacta */
      '.dir-resena{padding:11px 12px;border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);min-width:0}' +
      '.dir-resena p{margin-top:6px;font-size:12.5px;color:var(--texto-2);line-height:1.5;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +

      /* Subtítulo pequeño dentro de un desplegable */
      '.dir-sub{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;' +
        'color:var(--texto-3);margin:14px 0 8px}' +
      '.dir-sub:first-child{margin-top:0}' +

      /* Acciones rápidas al pie */
      '.dir-rapidas{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:center;padding:4px 0 8px}' +
      '.dir-rapidas .btn{flex:0 1 auto}' +

      /* Las gráficas no llevan texto alrededor */
      '.dir-grafica .card-body{padding-top:10px}' +

      '@media (max-width:700px){' +
        '.dir-marcadores{gap:8px}' +
        '.dir-marcador b{font-size:19px}' +
        '.dir-rapidas .btn{flex:1 1 calc(50% - 8px)}' +
      '}' +
      '@media (max-width:420px){' +
        '.dir-fila{gap:8px;padding:8px}' +
        '.dir-fila-txt{font-size:13px}' +
        '.dir-fila .btn{padding-left:10px;padding-right:10px}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function botonRuta(texto, ruta, clase, iconoNombre) {
    return '<button type="button" class="btn ' + esc(clase || 'btn-outline btn-sm') + '" ' +
      'data-ir="' + esc(ruta) + '">' + (iconoNombre ? ic(iconoNombre, 15) + ' ' : '') +
      esc(texto) + '</button>';
  }

  function botonAccion(texto, accion, clase, iconoNombre) {
    return '<button type="button" class="btn ' + esc(clase || 'btn-outline btn-sm') + '" ' +
      'data-accion="' + esc(accion) + '">' + (iconoNombre ? ic(iconoNombre, 15) + ' ' : '') +
      esc(texto) + '</button>';
  }

  /* Estado vacío amable: una frase, una línea de apoyo y, si acaso, un botón. */
  function vacioAmable(frase, sub, iconoNombre, extra) {
    return '<div class="vacio-amable compacto">' +
      '<div class="vacio-amable-icono">' + ic(iconoNombre || 'info', 26) + '</div>' +
      '<p>' + esc(frase) + '</p>' +
      (sub ? '<span>' + esc(sub) + '</span>' : '') +
      (extra || '') +
    '</div>';
  }

  /* Tarjeta simple con título y, opcionalmente, una acción a la derecha. */
  function tarjeta(titulo, iconoNombre, cuerpo, opciones) {
    var o = opciones || {};
    return '<div class="card' + (o.clase ? ' ' + o.clase : '') + '">' +
      '<div class="card-head">' +
        '<div class="card-title">' + ic(iconoNombre, 18) + '<span>' + esc(titulo) + '</span></div>' +
        (o.accion ? '<div class="card-accion">' + o.accion + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
      (o.pie ? '<div class="card-foot">' + o.pie + '</div>' : '') +
    '</div>';
  }

  /* <details class="desplegable"> cerrado por defecto; recuerda si el dueño lo abrió. */
  function desplegable(id, iconoNombre, titulo, resumen, cuerpo) {
    return '<details class="desplegable" data-desplegable="' + esc(id) + '"' +
      (abiertos[id] ? ' open' : '') + '>' +
      '<summary class="desplegable-cab">' +
        ic(iconoNombre, 18) +
        '<span class="desplegable-titulo">' + esc(titulo) + '</span>' +
        (resumen ? '<span class="desplegable-resumen">' + esc(resumen) + '</span>' : '') +
      '</summary>' +
      '<div class="desplegable-cuerpo">' + cuerpo + '</div>' +
    '</details>';
  }

  function marcador(valor, etiqueta, clase) {
    return '<div class="dir-marcador"><b' + (clase ? ' class="' + esc(clase) + '"' : '') + '>' +
      esc(valor) + '</b><span>' + esc(etiqueta) + '</span></div>';
  }

  /* =============================================================
     4. Consultas de datos (todo desde AG.DB)
     ============================================================= */

  /* Socios que hoy cuentan como activos. */
  function sociosActivos() {
    return DB.donde('usuarios', function (u) {
      return u && u.rol === 'socio' && u.activo !== false && u.estado === 'activo';
    });
  }

  /* Socios que siguen en cartera (todo menos las bajas). */
  function sociosEnCartera() {
    return DB.donde('usuarios', function (u) {
      return u && u.rol === 'socio' && u.activo !== false && u.estado !== 'baja';
    });
  }

  /* Ingreso cobrado por mes ('YYYY-MM' -> monto), en una sola pasada. */
  function ingresosPorMes() {
    var mapa = {};
    var pagos = coleccion('pagos');
    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!esPagado(p)) continue;
      var mes = U.mesDe(p.fecha);
      if (!mes) continue;
      mapa[mes] = n0(mapa[mes]) + n0(p.monto);
    }
    return mapa;
  }

  /* Ingreso del mes anterior contado solo hasta el mismo día del mes. */
  function ingresoHastaElDia(mes, diaCorte) {
    var total = 0;
    var pagos = coleccion('pagos');
    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!esPagado(p) || U.mesDe(p.fecha) !== mes) continue;
      var partes = U.partesDe(p.fecha);
      if (partes && partes.d <= diaCorte) total += n0(p.monto);
    }
    return total;
  }

  /* Serie de ingresos de los últimos meses, del más viejo al más nuevo. */
  function serieIngresos(mapa, mesActual, cuantos) {
    var salida = [];
    for (var i = cuantos - 1; i >= 0; i--) {
      var mes = moverMes(mesActual, -i);
      salida.push({ mes: mes, ingreso: n0(mapa[mes]) });
    }
    return salida;
  }

  /* Cobranza real: se pide al módulo de pagos y, si no está, se calcula igual. */
  function cobranza() {
    try {
      if (AG.Mod && AG.Mod.Pagos && typeof AG.Mod.Pagos.cobranza === 'function') {
        var r = AG.Mod.Pagos.cobranza();
        if (r && r.vencidos && r.porVencer) return r;
      }
    } catch (e) { /* se usa el cálculo propio */ }
    return cobranzaPropia();
  }

  function cobranzaPropia() {
    var hoy = U.hoy();
    var vencidos = [], porVencer = [];
    var socios = DB.socios();

    for (var i = 0; i < socios.length; i++) {
      var s = socios[i];
      if (!s || s.activo === false || s.estado === 'baja' || s.estado === 'congelado') continue;
      var vence = (typeof s.fechaVencimiento === 'string') ? s.fechaVencimiento : '';
      if (!vence) continue;

      var dias = U.diasEntre(hoy, vence);       /* negativo = ya venció */
      var plan = s.planId ? DB.plan(s.planId) : null;
      var fila = {
        socio: s,
        plan: plan,
        monto: plan ? U.aNumero(plan.precio) : 0,
        vence: vence,
        dias: dias
      };
      if (dias < 0) vencidos.push(fila);
      else if (dias <= 7) porVencer.push(fila);
    }

    function porDias(a, b) { return a.dias - b.dias; }
    vencidos.sort(porDias);
    porVencer.sort(porDias);
    return { vencidos: vencidos, porVencer: porVencer };
  }

  /* Fecha de la última asistencia de cada socio, en una sola pasada. */
  function indiceUltimaAsistencia() {
    var mapa = {};
    var lista = coleccion('asistencias');
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!a || !a.socioId) continue;
      var f = U.iso(a.fecha);
      if (!f) continue;
      if (!mapa[a.socioId] || f > mapa[a.socioId]) mapa[a.socioId] = f;
    }
    return mapa;
  }

  /* Socios distintos que registraron entrada hoy. */
  function asistenciasDeHoy(hoy) {
    var vistos = {};
    var total = 0;
    var lista = coleccion('asistencias');
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!a || U.iso(a.fecha) !== hoy) continue;
      if (a.socioId) {
        if (vistos[a.socioId]) continue;
        vistos[a.socioId] = true;
      }
      total++;
    }
    return total;
  }

  /* Reseñas de 1 y 2 estrellas que siguen sin respuesta de dirección. */
  function resenasSinResponder() {
    var lista = DB.donde('calificaciones', function (c) {
      if (!c) return false;
      var e = Math.round(n0(c.estrellas));
      if (e < 1 || e > 2) return false;
      return !(c.respuesta && c.respuesta.texto);
    });
    return U.ordenar(lista, 'fecha', 'desc');
  }

  /* Reparto de socios activos por plan de membresía. */
  function sociosPorPlan(activos) {
    var cuenta = {}, orden = [], i;
    for (i = 0; i < activos.length; i++) {
      var clave = activos[i].planId || 'sin_plan';
      if (cuenta[clave] === undefined) { cuenta[clave] = 0; orden.push(clave); }
      cuenta[clave]++;
    }

    var datos = [];
    for (i = 0; i < orden.length; i++) {
      var id = orden[i];
      var plan = (id === 'sin_plan') ? null : DB.plan(id);
      datos.push({
        etiqueta: plan ? (plan.nombre || 'Plan') : 'Sin plan',
        valor: cuenta[id],
        color: plan && plan.color ? plan.color : null
      });
    }
    return U.ordenar(datos, 'valor', 'desc');
  }

  /* Puntaje del gimnasio en el último mes cerrado, socio por socio. */
  function progresoDelGimnasio(mesCerrado) {
    var socios = sociosEnCartera();
    var puntajes = [];
    var mejoraron = 0, sostuvieron = 0, apoyo = 0;

    for (var i = 0; i < socios.length; i++) {
      var s = socios[i];
      var ini = DB.medicionDelMes(s.id, mesCerrado, 'inicial');
      var fin = DB.medicionDelMes(s.id, mesCerrado, 'final');
      if (!ini || !fin) continue;

      var cmp = null;
      try { cmp = Calc.compararMediciones(ini, fin, s.objetivo); } catch (e) { cmp = null; }
      if (!cmp || !cmp.ok || !cmp.resumen || !cmp.resumen.datosSuficientes) continue;

      var p = n0(cmp.resumen.puntaje);
      puntajes.push(p);
      if (p >= 60) mejoraron++;
      else if (p >= 40) sostuvieron++;
      else apoyo++;
    }

    return {
      mes: mesCerrado,
      evaluados: puntajes.length,
      promedio: puntajes.length
        ? Math.round(U.promedio(puntajes, function (v) { return v; }))
        : 0,
      mejoraron: mejoraron,
      sostuvieron: sostuvieron,
      apoyo: apoyo
    };
  }

  /* Métricas de un coach: las calcula el módulo de coaches, no este archivo. */
  function metricasDeCoach(coach) {
    var m = null;
    try {
      if (AG.Mod && AG.Mod.Coaches && typeof AG.Mod.Coaches.metricas === 'function') {
        m = AG.Mod.Coaches.metricas(coach);
      }
    } catch (e) { m = null; }

    if (m) {
      return {
        coach: coach,
        activos: n0(m.totalActivos),
        totales: n0(m.totalSocios),
        calificacion: m.calificacion || { promedio: 0, total: 0 },
        constancia: (m.adherencia === null || m.adherencia === undefined) ? null : n0(m.adherencia),
        medicionesHechas: n0(m.medicionesHechas),
        medicionesEsperadas: n0(m.medicionesEsperadas)
      };
    }

    /* Respaldo mínimo si el módulo de coaches no estuviera cargado. */
    var socios = DB.sociosDe(coach.id);
    var activos = 0, conMedicion = 0;
    var periodo = U.mesActual();
    for (var i = 0; i < socios.length; i++) {
      if (socios[i].estado !== 'activo') continue;
      activos++;
      if (DB.medicionDelMes(socios[i].id, periodo, 'inicial')) conMedicion++;
    }
    return {
      coach: coach,
      activos: activos,
      totales: socios.length,
      calificacion: Calc.promedioCalificacion(DB.calificacionesDe(coach.id)),
      constancia: null,
      medicionesHechas: conMedicion,
      medicionesEsperadas: activos
    };
  }

  function rendimientoCoaches() {
    var coaches = DB.coaches();
    var filas = [];
    for (var i = 0; i < coaches.length; i++) {
      if (!coaches[i] || coaches[i].activo === false) continue;
      filas.push(metricasDeCoach(coaches[i]));
    }
    /* Se ordena por calificación y, a igualdad, por número de socios activos. */
    return filas.sort(function (a, b) {
      var ca = n0(a.calificacion && a.calificacion.promedio);
      var cb = n0(b.calificacion && b.calificacion.promedio);
      if (cb !== ca) return cb - ca;
      return b.activos - a.activos;
    });
  }

  /* Sesiones con entrenador: hoy, esta semana, huecos libres y pendientes de cerrar. */
  function resumenSesiones(hoy) {
    var lunes = lunesDe(hoy);
    var domingo = U.sumaDias(lunes, 6);
    var sesiones = coleccion('sesiones');
    var deHoy = [], semana = 0, sinCerrar = [];

    for (var i = 0; i < sesiones.length; i++) {
      var s = sesiones[i];
      if (!s) continue;
      var f = U.iso(s.fecha);
      if (!f) continue;
      var cuenta = (s.estado === 'agendada' || s.estado === 'completada');
      if (cuenta && f === hoy) deHoy.push(s);
      if (cuenta && f >= lunes && f <= domingo) semana++;
      if (s.estado === 'agendada' && f < hoy) sinCerrar.push(s);
    }

    deHoy.sort(function (a, b) {
      var ha = String(a.hora || ''), hb = String(b.hora || '');
      return ha < hb ? -1 : (ha > hb ? 1 : 0);
    });

    /* Huecos libres de hoy sumando la disponibilidad de todos los coaches. */
    var libresHoy = 0, coachesConAgenda = 0;
    if (typeof DB.huecosDe === 'function') {
      var coaches = DB.coaches();
      for (var k = 0; k < coaches.length; k++) {
        if (!coaches[k] || coaches[k].activo === false) continue;
        var huecos = [];
        try { huecos = DB.huecosDe(coaches[k].id, hoy) || []; } catch (e) { huecos = []; }
        if (huecos.length) coachesConAgenda++;
        for (var h = 0; h < huecos.length; h++) if (huecos[h] && huecos[h].libre) libresHoy++;
      }
    }

    return {
      hoy: deHoy,
      semana: semana,
      libresHoy: libresHoy,
      coachesConAgenda: coachesConAgenda,
      sinCerrar: sinCerrar
    };
  }

  /* Eventos especiales próximos y los que ya casi no tienen cupo. */
  function resumenEventos(hoy) {
    var lista = [];
    if (typeof DB.eventosProximos === 'function') {
      try { lista = DB.eventosProximos(0) || []; } catch (e) { lista = []; }
    }
    var limite = U.sumaDias(hoy, DIAS_EVENTOS);
    var proximos = [], casiLlenos = [];

    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (!e) continue;
      var f = U.iso(e.fecha);
      var cupo = Math.max(0, n0(e.cupo));
      var inscritos = (e.inscritos && e.inscritos.length) ? e.inscritos.length : 0;
      var lugares = Math.max(0, cupo - inscritos);
      var fila = { evento: e, fecha: f, cupo: cupo, inscritos: inscritos, lugares: lugares };

      if (f && f <= limite) proximos.push(fila);
      if (cupo > 0 && (inscritos >= cupo || lugares <= Math.max(1, Math.round(cupo * 0.1)))) casiLlenos.push(fila);
    }

    return { proximos: proximos, casiLlenos: casiLlenos, total: lista.length };
  }

  /* =============================================================
     5. Cálculo completo del tablero
     ============================================================= */

  function calcularTablero() {
    var conf = ajustes();
    var hoy = U.hoy();
    var mes = U.mesActual();
    var mesAnterior = moverMes(mes, -1);

    var activos = sociosActivos();
    var cartera = sociosEnCartera();

    var altasMes = DB.donde('usuarios', function (u) {
      return u && u.rol === 'socio' && U.mesDe(u.fechaAlta) === mes;
    });

    var ingresos = ingresosPorMes();
    var serie = serieIngresos(ingresos, mes, MESES_GRAFICA);
    var ingresoMes = n0(ingresos[mes]);
    var ingresoAnterior = n0(ingresos[mesAnterior]);
    var meta = Math.max(0, n0(conf.metaIngresoMensual));

    /* El mes en curso se compara contra el mismo tramo del mes anterior. */
    var partesHoy = U.partesDe(hoy);
    var diaHoy = partesHoy ? partesHoy.d : 1;
    var diasDelMes = partesHoy ? U.diasDelMes(partesHoy.a, partesHoy.m) : 30;
    var enCurso = diaHoy < diasDelMes;
    var baseComparacion = enCurso ? ingresoHastaElDia(mesAnterior, diaHoy) : ingresoAnterior;

    var deuda = cobranza();
    var montoVencido = U.suma(deuda.vencidos, 'monto');
    var montoPorVencer = U.suma(deuda.porVencer, 'monto');

    /* --- Mediciones: inicial del mes en curso y cierre del mes pasado --- */
    var sinInicial = [];
    var cierresPendientes = [];
    var i;
    for (i = 0; i < activos.length; i++) {
      var s = activos[i];
      if (!DB.medicionDelMes(s.id, mes, 'inicial')) sinInicial.push(s);
      if (DB.medicionDelMes(s.id, mesAnterior, 'inicial') &&
          !DB.medicionDelMes(s.id, mesAnterior, 'final')) {
        cierresPendientes.push(s);
      }
    }

    /* --- Socios activos sin pisar el gimnasio --- */
    var ultimas = indiceUltimaAsistencia();
    var ausentes = [];
    for (i = 0; i < activos.length; i++) {
      var socio = activos[i];
      var ultima = ultimas[socio.id];
      var dias = ultima ? U.diasEntre(ultima, hoy) : null;
      if (dias === null || dias >= DIAS_SIN_VENIR) {
        ausentes.push({ socio: socio, dias: dias, ultima: ultima || '' });
      }
    }
    ausentes.sort(function (a, b) {
      if (a.dias === null) return -1;
      if (b.dias === null) return 1;
      return b.dias - a.dias;
    });

    /* --- Calificación del gimnasio --- */
    var calificacionGym = Calc.promedioCalificacion(DB.calificacionesDe('gym'));

    /* --- Movimientos recientes --- */
    var pagosRecientes = U.ordenar(DB.donde('pagos', esPagado), 'fecha', 'desc').slice(0, TOPE_PAGOS);
    var resenasRecientes = U.ordenar(coleccion('calificaciones'), 'fecha', 'desc').slice(0, TOPE_RESENAS);
    var altasRecientes = U.ordenar(DB.socios(), 'fechaAlta', 'desc').slice(0, TOPE_ALTAS);

    return {
      conf: conf,
      hoy: hoy,
      mes: mes,
      mesAnterior: mesAnterior,
      activos: activos,
      cartera: cartera,
      altasMes: altasMes,
      serie: serie,
      ingresoMes: ingresoMes,
      ingresoAnterior: ingresoAnterior,
      enCurso: enCurso,
      baseComparacion: baseComparacion,
      variacionIngreso: variacion(ingresoMes, baseComparacion),
      meta: meta,
      pctMeta: meta > 0 ? (ingresoMes / meta) * 100 : null,
      vencidos: deuda.vencidos,
      porVencer: deuda.porVencer,
      montoVencido: montoVencido,
      montoPorVencer: montoPorVencer,
      asistenciasHoy: asistenciasDeHoy(hoy),
      calificacionGym: calificacionGym,
      sinInicial: sinInicial,
      cierresPendientes: cierresPendientes,
      resenasSinResponder: resenasSinResponder(),
      ausentes: ausentes,
      sesiones: resumenSesiones(hoy),
      eventos: resumenEventos(hoy),
      planes: sociosPorPlan(activos),
      progreso: progresoDelGimnasio(mesAnterior),
      coaches: rendimientoCoaches(),
      pagosRecientes: pagosRecientes,
      resenasRecientes: resenasRecientes,
      altasRecientes: altasRecientes
    };
  }

  /* =============================================================
     6. Saludo
     ============================================================= */

  function saludoHTML(usuario, datos) {
    var nombre = (usuario && usuario.nombre) ? String(usuario.nombre).trim() : U.nombreCompleto(usuario);
    return '<div class="saludo">' +
      '<div class="saludo-hola">Hola' +
        (nombre ? ', <span class="saludo-nombre">' + esc(nombre) + '</span>' : '') +
        ' <span class="saludo-emoji">👋</span></div>' +
      '<div class="saludo-fecha">' + esc(fechaSaludo(datos.hoy)) + '</div>' +
    '</div>';
  }

  /* =============================================================
     7. Tarjeta HOY: lo único que hay que atender primero
     ============================================================= */

  /*
     Prioridad: dinero por cobrar > cierres de mes sin capturar >
     reseñas malas sin responder > socios en riesgo de irse.
     Si no hay nada urgente, el mejor número del día.
  */
  function decidirHoy(datos) {
    var n;

    if (datos.vencidos.length) {
      n = datos.vencidos.length;
      return {
        clave: 'vencidos',
        variante: 'alerta',
        eyebrow: 'Dinero por cobrar',
        titulo: datos.montoVencido > 0
          ? U.dinero(datos.montoVencido, 0) + ' por cobrar'
          : plural(n, 'pago vencido', 'pagos vencidos'),
        meta: [plural(n, 'socio con la mensualidad vencida', 'socios con la mensualidad vencida'), nombresDe(datos.vencidos)],
        boton: { texto: 'Ir a cobranza', ruta: 'director/pagos', icono: 'dinero' },
        icono: 'dinero'
      };
    }

    if (datos.cierresPendientes.length) {
      n = datos.cierresPendientes.length;
      return {
        clave: 'cierres',
        variante: '',
        eyebrow: 'Cierre de mes',
        titulo: plural(n, 'cierre de ' + nombreMesCorto(datos.mesAnterior) + ' sin capturar',
          'cierres de ' + nombreMesCorto(datos.mesAnterior) + ' sin capturar'),
        meta: [nombresDe(datos.cierresPendientes), 'Sin cierre no hay comparativo'],
        boton: { texto: 'Capturar cierres', ruta: 'director/mediciones', icono: 'balanza' },
        icono: 'balanza'
      };
    }

    if (datos.resenasSinResponder.length) {
      n = datos.resenasSinResponder.length;
      var ultima = datos.resenasSinResponder[0];
      return {
        clave: 'resenas',
        variante: '',
        eyebrow: 'Reseñas por responder',
        titulo: plural(n, 'reseña baja espera tu respuesta', 'reseñas bajas esperan tu respuesta'),
        meta: ['1 o 2 estrellas', ultima && ultima.fecha ? 'La última, ' + U.fechaRelativa(ultima.fecha) : ''],
        boton: { texto: 'Responder', ruta: 'director/calificaciones', icono: 'chat' },
        icono: 'estrella'
      };
    }

    if (datos.ausentes.length) {
      n = datos.ausentes.length;
      return {
        clave: 'ausentes',
        variante: '',
        eyebrow: 'Socios en riesgo',
        titulo: plural(n, 'socio lleva ' + DIAS_SIN_VENIR + '+ días sin venir',
          'socios llevan ' + DIAS_SIN_VENIR + '+ días sin venir'),
        meta: [nombresDe(datos.ausentes), 'Una llamada los trae de vuelta'],
        boton: { texto: 'Ver asistencia', ruta: 'director/asistencia', icono: 'calendario' },
        icono: 'usuario'
      };
    }

    /* Nada urgente: el mejor número del día. */
    var titulo, metaTxt;
    if (datos.meta > 0 && datos.ingresoMes >= datos.meta) {
      titulo = 'Meta del mes cumplida: ' + U.dinero(datos.ingresoMes, 0);
      metaTxt = ['Meta de ' + U.dinero(datos.meta, 0)];
    } else if (datos.asistenciasHoy > 0) {
      titulo = plural(datos.asistenciasHoy, 'persona ya entrenó hoy', 'personas ya entrenaron hoy');
      metaTxt = [plural(datos.activos.length, 'socio activo', 'socios activos')];
    } else if (datos.altasMes.length > 0) {
      titulo = plural(datos.altasMes.length, 'alta nueva en ' + nombreMesCorto(datos.mes),
        'altas nuevas en ' + nombreMesCorto(datos.mes));
      metaTxt = [plural(datos.activos.length, 'socio activo', 'socios activos')];
    } else if (datos.ingresoMes > 0) {
      titulo = U.dinero(datos.ingresoMes, 0) + ' cobrados en ' + nombreMesCorto(datos.mes);
      metaTxt = datos.meta > 0 ? [U.pct(datos.pctMeta, 0) + ' de la meta'] : [];
    } else {
      titulo = 'Sin pendientes por hoy';
      metaTxt = ['Buen momento para crecer'];
    }
    metaTxt.push('Cobranza y mediciones al día');

    return {
      clave: 'orden',
      variante: 'descanso',
      eyebrow: 'Todo en orden',
      titulo: titulo,
      meta: metaTxt,
      boton: { texto: 'Ver reportes', ruta: 'director/reportes', icono: 'reporte' },
      icono: 'trofeo'
    };
  }

  function hoyHTML(hoy) {
    var meta = '';
    for (var i = 0; i < hoy.meta.length; i++) {
      if (hoy.meta[i]) meta += '<span>' + esc(hoy.meta[i]) + '</span>';
    }
    return '<section class="hoy compacta' + (hoy.variante ? ' ' + esc(hoy.variante) : '') + '">' +
      '<span class="hoy-eyebrow">' + esc(hoy.eyebrow) + '</span>' +
      '<h2 class="hoy-titulo">' + esc(hoy.titulo) + '</h2>' +
      (meta ? '<div class="hoy-meta">' + meta + '</div>' : '') +
      '<div class="hoy-accion">' +
        botonRuta(hoy.boton.texto, hoy.boton.ruta, 'btn-primary', hoy.boton.icono) +
      '</div>' +
      '<div class="hoy-ilustra dir-hoy-ic" aria-hidden="true">' + ic(hoy.icono, 96) + '</div>' +
    '</section>';
  }

  /* =============================================================
     8. Tiles: número grande + etiqueta corta
     ============================================================= */

  function tileHTML(ruta, clase, iconoNombre, valor, etiqueta, extra, extraClase) {
    return '<a class="tile' + (clase ? ' ' + esc(clase) : '') + '" href="#/' + esc(ruta) + '">' +
      '<span class="tile-icono">' + ic(iconoNombre, 18) + '</span>' +
      '<span class="tile-datos">' +
        '<span class="tile-val">' + valor + '</span>' +
        '<span class="tile-label">' + esc(etiqueta) + '</span>' +
        (extra ? '<span class="tile-extra' + (extraClase ? ' ' + esc(extraClase) : '') + '">' + extra + '</span>' : '') +
      '</span>' +
    '</a>';
  }

  function tilesHTML(datos) {
    var html = '<div class="tiles">';

    /* --- Socios activos --- */
    var altas = datos.altasMes.length;
    html += tileHTML('director/socios', '', 'socios',
      esc(U.num(datos.activos.length, 0)),
      'socios activos',
      altas > 0
        ? ic('flecha-arriba', 13) + ' ' + esc('+' + altas + ' este mes')
        : esc('sin altas este mes'),
      altas > 0 ? 'up' : '');

    /* --- Ingresos del mes --- */
    var extraIngreso = '', claseIngreso = '';
    if (datos.meta > 0) {
      var pct = n0(datos.pctMeta);
      extraIngreso = esc(U.pct(Math.min(999, pct), 0) + ' de la meta');
      claseIngreso = pct >= 100 ? 'up' : '';
    } else if (datos.variacionIngreso !== null) {
      var v = datos.variacionIngreso;
      extraIngreso = ic(v >= 0 ? 'flecha-arriba' : 'flecha-abajo', 13) + ' ' +
        esc(U.signo(v, 0, '%') + ' vs mes pasado');
      claseIngreso = v > 0.5 ? 'up' : (v < -0.5 ? 'down' : '');
    }
    html += tileHTML('director/pagos', 'ok', 'dinero',
      esc(U.dinero(datos.ingresoMes, 0)),
      'ingresos de ' + nombreMesCorto(datos.mes),
      extraIngreso, claseIngreso);

    /* --- Asistencias de hoy --- */
    html += tileHTML('director/asistencia', 'info', 'calendario',
      esc(U.num(datos.asistenciasHoy, 0)),
      'asistencias de hoy',
      datos.activos.length
        ? esc(U.pct((datos.asistenciasHoy / datos.activos.length) * 100, 0) + ' de los activos')
        : '');

    /* --- Calificación del gimnasio --- */
    var cal = datos.calificacionGym;
    html += tileHTML('director/calificaciones', 'warn', 'estrella',
      cal.total ? esc(U.num(cal.promedio, 1)) + '<small>/5</small>' : '—',
      'calificación',
      cal.total ? esc(plural(cal.total, 'reseña', 'reseñas')) : esc('sin reseñas aún'));

    return html + '</div>';
  }

  /* =============================================================
     9. "Requiere tu atención": renglones de una línea
     ============================================================= */

  function pendientesDe(datos) {
    var lista = [];
    var n;

    if (datos.vencidos.length) {
      n = datos.vencidos.length;
      lista.push({
        clave: 'vencidos', tono: 'error', icono: 'alerta',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'socio con pago vencido' : 'socios con pago vencido') +
          (datos.montoVencido > 0 ? ' · ' + esc(U.dinero(datos.montoVencido, 0)) : ''),
        boton: 'Cobrar', ruta: 'director/pagos'
      });
    }

    if (datos.cierresPendientes.length) {
      n = datos.cierresPendientes.length;
      lista.push({
        clave: 'cierres', tono: 'warn', icono: 'balanza',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'cierre' : 'cierres') + ' de ' +
          esc(nombreMesCorto(datos.mesAnterior)) + ' sin capturar',
        boton: 'Capturar', ruta: 'director/mediciones'
      });
    }

    if (datos.resenasSinResponder.length) {
      n = datos.resenasSinResponder.length;
      lista.push({
        clave: 'resenas', tono: 'error', icono: 'estrella',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'reseña baja sin responder' : 'reseñas bajas sin responder'),
        boton: 'Responder', ruta: 'director/calificaciones'
      });
    }

    if (datos.ausentes.length) {
      n = datos.ausentes.length;
      lista.push({
        clave: 'ausentes', tono: 'info', icono: 'usuario',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'socio' : 'socios') + ' sin venir en ' + DIAS_SIN_VENIR + '+ días',
        boton: 'Ver', ruta: 'director/asistencia'
      });
    }

    if (datos.porVencer.length) {
      n = datos.porVencer.length;
      lista.push({
        clave: 'porVencer', tono: 'warn', icono: 'reloj',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'membresía vence' : 'membresías vencen') + ' esta semana' +
          (datos.montoPorVencer > 0 ? ' · ' + esc(U.dinero(datos.montoPorVencer, 0)) : ''),
        boton: 'Ver', ruta: 'director/pagos'
      });
    }

    if (datos.sinInicial.length) {
      n = datos.sinInicial.length;
      lista.push({
        clave: 'sinInicial', tono: 'warn', icono: 'regla',
        texto: '<b>' + n + '</b> sin medición inicial de ' + esc(nombreMesCorto(datos.mes)),
        boton: 'Medir', ruta: 'director/mediciones'
      });
    }

    if (datos.sesiones.sinCerrar.length) {
      n = datos.sesiones.sinCerrar.length;
      lista.push({
        clave: 'sesiones', tono: 'info', icono: 'coach',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'sesión pasada sin cerrar' : 'sesiones pasadas sin cerrar'),
        boton: 'Ver', ruta: 'director/sesiones'
      });
    }

    if (datos.eventos.casiLlenos.length) {
      n = datos.eventos.casiLlenos.length;
      lista.push({
        clave: 'eventos', tono: 'info', icono: 'trofeo',
        texto: '<b>' + n + '</b> ' + (n === 1 ? 'evento casi lleno' : 'eventos casi llenos') +
          ' · ' + esc(U.truncar(datos.eventos.casiLlenos[0].evento.nombre || 'Evento', 34)),
        boton: 'Ver', ruta: 'director/eventos'
      });
    }

    return lista;
  }

  function atencionHTML(datos, hoy) {
    var todas = pendientesDe(datos);

    /* Lo que ya está en la tarjeta HOY no se repite aquí. */
    var lista = [];
    for (var i = 0; i < todas.length; i++) {
      if (!hoy || todas[i].clave !== hoy.clave) lista.push(todas[i]);
    }

    if (!lista.length) {
      var frase = (hoy && hoy.clave !== 'orden') ? 'Nada más por ahora' : 'Todo en orden';
      return tarjeta('Requiere tu atención', 'escudo',
        vacioAmable(frase, 'Sin cobros vencidos ni mediciones pendientes.', 'trofeo'));
    }

    var html = '<div class="dir-atencion">';
    for (i = 0; i < lista.length; i++) {
      var p = lista[i];
      html += '<div class="dir-fila tono-' + esc(p.tono) + (i >= TOPE_PENDIENTES ? ' extra' : '') + '">' +
        '<span class="dir-fila-ic">' + ic(p.icono, 15) + '</span>' +
        '<span class="dir-fila-txt">' + p.texto + '</span>' +
        botonRuta(p.boton, p.ruta, 'btn-outline btn-sm') +
      '</div>';
    }
    if (lista.length > TOPE_PENDIENTES) {
      html += '<div class="dir-atencion-pie">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-accion="ver-todo" ' +
          'data-mas="Ver todo (' + lista.length + ')" data-menos="Ver menos">' +
          esc('Ver todo (' + lista.length + ')') + '</button>' +
      '</div>';
    }
    html += '</div>';

    return tarjeta('Requiere tu atención', 'alerta', html, {
      accion: '<span class="badge badge-danger">' + lista.length + '</span>'
    });
  }

  /* =============================================================
     10. Gráficas: ingresos y reparto por plan (sin textos alrededor)
     ============================================================= */

  function graficaIngresosHTML(datos) {
    var puntos = [], i;
    var conDatos = false;

    for (i = 0; i < datos.serie.length; i++) {
      var fila = datos.serie[i];
      if (fila.ingreso > 0) conDatos = true;
      puntos.push({
        x: fila.mes,
        etiqueta: etiquetaMesCorta(fila.mes),
        y: Math.round(fila.ingreso)
      });
    }

    var cuerpo;
    if (!conDatos) {
      cuerpo = vacioAmable('Aún no hay pagos registrados', 'En cuanto cobres el primero verás la tendencia.', 'dinero',
        botonAccion('Registrar pago', 'cobrar', 'btn-primary btn-sm', 'dinero'));
    } else {
      cuerpo = '<div class="grafica">' + Charts.linea(
        [{ nombre: 'Ingresos', color: Charts.color(0), puntos: puntos }],
        {
          alto: 240,
          area: true,
          suave: true,
          leyenda: false,
          desdeCero: true,
          prefijo: datos.conf.simbolo || '$',
          aria: 'Ingresos de los últimos ' + MESES_GRAFICA + ' meses'
        }
      ) + '</div>';
    }

    return tarjeta('Ingresos · ' + MESES_GRAFICA + ' meses', 'grafica', cuerpo, {
      clase: 'dir-grafica',
      accion: botonRuta('Reportes', 'director/reportes', 'btn-ghost btn-sm', 'flecha-der')
    });
  }

  function graficaPlanesHTML(datos) {
    var cuerpo;
    if (!datos.planes.length) {
      cuerpo = vacioAmable('Aún no hay socios activos', 'Da de alta al primero y aquí verás el reparto.', 'tarjeta',
        botonAccion('Nuevo socio', 'nuevo-socio', 'btn-primary btn-sm', 'mas'));
    } else {
      cuerpo = '<div class="grafica">' + Charts.dona(datos.planes, {
        alto: 240,
        centroValor: U.num(datos.activos.length, 0),
        centroTitulo: 'activos',
        aria: 'Reparto de socios activos por plan'
      }) + '</div>';
    }

    return tarjeta('Socios por plan', 'tarjeta', cuerpo, {
      clase: 'dir-grafica',
      accion: botonRuta('Socios', 'director/socios', 'btn-ghost btn-sm', 'flecha-der')
    });
  }

  /* =============================================================
     11. Desplegables: coaches y progreso del gimnasio
     ============================================================= */

  function coachesHTML(datos) {
    var cuerpo, resumen;

    if (!datos.coaches.length) {
      resumen = 'Sin coaches';
      cuerpo = vacioAmable('Todavía no hay coaches', 'Da de alta a tu equipo para ver su rendimiento.', 'coach',
        botonRuta('Ir a coaches', 'director/coaches', 'btn-primary btn-sm', 'coach'));
    } else {
      var promedios = [];
      for (var k = 0; k < datos.coaches.length; k++) {
        var c = datos.coaches[k].calificacion;
        if (c && c.total) promedios.push(n0(c.promedio));
      }
      resumen = plural(datos.coaches.length, 'coach', 'coaches') +
        (promedios.length ? ' · ★ ' + U.num(U.promedio(promedios, function (v) { return v; }), 1) : '');

      cuerpo = '<div class="table-wrap"><table class="table table-compacta">' +
        '<thead><tr>' +
          '<th>Coach</th>' +
          '<th class="num">Socios</th>' +
          '<th>Calificación</th>' +
          '<th class="num">Constancia</th>' +
          '<th class="num">Mediciones</th>' +
        '</tr></thead><tbody>';

      for (var i = 0; i < datos.coaches.length; i++) {
        var f = datos.coaches[i];
        var cal = f.calificacion || { promedio: 0, total: 0 };

        var celdaCal = cal.total
          ? U.estrellas(cal.promedio, { size: 13 }) +
            ' <span class="bold nums">' + esc(U.num(cal.promedio, 1)) + '</span>'
          : '<span class="mini muted">Sin reseñas</span>';

        var celdaCon;
        if (f.constancia === null) {
          celdaCon = '<span class="mini muted">—</span>';
        } else {
          var claseCon = f.constancia >= 80 ? 'txt-ok' : (f.constancia >= 50 ? 'txt-warn' : 'txt-error');
          celdaCon = '<span class="bold ' + claseCon + '">' + esc(U.pct(f.constancia, 0)) + '</span>';
        }

        var esperadas = f.medicionesEsperadas;
        var claseMed = (esperadas > 0 && f.medicionesHechas >= esperadas) ? 'txt-ok'
          : (esperadas > 0 && f.medicionesHechas === 0 ? 'txt-error' : 'txt-warn');
        var celdaMed = esperadas > 0
          ? '<span class="bold ' + claseMed + '">' + esc(f.medicionesHechas + ' / ' + esperadas) + '</span>'
          : '<span class="mini muted">—</span>';

        cuerpo += '<tr class="clickable" data-coach="' + esc(f.coach.id) + '">' +
          '<td><div class="dir-coach">' + U.avatar(f.coach, 'sm') +
            '<b>' + esc(U.nombreCompleto(f.coach)) + '</b></div></td>' +
          '<td class="num">' + esc(f.activos + ' / ' + f.totales) + '</td>' +
          '<td class="nowrap">' + celdaCal + '</td>' +
          '<td class="num">' + celdaCon + '</td>' +
          '<td class="num">' + celdaMed + '</td>' +
        '</tr>';
      }

      cuerpo += '</tbody></table></div>' +
        '<div class="row center mt">' +
          botonRuta('Ver coaches', 'director/coaches', 'btn-ghost btn-sm', 'flecha-der') +
        '</div>';
    }

    return desplegable('coaches', 'coach', 'Rendimiento de coaches', resumen, cuerpo);
  }

  function progresoHTML(datos) {
    var p = datos.progreso;
    var cuerpo, resumen;

    if (!p.evaluados) {
      resumen = 'Sin cierre de ' + nombreMesCorto(p.mes);
      cuerpo = vacioAmable('Aún no hay puntaje de ' + nombreMesCorto(p.mes),
        'Hace falta medición inicial y de cierre para calcularlo.', 'balanza',
        botonRuta('Ir a mediciones', 'director/mediciones', 'btn-primary btn-sm', 'regla'));
    } else {
      resumen = 'Puntaje ' + p.promedio + ' · ' + U.capitalizar(nombreMesCorto(p.mes));
      var nivel = Calc.textoNivel(
        p.promedio >= 80 ? 'excelente' : (p.promedio >= 60 ? 'bueno' : (p.promedio >= 40 ? 'regular' : 'atencion'))
      );

      cuerpo = '<div class="center">' +
        '<div class="anillo anillo-lg">' + Charts.progreso(p.promedio, {
          alto: 160,
          grosor: 14,
          texto: String(p.promedio),
          etiqueta: 'Puntaje',
          aria: 'Puntaje promedio de progreso del gimnasio'
        }) + '</div>' +
      '</div>' +
      '<p class="mini muted txt-centro mt-sm">' +
        esc(nivel + ' · ' + plural(p.evaluados, 'socio evaluado', 'socios evaluados') + ' en ' + nombreMesCorto(p.mes)) +
      '</p>' +
      '<div class="dir-marcadores mt">' +
        marcador(String(p.mejoraron), 'Mejoraron', 'txt-ok') +
        marcador(String(p.sostuvieron), 'Se mantuvieron', 'txt-warn') +
        marcador(String(p.apoyo), 'Necesitan apoyo', 'txt-error') +
      '</div>' +
      '<div class="row center mt">' +
        botonRuta('Ver mediciones', 'director/mediciones', 'btn-ghost btn-sm', 'flecha-der') +
      '</div>';
    }

    return desplegable('progreso', 'trofeo', 'Progreso del gimnasio', resumen, cuerpo);
  }

  /* =============================================================
     12. Desplegables: pagos, reseñas y altas
     ============================================================= */

  function pagosHTML(datos) {
    var cuerpo, resumen;

    if (!datos.pagosRecientes.length) {
      resumen = 'Sin pagos';
      cuerpo = vacioAmable('Todavía no hay pagos', 'Registra el primero desde aquí.', 'dinero',
        botonAccion('Registrar pago', 'cobrar', 'btn-primary btn-sm', 'dinero'));
    } else {
      var ultimo = datos.pagosRecientes[0];
      resumen = U.dinero(ultimo.monto, 0) + ' · ' + U.fechaRelativa(ultimo.fecha);

      cuerpo = '<div class="list list-plana">';
      for (var i = 0; i < datos.pagosRecientes.length; i++) {
        var pago = datos.pagosRecientes[i];
        var socio = pago.socioId ? DB.usuario(pago.socioId) : null;
        cuerpo += '<div class="list-item">' +
          (socio ? U.avatar(socio, 'sm') : '<span class="dir-fila-ic">' + ic('dinero', 15) + '</span>') +
          '<div class="list-item-main">' +
            '<b>' + esc(socio ? U.nombreCompleto(socio) : 'Socio dado de baja') + '</b>' +
            '<span>' + esc(etiquetaConcepto(pago.concepto) + ' · ' + U.fechaRelativa(pago.fecha)) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' +
            '<span class="bold nums">' + esc(U.dinero(pago.monto, 0)) + '</span>' +
          '</div>' +
        '</div>';
      }
      cuerpo += '</div>' +
        '<div class="row center wrap mt">' +
          botonAccion('Registrar pago', 'cobrar', 'btn-outline btn-sm', 'dinero') +
          botonRuta('Ver todos', 'director/pagos', 'btn-ghost btn-sm', 'flecha-der') +
        '</div>';
    }

    return desplegable('pagos', 'tarjeta', 'Últimos pagos', resumen, cuerpo);
  }

  function resenasHTML(datos) {
    var cuerpo, resumen;
    var cal = datos.calificacionGym;

    if (!datos.resenasRecientes.length) {
      resumen = 'Sin reseñas';
      cuerpo = vacioAmable('Aún no hay reseñas', 'Cuando los socios califiquen, aparecerán aquí.', 'estrella');
    } else {
      resumen = (cal.total ? '★ ' + U.num(cal.promedio, 1) + ' · ' : '') +
        plural(coleccion('calificaciones').length, 'reseña', 'reseñas');

      cuerpo = '<div class="stack-sm">';
      for (var i = 0; i < datos.resenasRecientes.length; i++) {
        var c = datos.resenasRecientes[i];
        var socio = c.socioId ? DB.usuario(c.socioId) : null;
        var destino;
        if (c.tipo === 'coach') {
          var coach = c.objetivoId ? DB.usuario(c.objetivoId) : null;
          destino = coach ? 'Coach ' + (coach.nombre || U.nombreCompleto(coach)) : 'Coach';
        } else {
          destino = 'Gimnasio';
        }

        cuerpo += '<div class="dir-resena">' +
          '<div class="between wrap">' +
            '<div class="persona">' +
              (socio ? U.avatar(socio, 'sm') : '') +
              '<div class="persona-txt">' +
                '<b>' + esc(socio ? U.nombreCompleto(socio) : 'Socio dado de baja') + '</b>' +
                '<span>' + esc(destino + ' · ' + U.fechaRelativa(c.fecha)) + '</span>' +
              '</div>' +
            '</div>' +
            U.estrellas(c.estrellas, { size: 14 }) +
          '</div>' +
          (c.comentario
            ? '<p>' + esc(U.truncar(c.comentario, 120)) + '</p>'
            : '<p class="muted">Calificó sin comentario.</p>') +
          (c.respuesta && c.respuesta.texto
            ? '<span class="badge badge-ok mt-sm">Respondida</span>'
            : (Math.round(n0(c.estrellas)) <= 3
                ? '<span class="badge badge-warn mt-sm">Sin responder</span>'
                : '')) +
        '</div>';
      }
      cuerpo += '</div>' +
        '<div class="row center mt">' +
          botonRuta('Ver calificaciones', 'director/calificaciones', 'btn-ghost btn-sm', 'flecha-der') +
        '</div>';
    }

    return desplegable('resenas', 'estrella', 'Últimas reseñas', resumen, cuerpo);
  }

  function altasHTML(datos) {
    var cuerpo, resumen;

    if (!datos.altasRecientes.length) {
      resumen = 'Sin socios';
      cuerpo = vacioAmable('Todavía no hay socios', 'Da de alta al primero desde aquí.', 'socios',
        botonAccion('Nuevo socio', 'nuevo-socio', 'btn-primary btn-sm', 'mas'));
    } else {
      resumen = plural(datos.altasMes.length, 'alta este mes', 'altas este mes');

      cuerpo = '<div class="list list-plana">';
      for (var i = 0; i < datos.altasRecientes.length; i++) {
        var s = datos.altasRecientes[i];
        var plan = s.planId ? DB.plan(s.planId) : null;
        var membresia = Calc.estadoMembresia(s);
        var estadoTxt = membresia.estado === 'activo' ? 'Activo'
          : (membresia.estado === 'por_vencer' ? 'Por vencer'
          : (membresia.estado === 'vencido' ? 'Vencido'
          : (membresia.estado === 'congelado' ? 'Congelado' : 'Baja')));

        cuerpo += '<div class="list-item clickable" data-socio="' + esc(s.id) + '">' +
          U.avatar(s, 'sm') +
          '<div class="list-item-main">' +
            '<b>' + esc(U.nombreCompleto(s)) + '</b>' +
            '<span>' + esc((plan ? plan.nombre : 'Sin plan') + ' · alta ' + U.fechaRelativa(s.fechaAlta)) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' +
            '<span class="badge ' + esc(membresia.clase) + '">' + esc(estadoTxt) + '</span>' +
          '</div>' +
        '</div>';
      }
      cuerpo += '</div>' +
        '<div class="row center wrap mt">' +
          botonAccion('Nuevo socio', 'nuevo-socio', 'btn-outline btn-sm', 'mas') +
          botonRuta('Ver socios', 'director/socios', 'btn-ghost btn-sm', 'flecha-der') +
        '</div>';
    }

    return desplegable('altas', 'socios', 'Altas recientes', resumen, cuerpo);
  }

  /* =============================================================
     13. Desplegable: sesiones con entrenador y eventos
     ============================================================= */

  function sesionHoyHTML(s) {
    var socio = s.socioId ? DB.usuario(s.socioId) : null;
    var coach = s.coachId ? DB.usuario(s.coachId) : null;
    var tipo = s.tipo === 'valoracion' ? 'Valoración' : (s.tipo === 'seguimiento' ? 'Seguimiento' : 'Entrenamiento');
    var estado = s.estado === 'completada'
      ? '<span class="badge badge-ok">Hecha</span>'
      : '<span class="badge badge-info">Agendada</span>';

    return '<div class="list-item">' +
      (socio ? U.avatar(socio, 'sm') : '<span class="dir-fila-ic">' + ic('usuario', 15) + '</span>') +
      '<div class="list-item-main">' +
        '<b>' + esc(U.fecha(s.hora || '', 'hora') || '--:--') + ' · ' +
          esc(socio ? U.nombreCompleto(socio) : 'Socio dado de baja') + '</b>' +
        '<span>' + esc(tipo + (coach ? ' con ' + (coach.nombre || U.nombreCompleto(coach)) : '')) + '</span>' +
      '</div>' +
      '<div class="list-item-side">' + estado + '</div>' +
    '</div>';
  }

  function eventoFilaHTML(fila) {
    var e = fila.evento;
    var p = U.partesDe(fila.fecha);
    var color = colorSeguro(e.color);
    var pct = fila.cupo > 0 ? Math.min(100, Math.round((fila.inscritos / fila.cupo) * 100)) : 0;
    var claseCupo = fila.cupo > 0 && fila.inscritos >= fila.cupo ? ' lleno'
      : (fila.cupo > 0 && fila.lugares <= Math.max(1, Math.round(fila.cupo * 0.1)) ? ' casi-lleno' : '');

    var meta = '<span>' + esc(U.fecha(e.hora || '', 'hora') || '') + '</span>';
    if (TIPOS_EVENTO[e.tipo]) meta += '<span>' + esc(TIPOS_EVENTO[e.tipo]) + '</span>';
    if (fila.cupo > 0) {
      meta += '<span>' + esc(fila.inscritos + ' de ' + fila.cupo) + '</span>';
    } else {
      meta += '<span>' + esc(plural(fila.inscritos, 'inscrito', 'inscritos')) + '</span>';
    }

    return '<article class="evento evento-fila"' + (color ? ' style="--evento-color:' + esc(color) + '"' : '') + '>' +
      '<div class="evento-fecha">' +
        '<span>' + esc(p ? U.MESES_CORTOS[p.m - 1] : '') + '</span>' +
        '<b>' + esc(p ? String(p.d) : '') + '</b>' +
        '<small>' + esc(diaCorto(fila.fecha)) + '</small>' +
      '</div>' +
      '<div class="evento-info">' +
        '<b>' + esc(U.truncar(e.nombre || 'Evento', 60)) + '</b>' +
        '<div class="evento-meta">' + meta + '</div>' +
        (fila.cupo > 0
          ? '<div class="evento-cupo' + claseCupo + '">' +
              '<div class="evento-cupo-barra"><i class="evento-cupo-fill" style="width:' + pct + '%"></i></div>' +
            '</div>'
          : '') +
      '</div>' +
      '<div class="evento-acciones">' +
        botonRuta('Ver', 'director/eventos', 'btn-ghost btn-sm') +
      '</div>' +
    '</article>';
  }

  function sesionesEventosHTML(datos) {
    var ses = datos.sesiones;
    var ev = datos.eventos;
    var resumen = plural(ses.hoy.length, 'sesión hoy', 'sesiones hoy') + ' · ' +
      plural(ev.proximos.length, 'evento próximo', 'eventos próximos');

    var cuerpo = '<div class="dir-marcadores">' +
      marcador(String(ses.hoy.length), 'Sesiones hoy') +
      marcador(String(ses.libresHoy), 'Huecos libres hoy', ses.libresHoy > 0 ? 'txt-ok' : '') +
      marcador(String(ses.semana), 'Esta semana') +
    '</div>';

    /* Sesiones de hoy */
    cuerpo += '<div class="dir-sub">Hoy con entrenador</div>';
    if (!ses.hoy.length) {
      cuerpo += vacioAmable('Hoy no hay sesiones agendadas',
        ses.coachesConAgenda
          ? plural(ses.coachesConAgenda, 'coach tiene', 'coaches tienen') + ' huecos abiertos hoy.'
          : 'Ningún coach tiene disponibilidad hoy.',
        'coach');
    } else {
      cuerpo += '<div class="list list-plana">';
      for (var i = 0; i < ses.hoy.length && i < TOPE_SESIONES_HOY; i++) cuerpo += sesionHoyHTML(ses.hoy[i]);
      cuerpo += '</div>';
      if (ses.hoy.length > TOPE_SESIONES_HOY) {
        cuerpo += '<p class="mini muted txt-centro mt-sm">' +
          esc('y ' + (ses.hoy.length - TOPE_SESIONES_HOY) + ' más') + '</p>';
      }
    }

    /* Eventos próximos */
    cuerpo += '<div class="dir-sub">Eventos próximos</div>';
    if (!ev.proximos.length) {
      cuerpo += vacioAmable('No hay eventos en los próximos ' + DIAS_EVENTOS + ' días',
        'Un reto o una clínica anima al gimnasio.', 'trofeo',
        botonRuta('Crear evento', 'director/eventos', 'btn-primary btn-sm', 'mas'));
    } else {
      cuerpo += '<div class="stack-sm">';
      for (var k = 0; k < ev.proximos.length && k < TOPE_EVENTOS; k++) cuerpo += eventoFilaHTML(ev.proximos[k]);
      cuerpo += '</div>';
      if (ev.proximos.length > TOPE_EVENTOS) {
        cuerpo += '<p class="mini muted txt-centro mt-sm">' +
          esc('y ' + (ev.proximos.length - TOPE_EVENTOS) + ' más') + '</p>';
      }
    }

    cuerpo += '<div class="row center wrap mt">' +
      botonRuta('Ver sesiones', 'director/sesiones', 'btn-ghost btn-sm', 'coach') +
      botonRuta('Ver eventos', 'director/eventos', 'btn-ghost btn-sm', 'trofeo') +
    '</div>';

    return desplegable('sesiones', 'calendario', 'Sesiones y eventos', resumen, cuerpo);
  }

  /* =============================================================
     14. Acciones rápidas
     ============================================================= */

  function rapidasHTML() {
    return '<div class="dir-rapidas">' +
      botonAccion('Registrar pago', 'cobrar', 'btn-outline btn-sm', 'dinero') +
      botonAccion('Nuevo socio', 'nuevo-socio', 'btn-outline btn-sm', 'mas') +
      botonAccion('Nuevo aviso', 'nuevo-aviso', 'btn-outline btn-sm', 'campana') +
    '</div>';
  }

  function abrirCobro() {
    if (AG.Mod && AG.Mod.Pagos && typeof AG.Mod.Pagos.registrar === 'function') {
      AG.Mod.Pagos.registrar();
      return;
    }
    toast('El módulo de pagos no está disponible.', 'error');
  }

  function abrirNuevoSocio() {
    if (AG.Mod && AG.Mod.Socios && typeof AG.Mod.Socios.formulario === 'function') {
      AG.Mod.Socios.formulario(null);
      return;
    }
    toast('El módulo de socios no está disponible.', 'error');
  }

  function abrirNuevoAviso() {
    if (AG.Mod && AG.Mod.Avisos && typeof AG.Mod.Avisos.formulario === 'function') {
      AG.Mod.Avisos.formulario(null);
      return;
    }
    toast('El módulo de avisos no está disponible.', 'error');
  }

  function alternarVerTodo(boton) {
    var caja = boton.closest ? boton.closest('.dir-atencion') : null;
    if (!caja) return;
    var abierto = caja.classList.toggle('todo');
    boton.textContent = abierto
      ? (boton.getAttribute('data-menos') || 'Ver menos')
      : (boton.getAttribute('data-mas') || 'Ver todo');
  }

  /* =============================================================
     15. Render de la ruta 'director/inicio'
     ============================================================= */

  function render(ctx) {
    asegurarEstilos();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario : null;

    /* Control de acceso propio: este tablero es solo para dirección. */
    if (!usuario || usuario.rol !== 'director') {
      return '<div class="page">' +
        vacioAmable('Este panel es solo para dirección', 'Entra con la cuenta del gimnasio para verlo.', 'candado') +
      '</div>';
    }

    var datos;
    try {
      datos = calcularTablero();
    } catch (e) {
      return '<div class="page">' +
        vacioAmable('No pudimos preparar el panel', 'Revisa la base de datos en Configuración.', 'alerta',
          botonRuta('Ir a configuración', 'director/config', 'btn-primary btn-sm', 'config')) +
      '</div>';
    }

    var hoy = decidirHoy(datos);

    var html = '<div class="page">' +
      saludoHTML(usuario, datos) +
      hoyHTML(hoy) +
      tilesHTML(datos) +
      atencionHTML(datos, hoy) +
      '<div class="grid g2">' +
        graficaIngresosHTML(datos) +
        graficaPlanesHTML(datos) +
      '</div>' +
      '<div class="desplegables">' +
        coachesHTML(datos) +
        progresoHTML(datos) +
        pagosHTML(datos) +
        resenasHTML(datos) +
        altasHTML(datos) +
        sesionesEventosHTML(datos) +
      '</div>' +
      rapidasHTML() +
    '</div>';

    return {
      html: html,
      listo: function (root) {
        /* --- Botones de acción (cobrar, nuevo socio, nuevo aviso, ver todo) --- */
        U.delegar(root, 'click', '[data-accion]', function (e, el) {
          var accion = el.getAttribute('data-accion');
          if (accion === 'cobrar') abrirCobro();
          else if (accion === 'nuevo-socio') abrirNuevoSocio();
          else if (accion === 'nuevo-aviso') abrirNuevoAviso();
          else if (accion === 'ver-todo') alternarVerTodo(el);
        });

        /* --- Cualquier enlace a otra pantalla del sistema --- */
        U.delegar(root, 'click', '[data-ir]', function (e, el) {
          var ruta = el.getAttribute('data-ir');
          if (ruta) AG.Router.ir(ruta);
        });

        /* --- Fila de coach: abre su ficha --- */
        U.delegar(root, 'click', '[data-coach]', function (e, el) {
          var id = el.getAttribute('data-coach');
          if (id) AG.Router.ir({ path: 'director/coach', params: { id: id } });
        });

        /* --- Alta reciente: abre el expediente del socio --- */
        U.delegar(root, 'click', '[data-socio]', function (e, el) {
          var id = el.getAttribute('data-socio');
          if (id) AG.Router.ir({ path: 'director/socio', params: { id: id } });
        });

        /* --- Los desplegables recuerdan si quedaron abiertos al repintar --- */
        var detalles = U.$$('details.desplegable[data-desplegable]', root);
        for (var i = 0; i < detalles.length; i++) {
          (function (d) {
            d.addEventListener('toggle', function () {
              abiertos[d.getAttribute('data-desplegable')] = !!d.open;
            });
          })(detalles[i]);
        }
      }
    };
  }

  /* =============================================================
     16. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.Director = {
    render: render,
    calcular: calcularTablero,
    pendientes: pendientesDe,
    hoy: decidirHoy
  };

  AG.Router.registrar({
    path: 'director/inicio',
    roles: ['director'],
    titulo: 'Inicio',
    nav: { etiqueta: 'Inicio', icono: 'inicio', grupo: 'Principal', orden: 1 },
    render: render
  });
})(window.AG);
