/* =============================================================
   ALLIANCE GYM — AG.Mod.Calificaciones
   Reseñas del gimnasio y de los coaches.

   - Vista de dirección: Resumen · Reseñas · Coaches.
   - Vista del coach: solo sus propias calificaciones (sin responder).
   - Piezas reutilizables:
       AG.Mod.Calificaciones.resumen(tipo, objetivoId)
       AG.Mod.Calificaciones.formulario(tipo, objetivoId, socioId, opciones)

   Reglas: JavaScript clásico, sin módulos ni dependencias externas.
   Todo el texto que viene de la base pasa por AG.Utils.esc().
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  /* =========================================================
     1. Constantes de dominio
     ========================================================= */

  /* Categorías que se califican del gimnasio */
  var CATS_GYM = [
    { clave: 'instalaciones', etiqueta: 'Instalaciones' },
    { clave: 'limpieza', etiqueta: 'Limpieza' },
    { clave: 'equipo', etiqueta: 'Equipo' },
    { clave: 'ambiente', etiqueta: 'Ambiente' }
  ];

  /* Categorías que se califican de un coach */
  var CATS_COACH = [
    { clave: 'atencion', etiqueta: 'Atención' },
    { clave: 'conocimiento', etiqueta: 'Conocimiento' },
    { clave: 'puntualidad', etiqueta: 'Puntualidad' },
    { clave: 'motivacion', etiqueta: 'Motivación' }
  ];

  var MESES_TENDENCIA = 8;     /* meses que dibuja la gráfica de tendencia */
  var PAGINA_RESENAS = 20;     /* reseñas por tanda en la lista de dirección */
  var MAX_COMENTARIO = 500;

  /* Sugerencias de mejora para el coach, por categoría peor evaluada */
  var SUGERENCIAS = {
    atencion: [
      'Dedica los dos primeros minutos de cada sesión a preguntar cómo llega el socio: sueño, energía y molestias. Ajusta la carga con esa respuesta.',
      'Evita empalmar más de dos socios en el mismo bloque de media hora. Si el horario pico te desborda, pide a dirección mover a alguien de turno.',
      'Cierra cada sesión con una indicación concreta para el siguiente entrenamiento: el socio se va con algo en la mano.'
    ],
    conocimiento: [
      'Explica en una frase el porqué de cada ejercicio: qué músculo trabaja y para qué le sirve al objetivo del socio.',
      'Cuando cambies una rutina, deja escrito el motivo del cambio en las notas de la asignación. El socio percibe criterio, no improvisación.',
      'Ten lista una variante de cada ejercicio clave para adaptarlo cuando hay molestia o la máquina está ocupada.'
    ],
    puntualidad: [
      'Llega cinco minutos antes de la primera sesión del día: un retraso temprano se arrastra a todo el turno.',
      'Deja diez minutos de colchón entre socios y avisa por mensaje en cuanto sepas que vas retrasado.',
      'Revisa tu agenda la noche anterior y confirma el horario con los socios que suelen moverlo.'
    ],
    motivacion: [
      'Muestra el comparativo de mediciones al cierre de cada mes: ver el avance en números motiva más que cualquier frase.',
      'Fija con cada socio una meta pequeña y medible para las próximas cuatro semanas, y reconócela cuando la cumpla.',
      'Cambia un ejercicio o el orden del bloque cada cuatro semanas para romper la monotonía sin perder el estímulo.'
    ]
  };

  /* =========================================================
     2. Estilos propios mínimos (variantes que el CSS base no trae)
     ========================================================= */

  var ESTILOS_ID = 'ag-estilos-calificaciones';

  var CSS_PROPIO = '' +
    '.cal-num{font-size:46px;font-weight:800;line-height:1;letter-spacing:-.03em;' +
      'color:var(--texto);font-variant-numeric:tabular-nums}' +
    '.cal-fila{display:grid;grid-template-columns:38px 1fr 96px;align-items:center;gap:9px;margin-bottom:8px}' +
    '.cal-fila:last-child{margin-bottom:0}' +
    '.cal-resena{border:1px solid var(--borde);border-radius:var(--radio-sm);padding:12px 13px;background:var(--panel-2)}' +
    '.cal-resena+.cal-resena{margin-top:10px}' +
    '.cal-resena.cal-urgente{border-color:var(--error);box-shadow:inset 3px 0 0 var(--error)}' +
    '.cal-respuesta{margin-top:10px;padding:9px 11px;border-left:3px solid var(--rojo);' +
      'background:var(--panel);border-radius:0 var(--radio-sm) var(--radio-sm) 0}' +
    '.cal-filtros{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}' +
    '.cal-pos{flex:0 0 auto;width:26px;text-align:center;font-weight:800;' +
      'font-variant-numeric:tabular-nums;color:var(--texto-3)}' +
    '.cal-pos.cal-podio{color:var(--rojo)}' +
    '.cal-sugerencia{display:flex;gap:10px;align-items:flex-start}' +
    '.cal-sugerencia .cal-bolita{flex:0 0 auto;width:22px;height:22px;border-radius:50%;' +
      'display:grid;place-items:center;font-size:11px;font-weight:800;' +
      'background:var(--panel-2);border:1px solid var(--borde);color:var(--texto-2)}' +
    '@media (max-width:520px){.cal-num{font-size:38px}' +
      '.cal-fila{grid-template-columns:34px 1fr 78px}}';

  function asegurarEstilos() {
    if (!document || document.getElementById(ESTILOS_ID)) return;
    var st = document.createElement('style');
    st.id = ESTILOS_ID;
    st.textContent = CSS_PROPIO;
    document.head.appendChild(st);
  }

  /* =========================================================
     3. Ayudantes generales
     ========================================================= */

  function esc(v) { return AG.Utils.esc(v); }

  function ico(nombre, tam) {
    try { return AG.Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function vacio(mensaje, nombreIcono) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + ico(nombreIcono || 'estrella', 34) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      '</div>';
  }

  function catsDe(tipo) {
    return tipo === 'coach' ? CATS_COACH : CATS_GYM;
  }

  function normalizarTipo(tipo) {
    return String(tipo || '') === 'coach' ? 'coach' : 'gimnasio';
  }

  /** Estrellas enteras y acotadas de una calificación. */
  function estrellasDe(cal) {
    var e = Math.round(Number(cal && cal.estrellas) || 0);
    if (!isFinite(e) || e < 1) return 0;
    return e > 5 ? 5 : e;
  }

  function tieneRespuesta(cal) {
    return !!(cal && cal.respuesta && String(cal.respuesta.texto || '').trim());
  }

  /** ¿Es una reseña crítica (1 o 2 estrellas) que sigue sin respuesta? */
  function requiereAtencion(cal) {
    var e = estrellasDe(cal);
    return e >= 1 && e <= 2 && !tieneRespuesta(cal);
  }

  /** Calificaciones filtradas por tipo y objetivo (ambos opcionales). */
  function listaDe(tipo, objetivoId) {
    var t = tipo || null;
    var o = objetivoId || null;
    return AG.DB.donde('calificaciones', function (c) {
      if (!c) return false;
      if (t && c.tipo !== t) return false;
      if (o && c.objetivoId !== o) return false;
      return true;
    });
  }

  function ordenarRecientes(lista) {
    return AG.Utils.ordenar(lista, 'fecha', 'desc');
  }

  /** 'sep 26' a partir de 'YYYY-MM'. */
  function etiquetaMes(mesKey) {
    var partes = String(mesKey || '').split('-');
    var m = Number(partes[1]);
    if (!(m >= 1 && m <= 12)) return String(mesKey || '');
    return AG.Utils.MESES_CORTOS[m - 1] + ' ' + String(partes[0]).slice(2);
  }

  /** Resta meses a 'YYYY-MM' y devuelve 'YYYY-MM'. */
  function mesMenos(mesKey, n) {
    return AG.Utils.mesDe(AG.Utils.sumaMeses(String(mesKey) + '-01', -(Number(n) || 0)));
  }

  /** Promedio de un mes concreto, o null si ese mes no tuvo reseñas. */
  function promedioDeMes(lista, mesKey) {
    var delMes = [], i;
    for (i = 0; i < lista.length; i++) {
      if (AG.Utils.mesDe(lista[i].fecha) === mesKey) delMes.push(lista[i]);
    }
    if (!delMes.length) return null;
    return AG.Calc.promedioCalificacion(delMes).promedio;
  }

  /** Ejes del radar: promedio 0-5 por categoría (solo las que tienen datos). */
  function ejesCategorias(lista, cats) {
    var ejes = [], i, j;
    for (i = 0; i < cats.length; i++) {
      var valores = [];
      for (j = 0; j < lista.length; j++) {
        var detalle = lista[j] && lista[j].detalle;
        var v = detalle ? Number(detalle[cats[i].clave]) : NaN;
        if (isFinite(v) && v >= 1 && v <= 5) valores.push(v);
      }
      if (!valores.length) continue;
      ejes.push({
        clave: cats[i].clave,
        etiqueta: cats[i].etiqueta,
        valor: Math.round(AG.Utils.promedio(valores) * 10) / 10,
        max: 5,
        total: valores.length
      });
    }
    return ejes;
  }

  /** Serie mensual de promedios para AG.Charts.linea. */
  function serieTendencia(lista, meses) {
    var n = Math.max(2, Number(meses) || MESES_TENDENCIA);
    var base = AG.Utils.mesActual();
    var puntos = [], i;
    for (i = n - 1; i >= 0; i--) {
      var mes = mesMenos(base, i);
      var prom = promedioDeMes(lista, mes);
      puntos.push({ x: mes, etiqueta: etiquetaMes(mes), y: prom });
    }
    return puntos;
  }

  /** NPS aproximado: promotores 5★, pasivos 4★, detractores 3★ o menos. */
  function calcularNPS(lista) {
    var pro = 0, pas = 0, det = 0, i;
    for (i = 0; i < lista.length; i++) {
      var e = estrellasDe(lista[i]);
      if (e === 5) pro++;
      else if (e === 4) pas++;
      else if (e >= 1) det++;
    }
    var total = pro + pas + det;
    return {
      promotores: pro,
      pasivos: pas,
      detractores: det,
      total: total,
      pctPro: total ? (pro / total) * 100 : 0,
      pctPas: total ? (pas / total) * 100 : 0,
      pctDet: total ? (det / total) * 100 : 0,
      valor: total ? Math.round((pro - det) / total * 100) : 0
    };
  }

  function claseNPS(valor) {
    if (valor >= 50) return 'pill-ok';
    if (valor >= 0) return 'pill-warn';
    return 'pill-rojo';
  }

  function claseBarraEstrella(e) {
    if (e >= 4) return 'ok';
    if (e === 3) return 'warn';
    return 'error';
  }

  /* =========================================================
     4. Piezas de interfaz reutilizables
     ========================================================= */

  /** Bloque grande: promedio, estrellas y total de reseñas. */
  function bloqueGlobal(res, etiqueta) {
    if (!res.total) {
      return vacio('Todavía no hay reseñas registradas' + (etiqueta ? ' de ' + etiqueta : '') + '.');
    }
    return '<div class="row wrap" style="gap:16px;align-items:center">' +
      '<div class="cal-num">' + esc(AG.Utils.num(res.promedio, 1)) + '</div>' +
      '<div class="stack-sm">' +
        AG.Utils.estrellas(res.promedio, { size: 20 }) +
        '<span class="mini muted">' + res.total +
          (res.total === 1 ? ' reseña registrada' : ' reseñas registradas') + '</span>' +
      '</div>' +
      '</div>';
  }

  /** Distribución de estrellas 5→1 en barras horizontales. */
  function bloqueDistribucion(res) {
    if (!res.total) return vacio('Sin reseñas suficientes para la distribución.', 'grafica');
    var html = '', e;
    for (e = 5; e >= 1; e--) {
      var n = res.distribucion[e] || 0;
      var pct = res.total ? (n / res.total) * 100 : 0;
      html += '<div class="cal-fila">' +
        '<span class="mini bold nowrap">' + e + ' ★</span>' +
        '<div class="bar"><span class="bar-fill ' + claseBarraEstrella(e) +
          '" style="width:' + (Math.round(pct * 10) / 10) + '%"></span></div>' +
        '<span class="mini muted nowrap">' + esc(AG.Utils.pct(pct, 0)) + ' · ' + n + '</span>' +
        '</div>';
    }
    return html;
  }

  /** Tarjeta con el radar de un juego de categorías. */
  function tarjetaRadar(titulo, subtitulo, lista, cats, color) {
    var ejes = ejesCategorias(lista, cats);
    return '<div class="card">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">' + esc(titulo) + '</h3>' +
        '<p class="card-sub">' + esc(subtitulo) + '</p>' +
      '</div></div>' +
      '<div class="card-body">' +
        AG.Charts.radar(ejes, {
          alto: 300,
          color: color,
          decimales: 1,
          vacio: 'Aún no hay suficientes reseñas con detalle por categoría.'
        }) +
      '</div></div>';
  }

  /** Tarjeta con la tendencia mensual del promedio. */
  function tarjetaTendencia(lista, titulo) {
    return '<div class="card">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">' + esc(titulo || 'Tendencia mensual') + '</h3>' +
        '<p class="card-sub">Promedio de estrellas de los últimos ' + MESES_TENDENCIA + ' meses</p>' +
      '</div></div>' +
      '<div class="card-body">' +
        AG.Charts.linea(serieTendencia(lista, MESES_TENDENCIA), {
          alto: 250,
          suave: true,
          area: true,
          decimales: 1,
          etiquetaY: 'Estrellas',
          vacio: 'Todavía no hay reseñas en los últimos meses.'
        }) +
      '</div></div>';
  }

  /** Autor visible de una reseña respetando el control de acceso. */
  function autorDe(cal, usuario) {
    var socio = AG.DB.usuario(cal.socioId);
    var puede = false;
    try { puede = !!(usuario && AG.Auth.puedeVer(usuario, cal.socioId)); } catch (e) { puede = false; }

    if (socio && puede) {
      return { avatar: AG.Utils.avatar(socio, 'sm'), nombre: AG.Utils.nombreCompleto(socio) };
    }
    var generico = { nombre: 'Socio', apellidos: '' };
    return {
      avatar: AG.Utils.avatar(generico, 'sm'),
      nombre: socio ? 'Socio del gimnasio' : 'Socio dado de baja'
    };
  }

  /** Texto de a quién va dirigida la reseña. */
  function destinoDe(cal) {
    if (cal.tipo !== 'coach') {
      var nombreGym = 'el gimnasio';
      try {
        if (AG.DB.state && AG.DB.state.settings && AG.DB.state.settings.nombreGym) {
          nombreGym = AG.DB.state.settings.nombreGym;
        }
      } catch (e) { nombreGym = 'el gimnasio'; }
      return nombreGym;
    }
    var coach = AG.DB.usuario(cal.objetivoId);
    return coach ? AG.Utils.nombreCompleto(coach) : 'Coach dado de baja';
  }

  /** Chips con el detalle por categoría. */
  function chipsDetalle(cal) {
    var cats = catsDe(cal.tipo);
    var detalle = cal.detalle || {};
    var html = '', i;
    for (i = 0; i < cats.length; i++) {
      var v = Number(detalle[cats[i].clave]);
      if (!isFinite(v) || v < 1 || v > 5) continue;
      html += '<span class="chip chip-sm">' + esc(cats[i].etiqueta) + ' · ' + Math.round(v) + ' ★</span>';
    }
    return html ? '<div class="chips mt-sm">' + html + '</div>' : '';
  }

  /**
   * HTML de una reseña completa.
   * opts: { usuario, responder:Boolean, mostrarDestino:Boolean }
   */
  function resenaHTML(cal, opts) {
    var o = opts || {};
    var autor = autorDe(cal, o.usuario);
    var urgente = requiereAtencion(cal);
    var estrellas = estrellasDe(cal);
    var comentario = String(cal.comentario || '').trim();

    var html = '<article class="cal-resena' + (urgente ? ' cal-urgente' : '') + '">';

    html += '<div class="row between wrap">';
    html += '<div class="persona">' + autor.avatar +
      '<div class="persona-txt"><b>' + esc(autor.nombre) + '</b>' +
      '<span class="mini muted">' + esc(AG.Utils.fecha(cal.fecha, 'corto')) + ' · ' +
      esc(AG.Utils.fechaRelativa(cal.fecha)) + '</span></div></div>';
    html += '<div class="row row-sm wrap">' + AG.Utils.estrellas(estrellas, { size: 15 }) +
      '<b class="nums">' + estrellas + '</b></div>';
    html += '</div>';

    if (o.mostrarDestino !== false) {
      html += '<p class="mini muted mt-sm">' +
        (cal.tipo === 'coach' ? 'Sobre el coach ' : 'Sobre ') +
        '<b>' + esc(destinoDe(cal)) + '</b></p>';
    }

    if (comentario) {
      html += '<p class="mt-sm">' + esc(comentario) + '</p>';
    } else {
      html += '<p class="mini muted mt-sm">La reseña se dejó sin comentario escrito.</p>';
    }

    html += chipsDetalle(cal);

    if (tieneRespuesta(cal)) {
      var autorResp = AG.DB.usuario(cal.respuesta.por);
      html += '<div class="cal-respuesta">' +
        '<span class="mini bold txt-rojo">' + ico('chat', 13) + ' Respuesta de dirección</span>' +
        '<p class="mt-sm">' + esc(cal.respuesta.texto) + '</p>' +
        '<span class="mini muted">' +
          esc(autorResp ? AG.Utils.nombreCompleto(autorResp) : 'Dirección') +
          (cal.respuesta.fecha ? ' · ' + esc(AG.Utils.fecha(cal.respuesta.fecha, 'corto')) : '') +
        '</span></div>';
    } else if (urgente) {
      html += '<div class="aviso aviso-error mt-sm">' + ico('alerta', 16) +
        '<span>Reseña crítica sin responder. Requiere atención de dirección.</span></div>';
    }

    if (o.responder) {
      html += '<div class="row row-sm wrap mt-sm">' +
        '<button type="button" class="btn btn-sm ' + (urgente ? 'btn-primary' : 'btn-outline') +
        '" data-responder="' + esc(cal.id) + '">' + ico('chat', 15) +
        (tieneRespuesta(cal) ? 'Editar respuesta' : 'Responder') + '</button>' +
        '</div>';
    }

    html += '</article>';
    return html;
  }

  /* =========================================================
     5. Responder una reseña (solo dirección)
     ========================================================= */

  function responder(calificacionId) {
    var cal = AG.DB.buscar('calificaciones', calificacionId);
    if (!cal) {
      AG.Utils.toast('No encontramos esa reseña.', 'error');
      return null;
    }

    var usuario = AG.Auth.actual();
    if (!usuario || usuario.rol !== 'director') {
      AG.Utils.toast('Solo dirección puede responder las reseñas.', 'warn');
      return null;
    }

    var idArea = AG.Utils.uid('resp_');
    var previo = tieneRespuesta(cal) ? String(cal.respuesta.texto) : '';

    return AG.Utils.modal({
      titulo: tieneRespuesta(cal) ? 'Editar respuesta' : 'Responder reseña',
      ancho: 'md',
      cuerpo: '<div class="stack">' +
          resenaHTML(cal, { usuario: usuario, responder: false, mostrarDestino: true }) +
          '<div class="field">' +
            '<label class="label" for="' + idArea + '">Respuesta de dirección</label>' +
            '<textarea class="textarea" id="' + idArea + '" rows="5" maxlength="' + MAX_COMENTARIO +
              '" placeholder="Agradece la reseña y di qué van a hacer al respecto.">' +
              esc(previo) + '</textarea>' +
            '<p class="help">El socio recibirá una notificación con tu respuesta.</p>' +
          '</div>' +
        '</div>',
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: 'Guardar respuesta',
          clase: 'btn-primary',
          icono: 'check',
          onClick: function (api) {
            var area = api.root.querySelector('#' + idArea);
            var texto = area ? String(area.value || '').trim() : '';

            if (texto.length < 5) {
              AG.Utils.toast('Escribe una respuesta de al menos 5 caracteres.', 'warn');
              if (area) { try { area.focus(); } catch (e) { /* sin foco disponible */ } }
              return false;
            }

            AG.DB.actualizar('calificaciones', cal.id, {
              respuesta: { texto: texto, por: usuario.id, fecha: AG.Utils.hoy() }
            });

            if (cal.socioId && AG.DB.usuario(cal.socioId)) {
              AG.DB.notificar(cal.socioId, {
                titulo: 'Dirección respondió tu reseña',
                cuerpo: texto,
                tipo: 'aviso',
                link: '#/socio/calificar'
              });
            }

            AG.Utils.toast('Respuesta guardada y enviada al socio.', 'ok');
            api.cerrar();
            AG.Router.refrescar();
            return true;
          }
        }
      ]
    });
  }

  /* =========================================================
     6. API pública reutilizable
     ========================================================= */

  var Mod = {};

  /**
   * Resumen compacto de estrellas: promedio + estrellas + total.
   * @param {'coach'|'gimnasio'} tipo
   * @param {String} objetivoId  id del coach; para el gimnasio se asume 'gym'
   * @returns {String} HTML en línea
   */
  Mod.resumen = function (tipo, objetivoId) {
    var t = normalizarTipo(tipo);
    var obj = t === 'coach' ? String(objetivoId || '') : String(objetivoId || 'gym');

    if (t === 'coach' && !obj) {
      return '<span class="mini muted">Sin coach para calificar</span>';
    }

    var res = AG.Calc.promedioCalificacion(listaDe(t, obj));

    if (!res.total) {
      return '<span class="row row-sm nowrap">' + AG.Utils.estrellas(0, { size: 14 }) +
        '<span class="mini muted">Sin reseñas todavía</span></span>';
    }

    return '<span class="row row-sm nowrap">' +
      AG.Utils.estrellas(res.promedio, { size: 15 }) +
      '<b class="nums">' + esc(AG.Utils.num(res.promedio, 1)) + '</b>' +
      '<span class="mini muted">(' + res.total +
        (res.total === 1 ? ' reseña' : ' reseñas') + ')</span>' +
      '</span>';
  };

  /** Calificación que ese socio ya dejó este mes sobre ese objetivo. */
  function calificacionDelMes(socioId, tipo, objetivoId, mes) {
    var lista = AG.DB.donde('calificaciones', function (c) {
      return c && c.socioId === socioId && c.tipo === tipo &&
        c.objetivoId === objetivoId && AG.Utils.mesDe(c.fecha) === mes;
    });
    if (!lista.length) return null;
    return ordenarRecientes(lista)[0];
  }

  /** Valor marcado en un grupo de estrellas editables. */
  function valorEstrellas(campo) {
    if (!campo) return 0;
    var caja = campo.querySelector ? campo.querySelector('.stars-input') : null;
    if (!caja) return 0;
    var marcado = caja.querySelector('input[type="radio"]:checked');
    var v = marcado ? Number(marcado.value) : 0;
    return (isFinite(v) && v >= 1 && v <= 5) ? Math.round(v) : 0;
  }

  /**
   * Modal para capturar (o corregir) una calificación.
   * Solo se permite una calificación por socio, objetivo y mes: si ya existe,
   * el modal la abre en modo edición.
   *
   * @param {'coach'|'gimnasio'} tipo
   * @param {String} objetivoId  id del coach; para el gimnasio se asume 'gym'
   * @param {String} socioId     socio que califica
   * @param {Object} [opciones]  { alGuardar(calificacion) }
   * @returns {Object|null} api del modal
   */
  Mod.formulario = function (tipo, objetivoId, socioId, opciones) {
    var o = opciones || {};
    var t = normalizarTipo(tipo);
    var obj = t === 'coach' ? String(objetivoId || '') : String(objetivoId || 'gym');

    if (t === 'coach' && !obj) {
      AG.Utils.toast('Falta indicar a qué coach vas a calificar.', 'error');
      return null;
    }

    var socio = AG.DB.usuario(socioId);
    if (!socio) {
      AG.Utils.toast('No encontramos al socio que va a calificar.', 'error');
      return null;
    }

    var actual = AG.Auth.actual();
    if (actual && actual.rol === 'socio' && actual.id !== socio.id) {
      AG.Utils.toast('Solo puedes calificar desde tu propia cuenta.', 'warn');
      return null;
    }

    if (t === 'coach') {
      var coachDestino = AG.DB.usuario(obj);
      if (!coachDestino || coachDestino.rol !== 'coach') {
        AG.Utils.toast('Ese coach ya no está registrado en el sistema.', 'error');
        return null;
      }
    }

    var cats = catsDe(t);
    var mes = AG.Utils.mesActual();
    var previa = calificacionDelMes(socio.id, t, obj, mes);
    var detallePrevio = (previa && previa.detalle) ? previa.detalle : {};

    var idBase = AG.Utils.uid('cal_');
    var idComentario = idBase + '_txt';
    var nombreDestino = t === 'coach'
      ? AG.Utils.nombreCompleto(AG.DB.usuario(obj))
      : (AG.DB.state.settings && AG.DB.state.settings.nombreGym ? AG.DB.state.settings.nombreGym : 'el gimnasio');

    var cuerpo = '<div class="stack" data-form-calificacion>';

    cuerpo += '<div class="aviso ' + (previa ? 'aviso-info' : 'aviso-rojo') + '">' +
      ico(previa ? 'info' : 'estrella', 18) +
      '<span>' + (previa
        ? 'Ya calificaste a <b>' + esc(nombreDestino) + '</b> en ' + esc(AG.Utils.nombreMes(mes)) +
          '. Puedes ajustar tu calificación; se guardará sobre la anterior.'
        : 'Calificas a <b>' + esc(nombreDestino) + '</b> por ' + esc(AG.Utils.nombreMes(mes)) +
          '. Solo se permite una calificación al mes.') +
      '</span></div>';

    var i;
    for (i = 0; i < cats.length; i++) {
      var vPrevio = Number(detallePrevio[cats[i].clave]);
      if (!isFinite(vPrevio) || vPrevio < 1 || vPrevio > 5) vPrevio = 0;
      cuerpo += '<div class="field" data-cat="' + esc(cats[i].clave) + '">' +
        '<span class="label">' + esc(cats[i].etiqueta) + '</span>' +
        '<div class="row between wrap">' +
          AG.Utils.estrellas(vPrevio, { editable: true, name: idBase + '_' + cats[i].clave, size: 28 }) +
          '<span class="mini muted" data-eco="' + esc(cats[i].clave) + '">' +
            (vPrevio ? vPrevio + ' de 5' : 'Sin calificar') + '</span>' +
        '</div></div>';
    }

    cuerpo += '<div class="field">' +
      '<label class="label" for="' + idComentario + '">Comentario (opcional)</label>' +
      '<textarea class="textarea" id="' + idComentario + '" rows="4" maxlength="' + MAX_COMENTARIO +
        '" placeholder="Cuéntanos qué te gustó y qué se puede mejorar.">' +
        esc(previa ? (previa.comentario || '') : '') + '</textarea>' +
      '<p class="help">Máximo ' + MAX_COMENTARIO + ' caracteres.</p>' +
    '</div>';

    cuerpo += '<div class="row between wrap">' +
      '<span class="mini muted">Calificación general</span>' +
      '<span class="row row-sm nowrap" data-general-caja>' +
        '<span data-general-estrellas>' + AG.Utils.estrellas(0, { size: 16 }) + '</span>' +
        '<b class="nums" data-general-valor>—</b>' +
      '</span></div>';

    cuerpo += '</div>';

    return AG.Utils.modal({
      titulo: previa ? 'Actualizar mi calificación' : 'Calificar',
      ancho: 'md',
      cuerpo: cuerpo,
      onOpen: function (root) {
        function refrescarGeneral() {
          var suma = 0, cuenta = 0, k;
          for (k = 0; k < cats.length; k++) {
            var campo = root.querySelector('[data-cat="' + cats[k].clave + '"]');
            var v = valorEstrellas(campo);
            var eco = campo ? campo.querySelector('[data-eco]') : null;
            if (eco) eco.textContent = v ? v + ' de 5' : 'Sin calificar';
            if (v) { suma += v; cuenta++; }
          }
          var general = cuenta ? Math.round(suma / cuenta) : 0;
          var cajaEstrellas = root.querySelector('[data-general-estrellas]');
          var cajaValor = root.querySelector('[data-general-valor]');
          if (cajaEstrellas) cajaEstrellas.innerHTML = AG.Utils.estrellas(general, { size: 16 });
          if (cajaValor) cajaValor.textContent = cuenta ? String(general) : '—';
        }

        root.addEventListener('change', function (e) {
          var destino = e.target;
          if (destino && destino.type === 'radio') refrescarGeneral();
        });

        refrescarGeneral();
      },
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: previa ? 'Actualizar calificación' : 'Enviar calificación',
          clase: 'btn-primary',
          icono: 'check',
          onClick: function (api) {
            var detalle = {}, suma = 0, cuenta = 0, k;

            for (k = 0; k < cats.length; k++) {
              var v = valorEstrellas(api.root.querySelector('[data-cat="' + cats[k].clave + '"]'));
              if (!v) {
                AG.Utils.toast('Califica las ' + cats.length + ' categorías antes de guardar.', 'warn');
                return false;
              }
              detalle[cats[k].clave] = v;
              suma += v;
              cuenta++;
            }

            var general = Math.round(suma / cuenta);
            if (general < 1) general = 1;
            if (general > 5) general = 5;

            var area = api.root.querySelector('#' + idComentario);
            var comentario = area ? String(area.value || '').trim().slice(0, MAX_COMENTARIO) : '';

            var datos = {
              socioId: socio.id,
              tipo: t,
              objetivoId: obj,
              estrellas: general,
              comentario: comentario,
              fecha: AG.Utils.hoy(),
              detalle: detalle,
              respuesta: previa ? (previa.respuesta || null) : null
            };

            var guardada;
            if (previa) {
              guardada = AG.DB.actualizar('calificaciones', previa.id, datos) || previa;
              AG.Utils.toast('Actualizamos tu calificación de este mes.', 'ok');
            } else {
              guardada = AG.DB.insertar('calificaciones', datos);
              AG.Utils.toast('¡Gracias! Registramos tu calificación.', 'ok');

              /* Al coach le avisamos que tiene una reseña nueva. */
              if (t === 'coach') {
                var coach = AG.DB.usuario(obj);
                if (coach && coach.rol === 'coach') {
                  AG.DB.notificar(coach.id, {
                    titulo: 'Nueva calificación de un socio',
                    cuerpo: AG.Utils.nombreCompleto(socio) + ' te calificó con ' + general +
                      (general === 1 ? ' estrella.' : ' estrellas.'),
                    tipo: 'aviso',
                    link: '#/coach/calificaciones'
                  });
                }
              }
            }

            api.cerrar();

            if (typeof o.alGuardar === 'function') {
              try { o.alGuardar(guardada); } catch (e) { /* el callback no debe tumbar la app */ }
            } else {
              AG.Router.refrescar();
            }
            return true;
          }
        }
      ]
    });
  };

  /** Abre el modal para responder una reseña (lo usa dirección). */
  Mod.responder = responder;

  /* =========================================================
     7. Vista de dirección
     ========================================================= */

  var estadoDir = {
    tab: 'resumen',
    tipo: 'todos',
    estrellas: 'todas',
    coachId: 'todos',
    periodo: 'todos',
    soloPendientes: false,
    q: '',
    limite: PAGINA_RESENAS
  };

  var TABS_DIR = [
    { clave: 'resumen', etiqueta: 'Resumen', icono: 'grafica' },
    { clave: 'resenas', etiqueta: 'Reseñas', icono: 'chat' },
    { clave: 'coaches', etiqueta: 'Coaches', icono: 'coach' }
  ];

  /* ---------- Pestaña: Resumen ---------- */

  function panelResumen() {
    var todas = AG.DB.get('calificaciones').slice();
    if (!todas.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('Todavía nadie ha calificado al gimnasio ni a los coaches. En cuanto lleguen las primeras reseñas verás aquí el resumen.') +
        '</div></div>';
    }

    var delGym = [], deCoach = [], i;
    for (i = 0; i < todas.length; i++) {
      if (todas[i].tipo === 'coach') deCoach.push(todas[i]);
      else delGym.push(todas[i]);
    }

    var res = AG.Calc.promedioCalificacion(todas);
    var resGym = AG.Calc.promedioCalificacion(delGym);
    var resCoach = AG.Calc.promedioCalificacion(deCoach);
    var nps = calcularNPS(todas);

    var pendientes = 0;
    for (i = 0; i < todas.length; i++) if (requiereAtencion(todas[i])) pendientes++;

    var html = '<div class="stack">';

    if (pendientes) {
      html += '<div class="aviso aviso-error">' + ico('alerta', 18) +
        '<span><b>' + pendientes + (pendientes === 1
          ? ' reseña de 1 o 2 estrellas sigue sin respuesta.'
          : ' reseñas de 1 o 2 estrellas siguen sin respuesta.') +
        '</b> Responderlas a tiempo evita que el socio se vaya.</span>' +
        '<button type="button" class="btn btn-sm btn-danger" data-ver-pendientes>Verlas</button>' +
        '</div>';
    }

    /* Global + distribución */
    html += '<div class="grid g2">';
    html += '<div class="card">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">Calificación global</h3>' +
        '<p class="card-sub">Gimnasio y coaches en conjunto</p>' +
      '</div></div>' +
      '<div class="card-body stack">' +
        bloqueGlobal(res, 'el gimnasio') +
        '<div class="row wrap">' +
          '<div class="dato"><span class="dato-label">Gimnasio</span><span class="dato-val">' +
            (resGym.total ? esc(AG.Utils.num(resGym.promedio, 1)) + ' ★ · ' + resGym.total : 'Sin reseñas') +
          '</span></div>' +
          '<div class="dato"><span class="dato-label">Coaches</span><span class="dato-val">' +
            (resCoach.total ? esc(AG.Utils.num(resCoach.promedio, 1)) + ' ★ · ' + resCoach.total : 'Sin reseñas') +
          '</span></div>' +
          '<div class="dato"><span class="dato-label">Sin responder</span><span class="dato-val">' +
            pendientes + '</span></div>' +
        '</div>' +
      '</div></div>';

    html += '<div class="card">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">Distribución de estrellas</h3>' +
        '<p class="card-sub">De 5 a 1 estrella sobre ' + res.total + ' reseñas</p>' +
      '</div></div>' +
      '<div class="card-body">' + bloqueDistribucion(res) + '</div></div>';
    html += '</div>';

    /* Radares */
    html += '<div class="grid g2">';
    html += tarjetaRadar('Cómo ven el gimnasio', 'Promedio por categoría de instalaciones',
      delGym, CATS_GYM, 'var(--rojo,#E4322B)');
    html += tarjetaRadar('Cómo ven a los coaches', 'Promedio por categoría de servicio',
      deCoach, CATS_COACH, 'var(--info,#3B82F6)');
    html += '</div>';

    /* Tendencia */
    html += tarjetaTendencia(todas, 'Tendencia de la calificación');

    /* NPS */
    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div><h3 class="card-title">NPS aproximado</h3>' +
        '<p class="card-sub">Promotores (5★) menos detractores (3★ o menos)</p></div>' +
        '<div class="card-accion"><span class="pill ' + claseNPS(nps.valor) + '">' +
          esc(AG.Utils.signo(nps.valor, 0)) + '</span></div>' +
      '</div>' +
      '<div class="card-body"><div class="grid g2">' +
        '<div>' + AG.Charts.dona([
          { etiqueta: 'Promotores', valor: nps.promotores, color: 'var(--ok,#22C55E)' },
          { etiqueta: 'Pasivos', valor: nps.pasivos, color: 'var(--warn,#F59E0B)' },
          { etiqueta: 'Detractores', valor: nps.detractores, color: 'var(--error,#EF4444)' }
        ], {
          alto: 230,
          centroValor: String(nps.valor),
          centroTitulo: 'NPS',
          vacio: 'Sin reseñas para calcular el NPS.'
        }) + '</div>' +
        '<div class="stack-sm">' +
          kpiNPS('ok', 'trofeo', nps.promotores, 'Promotores · 5 ★', nps.pctPro) +
          kpiNPS('warn', 'usuario', nps.pasivos, 'Pasivos · 4 ★', nps.pctPas) +
          kpiNPS('error', 'alerta', nps.detractores, 'Detractores · 3 ★ o menos', nps.pctDet) +
        '</div>' +
      '</div></div></div>';

    html += '</div>';
    return html;
  }

  function kpiNPS(variante, nombreIcono, valor, etiqueta, pct) {
    return '<div class="kpi kpi-' + variante + '">' +
      '<div class="kpi-icono">' + ico(nombreIcono, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + valor + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        '<div class="kpi-trend">' + esc(AG.Utils.pct(pct, 0)) + ' del total</div>' +
      '</div></div>';
  }

  /* ---------- Pestaña: Reseñas ---------- */

  function opcionesSelect(lista, valorActual) {
    var html = '', i;
    for (i = 0; i < lista.length; i++) {
      html += '<option value="' + esc(lista[i].valor) + '"' +
        (String(lista[i].valor) === String(valorActual) ? ' selected' : '') + '>' +
        esc(lista[i].texto) + '</option>';
    }
    return html;
  }

  function filtrarResenas() {
    var lista = ordenarRecientes(AG.DB.get('calificaciones').slice());
    var q = AG.Utils.normalizar(estadoDir.q);
    var hoy = AG.Utils.hoy();
    var desde = '';

    if (estadoDir.periodo === 'mes') desde = AG.Utils.mesActual() + '-01';
    else if (estadoDir.periodo === '3m') desde = AG.Utils.sumaMeses(hoy, -3);
    else if (estadoDir.periodo === '12m') desde = AG.Utils.sumaMeses(hoy, -12);

    var salida = [], i;
    for (i = 0; i < lista.length; i++) {
      var c = lista[i];

      if (estadoDir.coachId !== 'todos') {
        if (c.tipo !== 'coach' || c.objetivoId !== estadoDir.coachId) continue;
      } else if (estadoDir.tipo !== 'todos' && c.tipo !== estadoDir.tipo) {
        continue;
      }

      var e = estrellasDe(c);
      if (estadoDir.estrellas === 'criticas') {
        if (e < 1 || e > 2) continue;
      } else if (estadoDir.estrellas !== 'todas' && e !== Number(estadoDir.estrellas)) {
        continue;
      }

      if (estadoDir.soloPendientes && !requiereAtencion(c)) continue;
      if (desde && String(c.fecha || '') < desde) continue;
      if (q && AG.Utils.normalizar(c.comentario || '').indexOf(q) < 0) continue;

      salida.push(c);
    }
    return salida;
  }

  function panelResenas(usuario) {
    var coaches = AG.Utils.ordenar(AG.DB.coaches(), 'nombre', 'asc');
    var opcionesCoach = [{ valor: 'todos', texto: 'Todos los coaches' }];
    var i;
    for (i = 0; i < coaches.length; i++) {
      opcionesCoach.push({ valor: coaches[i].id, texto: AG.Utils.nombreCompleto(coaches[i]) });
    }

    var html = '<div class="stack">';

    /* Filtros */
    html += '<div class="card"><div class="card-body stack-sm">' +
      '<div class="cal-filtros">' +
        campoSelect('Tipo', 'tipo', [
          { valor: 'todos', texto: 'Gimnasio y coaches' },
          { valor: 'gimnasio', texto: 'Solo el gimnasio' },
          { valor: 'coach', texto: 'Solo coaches' }
        ], estadoDir.tipo) +
        campoSelect('Estrellas', 'estrellas', [
          { valor: 'todas', texto: 'Todas las estrellas' },
          { valor: '5', texto: '5 estrellas' },
          { valor: '4', texto: '4 estrellas' },
          { valor: '3', texto: '3 estrellas' },
          { valor: '2', texto: '2 estrellas' },
          { valor: '1', texto: '1 estrella' },
          { valor: 'criticas', texto: 'Críticas (1 y 2)' }
        ], estadoDir.estrellas) +
        campoSelect('Coach', 'coachId', opcionesCoach, estadoDir.coachId,
          estadoDir.tipo === 'gimnasio') +
        campoSelect('Periodo', 'periodo', [
          { valor: 'todos', texto: 'Todo el historial' },
          { valor: 'mes', texto: 'Mes en curso' },
          { valor: '3m', texto: 'Últimos 3 meses' },
          { valor: '12m', texto: 'Últimos 12 meses' }
        ], estadoDir.periodo) +
        '<div class="field">' +
          '<span class="label">Buscar</span>' +
          '<input class="input" type="search" data-buscar placeholder="Buscar en los comentarios…" value="' +
            esc(estadoDir.q) + '">' +
        '</div>' +
      '</div>' +
      '<div class="row row-sm wrap">' +
        '<button type="button" class="chip' + (estadoDir.soloPendientes ? ' on' : '') +
          '" data-pendientes>' + ico('alerta', 14) + 'Solo sin responder</button>' +
        '<button type="button" class="chip" data-limpiar>' + ico('x', 14) + 'Limpiar filtros</button>' +
      '</div>' +
    '</div></div>';

    var lista = filtrarResenas();

    if (!lista.length) {
      html += '<div class="card"><div class="card-body">' +
        vacio('Ninguna reseña coincide con los filtros. Prueba a limpiarlos o a ampliar el periodo.', 'filtro') +
        '</div></div>';
      html += '</div>';
      return html;
    }

    var visibles = lista.slice(0, estadoDir.limite);
    var resFiltro = AG.Calc.promedioCalificacion(lista);

    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div><h3 class="card-title">' + lista.length +
          (lista.length === 1 ? ' reseña' : ' reseñas') + '</h3>' +
        '<p class="card-sub">Promedio del filtro: ' + esc(AG.Utils.num(resFiltro.promedio, 1)) + ' ★</p></div>' +
        '<div class="card-accion">' + AG.Utils.estrellas(resFiltro.promedio, { size: 16 }) + '</div>' +
      '</div>' +
      '<div class="card-body">';

    for (i = 0; i < visibles.length; i++) {
      html += resenaHTML(visibles[i], { usuario: usuario, responder: true, mostrarDestino: true });
    }

    if (lista.length > visibles.length) {
      html += '<div class="row center mt">' +
        '<button type="button" class="btn btn-outline" data-mas-resenas>' +
          'Mostrar ' + Math.min(PAGINA_RESENAS, lista.length - visibles.length) + ' más' +
        '</button></div>';
    }

    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function campoSelect(etiqueta, filtro, opciones, valor, deshabilitado) {
    return '<div class="field">' +
      '<span class="label">' + esc(etiqueta) + '</span>' +
      '<select class="select" data-filtro="' + esc(filtro) + '"' +
        (deshabilitado ? ' disabled' : '') + '>' +
        opcionesSelect(opciones, valor) +
      '</select></div>';
  }

  /* ---------- Pestaña: Coaches ---------- */

  function rankingCoaches() {
    var coaches = AG.DB.coaches();
    var mesAct = AG.Utils.mesActual();
    var mesAnt = mesMenos(mesAct, 1);
    var filas = [], i;

    for (i = 0; i < coaches.length; i++) {
      var suyas = listaDe('coach', coaches[i].id);
      var res = AG.Calc.promedioCalificacion(suyas);
      var act = promedioDeMes(suyas, mesAct);
      var ant = promedioDeMes(suyas, mesAnt);
      filas.push({
        coach: coaches[i],
        promedio: res.promedio,
        total: res.total,
        actual: act,
        anterior: ant,
        delta: (act !== null && ant !== null) ? Math.round((act - ant) * 10) / 10 : null,
        pendientes: contarPendientes(suyas)
      });
    }

    filas.sort(function (a, b) {
      if (!a.total && !b.total) {
        return AG.Utils.nombreCompleto(a.coach) < AG.Utils.nombreCompleto(b.coach) ? -1 : 1;
      }
      if (!a.total) return 1;
      if (!b.total) return -1;
      if (b.promedio !== a.promedio) return b.promedio - a.promedio;
      if (b.total !== a.total) return b.total - a.total;
      return AG.Utils.nombreCompleto(a.coach) < AG.Utils.nombreCompleto(b.coach) ? -1 : 1;
    });

    return filas;
  }

  function contarPendientes(lista) {
    var n = 0, i;
    for (i = 0; i < lista.length; i++) if (requiereAtencion(lista[i])) n++;
    return n;
  }

  function evolucionHTML(fila) {
    if (fila.delta === null) {
      return '<span class="mini muted nowrap">Sin comparativo mensual</span>';
    }
    if (Math.abs(fila.delta) < 0.05) {
      return '<span class="mini muted nowrap">' + ico('flecha-der', 13) + ' Igual que el mes pasado</span>';
    }
    var sube = fila.delta > 0;
    return '<span class="mini bold nowrap ' + (sube ? 'txt-ok' : 'txt-error') + '">' +
      ico(sube ? 'flecha-arriba' : 'flecha-abajo', 13) + ' ' +
      esc(AG.Utils.signo(fila.delta, 1)) + ' vs mes anterior</span>';
  }

  function panelCoaches() {
    var filas = rankingCoaches();

    if (!filas.length) {
      return '<div class="card"><div class="card-body">' +
        vacio('Todavía no hay coaches registrados en el sistema.', 'coach') +
        '</div></div>';
    }

    var conReseñas = [], i;
    for (i = 0; i < filas.length; i++) if (filas[i].total) conReseñas.push(filas[i]);

    var html = '<div class="stack">';

    if (conReseñas.length >= 2) {
      var datos = [];
      for (i = 0; i < conReseñas.length; i++) {
        datos.push({
          etiqueta: AG.Utils.nombreCompleto(conReseñas[i].coach),
          valor: conReseñas[i].promedio,
          color: i === 0 ? 'var(--ok,#22C55E)' : 'var(--rojo,#E4322B)'
        });
      }
      html += '<div class="card">' +
        '<div class="card-head"><div>' +
          '<h3 class="card-title">Promedio por coach</h3>' +
          '<p class="card-sub">Escala de 0 a 5 estrellas</p>' +
        '</div></div>' +
        '<div class="card-body">' +
          AG.Charts.barras(datos, {
            horizontal: true,
            decimales: 1,
            anchoEtiquetas: 140,
            vacio: 'Sin promedios que comparar.'
          }) +
        '</div></div>';
    }

    html += '<div class="card">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">Ranking de coaches</h3>' +
        '<p class="card-sub">Ordenado por promedio de estrellas</p>' +
      '</div></div>' +
      '<div class="list">';

    for (i = 0; i < filas.length; i++) {
      var f = filas[i];
      var posicion = f.total ? String(i + 1) : '—';
      html += '<div class="list-item">' +
        '<span class="cal-pos' + (f.total && i < 3 ? ' cal-podio' : '') + '">' + esc(posicion) + '</span>' +
        AG.Utils.avatar(f.coach, 'sm') +
        '<div class="list-item-main">' +
          '<b>' + esc(AG.Utils.nombreCompleto(f.coach)) + '</b>' +
          '<span class="mini muted">' +
            esc(f.coach.especialidad || 'Entrenamiento general') +
            (f.pendientes ? ' · ' + f.pendientes + ' sin responder' : '') +
          '</span>' +
        '</div>' +
        '<div class="list-item-side">' +
          (f.total
            ? '<div class="row row-sm nowrap">' + AG.Utils.estrellas(f.promedio, { size: 14 }) +
              '<b class="nums">' + esc(AG.Utils.num(f.promedio, 1)) + '</b></div>' +
              '<span class="mini muted">' + f.total +
                (f.total === 1 ? ' reseña' : ' reseñas') + '</span>' +
              evolucionHTML(f)
            : '<span class="mini muted">Sin reseñas todavía</span>') +
        '</div>' +
      '</div>';
    }

    html += '</div></div></div>';
    return html;
  }

  /* ---------- Armado y eventos de la vista de dirección ---------- */

  function tabsHTML() {
    var html = '<div class="tabs" role="tablist">', i;
    for (i = 0; i < TABS_DIR.length; i++) {
      var activa = TABS_DIR[i].clave === estadoDir.tab;
      html += '<button type="button" class="tab' + (activa ? ' active' : '') +
        '" role="tab" aria-selected="' + (activa ? 'true' : 'false') +
        '" data-tab="' + TABS_DIR[i].clave + '">' +
        ico(TABS_DIR[i].icono, 16) + '<span>' + esc(TABS_DIR[i].etiqueta) + '</span></button>';
    }
    return html + '</div>';
  }

  function marcarTabs(root) {
    var botones = AG.Utils.$$('[data-tab]', root), i;
    for (i = 0; i < botones.length; i++) {
      var activa = botones[i].getAttribute('data-tab') === estadoDir.tab;
      botones[i].classList.toggle('active', activa);
      botones[i].setAttribute('aria-selected', activa ? 'true' : 'false');
    }
  }

  function pintarPanel(root, usuario, enfocarBusqueda) {
    var caja = root.querySelector('[data-panel]');
    if (!caja) return;

    if (estadoDir.tab === 'resenas') caja.innerHTML = panelResenas(usuario);
    else if (estadoDir.tab === 'coaches') caja.innerHTML = panelCoaches();
    else caja.innerHTML = panelResumen();

    marcarTabs(root);

    if (enfocarBusqueda) {
      var campo = caja.querySelector('[data-buscar]');
      if (campo) {
        try {
          campo.focus();
          var n = campo.value.length;
          campo.setSelectionRange(n, n);
        } catch (e) { /* algunos navegadores no permiten mover el cursor en type=search */ }
      }
    }
  }

  function renderDirector(ctx) {
    var usuario = ctx && ctx.usuario ? ctx.usuario : AG.Auth.actual();
    var todas = AG.DB.get('calificaciones');
    var res = AG.Calc.promedioCalificacion(todas);
    var pendientes = contarPendientes(todas);

    var html = '<div class="page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">Calificaciones</h1>' +
          '<p class="page-sub">Lo que opinan los socios del gimnasio y de sus coaches.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<span class="pill">' + ico('estrella', 14) +
            (res.total ? esc(AG.Utils.num(res.promedio, 1)) + ' de 5' : 'Sin reseñas') + '</span>' +
          '<span class="pill' + (pendientes ? ' pill-rojo' : ' pill-ok') + '">' +
            ico(pendientes ? 'alerta' : 'check', 14) +
            (pendientes ? pendientes + ' sin responder' : 'Todo respondido') + '</span>' +
        '</div>' +
      '</div>' +
      tabsHTML() +
      '<div data-panel></div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) {
        asegurarEstilos();
        pintarPanel(root, usuario, false);

        AG.Utils.delegar(root, 'click', '[data-tab]', function (e, el) {
          var destino = el.getAttribute('data-tab');
          if (!destino || destino === estadoDir.tab) return;
          estadoDir.tab = destino;
          estadoDir.limite = PAGINA_RESENAS;
          pintarPanel(root, usuario, false);
        });

        AG.Utils.delegar(root, 'click', '[data-responder]', function (e, el) {
          responder(el.getAttribute('data-responder'));
        });

        AG.Utils.delegar(root, 'click', '[data-ver-pendientes]', function () {
          estadoDir.tab = 'resenas';
          estadoDir.soloPendientes = true;
          estadoDir.estrellas = 'criticas';
          estadoDir.limite = PAGINA_RESENAS;
          pintarPanel(root, usuario, false);
        });

        AG.Utils.delegar(root, 'click', '[data-pendientes]', function () {
          estadoDir.soloPendientes = !estadoDir.soloPendientes;
          estadoDir.limite = PAGINA_RESENAS;
          pintarPanel(root, usuario, false);
        });

        AG.Utils.delegar(root, 'click', '[data-limpiar]', function () {
          estadoDir.tipo = 'todos';
          estadoDir.estrellas = 'todas';
          estadoDir.coachId = 'todos';
          estadoDir.periodo = 'todos';
          estadoDir.soloPendientes = false;
          estadoDir.q = '';
          estadoDir.limite = PAGINA_RESENAS;
          pintarPanel(root, usuario, false);
        });

        AG.Utils.delegar(root, 'click', '[data-mas-resenas]', function () {
          estadoDir.limite += PAGINA_RESENAS;
          pintarPanel(root, usuario, false);
        });

        AG.Utils.delegar(root, 'change', '[data-filtro]', function (e, el) {
          var llave = el.getAttribute('data-filtro');
          if (!llave) return;
          estadoDir[llave] = el.value;
          if (llave === 'tipo' && el.value === 'gimnasio') estadoDir.coachId = 'todos';
          if (llave === 'coachId' && el.value !== 'todos') estadoDir.tipo = 'coach';
          estadoDir.limite = PAGINA_RESENAS;
          pintarPanel(root, usuario, false);
        });

        var buscarLento = AG.Utils.debounce(function () {
          pintarPanel(root, usuario, true);
        }, 280);

        AG.Utils.delegar(root, 'input', '[data-buscar]', function (e, el) {
          estadoDir.q = el.value;
          estadoDir.limite = PAGINA_RESENAS;
          buscarLento();
        });
      }
    };
  }

  /* =========================================================
     8. Vista del coach
     ========================================================= */

  var estadoCoach = { limite: PAGINA_RESENAS };

  /** Bloque "Cómo mejorar" a partir de la categoría peor evaluada. */
  function bloqueMejorar(ejes) {
    if (ejes.length < 2) {
      return '<div class="card-body">' +
        vacio('Necesitamos más reseñas con detalle por categoría para darte sugerencias útiles.', 'meta') +
        '</div>';
    }

    var peor = ejes[0], mejor = ejes[0], i;
    for (i = 1; i < ejes.length; i++) {
      if (ejes[i].valor < peor.valor) peor = ejes[i];
      if (ejes[i].valor > mejor.valor) mejor = ejes[i];
    }

    var textos = SUGERENCIAS[peor.clave] || [];
    var html = '<div class="card-body stack">';

    html += '<div class="aviso ' + (peor.valor >= 4.5 ? 'aviso-ok' : 'aviso-warn') + '">' +
      ico(peor.valor >= 4.5 ? 'trofeo' : 'meta', 18) +
      '<span>Tu punto más fuerte es <b>' + esc(mejor.etiqueta) + '</b> con ' +
        esc(AG.Utils.num(mejor.valor, 1)) + ' de 5. ' +
        (peor.valor >= 4.5
          ? 'Aun así, la categoría con menor promedio es <b>' + esc(peor.etiqueta) + '</b> (' +
            esc(AG.Utils.num(peor.valor, 1)) + '): ahí está tu siguiente escalón.'
          : 'La que más puedes mejorar es <b>' + esc(peor.etiqueta) + '</b> con ' +
            esc(AG.Utils.num(peor.valor, 1)) + ' de 5.') +
      '</span></div>';

    if (!textos.length) {
      html += vacio('No tenemos sugerencias guardadas para esa categoría.', 'info');
      html += '</div>';
      return html;
    }

    for (i = 0; i < textos.length; i++) {
      html += '<div class="cal-sugerencia">' +
        '<span class="cal-bolita">' + (i + 1) + '</span>' +
        '<p class="flex1">' + esc(textos[i]) + '</p>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderCoach(ctx) {
    var usuario = ctx && ctx.usuario ? ctx.usuario : AG.Auth.actual();

    if (!usuario || usuario.rol !== 'coach') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacio('Esta sección es exclusiva de los coaches.', 'candado') +
        '</div></div></div>';
    }

    var lista = ordenarRecientes(listaDe('coach', usuario.id));
    var res = AG.Calc.promedioCalificacion(lista);
    var ejes = ejesCategorias(lista, CATS_COACH);
    var nps = calcularNPS(lista);

    var html = '<div class="page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">Mis calificaciones</h1>' +
          '<p class="page-sub">Lo que opinan de tu trabajo los socios que atiendes.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<span class="pill">' + ico('estrella', 14) +
            (res.total ? esc(AG.Utils.num(res.promedio, 1)) + ' de 5' : 'Sin reseñas') + '</span>' +
          '<span class="pill">' + ico('chat', 14) + res.total +
            (res.total === 1 ? ' reseña' : ' reseñas') + '</span>' +
        '</div>' +
      '</div>';

    if (!res.total) {
      html += '<div class="card"><div class="card-body">' +
        vacio('Todavía ningún socio te ha calificado. En cuanto lleguen las primeras reseñas verás aquí tu promedio, tus categorías y los comentarios.') +
        '</div></div></div>';
      return { html: html, listo: function () { asegurarEstilos(); } };
    }

    /* Promedio + distribución */
    html += '<div class="grid g2">' +
      '<div class="card">' +
        '<div class="card-head"><div>' +
          '<h3 class="card-title">Mi promedio</h3>' +
          '<p class="card-sub">Sobre todas tus reseñas</p>' +
        '</div></div>' +
        '<div class="card-body stack">' +
          bloqueGlobal(res, 'tu trabajo') +
          '<div class="row wrap">' +
            '<div class="dato"><span class="dato-label">Promotores</span>' +
              '<span class="dato-val txt-ok">' + nps.promotores + '</span></div>' +
            '<div class="dato"><span class="dato-label">Pasivos</span>' +
              '<span class="dato-val txt-warn">' + nps.pasivos + '</span></div>' +
            '<div class="dato"><span class="dato-label">Detractores</span>' +
              '<span class="dato-val txt-error">' + nps.detractores + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><div>' +
          '<h3 class="card-title">Distribución de estrellas</h3>' +
          '<p class="card-sub">De 5 a 1 estrella sobre ' + res.total + ' reseñas</p>' +
        '</div></div>' +
        '<div class="card-body">' + bloqueDistribucion(res) + '</div>' +
      '</div>' +
    '</div>';

    /* Radar + tendencia */
    html += '<div class="grid g2">' +
      tarjetaRadar('Mis categorías', 'Atención, conocimiento, puntualidad y motivación',
        lista, CATS_COACH, 'var(--rojo,#E4322B)') +
      tarjetaTendencia(lista, 'Mi tendencia mensual') +
    '</div>';

    /* Cómo mejorar */
    html += '<div class="card card-rojo">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">' + ico('meta', 18) + ' Cómo mejorar</h3>' +
        '<p class="card-sub">Sugerencias a partir de tu categoría peor evaluada</p>' +
      '</div></div>' +
      bloqueMejorar(ejes) +
    '</div>';

    /* Comentarios recibidos */
    var visibles = lista.slice(0, estadoCoach.limite);
    html += '<div class="card">' +
      '<div class="card-head"><div>' +
        '<h3 class="card-title">Comentarios recibidos</h3>' +
        '<p class="card-sub">Las respuestas a las reseñas las escribe dirección</p>' +
      '</div></div>' +
      '<div class="card-body" data-lista-coach>';

    var i;
    for (i = 0; i < visibles.length; i++) {
      html += resenaHTML(visibles[i], { usuario: usuario, responder: false, mostrarDestino: false });
    }

    if (lista.length > visibles.length) {
      html += '<div class="row center mt">' +
        '<button type="button" class="btn btn-outline" data-mas-coach>Mostrar ' +
          Math.min(PAGINA_RESENAS, lista.length - visibles.length) + ' más</button>' +
        '</div>';
    }

    html += '</div></div>';
    html += '</div>';

    return {
      html: html,
      listo: function (root) {
        asegurarEstilos();
        AG.Utils.delegar(root, 'click', '[data-mas-coach]', function () {
          estadoCoach.limite += PAGINA_RESENAS;
          AG.Router.refrescar();
        });
      }
    };
  }

  /* =========================================================
     9. Registro de rutas
     ========================================================= */

  AG.Mod.Calificaciones = Mod;

  AG.Router.registrar({
    path: 'director/calificaciones',
    roles: ['director'],
    titulo: 'Calificaciones',
    nav: { etiqueta: 'Calificaciones', icono: 'estrella', grupo: 'Negocio', orden: 2 },
    render: renderDirector
  });

  AG.Router.registrar({
    path: 'coach/calificaciones',
    roles: ['coach'],
    titulo: 'Mis calificaciones',
    nav: { etiqueta: 'Mis calificaciones', icono: 'estrella', grupo: 'Negocio', orden: 1 },
    render: renderCoach
  });

})(window.AG);
