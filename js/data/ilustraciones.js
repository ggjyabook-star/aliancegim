/* =============================================================
   ALLIANCE GYM — Ilustraciones de ejercicios (AG.Ilustra)
   -------------------------------------------------------------
   Pictogramas SVG dibujados a mano, sin librerías ni red. Cada
   patrón de movimiento tiene DOS fases (inicio y fin) y, con
   animado:true, alternan con un fundido suave para DEMOSTRAR el
   ejercicio sin que el socio tenga que leer.

   API pública (todas devuelven STRING con <svg>, nunca vacío):
     AG.Ilustra.get(ejercicioId, opts)     -> ilustración del ejercicio
     AG.Ilustra.porPatron(patronId, opts)  -> ilustración de un patrón
     AG.Ilustra.patronDe(ejercicioId)      -> 'sentadilla' | 'press_banca' | ...
     AG.Ilustra.info(ejercicioId)          -> { patron, nombre, musculos, consejo }
     AG.Ilustra.figura(ejercicioId, opts)  -> <figure class="ilustra"> con pie
     AG.Ilustra.auditar()                  -> { sinPatron, porPatron, total }
     AG.Ilustra.PATRONES                   -> { id: { nombre, musculos, consejo, dibujo(fase) } }
     AG.Ilustra.lista                      -> [ids de patrón]

   opts = { alto:180, animado:true, fase:'ambas'|'inicio'|'fin',
            color, fondo:true, id }

   Convenciones del dibujo (viewBox 0 0 200 200):
     - Figura en var(--texto), equipo en var(--rojo), piso y guías en var(--borde).
     - Trazo 8 en extremidades, torso de 16 con puntas redondas, cabeza r 9.5.
     - La figura mira a la derecha en la vista lateral.
   Depende sólo de AG.Utils (de forma defensiva) y de AG.Data.exercises.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  var I = {};

  /* =============================================================
     0. Constantes y ayudantes básicos
     ============================================================= */

  var VB = 200;             // lado del viewBox
  var SUELO = 174;          // línea de piso por defecto
  var ALTO_DEF = 180;       // altura por defecto en px
  var CICLO = 3.2;          // segundos por ciclo completo (1.6 s cada fase)
  var ID_ESTILOS = 'ag-ilustra-estilos';

  var COL = {
    fig:   'var(--texto,#F2F3F5)',
    eq:    'var(--rojo,#E4322B)',
    guia:  'var(--borde,#2B2F36)',
    suave: 'var(--texto-3,#6E7681)'
  };

  var G = { ext: 8, torso: 16, cuello: 8, cab: 9.5, mano: 4.5, pie: 12, lejos: 0.42 };

  var secuencia = 0;
  function nid() { secuencia += 1; return 'agil' + secuencia; }

  function esc(v) {
    var t = (v === null || v === undefined) ? '' : String(v);
    if (AG.Utils && typeof AG.Utils.esc === 'function') {
      try { return String(AG.Utils.esc(t)); } catch (e) { /* respaldo abajo */ }
    }
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizar(texto) {
    var t = (texto === null || texto === undefined) ? '' : String(texto);
    if (AG.Utils && typeof AG.Utils.normalizar === 'function') {
      try { return AG.Utils.normalizar(t); } catch (e) { /* respaldo abajo */ }
    }
    t = t.toLowerCase();
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch (e) {
      t = t.replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
           .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
    }
    return t.trim();
  }

  function r1(v) { var n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }
  function pt(p) { return r1(p[0]) + ' ' + r1(p[1]); }
  function pts(lista) {
    var s = [];
    for (var i = 0; i < lista.length; i++) s.push(r1(lista[i][0]) + ',' + r1(lista[i][1]));
    return s.join(' ');
  }
  function suma(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mezcla(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  /* Color de figura seguro: acepta #hex, rgb(), var(--x) o nombre. */
  function colorSeguro(color, alterno) {
    if (typeof color !== 'string') return alterno;
    var t = color.trim();
    if (!t) return alterno;
    if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
    if (/^(rgb|hsl)a?\([0-9a-zA-Z%.,\s\/-]+\)$/.test(t)) return t;
    if (/^var\(\s*--[a-zA-Z0-9_-]+\s*(,[^;{}<>]*)?\)$/.test(t)) return t;
    if (/^[a-zA-Z]{3,22}$/.test(t)) return t;
    return alterno;
  }

  /* =============================================================
     1. Primitivas SVG
     ============================================================= */

  function linea(a, b, color, ancho, extra) {
    return '<line x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) +
      '" stroke="' + color + '" stroke-width="' + (ancho || G.ext) + '"' + (extra ? ' ' + extra : '') + '/>';
  }

  function poli(lista, color, ancho, extra) {
    return '<polyline points="' + pts(lista) + '" fill="none" stroke="' + color +
      '" stroke-width="' + (ancho || G.ext) + '"' + (extra ? ' ' + extra : '') + '/>';
  }

  function circulo(c, r, relleno, extra) {
    return '<circle cx="' + r1(c[0]) + '" cy="' + r1(c[1]) + '" r="' + r1(r) + '" fill="' + relleno + '"' +
      (extra ? ' ' + extra : '') + '/>';
  }

  function anillo(c, r, color, ancho, extra) {
    return '<circle cx="' + r1(c[0]) + '" cy="' + r1(c[1]) + '" r="' + r1(r) + '" fill="none" stroke="' + color +
      '" stroke-width="' + (ancho || 6) + '"' + (extra ? ' ' + extra : '') + '/>';
  }

  function rect(x, y, w, h, relleno, rx, extra) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) +
      '" rx="' + r1(rx === undefined ? 3 : rx) + '" fill="' + relleno + '"' + (extra ? ' ' + extra : '') + '/>';
  }

  function ruta(d, color, ancho, relleno, extra) {
    return '<path d="' + d + '" fill="' + (relleno || 'none') + '" stroke="' + (color || 'none') +
      '" stroke-width="' + (ancho || 0) + '"' + (extra ? ' ' + extra : '') + '/>';
  }

  function grupo(contenido, extra) {
    return '<g' + (extra ? ' ' + extra : '') + '>' + contenido + '</g>';
  }

  /* =============================================================
     2. La figura humana
     -------------------------------------------------------------
     Vista LATERAL: persona(p, color)
       p = { hom:[x,y], cad:[x,y], cab:[x,y]?, curva:[x,y]? (control del torso),
             brazos:  [ [codo, mano, {lejos, sinMano}] ... ],
             piernas: [ [rodilla, pie, {lejos, sinPie, dir:1|-1, punta:[x,y]}] ... ] }
       La cabeza se calcula sola siguiendo el eje del torso (cuello neutro)
       salvo que se indique cab. Las extremidades "lejos" van detrás y tenues.

     Vista FRONTAL: frente(p, color)
       p = { cx, cabY, homY, cadY,
             brazoI:[codo, mano, opts], brazoD:[...],
             piernaI:[rodilla, pie, opts], piernaD:[...] }
     ============================================================= */

  function brazo(hom, b, color) {
    if (!b) return '';
    var o = b[2] || {};
    var s = poli([hom, b[0], b[1]], color, G.ext);
    if (!o.sinMano) s += circulo(b[1], G.mano, color);
    return o.lejos ? grupo(s, 'opacity="' + G.lejos + '"') : s;
  }

  function pierna(cad, p, color) {
    if (!p) return '';
    var o = p[2] || {};
    var s = poli([cad, p[0], p[1]], color, G.ext);
    if (!o.sinPie) {
      if (o.punta) s += linea(p[1], o.punta, color, G.ext);
      else s += linea(p[1], [p[1][0] + G.pie * (o.dir || 1), p[1][1]], color, G.ext);
    }
    return o.lejos ? grupo(s, 'opacity="' + G.lejos + '"') : s;
  }

  function persona(p, color) {
    var col = color || COL.fig;
    var hom = p.hom, cad = p.cad;
    var dx = hom[0] - cad[0], dy = hom[1] - cad[1];
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L;
    var cab = p.cab || [hom[0] + ux * 21, hom[1] + uy * 21];
    var cuello = p.cab ? mezcla(hom, cab, 0.55) : [hom[0] + ux * 11, hom[1] + uy * 11];
    var brazos = p.brazos || [];
    var piernas = p.piernas || [];
    var i, s = '';

    // Extremidades lejanas primero (quedan detrás del cuerpo)
    for (i = 0; i < piernas.length; i++) if (piernas[i] && piernas[i][2] && piernas[i][2].lejos) s += pierna(cad, piernas[i], col);
    for (i = 0; i < brazos.length; i++) if (brazos[i] && brazos[i][2] && brazos[i][2].lejos) s += brazo(hom, brazos[i], col);

    // Piernas cercanas
    for (i = 0; i < piernas.length; i++) if (piernas[i] && !(piernas[i][2] && piernas[i][2].lejos)) s += pierna(cad, piernas[i], col);

    // Torso (recto o curvo, para espaldas redondeadas), cuello y cabeza
    if (p.curva) s += ruta('M' + pt(hom) + ' Q' + pt(p.curva) + ' ' + pt(cad), col, G.torso);
    else s += linea(hom, cad, col, G.torso);
    s += linea(hom, cuello, col, G.cuello);
    s += circulo(cab, G.cab, col);

    // Brazos cercanos (delante del torso)
    for (i = 0; i < brazos.length; i++) if (brazos[i] && !(brazos[i][2] && brazos[i][2].lejos)) s += brazo(hom, brazos[i], col);

    return s;
  }

  function frente(p, color) {
    var col = color || COL.fig;
    var cx = p.cx === undefined ? 100 : p.cx;
    var cabY = p.cabY === undefined ? 42 : p.cabY;
    var homY = p.homY === undefined ? 64 : p.homY;
    var cadY = p.cadY === undefined ? 106 : p.cadY;
    var ancho = p.ancho || 14;
    var homI = [cx - ancho, homY], homD = [cx + ancho, homY];
    var cadI = [cx - 7, cadY], cadD = [cx + 7, cadY];
    var s = '';

    function piernaF(cad, q) {
      if (!q) return '';
      var o = q[2] || {};
      var t = poli([cad, q[0], q[1]], col, G.ext);
      if (!o.sinPie) t += linea([q[1][0] - 5, q[1][1]], [q[1][0] + 5, q[1][1]], col, G.ext);
      return o.lejos ? grupo(t, 'opacity="' + G.lejos + '"') : t;
    }

    // Piernas
    s += piernaF(cadI, p.piernaI || [[cx - 7, cadY + 32], [cx - 7, cadY + 64]]);
    s += piernaF(cadD, p.piernaD || [[cx + 7, cadY + 32], [cx + 7, cadY + 64]]);

    // Torso trapezoidal
    s += ruta('M' + pt([cx - ancho, homY - 2]) + ' L' + pt([cx + ancho, homY - 2]) + ' L' + pt([cx + 8, cadY]) +
      ' L' + pt([cx - 8, cadY]) + ' Z', col, 10, col);

    // Cuello y cabeza
    s += linea([cx, cabY + 6], [cx, homY - 4], col, G.cuello);
    s += circulo([cx, cabY], G.cab, col);

    // Brazos (delante)
    s += brazo(homI, p.brazoI, col);
    s += brazo(homD, p.brazoD, col);

    return s;
  }

  /* =============================================================
     3. Equipo (siempre en var(--rojo))
     ============================================================= */

  /* Disco de barra visto de canto (vista lateral). */
  function disco(c, r) {
    var rr = r || 13;
    return anillo(c, rr, COL.eq, 6) + circulo(c, 3, COL.eq);
  }

  /* Barra vista de frente: barra con un disco a cada extremo. */
  function barraFrente(x1, x2, y) {
    return linea([x1 - 4, y], [x2 + 4, y], COL.eq, 5) +
      rect(x1 - 12, y - 11, 8, 22, COL.eq, 2.5) + rect(x2 + 4, y - 11, 8, 22, COL.eq, 2.5);
  }

  /* Mancuerna completa girada `ang` grados alrededor de su centro. */
  function mancuerna(c, ang, tam) {
    var t = tam || 22;
    var h = t / 2;
    var cuerpo = linea([-h, 0], [h, 0], COL.eq, 4) +
      rect(-h - 5, -7, 7, 14, COL.eq, 2) + rect(h - 2, -7, 7, 14, COL.eq, 2);
    return grupo(cuerpo, 'transform="translate(' + r1(c[0]) + ' ' + r1(c[1]) + ') rotate(' + r1(ang || 0) + ')"');
  }

  /* Mancuerna vista por el extremo (cuando apunta al espectador). */
  function mancuernaCanto(c) {
    return anillo(c, 7, COL.eq, 5) + circulo(c, 2, COL.eq);
  }

  /* Kettlebell: bola con asa. */
  function kettlebell(c, r) {
    var rr = r || 10;
    var asa = 'M' + pt([c[0] - rr * 0.7, c[1] - rr * 0.6]) + ' Q' + pt([c[0], c[1] - rr * 2.2]) + ' ' + pt([c[0] + rr * 0.7, c[1] - rr * 0.6]);
    return ruta(asa, COL.eq, 5) + circulo(c, rr, COL.eq);
  }

  /* Banca plana: tabla y dos patas hasta el piso. */
  function banca(x1, x2, y, piso) {
    var p = piso || SUELO;
    return rect(x1, y - 4, x2 - x1, 9, COL.eq, 4) +
      linea([x1 + 10, y + 4], [x1 + 10, p - 1], COL.eq, 5) +
      linea([x2 - 10, y + 4], [x2 - 10, p - 1], COL.eq, 5);
  }

  /* Banca inclinada: asiento corto y respaldo diagonal. */
  function bancaInclinada(x, y, respaldoFin, piso) {
    var p = piso || SUELO;
    return rect(x, y - 4, 34, 9, COL.eq, 4) +
      linea([x + 2, y], respaldoFin, COL.eq, 9) +
      linea([x + 16, y + 4], [x + 16, p - 1], COL.eq, 5) +
      linea([respaldoFin[0] + 6, respaldoFin[1] + 8], [respaldoFin[0] + 6, p - 1], COL.eq, 5, 'opacity=".55"');
  }

  /* Colchoneta en el piso. */
  function colchoneta(x1, x2, y) {
    return rect(x1, (y || SUELO) - 6, x2 - x1, 7, COL.eq, 3.5);
  }

  /* Torre de polea con cable hasta la mano. */
  function polea(torreX, poleaY, mano, o) {
    var op = o || {};
    var piso = op.piso || SUELO;
    var s = linea([torreX, op.desde || 22], [torreX, piso - 1], COL.eq, 6);
    if (op.brazo) s += linea([torreX, poleaY], [op.brazo, poleaY], COL.eq, 6);
    var px = op.brazo || torreX;
    s += anillo([px, poleaY], 6, COL.eq, 4);
    s += linea([px, poleaY], mano, COL.eq, 3);
    if (!op.sinMango) s += linea([mano[0] - 7, mano[1]], [mano[0] + 7, mano[1]], COL.eq, 6, 'transform="rotate(' + r1(op.giro || 0) + ' ' + pt(mano) + ')"');
    return s;
  }

  /* Barra fija (dominadas) vista de frente. */
  function barraFija(y) {
    return linea([28, y], [172, y], COL.eq, 6) +
      linea([44, y], [44, y - 18], COL.eq, 5) + linea([156, y], [156, y - 18], COL.eq, 5) +
      linea([30, y - 18], [170, y - 18], COL.guia, 3);
  }

  /* Línea de piso tenue. */
  function suelo(y) {
    var yy = y === undefined ? SUELO : y;
    return linea([12, yy], [188, yy], COL.guia, 3, 'opacity=".95"');
  }

  /* Fondo suave detrás de la figura. */
  function fondoSuave() {
    return circulo([100, 102], 86, COL.guia, 'opacity=".28"');
  }

  /* Flecha corta de movimiento (guía, tenue). */
  function flecha(a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L;
    var p1 = [b[0] - ux * 9 - uy * 6, b[1] - uy * 9 + ux * 6];
    var p2 = [b[0] - ux * 9 + uy * 6, b[1] - uy * 9 - ux * 6];
    return linea(a, b, COL.suave, 3, 'opacity=".7" stroke-dasharray="5 5"') +
      poli([p1, b, p2], COL.suave, 3, 'opacity=".7"');
  }

  /* Caminadora: banda inclinada y consola. */
  function caminadora() {
    return linea([26, 172], [152, 164], COL.eq, 8) +
      linea([152, 164], [164, 96], COL.eq, 6) +
      linea([150, 100], [176, 96], COL.eq, 6) +
      rect(160, 76, 20, 12, COL.eq, 3);
  }

  /* Bicicleta estática: volante, cuadro, asiento y manubrio. */
  function biciEstatica() {
    return anillo([142, 150], 20, COL.eq, 6) +
      linea([142, 150], [104, 150], COL.eq, 6) +
      linea([104, 150], [88, 110], COL.eq, 6) +
      linea([104, 150], [128, 100], COL.eq, 6) +
      linea([78, 106], [98, 106], COL.eq, 8) +
      linea([122, 96], [144, 90], COL.eq, 7) +
      linea([60, 172], [150, 172], COL.eq, 6) +
      circulo([104, 150], 5, COL.eq);
  }

  /* Máquina de asiento con respaldo (extensiones, prensa de hombro...). */
  function asiento(x, y, alturaRespaldo, piso) {
    var p = piso || SUELO;
    return rect(x, y - 4, 40, 9, COL.eq, 4) +
      linea([x + 2, y - 2], [x - 4, y - (alturaRespaldo || 46)], COL.eq, 9) +
      linea([x + 20, y + 4], [x + 20, p - 1], COL.eq, 6);
  }

  /* =============================================================
     4. Catálogo de patrones
     -------------------------------------------------------------
     def(id, { nombre, musculos, consejo, suelo, dibujo(fin, col) })
       dibujo recibe fin=true para la fase final y el color de la figura.
       Devuelve figura + equipo; el piso y el fondo los pone el envoltorio.
     ============================================================= */

  var P = {};
  var ORDEN = [];

  function def(id, datos) {
    P[id] = {
      id: id,
      nombre: datos.nombre,
      musculos: datos.musculos,
      consejo: datos.consejo,
      suelo: datos.suelo === undefined ? SUELO : datos.suelo,
      dibujo: datos.dibujo
    };
    ORDEN.push(id);
  }

  /* ---------------------- PIERNAS Y GLÚTEOS ---------------------- */

  def('sentadilla', {
    nombre: 'Sentadilla',
    musculos: 'Cuádriceps, glúteos, core',
    consejo: 'Baja la cadera por debajo de la rodilla con el pecho al frente y los talones pegados al piso.',
    dibujo: function (fin, col) {
      if (!fin) {
        return disco([92, 54]) + persona({
          hom: [100, 52], cad: [100, 96],
          brazos: [[[114, 72], [108, 50]]],
          piernas: [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]]
        }, col);
      }
      return disco([96, 90]) + persona({
        hom: [104, 88], cad: [86, 132],
        brazos: [[[118, 106], [110, 86]]],
        piernas: [[[122, 130], [104, 170], { lejos: true }], [[118, 128], [100, 170]]]
      }, col);
    }
  });

  def('sentadilla_frontal', {
    nombre: 'Sentadilla frontal',
    musculos: 'Cuádriceps, glúteos, core',
    consejo: 'Codos altos y torso vertical: el peso va al frente, sobre los hombros.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [100, 52], cad: [100, 96],
          brazos: [[[122, 56], [110, 48]]],
          piernas: [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]]
        }, col) + disco([112, 52]);
      }
      return persona({
        hom: [102, 86], cad: [90, 130],
        brazos: [[[124, 90], [112, 82]]],
        piernas: [[[122, 128], [104, 170], { lejos: true }], [[118, 126], [100, 170]]]
      }, col) + disco([114, 86]);
    }
  });

  def('prensa', {
    nombre: 'Prensa de piernas',
    musculos: 'Cuádriceps, glúteos',
    consejo: 'Empuja con toda la planta del pie y no bloquees las rodillas arriba.',
    dibujo: function (fin, col) {
      var maquina = linea([30, 152], [58, 98], COL.eq, 9) + rect(28, 148, 54, 9, COL.eq, 4) +
        linea([52, 157], [52, 173], COL.eq, 6) +
        linea([96, 126], [172, 50], COL.guia, 3, 'stroke-dasharray="5 6" opacity=".8"');
      var cuerpo = { hom: [44, 104], cad: [68, 140], brazos: [[[56, 124], [72, 122]]] };
      if (!fin) {
        cuerpo.piernas = [[[102, 108], [140, 116], { lejos: true, punta: [129, 105] }], [[98, 104], [136, 112], { punta: [125, 101] }]];
        return maquina + persona(cuerpo, col) + linea([120, 96], [152, 128], COL.eq, 8);
      }
      cuerpo.piernas = [[[104, 112], [134, 82], { lejos: true, punta: [123, 71] }], [[100, 108], [130, 78], { punta: [119, 67] }]];
      return maquina + persona(cuerpo, col) + linea([114, 62], [146, 94], COL.eq, 8);
    }
  });

  def('zancada', {
    nombre: 'Zancada',
    musculos: 'Cuádriceps, glúteos, isquiotibiales',
    consejo: 'Da un paso largo y baja recto: la rodilla de atrás casi toca el piso.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [100, 52], cad: [100, 96],
          brazos: [[[98, 74], [96, 98], { lejos: true }], [[104, 74], [106, 98]]],
          piernas: [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]]
        }, col) + mancuerna([108, 102], 0, 20);
      }
      return persona({
        hom: [100, 76], cad: [100, 120],
        brazos: [[[98, 98], [98, 120], { lejos: true }], [[102, 98], [104, 120]]],
        piernas: [[[84, 152], [64, 170], { lejos: true }], [[132, 124], [132, 170]]]
      }, col) + mancuerna([106, 124], 0, 20);
    }
  });

  def('peso_muerto', {
    nombre: 'Peso muerto',
    musculos: 'Glúteos, isquiotibiales, espalda baja',
    consejo: 'Espalda plana, barra pegada a las piernas y empuja el piso con los pies.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [118, 74], cad: [80, 112],
          brazos: [[[118, 114], [118, 152]]],
          piernas: [[[112, 140], [104, 170], { lejos: true }], [[108, 138], [100, 170]]]
        }, col) + disco([118, 156], 15);
      }
      return persona({
        hom: [100, 52], cad: [100, 96],
        brazos: [[[104, 74], [108, 98]]],
        piernas: [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]]
      }, col) + disco([108, 102], 15);
    }
  });

  def('peso_muerto_rumano', {
    nombre: 'Peso muerto rumano',
    musculos: 'Isquiotibiales, glúteos, espalda baja',
    consejo: 'Rodillas apenas dobladas: manda la cadera hacia atrás hasta sentir la parte trasera del muslo.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [100, 52], cad: [100, 96],
          brazos: [[[104, 74], [108, 98]]],
          piernas: [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]]
        }, col) + disco([108, 102]);
      }
      return persona({
        hom: [128, 84], cad: [80, 104],
        brazos: [[[128, 112], [128, 140]]],
        piernas: [[[108, 136], [104, 170], { lejos: true }], [[104, 134], [100, 170]]]
      }, col) + disco([128, 144]);
    }
  });

  def('hip_thrust', {
    nombre: 'Empuje de cadera',
    musculos: 'Glúteos, isquiotibiales',
    consejo: 'Sube la cadera hasta que el torso quede horizontal y aprieta el glúteo arriba.',
    dibujo: function (fin, col) {
      var bancaAtras = banca(14, 62, 120);
      if (!fin) {
        return bancaAtras + persona({
          hom: [60, 122], cad: [96, 150],
          brazos: [[[78, 142], [94, 134]]],
          piernas: [[[132, 128], [146, 170], { lejos: true }], [[128, 124], [140, 170]]]
        }, col) + disco([96, 140]);
      }
      return bancaAtras + persona({
        hom: [60, 120], cad: [100, 116],
        brazos: [[[80, 134], [96, 118]]],
        piernas: [[[132, 124], [146, 170], { lejos: true }], [[128, 120], [140, 170]]]
      }, col) + disco([100, 106]);
    }
  });

  def('extension_cuadriceps', {
    nombre: 'Extensión de cuádriceps',
    musculos: 'Cuádriceps',
    consejo: 'Extiende hasta arriba, aprieta un segundo y baja lento sin soltar el peso.',
    dibujo: function (fin, col) {
      var maquina = asiento(66, 120, 50);
      var cuerpo = { hom: [76, 74], cad: [88, 116], brazos: [[[88, 98], [100, 114]]] };
      if (!fin) {
        cuerpo.piernas = [[[128, 120], [128, 164]]];
        return maquina + persona(cuerpo, col) + linea([130, 122], [132, 160], COL.eq, 5) + circulo([133, 162], 6, COL.eq);
      }
      cuerpo.piernas = [[[128, 120], [172, 118], { punta: [184, 112] }]];
      return maquina + persona(cuerpo, col) + linea([130, 122], [170, 124], COL.eq, 5) + circulo([170, 124], 6, COL.eq);
    }
  });

  def('curl_femoral', {
    nombre: 'Curl femoral',
    musculos: 'Isquiotibiales',
    consejo: 'Lleva el talón al glúteo sin despegar la cadera del apoyo.',
    dibujo: function (fin, col) {
      var bancaPlana = banca(30, 122, 118);
      var cuerpo = { hom: [58, 112], cad: [104, 112], brazos: [[[62, 134], [72, 148]]] };
      if (!fin) {
        cuerpo.piernas = [[[144, 114], [184, 116], { sinPie: true }]];
        return bancaPlana + persona(cuerpo, col) + linea([146, 120], [178, 122], COL.eq, 5) + circulo([178, 118], 6, COL.eq);
      }
      cuerpo.piernas = [[[144, 114], [150, 74], { sinPie: true }]];
      return bancaPlana + persona(cuerpo, col) + linea([146, 120], [156, 76], COL.eq, 5) + circulo([154, 72], 6, COL.eq);
    }
  });

  def('gemelo', {
    nombre: 'Elevación de talones',
    musculos: 'Pantorrillas',
    consejo: 'Sube hasta la punta del pie, aguanta arriba y baja el talón lo más que puedas.',
    dibujo: function (fin, col) {
      var bloque = rect(100, 160, 40, 14, COL.eq, 3) + linea([150, 30], [150, 173], COL.eq, 6);
      if (!fin) {
        return bloque + persona({
          hom: [104, 50], cad: [104, 92],
          brazos: [[[128, 68], [148, 70]]],
          piernas: [[[104, 126], [104, 160], { punta: [120, 158] }]]
        }, col) + linea([104, 160], [94, 168], col, G.ext);
      }
      return bloque + persona({
        hom: [106, 40], cad: [106, 82],
        brazos: [[[128, 58], [148, 60]]],
        piernas: [[[106, 116], [106, 150], { punta: [120, 158] }]]
      }, col) + linea([106, 150], [97, 154], col, G.ext);
    }
  });

  def('puente_gluteo', {
    nombre: 'Puente de glúteo',
    musculos: 'Glúteos, isquiotibiales, core',
    consejo: 'Empuja con los talones y forma una línea recta de rodillas a hombros.',
    dibujo: function (fin, col) {
      var tapete = colchoneta(24, 156);
      if (!fin) {
        return tapete + persona({
          hom: [56, 158], cad: [100, 158], cab: [36, 158],
          brazos: [[[76, 166], [96, 166]]],
          piernas: [[[130, 132], [146, 168], { lejos: true }], [[126, 128], [140, 168]]]
        }, col);
      }
      return tapete + persona({
        hom: [56, 156], cad: [100, 122], cab: [38, 160],
        brazos: [[[76, 166], [96, 166]]],
        piernas: [[[130, 126], [146, 168], { lejos: true }], [[126, 122], [140, 168]]]
      }, col);
    }
  });

  def('patada_gluteo', {
    nombre: 'Patada de glúteo',
    musculos: 'Glúteos, isquiotibiales',
    consejo: 'Extiende la pierna hacia atrás apretando el glúteo, sin arquear la espalda baja.',
    dibujo: function (fin, col) {
      var tapete = colchoneta(20, 160);
      var cuerpo = { hom: [120, 104], cad: [72, 104], brazos: [[[128, 138], [130, 170], { lejos: true }], [[122, 138], [124, 170]]] };
      if (!fin) {
        cuerpo.piernas = [[[70, 170], [40, 170], { lejos: true, sinPie: true }], [[64, 166], [36, 168], { sinPie: true }]];
        return tapete + persona(cuerpo, col);
      }
      cuerpo.piernas = [[[70, 170], [40, 170], { lejos: true, sinPie: true }], [[44, 86], [16, 66], { sinPie: true }]];
      return tapete + persona(cuerpo, col);
    }
  });

  def('abduccion', {
    nombre: 'Abducción de cadera',
    musculos: 'Glúteo medio, abductores',
    consejo: 'Abre las rodillas contra la resistencia y regresa despacio sin que los pesos choquen.',
    dibujo: function (fin, col) {
      var silla = rect(58, 110, 84, 9, COL.eq, 4) + linea([100, 119], [100, 173], COL.eq, 6);
      var cuerpo = { cabY: 40, homY: 62, cadY: 104, brazoI: [[80, 86], [84, 108]], brazoD: [[120, 86], [116, 108]] };
      if (!fin) {
        cuerpo.piernaI = [[93, 132], [93, 168]];
        cuerpo.piernaD = [[107, 132], [107, 168]];
        return silla + frente(cuerpo, col) + rect(78, 126, 8, 14, COL.eq, 3) + rect(114, 126, 8, 14, COL.eq, 3);
      }
      cuerpo.piernaI = [[70, 128], [52, 166]];
      cuerpo.piernaD = [[130, 128], [148, 166]];
      return silla + frente(cuerpo, col) + rect(54, 122, 8, 14, COL.eq, 3) + rect(138, 122, 8, 14, COL.eq, 3);
    }
  });

  def('hiperextension', {
    nombre: 'Hiperextensión',
    musculos: 'Espalda baja, glúteos, isquiotibiales',
    consejo: 'Sube solo hasta que el cuerpo quede en línea recta; ni un grado más.',
    dibujo: function (fin, col) {
      var banco = rect(68, 110, 28, 12, COL.eq, 6) + linea([82, 122], [82, 173], COL.eq, 6) +
        circulo([26, 152], 6, COL.eq) + linea([26, 158], [26, 173], COL.eq, 6);
      var cuerpo = { cad: [82, 116], piernas: [[[54, 134], [28, 150], { sinPie: true }]] };
      if (!fin) {
        cuerpo.hom = [104, 148]; cuerpo.cab = [118, 160];
        cuerpo.brazos = [[[120, 150], [108, 142]]];
        return banco + persona(cuerpo, col);
      }
      cuerpo.hom = [126, 90];
      cuerpo.brazos = [[[136, 104], [122, 110]]];
      return banco + persona(cuerpo, col);
    }
  });

  def('subida_cajon', {
    nombre: 'Subida al cajón',
    musculos: 'Cuádriceps, glúteos',
    consejo: 'Sube empujando con el talón del pie de arriba, sin impulsarte con la pierna de abajo.',
    dibujo: function (fin, col) {
      var cajon = rect(112, 146, 62, 28, COL.eq, 4);
      if (!fin) {
        return cajon + persona({
          hom: [90, 72], cad: [88, 110],
          brazos: [[[92, 92], [94, 114]]],
          piernas: [[[86, 140], [84, 170], { lejos: true }], [[118, 120], [126, 142]]]
        }, col) + mancuerna([96, 118], 0, 18);
      }
      return cajon + persona({
        hom: [128, 44], cad: [128, 82],
        brazos: [[[130, 64], [132, 86]]],
        piernas: [[[110, 108], [102, 130], { lejos: true, punta: [112, 126] }], [[128, 112], [128, 142]]]
      }, col) + mancuerna([134, 90], 0, 18);
    }
  });

  /* ---------------------------- PECHO ---------------------------- */

  /* Acostado en banca plana (vista lateral): sirve a press, pullover y francés. */
  function acostadoBanca(brazos, col) {
    return banca(40, 150, 126) + persona({
      hom: [66, 116], cad: [110, 116],
      brazos: brazos,
      piernas: [[[146, 138], [152, 170], { lejos: true }], [[142, 134], [146, 170]]]
    }, col);
  }

  def('press_banca', {
    nombre: 'Press de banca',
    musculos: 'Pectoral, tríceps, hombro anterior',
    consejo: 'Baja la barra al pecho con los codos a 45 grados y empuja hasta estirar los brazos.',
    dibujo: function (fin, col) {
      if (!fin) return acostadoBanca([[[86, 124], [86, 96]]], col) + disco([86, 90]);
      return acostadoBanca([[[70, 88], [72, 60]]], col) + disco([72, 54]);
    }
  });

  def('press_inclinado', {
    nombre: 'Press inclinado',
    musculos: 'Pectoral superior, hombro anterior, tríceps',
    consejo: 'Respaldo entre 30 y 45 grados: la barra baja a la parte alta del pecho, no al cuello.',
    dibujo: function (fin, col) {
      var cuerpo = { hom: [74, 86], cad: [110, 126], piernas: [[[142, 138], [146, 170], { lejos: true }], [[138, 134], [142, 170]]] };
      var equipo = bancaInclinada(100, 130, [62, 80]);
      if (!fin) {
        cuerpo.brazos = [[[92, 98], [96, 70]]];
        return equipo + persona(cuerpo, col) + disco([98, 64]);
      }
      cuerpo.brazos = [[[96, 72], [112, 52]]];
      return equipo + persona(cuerpo, col) + disco([114, 46]);
    }
  });

  def('apertura', {
    nombre: 'Aperturas',
    musculos: 'Pectoral, hombro anterior',
    consejo: 'Codos apenas doblados todo el recorrido: abre en arco amplio y cierra apretando el pecho.',
    suelo: false,
    dibujo: function (fin, col) {
      var bancaArriba = rect(84, 16, 32, 168, COL.eq, 9, 'opacity=".5"');
      var cuerpo = { cabY: 40, homY: 64, cadY: 106 };
      if (!fin) {
        cuerpo.brazoI = [[64, 58], [38, 52]];
        cuerpo.brazoD = [[136, 58], [162, 52]];
        return bancaArriba + frente(cuerpo, col) + mancuerna([34, 52], 90, 20) + mancuerna([166, 52], 90, 20);
      }
      cuerpo.brazoI = [[74, 80], [93, 66]];
      cuerpo.brazoD = [[126, 80], [107, 66]];
      return bancaArriba + frente(cuerpo, col) + mancuerna([90, 62], 90, 18) + mancuerna([110, 62], 90, 18);
    }
  });

  def('cruce_polea', {
    nombre: 'Cruce de poleas',
    musculos: 'Pectoral, hombro anterior',
    consejo: 'Junta las manos al frente y abajo sin doblar más los codos: el movimiento nace del hombro.',
    dibujo: function (fin, col) {
      var torres = linea([18, 14], [18, 173], COL.eq, 6) + linea([182, 14], [182, 173], COL.eq, 6) +
        anillo([24, 26], 6, COL.eq, 4) + anillo([176, 26], 6, COL.eq, 4);
      var cuerpo = { cabY: 42, homY: 64, cadY: 106 };
      if (!fin) {
        cuerpo.brazoI = [[66, 66], [44, 54]];
        cuerpo.brazoD = [[134, 66], [156, 54]];
        return torres + linea([24, 26], [44, 54], COL.eq, 3) + linea([176, 26], [156, 54], COL.eq, 3) + frente(cuerpo, col);
      }
      cuerpo.brazoI = [[72, 84], [96, 92]];
      cuerpo.brazoD = [[128, 84], [104, 92]];
      return torres + linea([24, 26], [96, 92], COL.eq, 3) + linea([176, 26], [104, 92], COL.eq, 3) + frente(cuerpo, col);
    }
  });

  def('flexion', {
    nombre: 'Lagartija',
    musculos: 'Pectoral, tríceps, core',
    consejo: 'Cuerpo en línea recta de cabeza a talones: baja el pecho a un puño del piso y empuja.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [124, 100], cad: [86, 130],
          brazos: [[[126, 134], [128, 168]]],
          piernas: [[[64, 154], [38, 170], { lejos: true, punta: [32, 174] }], [[60, 150], [34, 168], { punta: [28, 173] }]]
        }, col);
      }
      return persona({
        hom: [122, 136], cad: [84, 152],
        brazos: [[[104, 152], [128, 168]]],
        piernas: [[[62, 164], [38, 170], { lejos: true, punta: [32, 174] }], [[58, 162], [34, 168], { punta: [28, 173] }]]
      }, col);
    }
  });

  def('fondo', {
    nombre: 'Fondos en paralelas',
    musculos: 'Pectoral inferior, tríceps, hombro',
    consejo: 'Baja hasta que el hombro quede a la altura del codo y sube sin balancearte.',
    suelo: 180,
    dibujo: function (fin, col) {
      var barras = grupo(linea([124, 96], [124, 179], COL.eq, 6) + linea([116, 96], [132, 96], COL.eq, 7), 'opacity=".45"') +
        linea([100, 96], [100, 179], COL.eq, 6) + linea([92, 96], [108, 96], COL.eq, 7);
      if (!fin) {
        return barras + persona({
          hom: [100, 60], cad: [96, 106],
          brazos: [[[100, 78], [100, 96]]],
          piernas: [[[88, 142], [78, 164], { lejos: true, punta: [88, 170] }], [[84, 138], [72, 160], { punta: [82, 168] }]]
        }, col);
      }
      return barras + persona({
        hom: [98, 90], cad: [88, 132],
        brazos: [[[78, 96], [100, 96]]],
        piernas: [[[80, 162], [70, 176], { lejos: true, punta: [80, 179] }], [[76, 158], [66, 174], { punta: [76, 178] }]]
      }, col);
    }
  });

  /* ---------------------------- ESPALDA ---------------------------- */

  def('jalon', {
    nombre: 'Jalón al pecho',
    musculos: 'Dorsal, bíceps, trapecio',
    consejo: 'Saca el pecho y jala la barra hasta la clavícula llevando los codos abajo y atrás.',
    dibujo: function (fin, col) {
      var maquina = rect(70, 132, 60, 8, COL.eq, 4) + rect(64, 116, 72, 8, COL.eq, 4, 'opacity=".75"') +
        linea([100, 140], [100, 173], COL.eq, 6) + anillo([100, 10], 5, COL.eq, 4);
      var cuerpo = { cabY: 42, homY: 64, cadY: 106, piernaI: [[93, 138], [93, 170]], piernaD: [[107, 138], [107, 170]] };
      if (!fin) {
        cuerpo.brazoI = [[76, 46], [70, 28]];
        cuerpo.brazoD = [[124, 46], [130, 28]];
        return maquina + linea([100, 10], [100, 28], COL.eq, 3) + frente(cuerpo, col) + linea([56, 28], [144, 28], COL.eq, 6);
      }
      cuerpo.brazoI = [[68, 88], [74, 62]];
      cuerpo.brazoD = [[132, 88], [126, 62]];
      return maquina + linea([100, 10], [100, 62], COL.eq, 3) + frente(cuerpo, col) + linea([60, 62], [140, 62], COL.eq, 6);
    }
  });

  def('dominada', {
    nombre: 'Dominada',
    musculos: 'Dorsal, bíceps, core',
    consejo: 'Cuelga con los brazos estirados y jala con los codos hasta pasar la barbilla por la barra.',
    suelo: 178,
    dibujo: function (fin, col) {
      var barra = barraFija(24);
      if (!fin) {
        return barra + frente({
          cabY: 44, homY: 66, cadY: 108,
          brazoI: [[81, 46], [76, 26]], brazoD: [[119, 46], [124, 26]],
          piernaI: [[94, 140], [94, 166]], piernaD: [[106, 140], [106, 166]]
        }, col);
      }
      return barra + frente({
        cabY: 18, homY: 40, cadY: 82,
        brazoI: [[68, 58], [76, 26]], brazoD: [[132, 58], [124, 26]],
        piernaI: [[94, 114], [96, 146]], piernaD: [[106, 114], [104, 146]]
      }, col);
    }
  });

  /* Bisagra de cadera con torso casi horizontal (remo, pájaros, swing). */
  function inclinado(brazos, col) {
    return persona({
      hom: [128, 84], cad: [80, 104],
      brazos: brazos,
      piernas: [[[108, 136], [104, 170], { lejos: true }], [[104, 134], [100, 170]]]
    }, col);
  }

  def('remo', {
    nombre: 'Remo con barra',
    musculos: 'Dorsal, romboides, bíceps',
    consejo: 'Torso inclinado y quieto: jala la barra al ombligo llevando los codos hacia atrás.',
    dibujo: function (fin, col) {
      if (!fin) return inclinado([[[128, 112], [128, 140]]], col) + disco([128, 144]);
      return inclinado([[[102, 104], [116, 112]]], col) + disco([118, 114]);
    }
  });

  def('remo_polea', {
    nombre: 'Remo sentado en polea',
    musculos: 'Dorsal, romboides, bíceps',
    consejo: 'Jala el mango al ombligo juntando los omóplatos; el torso apenas se mueve.',
    dibujo: function (fin, col) {
      var maquina = rect(66, 132, 56, 9, COL.eq, 4) + linea([94, 141], [94, 173], COL.eq, 6) +
        linea([158, 120], [164, 150], COL.eq, 8);
      var cuerpo = { cad: [92, 128], piernas: [[[132, 124], [158, 142], { lejos: true, punta: [162, 128] }], [[130, 120], [156, 138], { punta: [160, 124] }]] };
      if (!fin) {
        cuerpo.hom = [96, 84];
        cuerpo.brazos = [[[118, 96], [142, 100]]];
        return maquina + persona(cuerpo, col) + polea(178, 100, [142, 100], { desde: 60, giro: 90 });
      }
      cuerpo.hom = [88, 82];
      cuerpo.brazos = [[[80, 100], [106, 106]]];
      return maquina + persona(cuerpo, col) + polea(178, 100, [106, 106], { desde: 60, giro: 90 });
    }
  });

  def('remo_invertido', {
    nombre: 'Remo invertido',
    musculos: 'Dorsal, romboides, core',
    consejo: 'Cuerpo rígido como tabla: lleva el pecho a la barra apretando los omóplatos.',
    dibujo: function (fin, col) {
      var rack = linea([40, 100], [40, 173], COL.eq, 6) + linea([160, 100], [160, 173], COL.eq, 6) +
        linea([40, 100], [160, 100], COL.eq, 6);
      if (!fin) {
        return rack + persona({
          hom: [82, 140], cad: [116, 153],
          brazos: [[[82, 120], [82, 100]]],
          piernas: [[[136, 164], [152, 170], { lejos: true, punta: [160, 162] }], [[134, 160], [150, 166], { punta: [158, 158] }]]
        }, col);
      }
      return rack + persona({
        hom: [84, 112], cad: [117, 139],
        brazos: [[[64, 118], [82, 100]]],
        piernas: [[[136, 157], [152, 170], { lejos: true, punta: [160, 162] }], [[134, 153], [150, 166], { punta: [158, 158] }]]
      }, col);
    }
  });

  def('pullover', {
    nombre: 'Pullover',
    musculos: 'Dorsal, pectoral, serrato',
    consejo: 'Lleva el peso por detrás de la cabeza con los codos suaves y regresa hasta la vertical.',
    dibujo: function (fin, col) {
      if (!fin) return acostadoBanca([[[68, 88], [70, 62]]], col) + mancuerna([70, 56], 90, 22);
      return acostadoBanca([[[44, 100], [24, 104]]], col) + mancuerna([18, 104], 90, 22);
    }
  });

  def('encogimiento', {
    nombre: 'Encogimientos',
    musculos: 'Trapecio superior',
    consejo: 'Sube los hombros hacia las orejas en línea recta, sin girarlos, y baja despacio.',
    dibujo: function (fin, col) {
      var piernas = [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]];
      if (!fin) {
        return persona({
          hom: [100, 52], cad: [100, 96], cab: [100, 31],
          brazos: [[[98, 74], [96, 98], { lejos: true }], [[102, 74], [104, 98]]],
          piernas: piernas
        }, col) + mancuerna([106, 102], 0, 20);
      }
      return persona({
        hom: [100, 44], cad: [100, 96], cab: [100, 31],
        brazos: [[[98, 66], [96, 90], { lejos: true }], [[102, 66], [104, 90]]],
        piernas: piernas
      }, col) + mancuerna([106, 94], 0, 20);
    }
  });

  /* ---------------------------- HOMBROS ---------------------------- */

  /* Figura de pie, vista lateral, con brazos y equipo a la medida. */
  function dePie(brazos, col, extra) {
    var e = extra || {};
    return persona({
      hom: e.hom || [100, 52], cad: e.cad || [100, 96], cab: e.cab,
      brazos: brazos,
      piernas: e.piernas || [[[104, 132], [104, 170], { lejos: true }], [[100, 132], [100, 170]]]
    }, col);
  }

  def('press_hombro', {
    nombre: 'Press de hombro',
    musculos: 'Deltoides, tríceps, core',
    consejo: 'Empuja en línea recta hacia arriba con el abdomen apretado y sin arquear la espalda baja.',
    dibujo: function (fin, col) {
      var cuerpo = { cabY: 42, homY: 64, cadY: 106 };
      if (!fin) {
        cuerpo.brazoI = [[66, 74], [70, 44]];
        cuerpo.brazoD = [[134, 74], [130, 44]];
        return frente(cuerpo, col) + mancuerna([68, 42], 0, 18) + mancuerna([132, 42], 0, 18);
      }
      cuerpo.brazoI = [[82, 40], [88, 18]];
      cuerpo.brazoD = [[118, 40], [112, 18]];
      return frente(cuerpo, col) + mancuerna([86, 16], 0, 16) + mancuerna([114, 16], 0, 16);
    }
  });

  def('elevacion_lateral', {
    nombre: 'Elevaciones laterales',
    musculos: 'Deltoides medio',
    consejo: 'Sube los brazos a los lados hasta la altura del hombro, guiando con el codo, y baja en tres segundos.',
    dibujo: function (fin, col) {
      var cuerpo = { cabY: 42, homY: 64, cadY: 106 };
      if (!fin) {
        cuerpo.brazoI = [[80, 86], [78, 108]];
        cuerpo.brazoD = [[120, 86], [122, 108]];
        return frente(cuerpo, col) + mancuerna([76, 112], 90, 16) + mancuerna([124, 112], 90, 16);
      }
      cuerpo.brazoI = [[62, 62], [38, 60]];
      cuerpo.brazoD = [[138, 62], [162, 60]];
      return frente(cuerpo, col) + mancuerna([32, 60], 90, 16) + mancuerna([168, 60], 90, 16);
    }
  });

  def('elevacion_frontal', {
    nombre: 'Elevaciones frontales',
    musculos: 'Deltoides anterior',
    consejo: 'Sube el peso al frente hasta la altura de los ojos sin balancear el torso.',
    dibujo: function (fin, col) {
      if (!fin) return dePie([[[100, 74], [100, 98], { lejos: true }], [[104, 74], [108, 96]]], col) + mancuernaCanto([110, 100]);
      return dePie([[[100, 74], [100, 98], { lejos: true }], [[124, 46], [146, 40]]], col) + mancuernaCanto([150, 40]);
    }
  });

  def('pajaro', {
    nombre: 'Pájaros',
    musculos: 'Deltoides posterior, romboides',
    consejo: 'Inclinado y con la espalda recta, abre los brazos hacia los lados con los codos suaves.',
    dibujo: function (fin, col) {
      if (!fin) return inclinado([[[128, 112], [128, 138]]], col) + mancuerna([128, 142], 0, 18);
      return inclinado([[[112, 72], [96, 62]]], col) + mancuerna([92, 60], 0, 18);
    }
  });

  def('face_pull', {
    nombre: 'Face pull',
    musculos: 'Deltoides posterior, trapecio medio, rotadores',
    consejo: 'Jala la cuerda hacia la frente separando las manos y con los codos altos.',
    dibujo: function (fin, col) {
      var e = { hom: [96, 52], cad: [96, 96] };
      if (!fin) return dePie([[[122, 50], [146, 46]]], col, e) + polea(176, 44, [146, 46], { desde: 16, giro: 90 });
      return dePie([[[82, 48], [108, 40]]], col, e) + polea(176, 44, [108, 40], { desde: 16, giro: 90 });
    }
  });

  def('remo_menton', {
    nombre: 'Remo al mentón',
    musculos: 'Deltoides medio, trapecio',
    consejo: 'Sube la barra pegada al cuerpo con los codos por encima de las manos, hasta la clavícula.',
    dibujo: function (fin, col) {
      if (!fin) return dePie([[[100, 74], [100, 98], { lejos: true }], [[104, 74], [106, 98]]], col) + disco([108, 102], 11);
      return dePie([[[100, 74], [100, 98], { lejos: true }], [[116, 42], [106, 60]]], col) + disco([108, 62], 11);
    }
  });

  /* ---------------------------- BRAZOS ---------------------------- */

  def('curl_biceps', {
    nombre: 'Curl de bíceps',
    musculos: 'Bíceps, braquial',
    consejo: 'Codos pegados a las costillas: sube el peso doblando solo el codo y baja controlado.',
    dibujo: function (fin, col) {
      if (!fin) return dePie([[[98, 76], [100, 98], { lejos: true }], [[100, 76], [104, 98]]], col) + disco([106, 102], 11);
      return dePie([[[98, 76], [108, 58], { lejos: true }], [[100, 76], [112, 56]]], col) + disco([114, 54], 11);
    }
  });

  def('curl_martillo', {
    nombre: 'Curl martillo',
    musculos: 'Braquiorradial, braquial, bíceps',
    consejo: 'Palmas mirándose todo el tiempo, como si sostuvieras un martillo; sin girar la muñeca.',
    dibujo: function (fin, col) {
      if (!fin) return dePie([[[98, 76], [100, 98], { lejos: true }], [[100, 76], [104, 98]]], col) + mancuerna([106, 102], 0, 20);
      return dePie([[[98, 76], [108, 58], { lejos: true }], [[100, 76], [114, 56]]], col) + mancuerna([118, 52], 90, 20);
    }
  });

  def('extension_triceps', {
    nombre: 'Extensión de tríceps',
    musculos: 'Tríceps',
    consejo: 'Codos fijos junto al cuerpo: extiende hasta abajo, aprieta y regresa hasta que el antebrazo quede horizontal.',
    dibujo: function (fin, col) {
      var torre = { desde: 14, brazo: 128 };
      if (!fin) return dePie([[[104, 78], [126, 74]]], col) + polea(160, 22, [126, 74], torre);
      return dePie([[[104, 78], [126, 108]]], col) + polea(160, 22, [126, 108], torre);
    }
  });

  def('press_frances', {
    nombre: 'Press francés',
    musculos: 'Tríceps',
    consejo: 'Codos apuntando al techo y quietos: baja la barra hacia la frente y extiende.',
    dibujo: function (fin, col) {
      if (!fin) return acostadoBanca([[[70, 88], [72, 60]]], col) + disco([72, 54], 11);
      return acostadoBanca([[[70, 86], [44, 82]]], col) + disco([40, 82], 11);
    }
  });

  /* ---------------------------- CORE ---------------------------- */

  def('plancha', {
    nombre: 'Plancha',
    musculos: 'Core, hombros, glúteos',
    consejo: 'Codos bajo los hombros y cuerpo en línea recta: aprieta abdomen y glúteo, y respira.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [120, 158], cad: [76, 158],
          brazos: [[[122, 168], [148, 168]]],
          piernas: [[[48, 160], [22, 164], { punta: [16, 173] }]]
        }, col);
      }
      return persona({
        hom: [120, 112], cad: [90, 132],
        brazos: [[[118, 166], [148, 168]]],
        piernas: [[[66, 154], [38, 170], { lejos: true, punta: [32, 174] }], [[62, 150], [34, 168], { punta: [28, 173] }]]
      }, col);
    }
  });

  def('abdominal', {
    nombre: 'Abdominal',
    musculos: 'Recto abdominal',
    consejo: 'Despega solo los omóplatos del piso mirando al techo; la espalda baja se queda pegada.',
    dibujo: function (fin, col) {
      var tapete = colchoneta(24, 172);
      if (!fin) {
        return tapete + persona({
          hom: [58, 156], cad: [104, 156], cab: [37, 156],
          brazos: [[[46, 140], [30, 148]]],
          piernas: [[[132, 128], [150, 166], { lejos: true }], [[128, 124], [146, 166]]]
        }, col);
      }
      return tapete + persona({
        hom: [64, 133], cad: [104, 156],
        brazos: [[[48, 120], [34, 124]]],
        piernas: [[[132, 128], [150, 166], { lejos: true }], [[128, 124], [146, 166]]]
      }, col);
    }
  });

  def('elevacion_piernas', {
    nombre: 'Elevación de piernas',
    musculos: 'Abdomen bajo, flexores de cadera',
    consejo: 'Sube las piernas sin balancearte y bájalas despacio, con el abdomen apretado.',
    suelo: 180,
    dibujo: function (fin, col) {
      var barra = linea([60, 20], [140, 20], COL.eq, 6) + linea([70, 20], [70, 8], COL.eq, 5) + linea([130, 20], [130, 8], COL.eq, 5);
      var brazos = [[[94, 44], [92, 22], { lejos: true }], [[110, 44], [112, 22]]];
      if (!fin) {
        return barra + persona({
          hom: [100, 66], cad: [100, 110], brazos: brazos,
          piernas: [[[104, 142], [104, 172], { lejos: true }], [[100, 142], [100, 172]]]
        }, col);
      }
      return barra + persona({
        hom: [100, 66], cad: [100, 110], brazos: brazos,
        piernas: [[[134, 112], [168, 110], { lejos: true, punta: [176, 102] }], [[134, 108], [168, 106], { punta: [176, 98] }]]
      }, col);
    }
  });

  def('giro_ruso', {
    nombre: 'Giro ruso',
    musculos: 'Oblicuos, core',
    consejo: 'Torso inclinado y pies firmes: gira el tronco de un lado al otro llevando el peso contigo.',
    dibujo: function (fin, col) {
      var tapete = colchoneta(30, 172);
      var cuerpo = { hom: [72, 112], cad: [100, 150], piernas: [[[134, 128], [154, 144], { lejos: true, punta: [164, 136] }], [[130, 124], [150, 140], { punta: [160, 132] }]] };
      if (!fin) {
        cuerpo.brazos = [[[100, 116], [118, 112]]];
        return tapete + persona(cuerpo, col) + circulo([127, 112], 10, COL.eq);
      }
      cuerpo.brazos = [[[62, 134], [48, 142]]];
      return tapete + persona(cuerpo, col) + circulo([40, 148], 10, COL.eq);
    }
  });

  def('escaladores', {
    nombre: 'Escaladores',
    musculos: 'Core, flexores de cadera, hombros',
    consejo: 'Desde la plancha, lleva una rodilla al pecho y alterna rápido sin subir la cadera.',
    dibujo: function (fin, col) {
      var cuerpo = { hom: [124, 100], cad: [86, 130], brazos: [[[126, 134], [128, 168]]] };
      if (!fin) {
        cuerpo.piernas = [[[110, 128], [104, 166], { lejos: true }], [[60, 150], [34, 168], { punta: [28, 173] }]];
        return persona(cuerpo, col);
      }
      cuerpo.piernas = [[[64, 154], [38, 170], { lejos: true, punta: [32, 174] }], [[112, 124], [106, 166]]];
      return persona(cuerpo, col);
    }
  });

  def('lenador', {
    nombre: 'Leñador en polea',
    musculos: 'Oblicuos, core',
    consejo: 'Gira desde la cadera, no desde los brazos: lleva el mango de arriba hacia la rodilla contraria.',
    dibujo: function (fin, col) {
      var torre = linea([182, 14], [182, 173], COL.eq, 6) + anillo([176, 26], 6, COL.eq, 4);
      var cuerpo = { cabY: 42, homY: 64, cadY: 106 };
      if (!fin) {
        cuerpo.brazoI = [[120, 44], [148, 30]];
        cuerpo.brazoD = [[136, 46], [148, 30]];
        return torre + linea([176, 26], [148, 30], COL.eq, 3) + frente(cuerpo, col);
      }
      cuerpo.brazoI = [[64, 90], [46, 110]];
      cuerpo.brazoD = [[86, 96], [46, 110]];
      cuerpo.piernaI = [[86, 136], [80, 170]];
      cuerpo.piernaD = [[112, 136], [118, 170]];
      return torre + linea([176, 26], [46, 110], COL.eq, 3) + frente(cuerpo, col);
    }
  });

  /* ---------------------------- CARDIO ---------------------------- */

  def('correr', {
    nombre: 'Caminadora',
    musculos: 'Piernas, corazón y pulmones',
    consejo: 'Mira al frente, hombros relajados y pisa suave: el ritmo debe dejarte hablar frases cortas.',
    dibujo: function (fin, col) {
      var cuerpo = { hom: [100, 52], cad: [92, 94] };
      var adelante = [[118, 122], [126, 158], { punta: [138, 160] }];
      var atras = [[76, 124], [62, 150], { punta: [72, 160] }];
      var brazoAdelante = [[116, 72], [124, 56]];
      var brazoAtras = [[82, 72], [74, 90]];
      function lejos(x) { return [x[0], x[1], { lejos: true, punta: x[2] ? x[2].punta : undefined }]; }
      if (!fin) {
        cuerpo.piernas = [lejos(atras), adelante];
        cuerpo.brazos = [lejos(brazoAtras), brazoAdelante];
      } else {
        cuerpo.piernas = [lejos(adelante), atras];
        cuerpo.brazos = [lejos(brazoAdelante), brazoAtras];
      }
      return caminadora() + persona(cuerpo, col);
    }
  });

  def('bici', {
    nombre: 'Bicicleta estática',
    musculos: 'Cuádriceps, glúteos, corazón',
    consejo: 'Ajusta el asiento para que la rodilla quede casi estirada abajo y pedalea redondo.',
    dibujo: function (fin, col) {
      var centro = [104, 150];
      var p1 = [112, 142], p2 = [96, 158];
      var cuerpo = { hom: [116, 70], cad: [88, 100], brazos: [[[132, 86], [140, 92]]] };
      var pedales = linea(centro, p1, COL.eq, 4) + linea(centro, p2, COL.eq, 4);
      var arriba = [[112, 116], p1, { punta: [122, 142] }];
      var abajo = [[100, 128], p2, { punta: [106, 158] }];
      if (!fin) cuerpo.piernas = [[abajo[0], abajo[1], { lejos: true, punta: abajo[2].punta }], arriba];
      else cuerpo.piernas = [[arriba[0], arriba[1], { lejos: true, punta: arriba[2].punta }], abajo];
      return biciEstatica() + pedales + persona(cuerpo, col);
    }
  });

  def('salto', {
    nombre: 'Saltos de tijera',
    musculos: 'Cuerpo completo, corazón',
    consejo: 'Abre piernas y brazos al mismo tiempo y cae suave con las rodillas suaves.',
    dibujo: function (fin, col) {
      if (!fin) {
        return frente({
          cabY: 42, homY: 64, cadY: 106,
          brazoI: [[80, 86], [78, 108]], brazoD: [[120, 86], [122, 108]]
        }, col);
      }
      return frente({
        cabY: 36, homY: 58, cadY: 100,
        brazoI: [[70, 36], [74, 14]], brazoD: [[130, 36], [126, 14]],
        piernaI: [[82, 132], [70, 162]], piernaD: [[118, 132], [130, 162]]
      }, col);
    }
  });

  def('cuerda', {
    nombre: 'Salto de cuerda',
    musculos: 'Pantorrillas, hombros, corazón',
    consejo: 'Saltos pequeños con la punta del pie y las muñecas girando la cuerda, no los brazos.',
    suelo: 168,
    dibujo: function (fin, col) {
      if (!fin) {
        return ruta('M112 92 Q176 26 100 6 Q24 26 88 92', COL.eq, 3) + persona({
          hom: [100, 46], cad: [100, 90],
          brazos: [[[90, 70], [88, 92], { lejos: true }], [[110, 70], [112, 92]]],
          piernas: [[[104, 126], [104, 164], { lejos: true }], [[100, 126], [100, 164]]]
        }, col);
      }
      return ruta('M112 86 Q176 150 100 178 Q24 150 88 86', COL.eq, 3) + persona({
        hom: [100, 40], cad: [100, 84],
        brazos: [[[90, 64], [88, 86], { lejos: true }], [[110, 64], [112, 86]]],
        piernas: [[[104, 120], [104, 156], { lejos: true }], [[100, 120], [100, 156]]]
      }, col);
    }
  });

  def('burpee', {
    nombre: 'Burpee',
    musculos: 'Cuerpo completo, corazón',
    consejo: 'Baja a plancha con control y termina cada repetición con un salto y las manos arriba.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [124, 100], cad: [86, 130],
          brazos: [[[126, 134], [128, 168]]],
          piernas: [[[64, 154], [38, 170], { lejos: true, punta: [32, 174] }], [[60, 150], [34, 168], { punta: [28, 173] }]]
        }, col);
      }
      return persona({
        hom: [100, 44], cad: [100, 88],
        brazos: [[[88, 28], [84, 10], { lejos: true }], [[112, 28], [116, 10]]],
        piernas: [[[104, 124], [104, 158], { lejos: true }], [[100, 124], [100, 158]]]
      }, col);
    }
  });

  def('trineo', {
    nombre: 'Empuje de trineo',
    musculos: 'Piernas, glúteos, core',
    consejo: 'Brazos firmes, cuerpo inclinado en línea y pasos cortos y potentes.',
    dibujo: function (fin, col) {
      var trineo = rect(128, 146, 44, 26, COL.eq, 4) + linea([134, 146], [134, 96], COL.eq, 6) +
        linea([166, 146], [166, 96], COL.eq, 6);
      var cuerpo = { hom: [112, 72], cad: [82, 118], brazos: [[[124, 84], [134, 102]]] };
      var adelante = [[104, 146], [106, 170]];
      var atras = [[70, 150], [52, 170]];
      if (!fin) cuerpo.piernas = [[atras[0], atras[1], { lejos: true }], adelante];
      else cuerpo.piernas = [[adelante[0], adelante[1], { lejos: true }], atras];
      return trineo + persona(cuerpo, col);
    }
  });

  /* ------------------------ CUERPO COMPLETO ------------------------ */

  def('kettlebell_swing', {
    nombre: 'Balanceo con kettlebell',
    musculos: 'Glúteos, isquiotibiales, core',
    consejo: 'Es una bisagra de cadera, no una sentadilla: la pesa sube por el golpe de cadera, no por los brazos.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [126, 84], cad: [80, 110],
          brazos: [[[113, 110], [100, 134]]],
          piernas: [[[110, 140], [104, 170], { lejos: true }], [[106, 138], [100, 170]]]
        }, col) + kettlebell([98, 148], 10);
      }
      return dePie([[[124, 56], [148, 58]]], col) + kettlebell([156, 80], 10);
    }
  });

  def('cargada', {
    nombre: 'Cargada',
    musculos: 'Cuerpo completo, potencia',
    consejo: 'Extiende cadera y rodillas de golpe y recibe la barra sobre los hombros con los codos altos.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [118, 80], cad: [84, 110],
          brazos: [[[118, 116], [118, 148]]],
          piernas: [[[112, 142], [104, 170], { lejos: true }], [[108, 140], [100, 170]]]
        }, col) + disco([118, 152], 14);
      }
      return persona({
        hom: [100, 52], cad: [98, 98],
        brazos: [[[122, 58], [110, 48]]],
        piernas: [[[108, 136], [104, 170], { lejos: true }], [[104, 134], [100, 170]]]
      }, col) + disco([112, 50], 14);
    }
  });

  def('caminata_granjero', {
    nombre: 'Caminata del granjero',
    musculos: 'Agarre, trapecio, core, piernas',
    consejo: 'Pecho arriba y hombros atrás: camina con pasos cortos sin dejar que el peso te incline.',
    dibujo: function (fin, col) {
      var cuerpo = { hom: [100, 52], cad: [96, 96], brazos: [[[96, 74], [94, 98], { lejos: true }], [[102, 74], [104, 98]]] };
      var adelante = [[116, 128], [122, 166]];
      var atras = [[82, 130], [74, 166]];
      if (!fin) cuerpo.piernas = [[atras[0], atras[1], { lejos: true }], adelante];
      else cuerpo.piernas = [[adelante[0], adelante[1], { lejos: true }], atras];
      return persona(cuerpo, col) + grupo(mancuerna([94, 104], 0, 20), 'opacity=".45"') + mancuerna([106, 104], 0, 20);
    }
  });

  def('levantada_turca', {
    nombre: 'Levantada turca',
    musculos: 'Hombro, core, cuerpo completo',
    consejo: 'La pesa siempre apunta al techo: mírala todo el camino y muévete despacio, paso por paso.',
    dibujo: function (fin, col) {
      var tapete = colchoneta(20, 172);
      if (!fin) {
        return tapete + persona({
          hom: [60, 156], cad: [104, 156], cab: [38, 156],
          brazos: [[[60, 120], [60, 88]]],
          piernas: [[[144, 158], [184, 158], { lejos: true }], [[128, 126], [146, 166]]]
        }, col) + circulo([62, 74], 9, COL.eq) + ruta('M56 80 Q62 92 68 80', COL.eq, 4);
      }
      return tapete + persona({
        hom: [100, 70], cad: [96, 114],
        brazos: [[[104, 46], [104, 24]]],
        piernas: [[[84, 168], [56, 168], { lejos: true, sinPie: true }], [[126, 128], [130, 170]]]
      }, col) + circulo([108, 12], 8, COL.eq) + ruta('M102 18 Q108 28 114 18', COL.eq, 4);
    }
  });

  def('balon', {
    nombre: 'Balón medicinal',
    musculos: 'Cuerpo completo, potencia',
    consejo: 'Baja en sentadilla con el balón al pecho y lánzalo arriba extendiendo todo el cuerpo.',
    dibujo: function (fin, col) {
      if (!fin) {
        return persona({
          hom: [104, 88], cad: [86, 132],
          brazos: [[[122, 102], [126, 88]]],
          piernas: [[[122, 130], [104, 170], { lejos: true }], [[118, 128], [100, 170]]]
        }, col) + circulo([134, 84], 11, COL.eq);
      }
      return dePie([[[114, 36], [120, 20]]], col) + circulo([128, 14], 10, COL.eq);
    }
  });

  /* ---------------------------- MOVILIDAD ---------------------------- */

  def('movilidad', {
    nombre: 'Movilidad y estiramiento',
    musculos: 'Cadena posterior, movilidad general',
    consejo: 'Estira sin rebotes, respira lento y quédate donde sientas tensión, no dolor.',
    dibujo: function (fin, col) {
      if (!fin) return dePie([[[92, 32], [88, 12], { lejos: true }], [[108, 32], [112, 12]]], col);
      return persona({
        hom: [122, 132], cad: [96, 96],
        brazos: [[[128, 150], [124, 168]]],
        piernas: [[[102, 132], [104, 170], { lejos: true }], [[98, 132], [100, 170]]]
      }, col);
    }
  });

  def('cuadrupedia', {
    nombre: 'Cuadrupedia',
    musculos: 'Columna, core, movilidad',
    consejo: 'Manos bajo los hombros y rodillas bajo la cadera: mueve la columna despacio, vértebra por vértebra.',
    dibujo: function (fin, col) {
      var tapete = colchoneta(16, 174);
      var cuerpo = {
        hom: [120, 104], cad: [72, 104],
        brazos: [[[128, 138], [130, 170], { lejos: true }], [[122, 138], [124, 170]]],
        piernas: [[[76, 172], [46, 172], { lejos: true, sinPie: true }], [[70, 170], [40, 170], { sinPie: true }]]
      };
      if (!fin) {
        // Camello: espalda arqueada hacia abajo y mirada al frente
        cuerpo.hom = [120, 102]; cuerpo.cad = [72, 106]; cuerpo.curva = [96, 122]; cuerpo.cab = [144, 92];
        return tapete + persona(cuerpo, col);
      }
      // Gato: espalda redondeada hacia arriba y cabeza escondida
      cuerpo.hom = [120, 108]; cuerpo.cad = [72, 108]; cuerpo.curva = [96, 82]; cuerpo.cab = [136, 126];
      return tapete + persona(cuerpo, col);
    }
  });

  def('cuerdas_batalla', {
    nombre: 'Cuerdas de batalla',
    musculos: 'Hombros, brazos, core, corazón',
    consejo: 'Rodillas suaves y abdomen firme: las olas salen de los hombros, no de la espalda baja.',
    dibujo: function (fin, col) {
      var ancla = rect(172, 148, 10, 26, COL.eq, 3);
      var cuerpo = { hom: [92, 60], cad: [86, 104], piernas: [[[106, 140], [104, 170], { lejos: true }], [[102, 138], [100, 170]]] };
      if (!fin) {
        cuerpo.brazos = [[[108, 58], [124, 50], { lejos: true }], [[112, 54], [128, 44]]];
        return ancla + grupo(ruta('M124 50 C146 66 146 100 136 114 S168 150 176 154', COL.eq, 3), 'opacity=".5"') +
          ruta('M128 44 C150 60 150 96 138 110 S170 150 176 156', COL.eq, 3) + persona(cuerpo, col);
      }
      cuerpo.brazos = [[[108, 88], [124, 106], { lejos: true }], [[112, 84], [128, 100]]];
      return ancla + grupo(ruta('M124 106 C146 112 148 134 158 142 S170 152 176 154', COL.eq, 3), 'opacity=".5"') +
        ruta('M128 100 C150 108 150 130 160 140 S170 152 176 156', COL.eq, 3) + persona(cuerpo, col);
    }
  });

  /* =============================================================
     5. Mapeo ejercicio -> patrón
     -------------------------------------------------------------
     Orden de resolución:
       1) tabla explícita de excepciones (por id)
       2) palabras clave del nombre (sin acentos, en este orden)
       3) grupo + equipo
       4) genérico del grupo
     ============================================================= */

  var EXCEPCIONES = {
    ej_thruster_barra: 'sentadilla_frontal',
    ej_sentadilla_press_mancuernas: 'press_hombro',
    ej_sentadilla_goblet: 'sentadilla_frontal',
    ej_sentadilla_sumo_mancuerna: 'sentadilla_frontal',
    ej_sentadilla_hack: 'prensa',
    ej_lagartija_pino: 'flexion',
    ej_rueda_abdominal: 'plancha',
    ej_abduccion_cuadrupedia: 'patada_gluteo',
    ej_cuerdas_de_batalla: 'cuerdas_batalla',
    ej_buenos_dias: 'peso_muerto_rumano',
    ej_pallof_press: 'lenador',
    ej_abdominales_en_v: 'abdominal',
    ej_posicion_hueca: 'elevacion_piernas',
    ej_bicho_muerto: 'elevacion_piernas',
    ej_crunch_inverso: 'elevacion_piernas',
    ej_patada_triceps: 'extension_triceps',
    ej_bicicleta_de_aire: 'bici',
    ej_arranque_mancuerna: 'cargada'
  };

  var PALABRAS = [
    [/estiramiento|movilidad|perro boca abajo|postura del|circulos de|90 90/, 'movilidad'],
    [/gato y camello|cuadrupedia|rotacion toracica|arrastre/, 'cuadrupedia'],
    [/peso muerto rumano|peso muerto a una pierna/, 'peso_muerto_rumano'],
    [/peso muerto/, 'peso_muerto'],
    [/sentadilla frontal|thruster/, 'sentadilla_frontal'],
    [/bulgara|desplante|zancada|lunge/, 'zancada'],
    [/goblet|sumo con mancuerna/, 'sentadilla_frontal'],
    [/talones|gemelo|pantorrilla/, 'gemelo'],
    [/hack|prensa/, 'prensa'],
    [/sentadilla/, 'sentadilla'],
    [/extension de cuadriceps/, 'extension_cuadriceps'],
    [/curl femoral/, 'curl_femoral'],
    [/subida al cajon|salto al cajon/, 'subida_cajon'],
    [/empuje de cadera|hip thrust/, 'hip_thrust'],
    [/puente/, 'puente_gluteo'],
    [/patada de gluteo|patada de burro/, 'patada_gluteo'],
    [/abduccion|caminata lateral/, 'abduccion'],
    [/hiperextension/, 'hiperextension'],
    [/press inclinado|press declinado/, 'press_inclinado'],
    [/press (de )?banca|press de piso|press de pecho|agarre cerrado/, 'press_banca'],
    [/aperturas|mariposa|pec deck/, 'apertura'],
    [/cruce de poleas/, 'cruce_polea'],
    [/lagartija|flexion/, 'flexion'],
    [/fondos/, 'fondo'],
    [/pullover/, 'pullover'],
    [/dominadas/, 'dominada'],
    [/jalon/, 'jalon'],
    [/remo al menton/, 'remo_menton'],
    [/remo invertido/, 'remo_invertido'],
    [/remo sentado|remo en maquina|remo en polea|remadora/, 'remo_polea'],
    [/remo/, 'remo'],
    [/encogimiento/, 'encogimiento'],
    [/face pull/, 'face_pull'],
    [/press militar|press de hombro|press arnold|press de hombros/, 'press_hombro'],
    [/elevaciones laterales|elevacion lateral/, 'elevacion_lateral'],
    [/elevaciones frontales|elevacion frontal/, 'elevacion_frontal'],
    [/pajaros|deltoides posterior/, 'pajaro'],
    [/curl martillo/, 'curl_martillo'],
    [/curl/, 'curl_biceps'],
    [/press frances/, 'press_frances'],
    [/triceps/, 'extension_triceps'],
    [/plancha/, 'plancha'],
    [/elevacion de piernas|elevacion de rodillas/, 'elevacion_piernas'],
    [/crunch|abdominales/, 'abdominal'],
    [/escaladores/, 'escaladores'],
    [/giro ruso/, 'giro_ruso'],
    [/lenador/, 'lenador'],
    [/caminadora|caminata en|trote|sprint|eliptica|escaladora|rodillas altas|correr|carrera/, 'correr'],
    [/bicicleta/, 'bici'],
    [/saltos de tijera|jumping/, 'salto'],
    [/cuerdas de batalla/, 'cuerdas_batalla'],
    [/salto de cuerda|cuerda/, 'cuerda'],
    [/burpee/, 'burpee'],
    [/trineo/, 'trineo'],
    [/balanceo|swing|kettlebell/, 'kettlebell_swing'],
    [/cargada|arranque/, 'cargada'],
    [/granjero/, 'caminata_granjero'],
    [/levantada turca/, 'levantada_turca'],
    [/balon/, 'balon'],
    [/salto/, 'salto']
  ];

  var GRUPO_EQUIPO = {
    pecho:   { barra: 'press_banca', mancuernas: 'press_banca', maquina: 'press_banca', polea: 'cruce_polea', banda: 'cruce_polea', peso_corporal: 'flexion' },
    espalda: { barra: 'remo', mancuernas: 'remo', kettlebell: 'remo', maquina: 'remo_polea', polea: 'jalon', banda: 'jalon', peso_corporal: 'dominada' },
    hombros: { polea: 'face_pull', banda: 'elevacion_lateral', peso_corporal: 'flexion' },
    biceps:  {},
    triceps: { barra: 'press_frances', peso_corporal: 'fondo' },
    piernas: { mancuernas: 'zancada', maquina: 'prensa', kettlebell: 'sentadilla_frontal' },
    gluteos: { peso_corporal: 'puente_gluteo', polea: 'patada_gluteo', maquina: 'patada_gluteo', banda: 'abduccion', mancuernas: 'peso_muerto_rumano' },
    abdomen: { polea: 'lenador', balon: 'giro_ruso' },
    cardio:  { peso_corporal: 'salto', maquina: 'trineo' },
    cuerpo_completo: { kettlebell: 'kettlebell_swing', barra: 'cargada', mancuernas: 'cargada', balon: 'balon', peso_corporal: 'burpee' },
    movilidad: {}
  };

  var GENERICO = {
    pecho: 'press_banca', espalda: 'remo', hombros: 'press_hombro', biceps: 'curl_biceps',
    triceps: 'extension_triceps', piernas: 'sentadilla', gluteos: 'hip_thrust', abdomen: 'abdominal',
    cardio: 'correr', cuerpo_completo: 'burpee', movilidad: 'movilidad'
  };

  var PATRON_DEFECTO = 'movilidad';
  var cacheMapeo = {};

  function ejercicioDe(entrada) {
    if (!entrada) return null;
    if (typeof entrada === 'object') return entrada;
    var id = String(entrada);
    try {
      if (AG.Data && typeof AG.Data.ejercicio === 'function') {
        var ej = AG.Data.ejercicio(id);
        if (ej) return ej;
      }
      if (AG.Data && Array.isArray(AG.Data.exercises)) {
        for (var i = 0; i < AG.Data.exercises.length; i++) {
          if (AG.Data.exercises[i] && AG.Data.exercises[i].id === id) return AG.Data.exercises[i];
        }
      }
    } catch (e) { /* catálogo no disponible: se resuelve por defecto */ }
    return null;
  }

  /* Devuelve { patron, via } donde via explica cómo se resolvió. */
  function resolver(entrada) {
    var ej = ejercicioDe(entrada);
    var id = ej && ej.id ? String(ej.id) : (typeof entrada === 'string' ? entrada : '');

    if (!ej) {
      if (id && P[id]) return { patron: id, via: 'patron' };
      return { patron: PATRON_DEFECTO, via: 'defecto' };
    }

    if (id && EXCEPCIONES[id] && P[EXCEPCIONES[id]]) return { patron: EXCEPCIONES[id], via: 'excepcion' };

    var nombre = normalizar(ej.nombre || '');
    if (nombre) {
      for (var i = 0; i < PALABRAS.length; i++) {
        if (PALABRAS[i][0].test(nombre) && P[PALABRAS[i][1]]) return { patron: PALABRAS[i][1], via: 'palabra' };
      }
    }

    var grupo = String(ej.grupo || '');
    var equipo = String(ej.equipo || '');
    if (GRUPO_EQUIPO[grupo] && GRUPO_EQUIPO[grupo][equipo] && P[GRUPO_EQUIPO[grupo][equipo]]) {
      return { patron: GRUPO_EQUIPO[grupo][equipo], via: 'grupo_equipo' };
    }
    if (GENERICO[grupo] && P[GENERICO[grupo]]) return { patron: GENERICO[grupo], via: 'grupo' };

    // Último recurso: por grupos secundarios
    if (Array.isArray(ej.grupos)) {
      for (var k = 0; k < ej.grupos.length; k++) {
        if (GENERICO[ej.grupos[k]] && P[GENERICO[ej.grupos[k]]]) return { patron: GENERICO[ej.grupos[k]], via: 'grupo' };
      }
    }
    return { patron: PATRON_DEFECTO, via: 'sin_patron' };
  }

  function patronDe(entrada) {
    var clave = (entrada && typeof entrada === 'object') ? String(entrada.id || '') : String(entrada || '');
    if (clave && cacheMapeo[clave]) return cacheMapeo[clave];
    var r = resolver(entrada);
    // No se guarda el resultado por defecto: el ejercicio podría darse de alta después
    if (clave && r.via !== 'defecto') cacheMapeo[clave] = r.patron;
    return r.patron;
  }

  /* =============================================================
     6. Envoltorio SVG, animación y API pública
     ============================================================= */

  var CSS_ANIMACION =
    '@keyframes agIlustraA{0%,44%{opacity:1}52%,94%{opacity:0}100%{opacity:1}}' +
    '@keyframes agIlustraB{0%,44%{opacity:0}52%,94%{opacity:1}100%{opacity:0}}' +
    '.ag-ilustra .ag-il-a{animation:agIlustraA ' + CICLO + 's ease-in-out infinite}' +
    '.ag-ilustra .ag-il-b{opacity:0;animation:agIlustraB ' + CICLO + 's ease-in-out infinite}' +
    '.ag-ilustra .ag-il-punto{transition:opacity .3s}' +
    '@media (prefers-reduced-motion:reduce){' +
      '.ag-ilustra .ag-il-a,.ag-ilustra .ag-il-b{animation:none!important}' +
      '.ag-ilustra .ag-il-b{opacity:0}' +
    '}';

  var estilosListos = false;

  function asegurarEstilos() {
    if (estilosListos) return;
    try {
      if (typeof document === 'undefined' || !document.head) return;
      if (!document.getElementById(ID_ESTILOS)) {
        var st = document.createElement('style');
        st.id = ID_ESTILOS;
        st.textContent = CSS_ANIMACION;
        document.head.appendChild(st);
      }
      estilosListos = true;
    } catch (e) { /* sin documento (pruebas fuera del navegador) */ }
  }

  function prefiereQuieto() {
    try {
      return !!(typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function opciones(opts) {
    var o = (opts && typeof opts === 'object') ? opts : {};
    var alto = Number(o.alto);
    if (!isFinite(alto) || alto <= 0) alto = ALTO_DEF;
    alto = Math.max(48, Math.min(640, Math.round(alto)));
    var fase = String(o.fase || 'ambas').toLowerCase();
    if (fase !== 'inicio' && fase !== 'fin') fase = 'ambas';
    return {
      alto: alto,
      animado: o.animado !== false,
      fase: fase,
      color: colorSeguro(o.color, COL.fig),
      fondo: o.fondo !== false,
      id: o.id ? String(o.id).replace(/[^a-zA-Z0-9_-]/g, '') : '',
      etiqueta: o.etiqueta ? String(o.etiqueta) : ''
    };
  }

  function dibujarFase(patron, fin, color) {
    var cuerpo = '';
    try { cuerpo = String(patron.dibujo(!!fin, color) || ''); }
    catch (e) { cuerpo = persona({ hom: [100, 52], cad: [100, 96], piernas: [[[100, 132], [100, 170]]] }, color); }
    return cuerpo;
  }

  function abrirSvg(o, aria, sufijoId) {
    var id = o.id ? (o.id + (sufijoId || '')) : nid();
    return '<svg class="ilustra-svg ag-ilustra" id="' + esc(id) + '" xmlns="http://www.w3.org/2000/svg"' +
      ' viewBox="0 0 ' + VB + ' ' + VB + '" width="100%" height="' + o.alto + '"' +
      ' preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(aria) + '"' +
      ' stroke-linecap="round" stroke-linejoin="round" data-patron="' + esc(o.patronId) + '"' +
      ' style="display:block;width:100%;max-width:100%;height:auto;aspect-ratio:1/1;max-height:' + o.alto + 'px;font-family:inherit">';
  }

  function capas(patron, o) {
    var s = '';
    if (o.fondo) s += fondoSuave();
    if (patron.suelo !== false && patron.suelo !== null) s += suelo(patron.suelo);
    return s;
  }

  function svgFase(patron, o, fin) {
    var aria = (o.etiqueta || patron.nombre) + ' — ' + (fin ? 'fin' : 'inicio');
    return abrirSvg(o, aria, fin ? '_fin' : '_inicio') + capas(patron, o) +
      dibujarFase(patron, fin, o.color) + '</svg>';
  }

  function svgAnimado(patron, o) {
    asegurarEstilos();
    var aria = (o.etiqueta || patron.nombre) + ': demostración del movimiento';
    return abrirSvg(o, aria, '') + capas(patron, o) +
      '<g class="ag-il-a">' + dibujarFase(patron, false, o.color) + '</g>' +
      '<g class="ag-il-b">' + dibujarFase(patron, true, o.color) + '</g>' +
      '</svg>';
  }

  function ambasFases(patron, o) {
    return '<div class="ilustra-fases" data-patron="' + esc(o.patronId) + '">' +
      '<div data-etiqueta="Inicio">' + svgFase(patron, o, false) + '</div>' +
      '<div data-etiqueta="Fin">' + svgFase(patron, o, true) + '</div>' +
      '</div>';
  }

  function porPatron(patronId, opts) {
    var id = String(patronId || '');
    var patron = P[id] || P[PATRON_DEFECTO];
    var o = opciones(opts);
    o.patronId = patron.id;
    if (o.fase === 'inicio') return svgFase(patron, o, false);
    if (o.fase === 'fin') return svgFase(patron, o, true);
    if (!o.animado || prefiereQuieto()) return ambasFases(patron, o);
    return svgAnimado(patron, o);
  }

  function get(ejercicioId, opts) {
    var ej = ejercicioDe(ejercicioId);
    var patron = patronDe(ejercicioId);
    var o = (opts && typeof opts === 'object') ? opts : {};
    if (!o.etiqueta && ej && ej.nombre) {
      var copia = {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) copia[k] = o[k];
      copia.etiqueta = ej.nombre;
      return porPatron(patron, copia);
    }
    return porPatron(patron, o);
  }

  function info(ejercicioId) {
    var ej = ejercicioDe(ejercicioId);
    var patronId = patronDe(ejercicioId);
    var patron = P[patronId] || P[PATRON_DEFECTO];
    return {
      patron: patron.id,
      nombre: patron.nombre,
      musculos: patron.musculos,
      consejo: patron.consejo,
      ejercicio: ej && ej.nombre ? ej.nombre : ''
    };
  }

  /* <figure class="ilustra"> listo para pegar en una tarjeta. */
  function figura(ejercicioId, opts) {
    var o = (opts && typeof opts === 'object') ? opts : {};
    var datos = info(ejercicioId);
    var titulo = o.titulo !== undefined ? String(o.titulo) : (datos.ejercicio || datos.nombre);
    var pie = '';
    if (o.pie !== false) {
      pie = '<figcaption class="ilustra-cap">' +
        (titulo ? '<b>' + esc(titulo) + '</b>' : '') +
        (o.consejo !== false && datos.consejo ? (titulo ? ' · ' : '') + esc(datos.consejo) : '') +
        '</figcaption>';
    }
    return '<figure class="ilustra' + (o.clase ? ' ' + esc(o.clase) : '') + '" data-patron="' + esc(datos.patron) + '">' +
      get(ejercicioId, o) + pie + '</figure>';
  }

  /* Cobertura del catálogo: qué ejercicio cayó en qué patrón. */
  function auditar() {
    var lista = (AG.Data && Array.isArray(AG.Data.exercises)) ? AG.Data.exercises : [];
    var salida = { sinPatron: [], porPatron: {}, porVia: {}, genericos: [], total: lista.length };
    for (var i = 0; i < lista.length; i++) {
      var ej = lista[i];
      if (!ej || !ej.id) continue;
      var r = resolver(ej);
      cacheMapeo[String(ej.id)] = r.patron;
      if (r.via === 'sin_patron' || r.via === 'defecto') salida.sinPatron.push(ej.id);
      if (r.via === 'grupo') salida.genericos.push(ej.id);
      if (!salida.porPatron[r.patron]) salida.porPatron[r.patron] = [];
      salida.porPatron[r.patron].push(ej.id);
      salida.porVia[r.via] = (salida.porVia[r.via] || 0) + 1;
    }
    return salida;
  }

  /* =============================================================
     7. Exportación
     ============================================================= */

  I.get = get;
  I.porPatron = porPatron;
  I.patronDe = patronDe;
  I.info = info;
  I.figura = figura;
  I.auditar = auditar;
  I.PATRONES = P;
  I.lista = ORDEN;
  I.PATRON_DEFECTO = PATRON_DEFECTO;
  I.viewBox = '0 0 ' + VB + ' ' + VB;
  I.ciclo = CICLO;
  I.asegurarEstilos = asegurarEstilos;

  AG.Ilustra = I;
})(window.AG);
