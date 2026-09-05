/* =============================================================
   ALLIANCE GYM — Arranque de la aplicación
   Monta el login o el shell (sidebar + topbar + vista) según sesión.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  var App = {};

  /* ---------- Utilidades internas ---------- */
  function $(sel) { return document.querySelector(sel); }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema || 'oscuro');
  }

  /* ---------- Login ---------- */
  App.montarLogin = function () {
    var app = $('#app');
    app.className = 'app-login';
    var salida = AG.Views.Login.render();
    if (typeof salida === 'string') {
      app.innerHTML = salida;
    } else {
      app.innerHTML = salida.html;
      if (salida.listo) salida.listo(app);
    }
  };

  /* ---------- Shell ---------- */
  App.montarShell = function () {
    var usuario = AG.Auth.actual();
    if (!usuario) return App.montarLogin();

    var s = AG.DB.state.settings;
    var app = $('#app');
    app.className = 'app-shell';

    app.innerHTML =
      '<div class="shell">' +
        '<div class="backdrop-nav" id="backdrop-nav"></div>' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="sidebar-logo">' +
            '<div class="logo-escudo">' + AG.Icons.get('escudo', 26) + '</div>' +
            '<div class="logo-txt"><b>' + AG.Utils.esc(s.nombreGym) + '</b><span>' + AG.Utils.esc(s.lema || '') + '</span></div>' +
          '</div>' +
          '<nav class="nav" id="nav">' + AG.Router.construirNav(usuario.rol) + '</nav>' +
          '<div class="sidebar-pie">' +
            '<div class="sidebar-user">' +
              AG.Utils.avatar(usuario) +
              '<div class="su-txt"><b>' + AG.Utils.esc(AG.Utils.nombreCompleto(usuario)) + '</b><span>' + AG.Utils.esc(App.etiquetaRol(usuario.rol)) + '</span></div>' +
            '</div>' +
            '<button class="btn btn-ghost btn-sm btn-block" id="btn-salir">' + AG.Icons.get('salir', 16) + ' Cerrar sesión</button>' +
          '</div>' +
        '</aside>' +

        '<div class="principal">' +
          '<header class="topbar">' +
            '<button class="btn-icono solo-movil" id="btn-menu" aria-label="Menú">' + AG.Icons.get('menu', 22) + '</button>' +
            '<div class="topbar-titulo" id="topbar-titulo"></div>' +
            '<div class="topbar-acciones">' +
              '<button class="btn-icono" id="btn-tema" title="Cambiar tema">' + AG.Icons.get(s.tema === 'claro' ? 'luna' : 'sol', 20) + '</button>' +
              '<button class="btn-icono" id="btn-notif" title="Notificaciones">' + AG.Icons.get('campana', 20) + '<span class="punto-notif oculto" id="punto-notif"></span></button>' +
              '<div class="topbar-user">' + AG.Utils.avatar(usuario, 'sm') + '</div>' +
            '</div>' +
          '</header>' +
          '<main class="contenido" id="vista"></main>' +
        '</div>' +
      '</div>';

    App.engancharShell();
    AG.Router.iniciar();
    App.pintarNotificaciones();
  };

  App.etiquetaRol = function (rol) {
    return { director: 'Dirección general', coach: 'Entrenador', socio: 'Socio' }[rol] || rol;
  };

  App.engancharShell = function () {
    var sidebar = $('#sidebar'), backdrop = $('#backdrop-nav');

    function cerrarNav() { sidebar.classList.remove('abierto'); backdrop.classList.remove('visible'); }

    var btnMenu = $('#btn-menu');
    if (btnMenu) btnMenu.addEventListener('click', function () {
      sidebar.classList.toggle('abierto');
      backdrop.classList.toggle('visible', sidebar.classList.contains('abierto'));
    });
    backdrop.addEventListener('click', cerrarNav);
    $('#nav').addEventListener('click', function (e) {
      if (e.target.closest('.nav-item')) cerrarNav();
    });

    $('#btn-salir').addEventListener('click', function () {
      AG.Utils.confirmar('¿Cerrar la sesión?', 'Salir').then(function (ok) {
        if (ok) { AG.Auth.salir(); location.hash = ''; App.montarLogin(); }
      });
    });

    $('#btn-tema').addEventListener('click', function () {
      var nuevo = AG.DB.state.settings.tema === 'claro' ? 'oscuro' : 'claro';
      AG.DB.state.settings.tema = nuevo;
      AG.DB.guardar();
      aplicarTema(nuevo);
      this.innerHTML = AG.Icons.get(nuevo === 'claro' ? 'luna' : 'sol', 20);
    });

    $('#btn-notif').addEventListener('click', App.abrirNotificaciones);
  };

  /* ---------- Notificaciones ---------- */
  App.misNotificaciones = function () {
    var u = AG.Auth.actual();
    if (!u) return [];
    return AG.DB.get('notificaciones')
      .filter(function (n) { return n.usuarioId === u.id; })
      .sort(function (a, b) { return b.fecha < a.fecha ? -1 : 1; });
  };

  App.pintarNotificaciones = function () {
    var punto = $('#punto-notif');
    if (!punto) return;
    var hay = App.misNotificaciones().some(function (n) { return !n.leida; });
    punto.classList.toggle('oculto', !hay);
  };

  App.abrirNotificaciones = function () {
    var lista = App.misNotificaciones().slice(0, 30);
    var cuerpo = lista.length
      ? '<div class="list">' + lista.map(function (n) {
          return '<a class="list-item' + (n.leida ? '' : ' no-leida') + '" href="' + (n.link || '#') + '">' +
            '<div class="list-item-main"><b>' + AG.Utils.esc(n.titulo) + '</b>' +
            '<span class="mini muted">' + AG.Utils.esc(n.cuerpo || '') + '</span></div>' +
            '<div class="list-item-side mini muted">' + AG.Utils.fechaRelativa(n.fecha) + '</div></a>';
        }).join('') + '</div>'
      : '<div class="empty"><div class="empty-icono">' + AG.Icons.get('campana', 32) + '</div><p class="empty-texto">Sin notificaciones por ahora.</p></div>';

    AG.Utils.modal({
      titulo: 'Notificaciones',
      cuerpo: cuerpo,
      acciones: [
        { texto: 'Marcar todas como leídas', clase: 'btn-ghost', onClick: function (api) {
            App.misNotificaciones().forEach(function (n) { n.leida = true; });
            AG.DB.guardar(); App.pintarNotificaciones(); api.cerrar();
            AG.Utils.toast('Notificaciones al día', 'ok');
        } },
        { texto: 'Cerrar', clase: 'btn-primary', onClick: function (api) { api.cerrar(); } }
      ]
    });
  };

  /* ---------- Post-login ---------- */
  App.entrar = function (usuario) {
    location.hash = '#/' + AG.Router.inicioDe(usuario.rol);
    App.montarShell();
  };

  /* ---------- Arranque ---------- */
  App.iniciar = function () {
    AG.DB.cargar();
    AG.DB.sembrarSiVacio();
    AG.DB.recalcularEstadoSocios();
    aplicarTema(AG.DB.state.settings.tema);

    AG.DB.on('cambio', function () { App.pintarNotificaciones(); });

    var usuario = AG.Auth.restaurarSesion();
    if (usuario) App.montarShell();
    else App.montarLogin();
  };

  App.aplicarTema = aplicarTema;
  AG.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.iniciar);
  } else {
    App.iniciar();
  }
})(window.AG);
