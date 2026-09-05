/* =============================================================
   ALLIANCE GYM — Sesión y permisos (AG.Auth)
   Único archivo, junto con db.js, autorizado a tocar localStorage.
   Guarda la sesión en 'alliance_gym_sesion' como { usuarioId, entradaEn }.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  /* ---------- Constantes ---------- */
  var LLAVE_SESION = 'alliance_gym_sesion';
  var DIAS_SESION = 12;                 // la sesión caduca a los 12 días
  var MIN_PASSWORD = 5;                 // longitud mínima de una contraseña nueva
  var MS_POR_DIA = 24 * 60 * 60 * 1000;

  /* ---------- Estado interno ---------- */
  var sesionActual = null;              // { usuarioId, entradaEn } o null
  var oyentes = { login: [], logout: [] };

  /* =============================================================
     Utilidades internas
     ============================================================= */

  /* Acceso tolerante a localStorage: en algunos navegadores bajo file://
     o en modo privado el acceso lanza excepción. Nunca debe romper la app. */
  function leerCrudo() {
    try {
      return window.localStorage.getItem(LLAVE_SESION);
    } catch (e) {
      return null;
    }
  }

  function escribirCrudo(texto) {
    try {
      window.localStorage.setItem(LLAVE_SESION, texto);
      return true;
    } catch (e) {
      return false;
    }
  }

  function borrarCrudo() {
    try {
      window.localStorage.removeItem(LLAVE_SESION);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Lee y valida la forma de la sesión guardada. */
  function leerSesionGuardada() {
    var crudo = leerCrudo();
    if (!crudo) return null;
    var datos;
    try {
      datos = JSON.parse(crudo);
    } catch (e) {
      borrarCrudo();
      return null;
    }
    if (!datos || typeof datos !== 'object') { borrarCrudo(); return null; }
    if (!datos.usuarioId || typeof datos.usuarioId !== 'string') { borrarCrudo(); return null; }
    return {
      usuarioId: datos.usuarioId,
      entradaEn: typeof datos.entradaEn === 'string' ? datos.entradaEn : ''
    };
  }

  function guardarSesion(usuarioId) {
    var sesion = { usuarioId: usuarioId, entradaEn: ahoraISO() };
    escribirCrudo(JSON.stringify(sesion));
    sesionActual = sesion;
    return sesion;
  }

  function ahoraISO() {
    if (AG.Utils && typeof AG.Utils.ahora === 'function') {
      try { return AG.Utils.ahora(); } catch (e) { /* se usa el respaldo */ }
    }
    return new Date().toISOString();
  }

  /* ¿La sesión rebasó los días de vigencia? */
  function estaCaducada(sesion) {
    if (!sesion || !sesion.entradaEn) return true;
    var inicio = new Date(sesion.entradaEn).getTime();
    if (isNaN(inicio)) return true;
    var transcurridos = (Date.now() - inicio) / MS_POR_DIA;
    // Una fecha en el futuro (reloj movido) también se considera inválida.
    if (transcurridos < -1) return true;
    return transcurridos >= DIAS_SESION;
  }

  /* Busca el usuario vivo en la base. Siempre devuelve la referencia real. */
  function usuarioPorId(id) {
    if (!id || !AG.DB) return null;
    if (typeof AG.DB.usuario === 'function') {
      try {
        var u = AG.DB.usuario(id);
        if (u) return u;
      } catch (e) { /* se intenta con el respaldo de abajo */ }
    }
    var lista = coleccionUsuarios();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].id === id) return lista[i];
    }
    return null;
  }

  function coleccionUsuarios() {
    if (!AG.DB) return [];
    if (typeof AG.DB.get === 'function') {
      try {
        var lista = AG.DB.get('usuarios');
        if (Object.prototype.toString.call(lista) === '[object Array]') return lista;
      } catch (e) { /* se intenta con el estado directo */ }
    }
    if (AG.DB.state && Object.prototype.toString.call(AG.DB.state.usuarios) === '[object Array]') {
      return AG.DB.state.usuarios;
    }
    return [];
  }

  function normalizarCorreo(valor) {
    return String(valor === null || valor === undefined ? '' : valor).trim().toLowerCase();
  }

  /* Emite un evento a los oyentes registrados sin dejar que uno roto tumbe al resto. */
  function emitir(evento, datos) {
    var lista = oyentes[evento];
    if (!lista || !lista.length) return;
    for (var i = 0; i < lista.length; i++) {
      try {
        lista[i](datos);
      } catch (e) { /* un oyente con error no debe interrumpir la sesión */ }
    }
  }

  /* =============================================================
     API pública
     ============================================================= */
  var Auth = {};

  Auth.LLAVE_SESION = LLAVE_SESION;
  Auth.DIAS_SESION = DIAS_SESION;
  Auth.MIN_PASSWORD = MIN_PASSWORD;

  /**
   * Inicia sesión con correo y contraseña.
   * @returns {{ok:true, usuario:Object}|{ok:false, error:String}}
   */
  Auth.entrar = function (email, password) {
    var correo = normalizarCorreo(email);
    var clave = String(password === null || password === undefined ? '' : password);

    if (!correo || !clave) {
      return { ok: false, error: 'Escribe tu correo y tu contraseña' };
    }

    var usuarios = coleccionUsuarios();
    var encontrado = null;
    for (var i = 0; i < usuarios.length; i++) {
      var u = usuarios[i];
      if (!u || !u.email) continue;
      if (normalizarCorreo(u.email) === correo) { encontrado = u; break; }
    }

    if (!encontrado) {
      return { ok: false, error: 'No encontramos esa cuenta' };
    }

    var guardada = String(encontrado.password === null || encontrado.password === undefined ? '' : encontrado.password);
    if (guardada !== clave) {
      return { ok: false, error: 'Contraseña incorrecta' };
    }

    if (encontrado.activo === false) {
      return { ok: false, error: 'Tu cuenta está desactivada, contacta a dirección' };
    }

    guardarSesion(encontrado.id);
    emitir('login', encontrado);
    return { ok: true, usuario: encontrado };
  };

  /** Cierra la sesión y avisa a los oyentes de 'logout'. */
  Auth.salir = function () {
    var anterior = Auth.actual();
    sesionActual = null;
    borrarCrudo();
    emitir('logout', anterior);
  };

  /**
   * Usuario de la sesión activa. Devuelve SIEMPRE el objeto vivo de la base,
   * nunca una copia: si otro módulo edita al usuario, aquí se ve el cambio.
   * @returns {Object|null}
   */
  Auth.actual = function () {
    if (!sesionActual) {
      sesionActual = leerSesionGuardada();
      if (!sesionActual) return null;
    }
    if (estaCaducada(sesionActual)) {
      sesionActual = null;
      borrarCrudo();
      return null;
    }
    var usuario = usuarioPorId(sesionActual.usuarioId);
    if (!usuario || usuario.activo === false) {
      sesionActual = null;
      borrarCrudo();
      return null;
    }
    return usuario;
  };

  /** Copia de solo lectura de la sesión guardada (para diagnóstico o vistas). */
  Auth.sesion = function () {
    var s = sesionActual || leerSesionGuardada();
    if (!s) return null;
    return { usuarioId: s.usuarioId, entradaEn: s.entradaEn };
  };

  /** Días que le quedan de vigencia a la sesión actual (0 si no hay). */
  Auth.diasRestantes = function () {
    var s = sesionActual || leerSesionGuardada();
    if (!s || !s.entradaEn) return 0;
    var inicio = new Date(s.entradaEn).getTime();
    if (isNaN(inicio)) return 0;
    var restan = DIAS_SESION - ((Date.now() - inicio) / MS_POR_DIA);
    return restan > 0 ? Math.ceil(restan) : 0;
  };

  /** ¿El usuario de la sesión tiene exactamente este rol? */
  Auth.es = function (rol) {
    var u = Auth.actual();
    return !!(u && u.rol === rol);
  };

  /** ¿El usuario de la sesión tiene alguno de estos roles? */
  Auth.esAlguno = function (roles) {
    var u = Auth.actual();
    if (!u) return false;
    if (typeof roles === 'string') return u.rol === roles;
    if (Object.prototype.toString.call(roles) !== '[object Array]') return false;
    for (var i = 0; i < roles.length; i++) {
      if (roles[i] === u.rol) return true;
    }
    return false;
  };

  /**
   * Recupera la sesión guardada al arrancar la app.
   * Limpia la sesión si caducó, si el usuario ya no existe o está desactivado.
   * @returns {Object|null} usuario vivo o null
   */
  Auth.restaurarSesion = function () {
    sesionActual = leerSesionGuardada();
    if (!sesionActual) return null;

    if (estaCaducada(sesionActual)) {
      sesionActual = null;
      borrarCrudo();
      return null;
    }

    var usuario = usuarioPorId(sesionActual.usuarioId);
    if (!usuario || usuario.activo === false) {
      sesionActual = null;
      borrarCrudo();
      return null;
    }
    return usuario;
  };

  /**
   * Cambia la contraseña del usuario de la sesión.
   * @returns {{ok:true}|{ok:false, error:String}}
   */
  Auth.cambiarPassword = function (actual, nueva) {
    var usuario = Auth.actual();
    if (!usuario) {
      return { ok: false, error: 'No hay una sesión activa' };
    }

    var vieja = String(actual === null || actual === undefined ? '' : actual);
    var nuevaClave = String(nueva === null || nueva === undefined ? '' : nueva);
    var guardada = String(usuario.password === null || usuario.password === undefined ? '' : usuario.password);

    if (vieja !== guardada) {
      return { ok: false, error: 'Tu contraseña actual no es correcta' };
    }
    if (nuevaClave.length < MIN_PASSWORD) {
      return { ok: false, error: 'La nueva contraseña debe tener al menos ' + MIN_PASSWORD + ' caracteres' };
    }
    if (nuevaClave === guardada) {
      return { ok: false, error: 'La nueva contraseña debe ser distinta a la actual' };
    }

    if (AG.DB && typeof AG.DB.actualizar === 'function') {
      try {
        AG.DB.actualizar('usuarios', usuario.id, { password: nuevaClave });
      } catch (e) {
        usuario.password = nuevaClave;
        if (AG.DB && typeof AG.DB.guardar === 'function') {
          try { AG.DB.guardar(); } catch (e2) { /* la app sigue con el cambio en memoria */ }
        }
      }
    } else {
      usuario.password = nuevaClave;
    }

    return { ok: true };
  };

  /**
   * ¿Este usuario puede ver la ficha de este socio?
   * Director: siempre. Coach: solo sus socios. Socio: solo él mismo.
   * La usan los módulos para proteger fichas y detalles.
   */
  Auth.puedeVer = function (usuario, socioId) {
    if (!usuario || !socioId) return false;
    if (usuario.rol === 'director') return true;
    if (usuario.rol === 'socio') return usuario.id === socioId;
    if (usuario.rol === 'coach') {
      var socio = usuarioPorId(socioId);
      if (!socio) return false;
      return socio.coachId === usuario.id;
    }
    return false;
  };

  /**
   * Registra un oyente.
   * @param {'login'|'logout'} evento
   * @param {Function} fn
   * @returns {Function} función para dejar de escuchar
   */
  Auth.on = function (evento, fn) {
    if (typeof fn !== 'function') return function () {};
    if (!oyentes[evento]) oyentes[evento] = [];
    oyentes[evento].push(fn);
    return function () {
      var lista = oyentes[evento];
      if (!lista) return;
      var i = lista.indexOf(fn);
      if (i >= 0) lista.splice(i, 1);
    };
  };

  /** Quita un oyente registrado con on(). */
  Auth.off = function (evento, fn) {
    var lista = oyentes[evento];
    if (!lista) return;
    var i = lista.indexOf(fn);
    if (i >= 0) lista.splice(i, 1);
  };

  AG.Auth = Auth;
})(window.AG);
