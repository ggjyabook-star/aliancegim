/* =============================================================
   ALLIANCE GYM — AG.Mod.Asistencia
   Control de acceso (recepción), bitácora del día y análisis mensual
   de asistencias.

   Ruta: 'director/asistencia'  ·  Menú: Operación › Asistencia (3)

   API pública reutilizable por otras pantallas:
     AG.Mod.Asistencia.checkIn(socioId, opts)  -> registro de asistencia
     AG.Mod.Asistencia.resumenSocio(socioId)   -> HTML con racha y calendario

   JavaScript clásico: sin módulos, sin dependencias externas.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var Asistencia = {};

  /* =============================================================
     0. Constantes y estado de la pantalla
     ============================================================= */

  /* Días sin asistir a partir de los cuales un socio activo entra en riesgo */
  var DIAS_RIESGO = 10;

  /* Estados de membresía que exigen autorización expresa de dirección */
  var ESTADOS_BLOQUEO = { vencido: true, baja: true, congelado: true };

  /* Etiquetas de los días de la semana empezando en lunes */
  var DIAS_LUNES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIAS_LUNES_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /* Estado vivo de la pantalla (sobrevive a los repintados de la sección) */
  var estado = {
    pestana: 'recepcion',
    busqueda: '',
    socioId: null,
    mes: '',
    saludo: null          // { socioId, accion, hora, minutos, forzado }
  };

  /* =============================================================
     1. Ayudantes cortos
     ============================================================= */

  function esc(v) { return AG.Utils.esc(v); }

  function ic(nombre, tamano) {
    try { return AG.Icons.get(nombre, tamano || 18); } catch (e) { return ''; }
  }

  function dos(n) {
    var v = Math.floor(Number(n) || 0);
    return (v < 10 ? '0' : '') + v;
  }

  /** Hora local en formato 'HH:MM'. */
  function horaAhora() {
    var f = new Date();
    return dos(f.getHours()) + ':' + dos(f.getMinutes());
  }

  /** 'HH:MM' -> hora entera 0..23, o null si no es válida. */
  function horaNum(texto) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(texto === null || texto === undefined ? '' : texto));
    if (!m) return null;
    var h = Number(m[1]);
    return (h >= 0 && h <= 23) ? h : null;
  }

  /** 'HH:MM' -> minutos desde medianoche, o null. */
  function minutosDe(texto) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(texto === null || texto === undefined ? '' : texto));
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  /** '95' -> '1 h 35 min' */
  function duracionTexto(minutos) {
    var m = Math.max(0, Math.round(Number(minutos) || 0));
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  /** 'badge-ok' -> 'ok' (para AG.Utils.badge). */
  function tipoDeClase(clase) {
    return String(clase || 'badge-muted').replace('badge-', '') || 'muted';
  }

  function nombreGym() {
    try {
      var s = AG.DB.state.settings;
      if (s && s.nombreGym) return String(s.nombreGym);
    } catch (e) { /* se usa el respaldo */ }
    return 'Alliance Gym';
  }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  /** Índice 0..6 con lunes = 0 a partir de 'YYYY-MM-DD'. */
  function diaLunes(fecha) {
    var d = AG.Utils.aDate(fecha);
    if (!d) return null;
    return (d.getDay() + 6) % 7;
  }

  /** ¿La sesión actual puede trabajar con este socio? */
  function puedeVer(socioId) {
    var actual = null;
    try { actual = AG.Auth.actual(); } catch (e) { actual = null; }
    if (!actual) return false;
    return AG.Auth.puedeVer(actual, socioId);
  }

  /** Teléfono listo para wa.me (agrega lada 52 a los números de 10 dígitos). */
  function telWhatsApp(tel) {
    var digitos = String(tel === null || tel === undefined ? '' : tel).replace(/[^0-9]/g, '');
    if (!digitos) return '';
    if (digitos.length === 10) digitos = '52' + digitos;
    return digitos;
  }

  /* =============================================================
     2. Consultas sobre la base
     ============================================================= */

  /** Todas las asistencias de un día 'YYYY-MM-DD'. */
  function asistenciasDelDia(fecha) {
    var dia = String(fecha || '').slice(0, 10);
    return AG.DB.donde('asistencias', function (a) {
      return !!a && typeof a.fecha === 'string' && a.fecha.slice(0, 10) === dia;
    });
  }

  /** Todas las asistencias de un mes 'YYYY-MM'. */
  function asistenciasDelMes(mes) {
    var m = String(mes || '').slice(0, 7);
    return AG.DB.donde('asistencias', function (a) {
      return !!a && typeof a.fecha === 'string' && a.fecha.slice(0, 7) === m;
    });
  }

  /** Registro de hoy de un socio que todavía no tiene salida. */
  function entradaAbierta(socioId) {
    var hoy = AG.Utils.hoy();
    var lista = AG.DB.donde('asistencias', function (a) {
      return !!a && a.socioId === socioId && typeof a.fecha === 'string' &&
        a.fecha.slice(0, 10) === hoy && !a.salida;
    });
    if (!lista.length) return null;
    return AG.Utils.ordenar(lista, 'entrada', 'desc')[0];
  }

  /** Registros de hoy de un socio, del más antiguo al más reciente. */
  function registrosDeHoy(socioId) {
    var hoy = AG.Utils.hoy();
    var lista = AG.DB.donde('asistencias', function (a) {
      return !!a && a.socioId === socioId && typeof a.fecha === 'string' && a.fecha.slice(0, 10) === hoy;
    });
    return AG.Utils.ordenar(lista, 'entrada', 'asc');
  }

  /** Mapa { socioId: 'YYYY-MM-DD' } con la última visita de cada socio. */
  function ultimaVisitaPorSocio() {
    var mapa = {};
    var lista = AG.DB.get('asistencias');
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!a || !a.socioId || typeof a.fecha !== 'string') continue;
      var f = a.fecha.slice(0, 10);
      if (!mapa[a.socioId] || f > mapa[a.socioId]) mapa[a.socioId] = f;
    }
    return mapa;
  }

  /** Busca socios por código, nombre, apellidos, teléfono o correo. */
  function buscarSocios(texto, limite) {
    var q = AG.Utils.normalizar(texto);
    if (!q) return [];
    var soloDigitos = q.replace(/[^0-9]/g, '');
    var socios = AG.DB.socios();
    var salida = [];
    var max = limite || 8;

    for (var i = 0; i < socios.length && salida.length < 60; i++) {
      var s = socios[i];
      if (!s || !puedeVer(s.id)) continue;

      var nombre = AG.Utils.normalizar(AG.Utils.nombreCompleto(s));
      var codigo = AG.Utils.normalizar(s.codigo);
      var correo = AG.Utils.normalizar(s.email);
      var tel = String(s.telefono || '').replace(/[^0-9]/g, '');

      var puntos = -1;
      if (codigo && codigo.indexOf(q) === 0) puntos = 0;
      else if (nombre.indexOf(q) === 0) puntos = 1;
      else if (soloDigitos && tel && tel.indexOf(soloDigitos) >= 0) puntos = 2;
      else if (nombre.indexOf(q) > 0) puntos = 3;
      else if (codigo.indexOf(q) > 0) puntos = 4;
      else if (correo.indexOf(q) >= 0) puntos = 5;

      if (puntos < 0) continue;
      salida.push({ socio: s, puntos: puntos, nombre: nombre });
    }

    salida.sort(function (a, b) {
      if (a.puntos !== b.puntos) return a.puntos - b.puntos;
      return a.nombre < b.nombre ? -1 : (a.nombre > b.nombre ? 1 : 0);
    });

    var resultado = [];
    for (var j = 0; j < salida.length && j < max; j++) resultado.push(salida[j].socio);
    return resultado;
  }

  /** ¿Hoy es el cumpleaños del socio? */
  function esCumpleanos(socio) {
    if (!socio || typeof socio.fechaNacimiento !== 'string') return false;
    var nace = socio.fechaNacimiento.slice(5, 10);
    if (!/^\d{2}-\d{2}$/.test(nace)) return false;
    return nace === AG.Utils.hoy().slice(5, 10);
  }

  /**
   * Día de rutina que le toca hoy al socio.
   * Se deduce de su última bitácora: si ya entrenó hoy repite ese día,
   * si no, avanza al siguiente de la rutina activa.
   */
  function entrenamientoDeHoy(socioId) {
    var activa = AG.DB.rutinaActivaDe(socioId);
    if (!activa || !activa.rutina || !esArreglo(activa.rutina.dias) || !activa.rutina.dias.length) return null;

    var dias = activa.rutina.dias;
    var bitacoras = AG.DB.bitacorasDe(socioId);   // más reciente primero
    var indice = 0;

    if (bitacoras.length) {
      var ultima = bitacoras[0];
      var i = Number(ultima.diaIndex);
      if (!isFinite(i) || i < 0) i = 0;
      var mismaFecha = String(ultima.fecha || '').slice(0, 10) === AG.Utils.hoy();
      indice = mismaFecha ? (i % dias.length) : ((i + 1) % dias.length);
    }

    var dia = dias[indice];
    if (!dia || typeof dia !== 'object') return null;

    return {
      indice: indice,
      nombre: dia.nombre || ('Día ' + (indice + 1)),
      enfoque: dia.enfoque || '',
      rutina: activa.rutina.nombre || 'Rutina asignada',
      ejercicios: esArreglo(dia.ejercicios) ? dia.ejercicios.length : 0
    };
  }

  /* =============================================================
     3. Registro de asistencia (núcleo reutilizable)
     ============================================================= */

  /**
   * Motor del check-in. No pinta nada ni avisa: solo decide y guarda.
   * @returns {{registro:Object|null, accion:String, error:String, estado:Object|null}}
   *          accion: 'entrada' | 'salida' | 'repetida'
   *          error:  '' | 'no_socio' | 'sin_permiso' | 'bloqueada'
   */
  function ejecutarCheckIn(socioId, opts) {
    var o = opts || {};
    var salida = { registro: null, accion: '', error: '', estado: null };

    var socio = AG.DB.usuario(socioId);
    if (!socio || socio.rol !== 'socio') {
      salida.error = 'no_socio';
      return salida;
    }
    if (!puedeVer(socio.id)) {
      salida.error = 'sin_permiso';
      return salida;
    }

    var previos = registrosDeHoy(socio.id);
    var abierta = null;
    for (var i = previos.length - 1; i >= 0; i--) {
      if (!previos[i].salida) { abierta = previos[i]; break; }
    }

    /* Ya está dentro: el segundo toque registra la salida */
    if (abierta) {
      var actualizada = AG.DB.actualizar('asistencias', abierta.id, { salida: horaAhora() });
      salida.registro = actualizada || abierta;
      salida.accion = 'salida';
      return salida;
    }

    /* Ya entró y ya salió: no se duplica el día */
    if (previos.length) {
      salida.registro = previos[previos.length - 1];
      salida.accion = 'repetida';
      return salida;
    }

    /* Membresía: vencida, congelada o de baja exigen autorización */
    var membresia = AG.Calc.estadoMembresia(socio);
    salida.estado = membresia;
    if (ESTADOS_BLOQUEO[membresia.estado] && o.forzar !== true) {
      salida.error = 'bloqueada';
      return salida;
    }

    var registro = {
      socioId: socio.id,
      fecha: AG.Utils.hoy(),
      entrada: horaAhora(),
      salida: null
    };
    if (o.nota) registro.nota = String(o.nota);

    salida.registro = AG.DB.insertar('asistencias', registro);
    salida.accion = 'entrada';
    return salida;
  }

  /**
   * Registra la asistencia del día de un socio.
   * Si ya tiene entrada abierta, registra la salida en su lugar.
   * Guarda en la base y devuelve el registro (o null si no se pudo).
   *
   * @param {String} socioId
   * @param {{forzar:Boolean, nota:String, silencioso:Boolean}} [opts]
   * @returns {Object|null} el registro de asistencia
   */
  Asistencia.checkIn = function (socioId, opts) {
    var o = opts || {};
    var r = ejecutarCheckIn(socioId, o);
    var socio = AG.DB.usuario(socioId);
    var nombre = socio ? AG.Utils.nombreCompleto(socio) : 'El socio';

    if (r.error) {
      if (!o.silencioso) {
        if (r.error === 'no_socio') AG.Utils.toast('No encontramos a ese socio en la base.', 'error');
        else if (r.error === 'sin_permiso') AG.Utils.toast('No tienes permiso para registrar a este socio.', 'error');
        else AG.Utils.toast('Membresía no vigente: se necesita autorización de dirección.', 'warn');
      }
      return null;
    }

    if (!o.silencioso) {
      if (r.accion === 'entrada') {
        AG.Utils.toast('Entrada registrada · ' + nombre, 'ok');
      } else if (r.accion === 'salida') {
        AG.Utils.toast('Salida registrada · ' + nombre, 'info');
      } else {
        AG.Utils.toast(nombre + ' ya registró entrada y salida hoy.', 'info');
      }
    }

    return r.registro;
  };

  /* =============================================================
     4. Resumen de asistencia de un socio (reutilizable)
     ============================================================= */

  function kpi(icono, valor, etiqueta, tono) {
    return '' +
      '<div class="kpi' + (tono ? ' kpi-' + tono : '') + '">' +
        '<div class="kpi-icono">' + ic(icono, 22) + '</div>' +
        '<div class="kpi-datos">' +
          '<div class="kpi-val">' + esc(valor) + '</div>' +
          '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        '</div>' +
      '</div>';
  }

  function vacio(mensaje, icono) {
    return '' +
      '<div class="empty">' +
        '<div class="empty-icono">' + ic(icono || 'qr', 30) + '</div>' +
        '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      '</div>';
  }

  /**
   * HTML con la racha, las asistencias del mes, el promedio semanal
   * y el calendario del mes en curso de un socio.
   * @param {String} socioId
   * @returns {String} HTML
   */
  Asistencia.resumenSocio = function (socioId) {
    var socio = AG.DB.usuario(socioId);
    if (!socio || socio.rol !== 'socio') {
      return vacio('No encontramos a ese socio en la base.', 'usuario');
    }
    if (!puedeVer(socio.id)) {
      return vacio('No tienes permiso para ver la asistencia de este socio.', 'candado');
    }

    var todas = AG.DB.asistenciasDe(socio.id);
    if (!todas.length) {
      return vacio(AG.Utils.nombreCompleto(socio) + ' todavía no tiene visitas registradas.', 'qr');
    }

    var mes = AG.Utils.mesActual();
    var hoy = AG.Utils.hoy();
    var delMes = [];
    var ultimas28 = 0;
    var desde28 = AG.Utils.sumaDias(hoy, -27);
    var i, f;

    for (i = 0; i < todas.length; i++) {
      f = String(todas[i].fecha || '').slice(0, 10);
      if (!f) continue;
      if (f.slice(0, 7) === mes) delMes.push({ fecha: f, valor: 1 });
      if (f >= desde28 && f <= hoy) ultimas28++;
    }

    var racha = AG.Calc.rachaDias(todas);
    var promedioSemanal = Math.round((ultimas28 / 4) * 10) / 10;
    var ultima = String(todas[0].fecha || '').slice(0, 10);

    var html = '' +
      '<div class="stack">' +
        '<div class="grid g4 gap-sm">' +
          kpi('fuego', racha + (racha === 1 ? ' día' : ' días'), 'Racha actual', racha > 0 ? 'ok' : null) +
          kpi('calendario', String(delMes.length), 'Este mes', null) +
          kpi('grafica', AG.Utils.num(promedioSemanal, 1), 'Promedio semanal', 'info') +
          kpi('historial', String(todas.length), 'Visitas totales', null) +
        '</div>' +
        '<p class="mini muted">Última visita: <b>' + esc(AG.Utils.fecha(ultima, 'corto')) + '</b> · ' +
          esc(AG.Utils.fechaRelativa(ultima)) + '</p>' +
        '<div>' +
          '<div class="micro muted mb-sm">' + esc(AG.Utils.nombreMes(mes)) + '</div>' +
          AG.Charts.calendario(delMes, {
            periodo: mes,
            celda: 28,
            etiquetaValor: 'visita',
            vacio: 'Sin visitas registradas en ' + AG.Utils.nombreMes(mes) + '.'
          }) +
        '</div>' +
      '</div>';

    return html;
  };

  /* =============================================================
     5. Pestaña RECEPCIÓN
     ============================================================= */

  function htmlBuscador() {
    return '' +
      '<div class="card ag-asis-buscar">' +
        '<div class="card-body stack-sm">' +
          '<label class="label" for="ag-asis-q">' + ic('qr', 15) + 'Control de acceso</label>' +
          '<div class="input-icono">' +
            ic('buscar', 17) +
            '<input class="input" id="ag-asis-q" type="search" autocomplete="off" ' +
              'placeholder="Código, nombre o teléfono del socio…" ' +
              'aria-label="Buscar socio por código, nombre o teléfono" ' +
              'value="' + esc(estado.busqueda) + '" data-buscar>' +
          '</div>' +
          '<p class="help">Escribe al menos dos caracteres. Elige al socio de la lista para registrar su entrada o salida.</p>' +
        '</div>' +
      '</div>';
  }

  function htmlResultados() {
    var q = String(estado.busqueda || '').trim();
    if (q.length < 2) return '';

    var encontrados = buscarSocios(q, 8);
    if (!encontrados.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('Ningún socio coincide con «' + q + '». Revisa el código o intenta con el apellido.', 'buscar') +
        '</div></div>';
    }

    var filas = '';
    for (var i = 0; i < encontrados.length; i++) {
      var s = encontrados[i];
      var est = AG.Calc.estadoMembresia(s);
      var plan = AG.DB.plan(s.planId);
      filas += '' +
        '<button type="button" class="list-item clickable" data-elegir="' + esc(s.id) + '">' +
          AG.Utils.avatar(s, 'sm') +
          '<div class="list-item-main">' +
            '<b>' + esc(AG.Utils.nombreCompleto(s)) + '</b>' +
            '<span>' + esc(s.codigo || 'Sin código') +
              (plan ? ' · ' + esc(plan.nombre) : '') +
              (s.telefono ? ' · ' + esc(s.telefono) : '') + '</span>' +
          '</div>' +
          '<div class="list-item-side">' + AG.Utils.badge(est.texto, tipoDeClase(est.clase)) + '</div>' +
        '</button>';
    }

    return '' +
      '<div class="card">' +
        '<div class="card-head"><div><h3 class="card-title">' + ic('socios', 17) + 'Resultados</h3>' +
          '<p class="card-sub">' + encontrados.length + (encontrados.length === 1 ? ' socio encontrado' : ' socios encontrados') + '</p></div></div>' +
        '<div class="card-body"><div class="list ag-asis-res">' + filas + '</div></div>' +
      '</div>';
  }

  function htmlSaludo(socio) {
    var s = estado.saludo;
    if (!s || s.socioId !== socio.id) return '';

    var nombreCorto = esc(socio.nombre || AG.Utils.nombreCompleto(socio));

    if (s.accion === 'salida') {
      var dur = (s.minutos !== null && s.minutos !== undefined && s.minutos >= 0)
        ? ' · Permaneció ' + duracionTexto(s.minutos)
        : '';
      return '' +
        '<div class="aviso aviso-info mt">' + ic('reloj', 18) +
          '<div><b>Salida registrada a las ' + esc(s.hora) + '</b>' +
            '<div class="mini">Gracias por entrenar, ' + nombreCorto + dur + '. ¡Te esperamos mañana!</div>' +
          '</div>' +
        '</div>';
    }

    if (s.accion === 'repetida') {
      return '' +
        '<div class="aviso aviso-warn mt">' + ic('info', 18) +
          '<div><b>Ya tiene entrada y salida registradas hoy</b>' +
            '<div class="mini">No se duplicó el registro para no alterar las estadísticas del día.</div>' +
          '</div>' +
        '</div>';
    }

    /* Entrada */
    var racha = AG.Calc.rachaDias(AG.DB.asistenciasDe(socio.id));
    var entreno = entrenamientoDeHoy(socio.id);
    var textoRacha = racha > 1
      ? 'Llevas una racha de <b>' + racha + ' días</b> seguidos. ¡No la sueltes!'
      : (racha === 1 ? 'Hoy arranca tu racha. ¡A construirla!' : 'Bienvenido de vuelta.');

    var textoEntreno = entreno
      ? 'Entrenamiento de hoy: <b>' + esc(entreno.nombre) + '</b>' +
        (entreno.enfoque ? ' · ' + esc(entreno.enfoque) : '') +
        (entreno.ejercicios ? ' <span class="muted">(' + entreno.ejercicios + ' ejercicios)</span>' : '')
      : 'Todavía no tiene una rutina asignada: pásalo con su coach.';

    return '' +
      '<div class="aviso ' + (s.forzado ? 'aviso-warn' : 'aviso-ok') + ' mt">' + ic('check', 18) +
        '<div>' +
          '<b>¡Bienvenido, ' + nombreCorto + '! Entrada a las ' + esc(s.hora) + '</b>' +
          '<div class="mini mt-sm">' + textoRacha + '</div>' +
          '<div class="mini">' + textoEntreno + '</div>' +
          (s.forzado ? '<div class="mini txt-warn mt-sm">Acceso autorizado por dirección con la membresía no vigente.</div>' : '') +
        '</div>' +
      '</div>';
  }

  function htmlFicha() {
    if (!estado.socioId) {
      return '<div class="card"><div class="card-body">' +
        vacio('Busca a un socio para ver su membresía y registrar su acceso.', 'qr') +
        '</div></div>';
    }

    var socio = AG.DB.usuario(estado.socioId);
    if (!socio || socio.rol !== 'socio') {
      return '<div class="card"><div class="card-body">' +
        vacio('El socio seleccionado ya no existe en la base.', 'usuario') +
        '</div></div>';
    }
    if (!puedeVer(socio.id)) {
      return '<div class="card"><div class="card-body">' +
        vacio('No tienes permiso para ver la ficha de este socio.', 'candado') +
        '</div></div>';
    }

    var est = AG.Calc.estadoMembresia(socio);
    var bloqueada = !!ESTADOS_BLOQUEO[est.estado];
    var plan = AG.DB.plan(socio.planId);
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    var pagos = AG.DB.pagosDe(socio.id);
    var meses = AG.Calc.mesesDeMembresia(socio, pagos);
    var asistencias = AG.DB.asistenciasDe(socio.id);
    var racha = AG.Calc.rachaDias(asistencias);
    var abierta = entradaAbierta(socio.id);
    var previos = registrosDeHoy(socio.id);
    var ultima = asistencias.length ? String(asistencias[0].fecha || '').slice(0, 10) : '';

    var mesActual = AG.Utils.mesActual();
    var delMes = 0;
    for (var i = 0; i < asistencias.length; i++) {
      if (String(asistencias[i].fecha || '').slice(0, 7) === mesActual) delMes++;
    }

    /* --- Avisos de membresía y cumpleaños --- */
    var avisos = '';
    if (est.estado === 'vencido') {
      var vencidos = Math.abs(Number(est.diasRestantes) || 0);
      avisos += '<div class="aviso aviso-error mt">' + ic('alerta', 18) +
        '<div><b>Membresía vencida hace ' + vencidos + (vencidos === 1 ? ' día' : ' días') + '</b>' +
        '<div class="mini">Cobra la renovación antes de darle acceso. Si dirección autoriza el paso, quedará registrado con nota.</div></div></div>';
    } else if (est.estado === 'congelado') {
      avisos += '<div class="aviso aviso-warn mt">' + ic('luna', 18) +
        '<div><b>Membresía congelada</b><div class="mini">Reactívala en la ficha del socio o autoriza el acceso de forma excepcional.</div></div></div>';
    } else if (est.estado === 'baja') {
      avisos += '<div class="aviso aviso-error mt">' + ic('x', 18) +
        '<div><b>Socio dado de baja</b><div class="mini">Necesita reinscribirse para volver a entrenar.</div></div></div>';
    } else if (est.estado === 'por_vencer') {
      avisos += '<div class="aviso aviso-warn mt">' + ic('reloj', 18) +
        '<div><b>' + esc(est.texto) + '</b><div class="mini">Buen momento para invitarle a renovar en recepción.</div></div></div>';
    }

    if (esCumpleanos(socio)) {
      var anios = AG.Utils.edad(socio.fechaNacimiento);
      avisos += '<div class="aviso aviso-rojo mt">' + ic('trofeo', 18) +
        '<div><b>¡Hoy cumple años!</b><div class="mini">' + esc(AG.Utils.nombreCompleto(socio)) +
        (anios ? ' cumple ' + anios + ' años' : '') + '. Felicítale de parte de todo ' + esc(nombreGym()) + '.</div></div></div>';
    }

    /* --- Botones --- */
    var botones = '';
    if (abierta) {
      botones += '<button type="button" class="btn btn-primary btn-lg" data-accion="salida">' +
        ic('salir', 18) + 'Registrar salida</button>';
      botones += '<span class="pill pill-ok">' + ic('reloj', 14) + 'Dentro desde las <b>' + esc(abierta.entrada || '--:--') + '</b></span>';
    } else if (previos.length) {
      botones += '<button type="button" class="btn btn-ok btn-lg" disabled>' + ic('check', 18) + 'Visita completada hoy</button>';
      botones += '<span class="pill">' + ic('reloj', 14) + esc(previos[previos.length - 1].entrada || '--:--') +
        ' → ' + esc(previos[previos.length - 1].salida || '--:--') + '</span>';
    } else {
      botones += '<button type="button" class="btn btn-ok btn-lg" data-accion="entrada">' +
        ic('check', 18) + 'Registrar entrada</button>';
    }

    if (bloqueada) {
      botones += '<button type="button" class="btn btn-primary" data-accion="cobrar">' + ic('dinero', 17) + 'Cobrar ahora</button>';
    }
    botones += '<button type="button" class="btn btn-outline" data-accion="resumen">' + ic('grafica', 17) + 'Ver resumen</button>';
    botones += '<button type="button" class="btn btn-ghost" data-accion="limpiar">' + ic('x', 17) + 'Cambiar de socio</button>';

    return '' +
      '<div class="card' + (bloqueada ? ' card-rojo' : '') + '">' +
        '<div class="card-body">' +
          '<div class="row wrap" style="gap:18px;align-items:flex-start">' +
            AG.Utils.avatar(socio, 'xl') +
            '<div class="flex1" style="min-width:200px">' +
              '<div class="ag-asis-nombre">' + esc(AG.Utils.nombreCompleto(socio)) + '</div>' +
              '<p class="mini muted">' + esc(socio.codigo || 'Sin código') +
                (plan ? ' · Plan ' + esc(plan.nombre) : ' · Sin plan') +
                (coach ? ' · Coach ' + esc(AG.Utils.nombreCompleto(coach)) : '') + '</p>' +
              '<div class="row-sm wrap mt-sm">' +
                AG.Utils.badge(est.texto, tipoDeClase(est.clase)) +
                (socio.telefono ? '<span class="pill">' + ic('telefono', 13) + esc(socio.telefono) + '</span>' : '') +
                (racha > 0 ? '<span class="pill pill-rojo">' + ic('fuego', 13) + 'Racha ' + racha + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="datos-grid mt">' +
            '<div class="dato"><span class="dato-label">Días restantes</span><span class="dato-val ' +
              (est.diasRestantes > 0 ? 'txt-ok' : 'txt-error') + '">' +
              (est.vence ? esc(String(est.diasRestantes)) : '—') + '</span></div>' +
            '<div class="dato"><span class="dato-label">Vence</span><span class="dato-val">' +
              (est.vence ? esc(AG.Utils.fecha(est.vence, 'corto')) : 'Sin fecha') + '</span></div>' +
            '<div class="dato"><span class="dato-label">Meses acumulados</span><span class="dato-val">' +
              esc(String(meses)) + '</span></div>' +
            '<div class="dato"><span class="dato-label">Antigüedad</span><span class="dato-val">' +
              esc(AG.Calc.antiguedadTexto(socio.fechaAlta)) + '</span></div>' +
            '<div class="dato"><span class="dato-label">Visitas del mes</span><span class="dato-val">' +
              esc(String(delMes)) + '</span></div>' +
            '<div class="dato"><span class="dato-label">Última visita</span><span class="dato-val">' +
              (ultima ? esc(AG.Utils.fechaRelativa(ultima)) : 'Nunca') + '</span></div>' +
          '</div>' +

          avisos +
          htmlSaludo(socio) +

          '<div class="row wrap mt" style="gap:8px">' + botones + '</div>' +
        '</div>' +
      '</div>';
  }

  function htmlRecepcion() {
    return '' +
      '<div class="stack">' +
        htmlBuscador() +
        '<div id="ag-asis-resultados">' + htmlResultados() + '</div>' +
        '<div id="ag-asis-ficha">' + htmlFicha() + '</div>' +
      '</div>';
  }

  /* =============================================================
     6. Pestaña HOY
     ============================================================= */

  function htmlHoy() {
    var hoy = AG.Utils.hoy();
    var lista = asistenciasDelDia(hoy);

    if (!lista.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('Todavía no hay entradas registradas hoy, ' + AG.Utils.fecha(hoy, 'largo') + '.', 'qr') +
        '</div></div>';
    }

    var ordenadas = AG.Utils.ordenar(lista, 'entrada', 'desc');
    var dentro = 0, salieron = 0, i;
    var horas = [];
    for (i = 0; i < 24; i++) horas.push(0);

    for (i = 0; i < lista.length; i++) {
      if (lista[i].salida) salieron++; else dentro++;
      var h = horaNum(lista[i].entrada);
      if (h !== null) horas[h]++;
    }

    var horaPico = -1, maxPico = 0;
    for (i = 0; i < 24; i++) {
      if (horas[i] > maxPico) { maxPico = horas[i]; horaPico = i; }
    }

    /* Aforo por hora: solo el tramo con actividad */
    var primera = -1, ultima = -1;
    for (i = 0; i < 24; i++) {
      if (horas[i] > 0) { if (primera < 0) primera = i; ultima = i; }
    }
    var datosHoras = [];
    for (i = primera; i >= 0 && i <= ultima; i++) {
      datosHoras.push({
        etiqueta: dos(i) + ':00',
        valor: horas[i],
        color: (i === horaPico) ? AG.Charts.color(0) : AG.Charts.color(5)
      });
    }

    /* Lista de movimientos del día */
    var filas = '';
    for (i = 0; i < ordenadas.length; i++) {
      var a = ordenadas[i];
      var socio = AG.DB.usuario(a.socioId);
      var nombre = socio ? AG.Utils.nombreCompleto(socio) : 'Socio dado de baja';
      var avatar = socio ? AG.Utils.avatar(socio, 'sm') : '<div class="avatar avatar-sm">?</div>';
      var permanencia = '';
      var mEnt = minutosDe(a.entrada), mSal = minutosDe(a.salida);
      if (mEnt !== null && mSal !== null && mSal >= mEnt) permanencia = ' · ' + duracionTexto(mSal - mEnt);

      filas += '' +
        '<div class="list-item">' +
          avatar +
          '<div class="list-item-main">' +
            '<b>' + esc(nombre) + '</b>' +
            '<span>' + esc(socio && socio.codigo ? socio.codigo : 'Sin código') +
              ' · Entrada ' + esc(a.entrada || '--:--') +
              (a.salida ? ' · Salida ' + esc(a.salida) : '') + esc(permanencia) +
              (a.nota ? ' · ' + esc(a.nota) : '') + '</span>' +
          '</div>' +
          '<div class="list-item-side">' +
            (a.salida
              ? AG.Utils.badge('Salió', 'muted')
              : AG.Utils.badge('Dentro', 'ok')) +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div class="stack">' +
        '<div class="grid g4 gap-sm">' +
          kpi('qr', String(lista.length), 'Entradas de hoy', null) +
          kpi('socios', String(dentro), 'Dentro ahora', dentro > 0 ? 'ok' : null) +
          kpi('salir', String(salieron), 'Ya salieron', 'info') +
          kpi('reloj', horaPico >= 0 ? dos(horaPico) + ':00' : '—', 'Hora pico', 'warn') +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><div>' +
            '<h3 class="card-title">' + ic('grafica', 17) + 'Aforo por hora</h3>' +
            '<p class="card-sub">' + esc(AG.Utils.capitalizar(AG.Utils.fecha(hoy, 'largo'))) + '</p>' +
          '</div></div>' +
          '<div class="card-body">' +
            AG.Charts.barras(datosHoras, {
              alto: 240,
              vacio: 'Sin entradas con hora registrada el día de hoy.',
              aria: 'Entradas por hora del día de hoy'
            }) +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><div>' +
            '<h3 class="card-title">' + ic('historial', 17) + 'Movimientos del día</h3>' +
            '<p class="card-sub">De la entrada más reciente a la más antigua</p>' +
          '</div>' +
          '<div class="row-sm">' + AG.Utils.badge(dentro + ' dentro', 'ok') + '</div></div>' +
          '<div class="card-body"><div class="list">' + filas + '</div></div>' +
        '</div>' +
      '</div>';
  }

  /* =============================================================
     7. Pestaña ANÁLISIS
     ============================================================= */

  /** Últimos 12 meses (más el elegido, si quedara fuera del rango). */
  function mesesDisponibles() {
    var lista = [];
    var hoy = AG.Utils.hoy();
    for (var i = 0; i < 12; i++) {
      var m = AG.Utils.mesDe(AG.Utils.sumaMeses(hoy, -i));
      if (m && lista.indexOf(m) < 0) lista.push(m);
    }
    if (estado.mes && lista.indexOf(estado.mes) < 0) lista.push(estado.mes);
    return lista;
  }

  function htmlSelectorMes() {
    var meses = mesesDisponibles();
    var opciones = '';
    for (var i = 0; i < meses.length; i++) {
      opciones += '<option value="' + esc(meses[i]) + '"' +
        (meses[i] === estado.mes ? ' selected' : '') + '>' +
        esc(AG.Utils.nombreMes(meses[i])) + '</option>';
    }
    return '' +
      '<div class="field" style="max-width:260px">' +
        '<label class="label" for="ag-asis-mes">' + ic('calendario', 15) + 'Mes analizado</label>' +
        '<select class="select" id="ag-asis-mes" data-mes>' + opciones + '</select>' +
      '</div>';
  }

  function htmlTopConstantes(lista) {
    var cuenta = {}, i, id;
    for (i = 0; i < lista.length; i++) {
      id = lista[i].socioId;
      if (!id) continue;
      cuenta[id] = (cuenta[id] || 0) + 1;
    }

    var arr = [];
    for (id in cuenta) {
      if (!Object.prototype.hasOwnProperty.call(cuenta, id)) continue;
      var socio = AG.DB.usuario(id);
      if (!socio || !puedeVer(socio.id)) continue;
      arr.push({ socio: socio, total: cuenta[id] });
    }
    arr.sort(function (a, b) { return b.total - a.total; });
    arr = arr.slice(0, 10);

    if (!arr.length) return vacio('Sin visitas registradas en el mes elegido.', 'trofeo');

    var maximo = arr[0].total || 1;
    var filas = '';
    for (i = 0; i < arr.length; i++) {
      var pct = Math.round(arr[i].total / maximo * 100);
      filas += '' +
        '<button type="button" class="list-item clickable" data-elegir="' + esc(arr[i].socio.id) + '">' +
          '<span class="micro muted" style="width:22px;text-align:right">' + (i + 1) + '</span>' +
          AG.Utils.avatar(arr[i].socio, 'sm') +
          '<div class="list-item-main">' +
            '<b>' + esc(AG.Utils.nombreCompleto(arr[i].socio)) + '</b>' +
            '<span class="bar bar-fina" style="margin-top:5px"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
          '</div>' +
          '<div class="list-item-side"><b>' + arr[i].total + '</b> <span class="mini muted">visitas</span></div>' +
        '</button>';
    }
    return '<div class="list">' + filas + '</div>';
  }

  function htmlRiesgo() {
    var mapa = ultimaVisitaPorSocio();
    var hoy = AG.Utils.hoy();
    var socios = AG.DB.socios();
    var enRiesgo = [], i;

    for (i = 0; i < socios.length; i++) {
      var s = socios[i];
      if (!s || s.estado !== 'activo' || s.activo === false) continue;
      if (!puedeVer(s.id)) continue;

      var ultima = mapa[s.id] || '';
      var dias = ultima
        ? AG.Utils.diasEntre(ultima, hoy)
        : AG.Utils.diasEntre(s.fechaAlta || s.creado || hoy, hoy);

      if (dias < DIAS_RIESGO) continue;
      enRiesgo.push({ socio: s, ultima: ultima, dias: dias });
    }

    enRiesgo.sort(function (a, b) { return b.dias - a.dias; });

    if (!enRiesgo.length) {
      return vacio('Ningún socio activo lleva ' + DIAS_RIESGO + ' días o más sin venir. ¡Excelente retención!', 'trofeo');
    }

    var mostrados = enRiesgo.slice(0, 20);
    var filas = '';
    for (i = 0; i < mostrados.length; i++) {
      var r = mostrados[i];
      var tel = telWhatsApp(r.socio.telefono);
      filas += '' +
        '<div class="list-item">' +
          AG.Utils.avatar(r.socio, 'sm') +
          '<div class="list-item-main">' +
            '<b>' + esc(AG.Utils.nombreCompleto(r.socio)) + '</b>' +
            '<span>' + (r.ultima
              ? 'Última visita ' + esc(AG.Utils.fecha(r.ultima, 'corto')) + ' · ' + esc(AG.Utils.fechaRelativa(r.ultima))
              : 'Nunca ha registrado una visita') +
              (r.socio.telefono ? ' · ' + esc(r.socio.telefono) : ' · sin teléfono') + '</span>' +
          '</div>' +
          '<div class="list-item-side row-sm">' +
            AG.Utils.badge(r.dias + ' días', r.dias >= 21 ? 'danger' : 'warn') +
            (tel
              ? '<button type="button" class="btn btn-sm btn-outline" data-wa="' + esc(r.socio.id) + '" title="Enviar recordatorio por WhatsApp">' +
                  ic('whatsapp', 15) + 'Recordar</button>'
              : '<span class="mini muted">Sin teléfono</span>') +
          '</div>' +
        '</div>';
    }

    var pie = enRiesgo.length > mostrados.length
      ? '<p class="mini muted mt-sm">Se muestran los 20 casos más antiguos de ' + enRiesgo.length + ' socios en riesgo.</p>'
      : '';

    return '<div class="list">' + filas + '</div>' + pie;
  }

  function htmlAnalisis() {
    var mes = estado.mes;
    var lista = asistenciasDelMes(mes);
    var i;

    /* Calendario del mes */
    var porDia = {};
    var horas = [];
    var semana = [0, 0, 0, 0, 0, 0, 0];
    var sociosDistintos = {};
    for (i = 0; i < 24; i++) horas.push(0);

    for (i = 0; i < lista.length; i++) {
      var a = lista[i];
      var f = String(a.fecha || '').slice(0, 10);
      if (!f) continue;
      porDia[f] = (porDia[f] || 0) + 1;
      if (a.socioId) sociosDistintos[a.socioId] = true;

      var h = horaNum(a.entrada);
      if (h !== null) horas[h]++;

      var d = diaLunes(f);
      if (d !== null) semana[d]++;
    }

    var diasCalendario = [];
    var diasConVisita = 0;
    for (var clave in porDia) {
      if (!Object.prototype.hasOwnProperty.call(porDia, clave)) continue;
      diasCalendario.push({ fecha: clave, valor: porDia[clave] });
      diasConVisita++;
    }
    diasCalendario.sort(function (x, y) { return x.fecha < y.fecha ? -1 : 1; });

    /* KPIs del mes */
    var totalDistintos = 0;
    for (var k in sociosDistintos) {
      if (Object.prototype.hasOwnProperty.call(sociosDistintos, k)) totalDistintos++;
    }
    var promedioDiario = diasConVisita ? Math.round(lista.length / diasConVisita * 10) / 10 : 0;

    var mejorDia = '', mejorTotal = 0;
    for (i = 0; i < diasCalendario.length; i++) {
      if (diasCalendario[i].valor > mejorTotal) {
        mejorTotal = diasCalendario[i].valor;
        mejorDia = diasCalendario[i].fecha;
      }
    }

    var horaPico = -1, maxHora = 0;
    for (i = 0; i < 24; i++) {
      if (horas[i] > maxHora) { maxHora = horas[i]; horaPico = i; }
    }

    /* Barras de horas pico (solo el tramo con actividad) */
    var primera = -1, ultimaH = -1;
    for (i = 0; i < 24; i++) {
      if (horas[i] > 0) { if (primera < 0) primera = i; ultimaH = i; }
    }
    var datosHoras = [];
    for (i = primera; i >= 0 && i <= ultimaH; i++) {
      datosHoras.push({
        etiqueta: dos(i) + ':00',
        valor: horas[i],
        color: (i === horaPico) ? AG.Charts.color(0) : AG.Charts.color(5)
      });
    }

    /* Barras por día de la semana */
    var maxSemana = 0;
    for (i = 0; i < 7; i++) if (semana[i] > maxSemana) maxSemana = semana[i];
    var datosSemana = [];
    for (i = 0; i < 7; i++) {
      datosSemana.push({
        etiqueta: DIAS_LUNES_CORTOS[i],
        valor: semana[i],
        color: (semana[i] === maxSemana && maxSemana > 0) ? AG.Charts.color(0) : AG.Charts.color(2)
      });
    }

    var mejorDiaSemana = '';
    for (i = 0; i < 7; i++) {
      if (semana[i] === maxSemana && maxSemana > 0) { mejorDiaSemana = DIAS_LUNES[i]; break; }
    }

    var cabecera = '' +
      '<div class="card">' +
        '<div class="card-body">' +
          '<div class="row wrap between" style="gap:14px">' +
            htmlSelectorMes() +
            '<p class="mini muted flex1" style="min-width:220px">' +
              'Análisis de <b>' + esc(AG.Utils.nombreMes(mes)) + '</b> · ' +
              lista.length + (lista.length === 1 ? ' visita registrada' : ' visitas registradas') +
              (mejorDiaSemana ? ' · Día más fuerte: <b>' + esc(mejorDiaSemana) + '</b>' : '') +
            '</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (!lista.length) {
      return '<div class="stack">' + cabecera +
        '<div class="card"><div class="card-body">' +
          vacio('No hay asistencias registradas en ' + AG.Utils.nombreMes(mes) + '. Elige otro mes o registra accesos en Recepción.', 'calendario') +
        '</div></div>' +
        '<div class="card">' +
          '<div class="card-head"><div><h3 class="card-title">' + ic('alerta', 17) + 'Socios en riesgo</h3>' +
          '<p class="card-sub">Activos sin asistir en ' + DIAS_RIESGO + ' días o más</p></div></div>' +
          '<div class="card-body">' + htmlRiesgo() + '</div>' +
        '</div>' +
      '</div>';
    }

    return '' +
      '<div class="stack">' +
        cabecera +

        '<div class="grid g4 gap-sm">' +
          kpi('qr', String(lista.length), 'Visitas del mes', null) +
          kpi('socios', String(totalDistintos), 'Socios distintos', 'info') +
          kpi('grafica', AG.Utils.num(promedioDiario, 1), 'Promedio por día activo', null) +
          kpi('reloj', horaPico >= 0 ? dos(horaPico) + ':00' : '—', 'Hora pico del mes', 'warn') +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><div>' +
            '<h3 class="card-title">' + ic('calendario', 17) + 'Mapa de calor del mes</h3>' +
            '<p class="card-sub">' +
              (mejorDia ? 'Día más concurrido: ' + esc(AG.Utils.fecha(mejorDia, 'corto')) + ' con ' + mejorTotal + ' visitas' : 'Intensidad de visitas por día') +
            '</p>' +
          '</div></div>' +
          '<div class="card-body">' +
            AG.Charts.calendario(diasCalendario, {
              periodo: mes,
              etiquetaValor: 'visitas',
              vacio: 'Sin visitas en ' + AG.Utils.nombreMes(mes) + '.',
              aria: 'Mapa de calor de asistencias del mes'
            }) +
          '</div>' +
        '</div>' +

        '<div class="grid g2">' +
          '<div class="card">' +
            '<div class="card-head"><div>' +
              '<h3 class="card-title">' + ic('reloj', 17) + 'Horas pico</h3>' +
              '<p class="card-sub">Entradas acumuladas de todo el mes</p>' +
            '</div></div>' +
            '<div class="card-body">' +
              AG.Charts.barras(datosHoras, {
                alto: 250,
                vacio: 'Las asistencias del mes no tienen hora de entrada registrada.',
                aria: 'Entradas por hora en el mes'
              }) +
            '</div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-head"><div>' +
              '<h3 class="card-title">' + ic('grafica', 17) + 'Por día de la semana</h3>' +
              '<p class="card-sub">Dónde se concentra el aforo</p>' +
            '</div></div>' +
            '<div class="card-body">' +
              AG.Charts.barras(datosSemana, {
                alto: 250,
                vacio: 'Sin datos por día de la semana.',
                aria: 'Asistencias por día de la semana'
              }) +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="grid g2">' +
          '<div class="card">' +
            '<div class="card-head"><div>' +
              '<h3 class="card-title">' + ic('trofeo', 17) + 'Top 10 más constantes</h3>' +
              '<p class="card-sub">' + esc(AG.Utils.nombreMes(mes)) + '</p>' +
            '</div></div>' +
            '<div class="card-body">' + htmlTopConstantes(lista) + '</div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-head"><div>' +
              '<h3 class="card-title">' + ic('alerta', 17) + 'Socios en riesgo</h3>' +
              '<p class="card-sub">Activos sin asistir en ' + DIAS_RIESGO + ' días o más</p>' +
            '</div></div>' +
            '<div class="card-body">' + htmlRiesgo() + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* =============================================================
     8. Armado de la pantalla
     ============================================================= */

  var ESTILOS = '' +
    '<style>' +
      '.ag-asis-buscar .input{height:52px;font-size:16px;font-weight:700}' +
      '.ag-asis-res{max-height:340px;overflow-y:auto}' +
      '.ag-asis-nombre{font-size:clamp(19px,3vw,25px);font-weight:800;letter-spacing:-.025em;color:var(--texto);line-height:1.2}' +
      '@media (max-width:520px){.ag-asis-buscar .input{height:46px;font-size:15px}}' +
    '</style>';

  function htmlPestanas() {
    var dentro = 0;
    var hoyLista = asistenciasDelDia(AG.Utils.hoy());
    for (var i = 0; i < hoyLista.length; i++) if (!hoyLista[i].salida) dentro++;

    function tab(clave, icono, texto, extra) {
      return '<button type="button" class="tab' + (estado.pestana === clave ? ' active' : '') +
        '" data-tab="' + clave + '">' + ic(icono, 16) + '<span>' + esc(texto) + '</span>' +
        (extra || '') + '</button>';
    }

    return '<div class="tabs">' +
      tab('recepcion', 'qr', 'Recepción') +
      tab('hoy', 'reloj', 'Hoy', dentro ? '<span class="badge badge-ok">' + dentro + '</span>' : '') +
      tab('analisis', 'grafica', 'Análisis') +
      '</div>';
  }

  function htmlCuerpo() {
    if (estado.pestana === 'hoy') return htmlHoy();
    if (estado.pestana === 'analisis') return htmlAnalisis();
    return htmlRecepcion();
  }

  /* ---------- Repintados parciales ---------- */

  function pintarResultados(root) {
    var caja = root.querySelector('#ag-asis-resultados');
    if (caja) caja.innerHTML = htmlResultados();
  }

  function pintarFicha(root) {
    var caja = root.querySelector('#ag-asis-ficha');
    if (caja) caja.innerHTML = htmlFicha();
  }

  function pintarCuerpo(root) {
    var caja = root.querySelector('#ag-asis-cuerpo');
    if (caja) caja.innerHTML = htmlCuerpo();

    var pestanas = root.querySelector('#ag-asis-tabs');
    if (pestanas) pestanas.innerHTML = htmlPestanas();
  }

  /* ---------- Acciones ---------- */

  function seleccionar(root, socioId) {
    estado.socioId = socioId;
    estado.saludo = null;
    if (estado.pestana !== 'recepcion') {
      estado.pestana = 'recepcion';
      pintarCuerpo(root);
      return;
    }
    pintarFicha(root);
    var ficha = root.querySelector('#ag-asis-ficha');
    if (ficha && ficha.scrollIntoView) {
      try { ficha.scrollIntoView({ block: 'nearest' }); } catch (e) { /* navegador antiguo */ }
    }
  }

  /** Aplica el resultado del check-in: guarda el saludo, avisa y repinta. */
  function aplicarResultado(root, resultado, forzado) {
    var socio = AG.DB.usuario(estado.socioId);
    var nombre = socio ? AG.Utils.nombreCompleto(socio) : 'El socio';
    var minutos = null;

    if (resultado.accion === 'salida' && resultado.registro) {
      var mEnt = minutosDe(resultado.registro.entrada);
      var mSal = minutosDe(resultado.registro.salida);
      if (mEnt !== null && mSal !== null && mSal >= mEnt) minutos = mSal - mEnt;
    }

    estado.saludo = {
      socioId: estado.socioId,
      accion: resultado.accion,
      hora: (resultado.registro && (resultado.accion === 'salida' ? resultado.registro.salida : resultado.registro.entrada)) || horaAhora(),
      minutos: minutos,
      forzado: !!forzado
    };

    if (resultado.accion === 'entrada') AG.Utils.toast('Entrada registrada · ' + nombre, 'ok');
    else if (resultado.accion === 'salida') AG.Utils.toast('Salida registrada · ' + nombre, 'info');
    else AG.Utils.toast(nombre + ' ya completó su visita de hoy.', 'info');

    pintarFicha(root);
    var pestanas = root.querySelector('#ag-asis-tabs');
    if (pestanas) pestanas.innerHTML = htmlPestanas();
  }

  function registrarAcceso(root) {
    if (!estado.socioId) return;
    var socio = AG.DB.usuario(estado.socioId);
    if (!socio) { AG.Utils.toast('El socio ya no existe en la base.', 'error'); return; }

    var resultado = ejecutarCheckIn(socio.id, {});

    if (resultado.error === 'bloqueada') {
      var est = resultado.estado || AG.Calc.estadoMembresia(socio);
      var vencidos = Math.abs(Number(est.diasRestantes) || 0);
      var detalle = est.estado === 'vencido'
        ? 'Su membresía venció hace ' + vencidos + (vencidos === 1 ? ' día' : ' días') + '.'
        : (est.estado === 'congelado' ? 'Su membresía está congelada.' : 'El socio está dado de baja.');

      AG.Utils.confirmar(
        detalle + '\n\n¿Dirección autoriza el acceso de ' + AG.Utils.nombreCompleto(socio) + ' sin pago vigente?',
        'Autorizar acceso excepcional',
        {
          textoOk: 'Sí, autorizar acceso',
          textoCancelar: 'No, cobrar primero',
          detalle: 'La asistencia quedará guardada con una nota de autorización.',
          peligro: true
        }
      ).then(function (ok) {
        if (!ok) return;
        var nota = 'Acceso autorizado por dirección · membresía ' + est.estado;
        var segundo = ejecutarCheckIn(socio.id, { forzar: true, nota: nota });
        if (segundo.error) {
          AG.Utils.toast('No se pudo registrar la asistencia.', 'error');
          return;
        }
        aplicarResultado(root, segundo, true);
      });
      return;
    }

    if (resultado.error === 'sin_permiso') {
      AG.Utils.toast('No tienes permiso para registrar a este socio.', 'error');
      return;
    }
    if (resultado.error) {
      AG.Utils.toast('No se pudo registrar la asistencia.', 'error');
      return;
    }

    aplicarResultado(root, resultado, false);
  }

  function registrarSalida(root) {
    if (!estado.socioId) return;
    var abierta = entradaAbierta(estado.socioId);
    if (!abierta) {
      AG.Utils.toast('Este socio no tiene una entrada abierta hoy.', 'warn');
      return;
    }
    var resultado = ejecutarCheckIn(estado.socioId, {});
    if (resultado.error) {
      AG.Utils.toast('No se pudo registrar la salida.', 'error');
      return;
    }
    aplicarResultado(root, resultado, false);
  }

  function cobrar(root) {
    if (!estado.socioId) return;
    if (!AG.Mod.Pagos || typeof AG.Mod.Pagos.registrar !== 'function') {
      AG.Utils.toast('El módulo de pagos no está disponible en esta pantalla.', 'warn');
      return;
    }
    try {
      AG.Mod.Pagos.registrar(estado.socioId);
    } catch (e) {
      AG.Utils.toast('No se pudo abrir el cobro. Intenta desde la sección Pagos.', 'error');
    }
  }

  function abrirResumen() {
    if (!estado.socioId) return;
    var socio = AG.DB.usuario(estado.socioId);
    if (!socio) return;
    AG.Utils.modal({
      titulo: 'Asistencia de ' + AG.Utils.nombreCompleto(socio),
      ancho: 'lg',
      cuerpo: Asistencia.resumenSocio(socio.id),
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost', cerrar: true }]
    });
  }

  function recordarWhatsApp(socioId) {
    var socio = AG.DB.usuario(socioId);
    if (!socio) return;
    var tel = telWhatsApp(socio.telefono);
    if (!tel) {
      AG.Utils.toast('Este socio no tiene teléfono registrado.', 'warn');
      return;
    }

    var asistencias = AG.DB.asistenciasDe(socio.id);
    var ultima = asistencias.length ? String(asistencias[0].fecha || '').slice(0, 10) : '';
    var dias = ultima ? AG.Utils.diasEntre(ultima, AG.Utils.hoy()) : 0;

    var mensaje = '¡Hola ' + (socio.nombre || AG.Utils.nombreCompleto(socio)) + '! Te habla ' + nombreGym() + '. ' +
      (dias > 0 ? 'Notamos que llevas ' + dias + (dias === 1 ? ' día' : ' días') + ' sin venir a entrenar. ' : '') +
      'Queremos verte de vuelta: tu lugar y tu rutina te esperan. ¿Te apuntamos hoy?';

    var url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje);
    var ventana = null;
    try { ventana = window.open(url, '_blank'); } catch (e) { ventana = null; }

    if (ventana) {
      AG.Utils.toast('WhatsApp abierto con el recordatorio listo para enviar.', 'ok');
    } else {
      AG.Utils.copiar(mensaje).then(function () {
        AG.Utils.toast('No se pudo abrir WhatsApp; el mensaje se copió al portapapeles.', 'warn');
      }, function () {
        AG.Utils.toast('No se pudo abrir WhatsApp en este navegador.', 'error');
      });
    }
  }

  /* =============================================================
     9. render(ctx)
     ============================================================= */

  Asistencia.render = function (ctx) {
    /* Estado inicial coherente en cada entrada a la sección */
    if (!estado.mes || !/^\d{4}-\d{2}$/.test(estado.mes)) estado.mes = AG.Utils.mesActual();
    if (estado.socioId && !AG.DB.usuario(estado.socioId)) {
      estado.socioId = null;
      estado.saludo = null;
    }

    /* Si llega ?socio=u_xxx desde otra pantalla, se abre esa ficha */
    var params = (ctx && ctx.params) ? ctx.params : {};
    if (params.socio && AG.DB.usuario(params.socio)) {
      estado.socioId = params.socio;
      estado.pestana = 'recepcion';
      estado.saludo = null;
    }

    var hoy = AG.Utils.hoy();
    var lista = asistenciasDelDia(hoy);
    var dentro = 0;
    for (var i = 0; i < lista.length; i++) if (!lista[i].salida) dentro++;

    var html = '' +
      ESTILOS +
      '<div class="page">' +
        '<div class="page-head">' +
          '<div>' +
            '<h1 class="page-title">' + ic('qr', 24) + 'Asistencia</h1>' +
            '<p class="page-sub">Control de acceso en recepción, aforo del día y análisis de constancia de los socios.</p>' +
          '</div>' +
          '<div class="page-acciones">' +
            '<span class="pill pill-info">' + ic('calendario', 14) + esc(AG.Utils.capitalizar(AG.Utils.fecha(hoy, 'largo'))) + '</span>' +
            '<span class="pill ' + (dentro ? 'pill-ok' : '') + '">' + ic('socios', 14) + '<b>' + dentro + '</b> dentro</span>' +
          '</div>' +
        '</div>' +

        '<div id="ag-asis-tabs">' + htmlPestanas() + '</div>' +
        '<div id="ag-asis-cuerpo">' + htmlCuerpo() + '</div>' +
      '</div>';

    return {
      html: html,
      listo: function (root) {
        if (!root) return;

        /* --- Pestañas --- */
        AG.Utils.delegar(root, 'click', '[data-tab]', function (e, el) {
          var clave = el.getAttribute('data-tab');
          if (!clave || clave === estado.pestana) return;
          estado.pestana = clave;
          pintarCuerpo(root);
        });

        /* --- Buscador en vivo --- */
        var buscarDebounced = AG.Utils.debounce(function () {
          pintarResultados(root);
        }, 160);

        AG.Utils.delegar(root, 'input', '[data-buscar]', function (e, el) {
          estado.busqueda = el.value || '';
          buscarDebounced();
        });

        /* Enter con un único resultado: selección directa */
        AG.Utils.delegar(root, 'keydown', '[data-buscar]', function (e) {
          if (e.key !== 'Enter' && e.keyCode !== 13) return;
          e.preventDefault();
          var encontrados = buscarSocios(estado.busqueda, 2);
          if (encontrados.length === 1) seleccionar(root, encontrados[0].id);
          else if (!encontrados.length) AG.Utils.toast('Ningún socio coincide con la búsqueda.', 'warn');
        });

        /* --- Selección de socio (resultados, top 10 y riesgo) --- */
        AG.Utils.delegar(root, 'click', '[data-elegir]', function (e, el) {
          var id = el.getAttribute('data-elegir');
          if (id) seleccionar(root, id);
        });

        /* --- Acciones de la ficha --- */
        AG.Utils.delegar(root, 'click', '[data-accion]', function (e, el) {
          var accion = el.getAttribute('data-accion');
          if (accion === 'entrada') registrarAcceso(root);
          else if (accion === 'salida') registrarSalida(root);
          else if (accion === 'cobrar') cobrar(root);
          else if (accion === 'resumen') abrirResumen();
          else if (accion === 'limpiar') {
            estado.socioId = null;
            estado.saludo = null;
            estado.busqueda = '';
            var campo = root.querySelector('[data-buscar]');
            if (campo) { campo.value = ''; try { campo.focus(); } catch (err) { /* sin foco */ } }
            pintarResultados(root);
            pintarFicha(root);
          }
        });

        /* --- Recordatorio por WhatsApp --- */
        AG.Utils.delegar(root, 'click', '[data-wa]', function (e, el) {
          var id = el.getAttribute('data-wa');
          if (id) recordarWhatsApp(id);
        });

        /* --- Selector de mes del análisis --- */
        AG.Utils.delegar(root, 'change', '[data-mes]', function (e, el) {
          estado.mes = el.value || AG.Utils.mesActual();
          pintarCuerpo(root);
        });

        /* Foco directo en el buscador para trabajar con lector de códigos */
        if (estado.pestana === 'recepcion') {
          var campoInicial = root.querySelector('[data-buscar]');
          if (campoInicial) {
            try { campoInicial.focus(); } catch (e2) { /* sin foco disponible */ }
          }
        }
      }
    };
  };

  /* =============================================================
     10. Registro de la ruta
     ============================================================= */

  AG.Mod.Asistencia = Asistencia;

  AG.Router.registrar({
    path: 'director/asistencia',
    roles: ['director'],
    titulo: 'Control de asistencia',
    nav: { etiqueta: 'Asistencia', icono: 'qr', grupo: 'Operación', orden: 3 },
    render: Asistencia.render
  });

})(window.AG);
