/* =============================================================
   ALLIANCE GYM — AG.Mod.Sesiones (rediseño v2)
   -------------------------------------------------------------
   El gimnasio ya no da clases grupales: cada socio agenda UNA
   sesión por semana con su entrenador, en un horario disponible.
   Este módulo cubre las tres pantallas de la sección 3 de
   docs/REDISENO.md.

   Rutas:
     'socio/entrenador'  -> tu coach, tu próxima sesión, tu
                             historial y los eventos del gimnasio.
     'coach/sesiones'    -> sesiones por cerrar, próximas y tu
                             disponibilidad semanal.
     'director/sesiones' -> panorama de todos los coaches.

   API compartida (la usan otras pantallas):
     AG.Mod.Sesiones.agendar(socioId, opts)          // modal de reserva
     AG.Mod.Sesiones.proximaDe(usuario)              // {sesion, cuando}
     AG.Mod.Sesiones.deCoach(coachId, desde, hasta)
     AG.Mod.Sesiones.tarjeta(sesion, opts)           // HTML reutilizable
     AG.Mod.Sesiones.cancelar(sesionId, opts)

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
  var Calc = AG.Calc;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  var DIAS_ID = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  var DIAS_NOMBRE = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
  var DIAS_ABREV = { domingo: 'Dom', lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb' };

  var ESTADOS = {
    agendada: { texto: 'Agendada', badge: 'badge-rojo' },
    completada: { texto: 'Completada', badge: 'badge-ok' },
    cancelada: { texto: 'Cancelada', badge: 'badge-muted' },
    no_asistio: { texto: 'No asistió', badge: 'badge-warn' }
  };

  /* Estado vivo de las pantallas de coach y dirección (sobrevive a los repintados). */
  var estado = { diaCoach: '', filtroCoach: '', filtroEstado: '' };

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

  function primerNombre(usuario) {
    var nombre = usuario && usuario.nombre ? String(usuario.nombre) : '';
    return nombre.split(' ')[0] || 'tu entrenador';
  }

  function sinAcentos(v) {
    return String(v || '').toLowerCase()
      .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').trim();
  }

  /** 'HH:MM' -> minutos desde medianoche; -1 si no es válida. */
  function minutosDe(hora) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '').trim());
    if (!m) return -1;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return -1;
    return h * 60 + mi;
  }

  function minutosAhora() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function estadoBadge(clave) { return ESTADOS[clave] || { texto: clave || 'Sin estado', badge: 'badge-muted' }; }

  /* =============================================================
     2. Ayudantes de negocio
     ============================================================= */

  function esSocio(u) { return !!u && u.rol === 'socio'; }
  function esCoach(u) { return !!u && u.rol === 'coach'; }
  function esDirector(u) { return !!u && u.rol === 'director'; }

  function membresiaActiva(socio) {
    try { return Calc.estadoMembresia(socio).estado === 'activo'; } catch (e) { return false; }
  }

  function coachDe(socio) {
    return socio && socio.coachId ? DB.usuario(socio.coachId) : null;
  }

  /** Horas (con decimales) entre ahora y el inicio de una sesión. */
  function horasHasta(sesion) {
    var f = String(sesion.fecha || '').slice(0, 10);
    var h = String(sesion.hora || '00:00');
    var objetivo = new Date(f + 'T' + h + ':00');
    if (isNaN(objetivo.getTime())) return 999;
    return (objetivo.getTime() - Date.now()) / 3600000;
  }

  function yaPaso(sesion) { return horasHasta(sesion) < 0; }

  function cuandoTexto(sesion) {
    var f = String(sesion.fecha || '').slice(0, 10);
    if (f === U.hoy()) return 'Hoy';
    if (f === U.sumaDias(U.hoy(), 1)) return 'Mañana';
    return U.fechaRelativa(f);
  }

  function primeraFechaConHuecos(coachId) {
    for (var i = 0; i < 14; i++) {
      var f = U.sumaDias(U.hoy(), i);
      var huecos = (typeof DB.huecosDe === 'function') ? (DB.huecosDe(coachId, f) || []) : [];
      for (var k = 0; k < huecos.length; k++) if (huecos[k].libre) return f;
    }
    return U.hoy();
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  /**
   * Tarjeta de una sesión (.sesion-card del contrato de CSS).
   * @param {Object} sesion  registro crudo de 'sesiones'
   * @param {Object} [opts]  { verSocio, verCoach, acciones (HTML) }
   */
  function tarjeta(sesion, opts) {
    var o = opts || {};
    var s = estadoBadge(sesion.estado);
    var esHoy = String(sesion.fecha || '').slice(0, 10) === U.hoy();
    var quien = null;
    if (o.verSocio && sesion.socioId) quien = DB.usuario(sesion.socioId);
    else if (o.verCoach && sesion.coachId) quien = DB.usuario(sesion.coachId);

    var titulo = quien
      ? (o.verSocio ? 'Sesión con ' + U.nombreCompleto(quien) : 'Sesión con ' + primerNombre(quien))
      : 'Sesión de entrenamiento';

    var meta = (sesion.duracionMin || 60) + ' min' + (sesion.objetivo ? ' · ' + esc(sesion.objetivo) : '');

    var html = '<div class="sesion-card ' + esc(sesion.estado || '') + (esHoy ? ' es-hoy' : '') + '">' +
      '<div class="sesion-hora">' + esc(sesion.hora || '--:--') +
        '<small>' + esc((DIAS_ABREV[sinAcentos(DB.nombreDiaDe(sesion.fecha))] || '') + ' ' + Number(String(sesion.fecha || '').slice(8, 10))) + '</small>' +
      '</div>' +
      '<div class="sesion-info"><b>' + esc(titulo) + '</b><span>' + meta + '</span>' +
        (o.verSocio || o.verCoach ? '' : '<span class="badge ' + s.badge + '">' + esc(s.texto) + '</span>') +
      '</div>' +
      (o.acciones ? '<div class="sesion-acciones">' + o.acciones + '</div>' : '') +
      (sesion.notasCoach && sesion.estado === 'completada'
        ? '<div class="sesion-notas"><b>' + (o.verSocio || o.verCoach ? 'Notas:' : 'Tu coach dice:') + '</b> ' + esc(sesion.notasCoach) + '</div>' : '') +
    '</div>';

    return html;
  }

  /* =============================================================
     4. API compartida con el resto del sistema
     ============================================================= */

  /**
   * La sesión próxima de un socio (agendada, de esta semana).
   * @param {Object} usuario
   * @returns {Object|null} { sesion, cuando }
   */
  function proximaDe(usuario) {
    if (!esSocio(usuario)) return null;
    var s = (typeof DB.sesionDeLaSemana === 'function') ? DB.sesionDeLaSemana(usuario.id) : null;
    if (!s || s.estado !== 'agendada') return null;
    return { sesion: s, cuando: cuandoTexto(s) };
  }

  /** Sesiones de un coach en un rango (delgado sobre AG.DB). */
  function deCoach(coachId, desde, hasta) {
    if (typeof DB.sesionesDeCoach !== 'function') return [];
    try { return DB.sesionesDeCoach(coachId, desde, hasta) || []; } catch (e) { return []; }
  }

  /**
   * Cancela una sesión agendada. Avisa con cariño si es con poca
   * anticipación (el lugar ya no se puede reasignar).
   * @param {String} sesionId
   * @param {{quien:'socio'|'coach'|'director', alGuardar:Function}} [opts]
   */
  function cancelar(sesionId, opts) {
    var o = opts || {};
    var sesion = sesionId ? DB.buscar('sesiones', sesionId) : null;
    if (!sesion) { toast('Esa sesión ya no existe.', 'error'); return; }
    if (sesion.estado !== 'agendada') { toast('Esa sesión ya no se puede cancelar.', 'warn'); return; }

    var horas = horasHasta(sesion);
    var mensaje = 'Se cancelará la sesión del ' + U.fecha(sesion.fecha, 'largo') + ' a las ' + sesion.hora + '.';
    if (horas >= 0 && horas < 4) mensaje += ' Como es con menos de 4 horas de anticipación, ese lugar ya no podrá reasignarse.';

    U.confirmar(mensaje, 'Cancelar sesión', { peligro: true, textoOk: 'Sí, cancelar' }).then(function (ok) {
      if (!ok) return;
      if (!DB.actualizar('sesiones', sesionId, { estado: 'cancelada' })) {
        toast('No se pudo cancelar la sesión.', 'error');
        return;
      }

      var destinoId = (o.quien === 'coach') ? sesion.socioId : sesion.coachId;
      if (destinoId) {
        DB.notificar(destinoId, {
          titulo: 'Sesión cancelada',
          cuerpo: 'La sesión del ' + U.fecha(sesion.fecha, 'diaMes') + ' a las ' + sesion.hora + ' fue cancelada.',
          tipo: 'sesion'
        });
      }
      toast('Sesión cancelada.', 'ok');
      if (typeof o.alGuardar === 'function') o.alGuardar();
      else AG.Router.refrescar();
    });
  }

  /** Marca una sesión como completada o no asistida, con notas opcionales. */
  function marcarEstado(sesionId, nuevoEstado, notas) {
    var sesion = DB.buscar('sesiones', sesionId);
    if (!sesion) { toast('Esa sesión ya no existe.', 'error'); return false; }

    var cambios = { estado: nuevoEstado };
    if (typeof notas === 'string') cambios.notasCoach = notas.trim();

    var ok = !!DB.actualizar('sesiones', sesionId, cambios);
    if (!ok) { toast('No se pudo actualizar la sesión.', 'error'); return false; }

    if (nuevoEstado === 'completada' && sesion.socioId) {
      DB.notificar(sesion.socioId, {
        titulo: 'Tu sesión quedó registrada',
        cuerpo: cambios.notasCoach ? 'Nota de tu coach: ' + U.truncar(cambios.notasCoach, 140) : 'Tu coach registró tu sesión como completada.',
        tipo: 'sesion',
        link: '#/socio/entrenador'
      });
    }
    toast(nuevoEstado === 'completada' ? 'Sesión marcada como completada.' : 'Sesión marcada como no asistida.', 'ok');
    return true;
  }

  /** Modal para que el coach cierre una sesión agendada con una nota. */
  function gestionar(sesionId) {
    var sesion = DB.buscar('sesiones', sesionId);
    if (!sesion) { toast('Esa sesión ya no existe.', 'error'); return null; }
    var socio = sesion.socioId ? DB.usuario(sesion.socioId) : null;

    return U.modal({
      titulo: 'Cerrar sesión',
      cuerpo: '<div class="persona mb">' + (socio ? U.avatar(socio) : '') +
          '<div class="persona-txt"><b>' + esc(socio ? U.nombreCompleto(socio) : 'Socio') + '</b>' +
          '<span>' + esc(U.fecha(sesion.fecha, 'largo') + ' · ' + sesion.hora) + '</span></div></div>' +
        '<div class="field"><label class="label" for="ss-notas">Notas para el socio (opcional)</label>' +
        '<textarea class="textarea" id="ss-notas" rows="3" maxlength="300" ' +
          'placeholder="Qué trabajaron, qué sigue…">' + esc(sesion.notasCoach || '') + '</textarea></div>',
      acciones: [
        { texto: 'Cerrar', clase: 'btn-ghost' },
        {
          texto: 'No asistió', clase: 'btn-outline',
          onClick: function (api) {
            var campo = api.root.querySelector('#ss-notas');
            marcarEstado(sesionId, 'no_asistio', campo ? campo.value : '');
            api.cerrar();
            AG.Router.refrescar();
            return false;
          }
        },
        {
          texto: 'Completada', clase: 'btn-primary', icono: 'check',
          onClick: function (api) {
            var campo = api.root.querySelector('#ss-notas');
            marcarEstado(sesionId, 'completada', campo ? campo.value : '');
            api.cerrar();
            AG.Router.refrescar();
            return false;
          }
        }
      ]
    });
  }

  /* =============================================================
     5. Modal de reserva (socio)
     ============================================================= */

  function diasHTML(coachId, seleccionada) {
    var html = '';
    for (var i = 0; i < 14; i++) {
      var f = U.sumaDias(U.hoy(), i);
      var dia = sinAcentos(DB.nombreDiaDe(f));
      var huecos = (typeof DB.huecosDe === 'function') ? (DB.huecosDe(coachId, f) || []) : [];
      var libres = 0;
      for (var k = 0; k < huecos.length; k++) if (huecos[k].libre) libres++;
      var sinHuecos = libres === 0;

      html += '<button type="button" class="chip-dia' + (f === seleccionada ? ' on' : '') +
        (i === 0 ? ' es-hoy' : '') + (sinHuecos ? ' sin-huecos' : '') + '" data-agendar-dia="' + f + '"' +
        (sinHuecos ? ' disabled' : '') + '>' +
        '<b>' + Number(f.slice(8, 10)) + '</b><span>' + esc(DIAS_ABREV[dia] || '') + '</span></button>';
    }
    return html;
  }

  function slotsHTML(coachId, fecha, sesionExistenteId) {
    var huecos = (typeof DB.huecosDe === 'function') ? (DB.huecosDe(coachId, fecha) || []) : [];
    if (!huecos.length) {
      return '<div class="vacio-amable"><span class="vacio-amable-icono">' + icono('calendario', 24) + '</span>' +
        '<b>Sin horarios este día</b><span>Elige otro día del calendario.</span></div>';
    }

    var esHoy = fecha === U.hoy();
    var ahora = minutosAhora();
    var html = '<div class="slots">';
    for (var i = 0; i < huecos.length; i++) {
      var h = huecos[i];
      var esMia = !!(sesionExistenteId && h.sesionId === sesionExistenteId);
      var pasado = esHoy && minutosDe(h.hora) <= ahora;
      var libre = h.libre && !pasado;
      var clase = 'slot' + (libre ? ' libre' : (esMia ? ' mio' : ' ocupado')) + (pasado && h.libre ? ' pasado' : '');

      html += '<button type="button" class="' + clase + '"' + (libre || esMia ? '' : ' disabled') +
        ' data-slot-hora="' + esc(h.hora) + '">' + esc(h.hora) +
        (esMia ? '<small>Tu sesión</small>' : '') + '</button>';
    }
    return html + '</div>';
  }

  function cuerpoAgendar(coach, fecha, sesionExistente) {
    var html = '<div class="persona mb">' + U.avatar(coach) +
      '<div class="persona-txt"><b>' + esc(U.nombreCompleto(coach)) + '</b>' +
      '<span>' + esc(coach.especialidad || 'Entrenador personal') + '</span></div></div>';

    if (sesionExistente) {
      html += '<p class="help txt-warn mb">Ya tienes una sesión esta semana el <b>' +
        esc(U.fecha(sesionExistente.fecha, 'largo') + ' a las ' + sesionExistente.hora) +
        '</b>. Si eliges otro horario, esa sesión se cancela y se agenda la nueva.</p>';
    }

    html += '<div class="field mb"><span class="label">Elige el día</span>' +
      '<div class="chip-dias" data-agendar-dias>' + diasHTML(coach.id, fecha) + '</div></div>';
    html += '<div class="field"><span class="label">Horarios disponibles</span>' +
      '<div data-agendar-slots>' + slotsHTML(coach.id, fecha, sesionExistente ? sesionExistente.id : null) + '</div></div>';

    return html;
  }

  function confirmarYAgendar(coach, socio, fecha, hora, existente, api, alGuardar) {
    function crear() {
      var sesion = DB.insertar('sesiones', {
        socioId: socio.id, coachId: coach.id, fecha: fecha, hora: hora, duracionMin: 60,
        tipo: 'entrenamiento', estado: 'agendada', objetivo: '', notasCoach: '', notasSocio: '',
        creada: U.hoy(), creadaPor: socio.id
      });
      if (!sesion) { toast('No se pudo agendar tu sesión.', 'error'); return; }

      DB.notificar(coach.id, {
        titulo: 'Nueva sesión agendada',
        cuerpo: U.nombreCompleto(socio) + ' agendó una sesión el ' + U.fecha(fecha, 'largo') + ' a las ' + hora + '.',
        tipo: 'sesion', link: '#/coach/sesiones'
      });
      toast('¡Listo! Tu sesión quedó agendada para el ' + U.fecha(fecha, 'largo') + ' a las ' + hora + '.', 'ok');
      api.cerrar();
      if (typeof alGuardar === 'function') alGuardar();
    }

    if (existente && existente.id) {
      U.confirmar(
        'Tu sesión del ' + U.fecha(existente.fecha, 'largo') + ' a las ' + existente.hora +
          ' se cancelará y se agenda esta nueva.',
        'Cambiar tu sesión', { textoOk: 'Sí, cambiar' }
      ).then(function (ok) {
        if (!ok) return;
        if (!DB.actualizar('sesiones', existente.id, { estado: 'cancelada' })) {
          toast('No se pudo mover tu sesión.', 'error');
          return;
        }
        crear();
      });
    } else {
      crear();
    }
  }

  /**
   * Modal de reserva de sesión para un socio.
   * @param {String} socioId
   * @param {{alGuardar:Function}} [opts]
   */
  function agendar(socioId, opts) {
    var o = opts || {};
    var socio = socioId ? DB.usuario(socioId) : null;
    if (!socio || socio.rol !== 'socio') { toast('No encontramos tu perfil de socio.', 'error'); return null; }

    if (!membresiaActiva(socio)) {
      toast('Tu membresía no está activa. Pasa a recepción para agendar tu sesión.', 'warn');
      return null;
    }

    var coach = coachDe(socio);
    if (!coach) {
      toast('Aún no tienes un entrenador asignado. Pide en recepción que te asignen uno.', 'warn');
      return null;
    }

    var existente = (typeof DB.sesionDeLaSemana === 'function') ? DB.sesionDeLaSemana(socioId) : null;
    if (existente && existente.estado === 'completada') {
      toast('Ya completaste tu sesión de esta semana. La próxima se agenda la semana entrante.', 'info');
      return null;
    }
    var sesionExistente = (existente && existente.estado === 'agendada') ? existente : null;

    var fechaEstado = { valor: sesionExistente ? sesionExistente.fecha : primeraFechaConHuecos(coach.id) };

    return U.modal({
      titulo: 'Agenda tu sesión con ' + primerNombre(coach),
      ancho: 'lg',
      cuerpo: cuerpoAgendar(coach, fechaEstado.valor, sesionExistente),
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root, api) {
        U.delegar(root, 'click', '[data-agendar-dia]:not([disabled])', function (e, el) {
          e.preventDefault();
          fechaEstado.valor = el.getAttribute('data-agendar-dia');
          var dias = root.querySelector('[data-agendar-dias]');
          if (dias) dias.innerHTML = diasHTML(coach.id, fechaEstado.valor);
          var slots = root.querySelector('[data-agendar-slots]');
          if (slots) slots.innerHTML = slotsHTML(coach.id, fechaEstado.valor, sesionExistente ? sesionExistente.id : null);
        });

        U.delegar(root, 'click', '.slot.libre', function (e, el) {
          e.preventDefault();
          confirmarYAgendar(coach, socio, fechaEstado.valor, el.getAttribute('data-slot-hora'), sesionExistente, api, o.alGuardar);
        });
      }
    });
  }

  /* =============================================================
     6. Pantalla del socio — 'socio/entrenador'
     ============================================================= */

  function accesoRestringido(rolEsperado) {
    var frase = rolEsperado === 'coach' ? 'los coaches' : (rolEsperado === 'director' ? 'la dirección' : 'los socios');
    return '<div class="page"><div class="card"><div class="card-body"><div class="empty">' +
      '<div class="empty-icono">' + icono('candado', 32) + '</div>' +
      '<p class="empty-texto">Esta pantalla es solo para ' + frase + '.</p>' +
    '</div></div></div></div>';
  }

  function cuerpoCoachSocio(socio, coach) {
    if (!coach) {
      return '<div class="card"><div class="card-body"><div class="vacio-amable">' +
        '<span class="vacio-amable-icono">' + icono('coach', 26) + '</span>' +
        '<b>Aún no tienes coach</b><span>Pasa a recepción y te asignan uno.</span></div></div></div>';
    }

    var wa = '';
    if (coach.telefono) {
      var tel = String(coach.telefono).replace(/\D/g, '');
      if (tel) wa = 'https://wa.me/' + tel + '?text=' + encodeURIComponent('Hola ' + U.nombreCompleto(coach) + ', soy ' + U.nombreCompleto(socio) + '.');
    }

    return '<div class="card"><div class="card-body">' +
      '<div class="persona">' + U.avatar(coach, 'lg') + '<div class="persona-txt">' +
        '<b>' + esc(U.nombreCompleto(coach)) + '</b><span>' + esc(coach.especialidad || 'Entrenador personal') + '</span></div></div>' +
      '<div class="row row-sm wrap mt">' +
        (wa ? '<a class="btn btn-primary btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + icono('whatsapp', 15) + 'WhatsApp</a>' : '') +
      '</div>' +
    '</div></div>';
  }

  function cuerpoProximaSesion(socio, coach) {
    var s = (typeof DB.sesionDeLaSemana === 'function') ? DB.sesionDeLaSemana(socio.id) : null;

    if (s && s.estado === 'agendada') {
      var acciones = '<button type="button" class="btn btn-outline btn-sm" data-agendar-cambiar>' + icono('calendario', 14) + ' Cambiar</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cancelar-sesion="' + esc(s.id) + '">' + icono('x', 14) + ' Cancelar</button>';
      return '<div class="card"><div class="card-head"><div class="card-title">' + icono('calendario', 18) + '<span>Tu próxima sesión</span></div></div>' +
        '<div class="card-body">' + tarjeta(s, { acciones: acciones }) + '</div></div>';
    }

    return '<div class="card"><div class="card-body"><div class="vacio-amable">' +
      '<span class="vacio-amable-icono">' + icono('calendario', 26) + '</span>' +
      '<b>Sin sesión esta semana</b><span>Tienes una a la semana con tu entrenador.</span>' +
      (coach ? '<button type="button" class="btn btn-primary btn-sm mt-sm" data-agendar-cambiar>' + icono('mas', 14) + ' Agendar mi sesión</button>' : '') +
    '</div></div></div>';
  }

  function cuerpoHistorial(socio) {
    var todas = (typeof DB.sesionesDe === 'function') ? DB.sesionesDe(socio.id) : [];
    var pasadas = todas.filter(function (s) { return s.estado !== 'agendada'; });
    pasadas.reverse();
    pasadas = pasadas.slice(0, 6);

    if (!pasadas.length) {
      return '<div class="card"><div class="card-body"><div class="vacio-amable">' +
        '<span class="vacio-amable-icono">' + icono('historial', 24) + '</span>' +
        '<b>Aún no tienes historial</b><span>Aquí verás tus sesiones pasadas.</span></div></div></div>';
    }

    var html = '<div class="card"><div class="card-head"><div class="card-title">' + icono('historial', 18) + '<span>Tu historial</span></div></div>' +
      '<div class="card-body"><div class="sesiones stack-sm">';
    for (var i = 0; i < pasadas.length; i++) html += tarjeta(pasadas[i], {});
    return html + '</div></div></div>';
  }

  function renderSocio(ctx) {
    var usuario = ctx.usuario;
    if (!esSocio(usuario)) return accesoRestringido('socio');

    var socio = DB.usuario(usuario.id) || usuario;
    var coach = coachDe(socio);

    var html = '<div class="page" data-si-entrenador>' +
      '<div class="page-head"><div>' +
        '<h1 class="page-title">' + icono('coach', 24) + '<span>Mi entrenador</span></h1>' +
        '<p class="page-sub">Agenda tu sesión de la semana y revisa tu historial.</p>' +
      '</div></div>' +
      '<div class="grid g2">' + cuerpoCoachSocio(socio, coach) + cuerpoProximaSesion(socio, coach) + '</div>' +
      cuerpoHistorial(socio) +
      '<div class="card"><div class="card-head"><div class="card-title">' + icono('trofeo', 18) + '<span>Eventos próximos</span></div></div>' +
        '<div class="card-body">' + (AG.Mod.Eventos && typeof AG.Mod.Eventos.tarjetas === 'function'
          ? AG.Mod.Eventos.tarjetas(usuario, 6)
          : '<div class="vacio-amable"><span class="vacio-amable-icono">' + icono('trofeo', 24) + '</span><b>Pronto habrá eventos</b></div>') +
      '</div></div>' +
    '</div>';

    return { html: html, listo: function (root) { engancharSocio(root, socio, coach); } };
  }

  function engancharSocio(root, socio, coach) {
    var raiz = root.querySelector('[data-si-entrenador]');
    if (!raiz || raiz.__seEntrenadorEnganchado) return;
    raiz.__seEntrenadorEnganchado = true;

    U.delegar(raiz, 'click', '[data-agendar-cambiar]', function (e) {
      e.preventDefault();
      agendar(socio.id, { alGuardar: function () { AG.Router.refrescar(); } });
    });

    U.delegar(raiz, 'click', '[data-cancelar-sesion]', function (e, el) {
      e.preventDefault();
      cancelar(el.getAttribute('data-cancelar-sesion'), { quien: 'socio' });
    });
  }

  /* =============================================================
     7. Pantalla del coach — 'coach/sesiones'
     ============================================================= */

  function diasSemanaOpcionesHTML(seleccionado) {
    var html = '';
    for (var i = 0; i < DIAS_ID.length; i++) {
      html += '<option value="' + DIAS_ID[i] + '"' + (DIAS_ID[i] === seleccionado ? ' selected' : '') + '>' +
        DIAS_NOMBRE[DIAS_ID[i]] + '</option>';
    }
    return html;
  }

  function formularioDisponibilidad(coachId, bloqueId) {
    var existente = bloqueId ? DB.buscar('disponibilidad', bloqueId) : null;
    var b = existente || { dia: 'lunes', desde: '07:00', hasta: '11:00', duracionMin: 60 };
    var duraciones = [30, 45, 60, 90];
    var opcionesDur = '';
    for (var i = 0; i < duraciones.length; i++) {
      opcionesDur += '<option value="' + duraciones[i] + '"' + (Number(b.duracionMin) === duraciones[i] ? ' selected' : '') + '>' + duraciones[i] + ' min</option>';
    }

    return U.modal({
      titulo: existente ? 'Editar horario' : 'Agregar horario',
      cuerpo: '<form data-form-disp autocomplete="off">' +
        '<div class="field mb"><label class="label" for="dp-dia">Día</label>' +
          '<select class="select" id="dp-dia" name="dia">' + diasSemanaOpcionesHTML(sinAcentos(b.dia)) + '</select></div>' +
        '<div class="row wrap">' +
          '<div class="field flex1 mb"><label class="label" for="dp-desde">Desde</label>' +
            '<input class="input" type="time" id="dp-desde" name="desde" value="' + esc(b.desde) + '"></div>' +
          '<div class="field flex1 mb"><label class="label" for="dp-hasta">Hasta</label>' +
            '<input class="input" type="time" id="dp-hasta" name="hasta" value="' + esc(b.hasta) + '"></div>' +
          '<div class="field flex1 mb"><label class="label" for="dp-dur">Cada</label>' +
            '<select class="select" id="dp-dur" name="duracionMin">' + opcionesDur + '</select></div>' +
        '</div>' +
        '<p class="help txt-error" data-error></p>' +
      '</form>',
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: existente ? 'Guardar' : 'Agregar', clase: 'btn-primary', icono: existente ? 'check' : 'mas',
          onClick: function (api) {
            var form = api.root.querySelector('[data-form-disp]');
            var crudo = U.formToObject(form);
            var desde = String(crudo.desde || ''), hasta = String(crudo.hasta || '');
            var ayuda = form.querySelector('[data-error]');

            if (!desde || !hasta || hasta <= desde) {
              if (ayuda) ayuda.textContent = 'La hora de fin debe ser después del inicio.';
              return false;
            }
            if (ayuda) ayuda.textContent = '';

            var datos = {
              coachId: coachId, dia: String(crudo.dia || 'lunes'), desde: desde, hasta: hasta,
              duracionMin: Number(crudo.duracionMin) || 60, activa: true
            };
            var ok = existente ? DB.actualizar('disponibilidad', existente.id, datos) : DB.insertar('disponibilidad', datos);
            if (!ok) { toast('No se pudo guardar el horario.', 'error'); return false; }

            toast(existente ? 'Horario actualizado.' : 'Horario agregado.', 'ok');
            api.cerrar();
            AG.Router.refrescar();
            return false;
          }
        }
      ]
    });
  }

  function eliminarDisponibilidad(bloqueId) {
    U.confirmar('Se eliminará este horario de tu disponibilidad.', 'Eliminar horario', { peligro: true, textoOk: 'Sí, eliminar' })
      .then(function (ok) {
        if (!ok) return;
        if (DB.eliminar('disponibilidad', bloqueId)) { toast('Horario eliminado.', 'ok'); AG.Router.refrescar(); }
        else toast('No se pudo eliminar el horario.', 'error');
      });
  }

  function disponibilidadListaHTML(coachId) {
    var bloques = (typeof DB.disponibilidadDe === 'function') ? DB.disponibilidadDe(coachId) : [];
    if (!bloques.length) {
      return '<div class="vacio-amable"><span class="vacio-amable-icono">' + icono('calendario', 24) + '</span>' +
        '<b>Aún no tienes horarios</b><span>Agrega cuándo puedes atender sesiones.</span></div>';
    }

    var html = '<div class="stack-sm">';
    for (var i = 0; i < bloques.length; i++) {
      var b = bloques[i];
      var nombreDia = DIAS_NOMBRE[sinAcentos(b.dia)] || b.dia;
      html += '<div class="list-item">' +
        '<div class="list-item-main"><b>' + esc(nombreDia) + '</b>' +
        '<span>' + esc(b.desde + ' a ' + b.hasta + ' · cada ' + (b.duracionMin || 60) + ' min') + (b.activa === false ? ' · Inactivo' : '') + '</span></div>' +
        '<div class="list-item-side row-sm">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-editar-disp="' + esc(b.id) + '">' + icono('editar', 14) + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-eliminar-disp="' + esc(b.id) + '">' + icono('basura', 14) + '</button>' +
        '</div></div>';
    }
    return html + '</div>';
  }

  function sesionesCoachAcciones(v) {
    if (v.estado !== 'agendada') return '';
    if (yaPaso(v)) {
      return '<button type="button" class="btn btn-primary btn-sm" data-gestionar-sesion="' + esc(v.id) + '">' + icono('check', 14) + ' Cerrar sesión</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cancelar-sesion="' + esc(v.id) + '">' + icono('x', 14) + ' Cancelar</button>';
    }
    return '<button type="button" class="btn btn-ghost btn-sm" data-cancelar-sesion="' + esc(v.id) + '">' + icono('x', 14) + ' Cancelar</button>';
  }

  function seccionSesionesCoach(coachId) {
    var todas = deCoach(coachId, U.sumaDias(U.hoy(), -21), U.sumaDias(U.hoy(), 30));
    var agendadas = todas.filter(function (s) { return s.estado === 'agendada'; });
    var porCerrar = agendadas.filter(function (s) { return yaPaso(s); });
    var proximas = agendadas.filter(function (s) { return !yaPaso(s); });

    var html = '';
    if (porCerrar.length) {
      html += '<div class="card"><div class="card-head"><div class="card-title">' + icono('alerta', 18) + '<span>Por cerrar</span></div>' +
        '<span class="badge badge-warn">' + porCerrar.length + '</span></div>' +
        '<div class="card-body"><div class="sesiones stack-sm">';
      for (var i = 0; i < porCerrar.length; i++) html += tarjeta(porCerrar[i], { verSocio: true, acciones: sesionesCoachAcciones(porCerrar[i]) });
      html += '</div></div></div>';
    }

    html += '<div class="card"><div class="card-head"><div class="card-title">' + icono('calendario', 18) + '<span>Próximas sesiones</span></div>' +
      '<span class="badge badge-muted">' + proximas.length + '</span></div><div class="card-body">';
    if (!proximas.length) {
      html += '<div class="vacio-amable"><span class="vacio-amable-icono">' + icono('calendario', 24) + '</span>' +
        '<b>No tienes sesiones agendadas</b><span>En cuanto un socio agende, aparecerá aquí.</span></div>';
    } else {
      html += '<div class="sesiones stack-sm">';
      for (var k = 0; k < Math.min(proximas.length, 10); k++) html += tarjeta(proximas[k], { verSocio: true, acciones: sesionesCoachAcciones(proximas[k]) });
      html += '</div>';
    }
    html += '</div></div>';

    return html;
  }

  function renderCoach(ctx) {
    var usuario = ctx.usuario;
    if (!esCoach(usuario)) return accesoRestringido('coach');

    var hoy = U.hoy();
    var semana = deCoach(usuario.id, DB.lunesDe(hoy), U.sumaDias(DB.lunesDe(hoy), 6));
    var deHoy = deCoach(usuario.id, hoy, hoy).filter(function (s) { return s.estado === 'agendada' || s.estado === 'completada'; });
    var huecosHoy = (typeof DB.huecosDe === 'function') ? DB.huecosDe(usuario.id, hoy) : [];
    var libresHoy = 0;
    for (var i = 0; i < huecosHoy.length; i++) if (huecosHoy[i].libre) libresHoy++;
    var porCerrarN = semana.filter(function (s) { return s.estado === 'agendada' && yaPaso(s); }).length;

    var html = '<div class="page" data-cs-sesiones>' +
      '<div class="page-head"><div>' +
        '<h1 class="page-title">' + icono('calendario', 24) + '<span>Sesiones</span></h1>' +
        '<p class="page-sub">Tus sesiones con socios y tu disponibilidad de la semana.</p>' +
      '</div></div>' +
      '<div class="tiles tiles-3">' +
        '<div class="tile calma"><div class="tile-icono">' + icono('calendario', 18) + '</div><div class="tile-datos">' +
          '<div class="tile-val">' + deHoy.length + '</div><div class="tile-label">sesiones hoy</div></div></div>' +
        '<div class="tile ok"><div class="tile-icono">' + icono('reloj', 18) + '</div><div class="tile-datos">' +
          '<div class="tile-val">' + libresHoy + '</div><div class="tile-label">huecos libres hoy</div></div></div>' +
        '<div class="tile ' + (porCerrarN ? 'warn' : 'neutro') + '"><div class="tile-icono">' + icono('alerta', 18) + '</div><div class="tile-datos">' +
          '<div class="tile-val">' + porCerrarN + '</div><div class="tile-label">por cerrar</div></div></div>' +
      '</div>' +
      seccionSesionesCoach(usuario.id) +
      '<div class="card"><div class="card-head"><div class="card-title">' + icono('config', 18) + '<span>Tu disponibilidad</span></div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-nueva-disp>' + icono('mas', 14) + ' Agregar horario</button>' +
      '</div><div class="card-body" data-disp-lista>' + disponibilidadListaHTML(usuario.id) + '</div></div>' +
    '</div>';

    return { html: html, listo: function (root) { engancharCoach(root, usuario); } };
  }

  function engancharCoach(root, usuario) {
    var raiz = root.querySelector('[data-cs-sesiones]');
    if (!raiz || raiz.__csSesionesEnganchado) return;
    raiz.__csSesionesEnganchado = true;

    U.delegar(raiz, 'click', '[data-gestionar-sesion]', function (e, el) {
      e.preventDefault();
      gestionar(el.getAttribute('data-gestionar-sesion'));
    });

    U.delegar(raiz, 'click', '[data-cancelar-sesion]', function (e, el) {
      e.preventDefault();
      cancelar(el.getAttribute('data-cancelar-sesion'), { quien: 'coach' });
    });

    U.delegar(raiz, 'click', '[data-nueva-disp]', function (e) {
      e.preventDefault();
      formularioDisponibilidad(usuario.id, null);
    });

    U.delegar(raiz, 'click', '[data-editar-disp]', function (e, el) {
      e.preventDefault();
      formularioDisponibilidad(usuario.id, el.getAttribute('data-editar-disp'));
    });

    U.delegar(raiz, 'click', '[data-eliminar-disp]', function (e, el) {
      e.preventDefault();
      eliminarDisponibilidad(el.getAttribute('data-eliminar-disp'));
    });
  }

  /* =============================================================
     8. Pantalla de dirección — 'director/sesiones'
     ============================================================= */

  function kpiHTML(nombreIcono, valor, etiqueta, variante) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(nombreIcono, 22) + '</div>' +
      '<div class="kpi-datos"><div class="kpi-val">' + esc(valor) + '</div>' +
      '<div class="kpi-label">' + esc(etiqueta) + '</div></div></div>';
  }

  function kpisDirector() {
    var hoy = U.hoy();
    var lunes = DB.lunesDe(hoy);
    var mes30 = U.sumaDias(hoy, -30);
    var todas = DB.get('sesiones');

    var hoyN = 0, semanaN = 0, completadas = 0, noAsistio = 0, porCerrar = 0;
    for (var i = 0; i < todas.length; i++) {
      var s = todas[i];
      var f = String(s.fecha || '').slice(0, 10);
      if (f === hoy && (s.estado === 'agendada' || s.estado === 'completada')) hoyN++;
      if (f >= lunes && f <= U.sumaDias(lunes, 6) && (s.estado === 'agendada' || s.estado === 'completada')) semanaN++;
      if (f >= mes30 && f <= hoy) {
        if (s.estado === 'completada') completadas++;
        if (s.estado === 'no_asistio') noAsistio++;
      }
      if (s.estado === 'agendada' && yaPaso(s)) porCerrar++;
    }

    var totalCierre = completadas + noAsistio;
    var tasa = totalCierre ? Math.round((completadas * 100) / totalCierre) : 0;

    return '<div class="grid g4">' +
      kpiHTML('calendario', String(hoyN), 'Sesiones hoy', '') +
      kpiHTML('coach', String(semanaN), 'Esta semana', 'kpi-info') +
      kpiHTML('check', tasa + '%', 'Asistencia (30 días)', tasa >= 80 ? 'kpi-ok' : (tasa >= 60 ? 'kpi-warn' : 'kpi-error')) +
      kpiHTML('alerta', String(porCerrar), 'Pendientes de cerrar', porCerrar ? 'kpi-warn' : '') +
    '</div>';
  }

  function filtrosDirectorHTML() {
    var coaches = DB.coaches();
    var html = '<div class="card"><div class="card-body"><div class="row wrap">' +
      '<div class="field"><select class="select" data-filtro-coach aria-label="Filtrar por coach"><option value="">Todos los coaches</option>';
    for (var i = 0; i < coaches.length; i++) {
      html += '<option value="' + esc(coaches[i].id) + '"' + (estado.filtroCoach === coaches[i].id ? ' selected' : '') + '>' +
        esc(U.nombreCompleto(coaches[i])) + '</option>';
    }
    html += '</select></div>' +
      '<div class="field"><select class="select" data-filtro-estado aria-label="Filtrar por estado"><option value="">Cualquier estado</option>';
    var claves = ['agendada', 'completada', 'cancelada', 'no_asistio'];
    for (var k = 0; k < claves.length; k++) {
      html += '<option value="' + claves[k] + '"' + (estado.filtroEstado === claves[k] ? ' selected' : '') + '>' + estadoBadge(claves[k]).texto + '</option>';
    }
    html += '</select></div></div></div></div>';
    return html;
  }

  function listaDirectorHTML() {
    var hoy = U.hoy();
    var desde = U.sumaDias(hoy, -7);
    var hasta = U.sumaDias(hoy, 21);
    var todas = DB.donde('sesiones', function (s) {
      var f = String(s.fecha || '').slice(0, 10);
      if (!f || f < desde || f > hasta) return false;
      if (estado.filtroCoach && s.coachId !== estado.filtroCoach) return false;
      if (estado.filtroEstado && s.estado !== estado.filtroEstado) return false;
      return true;
    });
    todas = U.ordenar(todas, function (s) { return s.fecha + ' ' + s.hora; }, 'asc');

    if (!todas.length) {
      return '<div class="card"><div class="card-body"><div class="empty">' +
        '<div class="empty-icono">' + icono('calendario', 32) + '</div>' +
        '<p class="empty-texto">No hay sesiones que coincidan con estos filtros.</p></div></div></div>';
    }

    var html = '<div class="card"><div class="card-body"><div class="sesiones stack-sm">';
    for (var i = 0; i < todas.length; i++) {
      var s = todas[i];
      var acciones = (s.estado === 'agendada')
        ? '<button type="button" class="btn btn-ghost btn-sm" data-cancelar-sesion="' + esc(s.id) + '">' + icono('x', 14) + ' Cancelar</button>'
        : '';
      html += tarjeta(s, { verSocio: true, verCoach: false, acciones: (acciones ? acciones : '') +
        '<span class="badge ' + estadoBadge(s.estado).badge + '">' + estadoBadge(s.estado).texto + '</span>' });
    }
    return html + '</div></div></div>';
  }

  function renderDirector(ctx) {
    var usuario = ctx.usuario;
    if (!esDirector(usuario)) return accesoRestringido('director');

    var html = '<div class="page" data-ds-sesiones>' +
      '<div class="page-head"><div>' +
        '<h1 class="page-title">' + icono('calendario', 24) + '<span>Sesiones</span></h1>' +
        '<p class="page-sub">Panorama de las sesiones con entrenador de todos los coaches.</p>' +
      '</div></div>' +
      '<div data-kpis>' + kpisDirector() + '</div>' +
      filtrosDirectorHTML() +
      '<div data-lista>' + listaDirectorHTML() + '</div>' +
    '</div>';

    return { html: html, listo: function (root) { engancharDirector(root); } };
  }

  function engancharDirector(root) {
    var raiz = root.querySelector('[data-ds-sesiones]');
    if (!raiz || raiz.__dsSesionesEnganchado) return;
    raiz.__dsSesionesEnganchado = true;

    function repintar() {
      var lista = raiz.querySelector('[data-lista]');
      if (lista) lista.innerHTML = listaDirectorHTML();
    }

    U.delegar(raiz, 'change', '[data-filtro-coach]', function (e, el) { estado.filtroCoach = el.value || ''; repintar(); });
    U.delegar(raiz, 'change', '[data-filtro-estado]', function (e, el) { estado.filtroEstado = el.value || ''; repintar(); });
    U.delegar(raiz, 'click', '[data-cancelar-sesion]', function (e, el) {
      e.preventDefault();
      cancelar(el.getAttribute('data-cancelar-sesion'), { quien: 'director', alGuardar: repintar });
    });
  }

  /* =============================================================
     9. Exposición y registro de rutas
     ============================================================= */

  AG.Mod.Sesiones = {
    agendar: agendar,
    proximaDe: proximaDe,
    deCoach: deCoach,
    tarjeta: tarjeta,
    cancelar: cancelar,
    marcarEstado: marcarEstado,
    gestionar: gestionar
  };

  AG.Router.registrar({
    path: 'socio/entrenador',
    roles: ['socio'],
    titulo: 'Mi entrenador',
    nav: { etiqueta: 'Mi entrenador', icono: 'coach', grupo: 'Mi entrenamiento', orden: 5 },
    render: renderSocio
  });

  AG.Router.registrar({
    path: 'coach/sesiones',
    roles: ['coach'],
    titulo: 'Sesiones',
    nav: { etiqueta: 'Sesiones', icono: 'calendario', grupo: 'Entrenamiento', orden: 2 },
    render: renderCoach
  });

  AG.Router.registrar({
    path: 'director/sesiones',
    roles: ['director'],
    titulo: 'Sesiones',
    nav: { etiqueta: 'Sesiones', icono: 'calendario', grupo: 'Operación', orden: 4 },
    render: renderDirector
  });
})(window.AG);
