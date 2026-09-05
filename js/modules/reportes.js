/* =============================================================
   ALLIANCE GYM — AG.Mod.Reportes
   -------------------------------------------------------------
   Centro de inteligencia de negocio del dueño.

   Ruta: 'director/reportes' (solo rol director).

   Un selector de rango (3 / 6 / 12 meses) manda sobre TODO lo que
   se ve. Cuatro pestañas: Finanzas · Socios · Entrenamiento ·
   Satisfacción. Cada cifra sale de la base real (AG.DB): no hay
   un solo número inventado ni de relleno.

   Reglas de la casa: JavaScript clásico, sin módulos ni librerías,
   todo el texto de la base escapado con AG.Utils.esc(), nada de
   alert/confirm/prompt, nada de localStorage directo y ningún
   bloque sin su estado vacío en español.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Mod = AG.Mod || {};

  var U = AG.Utils;
  var Calc = AG.Calc;
  var Charts = AG.Charts;

  /* =============================================================
     0. Constantes de dominio
     ============================================================= */

  /* Rangos que ofrece el selector superior. */
  var RANGOS = [
    { meses: 3, etiqueta: '3 meses' },
    { meses: 6, etiqueta: '6 meses' },
    { meses: 12, etiqueta: '12 meses' }
  ];

  var PESTANAS = [
    { clave: 'finanzas', etiqueta: 'Finanzas', icono: 'dinero' },
    { clave: 'socios', etiqueta: 'Socios', icono: 'socios' },
    { clave: 'entrenamiento', etiqueta: 'Entrenamiento', icono: 'pesa' },
    { clave: 'satisfaccion', etiqueta: 'Satisfacción', icono: 'estrella' }
  ];

  /* Colores del contrato de CSS, con respaldo por si se imprime. */
  var COLOR = {
    rojo: 'var(--rojo,#E4322B)',
    ok: 'var(--ok,#22C55E)',
    warn: 'var(--warn,#F59E0B)',
    error: 'var(--error,#EF4444)',
    info: 'var(--info,#3B82F6)',
    tenue: 'var(--texto-3,#6E7681)'
  };

  var METODOS = [
    { clave: 'efectivo', etiqueta: 'Efectivo', color: 'var(--chart-3,#22C55E)' },
    { clave: 'tarjeta', etiqueta: 'Tarjeta', color: 'var(--chart-2,#3B82F6)' },
    { clave: 'transferencia', etiqueta: 'Transferencia', color: 'var(--chart-5,#A855F7)' },
    { clave: 'app', etiqueta: 'App', color: 'var(--chart-4,#F59E0B)' }
  ];

  var CONCEPTOS = {
    mensualidad: 'Mensualidades',
    inscripcion: 'Inscripciones',
    clase: 'Clases y visitas',
    producto: 'Productos',
    personalizado: 'Otros servicios'
  };

  var SEXOS = { H: 'Hombres', M: 'Mujeres' };

  /* Cortes de edad para la pirámide. */
  var EDADES = [
    { etiqueta: 'Menos de 18', min: 0, max: 17 },
    { etiqueta: '18 a 24', min: 18, max: 24 },
    { etiqueta: '25 a 34', min: 25, max: 34 },
    { etiqueta: '35 a 44', min: 35, max: 44 },
    { etiqueta: '45 a 54', min: 45, max: 54 },
    { etiqueta: '55 o más', min: 55, max: 200 }
  ];

  /* Umbrales que definen a un socio "en riesgo". */
  var DIAS_SIN_ASISTIR = 15;
  var ADHERENCIA_RIESGO = 40;

  /* Estado vivo de la pantalla: sobrevive a los repintados del router. */
  var estado = {
    meses: 6,
    pestana: 'finanzas'
  };

  /* =============================================================
     1. Ayudantes básicos
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return AG.Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function toast(mensaje, tipo) {
    try { U.toast(mensaje, tipo || 'info'); } catch (e) { /* sin consecuencias */ }
  }

  function dos(n) {
    var v = Math.abs(Math.floor(Number(n) || 0));
    return (v < 10 ? '0' : '') + v;
  }

  /* Número finito o null (nunca NaN). */
  function n0(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  /* Número seguro para sumar: siempre devuelve un número. */
  function num(v) {
    var x = n0(v);
    return x === null ? 0 : x;
  }

  function ajustes() {
    var s = null;
    try { s = (AG.DB && AG.DB.state) ? AG.DB.state.settings : null; } catch (e) { s = null; }
    return (s && typeof s === 'object') ? s : {};
  }

  function coleccion(nombre) {
    try {
      var lista = AG.DB.get(nombre);
      return Object.prototype.toString.call(lista) === '[object Array]' ? lista : [];
    } catch (e) { return []; }
  }

  /* 'sep 26' a partir de 'YYYY-MM'. */
  function etiquetaMes(mes) {
    var p = U.partesDe(String(mes || '') + '-01');
    if (!p) return String(mes || '');
    return U.MESES_CORTOS[p.m - 1] + ' ' + String(p.a).slice(2);
  }

  /* Último día del mes en 'YYYY-MM-DD'. */
  function finDeMes(mes) {
    var p = U.partesDe(String(mes || '') + '-01');
    if (!p) return U.hoy();
    return mes + '-' + dos(U.diasDelMes(p.a, p.m));
  }

  /* Fecha de corte del mes: su último día, o hoy si el mes va en curso. */
  function cierreDe(mes) {
    var fin = finDeMes(mes);
    var hoy = U.hoy();
    return fin > hoy ? hoy : fin;
  }

  /* ¿El mes todavía no termina? */
  function mesEnCurso(mes) {
    return finDeMes(mes) > U.hoy();
  }

  /* Último mes del rango que ya terminó (para cifras comparables). */
  function ultimoMesCompleto(meses) {
    for (var i = meses.length - 1; i >= 0; i--) {
      if (!mesEnCurso(meses[i])) return meses[i];
    }
    return meses[meses.length - 1];
  }

  /* Mes anterior a uno dado. */
  function mesAntes(mes) {
    return U.mesDe(U.sumaMeses(String(mes) + '-01', -1));
  }

  /* Lista de 'YYYY-MM' que termina en el mes en curso. */
  function mesesRango(cuantos) {
    var n = Math.max(1, Math.min(24, Math.round(Number(cuantos) || 6)));
    var base = U.mesActual() + '-01';
    var lista = [];
    for (var i = n - 1; i >= 0; i--) lista.push(U.mesDe(U.sumaMeses(base, -i)));
    return lista;
  }

  /* Variación porcentual entre dos cifras (null si no hay referencia). */
  function variacion(actual, anterior) {
    var a = num(anterior);
    if (a === 0) return null;
    return ((num(actual) - a) / Math.abs(a)) * 100;
  }

  function porcentaje(parte, total) {
    var t = num(total);
    if (t <= 0) return 0;
    return (num(parte) / t) * 100;
  }

  /* Meses que cubre un plan (los planes por días se prorratean). */
  function mesesDelPlan(plan) {
    if (!plan) return 1;
    var meses = num(plan.meses);
    if (meses > 0) return meses;
    var dias = num(plan.dias);
    if (dias > 0) return dias / 30.44;
    return 1;
  }

  function esPagado(p) {
    return !!p && (!p.estado || p.estado === 'pagado');
  }

  /* Un socio congelado no es alta ni baja: queda fuera de la serie. */
  function cuentaParaChurn(socio) {
    return !!socio && socio.estado !== 'congelado';
  }

  /* =============================================================
     2. Estilos propios (variantes mínimas del contrato de CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-reportes';

  function asegurarEstilos() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.rep-meta{display:flex;align-items:center;gap:18px;flex-wrap:wrap}' +
      '.rep-meta .rep-meta-anillo{flex:0 0 auto}' +
      '.rep-meta .rep-meta-datos{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:10px}' +
      '.rep-lista-num{display:flex;flex-direction:column;gap:2px;min-width:0}' +
      '.rep-pos{display:inline-flex;align-items:center;justify-content:center;' +
        'width:26px;height:26px;border-radius:50%;background:var(--panel-2);border:1px solid var(--borde);' +
        'font-size:12px;font-weight:800;color:var(--texto-2);flex:0 0 auto}' +
      '.rep-pos.rep-oro{background:var(--rojo);border-color:var(--rojo);color:#fff}' +
      '.rep-nota{font-size:11.5px;color:var(--texto-3);margin-top:8px}' +
      '.rep-concl{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;' +
        'border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);min-width:0}' +
      '.rep-concl svg{flex:0 0 auto;margin-top:1px}' +
      '.rep-concl.rep-ok svg{color:var(--ok)}' +
      '.rep-concl.rep-warn svg{color:var(--warn)}' +
      '.rep-concl.rep-error svg{color:var(--error)}' +
      '.rep-concl.rep-info svg{color:var(--info)}' +
      '.rep-concl b{display:block;font-size:12.5px;color:var(--texto);margin-bottom:2px}' +
      '.rep-concl span{font-size:12.5px;color:var(--texto-2);line-height:1.45}' +
      '.rep-tabla-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '@media (max-width:520px){.rep-meta{justify-content:center;text-align:center}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     3. Motor de datos: todo el reporte en un solo objeto
     ============================================================= */

  /* Índice socioId -> periodos de mensualidad pagados. */
  function construirCoberturas(pagos) {
    var mapa = {};
    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!esPagado(p) || p.concepto !== 'mensualidad' || !p.socioId) continue;
      var ini = (typeof p.periodoInicio === 'string' && p.periodoInicio) ? p.periodoInicio : p.fecha;
      var fin = (typeof p.periodoFin === 'string' && p.periodoFin) ? p.periodoFin : '';
      if (!ini || !fin) continue;
      if (!mapa[p.socioId]) mapa[p.socioId] = [];
      mapa[p.socioId].push({ ini: U.iso(ini), fin: U.iso(fin) });
    }
    return mapa;
  }

  /* ¿La membresía del socio cubría esa fecha (más los días de gracia)? */
  function cubiertoEn(coberturas, socioId, corte, gracia) {
    var lista = coberturas[socioId];
    if (!lista || !lista.length) return false;
    for (var i = 0; i < lista.length; i++) {
      var limite = U.sumaDias(lista[i].fin, gracia) || lista[i].fin;
      if (lista[i].ini <= corte && limite >= corte) return true;
    }
    return false;
  }

  /* Nómina mensual: suma de los sueldos de los coaches en activo. */
  function calcularNomina(coaches) {
    var total = 0;
    for (var i = 0; i < coaches.length; i++) {
      var c = coaches[i];
      if (!c || c.activo === false) continue;
      total += Math.max(0, num(c.sueldo));
    }
    return total;
  }

  /* MRR: mensualidades vigentes prorrateadas a un mes. */
  function calcularMRR(socios) {
    var total = 0;
    for (var i = 0; i < socios.length; i++) {
      var s = socios[i];
      if (!s || s.activo === false) continue;
      if (s.estado !== 'activo') continue;          /* vencidos y congelados no facturan */
      var plan = AG.DB.plan(s.planId);
      if (!plan) continue;
      var meses = mesesDelPlan(plan);
      if (meses <= 0) continue;
      total += num(plan.precio) / meses;
    }
    return total;
  }

  /* --------- Bloque 1: finanzas y evolución mes a mes --------- */

  function construirSerieMensual(ctxDatos) {
    var meses = ctxDatos.meses;
    var mesesCalc = ctxDatos.mesesCalc;
    var socios = ctxDatos.socios;
    var gracia = ctxDatos.gracia;
    var coberturas = ctxDatos.coberturas;
    var i, j, mes;

    var porMes = {};
    for (i = 0; i < mesesCalc.length; i++) {
      porMes[mesesCalc[i]] = {
        mes: mesesCalc[i], ingreso: 0, pagos: 0, altas: 0, bajas: 0,
        activos: 0, utilidad: 0, mensualidades: 0
      };
    }

    /* Ingresos cobrados, mes por mes. */
    var pagos = ctxDatos.pagos;
    for (i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!esPagado(p)) continue;
      mes = U.mesDe(p.fecha);
      var reg = porMes[mes];
      if (!reg) continue;
      reg.ingreso += num(p.monto);
      reg.pagos += 1;
      if (p.concepto === 'mensualidad') reg.mensualidades += num(p.monto);
    }

    /* Socios activos al cierre de cada mes, derivados de los pagos reales. */
    var conjuntos = {};
    for (i = 0; i < mesesCalc.length; i++) {
      mes = mesesCalc[i];
      var corte = cierreDe(mes);
      var set = {};
      var cuantos = 0;
      for (j = 0; j < socios.length; j++) {
        var s = socios[j];
        if (!cuentaParaChurn(s)) continue;
        var alta = U.iso(s.fechaAlta);
        if (!alta || alta > corte) continue;
        if (!cubiertoEn(coberturas, s.id, corte, gracia)) continue;
        set[s.id] = true;
        cuantos++;
      }
      conjuntos[mes] = set;
      porMes[mes].activos = cuantos;
    }

    /* Altas: por la fecha de alta registrada en el expediente. */
    for (j = 0; j < socios.length; j++) {
      var soc = socios[j];
      if (!cuentaParaChurn(soc)) continue;
      var mesAlta = U.mesDe(soc.fechaAlta);
      if (porMes[mesAlta]) porMes[mesAlta].altas += 1;
    }

    /* Bajas: estaba cubierto el mes pasado y ya no lo está. */
    for (i = 1; i < mesesCalc.length; i++) {
      var previo = conjuntos[mesesCalc[i - 1]];
      var actual = conjuntos[mesesCalc[i]];
      var bajas = 0;
      for (var id in previo) {
        if (!Object.prototype.hasOwnProperty.call(previo, id)) continue;
        if (!actual[id]) bajas++;
      }
      porMes[mesesCalc[i]].bajas = bajas;
    }

    /* Utilidad estimada por mes: ingreso menos nómina y costo fijo.
       Los meses en los que el gimnasio todavía no operaba se dejan en null:
       no tiene sentido cargarles una nómina que no existía. */
    var egresos = ctxDatos.nomina + ctxDatos.costoFijo;
    for (i = 0; i < mesesCalc.length; i++) {
      var reg2 = porMes[mesesCalc[i]];
      reg2.operativo = (reg2.pagos > 0 || reg2.activos > 0);
      reg2.enCurso = mesEnCurso(reg2.mes);
      reg2.utilidad = reg2.operativo ? (reg2.ingreso - egresos) : null;
    }

    var filas = [];
    for (i = 0; i < meses.length; i++) filas.push(porMes[meses[i]]);

    return { porMes: porMes, filas: filas, conjuntos: conjuntos };
  }

  /* --------- Bloque 2: desgloses de ingreso del periodo --------- */

  function construirDesglosesFinancieros(ctxDatos) {
    var enRango = ctxDatos.enRango;
    var pagos = ctxDatos.pagos;
    var porPlan = {}, porMetodo = {}, porConcepto = {};
    var i;

    for (i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!esPagado(p)) continue;
      if (!enRango[U.mesDe(p.fecha)]) continue;
      var monto = num(p.monto);

      var claveMetodo = (typeof p.metodo === 'string' && p.metodo) ? p.metodo : 'otro';
      porMetodo[claveMetodo] = (porMetodo[claveMetodo] || 0) + monto;

      var claveConcepto = (typeof p.concepto === 'string' && p.concepto) ? p.concepto : 'personalizado';
      porConcepto[claveConcepto] = (porConcepto[claveConcepto] || 0) + monto;

      /* Por plan solo tiene sentido con lo que cobra la membresía. */
      if (p.concepto === 'mensualidad' || p.concepto === 'inscripcion') {
        var clavePlan = p.planId || 'sin_plan';
        porPlan[clavePlan] = (porPlan[clavePlan] || 0) + monto;
      }
    }

    /* Plan -> barras */
    var barrasPlan = [];
    var planes = coleccion('planes');
    for (i = 0; i < planes.length; i++) {
      var plan = planes[i];
      var valor = porPlan[plan.id] || 0;
      if (valor <= 0) continue;
      barrasPlan.push({ etiqueta: plan.nombre || 'Plan', valor: valor, color: plan.color || COLOR.rojo });
    }
    if (porPlan.sin_plan > 0) {
      barrasPlan.push({ etiqueta: 'Sin plan', valor: porPlan.sin_plan, color: COLOR.tenue });
    }
    barrasPlan.sort(function (a, b) { return b.valor - a.valor; });

    /* Método -> dona */
    var donaMetodo = [];
    for (i = 0; i < METODOS.length; i++) {
      var m = METODOS[i];
      if (!(porMetodo[m.clave] > 0)) continue;
      donaMetodo.push({ etiqueta: m.etiqueta, valor: porMetodo[m.clave], color: m.color });
    }
    if (porMetodo.otro > 0) donaMetodo.push({ etiqueta: 'Otro', valor: porMetodo.otro, color: COLOR.tenue });

    /* Concepto -> barras horizontales de apoyo */
    var barrasConcepto = [];
    for (var clave in porConcepto) {
      if (!Object.prototype.hasOwnProperty.call(porConcepto, clave)) continue;
      if (!(porConcepto[clave] > 0)) continue;
      barrasConcepto.push({
        etiqueta: CONCEPTOS[clave] || U.capitalizar(clave),
        valor: porConcepto[clave],
        color: Charts.color(barrasConcepto.length)
      });
    }
    barrasConcepto.sort(function (a, b) { return b.valor - a.valor; });

    return { planes: barrasPlan, metodos: donaMetodo, conceptos: barrasConcepto };
  }

  /* --------- Bloque 3: distribuciones y socios en riesgo --------- */

  function construirDistribuciones(socios) {
    var porPlan = {}, porObjetivo = {}, porSexo = {}, porEdad = {};
    var i;
    for (i = 0; i < EDADES.length; i++) porEdad[EDADES[i].etiqueta] = 0;

    for (i = 0; i < socios.length; i++) {
      var s = socios[i];
      var plan = AG.DB.plan(s.planId);
      var nombrePlan = plan ? (plan.nombre || 'Plan') : 'Sin plan';
      porPlan[nombrePlan] = (porPlan[nombrePlan] || 0) + 1;

      var obj = (Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[s.objetivo])
        ? Calc.ETIQUETA_OBJETIVO[s.objetivo] : 'Sin objetivo';
      porObjetivo[obj] = (porObjetivo[obj] || 0) + 1;

      var sexo = SEXOS[s.sexo] || 'Sin registrar';
      porSexo[sexo] = (porSexo[sexo] || 0) + 1;

      if (s.fechaNacimiento) {
        var edad = U.edad(s.fechaNacimiento);
        for (var j = 0; j < EDADES.length; j++) {
          if (edad >= EDADES[j].min && edad <= EDADES[j].max) {
            porEdad[EDADES[j].etiqueta] += 1;
            break;
          }
        }
      }
    }

    function aLista(mapa, conColor) {
      var salida = [], k = 0;
      for (var clave in mapa) {
        if (!Object.prototype.hasOwnProperty.call(mapa, clave)) continue;
        if (!(mapa[clave] > 0)) continue;
        salida.push({ etiqueta: clave, valor: mapa[clave], color: conColor ? Charts.color(k) : null });
        k++;
      }
      salida.sort(function (a, b) { return b.valor - a.valor; });
      return salida;
    }

    /* La pirámide conserva el orden de edad, no el de tamaño. */
    var piramide = [];
    for (i = 0; i < EDADES.length; i++) {
      piramide.push({
        etiqueta: EDADES[i].etiqueta,
        valor: porEdad[EDADES[i].etiqueta],
        color: Charts.color(i)
      });
    }

    return {
      planes: aLista(porPlan, true),
      objetivos: aLista(porObjetivo, true),
      sexos: aLista(porSexo, true),
      edades: piramide
    };
  }

  /* Días por semana que le tocan al socio según su rutina vigente. */
  function diasPorSemanaDe(rutinaPorSocio, socioId) {
    var registro = rutinaPorSocio ? rutinaPorSocio[socioId] : null;
    var dias = (registro && registro.rutina) ? num(registro.rutina.diasPorSemana) : 0;
    if (!(dias > 0)) return 3;                 /* referencia prudente sin rutina asignada */
    return Math.min(7, dias);
  }

  /* Motivos reales por los que un socio está en riesgo de irse. */
  function construirRiesgo(ctxDatos) {
    var socios = ctxDatos.socios;
    var hoy = U.hoy();
    var desde30 = U.sumaDias(hoy, -29);
    var ultimaAsistencia = ctxDatos.ultimaAsistencia;
    var bitacorasPorSocio = ctxDatos.bitacorasPorSocio;
    var filas = [];

    for (var i = 0; i < socios.length; i++) {
      var s = socios[i];
      if (!s || s.estado === 'baja' || s.activo === false) continue;

      var motivos = [];
      var gravedad = 0;

      /* 1) Membresía vencida */
      var membresia = Calc.estadoMembresia(s);
      if (membresia && membresia.estado === 'vencido') {
        var diasVencida = Math.abs(num(membresia.diasRestantes));
        motivos.push('Membresía vencida hace ' + diasVencida + (diasVencida === 1 ? ' día' : ' días'));
        gravedad += 100 + diasVencida;
      }

      /* 2) Sin pisar el gimnasio */
      var ultima = ultimaAsistencia[s.id] || '';
      var diasSin = ultima ? U.diasEntre(ultima, hoy) : null;
      if (!ultima) {
        motivos.push('Nunca ha registrado una entrada');
        gravedad += 80;
      } else if (diasSin >= DIAS_SIN_ASISTIR) {
        motivos.push('Sin asistir hace ' + diasSin + ' días');
        gravedad += 50 + diasSin;
      }

      /* 3) Adherencia baja al plan de entrenamiento */
      var dxs = diasPorSemanaDe(ctxDatos.rutinaPorSocio, s.id);
      var adh = Calc.adherencia(bitacorasPorSocio[s.id] || [], desde30, hoy, dxs);
      if (adh && adh.pct < ADHERENCIA_RIESGO) {
        motivos.push('Adherencia de ' + U.pct(adh.pct, 0) + ' en los últimos 30 días');
        gravedad += (ADHERENCIA_RIESGO - adh.pct);
      }

      if (!motivos.length) continue;

      filas.push({
        socio: s,
        coach: s.coachId ? AG.DB.usuario(s.coachId) : null,
        motivos: motivos,
        adherencia: adh ? adh.pct : 0,
        ultima: ultima,
        diasSin: diasSin,
        membresia: membresia,
        gravedad: gravedad,
        accion: accionSugerida(membresia, ultima, diasSin, adh)
      });
    }

    filas.sort(function (a, b) { return b.gravedad - a.gravedad; });
    return filas;
  }

  /* Recomendación concreta y accionable para recuperar al socio. */
  function accionSugerida(membresia, ultima, diasSin, adh) {
    if (membresia && membresia.estado === 'vencido') {
      return 'Llamar hoy para renovar y ofrecer el plan que mejor le acomode.';
    }
    if (!ultima) {
      return 'Agendar su primera sesión con el coach y hacer el recorrido de bienvenida.';
    }
    if (diasSin !== null && diasSin >= 30) {
      return 'Contacto directo del coach: pactar día y hora de regreso esta semana.';
    }
    if (diasSin !== null && diasSin >= DIAS_SIN_ASISTIR) {
      return 'Mensaje de seguimiento e invitación a una clase grupal para retomar el hábito.';
    }
    if (adh && adh.pct < 20) {
      return 'Revisar la rutina con el coach: puede estar mal ajustada a sus horarios.';
    }
    return 'Ajustar la rutina y fijar una meta corta y medible para el mes.';
  }

  /* --------- Bloque 4: entrenamiento --------- */

  function construirEntrenamiento(ctxDatos) {
    var meses = ctxDatos.meses;
    var socios = ctxDatos.socios;
    var i, j, mes;

    /* Índice de mediciones: socio|periodo|tipo */
    var mediciones = U.ordenar(coleccion('mediciones'), 'fecha', 'asc');
    var indice = {};
    var conteoPorMes = {};
    for (i = 0; i < meses.length; i++) conteoPorMes[meses[i]] = 0;

    for (i = 0; i < mediciones.length; i++) {
      var m = mediciones[i];
      if (!m || !m.socioId) continue;
      var periodo = (typeof m.periodo === 'string' && m.periodo) ? m.periodo.slice(0, 7) : U.mesDe(m.fecha);
      if (!periodo) continue;
      var tipo = (m.tipo === 'final') ? 'final' : 'inicial';
      var clave = m.socioId + '|' + periodo + '|' + tipo;
      if (tipo === 'inicial') { if (!indice[clave]) indice[clave] = m; }
      else indice[clave] = m;
      if (conteoPorMes[periodo] !== undefined) conteoPorMes[periodo] += 1;
    }

    /* Progreso mes a mes, desglose por objetivo y ranking del último cierre. */
    var serieProgreso = [];
    var serieCobertura = [];
    var serieConteo = [];
    var porObjetivo = {};
    var cierresPorMes = {};
    var totalCerrados = 0;

    for (i = 0; i < meses.length; i++) {
      mes = meses[i];
      var activosMes = ctxDatos.serie.conjuntos[mes] || {};
      var puntajes = [];
      var cerrados = [];

      for (j = 0; j < socios.length; j++) {
        var s = socios[j];
        var ini = indice[s.id + '|' + mes + '|inicial'];
        var fin = indice[s.id + '|' + mes + '|final'];
        if (!ini || !fin) continue;

        var cmp = Calc.compararMediciones(ini, fin, s.objetivo);
        if (!cmp || !cmp.ok || !cmp.resumen) continue;
        var puntaje = num(cmp.resumen.puntaje);
        puntajes.push(puntaje);
        cerrados.push({ socio: s, puntaje: puntaje, resumen: cmp.resumen });

        var claveObj = (Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[s.objetivo])
          ? Calc.ETIQUETA_OBJETIVO[s.objetivo] : 'Sin objetivo';
        if (!porObjetivo[claveObj]) porObjetivo[claveObj] = { suma: 0, cuenta: 0 };
        porObjetivo[claveObj].suma += puntaje;
        porObjetivo[claveObj].cuenta += 1;
      }

      totalCerrados += cerrados.length;
      cierresPorMes[mes] = cerrados;

      var totalActivos = 0;
      for (var idA in activosMes) {
        if (Object.prototype.hasOwnProperty.call(activosMes, idA)) totalActivos++;
      }
      var cobertura = totalActivos > 0 ? porcentaje(cerrados.length, totalActivos) : 0;

      serieProgreso.push({
        x: mes, etiqueta: etiquetaMes(mes),
        y: puntajes.length ? Math.round(U.promedio(puntajes, function (v) { return v; })) : null
      });
      serieCobertura.push({ x: mes, etiqueta: etiquetaMes(mes), y: Math.round(cobertura) });
      serieConteo.push({ etiqueta: etiquetaMes(mes), valor: conteoPorMes[mes] || 0, color: COLOR.info });
    }

    /* Último mes del rango que sí tiene cierres. */
    var ultimoCierre = '';
    for (i = meses.length - 1; i >= 0; i--) {
      if (cierresPorMes[meses[i]] && cierresPorMes[meses[i]].length) { ultimoCierre = meses[i]; break; }
    }
    var ranking = ultimoCierre ? cierresPorMes[ultimoCierre].slice() : [];
    ranking.sort(function (a, b) { return b.puntaje - a.puntaje; });
    ranking = ranking.slice(0, 10);

    var barrasObjetivo = [];
    var k = 0;
    for (var clave2 in porObjetivo) {
      if (!Object.prototype.hasOwnProperty.call(porObjetivo, clave2)) continue;
      var d = porObjetivo[clave2];
      if (!d.cuenta) continue;
      barrasObjetivo.push({
        etiqueta: clave2,
        valor: Math.round(d.suma / d.cuenta),
        color: Charts.color(k)
      });
      k++;
    }
    barrasObjetivo.sort(function (a, b) { return b.valor - a.valor; });

    /* Progreso promedio general (solo meses con datos). */
    var conDato = [];
    for (i = 0; i < serieProgreso.length; i++) {
      if (serieProgreso[i].y !== null) conDato.push(serieProgreso[i].y);
    }
    var progresoPromedio = conDato.length ? U.promedio(conDato, function (v) { return v; }) : 0;

    /* Adherencia promedio del gimnasio.
       La ventana arranca cuando hay bitácoras que medir y, para cada socio,
       nunca antes de su alta: así el número no se diluye con meses en los
       que ni el socio ni el registro existían. */
    var adherencias = [];
    var desdeAdh = ctxDatos.desdeAdherencia;
    for (j = 0; j < socios.length; j++) {
      var so = socios[j];
      if (so.estado === 'baja' || so.activo === false) continue;
      var alta = U.iso(so.fechaAlta);
      var arranque = (alta && alta > desdeAdh) ? alta : desdeAdh;
      if (arranque > ctxDatos.hasta) continue;
      var res = Calc.adherencia(
        ctxDatos.bitacorasPorSocio[so.id] || [],
        arranque, ctxDatos.hasta,
        diasPorSemanaDe(ctxDatos.rutinaPorSocio, so.id)
      );
      if (res) adherencias.push(res.pct);
    }
    var adherenciaPromedio = adherencias.length ? U.promedio(adherencias, function (v) { return v; }) : 0;

    /* Grupos musculares más entrenados, según las bitácoras del rango. */
    var porGrupo = {};
    var bitacoras = ctxDatos.bitacorasRango;
    for (i = 0; i < bitacoras.length; i++) {
      var b = bitacoras[i];
      var ejercicios = (b && Object.prototype.toString.call(b.ejercicios) === '[object Array]') ? b.ejercicios : [];
      for (j = 0; j < ejercicios.length; j++) {
        var ej = ejercicios[j];
        if (!ej || !ej.ejercicioId) continue;
        var info = null;
        try {
          info = (AG.Data && typeof AG.Data.ejercicio === 'function') ? AG.Data.ejercicio(ej.ejercicioId) : null;
        } catch (e) { info = null; }
        var grupo = (info && info.grupo) ? info.grupo : 'sin_grupo';
        var series = (Object.prototype.toString.call(ej.series) === '[object Array]') ? ej.series : [];
        var hechas = 0;
        for (var q = 0; q < series.length; q++) {
          if (series[q] && series[q].hecho !== false) hechas++;
        }
        if (!hechas) continue;
        porGrupo[grupo] = (porGrupo[grupo] || 0) + hechas;
      }
    }

    var barrasGrupo = [];
    var catalogo = (AG.Data && AG.Data.GRUPOS) ? AG.Data.GRUPOS : [];
    for (i = 0; i < catalogo.length; i++) {
      var g = catalogo[i];
      if (!(porGrupo[g.id] > 0)) continue;
      barrasGrupo.push({ etiqueta: g.nombre, valor: porGrupo[g.id], color: g.color || COLOR.rojo });
    }
    if (porGrupo.sin_grupo > 0) {
      barrasGrupo.push({ etiqueta: 'Sin clasificar', valor: porGrupo.sin_grupo, color: COLOR.tenue });
    }
    barrasGrupo.sort(function (a, b) { return b.valor - a.valor; });

    /* Ocupación por hora y por día, desde los check-in reales. */
    var horas = [], dias7 = [];
    for (i = 0; i < 24; i++) horas.push(0);
    for (i = 0; i < 7; i++) dias7.push(0);

    var asistencias = ctxDatos.asistenciasRango;
    for (i = 0; i < asistencias.length; i++) {
      var a = asistencias[i];
      if (!a) continue;
      var hm = /^(\d{1,2}):(\d{2})/.exec(String(a.entrada || ''));
      if (hm) {
        var h = Number(hm[1]);
        if (h >= 0 && h <= 23) horas[h] += 1;
      }
      var f = U.aDate(a.fecha);
      if (f) dias7[(f.getDay() + 6) % 7] += 1;
    }

    var primera = -1, ultima = -1;
    for (i = 0; i < 24; i++) {
      if (horas[i] > 0) { if (primera < 0) primera = i; ultima = i; }
    }
    var pico = -1, maxPico = 0;
    for (i = 0; i < 24; i++) {
      if (horas[i] > maxPico) { maxPico = horas[i]; pico = i; }
    }

    var barrasHora = [];
    if (primera >= 0) {
      for (i = primera; i <= ultima; i++) {
        barrasHora.push({
          etiqueta: dos(i) + ':00',
          valor: horas[i],
          color: (i === pico) ? COLOR.rojo : COLOR.info
        });
      }
    }

    var picoDia = 0;
    for (i = 1; i < 7; i++) if (dias7[i] > dias7[picoDia]) picoDia = i;
    var barrasDia = [];
    for (i = 0; i < 7; i++) {
      barrasDia.push({
        etiqueta: U.DIAS_SEMANA_LUNES[i],
        valor: dias7[i],
        color: (i === picoDia && dias7[i] > 0) ? COLOR.rojo : COLOR.info
      });
    }

    return {
      conteoPorMes: serieConteo,
      cobertura: serieCobertura,
      progresoSerie: serieProgreso,
      progresoPromedio: progresoPromedio,
      porObjetivo: barrasObjetivo,
      ranking: ranking,
      ultimoCierre: ultimoCierre,
      totalMediciones: (function () {
        var t = 0;
        for (var z = 0; z < meses.length; z++) t += (conteoPorMes[meses[z]] || 0);
        return t;
      })(),
      totalCerrados: totalCerrados,
      adherenciaPromedio: adherenciaPromedio,
      desdeAdherencia: desdeAdh,
      sociosConAdherencia: adherencias.length,
      grupos: barrasGrupo,
      horas: barrasHora,
      horaPico: pico,
      dias: barrasDia,
      diaPico: picoDia,
      totalAsistencias: asistencias.length
    };
  }

  /* --------- Bloque 5: satisfacción --------- */

  function construirSatisfaccion(ctxDatos) {
    var meses = ctxDatos.meses;
    var desde = ctxDatos.desde;
    var hasta = ctxDatos.hasta;
    var i;

    var todas = coleccion('calificaciones');
    var lista = [];
    for (i = 0; i < todas.length; i++) {
      var c = todas[i];
      if (!c || !c.fecha) continue;
      var f = U.iso(c.fecha);
      if (f < desde || f > hasta) continue;
      lista.push(c);
    }

    var global = Calc.promedioCalificacion(lista);

    /* Tendencia mensual */
    var serie = [];
    for (i = 0; i < meses.length; i++) {
      var delMes = [];
      for (var j = 0; j < lista.length; j++) {
        if (U.mesDe(lista[j].fecha) === meses[i]) delMes.push(lista[j]);
      }
      var prom = Calc.promedioCalificacion(delMes);
      serie.push({
        x: meses[i], etiqueta: etiquetaMes(meses[i]),
        y: prom.total ? prom.promedio : null
      });
    }

    /* NPS: promotores 5★, pasivos 4★, detractores 3★ o menos. */
    var pro = 0, pas = 0, det = 0;
    for (i = 0; i < lista.length; i++) {
      var e = Math.round(num(lista[i].estrellas));
      if (e === 5) pro++;
      else if (e === 4) pas++;
      else if (e >= 1) det++;
    }
    var totalNPS = pro + pas + det;
    var nps = {
      promotores: pro, pasivos: pas, detractores: det, total: totalNPS,
      valor: totalNPS ? Math.round(((pro - det) / totalNPS) * 100) : 0
    };

    /* Ranking de coaches */
    var coaches = ctxDatos.coaches;
    var ranking = [];
    for (i = 0; i < coaches.length; i++) {
      var coach = coaches[i];
      var suyas = [];
      for (var k = 0; k < lista.length; k++) {
        if (lista[k].tipo === 'coach' && lista[k].objetivoId === coach.id) suyas.push(lista[k]);
      }
      var res = Calc.promedioCalificacion(suyas);
      ranking.push({
        coach: coach,
        promedio: res.promedio,
        total: res.total,
        socios: AG.DB.sociosDe(coach.id).length
      });
    }
    ranking.sort(function (a, b) {
      if (b.promedio !== a.promedio) return b.promedio - a.promedio;
      return b.total - a.total;
    });

    /* Reseñas críticas sin responder */
    var criticas = [];
    for (i = 0; i < lista.length; i++) {
      var r = lista[i];
      var estrellas = Math.round(num(r.estrellas));
      if (estrellas > 3 || estrellas < 1) continue;
      if (r.respuesta && r.respuesta.texto) continue;
      criticas.push(r);
    }
    criticas = U.ordenar(criticas, 'fecha', 'desc');

    /* Distribución de estrellas */
    var barras = [];
    for (i = 5; i >= 1; i--) {
      barras.push({
        etiqueta: i + (i === 1 ? ' estrella' : ' estrellas'),
        valor: global.distribucion[i] || 0,
        color: i >= 4 ? COLOR.ok : (i === 3 ? COLOR.warn : COLOR.error)
      });
    }

    return {
      lista: lista,
      global: global,
      serie: serie,
      nps: nps,
      ranking: ranking,
      criticas: criticas,
      distribucion: barras
    };
  }

  /* --------- Orquestador --------- */

  function calcularReporte(cuantosMeses) {
    var conf = ajustes();
    var meses = mesesRango(cuantosMeses);
    var mesPrevio = U.mesDe(U.sumaMeses(meses[0] + '-01', -1));
    var mesesCalc = [mesPrevio].concat(meses);
    var mesActual = meses[meses.length - 1];
    var mesAnterior = meses.length > 1 ? meses[meses.length - 2] : mesPrevio;

    var enRango = {};
    for (var i = 0; i < meses.length; i++) enRango[meses[i]] = true;

    var desde = meses[0] + '-01';
    var hasta = cierreDe(mesActual);

    var socios = AG.DB.socios();
    var coaches = U.ordenar(AG.DB.coaches(), function (c) { return U.normalizar(U.nombreCompleto(c)); }, 'asc');
    var pagos = coleccion('pagos');
    var gracia = Math.max(0, Math.round(num(conf.diasGraciaPago)));

    /* Índices que se reutilizan en varios bloques. */
    var bitacorasPorSocio = {}, bitacorasRango = [];
    var primeraBitacora = '';
    var bitacoras = coleccion('bitacoras');
    for (i = 0; i < bitacoras.length; i++) {
      var b = bitacoras[i];
      if (!b || !b.socioId) continue;
      if (!bitacorasPorSocio[b.socioId]) bitacorasPorSocio[b.socioId] = [];
      bitacorasPorSocio[b.socioId].push(b);
      var fb = U.iso(b.fecha);
      if (!fb) continue;
      if (!primeraBitacora || fb < primeraBitacora) primeraBitacora = fb;
      if (fb >= desde && fb <= hasta) bitacorasRango.push(b);
    }

    /* Rutina vigente de cada socio, en una sola pasada. */
    var rutinasIdx = {};
    var listaRutinas = coleccion('rutinas');
    for (i = 0; i < listaRutinas.length; i++) {
      if (listaRutinas[i] && listaRutinas[i].id) rutinasIdx[listaRutinas[i].id] = listaRutinas[i];
    }
    var rutinaPorSocio = {};
    var asignaciones = coleccion('asignaciones');
    for (i = 0; i < asignaciones.length; i++) {
      var asg = asignaciones[i];
      if (!asg || !asg.socioId || asg.activa === false) continue;
      var rut = rutinasIdx[asg.rutinaId];
      if (!rut) continue;
      var inicio = U.iso(asg.fechaInicio);
      var previa = rutinaPorSocio[asg.socioId];
      if (!previa || inicio > previa.inicio) {
        rutinaPorSocio[asg.socioId] = { inicio: inicio, rutina: rut };
      }
    }

    var ultimaAsistencia = {}, asistenciasRango = [];
    var asistencias = coleccion('asistencias');
    for (i = 0; i < asistencias.length; i++) {
      var a = asistencias[i];
      if (!a || !a.socioId || !a.fecha) continue;
      var fa = U.iso(a.fecha);
      if (!ultimaAsistencia[a.socioId] || fa > ultimaAsistencia[a.socioId]) ultimaAsistencia[a.socioId] = fa;
      if (fa >= desde && fa <= hasta) asistenciasRango.push(a);
    }

    var nomina = calcularNomina(coaches);
    var costoFijo = Math.max(0, num(conf.costoFijoMensual));

    var ctxDatos = {
      meses: meses, mesesCalc: mesesCalc, mesActual: mesActual, mesAnterior: mesAnterior,
      mesPrevio: mesPrevio, enRango: enRango, desde: desde, hasta: hasta,
      socios: socios, coaches: coaches, pagos: pagos, gracia: gracia,
      coberturas: construirCoberturas(pagos),
      bitacorasPorSocio: bitacorasPorSocio, bitacorasRango: bitacorasRango,
      rutinaPorSocio: rutinaPorSocio,
      desdeAdherencia: (primeraBitacora && primeraBitacora > desde) ? primeraBitacora : desde,
      ultimaAsistencia: ultimaAsistencia, asistenciasRango: asistenciasRango,
      nomina: nomina, costoFijo: costoFijo
    };

    ctxDatos.serie = construirSerieMensual(ctxDatos);

    /* ---- Finanzas del periodo ---- */
    var filas = ctxDatos.serie.filas;
    var ingresoPeriodo = 0, numPagos = 0;
    for (i = 0; i < filas.length; i++) {
      ingresoPeriodo += filas[i].ingreso;
      numPagos += filas[i].pagos;
    }
    var regActual = ctxDatos.serie.porMes[mesActual];
    var regAnterior = ctxDatos.serie.porMes[mesAnterior];
    var meta = Math.max(0, num(conf.metaIngresoMensual));
    var ticket = numPagos > 0 ? ingresoPeriodo / numPagos : 0;

    /* El mes en curso solo se compara contra el mismo tramo del mes anterior:
       medir 5 días contra 31 no dice nada. */
    var enCurso = mesEnCurso(mesActual);
    var partes = U.partesDe(U.hoy());
    var diaHoy = partes ? partes.d : 1;
    var diasDelMesActual = partes ? U.diasDelMes(partes.a, partes.m) : 30;

    var ingresoComparable = regAnterior ? regAnterior.ingreso : 0;
    if (enCurso && regAnterior) {
      ingresoComparable = 0;
      for (i = 0; i < pagos.length; i++) {
        var pg = pagos[i];
        if (!esPagado(pg)) continue;
        if (U.mesDe(pg.fecha) !== mesAnterior) continue;
        var pp = U.partesDe(pg.fecha);
        if (pp && pp.d <= diaHoy) ingresoComparable += num(pg.monto);
      }
    }

    /* La utilidad y el margen se leen sobre el último mes COMPLETO:
       cargarle la nómina entera a un mes a medio andar sería falso. */
    var mesCerrado = ultimoMesCompleto(meses);
    var regCerrado = ctxDatos.serie.porMes[mesCerrado] || regActual;
    var utilidadCerrada = regCerrado.ingreso - nomina - costoFijo;

    var finanzas = {
      ingresoPeriodo: ingresoPeriodo,
      numPagos: numPagos,
      ticket: ticket,
      ingresoMes: regActual.ingreso,
      enCurso: enCurso,
      diaHoy: diaHoy,
      diasDelMes: diasDelMesActual,
      ingresoAnterior: regAnterior ? regAnterior.ingreso : 0,
      ingresoComparable: ingresoComparable,
      variacionMes: variacion(regActual.ingreso, ingresoComparable),
      meta: meta,
      pctMeta: meta > 0 ? porcentaje(regActual.ingreso, meta) : 0,
      faltaMeta: Math.max(0, meta - regActual.ingreso),
      ritmoEsperado: meta > 0 ? (meta * diaHoy) / diasDelMesActual : 0,
      mrr: calcularMRR(socios),
      nomina: nomina,
      costoFijo: costoFijo,
      mesCerrado: mesCerrado,
      ingresoCerrado: regCerrado.ingreso,
      utilidadMes: utilidadCerrada,
      margenMes: regCerrado.ingreso > 0 ? porcentaje(utilidadCerrada, regCerrado.ingreso) : 0,
      promedioMensual: filas.length ? ingresoPeriodo / filas.length : 0,
      desgloses: construirDesglosesFinancieros(ctxDatos)
    };

    /* ---- Socios ---- */
    var activosHoy = [], carteraViva = [];
    for (i = 0; i < socios.length; i++) {
      var s = socios[i];
      if (!s || s.activo === false) continue;
      if (s.estado === 'activo') activosHoy.push(s);
      if (s.estado !== 'baja') carteraViva.push(s);
    }

    /* Retención y churn también sobre el último mes completo. */
    var mesChurn = finanzas.mesCerrado;
    var regChurn = ctxDatos.serie.porMes[mesChurn] || regActual;
    var regPrevioChurn = ctxDatos.serie.porMes[mesAntes(mesChurn)] || null;
    var activosInicio = regPrevioChurn ? regPrevioChurn.activos : 0;
    var bajasChurn = regChurn.bajas;
    var churn = activosInicio > 0 ? porcentaje(bajasChurn, activosInicio) : 0;
    var antiguedades = [];
    for (i = 0; i < activosHoy.length; i++) {
      antiguedades.push(Calc.mesesTranscurridos(activosHoy[i].fechaAlta));
    }
    var antiguedad = antiguedades.length ? U.promedio(antiguedades, function (v) { return v; }) : 0;

    var altasPeriodo = 0, bajasPeriodo = 0;
    for (i = 0; i < filas.length; i++) { altasPeriodo += filas[i].altas; bajasPeriodo += filas[i].bajas; }

    var socios2 = {
      activos: activosHoy.length,
      cartera: carteraViva.length,
      totales: socios.length,
      altasMes: regActual.altas,
      bajasMes: regActual.bajas,
      altasPeriodo: altasPeriodo,
      bajasPeriodo: bajasPeriodo,
      netoPeriodo: altasPeriodo - bajasPeriodo,
      mesChurn: mesChurn,
      bajasChurn: bajasChurn,
      activosInicio: activosInicio,
      churn: churn,
      retencion: activosInicio > 0 ? Math.max(0, 100 - churn) : 0,
      hayChurn: activosInicio > 0,
      antiguedad: antiguedad,
      ltv: ticket * antiguedad,
      distribuciones: construirDistribuciones(activosHoy),
      riesgo: construirRiesgo(ctxDatos)
    };

    var datos = {
      meses: meses,
      rango: meses.length,
      mesActual: mesActual,
      mesAnterior: mesAnterior,
      mesCerrado: finanzas.mesCerrado,
      enCurso: enCurso,
      desde: desde,
      hasta: hasta,
      filas: filas,
      finanzas: finanzas,
      socios: socios2,
      entrenamiento: construirEntrenamiento(ctxDatos),
      satisfaccion: construirSatisfaccion(ctxDatos),
      nombreGym: conf.nombreGym || 'Alliance Gym'
    };

    return datos;
  }

  /* =============================================================
     4. Piezas de interfaz reutilizables
     ============================================================= */

  function kpiHTML(nombreIcono, valor, etiqueta, extra, variante) {
    return '<div class="kpi' + (variante ? ' kpi-' + variante : '') + '">' +
      '<div class="kpi-icono">' + icono(nombreIcono, 22) + '</div>' +
      '<div class="kpi-datos">' +
        '<div class="kpi-val">' + esc(valor) + '</div>' +
        '<div class="kpi-label">' + esc(etiqueta) + '</div>' +
        (extra || '') +
      '</div>' +
    '</div>';
  }

  function trendHTML(pct, sufijo) {
    if (pct === null || pct === undefined || !isFinite(pct)) {
      return '<div class="kpi-trend plana">' + icono('flecha-der', 14) + ' Sin comparativo</div>';
    }
    var clase = pct > 0.5 ? 'up' : (pct < -0.5 ? 'down' : 'plana');
    var nombre = pct > 0.5 ? 'flecha-arriba' : (pct < -0.5 ? 'flecha-abajo' : 'flecha-der');
    return '<div class="kpi-trend ' + clase + '">' + icono(nombre, 14) + ' ' +
      esc(U.signo(pct, 1, '%') + (sufijo ? ' ' + sufijo : '')) + '</div>';
  }

  function notaHTML(texto) {
    return '<div class="kpi-trend plana">' + esc(texto) + '</div>';
  }

  function cardHTML(titulo, nombreIcono, cuerpo, accion, clases) {
    return '<div class="card' + (clases ? ' ' + clases : '') + '">' +
      '<div class="card-head">' +
        '<div class="card-title">' + icono(nombreIcono, 18) + '<span>' + esc(titulo) + '</span></div>' +
        (accion ? '<div class="card-accion">' + accion + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + cuerpo + '</div>' +
    '</div>';
  }

  function vacioHTML(mensaje, nombreIcono) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(nombreIcono || 'grafica', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
    '</div>';
  }

  function datoHTML(etiqueta, valor, clase) {
    return '<div class="dato">' +
      '<span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<span class="dato-val' + (clase ? ' ' + clase : '') + '">' + esc(valor) + '</span>' +
    '</div>';
  }

  function personaHTML(usuario, subtitulo) {
    return '<div class="persona">' + U.avatar(usuario, 'sm') +
      '<div class="persona-txt">' +
        '<b>' + esc(U.nombreCompleto(usuario)) + '</b>' +
        '<span>' + esc(subtitulo || '') + '</span>' +
      '</div>' +
    '</div>';
  }

  function claseValor(v) {
    if (v > 0) return 'txt-ok';
    if (v < 0) return 'txt-error';
    return 'muted';
  }

  /* =============================================================
     5. Pestaña Finanzas
     ============================================================= */

  function graficaIngresos(datos, opts) {
    var o = opts || {};
    var puntos = [];
    for (var i = 0; i < datos.filas.length; i++) {
      puntos.push({
        x: datos.filas[i].mes,
        etiqueta: etiquetaMes(datos.filas[i].mes),
        y: Math.round(datos.filas[i].ingreso)
      });
    }
    return Charts.linea([{ nombre: 'Ingreso cobrado', color: COLOR.rojo, puntos: puntos }], {
      alto: o.alto || 280,
      ancho: o.ancho,
      area: true,
      suave: true,
      leyenda: false,
      desdeCero: true,
      prefijo: (ajustes().simbolo || '$'),
      decimales: 0,
      etiquetaY: o.sinTitulo ? '' : 'Ingreso cobrado',
      vacio: 'Todavía no hay pagos cobrados en este rango.',
      aria: 'Ingresos cobrados por mes'
    });
  }

  function graficaAltasBajas(datos, opts) {
    var o = opts || {};
    var altas = [], bajas = [];
    for (var i = 0; i < datos.filas.length; i++) {
      var f = datos.filas[i];
      altas.push({ x: f.mes, etiqueta: etiquetaMes(f.mes), y: f.altas });
      bajas.push({ x: f.mes, etiqueta: etiquetaMes(f.mes), y: f.bajas });
    }
    return Charts.linea([
      { nombre: 'Altas', color: COLOR.ok, puntos: altas },
      { nombre: 'Bajas', color: COLOR.error, puntos: bajas }
    ], {
      alto: o.alto || 270,
      ancho: o.ancho,
      desdeCero: true,
      suave: false,
      etiquetaY: 'Socios',
      vacio: 'Sin movimientos de alta o baja en el rango elegido.',
      aria: 'Altas contra bajas por mes'
    });
  }

  function graficaCalificacion(datos, opts) {
    var o = opts || {};
    return Charts.linea([{ nombre: 'Calificación', color: COLOR.warn, puntos: datos.satisfaccion.serie }], {
      alto: o.alto || 250,
      ancho: o.ancho,
      area: true,
      suave: true,
      leyenda: false,
      ticks: 5,
      decimales: 1,
      etiquetaY: 'Estrellas (1 a 5)',
      vacio: 'Aún no hay reseñas en este rango para trazar la tendencia.',
      aria: 'Calificación promedio por mes'
    });
  }

  function bloqueMeta(datos) {
    var f = datos.finanzas;
    if (!(f.meta > 0)) {
      return vacioHTML('No hay meta de ingreso mensual configurada. Defínela en Configuración para medir el avance.', 'meta');
    }
    var pct = Math.min(999, f.pctMeta);
    var anillo = Charts.progreso(Math.min(100, pct), {
      alto: 168,
      grosor: 14,
      texto: U.pct(pct, 0),
      etiqueta: 'de la meta'
    });

    /* Con el mes a medio andar, la referencia justa es el ritmo esperado al día de hoy. */
    var alDia = f.enCurso ? (f.ingresoMes - f.ritmoEsperado) : (f.ingresoMes - f.meta);
    var textoRitmo = f.enCurso
      ? 'Día ' + f.diaHoy + ' de ' + f.diasDelMes + ': al ritmo de la meta deberías llevar ' +
        U.dinero(f.ritmoEsperado, 0) + ', vas ' + (alDia >= 0 ? 'arriba' : 'abajo') + ' por ' +
        U.dinero(Math.abs(alDia), 0) + '.'
      : (f.faltaMeta > 0
        ? 'El mes cerró ' + U.dinero(f.faltaMeta, 0) + ' por debajo de la meta.'
        : 'El mes cerró la meta con ' + U.dinero(f.ingresoMes - f.meta, 0) + ' de excedente.');

    var detalle =
      '<div class="datos-grid">' +
        datoHTML('Meta del mes', U.dinero(f.meta, 0)) +
        datoHTML('Cobrado', U.dinero(f.ingresoMes, 0), 'txt-ok') +
        datoHTML(f.faltaMeta > 0 ? 'Falta' : 'Excedente',
          U.dinero(f.faltaMeta > 0 ? f.faltaMeta : (f.ingresoMes - f.meta), 0),
          f.faltaMeta > 0 ? 'txt-warn' : 'txt-ok') +
      '</div>' +
      '<p class="mini muted">' + esc(U.nombreMes(datos.mesActual)) + ' · ' + esc(textoRitmo) + '</p>';

    return '<div class="rep-meta">' +
      '<div class="rep-meta-anillo">' + anillo + '</div>' +
      '<div class="rep-meta-datos">' + detalle + '</div>' +
    '</div>';
  }

  function tablaMensualHTML(datos) {
    if (!datos.filas.length) {
      return vacioHTML('No hay meses que mostrar en este rango.', 'calendario');
    }
    var html = '<div class="table-wrap"><table class="table table-compacta">' +
      '<thead><tr>' +
        '<th>Mes</th>' +
        '<th class="rep-tabla-num">Pagos</th>' +
        '<th class="rep-tabla-num">Ingreso</th>' +
        '<th class="rep-tabla-num">Altas</th>' +
        '<th class="rep-tabla-num">Bajas</th>' +
        '<th class="rep-tabla-num">Activos al cierre</th>' +
        '<th class="rep-tabla-num">Utilidad estimada</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < datos.filas.length; i++) {
      var f = datos.filas[i];
      var neto = f.altas - f.bajas;
      var utilidad = (f.utilidad === null)
        ? '<span class="muted">—</span>'
        : '<span class="' + (f.utilidad >= 0 ? 'txt-ok' : 'txt-error') + '">' +
            esc(U.dinero(f.utilidad, 0)) + '</span>';

      html += '<tr>' +
        '<td><b>' + esc(U.nombreMes(f.mes)) + '</b>' +
          (f.enCurso ? ' <span class="badge badge-warn">En curso</span>' : '') + '</td>' +
        '<td class="rep-tabla-num">' + esc(U.num(f.pagos, 0)) + '</td>' +
        '<td class="rep-tabla-num bold">' + esc(U.dinero(f.ingreso, 0)) + '</td>' +
        '<td class="rep-tabla-num txt-ok">' + esc(U.num(f.altas, 0)) + '</td>' +
        '<td class="rep-tabla-num' + (f.bajas > 0 ? ' txt-error' : ' muted') + '">' + esc(U.num(f.bajas, 0)) + '</td>' +
        '<td class="rep-tabla-num">' + esc(U.num(f.activos, 0)) +
          ' <span class="mini ' + claseValor(neto) + '">' + esc(U.signo(neto, 0)) + '</span></td>' +
        '<td class="rep-tabla-num">' + utilidad + '</td>' +
      '</tr>';
    }

    html += '</tbody></table></div>' +
      '<p class="rep-nota">La utilidad estimada descuenta la nómina de coaches (' +
        esc(U.dinero(datos.finanzas.nomina, 0)) + ') y el costo fijo mensual (' +
        esc(U.dinero(datos.finanzas.costoFijo, 0)) +
        '). El mes marcado «En curso» todavía no termina, así que su utilidad no es comparable; ' +
        'los meses sin operación aparecen con guion.</p>';

    return html;
  }

  function pestanaFinanzas(datos) {
    var f = datos.finanzas;
    var simbolo = ajustes().simbolo || '$';

    var refTrend = f.enCurso ? 'vs mismo día del mes anterior' : 'vs mes anterior';

    var kpis = '<div class="grid g4">' +
      kpiHTML('dinero', U.dinero(f.ingresoPeriodo, 0), 'Ingresos de ' + datos.rango + ' meses',
        notaHTML(U.num(f.numPagos, 0) + (f.numPagos === 1 ? ' pago cobrado' : ' pagos cobrados'))) +
      kpiHTML('grafica', U.dinero(f.ingresoMes, 0), 'Ingreso de ' + U.nombreMes(datos.mesActual),
        trendHTML(f.variacionMes, refTrend), 'info') +
      kpiHTML('historial', U.dinero(f.mrr, 0), 'MRR (mensualidades vigentes)',
        notaHTML('Prorrateado a un mes'), 'ok') +
      kpiHTML('tarjeta', U.dinero(f.ticket, 0), 'Ticket promedio',
        notaHTML('Promedio mensual: ' + U.dinero(f.promedioMensual, 0)), 'warn') +
    '</div>';

    var costos = '<div class="grid g4">' +
      kpiHTML('coach', U.dinero(f.nomina, 0), 'Nómina de coaches',
        notaHTML('Sueldos mensuales registrados')) +
      kpiHTML('escudo', U.dinero(f.costoFijo, 0), 'Costo fijo mensual',
        notaHTML('Renta, servicios y operación')) +
      kpiHTML('meta', U.dinero(f.utilidadMes, 0), 'Utilidad de ' + U.nombreMes(f.mesCerrado),
        notaHTML('Último mes completo · ingreso ' + U.dinero(f.ingresoCerrado, 0)),
        f.utilidadMes >= 0 ? 'ok' : 'error') +
      kpiHTML('rayo', U.pct(f.margenMes, 1), 'Margen de ' + U.nombreMes(f.mesCerrado),
        notaHTML(f.margenMes >= 20 ? 'Margen saludable' : (f.margenMes >= 0 ? 'Margen ajustado' : 'Operación en pérdida')),
        f.margenMes >= 20 ? 'ok' : (f.margenMes >= 0 ? 'warn' : 'error')) +
    '</div>';

    var html = kpis +
      '<div class="grid g2">' +
        cardHTML('Meta del mes', 'meta', bloqueMeta(datos)) +
        cardHTML('Ingreso por concepto', 'filtro',
          datos.finanzas.desgloses.conceptos.length
            ? Charts.barras(datos.finanzas.desgloses.conceptos, {
                horizontal: true, filaAlto: 32, anchoEtiquetas: 130,
                prefijo: simbolo, decimales: 0,
                aria: 'Ingreso por concepto de cobro'
              })
            : vacioHTML('Sin cobros registrados en el rango elegido.', 'dinero')) +
      '</div>' +
      costos +
      cardHTML('Ingresos por mes', 'grafica', graficaIngresos(datos)) +
      '<div class="grid g2">' +
        cardHTML('Ingreso por plan', 'tarjeta',
          datos.finanzas.desgloses.planes.length
            ? Charts.barras(datos.finanzas.desgloses.planes, {
                alto: 280, prefijo: simbolo, decimales: 0,
                vacio: 'Sin membresías cobradas en el rango.',
                aria: 'Ingreso por plan de membresía'
              })
            : vacioHTML('Todavía no hay membresías cobradas en este rango.', 'tarjeta')) +
        cardHTML('Método de pago', 'dinero',
          datos.finanzas.desgloses.metodos.length
            ? Charts.dona(datos.finanzas.desgloses.metodos, {
                alto: 280, prefijo: simbolo, decimales: 0,
                centroValor: U.dinero(datos.finanzas.ingresoPeriodo, 0),
                centroTitulo: 'Total cobrado',
                aria: 'Ingreso por método de pago'
              })
            : vacioHTML('Sin pagos registrados para desglosar por método.', 'dinero')) +
      '</div>' +
      cardHTML('Detalle mensual', 'reporte', tablaMensualHTML(datos),
        '<button type="button" class="btn btn-outline btn-sm" data-csv-mensual>' +
          icono('descargar', 15) + ' Exportar CSV</button>');

    return html;
  }

  /* =============================================================
     6. Pestaña Socios
     ============================================================= */

  function tablaRiesgoHTML(datos) {
    var filas = datos.socios.riesgo;
    if (!filas.length) {
      return vacioHTML('Ningún socio cumple hoy con los criterios de riesgo. Buen momento para sostener el ritmo.', 'escudo');
    }

    var tope = Math.min(filas.length, 25);
    var html = '<div class="table-wrap"><table class="table table-compacta">' +
      '<thead><tr>' +
        '<th>Socio</th><th>Coach</th><th>Motivo</th>' +
        '<th class="rep-tabla-num">Última visita</th><th>Acción sugerida</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < tope; i++) {
      var fila = filas[i];
      var membresia = fila.membresia || {};
      var motivos = '';
      for (var j = 0; j < fila.motivos.length; j++) {
        motivos += '<div class="mini' + (j === 0 ? ' bold' : ' muted') + '">' + esc(fila.motivos[j]) + '</div>';
      }

      html += '<tr>' +
        '<td><a class="rep-lista-num" href="#/director/socio?id=' + esc(fila.socio.id) + '">' +
          personaHTML(fila.socio, fila.socio.codigo || '') + '</a></td>' +
        '<td>' + (fila.coach ? esc(U.nombreCompleto(fila.coach)) : '<span class="muted">Sin coach</span>') + '</td>' +
        '<td>' + motivos +
          '<span class="badge ' + esc(membresia.clase || 'badge-muted') + '">' +
            esc(membresia.texto || 'Sin datos') + '</span></td>' +
        '<td class="rep-tabla-num">' +
          (fila.ultima
            ? esc(U.fecha(fila.ultima, 'corto')) + '<div class="mini muted">' + esc(U.fechaRelativa(fila.ultima)) + '</div>'
            : '<span class="muted">Nunca</span>') + '</td>' +
        '<td><span class="mini">' + esc(fila.accion) + '</span></td>' +
      '</tr>';
    }

    html += '</tbody></table></div>';

    if (filas.length > tope) {
      html += '<p class="rep-nota">Se muestran los ' + tope + ' casos más urgentes de ' +
        filas.length + ' socios en riesgo.</p>';
    }
    return html;
  }

  function pestanaSocios(datos) {
    var s = datos.socios;

    var kpis = '<div class="grid g4">' +
      kpiHTML('socios', U.num(s.activos, 0), 'Socios activos',
        notaHTML(U.num(s.cartera, 0) + ' en cartera · ' + U.num(s.totales, 0) + ' históricos')) +
      kpiHTML('mas', U.num(s.altasMes, 0), 'Altas de ' + U.nombreMes(datos.mesActual),
        notaHTML(U.num(s.altasPeriodo, 0) + ' en el rango'), 'ok') +
      kpiHTML('salir', U.num(s.bajasMes, 0), 'Bajas de ' + U.nombreMes(datos.mesActual),
        notaHTML(U.num(s.bajasPeriodo, 0) + ' en el rango'),
        s.bajasMes > 0 ? 'error' : 'ok') +
      kpiHTML('escudo', s.hayChurn ? U.pct(s.retencion, 1) : '—',
        'Retención de ' + U.nombreMes(s.mesChurn),
        notaHTML(s.hayChurn
          ? 'Sobre ' + U.num(s.activosInicio, 0) + ' activos al inicio del mes'
          : 'Sin mes anterior con socios para comparar'),
        !s.hayChurn ? '' : (s.retencion >= 92 ? 'ok' : (s.retencion >= 85 ? 'warn' : 'error'))) +
    '</div>';

    var kpis2 = '<div class="grid g4">' +
      kpiHTML('flecha-abajo', s.hayChurn ? U.pct(s.churn, 1) : '—',
        'Churn de ' + U.nombreMes(s.mesChurn),
        notaHTML(s.hayChurn
          ? s.bajasChurn + (s.bajasChurn === 1 ? ' baja en el último mes completo' : ' bajas en el último mes completo')
          : 'Aún no hay historial suficiente'),
        !s.hayChurn ? '' : (s.churn <= 5 ? 'ok' : (s.churn <= 10 ? 'warn' : 'error'))) +
      kpiHTML('calendario', U.num(s.antiguedad, 1) + ' meses', 'Antigüedad promedio',
        notaHTML('De los socios activos'), 'info') +
      kpiHTML('trofeo', U.dinero(s.ltv, 0), 'LTV estimado',
        notaHTML('Ticket promedio × antigüedad'), 'ok') +
      kpiHTML('alerta', U.num(s.riesgo.length, 0), 'Socios en riesgo',
        notaHTML('Vencidos, ausentes o con baja adherencia'),
        s.riesgo.length === 0 ? 'ok' : (s.riesgo.length <= 5 ? 'warn' : 'error')) +
    '</div>';

    var activos = [];
    for (var i = 0; i < datos.filas.length; i++) {
      activos.push({
        x: datos.filas[i].mes,
        etiqueta: etiquetaMes(datos.filas[i].mes),
        y: datos.filas[i].activos
      });
    }

    var html = kpis + kpis2 +
      '<div class="grid g2">' +
        cardHTML('Altas y bajas por mes', 'socios', graficaAltasBajas(datos)) +
        cardHTML('Evolución de socios activos', 'grafica',
          Charts.linea([{ nombre: 'Activos al cierre', color: COLOR.info, puntos: activos }], {
            alto: 270, area: true, suave: true, leyenda: false,
            etiquetaY: 'Socios activos',
            vacio: 'Sin socios con membresía vigente en el rango.',
            aria: 'Evolución de socios activos por mes'
          })) +
      '</div>' +
      '<div class="grid g3">' +
        cardHTML('Por plan', 'tarjeta',
          s.distribuciones.planes.length
            ? Charts.dona(s.distribuciones.planes, { alto: 250, aria: 'Socios activos por plan' })
            : vacioHTML('Sin socios activos que agrupar por plan.', 'tarjeta')) +
        cardHTML('Por objetivo', 'meta',
          s.distribuciones.objetivos.length
            ? Charts.dona(s.distribuciones.objetivos, { alto: 250, aria: 'Socios activos por objetivo' })
            : vacioHTML('Sin objetivos registrados en los expedientes.', 'meta')) +
        cardHTML('Por sexo', 'usuario',
          s.distribuciones.sexos.length
            ? Charts.dona(s.distribuciones.sexos, { alto: 250, aria: 'Socios activos por sexo' })
            : vacioHTML('Sin dato de sexo en los expedientes activos.', 'usuario')) +
      '</div>' +
      cardHTML('Pirámide de edades', 'usuario',
        Charts.barras(s.distribuciones.edades, {
          horizontal: true, filaAlto: 34, anchoEtiquetas: 120,
          vacio: 'Falta la fecha de nacimiento en los expedientes activos.',
          aria: 'Distribución de socios activos por rango de edad'
        })) +
      cardHTML('Socios en riesgo', 'alerta', tablaRiesgoHTML(datos),
        '<span class="badge ' + (s.riesgo.length ? 'badge-danger' : 'badge-ok') + '">' +
          esc(U.num(s.riesgo.length, 0)) + '</span>');

    return html;
  }

  /* =============================================================
     7. Pestaña Entrenamiento
     ============================================================= */

  function rankingProgresoHTML(datos) {
    var e = datos.entrenamiento;
    if (!e.ranking.length) {
      return vacioHTML('Todavía no hay meses cerrados en este rango. En cuanto los coaches capturen la medición inicial y la final aparecerá el ranking.', 'trofeo');
    }

    var html = '<div class="list">';
    for (var i = 0; i < e.ranking.length; i++) {
      var fila = e.ranking[i];
      var resumen = fila.resumen || {};
      html += '<a class="list-item clickable" href="#/director/socio?id=' + esc(fila.socio.id) + '">' +
        '<div class="list-item-main">' +
          '<div class="row-sm">' +
            '<span class="rep-pos' + (i < 3 ? ' rep-oro' : '') + '">' + (i + 1) + '</span>' +
            personaHTML(fila.socio,
              (Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[fila.socio.objetivo]) || 'Sin objetivo') +
          '</div>' +
          '<p class="mini muted">' + esc(U.truncar(resumen.veredicto || '', 120)) + '</p>' +
        '</div>' +
        '<div class="list-item-side">' +
          '<span class="badge ' + esc(resumen.clase || 'badge-muted') + '">' +
            esc(Calc.textoNivel(resumen.nivel || '')) + '</span>' +
          '<span class="bold nums">' + esc(U.num(fila.puntaje, 0)) + ' / 100</span>' +
        '</div>' +
      '</a>';
    }
    html += '</div>';
    return html;
  }

  function pestanaEntrenamiento(datos) {
    var e = datos.entrenamiento;

    var coberturaUltima = 0;
    if (e.cobertura.length) coberturaUltima = e.cobertura[e.cobertura.length - 1].y;

    var kpis = '<div class="grid g4">' +
      kpiHTML('regla', U.num(e.totalMediciones, 0), 'Mediciones capturadas',
        notaHTML('En ' + datos.rango + ' meses')) +
      kpiHTML('check', U.pct(coberturaUltima, 0), 'Socios con el mes cerrado',
        notaHTML(U.nombreMes(datos.mesActual)),
        coberturaUltima >= 70 ? 'ok' : (coberturaUltima >= 40 ? 'warn' : 'error')) +
      kpiHTML('meta', U.num(e.progresoPromedio, 0) + ' / 100', 'Progreso promedio',
        notaHTML('Media de los meses cerrados'),
        e.progresoPromedio >= 60 ? 'ok' : (e.progresoPromedio >= 40 ? 'warn' : 'error')) +
      kpiHTML('fuego', U.pct(e.adherenciaPromedio, 0), 'Adherencia promedio',
        notaHTML('Del ' + U.fecha(e.desdeAdherencia, 'corto') + ' al ' + U.fecha(datos.hasta, 'corto')),
        e.adherenciaPromedio >= 70 ? 'ok' : (e.adherenciaPromedio >= 50 ? 'warn' : 'error')) +
    '</div>';

    var html = kpis +
      '<div class="grid g2">' +
        cardHTML('Mediciones capturadas por mes', 'regla',
          Charts.barras(e.conteoPorMes, {
            alto: 260, desdeCero: true,
            vacio: 'Sin mediciones capturadas en el rango elegido.',
            aria: 'Mediciones capturadas por mes'
          })) +
        cardHTML('Socios con el mes cerrado', 'check',
          Charts.linea([{ nombre: 'Cobertura', color: COLOR.ok, puntos: e.cobertura }], {
            alto: 260, area: true, suave: true, leyenda: false, desdeCero: true, sufijo: '%',
            etiquetaY: 'Cobertura',
            vacio: 'Sin meses cerrados para calcular la cobertura.',
            aria: 'Porcentaje de socios con inicio y cierre de mes'
          })) +
      '</div>' +
      cardHTML('Progreso promedio del gimnasio', 'grafica',
        Charts.linea([{ nombre: 'Puntaje promedio', color: COLOR.rojo, puntos: e.progresoSerie }], {
          alto: 270, area: true, suave: true, leyenda: false, desdeCero: true,
          etiquetaY: 'Puntaje (0 a 100)',
          vacio: 'Aún no hay meses cerrados para medir el progreso del gimnasio.',
          aria: 'Progreso promedio del gimnasio por mes'
        })) +
      '<div class="grid g2">' +
        cardHTML('Progreso por objetivo', 'meta',
          e.porObjetivo.length
            ? Charts.barras(e.porObjetivo, {
                horizontal: true, filaAlto: 34, anchoEtiquetas: 130,
                vacio: 'Sin cierres suficientes para desglosar por objetivo.',
                aria: 'Progreso promedio por objetivo del socio'
              })
            : vacioHTML('Todavía no hay cierres de mes para desglosar por objetivo.', 'meta')) +
        cardHTML('Grupos musculares más entrenados', 'pesa',
          e.grupos.length
            ? Charts.barras(e.grupos.slice(0, 8), {
                horizontal: true, filaAlto: 32, anchoEtiquetas: 128,
                sufijo: ' series',
                vacio: 'Sin bitácoras registradas en el rango.',
                aria: 'Series completadas por grupo muscular'
              })
            : vacioHTML('Los socios todavía no registran bitácoras en este rango.', 'pesa')) +
      '</div>' +
      cardHTML('Top 10 · mejor progreso' + (e.ultimoCierre ? ' de ' + U.nombreMes(e.ultimoCierre) : ''),
        'trofeo', rankingProgresoHTML(datos)) +
      '<div class="grid g2">' +
        cardHTML('Ocupación por hora', 'reloj',
          e.horas.length
            ? Charts.barras(e.horas, {
                alto: 260, valores: false,
                vacio: 'Sin entradas registradas en el rango.',
                aria: 'Entradas al gimnasio por hora'
              }) +
              '<p class="rep-nota">' +
                esc(e.horaPico >= 0
                  ? 'Hora pico: ' + dos(e.horaPico) + ':00 · ' + U.num(e.totalAsistencias, 0) + ' visitas en el rango.'
                  : 'Sin hora pico identificable.') + '</p>'
            : vacioHTML('Sin check-in registrados en el rango elegido.', 'reloj')) +
        cardHTML('Ocupación por día', 'calendario',
          e.totalAsistencias
            ? Charts.barras(e.dias, {
                alto: 260,
                vacio: 'Sin asistencias en el rango.',
                aria: 'Entradas al gimnasio por día de la semana'
              }) +
              '<p class="rep-nota">' +
                esc('Día más concurrido: ' + U.DIAS_SEMANA_LUNES[e.diaPico] + '.') + '</p>'
            : vacioHTML('Sin check-in registrados en el rango elegido.', 'calendario')) +
      '</div>';

    return html;
  }

  /* =============================================================
     8. Pestaña Satisfacción
     ============================================================= */

  function rankingCoachesHTML(datos) {
    var ranking = datos.satisfaccion.ranking;
    var conResenas = [];
    for (var i = 0; i < ranking.length; i++) {
      if (ranking[i].total > 0) conResenas.push(ranking[i]);
    }
    if (!conResenas.length) {
      return vacioHTML('Ningún coach tiene reseñas en este rango. Invita a los socios a calificar desde su panel.', 'estrella');
    }

    var html = '<div class="list">';
    for (i = 0; i < conResenas.length; i++) {
      var fila = conResenas[i];
      html += '<a class="list-item clickable" href="#/director/coach?id=' + esc(fila.coach.id) + '">' +
        '<div class="list-item-main">' +
          '<div class="row-sm">' +
            '<span class="rep-pos' + (i === 0 ? ' rep-oro' : '') + '">' + (i + 1) + '</span>' +
            personaHTML(fila.coach, fila.socios + (fila.socios === 1 ? ' socio asignado' : ' socios asignados')) +
          '</div>' +
        '</div>' +
        '<div class="list-item-side">' +
          U.estrellas(fila.promedio, { size: 15 }) +
          '<span class="mini muted">' + esc(U.num(fila.promedio, 1) + ' · ' + fila.total +
            (fila.total === 1 ? ' reseña' : ' reseñas')) + '</span>' +
        '</div>' +
      '</a>';
    }
    html += '</div>';

    var sinResenas = ranking.length - conResenas.length;
    if (sinResenas > 0) {
      html += '<p class="rep-nota">' + sinResenas +
        (sinResenas === 1 ? ' coach todavía no tiene reseñas' : ' coaches todavía no tienen reseñas') +
        ' en este rango.</p>';
    }
    return html;
  }

  function criticasHTML(datos) {
    var criticas = datos.satisfaccion.criticas;
    if (!criticas.length) {
      return vacioHTML('No hay reseñas críticas sin responder. Todas las quejas del rango ya tienen contestación.', 'check');
    }

    var tope = Math.min(criticas.length, 8);
    var html = '<div class="list">';
    for (var i = 0; i < tope; i++) {
      var c = criticas[i];
      var socio = c.socioId ? AG.DB.usuario(c.socioId) : null;
      var destino = null;
      if (c.tipo === 'coach' && c.objetivoId) destino = AG.DB.usuario(c.objetivoId);
      var sobre = destino ? U.nombreCompleto(destino) : 'El gimnasio';

      html += '<div class="list-item">' +
        '<div class="list-item-main">' +
          '<div class="row-sm wrap">' +
            U.estrellas(num(c.estrellas), { size: 15 }) +
            '<span class="badge badge-danger">Sin responder</span>' +
            '<span class="mini muted">' + esc(U.fecha(c.fecha, 'corto')) + '</span>' +
          '</div>' +
          '<p class="mini">' + esc(U.truncar(c.comentario || 'Sin comentario escrito.', 190)) + '</p>' +
          '<p class="mini muted">' + esc((socio ? U.nombreCompleto(socio) : 'Socio') + ' · sobre ' + sobre) + '</p>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';

    if (criticas.length > tope) {
      html += '<p class="rep-nota">Se muestran las ' + tope + ' más recientes de ' +
        criticas.length + ' reseñas críticas sin responder.</p>';
    }
    html += '<div class="row-sm mt"><a class="btn btn-outline btn-sm" href="#/director/calificaciones">' +
      icono('chat', 15) + ' Ir a responder</a></div>';
    return html;
  }

  function pestanaSatisfaccion(datos) {
    var sat = datos.satisfaccion;
    var nps = sat.nps;

    var claseNPS = nps.valor >= 50 ? 'ok' : (nps.valor >= 0 ? 'warn' : 'error');

    var kpis = '<div class="grid g4">' +
      kpiHTML('estrella', U.num(sat.global.promedio, 1) + ' / 5', 'Calificación global',
        '<div class="kpi-trend plana">' + U.estrellas(sat.global.promedio, { size: 13 }) + '</div>',
        sat.global.promedio >= 4.5 ? 'ok' : (sat.global.promedio >= 4 ? 'warn' : 'error')) +
      kpiHTML('chat', U.num(sat.global.total, 0), 'Reseñas del periodo',
        notaHTML('Últimos ' + datos.rango + ' meses'), 'info') +
      kpiHTML('meta', U.signo(nps.valor, 0), 'NPS aproximado',
        notaHTML(nps.promotores + ' promotores · ' + nps.detractores + ' detractores'), claseNPS) +
      kpiHTML('alerta', U.num(sat.criticas.length, 0), 'Críticas sin responder',
        notaHTML('3 estrellas o menos'),
        sat.criticas.length === 0 ? 'ok' : (sat.criticas.length <= 3 ? 'warn' : 'error')) +
    '</div>';

    var donaNPS = [];
    if (nps.total > 0) {
      donaNPS = [
        { etiqueta: 'Promotores', valor: nps.promotores, color: COLOR.ok },
        { etiqueta: 'Pasivos', valor: nps.pasivos, color: COLOR.warn },
        { etiqueta: 'Detractores', valor: nps.detractores, color: COLOR.error }
      ];
    }

    var html = kpis +
      cardHTML('Calificación mes a mes', 'grafica', graficaCalificacion(datos)) +
      '<div class="grid g2">' +
        cardHTML('NPS: promotores contra detractores', 'meta',
          donaNPS.length
            ? Charts.dona(donaNPS, {
                alto: 260,
                centroValor: String(nps.valor),
                centroTitulo: 'NPS',
                aria: 'Reparto de promotores, pasivos y detractores'
              })
            : vacioHTML('Sin reseñas en el rango para calcular el NPS.', 'estrella')) +
        cardHTML('Distribución de estrellas', 'estrella',
          sat.global.total
            ? Charts.barras(sat.distribucion, {
                horizontal: true, filaAlto: 32, anchoEtiquetas: 110,
                aria: 'Cantidad de reseñas por número de estrellas'
              })
            : vacioHTML('Todavía no hay reseñas en este rango.', 'estrella')) +
      '</div>' +
      cardHTML('Ranking de coaches', 'trofeo', rankingCoachesHTML(datos)) +
      cardHTML('Reseñas críticas sin responder', 'chat', criticasHTML(datos),
        '<span class="badge ' + (sat.criticas.length ? 'badge-danger' : 'badge-ok') + '">' +
          esc(U.num(sat.criticas.length, 0)) + '</span>');

    return html;
  }

  /* =============================================================
     9. Conclusiones automáticas
     ============================================================= */

  function construirConclusiones(datos) {
    var f = datos.finanzas;
    var s = datos.socios;
    var e = datos.entrenamiento;
    var sat = datos.satisfaccion;
    var lista = [];

    function agregar(tipo, nombreIcono, titulo, texto) {
      lista.push({ tipo: tipo, icono: nombreIcono, titulo: titulo, texto: texto });
    }

    /* ---- Crecimiento ---- */
    var referencia = f.enCurso
      ? 'los primeros ' + f.diaHoy + (f.diaHoy === 1 ? ' día' : ' días') + ' de ' + U.nombreMes(datos.mesAnterior)
      : U.nombreMes(datos.mesAnterior);
    var textoIngreso;
    if (f.variacionMes === null) {
      textoIngreso = 'En ' + U.nombreMes(datos.mesActual) + ' se han cobrado ' + U.dinero(f.ingresoMes, 0) +
        '. No hay un periodo anterior con movimientos para comparar.';
    } else if (f.variacionMes >= 0.5) {
      textoIngreso = 'El ingreso de ' + U.nombreMes(datos.mesActual) + ' va en ' + U.dinero(f.ingresoMes, 0) +
        ', ' + U.pct(Math.abs(f.variacionMes), 1) + ' por encima de ' + referencia +
        ' (' + U.dinero(f.ingresoComparable, 0) + ').';
    } else if (f.variacionMes <= -0.5) {
      textoIngreso = 'El ingreso de ' + U.nombreMes(datos.mesActual) + ' va en ' + U.dinero(f.ingresoMes, 0) +
        ', ' + U.pct(Math.abs(f.variacionMes), 1) + ' por debajo de ' + referencia +
        ' (' + U.dinero(f.ingresoComparable, 0) + ').';
    } else {
      textoIngreso = 'El ingreso de ' + U.nombreMes(datos.mesActual) + ' (' + U.dinero(f.ingresoMes, 0) +
        ') va prácticamente igual que ' + referencia + '.';
    }
    agregar(f.variacionMes !== null && f.variacionMes < -0.5 ? 'warn' : 'ok', 'dinero', 'Ingresos', textoIngreso);

    /* ---- Meta y rentabilidad ---- */
    if (f.meta > 0) {
      if (f.faltaMeta > 0) {
        agregar('warn', 'meta', 'Meta mensual',
          'Vas en ' + U.pct(f.pctMeta, 0) + ' de la meta de ' + U.dinero(f.meta, 0) +
          '; faltan ' + U.dinero(f.faltaMeta, 0) + ' para cerrarla' +
          (f.enCurso ? ' y quedan ' + Math.max(0, f.diasDelMes - f.diaHoy) + ' días del mes.' : '.'));
      } else {
        agregar('ok', 'meta', 'Meta mensual',
          'La meta de ' + U.dinero(f.meta, 0) + ' ya está cubierta, con ' +
          U.dinero(f.ingresoMes - f.meta, 0) + ' de excedente.');
      }
    }

    if (f.utilidadMes >= 0) {
      agregar('ok', 'grafica', 'Rentabilidad',
        U.nombreMes(f.mesCerrado) + ', el último mes completo, dejó una utilidad estimada de ' +
        U.dinero(f.utilidadMes, 0) + ' y un margen de ' + U.pct(f.margenMes, 1) +
        ' después de nómina (' + U.dinero(f.nomina, 0) + ') y costo fijo (' + U.dinero(f.costoFijo, 0) + ').');
    } else {
      agregar('error', 'alerta', 'Rentabilidad en rojo',
        U.nombreMes(f.mesCerrado) + ', el último mes completo, cerró con una pérdida estimada de ' +
        U.dinero(Math.abs(f.utilidadMes), 0) + ': se cobraron ' + U.dinero(f.ingresoCerrado, 0) +
        ' contra ' + U.dinero(f.nomina + f.costoFijo, 0) + ' de nómina y costo fijo.');
    }

    agregar('info', 'historial', 'Ingreso recurrente',
      'El MRR de las membresías vigentes es de ' + U.dinero(f.mrr, 0) + ' al mes y cubre ' +
      (f.nomina + f.costoFijo > 0
        ? U.pct(porcentaje(f.mrr, f.nomina + f.costoFijo), 0) + ' de los costos fijos.'
        : 'la operación completa.'));

    /* ---- Socios ---- */
    var neto = s.netoPeriodo;
    agregar(neto >= 0 ? 'ok' : 'warn', 'socios', 'Cartera de socios',
      'En ' + datos.rango + ' meses entraron ' + s.altasPeriodo +
      (s.altasPeriodo === 1 ? ' socio' : ' socios') + ' y salieron ' + s.bajasPeriodo +
      ': crecimiento neto de ' + U.signo(neto, 0) + '. Hoy hay ' + s.activos + ' activos con ' +
      U.num(s.antiguedad, 1) + ' meses de antigüedad promedio.');

    if (s.hayChurn) {
      agregar(s.churn <= 5 ? 'ok' : (s.churn <= 10 ? 'warn' : 'error'), 'flecha-abajo', 'Churn y retención',
        'La retención de ' + U.nombreMes(s.mesChurn) + ', el último mes completo, fue de ' +
        U.pct(s.retencion, 1) + ' con un churn de ' + U.pct(s.churn, 1) + ' (' + s.bajasChurn +
        (s.bajasChurn === 1 ? ' baja' : ' bajas') + ' sobre ' + s.activosInicio + ' activos al inicio).');
    }

    if (s.riesgo.length) {
      agregar(s.riesgo.length > 5 ? 'error' : 'warn', 'alerta', 'Riesgo de fuga',
        s.riesgo.length + (s.riesgo.length === 1 ? ' socio está' : ' socios están') +
        ' en riesgo por membresía vencida, ausencia de más de ' + DIAS_SIN_ASISTIR +
        ' días o adherencia menor a ' + ADHERENCIA_RIESGO + ' %. Recuperarlos vale ' +
        U.dinero(s.ltv * s.riesgo.length, 0) + ' de valor de vida.');
    } else {
      agregar('ok', 'escudo', 'Riesgo de fuga',
        'Ningún socio cumple hoy los criterios de riesgo: membresías al corriente y asistencia constante.');
    }

    /* ---- Entrenamiento ---- */
    var coberturaUltima = e.cobertura.length ? e.cobertura[e.cobertura.length - 1].y : 0;
    agregar(e.progresoPromedio >= 60 ? 'ok' : 'warn', 'pesa', 'Resultado del entrenamiento',
      'El progreso promedio del gimnasio es de ' + U.num(e.progresoPromedio, 0) +
      ' sobre 100 y la adherencia promedio de ' + U.pct(e.adherenciaPromedio, 0) + '. En ' +
      U.nombreMes(datos.mesActual) + ' se cerró el mes al ' + U.pct(coberturaUltima, 0) + ' de los socios activos.');

    if (coberturaUltima < 60) {
      agregar('warn', 'regla', 'Cobertura de mediciones',
        'La medición de cierre no llegó ni a 6 de cada 10 socios activos: sin ese dato el socio no ve su avance y la renovación se enfría.');
    }

    if (e.horaPico >= 0) {
      agregar('info', 'reloj', 'Operación',
        'La hora pico es a las ' + dos(e.horaPico) + ':00 y el día más concurrido es ' +
        U.DIAS_SEMANA_LUNES[e.diaPico].toLowerCase() + ', con ' + U.num(e.totalAsistencias, 0) +
        ' visitas registradas en el rango.');
    }

    /* ---- Satisfacción ---- */
    if (sat.global.total > 0) {
      agregar(sat.global.promedio >= 4.5 ? 'ok' : (sat.global.promedio >= 4 ? 'warn' : 'error'),
        'estrella', 'Satisfacción',
        'La calificación global es de ' + U.num(sat.global.promedio, 1) + ' de 5 sobre ' +
        sat.global.total + (sat.global.total === 1 ? ' reseña' : ' reseñas') + ', con un NPS de ' +
        U.signo(sat.nps.valor, 0) + '.');
      if (sat.criticas.length) {
        agregar('warn', 'chat', 'Quejas abiertas',
          sat.criticas.length + (sat.criticas.length === 1 ? ' reseña crítica sigue' : ' reseñas críticas siguen') +
          ' sin respuesta. Contestarlas es la forma más barata de retener a un socio molesto.');
      }
    } else {
      agregar('info', 'estrella', 'Satisfacción',
        'No hay reseñas en el rango elegido. Pide a los coaches que inviten a calificar al cerrar el mes.');
    }

    /* ---- Recomendaciones concretas ---- */
    var recomendaciones = [];
    if (f.faltaMeta > 0 && f.meta > 0) {
      var socioMedio = f.ticket > 0 ? Math.ceil(f.faltaMeta / f.ticket) : 0;
      recomendaciones.push('Cerrar la meta del mes requiere ' + U.dinero(f.faltaMeta, 0) +
        (socioMedio > 0 ? ', el equivalente a ' + socioMedio + ' cobros del ticket promedio.' : '.'));
    }
    if (s.riesgo.length) {
      recomendaciones.push('Asignar la lista de ' + s.riesgo.length +
        ' socios en riesgo a los coaches y dar seguimiento esta semana.');
    }
    if (s.hayChurn && s.churn > 5) {
      recomendaciones.push('Atacar el churn de ' + U.pct(s.churn, 1) +
        ' con recordatorio de renovación tres días antes del vencimiento.');
    }
    if (e.adherenciaPromedio < 60) {
      recomendaciones.push('Revisar las rutinas: con ' + U.pct(e.adherenciaPromedio, 0) +
        ' de adherencia conviene bajar los días por semana y subir la constancia.');
    }
    if (coberturaUltima < 60) {
      recomendaciones.push('Bloquear en la agenda de cada coach los días de medición inicial y de cierre de mes.');
    }
    if (sat.criticas.length) {
      recomendaciones.push(sat.criticas.length === 1
        ? 'Responder la reseña crítica pendiente desde la pantalla de Calificaciones.'
        : 'Responder las ' + sat.criticas.length + ' reseñas críticas pendientes desde la pantalla de Calificaciones.');
    }
    if (f.mrr > 0 && f.nomina + f.costoFijo > f.mrr) {
      recomendaciones.push('El MRR todavía no cubre los costos fijos: empujar planes de 3, 6 y 12 meses para asegurar caja.');
    }
    if (!recomendaciones.length) {
      recomendaciones.push('Los indicadores están en verde: sostener la operación y documentar lo que está funcionando.');
    }

    return { puntos: lista, recomendaciones: recomendaciones };
  }

  function conclusionesHTML(datos) {
    var c = construirConclusiones(datos);
    var html = '<div class="stack-sm">';
    for (var i = 0; i < c.puntos.length; i++) {
      var p = c.puntos[i];
      html += '<div class="rep-concl rep-' + esc(p.tipo) + '">' + icono(p.icono, 17) +
        '<div><b>' + esc(p.titulo) + '</b><span>' + esc(p.texto) + '</span></div></div>';
    }
    html += '</div>';

    html += '<h4 class="card-sub mt">Recomendaciones</h4><ul class="stack-sm" style="margin:0;padding-left:18px">';
    for (i = 0; i < c.recomendaciones.length; i++) {
      html += '<li class="mini">' + esc(c.recomendaciones[i]) + '</li>';
    }
    html += '</ul>';
    return html;
  }

  /* =============================================================
     10. Reporte ejecutivo para imprimir
     ============================================================= */

  function imprimirEjecutivo() {
    var datos;
    try { datos = calcularReporte(estado.meses); }
    catch (e) { toast('No se pudo preparar el reporte ejecutivo.', 'error'); return; }

    var f = datos.finanzas;
    var s = datos.socios;
    var e2 = datos.entrenamiento;
    var sat = datos.satisfaccion;

    var encabezado = '<div class="card"><div class="card-body">' +
      '<p class="mini muted">Periodo analizado: ' + esc(U.nombreMes(datos.meses[0])) + ' a ' +
        esc(U.nombreMes(datos.mesActual)) + ' · ' + datos.rango + ' meses · generado el ' +
        esc(U.fecha(U.hoy(), 'corto')) + '</p>' +
      '</div></div>';

    var bloqueKPIs = '<div class="card"><div class="card-head"><div class="card-title">Indicadores clave</div></div>' +
      '<div class="card-body"><div class="datos-grid">' +
        datoHTML('Ingresos del periodo', U.dinero(f.ingresoPeriodo, 0)) +
        datoHTML('Ingreso de ' + U.nombreMes(datos.mesActual), U.dinero(f.ingresoMes, 0)) +
        datoHTML('MRR', U.dinero(f.mrr, 0)) +
        datoHTML('Ticket promedio', U.dinero(f.ticket, 0)) +
        datoHTML('Utilidad de ' + U.nombreMes(f.mesCerrado), U.dinero(f.utilidadMes, 0)) +
        datoHTML('Margen', U.pct(f.margenMes, 1)) +
        datoHTML('Socios activos', U.num(s.activos, 0)) +
        datoHTML('Altas / bajas del mes', U.num(s.altasMes, 0) + ' / ' + U.num(s.bajasMes, 0)) +
        datoHTML('Retención (' + U.nombreMes(s.mesChurn) + ')', s.hayChurn ? U.pct(s.retencion, 1) : '—') +
        datoHTML('Churn (' + U.nombreMes(s.mesChurn) + ')', s.hayChurn ? U.pct(s.churn, 1) : '—') +
        datoHTML('LTV estimado', U.dinero(s.ltv, 0)) +
        datoHTML('Socios en riesgo', U.num(s.riesgo.length, 0)) +
        datoHTML('Progreso promedio', U.num(e2.progresoPromedio, 0) + ' / 100') +
        datoHTML('Adherencia promedio', U.pct(e2.adherenciaPromedio, 0)) +
        datoHTML('Calificación global', U.num(sat.global.promedio, 1) + ' de 5') +
        datoHTML('NPS', U.signo(sat.nps.valor, 0)) +
      '</div></div></div>';

    var graficas =
      '<div class="card"><div class="card-head"><div class="card-title">Ingresos por mes</div></div>' +
        '<div class="card-body">' + graficaIngresos(datos, { alto: 210, ancho: 700, sinTitulo: false }) + '</div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">Altas y bajas por mes</div></div>' +
        '<div class="card-body">' + graficaAltasBajas(datos, { alto: 210, ancho: 700 }) + '</div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">Calificación promedio por mes</div></div>' +
        '<div class="card-body">' + graficaCalificacion(datos, { alto: 200, ancho: 700 }) + '</div></div>';

    var conclusiones = '<div class="card"><div class="card-head">' +
      '<div class="card-title">Conclusiones y recomendaciones</div></div>' +
      '<div class="card-body">' + conclusionesHTML(datos) + '</div></div>';

    var titulo = 'Reporte ejecutivo · últimos ' + datos.rango + ' meses';
    U.imprimir(encabezado + bloqueKPIs + graficas + conclusiones, titulo);
    toast('Reporte ejecutivo listo para imprimir.', 'ok');
  }

  /* =============================================================
     11. Exportación CSV del detalle mensual
     ============================================================= */

  function csvCampo(valor) {
    var t = (valor === null || valor === undefined) ? '' : String(valor);
    if (/[",;\n\r]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  function csvNumero(valor, dec) {
    var v = n0(valor);
    if (v === null) return '';
    var d = (dec === undefined || dec === null) ? 2 : dec;
    var factor = Math.pow(10, d);
    return String(Math.round(v * factor) / factor);
  }

  function exportarMensualCSV() {
    var datos;
    try { datos = calcularReporte(estado.meses); }
    catch (e) { toast('No se pudo preparar la exportación.', 'error'); return; }

    if (!datos.filas.length) {
      toast('No hay meses que exportar.', 'warn');
      return;
    }

    var encabezados = ['Mes', 'Periodo', 'Estado del mes', 'Pagos cobrados', 'Ingreso',
      'Ingreso por mensualidades', 'Altas', 'Bajas', 'Neto', 'Activos al cierre',
      'Nómina', 'Costo fijo', 'Utilidad estimada', 'Margen %'];
    var lineas = [encabezados.map(csvCampo).join(',')];

    for (var i = 0; i < datos.filas.length; i++) {
      var f = datos.filas[i];
      var margen = (f.utilidad !== null && f.ingreso > 0) ? porcentaje(f.utilidad, f.ingreso) : null;
      lineas.push([
        U.nombreMes(f.mes),
        f.mes,
        f.enCurso ? 'En curso' : (f.operativo ? 'Cerrado' : 'Sin operación'),
        csvNumero(f.pagos, 0),
        csvNumero(f.ingreso, 2),
        csvNumero(f.mensualidades, 2),
        csvNumero(f.altas, 0),
        csvNumero(f.bajas, 0),
        csvNumero(f.altas - f.bajas, 0),
        csvNumero(f.activos, 0),
        f.operativo ? csvNumero(datos.finanzas.nomina, 2) : '',
        f.operativo ? csvNumero(datos.finanzas.costoFijo, 2) : '',
        csvNumero(f.utilidad, 2),
        csvNumero(margen, 1)
      ].map(csvCampo).join(','));
    }

    var nombre = 'reporte-mensual-' + datos.rango + 'm-' + U.hoy() + '.csv';
    /* El BOM hace que Excel en español respete los acentos. */
    var ok = U.descargar(nombre, '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
    if (ok) toast('Detalle mensual exportado: ' + nombre, 'ok');
  }

  /* =============================================================
     12. Armado de la pantalla y eventos
     ============================================================= */

  function rangosHTML() {
    var html = '<div class="chips" data-rangos role="group" aria-label="Rango de análisis">';
    for (var i = 0; i < RANGOS.length; i++) {
      html += '<button type="button" class="chip' + (estado.meses === RANGOS[i].meses ? ' on' : '') +
        '" data-rango="' + RANGOS[i].meses + '">' + esc(RANGOS[i].etiqueta) + '</button>';
    }
    return html + '</div>';
  }

  function pestanasHTML() {
    var html = '<div class="tabs" data-tabs role="tablist">';
    for (var i = 0; i < PESTANAS.length; i++) {
      var p = PESTANAS[i];
      html += '<button type="button" class="tab' + (estado.pestana === p.clave ? ' active' : '') +
        '" data-tab="' + esc(p.clave) + '" role="tab" aria-selected="' +
        (estado.pestana === p.clave ? 'true' : 'false') + '">' +
        icono(p.icono, 16) + '<span>' + esc(p.etiqueta) + '</span></button>';
    }
    return html + '</div>';
  }

  function cuerpoHTML(datos) {
    var contenido;
    if (estado.pestana === 'socios') contenido = pestanaSocios(datos);
    else if (estado.pestana === 'entrenamiento') contenido = pestanaEntrenamiento(datos);
    else if (estado.pestana === 'satisfaccion') contenido = pestanaSatisfaccion(datos);
    else contenido = pestanaFinanzas(datos);

    return '<div class="stack">' + contenido +
      cardHTML('Conclusiones automáticas', 'info', conclusionesHTML(datos),
        '<button type="button" class="btn btn-primary btn-sm" data-imprimir>' +
          icono('imprimir', 15) + ' Imprimir reporte ejecutivo</button>') +
    '</div>';
  }

  function render(ctx) {
    var usuario = ctx ? ctx.usuario : null;
    if (!usuario || usuario.rol !== 'director') {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('Los reportes del negocio son exclusivos de la dirección.', 'candado') +
        '</div></div></div>';
    }

    asegurarEstilos();

    var datos;
    try {
      datos = calcularReporte(estado.meses);
    } catch (e) {
      return '<div class="page"><div class="card"><div class="card-body">' +
        vacioHTML('No pudimos calcular los reportes con los datos actuales. Revisa la base desde Configuración.', 'alerta') +
        '</div></div></div>';
    }

    var html = '<div class="page" data-reportes>' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-title">' + icono('grafica', 24) + '<span>Reportes</span></h1>' +
          '<p class="page-sub">Todo el negocio en una pantalla: dinero, socios, resultados de entrenamiento y satisfacción. Las cifras salen de la base real.</p>' +
        '</div>' +
        '<div class="page-acciones">' +
          rangosHTML() +
          '<button type="button" class="btn btn-outline" data-imprimir>' +
            icono('imprimir', 16) + ' Imprimir reporte ejecutivo</button>' +
        '</div>' +
      '</div>' +
      pestanasHTML() +
      '<div data-cuerpo>' + cuerpoHTML(datos) + '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root); }
    };
  }

  /* Repinta solo lo que cambia: chips, pestañas y cuerpo. */
  function repintar(raiz) {
    var datos;
    try {
      datos = calcularReporte(estado.meses);
    } catch (e) {
      toast('No se pudieron recalcular los reportes.', 'error');
      return;
    }

    var chips = raiz.querySelector('[data-rangos]');
    if (chips) {
      var botones = U.$$('[data-rango]', chips);
      for (var i = 0; i < botones.length; i++) {
        botones[i].classList.toggle('on', Number(botones[i].getAttribute('data-rango')) === estado.meses);
      }
    }

    var tabs = raiz.querySelector('[data-tabs]');
    if (tabs) {
      var pestanas = U.$$('[data-tab]', tabs);
      for (var j = 0; j < pestanas.length; j++) {
        var activa = pestanas[j].getAttribute('data-tab') === estado.pestana;
        pestanas[j].classList.toggle('active', activa);
        pestanas[j].setAttribute('aria-selected', activa ? 'true' : 'false');
      }
    }

    var cuerpo = raiz.querySelector('[data-cuerpo]');
    if (cuerpo) cuerpo.innerHTML = cuerpoHTML(datos);
  }

  function enganchar(root) {
    var raiz = root ? root.querySelector('[data-reportes]') : null;
    if (!raiz || raiz.__repEnganchado) return;
    raiz.__repEnganchado = true;
    asegurarEstilos();

    U.delegar(raiz, 'click', '[data-rango]', function (e, el) {
      e.preventDefault();
      var meses = Number(el.getAttribute('data-rango')) || 6;
      if (meses === estado.meses) return;
      estado.meses = meses;
      repintar(raiz);
    });

    U.delegar(raiz, 'click', '[data-tab]', function (e, el) {
      e.preventDefault();
      var clave = el.getAttribute('data-tab') || 'finanzas';
      if (clave === estado.pestana) return;
      estado.pestana = clave;
      repintar(raiz);
    });

    U.delegar(raiz, 'click', '[data-csv-mensual]', function (e) {
      e.preventDefault();
      exportarMensualCSV();
    });

    U.delegar(raiz, 'click', '[data-imprimir]', function (e) {
      e.preventDefault();
      imprimirEjecutivo();
    });
  }

  /* =============================================================
     13. Exposición y registro de la ruta
     ============================================================= */

  AG.Mod.Reportes = {
    render: render,
    calcular: calcularReporte,
    conclusiones: construirConclusiones,
    imprimir: imprimirEjecutivo,
    exportarCSV: exportarMensualCSV
  };

  AG.Router.registrar({
    path: 'director/reportes',
    roles: ['director'],
    titulo: 'Reportes',
    nav: { etiqueta: 'Reportes', icono: 'grafica', grupo: 'Negocio', orden: 1 },
    render: render
  });
})(window.AG);
