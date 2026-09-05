/* =============================================================
   ALLIANCE GYM — AG.Views.SocioPerfil
   -------------------------------------------------------------
   "Mi perfil": la pantalla donde el socio manda sobre su propia
   información. Encabezado con avatar y color, sus datos, su
   objetivo, su información de salud, su acceso, sus preferencias,
   la descarga de su información y el resumen de todo lo que
   lleva hecho en Alliance Gym.

   Ruta: 'socio/perfil'   (solo rol 'socio')

   Control de acceso: el socio SOLO toca su propio expediente.
   Todo lo que se lee de la base pasa por AG.Utils.esc().

   Reglas del proyecto: JavaScript clásico (sin módulos, sin npm,
   sin CDN), todo en español, nada de alert/confirm/prompt y
   ningún acceso directo a localStorage.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;
  var Icons = AG.Icons;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Pestañas de la pantalla (el contenido se pinta completo y se
     muestra/oculta, así nadie pierde lo que estaba escribiendo). */
  var TABS = [
    { clave: 'datos', etiqueta: 'Mis datos', icono: 'usuario' },
    { clave: 'objetivo', etiqueta: 'Mi objetivo', icono: 'meta' },
    { clave: 'salud', etiqueta: 'Salud', icono: 'corazon' },
    { clave: 'acceso', etiqueta: 'Acceso', icono: 'candado' },
    { clave: 'preferencias', etiqueta: 'Preferencias', icono: 'config' },
    { clave: 'resumen', etiqueta: 'Mi resumen', icono: 'trofeo' }
  ];

  /* Objetivo del socio: la dirección que toma su comparativo mensual. */
  var OBJETIVOS = [
    { v: 'perder_grasa', t: 'Perder grasa', icono: 'fuego',
      d: 'Bajar tu porcentaje de grasa cuidando el músculo que ya tienes.' },
    { v: 'ganar_musculo', t: 'Ganar músculo', icono: 'pesa',
      d: 'Sumar masa muscular con un superávit de calorías controlado.' },
    { v: 'mantener', t: 'Mantener', icono: 'balanza',
      d: 'Sostener tu composición actual y no perder lo ganado.' },
    { v: 'rendimiento', t: 'Rendimiento', icono: 'rayo',
      d: 'Más fuerza, potencia y resistencia en cada sesión.' },
    { v: 'salud', t: 'Salud general', icono: 'corazon',
      d: 'Bienestar, energía y hábitos sostenibles todo el año.' }
  ];

  /* Nivel de entrenamiento: define qué rutinas te propone tu coach. */
  var NIVELES = [
    { v: 'principiante', t: 'Principiante', icono: 'meta',
      d: 'Menos de 6 meses entrenando con constancia.' },
    { v: 'intermedio', t: 'Intermedio', icono: 'grafica',
      d: 'De 6 meses a 2 años, con técnica ya sólida.' },
    { v: 'avanzado', t: 'Avanzado', icono: 'trofeo',
      d: 'Más de 2 años progresando con cargas altas.' }
  ];

  /* Nivel de actividad: multiplica tu gasto calórico en la calculadora. */
  var ACTIVIDADES = [
    { v: 'sedentario', t: 'Sedentario', icono: 'sueno',
      d: 'Trabajo de escritorio y poco o nada de ejercicio.' },
    { v: 'ligero', t: 'Ligero', icono: 'gota',
      d: 'Te mueves o entrenas de 1 a 3 días por semana.' },
    { v: 'moderado', t: 'Moderado', icono: 'mancuerna',
      d: 'Entrenas de 3 a 5 días por semana.' },
    { v: 'alto', t: 'Alto', icono: 'fuego',
      d: 'Entrenas de 6 a 7 días por semana.' },
    { v: 'atleta', t: 'Atleta', icono: 'rayo',
      d: 'Doble sesión al día o trabajo físico pesado.' }
  ];

  var SEXOS = [
    { v: 'H', t: 'Hombre' },
    { v: 'M', t: 'Mujer' }
  ];

  var TEMAS = [
    { v: 'oscuro', t: 'Oscuro', icono: 'luna', d: 'Descansa la vista de noche y en el gimnasio.' },
    { v: 'claro', t: 'Claro', icono: 'sol', d: 'Más contraste con luz de día o al imprimir.' }
  ];

  /* Recordatorios que el socio puede encender o apagar. */
  var RECORDATORIOS = [
    { v: 'pago', t: 'Mi pago está por vencer', d: 'Te avisamos antes de que se corte tu acceso.' },
    { v: 'medicion', t: 'Toca medición', d: 'Al abrir y al cerrar el mes con tu coach.' },
    { v: 'rutina', t: 'Cambios en mi rutina', d: 'Cuando tu coach te asigna o ajusta el plan.' },
    { v: 'nutricion', t: 'Cambios en mi nutrición', d: 'Cuando actualizan tu plan alimenticio.' },
    { v: 'clase', t: 'Mis clases', d: 'Recordatorio de las clases en las que estás inscrito.' },
    { v: 'aviso', t: 'Avisos del gimnasio', d: 'Horarios especiales, mantenimiento y noticias.' }
  ];

  /* Estado vivo de la pantalla: sobrevive a los repintados del router. */
  var estado = { tab: 'datos' };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) {
    try { U.toast(mensaje, tipo || 'info'); } catch (e) { /* la app sigue */ }
  }

  /* Texto limpio (nunca null ni undefined). */
  function txt(v) {
    return (v === null || v === undefined) ? '' : String(v).trim();
  }

  /* Número finito o null (nunca NaN, nunca cadena vacía). */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  function soloDigitos(v) {
    return txt(v).replace(/\D+/g, '');
  }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  /* Un correo con forma razonable (sin inventar reglas imposibles). */
  function correoValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(txt(email));
  }

  /* ¿Ese correo ya lo usa otra cuenta del sistema? */
  function correoOcupado(email, exceptoId) {
    var correo = txt(email).toLowerCase();
    if (!correo) return false;
    var repetidos = AG.DB.donde('usuarios', function (u) {
      return u && u.id !== exceptoId && txt(u.email).toLowerCase() === correo;
    });
    return repetidos.length > 0;
  }

  /* Etiqueta legible de una lista { v, t }. */
  function etiquetaDe(lista, valor) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].v === valor) return lista[i].t;
    }
    return '';
  }

  /* El socio vivo de la base (nunca una copia suelta). */
  function socioDe(usuario) {
    if (!usuario || !usuario.id) return null;
    var s = AG.DB.usuario(usuario.id);
    return s || usuario;
  }

  /* Preferencias del socio con valores por defecto sensatos. */
  function preferenciasDe(socio) {
    var p = (socio && socio.preferencias && typeof socio.preferencias === 'object') ? socio.preferencias : {};
    var lista = esArreglo(p.recordatorios) ? p.recordatorios : null;
    if (!lista) {
      /* Quien nunca eligió, los recibe todos: mejor de más que de menos. */
      lista = [];
      for (var i = 0; i < RECORDATORIOS.length; i++) lista.push(RECORDATORIOS[i].v);
    }
    return { recordatorios: lista };
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-perfil';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.pf-head{display:flex;align-items:center;gap:18px;flex-wrap:wrap}' +
      '.pf-avatar{display:flex;flex-direction:column;align-items:center;gap:8px;flex:0 0 auto}' +
      '.pf-id{min-width:0;flex:1 1 210px;display:flex;flex-direction:column;gap:6px}' +
      '.pf-id h1{margin:0}' +
      '.pf-colores{display:flex;flex-wrap:wrap;gap:8px;max-width:230px}' +
      '.pf-color{width:26px;height:26px;border-radius:50%;padding:0;cursor:pointer;' +
        'border:2px solid transparent;box-shadow:0 0 0 1px var(--borde-2);' +
        'transition:transform var(--trans),box-shadow var(--trans)}' +
      '.pf-color:hover{transform:scale(1.14)}' +
      '.pf-color.on{border-color:var(--texto);box-shadow:0 0 0 3px rgba(var(--rojo-rgb),.32)}' +
      '.pf-reglas{margin:0;padding-left:17px;font-size:11.5px;color:var(--texto-3);line-height:1.65}' +
      '.pf-reglas b{color:var(--texto-2)}' +
      '.pf-checks{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}' +
      '.pf-check{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;min-width:0;' +
        'border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2)}' +
      '.pf-check .check{align-items:flex-start}' +
      '.pf-check-txt{display:flex;flex-direction:column;gap:2px;min-width:0}' +
      '.pf-check-txt b{font-size:13px;color:var(--texto);font-weight:700;line-height:1.3}' +
      '.pf-check-txt span{font-size:11.5px;color:var(--texto-3);line-height:1.4}' +
      '.pf-fijo{display:flex;align-items:center;min-height:40px;color:var(--texto-2)}' +
      '.pf-mejor{display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
      '.pf-mejor-txt{min-width:0;flex:1 1 220px}' +
      '.pf-page .input.error,.pf-page .select.error,.pf-page .textarea.error{border-color:var(--error)}' +
      '@media (max-width:520px){' +
        '.pf-head{gap:12px}' +
        '.pf-colores{max-width:none}' +
        '.pf-checks{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function vacioHTML(iconoNombre, mensaje) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre || 'info', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
    '</div>';
  }

  function avisoHTML(tipo, iconoNombre, html) {
    return '<div class="aviso aviso-' + esc(tipo) + '">' + icono(iconoNombre, 18) +
      '<div>' + html + '</div></div>';
  }

  function tarjeta(titulo, iconoNombre, subtitulo, cuerpo, atributos) {
    return '<div class="card"' + (atributos ? ' ' + atributos : '') + '>' +
      '<div class="card-head">' +
        '<div>' +
          '<h2 class="card-title">' + icono(iconoNombre, 18) + '<span>' + esc(titulo) + '</span></h2>' +
          (subtitulo ? '<p class="card-sub">' + esc(subtitulo) + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  function campo(nombre, etiqueta, control, ayuda, claseExtra) {
    return '<div class="field' + (claseExtra ? ' ' + claseExtra : '') + '">' +
      '<label class="label" for="pf-' + esc(nombre) + '">' + esc(etiqueta) + '</label>' +
      control +
      '<p class="help" data-error="' + esc(nombre) + '" data-ayuda="' + esc(ayuda || '') + '">' +
        esc(ayuda || '') + '</p>' +
    '</div>';
  }

  function entrada(nombre, tipo, valor, atributos) {
    return '<input id="pf-' + esc(nombre) + '" name="' + esc(nombre) + '" class="input" type="' + esc(tipo) + '"' +
      ' value="' + esc(valor === null || valor === undefined ? '' : valor) + '"' +
      (atributos ? ' ' + atributos : '') + '>';
  }

  function areaTexto(nombre, valor, filas, atributos) {
    return '<textarea id="pf-' + esc(nombre) + '" name="' + esc(nombre) + '" class="textarea" rows="' +
      (filas || 3) + '"' + (atributos ? ' ' + atributos : '') + '>' +
      esc(valor === null || valor === undefined ? '' : valor) + '</textarea>';
  }

  function opciones(lista, seleccionado) {
    var html = '';
    for (var i = 0; i < lista.length; i++) {
      var sel = String(lista[i].v) === String(seleccionado === null || seleccionado === undefined ? '' : seleccionado);
      html += '<option value="' + esc(lista[i].v) + '"' + (sel ? ' selected' : '') + '>' + esc(lista[i].t) + '</option>';
    }
    return html;
  }

  function seleccion(nombre, lista, valor) {
    return '<select id="pf-' + esc(nombre) + '" name="' + esc(nombre) + '" class="select">' +
      opciones(lista, valor) + '</select>';
  }

  /* Grupo de .radio-cards con una explicación de una línea por opción. */
  function tarjetasRadio(nombre, lista, valor, porDefecto) {
    var elegido = valor;
    var existe = false, i;
    for (i = 0; i < lista.length; i++) if (lista[i].v === elegido) existe = true;
    if (!existe) elegido = porDefecto;

    var html = '<div class="radio-cards" data-grupo="' + esc(nombre) + '">';
    for (i = 0; i < lista.length; i++) {
      var o = lista[i];
      var marcado = (o.v === elegido);
      html += '<label class="radio-card' + (marcado ? ' on' : '') + '" data-opcion="' + esc(o.v) + '">' +
        '<input type="radio" name="' + esc(nombre) + '" value="' + esc(o.v) + '"' + (marcado ? ' checked' : '') + '>' +
        icono(o.icono || 'info', 22) +
        '<b>' + esc(o.t) + '</b>' +
        '<span>' + esc(o.d || '') + '</span>' +
      '</label>';
    }
    return html + '</div><p class="help" data-error="' + esc(nombre) + '" data-ayuda=""></p>';
  }

  function kpiHTML(iconoNombre, valor, etiqueta, extra) {
    return '<div class="kpi">' +
      '<div class="kpi-icono">' + icono(iconoNombre, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        (extra ? '<div class="mini muted">' + esc(extra) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function botonGuardar(texto) {
    return '<button type="submit" class="btn btn-primary">' + icono('check', 16) + ' ' + esc(texto) + '</button>';
  }

  /* =============================================================
     4. Validación de formularios
     ============================================================= */

  function limpiarErrores(form) {
    var ayudas = U.$$('[data-error]', form), i;
    for (i = 0; i < ayudas.length; i++) {
      ayudas[i].classList.remove('error');
      ayudas[i].textContent = ayudas[i].getAttribute('data-ayuda') || '';
    }
    var campos = U.$$('.input, .select, .textarea', form);
    for (i = 0; i < campos.length; i++) campos[i].classList.remove('error');
  }

  function marcarError(form, nombre, mensaje) {
    var ayuda = form.querySelector('[data-error="' + nombre + '"]');
    if (ayuda) {
      ayuda.classList.add('error');
      ayuda.textContent = mensaje;
    }
    var control = form.querySelector('[name="' + nombre + '"]');
    if (control && control.classList) control.classList.add('error');
    return control;
  }

  /* Marca el error, enfoca el campo y avisa. Siempre devuelve false. */
  function fallar(form, nombre, mensaje) {
    var control = marcarError(form, nombre, mensaje);
    if (control && typeof control.focus === 'function') {
      try { control.focus(); } catch (e) { /* el campo puede estar oculto */ }
    }
    toast(mensaje, 'error');
    return false;
  }

  /* =============================================================
     5. Encabezado (avatar, color, identidad)
     ============================================================= */

  function colorActual(socio) {
    return socio.avatarColor || U.colorDe(U.nombreCompleto(socio) + (socio.id || ''));
  }

  function coloresHTML(socio) {
    var actual = String(colorActual(socio)).toLowerCase();
    var html = '';
    for (var i = 0; i < U.PALETA.length; i++) {
      var c = U.PALETA[i];
      var activo = String(c).toLowerCase() === actual;
      html += '<button type="button" class="pf-color' + (activo ? ' on' : '') + '"' +
        ' data-color="' + esc(c) + '" style="background:' + esc(c) + '"' +
        ' aria-pressed="' + (activo ? 'true' : 'false') + '"' +
        ' title="Usar este color en mi avatar" aria-label="Color ' + (i + 1) + ' de 12"></button>';
    }
    return '<div class="pf-colores" data-colores>' + html + '</div>';
  }

  function encabezadoHTML(socio) {
    var plan = AG.DB.plan(socio.planId);
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    if (coach && coach.rol !== 'coach') coach = null;

    var membresia = Calc.estadoMembresia(socio);

    var etiquetas =
      U.badge(socio.codigo || 'Sin código', 'muted') +
      U.badge(plan ? plan.nombre : 'Sin plan asignado', plan ? 'info' : 'muted') +
      '<span class="badge ' + esc(membresia.clase) + '">' + esc(membresia.texto) + '</span>';

    return '<div class="card" data-encabezado>' +
      '<div class="card-body">' +
        '<div class="pf-head">' +
          '<div class="pf-avatar">' +
            '<div data-avatar>' + U.avatar(socio, 'xl') + '</div>' +
          '</div>' +
          '<div class="pf-id">' +
            '<h1 class="page-title">' + esc(U.nombreCompleto(socio) || 'Sin nombre') + '</h1>' +
            '<p class="page-sub">' +
              (coach
                ? 'Tu coach es ' + esc(U.nombreCompleto(coach))
                : 'Todavía no tienes coach asignado; pídelo en recepción.') +
            '</p>' +
            '<div class="row wrap row-sm">' + etiquetas + '</div>' +
          '</div>' +
          '<div class="field">' +
            '<span class="label">Color de mi avatar</span>' +
            coloresHTML(socio) +
            '<p class="help">Elige entre 12 colores; se aplica al instante en todo el sistema.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Repinta el encabezado sin tocar los formularios abiertos. */
  function refrescarEncabezado(raiz, socio) {
    var caja = raiz.querySelector('[data-encabezado]');
    if (!caja) return;
    var nuevo = document.createElement('div');
    nuevo.innerHTML = encabezadoHTML(socio);
    var reemplazo = nuevo.firstChild;
    if (reemplazo && caja.parentNode) caja.parentNode.replaceChild(reemplazo, caja);
  }

  /* El avatar del socio también vive en la barra lateral y en la topbar. */
  function refrescarShell(socio) {
    try {
      var lateral = document.querySelector('.sidebar-user');
      if (lateral) {
        var viejo = lateral.querySelector('.avatar');
        if (viejo) {
          var caja = document.createElement('div');
          caja.innerHTML = U.avatar(socio);
          if (caja.firstChild) lateral.replaceChild(caja.firstChild, viejo);
        }
        var nombre = lateral.querySelector('.su-txt b');
        if (nombre) nombre.textContent = U.nombreCompleto(socio);
      }
      var arriba = document.querySelector('.topbar-user');
      if (arriba) arriba.innerHTML = U.avatar(socio, 'sm');
    } catch (e) { /* el shell puede no estar montado (impresión, pruebas) */ }
  }

  /* =============================================================
     6. Pestaña "Mis datos"
     ============================================================= */

  function textoEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 'Se calcula sola';
    var anios = U.edad(fechaNacimiento);
    if (!anios) return 'Revisa la fecha';
    return anios + (anios === 1 ? ' año' : ' años');
  }

  function panelDatosHTML(socio) {
    var formulario =
      '<form data-form="datos" autocomplete="off" novalidate>' +
        '<div class="form-grid">' +
          campo('nombre', 'Nombre(s)',
            entrada('nombre', 'text', socio.nombre, 'maxlength="60" autocomplete="given-name"')) +
          campo('apellidos', 'Apellidos',
            entrada('apellidos', 'text', socio.apellidos, 'maxlength="60" autocomplete="family-name"')) +
          campo('telefono', 'Teléfono',
            entrada('telefono', 'tel', socio.telefono, 'maxlength="20" inputmode="tel" autocomplete="tel"'),
            'A 10 dígitos, por si necesitamos localizarte.') +
          campo('email', 'Correo electrónico',
            entrada('email', 'email', socio.email, 'maxlength="80" inputmode="email" autocomplete="email"'),
            'Con este correo entras al sistema: no puede repetirse.') +
          campo('fechaNacimiento', 'Fecha de nacimiento',
            entrada('fechaNacimiento', 'date', socio.fechaNacimiento, 'max="' + esc(U.hoy()) + '"'),
            'La usamos para tu edad, tus zonas cardiacas y tu calculadora.') +
          '<div class="field">' +
            '<span class="label">Edad</span>' +
            '<div class="input pf-fijo" data-edad>' + esc(textoEdad(socio.fechaNacimiento)) + '</div>' +
            '<p class="help">Se actualiza sola al cambiar tu fecha.</p>' +
          '</div>' +
          campo('sexo', 'Sexo',
            seleccion('sexo', SEXOS, socio.sexo === 'M' ? 'M' : 'H'),
            'Cambia las fórmulas de grasa corporal y calorías.') +
          campo('estaturaCm', 'Estatura (cm)',
            entrada('estaturaCm', 'number', socio.estaturaCm,
              'min="120" max="230" step="0.5" inputmode="decimal"'),
            'Entre 120 y 230 cm.') +
        '</div>' +
        '<div class="row between wrap mt">' +
          '<span class="mini muted">Tu código de socio y tu plan los administra recepción.</span>' +
          botonGuardar('Guardar mis datos') +
        '</div>' +
      '</form>';

    var descarga =
      '<p class="mini muted">' +
        'Te llevas un archivo JSON con tu perfil, tus pagos, tus mediciones, tus bitácoras de ' +
        'entrenamiento, tu plan de nutrición y las calificaciones que has dado. Tu contraseña nunca se incluye.' +
      '</p>' +
      '<div class="row wrap mt">' +
        '<button type="button" class="btn btn-outline" data-descargar>' +
          icono('descargar', 16) + ' Descargar mi información</button>' +
      '</div>';

    return '<section data-panel="datos" class="stack">' +
      tarjeta('Mis datos', 'usuario', 'Manténlos al día: de aquí salen tus cálculos y tus recibos.', formulario) +
      tarjeta('Descargar mi información', 'descargar', 'Toda tu información en un solo archivo.', descarga) +
    '</section>';
  }

  function guardarDatos(form, socio, raiz) {
    limpiarErrores(form);
    var d = U.formToObject(form);

    var nombre = txt(d.nombre);
    var apellidos = txt(d.apellidos);
    var telefono = txt(d.telefono);
    var email = txt(d.email);
    var nacimiento = txt(d.fechaNacimiento);
    var sexo = (d.sexo === 'M') ? 'M' : 'H';
    var estatura = n0(d.estaturaCm);

    if (!nombre) return fallar(form, 'nombre', 'Escribe tu nombre.');
    if (nombre.length > 60) return fallar(form, 'nombre', 'Tu nombre no puede pasar de 60 caracteres.');
    if (!apellidos) return fallar(form, 'apellidos', 'Escribe tus apellidos.');

    if (telefono) {
      var digitos = soloDigitos(telefono);
      if (digitos.length < 10) return fallar(form, 'telefono', 'El teléfono debe tener 10 dígitos.');
      if (digitos.length > 15) return fallar(form, 'telefono', 'Ese teléfono tiene demasiados dígitos.');
    }

    if (!email) return fallar(form, 'email', 'Escribe tu correo: con él entras al sistema.');
    if (!correoValido(email)) return fallar(form, 'email', 'Ese correo no tiene un formato válido.');
    if (correoOcupado(email, socio.id)) return fallar(form, 'email', 'Ya existe otra cuenta con ese correo.');

    if (nacimiento) {
      if (nacimiento > U.hoy()) return fallar(form, 'fechaNacimiento', 'Tu fecha de nacimiento no puede ser futura.');
      var anios = U.edad(nacimiento);
      if (anios < 10 || anios > 100) {
        return fallar(form, 'fechaNacimiento', 'Revisa la fecha: la edad resultante no es posible.');
      }
    }

    if (estatura !== null && (estatura < 120 || estatura > 230)) {
      return fallar(form, 'estaturaCm', 'La estatura debe estar entre 120 y 230 cm.');
    }

    AG.DB.actualizar('usuarios', socio.id, {
      nombre: nombre,
      apellidos: apellidos,
      telefono: telefono,
      email: email,
      fechaNacimiento: nacimiento,
      sexo: sexo,
      estaturaCm: estatura
    });

    var actualizado = socioDe(socio);
    refrescarEncabezado(raiz, actualizado);
    refrescarShell(actualizado);
    toast('Tus datos quedaron guardados.', 'ok');
    return true;
  }

  /* =============================================================
     7. Pestaña "Mi objetivo"
     ============================================================= */

  function panelObjetivoHTML(socio) {
    var formulario =
      '<form data-form="objetivo" novalidate>' +
        '<div class="field">' +
          '<span class="label">¿Qué buscas ahora mismo?</span>' +
          tarjetasRadio('objetivo', OBJETIVOS, socio.objetivo, 'salud') +
        '</div>' +
        '<div class="field mt">' +
          '<span class="label">Mi nivel de entrenamiento</span>' +
          tarjetasRadio('nivel', NIVELES, socio.nivel, 'principiante') +
        '</div>' +
        '<div class="field mt">' +
          '<span class="label">Mi nivel de actividad diaria</span>' +
          tarjetasRadio('nivelActividad', ACTIVIDADES, socio.nivelActividad, 'ligero') +
        '</div>' +
        '<div class="mt">' +
          avisoHTML('info', 'info',
            '<b>Al cambiar tu objetivo</b>, tu comparativo mensual se vuelve a evaluar con la nueva ' +
            'dirección (bajar grasa no se juzga igual que subir músculo) y tu calculadora recalcula ' +
            'calorías y macros. Además le avisamos a tu coach para que ajuste tu plan.') +
        '</div>' +
        '<div class="row between wrap mt">' +
          '<span class="mini muted">Puedes cambiarlo las veces que necesites.</span>' +
          botonGuardar('Guardar mi objetivo') +
        '</div>' +
      '</form>';

    return '<section data-panel="objetivo" class="stack oculto">' +
      tarjeta('Mi objetivo', 'meta', 'Es la brújula de tu rutina, tu nutrición y tu comparativo.', formulario) +
    '</section>';
  }

  function guardarObjetivo(form, socio, raiz) {
    limpiarErrores(form);
    var d = U.formToObject(form);

    var objetivo = txt(d.objetivo);
    var nivel = txt(d.nivel);
    var actividad = txt(d.nivelActividad);

    if (!etiquetaDe(OBJETIVOS, objetivo)) return fallar(form, 'objetivo', 'Elige uno de los cinco objetivos.');
    if (!etiquetaDe(NIVELES, nivel)) return fallar(form, 'nivel', 'Elige tu nivel de entrenamiento.');
    if (!etiquetaDe(ACTIVIDADES, actividad)) return fallar(form, 'nivelActividad', 'Elige tu nivel de actividad.');

    var cambioObjetivo = (objetivo !== socio.objetivo);
    var anterior = etiquetaDe(OBJETIVOS, socio.objetivo);

    AG.DB.actualizar('usuarios', socio.id, {
      objetivo: objetivo,
      nivel: nivel,
      nivelActividad: actividad
    });

    var actualizado = socioDe(socio);
    refrescarEncabezado(raiz, actualizado);

    if (!cambioObjetivo) {
      toast('Tu nivel y tu actividad quedaron guardados.', 'ok');
      return true;
    }

    /* Avisamos al coach, si lo tiene, para que ajuste rutina y nutrición. */
    var coach = actualizado.coachId ? AG.DB.usuario(actualizado.coachId) : null;
    if (coach && coach.rol === 'coach') {
      AG.DB.notificar(coach.id, {
        titulo: 'Un socio cambió su objetivo',
        cuerpo: U.nombreCompleto(actualizado) + ' pasó de «' + (anterior || 'sin objetivo') +
          '» a «' + etiquetaDe(OBJETIVOS, objetivo) + '». Conviene revisar su rutina y su plan de nutrición.',
        tipo: 'medicion',
        link: '#/coach/socios'
      });
    }

    U.modal({
      titulo: 'Objetivo actualizado',
      cuerpo:
        '<p>Ahora tu objetivo es <b>' + esc(etiquetaDe(OBJETIVOS, objetivo)) + '</b>.</p>' +
        '<ul class="pf-reglas mt-sm">' +
          '<li>Tu <b>comparativo mensual</b> se recalcula con esta nueva dirección.</li>' +
          '<li>Tu <b>calculadora</b> ajusta calorías, macros y agua del día.</li>' +
          '<li>' + (coach && coach.rol === 'coach'
              ? 'Ya le avisamos a <b>' + esc(U.nombreCompleto(coach)) + '</b>.'
              : 'Cuando te asignen coach, verá este objetivo desde el primer día.') + '</li>' +
        '</ul>',
      acciones: [
        { texto: 'Entendido', clase: 'btn-primary', onClick: function (api) { api.cerrar(); } }
      ]
    });

    toast('Objetivo guardado: ' + etiquetaDe(OBJETIVOS, objetivo) + '.', 'ok');
    return true;
  }

  /* =============================================================
     8. Pestaña "Salud"
     ============================================================= */

  function panelSaludHTML(socio) {
    var ce = (socio.contactoEmergencia && typeof socio.contactoEmergencia === 'object')
      ? socio.contactoEmergencia : {};

    var formulario =
      '<form data-form="salud" autocomplete="off" novalidate>' +
        avisoHTML('warn', 'escudo',
          'Esta información <b>solo la ven tu coach y recepción</b>, y únicamente por tu seguridad: ' +
          'para adaptar tus ejercicios y para saber a quién llamar si algo pasa mientras entrenas.') +
        '<div class="form-grid dos mt">' +
          campo('padecimientos', 'Padecimientos o lesiones',
            areaTexto('padecimientos', socio.padecimientos, 3,
              'maxlength="400" placeholder="Hernia lumbar, hipertensión, rodilla operada…"'),
            'Escribe «Ninguno» si no aplica.') +
          campo('alergias', 'Alergias',
            areaTexto('alergias', socio.alergias, 3,
              'maxlength="400" placeholder="Penicilina, lácteos, cacahuate…"'),
            'Alimentos, medicamentos o materiales.') +
        '</div>' +
        '<h3 class="card-title mt">' + icono('telefono', 16) + '<span>Contacto de emergencia</span></h3>' +
        '<div class="form-grid tres mt-sm">' +
          campo('contactoEmergencia.nombre', 'Nombre',
            entrada('contactoEmergencia.nombre', 'text', ce.nombre, 'maxlength="60"')) +
          campo('contactoEmergencia.telefono', 'Teléfono',
            entrada('contactoEmergencia.telefono', 'tel', ce.telefono, 'maxlength="20" inputmode="tel"'),
            'A 10 dígitos.') +
          campo('contactoEmergencia.parentesco', 'Parentesco',
            entrada('contactoEmergencia.parentesco', 'text', ce.parentesco, 'maxlength="40" placeholder="Esposa, hermano, madre…"')) +
        '</div>' +
        '<div class="row between wrap mt">' +
          '<span class="mini muted">Si tienes una condición nueva, avísale también a tu coach.</span>' +
          botonGuardar('Guardar mi información de salud') +
        '</div>' +
      '</form>';

    return '<section data-panel="salud" class="stack oculto">' +
      tarjeta('Salud', 'corazon', 'Lo que tu coach necesita saber para cuidarte.', formulario) +
    '</section>';
  }

  function guardarSalud(form, socio) {
    limpiarErrores(form);
    var d = U.formToObject(form);
    var ce = (d.contactoEmergencia && typeof d.contactoEmergencia === 'object') ? d.contactoEmergencia : {};

    var nombreCE = txt(ce.nombre);
    var telefonoCE = txt(ce.telefono);
    var parentescoCE = txt(ce.parentesco);

    if (telefonoCE) {
      var digitos = soloDigitos(telefonoCE);
      if (digitos.length < 10) {
        return fallar(form, 'contactoEmergencia.telefono', 'El teléfono de emergencia debe tener 10 dígitos.');
      }
    }
    if (nombreCE && !telefonoCE) {
      return fallar(form, 'contactoEmergencia.telefono', 'Escribe el teléfono de tu contacto de emergencia.');
    }
    if (telefonoCE && !nombreCE) {
      return fallar(form, 'contactoEmergencia.nombre', 'Escribe el nombre de tu contacto de emergencia.');
    }

    AG.DB.actualizar('usuarios', socio.id, {
      padecimientos: txt(d.padecimientos),
      alergias: txt(d.alergias),
      contactoEmergencia: { nombre: nombreCE, telefono: telefonoCE, parentesco: parentescoCE }
    });

    toast('Tu información de salud quedó guardada.', 'ok');
    return true;
  }

  /* =============================================================
     9. Pestaña "Acceso"
     ============================================================= */

  function minimoPassword() {
    var n = (AG.Auth && AG.Auth.MIN_PASSWORD) ? Number(AG.Auth.MIN_PASSWORD) : 5;
    return isFinite(n) && n > 0 ? n : 5;
  }

  function panelAccesoHTML(socio) {
    var min = minimoPassword();

    var formulario =
      '<form data-form="acceso" autocomplete="off" novalidate>' +
        '<div class="form-grid">' +
          campo('actual', 'Contraseña actual',
            entrada('actual', 'password', '', 'maxlength="40" autocomplete="current-password"')) +
          campo('nueva', 'Nueva contraseña',
            entrada('nueva', 'password', '', 'maxlength="40" autocomplete="new-password"')) +
          campo('confirmar', 'Repite la nueva contraseña',
            entrada('confirmar', 'password', '', 'maxlength="40" autocomplete="new-password"')) +
        '</div>' +
        '<div class="mt">' +
          '<span class="label">Reglas de tu contraseña</span>' +
          '<ul class="pf-reglas mt-sm">' +
            '<li>Al menos <b>' + min + ' caracteres</b>.</li>' +
            '<li>Distinta a la que usas hoy.</li>' +
            '<li>Las dos casillas nuevas deben coincidir.</li>' +
            '<li>Nadie del gimnasio te la va a pedir por teléfono ni por mensaje.</li>' +
          '</ul>' +
        '</div>' +
        '<div class="row between wrap mt">' +
          '<span class="mini muted">Entras con ' + esc(socio.email || 'tu correo registrado') + '.</span>' +
          '<button type="submit" class="btn btn-primary">' + icono('candado', 16) + ' Cambiar mi contraseña</button>' +
        '</div>' +
      '</form>';

    return '<section data-panel="acceso" class="stack oculto">' +
      tarjeta('Acceso', 'candado', 'Cambia tu contraseña cuando quieras.', formulario) +
    '</section>';
  }

  function cambiarPassword(form) {
    limpiarErrores(form);
    var d = U.formToObject(form);

    var actual = String(d.actual === null || d.actual === undefined ? '' : d.actual);
    var nueva = String(d.nueva === null || d.nueva === undefined ? '' : d.nueva);
    var confirmar = String(d.confirmar === null || d.confirmar === undefined ? '' : d.confirmar);
    var min = minimoPassword();

    if (!actual) return fallar(form, 'actual', 'Escribe tu contraseña actual.');
    if (!nueva) return fallar(form, 'nueva', 'Escribe la contraseña nueva.');
    if (nueva.length < min) return fallar(form, 'nueva', 'La nueva contraseña necesita al menos ' + min + ' caracteres.');
    if (nueva === actual) return fallar(form, 'nueva', 'La nueva contraseña debe ser distinta a la actual.');
    if (nueva !== confirmar) return fallar(form, 'confirmar', 'Las dos contraseñas nuevas no coinciden.');

    var r = AG.Auth.cambiarPassword(actual, nueva);
    if (!r || !r.ok) {
      var mensaje = (r && r.error) ? r.error : 'No pudimos cambiar tu contraseña.';
      var destino = /actual/i.test(mensaje) ? 'actual' : 'nueva';
      return fallar(form, destino, mensaje);
    }

    try { form.reset(); } catch (e) { /* el formulario ya se limpió */ }
    toast('Listo: tu contraseña quedó actualizada.', 'ok');
    return true;
  }

  /* =============================================================
     10. Pestaña "Preferencias"
     ============================================================= */

  function aplicarTema(tema) {
    var t = (tema === 'claro') ? 'claro' : 'oscuro';
    if (AG.App && typeof AG.App.aplicarTema === 'function') {
      try { AG.App.aplicarTema(t); } catch (e) { /* se usa el respaldo */ }
    } else {
      try { document.documentElement.setAttribute('data-tema', t); } catch (e) { /* sin consecuencias */ }
    }
    /* El botón de la topbar muestra el tema al que se puede cambiar. */
    var btn = document.getElementById('btn-tema');
    if (btn) {
      try { btn.innerHTML = icono(t === 'claro' ? 'luna' : 'sol', 20); } catch (e) { /* sin consecuencias */ }
    }
    return t;
  }

  function temaGuardado() {
    var s = AG.DB.state && AG.DB.state.settings ? AG.DB.state.settings : null;
    return (s && s.tema === 'claro') ? 'claro' : 'oscuro';
  }

  function panelPreferenciasHTML(socio) {
    var prefs = preferenciasDe(socio);
    var marcados = {}, i;
    for (i = 0; i < prefs.recordatorios.length; i++) marcados[prefs.recordatorios[i]] = true;

    var checks = '<div class="pf-checks">';
    for (i = 0; i < RECORDATORIOS.length; i++) {
      var r = RECORDATORIOS[i];
      checks += '<div class="pf-check">' +
        '<label class="check">' +
          '<input type="checkbox" name="recordatorios" value="' + esc(r.v) + '"' +
            (marcados[r.v] ? ' checked' : '') + '>' +
          '<span class="pf-check-txt"><b>' + esc(r.t) + '</b><span>' + esc(r.d) + '</span></span>' +
        '</label>' +
      '</div>';
    }
    checks += '</div>';

    var formulario =
      '<form data-form="preferencias" novalidate>' +
        '<div class="field">' +
          '<span class="label">Tema de la aplicación</span>' +
          tarjetasRadio('tema', TEMAS, temaGuardado(), 'oscuro') +
          '<p class="help">El cambio se aplica al momento en toda la aplicación.</p>' +
        '</div>' +
        '<div class="field mt">' +
          '<span class="label">Recordatorios que quiero recibir</span>' +
          checks +
          '<p class="help">Se muestran en la campana de la barra superior.</p>' +
        '</div>' +
        '<div class="row between wrap mt">' +
          '<span class="mini muted">Los avisos de vencimiento de pago siempre llegan por seguridad de tu acceso.</span>' +
          botonGuardar('Guardar mis preferencias') +
        '</div>' +
      '</form>';

    return '<section data-panel="preferencias" class="stack oculto">' +
      tarjeta('Preferencias', 'config', 'Cómo se ve la aplicación y qué te avisamos.', formulario) +
    '</section>';
  }

  function guardarPreferencias(form, socio) {
    limpiarErrores(form);
    var d = U.formToObject(form);

    var tema = (d.tema === 'claro') ? 'claro' : 'oscuro';
    var lista = esArreglo(d.recordatorios) ? d.recordatorios : [];

    /* Solo se guardan claves conocidas: nada de basura en la base. */
    var limpios = [], i, j;
    for (i = 0; i < RECORDATORIOS.length; i++) {
      for (j = 0; j < lista.length; j++) {
        if (lista[j] === RECORDATORIOS[i].v) { limpios.push(RECORDATORIOS[i].v); break; }
      }
    }

    if (AG.DB.state && AG.DB.state.settings) {
      AG.DB.state.settings.tema = tema;
      AG.DB.guardar();
    }
    aplicarTema(tema);

    var prefs = (socio.preferencias && typeof socio.preferencias === 'object') ? socio.preferencias : {};
    var nuevas = { recordatorios: limpios };
    for (var k in prefs) {
      if (Object.prototype.hasOwnProperty.call(prefs, k) && k !== 'recordatorios') nuevas[k] = prefs[k];
    }
    AG.DB.actualizar('usuarios', socio.id, { preferencias: nuevas });

    toast(limpios.length
      ? 'Preferencias guardadas: ' + limpios.length + (limpios.length === 1 ? ' recordatorio activo.' : ' recordatorios activos.')
      : 'Preferencias guardadas: apagaste todos los recordatorios.', 'ok');
    return true;
  }

  /* =============================================================
     11. Pestaña "Mi resumen en Alliance Gym"
     ============================================================= */

  /* Recorre los meses con medición inicial y final y se queda con
     el de mayor puntaje de comparativo. */
  function mejorMes(socio) {
    var mediciones = AG.DB.medicionesDe(socio.id);
    if (!mediciones.length) return null;

    var periodos = {}, i;
    for (i = 0; i < mediciones.length; i++) {
      var m = mediciones[i];
      var p = (typeof m.periodo === 'string' && m.periodo) ? m.periodo.slice(0, 7) : U.mesDe(m.fecha);
      if (p) periodos[p] = true;
    }

    var mejor = null;
    for (var clave in periodos) {
      if (!Object.prototype.hasOwnProperty.call(periodos, clave)) continue;
      var ini = AG.DB.medicionDelMes(socio.id, clave, 'inicial');
      var fin = AG.DB.medicionDelMes(socio.id, clave, 'final');
      if (!ini || !fin || ini === fin) continue;

      var cmp = Calc.compararMediciones(ini, fin, socio.objetivo);
      if (!cmp || !cmp.ok || !cmp.resumen) continue;
      if (!mejor || cmp.resumen.puntaje > mejor.puntaje) {
        mejor = {
          periodo: clave,
          puntaje: cmp.resumen.puntaje,
          nivel: cmp.resumen.nivel,
          clase: cmp.resumen.clase || Calc.claseNivel(cmp.resumen.nivel),
          veredicto: cmp.resumen.veredicto
        };
      }
    }
    return mejor;
  }

  function calcularResumen(socio) {
    var pagos = AG.DB.pagosDe(socio.id);
    var bitacoras = AG.DB.bitacorasDe(socio.id);
    var asistencias = AG.DB.asistenciasDe(socio.id);

    var sesiones = 0, kilos = 0, i;
    for (i = 0; i < bitacoras.length; i++) {
      if (bitacoras[i] && bitacoras[i].completada === false) continue;
      sesiones++;
      kilos += Calc.volumenEntrenamiento(bitacoras[i]);
    }

    return {
      antiguedad: Calc.antiguedadTexto(socio.fechaAlta),
      fechaAlta: socio.fechaAlta || '',
      mesesPagados: Calc.mesesDeMembresia(socio, pagos),
      pagos: pagos.length,
      sesiones: sesiones,
      asistencias: asistencias.length,
      kilos: Math.round(kilos),
      racha: Calc.rachaDias(asistencias),
      mejor: mejorMes(socio)
    };
  }

  function panelResumenHTML(socio) {
    var r = calcularResumen(socio);

    var kpis = '<div class="grid g3">' +
      kpiHTML('calendario', r.antiguedad,
        'Antigüedad en el gimnasio',
        r.fechaAlta ? 'Desde el ' + U.fecha(r.fechaAlta, 'corto') : 'Sin fecha de alta registrada') +
      kpiHTML('tarjeta', String(r.mesesPagados) + (r.mesesPagados === 1 ? ' mes' : ' meses'),
        'Meses de membresía pagados',
        r.pagos + (r.pagos === 1 ? ' pago registrado' : ' pagos registrados')) +
      kpiHTML('pesa', U.num(r.sesiones, 0),
        'Sesiones entrenadas',
        'Bitácoras que has cerrado') +
      kpiHTML('check', U.num(r.asistencias, 0),
        'Asistencias totales',
        r.racha > 0
          ? 'Racha actual: ' + r.racha + (r.racha === 1 ? ' día' : ' días')
          : 'Marca tu entrada para iniciar una racha') +
      kpiHTML('balanza', U.num(r.kilos, 0) + ' kg',
        'Kilos totales levantados',
        r.kilos >= 1000 ? 'Equivale a ' + U.num(r.kilos / 1000, 1) + ' toneladas' : 'Suma de todas tus series') +
      kpiHTML('trofeo', r.mejor ? U.nombreMes(r.mejor.periodo) : 'Aún sin datos',
        'Mi mejor mes',
        r.mejor ? 'Puntaje ' + r.mejor.puntaje + ' de 100' : 'Se necesita un mes con medición de inicio y de cierre') +
    '</div>';

    var mejorHTML;
    if (r.mejor) {
      mejorHTML = '<div class="pf-mejor">' +
        Charts.progreso(r.mejor.puntaje, {
          alto: 148,
          texto: String(r.mejor.puntaje),
          etiqueta: 'Puntaje de 100',
          aria: 'Puntaje de tu mejor mes'
        }) +
        '<div class="pf-mejor-txt stack-sm">' +
          '<div class="row row-sm wrap">' +
            '<span class="badge ' + esc(r.mejor.clase) + '">' + esc(Calc.textoNivel(r.mejor.nivel)) + '</span>' +
            U.badge(U.nombreMes(r.mejor.periodo), 'muted') +
          '</div>' +
          '<p class="muted">' + esc(r.mejor.veredicto || 'Un mes para presumir.') + '</p>' +
          '<a class="btn btn-outline btn-sm" href="#/socio/progreso">' +
            icono('grafica', 15) + ' Ver todo mi progreso</a>' +
        '</div>' +
      '</div>';
    } else {
      mejorHTML = vacioHTML('regla',
        'Todavía no hay un mes cerrado. En cuanto tu coach registre tu medición de inicio y la de cierre, ' +
        'aquí aparece tu mejor mes con su puntaje.');
    }

    return '<section data-panel="resumen" class="stack oculto">' +
      tarjeta('Mi resumen en Alliance Gym', 'trofeo',
        'Todo lo que llevas construido desde que entraste.', kpis) +
      tarjeta('Mi mejor mes', 'estrella',
        'El periodo con el comparativo más alto de tu historial.', mejorHTML) +
    '</section>';
  }

  /* =============================================================
     12. Descarga de la información del socio
     ============================================================= */

  function copiaSinPassword(socio) {
    var salida = {};
    for (var k in socio) {
      if (!Object.prototype.hasOwnProperty.call(socio, k)) continue;
      if (k === 'password') continue;
      salida[k] = socio[k];
    }
    return salida;
  }

  function exportarMisDatos(socio) {
    if (!socio || !socio.id) {
      toast('No encontramos tu expediente para exportarlo.', 'error');
      return false;
    }

    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    var plan = AG.DB.plan(socio.planId);
    var settings = AG.DB.state && AG.DB.state.settings ? AG.DB.state.settings : {};

    var paquete = {
      generado: U.ahora(),
      gimnasio: settings.nombreGym || 'Alliance Gym',
      aviso: 'Copia de tu información personal. No incluye contraseñas ni datos de otros socios.',
      perfil: copiaSinPassword(socio),
      plan: plan ? { id: plan.id, nombre: plan.nombre, precio: plan.precio, meses: plan.meses } : null,
      coach: (coach && coach.rol === 'coach')
        ? { id: coach.id, nombre: U.nombreCompleto(coach), email: coach.email || '', telefono: coach.telefono || '' }
        : null,
      pagos: AG.DB.pagosDe(socio.id),
      mediciones: AG.DB.medicionesDe(socio.id),
      bitacoras: AG.DB.bitacorasDe(socio.id),
      asistencias: AG.DB.asistenciasDe(socio.id),
      planNutricion: AG.DB.planNutricionDe(socio.id),
      calificaciones: AG.DB.donde('calificaciones', function (c) { return c && c.socioId === socio.id; })
    };

    var contenido = null;
    try { contenido = JSON.stringify(paquete, null, 2); } catch (e) { contenido = null; }
    if (contenido === null) {
      toast('No pudimos preparar tu archivo. Intenta de nuevo.', 'error');
      return false;
    }

    var nombre = 'mis-datos-' + (socio.codigo ? String(socio.codigo).toLowerCase() : 'socio') + '-' + U.hoy() + '.json';
    var ok = U.descargar(nombre, contenido, 'application/json');
    if (ok) toast('Descargamos tu información en «' + nombre + '».', 'ok');
    return !!ok;
  }

  /* =============================================================
     13. Armado de la pantalla
     ============================================================= */

  function tabsHTML() {
    var html = '<div class="tabs" role="tablist">';
    for (var i = 0; i < TABS.length; i++) {
      var t = TABS[i];
      var activa = (t.clave === estado.tab);
      html += '<button type="button" class="tab' + (activa ? ' active' : '') + '"' +
        ' data-tab="' + esc(t.clave) + '" role="tab" aria-selected="' + (activa ? 'true' : 'false') + '">' +
        icono(t.icono, 16) + '<span>' + esc(t.etiqueta) + '</span></button>';
    }
    return html + '</div>';
  }

  /* Deja visible únicamente el panel de la pestaña activa. */
  function sincronizarPaneles(raiz) {
    var pestanas = U.$$('[data-tab]', raiz), i, elegida = null;
    for (i = 0; i < pestanas.length; i++) {
      var activa = pestanas[i].getAttribute('data-tab') === estado.tab;
      pestanas[i].classList.toggle('active', activa);
      pestanas[i].setAttribute('aria-selected', activa ? 'true' : 'false');
      if (activa) elegida = pestanas[i];
    }

    /* En móvil la tira de pestañas se desplaza: la activa siempre a la vista. */
    if (elegida && elegida.parentNode && elegida.parentNode.getBoundingClientRect) {
      try {
        var tira = elegida.parentNode;
        var cajaTira = tira.getBoundingClientRect();
        var cajaTab = elegida.getBoundingClientRect();
        var destino = tira.scrollLeft + (cajaTab.left - cajaTira.left) -
          (cajaTira.width - cajaTab.width) / 2;
        tira.scrollLeft = destino > 0 ? destino : 0;
      } catch (e) { /* sin desplazamiento: no pasa nada */ }
    }
    var paneles = U.$$('[data-panel]', raiz);
    for (i = 0; i < paneles.length; i++) {
      paneles[i].classList.toggle('oculto', paneles[i].getAttribute('data-panel') !== estado.tab);
    }
  }

  function pantallaAviso(iconoNombre, titulo, mensaje) {
    return '<div class="page pf-page">' +
      '<div class="card"><div class="card-body">' +
        '<div class="empty">' +
          '<div class="empty-icono">' + icono(iconoNombre, 34) + '</div>' +
          '<h2 class="page-title">' + esc(titulo) + '</h2>' +
          '<p class="empty-texto">' + esc(mensaje) + '</p>' +
        '</div>' +
      '</div></div>' +
    '</div>';
  }

  function render(ctx) {
    asegurarEstilos();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario
      : (AG.Auth && typeof AG.Auth.actual === 'function' ? AG.Auth.actual() : null);

    if (!usuario) {
      return pantallaAviso('usuario', 'Sesión no disponible',
        'Vuelve a iniciar sesión para ver y editar tu perfil.');
    }
    if (usuario.rol !== 'socio') {
      return pantallaAviso('candado', 'Esta pantalla es del socio',
        'Solo un socio puede editar su propio perfil. Si buscas el expediente de alguien más, entra por «Socios».');
    }

    var socio = socioDe(usuario);
    if (!socio) {
      return pantallaAviso('alerta', 'No encontramos tu expediente',
        'Tu cuenta existe pero no pudimos leer tu ficha. Avisa en recepción para revisarla.');
    }

    /* Si la pestaña guardada ya no existe (versión vieja del estado), al inicio. */
    if (!etiquetaDe(TABS.map(function (t) { return { v: t.clave, t: t.etiqueta }; }), estado.tab)) {
      estado.tab = 'datos';
    }

    var html = '<div class="page pf-page" data-perfil>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('usuario', 24) + '<span>Mi perfil</span></h1>' +
          '<p class="page-sub">Tus datos, tu objetivo y tus preferencias. Aquí mandas tú.</p>' +
        '</div>' +
      '</div>' +
      encabezadoHTML(socio) +
      tabsHTML() +
      '<div class="mt">' +
        panelDatosHTML(socio) +
        panelObjetivoHTML(socio) +
        panelSaludHTML(socio) +
        panelAccesoHTML(socio) +
        panelPreferenciasHTML(socio) +
        panelResumenHTML(socio) +
      '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root, socio.id); }
    };
  }

  /* =============================================================
     14. Delegación de eventos
     ============================================================= */

  function enganchar(root, socioId) {
    var raiz = root ? root.querySelector('[data-perfil]') : null;
    if (!raiz) return;
    asegurarEstilos();
    sincronizarPaneles(raiz);

    /* Siempre se relee el socio vivo: nunca se confía en una copia. */
    function actual() {
      var s = AG.DB.usuario(socioId);
      return (s && s.rol === 'socio') ? s : null;
    }

    /* ---------- Pestañas ---------- */
    U.delegar(raiz, 'click', '[data-tab]', function (e, el) {
      e.preventDefault();
      estado.tab = el.getAttribute('data-tab') || 'datos';
      sincronizarPaneles(raiz);
    });

    /* ---------- Color del avatar ---------- */
    U.delegar(raiz, 'click', '[data-color]', function (e, el) {
      e.preventDefault();
      var socio = actual();
      if (!socio) { toast('No pudimos leer tu ficha.', 'error'); return; }

      var color = el.getAttribute('data-color') || '';
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;

      AG.DB.actualizar('usuarios', socio.id, { avatarColor: color });
      var actualizado = actual() || socio;

      var caja = raiz.querySelector('[data-avatar]');
      if (caja) caja.innerHTML = U.avatar(actualizado, 'xl');

      var botones = U.$$('[data-color]', raiz);
      for (var i = 0; i < botones.length; i++) {
        var encendido = (botones[i].getAttribute('data-color') === color);
        botones[i].classList.toggle('on', encendido);
        botones[i].setAttribute('aria-pressed', encendido ? 'true' : 'false');
      }

      refrescarShell(actualizado);
      toast('Listo, ese es tu nuevo color.', 'ok');
    });

    /* ---------- Edad viva al cambiar la fecha de nacimiento ---------- */
    function pintarEdad() {
      var input = raiz.querySelector('[name="fechaNacimiento"]');
      var caja = raiz.querySelector('[data-edad]');
      if (input && caja) caja.textContent = textoEdad(input.value);
    }
    U.delegar(raiz, 'input', '[name="fechaNacimiento"]', pintarEdad);
    U.delegar(raiz, 'change', '[name="fechaNacimiento"]', pintarEdad);

    /* ---------- Marca visual de las .radio-cards ---------- */
    U.delegar(raiz, 'change', '.radio-cards input[type="radio"]', function (e, el) {
      var grupo = el.closest('.radio-cards');
      if (!grupo) return;
      var tarjetas = U.$$('.radio-card', grupo);
      for (var i = 0; i < tarjetas.length; i++) {
        var radio = tarjetas[i].querySelector('input[type="radio"]');
        tarjetas[i].classList.toggle('on', !!(radio && radio.checked));
      }
      /* El tema se ve al instante; se persiste al guardar preferencias. */
      if (el.name === 'tema') aplicarTema(el.value);
    });

    /* ---------- Descargar mi información ---------- */
    U.delegar(raiz, 'click', '[data-descargar]', function (e) {
      e.preventDefault();
      var socio = actual();
      if (!socio) { toast('No pudimos leer tu ficha.', 'error'); return; }
      U.confirmar(
        'Vamos a generar un archivo JSON con toda tu información de Alliance Gym. ' +
        'Guárdalo en un lugar seguro: contiene tus datos personales.',
        'Descargar mi información'
      ).then(function (ok) {
        if (ok) exportarMisDatos(actual() || socio);
      });
    });

    /* ---------- Guardado de los formularios ---------- */
    U.delegar(raiz, 'submit', 'form[data-form]', function (e, form) {
      e.preventDefault();

      var socio = actual();
      if (!socio) { toast('Tu sesión cambió. Vuelve a entrar para guardar.', 'error'); return; }

      var cual = form.getAttribute('data-form');
      try {
        if (cual === 'datos') guardarDatos(form, socio, raiz);
        else if (cual === 'objetivo') guardarObjetivo(form, socio, raiz);
        else if (cual === 'salud') guardarSalud(form, socio);
        else if (cual === 'acceso') cambiarPassword(form);
        else if (cual === 'preferencias') guardarPreferencias(form, socio);
      } catch (error) {
        toast('No pudimos guardar los cambios. Intenta otra vez.', 'error');
      }
    });

    /* Enter dentro de un campo no debe recargar la página en file://. */
    U.delegar(raiz, 'keydown', 'form[data-form] .input', function (e, el) {
      if ((e.key === 'Enter' || e.keyCode === 13) && el.tagName === 'INPUT') {
        e.preventDefault();
        var form = el.closest('form[data-form]');
        if (form) {
          var boton = form.querySelector('button[type="submit"]');
          if (boton) boton.click();
        }
      }
    });
  }

  /* =============================================================
     15. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.SocioPerfil = {
    render: render,
    exportarDatos: exportarMisDatos,
    resumen: calcularResumen,
    mejorMes: mejorMes
  };

  AG.Router.registrar({
    path: 'socio/perfil',
    roles: ['socio'],
    titulo: 'Mi perfil',
    nav: { etiqueta: 'Mi perfil', icono: 'usuario', grupo: 'Mi cuenta', orden: 3 },
    render: render
  });
})(window.AG);
