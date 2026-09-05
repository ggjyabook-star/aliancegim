/* =============================================================
   ALLIANCE GYM — Rutinas de entrenamiento (AG.Mod.Rutinas)
   -------------------------------------------------------------
   Rutas que registra:
     director/rutinas  · coach/rutinas   -> listado (Plantillas · Asignaciones)
     director/rutina   · coach/rutina    -> editor (?id= para editar)

   API compartida con el resto del sistema:
     AG.Mod.Rutinas.editor(rutinaId|null)          abre el constructor
     AG.Mod.Rutinas.asignar(socioId, rutinaId?)    modal de asignación
     AG.Mod.Rutinas.vistaDia(rutina, i, opts)      HTML del día de entrenamiento
     AG.Mod.Rutinas.resumen(rutina)                HTML compacto para tarjetas
     AG.Mod.Rutinas.leerRegistro(root)             lee la bitácora capturada
     AG.Mod.Rutinas.estadisticas(rutina)           conteos derivados

   Control de acceso real:
     - El director ve y edita todo.
     - El coach ve la biblioteca completa de plantillas, pero solo edita o
       elimina las que él creó, y solo ve/asigna rutinas a SUS socios
       (AG.Auth.puedeVer).
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;

  /* =========================================================
     1. Constantes de dominio
     ========================================================= */

  var OBJETIVOS = [
    { id: 'perder_grasa', nombre: 'Perder grasa' },
    { id: 'ganar_musculo', nombre: 'Ganar músculo' },
    { id: 'mantener', nombre: 'Mantener' },
    { id: 'rendimiento', nombre: 'Rendimiento' },
    { id: 'salud', nombre: 'Salud general' }
  ];

  var NIVELES = [
    { id: 'principiante', nombre: 'Principiante' },
    { id: 'intermedio', nombre: 'Intermedio' },
    { id: 'avanzado', nombre: 'Avanzado' }
  ];

  /* Segundos de trabajo efectivo que se suman a cada serie para estimar la duración */
  var SEG_TRABAJO_SERIE = 40;

  /* Estado vivo de la pantalla de listado (se conserva entre repintados) */
  var filtros = {
    tab: 'plantillas',
    q: '',
    objetivo: 'todos',
    nivel: 'todos',
    dias: 'todos',
    qAsig: '',
    verFinalizadas: false
  };

  /* Borrador del editor: sobrevive a AG.Router.refrescar() mientras no se guarde */
  var editorEstado = null;

  var estilosListos = false;
  var detalleEnganchado = false;

  /* =========================================================
     2. Ayudantes básicos
     ========================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    if (AG.Icons && typeof AG.Icons.get === 'function') {
      try { return AG.Icons.get(nombre, tam || 18); } catch (e) { return ''; }
    }
    return '';
  }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function lista(v) { return esArreglo(v) ? v : []; }

  function entero(v, porDefecto) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : porDefecto;
  }

  function texto(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }

  /** Nombre legible de un objetivo de rutina. */
  function nombreObjetivo(id) {
    for (var i = 0; i < OBJETIVOS.length; i++) {
      if (OBJETIVOS[i].id === id) return OBJETIVOS[i].nombre;
    }
    return 'Sin objetivo';
  }

  /** Nombre legible de un nivel. */
  function nombreNivel(id) {
    for (var i = 0; i < NIVELES.length; i++) {
      if (NIVELES[i].id === id) return NIVELES[i].nombre;
    }
    return 'Sin nivel';
  }

  /** 'director' o 'coach' según quién esté en sesión (define el prefijo de ruta). */
  function baseDe(usuario) {
    return (usuario && usuario.rol === 'director') ? 'director' : 'coach';
  }

  function usuarioEnSesion() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  /** Ejercicio del catálogo (o null). */
  function ejercicioDe(id) {
    if (AG.Data && typeof AG.Data.ejercicio === 'function') {
      try { return AG.Data.ejercicio(id); } catch (e) { return null; }
    }
    return null;
  }

  function nombreEjercicio(id) {
    var ej = ejercicioDe(id);
    return ej && ej.nombre ? ej.nombre : 'Ejercicio no disponible';
  }

  /** Datos del grupo muscular (nombre y color) siempre con respaldo. */
  function grupoDe(id) {
    if (AG.Data && typeof AG.Data.grupo === 'function') {
      try { return AG.Data.grupo(id); } catch (e) { /* respaldo abajo */ }
    }
    return { id: 'general', nombre: 'General', color: '#8a8f98', icono: 'pesa' };
  }

  function gruposCatalogo() {
    if (AG.Data && esArreglo(AG.Data.GRUPOS)) return AG.Data.GRUPOS;
    return [];
  }

  /** Nombre completo de un usuario por id. */
  function nombreUsuario(id, respaldo) {
    if (!id || !AG.DB || typeof AG.DB.usuario !== 'function') return respaldo || 'Sin asignar';
    var u = AG.DB.usuario(id);
    return u ? U.nombreCompleto(u) : (respaldo || 'Sin asignar');
  }

  /** <option> de una lista de {id, nombre}. */
  function opciones(items, valor, todos) {
    var html = '';
    if (todos) {
      html += '<option value="todos"' + (valor === 'todos' || !valor ? ' selected' : '') + '>' + esc(todos) + '</option>';
    }
    for (var i = 0; i < items.length; i++) {
      html += '<option value="' + esc(items[i].id) + '"' + (items[i].id === valor ? ' selected' : '') + '>' +
        esc(items[i].nombre) + '</option>';
    }
    return html;
  }

  /** Estado vacío reutilizable. */
  function vacio(iconoNombre, titulo, mensaje, botones) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre, 30) + '</div>' +
      '<h3 class="card-title">' + esc(titulo) + '</h3>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botones ? '<div class="row center wrap">' + botones + '</div>' : '') +
      '</div>';
  }

  /* =========================================================
     3. Estilos propios (variantes puntuales, mínimas)
     ========================================================= */

  function estilos() {
    if (estilosListos) return;
    if (!document || !document.head) return;
    if (document.getElementById('ag-rutinas-css')) { estilosListos = true; return; }

    var st = document.createElement('style');
    st.id = 'ag-rutinas-css';
    st.textContent =
      '.rt-punto{width:9px;height:9px;border-radius:50%;display:inline-block;flex:0 0 auto}' +
      '.rt-sticky{position:sticky;top:0;z-index:6;background:var(--panel);border:1px solid var(--borde);' +
        'border-radius:var(--radio);padding:12px 14px;box-shadow:var(--sombra)}' +
      '.rt-ej{border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);padding:10px 12px}' +
      '.rt-idx{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;' +
        'background:var(--rojo);color:#fff;font-size:12px;font-weight:800;line-height:1}' +
      '.rt-campos{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));margin-top:10px}' +
      '.rt-campos .label{font-size:10px}' +
      '.rt-campos .input{height:36px;font-size:13px}' +
      '.rt-series{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(206px,1fr));margin-top:10px}' +
      '.rt-serie{display:flex;align-items:center;gap:6px;border:1px solid var(--borde);' +
        'border-radius:var(--radio-sm);background:var(--panel);padding:6px 8px}' +
      '.rt-serie .input{height:34px;padding:0 8px;font-size:13px}' +
      '.rt-s{flex:0 0 24px;font-size:11px;font-weight:800;color:var(--texto-3)}' +
      '.rt-mini{max-width:80px}' +
      '.rt-sel{background:var(--panel-2);box-shadow:inset 3px 0 0 var(--rojo)}' +
      '.rt-tarjeta-dia{border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel);padding:12px 13px}' +
      '@media(max-width:520px){.rt-campos{grid-template-columns:repeat(auto-fit,minmax(92px,1fr))}}';

    document.head.appendChild(st);
    estilosListos = true;
  }

  /* =========================================================
     4. Cálculos derivados de una rutina
     ========================================================= */

  /** Series de un ejercicio como número seguro (0 a 20). */
  function seriesDe(ej) {
    var n = entero(ej && ej.series, 0);
    if (n < 0) n = 0;
    if (n > 20) n = 20;
    return n;
  }

  /** Descanso en segundos como número seguro. */
  function descansoDe(ej) {
    var n = entero(ej && ej.descansoSeg, 60);
    if (n < 0) n = 0;
    if (n > 600) n = 600;
    return n;
  }

  /** Estadísticas de un día: ejercicios, series, minutos y grupos trabajados. */
  function estadisticasDia(dia) {
    var ejercicios = lista(dia && dia.ejercicios);
    var series = 0, segundos = 0, grupos = [], i, s, ej, cat;

    for (i = 0; i < ejercicios.length; i++) {
      ej = ejercicios[i];
      s = seriesDe(ej);
      series += s;
      segundos += s * (descansoDe(ej) + SEG_TRABAJO_SERIE);
      cat = ejercicioDe(ej && ej.ejercicioId);
      if (cat && cat.grupo && grupos.indexOf(cat.grupo) < 0) grupos.push(cat.grupo);
    }

    return {
      ejercicios: ejercicios.length,
      series: series,
      minutos: Math.round(segundos / 60),
      grupos: ordenarGrupos(grupos)
    };
  }

  /** Ordena los grupos según el catálogo para que los chips salgan siempre igual. */
  function ordenarGrupos(ids) {
    var catalogo = gruposCatalogo();
    if (!catalogo.length) return ids.slice();
    var salida = [], i;
    for (i = 0; i < catalogo.length; i++) {
      if (ids.indexOf(catalogo[i].id) >= 0) salida.push(catalogo[i].id);
    }
    for (i = 0; i < ids.length; i++) {
      if (salida.indexOf(ids[i]) < 0) salida.push(ids[i]);
    }
    return salida;
  }

  /** Estadísticas completas de la rutina. */
  function estadisticas(rutina) {
    var dias = lista(rutina && rutina.dias);
    var total = { dias: dias.length, ejercicios: 0, series: 0, minutos: 0, grupos: [] };
    var i, j, st;

    for (i = 0; i < dias.length; i++) {
      st = estadisticasDia(dias[i]);
      total.ejercicios += st.ejercicios;
      total.series += st.series;
      total.minutos += st.minutos;
      for (j = 0; j < st.grupos.length; j++) {
        if (total.grupos.indexOf(st.grupos[j]) < 0) total.grupos.push(st.grupos[j]);
      }
    }
    total.grupos = ordenarGrupos(total.grupos);
    total.minutosPromedio = dias.length ? Math.round(total.minutos / dias.length) : 0;
    return total;
  }

  /** Chips de colores con los grupos musculares trabajados. */
  function chipsGrupos(ids, maximo) {
    var arr = lista(ids);
    if (!arr.length) return '<span class="mini muted">Sin grupos definidos</span>';

    var tope = maximo || arr.length;
    var html = '<div class="chips">';
    var i, g;

    for (i = 0; i < arr.length && i < tope; i++) {
      g = grupoDe(arr[i]);
      html += '<span class="chip chip-sm" style="cursor:default">' +
        '<i class="rt-punto" style="background:' + esc(g.color) + '"></i>' + esc(g.nombre) +
        '</span>';
    }
    if (arr.length > tope) {
      html += '<span class="chip chip-sm" style="cursor:default">+' + (arr.length - tope) + '</span>';
    }
    return html + '</div>';
  }

  /* =========================================================
     5. Permisos
     ========================================================= */

  /** ¿Puede este usuario modificar o eliminar la rutina? */
  function puedeEditarRutina(usuario, rutina) {
    if (!usuario || !rutina) return false;
    if (usuario.rol === 'director') return true;
    if (usuario.rol === 'coach') return rutina.creadaPor === usuario.id;
    return false;
  }

  /** ¿Puede ver la ficha de este socio? Delegado en AG.Auth. */
  function puedeVerSocio(usuario, socioId) {
    if (AG.Auth && typeof AG.Auth.puedeVer === 'function') {
      try { return AG.Auth.puedeVer(usuario, socioId); } catch (e) { return false; }
    }
    return !!(usuario && usuario.rol === 'director');
  }

  /** Socios que este usuario tiene permitido gestionar. */
  function sociosDe(usuario) {
    if (!AG.DB) return [];
    if (usuario && usuario.rol === 'coach') return AG.DB.sociosDe(usuario.id);
    return AG.DB.socios();
  }

  /* =========================================================
     6. Resumen compacto y vista del día (API pública)
     ========================================================= */

  /**
   * HTML compacto de una rutina para tarjetas y fichas.
   * @param {Object} rutina
   * @returns {String}
   */
  function resumen(rutina) {
    if (!rutina || typeof rutina !== 'object') {
      return '<p class="mini muted">Sin rutina asignada.</p>';
    }
    var st = estadisticas(rutina);
    var dias = entero(rutina.diasPorSemana, st.dias) || st.dias;

    return '<div class="stack-sm">' +
      '<div class="row wrap" style="gap:6px">' +
        '<span class="pill">' + icono('meta', 13) + esc(nombreObjetivo(rutina.objetivo)) + '</span>' +
        '<span class="pill">' + icono('trofeo', 13) + esc(nombreNivel(rutina.nivel)) + '</span>' +
        '<span class="pill">' + icono('calendario', 13) + '<b>' + dias + '</b> días/semana</span>' +
        '<span class="pill">' + icono('mancuerna', 13) + '<b>' + st.ejercicios + '</b> ejercicios</span>' +
        '<span class="pill">' + icono('reloj', 13) + '≈ <b>' + st.minutosPromedio + '</b> min por sesión</span>' +
      '</div>' +
      chipsGrupos(st.grupos, 6) +
    '</div>';
  }

  /** Texto corto con series × repeticiones. */
  function seriesPorReps(ej) {
    var s = seriesDe(ej);
    var reps = texto(ej && ej.reps).trim();
    if (!s && !reps) return 'Sin prescripción';
    if (!reps) return s + ' series';
    return s + ' × ' + reps;
  }

  /** Segundos a texto legible ('90 s' / '1:30 min'). */
  function descansoTexto(seg) {
    var n = entero(seg, 0);
    if (n <= 0) return 'Sin descanso';
    if (n < 60) return n + ' s';
    var min = Math.floor(n / 60);
    var resto = n % 60;
    return resto ? min + ':' + (resto < 10 ? '0' : '') + resto + ' min' : min + ' min';
  }

  /** Serie previamente registrada (para precargar la bitácora). */
  function serieRegistrada(registro, ejercicioId, indiceEj, indiceSerie) {
    var ejercicios = lista(registro && registro.ejercicios);
    var i, e;
    for (i = 0; i < ejercicios.length; i++) {
      e = ejercicios[i];
      if (!e) continue;
      if (e.ejercicioId === ejercicioId || i === indiceEj) {
        var series = lista(e.series);
        if (series[indiceSerie]) return series[indiceSerie];
      }
    }
    return null;
  }

  /** Controles de captura de series para el socio. */
  function htmlSeriesInteractivas(ej, indiceEj, registro) {
    var total = seriesDe(ej);
    if (!total) {
      return '<p class="mini muted mt">Este ejercicio no tiene series definidas.</p>';
    }

    var html = '<div class="rt-series">';
    var j, previa, reps, peso, hecho;

    for (j = 0; j < total; j++) {
      previa = serieRegistrada(registro, ej.ejercicioId, indiceEj, j);
      reps = previa && previa.reps !== null && previa.reps !== undefined ? previa.reps : '';
      peso = previa && previa.peso !== null && previa.peso !== undefined ? previa.peso : '';
      hecho = !!(previa && previa.hecho);

      html += '<div class="rt-serie" data-serie="' + j + '">' +
        '<span class="rt-s">S' + (j + 1) + '</span>' +
        '<input class="input rt-mini" type="number" min="0" step="1" inputmode="numeric" data-reps ' +
          'placeholder="reps" aria-label="Repeticiones de la serie ' + (j + 1) + '" value="' + esc(reps) + '">' +
        '<input class="input rt-mini" type="number" min="0" step="0.5" inputmode="decimal" data-peso ' +
          'placeholder="kg" aria-label="Peso de la serie ' + (j + 1) + '" value="' + esc(peso) + '">' +
        '<label class="check" title="Marcar la serie como hecha">' +
          '<input type="checkbox" data-hecho' + (hecho ? ' checked' : '') + '>' +
          '<span class="mini">Hecha</span>' +
        '</label>' +
      '</div>';
    }
    return html + '</div>';
  }

  /**
   * HTML del día de entrenamiento.
   * @param {Object} rutina
   * @param {Number} indice índice del día
   * @param {Object} [opts] { interactivo:Boolean, registro:Bitacora, sinDetalle:Boolean }
   * @returns {String}
   */
  function vistaDia(rutina, indice, opts) {
    estilos();
    engancharDetalleGlobal();

    var o = opts && typeof opts === 'object' ? opts : {};
    var dias = lista(rutina && rutina.dias);
    var i = entero(indice, 0);
    if (i < 0) i = 0;

    if (!dias.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('mancuerna', 'Esta rutina no tiene días', 'Edita la rutina y agrega al menos un día con ejercicios.') +
        '</div></div>';
    }
    if (i >= dias.length) i = dias.length - 1;

    var dia = dias[i] || {};
    var st = estadisticasDia(dia);
    var ejercicios = lista(dia.ejercicios);

    var html = '<div class="stack">';

    /* --- Encabezado del día --- */
    html += '<div class="rt-tarjeta-dia">' +
      '<div class="between wrap" style="gap:10px">' +
        '<div style="min-width:0">' +
          '<h3 class="card-title">' + esc(dia.nombre || ('Día ' + (i + 1))) + '</h3>' +
          '<p class="card-sub">' + esc(dia.enfoque || 'Sin enfoque definido') + '</p>' +
        '</div>' +
        '<div class="row-sm wrap">' +
          '<span class="pill">' + icono('mancuerna', 13) + '<b>' + st.ejercicios + '</b> ejercicios</span>' +
          '<span class="pill">' + icono('pesa', 13) + '<b>' + st.series + '</b> series</span>' +
          '<span class="pill">' + icono('reloj', 13) + '≈ <b>' + st.minutos + '</b> min</span>' +
        '</div>' +
      '</div>' +
      '<div class="mt-sm">' + chipsGrupos(st.grupos, 8) + '</div>' +
    '</div>';

    /* --- Calentamiento --- */
    if (texto(dia.calentamiento).trim()) {
      html += '<div class="aviso aviso-warn">' + icono('fuego', 18) +
        '<div><b>Calentamiento</b><br>' + esc(dia.calentamiento) + '</div></div>';
    }

    /* --- Ejercicios --- */
    if (!ejercicios.length) {
      html += '<div class="card"><div class="card-body">' +
        vacio('mancuerna', 'Día sin ejercicios', 'Este día todavía no tiene ejercicios cargados.') +
        '</div></div>';
    } else {
      html += '<div class="stack-sm">';
      for (var k = 0; k < ejercicios.length; k++) {
        html += htmlEjercicioVista(ejercicios[k], k, o);
      }
      html += '</div>';
    }

    /* --- Cardio final --- */
    if (texto(dia.cardio).trim()) {
      html += '<div class="aviso aviso-info">' + icono('corazon', 18) +
        '<div><b>Cardio final</b><br>' + esc(dia.cardio) + '</div></div>';
    }

    return html + '</div>';
  }

  /** Una fila de ejercicio dentro de vistaDia(). */
  function htmlEjercicioVista(ej, indice, o) {
    var cat = ejercicioDe(ej && ej.ejercicioId);
    var nombre = cat && cat.nombre ? cat.nombre : 'Ejercicio no disponible';
    var g = cat ? grupoDe(cat.grupo) : null;
    var peso = texto(ej && ej.peso).trim();
    var tempo = texto(ej && ej.tempo).trim();
    var notas = texto(ej && ej.notas).trim();

    var html = '<div class="rt-ej"' + (o.interactivo ? ' data-registro-ej="' + indice + '" data-ejercicio-id="' + esc(ej.ejercicioId) + '"' : '') + '>';

    html += '<div class="between wrap" style="gap:8px">' +
      '<div class="row-sm" style="min-width:0">' +
        '<span class="rt-idx">' + (indice + 1) + '</span>' +
        '<div style="min-width:0">' +
          '<div class="bold truncar">' + esc(nombre) + '</div>' +
          '<div class="mini muted">' +
            (g ? '<i class="rt-punto" style="background:' + esc(g.color) + ';margin-right:5px"></i>' + esc(g.nombre) : 'Sin grupo') +
            (cat && cat.equipo && AG.Data && typeof AG.Data.nombreEquipo === 'function'
              ? ' · ' + esc(AG.Data.nombreEquipo(cat.equipo)) : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      (o.sinDetalle || !cat ? '' :
        '<button type="button" class="btn btn-sm btn-ghost" data-ag-ej-detalle="' + esc(ej.ejercicioId) + '">' +
          icono('info', 15) + ' Técnica</button>') +
    '</div>';

    html += '<div class="row-sm wrap mt-sm">' +
      '<span class="pill pill-rojo">' + esc(seriesPorReps(ej)) + '</span>' +
      '<span class="pill">' + icono('reloj', 13) + esc(descansoTexto(ej && ej.descansoSeg)) + '</span>' +
      (tempo ? '<span class="pill">Tempo ' + esc(tempo) + '</span>' : '') +
      (peso ? '<span class="pill">' + icono('balanza', 13) + esc(peso) + '</span>' : '') +
    '</div>';

    if (notas) {
      html += '<p class="mini muted mt-sm">' + icono('info', 12) + ' ' + esc(notas) + '</p>';
    }

    if (o.interactivo) {
      html += htmlSeriesInteractivas(ej, indice, o.registro);
    }

    return html + '</div>';
  }

  /**
   * Lee los controles interactivos pintados por vistaDia({interactivo:true}).
   * @param {HTMLElement} root
   * @returns {Array} ejercicios en el formato de Bitacora
   */
  function leerRegistro(root) {
    var salida = [];
    if (!root) return salida;

    var bloques = U.$$('[data-registro-ej]', root);
    for (var i = 0; i < bloques.length; i++) {
      var bloque = bloques[i];
      var series = [];
      var filas = U.$$('[data-serie]', bloque);

      for (var j = 0; j < filas.length; j++) {
        var reps = U.$('[data-reps]', filas[j]);
        var peso = U.$('[data-peso]', filas[j]);
        var hecho = U.$('[data-hecho]', filas[j]);
        series.push({
          reps: reps && reps.value !== '' ? U.aNumero(reps.value) : 0,
          peso: peso && peso.value !== '' ? U.aNumero(peso.value) : 0,
          hecho: !!(hecho && hecho.checked)
        });
      }

      salida.push({
        ejercicioId: bloque.getAttribute('data-ejercicio-id') || '',
        series: series
      });
    }
    return salida;
  }

  /* =========================================================
     7. Detalle de ejercicio (con respaldo propio)
     ========================================================= */

  function engancharDetalleGlobal() {
    if (detalleEnganchado || !document || !document.addEventListener) return;
    detalleEnganchado = true;
    document.addEventListener('click', function (e) {
      var btn = (e.target && e.target.closest) ? e.target.closest('[data-ag-ej-detalle]') : null;
      if (!btn) return;
      e.preventDefault();
      verDetalleEjercicio(btn.getAttribute('data-ag-ej-detalle'));
    });
  }

  /** Abre la ficha técnica del ejercicio (usa AG.Mod.Ejercicios si existe). */
  function verDetalleEjercicio(id) {
    if (AG.Mod.Ejercicios && typeof AG.Mod.Ejercicios.detalle === 'function') {
      try { AG.Mod.Ejercicios.detalle(id); return; } catch (e) { /* se usa el respaldo */ }
    }

    var ej = ejercicioDe(id);
    if (!ej) { U.toast('No encontramos ese ejercicio en el catálogo', 'warn'); return; }

    var g = grupoDe(ej.grupo);
    var cuerpo = '<div class="stack-sm">' +
      '<div class="row-sm wrap">' +
        '<span class="chip chip-sm" style="cursor:default"><i class="rt-punto" style="background:' + esc(g.color) + '"></i>' + esc(g.nombre) + '</span>' +
        (AG.Data && typeof AG.Data.nombreEquipo === 'function'
          ? '<span class="pill">' + esc(AG.Data.nombreEquipo(ej.equipo)) + '</span>' : '') +
        '<span class="pill">' + esc(nombreNivel(ej.nivel)) + '</span>' +
      '</div>' +
      (ej.musculos ? '<p class="mini muted">' + esc(ej.musculos) + '</p>' : '') +
      (ej.instrucciones ? '<div><span class="label">Cómo se hace</span><p>' + esc(ej.instrucciones) + '</p></div>' : '') +
      (ej.consejos ? '<div class="aviso aviso-warn">' + icono('alerta', 18) + '<div>' + esc(ej.consejos) + '</div></div>' : '') +
    '</div>';

    U.modal({
      titulo: ej.nombre,
      ancho: 'md',
      cuerpo: cuerpo,
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }]
    });
  }

  /* =========================================================
     8. Selector de ejercicios (usa AG.Mod.Ejercicios o el propio)
     ========================================================= */

  /** Normaliza lo que devuelva el selector externo a un arreglo de ids. */
  function normalizarIds(resultado) {
    var salida = [];
    function agregar(v) {
      if (!v) return;
      if (typeof v === 'string') { salida.push(v); return; }
      if (typeof v === 'object' && v.id) salida.push(String(v.id));
    }
    if (esArreglo(resultado)) {
      for (var i = 0; i < resultado.length; i++) agregar(resultado[i]);
    } else {
      agregar(resultado);
    }
    return salida;
  }

  /** Abre el selector múltiple y devuelve los ids elegidos al callback. */
  function abrirSelectorEjercicios(alElegir) {
    if (AG.Mod.Ejercicios && typeof AG.Mod.Ejercicios.selector === 'function') {
      try {
        AG.Mod.Ejercicios.selector(function (resultado) {
          var ids = normalizarIds(resultado);
          if (ids.length) alElegir(ids);
        }, { multiple: true, titulo: 'Agregar ejercicios' });
        return;
      } catch (e) { /* si falla, se usa el selector propio */ }
    }
    selectorPropio(alElegir);
  }

  /** Selector de ejercicios propio: buscador, filtro por grupo y selección múltiple. */
  function selectorPropio(alElegir) {
    estilos();
    var seleccion = {};
    var estado = { q: '', grupo: 'todos' };

    function contar() {
      var n = 0, k;
      for (k in seleccion) { if (Object.prototype.hasOwnProperty.call(seleccion, k)) n++; }
      return n;
    }

    function filtrados() {
      if (!AG.Data || typeof AG.Data.ejerciciosPor !== 'function') return [];
      return AG.Data.ejerciciosPor({ grupo: estado.grupo, texto: estado.q });
    }

    function htmlLista() {
      var items = filtrados();
      if (!items.length) {
        return vacio('buscar', 'Sin resultados', 'Prueba con otro nombre o cambia el grupo muscular.');
      }
      var html = '<div class="list">';
      var tope = Math.min(items.length, 120);
      for (var i = 0; i < tope; i++) {
        var ej = items[i];
        var g = grupoDe(ej.grupo);
        html += '<label class="list-item clickable' + (seleccion[ej.id] ? ' rt-sel' : '') + '">' +
          '<input type="checkbox" class="check" data-ej="' + esc(ej.id) + '"' + (seleccion[ej.id] ? ' checked' : '') + ' ' +
            'style="width:18px;height:18px;flex:0 0 auto">' +
          '<div class="list-item-main">' +
            '<div class="bold truncar">' + esc(ej.nombre) + '</div>' +
            '<div class="mini muted"><i class="rt-punto" style="background:' + esc(g.color) + ';margin-right:5px"></i>' +
              esc(g.nombre) + ' · ' + esc(nombreNivel(ej.nivel)) + '</div>' +
          '</div>' +
        '</label>';
      }
      html += '</div>';
      if (items.length > tope) {
        html += '<p class="mini muted mt-sm">Se muestran los primeros ' + tope + ' de ' + items.length + '. Afina la búsqueda.</p>';
      }
      return html;
    }

    var chips = '<button type="button" class="chip chip-sm on" data-grupo="todos">Todos</button>';
    var catalogo = gruposCatalogo();
    for (var c = 0; c < catalogo.length; c++) {
      chips += '<button type="button" class="chip chip-sm" data-grupo="' + esc(catalogo[c].id) + '">' +
        '<i class="rt-punto" style="background:' + esc(catalogo[c].color) + '"></i>' + esc(catalogo[c].nombre) + '</button>';
    }

    var cuerpo = '<div class="stack-sm">' +
      '<div class="field"><span class="label">Buscar ejercicio</span>' +
        '<div class="input-icono">' + icono('buscar', 17) +
          '<input class="input" type="search" data-buscar placeholder="Sentadilla, press, remo…" autocomplete="off">' +
        '</div>' +
      '</div>' +
      '<div class="chips" data-chips>' + chips + '</div>' +
      '<div data-lista>' + htmlLista() + '</div>' +
    '</div>';

    U.modal({
      titulo: 'Agregar ejercicios',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: 'Agregar seleccionados',
          clase: 'btn-primary',
          onClick: function (api) {
            var ids = [], k;
            for (k in seleccion) { if (Object.prototype.hasOwnProperty.call(seleccion, k)) ids.push(k); }
            if (!ids.length) { U.toast('Selecciona al menos un ejercicio', 'warn'); return; }
            api.cerrar();
            alElegir(ids);
          }
        }
      ],
      onOpen: function (root) {
        var caja = U.$('[data-lista]', root);

        function repintar() {
          if (caja) caja.innerHTML = htmlLista();
        }

        var buscar = U.$('[data-buscar]', root);
        if (buscar) {
          buscar.addEventListener('input', U.debounce(function () {
            estado.q = buscar.value || '';
            repintar();
          }, 220));
        }

        U.delegar(root, 'click', '[data-grupo]', function (e, el) {
          estado.grupo = el.getAttribute('data-grupo') || 'todos';
          var todos = U.$$('[data-grupo]', root);
          for (var i = 0; i < todos.length; i++) {
            todos[i].classList.toggle('on', todos[i] === el);
          }
          repintar();
        });

        U.delegar(root, 'change', '[data-ej]', function (e, el) {
          var id = el.getAttribute('data-ej');
          if (el.checked) seleccion[id] = true;
          else delete seleccion[id];
          var fila = el.closest ? el.closest('.list-item') : null;
          if (fila) fila.classList.toggle('rt-sel', !!el.checked);
          var btn = U.$('.modal-foot .btn-primary', root);
          if (btn) btn.textContent = contar() ? 'Agregar ' + contar() + ' ejercicio' + (contar() === 1 ? '' : 's') : 'Agregar seleccionados';
        });
      }
    });
  }

  /* =========================================================
     9. Pantalla de listado (Plantillas · Asignaciones)
     ========================================================= */

  function rutinasTodas() {
    if (!AG.DB) return [];
    return AG.DB.get('rutinas').slice();
  }

  /** Aplica los filtros de la pestaña Plantillas. */
  function rutinasFiltradas() {
    var todas = rutinasTodas();
    var q = U.normalizar(filtros.q);
    var salida = [], i, r;

    for (i = 0; i < todas.length; i++) {
      r = todas[i];
      if (!r) continue;
      if (filtros.objetivo !== 'todos' && r.objetivo !== filtros.objetivo) continue;
      if (filtros.nivel !== 'todos' && r.nivel !== filtros.nivel) continue;
      if (filtros.dias !== 'todos' && String(entero(r.diasPorSemana, 0)) !== String(filtros.dias)) continue;

      if (q) {
        var base = U.normalizar(
          texto(r.nombre) + ' ' + texto(r.descripcion) + ' ' +
          nombreObjetivo(r.objetivo) + ' ' + nombreNivel(r.nivel)
        );
        if (base.indexOf(q) < 0) continue;
      }
      salida.push(r);
    }

    return U.ordenar(salida, 'nombre', 'asc');
  }

  /** Días por semana presentes en la base, para llenar el filtro. */
  function diasDisponibles() {
    var todas = rutinasTodas();
    var vistos = [], i, d;
    for (i = 0; i < todas.length; i++) {
      d = entero(todas[i] && todas[i].diasPorSemana, 0);
      if (d > 0 && vistos.indexOf(d) < 0) vistos.push(d);
    }
    vistos.sort(function (a, b) { return a - b; });
    return vistos.map(function (n) {
      return { id: String(n), nombre: n + (n === 1 ? ' día' : ' días') + ' por semana' };
    });
  }

  /** Asignaciones activas de esta rutina (bloquean el borrado). */
  function asignacionesActivasDe(rutinaId) {
    if (!AG.DB) return [];
    return AG.DB.donde('asignaciones', function (a) {
      return a && a.rutinaId === rutinaId && a.activa !== false;
    });
  }

  /** Tarjeta de una plantilla. */
  function htmlTarjetaRutina(rutina, usuario) {
    var st = estadisticas(rutina);
    var editable = puedeEditarRutina(usuario, rutina);
    var activas = asignacionesActivasDe(rutina.id).length;

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<h3 class="card-title">' + esc(rutina.nombre || 'Rutina sin nombre') + '</h3>' +
          '<p class="card-sub">' + esc(nombreObjetivo(rutina.objetivo)) + ' · ' + esc(nombreNivel(rutina.nivel)) + '</p>' +
        '</div>' +
        '<div class="card-accion">' +
          (activas ? '<span class="badge badge-ok" title="Socios entrenando con esta rutina">' + activas + ' activa' + (activas === 1 ? '' : 's') + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card-body stack-sm">' +
        '<div class="row-sm wrap">' +
          '<span class="pill">' + icono('calendario', 13) + '<b>' + entero(rutina.diasPorSemana, st.dias) + '</b> días/semana</span>' +
          '<span class="pill">' + icono('mancuerna', 13) + '<b>' + st.ejercicios + '</b> ejercicios</span>' +
          '<span class="pill">' + icono('pesa', 13) + '<b>' + st.series + '</b> series</span>' +
        '</div>' +
        chipsGrupos(st.grupos, 5) +
        (texto(rutina.descripcion).trim()
          ? '<p class="mini muted">' + esc(U.truncar(rutina.descripcion, 140)) + '</p>' : '') +
        '<p class="mini muted">' + icono('coach', 12) + ' ' + esc(nombreUsuario(rutina.creadaPor, 'Autor desconocido')) +
          ' · ' + esc(U.fecha(rutina.creada, 'corto') || 'sin fecha') + '</p>' +
      '</div>' +
      '<div class="card-foot">' +
        '<div class="row-sm wrap">' +
          '<button type="button" class="btn btn-sm btn-ghost" data-ver="' + esc(rutina.id) + '">' + icono('ojo', 15) + ' Ver</button>' +
          (editable
            ? '<button type="button" class="btn btn-sm btn-ghost" data-editar="' + esc(rutina.id) + '">' + icono('editar', 15) + ' Editar</button>'
            : '') +
          '<button type="button" class="btn btn-sm btn-ghost" data-duplicar="' + esc(rutina.id) + '">' + icono('mas', 15) + ' Duplicar</button>' +
        '</div>' +
        '<div class="row-sm wrap">' +
          '<button type="button" class="btn btn-sm btn-outline" data-asignar="' + esc(rutina.id) + '">' + icono('socios', 15) + ' Asignar</button>' +
          (editable
            ? '<button type="button" class="btn-icono peligro" data-eliminar="' + esc(rutina.id) + '" title="Eliminar rutina" aria-label="Eliminar rutina">' + icono('basura', 17) + '</button>'
            : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /** Contenido de la pestaña Plantillas. */
  function htmlPlantillas(usuario) {
    var opcionesDias = diasDisponibles();

    var barra = '<div class="card card-plano"><div class="card-body">' +
      '<div class="form-row">' +
        '<div class="field flex1" style="flex:2 1 240px">' +
          '<span class="label">Buscar</span>' +
          '<div class="input-icono">' + icono('buscar', 17) +
            '<input class="input" type="search" data-buscar placeholder="Nombre de la rutina…" value="' + esc(filtros.q) + '" autocomplete="off">' +
          '</div>' +
        '</div>' +
        '<div class="field"><span class="label">Objetivo</span>' +
          '<select class="select" data-filtro="objetivo">' + opciones(OBJETIVOS, filtros.objetivo, 'Todos los objetivos') + '</select></div>' +
        '<div class="field"><span class="label">Nivel</span>' +
          '<select class="select" data-filtro="nivel">' + opciones(NIVELES, filtros.nivel, 'Todos los niveles') + '</select></div>' +
        '<div class="field"><span class="label">Días</span>' +
          '<select class="select" data-filtro="dias">' + opciones(opcionesDias, filtros.dias, 'Cualquier frecuencia') + '</select></div>' +
        '<button type="button" class="btn btn-ghost" data-limpiar>' + icono('x', 16) + ' Limpiar</button>' +
      '</div>' +
    '</div></div>';

    return barra + '<div data-resultados>' + htmlResultadosPlantillas(usuario) + '</div>';
  }

  function htmlResultadosPlantillas(usuario) {
    var encontradas = rutinasFiltradas();

    if (!rutinasTodas().length) {
      return '<div class="card"><div class="card-body">' +
        vacio('mancuerna', 'Todavía no hay rutinas',
          'Crea la primera plantilla y podrás asignarla a tus socios en segundos.',
          '<button type="button" class="btn btn-primary" data-nueva>' + icono('mas', 16) + ' Nueva rutina</button>') +
        '</div></div>';
    }

    if (!encontradas.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('buscar', 'Sin rutinas con esos filtros',
          'Cambia el objetivo, el nivel o la frecuencia para ver más resultados.',
          '<button type="button" class="btn btn-outline" data-limpiar>Limpiar filtros</button>') +
        '</div></div>';
    }

    var html = '<p class="mini muted">' + encontradas.length +
      (encontradas.length === 1 ? ' rutina encontrada' : ' rutinas encontradas') + '</p>' +
      '<div class="grid g3">';
    for (var i = 0; i < encontradas.length; i++) {
      html += htmlTarjetaRutina(encontradas[i], usuario);
    }
    return html + '</div>';
  }

  /** Filas de la pestaña Asignaciones, ya con permisos aplicados. */
  function filasAsignaciones(usuario) {
    if (!AG.DB) return [];

    var todas = AG.DB.get('asignaciones');
    var q = U.normalizar(filtros.qAsig);
    var hoy = U.hoy();
    var filas = [], i;

    for (i = 0; i < todas.length; i++) {
      var a = todas[i];
      if (!a || !a.socioId) continue;
      if (!filtros.verFinalizadas && a.activa === false) continue;
      if (!puedeVerSocio(usuario, a.socioId)) continue;

      var socio = AG.DB.usuario(a.socioId);
      if (!socio) continue;

      var rutina = AG.DB.buscar('rutinas', a.rutinaId);
      var nombreRutina = rutina ? texto(rutina.nombre) : 'Rutina eliminada';
      var nombreSocio = U.nombreCompleto(socio);
      var nombreCoach = nombreUsuario(a.coachId || socio.coachId, 'Sin coach');

      if (q) {
        var base = U.normalizar(nombreSocio + ' ' + nombreRutina + ' ' + nombreCoach);
        if (base.indexOf(q) < 0) continue;
      }

      var bitacoras = AG.DB.bitacorasDe(socio.id);
      var hasta = (a.activa === false && a.fechaFin) ? a.fechaFin : hoy;
      var adh = AG.Calc.adherencia(bitacoras, a.fechaInicio, hasta,
        rutina ? rutina.diasPorSemana : 3);

      var ultima = null;
      for (var b = 0; b < bitacoras.length; b++) {
        if (bitacoras[b] && bitacoras[b].fecha) { ultima = bitacoras[b].fecha; break; }
      }

      filas.push({
        asignacion: a,
        socio: socio,
        nombreSocio: nombreSocio,
        rutina: rutina,
        nombreRutina: nombreRutina,
        nombreCoach: nombreCoach,
        adherencia: adh,
        ultima: ultima
      });
    }

    return U.ordenar(filas, 'nombreSocio', 'asc');
  }

  /** Contenido de la pestaña Asignaciones. */
  function htmlAsignaciones(usuario) {
    var barra = '<div class="card card-plano"><div class="card-body">' +
      '<div class="form-row">' +
        '<div class="field flex1" style="flex:2 1 240px">' +
          '<span class="label">Buscar</span>' +
          '<div class="input-icono">' + icono('buscar', 17) +
            '<input class="input" type="search" data-buscar-asig placeholder="Socio, rutina o coach…" value="' + esc(filtros.qAsig) + '" autocomplete="off">' +
          '</div>' +
        '</div>' +
        '<button type="button" class="chip' + (filtros.verFinalizadas ? ' on' : '') + '" data-finalizadas>' +
          icono('historial', 14) + ' Incluir finalizadas</button>' +
      '</div>' +
    '</div></div>';

    return barra + '<div data-resultados>' + htmlTablaAsignaciones(usuario) + '</div>';
  }

  function htmlTablaAsignaciones(usuario) {
    var filas = filasAsignaciones(usuario);

    if (!filas.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('socios', 'Sin asignaciones que mostrar',
          filtros.qAsig
            ? 'Ningún socio, rutina o coach coincide con esa búsqueda.'
            : 'Cuando asignes una rutina a un socio aparecerá aquí con su adherencia.') +
        '</div></div>';
    }

    var html = '<div class="card"><div class="table-wrap"><table class="table">' +
      '<thead><tr>' +
        '<th>Socio</th><th>Rutina</th><th>Coach</th>' +
        '<th class="nowrap">Desde</th><th class="nowrap">Hasta</th>' +
        '<th>Adherencia</th><th class="nowrap">Última sesión</th><th></th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var a = f.asignacion;
      var pct = f.adherencia.pct;
      var claseBarra = pct >= 80 ? 'ok' : (pct >= 50 ? 'warn' : 'error');
      var finalizada = a.activa === false;

      html += '<tr>' +
        '<td><div class="row-sm">' + U.avatar(f.socio, 'sm') +
          '<div style="min-width:0"><div class="bold truncar">' + esc(f.nombreSocio) + '</div>' +
          '<div class="mini muted">' + esc(f.socio.codigo || '') + '</div></div></div></td>' +
        '<td><div class="bold truncar">' + esc(f.nombreRutina) + '</div>' +
          '<div class="mini muted">' + (f.rutina ? esc(nombreNivel(f.rutina.nivel)) + ' · ' + entero(f.rutina.diasPorSemana, 0) + ' días' : 'Sin datos') + '</div></td>' +
        '<td class="truncar">' + esc(f.nombreCoach) + '</td>' +
        '<td class="nowrap mini">' + esc(U.fecha(a.fechaInicio, 'corto') || '—') + '</td>' +
        '<td class="nowrap mini">' + esc(U.fecha(a.fechaFin, 'corto') || '—') +
          (finalizada ? ' ' + U.badge('Finalizada', 'muted') : '') + '</td>' +
        '<td>' +
          '<div class="row-sm" style="min-width:132px" title="' + f.adherencia.hechas + ' de ' + f.adherencia.esperadas + ' sesiones esperadas">' +
            '<div class="bar bar-fina flex1"><div class="bar-fill ' + claseBarra + '" style="width:' + pct + '%"></div></div>' +
            '<b class="mini nowrap">' + pct + '%</b>' +
          '</div>' +
        '</td>' +
        '<td class="nowrap mini">' + (f.ultima
          ? '<span title="' + esc(U.fecha(f.ultima, 'corto')) + '">' + esc(U.fechaRelativa(f.ultima)) + '</span>'
          : '<span class="muted">Sin sesiones</span>') + '</td>' +
        '<td class="nowrap">' +
          '<div class="row-sm">' +
            '<button type="button" class="btn btn-sm btn-ghost" data-cambiar="' + esc(a.socioId) + '">' + icono('editar', 14) + ' Cambiar</button>' +
            (finalizada ? '' :
              '<button type="button" class="btn btn-sm btn-ghost" data-finalizar="' + esc(a.id) + '">' + icono('check', 14) + ' Finalizar</button>') +
          '</div>' +
        '</td>' +
      '</tr>';
    }

    return html + '</tbody></table></div></div>';
  }

  /** Cuerpo completo según la pestaña activa. */
  function htmlCuerpo(usuario) {
    return filtros.tab === 'asignaciones' ? htmlAsignaciones(usuario) : htmlPlantillas(usuario);
  }

  /** Render de la ruta de listado. */
  function render(ctx) {
    estilos();
    engancharDetalleGlobal();

    var usuario = ctx.usuario;
    var totalRutinas = rutinasTodas().length;

    var html = '<div class="page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('mancuerna', 26) + ' Rutinas</h1>' +
          '<p class="page-sub">' +
            (usuario.rol === 'coach'
              ? 'Biblioteca de plantillas y las rutinas que siguen tus socios.'
              : 'Biblioteca de plantillas y todas las rutinas asignadas del gimnasio.') +
          '</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-primary" data-nueva>' + icono('mas', 17) + ' Nueva rutina</button>' +
        '</div>' +
      '</div>' +

      '<div class="tabs" data-tabs>' +
        '<button type="button" class="tab' + (filtros.tab === 'plantillas' ? ' active' : '') + '" data-tab="plantillas">' +
          icono('mancuerna', 16) + ' Plantillas <span class="badge badge-muted">' + totalRutinas + '</span></button>' +
        '<button type="button" class="tab' + (filtros.tab === 'asignaciones' ? ' active' : '') + '" data-tab="asignaciones">' +
          icono('socios', 16) + ' Asignaciones</button>' +
      '</div>' +

      '<div data-cuerpo>' + htmlCuerpo(usuario) + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { engancharLista(root, usuario); }
    };
  }

  /** Eventos de la pantalla de listado (todo por delegación). */
  function engancharLista(root, usuario) {
    var base = baseDe(usuario);

    function repintarCuerpo() {
      var caja = U.$('[data-cuerpo]', root);
      if (caja) caja.innerHTML = htmlCuerpo(usuario);
    }

    function repintarResultados() {
      var caja = U.$('[data-resultados]', root);
      if (!caja) { repintarCuerpo(); return; }
      caja.innerHTML = filtros.tab === 'asignaciones'
        ? htmlTablaAsignaciones(usuario)
        : htmlResultadosPlantillas(usuario);
    }

    /* --- Pestañas --- */
    U.delegar(root, 'click', '[data-tab]', function (e, el) {
      var destino = el.getAttribute('data-tab');
      if (destino === filtros.tab) return;
      filtros.tab = destino;
      var tabs = U.$$('[data-tab]', root);
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i] === el);
      }
      repintarCuerpo();
    });

    /* --- Nueva rutina --- */
    U.delegar(root, 'click', '[data-nueva]', function () {
      editorEstado = null;
      AG.Router.ir(base + '/rutina');
    });

    /* --- Filtros de plantillas --- */
    U.delegar(root, 'input', '[data-buscar]', U.debounce(function (e, el) {
      filtros.q = el.value || '';
      repintarResultados();
    }, 220));

    U.delegar(root, 'change', '[data-filtro]', function (e, el) {
      filtros[el.getAttribute('data-filtro')] = el.value;
      repintarResultados();
    });

    U.delegar(root, 'click', '[data-limpiar]', function () {
      filtros.q = '';
      filtros.objetivo = 'todos';
      filtros.nivel = 'todos';
      filtros.dias = 'todos';
      repintarCuerpo();
    });

    /* --- Filtros de asignaciones --- */
    U.delegar(root, 'input', '[data-buscar-asig]', U.debounce(function (e, el) {
      filtros.qAsig = el.value || '';
      repintarResultados();
    }, 220));

    U.delegar(root, 'click', '[data-finalizadas]', function (e, el) {
      filtros.verFinalizadas = !filtros.verFinalizadas;
      el.classList.toggle('on', filtros.verFinalizadas);
      repintarResultados();
    });

    /* --- Acciones sobre plantillas --- */
    U.delegar(root, 'click', '[data-ver]', function (e, el) {
      verRutina(el.getAttribute('data-ver'), usuario);
    });

    U.delegar(root, 'click', '[data-editar]', function (e, el) {
      abrirEditor(el.getAttribute('data-editar'));
    });

    U.delegar(root, 'click', '[data-duplicar]', function (e, el) {
      duplicarRutina(el.getAttribute('data-duplicar'), usuario);
    });

    U.delegar(root, 'click', '[data-asignar]', function (e, el) {
      elegirSocioYAsignar(usuario, el.getAttribute('data-asignar'));
    });

    U.delegar(root, 'click', '[data-eliminar]', function (e, el) {
      eliminarRutina(el.getAttribute('data-eliminar'), usuario);
    });

    /* --- Acciones sobre asignaciones --- */
    U.delegar(root, 'click', '[data-cambiar]', function (e, el) {
      asignar(el.getAttribute('data-cambiar'));
    });

    U.delegar(root, 'click', '[data-finalizar]', function (e, el) {
      finalizarAsignacion(el.getAttribute('data-finalizar'), usuario);
    });
  }

  /* =========================================================
     10. Acciones sobre plantillas
     ========================================================= */

  /** Modal de solo lectura con la rutina completa, día por día. */
  function verRutina(rutinaId, usuario) {
    var rutina = AG.DB.buscar('rutinas', rutinaId);
    if (!rutina) { U.toast('Esa rutina ya no existe', 'error'); return; }

    var dias = lista(rutina.dias);
    var chips = '';
    for (var i = 0; i < dias.length; i++) {
      chips += '<button type="button" class="chip chip-sm' + (i === 0 ? ' on' : '') + '" data-ver-dia="' + i + '">' +
        esc(dias[i] && dias[i].nombre ? dias[i].nombre : 'Día ' + (i + 1)) + '</button>';
    }

    var cuerpo = '<div class="stack">' +
      resumen(rutina) +
      (texto(rutina.descripcion).trim() ? '<p class="muted">' + esc(rutina.descripcion) + '</p>' : '') +
      (dias.length ? '<div class="chips" data-chips-dias>' + chips + '</div>' : '') +
      '<div data-dia-cont>' + vistaDia(rutina, 0, {}) + '</div>' +
    '</div>';

    var acciones = [{ texto: 'Cerrar', clase: 'btn-ghost' }];
    if (puedeEditarRutina(usuario, rutina)) {
      acciones.push({
        texto: 'Editar rutina',
        clase: 'btn-primary',
        onClick: function (api) { api.cerrar(); abrirEditor(rutina.id); }
      });
    }

    U.modal({
      titulo: rutina.nombre || 'Rutina',
      ancho: 'xl',
      cuerpo: cuerpo,
      acciones: acciones,
      onOpen: function (root) {
        U.delegar(root, 'click', '[data-ver-dia]', function (e, el) {
          var idx = entero(el.getAttribute('data-ver-dia'), 0);
          var chipsTodos = U.$$('[data-ver-dia]', root);
          for (var k = 0; k < chipsTodos.length; k++) {
            chipsTodos[k].classList.toggle('on', chipsTodos[k] === el);
          }
          var cont = U.$('[data-dia-cont]', root);
          if (cont) cont.innerHTML = vistaDia(rutina, idx, {});
        });
      }
    });
  }

  /** Copia una rutina completa para poder ajustarla sin tocar la original. */
  function duplicarRutina(rutinaId, usuario) {
    var rutina = AG.DB.buscar('rutinas', rutinaId);
    if (!rutina) { U.toast('Esa rutina ya no existe', 'error'); return; }

    var copia;
    try { copia = JSON.parse(JSON.stringify(rutina)); }
    catch (e) { U.toast('No se pudo duplicar la rutina', 'error'); return; }

    delete copia.id;
    copia.nombre = U.truncar(texto(rutina.nombre) + ' (copia)', 70);
    copia.creadaPor = usuario.id;
    copia.creada = U.hoy();
    copia.esPlantilla = true;

    var nueva = AG.DB.insertar('rutinas', copia);
    if (!nueva) { U.toast('No se pudo duplicar la rutina', 'error'); return; }

    U.toast('Rutina duplicada: «' + copia.nombre + '»', 'ok');
    AG.Router.refrescar();
  }

  /** Elimina una plantilla; bloquea si hay socios entrenándola. */
  function eliminarRutina(rutinaId, usuario) {
    var rutina = AG.DB.buscar('rutinas', rutinaId);
    if (!rutina) { U.toast('Esa rutina ya no existe', 'error'); return; }

    if (!puedeEditarRutina(usuario, rutina)) {
      U.toast('Solo puedes eliminar las rutinas que tú creaste', 'error');
      return;
    }

    var activas = asignacionesActivasDe(rutina.id);
    if (activas.length) {
      var nombres = [], i;
      for (i = 0; i < activas.length && i < 6; i++) {
        var s = AG.DB.usuario(activas[i].socioId);
        nombres.push('<li>' + esc(s ? U.nombreCompleto(s) : 'Socio dado de baja') + '</li>');
      }
      U.modal({
        titulo: 'No se puede eliminar',
        ancho: 'md',
        cuerpo: '<div class="stack-sm">' +
          '<div class="aviso aviso-warn">' + icono('alerta', 18) +
            '<div>«' + esc(rutina.nombre) + '» está asignada y activa con <b>' + activas.length +
            '</b> socio' + (activas.length === 1 ? '' : 's') + '. Cambia o finaliza esas asignaciones antes de eliminarla.</div>' +
          '</div>' +
          '<ul class="mini muted" style="padding-left:18px;margin:0">' + nombres.join('') +
          (activas.length > 6 ? '<li>y ' + (activas.length - 6) + ' más…</li>' : '') + '</ul>' +
        '</div>',
        acciones: [
          { texto: 'Entendido', clase: 'btn-ghost' },
          {
            texto: 'Ver asignaciones',
            clase: 'btn-primary',
            onClick: function (api) {
              api.cerrar();
              filtros.tab = 'asignaciones';
              filtros.qAsig = texto(rutina.nombre);
              AG.Router.refrescar();
            }
          }
        ]
      });
      return;
    }

    var historicas = AG.DB.donde('asignaciones', function (a) { return a && a.rutinaId === rutina.id; }).length;
    var detalle = historicas
      ? 'Hay ' + historicas + ' asignación' + (historicas === 1 ? ' finalizada' : 'es finalizadas') + ' en el historial que quedarán sin rutina de referencia.'
      : '';

    U.confirmar('¿Eliminar la rutina «' + texto(rutina.nombre) + '»? Esta acción no se puede deshacer.',
      'Eliminar rutina', { peligro: true, textoOk: 'Sí, eliminar', detalle: detalle })
      .then(function (ok) {
        if (!ok) return;
        if (AG.DB.eliminar('rutinas', rutina.id)) {
          U.toast('Rutina eliminada', 'ok');
          AG.Router.refrescar();
        } else {
          U.toast('No se pudo eliminar la rutina', 'error');
        }
      });
  }

  /** Finaliza una asignación activa. */
  function finalizarAsignacion(asignacionId, usuario) {
    var a = AG.DB.buscar('asignaciones', asignacionId);
    if (!a) { U.toast('Esa asignación ya no existe', 'error'); return; }
    if (!puedeVerSocio(usuario, a.socioId)) {
      U.toast('Solo puedes gestionar las rutinas de tus socios', 'error');
      return;
    }

    var socio = AG.DB.usuario(a.socioId);
    var nombre = socio ? U.nombreCompleto(socio) : 'este socio';

    U.confirmar('¿Finalizar la rutina de ' + nombre + '? Dejará de verla como rutina vigente.',
      'Finalizar asignación', { textoOk: 'Sí, finalizar' })
      .then(function (ok) {
        if (!ok) return;
        var hoy = U.hoy();
        AG.DB.actualizar('asignaciones', a.id, {
          activa: false,
          fechaFin: (!a.fechaFin || a.fechaFin > hoy) ? hoy : a.fechaFin
        });
        U.toast('Asignación finalizada', 'ok');
        AG.Router.refrescar();
      });
  }

  /* =========================================================
     11. Asignación de rutinas
     ========================================================= */

  /** Paso previo: elegir a qué socio se le asigna una plantilla concreta. */
  function elegirSocioYAsignar(usuario, rutinaId) {
    var candidatos = sociosDe(usuario).filter(function (s) { return s && s.estado !== 'baja'; });
    candidatos = U.ordenar(candidatos, function (s) { return U.nombreCompleto(s); }, 'asc');

    if (!candidatos.length) {
      U.modal({
        titulo: 'Sin socios disponibles',
        ancho: 'md',
        cuerpo: vacio('socios', 'No hay socios a quién asignar',
          usuario.rol === 'coach'
            ? 'Todavía no tienes socios activos asignados. Pide a dirección que te asigne socios.'
            : 'Da de alta socios activos para poder asignarles una rutina.'),
        acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }]
      });
      return;
    }

    function htmlSocios(q) {
      var filtro = U.normalizar(q || '');
      var html = '<div class="list">';
      var mostrados = 0;

      for (var i = 0; i < candidatos.length; i++) {
        var s = candidatos[i];
        var nombre = U.nombreCompleto(s);
        if (filtro && U.normalizar(nombre + ' ' + texto(s.codigo)).indexOf(filtro) < 0) continue;
        mostrados++;
        var est = AG.Calc.estadoMembresia(s);
        html += '<button type="button" class="list-item clickable" data-socio="' + esc(s.id) + '">' +
          U.avatar(s, 'sm') +
          '<div class="list-item-main">' +
            '<div class="bold truncar">' + esc(nombre) + '</div>' +
            '<div class="mini muted">' + esc(texto(s.codigo)) + ' · ' + esc(nombreObjetivo(s.objetivo)) + ' · ' + esc(nombreNivel(s.nivel)) + '</div>' +
          '</div>' +
          '<div class="list-item-side"><span class="badge ' + esc(est.clase) + '">' + esc(est.estado) + '</span></div>' +
        '</button>';
      }
      html += '</div>';
      if (!mostrados) return vacio('buscar', 'Sin coincidencias', 'Ningún socio coincide con esa búsqueda.');
      return html;
    }

    U.modal({
      titulo: 'Asignar a un socio',
      ancho: 'md',
      cuerpo: '<div class="stack-sm">' +
        '<div class="field"><span class="label">Buscar socio</span>' +
          '<div class="input-icono">' + icono('buscar', 17) +
            '<input class="input" type="search" data-buscar-socio placeholder="Nombre o código" autocomplete="off">' +
          '</div></div>' +
        '<div data-lista-socios>' + htmlSocios('') + '</div>' +
      '</div>',
      acciones: [{ texto: 'Cancelar', clase: 'btn-ghost' }],
      onOpen: function (root, api) {
        var caja = U.$('[data-lista-socios]', root);
        var buscar = U.$('[data-buscar-socio]', root);

        if (buscar) {
          buscar.addEventListener('input', U.debounce(function () {
            if (caja) caja.innerHTML = htmlSocios(buscar.value);
          }, 200));
        }

        U.delegar(root, 'click', '[data-socio]', function (e, el) {
          var socioId = el.getAttribute('data-socio');
          api.cerrar();
          asignar(socioId, rutinaId);
        });
      }
    });
  }

  /** Puntaje de recomendación de una rutina para un socio. */
  function puntajeRecomendacion(rutina, socio) {
    var p = 0;
    if (rutina.objetivo && socio.objetivo && rutina.objetivo === socio.objetivo) p += 2;
    if (rutina.nivel && socio.nivel && rutina.nivel === socio.nivel) p += 1;
    return p;
  }

  /**
   * Modal de asignación de rutina a un socio.
   * @param {String} socioId
   * @param {String} [rutinaPreseleccionada]
   */
  function asignar(socioId, rutinaPreseleccionada) {
    estilos();

    var usuario = usuarioEnSesion();
    if (!usuario) { U.toast('Tu sesión terminó, vuelve a entrar', 'error'); return; }

    var socio = AG.DB.usuario(socioId);
    if (!socio || socio.rol !== 'socio') { U.toast('No encontramos a ese socio', 'error'); return; }

    if (!puedeVerSocio(usuario, socioId)) {
      U.toast('Solo puedes asignar rutinas a tus socios', 'error');
      return;
    }

    var todas = rutinasTodas();
    if (!todas.length) {
      var base = baseDe(usuario);
      U.modal({
        titulo: 'Sin rutinas en la biblioteca',
        ancho: 'md',
        cuerpo: vacio('mancuerna', 'Todavía no hay rutinas', 'Crea una plantilla para poder asignarla a tus socios.'),
        acciones: [
          { texto: 'Cerrar', clase: 'btn-ghost' },
          {
            texto: 'Crear rutina',
            clase: 'btn-primary',
            onClick: function (api) { api.cerrar(); editorEstado = null; AG.Router.ir(base + '/rutina'); }
          }
        ]
      });
      return;
    }

    /* Ordena: primero las recomendadas, después por nombre */
    var ordenadas = todas.slice().sort(function (a, b) {
      var pa = puntajeRecomendacion(a, socio), pb = puntajeRecomendacion(b, socio);
      if (pa !== pb) return pb - pa;
      return U.normalizar(a.nombre) < U.normalizar(b.nombre) ? -1 : 1;
    });

    var vigente = AG.DB.rutinaActivaDe(socioId);
    var estado = {
      rutinaId: rutinaPreseleccionada || (ordenadas[0] ? ordenadas[0].id : ''),
      q: '',
      inicio: U.hoy(),
      semanas: 12
    };

    function htmlListaRutinas() {
      var q = U.normalizar(estado.q);
      var html = '<div class="list">';
      var mostradas = 0;

      for (var i = 0; i < ordenadas.length; i++) {
        var r = ordenadas[i];
        var nombre = texto(r.nombre);
        if (q && U.normalizar(nombre + ' ' + nombreObjetivo(r.objetivo) + ' ' + nombreNivel(r.nivel)).indexOf(q) < 0) continue;

        mostradas++;
        var st = estadisticas(r);
        var recomendada = puntajeRecomendacion(r, socio) >= 3;
        var elegida = r.id === estado.rutinaId;

        html += '<button type="button" class="list-item clickable' + (elegida ? ' rt-sel' : '') + '" data-rutina="' + esc(r.id) + '">' +
          '<div class="list-item-main">' +
            '<div class="row-sm wrap" style="gap:7px">' +
              '<span class="bold truncar">' + esc(nombre) + '</span>' +
              (recomendada ? '<span class="badge badge-ok">Recomendada</span>' : '') +
            '</div>' +
            '<div class="mini muted">' + esc(nombreObjetivo(r.objetivo)) + ' · ' + esc(nombreNivel(r.nivel)) +
              ' · ' + entero(r.diasPorSemana, st.dias) + ' días · ' + st.ejercicios + ' ejercicios</div>' +
          '</div>' +
          '<div class="list-item-side">' + (elegida ? icono('check', 18) : '') + '</div>' +
        '</button>';
      }
      html += '</div>';
      if (!mostradas) return vacio('buscar', 'Sin coincidencias', 'Ninguna rutina coincide con esa búsqueda.');
      return html;
    }

    function fechaFinCalculada() {
      var semanas = entero(estado.semanas, 12);
      if (semanas < 1) semanas = 1;
      if (semanas > 52) semanas = 52;
      return U.sumaDias(estado.inicio, semanas * 7);
    }

    function textoFin() {
      var fin = fechaFinCalculada();
      return fin
        ? 'Termina el ' + U.fecha(fin, 'largo') + '.'
        : 'Revisa la fecha de inicio para calcular el cierre.';
    }

    var cuerpo = '<div class="stack-sm">' +
      '<div class="row-sm wrap">' + U.avatar(socio, '') +
        '<div style="min-width:0">' +
          '<div class="bold">' + esc(U.nombreCompleto(socio)) + '</div>' +
          '<div class="mini muted">' + esc(nombreObjetivo(socio.objetivo)) + ' · ' + esc(nombreNivel(socio.nivel)) + '</div>' +
        '</div>' +
      '</div>' +

      (vigente && vigente.rutina
        ? '<div class="aviso aviso-info">' + icono('info', 18) +
          '<div>Hoy entrena con <b>' + esc(vigente.rutina.nombre) + '</b> desde el ' +
          esc(U.fecha(vigente.asignacion.fechaInicio, 'corto')) + '. Al guardar, esa asignación se finaliza.</div></div>'
        : '') +

      '<div class="field"><span class="label">Buscar rutina</span>' +
        '<div class="input-icono">' + icono('buscar', 17) +
          '<input class="input" type="search" data-buscar-rutina placeholder="Nombre, objetivo o nivel" autocomplete="off">' +
        '</div></div>' +

      '<div data-lista-rutinas>' + htmlListaRutinas() + '</div>' +

      '<div class="form-grid dos">' +
        '<div class="field"><span class="label">Fecha de inicio</span>' +
          '<input class="input" type="date" data-inicio value="' + esc(estado.inicio) + '"></div>' +
        '<div class="field"><span class="label">Duración (semanas)</span>' +
          '<input class="input" type="number" min="1" max="52" step="1" data-semanas value="' + estado.semanas + '"></div>' +
      '</div>' +
      '<p class="mini muted" data-fin>' + esc(textoFin()) + '</p>' +

      '<div class="field"><span class="label">Notas del coach</span>' +
        '<textarea class="textarea" rows="3" data-notas placeholder="Indicaciones, cargas de arranque, cuidados…"></textarea></div>' +
    '</div>';

    U.modal({
      titulo: 'Asignar rutina',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: 'Asignar rutina',
          clase: 'btn-primary',
          onClick: function (api) {
            if (guardarAsignacion(api.root, usuario, socio, estado)) api.cerrar();
          }
        }
      ],
      onOpen: function (root) {
        var caja = U.$('[data-lista-rutinas]', root);
        var pieFin = U.$('[data-fin]', root);

        function refrescarFin() {
          if (pieFin) pieFin.textContent = textoFin();
        }

        var buscar = U.$('[data-buscar-rutina]', root);
        if (buscar) {
          buscar.addEventListener('input', U.debounce(function () {
            estado.q = buscar.value || '';
            if (caja) caja.innerHTML = htmlListaRutinas();
          }, 200));
        }

        U.delegar(root, 'click', '[data-rutina]', function (e, el) {
          estado.rutinaId = el.getAttribute('data-rutina');
          if (caja) caja.innerHTML = htmlListaRutinas();
        });

        U.delegar(root, 'input', '[data-inicio]', function (e, el) {
          estado.inicio = el.value || U.hoy();
          refrescarFin();
        });

        U.delegar(root, 'input', '[data-semanas]', function (e, el) {
          estado.semanas = entero(el.value, 12);
          refrescarFin();
        });
      }
    });
  }

  /** Valida y persiste la nueva asignación. Devuelve true si guardó. */
  function guardarAsignacion(root, usuario, socio, estado) {
    var rutina = AG.DB.buscar('rutinas', estado.rutinaId);
    if (!rutina) { U.toast('Elige una rutina de la lista', 'warn'); return false; }

    var inicio = texto(estado.inicio).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
      U.toast('La fecha de inicio no es válida', 'warn');
      return false;
    }

    var semanas = entero(estado.semanas, 12);
    if (semanas < 1 || semanas > 52) {
      U.toast('La duración debe estar entre 1 y 52 semanas', 'warn');
      return false;
    }

    var fin = U.sumaDias(inicio, semanas * 7);
    var notasEl = U.$('[data-notas]', root);
    var notas = notasEl ? texto(notasEl.value).trim() : '';

    /* 1) Se cierran las asignaciones vigentes del socio */
    var previas = AG.DB.donde('asignaciones', function (a) {
      return a && a.socioId === socio.id && a.activa !== false;
    });
    for (var i = 0; i < previas.length; i++) {
      previas[i].activa = false;
      if (!previas[i].fechaFin || previas[i].fechaFin > inicio) previas[i].fechaFin = inicio;
    }
    if (previas.length) AG.DB.guardar();

    /* 2) Se crea la nueva */
    var creada = AG.DB.insertar('asignaciones', {
      socioId: socio.id,
      rutinaId: rutina.id,
      coachId: (usuario.rol === 'coach' ? usuario.id : (socio.coachId || usuario.id)),
      fechaInicio: inicio,
      fechaFin: fin,
      activa: true,
      notas: notas
    });

    if (!creada) { U.toast('No se pudo guardar la asignación', 'error'); return false; }

    /* 3) Se avisa al socio */
    AG.DB.notificar(socio.id, {
      titulo: 'Tu coach te asignó una rutina nueva',
      cuerpo: 'A partir del ' + U.fecha(inicio, 'corto') + ' entrenas con «' + texto(rutina.nombre) + '». Revísala en Mi rutina.',
      tipo: 'rutina',
      link: '#/socio/rutina'
    });

    U.toast('Rutina asignada a ' + U.nombreCompleto(socio), 'ok');
    AG.Router.refrescar();
    return true;
  }

  /* =========================================================
     12. Editor de rutinas
     ========================================================= */

  /** Navega al editor (API compartida del contrato). */
  function abrirEditor(rutinaId) {
    var usuario = usuarioEnSesion();
    var base = baseDe(usuario);
    editorEstado = null;
    if (rutinaId) AG.Router.ir(base + '/rutina?id=' + encodeURIComponent(rutinaId));
    else AG.Router.ir(base + '/rutina');
  }

  function diaVacio(numero) {
    return {
      nombre: 'Día ' + numero,
      enfoque: '',
      calentamiento: '',
      cardio: '',
      ejercicios: []
    };
  }

  /** Copia limpia de una rutina para trabajar en el editor. */
  function borradorDe(rutina) {
    var datos = {
      nombre: '',
      objetivo: 'ganar_musculo',
      nivel: 'principiante',
      diasPorSemana: 3,
      descripcion: '',
      dias: [diaVacio(1)]
    };

    if (!rutina) return datos;

    datos.nombre = texto(rutina.nombre);
    datos.objetivo = texto(rutina.objetivo) || 'ganar_musculo';
    datos.nivel = texto(rutina.nivel) || 'principiante';
    datos.diasPorSemana = entero(rutina.diasPorSemana, 3);
    datos.descripcion = texto(rutina.descripcion);
    datos.dias = [];

    var dias = lista(rutina.dias);
    for (var i = 0; i < dias.length; i++) {
      var d = dias[i] || {};
      var ejercicios = lista(d.ejercicios);
      var copiaEj = [];
      for (var j = 0; j < ejercicios.length; j++) {
        var e = ejercicios[j] || {};
        copiaEj.push({
          ejercicioId: texto(e.ejercicioId),
          series: entero(e.series, 3),
          reps: texto(e.reps) || '10-12',
          descansoSeg: entero(e.descansoSeg, 60),
          tempo: texto(e.tempo),
          peso: texto(e.peso),
          notas: texto(e.notas)
        });
      }
      datos.dias.push({
        nombre: texto(d.nombre) || ('Día ' + (i + 1)),
        enfoque: texto(d.enfoque),
        calentamiento: texto(d.calentamiento),
        cardio: texto(d.cardio),
        ejercicios: copiaEj
      });
    }

    if (!datos.dias.length) datos.dias.push(diaVacio(1));
    return datos;
  }

  /** Prepara (o reutiliza) el borrador del editor. */
  function prepararBorrador(path, id, rutina) {
    var clave = path + '|' + (id || 'nuevo');
    if (editorEstado && editorEstado.clave === clave) return editorEstado;

    var datos = borradorDe(rutina);
    editorEstado = {
      clave: clave,
      id: id || '',
      diaActivo: 0,
      datos: datos,
      original: JSON.stringify(datos)
    };
    return editorEstado;
  }

  /** ¿El borrador tiene cambios sin guardar? */
  function hayCambios() {
    if (!editorEstado) return false;
    try { return JSON.stringify(editorEstado.datos) !== editorEstado.original; }
    catch (e) { return true; }
  }

  /** Render de la ruta del editor. */
  function renderEditor(ctx) {
    estilos();
    engancharDetalleGlobal();

    var usuario = ctx.usuario;
    var base = baseDe(usuario);
    var id = ctx.params && ctx.params.id ? String(ctx.params.id) : '';
    var rutina = id ? AG.DB.buscar('rutinas', id) : null;

    if (id && !rutina) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('buscar', 'Rutina no encontrada',
          'La rutina que intentas editar ya no existe en la base.',
          '<a class="btn btn-primary" href="#/' + esc(base) + '/rutinas">Volver a rutinas</a>') +
        '</div></div></div>';
    }

    if (rutina && !puedeEditarRutina(usuario, rutina)) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('candado', 'No puedes editar esta rutina',
          'Solo el director o quien creó la rutina pueden modificarla. Puedes duplicarla y ajustar tu propia versión.',
          '<a class="btn btn-primary" href="#/' + esc(base) + '/rutinas">Volver a rutinas</a>') +
        '</div></div></div>';
    }

    var est = prepararBorrador(ctx.path, id, rutina);

    return {
      html: htmlEditor(est, base, !!rutina),
      listo: function (root) { engancharEditor(root, usuario, base); }
    };
  }

  function htmlEditor(est, base, esEdicion) {
    var d = est.datos;

    return '<div class="page">' +

      /* --- Encabezado sticky con Guardar --- */
      '<div class="rt-sticky">' +
        '<div class="between wrap" style="gap:10px">' +
          '<div style="min-width:0">' +
            '<h1 class="page-title">' + icono('mancuerna', 24) + ' ' +
              (esEdicion ? 'Editar rutina' : 'Nueva rutina') + '</h1>' +
            '<p class="page-sub">Arma los días, agrega ejercicios y guarda cuando esté lista.</p>' +
          '</div>' +
          '<div class="row-sm wrap">' +
            '<button type="button" class="btn btn-ghost" data-cancelar>' + icono('x', 16) + ' Cancelar</button>' +
            '<button type="button" class="btn btn-primary" data-guardar>' + icono('check', 16) + ' Guardar rutina</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* --- Datos generales --- */
      '<div class="card"><div class="card-head"><div>' +
        '<h2 class="card-title">Datos generales</h2>' +
        '<p class="card-sub">Así se verá en la biblioteca de plantillas</p>' +
      '</div></div>' +
      '<div class="card-body">' +
        '<div class="form-grid">' +
          '<div class="field span-todo"><span class="label">Nombre de la rutina *</span>' +
            '<input class="input" type="text" maxlength="70" data-gen="nombre" value="' + esc(d.nombre) + '" ' +
              'placeholder="Ej. Torso-Pierna 4 días"></div>' +
          '<div class="field"><span class="label">Objetivo</span>' +
            '<select class="select" data-gen="objetivo">' + opciones(OBJETIVOS, d.objetivo) + '</select></div>' +
          '<div class="field"><span class="label">Nivel</span>' +
            '<select class="select" data-gen="nivel">' + opciones(NIVELES, d.nivel) + '</select></div>' +
          '<div class="field"><span class="label">Días por semana</span>' +
            '<input class="input" type="number" min="1" max="7" step="1" data-gen="diasPorSemana" value="' + entero(d.diasPorSemana, 3) + '"></div>' +
          '<div class="field span-todo"><span class="label">Descripción</span>' +
            '<textarea class="textarea" rows="3" data-gen="descripcion" ' +
              'placeholder="Para quién es, qué busca y cómo progresar.">' + esc(d.descripcion) + '</textarea></div>' +
        '</div>' +
        '<p class="help" data-aviso-dias>' + esc(avisoDias(d)) + '</p>' +
      '</div></div>' +

      /* --- Días --- */
      '<div class="card">' +
        '<div class="card-head"><div>' +
          '<h2 class="card-title">Días de entrenamiento</h2>' +
          '<p class="card-sub">Cada pestaña es una sesión de la semana</p>' +
        '</div></div>' +
        '<div class="tabs" data-tabs-dias>' + htmlTabsDias(est) + '</div>' +
        '<div class="card-body" data-panel-dia>' + htmlPanelDia(est) + '</div>' +
      '</div>' +

    '</div>';
  }

  function avisoDias(d) {
    var declarados = entero(d.diasPorSemana, 0);
    var creados = lista(d.dias).length;
    if (declarados === creados) return 'La rutina declara ' + declarados + ' días por semana y tiene ' + creados + ' días armados.';
    return 'Ojo: la rutina declara ' + declarados + ' días por semana pero tienes ' + creados + ' días armados.';
  }

  function htmlTabsDias(est) {
    var dias = lista(est.datos.dias);
    var html = '';
    for (var i = 0; i < dias.length; i++) {
      var st = estadisticasDia(dias[i]);
      html += '<button type="button" class="tab' + (i === est.diaActivo ? ' active' : '') + '" data-tab-dia="' + i + '">' +
        esc(dias[i].nombre || ('Día ' + (i + 1))) +
        '<span class="badge badge-muted">' + st.ejercicios + '</span>' +
      '</button>';
    }
    html += '<button type="button" class="tab" data-agregar-dia>' + icono('mas', 15) + ' Agregar día</button>';
    return html;
  }

  function htmlPanelDia(est) {
    var dias = lista(est.datos.dias);
    if (!dias.length) {
      return vacio('calendario', 'La rutina no tiene días',
        'Agrega el primer día para empezar a cargar ejercicios.',
        '<button type="button" class="btn btn-primary" data-agregar-dia>' + icono('mas', 16) + ' Agregar día</button>');
    }

    var i = est.diaActivo;
    if (i < 0 || i >= dias.length) { i = 0; est.diaActivo = 0; }
    var dia = dias[i];

    return '<div class="stack">' +

      '<div class="between wrap" style="gap:10px">' +
        '<h3 class="card-title">' + esc(dia.nombre || ('Día ' + (i + 1))) + '</h3>' +
        '<button type="button" class="btn btn-sm btn-danger" data-eliminar-dia>' + icono('basura', 15) + ' Eliminar día</button>' +
      '</div>' +

      '<div class="form-grid dos">' +
        '<div class="field"><span class="label">Nombre del día</span>' +
          '<input class="input" type="text" maxlength="40" data-campo="nombre" value="' + esc(dia.nombre) + '" placeholder="Día 1"></div>' +
        '<div class="field"><span class="label">Enfoque</span>' +
          '<input class="input" type="text" maxlength="60" data-campo="enfoque" value="' + esc(dia.enfoque) + '" placeholder="Pecho y tríceps"></div>' +
        '<div class="field"><span class="label">Calentamiento</span>' +
          '<textarea class="textarea" rows="2" data-campo="calentamiento" placeholder="Movilidad, activación y series de aproximación.">' + esc(dia.calentamiento) + '</textarea></div>' +
        '<div class="field"><span class="label">Cardio final</span>' +
          '<textarea class="textarea" rows="2" data-campo="cardio" placeholder="10 min de caminata en pendiente.">' + esc(dia.cardio) + '</textarea></div>' +
      '</div>' +

      '<div data-resumen>' + htmlResumenDia(dia) + '</div>' +

      '<div class="between wrap" style="gap:10px">' +
        '<span class="label">Ejercicios del día</span>' +
        '<button type="button" class="btn btn-sm btn-outline" data-agregar-ejercicios>' + icono('mas', 15) + ' Agregar ejercicios</button>' +
      '</div>' +

      '<div class="stack-sm" data-ejercicios>' + htmlEjerciciosEditor(dia) + '</div>' +

    '</div>';
  }

  function htmlResumenDia(dia) {
    var st = estadisticasDia(dia);
    return '<div class="caja">' +
      '<div class="row-sm wrap">' +
        '<span class="pill">' + icono('pesa', 13) + '<b>' + st.series + '</b> series en total</span>' +
        '<span class="pill">' + icono('mancuerna', 13) + '<b>' + st.ejercicios + '</b> ejercicios</span>' +
        '<span class="pill">' + icono('reloj', 13) + 'Duración estimada <b>' + st.minutos + '</b> min</span>' +
      '</div>' +
      '<div class="mt-sm">' + chipsGrupos(st.grupos, 8) + '</div>' +
    '</div>';
  }

  function htmlEjerciciosEditor(dia) {
    var ejercicios = lista(dia.ejercicios);
    if (!ejercicios.length) {
      return vacio('mancuerna', 'Este día está vacío',
        'Agrega ejercicios del catálogo y define series, repeticiones y descansos.',
        '<button type="button" class="btn btn-primary" data-agregar-ejercicios>' + icono('mas', 16) + ' Agregar ejercicios</button>');
    }

    var html = '';
    for (var i = 0; i < ejercicios.length; i++) {
      html += htmlFilaEditor(ejercicios[i], i, ejercicios.length);
    }
    return html;
  }

  function htmlFilaEditor(ej, i, total) {
    var cat = ejercicioDe(ej.ejercicioId);
    var g = cat ? grupoDe(cat.grupo) : null;

    return '<div class="rt-ej" data-fila="' + i + '">' +
      '<div class="between wrap" style="gap:8px">' +
        '<div class="row-sm" style="min-width:0">' +
          '<span class="rt-idx">' + (i + 1) + '</span>' +
          '<div style="min-width:0">' +
            '<div class="bold truncar">' + esc(cat ? cat.nombre : 'Ejercicio no disponible') + '</div>' +
            '<div class="mini muted">' +
              (g ? '<i class="rt-punto" style="background:' + esc(g.color) + ';margin-right:5px"></i>' + esc(g.nombre) : 'Fuera del catálogo') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="row-sm">' +
          (cat ? '<button type="button" class="btn-icono btn-sm" data-ag-ej-detalle="' + esc(ej.ejercicioId) + '" title="Ver técnica" aria-label="Ver técnica">' + icono('info', 16) + '</button>' : '') +
          '<button type="button" class="btn-icono btn-sm" data-ej-accion="subir" data-i="' + i + '" title="Subir" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + icono('flecha-arriba', 16) + '</button>' +
          '<button type="button" class="btn-icono btn-sm" data-ej-accion="bajar" data-i="' + i + '" title="Bajar" aria-label="Bajar"' + (i === total - 1 ? ' disabled' : '') + '>' + icono('flecha-abajo', 16) + '</button>' +
          '<button type="button" class="btn-icono btn-sm" data-ej-accion="duplicar" data-i="' + i + '" title="Duplicar" aria-label="Duplicar">' + icono('mas', 16) + '</button>' +
          '<button type="button" class="btn-icono btn-sm peligro" data-ej-accion="quitar" data-i="' + i + '" title="Quitar" aria-label="Quitar">' + icono('basura', 16) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="rt-campos">' +
        '<div class="field"><span class="label">Series</span>' +
          '<input class="input" type="number" min="1" max="20" step="1" data-ej-campo="series" data-i="' + i + '" value="' + seriesDe(ej) + '"></div>' +
        '<div class="field"><span class="label">Reps</span>' +
          '<input class="input" type="text" maxlength="18" data-ej-campo="reps" data-i="' + i + '" value="' + esc(ej.reps) + '" placeholder="8-10"></div>' +
        '<div class="field"><span class="label">Descanso (s)</span>' +
          '<input class="input" type="number" min="0" max="600" step="5" data-ej-campo="descansoSeg" data-i="' + i + '" value="' + descansoDe(ej) + '"></div>' +
        '<div class="field"><span class="label">Tempo</span>' +
          '<input class="input" type="text" maxlength="18" data-ej-campo="tempo" data-i="' + i + '" value="' + esc(ej.tempo) + '" placeholder="2-0-2-0"></div>' +
        '<div class="field"><span class="label">Peso sugerido</span>' +
          '<input class="input" type="text" maxlength="24" data-ej-campo="peso" data-i="' + i + '" value="' + esc(ej.peso) + '" placeholder="60 kg / RPE 8"></div>' +
      '</div>' +

      '<div class="field mt-sm"><span class="label">Notas</span>' +
        '<input class="input" type="text" maxlength="140" data-ej-campo="notas" data-i="' + i + '" value="' + esc(ej.notas) + '" ' +
          'placeholder="Indicación técnica para el socio"></div>' +
    '</div>';
  }

  /** Eventos del editor. */
  function engancharEditor(root, usuario, base) {
    var est = editorEstado;
    if (!est) return;

    function diaActual() {
      var dias = lista(est.datos.dias);
      return dias[est.diaActivo] || null;
    }

    function pintarTabs() {
      var caja = U.$('[data-tabs-dias]', root);
      if (caja) caja.innerHTML = htmlTabsDias(est);
    }

    function pintarPanel() {
      var caja = U.$('[data-panel-dia]', root);
      if (caja) caja.innerHTML = htmlPanelDia(est);
    }

    function pintarEjercicios() {
      var dia = diaActual();
      var caja = U.$('[data-ejercicios]', root);
      if (caja && dia) caja.innerHTML = htmlEjerciciosEditor(dia);
      pintarResumen();
      pintarTabs();
    }

    function pintarResumen() {
      var dia = diaActual();
      var caja = U.$('[data-resumen]', root);
      if (caja && dia) caja.innerHTML = htmlResumenDia(dia);
    }

    function pintarAvisoDias() {
      var caja = U.$('[data-aviso-dias]', root);
      if (caja) caja.textContent = avisoDias(est.datos);
    }

    /* --- Campos generales --- */
    function aplicarGeneral(el) {
      var campo = el.getAttribute('data-gen');
      if (campo === 'diasPorSemana') {
        var n = entero(el.value, 3);
        if (n < 1) n = 1;
        if (n > 7) n = 7;
        est.datos.diasPorSemana = n;
        pintarAvisoDias();
        return;
      }
      est.datos[campo] = el.value;
    }

    U.delegar(root, 'input', '[data-gen]', function (e, el) { aplicarGeneral(el); });
    U.delegar(root, 'change', '[data-gen]', function (e, el) { aplicarGeneral(el); });

    /* --- Campos del día --- */
    U.delegar(root, 'input', '[data-campo]', function (e, el) {
      var dia = diaActual();
      if (!dia) return;
      var campo = el.getAttribute('data-campo');
      dia[campo] = el.value;
      if (campo === 'nombre') pintarTabs();
    });

    /* --- Pestañas de días --- */
    U.delegar(root, 'click', '[data-tab-dia]', function (e, el) {
      var idx = entero(el.getAttribute('data-tab-dia'), 0);
      if (idx === est.diaActivo) return;
      est.diaActivo = idx;
      pintarTabs();
      pintarPanel();
    });

    U.delegar(root, 'click', '[data-agregar-dia]', function () {
      if (est.datos.dias.length >= 7) {
        U.toast('Una rutina admite como máximo 7 días', 'warn');
        return;
      }
      est.datos.dias.push(diaVacio(est.datos.dias.length + 1));
      est.diaActivo = est.datos.dias.length - 1;
      pintarTabs();
      pintarPanel();
      pintarAvisoDias();
    });

    U.delegar(root, 'click', '[data-eliminar-dia]', function () {
      var dia = diaActual();
      if (!dia) return;
      if (est.datos.dias.length <= 1) {
        U.toast('La rutina necesita al menos un día', 'warn');
        return;
      }
      U.confirmar('¿Eliminar «' + texto(dia.nombre) + '» con sus ' + lista(dia.ejercicios).length + ' ejercicios?',
        'Eliminar día', { peligro: true, textoOk: 'Sí, eliminar' })
        .then(function (ok) {
          if (!ok) return;
          est.datos.dias.splice(est.diaActivo, 1);
          if (est.diaActivo >= est.datos.dias.length) est.diaActivo = est.datos.dias.length - 1;
          pintarTabs();
          pintarPanel();
          pintarAvisoDias();
          U.toast('Día eliminado', 'ok');
        });
    });

    /* --- Ejercicios --- */
    U.delegar(root, 'click', '[data-agregar-ejercicios]', function () {
      var dia = diaActual();
      if (!dia) return;
      abrirSelectorEjercicios(function (ids) {
        for (var i = 0; i < ids.length; i++) {
          dia.ejercicios.push({
            ejercicioId: ids[i],
            series: 3,
            reps: '10-12',
            descansoSeg: 60,
            tempo: '',
            peso: '',
            notas: ''
          });
        }
        pintarEjercicios();
        U.toast(ids.length === 1 ? 'Ejercicio agregado' : ids.length + ' ejercicios agregados', 'ok');
      });
    });

    U.delegar(root, 'input', '[data-ej-campo]', function (e, el) {
      var dia = diaActual();
      if (!dia) return;
      var i = entero(el.getAttribute('data-i'), -1);
      var ej = dia.ejercicios[i];
      if (!ej) return;

      var campo = el.getAttribute('data-ej-campo');
      if (campo === 'series') {
        var s = entero(el.value, 1);
        if (s < 1) s = 1;
        if (s > 20) s = 20;
        ej.series = s;
        pintarResumen();
        pintarTabs();
      } else if (campo === 'descansoSeg') {
        var d = entero(el.value, 0);
        if (d < 0) d = 0;
        if (d > 600) d = 600;
        ej.descansoSeg = d;
        pintarResumen();
      } else {
        ej[campo] = el.value;
      }
    });

    U.delegar(root, 'click', '[data-ej-accion]', function (e, el) {
      var dia = diaActual();
      if (!dia) return;
      var i = entero(el.getAttribute('data-i'), -1);
      var accion = el.getAttribute('data-ej-accion');
      var ejercicios = dia.ejercicios;
      if (i < 0 || i >= ejercicios.length) return;

      if (accion === 'subir' && i > 0) {
        var arriba = ejercicios[i - 1];
        ejercicios[i - 1] = ejercicios[i];
        ejercicios[i] = arriba;
      } else if (accion === 'bajar' && i < ejercicios.length - 1) {
        var abajo = ejercicios[i + 1];
        ejercicios[i + 1] = ejercicios[i];
        ejercicios[i] = abajo;
      } else if (accion === 'duplicar') {
        var copia = {
          ejercicioId: ejercicios[i].ejercicioId,
          series: ejercicios[i].series,
          reps: ejercicios[i].reps,
          descansoSeg: ejercicios[i].descansoSeg,
          tempo: ejercicios[i].tempo,
          peso: ejercicios[i].peso,
          notas: ejercicios[i].notas
        };
        ejercicios.splice(i + 1, 0, copia);
      } else if (accion === 'quitar') {
        ejercicios.splice(i, 1);
      } else {
        return;
      }
      pintarEjercicios();
    });

    /* --- Guardar y cancelar --- */
    U.delegar(root, 'click', '[data-guardar]', function () {
      guardarRutina(usuario, base);
    });

    U.delegar(root, 'click', '[data-cancelar]', function () {
      if (!hayCambios()) {
        editorEstado = null;
        AG.Router.ir(base + '/rutinas');
        return;
      }
      U.confirmar('Tienes cambios sin guardar. ¿Salir y descartarlos?', 'Descartar cambios',
        { peligro: true, textoOk: 'Sí, descartar' })
        .then(function (ok) {
          if (!ok) return;
          editorEstado = null;
          AG.Router.ir(base + '/rutinas');
        });
    });
  }

  /** Valida el borrador y lo persiste. */
  function guardarRutina(usuario, base) {
    var est = editorEstado;
    if (!est) return;

    var d = est.datos;
    var nombre = texto(d.nombre).trim();

    if (!nombre) {
      U.toast('Ponle un nombre a la rutina', 'warn');
      var campo = U.$('[data-gen="nombre"]');
      if (campo) { try { campo.focus(); } catch (e) { /* sin foco disponible */ } }
      return;
    }

    var dias = lista(d.dias);
    var conEjercicios = 0, i;
    for (i = 0; i < dias.length; i++) {
      if (lista(dias[i].ejercicios).length) conEjercicios++;
    }

    if (!conEjercicios) {
      U.toast('Agrega al menos un ejercicio en algún día', 'warn');
      return;
    }

    /* Días limpios y numerados por si quedó alguno sin nombre */
    var diasLimpios = [];
    for (i = 0; i < dias.length; i++) {
      var dia = dias[i];
      diasLimpios.push({
        nombre: texto(dia.nombre).trim() || ('Día ' + (i + 1)),
        enfoque: texto(dia.enfoque).trim(),
        calentamiento: texto(dia.calentamiento).trim(),
        cardio: texto(dia.cardio).trim(),
        ejercicios: lista(dia.ejercicios).map(function (ej) {
          return {
            ejercicioId: texto(ej.ejercicioId),
            series: seriesDe(ej) || 1,
            reps: texto(ej.reps).trim() || '10-12',
            descansoSeg: descansoDe(ej),
            tempo: texto(ej.tempo).trim(),
            peso: texto(ej.peso).trim(),
            notas: texto(ej.notas).trim()
          };
        })
      });
    }

    var diasPorSemana = entero(d.diasPorSemana, diasLimpios.length);
    if (diasPorSemana < 1) diasPorSemana = 1;
    if (diasPorSemana > 7) diasPorSemana = 7;

    var cambios = {
      nombre: nombre,
      objetivo: d.objetivo,
      nivel: d.nivel,
      diasPorSemana: diasPorSemana,
      descripcion: texto(d.descripcion).trim(),
      dias: diasLimpios,
      esPlantilla: true
    };

    if (est.id) {
      var actualizada = AG.DB.actualizar('rutinas', est.id, cambios);
      if (!actualizada) { U.toast('No se pudo guardar: la rutina ya no existe', 'error'); return; }
      U.toast('Rutina «' + nombre + '» actualizada', 'ok');
    } else {
      cambios.creadaPor = usuario.id;
      cambios.creada = U.hoy();
      var creada = AG.DB.insertar('rutinas', cambios);
      if (!creada) { U.toast('No se pudo crear la rutina', 'error'); return; }
      U.toast('Rutina «' + nombre + '» creada', 'ok');
    }

    editorEstado = null;
    AG.Router.ir(base + '/rutinas');
  }

  /* =========================================================
     13. API pública del módulo
     ========================================================= */

  AG.Mod.Rutinas = {
    render: render,
    renderEditor: renderEditor,
    editor: abrirEditor,
    asignar: asignar,
    vistaDia: vistaDia,
    resumen: resumen,
    estadisticas: estadisticas,
    estadisticasDia: estadisticasDia,
    chipsGrupos: chipsGrupos,
    leerRegistro: leerRegistro,
    nombreObjetivo: nombreObjetivo,
    nombreNivel: nombreNivel,
    verRutina: verRutina
  };

  /* =========================================================
     14. Rutas
     ========================================================= */

  AG.Router.registrar({
    path: 'director/rutinas',
    roles: ['director'],
    titulo: 'Rutinas',
    nav: { etiqueta: 'Rutinas', icono: 'mancuerna', grupo: 'Entrenamiento', orden: 3 },
    render: render
  });

  AG.Router.registrar({
    path: 'coach/rutinas',
    roles: ['coach'],
    titulo: 'Rutinas',
    nav: { etiqueta: 'Rutinas', icono: 'mancuerna', grupo: 'Entrenamiento', orden: 3 },
    render: render
  });

  AG.Router.registrar({
    path: 'director/rutina',
    roles: ['director'],
    titulo: 'Editor de rutina',
    nav: null,
    render: renderEditor
  });

  AG.Router.registrar({
    path: 'coach/rutina',
    roles: ['coach'],
    titulo: 'Editor de rutina',
    nav: null,
    render: renderEditor
  });

})(window.AG);
