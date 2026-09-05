/* =============================================================
   ALLIANCE GYM — Capa de persistencia (AG.DB)
   Único archivo, junto con auth.js, autorizado a tocar localStorage.
   Guarda TODO el sistema bajo la llave 'alliance_gym_db_v1'.

   Principios:
   - Nunca lanza: si localStorage está lleno o bloqueado (file:// en algunos
     navegadores) la app sigue trabajando en memoria.
   - Migración defensiva: al cargar se fusiona lo guardado con la estructura
     vacía, así una base vieja jamás rompe la app por una colección faltante.
   - AG.DB.state es SIEMPRE el mismo objeto vivo: importar o reiniciar lo
     rellenan por dentro, nunca lo reemplazan por otra referencia.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  /* =============================================================
     Constantes
     ============================================================= */
  var LLAVE = 'alliance_gym_db_v1';
  var LLAVE_CORRUPTO = 'alliance_gym_db_v1_corrupto';
  var VERSION = 1;
  var MS_POR_DIA = 24 * 60 * 60 * 1000;

  /* Todas las colecciones del contrato, en orden de documentación. */
  var COLECCIONES = [
    'planes', 'usuarios', 'pagos', 'mediciones', 'rutinas', 'asignaciones',
    'bitacoras', 'planesNutricion', 'calificaciones', 'asistencias',
    'avisos', 'clases', 'notificaciones'
  ];

  /* Prefijo de id por colección. */
  var PREFIJOS = {
    planes: 'pl_',
    usuarios: 'u_',
    pagos: 'pg_',
    mediciones: 'm_',
    rutinas: 'r_',
    asignaciones: 'as_',
    bitacoras: 'bt_',
    planesNutricion: 'nu_',
    calificaciones: 'cf_',
    asistencias: 'at_',
    avisos: 'av_',
    clases: 'cl_',
    notificaciones: 'nt_'
  };

  /* =============================================================
     Estado interno del módulo
     ============================================================= */
  var oyentes = {};                 // { evento: [fn] }
  var contadorId = 0;               // desempate para ids generados en el mismo milisegundo
  var avisoCorrupto = false;        // el aviso de base corrupta se da una sola vez
  var avisoEscritura = false;       // el aviso de "no se puede guardar" se da una sola vez
  var almacenOk = true;             // ¿la última escritura funcionó?

  /* =============================================================
     Utilidades internas (con respaldo propio por si AG.Utils falta)
     ============================================================= */

  function esObjeto(v) {
    return !!v && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Array]';
  }

  function esArreglo(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function rellenar(n, largo) {
    var s = String(n);
    while (s.length < largo) s = '0' + s;
    return s;
  }

  /** Fecha local en formato 'YYYY-MM-DD' (nunca UTC, para no perder el día). */
  function hoy() {
    if (AG.Utils && typeof AG.Utils.hoy === 'function') {
      try {
        var v = AG.Utils.hoy();
        if (typeof v === 'string' && v.length >= 10) return v.slice(0, 10);
      } catch (e) { /* se usa el respaldo */ }
    }
    var d = new Date();
    return d.getFullYear() + '-' + rellenar(d.getMonth() + 1, 2) + '-' + rellenar(d.getDate(), 2);
  }

  /** Marca de tiempo ISO completa. */
  function ahora() {
    if (AG.Utils && typeof AG.Utils.ahora === 'function') {
      try {
        var v = AG.Utils.ahora();
        if (typeof v === 'string' && v) return v;
      } catch (e) { /* se usa el respaldo */ }
    }
    return new Date().toISOString();
  }

  /** '2026-09-05' -> '2026-09' */
  function mesDe(fecha) {
    var f = fechaValida(fecha);
    return f ? f.slice(0, 7) : '';
  }

  /** Devuelve 'YYYY-MM-DD' si el valor tiene esa forma; si no, cadena vacía. */
  function fechaValida(valor) {
    if (typeof valor !== 'string') return '';
    var f = valor.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : '';
  }

  /** Convierte 'YYYY-MM-DD' a Date local (mediodía, para esquivar husos). */
  function aFecha(texto) {
    var f = fechaValida(texto);
    if (!f) return null;
    var p = f.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function deFecha(d) {
    return d.getFullYear() + '-' + rellenar(d.getMonth() + 1, 2) + '-' + rellenar(d.getDate(), 2);
  }

  /** Suma días a 'YYYY-MM-DD'. Si la fecha es inválida, devuelve cadena vacía. */
  function sumaDias(fecha, n) {
    var d = aFecha(fecha);
    if (!d) return '';
    d.setDate(d.getDate() + (Number(n) || 0));
    return deFecha(d);
  }

  /** Suma meses a 'YYYY-MM-DD' recortando el día si el mes destino es más corto. */
  function sumaMeses(fecha, n) {
    var d = aFecha(fecha);
    if (!d) return '';
    var meses = Number(n) || 0;
    var dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + meses);
    var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return deFecha(d);
  }

  /** Días completos de 'a' a 'b' (positivo si 'b' es posterior). */
  function diasEntre(a, b) {
    var da = aFecha(a), db = aFecha(b);
    if (!da || !db) return 0;
    return Math.round((db.getTime() - da.getTime()) / MS_POR_DIA);
  }

  function entero(valor, porDefecto) {
    var n = parseInt(valor, 10);
    return isFinite(n) ? n : porDefecto;
  }

  function numero(valor, porDefecto) {
    var n = Number(valor);
    return isFinite(n) ? n : porDefecto;
  }

  function texto(valor, porDefecto) {
    return typeof valor === 'string' && valor !== '' ? valor : porDefecto;
  }

  /** Aviso visual tolerante: si AG.Utils.toast aún no existe, no pasa nada. */
  function avisar(mensaje, tipo) {
    if (AG.Utils && typeof AG.Utils.toast === 'function') {
      try { AG.Utils.toast(mensaje, tipo || 'info'); } catch (e) { /* sin ruido */ }
    }
  }

  function clonar(valor) {
    try { return JSON.parse(JSON.stringify(valor)); } catch (e) { return null; }
  }

  /* ---------- Acceso tolerante a localStorage ---------- */

  function leerCrudo() {
    try { return window.localStorage.getItem(LLAVE); } catch (e) { return null; }
  }

  function escribirCrudo(contenido) {
    try { window.localStorage.setItem(LLAVE, contenido); return true; } catch (e) { return false; }
  }

  function borrarCrudo() {
    try { window.localStorage.removeItem(LLAVE); return true; } catch (e) { return false; }
  }

  /** Guarda una copia del JSON ilegible y limpia la llave principal. */
  function respaldarCorrupto(crudo) {
    try { window.localStorage.setItem(LLAVE_CORRUPTO, crudo); } catch (e) { /* sin espacio: se descarta */ }
    borrarCrudo();
    if (!avisoCorrupto) {
      avisoCorrupto = true;
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn(
          'Alliance Gym: la base guardada estaba dañada. Se respaldó en "' +
          LLAVE_CORRUPTO + '" y se arrancó con datos limpios.'
        );
      }
    }
  }

  /* ---------- Generación de ids ---------- */

  function prefijoDe(coleccion) {
    return PREFIJOS[coleccion] || 'x_';
  }

  /** Id con el prefijo correcto; usa AG.Utils.uid y corrige si hiciera falta. */
  function idAleatorio(prefijo) {
    var pre = String(prefijo || 'x_');
    if (pre.charAt(pre.length - 1) !== '_') pre += '_';
    var id = '';
    if (AG.Utils && typeof AG.Utils.uid === 'function') {
      try { id = String(AG.Utils.uid(pre.slice(0, -1)) || ''); } catch (e) { id = ''; }
    }
    if (!id || id.indexOf(pre) !== 0) {
      id = pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    return id;
  }

  function existeId(lista, id) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].id === id) return true;
    }
    return false;
  }

  /** Id garantizado único dentro de la colección. */
  function idUnico(lista, coleccion) {
    var pre = prefijoDe(coleccion);
    var id = idAleatorio(pre);
    var intentos = 0;
    while (existeId(lista, id) && intentos < 25) {
      contadorId++;
      id = idAleatorio(pre) + contadorId.toString(36);
      intentos++;
    }
    return id;
  }

  /* =============================================================
     Estructura vacía y migración defensiva
     ============================================================= */

  /** Settings por defecto del gimnasio. */
  function settingsPorDefecto() {
    return {
      nombreGym: 'ALLIANCE GYM',
      lema: 'Más fuertes juntos',
      moneda: 'MXN',
      simbolo: '$',
      locale: 'es-MX',
      direccion: 'Av. Vallarta 1250, Col. Americana, Guadalajara, Jal.',
      telefono: '33 1234 5678',
      email: 'contacto@alliancegym.mx',
      horario: 'Lun a Vie 5:00–23:00 · Sáb 7:00–17:00 · Dom 8:00–14:00',
      tema: 'oscuro',
      diasGraciaPago: 5,
      metaSociosMes: 20,
      metaIngresoMensual: 120000,
      costoFijoMensual: 45000
    };
  }

  /**
   * Estructura completa y vacía del sistema.
   * @returns {Object} state limpio con todas las colecciones del contrato
   */
  function estructuraVacia() {
    var marca = ahora();
    var base = {
      meta: { version: VERSION, creado: marca, actualizado: marca, folioPago: 1 },
      settings: settingsPorDefecto()
    };
    for (var i = 0; i < COLECCIONES.length; i++) base[COLECCIONES[i]] = [];
    return base;
  }

  /** Copia 'base' y encima lo definido en 'extra' (sin perder llaves nuevas). */
  function fusionarObjeto(base, extra) {
    var salida = {}, k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) salida[k] = base[k];
    }
    if (esObjeto(extra)) {
      for (k in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, k)) continue;
        if (extra[k] === undefined || extra[k] === null) continue;
        salida[k] = extra[k];
      }
    }
    return salida;
  }

  /** Deja la colección limpia: solo objetos y todos con id. */
  function normalizarColeccion(valor, coleccion) {
    if (!esArreglo(valor)) return [];
    var salida = [];
    for (var i = 0; i < valor.length; i++) {
      var item = valor[i];
      if (!esObjeto(item)) continue;
      if (typeof item.id !== 'string' || !item.id) item.id = idUnico(salida, coleccion);
      salida.push(item);
    }
    return salida;
  }

  function normalizarMeta(meta) {
    var m = fusionarObjeto({ version: VERSION, creado: ahora(), actualizado: ahora(), folioPago: 1 }, meta);
    m.version = VERSION;
    m.creado = texto(m.creado, ahora());
    m.actualizado = texto(m.actualizado, ahora());
    m.folioPago = Math.max(1, entero(m.folioPago, 1));
    return m;
  }

  function normalizarSettings(settings) {
    var s = fusionarObjeto(settingsPorDefecto(), settings);
    var d = settingsPorDefecto();
    s.nombreGym = texto(s.nombreGym, d.nombreGym);
    s.moneda = texto(s.moneda, d.moneda);
    s.simbolo = texto(s.simbolo, d.simbolo);
    s.locale = texto(s.locale, d.locale);
    s.tema = (s.tema === 'claro' || s.tema === 'oscuro') ? s.tema : d.tema;
    s.diasGraciaPago = Math.max(0, entero(s.diasGraciaPago, d.diasGraciaPago));
    s.metaSociosMes = Math.max(0, numero(s.metaSociosMes, d.metaSociosMes));
    s.metaIngresoMensual = Math.max(0, numero(s.metaIngresoMensual, d.metaIngresoMensual));
    s.costoFijoMensual = Math.max(0, numero(s.costoFijoMensual, d.costoFijoMensual));
    return s;
  }

  /**
   * Fusiona lo guardado (o lo sembrado) con la estructura vacía.
   * Garantiza que TODAS las colecciones existan aunque la base sea antigua.
   */
  function fusionarEstado(guardado) {
    var base = estructuraVacia();
    if (!esObjeto(guardado)) return base;

    base.meta = normalizarMeta(guardado.meta);
    base.settings = normalizarSettings(guardado.settings);

    for (var i = 0; i < COLECCIONES.length; i++) {
      var nombre = COLECCIONES[i];
      base[nombre] = normalizarColeccion(guardado[nombre], nombre);
    }
    return base;
  }

  /** Rellena AG.DB.state por dentro para conservar la misma referencia viva. */
  function reemplazarEstado(nuevo) {
    var actual = DB.state, k;
    for (k in actual) {
      if (Object.prototype.hasOwnProperty.call(actual, k)) delete actual[k];
    }
    for (k in nuevo) {
      if (Object.prototype.hasOwnProperty.call(nuevo, k)) actual[k] = nuevo[k];
    }
    return actual;
  }

  /* =============================================================
     API pública
     ============================================================= */
  var DB = {};

  DB.LLAVE = LLAVE;
  DB.LLAVE_CORRUPTO = LLAVE_CORRUPTO;
  DB.VERSION = VERSION;
  DB.COLECCIONES = COLECCIONES.slice();

  /** Objeto vivo con todos los datos del sistema. */
  DB.state = estructuraVacia();

  /* ---------- Eventos ---------- */

  /**
   * Escucha un evento de la base ('cambio').
   * @returns {Function} función para dejar de escuchar
   */
  DB.on = function (evento, fn) {
    if (typeof evento !== 'string' || typeof fn !== 'function') return function () {};
    if (!oyentes[evento]) oyentes[evento] = [];
    oyentes[evento].push(fn);
    return function () { DB.off(evento, fn); };
  };

  /** Quita un oyente registrado con on(). */
  DB.off = function (evento, fn) {
    var lista = oyentes[evento];
    if (!lista) return;
    var i = lista.indexOf(fn);
    if (i >= 0) lista.splice(i, 1);
  };

  /** Avisa a los oyentes; un oyente con error nunca tumba a los demás. */
  DB.emitir = function (evento, datos) {
    var lista = oyentes[evento];
    if (!lista || !lista.length) return;
    var copia = lista.slice();
    for (var i = 0; i < copia.length; i++) {
      try { copia[i](datos); } catch (e) { /* un oyente roto no detiene la app */ }
    }
  };

  /* ---------- Carga y guardado ---------- */

  /**
   * Lee localStorage y deja AG.DB.state listo.
   * Si el JSON está dañado hace respaldo y arranca limpio.
   * @returns {Object} state
   */
  DB.cargar = function () {
    var crudo = leerCrudo();

    if (!crudo) {
      reemplazarEstado(estructuraVacia());
      return DB.state;
    }

    var datos = null;
    try { datos = JSON.parse(crudo); } catch (e) { datos = null; }

    if (!esObjeto(datos)) {
      respaldarCorrupto(crudo);
      reemplazarEstado(estructuraVacia());
      return DB.state;
    }

    reemplazarEstado(fusionarEstado(datos));
    return DB.state;
  };

  /**
   * Persiste el estado, actualiza meta.actualizado y emite 'cambio'.
   * Si el almacenamiento falla, la app sigue trabajando en memoria.
   * @returns {Boolean} true si se escribió en disco
   */
  DB.guardar = function () {
    if (!esObjeto(DB.state.meta)) DB.state.meta = normalizarMeta(null);
    DB.state.meta.actualizado = ahora();

    var serializado = null;
    try { serializado = JSON.stringify(DB.state); } catch (e) { serializado = null; }

    var ok = false;
    if (serializado !== null) ok = escribirCrudo(serializado);
    almacenOk = ok;

    if (!ok && !avisoEscritura) {
      avisoEscritura = true;
      avisar('No se pudo guardar en este navegador; los cambios viven solo en esta sesión.', 'warn');
    }

    DB.emitir('cambio', DB.state);
    return ok;
  };

  /** ¿La última escritura llegó a localStorage? */
  DB.almacenDisponible = function () { return almacenOk; };

  /* ---------- CRUD genérico ---------- */

  /**
   * Arreglo vivo de una colección. Si no existe, se crea vacío.
   * @returns {Array}
   */
  DB.get = function (coleccion) {
    if (typeof coleccion !== 'string' || !coleccion) return [];
    if (!esArreglo(DB.state[coleccion])) DB.state[coleccion] = [];
    return DB.state[coleccion];
  };

  /** Busca por id dentro de una colección. */
  DB.buscar = function (coleccion, id) {
    if (!id) return null;
    var lista = DB.get(coleccion);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].id === id) return lista[i];
    }
    return null;
  };

  /**
   * Inserta un objeto (le asigna id con el prefijo de la colección) y guarda.
   * @returns {Object|null} el objeto insertado
   */
  DB.insertar = function (coleccion, obj) {
    if (!esObjeto(obj)) return null;
    var lista = DB.get(coleccion);
    if (typeof obj.id !== 'string' || !obj.id || existeId(lista, obj.id)) {
      obj.id = idUnico(lista, coleccion);
    }
    lista.push(obj);
    DB.guardar();
    return obj;
  };

  /**
   * Aplica cambios sobre un registro existente y guarda.
   * @returns {Object|null} el objeto actualizado
   */
  DB.actualizar = function (coleccion, id, cambios) {
    var obj = DB.buscar(coleccion, id);
    if (!obj) return null;
    if (esObjeto(cambios)) {
      for (var k in cambios) {
        if (!Object.prototype.hasOwnProperty.call(cambios, k)) continue;
        if (k === 'id') continue;               // el id nunca se reescribe
        obj[k] = cambios[k];
      }
    }
    DB.guardar();
    return obj;
  };

  /**
   * Elimina un registro por id.
   * @returns {Boolean} true si se eliminó
   */
  DB.eliminar = function (coleccion, id) {
    if (!id) return false;
    var lista = DB.get(coleccion);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].id === id) {
        lista.splice(i, 1);
        DB.guardar();
        return true;
      }
    }
    return false;
  };

  /**
   * Filtra una colección con una función; un error en el filtro no rompe nada.
   * @returns {Array}
   */
  DB.donde = function (coleccion, fn) {
    var lista = DB.get(coleccion);
    if (typeof fn !== 'function') return lista.slice();
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      try {
        if (fn(lista[i], i)) salida.push(lista[i]);
      } catch (e) { /* un elemento raro no invalida la consulta */ }
    }
    return salida;
  };

  /** Ordena una copia por fecha (campo configurable). */
  function ordenarPorFecha(lista, campo, dir) {
    var llave = campo || 'fecha';
    var factor = dir === 'asc' ? 1 : -1;
    return lista.slice().sort(function (a, b) {
      var fa = (a && typeof a[llave] === 'string') ? a[llave] : '';
      var fb = (b && typeof b[llave] === 'string') ? b[llave] : '';
      if (fa === fb) return 0;
      return fa > fb ? factor : -factor;
    });
  }

  /* ---------- Consultas de dominio ---------- */

  /** Usuario por id (cualquier rol). */
  DB.usuario = function (id) { return DB.buscar('usuarios', id); };

  /** Todos los socios (incluye vencidos, congelados y bajas). */
  DB.socios = function () {
    return DB.donde('usuarios', function (u) { return u.rol === 'socio'; });
  };

  /** Todos los coaches. */
  DB.coaches = function () {
    return DB.donde('usuarios', function (u) { return u.rol === 'coach'; });
  };

  /** Socios asignados a un coach. */
  DB.sociosDe = function (coachId) {
    if (!coachId) return [];
    return DB.donde('usuarios', function (u) {
      return u.rol === 'socio' && u.coachId === coachId;
    });
  };

  /** Plan de membresía por id. */
  DB.plan = function (id) { return DB.buscar('planes', id); };

  /** Pagos de un socio, del más reciente al más antiguo. */
  DB.pagosDe = function (socioId) {
    if (!socioId) return [];
    var lista = DB.donde('pagos', function (p) { return p.socioId === socioId; });
    return ordenarPorFecha(lista, 'fecha', 'desc');
  };

  /** Mediciones de un socio, de la más antigua a la más reciente. */
  DB.medicionesDe = function (socioId) {
    if (!socioId) return [];
    var lista = DB.donde('mediciones', function (m) { return m.socioId === socioId; });
    return ordenarPorFecha(lista, 'fecha', 'asc');
  };

  /**
   * Medición de un socio en un mes concreto.
   * @param {String} socioId
   * @param {String} periodo  'YYYY-MM' (si falta, el mes en curso)
   * @param {String} [tipo]   'inicial' | 'final' (si falta, la más reciente del mes)
   * @returns {Object|null}
   */
  DB.medicionDelMes = function (socioId, periodo, tipo) {
    if (!socioId) return null;
    var mes = typeof periodo === 'string' && periodo ? periodo.slice(0, 7) : mesDe(hoy());
    var candidatas = DB.donde('mediciones', function (m) {
      if (m.socioId !== socioId) return false;
      var suMes = typeof m.periodo === 'string' && m.periodo ? m.periodo.slice(0, 7) : mesDe(m.fecha);
      if (suMes !== mes) return false;
      if (tipo && m.tipo !== tipo) return false;
      return true;
    });
    if (!candidatas.length) return null;
    var ordenadas = ordenarPorFecha(candidatas, 'fecha', 'asc');
    // 'inicial' -> la primera del mes; 'final' o sin tipo -> la última.
    return tipo === 'inicial' ? ordenadas[0] : ordenadas[ordenadas.length - 1];
  };

  /**
   * Rutina vigente de un socio.
   * @returns {{asignacion:Object, rutina:Object}|null}
   */
  DB.rutinaActivaDe = function (socioId) {
    if (!socioId) return null;
    var activas = DB.donde('asignaciones', function (a) {
      return a.socioId === socioId && a.activa !== false;
    });
    if (!activas.length) return null;

    var ordenadas = ordenarPorFecha(activas, 'fechaInicio', 'desc');
    for (var i = 0; i < ordenadas.length; i++) {
      var rutina = DB.buscar('rutinas', ordenadas[i].rutinaId);
      if (rutina) return { asignacion: ordenadas[i], rutina: rutina };
    }
    return null;
  };

  /** Plan de nutrición vigente de un socio (el más reciente activo). */
  DB.planNutricionDe = function (socioId) {
    if (!socioId) return null;
    var planes = DB.donde('planesNutricion', function (p) {
      return p.socioId === socioId && p.activo !== false;
    });
    if (!planes.length) return null;
    var ordenados = ordenarPorFecha(planes, 'creado', 'desc');
    return ordenados[0];
  };

  /** Bitácoras de entrenamiento de un socio, de la más reciente a la más antigua. */
  DB.bitacorasDe = function (socioId) {
    if (!socioId) return [];
    var lista = DB.donde('bitacoras', function (b) { return b.socioId === socioId; });
    return ordenarPorFecha(lista, 'fecha', 'desc');
  };

  /** Asistencias de un socio, de la más reciente a la más antigua. */
  DB.asistenciasDe = function (socioId) {
    if (!socioId) return [];
    var lista = DB.donde('asistencias', function (a) { return a.socioId === socioId; });
    return ordenarPorFecha(lista, 'fecha', 'desc');
  };

  /** Calificaciones dirigidas a un coach ('u_xxx') o al gimnasio ('gym'). */
  DB.calificacionesDe = function (objetivoId) {
    if (!objetivoId) return [];
    var lista = DB.donde('calificaciones', function (c) { return c.objetivoId === objetivoId; });
    return ordenarPorFecha(lista, 'fecha', 'desc');
  };

  /**
   * Crea una notificación para un usuario.
   * @param {String} usuarioId
   * @param {{titulo:String, cuerpo:String, tipo:String, link:String, clave:String}} datos
   * @returns {Object|null} la notificación creada
   */
  DB.notificar = function (usuarioId, datos) {
    if (!usuarioId) return null;
    var d = esObjeto(datos) ? datos : {};
    return DB.insertar('notificaciones', {
      usuarioId: usuarioId,
      titulo: texto(d.titulo, 'Aviso'),
      cuerpo: texto(d.cuerpo, ''),
      tipo: texto(d.tipo, 'sistema'),
      fecha: ahora(),
      leida: false,
      link: texto(d.link, ''),
      clave: texto(d.clave, '')          // marca opcional para evitar duplicados
    });
  };

  /* ---------- Folios ---------- */

  /**
   * Siguiente folio de recibo: 'REC-000123'. Consume meta.folioPago.
   * @returns {String}
   */
  DB.folioPago = function () {
    if (!esObjeto(DB.state.meta)) DB.state.meta = normalizarMeta(null);
    var meta = DB.state.meta;
    var n = Math.max(1, entero(meta.folioPago, 1));
    var pagos = DB.get('pagos');
    var folio = 'REC-' + rellenar(n, 6);
    var guardias = 0;

    // Si por una importación el folio ya existiera, se avanza hasta uno libre.
    while (guardias < 10000 && folioOcupado(pagos, folio)) {
      n++;
      folio = 'REC-' + rellenar(n, 6);
      guardias++;
    }

    meta.folioPago = n + 1;
    return folio;
  };

  function folioOcupado(pagos, folio) {
    for (var i = 0; i < pagos.length; i++) {
      if (pagos[i] && pagos[i].folio === folio) return true;
    }
    return false;
  }

  /* ---------- Estado de membresías ---------- */

  /** ¿Ya existe una notificación con esa clave para ese usuario? */
  function yaNotificado(usuarioId, clave) {
    var lista = DB.get('notificaciones');
    for (var i = 0; i < lista.length; i++) {
      var n = lista[i];
      if (n && n.usuarioId === usuarioId && n.clave === clave) return true;
    }
    return false;
  }

  /** Último pago de mensualidad efectivamente cobrado de un socio. */
  function ultimaMensualidad(socioId) {
    var pagos = DB.get('pagos');
    var mejor = null, mejorFin = '';
    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!p || p.socioId !== socioId) continue;
      if (p.estado && p.estado !== 'pagado') continue;
      if (p.concepto && p.concepto !== 'mensualidad') continue;
      var fin = fechaValida(p.periodoFin);
      if (!fin) continue;
      if (!mejor || fin > mejorFin) { mejor = p; mejorFin = fin; }
    }
    return mejor ? { pago: mejor, fin: mejorFin } : null;
  }

  /**
   * Recalcula fechaVencimiento y estado de cada socio a partir de sus pagos.
   * Respeta 'congelado' y 'baja' (esos estados no se tocan nunca).
   * Genera notificaciones de vencimiento sin duplicar.
   * @returns {{revisados:Number, actualizados:Number, vencidos:Number}}
   */
  DB.recalcularEstadoSocios = function () {
    var resumen = { revisados: 0, actualizados: 0, vencidos: 0 };
    var socios = DB.socios();
    if (!socios.length) return resumen;

    var settings = esObjeto(DB.state.settings) ? DB.state.settings : settingsPorDefecto();
    var gracia = Math.max(0, entero(settings.diasGraciaPago, 5));
    var hoyStr = hoy();
    var cambios = false;
    var nuevasNotificaciones = [];

    for (var i = 0; i < socios.length; i++) {
      var socio = socios[i];
      if (!socio || !socio.id) continue;
      if (socio.estado === 'congelado' || socio.estado === 'baja') continue;

      resumen.revisados++;

      /* 1) Fecha de vencimiento a partir del último pago de mensualidad. */
      var venc = '';
      var ultimo = ultimaMensualidad(socio.id);
      if (ultimo) {
        venc = ultimo.fin;
      } else {
        venc = fechaValida(socio.fechaVencimiento);
        if (!venc) {
          var arranque = fechaValida(socio.fechaAlta) || fechaValida(socio.creado) || hoyStr;
          var plan = DB.plan(socio.planId);
          var meses = plan ? Math.max(1, entero(plan.meses, 1)) : 1;
          venc = sumaMeses(arranque, meses) || arranque;
        }
      }

      if (venc && socio.fechaVencimiento !== venc) {
        socio.fechaVencimiento = venc;
        cambios = true;
        resumen.actualizados++;
      }

      /* 2) Estado según la fecha de corte más los días de gracia. */
      var limite = sumaDias(venc, gracia) || venc;
      var nuevoEstado = (limite && limite >= hoyStr) ? 'activo' : 'vencido';

      if (socio.estado !== nuevoEstado) {
        socio.estado = nuevoEstado;
        cambios = true;
      }
      if (nuevoEstado === 'vencido') resumen.vencidos++;

      /* 3) Notificaciones (una sola vez por socio y fecha de corte). */
      if (nuevoEstado === 'vencido' && venc) {
        var claveVenc = 'membresia-vencida:' + socio.id + ':' + venc;
        if (!yaNotificado(socio.id, claveVenc)) {
          nuevasNotificaciones.push({
            usuarioId: socio.id,
            titulo: 'Tu membresía venció',
            cuerpo: 'Tu membresía terminó el ' + venc + '. Renueva en recepción para no perder tu acceso.',
            tipo: 'pago',
            fecha: ahora(),
            leida: false,
            link: '#/socio/pagos',
            clave: claveVenc
          });
        }
      } else if (nuevoEstado === 'activo' && venc) {
        var restan = diasEntre(hoyStr, venc);
        if (restan >= 0 && restan <= 3) {
          var clavePorVencer = 'membresia-por-vencer:' + socio.id + ':' + venc;
          if (!yaNotificado(socio.id, clavePorVencer)) {
            nuevasNotificaciones.push({
              usuarioId: socio.id,
              titulo: 'Tu membresía está por vencer',
              cuerpo: restan === 0
                ? 'Tu membresía vence hoy. Renueva para seguir entrenando.'
                : 'Te quedan ' + restan + (restan === 1 ? ' día' : ' días') + ' de membresía.',
              tipo: 'pago',
              fecha: ahora(),
              leida: false,
              link: '#/socio/pagos',
              clave: clavePorVencer
            });
          }
        }
      }
    }

    if (nuevasNotificaciones.length) {
      var lista = DB.get('notificaciones');
      for (var j = 0; j < nuevasNotificaciones.length; j++) {
        var n = nuevasNotificaciones[j];
        n.id = idUnico(lista, 'notificaciones');
        lista.push(n);
      }
      cambios = true;
    }

    if (cambios) DB.guardar();
    return resumen;
  };

  /* ---------- Respaldos ---------- */

  /**
   * Descarga un JSON con todo el sistema.
   * @returns {Boolean} true si se lanzó la descarga
   */
  DB.exportar = function () {
    var nombre = 'alliance-gym-respaldo-' + hoy() + '.json';
    var contenido = null;
    try { contenido = JSON.stringify(DB.state, null, 2); } catch (e) { contenido = null; }

    if (contenido === null) {
      avisar('No se pudo preparar el respaldo.', 'error');
      return false;
    }
    if (!AG.Utils || typeof AG.Utils.descargar !== 'function') {
      avisar('La descarga no está disponible en este momento.', 'error');
      return false;
    }
    try {
      AG.Utils.descargar(nombre, contenido, 'application/json');
      avisar('Respaldo descargado: ' + nombre, 'ok');
      return true;
    } catch (e) {
      avisar('No se pudo descargar el respaldo.', 'error');
      return false;
    }
  };

  /** Obtiene el texto de un File/Blob, de un input, de una cadena o de un objeto. */
  function textoDeFuente(fuente) {
    return new Promise(function (resolver, rechazar) {
      if (typeof fuente === 'string') { resolver(fuente); return; }

      var archivo = fuente;
      // <input type="file"> o FileList
      if (archivo && archivo.files && archivo.files.length) archivo = archivo.files[0];
      else if (archivo && typeof archivo.length === 'number' && archivo[0] && typeof Blob !== 'undefined' && archivo[0] instanceof Blob) {
        archivo = archivo[0];
      }

      if (typeof Blob !== 'undefined' && archivo instanceof Blob) {
        if (typeof FileReader === 'undefined') { rechazar(new Error('sin FileReader')); return; }
        var lector = new FileReader();
        lector.onload = function () { resolver(String(lector.result || '')); };
        lector.onerror = function () { rechazar(new Error('lectura fallida')); };
        try { lector.readAsText(archivo); } catch (e) { rechazar(e); }
        return;
      }

      if (esObjeto(fuente)) { resolver(fuente); return; }
      rechazar(new Error('fuente no válida'));
    });
  }

  /**
   * Importa un respaldo. Valida que traiga meta y usuarios antes de reemplazar
   * y conserva una copia del estado anterior por si algo falla.
   * @param {File|Blob|String|Object} fuente
   * @returns {Promise<Boolean>}
   */
  DB.importar = function (fuente) {
    return textoDeFuente(fuente).then(function (contenido) {
      var datos = null;
      if (typeof contenido === 'string') {
        try { datos = JSON.parse(contenido); } catch (e) { datos = null; }
      } else {
        datos = contenido;
      }

      if (!esObjeto(datos)) {
        avisar('El archivo no es un respaldo de Alliance Gym.', 'error');
        return false;
      }
      if (!esObjeto(datos.meta) || !esArreglo(datos.usuarios) || !datos.usuarios.length) {
        avisar('El respaldo está incompleto: faltan «meta» o los usuarios.', 'error');
        return false;
      }

      var respaldo = clonar(DB.state);
      try {
        reemplazarEstado(fusionarEstado(datos));
        DB.guardar();
        DB.recalcularEstadoSocios();
        avisar('Respaldo importado correctamente.', 'ok');
        return true;
      } catch (e) {
        if (respaldo) {
          reemplazarEstado(respaldo);
          DB.emitir('cambio', DB.state);
        }
        avisar('No se pudo importar; se restauraron los datos anteriores.', 'error');
        return false;
      }
    })['catch'](function () {
      avisar('No se pudo leer el archivo de respaldo.', 'error');
      return false;
    });
  };

  /* ---------- Siembra y reinicio ---------- */

  /** Llama a AG.Seed.construir() de forma tolerante. */
  function construirSemilla() {
    if (!AG.Seed || typeof AG.Seed.construir !== 'function') return null;
    try {
      var sembrado = AG.Seed.construir();
      return esObjeto(sembrado) ? sembrado : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Siembra los datos demo si la base no tiene usuarios.
   * @returns {Boolean} true si se sembró
   */
  DB.sembrarSiVacio = function () {
    if (DB.get('usuarios').length) return false;

    var sembrado = construirSemilla();
    if (!sembrado) {
      avisar('No se pudieron generar los datos de demostración.', 'error');
      DB.guardar();
      return false;
    }

    reemplazarEstado(fusionarEstado(sembrado));
    DB.guardar();
    return true;
  };

  /**
   * Borra todo y vuelve a sembrar los datos demo.
   * @returns {Boolean} true si quedó sembrada
   */
  DB.reiniciar = function () {
    borrarCrudo();
    reemplazarEstado(estructuraVacia());
    var ok = DB.sembrarSiVacio();
    DB.recalcularEstadoSocios();
    DB.emitir('cambio', DB.state);
    return ok;
  };

  /* ---------- Diagnóstico ---------- */

  /**
   * Conteos por colección y tamaño de la base (pantalla de configuración).
   * @returns {Object}
   */
  DB.estadisticas = function () {
    var stats = { total: 0 };

    for (var i = 0; i < COLECCIONES.length; i++) {
      var nombre = COLECCIONES[i];
      var n = DB.get(nombre).length;
      stats[nombre] = n;
      stats.total += n;
    }

    stats.socios = DB.socios().length;
    stats.coaches = DB.coaches().length;
    stats.directores = DB.donde('usuarios', function (u) { return u.rol === 'director'; }).length;
    stats.sociosActivos = DB.donde('usuarios', function (u) {
      return u.rol === 'socio' && u.estado === 'activo';
    }).length;

    var bytes = 0;
    try { bytes = JSON.stringify(DB.state).length; } catch (e) { bytes = 0; }
    stats.bytes = bytes;
    stats.kb = Math.round(bytes / 102.4) / 10;      // un decimal
    stats.version = DB.state.meta ? DB.state.meta.version : VERSION;
    stats.folioPago = DB.state.meta ? DB.state.meta.folioPago : 1;
    stats.actualizado = DB.state.meta ? DB.state.meta.actualizado : '';
    stats.almacenDisponible = almacenOk;

    return stats;
  };

  /** Estructura limpia (útil para pruebas y para el reinicio). */
  DB.estructuraVacia = estructuraVacia;

  AG.DB = DB;
})(window.AG);
