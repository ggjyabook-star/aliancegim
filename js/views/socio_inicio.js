/* =============================================================
   ALLIANCE GYM — AG.Views.SocioInicio
   -------------------------------------------------------------
   El panel del socio: todo lo que necesita en una sola pantalla.
   Saludo y racha, membresía, entrenamiento de hoy, nutrición de
   hoy, progreso del mes, mini métricas, avisos, próxima clase,
   su coach y accesos rápidos.

   Ruta: 'socio/inicio' (solo rol 'socio').

   Reglas de la casa: JavaScript clásico sin módulos, todo en
   español, escapado con AG.Utils.esc(), nada de alert/confirm/
   prompt, nada de localStorage directo y ningún bloque sin su
   estado vacío con un mensaje útil.

   Este archivo NO duplica lógica: reutiliza AG.Calc, AG.Charts,
   AG.Data y los módulos ya escritos (Avisos, Clases, Rutinas,
   Calificaciones) con sus firmas reales.
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

  /* Días de la semana en los que se entrena según los días por
     semana de la rutina (0 = domingo, igual que Date.getDay()).
     Es la misma pauta con la que se generan las bitácoras. */
  var PAUTA_SEMANAL = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6]
  };

  /* Colores de los macronutrientes en la dona (paleta de gráficas). */
  var COLOR_PROTEINA = 'var(--chart-2,#3B82F6)';
  var COLOR_CARBOS = 'var(--chart-4,#F59E0B)';
  var COLOR_GRASA = 'var(--chart-5,#A855F7)';

  /* Accesos rápidos del pie del panel. */
  var ACCESOS = [
    { path: 'socio/rutina', icono: 'mancuerna', etiqueta: 'Mi rutina' },
    { path: 'socio/progreso', icono: 'grafica', etiqueta: 'Mi progreso' },
    { path: 'socio/nutricion', icono: 'nutricion', etiqueta: 'Nutrición' },
    { path: 'socio/calculadora', icono: 'calculadora', etiqueta: 'Calculadora' },
    { path: 'socio/membresia', icono: 'tarjeta', etiqueta: 'Membresía' },
    { path: 'socio/clases', icono: 'clase', etiqueta: 'Clases' },
    { path: 'socio/calificar', icono: 'estrella', etiqueta: 'Calificar' }
  ];

  /* Campos del comparativo que más le importan al socio, en orden. */
  var PRIORIDAD_CAMBIOS = ['grasaPct', 'grasaKg', 'musculoKg', 'masaMagra', 'cintura', 'peso', 'imc'];

  /* =============================================================
     1. Ayudantes básicos (ninguno lanza)
     ============================================================= */

  function esc(v) { return U.esc(v); }

  function icono(nombre, tam) {
    try { return Icons.get(nombre, tam || 16); } catch (e) { return ''; }
  }

  function lista(v) {
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }

  /* Número finito o null (nunca NaN ni cadena vacía). */
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

  /* 'HH:MM' -> minutos desde medianoche, o null. */
  function minutosDeHora(hora) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hora === null || hora === undefined ? '' : hora).trim());
    if (!m) return null;
    var h = Number(m[1]), min = Number(m[2]);
    if (!isFinite(h) || !isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  function minutosDeAhora() {
    var f = new Date();
    return f.getHours() * 60 + f.getMinutes();
  }

  /* Saludo según la hora del reloj del socio. */
  function saludo() {
    var h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /* Solo el primer nombre: el panel se siente más cercano. */
  function primerNombre(usuario) {
    var completo = U.nombreCompleto(usuario);
    if (!completo) return 'socio';
    var partes = completo.split(/\s+/);
    return partes[0] || completo;
  }

  /* Enlace de WhatsApp con lada de México cuando faltan los dígitos. */
  function enlaceWhatsApp(telefono, mensaje) {
    var digitos = String(telefono === null || telefono === undefined ? '' : telefono).replace(/\D/g, '');
    if (digitos.length < 10) return '';
    if (digitos.length === 10) digitos = '52' + digitos;
    var url = 'https://wa.me/' + digitos;
    if (mensaje) {
      try { url += '?text=' + encodeURIComponent(String(mensaje)); }
      catch (e) { /* si el mensaje no se puede codificar se manda el enlace pelón */ }
    }
    return url;
  }

  /* Ajustes del gimnasio con respaldo (nunca se leen a pelo). */
  function ajustes() {
    var s = null;
    try { s = AG.DB && AG.DB.state ? AG.DB.state.settings : null; } catch (e) { s = null; }
    return (s && typeof s === 'object') ? s : {};
  }

  function nombreGym() {
    return ajustes().nombreGym || 'Alliance Gym';
  }

  /* El socio de la sesión, siempre releído de la base (nunca en caché). */
  function socioActual() {
    var u = null;
    try { u = AG.Auth && typeof AG.Auth.actual === 'function' ? AG.Auth.actual() : null; }
    catch (e) { u = null; }
    if (!u || u.rol !== 'socio') return null;
    return AG.DB.usuario(u.id) || u;
  }

  /* Llama a una función de otro módulo sin que un fallo suyo tumbe el panel. */
  function reusar(fn, alterno) {
    if (typeof fn !== 'function') return alterno;
    var salida;
    try { salida = fn(); } catch (e) { return alterno; }
    return (typeof salida === 'string' && salida) ? salida : alterno;
  }

  /* =============================================================
     2. Piezas de interfaz reutilizables
     ============================================================= */

  function vacioHTML(mensaje, nombreIcono, accionHTML) {
    return '<div class="empty">' +
      '<div class="empty-icono">' + icono(nombreIcono || 'info', 30) + '</div>' +
      '<p class="empty-texto">' + esc(mensaje) + '</p>' +
      (accionHTML || '') +
    '</div>';
  }

  function cardHTML(opciones) {
    var o = opciones || {};
    var clases = 'card' + (o.clase ? ' ' + o.clase : '');
    var cabecera = '';

    if (o.titulo) {
      cabecera = '<div class="card-head">' +
        '<div>' +
          '<div class="card-title">' + icono(o.icono || 'info', 18) + '<span>' + esc(o.titulo) + '</span></div>' +
          (o.sub ? '<p class="card-sub">' + esc(o.sub) + '</p>' : '') +
        '</div>' +
        (o.accion ? '<div class="card-accion">' + o.accion + '</div>' : '') +
      '</div>';
    }

    return '<div class="' + clases + '">' +
      cabecera +
      '<div class="card-body' + (o.claseCuerpo ? ' ' + o.claseCuerpo : '') + '">' + (o.cuerpo || '') + '</div>' +
      (o.pie ? '<div class="card-foot">' + o.pie + '</div>' : '') +
    '</div>';
  }

  function pill(texto, nombreIcono, clase) {
    return '<span class="pill' + (clase ? ' ' + clase : '') + '">' +
      (nombreIcono ? icono(nombreIcono, 13) : '') + esc(texto) + '</span>';
  }

  function dato(etiqueta, valorHTML, detalle) {
    return '<div class="dato">' +
      '<span class="dato-label">' + esc(etiqueta) + '</span>' +
      '<span class="dato-val">' + valorHTML + '</span>' +
      (detalle ? '<span class="mini muted">' + esc(detalle) + '</span>' : '') +
    '</div>';
  }

  /* Enlace con aspecto de botón: navega con el hash del router. */
  function botonRuta(path, texto, clase, nombreIcono) {
    return '<a class="btn ' + (clase || 'btn-outline') + '" href="#/' + esc(path) + '">' +
      (nombreIcono ? icono(nombreIcono, 15) : '') + esc(texto) + '</a>';
  }

  function claseTendencia(tendencia) {
    if (tendencia === 'mejor') return 'txt-ok';
    if (tendencia === 'peor') return 'txt-error';
    return 'muted';
  }

  /* =============================================================
     3. Estilos propios (variantes mínimas sobre el contrato CSS)
     ============================================================= */

  var CSS_ID = 'ag-estilo-socio-inicio';

  function asegurarEstilos() {
    if (!document || document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      /* Encabezado con el saludo */
      '.si-hero{display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
      '.si-hero-txt{min-width:0;flex:1 1 220px}' +
      '.si-hola{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--texto-3)}' +
      '.si-nombre{font-size:24px;font-weight:800;letter-spacing:-.02em;color:var(--texto);line-height:1.15;margin:2px 0 4px}' +
      '.si-racha{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radio-sm);' +
        'background:var(--rojo-bg);border:1px solid var(--borde);min-width:0}' +
      '.si-racha svg{color:var(--rojo);flex:0 0 auto}' +
      '.si-racha b{font-size:19px;font-weight:800;color:var(--texto);line-height:1.1;display:block}' +

      /* Bordes de aviso para la tarjeta de membresía */
      '.si-borde-warn{border-color:var(--warn)}' +
      '.si-borde-error{border-color:var(--error)}' +

      /* Listas del entrenamiento y de las comidas */
      '.si-fila{display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--borde);' +
        'border-radius:var(--radio-sm);background:var(--panel-2);min-width:0}' +
      '.si-fila-num{flex:0 0 auto;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;' +
        'background:var(--rojo);color:#fff;font-size:11px;font-weight:800}' +
      '.si-fila-txt{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;line-height:1.3}' +
      '.si-fila-txt b{font-size:13px;font-weight:700;color:var(--texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.si-fila-txt span{font-size:11.5px;color:var(--texto-3)}' +
      '.si-fila-side{flex:0 0 auto;font-size:12px;font-weight:700;color:var(--texto-2);' +
        'font-variant-numeric:tabular-nums;white-space:nowrap}' +

      /* Macros */
      '.si-macros{display:grid;gap:8px}' +
      '.si-macro{display:flex;align-items:center;gap:8px;font-size:12.5px;min-width:0}' +
      '.si-macro-punto{flex:0 0 auto;width:10px;height:10px;border-radius:3px}' +
      '.si-macro-nom{flex:1 1 auto;min-width:0;color:var(--texto-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.si-macro-val{flex:0 0 auto;font-weight:800;color:var(--texto);font-variant-numeric:tabular-nums}' +

      /* Cambios destacados del comparativo */
      '.si-cambio{display:flex;align-items:center;gap:8px;font-size:13px;min-width:0}' +
      '.si-cambio-nom{flex:1 1 auto;min-width:0;color:var(--texto-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.si-cambio-val{flex:0 0 auto;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;' +
        'display:inline-flex;align-items:center;gap:4px}' +
      '.si-cambio-val svg{width:14px;height:14px}' +

      /* Mini métricas con sparkline */
      '.si-metricas{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}' +
      '.si-metrica{border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);' +
        'padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0}' +
      '.si-met-lbl{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--texto-3)}' +
      '.si-met-val{font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--texto);line-height:1.15;' +
        'font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.si-met-val i{font-style:normal;font-size:12px;font-weight:700;color:var(--texto-3)}' +
      '.si-met-pie{font-size:11px;line-height:1.35;color:var(--texto-3);min-height:15px;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.si-met-chart{margin-top:2px}' +

      /* Accesos rápidos */
      '.si-accesos{display:grid;gap:10px;grid-template-columns:repeat(7,minmax(0,1fr))}' +
      '.si-acceso{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;' +
        'padding:14px 8px;border:1px solid var(--borde);border-radius:var(--radio-sm);background:var(--panel-2);' +
        'color:var(--texto-2);font-size:12px;font-weight:700;text-align:center;text-decoration:none;' +
        'transition:border-color var(--trans),color var(--trans),transform var(--trans)}' +
      '.si-acceso svg{color:var(--rojo)}' +
      '.si-acceso:hover{border-color:var(--rojo);color:var(--texto);transform:translateY(-2px)}' +
      '.si-acceso:focus-visible{outline:2px solid var(--rojo);outline-offset:2px}' +

      /* Punto de color de la clase */
      '.si-punto{flex:0 0 auto;width:12px;height:12px;border-radius:50%}' +

      /* Semana de entrenamiento (modal) */
      '.si-dia{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--borde);' +
        'border-radius:var(--radio-sm);background:var(--panel-2);min-width:0}' +
      '.si-dia.si-dia-hoy{border-color:var(--rojo);background:var(--rojo-bg)}' +
      '.si-dia-nom{flex:0 0 86px;font-size:12px;font-weight:800;color:var(--texto-2)}' +
      '.si-dia-txt{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;line-height:1.3}' +
      '.si-dia-txt b{font-size:13px;color:var(--texto)}' +
      '.si-dia-txt span{font-size:11.5px;color:var(--texto-3)}' +

      /* Colapsos progresivos hasta 380 px */
      '@media (max-width:1180px){.si-metricas{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
      '@media (max-width:900px){.si-accesos{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
      '@media (max-width:640px){.si-metricas{grid-template-columns:repeat(2,minmax(0,1fr))}' +
        '.si-nombre{font-size:21px}}' +
      '@media (max-width:420px){.si-accesos{grid-template-columns:repeat(3,minmax(0,1fr))}' +
        '.si-dia-nom{flex:0 0 62px}}' +
      '@media (max-width:360px){.si-metricas{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  /* =============================================================
     4. Lectura de datos (siempre acotada al propio socio)
     ============================================================= */

  /* Mediciones que el socio tiene permitido ver. */
  function medicionesDelSocio(socioId) {
    var todas = AG.DB.medicionesDe(socioId);
    var salida = [];
    for (var i = 0; i < todas.length; i++) {
      if (todas[i] && todas[i].visibleParaSocio !== false) salida.push(todas[i]);
    }
    return salida;
  }

  /* Última medición con un dato concreto (peso, grasa, etc.). */
  function ultimaConDato(mediciones, ruta) {
    for (var i = mediciones.length - 1; i >= 0; i--) {
      if (valorPorRuta(mediciones[i], ruta) !== null) return mediciones[i];
    }
    return null;
  }

  /* Lee 'medidas.cintura' sin reventar. */
  function valorPorRuta(obj, ruta) {
    if (!obj || !ruta) return null;
    var partes = String(ruta).split('.');
    var actual = obj;
    for (var i = 0; i < partes.length; i++) {
      if (actual === null || actual === undefined) return null;
      actual = actual[partes[i]];
    }
    return n0(actual);
  }

  /* Serie de valores para una minigráfica (máximo 'tope' puntos). */
  function serieDe(mediciones, ruta, tope) {
    var puntos = [];
    for (var i = 0; i < mediciones.length; i++) {
      var v = valorPorRuta(mediciones[i], ruta);
      if (v === null) continue;
      puntos.push({ x: mediciones[i].fecha, etiqueta: U.fecha(mediciones[i].fecha, 'diaMes'), y: v });
    }
    var max = tope || 8;
    return puntos.length > max ? puntos.slice(puntos.length - max) : puntos;
  }

  /* Los últimos n meses en formato 'YYYY-MM'. */
  function ultimosMeses(n) {
    var salida = [], base = U.hoy(), i;
    for (i = n - 1; i >= 0; i--) salida.push(U.mesDe(U.sumaMeses(base, -i)));
    return salida;
  }

  /* Las últimas n semanas como rangos { desde, hasta }. */
  function ultimasSemanas(n) {
    var salida = [], hoy = U.hoy(), i;
    for (i = n - 1; i >= 0; i--) {
      var hasta = U.sumaDias(hoy, -7 * i);
      salida.push({ desde: U.sumaDias(hasta, -6), hasta: hasta });
    }
    return salida;
  }

  /* Bitácora registrada hoy (la última, si hubiera más de una). */
  function bitacoraDeHoy(bitacoras) {
    var hoy = U.hoy();
    for (var i = 0; i < bitacoras.length; i++) {
      if (String(bitacoras[i].fecha || '').slice(0, 10) === hoy) return bitacoras[i];
    }
    return null;
  }

  /*
     Qué día de la rutina toca según el día de la semana.
     Devuelve { hoy, indice, dia, dow, salto, semana, dias } o null.
  */
  function diaQueToca(rutina) {
    var dias = lista(rutina && rutina.dias);
    if (!dias.length) return null;

    var porSemana = Math.round(Number(rutina.diasPorSemana));
    if (!isFinite(porSemana) || porSemana < 1) porSemana = dias.length;
    if (porSemana > 7) porSemana = 7;

    var pauta = PAUTA_SEMANAL[porSemana] || PAUTA_SEMANAL[3];
    var semana = [], i;
    for (i = 0; i < pauta.length; i++) {
      semana.push({ dow: pauta[i], indice: i % dias.length });
    }

    var hoyDow = new Date().getDay();

    for (i = 0; i < semana.length; i++) {
      if (semana[i].dow === hoyDow) {
        return {
          hoy: true, indice: semana[i].indice, dia: dias[semana[i].indice],
          dow: hoyDow, salto: 0, semana: semana, dias: dias
        };
      }
    }

    /* Hoy toca descanso: se busca el próximo día de entrenamiento. */
    var mejor = null, mejorSalto = 99;
    for (i = 0; i < semana.length; i++) {
      var salto = (semana[i].dow - hoyDow + 7) % 7;
      if (salto === 0) salto = 7;
      if (salto < mejorSalto) { mejorSalto = salto; mejor = semana[i]; }
    }
    if (!mejor) return null;

    return {
      hoy: false, indice: mejor.indice, dia: dias[mejor.indice],
      dow: mejor.dow, salto: mejorSalto, semana: semana, dias: dias
    };
  }

  /* Estadísticas del día: se piden al módulo de rutinas (no se duplican). */
  function statsDia(dia) {
    var alterno = { ejercicios: lista(dia && dia.ejercicios).length, series: 0, minutos: 0, grupos: [] };
    if (!AG.Mod || !AG.Mod.Rutinas || typeof AG.Mod.Rutinas.estadisticasDia !== 'function') return alterno;
    try {
      var st = AG.Mod.Rutinas.estadisticasDia(dia);
      return (st && typeof st === 'object') ? st : alterno;
    } catch (e) { return alterno; }
  }

  /*
     Datos de nutrición del día: del plan activo o calculados con AG.Calc.
     Devuelve null si no hay forma de calcularlos (falta el peso).
  */
  function datosNutricion(socio, mediciones) {
    var plan = AG.DB.planNutricionDe(socio.id);
    var medPeso = ultimaConDato(mediciones, 'pesoKg');
    var peso = medPeso ? nPos(medPeso.pesoKg) : null;
    var estatura = nPos(socio.estaturaCm) || (medPeso ? nPos(medPeso.estaturaCm) : null);

    if (plan) {
      var comidasPlan = [];
      var lasComidas = lista(plan.comidas);
      for (var i = 0; i < lasComidas.length; i++) {
        var c = lasComidas[i];
        if (!c || typeof c !== 'object') continue;
        var totales = { kcal: 0 };
        if (AG.Data && typeof AG.Data.sumaMacros === 'function') {
          try { totales = AG.Data.sumaMacros(lista(c.alimentos)) || { kcal: 0 }; }
          catch (e) { totales = { kcal: 0 }; }
        }
        comidasPlan.push({
          nombre: String(c.nombre || 'Comida'),
          hora: String(c.hora || ''),
          kcal: n0(totales.kcal) || 0,
          piezas: lista(c.alimentos).length
        });
      }

      return {
        origen: 'plan',
        plan: plan,
        kcal: n0(plan.kcal) || 0,
        proteina: n0(plan.proteina) || 0,
        carbos: n0(plan.carbos) || 0,
        grasa: n0(plan.grasa) || 0,
        agua: nPos(plan.agua) || Calc.aguaDiaria(peso, socio.nivelActividad),
        comidas: comidasPlan,
        peso: peso
      };
    }

    /* Sin plan: se estima con la calculadora del sistema. */
    if (peso === null || estatura === null) return null;

    var perfil;
    try {
      perfil = Calc.perfilNutricional({
        pesoKg: peso,
        estaturaCm: estatura,
        edad: U.edad(socio.fechaNacimiento),
        sexo: socio.sexo,
        nivelActividad: socio.nivelActividad,
        objetivo: socio.objetivo,
        numComidas: 4
      });
    } catch (e) { perfil = null; }

    if (!perfil || !perfil.macros || !perfil.kcal) return null;

    var comidasCalc = [], listaC = lista(perfil.comidas);
    for (var j = 0; j < listaC.length; j++) {
      comidasCalc.push({
        nombre: String(listaC[j].nombre || 'Comida'),
        hora: String(listaC[j].hora || ''),
        kcal: n0(listaC[j].kcal) || 0,
        piezas: 0
      });
    }

    return {
      origen: 'calculado',
      plan: null,
      kcal: n0(perfil.kcal) || 0,
      proteina: n0(perfil.macros.proteina) || 0,
      carbos: n0(perfil.macros.carbos) || 0,
      grasa: n0(perfil.macros.grasa) || 0,
      agua: perfil.agua,
      comidas: comidasCalc,
      peso: peso
    };
  }

  /* La comida que sigue según el reloj (o la primera de mañana). */
  function proximaComida(comidas) {
    if (!comidas || !comidas.length) return null;
    var ahora = minutosDeAhora();
    var conHora = [], sinHora = [], i;

    for (i = 0; i < comidas.length; i++) {
      var min = minutosDeHora(comidas[i].hora);
      if (min === null) sinHora.push(comidas[i]);
      else conHora.push({ comida: comidas[i], min: min });
    }

    conHora.sort(function (a, b) { return a.min - b.min; });

    for (i = 0; i < conHora.length; i++) {
      if (conHora[i].min >= ahora) {
        return { comida: conHora[i].comida, manana: false, minutos: conHora[i].min - ahora };
      }
    }
    if (conHora.length) return { comida: conHora[0].comida, manana: true, minutos: 0 };
    if (sinHora.length) return { comida: sinHora[0], manana: false, minutos: 0 };
    return null;
  }

  /* Reúne de una sola pasada todo lo que pinta el panel. */
  function reunirDatos(socio) {
    var mediciones = medicionesDelSocio(socio.id);
    var asistencias = AG.DB.asistenciasDe(socio.id);
    var bitacoras = AG.DB.bitacorasDe(socio.id);
    var activa = AG.DB.rutinaActivaDe(socio.id);
    var periodo = U.mesActual();

    var ini = AG.DB.medicionDelMes(socio.id, periodo, 'inicial');
    var fin = AG.DB.medicionDelMes(socio.id, periodo, 'final');
    if (ini && ini.visibleParaSocio === false) ini = null;
    if (fin && fin.visibleParaSocio === false) fin = null;

    return {
      periodo: periodo,
      mediciones: mediciones,
      asistencias: asistencias,
      bitacoras: bitacoras,
      rutina: activa ? activa.rutina : null,
      asignacion: activa ? activa.asignacion : null,
      medicionInicial: ini,
      medicionFinal: fin,
      coach: socio.coachId ? AG.DB.usuario(socio.coachId) : null,
      plan: AG.DB.plan(socio.planId),
      pagos: AG.DB.pagosDe(socio.id),
      estado: Calc.estadoMembresia(socio),
      racha: Calc.rachaDias(asistencias),
      nutricion: datosNutricion(socio, mediciones)
    };
  }

  /* =============================================================
     5. Encabezado y aviso de membresía
     ============================================================= */

  function heroHTML(socio, datos) {
    var racha = datos.racha;
    var textoRacha = racha > 0
      ? (racha === 1 ? '1 día seguido' : racha + ' días seguidos')
      : 'Sin racha activa';
    var pieRacha = racha > 0
      ? 'Tu racha de asistencia. ¡No la rompas!'
      : 'Ven hoy al gimnasio y empieza una nueva racha.';

    var chips = '<div class="chips mt-sm">';
    if (socio.codigo) chips += pill(socio.codigo, 'qr');
    chips += pill(U.fecha(U.hoy(), 'largo'), 'calendario');
    if (socio.objetivo && Calc.ETIQUETA_OBJETIVO && Calc.ETIQUETA_OBJETIVO[socio.objetivo]) {
      chips += pill(Calc.ETIQUETA_OBJETIVO[socio.objetivo], 'meta');
    }
    if (datos.coach) chips += pill('Coach ' + U.nombreCompleto(datos.coach), 'coach');
    chips += '</div>';

    return '<div class="card card-rojo"><div class="card-body">' +
      '<div class="si-hero">' +
        U.avatar(socio, 'lg') +
        '<div class="si-hero-txt">' +
          '<div class="si-hola">' + esc(saludo()) + '</div>' +
          '<div class="si-nombre">' + esc(primerNombre(socio)) + '</div>' +
          '<p class="mini muted">' + esc(ajustes().lema || 'Más fuertes juntos') + '</p>' +
        '</div>' +
        '<div class="si-racha">' +
          icono('fuego', 26) +
          '<div style="min-width:0">' +
            '<b>' + esc(textoRacha) + '</b>' +
            '<span class="mini muted">' + esc(pieRacha) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      chips +
    '</div></div>';
  }

  /* Aviso ancho y visible cuando la membresía necesita atención. */
  function alertaMembresiaHTML(datos) {
    var est = datos.estado;
    if (!est) return '';

    if (est.estado === 'vencido') {
      return '<div class="aviso aviso-error">' + icono('alerta', 18) +
        '<div><b>Tu membresía está vencida.</b> ' + esc(est.texto) +
        '. Pasa a recepción a renovar para volver a entrenar sin límites.</div></div>';
    }
    if (est.estado === 'por_vencer') {
      return '<div class="aviso aviso-warn">' + icono('alerta', 18) +
        '<div><b>Tu membresía está por vencer.</b> ' + esc(est.texto) +
        '. Renueva a tiempo y no pierdas tu racha.</div></div>';
    }
    if (est.estado === 'congelado') {
      return '<div class="aviso aviso-info">' + icono('info', 18) +
        '<div><b>Tu membresía está congelada.</b> Cuando quieras reactivarla, avísale a recepción.</div></div>';
    }
    return '';
  }

  /* =============================================================
     6. Tarjeta de membresía
     ============================================================= */

  function membresiaHTML(socio, datos) {
    var est = datos.estado;
    var plan = datos.plan;
    var meses = Calc.mesesDeMembresia(socio, datos.pagos);
    var dias = Number(est.diasRestantes) || 0;

    var claseTarjeta = '';
    if (est.estado === 'vencido') claseTarjeta = 'si-borde-error';
    else if (est.estado === 'por_vencer') claseTarjeta = 'si-borde-warn';

    var valorDias, etiquetaDias, detalleDias;
    if (est.estado === 'congelado' || est.estado === 'baja') {
      valorDias = '—';
      etiquetaDias = 'Días restantes';
      detalleDias = est.texto;
    } else if (dias >= 0) {
      valorDias = String(dias);
      etiquetaDias = dias === 1 ? 'Día restante' : 'Días restantes';
      detalleDias = est.vence ? 'Vence el ' + U.fecha(est.vence, 'corto') : 'Sin fecha registrada';
    } else {
      valorDias = String(-dias);
      etiquetaDias = (-dias) === 1 ? 'Día vencido' : 'Días vencidos';
      detalleDias = est.vence ? 'Venció el ' + U.fecha(est.vence, 'corto') : 'Sin fecha registrada';
    }

    var cuerpo = '<div class="row between wrap mb-sm" style="gap:10px">' +
      '<div style="min-width:0">' +
        '<b style="font-size:16px">' + esc(plan ? plan.nombre : 'Sin plan asignado') + '</b>' +
        (plan && plan.precio !== undefined
          ? '<p class="mini muted">' + esc(U.dinero(plan.precio)) +
            (plan.meses > 1 ? ' · cada ' + plan.meses + ' meses' : ' al mes') + '</p>'
          : '<p class="mini muted">Pregunta en recepción por los planes disponibles.</p>') +
      '</div>' +
      '<span class="badge ' + esc(est.clase) + '">' + esc(est.texto) + '</span>' +
    '</div>';

    cuerpo += '<div class="datos-grid">' +
      dato(etiquetaDias, '<b>' + esc(valorDias) + '</b>', detalleDias) +
      dato('Meses acumulados', '<b>' + esc(String(meses)) + '</b>',
        meses === 1 ? 'Un mes con nosotros' : 'Pagados desde tu alta') +
      dato('Antigüedad', '<b>' + esc(Calc.antiguedadTexto(socio.fechaAlta)) + '</b>',
        socio.fechaAlta ? 'Alta el ' + U.fecha(socio.fechaAlta, 'corto') : 'Sin fecha de alta') +
    '</div>';

    var alerta = alertaMembresiaHTML(datos);
    if (alerta) cuerpo += '<div class="mt">' + alerta + '</div>';

    return cardHTML({
      titulo: 'Mi membresía',
      icono: 'tarjeta',
      clase: claseTarjeta,
      cuerpo: cuerpo,
      pie: botonRuta('socio/membresia', 'Ver mi membresía', 'btn-primary btn-sm btn-block', 'tarjeta')
    });
  }

  /* =============================================================
     7. Entrenamiento de hoy
     ============================================================= */

  /* Resumen de la sesión que el socio ya registró hoy. */
  function sesionHechaHTML(socio, datos, bitacora) {
    var medPeso = ultimaConDato(datos.mediciones, 'pesoKg');
    var peso = medPeso ? nPos(medPeso.pesoKg) : null;
    var volumen = Calc.volumenEntrenamiento(bitacora);
    var kcal = Calc.caloriasQuemadasAprox(bitacora, peso);
    var cuantos = lista(bitacora.ejercicios).length;
    var duracion = n0(bitacora.duracionMin);
    var esfuerzo = n0(bitacora.esfuerzo);

    var cuerpo = '<div class="aviso aviso-ok">' + icono('trofeo', 18) +
      '<div><b>¡Felicidades, hoy ya entrenaste!</b> Una sesión más cerca de tu objetivo. ' +
      'Descansa bien y regresa con todo la próxima.</div></div>';

    cuerpo += '<div class="datos-grid mt">' +
      dato('Ejercicios', '<b>' + esc(String(cuantos)) + '</b>', cuantos === 1 ? 'Registrado' : 'Registrados') +
      dato('Duración', '<b>' + esc(duracion !== null ? U.num(duracion, 0) : '—') + '</b> <span class="mini muted">min</span>',
        'Tiempo de la sesión') +
      dato('Volumen', '<b>' + esc(U.num(volumen, 0)) + '</b> <span class="mini muted">kg</span>',
        'Peso total levantado') +
      dato('Gasto estimado', '<b>' + esc(U.num(kcal, 0)) + '</b> <span class="mini muted">kcal</span>',
        esfuerzo !== null ? 'Esfuerzo percibido ' + U.num(esfuerzo, 0) + '/10' : 'Aproximado') +
    '</div>';

    if (bitacora.notas) {
      cuerpo += '<p class="mini muted mt-sm">' + icono('chat', 13) + ' ' + esc(bitacora.notas) + '</p>';
    }

    return cardHTML({
      titulo: 'Tu entrenamiento de hoy',
      icono: 'mancuerna',
      sub: 'Sesión completada · ' + U.fecha(bitacora.fecha, 'corto'),
      cuerpo: cuerpo,
      pie: '<div class="row row-sm wrap">' +
        botonRuta('socio/rutina', 'Ver mi rutina', 'btn-outline btn-sm', 'mancuerna') +
        '<button type="button" class="btn btn-ghost btn-sm" data-si-semana>' +
          icono('calendario', 15) + 'Ver semana</button>' +
      '</div>'
    });
  }

  /* Invitación a pedir rutina cuando el socio todavía no tiene una. */
  function sinRutinaHTML(datos) {
    var coach = datos.coach;
    var cuerpo;

    if (coach) {
      var wa = enlaceWhatsApp(coach.telefono,
        'Hola ' + U.nombreCompleto(coach) + ', soy socio de ' + nombreGym() +
        ' y quiero pedirte mi rutina.');

      cuerpo = vacioHTML(
        'Todavía no tienes una rutina asignada. Pídesela a tu coach ' + U.nombreCompleto(coach) +
          ' y en cuanto la cargue aparecerá aquí, día por día.',
        'mancuerna',
        '<div class="row row-sm wrap center mt">' +
          (wa
            ? '<a class="btn btn-primary btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' +
              icono('whatsapp', 15) + 'Pedirle mi rutina</a>'
            : '') +
          (coach.telefono ? pill(coach.telefono, 'telefono') : '') +
        '</div>'
      );
    } else {
      cuerpo = vacioHTML(
        'Todavía no tienes rutina ni coach asignado. Pasa a recepción para que te asignen un entrenador y armen tu plan.',
        'mancuerna',
        ''
      );
    }

    return cardHTML({ titulo: 'Tu entrenamiento de hoy', icono: 'mancuerna', cuerpo: cuerpo });
  }

  function entrenamientoHTML(socio, datos) {
    var hecha = bitacoraDeHoy(datos.bitacoras);
    if (hecha && hecha.completada !== false) return sesionHechaHTML(socio, datos, hecha);

    if (!datos.rutina) return sinRutinaHTML(datos);

    var toca = diaQueToca(datos.rutina);
    if (!toca) {
      return cardHTML({
        titulo: 'Tu entrenamiento de hoy',
        icono: 'mancuerna',
        cuerpo: vacioHTML(
          'Tu rutina «' + (datos.rutina.nombre || 'sin nombre') + '» todavía no tiene días cargados. ' +
            'Coméntaselo a tu coach para que la complete.',
          'mancuerna', '')
      });
    }

    var dia = toca.dia || {};
    var st = statsDia(dia);
    var ejercicios = lista(dia.ejercicios);

    var sub = toca.hoy
      ? 'Hoy toca: ' + (dia.nombre || 'Día ' + (toca.indice + 1))
      : 'Hoy descansas · vuelves el ' + (U.DIAS_SEMANA[toca.dow] || 'próximo día').toLowerCase();

    var cuerpo = '';

    if (!toca.hoy) {
      cuerpo += '<div class="aviso aviso-info">' + icono('sueno', 18) +
        '<div><b>Hoy toca descanso.</b> El descanso también entrena: es cuando el músculo se repara. ' +
        'Tu próxima sesión es el ' + esc((U.DIAS_SEMANA[toca.dow] || 'próximo día').toLowerCase()) + '.</div></div>' +
        '<p class="mini muted mt-sm">Este es el entrenamiento que te espera:</p>';
    }

    cuerpo += '<div class="row between wrap" style="gap:10px">' +
      '<div style="min-width:0">' +
        '<b style="font-size:15px">' + esc(dia.enfoque || dia.nombre || 'Sesión de entrenamiento') + '</b>' +
        '<p class="mini muted">' + esc(datos.rutina.nombre || 'Mi rutina') + '</p>' +
      '</div>' +
      '<div class="chips">' +
        pill(st.ejercicios + (st.ejercicios === 1 ? ' ejercicio' : ' ejercicios'), 'mancuerna') +
        pill(st.series + (st.series === 1 ? ' serie' : ' series'), 'pesa') +
        pill('≈ ' + st.minutos + ' min', 'reloj') +
      '</div>' +
    '</div>';

    if (dia.calentamiento) {
      cuerpo += '<div class="aviso aviso-warn mt-sm">' + icono('fuego', 18) +
        '<div><b>Calentamiento:</b> ' + esc(U.truncar(dia.calentamiento, 160)) + '</div></div>';
    }

    if (!ejercicios.length) {
      cuerpo += '<div class="mt">' + vacioHTML('Este día todavía no tiene ejercicios cargados.', 'mancuerna', '') + '</div>';
    } else {
      cuerpo += '<div class="stack-sm mt">';
      var tope = Math.min(4, ejercicios.length);
      for (var i = 0; i < tope; i++) {
        var ej = ejercicios[i] || {};
        var nombre = (AG.Data && typeof AG.Data.nombreEjercicio === 'function')
          ? AG.Data.nombreEjercicio(ej.ejercicioId) : 'Ejercicio';
        var series = n0(ej.series);
        var detalle = (series !== null ? U.num(series, 0) + ' × ' : '') + (ej.reps || 'reps');
        var descanso = n0(ej.descansoSeg);

        cuerpo += '<div class="si-fila">' +
          '<span class="si-fila-num">' + (i + 1) + '</span>' +
          '<span class="si-fila-txt">' +
            '<b>' + esc(nombre) + '</b>' +
            '<span>' + esc(detalle) + (descanso !== null ? ' · ' + U.num(descanso, 0) + ' s de descanso' : '') + '</span>' +
          '</span>' +
        '</div>';
      }
      cuerpo += '</div>';

      if (ejercicios.length > tope) {
        cuerpo += '<p class="mini muted mt-sm">Y ' + (ejercicios.length - tope) +
          (ejercicios.length - tope === 1 ? ' ejercicio más' : ' ejercicios más') + ' en tu rutina.</p>';
      }
    }

    return cardHTML({
      titulo: 'Tu entrenamiento de hoy',
      icono: 'mancuerna',
      sub: sub,
      clase: toca.hoy ? 'si-borde-warn' : '',
      cuerpo: cuerpo,
      pie: '<div class="row row-sm wrap">' +
        botonRuta('socio/rutina', toca.hoy ? 'Empezar entrenamiento' : 'Ver mi rutina',
          'btn-primary btn-sm', toca.hoy ? 'rayo' : 'mancuerna') +
        '<button type="button" class="btn btn-outline btn-sm" data-si-semana>' +
          icono('calendario', 15) + 'Ver semana</button>' +
      '</div>'
    });
  }

  /* =============================================================
     8. Nutrición de hoy
     ============================================================= */

  function macroFilaHTML(nombre, gramos, kcalMacro, kcalTotal, color) {
    var pct = kcalTotal > 0 ? Math.round(kcalMacro / kcalTotal * 100) : 0;
    return '<div class="si-macro">' +
      '<span class="si-macro-punto" style="background:' + color + '"></span>' +
      '<span class="si-macro-nom">' + esc(nombre) + '</span>' +
      '<span class="si-macro-val">' + esc(U.num(gramos, 0)) + ' g · ' + esc(String(pct)) + '%</span>' +
    '</div>';
  }

  function nutricionHTML(socio, datos) {
    var nut = datos.nutricion;

    if (!nut) {
      return cardHTML({
        titulo: 'Tu nutrición de hoy',
        icono: 'nutricion',
        cuerpo: vacioHTML(
          'Todavía no podemos calcular tus calorías: falta tu peso y tu estatura. ' +
            'Agenda una medición con tu coach o usa la calculadora poniendo tus datos.',
          'manzana',
          '<div class="row row-sm wrap center mt">' +
            botonRuta('socio/calculadora', 'Abrir calculadora', 'btn-primary btn-sm', 'calculadora') +
          '</div>')
      });
    }

    var kcalP = nut.proteina * 4;
    var kcalC = nut.carbos * 4;
    var kcalG = nut.grasa * 9;
    var kcalTotal = kcalP + kcalC + kcalG;

    var dona = Charts.dona([
      { etiqueta: 'Proteína', valor: kcalP, color: COLOR_PROTEINA },
      { etiqueta: 'Carbohidratos', valor: kcalC, color: COLOR_CARBOS },
      { etiqueta: 'Grasa', valor: kcalG, color: COLOR_GRASA }
    ], {
      alto: 172,
      leyenda: false,
      centroValor: U.num(nut.kcal, 0),
      centroTitulo: 'kcal al día',
      aria: 'Reparto de macronutrientes del día'
    });

    var cuerpo = '<div class="row wrap" style="gap:14px;align-items:center">' +
      '<div class="grafica" style="flex:0 0 180px;max-width:100%">' + dona + '</div>' +
      '<div class="flex1" style="min-width:170px">' +
        '<div class="si-macros">' +
          macroFilaHTML('Proteína', nut.proteina, kcalP, kcalTotal, COLOR_PROTEINA) +
          macroFilaHTML('Carbohidratos', nut.carbos, kcalC, kcalTotal, COLOR_CARBOS) +
          macroFilaHTML('Grasa', nut.grasa, kcalG, kcalTotal, COLOR_GRASA) +
        '</div>' +
        '<div class="chips mt-sm">' +
          pill(nut.agua !== null && nut.agua !== undefined ? U.num(nut.agua, 1) + ' L de agua' : 'Agua: sin dato', 'agua') +
          pill(nut.origen === 'plan' ? 'Plan de tu coach' : 'Estimado por el sistema',
            nut.origen === 'plan' ? 'nutricion' : 'calculadora') +
        '</div>' +
      '</div>' +
    '</div>';

    var prox = proximaComida(nut.comidas);
    if (prox) {
      var c = prox.comida;
      var cuando = prox.manana
        ? 'Mañana a las ' + (c.hora || '—')
        : (c.hora ? 'Hoy a las ' + c.hora : 'Sin hora definida');
      var lado = c.kcal > 0
        ? U.num(c.kcal, 0) + ' kcal'
        : (c.piezas ? c.piezas + (c.piezas === 1 ? ' alimento' : ' alimentos') : '');

      cuerpo += '<p class="mini muted mt">Tu próxima comida</p>' +
        '<div class="si-fila">' +
          '<span class="si-fila-num">' + icono('reloj', 13) + '</span>' +
          '<span class="si-fila-txt">' +
            '<b>' + esc(c.nombre) + '</b>' +
            '<span>' + esc(cuando) + '</span>' +
          '</span>' +
          (lado ? '<span class="si-fila-side">' + esc(lado) + '</span>' : '') +
        '</div>';
    } else {
      cuerpo += '<p class="mini muted mt">Tu plan todavía no tiene comidas con horario. ' +
        'Pídele a tu coach que las capture para verlas aquí.</p>';
    }

    if (nut.origen !== 'plan') {
      cuerpo += '<div class="aviso aviso-info mt-sm">' + icono('info', 18) +
        '<div>Estas cifras son una estimación con tu peso, estatura, edad y nivel de actividad. ' +
        'Tu coach puede armarte un plan a la medida.</div></div>';
    }

    return cardHTML({
      titulo: 'Tu nutrición de hoy',
      icono: 'nutricion',
      sub: U.num(nut.kcal, 0) + ' kcal objetivo',
      cuerpo: cuerpo,
      pie: '<div class="row row-sm wrap">' +
        botonRuta('socio/nutricion', 'Ver mi plan', 'btn-primary btn-sm', 'nutricion') +
        botonRuta('socio/calculadora', 'Calculadora', 'btn-outline btn-sm', 'calculadora') +
      '</div>'
    });
  }

  /* =============================================================
     9. Progreso de este mes
     ============================================================= */

  /* Los tres cambios más relevantes del comparativo. */
  function cambiosDestacados(campos) {
    var utiles = [], i;
    for (i = 0; i < campos.length; i++) {
      if (campos[i] && campos[i].delta !== null && campos[i].delta !== undefined) utiles.push(campos[i]);
    }

    function peso(campo) {
      var pos = PRIORIDAD_CAMBIOS.indexOf(campo.clave);
      var base = (pos < 0 ? PRIORIDAD_CAMBIOS.length : pos);
      var mueve = campo.tendencia !== 'igual' ? 0 : 100;   /* primero lo que sí cambió */
      return mueve + base;
    }

    utiles.sort(function (a, b) {
      var pa = peso(a), pb = peso(b);
      if (pa !== pb) return pa - pb;
      return Math.abs(Number(b.pct) || 0) - Math.abs(Number(a.pct) || 0);
    });

    return utiles.slice(0, 3);
  }

  function cambioHTML(campo) {
    var nombre = campo.delta > 0 ? 'flecha-arriba' : (campo.delta < 0 ? 'flecha-abajo' : 'flecha-der');
    var dec = campo.unidad === 'lpm' ? 0 : 1;
    return '<div class="si-cambio">' +
      '<span class="si-cambio-nom">' + esc(campo.etiqueta) + '</span>' +
      '<span class="si-cambio-val ' + claseTendencia(campo.tendencia) + '">' +
        icono(nombre, 14) + esc(U.signo(campo.delta, dec, campo.unidad)) +
      '</span>' +
    '</div>';
  }

  function progresoHTML(socio, datos) {
    var periodo = datos.periodo;
    var ini = datos.medicionInicial;
    var fin = datos.medicionFinal;

    /* --- Mes cerrado: comparativo completo --- */
    if (ini && fin) {
      var cmp = Calc.compararMediciones(ini, fin, socio.objetivo);
      if (cmp.ok && cmp.resumen) {
        var r = cmp.resumen;
        var anillo = Charts.progreso(r.puntaje, {
          alto: 132, grosor: 12, texto: String(r.puntaje), etiqueta: 'Puntaje',
          aria: 'Puntaje del mes: ' + r.puntaje + ' de 100'
        });

        var destacados = cambiosDestacados(cmp.campos);
        var listaCambios = '';
        for (var i = 0; i < destacados.length; i++) listaCambios += cambioHTML(destacados[i]);
        if (!listaCambios) listaCambios = '<p class="mini muted">Sin cambios medibles en este periodo.</p>';

        var cuerpo = '<div class="row wrap" style="gap:14px;align-items:center">' +
          '<div class="anillo" style="flex:0 0 132px">' + anillo + '</div>' +
          '<div class="flex1" style="min-width:180px">' +
            '<span class="badge ' + esc(r.clase) + '">' + esc(Calc.textoNivel(r.nivel)) + '</span>' +
            '<p class="muted mt-sm" style="font-size:13px">' + esc(r.veredicto) + '</p>' +
          '</div>' +
        '</div>' +
        '<p class="mini muted mt">Tus tres cambios principales</p>' +
        '<div class="stack-sm">' + listaCambios + '</div>';

        return cardHTML({
          titulo: 'Tu progreso de este mes',
          icono: 'grafica',
          sub: U.nombreMes(periodo) + ' · ' + cmp.dias + (cmp.dias === 1 ? ' día medido' : ' días medidos'),
          cuerpo: cuerpo,
          pie: botonRuta('socio/progreso', 'Ver detalle', 'btn-primary btn-sm btn-block', 'grafica')
        });
      }
    }

    /* --- Solo medición inicial: el mes sigue abierto --- */
    if (ini) {
      var imcIni = n0(ini.imc);
      if (imcIni === null) imcIni = Calc.imc(ini.pesoKg, ini.estaturaCm || socio.estaturaCm);
      var cintura = valorPorRuta(ini, 'medidas.cintura');

      var cuerpoIni = '<div class="aviso aviso-info">' + icono('reloj', 18) +
        '<div><b>Tu coach cerrará el mes.</b> Al final de ' + esc(U.nombreMes(periodo)) +
        ' te vuelve a medir y el sistema arma solo tu comparativo.</div></div>' +
        '<p class="mini muted mt">Con lo que arrancaste el mes</p>' +
        '<div class="datos-grid">' +
          dato('Peso', '<b>' + esc(n0(ini.pesoKg) !== null ? U.num(ini.pesoKg, 1) : '—') + '</b> <span class="mini muted">kg</span>',
            'Medido el ' + U.fecha(ini.fecha, 'corto')) +
          dato('Grasa', '<b>' + esc(n0(ini.grasaPct) !== null ? U.num(ini.grasaPct, 1) : '—') + '</b> <span class="mini muted">%</span>',
            'Composición corporal') +
          dato('Músculo', '<b>' + esc(n0(ini.musculoKg) !== null ? U.num(ini.musculoKg, 1) : '—') + '</b> <span class="mini muted">kg</span>',
            'Masa muscular') +
          dato('Cintura', '<b>' + esc(cintura !== null ? U.num(cintura, 1) : '—') + '</b> <span class="mini muted">cm</span>',
            'Perímetro abdominal') +
          dato('IMC', '<b>' + esc(imcIni !== null ? U.num(imcIni, 1) : '—') + '</b>',
            imcIni !== null ? Calc.clasificacionIMC(imcIni).texto : 'Falta peso o estatura') +
        '</div>';

      return cardHTML({
        titulo: 'Tu progreso de este mes',
        icono: 'grafica',
        sub: U.nombreMes(periodo) + ' · medición inicial lista',
        cuerpo: cuerpoIni,
        pie: botonRuta('socio/progreso', 'Ver mi historial', 'btn-outline btn-sm btn-block', 'historial')
      });
    }

    /* --- Sin mediciones del mes --- */
    var coach = datos.coach;
    var waMedicion = coach
      ? enlaceWhatsApp(coach.telefono,
          'Hola ' + U.nombreCompleto(coach) + ', quiero agendar mi medición de ' + U.nombreMes(periodo) + '.')
      : '';

    var accion = '<div class="row row-sm wrap center mt">' +
      (waMedicion
        ? '<a class="btn btn-primary btn-sm" href="' + esc(waMedicion) + '" target="_blank" rel="noopener noreferrer">' +
          icono('whatsapp', 15) + 'Agendar mi medición</a>'
        : '') +
      botonRuta('socio/progreso', 'Ver mi historial', 'btn-outline btn-sm', 'historial') +
    '</div>';

    return cardHTML({
      titulo: 'Tu progreso de este mes',
      icono: 'grafica',
      sub: U.nombreMes(periodo),
      cuerpo: vacioHTML(
        'Aún no tienes mediciones de este mes. Agenda tu medición' +
          (coach ? ' con ' + U.nombreCompleto(coach) : ' con tu coach') +
          ': es la forma de ver tu avance real, no solo el número de la báscula.',
        'regla', accion)
    });
  }

  /* =============================================================
     10. Mini métricas con sparkline
     ============================================================= */

  function metricaHTML(etiqueta, valorHTML, pie, valores, color) {
    var chart = '';
    if (valores && valores.length >= 2) {
      chart = '<div class="grafica si-met-chart">' +
        Charts.sparkline(valores, { alto: 38, color: color || 'var(--chart-1,#E4322B)', aria: etiqueta }) +
      '</div>';
    }
    return '<div class="si-metrica">' +
      '<span class="si-met-lbl">' + esc(etiqueta) + '</span>' +
      '<span class="si-met-val">' + valorHTML + '</span>' +
      '<span class="si-met-pie">' + esc(pie || '') + '</span>' +
      chart +
    '</div>';
  }

  function metricasHTML(socio, datos) {
    var med = datos.mediciones;

    /* Peso */
    var serPeso = serieDe(med, 'pesoKg', 8);
    var ultPeso = serPeso.length ? serPeso[serPeso.length - 1].y : null;
    var htmlPeso = ultPeso !== null
      ? '<b>' + esc(U.num(ultPeso, 1)) + '</b> <i>kg</i>'
      : '<b>—</b>';
    var piePeso = 'Sin mediciones';
    if (serPeso.length >= 2) {
      var deltaPeso = ultPeso - serPeso[0].y;
      piePeso = U.signo(deltaPeso, 1, 'kg') + ' desde ' + U.fecha(serPeso[0].x, 'diaMes');
    } else if (serPeso.length === 1) {
      piePeso = 'Medido el ' + U.fecha(serPeso[0].x, 'diaMes');
    }

    /* Grasa */
    var serGrasa = serieDe(med, 'grasaPct', 8);
    var ultGrasa = serGrasa.length ? serGrasa[serGrasa.length - 1].y : null;
    var htmlGrasa = ultGrasa !== null
      ? '<b>' + esc(U.num(ultGrasa, 1)) + '</b> <i>%</i>'
      : '<b>—</b>';
    var pieGrasa = 'Sin mediciones';
    if (serGrasa.length >= 2) {
      pieGrasa = U.signo(ultGrasa - serGrasa[0].y, 1, 'puntos') + ' desde el inicio';
    } else if (serGrasa.length === 1) {
      pieGrasa = 'Medida el ' + U.fecha(serGrasa[0].x, 'diaMes');
    }

    /* IMC */
    var estatura = nPos(socio.estaturaCm);
    var serImc = [], i;
    for (i = 0; i < med.length; i++) {
      var p = nPos(med[i].pesoKg);
      var e = nPos(med[i].estaturaCm) || estatura;
      var v = n0(med[i].imc);
      if (v === null) v = Calc.imc(p, e);
      if (v === null) continue;
      serImc.push({ x: med[i].fecha, etiqueta: U.fecha(med[i].fecha, 'diaMes'), y: v });
    }
    if (serImc.length > 8) serImc = serImc.slice(serImc.length - 8);
    var ultImc = serImc.length ? serImc[serImc.length - 1].y : null;
    var clasImc = ultImc !== null ? Calc.clasificacionIMC(ultImc) : null;
    var htmlImc = ultImc !== null ? '<b>' + esc(U.num(ultImc, 1)) + '</b>' : '<b>—</b>';
    var pieImc = clasImc ? clasImc.texto : 'Falta peso o estatura';

    /* Asistencias del mes */
    var meses = ultimosMeses(6);
    var conteoMes = {}, j;
    for (j = 0; j < datos.asistencias.length; j++) {
      var mes = String(datos.asistencias[j].fecha || '').slice(0, 7);
      if (!mes) continue;
      conteoMes[mes] = (conteoMes[mes] || 0) + 1;
    }
    var serAsist = [];
    for (j = 0; j < meses.length; j++) {
      serAsist.push({ x: meses[j], etiqueta: U.nombreMes(meses[j]), y: conteoMes[meses[j]] || 0 });
    }
    var visitasMes = conteoMes[datos.periodo] || 0;
    var htmlAsist = '<b>' + esc(String(visitasMes)) + '</b> <i>visitas</i>';
    var pieAsist = visitasMes > 0
      ? 'En ' + U.nombreMes(datos.periodo)
      : 'Todavía sin visitas este mes';

    /* Adherencia al plan */
    var diasPorSemana = datos.rutina ? (n0(datos.rutina.diasPorSemana) || 3) : 3;
    var desdeMes = datos.periodo + '-01';
    var adh = Calc.adherencia(datos.bitacoras, desdeMes, U.hoy(), diasPorSemana);
    var semanas = ultimasSemanas(8);
    var serAdh = [];
    for (j = 0; j < semanas.length; j++) {
      var cuantas = 0;
      for (i = 0; i < datos.bitacoras.length; i++) {
        var f = String(datos.bitacoras[i].fecha || '').slice(0, 10);
        if (!f || datos.bitacoras[i].completada === false) continue;
        if (f >= semanas[j].desde && f <= semanas[j].hasta) cuantas++;
      }
      serAdh.push({ x: semanas[j].hasta, etiqueta: U.fecha(semanas[j].hasta, 'diaMes'), y: cuantas });
    }
    var htmlAdh = '<b>' + esc(String(adh.pct)) + '</b> <i>%</i>';
    var pieAdh = adh.hechas + ' de ' + adh.esperadas + ' sesiones del mes';

    var cuerpo = '<div class="si-metricas">' +
      metricaHTML('Peso actual', htmlPeso, piePeso, serPeso, 'var(--chart-1,#E4322B)') +
      metricaHTML('Grasa corporal', htmlGrasa, pieGrasa, serGrasa, 'var(--chart-4,#F59E0B)') +
      metricaHTML('IMC', htmlImc, pieImc, serImc, 'var(--chart-2,#3B82F6)') +
      metricaHTML('Asistencias', htmlAsist, pieAsist, serAsist, 'var(--chart-3,#22C55E)') +
      metricaHTML('Adherencia', htmlAdh, pieAdh, serAdh, 'var(--chart-5,#A855F7)') +
    '</div>';

    if (!med.length && !datos.asistencias.length && !datos.bitacoras.length) {
      cuerpo = vacioHTML(
        'Todavía no hay historial que graficar. En cuanto empieces a entrenar y te midan, ' +
          'aquí verás tu evolución de un vistazo.',
        'grafica', '');
    }

    return cardHTML({
      titulo: 'Mis números',
      icono: 'balanza',
      sub: 'Tu evolución de un vistazo',
      cuerpo: cuerpo
    });
  }

  /* =============================================================
     11. Avisos, próxima clase, coach y accesos rápidos
     ============================================================= */

  function avisosHTML(usuario) {
    var cuerpo = vacioHTML('No hay avisos publicados por ahora. Aquí aparecerán las novedades del gimnasio.', 'campana', '');

    if (AG.Mod && AG.Mod.Avisos && typeof AG.Mod.Avisos.tarjetas === 'function') {
      cuerpo = reusar(function () { return AG.Mod.Avisos.tarjetas(usuario, 3); }, cuerpo);
    }

    return cardHTML({
      titulo: 'Avisos del gimnasio',
      icono: 'campana',
      sub: nombreGym(),
      cuerpo: cuerpo
    });
  }

  function claseHTML(usuario) {
    var prox = null;
    if (AG.Mod && AG.Mod.Clases && typeof AG.Mod.Clases.proximaDe === 'function') {
      try { prox = AG.Mod.Clases.proximaDe(usuario); } catch (e) { prox = null; }
    }

    if (!prox || !prox.vista) {
      return cardHTML({
        titulo: 'Mi próxima clase',
        icono: 'clase',
        cuerpo: vacioHTML(
          'No estás inscrito en ninguna clase. Revisa el horario y apúntate: entrenar acompañado motiva más.',
          'clase',
          '<div class="row center mt">' + botonRuta('socio/clases', 'Ver el horario', 'btn-primary btn-sm', 'calendario') + '</div>')
      });
    }

    var v = prox.vista;
    var coachClase = v.coachId ? AG.DB.usuario(v.coachId) : null;
    var detalle = [];
    if (prox.dia) detalle.push(prox.dia);
    if (prox.hora) detalle.push(prox.hora);
    if (v.salon) detalle.push(v.salon);
    if (coachClase) detalle.push('Coach ' + U.nombreCompleto(coachClase));

    var cuerpo = '<div class="row row-sm" style="min-width:0">' +
      '<span class="si-punto" style="background:' + esc(v.color || 'var(--rojo)') + '"></span>' +
      '<span class="persona-txt">' +
        '<b>' + esc(v.nombre) + '</b>' +
        '<span>' + esc(detalle.join(' · ')) + '</span>' +
      '</span>' +
    '</div>' +
    '<div class="chips mt-sm">' +
      pill(prox.cuando, prox.enCurso ? 'rayo' : 'reloj', prox.enCurso ? 'pill-rojo' : '') +
      pill(v.ocupados + ' de ' + (v.cupo || '—') + ' lugares', 'socios') +
    '</div>';

    return cardHTML({
      titulo: 'Mi próxima clase',
      icono: 'clase',
      cuerpo: cuerpo,
      pie: '<div class="row row-sm wrap">' +
        '<button type="button" class="btn btn-outline btn-sm" data-si-clase="' + esc(v.id) + '">' +
          icono('ojo', 15) + 'Ver detalle</button>' +
        botonRuta('socio/clases', 'Mis clases', 'btn-ghost btn-sm', 'calendario') +
      '</div>'
    });
  }

  function coachHTML(socio, datos) {
    var coach = datos.coach;

    if (!coach) {
      return cardHTML({
        titulo: 'Mi coach',
        icono: 'coach',
        cuerpo: vacioHTML(
          'Todavía no tienes coach asignado. Pasa a recepción para que te asignen uno y empiece a armar tu plan.',
          'coach', '')
      });
    }

    var estrellas = reusar(function () {
      return AG.Mod.Calificaciones.resumen('coach', coach.id);
    }, '<span class="mini muted">Sin reseñas todavía</span>');

    var wa = enlaceWhatsApp(coach.telefono,
      'Hola ' + U.nombreCompleto(coach) + ', soy ' + U.nombreCompleto(socio) +
      ' de ' + nombreGym() + '.');

    var cuerpo = '<div class="persona">' +
      U.avatar(coach, 'lg') +
      '<div class="persona-txt">' +
        '<b>' + esc(U.nombreCompleto(coach)) + '</b>' +
        '<span>' + esc(coach.especialidad || 'Entrenador personal') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="mt-sm">' + estrellas + '</div>';

    if (coach.horario) {
      cuerpo += '<div class="chips mt-sm">' + pill(coach.horario, 'reloj') + '</div>';
    }

    var acciones = '<div class="row row-sm wrap">';
    if (wa) {
      acciones += '<a class="btn btn-primary btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' +
        icono('whatsapp', 15) + 'WhatsApp</a>';
    } else {
      acciones += '<span class="mini muted">Sin teléfono registrado</span>';
    }
    acciones += '<button type="button" class="btn btn-outline btn-sm" data-si-calificar="' + esc(coach.id) + '">' +
      icono('estrella', 15) + 'Calificar</button>';
    acciones += '</div>';

    return cardHTML({
      titulo: 'Mi coach',
      icono: 'coach',
      cuerpo: cuerpo,
      pie: acciones
    });
  }

  function accesosHTML() {
    var html = '<div class="si-accesos">';
    for (var i = 0; i < ACCESOS.length; i++) {
      var a = ACCESOS[i];
      html += '<a class="si-acceso" href="#/' + esc(a.path) + '">' +
        icono(a.icono, 22) + '<span>' + esc(a.etiqueta) + '</span></a>';
    }
    return cardHTML({
      titulo: 'Accesos rápidos',
      icono: 'rayo',
      cuerpo: html + '</div>'
    });
  }

  /* =============================================================
     12. Modal: mi semana de entrenamiento
     ============================================================= */

  function abrirSemana(socio) {
    var activa = AG.DB.rutinaActivaDe(socio.id);
    if (!activa || !activa.rutina) {
      U.toast('Todavía no tienes una rutina asignada.', 'warn');
      return;
    }

    var toca = diaQueToca(activa.rutina);
    if (!toca) {
      U.toast('Tu rutina todavía no tiene días cargados.', 'warn');
      return;
    }

    /* Índice de día de rutina por día de la semana. */
    var porDow = {}, i;
    for (i = 0; i < toca.semana.length; i++) porDow[toca.semana[i].dow] = toca.semana[i].indice;

    var hoyDow = new Date().getDay();
    /* La rejilla arranca en lunes, como se lee una semana en México. */
    var orden = [1, 2, 3, 4, 5, 6, 0];
    var html = '<div class="stack-sm">';

    for (i = 0; i < orden.length; i++) {
      var dow = orden[i];
      var indice = porDow[dow];
      var esHoy = (dow === hoyDow);
      var nombreDia = U.DIAS_SEMANA[dow] || 'Día';

      if (indice === undefined) {
        html += '<div class="si-dia' + (esHoy ? ' si-dia-hoy' : '') + '">' +
          '<span class="si-dia-nom">' + esc(nombreDia) + '</span>' +
          '<span class="si-dia-txt"><b>Descanso</b><span>Recuperación activa: camina, estira e hidrátate.</span></span>' +
          (esHoy ? '<span class="badge badge-rojo">Hoy</span>' : '') +
        '</div>';
        continue;
      }

      var dia = toca.dias[indice] || {};
      var st = statsDia(dia);
      html += '<div class="si-dia' + (esHoy ? ' si-dia-hoy' : '') + '">' +
        '<span class="si-dia-nom">' + esc(nombreDia) + '</span>' +
        '<span class="si-dia-txt">' +
          '<b>' + esc(dia.enfoque || dia.nombre || ('Día ' + (indice + 1))) + '</b>' +
          '<span>' + esc(st.ejercicios + (st.ejercicios === 1 ? ' ejercicio' : ' ejercicios') +
            ' · ' + st.series + (st.series === 1 ? ' serie' : ' series') +
            ' · ≈ ' + st.minutos + ' min') + '</span>' +
        '</span>' +
        (esHoy ? '<span class="badge badge-rojo">Hoy</span>' : '') +
      '</div>';
    }

    html += '</div>' +
      '<p class="mini muted mt">Rutina «' + esc(activa.rutina.nombre || 'Sin nombre') + '» · ' +
      esc(String(toca.semana.length)) + ' días por semana.</p>';

    U.modal({
      titulo: 'Mi semana de entrenamiento',
      ancho: 'lg',
      cuerpo: html,
      acciones: [
        { texto: 'Cerrar', clase: 'btn-ghost' },
        {
          texto: 'Ir a mi rutina',
          clase: 'btn-primary',
          onClick: function (api) { api.cerrar(); AG.Router.ir('socio/rutina'); }
        }
      ]
    });
  }

  /* =============================================================
     13. Vista y eventos
     ============================================================= */

  function pantallaSinSocio(mensaje) {
    return '<div class="page">' +
      cardHTML({ cuerpo: vacioHTML(mensaje, 'usuario', '') }) +
    '</div>';
  }

  function render(ctx) {
    asegurarEstilos();

    var usuario = ctx && ctx.usuario ? ctx.usuario : null;
    if (!usuario) {
      return pantallaSinSocio('No pudimos leer tu sesión. Vuelve a iniciar sesión para ver tu panel.');
    }
    /* Control de acceso real: este panel es solo del socio y solo con sus datos. */
    if (usuario.rol !== 'socio') {
      return pantallaSinSocio('Este panel es exclusivo de los socios. Usa el menú para ir a tu propia sección.');
    }

    var socio = AG.DB.usuario(usuario.id) || usuario;
    var datos;
    try { datos = reunirDatos(socio); }
    catch (e) {
      return pantallaSinSocio('No pudimos preparar tu panel en este momento. Intenta recargar la página.');
    }

    var html = '<div class="page" data-socio-inicio>' +
      heroHTML(socio, datos) +
      '<div class="grid g2">' +
        '<div class="stack">' +
          entrenamientoHTML(socio, datos) +
          nutricionHTML(socio, datos) +
        '</div>' +
        '<div class="stack">' +
          membresiaHTML(socio, datos) +
          progresoHTML(socio, datos) +
          claseHTML(usuario) +
          coachHTML(socio, datos) +
        '</div>' +
      '</div>' +
      metricasHTML(socio, datos) +
      '<div class="grid g2">' +
        avisosHTML(usuario) +
        accesosHTML() +
      '</div>' +
    '</div>';

    return {
      html: html,
      listo: function (root) { enganchar(root); }
    };
  }

  /*
     El router reutiliza el mismo contenedor #vista entre navegaciones,
     así que la delegación se engancha una sola vez y siempre relee al
     socio de la sesión (nunca se queda con una copia vieja).
  */
  function enganchar(raiz) {
    if (!raiz || raiz.__siInicioEnganchado) return;
    raiz.__siInicioEnganchado = true;

    /* Ver la semana completa de entrenamiento. */
    U.delegar(raiz, 'click', '[data-si-semana]', function (e) {
      e.preventDefault();
      var socio = socioActual();
      if (!socio) { U.toast('Vuelve a iniciar sesión para ver tu semana.', 'warn'); return; }
      abrirSemana(socio);
    });

    /* Detalle de la próxima clase (lo abre el módulo de clases). */
    U.delegar(raiz, 'click', '[data-si-clase]', function (e, el) {
      e.preventDefault();
      var id = el.getAttribute('data-si-clase');
      if (AG.Mod && AG.Mod.Clases && typeof AG.Mod.Clases.abrir === 'function') {
        try { AG.Mod.Clases.abrir(id); return; }
        catch (err) { /* si el modal falla, se manda al horario */ }
      }
      AG.Router.ir('socio/clases');
    });

    /* Calificar al coach sin salir del panel. */
    U.delegar(raiz, 'click', '[data-si-calificar]', function (e, el) {
      e.preventDefault();
      var socio = socioActual();
      if (!socio) { U.toast('Vuelve a iniciar sesión para calificar.', 'warn'); return; }

      var coachId = el.getAttribute('data-si-calificar');
      if (AG.Mod && AG.Mod.Calificaciones && typeof AG.Mod.Calificaciones.formulario === 'function') {
        try {
          AG.Mod.Calificaciones.formulario('coach', coachId, socio.id, {
            alGuardar: function () { AG.Router.refrescar(); }
          });
          return;
        } catch (err) { /* si el modal falla, se usa la pantalla dedicada */ }
      }
      AG.Router.ir('socio/calificar');
    });
  }

  /* =============================================================
     14. Exposición y registro de la ruta
     ============================================================= */

  AG.Views.SocioInicio = {
    render: render,
    abrirSemana: abrirSemana,
    diaQueToca: diaQueToca
  };

  AG.Router.registrar({
    path: 'socio/inicio',
    roles: ['socio'],
    titulo: 'Mi panel',
    nav: { etiqueta: 'Inicio', icono: 'inicio', grupo: 'Principal', orden: 1 },
    render: render
  });
})(window.AG);
