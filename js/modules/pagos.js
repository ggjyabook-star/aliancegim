/* =============================================================
   ALLIANCE GYM — Pagos y finanzas (AG.Mod.Pagos)
   -------------------------------------------------------------
   Ruta: 'director/pagos' con tres pestañas:
     · Movimientos — tabla filtrable, exportable e imprimible
     · Cobranza    — vencidos y por vencer, con recordatorios
     · Análisis    — ingresos por mes, método, plan y coach

   Funciones compartidas con el resto del sistema:
     AG.Mod.Pagos.registrar(socioId|null)  -> modal de cobro
     AG.Mod.Pagos.recibo(pagoId)           -> recibo imprimible
     AG.Mod.Pagos.numeroALetras(monto)     -> importe con letra

   Todo el texto que viene de la base pasa por AG.Utils.esc().
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var DB = AG.DB;

  /* =============================================================
     0. Atajos y catálogos
     ============================================================= */

  function esc(valor) { return U.esc(valor); }

  /** Icono seguro: si el nombre no existe, AG.Icons devuelve uno neutro. */
  function ic(nombre, tamano) {
    if (AG.Icons && typeof AG.Icons.get === 'function') {
      try { return AG.Icons.get(nombre, tamano || 18); } catch (e) { return ''; }
    }
    return '';
  }

  function ajustes() {
    return (DB.state && DB.state.settings) ? DB.state.settings : {};
  }

  function relleno(n, largo) {
    var s = String(Math.abs(Math.floor(Number(n) || 0)));
    while (s.length < (largo || 2)) s = '0' + s;
    return s;
  }

  /* Métodos de cobro del contrato de datos. */
  var METODOS = [
    { id: 'efectivo',      etiqueta: 'Efectivo',      icono: 'dinero',   pista: 'Caja de recepción', color: '#22c55e' },
    { id: 'tarjeta',       etiqueta: 'Tarjeta',       icono: 'tarjeta',  pista: 'Débito o crédito',  color: '#3b82f6' },
    { id: 'transferencia', etiqueta: 'Transferencia', icono: 'subir',    pista: 'SPEI o depósito',   color: '#a855f7' },
    { id: 'app',           etiqueta: 'App / QR',      icono: 'telefono', pista: 'Pago desde celular', color: '#f59e0b' }
  ];

  /* Conceptos del contrato de datos. */
  var CONCEPTOS = [
    { id: 'mensualidad',   etiqueta: 'Mensualidad',      mueveVigencia: true },
    { id: 'inscripcion',   etiqueta: 'Inscripción',      mueveVigencia: false },
    { id: 'clase',         etiqueta: 'Clase o visita',   mueveVigencia: false },
    { id: 'producto',      etiqueta: 'Producto',         mueveVigencia: false },
    { id: 'personalizado', etiqueta: 'Otro concepto',    mueveVigencia: false }
  ];

  var ESTADOS_PAGO = [
    { id: 'pagado',    etiqueta: 'Pagado',    clase: 'badge-ok' },
    { id: 'pendiente', etiqueta: 'Pendiente', clase: 'badge-warn' },
    { id: 'cancelado', etiqueta: 'Cancelado', clase: 'badge-muted' }
  ];

  function buscarEn(catalogo, id) {
    for (var i = 0; i < catalogo.length; i++) {
      if (catalogo[i].id === id) return catalogo[i];
    }
    return null;
  }

  function metodoEtiqueta(id) {
    var m = buscarEn(METODOS, id);
    return m ? m.etiqueta : (id ? U.capitalizar(id) : 'Sin método');
  }

  function conceptoEtiqueta(id) {
    var c = buscarEn(CONCEPTOS, id);
    return c ? c.etiqueta : (id ? U.capitalizar(id) : 'Sin concepto');
  }

  function mueveVigencia(concepto) {
    var c = buscarEn(CONCEPTOS, concepto);
    return !!(c && c.mueveVigencia);
  }

  function estadoInfo(id) {
    return buscarEn(ESTADOS_PAGO, id || 'pagado') || ESTADOS_PAGO[0];
  }

  /* =============================================================
     1. Estilos mínimos propios (recibo y sello)
     Se inyectan una sola vez; el resto usa las clases de styles.css.
     ============================================================= */

  var ID_ESTILO = 'ag-pagos-estilo';

  var CSS_PROPIO =
    '.pg-sello{display:inline-block;padding:6px 20px;border:3px solid var(--ok);color:var(--ok);' +
    'border-radius:10px;font-weight:800;letter-spacing:.2em;font-size:15px;transform:rotate(-7deg)}' +
    '.pg-sello.pg-anulado{border-color:var(--error);color:var(--error)}' +
    '.pg-recibo-tabla{width:100%;border-collapse:collapse;font-size:13px}' +
    '.pg-recibo-tabla th,.pg-recibo-tabla td{padding:9px 10px;border-bottom:1px solid var(--borde);text-align:left;vertical-align:top}' +
    '.pg-recibo-tabla th{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--texto-3);font-weight:800}' +
    '.pg-recibo-tabla td.pg-der,.pg-recibo-tabla th.pg-der{text-align:right}' +
    '.pg-total{font-size:20px;font-weight:800;letter-spacing:-.02em}' +
    '.pg-letra{border:1px dashed var(--borde-2);border-radius:8px;padding:9px 12px;font-size:12.5px;line-height:1.5}' +
    '.pg-cobranza-item{border-bottom:1px solid var(--borde);padding:11px 13px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}' +
    '.pg-cobranza-item:last-child{border-bottom:0}' +
    '.pg-cobranza-item .pg-acciones{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}' +
    '@media (max-width:560px){.pg-cobranza-item .pg-acciones{margin-left:0;width:100%}' +
    '.pg-cobranza-item .pg-acciones .btn{flex:1 1 auto}}';

  function inyectarEstilo() {
    try {
      if (document.getElementById(ID_ESTILO)) return;
      var st = document.createElement('style');
      st.id = ID_ESTILO;
      st.textContent = CSS_PROPIO;
      document.head.appendChild(st);
    } catch (e) { /* sin estilos propios la pantalla sigue siendo usable */ }
  }

  /* =============================================================
     2. Importe con letra (es-MX)
     ============================================================= */

  var UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
    'DIECIOCHO', 'DIECINUEVE'];

  var VEINTIS = ['', 'UNO', 'DÓS', 'TRÉS', 'CUATRO', 'CINCO', 'SÉIS', 'SIETE', 'OCHO', 'NUEVE'];

  var DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];

  var CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  /** 0..99 en letra. */
  function decenasALetra(n) {
    if (n <= 0) return '';
    if (n < 20) return UNIDADES[n];
    if (n === 20) return 'VEINTE';
    if (n < 30) return 'VEINTI' + VEINTIS[n - 20];
    var d = Math.floor(n / 10), u = n % 10;
    return DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
  }

  /** 0..999 en letra. */
  function centenasALetra(n) {
    if (n <= 0) return '';
    if (n === 100) return 'CIEN';
    var c = Math.floor(n / 100), resto = n % 100;
    var cabeza = CENTENAS[c];
    var cola = decenasALetra(resto);
    if (cabeza && cola) return cabeza + ' ' + cola;
    return cabeza || cola;
  }

  /** 'UNO' -> 'UN' y 'VEINTIUNO' -> 'VEINTIÚN' antes de MIL / MILLÓN. */
  function apocopar(texto) {
    var t = String(texto || '');
    if (/VEINTIUNO$/.test(t)) return t.replace(/VEINTIUNO$/, 'VEINTIÚN');
    if (/(^|\s)UNO$/.test(t)) return t.replace(/(^|\s)UNO$/, '$1UN');
    return t;
  }

  /** Entero positivo en letra. */
  function enteroALetras(n) {
    var v = Math.floor(Math.abs(Number(n) || 0));
    if (v === 0) return 'CERO';
    if (v > 999999999) return 'IMPORTE FUERA DE RANGO';

    var partes = [];
    var millones = Math.floor(v / 1000000);
    var miles = Math.floor((v % 1000000) / 1000);
    var resto = v % 1000;

    if (millones > 0) {
      partes.push(millones === 1 ? 'UN MILLÓN' : apocopar(centenasALetra(millones)) + ' MILLONES');
    }
    if (miles > 0) {
      partes.push(miles === 1 ? 'MIL' : apocopar(centenasALetra(miles)) + ' MIL');
    }
    if (resto > 0) partes.push(centenasALetra(resto));

    return partes.join(' ');
  }

  /**
   * Importe con letra al estilo de recibo mexicano.
   * numeroALetras(1250.5) -> 'MIL DOSCIENTOS CINCUENTA PESOS 50/100 M.N.'
   */
  function numeroALetras(monto) {
    var v = Math.abs(U.aNumero(monto));
    var entero = Math.floor(v);
    var centavos = Math.round((v - entero) * 100);
    if (centavos >= 100) { entero += 1; centavos = 0; }

    var conf = ajustes();
    var moneda = conf.moneda === 'MXN' || !conf.moneda ? 'PESOS' : String(conf.moneda).toUpperCase();
    var cierre = (conf.moneda === 'MXN' || !conf.moneda) ? ' M.N.' : '';
    var signo = U.aNumero(monto) < 0 ? 'MENOS ' : '';

    return signo + enteroALetras(entero) + ' ' + moneda + ' ' + relleno(centavos, 2) + '/100' + cierre;
  }

  /* =============================================================
     3. Consultas de dominio
     ============================================================= */

  function socioDe(pago) {
    return pago ? DB.usuario(pago.socioId) : null;
  }

  function nombreDe(usuario) {
    var n = U.nombreCompleto(usuario);
    return n || 'Socio no encontrado';
  }

  function planDe(id) {
    return DB.plan(id);
  }

  function nombrePlan(id) {
    var p = planDe(id);
    return p ? p.nombre : 'Sin plan';
  }

  function esPagado(p) {
    return !!p && (p.estado || 'pagado') === 'pagado';
  }

  /** Duración del plan en fecha final a partir de un inicio. */
  function finDeVigencia(inicio, plan) {
    if (!inicio) return '';
    if (!plan) return inicio;
    var meses = Math.max(0, Math.floor(U.aNumero(plan.meses)));
    if (meses > 0) return U.sumaMeses(inicio, meses);
    var dias = Math.max(0, Math.floor(U.aNumero(plan.dias)));
    if (dias > 0) return U.sumaDias(inicio, dias);
    return inicio;
  }

  /** Duración legible del plan ('1 mes', '3 meses', '7 días'). */
  function duracionPlan(plan) {
    if (!plan) return 'sin vigencia';
    var meses = Math.max(0, Math.floor(U.aNumero(plan.meses)));
    if (meses === 1) return '1 mes';
    if (meses > 1) return meses + ' meses';
    var dias = Math.max(0, Math.floor(U.aNumero(plan.dias)));
    if (dias === 1) return '1 día';
    if (dias > 1) return dias + ' días';
    return 'sin vigencia';
  }

  /** periodoInicio = máx(hoy, vencimiento actual + 1 día). */
  function inicioDeVigencia(socio, fechaCobro) {
    var hoy = fechaCobro || U.hoy();
    var venc = (socio && typeof socio.fechaVencimiento === 'string') ? socio.fechaVencimiento : '';
    if (!venc) return hoy;
    var siguiente = U.sumaDias(venc, 1);
    return siguiente > hoy ? siguiente : hoy;
  }

  /** Socios visibles según el rol (el coach solo ve los suyos). */
  function sociosVisibles(usuario) {
    if (!usuario) return [];
    if (usuario.rol === 'coach') return DB.sociosDe(usuario.id);
    if (usuario.rol === 'socio') {
      var yo = DB.usuario(usuario.id);
      return yo ? [yo] : [];
    }
    return DB.socios();
  }

  /** ¿Este usuario puede registrar cobros? */
  function puedeCobrar(usuario) {
    return !!usuario && (usuario.rol === 'director' || usuario.rol === 'coach');
  }

  /* =============================================================
     4. Estado de la pantalla (se conserva entre repintados)
     ============================================================= */

  var filtros = {
    pestana: 'movimientos',
    rango: 'mes',
    desde: '',
    hasta: '',
    metodo: '',
    concepto: '',
    planId: '',
    socioId: '',
    estado: '',
    q: '',
    orden: 'fecha',
    dir: 'desc',
    limite: 60,
    periodoAnalisis: 'anio'
  };

  function primerDiaDelMes(mesKey) {
    return String(mesKey).slice(0, 7) + '-01';
  }

  function ultimoDiaDelMes(mesKey) {
    var anio = Number(String(mesKey).slice(0, 4));
    var mes = Number(String(mesKey).slice(5, 7));
    return String(mesKey).slice(0, 7) + '-' + relleno(U.diasDelMes(anio, mes), 2);
  }

  /** Aplica un rango rápido de fechas al filtro. */
  function aplicarRango(clave) {
    var hoy = U.hoy();
    filtros.rango = clave;
    if (clave === 'mes') {
      filtros.desde = primerDiaDelMes(U.mesActual());
      filtros.hasta = hoy;
    } else if (clave === 'anterior') {
      var ant = U.mesDe(U.sumaMeses(primerDiaDelMes(U.mesActual()), -1));
      filtros.desde = primerDiaDelMes(ant);
      filtros.hasta = ultimoDiaDelMes(ant);
    } else if (clave === '90') {
      filtros.desde = U.sumaDias(hoy, -89);
      filtros.hasta = hoy;
    } else if (clave === 'anio') {
      filtros.desde = U.sumaDias(hoy, -364);
      filtros.hasta = hoy;
    } else {
      filtros.desde = '';
      filtros.hasta = '';
    }
    filtros.limite = 60;
  }

  if (!filtros.desde && !filtros.hasta) aplicarRango('mes');

  /* =============================================================
     5. Cálculos de la cabecera (KPIs)
     ============================================================= */

  function pagosDelMes(mesKey) {
    return DB.donde('pagos', function (p) {
      return esPagado(p) && U.mesDe(p.fecha) === mesKey;
    });
  }

  function listasDeCobranza() {
    var hoy = U.hoy();
    var vencidos = [];
    var porVencer = [];
    var socios = DB.socios();

    for (var i = 0; i < socios.length; i++) {
      var s = socios[i];
      if (!s || s.estado === 'baja' || s.estado === 'congelado' || s.activo === false) continue;
      var venc = (typeof s.fechaVencimiento === 'string') ? s.fechaVencimiento : '';
      if (!venc) continue;

      var dias = U.diasEntre(hoy, venc);   // negativo = ya venció
      var plan = planDe(s.planId);
      var fila = {
        socio: s,
        plan: plan,
        monto: plan ? U.aNumero(plan.precio) : 0,
        vence: venc,
        dias: dias
      };
      if (dias < 0) vencidos.push(fila);
      else if (dias <= 7) porVencer.push(fila);
    }

    vencidos.sort(function (a, b) { return a.dias - b.dias; });
    porVencer.sort(function (a, b) { return a.dias - b.dias; });
    return { vencidos: vencidos, porVencer: porVencer };
  }

  function calcularKPIs() {
    var mes = U.mesActual();
    var mesAnterior = U.mesDe(U.sumaMeses(primerDiaDelMes(mes), -1));
    var hoy = U.hoy();

    var delMes = pagosDelMes(mes);
    var delAnterior = pagosDelMes(mesAnterior);

    var ingresoMes = U.suma(delMes, 'monto');
    var ingresoAnterior = U.suma(delAnterior, 'monto');

    var variacion = null;
    if (ingresoAnterior > 0) variacion = ((ingresoMes - ingresoAnterior) / ingresoAnterior) * 100;

    var cobradoHoy = U.suma(DB.donde('pagos', function (p) {
      return esPagado(p) && p.fecha === hoy;
    }), 'monto');

    var cobranza = listasDeCobranza();
    var porCobrar = U.suma(cobranza.vencidos, 'monto') + U.suma(cobranza.porVencer, 'monto');

    var numPagos = delMes.length;
    var ticket = numPagos ? ingresoMes / numPagos : 0;

    var partes = U.partesDe(hoy);
    var diaActual = partes ? partes.d : 1;
    var diasMes = partes ? U.diasDelMes(partes.a, partes.m) : 30;
    var proyeccion = diaActual > 0 ? (ingresoMes / diaActual) * diasMes : ingresoMes;

    return {
      mes: mes,
      mesAnterior: mesAnterior,
      ingresoMes: ingresoMes,
      ingresoAnterior: ingresoAnterior,
      variacion: variacion,
      cobradoHoy: cobradoHoy,
      porCobrar: porCobrar,
      vencidos: cobranza.vencidos,
      porVencer: cobranza.porVencer,
      ticket: ticket,
      numPagos: numPagos,
      proyeccion: proyeccion,
      metaMes: U.aNumero(ajustes().metaIngresoMensual)
    };
  }

  function kpiHTML(icono, valor, etiqueta, extra, variante) {
    return '<div class="kpi' + (variante ? ' kpi-' + variante : '') + '">' +
      '<div class="kpi-icono">' + ic(icono, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        (extra || '') +
      '</div></div>';
  }

  function tendenciaHTML(pct) {
    if (pct === null || pct === undefined || !isFinite(pct)) {
      return '<div class="kpi-trend plana">' + ic('flecha-der', 14) + ' Sin mes anterior</div>';
    }
    var clase = pct > 0.5 ? 'up' : (pct < -0.5 ? 'down' : 'plana');
    var icono = pct > 0.5 ? 'flecha-arriba' : (pct < -0.5 ? 'flecha-abajo' : 'flecha-der');
    return '<div class="kpi-trend ' + clase + '">' + ic(icono, 14) + ' ' +
      esc(U.signo(pct, 1, '%')) + ' vs mes anterior</div>';
  }

  function bloqueKPIs() {
    var k = calcularKPIs();
    var html = '<div class="grid g3">';

    html += kpiHTML('dinero', U.dinero(k.ingresoMes, 0), 'Ingreso de ' + U.nombreMes(k.mes),
      tendenciaHTML(k.variacion));

    html += kpiHTML('tarjeta', U.dinero(k.cobradoHoy, 0), 'Cobrado hoy',
      '<div class="kpi-trend plana">' + ic('calendario', 14) + ' ' + esc(U.fecha(U.hoy(), 'corto')) + '</div>',
      'ok');

    html += kpiHTML('alerta', U.dinero(k.porCobrar, 0), 'Por cobrar',
      '<div class="kpi-trend plana">' + esc(k.vencidos.length + ' vencidos · ' + k.porVencer.length + ' por vencer') + '</div>',
      k.vencidos.length ? 'error' : 'warn');

    html += kpiHTML('grafica', U.dinero(k.ticket, 0), 'Ticket promedio',
      '<div class="kpi-trend plana">' + esc('Sobre ' + k.numPagos + (k.numPagos === 1 ? ' pago' : ' pagos')) + '</div>',
      'info');

    html += kpiHTML('reporte', U.num(k.numPagos, 0), 'Pagos del mes',
      '<div class="kpi-trend plana">' + esc(U.nombreMes(k.mes)) + '</div>');

    var extraProy = '';
    if (k.metaMes > 0) {
      var avance = Math.max(0, Math.min(200, (k.proyeccion / k.metaMes) * 100));
      var claseProy = avance >= 100 ? 'up' : (avance >= 80 ? 'plana' : 'down');
      extraProy = '<div class="kpi-trend ' + claseProy + '">' + ic('meta', 14) + ' ' +
        esc(U.pct(avance, 0) + ' de la meta') + '</div>';
    } else {
      extraProy = '<div class="kpi-trend plana">' + ic('meta', 14) + ' Cierre estimado del mes</div>';
    }
    html += kpiHTML('trofeo', U.dinero(k.proyeccion, 0), 'Proyección de cierre', extraProy, 'warn');

    html += '</div>';
    return html;
  }

  /* =============================================================
     6. Movimientos: filtrado, orden y tabla
     ============================================================= */

  function pagosFiltrados() {
    var q = U.normalizar(filtros.q);

    return DB.donde('pagos', function (p) {
      if (!p) return false;
      var fecha = (typeof p.fecha === 'string') ? p.fecha : '';
      if (filtros.desde && fecha < filtros.desde) return false;
      if (filtros.hasta && fecha > filtros.hasta) return false;
      if (filtros.metodo && p.metodo !== filtros.metodo) return false;
      if (filtros.concepto && p.concepto !== filtros.concepto) return false;
      if (filtros.planId && p.planId !== filtros.planId) return false;
      if (filtros.socioId && p.socioId !== filtros.socioId) return false;
      if (filtros.estado && (p.estado || 'pagado') !== filtros.estado) return false;

      if (q) {
        var s = socioDe(p);
        var texto = (p.folio || '') + ' ' + nombreDe(s) + ' ' + (s && s.codigo ? s.codigo : '');
        if (U.normalizar(texto).indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function ordenarPagos(lista) {
    if (filtros.orden === 'socio') {
      return U.ordenar(lista, function (p) { return U.normalizar(nombreDe(socioDe(p))); }, filtros.dir);
    }
    if (filtros.orden === 'monto') {
      return U.ordenar(lista, function (p) { return U.aNumero(p.monto); }, filtros.dir);
    }
    if (filtros.orden === 'folio') {
      return U.ordenar(lista, 'folio', filtros.dir);
    }
    return U.ordenar(lista, 'fecha', filtros.dir);
  }

  function claseOrden(campo) {
    if (filtros.orden !== campo) return 'sortable';
    return 'sortable ' + (filtros.dir === 'asc' ? 'asc' : 'desc');
  }

  function opcionesSelect(lista, seleccionado, textoVacio) {
    var html = '<option value="">' + esc(textoVacio) + '</option>';
    for (var i = 0; i < lista.length; i++) {
      var op = lista[i];
      html += '<option value="' + esc(op.id) + '"' + (op.id === seleccionado ? ' selected' : '') + '>' +
        esc(op.etiqueta) + '</option>';
    }
    return html;
  }

  function barraFiltros(usuario) {
    var planes = U.ordenar(DB.get('planes'), 'nombre', 'asc').map(function (p) {
      return { id: p.id, etiqueta: p.nombre + ' · ' + U.dinero(p.precio, 0) };
    });

    var socios = U.ordenar(sociosVisibles(usuario), function (s) {
      return U.normalizar(U.nombreCompleto(s));
    }, 'asc').map(function (s) {
      return { id: s.id, etiqueta: U.nombreCompleto(s) + (s.codigo ? ' (' + s.codigo + ')' : '') };
    });

    var rangos = [
      { id: 'mes', etiqueta: 'Este mes' },
      { id: 'anterior', etiqueta: 'Mes anterior' },
      { id: '90', etiqueta: 'Últimos 90 días' },
      { id: 'anio', etiqueta: 'Último año' },
      { id: 'todo', etiqueta: 'Todo el historial' }
    ];

    var chips = '<div class="chips">';
    for (var i = 0; i < rangos.length; i++) {
      chips += '<button type="button" class="chip' + (filtros.rango === rangos[i].id ? ' on' : '') +
        '" data-rango="' + esc(rangos[i].id) + '">' + esc(rangos[i].etiqueta) + '</button>';
    }
    chips += '</div>';

    return '' +
      '<div class="card mb">' +
        '<div class="card-head">' +
          '<div>' +
            '<h3 class="card-title">' + ic('filtro', 18) + ' Filtros</h3>' +
            '<p class="card-sub">Acota el periodo y afina por método, concepto, plan o socio.</p>' +
          '</div>' +
          '<div class="card-accion">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-limpiar>' + ic('x', 15) + ' Limpiar</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-csv>' + ic('descargar', 15) + ' Exportar CSV</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-body stack-sm">' +
          chips +
          '<div class="form-grid">' +
            '<div class="field">' +
              '<label class="label" for="pg-desde">Desde</label>' +
              '<input class="input" type="date" id="pg-desde" data-filtro="desde" value="' + esc(filtros.desde) + '">' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-hasta">Hasta</label>' +
              '<input class="input" type="date" id="pg-hasta" data-filtro="hasta" value="' + esc(filtros.hasta) + '">' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-metodo">Método</label>' +
              '<select class="select" id="pg-metodo" data-filtro="metodo">' +
                opcionesSelect(METODOS.map(function (m) { return { id: m.id, etiqueta: m.etiqueta }; }), filtros.metodo, 'Todos los métodos') +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-concepto">Concepto</label>' +
              '<select class="select" id="pg-concepto" data-filtro="concepto">' +
                opcionesSelect(CONCEPTOS.map(function (c) { return { id: c.id, etiqueta: c.etiqueta }; }), filtros.concepto, 'Todos los conceptos') +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-plan">Plan</label>' +
              '<select class="select" id="pg-plan" data-filtro="planId">' +
                opcionesSelect(planes, filtros.planId, 'Todos los planes') +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-socio">Socio</label>' +
              '<select class="select" id="pg-socio" data-filtro="socioId">' +
                opcionesSelect(socios, filtros.socioId, 'Todos los socios') +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-estado">Estado</label>' +
              '<select class="select" id="pg-estado" data-filtro="estado">' +
                opcionesSelect(ESTADOS_PAGO.map(function (e) { return { id: e.id, etiqueta: e.etiqueta }; }), filtros.estado, 'Todos los estados') +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="pg-q">Buscar</label>' +
              '<div class="input-icono">' + ic('buscar', 17) +
                '<input class="input" type="search" id="pg-q" placeholder="Folio o nombre del socio" value="' + esc(filtros.q) + '" autocomplete="off">' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function filaPago(p) {
    var s = socioDe(p);
    var info = estadoInfo(p.estado);
    var cancelado = (p.estado === 'cancelado');
    var periodo = '';
    if (p.periodoInicio && p.periodoFin && p.periodoInicio !== p.periodoFin) {
      periodo = U.fecha(p.periodoInicio, 'diaMes') + ' → ' + U.fecha(p.periodoFin, 'diaMes');
    }

    return '<tr' + (cancelado ? ' class="muted"' : '') + '>' +
      '<td class="mono nowrap">' + esc(p.folio || '—') + '</td>' +
      '<td class="nowrap">' + esc(U.fecha(p.fecha, 'corto')) + '</td>' +
      '<td>' +
        '<div class="persona">' + U.avatar(s, 'sm') +
          '<div class="persona-txt">' +
            '<b>' + esc(nombreDe(s)) + '</b>' +
            '<span>' + esc((s && s.codigo) ? s.codigo : 'Sin código') + '</span>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' + esc(conceptoEtiqueta(p.concepto)) +
        (periodo ? '<div class="mini muted nowrap">' + esc(periodo) + '</div>' : '') +
      '</td>' +
      '<td class="nowrap">' + esc(nombrePlan(p.planId)) + '</td>' +
      '<td class="nowrap">' + esc(metodoEtiqueta(p.metodo)) + '</td>' +
      '<td class="nowrap bold txt-der">' + esc(U.dinero(p.monto)) + '</td>' +
      '<td>' + U.badge(info.etiqueta, info.clase.replace('badge-', '')) + '</td>' +
      '<td class="nowrap">' +
        '<div class="row-sm">' +
          '<button type="button" class="btn-icono btn-sm" data-recibo="' + esc(p.id) + '" title="Ver recibo" aria-label="Ver recibo">' + ic('ojo', 16) + '</button>' +
          '<button type="button" class="btn-icono btn-sm" data-imprimir="' + esc(p.id) + '" title="Imprimir recibo" aria-label="Imprimir recibo">' + ic('imprimir', 16) + '</button>' +
          (cancelado ? '' :
            '<button type="button" class="btn-icono btn-sm peligro" data-cancelar="' + esc(p.id) + '" title="Cancelar pago" aria-label="Cancelar pago">' + ic('x', 16) + '</button>') +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  function bloqueTabla() {
    var lista = ordenarPagos(pagosFiltrados());
    var total = lista.length;

    if (!total) {
      return '<div class="card"><div class="card-body">' +
        '<div class="empty">' +
          '<div class="empty-icono">' + ic('dinero', 34) + '</div>' +
          '<p class="empty-texto">No hay movimientos con estos filtros. Prueba con un periodo más amplio o limpia los filtros.</p>' +
        '</div>' +
      '</div></div>';
    }

    var cobrado = 0, pendiente = 0, cancelado = 0, i;
    for (i = 0; i < lista.length; i++) {
      var m = U.aNumero(lista[i].monto);
      var est = lista[i].estado || 'pagado';
      if (est === 'pagado') cobrado += m;
      else if (est === 'pendiente') pendiente += m;
      else cancelado += m;
    }

    var limite = Math.max(10, filtros.limite);
    var visibles = lista.slice(0, limite);

    var filas = '';
    for (i = 0; i < visibles.length; i++) filas += filaPago(visibles[i]);

    var pie = '' +
      '<div class="card-foot">' +
        '<div class="row wrap between" style="width:100%">' +
          '<div class="row-sm wrap">' +
            '<span class="pill pill-ok">' + esc('Cobrado ' + U.dinero(cobrado)) + '</span>' +
            (pendiente > 0 ? '<span class="pill pill-warn">' + esc('Pendiente ' + U.dinero(pendiente)) + '</span>' : '') +
            (cancelado > 0 ? '<span class="pill">' + esc('Cancelado ' + U.dinero(cancelado)) + '</span>' : '') +
          '</div>' +
          '<span class="mini muted">' + esc('Mostrando ' + visibles.length + ' de ' + total +
            (total === 1 ? ' movimiento' : ' movimientos')) + '</span>' +
        '</div>' +
      '</div>';

    var masBoton = (total > visibles.length)
      ? '<div class="row center mt"><button type="button" class="btn btn-outline btn-sm" data-mas>' +
        ic('flecha-abajo', 15) + ' Mostrar 60 más</button></div>'
      : '';

    return '' +
      '<div class="card">' +
        '<div class="table-wrap">' +
          '<table class="table table-compacta">' +
            '<thead><tr>' +
              '<th class="' + claseOrden('folio') + '" data-orden="folio">Folio</th>' +
              '<th class="' + claseOrden('fecha') + '" data-orden="fecha">Fecha</th>' +
              '<th class="' + claseOrden('socio') + '" data-orden="socio">Socio</th>' +
              '<th>Concepto</th>' +
              '<th>Plan</th>' +
              '<th>Método</th>' +
              '<th class="' + claseOrden('monto') + ' txt-der" data-orden="monto">Monto</th>' +
              '<th>Estado</th>' +
              '<th>Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' + filas + '</tbody>' +
          '</table>' +
        '</div>' +
        pie +
      '</div>' + masBoton;
  }

  function vistaMovimientos(usuario) {
    return barraFiltros(usuario) + '<div id="pg-tabla">' + bloqueTabla() + '</div>';
  }

  /* =============================================================
     7. Cobranza
     ============================================================= */

  function filaCobranza(fila, vencido) {
    var s = fila.socio;
    var dias = fila.dias;
    var texto = vencido
      ? (dias === -1 ? '1 día de atraso' : Math.abs(dias) + ' días de atraso')
      : (dias === 0 ? 'Vence hoy' : (dias === 1 ? 'Vence mañana' : 'Vence en ' + dias + ' días'));

    return '' +
      '<div class="pg-cobranza-item">' +
        U.avatar(s, '') +
        '<div class="persona-txt flex1">' +
          '<b>' + esc(nombreDe(s)) + '</b>' +
          '<span>' + esc((s.codigo ? s.codigo + ' · ' : '') + (fila.plan ? fila.plan.nombre : 'Sin plan') +
            ' · ' + U.dinero(fila.monto, 0)) + '</span>' +
        '</div>' +
        '<div class="stack-sm" style="min-width:150px">' +
          U.badge(texto, vencido ? 'danger' : 'warn') +
          '<span class="mini muted nowrap">' + esc('Venció el ' + U.fecha(fila.vence, 'corto')) + '</span>' +
        '</div>' +
        '<div class="pg-acciones">' +
          '<button type="button" class="btn btn-primary btn-sm" data-cobrar="' + esc(s.id) + '">' +
            ic('dinero', 15) + ' Cobrar</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-recordar="' + esc(s.id) + '">' +
            ic('whatsapp', 15) + ' Recordatorio</button>' +
        '</div>' +
      '</div>';
  }

  function bloqueCobranza(titulo, subtitulo, lista, vencido, mensajeVacio) {
    var total = U.suma(lista, 'monto');
    var cuerpo = '';

    if (!lista.length) {
      cuerpo = '<div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + ic('check', 32) + '</div>' +
        '<p class="empty-texto">' + esc(mensajeVacio) + '</p>' +
      '</div></div>';
    } else {
      cuerpo = '<div class="list-plana">';
      for (var i = 0; i < lista.length; i++) cuerpo += filaCobranza(lista[i], vencido);
      cuerpo += '</div>' +
        '<div class="card-foot">' +
          '<div class="row wrap between" style="width:100%">' +
            '<span class="bold">' + esc(lista.length + (lista.length === 1 ? ' socio' : ' socios')) + '</span>' +
            '<span class="bold ' + (vencido ? 'txt-error' : 'txt-warn') + '">' + esc(U.dinero(total, 0)) + '</span>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div class="card mb">' +
        '<div class="card-head">' +
          '<div>' +
            '<h3 class="card-title">' + ic(vencido ? 'alerta' : 'reloj', 18) + ' ' + esc(titulo) + '</h3>' +
            '<p class="card-sub">' + esc(subtitulo) + '</p>' +
          '</div>' +
          (lista.length ? '<div class="card-accion">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-recordar-todos="' + (vencido ? 'vencidos' : 'porvencer') + '">' +
              ic('campana', 15) + ' Recordar a todos</button>' +
          '</div>' : '') +
        '</div>' +
        cuerpo +
      '</div>';
  }

  function vistaCobranza() {
    var c = listasDeCobranza();
    return '' +
      bloqueCobranza(
        'Vencidos',
        'Membresías que ya pasaron su fecha de corte. Ordenados del más atrasado al más reciente.',
        c.vencidos, true,
        'Nadie con la membresía vencida. La cobranza está al día.'
      ) +
      bloqueCobranza(
        'Por vencer (7 días)',
        'Socios cuya membresía termina dentro de la próxima semana.',
        c.porVencer, false,
        'Ningún vencimiento en los próximos siete días.'
      );
  }

  /* =============================================================
     8. Análisis
     ============================================================= */

  function rangoAnalisis() {
    var hoy = U.hoy();
    var p = filtros.periodoAnalisis;
    if (p === 'mes') return { desde: primerDiaDelMes(U.mesActual()), hasta: hoy, texto: U.nombreMes(U.mesActual()) };
    if (p === 'trimestre') return { desde: U.sumaDias(hoy, -89), hasta: hoy, texto: 'Últimos 90 días' };
    if (p === 'todo') return { desde: '', hasta: hoy, texto: 'Todo el historial' };
    return { desde: U.sumaDias(hoy, -364), hasta: hoy, texto: 'Últimos 12 meses' };
  }

  function pagosEnRango(desde, hasta) {
    return DB.donde('pagos', function (p) {
      if (!esPagado(p)) return false;
      var f = (typeof p.fecha === 'string') ? p.fecha : '';
      if (!f) return false;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }

  function ingresosUltimos12Meses() {
    var base = primerDiaDelMes(U.mesActual());
    var datos = [];
    for (var i = 11; i >= 0; i--) {
      var mesKey = U.mesDe(U.sumaMeses(base, -i));
      var total = U.suma(pagosDelMes(mesKey), 'monto');
      datos.push({
        etiqueta: U.MESES_CORTOS[Number(mesKey.slice(5, 7)) - 1] + ' ' + mesKey.slice(2, 4),
        valor: Math.round(total)
      });
    }
    return datos;
  }

  function agregarPor(lista, obtenerClave, etiquetaDe, colorDe) {
    var mapa = {};
    var orden = [];
    for (var i = 0; i < lista.length; i++) {
      var clave = obtenerClave(lista[i]);
      if (clave === null || clave === undefined || clave === '') clave = 'sin_dato';
      if (!mapa[clave]) { mapa[clave] = 0; orden.push(clave); }
      mapa[clave] += U.aNumero(lista[i].monto);
    }
    var salida = [];
    for (var k = 0; k < orden.length; k++) {
      salida.push({
        etiqueta: etiquetaDe(orden[k]),
        valor: Math.round(mapa[orden[k]]),
        color: colorDe ? colorDe(orden[k]) : null
      });
    }
    return salida.sort(function (a, b) { return b.valor - a.valor; });
  }

  function tablaPorCoach(lista) {
    var coaches = DB.coaches();
    var porCoach = {};
    var i;

    for (i = 0; i < coaches.length; i++) {
      porCoach[coaches[i].id] = { coach: coaches[i], total: 0, pagos: 0, socios: {} };
    }
    porCoach.sin_coach = { coach: null, total: 0, pagos: 0, socios: {} };

    for (i = 0; i < lista.length; i++) {
      var p = lista[i];
      var s = socioDe(p);
      var clave = (s && s.coachId && porCoach[s.coachId]) ? s.coachId : 'sin_coach';
      porCoach[clave].total += U.aNumero(p.monto);
      porCoach[clave].pagos += 1;
      if (p.socioId) porCoach[clave].socios[p.socioId] = true;
    }

    var filas = [];
    for (var clave2 in porCoach) {
      if (!Object.prototype.hasOwnProperty.call(porCoach, clave2)) continue;
      var d = porCoach[clave2];
      var cuantos = 0;
      for (var sid in d.socios) {
        if (Object.prototype.hasOwnProperty.call(d.socios, sid)) cuantos++;
      }
      if (!d.pagos && clave2 === 'sin_coach') continue;
      filas.push({
        nombre: d.coach ? U.nombreCompleto(d.coach) : 'Sin coach asignado',
        coach: d.coach,
        total: d.total,
        pagos: d.pagos,
        socios: cuantos
      });
    }

    filas.sort(function (a, b) { return b.total - a.total; });
    return filas;
  }

  function vistaAnalisis() {
    var rango = rangoAnalisis();
    var lista = pagosEnRango(rango.desde, rango.hasta);
    var simbolo = ajustes().simbolo || '$';

    var periodos = [
      { id: 'mes', etiqueta: 'Este mes' },
      { id: 'trimestre', etiqueta: '90 días' },
      { id: 'anio', etiqueta: '12 meses' },
      { id: 'todo', etiqueta: 'Todo' }
    ];
    var chips = '<div class="chips">';
    for (var i = 0; i < periodos.length; i++) {
      chips += '<button type="button" class="chip' + (filtros.periodoAnalisis === periodos[i].id ? ' on' : '') +
        '" data-periodo="' + esc(periodos[i].id) + '">' + esc(periodos[i].etiqueta) + '</button>';
    }
    chips += '</div>';

    var barras = AG.Charts.barras(ingresosUltimos12Meses(), {
      alto: 280,
      prefijo: simbolo,
      valores: false,
      vacio: 'Todavía no hay pagos registrados para graficar.'
    });

    var porMetodo = agregarPor(lista, function (p) { return p.metodo; }, metodoEtiqueta, function (id) {
      var m = buscarEn(METODOS, id);
      return m ? m.color : null;
    });

    var porPlan = agregarPor(lista, function (p) { return p.planId; }, function (id) {
      return id === 'sin_dato' ? 'Sin plan' : nombrePlan(id);
    }, function (id) {
      var pl = planDe(id);
      return pl && pl.color ? pl.color : null;
    });

    var totalRango = U.suma(lista, 'monto');

    var donaMetodo = AG.Charts.dona(porMetodo, {
      alto: 240,
      prefijo: simbolo,
      centroTitulo: 'Total',
      centroValor: U.dinero(totalRango, 0),
      vacio: 'Sin cobros en este periodo.'
    });

    var donaPlan = AG.Charts.dona(porPlan, {
      alto: 240,
      prefijo: simbolo,
      centroTitulo: 'Planes',
      centroValor: String(porPlan.length),
      vacio: 'Sin cobros en este periodo.'
    });

    var filasCoach = tablaPorCoach(lista);
    var tablaCoach;
    if (!filasCoach.length) {
      tablaCoach = '<div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + ic('coach', 32) + '</div>' +
        '<p class="empty-texto">No hay ingresos en este periodo para repartir entre los coaches.</p>' +
      '</div></div>';
    } else {
      var cuerpoCoach = '';
      for (var c = 0; c < filasCoach.length; c++) {
        var f = filasCoach[c];
        var participacion = totalRango > 0 ? (f.total / totalRango) * 100 : 0;
        cuerpoCoach += '<tr>' +
          '<td>' +
            '<div class="persona">' + (f.coach ? U.avatar(f.coach, 'sm') : '') +
              '<div class="persona-txt"><b>' + esc(f.nombre) + '</b>' +
                '<span>' + esc(f.coach && f.coach.especialidad ? f.coach.especialidad : 'Sin especialidad registrada') + '</span>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td class="nowrap">' + esc(U.num(f.socios, 0)) + '</td>' +
          '<td class="nowrap">' + esc(U.num(f.pagos, 0)) + '</td>' +
          '<td class="nowrap bold txt-der">' + esc(U.dinero(f.total, 0)) + '</td>' +
          '<td style="min-width:130px">' +
            '<div class="bar"><div class="bar-fill" style="width:' + Math.max(2, Math.round(participacion)) + '%"></div></div>' +
            '<span class="mini muted">' + esc(U.pct(participacion, 1)) + '</span>' +
          '</td>' +
        '</tr>';
      }
      tablaCoach = '<div class="table-wrap"><table class="table table-compacta">' +
        '<thead><tr><th>Coach</th><th>Socios</th><th>Pagos</th><th class="txt-der">Ingreso</th><th>Participación</th></tr></thead>' +
        '<tbody>' + cuerpoCoach + '</tbody></table></div>';
    }

    return '' +
      '<div class="card mb">' +
        '<div class="card-head">' +
          '<div>' +
            '<h3 class="card-title">' + ic('grafica', 18) + ' Ingresos por mes</h3>' +
            '<p class="card-sub">Cobros efectivos de los últimos 12 meses.</p>' +
          '</div>' +
        '</div>' +
        '<div class="card-body">' + barras + '</div>' +
      '</div>' +

      '<div class="card mb">' +
        '<div class="card-head">' +
          '<div>' +
            '<h3 class="card-title">' + ic('filtro', 18) + ' Periodo de análisis</h3>' +
            '<p class="card-sub">' + esc(rango.texto + ' · ' + lista.length + (lista.length === 1 ? ' cobro' : ' cobros') +
              ' · ' + U.dinero(totalRango, 0)) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="card-body">' + chips + '</div>' +
      '</div>' +

      '<div class="grid g2 mb">' +
        '<div class="card">' +
          '<div class="card-head"><div>' +
            '<h3 class="card-title">' + ic('tarjeta', 18) + ' Por método de pago</h3>' +
            '<p class="card-sub">' + esc(rango.texto) + '</p>' +
          '</div></div>' +
          '<div class="card-body">' + donaMetodo + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-head"><div>' +
            '<h3 class="card-title">' + ic('escudo', 18) + ' Por plan</h3>' +
            '<p class="card-sub">' + esc(rango.texto) + '</p>' +
          '</div></div>' +
          '<div class="card-body">' + donaPlan + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><div>' +
          '<h3 class="card-title">' + ic('coach', 18) + ' Ingresos por coach</h3>' +
          '<p class="card-sub">Cobros de los socios que atiende cada coach · ' + esc(rango.texto) + '</p>' +
        '</div></div>' +
        tablaCoach +
      '</div>';
  }

  /* =============================================================
     9. Exportación a CSV
     ============================================================= */

  function celdaCSV(valor) {
    var t = (valor === null || valor === undefined) ? '' : String(valor);
    t = t.replace(/"/g, '""');
    return '"' + t + '"';
  }

  function exportarCSV() {
    var lista = ordenarPagos(pagosFiltrados());
    if (!lista.length) {
      U.toast('No hay movimientos que exportar con estos filtros.', 'warn');
      return;
    }

    var encabezados = ['Folio', 'Fecha', 'Socio', 'Código', 'Concepto', 'Plan', 'Método',
      'Monto', 'Estado', 'Periodo inicio', 'Periodo fin', 'Registró', 'Nota'];

    var lineas = [encabezados.map(celdaCSV).join(',')];

    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      var s = socioDe(p);
      var quien = DB.usuario(p.registradoPor);
      lineas.push([
        p.folio || '',
        p.fecha || '',
        nombreDe(s),
        (s && s.codigo) ? s.codigo : '',
        conceptoEtiqueta(p.concepto),
        nombrePlan(p.planId),
        metodoEtiqueta(p.metodo),
        U.aNumero(p.monto).toFixed(2),
        estadoInfo(p.estado).etiqueta,
        p.periodoInicio || '',
        p.periodoFin || '',
        quien ? U.nombreCompleto(quien) : '',
        p.nota || ''
      ].map(celdaCSV).join(','));
    }

    var nombre = 'alliance-gym-pagos-' + U.hoy() + '.csv';
    // El BOM permite que Excel abra las tildes correctamente.
    U.descargar(nombre, '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
    U.toast('Se exportaron ' + lista.length + (lista.length === 1 ? ' movimiento.' : ' movimientos.'), 'ok');
  }

  /* =============================================================
     10. Recibo
     ============================================================= */

  function datosRecibo(pago) {
    var conf = ajustes();
    var socio = socioDe(pago);
    var plan = planDe(pago.planId);
    var quien = DB.usuario(pago.registradoPor);
    var cancelado = (pago.estado === 'cancelado');
    var pendiente = (pago.estado === 'pendiente');

    var periodo = '';
    if (pago.periodoInicio && pago.periodoFin && pago.periodoInicio !== pago.periodoFin) {
      periodo = U.fecha(pago.periodoInicio, 'corto') + ' al ' + U.fecha(pago.periodoFin, 'corto');
    } else if (pago.periodoInicio) {
      periodo = U.fecha(pago.periodoInicio, 'corto');
    } else {
      periodo = 'No aplica';
    }

    return {
      conf: conf,
      socio: socio,
      plan: plan,
      quien: quien,
      cancelado: cancelado,
      pendiente: pendiente,
      periodo: periodo,
      sello: cancelado ? 'CANCELADO' : (pendiente ? 'PENDIENTE' : 'PAGADO')
    };
  }

  /** Cuerpo del recibo con las clases del sistema (modal e impresión). */
  function reciboHTML(pago) {
    var d = datosRecibo(pago);
    var conf = d.conf;

    var contacto = [];
    if (conf.direccion) contacto.push(esc(conf.direccion));
    if (conf.telefono) contacto.push('Tel. ' + esc(conf.telefono));
    if (conf.email) contacto.push(esc(conf.email));
    if (conf.horario) contacto.push(esc(conf.horario));

    return '' +
      '<div class="hoja">' +
        '<div class="hoja-head">' +
          '<div style="min-width:0">' +
            '<h2 style="margin:0 0 2px;font-size:20px;letter-spacing:-.02em">' + esc(conf.nombreGym || 'Alliance Gym') + '</h2>' +
            (conf.lema ? '<p class="mini muted" style="margin:0 0 6px">' + esc(conf.lema) + '</p>' : '') +
            '<p class="mini muted" style="margin:0;line-height:1.6">' + contacto.join('<br>') + '</p>' +
          '</div>' +
          '<div class="txt-der">' +
            '<div class="dato"><span class="dato-label">Recibo de pago</span>' +
              '<span class="dato-val mono" style="font-size:17px">' + esc(pago.folio || 'Sin folio') + '</span></div>' +
            '<p class="mini muted" style="margin:6px 0 0">' + esc(U.fecha(pago.fecha, 'largo')) + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="datos-grid mb">' +
          '<div class="dato"><span class="dato-label">Socio</span>' +
            '<span class="dato-val">' + esc(nombreDe(d.socio)) + '</span></div>' +
          '<div class="dato"><span class="dato-label">Código</span>' +
            '<span class="dato-val mono">' + esc((d.socio && d.socio.codigo) ? d.socio.codigo : '—') + '</span></div>' +
          '<div class="dato"><span class="dato-label">Plan</span>' +
            '<span class="dato-val">' + esc(d.plan ? d.plan.nombre : 'Sin plan') + '</span></div>' +
          '<div class="dato"><span class="dato-label">Método de pago</span>' +
            '<span class="dato-val">' + esc(metodoEtiqueta(pago.metodo)) + '</span></div>' +
        '</div>' +

        '<table class="pg-recibo-tabla mb">' +
          '<thead><tr>' +
            '<th>Concepto</th><th>Periodo cubierto</th><th class="pg-der">Importe</th>' +
          '</tr></thead>' +
          '<tbody><tr>' +
            '<td><b>' + esc(conceptoEtiqueta(pago.concepto)) + '</b>' +
              (pago.nota ? '<div class="mini muted">' + esc(pago.nota) + '</div>' : '') + '</td>' +
            '<td>' + esc(d.periodo) + '</td>' +
            '<td class="pg-der bold">' + esc(U.dinero(pago.monto)) + '</td>' +
          '</tr></tbody>' +
        '</table>' +

        '<div class="row between wrap mb" style="align-items:flex-end;gap:16px">' +
          '<div class="pg-letra flex1">' +
            '<span class="dato-label">Importe con letra</span><br>' +
            '<b>' + esc(numeroALetras(pago.monto)) + '</b>' +
          '</div>' +
          '<div class="txt-der">' +
            '<span class="dato-label">Total</span>' +
            '<div class="pg-total">' + esc(U.dinero(pago.monto)) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="row between wrap" style="align-items:flex-end;gap:16px">' +
          '<div class="stack-sm">' +
            '<div class="dato"><span class="dato-label">Registró</span>' +
              '<span class="dato-val">' + esc(d.quien ? U.nombreCompleto(d.quien) : 'Recepción') + '</span></div>' +
            '<p class="mini muted" style="max-width:360px;margin:0">' +
              'Gracias por entrenar con nosotros. Conserva este comprobante: es tu constancia de pago y ' +
              'te lo pediremos para cualquier aclaración.</p>' +
          '</div>' +
          '<div class="pg-sello' + (d.cancelado ? ' pg-anulado' : '') + '">' + esc(d.sello) + '</div>' +
        '</div>' +
      '</div>';
  }

  /** Documento HTML autónomo (para el botón Descargar). */
  function reciboDocumento(pago) {
    var conf = ajustes();
    var titulo = 'Recibo ' + (pago.folio || '') + ' · ' + (conf.nombreGym || 'Alliance Gym');
    var css =
      'body{margin:0;padding:24px;background:#f4f4f5;color:#111;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
      '.hoja{background:#fff;border:1px solid #ddd;border-radius:14px;padding:28px;max-width:760px;margin:0 auto}' +
      '.hoja-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;' +
      'padding-bottom:16px;border-bottom:2px solid #e4322b;margin-bottom:18px}' +
      '.mini{font-size:11.5px}.muted{color:#666}.bold,b{font-weight:700}.mb{margin-bottom:18px}' +
      '.mono{font-family:ui-monospace,Consolas,monospace}.txt-der{text-align:right}.flex1{flex:1 1 auto}' +
      '.row{display:flex;gap:12px}.between{justify-content:space-between}.wrap{flex-wrap:wrap}' +
      '.stack-sm{display:flex;flex-direction:column;gap:6px}' +
      '.datos-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}' +
      '.dato{display:flex;flex-direction:column}' +
      '.dato-label{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#777}' +
      '.dato-val{font-size:14px;font-weight:700}' +
      '.pg-recibo-tabla{width:100%;border-collapse:collapse;font-size:13px}' +
      '.pg-recibo-tabla th,.pg-recibo-tabla td{padding:9px 10px;border-bottom:1px solid #e3e3e3;text-align:left;vertical-align:top}' +
      '.pg-recibo-tabla th{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#777}' +
      '.pg-recibo-tabla .pg-der{text-align:right}' +
      '.pg-total{font-size:20px;font-weight:800}' +
      '.pg-letra{border:1px dashed #bbb;border-radius:8px;padding:9px 12px;font-size:12.5px}' +
      '.pg-sello{display:inline-block;padding:6px 20px;border:3px solid #16a34a;color:#16a34a;' +
      'border-radius:10px;font-weight:800;letter-spacing:.2em;font-size:15px;transform:rotate(-7deg)}' +
      '.pg-sello.pg-anulado{border-color:#dc2626;color:#dc2626}' +
      '@media print{body{background:#fff;padding:0}.hoja{border:0}}';

    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(titulo) + '</title><style>' + css + '</style></head><body>' +
      reciboHTML(pago) + '</body></html>';
  }

  /**
   * Muestra el recibo de un pago en un modal, con Imprimir y Descargar.
   * @param {String} pagoId
   */
  function recibo(pagoId) {
    inyectarEstilo();
    var pago = DB.buscar('pagos', pagoId);
    if (!pago) {
      U.toast('No encontramos ese pago en la base.', 'error');
      return null;
    }

    var usuario = AG.Auth.actual();
    if (usuario && usuario.rol !== 'director' && !AG.Auth.puedeVer(usuario, pago.socioId)) {
      U.toast('No tienes permiso para ver este recibo.', 'error');
      return null;
    }

    var titulo = 'Recibo ' + (pago.folio || '');

    return U.modal({
      titulo: titulo,
      ancho: 'lg',
      cuerpo: reciboHTML(pago),
      acciones: [
        { texto: 'Cerrar', clase: 'btn-ghost' },
        {
          texto: 'Descargar',
          clase: 'btn-outline',
          icono: 'descargar',
          onClick: function () {
            var nombre = 'recibo-' + (pago.folio || pago.id) + '.html';
            U.descargar(nombre, reciboDocumento(pago), 'text/html;charset=utf-8');
            U.toast('Recibo descargado.', 'ok');
            return false;
          }
        },
        {
          texto: 'Imprimir',
          clase: 'btn-primary',
          icono: 'imprimir',
          onClick: function () {
            U.imprimir(reciboHTML(pago), titulo);
            return false;
          }
        }
      ]
    });
  }

  /** Imprime directamente, sin abrir el modal. */
  function imprimirRecibo(pagoId) {
    inyectarEstilo();
    var pago = DB.buscar('pagos', pagoId);
    if (!pago) {
      U.toast('No encontramos ese pago en la base.', 'error');
      return;
    }
    U.imprimir(reciboHTML(pago), 'Recibo ' + (pago.folio || ''));
  }

  /* =============================================================
     11. Modal de cobro
     ============================================================= */

  /** Tarjeta fija con los datos del socio dentro del modal. */
  function tarjetaSocio(socio) {
    var estado = AG.Calc.estadoMembresia(socio);
    var plan = planDe(socio.planId);
    return '' +
      '<div class="card card-suave mb"><div class="card-body">' +
        '<div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">' +
          U.avatar(socio, 'lg') +
          '<div class="persona-txt flex1">' +
            '<b style="font-size:15px">' + esc(U.nombreCompleto(socio)) + '</b>' +
            '<span>' + esc((socio.codigo ? socio.codigo + ' · ' : '') + (plan ? plan.nombre : 'Sin plan')) + '</span>' +
          '</div>' +
          '<div class="stack-sm txt-der">' +
            U.badge(estado.texto, estado.clase.replace('badge-', '')) +
            '<span class="mini muted nowrap">' +
              esc(socio.fechaVencimiento ? 'Vence ' + U.fecha(socio.fechaVencimiento, 'corto') : 'Sin vigencia registrada') +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  }

  function opcionesPlanes(planIdActual) {
    var planes = DB.donde('planes', function (p) { return p.activo !== false; });
    planes = U.ordenar(planes, 'precio', 'asc');
    if (!planes.length) planes = DB.get('planes');

    var html = '';
    for (var i = 0; i < planes.length; i++) {
      var p = planes[i];
      html += '<option value="' + esc(p.id) + '"' + (p.id === planIdActual ? ' selected' : '') + '>' +
        esc(p.nombre + ' · ' + U.dinero(p.precio, 0) + ' · ' + duracionPlan(p)) + '</option>';
    }
    return html;
  }

  function tarjetasMetodo(seleccionado) {
    var html = '<div class="radio-cards dos">';
    for (var i = 0; i < METODOS.length; i++) {
      var m = METODOS[i];
      var activo = (m.id === seleccionado);
      html += '<label class="radio-card' + (activo ? ' on' : '') + '" data-metodo="' + esc(m.id) + '">' +
        '<input type="radio" name="metodo" value="' + esc(m.id) + '"' + (activo ? ' checked' : '') + '>' +
        ic(m.icono, 22) +
        '<b>' + esc(m.etiqueta) + '</b>' +
        '<span>' + esc(m.pista) + '</span>' +
      '</label>';
    }
    return html + '</div>';
  }

  function formularioCobro(socio) {
    var hoy = U.hoy();
    var plan = planDe(socio.planId) || DB.get('planes')[0] || null;

    return '' +
      tarjetaSocio(socio) +
      '<form id="pg-form" autocomplete="off">' +
        '<input type="hidden" name="socioId" value="' + esc(socio.id) + '">' +
        '<div class="form-grid dos mb">' +
          '<div class="field">' +
            '<label class="label" for="pg-f-concepto">Concepto</label>' +
            '<select class="select" id="pg-f-concepto" name="concepto">' +
              CONCEPTOS.map(function (c) {
                return '<option value="' + esc(c.id) + '"' + (c.id === 'mensualidad' ? ' selected' : '') + '>' +
                  esc(c.etiqueta) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="pg-f-plan">Plan</label>' +
            '<select class="select" id="pg-f-plan" name="planId">' + opcionesPlanes(plan ? plan.id : '') + '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="pg-f-descuento">Descuento</label>' +
            '<input class="input" type="number" id="pg-f-descuento" name="descuento" min="0" step="10" value="0">' +
            '<span class="help">Se resta del precio de lista.</span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="pg-f-monto">Monto a cobrar</label>' +
            '<input class="input" type="number" id="pg-f-monto" name="monto" min="0" step="0.01" value="' +
              esc(plan ? U.aNumero(plan.precio) : 0) + '" required>' +
            '<span class="help" id="pg-f-precio-base">Precio de lista: ' +
              esc(U.dinero(plan ? plan.precio : 0, 0)) + '</span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="pg-f-fecha">Fecha del cobro</label>' +
            '<input class="input" type="date" id="pg-f-fecha" name="fecha" value="' + esc(hoy) + '" max="' + esc(hoy) + '" required>' +
          '</div>' +
          '<div class="field">' +
            '<label class="label">Método de pago</label>' +
            tarjetasMetodo('efectivo') +
          '</div>' +
        '</div>' +

        '<div class="field mb">' +
          '<label class="label" for="pg-f-nota">Nota (opcional)</label>' +
          '<textarea class="textarea" id="pg-f-nota" name="nota" rows="2" ' +
            'placeholder="Promoción de referido, pago adelantado, motivo del descuento…"></textarea>' +
        '</div>' +

        '<div class="aviso aviso-info" id="pg-f-resumen"></div>' +
      '</form>';
  }

  /**
   * Modal de cobro. Sin socioId, primero muestra el buscador de socios.
   * @param {String|null} socioId
   */
  function registrar(socioId) {
    inyectarEstilo();

    var usuario = AG.Auth.actual();
    if (!puedeCobrar(usuario)) {
      U.toast('Solo dirección y los coaches pueden registrar cobros.', 'error');
      return;
    }

    if (!socioId) {
      buscadorDeSocios(usuario, function (id) { registrar(id); });
      return;
    }

    var socio = DB.usuario(socioId);
    if (!socio || socio.rol !== 'socio') {
      U.toast('No encontramos a ese socio.', 'error');
      return;
    }
    if (!AG.Auth.puedeVer(usuario, socio.id)) {
      U.toast('Este socio no está asignado a ti.', 'error');
      return;
    }

    var api = U.modal({
      titulo: 'Registrar cobro',
      ancho: 'lg',
      cuerpo: formularioCobro(socio),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: 'Registrar cobro',
          clase: 'btn-primary',
          icono: 'check',
          onClick: function (modalApi) {
            guardarCobro(socio, modalApi);
            return false;
          }
        }
      ],
      onOpen: function (root, modalApi) {
        engancharFormularioCobro(root, socio, modalApi);
      }
    });

    return api;
  }

  /** Cálculo vivo del periodo cubierto y de la nueva vigencia. */
  function calcularPeriodo(socio, root) {
    var concepto = U.$('#pg-f-concepto', root);
    var planSel = U.$('#pg-f-plan', root);
    var fechaSel = U.$('#pg-f-fecha', root);

    var conceptoId = concepto ? concepto.value : 'mensualidad';
    var plan = planDe(planSel ? planSel.value : '');
    var fecha = (fechaSel && fechaSel.value) ? fechaSel.value : U.hoy();

    if (!mueveVigencia(conceptoId)) {
      return {
        mueve: false,
        plan: plan,
        fecha: fecha,
        inicio: fecha,
        fin: fecha
      };
    }

    var inicio = inicioDeVigencia(socio, fecha);
    var fin = finDeVigencia(inicio, plan);
    return { mueve: true, plan: plan, fecha: fecha, inicio: inicio, fin: fin };
  }

  function pintarResumen(socio, root) {
    var caja = U.$('#pg-f-resumen', root);
    if (!caja) return;

    var p = calcularPeriodo(socio, root);
    var montoEl = U.$('#pg-f-monto', root);
    var monto = montoEl ? U.aNumero(montoEl.value) : 0;

    if (!p.mueve) {
      caja.className = 'aviso aviso-warn';
      caja.innerHTML = ic('info', 18) +
        '<div><b>Este cobro no modifica la vigencia.</b><br>' +
        '<span class="mini">Se registrará ' + esc(U.dinero(monto)) + ' con fecha ' +
        esc(U.fecha(p.fecha, 'corto')) + '. La membresía del socio queda igual.</span></div>';
      return;
    }

    caja.className = 'aviso aviso-ok';
    caja.innerHTML = ic('check', 18) +
      '<div><b>Nueva vigencia hasta el ' + esc(U.fecha(p.fin, 'corto')) + '</b><br>' +
      '<span class="mini">Periodo cubierto: ' + esc(U.fecha(p.inicio, 'corto')) + ' al ' +
      esc(U.fecha(p.fin, 'corto')) + ' · ' + esc(p.plan ? duracionPlan(p.plan) : 'sin plan') +
      ' · ' + esc(U.dinero(monto)) + '</span></div>';
  }

  function engancharFormularioCobro(root, socio, modalApi) {
    var selPlan = U.$('#pg-f-plan', root);
    var selConcepto = U.$('#pg-f-concepto', root);
    var inpDescuento = U.$('#pg-f-descuento', root);
    var inpMonto = U.$('#pg-f-monto', root);
    var ayudaBase = U.$('#pg-f-precio-base', root);

    function precioBase() {
      var plan = planDe(selPlan ? selPlan.value : '');
      if (!plan) return 0;
      var concepto = selConcepto ? selConcepto.value : 'mensualidad';
      if (concepto === 'inscripcion') return U.aNumero(plan.inscripcion);
      return U.aNumero(plan.precio);
    }

    function refrescarBase() {
      var base = precioBase();
      if (ayudaBase) ayudaBase.textContent = 'Precio de lista: ' + U.dinero(base, 0);
      var desc = inpDescuento ? Math.max(0, U.aNumero(inpDescuento.value)) : 0;
      if (desc > base) { desc = base; if (inpDescuento) inpDescuento.value = String(desc); }
      if (inpMonto) inpMonto.value = String(Math.max(0, base - desc));
      pintarResumen(socio, root);
    }

    if (selPlan) selPlan.addEventListener('change', refrescarBase);
    if (selConcepto) selConcepto.addEventListener('change', refrescarBase);

    if (inpDescuento) {
      inpDescuento.addEventListener('input', function () {
        var base = precioBase();
        var desc = Math.max(0, U.aNumero(inpDescuento.value));
        if (desc > base) desc = base;
        if (inpMonto) inpMonto.value = String(Math.max(0, base - desc));
        pintarResumen(socio, root);
      });
    }

    if (inpMonto) {
      inpMonto.addEventListener('input', function () {
        var base = precioBase();
        var monto = Math.max(0, U.aNumero(inpMonto.value));
        if (inpDescuento) inpDescuento.value = String(Math.max(0, base - monto));
        pintarResumen(socio, root);
      });
    }

    var inpFecha = U.$('#pg-f-fecha', root);
    if (inpFecha) inpFecha.addEventListener('change', function () { pintarResumen(socio, root); });

    // Las tarjetas de método marcan su estado visual sin depender de :has()
    U.delegar(root, 'change', 'input[name="metodo"]', function () {
      var tarjetas = U.$$('.radio-card', root);
      for (var i = 0; i < tarjetas.length; i++) {
        var radio = tarjetas[i].querySelector('input[name="metodo"]');
        tarjetas[i].classList.toggle('on', !!(radio && radio.checked));
      }
    });

    // Enter dentro del formulario equivale a pulsar "Registrar cobro"
    var form = U.$('#pg-form', root);
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        guardarCobro(socio, modalApi);
      });
    }

    refrescarBase();
  }

  function guardarCobro(socio, modalApi) {
    var root = modalApi && modalApi.root ? modalApi.root : document;
    var form = U.$('#pg-form', root);
    if (!form) return;

    var datos = U.formToObject(form);
    var monto = U.aNumero(datos.monto);
    var concepto = datos.concepto || 'mensualidad';
    var metodo = datos.metodo || 'efectivo';
    var fecha = datos.fecha || U.hoy();

    if (!(monto > 0)) {
      U.toast('El monto debe ser mayor que cero.', 'error');
      var campo = U.$('#pg-f-monto', root);
      if (campo) { campo.classList.add('error'); campo.focus(); }
      return;
    }
    if (!buscarEn(METODOS, metodo)) metodo = 'efectivo';
    if (fecha > U.hoy()) {
      U.toast('La fecha del cobro no puede ser futura.', 'error');
      return;
    }

    var periodo = calcularPeriodo(socio, root);
    var plan = periodo.plan;
    var usuario = AG.Auth.actual();

    var pago = {
      socioId: socio.id,
      planId: plan ? plan.id : (socio.planId || ''),
      monto: Math.round(monto * 100) / 100,
      metodo: metodo,
      fecha: fecha,
      periodoInicio: periodo.inicio,
      periodoFin: periodo.fin,
      concepto: concepto,
      estado: 'pagado',
      folio: DB.folioPago(),
      registradoPor: usuario ? usuario.id : '',
      nota: datos.nota || ''
    };

    var guardado = DB.insertar('pagos', pago);
    if (!guardado) {
      U.toast('No se pudo registrar el cobro. Intenta de nuevo.', 'error');
      return;
    }

    // Vigencia y estado del socio (la inscripción y las ventas no la mueven)
    var cambios = {};
    if (periodo.mueve) {
      cambios.fechaVencimiento = periodo.fin;
      cambios.estado = 'activo';
      if (plan && plan.id) cambios.planId = plan.id;
    }
    if (Object.keys(cambios).length) DB.actualizar('usuarios', socio.id, cambios);

    // Aviso al socio
    var conf = ajustes();
    DB.notificar(socio.id, {
      titulo: 'Pago recibido',
      cuerpo: 'Registramos tu pago de ' + U.dinero(guardado.monto) + ' por ' +
        conceptoEtiqueta(concepto).toLowerCase() + ' (folio ' + guardado.folio + ').' +
        (periodo.mueve ? ' Tu membresía queda vigente hasta el ' + U.fecha(periodo.fin, 'corto') + '.' : ''),
      tipo: 'pago',
      link: '#/socio/membresia'
    });

    if (modalApi && typeof modalApi.cerrar === 'function') modalApi.cerrar();

    U.toast('Cobro registrado · folio ' + guardado.folio + ' · ' + U.dinero(guardado.monto), 'ok');
    AG.Router.refrescar();

    U.confirmar(
      'El cobro quedó registrado con el folio ' + guardado.folio + '. ¿Quieres imprimir el recibo ahora?',
      'Pago registrado',
      { textoOk: 'Sí, imprimir', textoCancelar: 'Ahora no' }
    ).then(function (si) {
      if (si) recibo(guardado.id);
    });

    // Se usa el nombre del gimnasio para dejar rastro claro en la consola de la demo
    if (window.console && typeof window.console.info === 'function') {
      window.console.info((conf.nombreGym || 'Alliance Gym') + ': cobro ' + guardado.folio + ' registrado.');
    }
  }

  /* =============================================================
     12. Buscador de socios (cuando no llega socioId)
     ============================================================= */

  function filaBuscador(socio) {
    var estado = AG.Calc.estadoMembresia(socio);
    var plan = planDe(socio.planId);
    return '<button type="button" class="list-item clickable" data-elegir="' + esc(socio.id) + '" style="width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--borde);cursor:pointer">' +
      U.avatar(socio, 'sm') +
      '<div class="list-item-main">' +
        '<b>' + esc(U.nombreCompleto(socio)) + '</b>' +
        '<span class="mini muted">' + esc((socio.codigo ? socio.codigo + ' · ' : '') +
          (plan ? plan.nombre : 'Sin plan')) + '</span>' +
      '</div>' +
      '<div class="list-item-side">' + U.badge(estado.texto, estado.clase.replace('badge-', '')) + '</div>' +
    '</button>';
  }

  function listaBuscador(socios, texto) {
    var q = U.normalizar(texto);
    var filtrados = socios;

    if (q) {
      filtrados = socios.filter(function (s) {
        var base = U.nombreCompleto(s) + ' ' + (s.codigo || '') + ' ' + (s.telefono || '') + ' ' + (s.email || '');
        return U.normalizar(base).indexOf(q) >= 0;
      });
    }

    if (!filtrados.length) {
      return '<div class="empty">' +
        '<div class="empty-icono">' + ic('buscar', 32) + '</div>' +
        '<p class="empty-texto">Ningún socio coincide con esa búsqueda.</p>' +
      '</div>';
    }

    var html = '<div class="list list-plana">';
    for (var i = 0; i < Math.min(filtrados.length, 40); i++) html += filaBuscador(filtrados[i]);
    html += '</div>';

    if (filtrados.length > 40) {
      html += '<p class="mini muted mt">Se muestran los primeros 40 de ' + filtrados.length +
        '. Escribe para afinar la búsqueda.</p>';
    }
    return html;
  }

  function buscadorDeSocios(usuario, alElegir) {
    var socios = sociosVisibles(usuario).filter(function (s) { return s.estado !== 'baja'; });

    socios = U.ordenar(socios, function (s) {
      // Primero los que deben, después el resto en orden alfabético
      var prioridad = s.estado === 'vencido' ? '0' : (s.estado === 'activo' ? '1' : '2');
      return prioridad + U.normalizar(U.nombreCompleto(s));
    }, 'asc');

    if (!socios.length) {
      U.toast('No hay socios disponibles para cobrar.', 'warn');
      return;
    }

    U.modal({
      titulo: 'Elige al socio',
      ancho: 'md',
      cuerpo: '<div class="field mb">' +
          '<div class="input-icono">' + ic('buscar', 17) +
            '<input class="input" type="search" id="pg-buscar-socio" placeholder="Nombre, código o teléfono" autocomplete="off">' +
          '</div>' +
        '</div>' +
        '<div id="pg-lista-socios" class="scroll-y" style="max-height:52vh">' + listaBuscador(socios, '') + '</div>',
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root, api) {
        var caja = U.$('#pg-lista-socios', root);
        var campo = U.$('#pg-buscar-socio', root);

        if (campo && caja) {
          campo.addEventListener('input', U.debounce(function () {
            caja.innerHTML = listaBuscador(socios, campo.value);
          }, 180));
        }

        U.delegar(root, 'click', '[data-elegir]', function (e, el) {
          var id = el.getAttribute('data-elegir');
          api.cerrar();
          if (typeof alElegir === 'function') alElegir(id);
        });
      }
    });
  }

  /* =============================================================
     13. Cancelar un pago
     ============================================================= */

  function cancelarPago(pagoId) {
    var usuario = AG.Auth.actual();
    if (!usuario || usuario.rol !== 'director') {
      U.toast('Solo dirección puede cancelar un pago.', 'error');
      return;
    }

    var pago = DB.buscar('pagos', pagoId);
    if (!pago) {
      U.toast('No encontramos ese pago.', 'error');
      return;
    }
    if (pago.estado === 'cancelado') {
      U.toast('Ese pago ya estaba cancelado.', 'info');
      return;
    }

    var socio = socioDe(pago);
    var mensaje = 'Vas a cancelar el pago ' + (pago.folio || '') + ' de ' + U.dinero(pago.monto) +
      ' a nombre de ' + nombreDe(socio) + '.\n' +
      'El movimiento queda marcado como cancelado y se recalculará la vigencia del socio.';

    U.confirmar(mensaje, 'Cancelar pago', {
      peligro: true,
      textoOk: 'Sí, cancelar el pago',
      textoCancelar: 'No, dejarlo como está'
    }).then(function (si) {
      if (!si) return;

      DB.actualizar('pagos', pago.id, {
        estado: 'cancelado',
        nota: (pago.nota ? pago.nota + ' · ' : '') + 'Cancelado el ' + U.fecha(U.hoy(), 'corto') +
          ' por ' + U.nombreCompleto(usuario)
      });

      // Deja fechaVencimiento y estado alineados con los pagos que siguen vigentes
      DB.recalcularEstadoSocios();

      if (socio) {
        DB.notificar(socio.id, {
          titulo: 'Pago cancelado',
          cuerpo: 'Se canceló el pago con folio ' + (pago.folio || '') + ' por ' + U.dinero(pago.monto) +
            '. Si crees que es un error, acércate a recepción.',
          tipo: 'pago',
          link: '#/socio/membresia'
        });
      }

      U.toast('Pago cancelado y vigencias recalculadas.', 'ok');
      AG.Router.refrescar();
    });
  }

  /* =============================================================
     14. Recordatorios de cobranza
     ============================================================= */

  function telefonoLimpio(socio) {
    var t = (socio && socio.telefono) ? String(socio.telefono) : '';
    var digitos = t.replace(/\D/g, '');
    if (!digitos) return '';
    if (digitos.length === 10) return '52' + digitos;    // celular nacional
    return digitos;
  }

  function mensajeRecordatorio(fila) {
    var conf = ajustes();
    var gym = conf.nombreGym || 'Alliance Gym';
    var socio = fila.socio;
    var nombre = (socio.nombre || U.nombreCompleto(socio)).split(' ')[0];
    var plan = fila.plan ? fila.plan.nombre : 'tu plan';
    var monto = U.dinero(fila.monto, 0);

    if (fila.dias < 0) {
      var atraso = Math.abs(fila.dias);
      return 'Hola ' + nombre + ', te saludamos de ' + gym + '. ' +
        'Tu membresía ' + plan + ' venció el ' + U.fecha(fila.vence, 'corto') +
        ' (' + atraso + (atraso === 1 ? ' día' : ' días') + ' de atraso). ' +
        'La renovación es de ' + monto + ' y puedes cubrirla en recepción o por transferencia. ' +
        'Nos dará mucho gusto verte de vuelta en el gimnasio. ¡Gracias!';
    }

    var cuando = fila.dias === 0 ? 'vence hoy' :
      (fila.dias === 1 ? 'vence mañana' : 'vence en ' + fila.dias + ' días');

    return 'Hola ' + nombre + ', te saludamos de ' + gym + '. ' +
      'Te recordamos que tu membresía ' + plan + ' ' + cuando +
      ' (' + U.fecha(fila.vence, 'corto') + '). ' +
      'La renovación es de ' + monto + ' y puedes adelantarla cuando gustes para no perder tu continuidad. ' +
      '¡Gracias por entrenar con nosotros!';
  }

  function claveRecordatorio(socioId) {
    return 'recordatorio-pago:' + socioId + ':' + U.hoy();
  }

  function yaRecordadoHoy(socioId) {
    var lista = DB.get('notificaciones');
    var clave = claveRecordatorio(socioId);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].usuarioId === socioId && lista[i].clave === clave) return true;
    }
    return false;
  }

  function crearNotificacionRecordatorio(fila) {
    if (yaRecordadoHoy(fila.socio.id)) return false;
    var vencido = fila.dias < 0;
    DB.notificar(fila.socio.id, {
      titulo: vencido ? 'Tu membresía está vencida' : 'Tu membresía está por vencer',
      cuerpo: vencido
        ? 'Tu membresía venció el ' + U.fecha(fila.vence, 'corto') + '. La renovación es de ' +
          U.dinero(fila.monto, 0) + '. Te esperamos en recepción.'
        : 'Tu membresía vence el ' + U.fecha(fila.vence, 'corto') + '. La renovación es de ' +
          U.dinero(fila.monto, 0) + '. Puedes adelantarla cuando gustes.',
      tipo: 'pago',
      link: '#/socio/membresia',
      clave: claveRecordatorio(fila.socio.id)
    });
    return true;
  }

  function filaCobranzaDe(socioId) {
    var c = listasDeCobranza();
    var todas = c.vencidos.concat(c.porVencer);
    for (var i = 0; i < todas.length; i++) {
      if (todas[i].socio.id === socioId) return todas[i];
    }
    return null;
  }

  function recordatorio(socioId) {
    var fila = filaCobranzaDe(socioId);
    if (!fila) {
      U.toast('Ese socio ya no está en la lista de cobranza.', 'info');
      AG.Router.refrescar();
      return;
    }

    var creada = crearNotificacionRecordatorio(fila);
    var telefono = telefonoLimpio(fila.socio);
    var texto = mensajeRecordatorio(fila);

    if (!telefono) {
      U.toast(creada
        ? 'Aviso creado en la app. El socio no tiene teléfono para WhatsApp.'
        : 'El socio ya tenía un aviso hoy y no tiene teléfono registrado.', 'warn');
      AG.Router.refrescar();
      return;
    }

    var url = 'https://wa.me/' + telefono + '?text=' + encodeURIComponent(texto);
    try {
      window.open(url, '_blank', 'noopener');
      U.toast(creada
        ? 'Aviso creado y WhatsApp abierto con el mensaje listo para enviar.'
        : 'WhatsApp abierto. El socio ya tenía un aviso registrado hoy.', 'ok');
    } catch (e) {
      U.toast('No se pudo abrir WhatsApp en este navegador.', 'error');
    }

    AG.Router.refrescar();
  }

  function recordarATodos(cual) {
    var c = listasDeCobranza();
    var lista = (cual === 'vencidos') ? c.vencidos : c.porVencer;
    var titulo = (cual === 'vencidos') ? 'Recordar a los vencidos' : 'Recordar a los que están por vencer';

    if (!lista.length) {
      U.toast('No hay socios en esa lista.', 'info');
      return;
    }

    U.confirmar(
      'Se creará un aviso dentro de la app para ' + lista.length +
      (lista.length === 1 ? ' socio.' : ' socios.') + '\n' +
      'No se abrirá WhatsApp para evitar decenas de pestañas: usa el botón «Recordatorio» de cada socio cuando quieras escribirle.',
      titulo,
      { textoOk: 'Crear los avisos', textoCancelar: 'Cancelar' }
    ).then(function (si) {
      if (!si) return;

      var creados = 0, repetidos = 0;
      for (var i = 0; i < lista.length; i++) {
        if (crearNotificacionRecordatorio(lista[i])) creados++;
        else repetidos++;
      }

      if (!creados) {
        U.toast('Todos esos socios ya tenían su aviso de hoy.', 'info');
      } else {
        U.toast('Se crearon ' + creados + (creados === 1 ? ' aviso' : ' avisos') +
          (repetidos ? ' (' + repetidos + ' ya lo tenían).' : '.'), 'ok');
      }
      AG.Router.refrescar();
    });
  }

  /* =============================================================
     15. Vista principal y eventos
     ============================================================= */

  var PESTANAS = [
    { id: 'movimientos', etiqueta: 'Movimientos', icono: 'historial' },
    { id: 'cobranza', etiqueta: 'Cobranza', icono: 'alerta' },
    { id: 'analisis', etiqueta: 'Análisis', icono: 'grafica' }
  ];

  function barraPestanas() {
    var html = '<div class="tabs mb">';
    for (var i = 0; i < PESTANAS.length; i++) {
      var p = PESTANAS[i];
      html += '<button type="button" class="tab' + (filtros.pestana === p.id ? ' active' : '') +
        '" data-tab="' + esc(p.id) + '">' + ic(p.icono, 16) + ' ' + esc(p.etiqueta) + '</button>';
    }
    return html + '</div>';
  }

  function cuerpoPestana(usuario) {
    if (filtros.pestana === 'cobranza') return vistaCobranza();
    if (filtros.pestana === 'analisis') return vistaAnalisis();
    return vistaMovimientos(usuario);
  }

  function repintarCuerpo(root, usuario) {
    var caja = U.$('#pg-cuerpo', root);
    if (!caja) return;
    caja.innerHTML = cuerpoPestana(usuario);
  }

  function repintarTabla(root) {
    var caja = U.$('#pg-tabla', root);
    if (!caja) return;
    caja.innerHTML = bloqueTabla();
  }

  function render(ctx) {
    inyectarEstilo();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario : AG.Auth.actual();
    var conf = ajustes();

    var html = '' +
      '<div class="page">' +
        '<div class="page-head">' +
          '<div>' +
            '<h1 class="page-title">Pagos y finanzas</h1>' +
            '<p class="page-sub">' + esc('Caja, cobranza y análisis de ingresos de ' +
              (conf.nombreGym || 'Alliance Gym') + '.') + '</p>' +
          '</div>' +
          '<div class="page-acciones">' +
            '<button type="button" class="btn btn-primary" data-nuevo>' + ic('mas', 17) + ' Registrar cobro</button>' +
          '</div>' +
        '</div>' +
        '<div class="mb">' + bloqueKPIs() + '</div>' +
        barraPestanas() +
        '<div id="pg-cuerpo">' + cuerpoPestana(usuario) + '</div>' +
      '</div>';

    return {
      html: html,
      listo: function (root) {
        /* ---- Pestañas ---- */
        U.delegar(root, 'click', '[data-tab]', function (e, el) {
          var id = el.getAttribute('data-tab');
          if (!id || id === filtros.pestana) return;
          filtros.pestana = id;
          var tabs = U.$$('.tab', root);
          for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === id);
          }
          repintarCuerpo(root, usuario);
        });

        /* ---- Alta de cobro ---- */
        U.delegar(root, 'click', '[data-nuevo]', function () { registrar(null); });

        /* ---- Rangos rápidos ---- */
        U.delegar(root, 'click', '[data-rango]', function (e, el) {
          aplicarRango(el.getAttribute('data-rango'));
          repintarCuerpo(root, usuario);
        });

        /* ---- Filtros (selects y fechas) ---- */
        U.delegar(root, 'change', '[data-filtro]', function (e, el) {
          var campo = el.getAttribute('data-filtro');
          filtros[campo] = el.value || '';
          if (campo === 'desde' || campo === 'hasta') filtros.rango = '';
          filtros.limite = 60;
          repintarTabla(root);
          // Los chips de rango dejan de estar marcados al tocar las fechas a mano
          if (campo === 'desde' || campo === 'hasta') {
            var chips = U.$$('[data-rango]', root);
            for (var i = 0; i < chips.length; i++) chips[i].classList.remove('on');
          }
        });

        /* ---- Buscador (sin perder el foco) ---- */
        var buscarDebounce = U.debounce(function () {
          repintarTabla(root);
        }, 220);
        U.delegar(root, 'input', '#pg-q', function (e, el) {
          filtros.q = el.value || '';
          filtros.limite = 60;
          buscarDebounce();
        });

        /* ---- Limpiar filtros ---- */
        U.delegar(root, 'click', '[data-limpiar]', function () {
          filtros.metodo = '';
          filtros.concepto = '';
          filtros.planId = '';
          filtros.socioId = '';
          filtros.estado = '';
          filtros.q = '';
          filtros.orden = 'fecha';
          filtros.dir = 'desc';
          aplicarRango('mes');
          repintarCuerpo(root, usuario);
          U.toast('Filtros restablecidos al mes en curso.', 'info');
        });

        /* ---- Orden ---- */
        U.delegar(root, 'click', '[data-orden]', function (e, el) {
          var campo = el.getAttribute('data-orden');
          if (filtros.orden === campo) {
            filtros.dir = (filtros.dir === 'asc') ? 'desc' : 'asc';
          } else {
            filtros.orden = campo;
            filtros.dir = (campo === 'fecha' || campo === 'monto') ? 'desc' : 'asc';
          }
          repintarTabla(root);
        });

        /* ---- Más filas ---- */
        U.delegar(root, 'click', '[data-mas]', function () {
          filtros.limite += 60;
          repintarTabla(root);
        });

        /* ---- Exportar ---- */
        U.delegar(root, 'click', '[data-csv]', function () { exportarCSV(); });

        /* ---- Acciones de cada movimiento ---- */
        U.delegar(root, 'click', '[data-recibo]', function (e, el) {
          recibo(el.getAttribute('data-recibo'));
        });
        U.delegar(root, 'click', '[data-imprimir]', function (e, el) {
          imprimirRecibo(el.getAttribute('data-imprimir'));
        });
        U.delegar(root, 'click', '[data-cancelar]', function (e, el) {
          cancelarPago(el.getAttribute('data-cancelar'));
        });

        /* ---- Cobranza ---- */
        U.delegar(root, 'click', '[data-cobrar]', function (e, el) {
          registrar(el.getAttribute('data-cobrar'));
        });
        U.delegar(root, 'click', '[data-recordar]', function (e, el) {
          recordatorio(el.getAttribute('data-recordar'));
        });
        U.delegar(root, 'click', '[data-recordar-todos]', function (e, el) {
          recordarATodos(el.getAttribute('data-recordar-todos'));
        });

        /* ---- Análisis ---- */
        U.delegar(root, 'click', '[data-periodo]', function (e, el) {
          filtros.periodoAnalisis = el.getAttribute('data-periodo');
          repintarCuerpo(root, usuario);
        });
      }
    };
  }

  /* =============================================================
     16. API pública y registro de la ruta
     ============================================================= */

  AG.Mod.Pagos = {
    render: render,
    registrar: registrar,
    recibo: recibo,
    imprimirRecibo: imprimirRecibo,
    cancelar: cancelarPago,
    recordatorio: recordatorio,
    numeroALetras: numeroALetras,
    reciboHTML: reciboHTML,
    cobranza: listasDeCobranza,
    METODOS: METODOS,
    CONCEPTOS: CONCEPTOS
  };

  AG.Router.registrar({
    path: 'director/pagos',
    roles: ['director'],
    titulo: 'Pagos y finanzas',
    nav: { etiqueta: 'Pagos', icono: 'dinero', grupo: 'Operación', orden: 2 },
    render: render
  });

})(window.AG);
