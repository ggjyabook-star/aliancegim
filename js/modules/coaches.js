/* =============================================================
   ALLIANCE GYM — AG.Mod.Coaches
   Gestión del equipo de entrenadores (solo dirección).

   Rutas que registra:
     - 'director/coaches'  listado + comparativa del equipo
     - 'director/coach'    ficha individual (nav:null, ?id=u_xxxx)

   JavaScript clásico (ES5). Sin módulos, sin dependencias externas.
   Todo el texto que viene de la base pasa por AG.Utils.esc().
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  /* =========================================================
     0. Atajos y ayudantes de presentación
     ========================================================= */

  function esc(valor) { return AG.Utils.esc(valor); }

  function ico(nombre, tamano) { return AG.Icons.get(nombre, tamano || 18); }

  /** Número entero seguro (0 si el dato no sirve). */
  function ent(valor) {
    var n = Number(valor);
    return isFinite(n) ? n : 0;
  }

  /** Porcentaje acotado entre 0 y 100. */
  function acotarPct(valor) {
    var n = Number(valor);
    if (!isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return Math.round(n);
  }

  /** 'YYYY-MM' del mes en curso. */
  function periodoActual() { return AG.Utils.mesActual(); }

  /** 'YYYY-MM' del último mes ya cerrado. */
  function periodoCerrado() {
    return AG.Utils.mesDe(AG.Utils.sumaMeses(AG.Utils.hoy(), -1));
  }

  /** 'sep 26' a partir de 'YYYY-MM'. */
  function etiquetaMes(mesKey) {
    var partes = String(mesKey || '').split('-');
    if (partes.length < 2) return String(mesKey || '');
    var indice = Number(partes[1]) - 1;
    var corto = (AG.Utils.MESES_CORTOS && AG.Utils.MESES_CORTOS[indice])
      ? AG.Utils.MESES_CORTOS[indice] : partes[1];
    return corto + ' ' + String(partes[0]).slice(2);
  }

  /** Enlace de WhatsApp a partir de un teléfono mexicano. */
  function enlaceWhatsApp(telefono) {
    var digitos = String(telefono === null || telefono === undefined ? '' : telefono).replace(/\D/g, '');
    if (digitos.length < 10) return '';
    if (digitos.length === 10) digitos = '52' + digitos;
    return 'https://wa.me/' + digitos;
  }

  /** Badge corto del estado de un socio. */
  function badgeEstadoSocio(socio) {
    var estado = socio && socio.estado ? String(socio.estado) : 'activo';
    var mapa = {
      activo: { clase: 'badge-ok', texto: 'Activo' },
      vencido: { clase: 'badge-danger', texto: 'Vencido' },
      congelado: { clase: 'badge-muted', texto: 'Congelado' },
      baja: { clase: 'badge-muted', texto: 'Baja' }
    };
    var d = mapa[estado] || { clase: 'badge-info', texto: AG.Utils.capitalizar(estado) };
    return '<span class="badge ' + d.clase + '">' + esc(d.texto) + '</span>';
  }

  /** Bloque .empty reutilizable. */
  function vacio(iconoNombre, mensaje, accionHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ico(iconoNombre, 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (accionHTML || '') +
      '</div>';
  }

  /** Barra de progreso con etiqueta superior. */
  function barra(etiqueta, valorTexto, pct, clase) {
    return '<div>' +
      '<div class="bar-etiqueta"><span>' + esc(etiqueta) + '</span><b>' + esc(valorTexto) + '</b></div>' +
      '<div class="bar"><span class="bar-fill' + (clase ? ' ' + clase : '') +
      '" style="width:' + acotarPct(pct) + '%"></span></div>' +
      '</div>';
  }

  /** Clase de color para una barra según el porcentaje. */
  function claseSegunPct(pct) {
    var n = acotarPct(pct);
    if (n >= 75) return 'ok';
    if (n >= 45) return 'warn';
    return 'error';
  }

  /** Dato etiquetado del contrato de CSS. */
  function dato(etiqueta, valor) {
    return '<div class="dato"><span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<b class="dato-val">' + esc(valor) + '</b></div>';
  }

  /** Estrellas + promedio + total de reseñas. */
  function bloqueEstrellas(calificacion, tamano) {
    var clase = 'stars' + (tamano === 'sm' ? ' stars-sm' : (tamano === 'lg' ? ' stars-lg' : ''));
    var html = AG.Utils.estrellas(calificacion.promedio, { size: tamano === 'lg' ? 24 : (tamano === 'sm' ? 14 : 16) });
    // Se ajusta la clase base para respetar los tamaños del CSS del proyecto.
    html = html.replace('class="stars"', 'class="' + clase + '"');
    var detalle = calificacion.total
      ? '<span class="stars-valor">' + esc(AG.Utils.num(calificacion.promedio, 1)) + '</span>' +
        '<span class="mini muted">(' + calificacion.total +
        (calificacion.total === 1 ? ' reseña)' : ' reseñas)') + '</span>'
      : '<span class="mini muted">Sin reseñas todavía</span>';
    return '<div class="row-sm wrap">' + html + detalle + '</div>';
  }

  /* =========================================================
     1. Métricas del equipo
     ========================================================= */

  /* Cachés por pintado: evitan recorrer la base una y otra vez. */
  var cacheAdherencia = null;
  var cacheProgreso = null;

  function limpiarCaches() {
    cacheAdherencia = {};
    cacheProgreso = {};
  }

  /** Días de entrenamiento por semana según la rutina vigente del socio. */
  function diasPorSemanaDe(socioId) {
    var activa = AG.DB.rutinaActivaDe(socioId);
    var dias = (activa && activa.rutina) ? Number(activa.rutina.diasPorSemana) : 0;
    return (isFinite(dias) && dias > 0) ? dias : 3;
  }

  /** Adherencia de los últimos 30 días de un socio (con caché). */
  function adherenciaDe(socio) {
    if (!socio || !socio.id) return { pct: 0, hechas: 0, esperadas: 0 };
    if (!cacheAdherencia) cacheAdherencia = {};
    if (cacheAdherencia[socio.id]) return cacheAdherencia[socio.id];

    var hasta = AG.Utils.hoy();
    var desde = AG.Utils.sumaDias(hasta, -29);
    var resultado = AG.Calc.adherencia(AG.DB.bitacorasDe(socio.id), desde, hasta, diasPorSemanaDe(socio.id));
    cacheAdherencia[socio.id] = resultado;
    return resultado;
  }

  /** Puntaje del comparativo del último mes cerrado (null si no se puede). */
  function puntajeMesCerrado(socio) {
    if (!socio || !socio.id) return null;
    if (!cacheProgreso) cacheProgreso = {};
    if (Object.prototype.hasOwnProperty.call(cacheProgreso, socio.id)) return cacheProgreso[socio.id];

    var mes = periodoCerrado();
    var inicial = AG.DB.medicionDelMes(socio.id, mes, 'inicial');
    var final = AG.DB.medicionDelMes(socio.id, mes, 'final');
    var puntaje = null;

    if (inicial && final) {
      var comparativo = AG.Calc.compararMediciones(inicial, final, socio.objetivo);
      if (comparativo && comparativo.ok && comparativo.resumen) {
        puntaje = comparativo.resumen.puntaje;
      }
    }
    cacheProgreso[socio.id] = puntaje;
    return puntaje;
  }

  /** Clases activas que imparte un coach. */
  function clasesDe(coachId) {
    return AG.DB.donde('clases', function (c) {
      return c.coachId === coachId && c.activa !== false;
    });
  }

  /**
   * Métricas completas de un coach.
   * @returns {Object} conteos, porcentajes y colecciones ya resueltas
   */
  function metricasDe(coach) {
    if (!coach || !coach.id) return null;

    var socios = AG.DB.sociosDe(coach.id);
    var activos = [];
    var i;

    for (i = 0; i < socios.length; i++) {
      if (socios[i].estado === 'activo') activos.push(socios[i]);
    }

    var calificaciones = AG.DB.calificacionesDe(coach.id);
    var calificacion = AG.Calc.promedioCalificacion(calificaciones);

    var periodo = periodoActual();
    var conMedicion = 0;
    var sumaAdherencia = 0;

    for (i = 0; i < activos.length; i++) {
      if (AG.DB.medicionDelMes(activos[i].id, periodo)) conMedicion++;
      sumaAdherencia += adherenciaDe(activos[i]).pct;
    }

    var sumaProgreso = 0, conProgreso = 0, puntaje;
    for (i = 0; i < socios.length; i++) {
      puntaje = puntajeMesCerrado(socios[i]);
      if (puntaje !== null) { sumaProgreso += puntaje; conProgreso++; }
    }

    var clases = clasesDe(coach.id);
    var minutosSemana = 0;
    for (i = 0; i < clases.length; i++) minutosSemana += ent(clases[i].duracionMin);

    var cupo = ent(coach.cupoMaximo);
    var adherencia = activos.length ? Math.round(sumaAdherencia / activos.length) : 0;
    var cobertura = activos.length ? Math.round(conMedicion / activos.length * 100) : 0;
    var retencion = socios.length ? Math.round(activos.length / socios.length * 100) : 0;
    var progreso = conProgreso ? Math.round(sumaProgreso / conProgreso) : null;

    return {
      coach: coach,
      socios: socios,
      sociosActivos: activos,
      totalSocios: socios.length,
      totalActivos: activos.length,
      cupo: cupo,
      ocupacion: cupo > 0 ? Math.round(activos.length / cupo * 100) : 0,
      calificaciones: calificaciones,
      calificacion: calificacion,
      adherencia: adherencia,
      medicionesHechas: conMedicion,
      medicionesEsperadas: activos.length,
      cobertura: cobertura,
      retencion: retencion,
      progreso: progreso,
      sociosConProgreso: conProgreso,
      clases: clases,
      minutosSemana: minutosSemana
    };
  }

  /**
   * Puntaje combinado del mes: calificación 40 %, adherencia 25 %,
   * cobertura de mediciones 20 % y retención 15 %.
   */
  function puntajeCombinado(m) {
    if (!m) return 0;
    var estrellas = m.calificacion.total ? (m.calificacion.promedio / 5) * 100 : 0;
    return Math.round(
      estrellas * 0.40 +
      acotarPct(m.adherencia) * 0.25 +
      acotarPct(m.cobertura) * 0.20 +
      acotarPct(m.retencion) * 0.15
    );
  }

  /** ¿Este coach entra a la carrera por "mejor coach del mes"? */
  function elegibleReconocimiento(m) {
    return !!m && m.coach.activo !== false && m.totalActivos > 0 && m.calificacion.total > 0;
  }

  /**
   * Tabla ordenada de los coaches elegibles al reconocimiento del mes.
   * @returns {Array} [{ metricas, puntaje }] de mayor a menor
   */
  function rankingDelMes(listaMetricas) {
    var elegibles = [];
    for (var i = 0; i < listaMetricas.length; i++) {
      if (!elegibleReconocimiento(listaMetricas[i])) continue;
      elegibles.push({ metricas: listaMetricas[i], puntaje: puntajeCombinado(listaMetricas[i]) });
    }
    elegibles.sort(function (a, b) {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return b.metricas.calificacion.promedio - a.metricas.calificacion.promedio;
    });
    return elegibles;
  }

  /* =========================================================
     2. Formulario de alta y edición
     ========================================================= */

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** Fila editable de la lista dinámica de certificaciones. */
  function filaCertificacion(valor) {
    return '<div class="row-sm" data-cert-fila>' +
      '<input type="text" class="input flex1" data-cert maxlength="90" ' +
      'placeholder="Ej. NSCA-CSCS" value="' + esc(valor || '') + '">' +
      '<button type="button" class="btn-icono" data-cert-quitar aria-label="Quitar certificación" ' +
      'title="Quitar certificación">' + ico('x', 16) + '</button>' +
      '</div>';
  }

  /** HTML completo del formulario de coach. */
  function formularioHTML(coach) {
    var c = coach || {};
    var certificaciones = (Object.prototype.toString.call(c.certificaciones) === '[object Array]')
      ? c.certificaciones : [];
    var filas = '';
    var i;

    for (i = 0; i < certificaciones.length; i++) filas += filaCertificacion(certificaciones[i]);
    if (!filas) filas = filaCertificacion('');

    return '<form class="stack" data-form-coach novalidate>' +
      '<div class="form-grid">' +

        '<div class="field">' +
          '<label class="label" for="cf-nombre">Nombre(s)</label>' +
          '<input class="input" id="cf-nombre" name="nombre" type="text" maxlength="60" required ' +
          'autocomplete="off" value="' + esc(c.nombre || '') + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-apellidos">Apellidos</label>' +
          '<input class="input" id="cf-apellidos" name="apellidos" type="text" maxlength="60" required ' +
          'autocomplete="off" value="' + esc(c.apellidos || '') + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-email">Correo electrónico</label>' +
          '<input class="input" id="cf-email" name="email" type="email" maxlength="90" required ' +
          'autocomplete="off" value="' + esc(c.email || '') + '">' +
          '<p class="help">Es el usuario con el que entra al sistema. No puede repetirse.</p>' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-telefono">Teléfono</label>' +
          '<input class="input" id="cf-telefono" name="telefono" type="tel" maxlength="20" ' +
          'autocomplete="off" placeholder="33 1234 5678" value="' + esc(c.telefono || '') + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-especialidad">Especialidad</label>' +
          '<input class="input" id="cf-especialidad" name="especialidad" type="text" maxlength="70" ' +
          'placeholder="Ej. Fuerza e hipertrofia" value="' + esc(c.especialidad || '') + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-horario">Horario de trabajo</label>' +
          '<input class="input" id="cf-horario" name="horario" type="text" maxlength="120" ' +
          'placeholder="Lun a Vie 6:00–11:00 y 17:00–21:00" value="' + esc(c.horario || '') + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-contratacion">Fecha de contratación</label>' +
          '<input class="input" id="cf-contratacion" name="fechaContratacion" type="date" ' +
          'value="' + esc(c.fechaContratacion || AG.Utils.hoy()) + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-sueldo">Sueldo mensual</label>' +
          '<input class="input" id="cf-sueldo" name="sueldo" type="number" min="0" step="100" ' +
          'value="' + esc(c.sueldo === undefined || c.sueldo === null ? '' : c.sueldo) + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-cupo">Cupo máximo de socios</label>' +
          '<input class="input" id="cf-cupo" name="cupoMaximo" type="number" min="0" max="200" step="1" ' +
          'value="' + esc(c.cupoMaximo === undefined || c.cupoMaximo === null ? '' : c.cupoMaximo) + '">' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cf-password">Contraseña</label>' +
          '<input class="input" id="cf-password" name="password" type="text" maxlength="40" ' +
          'autocomplete="new-password" placeholder="' +
          (c.id ? 'Déjala vacía para no cambiarla' : 'Mínimo 5 caracteres') + '" value="">' +
          '<p class="help">' + (c.id
            ? 'Solo escribe algo si quieres reemplazar la contraseña actual.'
            : 'Se la entregas al coach para su primer acceso.') + '</p>' +
        '</div>' +

        '<div class="field ancho-total">' +
          '<label class="label" for="cf-bio">Biografía</label>' +
          '<textarea class="textarea" id="cf-bio" name="bio" rows="3" maxlength="480" ' +
          'placeholder="Trayectoria, estilo de entrenamiento y a quién acompaña mejor.">' +
          esc(c.bio || '') + '</textarea>' +
        '</div>' +

        '<div class="field ancho-total">' +
          '<label class="label">Certificaciones</label>' +
          '<div class="stack-sm" data-cert-lista>' + filas + '</div>' +
          '<div class="row-sm">' +
            '<button type="button" class="btn btn-sm btn-outline" data-cert-agregar>' +
            ico('mas', 15) + 'Agregar certificación</button>' +
          '</div>' +
          '<p class="help">Las certificaciones vacías se descartan al guardar.</p>' +
        '</div>' +

      '</div>' +
      '<p class="mini txt-error oculto" data-form-error role="alert"></p>' +
      '</form>';
  }

  /** Lee las certificaciones escritas en el formulario. */
  function leerCertificaciones(raiz) {
    var campos = AG.Utils.$$('[data-cert]', raiz);
    var salida = [];
    for (var i = 0; i < campos.length; i++) {
      var texto = String(campos[i].value || '').trim();
      if (texto) salida.push(texto);
    }
    return salida;
  }

  /** ¿El correo ya lo usa otro usuario? */
  function correoOcupado(email, idPropio) {
    var buscado = String(email || '').trim().toLowerCase();
    if (!buscado) return false;
    var repetidos = AG.DB.donde('usuarios', function (u) {
      return u.id !== idPropio && String(u.email || '').trim().toLowerCase() === buscado;
    });
    return repetidos.length > 0;
  }

  /**
   * Modal de alta o edición de coach.
   * @param {String|null} coachId  null para dar de alta
   */
  function abrirFormulario(coachId) {
    var coach = coachId ? AG.DB.usuario(coachId) : null;
    if (coachId && (!coach || coach.rol !== 'coach')) {
      AG.Utils.toast('No encontramos a ese coach en la base.', 'error');
      return null;
    }

    var esNuevo = !coach;

    return AG.Utils.modal({
      titulo: esNuevo ? 'Nuevo coach' : 'Editar a ' + AG.Utils.nombreCompleto(coach),
      ancho: 'lg',
      cuerpo: formularioHTML(coach),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', cerrar: true, onClick: function (api) { api.cerrar(); } },
        {
          texto: esNuevo ? 'Dar de alta' : 'Guardar cambios',
          clase: 'btn-primary',
          cerrar: true,
          onClick: function (api) { return guardarFormulario(api, coach); }
        }
      ],
      onOpen: function (raiz, api) {
        // Enter dentro del formulario guarda en lugar de recargar la página.
        AG.Utils.delegar(raiz, 'submit', '[data-form-coach]', function (evento) {
          evento.preventDefault();
          guardarFormulario(api, coach);
        });

        AG.Utils.delegar(raiz, 'click', '[data-cert-agregar]', function () {
          var lista = AG.Utils.$('[data-cert-lista]', raiz);
          if (!lista) return;
          var envoltorio = document.createElement('div');
          envoltorio.innerHTML = filaCertificacion('');
          var fila = envoltorio.firstChild;
          lista.appendChild(fila);
          var campo = fila.querySelector('[data-cert]');
          if (campo) { try { campo.focus(); } catch (e) { /* sin foco disponible */ } }
        });

        AG.Utils.delegar(raiz, 'click', '[data-cert-quitar]', function () {
          var lista = AG.Utils.$('[data-cert-lista]', raiz);
          var fila = this.closest('[data-cert-fila]');
          if (!lista || !fila) return;
          if (lista.children.length <= 1) {
            var campo = fila.querySelector('[data-cert]');
            if (campo) campo.value = '';
            return;
          }
          lista.removeChild(fila);
        });
      }
    });
  }

  /** Valida y persiste el formulario. Devuelve false para dejar el modal abierto. */
  function guardarFormulario(api, coach) {
    var raiz = api.root;
    var form = AG.Utils.$('[data-form-coach]', raiz);
    var aviso = AG.Utils.$('[data-form-error]', raiz);
    if (!form) return false;

    var datos = AG.Utils.formToObject(form);

    function fallar(mensaje, selector) {
      if (aviso) {
        aviso.textContent = mensaje;
        aviso.classList.remove('oculto');
      }
      AG.Utils.toast(mensaje, 'error');
      var campo = selector ? AG.Utils.$(selector, raiz) : null;
      if (campo) { try { campo.focus(); } catch (e) { /* sin foco disponible */ } }
      return false;
    }

    var nombre = String(datos.nombre || '').trim();
    var apellidos = String(datos.apellidos || '').trim();
    var email = String(datos.email || '').trim().toLowerCase();
    var password = String(datos.password || '').trim();

    if (!nombre) return fallar('Escribe el nombre del coach.', '#cf-nombre');
    if (!apellidos) return fallar('Escribe los apellidos del coach.', '#cf-apellidos');
    if (!email) return fallar('El correo es obligatorio: es su usuario de acceso.', '#cf-email');
    if (!RE_EMAIL.test(email)) return fallar('Ese correo no tiene un formato válido.', '#cf-email');
    if (correoOcupado(email, coach ? coach.id : '')) {
      return fallar('Ya existe una cuenta con ese correo.', '#cf-email');
    }
    if (!coach && password.length < 5) {
      return fallar('La contraseña debe tener al menos 5 caracteres.', '#cf-password');
    }
    if (coach && password && password.length < 5) {
      return fallar('La nueva contraseña debe tener al menos 5 caracteres.', '#cf-password');
    }

    var sueldo = Math.max(0, ent(datos.sueldo));
    var cupo = Math.max(0, Math.round(ent(datos.cupoMaximo)));
    var contratacion = String(datos.fechaContratacion || '').trim() || AG.Utils.hoy();

    var cambios = {
      nombre: nombre,
      apellidos: apellidos,
      email: email,
      telefono: String(datos.telefono || '').trim(),
      especialidad: String(datos.especialidad || '').trim(),
      bio: String(datos.bio || '').trim(),
      certificaciones: leerCertificaciones(raiz),
      horario: String(datos.horario || '').trim(),
      fechaContratacion: contratacion,
      sueldo: sueldo,
      cupoMaximo: cupo
    };

    if (coach) {
      if (password) cambios.password = password;
      AG.DB.actualizar('usuarios', coach.id, cambios);
      AG.Utils.toast('Datos de ' + AG.Utils.nombreCompleto(coach) + ' actualizados.', 'ok');
    } else {
      cambios.rol = 'coach';
      cambios.password = password;
      cambios.activo = true;
      cambios.creado = AG.Utils.hoy();
      cambios.avatarColor = AG.Utils.colorDe(nombre + ' ' + apellidos + email);
      cambios.notas = '';
      var nuevo = AG.DB.insertar('usuarios', cambios);
      if (!nuevo) return fallar('No se pudo dar de alta al coach. Intenta de nuevo.');
      AG.Utils.toast(nombre + ' ' + apellidos + ' ya forma parte del equipo.', 'ok');
    }

    api.cerrar();
    AG.Router.refrescar();
    return true;
  }

  /* =========================================================
     3. Activar / desactivar
     ========================================================= */

  function desactivarCoach(coachId) {
    var coach = AG.DB.usuario(coachId);
    if (!coach || coach.rol !== 'coach') {
      AG.Utils.toast('No encontramos a ese coach en la base.', 'error');
      return;
    }

    var asignados = AG.DB.sociosDe(coach.id).length;
    var detalle = asignados
      ? 'Tiene ' + asignados + (asignados === 1 ? ' socio asignado' : ' socios asignados') +
        '. Seguirán en su lista hasta que los reasignes a otro coach.'
      : 'No tiene socios asignados en este momento.';

    AG.Utils.confirmar(
      '¿Desactivar a ' + AG.Utils.nombreCompleto(coach) + '?\nNo podrá volver a entrar al sistema.',
      'Desactivar coach',
      { peligro: true, textoOk: 'Sí, desactivar', detalle: detalle }
    ).then(function (confirmado) {
      if (!confirmado) return;
      AG.DB.actualizar('usuarios', coach.id, { activo: false });
      AG.Utils.toast(AG.Utils.nombreCompleto(coach) + ' quedó desactivado.', 'ok');
      AG.Router.refrescar();
    });
  }

  function activarCoach(coachId) {
    var coach = AG.DB.usuario(coachId);
    if (!coach || coach.rol !== 'coach') {
      AG.Utils.toast('No encontramos a ese coach en la base.', 'error');
      return;
    }
    AG.DB.actualizar('usuarios', coach.id, { activo: true });
    AG.Utils.toast(AG.Utils.nombreCompleto(coach) + ' vuelve a estar activo.', 'ok');
    AG.Router.refrescar();
  }

  /* =========================================================
     4. Listado — 'director/coaches'
     ========================================================= */

  /* Filtros vivos del listado (sobreviven a un refrescar). */
  var filtros = { texto: '', estado: 'activos' };

  /** Tarjeta de coach para el listado. */
  function tarjetaCoach(m, esMejor) {
    if (!m) return '';
    var coach = m.coach;
    var inactivo = coach.activo === false;

    var textoCupo = m.cupo > 0
      ? m.totalActivos + ' / ' + m.cupo
      : m.totalActivos + ' (sin cupo definido)';
    var pctCupo = m.cupo > 0 ? m.ocupacion : (m.totalActivos ? 100 : 0);

    var acciones =
      '<button type="button" class="btn btn-sm btn-outline" data-accion="ver">' +
        ico('ojo', 15) + 'Ver ficha</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-accion="editar">' +
        ico('editar', 15) + 'Editar</button>' +
      (inactivo
        ? '<button type="button" class="btn btn-sm btn-ok" data-accion="activar">' +
          ico('check', 15) + 'Reactivar</button>'
        : '<button type="button" class="btn btn-sm btn-ghost" data-accion="desactivar">' +
          ico('candado', 15) + 'Desactivar</button>');

    return '<article class="card hover-elevar" data-coach-id="' + esc(coach.id) + '">' +
      '<div class="card-body stack">' +

        '<div class="row wrap between">' +
          '<div class="persona">' +
            AG.Utils.avatar(coach, 'lg') +
            '<div class="persona-txt">' +
              '<b>' + esc(AG.Utils.nombreCompleto(coach)) + '</b>' +
              '<span>' + esc(coach.especialidad || 'Sin especialidad registrada') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="row-sm wrap">' +
            (esMejor ? '<span class="badge badge-rojo">' + ico('trofeo', 13) + ' Coach del mes</span>' : '') +
            (inactivo ? '<span class="badge badge-muted">Inactivo</span>'
                      : '<span class="badge badge-ok">Activo</span>') +
          '</div>' +
        '</div>' +

        bloqueEstrellas(m.calificacion, 'sm') +

        barra('Socios asignados', textoCupo, pctCupo,
          m.cupo > 0 && m.totalActivos > m.cupo ? 'error' : '') +

        '<div class="datos-grid">' +
          dato('Adherencia', m.totalActivos ? AG.Utils.pct(m.adherencia, 0) : '—') +
          dato('Mediciones del mes', m.totalActivos
            ? m.medicionesHechas + ' / ' + m.medicionesEsperadas : '—') +
          dato('Clases que imparte', m.clases.length ? String(m.clases.length) : 'Ninguna') +
        '</div>' +

      '</div>' +
      '<div class="card-foot"><div class="row-sm wrap">' + acciones + '</div></div>' +
      '</article>';
  }

  /** Aplica los filtros vivos sobre la lista de métricas. */
  function filtrarMetricas(lista) {
    var texto = AG.Utils.normalizar(filtros.texto);
    var salida = [];

    for (var i = 0; i < lista.length; i++) {
      var m = lista[i];
      var coach = m.coach;
      var inactivo = coach.activo === false;

      if (filtros.estado === 'activos' && inactivo) continue;
      if (filtros.estado === 'inactivos' && !inactivo) continue;

      if (texto) {
        var bolsa = AG.Utils.normalizar(
          AG.Utils.nombreCompleto(coach) + ' ' + (coach.especialidad || '') + ' ' + (coach.email || '')
        );
        if (bolsa.indexOf(texto) < 0) continue;
      }
      salida.push(m);
    }
    return salida;
  }

  /** Rejilla de tarjetas (o estado vacío). */
  function rejillaCoaches(lista, mejorId) {
    var visibles = filtrarMetricas(lista);

    if (!visibles.length) {
      var mensaje = lista.length
        ? 'Ningún coach coincide con la búsqueda o el filtro seleccionado.'
        : 'Todavía no hay coaches dados de alta. Registra al primero para empezar a asignar socios.';
      var accion = lista.length
        ? '<button type="button" class="btn btn-outline" data-limpiar>Limpiar filtros</button>'
        : '<button type="button" class="btn btn-primary" data-nuevo>' + ico('mas', 16) + 'Nuevo coach</button>';
      return '<div class="card"><div class="card-body">' + vacio('coach', mensaje, accion) + '</div></div>';
    }

    var html = '<div class="grid g3">';
    for (var i = 0; i < visibles.length; i++) {
      html += tarjetaCoach(visibles[i], visibles[i].coach.id === mejorId);
    }
    return html + '</div>';
  }

  /** KPIs de cabecera del listado. */
  function kpisEquipo(lista) {
    var coachesActivos = 0, sociosAtendidos = 0, i;
    for (i = 0; i < lista.length; i++) {
      if (lista[i].coach.activo !== false) coachesActivos++;
      sociosAtendidos += lista[i].totalActivos;
    }

    var calificacionesCoach = AG.DB.donde('calificaciones', function (c) { return c.tipo === 'coach'; });
    var promedioEquipo = AG.Calc.promedioCalificacion(calificacionesCoach);

    var periodo = periodoActual();
    var medicionesMes = AG.DB.donde('mediciones', function (m) {
      var suyo = m.periodo ? String(m.periodo).slice(0, 7) : AG.Utils.mesDe(m.fecha);
      return suyo === periodo;
    }).length;

    var sociosGym = AG.DB.donde('usuarios', function (u) {
      return u.rol === 'socio' && u.estado === 'activo';
    });
    var sumaAdherencia = 0;
    for (i = 0; i < sociosGym.length; i++) sumaAdherencia += adherenciaDe(sociosGym[i]).pct;
    var adherenciaGym = sociosGym.length ? Math.round(sumaAdherencia / sociosGym.length) : 0;

    function kpi(clase, iconoNombre, valor, etiqueta, pie) {
      return '<article class="kpi ' + clase + '">' +
        '<div class="kpi-icono">' + ico(iconoNombre, 22) + '</div>' +
        '<div class="kpi-datos">' +
          '<div class="kpi-val">' + esc(valor) + '</div>' +
          '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
          (pie ? '<div class="kpi-trend">' + esc(pie) + '</div>' : '') +
        '</div>' +
        '</article>';
    }

    return '<div class="grid g5">' +
      kpi('', 'coach', String(coachesActivos), 'Coaches activos',
        lista.length ? 'de ' + lista.length + ' en total' : '') +
      kpi('kpi-info', 'socios', String(sociosAtendidos), 'Socios atendidos', 'con coach asignado') +
      kpi('kpi-warn', 'estrella',
        promedioEquipo.total ? AG.Utils.num(promedioEquipo.promedio, 1) : '—',
        'Calificación del equipo',
        promedioEquipo.total ? promedioEquipo.total + ' reseñas' : 'sin reseñas') +
      kpi('kpi-ok', 'balanza', String(medicionesMes), 'Mediciones del mes',
        AG.Utils.nombreMes(periodo)) +
      kpi(adherenciaGym >= 70 ? 'kpi-ok' : 'kpi-warn', 'fuego', AG.Utils.pct(adherenciaGym, 0),
        'Adherencia del gimnasio', 'últimos 30 días') +
      '</div>';
  }

  /** Comparativas del equipo en barras. */
  function comparativaEquipo(lista) {
    var activos = [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].coach.activo !== false) activos.push(lista[i]);
    }

    if (!activos.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('grafica', 'Cuando tengas coaches activos verás aquí la comparativa del equipo.') +
        '</div></div>';
    }

    var datosSocios = [], datosCalificacion = [], m, j;
    for (j = 0; j < activos.length; j++) {
      m = activos[j];
      datosSocios.push({
        etiqueta: m.coach.nombre || AG.Utils.nombreCompleto(m.coach),
        valor: m.totalActivos,
        color: m.coach.avatarColor || AG.Utils.colorDe(m.coach.id)
      });
      if (m.calificacion.total) {
        datosCalificacion.push({
          etiqueta: m.coach.nombre || AG.Utils.nombreCompleto(m.coach),
          valor: m.calificacion.promedio,
          color: m.coach.avatarColor || AG.Utils.colorDe(m.coach.id)
        });
      }
    }

    var graficaCalificacion = datosCalificacion.length
      ? AG.Charts.barras(datosCalificacion, { alto: 250, decimales: 1, ticks: 5, etiquetaY: 'Estrellas' })
      : vacio('estrella', 'Ningún coach tiene reseñas todavía.');

    return '<div class="grid g2">' +
      '<section class="card">' +
        '<div class="card-head"><div><h3 class="card-title">' + ico('socios', 16) +
        'Socios activos por coach</h3><p class="card-sub">Carga real de trabajo del equipo</p></div></div>' +
        '<div class="card-body">' +
          AG.Charts.barras(datosSocios, { alto: 250, decimales: 0, etiquetaY: 'Socios' }) +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><div><h3 class="card-title">' + ico('estrella', 16) +
        'Calificación por coach</h3><p class="card-sub">Promedio de las reseñas de sus socios</p></div></div>' +
        '<div class="card-body">' + graficaCalificacion + '</div>' +
      '</section>' +
      '</div>';
  }

  /** Barra de búsqueda y filtros. */
  function barraFiltros(lista) {
    var activos = 0, inactivos = 0, i;
    for (i = 0; i < lista.length; i++) {
      if (lista[i].coach.activo === false) inactivos++; else activos++;
    }

    function chip(clave, etiqueta, cuantos) {
      return '<button type="button" class="chip' + (filtros.estado === clave ? ' on' : '') +
        '" data-filtro="' + clave + '">' + esc(etiqueta) + ' <b>' + cuantos + '</b></button>';
    }

    return '<div class="card"><div class="card-body">' +
      '<div class="row wrap between">' +
        '<div class="field flex1" style="max-width:380px">' +
          '<label class="label solo-lectores" for="coach-buscar">Buscar coach</label>' +
          '<input class="input" id="coach-buscar" type="search" data-buscar ' +
          'placeholder="Buscar por nombre, especialidad o correo…" value="' + esc(filtros.texto) + '">' +
        '</div>' +
        '<div class="chips">' +
          chip('activos', 'Activos', activos) +
          chip('inactivos', 'Inactivos', inactivos) +
          chip('todos', 'Todos', lista.length) +
        '</div>' +
      '</div>' +
      '</div></div>';
  }

  /** Pinta la vista 'director/coaches'. */
  function renderListado(ctx) {
    if (!ctx || !ctx.usuario || ctx.usuario.rol !== 'director') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('candado', 'Solo dirección puede administrar al equipo de coaches.') +
        '</div></div></div>';
    }

    limpiarCaches();

    var coaches = AG.Utils.ordenar(AG.DB.coaches(), function (c) {
      return AG.Utils.nombreCompleto(c);
    }, 'asc');

    var lista = [], i, m;
    for (i = 0; i < coaches.length; i++) {
      m = metricasDe(coaches[i]);
      if (m) lista.push(m);
    }

    var ranking = rankingDelMes(lista);
    var mejorId = ranking.length ? ranking[0].metricas.coach.id : '';

    var html = '<div class="page stack">' +

      '<header class="page-head">' +
        '<div>' +
          '<h1 class="page-title">Coaches</h1>' +
          '<p class="page-sub">Equipo de entrenamiento, carga de socios y desempeño del mes.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-primary" data-nuevo>' + ico('mas', 16) + 'Nuevo coach</button>' +
        '</div>' +
      '</header>' +

      kpisEquipo(lista) +
      barraFiltros(lista) +
      '<div data-lista-coaches>' + rejillaCoaches(lista, mejorId) + '</div>' +

      '<section class="stack">' +
        '<h2 class="card-title">' + ico('grafica', 17) + 'Comparativa del equipo</h2>' +
        comparativaEquipo(lista) +
      '</section>' +

      '</div>';

    return {
      html: html,
      listo: function (root) {
        function repintar() {
          var caja = AG.Utils.$('[data-lista-coaches]', root);
          if (caja) caja.innerHTML = rejillaCoaches(lista, mejorId);
        }

        AG.Utils.delegar(root, 'input', '[data-buscar]', AG.Utils.debounce(function () {
          filtros.texto = String(this.value || '');
          repintar();
        }, 220));

        AG.Utils.delegar(root, 'click', '[data-filtro]', function () {
          filtros.estado = this.getAttribute('data-filtro') || 'activos';
          var chips = AG.Utils.$$('[data-filtro]', root);
          for (var k = 0; k < chips.length; k++) {
            chips[k].classList.toggle('on', chips[k].getAttribute('data-filtro') === filtros.estado);
          }
          repintar();
        });

        AG.Utils.delegar(root, 'click', '[data-limpiar]', function () {
          filtros.texto = '';
          filtros.estado = 'todos';
          var campo = AG.Utils.$('[data-buscar]', root);
          if (campo) campo.value = '';
          var chips = AG.Utils.$$('[data-filtro]', root);
          for (var k = 0; k < chips.length; k++) {
            chips[k].classList.toggle('on', chips[k].getAttribute('data-filtro') === 'todos');
          }
          repintar();
        });

        AG.Utils.delegar(root, 'click', '[data-nuevo]', function () { abrirFormulario(null); });

        AG.Utils.delegar(root, 'click', '[data-accion]', function () {
          var tarjeta = this.closest('[data-coach-id]');
          var id = tarjeta ? tarjeta.getAttribute('data-coach-id') : '';
          if (!id) return;
          var accion = this.getAttribute('data-accion');
          if (accion === 'ver') AG.Router.ir({ path: 'director/coach', params: { id: id } });
          else if (accion === 'editar') abrirFormulario(id);
          else if (accion === 'desactivar') desactivarCoach(id);
          else if (accion === 'activar') activarCoach(id);
        });
      }
    };
  }

  /* =========================================================
     5. Ficha del coach — 'director/coach'
     ========================================================= */

  /** Encabezado con datos de contacto y botones. */
  function encabezadoFicha(m) {
    var coach = m.coach;
    var inactivo = coach.activo === false;
    var whatsapp = enlaceWhatsApp(coach.telefono);

    var contacto = '<div class="chips mt-sm">';
    if (coach.email) {
      contacto += '<span class="pill">' + ico('correo', 14) + esc(coach.email) + '</span>';
    }
    if (coach.telefono) {
      contacto += '<span class="pill">' + ico('telefono', 14) + esc(coach.telefono) + '</span>';
    }
    if (coach.horario) {
      contacto += '<span class="pill">' + ico('reloj', 14) + esc(coach.horario) + '</span>';
    }
    contacto += '<span class="pill">' + ico('calendario', 14) +
      esc('Antigüedad: ' + AG.Calc.antiguedadTexto(coach.fechaContratacion)) + '</span>';
    contacto += '</div>';

    var certificaciones = (Object.prototype.toString.call(coach.certificaciones) === '[object Array]')
      ? coach.certificaciones : [];
    var listaCert = '';
    if (certificaciones.length) {
      listaCert = '<div class="chips mt-sm">';
      for (var i = 0; i < certificaciones.length; i++) {
        listaCert += '<span class="chip chip-sm">' + ico('escudo', 13) + esc(certificaciones[i]) + '</span>';
      }
      listaCert += '</div>';
    }

    return '<section class="card">' +
      '<div class="card-body stack">' +
        '<div class="row wrap between">' +
          '<div class="row wrap">' +
            AG.Utils.avatar(coach, 'xl') +
            '<div class="stack-sm">' +
              '<div class="row-sm wrap">' +
                '<h2 class="page-title">' + esc(AG.Utils.nombreCompleto(coach)) + '</h2>' +
                (inactivo ? '<span class="badge badge-muted">Inactivo</span>'
                          : '<span class="badge badge-ok">Activo</span>') +
              '</div>' +
              '<p class="muted">' + esc(coach.especialidad || 'Sin especialidad registrada') + '</p>' +
              bloqueEstrellas(m.calificacion, 'lg') +
            '</div>' +
          '</div>' +
          '<div class="row-sm wrap">' +
            '<button type="button" class="btn btn-primary btn-sm" data-accion="editar">' +
              ico('editar', 15) + 'Editar</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-ir-socios>' +
              ico('socios', 15) + 'Ver socios</button>' +
            (whatsapp
              ? '<a class="btn btn-ghost btn-sm" href="' + esc(whatsapp) +
                '" target="_blank" rel="noopener noreferrer">' + ico('whatsapp', 15) + 'WhatsApp</a>'
              : '') +
          '</div>' +
        '</div>' +

        contacto +
        listaCert +
        (coach.bio ? '<p class="muted">' + esc(coach.bio) + '</p>' : '') +

        '<hr class="sep">' +
        '<div class="datos-grid">' +
          dato('Socios activos', m.cupo > 0 ? m.totalActivos + ' / ' + m.cupo : String(m.totalActivos)) +
          dato('Contratación', coach.fechaContratacion
            ? AG.Utils.fecha(coach.fechaContratacion, 'corto') : 'Sin registrar') +
          dato('Sueldo mensual', ent(coach.sueldo) > 0 ? AG.Utils.dinero(coach.sueldo) : 'Sin registrar') +
          dato('Clases a la semana', m.clases.length ? String(m.clases.length) : 'Ninguna') +
        '</div>' +
      '</div>' +
      '</section>';
  }

  /** Anillo de progreso con su pie de texto. */
  function anillo(pct, etiqueta, textoCentro, pie, invertir) {
    var opciones = { alto: 132, etiqueta: etiqueta, invertir: !!invertir };
    if (textoCentro) opciones.texto = textoCentro;
    return '<div class="stack-sm" style="align-items:center;text-align:center">' +
      '<div class="anillo">' + AG.Charts.progreso(pct, opciones) + '</div>' +
      '<span class="mini muted">' + esc(pie) + '</span>' +
      '</div>';
  }

  /** Tarjeta de desempeño con los anillos y la distribución de estrellas. */
  function desempenoFicha(m) {
    var anillos = '<div class="anillos">';

    anillos += anillo(
      m.calificacion.total ? m.calificacion.promedio / 5 * 100 : 0,
      'Calificación',
      m.calificacion.total ? AG.Utils.num(m.calificacion.promedio, 1) : '—',
      m.calificacion.total ? m.calificacion.total + ' reseñas recibidas' : 'Aún sin reseñas'
    );

    anillos += anillo(m.retencion, 'Retención', null,
      m.totalSocios
        ? m.totalActivos + ' de ' + m.totalSocios + ' socios siguen activos'
        : 'Sin socios asignados');

    anillos += anillo(m.adherencia, 'Adherencia', null,
      m.totalActivos ? 'Promedio de sus socios (30 días)' : 'Sin socios activos');

    anillos += anillo(
      m.progreso === null ? 0 : m.progreso,
      'Progreso',
      m.progreso === null ? '—' : String(m.progreso),
      m.progreso === null
        ? 'Falta cerrar mediciones de ' + AG.Utils.nombreMes(periodoCerrado())
        : 'Puntaje medio en ' + AG.Utils.nombreMes(periodoCerrado()) +
          ' (' + m.sociosConProgreso + (m.sociosConProgreso === 1 ? ' socio)' : ' socios)')
    );

    anillos += anillo(m.cobertura, 'Mediciones', null,
      m.totalActivos
        ? m.medicionesHechas + ' de ' + m.medicionesEsperadas + ' socios medidos en ' +
          AG.Utils.nombreMes(periodoActual())
        : 'Sin socios activos');

    anillos += '</div>';

    var distribucion = '';
    if (m.calificacion.total) {
      distribucion = '<hr class="sep"><div class="dist-cal">';
      for (var estrella = 5; estrella >= 1; estrella--) {
        var cuantas = ent(m.calificacion.distribucion[estrella]);
        var pct = m.calificacion.total ? cuantas / m.calificacion.total * 100 : 0;
        distribucion += '<span class="dist-nivel">' + estrella + ' ★</span>' +
          '<div class="bar"><span class="bar-fill warn" style="width:' + acotarPct(pct) + '%"></span></div>' +
          '<span class="dist-total">' + cuantas + '</span>';
      }
      distribucion += '</div>';
    }

    return '<section class="card">' +
      '<div class="card-head"><div><h3 class="card-title">' + ico('meta', 16) + 'Desempeño</h3>' +
      '<p class="card-sub">Indicadores clave de su trabajo con los socios</p></div></div>' +
      '<div class="card-body stack">' + anillos + distribucion + '</div>' +
      '</section>';
  }

  /** Evolución mensual de la calificación del coach. */
  function evolucionCalificacion(m) {
    var porMes = AG.Utils.agrupar(m.calificaciones, function (c) { return AG.Utils.mesDe(c.fecha); });
    var claves = [];
    var llave;

    for (llave in porMes) {
      if (!Object.prototype.hasOwnProperty.call(porMes, llave)) continue;
      if (!/^\d{4}-\d{2}$/.test(llave)) continue;
      claves.push(llave);
    }
    claves.sort();
    if (claves.length > 12) claves = claves.slice(claves.length - 12);

    if (claves.length < 2) {
      return '<section class="card">' +
        '<div class="card-head"><div><h3 class="card-title">' + ico('historial', 16) +
        'Evolución de su calificación</h3></div></div>' +
        '<div class="card-body">' +
        vacio('estrella', claves.length
          ? 'Con reseñas de un solo mes todavía no se puede dibujar la evolución.'
          : 'Este coach aún no recibe reseñas de sus socios.') +
        '</div></section>';
    }

    var puntos = [];
    for (var i = 0; i < claves.length; i++) {
      var promedio = AG.Utils.promedio(porMes[claves[i]], 'estrellas');
      puntos.push({
        x: claves[i],
        y: Math.round(promedio * 100) / 100,
        etiqueta: etiquetaMes(claves[i])
      });
    }

    return '<section class="card">' +
      '<div class="card-head"><div><h3 class="card-title">' + ico('historial', 16) +
      'Evolución de su calificación</h3>' +
      '<p class="card-sub">Promedio de estrellas mes con mes</p></div></div>' +
      '<div class="card-body">' +
        AG.Charts.linea(puntos, {
          alto: 250,
          decimales: 1,
          suave: true,
          area: true,
          etiquetaY: 'Estrellas',
          color: 'var(--warn,#F59E0B)',
          vacio: 'Aún no hay reseñas suficientes para trazar la evolución.'
        }) +
      '</div></section>';
  }

  /** Lista compacta de los socios del coach. */
  function sociosFicha(m) {
    if (!m.socios.length) {
      return '<section class="card" id="coach-socios">' +
        '<div class="card-head"><div><h3 class="card-title">' + ico('socios', 16) + 'Sus socios</h3></div></div>' +
        '<div class="card-body">' +
        vacio('socios', 'Este coach todavía no tiene socios asignados. Asígnale socios desde la pantalla de Socios.') +
        '</div></section>';
    }

    var ordenados = AG.Utils.ordenar(m.socios, function (s) {
      return (s.estado === 'activo' ? '0' : '1') + AG.Utils.nombreCompleto(s);
    }, 'asc');

    var filas = '';
    for (var i = 0; i < ordenados.length; i++) {
      var socio = ordenados[i];
      var progreso = AG.Calc.progresoObjetivo(socio, AG.DB.medicionesDe(socio.id));
      var pct = acotarPct(progreso.pct);
      var objetivo = AG.Calc.ETIQUETA_OBJETIVO[socio.objetivo] || 'Objetivo sin definir';
      var adh = socio.estado === 'activo' ? adherenciaDe(socio) : null;

      filas += '<a class="list-item" href="#/director/socio?id=' + esc(socio.id) + '">' +
        AG.Utils.avatar(socio, 'sm') +
        '<div class="list-item-main">' +
          '<b>' + esc(AG.Utils.nombreCompleto(socio)) + '</b>' +
          '<span>' + esc(objetivo) +
          (adh ? esc(' · Adherencia ' + AG.Utils.pct(adh.pct, 0)) : '') + '</span>' +
        '</div>' +
        '<div class="list-item-side stack-sm" style="min-width:120px">' +
          badgeEstadoSocio(socio) +
          '<div class="bar bar-fina"><span class="bar-fill ' + claseSegunPct(pct) +
          '" style="width:' + pct + '%"></span></div>' +
          '<span class="mini muted">Progreso ' + pct + '%</span>' +
        '</div>' +
        '</a>';
    }

    return '<section class="card" id="coach-socios">' +
      '<div class="card-head">' +
        '<div><h3 class="card-title">' + ico('socios', 16) + 'Sus socios</h3>' +
        '<p class="card-sub">' + m.totalActivos + ' activos de ' + m.totalSocios + ' asignados</p></div>' +
      '</div>' +
      '<div class="card-body"><div class="list">' + filas + '</div></div>' +
      '</section>';
  }

  /** Reseñas recibidas, con la respuesta de dirección. */
  function resenasFicha(m) {
    if (!m.calificaciones.length) {
      return '<section class="card">' +
        '<div class="card-head"><div><h3 class="card-title">' + ico('chat', 16) + 'Reseñas recibidas</h3></div></div>' +
        '<div class="card-body">' +
        vacio('estrella', 'Sus socios todavía no le han dejado ninguna reseña.') +
        '</div></section>';
    }

    var filas = '';
    for (var i = 0; i < m.calificaciones.length; i++) {
      var c = m.calificaciones[i];
      var socio = AG.DB.usuario(c.socioId);
      var autor = socio ? AG.Utils.nombreCompleto(socio) : 'Socio del gimnasio';
      var respuesta = (c.respuesta && c.respuesta.texto) ? c.respuesta : null;
      var quienRespondio = respuesta ? AG.DB.usuario(respuesta.por) : null;

      filas += '<article class="caja stack-sm" data-calificacion="' + esc(c.id) + '">' +
        '<div class="row wrap between">' +
          '<div class="row-sm wrap">' +
            AG.Utils.estrellas(c.estrellas, { size: 15 }) +
            '<b class="mini">' + esc(autor) + '</b>' +
          '</div>' +
          '<span class="mini muted">' + esc(AG.Utils.fecha(c.fecha, 'corto')) + '</span>' +
        '</div>' +
        (c.comentario ? '<p class="muted">' + esc(c.comentario) + '</p>' : '') +
        (respuesta
          ? '<div class="aviso aviso-rojo">' + ico('chat', 16) +
              '<div class="stack-sm flex1">' +
                '<span class="micro txt-rojo">Respuesta de dirección</span>' +
                '<p class="mini">' + esc(respuesta.texto) + '</p>' +
                '<span class="mini muted">' +
                  esc((quienRespondio ? AG.Utils.nombreCompleto(quienRespondio) : 'Dirección') +
                      ' · ' + AG.Utils.fecha(respuesta.fecha, 'corto')) +
                '</span>' +
              '</div>' +
            '</div>'
          : '') +
        '<div class="row-sm wrap">' +
          '<button type="button" class="btn btn-sm btn-ghost" data-responder="' + esc(c.id) + '">' +
            ico('chat', 14) + (respuesta ? 'Editar respuesta' : 'Responder') + '</button>' +
        '</div>' +
        '</article>';
    }

    return '<section class="card">' +
      '<div class="card-head">' +
        '<div><h3 class="card-title">' + ico('chat', 16) + 'Reseñas recibidas</h3>' +
        '<p class="card-sub">' + m.calificaciones.length +
        (m.calificaciones.length === 1 ? ' reseña' : ' reseñas') + ' de sus socios</p></div>' +
      '</div>' +
      '<div class="card-body stack">' + filas + '</div>' +
      '</section>';
  }

  /** Clases que imparte y carga horaria semanal. */
  function clasesFicha(m) {
    if (!m.clases.length) {
      return '<section class="card">' +
        '<div class="card-head"><div><h3 class="card-title">' + ico('clase', 16) + 'Clases que imparte</h3></div></div>' +
        '<div class="card-body">' +
        vacio('clase', 'Este coach no tiene clases grupales asignadas por ahora.') +
        '</div></section>';
    }

    var ordenDias = { lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3, jueves: 4, viernes: 5, sabado: 6, 'sábado': 6, domingo: 7 };
    var clases = m.clases.slice().sort(function (a, b) {
      var da = ordenDias[String(a.dia || '').toLowerCase()] || 9;
      var db = ordenDias[String(b.dia || '').toLowerCase()] || 9;
      if (da !== db) return da - db;
      return String(a.hora || '') < String(b.hora || '') ? -1 : 1;
    });

    var filas = '', totalInscritos = 0;
    for (var i = 0; i < clases.length; i++) {
      var cl = clases[i];
      var inscritos = (Object.prototype.toString.call(cl.inscritos) === '[object Array]') ? cl.inscritos.length : 0;
      var cupo = ent(cl.cupo);
      totalInscritos += inscritos;

      filas += '<div class="list-item">' +
        '<div class="list-item-main">' +
          '<b>' + esc(cl.nombre || 'Clase') + '</b>' +
          '<span>' + esc(AG.Utils.capitalizar(cl.dia || '') + ' · ' + AG.Utils.fecha(cl.hora, 'hora') +
            ' · ' + ent(cl.duracionMin) + ' min' + (cl.salon ? ' · ' + cl.salon : '')) + '</span>' +
        '</div>' +
        '<div class="list-item-side stack-sm" style="min-width:110px">' +
          '<span class="mini muted">' + inscritos + (cupo ? ' / ' + cupo : '') + ' inscritos</span>' +
          '<div class="bar bar-fina"><span class="bar-fill" style="width:' +
          acotarPct(cupo ? inscritos / cupo * 100 : 0) + '%"></span></div>' +
        '</div>' +
        '</div>';
    }

    var horas = Math.round(m.minutosSemana / 6) / 10;

    return '<section class="card">' +
      '<div class="card-head">' +
        '<div><h3 class="card-title">' + ico('clase', 16) + 'Clases que imparte</h3>' +
        '<p class="card-sub">Carga horaria semanal</p></div>' +
      '</div>' +
      '<div class="card-body stack">' +
        '<div class="datos-grid">' +
          dato('Clases por semana', String(clases.length)) +
          dato('Horas frente a grupo', AG.Utils.num(horas, 1) + ' h') +
          dato('Personas inscritas', String(totalInscritos)) +
        '</div>' +
        '<div class="list">' + filas + '</div>' +
      '</div>' +
      '</section>';
  }

  /** Bloque de reconocimientos del mes. */
  function reconocimientosFicha(m, ranking) {
    var posicion = -1, propio = null, i;
    for (i = 0; i < ranking.length; i++) {
      if (ranking[i].metricas.coach.id === m.coach.id) { posicion = i; propio = ranking[i]; break; }
    }

    var cabecera = '<div class="card-head"><div><h3 class="card-title">' + ico('trofeo', 16) +
      'Reconocimientos</h3><p class="card-sub">Puntaje combinado de ' +
      esc(AG.Utils.nombreMes(periodoActual())) + '</p></div></div>';

    if (!propio) {
      return '<section class="card">' + cabecera + '<div class="card-body">' +
        vacio('trofeo', 'Para entrar al reconocimiento del mes hacen falta socios activos y al menos una reseña.') +
        '</div></section>';
    }

    var desglose = '<div class="datos-grid">' +
      dato('Puntaje combinado', String(propio.puntaje) + ' / 100') +
      dato('Calificación (40 %)', m.calificacion.total ? AG.Utils.num(m.calificacion.promedio, 1) + ' ★' : '—') +
      dato('Adherencia (25 %)', AG.Utils.pct(m.adherencia, 0)) +
      dato('Mediciones (20 %)', AG.Utils.pct(m.cobertura, 0)) +
      dato('Retención (15 %)', AG.Utils.pct(m.retencion, 0)) +
      '</div>';

    if (posicion === 0) {
      return '<section class="card card-rojo">' + cabecera +
        '<div class="card-body stack">' +
          '<div class="row wrap">' +
            '<div class="kpi-icono">' + ico('trofeo', 24) + '</div>' +
            '<div class="stack-sm">' +
              '<b class="xbold">Mejor coach del mes</b>' +
              '<span class="mini muted">Lidera al equipo con ' + propio.puntaje +
              ' puntos de 100 entre ' + ranking.length + ' coaches evaluados.</span>' +
            '</div>' +
          '</div>' +
          desglose +
        '</div></section>';
    }

    var lider = ranking[0];
    return '<section class="card">' + cabecera +
      '<div class="card-body stack">' +
        '<div class="row wrap">' +
          '<div class="kpi-icono">' + ico('meta', 22) + '</div>' +
          '<div class="stack-sm">' +
            '<b class="xbold">Lugar ' + (posicion + 1) + ' de ' + ranking.length + '</b>' +
            '<span class="mini muted">' +
              esc('Encabeza ' + AG.Utils.nombreCompleto(lider.metricas.coach) + ' con ' +
                  lider.puntaje + ' puntos; faltan ' + (lider.puntaje - propio.puntaje) +
                  ' para alcanzarlo.') +
            '</span>' +
          '</div>' +
        '</div>' +
        desglose +
      '</div></section>';
  }

  /** Modal para responder (o corregir) una reseña. */
  function responderResena(calificacionId, usuario) {
    var calificacion = AG.DB.buscar('calificaciones', calificacionId);
    if (!calificacion) {
      AG.Utils.toast('Esa reseña ya no está en la base.', 'error');
      return;
    }

    var previo = (calificacion.respuesta && calificacion.respuesta.texto) ? calificacion.respuesta.texto : '';

    AG.Utils.modal({
      titulo: previo ? 'Editar respuesta' : 'Responder reseña',
      ancho: 'md',
      cuerpo: '<div class="stack">' +
        '<div class="caja card-suave stack-sm">' +
          AG.Utils.estrellas(calificacion.estrellas, { size: 16 }) +
          (calificacion.comentario ? '<p class="mini muted">' + esc(calificacion.comentario) + '</p>' : '') +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="resp-texto">Respuesta de dirección</label>' +
          '<textarea class="textarea" id="resp-texto" rows="4" maxlength="480" ' +
          'placeholder="Agradece la reseña y di qué van a hacer al respecto.">' + esc(previo) + '</textarea>' +
          '<p class="help">La verá el socio junto a su reseña.</p>' +
        '</div>' +
        '</div>',
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost', cerrar: true, onClick: function (api) { api.cerrar(); } },
        {
          texto: 'Guardar respuesta',
          clase: 'btn-primary',
          cerrar: true,
          onClick: function (api) {
            var campo = AG.Utils.$('#resp-texto', api.root);
            var texto = campo ? String(campo.value || '').trim() : '';
            if (!texto) {
              AG.Utils.toast('Escribe la respuesta antes de guardarla.', 'error');
              if (campo) { try { campo.focus(); } catch (e) { /* sin foco disponible */ } }
              return false;
            }
            AG.DB.actualizar('calificaciones', calificacion.id, {
              respuesta: {
                texto: texto,
                por: usuario ? usuario.id : '',
                fecha: AG.Utils.hoy()
              }
            });
            if (calificacion.socioId) {
              AG.DB.notificar(calificacion.socioId, {
                titulo: 'Dirección respondió tu reseña',
                cuerpo: AG.Utils.truncar(texto, 120),
                tipo: 'aviso',
                link: '#/socio/calificar'
              });
            }
            AG.Utils.toast('Respuesta publicada.', 'ok');
            api.cerrar();
            AG.Router.refrescar();
            return true;
          }
        }
      ]
    });
  }

  /** Pinta la vista 'director/coach'. */
  function renderFicha(ctx) {
    function pantalla(mensaje) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('coach', mensaje,
          '<a class="btn btn-primary" href="#/director/coaches">' + ico('flecha-izq', 16) +
          'Volver a coaches</a>') +
        '</div></div></div>';
    }

    if (!ctx || !ctx.usuario || ctx.usuario.rol !== 'director') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('candado', 'Solo dirección puede consultar la ficha de un coach.') +
        '</div></div></div>';
    }

    var id = (ctx.params && ctx.params.id) ? String(ctx.params.id) : '';
    if (!id) return pantalla('No indicaste qué coach quieres consultar.');

    var coach = AG.DB.usuario(id);
    if (!coach || coach.rol !== 'coach') {
      return pantalla('No encontramos a ese coach: puede que lo hayan dado de baja de la base.');
    }

    limpiarCaches();

    var m = metricasDe(coach);
    var todos = AG.DB.coaches();
    var listaMetricas = [], i;
    for (i = 0; i < todos.length; i++) {
      listaMetricas.push(todos[i].id === coach.id ? m : metricasDe(todos[i]));
    }
    var ranking = rankingDelMes(listaMetricas);

    var html = '<div class="page stack">' +

      '<header class="page-head">' +
        '<div>' +
          '<a class="btn btn-ghost btn-sm" href="#/director/coaches">' +
            ico('flecha-izq', 15) + 'Coaches</a>' +
          '<h1 class="page-title mt-sm">Ficha del coach</h1>' +
          '<p class="page-sub">Desempeño, socios, reseñas y clases de ' +
            esc(AG.Utils.nombreCompleto(coach)) + '.</p>' +
        '</div>' +
      '</header>' +

      encabezadoFicha(m) +
      desempenoFicha(m) +
      evolucionCalificacion(m) +
      reconocimientosFicha(m, ranking) +
      sociosFicha(m) +
      resenasFicha(m) +
      clasesFicha(m) +

      '</div>';

    return {
      html: html,
      listo: function (root) {
        AG.Utils.delegar(root, 'click', '[data-accion="editar"]', function () {
          abrirFormulario(coach.id);
        });

        AG.Utils.delegar(root, 'click', '[data-ir-socios]', function () {
          var destino = AG.Utils.$('#coach-socios', root);
          if (!destino) return;
          try { destino.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          catch (e) { destino.scrollIntoView(); }
        });

        AG.Utils.delegar(root, 'click', '[data-responder]', function () {
          responderResena(this.getAttribute('data-responder'), ctx.usuario);
        });
      }
    };
  }

  /* =========================================================
     6. Exportación y registro de rutas
     ========================================================= */

  AG.Mod.Coaches = {
    render: renderListado,
    ficha: renderFicha,
    formulario: abrirFormulario,
    tarjeta: tarjetaCoach,
    metricas: metricasDe,
    puntajeCombinado: puntajeCombinado
  };

  AG.Router.registrar({
    path: 'director/coaches',
    roles: ['director'],
    titulo: 'Coaches',
    nav: { etiqueta: 'Coaches', icono: 'coach', grupo: 'Entrenamiento', orden: 1 },
    render: renderListado
  });

  AG.Router.registrar({
    path: 'director/coach',
    roles: ['director'],
    titulo: 'Ficha del coach',
    nav: null,
    render: renderFicha
  });

})(window.AG);
