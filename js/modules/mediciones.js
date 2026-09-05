/* =============================================================
   ALLIANCE GYM — AG.Mod.Mediciones
   -------------------------------------------------------------
   El módulo más importante del sistema: el coach mide al INICIO
   del mes y al FINAL del mes; con esas dos mediciones el sistema
   arma solo el comparativo que el socio ve en su panel.

   Rutas: 'coach/mediciones' y 'director/mediciones'.

   API compartida (la usan otras pantallas):
     AG.Mod.Mediciones.capturar(socioId, tipo, periodo)  -> modal
     AG.Mod.Mediciones.comparativo(socioId, periodo, opts) -> string HTML
     AG.Mod.Mediciones.historial(socioId)                -> string HTML

   Reglas: JavaScript clásico, sin módulos, todo escapado con
   AG.Utils.esc(), nada de alert/confirm/prompt, nada de
   localStorage directo, y ningún estado sin su vacío en español.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Perímetros corporales, en el orden en que se toman en cabina. */
  var MEDIDAS = [
    { clave: 'cuello', etiqueta: 'Cuello' },
    { clave: 'hombros', etiqueta: 'Hombros' },
    { clave: 'pecho', etiqueta: 'Pecho' },
    { clave: 'brazoDer', etiqueta: 'Brazo derecho' },
    { clave: 'brazoIzq', etiqueta: 'Brazo izquierdo' },
    { clave: 'cintura', etiqueta: 'Cintura' },
    { clave: 'cadera', etiqueta: 'Cadera' },
    { clave: 'musloDer', etiqueta: 'Muslo derecho' },
    { clave: 'musloIzq', etiqueta: 'Muslo izquierdo' },
    { clave: 'pantorrilla', etiqueta: 'Pantorrilla' }
  ];

  var PLIEGUES = [
    { clave: 'triceps', etiqueta: 'Tríceps' },
    { clave: 'subescapular', etiqueta: 'Subescapular' },
    { clave: 'suprailiaco', etiqueta: 'Suprailiaco' },
    { clave: 'abdominal', etiqueta: 'Abdominal' },
    { clave: 'muslo', etiqueta: 'Muslo' }
  ];

  var FUERZA = [
    { clave: 'pressBanca', etiqueta: 'Press de banca' },
    { clave: 'sentadilla', etiqueta: 'Sentadilla' },
    { clave: 'pesoMuerto', etiqueta: 'Peso muerto' }
  ];

  /* Métricas que se pueden graficar en el historial. */
  var METRICAS = [
    { clave: 'peso', etiqueta: 'Peso', unidad: 'kg', ruta: 'pesoKg' },
    { clave: 'grasa', etiqueta: 'Grasa', unidad: '%', ruta: 'grasaPct' },
    { clave: 'musculo', etiqueta: 'Músculo', unidad: 'kg', ruta: 'musculoKg' },
    { clave: 'cintura', etiqueta: 'Cintura', unidad: 'cm', ruta: 'medidas.cintura' }
  ];

  /* Estado vivo de la pantalla (sobrevive a los repintados del router). */
  var estado = {
    periodo: '',
    coachFiltro: '',
    busqueda: '',
    metrica: 'peso'
  };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function dos(n) { return (Number(n) < 10 ? '0' : '') + Number(n); }

  /* Número finito o null (nunca NaN, nunca cadena vacía). */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  /* Número positivo o null. */
  function nPos(v) {
    var x = n0(v);
    return (x !== null && x > 0) ? x : null;
  }

  /* Lee 'medidas.cintura' de un objeto sin reventar. */
  function porRuta(obj, ruta) {
    if (!obj || !ruta) return null;
    var partes = String(ruta).split('.');
    var actual = obj;
    for (var i = 0; i < partes.length; i++) {
      if (actual === null || actual === undefined) return null;
      actual = actual[partes[i]];
    }
    return n0(actual);
  }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) { U.toast(mensaje, tipo || 'info'); }

  /* 'YYYY-MM' desplazado n meses. */
  function moverMes(periodo, n) {
    var base = (periodo || U.mesActual()) + '-01';
    return U.mesDe(U.sumaMeses(base, n));
  }

  /* Fecha propuesta al abrir la captura. */
  function fechaSugerida(periodo, tipo) {
    if (periodo === U.mesActual()) return U.hoy();
    var p = U.partesDe(periodo + '-01');
    if (!p) return U.hoy();
    if (tipo === 'inicial') return periodo + '-01';
    return periodo + '-' + dos(U.diasDelMes(p.a, p.m));
  }

  function etiquetaObjetivo(objetivo) {
    return (Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[objetivo]) || 'Sin objetivo definido';
  }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function puedeVer(usuario, socioId) {
    if (AG.Auth && typeof AG.Auth.puedeVer === 'function') {
      try { return AG.Auth.puedeVer(usuario, socioId); } catch (e) { return false; }
    }
    return false;
  }

  function puedeEditar(usuario) {
    return !!usuario && (usuario.rol === 'coach' || usuario.rol === 'director');
  }

  /* Socios que el usuario tiene derecho a ver. */
  function sociosVisibles(usuario) {
    if (!usuario) return [];
    if (usuario.rol === 'director') return AG.DB.socios();
    if (usuario.rol === 'coach') return AG.DB.sociosDe(usuario.id);
    return [];
  }

  /* Socios que sí se miden este mes (los dados de baja no cuentan). */
  function esMedible(socio) {
    return !!socio && socio.activo !== false && socio.estado !== 'baja';
  }

  /* Última medición del socio distinta a la que se está editando. */
  function ultimaMedicion(socioId, excluirId) {
    var lista = AG.DB.medicionesDe(socioId);
    for (var i = lista.length - 1; i >= 0; i--) {
      if (excluirId && lista[i].id === excluirId) continue;
      return lista[i];
    }
    return null;
  }

  /* Notifica una sola vez por clave (editar no vuelve a avisar). */
  function notificarUnaVez(usuarioId, clave, datos) {
    var repetida = AG.DB.donde('notificaciones', function (n) {
      return n && n.usuarioId === usuarioId && n.clave === clave;
    });
    if (repetida.length) return null;
    datos.clave = clave;
    return AG.DB.notificar(usuarioId, datos);
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-mediciones';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.med-mes{min-width:150px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums}' +
      '.med-col{display:flex;flex-direction:column;gap:10px;min-width:0}' +
      '.med-tarjeta{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}' +
      '.med-tarjeta .med-pills{display:flex;flex-wrap:wrap;gap:6px}' +
      '.med-seccion{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);margin-bottom:12px;overflow:hidden}' +
      '.med-seccion>summary{cursor:pointer;list-style:none;padding:11px 13px;font-size:13px;' +
        'font-weight:800;color:var(--texto);display:flex;align-items:center;gap:8px}' +
      '.med-seccion>summary::-webkit-details-marker{display:none}' +
      '.med-seccion>summary svg{color:var(--rojo);flex:0 0 auto}' +
      '.med-seccion>summary::after{content:"+";margin-left:auto;color:var(--texto-3);' +
        'font-size:17px;font-weight:800;line-height:1}' +
      '.med-seccion[open]>summary::after{content:"\\2212"}' +
      '.med-seccion[open]>summary{border-bottom:1px solid var(--borde)}' +
      '.med-cuerpo{padding:13px}' +
      '.med-metricas{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}' +
      '.med-metrica{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:12px;text-align:center;min-width:0}' +
      '.med-metrica .med-flujo{font-size:15px;font-weight:800;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.med-delta{display:inline-flex;align-items:center;gap:4px;font-weight:800;' +
        'font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.med-delta svg{width:14px;height:14px}' +
      '@media (max-width:700px){.med-metricas{grid-template-columns:repeat(2,minmax(0,1fr))}' +
        '.med-mes{min-width:0;flex:1 1 auto}}' +
      '@media (max-width:380px){.med-metricas{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function personaHTML(socio) {
    return '<div class="persona">' + U.avatar(socio, 'sm') +
      '<div class="persona-txt">' +
        '<b>' + esc(U.nombreCompleto(socio)) + '</b>' +
        '<span>' + esc(etiquetaObjetivo(socio.objetivo)) +
          (socio.codigo ? ' · ' + esc(socio.codigo) : '') + '</span>' +
      '</div>' +
    '</div>';
  }

  function pill(etiqueta, valor, clase) {
    return '<span class="pill' + (clase ? ' ' + clase : '') + '">' +
      esc(etiqueta) + ' <b>' + esc(valor) + '</b></span>';
  }

  function vacioHTML(mensaje, botonHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono('regla', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botonHTML || '') +
    '</div>';
  }

  function claseTendencia(tendencia) {
    if (tendencia === 'mejor') return 'txt-ok';
    if (tendencia === 'peor') return 'txt-error';
    return 'muted';
  }

  /* Delta con flecha e color según la tendencia calculada por AG.Calc. */
  function deltaHTML(delta, dec, unidad, tendencia) {
    if (delta === null || delta === undefined) {
      return '<span class="med-delta muted">Sin dato</span>';
    }
    var nombre = delta > 0 ? 'flecha-arriba' : (delta < 0 ? 'flecha-abajo' : 'flecha-der');
    return '<span class="med-delta ' + claseTendencia(tendencia) + '">' +
      icono(nombre, 14) + esc(U.signo(delta, dec, unidad)) + '</span>';
  }

  function anilloHTML(puntaje, tamano) {
    var grande = tamano === 'lg';
    var svg = Charts.progreso(puntaje, {
      texto: String(Math.round(puntaje)),
      etiqueta: grande ? 'Puntaje' : '',
      alto: grande ? 168 : 78,
      grosor: grande ? 14 : 8
    });
    return '<div class="anillo ' + (grande ? 'anillo-lg' : 'anillo-sm') + '">' + svg + '</div>';
  }

  /* =============================================================
     4. Cálculo del tablero del mes
     ============================================================= */

  function calcularTablero(usuario, periodo) {
    var lista = sociosVisibles(usuario).filter(esMedible);

    if (usuario.rol === 'director' && estado.coachFiltro) {
      lista = lista.filter(function (s) {
        return estado.coachFiltro === 'sin_coach'
          ? !s.coachId
          : s.coachId === estado.coachFiltro;
      });
    }

    var texto = U.normalizar(estado.busqueda || '');
    if (texto) {
      lista = lista.filter(function (s) {
        return U.normalizar(U.nombreCompleto(s) + ' ' + (s.codigo || '') + ' ' + (s.email || '')).indexOf(texto) >= 0;
      });
    }

    lista = U.ordenar(lista, function (s) { return U.normalizar(U.nombreCompleto(s)); }, 'asc');

    var pendientes = [], enCurso = [], cerrados = [];
    var conInicial = 0, conFinal = 0;

    for (var i = 0; i < lista.length; i++) {
      var socio = lista[i];
      var ini = AG.DB.medicionDelMes(socio.id, periodo, 'inicial');
      var fin = AG.DB.medicionDelMes(socio.id, periodo, 'final');
      if (ini) conInicial++;
      if (fin) conFinal++;

      if (ini && fin) cerrados.push({ socio: socio, ini: ini, fin: fin });
      else if (ini) enCurso.push({ socio: socio, ini: ini });
      else pendientes.push({ socio: socio, fin: fin });
    }

    var total = lista.length;
    var avance = total ? Math.round((conInicial + conFinal) / (total * 2) * 100) : 0;

    return {
      periodo: periodo,
      total: total,
      pendientes: pendientes,
      enCurso: enCurso,
      cerrados: cerrados,
      conInicial: conInicial,
      conFinal: conFinal,
      avance: avance
    };
  }

  /* =============================================================
     5. Pantalla principal (coach / director)
     ============================================================= */

  function selectorPeriodoHTML(periodo) {
    var enActual = periodo >= U.mesActual();
    return '<div class="row-sm">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mes="-1" title="Mes anterior" aria-label="Mes anterior">&lsaquo;</button>' +
      '<span class="med-mes" data-mes-etiqueta>' + esc(U.nombreMes(periodo)) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mes="1" title="Mes siguiente" aria-label="Mes siguiente"' +
        (enActual ? ' disabled' : '') + '>&rsaquo;</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-mes-actual' +
        (periodo === U.mesActual() ? ' disabled' : '') + '>Mes actual</button>' +
    '</div>';
  }

  function kpiHTML(iconoNombre, valor, etiqueta, variante) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(iconoNombre, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
      '</div>' +
    '</div>';
  }

  function kpisHTML(datos) {
    return '<div class="grid g5">' +
      kpiHTML('socios', String(datos.total), 'Socios a medir', '') +
      kpiHTML('regla', String(datos.conInicial), 'Iniciales hechas', 'kpi-info') +
      kpiHTML('balanza', String(datos.conFinal), 'Finales hechas', 'kpi-warn') +
      kpiHTML('check', String(datos.cerrados.length), 'Meses cerrados', 'kpi-ok') +
      kpiHTML('meta', U.pct(datos.avance, 0), 'Avance del mes',
        datos.avance >= 80 ? 'kpi-ok' : (datos.avance >= 40 ? 'kpi-warn' : 'kpi-error')) +
    '</div>';
  }

  function filtrosHTML(usuario) {
    var html = '<div class="card"><div class="card-body"><div class="row wrap">' +
      '<div class="field flex1">' +
        '<input class="input" type="search" data-buscar autocomplete="off" ' +
          'aria-label="Buscar socio" placeholder="Buscar por nombre, código o correo" value="' +
          esc(estado.busqueda) + '">' +
      '</div>';

    if (usuario.rol === 'director') {
      var coaches = U.ordenar(AG.DB.coaches(), function (c) { return U.normalizar(U.nombreCompleto(c)); }, 'asc');
      html += '<div class="field"><select class="select" data-coach aria-label="Filtrar por coach">' +
        '<option value="">Todos los coaches</option>';
      for (var i = 0; i < coaches.length; i++) {
        html += '<option value="' + esc(coaches[i].id) + '"' +
          (estado.coachFiltro === coaches[i].id ? ' selected' : '') + '>' +
          esc(U.nombreCompleto(coaches[i])) + '</option>';
      }
      html += '<option value="sin_coach"' + (estado.coachFiltro === 'sin_coach' ? ' selected' : '') +
        '>Sin coach asignado</option></select></div>';
    }

    html += '</div></div></div>';
    return html;
  }

  function accionesTarjeta(botonPrincipal, socioId) {
    return '<div class="row-sm wrap">' + botonPrincipal +
      '<button type="button" class="btn btn-ghost btn-sm" data-historial="' + esc(socioId) + '">' +
        icono('historial', 15) + ' Historial</button>' +
    '</div>';
  }

  function tarjetaPendiente(fila, periodo) {
    var socio = fila.socio;
    var ultima = ultimaMedicion(socio.id, null);
    var pills = '';
    if (fila.fin) pills += '<span class="badge badge-warn">Falta la inicial</span>';
    pills += ultima
      ? pill('Última medición', U.fecha(ultima.fecha, 'corto'))
      : '<span class="pill">Sin mediciones previas</span>';

    return '<div class="med-tarjeta">' +
      personaHTML(socio) +
      '<div class="med-pills">' + pills + '</div>' +
      accionesTarjeta(
        '<button type="button" class="btn btn-primary btn-sm flex1" data-medir="' + esc(socio.id) +
          '" data-tipo="inicial" data-periodo="' + esc(periodo) + '">' +
          icono('regla', 15) + ' Medir inicio</button>',
        socio.id) +
    '</div>';
  }

  function tarjetaEnCurso(fila, periodo) {
    var socio = fila.socio, m = fila.ini;
    var pills = pill('Inicio', U.fecha(m.fecha, 'corto'));
    if (nPos(m.pesoKg) !== null) pills += pill('Peso', U.num(m.pesoKg, 1) + ' kg');
    if (n0(m.grasaPct) !== null) pills += pill('Grasa', U.num(m.grasaPct, 1) + ' %');
    if (m.medidas && nPos(m.medidas.cintura) !== null) pills += pill('Cintura', U.num(m.medidas.cintura, 1) + ' cm');
    if (n0(m.imc) !== null) pills += pill('IMC', U.num(m.imc, 1));

    return '<div class="med-tarjeta">' +
      personaHTML(socio) +
      '<div class="med-pills">' + pills + '</div>' +
      accionesTarjeta(
        '<button type="button" class="btn btn-primary btn-sm flex1" data-medir="' + esc(socio.id) +
          '" data-tipo="final" data-periodo="' + esc(periodo) + '">' +
          icono('check', 15) + ' Cerrar mes</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-medir="' + esc(socio.id) +
          '" data-tipo="inicial" data-periodo="' + esc(periodo) + '">' +
          icono('editar', 15) + ' Editar inicial</button>',
        socio.id) +
    '</div>';
  }

  function tarjetaCerrada(fila, periodo) {
    var socio = fila.socio;
    var cmp = Calc.compararMediciones(fila.ini, fila.fin, socio.objetivo);
    var resumen = cmp.ok ? cmp.resumen : null;
    var puntaje = resumen ? resumen.puntaje : 0;

    var lado = '<div class="flex1 stack-sm">' +
      '<span class="badge ' + esc(resumen ? resumen.clase : 'badge-muted') + '">' +
        esc(Calc.textoNivel(resumen ? resumen.nivel : '')) + '</span>' +
      '<p class="mini muted">' + esc(U.truncar(resumen ? resumen.veredicto : 'Sin datos suficientes para evaluar el periodo.', 110)) + '</p>' +
    '</div>';

    return '<div class="med-tarjeta">' +
      personaHTML(socio) +
      '<div class="row">' + anilloHTML(puntaje, 'sm') + lado + '</div>' +
      accionesTarjeta(
        '<button type="button" class="btn btn-primary btn-sm flex1" data-comparativo="' + esc(socio.id) +
          '" data-periodo="' + esc(periodo) + '">' +
          icono('grafica', 15) + ' Ver comparativo</button>',
        socio.id) +
    '</div>';
  }

  function columnaHTML(titulo, iconoNombre, filas, pintor, periodo, vacio) {
    var cuerpo;
    if (!filas.length) {
      cuerpo = vacioHTML(vacio, '');
    } else {
      var partes = [];
      for (var i = 0; i < filas.length; i++) partes.push(pintor(filas[i], periodo));
      cuerpo = '<div class="med-col">' + partes.join('') + '</div>';
    }
    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono(iconoNombre, 18) + '<span>' + esc(titulo) + '</span></div>' +
        '<span class="badge badge-muted">' + filas.length + '</span>' +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  function tableroHTML(datos, periodo) {
    if (!datos.total) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('No hay socios que coincidan con el filtro. Ajusta la búsqueda o revisa que tengas socios asignados.', '') +
        '</div></div>';
    }
    return '<div class="grid g3">' +
      columnaHTML('Pendiente de medición inicial', 'alerta', datos.pendientes, tarjetaPendiente, periodo,
        'Nadie pendiente: todos tienen su medición de inicio de mes.') +
      columnaHTML('En curso', 'reloj', datos.enCurso, tarjetaEnCurso, periodo,
        'Sin socios en curso. En cuanto midas el inicio de mes aparecerán aquí.') +
      columnaHTML('Mes cerrado', 'trofeo', datos.cerrados, tarjetaCerrada, periodo,
        'Todavía no cierras ningún mes. Al capturar la medición final se genera el comparativo.') +
    '</div>';
  }

  function render(ctx) {
    var usuario = ctx.usuario;
    if (!estado.periodo) estado.periodo = U.mesActual();
    asegurarEstilos();

    var periodo = estado.periodo;
    var datos = calcularTablero(usuario, periodo);

    var html = '<div class="page" data-mediciones>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('regla', 24) + '<span>Mediciones</span></h1>' +
          '<p class="page-sub">Mide al inicio del mes, cierra al final y el sistema arma solo el comparativo que ve el socio en su panel.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          selectorPeriodoHTML(periodo) +
          '<button type="button" class="btn btn-primary" data-selector>' +
            icono('mas', 16) + ' Medir a un socio</button>' +
        '</div>' +
      '</div>' +
      '<div data-kpis>' + kpisHTML(datos) + '</div>' +
      filtrosHTML(usuario) +
      '<div data-tablero>' + tableroHTML(datos, periodo) + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root, usuario); }
    };
  }

  /* Repinta solo KPIs y tablero (así el buscador no pierde el foco). */
  function repintar(raiz, usuario) {
    var periodo = estado.periodo;
    var datos = calcularTablero(usuario, periodo);

    var etiqueta = raiz.querySelector('[data-mes-etiqueta]');
    if (etiqueta) etiqueta.textContent = U.nombreMes(periodo);

    var siguiente = raiz.querySelector('[data-mes="1"]');
    if (siguiente) siguiente.disabled = periodo >= U.mesActual();

    var actual = raiz.querySelector('[data-mes-actual]');
    if (actual) actual.disabled = periodo === U.mesActual();

    var kpis = raiz.querySelector('[data-kpis]');
    if (kpis) kpis.innerHTML = kpisHTML(datos);

    var tablero = raiz.querySelector('[data-tablero]');
    if (tablero) tablero.innerHTML = tableroHTML(datos, periodo);
  }

  /* =============================================================
     6. Delegación de eventos
     ============================================================= */

  /* Acciones comunes a la pantalla, a los modales y a los comparativos. */
  function engancharAcciones(raiz) {
    if (!raiz || raiz.__medEnganchado) return;
    raiz.__medEnganchado = true;

    U.delegar(raiz, 'click', '[data-medir]', function (e, el) {
      e.preventDefault();
      capturar(el.getAttribute('data-medir'), el.getAttribute('data-tipo') || 'inicial',
        el.getAttribute('data-periodo') || estado.periodo);
    });

    U.delegar(raiz, 'click', '[data-comparativo]', function (e, el) {
      e.preventDefault();
      abrirComparativo(el.getAttribute('data-comparativo'), el.getAttribute('data-periodo') || estado.periodo);
    });

    U.delegar(raiz, 'click', '[data-historial]', function (e, el) {
      e.preventDefault();
      abrirHistorial(el.getAttribute('data-historial'));
    });

    U.delegar(raiz, 'click', '[data-imprimir-comparativo]', function (e, el) {
      e.preventDefault();
      imprimirComparativo(el.getAttribute('data-imprimir-comparativo'), el.getAttribute('data-periodo'));
    });

    U.delegar(raiz, 'click', '[data-csv-historial]', function (e, el) {
      e.preventDefault();
      exportarHistorialCSV(el.getAttribute('data-csv-historial'));
    });

    U.delegar(raiz, 'click', '[data-metrica]', function (e, el) {
      e.preventDefault();
      var clave = el.getAttribute('data-metrica');
      estado.metrica = clave;
      var contenedor = el.closest('[data-historial-caja]') || raiz;
      var chips = U.$$('[data-metrica]', contenedor);
      for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('on', chips[i].getAttribute('data-metrica') === clave);
      }
      var graficas = U.$$('[data-grafica]', contenedor);
      for (var j = 0; j < graficas.length; j++) {
        graficas[j].classList.toggle('oculto', graficas[j].getAttribute('data-grafica') !== clave);
      }
    });
  }

  function enganchar(root, usuario) {
    var raiz = root.querySelector('[data-mediciones]');
    if (!raiz) return;
    asegurarEstilos();
    engancharAcciones(raiz);

    U.delegar(raiz, 'click', '[data-mes]', function (e, el) {
      e.preventDefault();
      var paso = Number(el.getAttribute('data-mes')) || 0;
      var destino = moverMes(estado.periodo, paso);
      if (destino > U.mesActual()) return;
      estado.periodo = destino;
      repintar(raiz, usuario);
    });

    U.delegar(raiz, 'click', '[data-mes-actual]', function (e) {
      e.preventDefault();
      estado.periodo = U.mesActual();
      repintar(raiz, usuario);
    });

    U.delegar(raiz, 'click', '[data-selector]', function (e) {
      e.preventDefault();
      selectorDeSocio(usuario, estado.periodo);
    });

    var buscarConRetraso = U.debounce(function () { repintar(raiz, usuario); }, 220);
    U.delegar(raiz, 'input', '[data-buscar]', function (e, el) {
      estado.busqueda = el.value || '';
      buscarConRetraso();
    });

    U.delegar(raiz, 'change', '[data-coach]', function (e, el) {
      estado.coachFiltro = el.value || '';
      repintar(raiz, usuario);
    });
  }

  /* =============================================================
     7. Selector de socio ("Medir a un socio")
     ============================================================= */

  function filaSelector(socio, periodo) {
    var ini = AG.DB.medicionDelMes(socio.id, periodo, 'inicial');
    var fin = AG.DB.medicionDelMes(socio.id, periodo, 'final');
    var etiqueta, clase, boton;

    if (ini && fin) {
      etiqueta = 'Mes cerrado'; clase = 'badge-ok';
      boton = '<button type="button" class="btn btn-outline btn-sm" data-comparativo="' + esc(socio.id) +
        '" data-periodo="' + esc(periodo) + '">Ver comparativo</button>';
    } else if (ini) {
      etiqueta = 'En curso'; clase = 'badge-warn';
      boton = '<button type="button" class="btn btn-primary btn-sm" data-medir="' + esc(socio.id) +
        '" data-tipo="final" data-periodo="' + esc(periodo) + '">Cerrar mes</button>';
    } else {
      etiqueta = 'Pendiente'; clase = 'badge-danger';
      boton = '<button type="button" class="btn btn-primary btn-sm" data-medir="' + esc(socio.id) +
        '" data-tipo="inicial" data-periodo="' + esc(periodo) + '">Medir inicio</button>';
    }

    return '<div class="list-item">' +
      '<div class="list-item-main">' + personaHTML(socio) + '</div>' +
      '<div class="list-item-side">' +
        '<span class="badge ' + clase + '">' + esc(etiqueta) + '</span>' + boton +
      '</div>' +
    '</div>';
  }

  function listaSelectorHTML(usuario, periodo, texto) {
    var lista = sociosVisibles(usuario).filter(esMedible);
    var busca = U.normalizar(texto || '');
    if (busca) {
      lista = lista.filter(function (s) {
        return U.normalizar(U.nombreCompleto(s) + ' ' + (s.codigo || '')).indexOf(busca) >= 0;
      });
    }
    lista = U.ordenar(lista, function (s) { return U.normalizar(U.nombreCompleto(s)); }, 'asc');

    if (!lista.length) {
      return vacioHTML('No encontramos socios con ese nombre. Prueba con otro texto.', '');
    }
    var html = '<div class="list">';
    for (var i = 0; i < lista.length; i++) html += filaSelector(lista[i], periodo);
    return html + '</div>';
  }

  function selectorDeSocio(usuario, periodo) {
    var cuerpo = '<div class="stack-sm" data-selector-caja>' +
      '<div class="field">' +
        '<input class="input" type="search" data-buscar-socio autocomplete="off" ' +
          'placeholder="Buscar socio" aria-label="Buscar socio">' +
      '</div>' +
      '<p class="mini muted">Periodo: <b>' + esc(U.nombreMes(periodo)) + '</b></p>' +
      '<div class="scroll-y" data-lista-socios>' + listaSelectorHTML(usuario, periodo, '') + '</div>' +
    '</div>';

    var api = U.modal({
      titulo: 'Medir a un socio',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root) {
        var caja = root.querySelector('[data-selector-caja]');
        if (!caja) return;
        engancharAcciones(caja);

        var refrescarLista = U.debounce(function (valor) {
          var destino = caja.querySelector('[data-lista-socios]');
          if (destino) destino.innerHTML = listaSelectorHTML(usuario, periodo, valor);
        }, 180);

        U.delegar(caja, 'input', '[data-buscar-socio]', function (e, el) {
          refrescarLista(el.value || '');
        });

        /* Al elegir una acción, el selector se retira para no estorbar. */
        U.delegar(caja, 'click', '[data-medir],[data-comparativo]', function () {
          setTimeout(function () { api.cerrar(); }, 0);
        });
      }
    });
  }

  /* =============================================================
     8. Captura de medición (modal XL)
     ============================================================= */

  function campoNumero(nombre, etiqueta, unidad, valor, sugerido, paso) {
    var id = U.uid('cmp_');
    var v = (valor === null || valor === undefined || valor === '') ? '' : String(valor);
    var ph = (sugerido === null || sugerido === undefined || sugerido === '')
      ? (unidad || '')
      : String(U.num(sugerido, 1));
    return '<div class="field">' +
      '<label class="label" for="' + id + '">' + esc(etiqueta) +
        (unidad ? ' <span class="muted">(' + esc(unidad) + ')</span>' : '') + '</label>' +
      '<input class="input" type="number" inputmode="decimal" step="' + esc(paso || '0.1') +
        '" min="0" id="' + id + '" name="' + esc(nombre) + '" value="' + esc(v) +
        '" placeholder="' + esc(ph) + '">' +
    '</div>';
  }

  function seccion(titulo, iconoNombre, contenido, abierta) {
    return '<details class="med-seccion"' + (abierta ? ' open' : '') + '>' +
      '<summary>' + icono(iconoNombre, 16) + '<span>' + esc(titulo) + '</span></summary>' +
      '<div class="med-cuerpo">' + contenido + '</div>' +
    '</details>';
  }

  function bloqueVivo() {
    return '<div class="caja mt">' +
      '<div class="datos-grid">' +
        '<div class="dato"><span class="dato-label">IMC</span>' +
          '<span class="dato-val" data-vivo="imc">—</span>' +
          '<span data-vivo="imcBadge"></span></div>' +
        '<div class="dato"><span class="dato-label">Masa magra</span>' +
          '<span class="dato-val" data-vivo="magra">—</span></div>' +
        '<div class="dato"><span class="dato-label">Masa grasa</span>' +
          '<span class="dato-val" data-vivo="grasaKg">—</span></div>' +
        '<div class="dato"><span class="dato-label">Peso ideal</span>' +
          '<span class="dato-val" data-vivo="ideal">—</span></div>' +
      '</div>' +
    '</div>';
  }

  function formularioHTML(socio, medicion, sugerida, tipo, periodo, fecha) {
    var esFinal = tipo === 'final';
    var med = medicion || {};
    var medidasM = med.medidas || {};
    var pliegM = med.pliegues || {};
    var fuerzaM = med.fuerza || {};
    var sug = sugerida || {};
    var sugMedidas = sug.medidas || {};
    var sugPliegues = sug.pliegues || {};
    var sugFuerza = sug.fuerza || {};
    var i;

    var html = '<form data-form-medicion novalidate>';

    /* Encabezado del socio */
    html += '<div class="caja mb"><div class="row wrap between">' +
      personaHTML(socio) +
      '<div class="row-sm wrap">' +
        '<span class="badge ' + (esFinal ? 'badge-rojo' : 'badge-info') + '">' +
          (esFinal ? 'Cierre de mes' : 'Inicio de mes') + '</span>' +
        '<span class="pill">' + icono('calendario', 13) + ' ' + esc(U.nombreMes(periodo)) + '</span>' +
        (medicion ? '<span class="badge badge-warn">Editando</span>' : '') +
      '</div>' +
    '</div></div>';

    /* Fecha */
    html += '<div class="form-grid dos mb">' +
      '<div class="field">' +
        '<label class="label">Fecha de la medición</label>' +
        '<input class="input" type="date" name="fecha" value="' + esc(fecha) + '">' +
        '<span class="help">Pertenece al periodo ' + esc(U.nombreMes(periodo)) + '.</span>' +
      '</div>' +
      '<div class="field">' +
        '<label class="label">Visibilidad</label>' +
        '<label class="switch"><input type="checkbox" name="visibleParaSocio"' +
          (med.visibleParaSocio === false ? '' : ' checked') + '><span>Visible para el socio</span></label>' +
        '<span class="help">Si la apagas, el socio no verá esta medición ni recibirá aviso.</span>' +
      '</div>' +
    '</div>';

    /* --- Composición --- */
    var comp = '<div class="form-grid tres">' +
      campoNumero('pesoKg', 'Peso', 'kg', med.pesoKg, sug.pesoKg, '0.1') +
      campoNumero('estaturaCm', 'Estatura', 'cm',
        (med.estaturaCm !== undefined && med.estaturaCm !== null) ? med.estaturaCm : socio.estaturaCm,
        sug.estaturaCm, '0.5') +
      campoNumero('grasaPct', 'Grasa corporal', '%', med.grasaPct, sug.grasaPct, '0.1') +
      campoNumero('musculoKg', 'Masa muscular', 'kg', med.musculoKg, sug.musculoKg, '0.1') +
      campoNumero('aguaPct', 'Agua corporal', '%', med.aguaPct, sug.aguaPct, '0.1') +
    '</div>' + bloqueVivo();
    html += seccion('Composición corporal', 'balanza', comp, true);

    /* --- Medidas --- */
    var medidas = '<div class="form-grid tres">';
    for (i = 0; i < MEDIDAS.length; i++) {
      medidas += campoNumero('medidas.' + MEDIDAS[i].clave, MEDIDAS[i].etiqueta, 'cm',
        medidasM[MEDIDAS[i].clave], sugMedidas[MEDIDAS[i].clave], '0.1');
    }
    medidas += '</div>' +
      '<div class="row-sm wrap mt">' +
        '<button type="button" class="btn btn-outline btn-sm" data-navy>' +
          icono('calculadora', 15) + ' Estimar grasa % (US Navy)</button>' +
        '<span class="help">Usa cintura, cuello' +
          (String(socio.sexo || '').toUpperCase() === 'M' ? ', cadera' : '') + ' y estatura.</span>' +
      '</div>';
    html += seccion('Medidas corporales', 'cinta', medidas, true);

    /* --- Pliegues (opcional, colapsado) --- */
    var pliegues = '<div class="form-grid tres">';
    for (i = 0; i < PLIEGUES.length; i++) {
      pliegues += campoNumero('pliegues.' + PLIEGUES[i].clave, PLIEGUES[i].etiqueta, 'mm',
        pliegM[PLIEGUES[i].clave], sugPliegues[PLIEGUES[i].clave], '0.5');
    }
    pliegues += '</div>' +
      '<div class="row-sm wrap mt">' +
        '<button type="button" class="btn btn-outline btn-sm" data-pliegues>' +
          icono('calculadora', 15) + ' Estimar grasa % (pliegues)</button>' +
        '<span class="help">Necesita al menos tres pliegues capturados.</span>' +
      '</div>';
    html += seccion('Pliegues cutáneos (opcional)', 'regla', pliegues, false);

    /* --- Salud --- */
    var salud = '<div class="form-grid dos">' +
      '<div class="field">' +
        '<label class="label">Presión arterial</label>' +
        '<input class="input" type="text" name="presion" maxlength="12" value="' +
          esc(med.presion || '') + '" placeholder="' + esc(sug.presion || '120/80') + '">' +
      '</div>' +
      campoNumero('fcReposo', 'Frecuencia cardiaca en reposo', 'lpm', med.fcReposo, sug.fcReposo, '1') +
    '</div>';
    html += seccion('Salud', 'corazon', salud, true);

    /* --- Fuerza (opcional) --- */
    var fuerza = '<div class="form-grid tres">';
    for (i = 0; i < FUERZA.length; i++) {
      var f = FUERZA[i];
      fuerza += '<div class="field">' +
        '<label class="label">' + esc(f.etiqueta) + ' <span class="muted">(kg)</span></label>' +
        '<div class="row-sm">' +
          '<input class="input flex1" type="number" inputmode="decimal" step="0.5" min="0" name="fuerza.' +
            esc(f.clave) + '" value="' + esc(fuerzaM[f.clave] === null || fuerzaM[f.clave] === undefined ? '' : fuerzaM[f.clave]) +
            '" placeholder="' + esc(sugFuerza[f.clave] === null || sugFuerza[f.clave] === undefined ? 'kg' : String(sugFuerza[f.clave])) + '">' +
          '<input class="input" type="number" inputmode="numeric" step="1" min="1" max="30" name="rm.' +
            esc(f.clave) + '" value="1" aria-label="Repeticiones de ' + esc(f.etiqueta) + '" style="max-width:78px">' +
        '</div>' +
        '<span class="help" data-rm="' + esc(f.clave) + '">1RM estimado: —</span>' +
      '</div>';
    }
    fuerza += '</div>' +
      '<p class="mini muted mt">Se guarda el peso levantado; el 1RM (fórmula de Epley) es solo una referencia de trabajo.</p>';
    html += seccion('Fuerza (opcional)', 'pesa', fuerza, false);

    /* --- Notas --- */
    html += '<div class="field">' +
      '<label class="label">Notas del coach</label>' +
      '<textarea class="textarea" name="notas" rows="3" placeholder="Observaciones del periodo, molestias, acuerdos…">' +
        esc(med.notas || '') + '</textarea>' +
    '</div>';

    html += '</form>';
    return html;
  }

  /* Recalcula los valores derivados que se muestran en vivo. */
  function actualizarVivo(form, socio) {
    if (!form) return;
    var d = U.formToObject(form);
    var peso = nPos(d.pesoKg);
    var estatura = nPos(d.estaturaCm) || nPos(socio.estaturaCm);
    var grasa = n0(d.grasaPct);

    var imc = Calc.imc(peso, estatura);
    var nodoImc = U.$('[data-vivo="imc"]', form);
    if (nodoImc) nodoImc.textContent = imc !== null ? U.num(imc, 1) : '—';

    var nodoBadge = U.$('[data-vivo="imcBadge"]', form);
    if (nodoBadge) {
      if (imc === null) {
        nodoBadge.innerHTML = '';
      } else {
        var clas = Calc.clasificacionIMC(imc);
        nodoBadge.innerHTML = '<span class="badge ' + esc(clas.clase) + '">' + esc(clas.texto) + '</span>';
      }
    }

    var magra = Calc.masaMagra(peso, grasa);
    var nodoMagra = U.$('[data-vivo="magra"]', form);
    if (nodoMagra) nodoMagra.textContent = magra !== null ? (U.num(magra, 1) + ' kg') : '—';

    var grasaKg = Calc.masaGrasa(peso, grasa);
    var nodoGrasa = U.$('[data-vivo="grasaKg"]', form);
    if (nodoGrasa) nodoGrasa.textContent = grasaKg !== null ? (U.num(grasaKg, 1) + ' kg') : '—';

    var ideal = Calc.pesoIdeal(estatura, socio.sexo);
    var nodoIdeal = U.$('[data-vivo="ideal"]', form);
    if (nodoIdeal) {
      nodoIdeal.textContent = (ideal && ideal.min !== null)
        ? (U.num(ideal.min, 1) + ' – ' + U.num(ideal.max, 1) + ' kg')
        : '—';
    }

    for (var i = 0; i < FUERZA.length; i++) {
      var clave = FUERZA[i].clave;
      var pesoF = nPos(U.obtenerRuta(d, 'fuerza.' + clave));
      var reps = n0(U.obtenerRuta(d, 'rm.' + clave));
      var rm = Calc.rm1(pesoF, reps);
      var nodoRm = U.$('[data-rm="' + clave + '"]', form);
      if (nodoRm) nodoRm.textContent = rm !== null ? ('1RM estimado: ' + U.num(rm, 1) + ' kg') : '1RM estimado: —';
    }
  }

  /* Rellena el campo de grasa con la estimación pedida. */
  function estimarNavy(form, socio) {
    var d = U.formToObject(form);
    var cintura = nPos(U.obtenerRuta(d, 'medidas.cintura'));
    var cuello = nPos(U.obtenerRuta(d, 'medidas.cuello'));
    var cadera = nPos(U.obtenerRuta(d, 'medidas.cadera'));
    var estatura = nPos(d.estaturaCm) || nPos(socio.estaturaCm);
    var mujer = String(socio.sexo || '').toUpperCase() === 'M';

    if (cintura === null || cuello === null) {
      toast('Captura cintura y cuello para estimar la grasa corporal.', 'warn');
      return;
    }
    if (mujer && cadera === null) {
      toast('En mujeres el método US Navy también necesita la cadera.', 'warn');
      return;
    }
    if (estatura === null) {
      toast('Falta la estatura: captúrala en composición corporal.', 'warn');
      return;
    }

    var resultado = Calc.grasaCorporalNavy(socio.sexo, cintura, cuello, cadera, estatura);
    if (resultado === null) {
      toast('Con esas medidas la fórmula no da un resultado válido; revisa cintura y cuello.', 'error');
      return;
    }

    var campo = U.$('[name="grasaPct"]', form);
    if (campo) campo.value = String(resultado);
    actualizarVivo(form, socio);
    toast('Grasa estimada por US Navy: ' + U.pct(resultado, 1) + '. Ajústala si tienes una medición mejor.', 'ok');
  }

  function estimarPliegues(form, socio) {
    var d = U.formToObject(form);
    var pliegues = {};
    var cuantos = 0;
    for (var i = 0; i < PLIEGUES.length; i++) {
      var v = nPos(U.obtenerRuta(d, 'pliegues.' + PLIEGUES[i].clave));
      pliegues[PLIEGUES[i].clave] = v;
      if (v !== null) cuantos++;
    }
    if (cuantos < 3) {
      toast('Necesitas al menos tres pliegues capturados para estimar la grasa.', 'warn');
      return;
    }

    var edad = U.edad(socio.fechaNacimiento);
    var resultado = Calc.grasaCorporalPliegues(socio.sexo, edad, pliegues);
    if (resultado === null) {
      toast('Con esos pliegues la fórmula no da un resultado válido; revisa los milímetros capturados.', 'error');
      return;
    }

    var campo = U.$('[name="grasaPct"]', form);
    if (campo) campo.value = String(resultado);
    actualizarVivo(form, socio);
    toast('Grasa estimada por pliegues: ' + U.pct(resultado, 1) + '.', 'ok');
  }

  /* Arma el objeto Medicion a partir del formulario. Devuelve null si falta lo esencial. */
  function recolectar(form, socio, tipo, periodo, coachId) {
    var d = U.formToObject(form);
    var peso = nPos(d.pesoKg);

    if (peso === null) {
      toast('Captura al menos el peso corporal para guardar la medición.', 'error');
      var campoPeso = U.$('[name="pesoKg"]', form);
      if (campoPeso) { try { campoPeso.focus(); } catch (e) { /* sin foco disponible */ } }
      return null;
    }
    if (peso > 400) {
      toast('El peso capturado no parece válido: revísalo antes de guardar.', 'error');
      return null;
    }

    var estatura = nPos(d.estaturaCm) || nPos(socio.estaturaCm);
    var fecha = (typeof d.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) ? d.fecha : U.hoy();

    var medidas = {}, pliegues = {}, fuerza = {};
    var i;
    for (i = 0; i < MEDIDAS.length; i++) {
      medidas[MEDIDAS[i].clave] = nPos(U.obtenerRuta(d, 'medidas.' + MEDIDAS[i].clave));
    }
    for (i = 0; i < PLIEGUES.length; i++) {
      pliegues[PLIEGUES[i].clave] = nPos(U.obtenerRuta(d, 'pliegues.' + PLIEGUES[i].clave));
    }
    for (i = 0; i < FUERZA.length; i++) {
      fuerza[FUERZA[i].clave] = nPos(U.obtenerRuta(d, 'fuerza.' + FUERZA[i].clave));
    }

    return {
      socioId: socio.id,
      coachId: coachId || socio.coachId || null,
      fecha: fecha,
      periodo: periodo,
      tipo: tipo,
      pesoKg: peso,
      estaturaCm: estatura,
      grasaPct: n0(d.grasaPct),
      musculoKg: nPos(d.musculoKg),
      aguaPct: n0(d.aguaPct),
      imc: Calc.imc(peso, estatura),
      medidas: medidas,
      pliegues: pliegues,
      presion: typeof d.presion === 'string' ? d.presion : '',
      fcReposo: nPos(d.fcReposo),
      fuerza: fuerza,
      notas: typeof d.notas === 'string' ? d.notas : '',
      visibleParaSocio: d.visibleParaSocio !== false
    };
  }

  function avisarAlSocio(socio, tipo, periodo, hayInicial) {
    var mes = U.nombreMes(periodo);
    if (tipo === 'inicial') {
      notificarUnaVez(socio.id, 'medicion-inicial:' + periodo, {
        titulo: 'Tu medición de inicio de mes ya está en tu panel',
        cuerpo: 'Tu coach registró tu medición inicial de ' + mes + '. Revisa tus números en Mi progreso.',
        tipo: 'medicion',
        link: '#/socio/progreso'
      });
      return;
    }
    if (hayInicial) {
      notificarUnaVez(socio.id, 'medicion-cierre:' + periodo, {
        titulo: '¡Tu cierre de mes está listo!',
        cuerpo: 'Ya puedes ver tu comparativo de ' + mes + ': cuánto cambiaste del inicio al final del mes.',
        tipo: 'medicion',
        link: '#/socio/progreso'
      });
      return;
    }
    notificarUnaVez(socio.id, 'medicion-final:' + periodo, {
      titulo: 'Tu medición de cierre de mes ya está en tu panel',
      cuerpo: 'Tu coach registró tu medición final de ' + mes + '. Falta la inicial para armar el comparativo.',
      tipo: 'medicion',
      link: '#/socio/progreso'
    });
  }

  /**
   * Abre el modal de captura de una medición.
   * @param {String} socioId
   * @param {'inicial'|'final'} tipo
   * @param {String} periodo 'YYYY-MM'
   */
  function capturar(socioId, tipo, periodo) {
    asegurarEstilos();

    var usuario = usuarioActual();
    var socio = AG.DB.usuario(socioId);
    var claseTipo = (tipo === 'final') ? 'final' : 'inicial';
    var mes = (typeof periodo === 'string' && /^\d{4}-\d{2}/.test(periodo)) ? periodo.slice(0, 7) : U.mesActual();

    if (!socio || socio.rol !== 'socio') {
      toast('No encontramos a ese socio en el sistema.', 'error');
      return null;
    }
    if (!puedeEditar(usuario) || !puedeVer(usuario, socio.id)) {
      toast('No tienes permiso para medir a este socio.', 'error');
      return null;
    }

    var existente = AG.DB.medicionDelMes(socio.id, mes, claseTipo);
    var sugerida = ultimaMedicion(socio.id, existente ? existente.id : null);
    var fecha = existente && existente.fecha ? existente.fecha : fechaSugerida(mes, claseTipo);

    var titulo = (claseTipo === 'final' ? 'Cierre de mes · ' : 'Medición de inicio · ') + U.nombreMes(mes);

    var api = U.modal({
      titulo: titulo,
      ancho: 'xl',
      cuerpo: formularioHTML(socio, existente, sugerida, claseTipo, mes, fecha),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: existente ? 'Guardar cambios' : 'Guardar medición',
          clase: 'btn-primary',
          icono: 'check',
          onClick: function (modalApi) {
            var form = modalApi.root.querySelector('[data-form-medicion]');
            if (!form) return false;

            var datos = recolectar(form, socio, claseTipo, mes, usuario.id);
            if (!datos) return false;

            if (existente) {
              AG.DB.actualizar('mediciones', existente.id, datos);
            } else {
              AG.DB.insertar('mediciones', datos);
            }

            var inicial = AG.DB.medicionDelMes(socio.id, mes, 'inicial');
            if (datos.visibleParaSocio) {
              avisarAlSocio(socio, claseTipo, mes, !!inicial);
              AG.DB.guardar();
            }

            modalApi.cerrar();
            toast(existente
              ? 'Medición actualizada para ' + U.nombreCompleto(socio) + '.'
              : 'Medición guardada para ' + U.nombreCompleto(socio) + '.', 'ok');

            AG.Router.refrescar();

            /* El coach ve el comparativo en cuanto cierra el mes. */
            if (claseTipo === 'final' && inicial) {
              setTimeout(function () { abrirComparativo(socio.id, mes); }, 120);
            }
            return false;
          }
        }
      ],
      onOpen: function (root) {
        var form = root.querySelector('[data-form-medicion]');
        if (!form) return;

        actualizarVivo(form, socio);

        U.delegar(form, 'input', 'input', function () { actualizarVivo(form, socio); });
        U.delegar(form, 'change', 'input', function () { actualizarVivo(form, socio); });

        U.delegar(form, 'click', '[data-navy]', function (e) {
          e.preventDefault();
          estimarNavy(form, socio);
        });
        U.delegar(form, 'click', '[data-pliegues]', function (e) {
          e.preventDefault();
          estimarPliegues(form, socio);
        });

        /* Enter no debe enviar el formulario: se guarda desde el pie del modal. */
        form.addEventListener('submit', function (e) { e.preventDefault(); });
      }
    });

    return api;
  }

  /* =============================================================
     9. Comparativo automático (la tarjeta estrella)
     ============================================================= */

  function campoDe(cmp, clave) {
    if (!cmp || !cmp.campos) return null;
    for (var i = 0; i < cmp.campos.length; i++) {
      if (cmp.campos[i].clave === clave) return cmp.campos[i];
    }
    return null;
  }

  function metricaGrandeHTML(campo, titulo, dec) {
    if (!campo) {
      return '<div class="med-metrica">' +
        '<div class="dato-label">' + esc(titulo) + '</div>' +
        '<div class="med-flujo muted">Sin dato</div>' +
        '<div class="mini muted">No se capturó en este periodo</div>' +
      '</div>';
    }
    var unidad = campo.unidad || '';
    var ini = campo.ini !== null ? U.num(campo.ini, dec) : '—';
    var fin = campo.fin !== null ? U.num(campo.fin, dec) : '—';
    return '<div class="med-metrica">' +
      '<div class="dato-label">' + esc(titulo) + '</div>' +
      '<div class="med-flujo">' + esc(ini) + ' <span class="muted">&rarr;</span> ' + esc(fin) +
        (unidad ? ' <span class="mini muted">' + esc(unidad) + '</span>' : '') + '</div>' +
      '<div class="mt-sm">' + deltaHTML(campo.delta, dec, unidad, campo.tendencia) + '</div>' +
    '</div>';
  }

  function tablaComparativoHTML(cmp) {
    if (!cmp.campos.length) {
      return vacioHTML('No hay campos comparables: faltan datos en una de las dos mediciones.', '');
    }
    var html = '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr>' +
        '<th>Métrica</th><th class="num">Inicio</th><th class="num">Fin</th>' +
        '<th class="num">Cambio</th><th class="num">%</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < cmp.campos.length; i++) {
      var c = cmp.campos[i];
      var dec = (c.clave === 'fcReposo') ? 0 : 1;
      html += '<tr>' +
        '<td>' + esc(c.etiqueta) + (c.unidad ? ' <span class="mini muted">(' + esc(c.unidad) + ')</span>' : '') + '</td>' +
        '<td class="num">' + esc(c.ini !== null ? U.num(c.ini, dec) : '—') + '</td>' +
        '<td class="num">' + esc(c.fin !== null ? U.num(c.fin, dec) : '—') + '</td>' +
        '<td class="num">' + deltaHTML(c.delta, dec, '', c.tendencia) + '</td>' +
        '<td class="num ' + claseTendencia(c.tendencia) + '">' +
          esc(c.delta === null ? '—' : U.signo(c.pct, 1, '%')) + '</td>' +
      '</tr>';
    }
    return html + '</tbody></table></div>';
  }

  function paresComparativo(cmp) {
    var claves = [
      { clave: 'peso', etiqueta: 'Peso' },
      { clave: 'grasaPct', etiqueta: 'Grasa' },
      { clave: 'musculoKg', etiqueta: 'Músculo', alterno: 'masaMagra' },
      { clave: 'cintura', etiqueta: 'Cintura' }
    ];
    var pares = [];
    for (var i = 0; i < claves.length; i++) {
      var c = campoDe(cmp, claves[i].clave) || (claves[i].alterno ? campoDe(cmp, claves[i].alterno) : null);
      if (!c || c.ini === null || c.fin === null) continue;
      pares.push({
        etiqueta: claves[i].etiqueta,
        ini: c.ini,
        fin: c.fin,
        unidad: c.unidad,
        tendencia: c.tendencia
      });
    }
    return pares;
  }

  /* Adherencia real del socio dentro del periodo comparado. */
  function adherenciaDelPeriodo(socio, desde, hasta) {
    var todas = AG.DB.bitacorasDe(socio.id);
    var dentro = [];
    for (var i = 0; i < todas.length; i++) {
      var f = String(todas[i].fecha || '').slice(0, 10);
      if (f && f >= desde && f <= hasta) dentro.push(todas[i]);
    }
    if (!dentro.length) return null;

    var activa = AG.DB.rutinaActivaDe(socio.id);
    var dias = (activa && activa.rutina && n0(activa.rutina.diasPorSemana)) || 3;
    return Calc.adherencia(dentro, desde, hasta, dias);
  }

  /* Redacta 2 a 4 frases de lectura humana según los deltas y el objetivo. */
  function frasesSignificado(socio, cmp, ini, fin) {
    var r = cmp.resumen;
    var objetivo = cmp.objetivo;
    var frases = [];

    var dGrasa = (r.grasaKgDelta !== null && r.grasaKgDelta !== undefined) ? r.grasaKgDelta : r.grasaDelta;
    var dMusculo = r.musculoDelta;
    var dPeso = r.pesoDelta;
    var dCintura = r.cinturaDelta;

    var quieto = (dGrasa === null || Math.abs(dGrasa) < 0.25) &&
                 (dMusculo === null || Math.abs(dMusculo) < 0.25) &&
                 (dPeso === null || Math.abs(dPeso) < 0.5);

    /* 1) Lectura principal del periodo */
    if (dGrasa !== null && dGrasa <= -0.2 && dMusculo !== null && dMusculo >= -0.1) {
      frases.push('Recomposición corporal en marcha: bajaste grasa sin perder músculo. Es el mejor escenario posible; ' +
        'sostén las mismas calorías y la misma carga de fuerza el próximo mes.');
    } else if (dPeso !== null && dPeso >= 0.4 && dGrasa !== null && dGrasa >= 0.2) {
      frases.push('Subiste peso y también grasa: toca ajustar calorías. Recorta entre 200 y 300 kcal al día, ' +
        'cuida el fin de semana y agrega una sesión de cardio ligero.');
    } else if (dGrasa !== null && dGrasa <= -0.2 && dMusculo !== null && dMusculo <= -0.3) {
      frases.push('Bajaste grasa pero también músculo: el déficit está siendo demasiado agresivo. ' +
        'Sube la proteína a 2 g por kilo de peso y no bajes las cargas de la rutina.');
    } else if (dMusculo !== null && dMusculo >= 0.3) {
      frases.push('Ganaste masa muscular en el periodo: la señal de que el estímulo y la comida están alineados. ' +
        'Mantén la progresión de cargas semana a semana.');
    } else if (quieto) {
      frases.push('Tus números se movieron muy poco este mes. Antes de cambiar el plan hay que revisar la adherencia: ' +
        'lo que no se ejecuta no se puede evaluar.');
    } else if (dGrasa !== null && dGrasa <= -0.2) {
      frases.push('Perdiste grasa corporal en el periodo. Vas en la dirección correcta; el siguiente paso es sostenerlo ' +
        'sin sacrificar masa muscular.');
    }

    /* 2) Cintura, el mejor termómetro de la grasa visceral */
    if (dCintura !== null && dCintura <= -0.5) {
      frases.push('La cintura bajó ' + U.num(Math.abs(dCintura), 1) + ' cm: es el mejor indicador de que la grasa que se fue ' +
        'era justamente la que más pesa en la salud.');
    } else if (dCintura !== null && dCintura >= 1) {
      frases.push('La cintura creció ' + U.num(dCintura, 1) + ' cm. Aunque la báscula no se haya movido mucho, ' +
        'ese es el aviso de que la grasa abdominal está subiendo.');
    }

    /* 3) Objetivo del socio */
    if (objetivo === 'ganar_musculo' && dPeso !== null && dPeso <= 0.1) {
      frases.push('Tu objetivo es ganar músculo y el peso no subió: sin superávit calórico no hay material para construir. ' +
        'Suma entre 250 y 350 kcal al día, sobre todo alrededor del entrenamiento.');
    } else if (objetivo === 'perder_grasa' && dPeso !== null && dPeso >= 0.5 && (dGrasa === null || dGrasa >= 0)) {
      frases.push('Tu objetivo es perder grasa y el peso subió: revisemos porciones, bebidas y comidas fuera de casa ' +
        'antes de tocar el entrenamiento.');
    } else if (objetivo === 'mantener' && dPeso !== null && Math.abs(dPeso) <= 0.5) {
      frases.push('Tu objetivo es mantenerte y lo lograste: el peso se movió menos de medio kilo en todo el periodo.');
    } else if (objetivo === 'rendimiento' && r.fuerzaPct !== null) {
      frases.push(r.fuerzaPct >= 2
        ? 'En rendimiento lo que manda es la fuerza y subió ' + U.num(r.fuerzaPct, 0) + ' %. La progresión está funcionando.'
        : 'Tu fuerza casi no cambió: conviene revisar descansos, sueño y que las series se estén llevando cerca del fallo.');
    }

    /* 4) Adherencia real */
    var adh = adherenciaDelPeriodo(socio, ini.fecha, fin.fecha);
    if (adh) {
      frases.push('Tu adherencia real fue de ' + U.pct(adh.pct, 0) + ' (' + adh.hechas + ' de ' + adh.esperadas +
        ' sesiones esperadas). ' + (adh.pct >= 80
          ? 'Con esa constancia los resultados llegan solos.'
          : 'Subirla arriba del 80 % es el cambio que más rápido movería estos números.'));
    } else if (quieto) {
      frases.push('No hay entrenamientos registrados en este periodo, así que no podemos separar el efecto del plan ' +
        'del efecto de la asistencia. Registrar la bitácora es el primer paso.');
    }

    if (!frases.length) {
      frases.push('El periodo se mantuvo estable. Sigamos midiendo mes con mes para detectar la tendencia real.');
    }
    return frases.slice(0, 4);
  }

  function cabeceraComparativo(socio, periodo, cmp, ini, fin, conAcciones) {
    var dias = cmp.dias;
    var textoDias = dias === 1 ? '1 día entre mediciones' : dias + ' días entre mediciones';
    var acciones = '';
    if (conAcciones) {
      acciones = '<div class="card-accion no-imprimir">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-imprimir-comparativo="' + esc(socio.id) +
          '" data-periodo="' + esc(periodo) + '">' + icono('imprimir', 15) + ' Imprimir</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-medir="' + esc(socio.id) +
          '" data-tipo="final" data-periodo="' + esc(periodo) + '">' + icono('editar', 15) + ' Editar medición</button>' +
      '</div>';
    }
    return '<div class="card-head">' +
      '<div>' +
        '<div class="card-title">' + icono('cinta', 18) + '<span>Cierre de ' + esc(U.nombreMes(periodo)) + '</span></div>' +
        '<div class="card-sub">' + esc(textoDias) + ' · ' + esc(U.fecha(ini.fecha, 'corto')) +
          ' &rarr; ' + esc(U.fecha(fin.fecha, 'corto')) + ' · ' + esc(U.nombreCompleto(socio)) + '</div>' +
      '</div>' + acciones +
    '</div>';
  }

  /**
   * HTML del comparativo automático de un socio en un periodo.
   * @param {String} socioId
   * @param {String} periodo 'YYYY-MM'
   * @param {Object} [opts] { acciones:Boolean, usuario:Usuario }
   * @returns {String} HTML
   */
  function comparativo(socioId, periodo, opts) {
    var o = opts || {};
    var usuario = o.usuario || usuarioActual();
    var socio = AG.DB.usuario(socioId);
    var mes = (typeof periodo === 'string' && /^\d{4}-\d{2}/.test(periodo)) ? periodo.slice(0, 7) : U.mesActual();

    if (!socio || socio.rol !== 'socio') {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('No encontramos a ese socio en el sistema.', '') + '</div></div>';
    }
    if (usuario && !puedeVer(usuario, socio.id)) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('No tienes acceso a las mediciones de este socio.', '') + '</div></div>';
    }

    var editor = puedeEditar(usuario);
    var conAcciones = (o.acciones !== false) && editor;

    var ini = AG.DB.medicionDelMes(socio.id, mes, 'inicial');
    var fin = AG.DB.medicionDelMes(socio.id, mes, 'final');

    /* Si el socio no debe ver una medición oculta, se trata como inexistente. */
    if (usuario && usuario.rol === 'socio') {
      if (ini && ini.visibleParaSocio === false) ini = null;
      if (fin && fin.visibleParaSocio === false) fin = null;
    }

    if (!ini || !fin) {
      var falta, tipoFalta;
      if (!ini && !fin) { falta = 'Todavía no hay mediciones de ' + U.nombreMes(mes) + '.'; tipoFalta = 'inicial'; }
      else if (!ini) { falta = 'Falta la medición inicial de ' + U.nombreMes(mes) + '; sin ella no se puede comparar.'; tipoFalta = 'inicial'; }
      else { falta = 'Falta la medición de cierre de ' + U.nombreMes(mes) + '. En cuanto se capture, el comparativo se arma solo.'; tipoFalta = 'final'; }

      var boton = conAcciones
        ? '<button type="button" class="btn btn-primary btn-sm" data-medir="' + esc(socio.id) +
            '" data-tipo="' + esc(tipoFalta) + '" data-periodo="' + esc(mes) + '">' +
            icono('regla', 15) + ' Capturar medición ' + (tipoFalta === 'inicial' ? 'inicial' : 'final') + '</button>'
        : '';

      return '<div class="card">' +
        '<div class="card-head"><div class="card-title">' + icono('cinta', 18) +
          '<span>Cierre de ' + esc(U.nombreMes(mes)) + '</span></div></div>' +
        '<div class="card-body">' + vacioHTML(falta, boton) + '</div>' +
      '</div>';
    }

    var cmp = Calc.compararMediciones(ini, fin, socio.objetivo);
    if (!cmp.ok) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML(cmp.motivo || 'No se pudo construir el comparativo con los datos disponibles.', '') +
        '</div></div>';
    }

    var r = cmp.resumen;
    var html = '<div class="card card-rojo">' + cabeceraComparativo(socio, mes, cmp, ini, fin, conAcciones) +
      '<div class="card-body stack">';

    /* Anillo + veredicto */
    html += '<div class="row wrap">' +
      anilloHTML(r.puntaje, 'lg') +
      '<div class="flex1 stack-sm">' +
        '<div class="row-sm wrap">' +
          '<span class="badge ' + esc(r.clase) + '">' + esc(Calc.textoNivel(r.nivel)) + '</span>' +
          '<span class="pill">' + esc(etiquetaObjetivo(socio.objetivo)) + '</span>' +
          (r.datosSuficientes ? '' : '<span class="badge badge-warn">Datos incompletos</span>') +
        '</div>' +
        '<p class="muted">' + esc(r.veredicto) + '</p>' +
      '</div>' +
    '</div>';

    /* Cuatro métricas grandes */
    html += '<div class="med-metricas">' +
      metricaGrandeHTML(campoDe(cmp, 'peso'), 'Peso', 1) +
      metricaGrandeHTML(campoDe(cmp, 'grasaPct'), 'Grasa corporal', 1) +
      metricaGrandeHTML(campoDe(cmp, 'musculoKg') || campoDe(cmp, 'masaMagra'), 'Masa muscular', 1) +
      metricaGrandeHTML(campoDe(cmp, 'cintura'), 'Cintura', 1) +
    '</div>';

    /* Gráfica comparativa */
    var pares = paresComparativo(cmp);
    html += '<div class="grafica">' +
      (pares.length
        ? Charts.comparativo(pares, { alto: 300, etiquetaIni: 'Inicio', etiquetaFin: 'Cierre' })
        : Charts.vacio('Faltan valores en ambas mediciones para dibujar la comparación.', 200)) +
    '</div>';

    /* Tabla completa */
    html += '<div><h3 class="card-title mb-sm">' + icono('lista', 16) + '<span>Detalle campo por campo</span></h3>' +
      tablaComparativoHTML(cmp) + '</div>';

    /* Lo que significa */
    var frases = frasesSignificado(socio, cmp, ini, fin);
    var texto = '';
    for (var i = 0; i < frases.length; i++) {
      texto += '<p class="mb-sm">' + esc(frases[i]) + '</p>';
    }
    html += '<div class="caja">' +
      '<div class="card-title mb-sm">' + icono('info', 16) + '<span>Lo que significa</span></div>' +
      texto +
    '</div>';

    html += '</div></div>';
    return html;
  }

  function abrirComparativo(socioId, periodo) {
    var socio = AG.DB.usuario(socioId);
    var mes = periodo || estado.periodo || U.mesActual();
    asegurarEstilos();

    U.modal({
      titulo: 'Comparativo · ' + (socio ? U.nombreCompleto(socio) : 'Socio'),
      ancho: 'xl',
      cuerpo: comparativo(socioId, mes, {}),
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root) {
        var cuerpo = root.querySelector('.modal-body');
        if (cuerpo) engancharAcciones(cuerpo);
      }
    });
  }

  function imprimirComparativo(socioId, periodo) {
    var socio = AG.DB.usuario(socioId);
    var mes = periodo || estado.periodo || U.mesActual();
    var html = comparativo(socioId, mes, { acciones: false });
    U.imprimir(html, 'Comparativo de ' + (socio ? U.nombreCompleto(socio) : 'socio') + ' · ' + U.nombreMes(mes));
  }

  /* =============================================================
     10. Historial y evolución
     ============================================================= */

  /* Periodos con medición inicial y final, del más reciente al más antiguo. */
  function cierresDe(socioId, objetivo) {
    var lista = AG.DB.medicionesDe(socioId);
    var porPeriodo = {};
    var orden = [];
    var i;

    for (i = 0; i < lista.length; i++) {
      var m = lista[i];
      var p = (typeof m.periodo === 'string' && m.periodo) ? m.periodo.slice(0, 7) : U.mesDe(m.fecha);
      if (!p) continue;
      if (!porPeriodo[p]) { porPeriodo[p] = { periodo: p, inicial: null, final: null }; orden.push(p); }
      if (m.tipo === 'final') porPeriodo[p].final = m;
      else porPeriodo[p].inicial = m;
    }

    var salida = [];
    orden.sort();
    for (i = orden.length - 1; i >= 0; i--) {
      var bloque = porPeriodo[orden[i]];
      if (!bloque.inicial || !bloque.final) continue;
      var cmp = Calc.compararMediciones(bloque.inicial, bloque.final, objetivo);
      if (!cmp.ok) continue;
      salida.push({ periodo: bloque.periodo, cmp: cmp });
    }
    return salida;
  }

  function recordsHTML(socioId, objetivo) {
    var cierres = cierresDe(socioId, objetivo);
    var mediciones = AG.DB.medicionesDe(socioId);
    var i;

    var mejorPuntaje = null, mejorGrasa = null, mejorMusculo = null;
    for (i = 0; i < cierres.length; i++) {
      var r = cierres[i].cmp.resumen;
      if (mejorPuntaje === null || r.puntaje > mejorPuntaje.valor) {
        mejorPuntaje = { valor: r.puntaje, periodo: cierres[i].periodo };
      }
      var dGrasa = (r.grasaKgDelta !== null && r.grasaKgDelta !== undefined) ? r.grasaKgDelta : r.grasaDelta;
      if (dGrasa !== null && dGrasa < 0 && (mejorGrasa === null || dGrasa < mejorGrasa.valor)) {
        mejorGrasa = { valor: dGrasa, periodo: cierres[i].periodo, unidad: (r.grasaKgDelta !== null && r.grasaKgDelta !== undefined) ? 'kg' : '%' };
      }
      if (r.musculoDelta !== null && r.musculoDelta > 0 && (mejorMusculo === null || r.musculoDelta > mejorMusculo.valor)) {
        mejorMusculo = { valor: r.musculoDelta, periodo: cierres[i].periodo };
      }
    }

    var maximos = {};
    for (i = 0; i < mediciones.length; i++) {
      var f = mediciones[i].fuerza || {};
      for (var j = 0; j < FUERZA.length; j++) {
        var v = nPos(f[FUERZA[j].clave]);
        if (v !== null && (maximos[FUERZA[j].clave] === undefined || v > maximos[FUERZA[j].clave])) {
          maximos[FUERZA[j].clave] = v;
        }
      }
    }

    function dato(etiqueta, valor, detalle) {
      return '<div class="dato">' +
        '<span class="dato-label">' + esc(etiqueta) + '</span>' +
        '<span class="dato-val">' + esc(valor) + '</span>' +
        '<span class="mini muted">' + esc(detalle) + '</span>' +
      '</div>';
    }

    var html = '<div class="datos-grid">';
    html += dato('Mejor puntaje mensual',
      mejorPuntaje ? String(mejorPuntaje.valor) + ' / 100' : 'Sin cierres',
      mejorPuntaje ? U.nombreMes(mejorPuntaje.periodo) : 'Aún no hay ningún mes cerrado');
    html += dato('Mayor pérdida de grasa',
      mejorGrasa ? U.num(Math.abs(mejorGrasa.valor), 1) + ' ' + mejorGrasa.unidad : 'Sin registro',
      mejorGrasa ? U.nombreMes(mejorGrasa.periodo) : 'Todavía sin bajada registrada');
    html += dato('Mayor ganancia de músculo',
      mejorMusculo ? '+' + U.num(mejorMusculo.valor, 1) + ' kg' : 'Sin registro',
      mejorMusculo ? U.nombreMes(mejorMusculo.periodo) : 'Todavía sin subida registrada');

    for (i = 0; i < FUERZA.length; i++) {
      var max = maximos[FUERZA[i].clave];
      var rm = (max !== undefined) ? Calc.rm1(max, 1) : null;
      html += dato('1RM ' + FUERZA[i].etiqueta,
        rm !== null ? U.num(rm, 1) + ' kg' : 'Sin registro',
        rm !== null ? 'Mejor marca registrada' : 'No se ha capturado esta prueba');
    }

    return html + '</div>';
  }

  function graficasHistorialHTML(mediciones) {
    var html = '<div class="chips mb">';
    var i;
    for (i = 0; i < METRICAS.length; i++) {
      html += '<button type="button" class="chip' + (estado.metrica === METRICAS[i].clave ? ' on' : '') +
        '" data-metrica="' + esc(METRICAS[i].clave) + '">' + esc(METRICAS[i].etiqueta) + '</button>';
    }
    html += '</div>';

    for (i = 0; i < METRICAS.length; i++) {
      var met = METRICAS[i];
      var puntos = [];
      for (var j = 0; j < mediciones.length; j++) {
        var m = mediciones[j];
        var v = porRuta(m, met.ruta);
        if (v === null) continue;
        puntos.push({
          x: m.fecha,
          etiqueta: U.fecha(m.fecha, 'diaMes'),
          y: v
        });
      }
      var grafica = puntos.length >= 2
        ? Charts.linea([{ nombre: met.etiqueta, color: Charts.color(i), puntos: puntos }],
            { alto: 250, sufijo: ' ' + met.unidad, suave: true, area: true, leyenda: false })
        : Charts.vacio('Se necesitan al menos dos mediciones con ' + met.etiqueta.toLowerCase() + ' para trazar la evolución.', 220);

      html += '<div class="grafica' + (estado.metrica === met.clave ? '' : ' oculto') +
        '" data-grafica="' + esc(met.clave) + '">' + grafica + '</div>';
    }
    return html;
  }

  function tablaHistorialHTML(mediciones) {
    if (!mediciones.length) {
      return vacioHTML('Este socio todavía no tiene mediciones registradas.', '');
    }
    var html = '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr>' +
        '<th>Periodo</th><th>Tipo</th><th>Fecha</th>' +
        '<th class="num">Peso</th><th class="num">Grasa</th><th class="num">Músculo</th>' +
        '<th class="num">Cintura</th><th class="num">IMC</th><th>Coach</th>' +
      '</tr></thead><tbody>';

    for (var i = mediciones.length - 1; i >= 0; i--) {
      var m = mediciones[i];
      var coach = m.coachId ? AG.DB.usuario(m.coachId) : null;
      var periodo = (typeof m.periodo === 'string' && m.periodo) ? m.periodo.slice(0, 7) : U.mesDe(m.fecha);
      var cintura = (m.medidas && n0(m.medidas.cintura) !== null) ? U.num(m.medidas.cintura, 1) : '—';
      html += '<tr>' +
        '<td>' + esc(U.nombreMes(periodo)) + '</td>' +
        '<td>' + (m.tipo === 'final'
          ? '<span class="badge badge-rojo">Cierre</span>'
          : '<span class="badge badge-info">Inicio</span>') + '</td>' +
        '<td class="nowrap">' + esc(U.fecha(m.fecha, 'corto')) + '</td>' +
        '<td class="num">' + esc(n0(m.pesoKg) !== null ? U.num(m.pesoKg, 1) : '—') + '</td>' +
        '<td class="num">' + esc(n0(m.grasaPct) !== null ? U.num(m.grasaPct, 1) : '—') + '</td>' +
        '<td class="num">' + esc(n0(m.musculoKg) !== null ? U.num(m.musculoKg, 1) : '—') + '</td>' +
        '<td class="num">' + esc(cintura) + '</td>' +
        '<td class="num">' + esc(n0(m.imc) !== null ? U.num(m.imc, 1) : '—') + '</td>' +
        '<td>' + esc(coach ? U.nombreCompleto(coach) : 'Sin registrar') + '</td>' +
      '</tr>';
    }
    return html + '</tbody></table></div>';
  }

  /**
   * HTML del historial completo de mediciones de un socio.
   * @param {String} socioId
   * @returns {String} HTML
   */
  function historial(socioId) {
    var usuario = usuarioActual();
    var socio = AG.DB.usuario(socioId);

    if (!socio || socio.rol !== 'socio') {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('No encontramos a ese socio en el sistema.', '') + '</div></div>';
    }
    if (usuario && !puedeVer(usuario, socio.id)) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('No tienes acceso al historial de este socio.', '') + '</div></div>';
    }

    var mediciones = AG.DB.medicionesDe(socio.id);
    if (usuario && usuario.rol === 'socio') {
      mediciones = mediciones.filter(function (m) { return m.visibleParaSocio !== false; });
    }

    if (!mediciones.length) {
      var boton = puedeEditar(usuario)
        ? '<button type="button" class="btn btn-primary btn-sm" data-medir="' + esc(socio.id) +
            '" data-tipo="inicial" data-periodo="' + esc(U.mesActual()) + '">' +
            icono('regla', 15) + ' Capturar primera medición</button>'
        : '';
      return '<div class="stack" data-historial-caja"><div class="card"><div class="card-body">' +
        vacioHTML('Todavía no hay mediciones registradas para ' + U.nombreCompleto(socio) + '.', boton) +
        '</div></div></div>';
    }

    var html = '<div class="stack" data-historial-caja>';

    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('grafica', 18) + '<span>Evolución mes a mes</span></div>' +
        '<div class="card-accion no-imprimir">' +
          '<button type="button" class="btn btn-outline btn-sm" data-csv-historial="' + esc(socio.id) + '">' +
            icono('descargar', 15) + ' Exportar CSV</button>' +
        '</div>' +
      '</div>' +
      '<div class="card-body">' + graficasHistorialHTML(mediciones) + '</div>' +
    '</div>';

    html += '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icono('trofeo', 18) + '<span>Récords</span></div></div>' +
      '<div class="card-body">' + recordsHTML(socio.id, socio.objetivo) + '</div>' +
    '</div>';

    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('historial', 18) + '<span>Todas las mediciones</span></div>' +
        '<span class="badge badge-muted">' + mediciones.length + '</span>' +
      '</div>' +
      '<div class="card-body">' + tablaHistorialHTML(mediciones) + '</div>' +
    '</div>';

    return html + '</div>';
  }

  function abrirHistorial(socioId) {
    var socio = AG.DB.usuario(socioId);
    asegurarEstilos();
    U.modal({
      titulo: 'Historial · ' + (socio ? U.nombreCompleto(socio) : 'Socio'),
      ancho: 'xl',
      cuerpo: historial(socioId),
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root) {
        var caja = root.querySelector('[data-historial-caja]') || root.querySelector('.modal-body');
        if (caja) engancharAcciones(caja);
      }
    });
  }

  /* =============================================================
     11. Exportación a CSV
     ============================================================= */

  function csvCampo(valor) {
    var t = (valor === null || valor === undefined) ? '' : String(valor);
    if (/[",;\n\r]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  function csvNumero(valor, dec) {
    var v = n0(valor);
    if (v === null) return '';
    var d = (dec === undefined || dec === null) ? 1 : dec;
    return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
  }

  function exportarHistorialCSV(socioId) {
    var usuario = usuarioActual();
    var socio = AG.DB.usuario(socioId);

    if (!socio) { toast('No encontramos a ese socio.', 'error'); return; }
    if (usuario && !puedeVer(usuario, socio.id)) {
      toast('No tienes acceso al historial de este socio.', 'error');
      return;
    }

    var mediciones = AG.DB.medicionesDe(socio.id);
    if (usuario && usuario.rol === 'socio') {
      mediciones = mediciones.filter(function (m) { return m.visibleParaSocio !== false; });
    }
    if (!mediciones.length) {
      toast('No hay mediciones que exportar.', 'warn');
      return;
    }

    var encabezados = ['Socio', 'Código', 'Periodo', 'Tipo', 'Fecha', 'Peso (kg)', 'Estatura (cm)',
      'Grasa (%)', 'Músculo (kg)', 'Agua (%)', 'IMC'];
    var i, j;
    for (i = 0; i < MEDIDAS.length; i++) encabezados.push(MEDIDAS[i].etiqueta + ' (cm)');
    for (i = 0; i < PLIEGUES.length; i++) encabezados.push('Pliegue ' + PLIEGUES[i].etiqueta + ' (mm)');
    encabezados.push('Presión', 'FC reposo (lpm)');
    for (i = 0; i < FUERZA.length; i++) encabezados.push(FUERZA[i].etiqueta + ' (kg)');
    encabezados.push('Coach', 'Visible para el socio', 'Notas');

    var lineas = [encabezados.map(csvCampo).join(',')];

    for (i = 0; i < mediciones.length; i++) {
      var m = mediciones[i];
      var coach = m.coachId ? AG.DB.usuario(m.coachId) : null;
      var periodo = (typeof m.periodo === 'string' && m.periodo) ? m.periodo.slice(0, 7) : U.mesDe(m.fecha);
      var fila = [
        U.nombreCompleto(socio), socio.codigo || '', periodo,
        m.tipo === 'final' ? 'Final' : 'Inicial', m.fecha || '',
        csvNumero(m.pesoKg, 1), csvNumero(m.estaturaCm, 1), csvNumero(m.grasaPct, 1),
        csvNumero(m.musculoKg, 1), csvNumero(m.aguaPct, 1), csvNumero(m.imc, 1)
      ];
      for (j = 0; j < MEDIDAS.length; j++) fila.push(csvNumero(m.medidas ? m.medidas[MEDIDAS[j].clave] : null, 1));
      for (j = 0; j < PLIEGUES.length; j++) fila.push(csvNumero(m.pliegues ? m.pliegues[PLIEGUES[j].clave] : null, 1));
      fila.push(m.presion || '', csvNumero(m.fcReposo, 0));
      for (j = 0; j < FUERZA.length; j++) fila.push(csvNumero(m.fuerza ? m.fuerza[FUERZA[j].clave] : null, 1));
      fila.push(coach ? U.nombreCompleto(coach) : '', m.visibleParaSocio === false ? 'No' : 'Sí', m.notas || '');

      lineas.push(fila.map(csvCampo).join(','));
    }

    var nombre = 'mediciones-' + (socio.codigo || socio.id) + '-' + U.hoy() + '.csv';
    /* El BOM hace que Excel en español abra los acentos correctamente. */
    var ok = U.descargar(nombre, '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
    if (ok) toast('Historial exportado: ' + nombre, 'ok');
  }

  /* =============================================================
     12. Exposición y registro de rutas
     ============================================================= */

  AG.Mod.Mediciones = {
    render: render,
    capturar: capturar,
    comparativo: comparativo,
    historial: historial,
    abrirComparativo: abrirComparativo,
    abrirHistorial: abrirHistorial,
    selectorDeSocio: selectorDeSocio,
    exportarCSV: exportarHistorialCSV,
    engancharAcciones: engancharAcciones
  };

  AG.Router.registrar({
    path: 'coach/mediciones',
    roles: ['coach'],
    titulo: 'Mediciones',
    nav: { etiqueta: 'Mediciones', icono: 'regla', grupo: 'Entrenamiento', orden: 2 },
    render: render
  });

  AG.Router.registrar({
    path: 'director/mediciones',
    roles: ['director'],
    titulo: 'Mediciones',
    nav: { etiqueta: 'Mediciones', icono: 'regla', grupo: 'Entrenamiento', orden: 2 },
    render: render
  });
})(window.AG);
