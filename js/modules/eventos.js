/* =============================================================
   ALLIANCE GYM — AG.Mod.Eventos (rediseño v2)
   -------------------------------------------------------------
   Actividades ocasionales del gimnasio: retos, clínicas de
   técnica, competencias internas, talleres y convivencias. El
   socio se inscribe (con cupo limitado); la dirección los crea,
   edita y da de baja desde 'director/eventos'.

   Ruta: 'director/eventos' (alta y administración).
   El socio los ve dentro de 'socio/entrenador' (AG.Mod.Sesiones).

   API compartida (la usan otras pantallas):
     AG.Mod.Eventos.proximos(limite)               -> array
     AG.Mod.Eventos.tarjetas(usuario, limite)       -> HTML para paneles
     AG.Mod.Eventos.inscribir(eventoId, socioId)    -> Boolean
     AG.Mod.Eventos.cancelarInscripcion(id, socioId)-> Boolean
     AG.Mod.Eventos.estaInscrito(evento, socioId)   -> Boolean
     AG.Mod.Eventos.cupoDe(evento)                  -> {cupo, inscritos, lugares, pct}

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
  var DB = AG.DB;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  var TIPOS = [
    { id: 'reto', etiqueta: 'Reto', icono: 'meta' },
    { id: 'clinica', etiqueta: 'Clínica de técnica', icono: 'regla' },
    { id: 'competencia', etiqueta: 'Competencia interna', icono: 'trofeo' },
    { id: 'taller', etiqueta: 'Taller', icono: 'config' },
    { id: 'social', etiqueta: 'Convivencia', icono: 'corazon' }
  ];

  /* Estado vivo de la pantalla de dirección. */
  var estado = { tipo: '', cuando: '', busqueda: '' };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) { U.toast(mensaje, tipo || 'info'); }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function esDirector(usuario) { return !!usuario && usuario.rol === 'director'; }

  function n0(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function colorSeguro(color) {
    var t = (typeof color === 'string') ? color.trim() : '';
    return /^#[0-9a-fA-F]{3,8}$/.test(t) ? t : '#8A8F98';
  }

  function tipoDe(id) {
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].id === id) return TIPOS[i];
    return { id: 'evento', etiqueta: 'Evento', icono: 'trofeo' };
  }

  function inscritosDe(evento) {
    return (evento && Object.prototype.toString.call(evento.inscritos) === '[object Array]')
      ? evento.inscritos
      : [];
  }

  function estaInscrito(evento, socioId) {
    if (!evento || !socioId) return false;
    return inscritosDe(evento).indexOf(socioId) >= 0;
  }

  /** Cupo, inscritos y lugares restantes de un evento (nunca negativos). */
  function cupoDe(evento) {
    var cupo = Math.max(0, n0(evento && evento.cupo));
    var inscritos = inscritosDe(evento).length;
    var lugares = Math.max(0, cupo - inscritos);
    var pct = cupo > 0 ? Math.min(100, Math.round((inscritos * 100) / cupo)) : 0;
    return { cupo: cupo, inscritos: inscritos, lugares: lugares, pct: pct };
  }

  function claseCupo(c) {
    if (c.cupo <= 0) return '';
    if (c.inscritos >= c.cupo) return ' lleno';
    if (c.lugares <= Math.max(1, Math.round(c.cupo * 0.1))) return ' casi-lleno';
    return '';
  }

  function esPasado(evento) {
    var f = String((evento && evento.fecha) || '').slice(0, 10);
    return !!f && f < U.hoy();
  }

  function ordenarPorFecha(lista) {
    return lista.slice().sort(function (a, b) {
      var ka = String((a && a.fecha) || '') + ' ' + String((a && a.hora) || '');
      var kb = String((b && b.fecha) || '') + ' ' + String((b && b.hora) || '');
      return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });
  }

  /* =============================================================
     2. API compartida con el resto del sistema
     ============================================================= */

  /** Eventos activos de hoy en adelante (delgado sobre AG.DB). */
  function proximos(limite) {
    if (typeof DB.eventosProximos !== 'function') return [];
    try { return DB.eventosProximos(limite) || []; } catch (e) { return []; }
  }

  /**
   * Inscribe a un socio si hay cupo y el evento sigue vigente.
   * @returns {Boolean}
   */
  function inscribir(eventoId, socioId) {
    var evento = eventoId ? DB.buscar('eventos', eventoId) : null;
    if (!evento) { toast('Ese evento ya no existe.', 'error'); return false; }
    if (evento.activo === false) { toast('Este evento ya no está disponible.', 'warn'); return false; }
    if (esPasado(evento)) { toast('Ese evento ya pasó.', 'warn'); return false; }
    if (estaInscrito(evento, socioId)) { toast('Ya estás inscrito en este evento.', 'info'); return true; }

    var c = cupoDe(evento);
    if (c.cupo > 0 && c.lugares <= 0) { toast('Ya no hay lugares disponibles.', 'warn'); return false; }

    var lista = inscritosDe(evento).slice();
    lista.push(socioId);
    var ok = !!DB.actualizar('eventos', eventoId, { inscritos: lista });
    if (ok) toast('¡Listo! Quedaste inscrito en «' + (evento.nombre || 'el evento') + '».', 'ok');
    else toast('No se pudo completar tu inscripción.', 'error');
    return ok;
  }

  /** Quita a un socio de la lista de inscritos. */
  function cancelarInscripcion(eventoId, socioId) {
    var evento = eventoId ? DB.buscar('eventos', eventoId) : null;
    if (!evento) return false;

    var lista = inscritosDe(evento).filter(function (id) { return id !== socioId; });
    var ok = !!DB.actualizar('eventos', eventoId, { inscritos: lista });
    if (ok) toast('Cancelaste tu inscripción a «' + (evento.nombre || 'el evento') + '».', 'info');
    return ok;
  }

  /* Un solo enganche global para los botones de inscripción en cualquier panel. */
  var delegacionLista = false;

  function asegurarDelegacionGlobal() {
    if (delegacionLista || !document) return;
    delegacionLista = true;

    U.delegar(document, 'click', '[data-evento-inscribir]', function (e, el) {
      e.preventDefault();
      var usuario = usuarioActual();
      if (!usuario || usuario.rol !== 'socio') return;
      if (inscribir(el.getAttribute('data-evento-inscribir'), usuario.id)) {
        if (typeof AG.Router !== 'undefined' && AG.Router.refrescar) AG.Router.refrescar();
      }
    });

    U.delegar(document, 'click', '[data-evento-cancelar-insc]', function (e, el) {
      e.preventDefault();
      var usuario = usuarioActual();
      if (!usuario || usuario.rol !== 'socio') return;
      if (cancelarInscripcion(el.getAttribute('data-evento-cancelar-insc'), usuario.id)) {
        if (typeof AG.Router !== 'undefined' && AG.Router.refrescar) AG.Router.refrescar();
      }
    });
  }

  /** Tarjeta completa de un evento (usa el estilo .evento del contrato). */
  function tarjetaHTML(evento, usuario, opts) {
    var o = opts || {};
    var t = tipoDe(evento.tipo);
    var c = cupoDe(evento);
    var pasado = esPasado(evento);
    var cancelado = evento.activo === false;
    var socioId = (usuario && usuario.rol === 'socio') ? usuario.id : '';
    var inscrito = socioId ? estaInscrito(evento, socioId) : false;
    var p = U.fecha(evento.fecha, 'diaMes').split(' ');

    var clases = 'evento' + (o.fila ? ' evento-fila' : '') +
      (inscrito ? ' inscrito' : '') + (pasado ? ' pasado' : '') + (cancelado ? ' cancelado' : '');

    var acciones = '';
    if (!pasado && !cancelado && socioId) {
      acciones = inscrito
        ? '<button type="button" class="btn btn-ghost btn-sm" data-evento-cancelar-insc="' + esc(evento.id) + '">' +
            icono('x', 14) + ' Ya no puedo ir</button>'
        : (c.cupo > 0 && c.lugares <= 0
            ? '<span class="badge badge-muted">Sin lugares</span>'
            : '<button type="button" class="btn btn-primary btn-sm" data-evento-inscribir="' + esc(evento.id) + '">' +
                icono('mas', 14) + ' Inscribirme</button>');
    } else if (inscrito) {
      acciones = '<span class="badge badge-ok">Inscrito</span>';
    }

    return '<article class="evento" style="--evento-color:' + esc(colorSeguro(evento.color)) + '">' +
      '<div class="evento-fecha"><span>' + esc(p[1] || '') + '</span><b>' + esc(p[0] || '') + '</b></div>' +
      '<div class="evento-info">' +
        '<b>' + esc(evento.nombre || 'Evento') + '</b>' +
        '<div class="evento-meta">' +
          (evento.hora ? '<span>' + icono('reloj', 14) + esc(evento.hora) + '</span>' : '') +
          (evento.lugar ? '<span>' + icono('ubicacion', 14) + esc(evento.lugar) + '</span>' : '') +
          '<span>' + icono(t.icono, 14) + esc(t.etiqueta) + '</span>' +
        '</div>' +
        (c.cupo > 0 ? '<div class="evento-cupo' + claseCupo(c) + '">' +
          '<div class="evento-cupo-txt"><span><b>' + c.inscritos + '</b> de ' + c.cupo + '</span>' +
            '<span>' + (c.lugares > 0 ? c.lugares + (c.lugares === 1 ? ' lugar' : ' lugares') : 'Sin lugares') + '</span></div>' +
          '<div class="evento-cupo-barra"><i class="evento-cupo-fill" style="width:' + c.pct + '%"></i></div>' +
        '</div>' : '') +
        (acciones ? '<div class="evento-acciones">' + acciones + '</div>' : '') +
      '</div>' +
    '</article>';
  }

  /**
   * HTML con las tarjetas de eventos próximos para los paneles de inicio
   * y para 'socio/entrenador'.
   * @param {Object} usuario
   * @param {Number} [limite]
   * @returns {String}
   */
  function tarjetas(usuario, limite) {
    asegurarDelegacionGlobal();

    var lista = proximos(limite || 0);
    if (!lista.length) {
      return '<div class="vacio-amable">' +
        '<span class="vacio-amable-icono">' + icono('trofeo', 26) + '</span>' +
        '<b>Pronto habrá eventos</b><span>Retos, clínicas y convivencias.</span></div>';
    }

    var html = '<div class="eventos" data-eventos-tarjetas>';
    for (var i = 0; i < lista.length; i++) html += tarjetaHTML(lista[i], usuario, {});
    return html + '</div>';
  }

  /* =============================================================
     3. Pantalla de dirección — filtros, KPIs y listado
     ============================================================= */

  function hayFiltros() {
    return !!(estado.tipo || estado.cuando || String(estado.busqueda || '').trim());
  }

  function eventosFiltrados() {
    var texto = U.normalizar ? U.normalizar(estado.busqueda || '') : String(estado.busqueda || '').toLowerCase();
    var hoy = U.hoy();

    var lista = DB.donde('eventos', function (e) {
      if (!e || !e.id) return false;
      if (estado.tipo && e.tipo !== estado.tipo) return false;
      if (estado.cuando === 'proximos' && (esPasado(e) || e.activo === false)) return false;
      if (estado.cuando === 'pasados' && !esPasado(e)) return false;
      if (!texto) return true;
      var cesta = ((e.nombre || '') + ' ' + (e.lugar || '') + ' ' + (e.descripcion || '')).toLowerCase();
      return cesta.indexOf(texto) >= 0;
    });

    return ordenarPorFecha(lista);
  }

  function kpiHTML(nombreIcono, valor, etiqueta, variante) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(nombreIcono, 22) + '</div>' +
      '<div class="kpi-datos"><div class="kpi-val">' + esc(valor) + '</div>' +
      '<div class="kpi-label">' + esc(etiqueta) + '</div></div></div>';
  }

  function kpisHTML() {
    var todos = DB.get('eventos');
    var vigentes = 0, casiLlenos = 0, totalInscritos = 0;
    var hoy = U.hoy();

    for (var i = 0; i < todos.length; i++) {
      var e = todos[i];
      var c = cupoDe(e);
      totalInscritos += c.inscritos;
      if (e.activo !== false && String(e.fecha || '').slice(0, 10) >= hoy) {
        vigentes++;
        if (claseCupo(c) === ' casi-lleno' || claseCupo(c) === ' lleno') casiLlenos++;
      }
    }

    return '<div class="grid g4">' +
      kpiHTML('trofeo', String(todos.length), 'Eventos creados', '') +
      kpiHTML('calendario', String(vigentes), 'Próximos', 'kpi-info') +
      kpiHTML('socios', String(totalInscritos), 'Inscripciones totales', '') +
      kpiHTML('alerta', String(casiLlenos), 'Con poco cupo', casiLlenos ? 'kpi-warn' : '') +
    '</div>';
  }

  function filtrosHTML() {
    var html = '<div class="card"><div class="card-body"><div class="row wrap">' +
      '<div class="field flex1"><input class="input" type="search" data-buscar autocomplete="off" ' +
        'aria-label="Buscar evento" placeholder="Buscar por nombre o lugar" value="' + esc(estado.busqueda) + '"></div>' +
      '<div class="field"><select class="select" data-tipo aria-label="Filtrar por tipo">' +
      '<option value="">Cualquier tipo</option>';
    for (var i = 0; i < TIPOS.length; i++) {
      html += '<option value="' + esc(TIPOS[i].id) + '"' + (estado.tipo === TIPOS[i].id ? ' selected' : '') + '>' +
        esc(TIPOS[i].etiqueta) + '</option>';
    }
    html += '</select></div>' +
      '<div class="field"><select class="select" data-cuando aria-label="Filtrar por fecha">' +
        '<option value="">Todas las fechas</option>' +
        '<option value="proximos"' + (estado.cuando === 'proximos' ? ' selected' : '') + '>Próximos</option>' +
        '<option value="pasados"' + (estado.cuando === 'pasados' ? ' selected' : '') + '>Ya pasaron</option>' +
      '</select></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-limpiar data-limpiar-barra' +
        (hayFiltros() ? '' : ' disabled') + '>' + icono('x', 15) + ' Limpiar filtros</button>' +
    '</div></div></div>';
    return html;
  }

  function itemHTML(evento) {
    var t = tipoDe(evento.tipo);
    var c = cupoDe(evento);
    var pasado = esPasado(evento);
    var cancelado = evento.activo === false;
    var id = esc(evento.id);

    return '<div class="timeline-item" data-evento="' + id + '">' +
      '<span class="timeline-punto' + (cancelado ? '' : (claseCupo(c) ? ' warn' : ' info')) + '"></span>' +
      '<div class="row between wrap arriba">' +
        '<div class="flex1">' +
          '<div class="tl-fecha">' + esc(U.fecha(evento.fecha, 'corto')) + (evento.hora ? ' · ' + esc(evento.hora) : '') +
            (pasado ? ' <span class="badge badge-muted">Pasado</span>' : '') +
            (cancelado ? ' <span class="badge badge-muted">De baja</span>' : '') + '</div>' +
          '<div class="tl-titulo">' + esc(evento.nombre || 'Evento') + '</div>' +
          '<div class="row-sm wrap mini muted">' + icono(t.icono, 13) +
            '<span>' + esc(t.etiqueta) + (evento.lugar ? ' · ' + esc(evento.lugar) : '') +
              (c.cupo > 0 ? ' · ' + c.inscritos + ' de ' + c.cupo + ' inscritos' : '') + '</span></div>' +
        '</div>' +
        '<div class="row-sm wrap av-acciones no-imprimir">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-editar-evento="' + id + '">' +
            icono('editar', 15) + ' Editar</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-eliminar-evento="' + id + '">' +
            icono('basura', 15) + ' Eliminar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function listaHTML() {
    var lista = eventosFiltrados();
    var total = DB.get('eventos').length;

    if (!lista.length) {
      var mensaje = total
        ? 'Ningún evento coincide con los filtros. Cambia la búsqueda o límpialos para ver todos.'
        : 'Todavía no has creado ningún evento. Empieza con un reto o una clínica de técnica.';
      return '<div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + icono('trofeo', 32) + '</div>' +
        '<p class="empty-texto">' + esc(mensaje) + '</p>' +
        (total
          ? '<button type="button" class="btn btn-outline btn-sm" data-limpiar>' + icono('x', 15) + ' Limpiar filtros</button>'
          : '<button type="button" class="btn btn-primary btn-sm" data-nuevo-evento>' + icono('mas', 15) + ' Crear el primer evento</button>') +
      '</div></div></div>';
    }

    var html = '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + icono('historial', 18) + '<span>Eventos</span></div>' +
        '<span class="badge badge-muted">' + lista.length + ' de ' + total + '</span>' +
      '</div><div class="card-body"><div class="timeline">';
    for (var i = 0; i < lista.length; i++) html += itemHTML(lista[i]);
    return html + '</div></div></div>';
  }

  /* =============================================================
     4. Formulario de evento (alta y edición)
     ============================================================= */

  function tarjetasTipo(seleccionado) {
    var html = '<div class="radio-cards tres">';
    for (var i = 0; i < TIPOS.length; i++) {
      var t = TIPOS[i];
      var activo = (t.id === seleccionado);
      html += '<label class="radio-card' + (activo ? ' on' : '') + '" data-tarjeta-radio>' +
        '<input type="radio" name="tipo" value="' + esc(t.id) + '"' + (activo ? ' checked' : '') + '>' +
        icono(t.icono, 22) + '<b>' + esc(t.etiqueta) + '</b></label>';
    }
    return html + '</div>';
  }

  function coachesOpciones(seleccionado) {
    var coaches = DB.coaches();
    var html = '<option value="">Sin coach a cargo</option>';
    for (var i = 0; i < coaches.length; i++) {
      html += '<option value="' + esc(coaches[i].id) + '"' + (coaches[i].id === seleccionado ? ' selected' : '') + '>' +
        esc(U.nombreCompleto(coaches[i])) + '</option>';
    }
    return html;
  }

  function formularioHTML(evento) {
    var e = evento || {};
    var tipo = e.tipo || 'reto';

    return '<form data-form-evento autocomplete="off" novalidate>' +
      '<div class="field mb"><label class="label" for="ev-f-nombre">Nombre del evento</label>' +
        '<input class="input" type="text" id="ev-f-nombre" name="nombre" maxlength="80" ' +
        'placeholder="Ej. Clínica de técnica de peso muerto" value="' + esc(e.nombre || '') + '" autofocus>' +
        '<p class="help" data-error="nombre"></p></div>' +

      '<div class="field mb"><label class="label" for="ev-f-desc">Descripción corta</label>' +
        '<textarea class="textarea" id="ev-f-desc" name="descripcion" rows="3" maxlength="300" ' +
        'placeholder="Qué es, para quién y qué necesita traer">' + esc(e.descripcion || '') + '</textarea></div>' +

      '<div class="field mb"><span class="label">Tipo</span>' + tarjetasTipo(tipo) + '</div>' +

      '<div class="row wrap">' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-fecha">Fecha</label>' +
          '<input class="input" type="date" id="ev-f-fecha" name="fecha" value="' + esc((e.fecha || '').slice(0, 10)) + '">' +
          '<p class="help" data-error="fecha"></p></div>' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-hora">Hora</label>' +
          '<input class="input" type="time" id="ev-f-hora" name="hora" value="' + esc(e.hora || '') + '"></div>' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-dur">Duración (min)</label>' +
          '<input class="input" type="number" id="ev-f-dur" name="duracionMin" min="15" max="600" step="15" ' +
          'value="' + esc(e.duracionMin || 90) + '"></div>' +
      '</div>' +

      '<div class="row wrap">' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-lugar">Lugar</label>' +
          '<input class="input" type="text" id="ev-f-lugar" name="lugar" maxlength="60" ' +
          'placeholder="Ej. Zona funcional" value="' + esc(e.lugar || '') + '"></div>' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-cupo">Cupo</label>' +
          '<input class="input" type="number" id="ev-f-cupo" name="cupo" min="0" max="500" ' +
          'value="' + esc(e.cupo || 20) + '"><p class="help">0 = sin límite de cupo.</p></div>' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-costo">Costo ($)</label>' +
          '<input class="input" type="number" id="ev-f-costo" name="costo" min="0" step="10" ' +
          'value="' + esc(e.costo || 0) + '"></div>' +
      '</div>' +

      '<div class="row wrap">' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-coach">Coach a cargo</label>' +
          '<select class="select" id="ev-f-coach" name="coachId">' + coachesOpciones(e.coachId || '') + '</select></div>' +
        '<div class="field flex1 mb"><label class="label" for="ev-f-color">Color</label>' +
          '<input class="input" type="color" id="ev-f-color" name="color" value="' + esc(colorSeguro(e.color)) + '"></div>' +
      '</div>' +
    '</form>';
  }

  function marcarError(form, campo, mensaje) {
    var ayuda = form.querySelector('[data-error="' + campo + '"]');
    if (ayuda) { ayuda.textContent = mensaje || ''; ayuda.classList.toggle('txt-error', !!mensaje); }
  }

  function recolectar(form) {
    var crudo = U.formToObject(form);
    var nombre = String(crudo.nombre || '').trim();
    var fecha = String(crudo.fecha || '').trim();

    marcarError(form, 'nombre', '');
    marcarError(form, 'fecha', '');

    if (nombre.length < 4) {
      marcarError(form, 'nombre', 'Escribe un nombre de al menos 4 caracteres.');
      toast('El evento necesita un nombre.', 'warn');
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      marcarError(form, 'fecha', 'Elige una fecha válida.');
      toast('Falta la fecha del evento.', 'warn');
      return null;
    }

    var tipoValido = 'reto';
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].id === crudo.tipo) tipoValido = crudo.tipo;

    return {
      nombre: nombre,
      descripcion: String(crudo.descripcion || '').trim(),
      tipo: tipoValido,
      fecha: fecha,
      hora: String(crudo.hora || '').trim(),
      duracionMin: Math.max(15, Math.min(600, Number(crudo.duracionMin) || 90)),
      lugar: String(crudo.lugar || '').trim(),
      cupo: Math.max(0, Math.min(500, Number(crudo.cupo) || 0)),
      costo: Math.max(0, Number(crudo.costo) || 0),
      coachId: String(crudo.coachId || ''),
      color: colorSeguro(crudo.color)
    };
  }

  function formulario(eventoId) {
    var usuario = usuarioActual();
    if (!esDirector(usuario)) { toast('Solo la dirección puede administrar eventos.', 'error'); return null; }

    var existente = eventoId ? DB.buscar('eventos', eventoId) : null;
    if (eventoId && !existente) { toast('Ese evento ya no existe.', 'error'); return null; }

    return U.modal({
      titulo: existente ? 'Editar evento' : 'Nuevo evento',
      ancho: 'lg',
      cuerpo: formularioHTML(existente),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: existente ? 'Guardar cambios' : 'Crear evento',
          clase: 'btn-primary',
          icono: existente ? 'check' : 'mas',
          onClick: function (api) {
            var form = api.root.querySelector('[data-form-evento]');
            if (!form) return false;
            var datos = recolectar(form);
            if (!datos) return false;

            if (existente) {
              if (!DB.actualizar('eventos', existente.id, datos)) { toast('No se pudo guardar el evento.', 'error'); return false; }
              toast('Evento actualizado.', 'ok');
            } else {
              var guardado = DB.insertar('eventos', {
                nombre: datos.nombre, descripcion: datos.descripcion, tipo: datos.tipo,
                fecha: datos.fecha, hora: datos.hora, duracionMin: datos.duracionMin,
                lugar: datos.lugar, cupo: datos.cupo, inscritos: [], coachId: datos.coachId,
                color: datos.color, costo: datos.costo, activo: true
              });
              if (!guardado) { toast('No se pudo crear el evento.', 'error'); return false; }
              toast('Evento creado.', 'ok');
            }
            api.cerrar();
            AG.Router.refrescar();
            return false;
          }
        }
      ],
      onOpen: function (form_root) {
        var form = form_root.querySelector('[data-form-evento]');
        if (!form) return;
        form.addEventListener('submit', function (e) { e.preventDefault(); });
        var radios = U.$$('[data-tarjeta-radio]', form);
        U.delegar(form, 'change', 'input[type="radio"]', function () {
          for (var i = 0; i < radios.length; i++) {
            var r = radios[i].querySelector('input[type="radio"]');
            radios[i].classList.toggle('on', !!(r && r.checked));
          }
        });
      }
    });
  }

  function eliminar(eventoId) {
    var usuario = usuarioActual();
    if (!esDirector(usuario)) { toast('Solo la dirección puede eliminar eventos.', 'error'); return; }

    var evento = DB.buscar('eventos', eventoId);
    if (!evento) { toast('Ese evento ya no existe.', 'error'); return; }

    var inscritos = inscritosDe(evento).length;
    U.confirmar(
      'Se eliminará «' + (evento.nombre || 'este evento') + '»' +
        (inscritos ? ' y perderás el registro de ' + inscritos + ' ' + (inscritos === 1 ? 'inscripción' : 'inscripciones') + '.' : '.'),
      'Eliminar evento',
      { peligro: true, textoOk: 'Sí, eliminar' }
    ).then(function (ok) {
      if (!ok) return;
      if (DB.eliminar('eventos', eventoId)) { toast('Evento eliminado.', 'ok'); AG.Router.refrescar(); }
      else toast('No se pudo eliminar el evento.', 'error');
    });
  }

  /* =============================================================
     5. Pantalla de dirección
     ============================================================= */

  function render(ctx) {
    var usuario = ctx.usuario;
    asegurarDelegacionGlobal();

    if (!esDirector(usuario)) {
      return '<div class="page"><div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + icono('candado', 32) + '</div>' +
        '<p class="empty-texto">Solo la dirección puede administrar los eventos del gimnasio.</p>' +
      '</div></div></div></div>';
    }

    var html = '<div class="page" data-eventos-admin>' +
      '<div class="page-head"><div>' +
        '<h1 class="page-title">' + icono('trofeo', 24) + '<span>Eventos</span></h1>' +
        '<p class="page-sub">Retos, clínicas, competencias y convivencias con cupo limitado.</p>' +
      '</div><div class="page-acciones">' +
        '<button type="button" class="btn btn-primary" data-nuevo-evento>' + icono('mas', 16) + ' Nuevo evento</button>' +
      '</div></div>' +
      '<div data-kpis>' + kpisHTML() + '</div>' +
      filtrosHTML() +
      '<div data-lista>' + listaHTML() + '</div>' +
    '</div>';

    return { html: html, listo: function (root) { enganchar(root); } };
  }

  function repintar(raiz) {
    var kpis = raiz.querySelector('[data-kpis]');
    if (kpis) kpis.innerHTML = kpisHTML();
    var lista = raiz.querySelector('[data-lista]');
    if (lista) lista.innerHTML = listaHTML();
    var limpiar = raiz.querySelector('[data-limpiar-barra]');
    if (limpiar) limpiar.disabled = !hayFiltros();
  }

  function enganchar(root) {
    var raiz = root.querySelector('[data-eventos-admin]');
    if (!raiz || raiz.__evAdminEnganchado) return;
    raiz.__evAdminEnganchado = true;

    U.delegar(raiz, 'click', '[data-nuevo-evento]', function (e) { e.preventDefault(); formulario(null); });
    U.delegar(raiz, 'click', '[data-editar-evento]', function (e, el) { e.preventDefault(); formulario(el.getAttribute('data-editar-evento')); });
    U.delegar(raiz, 'click', '[data-eliminar-evento]', function (e, el) { e.preventDefault(); eliminar(el.getAttribute('data-eliminar-evento')); });

    U.delegar(raiz, 'click', '[data-limpiar]', function (e) {
      e.preventDefault();
      estado.tipo = ''; estado.cuando = ''; estado.busqueda = '';
      AG.Router.refrescar();
    });

    var buscarConRetraso = U.debounce(function () { repintar(raiz); }, 220);
    U.delegar(raiz, 'input', '[data-buscar]', function (e, el) { estado.busqueda = el.value || ''; buscarConRetraso(); });
    U.delegar(raiz, 'change', '[data-tipo]', function (e, el) { estado.tipo = el.value || ''; repintar(raiz); });
    U.delegar(raiz, 'change', '[data-cuando]', function (e, el) { estado.cuando = el.value || ''; repintar(raiz); });
  }

  /* =============================================================
     6. Exposición y registro de rutas
     ============================================================= */

  AG.Mod.Eventos = {
    render: render,
    proximos: proximos,
    tarjetas: tarjetas,
    inscribir: inscribir,
    cancelarInscripcion: cancelarInscripcion,
    estaInscrito: estaInscrito,
    cupoDe: cupoDe,
    formulario: formulario,
    eliminar: eliminar,
    TIPOS: TIPOS
  };

  AG.Router.registrar({
    path: 'director/eventos',
    roles: ['director'],
    titulo: 'Eventos',
    nav: { etiqueta: 'Eventos', icono: 'trofeo', grupo: 'Negocio', orden: 4 },
    render: render
  });
})(window.AG);
