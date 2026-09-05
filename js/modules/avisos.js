/* =============================================================
   ALLIANCE GYM — AG.Mod.Avisos
   -------------------------------------------------------------
   El tablón de anuncios del gimnasio. La dirección publica un
   aviso, el sistema deja una notificación a cada destinatario y
   después mide cuánta gente lo leyó.

   Ruta: 'director/avisos' (solo dirección publica).

   API compartida (la usan otras pantallas):
     AG.Mod.Avisos.paraUsuario(usuario)        -> array de avisos vigentes
     AG.Mod.Avisos.marcarLeido(avisoId, usuId) -> Boolean
     AG.Mod.Avisos.tarjetas(usuario, limite)   -> string HTML para los paneles

   Reglas: JavaScript clásico sin módulos, todo escapado con
   AG.Utils.esc(), nada de alert/confirm/prompt, nada de
   localStorage directo y ningún listado sin su estado vacío
   escrito en español.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* A quién puede dirigirse un aviso (campo 'para' del modelo). */
  var DESTINOS = [
    {
      id: 'todos',
      etiqueta: 'Todo el gimnasio',
      corto: 'Todos',
      icono: 'socios',
      pista: 'Socios y coaches'
    },
    {
      id: 'socios',
      etiqueta: 'Solo socios',
      corto: 'Socios',
      icono: 'usuario',
      pista: 'Únicamente los socios'
    },
    {
      id: 'coaches',
      etiqueta: 'Solo coaches',
      corto: 'Coaches',
      icono: 'coach',
      pista: 'Únicamente el equipo técnico'
    }
  ];

  var PRIORIDADES = [
    {
      id: 'normal',
      etiqueta: 'Normal',
      icono: 'info',
      pista: 'Informativo, sin urgencia'
    },
    {
      id: 'alta',
      etiqueta: 'Alta',
      icono: 'alerta',
      pista: 'Se marca en rojo en todos los paneles'
    }
  ];

  /* Plantillas ya redactadas: la dirección solo ajusta fechas y publica. */
  var PLANTILLAS = [
    {
      clave: 'mantenimiento',
      nombre: 'Mantenimiento',
      icono: 'config',
      resumen: 'Cierre parcial de un área por servicio preventivo',
      titulo: 'Mantenimiento programado en el área de pesas',
      para: 'todos',
      prioridad: 'normal',
      cuerpo: 'Estimada comunidad Alliance:\n\n' +
        'El próximo sábado realizaremos el mantenimiento preventivo del área de pesas, de 10:00 a 14:00 h. ' +
        'Durante ese lapso el acceso a esa zona estará restringido; el resto de las instalaciones opera con normalidad.\n\n' +
        'Te sugerimos adelantar tu entrenamiento de pierna o pedir a tu coach una variante con peso corporal para ese día. ' +
        'Gracias por tu comprensión: el equipo queda revisado y seguro para todos.'
    },
    {
      clave: 'horario',
      nombre: 'Cambio de horario',
      icono: 'reloj',
      resumen: 'Nuevo horario de servicio del gimnasio',
      titulo: 'Nuevo horario de servicio a partir del próximo lunes',
      para: 'todos',
      prioridad: 'alta',
      cuerpo: 'Estimada comunidad Alliance:\n\n' +
        'A partir del próximo lunes ajustamos nuestro horario de servicio:\n\n' +
        '• Lunes a viernes: 5:00 a 23:00 h\n' +
        '• Sábado: 7:00 a 17:00 h\n' +
        '• Domingo: 8:00 a 14:00 h\n\n' +
        'Las clases grupales conservan su hora habitual. Revisa tu panel de clases o la cartelera de recepción ' +
        'para confirmar la sesión que te toca.'
    },
    {
      clave: 'promocion',
      nombre: 'Promoción',
      icono: 'dinero',
      resumen: 'Campaña de renovación o de referidos',
      titulo: 'Promoción del mes: trae a un amigo a entrenar',
      para: 'socios',
      prioridad: 'normal',
      cuerpo: 'Estimado socio:\n\n' +
        'Durante este mes, al renovar tu membresía puedes inscribir a un acompañante con 50% de descuento ' +
        'en su primera mensualidad. La promoción aplica para inscripciones nuevas y se activa el mismo día ' +
        'del pago en recepción.\n\n' +
        'Pregunta por los detalles en recepción o con tu coach. Entrenar acompañado sostiene mejor la constancia.'
    },
    {
      clave: 'festivo',
      nombre: 'Día festivo',
      icono: 'calendario',
      resumen: 'Horario especial y clases reprogramadas',
      titulo: 'Horario especial por día festivo',
      para: 'todos',
      prioridad: 'alta',
      cuerpo: 'Estimada comunidad Alliance:\n\n' +
        'Por el día festivo, el gimnasio abrirá con horario especial de 8:00 a 14:00 h. ' +
        'Las clases grupales de la tarde quedan canceladas y se reprograman para la semana siguiente.\n\n' +
        'Si tienes una medición agendada o una sesión con tu coach ese día, te contactaremos para reubicarla. ' +
        'Gracias por tu comprensión.'
    },
    {
      clave: 'equipo',
      nombre: 'Equipo nuevo',
      icono: 'pesa',
      resumen: 'Estreno de máquinas o material',
      titulo: 'Ya está disponible el equipo nuevo del área funcional',
      para: 'todos',
      prioridad: 'normal',
      cuerpo: 'Estimada comunidad Alliance:\n\n' +
        'Desde hoy puedes usar el equipo nuevo del área funcional: rack de sentadilla, juego de mancuernas ' +
        'hasta 50 kg y dos bicicletas de asalto.\n\n' +
        'Antes de estrenarlo, pide a tu coach una revisión de técnica: con eso aprovechas mejor cada serie ' +
        'y entrenas seguro. Recuerda limpiar el equipo al terminar y devolver el material a su lugar.'
    }
  ];

  /* Estado vivo de la pantalla (sobrevive a los repintados del router). */
  var estado = {
    destino: '',
    prioridad: '',
    busqueda: ''
  };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) { U.toast(mensaje, tipo || 'info'); }

  /* Texto de varias líneas listo para HTML (escapado y con saltos). */
  function parrafos(texto) {
    return esc(texto === null || texto === undefined ? '' : texto)
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>');
  }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function esDirector(usuario) {
    return !!usuario && usuario.rol === 'director';
  }

  /* 'todos' | 'socios' | 'coaches' — cualquier otra cosa se trata como 'todos'. */
  function normalizarPara(valor) {
    var v = String(valor === null || valor === undefined ? '' : valor).toLowerCase();
    if (v === 'socios' || v === 'socio') return 'socios';
    if (v === 'coaches' || v === 'coach') return 'coaches';
    return 'todos';
  }

  function normalizarPrioridad(valor) {
    return String(valor === null || valor === undefined ? '' : valor).toLowerCase() === 'alta' ? 'alta' : 'normal';
  }

  function destinoDe(para) {
    var id = normalizarPara(para);
    for (var i = 0; i < DESTINOS.length; i++) {
      if (DESTINOS[i].id === id) return DESTINOS[i];
    }
    return DESTINOS[0];
  }

  /* 'socio' / 'socios' / 'persona' / 'personas' según el destinatario. */
  function sustantivo(para, cantidad) {
    var uno = cantidad === 1;
    var id = normalizarPara(para);
    if (id === 'socios') return uno ? 'socio' : 'socios';
    if (id === 'coaches') return uno ? 'coach' : 'coaches';
    return uno ? 'persona' : 'personas';
  }

  /* Personas que deben recibir un aviso: nunca la dirección, nunca las bajas. */
  function destinatarios(para) {
    var id = normalizarPara(para);
    return AG.DB.donde('usuarios', function (u) {
      if (!u || !u.id) return false;
      if (u.rol !== 'socio' && u.rol !== 'coach') return false;
      if (u.activo === false) return false;
      if (u.rol === 'socio' && u.estado === 'baja') return false;
      if (id === 'socios') return u.rol === 'socio';
      if (id === 'coaches') return u.rol === 'coach';
      return true;
    });
  }

  /* Panel al que lleva la notificación de cada rol. */
  function enlaceDe(usuario) {
    if (usuario && usuario.rol === 'coach') return '#/coach/inicio';
    if (usuario && usuario.rol === 'socio') return '#/socio/inicio';
    return '#/director/avisos';
  }

  /* Lista de ids que ya leyeron (siempre un arreglo, nunca undefined). */
  function leidoPorDe(aviso) {
    return (aviso && Object.prototype.toString.call(aviso.leidoPor) === '[object Array]')
      ? aviso.leidoPor
      : [];
  }

  function yaLeyo(aviso, usuarioId) {
    if (!usuarioId) return false;
    return leidoPorDe(aviso).indexOf(usuarioId) >= 0;
  }

  /**
   * Cobertura de lectura de un aviso.
   * Solo cuentan las personas que HOY son destinatarias: si el aviso cambió
   * de público, las lecturas viejas no inflan el porcentaje.
   */
  function estadisticaLectura(aviso) {
    var gente = destinatarios(aviso ? aviso.para : 'todos');
    var marcados = leidoPorDe(aviso);
    var leidos = 0;
    var pendientes = [];

    for (var i = 0; i < gente.length; i++) {
      if (marcados.indexOf(gente[i].id) >= 0) leidos++;
      else pendientes.push(gente[i]);
    }

    return {
      total: gente.length,
      leidos: leidos,
      pendientes: pendientes,
      pct: gente.length ? Math.round((leidos * 100) / gente.length) : 0
    };
  }

  function claseLectura(pct) {
    if (pct >= 70) return 'ok';
    if (pct >= 35) return 'warn';
    return 'error';
  }

  /* Orden: más reciente primero; a igual fecha, lo publicado después. */
  function ordenarRecientes(lista) {
    return lista.map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) {
        var fx = String(x.a.fecha || '');
        var fy = String(y.a.fecha || '');
        if (fx !== fy) return fx < fy ? 1 : -1;
        return y.i - x.i;
      })
      .map(function (w) { return w.a; });
  }

  /* Orden para los paneles: primero la prioridad alta, luego lo más reciente. */
  function ordenarPorPrioridad(lista) {
    return lista.map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) {
        var px = normalizarPrioridad(x.a.prioridad) === 'alta' ? 0 : 1;
        var py = normalizarPrioridad(y.a.prioridad) === 'alta' ? 0 : 1;
        if (px !== py) return px - py;
        var fx = String(x.a.fecha || '');
        var fy = String(y.a.fecha || '');
        if (fx !== fy) return fx < fy ? 1 : -1;
        return y.i - x.i;
      })
      .map(function (w) { return w.a; });
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-avisos';

  function asegurarEstilos() {
    if (!document || document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.av-tarjeta{display:flex;flex-direction:column;gap:6px;width:100%;padding:12px 13px;' +
        'border:1px solid var(--borde);border-left:3px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);color:var(--texto-2);text-align:left;font:inherit;cursor:pointer;' +
        'transition:border-color var(--trans),transform var(--trans)}' +
      '.av-tarjeta:hover{border-color:var(--borde-2);transform:translateY(-1px)}' +
      '.av-tarjeta.no-leido{border-left-color:var(--rojo)}' +
      '.av-tarjeta.leido{opacity:.9}' +
      '.av-punto{width:8px;height:8px;border-radius:50%;background:var(--rojo);flex:0 0 auto}' +
      '.av-titulo{font-size:13.5px;font-weight:700;color:var(--texto);line-height:1.3;min-width:0;' +
        'overflow-wrap:anywhere}' +
      '.av-meta{display:block;font-size:11.5px;line-height:1.45;color:var(--texto-2)}' +
      '.av-cuerpo{display:block;font-size:12.5px;color:var(--texto-2);line-height:1.55;overflow-wrap:anywhere}' +
      '.av-preview{border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel);padding:12px}' +
      '.av-lectura{margin-top:10px;max-width:420px}' +
      '.av-plantilla{font:inherit;text-align:left;width:100%}' +
      '.av-acciones{margin-left:auto}' +
      '@media (max-width:560px){.av-acciones{margin-left:0;width:100%}' +
        '.av-lectura{max-width:none}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. API compartida con el resto del sistema
     ============================================================= */

  /**
   * Avisos que le corresponden a un usuario según su rol, ya ordenados
   * (prioridad alta primero y después lo más reciente).
   * Devuelve COPIAS con la marca `leido`, para no ensuciar la base.
   * @param {Object} usuario
   * @returns {Array}
   */
  function paraUsuario(usuario) {
    if (!usuario || !usuario.rol) return [];

    var rol = usuario.rol;
    var propios = AG.DB.donde('avisos', function (a) {
      if (!a || !a.id) return false;
      var para = normalizarPara(a.para);
      if (rol === 'director') return true;                 // dirección ve todo el tablón
      if (rol === 'coach') return para === 'todos' || para === 'coaches';
      if (rol === 'socio') return para === 'todos' || para === 'socios';
      return false;
    });

    var ordenados = ordenarPorPrioridad(propios);
    var salida = [];

    for (var i = 0; i < ordenados.length; i++) {
      var a = ordenados[i];
      salida.push({
        id: a.id,
        titulo: a.titulo || 'Aviso sin título',
        cuerpo: a.cuerpo || '',
        para: normalizarPara(a.para),
        autorId: a.autorId || '',
        fecha: a.fecha || '',
        prioridad: normalizarPrioridad(a.prioridad),
        leidoPor: leidoPorDe(a).slice(),
        leido: yaLeyo(a, usuario.id)
      });
    }
    return salida;
  }

  /**
   * Agrega el id del usuario a `leidoPor` y guarda.
   * @returns {Boolean} true si el aviso quedó marcado como leído
   */
  function marcarLeido(avisoId, usuarioId) {
    if (!avisoId || !usuarioId) return false;

    var aviso = AG.DB.buscar('avisos', avisoId);
    if (!aviso) return false;

    var actuales = leidoPorDe(aviso);
    if (actuales.indexOf(usuarioId) >= 0) {
      /* Ya estaba leído. Solo se guarda si el campo venía mal formado. */
      if (aviso.leidoPor !== actuales) AG.DB.actualizar('avisos', avisoId, { leidoPor: actuales });
      return true;
    }

    var lista = actuales.slice();
    lista.push(usuarioId);
    return !!AG.DB.actualizar('avisos', avisoId, { leidoPor: lista });
  }

  /* Tarjeta compacta de un aviso para los paneles de inicio. */
  function tarjetaHTML(aviso, opciones) {
    var o = opciones || {};
    var autor = aviso.autorId ? AG.DB.usuario(aviso.autorId) : null;
    var destino = destinoDe(aviso.para);
    var alta = normalizarPrioridad(aviso.prioridad) === 'alta';
    var leido = !!aviso.leido;
    var interactiva = o.interactiva !== false;

    var etiqueta = 'Aviso: ' + (aviso.titulo || 'sin título') +
      (leido ? '' : ' (sin leer)') + '. Toca para marcarlo como leído.';

    var html = '<' + (interactiva ? 'button type="button"' : 'div') +
      ' class="av-tarjeta ' + (leido ? 'leido' : 'no-leido') + '"' +
      (interactiva ? ' data-aviso-leer="' + esc(aviso.id) + '" aria-label="' + esc(etiqueta) + '"' : '') + '>';

    /* Solo contenido en línea: la tarjeta puede ser un <button>. */
    html += '<span class="row-sm wrap">' +
      (leido ? '' : '<span class="av-punto" data-punto aria-hidden="true"></span>') +
      '<span class="av-titulo flex1">' + esc(aviso.titulo || 'Aviso sin título') + '</span>' +
      (alta ? '<span class="badge badge-danger">Prioridad alta</span>' : '') +
      (leido ? '' : '<span class="badge badge-rojo" data-nuevo>Nuevo</span>') +
    '</span>';

    html += '<span class="av-meta">' +
      esc(destino.corto) + ' · ' +
      esc(autor ? U.nombreCompleto(autor) : 'Dirección') + ' · ' +
      esc(U.fechaRelativa(aviso.fecha)) +
    '</span>';

    html += '<span class="av-cuerpo">' + parrafos(U.truncar(aviso.cuerpo, o.largo || 220)) + '</span>';

    html += '</' + (interactiva ? 'button' : 'div') + '>';
    return html;
  }

  /**
   * HTML con las tarjetas de aviso para los paneles de inicio.
   * Marca los no leídos y, al hacer clic, los marca como leídos.
   * @param {Object} usuario
   * @param {Number} [limite=3]
   * @returns {String} HTML
   */
  function tarjetas(usuario, limite) {
    asegurarEstilos();
    asegurarDelegacionGlobal();

    if (!usuario || !usuario.rol) {
      return '<div class="empty">' +
        '<div class="empty-icono">' + icono('campana', 30) + '</div>' +
        '<p class="empty-texto">Inicia sesión para ver los avisos del gimnasio.</p>' +
      '</div>';
    }

    var lista = paraUsuario(usuario);
    var tope = Number(limite);
    if (!isFinite(tope) || tope <= 0) tope = 3;
    if (lista.length > tope) lista = lista.slice(0, tope);

    if (!lista.length) {
      return '<div class="empty">' +
        '<div class="empty-icono">' + icono('campana', 30) + '</div>' +
        '<p class="empty-texto">No hay avisos publicados por ahora. Aquí aparecerán las novedades del gimnasio.</p>' +
      '</div>';
    }

    var html = '<div class="stack-sm" data-avisos-tarjetas>';
    for (var i = 0; i < lista.length; i++) html += tarjetaHTML(lista[i], {});
    return html + '</div>';
  }

  /* Un solo enganche en todo el documento para las tarjetas de los paneles. */
  var delegacionLista = false;

  function asegurarDelegacionGlobal() {
    if (delegacionLista || !document) return;
    delegacionLista = true;

    U.delegar(document, 'click', '[data-aviso-leer]', function (e, el) {
      atenderLectura(el);
    });
  }

  function atenderLectura(el) {
    var usuario = usuarioActual();
    if (!usuario || !el) return;
    if (el.classList.contains('leido')) return;

    var id = el.getAttribute('data-aviso-leer');
    if (!marcarLeido(id, usuario.id)) return;

    el.classList.remove('no-leido');
    el.classList.add('leido');

    var punto = el.querySelector('[data-punto]');
    if (punto && punto.parentNode) punto.parentNode.removeChild(punto);

    var nuevo = el.querySelector('[data-nuevo]');
    if (nuevo && nuevo.parentNode) nuevo.parentNode.removeChild(nuevo);

    el.setAttribute('aria-label', 'Aviso leído');
  }

  /* =============================================================
     4. Filtros, KPIs y listado del tablón
     ============================================================= */

  function hayFiltros() {
    return !!(estado.destino || estado.prioridad || String(estado.busqueda || '').trim());
  }

  function avisosFiltrados() {
    var texto = U.normalizar(estado.busqueda || '');

    var lista = AG.DB.donde('avisos', function (a) {
      if (!a || !a.id) return false;
      if (estado.destino && normalizarPara(a.para) !== estado.destino) return false;
      if (estado.prioridad && normalizarPrioridad(a.prioridad) !== estado.prioridad) return false;
      if (!texto) return true;

      var autor = a.autorId ? AG.DB.usuario(a.autorId) : null;
      var cesta = U.normalizar(
        (a.titulo || '') + ' ' + (a.cuerpo || '') + ' ' +
        (autor ? U.nombreCompleto(autor) : '')
      );
      return cesta.indexOf(texto) >= 0;
    });

    return ordenarRecientes(lista);
  }

  function kpiHTML(nombreIcono, valor, etiqueta, variante) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(nombreIcono, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
      '</div>' +
    '</div>';
  }

  function kpisHTML() {
    var todos = AG.DB.get('avisos');
    var mes = U.mesActual();
    var altas = 0;
    var esteMes = 0;
    var sumaPct = 0;
    var i;

    for (i = 0; i < todos.length; i++) {
      if (normalizarPrioridad(todos[i].prioridad) === 'alta') altas++;
      if (U.mesDe(todos[i].fecha) === mes) esteMes++;
      sumaPct += estadisticaLectura(todos[i]).pct;
    }

    var promedio = todos.length ? Math.round(sumaPct / todos.length) : 0;

    return '<div class="grid g4">' +
      kpiHTML('campana', String(todos.length), 'Avisos publicados', '') +
      kpiHTML('alerta', String(altas), 'Con prioridad alta', altas ? 'kpi-warn' : '') +
      kpiHTML('calendario', String(esteMes), 'Publicados este mes', 'kpi-info') +
      kpiHTML('ojo', U.pct(promedio, 0), 'Lectura promedio',
        promedio >= 70 ? 'kpi-ok' : (promedio >= 35 ? 'kpi-warn' : 'kpi-error')) +
    '</div>';
  }

  function plantillasHTML() {
    var html = '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('rayo', 18) + '<span>Plantillas rápidas</span></div>' +
        '<span class="card-sub">Ya redactadas: ábrelas, ajusta la fecha y publica</span>' +
      '</div>' +
      '<div class="card-body"><div class="radio-cards">';

    for (var i = 0; i < PLANTILLAS.length; i++) {
      var p = PLANTILLAS[i];
      html += '<button type="button" class="radio-card av-plantilla" data-plantilla="' + esc(p.clave) + '">' +
        icono(p.icono, 22) +
        '<b>' + esc(p.nombre) + '</b>' +
        '<span>' + esc(p.resumen) + '</span>' +
      '</button>';
    }

    return html + '</div></div></div>';
  }

  function filtrosHTML() {
    var html = '<div class="card"><div class="card-body"><div class="row wrap">' +
      '<div class="field flex1">' +
        '<input class="input" type="search" data-buscar autocomplete="off" ' +
          'aria-label="Buscar aviso" placeholder="Buscar por título, texto o autor" value="' +
          esc(estado.busqueda) + '">' +
      '</div>' +
      '<div class="field"><select class="select" data-destino aria-label="Filtrar por destinatario">' +
        '<option value="">Todos los destinatarios</option>';

    var i;
    for (i = 0; i < DESTINOS.length; i++) {
      html += '<option value="' + esc(DESTINOS[i].id) + '"' +
        (estado.destino === DESTINOS[i].id ? ' selected' : '') + '>' +
        esc(DESTINOS[i].etiqueta) + '</option>';
    }
    html += '</select></div>';

    html += '<div class="field"><select class="select" data-prioridad aria-label="Filtrar por prioridad">' +
      '<option value="">Cualquier prioridad</option>';
    for (i = 0; i < PRIORIDADES.length; i++) {
      html += '<option value="' + esc(PRIORIDADES[i].id) + '"' +
        (estado.prioridad === PRIORIDADES[i].id ? ' selected' : '') + '>' +
        esc('Prioridad ' + PRIORIDADES[i].etiqueta.toLowerCase()) + '</option>';
    }
    html += '</select></div>';

    html += '<button type="button" class="btn btn-ghost btn-sm" data-limpiar data-limpiar-barra' +
      (hayFiltros() ? '' : ' disabled') + '>' + icono('x', 15) + ' Limpiar filtros</button>';

    return html + '</div></div></div>';
  }

  function itemHTML(aviso) {
    var st = estadisticaLectura(aviso);
    var autor = aviso.autorId ? AG.DB.usuario(aviso.autorId) : null;
    var destino = destinoDe(aviso.para);
    var alta = normalizarPrioridad(aviso.prioridad) === 'alta';
    var id = esc(aviso.id);

    var html = '<div class="timeline-item" data-aviso="' + id + '">' +
      '<span class="timeline-punto ' + (alta ? 'rojo' : 'info') + '"></span>' +
      '<div class="row between wrap arriba">' +
        '<div class="flex1">' +
          '<div class="tl-fecha">' + esc(U.fechaRelativa(aviso.fecha)) + ' · ' +
            esc(U.fecha(aviso.fecha, 'corto')) + '</div>' +
          '<div class="tl-titulo">' + esc(aviso.titulo || 'Aviso sin título') +
            (alta ? ' <span class="badge badge-danger">Prioridad alta</span>' : '') + '</div>' +
          /* Los iconos del catálogo son display:block: van en una fila flex. */
          '<div class="row-sm wrap mini muted">' + icono(destino.icono, 13) +
            '<span>' + esc(destino.etiqueta) +
              ' · Publicado por ' + esc(autor ? U.nombreCompleto(autor) : 'Dirección') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="row-sm wrap av-acciones no-imprimir">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-editar-aviso="' + id + '">' +
            icono('editar', 15) + ' Editar</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-reenviar-aviso="' + id + '">' +
            icono('campana', 15) + ' Reenviar</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-eliminar-aviso="' + id + '">' +
            icono('basura', 15) + ' Eliminar</button>' +
        '</div>' +
      '</div>' +
      '<div class="tl-cuerpo av-cuerpo">' + parrafos(aviso.cuerpo) + '</div>';

    if (st.total) {
      html += '<div class="av-lectura">' +
        '<div class="bar-etiqueta"><span>Lectura</span><b>' + esc(U.pct(st.pct, 0)) + '</b></div>' +
        '<div class="bar"><span class="bar-fill ' + claseLectura(st.pct) +
          '" style="width:' + st.pct + '%"></span></div>' +
        '<p class="mini muted mt-sm">' +
          esc(st.leidos + ' de ' + st.total + (st.leidos === 1 ? ' lo ha leído' : ' lo han leído')) +
        '</p>' +
      '</div>';
    } else {
      html += '<p class="mini muted mt-sm">Este aviso no tiene destinatarios activos en este momento.</p>';
    }

    return html + '</div>';
  }

  function listaHTML() {
    var lista = avisosFiltrados();
    var total = AG.DB.get('avisos').length;

    if (!lista.length) {
      var mensaje = total
        ? 'Ningún aviso coincide con los filtros. Cambia la búsqueda o límpialos para ver todo el tablón.'
        : 'Todavía no has publicado ningún aviso. Usa una plantilla rápida o crea el primero desde «Nuevo aviso».';

      return '<div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + icono('campana', 32) + '</div>' +
        '<p class="empty-texto">' + esc(mensaje) + '</p>' +
        (total
          ? '<button type="button" class="btn btn-outline btn-sm" data-limpiar>' +
              icono('x', 15) + ' Limpiar filtros</button>'
          : '<button type="button" class="btn btn-primary btn-sm" data-nuevo-aviso>' +
              icono('mas', 15) + ' Publicar el primer aviso</button>') +
      '</div></div></div>';
    }

    var html = '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('historial', 18) + '<span>Avisos publicados</span></div>' +
        '<span class="badge badge-muted">' + lista.length + ' de ' + total + '</span>' +
      '</div>' +
      '<div class="card-body"><div class="timeline">';

    for (var i = 0; i < lista.length; i++) html += itemHTML(lista[i]);

    return html + '</div></div></div>';
  }

  /* =============================================================
     5. Formulario de aviso (alta y edición)
     ============================================================= */

  function tarjetasDestino(seleccionado) {
    var html = '<div class="radio-cards tres">';
    for (var i = 0; i < DESTINOS.length; i++) {
      var d = DESTINOS[i];
      var gente = destinatarios(d.id).length;
      var activo = (d.id === seleccionado);
      html += '<label class="radio-card' + (activo ? ' on' : '') + '" data-tarjeta-radio>' +
        '<input type="radio" name="para" value="' + esc(d.id) + '"' + (activo ? ' checked' : '') + '>' +
        icono(d.icono, 22) +
        '<b>' + esc(d.etiqueta) + '</b>' +
        '<span>' + esc(d.pista + ' · ' + gente + ' ' + sustantivo(d.id, gente)) + '</span>' +
      '</label>';
    }
    return html + '</div>';
  }

  function tarjetasPrioridad(seleccionada) {
    var html = '<div class="radio-cards dos">';
    for (var i = 0; i < PRIORIDADES.length; i++) {
      var p = PRIORIDADES[i];
      var activo = (p.id === seleccionada);
      html += '<label class="radio-card' + (activo ? ' on' : '') + '" data-tarjeta-radio>' +
        '<input type="radio" name="prioridad" value="' + esc(p.id) + '"' + (activo ? ' checked' : '') + '>' +
        icono(p.icono, 22) +
        '<b>' + esc(p.etiqueta) + '</b>' +
        '<span>' + esc(p.pista) + '</span>' +
      '</label>';
    }
    return html + '</div>';
  }

  /* Vista previa: exactamente lo que verá el destinatario en su panel. */
  function previewHTML(datos, autor) {
    var titulo = String(datos.titulo || '').trim();
    var cuerpo = String(datos.cuerpo || '').trim();

    if (!titulo && !cuerpo) {
      return '<p class="mini muted">Escribe el título y el mensaje para ver aquí cómo lo recibirá tu gente.</p>';
    }

    return tarjetaHTML({
      id: 'preview',
      titulo: titulo || 'Aviso sin título',
      cuerpo: cuerpo || 'Sin contenido todavía.',
      para: datos.para,
      autorId: autor ? autor.id : '',
      fecha: U.hoy(),
      prioridad: datos.prioridad,
      leido: false
    }, { interactiva: false, largo: 400 });
  }

  function formularioHTML(aviso, autor) {
    var a = aviso || {};
    var para = normalizarPara(a.para || 'todos');
    var prioridad = normalizarPrioridad(a.prioridad);
    var gente = destinatarios(para).length;

    return '<form data-form-aviso autocomplete="off" novalidate>' +

      '<div class="field mb">' +
        '<label class="label" for="av-f-titulo">Título del aviso</label>' +
        '<input class="input" type="text" id="av-f-titulo" name="titulo" maxlength="90" ' +
          'placeholder="Ej. Horario especial por día festivo" value="' + esc(a.titulo || '') + '" autofocus>' +
        '<p class="help" data-error="titulo">Máximo 90 caracteres. Sé claro: es lo primero que se lee.</p>' +
      '</div>' +

      '<div class="field mb">' +
        '<label class="label" for="av-f-cuerpo">Mensaje</label>' +
        '<textarea class="textarea" id="av-f-cuerpo" name="cuerpo" rows="7" maxlength="1200" ' +
          'placeholder="Redacta el aviso completo. Los saltos de línea se respetan.">' +
          esc(a.cuerpo || '') + '</textarea>' +
        '<p class="help" data-error="cuerpo">Explica qué cambia, desde cuándo y qué debe hacer quien lo recibe.</p>' +
      '</div>' +

      '<div class="field mb">' +
        '<span class="label">¿Quién lo recibe?</span>' +
        tarjetasDestino(para) +
        '<p class="help">Se creará una notificación para cada persona del grupo elegido.</p>' +
      '</div>' +

      '<div class="field mb">' +
        '<span class="label">Prioridad</span>' +
        tarjetasPrioridad(prioridad) +
      '</div>' +

      '<div class="field">' +
        '<span class="label">Vista previa</span>' +
        '<div class="av-preview" data-preview>' +
          previewHTML({ titulo: a.titulo, cuerpo: a.cuerpo, para: para, prioridad: prioridad }, autor) +
        '</div>' +
        '<p class="help" data-resumen>Llegará a ' + esc(gente + ' ' + sustantivo(para, gente)) + '.</p>' +
      '</div>' +

    '</form>';
  }

  /* Marca de error en un campo (sin alert, sin excepciones). */
  function marcarError(form, campo, mensaje) {
    var ayuda = form.querySelector('[data-error="' + campo + '"]');
    if (ayuda) {
      ayuda.textContent = mensaje || '';
      ayuda.classList.toggle('txt-error', !!mensaje);
    }
    var entrada = form.querySelector('[name="' + campo + '"]');
    if (entrada && mensaje) {
      try { entrada.focus(); } catch (e) { /* el campo ya no está en pantalla */ }
    }
  }

  /* Devuelve los datos limpios o null si algo falta (ya avisado en pantalla). */
  function recolectar(form) {
    var crudo = U.formToObject(form);
    var titulo = String(crudo.titulo || '').trim();
    var cuerpo = String(crudo.cuerpo || '').trim();

    marcarError(form, 'titulo', '');
    marcarError(form, 'cuerpo', '');

    if (titulo.length < 4) {
      marcarError(form, 'titulo', 'Escribe un título de al menos 4 caracteres.');
      toast('El aviso necesita un título claro.', 'warn');
      return null;
    }
    if (cuerpo.length < 10) {
      marcarError(form, 'cuerpo', 'Escribe el mensaje del aviso (mínimo 10 caracteres).');
      toast('Falta el contenido del aviso.', 'warn');
      return null;
    }

    return {
      titulo: titulo,
      cuerpo: cuerpo,
      para: normalizarPara(crudo.para),
      prioridad: normalizarPrioridad(crudo.prioridad)
    };
  }

  /* Refresca vista previa, resumen y estado visual de las radio-cards. */
  function actualizarVivo(form, autor) {
    if (!form) return;
    var crudo = U.formToObject(form);
    var para = normalizarPara(crudo.para);
    var prioridad = normalizarPrioridad(crudo.prioridad);

    var caja = form.querySelector('[data-preview]');
    if (caja) {
      caja.innerHTML = previewHTML({
        titulo: crudo.titulo, cuerpo: crudo.cuerpo, para: para, prioridad: prioridad
      }, autor);
    }

    var resumen = form.querySelector('[data-resumen]');
    if (resumen) {
      var gente = destinatarios(para).length;
      resumen.textContent = gente
        ? 'Llegará a ' + gente + ' ' + sustantivo(para, gente) + '.'
        : 'Por ahora no hay destinatarios activos para este grupo.';
    }

    /* La clase .on sostiene el estilo aunque el navegador no soporte :has(). */
    var tarjetasRadio = U.$$('[data-tarjeta-radio]', form);
    for (var i = 0; i < tarjetasRadio.length; i++) {
      var radio = tarjetasRadio[i].querySelector('input[type="radio"]');
      tarjetasRadio[i].classList.toggle('on', !!(radio && radio.checked));
    }
  }

  /* Notifica a una lista de personas y devuelve cuántas recibieron el aviso. */
  function notificarA(gente, aviso, esRecordatorio) {
    var enviados = 0;
    for (var i = 0; i < gente.length; i++) {
      var persona = gente[i];
      if (!persona || !persona.id) continue;
      AG.DB.notificar(persona.id, {
        titulo: (esRecordatorio ? 'Recordatorio: ' : 'Aviso: ') + (aviso.titulo || 'Novedad del gimnasio'),
        cuerpo: U.truncar(aviso.cuerpo, 180),
        tipo: 'aviso',
        link: enlaceDe(persona)
      });
      enviados++;
    }
    return enviados;
  }

  /**
   * Modal de alta o edición de un aviso.
   * @param {String|null} avisoId  null para crear uno nuevo
   * @param {Object} [prellenado]  { titulo, cuerpo, para, prioridad } de una plantilla
   */
  function formulario(avisoId, prellenado) {
    asegurarEstilos();

    var usuario = usuarioActual();
    if (!esDirector(usuario)) {
      toast('Solo la dirección puede publicar avisos.', 'error');
      return null;
    }

    var existente = avisoId ? AG.DB.buscar('avisos', avisoId) : null;
    if (avisoId && !existente) {
      toast('Ese aviso ya no existe.', 'error');
      return null;
    }

    var base = existente
      ? {
          titulo: existente.titulo,
          cuerpo: existente.cuerpo,
          para: existente.para,
          prioridad: existente.prioridad
        }
      : {
          titulo: (prellenado && prellenado.titulo) || '',
          cuerpo: (prellenado && prellenado.cuerpo) || '',
          para: (prellenado && prellenado.para) || 'todos',
          prioridad: (prellenado && prellenado.prioridad) || 'normal'
        };

    return U.modal({
      titulo: existente ? 'Editar aviso' : 'Nuevo aviso',
      ancho: 'lg',
      cuerpo: formularioHTML(base, usuario),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: existente ? 'Guardar cambios' : 'Publicar aviso',
          clase: 'btn-primary',
          icono: existente ? 'check' : 'campana',
          onClick: function (api) {
            var form = api.root.querySelector('[data-form-aviso]');
            if (!form) return false;

            var datos = recolectar(form);
            if (!datos) return false;

            if (existente) {
              guardarEdicion(existente, datos);
            } else {
              publicar(datos, usuario);
            }

            api.cerrar();
            AG.Router.refrescar();
            return false;
          }
        }
      ],
      onOpen: function (root) {
        var form = root.querySelector('[data-form-aviso]');
        if (!form) return;

        actualizarVivo(form, usuario);

        var refrescar = U.debounce(function () { actualizarVivo(form, usuario); }, 160);
        U.delegar(form, 'input', 'input, textarea', refrescar);
        U.delegar(form, 'change', 'input', function () { actualizarVivo(form, usuario); });

        /* Enter no envía: se publica desde el pie del modal. */
        form.addEventListener('submit', function (e) { e.preventDefault(); });
      }
    });
  }

  /* Alta: inserta el aviso y deja una notificación a cada destinatario. */
  function publicar(datos, usuario) {
    var aviso = {
      titulo: datos.titulo,
      cuerpo: datos.cuerpo,
      para: datos.para,
      autorId: usuario.id,
      fecha: U.hoy(),
      prioridad: datos.prioridad,
      leidoPor: []
    };

    var guardado = AG.DB.insertar('avisos', aviso);
    if (!guardado) {
      toast('No se pudo publicar el aviso.', 'error');
      return null;
    }

    var gente = destinatarios(datos.para);
    var enviados = notificarA(gente, guardado, false);

    if (enviados) {
      toast('Aviso enviado a ' + enviados + ' ' + sustantivo(datos.para, enviados), 'ok');
    } else {
      toast('Aviso publicado, pero no hay destinatarios activos a quienes notificar.', 'warn');
    }
    return guardado;
  }

  /* Edición: cambia el contenido y conserva quién ya lo había leído. */
  function guardarEdicion(existente, datos) {
    var actualizado = AG.DB.actualizar('avisos', existente.id, {
      titulo: datos.titulo,
      cuerpo: datos.cuerpo,
      para: datos.para,
      prioridad: datos.prioridad
    });

    if (!actualizado) {
      toast('No se pudo guardar el aviso.', 'error');
      return null;
    }

    toast('Aviso actualizado. Usa «Reenviar» si quieres avisar de nuevo.', 'ok');
    return actualizado;
  }

  /* =============================================================
     6. Reenviar y eliminar
     ============================================================= */

  /** Manda un recordatorio SOLO a quienes todavía no lo han leído. */
  function reenviar(avisoId) {
    var usuario = usuarioActual();
    if (!esDirector(usuario)) {
      toast('Solo la dirección puede reenviar avisos.', 'error');
      return;
    }

    var aviso = AG.DB.buscar('avisos', avisoId);
    if (!aviso) {
      toast('Ese aviso ya no existe.', 'error');
      return;
    }

    var st = estadisticaLectura(aviso);

    if (!st.total) {
      toast('Este aviso no tiene destinatarios activos.', 'warn');
      return;
    }
    if (!st.pendientes.length) {
      toast('Todos los destinatarios ya leyeron este aviso.', 'info');
      return;
    }

    var cuantos = st.pendientes.length;
    var quienes = cuantos + ' ' + sustantivo(aviso.para, cuantos);

    U.confirmar(
      'Se enviará un recordatorio a ' + quienes + ' que aún no han abierto «' + (aviso.titulo || 'este aviso') + '».',
      'Reenviar aviso',
      { textoOk: 'Sí, reenviar', detalle: 'Quienes ya lo leyeron no recibirán nada.' }
    ).then(function (ok) {
      if (!ok) return;
      var enviados = notificarA(st.pendientes, aviso, true);
      toast('Recordatorio enviado a ' + enviados + ' ' + sustantivo(aviso.para, enviados), 'ok');
      AG.Router.refrescar();
    });
  }

  /** Elimina un aviso tras confirmarlo. */
  function eliminar(avisoId) {
    var usuario = usuarioActual();
    if (!esDirector(usuario)) {
      toast('Solo la dirección puede eliminar avisos.', 'error');
      return;
    }

    var aviso = AG.DB.buscar('avisos', avisoId);
    if (!aviso) {
      toast('Ese aviso ya no existe.', 'error');
      return;
    }

    U.confirmar(
      'Se eliminará el aviso «' + (aviso.titulo || 'sin título') + '» del tablón.',
      'Eliminar aviso',
      {
        peligro: true,
        textoOk: 'Sí, eliminar',
        detalle: 'Las notificaciones que ya recibió tu gente no se borran.'
      }
    ).then(function (ok) {
      if (!ok) return;
      if (AG.DB.eliminar('avisos', avisoId)) {
        toast('Aviso eliminado.', 'ok');
        AG.Router.refrescar();
      } else {
        toast('No se pudo eliminar el aviso.', 'error');
      }
    });
  }

  /* =============================================================
     7. Pantalla del director
     ============================================================= */

  function render(ctx) {
    var usuario = ctx.usuario;
    asegurarEstilos();
    asegurarDelegacionGlobal();

    if (!esDirector(usuario)) {
      return '<div class="page"><div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + icono('candado', 32) + '</div>' +
        '<p class="empty-texto">Solo la dirección puede administrar los avisos del gimnasio.</p>' +
      '</div></div></div></div>';
    }

    var html = '<div class="page" data-avisos>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('campana', 24) + '<span>Avisos</span></h1>' +
          '<p class="page-sub">Publica una novedad y el sistema deja la notificación a cada destinatario; ' +
            'aquí mismo ves cuánta gente la leyó.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-primary" data-nuevo-aviso>' +
            icono('mas', 16) + ' Nuevo aviso</button>' +
        '</div>' +
      '</div>' +
      '<div data-kpis>' + kpisHTML() + '</div>' +
      plantillasHTML() +
      filtrosHTML() +
      '<div data-lista>' + listaHTML() + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root); }
    };
  }

  /* Repinta solo KPIs y listado: así el buscador no pierde el foco. */
  function repintar(raiz) {
    var kpis = raiz.querySelector('[data-kpis]');
    if (kpis) kpis.innerHTML = kpisHTML();

    var lista = raiz.querySelector('[data-lista]');
    if (lista) lista.innerHTML = listaHTML();

    var limpiar = raiz.querySelector('[data-limpiar-barra]');
    if (limpiar) limpiar.disabled = !hayFiltros();
  }

  function enganchar(root) {
    var raiz = root.querySelector('[data-avisos]');
    if (!raiz || raiz.__avEnganchado) return;
    raiz.__avEnganchado = true;

    U.delegar(raiz, 'click', '[data-nuevo-aviso]', function (e) {
      e.preventDefault();
      formulario(null, null);
    });

    U.delegar(raiz, 'click', '[data-plantilla]', function (e, el) {
      e.preventDefault();
      var clave = el.getAttribute('data-plantilla');
      for (var i = 0; i < PLANTILLAS.length; i++) {
        if (PLANTILLAS[i].clave === clave) {
          formulario(null, PLANTILLAS[i]);
          return;
        }
      }
      toast('Esa plantilla ya no está disponible.', 'warn');
    });

    U.delegar(raiz, 'click', '[data-editar-aviso]', function (e, el) {
      e.preventDefault();
      formulario(el.getAttribute('data-editar-aviso'), null);
    });

    U.delegar(raiz, 'click', '[data-reenviar-aviso]', function (e, el) {
      e.preventDefault();
      reenviar(el.getAttribute('data-reenviar-aviso'));
    });

    U.delegar(raiz, 'click', '[data-eliminar-aviso]', function (e, el) {
      e.preventDefault();
      eliminar(el.getAttribute('data-eliminar-aviso'));
    });

    U.delegar(raiz, 'click', '[data-limpiar]', function (e) {
      e.preventDefault();
      estado.destino = '';
      estado.prioridad = '';
      estado.busqueda = '';
      AG.Router.refrescar();
    });

    var buscarConRetraso = U.debounce(function () { repintar(raiz); }, 220);
    U.delegar(raiz, 'input', '[data-buscar]', function (e, el) {
      estado.busqueda = el.value || '';
      buscarConRetraso();
    });

    U.delegar(raiz, 'change', '[data-destino]', function (e, el) {
      estado.destino = el.value || '';
      repintar(raiz);
    });

    U.delegar(raiz, 'change', '[data-prioridad]', function (e, el) {
      estado.prioridad = el.value || '';
      repintar(raiz);
    });
  }

  /* =============================================================
     8. Exposición y registro de rutas
     ============================================================= */

  AG.Mod.Avisos = {
    render: render,
    paraUsuario: paraUsuario,
    marcarLeido: marcarLeido,
    tarjetas: tarjetas,
    formulario: formulario,
    reenviar: reenviar,
    eliminar: eliminar,
    destinatarios: destinatarios,
    estadisticaLectura: estadisticaLectura,
    PLANTILLAS: PLANTILLAS
  };

  AG.Router.registrar({
    path: 'director/avisos',
    roles: ['director'],
    titulo: 'Avisos',
    nav: { etiqueta: 'Avisos', icono: 'campana', grupo: 'Negocio', orden: 3 },
    render: render
  });
})(window.AG);
