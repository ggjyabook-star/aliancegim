/* =============================================================
   ALLIANCE GYM — AG.Views.SocioPagos
   -------------------------------------------------------------
   Pantalla "Mi membresía" del socio. Aquí el socio ve:
     · Su credencial digital con el código de acceso dibujado en SVG.
     · Meses acumulados, antigüedad y total invertido.
     · El estado de su membresía con la barra del periodo vigente.
     · La línea de tiempo de todos sus pagos, agrupada por año.
     · Cuánto ha pagado por mes y en qué se le fue el dinero.
     · Los planes disponibles con el ahorro frente al mensual.
     · Sus asistencias del mes en calendario.

   Ruta: 'socio/membresia' (solo rol 'socio').

   Control de acceso: la vista SIEMPRE trabaja con el id de la
   sesión activa; nunca lee un id de los parámetros de la URL.

   Reglas: JavaScript clásico, sin módulos, todo escapado con
   AG.Utils.esc(), nada de alert/confirm/prompt, nada de
   localStorage directo y ningún bloque sin su vacío en español.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;
  var Icons = AG.Icons;
  var DB = AG.DB;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Respaldo de etiquetas por si el módulo de pagos no estuviera cargado. */
  var CONCEPTOS_RESPALDO = {
    mensualidad: 'Mensualidad',
    inscripcion: 'Inscripción',
    clase: 'Clase o visita',
    producto: 'Producto',
    personalizado: 'Otro concepto'
  };

  var METODOS_RESPALDO = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    app: 'App / QR'
  };

  /* Meses que se grafican en "Lo que has pagado por mes". */
  var MESES_GRAFICA = 12;

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) {
    try { U.toast(mensaje, tipo || 'info'); } catch (e) { /* sin aviso visible */ }
  }

  function ajustes() {
    var s = null;
    try { s = (DB && DB.state) ? DB.state.settings : null; } catch (e) { s = null; }
    return (s && typeof s === 'object') ? s : {};
  }

  function simbolo() {
    var s = ajustes();
    return s.simbolo ? String(s.simbolo) : '$';
  }

  /* Número finito o null (nunca NaN, nunca cadena vacía). */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  /* Número estrictamente positivo o null. */
  function nPos(v) {
    var x = n0(v);
    return (x !== null && x > 0) ? x : null;
  }

  /* 'YYYY-MM-DD' válido o cadena vacía. */
  function fechaISO(v) {
    if (typeof v !== 'string') return '';
    var f = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : '';
  }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function conceptoEtiqueta(id) {
    var lista = (AG.Mod && AG.Mod.Pagos && AG.Mod.Pagos.CONCEPTOS) ? AG.Mod.Pagos.CONCEPTOS : null;
    if (lista) {
      for (var i = 0; i < lista.length; i++) {
        if (lista[i] && lista[i].id === id) return lista[i].etiqueta;
      }
    }
    if (CONCEPTOS_RESPALDO[id]) return CONCEPTOS_RESPALDO[id];
    return id ? U.capitalizar(id) : 'Sin concepto';
  }

  function metodoEtiqueta(id) {
    var lista = (AG.Mod && AG.Mod.Pagos && AG.Mod.Pagos.METODOS) ? AG.Mod.Pagos.METODOS : null;
    if (lista) {
      for (var i = 0; i < lista.length; i++) {
        if (lista[i] && lista[i].id === id) return lista[i].etiqueta;
      }
    }
    if (METODOS_RESPALDO[id]) return METODOS_RESPALDO[id];
    return id ? U.capitalizar(id) : 'Sin método';
  }

  /* Un pago cuenta como cobrado cuando su estado es 'pagado' (o no trae estado). */
  function esPagado(p) {
    return !!p && (!p.estado || p.estado === 'pagado');
  }

  /* Teléfono listo para wa.me (agrega la lada 52 a los números de 10 dígitos). */
  function telWhatsApp(tel) {
    var digitos = String(tel === null || tel === undefined ? '' : tel).replace(/[^0-9]/g, '');
    if (!digitos) return '';
    if (digitos.length === 10) digitos = '52' + digitos;
    return digitos;
  }

  /* 'sep 26' para las etiquetas de la gráfica mensual. */
  function etiquetaMesCorta(mesKey) {
    var p = U.partesDe(mesKey + '-01');
    if (!p) return String(mesKey || '');
    return U.MESES_CORTOS[p.m - 1] + ' ' + String(p.a).slice(2);
  }

  /* Cuentas de dirección activas: son quienes reciben los avisos. */
  function direccionActiva() {
    return DB.donde('usuarios', function (u) {
      return u && u.rol === 'director' && u.activo !== false;
    });
  }

  /* ¿Ya existe una notificación con esta clave? Evita avisos repetidos. */
  function yaNotificado(clave) {
    if (!clave) return false;
    var repetidas = DB.donde('notificaciones', function (n) {
      return n && n.clave === clave;
    });
    return repetidas.length > 0;
  }

  /* =============================================================
     2. Estilos propios (complementos mínimos del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-membresia';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* ---- Credencial digital ---- */
      '.mem-cred{position:relative;overflow:hidden;border-radius:var(--radio);color:#fff;padding:18px;' +
        'border:1px solid rgba(255,255,255,.16);box-shadow:var(--sombra-lg);' +
        'background:linear-gradient(135deg,#0B0C0E 0%,#17191E 36%,#8E1712 74%,#E4322B 100%)}' +
      '.mem-cred::before{content:"";position:absolute;inset:0;pointer-events:none;' +
        'background:radial-gradient(120% 90% at 88% 6%,rgba(255,255,255,.20),transparent 58%),' +
        'radial-gradient(90% 80% at 0% 100%,rgba(0,0,0,.50),transparent 62%)}' +
      '.mem-cred::after{content:"";position:absolute;pointer-events:none;right:-78px;top:-86px;' +
        'width:246px;height:246px;border-radius:50%;border:28px solid rgba(255,255,255,.07)}' +
      '.mem-cred-cuerpo{position:relative;display:grid;gap:18px;align-items:center;' +
        'grid-template-columns:minmax(0,1fr) auto}' +
      '.mem-cred-datos{display:flex;flex-direction:column;gap:11px;min-width:0}' +
      '.mem-cred-marca{display:flex;align-items:center;gap:10px;min-width:0}' +
      '.mem-cred-escudo{flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;border-radius:10px;' +
        'background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.30);color:#fff}' +
      '.mem-cred-marca b{display:block;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}' +
      '.mem-cred-marca span{display:block;font-size:10.5px;color:rgba(255,255,255,.74)}' +
      '.mem-cred-nombre{font-size:clamp(19px,3.2vw,27px);font-weight:800;letter-spacing:-.02em;' +
        'line-height:1.12;overflow-wrap:anywhere}' +
      '.mem-cred-codigo{align-self:flex-start;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
        'font-size:clamp(15px,2.4vw,20px);font-weight:800;letter-spacing:.22em;padding:6px 13px;' +
        'border-radius:var(--radio-sm);background:rgba(0,0,0,.36);border:1px solid rgba(255,255,255,.24)}' +
      '.mem-cred-filas{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(108px,1fr))}' +
      '.mem-cred-filas .dato-label{color:rgba(255,255,255,.66)}' +
      '.mem-cred-filas .dato-val{color:#fff;white-space:normal}' +
      '.mem-cred-estado{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;' +
        'border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;' +
        'background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.34);color:#fff}' +
      '.mem-cred-estado svg{width:13px;height:13px}' +
      '.mem-cred-estado.ok{background:rgba(34,197,94,.30);border-color:rgba(34,197,94,.62)}' +
      '.mem-cred-estado.warn{background:rgba(245,158,11,.32);border-color:rgba(245,158,11,.64)}' +
      '.mem-cred-estado.error{background:rgba(239,68,68,.34);border-color:rgba(239,68,68,.64)}' +
      '.mem-cred-lado{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px}' +
      '.mem-cred-qr{width:154px;max-width:100%;padding:9px;border-radius:12px;background:#fff;' +
        'box-shadow:0 8px 22px rgba(0,0,0,.42)}' +
      '.mem-cred-qr svg{display:block;width:100%;height:auto}' +
      '.mem-cred-pie{max-width:180px;text-align:center;font-size:9.5px;font-weight:800;letter-spacing:.10em;' +
        'text-transform:uppercase;line-height:1.45;color:rgba(255,255,255,.80)}' +
      '.mem-cred-lg{padding:24px}' +
      '.mem-cred-lg .mem-cred-qr{width:250px}' +
      /* ---- Periodo de la membresía ---- */
      '.mem-marcas{display:flex;justify-content:space-between;gap:10px;margin-top:6px;' +
        'font-size:11px;color:var(--texto-3)}' +
      '.mem-marcas b{display:block;color:var(--texto-2);font-variant-numeric:tabular-nums}' +
      '.mem-restan{font-size:clamp(24px,5vw,34px);font-weight:800;letter-spacing:-.03em;line-height:1;' +
        'color:var(--texto);font-variant-numeric:tabular-nums}' +
      /* ---- Línea de tiempo de pagos ---- */
      '.mem-anio{border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);' +
        'overflow:hidden}' +
      '.mem-anio+.mem-anio{margin-top:10px}' +
      '.mem-anio>summary{cursor:pointer;list-style:none;padding:11px 13px;display:flex;align-items:center;' +
        'gap:9px;font-size:13px;font-weight:800;color:var(--texto)}' +
      '.mem-anio>summary::-webkit-details-marker{display:none}' +
      '.mem-anio>summary svg{color:var(--rojo);flex:0 0 auto}' +
      '.mem-anio>summary::after{content:"+";margin-left:auto;color:var(--texto-3);font-size:17px;' +
        'font-weight:800;line-height:1}' +
      '.mem-anio[open]>summary::after{content:"\\2212"}' +
      '.mem-anio[open]>summary{border-bottom:1px solid var(--borde)}' +
      '.mem-anio-cuerpo{padding:13px}' +
      '.mem-tl-fila{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:10px}' +
      '.mem-tl-info{flex:1 1 210px;min-width:0}' +
      '.mem-tl-lado{flex:0 0 auto;display:flex;align-items:center;gap:9px}' +
      '.mem-tl-monto{font-size:15px;font-weight:800;color:var(--texto);font-variant-numeric:tabular-nums;' +
        'white-space:nowrap}' +
      '.mem-tl-monto.cancelado{color:var(--texto-3);text-decoration:line-through}' +
      /* ---- Planes disponibles ---- */
      '.mem-plan{display:flex;flex-direction:column;gap:11px;height:100%}' +
      '.mem-plan-precio{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px}' +
      '.mem-plan-precio b{font-size:27px;font-weight:800;letter-spacing:-.03em;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;line-height:1}' +
      '.mem-plan-precio span{font-size:12px;color:var(--texto-3)}' +
      '.mem-benef{display:flex;flex-direction:column;gap:7px}' +
      '.mem-benef li{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.45;' +
        'color:var(--texto-2)}' +
      '.mem-benef li svg{flex:0 0 auto;margin-top:1px;color:var(--ok)}' +
      '.mem-ahorro{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:var(--radio-sm);' +
        'background:var(--ok-bg);border:1px solid rgba(34,197,94,.30);color:var(--texto);' +
        'font-size:12.5px;font-weight:700;line-height:1.35}' +
      '.mem-ahorro svg{flex:0 0 auto;color:var(--ok)}' +
      '.card.mem-plan-actual{border-color:var(--rojo);box-shadow:0 0 0 1px var(--rojo) inset,var(--sombra)}' +
      /* ---- Adaptación a pantallas chicas ---- */
      '@media (max-width:640px){' +
        '.mem-cred{padding:16px}' +
        '.mem-cred-cuerpo{grid-template-columns:1fr;justify-items:center}' +
        '.mem-cred-datos{align-items:center;text-align:center}' +
        '.mem-cred-marca{justify-content:center}' +
        '.mem-cred-codigo,.mem-cred-estado{align-self:center}' +
        '.mem-cred-filas{width:100%;text-align:left}' +
        '.mem-cred-qr{width:190px}' +
        '.mem-cred-lg .mem-cred-qr{width:220px}' +
        '.mem-tl-lado{width:100%;justify-content:space-between}' +
      '}' +
      '@media (max-width:380px){' +
        '.mem-cred-codigo{letter-spacing:.14em;padding:5px 10px}' +
        '.mem-cred-filas{grid-template-columns:1fr}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Código de acceso dibujado en SVG
     -------------------------------------------------------------
     No es un QR real: es un patrón determinista y ordenado que
     nace del código del socio (siempre el mismo dibujo para el
     mismo código). Sirve para identificar al socio de un vistazo
     en recepción, no para ser escaneado.
     ============================================================= */

  var LADO_CODIGO = 21;      /* módulos por lado */
  var MARGEN_CODIGO = 2;     /* zona tranquila alrededor */

  /* Semilla entera y estable a partir del texto (FNV-1a de 32 bits). */
  function hashTexto(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto);
    if (!t) t = 'ALLIANCE';
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) {
      h = (h ^ t.charCodeAt(i)) | 0;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) | 0;
    }
    return h | 0;
  }

  /* ¿El módulo (fila, columna) se pinta? Depende solo de la semilla. */
  function bitModulo(semilla, fila, columna) {
    var h = (semilla ^ ((fila + 1) * 73856093) ^ ((columna + 1) * 19349663)) | 0;
    h = (h ^ (h << 13)) | 0;
    h = (h ^ (h >>> 17)) | 0;
    h = (h ^ (h << 5)) | 0;
    return ((h >>> 3) & 1) === 1;
  }

  /* Celdas ocupadas por las esquinas de posicionamiento y las guías. */
  function celdaReservada(fila, columna) {
    var n = LADO_CODIGO;
    if (fila <= 7 && columna <= 7) return true;              /* esquina superior izquierda */
    if (fila <= 7 && columna >= n - 8) return true;          /* esquina superior derecha */
    if (fila >= n - 8 && columna <= 7) return true;          /* esquina inferior izquierda */
    if (fila === 6 || columna === 6) return true;            /* guías de alineación */
    return false;
  }

  function modulo(x, y) {
    return '<rect x="' + x + '" y="' + y + '" width="1" height="1" rx="0.18"/>';
  }

  /* Esquina de posicionamiento de 7x7 módulos. */
  function esquinaCodigo(x, y, tinta, papel) {
    return '<rect x="' + x + '" y="' + y + '" width="7" height="7" rx="1.6" fill="' + tinta + '"/>' +
      '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" rx="1.1" fill="' + papel + '"/>' +
      '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx="0.7" fill="' + tinta + '"/>';
  }

  /**
   * Dibuja el código de acceso del socio.
   * @param {String} codigo  Código del socio ('AG-0001')
   * @param {Object} [opciones] { tinta, papel }
   * @returns {String} HTML con el <svg> completo
   */
  function codigoAccesoSVG(codigo, opciones) {
    var o = opciones || {};
    var tinta = o.tinta || '#101318';
    var papel = o.papel || '#FFFFFF';
    var n = LADO_CODIGO;
    var m = MARGEN_CODIGO;
    var lado = n + m * 2;
    var texto = String(codigo || 'ALLIANCE GYM');
    var semilla = hashTexto(texto);
    var celdas = '';
    var fila, columna, i;

    for (fila = 0; fila < n; fila++) {
      for (columna = 0; columna < n; columna++) {
        if (celdaReservada(fila, columna)) continue;
        /* El módulo fijo bajo la esquina inferior izquierda siempre se pinta. */
        var fijo = (fila === n - 8 && columna === 8);
        if (!fijo && !bitModulo(semilla, fila, columna)) continue;
        celdas += modulo(m + columna, m + fila);
      }
    }

    /* Guías punteadas entre esquinas: dan el aire ordenado del patrón. */
    for (i = 8; i <= n - 9; i++) {
      if (i % 2 !== 0) continue;
      celdas += modulo(m + i, m + 6);
      celdas += modulo(m + 6, m + i);
    }

    var etiqueta = 'Código de acceso ' + texto;

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + lado + ' ' + lado + '"' +
      ' role="img" aria-label="' + esc(etiqueta) + '" style="display:block;width:100%;height:auto">' +
      '<title>' + esc(etiqueta) + '</title>' +
      '<rect x="0" y="0" width="' + lado + '" height="' + lado + '" rx="1.4" fill="' + papel + '"/>' +
      '<g fill="' + tinta + '">' + celdas + '</g>' +
      esquinaCodigo(m, m, tinta, papel) +
      esquinaCodigo(m + n - 7, m, tinta, papel) +
      esquinaCodigo(m, m + n - 7, tinta, papel) +
      '</svg>';
  }

  /* =============================================================
     4. Datos derivados de la membresía
     ============================================================= */

  /* Código visible del socio (si el expediente no lo trae, se deriva del id). */
  function codigoDe(socio) {
    if (socio && socio.codigo) return String(socio.codigo);
    var base = String((socio && socio.id) || '').replace(/[^0-9a-zA-Z]/g, '');
    return 'AG-' + (base ? base.slice(-4).toUpperCase() : '0000');
  }

  /* Último pago de mensualidad efectivamente cobrado. */
  function ultimaMensualidad(pagos) {
    var mejor = null, mejorFin = '';
    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!esPagado(p)) continue;
      if (p.concepto && p.concepto !== 'mensualidad') continue;
      var fin = fechaISO(p.periodoFin);
      if (!fin) continue;
      if (!mejor || fin > mejorFin) { mejor = p; mejorFin = fin; }
    }
    return mejor;
  }

  /* Plan mensual de referencia (el más barato con vigencia de un mes). */
  function planMensualDeReferencia(planes) {
    var mejor = null;
    for (var i = 0; i < planes.length; i++) {
      var p = planes[i];
      if (!p || n0(p.meses) !== 1) continue;
      if (!mejor || (nPos(p.precio) || 0) < (nPos(mejor.precio) || 0)) mejor = p;
    }
    return mejor;
  }

  /* Cuánto tendría que pagar el socio para renovar y con qué plan. */
  function datosRenovacion(socio, pagos, planes) {
    var plan = socio.planId ? DB.plan(socio.planId) : null;
    var monto = plan ? nPos(plan.precio) : null;

    if (monto === null) {
      var ultimo = ultimaMensualidad(pagos);
      if (ultimo) {
        monto = nPos(ultimo.monto);
        if (!plan && ultimo.planId) plan = DB.plan(ultimo.planId);
      }
    }
    if (monto === null) {
      var mensual = planMensualDeReferencia(planes);
      if (mensual) { plan = plan || mensual; monto = nPos(mensual.precio); }
    }

    return { plan: plan, monto: monto };
  }

  /* Vigencia legible de un plan ('1 mes', '3 meses', '1 año', '7 días'). */
  function duracionPlanTexto(plan) {
    var meses = n0(plan && plan.meses);
    var dias = n0(plan && plan.dias);
    if (meses !== null && meses >= 12 && meses % 12 === 0) {
      var anios = meses / 12;
      return anios === 1 ? '1 año' : anios + ' años';
    }
    if (meses !== null && meses > 0) return meses === 1 ? '1 mes' : meses + ' meses';
    if (dias !== null && dias > 0) return dias === 1 ? '1 día' : dias + ' días';
    return 'Vigencia por definir';
  }

  /* Ahorro anual del plan frente a pagar mes con mes. */
  function ahorroAnual(plan, mensual) {
    var meses = n0(plan && plan.meses);
    var precioPlan = nPos(plan && plan.precio);
    var precioMes = nPos(mensual && mensual.precio);
    if (meses === null || meses < 2 || precioPlan === null || precioMes === null) return 0;
    var ahorro = (precioMes * 12) - (precioPlan * (12 / meses));
    return ahorro > 1 ? Math.round(ahorro) : 0;
  }

  /* Reparte los pagos cobrados en los últimos N meses. */
  function pagosPorMes(pagos, cuantos) {
    var mapa = {}, i, p, mes;
    for (i = 0; i < pagos.length; i++) {
      p = pagos[i];
      if (!esPagado(p)) continue;
      mes = U.mesDe(p.fecha);
      if (!mes) continue;
      mapa[mes] = (mapa[mes] || 0) + (n0(p.monto) || 0);
    }

    var base = U.mesActual() + '-01';
    var salida = [], hayAlgo = false;
    for (i = cuantos - 1; i >= 0; i--) {
      var clave = U.mesDe(U.sumaMeses(base, -i));
      var valor = mapa[clave] || 0;
      if (valor > 0) hayAlgo = true;
      salida.push({ etiqueta: etiquetaMesCorta(clave), valor: Math.round(valor * 100) / 100 });
    }
    return hayAlgo ? salida : [];
  }

  /* Desglose del gasto por concepto, de mayor a menor. */
  function pagosPorConcepto(pagos) {
    var grupos = U.agrupar(pagos.filter(esPagado), 'concepto');
    var salida = [], clave, i = 0;
    for (clave in grupos) {
      if (!Object.prototype.hasOwnProperty.call(grupos, clave)) continue;
      var total = U.suma(grupos[clave], 'monto');
      if (!(total > 0)) continue;
      salida.push({
        etiqueta: conceptoEtiqueta(clave === 'sin_clave' ? '' : clave),
        valor: Math.round(total * 100) / 100,
        color: Charts.color(i)
      });
      i++;
    }
    return U.ordenar(salida, 'valor', 'desc');
  }

  /* =============================================================
     5. Piezas de interfaz
     ============================================================= */

  function vacioHTML(mensaje, nombreIcono, botonHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(nombreIcono || 'tarjeta', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botonHTML || '') +
    '</div>';
  }

  function cardHTML(titulo, nombreIcono, cuerpo, extraCabecera, claseExtra) {
    return '<div class="card' + (claseExtra ? ' ' + claseExtra : '') + '">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono(nombreIcono, 18) + '<span>' + esc(titulo) + '</span></div>' +
        (extraCabecera ? '<div class="card-accion">' + extraCabecera + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  function kpiHTML(nombreIcono, valor, etiqueta, variante, pie) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(nombreIcono, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        (pie ? '<div class="kpi-trend plana">' + esc(pie) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function datoHTML(etiqueta, valor) {
    return '<div class="dato">' +
      '<span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<span class="dato-val">' + esc(valor) + '</span>' +
    '</div>';
  }

  /* Clase de color de la credencial según el estado de la membresía. */
  function claseEstadoCredencial(estado) {
    if (estado === 'activo') return 'ok';
    if (estado === 'por_vencer') return 'warn';
    if (estado === 'vencido') return 'error';
    return '';
  }

  function iconoEstado(estado) {
    if (estado === 'activo') return 'check';
    if (estado === 'por_vencer') return 'reloj';
    if (estado === 'vencido') return 'alerta';
    return 'info';
  }

  /**
   * HTML de la credencial digital del socio.
   * @param {Object} socio
   * @param {Object} [opts] { grande:Boolean }
   * @returns {String} HTML
   */
  function credencialHTML(socio, opts) {
    var o = opts || {};
    var s = ajustes();
    var plan = socio.planId ? DB.plan(socio.planId) : null;
    var estado = Calc.estadoMembresia(socio);
    var codigo = codigoDe(socio);
    var vence = estado.vence || fechaISO(socio.fechaVencimiento);
    var alta = fechaISO(socio.fechaAlta) || fechaISO(socio.creado);

    return '<div class="mem-cred' + (o.grande ? ' mem-cred-lg' : '') + '">' +
      '<div class="mem-cred-cuerpo">' +
        '<div class="mem-cred-datos">' +
          '<div class="mem-cred-marca">' +
            '<span class="mem-cred-escudo">' + icono('escudo', 20) + '</span>' +
            '<div>' +
              '<b>' + esc(s.nombreGym || 'Alliance Gym') + '</b>' +
              '<span>' + esc(s.lema || 'Credencial de socio') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="mem-cred-nombre">' + esc(U.nombreCompleto(socio)) + '</div>' +
          '<div class="mem-cred-codigo">' + esc(codigo) + '</div>' +
          '<div class="mem-cred-filas">' +
            datoHTML('Plan', plan ? plan.nombre : 'Sin plan asignado') +
            datoHTML('Vigencia', vence ? 'Hasta el ' + U.fecha(vence, 'corto') : 'Por definir') +
            datoHTML('Socio desde', alta ? U.fecha(alta, 'corto') : 'Sin registro') +
          '</div>' +
          '<span class="mem-cred-estado ' + claseEstadoCredencial(estado.estado) + '">' +
            icono(iconoEstado(estado.estado), 13) + esc(estado.texto) +
          '</span>' +
        '</div>' +
        '<div class="mem-cred-lado">' +
          '<div class="mem-cred-qr">' + codigoAccesoSVG(codigo) + '</div>' +
          '<span class="mem-cred-pie">Código de acceso · muéstralo en recepción</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Abre la credencial en grande para enseñarla en el mostrador. */
  function mostrarCredencial(socioId) {
    var socio = DB.usuario(socioId);
    if (!socio) { toast('No encontramos tu expediente de socio.', 'error'); return null; }

    asegurarEstilos();
    return U.modal({
      titulo: 'Credencial digital',
      ancho: 'lg',
      cuerpo: '<div class="stack">' +
        credencialHTML(socio, { grande: true }) +
        '<p class="mini muted txt-centro">Este código identifica tu cuenta dentro de Alliance Gym. ' +
          'No es un código escaneable: en recepción lo comparan con tu nombre y tu código de socio.</p>' +
      '</div>',
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }]
    });
  }

  /* =============================================================
     6. Estado de la membresía
     ============================================================= */

  function claseBarra(estado) {
    if (estado === 'activo') return 'ok';
    if (estado === 'por_vencer') return 'warn';
    if (estado === 'vencido') return 'error';
    return 'info';
  }

  function mensajeRestante(estado) {
    var dias = Number(estado.diasRestantes) || 0;
    if (estado.estado === 'congelado') return 'Congelada';
    if (estado.estado === 'baja') return 'Sin acceso';
    if (dias > 1) return dias + ' días';
    if (dias === 1) return '1 día';
    if (dias === 0) return 'Hoy';
    var vencidos = -dias;
    return vencidos === 1 ? '1 día vencida' : vencidos + ' días vencida';
  }

  function estadoMembresiaHTML(socio, pagos, renovacion) {
    var estado = Calc.estadoMembresia(socio);
    var vence = estado.vence || fechaISO(socio.fechaVencimiento);
    var ultimo = ultimaMensualidad(pagos);
    var inicio = ultimo ? fechaISO(ultimo.periodoInicio) : '';
    if (!inicio) inicio = fechaISO(socio.fechaAlta) || fechaISO(socio.creado);

    /* Sin fecha de corte no hay barra que dibujar, pero sí un mensaje útil. */
    if (!vence) {
      var sinFecha, claseAviso, iconoAviso;
      if (estado.estado === 'congelado') {
        sinFecha = 'Tu membresía está congelada: no corren los días. Avisa en recepción cuando quieras reactivarla.';
        claseAviso = 'aviso-info'; iconoAviso = 'luna';
      } else if (estado.estado === 'baja') {
        sinFecha = 'Tu cuenta figura como baja. Si quieres regresar, en recepción reactivamos tu expediente ' +
          'con todo tu historial.';
        claseAviso = ''; iconoAviso = 'info';
      } else {
        sinFecha = 'Todavía no tenemos una fecha de vencimiento registrada. Pasa a recepción para activar tu membresía.';
        claseAviso = 'aviso-warn'; iconoAviso = 'calendario';
      }
      return '<div class="stack">' +
        '<div class="aviso ' + claseAviso + '">' + icono(iconoAviso, 18) +
          '<div>' + esc(sinFecha) + '</div>' +
        '</div>' +
        accionesRenovacionHTML(socio, estado, renovacion) +
      '</div>';
    }

    var total = inicio ? U.diasEntre(inicio, vence) : 0;
    var corridos = inicio ? U.diasEntre(inicio, U.hoy()) : 0;
    var pct;
    if (total > 0) pct = Math.max(0, Math.min(100, Math.round(corridos / total * 100)));
    else pct = (U.diasEntre(U.hoy(), vence) > 0) ? 0 : 100;

    var clase = claseBarra(estado.estado);
    var necesitaRenovar = (estado.estado === 'por_vencer' || estado.estado === 'vencido');

    var html = '<div class="stack">';

    html += '<div class="row between wrap">' +
      '<div>' +
        '<div class="mem-restan">' + esc(mensajeRestante(estado)) + '</div>' +
        '<div class="mini muted">' + esc(estado.estado === 'vencido'
          ? 'Tu periodo terminó el ' + U.fecha(vence, 'corto')
          : 'Tu periodo termina el ' + U.fecha(vence, 'corto')) + '</div>' +
      '</div>' +
      '<span class="badge ' + esc(estado.clase) + '">' + esc(estado.texto) + '</span>' +
    '</div>';

    html += '<div>' +
      '<div class="bar bar-gruesa" role="img" aria-label="' +
        esc('Periodo consumido: ' + pct + ' por ciento') + '">' +
        '<span class="bar-fill ' + clase + '" style="width:' + pct + '%"></span>' +
      '</div>' +
      '<div class="mem-marcas">' +
        '<span>Inicio del periodo<b>' + esc(inicio ? U.fecha(inicio, 'corto') : 'Sin registro') + '</b></span>' +
        '<span class="txt-der">Vencimiento<b>' + esc(U.fecha(vence, 'corto')) + '</b></span>' +
      '</div>' +
    '</div>';

    if (estado.estado === 'congelado') {
      html += '<div class="aviso aviso-info">' + icono('luna', 18) +
        '<div>Tu membresía está <b>congelada</b>: no corren los días. ' +
        'Avisa en recepción cuando quieras reactivarla.</div></div>';
    } else if (estado.estado === 'baja') {
      html += '<div class="aviso">' + icono('info', 18) +
        '<div>Tu cuenta figura como <b>baja</b>. Si quieres regresar, en recepción reactivamos tu expediente ' +
        'con todo tu historial.</div></div>';
    } else if (necesitaRenovar) {
      var monto = renovacion.monto;
      var nombrePlan = renovacion.plan ? renovacion.plan.nombre : 'tu plan';
      var textoMonto = (monto !== null)
        ? 'El monto de renovación del plan ' + nombrePlan + ' es de ' + U.dinero(monto) + '.'
        : 'En recepción te confirmamos el monto de tu renovación.';

      html += '<div class="aviso ' + (estado.estado === 'vencido' ? 'aviso-error' : 'aviso-warn') + '">' +
        icono('alerta', 18) +
        '<div>' +
          '<b>' + esc(estado.estado === 'vencido'
            ? 'Tu membresía está vencida.'
            : 'Tu membresía está por vencer.') + '</b> ' +
          esc(textoMonto) +
          (estado.estado === 'vencido'
            ? ' Renueva para recuperar el acceso a las instalaciones.'
            : ' Renueva antes del ' + esc(U.fecha(vence, 'corto')) + ' para no perder tu continuidad.') +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="aviso aviso-ok">' + icono('check', 18) +
        '<div>Tu membresía está <b>al corriente</b>. Sigue así y aprovecha todas tus clases incluidas.</div></div>';
    }

    html += accionesRenovacionHTML(socio, estado, renovacion);
    html += '</div>';
    return html;
  }

  /* Botonera de renovación: aviso a dirección y WhatsApp del gimnasio. */
  function accionesRenovacionHTML(socio, estado, renovacion) {
    var s = ajustes();
    var telefono = telWhatsApp(s.telefono);
    var nombrePlan = renovacion.plan ? renovacion.plan.nombre : 'mi plan';
    var intencion;
    if (estado.estado === 'congelado') intencion = 'Quiero reactivar mi membresía congelada.';
    else if (estado.estado === 'baja') intencion = 'Quiero regresar al gimnasio y reactivar mi cuenta.';
    else if (estado.estado === 'vencido') intencion = 'Mi membresía está vencida y quiero renovar ' + nombrePlan + '.';
    else intencion = 'Quiero renovar ' + nombrePlan + '.';

    var texto = 'Hola, soy ' + U.nombreCompleto(socio) + ' (' + codigoDe(socio) + '). ' +
      intencion + ' ¿Me apoyan?';

    var html = '<div class="row wrap">';

    html += '<button type="button" class="btn btn-primary" data-avisar-recepcion>' +
      icono('campana', 16) + ' Avisar en recepción</button>';

    if (telefono) {
      html += '<a class="btn btn-outline" target="_blank" rel="noopener noreferrer" href="' +
        esc('https://wa.me/' + telefono + '?text=' + encodeURIComponent(texto)) + '">' +
        icono('whatsapp', 16) + ' WhatsApp del gimnasio</a>';
    }

    html += '</div>';

    if (!telefono) {
      html += '<p class="mini muted">Todavía no hay un WhatsApp registrado para el gimnasio. ' +
        'Usa el botón de aviso y dirección te contactará.</p>';
    } else {
      html += '<p class="mini muted">El aviso llega directo al panel de dirección; el WhatsApp abre ' +
        'un mensaje ya escrito al ' + esc(s.telefono || '') + '.</p>';
    }

    return html;
  }

  /* =============================================================
     7. Línea de tiempo de pagos
     ============================================================= */

  function claseDePunto(pago) {
    if (pago.estado === 'cancelado') return 'error';
    if (pago.estado === 'pendiente') return 'warn';
    if (pago.concepto === 'mensualidad') return 'rojo';
    return 'ok';
  }

  function periodoTexto(pago) {
    var ini = fechaISO(pago.periodoInicio);
    var fin = fechaISO(pago.periodoFin);
    if (ini && fin) return 'Cubre del ' + U.fecha(ini, 'corto') + ' al ' + U.fecha(fin, 'corto');
    if (fin) return 'Cubre hasta el ' + U.fecha(fin, 'corto');
    if (ini) return 'Desde el ' + U.fecha(ini, 'corto');
    return 'Sin periodo asociado';
  }

  function pagoTimelineHTML(pago) {
    var monto = n0(pago.monto);
    var cancelado = (pago.estado === 'cancelado');
    var partes = [periodoTexto(pago), metodoEtiqueta(pago.metodo)];
    if (pago.estado === 'pendiente') partes.push('Pendiente de cobro');
    if (cancelado) partes.push('Cancelado');
    if (pago.nota) partes.push(String(pago.nota));

    return '<div class="timeline-item">' +
      '<span class="timeline-punto ' + claseDePunto(pago) + '"></span>' +
      '<div class="mem-tl-fila">' +
        '<div class="mem-tl-info">' +
          '<div class="tl-fecha">' + esc(U.fecha(pago.fecha, 'corto')) +
            (pago.folio ? ' · ' + esc(pago.folio) : '') + '</div>' +
          '<div class="tl-titulo">' + esc(conceptoEtiqueta(pago.concepto)) + '</div>' +
          '<div class="tl-cuerpo">' + esc(partes.join(' · ')) + '</div>' +
        '</div>' +
        '<div class="mem-tl-lado">' +
          '<span class="mem-tl-monto' + (cancelado ? ' cancelado' : '') + '">' +
            esc(monto !== null ? U.dinero(monto) : '—') + '</span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-recibo="' + esc(pago.id) + '">' +
            icono('ojo', 15) + ' Ver recibo</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function lineaDePagosHTML(pagos) {
    if (!pagos.length) {
      return vacioHTML(
        'Todavía no tienes pagos registrados. Cuando cubras tu primera mensualidad aparecerá aquí con su recibo.',
        'dinero'
      );
    }

    /* Los pagos llegan del más reciente al más antiguo: se respeta ese orden. */
    var grupos = U.agrupar(pagos, function (p) {
      var f = fechaISO(p.fecha);
      return f ? f.slice(0, 4) : 'Sin fecha';
    });

    var anios = [];
    for (var clave in grupos) {
      if (Object.prototype.hasOwnProperty.call(grupos, clave)) anios.push(clave);
    }
    anios.sort().reverse();

    var html = '';
    for (var i = 0; i < anios.length; i++) {
      var anio = anios[i];
      var lista = grupos[anio];
      var total = U.suma(lista.filter(esPagado), 'monto');
      var cuerpo = '';
      for (var j = 0; j < lista.length; j++) cuerpo += pagoTimelineHTML(lista[j]);

      html += '<details class="mem-anio"' + (i === 0 ? ' open' : '') + '>' +
        '<summary>' + icono('calendario', 16) +
          '<span>' + esc(anio === 'Sin fecha' ? 'Pagos sin fecha' : anio) + '</span>' +
          '<span class="badge badge-muted">' + esc(lista.length +
            (lista.length === 1 ? ' pago' : ' pagos')) + '</span>' +
          '<span class="badge badge-ok">' + esc(U.dinero(total, 0)) + '</span>' +
        '</summary>' +
        '<div class="mem-anio-cuerpo"><div class="timeline">' + cuerpo + '</div></div>' +
      '</details>';
    }
    return html;
  }

  /* =============================================================
     8. Gráficas del gasto
     ============================================================= */

  function graficaMensualHTML(pagos) {
    var datos = pagosPorMes(pagos, MESES_GRAFICA);
    if (!datos.length) {
      return vacioHTML('Aún no hay pagos en los últimos ' + MESES_GRAFICA + ' meses.', 'grafica');
    }
    return Charts.barras(datos, {
      alto: 250,
      prefijo: simbolo(),
      decimales: 0,
      desdeCero: true,
      etiquetaY: 'Pagado',
      vacio: 'Aún no hay pagos que graficar.',
      aria: 'Lo que has pagado mes con mes'
    });
  }

  function graficaConceptosHTML(pagos) {
    var datos = pagosPorConcepto(pagos);
    if (!datos.length) {
      return vacioHTML('Cuando registres tu primer pago verás aquí el desglose por concepto.', 'dinero');
    }
    var total = U.suma(datos, 'valor');
    return Charts.dona(datos, {
      alto: 250,
      prefijo: simbolo(),
      decimales: 0,
      centroTitulo: 'Total',
      centroValor: U.dinero(total, 0),
      vacio: 'Sin información para el desglose.',
      aria: 'Desglose de tus pagos por concepto'
    });
  }

  /* =============================================================
     9. Planes disponibles
     ============================================================= */

  function planCardHTML(plan, socio, mensual) {
    var esActual = !!(socio.planId && socio.planId === plan.id);
    var precio = nPos(plan.precio);
    var meses = n0(plan.meses);
    var ahorro = ahorroAnual(plan, mensual);
    var beneficios = (Object.prototype.toString.call(plan.beneficios) === '[object Array]')
      ? plan.beneficios : [];

    var cuerpo = '<div class="mem-plan">';

    cuerpo += '<div class="mem-plan-precio">' +
      '<b>' + esc(precio !== null ? U.dinero(precio, 0) : 'Por definir') + '</b>' +
      '<span>' + esc(duracionPlanTexto(plan)) + '</span>' +
    '</div>';

    if (meses !== null && meses > 1 && precio !== null) {
      cuerpo += '<p class="mini muted">Equivale a ' + esc(U.dinero(precio / meses, 0)) + ' por mes.</p>';
    }

    if (plan.descripcion) {
      cuerpo += '<p class="mini muted">' + esc(plan.descripcion) + '</p>';
    }

    if (ahorro > 0) {
      cuerpo += '<div class="mem-ahorro">' + icono('trofeo', 16) +
        '<span>Ahorras ' + esc(U.dinero(ahorro, 0)) + ' al año frente al plan mensual.</span></div>';
    }

    if (beneficios.length) {
      cuerpo += '<ul class="mem-benef">';
      for (var i = 0; i < beneficios.length; i++) {
        cuerpo += '<li>' + icono('check', 14) + '<span>' + esc(beneficios[i]) + '</span></li>';
      }
      cuerpo += '</ul>';
    } else {
      cuerpo += '<p class="mini muted">Pregunta en recepción por los beneficios de este plan.</p>';
    }

    if (nPos(plan.inscripcion) !== null) {
      cuerpo += '<p class="mini muted">Inscripción: ' + esc(U.dinero(plan.inscripcion, 0)) + '.</p>';
    }

    cuerpo += '<div class="flex1"></div>';

    if (esActual) {
      cuerpo += '<button type="button" class="btn btn-outline btn-block" disabled>' +
        icono('check', 16) + ' Es tu plan actual</button>';
    } else {
      cuerpo += '<button type="button" class="btn btn-primary btn-block" data-plan-interes="' +
        esc(plan.id) + '">' + icono('campana', 16) + ' Me interesa</button>';
    }

    cuerpo += '</div>';

    var etiqueta = esActual
      ? '<span class="badge badge-rojo">Tu plan</span>'
      : (ahorro > 0 ? '<span class="badge badge-ok">Ahorro</span>' : '');

    return cardHTML(plan.nombre || 'Plan', 'tarjeta', cuerpo, etiqueta,
      esActual ? 'mem-plan-actual' : '');
  }

  function planesHTML(socio, planes) {
    var activos = [];
    for (var i = 0; i < planes.length; i++) {
      if (planes[i] && planes[i].activo !== false) activos.push(planes[i]);
    }
    if (!activos.length) {
      return vacioHTML('Por ahora no hay planes publicados. Pregunta en recepción por las opciones vigentes.',
        'tarjeta');
    }

    activos = U.ordenar(activos, function (p) {
      var meses = n0(p.meses);
      var dias = n0(p.dias);
      if (meses !== null && meses > 0) return meses * 30;
      return (dias !== null && dias > 0) ? dias : 0;
    }, 'asc');

    var mensual = planMensualDeReferencia(activos);
    var html = '<div class="grid g3">';
    for (var j = 0; j < activos.length; j++) html += planCardHTML(activos[j], socio, mensual);
    return html + '</div>';
  }

  /* =============================================================
     10. Asistencias del mes
     ============================================================= */

  function asistenciasHTML(socio) {
    /* Si el módulo de asistencia está cargado, se usa su resumen oficial. */
    if (AG.Mod && AG.Mod.Asistencia && typeof AG.Mod.Asistencia.resumenSocio === 'function') {
      try {
        var propio = AG.Mod.Asistencia.resumenSocio(socio.id);
        if (propio) return propio;
      } catch (e) { /* se cae al calendario propio de abajo */ }
    }

    var asistencias = DB.asistenciasDe(socio.id);
    if (!asistencias.length) {
      return vacioHTML('Todavía no tenemos visitas registradas a tu nombre. ' +
        'Marca tu entrada en recepción para empezar a acumular tu historial.', 'calendario');
    }

    var mes = U.mesActual();
    var delMes = [];
    for (var i = 0; i < asistencias.length; i++) {
      var f = fechaISO(asistencias[i].fecha);
      if (f && f.slice(0, 7) === mes) delMes.push({ fecha: f, valor: 1 });
    }

    var racha = Calc.rachaDias(asistencias);

    return '<div class="stack">' +
      '<div class="grid g3 gap-sm">' +
        kpiHTML('fuego', racha + (racha === 1 ? ' día' : ' días'), 'Racha actual', racha > 0 ? 'kpi-ok' : '') +
        kpiHTML('calendario', String(delMes.length), 'Visitas este mes', 'kpi-info') +
        kpiHTML('historial', String(asistencias.length), 'Visitas totales', '') +
      '</div>' +
      '<div>' +
        '<div class="micro muted mb-sm">' + esc(U.nombreMes(mes)) + '</div>' +
        Charts.calendario(delMes, {
          periodo: mes,
          celda: 28,
          etiquetaValor: 'visita',
          vacio: 'Sin visitas registradas en ' + U.nombreMes(mes) + '.',
          aria: 'Calendario de asistencias del mes'
        }) +
      '</div>' +
    '</div>';
  }

  /* =============================================================
     11. Acciones del socio
     ============================================================= */

  /* Aviso a dirección de que el socio quiere renovar. */
  function avisarRecepcion(socio, renovacion) {
    var destinatarios = direccionActiva();
    if (!destinatarios.length) {
      toast('No hay una cuenta de dirección activa en este momento. Acude a recepción.', 'warn');
      return;
    }

    var clave = 'renovacion-socio:' + socio.id + ':' + U.hoy();
    if (yaNotificado(clave)) {
      toast('Ya avisamos hoy a recepción. En cuanto te atiendan te buscan.', 'info');
      return;
    }

    var estado = Calc.estadoMembresia(socio);
    var nombrePlan = renovacion.plan ? renovacion.plan.nombre : 'su plan';
    var monto = (renovacion.monto !== null) ? U.dinero(renovacion.monto) : 'monto por confirmar';
    var congelada = (estado.estado === 'congelado' || estado.estado === 'baja');

    var cuerpo = U.nombreCompleto(socio) + ' (' + codigoDe(socio) + ') avisó desde su panel que quiere ' +
      (congelada
        ? 'reactivar su membresía'
        : 'renovar el plan ' + nombrePlan + ' (' + monto + ')') +
      '. Estado actual: ' + estado.texto + '.';

    for (var i = 0; i < destinatarios.length; i++) {
      DB.notificar(destinatarios[i].id, {
        titulo: congelada ? 'Reactivación solicitada' : 'Renovación solicitada',
        cuerpo: cuerpo,
        tipo: 'pago',
        link: '#/director/pagos',
        clave: clave
      });
    }

    toast('Listo, avisamos a recepción. Te esperan para renovar tu membresía.', 'ok');
  }

  /* Aviso a dirección de interés en un plan concreto. */
  function avisarInteresPlan(socio, planId) {
    var plan = DB.plan(planId);
    if (!plan) { toast('Ese plan ya no está disponible.', 'error'); return; }

    var destinatarios = direccionActiva();
    if (!destinatarios.length) {
      toast('No hay una cuenta de dirección activa en este momento. Acude a recepción.', 'warn');
      return;
    }

    var clave = 'interes-plan:' + socio.id + ':' + plan.id + ':' + U.hoy();
    if (yaNotificado(clave)) {
      toast('Ya registramos hoy tu interés en el plan ' + plan.nombre + '.', 'info');
      return;
    }

    var precio = nPos(plan.precio);
    var cuerpo = U.nombreCompleto(socio) + ' (' + codigoDe(socio) + ') está interesado en el plan ' +
      plan.nombre + (precio !== null ? ' de ' + U.dinero(precio) : '') + '. Contáctalo para cerrarlo.';

    for (var i = 0; i < destinatarios.length; i++) {
      DB.notificar(destinatarios[i].id, {
        titulo: 'Interés en el plan ' + plan.nombre,
        cuerpo: cuerpo,
        tipo: 'pago',
        link: '#/director/socios',
        clave: clave
      });
    }

    toast('Avisamos a dirección que te interesa el plan ' + plan.nombre + '.', 'ok');
  }

  /* Abre el recibo de un pago propio reutilizando el módulo de pagos. */
  function verRecibo(socio, pagoId) {
    var pago = DB.buscar('pagos', pagoId);
    if (!pago) { toast('No encontramos ese pago en tu historial.', 'error'); return; }
    if (pago.socioId !== socio.id) { toast('Ese recibo no pertenece a tu cuenta.', 'error'); return; }

    if (AG.Mod && AG.Mod.Pagos && typeof AG.Mod.Pagos.recibo === 'function') {
      AG.Mod.Pagos.recibo(pagoId);
      return;
    }
    toast('El recibo no está disponible en este momento. Pídelo en recepción.', 'warn');
  }

  /* =============================================================
     12. Página completa
     ============================================================= */

  function paginaSinSocio(mensaje) {
    return '<div class="page">' +
      '<div class="card"><div class="card-body">' +
        vacioHTML(mensaje, 'candado') +
      '</div></div>' +
    '</div>';
  }

  function render(ctx) {
    asegurarEstilos();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario : usuarioActual();
    if (!usuario || usuario.rol !== 'socio') {
      return paginaSinSocio('Esta pantalla es del panel del socio. Entra con tu cuenta de socio para ver tu membresía.');
    }

    /* Se trabaja SIEMPRE con el expediente de la sesión: nunca con un id de la URL. */
    var socio = DB.usuario(usuario.id) || usuario;
    if (!socio || socio.rol !== 'socio') {
      return paginaSinSocio('No encontramos tu expediente de socio. Avisa en recepción para revisarlo.');
    }

    var pagos = DB.pagosDe(socio.id);
    var planes = DB.get('planes');
    var pagados = pagos.filter(esPagado);
    var renovacion = datosRenovacion(socio, pagos, planes);

    var meses = Calc.mesesDeMembresia(socio, pagos);
    var antiguedad = Calc.antiguedadTexto(socio.fechaAlta);
    var invertido = U.suma(pagados, 'monto');
    var ultimoPago = pagados.length ? pagados[0] : null;

    var html = '<div class="page" data-membresia>';

    html += '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title">' + icono('tarjeta', 24) + '<span>Mi membresía</span></h1>' +
        '<p class="page-sub">Tu credencial, el estado de tu plan y todos tus pagos en un solo lugar.</p>' +
      '</div>' +
      '<div class="page-acciones">' +
        '<button type="button" class="btn btn-outline" data-copiar-codigo="' + esc(codigoDe(socio)) + '">' +
          icono('tarjeta', 16) + ' Copiar mi código</button>' +
        '<button type="button" class="btn btn-primary" data-credencial-grande>' +
          icono('qr', 16) + ' Mostrar en grande</button>' +
      '</div>' +
    '</div>';

    /* --- Credencial digital --- */
    html += credencialHTML(socio, { grande: false });

    /* --- KPIs --- */
    html += '<div class="grid g3">' +
      kpiHTML('calendario', String(meses) + (meses === 1 ? ' mes' : ' meses'),
        'Meses acumulados', 'kpi-info', 'Mensualidades cubiertas') +
      kpiHTML('trofeo', antiguedad, 'Antigüedad', '',
        socio.fechaAlta ? 'Socio desde el ' + U.fecha(socio.fechaAlta, 'corto') : 'Sin fecha de alta') +
      kpiHTML('dinero', U.dinero(invertido, 0), 'Total invertido', 'kpi-ok',
        ultimoPago ? 'Último pago ' + U.fechaRelativa(ultimoPago.fecha) : 'Sin pagos registrados') +
    '</div>';

    /* --- Estado de la membresía --- */
    html += cardHTML('Estado de tu membresía', 'reloj',
      estadoMembresiaHTML(socio, pagos, renovacion));

    /* --- Historial de pagos --- */
    html += cardHTML('Historial de pagos', 'historial', lineaDePagosHTML(pagos),
      '<span class="badge badge-muted">' + esc(String(pagos.length)) + '</span>');

    /* --- Gráficas --- */
    html += '<div class="grid g2">' +
      cardHTML('Lo que has pagado por mes', 'grafica', graficaMensualHTML(pagos)) +
      cardHTML('En qué se fue tu inversión', 'dinero', graficaConceptosHTML(pagos)) +
    '</div>';

    /* --- Planes disponibles --- */
    html += cardHTML('Planes disponibles', 'tarjeta', planesHTML(socio, planes),
      '<span class="mini muted">Precios vigentes</span>');

    /* --- Asistencias del mes --- */
    html += cardHTML('Tus asistencias de ' + U.nombreMes(U.mesActual()), 'qr', asistenciasHTML(socio));

    html += '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root, socio); }
    };
  }

  /* =============================================================
     13. Delegación de eventos
     ============================================================= */

  function enganchar(root, socio) {
    var raiz = root ? root.querySelector('[data-membresia]') : null;
    if (!raiz || raiz.__memEnganchado) return;
    raiz.__memEnganchado = true;

    asegurarEstilos();

    U.delegar(raiz, 'click', '[data-credencial-grande]', function (e) {
      e.preventDefault();
      mostrarCredencial(socio.id);
    });

    U.delegar(raiz, 'click', '[data-copiar-codigo]', function (e, el) {
      e.preventDefault();
      var codigo = el.getAttribute('data-copiar-codigo') || '';
      U.copiar(codigo).then(function () {
        toast('Copiamos tu código ' + codigo + '.', 'ok');
      }, function () {
        toast('No pudimos copiar el código. Anótalo: ' + codigo, 'warn');
      });
    });

    U.delegar(raiz, 'click', '[data-recibo]', function (e, el) {
      e.preventDefault();
      verRecibo(socio, el.getAttribute('data-recibo'));
    });

    U.delegar(raiz, 'click', '[data-avisar-recepcion]', function (e) {
      e.preventDefault();
      var pagos = DB.pagosDe(socio.id);
      avisarRecepcion(socio, datosRenovacion(socio, pagos, DB.get('planes')));
    });

    U.delegar(raiz, 'click', '[data-plan-interes]', function (e, el) {
      e.preventDefault();
      avisarInteresPlan(socio, el.getAttribute('data-plan-interes'));
    });
  }

  /* =============================================================
     14. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.SocioPagos = {
    render: render,
    credencial: credencialHTML,
    mostrarCredencial: mostrarCredencial,
    codigoAcceso: codigoAccesoSVG
  };

  AG.Router.registrar({
    path: 'socio/membresia',
    roles: ['socio'],
    titulo: 'Mi membresía',
    nav: { etiqueta: 'Mi membresía', icono: 'tarjeta', grupo: 'Mi cuenta', orden: 1 },
    render: render
  });

})(window.AG);
