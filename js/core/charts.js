/* =============================================================
   ALLIANCE GYM — Motor de gráficas SVG (AG.Charts)
   -------------------------------------------------------------
   SVG puro, sin librerías, sin red. Cada función devuelve un
   STRING con un <svg> completo y responsivo (viewBox + ancho 100 %).
   Los colores salen de las variables del CSS (con respaldo fijo
   por si la gráfica se imprime en una ventana sin hoja de estilos).

   Depende únicamente de AG.Utils (de forma defensiva: si algún
   ayudante no existe, se usa un respaldo interno).
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  var Charts = {};

  /* =============================================================
     0. Paleta y constantes
     ============================================================= */

  var C = {
    rojo:   'var(--rojo,#E4322B)',
    rojo2:  'var(--rojo-2,#FF4A3D)',
    ok:     'var(--ok,#22C55E)',
    warn:   'var(--warn,#F59E0B)',
    error:  'var(--error,#EF4444)',
    info:   'var(--info,#3B82F6)',
    texto:  'var(--texto,#F2F3F5)',
    texto2: 'var(--texto-2,#A8AEB8)',
    texto3: 'var(--texto-3,#6E7681)',
    borde:  'var(--borde,#2B2F36)',
    borde2: 'var(--borde-2,#3A404A)',
    panel:  'var(--panel,#1D2025)',
    panel2: 'var(--panel-2,#24272E)',
    grid:   'var(--grid,rgba(168,174,184,.16))',
    eje:    'var(--eje,#6E7681)'
  };

  /* Paleta de series: usa --chart-1..8 del CSS. */
  var PALETA = [
    'var(--chart-1,#E4322B)', 'var(--chart-2,#3B82F6)', 'var(--chart-3,#22C55E)',
    'var(--chart-4,#F59E0B)', 'var(--chart-5,#A855F7)', 'var(--chart-6,#06B6D4)',
    'var(--chart-7,#EC4899)', 'var(--chart-8,#84CC16)'
  ];

  var DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  /* Contador propio para generar identificadores únicos (degradados, clases). */
  var secuencia = 0;

  function nid(prefijo) {
    secuencia += 1;
    return 'ag' + (prefijo || 'g') + secuencia;
  }

  /* =============================================================
     1. Ayudantes generales
     ============================================================= */

  function esc(valor) {
    var t = (valor === null || valor === undefined) ? '' : String(valor);
    if (AG.Utils && typeof AG.Utils.esc === 'function') {
      try { return String(AG.Utils.esc(t)); } catch (e) { /* respaldo abajo */ }
    }
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function esNum(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return false;
    var n = Number(v);
    return !isNaN(n) && isFinite(n);
  }

  function nm(v, alt) { return esNum(v) ? Number(v) : (alt === undefined ? 0 : alt); }

  function r(n) {
    var v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  function limita(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function corta(texto, largo) {
    var t = (texto === null || texto === undefined) ? '' : String(texto);
    if (!largo || t.length <= largo) return t;
    return t.slice(0, Math.max(1, largo - 1)) + '…';
  }

  /* Acepta sólo colores con forma válida; si no, devuelve el de respaldo. */
  function colorSeguro(color, alterno) {
    var alt = alterno || C.rojo;
    if (typeof color !== 'string') return alt;
    var t = color.trim();
    if (!t) return alt;
    if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
    if (/^(rgb|hsl)a?\([0-9a-zA-Z%.,\s\/-]+\)$/.test(t)) return t;
    if (/^var\(\s*--[a-zA-Z0-9_-]+\s*(,[^;{}<>]*)?\)$/.test(t)) return t;
    if (/^[a-zA-Z]{3,22}$/.test(t)) return t;
    return alt;
  }

  function minMax(lista) {
    var mn = Infinity, mx = -Infinity, i;
    for (i = 0; i < lista.length; i++) {
      var v = lista[i];
      if (!isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === Infinity) { mn = 0; mx = 1; }
    return { min: mn, max: mx };
  }

  /* ---------- Formato de números ---------- */

  function decAuto(v) {
    var n = Number(v);
    if (n % 1 === 0) return 0;
    var a = Math.abs(n);
    if (a >= 100) return 0;
    if (a >= 10) return 1;
    if (a >= 1) return 1;
    return 2;
  }

  function fmtNum(v, dec) {
    if (!esNum(v)) return '—';
    var n = Number(v);
    if (dec === null || dec === undefined) dec = decAuto(n);
    if (AG.Utils && typeof AG.Utils.num === 'function') {
      try {
        var t = AG.Utils.num(n, dec);
        if (t !== null && t !== undefined && String(t) !== 'NaN') return String(t);
      } catch (e) { /* respaldo abajo */ }
    }
    return n.toFixed(dec);
  }

  /* Valor completo con prefijo/sufijo de opts (ej. '$1,250' o '78.4 kg'). */
  function fmtValor(v, o, dec) {
    if (!esNum(v)) return '—';
    var op = o || {};
    var d = (dec !== null && dec !== undefined) ? dec
          : (esNum(op.decimales) ? Number(op.decimales) : null);
    return (op.prefijo || '') + fmtNum(v, d) + (op.sufijo || '');
  }

  /* Decimales adecuados según el paso de la escala. */
  function decDePaso(paso) {
    if (!esNum(paso) || paso <= 0) return 0;
    var x = Math.abs(Number(paso)), d = 0;
    while (Math.abs(Math.round(x) - x) > 1e-9 && d < 4) { x *= 10; d += 1; }
    return d;
  }

  /* Etiqueta compacta para el eje (12 500 -> '13k'). */
  function fmtEje(v, o, dec) {
    if (!esNum(v)) return '';
    var op = o || {}, n = Number(v), a = Math.abs(n), cuerpo;
    if (a >= 1000000) cuerpo = fmtNum(n / 1000000, (a % 1000000 === 0) ? 0 : 1) + 'M';
    else if (a >= 10000) cuerpo = fmtNum(n / 1000, (a % 1000 === 0) ? 0 : 1) + 'k';
    else cuerpo = fmtNum(n, dec);
    return (op.prefijo || '') + cuerpo + (op.sufijoEje || '');
  }

  /* '+1.2 kg' / '−0.8 kg' */
  function signoTexto(v, dec, unidad) {
    if (!esNum(v)) return '—';
    var n = Number(v);
    if (AG.Utils && typeof AG.Utils.signo === 'function') {
      try {
        var t = AG.Utils.signo(n, dec, unidad || '');
        if (t !== null && t !== undefined && String(t) !== 'NaN') return String(t);
      } catch (e) { /* respaldo abajo */ }
    }
    var s = n > 0 ? '+' : (n < 0 ? '−' : '');
    return s + fmtNum(Math.abs(n), dec) + (unidad ? ' ' + unidad : '');
  }

  /* =============================================================
     2. Envoltura SVG, estilos y estado vacío
     ============================================================= */

  /* Estilos internos, acotados por la clase única de cada gráfica
     (así viajan con el string aunque se imprima o se copie). */
  function estilos(cls) {
    var p = '.' + cls + ' ';
    return '<style>' +
      p + 'text{font-family:inherit;}' +
      p + '.t-eje{font-size:10px;fill:' + C.texto3 + ';}' +
      p + '.t-lbl{font-size:11px;fill:' + C.texto2 + ';}' +
      p + '.t-val{font-size:11px;font-weight:700;fill:' + C.texto + ';}' +
      p + '.t-tit{font-size:12.5px;font-weight:700;fill:' + C.texto + ';}' +
      p + '.t-mini{font-size:9px;fill:' + C.texto3 + ';}' +
      p + '.t-blanco{font-size:10px;font-weight:700;fill:#fff;}' +
      p + '.rejilla{stroke:' + C.grid + ';stroke-width:1;shape-rendering:crispEdges;}' +
      p + '.base{stroke:' + C.borde2 + ';stroke-width:1;shape-rendering:crispEdges;}' +
      p + '.cero{stroke:' + C.eje + ';stroke-width:1;opacity:.7;shape-rendering:crispEdges;}' +
      '</style>';
  }

  function svgIni(W, H, cls, aria, estiloExtra) {
    return '<svg class="ag-grafica ' + cls + '" xmlns="http://www.w3.org/2000/svg"' +
      ' viewBox="0 0 ' + r(W) + ' ' + r(H) + '" width="100%" height="' + r(H) + '"' +
      ' preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(aria || 'Gráfica') + '"' +
      ' style="display:block;width:100%;height:auto;font-family:inherit' +
      (estiloExtra ? ';' + estiloExtra : '') + '">' + estilos(cls);
  }

  function svgFin() { return '</svg>'; }

  function iconoVacio() {
    return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"' +
      ' style="stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">' +
      '<path d="M3 3v16.5h18"/>' +
      '<path d="M7.5 17V12"/><path d="M12 17V8"/><path d="M16.5 17v-3.2"/><path d="M21 17V6"/>' +
      '</svg>';
  }

  /* Bloque .empty (nunca un SVG roto). */
  function vacio(mensaje, alto) {
    var h = Math.max(110, nm(alto, 160));
    return '<div class="empty" style="min-height:' + r(h) + 'px">' +
      '<div class="empty-icono">' + iconoVacio() + '</div>' +
      '<p class="empty-texto">' + esc(mensaje || 'Todavía no hay datos para mostrar.') + '</p>' +
      '</div>';
  }

  /* =============================================================
     3. Escalas con “números redondos”
     ============================================================= */

  function pasoNice(crudo) {
    if (!esNum(crudo) || crudo <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log(crudo) / Math.LN10));
    var norm = crudo / mag;
    var m = norm <= 1 ? 1 : (norm <= 2 ? 2 : (norm <= 2.5 ? 2.5 : (norm <= 5 ? 5 : 10)));
    return m * mag;
  }

  function limpiaFlotante(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return parseFloat(n.toPrecision(12));
  }

  /* Devuelve {min, max, ticks, paso} con 10 % de holgura y cortes redondos. */
  function calcularEscala(minDato, maxDato, cuantos, desdeCero) {
    var min = esNum(minDato) ? Number(minDato) : 0;
    var max = esNum(maxDato) ? Number(maxDato) : 1;
    if (min > max) { var t = min; min = max; max = t; }
    cuantos = Math.max(2, Math.min(8, nm(cuantos, 4)));

    if (desdeCero) {
      if (min > 0) min = 0;
      if (max < 0) max = 0;
    }

    if (min === max) {
      if (min === 0) { max = 1; }
      else {
        var d = Math.abs(min) * 0.15 || 1;
        if (desdeCero) { if (max > 0) max += d; else min -= d; }
        else { min -= d; max += d; }
      }
    } else {
      var holgura = (max - min) * 0.10;
      if (desdeCero) {
        if (max > 0) max += holgura;
        if (min < 0) min -= holgura;
      } else {
        min -= holgura;
        max += holgura;
      }
    }

    var paso = pasoNice((max - min) / cuantos);
    if (!esNum(paso) || paso <= 0) paso = 1;

    var nMin = Math.floor(min / paso) * paso;
    var nMax = Math.ceil(max / paso) * paso;
    if (desdeCero) {
      if (nMin > 0) nMin = 0;
      if (nMax < 0) nMax = 0;
    }
    if (nMax <= nMin) nMax = nMin + paso;

    var ticks = [], v = nMin, guardia = 0;
    while (v <= nMax + paso * 1e-6 && guardia < 40) {
      ticks.push(limpiaFlotante(v));
      v += paso;
      guardia += 1;
    }
    if (ticks.length < 2) ticks = [limpiaFlotante(nMin), limpiaFlotante(nMin + paso)];

    return {
      min: ticks[0],
      max: ticks[ticks.length - 1],
      ticks: ticks,
      paso: paso
    };
  }

  /* =============================================================
     4. Geometría (trazos reutilizables)
     ============================================================= */

  function polar(cx, cy, rad, ang) {
    return { x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang) };
  }

  /* Barra vertical con las dos esquinas de la punta redondeadas. */
  function barraV(x, y, w, h, rad, haciaAbajo) {
    w = Math.max(0, w); h = Math.max(0, h);
    if (w <= 0 || h <= 0.4) return '';
    var q = Math.max(0, Math.min(nm(rad, 4), w / 2, h));
    if (haciaAbajo) {
      return 'M' + r(x) + ',' + r(y) +
        ' L' + r(x) + ',' + r(y + h - q) +
        ' Q' + r(x) + ',' + r(y + h) + ' ' + r(x + q) + ',' + r(y + h) +
        ' L' + r(x + w - q) + ',' + r(y + h) +
        ' Q' + r(x + w) + ',' + r(y + h) + ' ' + r(x + w) + ',' + r(y + h - q) +
        ' L' + r(x + w) + ',' + r(y) + ' Z';
    }
    return 'M' + r(x) + ',' + r(y + h) +
      ' L' + r(x) + ',' + r(y + q) +
      ' Q' + r(x) + ',' + r(y) + ' ' + r(x + q) + ',' + r(y) +
      ' L' + r(x + w - q) + ',' + r(y) +
      ' Q' + r(x + w) + ',' + r(y) + ' ' + r(x + w) + ',' + r(y + q) +
      ' L' + r(x + w) + ',' + r(y + h) + ' Z';
  }

  /* Barra horizontal con las esquinas de la punta redondeadas. */
  function barraH(x, y, w, h, rad, haciaIzquierda) {
    w = Math.max(0, w); h = Math.max(0, h);
    if (h <= 0 || w <= 0.4) return '';
    var q = Math.max(0, Math.min(nm(rad, 4), h / 2, w));
    if (haciaIzquierda) {
      return 'M' + r(x + w) + ',' + r(y) +
        ' L' + r(x + q) + ',' + r(y) +
        ' Q' + r(x) + ',' + r(y) + ' ' + r(x) + ',' + r(y + q) +
        ' L' + r(x) + ',' + r(y + h - q) +
        ' Q' + r(x) + ',' + r(y + h) + ' ' + r(x + q) + ',' + r(y + h) +
        ' L' + r(x + w) + ',' + r(y + h) + ' Z';
    }
    return 'M' + r(x) + ',' + r(y) +
      ' L' + r(x + w - q) + ',' + r(y) +
      ' Q' + r(x + w) + ',' + r(y) + ' ' + r(x + w) + ',' + r(y + q) +
      ' L' + r(x + w) + ',' + r(y + h - q) +
      ' Q' + r(x + w) + ',' + r(y + h) + ' ' + r(x + w - q) + ',' + r(y + h) +
      ' L' + r(x) + ',' + r(y + h) + ' Z';
  }

  /* Segmento de anillo (arcos A, nunca stroke-dasharray). */
  function arcoAnillo(cx, cy, rExt, rInt, a0, a1) {
    var barrido = a1 - a0;
    if (barrido <= 0) return '';
    if (barrido > Math.PI * 2) barrido = Math.PI * 2;
    var grande = barrido > Math.PI ? 1 : 0;
    var e0 = polar(cx, cy, rExt, a0), e1 = polar(cx, cy, rExt, a0 + barrido);
    var i1 = polar(cx, cy, rInt, a0 + barrido), i0 = polar(cx, cy, rInt, a0);
    return 'M' + r(e0.x) + ',' + r(e0.y) +
      ' A' + r(rExt) + ',' + r(rExt) + ' 0 ' + grande + ' 1 ' + r(e1.x) + ',' + r(e1.y) +
      ' L' + r(i1.x) + ',' + r(i1.y) +
      ' A' + r(rInt) + ',' + r(rInt) + ' 0 ' + grande + ' 0 ' + r(i0.x) + ',' + r(i0.y) + ' Z';
  }

  function arcoSimple(cx, cy, rad, a0, a1) {
    var barrido = Math.min(a1 - a0, Math.PI * 2 - 0.0001);
    var grande = barrido > Math.PI ? 1 : 0;
    var p0 = polar(cx, cy, rad, a0), p1 = polar(cx, cy, rad, a0 + barrido);
    return 'M' + r(p0.x) + ',' + r(p0.y) +
      ' A' + r(rad) + ',' + r(rad) + ' 0 ' + grande + ' 1 ' + r(p1.x) + ',' + r(p1.y);
  }

  /* Trazo de línea recta o suave (Catmull-Rom convertido a Bézier). */
  function rutaLinea(p, suave) {
    if (!p || !p.length) return '';
    var d = 'M' + r(p[0].x) + ',' + r(p[0].y), i;
    if (p.length === 1) return d;
    if (!suave) {
      for (i = 1; i < p.length; i++) d += ' L' + r(p[i].x) + ',' + r(p[i].y);
      return d;
    }
    for (i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + r(c1x) + ',' + r(c1y) + ' ' + r(c2x) + ',' + r(c2y) + ' ' + r(p2.x) + ',' + r(p2.y);
    }
    return d;
  }

  /* Triángulo (flecha) apuntando arriba, abajo o guion si no hay cambio. */
  function flecha(cx, cy, tam, direccion) {
    var t = tam || 5;
    if (direccion > 0) {
      return '<path d="M' + r(cx) + ',' + r(cy - t) + ' L' + r(cx + t) + ',' + r(cy + t * 0.7) +
        ' L' + r(cx - t) + ',' + r(cy + t * 0.7) + ' Z"/>';
    }
    if (direccion < 0) {
      return '<path d="M' + r(cx) + ',' + r(cy + t) + ' L' + r(cx + t) + ',' + r(cy - t * 0.7) +
        ' L' + r(cx - t) + ',' + r(cy - t * 0.7) + ' Z"/>';
    }
    return '<rect x="' + r(cx - t) + '" y="' + r(cy - 1) + '" width="' + r(t * 2) + '" height="2" rx="1"/>';
  }

  /* Degradado vertical reutilizable para áreas. */
  function degradado(id, color, opacidad) {
    var op = (opacidad === undefined) ? 0.32 : opacidad;
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" style="stop-color:' + color + ';stop-opacity:' + op + '"/>' +
      '<stop offset="100%" style="stop-color:' + color + ';stop-opacity:0"/>' +
      '</linearGradient>';
  }

  /* =============================================================
     5. Normalización de entradas
     ============================================================= */

  function normPuntos(lista) {
    var salida = [];
    if (!lista || !lista.length) return salida;
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i], x, y, et;
      if (p === null || p === undefined) continue;
      if (typeof p === 'number' || (typeof p === 'string' && esNum(p))) {
        x = String(i + 1); y = Number(p); et = x;
      } else if (typeof p === 'object') {
        y = (p.y !== undefined) ? p.y : ((p.valor !== undefined) ? p.valor : null);
        x = (p.x !== undefined) ? p.x
          : ((p.fecha !== undefined) ? p.fecha
          : ((p.etiqueta !== undefined) ? p.etiqueta : (i + 1)));
        et = (p.etiqueta !== undefined) ? p.etiqueta : x;
      } else {
        continue;
      }
      salida.push({ x: String(x), et: String(et), y: esNum(y) ? Number(y) : null });
    }
    return salida;
  }

  /* Acepta [{x,y}] | [numeros] | [{nombre,color,puntos}] */
  function normSeries(series, opts) {
    var res = [], o = opts || {};
    if (!series) return res;
    var arr = series;
    if (!(arr instanceof Array)) {
      if (typeof arr === 'object' && arr.puntos instanceof Array) arr = [arr];
      else return res;
    }
    if (!arr.length) return res;

    var multi = false, k;
    for (k = 0; k < arr.length; k++) {
      if (arr[k] && typeof arr[k] === 'object' && arr[k].puntos instanceof Array) { multi = true; break; }
    }

    if (multi) {
      for (k = 0; k < arr.length; k++) {
        var s = arr[k];
        if (!s || !(s.puntos instanceof Array)) continue;
        res.push({
          nombre: (s.nombre !== undefined && s.nombre !== null) ? String(s.nombre) : ('Serie ' + (k + 1)),
          color: colorSeguro(s.color, PALETA[res.length % PALETA.length]),
          puntos: normPuntos(s.puntos),
          guiones: !!s.guiones
        });
      }
    } else {
      res.push({
        nombre: (o.nombre !== undefined && o.nombre !== null) ? String(o.nombre) : '',
        color: colorSeguro(o.color, PALETA[0]),
        puntos: normPuntos(arr),
        guiones: false
      });
    }

    var limpio = [];
    for (k = 0; k < res.length; k++) {
      var tiene = false;
      for (var j = 0; j < res[k].puntos.length; j++) {
        if (res[k].puntos[j].y !== null) { tiene = true; break; }
      }
      if (tiene) limpio.push(res[k]);
    }
    return limpio;
  }

  /* Categorías del eje X (unión ordenada de todas las series). */
  function categorias(series, ordenar) {
    var cats = [], mapa = Object.create(null), i, j;
    for (i = 0; i < series.length; i++) {
      for (j = 0; j < series[i].puntos.length; j++) {
        var x = series[i].puntos[j].x;
        if (mapa[x] === undefined) { mapa[x] = true; cats.push(x); }
      }
    }
    if (ordenar !== false && cats.length > 1) {
      var todosNum = true, todosIso = true;
      for (i = 0; i < cats.length; i++) {
        if (!esNum(cats[i])) todosNum = false;
        if (!/^\d{4}-\d{2}(-\d{2})?$/.test(cats[i])) todosIso = false;
      }
      if (todosNum) cats.sort(function (a, b) { return Number(a) - Number(b); });
      else if (todosIso) cats.sort();
    }
    var idx = Object.create(null);
    for (i = 0; i < cats.length; i++) idx[cats[i]] = i;
    return { lista: cats, idx: idx };
  }

  /* Acepta [{etiqueta,valor,color}] | [numeros] */
  function normDatos(datos) {
    var salida = [];
    if (!datos || !(datos instanceof Array)) return salida;
    for (var i = 0; i < datos.length; i++) {
      var d = datos[i], etiqueta, valor, color;
      if (d === null || d === undefined) continue;
      if (typeof d === 'number' || (typeof d === 'string' && esNum(d))) {
        etiqueta = String(i + 1); valor = Number(d); color = null;
      } else if (typeof d === 'object') {
        valor = (d.valor !== undefined) ? d.valor : ((d.y !== undefined) ? d.y : null);
        if (!esNum(valor)) continue;
        valor = Number(valor);
        etiqueta = (d.etiqueta !== undefined && d.etiqueta !== null) ? String(d.etiqueta)
          : ((d.nombre !== undefined && d.nombre !== null) ? String(d.nombre) : String(i + 1));
        color = d.color || null;
      } else {
        continue;
      }
      salida.push({ etiqueta: etiqueta, valor: valor, color: color });
    }
    return salida;
  }

  /* =============================================================
     6. Piezas comunes de ejes
     ============================================================= */

  /* Rejilla horizontal + etiquetas del eje Y. */
  function rejillaY(escala, x0, x1, yPos, o, dec) {
    var s = '', i;
    var op = o || {};
    for (i = 0; i < escala.ticks.length; i++) {
      var t = escala.ticks[i], y = yPos(t);
      var clase = (t === 0 && escala.min < 0) ? 'cero' : 'rejilla';
      s += '<line class="' + clase + '" x1="' + r(x0) + '" y1="' + r(y) + '" x2="' + r(x1) + '" y2="' + r(y) + '"/>';
      s += '<text class="t-eje" x="' + r(x0 - 8) + '" y="' + r(y + 3.5) + '" text-anchor="end">' +
        esc(fmtEje(t, op, dec)) + '</text>';
    }
    return s;
  }

  /* Rejilla vertical + etiquetas (para barras horizontales). */
  function rejillaX(escala, y0, y1, xPos, o, dec) {
    var s = '', i;
    var op = o || {};
    for (i = 0; i < escala.ticks.length; i++) {
      var t = escala.ticks[i], x = xPos(t);
      var clase = (t === 0 && escala.min < 0) ? 'cero' : 'rejilla';
      s += '<line class="' + clase + '" x1="' + r(x) + '" y1="' + r(y0) + '" x2="' + r(x) + '" y2="' + r(y1) + '"/>';
      s += '<text class="t-eje" x="' + r(x) + '" y="' + r(y1 + 14) + '" text-anchor="middle">' +
        esc(fmtEje(t, op, dec)) + '</text>';
    }
    return s;
  }

  /* Etiquetas del eje X, rotadas cuando hay más de 8 puntos. */
  function ejeXTexto(etiquetas, xPos, y, forzarRotar) {
    var n = etiquetas.length;
    if (!n) return '';
    var rotar = (forzarRotar === undefined) ? (n > 8) : !!forzarRotar;
    var maxEtiquetas = rotar ? 16 : 11;
    var salto = Math.max(1, Math.ceil(n / maxEtiquetas));
    var s = '', ultimo = -99, i;
    for (i = 0; i < n; i++) {
      var dibujar = (i % salto === 0);
      if (!dibujar && i === n - 1 && (i - ultimo) >= Math.max(1, salto - 1)) dibujar = true;
      if (!dibujar) continue;
      ultimo = i;
      var x = xPos(i), et = esc(corta(etiquetas[i], rotar ? 12 : 11));
      if (rotar) {
        s += '<text class="t-eje" x="' + r(x) + '" y="' + r(y) + '" text-anchor="end"' +
          ' transform="rotate(-45 ' + r(x) + ' ' + r(y) + ')">' + et + '</text>';
      } else {
        s += '<text class="t-eje" x="' + r(x) + '" y="' + r(y) + '" text-anchor="middle">' + et + '</text>';
      }
    }
    return s;
  }

  /* Leyenda horizontal de series. */
  function leyendaSeries(items, x, y, anchoMax) {
    var s = '', cx = x, i;
    for (i = 0; i < items.length; i++) {
      var nombre = corta(items[i].nombre || ('Serie ' + (i + 1)), 20);
      var ancho = 14 + nombre.length * 6.3 + 14;
      if (cx + ancho > x + anchoMax && cx > x) break;
      s += '<rect x="' + r(cx) + '" y="' + r(y - 7) + '" width="10" height="10" rx="3" style="fill:' + items[i].color + '"/>';
      s += '<text class="t-lbl" x="' + r(cx + 15) + '" y="' + r(y + 2) + '">' + esc(nombre) + '</text>';
      cx += ancho;
    }
    return s;
  }

  /* Título vertical del eje Y. */
  function tituloY(texto, x, yCentro) {
    return '<text class="t-mini" x="' + r(x) + '" y="' + r(yCentro) + '" text-anchor="middle"' +
      ' transform="rotate(-90 ' + r(x) + ' ' + r(yCentro) + ')">' + esc(corta(texto, 28)) + '</text>';
  }

  /* =============================================================
     7. linea(series, opts)
     ============================================================= */

  Charts.linea = function (series, opts) {
    var o = opts || {};
    var S = normSeries(series, o);
    if (!S.length) return vacio(o.vacio || 'Aún no hay datos suficientes para trazar la gráfica.', o.alto);

    var cat = categorias(S, o.ordenarX);
    var cats = cat.lista;
    if (!cats.length) return vacio(o.vacio || 'Aún no hay datos suficientes para trazar la gráfica.', o.alto);

    /* Etiquetas visibles por categoría */
    var mapaEt = Object.create(null), i, j;
    for (i = 0; i < S.length; i++) {
      for (j = 0; j < S[i].puntos.length; j++) {
        var pp = S[i].puntos[j];
        if (mapaEt[pp.x] === undefined) mapaEt[pp.x] = pp.et;
      }
    }
    var etiquetas = [];
    for (i = 0; i < cats.length; i++) etiquetas.push(mapaEt[cats[i]] !== undefined ? mapaEt[cats[i]] : cats[i]);

    var valores = [];
    for (i = 0; i < S.length; i++) {
      for (j = 0; j < S[i].puntos.length; j++) if (S[i].puntos[j].y !== null) valores.push(S[i].puntos[j].y);
    }
    if (!valores.length) return vacio(o.vacio || 'Aún no hay datos suficientes para trazar la gráfica.', o.alto);

    var mm = minMax(valores);
    var escala = calcularEscala(mm.min, mm.max, o.ticks || 4, o.desdeCero === true);
    var dec = decDePaso(escala.paso);

    var W = Math.max(240, nm(o.ancho, 720));
    var H = Math.max(140, nm(o.alto, 260));
    var cls = nid('ln');
    var sinEjes = !!o.sinEjes;
    var conLeyenda = (o.leyenda !== false) && S.length > 1;
    var rotar = cats.length > 8;
    var conTituloY = !sinEjes && !!o.etiquetaY;

    var mIzq = sinEjes ? 6 : (conTituloY ? 62 : 46);
    var mDer = sinEjes ? 6 : 16;
    var mArr = (conLeyenda ? 28 : 14);
    var mAba = sinEjes ? 6 : (rotar ? 48 : 28);
    var x0 = mIzq, x1 = W - mDer, y0 = mArr, y1 = H - mAba;

    var rango = (escala.max - escala.min) || 1;
    function xPos(idx) {
      return cats.length <= 1 ? (x0 + x1) / 2 : x0 + (idx / (cats.length - 1)) * (x1 - x0);
    }
    function yPos(v) { return y1 - ((v - escala.min) / rango) * (y1 - y0); }

    var opEje = { prefijo: o.prefijo || '', sufijoEje: (o.sufijo && String(o.sufijo).length <= 2) ? String(o.sufijo) : '' };
    var defs = '', cuerpo = '';
    var conArea = (o.area !== undefined) ? !!o.area : (S.length === 1);
    var suave = !!o.suave;

    if (!sinEjes) {
      cuerpo += rejillaY(escala, x0, x1, yPos, opEje, dec);
      cuerpo += '<line class="base" x1="' + r(x0) + '" y1="' + r(y1) + '" x2="' + r(x1) + '" y2="' + r(y1) + '"/>';
      cuerpo += ejeXTexto(etiquetas, xPos, rotar ? y1 + 16 : y1 + 17, rotar);
      if (conTituloY) cuerpo += tituloY(o.etiquetaY, 14, (y0 + y1) / 2);
    }

    /* El área baja hasta el cero cuando la escala lo cruza; si no, hasta el piso. */
    var yBaseArea = (escala.min < 0 && escala.max > 0) ? limita(yPos(0), y0, y1) : y1;

    var totalPuntos = 0;
    for (i = 0; i < S.length; i++) totalPuntos += S[i].puntos.length;
    var radioPunto = totalPuntos > 60 ? 0 : (totalPuntos > 26 ? 2.2 : 3.2);

    for (i = 0; i < S.length; i++) {
      var s = S[i];
      var color = s.color;
      var idGrad = cls + '-ar' + i;
      var celdas = [];
      for (j = 0; j < cats.length; j++) celdas.push(null);
      for (j = 0; j < s.puntos.length; j++) {
        var p = s.puntos[j];
        var k = cat.idx[p.x];
        if (k === undefined || p.y === null) continue;
        celdas[k] = { x: xPos(k), y: yPos(p.y), v: p.y, i: k };
      }

      /* Segmentos continuos (los huecos cortan la línea) */
      var segmentos = [], actual = [];
      for (j = 0; j < celdas.length; j++) {
        if (celdas[j]) actual.push(celdas[j]);
        else if (actual.length) { segmentos.push(actual); actual = []; }
      }
      if (actual.length) segmentos.push(actual);

      if (conArea) defs += degradado(idGrad, color, 0.3);

      for (j = 0; j < segmentos.length; j++) {
        var seg = segmentos[j];
        if (seg.length >= 2) {
          var d = rutaLinea(seg, suave);
          if (conArea) {
            cuerpo += '<path d="' + d + ' L' + r(seg[seg.length - 1].x) + ',' + r(yBaseArea) +
              ' L' + r(seg[0].x) + ',' + r(yBaseArea) + ' Z" style="fill:url(#' + idGrad + ');stroke:none"/>';
          }
          cuerpo += '<path d="' + d + '" style="fill:none;stroke:' + color +
            ';stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round' +
            (s.guiones ? ';stroke-dasharray:6 5' : '') + '"/>';
        }
      }

      /* Puntos con tooltip nativo */
      for (j = 0; j < celdas.length; j++) {
        var c = celdas[j];
        if (!c) continue;
        var titulo = (s.nombre ? s.nombre + ' · ' : '') + etiquetas[c.i] + ': ' + fmtValor(c.v, o);
        var rad = radioPunto || (segmentos.length && celdas.length === 1 ? 3.2 : 0);
        if (rad > 0) {
          cuerpo += '<circle cx="' + r(c.x) + '" cy="' + r(c.y) + '" r="' + r(rad) + '"' +
            ' style="fill:' + color + ';stroke:' + C.panel + ';stroke-width:1.6">' +
            '<title>' + esc(titulo) + '</title></circle>';
        } else {
          cuerpo += '<circle cx="' + r(c.x) + '" cy="' + r(c.y) + '" r="6" style="fill:transparent">' +
            '<title>' + esc(titulo) + '</title></circle>';
        }
      }
    }

    if (conLeyenda) cuerpo = leyendaSeries(S, x0, 12, x1 - x0) + cuerpo;

    return svgIni(W, H, cls, o.aria || 'Gráfica de línea') +
      (defs ? '<defs>' + defs + '</defs>' : '') + cuerpo + svgFin();
  };

  /* =============================================================
     8. barras(datos, opts)
     ============================================================= */

  Charts.barras = function (datos, opts) {
    var o = opts || {};
    var D = normDatos(datos);
    if (!D.length) return vacio(o.vacio || 'Todavía no hay valores que comparar.', o.alto);

    var valores = [], i;
    for (i = 0; i < D.length; i++) valores.push(D[i].valor);
    var mm = minMax(valores);
    var escala = calcularEscala(mm.min, mm.max, o.ticks || 4, o.desdeCero !== false);
    var dec = decDePaso(escala.paso);
    var cls = nid('br');
    var sinEjes = !!o.sinEjes;
    var colorBase = colorSeguro(o.color, C.rojo);
    var opEje = { prefijo: o.prefijo || '', sufijoEje: (o.sufijo && String(o.sufijo).length <= 2) ? String(o.sufijo) : '' };
    var cuerpo = '';

    if (o.horizontal) {
      /* ---------- Barras horizontales ---------- */
      var altoFila = limita(nm(o.filaAlto, 34), 22, 54);
      var H2 = Math.max(120, nm(o.alto, D.length * altoFila + (sinEjes ? 16 : 34)));
      var W2 = Math.max(280, nm(o.ancho, 720));
      var mIzq2 = sinEjes ? 8 : limita(nm(o.anchoEtiquetas, 118), 60, 220);
      var mDer2 = 58, mArr2 = 8, mAba2 = sinEjes ? 8 : 22;
      var ax0 = mIzq2, ax1 = W2 - mDer2, ay0 = mArr2, ay1 = H2 - mAba2;
      var rangoH = (escala.max - escala.min) || 1;

      var xPosH = function (v) { return ax0 + ((v - escala.min) / rangoH) * (ax1 - ax0); };
      var bandaH = (ay1 - ay0) / D.length;
      var grosorH = Math.min(30, bandaH * 0.62);
      var xCeroH = limita(xPosH(escala.min < 0 ? 0 : escala.min), ax0, ax1);

      if (!sinEjes) cuerpo += rejillaX(escala, ay0, ay1, xPosH, opEje, dec);
      cuerpo += '<line class="base" x1="' + r(xCeroH) + '" y1="' + r(ay0) + '" x2="' + r(xCeroH) + '" y2="' + r(ay1) + '"/>';

      for (i = 0; i < D.length; i++) {
        var dH = D[i];
        var cH = colorSeguro(dH.color, colorBase);
        var yc = ay0 + bandaH * (i + 0.5);
        var yb = yc - grosorH / 2;
        var xv = xPosH(dH.valor);
        var negH = xv < xCeroH;
        var anchoB = Math.abs(xv - xCeroH);
        var xb = negH ? xv : xCeroH;
        var dPath = barraH(xb, yb, anchoB, grosorH, 5, negH);
        if (dPath) {
          cuerpo += '<path d="' + dPath + '" style="fill:' + cH + '">' +
            '<title>' + esc(dH.etiqueta + ': ' + fmtValor(dH.valor, o)) + '</title></path>';
        }
        if (!sinEjes) {
          cuerpo += '<text class="t-lbl" x="' + r(ax0 - 10) + '" y="' + r(yc + 4) + '" text-anchor="end">' +
            esc(corta(dH.etiqueta, Math.max(6, Math.floor((mIzq2 - 12) / 6.2)))) + '</text>';
        }
        var xTexto = negH ? (xb - 6) : (xb + anchoB + 6);
        cuerpo += '<text class="t-val" x="' + r(limita(xTexto, 4, W2 - 4)) + '" y="' + r(yc + 4) + '" text-anchor="' +
          (negH ? 'end' : 'start') + '">' + esc(fmtValor(dH.valor, o)) + '</text>';
      }

      return svgIni(W2, H2, cls, o.aria || 'Gráfica de barras horizontales') + cuerpo + svgFin();
    }

    /* ---------- Barras verticales ---------- */
    var W = Math.max(240, nm(o.ancho, 720));
    var H = Math.max(150, nm(o.alto, 260));
    var rotarB = D.length > 8;
    var conTituloYB = !sinEjes && !!o.etiquetaY;
    var mIzq = sinEjes ? 6 : (conTituloYB ? 62 : 46);
    var mDer = sinEjes ? 6 : 16;
    var mArr = 22;
    var mAba = sinEjes ? 6 : (rotarB ? 48 : 28);
    var x0 = mIzq, x1 = W - mDer, y0 = mArr, y1 = H - mAba;
    var rangoV = (escala.max - escala.min) || 1;

    function yPosV(v) { return y1 - ((v - escala.min) / rangoV) * (y1 - y0); }
    var banda = (x1 - x0) / D.length;
    var grosor = Math.min(nm(o.grosor, 52), banda * 0.64);
    var yCero = limita(yPosV(escala.min < 0 ? 0 : escala.min), y0, y1);

    if (!sinEjes) {
      cuerpo += rejillaY(escala, x0, x1, yPosV, opEje, dec);
      if (conTituloYB) cuerpo += tituloY(o.etiquetaY, 14, (y0 + y1) / 2);
    }
    cuerpo += '<line class="base" x1="' + r(x0) + '" y1="' + r(yCero) + '" x2="' + r(x1) + '" y2="' + r(yCero) + '"/>';

    var etiquetasB = [];
    for (i = 0; i < D.length; i++) etiquetasB.push(D[i].etiqueta);

    for (i = 0; i < D.length; i++) {
      var d2 = D[i];
      var col = colorSeguro(d2.color, colorBase);
      var xc = x0 + banda * (i + 0.5);
      var xb2 = xc - grosor / 2;
      var yv = yPosV(d2.valor);
      var neg = yv > yCero;
      var altoB = Math.abs(yv - yCero);
      var yb2 = neg ? yCero : yv;
      var dp = barraV(xb2, yb2, grosor, altoB, 5, neg);
      if (dp) {
        cuerpo += '<path d="' + dp + '" style="fill:' + col + '">' +
          '<title>' + esc(d2.etiqueta + ': ' + fmtValor(d2.valor, o)) + '</title></path>';
      }
      if (o.valores !== false) {
        var yTexto = neg ? (yb2 + altoB + 13) : (yb2 - 6);
        cuerpo += '<text class="t-val" x="' + r(xc) + '" y="' + r(limita(yTexto, 11, H - 2)) + '" text-anchor="middle">' +
          esc(fmtValor(d2.valor, o)) + '</text>';
      }
    }

    if (!sinEjes) cuerpo += ejeXTexto(etiquetasB, function (idx) { return x0 + banda * (idx + 0.5); },
      rotarB ? y1 + 16 : y1 + 17, rotarB);

    return svgIni(W, H, cls, o.aria || 'Gráfica de barras') + cuerpo + svgFin();
  };

  /* =============================================================
     9. dona(datos, opts)
     ============================================================= */

  Charts.dona = function (datos, opts) {
    var o = opts || {};
    var D0 = normDatos(datos), D = [], i, total = 0;
    for (i = 0; i < D0.length; i++) {
      if (D0[i].valor > 0) { D.push(D0[i]); total += D0[i].valor; }
    }
    if (!D.length || total <= 0) return vacio(o.vacio || 'Sin información para el desglose.', o.alto);

    /* Si hay demasiadas rebanadas, se agrupan las menores en “Otros”. */
    var maxSeg = limita(nm(o.maxSegmentos, 8), 3, 12);
    if (D.length > maxSeg) {
      D.sort(function (a, b) { return b.valor - a.valor; });
      var resto = 0;
      for (i = maxSeg - 1; i < D.length; i++) resto += D[i].valor;
      D = D.slice(0, maxSeg - 1);
      D.push({ etiqueta: 'Otros', valor: resto, color: C.texto3 });
    }

    var cls = nid('dn');
    var conLeyenda = o.leyenda !== false;
    var H = Math.max(150, nm(o.alto, 240));
    var W = Math.max(180, nm(o.ancho, conLeyenda ? 420 : H + 20));
    var R = Math.max(38, Math.min((H - 20) / 2, conLeyenda ? 92 : 108));
    var rInt = R * (limita(nm(o.grosorAnillo, 0.6), 0.2, 0.85));
    var cx = conLeyenda ? (16 + R) : (W / 2);
    var cy = H / 2;
    var cuerpo = '';

    var hueco = (D.length > 1) ? 0.016 : 0;
    var ang = -Math.PI / 2;

    for (i = 0; i < D.length; i++) {
      var d = D[i];
      var color = colorSeguro(d.color, PALETA[i % PALETA.length]);
      var frac = d.valor / total;
      var barrido = frac * Math.PI * 2;
      var pct = frac * 100;
      var titulo = d.etiqueta + ': ' + fmtValor(d.valor, o) + ' (' + fmtNum(pct, pct >= 10 ? 0 : 1) + '%)';

      if (D.length === 1) {
        cuerpo += '<circle cx="' + r(cx) + '" cy="' + r(cy) + '" r="' + r((R + rInt) / 2) + '"' +
          ' style="fill:none;stroke:' + color + ';stroke-width:' + r(R - rInt) + '">' +
          '<title>' + esc(titulo) + '</title></circle>';
      } else {
        var recorte = (barrido > hueco * 2.5) ? hueco : 0;
        var d1 = arcoAnillo(cx, cy, R, rInt, ang, ang + barrido - recorte);
        if (d1) {
          cuerpo += '<path d="' + d1 + '" style="fill:' + color + '">' +
            '<title>' + esc(titulo) + '</title></path>';
        }
      }

      if (pct >= 8) {
        var medio = polar(cx, cy, (R + rInt) / 2, ang + barrido / 2);
        cuerpo += '<text class="t-blanco" x="' + r(medio.x) + '" y="' + r(medio.y + 3.5) + '" text-anchor="middle">' +
          esc(fmtNum(pct, 0) + '%') + '</text>';
      }
      ang += barrido;
    }

    /* Texto central */
    if (o.centroValor !== undefined || o.centroTitulo !== undefined) {
      var hayTitulo = (o.centroTitulo !== undefined && o.centroTitulo !== null && o.centroTitulo !== '');
      var hayValor = (o.centroValor !== undefined && o.centroValor !== null && o.centroValor !== '');
      var yValor = hayTitulo ? cy + 10 : cy + 6;
      if (hayValor) {
        cuerpo += '<text x="' + r(cx) + '" y="' + r(yValor) + '" text-anchor="middle"' +
          ' style="font-size:' + r(Math.min(22, R * 0.34)) + 'px;font-weight:800;fill:' + C.texto + '">' +
          esc(o.centroValor) + '</text>';
      }
      if (hayTitulo) {
        cuerpo += '<text class="t-mini" x="' + r(cx) + '" y="' + r(hayValor ? cy - 12 : cy + 3) + '" text-anchor="middle">' +
          esc(corta(o.centroTitulo, 18)) + '</text>';
      }
    }

    /* Leyenda lateral */
    if (conLeyenda) {
      var lx = cx + R + 22;
      var anchoLey = W - lx - 12;
      if (anchoLey > 70) {
        var altoItem = limita((H - 10) / D.length, 15, 26);
        var yIni = (H - altoItem * D.length) / 2 + altoItem / 2;
        var maxCar = Math.max(5, Math.floor((anchoLey - 76) / 6.1));
        for (i = 0; i < D.length; i++) {
          var dd = D[i];
          var cl = colorSeguro(dd.color, PALETA[i % PALETA.length]);
          var yy = yIni + altoItem * i;
          var pc = (dd.valor / total) * 100;
          cuerpo += '<rect x="' + r(lx) + '" y="' + r(yy - 5) + '" width="10" height="10" rx="3" style="fill:' + cl + '"/>';
          cuerpo += '<text class="t-lbl" x="' + r(lx + 16) + '" y="' + r(yy + 4) + '">' +
            esc(corta(dd.etiqueta, maxCar)) + '</text>';
          cuerpo += '<text class="t-val" x="' + r(W - 12) + '" y="' + r(yy + 4) + '" text-anchor="end">' +
            esc(fmtNum(pc, pc >= 10 ? 0 : 1) + '%') + '</text>';
        }
      }
    }

    return svgIni(W, H, cls, o.aria || 'Gráfica de dona') + cuerpo + svgFin();
  };

  /* =============================================================
     10. progreso(pct, opts)
     ============================================================= */

  function colorUmbral(pct, invertir) {
    var v = invertir ? (100 - pct) : pct;
    if (v < 40) return C.rojo;
    if (v < 70) return C.warn;
    return C.ok;
  }

  Charts.progreso = function (pct, opts) {
    var o = opts || {};
    if (!esNum(pct)) return vacio(o.vacio || 'Sin avance registrado.', o.alto || 150);

    var valor = limita(Number(pct), 0, 100);
    var S = Math.max(90, nm(o.alto, 160));
    var cls = nid('pg');
    var grosor = limita(nm(o.grosor, S * 0.1), 6, 26);
    var R = S / 2 - grosor / 2 - 3;
    var cx = S / 2, cy = S / 2;
    var color = o.color ? colorSeguro(o.color, C.rojo) : colorUmbral(valor, !!o.invertir);
    var cuerpo = '';

    cuerpo += '<circle cx="' + r(cx) + '" cy="' + r(cy) + '" r="' + r(R) + '"' +
      ' style="fill:none;stroke:' + C.borde + ';stroke-width:' + r(grosor) + '"/>';

    if (valor >= 99.95) {
      cuerpo += '<circle cx="' + r(cx) + '" cy="' + r(cy) + '" r="' + r(R) + '"' +
        ' style="fill:none;stroke:' + color + ';stroke-width:' + r(grosor) + '"/>';
    } else if (valor > 0) {
      var a0 = -Math.PI / 2;
      var d = arcoSimple(cx, cy, R, a0, a0 + (valor / 100) * Math.PI * 2);
      cuerpo += '<path d="' + d + '" style="fill:none;stroke:' + color + ';stroke-width:' + r(grosor) +
        ';stroke-linecap:round"/>';
    }

    var hayEtiqueta = (o.etiqueta !== undefined && o.etiqueta !== null && o.etiqueta !== '');
    var textoCentro = (o.texto !== undefined && o.texto !== null && o.texto !== '')
      ? String(o.texto)
      : (fmtNum(valor, valor % 1 === 0 ? 0 : 1) + (o.sufijo !== undefined ? String(o.sufijo) : '%'));

    cuerpo += '<text x="' + r(cx) + '" y="' + r(cy + (hayEtiqueta ? 1 : 6)) + '" text-anchor="middle"' +
      ' style="font-size:' + r(Math.min(30, S * 0.21)) + 'px;font-weight:800;fill:' + C.texto + '">' +
      esc(textoCentro) + '</text>';
    if (hayEtiqueta) {
      cuerpo += '<text class="t-mini" x="' + r(cx) + '" y="' + r(cy + 17) + '" text-anchor="middle">' +
        esc(corta(o.etiqueta, 16)) + '</text>';
    }

    cuerpo += '<title>' + esc((hayEtiqueta ? o.etiqueta + ': ' : 'Avance: ') + fmtNum(valor, 1) + '%') + '</title>';

    return svgIni(S, S, cls, o.aria || 'Anillo de progreso',
      'max-width:' + r(S) + 'px;margin:0 auto') + cuerpo + svgFin();
  };

  /* =============================================================
     11. sparkline(valores, opts)
     ============================================================= */

  Charts.sparkline = function (valores, opts) {
    var o = opts || {};
    var puntos = normPuntos(valores instanceof Array ? valores : []);
    var vals = [], i;
    for (i = 0; i < puntos.length; i++) if (puntos[i].y !== null) vals.push(puntos[i]);
    if (!vals.length) return vacio(o.vacio || 'Sin historial.', o.alto || 60);

    var W = Math.max(60, nm(o.ancho, 240));
    var H = Math.max(24, nm(o.alto, 44));
    var cls = nid('sp');
    var color = colorSeguro(o.color, C.rojo);
    var pad = 5;
    var lista = [];
    for (i = 0; i < vals.length; i++) lista.push(vals[i].y);
    var mm = minMax(lista);
    var min = mm.min, max = mm.max;
    if (max === min) { max = min + (Math.abs(min) * 0.1 || 1); min = min - (Math.abs(min) * 0.1 || 1); }
    var rango = max - min;

    var coords = [];
    for (i = 0; i < vals.length; i++) {
      var x = vals.length === 1 ? (W - pad) : pad + (i / (vals.length - 1)) * (W - pad * 2);
      var y = (H - pad) - ((vals[i].y - min) / rango) * (H - pad * 2);
      coords.push({ x: x, y: y, v: vals[i].y, et: vals[i].et });
    }
    if (coords.length === 1) coords.unshift({ x: pad, y: coords[0].y, v: coords[0].v, et: coords[0].et });

    var idGrad = cls + '-ar';
    var d = rutaLinea(coords, o.suave !== false);
    var cuerpo = '';
    if (o.area !== false) {
      cuerpo += '<path d="' + d + ' L' + r(coords[coords.length - 1].x) + ',' + r(H) +
        ' L' + r(coords[0].x) + ',' + r(H) + ' Z" style="fill:url(#' + idGrad + ');stroke:none"/>';
    }
    cuerpo += '<path d="' + d + '" style="fill:none;stroke:' + color +
      ';stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>';

    var ult = coords[coords.length - 1];
    cuerpo += '<circle cx="' + r(ult.x) + '" cy="' + r(ult.y) + '" r="3.2" style="fill:' + color +
      ';stroke:' + C.panel + ';stroke-width:1.6"/>';

    var resumen = (o.etiqueta ? String(o.etiqueta) + ': ' : '') + fmtValor(ult.v, o);
    cuerpo += '<title>' + esc(resumen) + '</title>';

    return svgIni(W, H, cls, o.aria || 'Minigráfica de tendencia') +
      '<defs>' + degradado(idGrad, color, 0.3) + '</defs>' + cuerpo + svgFin();
  };

  /* =============================================================
     12. comparativo(pares, opts)  — cierre de mes del socio
     ============================================================= */

  function normPares(pares) {
    var salida = [];
    if (!pares || !(pares instanceof Array)) return salida;
    for (var i = 0; i < pares.length; i++) {
      var p = pares[i];
      if (!p || typeof p !== 'object') continue;
      var ini = (p.ini !== undefined) ? p.ini : p.inicial;
      var fin = (p.fin !== undefined) ? p.fin : p.final;
      if (!esNum(ini) && !esNum(fin)) continue;
      salida.push({
        etiqueta: String((p.etiqueta !== undefined && p.etiqueta !== null) ? p.etiqueta
          : ((p.clave !== undefined && p.clave !== null) ? p.clave : ('Dato ' + (i + 1)))),
        ini: esNum(ini) ? Number(ini) : null,
        fin: esNum(fin) ? Number(fin) : null,
        unidad: (p.unidad !== undefined && p.unidad !== null) ? String(p.unidad) : '',
        tendencia: (typeof p.tendencia === 'string') ? p.tendencia : null,
        bueno: (typeof p.bueno === 'boolean') ? p.bueno : null,
        subirEsBueno: (typeof p.subirEsBueno === 'boolean') ? p.subirEsBueno : null
      });
    }
    return salida;
  }

  function estadoPar(p) {
    if (p.ini === null || p.fin === null) return 'neutro';
    var d = p.fin - p.ini;
    if (Math.abs(d) < 1e-9) return 'igual';
    if (p.tendencia === 'mejor' || p.tendencia === 'peor' || p.tendencia === 'igual') return p.tendencia;
    if (p.bueno === true) return 'mejor';
    if (p.bueno === false) return 'peor';
    if (p.subirEsBueno !== null) return ((d > 0) === p.subirEsBueno) ? 'mejor' : 'peor';
    return 'neutro';
  }

  function colorEstado(estado) {
    if (estado === 'mejor') return C.ok;
    if (estado === 'peor') return C.error;
    if (estado === 'igual') return C.info;
    return C.rojo;
  }

  Charts.comparativo = function (pares, opts) {
    var o = opts || {};
    var P = normPares(pares);
    if (!P.length) return vacio(o.vacio || 'Falta la medición inicial o la final para comparar.', o.alto);

    var n = P.length;
    var W = limita(nm(o.ancho, 96 * n + 40), 300, 1200);
    var H = Math.max(220, nm(o.alto, 300));
    var cls = nid('cp');

    var yChip = 16;             /* centro de la píldora del cambio */
    var yTop = 40;              /* techo del área de barras */
    var yBase = H - 54;         /* línea base */
    var yLado = yBase + 14;     /* “Inicio” / “Fin” */
    var yNombre = yBase + 31;   /* nombre de la métrica */
    var altoMax = Math.max(24, yBase - yTop - 16);

    var banda = W / n;
    var grosor = limita(banda * 0.26, 12, 42);
    var separacion = Math.min(banda * 0.1, 12);
    var cuerpo = '';

    cuerpo += '<line class="base" x1="6" y1="' + r(yBase) + '" x2="' + r(W - 6) + '" y2="' + r(yBase) + '"/>';

    var etiquetaIni = o.etiquetaIni ? String(o.etiquetaIni) : 'Inicio';
    var etiquetaFin = o.etiquetaFin ? String(o.etiquetaFin) : 'Fin';
    var colorIni = colorSeguro(o.colorIni, C.texto3);

    for (var i = 0; i < n; i++) {
      var p = P[i];
      var estado = estadoPar(p);
      var colFin = colorEstado(estado);
      var xc = banda * (i + 0.5);
      var xIni = xc - separacion / 2 - grosor;
      var xFin = xc + separacion / 2;

      var tope = Math.max(Math.abs(p.ini === null ? 0 : p.ini), Math.abs(p.fin === null ? 0 : p.fin));
      if (!(tope > 0)) tope = 1;

      var hIni = (p.ini === null) ? 0 : Math.max(3, (Math.abs(p.ini) / tope) * altoMax);
      var hFin = (p.fin === null) ? 0 : Math.max(3, (Math.abs(p.fin) / tope) * altoMax);
      var yIni = yBase - hIni, yFin = yBase - hFin;

      /* Barras */
      if (p.ini !== null) {
        cuerpo += '<path d="' + barraV(xIni, yIni, grosor, hIni, 5, false) + '" style="fill:' + colorIni + ';fill-opacity:.55">' +
          '<title>' + esc(p.etiqueta + ' · ' + etiquetaIni + ': ' + fmtNum(p.ini) + (p.unidad ? ' ' + p.unidad : '')) +
          '</title></path>';
      }
      if (p.fin !== null) {
        cuerpo += '<path d="' + barraV(xFin, yFin, grosor, hFin, 5, false) + '" style="fill:' + colFin + '">' +
          '<title>' + esc(p.etiqueta + ' · ' + etiquetaFin + ': ' + fmtNum(p.fin) + (p.unidad ? ' ' + p.unidad : '')) +
          '</title></path>';
      }

      /* Conector punteado entre las puntas: hace visible la dirección del cambio */
      if (p.ini !== null && p.fin !== null) {
        cuerpo += '<line x1="' + r(xIni + grosor) + '" y1="' + r(yIni) + '" x2="' + r(xFin) + '" y2="' + r(yFin) + '"' +
          ' style="stroke:' + colFin + ';stroke-width:1.4;stroke-dasharray:3 3;opacity:.85"/>';
      }

      /* Valores sobre cada barra */
      if (p.ini !== null) {
        cuerpo += '<text class="t-val" x="' + r(xIni + grosor / 2) + '" y="' + r(Math.max(yTop - 4, yIni - 6)) +
          '" text-anchor="middle" style="fill:' + C.texto2 + '">' + esc(fmtNum(p.ini)) + '</text>';
      }
      if (p.fin !== null) {
        cuerpo += '<text class="t-val" x="' + r(xFin + grosor / 2) + '" y="' + r(Math.max(yTop - 4, yFin - 6)) +
          '" text-anchor="middle">' + esc(fmtNum(p.fin)) + '</text>';
      }

      /* Píldora del cambio con flecha */
      if (p.ini !== null && p.fin !== null) {
        var delta = p.fin - p.ini;
        var dir = Math.abs(delta) < 1e-9 ? 0 : (delta > 0 ? 1 : -1);
        var texto = signoTexto(delta, Math.abs(delta) >= 10 ? 0 : 1, p.unidad);
        var anchoChip = Math.min(banda - 6, 30 + texto.length * 6.4);
        var xChip = limita(xc - anchoChip / 2, 3, W - anchoChip - 3);
        cuerpo += '<rect x="' + r(xChip) + '" y="' + r(yChip - 10) + '" width="' + r(anchoChip) + '" height="20" rx="10"' +
          ' style="fill:' + colFin + ';fill-opacity:.15;stroke:' + colFin + ';stroke-opacity:.42"/>';
        cuerpo += '<g style="fill:' + colFin + '">' + flecha(xChip + 13, yChip, 4.6, dir) + '</g>';
        cuerpo += '<text x="' + r(xChip + 22) + '" y="' + r(yChip + 4) + '"' +
          ' style="font-size:11px;font-weight:700;fill:' + colFin + '">' + esc(texto) + '</text>';
      }

      /* Pies: Inicio / Fin y nombre de la métrica */
      cuerpo += '<text class="t-mini" x="' + r(xIni + grosor / 2) + '" y="' + r(yLado) + '" text-anchor="middle">' +
        esc(corta(etiquetaIni, 8)) + '</text>';
      cuerpo += '<text class="t-mini" x="' + r(xFin + grosor / 2) + '" y="' + r(yLado) + '" text-anchor="middle">' +
        esc(corta(etiquetaFin, 8)) + '</text>';

      var nombre = p.etiqueta + (p.unidad ? ' (' + p.unidad + ')' : '');
      cuerpo += '<text x="' + r(xc) + '" y="' + r(yNombre) + '" text-anchor="middle"' +
        ' style="font-size:11px;font-weight:700;fill:' + C.texto + '">' +
        esc(corta(nombre, Math.max(7, Math.floor(banda / 6.4)))) + '</text>';
    }

    return svgIni(W, H, cls, o.aria || 'Comparativo de inicio contra fin de mes') + cuerpo + svgFin();
  };

  /* =============================================================
     13. radar(ejes, opts)
     ============================================================= */

  Charts.radar = function (ejes, opts) {
    var o = opts || {};
    var E = [], i;
    if (ejes && ejes instanceof Array) {
      for (i = 0; i < ejes.length; i++) {
        var e = ejes[i];
        if (!e || typeof e !== 'object') continue;
        if (!esNum(e.valor)) continue;
        E.push({
          etiqueta: String((e.etiqueta !== undefined && e.etiqueta !== null) ? e.etiqueta : ('Eje ' + (i + 1))),
          valor: Number(e.valor),
          max: esNum(e.max) && Number(e.max) > 0 ? Number(e.max) : null
        });
      }
    }
    if (E.length < 3) return vacio(o.vacio || 'Se necesitan al menos tres indicadores para el radar.', o.alto);

    var maxGlobal = 0;
    for (i = 0; i < E.length; i++) maxGlobal = Math.max(maxGlobal, E[i].valor, E[i].max || 0);
    if (!(maxGlobal > 0)) maxGlobal = 1;
    for (i = 0; i < E.length; i++) if (!E[i].max) E[i].max = maxGlobal;

    var W = Math.max(240, nm(o.ancho, 360));
    var H = Math.max(220, nm(o.alto, 320));
    var cls = nid('rd');
    var cx = W / 2, cy = H / 2 + 2;
    var R = Math.max(48, Math.min(W / 2 - 78, H / 2 - 42));
    var color = colorSeguro(o.color, C.rojo);
    var n = E.length;
    var niveles = limita(nm(o.niveles, 4), 2, 6);
    var cuerpo = '';

    function angulo(idx) { return -Math.PI / 2 + (idx / n) * Math.PI * 2; }

    /* Rejilla poligonal */
    for (var nivel = niveles; nivel >= 1; nivel--) {
      var rr = R * (nivel / niveles), pts = [];
      for (i = 0; i < n; i++) {
        var pg = polar(cx, cy, rr, angulo(i));
        pts.push(r(pg.x) + ',' + r(pg.y));
      }
      cuerpo += '<polygon points="' + pts.join(' ') + '" style="fill:' +
        (nivel === niveles ? C.panel2 : 'none') + ';fill-opacity:' + (nivel === niveles ? '.45' : '0') +
        ';stroke:' + C.borde + ';stroke-width:1"/>';
    }

    /* Radios */
    for (i = 0; i < n; i++) {
      var pr = polar(cx, cy, R, angulo(i));
      cuerpo += '<line x1="' + r(cx) + '" y1="' + r(cy) + '" x2="' + r(pr.x) + '" y2="' + r(pr.y) +
        '" style="stroke:' + C.borde + ';stroke-width:1"/>';
    }

    /* Polígono de datos */
    var datos = [], puntos = [];
    for (i = 0; i < n; i++) {
      var frac = limita(E[i].valor / E[i].max, 0, 1);
      var pd = polar(cx, cy, R * frac, angulo(i));
      datos.push(r(pd.x) + ',' + r(pd.y));
      puntos.push(pd);
    }
    cuerpo += '<polygon points="' + datos.join(' ') + '" style="fill:' + color +
      ';fill-opacity:.22;stroke:' + color + ';stroke-width:2;stroke-linejoin:round"/>';

    for (i = 0; i < n; i++) {
      cuerpo += '<circle cx="' + r(puntos[i].x) + '" cy="' + r(puntos[i].y) + '" r="3"' +
        ' style="fill:' + color + ';stroke:' + C.panel + ';stroke-width:1.4">' +
        '<title>' + esc(E[i].etiqueta + ': ' + fmtValor(E[i].valor, o) + ' de ' + fmtNum(E[i].max)) +
        '</title></circle>';
    }

    /* Etiquetas alrededor */
    for (i = 0; i < n; i++) {
      var a = angulo(i);
      var pl = polar(cx, cy, R + 16, a);
      var cosA = Math.cos(a), senA = Math.sin(a);
      var anclaje = Math.abs(cosA) < 0.3 ? 'middle' : (cosA > 0 ? 'start' : 'end');
      var dy = senA < -0.65 ? -3 : (senA > 0.65 ? 11 : 4);
      cuerpo += '<text class="t-lbl" x="' + r(pl.x) + '" y="' + r(pl.y + dy) + '" text-anchor="' + anclaje + '">' +
        esc(corta(E[i].etiqueta, 11)) + '</text>';
      if (o.valores !== false) {
        cuerpo += '<text class="t-mini" x="' + r(pl.x) + '" y="' + r(pl.y + dy + 11) + '" text-anchor="' + anclaje + '">' +
          esc(fmtValor(E[i].valor, o)) + '</text>';
      }
    }

    return svgIni(W, H, cls, o.aria || 'Gráfica de radar',
      'max-width:' + r(W) + 'px;margin:0 auto') + cuerpo + svgFin();
  };

  /* =============================================================
     14. calendario(dias, opts)  — mapa de calor mensual
     ============================================================= */

  function partesPeriodo(periodo) {
    var m = /^(\d{4})-(\d{1,2})/.exec(String(periodo || ''));
    if (!m) return null;
    var anio = Number(m[1]), mes = Number(m[2]);
    if (!(anio > 0) || mes < 1 || mes > 12) return null;
    return { anio: anio, mes: mes };
  }

  function textoFecha(iso) {
    if (AG.Utils && typeof AG.Utils.fecha === 'function') {
      try {
        var t = AG.Utils.fecha(iso, 'corto');
        if (t) return String(t);
      } catch (e) { /* respaldo abajo */ }
    }
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return p ? (p[3] + '/' + p[2] + '/' + p[1]) : String(iso || '');
  }

  function tituloMes(periodo) {
    if (AG.Utils && typeof AG.Utils.nombreMes === 'function') {
      try {
        var t = AG.Utils.nombreMes(periodo);
        if (t) return String(t);
      } catch (e) { /* respaldo abajo */ }
    }
    return String(periodo || '');
  }

  Charts.calendario = function (dias, opts) {
    var o = opts || {};
    var lista = (dias && dias instanceof Array) ? dias : [];
    var mapa = Object.create(null), fechas = [], i;

    for (i = 0; i < lista.length; i++) {
      var d = lista[i];
      if (!d || typeof d !== 'object') continue;
      var f = (d.fecha !== undefined && d.fecha !== null) ? String(d.fecha).slice(0, 10) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
      var v = esNum(d.valor) ? Number(d.valor) : (d.valor === undefined ? 1 : 0);
      mapa[f] = (mapa[f] === undefined ? 0 : mapa[f]) + v;
      fechas.push(f);
    }

    /* Sin ningún registro válido no se dibuja la rejilla: se avisa en español. */
    if (!fechas.length && o.mostrarVacio !== true) {
      return vacio(o.vacio || 'Sin registros en este mes.', o.alto || 200);
    }

    var per = partesPeriodo(o.periodo) ||
      (fechas.length ? partesPeriodo(fechas.sort()[fechas.length - 1].slice(0, 7)) : null);

    if (!per) {
      if (AG.Utils && typeof AG.Utils.mesActual === 'function') {
        try { per = partesPeriodo(AG.Utils.mesActual()); } catch (e) { per = null; }
      }
      if (!per) {
        var hoyD = new Date();
        per = { anio: hoyD.getFullYear(), mes: hoyD.getMonth() + 1 };
      }
    }

    var primero = new Date(per.anio, per.mes - 1, 1);
    var totalDias = new Date(per.anio, per.mes, 0).getDate();
    var desfase = (primero.getDay() + 6) % 7;              /* lunes = 0 */
    var semanas = Math.ceil((desfase + totalDias) / 7);

    var separacion = 4;
    var celda;
    if (esNum(o.celda)) celda = limita(Number(o.celda), 14, 46);
    else if (esNum(o.alto)) celda = limita((Number(o.alto) - 52 - separacion * (semanas - 1)) / semanas, 14, 42);
    else celda = 30;

    var gridW = 7 * celda + 6 * separacion;
    var margen = 12;
    var W = gridW + margen * 2;
    var yEncabezado = 12;
    var yGrid = 22;
    var altoGrid = semanas * celda + (semanas - 1) * separacion;
    var yLeyenda = yGrid + altoGrid + 20;
    var conTitulo = (o.titulo !== undefined) ? !!o.titulo : false;
    var desplazaTitulo = conTitulo ? 18 : 0;
    var H = yLeyenda + 8 + desplazaTitulo;

    var cls = nid('cl');
    var color = colorSeguro(o.color, C.rojo);
    var cuerpo = '';

    if (conTitulo) {
      var tit = (typeof o.titulo === 'string') ? o.titulo : tituloMes(per.anio + '-' + (per.mes < 10 ? '0' : '') + per.mes);
      cuerpo += '<text class="t-tit" x="' + r(W / 2) + '" y="12" text-anchor="middle">' + esc(tit) + '</text>';
    }

    /* Encabezado de días */
    for (i = 0; i < 7; i++) {
      cuerpo += '<text class="t-mini" x="' + r(margen + i * (celda + separacion) + celda / 2) + '" y="' +
        r(yEncabezado + desplazaTitulo) + '" text-anchor="middle">' + esc(DIAS_SEMANA[i]) + '</text>';
    }

    /* Máximo para la intensidad */
    var maxVal = esNum(o.max) ? Number(o.max) : 0;
    if (!(maxVal > 0)) {
      for (i = 1; i <= totalDias; i++) {
        var kf = per.anio + '-' + (per.mes < 10 ? '0' : '') + per.mes + '-' + (i < 10 ? '0' : '') + i;
        if (mapa[kf] !== undefined && mapa[kf] > maxVal) maxVal = mapa[kf];
      }
    }
    if (!(maxVal > 0)) maxVal = 1;

    var opacidades = [0.30, 0.50, 0.72, 1];
    function nivelDe(v) {
      if (!(v > 0)) return -1;
      var frac = limita(v / maxVal, 0, 1);
      var idx = Math.ceil(frac * opacidades.length) - 1;
      return limita(idx, 0, opacidades.length - 1);
    }

    var sufijoDia = (o.etiquetaValor !== undefined && o.etiquetaValor !== null)
      ? String(o.etiquetaValor) : (o.sufijo ? String(o.sufijo) : '');

    for (i = 1; i <= totalDias; i++) {
      var pos = desfase + i - 1;
      var col = pos % 7, fila = Math.floor(pos / 7);
      var x = margen + col * (celda + separacion);
      var y = yGrid + desplazaTitulo + fila * (celda + separacion);
      var clave = per.anio + '-' + (per.mes < 10 ? '0' : '') + per.mes + '-' + (i < 10 ? '0' : '') + i;
      var valor = mapa[clave] !== undefined ? mapa[clave] : 0;
      var nivel = nivelDe(valor);

      var estilo = (nivel < 0)
        ? 'fill:' + C.panel2 + ';stroke:' + C.borde + ';stroke-width:1'
        : 'fill:' + color + ';fill-opacity:' + opacidades[nivel] + ';stroke:none';

      var descripcion = textoFecha(clave) + ' · ' +
        (valor > 0 ? (fmtNum(valor, valor % 1 === 0 ? 0 : 1) + (sufijoDia ? ' ' + sufijoDia : '')) : 'sin registro');

      cuerpo += '<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(celda) + '" height="' + r(celda) +
        '" rx="' + r(Math.min(7, celda * 0.24)) + '" style="' + estilo + '">' +
        '<title>' + esc(descripcion) + '</title></rect>';

      if (celda >= 22) {
        var colorNum = (nivel >= 2) ? '#fff' : C.texto2;
        cuerpo += '<text x="' + r(x + celda / 2) + '" y="' + r(y + celda / 2 + 3.5) + '" text-anchor="middle"' +
          ' style="font-size:' + r(Math.min(11, celda * 0.38)) + 'px;font-weight:600;fill:' + colorNum +
          ';pointer-events:none">' + i + '</text>';
      }
    }

    /* Leyenda */
    var yL = yLeyenda + desplazaTitulo;
    var cajaL = 11, sepL = 3;
    var anchoLey = 5 * (cajaL + sepL) - sepL;
    var xL = W - margen - anchoLey - 32;
    cuerpo += '<text class="t-mini" x="' + r(xL - 6) + '" y="' + r(yL + 9) + '" text-anchor="end">Menos</text>';
    cuerpo += '<rect x="' + r(xL) + '" y="' + r(yL) + '" width="' + cajaL + '" height="' + cajaL + '" rx="3"' +
      ' style="fill:' + C.panel2 + ';stroke:' + C.borde + ';stroke-width:1"/>';
    for (i = 0; i < opacidades.length; i++) {
      cuerpo += '<rect x="' + r(xL + (i + 1) * (cajaL + sepL)) + '" y="' + r(yL) + '" width="' + cajaL +
        '" height="' + cajaL + '" rx="3" style="fill:' + color + ';fill-opacity:' + opacidades[i] + '"/>';
    }
    cuerpo += '<text class="t-mini" x="' + r(xL + anchoLey + 6) + '" y="' + r(yL + 9) + '">Más</text>';

    return svgIni(W, H, cls, o.aria || 'Mapa de calor del mes',
      'max-width:' + r(W + 40) + 'px;margin:0 auto') + cuerpo + svgFin();
  };

  /* =============================================================
     15. Exposición
     ============================================================= */

  Charts.paleta = PALETA.slice();
  Charts.color = function (i) { return PALETA[Math.abs(nm(i, 0)) % PALETA.length]; };
  Charts.vacio = vacio;

  AG.Charts = Charts;
})(window.AG);
