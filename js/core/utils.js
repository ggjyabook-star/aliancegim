/* =============================================================
   ALLIANCE GYM — AG.Utils
   Utilidades base: texto, fechas, formato, DOM, modales y avisos.
   Este archivo carga PRIMERO: no depende de nada de AG al cargarse.
   Dentro de las funciones sí puede consultar AG.DB / AG.Icons.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  var U = {};

  /* =========================================================
     0. Constantes de idioma (es-MX)
     ========================================================= */

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Alineados con Date.getDay(): 0 = Domingo
  var DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DIAS_SEMANA_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  // Para rejillas de calendario que arrancan en lunes
  var DIAS_SEMANA_LUNES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Paleta determinista para avatares y etiquetas
  var PALETA = [
    '#e4322b', '#f2711c', '#f5a623', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'
  ];

  /* =========================================================
     1. Texto
     ========================================================= */

  var MAPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Escapa texto para insertarlo con seguridad en HTML. */
  function esc(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/[&<>"']/g, function (c) { return MAPA_ESC[c]; });
  }

  /** Primera letra en mayúscula. */
  function capitalizar(texto) {
    var t = (texto === null || texto === undefined) ? '' : String(texto);
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** Recorta un texto agregando puntos suspensivos. */
  function truncar(texto, largo) {
    var t = (texto === null || texto === undefined) ? '' : String(texto);
    var n = Number(largo) > 0 ? Number(largo) : 80;
    return t.length > n ? t.slice(0, n - 1).replace(/\s+$/, '') + '…' : t;
  }

  /** Quita acentos y pasa a minúsculas: sirve para buscar. */
  function normalizar(texto) {
    var t = (texto === null || texto === undefined) ? '' : String(texto);
    t = t.toLowerCase();
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch (e) {
      t = t.replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
           .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
    }
    return t.trim();
  }

  var idsUsados = {};
  var contadorId = 0;

  /** Identificador corto y único. uid('pg_') -> 'pg_k3f9a1r' */
  function uid(prefijo) {
    var p = (prefijo === null || prefijo === undefined) ? '' : String(prefijo);
    var id;
    var intentos = 0;
    do {
      contadorId = (contadorId + 1) % 46656;
      var tiempo = Date.now().toString(36).slice(-4);
      var azar = ('00' + Math.floor(Math.random() * 46656).toString(36)).slice(-3);
      id = p + tiempo + azar;
      intentos++;
      if (intentos > 6) { id = p + tiempo + azar + contadorId.toString(36); break; }
    } while (idsUsados[id]);
    idsUsados[id] = true;
    return id;
  }

  /* =========================================================
     2. Fechas — SIEMPRE cadenas 'YYYY-MM-DD' sin líos de zona horaria
     ========================================================= */

  function pad(n, largo) {
    var s = String(Math.abs(Math.floor(Number(n) || 0)));
    var l = largo || 2;
    while (s.length < l) s = '0' + s;
    return s;
  }

  var RE_FECHA = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  var RE_ZONA = /[Tt].*(?:[Zz]|[+-]\d{2}:?\d{2})$/;
  var RE_HORA_SOLA = /^(\d{1,2}):(\d{2})/;

  function partesDeDate(f) {
    return {
      a: f.getFullYear(), m: f.getMonth() + 1, d: f.getDate(),
      h: f.getHours(), min: f.getMinutes(), s: f.getSeconds(), conHora: true
    };
  }

  /**
   * Descompone cualquier entrada de fecha en partes locales.
   * Nunca usa new Date('YYYY-MM-DD') directo (evita el corrimiento de zona).
   */
  function partesDe(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (valor instanceof Date) {
      return isNaN(valor.getTime()) ? null : partesDeDate(valor);
    }
    if (typeof valor === 'number' && isFinite(valor)) {
      var fn = new Date(valor);
      return isNaN(fn.getTime()) ? null : partesDeDate(fn);
    }
    var t = String(valor).trim();
    if (!t) return null;

    // ISO con zona explícita (Z u offset): sí conviene dejar que el motor la convierta
    if (RE_ZONA.test(t)) {
      var fz = new Date(t);
      if (!isNaN(fz.getTime())) return partesDeDate(fz);
    }

    var m = RE_FECHA.exec(t);
    if (m) {
      return {
        a: Number(m[1]),
        m: Number(m[2]),
        d: m[3] ? Number(m[3]) : 1,
        h: m[4] ? Number(m[4]) : 0,
        min: m[5] ? Number(m[5]) : 0,
        s: m[6] ? Number(m[6]) : 0,
        conHora: !!m[4]
      };
    }

    var f = new Date(t);
    return isNaN(f.getTime()) ? null : partesDeDate(f);
  }

  /** Date local (mediodía no requerido: se construye por componentes). */
  function aDate(valor) {
    var p = partesDe(valor);
    if (!p) return null;
    var f = new Date(p.a, p.m - 1, p.d, p.h, p.min, p.s, 0);
    return isNaN(f.getTime()) ? null : f;
  }

  /** Días que tiene un mes (mes 1..12). */
  function diasDelMes(anio, mes) {
    return new Date(Number(anio), Number(mes), 0).getDate();
  }

  function serial(p) {
    // Días absolutos usando UTC: inmune a horario de verano
    return Date.UTC(p.a, p.m - 1, p.d) / 86400000;
  }

  /** 'YYYY-MM-DD' del día de hoy (hora local). */
  function hoy() {
    var f = new Date();
    return f.getFullYear() + '-' + pad(f.getMonth() + 1) + '-' + pad(f.getDate());
  }

  /** Marca de tiempo ISO completa. */
  function ahora() {
    return new Date().toISOString();
  }

  /** Normaliza cualquier fecha a 'YYYY-MM-DD'. */
  function iso(valor) {
    var p = partesDe(valor);
    if (!p) return '';
    return pad(p.a, 4) + '-' + pad(p.m) + '-' + pad(p.d);
  }

  /**
   * Formatea una fecha.
   * 'corto'   -> '05 sep 2026'
   * 'largo'   -> 'sábado, 5 de septiembre de 2026'
   * 'mesAnio' -> 'Septiembre 2026'
   * 'diaMes'  -> '5 sep'
   * 'hora'    -> '14:30'
   * 'completo'-> '05 sep 2026, 14:30'
   * 'iso'     -> '2026-09-05'
   */
  function fecha(valor, formato) {
    var f = formato || 'corto';

    // Cadenas que solo traen hora ('07:00') se respetan tal cual
    if (typeof valor === 'string' && !/-/.test(valor)) {
      var mh = RE_HORA_SOLA.exec(valor.trim());
      if (mh) return pad(Math.min(23, Number(mh[1]))) + ':' + mh[2];
    }

    var p = partesDe(valor);
    if (!p) return '';

    var horaTxt = pad(p.h) + ':' + pad(p.min);

    switch (f) {
      case 'hora':
        return horaTxt;
      case 'iso':
        return pad(p.a, 4) + '-' + pad(p.m) + '-' + pad(p.d);
      case 'mesAnio':
        return MESES[p.m - 1] + ' ' + p.a;
      case 'diaMes':
        return p.d + ' ' + MESES_CORTOS[p.m - 1];
      case 'largo':
        var dia = new Date(p.a, p.m - 1, p.d).getDay();
        return DIAS_SEMANA[dia].toLowerCase() + ', ' + p.d + ' de ' +
          MESES[p.m - 1].toLowerCase() + ' de ' + p.a;
      case 'completo':
        return pad(p.d) + ' ' + MESES_CORTOS[p.m - 1] + ' ' + p.a + ', ' + horaTxt;
      case 'corto':
      default:
        return pad(p.d) + ' ' + MESES_CORTOS[p.m - 1] + ' ' + p.a;
    }
  }

  /** 'hoy', 'ayer', 'hace 3 días', 'hace 2 meses', 'en 5 días'. */
  function fechaRelativa(valor) {
    var p = partesDe(valor);
    if (!p) return '';
    var hoyP = partesDe(hoy());
    var dias = serial(hoyP) - serial(p); // positivo = pasado

    if (dias === 0) {
      if (p.conHora) {
        var ahoraF = new Date();
        var minutos = Math.floor((ahoraF.getTime() - new Date(p.a, p.m - 1, p.d, p.h, p.min, p.s).getTime()) / 60000);
        if (minutos < 0) return 'hoy';
        if (minutos < 1) return 'hace un momento';
        if (minutos < 60) return 'hace ' + minutos + (minutos === 1 ? ' minuto' : ' minutos');
        var horas = Math.floor(minutos / 60);
        return 'hace ' + horas + (horas === 1 ? ' hora' : ' horas');
      }
      return 'hoy';
    }
    if (dias === 1) return 'ayer';
    if (dias === -1) return 'mañana';

    var pasado = dias > 0;
    var n = Math.abs(dias);
    var texto;

    if (n < 30) {
      texto = n + (n === 1 ? ' día' : ' días');
    } else if (n < 365) {
      var meses = Math.max(1, Math.round(n / 30));
      if (meses >= 12) meses = 11;
      texto = meses + (meses === 1 ? ' mes' : ' meses');
    } else {
      var anios = Math.floor(n / 365);
      texto = anios + (anios === 1 ? ' año' : ' años');
    }
    return (pasado ? 'hace ' : 'en ') + texto;
  }

  /** 'YYYY-MM' del mes en curso. */
  function mesActual() {
    var f = new Date();
    return f.getFullYear() + '-' + pad(f.getMonth() + 1);
  }

  /** 'YYYY-MM' de cualquier fecha. */
  function mesDe(valor) {
    var p = partesDe(valor);
    if (!p) return '';
    return pad(p.a, 4) + '-' + pad(p.m);
  }

  /** 'Septiembre 2026' a partir de 'YYYY-MM' o 'YYYY-MM-DD'. */
  function nombreMes(mesKey) {
    var p = partesDe(mesKey);
    if (!p) return '';
    return MESES[p.m - 1] + ' ' + p.a;
  }

  /** Suma (o resta) días y devuelve 'YYYY-MM-DD'. */
  function sumaDias(valor, n) {
    var p = partesDe(valor);
    if (!p) return '';
    var f = new Date(Date.UTC(p.a, p.m - 1, p.d));
    f.setUTCDate(f.getUTCDate() + (Number(n) || 0));
    return f.getUTCFullYear() + '-' + pad(f.getUTCMonth() + 1) + '-' + pad(f.getUTCDate());
  }

  /** Suma (o resta) meses respetando el fin de mes. 31-ene +1 -> 28/29-feb. */
  function sumaMeses(valor, n) {
    var p = partesDe(valor);
    if (!p) return '';
    var total = p.a * 12 + (p.m - 1) + (Number(n) || 0);
    var anio = Math.floor(total / 12);
    var mes = ((total % 12) + 12) % 12 + 1;
    var dia = Math.min(p.d, diasDelMes(anio, mes));
    return pad(anio, 4) + '-' + pad(mes) + '-' + pad(dia);
  }

  /** Días de a hasta b (positivo si b es posterior). */
  function diasEntre(a, b) {
    var pa = partesDe(a), pb = partesDe(b);
    if (!pa || !pb) return 0;
    return Math.round(serial(pb) - serial(pa));
  }

  /** Edad cumplida en años. */
  function edad(fechaNacimiento, referencia) {
    var p = partesDe(fechaNacimiento);
    if (!p) return 0;
    var r = partesDe(referencia || hoy());
    if (!r) return 0;
    var anios = r.a - p.a;
    if (r.m < p.m || (r.m === p.m && r.d < p.d)) anios--;
    if (!isFinite(anios) || anios < 0) return 0;
    return anios;
  }

  /* =========================================================
     3. Números y formato
     ========================================================= */

  /** Ajustes de moneda: los toma de AG.DB si ya existe. */
  function ajustes() {
    var conf = { simbolo: '$', locale: 'es-MX', moneda: 'MXN' };
    try {
      var s = window.AG && AG.DB && AG.DB.state && AG.DB.state.settings;
      if (s) {
        if (s.simbolo) conf.simbolo = String(s.simbolo);
        if (s.locale) conf.locale = String(s.locale);
        if (s.moneda) conf.moneda = String(s.moneda);
      }
    } catch (e) { /* la app aún no carga la base: se usan los valores por defecto */ }
    return conf;
  }

  function aNumero(n) {
    var v = typeof n === 'number' ? n : parseFloat(String(n === null || n === undefined ? '' : n).replace(/[^\d.,-]/g, '').replace(/,/g, ''));
    return isFinite(v) ? v : 0;
  }

  function conMiles(valor, dec, locale) {
    var v = aNumero(valor);
    var d = (dec === null || dec === undefined) ? 0 : Math.max(0, Math.min(6, Number(dec) || 0));
    try {
      return v.toLocaleString(locale || 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
    } catch (e) {
      var fijo = v.toFixed(d);
      var partes = fijo.split('.');
      partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return partes.join('.');
    }
  }

  /** '$1,250.00' — símbolo y locale desde AG.DB.state.settings. */
  function dinero(n, dec) {
    var conf = ajustes();
    var v = aNumero(n);
    var d = (dec === null || dec === undefined) ? 2 : Number(dec) || 0;
    var txt = conMiles(Math.abs(v), d, conf.locale);
    return (v < 0 ? '−' : '') + conf.simbolo + txt;
  }

  /** '12.5' */
  function num(n, dec) {
    var d = (dec === null || dec === undefined) ? 1 : Number(dec) || 0;
    return conMiles(aNumero(n), d, ajustes().locale);
  }

  /** '12.5%' */
  function pct(n, dec) {
    var d = (dec === null || dec === undefined) ? 1 : Number(dec) || 0;
    return conMiles(aNumero(n), d, ajustes().locale) + '%';
  }

  /** '+1.2 kg' / '−0.8 kg' (menos real U+2212). */
  function signo(n, dec, unidad) {
    var v = aNumero(n);
    var d = (dec === null || dec === undefined) ? 1 : Number(dec) || 0;
    var u = unidad ? ' ' + unidad : '';
    var abs = conMiles(Math.abs(v), d, ajustes().locale);
    if (Math.abs(v) < Math.pow(10, -d) / 2) return '0' + (d > 0 ? '.' + new Array(d + 1).join('0') : '') + u;
    return (v > 0 ? '+' : '−') + abs + u;
  }

  /**
   * Clase de color implícita según el signo.
   * invertir = true cuando bajar es lo bueno (grasa, cintura...).
   */
  function signoClase(n, invertir) {
    var v = aNumero(n);
    if (v === 0) return 'muted';
    var bueno = invertir ? v < 0 : v > 0;
    return bueno ? 'txt-ok' : 'txt-error';
  }

  /** Igual que signo() pero envuelto en un <span> con su clase. */
  function signoHTML(n, dec, unidad, invertir) {
    return '<span class="' + signoClase(n, invertir) + ' bold">' + esc(signo(n, dec, unidad)) + '</span>';
  }

  /* =========================================================
     4. Personas: nombre, iniciales, color, avatar, badges
     ========================================================= */

  /** 'Julio César Ramírez' */
  function nombreCompleto(usuario) {
    if (!usuario) return '';
    if (typeof usuario === 'string') return usuario.trim();
    var n = (usuario.nombre || '').trim();
    var a = (usuario.apellidos || '').trim();
    var completo = (n + ' ' + a).trim();
    return completo || (usuario.email || '').trim();
  }

  /** 'JC' */
  function iniciales(nombre, apellidos) {
    var n = '', a = '';
    if (nombre && typeof nombre === 'object') {
      n = String(nombre.nombre || '');
      a = String(nombre.apellidos || '');
      if (!n && !a) n = String(nombre.email || '');
    } else {
      n = String(nombre === null || nombre === undefined ? '' : nombre);
      a = String(apellidos === null || apellidos === undefined ? '' : apellidos);
    }
    n = n.trim(); a = a.trim();
    if (!n && !a) return '?';
    if (n && a) return (n.charAt(0) + a.charAt(0)).toUpperCase();
    var partes = (n || a).split(/[\s._-]+/).filter(function (x) { return x; });
    if (partes.length >= 2) return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    return (partes[0] || '?').slice(0, 2).toUpperCase();
  }

  /** Color determinista de la paleta a partir de un texto. */
  function colorDe(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto);
    if (!t) return PALETA[0];
    var h = 5381;
    for (var i = 0; i < t.length; i++) {
      h = ((h << 5) + h + t.charCodeAt(i)) & 0x7fffffff;
    }
    return PALETA[h % PALETA.length];
  }

  /** HTML del avatar. tamano: 'sm' | '' | 'lg' | 'xl'. */
  function avatar(usuario, tamano) {
    var t = String(tamano || '').replace('avatar-', '');
    var clase = 'avatar' + (t === 'sm' || t === 'lg' || t === 'xl' ? ' avatar-' + t : '');
    var nombre = nombreCompleto(usuario);
    var ini = nombre ? iniciales(usuario && typeof usuario === 'object' ? usuario : nombre) : '?';
    var titulo = nombre || 'Sin nombre';
    var color = (usuario && usuario.avatarColor) ? usuario.avatarColor : colorDe(titulo + (usuario && usuario.id ? usuario.id : ''));
    return '<div class="' + clase + '" style="background:' + esc(color) + '" title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '">' + esc(ini) + '</div>';
  }

  var ALIAS_BADGE = { error: 'danger', peligro: 'danger', exito: 'ok', bien: 'ok', aviso: 'warn', neutro: 'muted' };

  /** <span class="badge badge-ok">Activo</span> */
  function badge(texto, tipo) {
    var t = String(tipo || '').toLowerCase();
    t = ALIAS_BADGE[t] || t;
    var clase = 'badge' + (t ? ' badge-' + t : '');
    return '<span class="' + clase + '">' + esc(texto) + '</span>';
  }

  /* =========================================================
     5. Estrellas
     ========================================================= */

  var RUTA_ESTRELLA = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

  function svgEstrella(llena, tam) {
    var s = Number(tam) || 18;
    var relleno = llena
      ? 'fill="currentColor"'
      : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' + relleno +
      ' aria-hidden="true" focusable="false"><path d="' + RUTA_ESTRELLA + '"/></svg>';
  }

  var estrellasEnganchadas = false;

  function engancharEstrellas() {
    if (estrellasEnganchadas || !document) return;
    estrellasEnganchadas = true;
    document.addEventListener('change', function (e) {
      var input = e.target;
      if (!input || input.type !== 'radio') return;
      var caja = input.closest ? input.closest('.stars-input') : null;
      if (!caja) return;
      var valor = Number(input.value) || 0;
      caja.setAttribute('data-valor', String(valor));
      var etiquetas = caja.querySelectorAll('label.star');
      for (var i = 0; i < etiquetas.length; i++) {
        var n = Number(etiquetas[i].getAttribute('data-valor')) || 0;
        var encendida = n <= valor;
        etiquetas[i].classList.toggle('on', encendida);
        etiquetas[i].innerHTML = svgEstrella(encendida, etiquetas[i].getAttribute('data-tam'));
      }
    });
  }

  /**
   * 5 estrellas en SVG.
   * opts: { editable:Boolean, name:String, size:Number, texto:Boolean }
   */
  function estrellas(n, opts) {
    var o = opts || {};
    var valor = Math.max(0, Math.min(5, Math.round(aNumero(n))));
    var tam = Number(o.size) || (o.editable ? 26 : 16);
    var i, html;

    if (o.editable) {
      engancharEstrellas();
      var nombre = o.name || uid('cal_');
      var base = uid('st_');
      html = '<span class="stars stars-input" data-name="' + esc(nombre) + '" data-valor="' + valor + '" role="radiogroup" aria-label="Calificación">';
      for (i = 1; i <= 5; i++) {
        var idr = base + '_' + i;
        var marcada = (i === valor) ? ' checked' : '';
        html += '<input type="radio" name="' + esc(nombre) + '" id="' + idr + '" value="' + i + '"' + marcada +
          ' style="position:absolute;width:1px;height:1px;opacity:0;margin:0;padding:0;border:0">';
        html += '<label class="star' + (i <= valor ? ' on' : '') + '" for="' + idr + '" data-valor="' + i + '" data-tam="' + tam +
          '" title="' + i + (i === 1 ? ' estrella' : ' estrellas') + '">' + svgEstrella(i <= valor, tam) + '</label>';
      }
      html += '</span>';
      return html;
    }

    html = '<span class="stars" data-valor="' + valor + '" title="' + valor + ' de 5" aria-label="' + valor + ' de 5 estrellas">';
    for (i = 1; i <= 5; i++) {
      html += '<span class="star' + (i <= valor ? ' on' : '') + '">' + svgEstrella(i <= valor, tam) + '</span>';
    }
    if (o.texto) html += '<span class="mini muted">' + num(aNumero(n), 1) + '</span>';
    html += '</span>';
    return html;
  }

  /* =========================================================
     6. DOM
     ========================================================= */

  function $(sel, ctx) {
    try { return (ctx || document).querySelector(sel); }
    catch (e) { return null; }
  }

  function $$(sel, ctx) {
    try {
      var lista = (ctx || document).querySelectorAll(sel);
      return Array.prototype.slice.call(lista);
    } catch (e) { return []; }
  }

  /** Delegación de eventos. Devuelve una función para desenganchar. */
  function delegar(ctx, evento, sel, fn) {
    var raiz = typeof ctx === 'string' ? $(ctx) : (ctx || document);
    if (!raiz || typeof fn !== 'function') return function () {};
    function manejador(e) {
      var destino = e.target;
      if (!destino || !destino.closest) return;
      var el = destino.closest(sel);
      if (el && raiz.contains(el)) fn.call(el, e, el);
    }
    raiz.addEventListener(evento, manejador);
    return function () { raiz.removeEventListener(evento, manejador); };
  }

  function debounce(fn, ms) {
    var t = null;
    var espera = Number(ms) || 250;
    function envuelta() {
      var ctx = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(ctx, args); }, espera);
    }
    envuelta.cancelar = function () { if (t) { clearTimeout(t); t = null; } };
    return envuelta;
  }

  /** Copia texto al portapapeles. Promise que resuelve true. */
  function copiar(texto) {
    var t = texto === null || texto === undefined ? '' : String(texto);
    return new Promise(function (resolver, rechazar) {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(t).then(function () { resolver(true); }, function () { respaldo(); });
      } else {
        respaldo();
      }
      function respaldo() {
        try {
          var area = document.createElement('textarea');
          area.value = t;
          area.setAttribute('readonly', 'readonly');
          area.style.position = 'fixed';
          area.style.top = '-1000px';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          area.setSelectionRange(0, t.length);
          var ok = document.execCommand('copy');
          document.body.removeChild(area);
          if (ok) resolver(true); else rechazar(new Error('No se pudo copiar'));
        } catch (e) {
          rechazar(new Error('No se pudo copiar'));
        }
      }
    });
  }

  /* =========================================================
     7. Avisos (toast)
     ========================================================= */

  var ICONOS_TOAST = {
    ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 16.5H2.5L12 3z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8v.1"/></svg>'
  };

  var NOMBRE_ICONO = { ok: 'check', error: 'x', warn: 'alerta', info: 'info' };

  function iconoToast(tipo) {
    try {
      if (window.AG && AG.Icons && typeof AG.Icons.get === 'function') {
        var svg = AG.Icons.get(NOMBRE_ICONO[tipo] || 'info', 18);
        if (svg) return svg;
      }
    } catch (e) { /* se usa el icono interno */ }
    return ICONOS_TOAST[tipo] || ICONOS_TOAST.info;
  }

  function contenedorToasts() {
    var c = document.getElementById('toasts');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toasts';
      c.className = 'toast-wrap';
      c.setAttribute('role', 'status');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  /** Aviso flotante apilable. tipo: 'ok'|'error'|'info'|'warn'. */
  function toast(mensaje, tipo, ms) {
    if (!document || !document.body) return null;
    var t = String(tipo || 'info').toLowerCase();
    if (t === 'exito') t = 'ok';
    if (t === 'peligro' || t === 'danger') t = 'error';
    if (!ICONOS_TOAST[t]) t = 'info';

    var caja = contenedorToasts();
    var el = document.createElement('div');
    el.className = 'toast toast-' + t;
    el.innerHTML = '<span class="toast-icono">' + iconoToast(t) + '</span>' +
      '<span class="toast-txt">' + esc(mensaje) + '</span>';

    var cerrado = false;
    var temporizador = null;

    function cerrar() {
      if (cerrado) return;
      cerrado = true;
      if (temporizador) clearTimeout(temporizador);
      el.classList.add('saliendo');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }

    el.addEventListener('click', cerrar);
    caja.appendChild(el);

    // Se limita la pila visible para no tapar la pantalla
    var vivos = caja.querySelectorAll('.toast');
    if (vivos.length > 4) {
      var sobra = vivos[0];
      if (sobra && sobra.parentNode) sobra.parentNode.removeChild(sobra);
    }

    temporizador = setTimeout(cerrar, Number(ms) > 0 ? Number(ms) : 3500);
    el.cerrar = cerrar;
    return el;
  }

  /* =========================================================
     8. Modales
     ========================================================= */

  var pilaModales = [];
  var scrollPrevio = null;
  var tecladoModalListo = false;

  function contenedorModales() {
    var c = document.getElementById('modales');
    if (!c) {
      c = document.createElement('div');
      c.id = 'modales';
      document.body.appendChild(c);
    }
    return c;
  }

  function bloquearScroll() {
    if (pilaModales.length !== 1) return;
    scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-abierto');
  }

  function liberarScroll() {
    if (pilaModales.length > 0) return;
    document.body.style.overflow = scrollPrevio || '';
    document.body.classList.remove('modal-abierto');
    scrollPrevio = null;
  }

  function enfocables(root) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  function prepararTecladoModal() {
    if (tecladoModalListo) return;
    tecladoModalListo = true;
    document.addEventListener('keydown', function (e) {
      if (!pilaModales.length) return;
      var arriba = pilaModales[pilaModales.length - 1];

      if (e.key === 'Escape' || e.keyCode === 27) {
        if (arriba.cerrable !== false) {
          e.preventDefault();
          arriba.cerrar();
        }
        return;
      }

      if (e.key === 'Tab' || e.keyCode === 9) {
        var lista = enfocables(arriba.root);
        if (!lista.length) return;
        var primero = lista[0], ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault(); ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault(); primero.focus();
        } else if (!arriba.root.contains(document.activeElement)) {
          e.preventDefault(); primero.focus();
        }
      }
    });
  }

  function iconoCerrar() {
    try {
      if (window.AG && AG.Icons && typeof AG.Icons.get === 'function') {
        var svg = AG.Icons.get('x', 18);
        if (svg) return svg;
      }
    } catch (e) { /* se usa el aspa interna */ }
    return ICONOS_TOAST.error;
  }

  /**
   * Modal.
   * opciones: { titulo, cuerpo, ancho:'md'|'lg'|'xl', cerrable,
   *             acciones:[{texto, clase, icono, onClick(api, evento), cerrar}],
   *             onOpen(root, api), onCerrar() }
   * Devuelve { cerrar, root, backdrop }.
   */
  function modal(opciones) {
    var o = opciones || {};
    prepararTecladoModal();

    var contenedor = contenedorModales();
    var enfocadoPrevio = document.activeElement;

    var ancho = String(o.ancho || 'md');
    var claseAncho = (ancho === 'lg' || ancho === 'xl') ? ' modal-' + ancho : '';
    var cerrable = o.cerrable !== false;

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var caja = document.createElement('div');
    caja.className = 'modal' + claseAncho;
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('tabindex', '-1');
    if (o.titulo) caja.setAttribute('aria-label', String(o.titulo));

    var htmlCabecera = '';
    if (o.titulo || cerrable) {
      htmlCabecera = '<div class="modal-head">' +
        '<h3 class="modal-titulo">' + esc(o.titulo || '') + '</h3>' +
        (cerrable ? '<button type="button" class="btn-icono" data-cerrar-modal aria-label="Cerrar">' + iconoCerrar() + '</button>' : '') +
        '</div>';
    }

    var acciones = Array.isArray(o.acciones) ? o.acciones : [];
    var htmlPie = '';
    if (acciones.length) {
      htmlPie = '<div class="modal-foot">' + acciones.map(function (a, i) {
        var icono = '';
        if (a.icono) {
          try {
            if (window.AG && AG.Icons && typeof AG.Icons.get === 'function') icono = AG.Icons.get(a.icono, 16) + ' ';
          } catch (e) { icono = ''; }
        }
        return '<button type="button" class="btn ' + esc(a.clase || 'btn-ghost') + '" data-accion="' + i + '"' +
          (a.deshabilitado ? ' disabled' : '') + '>' + icono + esc(a.texto || '') + '</button>';
      }).join('') + '</div>';
    }

    var cuerpoEsElemento = o.cuerpo && typeof o.cuerpo === 'object' && o.cuerpo.nodeType === 1;

    caja.innerHTML = htmlCabecera +
      '<div class="modal-body">' + (cuerpoEsElemento ? '' : (o.cuerpo === null || o.cuerpo === undefined ? '' : String(o.cuerpo))) + '</div>' +
      htmlPie;

    if (cuerpoEsElemento) {
      var cuerpoEl = caja.querySelector('.modal-body');
      if (cuerpoEl) cuerpoEl.appendChild(o.cuerpo);
    }

    backdrop.appendChild(caja);
    contenedor.appendChild(backdrop);

    var cerrado = false;

    function cerrar() {
      if (cerrado) return;
      cerrado = true;

      var idx = pilaModales.indexOf(registro);
      if (idx >= 0) pilaModales.splice(idx, 1);

      backdrop.classList.add('saliendo');
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }, 200);

      liberarScroll();

      if (typeof o.onCerrar === 'function') {
        try { o.onCerrar(); } catch (e) { /* el cierre nunca debe romper la app */ }
      }
      if (enfocadoPrevio && typeof enfocadoPrevio.focus === 'function' && document.contains(enfocadoPrevio)) {
        try { enfocadoPrevio.focus(); } catch (e) { /* elemento ya desmontado */ }
      }
    }

    var api = { cerrar: cerrar, root: caja, backdrop: backdrop, cuerpo: caja.querySelector('.modal-body') };
    var registro = { root: caja, backdrop: backdrop, cerrar: cerrar, cerrable: cerrable };
    pilaModales.push(registro);
    bloquearScroll();

    // Cerrar con el aspa
    var btnX = caja.querySelector('[data-cerrar-modal]');
    if (btnX) btnX.addEventListener('click', cerrar);

    // Cerrar al hacer clic fuera
    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop && cerrable) cerrar();
    });

    // Cualquier elemento con data-cerrar-modal dentro del cuerpo también cierra
    caja.addEventListener('click', function (e) {
      var disparador = e.target.closest ? e.target.closest('[data-cerrar-modal]') : null;
      if (disparador && caja.contains(disparador)) { e.preventDefault(); cerrar(); }
    });

    // Acciones del pie
    var pie = caja.querySelector('.modal-foot');
    if (pie) {
      pie.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-accion]') : null;
        if (!btn) return;
        var accion = acciones[Number(btn.getAttribute('data-accion'))];
        if (!accion) return;
        if (typeof accion.onClick === 'function') {
          var r;
          try { r = accion.onClick(api, e); }
          catch (err) { r = undefined; }
          if (accion.cerrar === true && r !== false) cerrar();
        } else {
          cerrar();
        }
      });
    }

    if (typeof o.onOpen === 'function') {
      try { o.onOpen(caja, api); } catch (e) { /* un onOpen con fallas no debe tumbar el modal */ }
    }

    // Enfoque inicial
    setTimeout(function () {
      if (cerrado) return;
      var auto = caja.querySelector('[autofocus]');
      var campo = auto || caja.querySelector('.modal-body input:not([type=hidden]):not([disabled]), .modal-body select, .modal-body textarea');
      var principal = caja.querySelector('.modal-foot .btn-primary, .modal-foot .btn-danger, .modal-foot .btn-ok');
      var destino = campo || principal || caja;
      try { destino.focus(); } catch (e) { /* sin foco disponible */ }
    }, 30);

    return api;
  }

  /** Confirmación con promesa. Cerrar sin decidir equivale a "no". */
  function confirmar(mensaje, titulo, opciones) {
    var o = opciones || {};
    return new Promise(function (resolver) {
      var resuelto = false;
      function terminar(valor) {
        if (resuelto) return;
        resuelto = true;
        resolver(!!valor);
      }
      modal({
        titulo: titulo || 'Confirmar',
        ancho: o.ancho || 'md',
        cuerpo: '<p class="confirm-msg">' + esc(mensaje).replace(/\n/g, '<br>') + '</p>' +
          (o.detalle ? '<p class="mini muted">' + esc(o.detalle) + '</p>' : ''),
        acciones: [
          {
            texto: o.textoCancelar || 'Cancelar',
            clase: 'btn-ghost',
            onClick: function (api) { terminar(false); api.cerrar(); }
          },
          {
            texto: o.textoOk || 'Sí, continuar',
            clase: o.peligro ? 'btn-danger' : 'btn-primary',
            onClick: function (api) { terminar(true); api.cerrar(); }
          }
        ],
        onCerrar: function () { terminar(false); }
      });
    });
  }

  /* =========================================================
     9. Formularios
     ========================================================= */

  function asignarRuta(obj, ruta, valor) {
    var partes = String(ruta).split('.');
    var actual = obj;
    for (var i = 0; i < partes.length - 1; i++) {
      var clave = partes[i];
      if (typeof actual[clave] !== 'object' || actual[clave] === null) actual[clave] = {};
      actual = actual[clave];
    }
    actual[partes[partes.length - 1]] = valor;
  }

  function obtenerRuta(obj, ruta) {
    if (!obj || !ruta) return undefined;
    var partes = String(ruta).split('.');
    var actual = obj;
    for (var i = 0; i < partes.length; i++) {
      if (actual === null || actual === undefined) return undefined;
      actual = actual[partes[i]];
    }
    return actual;
  }

  /**
   * Convierte un <form> en objeto.
   * - checkbox suelto -> boolean; grupo con el mismo nombre -> array de valores
   * - input[type=number|range] -> Number (o null si viene vacío)
   * - nombres con punto -> objetos anidados ('contactoEmergencia.nombre')
   */
  function formToObject(form) {
    var datos = {};
    var el = (typeof form === 'string') ? $(form) : form;
    if (!el || !el.elements) return datos;

    var elementos = Array.prototype.slice.call(el.elements);
    var conteo = {};
    var i, campo;

    for (i = 0; i < elementos.length; i++) {
      campo = elementos[i];
      if (campo.name && campo.type === 'checkbox') {
        conteo[campo.name] = (conteo[campo.name] || 0) + 1;
      }
    }

    var gruposCheck = {};

    for (i = 0; i < elementos.length; i++) {
      campo = elementos[i];
      var nombre = campo.name;
      if (!nombre || campo.disabled) continue;

      var tipo = (campo.type || '').toLowerCase();
      if (tipo === 'submit' || tipo === 'button' || tipo === 'reset' || tipo === 'image' || tipo === 'file') continue;

      if (tipo === 'checkbox') {
        if (conteo[nombre] > 1) {
          if (!gruposCheck[nombre]) gruposCheck[nombre] = [];
          if (campo.checked) gruposCheck[nombre].push(campo.value);
          asignarRuta(datos, nombre, gruposCheck[nombre]);
        } else {
          asignarRuta(datos, nombre, !!campo.checked);
        }
        continue;
      }

      if (tipo === 'radio') {
        if (campo.checked) {
          asignarRuta(datos, nombre, campo.hasAttribute('data-num') ? aNumero(campo.value) : campo.value);
        } else if (obtenerRuta(datos, nombre) === undefined) {
          asignarRuta(datos, nombre, null);
        }
        continue;
      }

      if (tipo === 'select-multiple') {
        var seleccionados = [];
        for (var j = 0; j < campo.options.length; j++) {
          if (campo.options[j].selected) seleccionados.push(campo.options[j].value);
        }
        asignarRuta(datos, nombre, seleccionados);
        continue;
      }

      if (tipo === 'number' || tipo === 'range' || campo.hasAttribute('data-num')) {
        var crudo = String(campo.value === null || campo.value === undefined ? '' : campo.value).trim();
        if (crudo === '') {
          asignarRuta(datos, nombre, null);
        } else {
          var v = Number(crudo.replace(/,/g, '.'));
          asignarRuta(datos, nombre, isFinite(v) ? v : null);
        }
        continue;
      }

      asignarRuta(datos, nombre, typeof campo.value === 'string' ? campo.value.trim() : campo.value);
    }

    return datos;
  }

  /* =========================================================
     10. Descargar e imprimir
     ========================================================= */

  /** Descarga un contenido como archivo. */
  function descargar(nombreArchivo, contenido, mime) {
    try {
      var nombre = String(nombreArchivo || 'alliance-gym.txt');
      var tipo = mime || 'text/plain;charset=utf-8';
      var blob;

      if (contenido instanceof Blob) {
        blob = contenido;
      } else {
        var texto;
        if (typeof contenido === 'string') texto = contenido;
        else if (contenido === null || contenido === undefined) texto = '';
        else texto = JSON.stringify(contenido, null, 2);
        blob = new Blob([texto], { type: tipo });
      }

      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 800);
      return true;
    } catch (e) {
      toast('No se pudo generar la descarga', 'error');
      return false;
    }
  }

  var CSS_IMPRESION =
    '@page{margin:14mm}' +
    'html,body{background:#fff !important;color:#111 !important}' +
    'body{padding:0;margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.impresion{padding:8px 4px}' +
    '.impresion .card,.impresion .kpi,.impresion .list-item{background:#fff !important;border:1px solid #d8d8d8 !important;box-shadow:none !important;color:#111 !important}' +
    '.impresion .muted,.impresion .mini{color:#555 !important}' +
    '.impresion .table th,.impresion .table td{border-color:#d8d8d8 !important;color:#111 !important}' +
    '.impresion .btn,.impresion .page-acciones,.impresion .no-imprimir{display:none !important}' +
    '.impresion h1,.impresion h2,.impresion h3{color:#111 !important}' +
    '@media print{.no-imprimir{display:none !important}}';

  function estiloRespaldoImpresion() {
    var id = 'ag-estilo-impresion';
    if (document.getElementById(id)) return;
    var st = document.createElement('style');
    st.id = id;
    st.textContent =
      '.solo-impresion{display:none}' +
      '@media print{' +
        'body>*:not(.solo-impresion){display:none !important}' +
        '.solo-impresion{display:block !important;background:#fff;color:#111;padding:0;margin:0}' +
        CSS_IMPRESION +
      '}';
    document.head.appendChild(st);
  }

  function imprimirEnLaPagina(htmlInterno, titulo) {
    estiloRespaldoImpresion();
    var caja = document.createElement('div');
    caja.className = 'solo-impresion impresion';
    caja.innerHTML = '<h2>' + esc(titulo || '') + '</h2>' + String(htmlInterno || '');
    document.body.appendChild(caja);
    var limpiar = function () {
      if (caja.parentNode) caja.parentNode.removeChild(caja);
      window.removeEventListener('afterprint', limpiar);
    };
    window.addEventListener('afterprint', limpiar);
    setTimeout(function () {
      try { window.print(); } catch (e) { /* el navegador bloqueó la impresión */ }
      setTimeout(limpiar, 1500);
    }, 60);
    return false;
  }

  /** Abre una ventana con el CSS del sitio y lanza la impresión. */
  function imprimir(htmlInterno, titulo) {
    var nombreGym = '';
    try {
      var s = window.AG && AG.DB && AG.DB.state && AG.DB.state.settings;
      if (s && s.nombreGym) nombreGym = String(s.nombreGym);
    } catch (e) { nombreGym = ''; }

    var t = titulo || nombreGym || 'Impresión';
    var contenido = String(htmlInterno === null || htmlInterno === undefined ? '' : htmlInterno);

    var enlaces = '';
    var hojas = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < hojas.length; i++) {
      if (hojas[i].href) enlaces += '<link rel="stylesheet" href="' + esc(hojas[i].href) + '">';
    }

    var estilosInternos = '';
    var estilos = document.querySelectorAll('style');
    for (var k = 0; k < estilos.length; k++) {
      if (estilos[k].id !== 'ag-estilo-impresion') estilosInternos += estilos[k].textContent || '';
    }

    var ventana = null;
    try { ventana = window.open('', '_blank', 'width=940,height=760'); }
    catch (e) { ventana = null; }

    if (!ventana || !ventana.document) {
      return imprimirEnLaPagina(contenido, t);
    }

    var doc = '<!doctype html><html lang="es" data-tema="claro"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(t) + '</title>' + enlaces +
      '<style>' + estilosInternos + CSS_IMPRESION + '</style></head>' +
      '<body class="impresion">' +
      (nombreGym ? '<h1 style="margin:0 0 4px;font-size:20px">' + esc(nombreGym) + '</h1>' : '') +
      '<h2 style="margin:0 0 14px;font-size:15px;font-weight:600;color:#555">' + esc(t) + '</h2>' +
      contenido + '</body></html>';

    try {
      ventana.document.open();
      ventana.document.write(doc);
      ventana.document.close();
    } catch (e) {
      try { ventana.close(); } catch (e2) { /* la ventana ya no existe */ }
      return imprimirEnLaPagina(contenido, t);
    }

    var lanzar = function () {
      try { ventana.focus(); ventana.print(); }
      catch (e) { /* el usuario cerró la ventana antes de imprimir */ }
    };

    if (ventana.document.readyState === 'complete') setTimeout(lanzar, 400);
    else ventana.onload = function () { setTimeout(lanzar, 300); };

    return true;
  }

  /* =========================================================
     11. Colecciones
     ========================================================= */

  function selector(campoOFn) {
    if (typeof campoOFn === 'function') return campoOFn;
    if (typeof campoOFn === 'string' && campoOFn) {
      return function (item) { return obtenerRuta(item, campoOFn); };
    }
    return function (item) { return item; };
  }

  /** Agrupa un arreglo por el resultado de fn (función o campo). */
  function agrupar(arr, fn) {
    var salida = {};
    if (!Array.isArray(arr)) return salida;
    var obtener = selector(fn);
    for (var i = 0; i < arr.length; i++) {
      var clave;
      try { clave = obtener(arr[i]); } catch (e) { clave = undefined; }
      if (clave === null || clave === undefined) clave = 'sin_clave';
      clave = String(clave);
      if (!salida[clave]) salida[clave] = [];
      salida[clave].push(arr[i]);
    }
    return salida;
  }

  /** Suma numérica. */
  function suma(arr, fn) {
    if (!Array.isArray(arr) || !arr.length) return 0;
    var obtener = selector(fn);
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
      var v;
      try { v = obtener(arr[i]); } catch (e) { v = 0; }
      var n = Number(v);
      if (isFinite(n)) total += n;
    }
    return total;
  }

  /** Promedio numérico (0 si no hay elementos). */
  function promedio(arr, fn) {
    if (!Array.isArray(arr) || !arr.length) return 0;
    var obtener = selector(fn);
    var total = 0, cuenta = 0;
    for (var i = 0; i < arr.length; i++) {
      var v;
      try { v = obtener(arr[i]); } catch (e) { v = null; }
      var n = Number(v);
      if (v !== null && v !== undefined && v !== '' && isFinite(n)) { total += n; cuenta++; }
    }
    return cuenta ? total / cuenta : 0;
  }

  /** Copia ordenada. campo admite rutas anidadas ('a.b') o función. dir: 'asc'|'desc'. */
  function ordenar(arr, campo, dir) {
    if (!Array.isArray(arr)) return [];
    var obtener = selector(campo);
    var factor = String(dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    var locale = ajustes().locale;

    return arr.slice().sort(function (a, b) {
      var va, vb;
      try { va = obtener(a); } catch (e) { va = null; }
      try { vb = obtener(b); } catch (e) { vb = null; }

      var vacioA = (va === null || va === undefined || va === '');
      var vacioB = (vb === null || vb === undefined || vb === '');
      if (vacioA && vacioB) return 0;
      if (vacioA) return 1;   // los vacíos siempre al final
      if (vacioB) return -1;

      if (typeof va === 'boolean' || typeof vb === 'boolean') {
        return ((va ? 1 : 0) - (vb ? 1 : 0)) * factor;
      }

      var na = Number(va), nb = Number(vb);
      var numericos = typeof va !== 'boolean' && typeof vb !== 'boolean' &&
        va !== '' && vb !== '' && isFinite(na) && isFinite(nb) &&
        !(typeof va === 'string' && /[a-z]/i.test(va)) && !(typeof vb === 'string' && /[a-z]/i.test(vb));

      if (numericos) return (na - nb) * factor;

      var sa = String(va), sb = String(vb);
      var cmp;
      try { cmp = sa.localeCompare(sb, locale, { numeric: true, sensitivity: 'base' }); }
      catch (e) { cmp = sa < sb ? -1 : (sa > sb ? 1 : 0); }
      return cmp * factor;
    });
  }

  /* =========================================================
     12. Exportación
     ========================================================= */

  U.MESES = MESES;
  U.MESES_CORTOS = MESES_CORTOS;
  U.DIAS_SEMANA = DIAS_SEMANA;
  U.DIAS_SEMANA_CORTOS = DIAS_SEMANA_CORTOS;
  U.DIAS_SEMANA_LUNES = DIAS_SEMANA_LUNES;
  U.PALETA = PALETA;

  // Texto
  U.esc = esc;
  U.capitalizar = capitalizar;
  U.truncar = truncar;
  U.normalizar = normalizar;
  U.uid = uid;

  // Fechas
  U.hoy = hoy;
  U.ahora = ahora;
  U.iso = iso;
  U.fecha = fecha;
  U.fechaRelativa = fechaRelativa;
  U.mesActual = mesActual;
  U.mesDe = mesDe;
  U.nombreMes = nombreMes;
  U.sumaMeses = sumaMeses;
  U.sumaDias = sumaDias;
  U.diasEntre = diasEntre;
  U.edad = edad;
  U.diasDelMes = diasDelMes;
  U.aDate = aDate;
  U.partesDe = partesDe;

  // Números
  U.dinero = dinero;
  U.num = num;
  U.pct = pct;
  U.signo = signo;
  U.signoClase = signoClase;
  U.signoHTML = signoHTML;
  U.aNumero = aNumero;

  // Personas y piezas de interfaz
  U.iniciales = iniciales;
  U.colorDe = colorDe;
  U.nombreCompleto = nombreCompleto;
  U.avatar = avatar;
  U.badge = badge;
  U.estrellas = estrellas;

  // Avisos y modales
  U.toast = toast;
  U.modal = modal;
  U.confirmar = confirmar;

  // Formularios y archivos
  U.formToObject = formToObject;
  U.descargar = descargar;
  U.imprimir = imprimir;

  // Colecciones
  U.agrupar = agrupar;
  U.suma = suma;
  U.promedio = promedio;
  U.ordenar = ordenar;
  U.obtenerRuta = obtenerRuta;

  // DOM
  U.debounce = debounce;
  U.$ = $;
  U.$$ = $$;
  U.delegar = delegar;
  U.copiar = copiar;

  AG.Utils = U;
})(window.AG);
