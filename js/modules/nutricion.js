/* =============================================================
   ALLIANCE GYM — AG.Mod.Nutricion
   -------------------------------------------------------------
   Planes alimenticios del gimnasio. Dos pestañas:
     · Planes    — quién tiene plan activo y quién no (el coach
                   solo ve a sus socios).
     · Alimentos — explorador del catálogo AG.Data.foods con
                   buscador, categorías, tabla ordenable,
                   calculadora de porción y rankings por macro.

   Rutas: 'director/nutricion' y 'coach/nutricion'.

   API compartida (la usan otras pantallas y las vistas del socio):
     AG.Mod.Nutricion.editorPlan(socioId, planId)  -> asistente de 3 pasos
     AG.Mod.Nutricion.planHTML(plan, opts)         -> string HTML del plan
     AG.Mod.Nutricion.generarMenu(macros, n, opts) -> array de comidas (función pura)
     AG.Mod.Nutricion.engancharAcciones(raiz)      -> activa Imprimir / Lista de compras

   Reglas: JavaScript clásico, sin módulos, todo escapado con
   AG.Utils.esc(), nada de alert/confirm/prompt, nada de
   localStorage directo y ningún listado sin su estado vacío.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;
  var Icons = AG.Icons;
  var Data = AG.Data || {};

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  var OBJETIVOS = [
    { id: 'definir', nombre: 'Definir', desc: 'Déficit calórico para bajar grasa', icono: 'fuego' },
    { id: 'volumen', nombre: 'Volumen', desc: 'Superávit para ganar músculo', icono: 'pesa' },
    { id: 'mantener', nombre: 'Mantener', desc: 'Sostener el peso y recomponer', icono: 'balanza' }
  ];

  var AGRESIVIDADES = [
    { id: 'suave', nombre: 'Suave', desc: 'Cambio lento y muy sostenible' },
    { id: 'moderada', nombre: 'Moderada', desc: 'El ritmo que recomendamos' },
    { id: 'agresiva', nombre: 'Agresiva', desc: 'Cambio rápido, exige disciplina' }
  ];

  var NIVELES_ACTIVIDAD = ['sedentario', 'ligero', 'moderado', 'alto', 'atleta'];

  /* Color de cada macro (mismo criterio que las categorías del catálogo). */
  var COLOR = {
    proteina: '#e4322b',
    carbos: '#f0a03c',
    grasa: '#f2c94c',
    agua: '#38c6d9'
  };

  /* Columnas ordenables del explorador de alimentos. */
  var COLUMNAS = [
    { clave: 'nombre', etiqueta: 'Alimento', num: false },
    { clave: 'kcal', etiqueta: 'kcal', num: true },
    { clave: 'proteina', etiqueta: 'Proteína', num: true },
    { clave: 'carbos', etiqueta: 'Carbos', num: true },
    { clave: 'grasa', etiqueta: 'Grasa', num: true },
    { clave: 'fibra', etiqueta: 'Fibra', num: true }
  ];

  var MACROS_RANKING = [
    { clave: 'proteina', etiqueta: 'Proteína', color: COLOR.proteina },
    { clave: 'carbos', etiqueta: 'Carbohidratos', color: COLOR.carbos },
    { clave: 'grasa', etiqueta: 'Grasa', color: COLOR.grasa }
  ];

  /* -------------------------------------------------------------
     Bancos de alimentos REALES del catálogo, por papel en la comida.
     Se usan en generarMenu(): nada de placeholders.
     ------------------------------------------------------------- */
  var POOL = {
    protDesayuno: ['al_huevo_entero', 'al_clara_huevo', 'al_yogur_griego', 'al_requeson',
      'al_queso_cottage', 'al_pechuga_pavo', 'al_jamon_pavo', 'al_queso_panela', 'al_whey'],
    protFuerte: ['al_pechuga_pollo', 'al_pechuga_pavo', 'al_tilapia', 'al_atun_agua',
      'al_bistec_res', 'al_lomo_cerdo', 'al_salmon', 'al_camaron', 'al_molida_res_90',
      'al_arrachera', 'al_pescado_basa', 'al_muslo_pollo', 'al_tofu'],
    protLigera: ['al_yogur_griego', 'al_queso_panela', 'al_atun_agua', 'al_requeson',
      'al_whey', 'al_queso_cottage', 'al_pechuga_pavo'],
    protNoche: ['al_requeson', 'al_queso_cottage', 'al_yogur_griego', 'al_caseina', 'al_queso_panela'],

    carboDesayuno: ['al_avena', 'al_pan_integral', 'al_tortilla_maiz', 'al_amaranto',
      'al_pan_pita', 'al_papa_cocida'],
    carboFuerte: ['al_arroz_integral', 'al_tortilla_maiz', 'al_camote', 'al_papa_cocida',
      'al_frijol_negro', 'al_lenteja', 'al_quinoa', 'al_espagueti_integral', 'al_garbanzo',
      'al_elote', 'al_arroz_blanco', 'al_pasta_cocida'],
    carboRapido: ['al_platano', 'al_arroz_blanco', 'al_tortilla_maiz', 'al_avena',
      'al_mango', 'al_papa_cocida'],

    grasa: ['al_aguacate', 'al_almendra', 'al_aceite_oliva', 'al_nuez', 'al_crema_cacahuate',
      'al_chia', 'al_pepita_calabaza', 'al_cacahuate', 'al_pistache', 'al_linaza',
      'al_ajonjoli', 'al_nuez_india'],

    verdura: ['al_brocoli', 'al_calabacita', 'al_espinaca', 'al_nopal', 'al_ejote',
      'al_chayote', 'al_champinon', 'al_pimiento', 'al_zanahoria', 'al_coliflor',
      'al_esparrago', 'al_jitomate', 'al_lechuga', 'al_col'],

    fruta: ['al_platano', 'al_manzana', 'al_papaya', 'al_fresa', 'al_mango', 'al_pina',
      'al_guayaba', 'al_naranja', 'al_kiwi', 'al_arandano', 'al_melon', 'al_pera']
  };

  /* Gramajes razonables por alimento (mínimo y máximo de una porción). */
  var LIMITES = {
    al_aceite_oliva: [3, 25], al_aceite_canola: [3, 25], al_mantequilla: [3, 25],
    al_crema_cacahuate: [8, 45], al_chia: [8, 35], al_linaza: [8, 35], al_ajonjoli: [5, 30],
    al_almendra: [10, 60], al_nuez: [10, 55], al_cacahuate: [10, 60], al_pistache: [10, 55],
    al_nuez_india: [10, 55], al_pepita_calabaza: [8, 45], al_aguacate: [25, 140],
    al_coco_rallado: [8, 40], al_aceituna: [15, 70],
    al_whey: [15, 70], al_caseina: [15, 70], al_proteina_aislada: [15, 70],
    al_clara_huevo: [60, 320], al_huevo_entero: [50, 220], al_yema_huevo: [15, 70],
    al_tortilla_maiz: [25, 180], al_tostada_maiz: [15, 80], al_pan_integral: [25, 140],
    al_pan_blanco: [25, 140], al_pan_pita: [30, 150], al_bolillo: [30, 150],
    al_avena: [25, 140], al_amaranto: [15, 70], al_granola: [20, 90],
    al_arroz_blanco: [60, 380], al_arroz_integral: [60, 380], al_pasta_cocida: [60, 350],
    al_espagueti_integral: [60, 350], al_quinoa: [60, 320], al_cuscus: [60, 300],
    al_papa_cocida: [80, 400], al_camote: [70, 350], al_elote: [60, 260],
    al_frijol_negro: [60, 320], al_frijol_bayo: [60, 320], al_lenteja: [60, 320],
    al_garbanzo: [60, 300], al_platano_macho: [60, 260]
  };

  var LIMITES_CATEGORIA = {
    proteina: [50, 320], carbohidrato: [30, 320], grasa: [8, 60], verdura: [60, 300],
    fruta: [60, 300], lacteo: [80, 400], bebida: [100, 500], suplemento: [15, 70],
    snack: [15, 90], preparado: [100, 450]
  };

  /* Porción que se propone al agregar un alimento a mano. */
  var PORCION_SUGERIDA = {
    proteina: 120, carbohidrato: 80, grasa: 15, verdura: 150, fruta: 120,
    lacteo: 200, bebida: 250, suplemento: 30, snack: 30, preparado: 200
  };

  /* Estado vivo de la pantalla (sobrevive a los repintados del router). */
  var estado = {
    tab: 'planes',
    busqueda: '',
    objetivo: '',
    coachFiltro: '',
    busquedaAl: '',
    categoria: '',
    orden: 'nombre',
    dir: 'asc',
    macroRanking: 'proteina',
    calcAlimento: '',
    calcGramos: 100
  };

  /* Estado vivo del asistente (un solo editor abierto a la vez). */
  var editor = null;

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

  /* Número finito o null (nunca NaN, nunca cadena vacía). */
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

  /* Número siempre utilizable (0 si no es válido). */
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

  function red1(v) { return Math.round(num(v) * 10) / 10; }

  function normalizar(t) {
    if (Data && typeof Data.normalizarTexto === 'function') return Data.normalizarTexto(t);
    return U.normalizar(t);
  }

  function alimento(id) {
    if (!Data || typeof Data.alimento !== 'function') return null;
    return Data.alimento(id);
  }

  function catalogo() {
    return lista(Data ? Data.foods : null);
  }

  function categorias() {
    return lista(Data ? Data.CATEGORIAS_ALIMENTO : null);
  }

  function nombreCategoria(id) {
    var cats = categorias();
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === id) return cats[i].nombre;
    }
    return id || 'Sin categoría';
  }

  function colorCategoria(id) {
    var cats = categorias();
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === id) return cats[i].color;
    }
    return '#8d9aa8';
  }

  function macrosDe(alimentoId, gramos) {
    if (Data && typeof Data.macrosDe === 'function') return Data.macrosDe(alimentoId, gramos);
    return { kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0 };
  }

  function sumaMacros(items) {
    if (Data && typeof Data.sumaMacros === 'function') return Data.sumaMacros(items);
    return { kcal: 0, proteina: 0, carbos: 0, grasa: 0, fibra: 0 };
  }

  function usuarioActual() {
    if (AG.Auth && typeof AG.Auth.actual === 'function') {
      try { return AG.Auth.actual(); } catch (e) { return null; }
    }
    return null;
  }

  function puedeVer(usuario, socioId) {
    if (AG.Auth && typeof AG.Auth.puedeVer === 'function') {
      try { return AG.Auth.puedeVer(usuario, socioId); } catch (e) { return false; }
    }
    return false;
  }

  function puedeEditar(usuario) {
    return !!usuario && (usuario.rol === 'coach' || usuario.rol === 'director');
  }

  /* Socios que el usuario tiene derecho a ver: el coach solo los suyos. */
  function sociosVisibles(usuario) {
    if (!usuario) return [];
    if (usuario.rol === 'director') return AG.DB.socios();
    if (usuario.rol === 'coach') return AG.DB.sociosDe(usuario.id);
    if (usuario.rol === 'socio') {
      var yo = AG.DB.usuario(usuario.id);
      return yo ? [yo] : [];
    }
    return [];
  }

  /* Los socios dados de baja no entran al tablero de nutrición. */
  function esPlaneable(socio) {
    return !!socio && socio.activo !== false && socio.estado !== 'baja';
  }

  function nombreObjetivo(id) {
    for (var i = 0; i < OBJETIVOS.length; i++) {
      if (OBJETIVOS[i].id === id) return OBJETIVOS[i].nombre;
    }
    return 'Sin objetivo';
  }

  function iconoObjetivo(id) {
    for (var i = 0; i < OBJETIVOS.length; i++) {
      if (OBJETIVOS[i].id === id) return OBJETIVOS[i].icono;
    }
    return 'meta';
  }

  function claseObjetivo(id) {
    if (id === 'definir') return 'badge-rojo';
    if (id === 'volumen') return 'badge-info';
    return 'badge-muted';
  }

  function objetivoNutricional(valor) {
    if (Calc && typeof Calc.objetivoNutricional === 'function') return Calc.objetivoNutricional(valor);
    if (valor === 'definir' || valor === 'volumen' || valor === 'mantener') return valor;
    if (valor === 'perder_grasa') return 'definir';
    if (valor === 'ganar_musculo') return 'volumen';
    return 'mantener';
  }

  function etiquetaActividad(nivel) {
    var mapa = (Calc && Calc.ETIQUETA_ACTIVIDAD) ? Calc.ETIQUETA_ACTIVIDAD : {};
    return mapa[nivel] || nivel;
  }

  /* Objetivo del socio tal cual lo trae su ficha ('Perder grasa', 'Rendimiento'…). */
  function etiquetaObjetivoSocio(objetivo) {
    var mapa = (Calc && Calc.ETIQUETA_OBJETIVO) ? Calc.ETIQUETA_OBJETIVO : {};
    return mapa[objetivo] || 'Sin objetivo definido';
  }

  /* Clase de color según qué tan lejos está el total del objetivo. */
  function claseDesvio(actual, objetivo) {
    if (!(num(objetivo) > 0)) return '';
    var d = Math.abs(num(actual) - num(objetivo)) / num(objetivo) * 100;
    if (d <= 7) return 'ok';
    if (d <= 15) return 'warn';
    return 'error';
  }

  function anchoBarra(actual, objetivo) {
    if (!(num(objetivo) > 0)) return 0;
    return acotar(num(actual) / num(objetivo) * 100, 0, 100);
  }

  function vacioHTML(mensaje, iconoNombre, botonHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(iconoNombre || 'nutricion', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (botonHTML || '') +
    '</div>';
  }

  function personaHTML(socio) {
    return '<div class="persona">' + U.avatar(socio, 'sm') +
      '<div class="persona-txt">' +
        '<b>' + esc(U.nombreCompleto(socio)) + '</b>' +
        '<span>' + esc(socio.codigo || 'Sin código') + '</span>' +
      '</div>' +
    '</div>';
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

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-nutricion';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Indicador de pasos del asistente */
      '.nu-pasos{display:flex;gap:8px;margin-bottom:14px}' +
      '.nu-paso{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:9px;padding:9px 11px;' +
        'border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);' +
        'color:var(--texto-3);font-size:12px;line-height:1.25}' +
      '.nu-paso .nu-num{width:23px;height:23px;border-radius:50%;background:var(--borde);' +
        'color:var(--texto-2);display:inline-flex;align-items:center;justify-content:center;' +
        'font-size:11.5px;font-weight:800;flex:0 0 auto}' +
      '.nu-paso b{color:var(--texto-2);font-size:12.5px;font-weight:700;display:block}' +
      '.nu-paso small{display:block;color:var(--texto-3);font-size:11px}' +
      '.nu-paso.activo{border-color:var(--rojo);background:var(--rojo-bg);color:var(--texto)}' +
      '.nu-paso.activo b{color:var(--texto)}' +
      '.nu-paso.activo .nu-num{background:var(--rojo);color:#fff}' +
      '.nu-paso.hecho .nu-num{background:var(--ok);color:#fff}' +
      /* Tarjeta de comida */
      '.nu-comida{border:1px solid var(--borde);border-radius:var(--radio-sm);' +
        'background:var(--panel-2);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}' +
      '.nu-comida-head{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}' +
      '.nu-comida-head .field{margin:0}' +
      '.nu-alimento{display:grid;grid-template-columns:minmax(0,1fr) 96px 36px;gap:8px;align-items:center}' +
      '.nu-al-txt{min-width:0}' +
      '.nu-al-txt b{display:block;font-size:13px;font-weight:700;color:var(--texto);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.nu-al-txt span{display:block;font-size:11px;color:var(--texto-3);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.nu-punto{display:inline-block;width:8px;height:8px;border-radius:50%;' +
        'margin-right:6px;flex:0 0 auto;vertical-align:middle}' +
      /* Barras de objetivo */
      '.nu-barras{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}' +
      '.nu-plan{display:flex;flex-direction:column;gap:14px;min-width:0}' +
      '.nu-comidas{display:flex;flex-direction:column;gap:12px}' +
      '.nu-rank{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}' +
      '.nu-tot{font-variant-numeric:tabular-nums}' +
      '@media (max-width:640px){' +
        '.nu-paso small{display:none}' +
        '.nu-paso{padding:8px 9px}' +
        '.nu-paso b{font-size:11.5px}' +
      '}' +
      '@media (max-width:420px){' +
        '.nu-alimento{grid-template-columns:minmax(0,1fr) 78px 32px;gap:6px}' +
        '.nu-paso b{display:none}' +
        '.nu-paso{justify-content:center;flex:0 0 auto;padding:7px 10px}' +
      '}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. generarMenu — función PURA que arma comidas de verdad
     ============================================================= */

  /* Límites de gramaje del alimento (por id, o por categoría). */
  function limitesDe(a) {
    if (!a) return [10, 200];
    if (LIMITES[a.id]) return LIMITES[a.id];
    return LIMITES_CATEGORIA[a.categoria] || [15, 250];
  }

  /*
     Márgenes con los que el afinado puede estirar o encoger una porción.
     Son más amplios que la porción "de catálogo": un plan de volumen pide
     platos grandes y uno de definición porciones muy pequeñas de grasa.
  */
  function limitesAjuste(a) {
    var lim = limitesDe(a);
    return [Math.max(3, lim[0] * 0.35), lim[1] * 1.35];
  }

  /* Gramos de macro que aporta 1 gramo del alimento. */
  function densidad(a, macro) {
    if (!a) return 0;
    var base = num(a.porcion) > 0 ? num(a.porcion) : 100;
    var campo = macro === 'carbos' ? 'carbos' : macro;
    return num(a[campo]) / base;
  }

  /*
     Depura un banco de alimentos según el objetivo:
     al definir se prefieren proteínas magras y carbohidratos con
     fibra; al hacer volumen se descartan las opciones demasiado
     ligeras para no llenar el plato sin aportar energía.
  */
  function filtrarPool(ids, papel, objetivo) {
    var salida = [], i, a;
    for (i = 0; i < ids.length; i++) {
      a = alimento(ids[i]);
      if (!a) continue;
      if (papel === 'proteina') {
        if (objetivo === 'definir' && num(a.grasa) > 9) continue;
        if (objetivo === 'volumen' && num(a.kcal) < 90) continue;
      }
      if (papel === 'carbo' && objetivo === 'definir') {
        if (num(a.fibra) < 1 && num(a.carbos) > 40) continue;   /* harinas muy refinadas */
      }
      salida.push(a.id);
    }
    if (!salida.length) {
      for (i = 0; i < ids.length; i++) {
        if (alimento(ids[i])) salida.push(ids[i]);
      }
    }
    return salida;
  }

  /* Elige del banco evitando repetir en el día cuando se puede. */
  function elegirDe(ids, desplazamiento, usados) {
    if (!ids.length) return null;
    var inicio = Math.abs(Math.floor(num(desplazamiento))) % ids.length;
    var i, id;
    for (i = 0; i < ids.length; i++) {
      id = ids[(inicio + i) % ids.length];
      if (!usados[id]) { usados[id] = true; return id; }
    }
    id = ids[inicio];
    usados[id] = true;
    return id;
  }

  /* Papeles de cada comida según su nombre. */
  function guionDeComida(nombre) {
    var n = normalizar(nombre);
    if (n.indexOf('desayuno') >= 0) {
      return [
        { banco: 'protDesayuno', papel: 'proteina' },
        { banco: 'carboDesayuno', papel: 'carbo' },
        { banco: 'fruta', papel: 'fijo' },
        { banco: 'grasa', papel: 'grasa' }
      ];
    }
    if (n.indexOf('pre-entreno') >= 0 || n.indexOf('pre entreno') >= 0 || n.indexOf('preentreno') >= 0) {
      return [
        { banco: 'carboRapido', papel: 'carbo' },
        { banco: 'protLigera', papel: 'proteina' }
      ];
    }
    if (n.indexOf('nocturna') >= 0) {
      return [
        { banco: 'protNoche', papel: 'proteina' },
        { banco: 'grasa', papel: 'grasa' }
      ];
    }
    if (n.indexOf('colacion') >= 0) {
      return [
        { banco: 'protLigera', papel: 'proteina' },
        { banco: 'fruta', papel: 'carbo' },
        { banco: 'grasa', papel: 'grasa' }
      ];
    }
    if (n.indexOf('cena') >= 0) {
      return [
        { banco: 'protFuerte', papel: 'proteina' },
        { banco: 'verdura', papel: 'fijo' },
        { banco: 'carboFuerte', papel: 'carbo' },
        { banco: 'grasa', papel: 'grasa' }
      ];
    }
    /* Comida fuerte por defecto */
    return [
      { banco: 'protFuerte', papel: 'proteina' },
      { banco: 'carboFuerte', papel: 'carbo' },
      { banco: 'verdura', papel: 'fijo' },
      { banco: 'grasa', papel: 'grasa' }
    ];
  }

  /*
     Porción de guarnición (verdura o fruta). Se recorta cuando la comida
     tiene pocos carbohidratos para no gastarlos todos en la fruta.
  */
  function porcionFija(banco, objetivo, a, metaCarbos) {
    var base;
    if (banco === 'verdura') base = (objetivo === 'definir') ? 200 : 150;
    else if (banco === 'fruta') base = (objetivo === 'volumen') ? 150 : 120;
    else base = 100;

    var dens = densidad(a, 'carbos');
    if (dens > 0 && num(metaCarbos) > 0) {
      var tope = (num(metaCarbos) * 0.45) / dens;
      if (tope < base) base = tope;
    }

    var lim = limitesAjuste(a);
    return acotar(base, lim[0], lim[1]);
  }

  /* Comidas utilizables: descarta entradas nulas o corruptas. */
  function comidasValidas(valor) {
    var origen = lista(valor), salida = [], i;
    for (i = 0; i < origen.length; i++) {
      if (origen[i] && typeof origen[i] === 'object') salida.push(origen[i]);
    }
    return salida;
  }

  /* Suma de macros de una lista de comidas con {alimentos:[...]}. */
  function totalDeComidas(comidas) {
    var origen = comidasValidas(comidas);
    var items = [], i, j, als;
    for (i = 0; i < origen.length; i++) {
      als = lista(origen[i].alimentos);
      for (j = 0; j < als.length; j++) {
        if (als[j] && typeof als[j] === 'object') items.push(als[j]);
      }
    }
    return sumaMacros(items);
  }

  /* Reescala los alimentos de un papel para acercar el total del día. */
  function ajustarPapel(comidas, papel, meta, macro) {
    var i, j, als, it, a, aporte = 0, total = 0;

    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        a = alimento(it.alimentoId);
        if (!a) continue;
        var contrib = densidad(a, macro) * num(it.gramos);
        total += contrib;
        if (it.papel === papel) aporte += contrib;
      }
    }

    if (aporte <= 0 || !(num(meta) > 0)) return;

    var necesario = num(meta) - (total - aporte);
    if (necesario <= 0) necesario = aporte * 0.5;

    var factor = acotar(necesario / aporte, 0.4, 2.4);
    if (Math.abs(factor - 1) < 0.01) return;

    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        if (it.papel !== papel) continue;
        a = alimento(it.alimentoId);
        if (!a) continue;
        var lim = limitesAjuste(a);
        it.gramos = acotar(num(it.gramos) * factor, lim[0], lim[1]);
      }
    }
  }

  /* ¿Cuántos alimentos de ese papel hay en toda la lista de comidas? */
  function contarPapel(comidas, papel) {
    var total = 0, i, j, als;
    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) if (als[j].papel === papel) total++;
    }
    return total;
  }

  function contarPapelEnComida(comida, papel) {
    var als = lista(comida.alimentos), total = 0, j;
    for (j = 0; j < als.length; j++) if (als[j].papel === papel) total++;
    return total;
  }

  function yaEstaEnComida(comida, alimentoId) {
    var als = lista(comida.alimentos), j;
    for (j = 0; j < als.length; j++) if (als[j].alimentoId === alimentoId) return true;
    return false;
  }

  /* Banco que le corresponde a un papel dentro de una comida concreta. */
  function bancoDe(nombreComida, papel) {
    var guion = guionDeComida(nombreComida), i;
    for (i = 0; i < guion.length; i++) {
      if (guion[i].papel === papel) return guion[i].banco;
    }
    if (papel === 'grasa') return 'grasa';
    if (papel === 'proteina') return 'protFuerte';
    return 'carboFuerte';
  }

  /*
     Quita el alimento cuya salida acerca más el total al objetivo.
     Es lo que evita que un plan de definición cargue grasa de más
     solo porque cada comida traía su porción mínima.
  */
  function quitarSolver(comidas, papel, macro, meta) {
    if (contarPapel(comidas, papel) <= 1) return false;

    var actual = num(totalDeComidas(comidas)[macro]);
    var mejorDif = Math.abs(actual - num(meta));
    var mejorComida = null, mejorIdx = -1;
    var i, j, als, it, a, contrib, dif;

    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        if (it.papel !== papel) continue;
        a = alimento(it.alimentoId);
        if (!a) continue;
        contrib = densidad(a, macro) * num(it.gramos);
        dif = Math.abs(actual - contrib - num(meta));
        if (dif < mejorDif) { mejorDif = dif; mejorComida = comidas[i]; mejorIdx = j; }
      }
    }

    if (!mejorComida) return false;
    mejorComida.alimentos.splice(mejorIdx, 1);
    return true;
  }

  /*
     Refuerza el plan con otro alimento del mismo papel en la comida
     que más peso tiene: así un plan de volumen suma arroz + frijol +
     tortilla en lugar de servir una montaña de un solo ingrediente.
  */
  function agregarSolver(comidas, papel, objetivo, usados, semilla) {
    var macro = papel === 'carbo' ? 'carbos' : papel;
    var orden = comidas.slice().sort(function (a, b) {
      return num(b.meta ? b.meta[macro] : 0) - num(a.meta ? a.meta[macro] : 0);
    });

    var i, k;
    for (i = 0; i < orden.length; i++) {
      var comida = orden[i];
      if (contarPapelEnComida(comida, papel) >= 3) continue;

      var banco = bancoDe(comida.nombre, papel);
      var ids = filtrarPool(POOL[banco] || [], papel, objetivo);

      for (k = 0; k < ids.length; k++) {
        var id = elegirDe(ids, semilla + i * 7 + k, usados);
        var a = alimento(id);
        if (!a || yaEstaEnComida(comida, a.id)) continue;
        var lim = limitesDe(a);
        comida.alimentos.push({
          alimentoId: a.id,
          gramos: lim[0],
          papel: papel,
          banco: banco
        });
        return true;
      }
    }
    return false;
  }

  /* Gramos de proteína por gramo de carbohidrato (para elegir guarnición). */
  function razonProteica(a) {
    var c = num(a.carbos);
    if (c <= 0) return 99;
    return num(a.proteina) / c;
  }

  /*
     Cambia una guarnición con mucha proteína (leguminosas) por otra más
     neutra cuando el día ya se pasa de proteína. Es exactamente lo que
     haría un nutriólogo: cambiar el frijol por arroz o camote.
  */
  function suavizarProteinaDeCarbos(comidas, usados) {
    var i, j, als, it, a, r;
    var peorRazon = 0.12, comidaPeor = null, idxPeor = -1;

    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        if (it.papel !== 'carbo') continue;
        a = alimento(it.alimentoId);
        if (!a) continue;
        r = razonProteica(a);
        if (r > peorRazon) { peorRazon = r; comidaPeor = comidas[i]; idxPeor = j; }
      }
    }
    if (!comidaPeor) return false;

    var actual = alimento(comidaPeor.alimentos[idxPeor].alimentoId);
    var candidatos = ['al_arroz_blanco', 'al_papa_cocida', 'al_camote', 'al_arroz_integral',
      'al_platano_macho', 'al_yuca', 'al_elote', 'al_platano'];
    var elegido = mejorReemplazo(candidatos, comidaPeor, razonProteica, peorRazon, usados);
    if (!elegido) return false;

    /* Se conserva aproximadamente la misma carga de carbohidratos. */
    var carbosActuales = densidad(actual, 'carbos') * num(comidaPeor.alimentos[idxPeor].gramos);
    var dens = densidad(elegido, 'carbos');
    var lim = limitesAjuste(elegido);

    comidaPeor.alimentos[idxPeor] = {
      alimentoId: elegido.id,
      gramos: dens > 0 ? acotar(carbosActuales / dens, lim[0], lim[1]) : lim[0],
      papel: 'carbo',
      banco: 'carboFuerte'
    };
    usados[elegido.id] = true;
    return true;
  }

  /* Gramos de grasa por gramo de proteína (para elegir la fuente proteica). */
  function razonGrasa(a) {
    var p = num(a.proteina);
    if (p <= 0) return 99;
    return num(a.grasa) / p;
  }

  /*
     Cambia una fuente de proteína grasosa (arrachera, yogur entero) por
     otra magra cuando el día se pasa de grasa. El mismo criterio que usa
     un coach al armar una dieta de definición.
  */
  function suavizarGrasaDeProteinas(comidas, usados) {
    var i, j, als, it, a, r;
    var peorRazon = 0.10, comidaPeor = null, idxPeor = -1;

    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        if (it.papel !== 'proteina') continue;
        a = alimento(it.alimentoId);
        if (!a) continue;
        r = razonGrasa(a);
        if (r > peorRazon) { peorRazon = r; comidaPeor = comidas[i]; idxPeor = j; }
      }
    }
    if (!comidaPeor) return false;

    var actual = alimento(comidaPeor.alimentos[idxPeor].alimentoId);
    var candidatos = ['al_clara_huevo', 'al_atun_agua', 'al_pechuga_pavo', 'al_tilapia',
      'al_camaron', 'al_pechuga_pollo', 'al_pescado_basa', 'al_queso_cottage'];
    var elegido = mejorReemplazo(candidatos, comidaPeor, razonGrasa, peorRazon, usados);
    if (!elegido) return false;

    /* Se conserva aproximadamente la misma carga de proteína. */
    var proteinaActual = densidad(actual, 'proteina') * num(comidaPeor.alimentos[idxPeor].gramos);
    var dens = densidad(elegido, 'proteina');
    var lim = limitesAjuste(elegido);

    comidaPeor.alimentos[idxPeor] = {
      alimentoId: elegido.id,
      gramos: dens > 0 ? acotar(proteinaActual / dens, lim[0], lim[1]) : lim[0],
      papel: 'proteina',
      banco: comidaPeor.alimentos[idxPeor].banco || 'protFuerte'
    };
    usados[elegido.id] = true;
    return true;
  }

  /*
     Elige el reemplazo: primero entre los que aún no salen en el día
     (para no repetir el mismo alimento) y, si no queda ninguno, entre todos.
  */
  function mejorReemplazo(candidatos, comida, razonFn, peorRazon, usados) {
    var pasada, k, cand;
    for (pasada = 0; pasada < 2; pasada++) {
      for (k = 0; k < candidatos.length; k++) {
        cand = alimento(candidatos[k]);
        if (!cand || yaEstaEnComida(comida, cand.id)) continue;
        if (razonFn(cand) >= peorRazon) continue;
        if (pasada === 0 && usados[cand.id]) continue;
        return cand;
      }
    }
    return null;
  }

  function dentroDe(valor, meta, tolerancia) {
    if (!(num(meta) > 0)) return true;
    return Math.abs(num(valor) - num(meta)) / num(meta) <= tolerancia;
  }

  /*
     Afinado completo del día: escala porciones, quita lo que sobra y
     refuerza lo que falta hasta caer dentro de ±5 % de cada macro.
  */
  function afinar(comidas, metaP, metaC, metaG, objetivo, usados, semilla) {
    var ronda, vuelta, t, cambio, quitado;

    for (ronda = 0; ronda < 9; ronda++) {
      for (vuelta = 0; vuelta < 5; vuelta++) {
        ajustarPapel(comidas, 'proteina', metaP, 'proteina');
        ajustarPapel(comidas, 'grasa', metaG, 'grasa');
        ajustarPapel(comidas, 'carbo', metaC, 'carbos');
      }

      t = totalDeComidas(comidas);
      if (dentroDe(t.proteina, metaP, 0.05) &&
          dentroDe(t.carbos, metaC, 0.05) &&
          dentroDe(t.grasa, metaG, 0.05)) return;

      cambio = false;

      /* Lo que sobra se retira; empezando por la grasa, que es la más cara. */
      if (metaG > 0 && t.grasa > metaG * 1.05) {
        quitado = quitarSolver(comidas, 'grasa', 'grasa', metaG);
        if (!quitado) quitado = suavizarGrasaDeProteinas(comidas, usados);
        cambio = quitado || cambio;
      }
      if (metaP > 0 && t.proteina > metaP * 1.05) {
        quitado = quitarSolver(comidas, 'proteina', 'proteina', metaP);
        if (!quitado) quitado = suavizarProteinaDeCarbos(comidas, usados);
        cambio = quitado || cambio;
      }
      if (metaC > 0 && t.carbos > metaC * 1.05) {
        quitado = quitarSolver(comidas, 'carbo', 'carbos', metaC);
        if (!quitado) {
          /* Último recurso: recortar la guarnición de fruta y verdura. */
          ajustarPapel(comidas, 'fijo', metaC, 'carbos');
          quitado = true;
        }
        cambio = quitado || cambio;
      }

      /* Lo que falta se refuerza con otro alimento real del banco. */
      t = totalDeComidas(comidas);
      if (metaC > 0 && t.carbos < metaC * 0.95) {
        cambio = agregarSolver(comidas, 'carbo', objetivo, usados, semilla + ronda) || cambio;
      }
      if (metaP > 0 && t.proteina < metaP * 0.95) {
        cambio = agregarSolver(comidas, 'proteina', objetivo, usados, semilla + ronda + 11) || cambio;
      }
      if (metaG > 0 && t.grasa < metaG * 0.95) {
        cambio = agregarSolver(comidas, 'grasa', objetivo, usados, semilla + ronda + 23) || cambio;
      }

      if (!cambio) break;
    }

    /* Última pasada de escalado con la estructura ya definitiva. */
    for (vuelta = 0; vuelta < 6; vuelta++) {
      ajustarPapel(comidas, 'proteina', metaP, 'proteina');
      ajustarPapel(comidas, 'grasa', metaG, 'grasa');
      ajustarPapel(comidas, 'carbo', metaC, 'carbos');
    }
  }

  /* Redondea los gramos a cifras que se puedan pesar en casa. */
  function redondearGramos(comidas) {
    var i, j, als, it, a, lim, g;
    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        a = alimento(it.alimentoId);
        lim = limitesAjuste(a);
        g = num(it.gramos);
        g = g >= 40 ? Math.round(g / 5) * 5 : Math.round(g);
        it.gramos = Math.max(1, Math.round(acotar(g, lim[0], lim[1])));
      }
    }
  }

  /**
   * Arma un menú del día con alimentos reales del catálogo.
   * FUNCIÓN PURA: no toca la base ni el DOM.
   *
   * @param {Object} objetivoMacros { kcal, proteina, carbos, grasa } (o el
   *        objeto que devuelve AG.Calc.macros).
   * @param {Number} numComidas 3 a 6.
   * @param {Object} [opts] { semilla:Number, objetivo:'definir'|'volumen'|'mantener' }
   * @returns {Array} [{ nombre, hora, alimentos:[{alimentoId, gramos}] }]
   */
  function generarMenu(objetivoMacros, numComidas, opts) {
    var o = opts || {};
    var m = (objetivoMacros && typeof objetivoMacros === 'object') ? objetivoMacros : {};

    var metaP = Math.max(0, num(m.proteina));
    var metaC = Math.max(0, num(m.carbos));
    var metaG = Math.max(0, num(m.grasa));
    var n = entero(numComidas, 4);
    if (n < 3) n = 3;
    if (n > 6) n = 6;

    var objetivo = objetivoNutricional(o.objetivo || m.objetivo);
    var semilla = Math.abs(entero(o.semilla, 0));

    var plantillas = Calc.distribucionComidas(
      { proteina: metaP, carbos: metaC, grasa: metaG }, n
    );

    var comidas = [], i;

    /* Sin macros no hay menú: se devuelve el esqueleto con horarios reales. */
    if (metaP + metaC + metaG <= 0) {
      for (i = 0; i < plantillas.length; i++) {
        comidas.push({ nombre: plantillas[i].nombre, hora: plantillas[i].hora, alimentos: [] });
      }
      return comidas;
    }

    var usados = {};
    var trabajo = [];

    for (i = 0; i < plantillas.length; i++) {
      var plantilla = plantillas[i];
      var guion = guionDeComida(plantilla.nombre);
      var restante = {
        proteina: num(plantilla.proteina),
        carbos: num(plantilla.carbos),
        grasa: num(plantilla.grasa)
      };
      var alimentos = [];
      var j, paso, ids, id, a, lim, gramos;

      /* 1) Guarniciones fijas: verduras y frutas de acompañamiento. */
      for (j = 0; j < guion.length; j++) {
        paso = guion[j];
        if (paso.papel !== 'fijo') continue;
        ids = filtrarPool(POOL[paso.banco] || [], 'fijo', objetivo);
        id = elegirDe(ids, semilla + i * 3 + j, usados);
        a = alimento(id);
        if (!a) continue;
        gramos = porcionFija(paso.banco, objetivo, a, restante.carbos);
        alimentos.push({ alimentoId: a.id, gramos: gramos, papel: 'fijo', banco: paso.banco });
        restante.proteina -= densidad(a, 'proteina') * gramos;
        restante.carbos -= densidad(a, 'carbos') * gramos;
        restante.grasa -= densidad(a, 'grasa') * gramos;
      }

      /* 2) Proteína, 3) grasa y 4) carbohidrato: cada uno cierra su macro. */
      var orden = ['proteina', 'grasa', 'carbo'];
      var k;
      for (k = 0; k < orden.length; k++) {
        for (j = 0; j < guion.length; j++) {
          paso = guion[j];
          if (paso.papel !== orden[k]) continue;

          ids = filtrarPool(POOL[paso.banco] || [], paso.papel, objetivo);
          id = elegirDe(ids, semilla + i * 5 + j * 2 + k, usados);
          a = alimento(id);
          if (!a) continue;

          var macro = paso.papel === 'carbo' ? 'carbos' : paso.papel;
          var dens = densidad(a, macro);
          var faltante = Math.max(0, restante[macro === 'carbos' ? 'carbos' : macro]);
          lim = limitesDe(a);

          gramos = dens > 0 ? (faltante / dens) : ((lim[0] + lim[1]) / 2);
          gramos = acotar(gramos, lim[0], lim[1]);

          alimentos.push({ alimentoId: a.id, gramos: gramos, papel: paso.papel, banco: paso.banco });
          restante.proteina -= densidad(a, 'proteina') * gramos;
          restante.carbos -= densidad(a, 'carbos') * gramos;
          restante.grasa -= densidad(a, 'grasa') * gramos;
        }
      }

      trabajo.push({
        nombre: plantilla.nombre,
        hora: plantilla.hora,
        alimentos: alimentos,
        meta: {
          proteina: num(plantilla.proteina),
          carbos: num(plantilla.carbos),
          grasa: num(plantilla.grasa)
        }
      });
    }

    /* Afinado global: acerca el día completo a los macros objetivo (±7 %). */
    afinar(trabajo, metaP, metaC, metaG, objetivo, usados, semilla);
    redondearGramos(trabajo);

    /* Salida limpia: exactamente la forma que guarda el contrato. */
    var salida = [], j2;
    for (i = 0; i < trabajo.length; i++) {
      var als = [];
      for (j2 = 0; j2 < trabajo[i].alimentos.length; j2++) {
        var item = trabajo[i].alimentos[j2];
        if (num(item.gramos) <= 0) continue;
        als.push({ alimentoId: item.alimentoId, gramos: Math.round(num(item.gramos)) });
      }
      salida.push({ nombre: trabajo[i].nombre, hora: trabajo[i].hora, alimentos: als });
    }
    return salida;
  }

  /* =============================================================
     4. planHTML — el plan pintado (lo reutilizan socio y ficha)
     ============================================================= */

  function donaMacrosHTML(proteina, carbos, grasa, kcal, alto) {
    var datos = [
      { etiqueta: 'Proteína', valor: Math.round(num(proteina) * 4), color: COLOR.proteina },
      { etiqueta: 'Carbohidratos', valor: Math.round(num(carbos) * 4), color: COLOR.carbos },
      { etiqueta: 'Grasa', valor: Math.round(num(grasa) * 9), color: COLOR.grasa }
    ];
    return Charts.dona(datos, {
      alto: alto || 210,
      sufijo: ' kcal',
      centroValor: U.num(kcal, 0),
      centroTitulo: 'kcal al día',
      aria: 'Reparto de macronutrientes',
      vacio: 'Todavía no hay macros calculados para este plan.'
    });
  }

  function barraObjetivoHTML(etiqueta, actual, objetivo, unidad, dec) {
    var clase = claseDesvio(actual, objetivo);
    var ancho = anchoBarra(actual, objetivo);
    return '<div>' +
      '<div class="bar-etiqueta">' +
        '<span>' + esc(etiqueta) + '</span>' +
        '<b class="nu-tot">' + esc(U.num(actual, dec === undefined ? 0 : dec)) +
          ' / ' + esc(U.num(objetivo, dec === undefined ? 0 : dec)) +
          (unidad ? ' ' + esc(unidad) : '') + '</b>' +
      '</div>' +
      '<div class="bar"><span class="bar-fill' + (clase ? ' ' + clase : '') +
        '" style="width:' + Math.round(ancho) + '%"></span></div>' +
    '</div>';
  }

  function filaAlimentoHTML(item) {
    var a = alimento(item.alimentoId);
    var g = num(item.gramos);
    if (!a) {
      return '<tr><td colspan="7" class="muted">' +
        esc('Alimento no disponible en el catálogo (' + (item.alimentoId || 'sin id') + ')') +
      '</td></tr>';
    }
    var mac = macrosDe(a.id, g);
    return '<tr>' +
      '<td><span class="nu-punto" style="background:' + esc(colorCategoria(a.categoria)) + '"></span>' +
        esc(a.nombre) + '</td>' +
      '<td class="num">' + esc(U.num(g, 0)) + ' g</td>' +
      '<td class="mini muted">' + esc(a.medidaCasera || '—') + '</td>' +
      '<td class="num">' + esc(U.num(mac.kcal, 0)) + '</td>' +
      '<td class="num">' + esc(U.num(mac.proteina, 1)) + '</td>' +
      '<td class="num">' + esc(U.num(mac.carbos, 1)) + '</td>' +
      '<td class="num">' + esc(U.num(mac.grasa, 1)) + '</td>' +
    '</tr>';
  }

  function comidaHTML(comida, indice) {
    var origen = lista(comida.alimentos), alimentos = [], i;
    for (i = 0; i < origen.length; i++) {
      if (origen[i] && typeof origen[i] === 'object') alimentos.push(origen[i]);
    }

    var total = sumaMacros(alimentos);
    var filas = '';

    if (!alimentos.length) {
      filas = '<tr><td colspan="7" class="muted">Esta comida todavía no tiene alimentos cargados.</td></tr>';
    } else {
      for (i = 0; i < alimentos.length; i++) filas += filaAlimentoHTML(alimentos[i]);
    }

    return '<div class="nu-comida">' +
      '<div class="between wrap" style="gap:8px">' +
        '<div class="row-sm" style="min-width:0">' +
          icono('reloj', 15) +
          '<b>' + esc(comida.nombre || ('Comida ' + (indice + 1))) + '</b>' +
          '<span class="mini muted">' + esc(U.fecha(comida.hora, 'hora') || comida.hora || '') + '</span>' +
        '</div>' +
        '<span class="pill">' + esc(U.num(total.kcal, 0)) + ' kcal</span>' +
      '</div>' +
      '<div class="table-wrap scroll-x">' +
        '<table class="table table-compacta">' +
          '<thead><tr>' +
            '<th>Alimento</th><th class="num">Cantidad</th><th>Medida casera</th>' +
            '<th class="num">kcal</th><th class="num">P</th><th class="num">C</th><th class="num">G</th>' +
          '</tr></thead>' +
          '<tbody>' + filas + '</tbody>' +
          '<tfoot><tr>' +
            '<td colspan="3">Total de la comida</td>' +
            '<td class="num">' + esc(U.num(total.kcal, 0)) + '</td>' +
            '<td class="num">' + esc(U.num(total.proteina, 1)) + '</td>' +
            '<td class="num">' + esc(U.num(total.carbos, 1)) + '</td>' +
            '<td class="num">' + esc(U.num(total.grasa, 1)) + '</td>' +
          '</tr></tfoot>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  /**
   * HTML completo de un plan de nutrición, listo para incrustar.
   * @param {Object} plan PlanNutricion del contrato.
   * @param {Object} [opts] { acciones:Boolean, socio:Object, titulo:String, sinGrafica:Boolean }
   * @returns {String}
   */
  function planHTML(plan, opts) {
    var o = opts || {};

    if (!plan || typeof plan !== 'object') {
      return '<div class="nu-plan">' +
        vacioHTML('Este socio todavía no tiene un plan de nutrición. Crea uno con el asistente de tres pasos.', 'nutricion', '') +
      '</div>';
    }

    var socio = o.socio || (plan.socioId ? AG.DB.usuario(plan.socioId) : null);
    var coach = plan.coachId ? AG.DB.usuario(plan.coachId) : null;
    var comidas = comidasValidas(plan.comidas);
    var total = totalDeComidas(comidas);

    var metaKcal = num(plan.kcal);
    var metaP = num(plan.proteina);
    var metaC = num(plan.carbos);
    var metaG = num(plan.grasa);

    var encabezado =
      '<div class="caja">' +
        '<div class="between wrap" style="gap:10px">' +
          '<div class="row-sm wrap" style="min-width:0">' +
            (socio ? personaHTML(socio) : '') +
            '<span class="badge ' + esc(claseObjetivo(plan.objetivo)) + '">' +
              icono(iconoObjetivo(plan.objetivo), 13) + ' ' + esc(nombreObjetivo(plan.objetivo)) + '</span>' +
            (plan.activo === false ? '<span class="badge badge-muted">Plan inactivo</span>' :
              '<span class="badge badge-ok">Plan activo</span>') +
          '</div>' +
          '<div class="row-sm wrap">' +
            pill('Creado', U.fecha(plan.creado, 'corto') || '—') +
            (coach ? pill('Coach', U.nombreCompleto(coach)) : '') +
          '</div>' +
        '</div>' +
        '<div class="datos-grid mt">' +
          dato('Calorías', esc(U.num(metaKcal, 0)) + ' <span class="mini muted">kcal</span>') +
          dato('Proteína', esc(U.num(metaP, 0)) + ' <span class="mini muted">g</span>') +
          dato('Carbohidratos', esc(U.num(metaC, 0)) + ' <span class="mini muted">g</span>') +
          dato('Grasa', esc(U.num(metaG, 0)) + ' <span class="mini muted">g</span>') +
          dato('Agua', esc(U.num(plan.agua, 1)) + ' <span class="mini muted">L al día</span>') +
          dato('Comidas', esc(String(comidas.length)) + ' <span class="mini muted">al día</span>') +
        '</div>' +
      '</div>';

    var grafica = o.sinGrafica ? '' :
      '<div class="caja">' + donaMacrosHTML(metaP, metaC, metaG, metaKcal, 210) + '</div>';

    var cuerpoComidas;
    if (!comidas.length) {
      cuerpoComidas = vacioHTML('El plan no tiene comidas cargadas todavía.', 'manzana', '');
    } else {
      var partes = [], i;
      for (i = 0; i < comidas.length; i++) partes.push(comidaHTML(comidas[i], i));
      cuerpoComidas = '<div class="nu-comidas">' + partes.join('') + '</div>';
    }

    var resumen =
      '<div class="caja">' +
        '<div class="between wrap mb-sm" style="gap:8px">' +
          '<b>Totales del día contra el objetivo</b>' +
          '<span class="badge ' + esc(badgeDesvio(total.kcal, metaKcal)) + '">' +
            esc(textoDesvio(total.kcal, metaKcal)) + '</span>' +
        '</div>' +
        '<div class="nu-barras">' +
          barraObjetivoHTML('Calorías', total.kcal, metaKcal, 'kcal', 0) +
          barraObjetivoHTML('Proteína', total.proteina, metaP, 'g', 0) +
          barraObjetivoHTML('Carbohidratos', total.carbos, metaC, 'g', 0) +
          barraObjetivoHTML('Grasa', total.grasa, metaG, 'g', 0) +
        '</div>' +
        '<p class="mini muted mt-sm">Fibra del día: <b>' + esc(U.num(total.fibra, 1)) + ' g</b>. ' +
          'Recuerda tomar ' + esc(U.num(plan.agua, 1)) + ' litros de agua repartidos en el día.</p>' +
      '</div>';

    var notas = plan.notas
      ? '<div class="caja"><div class="row-sm mb-sm">' + icono('chat', 15) +
          '<b>Notas del coach</b></div>' +
          '<p class="mini" style="white-space:pre-line">' + esc(plan.notas) + '</p></div>'
      : '';

    var acciones = o.acciones
      ? '<div class="row-sm wrap no-imprimir">' +
          '<button type="button" class="btn btn-outline btn-sm" data-imprimir-plan="' + esc(plan.id) + '">' +
            icono('imprimir', 15) + ' Imprimir</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-compras-plan="' + esc(plan.id) + '">' +
            icono('reporte', 15) + ' Lista de compras</button>' +
        '</div>'
      : '';

    return '<div class="nu-plan" data-plan="' + esc(plan.id || '') + '">' +
      (o.titulo ? '<h3 class="card-title">' + esc(o.titulo) + '</h3>' : '') +
      encabezado +
      grafica +
      cuerpoComidas +
      resumen +
      notas +
      acciones +
    '</div>';
  }

  function badgeDesvio(actual, objetivo) {
    var c = claseDesvio(actual, objetivo);
    if (c === 'ok') return 'badge-ok';
    if (c === 'warn') return 'badge-warn';
    if (c === 'error') return 'badge-danger';
    return 'badge-muted';
  }

  function textoDesvio(actual, objetivo) {
    if (!(num(objetivo) > 0)) return 'Sin objetivo';
    var dif = num(actual) - num(objetivo);
    var pct = Math.abs(dif) / num(objetivo) * 100;
    if (pct <= 7) return 'En objetivo';
    return (dif > 0 ? 'Sobran ' : 'Faltan ') + U.num(Math.abs(dif), 0) + ' kcal';
  }

  /* =============================================================
     5. Ver plan, imprimir y lista de compras
     ============================================================= */

  function planPorId(planId) {
    return AG.DB.buscar('planesNutricion', planId);
  }

  function verPlan(planId) {
    asegurarEstilos();
    var plan = planPorId(planId);
    if (!plan) { toast('No encontramos ese plan de nutrición.', 'error'); return null; }

    var socio = AG.DB.usuario(plan.socioId);
    var usuario = usuarioActual();
    if (usuario && socio && !puedeVer(usuario, socio.id)) {
      toast('No tienes acceso al plan de este socio.', 'error');
      return null;
    }

    return U.modal({
      titulo: 'Plan de nutrición · ' + (socio ? U.nombreCompleto(socio) : 'Socio'),
      ancho: 'xl',
      cuerpo: planHTML(plan, { socio: socio, acciones: true }),
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root) { engancharAcciones(root); }
    });
  }

  function imprimirPlan(planId) {
    var plan = planPorId(planId);
    if (!plan) { toast('No encontramos ese plan de nutrición.', 'error'); return; }
    var socio = AG.DB.usuario(plan.socioId);
    var titulo = 'Plan de nutrición · ' + (socio ? U.nombreCompleto(socio) : 'Socio');
    U.imprimir(planHTML(plan, { socio: socio, acciones: false }), titulo);
  }

  /* Agrupa los alimentos del plan por categoría sumando los gramos de 7 días. */
  function listaComprasDe(plan) {
    var comidas = comidasValidas(plan ? plan.comidas : null);
    var acumulado = {};
    var i, j, als, it, a;

    for (i = 0; i < comidas.length; i++) {
      als = lista(comidas[i].alimentos);
      for (j = 0; j < als.length; j++) {
        it = als[j];
        a = alimento(it.alimentoId);
        if (!a || num(it.gramos) <= 0) continue;
        if (!acumulado[a.id]) acumulado[a.id] = { alimento: a, gramos: 0 };
        acumulado[a.id].gramos += num(it.gramos) * 7;
      }
    }

    var cats = categorias();
    var grupos = [], k, id, fila;

    for (k = 0; k < cats.length; k++) {
      var filas = [];
      for (id in acumulado) {
        if (!Object.prototype.hasOwnProperty.call(acumulado, id)) continue;
        fila = acumulado[id];
        if (fila.alimento.categoria !== cats[k].id) continue;
        filas.push(fila);
      }
      if (!filas.length) continue;
      filas = U.ordenar(filas, function (f) { return -f.gramos; }, 'asc');
      grupos.push({ categoria: cats[k], filas: filas });
    }

    /* Alimentos con una categoría fuera del catálogo no se pierden. */
    var sueltos = [];
    for (id in acumulado) {
      if (!Object.prototype.hasOwnProperty.call(acumulado, id)) continue;
      var encontrada = false;
      for (k = 0; k < cats.length; k++) {
        if (cats[k].id === acumulado[id].alimento.categoria) { encontrada = true; break; }
      }
      if (!encontrada) sueltos.push(acumulado[id]);
    }
    if (sueltos.length) {
      grupos.push({ categoria: { id: 'otros', nombre: 'Otros', color: '#8d9aa8' }, filas: sueltos });
    }

    return grupos;
  }

  function comprasHTML(plan, socio) {
    var grupos = listaComprasDe(plan);
    if (!grupos.length) {
      return vacioHTML('El plan no tiene alimentos cargados, así que no hay nada que comprar todavía.', 'reporte', '');
    }

    var html = '<p class="mini muted mb">Cantidades para <b>7 días</b> del plan de ' +
      esc(socio ? U.nombreCompleto(socio) : 'el socio') + '. Compra un poco de más: el peso es en crudo o tal como se registró.</p>';

    var i, j, granTotal = 0;
    for (i = 0; i < grupos.length; i++) {
      var g = grupos[i];
      var subtotal = 0;
      var filas = '';
      for (j = 0; j < g.filas.length; j++) {
        var f = g.filas[j];
        subtotal += f.gramos;
        filas += '<tr>' +
          '<td>' + esc(f.alimento.nombre) + '</td>' +
          '<td class="num">' + esc(U.num(f.gramos, 0)) + ' g</td>' +
          '<td class="num">' + esc(U.num(f.gramos / 1000, 2)) + ' kg</td>' +
          '<td class="mini muted">' + esc(f.alimento.medidaCasera || '—') + '</td>' +
        '</tr>';
      }
      granTotal += subtotal;

      html += '<div class="caja mb-sm">' +
        '<div class="row-sm mb-sm">' +
          '<span class="nu-punto" style="background:' + esc(g.categoria.color) + '"></span>' +
          '<b>' + esc(g.categoria.nombre) + '</b>' +
          '<span class="mini muted">' + esc(U.num(subtotal / 1000, 2)) + ' kg en total</span>' +
        '</div>' +
        '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
          '<thead><tr><th>Alimento</th><th class="num">Semana</th><th class="num">Equivale a</th>' +
            '<th>Medida casera</th></tr></thead>' +
          '<tbody>' + filas + '</tbody>' +
        '</table></div>' +
      '</div>';
    }

    html += '<p class="mini muted">Peso total de la despensa semanal: <b>' +
      esc(U.num(granTotal / 1000, 2)) + ' kg</b>.</p>';

    return html;
  }

  function listaCompras(planId) {
    asegurarEstilos();
    var plan = planPorId(planId);
    if (!plan) { toast('No encontramos ese plan de nutrición.', 'error'); return null; }

    var socio = AG.DB.usuario(plan.socioId);
    var contenido = comprasHTML(plan, socio);

    return U.modal({
      titulo: 'Lista de compras de la semana',
      ancho: 'lg',
      cuerpo: contenido,
      acciones: [
        { texto: 'Cerrar', clase: 'btn-ghost' },
        {
          texto: 'Imprimir',
          clase: 'btn-primary',
          icono: 'imprimir',
          onClick: function () {
            U.imprimir(contenido, 'Lista de compras · ' + (socio ? U.nombreCompleto(socio) : 'Socio'));
            return false;
          }
        }
      ]
    });
  }

  /**
   * Activa los botones "Imprimir" y "Lista de compras" que emite planHTML.
   * Las vistas del socio y la ficha del socio deben llamarla tras pintar.
   */
  function engancharAcciones(raiz) {
    if (!raiz || raiz.__nuEnganchado) return;
    raiz.__nuEnganchado = true;

    U.delegar(raiz, 'click', '[data-imprimir-plan]', function (e, el) {
      e.preventDefault();
      imprimirPlan(el.getAttribute('data-imprimir-plan'));
    });

    U.delegar(raiz, 'click', '[data-compras-plan]', function (e, el) {
      e.preventDefault();
      listaCompras(el.getAttribute('data-compras-plan'));
    });

    U.delegar(raiz, 'click', '[data-ver-plan]', function (e, el) {
      e.preventDefault();
      verPlan(el.getAttribute('data-ver-plan'));
    });

    U.delegar(raiz, 'click', '[data-editor-plan]', function (e, el) {
      e.preventDefault();
      editorPlan(el.getAttribute('data-editor-plan'), el.getAttribute('data-plan-id') || null);
    });
  }

  /* =============================================================
     6. Selector de alimentos (buscador + categorías)
     ============================================================= */

  function filasSelectorHTML(texto, categoria) {
    var resultados = (Data && typeof Data.alimentosPor === 'function')
      ? Data.alimentosPor({ texto: texto, categoria: categoria || undefined })
      : [];

    if (!resultados.length) {
      return vacioHTML('No encontramos alimentos con ese texto. Prueba con otro nombre o cambia de categoría.', 'buscar', '');
    }

    var tope = Math.min(resultados.length, 80);
    var html = '<div class="list">', i;

    for (i = 0; i < tope; i++) {
      var a = resultados[i];
      html += '<div class="list-item">' +
        '<div class="list-item-main">' +
          '<div class="nu-al-txt">' +
            '<b><span class="nu-punto" style="background:' + esc(colorCategoria(a.categoria)) + '"></span>' +
              esc(a.nombre) + '</b>' +
            '<span>' + esc(U.num(a.kcal, 0)) + ' kcal · P ' + esc(U.num(a.proteina, 1)) +
              ' · C ' + esc(U.num(a.carbos, 1)) + ' · G ' + esc(U.num(a.grasa, 1)) +
              ' por 100 ' + esc(a.unidad || 'g') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="list-item-side">' +
          '<button type="button" class="btn btn-primary btn-sm" data-elegir-alimento="' + esc(a.id) + '">' +
            icono('mas', 15) + ' Agregar</button>' +
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

  function chipsCategoriaHTML(activa, atributo) {
    var cats = categorias();
    var html = '<div class="chips">' +
      '<button type="button" class="chip chip-sm' + (activa ? '' : ' on') + '" ' + atributo + '="">Todas</button>';
    for (var i = 0; i < cats.length; i++) {
      html += '<button type="button" class="chip chip-sm' + (activa === cats[i].id ? ' on' : '') + '" ' +
        atributo + '="' + esc(cats[i].id) + '">' +
        '<span class="nu-punto" style="background:' + esc(cats[i].color) + '"></span>' +
        esc(cats[i].nombre) + '</button>';
    }
    return html + '</div>';
  }

  /**
   * Modal para elegir un alimento del catálogo.
   * @param {Function} alElegir recibe el id del alimento
   */
  function selectorAlimento(alElegir, categoriaInicial) {
    asegurarEstilos();
    var sel = { texto: '', categoria: categoriaInicial || '' };

    var cuerpo = '<div class="stack-sm" data-selector-alimento>' +
      '<div class="field">' +
        '<input class="input" type="search" data-buscar-alimento autocomplete="off" ' +
          'placeholder="Buscar alimento (pollo, avena, aguacate…)" aria-label="Buscar alimento">' +
      '</div>' +
      '<div data-chips-cat>' + chipsCategoriaHTML(sel.categoria, 'data-cat-sel') + '</div>' +
      '<div class="scroll-y" data-lista-alimentos>' + filasSelectorHTML('', sel.categoria) + '</div>' +
    '</div>';

    var api = U.modal({
      titulo: 'Agregar alimento',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root) {
        var caja = root.querySelector('[data-selector-alimento]');
        if (!caja) return;

        function repintar() {
          var destino = caja.querySelector('[data-lista-alimentos]');
          if (destino) destino.innerHTML = filasSelectorHTML(sel.texto, sel.categoria);
          var chips = caja.querySelector('[data-chips-cat]');
          if (chips) chips.innerHTML = chipsCategoriaHTML(sel.categoria, 'data-cat-sel');
        }

        var buscarConRetraso = U.debounce(repintar, 180);

        U.delegar(caja, 'input', '[data-buscar-alimento]', function (e, el) {
          sel.texto = el.value || '';
          buscarConRetraso();
        });

        U.delegar(caja, 'click', '[data-cat-sel]', function (e, el) {
          e.preventDefault();
          sel.categoria = el.getAttribute('data-cat-sel') || '';
          repintar();
        });

        U.delegar(caja, 'click', '[data-elegir-alimento]', function (e, el) {
          e.preventDefault();
          var id = el.getAttribute('data-elegir-alimento');
          if (typeof alElegir === 'function') {
            try { alElegir(id); } catch (err) { /* el editor sigue vivo */ }
          }
          api.cerrar();
        });
      }
    });

    return api;
  }

  /* =============================================================
     7. Asistente de plan en 3 pasos (modal XL)
     ============================================================= */

  /* Peso de referencia: última medición del socio o el dato de su perfil. */
  function pesoDeReferencia(socio) {
    var mediciones = AG.DB.medicionesDe(socio.id);
    for (var i = mediciones.length - 1; i >= 0; i--) {
      var p = nPos(mediciones[i].pesoKg);
      if (p !== null) return { peso: p, fuente: 'medición del ' + U.fecha(mediciones[i].fecha, 'corto') };
    }
    var perfil = nPos(socio.pesoKg);
    if (perfil !== null) return { peso: perfil, fuente: 'perfil del socio' };
    return { peso: 70, fuente: 'valor de referencia (captúralo para afinar)' };
  }

  function estaturaDeReferencia(socio) {
    var mediciones = AG.DB.medicionesDe(socio.id);
    for (var i = mediciones.length - 1; i >= 0; i--) {
      var e = nPos(mediciones[i].estaturaCm);
      if (e !== null) return e;
    }
    return nPos(socio.estaturaCm) || 170;
  }

  /* Recalcula todo el bloque energético del paso 1. */
  function recalcular() {
    var d = editor.datos;
    d.tmb = Calc.tmb(d.peso, d.estatura, d.edad, d.sexo);
    d.tdee = Calc.tdee(d.peso, d.estatura, d.edad, d.sexo, d.nivelActividad);
    d.kcalAuto = Calc.caloriasObjetivo(d.tdee, d.objetivo, d.agresividad, d.tmb);
    if (d.kcalAuto === null) d.kcalAuto = 2000;

    if (!d.kcalManual || !(num(d.kcal) > 0)) d.kcal = d.kcalAuto;

    var base = Calc.macros(d.kcal, d.objetivo, d.peso);
    d.macrosAuto = base;

    var proteina = d.proteinaManual && num(d.proteina) > 0 ? Math.round(num(d.proteina)) : base.proteina;
    var grasa = d.grasaManual && num(d.grasa) > 0 ? Math.round(num(d.grasa)) : base.grasa;

    /* La proteína y la grasa no pueden comerse todo el plan. */
    var techo = num(d.kcal) * 0.85;
    if (proteina * 4 + grasa * 9 > techo && techo > 0) {
      var escala = techo / (proteina * 4 + grasa * 9);
      proteina = Math.round(proteina * escala);
      grasa = Math.round(grasa * escala);
    }

    var carbos = Math.round((num(d.kcal) - proteina * 4 - grasa * 9) / 4);
    if (carbos < 0) carbos = 0;

    d.proteina = proteina;
    d.grasa = grasa;
    d.carbos = carbos;
    d.kcalReal = proteina * 4 + carbos * 4 + grasa * 9;
    d.agua = Calc.aguaDiaria(d.peso, d.nivelActividad) || 2;

    d.objetivoMacros = {
      kcal: d.kcalReal,
      proteina: d.proteina,
      carbos: d.carbos,
      grasa: d.grasa,
      objetivo: d.objetivo
    };
  }

  /* Reconstruye el esqueleto de comidas conservando lo ya cargado. */
  function reconstruirComidas(conservar) {
    var d = editor.datos;
    var plantillas = Calc.distribucionComidas(d.objetivoMacros, d.numComidas);
    var previas = conservar ? lista(d.comidas) : [];
    var nuevas = [], i, perdidas = 0;

    for (i = 0; i < plantillas.length; i++) {
      var previa = previas[i];
      nuevas.push({
        nombre: previa && previa.nombre ? previa.nombre : plantillas[i].nombre,
        hora: previa && previa.hora ? previa.hora : plantillas[i].hora,
        alimentos: previa ? lista(previa.alimentos).slice() : []
      });
    }

    /* Al bajar el número de comidas se avisa lo que se queda fuera. */
    for (i = plantillas.length; i < previas.length; i++) {
      perdidas += lista(previas[i].alimentos).length;
    }
    if (perdidas) {
      toast('Se quitaron ' + perdidas + (perdidas === 1 ? ' alimento' : ' alimentos') +
        ' de las comidas que ya no caben. Vuelve a generar si quieres rearmarlo.', 'warn');
    }

    d.comidas = nuevas;
  }

  function objetivosPorComida() {
    return Calc.distribucionComidas(editor.datos.objetivoMacros, editor.datos.numComidas);
  }

  /* ---------- Paso 1: objetivo y calorías ---------- */

  function radioCardsHTML(nombre, opciones, valor, atributo) {
    var html = '<div class="radio-cards">', i;
    for (i = 0; i < opciones.length; i++) {
      var op = opciones[i];
      var marcada = op.id === valor;
      html += '<label class="radio-card' + (marcada ? ' on' : '') + '">' +
        '<input type="radio" name="' + esc(nombre) + '" value="' + esc(op.id) + '"' +
          (marcada ? ' checked' : '') + ' ' + atributo + '="' + esc(op.id) + '">' +
        (op.icono ? icono(op.icono, 22) : '') +
        '<b>' + esc(op.nombre) + '</b>' +
        '<span>' + esc(op.desc || '') + '</span>' +
      '</label>';
    }
    return html + '</div>';
  }

  function paso1HTML() {
    var d = editor.datos;
    var socio = editor.socio;
    var i;

    var opcionesActividad = '';
    for (i = 0; i < NIVELES_ACTIVIDAD.length; i++) {
      opcionesActividad += '<option value="' + esc(NIVELES_ACTIVIDAD[i]) + '"' +
        (d.nivelActividad === NIVELES_ACTIVIDAD[i] ? ' selected' : '') + '>' +
        esc(etiquetaActividad(NIVELES_ACTIVIDAD[i])) + '</option>';
    }

    return '<div class="stack" data-paso1>' +

      '<div class="caja">' +
        '<div class="between wrap" style="gap:8px">' +
          personaHTML(socio) +
          '<div class="row-sm wrap">' +
            pill('Objetivo del socio', etiquetaObjetivoSocio(socio.objetivo)) +
            '<span class="mini muted">Peso tomado de: ' + esc(d.fuentePeso) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="form-grid tres">' +
        '<div class="field"><span class="label">Peso (kg)</span>' +
          '<input class="input" type="number" min="25" max="300" step="0.1" data-p1="peso" value="' + esc(d.peso) + '"></div>' +
        '<div class="field"><span class="label">Estatura (cm)</span>' +
          '<input class="input" type="number" min="100" max="230" step="0.5" data-p1="estatura" value="' + esc(d.estatura) + '"></div>' +
        '<div class="field"><span class="label">Edad (años)</span>' +
          '<input class="input" type="number" min="10" max="99" step="1" data-p1="edad" value="' + esc(d.edad) + '"></div>' +
        '<div class="field"><span class="label">Sexo</span>' +
          '<select class="select" data-p1="sexo">' +
            '<option value="H"' + (d.sexo === 'H' ? ' selected' : '') + '>Hombre</option>' +
            '<option value="M"' + (d.sexo === 'M' ? ' selected' : '') + '>Mujer</option>' +
          '</select></div>' +
        '<div class="field span2"><span class="label">Nivel de actividad</span>' +
          '<select class="select" data-p1="nivelActividad">' + opcionesActividad + '</select></div>' +
      '</div>' +

      '<div>' +
        '<span class="label">Objetivo del plan</span>' +
        radioCardsHTML('nu_objetivo', OBJETIVOS, d.objetivo, 'data-objetivo') +
      '</div>' +

      '<div>' +
        '<span class="label">Agresividad del ajuste</span>' +
        radioCardsHTML('nu_agresividad', AGRESIVIDADES, d.agresividad, 'data-agresividad') +
        '<p class="help">Al mantener, la agresividad no cambia las calorías: solo describe el enfoque.</p>' +
      '</div>' +

      '<div data-resumen-energia>' + resumenEnergiaHTML() + '</div>' +

    '</div>';
  }

  function datosEnergiaHTML() {
    var d = editor.datos;
    return dato('TMB (Mifflin-St Jeor)', esc(U.num(d.tmb, 0)) + ' <span class="mini muted">kcal</span>') +
      dato('TDEE (gasto diario)', esc(U.num(d.tdee, 0)) + ' <span class="mini muted">kcal</span>') +
      dato('Objetivo sugerido', esc(U.num(d.kcalAuto, 0)) + ' <span class="mini muted">kcal</span>') +
      dato('Agua recomendada', esc(U.num(d.agua, 1)) + ' <span class="mini muted">litros</span>');
  }

  function ayudaMacrosHTML() {
    var d = editor.datos;
    return 'Los carbohidratos se calculan solos con lo que sobra: <b>' +
      esc(U.num(d.carbos, 0)) + ' g</b>. Total real del plan: <b>' +
      esc(U.num(d.kcalReal, 0)) + ' kcal</b>.';
  }

  function pillsMacrosHTML() {
    var d = editor.datos;
    return '<span class="pill" style="border-color:' + COLOR.proteina + '">Proteína <b>' +
        esc(U.num(d.proteina, 0)) + ' g</b></span>' +
      '<span class="pill" style="border-color:' + COLOR.carbos + '">Carbos <b>' +
        esc(U.num(d.carbos, 0)) + ' g</b></span>' +
      '<span class="pill" style="border-color:' + COLOR.grasa + '">Grasa <b>' +
        esc(U.num(d.grasa, 0)) + ' g</b></span>' +
      '<span class="pill" style="border-color:' + COLOR.agua + '">Agua <b>' +
        esc(U.num(d.agua, 1)) + ' L</b></span>';
  }

  function resumenEnergiaHTML() {
    var d = editor.datos;

    return '<div class="caja">' +
      '<div class="datos-grid mb" data-datos-energia>' + datosEnergiaHTML() + '</div>' +

      '<div class="grid g2">' +
        '<div data-dona-macros>' + donaMacrosHTML(d.proteina, d.carbos, d.grasa, d.kcalReal, 200) + '</div>' +
        '<div class="stack-sm">' +
          '<div class="form-grid tres">' +
            '<div class="field"><span class="label">Calorías (kcal)</span>' +
              '<input class="input" type="number" min="1000" max="6000" step="10" data-macro="kcal" value="' +
                esc(Math.round(num(d.kcal))) + '"></div>' +
            '<div class="field"><span class="label">Proteína (g)</span>' +
              '<input class="input" type="number" min="0" max="500" step="1" data-macro="proteina" value="' +
                esc(Math.round(num(d.proteina))) + '"></div>' +
            '<div class="field"><span class="label">Grasa (g)</span>' +
              '<input class="input" type="number" min="0" max="300" step="1" data-macro="grasa" value="' +
                esc(Math.round(num(d.grasa))) + '"></div>' +
          '</div>' +
          '<p class="help" data-ayuda-macros>' + ayudaMacrosHTML() + '</p>' +
          '<div class="row-sm wrap" data-pills-macros>' + pillsMacrosHTML() + '</div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-restablecer>' +
            icono('historial', 15) + ' Volver al cálculo automático</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------- Paso 2: comidas ---------- */

  /* Línea de macros de un alimento del editor (se refresca sola). */
  function infoAlimentoHTML(item) {
    var a = alimento(item.alimentoId);
    if (!a) return esc(item.alimentoId || 'sin id');
    var mac = macrosDe(a.id, num(item.gramos));
    return esc(U.num(mac.kcal, 0)) + ' kcal · P ' + esc(U.num(mac.proteina, 1)) +
      ' · C ' + esc(U.num(mac.carbos, 1)) + ' · G ' + esc(U.num(mac.grasa, 1)) +
      (a.medidaCasera ? ' · ' + esc(a.medidaCasera) : '');
  }

  function alimentoEditableHTML(item, indiceComida, indiceAlimento) {
    var a = alimento(item.alimentoId);
    var g = num(item.gramos);

    if (!a) {
      return '<div class="nu-alimento">' +
        '<div class="nu-al-txt"><b class="muted">Alimento fuera del catálogo</b>' +
          '<span>' + esc(item.alimentoId || 'sin id') + '</span></div>' +
        '<div></div>' +
        '<button type="button" class="btn-icono btn-sm peligro" data-quitar-alimento="' + indiceAlimento +
          '" data-comida="' + indiceComida + '" title="Quitar" aria-label="Quitar">' + icono('basura', 16) + '</button>' +
      '</div>';
    }

    return '<div class="nu-alimento">' +
      '<div class="nu-al-txt">' +
        '<b><span class="nu-punto" style="background:' + esc(colorCategoria(a.categoria)) + '"></span>' +
          esc(a.nombre) + '</b>' +
        '<span data-al-info="' + indiceComida + '-' + indiceAlimento + '">' +
          infoAlimentoHTML(item) + '</span>' +
      '</div>' +
      '<input class="input" type="number" min="1" max="1500" step="5" ' +
        'data-gramos="' + indiceAlimento + '" data-comida="' + indiceComida + '" ' +
        'aria-label="Gramos de ' + esc(a.nombre) + '" value="' + Math.round(g) + '">' +
      '<button type="button" class="btn-icono btn-sm peligro" data-quitar-alimento="' + indiceAlimento +
        '" data-comida="' + indiceComida + '" title="Quitar ' + esc(a.nombre) + '" aria-label="Quitar">' +
        icono('basura', 16) + '</button>' +
    '</div>';
  }

  /* Resumen "objetivo contra logrado" de una comida del editor. */
  function resumenComidaHTML(comida, objetivoComida) {
    var total = sumaMacros(lista(comida.alimentos));
    var meta = objetivoComida || { kcal: 0, proteina: 0, carbos: 0, grasa: 0 };

    return '<div class="row-sm wrap">' +
      '<span class="pill">Objetivo <b>' + esc(U.num(meta.kcal, 0)) + ' kcal</b></span>' +
      '<span class="badge ' + esc(badgeDesvio(total.kcal, meta.kcal)) + '">' +
        esc(U.num(total.kcal, 0)) + ' kcal</span>' +
      '<span class="pill">P <b>' + esc(U.num(total.proteina, 1)) + ' / ' + esc(U.num(meta.proteina, 0)) + '</b></span>' +
      '<span class="pill">C <b>' + esc(U.num(total.carbos, 1)) + ' / ' + esc(U.num(meta.carbos, 0)) + '</b></span>' +
      '<span class="pill">G <b>' + esc(U.num(total.grasa, 1)) + ' / ' + esc(U.num(meta.grasa, 0)) + '</b></span>' +
    '</div>';
  }

  function comidaEditableHTML(comida, indice, objetivoComida) {
    var alimentos = lista(comida.alimentos);
    var filas = '', i;

    if (!alimentos.length) {
      filas = '<p class="mini muted">Sin alimentos todavía. Agrega uno o usa «Generar automáticamente».</p>';
    } else {
      for (i = 0; i < alimentos.length; i++) filas += alimentoEditableHTML(alimentos[i], indice, i);
    }

    return '<div class="nu-comida" data-comida-caja="' + indice + '">' +
      '<div class="nu-comida-head">' +
        '<div class="field flex1" style="min-width:140px">' +
          '<span class="label">Comida</span>' +
          '<input class="input" type="text" maxlength="40" data-comida-campo="nombre" data-comida="' + indice +
            '" value="' + esc(comida.nombre || '') + '" placeholder="Desayuno">' +
        '</div>' +
        '<div class="field" style="width:120px">' +
          '<span class="label">Hora</span>' +
          '<input class="input" type="time" data-comida-campo="hora" data-comida="' + indice +
            '" value="' + esc(comida.hora || '') + '">' +
        '</div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-agregar-alimento="' + indice + '">' +
          icono('mas', 15) + ' Alimento</button>' +
      '</div>' +

      '<div class="stack-sm">' + filas + '</div>' +

      '<div class="caja" data-comida-resumen="' + indice + '">' +
        resumenComidaHTML(comida, objetivoComida) +
      '</div>' +
    '</div>';
  }

  function totalesDiaHTML() {
    var d = editor.datos;
    var total = totalDeComidas(lista(d.comidas));
    var clase = claseDesvio(total.kcal, d.kcalReal);
    var mensaje;

    if (clase === 'ok') mensaje = 'El plan está dentro del objetivo (±7 %). Listo para guardar.';
    else if (clase === 'warn') mensaje = 'Vas cerca: ajusta gramos para quedar dentro de ±7 %.';
    else mensaje = 'El plan está lejos del objetivo: ajusta gramos o vuelve a generar el menú.';

    return '<div class="caja">' +
      '<div class="between wrap mb-sm" style="gap:8px">' +
        '<b>Total del día</b>' +
        '<span class="badge ' + esc(badgeDesvio(total.kcal, d.kcalReal)) + '">' +
          esc(textoDesvio(total.kcal, d.kcalReal)) + '</span>' +
      '</div>' +
      '<div class="nu-barras">' +
        barraObjetivoHTML('Calorías', total.kcal, d.kcalReal, 'kcal', 0) +
        barraObjetivoHTML('Proteína', total.proteina, d.proteina, 'g', 0) +
        barraObjetivoHTML('Carbohidratos', total.carbos, d.carbos, 'g', 0) +
        barraObjetivoHTML('Grasa', total.grasa, d.grasa, 'g', 0) +
      '</div>' +
      '<p class="help mt-sm">' + esc(mensaje) + ' Fibra del día: <b>' +
        esc(U.num(total.fibra, 1)) + ' g</b>.</p>' +
    '</div>';
  }

  function comidasHTML() {
    var d = editor.datos;
    var comidas = lista(d.comidas);
    var metas = objetivosPorComida();
    var partes = [], i;

    if (!comidas.length) {
      return vacioHTML('Elige cuántas comidas tendrá el plan para empezar a armarlo.', 'manzana', '');
    }
    for (i = 0; i < comidas.length; i++) {
      partes.push(comidaEditableHTML(comidas[i], i, metas[i]));
    }
    return '<div class="nu-comidas">' + partes.join('') + '</div>';
  }

  function paso2HTML() {
    var d = editor.datos;
    var html = '<div class="stack" data-paso2>';

    html += '<div class="caja">' +
      '<div class="between wrap" style="gap:10px">' +
        '<div class="row-sm wrap">' +
          '<span class="label" style="margin:0">Comidas al día</span>' +
          '<div class="chips" data-chips-comidas>';

    for (var n = 3; n <= 6; n++) {
      html += '<button type="button" class="chip' + (d.numComidas === n ? ' on' : '') +
        '" data-num-comidas="' + n + '">' + n + '</button>';
    }

    html += '</div></div>' +
        '<div class="row-sm wrap">' +
          '<button type="button" class="btn btn-primary btn-sm" data-generar>' +
            icono('rayo', 15) + ' Generar automáticamente</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-vaciar>' +
            icono('basura', 15) + ' Vaciar</button>' +
        '</div>' +
      '</div>' +
      '<p class="help mt-sm">El sistema reparte los macros del día entre las comidas: ' +
        'la comida fuerte concentra más y el pre-entreno carga carbohidratos con poca grasa.</p>' +
    '</div>';

    html += '<div data-totales-dia>' + totalesDiaHTML() + '</div>';
    html += '<div data-lista-comidas>' + comidasHTML() + '</div>';

    return html + '</div>';
  }

  /* ---------- Paso 3: notas y guardar ---------- */

  function paso3HTML() {
    var d = editor.datos;
    var planPrevia = {
      id: editor.planId || '',
      socioId: editor.socio.id,
      coachId: d.coachId,
      creado: d.creado,
      objetivo: d.objetivo,
      kcal: d.kcalReal,
      proteina: d.proteina,
      carbos: d.carbos,
      grasa: d.grasa,
      agua: d.agua,
      comidas: lista(d.comidas),
      notas: d.notas,
      activo: d.activo
    };

    return '<div class="stack" data-paso3>' +
      '<div class="field">' +
        '<span class="label">Notas del coach</span>' +
        '<textarea class="textarea" rows="4" maxlength="900" data-notas ' +
          'placeholder="Cómo seguir el plan, qué intercambios se permiten, qué hacer en un día complicado.">' +
          esc(d.notas) + '</textarea>' +
        '<span class="help">Las lee el socio en su pantalla de nutrición. Escribe indicaciones concretas.</span>' +
      '</div>' +

      '<div class="caja">' +
        '<label class="switch"><input type="checkbox" data-activo' + (d.activo ? ' checked' : '') +
          '><span>Marcar como plan activo del socio</span></label>' +
        '<p class="help mt-sm">Al activarlo, los planes anteriores del socio se desactivan y ' +
          'se le envía una notificación con el enlace a su plan.</p>' +
      '</div>' +

      '<div class="caja">' +
        '<b class="mb-sm" style="display:block">Vista previa del plan</b>' +
        planHTML(planPrevia, { socio: editor.socio, sinGrafica: false }) +
      '</div>' +
    '</div>';
  }

  /* ---------- Armado del asistente ---------- */

  function pasosHTML() {
    var pasos = [
      { n: 1, titulo: 'Objetivo y calorías', desc: 'Datos, TMB y macros' },
      { n: 2, titulo: 'Comidas', desc: 'Alimentos y gramos' },
      { n: 3, titulo: 'Notas y guardar', desc: 'Revisión final' }
    ];
    var html = '<div class="nu-pasos" data-pasos>', i;
    for (i = 0; i < pasos.length; i++) {
      var clase = 'nu-paso';
      if (pasos[i].n === editor.paso) clase += ' activo';
      else if (pasos[i].n < editor.paso) clase += ' hecho';
      html += '<div class="' + clase + '">' +
        '<span class="nu-num">' + (pasos[i].n < editor.paso ? '&#10003;' : pasos[i].n) + '</span>' +
        '<span style="min-width:0"><b>' + esc(pasos[i].titulo) + '</b>' +
          '<small>' + esc(pasos[i].desc) + '</small></span>' +
      '</div>';
    }
    return html + '</div>';
  }

  function cuerpoAsistenteHTML() {
    var contenido;
    if (editor.paso === 1) contenido = paso1HTML();
    else if (editor.paso === 2) contenido = paso2HTML();
    else contenido = paso3HTML();

    return '<div data-asistente>' + pasosHTML() + '<div data-cuerpo-paso>' + contenido + '</div></div>';
  }

  function pintarPaso(root) {
    var caja = root.querySelector('[data-asistente]');
    if (!caja) return;
    caja.innerHTML = pasosHTML() + '<div data-cuerpo-paso>' +
      (editor.paso === 1 ? paso1HTML() : (editor.paso === 2 ? paso2HTML() : paso3HTML())) +
    '</div>';
    pintarPie();
  }

  function pintarPie() {
    if (!editor || !editor.api || !editor.api.root) return;
    var botones = U.$$('.modal-foot [data-accion]', editor.api.root);
    if (botones.length < 4) return;
    /* 0 Cancelar · 1 Atrás · 2 Siguiente · 3 Guardar */
    botones[1].classList.toggle('oculto', editor.paso === 1);
    botones[2].classList.toggle('oculto', editor.paso === 3);
    botones[3].classList.toggle('oculto', editor.paso !== 3);
  }

  /* Actualiza el bloque energético sin tocar el campo que se está editando. */
  function refrescarPaso1(root) {
    var d = editor.datos;
    var caja, i;

    caja = root.querySelector('[data-datos-energia]');
    if (caja) caja.innerHTML = datosEnergiaHTML();

    caja = root.querySelector('[data-dona-macros]');
    if (caja) caja.innerHTML = donaMacrosHTML(d.proteina, d.carbos, d.grasa, d.kcalReal, 200);

    caja = root.querySelector('[data-ayuda-macros]');
    if (caja) caja.innerHTML = ayudaMacrosHTML();

    caja = root.querySelector('[data-pills-macros]');
    if (caja) caja.innerHTML = pillsMacrosHTML();

    var campos = U.$$('[data-macro]', root);
    for (i = 0; i < campos.length; i++) {
      if (campos[i] === document.activeElement) continue;
      var clave = campos[i].getAttribute('data-macro');
      campos[i].value = String(Math.round(num(d[clave])));
    }
  }

  function refrescarPaso2(root) {
    var totales = root.querySelector('[data-totales-dia]');
    if (totales) totales.innerHTML = totalesDiaHTML();
    var comidas = root.querySelector('[data-lista-comidas]');
    if (comidas) comidas.innerHTML = comidasHTML();
  }

  /* Refresco fino al mover gramos: no se repinta la lista ni se pierde el foco. */
  function refrescarGramos(root, indiceComida, indiceAlimento) {
    var comida = comidaEn(indiceComida);
    if (!comida) return;

    var alimentos = lista(comida.alimentos);
    var item = alimentos[indiceAlimento];
    if (item) {
      var info = root.querySelector('[data-al-info="' + indiceComida + '-' + indiceAlimento + '"]');
      if (info) info.innerHTML = infoAlimentoHTML(item);
    }

    var metas = objetivosPorComida();
    var resumen = root.querySelector('[data-comida-resumen="' + indiceComida + '"]');
    if (resumen) resumen.innerHTML = resumenComidaHTML(comida, metas[indiceComida]);

    var totales = root.querySelector('[data-totales-dia]');
    if (totales) totales.innerHTML = totalesDiaHTML();
  }

  function comidaEn(indice) {
    var comidas = lista(editor.datos.comidas);
    return comidas[indice] || null;
  }

  function engancharAsistente(root) {
    /* ---- Paso 1: datos del socio ---- */
    function aplicarP1(el) {
      var campo = el.getAttribute('data-p1');
      var d = editor.datos;
      if (campo === 'sexo' || campo === 'nivelActividad') {
        d[campo] = el.value;
      } else {
        var v = n0(el.value);
        if (v === null) return;
        d[campo] = v;
      }
      recalcular();
      refrescarPaso1(root);
    }

    U.delegar(root, 'change', '[data-p1]', function (e, el) { aplicarP1(el); });
    U.delegar(root, 'input', '[data-p1]', U.debounce(function () {
      var activos = U.$$('[data-p1]', root);
      for (var i = 0; i < activos.length; i++) {
        var campo = activos[i].getAttribute('data-p1');
        if (campo === 'sexo' || campo === 'nivelActividad') continue;
        var v = n0(activos[i].value);
        if (v !== null) editor.datos[campo] = v;
      }
      recalcular();
      refrescarPaso1(root);
    }, 320));

    U.delegar(root, 'change', '[data-objetivo]', function (e, el) {
      editor.datos.objetivo = el.getAttribute('data-objetivo');
      editor.datos.kcalManual = false;
      editor.datos.proteinaManual = false;
      editor.datos.grasaManual = false;
      recalcular();
      pintarPaso(root);
    });

    U.delegar(root, 'change', '[data-agresividad]', function (e, el) {
      editor.datos.agresividad = el.getAttribute('data-agresividad');
      editor.datos.kcalManual = false;
      recalcular();
      pintarPaso(root);
    });

    /* ---- Paso 1: ajustes manuales de macros ----
       El valor se guarda al instante y solo se difiere el repintado, así
       escribir rápido en dos campos seguidos nunca pierde una cifra. */
    var repintarMacros = U.debounce(function () {
      recalcular();
      refrescarPaso1(root);
    }, 380);

    U.delegar(root, 'input', '[data-macro]', function (e, el) {
      var d = editor.datos;
      var v = n0(el.value);
      if (v === null || v < 0) return;
      var campo = el.getAttribute('data-macro');
      if (campo === 'kcal') { d.kcal = Math.round(v); d.kcalManual = true; }
      else if (campo === 'proteina') { d.proteina = Math.round(v); d.proteinaManual = true; }
      else if (campo === 'grasa') { d.grasa = Math.round(v); d.grasaManual = true; }
      repintarMacros();
    });

    U.delegar(root, 'click', '[data-restablecer]', function (e) {
      e.preventDefault();
      editor.datos.kcalManual = false;
      editor.datos.proteinaManual = false;
      editor.datos.grasaManual = false;
      recalcular();
      refrescarPaso1(root);
      toast('Calorías y macros vueltos al cálculo automático.', 'ok');
    });

    /* ---- Paso 2: número de comidas ---- */
    U.delegar(root, 'click', '[data-num-comidas]', function (e, el) {
      e.preventDefault();
      var n = entero(el.getAttribute('data-num-comidas'), 4);
      if (n === editor.datos.numComidas) return;
      editor.datos.numComidas = n;
      reconstruirComidas(true);
      pintarPaso(root);
    });

    U.delegar(root, 'click', '[data-generar]', function (e) {
      e.preventDefault();
      var d = editor.datos;
      d.semilla = (entero(d.semilla, 0) + 1) % 997;
      var generadas = generarMenu(d.objetivoMacros, d.numComidas, {
        semilla: d.semilla,
        objetivo: d.objetivo
      });
      var previas = lista(d.comidas);
      var i, nuevas = [];
      for (i = 0; i < generadas.length; i++) {
        nuevas.push({
          nombre: (previas[i] && previas[i].nombre) ? previas[i].nombre : generadas[i].nombre,
          hora: (previas[i] && previas[i].hora) ? previas[i].hora : generadas[i].hora,
          alimentos: generadas[i].alimentos
        });
      }
      d.comidas = nuevas;
      refrescarPaso2(root);

      var total = totalDeComidas(nuevas);
      var clase = claseDesvio(total.kcal, d.kcalReal);
      toast(clase === 'ok'
        ? 'Menú generado dentro del objetivo: ' + U.num(total.kcal, 0) + ' kcal.'
        : 'Menú generado con ' + U.num(total.kcal, 0) + ' kcal. Ajusta gramos si quieres afinarlo.',
        clase === 'error' ? 'warn' : 'ok');
    });

    U.delegar(root, 'click', '[data-vaciar]', function (e) {
      e.preventDefault();
      var comidas = lista(editor.datos.comidas);
      for (var i = 0; i < comidas.length; i++) comidas[i].alimentos = [];
      refrescarPaso2(root);
      toast('Comidas vaciadas. Puedes armarlas a mano o volver a generar.', 'info');
    });

    /* ---- Paso 2: campos de la comida ---- */
    U.delegar(root, 'input', '[data-comida-campo]', function (e, el) {
      var comida = comidaEn(entero(el.getAttribute('data-comida'), -1));
      if (!comida) return;
      comida[el.getAttribute('data-comida-campo')] = el.value;
    });

    U.delegar(root, 'click', '[data-agregar-alimento]', function (e, el) {
      e.preventDefault();
      var indice = entero(el.getAttribute('data-agregar-alimento'), -1);
      var comida = comidaEn(indice);
      if (!comida) return;
      selectorAlimento(function (id) {
        var a = alimento(id);
        if (!a) { toast('Ese alimento ya no está en el catálogo.', 'error'); return; }
        comida.alimentos = lista(comida.alimentos);
        comida.alimentos.push({ alimentoId: a.id, gramos: PORCION_SUGERIDA[a.categoria] || 100 });
        refrescarPaso2(root);
        toast(a.nombre + ' agregado a ' + (comida.nombre || 'la comida') + '.', 'ok');
      });
    });

    U.delegar(root, 'click', '[data-quitar-alimento]', function (e, el) {
      e.preventDefault();
      var comida = comidaEn(entero(el.getAttribute('data-comida'), -1));
      if (!comida) return;
      var idx = entero(el.getAttribute('data-quitar-alimento'), -1);
      var alimentos = lista(comida.alimentos);
      if (idx < 0 || idx >= alimentos.length) return;
      alimentos.splice(idx, 1);
      comida.alimentos = alimentos;
      refrescarPaso2(root);
    });

    var aplicarGramos = U.debounce(function (indiceComida, indiceAlimento) {
      refrescarGramos(root, indiceComida, indiceAlimento);
    }, 260);

    U.delegar(root, 'input', '[data-gramos]', function (e, el) {
      var iComida = entero(el.getAttribute('data-comida'), -1);
      var comida = comidaEn(iComida);
      if (!comida) return;
      var idx = entero(el.getAttribute('data-gramos'), -1);
      var alimentos = lista(comida.alimentos);
      if (idx < 0 || idx >= alimentos.length) return;
      var v = n0(el.value);
      alimentos[idx].gramos = (v !== null && v > 0) ? Math.round(acotar(v, 1, 1500)) : 0;
      aplicarGramos(iComida, idx);
    });

    /* ---- Paso 3 ---- */
    U.delegar(root, 'input', '[data-notas]', function (e, el) {
      editor.datos.notas = el.value || '';
    });

    U.delegar(root, 'change', '[data-activo]', function (e, el) {
      editor.datos.activo = !!el.checked;
    });
  }

  /* Valida el paso actual antes de avanzar. */
  function validarPaso(paso) {
    var d = editor.datos;
    if (paso === 1) {
      if (!(num(d.peso) > 20)) { toast('Captura un peso válido para calcular el plan.', 'error'); return false; }
      if (!(num(d.estatura) > 100)) { toast('Captura la estatura del socio en centímetros.', 'error'); return false; }
      if (!(num(d.edad) > 9)) { toast('Captura la edad del socio.', 'error'); return false; }
      if (!(num(d.kcalReal) > 800)) { toast('Las calorías del plan son demasiado bajas: revisa los macros.', 'error'); return false; }
      return true;
    }
    if (paso === 2) {
      var comidas = lista(d.comidas);
      var conAlimentos = 0, i;
      for (i = 0; i < comidas.length; i++) {
        if (lista(comidas[i].alimentos).length) conAlimentos++;
      }
      if (!conAlimentos) {
        toast('El plan no tiene ni un alimento. Usa «Generar automáticamente» o agrégalos a mano.', 'error');
        return false;
      }
      return true;
    }
    return true;
  }

  /* Guarda el plan: desactiva los anteriores, inserta y notifica. */
  function guardarPlan() {
    var d = editor.datos;
    var socio = editor.socio;

    if (!validarPaso(1) || !validarPaso(2)) return false;

    var comidas = [], i, j, als, limpias;
    var origen = comidasValidas(d.comidas);
    for (i = 0; i < origen.length; i++) {
      als = lista(origen[i].alimentos);
      limpias = [];
      for (j = 0; j < als.length; j++) {
        if (!als[j] || !alimento(als[j].alimentoId) || num(als[j].gramos) <= 0) continue;
        limpias.push({ alimentoId: als[j].alimentoId, gramos: Math.round(num(als[j].gramos)) });
      }
      comidas.push({
        nombre: String(origen[i].nombre || ('Comida ' + (i + 1))).slice(0, 40),
        hora: String(origen[i].hora || '').slice(0, 5),
        alimentos: limpias
      });
    }

    var datos = {
      socioId: socio.id,
      coachId: d.coachId || socio.coachId || null,
      creado: d.creado || U.hoy(),
      objetivo: d.objetivo,
      kcal: Math.round(num(d.kcalReal)),
      proteina: Math.round(num(d.proteina)),
      carbos: Math.round(num(d.carbos)),
      grasa: Math.round(num(d.grasa)),
      agua: red1(d.agua),
      comidas: comidas,
      notas: String(d.notas || ''),
      activo: !!d.activo
    };

    /* 1) Al activar el nuevo, los anteriores del socio dejan de estar activos. */
    if (datos.activo) {
      var previos = AG.DB.donde('planesNutricion', function (p) {
        return p && p.socioId === socio.id && p.activo !== false && p.id !== editor.planId;
      });
      for (i = 0; i < previos.length; i++) previos[i].activo = false;
    }

    /* 2) Alta o edición. */
    var guardado;
    if (editor.planId && AG.DB.buscar('planesNutricion', editor.planId)) {
      guardado = AG.DB.actualizar('planesNutricion', editor.planId, datos);
    } else {
      guardado = AG.DB.insertar('planesNutricion', datos);
    }
    AG.DB.guardar();

    if (!guardado) {
      toast('No pudimos guardar el plan. Intenta de nuevo.', 'error');
      return false;
    }

    /* 3) Aviso al socio (una sola vez por plan, aunque se edite después). */
    if (datos.activo) {
      var clave = 'plan-nutricion:' + guardado.id;
      var repetida = AG.DB.donde('notificaciones', function (n) {
        return n && n.usuarioId === socio.id && n.clave === clave;
      });
      if (!repetida.length) {
        AG.DB.notificar(socio.id, {
          titulo: 'Tu plan de nutrición está listo',
          cuerpo: 'Tu coach preparó un plan de ' + U.num(datos.kcal, 0) + ' kcal con ' +
            comidas.length + ' comidas al día. Revísalo en Mi nutrición.',
          tipo: 'sistema',
          link: '#/socio/nutricion',
          clave: clave
        });
      }
    }

    toast('Plan de nutrición guardado para ' + U.nombreCompleto(socio) + '.', 'ok');
    return guardado;
  }

  /**
   * Asistente de plan alimenticio en 3 pasos.
   * @param {String} socioId
   * @param {String} [planId] si se pasa, edita ese plan en lugar de crear uno nuevo
   */
  function editorPlan(socioId, planId) {
    asegurarEstilos();

    var usuario = usuarioActual();
    var socio = AG.DB.usuario(socioId);

    if (!socio || socio.rol !== 'socio') {
      toast('No encontramos a ese socio en el sistema.', 'error');
      return null;
    }
    if (!puedeEditar(usuario) || !puedeVer(usuario, socio.id)) {
      toast('No tienes permiso para armar el plan de este socio.', 'error');
      return null;
    }

    var plan = planId ? AG.DB.buscar('planesNutricion', planId) : null;
    var base = plan || AG.DB.planNutricionDe(socio.id);
    var ref = pesoDeReferencia(socio);

    editor = {
      paso: 1,
      socio: socio,
      planId: plan ? plan.id : null,
      api: null,
      datos: {
        peso: red1(ref.peso),
        fuentePeso: ref.fuente,
        estatura: estaturaDeReferencia(socio),
        edad: U.edad(socio.fechaNacimiento) || 30,
        sexo: socio.sexo === 'M' ? 'M' : 'H',
        nivelActividad: socio.nivelActividad || 'moderado',
        objetivo: objetivoNutricional(base ? base.objetivo : socio.objetivo),
        agresividad: 'moderada',
        kcal: 0,
        kcalManual: false,
        proteina: 0,
        proteinaManual: false,
        grasa: 0,
        grasaManual: false,
        carbos: 0,
        numComidas: 4,
        comidas: [],
        notas: plan ? String(plan.notas || '') : '',
        activo: plan ? plan.activo !== false : true,
        creado: plan ? (plan.creado || U.hoy()) : U.hoy(),
        coachId: (plan && plan.coachId) || socio.coachId || (usuario ? usuario.id : null),
        semilla: 0
      }
    };

    /* Si se está editando, se respetan las cifras guardadas. */
    if (plan) {
      if (num(plan.kcal) > 0) { editor.datos.kcal = Math.round(num(plan.kcal)); editor.datos.kcalManual = true; }
      if (num(plan.proteina) > 0) { editor.datos.proteina = Math.round(num(plan.proteina)); editor.datos.proteinaManual = true; }
      if (num(plan.grasa) > 0) { editor.datos.grasa = Math.round(num(plan.grasa)); editor.datos.grasaManual = true; }
      var comidasPlan = lista(plan.comidas);
      if (comidasPlan.length) {
        editor.datos.numComidas = Math.max(3, Math.min(6, comidasPlan.length));
      }
    }

    recalcular();

    if (plan && lista(plan.comidas).length) {
      var copia = [], i, j;
      var origen = comidasValidas(plan.comidas);
      for (i = 0; i < origen.length && i < 6; i++) {
        var als = lista(origen[i].alimentos), limpio = [];
        for (j = 0; j < als.length; j++) {
          if (!als[j]) continue;
          limpio.push({ alimentoId: als[j].alimentoId, gramos: num(als[j].gramos) });
        }
        copia.push({ nombre: origen[i].nombre, hora: origen[i].hora, alimentos: limpio });
      }
      editor.datos.comidas = copia;
    } else {
      editor.datos.comidas = generarMenu(editor.datos.objetivoMacros, editor.datos.numComidas, {
        semilla: 0,
        objetivo: editor.datos.objetivo
      });
    }

    var api = U.modal({
      titulo: (plan ? 'Editar plan de nutrición · ' : 'Nuevo plan de nutrición · ') + U.nombreCompleto(socio),
      ancho: 'xl',
      cuerpo: cuerpoAsistenteHTML(),
      acciones: [
        { texto: 'Cancelar', clase: 'btn-ghost' },
        {
          texto: 'Atrás',
          clase: 'btn-outline',
          onClick: function (modalApi) {
            if (editor.paso > 1) {
              editor.paso--;
              pintarPaso(modalApi.root);
            }
            return false;
          }
        },
        {
          texto: 'Siguiente',
          clase: 'btn-primary',
          onClick: function (modalApi) {
            if (!validarPaso(editor.paso)) return false;
            if (editor.paso < 3) {
              editor.paso++;
              pintarPaso(modalApi.root);
            }
            return false;
          }
        },
        {
          texto: 'Guardar plan',
          clase: 'btn-ok',
          icono: 'check',
          onClick: function (modalApi) {
            var guardado = guardarPlan();
            if (!guardado) return false;
            modalApi.cerrar();
            AG.Router.refrescar();
            return false;
          }
        }
      ],
      onOpen: function (root) {
        engancharAsistente(root);
      },
      onCerrar: function () { editor = null; }
    });

    editor.api = api;
    pintarPie();
    return api;
  }

  /* =============================================================
     8. Pestaña «Planes»
     ============================================================= */

  function planActivoDe(socioId) {
    return AG.DB.planNutricionDe(socioId);
  }

  function calcularPlanes(usuario) {
    var socios = sociosVisibles(usuario).filter(esPlaneable);

    if (usuario.rol === 'director' && estado.coachFiltro) {
      socios = socios.filter(function (s) {
        return estado.coachFiltro === 'sin_coach' ? !s.coachId : s.coachId === estado.coachFiltro;
      });
    }

    var texto = normalizar(estado.busqueda || '');
    if (texto) {
      socios = socios.filter(function (s) {
        return normalizar(U.nombreCompleto(s) + ' ' + (s.codigo || '') + ' ' + (s.email || '')).indexOf(texto) >= 0;
      });
    }

    socios = U.ordenar(socios, function (s) { return normalizar(U.nombreCompleto(s)); }, 'asc');

    var conPlan = [], sinPlan = [], i;
    for (i = 0; i < socios.length; i++) {
      var plan = planActivoDe(socios[i].id);
      if (plan) conPlan.push({ socio: socios[i], plan: plan });
      else sinPlan.push({ socio: socios[i] });
    }

    if (estado.objetivo) {
      conPlan = conPlan.filter(function (f) { return f.plan.objetivo === estado.objetivo; });
      /* Con filtro de objetivo activo, los socios sin plan no aplican. */
      sinPlan = [];
    }

    var kcalProm = U.promedio(conPlan, function (f) { return num(f.plan.kcal); });

    return {
      total: socios.length,
      conPlan: conPlan,
      sinPlan: sinPlan,
      kcalProm: kcalProm
    };
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

  function kpisPlanesHTML(datos) {
    return '<div class="grid g4">' +
      kpiHTML('socios', String(datos.total), 'Socios a mi cargo', '') +
      kpiHTML('nutricion', String(datos.conPlan.length), 'Con plan activo', 'kpi-ok') +
      kpiHTML('alerta', String(datos.sinPlan.length), 'Sin plan',
        datos.sinPlan.length ? 'kpi-warn' : 'kpi-ok') +
      kpiHTML('fuego', datos.conPlan.length ? U.num(datos.kcalProm, 0) : '—', 'Calorías promedio', 'kpi-info') +
    '</div>';
  }

  function filtrosPlanesHTML(usuario) {
    var html = '<div class="card"><div class="card-body"><div class="row wrap">' +
      '<div class="field flex1">' +
        '<input class="input" type="search" data-buscar autocomplete="off" ' +
          'aria-label="Buscar socio" placeholder="Buscar por nombre, código o correo" value="' +
          esc(estado.busqueda) + '">' +
      '</div>' +
      '<div class="field"><select class="select" data-objetivo-filtro aria-label="Filtrar por objetivo">' +
        '<option value="">Todos los objetivos</option>';

    for (var i = 0; i < OBJETIVOS.length; i++) {
      html += '<option value="' + esc(OBJETIVOS[i].id) + '"' +
        (estado.objetivo === OBJETIVOS[i].id ? ' selected' : '') + '>' +
        esc(OBJETIVOS[i].nombre) + '</option>';
    }
    html += '</select></div>';

    if (usuario.rol === 'director') {
      var coaches = U.ordenar(AG.DB.coaches(), function (c) { return normalizar(U.nombreCompleto(c)); }, 'asc');
      html += '<div class="field"><select class="select" data-coach aria-label="Filtrar por coach">' +
        '<option value="">Todos los coaches</option>';
      for (var j = 0; j < coaches.length; j++) {
        html += '<option value="' + esc(coaches[j].id) + '"' +
          (estado.coachFiltro === coaches[j].id ? ' selected' : '') + '>' +
          esc(U.nombreCompleto(coaches[j])) + '</option>';
      }
      html += '<option value="sin_coach"' + (estado.coachFiltro === 'sin_coach' ? ' selected' : '') +
        '>Sin coach asignado</option></select></div>';
    }

    html += '</div></div></div>';
    return html;
  }

  function tarjetaSinPlanHTML(fila) {
    var socio = fila.socio;
    var coach = socio.coachId ? AG.DB.usuario(socio.coachId) : null;
    return '<div class="list-item">' +
      '<div class="list-item-main">' + personaHTML(socio) +
        '<div class="row-sm wrap mt-sm">' +
          '<span class="badge badge-warn">Sin plan</span>' +
          pill('Objetivo', etiquetaObjetivoSocio(socio.objetivo)) +
          (coach ? pill('Coach', U.nombreCompleto(coach)) : '<span class="pill">Sin coach</span>') +
        '</div>' +
      '</div>' +
      '<div class="list-item-side">' +
        '<button type="button" class="btn btn-primary btn-sm" data-editor-plan="' + esc(socio.id) + '">' +
          icono('mas', 15) + ' Crear plan</button>' +
      '</div>' +
    '</div>';
  }

  function filaConPlanHTML(fila) {
    var socio = fila.socio, plan = fila.plan;
    var coach = plan.coachId ? AG.DB.usuario(plan.coachId) : (socio.coachId ? AG.DB.usuario(socio.coachId) : null);

    return '<tr>' +
      '<td>' + personaHTML(socio) + '</td>' +
      '<td><span class="badge ' + esc(claseObjetivo(plan.objetivo)) + '">' +
        esc(nombreObjetivo(plan.objetivo)) + '</span></td>' +
      '<td class="num">' + esc(U.num(plan.kcal, 0)) + '</td>' +
      '<td class="num mini">' +
        '<span class="nowrap">P ' + esc(U.num(plan.proteina, 0)) + ' g</span> · ' +
        '<span class="nowrap">C ' + esc(U.num(plan.carbos, 0)) + ' g</span> · ' +
        '<span class="nowrap">G ' + esc(U.num(plan.grasa, 0)) + ' g</span>' +
      '</td>' +
      '<td class="num">' + esc(U.num(plan.agua, 1)) + ' L</td>' +
      '<td>' + esc(coach ? U.nombreCompleto(coach) : 'Sin coach') + '</td>' +
      '<td class="mini">' + esc(U.fecha(plan.creado, 'corto') || '—') +
        '<br><span class="muted">' + esc(U.fechaRelativa(plan.creado)) + '</span></td>' +
      '<td class="acciones">' +
        '<button type="button" class="btn-icono btn-sm" data-ver-plan="' + esc(plan.id) +
          '" title="Ver plan" aria-label="Ver plan">' + icono('ojo', 16) + '</button>' +
        '<button type="button" class="btn-icono btn-sm" data-editor-plan="' + esc(socio.id) +
          '" data-plan-id="' + esc(plan.id) + '" title="Editar plan" aria-label="Editar plan">' +
          icono('editar', 16) + '</button>' +
        '<button type="button" class="btn-icono btn-sm" data-compras-plan="' + esc(plan.id) +
          '" title="Lista de compras" aria-label="Lista de compras">' + icono('reporte', 16) + '</button>' +
        '<button type="button" class="btn-icono btn-sm" data-imprimir-plan="' + esc(plan.id) +
          '" title="Imprimir" aria-label="Imprimir">' + icono('imprimir', 16) + '</button>' +
      '</td>' +
    '</tr>';
  }

  function tabPlanesHTML(usuario) {
    var datos = calcularPlanes(usuario);

    if (!datos.total) {
      return '<div class="card"><div class="card-body">' +
        vacioHTML(usuario.rol === 'coach'
          ? 'Todavía no tienes socios asignados. En cuanto dirección te asigne socios aparecerán aquí.'
          : 'No hay socios que coincidan con el filtro. Ajusta la búsqueda o el coach seleccionado.',
          'socios', '') +
      '</div></div>';
    }

    var i, html = kpisPlanesHTML(datos);

    /* --- Socios sin plan: la tarjeta que pide acción --- */
    if (estado.objetivo) {
      html += '<div class="card"><div class="card-body">' +
        '<div class="row-sm wrap">' + icono('filtro', 15) +
        '<span class="mini muted">Filtro por objetivo «' + esc(nombreObjetivo(estado.objetivo)) +
        '» activo: solo se listan planes con ese objetivo. Quita el filtro para ver a los socios sin plan.</span>' +
        '</div>' +
      '</div></div>';
    } else if (datos.sinPlan.length) {
      var filasSin = '';
      for (i = 0; i < datos.sinPlan.length; i++) filasSin += tarjetaSinPlanHTML(datos.sinPlan[i]);
      html += '<div class="card card-rojo">' +
        '<div class="card-head">' +
          '<div class="card-title">' + icono('alerta', 18) + '<span>Socios sin plan de nutrición</span></div>' +
          '<span class="badge badge-warn">' + datos.sinPlan.length + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<p class="mini muted mb-sm">Estos socios entrenan sin plan alimenticio. Crearles uno toma tres pasos.</p>' +
          '<div class="list">' + filasSin + '</div>' +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="card"><div class="card-body">' +
        '<div class="row-sm"><span class="badge badge-ok">' + icono('check', 14) + ' Al día</span>' +
        '<span class="mini muted">Todos los socios visibles tienen su plan de nutrición activo.</span></div>' +
      '</div></div>';
    }

    /* --- Socios con plan --- */
    var cuerpo;
    if (!datos.conPlan.length) {
      cuerpo = vacioHTML(estado.objetivo
        ? 'Ningún plan activo tiene el objetivo «' + nombreObjetivo(estado.objetivo) + '».'
        : 'Todavía no hay planes activos. Crea el primero desde la lista de arriba.', 'nutricion', '');
    } else {
      var filas = '';
      for (i = 0; i < datos.conPlan.length; i++) filas += filaConPlanHTML(datos.conPlan[i]);
      cuerpo = '<div class="table-wrap scroll-x"><table class="table">' +
        '<thead><tr>' +
          '<th>Socio</th><th>Objetivo</th><th class="num">kcal</th><th class="num">Macros</th>' +
          '<th class="num">Agua</th><th>Coach</th><th>Creado</th><th class="acciones">Acciones</th>' +
        '</tr></thead><tbody>' + filas + '</tbody></table></div>';
    }

    html += '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('nutricion', 18) + '<span>Planes activos</span></div>' +
        '<span class="badge badge-muted">' + datos.conPlan.length + '</span>' +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';

    return html;
  }

  /* =============================================================
     9. Pestaña «Alimentos»
     ============================================================= */

  function alimentosFiltrados() {
    var resultados = (Data && typeof Data.alimentosPor === 'function')
      ? Data.alimentosPor({ texto: estado.busquedaAl, categoria: estado.categoria || undefined })
      : catalogo().slice();

    var campo = estado.orden;
    if (campo === 'nombre') {
      return U.ordenar(resultados, function (a) { return normalizar(a.nombre); }, estado.dir);
    }
    return U.ordenar(resultados, function (a) { return num(a[campo]); }, estado.dir);
  }

  function tablaAlimentosHTML(resultados) {
    if (!resultados.length) {
      return vacioHTML('No encontramos alimentos con esos filtros. Borra el texto o elige otra categoría.', 'buscar', '');
    }

    var encabezados = '', i;
    for (i = 0; i < COLUMNAS.length; i++) {
      var col = COLUMNAS[i];
      var clase = 'sortable' + (col.num ? ' num' : '');
      if (estado.orden === col.clave) clase += ' ' + (estado.dir === 'asc' ? 'asc' : 'desc');
      encabezados += '<th class="' + clase + '" data-orden="' + esc(col.clave) + '" ' +
        'title="Ordenar por ' + esc(col.etiqueta) + '">' + esc(col.etiqueta) + '</th>';
    }

    var filas = '';
    var tope = Math.min(resultados.length, 120);
    for (i = 0; i < tope; i++) {
      var a = resultados[i];
      filas += '<tr>' +
        '<td><b><span class="nu-punto" style="background:' + esc(colorCategoria(a.categoria)) + '"></span>' +
          esc(a.nombre) + '</b>' +
          '<br><span class="mini muted">' + esc(nombreCategoria(a.categoria)) +
          (a.medidaCasera ? ' · ' + esc(a.medidaCasera) : '') + '</span></td>' +
        '<td class="num">' + esc(U.num(a.kcal, 0)) + '</td>' +
        '<td class="num">' + esc(U.num(a.proteina, 1)) + '</td>' +
        '<td class="num">' + esc(U.num(a.carbos, 1)) + '</td>' +
        '<td class="num">' + esc(U.num(a.grasa, 1)) + '</td>' +
        '<td class="num">' + esc(U.num(a.fibra, 1)) + '</td>' +
      '</tr>';
    }

    var pie = resultados.length > tope
      ? '<p class="mini muted mt-sm">Mostrando ' + tope + ' de ' + resultados.length +
        ' alimentos. Usa el buscador o las categorías para acotar.</p>'
      : '<p class="mini muted mt-sm">' + resultados.length +
        (resultados.length === 1 ? ' alimento' : ' alimentos') + ' · valores por 100 g o 100 ml.</p>';

    return '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
      '<thead><tr>' + encabezados + '</tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
    '</table></div>' + pie;
  }

  function calculadoraHTML() {
    var todos = U.ordenar(catalogo().slice(), function (a) { return normalizar(a.nombre); }, 'asc');
    if (!todos.length) {
      return vacioHTML('El catálogo de alimentos no está disponible.', 'calculadora', '');
    }

    if (!estado.calcAlimento || !alimento(estado.calcAlimento)) {
      estado.calcAlimento = todos[0].id;
    }

    var opciones = '', i;
    for (i = 0; i < todos.length; i++) {
      opciones += '<option value="' + esc(todos[i].id) + '"' +
        (estado.calcAlimento === todos[i].id ? ' selected' : '') + '>' +
        esc(todos[i].nombre) + ' · ' + esc(nombreCategoria(todos[i].categoria)) + '</option>';
    }

    return '<div class="form-grid dos">' +
      '<div class="field"><span class="label">Alimento</span>' +
        '<select class="select" data-calc-alimento>' + opciones + '</select></div>' +
      '<div class="field"><span class="label">Cantidad (gramos o ml)</span>' +
        '<input class="input" type="number" min="1" max="2000" step="5" data-calc-gramos value="' +
          esc(String(Math.round(num(estado.calcGramos) || 100))) + '"></div>' +
    '</div>' +
    '<div data-calc-resultado>' + resultadoCalculadoraHTML() + '</div>';
  }

  function resultadoCalculadoraHTML() {
    var a = alimento(estado.calcAlimento);
    if (!a) return vacioHTML('Elige un alimento para calcular su porción.', 'calculadora', '');

    var g = acotar(num(estado.calcGramos) || 100, 1, 2000);
    var mac = macrosDe(a.id, g);

    return '<div class="caja mt">' +
      '<div class="row-sm wrap mb-sm">' +
        '<span class="nu-punto" style="background:' + esc(colorCategoria(a.categoria)) + '"></span>' +
        '<b>' + esc(a.nombre) + '</b>' +
        '<span class="mini muted">' + esc(U.num(g, 0)) + ' ' + esc(a.unidad || 'g') + '</span>' +
        (a.medidaCasera ? '<span class="pill">' + esc(a.medidaCasera) + '</span>' : '') +
      '</div>' +
      '<div class="datos-grid">' +
        dato('Calorías', esc(U.num(mac.kcal, 0)) + ' <span class="mini muted">kcal</span>') +
        dato('Proteína', esc(U.num(mac.proteina, 1)) + ' <span class="mini muted">g</span>') +
        dato('Carbohidratos', esc(U.num(mac.carbos, 1)) + ' <span class="mini muted">g</span>') +
        dato('Grasa', esc(U.num(mac.grasa, 1)) + ' <span class="mini muted">g</span>') +
        dato('Fibra', esc(U.num(mac.fibra, 1)) + ' <span class="mini muted">g</span>') +
      '</div>' +
      '<div class="mt">' + donaMacrosHTML(mac.proteina, mac.carbos, mac.grasa, mac.kcal, 190) + '</div>' +
    '</div>';
  }

  function rankingHTML() {
    var macro = estado.macroRanking;
    var lista15 = (Data && typeof Data.buscarPorMacro === 'function') ? Data.buscarPorMacro(macro) : [];

    var chips = '<div class="chips mb">', i;
    for (i = 0; i < MACROS_RANKING.length; i++) {
      chips += '<button type="button" class="chip' + (macro === MACROS_RANKING[i].clave ? ' on' : '') +
        '" data-macro-rank="' + esc(MACROS_RANKING[i].clave) + '">' +
        esc(MACROS_RANKING[i].etiqueta) + '</button>';
    }
    chips += '</div>';

    if (!lista15.length) {
      return chips + vacioHTML('No hay alimentos con ese macro en el catálogo.', 'trofeo', '');
    }

    var color = COLOR.proteina;
    for (i = 0; i < MACROS_RANKING.length; i++) {
      if (MACROS_RANKING[i].clave === macro) color = MACROS_RANKING[i].color;
    }

    var datos = [], filas = '';
    for (i = 0; i < lista15.length; i++) {
      var a = lista15[i];
      datos.push({ etiqueta: a.nombre, valor: num(a[macro]), color: color });
      filas += '<tr>' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td>' + esc(a.nombre) + '<br><span class="mini muted">' + esc(nombreCategoria(a.categoria)) + '</span></td>' +
        '<td class="num">' + esc(U.num(a[macro], 1)) + ' g</td>' +
        '<td class="num">' + esc(U.num(a.kcal, 0)) + ' kcal</td>' +
      '</tr>';
    }

    var etiqueta = 'proteína';
    if (macro === 'carbos') etiqueta = 'carbohidratos';
    if (macro === 'grasa') etiqueta = 'grasa';

    return chips +
      '<p class="mini muted mb-sm">Los 15 alimentos con más ' + esc(etiqueta) + ' por cada 100 g del catálogo.</p>' +
      '<div class="mb">' + Charts.barras(datos, {
        horizontal: true,
        color: color,
        sufijo: ' g',
        anchoEtiquetas: 150,
        aria: 'Ranking por ' + etiqueta,
        vacio: 'Sin datos para el ranking.'
      }) + '</div>' +
      '<div class="table-wrap scroll-x"><table class="table table-compacta">' +
        '<thead><tr><th class="num">#</th><th>Alimento</th>' +
          '<th class="num">Por 100 g</th><th class="num">Energía</th></tr></thead>' +
        '<tbody>' + filas + '</tbody>' +
      '</table></div>';
  }

  function tabAlimentosHTML() {
    var resultados = alimentosFiltrados();

    return '<div class="card">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono('manzana', 18) + '<span>Catálogo de alimentos</span></div>' +
        '<span class="badge badge-muted">' + catalogo().length + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="field mb-sm">' +
          '<input class="input" type="search" data-buscar-al autocomplete="off" ' +
            'placeholder="Buscar alimento, categoría o etiqueta" aria-label="Buscar alimento" value="' +
            esc(estado.busquedaAl) + '">' +
        '</div>' +
        '<div class="mb" data-chips-categoria>' + chipsCategoriaHTML(estado.categoria, 'data-categoria') + '</div>' +
        '<div data-tabla-alimentos>' + tablaAlimentosHTML(resultados) + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="grid g2">' +
      '<div class="card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + icono('calculadora', 18) + '<span>Calculadora de porción</span></div>' +
        '</div>' +
        '<div class="card-body" data-calculadora>' + calculadoraHTML() + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + icono('trofeo', 18) + '<span>Ranking por macronutriente</span></div>' +
        '</div>' +
        '<div class="card-body" data-ranking>' + rankingHTML() + '</div>' +
      '</div>' +
    '</div>';
  }

  /* =============================================================
     10. Pantalla principal y eventos
     ============================================================= */

  var TABS = [
    { clave: 'planes', etiqueta: 'Planes', icono: 'nutricion' },
    { clave: 'alimentos', etiqueta: 'Alimentos', icono: 'manzana' }
  ];

  function tabsHTML() {
    var html = '<div class="tabs" role="tablist">', i;
    for (i = 0; i < TABS.length; i++) {
      html += '<button type="button" class="tab' + (estado.tab === TABS[i].clave ? ' active' : '') +
        '" data-tab="' + esc(TABS[i].clave) + '" role="tab" aria-selected="' +
        (estado.tab === TABS[i].clave ? 'true' : 'false') + '">' +
        icono(TABS[i].icono, 16) + '<span>' + esc(TABS[i].etiqueta) + '</span></button>';
    }
    return html + '</div>';
  }

  function cuerpoHTML(usuario) {
    return estado.tab === 'alimentos' ? tabAlimentosHTML() : tabPlanesHTML(usuario);
  }

  function render(ctx) {
    var usuario = ctx.usuario;
    asegurarEstilos();

    var html = '<div class="page" data-nutricion>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('manzana', 24) + '<span>Nutrición</span></h1>' +
          '<p class="page-sub">Arma planes alimenticios con alimentos reales y consulta el catálogo del gimnasio.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          '<button type="button" class="btn btn-primary" data-nuevo-plan>' +
            icono('mas', 16) + ' Nuevo plan</button>' +
        '</div>' +
      '</div>' +
      tabsHTML() +
      '<div data-cuerpo>' + cuerpoHTML(usuario) + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root, usuario); }
    };
  }

  /* Repinta solo el cuerpo (el buscador conserva el foco cuando conviene). */
  function repintarCuerpo(raiz, usuario) {
    var caja = raiz.querySelector('[data-cuerpo]');
    if (caja) caja.innerHTML = cuerpoHTML(usuario);
  }

  function repintarTablaAlimentos(raiz) {
    var tabla = raiz.querySelector('[data-tabla-alimentos]');
    if (tabla) tabla.innerHTML = tablaAlimentosHTML(alimentosFiltrados());
    var chips = raiz.querySelector('[data-chips-categoria]');
    if (chips) chips.innerHTML = chipsCategoriaHTML(estado.categoria, 'data-categoria');
  }

  /* Modal para elegir a qué socio se le crea el plan. */
  function selectorDeSocio(usuario) {
    var sel = { texto: '' };

    function filasHTML(texto) {
      var socios = sociosVisibles(usuario).filter(esPlaneable);
      var busca = normalizar(texto || '');
      if (busca) {
        socios = socios.filter(function (s) {
          return normalizar(U.nombreCompleto(s) + ' ' + (s.codigo || '')).indexOf(busca) >= 0;
        });
      }
      socios = U.ordenar(socios, function (s) { return normalizar(U.nombreCompleto(s)); }, 'asc');

      if (!socios.length) {
        return vacioHTML('No encontramos socios con ese nombre. Prueba con otro texto.', 'socios', '');
      }

      var html = '<div class="list">', i;
      for (i = 0; i < socios.length; i++) {
        var plan = planActivoDe(socios[i].id);
        html += '<div class="list-item">' +
          '<div class="list-item-main">' + personaHTML(socios[i]) + '</div>' +
          '<div class="list-item-side">' +
            (plan
              ? '<span class="badge badge-ok">Con plan</span>' +
                '<button type="button" class="btn btn-outline btn-sm" data-editor-plan="' + esc(socios[i].id) +
                  '" data-plan-id="' + esc(plan.id) + '">' + icono('editar', 15) + ' Editar</button>'
              : '<span class="badge badge-warn">Sin plan</span>' +
                '<button type="button" class="btn btn-primary btn-sm" data-editor-plan="' + esc(socios[i].id) + '">' +
                  icono('mas', 15) + ' Crear plan</button>') +
          '</div>' +
        '</div>';
      }
      return html + '</div>';
    }

    var cuerpo = '<div class="stack-sm" data-selector-socio>' +
      '<div class="field">' +
        '<input class="input" type="search" data-buscar-socio autocomplete="off" ' +
          'placeholder="Buscar socio" aria-label="Buscar socio">' +
      '</div>' +
      '<div class="scroll-y" data-lista-socios>' + filasHTML('') + '</div>' +
    '</div>';

    var api = U.modal({
      titulo: 'Elegir socio',
      ancho: 'lg',
      cuerpo: cuerpo,
      acciones: [{ texto: 'Cerrar', clase: 'btn-ghost' }],
      onOpen: function (root) {
        var caja = root.querySelector('[data-selector-socio]');
        if (!caja) return;
        engancharAcciones(caja);

        var refrescar = U.debounce(function () {
          var destino = caja.querySelector('[data-lista-socios]');
          if (destino) destino.innerHTML = filasHTML(sel.texto);
        }, 180);

        U.delegar(caja, 'input', '[data-buscar-socio]', function (e, el) {
          sel.texto = el.value || '';
          refrescar();
        });

        U.delegar(caja, 'click', '[data-editor-plan]', function () {
          setTimeout(function () { api.cerrar(); }, 0);
        });
      }
    });

    return api;
  }

  function enganchar(root, usuario) {
    var raiz = root.querySelector('[data-nutricion]');
    if (!raiz) return;
    asegurarEstilos();
    engancharAcciones(raiz);

    /* --- Pestañas --- */
    U.delegar(raiz, 'click', '[data-tab]', function (e, el) {
      e.preventDefault();
      var destino = el.getAttribute('data-tab');
      if (destino === estado.tab) return;
      estado.tab = destino;
      var tabs = U.$$('[data-tab]', raiz);
      for (var i = 0; i < tabs.length; i++) {
        var activa = tabs[i].getAttribute('data-tab') === destino;
        tabs[i].classList.toggle('active', activa);
        tabs[i].setAttribute('aria-selected', activa ? 'true' : 'false');
      }
      repintarCuerpo(raiz, usuario);
    });

    U.delegar(raiz, 'click', '[data-nuevo-plan]', function (e) {
      e.preventDefault();
      selectorDeSocio(usuario);
    });

    /* --- Filtros de la pestaña Planes --- */
    var buscarConRetraso = U.debounce(function () { repintarCuerpo(raiz, usuario); }, 240);

    U.delegar(raiz, 'input', '[data-buscar]', function (e, el) {
      estado.busqueda = el.value || '';
      buscarConRetraso();
    });

    U.delegar(raiz, 'change', '[data-objetivo-filtro]', function (e, el) {
      estado.objetivo = el.value || '';
      repintarCuerpo(raiz, usuario);
    });

    U.delegar(raiz, 'change', '[data-coach]', function (e, el) {
      estado.coachFiltro = el.value || '';
      repintarCuerpo(raiz, usuario);
    });

    /* --- Explorador de alimentos --- */
    var buscarAlimento = U.debounce(function () { repintarTablaAlimentos(raiz); }, 200);

    U.delegar(raiz, 'input', '[data-buscar-al]', function (e, el) {
      estado.busquedaAl = el.value || '';
      buscarAlimento();
    });

    U.delegar(raiz, 'click', '[data-categoria]', function (e, el) {
      e.preventDefault();
      estado.categoria = el.getAttribute('data-categoria') || '';
      repintarTablaAlimentos(raiz);
    });

    U.delegar(raiz, 'click', '[data-orden]', function (e, el) {
      e.preventDefault();
      var campo = el.getAttribute('data-orden');
      if (estado.orden === campo) {
        estado.dir = estado.dir === 'asc' ? 'desc' : 'asc';
      } else {
        estado.orden = campo;
        estado.dir = campo === 'nombre' ? 'asc' : 'desc';
      }
      repintarTablaAlimentos(raiz);
    });

    /* --- Calculadora de porción --- */
    function repintarCalculadora() {
      var caja = raiz.querySelector('[data-calc-resultado]');
      if (caja) caja.innerHTML = resultadoCalculadoraHTML();
    }

    U.delegar(raiz, 'change', '[data-calc-alimento]', function (e, el) {
      estado.calcAlimento = el.value || '';
      repintarCalculadora();
    });

    var recalcularPorcion = U.debounce(repintarCalculadora, 260);
    U.delegar(raiz, 'input', '[data-calc-gramos]', function (e, el) {
      var v = n0(el.value);
      estado.calcGramos = (v !== null && v > 0) ? acotar(v, 1, 2000) : 100;
      recalcularPorcion();
    });

    /* --- Ranking por macro --- */
    U.delegar(raiz, 'click', '[data-macro-rank]', function (e, el) {
      e.preventDefault();
      estado.macroRanking = el.getAttribute('data-macro-rank') || 'proteina';
      var caja = raiz.querySelector('[data-ranking]');
      if (caja) caja.innerHTML = rankingHTML();
    });
  }

  /* =============================================================
     11. Exposición y registro de rutas
     ============================================================= */

  AG.Mod.Nutricion = {
    render: render,
    editorPlan: editorPlan,
    planHTML: planHTML,
    generarMenu: generarMenu,
    engancharAcciones: engancharAcciones,
    verPlan: verPlan,
    imprimirPlan: imprimirPlan,
    listaCompras: listaCompras,
    selectorAlimento: selectorAlimento,
    selectorDeSocio: selectorDeSocio
  };

  AG.Router.registrar({
    path: 'director/nutricion',
    roles: ['director'],
    titulo: 'Nutrición',
    nav: { etiqueta: 'Nutrición', icono: 'manzana', grupo: 'Entrenamiento', orden: 4 },
    render: render
  });

  AG.Router.registrar({
    path: 'coach/nutricion',
    roles: ['coach'],
    titulo: 'Nutrición',
    nav: { etiqueta: 'Nutrición', icono: 'manzana', grupo: 'Entrenamiento', orden: 4 },
    render: render
  });
})(window.AG);
