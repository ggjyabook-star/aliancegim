/* =============================================================
   ALLIANCE GYM — AG.Views.SocioNutricion
   -------------------------------------------------------------
   Dos pantallas del socio:

     · 'socio/nutricion'   — Mi nutrición: el plan que le armó su
       coach, con la barra de "Hoy" (comidas consumidas y macros
       acumulados), el contador de agua, las notas del coach y los
       botones de imprimir, lista de compras y pedir actualización.

     · 'socio/calculadora' — Calculadora de comidas: formulario
       prellenado con sus datos, resultado EN VIVO (TMB, TDEE,
       calorías objetivo, macros, agua, proyección y reparto por
       comida), generador de menú de ejemplo con alimentos reales
       y explorador del catálogo con calculadora de porción.

   Reutiliza sin duplicar:
     AG.Calc.perfilNutricional / distribucionComidas / proyeccionPeso
     AG.Mod.Nutricion.planHTML / generarMenu / engancharAcciones
     AG.Data.alimentosPor / macrosDe / sumaMacros
     AG.Charts.dona

   Reglas: JavaScript clásico, sin módulos, todo el texto que sale
   de la base pasa por AG.Utils.esc(), nada de alert/confirm/prompt,
   nada de localStorage directo y ninguna lista sin su estado vacío.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Views = AG.Views || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;
  var Icons = AG.Icons;
  var Data = AG.Data || {};

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Mismo criterio de color que el módulo de nutrición del gimnasio. */
  var COLOR = {
    proteina: '#e4322b',
    carbos: '#f0a03c',
    grasa: '#f2c94c',
    agua: '#38c6d9'
  };

  var ML_POR_VASO = 250;

  /* Objetivos en el lenguaje del socio (el motor usa definir/volumen/mantener). */
  var OBJETIVOS = [
    { id: 'definir', nombre: 'Bajar grasa', desc: 'Comes menos de lo que gastas', icono: 'fuego' },
    { id: 'mantener', nombre: 'Mantener', desc: 'Sostienes tu peso y recompones', icono: 'balanza' },
    { id: 'volumen', nombre: 'Ganar músculo', desc: 'Comes un poco más para construir', icono: 'pesa' }
  ];

  var AGRESIVIDADES = [
    { id: 'suave', nombre: 'Suave', desc: 'Lento y muy sostenible' },
    { id: 'moderada', nombre: 'Moderada', desc: 'El ritmo que recomendamos' },
    { id: 'agresiva', nombre: 'Agresiva', desc: 'Rápido, exige disciplina' }
  ];

  var NIVELES_ACTIVIDAD = ['sedentario', 'ligero', 'moderado', 'alto', 'atleta'];

  var SEXOS = [
    { id: 'H', nombre: 'Hombre' },
    { id: 'M', nombre: 'Mujer' }
  ];

  /*
     Referencias en comida de verdad para cada macro. Se calculan con
     los valores REALES del catálogo (AG.Data.foods), nunca a ojo.
  */
  var REFERENCIAS = {
    proteina: [
      { id: 'al_pechuga_pollo', parte: 0.65, modo: 'gramos', nombre: 'pechuga de pollo' },
      { id: 'al_huevo_entero', parte: 0.35, modo: 'piezas', piezaG: 55, enteros: true,
        singular: 'huevo', plural: 'huevos' }
    ],
    carbos: [
      { id: 'al_arroz_integral', parte: 0.55, modo: 'gramos', nombre: 'arroz integral cocido' },
      { id: 'al_avena', parte: 0.25, modo: 'gramos', nombre: 'avena' },
      { id: 'al_platano', parte: 0.20, modo: 'piezas', piezaG: 118, enteros: true,
        singular: 'plátano', plural: 'plátanos' }
    ],
    grasa: [
      { id: 'al_aguacate', parte: 0.45, modo: 'piezas', piezaG: 140, singular: 'aguacate', plural: 'aguacates' },
      { id: 'al_almendra', parte: 0.35, modo: 'gramos', nombre: 'almendras' },
      { id: 'al_aceite_oliva', parte: 0.20, modo: 'piezas', piezaG: 14, femenino: true, enteros: true,
        singular: 'cucharada de aceite de oliva', plural: 'cucharadas de aceite de oliva' }
    ]
  };

  /* Estado vivo de la calculadora (sobrevive a los repintados del router). */
  var calc = {
    socioId: '',
    datos: null,        /* { pesoKg, estaturaCm, edad, sexo, nivelActividad, objetivo, agresividad, numComidas } */
    semilla: 0,
    menu: null,         /* último menú generado */
    firmaMenu: '',      /* macros con los que se generó, para avisar si ya cambiaron */
    firmaPintada: ''    /* lo último que se pintó en la caja del menú */
  };

  /* Estado vivo del explorador de alimentos. */
  var explorador = {
    texto: '',
    categoria: '',
    alimentoId: '',
    gramos: 100
  };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) { U.toast(mensaje, tipo || 'info'); }

  function lista(v) {
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }

  /* Número finito o null (nunca NaN). */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  /* Número positivo o null. */
  function nPos(v) {
    var x = n0(v);
    return (x !== null && x > 0) ? x : null;
  }

  /* Número siempre utilizable (0 si no sirve). */
  function num(v) {
    var x = n0(v);
    return x === null ? 0 : x;
  }

  function entero(v, porDefecto) {
    var x = parseInt(v, 10);
    return isFinite(x) ? x : porDefecto;
  }

  function acotar(v, min, max) {
    var x = num(v);
    if (x < min) return min;
    if (x > max) return max;
    return x;
  }

  /* 'a', 'a y b', 'a, b y c' */
  function unir(partes) {
    var l = [], i;
    for (i = 0; i < partes.length; i++) if (partes[i]) l.push(partes[i]);
    if (!l.length) return '';
    if (l.length === 1) return l[0];
    return l.slice(0, l.length - 1).join(', ') + ' y ' + l[l.length - 1];
  }

  function minuscula(texto) {
    var t = String(texto === null || texto === undefined ? '' : texto);
    return t ? t.charAt(0).toLowerCase() + t.slice(1) : '';
  }

  function alimento(id) {
    if (!Data || typeof Data.alimento !== 'function') return null;
    return Data.alimento(id);
  }

  function macrosDe(alimentoId, gramos) {
    if (Data && typeof Data.macrosDe === 'function') return Data.macrosDe(alimentoId, gramos);
    return { kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0 };
  }

  function sumaMacros(items) {
    if (Data && typeof Data.sumaMacros === 'function') return Data.sumaMacros(items);
    return { kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0 };
  }

  function categorias() {
    return lista(Data ? Data.CATEGORIAS_ALIMENTO : null);
  }

  function colorCategoria(id) {
    var cats = categorias(), i;
    for (i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i].color;
    return '#8d9aa8';
  }

  function nombreCategoria(id) {
    var cats = categorias(), i;
    for (i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i].nombre;
    return id || 'Sin categoría';
  }

  function objetivoNutricional(valor) {
    if (Calc && typeof Calc.objetivoNutricional === 'function') return Calc.objetivoNutricional(valor);
    if (valor === 'definir' || valor === 'volumen' || valor === 'mantener') return valor;
    if (valor === 'perder_grasa') return 'definir';
    if (valor === 'ganar_musculo') return 'volumen';
    return 'mantener';
  }

  function nombreObjetivo(id) {
    for (var i = 0; i < OBJETIVOS.length; i++) if (OBJETIVOS[i].id === id) return OBJETIVOS[i].nombre;
    return 'Mantener';
  }

  function etiquetaActividad(nivel) {
    var mapa = (Calc && Calc.ETIQUETA_ACTIVIDAD) ? Calc.ETIQUETA_ACTIVIDAD : {};
    return mapa[nivel] || nivel;
  }

  function vacioHTML(mensaje, iconoNombre, botonHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre || 'nutricion', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botonHTML || '') +
    '</div>';
  }

  function punto(color) {
    return '<span class="snu-punto" style="background:' + esc(color) + '"></span>';
  }

  function pill(etiqueta, valor) {
    return '<span class="pill">' + esc(etiqueta) + ' <b>' + esc(valor) + '</b></span>';
  }

  function dato(etiqueta, valorHTML) {
    return '<div class="dato">' +
      '<span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<span class="dato-val">' + valorHTML + '</span>' +
    '</div>';
  }

  /* Clase de color según qué tan lejos está lo consumido del objetivo. */
  function claseDesvio(actual, objetivo) {
    if (!(num(objetivo) > 0)) return '';
    var d = Math.abs(num(actual) - num(objetivo)) / num(objetivo) * 100;
    if (d <= 7) return 'ok';
    if (d <= 15) return 'warn';
    return 'error';
  }

  function barraHTML(etiqueta, actual, objetivo, unidad, dec, colorClase) {
    var d = (dec === undefined || dec === null) ? 0 : dec;
    var ancho = (num(objetivo) > 0) ? acotar(num(actual) / num(objetivo) * 100, 0, 100) : 0;
    var clase = colorClase !== undefined ? colorClase : claseDesvio(actual, objetivo);
    return '<div>' +
      '<div class="bar-etiqueta">' +
        '<span>' + esc(etiqueta) + '</span>' +
        '<b class="nums">' + esc(U.num(actual, d)) + ' / ' + esc(U.num(objetivo, d)) +
          (unidad ? ' ' + esc(unidad) : '') + '</b>' +
      '</div>' +
      '<div class="bar"><span class="bar-fill' + (clase ? ' ' + clase : '') +
        '" style="width:' + Math.round(ancho) + '%"></span></div>' +
    '</div>';
  }

  /*
     'medio aguacate', '1 huevo', '2 aguacates y medio'.
     Con soloEnteros no se parten piezas que en la vida real no se parten
     (huevos, plátanos, cucharadas).
  */
  function piezasTexto(cantidad, singular, plural, femenino, soloEnteros) {
    if (soloEnteros) {
      var n = Math.max(1, Math.round(num(cantidad)));
      return n + ' ' + (n === 1 ? singular : plural);
    }
    var v = Math.round(num(cantidad) * 2) / 2;
    if (v <= 0.5) return (femenino ? 'media ' : 'medio ') + singular;
    var enteroParte = Math.floor(v);
    var mitad = (v - enteroParte) >= 0.5;
    var texto = enteroParte + ' ' + (enteroParte === 1 ? singular : plural);
    if (mitad) texto += ' y ' + (femenino ? 'media' : 'medio');
    return texto;
  }

  /* Gramos del macro que aporta 1 gramo del alimento. */
  function densidad(a, macro) {
    if (!a) return 0;
    var base = num(a.porcion) > 0 ? num(a.porcion) : 100;
    return num(a[macro]) / base;
  }

  /*
     Traduce los gramos de un macro a comida de verdad:
     '≈ 190 g de pechuga de pollo y 2 huevos'.
  */
  function fraseMacro(macro, gramosMacro) {
    var ref = REFERENCIAS[macro];
    var meta = num(gramosMacro);
    if (!ref || meta <= 0) return '';

    var partes = [], i, r, a, dens, gramosAlimento, g, piezas;

    for (i = 0; i < ref.length; i++) {
      r = ref[i];
      a = alimento(r.id);
      if (!a) continue;
      dens = densidad(a, macro);
      if (!(dens > 0)) continue;

      gramosAlimento = meta * r.parte / dens;

      if (r.modo === 'piezas') {
        piezas = gramosAlimento / (num(r.piezaG) > 0 ? num(r.piezaG) : 100);
        if (piezas < 0.25) continue;
        partes.push(piezasTexto(piezas, r.singular, r.plural, r.femenino, r.enteros));
      } else {
        g = Math.round(gramosAlimento / 5) * 5;
        if (g < 5) continue;
        partes.push(U.num(g, 0) + ' g de ' + (r.nombre || minuscula(a.nombre)));
      }
    }

    if (!partes.length) return '';
    return '≈ ' + unir(partes);
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-nutricion';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.snu-punto{display:inline-block;width:8px;height:8px;border-radius:50%;' +
        'margin-right:6px;flex:0 0 auto;vertical-align:middle}' +
      /* Número grande de calorías objetivo */
      '.snu-kcal{font-size:40px;line-height:1;font-weight:800;color:var(--texto);' +
        'font-variant-numeric:tabular-nums;letter-spacing:-1px}' +
      '.snu-kcal small{font-size:14px;font-weight:700;color:var(--texto-3);margin-left:6px;letter-spacing:0}' +
      /* Tarjetas de macro */
      '.snu-macros{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(196px,1fr))}' +
      '.snu-macro{border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);' +
        'padding:12px 13px;display:flex;flex-direction:column;gap:4px;min-width:0}' +
      '.snu-macro b{font-size:13px;font-weight:700;color:var(--texto)}' +
      '.snu-macro .snu-g{font-size:22px;font-weight:800;color:var(--texto);font-variant-numeric:tabular-nums}' +
      '.snu-macro .snu-g span{font-size:12px;font-weight:600;color:var(--texto-3);margin-left:4px}' +
      '.snu-macro p{margin:2px 0 0;font-size:11.5px;line-height:1.45;color:var(--texto-3)}' +
      /* Barra de "Hoy" y contador de agua */
      '.snu-hoy{display:flex;flex-wrap:wrap;gap:8px}' +
      '.snu-hoy .chip{max-width:100%}' +
      '.snu-agua{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
      '.snu-vasos{display:flex;gap:5px;flex-wrap:wrap;flex:1 1 160px;min-width:0}' +
      '.snu-vaso{width:16px;height:24px;border-radius:3px 3px 7px 7px;border:1.5px solid var(--borde-2);' +
        'background:transparent;flex:0 0 auto}' +
      '.snu-vaso.on{background:' + COLOR.agua + ';border-color:' + COLOR.agua + '}' +
      '.snu-mas{font-size:20px;font-weight:800;line-height:1;flex:0 0 auto}' +
      '.snu-mas[disabled]{opacity:.45;cursor:not-allowed}' +
      /* Listas del explorador */
      '.snu-scroll{max-height:340px;overflow-y:auto}' +
      '.snu-al b{display:block;font-size:13px;font-weight:700;color:var(--texto);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.snu-al span{display:block;font-size:11px;color:var(--texto-3)}' +
      '@media (max-width:420px){' +
        '.snu-kcal{font-size:32px}' +
        '.snu-macros{grid-template-columns:1fr}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Datos del socio
     ============================================================= */

  /* Ficha viva del socio de la sesión (nunca la de otro). */
  function socioDe(ctx) {
    var usuario = ctx && ctx.usuario ? ctx.usuario : null;
    if (!usuario || usuario.rol !== 'socio') return null;
    var socio = AG.DB.usuario(usuario.id);
    return (socio && socio.rol === 'socio') ? socio : null;
  }

  /* Última medición con peso registrado (la fuente real del peso). */
  function ultimaMedicion(socioId) {
    var meds = AG.DB.medicionesDe(socioId);
    for (var i = meds.length - 1; i >= 0; i--) {
      if (meds[i] && nPos(meds[i].pesoKg) !== null) return meds[i];
    }
    return null;
  }

  function pesoDe(socio) {
    var m = ultimaMedicion(socio.id);
    return m ? nPos(m.pesoKg) : null;
  }

  function estaturaDe(socio) {
    var e = nPos(socio.estaturaCm);
    if (e !== null) return e;
    var m = ultimaMedicion(socio.id);
    return m ? nPos(m.estaturaCm) : null;
  }

  /* El plan solo se muestra si de verdad es del socio de la sesión. */
  function planDe(socio) {
    var plan = AG.DB.planNutricionDe(socio.id);
    if (!plan || plan.socioId !== socio.id) return null;
    return plan;
  }

  function coachDe(socio) {
    return socio.coachId ? AG.DB.usuario(socio.coachId) : null;
  }

  /* Comidas utilizables de un plan (sin entradas rotas). */
  function comidasDe(plan) {
    var origen = lista(plan ? plan.comidas : null), salida = [], i;
    for (i = 0; i < origen.length; i++) {
      if (origen[i] && typeof origen[i] === 'object') salida.push(origen[i]);
    }
    return salida;
  }

  function alimentosDe(comida) {
    var origen = lista(comida ? comida.alimentos : null), salida = [], i;
    for (i = 0; i < origen.length; i++) {
      if (origen[i] && typeof origen[i] === 'object') salida.push(origen[i]);
    }
    return salida;
  }

  /* =============================================================
     4. Seguimiento del día (comidas marcadas y vasos de agua)
     Se guarda dentro del propio plan, siempre a través de AG.DB.
     ============================================================= */

  function seguimientoDeHoy(plan) {
    var hoy = U.hoy();
    var s = plan ? plan.seguimiento : null;
    if (!s || typeof s !== 'object' || s.fecha !== hoy) {
      return { fecha: hoy, comidas: [], vasos: 0 };
    }
    var marcadas = [], origen = lista(s.comidas), i, v;
    for (i = 0; i < origen.length; i++) {
      v = entero(origen[i], -1);
      if (v >= 0 && marcadas.indexOf(v) < 0) marcadas.push(v);
    }
    return { fecha: hoy, comidas: marcadas, vasos: Math.max(0, entero(s.vasos, 0)) };
  }

  function guardarSeguimiento(plan, seg) {
    if (!plan || !plan.id) return;
    AG.DB.actualizar('planesNutricion', plan.id, {
      seguimiento: { fecha: seg.fecha, comidas: seg.comidas.slice(), vasos: seg.vasos }
    });
  }

  /* Litros de agua que le tocan al socio (los del plan o el cálculo). */
  function metaAgua(plan, socio) {
    var delPlan = nPos(plan ? plan.agua : null);
    if (delPlan !== null) return delPlan;
    var calculada = Calc.aguaDiaria(pesoDe(socio), socio.nivelActividad);
    return calculada !== null ? calculada : 2;
  }

  /* =============================================================
     5. MI NUTRICIÓN — barra de "Hoy"
     ============================================================= */

  function totalesConsumidos(comidas, seg) {
    var items = [], i, j, als;
    for (i = 0; i < comidas.length; i++) {
      if (seg.comidas.indexOf(i) < 0) continue;
      als = alimentosDe(comidas[i]);
      for (j = 0; j < als.length; j++) items.push(als[j]);
    }
    return sumaMacros(items);
  }

  function hoyHTML(plan, socio) {
    var comidas = comidasDe(plan);
    var seg = seguimientoDeHoy(plan);
    var total = totalesConsumidos(comidas, seg);

    var metaKcal = num(plan.kcal);
    var metaP = num(plan.proteina);
    var metaC = num(plan.carbos);
    var metaG = num(plan.grasa);

    var chips = '', i, comida, mac, marcada;
    if (!comidas.length) {
      chips = '<p class="mini muted">Tu plan todavía no tiene comidas cargadas: pídele a tu coach que las complete.</p>';
    } else {
      chips = '<div class="snu-hoy">';
      for (i = 0; i < comidas.length; i++) {
        comida = comidas[i];
        mac = sumaMacros(alimentosDe(comida));
        marcada = seg.comidas.indexOf(i) >= 0;
        chips += '<button type="button" class="chip' + (marcada ? ' on' : '') + '" data-comida-hoy="' + i + '"' +
          ' aria-pressed="' + (marcada ? 'true' : 'false') + '">' +
          icono(marcada ? 'check' : 'mas', 14) +
          esc(comida.nombre || ('Comida ' + (i + 1))) +
          ' · ' + esc(U.fecha(comida.hora, 'hora') || comida.hora || '') +
          ' · ' + esc(U.num(mac.kcal, 0)) + ' kcal' +
        '</button>';
      }
      chips += '</div>';
    }

    var faltan = Math.max(0, metaKcal - num(total.kcal));
    var resumen = comidas.length
      ? (seg.comidas.length
          ? 'Llevas <b>' + esc(U.num(total.kcal, 0)) + ' kcal</b> de ' + esc(U.num(metaKcal, 0)) +
            '. Te faltan <b>' + esc(U.num(faltan, 0)) + ' kcal</b> para cerrar el día.'
          : 'Todavía no marcas ninguna comida de hoy. Toca cada una cuando la termines.')
      : '';

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('check', 18) + '<span>Hoy</span></div>' +
        '<span class="badge badge-muted nowrap">' + esc(U.fecha(U.hoy(), 'corto')) + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        chips +
        (resumen ? '<p class="mini muted">' + resumen + '</p>' : '') +
        '<div class="snu-macros">' +
          barraHTML('Calorías', total.kcal, metaKcal, 'kcal', 0) +
          barraHTML('Proteína', total.proteina, metaP, 'g', 0) +
          barraHTML('Carbohidratos', total.carbos, metaC, 'g', 0) +
          barraHTML('Grasa', total.grasa, metaG, 'g', 0) +
        '</div>' +
        aguaHTML(plan, socio, seg) +
      '</div>' +
    '</div>';
  }

  function aguaHTML(plan, socio, seg) {
    var litros = metaAgua(plan, socio);
    var vasosMeta = Math.max(1, Math.round(litros * 1000 / ML_POR_VASO));
    var vasos = Math.min(seg.vasos, 40);
    var pintados = Math.max(vasosMeta, vasos);
    var mlTomados = vasos * ML_POR_VASO;

    var iconos = '', i;
    for (i = 0; i < pintados; i++) {
      iconos += '<span class="snu-vaso' + (i < vasos ? ' on' : '') + '" aria-hidden="true"></span>';
    }

    var pct = acotar(vasos / vasosMeta * 100, 0, 100);
    var completo = vasos >= vasosMeta;

    return '<div class="caja">' +
      '<div class="between wrap mb-sm" style="gap:8px">' +
        '<div class="row-sm">' + icono('gota', 16) + '<b>Agua de hoy</b></div>' +
        '<span class="badge ' + (completo ? 'badge-ok' : 'badge-info') + '">' +
          esc(U.num(mlTomados / 1000, 2)) + ' L de ' + esc(U.num(litros, 1)) + ' L</span>' +
      '</div>' +
      '<div class="snu-agua">' +
        '<button type="button" class="btn-icono snu-mas" data-agua="-1" aria-label="Quitar un vaso"' +
          (vasos <= 0 ? ' disabled' : '') + '>−</button>' +
        '<div class="snu-vasos">' + iconos + '</div>' +
        '<button type="button" class="btn-icono snu-mas" data-agua="1" aria-label="Agregar un vaso">+</button>' +
      '</div>' +
      '<div class="bar mt-sm"><span class="bar-fill info" style="width:' + Math.round(pct) + '%"></span></div>' +
      '<p class="mini muted mt-sm">' +
        esc(vasos + (vasos === 1 ? ' vaso' : ' vasos') + ' de ' + ML_POR_VASO + ' ml. ') +
        esc(completo
          ? '¡Meta cumplida! Sigue tomando agua si entrenas fuerte.'
          : 'Te faltan ' + (vasosMeta - vasos) + (vasosMeta - vasos === 1 ? ' vaso' : ' vasos') + ' para tu meta del día.') +
      '</p>' +
    '</div>';
  }

  /* =============================================================
     6. MI NUTRICIÓN — pantalla completa
     ============================================================= */

  function contactoCoachHTML(coach) {
    if (!coach) {
      return '<div class="aviso aviso-warn">' + icono('alerta', 18) +
        '<div><b>Todavía no tienes coach asignado.</b>' +
        '<div class="mini">Pásate a recepción para que te asignen uno y te arme tu plan.</div></div></div>';
    }

    var contactos = '';
    if (coach.telefono) {
      contactos += '<a class="btn btn-outline btn-sm" href="tel:' + esc(String(coach.telefono).replace(/\s+/g, '')) + '">' +
        icono('telefono', 15) + ' ' + esc(coach.telefono) + '</a>';
    }
    if (coach.email) {
      contactos += '<a class="btn btn-outline btn-sm" href="mailto:' + esc(coach.email) + '">' +
        icono('correo', 15) + ' Escribirle</a>';
    }

    return '<div class="list"><div class="list-item">' +
      '<div class="list-item-main">' +
        '<div class="row-sm" style="min-width:0">' + U.avatar(coach, 'sm') +
          '<div class="snu-al" style="min-width:0">' +
            '<b>' + esc(U.nombreCompleto(coach)) + '</b>' +
            '<span>' + esc(coach.especialidad || 'Entrenador') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="list-item-side row-sm wrap">' + (contactos || '<span class="mini muted">Sin datos de contacto</span>') + '</div>' +
    '</div></div>';
  }

  function sinPlanHTML(socio) {
    var coach = coachDe(socio);
    return '<div class="card card-rojo">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('manzana', 18) + '<span>Todavía no tienes un plan de nutrición</span></div>' +
      '</div>' +
      '<div class="card-body">' +
        '<p class="muted">Tu coach todavía no te arma uno. Mientras tanto puedes calcular tus calorías y ' +
          'tus macros con la calculadora del gimnasio: usa tus datos reales y te propone un menú con comida de verdad.</p>' +
        '<button type="button" class="btn btn-primary btn-lg btn-block" data-ir-calculadora>' +
          icono('calculadora', 20) + ' Usar la calculadora</button>' +
        '<div class="sep"></div>' +
        '<div class="row-sm mb-sm">' + icono('coach', 16) + '<b>Tu coach</b></div>' +
        contactoCoachHTML(coach) +
        (coach
          ? '<button type="button" class="btn btn-outline btn-block mt-sm" data-pedir-plan>' +
              icono('campana', 16) + ' Pedirle mi plan de nutrición</button>'
          : '') +
      '</div>' +
    '</div>';
  }

  function encabezadoPlanHTML(plan, socio) {
    var coach = coachDe(socio);
    var actualizado = plan.actualizado || plan.creado;
    return '<div class="card">' +
      '<div class="card-body">' +
        '<div class="row-sm wrap between" style="gap:10px">' +
          '<div class="row-sm wrap">' +
            pill('Objetivo', nombreObjetivo(objetivoNutricional(plan.objetivo))) +
            pill('Comidas', String(comidasDe(plan).length) + ' al día') +
            pill('Agua', U.num(metaAgua(plan, socio), 1) + ' L') +
          '</div>' +
          '<div class="row-sm wrap">' +
            '<span class="mini muted">' + icono('historial', 14) + ' Actualizado ' +
              esc(U.fechaRelativa(actualizado)) + ' (' + esc(U.fecha(actualizado, 'corto')) + ')</span>' +
          '</div>' +
        '</div>' +
        (coach
          ? '<p class="mini muted mt-sm">Lo armó <b>' + esc(U.nombreCompleto(coach)) +
            '</b>. Si algo no te acomoda, pídele una actualización desde el botón de arriba.</p>'
          : '<p class="mini muted mt-sm">Este plan no tiene coach asignado. Pásate a recepción para que te asignen uno.</p>') +
      '</div>' +
    '</div>';
  }

  function notasCoachHTML(plan) {
    if (!plan.notas) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('Tu coach no dejó notas en este plan. Si tienes dudas de cómo seguirlo, pregúntale.', 'chat', '') +
      '</div></div>';
    }
    return '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icono('chat', 18) + '<span>Notas de tu coach</span></div></div>' +
      '<div class="card-body">' +
        '<p style="white-space:pre-line;margin:0">' + esc(plan.notas) + '</p>' +
      '</div>' +
    '</div>';
  }

  function planCompletoHTML(plan, socio) {
    var cuerpo;
    if (AG.Mod && AG.Mod.Nutricion && typeof AG.Mod.Nutricion.planHTML === 'function') {
      cuerpo = AG.Mod.Nutricion.planHTML(plan, { acciones: true, socio: socio });
    } else {
      cuerpo = vacioHTML('No pudimos preparar el detalle de tu plan. Vuelve a entrar en un momento.', 'nutricion', '');
    }
    return '<div class="card"><div class="card-body">' + cuerpo + '</div></div>';
  }

  function renderNutricion(ctx) {
    asegurarEstilos();

    var socio = socioDe(ctx);
    if (!socio) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('Esta sección es solo para socios. Vuelve a entrar con tu cuenta.', 'candado', '') +
      '</div></div></div>';
    }

    var plan = planDe(socio);

    /* Imprimir y lista de compras los emite planHTML dentro del plan. */
    var acciones = plan
      ? '<div class="page-acciones">' +
          '<button type="button" class="btn btn-primary" data-pedir-plan>' +
            icono('campana', 16) + ' Pedir actualización a mi coach</button>' +
        '</div>'
      : '';

    var cuerpo = plan
      ? '<div data-hoy>' + hoyHTML(plan, socio) + '</div>' +
        encabezadoPlanHTML(plan, socio) +
        planCompletoHTML(plan, socio) +
        notasCoachHTML(plan)
      : sinPlanHTML(socio);

    var html = '<div class="page" data-socio-nutricion>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('manzana', 24) + '<span>Mi nutrición</span></h1>' +
          '<p class="page-sub">' + esc(plan
            ? 'Marca cada comida cuando la termines y lleva el agua del día. Lo demás ya lo dejó listo tu coach.'
            : 'Aquí vivirá tu plan de alimentación en cuanto tu coach lo arme.') + '</p>' +
        '</div>' +
        acciones +
      '</div>' +
      cuerpo +
    '</div>';

    return {
      html: html,
      listo: function (root) { engancharNutricion(root, socio); }
    };
  }

  /* ---------- Eventos de "Mi nutrición" ---------- */

  function engancharNutricion(root, socio) {
    var raiz = root.querySelector('[data-socio-nutricion]');
    if (!raiz) return;
    asegurarEstilos();

    /* Imprimir plan y lista de compras los resuelve el módulo del gimnasio. */
    if (AG.Mod && AG.Mod.Nutricion && typeof AG.Mod.Nutricion.engancharAcciones === 'function') {
      AG.Mod.Nutricion.engancharAcciones(raiz);
    }

    U.delegar(raiz, 'click', '[data-ir-calculadora]', function (e) {
      e.preventDefault();
      AG.Router.ir('socio/calculadora');
    });

    U.delegar(raiz, 'click', '[data-pedir-plan]', function (e) {
      e.preventDefault();
      pedirActualizacion(socio);
    });

    U.delegar(raiz, 'click', '[data-comida-hoy]', function (e, el) {
      e.preventDefault();
      var plan = planDe(socio);
      if (!plan) { toast('Tu plan ya no está disponible.', 'error'); return; }

      var indice = entero(el.getAttribute('data-comida-hoy'), -1);
      var comidas = comidasDe(plan);
      if (indice < 0 || indice >= comidas.length) return;

      var seg = seguimientoDeHoy(plan);
      var pos = seg.comidas.indexOf(indice);
      if (pos >= 0) seg.comidas.splice(pos, 1);
      else seg.comidas.push(indice);

      guardarSeguimiento(plan, seg);
      repintarHoy(raiz, plan, socio);

      if (pos < 0 && seg.comidas.length === comidas.length) {
        toast('¡Día completo! Cerraste todas tus comidas.', 'ok');
      }
    });

    U.delegar(raiz, 'click', '[data-agua]', function (e, el) {
      e.preventDefault();
      var plan = planDe(socio);
      if (!plan) { toast('Tu plan ya no está disponible.', 'error'); return; }

      var paso = entero(el.getAttribute('data-agua'), 0);
      var seg = seguimientoDeHoy(plan);
      var nuevos = Math.max(0, Math.min(40, seg.vasos + paso));
      if (nuevos === seg.vasos) return;

      var metaVasos = Math.max(1, Math.round(metaAgua(plan, socio) * 1000 / ML_POR_VASO));
      var alcanzo = seg.vasos < metaVasos && nuevos >= metaVasos;

      seg.vasos = nuevos;
      guardarSeguimiento(plan, seg);
      repintarHoy(raiz, plan, socio);

      if (alcanzo) toast('Meta de agua cumplida por hoy.', 'ok');
    });
  }

  function repintarHoy(raiz, plan, socio) {
    var caja = raiz.querySelector('[data-hoy]');
    if (caja) caja.innerHTML = hoyHTML(plan, socio);
  }

  /* Aviso al coach, sin repetirlo el mismo día. */
  function pedirActualizacion(socio) {
    var coach = coachDe(socio);
    if (!coach) {
      toast('Todavía no tienes coach asignado. Pásate a recepción.', 'warn');
      return;
    }

    var clave = 'nutricion-solicitud:' + socio.id + ':' + U.hoy();
    var repetida = AG.DB.donde('notificaciones', function (n) {
      return n.usuarioId === coach.id && n.clave === clave;
    }).length > 0;

    if (repetida) {
      toast('Ya le enviaste la solicitud hoy. Dale un poco de tiempo para responder.', 'info');
      return;
    }

    U.confirmar(
      '¿Le avisamos a ' + U.nombreCompleto(coach) + ' que quieres una actualización de tu plan de alimentación?',
      'Pedir actualización'
    ).then(function (ok) {
      if (!ok) return;
      AG.DB.notificar(coach.id, {
        titulo: 'Solicitud de plan de nutrición',
        cuerpo: U.nombreCompleto(socio) + ' (' + (socio.codigo || 'sin código') +
          ') pide que revises y actualices su plan de alimentación.',
        tipo: 'aviso',
        link: '#/coach/nutricion',
        clave: clave
      });
      toast('Listo: tu coach recibió la solicitud.', 'ok');
    });
  }

  /* =============================================================
     7. CALCULADORA — datos de partida y cálculo
     ============================================================= */

  /* Prellenado con lo que el sistema ya sabe del socio. */
  function datosIniciales(socio) {
    return {
      pesoKg: pesoDe(socio),
      estaturaCm: estaturaDe(socio),
      edad: socio.fechaNacimiento ? U.edad(socio.fechaNacimiento) : null,
      sexo: socio.sexo === 'M' ? 'M' : 'H',
      nivelActividad: NIVELES_ACTIVIDAD.indexOf(socio.nivelActividad) >= 0 ? socio.nivelActividad : 'moderado',
      objetivo: objetivoNutricional(socio.objetivo),
      agresividad: 'moderada',
      numComidas: 4
    };
  }

  /* Deja el estado listo para el socio de la sesión. */
  function prepararCalculadora(socio) {
    if (calc.socioId !== socio.id || !calc.datos) {
      calc.socioId = socio.id;
      calc.datos = datosIniciales(socio);
      calc.menu = null;
      calc.firmaMenu = '';
      calc.firmaPintada = '';
      calc.semilla = 0;
    }
    return calc.datos;
  }

  /* Normaliza lo que trae el formulario (nunca confía en el DOM). */
  function normalizarDatos(crudo, base) {
    var d = crudo && typeof crudo === 'object' ? crudo : {};
    var previo = base || {};

    var objetivo = (d.objetivo === 'definir' || d.objetivo === 'volumen' || d.objetivo === 'mantener')
      ? d.objetivo : objetivoNutricional(previo.objetivo);

    var agresividad = (d.agresividad === 'suave' || d.agresividad === 'moderada' || d.agresividad === 'agresiva')
      ? d.agresividad : (previo.agresividad || 'moderada');

    var nivel = NIVELES_ACTIVIDAD.indexOf(d.nivelActividad) >= 0
      ? d.nivelActividad : (previo.nivelActividad || 'moderado');

    var comidas = entero(d.numComidas, entero(previo.numComidas, 4));
    if (comidas < 3) comidas = 3;
    if (comidas > 6) comidas = 6;

    var peso = nPos(d.pesoKg);
    var estatura = nPos(d.estaturaCm);
    var edad = n0(d.edad);

    return {
      pesoKg: (peso !== null && peso <= 400) ? peso : null,
      estaturaCm: (estatura !== null && estatura <= 260) ? estatura : null,
      edad: (edad !== null && edad >= 10 && edad <= 100) ? Math.round(edad) : null,
      sexo: d.sexo === 'M' ? 'M' : 'H',
      nivelActividad: nivel,
      objetivo: objetivo,
      agresividad: agresividad,
      numComidas: comidas
    };
  }

  /* Perfil completo (TMB, TDEE, kcal, macros, comidas, agua, IMC). */
  function perfilDe(d) {
    if (!d) return null;
    var perfil = Calc.perfilNutricional({
      pesoKg: d.pesoKg,
      estaturaCm: d.estaturaCm,
      edad: d.edad,
      sexo: d.sexo,
      nivelActividad: d.nivelActividad,
      objetivo: d.objetivo,
      agresividad: d.agresividad,
      numComidas: d.numComidas
    });
    return perfil;
  }

  function perfilCompleto(perfil) {
    return !!(perfil && perfil.tmb !== null && perfil.tdee !== null &&
      perfil.kcal !== null && perfil.macros && perfil.macros.kcal > 0);
  }

  /* Faltantes explicados en español, para el estado vacío. */
  function faltantes(d) {
    var faltan = [];
    if (d.pesoKg === null) faltan.push('tu peso en kilos');
    if (d.estaturaCm === null) faltan.push('tu estatura en centímetros');
    if (d.edad === null) faltan.push('tu edad');
    return faltan;
  }

  /* Kilos por semana que implica el ajuste elegido (7 700 kcal ≈ 1 kg). */
  function ritmoSemanal(tdee, objetivo, agresividad, tmb) {
    var kcal = Calc.caloriasObjetivo(tdee, objetivo, agresividad, tmb);
    if (kcal === null || tdee === null) return null;
    var diferencia = kcal - tdee;
    var kg = (diferencia * 7) / (Calc.KCAL_POR_KG_GRASA || 7700);
    return Math.round(kg * 100) / 100;
  }

  function textoRitmo(kg) {
    if (kg === null) return 'Completa tus datos para ver el ritmo';
    if (Math.abs(kg) < 0.05) return 'Peso estable';
    return (kg < 0 ? '≈ −' : '≈ +') + U.num(Math.abs(kg), 2) + ' kg por semana';
  }

  /* =============================================================
     8. CALCULADORA — formulario
     ============================================================= */

  function radioCardsHTML(nombre, opciones, valor, conIcono) {
    var html = '<div class="radio-cards' + (opciones.length === 3 ? ' tres' : '') + '">', i, o, activo;
    for (i = 0; i < opciones.length; i++) {
      o = opciones[i];
      activo = (o.id === valor);
      html += '<label class="radio-card' + (activo ? ' activo' : '') + '">' +
        '<input type="radio" name="' + esc(nombre) + '" value="' + esc(o.id) + '"' + (activo ? ' checked' : '') + '>' +
        (conIcono && o.icono ? icono(o.icono, 22) : '') +
        '<b>' + esc(o.nombre) + '</b>' +
        '<span>' + esc(o.desc || '') + '</span>' +
        (nombre === 'agresividad' ? '<span class="mini txt-rojo bold" data-ritmo="' + esc(o.id) + '"></span>' : '') +
      '</label>';
    }
    return html + '</div>';
  }

  function formularioHTML(d, socio) {
    var opcionesNivel = '', i, nivel;
    for (i = 0; i < NIVELES_ACTIVIDAD.length; i++) {
      nivel = NIVELES_ACTIVIDAD[i];
      opcionesNivel += '<option value="' + esc(nivel) + '"' + (d.nivelActividad === nivel ? ' selected' : '') + '>' +
        esc(etiquetaActividad(nivel)) + '</option>';
    }

    var opcionesSexo = '';
    for (i = 0; i < SEXOS.length; i++) {
      opcionesSexo += '<option value="' + esc(SEXOS[i].id) + '"' + (d.sexo === SEXOS[i].id ? ' selected' : '') + '>' +
        esc(SEXOS[i].nombre) + '</option>';
    }

    var opcionesComidas = '';
    for (i = 3; i <= 6; i++) {
      opcionesComidas += '<option value="' + i + '"' + (d.numComidas === i ? ' selected' : '') + '>' +
        i + ' comidas al día</option>';
    }

    var med = ultimaMedicion(socio.id);
    var origenPeso = med
      ? 'Tomado de tu medición del ' + U.fecha(med.fecha, 'corto') + '. Puedes cambiarlo.'
      : 'Todavía no tienes mediciones: escribe tu peso a mano.';

    return '<form class="stack" data-form-calc autocomplete="off">' +
      '<div class="form-grid dos">' +
        '<div class="field">' +
          '<label class="label" for="snu-peso">Peso (kg)</label>' +
          '<input class="input" id="snu-peso" name="pesoKg" type="number" min="30" max="400" step="0.1" ' +
            'inputmode="decimal" value="' + (d.pesoKg !== null ? esc(d.pesoKg) : '') + '" placeholder="78.5">' +
          '<span class="help">' + esc(origenPeso) + '</span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="snu-estatura">Estatura (cm)</label>' +
          '<input class="input" id="snu-estatura" name="estaturaCm" type="number" min="120" max="260" step="0.5" ' +
            'inputmode="decimal" value="' + (d.estaturaCm !== null ? esc(d.estaturaCm) : '') + '" placeholder="175">' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="snu-edad">Edad (años)</label>' +
          '<input class="input" id="snu-edad" name="edad" type="number" min="10" max="100" step="1" ' +
            'inputmode="numeric" value="' + (d.edad !== null ? esc(d.edad) : '') + '" placeholder="29">' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="snu-sexo">Sexo</label>' +
          '<select class="select" id="snu-sexo" name="sexo">' + opcionesSexo + '</select>' +
          '<span class="help">La fórmula de Mifflin-St Jeor cambia según el sexo.</span>' +
        '</div>' +
        '<div class="field ancho-total">' +
          '<label class="label" for="snu-actividad">Nivel de actividad</label>' +
          '<select class="select" id="snu-actividad" name="nivelActividad">' + opcionesNivel + '</select>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<span class="label">¿Qué quieres lograr?</span>' +
        radioCardsHTML('objetivo', OBJETIVOS, d.objetivo, true) +
      '</div>' +

      '<div class="field">' +
        '<span class="label">¿Qué tan rápido?</span>' +
        radioCardsHTML('agresividad', AGRESIVIDADES, d.agresividad, false) +
        '<span class="help">Mientras más agresivo, más rápido el cambio y más difícil sostenerlo.</span>' +
      '</div>' +

      '<div class="field">' +
        '<label class="label" for="snu-comidas">Número de comidas</label>' +
        '<select class="select" id="snu-comidas" name="numComidas" data-num>' + opcionesComidas + '</select>' +
        '<span class="help">Reparte el mismo total del día: elige las que de verdad puedas cumplir.</span>' +
      '</div>' +
    '</form>';
  }

  /* =============================================================
     9. CALCULADORA — resultado en vivo
     ============================================================= */

  function resumenHTML(perfil, d) {
    if (!perfilCompleto(perfil)) {
      var faltan = faltantes(d);
      return '<div class="card"><div class="card-body">' +
        vacioHTML(faltan.length
          ? 'Para calcular tus comidas nos falta ' + unir(faltan) + '.'
          : 'Revisa tus datos: con esos valores no podemos calcular tu gasto energético.', 'calculadora', '') +
      '</div></div>';
    }

    var diferencia = perfil.kcal - perfil.tdee;
    var claseDif = diferencia < 0 ? 'txt-warn' : (diferencia > 0 ? 'txt-info' : 'muted');
    var textoDif = Math.abs(diferencia) < 5
      ? 'Justo tu gasto diario'
      : U.signo(diferencia, 0, 'kcal/día') + ' respecto a tu gasto';

    var imc = perfil.imc;
    var clas = imc !== null ? Calc.clasificacionIMC(imc) : null;

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('meta', 18) + '<span>Tu objetivo del día</span></div>' +
        '<span class="badge badge-rojo">' + esc(nombreObjetivo(perfil.objetivo)) + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<div>' +
          '<div class="snu-kcal">' + esc(U.num(perfil.kcal, 0)) + '<small>kcal al día</small></div>' +
          '<p class="mini ' + claseDif + ' bold" style="margin:6px 0 0">' + esc(textoDif) + '</p>' +
        '</div>' +

        '<div class="caja">' +
          '<div class="between wrap" style="gap:8px">' +
            '<b>TMB · ' + esc(U.num(perfil.tmb, 0)) + ' kcal</b>' +
            '<span class="mini muted">Tasa metabólica basal</span>' +
          '</div>' +
          '<p class="mini muted" style="margin:4px 0 0">Es lo que tu cuerpo gasta en reposo, solo por estar vivo: respirar, ' +
            'bombear sangre y mantener la temperatura.</p>' +
        '</div>' +

        '<div class="caja">' +
          '<div class="between wrap" style="gap:8px">' +
            '<b>TDEE · ' + esc(U.num(perfil.tdee, 0)) + ' kcal</b>' +
            '<span class="mini muted">Gasto total diario</span>' +
          '</div>' +
          '<p class="mini muted" style="margin:4px 0 0">Es tu TMB más todo lo que te mueves: ' +
            esc(minuscula(etiquetaActividad(d.nivelActividad))) + '.</p>' +
        '</div>' +

        '<div class="datos-grid">' +
          dato('Agua al día', esc(U.num(perfil.agua, 1)) + ' <span class="mini muted">L</span>') +
          dato('IMC', imc !== null
            ? esc(U.num(imc, 1)) + ' <span class="mini muted">' + esc(clas.texto) + '</span>'
            : '<span class="muted">Sin datos</span>') +
          dato('Proteína por kilo', perfil.macros.gProteinaPorKg !== null
            ? esc(U.num(perfil.macros.gProteinaPorKg, 1)) + ' <span class="mini muted">g/kg</span>'
            : '<span class="muted">—</span>') +
        '</div>' +

        proyeccionHTML(perfil, d) +
      '</div>' +
    '</div>';
  }

  function proyeccionHTML(perfil, d) {
    var diferencia = perfil.kcal - perfil.tdee;
    var semanas = 8;

    if (Math.abs(diferencia) < 5 || d.pesoKg === null) {
      return '<div class="aviso aviso-info">' + icono('info', 18) +
        '<div><b>Tu peso se mantendría estable.</b>' +
        '<div class="mini">El cambio vendría de tu composición corporal: más músculo y menos grasa entrenando fuerte.</div></div></div>';
    }

    var proy = Calc.proyeccionPeso(d.pesoKg, -diferencia, semanas);
    var porSemana = proy.kgPorSemana;
    var total = proy.cambioKg;
    var baja = total < 0;

    var frase = 'A este ritmo ' + (baja ? 'bajarías' : 'subirías') + ' alrededor de <b>' +
      esc(U.num(Math.abs(porSemana), 2)) + ' kg por semana</b>; en ' + semanas + ' semanas serían <b>' +
      esc(U.num(Math.abs(total), 1)) + ' kg</b> (de ' + esc(U.num(proy.pesoInicial, 1)) + ' a ' +
      esc(U.num(proy.pesoFinal, 1)) + ' kg).';

    var honestidad = Math.abs(porSemana) > 1
      ? ' Es un ritmo muy rápido: cuesta sostenerlo y se pierde músculo. Considera bajarle a la agresividad.'
      : ' La báscula no baja parejo todos los días: mide el promedio de la semana, no un solo día.';

    return '<div class="aviso ' + (Math.abs(porSemana) > 1 ? 'aviso-warn' : 'aviso-ok') + '">' +
      icono(Math.abs(porSemana) > 1 ? 'alerta' : 'meta', 18) +
      '<div><b>Proyección honesta.</b><div class="mini">' + frase + esc(honestidad) + '</div></div>' +
    '</div>';
  }

  function tarjetaMacroHTML(etiqueta, gramos, kcal, color, macro) {
    var frase = fraseMacro(macro, gramos);
    return '<div class="snu-macro">' +
      '<b>' + punto(color) + esc(etiqueta) + '</b>' +
      '<div class="snu-g">' + esc(U.num(gramos, 0)) + '<span>g</span></div>' +
      '<span class="mini muted">' + esc(U.num(kcal, 0)) + ' kcal</span>' +
      (frase ? '<p>' + esc(frase) + '</p>' : '') +
    '</div>';
  }

  function macrosHTML(perfil) {
    if (!perfilCompleto(perfil)) return '';
    var m = perfil.macros;

    var dona = Charts.dona([
      { etiqueta: 'Proteína', valor: m.kcalP, color: COLOR.proteina },
      { etiqueta: 'Carbohidratos', valor: m.kcalC, color: COLOR.carbos },
      { etiqueta: 'Grasa', valor: m.kcalG, color: COLOR.grasa }
    ], {
      alto: 220,
      sufijo: ' kcal',
      centroValor: U.num(m.kcal, 0),
      centroTitulo: 'kcal al día',
      aria: 'Reparto de macronutrientes',
      vacio: 'Todavía no hay macros que repartir.'
    });

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('grafica', 18) + '<span>Tus macros</span></div>' +
        '<span class="mini muted">' + esc(m.pctP + ' % P · ' + m.pctC + ' % C · ' + m.pctG + ' % G') + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="grid g2">' +
          '<div>' + dona + '</div>' +
          '<div class="snu-macros">' +
            tarjetaMacroHTML('Proteína', m.proteina, m.kcalP, COLOR.proteina, 'proteina') +
            tarjetaMacroHTML('Carbohidratos', m.carbos, m.kcalC, COLOR.carbos, 'carbos') +
            tarjetaMacroHTML('Grasa', m.grasa, m.kcalG, COLOR.grasa, 'grasa') +
          '</div>' +
        '</div>' +
        '<p class="mini muted">Las equivalencias son una referencia con comida real del catálogo del gimnasio: ' +
          'no tienes que comer exactamente eso, sirve para que dimensiones las cantidades.</p>' +
      '</div>' +
    '</div>';
  }

  function distribucionHTML(perfil, d) {
    if (!perfilCompleto(perfil)) return '';

    var comidas = lista(perfil.comidas);
    if (!comidas.length) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML('No pudimos repartir tus comidas. Revisa el número de comidas elegido.', 'reloj', '') +
      '</div></div>';
    }

    var filas = '', i, c, totalKcal = 0, totalP = 0, totalC = 0, totalG = 0;
    for (i = 0; i < comidas.length; i++) {
      c = comidas[i];
      totalKcal += num(c.kcal);
      totalP += num(c.proteina);
      totalC += num(c.carbos);
      totalG += num(c.grasa);
      filas += '<tr>' +
        '<td>' + esc(c.nombre) + '</td>' +
        '<td class="nums">' + esc(U.fecha(c.hora, 'hora') || c.hora) + '</td>' +
        '<td class="der nums">' + esc(U.num(c.kcal, 0)) + '</td>' +
        '<td class="der nums">' + esc(U.num(c.proteina, 0)) + '</td>' +
        '<td class="der nums">' + esc(U.num(c.carbos, 0)) + '</td>' +
        '<td class="der nums">' + esc(U.num(c.grasa, 0)) + '</td>' +
      '</tr>';
    }

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('reloj', 18) + '<span>Cómo repartir el día</span></div>' +
        '<span class="badge badge-muted">' + esc(String(d.numComidas)) + ' comidas</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="table-wrap scroll-x">' +
          '<table class="table table-compacta">' +
            '<thead><tr>' +
              '<th>Comida</th><th>Hora</th><th class="der">kcal</th>' +
              '<th class="der">P (g)</th><th class="der">C (g)</th><th class="der">G (g)</th>' +
            '</tr></thead>' +
            '<tbody>' + filas + '</tbody>' +
            '<tfoot><tr>' +
              '<td colspan="2">Total del día</td>' +
              '<td class="der nums">' + esc(U.num(totalKcal, 0)) + '</td>' +
              '<td class="der nums">' + esc(U.num(totalP, 0)) + '</td>' +
              '<td class="der nums">' + esc(U.num(totalC, 0)) + '</td>' +
              '<td class="der nums">' + esc(U.num(totalG, 0)) + '</td>' +
            '</tr></tfoot>' +
          '</table>' +
        '</div>' +
        '<p class="mini muted">Las horas son una sugerencia: lo que manda es el total del día.</p>' +
      '</div>' +
    '</div>';
  }

  /* =============================================================
     10. CALCULADORA — menú de ejemplo
     ============================================================= */

  function firmaDe(perfil, d) {
    if (!perfilCompleto(perfil)) return '';
    var m = perfil.macros;
    return [m.proteina, m.carbos, m.grasa, d.numComidas, perfil.objetivo].join('|');
  }

  /* Firma de lo que se ve en la caja del menú: evita repintarla en cada tecla. */
  function firmaCajaMenu(perfil, d) {
    return firmaDe(perfil, d) + '#' + (calc.menu ? calc.menu.length : 0) + '#' + calc.firmaMenu;
  }

  function generarMenu(perfil, d) {
    if (!perfilCompleto(perfil)) return null;
    if (!AG.Mod || !AG.Mod.Nutricion || typeof AG.Mod.Nutricion.generarMenu !== 'function') return null;
    return AG.Mod.Nutricion.generarMenu(perfil.macros, d.numComidas, {
      objetivo: perfil.objetivo,
      semilla: calc.semilla
    });
  }

  function comidaMenuHTML(comida, indice) {
    var alimentos = alimentosDe(comida);
    var total = sumaMacros(alimentos);
    var filas = '', i, a, mac;

    if (!alimentos.length) {
      filas = '<tr><td colspan="6" class="muted">Esta comida quedó vacía: prueba con otra opción.</td></tr>';
    } else {
      for (i = 0; i < alimentos.length; i++) {
        a = alimento(alimentos[i].alimentoId);
        if (!a) {
          filas += '<tr><td colspan="6" class="muted">Alimento fuera del catálogo.</td></tr>';
          continue;
        }
        mac = macrosDe(a.id, alimentos[i].gramos);
        filas += '<tr>' +
          '<td>' + punto(colorCategoria(a.categoria)) + esc(a.nombre) + '</td>' +
          '<td class="der nums">' + esc(U.num(alimentos[i].gramos, 0)) + ' g</td>' +
          '<td class="mini muted">' + esc(a.medidaCasera || '—') + '</td>' +
          '<td class="der nums">' + esc(U.num(mac.kcal, 0)) + '</td>' +
          '<td class="der nums">' + esc(U.num(mac.proteina, 1)) + '</td>' +
          '<td class="der nums">' + esc(U.num(mac.carbos, 1)) + '</td>' +
        '</tr>';
      }
    }

    return '<div class="caja mb-sm">' +
      '<div class="between wrap mb-sm" style="gap:8px">' +
        '<div class="row-sm" style="min-width:0">' + icono('reloj', 15) +
          '<b>' + esc(comida.nombre || ('Comida ' + (indice + 1))) + '</b>' +
          '<span class="mini muted">' + esc(U.fecha(comida.hora, 'hora') || comida.hora || '') + '</span>' +
        '</div>' +
        '<span class="pill">' + esc(U.num(total.kcal, 0)) + ' kcal</span>' +
      '</div>' +
      '<div class="table-wrap scroll-x">' +
        '<table class="table table-compacta">' +
          '<thead><tr><th>Alimento</th><th class="der">Cantidad</th><th>Medida casera</th>' +
            '<th class="der">kcal</th><th class="der">P</th><th class="der">C</th></tr></thead>' +
          '<tbody>' + filas + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  function menuHTML(perfil, d) {
    var completo = perfilCompleto(perfil);

    var acciones = '<div class="row-sm wrap no-imprimir">' +
      '<button type="button" class="btn btn-primary btn-sm" data-generar-menu' + (completo ? '' : ' disabled') + '>' +
        icono('nutricion', 15) + ' Generar menú de ejemplo</button>' +
      (calc.menu
        ? '<button type="button" class="btn btn-outline btn-sm" data-otro-menu>' +
            icono('historial', 15) + ' Otra opción</button>'
        : '') +
    '</div>';

    var cuerpo;
    if (!completo) {
      cuerpo = vacioHTML('Completa tus datos arriba y te armamos un menú con comida de verdad.', 'nutricion', '');
    } else if (!calc.menu) {
      cuerpo = vacioHTML('Todavía no generas un menú. Toca «Generar menú de ejemplo» y verás gramos y medidas caseras.', 'nutricion', '');
    } else {
      var partes = [], i, totalItems = [], als, j;
      for (i = 0; i < calc.menu.length; i++) {
        partes.push(comidaMenuHTML(calc.menu[i], i));
        als = alimentosDe(calc.menu[i]);
        for (j = 0; j < als.length; j++) totalItems.push(als[j]);
      }
      var total = sumaMacros(totalItems);
      var m = perfil.macros;

      var desfase = (firmaDe(perfil, d) !== calc.firmaMenu)
        ? '<div class="aviso aviso-warn">' + icono('alerta', 18) +
          '<div><b>Cambiaste tus datos.</b><div class="mini">Este menú es el de antes: genera otro para que cuadre con tus macros nuevos.</div></div></div>'
        : '';

      cuerpo = desfase + partes.join('') +
        '<div class="caja">' +
          '<b class="mb-sm" style="display:block">Totales del menú contra tu objetivo</b>' +
          '<div class="snu-macros">' +
            barraHTML('Calorías', total.kcal, m.kcal, 'kcal', 0) +
            barraHTML('Proteína', total.proteina, m.proteina, 'g', 0) +
            barraHTML('Carbohidratos', total.carbos, m.carbos, 'g', 0) +
            barraHTML('Grasa', total.grasa, m.grasa, 'g', 0) +
          '</div>' +
          '<p class="mini muted mt-sm">Fibra del menú: <b>' + esc(U.num(total.fibra, 1)) + ' g</b>. ' +
            'Los pesos son en crudo o tal como aparecen en el catálogo.</p>' +
        '</div>';
    }

    return '<div class="card-head">' +
        '<div class="card-title">' + icono('nutricion', 18) + '<span>Menú de ejemplo</span></div>' +
        acciones +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>';
  }

  /* =============================================================
     11. CALCULADORA — explorador de alimentos
     ============================================================= */

  function resultadosExplorador() {
    if (!Data || typeof Data.alimentosPor !== 'function') return [];
    return Data.alimentosPor({
      texto: explorador.texto,
      categoria: explorador.categoria || undefined
    });
  }

  function listaExploradorHTML() {
    var resultados = resultadosExplorador();
    if (!resultados.length) {
      return vacioHTML('No encontramos alimentos con esa búsqueda. Prueba con otro nombre o quita el filtro de categoría.', 'buscar', '');
    }

    var tope = Math.min(resultados.length, 60);
    var html = '<div class="list">', i, a;

    for (i = 0; i < tope; i++) {
      a = resultados[i];
      html += '<div class="list-item">' +
        '<div class="list-item-main">' +
          '<div class="snu-al">' +
            '<b>' + punto(colorCategoria(a.categoria)) + esc(a.nombre) + '</b>' +
            '<span>' + esc(U.num(a.kcal, 0)) + ' kcal · P ' + esc(U.num(a.proteina, 1)) +
              ' · C ' + esc(U.num(a.carbos, 1)) + ' · G ' + esc(U.num(a.grasa, 1)) +
              ' por 100 ' + esc(a.unidad || 'g') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="list-item-side">' +
          '<button type="button" class="btn btn-outline btn-sm" data-porcion-al="' + esc(a.id) + '">' +
            icono('calculadora', 15) + ' Calcular</button>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';

    if (resultados.length > tope) {
      html += '<p class="mini muted mt-sm">Mostrando ' + tope + ' de ' + resultados.length +
        ' alimentos. Afina la búsqueda para ver el resto.</p>';
    }
    return html;
  }

  function porcionHTML() {
    var a = alimento(explorador.alimentoId);
    if (!a) {
      return '<div class="caja">' +
        vacioHTML('Elige un alimento de la lista y calculamos cuánto aporta la porción que tú quieras.', 'calculadora', '') +
      '</div>';
    }

    var gramos = acotar(explorador.gramos, 1, 2000);
    var mac = macrosDe(a.id, gramos);

    return '<div class="caja">' +
      '<div class="row-sm mb-sm" style="min-width:0">' + punto(colorCategoria(a.categoria)) +
        '<b>' + esc(a.nombre) + '</b>' +
        '<span class="badge badge-muted">' + esc(nombreCategoria(a.categoria)) + '</span>' +
      '</div>' +
      '<p class="mini muted" style="margin:0 0 10px">' + esc(a.medidaCasera || 'Sin medida casera de referencia') + '</p>' +
      '<div class="field">' +
        '<label class="label" for="snu-gramos">Porción en ' + esc(a.unidad || 'g') + '</label>' +
        '<input class="input" id="snu-gramos" type="number" min="1" max="2000" step="1" inputmode="numeric" ' +
          'data-gramos-porcion value="' + esc(gramos) + '">' +
      '</div>' +
      '<div class="datos-grid mt-sm">' +
        dato('Calorías', esc(U.num(mac.kcal, 0)) + ' <span class="mini muted">kcal</span>') +
        dato('Proteína', esc(U.num(mac.proteina, 1)) + ' <span class="mini muted">g</span>') +
        dato('Carbohidratos', esc(U.num(mac.carbos, 1)) + ' <span class="mini muted">g</span>') +
        dato('Grasa', esc(U.num(mac.grasa, 1)) + ' <span class="mini muted">g</span>') +
        dato('Fibra', esc(U.num(mac.fibra, 1)) + ' <span class="mini muted">g</span>') +
      '</div>' +
    '</div>';
  }

  function chipsExploradorHTML() {
    var cats = categorias();
    var html = '<div class="chips">' +
      '<button type="button" class="chip chip-sm' + (explorador.categoria ? '' : ' on') + '" data-cat-al="">Todas</button>';
    for (var i = 0; i < cats.length; i++) {
      html += '<button type="button" class="chip chip-sm' + (explorador.categoria === cats[i].id ? ' on' : '') +
        '" data-cat-al="' + esc(cats[i].id) + '">' + punto(cats[i].color) + esc(cats[i].nombre) + '</button>';
    }
    return html + '</div>';
  }

  function exploradorHTML() {
    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('buscar', 18) + '<span>Explorador de alimentos</span></div>' +
        '<span class="card-sub">Valores por 100 g o 100 ml</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="field">' +
          '<input class="input" type="search" data-buscar-al autocomplete="off" ' +
            'placeholder="Buscar alimento (pollo, avena, aguacate…)" aria-label="Buscar alimento" ' +
            'value="' + esc(explorador.texto) + '">' +
        '</div>' +
        '<div data-chips-al>' + chipsExploradorHTML() + '</div>' +
        '<div class="grid g2">' +
          '<div class="snu-scroll" data-lista-al>' + listaExploradorHTML() + '</div>' +
          '<div data-porcion-caja>' + porcionHTML() + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* =============================================================
     12. CALCULADORA — pantalla completa
     ============================================================= */

  function renderCalculadora(ctx) {
    asegurarEstilos();

    var socio = socioDe(ctx);
    if (!socio) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('Esta sección es solo para socios. Vuelve a entrar con tu cuenta.', 'candado', '') +
      '</div></div></div>';
    }

    var d = prepararCalculadora(socio);
    var perfil = perfilDe(d);

    var html = '<div class="page" data-calculadora>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('calculadora', 24) + '<span>Calculadora de comidas</span></h1>' +
          '<p class="page-sub">Tus datos ya vienen cargados. Cambia lo que quieras: el resultado se recalcula al instante.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-outline" data-imprimir-calc>' +
            icono('imprimir', 16) + ' Imprimir</button>' +
          '<button type="button" class="btn btn-primary" data-guardar-plan>' +
            icono('check', 16) + ' Guardar como mi plan</button>' +
        '</div>' +
      '</div>' +

      '<div class="grid g2">' +
        '<div class="card">' +
          '<div class="card-head">' +
            '<div class="card-title">' + icono('usuario', 18) + '<span>Tus datos</span></div>' +
          '</div>' +
          '<div class="card-body">' + formularioHTML(d, socio) + '</div>' +
        '</div>' +
        '<div data-resumen>' + resumenHTML(perfil, d) + '</div>' +
      '</div>' +

      '<div data-macros>' + macrosHTML(perfil) + '</div>' +
      '<div data-distribucion>' + distribucionHTML(perfil, d) + '</div>' +
      '<div class="card" data-menu>' + menuHTML(perfil, d) + '</div>' +
      exploradorHTML() +
    '</div>';

    calc.firmaPintada = firmaCajaMenu(perfil, d);

    return {
      html: html,
      listo: function (root) { engancharCalculadora(root, socio); }
    };
  }

  /* Repinta solo los bloques calculados (el formulario nunca pierde el foco). */
  function pintarResultado(raiz) {
    var d = calc.datos;
    var perfil = perfilDe(d);
    var caja;

    caja = raiz.querySelector('[data-resumen]');
    if (caja) caja.innerHTML = resumenHTML(perfil, d);

    caja = raiz.querySelector('[data-macros]');
    if (caja) caja.innerHTML = macrosHTML(perfil);

    caja = raiz.querySelector('[data-distribucion]');
    if (caja) caja.innerHTML = distribucionHTML(perfil, d);

    var firma = firmaCajaMenu(perfil, d);
    if (firma !== calc.firmaPintada) {
      caja = raiz.querySelector('[data-menu]');
      if (caja) {
        caja.innerHTML = menuHTML(perfil, d);
        calc.firmaPintada = firma;
      }
    }

    actualizarRitmos(raiz, perfil, d);
  }

  /* Escribe el ritmo esperado dentro de cada tarjeta de agresividad. */
  function actualizarRitmos(raiz, perfil, d) {
    var nodos = U.$$('[data-ritmo]', raiz), i, clave, kg;
    for (i = 0; i < nodos.length; i++) {
      clave = nodos[i].getAttribute('data-ritmo');
      kg = (perfil && perfil.tdee !== null)
        ? ritmoSemanal(perfil.tdee, d.objetivo, clave, perfil.tmb)
        : null;
      nodos[i].textContent = textoRitmo(kg);
    }
  }

  /* Marca visualmente la tarjeta elegida (respaldo para navegadores sin :has). */
  function marcarRadioCards(raiz, nombre) {
    var entradas = U.$$('input[name="' + nombre + '"]', raiz), i, tarjeta;
    for (i = 0; i < entradas.length; i++) {
      tarjeta = entradas[i].closest ? entradas[i].closest('.radio-card') : null;
      if (tarjeta) tarjeta.classList.toggle('activo', entradas[i].checked);
    }
  }

  function leerFormulario(raiz) {
    var form = raiz.querySelector('[data-form-calc]');
    if (!form) return calc.datos;
    return normalizarDatos(U.formToObject(form), calc.datos);
  }

  function engancharCalculadora(root, socio) {
    var raiz = root.querySelector('[data-calculadora]');
    if (!raiz) return;
    asegurarEstilos();

    actualizarRitmos(raiz, perfilDe(calc.datos), calc.datos);

    /* ---- Formulario en vivo ---- */
    function recalcular() {
      calc.datos = leerFormulario(raiz);
      pintarResultado(raiz);
    }

    /* La calculadora nunca envía el formulario: todo pasa en vivo. */
    U.delegar(raiz, 'submit', '[data-form-calc]', function (e) {
      e.preventDefault();
    });

    U.delegar(raiz, 'input', '[data-form-calc] input, [data-form-calc] select', function () {
      recalcular();
    });

    U.delegar(raiz, 'change', '[data-form-calc] input, [data-form-calc] select', function (e, el) {
      if (el.type === 'radio') marcarRadioCards(raiz, el.name);
      recalcular();
    });

    /* ---- Menú de ejemplo ---- */
    U.delegar(raiz, 'click', '[data-generar-menu]', function (e) {
      e.preventDefault();
      rehacerMenu(raiz, false);
    });

    U.delegar(raiz, 'click', '[data-otro-menu]', function (e) {
      e.preventDefault();
      rehacerMenu(raiz, true);
    });

    /* ---- Acciones finales ---- */
    U.delegar(raiz, 'click', '[data-guardar-plan]', function (e) {
      e.preventDefault();
      guardarComoPlan(socio, raiz);
    });

    U.delegar(raiz, 'click', '[data-imprimir-calc]', function (e) {
      e.preventDefault();
      imprimirCalculo(socio);
    });

    /* ---- Explorador de alimentos ---- */
    var buscarDebounce = U.debounce(function () {
      var caja = raiz.querySelector('[data-lista-al]');
      if (caja) caja.innerHTML = listaExploradorHTML();
    }, 220);

    U.delegar(raiz, 'input', '[data-buscar-al]', function (e, el) {
      explorador.texto = el.value || '';
      buscarDebounce();
    });

    U.delegar(raiz, 'click', '[data-cat-al]', function (e, el) {
      e.preventDefault();
      explorador.categoria = el.getAttribute('data-cat-al') || '';
      var chips = U.$$('[data-cat-al]', raiz), i;
      for (i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('on', (chips[i].getAttribute('data-cat-al') || '') === explorador.categoria);
      }
      var caja = raiz.querySelector('[data-lista-al]');
      if (caja) caja.innerHTML = listaExploradorHTML();
    });

    U.delegar(raiz, 'click', '[data-porcion-al]', function (e, el) {
      e.preventDefault();
      var a = alimento(el.getAttribute('data-porcion-al'));
      if (!a) { toast('Ese alimento ya no está en el catálogo.', 'error'); return; }
      explorador.alimentoId = a.id;
      if (!(explorador.gramos > 0)) explorador.gramos = 100;
      var caja = raiz.querySelector('[data-porcion-caja]');
      if (caja) caja.innerHTML = porcionHTML();
    });

    U.delegar(raiz, 'input', '[data-gramos-porcion]', function (e, el) {
      var g = n0(el.value);
      explorador.gramos = (g !== null && g > 0) ? Math.min(2000, g) : 0;
      var a = alimento(explorador.alimentoId);
      if (!a) return;
      var mac = macrosDe(a.id, explorador.gramos);
      var valores = U.$$('[data-porcion-caja] .dato-val', raiz);
      if (valores.length >= 5) {
        valores[0].innerHTML = esc(U.num(mac.kcal, 0)) + ' <span class="mini muted">kcal</span>';
        valores[1].innerHTML = esc(U.num(mac.proteina, 1)) + ' <span class="mini muted">g</span>';
        valores[2].innerHTML = esc(U.num(mac.carbos, 1)) + ' <span class="mini muted">g</span>';
        valores[3].innerHTML = esc(U.num(mac.grasa, 1)) + ' <span class="mini muted">g</span>';
        valores[4].innerHTML = esc(U.num(mac.fibra, 1)) + ' <span class="mini muted">g</span>';
      }
    });
  }

  function rehacerMenu(raiz, variar) {
    calc.datos = leerFormulario(raiz);
    var perfil = perfilDe(calc.datos);

    if (!perfilCompleto(perfil)) {
      toast('Primero completa tu peso, estatura y edad.', 'warn');
      return;
    }

    if (variar) calc.semilla = (calc.semilla + 1) % 1000;
    var menu = generarMenu(perfil, calc.datos);

    if (!menu || !menu.length) {
      toast('No pudimos armar el menú en este momento.', 'error');
      return;
    }

    calc.menu = menu;
    calc.firmaMenu = firmaDe(perfil, calc.datos);

    var caja = raiz.querySelector('[data-menu]');
    if (caja) caja.innerHTML = menuHTML(perfil, calc.datos);
    calc.firmaPintada = firmaCajaMenu(perfil, calc.datos);

    toast(variar ? 'Menú nuevo, mismas calorías.' : 'Menú de ejemplo listo.', 'ok');
  }

  /* =============================================================
     13. Guardar el plan e imprimir
     ============================================================= */

  function guardarComoPlan(socio, raiz) {
    calc.datos = leerFormulario(raiz);
    var d = calc.datos;
    var perfil = perfilDe(d);

    if (!perfilCompleto(perfil)) {
      toast('Completa tu peso, estatura y edad antes de guardar.', 'warn');
      return;
    }

    var menu = calc.menu;
    if (!menu || firmaDe(perfil, d) !== calc.firmaMenu) {
      menu = generarMenu(perfil, d);
      if (menu && menu.length) {
        calc.menu = menu;
        calc.firmaMenu = firmaDe(perfil, d);
      }
    }
    if (!menu || !menu.length) {
      toast('No pudimos armar las comidas del plan. Genera un menú y vuelve a intentar.', 'error');
      return;
    }

    var previos = AG.DB.donde('planesNutricion', function (p) {
      return p && p.socioId === socio.id && p.activo !== false;
    });

    var mensaje = previos.length
      ? 'Se guardará este plan como el tuyo y se desactivará el anterior. ¿Continuamos?'
      : '¿Guardamos este cálculo como tu plan de nutrición?';

    U.confirmar(mensaje, 'Guardar mi plan').then(function (ok) {
      if (!ok) return;

      var i;
      for (i = 0; i < previos.length; i++) {
        AG.DB.actualizar('planesNutricion', previos[i].id, { activo: false });
      }

      var comidas = [], j, als, k;
      for (j = 0; j < menu.length; j++) {
        als = [];
        var origen = alimentosDe(menu[j]);
        for (k = 0; k < origen.length; k++) {
          als.push({ alimentoId: origen[k].alimentoId, gramos: Math.round(num(origen[k].gramos)) });
        }
        comidas.push({ nombre: menu[j].nombre, hora: menu[j].hora, alimentos: als });
      }

      var hoy = U.hoy();
      var plan = AG.DB.insertar('planesNutricion', {
        socioId: socio.id,
        coachId: socio.coachId || null,
        creado: hoy,
        actualizado: hoy,
        objetivo: perfil.objetivo,
        kcal: perfil.kcal,
        proteina: perfil.macros.proteina,
        carbos: perfil.macros.carbos,
        grasa: perfil.macros.grasa,
        agua: perfil.agua,
        comidas: comidas,
        notas: 'Plan calculado por el socio el ' + U.fecha(hoy, 'corto') + '. ' +
          'Objetivo: ' + nombreObjetivo(perfil.objetivo).toLowerCase() + ', ritmo ' + d.agresividad +
          ', ' + d.numComidas + ' comidas al día. Pídele a tu coach que lo revise.',
        activo: true
      });

      if (!plan) {
        toast('No pudimos guardar tu plan. Intenta de nuevo.', 'error');
        return;
      }

      toast('Plan guardado. Ya lo puedes ver en «Mi nutrición».', 'ok');
      AG.Router.ir('socio/nutricion');
    });
  }

  function imprimirCalculo(socio) {
    var d = calc.datos;
    var perfil = perfilDe(d);

    if (!perfilCompleto(perfil)) {
      toast('Completa tus datos antes de imprimir.', 'warn');
      return;
    }

    var menuBloque = '';
    if (calc.menu && calc.menu.length) {
      var partes = [], i;
      for (i = 0; i < calc.menu.length; i++) partes.push(comidaMenuHTML(calc.menu[i], i));
      menuBloque = '<h3>Menú de ejemplo</h3>' + partes.join('');
    }

    var contenido =
      '<p class="mini">' + esc(U.nombreCompleto(socio)) + ' · ' + esc(socio.codigo || '') +
        ' · ' + esc(U.fecha(U.hoy(), 'largo')) + '</p>' +
      resumenHTML(perfil, d) +
      macrosHTML(perfil) +
      distribucionHTML(perfil, d) +
      menuBloque;

    U.imprimir(contenido, 'Mi cálculo de comidas');
  }

  /* =============================================================
     14. Exposición y registro de rutas
     ============================================================= */

  AG.Views.SocioNutricion = {
    render: renderNutricion,
    renderNutricion: renderNutricion,
    renderCalculadora: renderCalculadora,
    fraseMacro: fraseMacro
  };

  AG.Router.registrar({
    path: 'socio/nutricion',
    roles: ['socio'],
    titulo: 'Mi nutrición',
    nav: { etiqueta: 'Mi nutrición', icono: 'manzana', grupo: 'Mi entrenamiento', orden: 3 },
    render: renderNutricion
  });

  AG.Router.registrar({
    path: 'socio/calculadora',
    roles: ['socio'],
    titulo: 'Calculadora de comidas',
    nav: { etiqueta: 'Calculadora', icono: 'calculadora', grupo: 'Mi entrenamiento', orden: 4 },
    render: renderCalculadora
  });

})(window.AG);
