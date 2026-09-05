/* =============================================================
   ALLIANCE GYM — Biblioteca de ejercicios (AG.Mod.Ejercicios)
   -------------------------------------------------------------
   Rutas que registra:
     director/ejercicios · coach/ejercicios · socio/ejercicios

   Funciones compartidas con el resto del sistema:
     AG.Mod.Ejercicios.detalle(ejercicioId)      modal con la técnica
     AG.Mod.Ejercicios.selector(callback, opts)  buscador para el constructor
     AG.Mod.Ejercicios.sugerencia(nivel, tipo)   series/reps recomendadas
     AG.Mod.Ejercicios.paraRutina(id, nivel)     bloque listo para una rutina
     AG.Mod.Ejercicios.ultimoSeleccionado        portapapeles del constructor
     AG.Mod.Ejercicios.tomarSeleccionado()       lo entrega y lo limpia

   El catálogo vive en AG.Data (js/data/exercises.js): aquí no se
   inventa ni se guarda ningún ejercicio nuevo.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  /* =============================================================
     0. Constantes del módulo
     ============================================================= */

  /* Cuántas tarjetas se pintan de golpe (el resto, con "Ver más"). */
  var PASO = 24;

  var NIVELES = [
    { id: 'principiante', nombre: 'Principiante', badge: 'ok' },
    { id: 'intermedio', nombre: 'Intermedio', badge: 'info' },
    { id: 'avanzado', nombre: 'Avanzado', badge: 'warn' }
  ];

  var NOMBRE_TIPO = {
    fuerza: 'Fuerza',
    hipertrofia: 'Hipertrofia',
    cardio: 'Cardio',
    movilidad: 'Movilidad',
    funcional: 'Funcional'
  };

  /**
   * Series, repeticiones y descanso recomendados por tipo de ejercicio y
   * nivel del socio. 'repsNum' es el número que se escribe en la bitácora
   * (en cardio son minutos; en movilidad, una retención por serie).
   */
  var SUGERENCIAS = {
    fuerza: {
      principiante: { series: 3, reps: '8-10', repsNum: 8, descansoSeg: 90, tempo: '2-0-2' },
      intermedio: { series: 4, reps: '5-8', repsNum: 6, descansoSeg: 120, tempo: '2-1-1' },
      avanzado: { series: 5, reps: '3-5', repsNum: 4, descansoSeg: 180, tempo: '2-1-X' }
    },
    hipertrofia: {
      principiante: { series: 3, reps: '12-15', repsNum: 12, descansoSeg: 60, tempo: '2-0-2' },
      intermedio: { series: 4, reps: '8-12', repsNum: 10, descansoSeg: 75, tempo: '3-0-1' },
      avanzado: { series: 4, reps: '6-10', repsNum: 8, descansoSeg: 90, tempo: '3-1-1' }
    },
    funcional: {
      principiante: { series: 3, reps: '10-12', repsNum: 10, descansoSeg: 60, tempo: 'Controlado' },
      intermedio: { series: 4, reps: '12-15', repsNum: 12, descansoSeg: 45, tempo: 'Continuo' },
      avanzado: { series: 5, reps: '15-20', repsNum: 15, descansoSeg: 40, tempo: 'Explosivo' }
    },
    cardio: {
      principiante: { series: 1, reps: '15 min continuos', repsNum: 15, descansoSeg: 0, tempo: 'Ritmo suave' },
      intermedio: { series: 2, reps: '12 min por bloque', repsNum: 12, descansoSeg: 90, tempo: 'Ritmo medio' },
      avanzado: { series: 3, reps: '10 min por bloque', repsNum: 10, descansoSeg: 60, tempo: 'Ritmo alto' }
    },
    movilidad: {
      principiante: { series: 2, reps: '30 s por lado', repsNum: 1, descansoSeg: 20, tempo: 'Sin rebotes' },
      intermedio: { series: 3, reps: '30 s por lado', repsNum: 1, descansoSeg: 20, tempo: 'Sin rebotes' },
      avanzado: { series: 3, reps: '45 s por lado', repsNum: 1, descansoSeg: 15, tempo: 'Sin rebotes' }
    }
  };

  /* Filtros vivos de la vista: se conservan entre repintados. */
  var estado = {
    texto: '',
    grupo: 'todos',
    equipo: 'todos',
    nivel: 'todos',
    mostrar: PASO
  };

  /* =============================================================
     1. Atajos y utilidades internas
     ============================================================= */

  function esc(v) { return AG.Utils.esc(v); }

  function ico(nombre, tamano, opciones) { return AG.Icons.get(nombre, tamano, opciones); }

  function toast(mensaje, tipo) { AG.Utils.toast(mensaje, tipo); }

  function catalogo() {
    var lista = (AG.Data && AG.Data.exercises) ? AG.Data.exercises : null;
    return (Object.prototype.toString.call(lista) === '[object Array]') ? lista : [];
  }

  function grupos() {
    var lista = (AG.Data && AG.Data.GRUPOS) ? AG.Data.GRUPOS : null;
    return (Object.prototype.toString.call(lista) === '[object Array]') ? lista : [];
  }

  function equipos() {
    var lista = (AG.Data && AG.Data.EQUIPOS) ? AG.Data.EQUIPOS : null;
    return (Object.prototype.toString.call(lista) === '[object Array]') ? lista : [];
  }

  function datosGrupo(id) {
    if (AG.Data && typeof AG.Data.grupo === 'function') return AG.Data.grupo(id);
    return { id: 'general', nombre: 'General', icono: 'pesa', color: '#8a8f98' };
  }

  function nombreEquipo(id) {
    if (AG.Data && typeof AG.Data.nombreEquipo === 'function') return AG.Data.nombreEquipo(id);
    return 'Sin equipo';
  }

  function nombreTipo(id) {
    return NOMBRE_TIPO[id] || 'General';
  }

  function nivelInfo(id) {
    for (var i = 0; i < NIVELES.length; i++) {
      if (NIVELES[i].id === id) return NIVELES[i];
    }
    return { id: '', nombre: 'Sin nivel', badge: 'muted' };
  }

  /** '#e4322b' + opacidad -> 'rgba(228,50,43,.2)'. Tolera valores raros. */
  function rgba(hex, alfa) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '8A8F98';
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    var a = (alfa === null || alfa === undefined) ? 1 : Number(alfa);
    if (!isFinite(a)) a = 1;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /** Color seguro de un grupo (siempre un hex válido). */
  function colorGrupo(id) {
    var g = datosGrupo(id);
    return (g && g.color) ? g.color : '#8A8F98';
  }

  /** Filtra el catálogo respetando la API del archivo de datos. */
  function filtrar(f) {
    if (AG.Data && typeof AG.Data.ejerciciosPor === 'function') {
      return AG.Data.ejerciciosPor(f || {});
    }
    return catalogo().slice();
  }

  /** ¿Este ejercicio pertenece al grupo (principal o secundario)? */
  function esDelGrupo(ej, grupoId) {
    if (!ej) return false;
    if (ej.grupo === grupoId) return true;
    return !!(ej.grupos && ej.grupos.indexOf && ej.grupos.indexOf(grupoId) !== -1);
  }

  /** Nivel válido del usuario ('' si no lo tiene capturado). */
  function nivelDe(usuario) {
    if (!usuario) return '';
    var n = String(usuario.nivel || '');
    for (var i = 0; i < NIVELES.length; i++) {
      if (NIVELES[i].id === n) return n;
    }
    return '';
  }

  /** Parte las instrucciones en pasos numerados. */
  function pasosDe(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto).trim();
    if (!t) return [];
    var bruto = t.split(/\.\s+/);
    var pasos = [];
    for (var i = 0; i < bruto.length; i++) {
      var p = bruto[i].trim();
      if (!p) continue;
      if (p.charAt(p.length - 1) !== '.') p += '.';
      pasos.push(p);
    }
    return pasos.length ? pasos : [t];
  }

  /** 'Pectoral mayor, tríceps' -> ['Pectoral mayor', 'Tríceps'] */
  function musculosDe(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto).trim();
    if (!t) return [];
    return t.split(/\s*[,;]\s*/).filter(function (m) { return !!m; });
  }

  /** '90 s' / '1:30 min' legible para el descanso. */
  function textoDescanso(segundos) {
    var s = Math.max(0, Math.round(Number(segundos) || 0));
    if (!s) return 'Sin descanso';
    if (s < 60) return s + ' s';
    var min = Math.floor(s / 60);
    var resto = s % 60;
    return resto ? min + ' min ' + resto + ' s' : min + ' min';
  }

  /* =============================================================
     2. Estilos propios del módulo
     Variantes puntuales que el contrato de CSS no cubre (la
     ilustración generada de cada tarjeta). Se inyectan una sola vez.
     ============================================================= */

  var CSS_MODULO = '' +
    '.ejx-card{padding:0;width:100%;text-align:left;cursor:pointer}' +
    '.ejx-card:focus-visible{outline:2px solid var(--rojo-2);outline-offset:2px}' +
    '.ejx-arte{position:relative;height:96px;display:flex;align-items:center;justify-content:center;' +
      'overflow:hidden;background:var(--panel-2);border-bottom:1px solid var(--borde);' +
      'border-radius:calc(var(--radio) - 1px) calc(var(--radio) - 1px) 0 0}' +
    '.ejx-halo{position:absolute;border-radius:50%;pointer-events:none}' +
    '.ejx-halo-a{width:158px;height:158px;left:-50px;top:-62px}' +
    '.ejx-halo-b{width:104px;height:104px;right:-30px;bottom:-44px}' +
    '.ejx-marca{position:absolute;right:8px;bottom:-14px;line-height:0;pointer-events:none}' +
    '.ejx-marca svg{width:86px;height:86px}' +
    '.ejx-medalla{position:relative;z-index:2;display:grid;place-items:center;width:54px;height:54px;' +
      'border-radius:50%;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.28)}' +
    '.ejx-medalla svg{width:26px;height:26px}' +
    '.ejx-franja{position:absolute;left:0;right:0;bottom:0;height:3px}' +
    '.ejx-card .card-body{padding:13px 14px 15px}' +
    '.ejx-nombre{font-size:14px;font-weight:800;letter-spacing:-.01em;color:var(--texto);line-height:1.32;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.64em}' +
    '.ejx-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}' +
    '.ejx-musculos{margin-top:9px}' +
    '.ejx-punto{width:8px;height:8px;border-radius:50%;flex:0 0 auto}' +
    '.ejx-n{opacity:.72;font-weight:700}' +
    '.chip[disabled]{opacity:.42;cursor:default}' +
    '.ejx-campo-buscar{flex:2 1 240px}' +
    '.ejx-h{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;letter-spacing:.08em;' +
      'text-transform:uppercase;color:var(--texto-2);margin-top:6px}' +
    '.ejx-h svg{color:var(--rojo);width:15px;height:15px}' +
    '.ejx-hero{display:flex;align-items:center;gap:12px}' +
    '.ejx-pasos{display:flex;flex-direction:column;gap:9px}' +
    '.ejx-paso{display:flex;align-items:flex-start;gap:10px;font-size:13.2px;line-height:1.5;color:var(--texto-2)}' +
    '.ejx-num{flex:0 0 auto;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;' +
      'background:var(--rojo-bg);color:var(--rojo-2);font-size:11.5px;font-weight:800;margin-top:1px}' +
    '[data-tema="claro"] .ejx-num{color:var(--rojo-oscuro)}' +
    '.ejx-fila-on{background:var(--rojo-bg)}' +
    '.ejx-fila-on td{font-weight:700}' +
    '.ejx-mini{flex:0 0 auto;display:grid;place-items:center;width:32px;height:32px;border-radius:var(--radio-sm);color:#fff}' +
    '.ejx-mini svg{width:17px;height:17px}' +
    '.ejx-lista{max-height:min(46vh,380px);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '.ejx-sel[aria-pressed="true"]{background:var(--rojo-bg)}' +
    '.ejx-sel[aria-pressed="true"] .list-item-main b{color:var(--texto)}' +
    '@media (max-width:700px){.ejx-arte{height:84px}.ejx-lista{max-height:52vh}}';

  var estilosListos = false;

  function asegurarEstilos() {
    if (estilosListos) return;
    estilosListos = true;
    try {
      if (document.getElementById('ag-ejercicios-css')) return;
      var st = document.createElement('style');
      st.id = 'ag-ejercicios-css';
      st.textContent = CSS_MODULO;
      document.head.appendChild(st);
    } catch (e) {
      estilosListos = false;     // se reintenta en el siguiente pintado
    }
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  /** Bloque decorativo: icono y color del grupo, sin imágenes externas. */
  function ilustracion(ej) {
    var g = datosGrupo(ej.grupo);
    var color = colorGrupo(ej.grupo);
    return '' +
      '<div class="ejx-arte" aria-hidden="true">' +
        '<span class="ejx-halo ejx-halo-a" style="background:' + rgba(color, 0.20) + '"></span>' +
        '<span class="ejx-halo ejx-halo-b" style="background:' + rgba(color, 0.14) + '"></span>' +
        '<span class="ejx-marca" style="color:' + rgba(color, 0.16) + '">' + ico(g.icono, 86) + '</span>' +
        '<span class="ejx-medalla" style="background:' + esc(color) + '">' + ico(g.icono, 26) + '</span>' +
        '<span class="ejx-franja" style="background:linear-gradient(90deg,' + esc(color) + ',' + rgba(color, 0) + ')"></span>' +
      '</div>';
  }

  /** Píldora del grupo muscular con su color. */
  function pillGrupo(grupoId) {
    var g = datosGrupo(grupoId);
    return '<span class="pill"><span class="ejx-punto" style="background:' + esc(colorGrupo(grupoId)) + '"></span>' +
      esc(g.nombre) + '</span>';
  }

  /** Etiquetas de grupo, equipo y nivel. */
  function etiquetas(ej) {
    var n = nivelInfo(ej.nivel);
    return '<div class="ejx-tags">' +
      pillGrupo(ej.grupo) +
      AG.Utils.badge(nombreEquipo(ej.equipo), 'muted') +
      AG.Utils.badge(n.nombre, n.badge) +
      '</div>';
  }

  /** Tarjeta de la cuadrícula. */
  function tarjeta(ej) {
    return '' +
      '<button type="button" class="card hover-elevar ejx-card" data-ej="' + esc(ej.id) + '" ' +
        'title="Ver la técnica de ' + esc(ej.nombre) + '">' +
        ilustracion(ej) +
        '<div class="card-body">' +
          '<div class="ejx-nombre">' + esc(ej.nombre) + '</div>' +
          etiquetas(ej) +
          '<p class="mini muted dos-lineas ejx-musculos">' + esc(ej.musculos || 'Sin músculos registrados') + '</p>' +
        '</div>' +
      '</button>';
  }

  /* =============================================================
     4. Vista: biblioteca
     ============================================================= */

  function hayFiltros() {
    return !!(estado.texto || estado.grupo !== 'todos' || estado.equipo !== 'todos' || estado.nivel !== 'todos');
  }

  function resultados() {
    return filtrar({
      texto: estado.texto,
      grupo: estado.grupo,
      equipo: estado.equipo,
      nivel: estado.nivel
    });
  }

  /** Chips de grupo con el conteo que daría cada uno con los filtros vigentes. */
  function htmlChips() {
    var base = filtrar({ texto: estado.texto, equipo: estado.equipo, nivel: estado.nivel });
    var lista = grupos();
    var html = '<div class="chips">';

    html += '<button type="button" class="chip chip-sm' + (estado.grupo === 'todos' ? ' on' : '') +
      '" data-grupo="todos">Todos <span class="ejx-n">' + base.length + '</span></button>';

    for (var i = 0; i < lista.length; i++) {
      var g = lista[i];
      var n = 0;
      for (var j = 0; j < base.length; j++) {
        if (esDelGrupo(base[j], g.id)) n++;
      }
      var activo = estado.grupo === g.id;
      html += '<button type="button" class="chip chip-sm' + (activo ? ' on' : '') + '" data-grupo="' + esc(g.id) + '"' +
        (n === 0 && !activo ? ' disabled' : '') + '>' +
        '<span class="ejx-punto" style="background:' + esc(colorGrupo(g.id)) + '"></span>' +
        esc(g.nombre) + ' <span class="ejx-n">' + n + '</span></button>';
    }
    return html + '</div>';
  }

  function htmlConteo(lista) {
    var total = lista.length;
    var mostrados = Math.min(total, estado.mostrar);
    var texto = total === 1 ? '1 ejercicio' : AG.Utils.num(total, 0) + ' ejercicios';
    if (total > mostrados) texto += ' · mostrando ' + mostrados;
    if (hayFiltros()) texto += ' · de ' + AG.Utils.num(catalogo().length, 0) + ' en la biblioteca';
    return esc(texto);
  }

  function htmlResultados(lista) {
    if (!catalogo().length) {
      return '<div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + ico('pesa', 30) + '</div>' +
        '<p class="empty-texto">La biblioteca de ejercicios no está disponible en este momento. ' +
        'Recarga la página; si el problema sigue, avisa a dirección.</p>' +
        '</div></div></div>';
    }

    if (!lista.length) {
      return '<div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + ico('buscar', 30) + '</div>' +
        '<p class="empty-texto">Ningún ejercicio coincide con lo que buscas. ' +
        'Prueba con otra palabra o quita alguno de los filtros.</p>' +
        '<button type="button" class="btn btn-outline" data-limpiar>' + ico('filtro', 16) + 'Quitar filtros</button>' +
        '</div></div></div>';
    }

    var visibles = lista.slice(0, estado.mostrar);
    var html = '<div class="grid g4">';
    for (var i = 0; i < visibles.length; i++) html += tarjeta(visibles[i]);
    html += '</div>';

    if (lista.length > visibles.length) {
      var faltan = lista.length - visibles.length;
      html += '<div class="center mt">' +
        '<button type="button" class="btn btn-outline" data-mas>' + ico('flecha-abajo', 16) +
        'Ver ' + Math.min(PASO, faltan) + ' más</button></div>';
    }
    return html;
  }

  function htmlFiltros() {
    var listaEquipos = equipos();
    var html = '' +
      '<div class="card"><div class="card-body">' +
        '<div class="form-row">' +
          '<div class="field ejx-campo-buscar">' +
            '<label class="label" for="ejx-buscar">Buscar ejercicio</label>' +
            '<div class="input-icono">' + ico('buscar', 17) +
              '<input class="input" id="ejx-buscar" type="search" autocomplete="off" data-buscar ' +
              'placeholder="Nombre o músculo: sentadilla, dorsal, glúteo…" value="' + esc(estado.texto) + '">' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="ejx-equipo">Equipo</label>' +
            '<select class="select" id="ejx-equipo" data-equipo>' +
              '<option value="todos"' + (estado.equipo === 'todos' ? ' selected' : '') + '>Todos los equipos</option>';
    for (var i = 0; i < listaEquipos.length; i++) {
      html += '<option value="' + esc(listaEquipos[i].id) + '"' +
        (estado.equipo === listaEquipos[i].id ? ' selected' : '') + '>' + esc(listaEquipos[i].nombre) + '</option>';
    }
    html += '</select></div>' +
          '<div class="field">' +
            '<label class="label" for="ejx-nivel">Nivel</label>' +
            '<select class="select" id="ejx-nivel" data-nivel>' +
              '<option value="todos"' + (estado.nivel === 'todos' ? ' selected' : '') + '>Todos los niveles</option>';
    for (var k = 0; k < NIVELES.length; k++) {
      html += '<option value="' + esc(NIVELES[k].id) + '"' +
        (estado.nivel === NIVELES[k].id ? ' selected' : '') + '>' + esc(NIVELES[k].nombre) + '</option>';
    }
    html += '</select></div>' +
          '<button type="button" class="btn btn-ghost' + (hayFiltros() ? '' : ' oculto') + '" data-limpiar>' +
            ico('x', 16) + 'Limpiar</button>' +
        '</div>' +
        '<div class="mt" data-chips>' + htmlChips() + '</div>' +
      '</div></div>';
    return html;
  }

  /**
   * Vista principal de la biblioteca (director, coach y socio).
   * @param {Object} ctx { usuario, params, path }
   * @returns {{html:String, listo:Function}}
   */
  function render(ctx) {
    asegurarEstilos();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario : AG.Auth.actual();
    var esSocio = !!(usuario && usuario.rol === 'socio');
    var lista = resultados();

    var subtitulo = esSocio
      ? 'Consulta la técnica correcta antes de entrenar. Toca un ejercicio para ver los pasos y agregarlo a tu registro de hoy.'
      : 'Técnica, músculos y consejos de cada movimiento. Toca un ejercicio para verlo y enviarlo al constructor de rutinas.';

    var html = '' +
      '<div class="page">' +
        '<div class="page-head">' +
          '<div>' +
            '<h1 class="page-title">' + ico('pesa', 24) + 'Biblioteca de ejercicios</h1>' +
            '<p class="page-sub">' + esc(subtitulo) + '</p>' +
          '</div>' +
          '<div class="page-acciones">' +
            '<span class="pill">' + ico('mancuerna', 14) + '<b>' + AG.Utils.num(catalogo().length, 0) + '</b> en catálogo</span>' +
          '</div>' +
        '</div>' +
        htmlFiltros() +
        '<div class="between wrap">' +
          '<span class="mini muted" data-conteo>' + htmlConteo(lista) + '</span>' +
          (esSocio ? '<span class="mini muted">' + ico('info', 13) + ' Elige uno y agrégalo a tu registro de hoy</span>' : '') +
        '</div>' +
        '<div data-resultados>' + htmlResultados(lista) + '</div>' +
      '</div>';

    return {
      html: html,
      listo: function (root) { engancharVista(root); }
    };
  }

  /** Repinta chips, contador y cuadrícula sin tocar el buscador (no pierde el foco). */
  function repintar(root) {
    var lista = resultados();

    var chips = AG.Utils.$('[data-chips]', root);
    if (chips) chips.innerHTML = htmlChips();

    var conteo = AG.Utils.$('[data-conteo]', root);
    if (conteo) conteo.innerHTML = htmlConteo(lista);

    var caja = AG.Utils.$('[data-resultados]', root);
    if (caja) caja.innerHTML = htmlResultados(lista);

    var limpiar = AG.Utils.$('.form-row [data-limpiar]', root);
    if (limpiar) limpiar.classList.toggle('oculto', !hayFiltros());
  }

  function engancharVista(root) {
    if (!root) return;

    var campo = AG.Utils.$('[data-buscar]', root);
    if (campo) {
      var buscar = AG.Utils.debounce(function () {
        estado.texto = campo.value || '';
        estado.mostrar = PASO;
        repintar(root);
      }, 220);
      campo.addEventListener('input', buscar);
      campo.addEventListener('search', buscar);
    }

    AG.Utils.delegar(root, 'click', '[data-grupo]', function () {
      var id = this.getAttribute('data-grupo') || 'todos';
      estado.grupo = (estado.grupo === id && id !== 'todos') ? 'todos' : id;
      estado.mostrar = PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'change', '[data-equipo]', function () {
      estado.equipo = this.value || 'todos';
      estado.mostrar = PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'change', '[data-nivel]', function () {
      estado.nivel = this.value || 'todos';
      estado.mostrar = PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'click', '[data-limpiar]', function () {
      estado.texto = '';
      estado.grupo = 'todos';
      estado.equipo = 'todos';
      estado.nivel = 'todos';
      estado.mostrar = PASO;
      if (campo) campo.value = '';
      var selEquipo = AG.Utils.$('[data-equipo]', root);
      if (selEquipo) selEquipo.value = 'todos';
      var selNivel = AG.Utils.$('[data-nivel]', root);
      if (selNivel) selNivel.value = 'todos';
      repintar(root);
    });

    AG.Utils.delegar(root, 'click', '[data-mas]', function () {
      estado.mostrar += PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'click', '[data-ej]', function () {
      detalle(this.getAttribute('data-ej'));
    });
  }

  /* =============================================================
     5. Detalle del ejercicio
     ============================================================= */

  /**
   * Series y repeticiones recomendadas.
   * @param {String} nivel 'principiante'|'intermedio'|'avanzado'
   * @param {String} tipo  'fuerza'|'hipertrofia'|'cardio'|'movilidad'|'funcional'
   * @returns {{series:Number, reps:String, repsNum:Number, descansoSeg:Number, tempo:String}}
   */
  function sugerencia(nivel, tipo) {
    var porTipo = SUGERENCIAS[tipo] || SUGERENCIAS.hipertrofia;
    var n = nivelInfo(nivel).id || 'intermedio';
    var s = porTipo[n] || porTipo.intermedio;
    return {
      series: s.series,
      reps: s.reps,
      repsNum: s.repsNum,
      descansoSeg: s.descansoSeg,
      tempo: s.tempo
    };
  }

  /** Tres alternativas del mismo grupo, priorizando mismo nivel y otro equipo. */
  function alternativas(ej, cuantas) {
    var n = Number(cuantas) > 0 ? Number(cuantas) : 3;
    var candidatos = filtrar({ grupo: ej.grupo });
    var puntuados = [];

    for (var i = 0; i < candidatos.length; i++) {
      var o = candidatos[i];
      if (!o || o.id === ej.id) continue;
      var p = 0;
      if (o.grupo === ej.grupo) p += 3;          // mismo grupo principal
      if (o.nivel === ej.nivel) p += 2;          // exigencia parecida
      if (o.equipo !== ej.equipo) p += 1;        // da variedad de material
      if (o.tipo === ej.tipo) p += 1;            // mismo propósito
      puntuados.push({ ej: o, p: p });
    }

    puntuados.sort(function (a, b) {
      if (a.p !== b.p) return b.p - a.p;
      var na = String(a.ej.nombre || ''), nb = String(b.ej.nombre || '');
      return na < nb ? -1 : (na > nb ? 1 : 0);
    });

    return puntuados.slice(0, n).map(function (x) { return x.ej; });
  }

  function htmlTablaSugerencias(ej, nivelUsuario) {
    var filas = '';
    for (var i = 0; i < NIVELES.length; i++) {
      var nv = NIVELES[i];
      var s = sugerencia(nv.id, ej.tipo);
      var propia = nv.id === nivelUsuario;
      filas += '<tr' + (propia ? ' class="ejx-fila-on"' : '') + '>' +
        '<td>' + esc(nv.nombre) + (propia ? ' <span class="mini txt-rojo">(tu nivel)</span>' : '') + '</td>' +
        '<td class="nums">' + s.series + '</td>' +
        '<td class="nums">' + esc(s.reps) + '</td>' +
        '<td class="nums">' + esc(textoDescanso(s.descansoSeg)) + '</td>' +
        '<td>' + esc(s.tempo) + '</td>' +
      '</tr>';
    }
    return '<div class="table-wrap"><table class="table table-compacta">' +
      '<thead><tr><th>Nivel</th><th>Series</th><th>Repeticiones</th><th>Descanso</th><th>Ritmo</th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table></div>';
  }

  function htmlAlternativas(ej) {
    var lista = alternativas(ej, 3);
    if (!lista.length) {
      return '<div class="empty"><div class="empty-icono">' + ico('pesa', 26) + '</div>' +
        '<p class="empty-texto">Por ahora no hay otro ejercicio del mismo grupo en la biblioteca.</p></div>';
    }
    var html = '<div class="list">';
    for (var i = 0; i < lista.length; i++) {
      var o = lista[i];
      html += '<button type="button" class="list-item clickable" data-alt="' + esc(o.id) + '">' +
        '<span class="ejx-mini" style="background:' + esc(colorGrupo(o.grupo)) + '">' + ico(datosGrupo(o.grupo).icono, 17) + '</span>' +
        '<span class="list-item-main"><b>' + esc(o.nombre) + '</b>' +
          '<span>' + esc(nombreEquipo(o.equipo)) + ' · ' + esc(nivelInfo(o.nivel).nombre) + ' · ' + esc(nombreTipo(o.tipo)) + '</span>' +
        '</span>' +
        '<span class="list-item-side">' + ico('flecha-der', 16) + '</span>' +
      '</button>';
    }
    return html + '</div>';
  }

  function htmlDetalle(ej, usuario) {
    var g = datosGrupo(ej.grupo);
    var color = colorGrupo(ej.grupo);
    var nivelUsuario = nivelDe(usuario);
    var s = sugerencia(nivelUsuario, ej.tipo);
    var pasos = pasosDe(ej.instrucciones);
    var musculos = musculosDe(ej.musculos);

    var html = '<div class="stack-sm">';

    /* Encabezado con la ilustración del grupo */
    html += '<div class="ejx-hero">' +
      '<span class="ejx-medalla" style="background:' + esc(color) + '">' + ico(g.icono, 26) + '</span>' +
      '<div class="flex1">' + etiquetas(ej) +
        '<p class="mini muted mt-sm">' + esc(nombreTipo(ej.tipo)) + ' · ' + esc(g.nombre) + '</p>' +
      '</div></div>';

    /* Músculos que trabaja */
    html += '<div class="ejx-h">' + ico('corazon', 15) + 'Músculos que trabaja</div>';
    if (musculos.length) {
      html += '<div class="chips">';
      for (var i = 0; i < musculos.length; i++) {
        html += '<span class="pill">' + esc(musculos[i]) + '</span>';
      }
      html += '</div>';
    } else {
      html += '<p class="mini muted">Este ejercicio aún no tiene el detalle de músculos capturado.</p>';
    }

    /* Instrucciones paso a paso */
    html += '<div class="ejx-h">' + ico('reporte', 15) + 'Cómo se hace</div>';
    if (pasos.length) {
      html += '<div class="ejx-pasos">';
      for (var j = 0; j < pasos.length; j++) {
        html += '<div class="ejx-paso"><span class="ejx-num">' + (j + 1) + '</span><span>' + esc(pasos[j]) + '</span></div>';
      }
      html += '</div>';
    } else {
      html += '<p class="mini muted">Sin instrucciones capturadas. Pide a tu coach que te muestre la técnica antes de hacerlo.</p>';
    }

    /* Consejo */
    if (ej.consejos) {
      html += '<div class="aviso aviso-rojo">' + ico('alerta', 17) +
        '<div><b>Consejo del coach.</b> ' + esc(ej.consejos) + '</div></div>';
    }

    /* Series y repeticiones */
    html += '<div class="ejx-h">' + ico('historial', 15) + 'Series y repeticiones sugeridas</div>';
    if (nivelUsuario) {
      html += '<div class="caja"><div class="between wrap">' +
        '<div class="dato"><span class="dato-label">Para tu nivel · ' + esc(nivelInfo(nivelUsuario).nombre) + '</span>' +
          '<span class="dato-val">' + s.series + ' series · ' + esc(s.reps) + '</span></div>' +
        '<div class="dato"><span class="dato-label">Descanso</span><span class="dato-val">' + esc(textoDescanso(s.descansoSeg)) + '</span></div>' +
        '<div class="dato"><span class="dato-label">Ritmo</span><span class="dato-val">' + esc(s.tempo) + '</span></div>' +
      '</div></div>';
    }
    html += htmlTablaSugerencias(ej, nivelUsuario);

    /* Alternativas */
    html += '<div class="ejx-h">' + ico('mancuerna', 15) + 'Si está ocupado, prueba con</div>';
    html += htmlAlternativas(ej);

    html += '</div>';
    return html;
  }

  /**
   * Modal con la técnica completa de un ejercicio.
   * @param {String} ejercicioId
   * @returns {Object|null} api del modal
   */
  function detalle(ejercicioId) {
    asegurarEstilos();

    var ej = (AG.Data && typeof AG.Data.ejercicio === 'function') ? AG.Data.ejercicio(ejercicioId) : null;
    if (!ej) {
      toast('No encontramos ese ejercicio en la biblioteca', 'error');
      return null;
    }

    var usuario = AG.Auth.actual();
    var acciones = [{ texto: 'Cerrar', clase: 'btn-ghost' }];

    if (usuario && usuario.rol === 'socio') {
      acciones.push({
        texto: 'Agregar a mi registro de hoy',
        clase: 'btn-primary',
        icono: 'mas',
        onClick: function (api) {
          if (agregarABitacora(ej, usuario)) api.cerrar();
        }
      });
    } else if (usuario && (usuario.rol === 'coach' || usuario.rol === 'director')) {
      acciones.push({
        texto: 'Usar en rutina',
        clase: 'btn-primary',
        icono: 'check',
        onClick: function (api) {
          usarEnRutina(ej, usuario);
          api.cerrar();
        }
      });
    }

    return AG.Utils.modal({
      titulo: ej.nombre,
      ancho: 'lg',
      cuerpo: htmlDetalle(ej, usuario),
      acciones: acciones,
      onOpen: function (raiz, api) {
        AG.Utils.delegar(raiz, 'click', '[data-alt]', function () {
          var otro = this.getAttribute('data-alt');
          api.cerrar();
          detalle(otro);
        });
      }
    });
  }

  /* =============================================================
     6. Acciones sobre los datos
     ============================================================= */

  /**
   * Bloque listo para pegarse en un día de rutina.
   * @returns {Object|null} { ejercicioId, nombre, grupo, series, reps, descansoSeg, tempo, peso, notas }
   */
  function paraRutina(ejercicioId, nivel) {
    var ej = (AG.Data && typeof AG.Data.ejercicio === 'function') ? AG.Data.ejercicio(ejercicioId) : null;
    if (!ej) return null;
    var s = sugerencia(nivel || nivelDe(AG.Auth.actual()), ej.tipo);
    return {
      ejercicioId: ej.id,
      nombre: ej.nombre,
      grupo: ej.grupo,
      series: s.series,
      reps: s.reps,
      descansoSeg: s.descansoSeg,
      tempo: s.tempo,
      peso: '',
      notas: ''
    };
  }

  /** Guarda el ejercicio en el portapapeles del constructor de rutinas. */
  function usarEnRutina(ej, usuario) {
    if (!usuario || (usuario.rol !== 'coach' && usuario.rol !== 'director')) {
      toast('Solo dirección y los coaches arman rutinas', 'warn');
      return false;
    }
    var bloque = paraRutina(ej.id, '');
    if (!bloque) {
      toast('No pudimos preparar ese ejercicio', 'error');
      return false;
    }
    Mod.ultimoSeleccionado = bloque;
    toast('«' + ej.nombre + '» quedó listo: ábrelo desde Rutinas para agregarlo al día', 'ok');
    return true;
  }

  /** Entrega el ejercicio copiado y limpia el portapapeles. */
  function tomarSeleccionado() {
    var bloque = Mod.ultimoSeleccionado;
    Mod.ultimoSeleccionado = null;
    return bloque;
  }

  /**
   * Crea o actualiza la bitácora de hoy del socio con este ejercicio.
   * Si el socio ya tiene rutina activa, el ejercicio entra como extra
   * dentro de la misma sesión del día.
   * @returns {Boolean} true si la bitácora quedó guardada
   */
  function agregarABitacora(ej, usuario) {
    if (!usuario || usuario.rol !== 'socio') {
      toast('Solo los socios llevan registro de entrenamiento', 'warn');
      return false;
    }
    // El socio únicamente puede tocar su propia bitácora.
    if (!AG.Auth.puedeVer(usuario, usuario.id)) {
      toast('No tienes permiso para modificar ese registro', 'error');
      return false;
    }

    var hoy = AG.Utils.hoy();
    var previas = AG.DB.donde('bitacoras', function (b) {
      return b && b.socioId === usuario.id && String(b.fecha || '').slice(0, 10) === hoy;
    });
    var bitacora = previas.length ? previas[0] : null;

    var s = sugerencia(nivelDe(usuario), ej.tipo);
    var series = [];
    for (var i = 0; i < s.series; i++) {
      series.push({ reps: s.repsNum, peso: 0, hecho: false });
    }

    if (bitacora) {
      var lista = (Object.prototype.toString.call(bitacora.ejercicios) === '[object Array]')
        ? bitacora.ejercicios.slice() : [];

      for (var j = 0; j < lista.length; j++) {
        if (lista[j] && lista[j].ejercicioId === ej.id) {
          toast('«' + ej.nombre + '» ya estaba en tu registro de hoy', 'info');
          return false;
        }
      }

      lista.push({ ejercicioId: ej.id, series: series });
      AG.DB.actualizar('bitacoras', bitacora.id, { ejercicios: lista });
      toast('Agregamos «' + ej.nombre + '» a tu registro de hoy', 'ok');
    } else {
      var rutinaId = null;
      var diaIndex = 0;
      var activa = AG.DB.rutinaActivaDe(usuario.id);

      if (activa && activa.rutina) {
        rutinaId = activa.rutina.id;
        var dias = (Object.prototype.toString.call(activa.rutina.dias) === '[object Array]')
          ? activa.rutina.dias.length : 0;
        if (dias > 0) {
          // Se rota el día de la rutina según las sesiones ya registradas con ella.
          var hechas = AG.DB.donde('bitacoras', function (b) {
            return b && b.socioId === usuario.id && b.rutinaId === rutinaId;
          }).length;
          diaIndex = hechas % dias;
        }
      }

      AG.DB.insertar('bitacoras', {
        socioId: usuario.id,
        fecha: hoy,
        rutinaId: rutinaId,
        diaIndex: diaIndex,
        ejercicios: [{ ejercicioId: ej.id, series: series }],
        duracionMin: 0,
        esfuerzo: 5,
        notas: 'Ejercicio agregado desde la biblioteca',
        completada: false
      });
      toast('Creamos tu registro de hoy con «' + ej.nombre + '»', 'ok');
    }

    AG.Router.refrescar();
    return true;
  }

  /* =============================================================
     7. Selector compacto (lo usa el constructor de rutinas)
     ============================================================= */

  function htmlSelChips(f) {
    var base = filtrar({ texto: f.texto });
    var lista = grupos();
    var html = '<button type="button" class="chip chip-sm' + (f.grupo === 'todos' ? ' on' : '') +
      '" data-selgrupo="todos">Todos <span class="ejx-n">' + base.length + '</span></button>';

    for (var i = 0; i < lista.length; i++) {
      var g = lista[i];
      var n = 0;
      for (var j = 0; j < base.length; j++) {
        if (esDelGrupo(base[j], g.id)) n++;
      }
      var activo = f.grupo === g.id;
      html += '<button type="button" class="chip chip-sm' + (activo ? ' on' : '') + '" data-selgrupo="' + esc(g.id) + '"' +
        (n === 0 && !activo ? ' disabled' : '') + '>' +
        '<span class="ejx-punto" style="background:' + esc(colorGrupo(g.id)) + '"></span>' +
        esc(g.nombre) + ' <span class="ejx-n">' + n + '</span></button>';
    }
    return html;
  }

  function htmlSelLista(lista, elegidos, multiple) {
    if (!lista.length) {
      return '<div class="empty"><div class="empty-icono">' + ico('buscar', 26) + '</div>' +
        '<p class="empty-texto">Nada coincide con esa búsqueda. Prueba con otra palabra o cambia de grupo.</p></div>';
    }

    var html = '';
    for (var i = 0; i < lista.length; i++) {
      var ej = lista[i];
      var marcado = elegidos.indexOf(ej.id) !== -1;
      html += '<button type="button" class="list-item clickable ejx-sel" data-sel="' + esc(ej.id) + '" ' +
        'aria-pressed="' + (marcado ? 'true' : 'false') + '">' +
        '<span class="ejx-mini" style="background:' + esc(colorGrupo(ej.grupo)) + '">' + ico(datosGrupo(ej.grupo).icono, 17) + '</span>' +
        '<span class="list-item-main"><b>' + esc(ej.nombre) + '</b>' +
          '<span>' + esc(datosGrupo(ej.grupo).nombre) + ' · ' + esc(nombreEquipo(ej.equipo)) + ' · ' + esc(nivelInfo(ej.nivel).nombre) + '</span>' +
        '</span>' +
        '<span class="list-item-side">' +
          (multiple
            ? (marcado ? '<span class="txt-ok">' + ico('check', 18) + '</span>' : ico('mas', 18))
            : ico('flecha-der', 16)) +
        '</span>' +
      '</button>';
    }
    return html;
  }

  /**
   * Modal buscador compacto para elegir ejercicios.
   * @param {Function} callback recibe el ejercicio (o un array si opts.multiple)
   * @param {Object} [opts] { multiple:Boolean, titulo:String, grupo:String,
   *                          seleccionados:[ids], textoAccion:String }
   * @returns {Object|null} api del modal
   */
  function selector(callback, opts) {
    asegurarEstilos();

    if (typeof callback !== 'function') {
      toast('El selector de ejercicios se abrió sin destino', 'error');
      return null;
    }
    if (!catalogo().length) {
      toast('La biblioteca de ejercicios no está disponible', 'error');
      return null;
    }

    var o = opts || {};
    var multiple = !!o.multiple;
    var elegidos = [];

    if (Object.prototype.toString.call(o.seleccionados) === '[object Array]') {
      for (var i = 0; i < o.seleccionados.length; i++) {
        var id = String(o.seleccionados[i] || '');
        if (id && elegidos.indexOf(id) === -1 && AG.Data.ejercicio(id)) elegidos.push(id);
      }
    }

    var f = { texto: '', grupo: 'todos' };
    if (o.grupo && datosGrupo(o.grupo).id === o.grupo) f.grupo = o.grupo;

    function lista() {
      return filtrar({ texto: f.texto, grupo: f.grupo });
    }

    var inicial = lista();

    var cuerpo = '' +
      '<div class="stack-sm">' +
        '<div class="input-icono">' + ico('buscar', 17) +
          '<input class="input" type="search" autocomplete="off" data-selbuscar autofocus ' +
          'placeholder="Busca por nombre o músculo…">' +
        '</div>' +
        '<div class="chips" data-selchips>' + htmlSelChips(f) + '</div>' +
        '<div class="between wrap mini muted">' +
          '<span data-selconteo>' + inicial.length + ' ejercicios</span>' +
          (multiple ? '<span data-selelegidos>' + elegidos.length + ' seleccionados</span>' : '') +
        '</div>' +
        '<div class="list ejx-lista" data-sellista>' + htmlSelLista(inicial, elegidos, multiple) + '</div>' +
      '</div>';

    var acciones = [{ texto: 'Cancelar', clase: 'btn-ghost' }];
    if (multiple) {
      acciones.push({
        texto: o.textoAccion || 'Agregar seleccionados',
        clase: 'btn-primary',
        icono: 'check',
        onClick: function (api) {
          if (!elegidos.length) {
            toast('Selecciona al menos un ejercicio', 'warn');
            return;
          }
          var salida = [];
          for (var k = 0; k < elegidos.length; k++) {
            var ejSel = AG.Data.ejercicio(elegidos[k]);
            if (ejSel) salida.push(ejSel);
          }
          api.cerrar();
          callback(salida);
        }
      });
    }

    var api = AG.Utils.modal({
      titulo: o.titulo || (multiple ? 'Elegir ejercicios' : 'Elegir ejercicio'),
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: acciones,
      onOpen: function (raiz, apiModal) {

        function repintarLista() {
          var actual = lista();
          var chips = AG.Utils.$('[data-selchips]', raiz);
          if (chips) chips.innerHTML = htmlSelChips(f);
          var conteo = AG.Utils.$('[data-selconteo]', raiz);
          if (conteo) {
            conteo.innerHTML = esc(actual.length === 1 ? '1 ejercicio' : actual.length + ' ejercicios');
          }
          var caja = AG.Utils.$('[data-sellista]', raiz);
          if (caja) caja.innerHTML = htmlSelLista(actual, elegidos, multiple);
          actualizarContador();
        }

        function actualizarContador() {
          if (!multiple) return;
          var marca = AG.Utils.$('[data-selelegidos]', raiz);
          if (marca) {
            marca.innerHTML = esc(elegidos.length === 1 ? '1 seleccionado' : elegidos.length + ' seleccionados');
          }
        }

        function elegir(idEj) {
          var ejSel = AG.Data.ejercicio(idEj);
          if (!ejSel) return;

          if (!multiple) {
            apiModal.cerrar();
            callback(ejSel);
            return;
          }

          var pos = elegidos.indexOf(idEj);
          if (pos === -1) elegidos.push(idEj);
          else elegidos.splice(pos, 1);

          var boton = AG.Utils.$('[data-sel="' + idEj + '"]', raiz);
          if (boton) {
            var marcado = elegidos.indexOf(idEj) !== -1;
            boton.setAttribute('aria-pressed', marcado ? 'true' : 'false');
            var lado = AG.Utils.$('.list-item-side', boton);
            if (lado) {
              lado.innerHTML = marcado ? '<span class="txt-ok">' + ico('check', 18) + '</span>' : ico('mas', 18);
            }
          }
          actualizarContador();
        }

        var campo = AG.Utils.$('[data-selbuscar]', raiz);
        if (campo) {
          var buscar = AG.Utils.debounce(function () {
            f.texto = campo.value || '';
            repintarLista();
          }, 180);
          campo.addEventListener('input', buscar);
          campo.addEventListener('search', buscar);
          campo.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.keyCode !== 13) return;
            e.preventDefault();
            var actual = lista();
            if (actual.length) elegir(actual[0].id);
          });
        }

        AG.Utils.delegar(raiz, 'click', '[data-selgrupo]', function () {
          var g = this.getAttribute('data-selgrupo') || 'todos';
          f.grupo = (f.grupo === g && g !== 'todos') ? 'todos' : g;
          repintarLista();
        });

        AG.Utils.delegar(raiz, 'click', '[data-sel]', function () {
          elegir(this.getAttribute('data-sel'));
        });
      }
    });

    return api;
  }

  /* =============================================================
     8. Exportación y rutas
     ============================================================= */

  var Mod = {
    render: render,
    detalle: detalle,
    selector: selector,
    sugerencia: sugerencia,
    paraRutina: paraRutina,
    tomarSeleccionado: tomarSeleccionado,
    tarjeta: tarjeta,
    ultimoSeleccionado: null
  };

  AG.Mod.Ejercicios = Mod;

  AG.Router.registrar({
    path: 'director/ejercicios',
    roles: ['director'],
    titulo: 'Biblioteca de ejercicios',
    nav: { etiqueta: 'Ejercicios', icono: 'pesa', grupo: 'Entrenamiento', orden: 5 },
    render: render
  });

  AG.Router.registrar({
    path: 'coach/ejercicios',
    roles: ['coach'],
    titulo: 'Biblioteca de ejercicios',
    nav: { etiqueta: 'Ejercicios', icono: 'pesa', grupo: 'Entrenamiento', orden: 5 },
    render: render
  });

  AG.Router.registrar({
    path: 'socio/ejercicios',
    roles: ['socio'],
    titulo: 'Biblioteca de ejercicios',
    nav: { etiqueta: 'Ejercicios', icono: 'pesa', grupo: 'Mi entrenamiento', orden: 5 },
    render: render
  });

})(window.AG);
