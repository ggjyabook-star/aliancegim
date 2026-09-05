/* =============================================================
   ALLIANCE GYM — AG.Views.SocioCalificar
   -------------------------------------------------------------
   Pantalla del socio para calificar a su coach y al gimnasio.

   Ruta: 'socio/calificar'  (rol: socio)

   Qué hay aquí:
     1. Dos tarjetas grandes lado a lado (apiladas en móvil) con
        estrellas grandes, interactivas y accesibles con teclado.
        - Coach:    Atención · Conocimiento · Puntualidad · Motivación
        - Gimnasio: Instalaciones · Limpieza · Equipo · Ambiente
        La estrella general se calcula sola como promedio de las
        cuatro y aun así se puede ajustar a mano.
     2. Si el socio ya calificó este mes se precarga su calificación
        y el botón pasa a decir «Actualizar mi calificación».
     3. Historial de sus calificaciones con la respuesta de dirección.
     4. Resumen público: lo que opinan los demás socios.

   Reglas del proyecto: JavaScript clásico, sin módulos ni CDN,
   todo el texto de la base pasa por AG.Utils.esc(), nada de
   alert/confirm/prompt, nada de localStorage directo, y ningún
   estado sin su vacío en español.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Lo que el socio califica de su coach (mismo orden que el módulo). */
  var CATS_COACH = [
    { clave: 'atencion', etiqueta: 'Atención', ayuda: '¿Te escucha y te corrige durante la sesión?' },
    { clave: 'conocimiento', etiqueta: 'Conocimiento', ayuda: '¿Explica con criterio lo que te manda hacer?' },
    { clave: 'puntualidad', etiqueta: 'Puntualidad', ayuda: '¿Llega y empieza a tiempo tu sesión?' },
    { clave: 'motivacion', etiqueta: 'Motivación', ayuda: '¿Te deja con ganas de volver al día siguiente?' }
  ];

  /* Lo que el socio califica del gimnasio. */
  var CATS_GYM = [
    { clave: 'instalaciones', etiqueta: 'Instalaciones', ayuda: 'Vestidores, regaderas, iluminación y espacio.' },
    { clave: 'limpieza', etiqueta: 'Limpieza', ayuda: 'Área de pesas, baños y equipo desinfectado.' },
    { clave: 'equipo', etiqueta: 'Equipo', ayuda: 'Máquinas suficientes y en buen estado.' },
    { clave: 'ambiente', etiqueta: 'Ambiente', ayuda: 'Música, trato del personal y compañerismo.' }
  ];

  var MAX_COMENTARIO = 500;      /* mismo límite que usa el módulo de calificaciones */
  var PAGINA_HISTORIAL = 6;      /* calificaciones propias por tanda */
  var RESENAS_PUBLICAS = 3;      /* reseñas anónimas que se muestran */

  /* Estado vivo de la pantalla: sobrevive a los repintados. */
  var estado = {
    prefijo: 'cal',
    manual: { coach: false, gimnasio: false },
    limite: PAGINA_HISTORIAL
  };

  /* =============================================================
     1. Estilos propios (solo variantes que el CSS base no trae)
     ============================================================= */

  var ESTILOS_ID = 'ag-estilos-socio-calificar';

  var CSS_PROPIO = '' +
    '.cal-vista [hidden]{display:none !important}' +
    '.cal-vista .stars-input label{width:34px;height:34px}' +
    '.cal-num{font-size:44px;font-weight:800;line-height:1;letter-spacing:-.03em;' +
      'color:var(--texto);font-variant-numeric:tabular-nums}' +
    '.cal-cat{padding:10px 0;border-bottom:1px dashed var(--borde);gap:6px}' +
    '.cal-cat:last-of-type{border-bottom:0}' +
    '.cal-general{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
      'padding:12px 13px;background:var(--panel-2);gap:8px}' +
    '.cal-fila{display:grid;grid-template-columns:40px 1fr 94px;align-items:center;gap:9px;margin-bottom:8px}' +
    '.cal-fila:last-child{margin-bottom:0}' +
    '.cal-item{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
      'padding:12px 13px;background:var(--panel-2)}' +
    '.cal-item+.cal-item{margin-top:10px}' +
    '.cal-respuesta{margin-top:10px;padding:10px 12px;border:1px solid rgba(var(--rojo-rgb),.32);' +
      'border-left:3px solid var(--rojo);background:var(--rojo-bg);' +
      'border-radius:0 var(--radio-sm) var(--radio-sm) 0}' +
    '.cal-anonimo{flex:0 0 auto;display:grid;place-items:center;width:32px;height:32px;' +
      'border-radius:50%;font-size:11.5px;font-weight:800;color:#fff;letter-spacing:.02em}' +
    '.cal-centro{text-align:center}' +
    '.cal-progreso{font-variant-numeric:tabular-nums}' +
    '@media (max-width:520px){' +
      '.cal-num{font-size:36px}' +
      '.cal-vista .stars-input label{width:30px;height:30px}' +
      '.cal-fila{grid-template-columns:34px 1fr 78px}' +
    '}';

  function asegurarEstilos() {
    if (!document || document.getElementById(ESTILOS_ID)) return;
    var st = document.createElement('style');
    st.id = ESTILOS_ID;
    st.textContent = CSS_PROPIO;
    document.head.appendChild(st);
  }

  /* =============================================================
     2. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function ico(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function vacio(mensaje, nombreIcono) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ico(nombreIcono || 'estrella', 34) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      '</div>';
  }

  /** Nombre del gimnasio, siempre desde la configuración. */
  function nombreGym() {
    try {
      var s = AG.DB.state && AG.DB.state.settings;
      if (s && s.nombreGym) return String(s.nombreGym);
    } catch (e) { /* se usa el valor genérico */ }
    return 'el gimnasio';
  }

  function lemaGym() {
    try {
      var s = AG.DB.state && AG.DB.state.settings;
      if (s && s.lema) return String(s.lema);
    } catch (e) { /* sin lema configurado */ }
    return 'Tu casa de entrenamiento';
  }

  /** Estrellas enteras y acotadas de 1 a 5 (0 = sin calificar). */
  function estrellasDe(cal) {
    var e = Math.round(Number(cal && cal.estrellas) || 0);
    if (!isFinite(e) || e < 1) return 0;
    return e > 5 ? 5 : e;
  }

  function tieneRespuesta(cal) {
    return !!(cal && cal.respuesta && String(cal.respuesta.texto || '').trim());
  }

  /** Calificaciones de un objetivo concreto (coach o 'gym'). */
  function listaDe(tipo, objetivoId) {
    if (!objetivoId) return [];
    return AG.DB.donde('calificaciones', function (c) {
      return !!c && c.tipo === tipo && c.objetivoId === objetivoId;
    });
  }

  /** Todas las calificaciones que ha dejado este socio, de la más reciente. */
  function misCalificaciones(socioId) {
    var lista = AG.DB.donde('calificaciones', function (c) {
      return !!c && c.socioId === socioId;
    });
    return U.ordenar(lista, 'fecha', 'desc');
  }

  /** La calificación que este socio dejó este mes sobre ese objetivo. */
  function calificacionDelMes(socioId, tipo, objetivoId, mes) {
    var lista = AG.DB.donde('calificaciones', function (c) {
      return !!c && c.socioId === socioId && c.tipo === tipo &&
        c.objetivoId === objetivoId && U.mesDe(c.fecha) === mes;
    });
    if (!lista.length) return null;
    return U.ordenar(lista, 'fecha', 'desc')[0];
  }

  /** Promedio por categoría (solo las que tienen datos). */
  function promediosCategorias(lista, cats) {
    var salida = [], i, j;
    for (i = 0; i < cats.length; i++) {
      var valores = [];
      for (j = 0; j < lista.length; j++) {
        var detalle = lista[j] && lista[j].detalle;
        var v = detalle ? Number(detalle[cats[i].clave]) : NaN;
        if (isFinite(v) && v >= 1 && v <= 5) valores.push(v);
      }
      if (!valores.length) continue;
      salida.push({
        etiqueta: cats[i].etiqueta,
        valor: Math.round(U.promedio(valores) * 10) / 10
      });
    }
    return salida;
  }

  /** Color de la barra de distribución según la estrella. */
  function claseBarra(e) {
    if (e >= 4) return 'ok';
    if (e === 3) return 'warn';
    return 'error';
  }

  /* =============================================================
     3. Lectura y pintado de las estrellas editables
     ============================================================= */

  function nombreCampo(bloque, clave) {
    return estado.prefijo + '_' + bloque + '_' + clave;
  }

  /** Valor marcado dentro de un contenedor con estrellas editables. */
  function valorEstrellas(campo) {
    if (!campo || !campo.querySelector) return 0;
    var marcado = campo.querySelector('input[type="radio"]:checked');
    var v = marcado ? Number(marcado.value) : 0;
    return (isFinite(v) && v >= 1 && v <= 5) ? Math.round(v) : 0;
  }

  /** Bloque de estrellas editables con su eco numérico. */
  function campoEstrellas(bloque, cat, valor) {
    return '<div class="field cal-cat" data-cat="' + esc(cat.clave) + '" data-bloque="' + esc(bloque) + '">' +
      '<div class="row between wrap">' +
        '<span class="label m0">' + esc(cat.etiqueta) + '</span>' +
        '<span class="mini muted cal-progreso" data-eco>' +
          (valor ? valor + ' de 5' : 'Sin calificar') +
        '</span>' +
      '</div>' +
      U.estrellas(valor, { editable: true, name: nombreCampo(bloque, cat.clave), size: 30 }) +
      '<p class="help">' + esc(cat.ayuda) + '</p>' +
    '</div>';
  }

  /** Estrella general: se calcula sola pero se puede ajustar a mano. */
  function campoGeneral(bloque, valor, promedioAuto, manual) {
    return '<div class="field cal-general" data-general="' + esc(bloque) + '">' +
      '<div class="row between wrap">' +
        '<span class="label m0">' + ico('estrella', 15) + ' Calificación general</span>' +
        '<span class="mini muted cal-progreso" data-eco-general>' +
          esc(textoGeneral(valor, promedioAuto, manual)) +
        '</span>' +
      '</div>' +
      '<div class="row between wrap">' +
        '<span data-estrellas-general>' +
          U.estrellas(valor, { editable: true, name: nombreCampo(bloque, 'general'), size: 30 }) +
        '</span>' +
        '<button type="button" class="chip chip-sm" data-auto="' + esc(bloque) + '"' +
          (manual && promedioAuto ? '' : ' hidden') + '>' +
          ico('rayo', 13) + 'Usar el promedio' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function textoGeneral(valor, promedioAuto, manual) {
    if (!valor) return 'Califica las cuatro categorías';
    if (manual) return valor + ' de 5 · ajustada a mano';
    return valor + ' de 5 · promedio de las cuatro';
  }

  /* =============================================================
     4. Las dos tarjetas de captura
     ============================================================= */

  /**
   * Arma la configuración de los dos bloques calificables.
   * @returns {Array} [{ bloque, tipo, objetivoId, ... }]
   */
  function bloquesDe(socio) {
    var mes = U.mesActual();
    var salida = [];

    /* --- Coach --- */
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    if (coach && coach.rol !== 'coach') coach = null;

    salida.push({
      bloque: 'coach',
      tipo: 'coach',
      objetivoId: coach ? coach.id : '',
      disponible: !!coach,
      titulo: 'Califica a tu coach',
      nombre: coach ? U.nombreCompleto(coach) : 'Sin coach asignado',
      detalleNombre: coach ? (coach.especialidad || 'Entrenamiento general') : '',
      avatar: coach ? U.avatar(coach, 'lg') : '',
      cats: CATS_COACH,
      previa: coach ? calificacionDelMes(socio.id, 'coach', coach.id, mes) : null,
      mensajeVacio: 'Todavía no tienes un coach asignado. En cuanto dirección te asigne uno, podrás calificar su atención, su conocimiento, su puntualidad y su motivación desde aquí.',
      iconoVacio: 'coach'
    });

    /* --- Gimnasio --- */
    var gymFalso = { nombre: nombreGym(), apellidos: '', id: 'gym', avatarColor: 'var(--rojo)' };
    salida.push({
      bloque: 'gimnasio',
      tipo: 'gimnasio',
      objetivoId: 'gym',
      disponible: true,
      titulo: 'Califica el gimnasio',
      nombre: nombreGym(),
      detalleNombre: lemaGym(),
      avatar: U.avatar(gymFalso, 'lg'),
      cats: CATS_GYM,
      previa: calificacionDelMes(socio.id, 'gimnasio', 'gym', mes),
      mensajeVacio: '',
      iconoVacio: 'escudo'
    });

    return salida;
  }

  /** ¿La general guardada difiere del promedio de las cuatro? */
  function generalEsManual(previa, cats) {
    if (!previa) return false;
    var detalle = previa.detalle || {};
    var suma = 0, cuenta = 0, i;
    for (i = 0; i < cats.length; i++) {
      var v = Number(detalle[cats[i].clave]);
      if (isFinite(v) && v >= 1 && v <= 5) { suma += v; cuenta++; }
    }
    if (!cuenta) return false;
    return Math.round(suma / cuenta) !== estrellasDe(previa);
  }

  function tarjetaFormulario(cfg) {
    var previa = cfg.previa;
    var detalle = (previa && previa.detalle) ? previa.detalle : {};

    var html = '<div class="card">' +
      '<div class="card-head">' +
        '<div class="persona">' +
          (cfg.avatar || '<div class="avatar avatar-lg">?</div>') +
          '<div class="persona-txt">' +
            '<b>' + esc(cfg.nombre) + '</b>' +
            '<span class="mini muted">' + esc(cfg.detalleNombre || cfg.titulo) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-accion">' + resumenObjetivo(cfg) + '</div>' +
      '</div>';

    if (!cfg.disponible) {
      html += '<div class="card-body">' + vacio(cfg.mensajeVacio, cfg.iconoVacio) + '</div>';
      return html + '</div>';
    }

    html += '<div class="card-body stack" data-form="' + esc(cfg.bloque) + '">';

    html += '<div class="aviso ' + (previa ? 'aviso-info' : 'aviso-rojo') + '">' +
      ico(previa ? 'info' : 'estrella', 18) +
      '<span>' + (previa
        ? 'Ya calificaste en <b>' + esc(U.nombreMes(U.mesActual())) + '</b>. Puedes ajustar lo que quieras: se guardará sobre tu calificación anterior.'
        : 'Califica ' + (cfg.bloque === 'coach' ? 'a tu coach' : 'al gimnasio') + ' por <b>' + esc(U.nombreMes(U.mesActual())) + '</b>. Solo se registra una calificación al mes.') +
      '</span></div>';

    /* Las cuatro categorías */
    var i, valores = [], suma = 0, cuenta = 0;
    for (i = 0; i < cfg.cats.length; i++) {
      var v = Number(detalle[cfg.cats[i].clave]);
      if (!isFinite(v) || v < 1 || v > 5) v = 0;
      v = Math.round(v);
      valores.push(v);
      if (v) { suma += v; cuenta++; }
      html += campoEstrellas(cfg.bloque, cfg.cats[i], v);
    }

    var promedioAuto = cuenta ? Math.round(suma / cuenta) : 0;
    var manual = generalEsManual(previa, cfg.cats);
    var general = previa ? estrellasDe(previa) : promedioAuto;
    estado.manual[cfg.bloque] = manual;

    html += campoGeneral(cfg.bloque, general, promedioAuto, manual);

    /* Comentario */
    var idTexto = estado.prefijo + '_' + cfg.bloque + '_txt';
    var comentario = previa ? String(previa.comentario || '') : '';
    html += '<div class="field">' +
      '<label class="label" for="' + idTexto + '">Comentario (opcional)</label>' +
      '<textarea class="textarea" id="' + idTexto + '" rows="4" maxlength="' + MAX_COMENTARIO +
        '" data-comentario="' + esc(cfg.bloque) + '" placeholder="' +
        esc(cfg.bloque === 'coach'
          ? 'Cuéntanos qué te ayuda de tu coach y qué podría mejorar.'
          : 'Cuéntanos qué te gusta del gimnasio y qué se puede mejorar.') +
        '">' + esc(comentario) + '</textarea>' +
      '<p class="help"><span data-contador="' + esc(cfg.bloque) + '">' + comentario.length + '</span> de ' +
        MAX_COMENTARIO + ' caracteres.</p>' +
    '</div>';

    html += '</div>';

    /* Pie con el estado y el botón */
    html += '<div class="card-foot">' +
      '<span class="mini muted cal-progreso" data-estado="' + esc(cfg.bloque) + '">' +
        esc(cuenta + ' de ' + cfg.cats.length + ' categorías calificadas') +
      '</span>' +
      '<button type="button" class="btn btn-primary" data-guardar="' + esc(cfg.bloque) + '">' +
        ico('check', 16) + (previa ? 'Actualizar mi calificación' : 'Enviar mi calificación') +
      '</button>' +
    '</div>';

    return html + '</div>';
  }

  /** Promedio actual del objetivo, para la esquina de la tarjeta. */
  function resumenObjetivo(cfg) {
    if (!cfg.disponible) {
      return '<span class="mini muted">Sin promedio</span>';
    }
    var res = Calc.promedioCalificacion(listaDe(cfg.tipo, cfg.objetivoId));
    if (!res.total) {
      return '<span class="row row-sm nowrap">' + U.estrellas(0, { size: 15 }) +
        '<span class="mini muted">Sin reseñas todavía</span></span>';
    }
    return '<span class="row row-sm nowrap" title="Promedio de todas las reseñas">' +
      U.estrellas(res.promedio, { size: 16 }) +
      '<b class="nums">' + esc(U.num(res.promedio, 1)) + '</b>' +
      '<span class="mini muted">(' + res.total + (res.total === 1 ? ' reseña' : ' reseñas') + ')</span>' +
      '</span>';
  }

  /* =============================================================
     5. Mis calificaciones anteriores
     ============================================================= */

  /** A quién iba dirigida una calificación. */
  function destinoDe(cal) {
    if (cal.tipo !== 'coach') return nombreGym();
    var coach = AG.DB.usuario(cal.objetivoId);
    return coach ? U.nombreCompleto(coach) : 'Coach que ya no está en el gimnasio';
  }

  function chipsDetalle(cal) {
    var cats = cal.tipo === 'coach' ? CATS_COACH : CATS_GYM;
    var detalle = cal.detalle || {};
    var html = '', i;
    for (i = 0; i < cats.length; i++) {
      var v = Number(detalle[cats[i].clave]);
      if (!isFinite(v) || v < 1 || v > 5) continue;
      html += '<span class="chip chip-sm">' + esc(cats[i].etiqueta) + ' · ' + Math.round(v) + ' ★</span>';
    }
    return html ? '<div class="chips mt-sm">' + html + '</div>' : '';
  }

  function miCalificacionHTML(cal) {
    var estrellas = estrellasDe(cal);
    var comentario = String(cal.comentario || '').trim();

    var html = '<article class="cal-item">';

    html += '<div class="row between wrap">' +
      '<div class="stack-sm">' +
        '<b>' + esc(destinoDe(cal)) + '</b>' +
        '<span class="mini muted">' +
          esc(U.fecha(cal.fecha, 'corto')) + ' · ' + esc(U.fechaRelativa(cal.fecha)) +
          ' · ' + esc(cal.tipo === 'coach' ? 'Mi coach' : 'Gimnasio') +
        '</span>' +
      '</div>' +
      '<div class="row row-sm nowrap">' + U.estrellas(estrellas, { size: 15 }) +
        '<b class="nums">' + estrellas + '</b></div>' +
    '</div>';

    if (comentario) {
      html += '<p class="mt-sm">' + esc(comentario) + '</p>';
    } else {
      html += '<p class="mini muted mt-sm">La dejaste sin comentario escrito.</p>';
    }

    html += chipsDetalle(cal);

    if (tieneRespuesta(cal)) {
      var autor = AG.DB.usuario(cal.respuesta.por);
      html += '<div class="cal-respuesta">' +
        '<span class="mini bold txt-rojo">' + ico('chat', 13) + ' Respuesta de dirección</span>' +
        '<p class="mt-sm">' + esc(cal.respuesta.texto) + '</p>' +
        '<span class="mini muted">' +
          esc(autor ? U.nombreCompleto(autor) : 'Dirección') +
          (cal.respuesta.fecha ? ' · ' + esc(U.fecha(cal.respuesta.fecha, 'corto')) : '') +
        '</span>' +
      '</div>';
    }

    return html + '</article>';
  }

  function tarjetaHistorial(socio) {
    var lista = misCalificaciones(socio.id);

    var html = '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<h3 class="card-title">' + ico('historial', 18) + ' Mis calificaciones anteriores</h3>' +
          '<p class="card-sub">Todo lo que has calificado, con la respuesta de dirección cuando la hay</p>' +
        '</div>' +
        '<div class="card-accion"><span class="pill">' + lista.length +
          (lista.length === 1 ? ' calificación' : ' calificaciones') + '</span></div>' +
      '</div>' +
      '<div class="card-body">';

    if (!lista.length) {
      html += vacio('Todavía no has calificado nada. Tu primera calificación aparecerá aquí junto con la respuesta de dirección.', 'historial');
      return html + '</div></div>';
    }

    var visibles = lista.slice(0, estado.limite);
    var i;
    for (i = 0; i < visibles.length; i++) {
      html += miCalificacionHTML(visibles[i]);
    }

    if (lista.length > visibles.length) {
      html += '<div class="row center mt">' +
        '<button type="button" class="btn btn-outline" data-mas-historial>Mostrar ' +
          Math.min(PAGINA_HISTORIAL, lista.length - visibles.length) + ' más</button>' +
        '</div>';
    }

    return html + '</div></div>';
  }

  /* =============================================================
     6. Lo que opinan los socios (resumen público y anónimo)
     ============================================================= */

  function bloqueGlobal(res) {
    if (!res.total) return vacio('Todavía no hay reseñas registradas.', 'estrella');
    return '<div class="row wrap" style="gap:16px;align-items:center">' +
      '<div class="cal-num">' + esc(U.num(res.promedio, 1)) + '</div>' +
      '<div class="stack-sm">' +
        U.estrellas(res.promedio, { size: 20 }) +
        '<span class="mini muted">' + res.total +
          (res.total === 1 ? ' reseña de socios' : ' reseñas de socios') + '</span>' +
      '</div>' +
    '</div>';
  }

  function bloqueDistribucion(res) {
    if (!res.total) return '';
    var html = '', e;
    for (e = 5; e >= 1; e--) {
      var n = res.distribucion[e] || 0;
      var pct = res.total ? (n / res.total) * 100 : 0;
      html += '<div class="cal-fila">' +
        '<span class="mini bold nowrap">' + e + ' ★</span>' +
        '<div class="bar"><span class="bar-fill ' + claseBarra(e) +
          '" style="width:' + (Math.round(pct * 10) / 10) + '%"></span></div>' +
        '<span class="mini muted nowrap">' + esc(U.pct(pct, 0)) + ' · ' + n + '</span>' +
      '</div>';
    }
    return html;
  }

  function chipsPromedios(lista, cats) {
    var proms = promediosCategorias(lista, cats);
    if (!proms.length) return '<span class="mini muted">Sin detalle por categoría todavía.</span>';
    var html = '', i;
    for (i = 0; i < proms.length; i++) {
      html += '<span class="chip chip-sm">' + esc(proms[i].etiqueta) + ' · ' +
        esc(U.num(proms[i].valor, 1)) + ' ★</span>';
    }
    return '<div class="chips">' + html + '</div>';
  }

  /** Reseña anónima: solo iniciales, nunca el nombre completo. */
  function resenaAnonimaHTML(cal, socioActualId) {
    var autor = AG.DB.usuario(cal.socioId);
    var iniciales = autor ? U.iniciales(autor) : '?';
    var color = U.colorDe(String(cal.socioId || cal.id));
    var esMia = !!(socioActualId && cal.socioId === socioActualId);

    return '<article class="cal-item">' +
      '<div class="row between wrap">' +
        '<div class="row row-sm">' +
          '<span class="cal-anonimo" style="background:' + esc(color) + '" title="Socio del gimnasio" aria-hidden="true">' +
            esc(iniciales) + '</span>' +
          '<div class="stack-sm">' +
            '<b>Socio ' + esc(iniciales) + (esMia ? ' · tu reseña' : '') + '</b>' +
            '<span class="mini muted">' + esc(U.fechaRelativa(cal.fecha)) + ' · sobre ' +
              esc(cal.tipo === 'coach' ? 'el coach' : 'el gimnasio') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="row row-sm nowrap">' + U.estrellas(estrellasDe(cal), { size: 14 }) + '</div>' +
      '</div>' +
      '<p class="mt-sm">' + esc(String(cal.comentario || '').trim()) + '</p>' +
    '</article>';
  }

  function tarjetaPublica(socio) {
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    if (coach && coach.rol !== 'coach') coach = null;

    var delGym = listaDe('gimnasio', 'gym');
    var delCoach = coach ? listaDe('coach', coach.id) : [];

    var resGym = Calc.promedioCalificacion(delGym);
    var resCoach = Calc.promedioCalificacion(delCoach);

    var html = '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<h3 class="card-title">' + ico('socios', 18) + ' Lo que opinan los socios</h3>' +
          '<p class="card-sub">Resumen público y anónimo de las reseñas del gimnasio y de tu coach</p>' +
        '</div>' +
      '</div>' +
      '<div class="card-body stack">';

    html += '<div class="grid g2">';

    /* Gimnasio */
    html += '<div class="stack-sm">' +
      '<span class="label m0">' + esc(nombreGym()) + '</span>' +
      bloqueGlobal(resGym) +
      (resGym.total ? '<div class="mt-sm">' + bloqueDistribucion(resGym) + '</div>' : '') +
      (resGym.total ? chipsPromedios(delGym, CATS_GYM) : '') +
    '</div>';

    /* Coach */
    html += '<div class="stack-sm">' +
      '<span class="label m0">' + esc(coach ? U.nombreCompleto(coach) : 'Tu coach') + '</span>' +
      (coach
        ? bloqueGlobal(resCoach) +
          (resCoach.total ? '<div class="mt-sm">' + bloqueDistribucion(resCoach) + '</div>' : '') +
          (resCoach.total ? chipsPromedios(delCoach, CATS_COACH) : '')
        : vacio('Cuando tengas coach asignado verás aquí su promedio público.', 'coach')) +
    '</div>';

    html += '</div>';

    /* Reseñas recientes anonimizadas */
    var candidatas = [], i;
    var todas = delGym.concat(delCoach);
    for (i = 0; i < todas.length; i++) {
      if (String(todas[i].comentario || '').trim()) candidatas.push(todas[i]);
    }
    candidatas = U.ordenar(candidatas, 'fecha', 'desc').slice(0, RESENAS_PUBLICAS);

    html += '<div class="stack-sm">' +
      '<span class="label m0">Reseñas recientes</span>';

    if (!candidatas.length) {
      html += vacio('Todavía nadie ha dejado un comentario escrito. Puedes ser el primero.', 'chat');
    } else {
      for (i = 0; i < candidatas.length; i++) {
        html += resenaAnonimaHTML(candidatas[i], socio.id);
      }
      html += '<p class="mini muted">Aquí solo se muestran las iniciales de quien escribió cada reseña.</p>';
    }

    html += '</div>';

    return html + '</div></div>';
  }

  /* =============================================================
     7. Guardado
     ============================================================= */

  function directores() {
    return AG.DB.donde('usuarios', function (u) {
      return !!u && u.rol === 'director' && u.activo !== false;
    });
  }

  /** Avisa a dirección (y al coach cuando la reseña es suya). */
  function avisar(cfg, socio, general, comentario, esNueva) {
    var destino = cfg.tipo === 'coach' ? U.nombreCompleto(AG.DB.usuario(cfg.objetivoId)) : nombreGym();
    var resumen = U.nombreCompleto(socio) + ' calificó a ' + destino + ' con ' + general +
      (general === 1 ? ' estrella' : ' estrellas') +
      (comentario ? ': “' + U.truncar(comentario, 160) + '”' : '.');

    var lista = directores(), i;
    for (i = 0; i < lista.length; i++) {
      AG.DB.notificar(lista[i].id, {
        titulo: esNueva ? 'Nueva calificación de un socio' : 'Un socio actualizó su calificación',
        cuerpo: resumen,
        tipo: 'aviso',
        link: '#/director/calificaciones'
      });
    }

    if (cfg.tipo === 'coach') {
      var coach = AG.DB.usuario(cfg.objetivoId);
      if (coach && coach.rol === 'coach') {
        AG.DB.notificar(coach.id, {
          titulo: esNueva ? 'Nueva calificación de un socio' : 'Un socio ajustó su calificación',
          cuerpo: U.nombreCompleto(socio) + ' te calificó con ' + general +
            (general === 1 ? ' estrella.' : ' estrellas.'),
          tipo: 'aviso',
          link: '#/coach/calificaciones'
        });
      }
    }
  }

  function modalGracias(cfg, general, esNueva) {
    var destino = cfg.tipo === 'coach' ? cfg.nombre : nombreGym();
    U.modal({
      titulo: esNueva ? '¡Gracias por calificar!' : 'Calificación actualizada',
      ancho: 'md',
      cuerpo: '<div class="stack cal-centro">' +
        '<div class="center">' + U.estrellas(general, { size: 30 }) + '</div>' +
        '<p><b>' + esc(destino) + '</b> quedó con <b>' + general +
          (general === 1 ? ' estrella' : ' estrellas') + '</b> de tu parte en ' +
          esc(U.nombreMes(U.mesActual())) + '.</p>' +
        '<p class="mini muted">Dirección ya recibió tu opinión' +
          (cfg.tipo === 'coach' ? ' y tu coach también.' : '.') +
          ' Si dejaste un comentario, te responderán por aquí mismo.</p>' +
      '</div>',
      acciones: [
        { texto: 'Listo', clase: 'btn-primary', onClick: function (api) { api.cerrar(); } }
      ]
    });
  }

  /**
   * Valida y guarda la calificación de un bloque.
   * @returns {Boolean} true si se guardó
   */
  function guardar(caja, socio, bloqueClave) {
    /* Control de acceso real: solo se guarda a nombre del socio de la sesión. */
    var sesion = AG.Auth.actual();
    if (!sesion || sesion.rol !== 'socio' || sesion.id !== socio.id) {
      U.toast('Tu sesión cambió. Vuelve a entrar para calificar.', 'warn');
      return false;
    }

    var cfgs = bloquesDe(socio), cfg = null, i;
    for (i = 0; i < cfgs.length; i++) {
      if (cfgs[i].bloque === bloqueClave) cfg = cfgs[i];
    }

    if (!cfg || !cfg.disponible) {
      U.toast('Esta calificación no está disponible en este momento.', 'warn');
      return false;
    }
    if (cfg.tipo === 'coach' && !AG.DB.usuario(cfg.objetivoId)) {
      U.toast('Tu coach ya no está registrado. Avisa a dirección.', 'error');
      return false;
    }

    var detalle = {}, suma = 0, cuenta = 0;
    for (i = 0; i < cfg.cats.length; i++) {
      var campo = caja.querySelector('[data-bloque="' + cfg.bloque + '"][data-cat="' + cfg.cats[i].clave + '"]');
      var v = valorEstrellas(campo);
      if (!v) {
        U.toast('Califica ' + cfg.cats[i].etiqueta.toLowerCase() + ' antes de enviar.', 'warn');
        enfocar(campo);
        return false;
      }
      detalle[cfg.cats[i].clave] = v;
      suma += v;
      cuenta++;
    }

    var general = valorEstrellas(caja.querySelector('[data-general="' + cfg.bloque + '"]'));
    if (!general) general = Math.round(suma / cuenta);
    if (general < 1) general = 1;
    if (general > 5) general = 5;

    var area = caja.querySelector('[data-comentario="' + cfg.bloque + '"]');
    var comentario = area ? String(area.value || '').trim().slice(0, MAX_COMENTARIO) : '';

    var datos = {
      socioId: socio.id,
      tipo: cfg.tipo,
      objetivoId: cfg.objetivoId,
      estrellas: general,
      comentario: comentario,
      fecha: U.hoy(),
      detalle: detalle,
      respuesta: cfg.previa ? (cfg.previa.respuesta || null) : null
    };

    var guardada;
    if (cfg.previa) {
      guardada = AG.DB.actualizar('calificaciones', cfg.previa.id, datos);
      if (!guardada) {
        U.toast('No pudimos actualizar tu calificación. Intenta de nuevo.', 'error');
        return false;
      }
      U.toast('Actualizamos tu calificación de este mes.', 'ok');
    } else {
      guardada = AG.DB.insertar('calificaciones', datos);
      if (!guardada) {
        U.toast('No pudimos guardar tu calificación. Intenta de nuevo.', 'error');
        return false;
      }
      U.toast('¡Gracias! Registramos tu calificación.', 'ok');
    }

    avisar(cfg, socio, general, comentario, !cfg.previa);
    modalGracias(cfg, general, !cfg.previa);
    return true;
  }

  function enfocar(campo) {
    if (!campo || !campo.querySelector) return;
    var radio = campo.querySelector('input[type="radio"]');
    if (!radio) return;
    try { radio.focus(); } catch (e) { /* sin foco disponible */ }
  }

  /* =============================================================
     8. Refresco de la interfaz en vivo
     ============================================================= */

  /** Recalcula ecos, general y contador de un bloque. */
  function refrescarBloque(caja, bloqueClave, cats) {
    var suma = 0, cuenta = 0, i;

    for (i = 0; i < cats.length; i++) {
      var campo = caja.querySelector('[data-bloque="' + bloqueClave + '"][data-cat="' + cats[i].clave + '"]');
      if (!campo) continue;
      var v = valorEstrellas(campo);
      var eco = campo.querySelector('[data-eco]');
      if (eco) eco.textContent = v ? v + ' de 5' : 'Sin calificar';
      if (v) { suma += v; cuenta++; }
    }

    var promedioAuto = cuenta ? Math.round(suma / cuenta) : 0;
    var cajaGeneral = caja.querySelector('[data-general="' + bloqueClave + '"]');

    if (cajaGeneral) {
      var manual = !!estado.manual[bloqueClave];
      var actual = valorEstrellas(cajaGeneral);

      if (!manual && actual !== promedioAuto) {
        var host = cajaGeneral.querySelector('[data-estrellas-general]');
        if (host) {
          host.innerHTML = U.estrellas(promedioAuto, {
            editable: true,
            name: nombreCampo(bloqueClave, 'general'),
            size: 30
          });
        }
        actual = promedioAuto;
      }

      var ecoGeneral = cajaGeneral.querySelector('[data-eco-general]');
      if (ecoGeneral) ecoGeneral.textContent = textoGeneral(actual, promedioAuto, manual);

      var botonAuto = cajaGeneral.querySelector('[data-auto]');
      if (botonAuto) botonAuto.hidden = !(manual && promedioAuto && actual !== promedioAuto);
    }

    var estadoTxt = caja.querySelector('[data-estado="' + bloqueClave + '"]');
    if (estadoTxt) {
      estadoTxt.textContent = cuenta === cats.length
        ? 'Listo para enviar'
        : cuenta + ' de ' + cats.length + ' categorías calificadas';
    }
  }

  /** Etiquetas accesibles para cada grupo de estrellas. */
  function mejorarAccesibilidad(caja) {
    var campos = U.$$('[data-cat]', caja), i;
    for (i = 0; i < campos.length; i++) {
      var clave = campos[i].getAttribute('data-cat');
      var bloque = campos[i].getAttribute('data-bloque');
      var cats = bloque === 'coach' ? CATS_COACH : CATS_GYM;
      var etiqueta = clave, j;
      for (j = 0; j < cats.length; j++) {
        if (cats[j].clave === clave) etiqueta = cats[j].etiqueta;
      }
      var grupo = campos[i].querySelector('.stars-input');
      if (grupo) grupo.setAttribute('aria-label', 'Califica ' + etiqueta + ': de 1 a 5 estrellas');
    }

    var generales = U.$$('[data-general]', caja);
    for (i = 0; i < generales.length; i++) {
      var g = generales[i].querySelector('.stars-input');
      if (g) g.setAttribute('aria-label', 'Calificación general: de 1 a 5 estrellas');
    }
  }

  /* =============================================================
     9. Armado de la pantalla
     ============================================================= */

  function encabezado(socio) {
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    if (coach && coach.rol !== 'coach') coach = null;

    var resGym = Calc.promedioCalificacion(listaDe('gimnasio', 'gym'));
    var resCoach = coach ? Calc.promedioCalificacion(listaDe('coach', coach.id)) : { total: 0, promedio: 0 };

    return '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title">Calificar</h1>' +
        '<p class="page-sub">Tu opinión de cada mes es lo que hace mejor a tu coach y al gimnasio.</p>' +
      '</div>' +
      '<div class="page-acciones">' +
        '<span class="pill">' + ico('escudo', 14) + esc(nombreGym()) + ': ' +
          (resGym.total ? esc(U.num(resGym.promedio, 1)) + ' de 5' : 'sin reseñas') + '</span>' +
        '<span class="pill">' + ico('coach', 14) + 'Mi coach: ' +
          (resCoach.total ? esc(U.num(resCoach.promedio, 1)) + ' de 5' : 'sin reseñas') + '</span>' +
      '</div>' +
    '</div>';
  }

  function notaPrivacidad() {
    return '<div class="aviso aviso-info">' + ico('candado', 18) +
      '<span>El gimnasio ve quién califica para poder darle seguimiento a tu comentario; entre socios las reseñas se muestran solo con iniciales.</span>' +
      '</div>';
  }

  function contenido(socio) {
    var cfgs = bloquesDe(socio);
    var html = '';

    html += encabezado(socio);
    html += '<div class="grid g2">' + tarjetaFormulario(cfgs[0]) + tarjetaFormulario(cfgs[1]) + '</div>';
    html += notaPrivacidad();
    html += tarjetaHistorial(socio);
    html += tarjetaPublica(socio);

    return html;
  }

  /* =============================================================
     10. Vista
     ============================================================= */

  var Vista = {};

  Vista.render = function (ctx) {
    var usuario = (ctx && ctx.usuario) ? ctx.usuario : AG.Auth.actual();

    if (!usuario) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('Vuelve a iniciar sesión para calificar.', 'usuario') +
        '</div></div></div>';
    }

    /* Control de acceso real: aquí solo entra el socio, y solo a lo suyo. */
    if (usuario.rol !== 'socio') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('Esta sección es exclusiva de los socios. Dirección y coaches consultan las reseñas desde su propia pantalla de calificaciones.', 'candado') +
        '</div></div></div>';
    }

    var socio = usuario;

    /* Estado limpio en cada entrada a la pantalla. */
    estado.prefijo = U.uid('sc');
    estado.manual = { coach: false, gimnasio: false };
    estado.limite = PAGINA_HISTORIAL;

    return {
      html: '<div class="page cal-vista" data-cal-raiz>' + contenido(socio) + '</div>',
      listo: function (root) {
        asegurarEstilos();

        var caja = root.querySelector('[data-cal-raiz]');
        if (!caja) return;

        mejorarAccesibilidad(caja);

        /** Vuelve a pintar toda la pantalla con los datos frescos. */
        function repintar() {
          estado.prefijo = U.uid('sc');
          caja.innerHTML = contenido(socio);
          mejorarAccesibilidad(caja);
        }

        function catsDeBloque(bloque) {
          return bloque === 'coach' ? CATS_COACH : CATS_GYM;
        }

        /* --- Estrellas: categorías y general --- */
        U.delegar(caja, 'change', 'input[type="radio"]', function (e, el) {
          var campoCat = el.closest('[data-cat]');
          if (campoCat) {
            var bloque = campoCat.getAttribute('data-bloque');
            refrescarBloque(caja, bloque, catsDeBloque(bloque));
            return;
          }
          var campoGen = el.closest('[data-general]');
          if (campoGen) {
            var bloqueGen = campoGen.getAttribute('data-general');
            estado.manual[bloqueGen] = true;
            refrescarBloque(caja, bloqueGen, catsDeBloque(bloqueGen));
          }
        });

        /* --- Volver al promedio automático --- */
        U.delegar(caja, 'click', '[data-auto]', function (e, el) {
          var bloque = el.getAttribute('data-auto');
          if (!bloque) return;
          estado.manual[bloque] = false;
          refrescarBloque(caja, bloque, catsDeBloque(bloque));
          U.toast('La calificación general vuelve al promedio de las cuatro.', 'info');
        });

        /* --- Contador del comentario --- */
        U.delegar(caja, 'input', '[data-comentario]', function (e, el) {
          var bloque = el.getAttribute('data-comentario');
          var contador = caja.querySelector('[data-contador="' + bloque + '"]');
          if (contador) contador.textContent = String(el.value.length);
        });

        /* --- Guardar --- */
        U.delegar(caja, 'click', '[data-guardar]', function (e, el) {
          var bloque = el.getAttribute('data-guardar');
          if (!bloque) return;
          el.disabled = true;
          var ok = false;
          try {
            ok = guardar(caja, socio, bloque);
          } catch (err) {
            U.toast('Ocurrió un problema al guardar tu calificación.', 'error');
            ok = false;
          }
          if (ok) repintar();
          else el.disabled = false;
        });

        /* --- Más historial --- */
        U.delegar(caja, 'click', '[data-mas-historial]', function () {
          estado.limite += PAGINA_HISTORIAL;
          repintar();
        });
      }
    };
  };

  AG.Views.SocioCalificar = Vista;

  AG.Router.registrar({
    path: 'socio/calificar',
    roles: ['socio'],
    titulo: 'Calificar',
    nav: { etiqueta: 'Calificar', icono: 'estrella', grupo: 'Mi cuenta', orden: 2 },
    render: Vista.render
  });

})(window.AG);
