/* =============================================================
   ALLIANCE GYM — Módulo de Socios (AG.Mod.Socios)
   -------------------------------------------------------------
   Rutas que registra:
     director/socios  · coach/socios   (listado)
     director/socio   · coach/socio    (ficha 360, parámetro ?id=)

   Funciones compartidas que expone:
     AG.Mod.Socios.formulario(socioId|null, alGuardar)
     AG.Mod.Socios.tarjeta(socio, opciones)
     AG.Mod.Socios.selector(callback, opciones)

   Reglas: JavaScript clásico, sin dependencias externas, todo el
   texto en español y cualquier dato de la base se escapa con
   AG.Utils.esc() antes de llegar al HTML.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var C = AG.Calc;
  var DB = AG.DB;
  var Charts = AG.Charts;

  /* =============================================================
     1. Constantes de dominio
     ============================================================= */

  var POR_PAGINA = 20;

  var OBJETIVOS = [
    { v: 'perder_grasa', t: 'Perder grasa', icono: 'fuego', d: 'Bajar porcentaje de grasa' },
    { v: 'ganar_musculo', t: 'Ganar músculo', icono: 'pesa', d: 'Sumar masa muscular' },
    { v: 'mantener', t: 'Mantener', icono: 'balanza', d: 'Sostener la composición actual' },
    { v: 'rendimiento', t: 'Rendimiento', icono: 'rayo', d: 'Más fuerza y resistencia' },
    { v: 'salud', t: 'Salud general', icono: 'corazon', d: 'Bienestar y hábitos' }
  ];

  var NIVELES = [
    { v: 'principiante', t: 'Principiante' },
    { v: 'intermedio', t: 'Intermedio' },
    { v: 'avanzado', t: 'Avanzado' }
  ];

  var ACTIVIDADES = [
    { v: 'sedentario', t: 'Sedentario (poco o nada de ejercicio)' },
    { v: 'ligero', t: 'Ligero (1 a 3 días por semana)' },
    { v: 'moderado', t: 'Moderado (3 a 5 días por semana)' },
    { v: 'alto', t: 'Alto (6 a 7 días por semana)' },
    { v: 'atleta', t: 'Atleta (doble sesión o trabajo físico)' }
  ];

  var ESTADOS = [
    { v: 'activo', t: 'Activo' },
    { v: 'vencido', t: 'Vencido' },
    { v: 'congelado', t: 'Congelado' },
    { v: 'baja', t: 'Baja' }
  ];

  var SEXOS = [
    { v: 'H', t: 'Hombre' },
    { v: 'M', t: 'Mujer' }
  ];

  var ORDENES = [
    { v: 'nombre', t: 'Nombre (A → Z)' },
    { v: 'antiguedad', t: 'Antigüedad (más antiguos)' },
    { v: 'vencimiento', t: 'Vencimiento (más próximo)' },
    { v: 'adherencia', t: 'Adherencia (mejor primero)' }
  ];

  var TABS = [
    { v: 'resumen', t: 'Resumen', icono: 'grafica' },
    { v: 'mediciones', t: 'Mediciones', icono: 'cinta' },
    { v: 'entrenamiento', t: 'Entrenamiento', icono: 'pesa' },
    { v: 'nutricion', t: 'Nutrición', icono: 'nutricion' },
    { v: 'pagos', t: 'Pagos', icono: 'dinero' },
    { v: 'asistencia', t: 'Asistencia', icono: 'calendario' }
  ];

  /* Estado vivo del listado (se conserva entre repintados internos) */
  var estadoLista = estadoPorDefecto();
  var refrescoInterno = false;
  var tabActual = 'resumen';

  function estadoPorDefecto() {
    return {
      q: '', estado: '', plan: '', coach: '', objetivo: '', nivel: '',
      orden: 'nombre', vista: 'tabla', pag: 1
    };
  }

  /* =============================================================
     2. Ayudantes generales
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function ico(nombre, tam) {
    if (AG.Icons && typeof AG.Icons.get === 'function') {
      try { return AG.Icons.get(nombre, tam || 18); } catch (e) { return ''; }
    }
    return '';
  }

  function rellenar(n, largo) {
    var s = String(n);
    while (s.length < largo) s = '0' + s;
    return s;
  }

  function soloDigitos(t) {
    return String(t === null || t === undefined ? '' : t).replace(/[^0-9]/g, '');
  }

  function etiquetaDe(lista, valor, alterno) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].v === valor) return lista[i].t;
    }
    return alterno === undefined ? '—' : alterno;
  }

  function etiquetaObjetivo(v) { return etiquetaDe(OBJETIVOS, v, 'Sin objetivo'); }
  function etiquetaNivel(v) { return etiquetaDe(NIVELES, v, 'Sin nivel'); }
  function etiquetaActividad(v) { return etiquetaDe(ACTIVIDADES, v, 'Sin registrar'); }
  function etiquetaEstado(v) { return etiquetaDe(ESTADOS, v, 'Sin estado'); }
  function etiquetaSexo(v) { return etiquetaDe(SEXOS, v, 'Sin registrar'); }

  function iconoObjetivo(v) {
    for (var i = 0; i < OBJETIVOS.length; i++) {
      if (OBJETIVOS[i].v === v) return OBJETIVOS[i].icono;
    }
    return 'meta';
  }

  function nombreGym() {
    try {
      var s = DB.state && DB.state.settings;
      if (s && s.nombreGym) return String(s.nombreGym);
    } catch (e) { /* se usa el respaldo */ }
    return 'Alliance Gym';
  }

  /** Módulos hermanos: se llaman solo si existen, nunca revientan la app. */
  function llamarModulo(nombreMod, metodo, args, aviso) {
    var mod = AG.Mod ? AG.Mod[nombreMod] : null;
    if (mod && typeof mod[metodo] === 'function') {
      try {
        mod[metodo].apply(mod, args || []);
        return true;
      } catch (e) {
        U.toast('No se pudo abrir esa herramienta en este momento.', 'error');
        return false;
      }
    }
    U.toast(aviso || 'Esa sección todavía no está disponible.', 'warn');
    return false;
  }

  function hayModulo(nombreMod, metodo) {
    var mod = AG.Mod ? AG.Mod[nombreMod] : null;
    return !!(mod && typeof mod[metodo] === 'function');
  }

  /* ---------- Permisos ---------- */

  function puedeVer(usuario, socioId) {
    if (AG.Auth && typeof AG.Auth.puedeVer === 'function') {
      try { return !!AG.Auth.puedeVer(usuario, socioId); } catch (e) { return false; }
    }
    return false;
  }

  /** Universo de socios que el usuario tiene derecho a ver. */
  function sociosVisibles(usuario) {
    if (!usuario) return [];
    if (usuario.rol === 'director') return DB.socios();
    if (usuario.rol === 'coach') return DB.sociosDe(usuario.id);
    if (usuario.rol === 'socio') {
      var yo = DB.usuario(usuario.id);
      return yo ? [yo] : [];
    }
    return [];
  }

  function esDirector(usuario) { return !!(usuario && usuario.rol === 'director'); }

  function rutaLista(usuario) { return esDirector(usuario) ? 'director/socios' : 'coach/socios'; }
  function rutaFicha(usuario) { return esDirector(usuario) ? 'director/socio' : 'coach/socio'; }

  /* ---------- WhatsApp ---------- */

  function telefonoWhatsApp(socio) {
    var d = soloDigitos(socio && socio.telefono);
    if (d.length > 10) d = d.slice(d.length - 10);
    return d;
  }

  function mensajeWhatsApp(socio) {
    var nombre = (socio && socio.nombre) ? String(socio.nombre) : '';
    var em = C.estadoMembresia(socio);
    var base = 'Hola ' + nombre + ', te saludamos de ' + nombreGym() + '. ';
    if (em.estado === 'vencido') {
      return base + 'Tu membresía está vencida; pasa a recepción para renovarla y seguir entrenando.';
    }
    if (em.estado === 'por_vencer') {
      return base + 'Tu membresía está por vencer (' + em.texto.toLowerCase() + '). Renuévala para no perder tu acceso.';
    }
    if (em.estado === 'congelado') {
      return base + 'Tu membresía está congelada. Avísanos cuando quieras reactivarla.';
    }
    if (em.estado === 'baja') {
      return base + '¡Te extrañamos en el gimnasio! Cuando quieras regresar, aquí te esperamos.';
    }
    return base + '¿Cómo vas con tu entrenamiento? Cualquier duda estamos para apoyarte.';
  }

  function abrirWhatsApp(socio) {
    var d = telefonoWhatsApp(socio);
    if (d.length !== 10) {
      U.toast('Este socio no tiene un teléfono de 10 dígitos registrado.', 'warn');
      return;
    }
    var url = 'https://wa.me/52' + d + '?text=' + encodeURIComponent(mensajeWhatsApp(socio));
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      U.toast('El navegador bloqueó la ventana de WhatsApp.', 'error');
    }
  }

  /* ---------- Datos derivados ---------- */

  /** Adherencia del mes en curso según la rutina activa del socio. */
  function adherenciaDe(socio) {
    var activa = DB.rutinaActivaDe(socio.id);
    var dxs = 3;
    if (activa && activa.rutina && Number(activa.rutina.diasPorSemana) > 0) {
      dxs = Number(activa.rutina.diasPorSemana);
    }
    var desde = U.mesActual() + '-01';
    var hasta = U.hoy();
    if (hasta < desde) hasta = desde;
    return C.adherencia(DB.bitacorasDe(socio.id), desde, hasta, dxs);
  }

  /** Empaqueta todo lo que la tabla, las tarjetas y el orden necesitan. */
  function filaDe(socio) {
    var pagos = DB.pagosDe(socio.id);
    var asistencias = DB.asistenciasDe(socio.id);
    return {
      socio: socio,
      plan: socio.planId ? DB.plan(socio.planId) : null,
      coach: socio.coachId ? DB.usuario(socio.coachId) : null,
      membresia: C.estadoMembresia(socio),
      meses: C.mesesDeMembresia(socio, pagos),
      pagos: pagos,
      ultimaAsistencia: asistencias.length ? String(asistencias[0].fecha || '') : '',
      adherencia: adherenciaDe(socio)
    };
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function vacio(mensaje, iconoNombre, accionHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ico(iconoNombre || 'socios', 34) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (accionHTML ? '<div class="row center wrap">' + accionHTML + '</div>' : '') +
      '</div>';
  }

  function opciones(lista, seleccionado, etiquetaVacia) {
    var html = etiquetaVacia ? '<option value="">' + esc(etiquetaVacia) + '</option>' : '';
    for (var i = 0; i < lista.length; i++) {
      var sel = (String(lista[i].v) === String(seleccionado === null || seleccionado === undefined ? '' : seleccionado));
      html += '<option value="' + esc(lista[i].v) + '"' + (sel ? ' selected' : '') + '>' +
        esc(lista[i].t) + '</option>';
    }
    return html;
  }

  function dato(etiqueta, valor) {
    return '<div class="dato"><span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<span class="dato-val">' + valor + '</span></div>';
  }

  function botonIcono(accion, id, iconoNombre, titulo, clase) {
    return '<button type="button" class="btn-icono btn-sm' + (clase ? ' ' + clase : '') + '"' +
      ' data-accion="' + esc(accion) + '" data-id="' + esc(id) + '"' +
      ' title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '">' + ico(iconoNombre, 16) + '</button>';
  }

  /** Botonera compacta que acompaña a cada socio en la tabla y las tarjetas. */
  function accionesDe(socio, usuario) {
    var id = socio.id;
    var html = '<div class="row-sm nowrap">';
    html += botonIcono('ver', id, 'ojo', 'Ver ficha');
    html += botonIcono('editar', id, 'editar', 'Editar socio');
    if (esDirector(usuario)) html += botonIcono('cobrar', id, 'dinero', 'Registrar cobro');
    html += botonIcono('whatsapp', id, 'whatsapp', 'Enviar WhatsApp');
    html += botonIcono('menu', id, 'menu', 'Más acciones');
    html += '</div>';
    return html;
  }

  /* =============================================================
     4. Tarjeta de socio (compartida con otros módulos)
     ============================================================= */

  /**
   * HTML de tarjeta de socio.
   * @param {Object} socio
   * @param {Object} [opciones] { acciones:String HTML, enlace:Boolean }
   * @returns {String}
   */
  function tarjeta(socio, opts) {
    var o = opts || {};
    if (!socio || typeof socio !== 'object') {
      return '<div class="card"><div class="card-body">' +
        vacio('No encontramos los datos de este socio.', 'usuario') + '</div></div>';
    }

    var plan = socio.planId ? DB.plan(socio.planId) : null;
    var em = C.estadoMembresia(socio);
    var ad = adherenciaDe(socio);
    var nombre = U.nombreCompleto(socio);
    var claseBar = ad.pct >= 80 ? 'ok' : (ad.pct >= 50 ? 'warn' : 'error');

    var html = '<div class="card hover-elevar" data-socio="' + esc(socio.id) + '">' +
      '<div class="card-body stack-sm">' +
        '<div class="row between wrap" style="gap:10px">' +
          '<div class="persona">' +
            U.avatar(socio, 'lg') +
            '<div class="persona-txt">' +
              '<b>' + esc(nombre) + '</b>' +
              '<span class="mini muted">' + esc(socio.codigo || 'Sin código') + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="badge ' + esc(em.clase) + '">' + esc(etiquetaEstado(em.estado === 'por_vencer' ? 'activo' : em.estado)) +
            (em.estado === 'por_vencer' ? ' · por vencer' : '') + '</span>' +
        '</div>' +
        '<div class="chips">' +
          '<span class="chip chip-sm">' + ico('tarjeta', 14) + esc(plan ? plan.nombre : 'Sin plan') + '</span>' +
          '<span class="chip chip-sm">' + ico(iconoObjetivo(socio.objetivo), 14) + esc(etiquetaObjetivo(socio.objetivo)) + '</span>' +
        '</div>' +
        '<div>' +
          '<div class="row between mini muted"><span>Progreso del mes</span>' +
            '<span class="bold">' + esc(U.pct(ad.pct, 0)) + '</span></div>' +
          '<div class="bar mt-sm"><span class="bar-fill ' + claseBar + '" style="width:' + Math.max(0, Math.min(100, ad.pct)) + '%"></span></div>' +
          '<div class="micro muted mt-sm">' + esc(ad.hechas + ' de ' + ad.esperadas + ' sesiones previstas') + '</div>' +
        '</div>' +
      '</div>' +
      (o.acciones ? '<div class="card-foot">' + o.acciones + '</div>' : '') +
    '</div>';

    return html;
  }

  /* =============================================================
     5. Selector de socio (modal reutilizable)
     ============================================================= */

  /**
   * Modal buscador de socio.
   * @param {Function} callback recibe el socio elegido
   * @param {Object} [opciones] { titulo, incluirBajas:Boolean, filtro:Function }
   */
  function selector(callback, opts) {
    var o = opts || {};
    var usuario = AG.Auth && typeof AG.Auth.actual === 'function' ? AG.Auth.actual() : null;
    var universo = sociosVisibles(usuario);

    var lista = [];
    for (var i = 0; i < universo.length; i++) {
      var s = universo[i];
      if (!o.incluirBajas && s.estado === 'baja') continue;
      if (typeof o.filtro === 'function') {
        var ok = false;
        try { ok = !!o.filtro(s); } catch (e) { ok = false; }
        if (!ok) continue;
      }
      lista.push(s);
    }
    lista = U.ordenar(lista, function (s) { return U.nombreCompleto(s); }, 'asc');

    var idCampo = U.uid('bsc_');

    function filasHTML(texto) {
      var q = U.normalizar(texto || '');
      var salida = '';
      var cuantos = 0;
      for (var j = 0; j < lista.length; j++) {
        var so = lista[j];
        if (q) {
          var blanco = U.normalizar(U.nombreCompleto(so) + ' ' + (so.codigo || '') + ' ' +
            (so.email || '') + ' ' + (so.telefono || '')) + ' ' + soloDigitos(so.telefono);
          if (blanco.indexOf(q) < 0) continue;
        }
        if (cuantos >= 40) break;
        cuantos++;
        var em = C.estadoMembresia(so);
        salida += '<button type="button" class="list-item clickable" data-elegir="' + esc(so.id) + '">' +
          U.avatar(so, 'sm') +
          '<div class="list-item-main">' +
            '<b>' + esc(U.nombreCompleto(so)) + '</b>' +
            '<span class="mini muted">' + esc((so.codigo || 'Sin código')) + '</span>' +
          '</div>' +
          '<div class="list-item-side"><span class="badge ' + esc(em.clase) + '">' +
            esc(etiquetaEstado(em.estado === 'por_vencer' ? 'activo' : em.estado)) + '</span></div>' +
        '</button>';
      }
      if (!salida) {
        return vacio(q ? 'Ningún socio coincide con «' + texto + '».' : 'Todavía no hay socios en tu lista.', 'buscar');
      }
      return '<div class="list">' + salida + '</div>';
    }

    var cuerpo = '<div class="stack-sm">' +
      '<div class="field">' +
        '<label class="label" for="' + idCampo + '">Buscar socio</label>' +
        '<div class="input-icono">' + ico('buscar', 18) +
          '<input id="' + idCampo + '" class="input" type="search" autocomplete="off" placeholder="Nombre, código, correo o teléfono">' +
        '</div>' +
      '</div>' +
      '<div data-resultado>' + filasHTML('') + '</div>' +
    '</div>';

    var api = U.modal({
      titulo: o.titulo || 'Elegir socio',
      ancho: 'md',
      cuerpo: cuerpo,
      onOpen: function (root, modalApi) {
        var campo = root.querySelector('#' + idCampo);
        var caja = root.querySelector('[data-resultado]');
        if (campo && caja) {
          var repintar = U.debounce(function () {
            caja.innerHTML = filasHTML(campo.value);
          }, 200);
          campo.addEventListener('input', repintar);
        }
        U.delegar(root, 'click', '[data-elegir]', function (e, el) {
          e.preventDefault();
          var id = el.getAttribute('data-elegir');
          var elegido = DB.usuario(id);
          modalApi.cerrar();
          if (elegido && typeof callback === 'function') {
            try { callback(elegido); } catch (err) { U.toast('No se pudo continuar con ese socio.', 'error'); }
          }
        });
      }
    });

    return api;
  }

  /* =============================================================
     6. Formulario de alta / edición
     ============================================================= */

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  function siguienteCodigo() {
    var lista = DB.socios();
    var max = 0;
    for (var i = 0; i < lista.length; i++) {
      var m = /^AG-(\d+)$/.exec(String(lista[i].codigo || '').trim().toUpperCase());
      if (!m) continue;
      var n = parseInt(m[1], 10);
      if (isFinite(n) && n > max) max = n;
    }
    return 'AG-' + rellenar(max + 1, 4);
  }

  function emailOcupado(email, exceptoId) {
    var correo = String(email || '').trim().toLowerCase();
    if (!correo) return false;
    var lista = DB.get('usuarios');
    for (var i = 0; i < lista.length; i++) {
      var u = lista[i];
      if (!u || !u.email) continue;
      if (exceptoId && u.id === exceptoId) continue;
      if (String(u.email).trim().toLowerCase() === correo) return true;
    }
    return false;
  }

  function campo(nombre, etiqueta, control, ayuda) {
    return '<div class="field">' +
      '<label class="label" for="f-' + esc(nombre) + '">' + esc(etiqueta) + '</label>' +
      control +
      '<p class="help" data-error="' + esc(nombre) + '">' + esc(ayuda || '') + '</p>' +
    '</div>';
  }

  function input(nombre, tipo, valor, atributos) {
    return '<input id="f-' + esc(nombre) + '" name="' + esc(nombre) + '" class="input" type="' + esc(tipo) + '"' +
      ' value="' + esc(valor === null || valor === undefined ? '' : valor) + '"' +
      (atributos ? ' ' + atributos : '') + '>';
  }

  function seccion(titulo, iconoNombre, contenido) {
    return '<div class="card card-plano mb">' +
      '<div class="card-head"><h4 class="card-title">' + ico(iconoNombre, 16) + ' ' + esc(titulo) + '</h4></div>' +
      '<div class="card-body">' + contenido + '</div>' +
    '</div>';
  }

  /**
   * Modal de alta o edición de socio.
   * @param {String|null} socioId  null = alta
   * @param {Function} [alGuardar] callback con el socio guardado
   */
  function formulario(socioId, alGuardar) {
    var usuario = AG.Auth && typeof AG.Auth.actual === 'function' ? AG.Auth.actual() : null;
    if (!usuario) {
      U.toast('Necesitas iniciar sesión para registrar socios.', 'error');
      return null;
    }

    var edicion = !!socioId;
    var socio = edicion ? DB.usuario(socioId) : null;

    if (edicion && (!socio || socio.rol !== 'socio')) {
      U.toast('No encontramos ese socio en la base.', 'error');
      return null;
    }
    if (edicion && !puedeVer(usuario, socioId)) {
      U.toast('No tienes permiso para editar este expediente.', 'error');
      return null;
    }

    var s = socio || {};
    var ce = (s.contactoEmergencia && typeof s.contactoEmergencia === 'object') ? s.contactoEmergencia : {};
    var planes = U.ordenar(DB.donde('planes', function (p) { return edicion || p.activo !== false; }), 'precio', 'asc');
    var coaches = U.ordenar(DB.coaches(), function (c) { return U.nombreCompleto(c); }, 'asc');

    var listaPlanes = [];
    for (var i = 0; i < planes.length; i++) {
      listaPlanes.push({
        v: planes[i].id,
        t: planes[i].nombre + ' · ' + U.dinero(planes[i].precio) +
           ' · ' + (planes[i].meses === 1 ? '1 mes' : planes[i].meses + ' meses')
      });
    }

    var listaCoaches = [];
    for (var j = 0; j < coaches.length; j++) {
      listaCoaches.push({ v: coaches[j].id, t: U.nombreCompleto(coaches[j]) });
    }

    var coachFijo = (usuario.rol === 'coach');
    var estadosDisponibles = coachFijo
      ? [{ v: 'activo', t: 'Activo' }, { v: 'congelado', t: 'Congelado' }, { v: 'vencido', t: 'Vencido' }]
      : ESTADOS;

    var telefonoActual = s.telefono || '';
    var passwordSugerida = soloDigitos(telefonoActual).slice(-4);

    /* ---------- Cuerpo del formulario ---------- */

    var htmlObjetivos = '<div class="radio-cards">';
    for (var k = 0; k < OBJETIVOS.length; k++) {
      var o = OBJETIVOS[k];
      var marcado = (s.objetivo || 'salud') === o.v;
      htmlObjetivos += '<label class="radio-card' + (marcado ? ' on' : '') + '" data-objetivo="' + esc(o.v) + '">' +
        '<input type="radio" name="objetivo" value="' + esc(o.v) + '"' + (marcado ? ' checked' : '') + '>' +
        ico(o.icono, 22) +
        '<b>' + esc(o.t) + '</b>' +
        '<span>' + esc(o.d) + '</span>' +
      '</label>';
    }
    htmlObjetivos += '</div><p class="help" data-error="objetivo"></p>';

    var cuerpo = '<form id="ag-form-socio" autocomplete="off" novalidate>' +

      seccion('Datos personales', 'usuario',
        '<div class="form-grid">' +
          campo('nombre', 'Nombre(s)', input('nombre', 'text', s.nombre, 'maxlength="60" autofocus')) +
          campo('apellidos', 'Apellidos', input('apellidos', 'text', s.apellidos, 'maxlength="60"')) +
          campo('fechaNacimiento', 'Fecha de nacimiento',
            input('fechaNacimiento', 'date', s.fechaNacimiento, 'max="' + esc(U.hoy()) + '"'),
            '') +
          '<div class="field">' +
            '<span class="label">Edad</span>' +
            '<div class="input" id="ag-edad" style="display:flex;align-items:center">' +
              esc(s.fechaNacimiento ? U.edad(s.fechaNacimiento) + ' años' : 'Se calcula sola') +
            '</div>' +
            '<p class="help">Se actualiza al elegir la fecha.</p>' +
          '</div>' +
          campo('sexo', 'Sexo',
            '<select id="f-sexo" name="sexo" class="select">' + opciones(SEXOS, s.sexo || 'H', '') + '</select>') +
          campo('estaturaCm', 'Estatura (cm)',
            input('estaturaCm', 'number', s.estaturaCm, 'min="120" max="230" step="0.5" inputmode="decimal"')) +
          campo('telefono', 'Teléfono (10 dígitos)',
            input('telefono', 'tel', telefonoActual, 'maxlength="20" inputmode="tel"')) +
          campo('email', 'Correo electrónico',
            input('email', 'email', s.email, 'maxlength="80" inputmode="email"'),
            'Con este correo entra el socio al sistema.') +
        '</div>') +

      seccion('Membresía', 'tarjeta',
        '<div class="form-grid">' +
          campo('planId', 'Plan',
            '<select id="f-planId" name="planId" class="select">' +
              opciones(listaPlanes, s.planId, listaPlanes.length ? '' : 'No hay planes registrados') +
            '</select>',
            '') +
          campo('coachId', 'Coach asignado',
            '<select id="f-coachId" name="coachId" class="select"' + (coachFijo ? ' data-fijo="1"' : '') + '>' +
              (coachFijo
                ? '<option value="' + esc(usuario.id) + '" selected>' + esc(U.nombreCompleto(usuario)) + '</option>'
                : opciones(listaCoaches, s.coachId, 'Sin coach asignado')) +
            '</select>',
            coachFijo ? 'Como coach, los socios que registras quedan a tu cargo.' : '') +
          campo('fechaAlta', 'Fecha de alta',
            input('fechaAlta', 'date', s.fechaAlta || U.hoy(), '')) +
          campo('estado', 'Estado',
            '<select id="f-estado" name="estado" class="select">' +
              opciones(estadosDisponibles, s.estado || 'activo', '') +
            '</select>') +
        '</div>' +
        '<p class="help mt-sm" id="ag-plan-precio"></p>') +

      seccion('Objetivo y condición', 'meta',
        htmlObjetivos +
        '<div class="form-grid mt">' +
          campo('nivel', 'Nivel de entrenamiento',
            '<select id="f-nivel" name="nivel" class="select">' + opciones(NIVELES, s.nivel || 'principiante', '') + '</select>') +
          campo('nivelActividad', 'Nivel de actividad diaria',
            '<select id="f-nivelActividad" name="nivelActividad" class="select">' +
              opciones(ACTIVIDADES, s.nivelActividad || 'ligero', '') + '</select>') +
        '</div>') +

      seccion('Salud', 'corazon',
        '<div class="form-grid dos">' +
          campo('padecimientos', 'Padecimientos o lesiones',
            '<textarea id="f-padecimientos" name="padecimientos" class="textarea" rows="2" maxlength="300">' +
              esc(s.padecimientos || '') + '</textarea>',
            'Escribe «Ninguno» si no aplica.') +
          campo('alergias', 'Alergias',
            '<textarea id="f-alergias" name="alergias" class="textarea" rows="2" maxlength="300">' +
              esc(s.alergias || '') + '</textarea>') +
        '</div>') +

      seccion('Contacto de emergencia', 'telefono',
        '<div class="form-grid tres">' +
          campo('contactoEmergencia.nombre', 'Nombre',
            '<input id="f-contactoEmergencia.nombre" name="contactoEmergencia.nombre" class="input" type="text" maxlength="60" value="' +
              esc(ce.nombre || '') + '">') +
          campo('contactoEmergencia.telefono', 'Teléfono',
            '<input id="f-contactoEmergencia.telefono" name="contactoEmergencia.telefono" class="input" type="tel" maxlength="20" value="' +
              esc(ce.telefono || '') + '">') +
          campo('contactoEmergencia.parentesco', 'Parentesco',
            '<input id="f-contactoEmergencia.parentesco" name="contactoEmergencia.parentesco" class="input" type="text" maxlength="40" value="' +
              esc(ce.parentesco || '') + '">') +
        '</div>') +

      seccion('Acceso', 'candado',
        '<div class="form-grid dos">' +
          campo('password', edicion ? 'Nueva contraseña' : 'Contraseña inicial',
            input('password', 'text', edicion ? '' : passwordSugerida, 'maxlength="40" autocomplete="new-password"'),
            edicion
              ? 'Déjala vacía para conservar la contraseña actual.'
              : 'Por defecto son los 4 últimos dígitos del teléfono.') +
        '</div>') +

      seccion('Notas', 'chat',
        '<div class="field">' +
          '<textarea id="f-notas" name="notas" class="textarea" rows="3" maxlength="600" placeholder="Observaciones del coach, preferencias, historial…">' +
            esc(s.notas || '') + '</textarea>' +
        '</div>') +

    '</form>';

    /* ---------- Validación ---------- */

    function limpiarErrores(root) {
      var ayudas = U.$$('[data-error]', root);
      for (var a = 0; a < ayudas.length; a++) {
        ayudas[a].classList.remove('error');
        var original = ayudas[a].getAttribute('data-original');
        if (original !== null) ayudas[a].textContent = original;
      }
      var campos = U.$$('.input, .select, .textarea', root);
      for (var b = 0; b < campos.length; b++) campos[b].classList.remove('error');
    }

    function marcarError(root, nombre, mensaje) {
      var ayuda = root.querySelector('[data-error="' + nombre + '"]');
      if (ayuda) {
        if (ayuda.getAttribute('data-original') === null) {
          ayuda.setAttribute('data-original', ayuda.textContent || '');
        }
        ayuda.classList.add('error');
        ayuda.textContent = mensaje;
      }
      var control = root.querySelector('[name="' + nombre + '"]');
      if (control && control.classList) control.classList.add('error');
    }

    function validar(datos) {
      var errores = [];

      if (!datos.nombre) errores.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
      if (!datos.apellidos) errores.push({ campo: 'apellidos', mensaje: 'Los apellidos son obligatorios.' });

      var correo = String(datos.email || '').trim();
      if (!correo) {
        errores.push({ campo: 'email', mensaje: 'El correo es obligatorio: con él entra el socio.' });
      } else if (!RE_EMAIL.test(correo)) {
        errores.push({ campo: 'email', mensaje: 'Escribe un correo válido, por ejemplo nombre@correo.com.' });
      } else if (emailOcupado(correo, edicion ? socioId : null)) {
        errores.push({ campo: 'email', mensaje: 'Ese correo ya está registrado en otra cuenta.' });
      }

      var tel = soloDigitos(datos.telefono);
      if (tel.length !== 10) {
        errores.push({ campo: 'telefono', mensaje: 'El teléfono debe tener exactamente 10 dígitos.' });
      }

      var est = Number(datos.estaturaCm);
      if (!isFinite(est) || est < 120 || est > 230) {
        errores.push({ campo: 'estaturaCm', mensaje: 'La estatura debe estar entre 120 y 230 cm.' });
      }

      if (!datos.fechaNacimiento) {
        errores.push({ campo: 'fechaNacimiento', mensaje: 'Registra la fecha de nacimiento.' });
      } else {
        var edad = U.edad(datos.fechaNacimiento);
        if (edad < 10 || edad > 99) {
          errores.push({ campo: 'fechaNacimiento', mensaje: 'La edad resultante (' + edad + ') debe estar entre 10 y 99 años.' });
        }
      }

      if (!datos.planId) errores.push({ campo: 'planId', mensaje: 'Elige un plan de membresía.' });
      if (!datos.fechaAlta) errores.push({ campo: 'fechaAlta', mensaje: 'Registra la fecha de alta.' });
      if (!datos.objetivo) errores.push({ campo: 'objetivo', mensaje: 'Elige un objetivo de entrenamiento.' });

      if (!edicion) {
        var pass = String(datos.password || '').trim();
        if (pass.length < 4) {
          errores.push({ campo: 'password', mensaje: 'La contraseña inicial debe tener al menos 4 caracteres.' });
        }
      } else if (String(datos.password || '').trim() && String(datos.password).trim().length < 4) {
        errores.push({ campo: 'password', mensaje: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      }

      return errores;
    }

    /* ---------- Guardado ---------- */

    function guardar(modalApi, root) {
      var form = root.querySelector('#ag-form-socio');
      if (!form) return;

      var datos = U.formToObject(form);
      limpiarErrores(root);

      var errores = validar(datos);
      if (errores.length) {
        for (var e = 0; e < errores.length; e++) marcarError(root, errores[e].campo, errores[e].mensaje);
        U.toast('Revisa los campos marcados en rojo.', 'error');
        var primero = root.querySelector('[name="' + errores[0].campo + '"]');
        if (primero && typeof primero.focus === 'function') {
          try { primero.focus(); } catch (err) { /* sin foco disponible */ }
        }
        return;
      }

      var plan = DB.plan(datos.planId);
      var mesesPlan = plan && Number(plan.meses) > 0 ? Number(plan.meses) : 1;
      var coachId = coachFijo ? usuario.id : (datos.coachId || null);
      var estadoElegido = datos.estado || 'activo';

      var comun = {
        nombre: String(datos.nombre).trim(),
        apellidos: String(datos.apellidos).trim(),
        email: String(datos.email).trim(),
        telefono: String(datos.telefono).trim(),
        fechaNacimiento: datos.fechaNacimiento,
        sexo: datos.sexo === 'M' ? 'M' : 'H',
        estaturaCm: Number(datos.estaturaCm),
        objetivo: datos.objetivo,
        nivel: datos.nivel || 'principiante',
        nivelActividad: datos.nivelActividad || 'ligero',
        coachId: coachId,
        planId: datos.planId,
        fechaAlta: datos.fechaAlta,
        estado: estadoElegido,
        activo: estadoElegido !== 'baja',
        padecimientos: String(datos.padecimientos || '').trim(),
        alergias: String(datos.alergias || '').trim(),
        contactoEmergencia: {
          nombre: String((datos.contactoEmergencia && datos.contactoEmergencia.nombre) || '').trim(),
          telefono: String((datos.contactoEmergencia && datos.contactoEmergencia.telefono) || '').trim(),
          parentesco: String((datos.contactoEmergencia && datos.contactoEmergencia.parentesco) || '').trim()
        },
        notas: String(datos.notas || '').trim()
      };

      var guardado = null;

      if (edicion) {
        var cambios = comun;
        var nuevaClave = String(datos.password || '').trim();
        if (nuevaClave) cambios.password = nuevaClave;   /* vacío = conserva la actual */
        if (!socio.fechaVencimiento) {
          cambios.fechaVencimiento = U.sumaMeses(comun.fechaAlta, mesesPlan);
        }
        if (estadoElegido === 'baja' && !socio.fechaBaja) cambios.fechaBaja = U.hoy();
        if (estadoElegido !== 'baja' && socio.fechaBaja) cambios.fechaBaja = '';
        guardado = DB.actualizar('usuarios', socioId, cambios);
        modalApi.cerrar();
        U.toast('Datos de ' + comun.nombre + ' actualizados.', 'ok');
        terminar(guardado);
        return;
      }

      var codigo = siguienteCodigo();
      var nuevo = {
        rol: 'socio',
        codigo: codigo,
        password: String(datos.password || '').trim() || soloDigitos(comun.telefono).slice(-4),
        avatarColor: U.colorDe(comun.nombre + ' ' + comun.apellidos + ' ' + codigo),
        creado: U.hoy(),
        fechaVencimiento: U.sumaMeses(comun.fechaAlta, mesesPlan)
      };
      for (var clave in comun) {
        if (Object.prototype.hasOwnProperty.call(comun, clave)) nuevo[clave] = comun[clave];
      }
      nuevo.estado = 'activo';
      nuevo.activo = true;

      guardado = DB.insertar('usuarios', nuevo);
      modalApi.cerrar();
      U.toast('Socio registrado con el código ' + codigo + '.', 'ok');

      U.confirmar(
        '¿Registrar el primer pago de ' + comun.nombre + ' ahora?',
        'Primer pago',
        { textoOk: 'Sí, cobrar', textoCancelar: 'Más tarde' }
      ).then(function (si) {
        if (si) {
          llamarModulo('Pagos', 'registrar', [guardado.id], 'El módulo de pagos todavía no está disponible.');
        }
        terminar(guardado);
      });
    }

    function terminar(registro) {
      if (typeof alGuardar === 'function') {
        try { alGuardar(registro); return; } catch (e) { /* se refresca abajo */ }
      }
      refrescarVista();
    }

    /* ---------- Modal ---------- */

    return U.modal({
      titulo: edicion ? 'Editar socio · ' + U.nombreCompleto(socio) : 'Nuevo socio',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: edicion ? 'Guardar cambios' : 'Registrar socio',
          clase: 'btn-primary',
          icono: 'check',
          onClick: function (modalApi) { guardar(modalApi, modalApi.root); return false; }
        }
      ],
      onOpen: function (root) {
        var campoNac = root.querySelector('[name="fechaNacimiento"]');
        var cajaEdad = root.querySelector('#ag-edad');
        var campoTel = root.querySelector('[name="telefono"]');
        var campoPass = root.querySelector('[name="password"]');
        var selectPlan = root.querySelector('[name="planId"]');
        var cajaPrecio = root.querySelector('#ag-plan-precio');
        var passwordTocada = edicion;

        function pintarEdad() {
          if (!cajaEdad) return;
          var v = campoNac ? campoNac.value : '';
          if (!v) { cajaEdad.textContent = 'Se calcula sola'; return; }
          var edad = U.edad(v);
          cajaEdad.textContent = (edad > 0 ? edad + (edad === 1 ? ' año' : ' años') : 'Fecha no válida');
        }

        function pintarPrecio() {
          if (!cajaPrecio || !selectPlan) return;
          var plan = DB.plan(selectPlan.value);
          if (!plan) { cajaPrecio.textContent = 'Elige un plan para ver su precio.'; return; }
          var texto = 'Precio: ' + U.dinero(plan.precio) +
            ' · Vigencia: ' + (Number(plan.meses) === 1 ? '1 mes' : Number(plan.meses) + ' meses');
          if (Number(plan.inscripcion) > 0) texto += ' · Inscripción: ' + U.dinero(plan.inscripcion);
          cajaPrecio.textContent = texto;
        }

        if (campoNac) {
          campoNac.addEventListener('change', pintarEdad);
          campoNac.addEventListener('input', pintarEdad);
        }
        if (selectPlan) selectPlan.addEventListener('change', pintarPrecio);
        if (campoPass) {
          campoPass.addEventListener('input', function () { passwordTocada = true; });
        }
        if (campoTel && campoPass) {
          campoTel.addEventListener('input', function () {
            if (passwordTocada) return;
            campoPass.value = soloDigitos(campoTel.value).slice(-4);
          });
        }

        /* Tarjetas de objetivo: marcan visualmente la opción elegida */
        U.delegar(root, 'change', '[name="objetivo"]', function () {
          var tarjetas = U.$$('.radio-card[data-objetivo]', root);
          for (var t = 0; t < tarjetas.length; t++) {
            var radio = tarjetas[t].querySelector('input[type="radio"]');
            tarjetas[t].classList.toggle('on', !!(radio && radio.checked));
          }
        });

        pintarEdad();
        pintarPrecio();
      }
    });
  }

  /* =============================================================
     7. Acciones sobre un socio
     ============================================================= */

  function refrescarVista() {
    refrescoInterno = true;
    try { AG.Router.refrescar(); }
    catch (e) { refrescoInterno = false; }
  }

  function irAFicha(usuario, socioId) {
    AG.Router.ir({ path: rutaFicha(usuario), params: { id: socioId } });
  }

  function accionCobrar(socio) {
    llamarModulo('Pagos', 'registrar', [socio.id], 'El módulo de pagos todavía no está disponible.');
  }

  function accionMedir(socio) {
    llamarModulo('Mediciones', 'capturar', [socio.id], 'El módulo de mediciones todavía no está disponible.');
  }

  function accionRutina(socio) {
    llamarModulo('Rutinas', 'asignar', [socio.id], 'El módulo de rutinas todavía no está disponible.');
  }

  function accionNutricion(socio) {
    llamarModulo('Nutricion', 'editorPlan', [socio.id], 'El módulo de nutrición todavía no está disponible.');
  }

  function accionCongelar(socio) {
    U.confirmar(
      'La membresía de ' + U.nombreCompleto(socio) + ' quedará congelada y dejará de contar días.',
      'Congelar membresía',
      { textoOk: 'Sí, congelar' }
    ).then(function (si) {
      if (!si) return;
      DB.actualizar('usuarios', socio.id, { estado: 'congelado', activo: true });
      DB.notificar(socio.id, {
        titulo: 'Membresía congelada',
        cuerpo: 'Tu membresía quedó congelada. Avísanos cuando quieras reactivarla.',
        tipo: 'sistema',
        link: '#/socio/membresia'
      });
      U.toast('Membresía congelada.', 'ok');
      refrescarVista();
    });
  }

  function accionReactivar(socio) {
    DB.actualizar('usuarios', socio.id, { estado: 'activo', activo: true, fechaBaja: '' });
    try { DB.recalcularEstadoSocios(); } catch (e) { /* el estado ya quedó en activo */ }
    DB.notificar(socio.id, {
      titulo: 'Membresía reactivada',
      cuerpo: '¡Bienvenido de vuelta! Tu acceso quedó activo otra vez.',
      tipo: 'sistema',
      link: '#/socio/membresia'
    });
    U.toast(U.nombreCompleto(socio) + ' está activo de nuevo.', 'ok');
    refrescarVista();
  }

  function accionBaja(socio) {
    U.confirmar(
      '¿Dar de baja a ' + U.nombreCompleto(socio) + '? Perderá el acceso al sistema, pero su historial se conserva.',
      'Dar de baja',
      { textoOk: 'Sí, dar de baja', peligro: true }
    ).then(function (si) {
      if (!si) return;
      DB.actualizar('usuarios', socio.id, {
        estado: 'baja',
        activo: false,
        fechaBaja: U.hoy()
      });
      U.toast(U.nombreCompleto(socio) + ' quedó dado de baja.', 'ok');
      refrescarVista();
    });
  }

  /** Modal con la lista completa de acciones para un socio. */
  function menuAcciones(socio, usuario) {
    var congelado = (socio.estado === 'congelado' || socio.estado === 'baja');
    var filas = [];

    filas.push({ accion: 'ver', icono: 'ojo', texto: 'Ver ficha completa' });
    filas.push({ accion: 'editar', icono: 'editar', texto: 'Editar datos del socio' });
    if (esDirector(usuario)) filas.push({ accion: 'cobrar', icono: 'dinero', texto: 'Registrar cobro' });
    filas.push({ accion: 'medir', icono: 'cinta', texto: 'Capturar medición' });
    filas.push({ accion: 'rutina', icono: 'pesa', texto: 'Asignar rutina' });
    filas.push({ accion: 'nutricion', icono: 'nutricion', texto: 'Plan de nutrición' });
    filas.push({ accion: 'whatsapp', icono: 'whatsapp', texto: 'Enviar WhatsApp' });
    filas.push(congelado
      ? { accion: 'reactivar', icono: 'sol', texto: 'Reactivar membresía' }
      : { accion: 'congelar', icono: 'luna', texto: 'Congelar membresía' });
    if (esDirector(usuario) && socio.estado !== 'baja') {
      filas.push({ accion: 'baja', icono: 'salir', texto: 'Dar de baja', clase: 'txt-error' });
    }

    var html = '<div class="list">';
    for (var i = 0; i < filas.length; i++) {
      html += '<button type="button" class="list-item clickable" data-menu-accion="' + esc(filas[i].accion) + '">' +
        '<span class="' + esc(filas[i].clase || 'muted') + '">' + ico(filas[i].icono, 18) + '</span>' +
        '<div class="list-item-main"><b class="' + esc(filas[i].clase || '') + '">' + esc(filas[i].texto) + '</b></div>' +
        '<div class="list-item-side">' + ico('flecha-der', 16) + '</div>' +
      '</button>';
    }
    html += '</div>';

    U.modal({
      titulo: 'Acciones · ' + U.nombreCompleto(socio),
      ancho: 'md',
      cuerpo: html,
      onOpen: function (root, api) {
        U.delegar(root, 'click', '[data-menu-accion]', function (e, el) {
          e.preventDefault();
          var accion = el.getAttribute('data-menu-accion');
          api.cerrar();
          ejecutarAccion(accion, socio, usuario);
        });
      }
    });
  }

  /** Punto único de despacho de acciones (tabla, tarjetas, menú y ficha). */
  function ejecutarAccion(accion, socio, usuario) {
    if (!socio) return;
    switch (accion) {
      case 'ver': irAFicha(usuario, socio.id); break;
      case 'editar': formulario(socio.id); break;
      case 'cobrar':
        if (!esDirector(usuario)) { U.toast('Solo dirección registra cobros.', 'warn'); return; }
        accionCobrar(socio);
        break;
      case 'medir': accionMedir(socio); break;
      case 'rutina': accionRutina(socio); break;
      case 'nutricion': accionNutricion(socio); break;
      case 'whatsapp': abrirWhatsApp(socio); break;
      case 'congelar': accionCongelar(socio); break;
      case 'reactivar': accionReactivar(socio); break;
      case 'baja':
        if (!esDirector(usuario)) { U.toast('Solo dirección puede dar de baja a un socio.', 'warn'); return; }
        accionBaja(socio);
        break;
      case 'menu': menuAcciones(socio, usuario); break;
      default: break;
    }
  }

  /* =============================================================
     8. Listado — estado, filtros y URL
     ============================================================= */

  function leerEstadoDeParams(params) {
    var p = params || {};
    var trae = false;
    var claves = ['q', 'estado', 'plan', 'coach', 'objetivo', 'nivel', 'orden', 'vista', 'pag'];
    for (var i = 0; i < claves.length; i++) {
      if (p[claves[i]] !== undefined && p[claves[i]] !== '') { trae = true; break; }
    }

    if (!trae) {
      /* Repintado propio (tras guardar o cambiar un estado): se conservan filtros */
      if (refrescoInterno) { refrescoInterno = false; return estadoLista; }
      estadoLista = estadoPorDefecto();
      return estadoLista;
    }

    refrescoInterno = false;
    var st = estadoPorDefecto();
    st.q = String(p.q || '');
    st.estado = String(p.estado || '');
    st.plan = String(p.plan || '');
    st.coach = String(p.coach || '');
    st.objetivo = String(p.objetivo || '');
    st.nivel = String(p.nivel || '');
    st.orden = String(p.orden || 'nombre');
    st.vista = (String(p.vista || '') === 'tarjetas') ? 'tarjetas' : 'tabla';
    var pag = parseInt(p.pag, 10);
    st.pag = isFinite(pag) && pag > 0 ? pag : 1;
    estadoLista = st;
    return st;
  }

  function paramsDeEstado(st) {
    var p = {};
    if (st.q) p.q = st.q;
    if (st.estado) p.estado = st.estado;
    if (st.plan) p.plan = st.plan;
    if (st.coach) p.coach = st.coach;
    if (st.objetivo) p.objetivo = st.objetivo;
    if (st.nivel) p.nivel = st.nivel;
    if (st.orden && st.orden !== 'nombre') p.orden = st.orden;
    if (st.vista && st.vista !== 'tabla') p.vista = st.vista;
    if (st.pag > 1) p.pag = st.pag;
    return p;
  }

  /** Refleja los filtros en la barra de direcciones sin repintar la ruta. */
  function sincronizarURL(path, st) {
    var pares = [];
    var p = paramsDeEstado(st);
    for (var k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      pares.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(p[k])));
    }
    var destino = '#/' + path + (pares.length ? '?' + pares.join('&') : '');
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', destino);
      }
    } catch (e) { /* file:// puede bloquearlo: los filtros siguen funcionando */ }
  }

  function filtrarYOrdenar(filas, st) {
    var q = U.normalizar(st.q);
    var salida = [];

    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var s = f.socio;

      if (q) {
        var blanco = U.normalizar(U.nombreCompleto(s) + ' ' + (s.codigo || '') + ' ' +
          (s.telefono || '') + ' ' + (s.email || '')) + ' ' + soloDigitos(s.telefono);
        if (blanco.indexOf(q) < 0) continue;
      }

      if (st.estado) {
        if (st.estado === 'por_vencer') {
          if (f.membresia.estado !== 'por_vencer') continue;
        } else if ((s.estado || 'activo') !== st.estado) {
          continue;
        }
      }

      if (st.plan && (s.planId || '') !== st.plan) continue;

      if (st.coach) {
        if (st.coach === 'sin') { if (s.coachId) continue; }
        else if ((s.coachId || '') !== st.coach) continue;
      }

      if (st.objetivo && (s.objetivo || '') !== st.objetivo) continue;
      if (st.nivel && (s.nivel || '') !== st.nivel) continue;

      salida.push(f);
    }

    if (st.orden === 'antiguedad') {
      salida = U.ordenar(salida, function (f) { return f.socio.fechaAlta || ''; }, 'asc');
    } else if (st.orden === 'vencimiento') {
      salida = U.ordenar(salida, function (f) { return f.socio.fechaVencimiento || ''; }, 'asc');
    } else if (st.orden === 'adherencia') {
      salida = U.ordenar(salida, function (f) { return f.adherencia.pct; }, 'desc');
    } else {
      salida = U.ordenar(salida, function (f) { return U.nombreCompleto(f.socio); }, 'asc');
    }

    return salida;
  }

  /* =============================================================
     9. Listado — HTML
     ============================================================= */

  function kpisHTML(filas) {
    var total = filas.length;
    var activos = 0, porVencer = 0, vencidos = 0, altas = 0, bajas = 0;
    var mes = U.mesActual();

    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var e = f.membresia.estado;
      if (e === 'activo') activos++;
      else if (e === 'por_vencer') porVencer++;
      else if (e === 'vencido') vencidos++;

      if (U.mesDe(f.socio.fechaAlta) === mes) altas++;

      if (f.socio.estado === 'baja') {
        /* La fecha de baja se guarda al darlo de baja; si el registro es
           anterior a esa mejora, se usa su fecha de vencimiento. */
        var fb = f.socio.fechaBaja || f.socio.fechaVencimiento || '';
        if (U.mesDe(fb) === mes) bajas++;
      }
    }

    var tarjetas = [
      { val: total, label: 'Total de socios', icono: 'socios', clase: '' },
      { val: activos, label: 'Activos', icono: 'check', clase: 'kpi-ok' },
      { val: porVencer, label: 'Por vencer (7 días)', icono: 'alerta', clase: 'kpi-warn' },
      { val: vencidos, label: 'Vencidos', icono: 'x', clase: 'kpi-error' },
      { val: altas, label: 'Altas de ' + U.nombreMes(mes), icono: 'mas', clase: 'kpi-info' },
      { val: bajas, label: 'Bajas de ' + U.nombreMes(mes), icono: 'salir', clase: '' }
    ];

    var html = '<div class="grid g3">';
    for (var k = 0; k < tarjetas.length; k++) {
      html += '<div class="kpi ' + esc(tarjetas[k].clase) + '">' +
        '<div class="kpi-icono">' + ico(tarjetas[k].icono, 22) + '</div>' +
        '<div class="kpi-datos">' +
          '<span class="kpi-val">' + esc(U.num(tarjetas[k].val, 0)) + '</span>' +
          '<span class="kpi-label">' + esc(tarjetas[k].label) + '</span>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function barraHerramientasHTML(st, usuario) {
    var planes = U.ordenar(DB.get('planes'), 'nombre', 'asc');
    var listaPlanes = [];
    for (var i = 0; i < planes.length; i++) listaPlanes.push({ v: planes[i].id, t: planes[i].nombre });

    var listaCoaches = [{ v: 'sin', t: 'Sin coach asignado' }];
    var coaches = U.ordenar(DB.coaches(), function (c) { return U.nombreCompleto(c); }, 'asc');
    for (var j = 0; j < coaches.length; j++) {
      listaCoaches.push({ v: coaches[j].id, t: U.nombreCompleto(coaches[j]) });
    }

    var listaEstados = [
      { v: 'activo', t: 'Activos' },
      { v: 'por_vencer', t: 'Por vencer' },
      { v: 'vencido', t: 'Vencidos' },
      { v: 'congelado', t: 'Congelados' },
      { v: 'baja', t: 'Bajas' }
    ];

    var html = '<div class="card"><div class="card-body stack-sm">' +
      '<div class="form-grid">' +
        '<div class="field">' +
          '<label class="label" for="ag-q">Buscar socio</label>' +
          '<div class="input-icono">' + ico('buscar', 18) +
            '<input id="ag-q" class="input" type="search" autocomplete="off" data-filtro="q"' +
            ' placeholder="Nombre, código, teléfono o correo" value="' + esc(st.q) + '">' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="ag-estado">Estado</label>' +
          '<select id="ag-estado" class="select" data-filtro="estado">' +
            opciones(listaEstados, st.estado, 'Todos los estados') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="ag-plan">Plan</label>' +
          '<select id="ag-plan" class="select" data-filtro="plan">' +
            opciones(listaPlanes, st.plan, 'Todos los planes') + '</select>' +
        '</div>' +
        (esDirector(usuario)
          ? '<div class="field">' +
              '<label class="label" for="ag-coach">Coach</label>' +
              '<select id="ag-coach" class="select" data-filtro="coach">' +
                opciones(listaCoaches, st.coach, 'Todos los coaches') + '</select>' +
            '</div>'
          : '') +
        '<div class="field">' +
          '<label class="label" for="ag-objetivo">Objetivo</label>' +
          '<select id="ag-objetivo" class="select" data-filtro="objetivo">' +
            opciones(OBJETIVOS, st.objetivo, 'Todos los objetivos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="ag-nivel">Nivel</label>' +
          '<select id="ag-nivel" class="select" data-filtro="nivel">' +
            opciones(NIVELES, st.nivel, 'Todos los niveles') + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="row between wrap" style="gap:10px">' +
        '<div class="row-sm wrap">' +
          '<div class="field" style="min-width:210px">' +
            '<label class="label" for="ag-orden">Ordenar por</label>' +
            '<select id="ag-orden" class="select" data-filtro="orden">' + opciones(ORDENES, st.orden, '') + '</select>' +
          '</div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-accion="limpiar" style="align-self:flex-end">' +
            ico('filtro', 16) + ' Limpiar filtros</button>' +
        '</div>' +
        '<div class="btn-grupo" role="group" aria-label="Forma de ver la lista">' +
          '<button type="button" class="btn btn-sm' + (st.vista === 'tarjetas' ? ' activo' : '') + '" data-vista="tarjetas">' +
            ico('socios', 16) + ' Tarjetas</button>' +
          '<button type="button" class="btn btn-sm' + (st.vista === 'tabla' ? ' activo' : '') + '" data-vista="tabla">' +
            ico('reporte', 16) + ' Tabla</button>' +
        '</div>' +
      '</div>' +
    '</div></div>';

    return html;
  }

  function filaTablaHTML(f, usuario) {
    var s = f.socio;
    var em = f.membresia;
    return '<tr data-id="' + esc(s.id) + '">' +
      '<td>' +
        '<div class="persona">' + U.avatar(s, 'sm') +
          '<div class="persona-txt">' +
            '<b>' + esc(U.nombreCompleto(s)) + '</b>' +
            '<span class="mini muted">' + esc(etiquetaObjetivo(s.objetivo)) + '</span>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td class="mono nowrap">' + esc(s.codigo || '—') + '</td>' +
      '<td>' + esc(f.plan ? f.plan.nombre : 'Sin plan') + '</td>' +
      '<td>' + esc(f.coach ? U.nombreCompleto(f.coach) : 'Sin coach') + '</td>' +
      '<td><span class="badge ' + esc(em.clase) + '" title="' + esc(em.texto) + '">' +
        esc(etiquetaEstado(em.estado === 'por_vencer' ? 'activo' : em.estado)) +
        (em.estado === 'por_vencer' ? ' · por vencer' : '') + '</span></td>' +
      '<td class="nowrap">' + esc(s.fechaVencimiento ? U.fecha(s.fechaVencimiento, 'corto') : '—') + '</td>' +
      '<td class="nums">' + esc(U.num(f.meses, 0)) + '</td>' +
      '<td class="nowrap">' + esc(f.ultimaAsistencia ? U.fechaRelativa(f.ultimaAsistencia) : 'Sin registro') + '</td>' +
      '<td>' + accionesDe(s, usuario) + '</td>' +
    '</tr>';
  }

  function resultadosHTML(filas, st, usuario) {
    var total = filas.length;
    var paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    var pag = Math.min(Math.max(1, st.pag), paginas);
    st.pag = pag;

    var desde = (pag - 1) * POR_PAGINA;
    var pagina = filas.slice(desde, desde + POR_PAGINA);

    if (!total) {
      return '<div class="card"><div class="card-body">' +
        vacio(
          'Ningún socio coincide con los filtros actuales. Prueba a limpiarlos o registra un socio nuevo.',
          'buscar',
          '<button type="button" class="btn btn-outline btn-sm" data-accion="limpiar">Limpiar filtros</button>'
        ) +
      '</div></div>';
    }

    var html = '<div class="row between wrap mb-sm">' +
      '<span class="mini muted">Mostrando ' + esc(U.num(pagina.length, 0)) + ' de ' +
        esc(U.num(total, 0)) + (total === 1 ? ' socio' : ' socios') + '</span>' +
      '<span class="mini muted">Página ' + pag + ' de ' + paginas + '</span>' +
    '</div>';

    var i;
    if (st.vista === 'tarjetas') {
      html += '<div class="grid g3">';
      for (i = 0; i < pagina.length; i++) {
        html += tarjeta(pagina[i].socio, { acciones: accionesDe(pagina[i].socio, usuario) });
      }
      html += '</div>';
    } else {
      html += '<div class="table-wrap"><table class="table table-compacta">' +
        '<thead><tr>' +
          '<th>Socio</th><th>Código</th><th>Plan</th><th>Coach</th><th>Estado</th>' +
          '<th>Vence</th><th>Meses</th><th>Última asistencia</th><th>Acciones</th>' +
        '</tr></thead><tbody>';
      for (i = 0; i < pagina.length; i++) html += filaTablaHTML(pagina[i], usuario);
      html += '</tbody></table></div>';
    }

    if (paginas > 1) {
      html += '<div class="row center wrap mt">' +
        '<button type="button" class="btn btn-outline btn-sm" data-pagina="' + (pag - 1) + '"' +
          (pag <= 1 ? ' disabled' : '') + '>' + ico('flecha-izq', 16) + ' Anterior</button>' +
        '<span class="mini muted">' + pag + ' / ' + paginas + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-pagina="' + (pag + 1) + '"' +
          (pag >= paginas ? ' disabled' : '') + '>Siguiente ' + ico('flecha-der', 16) + '</button>' +
      '</div>';
    }

    return html;
  }

  /* ---------- Exportación CSV ---------- */

  function csvCampo(v) {
    var t = (v === null || v === undefined) ? '' : String(v);
    return '"' + t.replace(/"/g, '""') + '"';
  }

  function exportarCSV(filas) {
    if (!filas.length) {
      U.toast('No hay socios que exportar con los filtros actuales.', 'warn');
      return;
    }
    var cabeceras = ['Código', 'Nombre', 'Apellidos', 'Correo', 'Teléfono', 'Sexo', 'Nacimiento',
      'Edad', 'Estatura (cm)', 'Objetivo', 'Nivel', 'Plan', 'Precio', 'Coach', 'Fecha de alta',
      'Vencimiento', 'Estado', 'Meses pagados', 'Adherencia (%)', 'Última asistencia'];

    var lineas = [];
    var enc = [];
    for (var c = 0; c < cabeceras.length; c++) enc.push(csvCampo(cabeceras[c]));
    lineas.push(enc.join(','));

    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var s = f.socio;
      var fila = [
        s.codigo || '', s.nombre || '', s.apellidos || '', s.email || '', s.telefono || '',
        etiquetaSexo(s.sexo), s.fechaNacimiento || '',
        s.fechaNacimiento ? U.edad(s.fechaNacimiento) : '',
        s.estaturaCm || '', etiquetaObjetivo(s.objetivo), etiquetaNivel(s.nivel),
        f.plan ? f.plan.nombre : '', f.plan ? f.plan.precio : '',
        f.coach ? U.nombreCompleto(f.coach) : '',
        s.fechaAlta || '', s.fechaVencimiento || '', etiquetaEstado(s.estado),
        f.meses, f.adherencia.pct, f.ultimaAsistencia || ''
      ];
      var celdas = [];
      for (var j = 0; j < fila.length; j++) celdas.push(csvCampo(fila[j]));
      lineas.push(celdas.join(','));
    }

    /* El BOM hace que Excel en español abra bien los acentos */
    var contenido = '﻿' + lineas.join('\r\n');
    var nombre = 'alliance-gym-socios-' + U.hoy() + '.csv';
    if (U.descargar(nombre, contenido, 'text/csv;charset=utf-8')) {
      U.toast('Exportamos ' + filas.length + (filas.length === 1 ? ' socio.' : ' socios.'), 'ok');
    }
  }

  /* =============================================================
     10. Listado — render de la ruta
     ============================================================= */

  function renderLista(ctx) {
    var usuario = ctx.usuario;
    var st = leerEstadoDeParams(ctx.params);
    var path = ctx.path;

    var universo = sociosVisibles(usuario);
    var filas = [];
    for (var i = 0; i < universo.length; i++) filas.push(filaDe(universo[i]));

    var titulo = esDirector(usuario) ? 'Socios' : 'Mis socios';
    var subtitulo = esDirector(usuario)
      ? 'Padrón completo del gimnasio: membresías, planes y seguimiento.'
      : 'Los socios que tienes asignados y su avance del mes.';

    var html = '<div class="page" id="ag-socios-page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + esc(titulo) + '</h1>' +
          '<p class="page-sub">' + esc(subtitulo) + '</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-outline btn-sm" data-accion="exportar">' +
            ico('descargar', 16) + ' Exportar CSV</button>' +
          '<button type="button" class="btn btn-primary" data-accion="nuevo">' +
            ico('mas', 16) + ' Nuevo socio</button>' +
        '</div>' +
      '</div>';

    if (!filas.length) {
      html += '<div class="card"><div class="card-body">' +
        vacio(
          esDirector(usuario)
            ? 'Todavía no hay socios registrados. Da de alta al primero para empezar.'
            : 'Aún no tienes socios asignados. Pide a dirección que te asigne alumnos.',
          'socios',
          esDirector(usuario)
            ? '<button type="button" class="btn btn-primary" data-accion="nuevo">' + ico('mas', 16) + ' Registrar socio</button>'
            : ''
        ) +
      '</div></div></div>';
      return { html: html, listo: function (root) { engancharLista(root, usuario, st, filas, path); } };
    }

    html += kpisHTML(filas);
    html += barraHerramientasHTML(st, usuario);
    html += '<div id="ag-socios-resultado">' + resultadosHTML(filtrarYOrdenar(filas, st), st, usuario) + '</div>';
    html += '</div>';

    return {
      html: html,
      listo: function (root) { engancharLista(root, usuario, st, filas, path); }
    };
  }

  function engancharLista(rootVista, usuario, st, filas, path) {
    /* Los eventos se cuelgan del contenedor de ESTA vista: al repintar la
       ruta, el nodo se descarta y con él sus escuchas. */
    var root = rootVista.querySelector('#ag-socios-page');
    if (!root) return;

    var caja = root.querySelector('#ag-socios-resultado');

    function repintar() {
      if (!caja) return;
      caja.innerHTML = resultadosHTML(filtrarYOrdenar(filas, st), st, usuario);
      sincronizarURL(path, st);
    }

    function socioDe(el) {
      var id = el.getAttribute('data-id');
      if (!id) {
        var fila = el.closest ? el.closest('[data-id],[data-socio]') : null;
        if (fila) id = fila.getAttribute('data-id') || fila.getAttribute('data-socio');
      }
      return id ? DB.usuario(id) : null;
    }

    /* --- Buscador con retardo --- */
    var campoQ = root.querySelector('[data-filtro="q"]');
    if (campoQ) {
      var buscar = U.debounce(function () {
        st.q = campoQ.value || '';
        st.pag = 1;
        repintar();
      }, 260);
      campoQ.addEventListener('input', buscar);
      campoQ.addEventListener('search', function () { st.q = campoQ.value || ''; st.pag = 1; repintar(); });
    }

    /* --- Selectores de filtro y orden --- */
    U.delegar(root, 'change', 'select[data-filtro]', function (e, el) {
      var clave = el.getAttribute('data-filtro');
      st[clave] = el.value || '';
      st.pag = 1;
      repintar();
    });

    /* --- Conmutador tarjetas / tabla --- */
    U.delegar(root, 'click', '[data-vista]', function (e, el) {
      e.preventDefault();
      st.vista = el.getAttribute('data-vista') === 'tarjetas' ? 'tarjetas' : 'tabla';
      var botones = U.$$('[data-vista]', root);
      for (var i = 0; i < botones.length; i++) {
        botones[i].classList.toggle('activo', botones[i].getAttribute('data-vista') === st.vista);
      }
      repintar();
    });

    /* --- Paginación --- */
    U.delegar(root, 'click', '[data-pagina]', function (e, el) {
      e.preventDefault();
      if (el.disabled) return;
      var n = parseInt(el.getAttribute('data-pagina'), 10);
      if (!isFinite(n) || n < 1) return;
      st.pag = n;
      repintar();
      try { rootVista.scrollTop = 0; } catch (err) { /* sin consecuencias */ }
    });

    /* --- Acciones de encabezado --- */
    U.delegar(root, 'click', '[data-accion]', function (e, el) {
      var accion = el.getAttribute('data-accion');

      if (accion === 'nuevo') {
        e.preventDefault();
        formulario(null);
        return;
      }
      if (accion === 'exportar') {
        e.preventDefault();
        exportarCSV(filtrarYOrdenar(filas, st));
        return;
      }
      if (accion === 'limpiar') {
        e.preventDefault();
        var vista = st.vista;
        var nuevo = estadoPorDefecto();
        nuevo.vista = vista;
        for (var k in nuevo) {
          if (Object.prototype.hasOwnProperty.call(nuevo, k)) st[k] = nuevo[k];
        }
        var controles = U.$$('[data-filtro]', root);
        for (var i = 0; i < controles.length; i++) {
          var clave = controles[i].getAttribute('data-filtro');
          controles[i].value = (clave === 'orden') ? 'nombre' : '';
        }
        repintar();
        U.toast('Filtros limpiados.', 'info');
        return;
      }

      /* Acciones sobre un socio concreto */
      var socio = socioDe(el);
      if (!socio) return;
      e.preventDefault();
      ejecutarAccion(accion, socio, usuario);
    });

    /* --- Abrir la ficha al hacer clic en la fila o la tarjeta --- */
    U.delegar(root, 'click', 'tbody tr[data-id]', function (e, el) {
      if (e.target && e.target.closest && e.target.closest('button, a')) return;
      var socio = DB.usuario(el.getAttribute('data-id'));
      if (socio) irAFicha(usuario, socio.id);
    });

    sincronizarURL(path, st);
  }

  /* =============================================================
     11. Ficha 360 — bloques por pestaña
     ============================================================= */

  function medicionesOrdenadas(socioId) {
    return DB.medicionesDe(socioId);
  }

  function ultimaMedicion(socioId) {
    var lista = medicionesOrdenadas(socioId);
    return lista.length ? lista[lista.length - 1] : null;
  }

  function avisosDe(socio) {
    if (hayModulo('Avisos', 'paraUsuario')) {
      try {
        var r = AG.Mod.Avisos.paraUsuario(socio);
        if (r && typeof r.length === 'number') return r.slice(0, 3);
      } catch (e) { /* se usa el respaldo */ }
    }
    var lista = DB.donde('avisos', function (a) {
      return a && (a.para === 'todos' || a.para === 'socios');
    });
    return U.ordenar(lista, 'fecha', 'desc').slice(0, 3);
  }

  function tabResumen(socio) {
    var mediciones = medicionesOrdenadas(socio.id);
    var ultima = mediciones.length ? mediciones[mediciones.length - 1] : null;
    var asistencias = DB.asistenciasDe(socio.id);
    var mes = U.mesActual();

    var asistenciasMes = 0;
    for (var i = 0; i < asistencias.length; i++) {
      if (U.mesDe(asistencias[i].fecha) === mes) asistenciasMes++;
    }

    var ad = adherenciaDe(socio);
    var racha = C.rachaDias(asistencias);
    var peso = ultima ? ultima.pesoKg : null;
    var grasa = ultima ? ultima.grasaPct : null;
    var imc = ultima ? (ultima.imc || C.imc(ultima.pesoKg, ultima.estaturaCm || socio.estaturaCm)) : null;
    var clasIMC = C.clasificacionIMC(imc);

    var kpis = [
      { val: peso !== null && peso !== undefined ? U.num(peso, 1) + ' kg' : '—', label: 'Peso actual', icono: 'balanza', clase: '' },
      { val: grasa !== null && grasa !== undefined ? U.pct(grasa, 1) : '—', label: 'Grasa corporal', icono: 'gota', clase: 'kpi-info' },
      { val: imc ? U.num(imc, 1) : '—', label: 'IMC · ' + clasIMC.texto, icono: 'corazon', clase: '' },
      { val: U.pct(ad.pct, 0), label: 'Adherencia del mes', icono: 'meta', clase: ad.pct >= 80 ? 'kpi-ok' : (ad.pct >= 50 ? 'kpi-warn' : 'kpi-error') },
      { val: U.num(asistenciasMes, 0), label: 'Asistencias del mes', icono: 'calendario', clase: 'kpi-info' },
      { val: U.num(racha, 0) + (racha === 1 ? ' día' : ' días'), label: 'Racha actual', icono: 'fuego', clase: racha > 0 ? 'kpi-ok' : '' }
    ];

    var html = '<div class="grid g3">';
    for (var k = 0; k < kpis.length; k++) {
      html += '<div class="kpi ' + esc(kpis[k].clase) + '">' +
        '<div class="kpi-icono">' + ico(kpis[k].icono, 22) + '</div>' +
        '<div class="kpi-datos">' +
          '<span class="kpi-val">' + esc(kpis[k].val) + '</span>' +
          '<span class="kpi-label">' + esc(kpis[k].label) + '</span>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';

    /* --- Evolución del peso --- */
    var puntos = [];
    for (var m = 0; m < mediciones.length; m++) {
      var pk = Number(mediciones[m].pesoKg);
      if (isFinite(pk) && pk > 0) puntos.push({ x: mediciones[m].fecha, etiqueta: U.fecha(mediciones[m].fecha, 'diaMes'), y: pk });
    }

    var progreso = C.progresoObjetivo(socio, mediciones);

    html += '<div class="grid g2 mt">' +
      '<div class="card">' +
        '<div class="card-head"><h3 class="card-title">Evolución del peso</h3>' +
          '<span class="mini muted">' + esc(puntos.length + (puntos.length === 1 ? ' medición' : ' mediciones')) + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          (puntos.length >= 2
            ? Charts.linea(puntos, { alto: 220, sufijo: ' kg', suave: true, etiquetaY: 'kg' })
            : vacio('Necesitamos al menos dos mediciones para trazar la evolución.', 'grafica')) +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><h3 class="card-title">Avance hacia el objetivo</h3></div>' +
        '<div class="card-body stack-sm">' +
          Charts.progreso(progreso.pct, { alto: 150, etiqueta: etiquetaObjetivo(socio.objetivo) }) +
          '<p class="mini muted txt-centro">' + esc(progreso.texto) + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';

    /* --- Próximo pago y avisos --- */
    var plan = socio.planId ? DB.plan(socio.planId) : null;
    var em = C.estadoMembresia(socio);
    var avisos = avisosDe(socio);

    var htmlAvisos = '';
    if (avisos.length) {
      htmlAvisos = '<div class="list">';
      for (var a = 0; a < avisos.length; a++) {
        var av = avisos[a];
        htmlAvisos += '<div class="list-item">' +
          '<span class="muted">' + ico(av.prioridad === 'alta' ? 'alerta' : 'campana', 18) + '</span>' +
          '<div class="list-item-main">' +
            '<b>' + esc(av.titulo || 'Aviso') + '</b>' +
            '<span class="mini muted">' + esc(U.truncar(av.cuerpo || '', 110)) + '</span>' +
          '</div>' +
          '<div class="list-item-side mini muted">' + esc(U.fechaRelativa(av.fecha)) + '</div>' +
        '</div>';
      }
      htmlAvisos += '</div>';
    } else {
      htmlAvisos = vacio('No hay avisos vigentes para los socios.', 'campana');
    }

    html += '<div class="grid g3 mt">' +
      '<div class="card">' +
        '<div class="card-head"><h3 class="card-title">Próximo pago</h3></div>' +
        '<div class="card-body stack-sm">' +
          '<div class="datos-grid">' +
            dato('Plan', esc(plan ? plan.nombre : 'Sin plan')) +
            dato('Importe', esc(plan ? U.dinero(plan.precio) : '—')) +
            dato('Vence', esc(socio.fechaVencimiento ? U.fecha(socio.fechaVencimiento, 'corto') : 'Sin fecha')) +
          '</div>' +
          '<span class="badge ' + esc(em.clase) + '">' + esc(em.texto) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card span2">' +
        '<div class="card-head"><h3 class="card-title">Avisos del gimnasio</h3></div>' +
        '<div class="card-body">' + htmlAvisos + '</div>' +
      '</div>' +
    '</div>';

    /* --- Notas del coach --- */
    html += '<div class="card mt">' +
      '<div class="card-head"><h3 class="card-title">Notas del coach</h3>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-accion="editar" data-id="' + esc(socio.id) + '">' +
          ico('editar', 15) + ' Editar</button>' +
      '</div>' +
      '<div class="card-body">' +
        (socio.notas
          ? '<p>' + esc(socio.notas) + '</p>'
          : '<p class="muted">Sin notas registradas para este socio.</p>') +
        (socio.padecimientos || socio.alergias
          ? '<div class="datos-grid mt">' +
              dato('Padecimientos', esc(socio.padecimientos || 'Ninguno registrado')) +
              dato('Alergias', esc(socio.alergias || 'Ninguna registrada')) +
            '</div>'
          : '') +
      '</div>' +
    '</div>';

    return html;
  }

  function tabMediciones(socio) {
    var html = '';
    var hayComparativo = hayModulo('Mediciones', 'comparativo');
    var hayHistorial = hayModulo('Mediciones', 'historial');

    if (hayComparativo) {
      try {
        html += '<div class="mb">' + AG.Mod.Mediciones.comparativo(socio.id, U.mesActual()) + '</div>';
      } catch (e) {
        html += '<div class="card mb"><div class="card-body">' +
          vacio('No pudimos preparar el comparativo del mes.', 'cinta') + '</div></div>';
      }
    }

    if (hayHistorial) {
      try {
        html += '<div>' + AG.Mod.Mediciones.historial(socio.id) + '</div>';
      } catch (e) {
        html += '<div class="card"><div class="card-body">' +
          vacio('No pudimos preparar el historial de mediciones.', 'historial') + '</div></div>';
      }
    }

    if (!hayComparativo && !hayHistorial) {
      /* Respaldo propio para que la ficha nunca quede vacía */
      var lista = medicionesOrdenadas(socio.id);
      if (!lista.length) {
        return '<div class="card"><div class="card-body">' +
          vacio('Este socio todavía no tiene mediciones registradas.', 'cinta',
            '<button type="button" class="btn btn-primary btn-sm" data-accion="medir" data-id="' + esc(socio.id) + '">' +
              ico('mas', 16) + ' Capturar medición</button>') +
        '</div></div>';
      }
      html = '<div class="card"><div class="card-head"><h3 class="card-title">Historial de mediciones</h3></div>' +
        '<div class="table-wrap"><table class="table table-compacta"><thead><tr>' +
          '<th>Fecha</th><th>Periodo</th><th>Tipo</th><th>Peso</th><th>Grasa</th><th>Músculo</th><th>Cintura</th>' +
        '</tr></thead><tbody>';
      for (var i = lista.length - 1; i >= 0; i--) {
        var m = lista[i];
        var med = m.medidas || {};
        html += '<tr>' +
          '<td class="nowrap">' + esc(U.fecha(m.fecha, 'corto')) + '</td>' +
          '<td class="nowrap">' + esc(m.periodo ? U.nombreMes(m.periodo) : '—') + '</td>' +
          '<td>' + esc(m.tipo === 'inicial' ? 'Inicial' : 'Cierre') + '</td>' +
          '<td class="nums">' + esc(m.pesoKg ? U.num(m.pesoKg, 1) + ' kg' : '—') + '</td>' +
          '<td class="nums">' + esc(m.grasaPct ? U.pct(m.grasaPct, 1) : '—') + '</td>' +
          '<td class="nums">' + esc(m.musculoKg ? U.num(m.musculoKg, 1) + ' kg' : '—') + '</td>' +
          '<td class="nums">' + esc(med.cintura ? U.num(med.cintura, 1) + ' cm' : '—') + '</td>' +
        '</tr>';
      }
      html += '</tbody></table></div></div>';
    }

    return html;
  }

  function tabEntrenamiento(socio) {
    var activa = DB.rutinaActivaDe(socio.id);
    var bitacoras = DB.bitacorasDe(socio.id).slice(0, 6);
    var ad = adherenciaDe(socio);

    var html = '<div class="card mb">' +
      '<div class="card-head">' +
        '<h3 class="card-title">Rutina activa</h3>' +
        '<button type="button" class="btn btn-outline btn-sm" data-accion="rutina" data-id="' + esc(socio.id) + '">' +
          ico('pesa', 15) + ' ' + (activa ? 'Cambiar rutina' : 'Asignar rutina') + '</button>' +
      '</div>' +
      '<div class="card-body">';

    if (!activa) {
      html += vacio('Este socio no tiene una rutina asignada. Asígnale una para empezar a medir su adherencia.', 'pesa');
    } else {
      var r = activa.rutina;
      var dias = (r.dias && r.dias.length) ? r.dias : [];
      html += '<div class="datos-grid mb">' +
        dato('Rutina', esc(r.nombre || 'Sin nombre')) +
        dato('Objetivo', esc(etiquetaObjetivo(r.objetivo))) +
        dato('Nivel', esc(etiquetaNivel(r.nivel))) +
        dato('Días por semana', esc(U.num(r.diasPorSemana || dias.length, 0))) +
        dato('Desde', esc(activa.asignacion.fechaInicio ? U.fecha(activa.asignacion.fechaInicio, 'corto') : '—')) +
      '</div>';

      if (hayModulo('Rutinas', 'vistaDia') && dias.length) {
        try {
          html += AG.Mod.Rutinas.vistaDia(r, 0, { soloLectura: true });
        } catch (e) {
          html += resumenDiasHTML(dias);
        }
      } else if (dias.length) {
        html += resumenDiasHTML(dias);
      } else {
        html += vacio('La rutina asignada todavía no tiene días cargados.', 'pesa');
      }
    }
    html += '</div></div>';

    /* Adherencia */
    html += '<div class="card mb"><div class="card-head"><h3 class="card-title">Adherencia del mes</h3>' +
      '<span class="badge ' + esc(ad.clase) + '">' + esc(U.pct(ad.pct, 0)) + '</span></div>' +
      '<div class="card-body">' +
        '<div class="bar bar-gruesa"><span class="bar-fill" style="width:' + Math.max(0, Math.min(100, ad.pct)) + '%"></span></div>' +
        '<p class="mini muted mt-sm">' + esc(ad.hechas + ' sesiones registradas de ' + ad.esperadas +
          ' previstas en ' + U.nombreMes(U.mesActual()) + '.') + '</p>' +
      '</div></div>';

    /* Últimas bitácoras */
    html += '<div class="card"><div class="card-head"><h3 class="card-title">Últimos entrenamientos</h3></div>';
    if (!bitacoras.length) {
      html += '<div class="card-body">' + vacio('Aún no hay entrenamientos registrados por el socio.', 'historial') + '</div>';
    } else {
      html += '<div class="list">';
      for (var i = 0; i < bitacoras.length; i++) {
        var b = bitacoras[i];
        var volumen = C.volumenEntrenamiento(b);
        html += '<div class="list-item">' +
          '<span class="muted">' + ico(b.completada === false ? 'reloj' : 'check', 18) + '</span>' +
          '<div class="list-item-main">' +
            '<b>' + esc(U.fecha(b.fecha, 'corto')) + '</b>' +
            '<span class="mini muted">' +
              esc((b.duracionMin ? b.duracionMin + ' min · ' : '') +
                  (b.esfuerzo ? 'esfuerzo ' + b.esfuerzo + '/10 · ' : '') +
                  U.num(volumen, 0) + ' kg de volumen') +
            '</span>' +
          '</div>' +
          '<div class="list-item-side mini muted">' + esc(U.fechaRelativa(b.fecha)) + '</div>' +
        '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    return html;
  }

  function resumenDiasHTML(dias) {
    var html = '<div class="list list-plana">';
    for (var i = 0; i < dias.length; i++) {
      var d = dias[i] || {};
      var cuantos = (d.ejercicios && d.ejercicios.length) ? d.ejercicios.length : 0;
      html += '<div class="list-item">' +
        '<span class="muted">' + ico('mancuerna', 18) + '</span>' +
        '<div class="list-item-main">' +
          '<b>' + esc(d.nombre || ('Día ' + (i + 1))) + '</b>' +
          '<span class="mini muted">' + esc(d.enfoque || 'Sin enfoque definido') + '</span>' +
        '</div>' +
        '<div class="list-item-side mini muted">' + esc(cuantos + (cuantos === 1 ? ' ejercicio' : ' ejercicios')) + '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function tabNutricion(socio) {
    var plan = DB.planNutricionDe(socio.id);

    if (plan && hayModulo('Nutricion', 'planHTML')) {
      try {
        return '<div class="card"><div class="card-head">' +
            '<h3 class="card-title">Plan de nutrición activo</h3>' +
            '<button type="button" class="btn btn-outline btn-sm" data-accion="nutricion" data-id="' + esc(socio.id) + '">' +
              ico('editar', 15) + ' Editar plan</button>' +
          '</div><div class="card-body">' +
          AG.Mod.Nutricion.planHTML(plan, { socio: socio }) +
        '</div></div>';
      } catch (e) { /* se usa el respaldo de abajo */ }
    }

    if (plan) {
      var comidas = (plan.comidas && plan.comidas.length) ? plan.comidas : [];
      var html = '<div class="card"><div class="card-head">' +
          '<h3 class="card-title">Plan de nutrición activo</h3>' +
          '<button type="button" class="btn btn-outline btn-sm" data-accion="nutricion" data-id="' + esc(socio.id) + '">' +
            ico('editar', 15) + ' Editar plan</button>' +
        '</div><div class="card-body">' +
        '<div class="datos-grid mb">' +
          dato('Calorías', esc(U.num(plan.kcal, 0) + ' kcal')) +
          dato('Proteína', esc(U.num(plan.proteina, 0) + ' g')) +
          dato('Carbohidratos', esc(U.num(plan.carbos, 0) + ' g')) +
          dato('Grasa', esc(U.num(plan.grasa, 0) + ' g')) +
          dato('Agua', esc(U.num(plan.agua, 1) + ' L')) +
        '</div>';
      if (comidas.length) {
        html += '<div class="list list-plana">';
        for (var i = 0; i < comidas.length; i++) {
          var c = comidas[i] || {};
          var cuantos = (c.alimentos && c.alimentos.length) ? c.alimentos.length : 0;
          html += '<div class="list-item">' +
            '<span class="muted">' + ico('manzana', 18) + '</span>' +
            '<div class="list-item-main"><b>' + esc(c.nombre || 'Comida') + '</b>' +
              '<span class="mini muted">' + esc((c.hora || '') + ' · ' + cuantos +
                (cuantos === 1 ? ' alimento' : ' alimentos')) + '</span></div>' +
          '</div>';
        }
        html += '</div>';
      }
      html += '</div></div>';
      return html;
    }

    return '<div class="card"><div class="card-body">' +
      vacio('Este socio todavía no tiene un plan de nutrición activo.', 'nutricion',
        '<button type="button" class="btn btn-primary btn-sm" data-accion="nutricion" data-id="' + esc(socio.id) + '">' +
          ico('mas', 16) + ' Crear plan</button>') +
    '</div></div>';
  }

  function tabPagos(socio, usuario) {
    var pagos = DB.pagosDe(socio.id);
    var total = U.suma(pagos, function (p) {
      return (p.estado && p.estado !== 'pagado') ? 0 : Number(p.monto) || 0;
    });

    var html = '<div class="card">' +
      '<div class="card-head">' +
        '<h3 class="card-title">Pagos registrados</h3>' +
        '<div class="row-sm">' +
          '<span class="badge badge-info">Total: ' + esc(U.dinero(total)) + '</span>' +
          (esDirector(usuario)
            ? '<button type="button" class="btn btn-primary btn-sm" data-accion="cobrar" data-id="' + esc(socio.id) + '">' +
                ico('dinero', 15) + ' Cobrar</button>'
            : '') +
        '</div>' +
      '</div>';

    if (!pagos.length) {
      html += '<div class="card-body">' +
        vacio('Este socio todavía no tiene pagos registrados.', 'dinero',
          esDirector(usuario)
            ? '<button type="button" class="btn btn-primary btn-sm" data-accion="cobrar" data-id="' + esc(socio.id) + '">' +
                ico('mas', 16) + ' Registrar primer pago</button>'
            : '') +
      '</div></div>';
      return html;
    }

    html += '<div class="table-wrap"><table class="table table-compacta"><thead><tr>' +
      '<th>Folio</th><th>Fecha</th><th>Concepto</th><th>Periodo</th><th>Método</th><th>Monto</th><th>Estado</th><th></th>' +
    '</tr></thead><tbody>';

    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      var claseEstado = p.estado === 'pagado' ? 'badge-ok' : (p.estado === 'pendiente' ? 'badge-warn' : 'badge-muted');
      html += '<tr>' +
        '<td class="mono nowrap">' + esc(p.folio || '—') + '</td>' +
        '<td class="nowrap">' + esc(U.fecha(p.fecha, 'corto')) + '</td>' +
        '<td>' + esc(U.capitalizar(p.concepto || 'mensualidad')) + '</td>' +
        '<td class="nowrap mini">' + esc(p.periodoInicio && p.periodoFin
            ? U.fecha(p.periodoInicio, 'diaMes') + ' → ' + U.fecha(p.periodoFin, 'diaMes')
            : '—') + '</td>' +
        '<td>' + esc(U.capitalizar(p.metodo || '—')) + '</td>' +
        '<td class="nums bold">' + esc(U.dinero(p.monto)) + '</td>' +
        '<td><span class="badge ' + claseEstado + '">' + esc(U.capitalizar(p.estado || 'pagado')) + '</span></td>' +
        '<td>' + botonIcono('recibo', p.id, 'imprimir', 'Imprimir recibo') + '</td>' +
      '</tr>';
    }
    html += '</tbody></table></div></div>';

    return html;
  }

  function tabAsistencia(socio) {
    var asistencias = DB.asistenciasDe(socio.id);
    var mes = U.mesActual();

    var dias = [];
    for (var i = 0; i < asistencias.length; i++) {
      var f = String(asistencias[i].fecha || '');
      if (U.mesDe(f) === mes) dias.push({ fecha: f, valor: 1 });
    }

    var html = '<div class="grid g2">' +
      '<div class="card">' +
        '<div class="card-head"><h3 class="card-title">' + esc(U.nombreMes(mes)) + '</h3>' +
          '<span class="mini muted">' + esc(dias.length + (dias.length === 1 ? ' visita' : ' visitas')) + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          Charts.calendario(dias, {
            periodo: mes,
            mostrarVacio: true,
            etiquetaValor: 'visita',
            vacio: 'Sin visitas registradas este mes.'
          }) +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><h3 class="card-title">Últimas entradas</h3>' +
          '<span class="badge badge-info">Racha: ' + esc(U.num(C.rachaDias(asistencias), 0)) + '</span>' +
        '</div>';

    if (!asistencias.length) {
      html += '<div class="card-body">' + vacio('Este socio todavía no tiene asistencias registradas.', 'calendario') + '</div>';
    } else {
      html += '<div class="list">';
      var tope = Math.min(12, asistencias.length);
      for (var j = 0; j < tope; j++) {
        var a = asistencias[j];
        html += '<div class="list-item">' +
          '<span class="muted">' + ico('reloj', 18) + '</span>' +
          '<div class="list-item-main">' +
            '<b>' + esc(U.fecha(a.fecha, 'corto')) + '</b>' +
            '<span class="mini muted">' + esc('Entrada ' + (a.entrada || '—') +
              (a.salida ? ' · Salida ' + a.salida : '')) + '</span>' +
          '</div>' +
          '<div class="list-item-side mini muted">' + esc(U.fechaRelativa(a.fecha)) + '</div>' +
        '</div>';
      }
      html += '</div>';
    }
    html += '</div></div>';

    return html;
  }

  function contenidoTab(socio, tab, usuario) {
    try {
      switch (tab) {
        case 'mediciones': return tabMediciones(socio);
        case 'entrenamiento': return tabEntrenamiento(socio);
        case 'nutricion': return tabNutricion(socio);
        case 'pagos': return tabPagos(socio, usuario);
        case 'asistencia': return tabAsistencia(socio);
        default: return tabResumen(socio);
      }
    } catch (e) {
      return '<div class="card"><div class="card-body">' +
        vacio('No pudimos preparar esta sección del expediente.', 'alerta') + '</div></div>';
    }
  }

  /* =============================================================
     12. Ficha 360 — render de la ruta
     ============================================================= */

  function encabezadoFichaHTML(socio, usuario) {
    var em = C.estadoMembresia(socio);
    var pagos = DB.pagosDe(socio.id);
    var meses = C.mesesDeMembresia(socio, pagos);
    var coach = socio.coachId ? DB.usuario(socio.coachId) : null;
    var plan = socio.planId ? DB.plan(socio.planId) : null;

    var acciones = '';
    if (esDirector(usuario)) {
      acciones += '<button type="button" class="btn btn-primary btn-sm" data-accion="cobrar" data-id="' + esc(socio.id) + '">' +
        ico('dinero', 15) + ' Cobrar</button>';
    }
    acciones += '<button type="button" class="btn btn-outline btn-sm" data-accion="medir" data-id="' + esc(socio.id) + '">' +
      ico('cinta', 15) + ' Medir</button>';
    acciones += '<button type="button" class="btn btn-outline btn-sm" data-accion="rutina" data-id="' + esc(socio.id) + '">' +
      ico('pesa', 15) + ' Rutina</button>';
    acciones += '<button type="button" class="btn btn-outline btn-sm" data-accion="nutricion" data-id="' + esc(socio.id) + '">' +
      ico('nutricion', 15) + ' Nutrición</button>';
    acciones += '<button type="button" class="btn btn-outline btn-sm" data-accion="whatsapp" data-id="' + esc(socio.id) + '">' +
      ico('whatsapp', 15) + ' WhatsApp</button>';
    acciones += '<button type="button" class="btn btn-ghost btn-sm" data-accion="editar" data-id="' + esc(socio.id) + '">' +
      ico('editar', 15) + ' Editar</button>';
    acciones += '<button type="button" class="btn btn-ghost btn-sm" data-accion="imprimir" data-id="' + esc(socio.id) + '">' +
      ico('imprimir', 15) + ' Expediente</button>';
    acciones += '<button type="button" class="btn btn-ghost btn-sm" data-accion="menu" data-id="' + esc(socio.id) + '">' +
      ico('menu', 15) + ' Más</button>';

    return '<div class="card card-rojo">' +
      '<div class="card-body">' +
        '<div class="row between wrap" style="gap:16px">' +
          '<div class="row wrap" style="gap:16px">' +
            U.avatar(socio, 'xl') +
            '<div class="stack-sm">' +
              '<div>' +
                '<h1 class="page-title">' + esc(U.nombreCompleto(socio)) + '</h1>' +
                '<p class="page-sub mono">' + esc(socio.codigo || 'Sin código') + ' · ' +
                  esc(socio.email || 'Sin correo') + '</p>' +
              '</div>' +
              '<div class="chips">' +
                '<span class="badge ' + esc(em.clase) + '">' + esc(em.texto) + '</span>' +
                '<span class="chip chip-sm">' + ico(iconoObjetivo(socio.objetivo), 14) +
                  esc(etiquetaObjetivo(socio.objetivo)) + '</span>' +
                '<span class="chip chip-sm">' + ico('trofeo', 14) + esc(etiquetaNivel(socio.nivel)) + '</span>' +
                '<span class="chip chip-sm">' + ico('tarjeta', 14) + esc(plan ? plan.nombre : 'Sin plan') + '</span>' +
              '</div>' +
              '<div class="datos-grid">' +
                dato('Antigüedad', esc(C.antiguedadTexto(socio.fechaAlta))) +
                dato('Meses pagados', esc(U.num(meses, 0))) +
                dato('Coach', esc(coach ? U.nombreCompleto(coach) : 'Sin coach asignado')) +
                dato('Teléfono', esc(socio.telefono || 'Sin teléfono')) +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="page-acciones no-imprimir">' + acciones + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function expedienteImprimibleHTML(socio) {
    var em = C.estadoMembresia(socio);
    var plan = socio.planId ? DB.plan(socio.planId) : null;
    var coach = socio.coachId ? DB.usuario(socio.coachId) : null;
    var pagos = DB.pagosDe(socio.id);
    var ultima = ultimaMedicion(socio.id);
    var ce = socio.contactoEmergencia || {};

    var html = '<h3>Expediente de ' + esc(U.nombreCompleto(socio)) + '</h3>' +
      '<div class="datos-grid">' +
        dato('Código', esc(socio.codigo || '—')) +
        dato('Correo', esc(socio.email || '—')) +
        dato('Teléfono', esc(socio.telefono || '—')) +
        dato('Nacimiento', esc(socio.fechaNacimiento ? U.fecha(socio.fechaNacimiento, 'corto') +
          ' (' + U.edad(socio.fechaNacimiento) + ' años)' : '—')) +
        dato('Sexo', esc(etiquetaSexo(socio.sexo))) +
        dato('Estatura', esc(socio.estaturaCm ? U.num(socio.estaturaCm, 0) + ' cm' : '—')) +
        dato('Objetivo', esc(etiquetaObjetivo(socio.objetivo))) +
        dato('Nivel', esc(etiquetaNivel(socio.nivel))) +
        dato('Actividad', esc(etiquetaActividad(socio.nivelActividad))) +
      '</div>' +
      '<h3>Membresía</h3>' +
      '<div class="datos-grid">' +
        dato('Plan', esc(plan ? plan.nombre + ' · ' + U.dinero(plan.precio) : 'Sin plan')) +
        dato('Coach', esc(coach ? U.nombreCompleto(coach) : 'Sin coach')) +
        dato('Alta', esc(socio.fechaAlta ? U.fecha(socio.fechaAlta, 'corto') : '—')) +
        dato('Vencimiento', esc(socio.fechaVencimiento ? U.fecha(socio.fechaVencimiento, 'corto') : '—')) +
        dato('Estado', esc(em.texto)) +
        dato('Meses pagados', esc(U.num(C.mesesDeMembresia(socio, pagos), 0))) +
      '</div>' +
      '<h3>Salud y emergencia</h3>' +
      '<div class="datos-grid">' +
        dato('Padecimientos', esc(socio.padecimientos || 'Ninguno registrado')) +
        dato('Alergias', esc(socio.alergias || 'Ninguna registrada')) +
        dato('Contacto', esc(ce.nombre || '—')) +
        dato('Teléfono de emergencia', esc(ce.telefono || '—')) +
        dato('Parentesco', esc(ce.parentesco || '—')) +
      '</div>';

    if (ultima) {
      var med = ultima.medidas || {};
      html += '<h3>Última medición · ' + esc(U.fecha(ultima.fecha, 'corto')) + '</h3>' +
        '<div class="datos-grid">' +
          dato('Peso', esc(ultima.pesoKg ? U.num(ultima.pesoKg, 1) + ' kg' : '—')) +
          dato('Grasa', esc(ultima.grasaPct ? U.pct(ultima.grasaPct, 1) : '—')) +
          dato('Músculo', esc(ultima.musculoKg ? U.num(ultima.musculoKg, 1) + ' kg' : '—')) +
          dato('IMC', esc(ultima.imc ? U.num(ultima.imc, 1) : '—')) +
          dato('Cintura', esc(med.cintura ? U.num(med.cintura, 1) + ' cm' : '—')) +
          dato('Cadera', esc(med.cadera ? U.num(med.cadera, 1) + ' cm' : '—')) +
        '</div>';
    }

    if (socio.notas) {
      html += '<h3>Notas</h3><p>' + esc(socio.notas) + '</p>';
    }

    html += '<p class="mini muted">Expediente generado el ' + esc(U.fecha(U.hoy(), 'largo')) + '.</p>';
    return html;
  }

  function renderFicha(ctx) {
    var usuario = ctx.usuario;
    var id = ctx.params ? ctx.params.id : '';
    var volver = rutaLista(usuario);

    function pagina(contenido) {
      return '<div class="page" id="ag-ficha-page">' +
        '<div class="page-head">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-accion="volver">' +
            ico('flecha-izq', 16) + ' Volver a la lista</button>' +
        '</div>' + contenido +
      '</div>';
    }

    function conEventos(html) {
      return {
        html: html,
        listo: function (rootVista) {
          var root = rootVista.querySelector('#ag-ficha-page');
          if (!root) return;
          U.delegar(root, 'click', '[data-accion="volver"]', function (e) {
            e.preventDefault();
            AG.Router.ir(volver);
          });
        }
      };
    }

    if (!id) {
      return conEventos(pagina('<div class="card"><div class="card-body">' +
        vacio('Elige un socio de la lista para ver su expediente.', 'socios') + '</div></div>'));
    }

    var socio = DB.usuario(id);
    if (!socio || socio.rol !== 'socio') {
      return conEventos(pagina('<div class="card"><div class="card-body">' +
        vacio('No encontramos ese expediente. Es posible que el socio se haya eliminado.', 'buscar') +
        '</div></div>'));
    }

    if (!puedeVer(usuario, id)) {
      return conEventos(pagina('<div class="card"><div class="card-body">' +
        '<div class="empty">' +
          '<div class="empty-icono">' + ico('candado', 34) + '</div>' +
          '<h2 class="page-title">Sin acceso a este expediente</h2>' +
          '<p class="empty-texto">Este socio no está asignado a ti. Si necesitas consultarlo, pídelo a dirección.</p>' +
        '</div>' +
      '</div></div>'));
    }

    var tab = (ctx.params && ctx.params.tab) ? String(ctx.params.tab) : tabActual;
    var valido = false;
    for (var t = 0; t < TABS.length; t++) if (TABS[t].v === tab) valido = true;
    if (!valido) tab = 'resumen';
    tabActual = tab;

    var htmlTabs = '<div class="tabs" role="tablist">';
    for (var i = 0; i < TABS.length; i++) {
      htmlTabs += '<button type="button" class="tab' + (TABS[i].v === tab ? ' active' : '') + '"' +
        ' data-tab="' + esc(TABS[i].v) + '" role="tab" aria-selected="' + (TABS[i].v === tab ? 'true' : 'false') + '">' +
        ico(TABS[i].icono, 16) + '<span>' + esc(TABS[i].t) + '</span></button>';
    }
    htmlTabs += '</div>';

    var contenido = encabezadoFichaHTML(socio, usuario) +
      '<div class="card"><div class="card-body">' + htmlTabs + '</div></div>' +
      '<div id="ag-ficha-cuerpo">' + contenidoTab(socio, tab, usuario) + '</div>';

    return {
      html: pagina(contenido),
      listo: function (rootVista) {
        var root = rootVista.querySelector('#ag-ficha-page');
        if (!root) return;
        var cuerpo = root.querySelector('#ag-ficha-cuerpo');

        U.delegar(root, 'click', '[data-tab]', function (e, el) {
          e.preventDefault();
          var destino = el.getAttribute('data-tab');
          if (!destino || destino === tabActual) return;
          tabActual = destino;

          var botones = U.$$('[data-tab]', root);
          for (var b = 0; b < botones.length; b++) {
            var activo = botones[b].getAttribute('data-tab') === destino;
            botones[b].classList.toggle('active', activo);
            botones[b].setAttribute('aria-selected', activo ? 'true' : 'false');
          }

          var actual = DB.usuario(socio.id) || socio;
          if (cuerpo) cuerpo.innerHTML = contenidoTab(actual, destino, usuario);

          try {
            if (window.history && typeof window.history.replaceState === 'function') {
              window.history.replaceState(null, '', '#/' + ctx.path +
                '?id=' + encodeURIComponent(socio.id) + '&tab=' + encodeURIComponent(destino));
            }
          } catch (err) { /* file:// puede bloquearlo */ }
        });

        U.delegar(root, 'click', '[data-accion]', function (e, el) {
          var accion = el.getAttribute('data-accion');
          e.preventDefault();

          if (accion === 'volver') { AG.Router.ir(volver); return; }

          if (accion === 'imprimir') {
            var actual = DB.usuario(socio.id) || socio;
            U.imprimir(expedienteImprimibleHTML(actual), 'Expediente · ' + U.nombreCompleto(actual));
            return;
          }

          if (accion === 'recibo') {
            var pagoId = el.getAttribute('data-id');
            llamarModulo('Pagos', 'recibo', [pagoId], 'El módulo de pagos todavía no está disponible.');
            return;
          }

          var objetivo = DB.usuario(el.getAttribute('data-id') || socio.id);
          if (!objetivo) return;
          if (accion === 'ver') return;                   /* ya estamos en la ficha */
          ejecutarAccion(accion, objetivo, usuario);
        });
      }
    };
  }

  /* =============================================================
     13. Exposición y registro de rutas
     ============================================================= */

  AG.Mod.Socios = {
    render: renderLista,
    renderFicha: renderFicha,
    formulario: formulario,
    tarjeta: tarjeta,
    selector: selector,
    adherenciaDe: adherenciaDe,
    etiquetaObjetivo: etiquetaObjetivo,
    etiquetaNivel: etiquetaNivel,
    etiquetaEstado: etiquetaEstado,
    OBJETIVOS: OBJETIVOS,
    NIVELES: NIVELES
  };

  AG.Router.registrar({
    path: 'director/socios',
    roles: ['director'],
    titulo: 'Socios',
    nav: { etiqueta: 'Socios', icono: 'socios', grupo: 'Operación', orden: 1 },
    render: renderLista
  });

  AG.Router.registrar({
    path: 'coach/socios',
    roles: ['coach'],
    titulo: 'Mis socios',
    nav: { etiqueta: 'Mis socios', icono: 'socios', grupo: 'Entrenamiento', orden: 1 },
    render: renderLista
  });

  AG.Router.registrar({
    path: 'director/socio',
    roles: ['director'],
    titulo: 'Expediente del socio',
    nav: null,
    render: renderFicha
  });

  AG.Router.registrar({
    path: 'coach/socio',
    roles: ['coach'],
    titulo: 'Expediente del socio',
    nav: null,
    render: renderFicha
  });

})(window.AG);
