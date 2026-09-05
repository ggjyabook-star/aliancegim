/* =============================================================
   ALLIANCE GYM — Generador de datos de demostración (AG.Seed)

   AG.Seed.construir() devuelve el objeto `state` COMPLETO y válido
   según el contrato de docs/ARQUITECTURA.md, listo para AG.DB.

   Todo se genera en tiempo de ejecución y SIEMPRE relativo a hoy
   (new Date()): ocho meses de historia que terminan en el mes en curso.

   El azar viene de un PRNG con semilla fija (mulberry32), de modo que
   los datos son variados pero idénticos entre recargas. Nunca se usa
   Math.random directo.
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  /* =============================================================
     0. Azar determinista
     ============================================================= */

  var SEMILLA = 20260905;

  /** Generador congruente de 32 bits, rápido y reproducible. */
  function mulberry32(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var azar = mulberry32(SEMILLA);

  /** Entero aleatorio entre min y max, ambos incluidos. */
  function ent(min, max) {
    if (max < min) { var t = min; min = max; max = t; }
    return min + Math.floor(azar() * (max - min + 1));
  }

  /** Redondea a los decimales indicados. */
  function red(valor, dec) {
    var f = Math.pow(10, dec || 0);
    var v = Math.round(Number(valor) * f) / f;
    return isFinite(v) ? v : 0;
  }

  /** Número real aleatorio entre min y max con decimales controlados. */
  function real(min, max, dec) {
    return red(min + azar() * (max - min), dec === undefined ? 2 : dec);
  }

  /** Elemento al azar de una lista (nunca lanza con listas vacías). */
  function elegir(lista) {
    if (!lista || !lista.length) return null;
    return lista[Math.floor(azar() * lista.length)];
  }

  /** ¿Ocurre un evento con probabilidad p (0..1)? */
  function probable(p) {
    return azar() < p;
  }

  /** Copia barajada (Fisher-Yates con el PRNG de la semilla). */
  function barajar(lista) {
    var copia = (lista || []).slice();
    for (var i = copia.length - 1; i > 0; i--) {
      var j = Math.floor(azar() * (i + 1));
      var tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
    }
    return copia;
  }

  /** Acota un número a un rango. */
  function acotar(v, min, max) {
    if (!isFinite(v)) return min;
    return v < min ? min : (v > max ? max : v);
  }

  /** Redondea a múltiplos de 2.5 kg (discos reales del gimnasio). */
  function aDisco(kg) {
    var v = Math.round(Number(kg) / 2.5) * 2.5;
    return v > 0 ? red(v, 1) : 0;
  }

  /* =============================================================
     1. Identificadores deterministas
     ============================================================= */

  var contadores = {};

  function relleno(n, largo) {
    var s = String(n);
    while (s.length < largo) s = '0' + s;
    return s;
  }

  /** 'pg_' -> 'pg_0001', 'pg_0002'... Sin colisiones ni Math.random. */
  function nuevoId(prefijo) {
    contadores[prefijo] = (contadores[prefijo] || 0) + 1;
    return prefijo + relleno(contadores[prefijo], 4);
  }

  /* =============================================================
     2. Fechas (cadenas 'YYYY-MM-DD', sin líos de zona horaria)
     ============================================================= */

  function isoDe(anio, mes, dia) {
    return relleno(anio, 4) + '-' + relleno(mes, 2) + '-' + relleno(dia, 2);
  }

  function hoyISO() {
    var d = new Date();
    return isoDe(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function partesDe(iso) {
    var t = String(iso || '');
    return { a: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)), d: Number(t.slice(8, 10)) || 1 };
  }

  function diasDelMes(anio, mes) {
    return new Date(anio, mes, 0).getDate();
  }

  function sumaDias(iso, n) {
    var p = partesDe(iso);
    var f = new Date(Date.UTC(p.a, p.m - 1, p.d));
    f.setUTCDate(f.getUTCDate() + (Number(n) || 0));
    return isoDe(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
  }

  function sumaMeses(iso, n) {
    var p = partesDe(iso);
    var total = p.a * 12 + (p.m - 1) + (Number(n) || 0);
    var anio = Math.floor(total / 12);
    var mes = ((total % 12) + 12) % 12 + 1;
    return isoDe(anio, mes, Math.min(p.d, diasDelMes(anio, mes)));
  }

  function diasEntre(a, b) {
    var pa = partesDe(a), pb = partesDe(b);
    return Math.round((Date.UTC(pb.a, pb.m - 1, pb.d) - Date.UTC(pa.a, pa.m - 1, pa.d)) / 86400000);
  }

  function mesDe(iso) { return String(iso || '').slice(0, 7); }

  function primerDiaMes(mesKey) { return mesKey + '-01'; }

  function ultimoDiaMes(mesKey) {
    var p = partesDe(mesKey + '-01');
    return isoDe(p.a, p.m, diasDelMes(p.a, p.m));
  }

  /** 0 = domingo … 6 = sábado */
  function diaSemana(iso) {
    var p = partesDe(iso);
    return new Date(p.a, p.m - 1, p.d).getDay();
  }

  /** Marca de tiempo local sin zona: '2026-09-05T08:30:00'. */
  function marcaDe(iso, hora, minuto) {
    return iso + 'T' + relleno(acotar(hora, 0, 23), 2) + ':' + relleno(acotar(minuto, 0, 59), 2) + ':00';
  }

  function menorFecha(a, b) { return a < b ? a : b; }
  function mayorFecha(a, b) { return a > b ? a : b; }

  /* =============================================================
     3. Catálogo de planes de membresía
     ============================================================= */

  function construirPlanes() {
    return [
      {
        id: 'pl_0001', nombre: 'Visita', precio: 90, meses: 0, dias: 1,
        descripcion: 'Pase de un día para conocer las instalaciones o entrenar de paso.',
        beneficios: [
          'Acceso al área de pesas y cardio por un día',
          'Casillero del día sin costo',
          'Asesoría breve de sala',
          'Descontable de la inscripción si te haces socio esa semana'
        ],
        color: '#8d9aa8', activo: true, inscripcion: 0
      },
      {
        id: 'pl_0002', nombre: 'Semanal', precio: 250, meses: 0, dias: 7,
        descripcion: 'Siete días seguidos de acceso libre. Ideal para visitantes y pruebas.',
        beneficios: [
          'Acceso ilimitado durante 7 días',
          'Dos clases grupales incluidas',
          'Rutina básica de arranque',
          'Sin inscripción'
        ],
        color: '#5aa9f0', activo: true, inscripcion: 0
      },
      {
        id: 'pl_0003', nombre: 'Mensual', precio: 650, meses: 1, dias: 30,
        descripcion: 'El plan de casa: acceso completo con coach asignado y seguimiento mensual.',
        beneficios: [
          'Acceso ilimitado en todo el horario',
          'Coach asignado y rutina personalizada',
          'Medición corporal de inicio y cierre de mes',
          'Clases grupales incluidas',
          'Casillero y regaderas'
        ],
        color: '#e4322b', activo: true, inscripcion: 250
      },
      {
        id: 'pl_0004', nombre: 'Trimestral', precio: 1700, meses: 3, dias: 90,
        descripcion: 'Tres meses pagados por adelantado con ahorro frente al mensual.',
        beneficios: [
          'Todo lo del plan Mensual',
          'Ahorro de $250 contra tres mensualidades',
          'Plan de alimentación incluido',
          'Congelamiento de 7 días sin costo',
          'Invitación para un acompañante al mes'
        ],
        color: '#f0a03c', activo: true, inscripcion: 250
      },
      {
        id: 'pl_0005', nombre: 'Semestral', precio: 3100, meses: 6, dias: 180,
        descripcion: 'Seis meses con seguimiento cercano y sin inscripción.',
        beneficios: [
          'Todo lo del plan Trimestral',
          'Sin costo de inscripción',
          'Revaloración corporal completa cada mes',
          'Congelamiento de 15 días sin costo',
          'Playera oficial Alliance Gym'
        ],
        color: '#9b7bf0', activo: true, inscripcion: 0
      },
      {
        id: 'pl_0006', nombre: 'Anual', precio: 5600, meses: 12, dias: 365,
        descripcion: 'El mejor precio por mes. Un año completo con todos los beneficios abiertos.',
        beneficios: [
          'Todo lo del plan Semestral',
          'Equivale a $467 por mes',
          'Dos sesiones de entrenamiento personal al mes',
          'Congelamiento de 30 días sin costo',
          'Kit de bienvenida y acceso preferente a clases'
        ],
        color: '#3fbf7f', activo: true, inscripcion: 0
      }
    ];
  }

  /* =============================================================
     4. Personal: dirección y coaches
     ============================================================= */

  function construirDirector(fechaBase) {
    return {
      id: 'u_0001', rol: 'director',
      nombre: 'Julio César', apellidos: 'Ramírez',
      email: 'director@alliancegym.mx', telefono: '33 1188 4520',
      password: 'admin123', avatarColor: '#e4322b', activo: true,
      creado: fechaBase,
      especialidad: 'Dirección general',
      bio: 'Fundador de Alliance Gym. Licenciado en administración y entrenador certificado; lleva 14 años levantando gimnasios de barrio con estándares de alto rendimiento.',
      certificaciones: ['Licenciatura en Administración de Empresas', 'Personal Trainer NSCA-CPT', 'Diplomado en gestión de centros deportivos'],
      fechaContratacion: fechaBase, sueldo: 0, cupoMaximo: 0,
      horario: 'Lun a Vie 8:00–19:00 · Sáb 9:00–14:00',
      notas: 'Cuenta de dirección con acceso completo al sistema.'
    };
  }

  var COACHES_BASE = [
    {
      id: 'u_0002', nombre: 'Marco', apellidos: 'Ibarra',
      email: 'coach@alliancegym.mx', password: 'coach123', telefono: '33 2140 7788',
      color: '#f2711c', especialidad: 'Fuerza e hipertrofia',
      bio: 'Entrenador de fuerza con 11 años de piso. Trabaja progresiones de barra, técnica de básicos y planificación por bloques. Es el coach de la cuenta demo de socio.',
      certificaciones: ['NSCA-CSCS', 'Certificación en Levantamiento Olímpico Nivel 1', 'Especialidad en periodización deportiva'],
      sueldo: 21500, cupoMaximo: 22,
      horario: 'Lun a Vie 6:00–11:00 y 17:00–21:00 · Sáb 8:00–13:00',
      antiguedadMeses: 46
    },
    {
      id: 'u_0003', nombre: 'Daniela', apellidos: 'Fuentes',
      email: 'daniela.fuentes@alliancegym.mx', password: 'coach123', telefono: '33 2965 1140',
      color: '#3fbf7f', especialidad: 'Nutrición deportiva',
      bio: 'Nutrióloga con maestría en nutrición deportiva. Arma planes de alimentación reales, con comida mexicana y presupuestos de la vida diaria, sin dietas imposibles.',
      certificaciones: ['Licenciatura en Nutrición (UdeG)', 'Maestría en Nutrición Deportiva', 'Certificación ISAK Nivel 1 en antropometría'],
      sueldo: 23000, cupoMaximo: 20,
      horario: 'Lun a Vie 8:00–14:00 y 16:00–20:00',
      antiguedadMeses: 33
    },
    {
      id: 'u_0004', nombre: 'Paulina', apellidos: 'Zavala',
      email: 'paulina.zavala@alliancegym.mx', password: 'coach123', telefono: '33 3372 6015',
      color: '#ec4899', especialidad: 'Acondicionamiento femenino',
      bio: 'Especialista en entrenamiento de fuerza para mujeres: glúteo, piernas y recomposición corporal. Lleva los grupos de Zumba y GAP con la sala siempre llena.',
      certificaciones: ['Licenciatura en Cultura Física y Deportes', 'Especialidad en entrenamiento femenino', 'Instructora certificada de Zumba Fitness'],
      sueldo: 19800, cupoMaximo: 24,
      horario: 'Lun a Vie 9:00–14:00 y 17:00–21:00 · Sáb 9:00–13:00',
      antiguedadMeses: 27
    },
    {
      id: 'u_0005', nombre: 'Ricardo', apellidos: 'Mendoza',
      email: 'ricardo.mendoza@alliancegym.mx', password: 'coach123', telefono: '33 1804 9932',
      color: '#5aa9f0', especialidad: 'Adulto mayor y rehabilitación',
      bio: 'Fisioterapeuta de formación. Trabaja movilidad, equilibrio y readaptación después de lesión; es quien recibe a los socios que llegan con indicación médica.',
      certificaciones: ['Licenciatura en Fisioterapia', 'Especialidad en readaptación funcional', 'Certificación en ejercicio para adulto mayor (ACSM)'],
      sueldo: 22400, cupoMaximo: 16,
      horario: 'Lun a Vie 7:00–13:00 y 16:00–19:00',
      antiguedadMeses: 21
    },
    {
      id: 'u_0006', nombre: 'Iván', apellidos: 'Castañeda',
      email: 'ivan.castaneda@alliancegym.mx', password: 'coach123', telefono: '33 2517 3364',
      color: '#eab308', especialidad: 'HIIT y entrenamiento funcional',
      bio: 'Viene del atletismo de medio fondo. Diseña circuitos metabólicos, spinning y funcional; su clase de las 6:00 am es la más concurrida del gimnasio.',
      certificaciones: ['Entrenador Personal Certificado ACE', 'Instructor de Ciclismo Indoor', 'Certificación en Kettlebell Nivel 1'],
      sueldo: 19200, cupoMaximo: 26,
      horario: 'Lun a Vie 5:30–10:00 y 18:00–21:30 · Sáb 8:00–12:00',
      antiguedadMeses: 18
    }
  ];

  function construirCoaches(hoy) {
    return COACHES_BASE.map(function (c) {
      var contratacion = sumaDias(sumaMeses(hoy, -c.antiguedadMeses), ent(-8, 8));
      return {
        id: c.id, rol: 'coach',
        nombre: c.nombre, apellidos: c.apellidos,
        email: c.email, telefono: c.telefono, password: c.password,
        avatarColor: c.color, activo: true,
        creado: contratacion,
        especialidad: c.especialidad,
        bio: c.bio,
        certificaciones: c.certificaciones.slice(),
        fechaContratacion: contratacion,
        sueldo: c.sueldo,
        cupoMaximo: c.cupoMaximo,
        horario: c.horario,
        notas: ''
      };
    });
  }

  /* =============================================================
     5. Padrón de socios
     ============================================================= */

  /* [nombre, apellidos, sexo] — 45 personas, nombres mexicanos variados. */
  var PERSONAS = [
    ['Ana Sofía', 'Delgado', 'M'],
    ['Luis Ángel', 'Herrera', 'H'],
    ['Mariana', 'Espinoza', 'M'],
    ['Carlos Eduardo', 'Rangel', 'H'],
    ['Karla', 'Valdés', 'M'],
    ['Miguel Ángel', 'Domínguez', 'H'],
    ['Fernanda', 'Rojas', 'M'],
    ['Jorge Alberto', 'Peña', 'H'],
    ['Alejandra', 'Cisneros', 'M'],
    ['Sergio', 'Nava', 'H'],
    ['Gabriela', 'Montiel', 'M'],
    ['Emiliano', 'Cortés', 'H'],
    ['Paola', 'Trejo', 'M'],
    ['Diego Armando', 'Salgado', 'H'],
    ['Regina', 'Barragán', 'M'],
    ['Óscar Iván', 'Villalobos', 'H'],
    ['Lucía', 'Alcántara', 'M'],
    ['Raúl', 'Estrada', 'H'],
    ['Diana Laura', 'Mercado', 'M'],
    ['Héctor Manuel', 'Cárdenas', 'H'],
    ['Cecilia', 'Ontiveros', 'M'],
    ['Fernando', 'Quintero', 'H'],
    ['Ximena', 'Pacheco', 'M'],
    ['Alejandro', 'Bustamante', 'H'],
    ['Brenda', 'Carrillo', 'M'],
    ['Rodrigo', 'Lozano', 'H'],
    ['Itzel', 'Guzmán', 'M'],
    ['Juan Pablo', 'Arriaga', 'H'],
    ['Renata', 'Villaseñor', 'M'],
    ['Iván', 'Solano', 'H'],
    ['Adriana', 'Zúñiga', 'M'],
    ['Marco Antonio', 'Reyna', 'H'],
    ['Sofía Elena', 'Márquez', 'M'],
    ['Gerardo', 'Ceballos', 'H'],
    ['Verónica', 'Padilla', 'M'],
    ['Pablo', 'Escamilla', 'H'],
    ['Andrea', 'Beltrán', 'M'],
    ['Ernesto', 'Robles', 'H'],
    ['Claudia', 'Serrano', 'M'],
    ['Andrés Felipe', 'Ocampo', 'H'],
    ['Nayeli', 'Camacho', 'M'],
    ['Ramón', 'Aguilar', 'H'],
    ['Elena', 'Rivas', 'M'],
    ['Cristian', 'Mejía', 'H'],
    ['Aldo', 'Bernal', 'H']
  ];

  var PADECIMIENTOS = [
    '', '', '', '', '',
    'Hipertensión controlada con medicamento',
    'Lumbalgia crónica leve',
    'Asma leve inducida por ejercicio',
    'Condromalacia rotuliana en rodilla derecha',
    'Hipotiroidismo en tratamiento',
    'Prediabetes en control con dieta',
    'Hernia discal L5-S1 dada de alta por fisioterapia',
    'Tendinitis de manguito rotador (hombro izquierdo)',
    'Colesterol elevado en seguimiento médico'
  ];

  var ALERGIAS = [
    'Ninguna conocida', 'Ninguna conocida', 'Ninguna conocida', 'Ninguna conocida',
    'Lactosa (intolerancia)', 'Penicilina', 'Mariscos', 'Nuez y cacahuate',
    'Polen y polvo', 'Gluten (sensibilidad no celiaca)'
  ];

  var PARENTESCOS = ['Esposa', 'Esposo', 'Madre', 'Padre', 'Hermano', 'Hermana', 'Hijo', 'Hija', 'Amigo', 'Amiga'];

  var NOMBRES_EMERGENCIA = [
    'Rosa María Delgado', 'Jesús Herrera', 'Laura Beatriz Sánchez', 'Óscar Rangel',
    'Norma Valdés', 'Patricia Domínguez', 'Julio Rojas', 'Beatriz Peña',
    'Salvador Cisneros', 'Guadalupe Nava', 'Ernesto Montiel', 'Sandra Cortés',
    'Alfredo Trejo', 'Silvia Salgado', 'Ignacio Barragán', 'Martha Villalobos',
    'Rubén Alcántara', 'Leticia Estrada', 'Arturo Mercado', 'Yolanda Cárdenas'
  ];

  var NOTAS_SOCIO = [
    'Entrena muy temprano; le acomoda el bloque de 6:00 am.',
    'Prefiere máquinas sobre peso libre mientras agarra confianza.',
    'Viene con su pareja, procuran entrenar juntos.',
    'Pidió que le recuerden su cita de medición por WhatsApp.',
    'Trabaja por turnos, algunas semanas solo puede tres días.',
    'Muy constante; buen candidato para el reto trimestral.',
    'Le cuesta la adherencia a la dieta, no al entrenamiento.',
    'Viene referido por otro socio del gimnasio.',
    'Necesita supervisión en peso muerto: técnica en corrección.',
    'Solicita rutinas cortas por tiempo limitado a la hora de comida.',
    '', '', '', ''
  ];

  /* Bolsa ponderada: en un gimnasio real domina la gente que quiere bajar grasa. */
  var OBJETIVOS = [
    'perder_grasa', 'perder_grasa', 'perder_grasa', 'perder_grasa',
    'ganar_musculo', 'ganar_musculo', 'ganar_musculo',
    'mantener', 'mantener', 'mantener',
    'rendimiento', 'rendimiento',
    'salud', 'salud'
  ];

  /** Quita acentos y deja minúsculas para armar correos. */
  function sinAcentos(texto) {
    var t = String(texto || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch (e) {
      t = t.replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
           .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
    }
    return t.replace(/[^a-z0-9]+/g, '');
  }

  var DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.mx', 'correo.mx'];

  /* =============================================================
     6. Motor de perfiles corporales
     ============================================================= */

  /* Rango de IMC inicial por objetivo (así el historial tiene sentido). */
  var IMC_INICIAL = {
    perder_grasa: [28.5, 34.5],
    ganar_musculo: [20.5, 24.0],
    mantener: [23.0, 26.5],
    rendimiento: [21.5, 25.0],
    salud: [25.0, 30.5]
  };

  /* Porcentaje de grasa inicial por objetivo y sexo. */
  var GRASA_INICIAL = {
    perder_grasa: { H: [24, 34], M: [32, 42] },
    ganar_musculo: { H: [13, 19], M: [22, 28] },
    mantener: { H: [17, 23], M: [26, 32] },
    rendimiento: { H: [14, 20], M: [23, 29] },
    salud: { H: [22, 30], M: [30, 38] }
  };

  /** Calcula las medidas corporales a partir de peso, grasa y músculo. */
  function calcularMedidas(sexo, peso, grasaPct, musculoDelta, ruido) {
    var hombre = sexo === 'H';
    var cintura = hombre
      ? 60 + peso * 0.35 + (grasaPct - 20) * 0.60
      : 55 + peso * 0.38 + (grasaPct - 28) * 0.55;
    var cadera = cintura + (hombre ? 9 : 18);
    var pecho = cintura + (hombre ? 13 : 6);
    var hombros = pecho + (hombre ? 16 : 13);
    var cuello = hombre ? 33 + peso * 0.055 : 29 + peso * 0.048;
    var brazo = (hombre ? 22 + peso * 0.130 : 21 + peso * 0.115) + musculoDelta * 0.35;
    var muslo = (hombre ? 42 + peso * 0.130 : 44 + peso * 0.135) + musculoDelta * 0.50;
    var pantorrilla = (hombre ? 30 + peso * 0.060 : 29 + peso * 0.058) + musculoDelta * 0.18;

    return {
      cuello: red(acotar(cuello + ruido.cuello, 28, 48), 1),
      hombros: red(acotar(hombros + ruido.hombros, 85, 145), 1),
      pecho: red(acotar(pecho + ruido.pecho, 74, 135), 1),
      brazoDer: red(acotar(brazo + ruido.brazo, 22, 48), 1),
      brazoIzq: red(acotar(brazo + ruido.brazo - ruido.asimetriaBrazo, 22, 48), 1),
      cintura: red(acotar(cintura + ruido.cintura, 58, 138), 1),
      cadera: red(acotar(cadera + ruido.cadera, 75, 150), 1),
      musloDer: red(acotar(muslo + ruido.muslo, 38, 78), 1),
      musloIzq: red(acotar(muslo + ruido.muslo - ruido.asimetriaMuslo, 38, 78), 1),
      pantorrilla: red(acotar(pantorrilla + ruido.pantorrilla, 28, 50), 1)
    };
  }

  /** Pliegues cutáneos coherentes con el porcentaje de grasa. */
  function calcularPliegues(sexo, grasaPct, ruido) {
    var f = sexo === 'H' ? 1 : 1.18;
    return {
      triceps: red(acotar(grasaPct * 0.55 * f + ruido.pl1, 4, 45), 0),
      subescapular: red(acotar(grasaPct * 0.58 * (sexo === 'H' ? 1.05 : 0.92) + ruido.pl2, 4, 45), 0),
      suprailiaco: red(acotar(grasaPct * 0.68 * f + ruido.pl3, 4, 50), 0),
      abdominal: red(acotar(grasaPct * 0.90 * (sexo === 'H' ? 1.05 : 0.95) + ruido.pl4, 5, 55), 0),
      muslo: red(acotar(grasaPct * 0.78 * f + ruido.pl5, 5, 55), 0)
    };
  }

  /** Fuerza base (kg) según peso corporal, sexo y nivel del socio. */
  function fuerzaInicial(sexo, peso, nivel) {
    var factores = {
      principiante: { banca: 0.55, sentadilla: 0.80, muerto: 1.00 },
      intermedio: { banca: 0.85, sentadilla: 1.20, muerto: 1.45 },
      avanzado: { banca: 1.15, sentadilla: 1.55, muerto: 1.90 }
    };
    var f = factores[nivel] || factores.intermedio;
    var g = sexo === 'H' ? 1 : 0.62;
    return {
      pressBanca: aDisco(peso * f.banca * g),
      sentadilla: aDisco(peso * f.sentadilla * g),
      pesoMuerto: aDisco(peso * f.muerto * g)
    };
  }

  var NOTAS_MEDICION_INICIAL = [
    'Arranque de mes. Se explicó el plan y las metas del periodo.',
    'Medición de apertura de mes, en ayuno y antes de entrenar.',
    'Corte inicial del mes. Se ajustaron cargas del bloque anterior.',
    'Se retomó el plan después del descanso del fin de semana.',
    'Inicio de mes: hidratación normal, sin entrenamiento previo.',
    'Toma de referencia del mes. Ánimo y energía en buen nivel.'
  ];

  var NOTAS_MEDICION_FINAL = [
    'Cierre de mes. Se cumplieron la mayoría de las sesiones planeadas.',
    'Buen cierre: se nota el cambio en cintura y en el espejo.',
    'Cierre con adherencia irregular por carga de trabajo.',
    'Mes con avance sostenido; se sube volumen para el siguiente bloque.',
    'Cierre del periodo. Se refuerza la parte alimenticia para el mes que entra.',
    'Meseta esperada: se cambia el estímulo para el próximo mes.',
    'Cierre positivo. Se felicitó por la constancia del mes.'
  ];

  /* =============================================================
     7. Rutinas plantilla
     Notación compacta por ejercicio:
       [ejercicioId, series, reps, descansoSeg, tempo, notas]
     ============================================================= */

  var RUTINAS_DEF = [
    {
      nombre: 'Full Body Principiante',
      objetivo: 'salud', nivel: 'principiante', dias: 3,
      descripcion: 'Tres sesiones de cuerpo completo para quien empieza de cero: patrones básicos, cargas moderadas y mucha técnica antes que peso.',
      d: [
        {
          n: 'Día 1', f: 'Cuerpo completo A',
          cal: '6 min de caminadora en pendiente ligera + movilidad de cadera y hombro (círculos, gato-camello y sentadilla sin peso).',
          car: '10 min de caminata en pendiente al terminar, ritmo conversado.',
          e: [
            ['ej_sentadilla_goblet', 3, '10-12', 90, '2-1-2-0', 'Talones firmes, pecho arriba y rodillas hacia afuera.'],
            ['ej_press_banca_mancuernas', 3, '10-12', 90, '2-0-2-0', 'Codos a 45 grados, no tocar el pecho con las mancuernas.'],
            ['ej_jalon_al_pecho', 3, '10-12', 90, '2-0-2-1', 'Jala con los codos, no con las manos.'],
            ['ej_press_hombros_mancuernas', 3, '10-12', 75, '2-0-2-0', 'Sin arquear la espalda baja.'],
            ['ej_puente_gluteo', 3, '12-15', 60, '2-1-1-1', 'Aprieta el glúteo dos segundos arriba.'],
            ['ej_plancha_frontal', 3, '30 s', 60, 'isométrico', 'Costillas abajo y glúteo apretado.']
          ]
        },
        {
          n: 'Día 2', f: 'Cuerpo completo B',
          cal: '5 min de bicicleta estática suave + activación con banda para hombro y glúteo.',
          car: '8 min de bicicleta a ritmo cómodo.',
          e: [
            ['ej_prensa_piernas', 3, '10-12', 90, '2-0-2-0', 'No bloquear la rodilla al extender.'],
            ['ej_lagartijas_manos_elevadas', 3, '8-12', 75, '2-0-1-0', 'Cuerpo en línea de la cabeza a los talones.'],
            ['ej_remo_sentado_polea', 3, '10-12', 90, '2-1-2-0', 'Pecho firme, sin balancear el torso.'],
            ['ej_curl_mancuernas_alterno', 2, '12-14', 60, '2-0-2-0', ''],
            ['ej_extension_triceps_cuerda', 2, '12-14', 60, '2-0-2-0', 'Codos pegados al cuerpo.'],
            ['ej_abdominales_crunch', 3, '15-20', 45, '2-0-1-1', '']
          ]
        },
        {
          n: 'Día 3', f: 'Cuerpo completo C',
          cal: '6 min de elíptica + movilidad de tobillo y columna torácica.',
          car: '10 min de caminata ligera de enfriamiento.',
          e: [
            ['ej_peso_muerto_rumano_mancuernas', 3, '10-12', 90, '3-0-1-0', 'Cadera atrás, espalda recta, mancuernas pegadas a la pierna.'],
            ['ej_press_pecho_maquina', 3, '10-12', 75, '2-0-2-0', ''],
            ['ej_remo_maquina', 3, '10-12', 75, '2-1-2-0', ''],
            ['ej_elevaciones_laterales', 3, '12-15', 60, '2-0-2-0', 'Sube solo hasta la altura del hombro.'],
            ['ej_subida_al_cajon', 3, '10 por pierna', 75, '2-0-1-0', 'Empuja con el talón de la pierna de arriba.'],
            ['ej_bicho_muerto', 3, '10 por lado', 45, '2-0-2-0', 'Espalda baja pegada al piso.']
          ]
        }
      ]
    },
    {
      nombre: 'Torso-Pierna 4 días',
      objetivo: 'ganar_musculo', nivel: 'intermedio', dias: 4,
      descripcion: 'Clásico torso-pierna con frecuencia dos por semana en cada mitad del cuerpo. El mejor equilibrio entre volumen y recuperación.',
      d: [
        {
          n: 'Día 1', f: 'Torso A · fuerza',
          cal: '5 min de remadora + movilidad de hombro con banda y dos series de aproximación al press.',
          car: '',
          e: [
            ['ej_press_banca_barra', 4, '6-8', 150, '3-0-1-0', 'Series de aproximación antes de la primera efectiva.'],
            ['ej_remo_barra', 4, '8-10', 120, '2-0-1-1', 'Torso a 45 grados, sin dar tirones.'],
            ['ej_press_militar_barra', 3, '8-10', 120, '2-0-1-0', ''],
            ['ej_jalon_al_pecho', 3, '10-12', 90, '2-0-2-1', ''],
            ['ej_curl_barra', 3, '10-12', 75, '2-0-2-0', ''],
            ['ej_extension_triceps_polea', 3, '12-15', 60, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 2', f: 'Pierna A · cuádriceps y cadena posterior',
          cal: '8 min de bicicleta + movilidad de cadera y tobillo, más dos aproximaciones a la sentadilla.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 4, '6-8', 180, '3-0-1-0', 'Profundidad hasta romper la paralela.'],
            ['ej_peso_muerto_rumano', 4, '8-10', 120, '3-1-1-0', 'La barra roza la pierna todo el recorrido.'],
            ['ej_prensa_piernas', 3, '10-12', 120, '2-0-2-0', ''],
            ['ej_curl_femoral_sentado', 3, '12-15', 75, '2-1-2-0', ''],
            ['ej_pantorrilla_de_pie', 4, '15-20', 60, '2-1-1-1', 'Pausa arriba y estiramiento completo abajo.'],
            ['ej_plancha_frontal', 3, '45 s', 60, 'isométrico', '']
          ]
        },
        {
          n: 'Día 3', f: 'Torso B · volumen',
          cal: '5 min de elíptica + face pull con banda y rotaciones de hombro.',
          car: '',
          e: [
            ['ej_press_inclinado_mancuernas', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_dominadas', 4, 'al fallo', 120, '2-0-1-1', 'Si salen menos de 6, usar asistencia.'],
            ['ej_press_hombros_mancuernas', 3, '10-12', 90, '2-0-2-0', ''],
            ['ej_remo_sentado_polea', 3, '10-12', 90, '2-1-2-0', ''],
            ['ej_curl_martillo', 3, '10-12', 60, '2-0-2-0', ''],
            ['ej_fondos_paralelas', 3, '8-12', 90, '2-0-1-0', 'Torso vertical para cargar el tríceps.']
          ]
        },
        {
          n: 'Día 4', f: 'Pierna B · fuerza y unilateral',
          cal: '8 min de caminadora en pendiente + movilidad de cadera y aproximaciones al peso muerto.',
          car: '6 min de caminata de enfriamiento.',
          e: [
            ['ej_sentadilla_frontal', 4, '6-8', 180, '3-0-1-0', 'Codos altos, torso vertical.'],
            ['ej_peso_muerto_convencional', 3, '5-6', 180, '2-0-1-2', 'Espalda neutra; suelta y vuelve a acomodar cada repetición.'],
            ['ej_desplante_caminando', 3, '10 por pierna', 90, '2-0-1-0', ''],
            ['ej_extension_cuadriceps', 3, '12-15', 75, '2-1-2-0', ''],
            ['ej_pantorrilla_sentado', 4, '15-20', 45, '2-1-1-1', ''],
            ['ej_elevacion_piernas_colgado', 3, '10-15', 60, '2-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Push Pull Legs 6 días',
      objetivo: 'ganar_musculo', nivel: 'avanzado', dias: 6,
      descripcion: 'Empuje, jalón y pierna dos veces por semana. Alto volumen para socios avanzados con buena recuperación y agenda estable.',
      d: [
        {
          n: 'Día 1', f: 'Empuje A · pecho, hombro y tríceps',
          cal: '5 min de remadora + rotaciones de hombro y dos aproximaciones al press.',
          car: '',
          e: [
            ['ej_press_banca_barra', 4, '6-8', 150, '3-0-1-0', ''],
            ['ej_press_inclinado_mancuernas', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_press_militar_barra', 3, '8-10', 120, '2-0-1-0', ''],
            ['ej_elevaciones_laterales', 4, '12-15', 60, '2-0-2-0', 'Sin impulso de cadera.'],
            ['ej_extension_triceps_cuerda', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_press_frances', 3, '10-12', 75, '3-0-1-0', 'Codos apuntando al techo.']
          ]
        },
        {
          n: 'Día 2', f: 'Jalón A · espalda y bíceps',
          cal: '5 min de bicicleta + jalón con banda y colgarse 20 s de la barra.',
          car: '',
          e: [
            ['ej_dominadas', 4, '6-10', 150, '2-0-1-1', ''],
            ['ej_remo_barra', 4, '8-10', 120, '2-0-1-1', ''],
            ['ej_jalon_agarre_neutro', 3, '10-12', 90, '2-0-2-1', ''],
            ['ej_remo_sentado_polea', 3, '10-12', 90, '2-1-2-0', ''],
            ['ej_curl_barra', 3, '8-10', 75, '2-0-2-0', ''],
            ['ej_curl_martillo', 3, '10-12', 60, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 3', f: 'Pierna A · fuerza',
          cal: '8 min de bicicleta + movilidad de cadera y tres aproximaciones a la sentadilla.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 5, '5', 180, '3-0-1-0', 'Bloque de fuerza: misma carga en las cinco series.'],
            ['ej_peso_muerto_rumano', 4, '8-10', 120, '3-1-1-0', ''],
            ['ej_prensa_piernas', 4, '10-12', 120, '2-0-2-0', ''],
            ['ej_curl_femoral_acostado', 3, '12-15', 75, '2-1-2-0', ''],
            ['ej_pantorrilla_de_pie', 4, '15-20', 45, '2-1-1-1', ''],
            ['ej_abdominales_maquina', 3, '12-15', 60, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 4', f: 'Empuje B · volumen y aislamiento',
          cal: '5 min de elíptica + activación de manguito rotador con banda.',
          car: '',
          e: [
            ['ej_press_banca_mancuernas', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_press_arnold', 3, '10-12', 90, '2-0-2-0', ''],
            ['ej_cruce_poleas', 3, '12-15', 60, '2-1-2-0', 'Aprieta el pectoral un segundo al cruzar.'],
            ['ej_elevaciones_laterales_polea', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_press_banca_agarre_cerrado', 3, '8-10', 90, '2-0-1-0', ''],
            ['ej_extension_triceps_sobre_cabeza', 3, '12-15', 60, '3-0-1-0', '']
          ]
        },
        {
          n: 'Día 5', f: 'Jalón B · densidad y detalle',
          cal: '6 min de remadora + movilidad torácica y face pull ligero.',
          car: '',
          e: [
            ['ej_peso_muerto_convencional', 4, '5-6', 180, '2-0-1-2', ''],
            ['ej_jalon_agarre_supino', 3, '10-12', 90, '2-0-2-1', ''],
            ['ej_remo_en_t', 3, '10-12', 90, '2-1-2-0', ''],
            ['ej_face_pull', 3, '15-20', 60, '2-1-2-0', 'Codos altos, jala hacia la frente.'],
            ['ej_curl_banco_scott', 3, '10-12', 60, '3-0-2-0', ''],
            ['ej_curl_arana', 3, '12-15', 60, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 6', f: 'Pierna B · glúteo y unilateral',
          cal: '8 min de caminadora en pendiente + activación de glúteo con banda.',
          car: '10 min de caminata ligera al terminar.',
          e: [
            ['ej_sentadilla_frontal', 4, '6-8', 150, '3-0-1-0', ''],
            ['ej_peso_muerto_sumo', 3, '6-8', 150, '2-0-1-1', ''],
            ['ej_sentadilla_bulgara', 3, '10 por pierna', 90, '3-0-1-0', ''],
            ['ej_extension_cuadriceps', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_empuje_cadera_barra', 4, '10-12', 90, '2-1-1-1', 'Barbilla al pecho y pausa arriba.'],
            ['ej_pantorrilla_prensa', 4, '15-20', 45, '2-1-1-1', '']
          ]
        }
      ]
    },
    {
      nombre: 'Hipertrofia 5 días',
      objetivo: 'ganar_musculo', nivel: 'intermedio', dias: 5,
      descripcion: 'División clásica por grupo muscular: un día por zona, alto volumen y trabajo de aislamiento para ganar tamaño.',
      d: [
        {
          n: 'Día 1', f: 'Pecho',
          cal: '5 min de remadora + aperturas con banda y dos aproximaciones al press.',
          car: '',
          e: [
            ['ej_press_banca_barra', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_press_inclinado_mancuernas', 4, '10-12', 90, '3-0-1-0', ''],
            ['ej_aperturas_mancuernas', 3, '12-15', 75, '3-1-1-0', 'Codos ligeramente flexionados y fijos.'],
            ['ej_cruce_poleas', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_pullover_mancuerna', 3, '12-15', 60, '3-0-2-0', ''],
            ['ej_lagartijas', 2, 'al fallo', 60, '2-0-1-0', 'Serie final para terminar de vaciar el pectoral.']
          ]
        },
        {
          n: 'Día 2', f: 'Espalda',
          cal: '5 min de bicicleta + colgarse de la barra y jalón con banda.',
          car: '',
          e: [
            ['ej_dominadas', 4, '6-10', 120, '2-0-1-1', ''],
            ['ej_remo_barra', 4, '8-10', 120, '2-0-1-1', ''],
            ['ej_jalon_al_pecho', 3, '10-12', 90, '2-0-2-1', ''],
            ['ej_remo_mancuerna_una_mano', 3, '10-12', 75, '2-1-2-0', ''],
            ['ej_pullover_polea', 3, '12-15', 60, '2-1-2-0', 'Brazos casi rectos, jala con el dorsal.'],
            ['ej_encogimientos_mancuernas', 3, '12-15', 60, '2-1-1-1', '']
          ]
        },
        {
          n: 'Día 3', f: 'Pierna',
          cal: '8 min de bicicleta + movilidad de cadera y aproximaciones a la sentadilla.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 4, '8-10', 150, '3-0-1-0', ''],
            ['ej_prensa_piernas', 4, '10-12', 120, '2-0-2-0', ''],
            ['ej_curl_femoral_sentado', 3, '12-15', 75, '2-1-2-0', ''],
            ['ej_extension_cuadriceps', 3, '12-15', 75, '2-1-2-0', ''],
            ['ej_peso_muerto_rumano', 3, '10-12', 120, '3-1-1-0', ''],
            ['ej_pantorrilla_de_pie', 4, '15-20', 45, '2-1-1-1', '']
          ]
        },
        {
          n: 'Día 4', f: 'Hombro',
          cal: '5 min de elíptica + rotaciones y elevaciones con banda.',
          car: '',
          e: [
            ['ej_press_militar_sentado', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_elevaciones_laterales', 4, '12-15', 60, '2-0-2-0', ''],
            ['ej_pajaros_mancuernas', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_elevaciones_frontales', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_face_pull', 3, '15-20', 60, '2-1-2-0', ''],
            ['ej_remo_al_menton', 3, '10-12', 75, '2-0-2-0', 'Agarre abierto para cuidar el hombro.']
          ]
        },
        {
          n: 'Día 5', f: 'Brazo y core',
          cal: '5 min de remadora + curl con banda ligero para calentar codo.',
          car: '12 min de caminadora en pendiente para cerrar la semana.',
          e: [
            ['ej_curl_barra_z', 4, '8-10', 75, '2-0-2-0', ''],
            ['ej_curl_martillo', 3, '10-12', 60, '2-0-2-0', ''],
            ['ej_curl_concentrado', 3, '12-15', 60, '3-0-2-0', ''],
            ['ej_press_banca_agarre_cerrado', 4, '8-10', 90, '2-0-1-0', ''],
            ['ej_extension_triceps_cuerda', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_patada_triceps', 3, '12-15', 45, '2-1-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Fuerza 5x5',
      objetivo: 'rendimiento', nivel: 'intermedio', dias: 3,
      descripcion: 'Programa de fuerza sobre los básicos: cinco series de cinco repeticiones con progresión lineal semana a semana.',
      d: [
        {
          n: 'Día 1', f: 'Fuerza A · sentadilla y banca',
          cal: '5 min de bicicleta + movilidad de cadera y tres series de aproximación con barra vacía.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 5, '5', 180, '3-0-1-0', 'Sube 2.5 kg cada semana si salen las cinco series.'],
            ['ej_press_banca_barra', 5, '5', 180, '3-0-1-0', ''],
            ['ej_remo_barra', 5, '5', 150, '2-0-1-1', ''],
            ['ej_fondos_paralelas', 3, '8-10', 90, '2-0-1-0', ''],
            ['ej_plancha_frontal', 3, '45 s', 60, 'isométrico', '']
          ]
        },
        {
          n: 'Día 2', f: 'Fuerza B · militar y peso muerto',
          cal: '5 min de remadora + movilidad torácica y aproximaciones con barra vacía.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 5, '5', 180, '3-0-1-0', ''],
            ['ej_press_militar_barra', 5, '5', 150, '2-0-1-0', ''],
            ['ej_peso_muerto_convencional', 1, '5', 240, '2-0-1-2', 'Una sola serie pesada, técnica impecable.'],
            ['ej_dominadas_asistidas', 3, '8-10', 90, '2-0-1-1', ''],
            ['ej_hiperextensiones', 3, '12-15', 60, '2-1-2-0', '']
          ]
        },
        {
          n: 'Día 3', f: 'Fuerza C · variantes',
          cal: '6 min de caminadora + movilidad de tobillo y muñeca, más aproximaciones.',
          car: '8 min de bicicleta suave al terminar.',
          e: [
            ['ej_sentadilla_frontal', 5, '5', 180, '3-0-1-0', ''],
            ['ej_press_banca_barra', 5, '5', 180, '3-0-1-0', ''],
            ['ej_remo_pendlay', 5, '5', 150, '2-0-1-1', 'Cada repetición arranca del piso.'],
            ['ej_dominadas', 3, 'al fallo', 90, '2-0-1-1', ''],
            ['ej_giro_ruso', 3, '20 total', 45, '2-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Definición + HIIT 5 días',
      objetivo: 'perder_grasa', nivel: 'intermedio', dias: 5,
      descripcion: 'Combina fuerza para conservar músculo con trabajo metabólico e intervalos. Pensado para bajar grasa sin perder rendimiento.',
      d: [
        {
          n: 'Día 1', f: 'Cuerpo completo metabólico',
          cal: '6 min de salto de cuerda suave + movilidad general de cadera y hombro.',
          car: '10 min de intervalos en bicicleta: 30 s fuerte / 60 s suave.',
          e: [
            ['ej_sentadilla_goblet', 4, '12-15', 60, '2-0-2-0', 'Descansos cortos para mantener pulsaciones altas.'],
            ['ej_press_hombros_mancuernas', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_remo_kettlebell', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_swing_kettlebell', 4, '15-20', 60, 'explosivo', 'El impulso sale de la cadera, no de los brazos.'],
            ['ej_burpees', 3, '10-12', 60, 'explosivo', ''],
            ['ej_plancha_frontal', 3, '40 s', 45, 'isométrico', '']
          ]
        },
        {
          n: 'Día 2', f: 'Tren superior',
          cal: '5 min de remadora + activación de hombro con banda.',
          car: '12 min de caminadora en pendiente al 12 %.',
          e: [
            ['ej_press_banca_mancuernas', 4, '10-12', 75, '3-0-1-0', ''],
            ['ej_jalon_al_pecho', 4, '10-12', 75, '2-0-2-1', ''],
            ['ej_press_arnold', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_remo_sentado_polea', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_curl_martillo', 3, '12-15', 45, '2-0-2-0', ''],
            ['ej_extension_triceps_cuerda', 3, '12-15', 45, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 3', f: 'HIIT y core',
          cal: '5 min de movilidad dinámica y trote suave en el lugar.',
          car: '15 min de intervalos: 20 s máximo / 40 s activo, ocho rondas.',
          e: [
            ['ej_salto_de_cuerda', 4, '60 s', 45, 'continuo', ''],
            ['ej_escaladores', 4, '30 s', 45, 'explosivo', ''],
            ['ej_saltos_de_tijera', 4, '45 s', 45, 'continuo', ''],
            ['ej_abdominales_bicicleta', 3, '20 por lado', 45, '2-0-2-0', ''],
            ['ej_plancha_lateral', 3, '30 s por lado', 45, 'isométrico', ''],
            ['ej_bicicleta_de_aire', 4, '30 s fuerte', 60, 'explosivo', 'Brazos y piernas al mismo tiempo.']
          ]
        },
        {
          n: 'Día 4', f: 'Tren inferior',
          cal: '8 min de bicicleta + activación de glúteo con banda.',
          car: '10 min de escaladora a ritmo constante.',
          e: [
            ['ej_prensa_piernas', 4, '12-15', 75, '2-0-2-0', ''],
            ['ej_desplante_caminando', 3, '12 por pierna', 75, '2-0-1-0', ''],
            ['ej_curl_femoral_sentado', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_empuje_cadera_barra', 4, '12-15', 75, '2-1-1-1', ''],
            ['ej_pantorrilla_de_pie', 3, '15-20', 45, '2-1-1-1', ''],
            ['ej_subida_al_cajon', 3, '12 por pierna', 60, '2-0-1-0', '']
          ]
        },
        {
          n: 'Día 5', f: 'Circuito quema-grasa',
          cal: '6 min de movilidad completa y activación con balón medicinal.',
          car: '8 min de remadora al final, ritmo firme.',
          e: [
            ['ej_thruster_barra', 4, '10-12', 60, 'explosivo', 'Circuito: pasa de un ejercicio a otro con poco descanso.'],
            ['ej_cuerdas_de_batalla', 4, '30 s', 45, 'explosivo', ''],
            ['ej_remadora', 3, '250 m', 60, 'continuo', ''],
            ['ej_lanzamiento_balon_pared', 3, '15', 45, 'explosivo', ''],
            ['ej_rodillas_altas', 3, '40 s', 45, 'continuo', ''],
            ['ej_giro_ruso', 3, '24 total', 45, '2-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Glúteos y Piernas 4 días',
      objetivo: 'ganar_musculo', nivel: 'intermedio', dias: 4,
      descripcion: 'Enfocada en cadena posterior y glúteo con dos días de empuje de cadera y dos de cuádriceps. Incluye trabajo de core cada sesión.',
      d: [
        {
          n: 'Día 1', f: 'Glúteo · fuerza',
          cal: '6 min de caminadora en pendiente + caminata lateral con banda y puentes sin peso.',
          car: '',
          e: [
            ['ej_empuje_cadera_barra', 4, '8-10', 120, '2-1-1-1', 'Pausa de un segundo en la contracción.'],
            ['ej_sentadilla_sumo_barra', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_peso_muerto_rumano_mancuernas', 3, '10-12', 90, '3-1-1-0', ''],
            ['ej_patada_gluteo_polea', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_abduccion_maquina', 3, '15-20', 45, '2-1-2-0', ''],
            ['ej_puente_gluteo', 3, '15-20', 45, '2-1-1-1', '']
          ]
        },
        {
          n: 'Día 2', f: 'Cuádriceps',
          cal: '8 min de bicicleta + movilidad de tobillo y aproximaciones a la sentadilla.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 4, '8-10', 150, '3-0-1-0', ''],
            ['ej_prensa_piernas', 4, '10-12', 120, '2-0-2-0', 'Pies bajos y juntos para cargar el cuádriceps.'],
            ['ej_extension_cuadriceps', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_desplante_estatico', 3, '12 por pierna', 75, '2-0-1-0', ''],
            ['ej_subida_al_cajon', 3, '12 por pierna', 60, '2-0-1-0', ''],
            ['ej_pantorrilla_de_pie', 4, '15-20', 45, '2-1-1-1', '']
          ]
        },
        {
          n: 'Día 3', f: 'Glúteo · volumen',
          cal: '6 min de elíptica + activación de glúteo medio con banda.',
          car: '10 min de escaladora al terminar.',
          e: [
            ['ej_empuje_cadera_una_pierna', 3, '12 por pierna', 75, '2-1-1-1', ''],
            ['ej_sentadilla_bulgara', 4, '10 por pierna', 90, '3-0-1-0', ''],
            ['ej_patada_burro', 3, '15 por pierna', 45, '2-1-2-0', ''],
            ['ej_caminata_lateral_banda', 3, '20 pasos por lado', 45, 'continuo', ''],
            ['ej_hiperextension_gluteo', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_abduccion_cuadrupedia', 3, '15 por lado', 45, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 4', f: 'Femoral y core',
          cal: '6 min de bicicleta + movilidad de cadera y balanceos de pierna.',
          car: '',
          e: [
            ['ej_curl_femoral_acostado', 4, '12-15', 75, '2-1-2-0', ''],
            ['ej_peso_muerto_una_pierna', 3, '10 por pierna', 75, '3-0-1-0', 'Cadera nivelada, sin abrir el costado.'],
            ['ej_buenos_dias', 3, '10-12', 90, '3-0-1-0', 'Carga ligera, prioriza el rango.'],
            ['ej_puente_gluteo_banda', 3, '15-20', 45, '2-1-1-1', ''],
            ['ej_plancha_frontal', 3, '45 s', 45, 'isométrico', ''],
            ['ej_bicho_muerto', 3, '12 por lado', 45, '2-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Adulto Mayor Movilidad',
      objetivo: 'salud', nivel: 'principiante', dias: 3,
      descripcion: 'Programa seguro para adultos mayores: fuerza en máquinas, equilibrio, movilidad articular y cardio de bajo impacto.',
      d: [
        {
          n: 'Día 1', f: 'Fuerza suave y equilibrio',
          cal: '8 min de caminata en plano + movilidad de cuello, hombro y tobillo.',
          car: '10 min de caminadora sin pendiente, ritmo conversado.',
          e: [
            ['ej_caminadora_caminata', 1, '10 min', 0, 'continuo', 'Sin sujetarse de los barandales si es seguro.'],
            ['ej_sentadilla_pared', 3, '20-30 s', 60, 'isométrico', 'Baja solo hasta donde no haya molestia.'],
            ['ej_press_pecho_maquina', 3, '10-12', 75, '2-0-2-0', 'Carga ligera, respiración controlada.'],
            ['ej_remo_sentado_polea', 3, '10-12', 75, '2-1-2-0', ''],
            ['ej_gato_camello', 2, '10', 45, '3-0-3-0', ''],
            ['ej_estiramiento_isquiotibiales', 2, '30 s por pierna', 30, 'isométrico', '']
          ]
        },
        {
          n: 'Día 2', f: 'Tren inferior y postura',
          cal: '8 min de bicicleta estática + movilidad de cadera sentado.',
          car: '8 min de bicicleta ligera de cierre.',
          e: [
            ['ej_bicicleta_estatica', 1, '10 min', 0, 'continuo', 'Resistencia baja.'],
            ['ej_prensa_piernas', 3, '12-15', 75, '2-0-2-0', 'Rango parcial si hay molestia de rodilla.'],
            ['ej_jalon_al_pecho', 3, '10-12', 75, '2-0-2-1', ''],
            ['ej_elevaciones_laterales_banda', 3, '12-15', 60, '2-0-2-0', ''],
            ['ej_puente_gluteo', 3, '10-12', 60, '2-1-1-1', ''],
            ['ej_postura_del_nino', 2, '40 s', 30, 'isométrico', '']
          ]
        },
        {
          n: 'Día 3', f: 'Movilidad y marcha',
          cal: '8 min de elíptica muy ligera + círculos de cadera y hombro.',
          car: '10 min de elíptica de bajo impacto.',
          e: [
            ['ej_eliptica', 1, '10 min', 0, 'continuo', ''],
            ['ej_subida_al_cajon', 3, '8 por pierna', 75, '2-0-2-0', 'Cajón bajo y apoyo cerca por seguridad.'],
            ['ej_lagartijas_manos_elevadas', 3, '8-10', 75, '2-0-2-0', 'Apoyo en barra o banca alta.'],
            ['ej_movilidad_hombros_banda', 3, '10', 45, '3-0-3-0', ''],
            ['ej_cadera_90_90', 2, '8 por lado', 45, '3-0-3-0', ''],
            ['ej_estiramiento_gemelos', 2, '30 s por pierna', 30, 'isométrico', '']
          ]
        }
      ]
    },
    {
      nombre: 'Recomposición Femenina 4 días',
      objetivo: 'mantener', nivel: 'intermedio', dias: 4,
      descripcion: 'Dos días de tren inferior y dos de superior para bajar grasa mientras se gana tono y fuerza. La favorita de las socias del gimnasio.',
      d: [
        {
          n: 'Día 1', f: 'Inferior · cadena posterior',
          cal: '6 min de caminadora en pendiente + activación de glúteo con banda.',
          car: '10 min de escaladora al terminar.',
          e: [
            ['ej_empuje_cadera_barra', 4, '10-12', 90, '2-1-1-1', ''],
            ['ej_sentadilla_goblet', 4, '10-12', 90, '3-0-1-0', ''],
            ['ej_peso_muerto_rumano_mancuernas', 3, '10-12', 90, '3-1-1-0', ''],
            ['ej_abduccion_maquina', 3, '15-20', 45, '2-1-2-0', ''],
            ['ej_pantorrilla_de_pie', 3, '15-20', 45, '2-1-1-1', ''],
            ['ej_plancha_frontal', 3, '40 s', 45, 'isométrico', '']
          ]
        },
        {
          n: 'Día 2', f: 'Superior · empuje',
          cal: '5 min de remadora + rotaciones de hombro con banda.',
          car: '',
          e: [
            ['ej_press_banca_mancuernas', 4, '10-12', 90, '3-0-1-0', ''],
            ['ej_press_hombros_mancuernas', 3, '10-12', 75, '2-0-2-0', ''],
            ['ej_cruce_poleas_bajo', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_elevaciones_laterales', 3, '12-15', 45, '2-0-2-0', ''],
            ['ej_extension_triceps_cuerda', 3, '12-15', 45, '2-0-2-0', ''],
            ['ej_lagartijas_manos_elevadas', 3, '10-12', 60, '2-0-1-0', '']
          ]
        },
        {
          n: 'Día 3', f: 'Inferior · cuádriceps',
          cal: '8 min de bicicleta + movilidad de tobillo y cadera.',
          car: '',
          e: [
            ['ej_sentadilla_smith', 4, '10-12', 90, '3-0-1-0', ''],
            ['ej_prensa_piernas', 4, '12-15', 90, '2-0-2-0', ''],
            ['ej_extension_cuadriceps', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_desplante_inverso', 3, '10 por pierna', 75, '2-0-1-0', ''],
            ['ej_curl_femoral_sentado', 3, '12-15', 60, '2-1-2-0', ''],
            ['ej_caminata_lateral_banda', 3, '20 pasos por lado', 45, 'continuo', '']
          ]
        },
        {
          n: 'Día 4', f: 'Superior · jalón y core',
          cal: '5 min de elíptica + jalón con banda y movilidad torácica.',
          car: '12 min de caminadora en pendiente al 10 %.',
          e: [
            ['ej_jalon_al_pecho', 4, '10-12', 90, '2-0-2-1', ''],
            ['ej_remo_sentado_polea', 3, '10-12', 75, '2-1-2-0', ''],
            ['ej_remo_mancuerna_una_mano', 3, '10-12', 75, '2-1-2-0', ''],
            ['ej_face_pull', 3, '15-20', 45, '2-1-2-0', ''],
            ['ej_curl_mancuernas_alterno', 3, '12-15', 45, '2-0-2-0', ''],
            ['ej_giro_ruso', 3, '20 total', 45, '2-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Volumen Avanzado 6 días',
      objetivo: 'ganar_musculo', nivel: 'avanzado', dias: 6,
      descripcion: 'Bloque de volumen para socios con base sólida: seis sesiones, alto tonelaje semanal y trabajo fino de puntos débiles.',
      d: [
        {
          n: 'Día 1', f: 'Pecho y tríceps',
          cal: '6 min de remadora + aperturas con banda y aproximaciones progresivas.',
          car: '',
          e: [
            ['ej_press_banca_barra', 5, '6-8', 150, '3-0-1-0', ''],
            ['ej_press_inclinado_barra', 4, '8-10', 120, '3-0-1-0', ''],
            ['ej_aperturas_inclinadas_mancuernas', 3, '12-15', 75, '3-1-1-0', ''],
            ['ej_fondos_paralelas_pecho', 3, '8-12', 90, '2-0-1-0', 'Torso inclinado al frente.'],
            ['ej_press_frances', 4, '10-12', 75, '3-0-1-0', ''],
            ['ej_extension_triceps_polea', 3, '12-15', 60, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 2', f: 'Espalda y bíceps',
          cal: '6 min de bicicleta + colgarse de la barra y jalón con banda.',
          car: '',
          e: [
            ['ej_peso_muerto_convencional', 4, '5-6', 210, '2-0-1-2', ''],
            ['ej_dominadas_supinas', 4, '8-10', 120, '2-0-1-1', ''],
            ['ej_remo_en_t', 4, '8-10', 120, '2-1-2-0', ''],
            ['ej_jalon_agarre_neutro', 3, '10-12', 90, '2-0-2-1', ''],
            ['ej_curl_barra', 4, '8-10', 75, '2-0-2-0', ''],
            ['ej_curl_inclinado', 3, '10-12', 60, '3-0-2-0', '']
          ]
        },
        {
          n: 'Día 3', f: 'Pierna · cuádriceps',
          cal: '10 min de bicicleta + movilidad de cadera y cuatro aproximaciones.',
          car: '',
          e: [
            ['ej_sentadilla_barra', 5, '6-8', 180, '3-0-1-0', ''],
            ['ej_sentadilla_hack', 4, '10-12', 120, '3-0-1-0', ''],
            ['ej_prensa_piernas', 4, '12-15', 120, '2-0-2-0', ''],
            ['ej_extension_cuadriceps', 4, '12-15', 60, '2-1-2-0', ''],
            ['ej_pantorrilla_de_pie', 5, '12-15', 45, '2-1-1-1', ''],
            ['ej_abdominales_en_v', 3, '15-20', 45, '2-0-2-0', '']
          ]
        },
        {
          n: 'Día 4', f: 'Hombro y trapecio',
          cal: '5 min de elíptica + activación de manguito rotador.',
          car: '',
          e: [
            ['ej_press_militar_barra', 4, '6-8', 150, '3-0-1-0', ''],
            ['ej_press_arnold', 3, '10-12', 90, '2-0-2-0', ''],
            ['ej_elevaciones_laterales_polea', 4, '12-15', 60, '2-0-2-0', ''],
            ['ej_pajaros_mancuernas', 4, '12-15', 60, '2-1-2-0', ''],
            ['ej_encogimientos_barra', 4, '10-12', 75, '2-1-1-1', ''],
            ['ej_face_pull', 3, '15-20', 45, '2-1-2-0', '']
          ]
        },
        {
          n: 'Día 5', f: 'Brazos',
          cal: '5 min de remadora + curl y extensión con banda para calentar el codo.',
          car: '',
          e: [
            ['ej_curl_barra_z', 4, '8-10', 75, '2-0-2-0', ''],
            ['ej_curl_banco_scott', 3, '10-12', 60, '3-0-2-0', ''],
            ['ej_curl_21', 2, '21', 75, 'continuo', 'Siete abajo, siete arriba, siete completas.'],
            ['ej_press_banca_agarre_cerrado', 4, '8-10', 90, '2-0-1-0', ''],
            ['ej_extension_triceps_sobre_cabeza', 3, '12-15', 60, '3-0-1-0', ''],
            ['ej_fondos_en_banca', 3, '12-15', 60, '2-0-1-0', '']
          ]
        },
        {
          n: 'Día 6', f: 'Femoral, glúteo y core',
          cal: '8 min de caminadora en pendiente + activación de glúteo con banda.',
          car: '10 min de caminata ligera de cierre semanal.',
          e: [
            ['ej_peso_muerto_rumano', 4, '8-10', 120, '3-1-1-0', ''],
            ['ej_curl_femoral_acostado', 4, '12-15', 75, '2-1-2-0', ''],
            ['ej_empuje_cadera_barra', 4, '10-12', 90, '2-1-1-1', ''],
            ['ej_sentadilla_bulgara', 3, '10 por pierna', 90, '3-0-1-0', ''],
            ['ej_pantorrilla_sentado', 4, '15-20', 45, '2-1-1-1', ''],
            ['ej_rueda_abdominal', 3, '10-12', 60, '3-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Funcional 3 días',
      objetivo: 'rendimiento', nivel: 'intermedio', dias: 3,
      descripcion: 'Patrones de movimiento reales: cargar, empujar, jalar y desplazarse. Mejora la condición general y el core sin aburrir.',
      d: [
        {
          n: 'Día 1', f: 'Empuje, jalón y core',
          cal: '6 min de salto de cuerda + movilidad de cadera, hombro y muñeca.',
          car: '8 min de remadora al terminar.',
          e: [
            ['ej_swing_kettlebell', 4, '15-20', 60, 'explosivo', ''],
            ['ej_cargada_y_press_mancuernas', 4, '8-10', 75, 'explosivo', ''],
            ['ej_remo_renegado', 3, '8 por lado', 60, '2-1-2-0', 'Cadera quieta, sin girar el torso.'],
            ['ej_caminata_granjero', 3, '30 m', 75, 'continuo', ''],
            ['ej_burpees', 3, '10-12', 60, 'explosivo', ''],
            ['ej_pallof_press', 3, '12 por lado', 45, '2-1-2-0', '']
          ]
        },
        {
          n: 'Día 2', f: 'Fuerza global y estabilidad',
          cal: '6 min de movilidad dinámica + levantada turca ligera de aproximación.',
          car: '',
          e: [
            ['ej_levantada_turca', 3, '4 por lado', 90, 'controlado', 'Un paso a la vez; carga ligera.'],
            ['ej_sentadilla_press_mancuernas', 4, '10-12', 75, 'explosivo', ''],
            ['ej_arrastre_de_oso', 3, '15 m', 60, 'continuo', ''],
            ['ej_cuerdas_de_batalla', 4, '30 s', 45, 'explosivo', ''],
            ['ej_salto_al_cajon', 4, '8', 75, 'explosivo', 'Baja caminando, nunca saltando.'],
            ['ej_posicion_hueca', 3, '30 s', 45, 'isométrico', '']
          ]
        },
        {
          n: 'Día 3', f: 'Potencia y condición',
          cal: '6 min de trote suave + movilidad de cadera y activación de core.',
          car: '10 min de intervalos en bicicleta de aire.',
          e: [
            ['ej_empuje_de_trineo', 4, '20 m', 90, 'explosivo', ''],
            ['ej_thruster_barra', 4, '8-10', 90, 'explosivo', ''],
            ['ej_azote_de_balon', 4, '12-15', 45, 'explosivo', ''],
            ['ej_lanzamiento_balon_pared', 3, '15', 45, 'explosivo', ''],
            ['ej_escaladores', 3, '40 s', 45, 'explosivo', ''],
            ['ej_giro_ruso', 3, '24 total', 45, '2-0-2-0', '']
          ]
        }
      ]
    },
    {
      nombre: 'Express 30 min',
      objetivo: 'mantener', nivel: 'principiante', dias: 3,
      descripcion: 'Sesiones de media hora para quien entrena en su hora de comida: cinco ejercicios encadenados y descansos cortos.',
      d: [
        {
          n: 'Día 1', f: 'Cuerpo completo rápido A',
          cal: '4 min de bicicleta y movilidad breve de cadera y hombro.',
          car: '',
          e: [
            ['ej_sentadilla_goblet', 3, '12', 45, '2-0-2-0', 'Encadena los ejercicios con 45 s de descanso.'],
            ['ej_press_banca_mancuernas', 3, '12', 45, '2-0-2-0', ''],
            ['ej_remo_mancuerna_una_mano', 3, '12 por lado', 45, '2-1-2-0', ''],
            ['ej_desplante_estatico', 3, '10 por pierna', 45, '2-0-1-0', ''],
            ['ej_plancha_frontal', 3, '40 s', 30, 'isométrico', '']
          ]
        },
        {
          n: 'Día 2', f: 'Cuerpo completo rápido B',
          cal: '4 min de elíptica y activación de hombro con banda.',
          car: '',
          e: [
            ['ej_prensa_piernas', 3, '12-15', 45, '2-0-2-0', ''],
            ['ej_jalon_al_pecho', 3, '12', 45, '2-0-2-1', ''],
            ['ej_press_hombros_maquina', 3, '12', 45, '2-0-2-0', ''],
            ['ej_curl_mancuernas_alterno', 3, '12', 40, '2-0-2-0', ''],
            ['ej_abdominales_crunch', 3, '20', 30, '2-0-1-1', '']
          ]
        },
        {
          n: 'Día 3', f: 'Cuerpo completo rápido C',
          cal: '4 min de caminadora en pendiente y movilidad de cadera.',
          car: '6 min de caminadora en pendiente si sobra tiempo.',
          e: [
            ['ej_peso_muerto_rumano_mancuernas', 3, '12', 45, '3-0-1-0', ''],
            ['ej_lagartijas', 3, '12-15', 45, '2-0-1-0', ''],
            ['ej_remo_maquina', 3, '12', 45, '2-1-2-0', ''],
            ['ej_elevaciones_laterales', 3, '15', 40, '2-0-2-0', ''],
            ['ej_escaladores', 3, '40 s', 30, 'explosivo', '']
          ]
        }
      ]
    }
  ];

  /** Convierte la notación compacta en rutinas completas del contrato. */
  function construirRutinas(coaches, hoy) {
    return RUTINAS_DEF.map(function (def, i) {
      var autor = coaches[i % coaches.length];
      return {
        id: 'r_' + relleno(i + 1, 4),
        nombre: def.nombre,
        objetivo: def.objetivo,
        nivel: def.nivel,
        diasPorSemana: def.dias,
        descripcion: def.descripcion,
        creadaPor: autor ? autor.id : 'u_0002',
        creada: sumaDias(sumaMeses(hoy, -(6 - (i % 5))), ent(1, 20)),
        esPlantilla: true,
        dias: def.d.map(function (dia) {
          return {
            nombre: dia.n,
            enfoque: dia.f,
            calentamiento: dia.cal,
            cardio: dia.car || '',
            ejercicios: dia.e.map(function (e) {
              return {
                ejercicioId: e[0],
                series: e[1],
                reps: e[2],
                descansoSeg: e[3],
                tempo: e[4],
                peso: '',
                notas: e[5] || ''
              };
            })
          };
        })
      };
    });
  }

  /* =============================================================
     8. Plantillas de comidas (ids reales de AG.Data.foods)
     Cada renglón es [alimentoId, gramosBase]; el generador escala
     los gramos para cuadrar con las kcal de la comida.
     ============================================================= */

  var PLANTILLAS_COMIDA = {
    'Desayuno': [
      [['al_clara_huevo', 120], ['al_huevo_entero', 55], ['al_avena', 50], ['al_platano', 100]],
      [['al_avena', 60], ['al_whey', 30], ['al_crema_cacahuate', 15], ['al_fresa', 120]],
      [['al_huevo_entero', 110], ['al_frijol_negro', 80], ['al_tortilla_maiz', 60], ['al_aguacate', 40]],
      [['al_yogur_griego', 170], ['al_granola', 40], ['al_manzana', 150]],
      [['al_avena_platano', 300], ['al_clara_huevo', 120]]
    ],
    'Colación': [
      [['al_yogur_griego', 150], ['al_almendra', 20]],
      [['al_barra_proteina', 50], ['al_manzana', 150]],
      [['al_requeson', 120], ['al_nuez', 15], ['al_manzana', 120]],
      [['al_whey', 30], ['al_platano', 100]],
      [['al_queso_panela', 60], ['al_jitomate', 100], ['al_tostada_maiz', 20]]
    ],
    'Comida': [
      [['al_pechuga_pollo', 180], ['al_arroz_integral', 150], ['al_brocoli', 120], ['al_aceite_oliva', 8]],
      [['al_bistec_res', 160], ['al_papa_cocida', 180], ['al_ensalada_nopales', 120]],
      [['al_tilapia', 180], ['al_quinoa', 140], ['al_calabacita', 130], ['al_aguacate', 40]],
      [['al_bowl_pollo_arroz', 340], ['al_espinaca', 70]],
      [['al_atun_agua', 150], ['al_pasta_cocida', 160], ['al_jitomate', 110], ['al_aceite_oliva', 8]],
      [['al_pechuga_pavo', 170], ['al_camote', 160], ['al_brocoli', 120], ['al_aceite_oliva', 7]]
    ],
    'Pre-entreno': [
      [['al_avena', 40], ['al_platano', 110]],
      [['al_pan_integral', 60], ['al_crema_cacahuate', 16]],
      [['al_tortilla_maiz', 60], ['al_pechuga_pavo', 70]],
      [['al_manzana', 160], ['al_almendra', 18]]
    ],
    'Cena': [
      [['al_salmon', 150], ['al_camote', 150], ['al_espinaca', 90]],
      [['al_atun_agua', 130], ['al_tostada_maiz', 30], ['al_aguacate', 50]],
      [['al_queso_panela', 90], ['al_nopal', 150], ['al_jitomate', 100], ['al_aceite_oliva', 6]],
      [['al_pechuga_pollo', 150], ['al_ensalada_nopales', 150], ['al_tortilla_maiz', 60]],
      [['al_tilapia', 170], ['al_calabacita', 150], ['al_arroz_integral', 110]]
    ],
    'Colación nocturna': [
      [['al_caseina', 30], ['al_leche_descremada', 200]],
      [['al_queso_cottage', 150], ['al_nuez', 15]],
      [['al_yogur_griego', 160], ['al_almendra', 15]]
    ]
  };

  /* Alimentos que se sirven en cantidades pequeñas: se redondean fino. */
  var GRAMAJE_FINO = {
    al_aceite_oliva: [4, 25], al_crema_cacahuate: [8, 35], al_almendra: [10, 40],
    al_nuez: [10, 40], al_whey: [20, 60], al_caseina: [20, 50], al_aguacate: [25, 90]
  };

  /** kcal de un alimento en los gramos indicados (0 si el id no existe). */
  function kcalDe(alimentoId, gramos) {
    var a = (AG.Data && typeof AG.Data.alimento === 'function') ? AG.Data.alimento(alimentoId) : null;
    if (!a) return 0;
    return (Number(a.kcal) || 0) * (Number(gramos) || 0) / 100;
  }

  /**
   * Construye una comida real escalando la plantilla a las kcal objetivo.
   * @returns {{nombre:String, hora:String, alimentos:Array}}
   */
  function construirComida(nombre, hora, kcalObjetivo, indiceVariante) {
    var variantes = PLANTILLAS_COMIDA[nombre] || PLANTILLAS_COMIDA['Comida'];
    var plantilla = variantes[indiceVariante % variantes.length];

    var kcalPlantilla = 0, i;
    for (i = 0; i < plantilla.length; i++) kcalPlantilla += kcalDe(plantilla[i][0], plantilla[i][1]);

    var factor = kcalPlantilla > 0 ? acotar(kcalObjetivo / kcalPlantilla, 0.55, 1.9) : 1;

    var alimentos = [];
    for (i = 0; i < plantilla.length; i++) {
      var id = plantilla[i][0];
      var base = plantilla[i][1] * factor;
      var limites = GRAMAJE_FINO[id];
      var gramos;
      if (limites) {
        gramos = Math.round(acotar(base, limites[0], limites[1]));
      } else {
        gramos = Math.round(acotar(base, 15, 400) / 5) * 5;
      }
      if (gramos > 0) alimentos.push({ alimentoId: id, gramos: gramos });
    }
    return { nombre: nombre, hora: hora, alimentos: alimentos };
  }

  var NOTAS_NUTRICION = [
    'Toma el agua repartida a lo largo del día, no toda de golpe en la noche. Si un día se te complica una comida, prioriza la proteína.',
    'Puedes intercambiar el pollo por pavo, atún o pescado en la misma cantidad. Las verduras son libres, no las cuentes.',
    'Los domingos puedes hacer una comida libre respetando la proteína del día. Vuelve al plan en la siguiente comida, sin castigos.',
    'Deja lista la proteína cocida de dos días. La adherencia se gana en la cocina, no en el gimnasio.',
    'Si entrenas en la mañana, mueve el pre-entreno al desayuno y recorre las demás comidas. La suma del día es lo que importa.',
    'Sube 200 ml de agua los días de entrenamiento fuerte. Si te da hambre por la tarde, agrega verdura y no carbohidrato.'
  ];

  /* =============================================================
     9. Textos de calificaciones, avisos y clases
     ============================================================= */

  var COMENTARIOS_COACH = {
    5: [
      'Excelente coach. Me corrige la técnica en cada serie y explica el porqué de cada ejercicio.',
      'Nunca me deja solo en el piso. Se nota que le importa que uno avance de verdad.',
      'Me cambió la rutina cuando me estanqué y en dos meses ya vi diferencia. Muy recomendable.',
      'Muy puntual y siempre con buena actitud, hasta en el turno de las seis de la mañana.',
      'Me tuvo paciencia cuando llegué sin saber nada. Hoy entreno con confianza gracias a él.',
      'Le entiendo todo lo que explica, sin palabras raras. Se toma el tiempo de enseñar.',
      'Me ajustó los ejercicios por mi lesión de rodilla y nunca sentí molestia. Muy profesional.',
      'La mejor decisión fue cambiarme con este coach. Motivación y conocimiento en partes iguales.'
    ],
    4: [
      'Muy buen entrenador, solo que a veces trae muchos socios a la vez y hay que esperarlo.',
      'Sabe mucho y explica bien. Me gustaría que diera un poco más de seguimiento por mensaje.',
      'Buen coach, cumplidor. La rutina que me armó está bien pensada para mi horario.',
      'Me ayuda bastante en el piso. A veces se le pasa revisar la bitácora, pero cumple.',
      'Buena atención y buen ambiente. Le falta poquito más de seguimiento a la alimentación.',
      'Contento con el avance. Solo pediría que las mediciones fueran siempre el mismo día.'
    ],
    3: [
      'Sabe de lo suyo, pero se le juntan muchos socios y el seguimiento se diluye.',
      'La rutina está bien, aunque siento que es la misma que le dio a otros compañeros.',
      'Cumple, pero me gustaría más explicación de por qué hacemos cada cosa.',
      'A veces llega tarde a la primera sesión de la mañana y se recorre todo.'
    ],
    2: [
      'Buena actitud, pero en el horario pico casi no puede atender y uno queda perdido.',
      'Me costó que me actualizara la rutina; estuve dos meses con la misma sin cambios.'
    ]
  };

  var COMENTARIOS_GYM = {
    5: [
      'Excelente gimnasio: limpio, con equipo nuevo y personal que sí saluda y ayuda.',
      'La mejor relación precio-calidad de la zona. Las clases grupales están muy bien dadas.',
      'Siempre hay lugar en las máquinas fuera del horario pico y todo está en buen estado.',
      'Me encanta el ambiente. No es un lugar donde te sientas juzgado por estar empezando.',
      'Las regaderas siempre con agua caliente y limpias. Se nota el mantenimiento diario.',
      'Buen equipo de peso libre, discos completos y barras en buen estado. Muy recomendable.',
      'La app para ver mi rutina y mis mediciones es un plus enorme. Muy ordenado todo.'
    ],
    4: [
      'Muy buen gimnasio. Solo faltarían un par de bancas más para el horario de la tarde.',
      'Buenas instalaciones y buen ambiente. La música a veces está demasiado alta.',
      'Todo bien en general; el estacionamiento se llena rápido después de las siete.',
      'Buen lugar, buen equipo. Agregaría una segunda prensa de piernas.',
      'Muy limpio y ordenado. Me gustaría que abrieran más temprano los domingos.',
      'Buena atención en recepción y buen mantenimiento del equipo de cardio.'
    ],
    3: [
      'Está bien, pero de 19:00 a 21:00 hay que hacer fila para casi todo.',
      'El equipo es bueno, aunque un par de máquinas llevan semanas con el letrero de reparación.',
      'Buen precio, aunque las regaderas se saturan a la hora pico.'
    ],
    2: [
      'De 19:00 a 20:30 es imposible entrenar tranquilo: falta equipo para tanta gente. Si abrieran otra zona de mancuernas mejoraría muchísimo.',
      'Las regaderas necesitan mantenimiento urgente: dos llevan semanas sin presión de agua y en la tarde se hacen filas.'
    ]
  };

  var RESPUESTAS_DIRECCION = [
    'Gracias por tu comentario. Ya programamos el mantenimiento y te avisamos en cuanto quede listo.',
    'Agradecemos la crítica. Estamos ajustando la plantilla de coaches en el horario de la tarde.',
    'Qué gusto leerte. Le pasamos tu comentario a tu coach, se lo ganó a pulso.',
    'Gracias por tomarte el tiempo. Compramos equipo adicional que llega el próximo mes.',
    'Tomamos nota del punto de las regaderas; ya está contratado el servicio de plomería.',
    'Nos alegra mucho tu avance. Cualquier cosa que necesites, estamos en recepción.',
    'Gracias por la confianza. Vamos a abrir un turno extra para descongestionar la hora pico.'
  ];

  var AVISOS_DEF = [
    {
      titulo: 'Mantenimiento de regaderas del vestidor de hombres',
      cuerpo: 'El próximo martes de 6:00 a 11:00 estaremos cambiando las llaves y regaderas del vestidor de hombres. Durante esas horas quedará habilitado el vestidor alterno de la planta alta. Agradecemos tu paciencia: el trabajo dura un solo día y queda resuelto el tema de la presión de agua que nos han reportado.',
      para: 'todos', prioridad: 'alta', diasAtras: 4
    },
    {
      titulo: 'Nuevo horario de clases grupales',
      cuerpo: 'A partir del lunes ajustamos el horario de clases: Spinning se recorre a las 6:30, Zumba entra a las 18:00 y agregamos una sesión extra de HIIT los miércoles a las 19:30. El cuadro completo lo puedes consultar en la sección de Clases o en la pizarra de recepción.',
      para: 'todos', prioridad: 'normal', diasAtras: 11
    },
    {
      titulo: 'Reto de verano Alliance: 8 semanas',
      cuerpo: 'Arranca el reto de ocho semanas. Se mide al inicio y al cierre; gana quien logre el mejor cambio combinado de grasa y músculo, no quien baje más kilos. La inscripción es gratuita para socios activos y el premio es una membresía semestral. Apúntate con tu coach antes del viernes.',
      para: 'socios', prioridad: 'alta', diasAtras: 19
    },
    {
      titulo: 'Promoción de referidos: trae a quien te aguante el ritmo',
      cuerpo: 'Por cada persona que traigas y se inscriba con plan mensual o mayor, te regalamos 15 días de membresía. Tu invitado se lleva la inscripción sin costo. La promoción es acumulable hasta tres referidos por socio y aplica durante todo el mes.',
      para: 'socios', prioridad: 'normal', diasAtras: 26
    },
    {
      titulo: 'Cierre por día festivo',
      cuerpo: 'El próximo lunes festivo el gimnasio abre en horario reducido de 8:00 a 14:00 y no habrá clases grupales. El personal de mantenimiento aprovechará la tarde para dar servicio al equipo de cardio. Planea tu semana para no perder tu sesión.',
      para: 'todos', prioridad: 'normal', diasAtras: 33
    },
    {
      titulo: 'Llegó equipo nuevo a la zona de peso libre',
      cuerpo: 'Ya están montadas dos bancas ajustables, un rack de sentadilla adicional y el juego de mancuernas de 42 a 50 kg. También cambiamos los discos rotos de la zona de peso muerto. Si necesitas que te expliquen el uso de algún equipo, pídele a tu coach que te dé el recorrido.',
      para: 'todos', prioridad: 'normal', diasAtras: 47
    }
  ];

  var CLASES_DEF = [
    { nombre: 'HIIT', coach: 0, dia: 'lunes', hora: '06:00', dur: 45, cupo: 20, salon: 'Salón 1', color: '#e4322b' },
    { nombre: 'Spinning', coach: 4, dia: 'lunes', hora: '07:00', dur: 50, cupo: 22, salon: 'Salón 2', color: '#f0a03c' },
    { nombre: 'Funcional', coach: 4, dia: 'lunes', hora: '19:00', dur: 55, cupo: 18, salon: 'Zona funcional', color: '#3fbf7f' },
    { nombre: 'Zumba', coach: 2, dia: 'martes', hora: '18:00', dur: 55, cupo: 25, salon: 'Salón 2', color: '#ec4899' },
    { nombre: 'Box', coach: 0, dia: 'martes', hora: '20:00', dur: 60, cupo: 16, salon: 'Área de costales', color: '#eab308' },
    { nombre: 'Yoga', coach: 3, dia: 'miércoles', hora: '07:30', dur: 60, cupo: 15, salon: 'Salón 3', color: '#9b7bf0' },
    { nombre: 'GAP', coach: 1, dia: 'miércoles', hora: '18:00', dur: 45, cupo: 22, salon: 'Salón 2', color: '#ef5da8' },
    { nombre: 'HIIT', coach: 4, dia: 'miércoles', hora: '19:30', dur: 45, cupo: 20, salon: 'Salón 1', color: '#e4322b' },
    { nombre: 'Spinning', coach: 4, dia: 'jueves', hora: '06:30', dur: 50, cupo: 22, salon: 'Salón 2', color: '#f0a03c' },
    { nombre: 'GAP', coach: 2, dia: 'jueves', hora: '18:00', dur: 45, cupo: 22, salon: 'Salón 3', color: '#ef5da8' },
    { nombre: 'Crossfit', coach: 0, dia: 'viernes', hora: '19:00', dur: 60, cupo: 14, salon: 'Zona funcional', color: '#5aa9f0' },
    { nombre: 'Zumba', coach: 2, dia: 'viernes', hora: '18:00', dur: 55, cupo: 25, salon: 'Salón 2', color: '#ec4899' },
    { nombre: 'Funcional', coach: 4, dia: 'sábado', hora: '09:00', dur: 55, cupo: 18, salon: 'Zona funcional', color: '#3fbf7f' },
    { nombre: 'Yoga', coach: 3, dia: 'sábado', hora: '10:30', dur: 60, cupo: 15, salon: 'Salón 3', color: '#9b7bf0' }
  ];

  /* =============================================================
     10. Generadores del padrón
     ============================================================= */

  /** Reparto de estados: 34 activos, 6 vencidos, 2 congelados, 3 bajas. */
  function repartoEstados() {
    var lista = [], i;
    for (i = 0; i < 33; i++) lista.push('activo');   /* +1 forzado para Ana Sofía */
    for (i = 0; i < 6; i++) lista.push('vencido');
    for (i = 0; i < 2; i++) lista.push('congelado');
    for (i = 0; i < 3; i++) lista.push('baja');
    return barajar(lista);
  }

  /** Reparto de antigüedades entre 1 y 8 meses para los 44 socios restantes. */
  function repartoAntiguedades() {
    var pool = [], i;
    var receta = [[8, 6], [7, 5], [6, 6], [5, 6], [4, 6], [3, 6], [2, 5], [1, 4]];
    for (i = 0; i < receta.length; i++) {
      for (var j = 0; j < receta[i][1]; j++) pool.push(receta[i][0]);
    }
    return barajar(pool);
  }

  /** Elige el coach adecuado según el perfil del socio, equilibrando cupos. */
  function elegirCoach(socio, coaches, carga) {
    var edad = socio.edadCalculada;
    var preferido;

    var conRehabilitacion = /hernia|lumbal|condromalacia|tendinitis/i.test(socio.padecimientos || '');

    if (edad >= 60 || (edad >= 48 && conRehabilitacion)) {
      preferido = 'u_0005';                                  /* Ricardo */
    } else if (socio.objetivo === 'rendimiento') {
      preferido = 'u_0006';                                  /* Iván */
    } else if (socio.objetivo === 'ganar_musculo') {
      preferido = (socio.sexo === 'M' && probable(0.5)) ? 'u_0004' : 'u_0002';
    } else if (socio.sexo === 'M' && probable(0.45)) {
      preferido = 'u_0004';                                  /* Paulina */
    } else if (socio.objetivo === 'perder_grasa') {
      preferido = probable(0.45) ? 'u_0003' : (probable(0.5) ? 'u_0006' : 'u_0002');
    } else if (socio.objetivo === 'salud') {
      preferido = probable(0.5) ? 'u_0005' : 'u_0003';
    } else {                                                 /* mantener */
      preferido = probable(0.5) ? 'u_0002' : 'u_0003';
    }

    var cupo = {};
    for (var i = 0; i < coaches.length; i++) cupo[coaches[i].id] = coaches[i].cupoMaximo;

    if ((carga[preferido] || 0) < cupo[preferido]) return preferido;

    /* Si el preferido está lleno, se asigna al coach con más lugar disponible. */
    var mejor = coaches[0].id, libreMejor = -Infinity;
    for (i = 0; i < coaches.length; i++) {
      var libre = cupo[coaches[i].id] - (carga[coaches[i].id] || 0);
      if (libre > libreMejor) { libreMejor = libre; mejor = coaches[i].id; }
    }
    return mejor;
  }

  /** Construye los 45 socios con perfil, plan, estado y antigüedad. */
  function construirSocios(planes, coaches, hoy, mesesVentana) {
    var estados = repartoEstados();
    var antiguedades = repartoAntiguedades();
    var carga = {};
    var socios = [];
    var correosUsados = {};

    var planPorNombre = {};
    for (var p = 0; p < planes.length; p++) planPorNombre[planes[p].nombre] = planes[p];

    for (var i = 0; i < PERSONAS.length; i++) {
      var persona = PERSONAS[i];
      var esAna = i === 0;

      var sexo = persona[2];
      var estado = esAna ? 'activo' : estados[i - 1];
      var meses = esAna ? 8 : antiguedades[i - 1];

      /* Los socios que no están activos necesitan historial suficiente. */
      if (estado === 'vencido' && meses < 2) meses = ent(2, 5);
      if (estado === 'congelado' && meses < 4) meses = ent(4, 7);
      if (estado === 'baja' && meses < 5) meses = ent(5, 8);

      var edad = esAna ? 29 : ent(18, 64);
      var estatura = esAna ? 163 : (sexo === 'H' ? ent(165, 186) : ent(150, 172));

      var objetivo;
      if (esAna) objetivo = 'perder_grasa';
      else if (edad >= 60) objetivo = probable(0.6) ? 'salud' : 'mantener';
      else objetivo = OBJETIVOS[Math.floor(azar() * OBJETIVOS.length)];

      var nivel;
      if (esAna) nivel = 'intermedio';
      else if (meses <= 2) nivel = probable(0.85) ? 'principiante' : 'intermedio';
      else if (meses <= 5) nivel = probable(0.6) ? 'intermedio' : 'principiante';
      else nivel = probable(0.35) ? 'avanzado' : 'intermedio';

      var nivelActividad;
      if (esAna) nivelActividad = 'moderado';
      else if (edad >= 58) nivelActividad = probable(0.6) ? 'ligero' : 'sedentario';
      else nivelActividad = elegir(['sedentario', 'ligero', 'ligero', 'moderado', 'moderado', 'alto']);
      if (objetivo === 'rendimiento') nivelActividad = probable(0.5) ? 'alto' : 'atleta';

      /* Plan: los que no siguen activos se manejan siempre en mensualidad. */
      var plan;
      if (esAna) plan = planPorNombre['Mensual'];
      else if (estado !== 'activo') plan = planPorNombre['Mensual'];
      else if (meses >= 7 && probable(0.30)) plan = planPorNombre['Anual'];
      else if (meses >= 6 && probable(0.35)) plan = planPorNombre['Semestral'];
      else if (meses >= 3 && probable(0.40)) plan = planPorNombre['Trimestral'];
      else plan = planPorNombre['Mensual'];

      /* Fecha de alta: dentro del mes correspondiente a su antigüedad. */
      var indiceAlta = acotar(8 - meses, 0, 7);
      var mesAlta = mesesVentana[indiceAlta];
      var diaTope = indiceAlta === 7 ? Math.max(1, partesDe(hoy).d - 1) : 26;
      var fechaAlta = mesAlta + '-' + relleno(ent(1, Math.max(1, diaTope)), 2);
      if (fechaAlta > hoy) fechaAlta = hoy;

      var nacimiento = sumaDias(sumaMeses(hoy, -(edad * 12)), -ent(0, 330));

      var padecimiento = esAna ? '' : elegir(PADECIMIENTOS);
      var codigo = 'AG-' + relleno(i + 1, 4);

      var correo;
      if (esAna) {
        correo = 'socio@alliancegym.mx';
      } else {
        var base = sinAcentos(persona[0].split(' ')[0]) + '.' + sinAcentos(persona[1]);
        correo = base + '@' + elegir(DOMINIOS);
        var intento = 2;
        while (correosUsados[correo]) {
          correo = base + intento + '@' + elegir(DOMINIOS);
          intento++;
        }
      }
      correosUsados[correo] = true;

      var socio = {
        id: 'u_' + relleno(i + 7, 4),
        rol: 'socio',
        nombre: persona[0], apellidos: persona[1],
        email: correo,
        telefono: '33 ' + ent(1000, 3999) + ' ' + ent(1000, 9999),
        password: 'socio123',
        avatarColor: null,
        activo: estado !== 'baja',
        creado: fechaAlta,
        codigo: codigo,
        fechaNacimiento: nacimiento,
        sexo: sexo,
        estaturaCm: estatura,
        objetivo: objetivo,
        nivel: nivel,
        nivelActividad: nivelActividad,
        coachId: null,
        planId: plan.id,
        fechaAlta: fechaAlta,
        fechaVencimiento: fechaAlta,
        estado: estado,
        padecimientos: padecimiento,
        alergias: esAna ? 'Ninguna conocida' : elegir(ALERGIAS),
        contactoEmergencia: {
          nombre: elegir(NOMBRES_EMERGENCIA),
          telefono: '33 ' + ent(1000, 3999) + ' ' + ent(1000, 9999),
          parentesco: elegir(PARENTESCOS)
        },
        notas: esAna
          ? 'Cuenta de demostración del socio. Historial completo de ocho meses con mediciones, rutina, nutrición y bitácoras.'
          : elegir(NOTAS_SOCIO),
        /* --- campos auxiliares del generador (se limpian al final) --- */
        edadCalculada: edad,
        mesesAntiguedad: meses,
        indiceAlta: indiceAlta
      };

      socio.coachId = esAna ? 'u_0002' : elegirCoach(socio, coaches, carga);
      carga[socio.coachId] = (carga[socio.coachId] || 0) + 1;
      socio.avatarColor = null;                 /* AG.Utils.colorDe lo resuelve solo */

      socios.push(socio);
    }

    return socios;
  }

  /* =============================================================
     11. Pagos
     ============================================================= */

  var METODOS = ['efectivo', 'efectivo', 'efectivo', 'efectivo', 'tarjeta', 'tarjeta',
    'transferencia', 'transferencia', 'app', 'app'];

  var NOTAS_PAGO = ['', '', '', '', 'Pago en recepción.', 'Renovación puntual.',
    'Pagó con promoción de referido.', 'Solicitó factura.', 'Pago adelantado del periodo.'];

  /**
   * Genera pagos coherentes con la antigüedad y el estado de cada socio.
   * Devuelve { pagos, vencimientos } con la fecha de corte por socio.
   */
  function construirPagos(socios, planes, hoy, directorId) {
    var pagos = [];
    var vencimientos = {};
    var planPorId = {};
    for (var p = 0; p < planes.length; p++) planPorId[planes[p].id] = planes[p];
    var planVisita = planes[0];

    for (var i = 0; i < socios.length; i++) {
      var socio = socios[i];
      var plan = planPorId[socio.planId] || planes[2];
      var meses = Math.max(1, Number(plan.meses) || 1);

      /* Inscripción al darse de alta. */
      if (Number(plan.inscripcion) > 0) {
        pagos.push({
          id: null, socioId: socio.id, planId: plan.id,
          monto: plan.inscripcion, metodo: elegir(METODOS),
          fecha: socio.fechaAlta,
          periodoInicio: socio.fechaAlta, periodoFin: socio.fechaAlta,
          concepto: 'inscripcion', estado: 'pagado', folio: '',
          registradoPor: directorId, nota: 'Inscripción y alta de expediente.'
        });
      }

      /* Último periodo permitido según el estado deseado del socio. */
      var corteFin = null;
      if (socio.estado === 'vencido') corteFin = sumaDias(hoy, -ent(9, 42));
      else if (socio.estado === 'congelado') corteFin = sumaDias(hoy, -ent(20, 55));
      else if (socio.estado === 'baja') corteFin = sumaDias(hoy, -ent(45, 85));

      var cursor = socio.fechaAlta;
      var guardia = 0;
      var ultimoFin = '';

      while (guardia < 60) {
        var fin = sumaMeses(cursor, meses);
        var primero = guardia === 0;

        if (!primero) {
          if (cursor > hoy) break;
          if (corteFin && fin > corteFin) break;
        }

        var fechaPago = cursor;
        if (!primero) fechaPago = sumaDias(cursor, ent(-2, 2));
        if (fechaPago > hoy) fechaPago = hoy;
        if (fechaPago < socio.fechaAlta) fechaPago = socio.fechaAlta;

        pagos.push({
          id: null, socioId: socio.id, planId: plan.id,
          monto: plan.precio, metodo: elegir(METODOS),
          fecha: fechaPago,
          periodoInicio: cursor, periodoFin: fin,
          concepto: 'mensualidad', estado: 'pagado', folio: '',
          registradoPor: directorId, nota: elegir(NOTAS_PAGO)
        });

        ultimoFin = fin;
        cursor = fin;
        guardia++;
      }

      vencimientos[socio.id] = ultimoFin || sumaMeses(socio.fechaAlta, meses);
    }

    /* Ventas de mostrador y clases sueltas: dan vida a la caja del gimnasio. */
    var activos = socios.filter(function (s) { return s.estado === 'activo' || s.estado === 'vencido'; });
    var productos = [
      ['Proteína de suero 2 lb', 890, 'producto'],
      ['Playera oficial Alliance', 320, 'producto'],
      ['Shaker Alliance', 150, 'producto'],
      ['Cinturón de levantamiento', 640, 'producto'],
      ['Pre-entreno 30 servicios', 560, 'producto'],
      ['Guantes de entrenamiento', 280, 'producto'],
      ['Barra de proteína', 45, 'producto'],
      ['Reposición de credencial', 80, 'personalizado'],
      ['Casillero mensual', 120, 'personalizado'],
      ['Sesión de entrenamiento personal', 350, 'personalizado']
    ];

    for (var v = 0; v < 34; v++) {
      var comprador = elegir(activos);
      if (!comprador) break;
      var art = elegir(productos);
      var fechaVenta = sumaDias(hoy, -ent(0, 150));
      if (fechaVenta < comprador.fechaAlta) fechaVenta = comprador.fechaAlta;
      pagos.push({
        id: null, socioId: comprador.id, planId: comprador.planId,
        monto: art[1], metodo: elegir(METODOS),
        fecha: fechaVenta, periodoInicio: fechaVenta, periodoFin: fechaVenta,
        concepto: art[2], estado: v % 17 === 0 ? 'pendiente' : 'pagado',
        folio: '', registradoPor: directorId, nota: art[0]
      });
    }

    /* Visitas sueltas de invitados registradas a nombre de un socio. */
    for (var c = 0; c < 12; c++) {
      var anfitrion = elegir(activos);
      if (!anfitrion) break;
      var fechaVisita = sumaDias(hoy, -ent(0, 90));
      if (fechaVisita < anfitrion.fechaAlta) fechaVisita = anfitrion.fechaAlta;
      pagos.push({
        id: null, socioId: anfitrion.id, planId: planVisita.id,
        monto: planVisita.precio, metodo: elegir(METODOS),
        fecha: fechaVisita, periodoInicio: fechaVisita, periodoFin: fechaVisita,
        concepto: 'clase', estado: 'pagado', folio: '',
        registradoPor: directorId, nota: 'Pase de visita para acompañante.'
      });
    }

    /* Folios consecutivos en orden cronológico real. */
    pagos.sort(function (a, b) {
      if (a.fecha === b.fecha) return a.socioId < b.socioId ? -1 : 1;
      return a.fecha < b.fecha ? -1 : 1;
    });
    for (var k = 0; k < pagos.length; k++) {
      pagos[k].id = nuevoId('pg_');
      pagos[k].folio = 'REC-' + relleno(k + 1, 6);
    }

    return { pagos: pagos, vencimientos: vencimientos };
  }

  /* =============================================================
     12. Mediciones (inicio y cierre de mes)
     ============================================================= */

  /** Estado corporal inicial del socio, coherente con su objetivo. */
  function perfilInicial(socio) {
    var rangoImc = IMC_INICIAL[socio.objetivo] || IMC_INICIAL.mantener;
    var imc = real(rangoImc[0], rangoImc[1], 2);
    var altura = socio.estaturaCm / 100;
    var peso = red(imc * altura * altura, 1);

    var rangoGrasa = (GRASA_INICIAL[socio.objetivo] || GRASA_INICIAL.mantener)[socio.sexo] ||
      GRASA_INICIAL.mantener.H;
    var grasa = real(rangoGrasa[0], rangoGrasa[1], 1);

    var magra = peso * (1 - grasa / 100);
    var musculo = red(magra * (socio.sexo === 'H' ? real(0.51, 0.545, 3) : real(0.475, 0.505, 3)), 1);

    var agua = socio.sexo === 'H' ? real(55, 62, 1) : real(48, 56, 1);

    var fc = ent(62, 84);
    if (socio.nivelActividad === 'alto') fc -= 6;
    if (socio.nivelActividad === 'atleta') fc -= 11;
    if (socio.nivelActividad === 'sedentario') fc += 4;
    fc = acotar(fc, 48, 92);

    return {
      peso: peso, grasa: grasa, musculo: musculo, agua: agua,
      fc: fc,
      sistolica: ent(108, 136), diastolica: ent(68, 88),
      musculoBase: musculo,
      fuerza: fuerzaInicial(socio.sexo, peso, socio.nivel),
      ruido: {
        cuello: real(-1.2, 1.2, 1), hombros: real(-2.5, 2.5, 1), pecho: real(-2, 2, 1),
        brazo: real(-1.3, 1.3, 1), cintura: real(-2.2, 2.2, 1), cadera: real(-2.2, 2.2, 1),
        muslo: real(-1.8, 1.8, 1), pantorrilla: real(-1.2, 1.2, 1),
        asimetriaBrazo: real(0.2, 0.9, 1), asimetriaMuslo: real(0.1, 0.8, 1),
        pl1: real(-2, 2, 0), pl2: real(-2, 2, 0), pl3: real(-2.5, 2.5, 0),
        pl4: real(-3, 3, 0), pl5: real(-2.5, 2.5, 0)
      }
    };
  }

  /** Aplica un mes de progreso al estado corporal según el objetivo. */
  function avanzarMes(estado, socio) {
    var meseta = probable(0.16);
    var retroceso = probable(0.08);
    var dPeso = 0, dGrasa = 0, dMusculo = 0;

    if (socio.objetivo === 'perder_grasa') {
      dPeso = -real(0.4, 1.2, 2);
      dGrasa = -real(0.3, 0.8, 2);
      dMusculo = real(-0.05, 0.18, 2);
    } else if (socio.objetivo === 'ganar_musculo') {
      dPeso = real(0.3, 0.8, 2);
      dGrasa = real(-0.1, 0.18, 2);
      dMusculo = real(0.22, 0.48, 2);
    } else if (socio.objetivo === 'rendimiento') {
      dPeso = real(-0.4, 0.15, 2);
      dGrasa = -real(0.2, 0.55, 2);
      dMusculo = real(0.12, 0.34, 2);
    } else if (socio.objetivo === 'salud') {
      dPeso = -real(0.2, 0.7, 2);
      dGrasa = -real(0.15, 0.45, 2);
      dMusculo = real(0.04, 0.20, 2);
    } else {                                   /* mantener */
      dPeso = real(-0.35, 0.30, 2);
      dGrasa = -real(0.05, 0.30, 2);
      dMusculo = real(0.05, 0.22, 2);
    }

    if (meseta) { dPeso *= 0.15; dGrasa *= 0.15; dMusculo *= 0.35; }
    if (retroceso) { dPeso = -dPeso * 0.55; dGrasa = -dGrasa * 0.5; dMusculo *= 0.2; }

    estado.peso = red(acotar(estado.peso + dPeso, 42, 165), 1);
    estado.grasa = red(acotar(estado.grasa + dGrasa, socio.sexo === 'H' ? 6 : 14, 52), 1);

    var magra = estado.peso * (1 - estado.grasa / 100);
    estado.musculo = red(acotar(estado.musculo + dMusculo, 15, magra * 0.60), 1);

    estado.agua = red(acotar(estado.agua + real(-0.2, 0.5, 1), 44, 66), 1);
    estado.fc = Math.round(acotar(estado.fc - (meseta ? 0 : real(0.3, 1.4, 1)), 46, 95));
    estado.sistolica = Math.round(acotar(estado.sistolica - real(-1, 2, 1), 100, 145));
    estado.diastolica = Math.round(acotar(estado.diastolica - real(-1, 1.5, 1), 62, 95));

    /* Progresión de fuerza: fuerte al principio, más lenta con el nivel. */
    var escala = socio.nivel === 'principiante' ? 1.25 : (socio.nivel === 'avanzado' ? 0.55 : 1);
    if (!meseta) {
      estado.fuerza.pressBanca = aDisco(estado.fuerza.pressBanca + real(1.5, 4, 1) * escala);
      estado.fuerza.sentadilla = aDisco(estado.fuerza.sentadilla + real(2.5, 6, 1) * escala);
      estado.fuerza.pesoMuerto = aDisco(estado.fuerza.pesoMuerto + real(2.5, 7, 1) * escala);
    }
    return estado;
  }

  /** Pequeña deriva entre el cierre de un mes y la apertura del siguiente. */
  function derivaEntreMeses(estado, socio) {
    estado.peso = red(acotar(estado.peso + real(-0.3, 0.35, 2), 42, 165), 1);
    estado.grasa = red(acotar(estado.grasa + real(-0.18, 0.12, 2), socio.sexo === 'H' ? 6 : 14, 52), 1);
    return estado;
  }

  /** Arma el registro de medición a partir del estado corporal. */
  function medicionDesdeEstado(socio, estado, fecha, periodo, tipo, conPliegues, notas, visible) {
    var altura = socio.estaturaCm / 100;
    var medidas = calcularMedidas(socio.sexo, estado.peso, estado.grasa,
      estado.musculo - estado.musculoBase, estado.ruido);

    var registro = {
      id: nuevoId('m_'),
      socioId: socio.id,
      coachId: socio.coachId,
      fecha: fecha,
      periodo: periodo,
      tipo: tipo,
      pesoKg: red(estado.peso, 1),
      estaturaCm: socio.estaturaCm,
      grasaPct: red(estado.grasa, 1),
      musculoKg: red(estado.musculo, 1),
      aguaPct: red(estado.agua, 1),
      imc: red(estado.peso / (altura * altura), 1),
      medidas: medidas,
      pliegues: conPliegues ? calcularPliegues(socio.sexo, estado.grasa, estado.ruido) : null,
      presion: estado.sistolica + '/' + estado.diastolica,
      fcReposo: estado.fc,
      fuerza: {
        pressBanca: estado.fuerza.pressBanca,
        sentadilla: estado.fuerza.sentadilla,
        pesoMuerto: estado.fuerza.pesoMuerto
      },
      notas: notas,
      visibleParaSocio: visible !== false
    };
    return registro;
  }

  /**
   * Genera todo el historial de mediciones del padrón.
   * @returns {{mediciones:Array, estadoFinal:Object}}
   */
  function construirMediciones(socios, hoy, mesesVentana) {
    var mediciones = [];
    var estadoFinal = {};
    var mesActual = mesesVentana[7];

    /* Socios a los que sí se les cerró ya el mes en curso. */
    var candidatosCierre = barajar(socios.filter(function (s) {
      return s.estado === 'activo' && s.mesesAntiguedad >= 2;
    })).slice(0, 9);
    var cierreActual = {};
    for (var c = 0; c < candidatosCierre.length; c++) cierreActual[candidatosCierre[c].id] = true;
    cierreActual['u_0007'] = true;                       /* Ana Sofía siempre cerrada si se puede */

    for (var i = 0; i < socios.length; i++) {
      var socio = socios[i];
      var estado = perfilInicial(socio);
      estadoFinal[socio.id] = estado;

      var conPliegues = socio.id === 'u_0007' || probable(0.5);

      /* Último mes con seguimiento según el estado de la membresía. */
      var mesFin = 7;
      if (socio.estado === 'congelado') mesFin = 7 - ent(1, 2);
      else if (socio.estado === 'baja') mesFin = 7 - ent(2, 3);
      mesFin = acotar(mesFin, socio.indiceAlta, 7);

      if (socio.mesesAntiguedad < 2) {
        /* Recién inscritos: solo la medición de arranque. */
        var fUnica = sumaDias(socio.fechaAlta, ent(0, 2));
        if (fUnica > hoy) fUnica = hoy;
        mediciones.push(medicionDesdeEstado(socio, estado, fUnica, mesDe(fUnica), 'inicial',
          conPliegues, 'Valoración inicial de ingreso. Se explicó el plan del primer mes.', true));
        continue;
      }

      for (var k = socio.indiceAlta; k <= mesFin; k++) {
        var mesKey = mesesVentana[k];
        var esMesActual = mesKey === mesActual;

        /* --- Medición inicial del mes --- */
        var fechaIni;
        if (k === socio.indiceAlta) {
          fechaIni = sumaDias(socio.fechaAlta, ent(0, 2));
        } else {
          fechaIni = sumaDias(primerDiaMes(mesKey), ent(0, 2));
        }
        if (fechaIni > hoy) fechaIni = hoy;

        var haceInicial = !esMesActual || probable(0.85);
        if (haceInicial) {
          mediciones.push(medicionDesdeEstado(socio, estado, fechaIni, mesKey, 'inicial',
            conPliegues, k === socio.indiceAlta
              ? 'Valoración inicial de ingreso. Punto de partida del expediente.'
              : elegir(NOTAS_MEDICION_INICIAL),
            true));
        }

        /* --- Cierre del mes --- */
        var estadoCierre = avanzarMes(estado, socio);

        if (!esMesActual) {
          var fechaFin = sumaDias(ultimoDiaMes(mesKey), -ent(0, 2));
          if (fechaFin > hoy) fechaFin = hoy;
          if (fechaFin <= fechaIni) fechaFin = sumaDias(fechaIni, 5);
          if (fechaFin > hoy) fechaFin = hoy;

          mediciones.push(medicionDesdeEstado(socio, estadoCierre, fechaFin, mesKey, 'final',
            conPliegues, elegir(NOTAS_MEDICION_FINAL), true));

          derivaEntreMeses(estado, socio);
        } else {
          /* Mes en curso: solo algunos socios tienen ya el cierre capturado. */
          var puedeCerrar = cierreActual[socio.id] && diasEntre(fechaIni, hoy) >= 3;
          if (puedeCerrar) {
            var fechaCierre = sumaDias(hoy, -ent(0, 2));
            if (fechaCierre <= fechaIni) fechaCierre = hoy;
            mediciones.push(medicionDesdeEstado(socio, estadoCierre, fechaCierre, mesKey, 'final',
              conPliegues, 'Cierre anticipado del mes por viaje del socio. Se retoma el siguiente periodo.',
              probable(0.9)));
          }
        }
      }
    }

    mediciones.sort(function (a, b) {
      if (a.fecha === b.fecha) return a.socioId < b.socioId ? -1 : 1;
      return a.fecha < b.fecha ? -1 : 1;
    });

    return { mediciones: mediciones, estadoFinal: estadoFinal };
  }

  /* =============================================================
     13. Asignaciones de rutina
     ============================================================= */

  var NOTAS_ASIGNACION = [
    'Respetar los descansos marcados; si sobra energía, se sube carga, no repeticiones.',
    'Bloque de ocho semanas. Al cierre del mes revisamos cargas y cambiamos variantes.',
    'Si un día no alcanza el tiempo, haz los primeros cuatro ejercicios y salta el resto.',
    'Registra siempre el peso en la bitácora: sin registro no hay progresión.',
    'Enfoque en técnica las dos primeras semanas, después subimos intensidad.',
    'Rutina adaptada por molestia de hombro: nada de press por detrás de la nuca.',
    ''
  ];

  /** Escoge la rutina adecuada para el perfil del socio. */
  function rutinaParaSocio(socio, rutinasPorNombre) {
    var edad = socio.edadCalculada;

    if (edad >= 58 || /hernia|lumbal|condromalacia|rehabilit/i.test(socio.padecimientos || '')) {
      return rutinasPorNombre['Adulto Mayor Movilidad'];
    }
    if (socio.nivelActividad === 'sedentario' && socio.nivel === 'principiante' && probable(0.5)) {
      return rutinasPorNombre['Express 30 min'];
    }
    if (socio.objetivo === 'perder_grasa') {
      if (socio.nivel === 'principiante') return rutinasPorNombre['Full Body Principiante'];
      if (socio.sexo === 'M' && probable(0.45)) return rutinasPorNombre['Recomposición Femenina 4 días'];
      return rutinasPorNombre['Definición + HIIT 5 días'];
    }
    if (socio.objetivo === 'ganar_musculo') {
      if (socio.nivel === 'principiante') return rutinasPorNombre['Full Body Principiante'];
      if (socio.sexo === 'M') return rutinasPorNombre['Glúteos y Piernas 4 días'];
      if (socio.nivel === 'avanzado') {
        return probable(0.5) ? rutinasPorNombre['Push Pull Legs 6 días'] : rutinasPorNombre['Volumen Avanzado 6 días'];
      }
      return probable(0.5) ? rutinasPorNombre['Torso-Pierna 4 días'] : rutinasPorNombre['Hipertrofia 5 días'];
    }
    if (socio.objetivo === 'rendimiento') {
      return probable(0.5) ? rutinasPorNombre['Fuerza 5x5'] : rutinasPorNombre['Funcional 3 días'];
    }
    if (socio.objetivo === 'salud') {
      if (socio.nivel === 'principiante') return rutinasPorNombre['Full Body Principiante'];
      return rutinasPorNombre['Express 30 min'];
    }
    /* mantener */
    if (socio.sexo === 'M') return rutinasPorNombre['Recomposición Femenina 4 días'];
    return probable(0.5) ? rutinasPorNombre['Torso-Pierna 4 días'] : rutinasPorNombre['Funcional 3 días'];
  }

  /**
   * Asigna rutina vigente a casi todos los socios activos y deja historial
   * de asignaciones anteriores ya cerradas.
   */
  function construirAsignaciones(socios, rutinas, hoy) {
    var asignaciones = [];
    var porNombre = {};
    for (var r = 0; r < rutinas.length; r++) porNombre[rutinas[r].nombre] = rutinas[r];

    for (var i = 0; i < socios.length; i++) {
      var socio = socios[i];
      var esAna = socio.id === 'u_0007';

      /* Las bajas y algún activo recién inscrito no traen rutina vigente. */
      if (socio.estado === 'baja') continue;
      if (!esAna && socio.estado === 'activo' && socio.mesesAntiguedad <= 1 && probable(0.35)) continue;
      if (!esAna && socio.estado === 'vencido' && probable(0.3)) continue;

      var rutina = rutinaParaSocio(socio, porNombre) || rutinas[0];

      /* Historial: una rutina anterior ya cerrada para los más antiguos. */
      if (socio.mesesAntiguedad >= 5 && probable(0.55)) {
        var anterior = porNombre['Full Body Principiante'];
        var iniAnt = sumaDias(socio.fechaAlta, ent(0, 6));
        var finAnt = sumaMeses(iniAnt, 3);
        if (finAnt > hoy) finAnt = sumaDias(hoy, -20);
        if (finAnt > iniAnt) {
          asignaciones.push({
            id: nuevoId('as_'),
            socioId: socio.id,
            rutinaId: anterior.id,
            coachId: socio.coachId,
            fechaInicio: iniAnt,
            fechaFin: finAnt,
            activa: false,
            notas: 'Bloque de adaptación de los primeros meses. Cerrado al pasar al siguiente programa.'
          });
        }
      }

      var mesesAtras = Math.min(socio.mesesAntiguedad, esAna ? 4 : ent(3, 5));
      var inicio = sumaDias(sumaMeses(hoy, -mesesAtras), ent(0, 8));
      if (inicio < socio.fechaAlta) inicio = socio.fechaAlta;
      if (inicio > hoy) inicio = hoy;

      asignaciones.push({
        id: nuevoId('as_'),
        socioId: socio.id,
        rutinaId: rutina.id,
        coachId: socio.coachId,
        fechaInicio: inicio,
        fechaFin: sumaMeses(inicio, 3),
        activa: true,
        notas: esAna
          ? 'Bloque de definición con dos sesiones metabólicas por semana. Revisión de cargas cada cuatro semanas.'
          : elegir(NOTAS_ASIGNACION)
      });
    }

    return asignaciones;
  }

  /* =============================================================
     14. Bitácoras de entrenamiento (últimos 90 días)
     ============================================================= */

  var BASE_GRUPO = {
    pecho: 45, espalda: 50, hombros: 22, biceps: 18, triceps: 22,
    piernas: 78, gluteos: 58, abdomen: 9, cuerpo_completo: 28,
    cardio: 0, movilidad: 0
  };

  var FACTOR_EQUIPO = {
    barra: 1, mancuernas: 0.40, maquina: 1.05, polea: 0.60,
    peso_corporal: 0, kettlebell: 0.35, banda: 0, balon: 0.12, cardio: 0
  };

  var DIAS_POR_SEMANA = {
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6]
  };

  var NOTAS_BITACORA = [
    '', '', '', '', '', '',
    'Buena sesión, subí 2.5 kg en el básico.',
    'Poco tiempo, recorté los descansos.',
    'Me sentí cansado, bajé una serie del último ejercicio.',
    'El gimnasio estaba lleno, cambié un par de máquinas.',
    'Molestia leve en el hombro, ajusté el agarre.',
    'Excelente energía hoy, salieron todas las repeticiones.',
    'Entrené con poco sueño; la carga se sintió pesada.'
  ];

  /** Extrae un objetivo numérico de repeticiones a partir del texto del plan. */
  function repsObjetivo(texto) {
    var t = String(texto || '');
    var m = t.match(/(\d+)\s*-\s*(\d+)/);
    if (m) return { min: Number(m[1]), max: Number(m[2]) };
    var s = t.match(/(\d+)/);
    if (s) {
      var n = Number(s[1]);
      if (/s\b|segundo/i.test(t)) return { min: 1, max: 1, tiempo: true };
      if (n > 40) return { min: 12, max: 15 };
      return { min: n, max: n };
    }
    return { min: 8, max: 12 };
  }

  /** Carga de trabajo estimada en kg para un ejercicio y un socio. */
  function pesoDeTrabajo(ejercicioId, socio, pesoCorporal, progreso) {
    var ej = (AG.Data && typeof AG.Data.ejercicio === 'function') ? AG.Data.ejercicio(ejercicioId) : null;
    var grupo = ej && ej.grupo ? ej.grupo : 'cuerpo_completo';
    var equipo = ej && ej.equipo ? ej.equipo : 'mancuernas';

    var base = BASE_GRUPO[grupo];
    if (base === undefined) base = 25;
    var factorEquipo = FACTOR_EQUIPO[equipo];
    if (factorEquipo === undefined) factorEquipo = 0.5;
    if (factorEquipo === 0) return 0;

    var factorSexo = socio.sexo === 'H' ? 1 : 0.60;
    var factorNivel = socio.nivel === 'principiante' ? 0.70 : (socio.nivel === 'avanzado' ? 1.30 : 1);
    var factorCuerpo = acotar(pesoCorporal / 75, 0.65, 1.5);

    var kg = base * factorEquipo * factorSexo * factorNivel * factorCuerpo * progreso;
    if (kg < 3) return red(acotar(kg, 1, 3), 1);
    if (kg < 20) return red(Math.round(kg), 0);
    return aDisco(kg);
  }

  /**
   * Bitácoras de los últimos 90 días con adherencia variable y cargas
   * que progresan a lo largo del trimestre.
   */
  function construirBitacoras(socios, asignaciones, rutinas, hoy, adherencias, estadoFinal, vencimientos) {
    var bitacoras = [];
    var rutinaPorId = {};
    for (var r = 0; r < rutinas.length; r++) rutinaPorId[rutinas[r].id] = rutinas[r];

    var activaDe = {};
    for (var a = 0; a < asignaciones.length; a++) {
      if (asignaciones[a].activa) activaDe[asignaciones[a].socioId] = asignaciones[a];
    }

    var desdeGlobal = sumaDias(hoy, -89);

    for (var i = 0; i < socios.length; i++) {
      var socio = socios[i];
      var asig = activaDe[socio.id];
      if (!asig) continue;

      var rutina = rutinaPorId[asig.rutinaId];
      if (!rutina || !rutina.dias || !rutina.dias.length) continue;

      var adherencia = adherencias[socio.id];
      var estado = estadoFinal[socio.id];
      var pesoCorporal = estado ? estado.peso : 75;

      var desde = mayorFecha(desdeGlobal, mayorFecha(socio.fechaAlta, asig.fechaInicio));

      /* Hasta cuándo siguió entrenando según su estado de membresía. */
      var hasta = hoy;
      if (socio.estado === 'vencido') hasta = menorFecha(hoy, sumaDias(vencimientos[socio.id] || hoy, ent(0, 9)));
      else if (socio.estado === 'congelado') hasta = menorFecha(hoy, sumaDias(vencimientos[socio.id] || hoy, ent(-5, 5)));
      if (hasta < desde) continue;

      var diasValidos = DIAS_POR_SEMANA[rutina.diasPorSemana] || DIAS_POR_SEMANA[3];
      var totalDias = diasEntre(desde, hasta);
      var indiceDia = 0;

      for (var d = 0; d <= totalDias; d++) {
        var fecha = sumaDias(desde, d);
        var dow = diaSemana(fecha);
        if (diasValidos.indexOf(dow) === -1) continue;
        if (!probable(adherencia)) continue;

        var dia = rutina.dias[indiceDia % rutina.dias.length];
        var diaIndex = indiceDia % rutina.dias.length;
        indiceDia++;

        /* Progresión: la carga sube conforme avanza el trimestre. */
        var progreso = 1 + (d / Math.max(1, totalDias)) * (0.06 + adherencia * 0.12);

        var ejercicios = [];
        var listaPlan = dia.ejercicios || [];
        var cuenta = 0;

        for (var e = 0; e < listaPlan.length && cuenta < 6; e++) {
          var plan = listaPlan[e];
          var info = (AG.Data && typeof AG.Data.ejercicio === 'function') ? AG.Data.ejercicio(plan.ejercicioId) : null;
          if (info && (info.equipo === 'cardio' || info.grupo === 'movilidad')) continue;

          var objetivoReps = repsObjetivo(plan.reps);
          if (objetivoReps.tiempo) continue;

          var kg = pesoDeTrabajo(plan.ejercicioId, socio, pesoCorporal, progreso);
          var numSeries = Math.min(4, Math.max(2, Number(plan.series) || 3));

          var series = [];
          for (var s = 0; s < numSeries; s++) {
            var reps = ent(objetivoReps.min, objetivoReps.max);
            /* Las últimas series suelen bajar una o dos repeticiones. */
            if (s >= 2 && probable(0.45)) reps = Math.max(objetivoReps.min - 2, reps - ent(1, 2));
            var pesoSerie = kg > 0 ? aDisco(kg * (s === 0 ? 0.92 : 1)) : 0;
            series.push({
              reps: Math.max(1, reps),
              peso: pesoSerie,
              hecho: probable(0.96)
            });
          }

          ejercicios.push({ ejercicioId: plan.ejercicioId, series: series });
          cuenta++;
        }

        if (!ejercicios.length) continue;

        var completada = probable(0.94);
        bitacoras.push({
          id: nuevoId('bt_'),
          socioId: socio.id,
          fecha: fecha,
          rutinaId: rutina.id,
          diaIndex: diaIndex,
          ejercicios: ejercicios,
          duracionMin: ent(42, 82),
          esfuerzo: ent(5, 9),
          notas: elegir(NOTAS_BITACORA),
          completada: completada
        });
      }
    }

    bitacoras.sort(function (x, y) {
      if (x.fecha === y.fecha) return x.socioId < y.socioId ? -1 : 1;
      return x.fecha < y.fecha ? -1 : 1;
    });

    return bitacoras;
  }

  /* =============================================================
     15. Asistencias (últimos 60 días)
     ============================================================= */

  /** Franja horaria preferida por socio: mañana, mediodía o noche. */
  function franjaDe(indice) {
    var franjas = [[5, 8], [6, 9], [12, 14], [17, 19], [18, 21], [19, 21]];
    return franjas[indice % franjas.length];
  }

  /**
   * Check-ins coherentes con las bitácoras: todo entrenamiento registrado
   * tiene su entrada, más visitas de clases y cardio suelto.
   */
  function construirAsistencias(socios, bitacoras, hoy, adherencias, vencimientos) {
    var asistencias = [];
    var usadas = {};
    var desde60 = sumaDias(hoy, -59);
    var i, b, clave;

    function registrar(socioId, fecha, franja, conBitacora) {
      clave = socioId + '|' + fecha;
      if (usadas[clave]) return;
      usadas[clave] = true;

      var hora = ent(franja[0], franja[1]);
      var minuto = ent(0, 59);
      var duracion = conBitacora ? ent(55, 105) : ent(35, 80);
      var totalSalida = hora * 60 + minuto + duracion;
      var salida = null;
      if (totalSalida < 23 * 60 + 55 && probable(0.94)) {
        salida = relleno(Math.floor(totalSalida / 60), 2) + ':' + relleno(totalSalida % 60, 2);
      }

      asistencias.push({
        id: nuevoId('at_'),
        socioId: socioId,
        fecha: fecha,
        entrada: relleno(hora, 2) + ':' + relleno(minuto, 2),
        salida: salida
      });
    }

    var franjaPorSocio = {};
    for (i = 0; i < socios.length; i++) franjaPorSocio[socios[i].id] = franjaDe(i);

    /* 1) Una asistencia por cada entrenamiento registrado en los últimos 60 días. */
    for (i = 0; i < bitacoras.length; i++) {
      b = bitacoras[i];
      if (b.fecha < desde60) continue;
      registrar(b.socioId, b.fecha, franjaPorSocio[b.socioId] || [18, 20], true);
    }

    /* 2) Visitas extra: clases grupales, cardio y días sin bitácora. */
    for (i = 0; i < socios.length; i++) {
      var socio = socios[i];
      if (socio.estado === 'baja') continue;

      var adherencia = adherencias[socio.id] || 0.5;
      var limite = hoy;
      if (socio.estado === 'vencido') limite = menorFecha(hoy, sumaDias(vencimientos[socio.id] || hoy, 8));
      else if (socio.estado === 'congelado') limite = menorFecha(hoy, vencimientos[socio.id] || hoy);

      var arranque = mayorFecha(desde60, socio.fechaAlta);
      if (limite < arranque) continue;

      var dias = diasEntre(arranque, limite);
      for (var d = 0; d <= dias; d++) {
        var fecha = sumaDias(arranque, d);
        if (diaSemana(fecha) === 0 && probable(0.65)) continue;   /* pocos van en domingo */
        if (!probable(adherencia * 1.05)) continue;
        registrar(socio.id, fecha, franjaPorSocio[socio.id] || [18, 20], false);
      }
    }

    asistencias.sort(function (x, y) {
      if (x.fecha === y.fecha) return x.socioId < y.socioId ? -1 : 1;
      return x.fecha < y.fecha ? -1 : 1;
    });

    return asistencias;
  }

  /* =============================================================
     16. Planes de nutrición
     ============================================================= */

  /** Traduce el objetivo del socio al objetivo nutricional del contrato. */
  function objetivoNutricional(objetivo) {
    if (objetivo === 'perder_grasa') return 'definir';
    if (objetivo === 'ganar_musculo') return 'volumen';
    return 'mantener';
  }

  /** Cálculo de respaldo por si AG.Calc no estuviera disponible. */
  function macrosDeRespaldo(peso, objetivo) {
    var kcal = Math.round(peso * (objetivo === 'definir' ? 28 : (objetivo === 'volumen' ? 38 : 33)) / 10) * 10;
    var proteina = Math.round(peso * (objetivo === 'definir' ? 2.2 : 2.0));
    var grasa = Math.round(kcal * 0.25 / 9);
    var carbos = Math.max(0, Math.round((kcal - proteina * 4 - grasa * 9) / 4));
    return { kcal: kcal, proteina: proteina, carbos: carbos, grasa: grasa };
  }

  /**
   * Planes alimenticios para ~20 socios, calculados al estilo de AG.Calc
   * y armados con alimentos reales del catálogo.
   */
  function construirPlanesNutricion(socios, estadoFinal, hoy) {
    var planes = [];

    /* Ana Sofía primero; después socios activos, priorizando a los de Daniela. */
    var ana = null, resto = [];
    for (var i = 0; i < socios.length; i++) {
      if (socios[i].id === 'u_0007') { ana = socios[i]; continue; }
      if (socios[i].estado !== 'activo') continue;
      resto.push(socios[i]);
    }
    resto.sort(function (a, b) {
      var pa = a.coachId === 'u_0003' ? 0 : 1;
      var pb = b.coachId === 'u_0003' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.mesesAntiguedad - a.mesesAntiguedad;
    });

    var seleccion = (ana ? [ana] : []).concat(resto.slice(0, 19));

    for (var s = 0; s < seleccion.length; s++) {
      var socio = seleccion[s];
      var estado = estadoFinal[socio.id];
      var peso = estado ? estado.peso : 72;
      var edad = socio.edadCalculada;
      var objetivo = objetivoNutricional(socio.objetivo);

      var kcal = null, macros = null, comidasBase = null, agua = null;

      if (AG.Calc && typeof AG.Calc.tdee === 'function') {
        var tmb = AG.Calc.tmb(peso, socio.estaturaCm, edad, socio.sexo);
        var tdee = AG.Calc.tdee(peso, socio.estaturaCm, edad, socio.sexo, socio.nivelActividad);
        kcal = AG.Calc.caloriasObjetivo(tdee, objetivo, 'moderada', tmb);
        macros = AG.Calc.macros(kcal, objetivo, peso);
        agua = AG.Calc.aguaDiaria(peso, socio.nivelActividad);
      }
      if (!macros || !macros.kcal) macros = macrosDeRespaldo(peso, objetivo);
      if (!kcal) kcal = macros.kcal;
      if (!agua) agua = red(acotar(peso * 0.035 + 0.5, 1.5, 5), 1);

      var numComidas = objetivo === 'volumen' ? 5 : (probable(0.5) ? 4 : 5);
      if (socio.id === 'u_0007') numComidas = 5;

      if (AG.Calc && typeof AG.Calc.distribucionComidas === 'function') {
        comidasBase = AG.Calc.distribucionComidas(macros, numComidas);
      }
      if (!comidasBase || !comidasBase.length) {
        comidasBase = [
          { nombre: 'Desayuno', hora: '07:30', kcal: Math.round(macros.kcal * 0.25) },
          { nombre: 'Colación', hora: '10:30', kcal: Math.round(macros.kcal * 0.12) },
          { nombre: 'Comida', hora: '14:00', kcal: Math.round(macros.kcal * 0.32) },
          { nombre: 'Pre-entreno', hora: '17:00', kcal: Math.round(macros.kcal * 0.11) },
          { nombre: 'Cena', hora: '20:30', kcal: Math.round(macros.kcal * 0.20) }
        ].slice(0, numComidas);
      }

      var comidas = [];
      for (var c = 0; c < comidasBase.length; c++) {
        comidas.push(construirComida(comidasBase[c].nombre, comidasBase[c].hora,
          comidasBase[c].kcal, ent(0, 5)));
      }

      var creado = socio.id === 'u_0007'
        ? sumaDias(hoy, -ent(12, 26))
        : sumaDias(hoy, -ent(5, 110));
      if (creado < socio.fechaAlta) creado = socio.fechaAlta;

      planes.push({
        id: nuevoId('nu_'),
        socioId: socio.id,
        coachId: socio.coachId === 'u_0003' ? 'u_0003' : (probable(0.6) ? 'u_0003' : socio.coachId),
        creado: creado,
        objetivo: objetivo,
        kcal: Math.round(macros.kcal || kcal),
        proteina: Math.round(macros.proteina),
        carbos: Math.round(macros.carbos),
        grasa: Math.round(macros.grasa),
        agua: agua,
        comidas: comidas,
        notas: socio.id === 'u_0007'
          ? 'Déficit moderado con proteína alta para conservar músculo mientras baja grasa. Cinco comidas para controlar el hambre de la tarde. Las verduras son libres; el pre-entreno es obligatorio los días de pesas.'
          : elegir(NOTAS_NUTRICION),
        activo: true
      });
    }

    return planes;
  }

  /* =============================================================
     17. Calificaciones
     ============================================================= */

  /** Estrellas con sesgo positivo: mayoría de 4 y 5, algunas 3 y un par de 2. */
  function estrellasSesgadas() {
    var v = azar();
    if (v < 0.50) return 5;
    if (v < 0.81) return 4;
    if (v < 0.94) return 3;
    return 2;
  }

  /** Detalle por categorías alrededor de la calificación general. */
  function detalleDe(estrellas, claves) {
    var detalle = {};
    for (var i = 0; i < claves.length; i++) {
      detalle[claves[i]] = Math.round(acotar(estrellas + ent(-1, 1), 1, 5));
    }
    return detalle;
  }

  var CLAVES_COACH = ['atencion', 'conocimiento', 'puntualidad', 'motivacion'];
  var CLAVES_GYM = ['instalaciones', 'limpieza', 'equipo', 'ambiente'];

  /** ~90 calificaciones a coaches y al gimnasio, con respuestas de dirección. */
  function construirCalificaciones(socios, hoy, directorId) {
    var calificaciones = [];
    var evaluadores = socios.filter(function (s) {
      return s.estado !== 'baja' && s.mesesAntiguedad >= 2;
    });
    if (!evaluadores.length) evaluadores = socios.slice();

    var comentariosUsados = {};

    /** Elige un comentario del pool evitando repetir el mismo texto seguido. */
    function comentarioDe(pool, estrellas) {
      var lista = pool[estrellas] || pool[4];
      var texto = elegir(lista);
      var intentos = 0;
      while (comentariosUsados[texto] && intentos < 4) {
        texto = elegir(lista);
        intentos++;
      }
      comentariosUsados[texto] = (comentariosUsados[texto] || 0) + 1;
      return texto;
    }

    /** Fecha de la reseña, siempre después del alta del socio. */
    function fechaResena(socio, maxDias) {
      var f = sumaDias(hoy, -ent(2, maxDias));
      if (f < socio.fechaAlta) f = sumaDias(socio.fechaAlta, ent(15, 45));
      if (f > hoy) f = sumaDias(hoy, -ent(1, 5));
      return f;
    }

    function nuevaCalificacion(socio, tipo, objetivoId, pool, claves, probRespuesta, maxDias) {
      var estrellas = estrellasSesgadas();
      var fecha = fechaResena(socio, maxDias);
      var registro = {
        id: nuevoId('cf_'),
        socioId: socio.id,
        tipo: tipo,
        objetivoId: objetivoId,
        estrellas: estrellas,
        comentario: comentarioDe(pool, estrellas),
        fecha: fecha,
        detalle: detalleDe(estrellas, claves),
        respuesta: null
      };
      if (estrellas <= 3 || probable(probRespuesta)) {
        registro.respuesta = {
          texto: elegir(RESPUESTAS_DIRECCION),
          por: directorId,
          fecha: sumaDias(fecha, ent(1, 6))
        };
      }
      calificaciones.push(registro);
    }

    /* --- A los coaches: una reseña por socio y una segunda para los veteranos --- */
    var orden = barajar(evaluadores);
    for (var i = 0; i < orden.length; i++) {
      nuevaCalificacion(orden[i], 'coach', orden[i].coachId, COMENTARIOS_COACH, CLAVES_COACH, 0.18, 170);
      if (orden[i].mesesAntiguedad >= 5 && probable(0.62)) {
        nuevaCalificacion(orden[i], 'coach', orden[i].coachId, COMENTARIOS_COACH, CLAVES_COACH, 0.15, 60);
      }
    }

    /* --- Al gimnasio: una reseña por socio y algunas repetidas más recientes --- */
    orden = barajar(evaluadores);
    for (i = 0; i < orden.length; i++) {
      nuevaCalificacion(orden[i], 'gimnasio', 'gym', COMENTARIOS_GYM, CLAVES_GYM, 0.22, 170);
      if (probable(0.18)) {
        nuevaCalificacion(orden[i], 'gimnasio', 'gym', COMENTARIOS_GYM, CLAVES_GYM, 0.30, 45);
      }
    }

    calificaciones.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    return calificaciones;
  }

  /* =============================================================
     18. Avisos, clases y notificaciones
     ============================================================= */

  function construirAvisos(usuarios, hoy, directorId) {
    return AVISOS_DEF.map(function (def) {
      var fecha = sumaDias(hoy, -def.diasAtras);
      var lectores = barajar(usuarios.filter(function (u) {
        if (def.para === 'socios') return u.rol === 'socio';
        if (def.para === 'coaches') return u.rol === 'coach';
        return u.rol !== 'director';
      })).slice(0, ent(6, 24)).map(function (u) { return u.id; });

      return {
        id: nuevoId('av_'),
        titulo: def.titulo,
        cuerpo: def.cuerpo,
        para: def.para,
        autorId: directorId,
        fecha: fecha,
        prioridad: def.prioridad,
        leidoPor: lectores
      };
    });
  }

  function construirClases(coaches, socios) {
    var activos = socios.filter(function (s) { return s.estado === 'activo'; });
    return CLASES_DEF.map(function (def) {
      var coach = coaches[def.coach] || coaches[0];
      var inscritos = barajar(activos)
        .slice(0, ent(Math.round(def.cupo * 0.45), def.cupo))
        .map(function (s) { return s.id; });

      return {
        id: nuevoId('cl_'),
        nombre: def.nombre,
        coachId: coach.id,
        dia: def.dia,
        hora: def.hora,
        duracionMin: def.dur,
        cupo: def.cupo,
        inscritos: inscritos,
        salon: def.salon,
        color: def.color,
        activa: true
      };
    });
  }

  /** ~15 notificaciones repartidas entre las tres cuentas de demostración. */
  function construirNotificaciones(hoy, ana, marco, directorId) {
    var lista = [];
    var anaId = ana ? ana.id : 'u_0007';

    function agregar(usuarioId, titulo, cuerpo, tipo, diasAtras, hora, leida, link, clave) {
      lista.push({
        id: nuevoId('nt_'),
        usuarioId: usuarioId,
        titulo: titulo,
        cuerpo: cuerpo,
        tipo: tipo,
        fecha: marcaDe(sumaDias(hoy, -diasAtras), hora, ent(0, 59)),
        leida: leida,
        link: link,
        clave: clave || ''
      });
    }

    /* --- Socio de demostración --- */
    agregar(anaId, 'Tu mensualidad está por vencer',
      'Tu plan Mensual llega a su corte esta semana. Puedes renovar en recepción o desde tu panel de membresía.',
      'pago', 1, 9, false, '#/socio/membresia', 'demo-pago-por-vencer');
    agregar(anaId, 'Nueva medición disponible',
      'Tu coach Marco Ibarra ya subió tu medición de inicio de mes. Revisa el comparativo contra el cierre anterior.',
      'medicion', 3, 11, false, '#/socio/progreso', 'demo-medicion');
    agregar(anaId, 'Tu rutina fue actualizada',
      'Se ajustaron las cargas del bloque de definición y se agregó una sesión metabólica los viernes.',
      'rutina', 6, 18, true, '#/socio/rutina', 'demo-rutina');
    agregar(anaId, 'Nuevo aviso del gimnasio',
      'Mantenimiento de regaderas del vestidor: revisa los horarios afectados de esta semana.',
      'aviso', 4, 8, false, '#/socio/inicio', 'demo-aviso');
    agregar(anaId, 'Plan de alimentación actualizado',
      'Daniela Fuentes ajustó tus calorías y agregó opciones nuevas para la colación de la tarde.',
      'sistema', 12, 13, true, '#/socio/nutricion', 'demo-nutricion');
    agregar(anaId, 'Llevas cuatro semanas seguidas entrenando',
      'Excelente racha. Sigue registrando tus sesiones para que tu coach ajuste las cargas a tiempo.',
      'sistema', 9, 20, true, '#/socio/progreso', 'demo-racha');

    /* --- Coach de demostración --- */
    if (marco) {
      agregar(marco.id, 'Mediciones de cierre pendientes',
        'Tienes socios sin medición de cierre en el mes en curso. Agenda las citas antes del último día.',
        'medicion', 2, 8, false, '#/coach/mediciones', 'demo-coach-mediciones');
      agregar(marco.id, 'Nueva calificación recibida',
        'Un socio calificó tu servicio con 5 estrellas y dejó un comentario. Revísalo en tus calificaciones.',
        'sistema', 5, 16, false, '#/coach/calificaciones', 'demo-coach-calificacion');
      agregar(marco.id, 'Socio nuevo asignado',
        'Se te asignó un socio nuevo. Programa su valoración inicial durante la primera semana.',
        'sistema', 8, 10, true, '#/coach/socios', 'demo-coach-nuevo');
      agregar(marco.id, 'Recordatorio de clase',
        'Tu clase de Box de los martes a las 20:00 tiene lista de espera. Confirma asistencia con recepción.',
        'aviso', 3, 12, true, '#/coach/clases', 'demo-coach-clase');
      agregar(marco.id, 'Rutinas por revisar',
        'Hay socios con más de ocho semanas en el mismo bloque. Toca revisar y progresar cargas.',
        'rutina', 11, 9, true, '#/coach/rutinas', 'demo-coach-rutinas');
    }

    /* --- Dirección --- */
    agregar(directorId, 'Membresías vencidas por recuperar',
      'Varios socios cerraron su periodo y no han renovado. Conviene lanzar la campaña de recuperación.',
      'pago', 1, 8, false, '#/director/pagos', 'demo-dir-vencidos');
    agregar(directorId, 'Corte de caja del mes anterior',
      'El reporte del mes anterior ya está listo con ingresos, egresos y utilidad estimada.',
      'sistema', 4, 19, false, '#/director/reportes', 'demo-dir-corte');
    agregar(directorId, 'Nueva calificación con crítica',
      'Se recibió una calificación de 2 estrellas sobre el horario pico. Ya tiene respuesta de dirección.',
      'sistema', 7, 11, true, '#/director/calificaciones', 'demo-dir-calificacion');
    agregar(directorId, 'Aviso publicado',
      'El comunicado de mantenimiento de regaderas quedó publicado para todos los socios.',
      'aviso', 4, 9, true, '#/director/avisos', 'demo-dir-aviso');

    lista.sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    return lista;
  }

  /* =============================================================
     19. Ensamblado final
     ============================================================= */

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

  /* Campos internos del generador que no forman parte del contrato. */
  var CAMPOS_TEMPORALES = ['edadCalculada', 'mesesAntiguedad', 'indiceAlta'];

  function limpiarSocio(socio) {
    for (var i = 0; i < CAMPOS_TEMPORALES.length; i++) delete socio[CAMPOS_TEMPORALES[i]];
    if (!socio.avatarColor) {
      socio.avatarColor = (AG.Utils && typeof AG.Utils.colorDe === 'function')
        ? AG.Utils.colorDe(socio.nombre + ' ' + socio.apellidos + socio.id)
        : '#e4322b';
    }
    return socio;
  }

  AG.Seed = AG.Seed || {};
  AG.Seed.SEMILLA = SEMILLA;

  /**
   * Construye el state COMPLETO del sistema con ocho meses de historia
   * que terminan en el mes en curso. Determinista gracias a la semilla.
   * @returns {Object} state listo para AG.DB
   */
  AG.Seed.construir = function () {
    /* Reinicio del azar y de los contadores: mismas recargas, mismos datos. */
    azar = mulberry32(SEMILLA);
    contadores = {};

    var hoy = hoyISO();
    var mesHoy = mesDe(hoy);

    /* Ventana de ocho meses: índice 0 = hace siete meses, índice 7 = mes actual. */
    var mesesVentana = [];
    for (var v = 7; v >= 0; v--) mesesVentana.push(mesDe(sumaMeses(primerDiaMes(mesHoy), -v)));

    var inicioVentana = primerDiaMes(mesesVentana[0]);

    /* ---------- Catálogos y personal ---------- */
    var planes = construirPlanes();
    var director = construirDirector(sumaDias(sumaMeses(hoy, -68), ent(-10, 10)));
    var coaches = construirCoaches(hoy);

    /* ---------- Padrón ---------- */
    var socios = construirSocios(planes, coaches, hoy, mesesVentana);
    var ana = socios[0];

    /* ---------- Pagos y vencimientos ---------- */
    var resultadoPagos = construirPagos(socios, planes, hoy, director.id);
    var pagos = resultadoPagos.pagos;
    var vencimientos = resultadoPagos.vencimientos;

    for (var s = 0; s < socios.length; s++) {
      var venc = vencimientos[socios[s].id];
      if (venc) socios[s].fechaVencimiento = venc;
    }

    /* ---------- Mediciones ---------- */
    var resultadoMediciones = construirMediciones(socios, hoy, mesesVentana);
    var mediciones = resultadoMediciones.mediciones;
    var estadoFinal = resultadoMediciones.estadoFinal;

    /* ---------- Rutinas y asignaciones ---------- */
    var rutinas = construirRutinas(coaches, hoy);
    var asignaciones = construirAsignaciones(socios, rutinas, hoy);

    /* ---------- Adherencia por socio ---------- */
    var adherencias = {};
    for (var a = 0; a < socios.length; a++) {
      if (socios[a].id === ana.id) adherencias[socios[a].id] = 0.85;
      else if (socios[a].estado === 'activo') adherencias[socios[a].id] = real(0.34, 0.95, 2);
      else adherencias[socios[a].id] = real(0.30, 0.62, 2);
    }

    /* ---------- Bitácoras y asistencias ---------- */
    var bitacoras = construirBitacoras(socios, asignaciones, rutinas, hoy, adherencias, estadoFinal, vencimientos);
    var asistencias = construirAsistencias(socios, bitacoras, hoy, adherencias, vencimientos);

    /* ---------- Nutrición, calificaciones y comunicación ---------- */
    var planesNutricion = construirPlanesNutricion(socios, estadoFinal, hoy);
    var calificaciones = construirCalificaciones(socios, hoy, director.id);

    var usuarios = [director].concat(coaches, socios);
    var avisos = construirAvisos(usuarios, hoy, director.id);
    var clases = construirClases(coaches, socios);
    var notificaciones = construirNotificaciones(hoy, ana, coaches[0], director.id);

    /* ---------- Limpieza de campos auxiliares ---------- */
    for (var c = 0; c < socios.length; c++) limpiarSocio(socios[c]);

    /* ---------- State final ---------- */
    return {
      meta: {
        version: 1,
        creado: marcaDe(inicioVentana, 8, 0),
        actualizado: new Date().toISOString(),
        folioPago: pagos.length + 1
      },
      settings: settingsPorDefecto(),
      planes: planes,
      usuarios: usuarios,
      pagos: pagos,
      mediciones: mediciones,
      rutinas: rutinas,
      asignaciones: asignaciones,
      bitacoras: bitacoras,
      planesNutricion: planesNutricion,
      calificaciones: calificaciones,
      asistencias: asistencias,
      avisos: avisos,
      clases: clases,
      notificaciones: notificaciones
    };
  };

})(window.AG);
