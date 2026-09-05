/* =============================================================
   ALLIANCE GYM — AG.Views.SocioProgreso
   -------------------------------------------------------------
   Ruta: 'socio/progreso'  (solo rol 'socio')

   Aquí el socio ve el resultado de SU mes: la medición de inicio,
   la de cierre y el cálculo automático que arma el sistema.

   Todo lo pesado se reutiliza de los módulos ya escritos:
     AG.Mod.Mediciones.comparativo(socioId, periodo, opts)
     AG.Mod.Mediciones.historial(socioId)
     AG.Mod.Mediciones.engancharAcciones(raiz)
     AG.Calc.compararMediciones / adherencia / rm1 / tablaRM /
     AG.Calc.pesoIdeal / aguaDiaria / masaMagra / masaGrasa /
     AG.Calc.progresoObjetivo / volumenEntrenamiento ...

   Reglas: JavaScript clásico, sin módulos ni dependencias de red,
   todo el texto de la base escapado con AG.Utils.esc(), nada de
   alert/confirm/prompt, nada de localStorage directo y ningún
   estado sin su vacío en español.
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

  /* Los 10 perímetros del contrato, en el orden en que se toman. */
  var MEDIDAS = [
    { clave: 'cuello', etiqueta: 'Cuello' },
    { clave: 'hombros', etiqueta: 'Hombros' },
    { clave: 'pecho', etiqueta: 'Pecho' },
    { clave: 'brazoDer', etiqueta: 'Brazo derecho' },
    { clave: 'brazoIzq', etiqueta: 'Brazo izquierdo' },
    { clave: 'cintura', etiqueta: 'Cintura' },
    { clave: 'cadera', etiqueta: 'Cadera' },
    { clave: 'musloDer', etiqueta: 'Muslo derecho' },
    { clave: 'musloIzq', etiqueta: 'Muslo izquierdo' },
    { clave: 'pantorrilla', etiqueta: 'Pantorrilla' }
  ];

  var FUERZA = [
    { clave: 'pressBanca', etiqueta: 'Press de banca', icono: 'pesa' },
    { clave: 'sentadilla', etiqueta: 'Sentadilla', icono: 'mancuerna' },
    { clave: 'pesoMuerto', etiqueta: 'Peso muerto', icono: 'pesa' }
  ];

  /* Colores para las gráficas (formato aceptado por AG.Charts). */
  var COLOR = {
    ok: 'var(--ok,#22C55E)',
    rojo: 'var(--rojo,#E4322B)',
    warn: 'var(--warn,#F59E0B)',
    info: 'var(--info,#3B82F6)'
  };

  /* Días de un mes promedio: sirve para pasar de días a meses. */
  var DIAS_POR_MES = 30.44;

  /* Estado vivo de la pantalla (sobrevive a los repintados del router). */
  var estado = {
    socioId: '',
    periodo: '',
    rm: ''
  };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  /* Número finito o null (nunca NaN, nunca cadena vacía). */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  /* Número estrictamente positivo o null. */
  function nPos(v) {
    var x = n0(v);
    return (x !== null && x > 0) ? x : null;
  }

  /* Lee 'medidas.cintura' de un objeto sin reventar. */
  function porRuta(obj, ruta) {
    if (!obj || !ruta) return null;
    var partes = String(ruta).split('.');
    var actual = obj;
    for (var i = 0; i < partes.length; i++) {
      if (actual === null || actual === undefined) return null;
      actual = actual[partes[i]];
    }
    return n0(actual);
  }

  function acotarPct(v) {
    var n = n0(v);
    if (n === null) return 0;
    return Math.max(0, Math.min(100, n));
  }

  /* Número plano para atributos style (siempre con punto decimal). */
  function css(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return String(Math.round(v * 100) / 100);
  }

  /* 'YYYY-MM' desplazado n meses. */
  function moverMes(periodo, n) {
    var base = (periodo || U.mesActual()) + '-01';
    return U.mesDe(U.sumaMeses(base, n));
  }

  function esMes(valor) {
    return typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor);
  }

  function modMediciones() {
    return (AG.Mod && AG.Mod.Mediciones) ? AG.Mod.Mediciones : null;
  }

  function etiquetaObjetivo(objetivo) {
    return (Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[objetivo]) || 'Sin objetivo definido';
  }

  function esMujer(sexo) {
    return String(sexo || '').toUpperCase().charAt(0) === 'M';
  }

  /* Solo las mediciones que el coach marcó visibles para el socio. */
  function medicionesVisibles(socioId) {
    var lista = AG.DB.medicionesDe(socioId) || [];
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].visibleParaSocio !== false) salida.push(lista[i]);
    }
    return salida;
  }

  /* Medición del mes respetando la visibilidad para el socio. */
  function medicionVisible(socioId, periodo, tipo) {
    var m = AG.DB.medicionDelMes(socioId, periodo, tipo);
    return (m && m.visibleParaSocio !== false) ? m : null;
  }

  /* Teléfono listo para wa.me (agrega lada 52 a los números de 10 dígitos). */
  function telefonoWA(persona) {
    var d = String((persona && persona.telefono) || '').replace(/\D/g, '');
    if (d.length < 10) return '';
    if (d.length === 10) d = '52' + d;
    if (d.length > 15) return '';
    return d;
  }

  function enlaceWA(persona, mensaje) {
    var d = telefonoWA(persona);
    if (!d) return '';
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(mensaje || '');
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-progreso';

  /*
     El socio nunca entra a 'coach/mediciones', así que la hoja de
     estilos del módulo de mediciones (.med-*) puede no haberse
     inyectado todavía. Si falta, se agrega aquí una copia mínima
     para que el comparativo reutilizado se vea igual de bien.
  */
  function cssRespaldoMediciones() {
    if (document.getElementById('ag-estilo-mediciones')) return '';
    return '.med-metricas{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}' +
      '.med-metrica{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:12px;text-align:center;min-width:0}' +
      '.med-metrica .med-flujo{font-size:15px;font-weight:800;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.med-delta{display:inline-flex;align-items:center;gap:4px;font-weight:800;' +
        'font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.med-delta svg{width:14px;height:14px}' +
      '@media (max-width:700px){.med-metricas{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '@media (max-width:380px){.med-metricas{grid-template-columns:1fr}}';
  }

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Selector de mes */
      '.prg-mes{flex:1 1 auto;min-width:0;text-align:center;font-size:17px;font-weight:800;' +
        'letter-spacing:-.02em;color:var(--texto);font-variant-numeric:tabular-nums}' +
      /* Rejilla de las 10 medidas */
      '.prg-medidas{display:grid;gap:10px;grid-template-columns:repeat(5,minmax(0,1fr))}' +
      '.prg-medida{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:10px;min-width:0;display:flex;flex-direction:column;gap:2px}' +
      '.prg-med-val{font-size:16px;font-weight:800;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.prg-delta{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:800;' +
        'font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.prg-delta svg{width:13px;height:13px;flex:0 0 auto}' +
      /* Barra de rango saludable del IMC */
      '.prg-rango{position:relative;padding:12px 0 4px}' +
      '.prg-rango-barra{display:flex;height:12px;border-radius:999px;overflow:hidden;' +
        'border:1px solid var(--borde)}' +
      '.prg-rango-seg{height:100%}' +
      '.prg-rango-marca{position:absolute;top:5px;width:4px;height:26px;border-radius:3px;' +
        'background:var(--texto);box-shadow:0 0 0 2px var(--panel);margin-left:-2px}' +
      '.prg-rango-esc{display:flex;gap:2px;margin-top:14px;font-size:10px;color:var(--texto-3);' +
        'font-variant-numeric:tabular-nums;text-align:center}' +
      '.prg-rango-esc span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      /* Récords de fuerza */
      '.prg-rm{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}' +
      '.prg-marca{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:12px;min-width:0;width:100%;text-align:left;' +
        'font:inherit;color:inherit;display:flex;flex-direction:column;gap:6px;' +
        'transition:border-color var(--trans),box-shadow var(--trans)}' +
      'button.prg-marca{cursor:pointer;-webkit-appearance:none;appearance:none}' +
      'button.prg-marca:hover{border-color:var(--borde-2)}' +
      '.prg-marca .grafica{display:block;width:100%}' +
      '.prg-marca-val{font-size:22px;font-weight:800;letter-spacing:-.03em;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;line-height:1.1}' +
      '.prg-marca.on{border-color:var(--rojo);box-shadow:inset 0 0 0 1px var(--rojo)}' +
      /* Bloques del reporte impreso */
      '.prg-imp-tit{font-size:14px;font-weight:800;margin:14px 0 6px;color:var(--texto)}' +
      /* Adaptaciones a pantalla chica */
      '@media (max-width:900px){.prg-medidas{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
      '@media (max-width:700px){.prg-medidas{grid-template-columns:repeat(2,minmax(0,1fr))}' +
        '.prg-rm{grid-template-columns:1fr}.prg-mes{font-size:15px}}' +
      '@media (max-width:380px){.prg-medidas{grid-template-columns:1fr}}' +
      cssRespaldoMediciones();
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Piezas de interfaz reutilizables
     ============================================================= */

  function vacioHTML(mensaje, iconoNombre, extraHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre || 'grafica', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (extraHTML || '') +
    '</div>';
  }

  function kpiHTML(iconoNombre, valor, etiqueta, variante) {
    return '<div class="kpi' + (variante ? ' ' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(iconoNombre, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
      '</div>' +
    '</div>';
  }

  function datoHTML(etiqueta, valor, detalle) {
    return '<div class="dato">' +
      '<span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<span class="dato-val">' + esc(valor) + '</span>' +
      (detalle ? '<span class="mini muted">' + esc(detalle) + '</span>' : '') +
    '</div>';
  }

  function barraHTML(etiqueta, valorTexto, pct, clase) {
    return '<div>' +
      '<div class="bar-etiqueta"><span>' + esc(etiqueta) + '</span><b>' + esc(valorTexto) + '</b></div>' +
      '<div class="bar"><span class="bar-fill' + (clase ? ' ' + clase : '') +
        '" style="width:' + acotarPct(pct) + '%"></span></div>' +
    '</div>';
  }

  function claseBarra(pct) {
    var n = acotarPct(pct);
    if (n >= 80) return 'ok';
    if (n >= 50) return 'warn';
    return 'error';
  }

  function claseTendencia(tendencia) {
    if (tendencia === 'mejor') return 'txt-ok';
    if (tendencia === 'peor') return 'txt-error';
    return 'muted';
  }

  /* Cambio con flecha y color según la tendencia que calculó AG.Calc. */
  function deltaHTML(delta, dec, unidad, tendencia) {
    if (delta === null || delta === undefined) {
      return '<span class="prg-delta muted">Sin comparar</span>';
    }
    var nombre = delta > 0 ? 'flecha-arriba' : (delta < 0 ? 'flecha-abajo' : 'flecha-der');
    return '<span class="prg-delta ' + claseTendencia(tendencia) + '">' +
      icono(nombre, 13) + esc(U.signo(delta, dec, unidad)) + '</span>';
  }

  function tarjetaHTML(titulo, iconoNombre, cuerpo, accionHTML, badgeHTML) {
    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono(iconoNombre, 18) + '<span>' + esc(titulo) + '</span></div>' +
        (badgeHTML || '') +
        (accionHTML ? '<div class="card-accion no-imprimir">' + accionHTML + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  /* =============================================================
     4. Coach del socio y contacto por WhatsApp
     ============================================================= */

  function coachDe(socio) {
    if (!socio || !socio.coachId) return null;
    var c = AG.DB.usuario(socio.coachId);
    return (c && c.rol === 'coach') ? c : null;
  }

  function botonCoachHTML(socio, mensaje, clase) {
    var coach = coachDe(socio);
    if (!coach) {
      return '<p class="mini muted">Todavía no tienes un coach asignado. Pregunta en recepción para que te asignen uno ' +
        'y puedan cerrar tu mes.</p>';
    }
    var url = enlaceWA(coach, mensaje);
    if (!url) {
      return '<p class="mini muted">Tu coach es ' + esc(U.nombreCompleto(coach)) +
        ', pero no tiene un teléfono registrado. Búscalo en el gimnasio para agendar tu medición.</p>';
    }
    return '<a class="btn ' + esc(clase || 'btn-primary') + ' btn-sm no-imprimir" href="' + esc(url) +
      '" target="_blank" rel="noopener noreferrer">' + icono('whatsapp', 15) +
      ' Escribir a ' + esc(coach.nombre || U.nombreCompleto(coach)) + '</a>';
  }

  /* =============================================================
     5. Selector de mes
     ============================================================= */

  /* Mes más antiguo al que tiene sentido navegar. */
  function mesMinimo(socio, mediciones) {
    var candidatos = [];
    if (mediciones && mediciones.length) {
      var p = mediciones[0].periodo;
      candidatos.push(esMes(p) ? p : U.mesDe(mediciones[0].fecha));
    }
    if (socio && socio.fechaAlta) candidatos.push(U.mesDe(socio.fechaAlta));
    var min = '';
    for (var i = 0; i < candidatos.length; i++) {
      if (esMes(candidatos[i]) && (!min || candidatos[i] < min)) min = candidatos[i];
    }
    return min || U.mesActual();
  }

  function estadoDelMes(socio, periodo) {
    var ini = medicionVisible(socio.id, periodo, 'inicial');
    var fin = medicionVisible(socio.id, periodo, 'final');
    if (ini && fin) return { clave: 'cerrado', texto: 'Mes cerrado', clase: 'badge-ok', ini: ini, fin: fin };
    if (ini) return { clave: 'encurso', texto: 'En curso', clase: 'badge-warn', ini: ini, fin: null };
    return { clave: 'vacio', texto: 'Sin mediciones', clase: 'badge-muted', ini: null, fin: null };
  }

  function selectorMesHTML(socio, periodo, mediciones) {
    var min = mesMinimo(socio, mediciones);
    var esteMes = U.mesActual();
    var est = estadoDelMes(socio, periodo);

    return '<div class="card">' +
      '<div class="card-body">' +
        '<div class="row-sm between wrap">' +
          '<div class="row-sm flex1" style="min-width:0">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-mes="-1" title="Mes anterior" ' +
              'aria-label="Mes anterior"' + (periodo <= min ? ' disabled' : '') + '>&lsaquo;</button>' +
            '<span class="prg-mes">' + esc(U.nombreMes(periodo)) + '</span>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-mes="1" title="Mes siguiente" ' +
              'aria-label="Mes siguiente"' + (periodo >= esteMes ? ' disabled' : '') + '>&rsaquo;</button>' +
          '</div>' +
          '<div class="row-sm wrap">' +
            '<span class="badge ' + esc(est.clase) + '">' + esc(est.texto) + '</span>' +
            '<button type="button" class="btn btn-outline btn-sm" data-mes-actual' +
              (periodo === esteMes ? ' disabled' : '') + '>Mes actual</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* =============================================================
     6. Cómo lo lograste — el esfuerzo real detrás del resultado
     ============================================================= */

  /* Bitácoras, asistencias, volumen y adherencia dentro de un rango. */
  function esfuerzoDelPeriodo(socio, desde, hasta) {
    var todas = AG.DB.bitacorasDe(socio.id) || [];
    var enRango = [];
    var i, f;

    for (i = 0; i < todas.length; i++) {
      f = String((todas[i] && todas[i].fecha) || '').slice(0, 10);
      if (f && f >= desde && f <= hasta) enRango.push(todas[i]);
    }

    var completadas = [];
    for (i = 0; i < enRango.length; i++) {
      if (enRango[i].completada !== false) completadas.push(enRango[i]);
    }

    var asistencias = [];
    var todasAsis = AG.DB.asistenciasDe(socio.id) || [];
    for (i = 0; i < todasAsis.length; i++) {
      f = String((todasAsis[i] && todasAsis[i].fecha) || '').slice(0, 10);
      if (f && f >= desde && f <= hasta) asistencias.push(todasAsis[i]);
    }

    var activa = AG.DB.rutinaActivaDe(socio.id);
    var diasPorSemana = (activa && activa.rutina && nPos(activa.rutina.diasPorSemana)) || 3;

    var volumen = 0, minutos = 0, kcal = 0, esfuerzos = 0, sumaEsfuerzo = 0;
    var pesoRef = null;
    var visibles = medicionesVisibles(socio.id);
    if (visibles.length) pesoRef = nPos(visibles[visibles.length - 1].pesoKg);

    for (i = 0; i < completadas.length; i++) {
      volumen += Calc.volumenEntrenamiento(completadas[i]) || 0;
      var min = nPos(completadas[i].duracionMin);
      if (min !== null) minutos += min;
      kcal += Calc.caloriasQuemadasAprox(completadas[i], pesoRef) || 0;
      var esf = n0(completadas[i].esfuerzo);
      if (esf !== null) { sumaEsfuerzo += esf; esfuerzos++; }
    }

    return {
      adherencia: Calc.adherencia(enRango, desde, hasta, diasPorSemana),
      diasPorSemana: diasPorSemana,
      sesiones: completadas.length,
      registradas: enRango.length,
      asistencias: asistencias,
      volumen: Math.round(volumen),
      minutos: Math.round(minutos),
      kcal: Math.round(kcal),
      esfuerzo: esfuerzos ? (sumaEsfuerzo / esfuerzos) : null
    };
  }

  function textoVolumen(kg) {
    if (!kg) return 'Sin volumen registrado';
    if (kg < 1000) return U.num(kg, 0) + ' kg movidos en total';
    return 'Equivale a ' + U.num(kg / 1000, 1) + ' toneladas levantadas';
  }

  function comoLoLograsteHTML(socio, periodo, ini, fin, paraImprimir) {
    var desde = String(ini.fecha || '').slice(0, 10);
    var hasta = String(fin.fecha || '').slice(0, 10);
    if (!desde || !hasta || desde > hasta) {
      return tarjetaHTML('Cómo lo lograste', 'fuego',
        vacioHTML('No pudimos calcular tu esfuerzo del periodo: las fechas de las mediciones no son consistentes.', 'alerta'));
    }

    var e = esfuerzoDelPeriodo(socio, desde, hasta);
    var adh = e.adherencia;

    var cuerpo = '<div class="grid g4">' +
      kpiHTML('meta', U.pct(adh.pct, 0), 'Adherencia real',
        adh.pct >= 80 ? 'kpi-ok' : (adh.pct >= 50 ? 'kpi-warn' : 'kpi-error')) +
      kpiHTML('calendario', String(e.asistencias.length), 'Visitas al gimnasio', 'kpi-info') +
      kpiHTML('check', String(e.sesiones), 'Sesiones completadas', 'kpi-ok') +
      kpiHTML('pesa', U.num(e.volumen, 0) + ' kg', 'Volumen total', '') +
    '</div>';

    cuerpo += '<div class="mt">' +
      barraHTML('Sesiones hechas contra las esperadas',
        e.sesiones + ' de ' + adh.esperadas, adh.pct, claseBarra(adh.pct)) +
    '</div>';

    cuerpo += '<div class="datos-grid mt">' +
      datoHTML('Plan de la rutina', e.diasPorSemana + (e.diasPorSemana === 1 ? ' día por semana' : ' días por semana'),
        'Sobre eso se calcula tu adherencia') +
      datoHTML('Tiempo entrenado', e.minutos ? U.num(e.minutos, 0) + ' min' : 'Sin registro',
        e.minutos ? 'Cerca de ' + U.num(e.minutos / 60, 1) + ' horas de trabajo' : 'Registra la duración en tu bitácora') +
      datoHTML('Energía estimada', e.kcal ? U.num(e.kcal, 0) + ' kcal' : 'Sin registro',
        'Aproximado según duración y esfuerzo') +
      datoHTML('Esfuerzo promedio', e.esfuerzo !== null ? U.num(e.esfuerzo, 1) + ' / 10' : 'Sin registro',
        textoVolumen(e.volumen)) +
    '</div>';

    /* Mapa de calor de tus visitas del mes */
    if (!paraImprimir) {
      var dias = [];
      for (var i = 0; i < e.asistencias.length; i++) {
        dias.push({ fecha: String(e.asistencias[i].fecha).slice(0, 10), valor: 1 });
      }
      cuerpo += '<div class="mt"><div class="card-title mb-sm">' + icono('calendario', 16) +
        '<span>Tus días en el gimnasio</span></div>' +
        '<div class="grafica">' +
          Charts.calendario(dias, {
            periodo: periodo,
            color: COLOR.rojo,
            etiquetaValor: 'visita',
            vacio: 'No registraste asistencias en ' + U.nombreMes(periodo) + '.'
          }) +
        '</div></div>';
    }

    /* Lectura honesta de la adherencia */
    var frase;
    if (adh.pct >= 90) {
      frase = 'Casi no fallaste una sola sesión. Este resultado no fue suerte: fue constancia.';
    } else if (adh.pct >= 80) {
      frase = 'Entrenaste con muy buena constancia. Con esta adherencia los números se mueven solos.';
    } else if (adh.pct >= 50) {
      frase = 'Cumpliste poco más de la mitad del plan. Subir tu adherencia arriba del 80 % es el cambio que ' +
        'más rápido movería tus resultados.';
    } else if (e.sesiones > 0) {
      frase = 'Entrenaste pocas veces en el periodo. Antes de cambiar el plan hay que ejecutarlo: ' +
        'lo que no se hace no se puede evaluar.';
    } else {
      frase = 'No hay entrenamientos registrados en este periodo. Registrar tu bitácora es el primer paso ' +
        'para entender qué funciona y qué no.';
    }
    cuerpo += '<div class="aviso ' + (adh.pct >= 80 ? 'aviso-ok' : (adh.pct >= 50 ? 'aviso-warn' : 'aviso-info')) +
      ' mt">' + icono('info', 18) + '<span>' + esc(frase) + '</span></div>';

    return tarjetaHTML('Cómo lo lograste', 'fuego', cuerpo, '',
      '<span class="badge ' + esc(adh.clase) + '">' + esc(U.pct(adh.pct, 0)) + ' de adherencia</span>');
  }

  /* =============================================================
     7. Bloque principal del mes
     ============================================================= */

  /* Resumen corto de una medición suelta (la inicial cuando falta el cierre). */
  function resumenMedicionHTML(medicion) {
    var imc = n0(medicion.imc);
    if (imc === null) imc = Calc.imc(medicion.pesoKg, medicion.estaturaCm);
    var cintura = medicion.medidas ? n0(medicion.medidas.cintura) : null;

    return '<div class="datos-grid">' +
      datoHTML('Fecha de la medición', U.fecha(medicion.fecha, 'corto'), U.fechaRelativa(medicion.fecha)) +
      datoHTML('Peso', n0(medicion.pesoKg) !== null ? U.num(medicion.pesoKg, 1) + ' kg' : 'Sin dato', '') +
      datoHTML('Grasa corporal', n0(medicion.grasaPct) !== null ? U.num(medicion.grasaPct, 1) + ' %' : 'Sin dato', '') +
      datoHTML('Masa muscular', n0(medicion.musculoKg) !== null ? U.num(medicion.musculoKg, 1) + ' kg' : 'Sin dato', '') +
      datoHTML('Cintura', cintura !== null ? U.num(cintura, 1) + ' cm' : 'Sin dato', '') +
      datoHTML('IMC', imc !== null ? U.num(imc, 1) : 'Sin dato',
        imc !== null ? Calc.clasificacionIMC(imc).texto : '') +
    '</div>';
  }

  /* Tarjeta para cuando ya hay inicial pero todavía no hay cierre. */
  function pendienteDeCierreHTML(socio, periodo, ini) {
    var esteMes = periodo >= U.mesActual();
    var titulo = esteMes ? 'Tu coach cerrará tu mes' : 'Tu coach aún no cierra este mes';
    var mes = U.nombreMes(periodo);

    var sub = esteMes
      ? 'Ya tienes tu medición de inicio de ' + mes + '. Al terminar el mes tu coach toma la medición de cierre ' +
        'y el comparativo se arma solo.'
      : 'Quedó registrada tu medición de inicio de ' + mes + ', pero nunca se capturó la de cierre, ' +
        'así que ese mes no se puede comparar.';

    var mensaje = 'Hola, soy ' + U.nombreCompleto(socio) + '. ' +
      (esteMes
        ? '¿Cuándo podemos agendar mi medición de cierre de ' + mes + '?'
        : 'Me quedó abierto el mes de ' + mes + '. ¿Podemos revisarlo?');

    var cuerpo = '<p class="muted mb">' + esc(sub) + '</p>' +
      '<div class="card-title mb-sm">' + icono('regla', 16) + '<span>Tu medición de inicio</span></div>' +
      resumenMedicionHTML(ini) +
      '<div class="row-sm wrap mt">' + botonCoachHTML(socio, mensaje, 'btn-primary') + '</div>';

    return '<div class="card card-rojo">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('reloj', 18) + '<span>' + esc(titulo) + '</span></div>' +
        '<span class="badge badge-warn">En curso</span>' +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  /* Estado vacío motivador: no hay ninguna medición de ese mes. */
  function sinMedicionesDelMesHTML(socio, periodo, tieneHistorial) {
    var mes = U.nombreMes(periodo);
    var mensaje = tieneHistorial
      ? 'No hay mediciones registradas en ' + mes + '. Usa las flechas para revisar otro mes, o agenda tu medición ' +
        'para que este mes también cuente tu historia.'
      : 'Todavía no tienes mediciones. Aquí es donde tu esfuerzo se vuelve números: pídele a tu coach tu medición ' +
        'de inicio y en 30 días verás, con datos, todo lo que cambió.';

    var mensajeWA = 'Hola, soy ' + U.nombreCompleto(socio) + '. Quiero agendar mi medición de ' + mes + '.';

    return '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icono('cinta', 18) +
        '<span>Cierre de ' + esc(mes) + '</span></div></div>' +
      '<div class="card-body">' +
        vacioHTML(mensaje, 'meta', '<div class="row-sm wrap center mt">' +
          botonCoachHTML(socio, mensajeWA, 'btn-primary') + '</div>') +
      '</div>' +
    '</div>';
  }

  /* Zona que depende del mes elegido: comparativo + cómo lo lograste. */
  function zonaMesHTML(socio, periodo, mediciones, paraImprimir) {
    var html = paraImprimir ? '' : selectorMesHTML(socio, periodo, mediciones);
    var est = estadoDelMes(socio, periodo);

    if (est.clave === 'cerrado') {
      var mod = modMediciones();
      if (mod && typeof mod.comparativo === 'function') {
        html += mod.comparativo(socio.id, periodo, { acciones: false, usuario: socio });
      } else {
        html += '<div class="card"><div class="card-body">' +
          vacioHTML('El comparativo del mes no está disponible en este momento.', 'alerta') +
          '</div></div>';
      }
      html += comoLoLograsteHTML(socio, periodo, est.ini, est.fin, paraImprimir);
      return html;
    }

    if (est.clave === 'encurso') {
      html += pendienteDeCierreHTML(socio, periodo, est.ini);
      return html;
    }

    html += sinMedicionesDelMesHTML(socio, periodo, mediciones.length > 0);
    return html;
  }

  /* =============================================================
     8. Mi cuerpo hoy
     ============================================================= */

  /* Busca un campo del comparativo por su clave. */
  function campoDe(cmp, clave) {
    if (!cmp || !cmp.campos) return null;
    for (var i = 0; i < cmp.campos.length; i++) {
      if (cmp.campos[i].clave === clave) return cmp.campos[i];
    }
    return null;
  }

  function medidasHTML(ultima, cmp) {
    var html = '<div class="prg-medidas">';
    var hay = false;

    for (var i = 0; i < MEDIDAS.length; i++) {
      var m = MEDIDAS[i];
      var valor = porRuta(ultima, 'medidas.' + m.clave);
      var campo = campoDe(cmp, m.clave);
      var cambio;

      if (valor !== null) hay = true;

      if (campo && campo.delta !== null && campo.delta !== undefined) {
        cambio = deltaHTML(campo.delta, 1, 'cm', campo.tendencia);
      } else {
        cambio = '<span class="prg-delta muted">Sin comparar</span>';
      }

      html += '<div class="prg-medida">' +
        '<span class="dato-label">' + esc(m.etiqueta) + '</span>' +
        '<span class="prg-med-val">' + esc(valor !== null ? U.num(valor, 1) + ' cm' : '—') + '</span>' +
        cambio +
      '</div>';
    }

    html += '</div>';
    if (!hay) {
      return vacioHTML('En tu última medición no se capturaron los perímetros corporales. ' +
        'Pídele a tu coach que los tome: son los que más rápido muestran el cambio.', 'cinta');
    }
    return html;
  }

  /* Barra con el rango saludable del IMC y tu posición dentro de él. */
  function rangoIMCHTML(imc) {
    /* La escala va de 15 a 40 para que se lean bien todos los tramos. */
    var min = 15, max = 40;
    var pos = acotarPct((imc - min) / (max - min) * 100);
    var segmentos = [
      { hasta: 18.5, color: 'var(--info)', titulo: 'Bajo peso', escala: '< 18.5' },
      { hasta: 25, color: 'var(--ok)', titulo: 'Peso saludable', escala: '18.5 – 24.9' },
      { hasta: 30, color: 'var(--warn)', titulo: 'Sobrepeso', escala: '25 – 29.9' },
      { hasta: 40, color: 'var(--error)', titulo: 'Obesidad', escala: '30 o más' }
    ];

    var barra = '', escala = '';
    var desde = min;
    for (var i = 0; i < segmentos.length; i++) {
      var ancho = (segmentos[i].hasta - desde) / (max - min) * 100;
      barra += '<span class="prg-rango-seg" style="width:' + css(ancho) +
        '%;background:' + segmentos[i].color + '" title="' + esc(segmentos[i].titulo) + '"></span>';
      escala += '<span style="width:' + css(ancho) + '%" title="' + esc(segmentos[i].titulo) + '">' +
        esc(segmentos[i].escala) + '</span>';
      desde = segmentos[i].hasta;
    }

    return '<div class="prg-rango">' +
      '<div class="prg-rango-barra">' + barra + '</div>' +
      '<span class="prg-rango-marca" style="left:' + css(pos) + '%" ' +
        'title="Tu IMC: ' + esc(U.num(imc, 1)) + '"></span>' +
      '<div class="prg-rango-esc">' + escala + '</div>' +
    '</div>';
  }

  function composicionHTML(socio, ultima) {
    var peso = nPos(ultima.pesoKg);
    var grasaPct = n0(ultima.grasaPct);
    var magra = Calc.masaMagra(peso, grasaPct);
    var grasaKg = Calc.masaGrasa(peso, grasaPct);

    if (magra === null || grasaKg === null) {
      return '<div class="grafica">' +
        Charts.vacio('Falta el porcentaje de grasa de tu última medición para dibujar tu composición corporal.', 200) +
      '</div>';
    }

    var datos = [
      { etiqueta: 'Masa magra', valor: magra, color: COLOR.ok },
      { etiqueta: 'Masa grasa', valor: grasaKg, color: COLOR.rojo }
    ];

    return '<div class="grafica">' +
      Charts.dona(datos, {
        alto: 230,
        sufijo: ' kg',
        centroTitulo: 'Tu peso',
        centroValor: U.num(peso, 1) + ' kg'
      }) +
    '</div>' +
    '<div class="datos-grid mt">' +
      datoHTML('Masa magra', U.num(magra, 1) + ' kg', 'Músculo, huesos, órganos y agua') +
      datoHTML('Masa grasa', U.num(grasaKg, 1) + ' kg', U.num(grasaPct, 1) + ' % de tu peso') +
    '</div>';
  }

  function cuerpoHoyHTML(socio, mediciones, paraImprimir) {
    if (!mediciones.length) {
      return tarjetaHTML('Mi cuerpo hoy', 'balanza',
        vacioHTML('Todavía no tienes ninguna medición registrada. En cuanto tu coach te mida, aquí verás ' +
          'tu radiografía completa.', 'balanza'));
    }

    var ultima = mediciones[mediciones.length - 1];
    var anterior = mediciones.length >= 2 ? mediciones[mediciones.length - 2] : null;
    var cmp = anterior ? Calc.compararMediciones(anterior, ultima, socio.objetivo) : null;
    if (cmp && !cmp.ok) cmp = null;

    var peso = nPos(ultima.pesoKg);
    var estatura = nPos(ultima.estaturaCm) || nPos(socio.estaturaCm);
    var imc = n0(ultima.imc);
    if (imc === null) imc = Calc.imc(peso, estatura);
    var clas = Calc.clasificacionIMC(imc);
    var ideal = Calc.pesoIdeal(estatura, socio.sexo);
    var agua = Calc.aguaDiaria(peso, socio.nivelActividad);

    /* Encabezado: los cuatro números grandes */
    var campoPeso = campoDe(cmp, 'peso');
    var campoGrasa = campoDe(cmp, 'grasaPct');
    var campoMusculo = campoDe(cmp, 'musculoKg') || campoDe(cmp, 'masaMagra');
    var campoAgua = campoDe(cmp, 'aguaPct');

    var cuerpo = '<div class="grid g4">' +
      kpiHTML('balanza', peso !== null ? U.num(peso, 1) + ' kg' : '—', 'Peso actual', '') +
      kpiHTML('gota', n0(ultima.grasaPct) !== null ? U.num(ultima.grasaPct, 1) + ' %' : '—', 'Grasa corporal', 'kpi-warn') +
      kpiHTML('pesa', n0(ultima.musculoKg) !== null ? U.num(ultima.musculoKg, 1) + ' kg' : '—', 'Masa muscular', 'kpi-ok') +
      kpiHTML('agua', n0(ultima.aguaPct) !== null ? U.num(ultima.aguaPct, 1) + ' %' : '—', 'Agua corporal', 'kpi-info') +
    '</div>';

    cuerpo += '<div class="row-sm wrap mt">' +
      '<span class="pill">Medición del ' + esc(U.fecha(ultima.fecha, 'corto')) + '</span>' +
      '<span class="pill">' + esc(U.fechaRelativa(ultima.fecha)) + '</span>' +
      (anterior
        ? '<span class="pill pill-info">Comparado con el ' + esc(U.fecha(anterior.fecha, 'corto')) + '</span>'
        : '<span class="pill pill-warn">Es tu primera medición</span>') +
    '</div>';

    if (cmp) {
      cuerpo += '<div class="row wrap mt">' +
        '<span class="mini muted">Cambio contra tu medición anterior:</span>' +
        (campoPeso ? ' ' + deltaHTML(campoPeso.delta, 1, 'kg', campoPeso.tendencia) : '') +
        (campoGrasa ? ' ' + deltaHTML(campoGrasa.delta, 1, '% grasa', campoGrasa.tendencia) : '') +
        (campoMusculo ? ' ' + deltaHTML(campoMusculo.delta, 1, 'kg músculo', campoMusculo.tendencia) : '') +
        (campoAgua ? ' ' + deltaHTML(campoAgua.delta, 1, '% agua', campoAgua.tendencia) : '') +
      '</div>';
    }

    /* Las 10 medidas */
    cuerpo += '<div class="mt"><div class="card-title mb-sm">' + icono('cinta', 16) +
      '<span>Tus 10 medidas y su cambio</span></div>' + medidasHTML(ultima, cmp) + '</div>';

    /* IMC + composición */
    cuerpo += '<div class="grid g2 mt">';

    cuerpo += '<div class="caja">' +
      '<div class="card-title mb-sm">' + icono('calculadora', 16) + '<span>Tu IMC</span></div>' +
      (imc !== null
        ? '<div class="row-sm wrap"><span class="kpi-val">' + esc(U.num(imc, 1)) + '</span>' +
            '<span class="badge ' + esc(clas.clase) + '">' + esc(clas.texto) + '</span></div>' +
          rangoIMCHTML(imc) +
          '<p class="mini muted mt-sm">El rango saludable va de 18.5 a 24.9. El IMC es una referencia rápida: ' +
            'no distingue músculo de grasa, por eso siempre se lee junto con tu porcentaje de grasa.</p>'
        : '<p class="muted">Falta tu peso o tu estatura para calcular el IMC. Pídele a tu coach que los registre.</p>') +
    '</div>';

    cuerpo += '<div class="caja">' +
      '<div class="card-title mb-sm">' + icono('corazon', 16) + '<span>Masa magra contra grasa</span></div>' +
      composicionHTML(socio, ultima) +
    '</div>';

    cuerpo += '</div>';

    /* Peso ideal y agua diaria */
    cuerpo += '<div class="datos-grid mt">' +
      datoHTML('Tu rango de peso saludable',
        (ideal.min !== null && ideal.max !== null) ? U.num(ideal.min, 1) + ' – ' + U.num(ideal.max, 1) + ' kg' : 'Sin dato',
        (ideal.devine !== null) ? 'Referencia clínica: ' + U.num(ideal.devine, 1) + ' kg' : ideal.texto) +
      datoHTML('Agua que deberías tomar',
        agua !== null ? U.num(agua, 1) + ' L al día' : 'Sin dato',
        agua !== null ? 'Según tu peso y tu nivel de actividad' : 'Falta tu peso para calcularla') +
      datoHTML('Presión arterial', ultima.presion ? String(ultima.presion) : 'Sin registro', 'Última toma registrada') +
      datoHTML('Frecuencia cardiaca en reposo',
        n0(ultima.fcReposo) !== null ? U.num(ultima.fcReposo, 0) + ' lpm' : 'Sin registro',
        'Entre más baja, mejor tu condición') +
    '</div>';

    /* ¿Dentro o fuera del rango de peso? */
    if (peso !== null && ideal.min !== null && ideal.max !== null) {
      var aviso, tipo;
      if (peso < ideal.min) {
        aviso = 'Estás ' + U.num(ideal.min - peso, 1) + ' kg por debajo de tu rango saludable. ' +
          'Trabajar en ganar masa muscular te acerca al rango sin perder salud.';
        tipo = 'aviso-warn';
      } else if (peso > ideal.max) {
        aviso = 'Estás ' + U.num(peso - ideal.max, 1) + ' kg por arriba del rango de referencia. ' +
          'Recuerda que si ese peso es músculo, el número por sí solo no cuenta toda la historia.';
        tipo = 'aviso-warn';
      } else {
        aviso = 'Tu peso está dentro del rango saludable para tu estatura. Ahora el objetivo es la composición: ' +
          'más músculo y menos grasa con el mismo peso.';
        tipo = 'aviso-ok';
      }
      cuerpo += '<div class="aviso ' + tipo + ' mt">' + icono('info', 18) + '<span>' + esc(aviso) + '</span></div>';
    }

    var badge = '<span class="badge badge-info">' + esc(U.fecha(ultima.fecha, 'corto')) + '</span>';
    return tarjetaHTML('Mi cuerpo hoy', 'balanza', cuerpo, '', paraImprimir ? '' : badge);
  }

  /* =============================================================
     9. Mis récords de fuerza
     ============================================================= */

  /* Mejor marca histórica de cada levantamiento + su serie para la minigráfica. */
  function recordsDeFuerza(mediciones) {
    var salida = {};
    var i, j;

    for (j = 0; j < FUERZA.length; j++) {
      salida[FUERZA[j].clave] = { valor: null, fecha: '', serie: [], primero: null };
    }

    for (i = 0; i < mediciones.length; i++) {
      var f = mediciones[i].fuerza;
      if (!f || typeof f !== 'object') continue;
      for (j = 0; j < FUERZA.length; j++) {
        var clave = FUERZA[j].clave;
        var v = nPos(f[clave]);
        if (v === null) continue;
        var reg = salida[clave];
        reg.serie.push(v);
        if (reg.primero === null) reg.primero = v;
        if (reg.valor === null || v > reg.valor) {
          reg.valor = v;
          reg.fecha = mediciones[i].fecha || '';
        }
      }
    }
    return salida;
  }

  function mejorClave(records) {
    var mejor = '', mejorRM = null;
    for (var i = 0; i < FUERZA.length; i++) {
      var reg = records[FUERZA[i].clave];
      if (!reg || reg.valor === null) continue;
      var rm = Calc.rm1(reg.valor, 1);
      if (rm === null) continue;
      if (mejorRM === null || rm > mejorRM) { mejorRM = rm; mejor = FUERZA[i].clave; }
    }
    return mejor;
  }

  function tarjetaMarcaHTML(def, reg, seleccionada) {
    if (!reg || reg.valor === null) {
      return '<div class="prg-marca">' +
        '<span class="dato-label">' + esc(def.etiqueta) + '</span>' +
        '<span class="prg-marca-val muted">—</span>' +
        '<span class="mini muted">Todavía no se registra esta prueba en tus mediciones.</span>' +
      '</div>';
    }

    var rm = Calc.rm1(reg.valor, 1);
    var mejora = (reg.primero !== null && reg.primero > 0) ? (reg.valor - reg.primero) : null;

    return '<button type="button" class="prg-marca' + (seleccionada ? ' on' : '') +
      '" data-rm="' + esc(def.clave) + '" aria-pressed="' + (seleccionada ? 'true' : 'false') + '">' +
      '<span class="dato-label">' + esc(def.etiqueta) + '</span>' +
      '<span class="prg-marca-val">' + esc(U.num(rm, 1)) + ' <span class="mini muted">kg de 1RM</span></span>' +
      '<span class="mini muted">Mejor marca: ' + esc(U.num(reg.valor, 1)) + ' kg · ' +
        esc(reg.fecha ? U.fecha(reg.fecha, 'corto') : 'sin fecha') + '</span>' +
      (mejora !== null && Math.abs(mejora) >= 0.5
        ? '<span class="prg-delta ' + (mejora > 0 ? 'txt-ok' : 'txt-error') + '">' +
            icono(mejora > 0 ? 'flecha-arriba' : 'flecha-abajo', 13) +
            esc(U.signo(mejora, 1, 'kg')) + ' desde tu primera medición</span>'
        : '<span class="prg-delta muted">Sin cambio contra tu primera medición</span>') +
      (reg.serie.length >= 2
        ? '<span class="grafica">' + Charts.sparkline(reg.serie, { alto: 42, color: COLOR.rojo, sufijo: ' kg' }) + '</span>'
        : '') +
    '</button>';
  }

  function tablaRMHTML(clave, records) {
    var def = null, i;
    for (i = 0; i < FUERZA.length; i++) if (FUERZA[i].clave === clave) def = FUERZA[i];
    var reg = records[clave];

    if (!def || !reg || reg.valor === null) {
      return vacioHTML('Elige un levantamiento con marca registrada para ver su tabla de porcentajes.', 'trofeo');
    }

    var rm = Calc.rm1(reg.valor, 1);
    var tabla = Calc.tablaRM(rm);
    if (!tabla.length) {
      return vacioHTML('No pudimos calcular la tabla de porcentajes de este levantamiento.', 'trofeo');
    }

    var html = '<p class="mini muted mb-sm">Tabla de trabajo sobre tu 1RM de ' + esc(def.etiqueta.toLowerCase()) +
      ' (' + esc(U.num(rm, 1)) + ' kg). Úsala para saber con cuánto peso entrenar según las repeticiones que te pidan.</p>' +
      '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr><th>% del 1RM</th><th class="num">Peso</th><th class="num">Repeticiones</th><th>Para qué sirve</th></tr></thead><tbody>';

    var usos = {
      100: 'Prueba de fuerza máxima',
      95: 'Fuerza máxima',
      90: 'Fuerza',
      85: 'Fuerza e hipertrofia',
      80: 'Hipertrofia',
      75: 'Hipertrofia',
      70: 'Hipertrofia y resistencia',
      65: 'Resistencia muscular',
      60: 'Resistencia y técnica'
    };

    for (i = 0; i < tabla.length; i++) {
      var fila = tabla[i];
      html += '<tr>' +
        '<td class="bold">' + esc(U.pct(fila.pct, 0)) + '</td>' +
        '<td class="num">' + esc(U.num(fila.peso, 1)) + ' kg</td>' +
        '<td class="num">' + esc(String(fila.reps)) + '</td>' +
        '<td class="mini muted">' + esc(usos[fila.pct] || 'Trabajo general') + '</td>' +
      '</tr>';
    }

    return html + '</tbody></table></div>';
  }

  function recordsFuerzaHTML(socio, mediciones, paraImprimir) {
    var records = recordsDeFuerza(mediciones);
    var mejor = mejorClave(records);

    if (!mejor) {
      return tarjetaHTML('Mis récords de fuerza', 'trofeo',
        vacioHTML('Todavía no hay pruebas de fuerza en tus mediciones. Cuando tu coach registre tu press de banca, ' +
          'sentadilla o peso muerto, aquí aparecerán tus marcas y tu 1RM estimado.', 'trofeo'));
    }

    /* La selección viva sobrevive a los repintados; si ya no aplica, vuelve a la mejor. */
    if (!estado.rm || !records[estado.rm] || records[estado.rm].valor === null) estado.rm = mejor;
    var seleccionada = paraImprimir ? mejor : estado.rm;

    var cuerpo = '<div class="prg-rm">';
    for (var i = 0; i < FUERZA.length; i++) {
      cuerpo += tarjetaMarcaHTML(FUERZA[i], records[FUERZA[i].clave], FUERZA[i].clave === seleccionada);
    }
    cuerpo += '</div>';

    cuerpo += '<div class="mt" data-rm-tabla>' + tablaRMHTML(seleccionada, records) + '</div>';

    cuerpo += '<p class="mini muted mt-sm">El 1RM estimado se calcula con la fórmula de Epley sobre tu mejor marca ' +
      'registrada. Es una referencia para programar cargas, no una invitación a probarlo sin tu coach.</p>';

    return tarjetaHTML('Mis récords de fuerza', 'trofeo', cuerpo);
  }

  /* =============================================================
     10. Mi meta
     ============================================================= */

  /* Valor de la métrica que define la meta del socio en una medición. */
  function valorMeta(clave, medicion, socio) {
    if (clave === 'grasa') return n0(medicion.grasaPct);
    if (clave === 'peso') return nPos(medicion.pesoKg);
    if (clave === 'musculo') {
      var m = nPos(medicion.musculoKg);
      if (m !== null) return m;
      return Calc.masaMagra(medicion.pesoKg, medicion.grasaPct);
    }
    if (clave === 'fuerza') {
      var f = medicion.fuerza || {};
      var suma = 0, cuantos = 0;
      for (var i = 0; i < FUERZA.length; i++) {
        var v = nPos(f[FUERZA[i].clave]);
        if (v !== null) { suma += v; cuantos++; }
      }
      return cuantos ? suma : null;
    }
    if (clave === 'imc') {
      var imc = n0(medicion.imc);
      if (imc !== null) return imc;
      return Calc.imc(medicion.pesoKg, nPos(medicion.estaturaCm) || nPos(socio.estaturaCm));
    }
    return null;
  }

  /*
     Define la meta medible del socio según su objetivo y calcula
     el ritmo mensual y la proyección. Nunca inventa una fecha:
     si el ritmo va en contra o está detenido, lo dice tal cual.
  */
  function calcularMeta(socio, mediciones) {
    var base = {
      ok: false,
      motivo: 'Necesitamos al menos dos mediciones para calcular tu ritmo y tu proyección.'
    };
    if (!mediciones || mediciones.length < 2) return base;

    var primera = mediciones[0];
    var ultima = mediciones[mediciones.length - 1];
    var dias = U.diasEntre(primera.fecha, ultima.fecha);
    if (!(dias > 0)) {
      return { ok: false, motivo: 'Tus mediciones son del mismo día, así que todavía no hay un ritmo que medir.' };
    }
    var meses = dias / DIAS_POR_MES;

    var objetivo = String(socio.objetivo || 'salud');
    var clave = '', etiqueta = '', unidad = '', meta = null, subir = true, tolerancia = 0.5;

    if (objetivo === 'perder_grasa') {
      if (valorMeta('grasa', primera, socio) !== null && valorMeta('grasa', ultima, socio) !== null) {
        clave = 'grasa'; etiqueta = 'Grasa corporal'; unidad = '%'; subir = false; tolerancia = 0.5;
        meta = esMujer(socio.sexo) ? 24 : 15;
      } else {
        clave = 'peso'; etiqueta = 'Peso corporal'; unidad = 'kg'; subir = false; tolerancia = 1;
        var idealPG = Calc.pesoIdeal(nPos(ultima.estaturaCm) || nPos(socio.estaturaCm), socio.sexo);
        meta = idealPG.max;
      }
    } else if (objetivo === 'ganar_musculo') {
      clave = 'musculo'; etiqueta = 'Masa muscular'; unidad = 'kg'; subir = true; tolerancia = 0.3;
      var iniMus = valorMeta('musculo', primera, socio);
      meta = (iniMus !== null) ? iniMus + 3 : null;   /* meta de referencia: +3 kg */
    } else if (objetivo === 'rendimiento') {
      clave = 'fuerza'; etiqueta = 'Fuerza total (3 levantamientos)'; unidad = 'kg'; subir = true; tolerancia = 2.5;
      var iniF = valorMeta('fuerza', primera, socio);
      meta = (iniF !== null) ? iniF * 1.15 : null;    /* meta de referencia: +15 % */
    } else if (objetivo === 'mantener') {
      clave = 'peso'; etiqueta = 'Peso corporal'; unidad = 'kg'; subir = true; tolerancia = 1;
      meta = valorMeta('peso', primera, socio);
    } else {
      clave = 'imc'; etiqueta = 'IMC'; unidad = ''; tolerancia = 0.4;
      var imcAct = valorMeta('imc', ultima, socio);
      if (imcAct === null) meta = null;
      else if (imcAct >= 25) { meta = 24.9; subir = false; }
      else if (imcAct < 18.5) { meta = 18.5; subir = true; }
      else { meta = imcAct; subir = true; }
    }

    var desde = valorMeta(clave, primera, socio);
    var actual = valorMeta(clave, ultima, socio);

    if (desde === null || actual === null || meta === null) {
      return {
        ok: false,
        motivo: 'Faltan datos de ' + etiqueta.toLowerCase() + ' en tus mediciones para proyectar tu meta. ' +
          'Pídele a tu coach que los capture en cada cierre.'
      };
    }

    var ritmo = (actual - desde) / meses;           /* unidades por mes, con signo */
    var restante = meta - actual;                   /* con signo: hacia dónde falta */
    var logrado = subir ? (actual >= meta - tolerancia) : (actual <= meta + tolerancia);
    if (objetivo === 'mantener') logrado = Math.abs(restante) <= tolerancia;

    var avanzando = (restante > 0 && ritmo > 0) || (restante < 0 && ritmo < 0);
    var mesesEstimados = null;
    if (!logrado && avanzando && Math.abs(ritmo) > 0.01) {
      mesesEstimados = Math.abs(restante) / Math.abs(ritmo);
    }

    return {
      ok: true,
      clave: clave,
      etiqueta: etiqueta,
      unidad: unidad,
      objetivo: objetivo,
      desde: desde,
      actual: actual,
      meta: meta,
      subir: subir,
      restante: restante,
      ritmo: ritmo,
      meses: meses,
      mesesEstimados: mesesEstimados,
      logrado: logrado,
      avanzando: avanzando,
      primeraFecha: primera.fecha,
      ultimaFecha: ultima.fecha
    };
  }

  /* Frase de proyección: honesta, nunca promete lo que los datos no dicen. */
  function textoProyeccion(meta) {
    if (!meta.ok) return meta.motivo;

    var unidad = meta.unidad ? ' ' + meta.unidad : '';

    if (meta.objetivo === 'mantener') {
      return meta.logrado
        ? 'Tu meta es mantenerte y lo estás logrando: te has movido ' + U.num(Math.abs(meta.actual - meta.desde), 1) +
          unidad + ' desde tu primera medición.'
        : 'Tu meta es mantenerte, pero llevas ' + U.signo(meta.actual - meta.desde, 1, meta.unidad) +
          ' desde tu primera medición. Ajustar porciones y sostener la rutina te regresa al punto de equilibrio.';
    }

    if (meta.logrado) {
      return '¡Ya alcanzaste tu meta de referencia! Ahora el trabajo es sostenerla: lo difícil no es llegar, es quedarse.';
    }

    if (!meta.avanzando || Math.abs(meta.ritmo) <= 0.01) {
      return 'Con tu ritmo actual no podemos darte una fecha estimada: la métrica no se está moviendo hacia tu meta. ' +
        'Te faltan ' + U.num(Math.abs(meta.restante), 1) + unidad + ' y conviene revisar el plan con tu coach.';
    }

    var m = meta.mesesEstimados;
    if (m === null) return 'Todavía no hay suficiente movimiento para proyectar una fecha.';

    if (m > 36) {
      return 'A este ritmo tardarías más de 3 años en llegar. Te faltan ' + U.num(Math.abs(meta.restante), 1) +
        unidad + ': vale la pena ajustar el plan con tu coach para acelerar el avance.';
    }

    var redondeado = Math.max(1, Math.round(m));
    return 'A este ritmo alcanzarías tu meta en ~' + redondeado + (redondeado === 1 ? ' mes' : ' meses') +
      ' (te faltan ' + U.num(Math.abs(meta.restante), 1) + unidad + ').';
  }

  function metaHTML(socio, mediciones) {
    var progreso = Calc.progresoObjetivo(socio, mediciones);
    var meta = calcularMeta(socio, mediciones);

    var cuerpo = '<div class="row wrap">' +
      '<div class="anillo anillo-lg">' +
        Charts.progreso(progreso.pct, { texto: String(Math.round(progreso.pct)) + '%', etiqueta: 'Avance', alto: 168, grosor: 14 }) +
      '</div>' +
      '<div class="flex1 stack-sm" style="min-width:220px">' +
        '<div class="row-sm wrap">' +
          '<span class="pill pill-rojo">' + esc(etiquetaObjetivo(socio.objetivo)) + '</span>' +
          (progreso.clase ? '<span class="badge ' + esc(progreso.clase) + '">' +
            esc(Calc.textoNivel(progreso.nivel)) + '</span>' : '') +
        '</div>' +
        '<p class="muted">' + esc(progreso.texto) + '</p>' +
      '</div>' +
    '</div>';

    cuerpo += '<div class="mt">' +
      barraHTML('Avance hacia tu objetivo', U.pct(progreso.pct, 0), progreso.pct, claseBarra(progreso.pct)) +
    '</div>';

    if (meta.ok) {
      var unidad = meta.unidad ? ' ' + meta.unidad : '';
      var ritmoTexto = Math.abs(meta.ritmo) < 0.01
        ? 'Sin cambio'
        : U.signo(meta.ritmo, 2, meta.unidad) + ' al mes';

      cuerpo += '<div class="datos-grid mt">' +
        datoHTML('Métrica de tu meta', meta.etiqueta,
          'Se elige según tu objetivo: ' + etiquetaObjetivo(socio.objetivo).toLowerCase()) +
        datoHTML('Punto de partida', U.num(meta.desde, 1) + unidad, U.fecha(meta.primeraFecha, 'corto')) +
        datoHTML('Hoy', U.num(meta.actual, 1) + unidad, U.fecha(meta.ultimaFecha, 'corto')) +
        datoHTML('Meta de referencia', U.num(meta.meta, 1) + unidad,
          meta.logrado ? 'Ya la alcanzaste' : 'Te faltan ' + U.num(Math.abs(meta.restante), 1) + unidad) +
        datoHTML('Ritmo mensual promedio', ritmoTexto,
          'Calculado sobre ' + U.num(meta.meses, 1) + (meta.meses === 1 ? ' mes' : ' meses') + ' de historial') +
        datoHTML('Proyección',
          meta.mesesEstimados !== null
            ? '~' + Math.max(1, Math.round(meta.mesesEstimados)) + (Math.max(1, Math.round(meta.mesesEstimados)) === 1 ? ' mes' : ' meses')
            : (meta.logrado ? 'Meta alcanzada' : 'Sin fecha estimada'),
          meta.logrado ? 'Ahora toca sostenerla' : 'Con tu ritmo actual') +
      '</div>';
    }

    var clase = 'aviso-info';
    if (meta.ok && meta.logrado) clase = 'aviso-ok';
    else if (meta.ok && !meta.avanzando) clase = 'aviso-warn';

    cuerpo += '<div class="aviso ' + clase + ' mt">' + icono('meta', 18) +
      '<span><b>Proyección honesta.</b><br>' + esc(textoProyeccion(meta)) + '</span></div>';

    return tarjetaHTML('Mi meta', 'meta', cuerpo);
  }

  /* =============================================================
     11. Reporte imprimible
     ============================================================= */

  function fichaSocioHTML(socio, periodo) {
    var coach = coachDe(socio);
    var est = Calc.estadoMembresia(socio);
    return '<div class="datos-grid">' +
      datoHTML('Socio', U.nombreCompleto(socio), socio.codigo ? 'Código ' + socio.codigo : '') +
      datoHTML('Objetivo', etiquetaObjetivo(socio.objetivo), 'Nivel ' + (socio.nivel || 'sin definir')) +
      datoHTML('Coach', coach ? U.nombreCompleto(coach) : 'Sin coach asignado', coach && coach.especialidad ? coach.especialidad : '') +
      datoHTML('Mes del reporte', U.nombreMes(periodo), 'Generado el ' + U.fecha(U.hoy(), 'corto')) +
      datoHTML('Membresía', est && est.texto ? est.texto : 'Sin datos', 'Antigüedad: ' + Calc.antiguedadTexto(socio.fechaAlta)) +
    '</div>';
  }

  function imprimirReporte(socio, periodo) {
    var mediciones = medicionesVisibles(socio.id);

    var html = '<div class="stack">' +
      '<div class="prg-imp-tit">Reporte personal de progreso</div>' +
      fichaSocioHTML(socio, periodo) +
      zonaMesHTML(socio, periodo, mediciones, true) +
      cuerpoHoyHTML(socio, mediciones, true) +
      recordsFuerzaHTML(socio, mediciones, true) +
      metaHTML(socio, mediciones) +
    '</div>';

    U.imprimir(html, 'Mi progreso · ' + U.nombreCompleto(socio) + ' · ' + U.nombreMes(periodo));
    U.toast('Preparando tu reporte para imprimir…', 'info');
  }

  /* =============================================================
     12. Render de la vista
     ============================================================= */

  function cabeceraHTML(socio) {
    return '<div class="page-head">' +
      '<div>' +
        '<h1 class="page-title">' + icono('grafica', 22) + 'Mi progreso</h1>' +
        '<p class="page-sub">Tu medición de inicio, la de cierre y todo lo que cambió en el camino, ' +
          esc(U.nombreCompleto(socio).split(' ')[0] || 'atleta') + '.</p>' +
      '</div>' +
      '<div class="page-acciones">' +
        '<button type="button" class="btn btn-outline" data-imprimir-reporte>' +
          icono('imprimir', 16) + 'Descargar mi reporte</button>' +
      '</div>' +
    '</div>';
  }

  function render(ctx) {
    asegurarEstilos();

    var usuario = ctx && ctx.usuario ? ctx.usuario : null;

    if (!usuario || usuario.rol !== 'socio') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('Esta pantalla es solo para socios. Entra con tu cuenta de socio para ver tu progreso.', 'candado') +
        '</div></div></div>';
    }

    var socio = AG.DB.usuario(usuario.id);
    if (!socio || socio.rol !== 'socio') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('No encontramos tu ficha de socio en el sistema. Avisa en recepción para revisarla.', 'alerta') +
        '</div></div></div>';
    }

    var mediciones = medicionesVisibles(socio.id);

    /* Estado vivo: se reinicia si cambió el socio o si el mes ya no es válido. */
    if (estado.socioId !== socio.id) {
      estado.socioId = socio.id;
      estado.periodo = '';
      estado.rm = '';
    }
    if (!esMes(estado.periodo) || estado.periodo > U.mesActual()) {
      estado.periodo = U.mesActual();
    }

    /* Sin ninguna medición: una sola pantalla motivadora y nada de ruido. */
    if (!mediciones.length) {
      var mensajeWA = 'Hola, soy ' + U.nombreCompleto(socio) + '. Quiero agendar mi primera medición.';
      var htmlVacio = '<div class="page" data-progreso>' +
        cabeceraHTML(socio) +
        '<div class="card card-rojo"><div class="card-body">' +
          vacioHTML('Tu progreso empieza con una medición. Pídele a tu coach que te tome la de inicio: ' +
            'peso, grasa, músculo y tus 10 medidas. En 30 días vas a ver, con números, todo lo que cambió.',
            'meta',
            '<div class="row-sm wrap center mt">' + botonCoachHTML(socio, mensajeWA, 'btn-primary') + '</div>') +
        '</div></div>' +
        '<div class="aviso aviso-info">' + icono('info', 18) +
          '<span><b>¿Por qué medir?</b><br>La báscula sola engaña: puedes bajar de peso perdiendo músculo. ' +
          'Midiendo grasa, músculo y perímetros sabemos exactamente qué está cambiando y por qué.</span></div>' +
      '</div>';
      return { html: htmlVacio, listo: function (root) { enganchar(root, socio); } };
    }

    var html = '<div class="page" data-progreso>' +
      cabeceraHTML(socio) +
      '<div data-zona-mes>' + zonaMesHTML(socio, estado.periodo, mediciones, false) + '</div>';

    /* Mi evolución — historial completo reutilizado del módulo de mediciones */
    var mod = modMediciones();
    html += '<div class="card-title mt">' + icono('historial', 18) + '<span>Mi evolución</span></div>';
    if (mod && typeof mod.historial === 'function') {
      html += mod.historial(socio.id);
    } else {
      html += '<div class="card"><div class="card-body">' +
        vacioHTML('El historial de mediciones no está disponible en este momento.', 'alerta') +
        '</div></div>';
    }

    html += cuerpoHoyHTML(socio, mediciones, false);
    html += recordsFuerzaHTML(socio, mediciones, false);
    html += metaHTML(socio, mediciones);

    html += '<div class="card"><div class="card-body">' +
      '<div class="row-sm between wrap">' +
        '<div class="flex1" style="min-width:200px">' +
          '<b>¿Quieres llevarte tu reporte?</b>' +
          '<p class="mini muted">Se imprime el resumen de ' + esc(U.nombreMes(estado.periodo)) +
            ' con tu comparativo, tu cuerpo de hoy, tus récords y tu meta.</p>' +
        '</div>' +
        '<button type="button" class="btn btn-primary no-imprimir" data-imprimir-reporte>' +
          icono('imprimir', 16) + 'Descargar mi reporte</button>' +
      '</div>' +
    '</div></div>';

    html += '</div>';

    return { html: html, listo: function (root) { enganchar(root, socio); } };
  }

  /* =============================================================
     13. Eventos
     ============================================================= */

  function repintarZonaMes(raiz, socio) {
    var zona = U.$('[data-zona-mes]', raiz);
    if (!zona) return;
    zona.innerHTML = zonaMesHTML(socio, estado.periodo, medicionesVisibles(socio.id), false);
  }

  function enganchar(root, socio) {
    if (!root) return;
    asegurarEstilos();

    var raiz = U.$('[data-progreso]', root) || root;
    if (raiz.__prgEnganchado) return;
    raiz.__prgEnganchado = true;

    /* Chips y botones que vienen del módulo de mediciones (historial, CSV). */
    var mod = modMediciones();
    if (mod && typeof mod.engancharAcciones === 'function') {
      try { mod.engancharAcciones(raiz); } catch (e) { /* la vista sigue funcionando sin ellos */ }
    }

    var mediciones = medicionesVisibles(socio.id);
    var min = mesMinimo(socio, mediciones);

    U.delegar(raiz, 'click', '[data-mes]', function (e, el) {
      e.preventDefault();
      var paso = Number(el.getAttribute('data-mes')) || 0;
      if (!paso) return;
      var destino = moverMes(estado.periodo, paso);
      if (destino > U.mesActual()) { U.toast('Todavía no llegamos a ese mes.', 'info'); return; }
      if (destino < min) { U.toast('No hay historial anterior a ' + U.nombreMes(min) + '.', 'info'); return; }
      estado.periodo = destino;
      repintarZonaMes(raiz, socio);
    });

    U.delegar(raiz, 'click', '[data-mes-actual]', function (e) {
      e.preventDefault();
      if (estado.periodo === U.mesActual()) return;
      estado.periodo = U.mesActual();
      repintarZonaMes(raiz, socio);
    });

    U.delegar(raiz, 'click', '[data-rm]', function (e, el) {
      e.preventDefault();
      var clave = el.getAttribute('data-rm');
      if (!clave) return;
      estado.rm = clave;

      var tarjetas = U.$$('[data-rm]', raiz);
      for (var i = 0; i < tarjetas.length; i++) {
        var on = tarjetas[i].getAttribute('data-rm') === clave;
        tarjetas[i].classList.toggle('on', on);
        tarjetas[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }

      var caja = U.$('[data-rm-tabla]', raiz);
      if (caja) caja.innerHTML = tablaRMHTML(clave, recordsDeFuerza(medicionesVisibles(socio.id)));
    });

    U.delegar(raiz, 'click', '[data-imprimir-reporte]', function (e) {
      e.preventDefault();
      imprimirReporte(socio, estado.periodo);
    });
  }

  /* =============================================================
     14. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.SocioProgreso = {
    render: render,
    imprimirReporte: imprimirReporte
  };

  AG.Router.registrar({
    path: 'socio/progreso',
    roles: ['socio'],
    titulo: 'Mi progreso',
    nav: { etiqueta: 'Mi progreso', icono: 'grafica', grupo: 'Mi entrenamiento', orden: 2 },
    render: render
  });
})(window.AG);
