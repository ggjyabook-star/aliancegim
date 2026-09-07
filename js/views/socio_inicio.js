/* =============================================================
   ALLIANCE GYM — AG.Views.SocioInicio (rediseño v2)
   -------------------------------------------------------------
   El panel del socio, pensado para gente que no quiere leer:

     1. Saludo humano y la fecha.
     2. Tarjeta HOY: la única acción del día, con la ilustración
        animada del primer ejercicio (AG.Ilustra).
     3. Cuatro tiles: peso · grasa · visitas · días de membresía.
     4. Tres tarjetas compactas: comida, progreso y entrenador.
     5. Desplegables cerrados: avisos, coach, eventos y resumen.

   Si el socio aún no responde la bienvenida (bienvenidaHecha
   falso) se muestran, en lugar del panel, tres preguntas grandes.

   Ruta: 'socio/inicio' (solo rol 'socio').

   Reglas de la casa: JavaScript clásico sin módulos, todo en
   español, escapado con AG.Utils.esc(), nada de alert/confirm/
   prompt, nada de localStorage directo, sin párrafos y con el
   tono de la sección 8 de REDISENO.md (nadie se siente regañado).

   El HTML inicial pesa menos de 20 KB: los desplegables se
   rellenan al abrirse y las minigráficas son polilíneas simples.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Días de la semana (0 = domingo) en los que toca entrenar según los
     días por semana del plan. Es el mismo reparto de "Mi rutina". */
  var DIAS_ENTRENO = {
    1: [1],
    2: [2, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 0]
  };

  /* Días seguidos sin venir a partir de los cuales se le extraña. */
  var DIAS_EXTRANAR = 3;

  /* Platillos mexicanos por momento, para cuando no hay recomendación del módulo. */
  var PLATILLO_BASE = {
    desayuno: '2 huevos a la mexicana con frijoles y 2 tortillas',
    colacion: 'Manzana con un puño de cacahuates',
    comida: 'Pollo asado con arroz y nopales',
    pre_entreno: 'Plátano con avena',
    post_entreno: 'Licuado de avena con leche y plátano',
    cena: 'Tacos de atún con jitomate'
  };

  var MOMENTO_NOMBRE = {
    desayuno: 'Desayuno',
    colacion: 'Colación',
    comida: 'Comida',
    pre_entreno: 'Antes de entrenar',
    post_entreno: 'Después de entrenar',
    cena: 'Cena'
  };

  var MOMENTO_SUSTITUTO = { desayuno: 'te cubre el desayuno', post_entreno: 'te cubre el post-entreno' };

  /* Las dos opciones del descanso activo. */
  var LIGERAS = {
    cardio: { nombre: 'Cardio ligero', patron: 'correr', minutos: 20, esfuerzo: 3 },
    movilidad: { nombre: 'Movilidad y estiramiento', patron: 'movilidad', minutos: 15, esfuerzo: 2 }
  };

  /* Preguntas de la bienvenida (una a la vez). */
  var PREGUNTAS = [
    {
      clave: 'horario', titulo: '¿A qué hora sueles venir?',
      opciones: [
        { v: 'manana', e: '🌅', t: 'Mañana', s: '6 a 11' },
        { v: 'mediodia', e: '☀️', t: 'Mediodía', s: '11 a 15' },
        { v: 'tarde', e: '🌇', t: 'Tarde', s: '15 a 19' },
        { v: 'noche', e: '🌙', t: 'Noche', s: '19 a 23' },
        { v: 'variable', e: '🔀', t: 'Depende', s: 'del día' }
      ]
    },
    {
      clave: 'dias', titulo: '¿Cuántos días a la semana quieres venir?',
      opciones: [
        { v: '2', e: '2', t: 'días', s: 'para empezar' },
        { v: '3', e: '3', t: 'días', s: 'lo más común' },
        { v: '4', e: '4', t: 'días', s: 'buen ritmo' },
        { v: '5', e: '5', t: 'días', s: 'con todo' },
        { v: '6', e: '6', t: 'días', s: 'nivel avanzado' }
      ]
    },
    {
      clave: 'desayuno', titulo: '¿Desayunas antes de entrenar?',
      opciones: [
        { v: 'si', e: '🍳', t: 'Sí', s: 'siempre' },
        { v: 'no', e: '⏱️', t: 'No', s: 'entreno en ayunas' },
        { v: 'aveces', e: '🤷', t: 'A veces', s: 'según el día' }
      ]
    }
  ];

  /* Estado de la bienvenida mientras el socio responde. */
  var bienvenida = null;

  /* =============================================================
     1. Ayudantes básicos (ninguno lanza)
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return AG.Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function lista(v) {
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }

  /* Número finito o null. */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  function nPos(v) {
    var x = n0(v);
    return (x !== null && x > 0) ? x : null;
  }

  function entero(v, porDefecto) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : porDefecto;
  }

  function texto(v) { return (v === null || v === undefined) ? '' : String(v); }

  function primerNombre(usuario) {
    var completo = U.nombreCompleto(usuario);
    return (completo.split(/\s+/)[0]) || 'socio';
  }

  /* 'HH:MM' -> minutos desde medianoche, o null. */
  function minutosDe(hora) {
    var m = /^(\d{1,2}):(\d{2})/.exec(texto(hora).trim());
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    return (h > 23 || mi > 59) ? null : h * 60 + mi;
  }

  function minutosAhora() {
    var f = new Date();
    return f.getHours() * 60 + f.getMinutes();
  }

  function enlaceWhatsApp(telefono, mensaje) {
    var digitos = texto(telefono).replace(/\D/g, '');
    if (digitos.length < 10) return '';
    if (digitos.length === 10) digitos = '52' + digitos;
    var url = 'https://wa.me/' + digitos;
    if (mensaje) {
      try { url += '?text=' + encodeURIComponent(String(mensaje)); } catch (e) { /* enlace sin texto */ }
    }
    return url;
  }

  function ajustes() {
    var s = null;
    try { s = AG.DB && AG.DB.state ? AG.DB.state.settings : null; } catch (e) { s = null; }
    return (s && typeof s === 'object') ? s : {};
  }

  function nombreGym() { return ajustes().nombreGym || 'Alliance Gym'; }

  /* ¿Existe AG.Mod.X.fn? (los módulos nuevos pueden no estar cargados). */
  function hayFn(modulo, fn) {
    return !!(AG.Mod && AG.Mod[modulo] && typeof AG.Mod[modulo][fn] === 'function');
  }

  /* Llama a otro módulo sin que un fallo suyo tumbe el panel. */
  function seguro(fn, alterno) {
    try {
      var r = fn();
      return (r === null || r === undefined) ? alterno : r;
    } catch (e) { return alterno; }
  }

  /* El socio de la sesión, siempre releído de la base. */
  function socioActual() {
    var u = null;
    try { u = AG.Auth && typeof AG.Auth.actual === 'function' ? AG.Auth.actual() : null; } catch (e) { u = null; }
    if (!u || u.rol !== 'socio') return null;
    return AG.DB.usuario(u.id) || u;
  }

  function botonRuta(path, textoBtn, clase, nombreIcono) {
    return '<a class="btn ' + (clase || 'btn-outline') + '" href="#/' + esc(path) + '">' +
      (nombreIcono ? icono(nombreIcono, 16) : '') + esc(textoBtn) + '</a>';
  }

  function ilustra(ejercicioId, opts) {
    if (!AG.Ilustra || typeof AG.Ilustra.get !== 'function') return '';
    try { return AG.Ilustra.get(ejercicioId, opts) || ''; } catch (e) { return ''; }
  }

  function ilustraPatron(patron, opts) {
    if (!AG.Ilustra || typeof AG.Ilustra.porPatron !== 'function') return '';
    try { return AG.Ilustra.porPatron(patron, opts) || ''; } catch (e) { return ''; }
  }

  /* Minigráfica diminuta: una polilínea sin estilos ni ejes (pesa ~200 bytes). */
  function chispa(valores, color) {
    var v = [], i;
    for (i = 0; i < valores.length; i++) if (n0(valores[i]) !== null) v.push(Number(valores[i]));
    if (v.length < 2) return '';
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    if (max === min) { max += 1; min -= 1; }
    var W = 100, H = 28, p = 3, pts = [];
    for (i = 0; i < v.length; i++) {
      var x = p + i * (W - 2 * p) / (v.length - 1);
      var y = (H - p) - (v[i] - min) / (max - min) * (H - 2 * p);
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    return '<svg class="si-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (color || 'var(--rojo)') +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }

  /* =============================================================
     2. Estilos propios (solo lo que el contrato CSS no trae)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-inicio';

  function asegurarEstilos() {
    if (!document || document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.si-semana{margin-top:12px;max-width:340px;font-size:12.5px;font-weight:600;color:var(--texto-2)}' +
      '.si-semana b{color:var(--texto)}' +
      '.si-semana .bar{margin-top:6px}' +
      '.si-semana .bar-fill{background:linear-gradient(90deg,var(--calma-oscuro),var(--calma))}' +
      '.hoy .descanso-opciones{margin-top:16px;width:100%}' +
      '.si-spark{display:block;width:100%;height:24px;margin-top:2px;opacity:.85}' +
      '.si-tres .card{display:flex;flex-direction:column}' +
      '.si-tres .card-body{flex:1 1 auto;display:flex;flex-direction:column;gap:8px}' +
      '.si-tres .card-body>.btn{margin-top:auto}' +
      '.si-cab{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--texto-3)}' +
      '.si-cab svg{width:16px;height:16px;color:var(--rojo)}' +
      '.si-num{font-size:32px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--texto);font-variant-numeric:tabular-nums}' +
      '.si-num small{font-size:13px;font-weight:700;letter-spacing:0;color:var(--texto-2);margin-left:4px}' +
      '.si-prox{display:flex;flex-direction:column;gap:2px;font-size:14px;font-weight:700;line-height:1.3;color:var(--texto)}' +
      '.si-prox span{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--texto-3)}' +
      '.si-espera{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;line-height:1.3;color:var(--texto)}' +
      '.si-espera>svg{flex:0 0 auto;color:var(--calma)}' +
      '.si-espera span{display:block;font-size:12px;font-weight:500;color:var(--texto-2)}' +
      '.si-anillo{display:flex;align-items:center;gap:12px}' +
      '.si-anillo>div:first-child{flex:0 0 84px}' +
      '.si-dia{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);font-size:13px}' +
      '.si-dia>b{flex:0 0 58px;color:var(--texto-2)}' +
      '.si-dia.es-hoy{border-color:var(--rojo)}' +
      '.si-lig{display:flex;align-items:center;gap:14px}' +
      '.si-lig>div:first-child{flex:0 0 110px}' +
      '@media(max-width:700px){.si-num{font-size:28px}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Lectura de datos (siempre acotada al propio socio)
     ============================================================= */

  function medicionesDelSocio(socioId) {
    var todas = AG.DB.medicionesDe(socioId), salida = [];
    for (var i = 0; i < todas.length; i++) {
      if (todas[i] && todas[i].visibleParaSocio !== false) salida.push(todas[i]);
    }
    return salida;
  }

  function valorPorRuta(obj, ruta) {
    var partes = String(ruta).split('.'), actual = obj;
    for (var i = 0; i < partes.length; i++) {
      if (actual === null || actual === undefined) return null;
      actual = actual[partes[i]];
    }
    return n0(actual);
  }

  /* Últimos valores de un dato de las mediciones (máximo 'tope'). */
  function serieDe(mediciones, ruta, tope) {
    var v = [];
    for (var i = 0; i < mediciones.length; i++) {
      var x = valorPorRuta(mediciones[i], ruta);
      if (x !== null) v.push({ fecha: mediciones[i].fecha, y: x });
    }
    return v.length > tope ? v.slice(v.length - tope) : v;
  }

  function soloValores(serie) {
    var v = [];
    for (var i = 0; i < serie.length; i++) v.push(serie[i].y);
    return v;
  }

  function bitacoraDeHoy(bitacoras) {
    var hoy = U.hoy();
    for (var i = 0; i < bitacoras.length; i++) {
      if (texto(bitacoras[i].fecha).slice(0, 10) === hoy) return bitacoras[i];
    }
    return null;
  }

  function tieneSeriesHechas(b) {
    var ej = lista(b && b.ejercicios);
    for (var i = 0; i < ej.length; i++) {
      var s = lista(ej[i] && ej[i].series);
      for (var j = 0; j < s.length; j++) if (s[j] && s[j].hecho) return true;
    }
    return false;
  }

  /* Qué día de la rutina toca hoy: { hoy, indice, dia, dow, salto, semana, dias } o null. */
  function diaQueToca(rutina) {
    var dias = lista(rutina && rutina.dias);
    if (!dias.length) return null;

    var n = entero(rutina.diasPorSemana, 0);
    if (!n || n < 1) n = dias.length;
    if (n > 7) n = 7;
    var pauta = DIAS_ENTRENO[n] || DIAS_ENTRENO[3];

    var semana = [], i;
    for (i = 0; i < pauta.length; i++) semana.push({ dow: pauta[i], indice: i % dias.length });

    var hoyDow = new Date().getDay();
    for (i = 0; i < semana.length; i++) {
      if (semana[i].dow === hoyDow) {
        return { hoy: true, indice: semana[i].indice, dia: dias[semana[i].indice], dow: hoyDow, salto: 0, semana: semana, dias: dias };
      }
    }

    var mejor = null, mejorSalto = 99;
    for (i = 0; i < semana.length; i++) {
      var salto = (semana[i].dow - hoyDow + 7) % 7 || 7;
      if (salto < mejorSalto) { mejorSalto = salto; mejor = semana[i]; }
    }
    return { hoy: false, indice: mejor.indice, dia: dias[mejor.indice], dow: mejor.dow, salto: mejorSalto, semana: semana, dias: dias };
  }

  function statsDia(dia) {
    var alterno = { ejercicios: lista(dia && dia.ejercicios).length, series: 0, minutos: 0 };
    if (!hayFn('Rutinas', 'estadisticasDia')) return alterno;
    return seguro(function () { return AG.Mod.Rutinas.estadisticasDia(dia); }, alterno);
  }

  /* Último día en que vino (asistencia o entrenamiento registrado). */
  function ultimaVisita(asistencias, bitacoras) {
    var mejor = '', i, f;
    for (i = 0; i < asistencias.length; i++) {
      f = texto(asistencias[i].fecha).slice(0, 10);
      if (f > mejor) mejor = f;
    }
    for (i = 0; i < bitacoras.length; i++) {
      if (bitacoras[i].completada === false && !tieneSeriesHechas(bitacoras[i])) continue;
      f = texto(bitacoras[i].fecha).slice(0, 10);
      if (f > mejor) mejor = f;
    }
    return mejor;
  }

  /* Días distintos con actividad en la semana natural (lunes a domingo). */
  function constanciaSemana(socio, rutina, asistencias, bitacoras) {
    var lunes = AG.DB.lunesDe(U.hoy()), domingo = U.sumaDias(lunes, 6);
    var dias = {}, i, f;
    for (i = 0; i < asistencias.length; i++) {
      f = texto(asistencias[i].fecha).slice(0, 10);
      if (f >= lunes && f <= domingo) dias[f] = true;
    }
    for (i = 0; i < bitacoras.length; i++) {
      if (bitacoras[i].completada === false && !tieneSeriesHechas(bitacoras[i])) continue;
      f = texto(bitacoras[i].fecha).slice(0, 10);
      if (f >= lunes && f <= domingo) dias[f] = true;
    }
    var hechas = Object.keys(dias).length;
    var meta = entero(socio.diasMeta, 0);
    if (meta < 2 || meta > 6) meta = entero(rutina && rutina.diasPorSemana, 3);
    if (meta < 1) meta = 3;
    return { hechas: hechas, meta: meta, pct: Math.min(100, Math.round(hechas / meta * 100)) };
  }

  function reunirDatos(socio) {
    var mediciones = medicionesDelSocio(socio.id);
    var asistencias = AG.DB.asistenciasDe(socio.id);
    var bitacoras = AG.DB.bitacorasDe(socio.id);
    var activa = AG.DB.rutinaActivaDe(socio.id);
    var rutina = activa ? activa.rutina : null;
    var periodo = U.mesActual();
    var ini = AG.DB.medicionDelMes(socio.id, periodo, 'inicial');
    var fin = AG.DB.medicionDelMes(socio.id, periodo, 'final');
    if (ini && ini.visibleParaSocio === false) ini = null;
    if (fin && fin.visibleParaSocio === false) fin = null;

    var hoyB = bitacoraDeHoy(bitacoras);
    var ultima = ultimaVisita(asistencias, bitacoras);
    var sinVenir = ultima ? U.diasEntre(ultima, U.hoy()) : null;
    var medPeso = null;
    for (var i = mediciones.length - 1; i >= 0 && !medPeso; i--) if (nPos(mediciones[i].pesoKg)) medPeso = mediciones[i];

    return {
      periodo: periodo,
      mediciones: mediciones,
      asistencias: asistencias,
      bitacoras: bitacoras,
      rutina: rutina,
      toca: rutina ? diaQueToca(rutina) : null,
      hoyBitacora: hoyB,
      hecha: !!(hoyB && (hoyB.completada === true || tieneSeriesHechas(hoyB))),
      medicionInicial: ini,
      medicionFinal: fin,
      coach: socio.coachId ? AG.DB.usuario(socio.coachId) : null,
      plan: AG.DB.plan(socio.planId),
      pagos: AG.DB.pagosDe(socio.id),
      estado: Calc.estadoMembresia(socio),
      racha: Calc.rachaDias(asistencias),
      extranamos: sinVenir !== null && sinVenir >= DIAS_EXTRANAR,
      peso: medPeso ? nPos(medPeso.pesoKg) : null,
      estatura: nPos(socio.estaturaCm) || (medPeso ? nPos(medPeso.estaturaCm) : null),
      semana: constanciaSemana(socio, rutina, asistencias, bitacoras)
    };
  }

  /* =============================================================
     4. Comida de hoy (AG.Mod.Nutricion.recomendacionDelDia o respaldo)
     ============================================================= */

  function momentoDe(nombre) {
    var t = U.normalizar(nombre);
    if (t.indexOf('desay') >= 0) return 'desayuno';
    if (t.indexOf('pre') >= 0) return 'pre_entreno';
    if (t.indexOf('post') >= 0) return 'post_entreno';
    if (t.indexOf('cena') >= 0 || t.indexOf('noct') >= 0) return 'cena';
    if (t.indexOf('colac') >= 0 || t.indexOf('snack') >= 0) return 'colacion';
    return 'comida';
  }

  /* Nombre de platillo a partir de los alimentos de una comida del plan. */
  function platilloDe(comida, momento) {
    if (comida && comida.platillo) return String(comida.platillo);
    var nombres = [], al = lista(comida && comida.alimentos);
    for (var i = 0; i < al.length && nombres.length < 3; i++) {
      var a = (AG.Data && typeof AG.Data.alimento === 'function') ? AG.Data.alimento(al[i] && al[i].alimentoId) : null;
      if (a && a.nombre) nombres.push(i === 0 ? a.nombre : String(a.nombre).toLowerCase());
    }
    if (!nombres.length) return PLATILLO_BASE[momento] || PLATILLO_BASE.comida;
    return nombres[0] + (nombres.length > 1 ? ' con ' + nombres.slice(1).join(' y ') : '');
  }

  function proximaComida(comidas) {
    var ahora = minutosAhora(), con = [], i;
    for (i = 0; i < comidas.length; i++) {
      var m = minutosDe(comidas[i].hora);
      if (m !== null) con.push({ c: comidas[i], m: m });
    }
    con.sort(function (a, b) { return a.m - b.m; });
    for (i = 0; i < con.length; i++) if (con[i].m >= ahora) return { comida: con[i].c, manana: false };
    if (con.length) return { comida: con[0].c, manana: true };
    return comidas.length ? { comida: comidas[0], manana: false } : null;
  }

  function sustitutoPara(momento) {
    if (!MOMENTO_SUSTITUTO[momento]) return null;
    var productos = [];
    if (hayFn('Nutricion', 'productosQueSustituyen')) {
      productos = seguro(function () { return AG.Mod.Nutricion.productosQueSustituyen(momento); }, []);
    } else {
      productos = AG.DB.donde('productos', function (p) {
        return p.disponible !== false && lista(p.sustituye).indexOf(momento) >= 0;
      });
    }
    return lista(productos)[0] || null;
  }

  /* { kcal, comida:{momento, hora, platillo, sustituto}, manana } o null. */
  function comidaDeHoy(socio, d) {
    var comidas = [], kcal = null, i, c;

    var rec = hayFn('Nutricion', 'recomendacionDelDia')
      ? seguro(function () { return AG.Mod.Nutricion.recomendacionDelDia(socio, U.hoy()); }, null)
      : null;

    if (rec && lista(rec.comidas).length) {
      for (i = 0; i < rec.comidas.length; i++) {
        c = rec.comidas[i] || {};
        comidas.push({ momento: c.momento || 'comida', hora: c.hora || '', platillo: c.platillo || '', kcal: n0(c.kcal) || 0, sustituto: c.sustituto || null });
      }
      kcal = n0(rec.kcal) || U.suma(comidas, 'kcal');
    } else {
      var plan = AG.DB.planNutricionDe(socio.id);
      if (plan) {
        kcal = n0(plan.kcal);
        var lc = lista(plan.comidas);
        for (i = 0; i < lc.length; i++) {
          c = lc[i] || {};
          var mom = momentoDe(c.nombre);
          comidas.push({ momento: mom, hora: c.hora || '', platillo: platilloDe(c, mom), kcal: 0, sustituto: undefined });
        }
        if (!kcal) kcal = Calc.macros(0).kcal || null;
      } else if (d.peso && d.estatura) {
        var perfil = seguro(function () {
          return Calc.perfilNutricional({
            pesoKg: d.peso, estaturaCm: d.estatura, edad: U.edad(socio.fechaNacimiento), sexo: socio.sexo,
            nivelActividad: socio.nivelActividad, objetivo: socio.objetivo, numComidas: 4
          });
        }, null);
        if (!perfil || !perfil.kcal) return null;
        kcal = perfil.kcal;
        for (i = 0; i < perfil.comidas.length; i++) {
          c = perfil.comidas[i];
          var mm = momentoDe(c.nombre);
          comidas.push({ momento: mm, hora: c.hora || '', platillo: PLATILLO_BASE[mm] || PLATILLO_BASE.comida, kcal: n0(c.kcal) || 0, sustituto: undefined });
        }
      } else {
        return null;
      }
    }

    var prox = proximaComida(comidas);
    if (!prox) return { kcal: kcal, comida: null, manana: false };
    var comida = prox.comida;
    if (comida.sustituto === undefined) comida.sustituto = sustitutoPara(comida.momento);
    if (!comida.platillo) comida.platillo = PLATILLO_BASE[comida.momento] || PLATILLO_BASE.comida;
    return { kcal: kcal, comida: comida, manana: prox.manana };
  }

  /* =============================================================
     5. Piezas del panel
     ============================================================= */

  /* --- 5.1 Saludo --- */
  function saludoHTML(socio, d) {
    var p = U.partesDe(U.hoy());
    var dow = new Date(p.a, p.m - 1, p.d).getDay();
    var fecha = 'Hoy es ' + U.DIAS_SEMANA[dow].toLowerCase() + ' ' + p.d + ' de ' + U.MESES[p.m - 1].toLowerCase();

    var sub = '';
    if (d.racha > 0) sub = 'Llevas ' + (d.racha === 1 ? '1 día seguido' : d.racha + ' días seguidos') + ' 🔥';
    else if (!d.extranamos) sub = 'Nueva racha desde hoy ✨';

    return '<div class="saludo">' +
      '<div class="saludo-hola">Hola, <span class="saludo-nombre">' + esc(primerNombre(socio)) + '</span><span class="saludo-emoji">👋</span></div>' +
      '<div class="saludo-fecha">' + esc(fecha) + '</div>' +
      (sub ? '<div class="saludo-sub">' + esc(sub) + '</div>' : '') +
    '</div>';
  }

  /* --- 5.2 Franja de ánimo (solo si lleva días sin venir) --- */
  function animoHTML(d) {
    if (!d.extranamos) return '';
    return '<div class="animo"><span class="animo-icono">💪</span>' +
      '<div class="animo-txt"><b>Te extrañamos.</b><span>Hoy es un buen día para volver 💪</span></div></div>';
  }

  /* --- 5.3 Constancia semanal amable --- */
  function semanaHTML(d) {
    var s = d.semana;
    return '<div class="si-semana">Esta semana llevas <b>' + s.hechas + ' de ' + s.meta + '</b>' +
      '<div class="bar bar-fina"><div class="bar-fill" style="width:' + s.pct + '%"></div></div></div>';
  }

  function notaMembresia(d) {
    var est = d.estado;
    if (!est || est.estado !== 'por_vencer') return '';
    return '<p class="hoy-nota">' + esc(est.texto) + ' · <a href="#/socio/membresia">Renovar</a></p>';
  }

  /* --- 5.4 Tarjeta HOY (una sola acción) --- */
  function hoyHTML(socio, d) {
    var est = d.estado;

    /* Membresía vencida: la tarjeta se vuelve el aviso de renovar. */
    if (est && est.estado === 'vencido') {
      return '<section class="hoy alerta">' +
        '<span class="hoy-eyebrow">Tu membresía</span>' +
        '<h2 class="hoy-titulo">Renueva para seguir entrenando</h2>' +
        '<p class="hoy-sub">' + esc(est.vence ? 'Venció el ' + U.fecha(est.vence, 'corto') + '.' : 'Ya venció.') + ' En recepción te ayudan en un minuto.</p>' +
        '<div class="hoy-accion">' + botonRuta('socio/membresia', 'Ver mi membresía', 'btn-primary', 'tarjeta') + '</div>' +
      '</section>';
    }

    /* Ya entrenó hoy. */
    if (d.hecha) {
      var b = d.hoyBitacora;
      var ejercicios = lista(b.ejercicios);
      var primer = ejercicios.length && ejercicios[0] ? ejercicios[0].ejercicioId : null;
      if (!primer && d.toca && d.toca.dia) primer = (lista(d.toca.dia.ejercicios)[0] || {}).ejercicioId;
      var volumen = Calc.volumenEntrenamiento(b);
      var dur = nPos(b.duracionMin);
      var meta = '';
      if (b.nombre) meta += '<span>' + icono('rayo') + '<b>' + esc(b.nombre) + '</b></span>';
      else meta += '<span>' + icono('mancuerna') + '<b>' + ejercicios.length + '</b> ' + (ejercicios.length === 1 ? 'ejercicio' : 'ejercicios') + '</span>';
      if (dur) meta += '<span>' + icono('reloj') + '<b>' + esc(U.num(dur, 0)) + '</b> min</span>';
      if (volumen > 0) meta += '<span>' + icono('pesa') + '<b>' + esc(U.num(volumen, 0)) + '</b> kg movidos</span>';

      return '<section class="hoy">' +
        '<span class="hoy-eyebrow">Hoy ya entrenaste</span>' +
        '<h2 class="hoy-titulo">¡Bien hecho, ' + esc(primerNombre(socio)) + '! 🎉</h2>' +
        '<div class="hoy-meta">' + meta + '</div>' +
        semanaHTML(d) +
        '<div class="hoy-accion">' + botonRuta('socio/rutina', 'Ver mi sesión', 'btn-primary', 'ojo') + '</div>' +
        notaMembresia(d) +
        '<div class="hoy-ilustra">' + (primer ? ilustra(primer, { alto: 170, animado: true }) : ilustraPatron('movilidad', { alto: 170, animado: true })) + '</div>' +
      '</section>';
    }

    /* Sin rutina. */
    if (!d.rutina || !d.toca) {
      var coach = d.coach;
      var wa = coach ? enlaceWhatsApp(coach.telefono, 'Hola ' + U.nombreCompleto(coach) + ', soy ' + U.nombreCompleto(socio) + ' de ' + nombreGym() + ' y quiero pedirte mi rutina.') : '';
      return '<section class="hoy">' +
        '<span class="hoy-eyebrow">Tu rutina</span>' +
        '<h2 class="hoy-titulo">' + (coach ? 'Pide tu rutina a ' + esc(primerNombre(coach)) : 'Pide tu rutina en recepción') + '</h2>' +
        '<p class="hoy-sub">' + (coach ? 'En cuanto la cargue, aquí verás qué te toca cada día.' : 'Te asignan entrenador y arman tu plan.') + '</p>' +
        '<div class="hoy-accion">' +
          (wa ? '<a class="btn btn-primary" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + icono('whatsapp', 18) + 'Pedir por WhatsApp</a>'
              : botonRuta('socio/perfil', 'Ver mi perfil', 'btn-primary', 'usuario')) +
        '</div>' +
        '<div class="hoy-ilustra">' + ilustraPatron('sentadilla', { alto: 170, animado: true }) + '</div>' +
      '</section>';
    }

    var toca = d.toca;

    /* Día de descanso activo. */
    if (!toca.hoy) {
      var prox = toca.dia || {};
      return '<section class="hoy descanso">' +
        '<span class="hoy-eyebrow">Hoy toca descanso activo</span>' +
        '<h2 class="hoy-titulo">Hoy descansas</h2>' +
        '<p class="hoy-sub">Hoy el músculo se repara y mañana rindes más.</p>' +
        '<div class="hoy-meta"><span>' + icono('calendario') + 'Vuelves el <b>' + esc(U.DIAS_SEMANA[toca.dow].toLowerCase()) + '</b></span>' +
          '<span><b>' + esc(prox.enfoque || prox.nombre || 'Entrenamiento') + '</b></span></div>' +
        '<div class="descanso-opciones">' +
          opcionLigeraHTML('cardio') + opcionLigeraHTML('movilidad') +
        '</div>' +
        '<p class="hoy-nota">Si prefieres descansar por completo, también está bien.</p>' +
        '<div class="hoy-accion"><button type="button" class="btn btn-outline" data-si-semana>' + icono('calendario', 18) + 'Ver mi semana</button></div>' +
        notaMembresia(d) +
      '</section>';
    }

    /* Hoy toca entrenar. */
    var dia = toca.dia || {};
    var st = statsDia(dia);
    var primero = (lista(dia.ejercicios)[0] || {}).ejercicioId;
    var enCurso = !!d.hoyBitacora;
    var textoBtn = d.extranamos ? 'Empezar con 20 minutos' : (enCurso ? 'Continuar entrenamiento' : 'Empezar entrenamiento');

    return '<section class="hoy">' +
      '<span class="hoy-eyebrow">Hoy te toca</span>' +
      '<h2 class="hoy-titulo">' + esc(dia.enfoque || dia.nombre || 'Entrenamiento') + '</h2>' +
      (d.extranamos ? '<p class="hoy-sub">Empieza con 20 minutos y ve cómo te sientes.</p>' : '') +
      '<div class="hoy-meta">' +
        '<span>' + icono('mancuerna') + '<b>' + st.ejercicios + '</b> ' + (st.ejercicios === 1 ? 'ejercicio' : 'ejercicios') + '</span>' +
        '<span>' + icono('pesa') + '<b>' + st.series + '</b> series</span>' +
        '<span>' + icono('reloj') + '~<b>' + st.minutos + '</b> min</span>' +
      '</div>' +
      semanaHTML(d) +
      '<div class="hoy-accion">' + botonRuta('socio/rutina', textoBtn, 'btn-primary', 'rayo') + '</div>' +
      notaMembresia(d) +
      '<div class="hoy-ilustra">' + (primero ? ilustra(primero, { alto: 170, animado: true }) : ilustraPatron('sentadilla', { alto: 170, animado: true })) + '</div>' +
    '</section>';
  }

  function opcionLigeraHTML(clave) {
    var o = LIGERAS[clave];
    return '<button type="button" class="descanso-opcion" data-si-ligera="' + clave + '">' +
      ilustraPatron(o.patron, { alto: 120, animado: true }) +
      '<b>' + esc(o.nombre) + '</b><span>' + o.minutos + ' min</span>' +
      '<span class="btn btn-primary btn-sm">Registrar</span>' +
    '</button>';
  }

  /* --- 5.5 Tiles --- */
  function tileHTML(path, clase, nombreIcono, valor, unidad, etiqueta, spark, extra) {
    return '<a class="tile' + (clase ? ' ' + clase : '') + '" href="#/' + esc(path) + '">' +
      '<span class="tile-icono">' + icono(nombreIcono, 18) + '</span>' +
      '<span class="tile-datos">' +
        '<span class="tile-val">' + esc(valor) + (unidad ? '<small>' + esc(unidad) + '</small>' : '') + '</span>' +
        '<span class="tile-label">' + esc(etiqueta) + '</span>' +
        (extra ? '<span class="tile-extra">' + esc(extra) + '</span>' : '') +
      '</span>' + (spark || '') +
    '</a>';
  }

  function tilesHTML(socio, d) {
    var peso = serieDe(d.mediciones, 'pesoKg', 8);
    var grasa = serieDe(d.mediciones, 'grasaPct', 8);
    var ultPeso = peso.length ? peso[peso.length - 1].y : null;
    var ultGrasa = grasa.length ? grasa[grasa.length - 1].y : null;

    var conteo = {}, i;
    for (i = 0; i < d.asistencias.length; i++) {
      var mes = texto(d.asistencias[i].fecha).slice(0, 7);
      if (mes) conteo[mes] = (conteo[mes] || 0) + 1;
    }
    var meses = [];
    for (i = 5; i >= 0; i--) meses.push(conteo[U.mesDe(U.sumaMeses(U.hoy(), -i))] || 0);
    var visitas = conteo[d.periodo] || 0;

    var est = d.estado, dias = Math.max(0, entero(est.diasRestantes, 0));
    var claseMem = est.estado === 'activo' ? 'ok' : (est.estado === 'por_vencer' ? 'warn' : 'neutro');
    var etiquetaMem = est.estado === 'vencido' ? 'renueva tu membresía' : (est.estado === 'congelado' ? 'membresía congelada' : 'días de membresía');

    return '<div class="tiles">' +
      tileHTML('socio/progreso', 'info', 'balanza', ultPeso !== null ? U.num(ultPeso, 1) : '—', ultPeso !== null ? 'kg' : '', 'peso actual',
        chispa(soloValores(peso), 'var(--info)'), peso.length > 1 ? U.signo(ultPeso - peso[0].y, 1, 'kg') : '') +
      tileHTML('socio/progreso', 'warn', 'gota', ultGrasa !== null ? U.num(ultGrasa, 1) : '—', ultGrasa !== null ? '%' : '', 'grasa corporal',
        chispa(soloValores(grasa), 'var(--warn)'), grasa.length > 1 ? U.signo(ultGrasa - grasa[0].y, 1, 'pts') : '') +
      tileHTML('socio/rutina', 'ok', 'calendario', String(visitas), '', 'visitas este mes',
        chispa(meses, 'var(--ok)'), '') +
      tileHTML('socio/membresia', claseMem, 'tarjeta', est.estado === 'congelado' ? '—' : String(dias), '', etiquetaMem,
        '', est.vence && est.estado !== 'vencido' ? 'Vence ' + U.fecha(est.vence, 'diaMes') : '') +
    '</div>';
  }

  /* --- 5.6 Tres tarjetas compactas --- */
  function tarjeta(nombreIcono, titulo, cuerpo, boton) {
    return '<div class="card"><div class="card-body">' +
      '<div class="si-cab">' + icono(nombreIcono) + '<span>' + esc(titulo) + '</span></div>' +
      cuerpo + boton +
    '</div></div>';
  }

  function comidaHTML(socio, d) {
    var nut = seguro(function () { return comidaDeHoy(socio, d); }, null);
    var boton = botonRuta('socio/nutricion', 'Ver mi día completo', 'btn-outline btn-sm btn-block', 'nutricion');

    if (!nut || !nut.kcal) {
      return tarjeta('nutricion', 'Tu comida de hoy',
        '<div class="si-espera">' + icono('manzana', 28) + '<div>Falta tu peso<span>Con tu medición armamos tu día.</span></div></div>',
        botonRuta('socio/calculadora', 'Abrir calculadora', 'btn-outline btn-sm btn-block', 'calculadora'));
    }

    var cuerpo = '<div class="si-num">' + esc(U.num(nut.kcal, 0)) + '<small>kcal</small></div>';
    var c = nut.comida;
    if (c) {
      cuerpo += '<div class="si-prox"><span>' + esc(MOMENTO_NOMBRE[c.momento] || 'Comida') +
        (c.hora ? ' · ' + esc(c.hora) : '') + (nut.manana ? ' · mañana' : '') + '</span>' + esc(c.platillo) + '</div>';
      var p = c.sustituto;
      if (p && p.nombre) {
        cuerpo += '<div class="sustituto"><span class="sustituto-icono">' + icono(p.icono || 'gota') + '</span>' +
          '<span class="sustituto-txt"><b>' + esc(p.nombre) + '</b><span>' + esc(MOMENTO_SUSTITUTO[c.momento] || 'en recepción') + '</span></span>' +
          (n0(p.precio) !== null ? '<span class="sustituto-precio">' + esc(U.dinero(p.precio, 0)) + '</span>' : '') +
        '</div>';
      }
    }
    return tarjeta('nutricion', 'Tu comida de hoy', cuerpo, boton);
  }

  function progresoHTML(socio, d) {
    var boton = botonRuta('socio/progreso', 'Ver detalle', 'btn-outline btn-sm btn-block', 'grafica');
    var ini = d.medicionInicial, fin = d.medicionFinal;

    if (ini && fin) {
      var cmp = seguro(function () { return Calc.compararMediciones(ini, fin, socio.objetivo); }, null);
      if (cmp && cmp.ok && cmp.resumen) {
        var r = cmp.resumen;
        var anillo = seguro(function () {
          return Charts.progreso(r.puntaje, { alto: 84, grosor: 9, texto: String(r.puntaje), aria: 'Puntaje del mes: ' + r.puntaje + ' de 100' });
        }, '');
        return tarjeta('grafica', 'Tu progreso',
          '<div class="si-anillo"><div>' + anillo + '</div><div class="si-prox"><span>' + esc(U.nombreMes(d.periodo)) + '</span>' +
            esc(Calc.textoNivel(r.nivel)) + '</div></div>', boton);
      }
    }

    var sub = ini ? 'Al cerrar ' + U.nombreMes(d.periodo).toLowerCase() + ' verás tu puntaje.' : 'Pídele tu medición de ' + U.nombreMes(d.periodo).toLowerCase() + '.';
    return tarjeta('grafica', 'Tu progreso',
      '<div class="si-espera">' + icono('regla', 28) + '<div>Tu coach te mide pronto<span>' + esc(sub) + '</span></div></div>', boton);
  }

  function entrenadorHTML(socio, usuario, d) {
    var prox = hayFn('Sesiones', 'proximaDe')
      ? seguro(function () { return AG.Mod.Sesiones.proximaDe(usuario); }, null)
      : null;
    var s = prox && prox.sesion ? prox.sesion : null;

    if (s) {
      var coach = s.coachId ? AG.DB.usuario(s.coachId) : d.coach;
      var cuando = typeof prox.cuando === 'string' && prox.cuando ? prox.cuando : U.fechaRelativa(s.fecha);
      return tarjeta('coach', 'Tu entrenador',
        '<div class="persona">' + (coach ? U.avatar(coach) : '') + '<div class="persona-txt">' +
          '<b>' + esc(U.fecha(s.fecha, 'diaMes')) + (s.hora ? ' · ' + esc(s.hora) : '') + '</b>' +
          '<span>' + esc((coach ? 'Con ' + primerNombre(coach) + ' · ' : '') + cuando) + '</span></div></div>',
        botonRuta('socio/entrenador', 'Ver mi sesión', 'btn-outline btn-sm btn-block', 'calendario'));
    }

    return tarjeta('coach', 'Tu entrenador',
      '<div class="si-espera">' + icono('calendario', 28) + '<div>Sin sesión esta semana<span>Tienes una a la semana con tu entrenador.</span></div></div>',
      '<button type="button" class="btn btn-primary btn-sm btn-block" data-si-agendar>' + icono('mas') + 'Agendar mi sesión</button>');
  }

  /* --- 5.7 Desplegables (cerrados; el cuerpo se llena al abrir) --- */
  function desplegableHTML(clave, nombreIcono, titulo, badge) {
    return '<details class="desplegable" data-si-lazy="' + clave + '">' +
      '<summary class="desplegable-cab">' + icono(nombreIcono, 18) +
        '<span class="desplegable-titulo">' + esc(titulo) + '</span>' +
        (badge ? '<span class="badge badge-rojo">' + esc(badge) + '</span>' : '') +
      '</summary>' +
      '<div class="desplegable-cuerpo"></div>' +
    '</details>';
  }

  function desplegablesHTML(socio, usuario, d) {
    var avisos = hayFn('Avisos', 'paraUsuario') ? seguro(function () { return AG.Mod.Avisos.paraUsuario(usuario); }, []) : [];
    var sinLeer = 0;
    for (var i = 0; i < avisos.length; i++) if (!avisos[i].leido) sinLeer++;
    var eventos = seguro(function () { return AG.DB.eventosProximos(2); }, []);

    return '<div class="desplegables">' +
      desplegableHTML('avisos', 'campana', 'Avisos del gimnasio' + (avisos.length ? ' (' + avisos.length + ')' : ''), sinLeer ? sinLeer + (sinLeer === 1 ? ' nuevo' : ' nuevos') : '') +
      desplegableHTML('coach', 'coach', 'Mi coach', '') +
      desplegableHTML('eventos', 'trofeo', 'Eventos próximos', eventos.length ? String(eventos.length) : '') +
      desplegableHTML('resumen', 'historial', 'Todo mi resumen', '') +
    '</div>';
  }

  function vacioAmable(emoji, frase, sub) {
    return '<div class="vacio-amable"><span class="vacio-amable-icono">' + emoji + '</span><b>' + esc(frase) + '</b>' +
      (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }

  function cuerpoAvisos(usuario) {
    if (!hayFn('Avisos', 'tarjetas')) return vacioAmable('📣', 'Sin avisos por ahora', 'Aquí verás las novedades del gimnasio.');
    return seguro(function () { return AG.Mod.Avisos.tarjetas(usuario, 3); }, vacioAmable('📣', 'Sin avisos por ahora', ''));
  }

  function cuerpoCoach(socio) {
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    if (!coach) return vacioAmable('🧑‍🏫', 'Aún no tienes coach', 'Pasa a recepción y te asignan uno.');

    var estrellas = hayFn('Calificaciones', 'resumen')
      ? seguro(function () { return AG.Mod.Calificaciones.resumen('coach', coach.id); }, '')
      : '';
    var wa = enlaceWhatsApp(coach.telefono, 'Hola ' + U.nombreCompleto(coach) + ', soy ' + U.nombreCompleto(socio) + ' de ' + nombreGym() + '.');

    return '<div class="persona">' + U.avatar(coach, 'lg') + '<div class="persona-txt">' +
        '<b>' + esc(U.nombreCompleto(coach)) + '</b><span>' + esc(coach.especialidad || 'Entrenador personal') + '</span></div></div>' +
      (estrellas ? '<div class="mt-sm">' + estrellas + '</div>' : '') +
      (coach.horario ? '<div class="chips mt-sm"><span class="pill">' + icono('reloj', 13) + esc(coach.horario) + '</span></div>' : '') +
      '<div class="row row-sm wrap mt">' +
        (wa ? '<a class="btn btn-primary btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + icono('whatsapp', 15) + 'WhatsApp</a>' : '') +
        '<button type="button" class="btn btn-outline btn-sm" data-si-calificar="' + esc(coach.id) + '">' + icono('estrella', 15) + 'Calificar</button>' +
      '</div>';
  }

  function cuerpoEventos(usuario) {
    if (hayFn('Eventos', 'tarjetas')) {
      var html = seguro(function () { return AG.Mod.Eventos.tarjetas(usuario, 2); }, '');
      if (html) return html;
    }
    var eventos = seguro(function () { return AG.DB.eventosProximos(2); }, []);
    if (!eventos.length) return vacioAmable('🎉', 'Pronto habrá eventos', 'Retos, clínicas y convivencias.');

    var salida = '<div class="stack-sm">';
    for (var i = 0; i < eventos.length; i++) {
      var e = eventos[i];
      salida += '<div class="evento evento-fila"><div class="evento-fecha"><span class="evento-mes">' + esc(U.fecha(e.fecha, 'diaMes').split(' ')[1] || '') + '</span>' +
        '<b class="evento-dia">' + esc(U.fecha(e.fecha, 'diaMes').split(' ')[0] || '') + '</b></div>' +
        '<div class="evento-info"><b class="evento-nombre">' + esc(e.nombre) + '</b><div class="evento-meta">' +
          (e.hora ? '<span>' + icono('reloj', 14) + esc(e.hora) + '</span>' : '') +
          (e.lugar ? '<span>' + icono('ubicacion', 14) + esc(e.lugar) + '</span>' : '') +
        '</div></div></div>';
    }
    return salida + '</div><div class="mt-sm">' + botonRuta('socio/entrenador', 'Ver todos', 'btn-ghost btn-sm', 'flecha-der') + '</div>';
  }

  function dato(etiqueta, valor, detalle) {
    return '<div class="dato"><span class="dato-label">' + esc(etiqueta) + '</span><span class="dato-val">' + esc(valor) + '</span>' +
      (detalle ? '<span class="mini muted">' + esc(detalle) + '</span>' : '') + '</div>';
  }

  function cuerpoResumen(socio) {
    var d = reunirDatos(socio);
    var imc = d.peso && d.estatura ? Calc.imc(d.peso, d.estatura) : null;
    var diasPorSemana = d.rutina ? (nPos(d.rutina.diasPorSemana) || 3) : 3;
    var mes = Calc.adherencia(d.bitacoras, d.periodo + '-01', U.hoy(), diasPorSemana);
    var invertido = 0;
    for (var i = 0; i < d.pagos.length; i++) if (!d.pagos[i].estado || d.pagos[i].estado === 'pagado') invertido += n0(d.pagos[i].monto) || 0;
    var agua = d.peso ? Calc.aguaDiaria(d.peso, socio.nivelActividad) : null;

    return '<div class="datos-grid">' +
      dato('IMC', imc !== null ? U.num(imc, 1) : '—', imc !== null ? Calc.clasificacionIMC(imc).texto : 'Falta peso o estatura') +
      dato('Constancia del mes', mes.hechas + ' de ' + mes.esperadas, 'sesiones') +
      dato('Antigüedad', Calc.antiguedadTexto(socio.fechaAlta), socio.fechaAlta ? 'Desde el ' + U.fecha(socio.fechaAlta, 'corto') : '') +
      dato('Total invertido', U.dinero(invertido, 0), Calc.mesesDeMembresia(socio, d.pagos) + ' meses pagados') +
      dato('Plan', d.plan ? d.plan.nombre : 'Sin plan', d.plan ? U.dinero(d.plan.precio, 0) + (d.plan.meses > 1 ? ' cada ' + d.plan.meses + ' meses' : ' al mes') : '') +
      dato('Vence', d.estado.vence ? U.fecha(d.estado.vence, 'corto') : '—', d.estado.texto) +
      dato('Objetivo', (Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[socio.objetivo]) || 'Salud general', socio.nivel ? U.capitalizar(socio.nivel) : '') +
      dato('Agua al día', agua !== null ? U.num(agua, 1) + ' L' : '—', 'recomendada') +
    '</div>';
  }

  function cuerpoDesplegable(clave, socio, usuario) {
    if (clave === 'avisos') return cuerpoAvisos(usuario);
    if (clave === 'coach') return cuerpoCoach(socio);
    if (clave === 'eventos') return cuerpoEventos(usuario);
    if (clave === 'resumen') return cuerpoResumen(socio);
    return '';
  }

  /* =============================================================
     6. Bienvenida de primera vez (tres preguntas)
     ============================================================= */

  function respuestasIniciales(socio) {
    var desayuno = null;
    if (socio.desayunaAntes === true) desayuno = socio.desayunoVariable ? 'aveces' : 'si';
    else if (socio.desayunaAntes === false) desayuno = 'no';
    return {
      horario: socio.horarioEntreno || null,
      dias: entero(socio.diasMeta, 0) >= 2 ? String(entero(socio.diasMeta, 3)) : null,
      desayuno: desayuno
    };
  }

  function pasoHTML() {
    var i = bienvenida.paso, q = PREGUNTAS[i], actual = bienvenida.r[q.clave];
    var barras = '';
    for (var k = 0; k < PREGUNTAS.length; k++) barras += '<i class="' + (k < i ? 'hecho' : (k === i ? 'on' : '')) + '"></i>';

    var cards = '';
    for (var j = 0; j < q.opciones.length; j++) {
      var o = q.opciones[j], on = actual === o.v;
      cards += '<label class="radio-card' + (on ? ' on' : '') + '">' +
        '<input type="radio" name="si_' + q.clave + '" value="' + esc(o.v) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="radio-emoji">' + o.e + '</span><b>' + esc(o.t) + '</b><span>' + esc(o.s) + '</span></label>';
    }

    return '<div class="bienvenida-paso">' + barras + '<span>' + (i + 1) + ' de ' + PREGUNTAS.length + '</span></div>' +
      '<h2 class="bienvenida-pregunta">' + esc(q.titulo) + '</h2>' +
      '<div class="bienvenida-cuerpo"><div class="radio-cards grandes">' + cards + '</div></div>' +
      '<div class="bienvenida-acciones">' +
        (i > 0 ? '<button type="button" class="btn btn-ghost" data-si-atras>' + icono('flecha-izq') + 'Atrás</button>' : '') +
        '<button type="button" class="btn btn-primary" data-si-siguiente>' +
          (i === PREGUNTAS.length - 1 ? 'Listo' : 'Siguiente') + icono('flecha-der') + '</button>' +
      '</div>';
  }

  function bienvenidaHTML(socio) {
    bienvenida = { paso: 0, r: respuestasIniciales(socio) };
    return '<div class="page" data-socio-inicio><div class="bienvenida-pantalla"><div class="bienvenida">' +
      U.avatar(socio, 'xl') +
      '<h2>¡Hola, ' + esc(primerNombre(socio)) + '! 👋</h2>' +
      '<p class="bienvenida-sub">Tres preguntas rápidas y te acomodo el día.</p>' +
      '<div data-si-paso>' + pasoHTML() + '</div>' +
    '</div></div></div>';
  }

  function guardarBienvenida(socio) {
    var r = bienvenida.r;
    var cambios = {
      horarioEntreno: r.horario || 'variable',
      diasMeta: Math.max(2, Math.min(6, entero(r.dias, 3))),
      desayunaAntes: r.desayuno !== 'no',
      desayunoVariable: r.desayuno === 'aveces',
      bienvenidaHecha: true
    };
    if (!AG.DB.actualizar('usuarios', socio.id, cambios)) {
      U.toast('No pudimos guardar tus respuestas. Intenta de nuevo.', 'error');
      return;
    }
    bienvenida = null;
    U.toast('¡Listo, ' + primerNombre(socio) + '! Ya te acomodé el día.', 'ok');
    AG.Router.refrescar();
  }

  function engancharBienvenida(raiz, socio) {
    function leerPaso() {
      var q = PREGUNTAS[bienvenida.paso];
      var marcado = raiz.querySelector('input[name="si_' + q.clave + '"]:checked');
      if (!marcado) return false;
      bienvenida.r[q.clave] = marcado.value;
      return true;
    }
    function repintar() {
      var caja = raiz.querySelector('[data-si-paso]');
      if (caja) caja.innerHTML = pasoHTML();
    }

    U.delegar(raiz, 'change', '.radio-card input', function (e, el) {
      var tarjetas = U.$$('.radio-card', el.closest('.radio-cards'));
      for (var i = 0; i < tarjetas.length; i++) tarjetas[i].classList.toggle('on', tarjetas[i].contains(el));
    });

    U.delegar(raiz, 'click', '[data-si-siguiente]', function (e) {
      e.preventDefault();
      if (!bienvenida) return;
      if (!leerPaso()) { U.toast('Elige una opción para seguir.', 'info'); return; }
      if (bienvenida.paso >= PREGUNTAS.length - 1) { guardarBienvenida(socio); return; }
      bienvenida.paso++;
      repintar();
    });

    U.delegar(raiz, 'click', '[data-si-atras]', function (e) {
      e.preventDefault();
      if (!bienvenida || bienvenida.paso === 0) return;
      leerPaso();
      bienvenida.paso--;
      repintar();
    });
  }

  /* =============================================================
     7. Modales: mi semana y sesión ligera
     ============================================================= */

  function abrirSemana(socio) {
    var activa = AG.DB.rutinaActivaDe(socio.id);
    var toca = activa && activa.rutina ? diaQueToca(activa.rutina) : null;
    if (!toca) { U.toast('Todavía no tienes una rutina con días cargados.', 'info'); return; }

    var porDow = {}, i;
    for (i = 0; i < toca.semana.length; i++) porDow[toca.semana[i].dow] = toca.semana[i].indice;

    var hoyDow = new Date().getDay();
    var lunes = AG.DB.lunesDe(U.hoy());
    var orden = [1, 2, 3, 4, 5, 6, 0];
    var chips = '', filas = '';

    for (i = 0; i < orden.length; i++) {
      var dow = orden[i], idx = porDow[dow], esHoy = dow === hoyDow;
      var fecha = U.partesDe(U.sumaDias(lunes, i));
      chips += '<span class="chip-dia' + (idx !== undefined ? ' on' : '') + (esHoy ? ' es-hoy' : '') + '"><b>' + (fecha ? fecha.d : '') + '</b><span>' +
        esc(U.DIAS_SEMANA_CORTOS[dow]) + '</span></span>';
      if (idx === undefined) continue;
      var dia = toca.dias[idx] || {}, st = statsDia(dia);
      filas += '<div class="si-dia' + (esHoy ? ' es-hoy' : '') + '"><b>' + esc(U.DIAS_SEMANA_CORTOS[dow]) + '</b>' +
        '<span class="flex1">' + esc(dia.enfoque || dia.nombre || ('Día ' + (idx + 1))) + '</span>' +
        '<span class="mini muted nowrap">' + st.ejercicios + ' ej · ~' + st.minutos + ' min</span></div>';
    }

    U.modal({
      titulo: 'Mi semana',
      cuerpo: '<div class="chip-dias">' + chips + '</div><div class="stack-sm mt">' + filas + '</div>' +
        '<p class="mini muted mt">Los días sin marcar son de descanso activo.</p>',
      acciones: [
        { texto: 'Cerrar', clase: 'btn-ghost' },
        { texto: 'Ir a mi rutina', clase: 'btn-primary', onClick: function (api) { api.cerrar(); AG.Router.ir('socio/rutina'); } }
      ]
    });
  }

  /* Registra una sesión ligera (cardio o movilidad) como cualquier entrenamiento. */
  function registrarLigera(socio, clave) {
    var o = LIGERAS[clave] || LIGERAS.cardio;
    var hoy = U.hoy();
    var previa = bitacoraDeHoy(AG.DB.bitacorasDe(socio.id));
    if (previa && (previa.completada === true || tieneSeriesHechas(previa))) {
      U.toast('Hoy ya registraste tu sesión. ¡Descansa con gusto!', 'info');
      return;
    }

    U.modal({
      titulo: o.nombre,
      cuerpo: '<div class="si-lig"><div>' + ilustraPatron(o.patron, { alto: 110, animado: true }) + '</div>' +
        '<div class="flex1"><label class="field"><span class="label">Minutos</span>' +
        '<input class="input" type="number" name="minutos" value="' + o.minutos + '" min="5" max="120" step="5" autofocus></label>' +
        '<label class="field mt-sm"><span class="label">Una nota (opcional)</span>' +
        '<input class="input" type="text" name="notas" maxlength="120" placeholder="Me sentí bien"></label></div></div>',
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: 'Guardar sesión', clase: 'btn-primary',
          onClick: function (api) {
            var minutos = entero((api.root.querySelector('[name="minutos"]') || {}).value, o.minutos);
            if (minutos < 5 || minutos > 120) { U.toast('Pon entre 5 y 120 minutos.', 'warn'); return false; }
            var notas = texto((api.root.querySelector('[name="notas"]') || {}).value).trim();
            var activa = AG.DB.rutinaActivaDe(socio.id);
            var guardada = AG.DB.insertar('bitacoras', {
              socioId: socio.id, fecha: hoy, rutinaId: activa && activa.rutina ? activa.rutina.id : null, diaIndex: null,
              tipo: 'ligera', nombre: o.nombre, ejercicios: [], duracionMin: minutos, esfuerzo: o.esfuerzo, notas: notas, completada: true
            });
            if (!guardada) { U.toast('No se pudo guardar la sesión.', 'error'); return false; }
            var yaVino = AG.DB.donde('asistencias', function (a) { return a.socioId === socio.id && texto(a.fecha).slice(0, 10) === hoy; }).length;
            if (!yaVino && hayFn('Asistencia', 'checkIn')) {
              seguro(function () { return AG.Mod.Asistencia.checkIn(socio.id, { silencioso: true }); }, null);
            }
            api.cerrar();
            U.toast('¡Sesión ligera registrada! 💪', 'ok');
            AG.Router.refrescar();
          }
        }
      ]
    });
  }

  /* =============================================================
     8. Vista y eventos
     ============================================================= */

  function pantallaAviso(mensaje) {
    return '<div class="page"><div class="card"><div class="card-body">' +
      vacioAmable('🙂', mensaje, '') + '</div></div></div>';
  }

  function render(ctx) {
    asegurarEstilos();

    var usuario = ctx && ctx.usuario ? ctx.usuario : null;
    if (!usuario) return pantallaAviso('Vuelve a iniciar sesión para ver tu panel.');
    if (usuario.rol !== 'socio') return pantallaAviso('Este panel es solo para socios.');

    var socio = AG.DB.usuario(usuario.id) || usuario;

    if (socio.bienvenidaHecha !== true) {
      return { html: bienvenidaHTML(socio), listo: function (root) {
        var raiz = root && root.querySelector ? root.querySelector('[data-socio-inicio]') : null;
        if (raiz) engancharBienvenida(raiz, socio);
      } };
    }
    bienvenida = null;

    var d;
    try { d = reunirDatos(socio); }
    catch (e) { return pantallaAviso('No pudimos preparar tu panel. Recarga la página.'); }

    var html = '<div class="page" data-socio-inicio>' +
      saludoHTML(socio, d) +
      animoHTML(d) +
      hoyHTML(socio, d) +
      tilesHTML(socio, d) +
      '<div class="grid g3 si-tres">' + comidaHTML(socio, d) + progresoHTML(socio, d) + entrenadorHTML(socio, usuario, d) + '</div>' +
      desplegablesHTML(socio, usuario, d) +
    '</div>';

    return { html: html, listo: function (root) { enganchar(root, usuario); } };
  }

  function enganchar(root, usuario) {
    var raiz = root && root.querySelector ? root.querySelector('[data-socio-inicio]') : null;
    if (!raiz || raiz.__siInicioEnganchado) return;
    raiz.__siInicioEnganchado = true;

    /* Los desplegables se rellenan la primera vez que se abren. */
    var lazies = U.$$('details[data-si-lazy]', raiz);
    for (var i = 0; i < lazies.length; i++) {
      lazies[i].addEventListener('toggle', function () {
        if (!this.open || this.getAttribute('data-lleno')) return;
        var cuerpo = this.querySelector('.desplegable-cuerpo');
        var socio = socioActual();
        if (!cuerpo || !socio) return;
        this.setAttribute('data-lleno', '1');
        cuerpo.innerHTML = seguro(function () { return cuerpoDesplegable(this.getAttribute('data-si-lazy'), socio, usuario); }.bind(this),
          vacioAmable('🙂', 'No pudimos cargar esta sección', ''));
      });
    }

    U.delegar(raiz, 'click', '[data-si-semana]', function (e) {
      e.preventDefault();
      var socio = socioActual();
      if (socio) abrirSemana(socio);
    });

    U.delegar(raiz, 'click', '[data-si-ligera]', function (e, el) {
      e.preventDefault();
      var socio = socioActual();
      if (socio) registrarLigera(socio, el.getAttribute('data-si-ligera'));
    });

    U.delegar(raiz, 'click', '[data-si-agendar]', function (e) {
      e.preventDefault();
      var socio = socioActual();
      if (!socio) return;
      if (hayFn('Sesiones', 'agendar')) {
        var ok = seguro(function () { AG.Mod.Sesiones.agendar(socio.id, { alGuardar: function () { AG.Router.refrescar(); } }); return true; }, false);
        if (ok) return;
      }
      AG.Router.ir('socio/entrenador');
    });

    U.delegar(raiz, 'click', '[data-si-calificar]', function (e, el) {
      e.preventDefault();
      var socio = socioActual();
      if (!socio) return;
      var coachId = el.getAttribute('data-si-calificar');
      if (hayFn('Calificaciones', 'formulario')) {
        var ok = seguro(function () {
          AG.Mod.Calificaciones.formulario('coach', coachId, socio.id, { alGuardar: function () { AG.Router.refrescar(); } });
          return true;
        }, false);
        if (ok) return;
      }
      AG.Router.ir('socio/calificar');
    });
  }

  /* =============================================================
     9. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.SocioInicio = {
    render: render,
    abrirSemana: abrirSemana,
    diaQueToca: diaQueToca,
    registrarLigera: registrarLigera,
    comidaDeHoy: comidaDeHoy
  };

  AG.Router.registrar({
    path: 'socio/inicio',
    roles: ['socio'],
    titulo: 'Mi panel',
    nav: { etiqueta: 'Inicio', icono: 'inicio', grupo: 'Principal', orden: 1 },
    render: render
  });
})(window.AG);
