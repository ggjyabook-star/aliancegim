/* =============================================================
   ALLIANCE GYM — AG.Calc
   Motor de cálculo fisiológico, nutricional y de negocio.
   Es el "cerebro" del sistema: aquí vive TODA la matemática.

   Reglas de este archivo:
   - JavaScript clásico (ES5), sin módulos, sin dependencias externas.
   - Solo depende de AG.Utils (y, de forma defensiva y opcional, de
     AG.DB.state.settings para los días de gracia de pago).
   - Ninguna función lanza excepciones: ante datos faltantes devuelve
     null (valores numéricos) o una estructura vacía coherente.
   - Convención: null = "no se puede calcular con los datos dados".
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  var Calc = {};

  /* =========================================================
     1. CONSTANTES DE DOMINIO
     ========================================================= */

  /* Multiplicadores de gasto energético por nivel de actividad */
  var FACTORES_ACTIVIDAD = {
    sedentario: 1.2,
    ligero: 1.375,
    moderado: 1.55,
    alto: 1.725,
    atleta: 1.9
  };

  /* Litros extra de agua al día según el desgaste de la actividad */
  var AGUA_EXTRA_L = {
    sedentario: 0,
    ligero: 0.25,
    moderado: 0.5,
    alto: 0.75,
    atleta: 1
  };

  /* Etiquetas legibles para la interfaz */
  var ETIQUETA_ACTIVIDAD = {
    sedentario: 'Sedentario (poco o nada de ejercicio)',
    ligero: 'Ligero (1 a 3 días por semana)',
    moderado: 'Moderado (3 a 5 días por semana)',
    alto: 'Alto (6 a 7 días por semana)',
    atleta: 'Atleta (doble sesión o trabajo físico)'
  };

  var ETIQUETA_OBJETIVO = {
    perder_grasa: 'Perder grasa',
    ganar_musculo: 'Ganar músculo',
    mantener: 'Mantener',
    rendimiento: 'Rendimiento',
    salud: 'Salud general'
  };

  /* Ajuste calórico por objetivo y agresividad (fracción del TDEE) */
  var AJUSTE_CALORICO = {
    definir: { suave: -0.15, moderada: -0.20, agresiva: -0.25 },
    volumen: { suave: 0.10, moderada: 0.15, agresiva: 0.20 },
    mantener: { suave: 0, moderada: 0, agresiva: 0 }
  };

  /* Proteína en gramos por kilo de peso corporal */
  var PROTEINA_POR_KG = { mantener: 1.8, definir: 2.2, volumen: 2.0 };

  /* Porcentaje de las calorías que aporta la grasa */
  var PCT_GRASA = { mantener: 0.25, definir: 0.22, volumen: 0.25 };

  var KCAL_POR_KG_GRASA = 7700;   /* energía almacenada en 1 kg de grasa */
  var KCAL_MINIMAS = 1200;        /* piso de seguridad para cualquier plan */

  Calc.FACTORES_ACTIVIDAD = FACTORES_ACTIVIDAD;
  Calc.ETIQUETA_ACTIVIDAD = ETIQUETA_ACTIVIDAD;
  Calc.ETIQUETA_OBJETIVO = ETIQUETA_OBJETIVO;
  Calc.KCAL_POR_KG_GRASA = KCAL_POR_KG_GRASA;

  /* =========================================================
     2. AYUDANTES INTERNOS (números, fechas, textos)
     ========================================================= */

  /* Convierte cualquier entrada a número finito o null */
  function num(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return (typeof x === 'number' && isFinite(x)) ? x : null;
  }

  /* Número estrictamente positivo o null */
  function pos(v) {
    var x = num(v);
    return (x !== null && x > 0) ? x : null;
  }

  /* Redondeo seguro a "dec" decimales (1 por defecto) */
  function red(v, dec) {
    var x = num(v);
    if (x === null) return null;
    var d = (dec === undefined || dec === null) ? 1 : dec;
    var f = Math.pow(10, d);
    return Math.round(x * f) / f;
  }

  /* Acota un número entre mínimo y máximo */
  function limitar(v, min, max) {
    var x = num(v);
    if (x === null) return null;
    if (x < min) return min;
    if (x > max) return max;
    return x;
  }

  /* Logaritmo base 10 compatible con navegadores viejos */
  function log10(x) {
    if (!(x > 0)) return null;
    return Math.log(x) / Math.LN10;
  }

  /* true si el sexo corresponde a mujer ('M' del contrato) */
  function esMujer(sexo) {
    var s = String(sexo === null || sexo === undefined ? '' : sexo).trim().toLowerCase();
    return s === 'm' || s === 'f' || s.indexOf('muj') === 0 || s.indexOf('fem') === 0 || s === 'female';
  }

  /* Normaliza el nivel de actividad a una de las 5 llaves válidas */
  function normalizarActividad(nivel) {
    var s = String(nivel === null || nivel === undefined ? '' : nivel).trim().toLowerCase();
    if (FACTORES_ACTIVIDAD[s] !== undefined) return s;
    if (s === 'bajo' || s === 'leve') return 'ligero';
    if (s === 'medio' || s === 'normal') return 'moderado';
    if (s === 'intenso' || s === 'muy_alto') return 'alto';
    if (s === 'deportista' || s === 'competencia') return 'atleta';
    return 'ligero'; /* valor prudente cuando no se conoce el dato */
  }

  /* Normaliza el objetivo nutricional a 'definir' | 'volumen' | 'mantener' */
  function normalizarObjetivoNutricional(objetivo) {
    var s = String(objetivo === null || objetivo === undefined ? '' : objetivo).trim().toLowerCase();
    if (s === 'definir' || s === 'volumen' || s === 'mantener') return s;
    if (s === 'perder_grasa' || s === 'deficit' || s === 'bajar' || s === 'definicion') return 'definir';
    if (s === 'ganar_musculo' || s === 'superavit' || s === 'subir' || s === 'masa') return 'volumen';
    return 'mantener';
  }

  /* Normaliza el objetivo del socio */
  function normalizarObjetivoSocio(objetivo) {
    var s = String(objetivo === null || objetivo === undefined ? '' : objetivo).trim().toLowerCase();
    if (ETIQUETA_OBJETIVO[s]) return s;
    if (s === 'definir' || s === 'deficit') return 'perder_grasa';
    if (s === 'volumen' || s === 'superavit') return 'ganar_musculo';
    return 'mantener';
  }

  /* Fecha 'YYYY-MM-DD' | Date | ISO -> Date local a medianoche, o null */
  function aFecha(v) {
    if (!v) return null;
    if (v instanceof Date) return isFinite(v.getTime()) ? v : null;
    var s = String(v);
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) {
      var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return isFinite(d.getTime()) ? d : null;
    }
    var f = new Date(s);
    return isFinite(f.getTime()) ? f : null;
  }

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  /* Date -> 'YYYY-MM-DD' */
  function aISO(d) {
    if (!(d instanceof Date) || !isFinite(d.getTime())) return null;
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }

  /* Fecha de hoy en 'YYYY-MM-DD' (usa AG.Utils si está disponible) */
  function hoyISO() {
    if (AG.Utils && typeof AG.Utils.hoy === 'function') {
      try {
        var h = AG.Utils.hoy();
        if (/^\d{4}-\d{2}-\d{2}/.test(String(h))) return String(h).slice(0, 10);
      } catch (e) { /* se ignora y se usa el cálculo local */ }
    }
    return aISO(new Date());
  }

  /* Días de "a" hasta "b" (positivo si b es posterior). null si falta dato */
  function diasEntre(a, b) {
    var fa = aFecha(a), fb = aFecha(b);
    if (!fa || !fb) return null;
    return Math.round((fb.getTime() - fa.getTime()) / 86400000);
  }

  /* Meses completos entre dos fechas (aproximación por calendario) */
  function mesesEntre(a, b) {
    var fa = aFecha(a), fb = aFecha(b);
    if (!fa || !fb) return null;
    var meses = (fb.getFullYear() - fa.getFullYear()) * 12 + (fb.getMonth() - fa.getMonth());
    if (fb.getDate() < fa.getDate()) meses -= 1;
    return meses;
  }

  /* Suma meses a una fecha ISO y devuelve ISO */
  function sumarMeses(fechaISO, n) {
    var f = aFecha(fechaISO);
    if (!f) return null;
    var dia = f.getDate();
    var d = new Date(f.getFullYear(), f.getMonth() + (num(n) || 0), 1);
    var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return aISO(d);
  }

  /* Suma días a una fecha ISO y devuelve ISO */
  function sumarDias(fechaISO, n) {
    var f = aFecha(fechaISO);
    if (!f) return null;
    f.setDate(f.getDate() + (num(n) || 0));
    return aISO(f);
  }

  /* Formatea un número para textos en español */
  function txt(v, dec) {
    var d = (dec === undefined || dec === null) ? 1 : dec;
    var x = red(v, d);
    if (x === null) return '0';
    if (AG.Utils && typeof AG.Utils.num === 'function') {
      try {
        var s = AG.Utils.num(x, d);
        if (s !== null && s !== undefined && s !== '') return String(s);
      } catch (e) { /* se ignora y se usa toFixed */ }
    }
    return x.toFixed(d);
  }

  /* Une frases: 'a', 'a y b', 'a, b y c' */
  function unir(lista) {
    var l = (lista || []).filter(function (t) { return !!t; });
    if (!l.length) return '';
    if (l.length === 1) return l[0];
    return l.slice(0, l.length - 1).join(', ') + ' y ' + l[l.length - 1];
  }

  /* Ajustes globales con valores por defecto (AG.DB puede no existir aún) */
  function ajustes() {
    var s = null;
    try { s = (AG.DB && AG.DB.state) ? AG.DB.state.settings : null; } catch (e) { s = null; }
    return s && typeof s === 'object' ? s : {};
  }

  /* Reparte "total" entero según pesos, garantizando que la suma cuadre */
  function repartirEntero(total, pesos) {
    var t = Math.round(num(total) || 0);
    var salida = [], restos = [], sumaPesos = 0, i;
    for (i = 0; i < pesos.length; i++) sumaPesos += (num(pesos[i]) || 0);
    if (sumaPesos <= 0 || t <= 0) {
      for (i = 0; i < pesos.length; i++) salida.push(0);
      return salida;
    }
    var acumulado = 0;
    for (i = 0; i < pesos.length; i++) {
      var exacto = t * (num(pesos[i]) || 0) / sumaPesos;
      var entero = Math.floor(exacto);
      salida.push(entero);
      restos.push({ i: i, r: exacto - entero });
      acumulado += entero;
    }
    var faltan = t - acumulado;
    restos.sort(function (a, b) { return b.r - a.r; });
    for (i = 0; i < faltan && restos.length; i++) salida[restos[i % restos.length].i] += 1;
    return salida;
  }

  /* Devuelve siempre un arreglo utilizable (nunca null ni un string) */
  function aLista(v) {
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }

  /* Lee una propiedad por ruta ('medidas.cintura') sin reventar */
  function porRuta(obj, ruta) {
    if (!obj || !ruta) return null;
    var partes = String(ruta).split('.'), actual = obj, i;
    for (i = 0; i < partes.length; i++) {
      if (actual === null || actual === undefined) return null;
      actual = actual[partes[i]];
    }
    return num(actual);
  }

  Calc.diasEntre = diasEntre;
  Calc.objetivoNutricional = normalizarObjetivoNutricional;

  /* =========================================================
     3. COMPOSICIÓN CORPORAL
     ========================================================= */

  /* Índice de masa corporal: kg / m². Tolera estatura en metros. */
  Calc.imc = function (pesoKg, estaturaCm) {
    var p = pos(pesoKg), e = pos(estaturaCm);
    if (p === null || e === null) return null;
    var metros = e < 3 ? e : e / 100;   /* 1.75 y 175 son ambos válidos */
    if (!(metros > 0.5) || metros > 2.7) return null;
    return red(p / (metros * metros), 1);
  };

  /* Clasificación del IMC con clase de badge del contrato de CSS */
  Calc.clasificacionIMC = function (imc) {
    var v = num(imc);
    if (v === null || v <= 0) return { texto: 'Sin datos', clase: 'badge-muted', nivel: 'sin_datos' };
    if (v < 16) return { texto: 'Delgadez severa', clase: 'badge-danger', nivel: 'delgadez_severa' };
    if (v < 18.5) return { texto: 'Bajo peso', clase: 'badge-warn', nivel: 'bajo_peso' };
    if (v < 25) return { texto: 'Peso saludable', clase: 'badge-ok', nivel: 'saludable' };
    if (v < 30) return { texto: 'Sobrepeso', clase: 'badge-warn', nivel: 'sobrepeso' };
    if (v < 35) return { texto: 'Obesidad grado I', clase: 'badge-danger', nivel: 'obesidad_1' };
    if (v < 40) return { texto: 'Obesidad grado II', clase: 'badge-danger', nivel: 'obesidad_2' };
    return { texto: 'Obesidad grado III', clase: 'badge-danger', nivel: 'obesidad_3' };
  };

  /* Masa magra = peso - masa grasa */
  Calc.masaMagra = function (peso, grasaPct) {
    var p = pos(peso), g = num(grasaPct);
    if (p === null || g === null || g < 0 || g > 75) return null;
    return red(p * (1 - g / 100), 1);
  };

  /* Masa grasa en kilos */
  Calc.masaGrasa = function (peso, grasaPct) {
    var p = pos(peso), g = num(grasaPct);
    if (p === null || g === null || g < 0 || g > 75) return null;
    return red(p * g / 100, 1);
  };

  /* Grasa corporal por método US Navy (medidas en cm, logaritmo base 10) */
  Calc.grasaCorporalNavy = function (sexo, cintura, cuello, cadera, estaturaCm) {
    var c = pos(cintura), n = pos(cuello), h = pos(cadera), e = pos(estaturaCm);
    if (c === null || n === null || e === null) return null;
    if (e < 3) e = e * 100;                       /* aceptar metros */
    var lgEst = log10(e);
    if (lgEst === null) return null;
    var resultado = null;

    if (esMujer(sexo)) {
      if (h === null) return null;                /* la mujer requiere cadera */
      var sumaM = c + h - n;
      var lgM = log10(sumaM);
      if (lgM === null) return null;
      var denomM = 1.29579 - 0.35004 * lgM + 0.22100 * lgEst;
      if (!(denomM > 0)) return null;
      resultado = 495 / denomM - 450;
    } else {
      var restoH = c - n;
      var lgH = log10(restoH);
      if (lgH === null) return null;              /* cintura debe superar al cuello */
      var denomH = 1.0324 - 0.19077 * lgH + 0.15456 * lgEst;
      if (!(denomH > 0)) return null;
      resultado = 495 / denomH - 450;
    }

    if (resultado === null || !isFinite(resultado)) return null;
    return red(limitar(resultado, 3, 65), 1);
  };

  /*
     Grasa corporal por pliegues cutáneos (mm).
     Se usa la ecuación generalizada de Jackson-Pollock para densidad
     corporal y después la fórmula de Siri (%grasa = 495/D − 450).
     El contrato maneja 5 pliegues (tríceps, subescapular, suprailiaco,
     abdominal, muslo); la ecuación generalizada está calibrada sobre 7
     sitios, por lo que la suma disponible se escala proporcionalmente.
     Requiere al menos 3 pliegues válidos.
  */
  Calc.grasaCorporalPliegues = function (sexo, edad, pliegues) {
    if (!pliegues || typeof pliegues !== 'object') return null;
    var sitios = ['triceps', 'subescapular', 'suprailiaco', 'abdominal', 'muslo'];
    var suma = 0, cuantos = 0, i, v;
    for (i = 0; i < sitios.length; i++) {
      v = pos(pliegues[sitios[i]]);
      if (v !== null && v < 100) { suma += v; cuantos++; }
    }
    if (cuantos < 3 || suma <= 0) return null;

    var edadN = num(edad);
    if (edadN === null || edadN < 10 || edadN > 100) edadN = 30;   /* edad prudente por defecto */

    var s7 = suma * (7 / cuantos);        /* suma equivalente a 7 pliegues */
    var densidad;
    if (esMujer(sexo)) {
      densidad = 1.097 - 0.00046971 * s7 + 0.00000056 * s7 * s7 - 0.00012828 * edadN;
    } else {
      densidad = 1.112 - 0.00043499 * s7 + 0.00000055 * s7 * s7 - 0.00028826 * edadN;
    }
    if (!(densidad > 0.9) || densidad > 1.15) return null;

    var grasa = 495 / densidad - 450;     /* Siri */
    if (!isFinite(grasa)) return null;
    return red(limitar(grasa, 3, 65), 1);
  };

  /* Rango de peso saludable por IMC 18.5–24.9 + referencia de Devine */
  Calc.pesoIdeal = function (estaturaCm, sexo) {
    var e = pos(estaturaCm);
    if (e === null) return { min: null, max: null, devine: null, texto: 'Falta la estatura para calcular el peso ideal.' };
    if (e < 3) e = e * 100;
    var m = e / 100;
    if (!(m > 0.5) || m > 2.7) return { min: null, max: null, devine: null, texto: 'La estatura registrada no es válida.' };

    var min = red(18.5 * m * m, 1);
    var max = red(24.9 * m * m, 1);

    /* Devine: 50 kg (H) / 45.5 kg (M) + 2.3 kg por pulgada arriba de 152.4 cm */
    var pulgadasExtra = (e - 152.4) / 2.54;
    var base = esMujer(sexo) ? 45.5 : 50;
    var devine = red(Math.max(30, base + 2.3 * pulgadasExtra), 1);

    return {
      min: min,
      max: max,
      devine: devine,
      texto: 'Entre ' + txt(min, 1) + ' y ' + txt(max, 1) + ' kg (referencia clínica: ' + txt(devine, 1) + ' kg).'
    };
  };

  /* =========================================================
     4. ENERGÍA, CALORÍAS Y MACRONUTRIENTES
     ========================================================= */

  /* Tasa metabólica basal — Mifflin-St Jeor */
  Calc.tmb = function (peso, estatura, edad, sexo) {
    var p = pos(peso), e = pos(estatura), a = num(edad);
    if (p === null || e === null || a === null) return null;
    if (e < 3) e = e * 100;
    if (a < 5 || a > 110) return null;
    var base = 10 * p + 6.25 * e - 5 * a;
    var resultado = esMujer(sexo) ? base - 161 : base + 5;
    if (!(resultado > 0)) return null;
    return Math.round(resultado);
  };

  /* Multiplicador de actividad física */
  Calc.factorActividad = function (nivel) {
    return FACTORES_ACTIVIDAD[normalizarActividad(nivel)];
  };

  /* Gasto energético total diario */
  Calc.tdee = function (peso, estatura, edad, sexo, nivelActividad) {
    var tmb = Calc.tmb(peso, estatura, edad, sexo);
    if (tmb === null) return null;
    return Math.round(tmb * Calc.factorActividad(nivelActividad));
  };

  /*
     Calorías objetivo.
     objetivo: 'definir' | 'volumen' | 'mantener' (acepta también los
     objetivos del socio: 'perder_grasa' | 'ganar_musculo' | 'mantener').
     agresividad: 'suave' | 'moderada' | 'agresiva'.
     tmbRef (opcional): TMB real del socio, para no bajar nunca de ella.
  */
  Calc.caloriasObjetivo = function (tdee, objetivo, agresividad, tmbRef) {
    var t = pos(tdee);
    if (t === null) return null;

    var obj = normalizarObjetivoNutricional(objetivo);
    var ag = String(agresividad === null || agresividad === undefined ? '' : agresividad).trim().toLowerCase();
    if (ag === 'agresivo') ag = 'agresiva';
    if (ag === 'moderado') ag = 'moderada';
    if (ag === 'suave' || ag === 'ligera' || ag === 'ligero') ag = 'suave';
    if (ag !== 'suave' && ag !== 'agresiva') ag = 'moderada';

    var ajuste = AJUSTE_CALORICO[obj][ag];
    var kcal = t * (1 + ajuste);

    /* Nunca por debajo de la TMB ni del piso de seguridad */
    var piso = pos(tmbRef);
    if (piso === null) piso = t / FACTORES_ACTIVIDAD.ligero;   /* TMB estimada */
    piso = Math.max(piso, KCAL_MINIMAS);
    if (kcal < piso) kcal = Math.min(piso, t);                 /* jamás por encima del TDEE al definir */
    if (obj === 'definir' && kcal > t) kcal = t;

    return Math.round(kcal / 10) * 10;   /* cifras redondas, más legibles */
  };

  /*
     Reparto de macronutrientes.
     Proteína por kilo (1.8 mantener / 2.2 definir / 2.0 volumen),
     grasa como porcentaje de las calorías (22 % definir, 25 % resto) y
     el remanente en carbohidratos. Se ajusta para que la suma cuadre
     con las calorías objetivo (±5 kcal).
  */
  Calc.macros = function (kcal, objetivo, pesoKg) {
    var k = pos(kcal);
    var obj = normalizarObjetivoNutricional(objetivo);
    var p = pos(pesoKg);

    if (k === null) {
      return { kcal: 0, proteina: 0, carbos: 0, grasa: 0, pctP: 0, pctC: 0, pctG: 0,
               kcalP: 0, kcalC: 0, kcalG: 0, gProteinaPorKg: 0, objetivo: obj };
    }

    /* Gramos de proteína: por kilo si hay peso, si no por porcentaje */
    var gProteina;
    if (p !== null) {
      gProteina = PROTEINA_POR_KG[obj] * p;
    } else {
      gProteina = (obj === 'definir' ? 0.30 : 0.25) * k / 4;
    }

    var gGrasa = PCT_GRASA[obj] * k / 9;

    /* La proteína y la grasa juntas no pueden comerse todo el plan:
       se deja al menos 20 % de las calorías para los carbohidratos. */
    var techo = k * 0.80;
    var kcalPG = gProteina * 4 + gGrasa * 9;
    if (kcalPG > techo && kcalPG > 0) {
      var escala = techo / kcalPG;
      gProteina = gProteina * escala;
      gGrasa = gGrasa * escala;
    }

    /* Mínimo fisiológico de grasa: 15 % de las calorías */
    var minGrasa = k * 0.15 / 9;
    if (gGrasa < minGrasa) gGrasa = minGrasa;

    var proteina = Math.round(gProteina);
    var grasa = Math.round(gGrasa);
    var carbos = Math.round((k - proteina * 4 - grasa * 9) / 4);
    if (carbos < 0) carbos = 0;

    var kcalP = proteina * 4, kcalC = carbos * 4, kcalG = grasa * 9;
    var total = kcalP + kcalC + kcalG;

    /* Ajuste fino: cerrar cualquier diferencia mayor a 5 kcal */
    var dif = k - total;
    if (Math.abs(dif) > 5) {
      carbos = Math.max(0, carbos + Math.round(dif / 4));
      kcalC = carbos * 4;
      total = kcalP + kcalC + kcalG;
      dif = k - total;
      if (Math.abs(dif) > 5) {
        grasa = Math.max(0, grasa + Math.round(dif / 9));
        kcalG = grasa * 9;
        total = kcalP + kcalC + kcalG;
      }
    }

    var pctP = total > 0 ? Math.round(kcalP / total * 100) : 0;
    var pctG = total > 0 ? Math.round(kcalG / total * 100) : 0;
    var pctC = 100 - pctP - pctG;
    if (pctC < 0) { pctC = 0; pctG = Math.max(0, 100 - pctP); }

    return {
      kcal: Math.round(total),
      kcalObjetivo: Math.round(k),
      proteina: proteina,
      carbos: carbos,
      grasa: grasa,
      pctP: pctP,
      pctC: pctC,
      pctG: pctG,
      kcalP: kcalP,
      kcalC: kcalC,
      kcalG: kcalG,
      gProteinaPorKg: p !== null ? red(proteina / p, 1) : null,
      objetivo: obj
    };
  };

  /* Plantillas de comidas: nombre, hora y reparto porcentual por macro */
  var PLANTILLAS_COMIDAS = {
    3: [
      { nombre: 'Desayuno', hora: '07:30', p: 30, c: 32, g: 28 },
      { nombre: 'Comida', hora: '14:00', p: 40, c: 40, g: 40 },
      { nombre: 'Cena', hora: '20:30', p: 30, c: 28, g: 32 }
    ],
    4: [
      { nombre: 'Desayuno', hora: '07:30', p: 25, c: 29, g: 26 },
      { nombre: 'Colación', hora: '10:30', p: 15, c: 12, g: 12 },
      { nombre: 'Comida', hora: '14:00', p: 35, c: 36, g: 36 },
      { nombre: 'Cena', hora: '20:30', p: 25, c: 23, g: 26 }
    ],
    5: [
      { nombre: 'Desayuno', hora: '07:30', p: 24, c: 26, g: 26 },
      { nombre: 'Colación', hora: '10:30', p: 12, c: 12, g: 12 },
      { nombre: 'Comida', hora: '14:00', p: 30, c: 30, g: 32 },
      { nombre: 'Pre-entreno', hora: '17:00', p: 12, c: 17, g: 6 },
      { nombre: 'Cena', hora: '20:30', p: 22, c: 15, g: 24 }
    ],
    6: [
      { nombre: 'Desayuno', hora: '07:30', p: 20, c: 24, g: 22 },
      { nombre: 'Colación', hora: '10:30', p: 10, c: 10, g: 10 },
      { nombre: 'Comida', hora: '14:00', p: 27, c: 27, g: 28 },
      { nombre: 'Pre-entreno', hora: '17:00', p: 11, c: 16, g: 5 },
      { nombre: 'Cena', hora: '20:30', p: 20, c: 15, g: 23 },
      { nombre: 'Colación nocturna', hora: '22:00', p: 12, c: 8, g: 12 }
    ]
  };

  /*
     Distribuye los macros del día entre 3, 4, 5 o 6 comidas con horarios
     reales y un reparto sensato (la comida fuerte concentra más, el
     pre-entreno carga carbohidratos y baja grasa, etc.).
  */
  Calc.distribucionComidas = function (macros, numComidas) {
    var m = macros && typeof macros === 'object' ? macros : {};
    var n = Math.round(num(numComidas) || 4);
    if (n < 3) n = 3;
    if (n > 6) n = 6;

    var plantilla = PLANTILLAS_COMIDAS[n];
    var totalP = Math.max(0, Math.round(num(m.proteina) || 0));
    var totalC = Math.max(0, Math.round(num(m.carbos) || 0));
    var totalG = Math.max(0, Math.round(num(m.grasa) || 0));

    var pesosP = [], pesosC = [], pesosG = [], i;
    for (i = 0; i < plantilla.length; i++) {
      pesosP.push(plantilla[i].p);
      pesosC.push(plantilla[i].c);
      pesosG.push(plantilla[i].g);
    }

    var repP = repartirEntero(totalP, pesosP);
    var repC = repartirEntero(totalC, pesosC);
    var repG = repartirEntero(totalG, pesosG);

    var kcalTotal = totalP * 4 + totalC * 4 + totalG * 9;
    var salida = [];
    for (i = 0; i < plantilla.length; i++) {
      var kcalComida = repP[i] * 4 + repC[i] * 4 + repG[i] * 9;
      salida.push({
        nombre: plantilla[i].nombre,
        hora: plantilla[i].hora,
        kcal: kcalComida,
        proteina: repP[i],
        carbos: repC[i],
        grasa: repG[i],
        pct: kcalTotal > 0 ? red(kcalComida / kcalTotal * 100, 0) : 0
      });
    }
    return salida;
  };

  /* Agua recomendada al día en litros: 35 ml/kg + extra por actividad */
  Calc.aguaDiaria = function (pesoKg, nivelActividad) {
    var p = pos(pesoKg);
    if (p === null) return null;
    var nivel = normalizarActividad(nivelActividad);
    var litros = (p * 35) / 1000 + AGUA_EXTRA_L[nivel];
    return red(limitar(litros, 1, 8), 1);
  };

  /* =========================================================
     5. FUERZA Y CARDIO
     ========================================================= */

  /* Repetición máxima estimada — fórmula de Epley */
  Calc.rm1 = function (peso, reps) {
    var p = pos(peso), r = num(reps);
    if (p === null) return null;
    if (r === null || r <= 1) return red(p, 1);
    if (r > 30) r = 30;                       /* más allá la fórmula pierde validez */
    return red(p * (1 + r / 30), 1);
  };

  var PORCENTAJES_RM = [
    { pct: 100, reps: 1 },
    { pct: 95, reps: 2 },
    { pct: 90, reps: 4 },
    { pct: 85, reps: 6 },
    { pct: 80, reps: 8 },
    { pct: 75, reps: 10 },
    { pct: 70, reps: 12 },
    { pct: 65, reps: 16 },
    { pct: 60, reps: 20 }
  ];

  /* Tabla de trabajo por porcentaje del 1RM */
  Calc.tablaRM = function (rm1) {
    var r = pos(rm1);
    if (r === null) return [];
    var salida = [], i;
    for (i = 0; i < PORCENTAJES_RM.length; i++) {
      salida.push({
        pct: PORCENTAJES_RM[i].pct,
        peso: red(r * PORCENTAJES_RM[i].pct / 100, 1),
        reps: PORCENTAJES_RM[i].reps
      });
    }
    return salida;
  };

  /* Frecuencia cardiaca máxima teórica */
  Calc.fcMaxima = function (edad) {
    var a = num(edad);
    if (a === null || a < 5 || a > 100) return null;
    return Math.round(220 - a);
  };

  var ZONAS = [
    { clave: 'z1', nombre: 'Zona 1 · Recuperación', min: 0.50, max: 0.60, color: '#4aa3ff', descripcion: 'Calentamiento y regeneración activa.' },
    { clave: 'z2', nombre: 'Zona 2 · Quema de grasa', min: 0.60, max: 0.70, color: '#2ecc71', descripcion: 'Base aeróbica, la grasa es el combustible principal.' },
    { clave: 'z3', nombre: 'Zona 3 · Aeróbica', min: 0.70, max: 0.80, color: '#f1c40f', descripcion: 'Mejora la resistencia y la capacidad cardiaca.' },
    { clave: 'z4', nombre: 'Zona 4 · Umbral', min: 0.80, max: 0.90, color: '#f39c12', descripcion: 'Trabajo intenso, tolerancia al lactato.' },
    { clave: 'z5', nombre: 'Zona 5 · Máxima', min: 0.90, max: 1.00, color: '#e4322b', descripcion: 'Esfuerzo máximo, solo intervalos cortos.' }
  ];

  /* Zonas de entrenamiento cardiaco a partir de la edad */
  Calc.zonasCardio = function (edad) {
    var fcMax = Calc.fcMaxima(edad);
    if (fcMax === null) return [];
    var salida = [], i;
    for (i = 0; i < ZONAS.length; i++) {
      salida.push({
        clave: ZONAS[i].clave,
        nombre: ZONAS[i].nombre,
        min: Math.round(fcMax * ZONAS[i].min),
        max: Math.round(fcMax * ZONAS[i].max),
        pctMin: Math.round(ZONAS[i].min * 100),
        pctMax: Math.round(ZONAS[i].max * 100),
        color: ZONAS[i].color,
        descripcion: ZONAS[i].descripcion,
        fcMax: fcMax
      });
    }
    return salida;
  };

  /* =========================================================
     6. COMPARATIVO DE MEDICIONES (la función estrella)
     ========================================================= */

  /*
     Cada campo declara:
     - ruta: dónde vive el dato en la medición normalizada
     - umbral: cambio mínimo para considerarlo real (ruido de báscula/cinta)
     - universal: dirección fisiológicamente buena SIEMPRE (-1 bajar, +1 subir, 0 neutro)
     - dir: dirección buena según el objetivo del socio
  */
  var CAMPOS = [
    { clave: 'peso', ruta: 'pesoKg', etiqueta: 'Peso corporal', unidad: 'kg', dec: 1, umbral: 0.2, universal: 0,
      dir: { perder_grasa: -1, ganar_musculo: 1, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'grasaPct', ruta: 'grasaPct', etiqueta: 'Grasa corporal', unidad: '%', dec: 1, umbral: 0.3, universal: -1,
      dir: { perder_grasa: -1, ganar_musculo: -1, mantener: -1, rendimiento: -1, salud: -1 } },
    { clave: 'grasaKg', ruta: 'grasaKg', etiqueta: 'Masa grasa', unidad: 'kg', dec: 1, umbral: 0.2, universal: -1,
      dir: { perder_grasa: -1, ganar_musculo: -1, mantener: -1, rendimiento: -1, salud: -1 } },
    { clave: 'musculoKg', ruta: 'musculoKg', etiqueta: 'Masa muscular', unidad: 'kg', dec: 1, umbral: 0.2, universal: 1,
      dir: { perder_grasa: 1, ganar_musculo: 1, mantener: 1, rendimiento: 1, salud: 1 } },
    { clave: 'masaMagra', ruta: 'masaMagra', etiqueta: 'Masa magra', unidad: 'kg', dec: 1, umbral: 0.2, universal: 1,
      dir: { perder_grasa: 1, ganar_musculo: 1, mantener: 1, rendimiento: 1, salud: 1 } },
    { clave: 'imc', ruta: 'imc', etiqueta: 'IMC', unidad: '', dec: 1, umbral: 0.2, universal: 0,
      dir: { perder_grasa: -1, ganar_musculo: 0, mantener: 0, rendimiento: 0, salud: -1 } },
    { clave: 'aguaPct', ruta: 'aguaPct', etiqueta: 'Agua corporal', unidad: '%', dec: 1, umbral: 0.4, universal: 1,
      dir: { perder_grasa: 1, ganar_musculo: 1, mantener: 1, rendimiento: 1, salud: 1 } },

    { clave: 'cuello', ruta: 'medidas.cuello', etiqueta: 'Cuello', unidad: 'cm', dec: 1, umbral: 0.3, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 0, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'hombros', ruta: 'medidas.hombros', etiqueta: 'Hombros', unidad: 'cm', dec: 1, umbral: 0.5, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'pecho', ruta: 'medidas.pecho', etiqueta: 'Pecho', unidad: 'cm', dec: 1, umbral: 0.5, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'brazoDer', ruta: 'medidas.brazoDer', etiqueta: 'Brazo derecho', unidad: 'cm', dec: 1, umbral: 0.3, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'brazoIzq', ruta: 'medidas.brazoIzq', etiqueta: 'Brazo izquierdo', unidad: 'cm', dec: 1, umbral: 0.3, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'cintura', ruta: 'medidas.cintura', etiqueta: 'Cintura', unidad: 'cm', dec: 1, umbral: 0.5, universal: -1,
      dir: { perder_grasa: -1, ganar_musculo: -1, mantener: -1, rendimiento: -1, salud: -1 } },
    { clave: 'cadera', ruta: 'medidas.cadera', etiqueta: 'Cadera', unidad: 'cm', dec: 1, umbral: 0.5, universal: 0,
      dir: { perder_grasa: -1, ganar_musculo: 0, mantener: 0, rendimiento: 0, salud: 0 } },
    { clave: 'musloDer', ruta: 'medidas.musloDer', etiqueta: 'Muslo derecho', unidad: 'cm', dec: 1, umbral: 0.5, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 1, salud: 0 } },
    { clave: 'musloIzq', ruta: 'medidas.musloIzq', etiqueta: 'Muslo izquierdo', unidad: 'cm', dec: 1, umbral: 0.5, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 1, salud: 0 } },
    { clave: 'pantorrilla', ruta: 'medidas.pantorrilla', etiqueta: 'Pantorrilla', unidad: 'cm', dec: 1, umbral: 0.3, universal: 0,
      dir: { perder_grasa: 0, ganar_musculo: 1, mantener: 0, rendimiento: 0, salud: 0 } },

    { clave: 'pressBanca', ruta: 'fuerza.pressBanca', etiqueta: 'Press de banca', unidad: 'kg', dec: 1, umbral: 1, universal: 1,
      dir: { perder_grasa: 1, ganar_musculo: 1, mantener: 1, rendimiento: 1, salud: 1 } },
    { clave: 'sentadilla', ruta: 'fuerza.sentadilla', etiqueta: 'Sentadilla', unidad: 'kg', dec: 1, umbral: 1, universal: 1,
      dir: { perder_grasa: 1, ganar_musculo: 1, mantener: 1, rendimiento: 1, salud: 1 } },
    { clave: 'pesoMuerto', ruta: 'fuerza.pesoMuerto', etiqueta: 'Peso muerto', unidad: 'kg', dec: 1, umbral: 1, universal: 1,
      dir: { perder_grasa: 1, ganar_musculo: 1, mantener: 1, rendimiento: 1, salud: 1 } },

    { clave: 'fcReposo', ruta: 'fcReposo', etiqueta: 'FC en reposo', unidad: 'lpm', dec: 0, umbral: 1, universal: -1,
      dir: { perder_grasa: -1, ganar_musculo: -1, mantener: -1, rendimiento: -1, salud: -1 } }
  ];

  var CLAVES_MEDIDAS = ['cuello', 'hombros', 'pecho', 'brazoDer', 'brazoIzq', 'cintura', 'cadera', 'musloDer', 'musloIzq', 'pantorrilla'];
  var CLAVES_FUERZA = ['pressBanca', 'sentadilla', 'pesoMuerto'];

  /* Convierte una medición cruda en una estructura homogénea y derivada */
  function normalizarMedicion(m) {
    if (!m || typeof m !== 'object') return null;
    var medidasIn = m.medidas && typeof m.medidas === 'object' ? m.medidas : {};
    var fuerzaIn = m.fuerza && typeof m.fuerza === 'object' ? m.fuerza : {};
    var peso = pos(m.pesoKg);
    var grasa = num(m.grasaPct);
    var estatura = pos(m.estaturaCm);

    var imc = num(m.imc);
    if (imc === null) imc = Calc.imc(peso, estatura);

    var grasaKg = null, magra = null;
    if (peso !== null && grasa !== null && grasa >= 0 && grasa <= 75) {
      grasaKg = red(peso * grasa / 100, 1);
      magra = red(peso - grasaKg, 1);
    }

    var medidas = {}, fuerza = {}, i;
    for (i = 0; i < CLAVES_MEDIDAS.length; i++) medidas[CLAVES_MEDIDAS[i]] = pos(medidasIn[CLAVES_MEDIDAS[i]]);
    for (i = 0; i < CLAVES_FUERZA.length; i++) fuerza[CLAVES_FUERZA[i]] = pos(fuerzaIn[CLAVES_FUERZA[i]]);

    return {
      fecha: m.fecha || null,
      periodo: m.periodo || null,
      pesoKg: peso,
      estaturaCm: estatura,
      grasaPct: grasa,
      grasaKg: grasaKg,
      musculoKg: pos(m.musculoKg),
      masaMagra: magra,
      aguaPct: num(m.aguaPct),
      imc: imc,
      fcReposo: pos(m.fcReposo),
      medidas: medidas,
      fuerza: fuerza
    };
  }

  /* Dirección "buena" de un campo según el objetivo (con matices) */
  function direccionCampo(campo, objetivo, ini) {
    var d = campo.dir[objetivo];
    if (d === undefined) d = campo.dir.mantener;

    /* El IMC no se juzga igual en alguien por debajo del peso saludable */
    if (campo.clave === 'imc' && ini !== null && ini < 18.5) return 1;
    if (campo.clave === 'peso' && objetivo === 'salud' && ini !== null) return 0;

    return d || 0;
  }

  /* Detecta recomposición corporal para no castigar un cambio legítimo */
  function esRecomposicion(campo, objetivo, deltas) {
    if (campo.clave !== 'peso' && campo.clave !== 'imc') return false;
    var dGrasa = deltas.grasaPct !== null ? deltas.grasaPct : deltas.grasaKg;
    var dMusculo = deltas.musculoKg !== null ? deltas.musculoKg : deltas.masaMagra;

    if (objetivo === 'perder_grasa') {
      /* Subió el peso pero la grasa bajó y el músculo no se perdió */
      return (dGrasa !== null && dGrasa < 0) && (dMusculo === null || dMusculo >= -0.1);
    }
    if (objetivo === 'ganar_musculo') {
      /* Bajó el peso pero el músculo subió */
      return (dMusculo !== null && dMusculo > 0);
    }
    return false;
  }

  /* Puntaje 0-100 de un componente: 50 = sin cambio, 100 = referencia lograda */
  function puntajeComponente(mejora, referencia) {
    if (referencia === 0) return 50;
    return limitar(50 + 50 * (mejora / referencia), 0, 100);
  }

  /*
     compararMediciones(inicial, final, objetivo)
     Devuelve el comparativo completo entre dos mediciones del socio.
     Nunca lanza: si falta alguna medición devuelve { ok:false, motivo }.
  */
  Calc.compararMediciones = function (inicial, final, objetivo) {
    var ini = normalizarMedicion(inicial);
    var fin = normalizarMedicion(final);

    if (!ini && !fin) return { ok: false, motivo: 'Todavía no hay mediciones registradas para comparar.', dias: 0, campos: [], resumen: null };
    if (!ini) return { ok: false, motivo: 'Falta la medición inicial del periodo.', dias: 0, campos: [], resumen: null };
    if (!fin) return { ok: false, motivo: 'Falta la medición de cierre del periodo.', dias: 0, campos: [], resumen: null };

    var obj = normalizarObjetivoSocio(objetivo);
    var dias = diasEntre(ini.fecha, fin.fecha);
    if (dias === null || dias < 0) dias = 0;

    /* Primera pasada: deltas crudos que necesita la lógica de matices */
    var deltas = {};
    var i, campo, a, b;
    for (i = 0; i < CAMPOS.length; i++) {
      campo = CAMPOS[i];
      a = porRuta(ini, campo.ruta);
      b = porRuta(fin, campo.ruta);
      deltas[campo.clave] = (a !== null && b !== null) ? red(b - a, 2) : null;
    }

    /* Segunda pasada: evaluación campo por campo */
    var campos = [];
    for (i = 0; i < CAMPOS.length; i++) {
      campo = CAMPOS[i];
      a = porRuta(ini, campo.ruta);
      b = porRuta(fin, campo.ruta);
      if (a === null && b === null) continue;   /* dato inexistente: no se muestra */

      var delta = (a !== null && b !== null) ? red(b - a, campo.dec === 0 ? 0 : 2) : null;
      var pct = (a !== null && b !== null && a !== 0) ? red((b - a) / Math.abs(a) * 100, 1) : 0;
      var tendencia = 'igual';

      if (delta !== null) {
        var abs = Math.abs(delta);
        var dir = direccionCampo(campo, obj, a);
        var universal = campo.universal || 0;
        var mejoraUniversal = universal !== 0 && delta * universal > 0 && abs >= campo.umbral;
        var empeoraUniversal = universal !== 0 && delta * universal < 0 && abs >= campo.umbral;

        if (obj === 'mantener') {
          /* Mantener premia la estabilidad, sin castigar mejoras reales */
          var variacion = Math.abs(pct);
          if (mejoraUniversal) tendencia = 'mejor';
          else if (abs < campo.umbral || variacion < 1) tendencia = 'mejor';
          else if (empeoraUniversal || variacion >= 3) tendencia = 'peor';
          else tendencia = 'igual';
        } else if (abs < campo.umbral) {
          tendencia = 'igual';
        } else if (dir === 0) {
          tendencia = mejoraUniversal ? 'mejor' : (empeoraUniversal ? 'peor' : 'igual');
        } else {
          tendencia = (delta * dir > 0) ? 'mejor' : 'peor';
          if (tendencia === 'peor' && (mejoraUniversal || esRecomposicion(campo, obj, deltas))) tendencia = 'igual';
        }
      }

      campos.push({
        clave: campo.clave,
        etiqueta: campo.etiqueta,
        unidad: campo.unidad,
        ini: a !== null ? red(a, campo.dec) : null,
        fin: b !== null ? red(b, campo.dec) : null,
        delta: delta !== null ? red(delta, campo.dec) : null,
        pct: pct,
        tendencia: tendencia,
        bueno: tendencia === 'mejor'
      });
    }

    /* ---- Puntaje ponderado ---- */
    var factorMes = 1;
    if (dias >= 7) factorMes = limitar(30 / dias, 0.4, 3);

    var componentes = [];

    /* Grasa (30) */
    var refGrasa = obj === 'ganar_musculo' ? 1.5 : 1.0;
    if (deltas.grasaKg !== null) {
      componentes.push({ peso: 30, valor: puntajeComponente(-deltas.grasaKg * factorMes, refGrasa) });
    } else if (deltas.grasaPct !== null) {
      componentes.push({ peso: 30, valor: puntajeComponente(-deltas.grasaPct * factorMes, refGrasa) });
    }

    /* Músculo (25) */
    var refMusculo = obj === 'ganar_musculo' ? 0.6 : (obj === 'perder_grasa' ? 0.3 : 0.4);
    var dMus = deltas.musculoKg !== null ? deltas.musculoKg : deltas.masaMagra;
    if (dMus !== null) componentes.push({ peso: 25, valor: puntajeComponente(dMus * factorMes, refMusculo) });

    /* Cintura (20) */
    if (deltas.cintura !== null) {
      var refCintura = obj === 'ganar_musculo' ? 1.5 : 2.0;
      componentes.push({ peso: 20, valor: puntajeComponente(-deltas.cintura * factorMes, refCintura) });
    }

    /* Peso (15) */
    if (deltas.peso !== null) {
      var puntajePeso;
      if (obj === 'perder_grasa') {
        puntajePeso = puntajeComponente(-deltas.peso * factorMes, 1.5);
        if (esRecomposicion({ clave: 'peso' }, obj, deltas)) puntajePeso = Math.max(puntajePeso, 65);
      } else if (obj === 'ganar_musculo') {
        puntajePeso = puntajeComponente(deltas.peso * factorMes, 0.8);
        if (esRecomposicion({ clave: 'peso' }, obj, deltas)) puntajePeso = Math.max(puntajePeso, 65);
      } else {
        var pctPeso = ini.pesoKg ? Math.abs(deltas.peso / ini.pesoKg * 100) : 0;
        puntajePeso = limitar(100 - pctPeso * 25, 0, 100);
      }
      componentes.push({ peso: 15, valor: puntajePeso });
    }

    /* Fuerza (10) */
    var sumaFuerza = 0, cuantaFuerza = 0;
    for (i = 0; i < CLAVES_FUERZA.length; i++) {
      var claveF = CLAVES_FUERZA[i];
      var iniF = ini.fuerza[claveF], finF = fin.fuerza[claveF];
      if (iniF !== null && finF !== null && iniF > 0) {
        sumaFuerza += (finF - iniF) / iniF * 100;
        cuantaFuerza++;
      }
    }
    var fuerzaPct = cuantaFuerza ? red(sumaFuerza / cuantaFuerza, 1) : null;
    if (fuerzaPct !== null) componentes.push({ peso: 10, valor: puntajeComponente(fuerzaPct * factorMes, 5) });

    var sumaPesos = 0, sumaValor = 0;
    for (i = 0; i < componentes.length; i++) {
      sumaPesos += componentes[i].peso;
      sumaValor += componentes[i].peso * componentes[i].valor;
    }
    var puntaje = sumaPesos > 0 ? Math.round(sumaValor / sumaPesos) : 50;
    puntaje = Math.round(limitar(puntaje, 0, 100));

    var nivel = puntaje >= 80 ? 'excelente' : (puntaje >= 60 ? 'bueno' : (puntaje >= 40 ? 'regular' : 'atencion'));

    var resumen = {
      pesoDelta: deltas.peso,
      grasaDelta: deltas.grasaPct,
      grasaKgDelta: deltas.grasaKg,
      musculoDelta: deltas.musculoKg !== null ? deltas.musculoKg : deltas.masaMagra,
      magraDelta: deltas.masaMagra,
      cinturaDelta: deltas.cintura,
      imcDelta: deltas.imc,
      fuerzaPct: fuerzaPct,
      puntaje: puntaje,
      nivel: nivel,
      clase: Calc.claseNivel(nivel),
      datosSuficientes: sumaPesos > 0,
      veredicto: ''
    };
    resumen.veredicto = construirVeredicto(resumen, obj, dias, sumaPesos > 0);

    return { ok: true, dias: dias, objetivo: obj, campos: campos, resumen: resumen };
  };

  /* Clase de badge para el nivel del comparativo */
  Calc.claseNivel = function (nivel) {
    if (nivel === 'excelente' || nivel === 'bueno') return 'badge-ok';
    if (nivel === 'regular') return 'badge-warn';
    if (nivel === 'atencion') return 'badge-danger';
    return 'badge-muted';
  };

  /* Etiqueta legible del nivel */
  Calc.textoNivel = function (nivel) {
    return { excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', atencion: 'Requiere atención' }[nivel] || 'Sin datos';
  };

  /* Redacta el veredicto humano y motivador del comparativo */
  function construirVeredicto(r, objetivo, dias, hayDatos) {
    if (!hayDatos) {
      return 'Faltan datos para evaluar el periodo: registra peso, grasa y medidas en ambas mediciones.';
    }

    var positivos = [], negativos = [];

    if (r.grasaKgDelta !== null && r.grasaKgDelta <= -0.2) positivos.push('bajaste ' + txt(-r.grasaKgDelta, 1) + ' kg de grasa');
    else if (r.grasaDelta !== null && r.grasaDelta <= -0.3) positivos.push('bajaste ' + txt(-r.grasaDelta, 1) + ' puntos de grasa corporal');
    if (r.grasaKgDelta !== null && r.grasaKgDelta >= 0.3) negativos.push('subiste ' + txt(r.grasaKgDelta, 1) + ' kg de grasa');
    else if (r.grasaDelta !== null && r.grasaDelta >= 0.4) negativos.push('subiste ' + txt(r.grasaDelta, 1) + ' puntos de grasa');

    if (r.musculoDelta !== null && r.musculoDelta >= 0.2) positivos.push('subiste ' + txt(r.musculoDelta, 1) + ' kg de músculo');
    if (r.musculoDelta !== null && r.musculoDelta <= -0.3) negativos.push('perdiste ' + txt(-r.musculoDelta, 1) + ' kg de músculo');

    if (r.cinturaDelta !== null && r.cinturaDelta <= -0.5) positivos.push('perdiste ' + txt(-r.cinturaDelta, 1) + ' cm de cintura');
    if (r.cinturaDelta !== null && r.cinturaDelta >= 1) negativos.push('creciste ' + txt(r.cinturaDelta, 1) + ' cm de cintura');

    if (r.fuerzaPct !== null && r.fuerzaPct >= 2) positivos.push('mejoraste ' + txt(r.fuerzaPct, 0) + ' % en fuerza');
    if (r.fuerzaPct !== null && r.fuerzaPct <= -3) negativos.push('bajaste ' + txt(-r.fuerzaPct, 0) + ' % en fuerza');

    if (r.pesoDelta !== null) {
      if (objetivo === 'perder_grasa' && r.pesoDelta <= -0.3) positivos.push('bajaste ' + txt(-r.pesoDelta, 1) + ' kg en la báscula');
      if (objetivo === 'ganar_musculo' && r.pesoDelta >= 0.3) positivos.push('sumaste ' + txt(r.pesoDelta, 1) + ' kg de peso');
      if (objetivo === 'mantener' && Math.abs(r.pesoDelta) <= 0.5) positivos.push('mantuviste tu peso prácticamente igual');
    }

    var encabezado = {
      excelente: 'Excelente periodo',
      bueno: 'Buen avance',
      regular: 'Periodo con altibajos',
      atencion: 'Periodo para corregir'
    }[r.nivel] || 'Resumen del periodo';

    var cierre = {
      excelente: '¡Sigue exactamente así!',
      bueno: 'Vas por buen camino, sostén la constancia.',
      regular: 'Con un par de ajustes el siguiente mes se nota mucho más.',
      atencion: 'Revisemos alimentación y asistencia para retomar el rumbo; se recupera rápido.'
    }[r.nivel] || 'Sigamos midiendo mes con mes.';

    var frase;
    if (positivos.length && negativos.length) {
      frase = encabezado + ': ' + unir(positivos.slice(0, 3)) + ', aunque ' + unir(negativos.slice(0, 2)) + '.';
    } else if (positivos.length) {
      frase = encabezado + ': ' + unir(positivos.slice(0, 3)) + '.';
    } else if (negativos.length) {
      frase = encabezado + ': ' + unir(negativos.slice(0, 3)) + '.';
    } else {
      frase = encabezado + ': tus números se mantuvieron estables' + (dias ? ' en ' + dias + ' días' : '') + '.';
    }

    return frase + ' ' + cierre;
  }

  /*
     Progreso hacia el objetivo del socio usando su historial de mediciones.
     Devuelve { pct: 0..100, texto }.
  */
  Calc.progresoObjetivo = function (socio, mediciones) {
    var vacio = { pct: 0, texto: 'Aún no hay mediciones suficientes para medir el avance.', nivel: 'sin_datos' };
    if (!socio || typeof socio !== 'object') return vacio;

    var lista = aLista(mediciones).filter(function (m) { return m && m.fecha; });
    lista.sort(function (a, b) { return String(a.fecha) < String(b.fecha) ? -1 : 1; });
    if (lista.length < 2) return vacio;

    var ini = normalizarMedicion(lista[0]);
    var act = normalizarMedicion(lista[lista.length - 1]);
    if (!ini || !act) return vacio;

    var obj = normalizarObjetivoSocio(socio.objetivo);
    var mujer = esMujer(socio.sexo);
    var pct = null, texto = '';

    if (obj === 'perder_grasa') {
      var metaGrasa = mujer ? 24 : 15;
      if (ini.grasaPct !== null && act.grasaPct !== null) {
        if (ini.grasaPct <= metaGrasa) {
          pct = 100;
          texto = 'Ya estás dentro del rango de grasa saludable, ahora toca sostenerlo.';
        } else {
          pct = limitar((ini.grasaPct - act.grasaPct) / (ini.grasaPct - metaGrasa) * 100, 0, 100);
          texto = 'Llevas ' + txt(Math.max(0, ini.grasaPct - act.grasaPct), 1) + ' puntos de grasa menos; la meta está en ' + metaGrasa + ' %.';
        }
      } else if (ini.pesoKg !== null && act.pesoKg !== null) {
        var ideal = Calc.pesoIdeal(act.estaturaCm || socio.estaturaCm, socio.sexo);
        if (ideal.max !== null && ini.pesoKg > ideal.max) {
          pct = limitar((ini.pesoKg - act.pesoKg) / (ini.pesoKg - ideal.max) * 100, 0, 100);
          texto = 'Has bajado ' + txt(Math.max(0, ini.pesoKg - act.pesoKg), 1) + ' kg rumbo a tu rango saludable.';
        }
      }
    } else if (obj === 'ganar_musculo') {
      var iniM = ini.musculoKg !== null ? ini.musculoKg : ini.masaMagra;
      var actM = act.musculoKg !== null ? act.musculoKg : act.masaMagra;
      if (iniM !== null && actM !== null) {
        pct = limitar((actM - iniM) / 3 * 100, 0, 100);   /* meta de referencia: +3 kg */
        texto = 'Has sumado ' + txt(Math.max(0, actM - iniM), 1) + ' kg de masa muscular de una meta de 3 kg.';
      } else if (ini.pesoKg !== null && act.pesoKg !== null) {
        pct = limitar((act.pesoKg - ini.pesoKg) / 4 * 100, 0, 100);
        texto = 'Has sumado ' + txt(Math.max(0, act.pesoKg - ini.pesoKg), 1) + ' kg de peso corporal.';
      }
    } else if (obj === 'rendimiento') {
      var sumaPct = 0, cuantos = 0, i;
      for (i = 0; i < CLAVES_FUERZA.length; i++) {
        var a = ini.fuerza[CLAVES_FUERZA[i]], b = act.fuerza[CLAVES_FUERZA[i]];
        if (a !== null && b !== null && a > 0) { sumaPct += (b - a) / a * 100; cuantos++; }
      }
      if (cuantos) {
        var mejora = sumaPct / cuantos;
        pct = limitar(mejora / 15 * 100, 0, 100);        /* meta de referencia: +15 % */
        texto = 'Tu fuerza mejoró ' + txt(mejora, 1) + ' % desde tu primera medición.';
      }
    } else if (obj === 'salud') {
      if (act.imc !== null) {
        if (act.imc >= 18.5 && act.imc < 25) { pct = 100; texto = 'Tu IMC está en rango saludable. ¡Buen trabajo!'; }
        else if (ini.imc !== null && ini.imc !== act.imc) {
          var distIni = ini.imc >= 25 ? ini.imc - 24.9 : 18.5 - ini.imc;
          var distAct = act.imc >= 25 ? act.imc - 24.9 : 18.5 - act.imc;
          pct = limitar((distIni - distAct) / (distIni || 1) * 100, 0, 100);
          texto = 'Tu IMC pasó de ' + txt(ini.imc, 1) + ' a ' + txt(act.imc, 1) + ' camino al rango saludable.';
        }
      }
    }

    if (pct === null && ini.pesoKg !== null && act.pesoKg !== null) {
      /* Mantener (y respaldo general): premia la estabilidad del peso */
      var variacion = ini.pesoKg ? Math.abs((act.pesoKg - ini.pesoKg) / ini.pesoKg * 100) : 0;
      pct = limitar(100 - variacion * 20, 0, 100);
      texto = variacion < 1
        ? 'Te has mantenido muy estable, justo lo que buscamos.'
        : 'Tu peso varió ' + txt(variacion, 1) + ' % desde el inicio.';
    }

    if (pct === null) return vacio;

    pct = Math.round(pct);
    var nivel = pct >= 80 ? 'excelente' : (pct >= 60 ? 'bueno' : (pct >= 40 ? 'regular' : 'atencion'));
    return { pct: pct, texto: texto || 'Avance registrado.', nivel: nivel, clase: Calc.claseNivel(nivel) };
  };

  /* =========================================================
     7. MEMBRESÍA Y NEGOCIO
     ========================================================= */

  /* Meses transcurridos desde el alta del socio (mínimo 0) */
  Calc.mesesTranscurridos = function (fechaAlta) {
    var m = mesesEntre(fechaAlta, hoyISO());
    if (m === null) return 0;
    return Math.max(0, m);
  };

  /*
     Meses efectivamente pagados: suma los meses de plan de cada pago
     'pagado' con concepto 'mensualidad'. Si no se recibe la lista de
     pagos, se devuelve la antigüedad en meses desde fechaAlta.
  */
  Calc.mesesDeMembresia = function (socio, pagos) {
    if (!socio) return 0;
    /* Sin lista de pagos no hay nada que sumar: se usa la antigüedad real */
    if (Object.prototype.toString.call(pagos) !== '[object Array]') {
      return Calc.mesesTranscurridos(socio.fechaAlta);
    }

    var total = 0, i, p;
    for (i = 0; i < pagos.length; i++) {
      p = pagos[i];
      if (!p || typeof p !== 'object') continue;
      if (p.socioId && socio.id && p.socioId !== socio.id) continue;
      if (p.estado && p.estado !== 'pagado') continue;
      if (p.concepto && p.concepto !== 'mensualidad') continue;

      var meses = num(p.meses);

      /* Preferimos el periodo cubierto por el pago */
      if (meses === null && p.periodoInicio && p.periodoFin) {
        var d = diasEntre(p.periodoInicio, p.periodoFin);
        if (d !== null && d > 0) meses = Math.max(1, Math.round(d / 30.44));
      }

      /* Si no hay periodo, buscamos el plan (AG.DB puede no existir) */
      if (meses === null && p.planId) {
        try {
          if (AG.DB && typeof AG.DB.plan === 'function') {
            var plan = AG.DB.plan(p.planId);
            if (plan) meses = num(plan.meses);
          }
        } catch (e) { meses = null; }
      }

      if (meses === null || meses <= 0) meses = 1;
      total += meses;
    }

    return Math.round(total);
  };

  /* Antigüedad legible: '1 año 3 meses' */
  Calc.antiguedadTexto = function (fechaAlta) {
    var meses = mesesEntre(fechaAlta, hoyISO());
    if (meses === null) return 'Sin fecha de alta';
    if (meses < 0) meses = 0;

    if (meses === 0) {
      var dias = diasEntre(fechaAlta, hoyISO());
      if (dias === null || dias <= 0) return 'Ingresó hoy';
      return dias === 1 ? '1 día' : dias + ' días';
    }

    var anios = Math.floor(meses / 12);
    var resto = meses % 12;
    var partes = [];
    if (anios > 0) partes.push(anios === 1 ? '1 año' : anios + ' años');
    if (resto > 0) partes.push(resto === 1 ? '1 mes' : resto + ' meses');
    return partes.join(' ');
  };

  /*
     Estado de la membresía a partir de fechaVencimiento y los días de
     gracia configurados. Devuelve estado, días restantes, clase de badge
     y un texto listo para pintar.
  */
  Calc.estadoMembresia = function (socio) {
    if (!socio || typeof socio !== 'object') {
      return { estado: 'baja', diasRestantes: 0, clase: 'badge-muted', texto: 'Sin datos de membresía', vence: null };
    }

    if (socio.estado === 'congelado') {
      return { estado: 'congelado', diasRestantes: 0, clase: 'badge-muted', texto: 'Membresía congelada', vence: socio.fechaVencimiento || null };
    }
    if (socio.estado === 'baja' || socio.activo === false) {
      return { estado: 'baja', diasRestantes: 0, clase: 'badge-muted', texto: 'Baja del gimnasio', vence: socio.fechaVencimiento || null };
    }

    var gracia = num(ajustes().diasGraciaPago);
    if (gracia === null || gracia < 0) gracia = 5;

    var vence = socio.fechaVencimiento || null;
    var dias = diasEntre(hoyISO(), vence);

    if (dias === null) {
      return {
        estado: socio.estado === 'activo' ? 'activo' : 'vencido',
        diasRestantes: 0,
        clase: socio.estado === 'activo' ? 'badge-ok' : 'badge-danger',
        texto: socio.estado === 'activo' ? 'Activa (sin fecha registrada)' : 'Sin fecha de vencimiento',
        vence: null
      };
    }

    if (dias > 7) {
      return { estado: 'activo', diasRestantes: dias, clase: 'badge-ok', texto: 'Activa · ' + dias + ' días restantes', vence: vence };
    }
    if (dias > 0) {
      return { estado: 'por_vencer', diasRestantes: dias, clase: 'badge-warn', texto: dias === 1 ? 'Vence mañana' : 'Vence en ' + dias + ' días', vence: vence };
    }
    if (dias === 0) {
      return { estado: 'por_vencer', diasRestantes: 0, clase: 'badge-warn', texto: 'Vence hoy', vence: vence };
    }

    var vencidos = -dias;
    if (vencidos <= gracia) {
      var restanGracia = gracia - vencidos + 1;
      return {
        estado: 'por_vencer',
        diasRestantes: dias,
        clase: 'badge-warn',
        texto: 'Vencida · ' + (restanGracia === 1 ? 'último día de gracia' : restanGracia + ' días de gracia'),
        vence: vence
      };
    }
    return {
      estado: 'vencido',
      diasRestantes: dias,
      clase: 'badge-danger',
      texto: vencidos === 1 ? 'Vencida hace 1 día' : 'Vencida hace ' + vencidos + ' días',
      vence: vence
    };
  };

  /* =========================================================
     8. HÁBITOS, ENTRENAMIENTO Y CALIFICACIONES
     ========================================================= */

  /* Adherencia al plan: sesiones hechas contra las esperadas en el rango */
  Calc.adherencia = function (bitacoras, desde, hasta, diasPorSemana) {
    var iniISO = aISO(aFecha(desde)) || null;
    var finISO = aISO(aFecha(hasta)) || hoyISO();
    var dxs = num(diasPorSemana);
    if (dxs === null || dxs <= 0) dxs = 3;
    if (dxs > 7) dxs = 7;

    var lista = aLista(bitacoras);
    var hechas = 0, i, b;
    for (i = 0; i < lista.length; i++) {
      b = lista[i];
      if (!b || !b.fecha) continue;
      var f = String(b.fecha).slice(0, 10);
      if (iniISO && f < iniISO) continue;
      if (finISO && f > finISO) continue;
      if (b.completada === false) continue;
      hechas++;
    }

    var dias = iniISO ? diasEntre(iniISO, finISO) : null;
    if (dias === null || dias < 0) dias = 30;
    dias = dias + 1;                                  /* rango inclusivo */
    var esperadas = Math.max(1, Math.round(dias / 7 * dxs));
    var pct = Math.round(limitar(hechas / esperadas * 100, 0, 100));

    return {
      pct: pct,
      hechas: hechas,
      esperadas: esperadas,
      dias: dias,
      clase: pct >= 80 ? 'badge-ok' : (pct >= 50 ? 'badge-warn' : 'badge-danger')
    };
  };

  /* Racha de días consecutivos asistiendo (termina hoy o ayer) */
  Calc.rachaDias = function (asistencias) {
    var lista = aLista(asistencias);
    if (!lista.length) return 0;

    var mapa = {}, i;
    for (i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (a && a.fecha) mapa[String(a.fecha).slice(0, 10)] = true;
    }

    var cursor = hoyISO();
    if (!mapa[cursor]) {
      cursor = sumarDias(cursor, -1);
      if (!cursor || !mapa[cursor]) return 0;
    }

    var racha = 0, guardia = 0;
    while (cursor && mapa[cursor] && guardia < 3650) {
      racha++;
      guardia++;
      cursor = sumarDias(cursor, -1);
    }
    return racha;
  };

  /* Volumen total levantado en una bitácora (kg = reps × peso) */
  Calc.volumenEntrenamiento = function (bitacora) {
    if (!bitacora || typeof bitacora !== 'object') return 0;
    var ejercicios = aLista(bitacora.ejercicios);
    var total = 0, i, j, ej, series, serie;
    for (i = 0; i < ejercicios.length; i++) {
      ej = ejercicios[i];
      if (!ej || typeof ej !== 'object') continue;
      series = aLista(ej.series);
      for (j = 0; j < series.length; j++) {
        serie = series[j];
        if (!serie || serie.hecho === false) continue;
        var reps = num(serie.reps), peso = num(serie.peso);
        if (reps === null || peso === null || reps <= 0 || peso <= 0) continue;
        total += reps * peso;
      }
    }
    return Math.round(total);
  };

  /*
     Calorías quemadas aproximadas en una sesión.
     Se usa el equivalente metabólico (MET) escalado por el esfuerzo
     percibido: kcal = MET × peso(kg) × horas.
  */
  Calc.caloriasQuemadasAprox = function (bitacora, pesoKg) {
    var p = pos(pesoKg);
    if (p === null) p = 75;                        /* peso promedio de referencia */
    var minutos = bitacora ? num(bitacora.duracionMin) : null;
    if (minutos === null || minutos <= 0) minutos = 60;
    if (minutos > 300) minutos = 300;

    var esfuerzo = bitacora ? num(bitacora.esfuerzo) : null;
    if (esfuerzo === null) esfuerzo = 6;
    esfuerzo = limitar(esfuerzo, 1, 10);

    var met = 3.5 + esfuerzo * 0.35;               /* 3.85 (suave) a 7.0 (máximo) */
    return Math.round(met * p * (minutos / 60));
  };

  /* Promedio, total y distribución de estrellas */
  Calc.promedioCalificacion = function (calificaciones) {
    var dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    var lista = aLista(calificaciones);
    var suma = 0, total = 0, i;

    for (i = 0; i < lista.length; i++) {
      var c = lista[i];
      if (!c) continue;
      var e = Math.round(num(c.estrellas) || 0);
      if (e < 1 || e > 5) continue;
      dist[e]++;
      suma += e;
      total++;
    }

    return {
      promedio: total ? red(suma / total, 1) : 0,
      total: total,
      distribucion: dist
    };
  };

  /* =========================================================
     9. PROYECCIONES Y TEXTOS DE APOYO
     ========================================================= */

  /*
     Proyección de peso a futuro.
     deficitKcalDia positivo = déficit (se baja de peso);
     negativo = superávit (se sube). 7 700 kcal ≈ 1 kg de grasa.
  */
  Calc.proyeccionPeso = function (pesoActual, deficitKcalDia, semanas) {
    var p = pos(pesoActual);
    var d = num(deficitKcalDia) || 0;
    var s = Math.round(num(semanas) || 12);
    if (s < 1) s = 1;
    if (s > 104) s = 104;

    if (p === null) {
      return { pesoInicial: null, pesoFinal: null, cambioKg: 0, kgPorSemana: 0, semanas: s, puntos: [], texto: 'Falta el peso actual para proyectar.' };
    }

    var kgPorSemana = red(-(d * 7) / KCAL_POR_KG_GRASA, 2);   /* déficit => negativo */
    var puntos = [], i, peso;
    for (i = 0; i <= s; i++) {
      peso = red(Math.max(30, p + kgPorSemana * i), 1);
      puntos.push({ semana: i, peso: peso, x: i, y: peso });
    }

    var pesoFinal = puntos[puntos.length - 1].peso;
    var cambio = red(pesoFinal - p, 1);
    var texto;
    if (Math.abs(cambio) < 0.3) {
      texto = 'Con este plan tu peso se mantendría prácticamente igual en ' + s + ' semanas.';
    } else if (cambio < 0) {
      texto = 'En ' + s + ' semanas bajarías alrededor de ' + txt(-cambio, 1) + ' kg (≈ ' + txt(-kgPorSemana, 2) + ' kg por semana).';
    } else {
      texto = 'En ' + s + ' semanas subirías alrededor de ' + txt(cambio, 1) + ' kg (≈ ' + txt(kgPorSemana, 2) + ' kg por semana).';
    }

    return {
      pesoInicial: red(p, 1),
      pesoFinal: pesoFinal,
      cambioKg: cambio,
      kgPorSemana: kgPorSemana,
      semanas: s,
      puntos: puntos,
      texto: texto
    };
  };

  /* Tiempo estimado para alcanzar un peso meta a un ritmo dado */
  Calc.tiempoParaMeta = function (pesoActual, pesoMeta, ritmoKgSemana) {
    var p = pos(pesoActual), meta = pos(pesoMeta);
    var ritmo = Math.abs(num(ritmoKgSemana) || 0.5);
    if (ritmo <= 0) ritmo = 0.5;
    if (ritmo > 1.5) ritmo = 1.5;                 /* ritmo sostenible máximo */

    if (p === null || meta === null) {
      return { semanas: 0, meses: 0, fechaEstimada: null, direccion: 'mantener', diferencia: 0, texto: 'Faltan datos para estimar el tiempo.' };
    }

    var diferencia = red(meta - p, 1);
    if (Math.abs(diferencia) < 0.3) {
      return { semanas: 0, meses: 0, fechaEstimada: hoyISO(), direccion: 'mantener', diferencia: diferencia, texto: 'Ya estás en tu peso meta: ahora el trabajo es sostenerlo.' };
    }

    var semanas = Math.ceil(Math.abs(diferencia) / ritmo);
    var meses = red(semanas / 4.345, 1);
    var fecha = sumarDias(hoyISO(), semanas * 7);
    var direccion = diferencia < 0 ? 'bajar' : 'subir';
    var verbo = direccion === 'bajar' ? 'bajar' : 'subir';

    return {
      semanas: semanas,
      meses: meses,
      fechaEstimada: fecha,
      direccion: direccion,
      diferencia: diferencia,
      texto: 'Necesitas ' + verbo + ' ' + txt(Math.abs(diferencia), 1) + ' kg: unas ' + semanas + ' semanas (' + txt(meses, 1) + ' meses) a ' + txt(ritmo, 2) + ' kg por semana.'
    };
  };

  /* Texto orientador según el IMC (con kilos concretos si hay estatura) */
  Calc.imcObjetivoTexto = function (imc, estaturaCm, pesoKg) {
    var v = num(imc);
    if (v === null || v <= 0) return 'Registra peso y estatura para conocer tu IMC.';

    var clas = Calc.clasificacionIMC(v);
    var e = pos(estaturaCm);
    if (e !== null && e < 3) e = e * 100;
    var p = pos(pesoKg);
    var rango = e !== null ? Calc.pesoIdeal(e) : null;

    if (v >= 18.5 && v < 25) {
      return 'Tu IMC de ' + txt(v, 1) + ' está en rango saludable (' + clas.texto.toLowerCase() + '). La meta ahora es mejorar tu composición corporal, no el número de la báscula.';
    }

    if (v < 18.5) {
      if (rango && rango.min !== null && p !== null && p < rango.min) {
        return 'Tu IMC de ' + txt(v, 1) + ' indica bajo peso: subir alrededor de ' + txt(rango.min - p, 1) + ' kg de forma controlada te coloca en rango saludable.';
      }
      return 'Tu IMC de ' + txt(v, 1) + ' indica bajo peso. La meta es acercarte a un IMC de 18.5 sumando masa muscular.';
    }

    if (rango && rango.max !== null && p !== null && p > rango.max) {
      return 'Tu IMC de ' + txt(v, 1) + ' está en ' + clas.texto.toLowerCase() + ': bajar alrededor de ' + txt(p - rango.max, 1) + ' kg te coloca en rango saludable (IMC 24.9).';
    }
    return 'Tu IMC de ' + txt(v, 1) + ' está en ' + clas.texto.toLowerCase() + '. La meta es bajar hasta un IMC de 24.9 con déficit moderado y trabajo de fuerza.';
  };

  /* Resumen nutricional completo listo para la calculadora del socio */
  Calc.perfilNutricional = function (datos) {
    var d = datos && typeof datos === 'object' ? datos : {};
    var tmb = Calc.tmb(d.pesoKg, d.estaturaCm, d.edad, d.sexo);
    var tdee = Calc.tdee(d.pesoKg, d.estaturaCm, d.edad, d.sexo, d.nivelActividad);
    var objetivo = normalizarObjetivoNutricional(d.objetivo);
    var kcal = Calc.caloriasObjetivo(tdee, objetivo, d.agresividad, tmb);
    var macros = kcal !== null ? Calc.macros(kcal, objetivo, d.pesoKg) : null;
    var comidas = macros ? Calc.distribucionComidas(macros, d.numComidas || 4) : [];

    return {
      tmb: tmb,
      tdee: tdee,
      objetivo: objetivo,
      kcal: kcal,
      macros: macros,
      comidas: comidas,
      agua: Calc.aguaDiaria(d.pesoKg, d.nivelActividad),
      imc: Calc.imc(d.pesoKg, d.estaturaCm)
    };
  };

  AG.Calc = Calc;
})(window.AG);
