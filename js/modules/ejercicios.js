/* =============================================================
   ALLIANCE GYM — Biblioteca de ejercicios (AG.Mod.Ejercicios)
   -------------------------------------------------------------
   Rediseño v2: el socio ENTIENDE el ejercicio sin leer. Cada
   tarjeta muestra la ilustración animada de AG.Ilustra; el detalle
   es visual (pasos cortos, tres datos, series según objetivo y
   ejercicios parecidos con su mini ilustración).

   Rutas que registra:
     director/ejercicios · coach/ejercicios · socio/ejercicios

   Funciones compartidas con el resto del sistema:
     AG.Mod.Ejercicios.detalle(ejercicioId, opts) modal visual con la técnica
     AG.Mod.Ejercicios.selector(callback, opts)   buscador compacto (con mini ilustración)
     AG.Mod.Ejercicios.mini(ejercicioId, opts)    HTML compacto: mini ilustración + nombre
     AG.Mod.Ejercicios.tarjeta(ej)                tarjeta de la cuadrícula
     AG.Mod.Ejercicios.sugerencia(nivel, tipo)    series/reps por nivel (para rutinas)
     AG.Mod.Ejercicios.recomendacion(ej, usuario) series/reps según el objetivo del socio
     AG.Mod.Ejercicios.paraRutina(id, nivel)      bloque listo para una rutina
     AG.Mod.Ejercicios.ultimoSeleccionado         portapapeles del constructor
     AG.Mod.Ejercicios.tomarSeleccionado()        lo entrega y lo limpia

   Cualquier elemento con data-ejx-detalle="ej_xxx" abre el detalle
   (enganche global, sirve a las rutinas y a los paneles de inicio).

   El catálogo vive en AG.Data (js/data/exercises.js) y los dibujos
   en AG.Ilustra (js/data/ilustraciones.js): aquí no se inventa nada.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  /* =============================================================
     0. Constantes del módulo
     ============================================================= */

  /* Tarjetas que se pintan de golpe en la biblioteca (el resto, "Ver más"). */
  var PASO = 24;

  /* Filas que se pintan de golpe en el selector compacto. */
  var PASO_SEL = 40;

  var NIVELES = [
    { id: 'principiante', nombre: 'Principiante', badge: 'ok', tile: 'ok' },
    { id: 'intermedio', nombre: 'Intermedio', badge: 'info', tile: 'info' },
    { id: 'avanzado', nombre: 'Avanzado', badge: 'warn', tile: 'warn' }
  ];

  var NOMBRE_TIPO = {
    fuerza: 'Fuerza',
    hipertrofia: 'Hipertrofia',
    cardio: 'Cardio',
    movilidad: 'Movilidad',
    funcional: 'Funcional'
  };

  /* Icono con el que se representa cada equipo en el detalle. */
  var ICONO_EQUIPO = {
    barra: 'barra',
    mancuernas: 'mancuerna',
    maquina: 'engrane',
    polea: 'subir',
    peso_corporal: 'usuario',
    kettlebell: 'peso',
    banda: 'cinta',
    balon: 'diana',
    cardio: 'corazon'
  };

  /**
   * Series, repeticiones y descanso por tipo de ejercicio y nivel del
   * socio. Lo usan las rutinas (paraRutina) y sirve de base para cardio
   * y movilidad, donde no aplican las repeticiones por objetivo.
   * 'repsNum' es lo que se escribe en la bitácora (en cardio son minutos;
   * en movilidad, una retención por serie).
   */
  var SUGERENCIAS = {
    fuerza: {
      principiante: { series: 3, reps: '8-10', repsNum: 8, descansoSeg: 90, tempo: '2-0-2' },
      intermedio: { series: 4, reps: '5-8', repsNum: 6, descansoSeg: 120, tempo: '2-1-1' },
      avanzado: { series: 5, reps: '3-5', repsNum: 4, descansoSeg: 180, tempo: '2-1-X' }
    },
    hipertrofia: {
      principiante: { series: 3, reps: '12-15', repsNum: 12, descansoSeg: 60, tempo: '2-0-2' },
      intermedio: { series: 4, reps: '8-12', repsNum: 10, descansoSeg: 75, tempo: '3-0-1' },
      avanzado: { series: 4, reps: '6-10', repsNum: 8, descansoSeg: 90, tempo: '3-1-1' }
    },
    funcional: {
      principiante: { series: 3, reps: '10-12', repsNum: 10, descansoSeg: 60, tempo: 'Controlado' },
      intermedio: { series: 4, reps: '12-15', repsNum: 12, descansoSeg: 45, tempo: 'Continuo' },
      avanzado: { series: 5, reps: '15-20', repsNum: 15, descansoSeg: 40, tempo: 'Explosivo' }
    },
    cardio: {
      principiante: { series: 1, reps: '15 min continuos', repsNum: 15, descansoSeg: 0, tempo: 'Ritmo suave' },
      intermedio: { series: 2, reps: '12 min por bloque', repsNum: 12, descansoSeg: 90, tempo: 'Ritmo medio' },
      avanzado: { series: 3, reps: '10 min por bloque', repsNum: 10, descansoSeg: 60, tempo: 'Ritmo alto' }
    },
    movilidad: {
      principiante: { series: 2, reps: '30 s por lado', repsNum: 1, descansoSeg: 20, tempo: 'Sin rebotes' },
      intermedio: { series: 3, reps: '30 s por lado', repsNum: 1, descansoSeg: 20, tempo: 'Sin rebotes' },
      avanzado: { series: 3, reps: '45 s por lado', repsNum: 1, descansoSeg: 15, tempo: 'Sin rebotes' }
    }
  };

  /**
   * Repeticiones según el OBJETIVO del socio (lo que ve en el detalle):
   * fuerza 4-6 · músculo 8-12 · resistencia 15-20.
   */
  var OBJETIVOS = [
    { id: 'fuerza', nombre: 'Fuerza', reps: '4-6', repsNum: 5, series: 4, seriesMax: 5, descansoSeg: 150, nota: 'Peso alto, pocas repeticiones' },
    { id: 'hipertrofia', nombre: 'Músculo', reps: '8-12', repsNum: 10, series: 3, seriesMax: 4, descansoSeg: 75, nota: 'El punto medio para crecer' },
    { id: 'resistencia', nombre: 'Resistencia', reps: '15-20', repsNum: 15, series: 3, seriesMax: 4, descansoSeg: 45, nota: 'Peso ligero, muchas repeticiones' }
  ];

  /* Objetivo del usuario (js/core/db.js) -> objetivo de repeticiones. */
  var OBJETIVO_USUARIO = {
    rendimiento: 'fuerza',
    ganar_musculo: 'hipertrofia',
    mantener: 'hipertrofia',
    perder_grasa: 'resistencia',
    salud: 'resistencia'
  };

  /* Filtros vivos de la biblioteca: se conservan entre repintados. */
  var estado = {
    texto: '',
    grupo: 'todos',
    equipo: 'todos',
    nivel: 'todos',
    mostrar: PASO
  };

  /* =============================================================
     1. Atajos y utilidades internas
     ============================================================= */

  function esc(v) { return AG.Utils.esc(v); }

  function ico(nombre, tamano, opciones) { return AG.Icons.get(nombre, tamano, opciones); }

  function toast(mensaje, tipo) { AG.Utils.toast(mensaje, tipo); }

  function esArreglo(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  function catalogo() {
    var lista = (AG.Data && AG.Data.exercises) ? AG.Data.exercises : null;
    return esArreglo(lista) ? lista : [];
  }

  function grupos() {
    var lista = (AG.Data && AG.Data.GRUPOS) ? AG.Data.GRUPOS : null;
    return esArreglo(lista) ? lista : [];
  }

  function equipos() {
    var lista = (AG.Data && AG.Data.EQUIPOS) ? AG.Data.EQUIPOS : null;
    return esArreglo(lista) ? lista : [];
  }

  function ejercicioDe(id) {
    if (!id) return null;
    if (typeof id === 'object') return id;
    if (AG.Data && typeof AG.Data.ejercicio === 'function') {
      try { return AG.Data.ejercicio(String(id)) || null; } catch (e) { return null; }
    }
    return null;
  }

  function datosGrupo(id) {
    if (AG.Data && typeof AG.Data.grupo === 'function') {
      try { return AG.Data.grupo(id) || { id: 'general', nombre: 'General', icono: 'pesa', color: '#8a8f98' }; }
      catch (e) { /* respaldo abajo */ }
    }
    return { id: 'general', nombre: 'General', icono: 'pesa', color: '#8a8f98' };
  }

  function nombreEquipo(id) {
    if (AG.Data && typeof AG.Data.nombreEquipo === 'function') {
      try { return AG.Data.nombreEquipo(id); } catch (e) { /* respaldo abajo */ }
    }
    return 'Sin equipo';
  }

  function nombreTipo(id) {
    return NOMBRE_TIPO[id] || 'General';
  }

  function nivelInfo(id) {
    for (var i = 0; i < NIVELES.length; i++) {
      if (NIVELES[i].id === id) return NIVELES[i];
    }
    return { id: '', nombre: 'Todos los niveles', badge: 'muted', tile: 'neutro' };
  }

  function objetivoInfo(id) {
    for (var i = 0; i < OBJETIVOS.length; i++) {
      if (OBJETIVOS[i].id === id) return OBJETIVOS[i];
    }
    return null;
  }

  /** '#e4322b' + opacidad -> 'rgba(228,50,43,.2)'. Tolera valores raros. */
  function rgba(hex, alfa) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '8A8F98';
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    var a = (alfa === null || alfa === undefined) ? 1 : Number(alfa);
    if (!isFinite(a)) a = 1;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /** Color seguro de un grupo (siempre un hex válido). */
  function colorGrupo(id) {
    var g = datosGrupo(id);
    var c = String((g && g.color) ? g.color : '');
    return /^#[0-9a-fA-F]{3,6}$/.test(c) ? c : '#8A8F98';
  }

  /** Filtra el catálogo respetando la API del archivo de datos. */
  function filtrar(f) {
    if (AG.Data && typeof AG.Data.ejerciciosPor === 'function') {
      try { return AG.Data.ejerciciosPor(f || {}) || []; } catch (e) { return []; }
    }
    return catalogo().slice();
  }

  /** ¿Este ejercicio pertenece al grupo (principal o secundario)? */
  function esDelGrupo(ej, grupoId) {
    if (!ej) return false;
    if (ej.grupo === grupoId) return true;
    return !!(ej.grupos && ej.grupos.indexOf && ej.grupos.indexOf(grupoId) !== -1);
  }

  /** Nivel válido del usuario ('' si no lo tiene capturado). */
  function nivelDe(usuario) {
    if (!usuario) return '';
    var n = String(usuario.nivel || '');
    for (var i = 0; i < NIVELES.length; i++) {
      if (NIVELES[i].id === n) return n;
    }
    return '';
  }

  /** Objetivo de repeticiones del usuario ('' si no aplica). */
  function objetivoDe(usuario) {
    if (!usuario) return '';
    var o = OBJETIVO_USUARIO[String(usuario.objetivo || '')];
    return o || '';
  }

  /** 'Pectoral mayor, tríceps' -> ['Pectoral mayor', 'Tríceps'] */
  function musculosDe(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto).trim();
    if (!t) return [];
    var lista = t.split(/\s*[,;]\s*/);
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      var m = lista[i].trim();
      if (m) salida.push(m.charAt(0).toUpperCase() + m.slice(1));
    }
    return salida;
  }

  /** '90 s' / '2 min' legible para el descanso. */
  function textoDescanso(segundos) {
    var s = Math.max(0, Math.round(Number(segundos) || 0));
    if (!s) return 'sin descanso';
    if (s < 60) return s + ' s';
    var min = Math.floor(s / 60);
    var resto = s % 60;
    return resto ? min + ' min ' + resto + ' s' : min + ' min';
  }

  function normalizar(texto) {
    if (AG.Utils && typeof AG.Utils.normalizar === 'function') return AG.Utils.normalizar(texto);
    return String(texto || '').toLowerCase().trim();
  }

  /* -------------------------------------------------------------
     Instrucciones -> pasos cortos
     ------------------------------------------------------------- */

  /** Parte un texto en frases (sin usar lookbehind, por Safari viejo). */
  function frasesDe(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto).replace(/\s+/g, ' ').trim();
    if (!t) return [];
    var partes = t.split(/[.!?]+\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"(])/);
    var salida = [];
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i].replace(/[.!?\s]+$/, '').trim();
      if (p) salida.push(p);
    }
    // Una sola frase larguísima: se intenta partir por ';' o ':'
    if (salida.length === 1 && salida[0].length > 120 && /[;:]\s/.test(salida[0])) {
      var sub = salida[0].split(/\s*[;:]\s+/);
      salida = [];
      for (var k = 0; k < sub.length; k++) {
        var s = sub[k].trim();
        if (s) salida.push(s);
      }
    }
    return salida;
  }

  /* Conectores donde una frase se puede partir en "acción" + "detalle". */
  var CONECTORES = [', ', ' hasta ', ' manteniendo ', ' mientras ', ' sin ', ' con ', ' para ', ' y '];

  /** Una frase -> { titulo: acción corta, detalle: el resto (o '') }. */
  function partirPaso(frase) {
    var f = String(frase || '').trim();
    if (!f) return { titulo: '', detalle: '' };
    var mejor = -1;
    var salto = 0;
    for (var i = 0; i < CONECTORES.length; i++) {
      var c = CONECTORES[i];
      var idx = f.indexOf(c);
      while (idx !== -1 && idx < 12) idx = f.indexOf(c, idx + 1);
      if (idx !== -1 && idx <= 64 && (mejor === -1 || idx < mejor)) {
        mejor = idx;
        salto = (c === ', ') ? 2 : 1;
      }
    }
    if (mejor === -1) return { titulo: f, detalle: '' };
    var titulo = f.slice(0, mejor).trim();
    var detalle = f.slice(mejor + salto).trim();
    if (!titulo || !detalle) return { titulo: f, detalle: '' };
    detalle = detalle.charAt(0).toUpperCase() + detalle.slice(1);
    if (!/[.!?]$/.test(detalle)) detalle += '.';
    return { titulo: titulo, detalle: detalle };
  }

  /** Instrucciones -> 3-4 pasos { titulo, detalle }. */
  function pasosDe(texto, maximo) {
    var frases = frasesDe(texto);
    var max = Number(maximo) > 0 ? Number(maximo) : 4;
    if (frases.length > max) {
      var resto = frases.slice(max - 1).join('. ');
      frases = frases.slice(0, max - 1).concat([resto]);
    }
    var pasos = [];
    for (var i = 0; i < frases.length; i++) {
      var p = partirPaso(frases[i]);
      if (p.titulo) pasos.push(p);
    }
    return pasos;
  }

  /* =============================================================
     2. Ilustraciones (AG.Ilustra con respaldo)
     ============================================================= */

  function hayIlustra() {
    return !!(AG.Ilustra && typeof AG.Ilustra.get === 'function');
  }

  /** Respaldo si AG.Ilustra no está: medalla con el icono del grupo. */
  function respaldoIlustra(ej, alto) {
    var g = datosGrupo(ej ? ej.grupo : '');
    var color = colorGrupo(ej ? ej.grupo : '');
    var tam = Math.max(18, Math.round((Number(alto) || 100) * 0.34));
    return '<span class="ejx-medalla" style="background:' + esc(color) + ';width:' + Math.round(tam * 1.8) + 'px;height:' + Math.round(tam * 1.8) + 'px" aria-hidden="true">' +
      ico(g.icono, tam) + '</span>';
  }

  /**
   * SVG del ejercicio. opts = { alto, animado, fase, fondo }.
   * Nunca devuelve vacío: si AG.Ilustra falla, pinta la medalla del grupo.
   */
  function svgDe(ejOId, opts) {
    var ej = ejercicioDe(ejOId);
    var id = ej ? ej.id : (typeof ejOId === 'string' ? ejOId : '');
    var o = opts || {};
    if (hayIlustra()) {
      try {
        var s = AG.Ilustra.get(id, o);
        if (s && String(s).indexOf('<svg') !== -1) return String(s);
      } catch (e) { /* se usa el respaldo */ }
    }
    return respaldoIlustra(ej, o.alto);
  }

  /** Datos del patrón (nombre, músculos, consejo) de forma segura. */
  function infoIlustra(ejOId) {
    var vacio = { patron: '', nombre: '', musculos: '', consejo: '' };
    if (!AG.Ilustra || typeof AG.Ilustra.info !== 'function') return vacio;
    try {
      var ej = ejercicioDe(ejOId);
      var r = AG.Ilustra.info(ej ? ej.id : ejOId);
      return r || vacio;
    } catch (e) { return vacio; }
  }

  function patronDe(ejOId) {
    if (!AG.Ilustra || typeof AG.Ilustra.patronDe !== 'function') return '';
    try {
      var ej = ejercicioDe(ejOId);
      return String(AG.Ilustra.patronDe(ej ? ej.id : ejOId) || '');
    } catch (e) { return ''; }
  }

  /* =============================================================
     3. Estilos propios del módulo
     Variantes que el contrato de CSS no cubre (cuadrícula 2/4
     columnas, tarjeta con ilustración, bloque de repeticiones).
     Se inyectan una sola vez.
     ============================================================= */

  var CSS_MODULO = '' +
    /* --- cuadrícula: 4 columnas en escritorio, 2 en móvil --- */
    '.ejx-grid{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));min-width:0}' +
    '@media (max-width:1180px){.ejx-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
    '@media (max-width:820px){.ejx-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}' +
    /* --- tarjeta --- */
    '.ejx-card{padding:0;width:100%;text-align:left;cursor:pointer;display:flex;flex-direction:column;min-width:0;font:inherit;color:inherit}' +
    '.ejx-card:focus-visible{outline:2px solid var(--rojo-2);outline-offset:2px}' +
    '.ejx-arte{position:relative;padding:10px 10px 2px;min-width:0;' +
      'background:radial-gradient(60% 55% at 50% 62%,rgba(var(--rojo-rgb),.07),transparent 72%),var(--panel-2);' +
      'border-bottom:1px solid var(--borde);border-radius:calc(var(--radio) - 1px) calc(var(--radio) - 1px) 0 0}' +
    '.ejx-arte>svg{display:block;width:100%;height:auto;max-height:150px;margin:0 auto}' +
    '.ejx-arte .ilustra-fases{gap:6px}' +
    '.ejx-arte .ilustra-fases>*{padding:4px 4px 18px;background:transparent}' +
    '.ejx-arte .ilustra-fases>*::after{font-size:9px;bottom:4px}' +
    '.ejx-arte .ejx-medalla{margin:22px auto 26px}' +
    '.ejx-medalla{position:relative;display:grid;place-items:center;width:54px;height:54px;border-radius:50%;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.28)}' +
    '.ejx-card .card-body{padding:11px 12px 13px;display:flex;flex-direction:column;gap:8px;flex:1 1 auto}' +
    '.ejx-nombre{font-size:14px;font-weight:800;letter-spacing:-.01em;color:var(--texto);line-height:1.3;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.ejx-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto}' +
    '.ejx-tags .pill,.ejx-tags .badge{max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
    '.ejx-punto{width:8px;height:8px;border-radius:50%;flex:0 0 auto}' +
    /* --- filtros --- */
    '.ejx-chip-ico{display:inline-grid;place-items:center;line-height:0}' +
    '.chip.on .ejx-chip-ico{color:#fff!important}' +
    '.chip[disabled]{opacity:.42;cursor:default}' +
    '.ejx-filtros .desplegable.plano{margin-top:4px}' +
    '.ejx-filtros .desplegable.plano>.desplegable-cab{padding-top:10px;padding-bottom:8px;font-size:13px}' +
    '.ejx-filtros .desplegable.plano>.desplegable-cuerpo{padding-bottom:6px}' +
    '.ejx-filtros .form-row{align-items:flex-end}' +
    '.ejx-n{opacity:.72;font-weight:700}' +
    /* --- detalle --- */
    '.ejx-hero{padding:8px 8px 10px}' +
    '.ejx-hero>svg{max-height:240px}' +
    '.ejx-hero .ilustra-fases>* svg{max-height:200px}' +
    '.ejx-hero .ejx-medalla{width:96px;height:96px;margin:40px auto}' +
    '.ejx-hero .ejx-medalla svg{width:44px;height:44px}' +
    '.ejx-h{display:flex;align-items:center;gap:7px;margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--texto-2)}' +
    '.ejx-h svg{color:var(--rojo);width:15px;height:15px;flex:0 0 auto}' +
    '.ejx-tiles .tile{gap:7px;padding:12px 12px 11px}' +
    '.ejx-tiles .tile-val{font-size:15px;white-space:normal;line-height:1.25;overflow-wrap:anywhere;overflow:visible;text-overflow:clip}' +
    '.ejx-pasos .paso-txt small{margin-top:2px}' +
    '.ejx-cuida{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}' +
    '.ejx-cuida li{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--radio-sm);' +
      'background:var(--warn-bg);border:1px solid rgba(var(--warn-rgb),.30);font-size:13.5px;line-height:1.4;color:var(--texto)}' +
    '.ejx-cuida svg{flex:0 0 auto;width:17px;height:17px;color:var(--warn);margin-top:1px}' +
    '.ejx-reps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:9px}' +
    '.ejx-reps.ejx-reps-1{grid-template-columns:minmax(0,1fr)}' +
    '.ejx-rep{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 8px 10px;min-width:0;' +
      'border-radius:var(--radio-sm);background:var(--panel-2);border:1px solid var(--borde);text-align:center;color:var(--texto-2)}' +
    '.ejx-rep-obj{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}' +
    '.ejx-rep-val{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--texto);font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.ejx-rep-lab{font-size:11.5px;font-weight:600;line-height:1.3}' +
    '.ejx-rep-desc{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:11px;font-weight:700}' +
    '.ejx-rep-desc svg{width:12px;height:12px}' +
    '.ejx-rep.on{background:linear-gradient(140deg,var(--rojo-2),var(--rojo) 55%,var(--rojo-oscuro));border-color:rgba(0,0,0,.18);color:rgba(255,255,255,.86);box-shadow:var(--sombra-rojo)}' +
    '.ejx-rep.on .ejx-rep-val{color:#fff}' +
    '.ejx-rep-tag{position:absolute;top:-9px;left:50%;transform:translateX(-50%);padding:2px 8px;border-radius:999px;' +
      'background:var(--texto);color:var(--panel);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}' +
    '.ejx-series{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:13px;font-weight:600;color:var(--texto-2)}' +
    '.ejx-series span{display:inline-flex;align-items:center;gap:6px}' +
    '.ejx-series svg{color:var(--texto-3);width:15px;height:15px}' +
    '.ejx-series b{color:var(--texto);font-weight:800}' +
    '.ejx-alts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
    '.ejx-alt{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;min-width:0;border-radius:var(--radio-sm);' +
      'background:var(--panel-2);border:1px solid var(--borde);color:var(--texto);font:inherit;cursor:pointer;text-align:center;' +
      'transition:border-color var(--trans),transform var(--trans),box-shadow var(--trans)}' +
    '.ejx-alt:hover{border-color:var(--borde-2);transform:translateY(-2px);box-shadow:var(--sombra)}' +
    '.ejx-alt:focus-visible{outline:2px solid var(--rojo-2);outline-offset:2px}' +
    '.ejx-alt .ilustra-mini{background:var(--panel)}' +
    '.ejx-alt-nombre{font-size:12.5px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}' +
    '.ejx-alt-sub{font-size:11px;color:var(--texto-3);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    /* --- mini reutilizable --- */
    '.ejx-mini-ej{display:inline-flex;align-items:center;gap:10px;min-width:0;max-width:100%;vertical-align:middle}' +
    '.ejx-mini-ej .ilustra-mini{width:48px;height:48px}' +
    '.ejx-mini-nombre{font-size:13px;font-weight:700;color:var(--texto);line-height:1.3;min-width:0;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.ejx-mini-nombre small{display:block;font-size:11px;font-weight:600;color:var(--texto-3)}' +
    'button.ejx-mini-ej{background:transparent;border:0;padding:0;font:inherit;cursor:pointer;text-align:left;color:inherit}' +
    'button.ejx-mini-ej:hover .ejx-mini-nombre{color:var(--rojo-2)}' +
    'button.ejx-mini-ej:focus-visible{outline:2px solid var(--rojo-2);outline-offset:2px;border-radius:var(--radio-sm)}' +
    /* --- selector compacto --- */
    '.ejx-lista{max-height:min(46vh,380px);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '.ejx-sel[aria-pressed="true"]{background:var(--rojo-bg)}' +
    '.ejx-sel[aria-pressed="true"] .list-item-main b{color:var(--texto)}' +
    '.ejx-sel .ilustra-mini{width:52px;height:52px}' +
    '.ejx-sel .list-item-main{min-width:0}' +
    '@media (max-width:700px){' +
      '.ejx-lista{max-height:52vh}' +
      '.ejx-reps{gap:6px}.ejx-rep{padding:12px 6px 9px}.ejx-rep-val{font-size:20px}' +
      '.ejx-alts{gap:6px}.ejx-alt{padding:8px 6px}.ejx-alt .ilustra-mini{width:64px;height:64px}' +
      '.ejx-arte>svg{max-height:132px}' +
    '}';

  var estilosListos = false;

  function asegurarEstilos() {
    if (estilosListos) return;
    try {
      if (document.getElementById('ag-ejercicios-css')) { estilosListos = true; return; }
      var st = document.createElement('style');
      st.id = 'ag-ejercicios-css';
      st.textContent = CSS_MODULO;
      document.head.appendChild(st);
      estilosListos = true;
    } catch (e) {
      estilosListos = false;     // se reintenta en el siguiente pintado
    }
  }

  /* =============================================================
     4. Piezas de interfaz reutilizables
     ============================================================= */

  /** Píldora del grupo muscular con su color. */
  function pillGrupo(grupoId) {
    var g = datosGrupo(grupoId);
    return '<span class="pill"><span class="ejx-punto" style="background:' + esc(colorGrupo(grupoId)) + '"></span>' +
      esc(g.nombre) + '</span>';
  }

  /** Solo DOS etiquetas: grupo y equipo. */
  function etiquetas(ej) {
    return '<div class="ejx-tags">' +
      pillGrupo(ej.grupo) +
      AG.Utils.badge(nombreEquipo(ej.equipo), 'muted') +
      '</div>';
  }

  /** Tarjeta de la cuadrícula: ilustración animada, nombre y dos etiquetas. */
  function tarjeta(ej) {
    if (!ej) return '';
    return '' +
      '<button type="button" class="card hover-elevar ejx-card" data-ej="' + esc(ej.id) + '" ' +
        'title="Ver cómo se hace: ' + esc(ej.nombre) + '">' +
        '<div class="ejx-arte" aria-hidden="true">' +
          svgDe(ej, { alto: 150, animado: true }) +
        '</div>' +
        '<div class="card-body">' +
          '<div class="ejx-nombre">' + esc(ej.nombre) + '</div>' +
          etiquetas(ej) +
        '</div>' +
      '</button>';
  }

  /**
   * HTML compacto: mini ilustración + nombre. Lo reutilizan las rutinas.
   * @param {String} ejercicioId
   * @param {Object} [opts] { alto:48, sub:String, clickable:false, clase:String }
   *   clickable:true lo vuelve un botón que abre el detalle (no lo uses
   *   dentro de otro botón).
   */
  function mini(ejercicioId, opts) {
    asegurarEstilos();
    var o = opts || {};
    var ej = ejercicioDe(ejercicioId);
    var nombre = ej ? ej.nombre : 'Ejercicio';
    var alto = Number(o.alto) > 0 ? Number(o.alto) : 48;
    var svg = svgDe(ej || ejercicioId, { alto: alto, animado: false, fase: 'fin', fondo: false });
    var clase = 'ejx-mini-ej' + (o.clase ? ' ' + esc(o.clase) : '');
    var interior = '<span class="ilustra-mini" aria-hidden="true">' + svg + '</span>' +
      '<span class="ejx-mini-nombre">' + esc(nombre) + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>';
    if (o.clickable && ej) {
      return '<button type="button" class="' + clase + ' clickable" data-ejx-detalle="' + esc(ej.id) + '" ' +
        'title="Ver cómo se hace: ' + esc(nombre) + '">' + interior + '</button>';
    }
    return '<span class="' + clase + '">' + interior + '</span>';
  }

  /* =============================================================
     5. Vista: biblioteca
     ============================================================= */

  function hayFiltros() {
    return !!(estado.texto || estado.grupo !== 'todos' || estado.equipo !== 'todos' || estado.nivel !== 'todos');
  }

  function hayMasFiltros() {
    return estado.equipo !== 'todos' || estado.nivel !== 'todos';
  }

  function resultados() {
    return filtrar({
      texto: estado.texto,
      grupo: estado.grupo,
      equipo: estado.equipo,
      nivel: estado.nivel
    });
  }

  /** Chips de grupo con icono y color; se apagan los que no darían resultados. */
  function htmlChips() {
    var base = filtrar({ texto: estado.texto, equipo: estado.equipo, nivel: estado.nivel });
    var lista = grupos();
    var html = '<div class="chips" role="group" aria-label="Grupo muscular">';

    html += '<button type="button" class="chip' + (estado.grupo === 'todos' ? ' on' : '') +
      '" data-grupo="todos">' + ico('pesa', 14) + 'Todos</button>';

    for (var i = 0; i < lista.length; i++) {
      var g = lista[i];
      var n = 0;
      for (var j = 0; j < base.length; j++) {
        if (esDelGrupo(base[j], g.id)) n++;
      }
      var activo = estado.grupo === g.id;
      html += '<button type="button" class="chip' + (activo ? ' on' : '') + '" data-grupo="' + esc(g.id) + '"' +
        (n === 0 && !activo ? ' disabled' : '') + ' aria-pressed="' + (activo ? 'true' : 'false') + '">' +
        '<span class="ejx-chip-ico" style="color:' + esc(colorGrupo(g.id)) + '">' + ico(g.icono, 14) + '</span>' +
        esc(g.nombre) + '</button>';
    }
    return html + '</div>';
  }

  function htmlConteo(lista) {
    var total = lista.length;
    var mostrados = Math.min(total, estado.mostrar);
    var texto = total === 1 ? '1 ejercicio' : AG.Utils.num(total, 0) + ' ejercicios';
    if (total > mostrados) texto += ' · ves ' + mostrados;
    return esc(texto);
  }

  /** Texto corto del resumen de "Más filtros". */
  function textoResumenFiltros() {
    var partes = [];
    if (estado.equipo !== 'todos') partes.push(nombreEquipo(estado.equipo));
    if (estado.nivel !== 'todos') partes.push(nivelInfo(estado.nivel).nombre);
    return partes.length ? partes.join(' · ') : 'Equipo y nivel';
  }

  function htmlVacio(icono, frase, detalle, boton) {
    return '<div class="vacio-amable">' +
      '<div class="vacio-amable-icono">' + ico(icono, 40) + '</div>' +
      '<p>' + esc(frase) + '</p>' +
      (detalle ? '<span>' + esc(detalle) + '</span>' : '') +
      (boton || '') +
      '</div>';
  }

  function htmlResultados(lista) {
    if (!catalogo().length) {
      return htmlVacio('pesa', 'La biblioteca no está disponible ahora',
        'Recarga la página; si sigue igual, avisa a dirección.');
    }

    if (!lista.length) {
      return htmlVacio('buscar', 'No encontramos ese ejercicio',
        'Prueba con otra palabra o quita los filtros.',
        '<button type="button" class="btn btn-outline" data-limpiar>' + ico('filtro', 16) + 'Quitar filtros</button>');
    }

    var visibles = lista.slice(0, estado.mostrar);
    var html = '<div class="ejx-grid">';
    for (var i = 0; i < visibles.length; i++) html += tarjeta(visibles[i]);
    html += '</div>';

    if (lista.length > visibles.length) {
      var faltan = lista.length - visibles.length;
      html += '<div class="center mt">' +
        '<button type="button" class="btn btn-outline" data-mas>' + ico('flecha-abajo', 16) +
        'Ver ' + Math.min(PASO, faltan) + ' más</button></div>';
    }
    return html;
  }

  function htmlFiltros() {
    var listaEquipos = equipos();
    var html = '' +
      '<div class="card ejx-filtros"><div class="card-body stack-sm">' +
        '<div class="input-icono">' + ico('buscar', 17) +
          '<input class="input" id="ejx-buscar" type="search" autocomplete="off" data-buscar ' +
          'aria-label="Buscar ejercicio" placeholder="Busca: sentadilla, espalda, glúteo…" value="' + esc(estado.texto) + '">' +
        '</div>' +
        '<div data-chips>' + htmlChips() + '</div>' +
        '<details class="desplegable plano" data-mas-filtros' + (hayMasFiltros() ? ' open' : '') + '>' +
          '<summary class="desplegable-cab">' + ico('filtro', 18) +
            '<span class="desplegable-titulo">Más filtros</span>' +
            '<span class="desplegable-resumen" data-resumen-filtros>' + esc(textoResumenFiltros()) + '</span>' +
          '</summary>' +
          '<div class="desplegable-cuerpo">' +
            '<div class="form-row">' +
              '<div class="field">' +
                '<label class="label" for="ejx-equipo">Equipo</label>' +
                '<select class="select" id="ejx-equipo" data-equipo>' +
                  '<option value="todos"' + (estado.equipo === 'todos' ? ' selected' : '') + '>Todos los equipos</option>';
    for (var i = 0; i < listaEquipos.length; i++) {
      html += '<option value="' + esc(listaEquipos[i].id) + '"' +
        (estado.equipo === listaEquipos[i].id ? ' selected' : '') + '>' + esc(listaEquipos[i].nombre) + '</option>';
    }
    html += '</select></div>' +
              '<div class="field">' +
                '<label class="label" for="ejx-nivel">Nivel</label>' +
                '<select class="select" id="ejx-nivel" data-nivel>' +
                  '<option value="todos"' + (estado.nivel === 'todos' ? ' selected' : '') + '>Todos los niveles</option>';
    for (var k = 0; k < NIVELES.length; k++) {
      html += '<option value="' + esc(NIVELES[k].id) + '"' +
        (estado.nivel === NIVELES[k].id ? ' selected' : '') + '>' + esc(NIVELES[k].nombre) + '</option>';
    }
    html += '</select></div>' +
              '<button type="button" class="btn btn-ghost" data-limpiar>' + ico('x', 16) + 'Quitar filtros</button>' +
            '</div>' +
          '</div>' +
        '</details>' +
      '</div></div>';
    return html;
  }

  /**
   * Vista principal de la biblioteca (director, coach y socio).
   * @param {Object} ctx { usuario, params, path }
   * @returns {{html:String, listo:Function}}
   */
  function render(ctx) {
    asegurarEstilos();

    var usuario = (ctx && ctx.usuario) ? ctx.usuario : AG.Auth.actual();
    var esSocio = !!(usuario && usuario.rol === 'socio');
    var lista = resultados();

    var subtitulo = esSocio
      ? 'Toca uno para ver cómo se hace y agregarlo a tu día.'
      : 'Toca uno para ver cómo se hace y usarlo en una rutina.';

    var html = '' +
      '<div class="page">' +
        '<div class="page-head">' +
          '<div>' +
            '<h1 class="page-title">' + ico('pesa', 24) + 'Ejercicios</h1>' +
            '<p class="page-sub">' + esc(subtitulo) + '</p>' +
          '</div>' +
          '<div class="page-acciones">' +
            '<span class="pill">' + ico('mancuerna', 14) + '<b>' + AG.Utils.num(catalogo().length, 0) + '</b> ejercicios</span>' +
          '</div>' +
        '</div>' +
        htmlFiltros() +
        '<div class="between wrap">' +
          '<span class="mini muted" data-conteo>' + htmlConteo(lista) + '</span>' +
          '<button type="button" class="btn btn-ghost btn-sm' + (hayFiltros() ? '' : ' oculto') + '" data-limpiar data-limpiar-fuera>' +
            ico('x', 14) + 'Quitar filtros</button>' +
        '</div>' +
        '<div data-resultados>' + htmlResultados(lista) + '</div>' +
      '</div>';

    return {
      html: html,
      listo: function (root) { engancharVista(root); }
    };
  }

  /** Repinta chips, contador y cuadrícula sin tocar el buscador (no pierde el foco). */
  function repintar(root) {
    var lista = resultados();

    var chips = AG.Utils.$('[data-chips]', root);
    if (chips) chips.innerHTML = htmlChips();

    var conteo = AG.Utils.$('[data-conteo]', root);
    if (conteo) conteo.innerHTML = htmlConteo(lista);

    var caja = AG.Utils.$('[data-resultados]', root);
    if (caja) caja.innerHTML = htmlResultados(lista);

    var resumen = AG.Utils.$('[data-resumen-filtros]', root);
    if (resumen) resumen.textContent = textoResumenFiltros();

    var limpiar = AG.Utils.$('[data-limpiar-fuera]', root);
    if (limpiar) limpiar.classList.toggle('oculto', !hayFiltros());
  }

  function engancharVista(root) {
    if (!root) return;

    var campo = AG.Utils.$('[data-buscar]', root);
    if (campo) {
      var buscar = AG.Utils.debounce(function () {
        estado.texto = campo.value || '';
        estado.mostrar = PASO;
        repintar(root);
      }, 220);
      campo.addEventListener('input', buscar);
      campo.addEventListener('search', buscar);
    }

    AG.Utils.delegar(root, 'click', '[data-grupo]', function () {
      var id = this.getAttribute('data-grupo') || 'todos';
      estado.grupo = (estado.grupo === id && id !== 'todos') ? 'todos' : id;
      estado.mostrar = PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'change', '[data-equipo]', function () {
      estado.equipo = this.value || 'todos';
      estado.mostrar = PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'change', '[data-nivel]', function () {
      estado.nivel = this.value || 'todos';
      estado.mostrar = PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'click', '[data-limpiar]', function () {
      estado.texto = '';
      estado.grupo = 'todos';
      estado.equipo = 'todos';
      estado.nivel = 'todos';
      estado.mostrar = PASO;
      if (campo) campo.value = '';
      var selEquipo = AG.Utils.$('[data-equipo]', root);
      if (selEquipo) selEquipo.value = 'todos';
      var selNivel = AG.Utils.$('[data-nivel]', root);
      if (selNivel) selNivel.value = 'todos';
      repintar(root);
    });

    AG.Utils.delegar(root, 'click', '[data-mas]', function () {
      estado.mostrar += PASO;
      repintar(root);
    });

    AG.Utils.delegar(root, 'click', '[data-ej]', function () {
      detalle(this.getAttribute('data-ej'));
    });
  }

  /* =============================================================
     6. Detalle del ejercicio
     ============================================================= */

  /**
   * Series y repeticiones recomendadas por nivel (lo usan las rutinas).
   * @param {String} nivel 'principiante'|'intermedio'|'avanzado'
   * @param {String} tipo  'fuerza'|'hipertrofia'|'cardio'|'movilidad'|'funcional'
   * @returns {{series:Number, reps:String, repsNum:Number, descansoSeg:Number, tempo:String}}
   */
  function sugerencia(nivel, tipo) {
    var porTipo = SUGERENCIAS[tipo] || SUGERENCIAS.hipertrofia;
    var n = nivelInfo(nivel).id || 'intermedio';
    var s = porTipo[n] || porTipo.intermedio;
    return {
      series: s.series,
      reps: s.reps,
      repsNum: s.repsNum,
      descansoSeg: s.descansoSeg,
      tempo: s.tempo
    };
  }

  /**
   * Recomendación según el OBJETIVO del socio que abre el detalle.
   * @param {Object} ej ejercicio
   * @param {Object} usuario quien lo abre (puede ser null)
   * @param {String} [objetivoForzado] 'fuerza'|'hipertrofia'|'resistencia'
   * @returns {{ modo:'reps'|'tiempo', objetivoId:String, series:Number, reps:String,
   *             repsNum:Number, descansoSeg:Number, etiqueta:String }}
   */
  function recomendacion(ej, usuario, objetivoForzado) {
    var tipo = ej ? String(ej.tipo || '') : '';
    var nivel = nivelDe(usuario);

    if (tipo === 'cardio' || tipo === 'movilidad') {
      var base = sugerencia(nivel, tipo);
      return {
        modo: 'tiempo',
        objetivoId: '',
        series: base.series,
        reps: base.reps,
        repsNum: base.repsNum,
        descansoSeg: base.descansoSeg,
        etiqueta: base.tempo
      };
    }

    var objetivoId = objetivoInfo(objetivoForzado) ? objetivoForzado : objetivoDe(usuario);
    if (!objetivoId && usuario && usuario.rol === 'socio') objetivoId = 'hipertrofia';
    var o = objetivoInfo(objetivoId) || objetivoInfo('hipertrofia');
    var series = nivel === 'principiante' ? 3 : (nivel === 'avanzado' ? o.seriesMax : o.series);

    return {
      modo: 'reps',
      objetivoId: objetivoId,
      series: series,
      reps: o.reps,
      repsNum: o.repsNum,
      descansoSeg: o.descansoSeg,
      etiqueta: o.nota
    };
  }

  /** Tres ejercicios parecidos: mismo patrón primero, luego mismo grupo. */
  function alternativas(ej, cuantas) {
    var n = Number(cuantas) > 0 ? Number(cuantas) : 3;
    var patron = patronDe(ej);
    var candidatos = filtrar({ grupo: ej.grupo });
    var puntuados = [];
    var vistos = {};

    function considerar(o) {
      if (!o || o.id === ej.id || vistos[o.id]) return;
      vistos[o.id] = true;
      var p = 0;
      if (patron && patronDe(o) === patron) p += 4;   // mismo movimiento
      if (o.grupo === ej.grupo) p += 3;               // mismo grupo principal
      else if (esDelGrupo(o, ej.grupo)) p += 1;
      if (o.nivel === ej.nivel) p += 2;               // exigencia parecida
      if (o.equipo !== ej.equipo) p += 1;             // variedad de material
      if (o.tipo === ej.tipo) p += 1;                 // mismo propósito
      puntuados.push({ ej: o, p: p });
    }

    for (var i = 0; i < candidatos.length; i++) considerar(candidatos[i]);

    // Si el grupo es chico, se buscan más del mismo patrón en todo el catálogo
    if (puntuados.length < n && patron) {
      var todos = catalogo();
      for (var k = 0; k < todos.length; k++) {
        if (patronDe(todos[k]) === patron) considerar(todos[k]);
      }
    }

    puntuados.sort(function (a, b) {
      if (a.p !== b.p) return b.p - a.p;
      var na = String(a.ej.nombre || ''), nb = String(b.ej.nombre || '');
      return na < nb ? -1 : (na > nb ? 1 : 0);
    });

    return puntuados.slice(0, n).map(function (x) { return x.ej; });
  }

  function htmlEncabezado(icono, texto) {
    return '<div class="ejx-h">' + ico(icono, 15) + esc(texto) + '</div>';
  }

  /** Ilustración grande con el pie "Así se hace". */
  function htmlHero(ej) {
    return '<figure class="ilustra ejx-hero" data-patron="' + esc(patronDe(ej)) + '">' +
      svgDe(ej, { alto: 240, animado: true }) +
      '<figcaption class="ilustra-cap"><b>Así se hace</b></figcaption>' +
      '</figure>';
  }

  /** Tres datos: músculo principal, equipo y nivel. */
  function htmlTiles(ej) {
    var g = datosGrupo(ej.grupo);
    var color = colorGrupo(ej.grupo);
    var nv = nivelInfo(ej.nivel);
    var musculos = musculosDe(ej.musculos);
    if (!musculos.length) musculos = musculosDe(infoIlustra(ej).musculos);
    var principal = musculos.length ? musculos[0] : g.nombre;
    var iconoEquipo = ICONO_EQUIPO[String(ej.equipo || '')] || 'mancuerna';

    return '<div class="tiles tiles-3 ejx-tiles">' +
      '<div class="tile">' +
        '<span class="tile-icono" style="color:' + esc(color) + ';background:' + rgba(color, 0.14) + ';border-color:' + rgba(color, 0.28) + '">' + ico(g.icono, 18) + '</span>' +
        '<span class="tile-datos"><span class="tile-val">' + esc(principal) + '</span><span class="tile-label">músculo principal</span></span>' +
      '</div>' +
      '<div class="tile neutro">' +
        '<span class="tile-icono">' + ico(iconoEquipo, 18) + '</span>' +
        '<span class="tile-datos"><span class="tile-val">' + esc(nombreEquipo(ej.equipo)) + '</span><span class="tile-label">equipo</span></span>' +
      '</div>' +
      '<div class="tile ' + esc(nv.tile) + '">' +
        '<span class="tile-icono">' + ico('meta', 18) + '</span>' +
        '<span class="tile-datos"><span class="tile-val">' + esc(nv.nombre) + '</span><span class="tile-label">nivel</span></span>' +
      '</div>' +
      '</div>';
  }

  /** Pasos numerados (3-4), cada uno con su acción en negritas. */
  function htmlPasos(ej) {
    var pasos = pasosDe(ej.instrucciones, 4);
    var html = htmlEncabezado('reporte', 'Cómo hacerlo');
    if (!pasos.length) {
      return html + '<p class="mini muted">Pide a tu coach que te muestre la técnica antes de hacerlo.</p>';
    }
    html += '<ol class="pasos ejx-pasos">';
    for (var i = 0; i < pasos.length; i++) {
      html += '<li class="paso"><span class="paso-num"></span>' +
        '<span class="paso-txt"><b>' + esc(pasos[i].titulo) + '</b>' +
        (pasos[i].detalle ? '<small>' + esc(pasos[i].detalle) + '</small>' : '') +
        '</span></li>';
    }
    return html + '</ol>';
  }

  /** Máximo dos avisos cortos: el del ejercicio y el del patrón. */
  function htmlCuida(ej) {
    var lista = [];
    var propio = String(ej.consejos || '').trim();
    var delPatron = String(infoIlustra(ej).consejo || '').trim();
    if (propio) lista.push(propio);
    if (delPatron && normalizar(delPatron) !== normalizar(propio)) lista.push(delPatron);
    if (!lista.length) lista.push('Ve despacio y con control: la técnica manda sobre el peso.');
    lista = lista.slice(0, 2);

    var html = htmlEncabezado('alerta', 'Cuida esto') + '<ul class="ejx-cuida">';
    for (var i = 0; i < lista.length; i++) {
      html += '<li>' + ico('alerta', 17) + '<span>' + esc(lista[i]) + '</span></li>';
    }
    return html + '</ul>';
  }

  /** Bloque visual de series y repeticiones según el objetivo. */
  function htmlSeries(ej, usuario, objetivoForzado) {
    var rec = recomendacion(ej, usuario, objetivoForzado);
    var html = htmlEncabezado('historial', 'Cuántas series y repeticiones');

    if (rec.modo === 'tiempo') {
      var esCardio = String(ej.tipo) === 'cardio';
      var valor = esCardio ? rec.repsNum + ' min' : (String(rec.reps).split(' ')[0] || '30') + ' s';
      var etiqueta = esCardio
        ? (rec.series > 1 ? rec.series + ' bloques · ' + rec.etiqueta : 'a un ritmo que te deje platicar')
        : 'por lado, sin rebotes';
      html += '<div class="ejx-reps ejx-reps-1"><div class="ejx-rep on">' +
        '<span class="ejx-rep-tag">Para ti</span>' +
        '<span class="ejx-rep-obj">' + esc(nombreTipo(ej.tipo)) + '</span>' +
        '<span class="ejx-rep-val">' + esc(valor) + '</span>' +
        '<span class="ejx-rep-lab">' + esc(etiqueta) + '</span>' +
        '</div></div>';
      html += '<div class="ejx-series">' +
        '<span>' + ico('historial', 15) + '<b>' + rec.series + '</b> ' + (rec.series === 1 ? 'serie' : 'series') + '</span>' +
        (rec.descansoSeg ? '<span>' + ico('reloj', 15) + 'descansa <b>' + esc(textoDescanso(rec.descansoSeg)) + '</b> entre series</span>' : '') +
        '</div>';
      return html;
    }

    html += '<div class="ejx-reps">';
    for (var i = 0; i < OBJETIVOS.length; i++) {
      var o = OBJETIVOS[i];
      var on = o.id === rec.objetivoId;
      html += '<div class="ejx-rep' + (on ? ' on' : '') + '"' + (on ? ' aria-current="true"' : '') + '>' +
        (on ? '<span class="ejx-rep-tag">Para ti</span>' : '') +
        '<span class="ejx-rep-obj">' + esc(o.nombre) + '</span>' +
        '<span class="ejx-rep-val">' + esc(o.reps) + '</span>' +
        '<span class="ejx-rep-lab">repeticiones</span>' +
        '<span class="ejx-rep-desc">' + ico('reloj', 12) + esc(textoDescanso(o.descansoSeg)) + '</span>' +
        '</div>';
    }
    html += '</div>';

    html += '<div class="ejx-series">' +
      (rec.objetivoId
        ? '<span>' + ico('historial', 15) + '<b>' + rec.series + '</b> series</span>' +
          '<span>' + ico('reloj', 15) + 'descansa <b>' + esc(textoDescanso(rec.descansoSeg)) + '</b> entre series</span>'
        : '<span>' + ico('historial', 15) + '<b>3-4</b> series</span>' +
          '<span>' + ico('info', 15) + 'se resalta según el objetivo del socio</span>') +
      '</div>';
    return html;
  }

  /** Tres ejercicios parecidos con su mini ilustración. */
  function htmlAlternativas(ej) {
    var lista = alternativas(ej, 3);
    var html = htmlEncabezado('mancuerna', 'Ejercicios parecidos');
    if (!lista.length) {
      return html + '<p class="mini muted">Por ahora no hay otro ejercicio parecido en la biblioteca.</p>';
    }
    html += '<div class="ejx-alts">';
    for (var i = 0; i < lista.length; i++) {
      var o = lista[i];
      html += '<button type="button" class="ejx-alt" data-alt="' + esc(o.id) + '" title="Ver cómo se hace: ' + esc(o.nombre) + '">' +
        '<span class="ilustra-mini grande" aria-hidden="true">' + svgDe(o, { alto: 84, animado: false, fase: 'fin', fondo: false }) + '</span>' +
        '<span class="ejx-alt-nombre">' + esc(o.nombre) + '</span>' +
        '<span class="ejx-alt-sub">' + esc(nombreEquipo(o.equipo)) + '</span>' +
        '</button>';
    }
    return html + '</div>';
  }

  function htmlDetalle(ej, usuario, opts) {
    var o = opts || {};
    return '<div class="stack ejx-detalle">' +
      htmlHero(ej) +
      htmlTiles(ej) +
      '<div>' + htmlPasos(ej) + '</div>' +
      '<div>' + htmlCuida(ej) + '</div>' +
      '<div>' + htmlSeries(ej, usuario, o.objetivo) + '</div>' +
      '<div>' + htmlAlternativas(ej) + '</div>' +
      '</div>';
  }

  /**
   * Modal visual con la técnica de un ejercicio.
   * @param {String} ejercicioId
   * @param {Object} [opts] { objetivo:'fuerza'|'hipertrofia'|'resistencia', usuario }
   * @returns {Object|null} api del modal
   */
  function detalle(ejercicioId, opts) {
    asegurarEstilos();
    var o = opts || {};

    var ej = ejercicioDe(ejercicioId);
    if (!ej) {
      toast('No encontramos ese ejercicio en la biblioteca', 'error');
      return null;
    }

    var usuario = o.usuario || AG.Auth.actual();
    var acciones = [{ texto: 'Cerrar', clase: 'btn-ghost' }];

    if (usuario && usuario.rol === 'socio') {
      acciones.push({
        texto: 'Agregar a mi registro de hoy',
        clase: 'btn-primary',
        icono: 'mas',
        onClick: function (api) {
          if (agregarABitacora(ej, usuario)) api.cerrar();
        }
      });
    } else if (usuario && (usuario.rol === 'coach' || usuario.rol === 'director')) {
      acciones.push({
        texto: 'Usar en rutina',
        clase: 'btn-primary',
        icono: 'check',
        onClick: function (api) {
          usarEnRutina(ej, usuario);
          api.cerrar();
        }
      });
    }

    var cuerpo;
    try { cuerpo = htmlDetalle(ej, usuario, o); }
    catch (e) {
      cuerpo = '<div class="stack-sm">' +
        (ej.instrucciones ? '<p>' + esc(ej.instrucciones) + '</p>' : '') +
        (ej.consejos ? '<div class="aviso aviso-warn">' + ico('alerta', 17) + '<div>' + esc(ej.consejos) + '</div></div>' : '') +
        '</div>';
    }

    return AG.Utils.modal({
      titulo: ej.nombre,
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: acciones,
      onOpen: function (raiz, api) {
        AG.Utils.delegar(raiz, 'click', '[data-alt]', function () {
          var otro = this.getAttribute('data-alt');
          api.cerrar();
          detalle(otro, o);
        });
      }
    });
  }

  /* =============================================================
     7. Acciones sobre los datos
     ============================================================= */

  /**
   * Bloque listo para pegarse en un día de rutina.
   * @returns {Object|null} { ejercicioId, nombre, grupo, series, reps, descansoSeg, tempo, peso, notas }
   */
  function paraRutina(ejercicioId, nivel) {
    var ej = ejercicioDe(ejercicioId);
    if (!ej) return null;
    var s = sugerencia(nivel || nivelDe(AG.Auth.actual()), ej.tipo);
    return {
      ejercicioId: ej.id,
      nombre: ej.nombre,
      grupo: ej.grupo,
      series: s.series,
      reps: s.reps,
      descansoSeg: s.descansoSeg,
      tempo: s.tempo,
      peso: '',
      notas: ''
    };
  }

  /** Guarda el ejercicio en el portapapeles del constructor de rutinas. */
  function usarEnRutina(ej, usuario) {
    if (!usuario || (usuario.rol !== 'coach' && usuario.rol !== 'director')) {
      toast('Solo dirección y los coaches arman rutinas', 'warn');
      return false;
    }
    var bloque = paraRutina(ej.id, '');
    if (!bloque) {
      toast('No pudimos preparar ese ejercicio', 'error');
      return false;
    }
    Mod.ultimoSeleccionado = bloque;
    toast('«' + ej.nombre + '» quedó listo: ábrelo desde Rutinas para agregarlo al día', 'ok');
    return true;
  }

  /** Entrega el ejercicio copiado y limpia el portapapeles. */
  function tomarSeleccionado() {
    var bloque = Mod.ultimoSeleccionado;
    Mod.ultimoSeleccionado = null;
    return bloque;
  }

  /**
   * Crea o actualiza la bitácora de hoy del socio con este ejercicio.
   * Las series se arman con la recomendación de su objetivo (la misma
   * que vio en el detalle). Si ya tiene rutina activa, el ejercicio
   * entra como extra dentro de la misma sesión del día.
   * @returns {Boolean} true si la bitácora quedó guardada
   */
  function agregarABitacora(ej, usuario) {
    if (!usuario || usuario.rol !== 'socio') {
      toast('Solo los socios llevan registro de entrenamiento', 'warn');
      return false;
    }
    // El socio únicamente puede tocar su propia bitácora.
    if (!AG.Auth.puedeVer(usuario, usuario.id)) {
      toast('No tienes permiso para modificar ese registro', 'error');
      return false;
    }

    var hoy = AG.Utils.hoy();
    var previas = AG.DB.donde('bitacoras', function (b) {
      return b && b.socioId === usuario.id && String(b.fecha || '').slice(0, 10) === hoy;
    });
    var bitacora = previas.length ? previas[0] : null;

    var rec = recomendacion(ej, usuario);
    var series = [];
    for (var i = 0; i < rec.series; i++) {
      series.push({ reps: rec.repsNum, peso: 0, hecho: false });
    }

    if (bitacora) {
      var lista = esArreglo(bitacora.ejercicios) ? bitacora.ejercicios.slice() : [];

      for (var j = 0; j < lista.length; j++) {
        if (lista[j] && lista[j].ejercicioId === ej.id) {
          toast('«' + ej.nombre + '» ya estaba en tu registro de hoy', 'info');
          return false;
        }
      }

      lista.push({ ejercicioId: ej.id, series: series });
      AG.DB.actualizar('bitacoras', bitacora.id, { ejercicios: lista });
      toast('Agregamos «' + ej.nombre + '» a tu registro de hoy', 'ok');
    } else {
      var rutinaId = null;
      var diaIndex = 0;
      var activa = AG.DB.rutinaActivaDe(usuario.id);

      if (activa && activa.rutina) {
        rutinaId = activa.rutina.id;
        var dias = esArreglo(activa.rutina.dias) ? activa.rutina.dias.length : 0;
        if (dias > 0) {
          // Se rota el día de la rutina según las sesiones ya registradas con ella.
          var hechas = AG.DB.donde('bitacoras', function (b) {
            return b && b.socioId === usuario.id && b.rutinaId === rutinaId;
          }).length;
          diaIndex = hechas % dias;
        }
      }

      AG.DB.insertar('bitacoras', {
        socioId: usuario.id,
        fecha: hoy,
        rutinaId: rutinaId,
        diaIndex: diaIndex,
        ejercicios: [{ ejercicioId: ej.id, series: series }],
        duracionMin: 0,
        esfuerzo: 5,
        notas: 'Ejercicio agregado desde la biblioteca',
        completada: false
      });
      toast('Creamos tu registro de hoy con «' + ej.nombre + '»', 'ok');
    }

    AG.Router.refrescar();
    return true;
  }

  /* =============================================================
     8. Selector compacto (lo usa el constructor de rutinas)
     ============================================================= */

  function htmlSelChips(f) {
    var base = filtrar({ texto: f.texto });
    var lista = grupos();
    var html = '<button type="button" class="chip chip-sm' + (f.grupo === 'todos' ? ' on' : '') +
      '" data-selgrupo="todos">' + ico('pesa', 14) + 'Todos <span class="ejx-n">' + base.length + '</span></button>';

    for (var i = 0; i < lista.length; i++) {
      var g = lista[i];
      var n = 0;
      for (var j = 0; j < base.length; j++) {
        if (esDelGrupo(base[j], g.id)) n++;
      }
      var activo = f.grupo === g.id;
      html += '<button type="button" class="chip chip-sm' + (activo ? ' on' : '') + '" data-selgrupo="' + esc(g.id) + '"' +
        (n === 0 && !activo ? ' disabled' : '') + '>' +
        '<span class="ejx-chip-ico" style="color:' + esc(colorGrupo(g.id)) + '">' + ico(g.icono, 14) + '</span>' +
        esc(g.nombre) + '</button>';
    }
    return html;
  }

  function htmlSelLista(lista, elegidos, multiple, mostrar) {
    if (!lista.length) {
      return '<div class="empty"><div class="empty-icono">' + ico('buscar', 26) + '</div>' +
        '<p class="empty-texto">Nada coincide con esa búsqueda. Prueba con otra palabra o cambia de grupo.</p></div>';
    }

    var tope = Math.min(lista.length, Number(mostrar) > 0 ? Number(mostrar) : PASO_SEL);
    var html = '';
    for (var i = 0; i < tope; i++) {
      var ej = lista[i];
      var marcado = elegidos.indexOf(ej.id) !== -1;
      html += '<button type="button" class="list-item clickable ejx-sel" data-sel="' + esc(ej.id) + '" ' +
        'aria-pressed="' + (marcado ? 'true' : 'false') + '">' +
        '<span class="ilustra-mini" aria-hidden="true">' + svgDe(ej, { alto: 56, animado: false, fase: 'fin', fondo: false }) + '</span>' +
        '<span class="list-item-main"><b>' + esc(ej.nombre) + '</b>' +
          '<span>' + esc(datosGrupo(ej.grupo).nombre) + ' · ' + esc(nombreEquipo(ej.equipo)) + '</span>' +
        '</span>' +
        '<span class="list-item-side">' +
          (multiple
            ? (marcado ? '<span class="txt-ok">' + ico('check', 18) + '</span>' : ico('mas', 18))
            : ico('flecha-der', 16)) +
        '</span>' +
      '</button>';
    }

    if (lista.length > tope) {
      html += '<div class="center" style="padding:10px 0 4px">' +
        '<button type="button" class="btn btn-outline btn-sm" data-selmas>' + ico('flecha-abajo', 14) +
        'Ver ' + Math.min(PASO_SEL, lista.length - tope) + ' más</button></div>';
    }
    return html;
  }

  /**
   * Modal buscador compacto para elegir ejercicios (con mini ilustración).
   * @param {Function} callback recibe el ejercicio (o un array si opts.multiple)
   * @param {Object} [opts] { multiple:Boolean, titulo:String, grupo:String,
   *                          seleccionados:[ids], textoAccion:String }
   * @returns {Object|null} api del modal
   */
  function selector(callback, opts) {
    asegurarEstilos();

    if (typeof callback !== 'function') {
      toast('El selector de ejercicios se abrió sin destino', 'error');
      return null;
    }
    if (!catalogo().length) {
      toast('La biblioteca de ejercicios no está disponible', 'error');
      return null;
    }

    var o = opts || {};
    var multiple = !!o.multiple;
    var elegidos = [];

    if (esArreglo(o.seleccionados)) {
      for (var i = 0; i < o.seleccionados.length; i++) {
        var id = String(o.seleccionados[i] || '');
        if (id && elegidos.indexOf(id) === -1 && ejercicioDe(id)) elegidos.push(id);
      }
    }

    var f = { texto: '', grupo: 'todos', mostrar: PASO_SEL };
    if (o.grupo && datosGrupo(o.grupo).id === o.grupo) f.grupo = o.grupo;

    function lista() {
      return filtrar({ texto: f.texto, grupo: f.grupo });
    }

    var inicial = lista();

    var cuerpo = '' +
      '<div class="stack-sm">' +
        '<div class="input-icono">' + ico('buscar', 17) +
          '<input class="input" type="search" autocomplete="off" data-selbuscar autofocus ' +
          'aria-label="Buscar ejercicio" placeholder="Busca por nombre o músculo…">' +
        '</div>' +
        '<div class="chips" data-selchips>' + htmlSelChips(f) + '</div>' +
        '<div class="between wrap mini muted">' +
          '<span data-selconteo>' + esc(inicial.length === 1 ? '1 ejercicio' : inicial.length + ' ejercicios') + '</span>' +
          (multiple ? '<span data-selelegidos>' + esc(elegidos.length === 1 ? '1 seleccionado' : elegidos.length + ' seleccionados') + '</span>' : '') +
        '</div>' +
        '<div class="list ejx-lista" data-sellista>' + htmlSelLista(inicial, elegidos, multiple, f.mostrar) + '</div>' +
      '</div>';

    var acciones = [{ texto: 'Cancelar', clase: 'btn-ghost' }];
    if (multiple) {
      acciones.push({
        texto: o.textoAccion || 'Agregar seleccionados',
        clase: 'btn-primary',
        icono: 'check',
        onClick: function (api) {
          if (!elegidos.length) {
            toast('Selecciona al menos un ejercicio', 'warn');
            return;
          }
          var salida = [];
          for (var k = 0; k < elegidos.length; k++) {
            var ejSel = ejercicioDe(elegidos[k]);
            if (ejSel) salida.push(ejSel);
          }
          api.cerrar();
          callback(salida);
        }
      });
    }

    var api = AG.Utils.modal({
      titulo: o.titulo || (multiple ? 'Elegir ejercicios' : 'Elegir ejercicio'),
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: acciones,
      onOpen: function (raiz, apiModal) {

        function actualizarContador() {
          if (!multiple) return;
          var marca = AG.Utils.$('[data-selelegidos]', raiz);
          if (marca) {
            marca.innerHTML = esc(elegidos.length === 1 ? '1 seleccionado' : elegidos.length + ' seleccionados');
          }
        }

        function repintarLista() {
          var actual = lista();
          var chips = AG.Utils.$('[data-selchips]', raiz);
          if (chips) chips.innerHTML = htmlSelChips(f);
          var conteo = AG.Utils.$('[data-selconteo]', raiz);
          if (conteo) {
            conteo.innerHTML = esc(actual.length === 1 ? '1 ejercicio' : actual.length + ' ejercicios');
          }
          var caja = AG.Utils.$('[data-sellista]', raiz);
          if (caja) caja.innerHTML = htmlSelLista(actual, elegidos, multiple, f.mostrar);
          actualizarContador();
        }

        function elegir(idEj) {
          var ejSel = ejercicioDe(idEj);
          if (!ejSel) return;

          if (!multiple) {
            apiModal.cerrar();
            callback(ejSel);
            return;
          }

          var pos = elegidos.indexOf(idEj);
          if (pos === -1) elegidos.push(idEj);
          else elegidos.splice(pos, 1);

          var boton = AG.Utils.$('[data-sel="' + idEj + '"]', raiz);
          if (boton) {
            var marcado = elegidos.indexOf(idEj) !== -1;
            boton.setAttribute('aria-pressed', marcado ? 'true' : 'false');
            var lado = AG.Utils.$('.list-item-side', boton);
            if (lado) {
              lado.innerHTML = marcado ? '<span class="txt-ok">' + ico('check', 18) + '</span>' : ico('mas', 18);
            }
          }
          actualizarContador();
        }

        var campo = AG.Utils.$('[data-selbuscar]', raiz);
        if (campo) {
          var buscar = AG.Utils.debounce(function () {
            f.texto = campo.value || '';
            f.mostrar = PASO_SEL;
            repintarLista();
          }, 180);
          campo.addEventListener('input', buscar);
          campo.addEventListener('search', buscar);
          campo.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.keyCode !== 13) return;
            e.preventDefault();
            var actual = lista();
            if (actual.length) elegir(actual[0].id);
          });
        }

        AG.Utils.delegar(raiz, 'click', '[data-selgrupo]', function () {
          var g = this.getAttribute('data-selgrupo') || 'todos';
          f.grupo = (f.grupo === g && g !== 'todos') ? 'todos' : g;
          f.mostrar = PASO_SEL;
          repintarLista();
        });

        AG.Utils.delegar(raiz, 'click', '[data-selmas]', function () {
          f.mostrar += PASO_SEL;
          repintarLista();
        });

        AG.Utils.delegar(raiz, 'click', '[data-sel]', function () {
          elegir(this.getAttribute('data-sel'));
        });
      }
    });

    return api;
  }

  /* =============================================================
     9. Enganche global: cualquier [data-ejx-detalle] abre el detalle
     ============================================================= */

  var globalListo = false;

  function engancharGlobal() {
    if (globalListo) return;
    try {
      if (typeof document === 'undefined' || !document.addEventListener) return;
      globalListo = true;
      document.addEventListener('click', function (e) {
        var el = (e.target && e.target.closest) ? e.target.closest('[data-ejx-detalle]') : null;
        if (!el) return;
        e.preventDefault();
        detalle(el.getAttribute('data-ejx-detalle'));
      });
    } catch (e) {
      globalListo = false;
    }
  }

  /* =============================================================
     10. Exportación y rutas
     ============================================================= */

  var Mod = {
    render: render,
    detalle: detalle,
    selector: selector,
    mini: mini,
    tarjeta: tarjeta,
    sugerencia: sugerencia,
    recomendacion: recomendacion,
    paraRutina: paraRutina,
    tomarSeleccionado: tomarSeleccionado,
    pasosDe: pasosDe,
    OBJETIVOS: OBJETIVOS,
    ultimoSeleccionado: null
  };

  AG.Mod.Ejercicios = Mod;

  engancharGlobal();

  AG.Router.registrar({
    path: 'director/ejercicios',
    roles: ['director'],
    titulo: 'Ejercicios',
    nav: { etiqueta: 'Ejercicios', icono: 'pesa', grupo: 'Entrenamiento', orden: 5 },
    render: render
  });

  AG.Router.registrar({
    path: 'coach/ejercicios',
    roles: ['coach'],
    titulo: 'Ejercicios',
    nav: { etiqueta: 'Ejercicios', icono: 'pesa', grupo: 'Entrenamiento', orden: 6 },
    render: render
  });

  AG.Router.registrar({
    path: 'socio/ejercicios',
    roles: ['socio'],
    titulo: 'Ejercicios',
    nav: { etiqueta: 'Ejercicios', icono: 'pesa', grupo: 'Mi entrenamiento', orden: 6 },
    render: render
  });

})(window.AG);
