/* =============================================================
   ALLIANCE GYM — AG.Mod.Config
   -------------------------------------------------------------
   Panel de configuración del sistema. Solo dirección entra aquí.

   Ruta: 'director/config'

   Cinco pestañas:
     Gimnasio    -> identidad, contacto, moneda y metas del negocio
     Planes      -> catálogo de membresías (alta, edición, baja)
     Usuarios    -> todas las cuentas: rol, acceso y contraseñas
     Datos       -> estadísticas de la base, respaldo, importación y reinicio
     Apariencia  -> tema claro/oscuro con vista previa inmediata

   Reglas del proyecto que este archivo respeta al pie de la letra:
   JavaScript clásico (sin módulos ni dependencias), todo el texto
   que viene de la base se escapa con AG.Utils.esc(), nada de
   alert/confirm/prompt, nunca localStorage directo (todo por AG.DB)
   y ninguna lista sin su estado vacío con un mensaje útil.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de la pantalla
     ============================================================= */

  var TABS = [
    { clave: 'gimnasio', etiqueta: 'Gimnasio', icono: 'escudo' },
    { clave: 'planes', etiqueta: 'Planes', icono: 'tarjeta' },
    { clave: 'usuarios', etiqueta: 'Usuarios', icono: 'socios' },
    { clave: 'datos', etiqueta: 'Datos', icono: 'reporte' },
    { clave: 'apariencia', etiqueta: 'Apariencia', icono: 'sol' }
  ];

  /* Roles del sistema, en el orden en que se muestran. */
  var ROLES = [
    { valor: 'director', etiqueta: 'Dirección', icono: 'escudo', badge: 'danger',
      ayuda: 'Ve y edita todo el sistema, incluida esta pantalla.' },
    { valor: 'coach', etiqueta: 'Coach', icono: 'coach', badge: 'info',
      ayuda: 'Solo ve a los socios que tiene asignados.' },
    { valor: 'socio', etiqueta: 'Socio', icono: 'socios', badge: 'muted',
      ayuda: 'Solo ve su propia información: pagos, rutina y progreso.' }
  ];

  /* Monedas frecuentes con su símbolo sugerido. */
  var MONEDAS = [
    { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$' },
    { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
    { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
    { codigo: 'COP', nombre: 'Peso colombiano', simbolo: '$' },
    { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$' },
    { codigo: 'CLP', nombre: 'Peso chileno', simbolo: '$' },
    { codigo: 'PEN', nombre: 'Sol peruano', simbolo: 'S/' },
    { codigo: 'GTQ', nombre: 'Quetzal', simbolo: 'Q' }
  ];

  var LOCALES = [
    { valor: 'es-MX', etiqueta: 'Español de México (es-MX)' },
    { valor: 'es-AR', etiqueta: 'Español de Argentina (es-AR)' },
    { valor: 'es-CL', etiqueta: 'Español de Chile (es-CL)' },
    { valor: 'es-CO', etiqueta: 'Español de Colombia (es-CO)' },
    { valor: 'es-PE', etiqueta: 'Español de Perú (es-PE)' },
    { valor: 'es-ES', etiqueta: 'Español de España (es-ES)' },
    { valor: 'en-US', etiqueta: 'Inglés de Estados Unidos (en-US)' }
  ];

  /* Nombre legible de cada colección de la base. */
  var COLECCIONES = [
    { clave: 'usuarios', etiqueta: 'Usuarios (dirección, coaches y socios)', icono: 'socios' },
    { clave: 'planes', etiqueta: 'Planes de membresía', icono: 'tarjeta' },
    { clave: 'pagos', etiqueta: 'Pagos y recibos', icono: 'dinero' },
    { clave: 'mediciones', etiqueta: 'Mediciones corporales', icono: 'regla' },
    { clave: 'rutinas', etiqueta: 'Rutinas de entrenamiento', icono: 'pesa' },
    { clave: 'asignaciones', etiqueta: 'Asignaciones de rutina', icono: 'meta' },
    { clave: 'bitacoras', etiqueta: 'Bitácoras de entrenamiento', icono: 'historial' },
    { clave: 'planesNutricion', etiqueta: 'Planes de nutrición', icono: 'nutricion' },
    { clave: 'calificaciones', etiqueta: 'Calificaciones', icono: 'estrella' },
    { clave: 'asistencias', etiqueta: 'Asistencias', icono: 'calendario' },
    { clave: 'avisos', etiqueta: 'Avisos al gimnasio', icono: 'campana' },
    { clave: 'clases', etiqueta: 'Clases grupales', icono: 'clase' },
    { clave: 'notificaciones', etiqueta: 'Notificaciones', icono: 'chat' }
  ];

  /* Sin letras ni números que se confundan al dictarlos (O/0, I/1, l). */
  var ALFABETO_CLAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var RE_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  var USUARIOS_POR_PAGINA = 20;

  /* Estado vivo de la pantalla (sobrevive a los repintados del router). */
  var estado = {
    tab: 'gimnasio',
    busqueda: '',
    rolFiltro: '',
    estadoFiltro: '',
    pagina: 1
  };

  /* Último '?tab=' atendido: evita que un repintado deshaga la pestaña elegida. */
  var tabDeLaURL = null;

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function ico(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) {
    try { U.toast(mensaje, tipo || 'info'); } catch (e) { /* sin aviso visible */ }
  }

  function txt(v) {
    return String(v === null || v === undefined ? '' : v).trim();
  }

  /* Número finito (nunca NaN). */
  function nm(v, porDefecto) {
    var n = Number(v);
    return isFinite(n) ? n : (porDefecto || 0);
  }

  /* Entero finito. */
  function ent(v, porDefecto) {
    var n = Math.round(nm(v, porDefecto || 0));
    return isFinite(n) ? n : (porDefecto || 0);
  }

  /* Número escrito de verdad; null si el campo venía vacío. */
  function numOnull(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function acotar(valor, min, max) {
    var n = nm(valor, min);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function rellenar(n, largo) {
    var s = String(n);
    while (s.length < largo) s = '0' + s;
    return s;
  }

  /* Solo colores hexadecimales entran a los atributos style. */
  function colorSeguro(valor) {
    var c = txt(valor);
    return RE_COLOR.test(c) ? c : '#e4322b';
  }

  function ajustes() {
    if (!AG.DB.state.settings || typeof AG.DB.state.settings !== 'object') {
      AG.DB.state.settings = AG.DB.estructuraVacia().settings;
    }
    return AG.DB.state.settings;
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

  /* Directores que todavía pueden entrar al sistema. */
  function directoresActivos() {
    return AG.DB.donde('usuarios', function (u) {
      return u && u.rol === 'director' && u.activo !== false;
    });
  }

  function rolInfo(rol) {
    for (var i = 0; i < ROLES.length; i++) {
      if (ROLES[i].valor === rol) return ROLES[i];
    }
    return { valor: rol || '', etiqueta: rol || 'Sin rol', icono: 'usuario', badge: 'muted', ayuda: '' };
  }

  /* Contraseña temporal de 6 caracteres, fácil de dictar. */
  function claveTemporal() {
    var salida = '';
    for (var i = 0; i < 6; i++) {
      salida += ALFABETO_CLAVE.charAt(Math.floor(Math.random() * ALFABETO_CLAVE.length));
    }
    return salida;
  }

  /* Siguiente código de socio libre ('AG-0042'). */
  function siguienteCodigoSocio() {
    var lista = AG.DB.socios();
    var max = 0;
    for (var i = 0; i < lista.length; i++) {
      var m = /^AG-(\d+)$/.exec(txt(lista[i].codigo).toUpperCase());
      if (!m) continue;
      var n = parseInt(m[1], 10);
      if (isFinite(n) && n > max) max = n;
    }
    return 'AG-' + rellenar(max + 1, 4);
  }

  function correoOcupado(email, exceptoId) {
    var correo = txt(email).toLowerCase();
    if (!correo) return false;
    var repetidos = AG.DB.donde('usuarios', function (u) {
      return u && u.id !== exceptoId && txt(u.email).toLowerCase() === correo;
    });
    return repetidos.length > 0;
  }

  function refrescarPantalla() {
    if (AG.Router && typeof AG.Router.refrescar === 'function') AG.Router.refrescar();
  }

  function recargar() {
    try {
      window.location.reload();
    } catch (e) {
      if (AG.App && typeof AG.App.montarShell === 'function') AG.App.montarShell();
    }
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-config';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.cfg-zona{border:2px dashed var(--borde-2);border-radius:var(--radio);padding:22px 16px;' +
        'text-align:center;background:var(--panel-2);transition:border-color var(--trans),background var(--trans)}' +
      '.cfg-zona svg{color:var(--texto-3)}' +
      '.cfg-zona.encima{border-color:var(--rojo);background:var(--rojo-bg)}' +
      '.cfg-zona.encima svg{color:var(--rojo)}' +
      '.cfg-punto{display:inline-block;width:12px;height:12px;border-radius:50%;flex:0 0 auto;' +
        'border:1px solid rgba(0,0,0,.28)}' +
      '.cfg-plan{display:flex;align-items:center;gap:9px;min-width:0}' +
      '.cfg-plan b{display:block;line-height:1.25}' +
      '.cfg-clave{font-size:23px;line-height:1.3;letter-spacing:.24em;font-weight:800;text-align:center;' +
        'padding:15px 10px;border:1px dashed var(--borde-2);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);color:var(--texto);word-break:break-all}' +
      '.cfg-colores{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(128px,1fr))}' +
      '.cfg-color{border:1px solid var(--borde);border-radius:var(--radio-sm);overflow:hidden;background:var(--panel-2)}' +
      '.cfg-color-muestra{height:44px}' +
      '.cfg-color-txt{padding:7px 9px;min-width:0}' +
      '.cfg-marca{display:flex;align-items:center;gap:13px;padding:14px;border:1px solid var(--borde);' +
        'border-radius:var(--radio-sm);background:var(--panel-2);min-width:0}' +
      '.cfg-marca-escudo{width:44px;height:44px;flex:0 0 auto;display:flex;align-items:center;' +
        'justify-content:center;border-radius:var(--radio-sm);background:var(--rojo);color:#fff}' +
      '.cfg-marca-txt{min-width:0;display:flex;flex-direction:column;line-height:1.3}' +
      '.cfg-marca-txt b{font-size:15px;color:var(--texto)}' +
      '.cfg-swatch{width:26px;height:26px;border-radius:50%;border:1px solid var(--borde-2);' +
        'padding:0;cursor:pointer}' +
      '@media (max-width:520px){.cfg-clave{font-size:19px;letter-spacing:.16em}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function vacioHTML(iconoNombre, mensaje, botonHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ico(iconoNombre || 'info', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botonHTML || '') +
    '</div>';
  }

  function kpiHTML(iconoNombre, valor, etiqueta, variante) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + ico(iconoNombre, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
      '</div>' +
    '</div>';
  }

  function tarjetaHTML(iconoNombre, titulo, cuerpo, accionHTML, subtitulo) {
    return '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<div class="card-title">' + ico(iconoNombre, 18) + '<span>' + esc(titulo) + '</span></div>' +
          (subtitulo ? '<div class="card-sub">' + esc(subtitulo) + '</div>' : '') +
        '</div>' +
        (accionHTML ? '<div class="card-accion">' + accionHTML + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  /** Campo de formulario con etiqueta, control y ayuda opcional. */
  function campo(id, etiqueta, control, ayuda, clase, requerido) {
    return '<div class="field' + (clase ? ' ' + clase : '') + '">' +
      '<label class="label" for="' + esc(id) + '">' + esc(etiqueta) +
        (requerido ? ' <span class="req">*</span>' : '') + '</label>' +
      control +
      (ayuda ? '<p class="help">' + esc(ayuda) + '</p>' : '') +
    '</div>';
  }

  function inputHTML(id, nombre, tipo, valor, extra) {
    return '<input class="input" id="' + esc(id) + '" name="' + esc(nombre) + '" type="' + esc(tipo) + '" ' +
      (extra || '') + ' value="' + esc(valor === null || valor === undefined ? '' : valor) + '">';
  }

  function selectHTML(id, nombre, opciones, valor, extra) {
    var html = '<select class="select" id="' + esc(id) + '" name="' + esc(nombre) + '" ' + (extra || '') + '>';
    for (var i = 0; i < opciones.length; i++) {
      var o = opciones[i];
      html += '<option value="' + esc(o.valor) + '"' + (String(o.valor) === String(valor) ? ' selected' : '') + '>' +
        esc(o.etiqueta) + '</option>';
    }
    return html + '</select>';
  }

  function errorFormHTML(marca) {
    return '<p class="mini txt-error oculto" data-error="' + esc(marca) + '" role="alert"></p>';
  }

  /** Muestra el mensaje de error del formulario y enfoca el campo culpable. */
  function fallar(raiz, marca, mensaje, selector) {
    var aviso = U.$('[data-error="' + marca + '"]', raiz);
    if (aviso) {
      aviso.textContent = mensaje;
      aviso.classList.remove('oculto');
    }
    toast(mensaje, 'error');
    var destino = selector ? U.$(selector, raiz) : null;
    if (destino) {
      try { destino.focus(); } catch (e) { /* sin foco disponible */ }
    }
    return false;
  }

  /* =============================================================
     4. Pestaña GIMNASIO
     ============================================================= */

  function opcionesMoneda(actual) {
    var opciones = [], encontrada = false, i;
    for (i = 0; i < MONEDAS.length; i++) {
      opciones.push({ valor: MONEDAS[i].codigo, etiqueta: MONEDAS[i].codigo + ' · ' + MONEDAS[i].nombre });
      if (MONEDAS[i].codigo === actual) encontrada = true;
    }
    if (actual && !encontrada) opciones.unshift({ valor: actual, etiqueta: actual + ' · moneda personalizada' });
    return opciones;
  }

  function opcionesLocale(actual) {
    var opciones = [], encontrado = false, i;
    for (i = 0; i < LOCALES.length; i++) {
      opciones.push({ valor: LOCALES[i].valor, etiqueta: LOCALES[i].etiqueta });
      if (LOCALES[i].valor === actual) encontrado = true;
    }
    if (actual && !encontrado) opciones.unshift({ valor: actual, etiqueta: actual + ' · formato personalizado' });
    return opciones;
  }

  function panelGimnasio() {
    var s = ajustes();

    var identidad = '<div class="form-grid dos">' +
      campo('cfg-nombre', 'Nombre del gimnasio',
        inputHTML('cfg-nombre', 'nombreGym', 'text', s.nombreGym, 'maxlength="60" autocomplete="off"'),
        'Aparece en el menú, en los recibos y en las impresiones.', 'ancho-total', true) +
      campo('cfg-lema', 'Lema',
        inputHTML('cfg-lema', 'lema', 'text', s.lema, 'maxlength="80" autocomplete="off"'),
        'Frase corta que acompaña al nombre en el menú lateral.', 'ancho-total') +
    '</div>';

    var contacto = '<div class="form-grid dos">' +
      campo('cfg-direccion', 'Dirección',
        inputHTML('cfg-direccion', 'direccion', 'text', s.direccion, 'maxlength="140" autocomplete="off"'),
        '', 'ancho-total') +
      campo('cfg-telefono', 'Teléfono',
        inputHTML('cfg-telefono', 'telefono', 'tel', s.telefono, 'maxlength="24" autocomplete="off" placeholder="33 1234 5678"')) +
      campo('cfg-email', 'Correo de contacto',
        inputHTML('cfg-email', 'email', 'email', s.email, 'maxlength="90" autocomplete="off"')) +
      campo('cfg-horario', 'Horario de atención',
        inputHTML('cfg-horario', 'horario', 'text', s.horario, 'maxlength="160" autocomplete="off"'),
        'Ejemplo: Lun a Vie 5:00–23:00 · Sáb 7:00–17:00 · Dom 8:00–14:00.', 'ancho-total') +
    '</div>';

    var formato = '<div class="form-grid tres">' +
      campo('cfg-moneda', 'Moneda',
        selectHTML('cfg-moneda', 'moneda', opcionesMoneda(txt(s.moneda).toUpperCase()), txt(s.moneda).toUpperCase(), 'data-moneda'),
        'Al cambiarla se sugiere su símbolo.') +
      campo('cfg-simbolo', 'Símbolo',
        inputHTML('cfg-simbolo', 'simbolo', 'text', s.simbolo, 'maxlength="4" autocomplete="off" data-simbolo'),
        'Se antepone a cada cantidad: ' + txt(s.simbolo || '$') + '1,250.00') +
      campo('cfg-locale', 'Formato regional',
        selectHTML('cfg-locale', 'locale', opcionesLocale(txt(s.locale)), txt(s.locale)),
        'Define cómo se separan miles y decimales.') +
    '</div>';

    var metas = '<div class="form-grid dos">' +
      campo('cfg-gracia', 'Días de gracia para pagar',
        inputHTML('cfg-gracia', 'diasGraciaPago', 'number', s.diasGraciaPago, 'min="0" max="90" step="1"'),
        'Días que el socio sigue entrando después de vencer su membresía antes de marcarse como vencido.') +
      campo('cfg-meta-socios', 'Meta de socios nuevos por mes',
        inputHTML('cfg-meta-socios', 'metaSociosMes', 'number', s.metaSociosMes, 'min="0" max="9999" step="1"'),
        'Se compara con las altas del mes en el panel de dirección.') +
      campo('cfg-meta-ingreso', 'Meta de ingreso mensual',
        inputHTML('cfg-meta-ingreso', 'metaIngresoMensual', 'number', s.metaIngresoMensual, 'min="0" step="100"'),
        'Objetivo de cobranza del mes en ' + txt(s.moneda || 'MXN') + '.') +
      campo('cfg-costo-fijo', 'Costo fijo mensual',
        inputHTML('cfg-costo-fijo', 'costoFijoMensual', 'number', s.costoFijoMensual, 'min="0" step="100"'),
        'Renta, nómina y servicios. Sirve para calcular el punto de equilibrio.') +
    '</div>';

    return '<form class="stack" data-form-gimnasio novalidate>' +
      tarjetaHTML('escudo', 'Identidad', identidad, '', 'El nombre y el lema se ven en todo el sistema.') +
      tarjetaHTML('ubicacion', 'Contacto', contacto, '', 'Datos que se imprimen en recibos y avisos.') +
      tarjetaHTML('dinero', 'Moneda y formato', formato, '', 'Así se muestran todas las cantidades del sistema.') +
      tarjetaHTML('meta', 'Metas del negocio', metas, '', 'Con estos números se calculan avances y utilidad.') +
      errorFormHTML('gimnasio') +
      '<div class="row wrap between">' +
        '<span class="mini muted">Los cambios se aplican en toda la aplicación en cuanto guardas.</span>' +
        '<div class="row-sm">' +
          '<button type="button" class="btn btn-ghost" data-gimnasio-deshacer>Deshacer cambios</button>' +
          '<button type="button" class="btn btn-primary" data-guardar-gimnasio>' +
            ico('check', 16) + ' Guardar cambios</button>' +
        '</div>' +
      '</div>' +
    '</form>';
  }

  /** Valida y guarda los ajustes del gimnasio. */
  function guardarGimnasio(raiz) {
    var form = U.$('[data-form-gimnasio]', raiz);
    if (!form) return false;

    var d = U.formToObject(form);

    var nombreGym = txt(d.nombreGym);
    if (!nombreGym) {
      return fallar(raiz, 'gimnasio', 'El nombre del gimnasio no puede quedar vacío.', '#cfg-nombre');
    }

    var email = txt(d.email).toLowerCase();
    if (email && !RE_EMAIL.test(email)) {
      return fallar(raiz, 'gimnasio', 'Ese correo de contacto no tiene un formato válido.', '#cfg-email');
    }

    var simbolo = txt(d.simbolo);
    if (!simbolo) {
      return fallar(raiz, 'gimnasio', 'Escribe el símbolo de la moneda (por ejemplo $).', '#cfg-simbolo');
    }

    var locale = txt(d.locale) || 'es-MX';
    try { (1234.5).toLocaleString(locale); }
    catch (e) { locale = 'es-MX'; }

    var s = ajustes();
    s.nombreGym = nombreGym;
    s.lema = txt(d.lema);
    s.direccion = txt(d.direccion);
    s.telefono = txt(d.telefono);
    s.email = email;
    s.horario = txt(d.horario);
    s.moneda = txt(d.moneda).toUpperCase() || 'MXN';
    s.simbolo = simbolo;
    s.locale = locale;
    s.diasGraciaPago = acotar(ent(d.diasGraciaPago, 0), 0, 90);
    s.metaSociosMes = Math.max(0, ent(d.metaSociosMes, 0));
    s.metaIngresoMensual = Math.max(0, nm(d.metaIngresoMensual, 0));
    s.costoFijoMensual = Math.max(0, nm(d.costoFijoMensual, 0));

    AG.DB.guardar();

    /* Los días de gracia cambian quién está vencido: se recalcula al vuelo. */
    try { AG.DB.recalcularEstadoSocios(); } catch (e) { /* la base ya avisó si falló */ }

    toast('Configuración guardada. Así se llama ahora tu gimnasio en todo el sistema.', 'ok');

    /* El shell muestra nombre y lema: se vuelve a montar para que se refresque. */
    if (AG.App && typeof AG.App.montarShell === 'function') AG.App.montarShell();
    else refrescarPantalla();

    return true;
  }

  /* =============================================================
     5. Pestaña PLANES
     ============================================================= */

  function sociosDelPlan(planId) {
    return AG.DB.donde('usuarios', function (u) {
      return u && u.rol === 'socio' && u.planId === planId;
    });
  }

  function pagosDelPlan(planId) {
    return AG.DB.donde('pagos', function (p) { return p && p.planId === planId; });
  }

  /** '1 mes', '3 meses', '7 días' o 'Sin vigencia'. */
  function vigenciaTexto(plan) {
    var meses = Math.max(0, ent(plan.meses, 0));
    if (meses === 1) return '1 mes';
    if (meses > 1) return meses + ' meses';
    var dias = Math.max(0, ent(plan.dias, 0));
    if (dias === 1) return '1 día';
    if (dias > 1) return dias + ' días';
    return 'Sin vigencia';
  }

  function kpisPlanes(planes) {
    var activos = 0, suma = 0, cuenta = 0, i;
    for (i = 0; i < planes.length; i++) {
      if (planes[i].activo !== false) activos++;
      var precio = nm(planes[i].precio, 0);
      if (precio > 0) { suma += precio; cuenta++; }
    }

    var conPlan = AG.DB.donde('usuarios', function (u) {
      return u && u.rol === 'socio' && u.planId && AG.DB.plan(u.planId);
    }).length;

    return '<div class="grid g4">' +
      kpiHTML('tarjeta', String(planes.length), 'Planes en el catálogo', '') +
      kpiHTML('check', String(activos), 'Planes a la venta', 'kpi-ok') +
      kpiHTML('dinero', cuenta ? U.dinero(suma / cuenta, 0) : '—', 'Precio promedio', 'kpi-info') +
      kpiHTML('socios', String(conPlan), 'Socios con plan asignado', 'kpi-warn') +
    '</div>';
  }

  function filaPlan(plan) {
    var socios = sociosDelPlan(plan.id);
    var activosDelPlan = 0;
    for (var i = 0; i < socios.length; i++) {
      if (socios[i].estado === 'activo') activosDelPlan++;
    }

    var color = colorSeguro(plan.color);
    var enUso = socios.length > 0;

    return '<tr>' +
      '<td>' +
        '<div class="cfg-plan">' +
          '<span class="cfg-punto" style="background:' + esc(color) + '"></span>' +
          '<div style="min-width:0">' +
            '<b>' + esc(plan.nombre || 'Plan sin nombre') + '</b>' +
            '<span class="mini muted">' + esc(U.truncar(plan.descripcion || 'Sin descripción', 62)) + '</span>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td class="nums nowrap">' + esc(U.dinero(nm(plan.precio, 0), 0)) + '</td>' +
      '<td class="nowrap">' + esc(vigenciaTexto(plan)) + '</td>' +
      '<td class="nums nowrap">' + (nm(plan.inscripcion, 0) > 0 ? esc(U.dinero(plan.inscripcion, 0)) : '<span class="muted">Sin costo</span>') + '</td>' +
      '<td class="nums nowrap">' +
        '<b>' + socios.length + '</b>' +
        (socios.length ? ' <span class="mini muted">(' + activosDelPlan + ' al corriente)</span>' : '') +
      '</td>' +
      '<td>' + (plan.activo !== false ? U.badge('A la venta', 'ok') : U.badge('Oculto', 'muted')) + '</td>' +
      '<td>' +
        '<div class="row-sm nowrap">' +
          '<button type="button" class="btn-icono" data-plan-editar="' + esc(plan.id) + '" ' +
            'title="Editar plan" aria-label="Editar plan">' + ico('editar', 16) + '</button>' +
          '<button type="button" class="btn-icono" data-plan-activo="' + esc(plan.id) + '" ' +
            'title="' + (plan.activo !== false ? 'Quitar de la venta' : 'Poner a la venta') + '" ' +
            'aria-label="' + (plan.activo !== false ? 'Quitar de la venta' : 'Poner a la venta') + '">' +
            ico(plan.activo !== false ? 'ojo' : 'check', 16) + '</button>' +
          '<button type="button" class="btn-icono" data-plan-eliminar="' + esc(plan.id) + '" ' +
            'title="' + (enUso ? 'No se puede eliminar: tiene socios' : 'Eliminar plan') + '" ' +
            'aria-label="Eliminar plan">' + ico('basura', 16) + '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  function tablaPlanes(planes) {
    if (!planes.length) {
      return vacioHTML('tarjeta',
        'Todavía no hay planes de membresía. Crea el primero para poder registrar socios y cobrar.',
        '<button type="button" class="btn btn-primary mt" data-plan-nuevo>' + ico('mas', 16) + ' Crear el primer plan</button>');
    }

    var html = '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr>' +
        '<th>Plan</th><th>Precio</th><th>Vigencia</th><th>Inscripción</th>' +
        '<th>Socios</th><th>Estado</th><th>Acciones</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < planes.length; i++) html += filaPlan(planes[i]);
    return html + '</tbody></table></div>';
  }

  function panelPlanes() {
    var planes = AG.DB.get('planes').slice();
    planes = U.ordenar(planes, function (p) { return nm(p.precio, 0); }, 'asc');

    var boton = '<button type="button" class="btn btn-primary btn-sm" data-plan-nuevo>' +
      ico('mas', 16) + ' Nuevo plan</button>';

    return '<div class="stack">' +
      kpisPlanes(planes) +
      tarjetaHTML('tarjeta', 'Planes de membresía', tablaPlanes(planes), boton,
        'Precio, vigencia e inscripción de cada membresía que vendes.') +
      '<div class="aviso aviso-info">' + ico('info', 18) +
        '<span>Un plan con socios asignados no se puede borrar: cambiaría su historial de pagos. ' +
        'Si ya no lo vendes, <b>quítalo de la venta</b> con el botón del ojo y deja de aparecer al cobrar.</span></div>' +
    '</div>';
  }

  /* ---------- Formulario de plan ---------- */

  function filaBeneficio(valor) {
    return '<div class="row-sm" data-ben-fila>' +
      '<input type="text" class="input flex1" data-ben maxlength="90" ' +
        'placeholder="Ej. Acceso ilimitado en todo el horario" value="' + esc(valor || '') + '">' +
      '<button type="button" class="btn-icono" data-ben-quitar aria-label="Quitar beneficio" ' +
        'title="Quitar beneficio">' + ico('x', 16) + '</button>' +
    '</div>';
  }

  function formularioPlanHTML(plan) {
    var p = plan || {};
    var beneficios = Object.prototype.toString.call(p.beneficios) === '[object Array]' ? p.beneficios : [];
    var filas = '', i;
    for (i = 0; i < beneficios.length; i++) filas += filaBeneficio(beneficios[i]);
    if (!filas) filas = filaBeneficio('');

    var color = colorSeguro(p.color || U.colorDe(txt(p.nombre) || 'plan'));

    var swatches = '';
    for (i = 0; i < U.PALETA.length; i++) {
      swatches += '<button type="button" class="cfg-swatch" data-color="' + esc(U.PALETA[i]) + '" ' +
        'style="background:' + esc(U.PALETA[i]) + '" title="Usar este color" ' +
        'aria-label="Color ' + (i + 1) + '"></button>';
    }

    return '<form class="stack" data-form-plan novalidate>' +
      '<div class="form-grid dos">' +

        campo('pf-nombre', 'Nombre del plan',
          inputHTML('pf-nombre', 'nombre', 'text', p.nombre, 'maxlength="40" autocomplete="off" placeholder="Mensual"'),
          '', 'ancho-total', true) +

        campo('pf-precio', 'Precio',
          inputHTML('pf-precio', 'precio', 'number', p.precio === undefined ? '' : p.precio, 'min="0" step="10"'),
          'Lo que paga el socio por cada periodo.', '', true) +

        campo('pf-inscripcion', 'Inscripción',
          inputHTML('pf-inscripcion', 'inscripcion', 'number', p.inscripcion === undefined ? '' : p.inscripcion, 'min="0" step="10"'),
          'Cobro único de alta. Deja 0 si no cobras inscripción.') +

        campo('pf-meses', 'Vigencia en meses',
          inputHTML('pf-meses', 'meses', 'number', p.meses === undefined ? '' : p.meses, 'min="0" max="60" step="1"'),
          'Usa 1 para mensual, 3 para trimestral, 12 para anual.') +

        campo('pf-dias', 'Vigencia en días',
          inputHTML('pf-dias', 'dias', 'number', p.dias === undefined ? '' : p.dias, 'min="0" max="730" step="1"'),
          'Solo para pases cortos (visita o semana). Si pusiste meses, deja 0.') +

        campo('pf-descripcion', 'Descripción',
          '<textarea class="textarea" id="pf-descripcion" name="descripcion" rows="2" maxlength="240" ' +
            'placeholder="Para quién es este plan y qué lo hace distinto.">' + esc(p.descripcion || '') + '</textarea>',
          '', 'ancho-total') +

        '<div class="field ancho-total">' +
          '<label class="label">Beneficios incluidos</label>' +
          '<div class="stack-sm" data-ben-lista>' + filas + '</div>' +
          '<div class="row-sm mt-sm">' +
            '<button type="button" class="btn btn-sm btn-outline" data-ben-agregar>' +
              ico('mas', 15) + ' Agregar beneficio</button>' +
          '</div>' +
          '<p class="help">Se muestran al socio en su membresía. Los renglones vacíos se descartan al guardar.</p>' +
        '</div>' +

        '<div class="field ancho-total">' +
          '<label class="label" for="pf-color">Color del plan</label>' +
          '<div class="row row-sm wrap">' +
            '<input class="input" id="pf-color" name="color" type="color" value="' + esc(color) + '" style="max-width:64px">' +
            swatches +
          '</div>' +
          '<p class="help">Identifica al plan en tablas y gráficas.</p>' +
        '</div>' +

        '<div class="field ancho-total">' +
          '<label class="switch"><input type="checkbox" name="activo"' +
            (!plan || p.activo !== false ? ' checked' : '') + '>' +
            '<span>Disponible a la venta</span></label>' +
          '<p class="help">Si lo apagas, el plan deja de ofrecerse al cobrar, pero los socios que ya lo tienen no se ven afectados.</p>' +
        '</div>' +

      '</div>' +
      errorFormHTML('plan') +
    '</form>';
  }

  function leerBeneficios(raiz) {
    var campos = U.$$('[data-ben]', raiz);
    var salida = [];
    for (var i = 0; i < campos.length; i++) {
      var t = txt(campos[i].value);
      if (t) salida.push(t);
    }
    return salida;
  }

  function nombrePlanOcupado(nombre, exceptoId) {
    var buscado = U.normalizar(nombre);
    if (!buscado) return false;
    var repetidos = AG.DB.donde('planes', function (p) {
      return p && p.id !== exceptoId && U.normalizar(p.nombre) === buscado;
    });
    return repetidos.length > 0;
  }

  function guardarPlan(api, plan) {
    var raiz = api.root;
    var form = U.$('[data-form-plan]', raiz);
    if (!form) return false;

    var d = U.formToObject(form);

    var nombre = txt(d.nombre);
    if (!nombre) return fallar(raiz, 'plan', 'Escribe el nombre del plan.', '#pf-nombre');
    if (nombrePlanOcupado(nombre, plan ? plan.id : '')) {
      return fallar(raiz, 'plan', 'Ya existe otro plan con ese nombre.', '#pf-nombre');
    }

    var precio = numOnull(d.precio);
    if (precio === null || precio < 0) {
      return fallar(raiz, 'plan', 'Escribe el precio del plan (0 o más).', '#pf-precio');
    }

    var meses = Math.max(0, ent(d.meses, 0));
    var dias = Math.max(0, ent(d.dias, 0));
    if (meses === 0 && dias === 0) {
      return fallar(raiz, 'plan',
        'Define la vigencia: meses (para membresías) o días (para pases cortos).', '#pf-meses');
    }
    if (meses > 60) return fallar(raiz, 'plan', 'La vigencia en meses no puede pasar de 60.', '#pf-meses');
    if (dias > 730) return fallar(raiz, 'plan', 'La vigencia en días no puede pasar de 730.', '#pf-dias');

    var inscripcion = Math.max(0, nm(d.inscripcion, 0));

    var cambios = {
      nombre: nombre,
      precio: precio,
      meses: meses,
      dias: dias,
      inscripcion: inscripcion,
      descripcion: txt(d.descripcion),
      beneficios: leerBeneficios(raiz),
      color: colorSeguro(d.color),
      activo: d.activo !== false
    };

    if (plan) {
      AG.DB.actualizar('planes', plan.id, cambios);
      toast('Plan «' + cambios.nombre + '» actualizado.', 'ok');
    } else {
      var creado = AG.DB.insertar('planes', cambios);
      if (!creado) return fallar(raiz, 'plan', 'No se pudo crear el plan. Intenta de nuevo.');
      toast('Plan «' + cambios.nombre + '» creado y listo para vender.', 'ok');
    }

    api.cerrar();
    refrescarPantalla();
    return true;
  }

  function formularioPlan(planId) {
    var plan = planId ? AG.DB.plan(planId) : null;
    if (planId && !plan) {
      toast('No encontramos ese plan en la base.', 'error');
      return null;
    }

    return U.modal({
      titulo: plan ? 'Editar plan · ' + txt(plan.nombre) : 'Nuevo plan de membresía',
      ancho: 'lg',
      cuerpo: formularioPlanHTML(plan),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } },
        {
          texto: plan ? 'Guardar cambios' : 'Crear plan',
          clase: 'btn-primary',
          onClick: function (api) { return guardarPlan(api, plan); }
        }
      ],
      onOpen: function (raiz, api) {
        U.delegar(raiz, 'submit', '[data-form-plan]', function (e) {
          e.preventDefault();
          guardarPlan(api, plan);
        });

        U.delegar(raiz, 'click', '[data-ben-agregar]', function () {
          var lista = U.$('[data-ben-lista]', raiz);
          if (!lista) return;
          var envoltorio = document.createElement('div');
          envoltorio.innerHTML = filaBeneficio('');
          var fila = envoltorio.firstChild;
          lista.appendChild(fila);
          var entrada = fila.querySelector('[data-ben]');
          if (entrada) {
            try { entrada.focus(); } catch (e) { /* sin foco disponible */ }
          }
        });

        U.delegar(raiz, 'click', '[data-ben-quitar]', function (e, el) {
          var lista = U.$('[data-ben-lista]', raiz);
          var fila = el.closest('[data-ben-fila]');
          if (!lista || !fila) return;
          if (lista.children.length <= 1) {
            var entrada = fila.querySelector('[data-ben]');
            if (entrada) entrada.value = '';
            return;
          }
          lista.removeChild(fila);
        });

        U.delegar(raiz, 'click', '[data-color]', function (e, el) {
          var entrada = U.$('#pf-color', raiz);
          if (entrada) entrada.value = colorSeguro(el.getAttribute('data-color'));
        });
      }
    });
  }

  /* ---------- Activar / desactivar / eliminar plan ---------- */

  function alternarPlan(planId) {
    var plan = AG.DB.plan(planId);
    if (!plan) { toast('No encontramos ese plan en la base.', 'error'); return; }

    var encender = plan.activo === false;
    AG.DB.actualizar('planes', plan.id, { activo: encender });
    toast(encender
      ? 'El plan «' + plan.nombre + '» vuelve a estar a la venta.'
      : 'El plan «' + plan.nombre + '» ya no se ofrecerá al cobrar.', 'ok');
    refrescarPantalla();
  }

  function eliminarPlan(planId) {
    var plan = AG.DB.plan(planId);
    if (!plan) { toast('No encontramos ese plan en la base.', 'error'); return; }

    var socios = sociosDelPlan(plan.id);

    if (socios.length) {
      var quienes = [];
      for (var i = 0; i < socios.length && i < 5; i++) quienes.push(U.nombreCompleto(socios[i]));
      var resto = socios.length - quienes.length;

      U.modal({
        titulo: 'No se puede eliminar «' + plan.nombre + '»',
        cuerpo: '<div class="stack-sm">' +
          '<div class="aviso aviso-warn">' + ico('alerta', 18) +
            '<span>Hay <b>' + socios.length + (socios.length === 1 ? ' socio</b> con este plan' : ' socios</b> con este plan') +
            '. Si lo borras, su membresía se quedaría sin precio ni vigencia y los recibos ya emitidos perderían su referencia.</span></div>' +
          '<p class="mini muted">' + esc(quienes.join(' · ')) +
            (resto > 0 ? esc(' y ' + resto + (resto === 1 ? ' socio más.' : ' socios más.')) : '') + '</p>' +
          '<div class="aviso aviso-info">' + ico('info', 18) +
            '<span>Lo recomendable es <b>quitarlo de la venta</b>: deja de ofrecerse al cobrar y los socios actuales terminan su periodo sin problema. ' +
            'Cuando ya nadie lo use, podrás eliminarlo.</span></div>' +
        '</div>',
        acciones: [
          { texto: 'Entendido', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } },
          {
            texto: plan.activo === false ? 'Ya está oculto' : 'Quitar de la venta',
            clase: 'btn-primary',
            deshabilitado: plan.activo === false,
            onClick: function (api) { api.cerrar(); alternarPlan(plan.id); }
          }
        ]
      });
      return;
    }

    var pagos = pagosDelPlan(plan.id).length;
    var detalle = pagos
      ? 'Hay ' + pagos + (pagos === 1 ? ' recibo emitido' : ' recibos emitidos') +
        ' con este plan; seguirán guardados, pero ya no mostrarán su nombre.'
      : 'Ningún socio ni recibo lo está usando.';

    U.confirmar(
      '¿Eliminar el plan «' + plan.nombre + '» del catálogo?\nEsta acción no se puede deshacer.',
      'Eliminar plan',
      { peligro: true, textoOk: 'Sí, eliminar', textoCancelar: 'Cancelar', detalle: detalle }
    ).then(function (ok) {
      if (!ok) return;
      if (AG.DB.eliminar('planes', plan.id)) {
        toast('Plan «' + plan.nombre + '» eliminado del catálogo.', 'ok');
        refrescarPantalla();
      } else {
        toast('No se pudo eliminar el plan. Intenta de nuevo.', 'error');
      }
    });
  }

  /* =============================================================
     6. Pestaña USUARIOS
     ============================================================= */

  function fechaAltaDe(u) {
    return txt(u.creado) || txt(u.fechaAlta) || txt(u.fechaContratacion) || '';
  }

  function usuariosFiltrados() {
    var lista = AG.DB.get('usuarios').slice();

    if (estado.rolFiltro) {
      lista = lista.filter(function (u) { return u.rol === estado.rolFiltro; });
    }
    if (estado.estadoFiltro === 'activos') {
      lista = lista.filter(function (u) { return u.activo !== false; });
    } else if (estado.estadoFiltro === 'inactivos') {
      lista = lista.filter(function (u) { return u.activo === false; });
    }

    var busca = U.normalizar(estado.busqueda || '');
    if (busca) {
      lista = lista.filter(function (u) {
        return U.normalizar(U.nombreCompleto(u) + ' ' + (u.email || '') + ' ' +
          (u.codigo || '') + ' ' + (u.telefono || '')).indexOf(busca) >= 0;
      });
    }

    var pesoRol = { director: 0, coach: 1, socio: 2 };
    lista.sort(function (a, b) {
      var pa = pesoRol[a.rol] === undefined ? 3 : pesoRol[a.rol];
      var pb = pesoRol[b.rol] === undefined ? 3 : pesoRol[b.rol];
      if (pa !== pb) return pa - pb;
      var na = U.normalizar(U.nombreCompleto(a));
      var nb = U.normalizar(U.nombreCompleto(b));
      return na < nb ? -1 : (na > nb ? 1 : 0);
    });

    return lista;
  }

  function kpisUsuarios() {
    var todos = AG.DB.get('usuarios');
    var directores = 0, coaches = 0, socios = 0, desactivados = 0;
    for (var i = 0; i < todos.length; i++) {
      var u = todos[i];
      if (u.activo === false) desactivados++;
      if (u.rol === 'director') directores++;
      else if (u.rol === 'coach') coaches++;
      else if (u.rol === 'socio') socios++;
    }
    return '<div class="grid g4">' +
      kpiHTML('escudo', String(directores), 'Cuentas de dirección', 'kpi-info') +
      kpiHTML('coach', String(coaches), 'Coaches', '') +
      kpiHTML('socios', String(socios), 'Socios', 'kpi-ok') +
      kpiHTML('candado', String(desactivados), 'Cuentas desactivadas',
        desactivados > 0 ? 'kpi-warn' : '') +
    '</div>';
  }

  function filaUsuario(u, yo) {
    var info = rolInfo(u.rol);
    var soyYo = !!yo && yo.id === u.id;
    var alta = fechaAltaDe(u);

    return '<tr>' +
      '<td>' +
        '<div class="persona">' + U.avatar(u, 'sm') +
          '<div class="persona-txt">' +
            '<b>' + esc(U.nombreCompleto(u)) + (soyYo ? ' <span class="badge badge-info">Tú</span>' : '') + '</b>' +
            '<span>' + esc(u.email || 'Sin correo') + (u.codigo ? ' · ' + esc(u.codigo) : '') + '</span>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' + U.badge(info.etiqueta, info.badge) + '</td>' +
      '<td>' + (u.activo === false ? U.badge('Desactivado', 'danger') : U.badge('Activo', 'ok')) + '</td>' +
      '<td class="nowrap">' +
        (alta
          ? esc(U.fecha(alta, 'corto')) + '<br><span class="mini muted">' + esc(U.fechaRelativa(alta)) + '</span>'
          : '<span class="muted">Sin registro</span>') +
      '</td>' +
      '<td>' +
        '<div class="row-sm nowrap">' +
          '<button type="button" class="btn-icono" data-usuario-rol="' + esc(u.id) + '" ' +
            'title="Cambiar rol" aria-label="Cambiar rol">' + ico('usuario', 16) + '</button>' +
          '<button type="button" class="btn-icono" data-usuario-estado="' + esc(u.id) + '" ' +
            'title="' + (u.activo === false ? 'Reactivar cuenta' : 'Desactivar cuenta') + '" ' +
            'aria-label="' + (u.activo === false ? 'Reactivar cuenta' : 'Desactivar cuenta') + '">' +
            ico(u.activo === false ? 'check' : 'x', 16) + '</button>' +
          '<button type="button" class="btn-icono" data-usuario-clave="' + esc(u.id) + '" ' +
            'title="Restablecer contraseña" aria-label="Restablecer contraseña">' + ico('candado', 16) + '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  function cuerpoUsuariosHTML() {
    var lista = usuariosFiltrados();
    var yo = usuarioActual();

    if (!lista.length) {
      var hayFiltro = !!(estado.busqueda || estado.rolFiltro || estado.estadoFiltro);
      return vacioHTML('buscar', hayFiltro
        ? 'Ningún usuario coincide con lo que buscas. Cambia el texto o quita los filtros.'
        : 'Todavía no hay usuarios en el sistema.');
    }

    var paginas = Math.max(1, Math.ceil(lista.length / USUARIOS_POR_PAGINA));
    if (estado.pagina > paginas) estado.pagina = paginas;
    if (estado.pagina < 1) estado.pagina = 1;

    var desde = (estado.pagina - 1) * USUARIOS_POR_PAGINA;
    var pagina = lista.slice(desde, desde + USUARIOS_POR_PAGINA);

    var html = '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Alta</th><th>Acciones</th></tr></thead><tbody>';
    for (var i = 0; i < pagina.length; i++) html += filaUsuario(pagina[i], yo);
    html += '</tbody></table></div>';

    html += '<div class="row wrap between mt">' +
      '<span class="mini muted">' +
        esc(lista.length + (lista.length === 1 ? ' usuario' : ' usuarios') +
          (paginas > 1 ? ' · página ' + estado.pagina + ' de ' + paginas : '')) +
      '</span>';

    if (paginas > 1) {
      html += '<div class="row-sm">' +
        '<button type="button" class="btn btn-outline btn-sm" data-pagina="' + (estado.pagina - 1) + '"' +
          (estado.pagina <= 1 ? ' disabled' : '') + '>' + ico('flecha-izq', 15) + ' Anterior</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-pagina="' + (estado.pagina + 1) + '"' +
          (estado.pagina >= paginas ? ' disabled' : '') + '>Siguiente ' + ico('flecha-der', 15) + '</button>' +
      '</div>';
    }

    return html + '</div>';
  }

  function panelUsuarios() {
    var opcionesRol = [{ valor: '', etiqueta: 'Todos los roles' }];
    for (var i = 0; i < ROLES.length; i++) {
      opcionesRol.push({ valor: ROLES[i].valor, etiqueta: ROLES[i].etiqueta });
    }

    var filtros = '<div class="row wrap">' +
      '<div class="field flex1">' +
        '<input class="input" type="search" data-buscar-usuario autocomplete="off" ' +
          'aria-label="Buscar usuario" placeholder="Buscar por nombre, correo o código" value="' +
          esc(estado.busqueda) + '">' +
      '</div>' +
      '<div class="field">' +
        selectHTML('cfg-filtro-rol', 'filtroRol', opcionesRol, estado.rolFiltro,
          'data-rol-filtro aria-label="Filtrar por rol"') +
      '</div>' +
      '<div class="field">' +
        selectHTML('cfg-filtro-estado', 'filtroEstado', [
          { valor: '', etiqueta: 'Activos y desactivados' },
          { valor: 'activos', etiqueta: 'Solo activos' },
          { valor: 'inactivos', etiqueta: 'Solo desactivados' }
        ], estado.estadoFiltro, 'data-estado-filtro aria-label="Filtrar por estado"') +
      '</div>' +
    '</div>';

    var boton = '<button type="button" class="btn btn-primary btn-sm" data-usuario-nuevo>' +
      ico('mas', 16) + ' Nuevo usuario</button>';

    var cuerpo = filtros + '<div data-usuarios-cuerpo>' + cuerpoUsuariosHTML() + '</div>';

    return '<div class="stack">' +
      kpisUsuarios() +
      tarjetaHTML('socios', 'Cuentas del sistema', cuerpo, boton,
        'Quién entra, con qué rol y desde cuándo.') +
      '<div class="aviso aviso-warn">' + ico('candado', 18) +
        '<span>Los socios se dan de alta desde <b>Socios</b>, con su plan y su coach. ' +
        'Aquí se administra el acceso: rol, activación y contraseñas. ' +
        'El sistema no te dejará quedarte sin ninguna cuenta de dirección activa.</span></div>' +
    '</div>';
  }

  function repintarUsuarios(raiz) {
    var caja = raiz.querySelector('[data-usuarios-cuerpo]');
    if (caja) caja.innerHTML = cuerpoUsuariosHTML();
  }

  /* ---------- Cambiar rol ---------- */

  /** Completa los campos mínimos que necesita un socio para no romper otras pantallas. */
  function completarComoSocio(u) {
    var cambios = {};
    if (!txt(u.codigo)) cambios.codigo = siguienteCodigoSocio();
    if (!txt(u.fechaAlta)) cambios.fechaAlta = U.hoy();
    if (!txt(u.estado)) cambios.estado = 'activo';
    if (!txt(u.objetivo)) cambios.objetivo = 'salud';
    if (!txt(u.nivel)) cambios.nivel = 'principiante';
    if (!txt(u.nivelActividad)) cambios.nivelActividad = 'ligero';
    if (u.coachId === undefined) cambios.coachId = null;
    if (!txt(u.planId)) {
      var activos = AG.DB.donde('planes', function (p) { return p && p.activo !== false; });
      var elegido = U.ordenar(activos, function (p) { return nm(p.precio, 0); }, 'asc')[0];
      cambios.planId = elegido ? elegido.id : '';
    }
    if (!u.contactoEmergencia || typeof u.contactoEmergencia !== 'object') {
      cambios.contactoEmergencia = { nombre: '', telefono: '', parentesco: '' };
    }
    if (u.padecimientos === undefined) cambios.padecimientos = '';
    if (u.alergias === undefined) cambios.alergias = '';
    return cambios;
  }

  function aplicarCambioRol(u, nuevoRol) {
    var cambios = { rol: nuevoRol };

    if (nuevoRol === 'socio') {
      var extra = completarComoSocio(u);
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) cambios[k] = extra[k];
      }
    }
    if (nuevoRol === 'coach') {
      if (!txt(u.fechaContratacion)) cambios.fechaContratacion = U.hoy();
      if (Object.prototype.toString.call(u.certificaciones) !== '[object Array]') cambios.certificaciones = [];
      if (u.especialidad === undefined) cambios.especialidad = '';
      if (u.bio === undefined) cambios.bio = '';
      if (u.cupoMaximo === undefined) cambios.cupoMaximo = 0;
      if (u.sueldo === undefined) cambios.sueldo = 0;
    }

    AG.DB.actualizar('usuarios', u.id, cambios);

    if (nuevoRol === 'socio') {
      try { AG.DB.recalcularEstadoSocios(); } catch (e) { /* la base ya avisó si falló */ }
    }

    AG.DB.notificar(u.id, {
      titulo: 'Tu acceso cambió',
      cuerpo: 'Dirección actualizó tu rol en el sistema a «' + rolInfo(nuevoRol).etiqueta + '».',
      tipo: 'sistema',
      link: '#/' + (AG.Router.inicioDe(nuevoRol) || '')
    });

    toast(U.nombreCompleto(u) + ' ahora es ' + rolInfo(nuevoRol).etiqueta.toLowerCase() + '.', 'ok');
    refrescarPantalla();
  }

  function cambiarRol(usuarioId) {
    var u = AG.DB.usuario(usuarioId);
    if (!u) { toast('No encontramos a ese usuario en la base.', 'error'); return; }

    var yo = usuarioActual();
    if (yo && yo.id === u.id) {
      toast('No puedes cambiar tu propio rol: perderías el acceso a esta pantalla. Pídeselo a otra cuenta de dirección.', 'warn');
      return;
    }

    var tarjetas = '', i;
    for (i = 0; i < ROLES.length; i++) {
      var r = ROLES[i];
      tarjetas += '<label class="radio-card' + (r.valor === u.rol ? ' on' : '') + '" data-tarjeta-rol="' + esc(r.valor) + '">' +
        '<input type="radio" name="rol" value="' + esc(r.valor) + '"' + (r.valor === u.rol ? ' checked' : '') + '>' +
        ico(r.icono, 22) +
        '<b>' + esc(r.etiqueta) + '</b>' +
        '<span>' + esc(r.ayuda) + '</span>' +
      '</label>';
    }

    var advertencias = '';
    if (u.rol === 'socio') {
      var pagos = AG.DB.pagosDe(u.id).length;
      var mediciones = AG.DB.medicionesDe(u.id).length;
      if (pagos || mediciones) {
        advertencias += '<div class="aviso aviso-warn">' + ico('alerta', 18) +
          '<span>Este socio tiene <b>' + pagos + '</b> ' + (pagos === 1 ? 'pago' : 'pagos') +
          ' y <b>' + mediciones + '</b> ' + (mediciones === 1 ? 'medición' : 'mediciones') + ' guardados. ' +
          'Nada se borra, pero dejará de verlos mientras no sea socio.</span></div>';
      }
    }
    if (u.rol === 'coach') {
      var asignados = AG.DB.sociosDe(u.id).length;
      if (asignados) {
        advertencias += '<div class="aviso aviso-warn">' + ico('alerta', 18) +
          '<span>Tiene <b>' + asignados + '</b> ' + (asignados === 1 ? 'socio asignado' : 'socios asignados') +
          '. Reasígnalos a otro coach desde <b>Coaches</b> antes de dejarlo sin ese rol.</span></div>';
      }
    }

    U.modal({
      titulo: 'Cambiar rol · ' + U.nombreCompleto(u),
      ancho: 'lg',
      cuerpo: '<div class="stack-sm" data-cambio-rol>' +
        '<p class="mini muted">Rol actual: <b>' + esc(rolInfo(u.rol).etiqueta) + '</b>. ' +
          'Elige el nuevo rol; el cambio se aplica en cuanto confirmas.</p>' +
        '<div class="radio-cards tres">' + tarjetas + '</div>' +
        advertencias +
        errorFormHTML('rol') +
      '</div>',
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } },
        {
          texto: 'Cambiar rol',
          clase: 'btn-primary',
          onClick: function (api) {
            var raiz = api.root;
            var marcado = U.$('[name="rol"]:checked', raiz);
            var nuevoRol = marcado ? marcado.value : '';

            if (!nuevoRol) return fallar(raiz, 'rol', 'Elige el rol que tendrá esta persona.');
            if (nuevoRol === u.rol) return fallar(raiz, 'rol', 'Esa persona ya tiene ese rol.');

            if (u.rol === 'director' && directoresActivos().length <= 1 && u.activo !== false) {
              return fallar(raiz, 'rol',
                'Es la única cuenta de dirección activa. Crea o activa otra antes de quitarle el rol.');
            }

            api.cerrar();
            U.confirmar(
              '¿Cambiar a ' + U.nombreCompleto(u) + ' de ' + rolInfo(u.rol).etiqueta.toLowerCase() +
                ' a ' + rolInfo(nuevoRol).etiqueta.toLowerCase() + '?',
              'Confirmar cambio de rol',
              {
                textoOk: 'Sí, cambiar rol',
                textoCancelar: 'Cancelar',
                detalle: nuevoRol === 'director'
                  ? 'Tendrá acceso completo al sistema, incluidas finanzas y esta configuración.'
                  : 'Su menú y sus permisos cambian la próxima vez que entre.'
              }
            ).then(function (ok) {
              if (ok) aplicarCambioRol(u, nuevoRol);
            });
            return true;
          }
        }
      ],
      onOpen: function (raiz) {
        U.delegar(raiz, 'change', '[name="rol"]', function (e, el) {
          var tarjetasRol = U.$$('[data-tarjeta-rol]', raiz);
          for (var j = 0; j < tarjetasRol.length; j++) {
            tarjetasRol[j].classList.toggle('on', tarjetasRol[j].getAttribute('data-tarjeta-rol') === el.value);
          }
        });
      }
    });
  }

  /* ---------- Activar / desactivar cuenta ---------- */

  function alternarUsuario(usuarioId) {
    var u = AG.DB.usuario(usuarioId);
    if (!u) { toast('No encontramos a ese usuario en la base.', 'error'); return; }

    var yo = usuarioActual();
    var encender = u.activo === false;

    if (!encender) {
      if (yo && yo.id === u.id) {
        toast('No puedes desactivar tu propia cuenta: cerrarías tu acceso al sistema.', 'warn');
        return;
      }
      if (u.rol === 'director' && directoresActivos().length <= 1) {
        toast('Es la única cuenta de dirección activa. Activa otra antes de desactivar esta.', 'warn');
        return;
      }
    }

    if (encender) {
      AG.DB.actualizar('usuarios', u.id, { activo: true });
      toast(U.nombreCompleto(u) + ' vuelve a tener acceso al sistema.', 'ok');
      refrescarPantalla();
      return;
    }

    var detalle = 'Sus datos, pagos e historial se conservan; solo deja de poder entrar.';
    if (u.rol === 'coach') {
      var asignados = AG.DB.sociosDe(u.id).length;
      if (asignados) {
        detalle = 'Tiene ' + asignados + (asignados === 1 ? ' socio asignado' : ' socios asignados') +
          '; seguirán en su lista hasta que los reasignes desde Coaches.';
      }
    }

    U.confirmar(
      '¿Desactivar la cuenta de ' + U.nombreCompleto(u) + '?\nNo podrá iniciar sesión hasta que la reactives.',
      'Desactivar cuenta',
      { peligro: true, textoOk: 'Sí, desactivar', textoCancelar: 'Cancelar', detalle: detalle }
    ).then(function (ok) {
      if (!ok) return;
      AG.DB.actualizar('usuarios', u.id, { activo: false });
      toast(U.nombreCompleto(u) + ' quedó sin acceso al sistema.', 'ok');
      refrescarPantalla();
    });
  }

  /* ---------- Restablecer contraseña ---------- */

  function mostrarClave(u, clave) {
    U.modal({
      titulo: 'Contraseña temporal',
      cuerpo: '<div class="stack-sm">' +
        '<p class="mini muted">Entrégasela a <b>' + esc(U.nombreCompleto(u)) + '</b> ' +
          '(' + esc(u.email || 'sin correo') + ') y pídele que la cambie desde su perfil en cuanto entre.</p>' +
        '<div class="cfg-clave mono" data-clave>' + esc(clave) + '</div>' +
        '<div class="aviso aviso-warn">' + ico('alerta', 18) +
          '<span>Esta es la única vez que se muestra completa. <b>Cópiala antes de cerrar</b>: ' +
          'después tendrías que generar otra.</span></div>' +
      '</div>',
      acciones: [
        {
          texto: 'Copiar contraseña',
          clase: 'btn-outline',
          onClick: function () {
            U.copiar(clave).then(function () {
              toast('Contraseña copiada al portapapeles.', 'ok');
            }, function () {
              toast('Este navegador no dejó copiar. Selecciónala y cópiala a mano.', 'warn');
            });
            return false;      /* el modal se queda abierto */
          }
        },
        { texto: 'Listo', clase: 'btn-primary', onClick: function (api) { api.cerrar(); } }
      ]
    });
  }

  function restablecerPassword(usuarioId) {
    var u = AG.DB.usuario(usuarioId);
    if (!u) { toast('No encontramos a ese usuario en la base.', 'error'); return; }

    var yo = usuarioActual();
    var detalle = (yo && yo.id === u.id)
      ? 'Es tu propia cuenta: tendrás que entrar con la contraseña temporal la próxima vez.'
      : 'La contraseña anterior deja de funcionar de inmediato.';

    U.confirmar(
      '¿Generar una contraseña temporal para ' + U.nombreCompleto(u) + '?',
      'Restablecer contraseña',
      { textoOk: 'Sí, generar', textoCancelar: 'Cancelar', detalle: detalle }
    ).then(function (ok) {
      if (!ok) return;

      var clave = claveTemporal();
      var guardado = AG.DB.actualizar('usuarios', u.id, { password: clave });
      if (!guardado) { toast('No se pudo restablecer la contraseña. Intenta de nuevo.', 'error'); return; }

      AG.DB.notificar(u.id, {
        titulo: 'Tu contraseña fue restablecida',
        cuerpo: 'Dirección generó una contraseña temporal para tu cuenta. Pídela en recepción y cámbiala desde tu perfil.',
        tipo: 'sistema',
        link: ''
      });

      mostrarClave(u, clave);
    });
  }

  /* ---------- Alta de usuario (dirección o coach) ---------- */

  function formularioUsuarioHTML() {
    var tarjetas = '', i;
    for (i = 0; i < ROLES.length; i++) {
      if (ROLES[i].valor === 'socio') continue;           /* los socios se dan de alta en Socios */
      var r = ROLES[i];
      tarjetas += '<label class="radio-card' + (r.valor === 'coach' ? ' on' : '') + '" data-tarjeta-nuevo="' + esc(r.valor) + '">' +
        '<input type="radio" name="rol" value="' + esc(r.valor) + '"' + (r.valor === 'coach' ? ' checked' : '') + '>' +
        ico(r.icono, 22) +
        '<b>' + esc(r.etiqueta) + '</b>' +
        '<span>' + esc(r.ayuda) + '</span>' +
      '</label>';
    }

    return '<form class="stack" data-form-usuario novalidate>' +
      '<div class="field">' +
        '<label class="label">Rol de la cuenta <span class="req">*</span></label>' +
        '<div class="radio-cards dos">' + tarjetas + '</div>' +
        '<p class="help">Para dar de alta un socio usa la pantalla <b>Socios</b>: ahí se captura su plan, su coach y su expediente.</p>' +
      '</div>' +
      '<div class="form-grid dos">' +
        campo('uf-nombre', 'Nombre(s)',
          inputHTML('uf-nombre', 'nombre', 'text', '', 'maxlength="60" autocomplete="off"'), '', '', true) +
        campo('uf-apellidos', 'Apellidos',
          inputHTML('uf-apellidos', 'apellidos', 'text', '', 'maxlength="60" autocomplete="off"'), '', '', true) +
        campo('uf-email', 'Correo electrónico',
          inputHTML('uf-email', 'email', 'email', '', 'maxlength="90" autocomplete="off"'),
          'Es el usuario con el que entra al sistema. No puede repetirse.', '', true) +
        campo('uf-telefono', 'Teléfono',
          inputHTML('uf-telefono', 'telefono', 'tel', '', 'maxlength="24" autocomplete="off" placeholder="33 1234 5678"')) +
        campo('uf-especialidad', 'Especialidad',
          inputHTML('uf-especialidad', 'especialidad', 'text', '', 'maxlength="70" autocomplete="off" placeholder="Ej. Fuerza e hipertrofia"'),
          'Solo se guarda si la cuenta es de coach.', 'ancho-total') +
        '<div class="field ancho-total">' +
          '<label class="label" for="uf-password">Contraseña de acceso <span class="req">*</span></label>' +
          '<div class="row-sm">' +
            '<input class="input flex1 mono" id="uf-password" name="password" type="text" maxlength="40" ' +
              'autocomplete="new-password" placeholder="Mínimo 5 caracteres" value="">' +
            '<button type="button" class="btn btn-outline btn-sm" data-generar-clave>Generar</button>' +
          '</div>' +
          '<p class="help">Se la entregas a la persona para su primer acceso; después la cambia desde su perfil.</p>' +
        '</div>' +
        '<div class="field ancho-total">' +
          '<label class="switch"><input type="checkbox" name="activo" checked>' +
            '<span>Puede iniciar sesión desde ahora</span></label>' +
        '</div>' +
      '</div>' +
      errorFormHTML('usuario') +
    '</form>';
  }

  function guardarUsuario(api) {
    var raiz = api.root;
    var form = U.$('[data-form-usuario]', raiz);
    if (!form) return false;

    var d = U.formToObject(form);

    var rol = txt(d.rol);
    if (rol !== 'director' && rol !== 'coach') {
      return fallar(raiz, 'usuario', 'Elige si la cuenta será de dirección o de coach.');
    }

    var nombre = txt(d.nombre);
    var apellidos = txt(d.apellidos);
    var email = txt(d.email).toLowerCase();
    var password = txt(d.password);

    if (!nombre) return fallar(raiz, 'usuario', 'Escribe el nombre de la persona.', '#uf-nombre');
    if (!apellidos) return fallar(raiz, 'usuario', 'Escribe los apellidos de la persona.', '#uf-apellidos');
    if (!email) return fallar(raiz, 'usuario', 'El correo es obligatorio: es su usuario de acceso.', '#uf-email');
    if (!RE_EMAIL.test(email)) return fallar(raiz, 'usuario', 'Ese correo no tiene un formato válido.', '#uf-email');
    if (correoOcupado(email, '')) return fallar(raiz, 'usuario', 'Ya existe una cuenta con ese correo.', '#uf-email');
    if (password.length < 5) {
      return fallar(raiz, 'usuario', 'La contraseña debe tener al menos 5 caracteres.', '#uf-password');
    }

    var nuevo = {
      rol: rol,
      nombre: nombre,
      apellidos: apellidos,
      email: email,
      telefono: txt(d.telefono),
      password: password,
      activo: d.activo !== false,
      creado: U.hoy(),
      avatarColor: U.colorDe(nombre + ' ' + apellidos + ' ' + email),
      notas: ''
    };

    if (rol === 'coach') {
      nuevo.especialidad = txt(d.especialidad);
      nuevo.bio = '';
      nuevo.certificaciones = [];
      nuevo.fechaContratacion = U.hoy();
      nuevo.sueldo = 0;
      nuevo.cupoMaximo = 0;
      nuevo.horario = '';
    }

    var guardado = AG.DB.insertar('usuarios', nuevo);
    if (!guardado) return fallar(raiz, 'usuario', 'No se pudo crear la cuenta. Intenta de nuevo.');

    api.cerrar();
    toast(nombre + ' ' + apellidos + ' ya puede entrar como ' + rolInfo(rol).etiqueta.toLowerCase() + '.', 'ok');
    refrescarPantalla();
    return true;
  }

  function formularioUsuario() {
    return U.modal({
      titulo: 'Nueva cuenta de acceso',
      ancho: 'lg',
      cuerpo: formularioUsuarioHTML(),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } },
        { texto: 'Crear cuenta', clase: 'btn-primary', onClick: function (api) { return guardarUsuario(api); } }
      ],
      onOpen: function (raiz, api) {
        U.delegar(raiz, 'submit', '[data-form-usuario]', function (e) {
          e.preventDefault();
          guardarUsuario(api);
        });

        U.delegar(raiz, 'change', '[name="rol"]', function (e, el) {
          var tarjetas = U.$$('[data-tarjeta-nuevo]', raiz);
          for (var i = 0; i < tarjetas.length; i++) {
            tarjetas[i].classList.toggle('on', tarjetas[i].getAttribute('data-tarjeta-nuevo') === el.value);
          }
        });

        U.delegar(raiz, 'click', '[data-generar-clave]', function () {
          var entrada = U.$('#uf-password', raiz);
          if (!entrada) return;
          entrada.value = claveTemporal();
          try { entrada.focus(); entrada.select(); } catch (e) { /* sin foco disponible */ }
          toast('Contraseña sugerida lista. Cópiala antes de guardar.', 'info');
        });
      }
    });
  }

  /* =============================================================
     7. Pestaña DATOS
     ============================================================= */

  /** Peso aproximado en KB de una colección. */
  function kbDe(valor) {
    var bytes = 0;
    try { bytes = JSON.stringify(valor).length; } catch (e) { bytes = 0; }
    return Math.round(bytes / 102.4) / 10;
  }

  function filasColecciones() {
    var filas = [];
    for (var i = 0; i < COLECCIONES.length; i++) {
      var c = COLECCIONES[i];
      var lista = AG.DB.get(c.clave);
      filas.push({
        clave: c.clave,
        etiqueta: c.etiqueta,
        icono: c.icono,
        registros: lista.length,
        kb: kbDe(lista)
      });
    }
    return filas;
  }

  function tablaColecciones(filas) {
    var totalRegistros = 0, totalKb = 0, i;
    for (i = 0; i < filas.length; i++) {
      totalRegistros += filas[i].registros;
      totalKb += filas[i].kb;
    }

    var html = '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr><th>Colección</th><th>Registros</th><th>Tamaño aprox.</th></tr></thead><tbody>';

    for (i = 0; i < filas.length; i++) {
      var f = filas[i];
      html += '<tr>' +
        '<td><div class="row-sm">' + ico(f.icono, 16) + '<span>' + esc(f.etiqueta) + '</span></div></td>' +
        '<td class="nums nowrap">' + (f.registros ? esc(U.num(f.registros, 0)) : '<span class="muted">0</span>') + '</td>' +
        '<td class="nums nowrap">' + esc(U.num(f.kb, 1)) + ' KB</td>' +
      '</tr>';
    }

    html += '<tr>' +
      '<td><b>Total</b></td>' +
      '<td class="nums nowrap"><b>' + esc(U.num(totalRegistros, 0)) + '</b></td>' +
      '<td class="nums nowrap"><b>' + esc(U.num(Math.round(totalKb * 10) / 10, 1)) + ' KB</b></td>' +
    '</tr>';

    return html + '</tbody></table></div>';
  }

  function graficaColecciones(filas) {
    if (!AG.Charts || typeof AG.Charts.barras !== 'function') return '';
    var datos = [];
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].registros > 0) {
        datos.push({
          etiqueta: filas[i].etiqueta,
          valor: filas[i].registros,
          color: U.PALETA[i % U.PALETA.length]
        });
      }
    }
    if (!datos.length) return '';
    datos.sort(function (a, b) { return b.valor - a.valor; });
    try {
      return AG.Charts.barras(datos.slice(0, 8), { horizontal: true, alto: 270, anchoEtiquetas: 170 });
    } catch (e) { return ''; }
  }

  function panelDatos() {
    var stats = null;
    try { stats = AG.DB.estadisticas(); } catch (e) { stats = null; }

    var filas = filasColecciones();
    var almacenOk = true;
    try { almacenOk = AG.DB.almacenDisponible() !== false; } catch (e) { almacenOk = true; }

    var actualizado = stats && stats.actualizado ? stats.actualizado : '';

    var kpis = '<div class="grid g4">' +
      kpiHTML('reporte', stats ? U.num(stats.total, 0) : '—', 'Registros guardados', '') +
      kpiHTML('balanza', stats ? U.num(stats.kb, 1) + ' KB' : '—', 'Tamaño de la base', 'kpi-info') +
      kpiHTML('socios', stats ? U.num(stats.socios, 0) : '—', 'Socios en la base', 'kpi-ok') +
      kpiHTML('historial', actualizado ? U.fechaRelativa(actualizado) : 'Sin cambios',
        'Última escritura', almacenOk ? '' : 'kpi-error') +
    '</div>';

    var avisoAlmacen = almacenOk ? '' :
      '<div class="aviso aviso-error">' + ico('alerta', 18) +
        '<span>Este navegador <b>no está guardando</b> los cambios (modo privado o almacenamiento bloqueado). ' +
        'Todo lo que hagas se perderá al cerrar la pestaña. Exporta un respaldo antes de salir.</span></div>';

    var grafica = graficaColecciones(filas);

    /* La gráfica solo en pantallas grandes: en móvil las etiquetas quedarían ilegibles. */
    var contenido = tablaColecciones(filas) +
      (grafica ? '<div class="mt solo-escritorio">' + grafica + '</div>' : '') +
      '<p class="mini muted mt">Versión de la base: ' +
        esc(String(stats && stats.version ? stats.version : AG.DB.VERSION)) +
        ' · Siguiente folio de recibo: ' + esc('REC-' + rellenar(stats && stats.folioPago ? stats.folioPago : 1, 6)) +
        (actualizado ? ' · Última escritura: ' + esc(U.fecha(actualizado, 'completo')) : '') + '</p>';

    var respaldo = '<div class="stack-sm">' +
      '<p class="mini muted">El respaldo es un archivo <b>.json</b> con absolutamente todo: usuarios, socios, ' +
        'pagos, mediciones, rutinas, nutrición, clases y configuración.</p>' +
      '<div class="row-sm wrap">' +
        '<button type="button" class="btn btn-primary" data-exportar>' +
          ico('descargar', 16) + ' Exportar respaldo</button>' +
      '</div>' +
    '</div>';

    var importar = '<div class="stack-sm">' +
      '<div class="cfg-zona" data-zona>' +
        ico('subir', 34) +
        '<p class="mt-sm mb-sm">Arrastra aquí tu archivo <b>.json</b> de respaldo</p>' +
        '<button type="button" class="btn btn-outline btn-sm" data-elegir-archivo>Elegir archivo</button>' +
        '<input type="file" class="oculto" data-archivo accept=".json,application/json" ' +
          'aria-label="Archivo de respaldo">' +
      '</div>' +
      '<div class="aviso aviso-error">' + ico('alerta', 18) +
        '<span>Importar <b>reemplaza TODOS los datos actuales</b>: socios, pagos, mediciones y usuarios. ' +
        'Exporta un respaldo antes por si acaso.</span></div>' +
    '</div>';

    var reinicio = '<div class="stack-sm">' +
      '<p class="mini muted">Borra todo lo que hay ahora y vuelve a sembrar el gimnasio de demostración: ' +
        '5 coaches, ~45 socios y ocho meses de historial. Sirve para practicar o para volver a empezar de cero.</p>' +
      '<div class="row-sm wrap">' +
        '<button type="button" class="btn btn-danger" data-reiniciar>' +
          ico('alerta', 16) + ' Reiniciar datos de demostración</button>' +
      '</div>' +
    '</div>';

    return '<div class="stack">' +
      kpis +
      avisoAlmacen +
      tarjetaHTML('reporte', 'Contenido de la base', contenido, '',
        'Cuántos registros guarda el sistema y cuánto ocupan.') +
      '<div class="grid g2">' +
        tarjetaHTML('descargar', 'Respaldo', respaldo, '', 'Descarga una copia completa.') +
        tarjetaHTML('subir', 'Restaurar desde un respaldo', importar, '', 'Reemplaza todo con un archivo.') +
      '</div>' +
      tarjetaHTML('historial', 'Reiniciar datos de demostración', reinicio, '',
        'Vuelve el sistema a su estado de fábrica.') +
      '<div class="aviso aviso-info">' + ico('info', 18) +
        '<span><b>Tus datos viven en este navegador, en esta computadora.</b> No hay servidor ni nube: ' +
        'si borras el historial y los datos de navegación, cambias de navegador o usas una ventana privada, ' +
        'el sistema arrancará vacío. Por eso conviene <b>exportar un respaldo cada semana</b> y guardarlo ' +
        'en una carpeta segura o en tu correo. ' +
        'Para llevar el gimnasio a otra computadora: exporta el respaldo aquí, copia el archivo .json, ' +
        'abre el sistema en la otra máquina, entra con una cuenta de dirección y usa ' +
        '<b>Restaurar desde un respaldo</b>.</span></div>' +
    '</div>';
  }

  /* ---------- Importar ---------- */

  function pedirImportacion(archivo) {
    if (!archivo) return;

    var nombre = txt(archivo.name) || 'respaldo.json';
    if (!/\.json$/i.test(nombre) && txt(archivo.type) !== 'application/json') {
      toast('El respaldo debe ser un archivo .json exportado por este sistema.', 'error');
      return;
    }

    var pesoKb = archivo.size ? Math.round(archivo.size / 102.4) / 10 : 0;

    U.confirmar(
      'Vas a reemplazar TODOS los datos actuales con el contenido de «' + nombre + '».\n' +
        'Socios, pagos, mediciones, rutinas y usuarios se sustituyen por los del respaldo.',
      'Restaurar respaldo',
      {
        peligro: true,
        textoOk: 'Sí, reemplazar todo',
        textoCancelar: 'Mejor no',
        detalle: 'Archivo: ' + nombre + (pesoKb ? ' · ' + U.num(pesoKb, 1) + ' KB' : '') +
          '. Al terminar, la aplicación se recarga.'
      }
    ).then(function (ok) {
      if (!ok) return;
      AG.DB.importar(archivo).then(function (bien) {
        if (!bien) return;                 /* AG.DB ya explicó el motivo */
        toast('Respaldo restaurado. Recargando el sistema…', 'ok');
        setTimeout(recargar, 900);
      }, function () {
        toast('No se pudo leer el archivo de respaldo.', 'error');
      });
    });
  }

  /* ---------- Reiniciar ---------- */

  function ejecutarReinicio(api) {
    var ok = false;
    try { ok = AG.DB.reiniciar(); } catch (e) { ok = false; }

    if (api && typeof api.cerrar === 'function') api.cerrar();

    if (!ok) {
      toast('No se pudieron regenerar los datos de demostración.', 'error');
      return true;
    }
    toast('Datos de demostración restaurados. Recargando el sistema…', 'ok');
    setTimeout(recargar, 900);
    return true;
  }

  function pedirPalabraReinicio() {
    U.modal({
      titulo: 'Confirmación final',
      cuerpo: '<div class="stack-sm">' +
        '<div class="aviso aviso-error">' + ico('alerta', 18) +
          '<span>Esto <b>borra</b> los socios, pagos, mediciones, rutinas y usuarios que tengas hoy ' +
          'y siembra de nuevo el gimnasio de demostración. No hay vuelta atrás.</span></div>' +
        '<div class="field">' +
          '<label class="label" for="cfg-palabra">Escribe <b>REINICIAR</b> para confirmar</label>' +
          '<input class="input mono" id="cfg-palabra" data-palabra autocomplete="off" ' +
            'placeholder="REINICIAR" maxlength="12">' +
          '<p class="help">Es una medida de seguridad: solo se activa el botón cuando la palabra coincide.</p>' +
        '</div>' +
      '</div>',
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: function (api) { api.cerrar(); } },
        { texto: 'Sí, reiniciar', clase: 'btn-danger', onClick: function (api) { return ejecutarReinicio(api); } }
      ],
      onOpen: function (raiz, api) {
        var entrada = raiz.querySelector('[data-palabra]');
        var boton = raiz.querySelector('.modal-foot .btn-danger');
        if (boton) boton.disabled = true;
        if (!entrada) return;

        function coincide() {
          return U.normalizar(entrada.value) === 'reiniciar';
        }
        entrada.addEventListener('input', function () {
          if (boton) boton.disabled = !coincide();
        });
        entrada.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.keyCode === 13) && coincide()) {
            e.preventDefault();
            ejecutarReinicio(api);
          }
        });
        try { entrada.focus(); } catch (e) { /* sin foco disponible */ }
      }
    });
  }

  function reiniciarDemo() {
    U.confirmar(
      'Se borrarán TODOS los datos actuales y el sistema volverá a los datos de demostración.\n' +
        'Esta acción no se puede deshacer.',
      'Reiniciar datos de demostración',
      {
        peligro: true,
        textoOk: 'Continuar',
        textoCancelar: 'Cancelar',
        detalle: 'Si todavía no tienes respaldo, cancela y usa primero «Exportar respaldo».'
      }
    ).then(function (ok) {
      if (ok) pedirPalabraReinicio();
    });
  }

  /* =============================================================
     8. Pestaña APARIENCIA
     ============================================================= */

  var COLORES_MARCA = [
    { variable: '--rojo', nombre: 'Rojo Alliance', uso: 'Acciones y acentos' },
    { variable: '--carbon', nombre: 'Carbón', uso: 'Fondo general' },
    { variable: '--panel', nombre: 'Panel', uso: 'Tarjetas y formularios' },
    { variable: '--ok', nombre: 'Éxito', uso: 'Al corriente, mejoras' },
    { variable: '--warn', nombre: 'Alerta', uso: 'Por vencer, pendientes' },
    { variable: '--error', nombre: 'Error', uso: 'Vencidos, riesgos' },
    { variable: '--info', nombre: 'Información', uso: 'Datos neutros' }
  ];

  function tarjetaTema(valor, etiqueta, descripcion, iconoNombre, actual) {
    return '<label class="radio-card' + (actual === valor ? ' on' : '') + '" data-tarjeta-tema="' + esc(valor) + '">' +
      '<input type="radio" name="tema" value="' + esc(valor) + '"' + (actual === valor ? ' checked' : '') + '>' +
      ico(iconoNombre, 22) +
      '<b>' + esc(etiqueta) + '</b>' +
      '<span>' + esc(descripcion) + '</span>' +
    '</label>';
  }

  function panelApariencia() {
    var s = ajustes();
    var tema = s.tema === 'claro' ? 'claro' : 'oscuro';

    var selector = '<div class="stack-sm">' +
      '<div class="radio-cards dos">' +
        tarjetaTema('oscuro', 'Oscuro', 'El look de casa: fondo carbón y rojo Alliance. Descansa la vista en el gimnasio.', 'luna', tema) +
        tarjetaTema('claro', 'Claro', 'Fondo claro, ideal para recepción con mucha luz y para imprimir pantallas.', 'sol', tema) +
      '</div>' +
      '<p class="mini muted">El cambio se ve al instante y queda guardado para la próxima vez que entres. ' +
        'También puedes cambiarlo con el botón de sol/luna de la barra superior.</p>' +
    '</div>';

    var muestras = '<div class="cfg-colores">';
    for (var i = 0; i < COLORES_MARCA.length; i++) {
      var c = COLORES_MARCA[i];
      muestras += '<div class="cfg-color">' +
        '<div class="cfg-color-muestra" style="background:var(' + c.variable + ')"></div>' +
        '<div class="cfg-color-txt">' +
          '<b class="mini">' + esc(c.nombre) + '</b>' +
          '<div class="micro muted">' + esc(c.uso) + '</div>' +
        '</div>' +
      '</div>';
    }
    muestras += '</div>';

    var identidad = '<div class="stack-sm">' +
      '<div class="cfg-marca">' +
        '<div class="cfg-marca-escudo">' + ico('escudo', 24) + '</div>' +
        '<div class="cfg-marca-txt">' +
          '<b>' + esc(s.nombreGym || 'ALLIANCE GYM') + '</b>' +
          '<span class="mini muted">' + esc(s.lema || 'Sin lema definido') + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="mini muted">Así se ve tu marca en el menú lateral. El nombre y el lema se editan en la pestaña ' +
        '<b>Gimnasio</b>; el escudo y la paleta son parte de la identidad visual del sistema.</p>' +
      muestras +
      '<div class="aviso aviso-rojo">' + ico('escudo', 18) +
        '<span>El rojo Alliance y el negro carbón son la identidad de la marca: se mantienen iguales en los dos temas ' +
        'para que recibos, pantallas e impresiones se reconozcan siempre como del gimnasio. ' +
        'Si algún día quieres otra paleta, se cambia en <b>css/styles.css</b>, no aquí.</span></div>' +
    '</div>';

    return '<div class="stack">' +
      tarjetaHTML('sol', 'Tema de la aplicación', selector, '', 'Elige cómo se ve el sistema en esta computadora.') +
      tarjetaHTML('escudo', 'Identidad visual', identidad, '', 'Marca, colores y su uso en el sistema.') +
    '</div>';
  }

  function sincronizarBotonTema(tema) {
    var btn = document.getElementById('btn-tema');
    if (!btn) return;
    try { btn.innerHTML = Icons.get(tema === 'claro' ? 'luna' : 'sol', 20); }
    catch (e) { /* el botón se queda con su icono anterior */ }
  }

  function aplicarTema(tema, raiz) {
    var valor = (tema === 'claro') ? 'claro' : 'oscuro';

    var s = ajustes();
    s.tema = valor;
    AG.DB.guardar();

    if (AG.App && typeof AG.App.aplicarTema === 'function') AG.App.aplicarTema(valor);
    else document.documentElement.setAttribute('data-tema', valor);

    sincronizarBotonTema(valor);

    if (raiz) {
      var tarjetas = U.$$('[data-tarjeta-tema]', raiz);
      for (var i = 0; i < tarjetas.length; i++) {
        tarjetas[i].classList.toggle('on', tarjetas[i].getAttribute('data-tarjeta-tema') === valor);
      }
    }

    toast(valor === 'claro' ? 'Tema claro activado.' : 'Tema oscuro activado.', 'ok');
  }

  /* =============================================================
     9. Armado de la pantalla
     ============================================================= */

  function panelHTML(tab) {
    if (tab === 'planes') return panelPlanes();
    if (tab === 'usuarios') return panelUsuarios();
    if (tab === 'datos') return panelDatos();
    if (tab === 'apariencia') return panelApariencia();
    return panelGimnasio();
  }

  function tabsHTML(tab) {
    var html = '<div class="tabs" role="tablist">';
    for (var i = 0; i < TABS.length; i++) {
      var t = TABS[i];
      var activa = t.clave === tab;
      html += '<button type="button" class="tab' + (activa ? ' active' : '') + '" ' +
        'data-tab="' + esc(t.clave) + '" role="tab" aria-selected="' + (activa ? 'true' : 'false') + '">' +
        ico(t.icono, 16) + '<span>' + esc(t.etiqueta) + '</span></button>';
    }
    return html + '</div>';
  }

  function paginaSinAcceso() {
    return '<div class="page">' +
      '<div class="card"><div class="card-body">' +
        '<div class="empty">' +
          '<div class="empty-icono">' + ico('candado', 34) + '</div>' +
          '<h2 class="page-title">Configuración reservada a dirección</h2>' +
          '<p class="empty-texto">Esta pantalla cambia los datos de todo el gimnasio, así que solo la ve dirección. ' +
            'Si necesitas algo de aquí, pídeselo a tu director.</p>' +
        '</div>' +
      '</div></div>' +
    '</div>';
  }

  function repintarPanel(raiz) {
    var panel = raiz.querySelector('[data-panel]');
    if (panel) panel.innerHTML = panelHTML(estado.tab);
  }

  function render(ctx) {
    var usuario = (ctx && ctx.usuario) ? ctx.usuario : usuarioActual();

    if (!esDirector(usuario)) {
      return { html: paginaSinAcceso(), listo: function () { /* nada que enganchar */ } };
    }

    asegurarEstilos();

    /* Un parámetro '?tab=planes' permite entrar directo a una pestaña.
       Solo se atiende cuando cambia: así un repintado no deshace lo que eligió el usuario. */
    var pedida = (ctx && ctx.params && ctx.params.tab) ? String(ctx.params.tab) : '';
    if (pedida && pedida !== tabDeLaURL) {
      for (var i = 0; i < TABS.length; i++) {
        if (TABS[i].clave === pedida) estado.tab = pedida;
      }
    }
    tabDeLaURL = pedida;

    var s = ajustes();

    var html = '<div class="page" data-config>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + ico('config', 24) + '<span>Configuración</span></h1>' +
          '<p class="page-sub">Los datos de ' + esc(s.nombreGym || 'tu gimnasio') +
            ', el catálogo de planes, quién entra al sistema y el respaldo de la información.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-outline" data-exportar>' +
            ico('descargar', 16) + ' Exportar respaldo</button>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-body">' + tabsHTML(estado.tab) + '</div></div>' +
      '<div data-panel>' + panelHTML(estado.tab) + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root); }
    };
  }

  /* =============================================================
     10. Delegación de eventos
     ============================================================= */

  function enganchar(root) {
    var raiz = root.querySelector('[data-config]');
    if (!raiz) return;
    asegurarEstilos();

    /* ---------- Pestañas ---------- */
    U.delegar(raiz, 'click', '[data-tab]', function (e, el) {
      e.preventDefault();
      var destino = el.getAttribute('data-tab');
      if (!destino || destino === estado.tab) return;
      estado.tab = destino;

      var botones = U.$$('[data-tab]', raiz);
      for (var i = 0; i < botones.length; i++) {
        var activa = botones[i].getAttribute('data-tab') === destino;
        botones[i].classList.toggle('active', activa);
        botones[i].setAttribute('aria-selected', activa ? 'true' : 'false');
      }
      repintarPanel(raiz);

      /* La dirección refleja la pestaña, así se puede compartir el enlace. */
      tabDeLaURL = destino;
      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', '#/director/config?tab=' + encodeURIComponent(destino));
        }
      } catch (err) { /* file:// puede bloquearlo: la pestaña ya cambió igual */ }
    });

    /* ---------- Gimnasio ---------- */
    U.delegar(raiz, 'submit', '[data-form-gimnasio]', function (e) {
      e.preventDefault();
      guardarGimnasio(raiz);
    });

    U.delegar(raiz, 'click', '[data-guardar-gimnasio]', function (e) {
      e.preventDefault();
      guardarGimnasio(raiz);
    });

    U.delegar(raiz, 'click', '[data-gimnasio-deshacer]', function (e) {
      e.preventDefault();
      repintarPanel(raiz);
      toast('Se restauraron los valores guardados.', 'info');
    });

    /* Al elegir moneda se sugiere su símbolo si el actual es el de otra moneda. */
    U.delegar(raiz, 'change', '[data-moneda]', function (e, el) {
      var entrada = U.$('[data-simbolo]', raiz);
      if (!entrada) return;
      var actual = txt(entrada.value);
      var sugerido = '';
      var conocidoPrevio = false;
      for (var i = 0; i < MONEDAS.length; i++) {
        if (MONEDAS[i].codigo === el.value) sugerido = MONEDAS[i].simbolo;
        if (MONEDAS[i].simbolo === actual) conocidoPrevio = true;
      }
      if (sugerido && (!actual || conocidoPrevio)) entrada.value = sugerido;
    });

    /* ---------- Planes ---------- */
    U.delegar(raiz, 'click', '[data-plan-nuevo]', function (e) {
      e.preventDefault();
      formularioPlan(null);
    });

    U.delegar(raiz, 'click', '[data-plan-editar]', function (e, el) {
      e.preventDefault();
      formularioPlan(el.getAttribute('data-plan-editar'));
    });

    U.delegar(raiz, 'click', '[data-plan-activo]', function (e, el) {
      e.preventDefault();
      alternarPlan(el.getAttribute('data-plan-activo'));
    });

    U.delegar(raiz, 'click', '[data-plan-eliminar]', function (e, el) {
      e.preventDefault();
      eliminarPlan(el.getAttribute('data-plan-eliminar'));
    });

    /* ---------- Usuarios ---------- */
    var buscarConRetraso = U.debounce(function () {
      estado.pagina = 1;
      repintarUsuarios(raiz);
    }, 220);

    U.delegar(raiz, 'input', '[data-buscar-usuario]', function (e, el) {
      estado.busqueda = el.value || '';
      buscarConRetraso();
    });

    U.delegar(raiz, 'change', '[data-rol-filtro]', function (e, el) {
      estado.rolFiltro = el.value || '';
      estado.pagina = 1;
      repintarUsuarios(raiz);
    });

    U.delegar(raiz, 'change', '[data-estado-filtro]', function (e, el) {
      estado.estadoFiltro = el.value || '';
      estado.pagina = 1;
      repintarUsuarios(raiz);
    });

    U.delegar(raiz, 'click', '[data-pagina]', function (e, el) {
      e.preventDefault();
      var destino = ent(el.getAttribute('data-pagina'), 1);
      if (destino < 1) destino = 1;
      estado.pagina = destino;
      repintarUsuarios(raiz);
    });

    U.delegar(raiz, 'click', '[data-usuario-nuevo]', function (e) {
      e.preventDefault();
      formularioUsuario();
    });

    U.delegar(raiz, 'click', '[data-usuario-rol]', function (e, el) {
      e.preventDefault();
      cambiarRol(el.getAttribute('data-usuario-rol'));
    });

    U.delegar(raiz, 'click', '[data-usuario-estado]', function (e, el) {
      e.preventDefault();
      alternarUsuario(el.getAttribute('data-usuario-estado'));
    });

    U.delegar(raiz, 'click', '[data-usuario-clave]', function (e, el) {
      e.preventDefault();
      restablecerPassword(el.getAttribute('data-usuario-clave'));
    });

    /* ---------- Datos ---------- */
    U.delegar(raiz, 'click', '[data-exportar]', function (e) {
      e.preventDefault();
      try { AG.DB.exportar(); }
      catch (err) { toast('No se pudo preparar el respaldo.', 'error'); }
    });

    U.delegar(raiz, 'click', '[data-elegir-archivo]', function (e) {
      e.preventDefault();
      var entrada = U.$('[data-archivo]', raiz);
      if (entrada) entrada.click();
    });

    U.delegar(raiz, 'change', '[data-archivo]', function (e, el) {
      var archivo = (el.files && el.files.length) ? el.files[0] : null;
      el.value = '';                       /* permite volver a elegir el mismo archivo */
      pedirImportacion(archivo);
    });

    U.delegar(raiz, 'dragenter', '[data-zona]', function (e, el) {
      e.preventDefault();
      el.classList.add('encima');
    });

    U.delegar(raiz, 'dragover', '[data-zona]', function (e, el) {
      e.preventDefault();
      try { if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }
      catch (err) { /* algunos navegadores no lo permiten */ }
      el.classList.add('encima');
    });

    U.delegar(raiz, 'dragleave', '[data-zona]', function (e, el) {
      var hacia = e.relatedTarget;
      if (hacia && el.contains(hacia)) return;    /* sigue dentro de la zona */
      el.classList.remove('encima');
    });

    U.delegar(raiz, 'drop', '[data-zona]', function (e, el) {
      e.preventDefault();
      el.classList.remove('encima');
      var archivos = e.dataTransfer ? e.dataTransfer.files : null;
      if (!archivos || !archivos.length) {
        toast('No recibimos ningún archivo. Vuelve a arrastrarlo o usa «Elegir archivo».', 'warn');
        return;
      }
      pedirImportacion(archivos[0]);
    });

    U.delegar(raiz, 'click', '[data-reiniciar]', function (e) {
      e.preventDefault();
      reiniciarDemo();
    });

    /* ---------- Apariencia ---------- */
    U.delegar(raiz, 'change', '[name="tema"]', function (e, el) {
      aplicarTema(el.value, raiz);
    });
  }

  /* =============================================================
     11. Exposición y registro de la ruta
     ============================================================= */

  AG.Mod.Config = {
    render: render,
    formularioPlan: formularioPlan,
    formularioUsuario: formularioUsuario,
    restablecerPassword: restablecerPassword,
    aplicarTema: function (tema) { aplicarTema(tema, null); },
    irA: function (tab) {
      for (var i = 0; i < TABS.length; i++) {
        if (TABS[i].clave === tab) { estado.tab = tab; break; }
      }
      AG.Router.ir('director/config');
    }
  };

  AG.Router.registrar({
    path: 'director/config',
    roles: ['director'],
    titulo: 'Configuración',
    nav: { etiqueta: 'Configuración', icono: 'config', grupo: 'Sistema', orden: 1 },
    render: render
  });
})(window.AG);
