/* =============================================================
   ALLIANCE GYM — Enrutador por hash (AG.Router)
   Registra rutas, resuelve '#/rol/seccion?a=1', pinta dentro de #vista,
   construye el menú lateral y protege por rol.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  /* ---------- Constantes ---------- */
  var ID_VISTA = 'vista';
  var ID_TITULO = 'topbar-titulo';

  /* Orden de los grupos del menú fijado por el contrato de arquitectura. */
  var ORDEN_GRUPOS = ['Principal', 'Mi entrenamiento', 'Mi cuenta', 'Operación', 'Entrenamiento', 'Negocio', 'Sistema'];

  /* Ruta inicial de cada rol. */
  var INICIOS = {
    director: 'director/inicio',
    coach: 'coach/inicio',
    socio: 'socio/inicio'
  };

  /* ---------- Estado interno ---------- */
  var rutas = [];                 // registro en orden de alta
  var porPath = {};               // índice path -> ruta
  var oyentes = { navego: [] };
  var iniciado = false;
  var pintando = 0;               // token para descartar renders asíncronos viejos
  var ultimaClave = '';           // evita repintar dos veces lo mismo
  var ctxActual = { path: '', params: {} };

  /* =============================================================
     Utilidades internas
     ============================================================= */

  function esArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function esc(texto) {
    if (AG.Utils && typeof AG.Utils.esc === 'function') {
      try { return AG.Utils.esc(texto); } catch (e) { /* se usa el respaldo */ }
    }
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icono(nombre, tamano) {
    if (AG.Icons && typeof AG.Icons.get === 'function') {
      try { return AG.Icons.get(nombre, tamano || 20); } catch (e) { /* se omite el icono */ }
    }
    return '';
  }

  /** Deja un path limpio: sin '#', sin '/' inicial ni final, sin query. */
  function limpiarPath(valor) {
    var p = String(valor === null || valor === undefined ? '' : valor).trim();
    if (p.charAt(0) === '#') p = p.slice(1);
    var corte = p.indexOf('?');
    if (corte >= 0) p = p.slice(0, corte);
    corte = p.indexOf('#');
    if (corte >= 0) p = p.slice(0, corte);
    p = p.replace(/^\/+/, '').replace(/\/+$/, '');
    return p;
  }

  /** Busca la ruta registrada; primero exacta, luego sin distinguir mayúsculas. */
  function buscarRuta(path) {
    if (!path) return null;
    if (porPath[path]) return porPath[path];
    var bajo = path.toLowerCase();
    for (var i = 0; i < rutas.length; i++) {
      if (rutas[i].path.toLowerCase() === bajo) return rutas[i];
    }
    return null;
  }

  /** Convierte 'a=1&b=hola%20mundo' en { a:'1', b:'hola mundo' }. */
  function parsearParams(cadena) {
    var params = {};
    if (!cadena) return params;
    var partes = String(cadena).split('&');
    for (var i = 0; i < partes.length; i++) {
      var trozo = partes[i];
      if (!trozo) continue;
      var igual = trozo.indexOf('=');
      var llave = igual >= 0 ? trozo.slice(0, igual) : trozo;
      var valor = igual >= 0 ? trozo.slice(igual + 1) : '';
      if (!llave) continue;
      try {
        llave = decodeURIComponent(llave.replace(/\+/g, ' '));
        valor = decodeURIComponent(valor.replace(/\+/g, ' '));
      } catch (e) { /* si viene mal codificado se deja tal cual */ }
      params[llave] = valor;
    }
    return params;
  }

  /** Serializa { id:'u_1' } en 'id=u_1'. */
  function armarParams(params) {
    if (!params || typeof params !== 'object') return '';
    var pares = [];
    for (var llave in params) {
      if (!Object.prototype.hasOwnProperty.call(params, llave)) continue;
      var valor = params[llave];
      if (valor === null || valor === undefined || valor === '') continue;
      pares.push(encodeURIComponent(llave) + '=' + encodeURIComponent(String(valor)));
    }
    return pares.join('&');
  }

  /** Lee el hash del navegador y lo parte en { path, params }. */
  function leerHash() {
    var bruto = '';
    try { bruto = window.location.hash || ''; } catch (e) { bruto = ''; }
    if (bruto.charAt(0) === '#') bruto = bruto.slice(1);
    bruto = bruto.replace(/^\/+/, '');
    var corte = bruto.indexOf('?');
    var path = corte >= 0 ? bruto.slice(0, corte) : bruto;
    var query = corte >= 0 ? bruto.slice(corte + 1) : '';
    return { path: limpiarPath(path), params: parsearParams(query) };
  }

  function contenedor() {
    return document.getElementById(ID_VISTA);
  }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function nombreGym() {
    if (AG.DB && AG.DB.state && AG.DB.state.settings && AG.DB.state.settings.nombreGym) {
      return AG.DB.state.settings.nombreGym;
    }
    return 'Alliance Gym';
  }

  function emitir(evento, datos) {
    var lista = oyentes[evento];
    if (!lista || !lista.length) return;
    for (var i = 0; i < lista.length; i++) {
      try { lista[i](datos); } catch (e) { /* un oyente con error no rompe la navegación */ }
    }
  }

  /* =============================================================
     Pantallas de servicio (404, sin acceso, error)
     ============================================================= */

  function pantallaAviso(iconoNombre, titulo, mensaje, conReintento) {
    return '' +
      '<div class="page">' +
        '<div class="card">' +
          '<div class="card-body">' +
            '<div class="empty">' +
              '<div class="empty-icono">' + icono(iconoNombre, 34) + '</div>' +
              '<h2 class="page-title">' + esc(titulo) + '</h2>' +
              '<p class="empty-texto">' + esc(mensaje) + '</p>' +
              '<div class="row center wrap mt">' +
                (conReintento ? '<button class="btn btn-outline" data-router-reintentar type="button">Reintentar</button>' : '') +
                '<button class="btn btn-primary" data-router-inicio type="button">Ir a mi panel</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function pantalla404(path) {
    return pantallaAviso(
      'buscar',
      'No encontramos esa sección',
      'La dirección «' + path + '» no existe o cambió de lugar.',
      false
    );
  }

  function pantallaSinAcceso(titulo) {
    return pantallaAviso(
      'candado',
      'Sin acceso',
      'Tu rol no tiene permiso para ver ' + (titulo ? '«' + titulo + '»' : 'esta sección') + '. Si crees que es un error, contacta a dirección.',
      false
    );
  }

  function pantallaSinSesion() {
    return pantallaAviso(
      'usuario',
      'Sesión no disponible',
      'Vuelve a iniciar sesión para continuar.',
      false
    );
  }

  function pantallaError(mensaje) {
    return pantallaAviso(
      'alerta',
      'Ocurrió un error al mostrar esta sección',
      mensaje || 'No pudimos preparar la información. Intenta de nuevo.',
      true
    );
  }

  /** Engancha los botones de las pantallas de servicio. */
  function engancharAvisos(raiz) {
    if (!raiz) return;
    var reintentar = raiz.querySelector('[data-router-reintentar]');
    if (reintentar) {
      reintentar.addEventListener('click', function () { Router.refrescar(); });
    }
    var inicio = raiz.querySelector('[data-router-inicio]');
    if (inicio) {
      inicio.addEventListener('click', function () {
        var u = usuarioActual();
        var destino = Router.inicioDe(u ? u.rol : '');
        if (destino) Router.ir(destino);
      });
    }
  }

  /* =============================================================
     Pintado
     ============================================================= */

  /**
   * Vuelca la salida de un render dentro del contenedor.
   * Acepta string, HTMLElement o { html, listo }.
   * @returns {Function|null} la función listo() pendiente, si la hay
   */
  function aplicarSalida(cont, salida) {
    if (salida === null || salida === undefined) { cont.innerHTML = ''; return null; }

    if (typeof salida === 'string') { cont.innerHTML = salida; return null; }

    if (salida.nodeType === 1 || salida.nodeType === 11) {
      cont.innerHTML = '';
      cont.appendChild(salida);
      return null;
    }

    if (typeof salida === 'object') {
      var html = salida.html;
      if (html && (html.nodeType === 1 || html.nodeType === 11)) {
        cont.innerHTML = '';
        cont.appendChild(html);
      } else {
        cont.innerHTML = (html === null || html === undefined) ? '' : String(html);
      }
      return typeof salida.listo === 'function' ? salida.listo : null;
    }

    cont.innerHTML = String(salida);
    return null;
  }

  function mensajeDeError(e) {
    if (!e) return '';
    if (typeof e === 'string') return e;
    if (e.message) return String(e.message);
    return String(e);
  }

  /** Muestra la tarjeta de error sin dejar la pantalla en blanco. */
  function mostrarError(cont, e) {
    cont.innerHTML = pantallaError(mensajeDeError(e));
    engancharAvisos(cont);
  }

  /** Ajusta el título de la topbar y el título del documento. */
  function actualizarTitulo(texto) {
    var nodo = document.getElementById(ID_TITULO);
    if (nodo) nodo.innerHTML = esc(texto || '');
    try {
      document.title = (texto ? texto + ' · ' : '') + nombreGym();
    } catch (e) { /* sin consecuencias */ }
  }

  /** Marca como activo el enlace del menú que corresponde al path actual. */
  function marcarNav(path) {
    var enlaces = document.querySelectorAll('.nav-item');
    var objetivo = String(path || '').toLowerCase();
    for (var i = 0; i < enlaces.length; i++) {
      var href = enlaces[i].getAttribute('href') || '';
      var suyo = limpiarPath(href).toLowerCase();
      if (suyo && suyo === objetivo) {
        enlaces[i].classList.add('active');
        enlaces[i].setAttribute('aria-current', 'page');
      } else {
        enlaces[i].classList.remove('active');
        enlaces[i].removeAttribute('aria-current');
      }
    }
  }

  /** Sube el contenido al inicio tras cambiar de sección. */
  function subirScroll(cont) {
    try {
      if (cont) cont.scrollTop = 0;
      if (window.scrollY) window.scrollTo(0, 0);
    } catch (e) { /* sin consecuencias */ }
  }

  /** Cierre del ciclo: título, menú, scroll y evento 'navego'. */
  function terminarPintado(cont, ruta, ctx) {
    actualizarTitulo(ruta ? ruta.titulo : '');
    marcarNav(ctx.path);
    subirScroll(cont);
    emitir('navego', { path: ctx.path, params: ctx.params, ruta: ruta, usuario: ctx.usuario });
  }

  /**
   * Resuelve el hash actual y pinta la vista.
   * @param {Boolean} forzar repinta aunque sea el mismo destino
   */
  function pintar(forzar) {
    var cont = contenedor();
    if (!cont) return;                       // aún se muestra el login: no hay dónde pintar

    var usuario = usuarioActual();
    if (!usuario) {
      cont.innerHTML = pantallaSinSesion();
      engancharAvisos(cont);
      return;
    }

    var destino = leerHash();

    // Sin hash: se manda al panel que le toca al rol.
    if (!destino.path) {
      var inicio = Router.inicioDe(usuario.rol);
      if (inicio) {
        try { window.location.hash = '#/' + inicio; } catch (e) { /* sin consecuencias */ }
        return;                              // el hashchange dispara el pintado real
      }
      cont.innerHTML = pantalla404('');
      engancharAvisos(cont);
      return;
    }

    ctxActual = { path: destino.path, params: destino.params };

    var clave = usuario.id + '|' + destino.path + '|' + armarParams(destino.params);
    if (!forzar && clave === ultimaClave) return;
    ultimaClave = clave;

    var ruta = buscarRuta(destino.path);

    if (!ruta) {
      cont.innerHTML = pantalla404(destino.path);
      engancharAvisos(cont);
      terminarPintado(cont, null, { path: destino.path, params: destino.params, usuario: usuario });
      return;
    }

    // Control de acceso por rol: nunca se devuelve al login, se muestra el aviso.
    if (ruta.roles.length && ruta.roles.indexOf(usuario.rol) < 0) {
      cont.innerHTML = pantallaSinAcceso(ruta.titulo);
      engancharAvisos(cont);
      terminarPintado(cont, null, { path: destino.path, params: destino.params, usuario: usuario });
      return;
    }

    var ctx = { usuario: usuario, params: destino.params, path: destino.path, ruta: ruta };
    var token = ++pintando;
    var salida;

    try {
      salida = ruta.render(ctx);
    } catch (e) {
      mostrarError(cont, e);
      terminarPintado(cont, ruta, ctx);
      return;
    }

    // El render puede ser asíncrono: se espera y se descarta si ya hubo otra navegación.
    if (salida && typeof salida.then === 'function') {
      cont.innerHTML = '<div class="loading"><span class="skeleton"></span></div>';
      salida.then(function (resuelto) {
        if (token !== pintando) return;
        volcar(cont, resuelto, ruta, ctx);
      }, function (e) {
        if (token !== pintando) return;
        mostrarError(cont, e);
        terminarPintado(cont, ruta, ctx);
      });
      return;
    }

    volcar(cont, salida, ruta, ctx);
  }

  /** Aplica la salida ya resuelta y ejecuta listo() con red de seguridad. */
  function volcar(cont, salida, ruta, ctx) {
    var listo;
    try {
      listo = aplicarSalida(cont, salida);
    } catch (e) {
      mostrarError(cont, e);
      terminarPintado(cont, ruta, ctx);
      return;
    }

    if (listo) {
      try {
        listo(cont);
      } catch (e) {
        mostrarError(cont, e);
        terminarPintado(cont, ruta, ctx);
        return;
      }
    }

    terminarPintado(cont, ruta, ctx);
  }

  /* =============================================================
     API pública
     ============================================================= */
  var Router = {};

  Router.GRUPOS = ORDEN_GRUPOS.slice();

  /**
   * Registra una ruta.
   * @param {Object} ruta { path, roles:[], titulo, nav:{etiqueta,icono,grupo,orden}|null, render(ctx) }
   * @returns {Object|null} la ruta normalizada
   */
  Router.registrar = function (ruta) {
    if (!ruta || typeof ruta !== 'object') {
      window.console.warn('AG.Router: se intentó registrar una ruta vacía.');
      return null;
    }

    var path = limpiarPath(ruta.path);
    if (!path) {
      window.console.warn('AG.Router: ruta sin "path" válido, se ignora.');
      return null;
    }
    if (typeof ruta.render !== 'function') {
      window.console.warn('AG.Router: la ruta "' + path + '" no trae render(), se ignora.');
      return null;
    }

    var roles;
    if (typeof ruta.roles === 'string') roles = [ruta.roles];
    else if (esArray(ruta.roles)) roles = ruta.roles.slice();
    else roles = [];                          // sin roles = visible para cualquier sesión

    var nav = null;
    if (ruta.nav && typeof ruta.nav === 'object') {
      var grupo = ruta.nav.grupo ? String(ruta.nav.grupo) : 'Principal';
      nav = {
        etiqueta: String(ruta.nav.etiqueta || ruta.titulo || path),
        icono: ruta.nav.icono ? String(ruta.nav.icono) : 'inicio',
        grupo: grupo,
        orden: typeof ruta.nav.orden === 'number' && isFinite(ruta.nav.orden) ? ruta.nav.orden : 99
      };
    }

    var normalizada = {
      path: path,
      roles: roles,
      titulo: ruta.titulo ? String(ruta.titulo) : (nav ? nav.etiqueta : path),
      nav: nav,
      render: ruta.render
    };

    var existente = porPath[path];
    if (existente) {
      window.console.warn('AG.Router: la ruta "' + path + '" ya estaba registrada; se reemplaza por la última.');
      var i = rutas.indexOf(existente);
      if (i >= 0) rutas.splice(i, 1, normalizada);
      else rutas.push(normalizada);
    } else {
      rutas.push(normalizada);
    }
    porPath[path] = normalizada;
    return normalizada;
  };

  /** Todas las rutas registradas (copia). */
  Router.rutas = function () {
    return rutas.slice();
  };

  /** Rutas con menú visibles para un rol, ya ordenadas por grupo y orden. */
  Router.rutasDe = function (rol) {
    var visibles = [];
    for (var i = 0; i < rutas.length; i++) {
      var r = rutas[i];
      if (!r.nav) continue;
      if (r.roles.length && r.roles.indexOf(rol) < 0) continue;
      visibles.push(r);
    }

    // Orden estable: primero por posición del grupo, luego por nav.orden, luego alfabético.
    return visibles.map(function (r, idx) {
      var pos = ORDEN_GRUPOS.indexOf(r.nav.grupo);
      return { ruta: r, pos: pos < 0 ? ORDEN_GRUPOS.length : pos, idx: idx };
    }).sort(function (a, b) {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.ruta.nav.grupo !== b.ruta.nav.grupo) return a.ruta.nav.grupo < b.ruta.nav.grupo ? -1 : 1;
      if (a.ruta.nav.orden !== b.ruta.nav.orden) return a.ruta.nav.orden - b.ruta.nav.orden;
      if (a.ruta.nav.etiqueta !== b.ruta.nav.etiqueta) return a.ruta.nav.etiqueta < b.ruta.nav.etiqueta ? -1 : 1;
      return a.idx - b.idx;
    }).map(function (envuelto) {
      return envuelto.ruta;
    });
  };

  /**
   * HTML del menú lateral para un rol, agrupado y en el orden del contrato.
   * @returns {String}
   */
  Router.construirNav = function (rol) {
    var lista = Router.rutasDe(rol);
    if (!lista.length) return '';

    var html = '';
    var grupoActual = null;

    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      if (r.nav.grupo !== grupoActual) {
        grupoActual = r.nav.grupo;
        html += '<div class="nav-grupo">' + esc(grupoActual) + '</div>';
      }
      html += '<a class="nav-item" href="#/' + esc(r.path) + '" title="' + esc(r.titulo) + '">' +
                icono(r.nav.icono, 20) +
                '<span>' + esc(r.nav.etiqueta) + '</span>' +
              '</a>';
    }
    return html;
  };

  /** Ruta de inicio de cada rol. */
  Router.inicioDe = function (rol) {
    if (INICIOS[rol]) return INICIOS[rol];
    // Rol desconocido: se usa la primera ruta de menú que tenga permitida.
    var lista = Router.rutasDe(rol);
    return lista.length ? lista[0].path : '';
  };

  /** Contexto actual { path, params }. */
  Router.actual = function () {
    return { path: ctxActual.path, params: ctxActual.params };
  };

  /** La ruta registrada que se está mostrando (o null). */
  Router.rutaActual = function () {
    return buscarRuta(ctxActual.path);
  };

  /**
   * Navega a una ruta.
   * Acepta 'a/b', '#/a/b', 'a/b?id=1' o { path:'a/b', params:{id:'1'} }.
   */
  Router.ir = function (destino) {
    var path = '';
    var query = '';

    if (destino && typeof destino === 'object') {
      path = limpiarPath(destino.path);
      query = armarParams(destino.params);
    } else {
      var crudo = String(destino === null || destino === undefined ? '' : destino).trim();
      if (crudo.charAt(0) === '#') crudo = crudo.slice(1);
      crudo = crudo.replace(/^\/+/, '');
      var corte = crudo.indexOf('?');
      path = limpiarPath(corte >= 0 ? crudo.slice(0, corte) : crudo);
      query = corte >= 0 ? crudo.slice(corte + 1) : '';
    }

    if (!path) {
      var u = usuarioActual();
      path = Router.inicioDe(u ? u.rol : '');
      if (!path) return;
    }

    var nuevo = '#/' + path + (query ? '?' + query : '');
    var anterior = '';
    try { anterior = window.location.hash || ''; } catch (e) { anterior = ''; }

    if (anterior === nuevo) {
      Router.refrescar();                      // mismo destino: se repinta a mano
      return;
    }
    try { window.location.hash = nuevo; } catch (e) { /* sin consecuencias */ }
  };

  /** Vuelve a pintar la vista actual (lo usan los módulos tras guardar datos). */
  Router.refrescar = function () {
    pintar(true);
  };

  /** Engancha hashchange y pinta la ruta actual. Es idempotente. */
  Router.iniciar = function () {
    if (!iniciado) {
      iniciado = true;
      window.addEventListener('hashchange', function () { pintar(false); });
    }
    ultimaClave = '';                          // tras montar el shell siempre se repinta
    pintar(true);
  };

  /**
   * Registra un oyente de navegación.
   * @param {'navego'} evento
   * @param {Function} fn recibe { path, params, ruta, usuario }
   * @returns {Function} función para dejar de escuchar
   */
  Router.on = function (evento, fn) {
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
  Router.off = function (evento, fn) {
    var lista = oyentes[evento];
    if (!lista) return;
    var i = lista.indexOf(fn);
    if (i >= 0) lista.splice(i, 1);
  };

  AG.Router = Router;
})(window.AG);
