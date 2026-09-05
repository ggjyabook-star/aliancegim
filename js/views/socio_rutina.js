/* =============================================================
   ALLIANCE GYM — Mi rutina (AG.Views.SocioRutina)
   -------------------------------------------------------------
   Ruta que registra:
     socio/rutina   roles ['socio']   nav: Mi entrenamiento · Mi rutina (1)

   Tres pestañas:
     Hoy       -> el entrenamiento del día con registro serie por serie,
                  temporizador de descanso y cierre de sesión.
     Semana    -> los días de la rutina en tarjetas (AG.Mod.Rutinas.vistaDia).
     Historial -> adherencia, sesiones, gráficas y récords personales.

   Control de acceso real: el socio SOLO ve y escribe lo suyo. Todos los
   datos se leen con su propio id (ctx.usuario.id); nunca se acepta un id
   por parámetro de ruta.

   Reutiliza (sin duplicar lógica):
     AG.Mod.Rutinas.vistaDia / estadisticasDia / chipsGrupos / leerRegistro
     AG.Mod.Ejercicios.detalle
     AG.Mod.Asistencia.checkIn
     AG.Calc.volumenEntrenamiento / caloriasQuemadasAprox / adherencia /
     AG.Calc.rachaDias / AG.Calc.rm1
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;

  /* =============================================================
     1. Constantes de dominio
     ============================================================= */

  /* Qué días de la semana toca entrenar según los días por semana del plan.
     0 = domingo (igual que Date.getDay()). Es el mismo reparto que usa la
     siembra del sistema, así el calendario del socio siempre cuadra. */
  var DIAS_ENTRENO = {
    1: [1],
    2: [2, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 0]
  };

  var ESFUERZOS = [
    { min: 1, max: 2, texto: 'Muy suave', clase: 'txt-ok' },
    { min: 3, max: 4, texto: 'Ligero', clase: 'txt-ok' },
    { min: 5, max: 6, texto: 'Moderado', clase: 'txt-warn' },
    { min: 7, max: 8, texto: 'Exigente', clase: 'txt-warn' },
    { min: 9, max: 10, texto: 'Al límite', clase: 'txt-error' }
  ];

  var COLUMNAS_RECORDS = [
    { clave: 'nombre', etiqueta: 'Ejercicio', tipo: 'texto' },
    { clave: 'peso', etiqueta: 'Mejor peso', tipo: 'num' },
    { clave: 'reps', etiqueta: 'Reps', tipo: 'num' },
    { clave: 'rm', etiqueta: '1RM est.', tipo: 'num' },
    { clave: 'volumen', etiqueta: 'Volumen total', tipo: 'num' },
    { clave: 'sesiones', etiqueta: 'Sesiones', tipo: 'num' },
    { clave: 'ultima', etiqueta: 'Última vez', tipo: 'texto' }
  ];

  /* Estado vivo de la pantalla (sobrevive a los repintados parciales) */
  var estado = {
    tab: 'hoy',
    diaIndex: null,                 // null = se calcula por el día de la semana
    orden: { campo: 'peso', dir: 'desc' },
    inicioSesion: null              // marca de tiempo de la primera serie marcada
  };

  /* Temporizador de descanso: una sola instancia viva en toda la vista */
  var reloj = { id: null, restante: 0, total: 0, nodo: null };

  var navegacionEnganchada = false;

  /* =============================================================
     2. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    if (AG.Icons && typeof AG.Icons.get === 'function') {
      try { return AG.Icons.get(nombre, tam || 18); } catch (e) { return ''; }
    }
    return '';
  }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function lista(v) { return esArreglo(v) ? v : []; }

  function entero(v, porDefecto) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : porDefecto;
  }

  function numero(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function texto(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }

  function limitar(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function toast(mensaje, tipo) { U.toast(mensaje, tipo || 'info'); }

  /** Ejercicio del catálogo, siempre tolerante. */
  function ejercicioDe(id) {
    if (AG.Data && typeof AG.Data.ejercicio === 'function') {
      try { return AG.Data.ejercicio(id); } catch (e) { return null; }
    }
    return null;
  }

  function nombreEjercicio(id) {
    var ej = ejercicioDe(id);
    return ej && ej.nombre ? ej.nombre : 'Ejercicio no disponible';
  }

  function grupoDe(id) {
    if (AG.Data && typeof AG.Data.grupo === 'function') {
      try {
        var g = AG.Data.grupo(id);
        if (g) return g;
      } catch (e) { /* respaldo abajo */ }
    }
    return { id: 'general', nombre: 'General', color: '#8a8f98' };
  }

  function nombreEquipo(id) {
    if (AG.Data && typeof AG.Data.nombreEquipo === 'function') {
      try { return AG.Data.nombreEquipo(id); } catch (e) { return ''; }
    }
    return '';
  }

  /** Series prescritas de un ejercicio (0 a 20). */
  function seriesDe(ej) {
    var n = entero(ej && ej.series, 0);
    return limitar(n, 0, 20);
  }

  /** Descanso prescrito en segundos (0 a 600). */
  function descansoDe(ej) {
    var n = entero(ej && ej.descansoSeg, 60);
    return limitar(n, 0, 600);
  }

  /** '90 s' / '1:30 min' */
  function descansoTexto(seg) {
    var n = entero(seg, 0);
    if (n <= 0) return 'Sin descanso';
    if (n < 60) return n + ' s';
    var min = Math.floor(n / 60);
    var resto = n % 60;
    return resto ? min + ':' + (resto < 10 ? '0' : '') + resto + ' min' : min + ' min';
  }

  /** '1:30' para el marcador del temporizador. */
  function relojTexto(seg) {
    var n = Math.max(0, Math.round(numero(seg)));
    var min = Math.floor(n / 60);
    var s = n % 60;
    return min + ':' + (s < 10 ? '0' : '') + s;
  }

  /** '4 × 8-10' */
  function seriesPorReps(ej) {
    var s = seriesDe(ej);
    var reps = texto(ej && ej.reps).trim();
    if (!s && !reps) return 'Sin prescripción';
    if (!reps) return s + (s === 1 ? ' serie' : ' series');
    return s + ' × ' + reps;
  }

  /** Primer número de una prescripción de reps ('8-10' -> 8). */
  function repsObjetivo(reps) {
    var m = /(\d+)/.exec(texto(reps));
    return m ? Number(m[1]) : '';
  }

  /** Estadísticas del día delegadas en el módulo de rutinas. */
  function statsDia(dia) {
    if (AG.Mod && AG.Mod.Rutinas && typeof AG.Mod.Rutinas.estadisticasDia === 'function') {
      try { return AG.Mod.Rutinas.estadisticasDia(dia); } catch (e) { /* respaldo abajo */ }
    }
    var ejercicios = lista(dia && dia.ejercicios);
    var series = 0, seg = 0, i;
    for (i = 0; i < ejercicios.length; i++) {
      var s = seriesDe(ejercicios[i]);
      series += s;
      seg += s * (descansoDe(ejercicios[i]) + 40);
    }
    return { ejercicios: ejercicios.length, series: series, minutos: Math.round(seg / 60), grupos: [] };
  }

  /** Chips de grupos musculares delegados en el módulo de rutinas. */
  function chipsGrupos(ids, maximo) {
    if (AG.Mod && AG.Mod.Rutinas && typeof AG.Mod.Rutinas.chipsGrupos === 'function') {
      try { return AG.Mod.Rutinas.chipsGrupos(ids, maximo); } catch (e) { /* respaldo abajo */ }
    }
    var arr = lista(ids);
    if (!arr.length) return '<span class="mini muted">Sin grupos definidos</span>';
    var html = '<div class="chips">';
    for (var i = 0; i < arr.length; i++) {
      var g = grupoDe(arr[i]);
      html += '<span class="chip chip-sm" style="cursor:default">' + esc(g.nombre) + '</span>';
    }
    return html + '</div>';
  }

  /** Lee la captura de series delegando en AG.Mod.Rutinas.leerRegistro. */
  function leerRegistro(raiz) {
    if (AG.Mod && AG.Mod.Rutinas && typeof AG.Mod.Rutinas.leerRegistro === 'function') {
      try { return AG.Mod.Rutinas.leerRegistro(raiz); } catch (e) { /* respaldo abajo */ }
    }
    var salida = [];
    var bloques = U.$$('[data-registro-ej]', raiz);
    for (var i = 0; i < bloques.length; i++) {
      var series = [];
      var filas = U.$$('[data-serie]', bloques[i]);
      for (var j = 0; j < filas.length; j++) {
        var reps = U.$('[data-reps]', filas[j]);
        var peso = U.$('[data-peso]', filas[j]);
        var hecho = U.$('[data-hecho]', filas[j]);
        series.push({
          reps: reps && reps.value !== '' ? U.aNumero(reps.value) : 0,
          peso: peso && peso.value !== '' ? U.aNumero(peso.value) : 0,
          hecho: !!(hecho && hecho.checked)
        });
      }
      salida.push({ ejercicioId: bloques[i].getAttribute('data-ejercicio-id') || '', series: series });
    }
    return salida;
  }

  /** Enlace de WhatsApp a partir de un teléfono mexicano ('' si no sirve). */
  function enlaceWhatsApp(telefono) {
    var digitos = texto(telefono).replace(/\D/g, '');
    if (digitos.length < 10) return '';
    if (digitos.length === 10) digitos = '52' + digitos;
    return 'https://wa.me/' + digitos;
  }

  /** Lunes de la semana a la que pertenece una fecha 'YYYY-MM-DD'. */
  function lunesDe(fechaISO) {
    var d = U.aDate(fechaISO);
    if (!d) return '';
    return U.sumaDias(fechaISO, -((d.getDay() + 6) % 7));
  }

  function esfuerzoInfo(n) {
    var v = limitar(Math.round(numero(n)), 1, 10);
    for (var i = 0; i < ESFUERZOS.length; i++) {
      if (v >= ESFUERZOS[i].min && v <= ESFUERZOS[i].max) return ESFUERZOS[i];
    }
    return ESFUERZOS[2];
  }

  /** Último peso corporal registrado del socio (o null). */
  function pesoActual(socioId) {
    var meds = AG.DB.medicionesDe(socioId);
    for (var i = meds.length - 1; i >= 0; i--) {
      var p = Number(meds[i] && meds[i].pesoKg);
      if (isFinite(p) && p > 0) return p;
    }
    return null;
  }

  function vacioHTML(iconoNombre, titulo, mensaje, botones) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre, 30) + '</div>' +
      (titulo ? '<h3 class="card-title">' + esc(titulo) + '</h3>' : '') +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botones ? '<div class="row center wrap mt">' + botones + '</div>' : '') +
    '</div>';
  }

  /* =============================================================
     3. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-rutina';

  function asegurarEstilos() {
    if (!document || !document.head) return;
    if (document.getElementById(CSS_ID)) return;

    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.sr-ej{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:11px 12px}' +
      '.sr-ej.sr-listo{box-shadow:inset 3px 0 0 var(--ok)}' +
      '.sr-idx{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:inline-grid;' +
        'place-items:center;background:var(--rojo);color:#fff;font-size:12px;font-weight:800;line-height:1}' +
      '.sr-punto{width:9px;height:9px;border-radius:50%;display:inline-block;flex:0 0 auto;margin-right:5px}' +
      '.sr-tabla{margin-top:10px;display:flex;flex-direction:column;gap:6px}' +
      '.sr-cab,.sr-serie{display:grid;gap:6px;align-items:center;' +
        'grid-template-columns:30px minmax(0,1fr) minmax(0,1fr) auto}' +
      '.sr-cab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;' +
        'color:var(--texto-3);padding:0 2px}' +
      '.sr-cab span:last-child{text-align:center}' +
      '.sr-serie{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel);padding:5px 7px}' +
      '.sr-serie.on{border-color:var(--ok)}' +
      '.sr-serie .input{height:34px;padding:0 8px;font-size:13px;text-align:center}' +
      '.sr-s{font-size:11px;font-weight:800;color:var(--texto-3);text-align:center}' +
      '.sr-check{gap:6px;justify-content:center;padding:0 2px}' +
      '.sr-ultima{font-size:11.5px;color:var(--texto-2);margin-top:8px;display:flex;' +
        'align-items:center;gap:6px;flex-wrap:wrap}' +
      '.sr-dia-sel{min-width:0;max-width:100%}' +
      '.sr-progreso{display:flex;align-items:center;gap:10px;margin-top:10px}' +
      '.sr-progreso .bar{flex:1 1 auto}' +
      '.sr-progreso-num{font-size:12.5px;font-weight:800;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.sr-timer{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:60;' +
        'display:flex;align-items:center;gap:12px;padding:10px 14px;max-width:calc(100% - 24px);' +
        'background:var(--panel);border:1px solid var(--borde-2);border-radius:var(--radio);' +
        'box-shadow:var(--sombra-lg)}' +
      '.sr-timer-num{font-size:24px;font-weight:800;color:var(--rojo-2);' +
        'font-variant-numeric:tabular-nums;line-height:1;min-width:56px;text-align:center}' +
      '.sr-timer-txt{min-width:0;display:flex;flex-direction:column;line-height:1.25}' +
      '.sr-timer-txt b{font-size:12.5px;color:var(--texto)}' +
      '.sr-timer-txt span{font-size:11px;color:var(--texto-3);white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis;max-width:150px}' +
      '.sr-esf{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:5px}' +
      '.sr-esf-btn{appearance:none;border:1px solid var(--borde);background:var(--panel-2);' +
        'color:var(--texto-2);border-radius:var(--radio-sm);padding:9px 0;font-size:13px;' +
        'font-weight:800;cursor:pointer;transition:var(--trans)}' +
      '.sr-esf-btn:hover{border-color:var(--borde-2);color:var(--texto)}' +
      '.sr-esf-btn.on{background:var(--rojo);border-color:var(--rojo);color:#fff}' +
      '.sr-det{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);overflow:hidden}' +
      '.sr-det>summary{cursor:pointer;list-style:none;padding:10px 12px;font-size:12.5px;' +
        'font-weight:800;color:var(--texto);display:flex;align-items:center;gap:8px}' +
      '.sr-det>summary::-webkit-details-marker{display:none}' +
      '.sr-det>summary::after{content:"+";margin-left:auto;color:var(--texto-3);' +
        'font-size:17px;font-weight:800;line-height:1}' +
      '.sr-det[open]>summary::after{content:"\\2212"}' +
      '.sr-det[open]>summary{border-bottom:1px solid var(--borde)}' +
      '.sr-det-cuerpo{padding:12px}' +
      '.sr-resumen{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));text-align:center}' +
      '.sr-resumen>div{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:11px 8px;min-width:0}' +
      '.sr-resumen b{display:block;font-size:17px;font-weight:800;color:var(--texto);' +
        'font-variant-numeric:tabular-nums}' +
      '.sr-resumen span{display:block;font-size:11px;color:var(--texto-3);margin-top:2px}' +
      '@media (max-width:520px){' +
        '.sr-cab span:nth-child(4),.sr-check span{display:none}' +
        '.sr-cab{font-size:9px;letter-spacing:0}' +
        '.sr-cab,.sr-serie{grid-template-columns:32px minmax(0,1fr) minmax(0,1fr) 28px}' +
        '.sr-timer{width:calc(100% - 24px);justify-content:space-between;gap:8px}' +
        '.sr-timer-txt span{max-width:96px}' +
        '.sr-esf{grid-template-columns:repeat(5,minmax(0,1fr))}' +
      '}';

    document.head.appendChild(st);
  }

  /* =============================================================
     4. Día que toca según el calendario
     ============================================================= */

  /** Días de la semana (0=domingo) en los que toca entrenar. */
  function diasDeEntreno(rutina) {
    var totalDias = lista(rutina && rutina.dias).length;
    var n = entero(rutina && rutina.diasPorSemana, 0);
    if (!n || n < 1) n = totalDias || 3;
    n = limitar(n, 1, 7);
    return DIAS_ENTRENO[n] || DIAS_ENTRENO[3];
  }

  /** 'Lun · Mié · Vie' */
  function textoDiasSemana(rutina) {
    var plan = diasDeEntreno(rutina);
    var cortos = U.DIAS_SEMANA_CORTOS || ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    var partes = [];
    for (var i = 0; i < plan.length; i++) partes.push(cortos[plan[i]] || '');
    return partes.join(' · ');
  }

  /**
   * Qué día de la rutina toca hoy.
   * @returns {{indice:Number, esHoy:Boolean, enDias:Number}}
   */
  function diaDeHoy(rutina) {
    var dias = lista(rutina && rutina.dias);
    if (!dias.length) return { indice: 0, esHoy: false, enDias: 0 };

    var plan = diasDeEntreno(rutina);
    var fechaHoy = U.aDate(U.hoy());
    var dow = fechaHoy ? fechaHoy.getDay() : 1;

    var pos = plan.indexOf(dow);
    if (pos >= 0) return { indice: pos % dias.length, esHoy: true, enDias: 0 };

    for (var salto = 1; salto <= 7; salto++) {
      var p = plan.indexOf((dow + salto) % 7);
      if (p >= 0) return { indice: p % dias.length, esHoy: false, enDias: salto };
    }
    return { indice: 0, esHoy: false, enDias: 0 };
  }

  /** Índice del día que se está mostrando en la pestaña Hoy. */
  function indiceVisible(rutina, bitacoraHoy) {
    var dias = lista(rutina && rutina.dias);
    if (!dias.length) return 0;

    if (estado.diaIndex !== null && estado.diaIndex !== undefined) {
      return limitar(entero(estado.diaIndex, 0), 0, dias.length - 1);
    }
    if (bitacoraHoy && bitacoraHoy.diaIndex !== null && bitacoraHoy.diaIndex !== undefined) {
      return limitar(entero(bitacoraHoy.diaIndex, 0), 0, dias.length - 1);
    }
    return limitar(diaDeHoy(rutina).indice, 0, dias.length - 1);
  }

  /* =============================================================
     5. Bitácoras: lectura y escritura
     ============================================================= */

  /** Bitácoras del socio (más reciente primero). */
  function bitacorasDe(socioId) {
    return AG.DB.bitacorasDe(socioId);
  }

  /** Bitácora de hoy para un día concreto de la rutina (o null). */
  function bitacoraDeHoy(socioId, diaIndex) {
    var hoy = U.hoy();
    var propias = AG.DB.donde('bitacoras', function (b) {
      return b && b.socioId === socioId && texto(b.fecha).slice(0, 10) === hoy;
    });
    if (!propias.length) return null;
    if (diaIndex === null || diaIndex === undefined) return propias[propias.length - 1];

    for (var i = 0; i < propias.length; i++) {
      if (entero(propias[i].diaIndex, -1) === entero(diaIndex, -2)) return propias[i];
    }
    return null;
  }

  /** ¿La bitácora tiene al menos una serie marcada como hecha? */
  function tieneSeriesHechas(bitacora) {
    var ejercicios = lista(bitacora && bitacora.ejercicios);
    for (var i = 0; i < ejercicios.length; i++) {
      var series = lista(ejercicios[i] && ejercicios[i].series);
      for (var j = 0; j < series.length; j++) {
        if (series[j] && series[j].hecho) return true;
      }
    }
    return false;
  }

  /** Series marcadas como hechas en una bitácora. */
  function contarSeriesHechas(bitacora) {
    var ejercicios = lista(bitacora && bitacora.ejercicios);
    var total = 0, i, j, series;
    for (i = 0; i < ejercicios.length; i++) {
      series = lista(ejercicios[i] && ejercicios[i].series);
      for (j = 0; j < series.length; j++) if (series[j] && series[j].hecho) total++;
    }
    return total;
  }

  /**
   * Devuelve la bitácora de hoy para el día indicado, creándola si falta.
   * Si existe una bitácora de hoy vacía de otro día, se reaprovecha en vez
   * de dejar basura en la base.
   */
  function obtenerOCrearBitacora(socio, rutina, diaIndex) {
    var propia = bitacoraDeHoy(socio.id, diaIndex);
    if (propia) return propia;

    var hoy = U.hoy();
    var sueltas = AG.DB.donde('bitacoras', function (b) {
      return b && b.socioId === socio.id && texto(b.fecha).slice(0, 10) === hoy;
    });
    for (var i = 0; i < sueltas.length; i++) {
      if (!tieneSeriesHechas(sueltas[i]) && sueltas[i].completada !== true) {
        return AG.DB.actualizar('bitacoras', sueltas[i].id, {
          rutinaId: rutina.id,
          diaIndex: diaIndex,
          ejercicios: []
        });
      }
    }

    return AG.DB.insertar('bitacoras', {
      socioId: socio.id,
      fecha: hoy,
      rutinaId: rutina.id,
      diaIndex: diaIndex,
      ejercicios: [],
      duracionMin: 0,
      esfuerzo: null,
      notas: '',
      completada: false
    });
  }

  /**
   * Última vez que el socio hizo un ejercicio (excluyendo la sesión actual).
   * @returns {{fecha, series:Array, cuantas:Number, reps:Number, peso:Number}|null}
   */
  function ultimaVezDe(bitacoras, ejercicioId, excluirId) {
    if (!ejercicioId) return null;
    for (var i = 0; i < bitacoras.length; i++) {
      var b = bitacoras[i];
      if (!b || (excluirId && b.id === excluirId)) continue;
      var ejercicios = lista(b.ejercicios);
      for (var j = 0; j < ejercicios.length; j++) {
        if (!ejercicios[j] || ejercicios[j].ejercicioId !== ejercicioId) continue;

        var series = lista(ejercicios[j].series);
        var hechas = [], k;
        for (k = 0; k < series.length; k++) {
          if (series[k] && series[k].hecho !== false) hechas.push(series[k]);
        }
        if (!hechas.length) continue;

        var mejor = hechas[0];
        for (k = 1; k < hechas.length; k++) {
          if (numero(hechas[k].peso) > numero(mejor.peso)) mejor = hechas[k];
        }
        return {
          fecha: texto(b.fecha).slice(0, 10),
          series: hechas,
          cuantas: hechas.length,
          reps: Math.round(numero(mejor.reps)),
          peso: numero(mejor.peso)
        };
      }
    }
    return null;
  }

  /* =============================================================
     6. Temporizador de descanso
     ============================================================= */

  function detenerTemporizador() {
    if (reloj.id) {
      try { clearInterval(reloj.id); } catch (e) { /* sin consecuencias */ }
      reloj.id = null;
    }
    reloj.restante = 0;
    reloj.total = 0;
    if (reloj.nodo && reloj.nodo.classList) reloj.nodo.classList.add('oculto');
    reloj.nodo = null;
  }

  function pintarTemporizador() {
    if (!reloj.nodo) return;
    var num = U.$('[data-timer-num]', reloj.nodo);
    if (num) num.textContent = relojTexto(reloj.restante);
    var barra = U.$('[data-timer-fill]', reloj.nodo);
    if (barra) {
      var pct = reloj.total > 0 ? limitar((reloj.restante / reloj.total) * 100, 0, 100) : 0;
      barra.style.width = pct + '%';
    }
  }

  /** Arranca la cuenta regresiva de descanso. */
  function iniciarDescanso(raiz, segundos, nombre) {
    var total = limitar(entero(segundos, 0), 0, 600);
    if (!total) return;

    detenerTemporizador();

    var panel = U.$('[data-timer]', raiz);
    if (!panel) return;

    reloj.nodo = panel;
    reloj.total = total;
    reloj.restante = total;

    var sub = U.$('[data-timer-sub]', panel);
    if (sub) sub.textContent = nombre || 'Siguiente serie';

    panel.classList.remove('oculto');
    pintarTemporizador();

    reloj.id = setInterval(function () {
      reloj.restante -= 1;
      if (reloj.restante <= 0) {
        pintarTemporizadorFinal();
        return;
      }
      pintarTemporizador();
    }, 1000);
  }

  function pintarTemporizadorFinal() {
    reloj.restante = 0;
    pintarTemporizador();
    var panel = reloj.nodo;
    detenerTemporizador();
    if (panel && panel.classList) panel.classList.add('oculto');
    toast('¡Descanso terminado! Va la siguiente serie.', 'ok');
  }

  function temporizadorHTML() {
    return '<div class="sr-timer oculto" data-timer role="status" aria-live="polite">' +
      '<div class="sr-timer-txt">' +
        '<b>Descanso</b>' +
        '<span data-timer-sub>Siguiente serie</span>' +
        '<span class="bar bar-fina" style="width:110px;margin-top:4px">' +
          '<span class="bar-fill" data-timer-fill style="width:100%"></span>' +
        '</span>' +
      '</div>' +
      '<div class="sr-timer-num mono" data-timer-num>0:00</div>' +
      '<div class="row-sm">' +
        '<button type="button" class="btn btn-sm btn-outline" data-timer-mas>+15 s</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-timer-saltar>Saltar</button>' +
      '</div>' +
    '</div>';
  }

  /* =============================================================
     7. Pestaña HOY
     ============================================================= */

  /** Fila de captura de una serie. */
  function filaSerie(indiceSerie, valores) {
    var reps = (valores && valores.reps !== '' && valores.reps !== null && valores.reps !== undefined)
      ? valores.reps : '';
    var peso = (valores && valores.peso !== '' && valores.peso !== null && valores.peso !== undefined)
      ? valores.peso : '';
    var hecho = !!(valores && valores.hecho);
    var n = indiceSerie + 1;

    return '<div class="sr-serie' + (hecho ? ' on' : '') + '" data-serie="' + indiceSerie + '">' +
      '<span class="sr-s">S' + n + '</span>' +
      '<input class="input" type="number" min="0" step="0.5" inputmode="decimal" data-peso ' +
        'placeholder="kg" aria-label="Peso en kilos de la serie ' + n + '" value="' + esc(peso) + '">' +
      '<input class="input" type="number" min="0" step="1" inputmode="numeric" data-reps ' +
        'placeholder="reps" aria-label="Repeticiones de la serie ' + n + '" value="' + esc(reps) + '">' +
      '<label class="check sr-check" title="Marcar la serie ' + n + ' como hecha">' +
        '<input type="checkbox" data-hecho' + (hecho ? ' checked' : '') +
          ' aria-label="Serie ' + n + ' hecha">' +
        '<span class="mini">Hecha</span>' +
      '</label>' +
    '</div>';
  }

  /** Tarjeta de un ejercicio con su mini tabla de registro. */
  function tarjetaEjercicio(ej, indice, registro, ultima) {
    var cat = ejercicioDe(ej && ej.ejercicioId);
    var nombre = cat && cat.nombre ? cat.nombre : 'Ejercicio no disponible';
    var g = cat ? grupoDe(cat.grupo) : null;
    var equipo = cat ? nombreEquipo(cat.equipo) : '';
    var tempo = texto(ej && ej.tempo).trim();
    var pesoSugerido = texto(ej && ej.peso).trim();
    var notas = texto(ej && ej.notas).trim();
    var total = seriesDe(ej);
    var descanso = descansoDe(ej);
    var objetivo = repsObjetivo(ej && ej.reps);

    var seriesGuardadas = lista(registro && registro.series);
    var hechas = 0, i;
    for (i = 0; i < seriesGuardadas.length && i < total; i++) {
      if (seriesGuardadas[i] && seriesGuardadas[i].hecho) hechas++;
    }
    var completo = total > 0 && hechas >= total;

    var html = '<div class="sr-ej' + (completo ? ' sr-listo' : '') + '"' +
      ' data-registro-ej="' + indice + '"' +
      ' data-ejercicio-id="' + esc(texto(ej && ej.ejercicioId)) + '"' +
      ' data-descanso="' + descanso + '"' +
      ' data-nombre="' + esc(nombre) + '">';

    html += '<div class="between wrap" style="gap:8px">' +
      '<div class="row-sm" style="min-width:0">' +
        '<span class="sr-idx">' + (indice + 1) + '</span>' +
        '<div style="min-width:0">' +
          '<div class="bold truncar">' + esc(nombre) + '</div>' +
          '<div class="mini muted truncar">' +
            (g ? '<i class="sr-punto" style="background:' + esc(g.color) + '"></i>' + esc(g.nombre) : 'Sin grupo') +
            (equipo ? ' · ' + esc(equipo) : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      (cat
        ? '<button type="button" class="btn btn-sm btn-ghost" data-detalle-ej="' + esc(cat.id) + '">' +
            icono('info', 15) + ' Técnica</button>'
        : '') +
    '</div>';

    html += '<div class="row-sm wrap mt-sm">' +
      '<span class="pill pill-rojo">' + esc(seriesPorReps(ej)) + '</span>' +
      '<span class="pill">' + icono('reloj', 13) + esc(descansoTexto(descanso)) + '</span>' +
      (tempo ? '<span class="pill">Tempo ' + esc(tempo) + '</span>' : '') +
      (pesoSugerido ? '<span class="pill">' + icono('balanza', 13) + esc(pesoSugerido) + '</span>' : '') +
    '</div>';

    if (notas) {
      html += '<p class="mini muted mt-sm">' + icono('chat', 12) + ' <b>Tu coach:</b> ' + esc(notas) + '</p>';
    }

    if (ultima) {
      html += '<p class="sr-ultima">' + icono('historial', 13) +
        '<span><b>Última vez:</b> ' + ultima.cuantas + ' × ' + esc(U.num(ultima.reps, 0)) +
        (ultima.peso > 0 ? ' @ ' + esc(U.num(ultima.peso, 1)) + ' kg' : ' (peso corporal)') +
        ' · ' + esc(U.fechaRelativa(ultima.fecha)) + '</span></p>';
    } else {
      html += '<p class="sr-ultima muted">' + icono('info', 13) +
        '<span>Primera vez que lo registras: anota lo que hagas para tener referencia la próxima.</span></p>';
    }

    if (!total) {
      html += '<p class="mini muted mt-sm">Este ejercicio no tiene series prescritas: hazlo según las indicaciones de tu coach.</p>';
      return html + '</div>';
    }

    html += '<div class="sr-tabla">' +
      '<div class="sr-cab"><span>Serie</span><span>Peso kg</span><span>Reps</span><span>Hecha</span></div>';

    for (i = 0; i < total; i++) {
      var guardada = seriesGuardadas[i];
      var valores;
      if (guardada) {
        valores = {
          reps: (numero(guardada.reps) > 0 ? numero(guardada.reps) : ''),
          peso: (numero(guardada.peso) > 0 ? numero(guardada.peso) : ''),
          hecho: !!guardada.hecho
        };
      } else if (ultima && ultima.series[i]) {
        valores = {
          reps: numero(ultima.series[i].reps) > 0 ? Math.round(numero(ultima.series[i].reps)) : objetivo,
          peso: numero(ultima.series[i].peso) > 0 ? numero(ultima.series[i].peso) : '',
          hecho: false
        };
      } else if (ultima) {
        valores = { reps: objetivo, peso: ultima.peso > 0 ? ultima.peso : '', hecho: false };
      } else {
        valores = { reps: objetivo, peso: '', hecho: false };
      }
      html += filaSerie(i, valores);
    }

    return html + '</div></div>';
  }

  /** Selector de día de la rutina. */
  function selectorDiaHTML(rutina, indice) {
    var dias = lista(rutina.dias);
    var html = '<select class="select sr-dia-sel" data-dia-sel aria-label="Elegir el día de la rutina">';
    for (var i = 0; i < dias.length; i++) {
      var d = dias[i] || {};
      var etiqueta = texto(d.nombre) || ('Día ' + (i + 1));
      if (texto(d.enfoque).trim()) etiqueta += ' · ' + texto(d.enfoque).trim();
      html += '<option value="' + i + '"' + (i === indice ? ' selected' : '') + '>' + esc(etiqueta) + '</option>';
    }
    return html + '</select>';
  }

  /** Barra de progreso de la sesión. */
  function progresoHTML(hechas, totales) {
    var pct = totales > 0 ? Math.round((hechas / totales) * 100) : 0;
    var clase = pct >= 100 ? ' ok' : (pct >= 50 ? ' warn' : '');
    return '<div class="sr-progreso">' +
      '<span class="bar"><span class="bar-fill' + clase + '" data-progreso-fill style="width:' + pct + '%"></span></span>' +
      '<span class="sr-progreso-num" data-progreso-num>' + hechas + '/' + totales + ' series · ' + pct + ' %</span>' +
    '</div>';
  }

  /** Panel completo de la pestaña Hoy. */
  function panelHoy(socio, rutina, asignacion) {
    var dias = lista(rutina.dias);
    if (!dias.length) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('mancuerna', 'Tu rutina no tiene días cargados',
          'Pídele a tu coach que termine de armar «' + texto(rutina.nombre) + '» para que puedas entrenar.') +
      '</div></div>';
    }

    var bitPrevia = bitacoraDeHoy(socio.id, null);
    var indice = indiceVisible(rutina, bitPrevia);
    var dia = dias[indice] || {};
    var registro = bitacoraDeHoy(socio.id, indice);
    var st = statsDia(dia);
    var toca = diaDeHoy(rutina);
    var historial = bitacorasDe(socio.id);
    var ejercicios = lista(dia.ejercicios);

    var hechas = contarSeriesHechas(registro);
    var totalSeries = st.series;

    var badge;
    if (toca.esHoy && toca.indice === indice) {
      badge = U.badge('Hoy te toca este día', 'ok');
    } else if (toca.esHoy) {
      badge = U.badge('Hoy toca ' + (texto((dias[toca.indice] || {}).nombre) || ('el día ' + (toca.indice + 1))), 'info');
    } else {
      badge = U.badge('Hoy es día de descanso', 'muted');
    }

    var html = '<div class="stack">';

    /* --- Encabezado de la sesión --- */
    html += '<div class="card card-rojo">' +
      '<div class="card-body">' +
        '<div class="between wrap" style="gap:12px">' +
          '<div style="min-width:0">' +
            '<h2 class="card-title">' + icono('mancuerna', 20) + '<span>' + esc(texto(rutina.nombre) || 'Mi rutina') + '</span></h2>' +
            '<p class="card-sub">' + esc(texto(dia.enfoque) || 'Sin enfoque definido') + '</p>' +
          '</div>' +
          '<div class="row-sm wrap">' + badge + '</div>' +
        '</div>' +

        '<div class="form-row mt">' +
          '<div class="field flex1">' +
            '<label class="label">Día de entrenamiento</label>' +
            selectorDiaHTML(rutina, indice) +
          '</div>' +
        '</div>' +

        '<div class="row-sm wrap mt-sm">' +
          '<span class="pill">' + icono('mancuerna', 13) + '<b>' + st.ejercicios + '</b> ejercicios</span>' +
          '<span class="pill">' + icono('pesa', 13) + '<b>' + st.series + '</b> series</span>' +
          '<span class="pill">' + icono('reloj', 13) + '≈ <b>' + st.minutos + '</b> min</span>' +
          '<span class="pill">' + icono('calendario', 13) + esc(textoDiasSemana(rutina)) + '</span>' +
        '</div>' +

        '<div class="mt-sm">' + chipsGrupos(st.grupos, 8) + '</div>' +
        progresoHTML(hechas, totalSeries) +

        '<div class="row-sm wrap mt">' +
          '<button type="button" class="btn btn-primary" data-terminar>' +
            icono('check', 16) + ' Terminar entrenamiento</button>' +
          (registro && registro.completada
            ? '<span class="badge badge-ok">Sesión de hoy completada</span>'
            : '') +
        '</div>' +

        (texto(asignacion && asignacion.notas).trim()
          ? '<p class="mini muted mt-sm">' + icono('chat', 12) + ' ' + esc(asignacion.notas) + '</p>'
          : '') +
      '</div>' +
    '</div>';

    /* --- Calentamiento destacado --- */
    if (texto(dia.calentamiento).trim()) {
      html += '<div class="aviso aviso-warn">' + icono('fuego', 18) +
        '<div><b>Calentamiento</b><br>' + esc(dia.calentamiento) + '</div></div>';
    } else {
      html += '<div class="aviso aviso-warn">' + icono('fuego', 18) +
        '<div><b>Calentamiento</b><br>5 a 10 minutos de cardio suave y movilidad de las articulaciones que vas a usar.</div></div>';
    }

    /* --- Ejercicios --- */
    if (!ejercicios.length) {
      html += '<div class="card"><div class="card-body">' +
        vacioHTML('mancuerna', 'Este día no tiene ejercicios',
          'Avísale a tu coach para que lo complete; mientras tanto puedes revisar los otros días en la pestaña Semana.') +
      '</div></div>';
    } else {
      html += '<div class="stack-sm" data-lista-ejercicios>';
      for (var i = 0; i < ejercicios.length; i++) {
        var ejReg = null;
        var guardados = lista(registro && registro.ejercicios);
        for (var k = 0; k < guardados.length; k++) {
          if (guardados[k] && guardados[k].ejercicioId === ejercicios[i].ejercicioId) { ejReg = guardados[k]; break; }
        }
        if (!ejReg && guardados[i]) ejReg = guardados[i];
        var ultima = ultimaVezDe(historial, ejercicios[i].ejercicioId, registro ? registro.id : null);
        html += tarjetaEjercicio(ejercicios[i], i, ejReg, ultima);
      }
      html += '</div>';
    }

    /* --- Cardio del día --- */
    if (texto(dia.cardio).trim()) {
      html += '<div class="aviso aviso-info">' + icono('corazon', 18) +
        '<div><b>Cardio del día</b><br>' + esc(dia.cardio) + '</div></div>';
    }

    html += temporizadorHTML();

    return html + '</div>';
  }

  /* =============================================================
     8. Pestaña SEMANA
     ============================================================= */

  /** Días de la rutina ya entrenados en la semana en curso. */
  function entrenadosEstaSemana(socioId) {
    var inicio = lunesDe(U.hoy());
    var fin = U.sumaDias(inicio, 6);
    var hechos = {};
    var todas = bitacorasDe(socioId);
    for (var i = 0; i < todas.length; i++) {
      var f = texto(todas[i].fecha).slice(0, 10);
      if (!f || f < inicio || f > fin) continue;
      if (todas[i].completada === false && !tieneSeriesHechas(todas[i])) continue;
      var idx = entero(todas[i].diaIndex, -1);
      if (idx >= 0) hechos[idx] = f;
    }
    return hechos;
  }

  function panelSemana(socio, rutina) {
    var dias = lista(rutina.dias);
    if (!dias.length) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('calendario', 'Sin días cargados',
          'Tu rutina todavía no tiene días. Pídele a tu coach que la termine.') +
      '</div></div>';
    }

    var hechos = entrenadosEstaSemana(socio.id);
    var toca = diaDeHoy(rutina);
    var html = '<div class="stack">';

    html += '<div class="aviso aviso-info">' + icono('calendario', 18) +
      '<div><b>Tu semana</b><br>Entrenas <b>' + dias.length +
      (dias.length === 1 ? '</b> día' : '</b> días') + ' por semana: ' + esc(textoDiasSemana(rutina)) +
      '. Ya llevas <b>' + Object.keys(hechos).length + '</b> de <b>' + dias.length +
      '</b> sesiones de esta semana.</div></div>';

    for (var i = 0; i < dias.length; i++) {
      var dia = dias[i] || {};
      var st = statsDia(dia);
      var esHoy = toca.esHoy && toca.indice === i;
      var entrenado = Object.prototype.hasOwnProperty.call(hechos, i);

      html += '<div class="card">' +
        '<div class="card-head">' +
          '<div style="min-width:0">' +
            '<h3 class="card-title">' + esc(texto(dia.nombre) || ('Día ' + (i + 1))) + '</h3>' +
            '<p class="card-sub">' + esc(texto(dia.enfoque) || 'Sin enfoque definido') + '</p>' +
          '</div>' +
          '<div class="row-sm wrap">' +
            (esHoy ? U.badge('Hoy', 'ok') : '') +
            (entrenado ? U.badge('Entrenado ' + U.fecha(hechos[i], 'diaMes'), 'info') : U.badge('Pendiente', 'muted')) +
          '</div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="row-sm wrap">' +
            '<span class="pill">' + icono('mancuerna', 13) + '<b>' + st.ejercicios + '</b> ejercicios</span>' +
            '<span class="pill">' + icono('pesa', 13) + '<b>' + st.series + '</b> series</span>' +
            '<span class="pill">' + icono('reloj', 13) + '≈ <b>' + st.minutos + '</b> min</span>' +
          '</div>' +
          '<div class="mt-sm">' + chipsGrupos(st.grupos, 8) + '</div>' +
          '<details class="sr-det mt">' +
            '<summary>' + icono('ojo', 15) + ' Ver los ejercicios de este día</summary>' +
            '<div class="sr-det-cuerpo">' + vistaDiaSegura(rutina, i) + '</div>' +
          '</details>' +
        '</div>' +
        '<div class="card-foot">' +
          '<button type="button" class="btn btn-outline btn-sm" data-ir-dia="' + i + '">' +
            icono('mancuerna', 15) + ' Entrenar este día</button>' +
        '</div>' +
      '</div>';
    }

    return html + '</div>';
  }

  /** vistaDia del módulo de rutinas, sin interactivo y con red de seguridad. */
  function vistaDiaSegura(rutina, indice) {
    if (AG.Mod && AG.Mod.Rutinas && typeof AG.Mod.Rutinas.vistaDia === 'function') {
      try {
        var html = AG.Mod.Rutinas.vistaDia(rutina, indice, { interactivo: false });
        if (html) return String(html);
      } catch (e) { /* respaldo abajo */ }
    }
    var dia = lista(rutina.dias)[indice] || {};
    var ejercicios = lista(dia.ejercicios);
    if (!ejercicios.length) return '<p class="mini muted">Este día no tiene ejercicios cargados.</p>';
    var salida = '<ul class="list list-plana">';
    for (var i = 0; i < ejercicios.length; i++) {
      salida += '<li class="list-item"><div class="list-item-main">' +
        '<b>' + esc(nombreEjercicio(ejercicios[i].ejercicioId)) + '</b>' +
        '<span>' + esc(seriesPorReps(ejercicios[i])) + ' · ' + esc(descansoTexto(descansoDe(ejercicios[i]))) + '</span>' +
        '</div></li>';
    }
    return salida + '</ul>';
  }

  /* =============================================================
     9. Pestaña HISTORIAL
     ============================================================= */

  /** Enfoque de una sesión a partir de su rutina y día. */
  function enfoqueDeSesion(bitacora) {
    var rutina = bitacora && bitacora.rutinaId ? AG.DB.buscar('rutinas', bitacora.rutinaId) : null;
    var dias = lista(rutina && rutina.dias);
    var idx = entero(bitacora && bitacora.diaIndex, -1);
    if (idx >= 0 && dias[idx]) {
      return texto(dias[idx].enfoque) || texto(dias[idx].nombre) || ('Día ' + (idx + 1));
    }
    if (rutina) return texto(rutina.nombre) || 'Sesión libre';
    return 'Sesión libre';
  }

  /** Agrega volumen y sesiones por semana (las últimas 8). */
  function porSemana(bitacoras, cuantas) {
    var n = cuantas || 8;
    var lunesHoy = lunesDe(U.hoy());
    var semanas = [], i;

    for (i = n - 1; i >= 0; i--) {
      var inicio = U.sumaDias(lunesHoy, -7 * i);
      semanas.push({
        inicio: inicio,
        fin: U.sumaDias(inicio, 6),
        etiqueta: U.fecha(inicio, 'diaMes'),
        volumen: 0,
        sesiones: 0
      });
    }

    for (i = 0; i < bitacoras.length; i++) {
      var b = bitacoras[i];
      var f = texto(b.fecha).slice(0, 10);
      if (!f) continue;
      for (var j = 0; j < semanas.length; j++) {
        if (f >= semanas[j].inicio && f <= semanas[j].fin) {
          semanas[j].volumen += Calc.volumenEntrenamiento(b);
          if (b.completada !== false) semanas[j].sesiones++;
          break;
        }
      }
    }
    return semanas;
  }

  /** Récords personales por ejercicio. */
  function calcularRecords(bitacoras) {
    var mapa = {}, i, j, k;

    for (i = 0; i < bitacoras.length; i++) {
      var b = bitacoras[i];
      var fecha = texto(b.fecha).slice(0, 10);
      var ejercicios = lista(b.ejercicios);

      for (j = 0; j < ejercicios.length; j++) {
        var e = ejercicios[j];
        if (!e || !e.ejercicioId) continue;
        var series = lista(e.series);
        var aporta = false;

        if (!mapa[e.ejercicioId]) {
          mapa[e.ejercicioId] = {
            id: e.ejercicioId,
            nombre: nombreEjercicio(e.ejercicioId),
            peso: 0, reps: 0, rm: 0, volumen: 0, sesiones: 0, ultima: ''
          };
        }
        var r = mapa[e.ejercicioId];

        for (k = 0; k < series.length; k++) {
          var s = series[k];
          if (!s || s.hecho === false) continue;
          var peso = numero(s.peso), reps = numero(s.reps);
          if (reps <= 0) continue;
          aporta = true;
          if (peso > 0) {
            r.volumen += peso * reps;
            if (peso > r.peso) {
              r.peso = peso;
              r.reps = Math.round(reps);
            }
          }
        }

        if (aporta) {
          r.sesiones++;
          if (!r.ultima || fecha > r.ultima) r.ultima = fecha;
        }
      }
    }

    var salida = [];
    for (var clave in mapa) {
      if (!Object.prototype.hasOwnProperty.call(mapa, clave)) continue;
      var reg = mapa[clave];
      if (!reg.sesiones) continue;
      reg.volumen = Math.round(reg.volumen);
      var rm = Calc.rm1(reg.peso, reg.reps);
      reg.rm = (rm === null || !isFinite(rm)) ? 0 : rm;
      salida.push(reg);
    }
    return salida;
  }

  /** Tabla ordenable de récords personales. */
  function tablaRecordsHTML(records) {
    if (!records.length) {
      return vacioHTML('trofeo', 'Todavía sin récords',
        'En cuanto registres series con peso, aquí verás tu mejor marca de cada ejercicio.');
    }

    var campo = estado.orden.campo;
    var dir = estado.orden.dir;
    var columna = null, i;
    for (i = 0; i < COLUMNAS_RECORDS.length; i++) {
      if (COLUMNAS_RECORDS[i].clave === campo) columna = COLUMNAS_RECORDS[i];
    }
    if (!columna) { columna = COLUMNAS_RECORDS[1]; campo = columna.clave; }

    var ordenados = U.ordenar(records, function (r) {
      if (columna.tipo === 'num') return numero(r[campo]);
      return U.normalizar(texto(r[campo]));
    }, dir);

    var html = '<div class="table-wrap"><table class="table table-compacta"><thead><tr>';
    for (i = 0; i < COLUMNAS_RECORDS.length; i++) {
      var c = COLUMNAS_RECORDS[i];
      var clase = 'sortable' + (c.clave === campo ? ' ' + dir : '');
      html += '<th class="' + clase + '" data-orden="' + esc(c.clave) + '" scope="col">' + esc(c.etiqueta) + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (i = 0; i < ordenados.length; i++) {
      var r = ordenados[i];
      html += '<tr>' +
        '<td><b>' + esc(r.nombre) + '</b></td>' +
        '<td class="nums">' + (r.peso > 0 ? esc(U.num(r.peso, 1)) + ' kg' : '—') + '</td>' +
        '<td class="nums">' + (r.reps > 0 ? esc(U.num(r.reps, 0)) : '—') + '</td>' +
        '<td class="nums">' + (r.rm > 0 ? esc(U.num(r.rm, 1)) + ' kg' : '—') + '</td>' +
        '<td class="nums">' + esc(U.num(r.volumen, 0)) + ' kg</td>' +
        '<td class="nums">' + r.sesiones + '</td>' +
        '<td>' + (r.ultima ? esc(U.fecha(r.ultima, 'corto')) : '—') + '</td>' +
      '</tr>';
    }

    return html + '</tbody></table></div>';
  }

  function panelHistorial(socio, rutina) {
    var bitacoras = bitacorasDe(socio.id);

    if (!bitacoras.length) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('historial', 'Sin sesiones registradas',
          'Cuando marques tus primeras series en la pestaña Hoy, aquí verás tu historial completo.') +
      '</div></div>';
    }

    var mes = U.mesActual();
    var desde = mes + '-01';
    var hasta = U.hoy();
    var diasPorSemana = entero(rutina && rutina.diasPorSemana, 0) || lista(rutina && rutina.dias).length || 3;

    var delMes = [], volumenMes = 0, completadasMes = 0, i;
    for (i = 0; i < bitacoras.length; i++) {
      var f = texto(bitacoras[i].fecha).slice(0, 10);
      if (f.slice(0, 7) !== mes) continue;
      delMes.push(bitacoras[i]);
      volumenMes += Calc.volumenEntrenamiento(bitacoras[i]);
      if (bitacoras[i].completada !== false) completadasMes++;
    }

    var adh = Calc.adherencia(bitacoras, desde, hasta, diasPorSemana);
    var racha = Calc.rachaDias(AG.DB.asistenciasDe(socio.id));
    var semanas = porSemana(bitacoras, 8);

    var datosVolumen = [], datosSesiones = [];
    for (i = 0; i < semanas.length; i++) {
      datosVolumen.push({ etiqueta: semanas[i].etiqueta, valor: Math.round(semanas[i].volumen) });
      datosSesiones.push({ etiqueta: semanas[i].etiqueta, valor: semanas[i].sesiones });
    }

    var html = '<div class="stack">';

    /* --- Adherencia del mes --- */
    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<h3 class="card-title">' + icono('meta', 18) + '<span>Tu mes: ' + esc(U.nombreMes(mes)) + '</span></h3>' +
          '<p class="card-sub">Adherencia calculada sobre las ' + adh.esperadas + ' sesiones que te tocaban.</p>' +
        '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="grid g2">' +
          '<div class="center">' +
            '<div class="anillo">' +
              Charts.progreso(adh.pct, { texto: adh.pct + ' %', etiqueta: 'Adherencia', alto: 160, grosor: 13 }) +
            '</div>' +
          '</div>' +
          '<div class="sr-resumen">' +
            '<div><b>' + completadasMes + '</b><span>Sesiones del mes</span></div>' +
            '<div><b>' + esc(U.num(Math.round(volumenMes), 0)) + '</b><span>kg movidos</span></div>' +
            '<div><b>' + racha + '</b><span>' + (racha === 1 ? 'día de racha' : 'días de racha') + '</span></div>' +
          '</div>' +
        '</div>' +
        '<p class="mini muted mt">' + icono('info', 12) + ' Llevas <b>' + adh.hechas +
          '</b> de <b>' + adh.esperadas + '</b> sesiones esperadas este mes.</p>' +
      '</div>' +
    '</div>';

    /* --- Gráficas por semana --- */
    html += '<div class="grid g2">' +
      '<div class="card"><div class="card-head"><h3 class="card-title">' +
        icono('grafica', 18) + '<span>Volumen por semana</span></h3></div>' +
        '<div class="card-body"><div class="grafica">' +
          Charts.barras(datosVolumen, { alto: 230, sufijo: ' kg', vacio: 'Aún no hay volumen registrado.' }) +
        '</div></div></div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title">' +
        icono('calendario', 18) + '<span>Sesiones por semana</span></h3></div>' +
        '<div class="card-body"><div class="grafica">' +
          Charts.barras(datosSesiones, { alto: 230, color: 'var(--info,#3B82F6)', vacio: 'Aún no hay sesiones registradas.' }) +
        '</div></div></div>' +
    '</div>';

    /* --- Últimas 20 sesiones --- */
    var ultimas = bitacoras.slice(0, 20);
    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<h3 class="card-title">' + icono('historial', 18) + '<span>Tus últimas sesiones</span></h3>' +
          '<p class="card-sub">Toca cualquiera para ver el detalle completo.</p>' +
        '</div>' +
        '<span class="badge badge-muted">' + ultimas.length + ' de ' + bitacoras.length + '</span>' +
      '</div>' +
      '<div class="card-body">';

    if (!ultimas.length) {
      html += vacioHTML('historial', '', 'Todavía no registras sesiones.');
    } else {
      html += '<div class="list">';
      for (i = 0; i < ultimas.length; i++) {
        var b = ultimas[i];
        var vol = Calc.volumenEntrenamiento(b);
        var series = contarSeriesHechas(b);
        var esf = numero(b.esfuerzo);
        html += '<button type="button" class="list-item" data-sesion="' + esc(b.id) + '">' +
          '<div class="list-item-main">' +
            '<b>' + esc(U.fecha(b.fecha, 'corto')) + ' · ' + esc(enfoqueDeSesion(b)) + '</b>' +
            '<span>' + series + (series === 1 ? ' serie' : ' series') +
              ' · ' + esc(U.num(vol, 0)) + ' kg' +
              (numero(b.duracionMin) > 0 ? ' · ' + esc(U.num(b.duracionMin, 0)) + ' min' : '') +
              (esf > 0 ? ' · esfuerzo ' + esc(U.num(esf, 0)) + '/10' : '') +
            '</span>' +
          '</div>' +
          '<div class="list-item-side">' +
            (b.completada === false ? U.badge('Sin cerrar', 'warn') : U.badge('Completada', 'ok')) +
          '</div>' +
        '</button>';
      }
      html += '</div>';
    }
    html += '</div></div>';

    /* --- Récords personales --- */
    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div>' +
          '<h3 class="card-title">' + icono('trofeo', 18) + '<span>Tus récords personales</span></h3>' +
          '<p class="card-sub">Toca los encabezados para ordenar la tabla.</p>' +
        '</div>' +
      '</div>' +
      '<div class="card-body" data-records>' + tablaRecordsHTML(calcularRecords(bitacoras)) + '</div>' +
    '</div>';

    return html + '</div>';
  }

  /** Modal con el detalle de una sesión. */
  function detalleSesion(socio, bitacoraId) {
    var b = AG.DB.buscar('bitacoras', bitacoraId);
    if (!b || b.socioId !== socio.id) {
      toast('No encontramos esa sesión en tu historial.', 'warn');
      return;
    }

    var vol = Calc.volumenEntrenamiento(b);
    var kcal = Calc.caloriasQuemadasAprox(b, pesoActual(socio.id));
    var series = contarSeriesHechas(b);
    var esf = numero(b.esfuerzo);
    var ejercicios = lista(b.ejercicios);

    var cuerpo = '<div class="stack-sm">' +
      '<div class="row-sm wrap">' +
        '<span class="pill">' + icono('calendario', 13) + esc(U.fecha(b.fecha, 'largo')) + '</span>' +
        '<span class="pill">' + icono('meta', 13) + esc(enfoqueDeSesion(b)) + '</span>' +
        (numero(b.duracionMin) > 0
          ? '<span class="pill">' + icono('reloj', 13) + esc(U.num(b.duracionMin, 0)) + ' min</span>' : '') +
        (esf > 0
          ? '<span class="pill">' + icono('fuego', 13) + 'Esfuerzo ' + esc(U.num(esf, 0)) + '/10 · ' +
            esc(esfuerzoInfo(esf).texto) + '</span>' : '') +
      '</div>' +
      '<div class="sr-resumen">' +
        '<div><b>' + series + '</b><span>Series hechas</span></div>' +
        '<div><b>' + esc(U.num(vol, 0)) + '</b><span>kg de volumen</span></div>' +
        '<div><b>' + esc(U.num(kcal, 0)) + '</b><span>kcal aprox.</span></div>' +
      '</div>';

    if (texto(b.notas).trim()) {
      cuerpo += '<div class="aviso aviso-info">' + icono('chat', 16) + '<div>' + esc(b.notas) + '</div></div>';
    }

    if (!ejercicios.length) {
      cuerpo += '<p class="mini muted">Esta sesión no tiene ejercicios registrados.</p>';
    } else {
      cuerpo += '<div class="table-wrap"><table class="table table-compacta"><thead><tr>' +
        '<th scope="col">Ejercicio</th><th scope="col">Series hechas</th><th scope="col">Volumen</th>' +
        '</tr></thead><tbody>';
      for (var i = 0; i < ejercicios.length; i++) {
        var e = ejercicios[i];
        var detalle = [], volEj = 0;
        var ss = lista(e && e.series);
        for (var j = 0; j < ss.length; j++) {
          if (!ss[j] || ss[j].hecho === false) continue;
          var reps = Math.round(numero(ss[j].reps));
          var peso = numero(ss[j].peso);
          if (reps <= 0) continue;
          detalle.push(reps + (peso > 0 ? ' × ' + U.num(peso, 1) + ' kg' : ' reps'));
          volEj += reps * peso;
        }
        cuerpo += '<tr>' +
          '<td><b>' + esc(nombreEjercicio(e && e.ejercicioId)) + '</b></td>' +
          '<td>' + (detalle.length ? esc(detalle.join(' · ')) : '<span class="muted">Sin series marcadas</span>') + '</td>' +
          '<td class="nums">' + esc(U.num(Math.round(volEj), 0)) + ' kg</td>' +
        '</tr>';
      }
      cuerpo += '</tbody></table></div>';
    }

    cuerpo += '</div>';

    U.modal({
      titulo: 'Sesión del ' + U.fecha(b.fecha, 'corto'),
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }]
    });
  }

  /* =============================================================
     10. Guardado de series y cierre de la sesión
     ============================================================= */

  /** Cuenta las casillas marcadas y actualiza la barra de progreso. */
  function actualizarProgreso(raiz) {
    var casillas = U.$$('[data-hecho]', raiz);
    var hechas = 0, i;
    for (i = 0; i < casillas.length; i++) if (casillas[i].checked) hechas++;

    var total = casillas.length;
    var pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

    var fill = U.$('[data-progreso-fill]', raiz);
    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.remove('ok', 'warn');
      if (pct >= 100) fill.classList.add('ok');
      else if (pct >= 50) fill.classList.add('warn');
    }

    var num = U.$('[data-progreso-num]', raiz);
    if (num) num.textContent = hechas + '/' + total + ' series · ' + pct + ' %';

    /* Marca visual de ejercicio terminado */
    var bloques = U.$$('[data-registro-ej]', raiz);
    for (i = 0; i < bloques.length; i++) {
      var suyas = U.$$('[data-hecho]', bloques[i]);
      var listas = 0;
      for (var j = 0; j < suyas.length; j++) if (suyas[j].checked) listas++;
      bloques[i].classList.toggle('sr-listo', suyas.length > 0 && listas === suyas.length);
    }

    return { hechas: hechas, total: total, pct: pct };
  }

  /** Repite en la fila el valor de la serie anterior cuando el campo va vacío. */
  function copiarDeSerieAnterior(bloque, fila, selector) {
    var destino = U.$(selector, fila);
    if (!destino || texto(destino.value).trim()) return;
    var filas = U.$$('[data-serie]', bloque);
    var pos = filas.indexOf(fila);
    for (var i = pos - 1; i >= 0; i--) {
      var campo = U.$(selector, filas[i]);
      if (campo && texto(campo.value).trim()) { destino.value = campo.value; return; }
    }
  }

  /**
   * Vuelca lo capturado en pantalla a la bitácora de hoy.
   * @returns {Object|null} la bitácora guardada
   */
  function guardarCaptura(raiz, socio, rutina, diaIndex, forzarCreacion) {
    var ejercicios = leerRegistro(raiz);
    if (!ejercicios.length) return null;

    var existente = bitacoraDeHoy(socio.id, diaIndex);
    var hayAlgo = false, i, j;
    for (i = 0; i < ejercicios.length && !hayAlgo; i++) {
      var series = lista(ejercicios[i].series);
      for (j = 0; j < series.length; j++) {
        if (series[j] && series[j].hecho) { hayAlgo = true; break; }
      }
    }

    if (!existente && !hayAlgo && !forzarCreacion) return null;

    var bitacora = existente || obtenerOCrearBitacora(socio, rutina, diaIndex);
    if (!bitacora) return null;

    return AG.DB.actualizar('bitacoras', bitacora.id, {
      rutinaId: rutina.id,
      diaIndex: diaIndex,
      ejercicios: ejercicios
    });
  }

  /** ¿Ya hay asistencia registrada hoy? */
  function tieneAsistenciaHoy(socioId) {
    var hoy = U.hoy();
    var asistencias = AG.DB.asistenciasDe(socioId);
    for (var i = 0; i < asistencias.length; i++) {
      if (texto(asistencias[i].fecha).slice(0, 10) === hoy) return true;
    }
    return false;
  }

  /** Escala visual de esfuerzo 1-10. */
  function escalaEsfuerzoHTML(valor) {
    var html = '<div class="sr-esf" data-esf-grupo role="group" aria-label="Esfuerzo percibido del 1 al 10">';
    for (var i = 1; i <= 10; i++) {
      html += '<button type="button" class="sr-esf-btn' + (i === valor ? ' on' : '') +
        '" data-esf="' + i + '" aria-pressed="' + (i === valor ? 'true' : 'false') + '">' + i + '</button>';
    }
    return html + '</div>';
  }

  /** Modal de cierre del entrenamiento. */
  function terminarEntrenamiento(raiz, socio, rutina, diaIndex) {
    var estadisticas = actualizarProgreso(raiz);
    if (!estadisticas.hechas) {
      toast('Marca al menos una serie como hecha para poder cerrar la sesión.', 'warn');
      return;
    }

    var bitacora = guardarCaptura(raiz, socio, rutina, diaIndex, true);
    if (!bitacora) {
      toast('No pudimos guardar tu sesión. Intenta de nuevo.', 'error');
      return;
    }

    var dia = lista(rutina.dias)[diaIndex] || {};
    var st = statsDia(dia);

    /* Duración: tiempo real desde la primera serie marcada, o la estimación
       del día ajustada al avance real. La cifra siempre queda editable. */
    var estimada = Math.max(10, Math.round(st.minutos * (estadisticas.pct / 100 || 1)));
    var real = 0;
    if (estado.inicioSesion) {
      real = Math.round((Date.now() - estado.inicioSesion) / 60000);
    }
    var duracion = Math.max(estimada, real);
    if (numero(bitacora.duracionMin) > duracion) duracion = Math.round(numero(bitacora.duracionMin));
    duracion = limitar(duracion, 5, 300);

    var esfuerzoPrevio = limitar(entero(bitacora.esfuerzo, 7), 1, 10);

    var cuerpo = '<form data-form-cierre class="stack-sm">' +
      '<div class="aviso aviso-ok">' + icono('check', 16) +
        '<div>Llevas <b>' + estadisticas.hechas + '</b> de <b>' + estadisticas.total +
        '</b> series de «' + esc(texto(dia.nombre) || ('Día ' + (diaIndex + 1))) + '».</div></div>' +

      '<div class="field">' +
        '<label class="label" for="sr-duracion">Duración del entrenamiento (minutos)</label>' +
        '<input class="input" id="sr-duracion" name="duracionMin" type="number" min="5" max="300" step="1" ' +
          'inputmode="numeric" value="' + duracion + '">' +
        '<p class="help">La calculamos sola; ajústala si entrenaste más o menos tiempo.</p>' +
      '</div>' +

      '<div class="field">' +
        '<span class="label">¿Qué tan duro se sintió? (1 a 10)</span>' +
        escalaEsfuerzoHTML(esfuerzoPrevio) +
        '<input type="hidden" name="esfuerzo" data-esf-valor value="' + esfuerzoPrevio + '">' +
        '<p class="help" data-esf-texto>' + esc(esfuerzoInfo(esfuerzoPrevio).texto) + '</p>' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="sr-notas">Notas de la sesión (opcional)</label>' +
        '<textarea class="textarea" id="sr-notas" name="notas" rows="3" ' +
          'placeholder="¿Cómo te sentiste? ¿Subiste peso en algo?">' + esc(texto(bitacora.notas)) + '</textarea>' +
      '</div>' +
    '</form>';

    U.modal({
      titulo: 'Terminar entrenamiento',
      ancho: 'md',
      cuerpo: cuerpo,
      onOpen: function (root) {
        U.delegar(root, 'click', '[data-esf]', function (e, el) {
          e.preventDefault();
          var valor = limitar(entero(el.getAttribute('data-esf'), 7), 1, 10);
          var botones = U.$$('[data-esf]', root);
          for (var i = 0; i < botones.length; i++) {
            var suyo = entero(botones[i].getAttribute('data-esf'), 0) === valor;
            botones[i].classList.toggle('on', suyo);
            botones[i].setAttribute('aria-pressed', suyo ? 'true' : 'false');
          }
          var oculto = U.$('[data-esf-valor]', root);
          if (oculto) oculto.value = String(valor);
          var ayuda = U.$('[data-esf-texto]', root);
          if (ayuda) ayuda.textContent = esfuerzoInfo(valor).texto;
        });
      },
      acciones: [
        { texto: 'Seguir entrenando', clase: 'btn-ghost' },
        {
          texto: 'Guardar y celebrar',
          clase: 'btn-primary',
          onClick: function (api) {
            var form = U.$('[data-form-cierre]', api.root);
            var datos = form ? U.formToObject(form) : {};
            var mins = limitar(entero(datos.duracionMin, duracion), 5, 300);
            var esf = limitar(entero(datos.esfuerzo, esfuerzoPrevio), 1, 10);

            var guardada = AG.DB.actualizar('bitacoras', bitacora.id, {
              duracionMin: mins,
              esfuerzo: esf,
              notas: texto(datos.notas).slice(0, 600),
              completada: true
            });

            api.cerrar();
            cerrarSesionEntrenamiento(socio, guardada || bitacora);
          }
        }
      ]
    });
  }

  /** Registra la asistencia si falta y muestra el resumen final. */
  function cerrarSesionEntrenamiento(socio, bitacora) {
    detenerTemporizador();
    estado.inicioSesion = null;

    /* Sin forzar: si la membresía no está vigente, el módulo de asistencia
       manda y el registro queda pendiente de autorización en recepción. */
    var registroAsistencia = false;
    if (!tieneAsistenciaHoy(socio.id)) {
      if (AG.Mod && AG.Mod.Asistencia && typeof AG.Mod.Asistencia.checkIn === 'function') {
        try {
          registroAsistencia = !!AG.Mod.Asistencia.checkIn(socio.id, { silencioso: true });
        } catch (e) { registroAsistencia = false; }
      }
    }

    var volumen = Calc.volumenEntrenamiento(bitacora);
    var kcal = Calc.caloriasQuemadasAprox(bitacora, pesoActual(socio.id));
    var series = contarSeriesHechas(bitacora);
    var racha = Calc.rachaDias(AG.DB.asistenciasDe(socio.id));
    var esf = esfuerzoInfo(bitacora.esfuerzo);

    var felicitacion;
    if (racha >= 7) felicitacion = '¡' + racha + ' días seguidos! Estás en tu mejor momento, no sueltes la racha.';
    else if (racha >= 3) felicitacion = 'Llevas ' + racha + ' días seguidos entrenando. Así se construye el hábito.';
    else if (racha === 1) felicitacion = 'Arrancaste la racha de hoy. Mañana la seguimos.';
    else felicitacion = 'Sesión guardada. Cada entrenamiento cuenta.';

    var cuerpo = '<div class="stack-sm">' +
      '<div class="aviso aviso-ok">' + icono('trofeo', 18) +
        '<div><b>¡Entrenamiento terminado!</b><br>' + esc(felicitacion) + '</div></div>' +
      '<div class="sr-resumen">' +
        '<div><b>' + series + '</b><span>Series hechas</span></div>' +
        '<div><b>' + esc(U.num(volumen, 0)) + '</b><span>kg de volumen</span></div>' +
        '<div><b>' + esc(U.num(kcal, 0)) + '</b><span>kcal aprox.</span></div>' +
      '</div>' +
      '<div class="row-sm wrap center">' +
        '<span class="pill">' + icono('reloj', 13) + esc(U.num(bitacora.duracionMin, 0)) + ' min</span>' +
        '<span class="pill">' + icono('fuego', 13) + 'Esfuerzo ' + esc(U.num(bitacora.esfuerzo, 0)) + '/10 · ' + esc(esf.texto) + '</span>' +
        '<span class="pill">' + icono('rayo', 13) + 'Racha de <b>' + racha + '</b> ' + (racha === 1 ? 'día' : 'días') + '</span>' +
      '</div>' +
      (registroAsistencia
        ? '<p class="mini muted center">' + icono('qr', 12) + ' También registramos tu asistencia de hoy.</p>'
        : '') +
    '</div>';

    /* El repintado se dispara una sola vez, se cierre como se cierre el modal */
    var yaRefrescado = false;
    function refrescarUnaVez() {
      if (yaRefrescado) return;
      yaRefrescado = true;
      try { AG.Router.refrescar(); } catch (e) { /* la vista ya no está montada */ }
    }

    U.modal({
      titulo: '¡Buen trabajo!',
      ancho: 'md',
      cuerpo: cuerpo,
      acciones: [
        {
          texto: 'Ver mi historial',
          clase: 'btn-outline',
          onClick: function (api) {
            estado.tab = 'historial';
            api.cerrar();
          }
        },
        {
          texto: 'Listo',
          clase: 'btn-primary',
          onClick: function (api) { api.cerrar(); }
        }
      ],
      onCerrar: refrescarUnaVez
    });

    toast('Sesión guardada. ¡Bien hecho!', 'ok');
  }

  /* =============================================================
     11. Estado vacío: socio sin rutina
     ============================================================= */

  function panelSinRutina(socio) {
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    var wa = coach ? enlaceWhatsApp(coach.telefono) : '';

    var botones = '';
    if (coach && wa) {
      botones += '<a class="btn btn-primary" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' +
        icono('whatsapp', 16) + ' Escribirle a ' + esc(texto(coach.nombre) || 'mi coach') + '</a>';
    }
    botones += '<a class="btn btn-outline" href="#/socio/ejercicios">' +
      icono('mancuerna', 16) + ' Ver la biblioteca de ejercicios</a>';

    var mensaje = coach
      ? 'Tu coach es ' + U.nombreCompleto(coach) + '. Pídele que te arme tu plan y aquí aparecerá tu rutina día por día.'
      : 'Todavía no tienes coach asignado. Acércate a recepción para que te asignen uno y te preparen tu rutina.';

    var html = '<div class="card"><div class="card-body">' +
      vacioHTML('mancuerna', 'Aún no tienes una rutina asignada', mensaje, botones) +
    '</div></div>';

    if (coach) {
      html += '<div class="card mt">' +
        '<div class="card-head"><h3 class="card-title">' + icono('coach', 18) + '<span>Tu coach</span></h3></div>' +
        '<div class="card-body">' +
          '<div class="persona">' + U.avatar(coach, 'lg') +
            '<div class="persona-txt">' +
              '<b>' + esc(U.nombreCompleto(coach)) + '</b>' +
              '<span>' + esc(texto(coach.especialidad) || 'Entrenador certificado') + '</span>' +
            '</div>' +
          '</div>' +
          (texto(coach.telefono).trim()
            ? '<p class="mini muted mt-sm">' + icono('telefono', 12) + ' ' + esc(coach.telefono) + '</p>'
            : '') +
        '</div>' +
      '</div>';
    }

    html += '<div class="aviso aviso-info mt">' + icono('info', 18) +
      '<div>Mientras tanto puedes entrenar por tu cuenta con la biblioteca: ahí encontrarás la técnica de cada ejercicio explicada paso a paso.</div></div>';

    return html;
  }

  /* =============================================================
     12. Armado de la vista
     ============================================================= */

  function tabsHTML() {
    var tabs = [
      { id: 'hoy', etiqueta: 'Hoy', icono: 'mancuerna' },
      { id: 'semana', etiqueta: 'Semana', icono: 'calendario' },
      { id: 'historial', etiqueta: 'Historial', icono: 'historial' }
    ];
    var html = '<div class="tabs" role="tablist">';
    for (var i = 0; i < tabs.length; i++) {
      var activa = estado.tab === tabs[i].id;
      html += '<button type="button" class="tab' + (activa ? ' active' : '') + '" data-tab="' + tabs[i].id + '"' +
        ' role="tab" aria-selected="' + (activa ? 'true' : 'false') + '">' +
        icono(tabs[i].icono, 16) + '<span>' + esc(tabs[i].etiqueta) + '</span></button>';
    }
    return html + '</div>';
  }

  /** Contenido de la pestaña activa. */
  function panelHTML(socio, activa) {
    if (!activa) return panelSinRutina(socio);

    var rutina = activa.rutina;
    if (estado.tab === 'semana') return panelSemana(socio, rutina);
    if (estado.tab === 'historial') return panelHistorial(socio, rutina);
    return panelHoy(socio, rutina, activa.asignacion);
  }

  function render(ctx) {
    asegurarEstilos();
    engancharNavegacion();
    detenerTemporizador();

    var socio = ctx && ctx.usuario ? ctx.usuario : null;

    if (!socio || socio.rol !== 'socio') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('candado', 'Sección solo para socios',
          'Esta pantalla muestra la rutina personal de cada socio.') +
      '</div></div></div>';
    }

    var activa = AG.DB.rutinaActivaDe(socio.id);
    if (activa && (!activa.rutina || typeof activa.rutina !== 'object')) activa = null;

    if (!activa) {
      estado.tab = 'hoy';
      estado.diaIndex = null;
    }

    var subtitulo = activa
      ? 'Tu plan es «' + texto(activa.rutina.nombre) + '». Marca cada serie conforme la termines y el sistema lleva la cuenta por ti.'
      : 'Aquí verás tu plan de entrenamiento en cuanto tu coach te lo asigne.';

    var html = '<div class="page" data-socio-rutina>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('mancuerna', 24) + '<span>Mi rutina</span></h1>' +
          '<p class="page-sub">' + esc(subtitulo) + '</p>' +
        '</div>' +
      '</div>' +
      (activa ? tabsHTML() : '') +
      '<div class="mt" data-panel>' + panelHTML(socio, activa) + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root, socio); }
    };
  }

  /** Repinta solo el panel activo (conserva la cabecera y las pestañas). */
  function repintarPanel(raiz, socio) {
    detenerTemporizador();

    var activa = AG.DB.rutinaActivaDe(socio.id);
    if (activa && (!activa.rutina || typeof activa.rutina !== 'object')) activa = null;

    var panel = U.$('[data-panel]', raiz);
    if (panel) panel.innerHTML = panelHTML(socio, activa);

    var tabs = U.$$('[data-tab]', raiz);
    for (var i = 0; i < tabs.length; i++) {
      var activaTab = tabs[i].getAttribute('data-tab') === estado.tab;
      tabs[i].classList.toggle('active', activaTab);
      tabs[i].setAttribute('aria-selected', activaTab ? 'true' : 'false');
    }
  }

  /* =============================================================
     13. Delegación de eventos
     ============================================================= */

  /** Rutina y día que se están mostrando en la pestaña Hoy. */
  function contextoHoy(socio) {
    var activa = AG.DB.rutinaActivaDe(socio.id);
    if (!activa || !activa.rutina) return null;
    var indice = indiceVisible(activa.rutina, bitacoraDeHoy(socio.id, null));
    return { rutina: activa.rutina, diaIndex: indice };
  }

  function enganchar(root, socio) {
    var raiz = root && root.querySelector ? root.querySelector('[data-socio-rutina]') : null;
    if (!raiz) return;

    asegurarEstilos();

    /* ---------- Pestañas ---------- */
    U.delegar(raiz, 'click', '[data-tab]', function (e, el) {
      e.preventDefault();
      var destino = el.getAttribute('data-tab');
      if (!destino || destino === estado.tab) return;
      estado.tab = destino;
      repintarPanel(raiz, socio);
    });

    /* ---------- Cambiar el día de la rutina ---------- */
    U.delegar(raiz, 'change', '[data-dia-sel]', function (e, el) {
      var ctx = contextoHoy(socio);
      if (ctx) guardarCaptura(raiz, socio, ctx.rutina, ctx.diaIndex, false);
      estado.diaIndex = entero(el.value, 0);
      repintarPanel(raiz, socio);
    });

    /* ---------- Ir a entrenar un día desde la pestaña Semana ---------- */
    U.delegar(raiz, 'click', '[data-ir-dia]', function (e, el) {
      e.preventDefault();
      estado.diaIndex = entero(el.getAttribute('data-ir-dia'), 0);
      estado.tab = 'hoy';
      repintarPanel(raiz, socio);
    });

    /* ---------- Ficha técnica del ejercicio ---------- */
    U.delegar(raiz, 'click', '[data-detalle-ej]', function (e, el) {
      e.preventDefault();
      var id = el.getAttribute('data-detalle-ej');
      if (AG.Mod && AG.Mod.Ejercicios && typeof AG.Mod.Ejercicios.detalle === 'function') {
        try { AG.Mod.Ejercicios.detalle(id); return; } catch (err) { /* respaldo abajo */ }
      }
      var ej = ejercicioDe(id);
      if (!ej) { toast('No encontramos ese ejercicio en el catálogo.', 'warn'); return; }
      U.modal({
        titulo: ej.nombre,
        ancho: 'md',
        cuerpo: '<div class="stack-sm">' +
          (ej.musculos ? '<p class="mini muted">' + esc(ej.musculos) + '</p>' : '') +
          (ej.instrucciones ? '<div><span class="label">Cómo se hace</span><p>' + esc(ej.instrucciones) + '</p></div>' : '') +
          (ej.consejos ? '<div class="aviso aviso-warn">' + icono('alerta', 16) + '<div>' + esc(ej.consejos) + '</div></div>' : '') +
        '</div>',
        acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }]
      });
    });

    /* ---------- Marcar una serie como hecha ---------- */
    U.delegar(raiz, 'change', '[data-hecho]', function (e, el) {
      var ctx = contextoHoy(socio);
      if (!ctx) return;

      var fila = el.closest ? el.closest('[data-serie]') : null;
      var bloque = el.closest ? el.closest('[data-registro-ej]') : null;
      if (fila) fila.classList.toggle('on', !!el.checked);

      /* Si la serie se marca con campos vacíos se repite lo de la serie previa */
      if (el.checked && fila && bloque) {
        copiarDeSerieAnterior(bloque, fila, '[data-peso]');
        copiarDeSerieAnterior(bloque, fila, '[data-reps]');
      }

      if (el.checked && !estado.inicioSesion) estado.inicioSesion = Date.now();

      guardarCaptura(raiz, socio, ctx.rutina, ctx.diaIndex, el.checked);
      actualizarProgreso(raiz);

      if (el.checked) {
        var segundos = bloque ? entero(bloque.getAttribute('data-descanso'), 0) : 0;
        var nombre = bloque ? bloque.getAttribute('data-nombre') : '';
        iniciarDescanso(raiz, segundos, nombre);
      }
    });

    /* ---------- Guardar peso y repeticiones ---------- */
    var guardarConRetraso = U.debounce(function () {
      var ctx = contextoHoy(socio);
      if (!ctx) return;
      guardarCaptura(raiz, socio, ctx.rutina, ctx.diaIndex, false);
    }, 500);

    U.delegar(raiz, 'input', '[data-reps], [data-peso]', function () {
      guardarConRetraso();
    });

    U.delegar(raiz, 'change', '[data-reps], [data-peso]', function () {
      var ctx = contextoHoy(socio);
      if (!ctx) return;
      guardarCaptura(raiz, socio, ctx.rutina, ctx.diaIndex, false);
    });

    /* ---------- Temporizador de descanso ---------- */
    U.delegar(raiz, 'click', '[data-timer-saltar]', function (e) {
      e.preventDefault();
      detenerTemporizador();
    });

    U.delegar(raiz, 'click', '[data-timer-mas]', function (e) {
      e.preventDefault();
      if (!reloj.id) return;
      reloj.restante += 15;
      reloj.total = Math.max(reloj.total, reloj.restante);
      pintarTemporizador();
    });

    /* ---------- Terminar entrenamiento ---------- */
    U.delegar(raiz, 'click', '[data-terminar]', function (e) {
      e.preventDefault();
      var ctx = contextoHoy(socio);
      if (!ctx) { toast('No tienes una rutina activa para cerrar.', 'warn'); return; }
      terminarEntrenamiento(raiz, socio, ctx.rutina, ctx.diaIndex);
    });

    /* ---------- Detalle de una sesión del historial ---------- */
    U.delegar(raiz, 'click', '[data-sesion]', function (e, el) {
      e.preventDefault();
      detalleSesion(socio, el.getAttribute('data-sesion'));
    });

    /* ---------- Ordenar la tabla de récords ---------- */
    U.delegar(raiz, 'click', '[data-orden]', function (e, el) {
      e.preventDefault();
      var campo = el.getAttribute('data-orden');
      if (!campo) return;
      if (estado.orden.campo === campo) {
        estado.orden.dir = estado.orden.dir === 'asc' ? 'desc' : 'asc';
      } else {
        estado.orden.campo = campo;
        estado.orden.dir = (campo === 'nombre') ? 'asc' : 'desc';
      }
      var caja = U.$('[data-records]', raiz);
      if (caja) caja.innerHTML = tablaRecordsHTML(calcularRecords(bitacorasDe(socio.id)));
    });

    /* Estado inicial de la barra de progreso */
    if (estado.tab === 'hoy') actualizarProgreso(raiz);
  }

  /* =============================================================
     14. Limpieza al cambiar de vista
     ============================================================= */

  function engancharNavegacion() {
    if (navegacionEnganchada) return;
    navegacionEnganchada = true;
    if (!AG.Router || typeof AG.Router.on !== 'function') return;

    AG.Router.on('navego', function (info) {
      if (info && info.path === 'socio/rutina') return;
      /* Al salir de la vista se apaga el temporizador y se olvida la selección */
      detenerTemporizador();
      estado.diaIndex = null;
      estado.tab = 'hoy';
      estado.inicioSesion = null;
    });
  }

  /* =============================================================
     15. API pública y registro de la ruta
     ============================================================= */

  AG.Views.SocioRutina = {
    render: render,
    diaDeHoy: diaDeHoy,
    detenerTemporizador: detenerTemporizador
  };

  AG.Router.registrar({
    path: 'socio/rutina',
    roles: ['socio'],
    titulo: 'Mi rutina',
    nav: { etiqueta: 'Mi rutina', icono: 'mancuerna', grupo: 'Mi entrenamiento', orden: 1 },
    render: render
  });

})(window.AG);
