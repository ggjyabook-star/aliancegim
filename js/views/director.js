/* =============================================================
   ALLIANCE GYM — AG.Views.Director
   -------------------------------------------------------------
   El tablero del dueño. Ruta: 'director/inicio'.

   Todo sale de la base real (AG.DB) y de los módulos ya escritos:
     AG.Mod.Pagos.registrar / .cobranza / .CONCEPTOS
     AG.Mod.Socios.formulario
     AG.Mod.Avisos.formulario / .tarjetas
     AG.Mod.Coaches.metricas
     AG.Calc.compararMediciones / .promedioCalificacion / .estadoMembresia
   Aquí NO se reimplementa nada de eso: solo se resume y se enlaza.

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
  var TOPE_PAGOS = 5;
  var TOPE_RESENAS = 3;
  var TOPE_ALTAS = 5;
  var TOPE_AVISOS = 3;
  var TOPE_DETALLE = 4;         /* nombres que se listan dentro de un pendiente */

  /* Etiqueta legible de cada concepto de pago (respaldo del módulo). */
  var CONCEPTOS_RESPALDO = {
    mensualidad: 'Mensualidad',
    inscripcion: 'Inscripción',
    clase: 'Clase o visita',
    producto: 'Producto',
    personalizado: 'Otro concepto'
  };

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

  /* Saludo según la hora local. */
  function saludoDelDia() {
    var h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /* Variación porcentual; null cuando no hay base para comparar. */
  function variacion(actual, anterior) {
    var a = n0(anterior);
    if (a <= 0) return null;
    return ((n0(actual) - a) / a) * 100;
  }

  /* Nombres de los primeros socios de una lista, para dar contexto. */
  function nombresDe(lista, tope) {
    var t = tope || TOPE_DETALLE;
    var partes = [];
    for (var i = 0; i < lista.length && i < t; i++) {
      var s = lista[i] && lista[i].socio ? lista[i].socio : lista[i];
      partes.push(U.nombreCompleto(s));
    }
    var texto = partes.join(', ');
    if (lista.length > t) texto += ' y ' + (lista.length - t) + ' más';
    return texto;
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
      /* Anillo pequeño dentro de un KPI, en el lugar del icono */
      '.dir-anillo-kpi{flex:0 0 auto;width:58px;display:block}' +
      '.dir-anillo-kpi svg{width:100%;height:auto;display:block}' +

      /* Estos KPIs llevan etiquetas largas: se dejan envolver en vez de cortarse */
      '.dir-kpis .kpi-label{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35}' +
      '.dir-kpis .kpi-trend{flex-wrap:wrap;line-height:1.35}' +

      /* Lista de pendientes */
      '.dir-pendientes{display:flex;flex-direction:column;gap:10px}' +
      '.dir-item{display:flex;align-items:center;gap:12px;min-width:0;padding:11px 13px;' +
        'border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2)}' +
      '.dir-item-ic{flex:0 0 auto;width:38px;height:38px;display:grid;place-items:center;' +
        'border-radius:50%;background:var(--panel);border:1px solid var(--borde);color:var(--texto-2)}' +
      '.dir-item-txt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}' +
      '.dir-item-txt b{font-size:13.5px;font-weight:700;color:var(--texto)}' +
      '.dir-item-txt span{font-size:12px;color:var(--texto-2);overflow:hidden;text-overflow:ellipsis;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
      '.dir-item .btn{flex:0 0 auto}' +
      '.dir-item.tono-error{border-color:rgba(239,68,68,.34);background:var(--error-bg)}' +
      '.dir-item.tono-error .dir-item-ic{color:var(--error);border-color:rgba(239,68,68,.34)}' +
      '.dir-item.tono-warn{border-color:rgba(245,158,11,.34);background:var(--warn-bg)}' +
      '.dir-item.tono-warn .dir-item-ic{color:var(--warn);border-color:rgba(245,158,11,.34)}' +
      '.dir-item.tono-info{border-color:rgba(59,130,246,.34);background:var(--info-bg)}' +
      '.dir-item.tono-info .dir-item-ic{color:var(--info);border-color:rgba(59,130,246,.34)}' +

      /* Marcadores del progreso del gimnasio */
      '.dir-marcadores{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px}' +
      '.dir-marcador{padding:10px;border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);text-align:center;min-width:0}' +
      '.dir-marcador b{display:block;font-size:20px;font-weight:800;line-height:1.1;' +
        'font-variant-numeric:tabular-nums}' +
      '.dir-marcador span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.09em;' +
        'text-transform:uppercase;color:var(--texto-3);margin-top:3px}' +

      /* Fila de coach con avatar dentro de la tabla */
      '.dir-coach{display:flex;align-items:center;gap:9px;min-width:0}' +
      '.dir-coach b{font-weight:700;color:var(--texto);white-space:nowrap;overflow:hidden;' +
        'text-overflow:ellipsis}' +

      /* Reseña compacta */
      '.dir-resena{padding:11px 12px;border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);min-width:0}' +
      '.dir-resena p{margin-top:6px;font-size:12.5px;color:var(--texto-2);line-height:1.5;' +
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +

      /* En tabletas las filas mixtas (gráfica ancha + tarjeta) van una debajo de otra */
      '@media (max-width:980px){.grid.dir-fila>.card{grid-column:1 / -1}}' +

      '@media (max-width:560px){' +
        '.dir-item{flex-wrap:wrap}' +
        '.dir-item .btn{width:100%}' +
        '.dir-marcadores{grid-template-columns:1fr}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function kpiHTML(iconoHTML, valor, etiqueta, extra, variante) {
    return '<div class="kpi' + (variante ? ' kpi-' + variante : '') + '">' +
      iconoHTML +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        (extra || '') +
      '</div>' +
    '</div>';
  }

  function iconoKPI(nombre) {
    return '<div class="kpi-icono">' + ic(nombre, 22) + '</div>';
  }

  function trendHTML(pct, sufijo, textoVacio) {
    if (pct === null || pct === undefined || !isFinite(pct)) {
      return '<div class="kpi-trend plana">' + ic('flecha-der', 14) + ' ' +
        esc(textoVacio || 'Sin comparativo') + '</div>';
    }
    var clase = pct > 0.5 ? 'up' : (pct < -0.5 ? 'down' : 'plana');
    var nombre = pct > 0.5 ? 'flecha-arriba' : (pct < -0.5 ? 'flecha-abajo' : 'flecha-der');
    return '<div class="kpi-trend ' + clase + '">' + ic(nombre, 14) + ' ' +
      esc(U.signo(pct, 1, '%') + (sufijo ? ' ' + sufijo : '')) + '</div>';
  }

  function notaHTML(texto) {
    return '<div class="kpi-trend plana">' + esc(texto) + '</div>';
  }

  function tarjeta(titulo, iconoNombre, cuerpo, opciones) {
    var o = opciones || {};
    return '<div class="card' + (o.clase ? ' ' + o.clase : '') + '">' +
      '<div class="card-head">' +
        '<div>' +
          '<div class="card-title">' + ic(iconoNombre, 18) + '<span>' + esc(titulo) + '</span></div>' +
          (o.sub ? '<p class="card-sub">' + esc(o.sub) + '</p>' : '') +
        '</div>' +
        (o.accion ? '<div class="card-accion">' + o.accion + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
      (o.pie ? '<div class="card-foot">' + o.pie + '</div>' : '') +
    '</div>';
  }

  function botonRuta(texto, ruta, clase, iconoNombre) {
    return '<button type="button" class="btn ' + esc(clase || 'btn-outline btn-sm') + '" ' +
      'data-ir="' + esc(ruta) + '">' + (iconoNombre ? ic(iconoNombre, 15) + ' ' : '') +
      esc(texto) + '</button>';
  }

  function vacio(mensaje, iconoNombre, extra) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ic(iconoNombre || 'info', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (extra || '') +
    '</div>';
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

  /*
     Ingreso del mes anterior contado solo hasta el mismo día del mes.
     Comparar 5 días contra 31 no dice nada: siempre parecería un desplome.
  */
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
  function asistenciasDeHoy() {
    var hoy = U.hoy();
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

  /* Clases activas con el cupo agotado. */
  function clasesLlenas() {
    return DB.donde('clases', function (c) {
      if (!c || c.activa === false) return false;
      var cupo = n0(c.cupo);
      var inscritos = (c.inscritos && c.inscritos.length) ? c.inscritos.length : 0;
      return cupo > 0 && inscritos >= cupo;
    });
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
        etiqueta: plan ? (plan.nombre || 'Plan') : 'Sin plan asignado',
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
    var mejoraron = 0, sostuvieron = 0, retrocedieron = 0;

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
      else retrocedieron++;
    }

    return {
      mes: mesCerrado,
      evaluados: puntajes.length,
      promedio: puntajes.length
        ? Math.round(U.promedio(puntajes, function (v) { return v; }))
        : 0,
      mejoraron: mejoraron,
      sostuvieron: sostuvieron,
      retrocedieron: retrocedieron
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
        adherencia: (m.adherencia === null || m.adherencia === undefined) ? null : n0(m.adherencia),
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
      adherencia: null,
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
      asistenciasHoy: asistenciasDeHoy(),
      calificacionGym: calificacionGym,
      sinInicial: sinInicial,
      cierresPendientes: cierresPendientes,
      resenasSinResponder: resenasSinResponder(),
      ausentes: ausentes,
      clasesLlenas: clasesLlenas(),
      planes: sociosPorPlan(activos),
      progreso: progresoDelGimnasio(mesAnterior),
      coaches: rendimientoCoaches(),
      pagosRecientes: pagosRecientes,
      resenasRecientes: resenasRecientes,
      altasRecientes: altasRecientes
    };
  }

  /* =============================================================
     6. Encabezado y KPIs
     ============================================================= */

  function encabezadoHTML(usuario, datos) {
    var nombre = (usuario && usuario.nombre) ? usuario.nombre : U.nombreCompleto(usuario);
    var gym = datos.conf.nombreGym || 'Alliance Gym';

    return '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title">' + ic('inicio', 22) + '<span>' +
          esc(saludoDelDia() + (nombre ? ', ' + nombre : '')) + '</span></h1>' +
        '<p class="page-sub">' +
          esc(U.capitalizar(U.fecha(datos.hoy, 'largo')) + ' · Así va ' + gym + ' hoy.') +
        '</p>' +
      '</div>' +
      '<div class="page-acciones">' +
        '<button type="button" class="btn btn-primary" data-accion="cobrar">' +
          ic('dinero', 17) + ' Registrar pago</button>' +
        '<button type="button" class="btn btn-outline" data-accion="nuevo-socio">' +
          ic('mas', 17) + ' Nuevo socio</button>' +
        '<button type="button" class="btn btn-outline" data-accion="nuevo-aviso">' +
          ic('campana', 17) + ' Nuevo aviso</button>' +
      '</div>' +
    '</div>';
  }

  function kpisHTML(datos) {
    var html = '<div class="grid g4 dir-kpis">';

    /* --- Socios activos --- */
    var altas = datos.altasMes.length;
    html += kpiHTML(
      iconoKPI('socios'),
      U.num(datos.activos.length, 0),
      'Socios activos',
      '<div class="kpi-trend ' + (altas > 0 ? 'up' : 'plana') + '">' +
        ic(altas > 0 ? 'flecha-arriba' : 'flecha-der', 14) + ' ' +
        esc(altas === 1 ? '1 alta este mes' : altas + ' altas este mes') + '</div>'
    );

    /* --- Ingresos del mes (con anillo hacia la meta) --- */
    var iconoIngreso;
    if (datos.meta > 0) {
      var pct = Math.max(0, Math.min(100, n0(datos.pctMeta)));
      iconoIngreso = '<div class="dir-anillo-kpi" title="' +
        esc(U.pct(datos.pctMeta, 0) + ' de la meta de ' + U.dinero(datos.meta, 0)) + '">' +
        Charts.progreso(pct, {
          alto: 92,
          grosor: 10,
          texto: U.pct(Math.min(999, n0(datos.pctMeta)), 0),
          aria: 'Avance hacia la meta de ingresos del mes'
        }) + '</div>';
    } else {
      iconoIngreso = iconoKPI('dinero');
    }

    var extraIngreso = trendHTML(
      datos.variacionIngreso,
      datos.enCurso ? 'vs mismo tramo del mes anterior' : 'vs mes anterior',
      'Sin ingresos el mes anterior'
    );
    if (datos.meta > 0) {
      var falta = Math.max(0, datos.meta - datos.ingresoMes);
      extraIngreso += falta > 0
        ? notaHTML('Faltan ' + U.dinero(falta, 0) + ' para la meta')
        : notaHTML('Meta del mes cumplida');
    }

    html += kpiHTML(
      iconoIngreso,
      U.dinero(datos.ingresoMes, 0),
      'Ingresos de ' + U.nombreMes(datos.mes),
      extraIngreso,
      'ok'
    );

    /* --- Asistencias de hoy --- */
    html += kpiHTML(
      iconoKPI('calendario'),
      U.num(datos.asistenciasHoy, 0),
      'Asistencias de hoy',
      notaHTML(datos.activos.length
        ? U.pct((datos.asistenciasHoy / datos.activos.length) * 100, 0) + ' de los socios activos'
        : 'Todavía no hay socios activos'),
      'info'
    );

    /* --- Calificación del gimnasio --- */
    var cal = datos.calificacionGym;
    var extraCal = cal.total
      ? '<div class="kpi-trend plana">' + U.estrellas(cal.promedio, { size: 14 }) +
          ' <span>' + esc(cal.total === 1 ? '1 reseña' : cal.total + ' reseñas') + '</span></div>'
      : notaHTML('Aún no hay reseñas del gimnasio');

    html += kpiHTML(
      iconoKPI('estrella'),
      cal.total ? U.num(cal.promedio, 1) : '—',
      'Calificación del gimnasio',
      extraCal,
      'warn'
    );

    return html + '</div>';
  }

  /* =============================================================
     7. Bloque "Requiere tu atención"
     ============================================================= */

  function pendientesDe(datos) {
    var lista = [];

    if (datos.vencidos.length) {
      lista.push({
        tono: 'error',
        icono: 'alerta',
        titulo: datos.vencidos.length === 1
          ? '1 socio con la mensualidad vencida'
          : datos.vencidos.length + ' socios con la mensualidad vencida',
        detalle: 'Por cobrar ' + U.dinero(datos.montoVencido, 0) + '. ' + nombresDe(datos.vencidos) + '.',
        boton: 'Ir a cobranza',
        ruta: 'director/pagos'
      });
    }

    if (datos.porVencer.length) {
      lista.push({
        tono: 'warn',
        icono: 'reloj',
        titulo: datos.porVencer.length === 1
          ? '1 socio vence esta semana'
          : datos.porVencer.length + ' socios vencen esta semana',
        detalle: U.dinero(datos.montoPorVencer, 0) + ' por renovar en los próximos 7 días. ' +
          nombresDe(datos.porVencer) + '.',
        boton: 'Ver renovaciones',
        ruta: 'director/pagos'
      });
    }

    if (datos.sinInicial.length) {
      lista.push({
        tono: 'warn',
        icono: 'regla',
        titulo: datos.sinInicial.length === 1
          ? '1 socio sin medición inicial de este mes'
          : datos.sinInicial.length + ' socios sin medición inicial de este mes',
        detalle: 'Sin la medición de arranque de ' + U.nombreMes(datos.mes) +
          ' no habrá comparativo al cierre. ' + nombresDe(datos.sinInicial) + '.',
        boton: 'Ir a mediciones',
        ruta: 'director/mediciones'
      });
    }

    if (datos.cierresPendientes.length) {
      lista.push({
        tono: 'warn',
        icono: 'balanza',
        titulo: datos.cierresPendientes.length === 1
          ? '1 cierre de mes pendiente'
          : datos.cierresPendientes.length + ' cierres de mes pendientes',
        detalle: 'Tienen medición inicial de ' + U.nombreMes(datos.mesAnterior) +
          ' pero les falta la de cierre. ' + nombresDe(datos.cierresPendientes) + '.',
        boton: 'Cerrar mediciones',
        ruta: 'director/mediciones'
      });
    }

    if (datos.resenasSinResponder.length) {
      lista.push({
        tono: 'error',
        icono: 'estrella',
        titulo: datos.resenasSinResponder.length === 1
          ? '1 reseña de 1 o 2 estrellas sin responder'
          : datos.resenasSinResponder.length + ' reseñas de 1 o 2 estrellas sin responder',
        detalle: 'Una respuesta rápida de dirección cambia la percepción del socio.',
        boton: 'Responder',
        ruta: 'director/calificaciones'
      });
    }

    if (datos.ausentes.length) {
      lista.push({
        tono: 'info',
        icono: 'usuario',
        titulo: datos.ausentes.length === 1
          ? '1 socio activo sin venir en ' + DIAS_SIN_VENIR + '+ días'
          : datos.ausentes.length + ' socios activos sin venir en ' + DIAS_SIN_VENIR + '+ días',
        detalle: 'Riesgo de baja: conviene una llamada o un mensaje. ' + nombresDe(datos.ausentes) + '.',
        boton: 'Ver asistencia',
        ruta: 'director/asistencia'
      });
    }

    if (datos.clasesLlenas.length) {
      var nombresClases = [];
      for (var i = 0; i < datos.clasesLlenas.length && i < TOPE_DETALLE; i++) {
        var c = datos.clasesLlenas[i];
        nombresClases.push((c.nombre || 'Clase') + ' · ' + U.capitalizar(c.dia || '') + ' ' + (c.hora || ''));
      }
      lista.push({
        tono: 'info',
        icono: 'clase',
        titulo: datos.clasesLlenas.length === 1
          ? '1 clase al 100 % de cupo'
          : datos.clasesLlenas.length + ' clases al 100 % de cupo',
        detalle: nombresClases.join(' · ') +
          (datos.clasesLlenas.length > TOPE_DETALLE ? ' y ' + (datos.clasesLlenas.length - TOPE_DETALLE) + ' más' : '') +
          '. Considera abrir otro horario.',
        boton: 'Ver clases',
        ruta: 'director/clases'
      });
    }

    return lista;
  }

  function atencionHTML(datos) {
    var lista = pendientesDe(datos);

    if (!lista.length) {
      return tarjeta('Requiere tu atención', 'escudo',
        vacio('Todo en orden: no hay cobranza vencida, las mediciones del mes están al día y ' +
          'no quedan reseñas por responder. Buen momento para trabajar en el crecimiento.', 'trofeo'),
        { sub: 'Sin pendientes por ahora' });
    }

    var html = '<div class="dir-pendientes">';
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      html += '<div class="dir-item tono-' + esc(p.tono) + '">' +
        '<div class="dir-item-ic">' + ic(p.icono, 18) + '</div>' +
        '<div class="dir-item-txt">' +
          '<b>' + esc(p.titulo) + '</b>' +
          '<span>' + esc(p.detalle) + '</span>' +
        '</div>' +
        botonRuta(p.boton, p.ruta, 'btn-outline btn-sm', 'flecha-der') +
      '</div>';
    }
    html += '</div>';

    return tarjeta('Requiere tu atención', 'alerta', html, {
      sub: lista.length === 1 ? '1 punto por resolver' : lista.length + ' puntos por resolver',
      clase: 'card-rojo',
      accion: '<span class="badge badge-danger">' + lista.length + '</span>'
    });
  }

  /* =============================================================
     8. Gráficas: ingresos y reparto por plan
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
      cuerpo = vacio('Todavía no hay pagos registrados en los últimos ' + MESES_GRAFICA +
        ' meses. En cuanto cobres el primero, aquí verás la tendencia.', 'dinero',
        '<button type="button" class="btn btn-primary btn-sm" data-accion="cobrar">' +
          ic('dinero', 15) + ' Registrar pago</button>');
    } else {
      cuerpo = '<div class="grafica">' + Charts.linea(
        [{ nombre: 'Ingresos', color: Charts.color(0), puntos: puntos }],
        {
          alto: 280,
          area: true,
          suave: true,
          leyenda: false,
          desdeCero: true,
          prefijo: datos.conf.simbolo || '$',
          etiquetaY: 'Ingresos',
          aria: 'Ingresos de los últimos ' + MESES_GRAFICA + ' meses'
        }
      ) + '</div>';

      var promedio = U.promedio(datos.serie, 'ingreso');
      cuerpo += '<div class="row wrap mt">' +
        '<span class="pill">Promedio mensual <b>' + esc(U.dinero(promedio, 0)) + '</b></span>' +
        '<span class="pill">' + esc(U.nombreMes(datos.mes)) + ' <b>' +
          esc(U.dinero(datos.ingresoMes, 0)) + '</b></span>' +
        (datos.meta > 0
          ? '<span class="pill">Meta mensual <b>' + esc(U.dinero(datos.meta, 0)) + '</b></span>'
          : '') +
      '</div>';
    }

    return tarjeta('Ingresos de los últimos ' + MESES_GRAFICA + ' meses', 'grafica', cuerpo, {
      sub: 'Solo se cuentan los pagos marcados como pagados',
      clase: 'span2',
      accion: botonRuta('Ver reportes', 'director/reportes', 'btn-ghost btn-sm', 'reporte')
    });
  }

  function graficaPlanesHTML(datos) {
    var cuerpo;
    if (!datos.planes.length) {
      cuerpo = vacio('Aún no hay socios activos con un plan asignado.', 'tarjeta',
        '<button type="button" class="btn btn-primary btn-sm" data-accion="nuevo-socio">' +
          ic('mas', 15) + ' Dar de alta un socio</button>');
    } else {
      cuerpo = '<div class="grafica">' + Charts.dona(datos.planes, {
        alto: 260,
        centroValor: U.num(datos.activos.length, 0),
        centroTitulo: 'Socios activos',
        aria: 'Reparto de socios activos por plan'
      }) + '</div>';
    }

    return tarjeta('Socios por plan', 'tarjeta', cuerpo, {
      sub: 'Sobre los socios con membresía vigente',
      accion: botonRuta('Ver socios', 'director/socios', 'btn-ghost btn-sm', 'socios')
    });
  }

  /* =============================================================
     9. Rendimiento de coaches y progreso del gimnasio
     ============================================================= */

  function coachesHTML(datos) {
    var cuerpo;

    if (!datos.coaches.length) {
      cuerpo = vacio('Todavía no hay coaches dados de alta en el sistema.', 'coach',
        botonRuta('Ir a coaches', 'director/coaches', 'btn-primary btn-sm', 'coach'));
    } else {
      cuerpo = '<div class="table-wrap"><table class="table table-compacta">' +
        '<thead><tr>' +
          '<th>Coach</th>' +
          '<th class="num">Socios</th>' +
          '<th>Calificación</th>' +
          '<th class="num">Adherencia</th>' +
          '<th class="num">Mediciones del mes</th>' +
        '</tr></thead><tbody>';

      for (var i = 0; i < datos.coaches.length; i++) {
        var f = datos.coaches[i];
        var cal = f.calificacion || { promedio: 0, total: 0 };

        var celdaCal = cal.total
          ? U.estrellas(cal.promedio, { size: 13 }) +
            ' <span class="bold nums">' + esc(U.num(cal.promedio, 1)) + '</span>' +
            ' <span class="mini muted">(' + esc(String(cal.total)) + ')</span>'
          : '<span class="mini muted">Sin reseñas</span>';

        var celdaAdh;
        if (f.adherencia === null) {
          celdaAdh = '<span class="mini muted">—</span>';
        } else {
          var claseAdh = f.adherencia >= 80 ? 'txt-ok' : (f.adherencia >= 50 ? 'txt-warn' : 'txt-error');
          celdaAdh = '<span class="bold ' + claseAdh + '">' + esc(U.pct(f.adherencia, 0)) + '</span>';
        }

        var esperadas = f.medicionesEsperadas;
        var claseMed = (esperadas > 0 && f.medicionesHechas >= esperadas) ? 'txt-ok'
          : (esperadas > 0 && f.medicionesHechas === 0 ? 'txt-error' : 'txt-warn');
        var celdaMed = esperadas > 0
          ? '<span class="bold ' + claseMed + '">' + esc(f.medicionesHechas + ' / ' + esperadas) + '</span>'
          : '<span class="mini muted">Sin socios activos</span>';

        cuerpo += '<tr class="clickable" data-coach="' + esc(f.coach.id) + '">' +
          '<td><div class="dir-coach">' + U.avatar(f.coach, 'sm') +
            '<b>' + esc(U.nombreCompleto(f.coach)) + '</b></div></td>' +
          '<td class="num">' + esc(f.activos + ' / ' + f.totales) + '</td>' +
          '<td class="nowrap">' + celdaCal + '</td>' +
          '<td class="num">' + celdaAdh + '</td>' +
          '<td class="num">' + celdaMed + '</td>' +
        '</tr>';
      }

      cuerpo += '</tbody></table></div>';
    }

    return tarjeta('Rendimiento de coaches', 'coach', cuerpo, {
      sub: 'Socios activos, satisfacción, adherencia y cobertura de mediciones',
      clase: 'span2',
      accion: botonRuta('Ver detalle', 'director/coaches', 'btn-ghost btn-sm', 'flecha-der')
    });
  }

  function progresoHTML(datos) {
    var p = datos.progreso;
    var cuerpo;

    if (!p.evaluados) {
      cuerpo = vacio('Nadie tiene medición inicial y de cierre en ' + U.nombreMes(p.mes) +
        ', así que todavía no hay puntaje del mes.', 'balanza',
        botonRuta('Ir a mediciones', 'director/mediciones', 'btn-primary btn-sm', 'regla'));
    } else {
      var nivel = Calc.textoNivel(
        p.promedio >= 80 ? 'excelente' : (p.promedio >= 60 ? 'bueno' : (p.promedio >= 40 ? 'regular' : 'atencion'))
      );

      cuerpo = '<div class="center">' +
        '<div class="anillo anillo-lg">' + Charts.progreso(p.promedio, {
          alto: 180,
          grosor: 15,
          texto: String(p.promedio),
          etiqueta: 'Puntaje',
          aria: 'Puntaje promedio de progreso del gimnasio'
        }) + '</div>' +
      '</div>';

      cuerpo += '<p class="mini muted txt-centro mt-sm">' +
        esc(nivel + ' · ' + p.evaluados + (p.evaluados === 1 ? ' socio evaluado en ' : ' socios evaluados en ') +
          U.nombreMes(p.mes)) + '</p>';

      cuerpo += '<div class="dir-marcadores">' +
        '<div class="dir-marcador"><b class="txt-ok">' + esc(String(p.mejoraron)) + '</b>' +
          '<span>Mejoraron</span></div>' +
        '<div class="dir-marcador"><b class="txt-warn">' + esc(String(p.sostuvieron)) + '</b>' +
          '<span>Se mantuvieron</span></div>' +
        '<div class="dir-marcador"><b class="txt-error">' + esc(String(p.retrocedieron)) + '</b>' +
          '<span>Retrocedieron</span></div>' +
      '</div>';
    }

    return tarjeta('Progreso del gimnasio', 'trofeo', cuerpo, {
      sub: 'Último mes cerrado: ' + U.nombreMes(p.mes),
      accion: botonRuta('Ver mediciones', 'director/mediciones', 'btn-ghost btn-sm', 'regla')
    });
  }

  /* =============================================================
     10. Tercera fila: pagos, reseñas y altas
     ============================================================= */

  function pagosHTML(datos) {
    var cuerpo;

    if (!datos.pagosRecientes.length) {
      cuerpo = vacio('Todavía no hay pagos registrados.', 'dinero',
        '<button type="button" class="btn btn-primary btn-sm" data-accion="cobrar">' +
          ic('dinero', 15) + ' Registrar el primero</button>');
    } else {
      cuerpo = '<div class="list list-plana">';
      for (var i = 0; i < datos.pagosRecientes.length; i++) {
        var pago = datos.pagosRecientes[i];
        var socio = pago.socioId ? DB.usuario(pago.socioId) : null;
        cuerpo += '<div class="list-item">' +
          (socio ? U.avatar(socio, 'sm') : '<div class="dir-item-ic">' + ic('dinero', 16) + '</div>') +
          '<div class="list-item-main">' +
            '<b>' + esc(socio ? U.nombreCompleto(socio) : 'Socio dado de baja') + '</b>' +
            '<span>' + esc(etiquetaConcepto(pago.concepto) + ' · ' + U.fechaRelativa(pago.fecha)) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' +
            '<span class="bold nums">' + esc(U.dinero(pago.monto, 0)) + '</span>' +
          '</div>' +
        '</div>';
      }
      cuerpo += '</div>';
    }

    return tarjeta('Últimos pagos', 'tarjeta', cuerpo, {
      sub: 'Los ' + TOPE_PAGOS + ' cobros más recientes',
      pie: botonRuta('Ver todos los pagos', 'director/pagos', 'btn-ghost btn-sm btn-block', 'flecha-der')
    });
  }

  function resenasHTML(datos) {
    var cuerpo;

    if (!datos.resenasRecientes.length) {
      cuerpo = vacio('Aún no hay reseñas de los socios. Cuando califiquen al gimnasio o a su coach, ' +
        'aparecerán aquí.', 'estrella');
    } else {
      cuerpo = '<div class="stack-sm">';
      for (var i = 0; i < datos.resenasRecientes.length; i++) {
        var c = datos.resenasRecientes[i];
        var socio = c.socioId ? DB.usuario(c.socioId) : null;
        var destino;
        if (c.tipo === 'coach') {
          var coach = c.objetivoId ? DB.usuario(c.objetivoId) : null;
          destino = coach ? 'Coach ' + U.nombreCompleto(coach) : 'Coach del gimnasio';
        } else {
          destino = 'Sobre el gimnasio';
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
            ? '<p>' + esc(U.truncar(c.comentario, 150)) + '</p>'
            : '<p class="muted">Calificó sin dejar comentario.</p>') +
          (c.respuesta && c.respuesta.texto
            ? '<span class="badge badge-ok mt-sm">Respondida</span>'
            : (Math.round(n0(c.estrellas)) <= 3
                ? '<span class="badge badge-warn mt-sm">Sin responder</span>'
                : '')) +
        '</div>';
      }
      cuerpo += '</div>';
    }

    return tarjeta('Últimas reseñas', 'estrella', cuerpo, {
      sub: 'Lo que los socios están diciendo',
      pie: botonRuta('Ver calificaciones', 'director/calificaciones', 'btn-ghost btn-sm btn-block', 'flecha-der')
    });
  }

  function altasHTML(datos) {
    var cuerpo;

    if (!datos.altasRecientes.length) {
      cuerpo = vacio('Todavía no hay socios registrados.', 'socios',
        '<button type="button" class="btn btn-primary btn-sm" data-accion="nuevo-socio">' +
          ic('mas', 15) + ' Dar de alta al primero</button>');
    } else {
      cuerpo = '<div class="list list-plana">';
      for (var i = 0; i < datos.altasRecientes.length; i++) {
        var s = datos.altasRecientes[i];
        var plan = s.planId ? DB.plan(s.planId) : null;
        var membresia = Calc.estadoMembresia(s);
        cuerpo += '<div class="list-item clickable" data-socio="' + esc(s.id) + '">' +
          U.avatar(s, 'sm') +
          '<div class="list-item-main">' +
            '<b>' + esc(U.nombreCompleto(s)) + '</b>' +
            '<span>' + esc((plan ? plan.nombre : 'Sin plan') + ' · alta ' + U.fechaRelativa(s.fechaAlta)) + '</span>' +
          '</div>' +
          '<div class="list-item-side">' +
            '<span class="badge ' + esc(membresia.clase) + '">' + esc(membresia.estado === 'activo' ? 'Activo'
              : (membresia.estado === 'por_vencer' ? 'Por vencer'
              : (membresia.estado === 'vencido' ? 'Vencido'
              : (membresia.estado === 'congelado' ? 'Congelado' : 'Baja')))) + '</span>' +
          '</div>' +
        '</div>';
      }
      cuerpo += '</div>';
    }

    return tarjeta('Altas recientes', 'socios', cuerpo, {
      sub: 'Los ' + TOPE_ALTAS + ' socios más nuevos',
      pie: botonRuta('Ver todos los socios', 'director/socios', 'btn-ghost btn-sm btn-block', 'flecha-der')
    });
  }

  /* =============================================================
     11. Avisos del gimnasio
     ============================================================= */

  function avisosHTML(usuario) {
    var cuerpo = '';
    try {
      if (AG.Mod && AG.Mod.Avisos && typeof AG.Mod.Avisos.tarjetas === 'function') {
        cuerpo = AG.Mod.Avisos.tarjetas(usuario, TOPE_AVISOS);
      }
    } catch (e) { cuerpo = ''; }

    if (!cuerpo) {
      cuerpo = vacio('El tablón de avisos no está disponible en este momento.', 'campana');
    }

    return tarjeta('Avisos del gimnasio', 'campana', cuerpo, {
      sub: 'Lo último que publicó dirección',
      accion: '<button type="button" class="btn btn-outline btn-sm" data-accion="nuevo-aviso">' +
        ic('mas', 15) + ' Nuevo aviso</button>',
      pie: botonRuta('Ver todos los avisos', 'director/avisos', 'btn-ghost btn-sm btn-block', 'flecha-der')
    });
  }

  /* =============================================================
     12. Acciones del tablero
     ============================================================= */

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

  /* =============================================================
     13. Render de la ruta 'director/inicio'
     ============================================================= */

  function render(ctx) {
    asegurarEstilos();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario : null;

    /* Control de acceso propio: este tablero es solo para dirección. */
    if (!usuario || usuario.rol !== 'director') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('Este tablero es exclusivo de la dirección del gimnasio.', 'candado') +
        '</div></div></div>';
    }

    var datos;
    try {
      datos = calcularTablero();
    } catch (e) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('No pudimos preparar el tablero con los datos actuales. Revisa la base en Configuración.', 'alerta',
          botonRuta('Ir a configuración', 'director/config', 'btn-primary btn-sm', 'config')) +
        '</div></div></div>';
    }

    var html = '<div class="page">' +
      encabezadoHTML(usuario, datos) +
      kpisHTML(datos) +
      atencionHTML(datos) +
      '<div class="grid g3 dir-fila">' +
        graficaIngresosHTML(datos) +
        graficaPlanesHTML(datos) +
      '</div>' +
      '<div class="grid g3 dir-fila">' +
        coachesHTML(datos) +
        progresoHTML(datos) +
      '</div>' +
      '<div class="grid g3">' +
        pagosHTML(datos) +
        resenasHTML(datos) +
        altasHTML(datos) +
      '</div>' +
      avisosHTML(usuario) +
    '</div>';

    return {
      html: html,
      listo: function (root) {
        /* --- Botones rápidos del encabezado y de los estados vacíos --- */
        U.delegar(root, 'click', '[data-accion]', function (e, el) {
          var accion = el.getAttribute('data-accion');
          if (accion === 'cobrar') abrirCobro();
          else if (accion === 'nuevo-socio') abrirNuevoSocio();
          else if (accion === 'nuevo-aviso') abrirNuevoAviso();
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
      }
    };
  }

  /* =============================================================
     14. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.Director = {
    render: render,
    calcular: calcularTablero,
    pendientes: pendientesDe
  };

  AG.Router.registrar({
    path: 'director/inicio',
    roles: ['director'],
    titulo: 'Inicio',
    nav: { etiqueta: 'Inicio', icono: 'inicio', grupo: 'Principal', orden: 1 },
    render: render
  });
})(window.AG);
