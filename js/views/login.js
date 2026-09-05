/* =============================================================
   ALLIANCE GYM — AG.Views.Login
   -------------------------------------------------------------
   Pantalla de acceso al sistema. NO registra rutas: la monta
   AG.App.montarLogin() con app.innerHTML = render().html y
   después listo(app).

   Dos columnas en escritorio (formulario + panel decorativo con
   datos reales de la base) y una sola columna en móvil.

   Reglas de la casa: JavaScript clásico, sin módulos ni CDN,
   todo el texto que sale de la base pasa por AG.Utils.esc(),
   nada de alert/confirm/prompt, nada de localStorage directo y
   ningún bloque sin su estado vacío en español.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes
     ============================================================= */

  var CSS_ID = 'ag-css-login';
  var VERSION_SISTEMA = '1.0';

  /* Cuentas de demostración documentadas en docs/ARQUITECTURA.md §7.
     Las siembra js/data/seed.js; si alguna no existe, no se pinta. */
  var DEMO = [
    {
      email: 'director@alliancegym.mx',
      password: 'admin123',
      etiqueta: 'Dirección',
      puede: 'Finanzas, socios, coaches, reportes y configuración del gimnasio.'
    },
    {
      email: 'coach@alliancegym.mx',
      password: 'coach123',
      etiqueta: 'Coach',
      puede: 'Solo sus socios: mediciones, rutinas, nutrición y agenda.'
    },
    {
      email: 'socio@alliancegym.mx',
      password: 'socio123',
      etiqueta: 'Socio',
      puede: 'Su rutina del día, progreso, nutrición, membresía y calificar.'
    }
  ];

  /* Oyente que cierra la sesión al salir cuando NO se pidió mantenerla. */
  var cierreAlSalir = null;

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  /* Ajustes del gimnasio, siempre con valores de respaldo. */
  function ajustes() {
    var base = {
      nombreGym: 'ALLIANCE GYM',
      lema: 'Más fuertes juntos',
      direccion: '', telefono: '', email: '', horario: ''
    };
    try {
      var s = AG.DB && AG.DB.state && AG.DB.state.settings;
      if (s) {
        if (s.nombreGym) base.nombreGym = String(s.nombreGym);
        if (s.lema) base.lema = String(s.lema);
        base.direccion = s.direccion || '';
        base.telefono = s.telefono || '';
        base.email = s.email || '';
        base.horario = s.horario || '';
      }
    } catch (e) { /* la base aún no carga: se usan los respaldos */ }
    return base;
  }

  /* Versión de la estructura de datos (meta.version). */
  function versionBase() {
    try {
      var m = AG.DB && AG.DB.state && AG.DB.state.meta;
      if (m && m.version) return String(m.version);
    } catch (e) { /* sin base todavía */ }
    return String(AG.DB && AG.DB.VERSION ? AG.DB.VERSION : 1);
  }

  /* Usuario de la base por correo (para pintar la tarjeta demo real). */
  function usuarioPorCorreo(correo) {
    var buscado = String(correo || '').trim().toLowerCase();
    if (!buscado) return null;
    var lista = [];
    try { lista = AG.DB.get('usuarios'); } catch (e) { lista = []; }
    for (var i = 0; i < lista.length; i++) {
      var u = lista[i];
      if (u && u.email && String(u.email).trim().toLowerCase() === buscado) return u;
    }
    return null;
  }

  /* =============================================================
     2. Estilos propios de la pantalla
     Solo lo que css/styles.css no cubre: el botón de mostrar
     contraseña, la rejilla de las tarjetas demo y el pie.
     La animación 'temblor' ya existe en la hoja global.
     ============================================================= */

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Contraseña con botón de mostrar/ocultar */
      '.login-clave .input{padding-right:44px}' +
      '.login-ver{position:absolute;right:3px;top:50%;transform:translateY(-50%);' +
        'width:32px;height:32px;z-index:2}' +
      '.login-ver[aria-pressed="true"]{color:var(--rojo-2)}' +

      /* Fila de "mantener sesión" + enlace de contraseña olvidada */
      '.login-ayuda{margin-top:-6px}' +
      '.login-fila{flex-wrap:wrap;gap:8px 12px}' +
      '.login-enlace{background:none;border:0;padding:0;margin:0;font:inherit;font-size:12px;' +
        'font-weight:700;color:var(--texto-2);cursor:pointer;text-decoration:underline;' +
        'text-underline-offset:3px;transition:color var(--trans)}' +
      '.login-enlace:hover{color:var(--rojo-2)}' +
      '.login-enlace:focus-visible{outline:2px solid var(--rojo);outline-offset:3px;border-radius:4px}' +

      /* Sacudida del formulario cuando el acceso falla */
      '.login-form.sacudir{animation:temblor 380ms ease}' +

      /* Tarjetas de cuentas demo */
      '.demo-datos{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto;text-align:left}' +
      '.demo-datos>span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.demo-datos .demo-puede{white-space:normal;overflow:visible;font-size:11px;line-height:1.35;' +
        'color:var(--texto-3)}' +
      '.demo-cuenta .demo-flecha{flex:0 0 auto;color:var(--texto-3);opacity:.7}' +
      '.demo-cuenta:hover .demo-flecha{color:var(--rojo-2);opacity:1}' +

      /* Pie del panel */
      '.login-pie{max-width:400px;width:100%;display:flex;flex-direction:column;gap:2px}' +

      /* Panel decorativo: emblema, título y estrellas del promedio.
         El fondo del panel es oscuro en los dos temas, así que el título
         se fija en blanco (los encabezados globales usan var(--texto)). */
      '.login-arte-emblema{width:52px;height:52px;border-radius:14px;margin-bottom:2px}' +
      '.login-arte h2{color:#fff}' +
      '.login-arte h2 em{color:var(--rojo-2)}' +
      '.login-arte .login-arte-datos .login-arte-stars{display:block;margin:3px 0 4px;line-height:1}' +
      '.login-arte .login-arte-datos .stars .star{color:rgba(255,255,255,.28)}' +
      '.login-arte .login-arte-datos .stars .star.on{color:#FFC53D}' +

      '@media (max-width:1080px){.login-arte-emblema{display:none}}' +
      '@media (max-width:420px){.demo-cuenta b{min-width:0}' +
        '.demo-cuenta{padding:9px}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Datos reales para el panel decorativo
     ============================================================= */

  function datosGimnasio() {
    var datos = { socios: 0, coaches: 0, promedio: 0, opiniones: 0 };
    try {
      datos.socios = AG.DB.donde('usuarios', function (u) {
        return u && u.rol === 'socio' && u.estado === 'activo' && u.activo !== false;
      }).length;
      datos.coaches = AG.DB.donde('usuarios', function (u) {
        return u && u.rol === 'coach' && u.activo !== false;
      }).length;
      var resumen = AG.Calc.promedioCalificacion(AG.DB.get('calificaciones'));
      datos.promedio = resumen.promedio;
      datos.opiniones = resumen.total;
    } catch (e) { /* base vacía o sin cargar: se muestra el estado vacío */ }
    return datos;
  }

  function datoHTML(valor, etiqueta, extra) {
    return '<div>' +
      '<b>' + valor + '</b>' +
      (extra || '') +
      '<span>' + esc(etiqueta) + '</span>' +
    '</div>';
  }

  function datosArteHTML(datos) {
    if (!datos.socios && !datos.coaches && !datos.opiniones) {
      return '<div class="login-arte-datos">' +
        '<div><span>Todavía no hay datos cargados en este equipo</span></div>' +
      '</div>';
    }

    var estrellas = datos.opiniones
      ? '<div class="login-arte-stars">' + U.estrellas(datos.promedio, { size: 14 }) + '</div>'
      : '';

    return '<div class="login-arte-datos">' +
      datoHTML(esc(U.num(datos.socios, 0)), 'Socios activos') +
      datoHTML(esc(U.num(datos.coaches, 0)), datos.coaches === 1 ? 'Coach en piso' : 'Coaches en piso') +
      datoHTML(
        datos.opiniones ? esc(U.num(datos.promedio, 1)) : '—',
        datos.opiniones
          ? 'Calificación · ' + U.num(datos.opiniones, 0) + (datos.opiniones === 1 ? ' opinión' : ' opiniones')
          : 'Aún sin calificaciones',
        estrellas
      ) +
    '</div>';
  }

  /* 'ALLIANCE GYM' -> 'ALLIANCE <em>GYM</em>' (la última palabra en rojo). */
  function tituloArteHTML(nombre) {
    var partes = String(nombre || '').trim().split(/\s+/).filter(function (p) { return p; });
    if (!partes.length) return esc('Alliance Gym');
    if (partes.length === 1) return '<em>' + esc(partes[0]) + '</em>';
    var ultima = partes.pop();
    return esc(partes.join(' ')) + ' <em>' + esc(ultima) + '</em>';
  }

  function arteHTML(conf, datos) {
    return '<aside class="login-arte">' +
      '<div class="login-emblema login-arte-emblema">' + icono('escudo', 28) + '</div>' +
      '<h2>' + tituloArteHTML(conf.nombreGym) + '</h2>' +
      '<p>' + esc(conf.lema) +
        ' · Sistema de gestión integral: socios, mediciones, rutinas, nutrición y pagos en un solo lugar.</p>' +
      datosArteHTML(datos) +
    '</aside>';
  }

  /* =============================================================
     4. Cuentas de demostración
     ============================================================= */

  function tarjetaDemoHTML(cuenta, indice, usuario) {
    return '<button type="button" class="demo-cuenta" data-demo="' + indice + '">' +
      U.avatar(usuario, 'sm') +
      '<span class="demo-datos">' +
        '<b>' + esc(cuenta.etiqueta) + '</b>' +
        '<span>' + esc(cuenta.email) + '</span>' +
        '<span class="demo-puede">' + esc(cuenta.puede) + '</span>' +
      '</span>' +
      '<span class="demo-flecha">' + icono('flecha-der', 16) + '</span>' +
    '</button>';
  }

  function demoHTML() {
    var tarjetas = [];
    for (var i = 0; i < DEMO.length; i++) {
      var usuario = usuarioPorCorreo(DEMO[i].email);
      if (usuario) tarjetas.push(tarjetaDemoHTML(DEMO[i], i, usuario));
    }

    if (!tarjetas.length) {
      return '<div class="login-demo">' +
        '<p class="login-demo-titulo">Cuentas de demostración</p>' +
        '<div class="empty">' +
          '<div class="empty-icono">' + icono('usuario', 26) + '</div>' +
          '<p class="empty-texto">Todavía no hay cuentas en este equipo. ' +
            'Cierra y vuelve a abrir el sistema para cargar los datos de ejemplo.</p>' +
        '</div>' +
      '</div>';
    }

    return '<div class="login-demo">' +
      '<p class="login-demo-titulo">Entrar con una cuenta de demostración</p>' +
      tarjetas.join('') +
    '</div>';
  }

  /* =============================================================
     5. Formulario
     ============================================================= */

  function formularioHTML() {
    return '<form class="login-form" data-login novalidate>' +
      '<h2>Entrar al sistema</h2>' +
      '<p class="help login-ayuda">Usa el correo con el que te dieron de alta en recepción.</p>' +

      '<div class="field">' +
        '<label class="label" for="ag-login-correo">Correo</label>' +
        '<div class="input-icono">' +
          icono('correo', 17) +
          '<input class="input" id="ag-login-correo" name="email" type="email" data-correo ' +
            'autocomplete="username" inputmode="email" spellcheck="false" autocapitalize="off" ' +
            'placeholder="tucorreo@alliancegym.mx">' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="ag-login-clave">Contraseña</label>' +
        '<div class="input-icono login-clave">' +
          icono('candado', 17) +
          '<input class="input" id="ag-login-clave" name="password" type="password" data-clave ' +
            'autocomplete="current-password" placeholder="Tu contraseña">' +
          '<button type="button" class="btn-icono login-ver" data-ver-clave aria-pressed="false" ' +
            'title="Mostrar contraseña" aria-label="Mostrar contraseña">' + icono('ojo', 17) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="between login-fila">' +
        '<label class="check" title="Si la apagas, tu sesión se cierra al salir del sistema">' +
          '<input type="checkbox" name="mantener" data-mantener checked>' +
          '<span>Mantener sesión</span>' +
        '</label>' +
        '<button type="button" class="login-enlace" data-olvide>¿Olvidaste tu contraseña?</button>' +
      '</div>' +

      '<div class="oculto" data-error role="alert" aria-live="assertive"></div>' +

      '<button type="submit" class="btn btn-primary btn-lg btn-block">' +
        icono('candado', 18) + ' Entrar</button>' +
    '</form>';
  }

  function pieHTML(conf) {
    return '<div class="login-pie mini muted">' +
      '<span><b class="bold">' + esc(conf.nombreGym) + '</b> · Sistema v' + esc(VERSION_SISTEMA) +
        ' · base v' + esc(versionBase()) + '</span>' +
      '<span>Datos guardados localmente en este equipo.</span>' +
    '</div>';
  }

  /* =============================================================
     6. Errores en pantalla (nunca alert)
     ============================================================= */

  function cajaError(raiz) { return raiz ? raiz.querySelector('[data-error]') : null; }

  function limpiarError(raiz) {
    var caja = cajaError(raiz);
    if (caja) { caja.innerHTML = ''; caja.classList.add('oculto'); }
    var campos = U.$$('[data-correo], [data-clave]', raiz);
    for (var i = 0; i < campos.length; i++) campos[i].classList.remove('error');
  }

  /*
     Decide qué campo se pinta en rojo a partir del texto que devolvió
     AG.Auth.entrar ('No encontramos esa cuenta', 'Contraseña incorrecta',
     'Escribe tu correo y tu contraseña'...). Si no reconoce el mensaje,
     marca los dos: nunca se queda sin señal visual.
  */
  function camposSenalados(mensaje, correoEl, claveEl) {
    var m = U.normalizar(mensaje);
    var vacioCorreo = !!correoEl && !String(correoEl.value || '').trim();
    var vacioClave = !!claveEl && !String(claveEl.value || '');

    var marcaCorreo = vacioCorreo || m.indexOf('cuenta') >= 0 || m.indexOf('correo') >= 0;
    var marcaClave = vacioClave || m.indexOf('contrasena') >= 0;

    if (!marcaCorreo && !marcaClave) { marcaCorreo = true; marcaClave = true; }
    /* Con el correo escrito, "correo y contraseña" ya no señala el correo. */
    if (!vacioCorreo && marcaClave && m.indexOf('cuenta') < 0) marcaCorreo = false;

    return { correo: marcaCorreo, clave: marcaClave };
  }

  function mostrarError(raiz, mensaje) {
    var caja = cajaError(raiz);
    if (caja) {
      caja.classList.remove('oculto');
      caja.innerHTML = '<div class="login-error">' + icono('alerta', 16) +
        '<span>' + esc(mensaje) + '</span></div>';
    }

    /* Sacudida del formulario: se reinicia la animación en cada intento. */
    var form = raiz ? raiz.querySelector('[data-login]') : null;
    if (form) {
      form.classList.remove('sacudir');
      void form.offsetWidth;            // fuerza el reflujo para repetir la animación
      form.classList.add('sacudir');
      setTimeout(function () { form.classList.remove('sacudir'); }, 500);
    }

    var correo = raiz ? raiz.querySelector('[data-correo]') : null;
    var clave = raiz ? raiz.querySelector('[data-clave]') : null;
    var marcas = camposSenalados(mensaje, correo, clave);

    if (correo && marcas.correo) correo.classList.add('error');
    if (clave && marcas.clave) clave.classList.add('error');

    /* El foco va al campo que conviene corregir. */
    try {
      if (correo && marcas.correo) { correo.focus(); correo.select(); }
      else if (clave) { clave.focus(); clave.select(); }
    } catch (e) { /* el navegador negó el foco */ }
  }

  /* =============================================================
     7. Sesión: "Mantener sesión"
     AG.Auth guarda la sesión ~12 días. Si el usuario apaga la
     casilla, se cierra al salir del sistema (cerrar o recargar).
     ============================================================= */

  function aplicarMantener(mantener) {
    if (cierreAlSalir) {
      window.removeEventListener('pagehide', cierreAlSalir);
      window.removeEventListener('beforeunload', cierreAlSalir);
      cierreAlSalir = null;
    }
    if (mantener) return;

    cierreAlSalir = function () {
      try { AG.Auth.salir(); } catch (e) { /* nada que cerrar */ }
    };
    window.addEventListener('pagehide', cierreAlSalir);
    window.addEventListener('beforeunload', cierreAlSalir);
  }

  /* =============================================================
     8. Entrar
     ============================================================= */

  function intentarEntrar(raiz, correo, clave, mantener) {
    limpiarError(raiz);

    var resultado;
    try {
      resultado = AG.Auth.entrar(correo, clave);
    } catch (e) {
      resultado = { ok: false, error: 'No se pudo validar el acceso en este equipo' };
    }

    if (!resultado || !resultado.ok) {
      mostrarError(raiz, (resultado && resultado.error) || 'No pudimos iniciar tu sesión');
      return false;
    }

    aplicarMantener(!!mantener);

    var usuario = resultado.usuario;
    U.toast('Bienvenido, ' + U.nombreCompleto(usuario), 'ok');

    if (!AG.App || typeof AG.App.entrar !== 'function') {
      mostrarError(raiz, 'El sistema no terminó de cargar. Recarga la página e inténtalo de nuevo.');
      return false;
    }

    AG.App.entrar(usuario);
    return true;
  }

  /* =============================================================
     9. Modal de contraseña olvidada (sistema local, sin correos)
     ============================================================= */

  function abrirOlvide() {
    var conf = ajustes();

    var contacto = [];
    if (conf.telefono) {
      contacto.push('<div class="row-sm">' + icono('telefono', 15) +
        '<span>' + esc(conf.telefono) + '</span></div>');
    }
    if (conf.email) {
      contacto.push('<div class="row-sm">' + icono('correo', 15) +
        '<span>' + esc(conf.email) + '</span></div>');
    }
    if (conf.direccion) {
      contacto.push('<div class="row-sm">' + icono('ubicacion', 15) +
        '<span>' + esc(conf.direccion) + '</span></div>');
    }
    if (conf.horario) {
      contacto.push('<div class="row-sm">' + icono('reloj', 15) +
        '<span>' + esc(conf.horario) + '</span></div>');
    }

    U.modal({
      titulo: 'Recuperar tu acceso',
      cuerpo:
        '<div class="stack-sm">' +
          '<p>' + esc(conf.nombreGym) + ' funciona <b class="bold">solo en este equipo</b>: ' +
            'no hay servidor ni envío de correos, así que la contraseña no se puede restablecer sola.</p>' +
          '<div class="list">' +
            '<div class="list-item"><div class="list-item-main">' +
              '<b>1. Pídelo en recepción</b>' +
              '<span class="mini muted">Dirección abre tu ficha en Socios o Coaches y te asigna una contraseña nueva.</span>' +
            '</div></div>' +
            '<div class="list-item"><div class="list-item-main">' +
              '<b>2. Entra con la contraseña nueva</b>' +
              '<span class="mini muted">Al entrar puedes cambiarla desde tu perfil cuando quieras.</span>' +
            '</div></div>' +
          '</div>' +
          (contacto.length
            ? '<div class="stack-sm"><p class="micro muted">Contacto</p>' + contacto.join('') + '</div>'
            : '<p class="mini muted">Acércate a recepción para que dirección te ayude.</p>') +
        '</div>',
      acciones: [
        { texto: 'Entendido', clase: 'btn-primary', onClick: function (api) { api.cerrar(); } }
      ]
    });
  }

  /* =============================================================
     10. Eventos
     ============================================================= */

  function valorCorreo(raiz) {
    var el = raiz.querySelector('[data-correo]');
    return el ? String(el.value || '').trim() : '';
  }

  /* La contraseña NO se recorta: podría llevar espacios a propósito. */
  function valorClave(raiz) {
    var el = raiz.querySelector('[data-clave]');
    return el ? String(el.value || '') : '';
  }

  function valorMantener(raiz) {
    var el = raiz.querySelector('[data-mantener]');
    return el ? !!el.checked : true;
  }

  function enganchar(raiz) {
    if (!raiz) return;

    var form = raiz.querySelector('[data-login]');

    /* Enter dentro del formulario dispara este mismo submit. */
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        intentarEntrar(raiz, valorCorreo(raiz), valorClave(raiz), valorMantener(raiz));
      });
    }

    /* Mostrar / ocultar la contraseña */
    U.delegar(raiz, 'click', '[data-ver-clave]', function (e, el) {
      var campo = raiz.querySelector('[data-clave]');
      if (!campo) return;
      var mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      el.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
      var texto = mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña';
      el.setAttribute('title', texto);
      el.setAttribute('aria-label', texto);
      try {
        campo.focus();
        var n = campo.value.length;
        campo.setSelectionRange(n, n);
      } catch (err) { /* algunos navegadores no permiten mover el cursor */ }
    });

    /* Al escribir se limpia el error anterior */
    U.delegar(raiz, 'input', '[data-correo], [data-clave]', function () {
      limpiarError(raiz);
    });

    /* Cuentas de demostración: rellenan y entran directo */
    U.delegar(raiz, 'click', '[data-demo]', function (e, el) {
      var cuenta = DEMO[Number(el.getAttribute('data-demo'))];
      if (!cuenta) return;

      var correo = raiz.querySelector('[data-correo]');
      var clave = raiz.querySelector('[data-clave]');
      if (correo) correo.value = cuenta.email;
      if (clave) clave.value = cuenta.password;

      intentarEntrar(raiz, cuenta.email, cuenta.password, valorMantener(raiz));
    });

    /* Contraseña olvidada */
    U.delegar(raiz, 'click', '[data-olvide]', function (e) {
      e.preventDefault();
      abrirOlvide();
    });

    /* Autofoco en el correo (innerHTML ignora el atributo autofocus) */
    setTimeout(function () {
      var correo = raiz.querySelector('[data-correo]');
      if (!correo) return;
      try { correo.focus(); } catch (e) { /* sin foco disponible */ }
    }, 60);
  }

  /* =============================================================
     11. Render
     ============================================================= */

  function render() {
    asegurarEstilos();

    /* Al volver al login no debe quedar vivo el cierre de la sesión anterior. */
    aplicarMantener(true);

    var conf = ajustes();
    var datos = datosGimnasio();

    var html = '<div class="login-wrap">' +
      '<section class="login-panel">' +
        '<div class="login-brand">' +
          '<div class="login-emblema">' + icono('escudo', 30) + '</div>' +
          '<div>' +
            '<h1>' + esc(conf.nombreGym) + '</h1>' +
            '<span>' + esc(conf.lema) + '</span>' +
          '</div>' +
        '</div>' +

        formularioHTML() +
        demoHTML() +
        pieHTML(conf) +
      '</section>' +

      arteHTML(conf, datos) +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root); }
    };
  }

  /* =============================================================
     12. Exposición (esta vista no registra rutas)
     ============================================================= */

  AG.Views.Login = {
    render: render,
    abrirOlvide: abrirOlvide,
    cuentasDemo: DEMO
  };
})(window.AG);
