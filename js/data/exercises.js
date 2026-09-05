/* =============================================================
   ALLIANCE GYM — Catálogo de ejercicios
   Biblioteca profesional en español (es-MX).
   Expone: AG.Data.exercises, AG.Data.GRUPOS, AG.Data.EQUIPOS,
           AG.Data.ejercicio(id), AG.Data.ejerciciosPor(filtro),
           AG.Data.nombreEjercicio(id)
   ============================================================= */
window.AG = window.AG || {};
(function (AG) {
  'use strict';

  AG.Data = AG.Data || {};

  /* -------------------------------------------------------------
     Catálogo de ejercicios.
     Campos: id, nombre, grupo, grupos, equipo, nivel, tipo,
             instrucciones, consejos, musculos.
     "grupos" incluye el grupo principal seguido de los secundarios.
     ------------------------------------------------------------- */
  AG.Data.exercises = [

    /* ======================= PECHO ======================= */
    {
      id: 'ej_press_banca_barra',
      nombre: 'Press de banca con barra',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps', 'hombros'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Acuéstate en la banca con los pies bien plantados en el piso y junta los omóplatos para crear una base firme. Toma la barra un poco más abierto que el ancho de los hombros y bájala controlada hasta rozar la parte media del pecho. Empuja hacia arriba extendiendo los codos sin bloquearlos de golpe, manteniendo la muñeca alineada con el antebrazo.',
      consejos: 'No rebotes la barra en el pecho ni despegues la cadera de la banca: pierdes tensión en el pectoral y castigas la espalda baja.',
      musculos: 'Pectoral mayor, deltoides anterior, tríceps'
    },
    {
      id: 'ej_press_inclinado_barra',
      nombre: 'Press inclinado con barra',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros', 'triceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el respaldo entre 30 y 45 grados y siéntate con la espalda apoyada y los omóplatos retraídos. Baja la barra controlada hasta la parte alta del pecho, justo debajo de las clavículas. Empuja en línea recta hacia arriba manteniendo los codos a unos 45 grados respecto al torso.',
      consejos: 'Si inclinas la banca más de 45 grados el trabajo se va casi todo al hombro; conserva el ángulo bajo para castigar el pectoral superior.',
      musculos: 'Pectoral superior, deltoides anterior, tríceps'
    },
    {
      id: 'ej_press_declinado_barra',
      nombre: 'Press declinado con barra',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Asegura los pies en los soportes de la banca declinada y acomódate con los omóplatos firmes contra el respaldo. Baja la barra hacia la parte baja del pecho y detente al rozarla. Empuja hacia arriba y ligeramente hacia atrás, siguiendo la línea natural del hombro.',
      consejos: 'Pide que te ayuden a sacar y a guardar la barra: en declinado la salida y la entrada son la parte más riesgosa del movimiento.',
      musculos: 'Pectoral inferior, tríceps, deltoides anterior'
    },
    {
      id: 'ej_press_banca_mancuernas',
      nombre: 'Press de banca con mancuernas',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps', 'hombros'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate en la banca con las mancuernas apoyadas sobre los muslos y usa el impulso de las piernas para recostarte con ellas a la altura del pecho. Baja hasta que los codos queden apenas por debajo de la línea del torso, sintiendo el estiramiento del pectoral. Sube acercando las mancuernas sin chocarlas y con la muñeca firme.',
      consejos: 'Evita abrir los codos a 90 grados exactos; un ángulo de 45 a 60 grados cuida el hombro y mantiene la tensión en el pecho.',
      musculos: 'Pectoral mayor, deltoides anterior, tríceps'
    },
    {
      id: 'ej_press_inclinado_mancuernas',
      nombre: 'Press inclinado con mancuernas',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros', 'triceps'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la banca a 30 o 40 grados y recuéstate con las mancuernas a la altura de los hombros y las palmas al frente. Desciende de forma controlada hasta sentir el estiramiento en la parte alta del pecho. Empuja hacia arriba describiendo un ligero arco, sin dejar que los codos caigan por detrás del cuerpo.',
      consejos: 'No dejes que las mancuernas se vayan hacia la cara: el recorrido termina sobre la parte alta del pecho, no sobre el cuello.',
      musculos: 'Pectoral superior, deltoides anterior, tríceps'
    },
    {
      id: 'ej_aperturas_mancuernas',
      nombre: 'Aperturas con mancuernas',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Recuéstate en banca plana con las mancuernas arriba, palmas enfrentadas y codos ligeramente flexionados. Abre los brazos en un arco amplio hasta que las manos queden a la altura del pecho, sin bajar de más. Cierra apretando el pectoral y conserva la misma flexión de codo durante todo el recorrido.',
      consejos: 'Si tienes que flexionar y extender el codo para subir el peso, está muy pesado: baja la carga y busca el estiramiento.',
      musculos: 'Pectoral mayor, deltoides anterior'
    },
    {
      id: 'ej_aperturas_inclinadas_mancuernas',
      nombre: 'Aperturas inclinadas con mancuernas',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Con la banca a 30 grados, sube las mancuernas sobre el pecho con las palmas enfrentadas y los codos suaves. Abre lentamente hasta sentir el estiramiento en la inserción alta del pectoral. Regresa juntando las manos por arriba del pecho y aprieta un segundo en la parte final.',
      consejos: 'Controla la bajada al menos dos segundos; en aperturas el estímulo está en la fase excéntrica, no en el jalón de subida.',
      musculos: 'Pectoral superior, deltoides anterior'
    },
    {
      id: 'ej_cruce_poleas',
      nombre: 'Cruce de poleas',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca las poleas a la altura de los hombros o un poco más arriba y toma un mango en cada mano. Da un paso al frente con el torso ligeramente inclinado y los codos suaves. Junta las manos al frente y abajo cruzando una ligeramente sobre la otra, aprieta el pectoral y regresa controlando la apertura.',
      consejos: 'No conviertas el ejercicio en un empujón de tríceps: el codo mantiene su ángulo y el movimiento nace del hombro.',
      musculos: 'Pectoral mayor, pectoral inferior, deltoides anterior'
    },
    {
      id: 'ej_cruce_poleas_bajo',
      nombre: 'Cruce de poleas bajo',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Baja las poleas hasta la posición más cercana al piso y toma un mango con cada mano con las palmas al frente. Sube los brazos en arco hasta juntar las manos a la altura de la clavícula. Aprieta el pectoral superior arriba y baja despacio sin dejar que el peso te jale los hombros.',
      consejos: 'Mantén el pecho alto y los hombros hacia atrás; si te encorvas, el trabajo se pasa al deltoides anterior.',
      musculos: 'Pectoral superior, deltoides anterior'
    },
    {
      id: 'ej_mariposa_maquina',
      nombre: 'Mariposa en máquina (pec deck)',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el asiento para que los mangos queden a la altura del pecho y siéntate con la espalda completamente apoyada. Junta los brazos al frente en un arco amplio hasta que las manos casi se toquen. Aprieta un segundo y regresa controlado hasta sentir el estiramiento, sin soltar el peso de golpe.',
      consejos: 'No adelantes los hombros al cerrar; mantenlos pegados al respaldo para que trabaje el pectoral y no la articulación.',
      musculos: 'Pectoral mayor, deltoides anterior'
    },
    {
      id: 'ej_press_pecho_maquina',
      nombre: 'Press de pecho en máquina',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps', 'hombros'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el asiento para que los mangos queden alineados con la parte media del pecho. Siéntate con la espalda apoyada y los pies firmes, y empuja al frente hasta extender casi por completo los codos. Regresa controlado hasta que las manos queden a la altura del torso.',
      consejos: 'Es la mejor opción para aprender el patrón de empuje o para llegar al fallo con seguridad cuando entrenas sin compañero.',
      musculos: 'Pectoral mayor, tríceps, deltoides anterior'
    },
    {
      id: 'ej_lagartijas',
      nombre: 'Lagartijas',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Colócate en plancha alta con las manos un poco más abiertas que los hombros y el cuerpo en línea recta de cabeza a talones. Baja el pecho hasta quedar a un puño del piso llevando los codos hacia atrás en diagonal. Empuja para volver arriba apretando glúteo y abdomen todo el tiempo.',
      consejos: 'La cadera no se hunde ni se levanta: si no aguantas la línea, apoya las rodillas antes de perder la técnica.',
      musculos: 'Pectoral mayor, tríceps, core, deltoides anterior'
    },
    {
      id: 'ej_lagartijas_manos_elevadas',
      nombre: 'Lagartijas con manos elevadas',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Apoya las manos en una banca, un cajón o una barra fija a la altura de la cadera. Baja el pecho hacia el apoyo manteniendo el cuerpo recto y los codos en diagonal. Empuja hasta extender los brazos sin dejar caer la cadera.',
      consejos: 'Entre más alto el apoyo, más fácil resulta: úsalo para acumular repeticiones limpias antes de pasar a la lagartija en piso.',
      musculos: 'Pectoral mayor, tríceps, core'
    },
    {
      id: 'ej_fondos_paralelas_pecho',
      nombre: 'Fondos en paralelas para pecho',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Sujétate de las barras paralelas con los brazos extendidos y el cuerpo suspendido. Inclina el torso al frente unos 30 grados, cruza los tobillos y baja abriendo ligeramente los codos hasta que el hombro quede a la altura del codo. Empuja para subir manteniendo la inclinación del torso.',
      consejos: 'Si bajas más allá del rango cómodo del hombro aumentas el riesgo sin ganar estímulo: corta la profundidad donde tengas control.',
      musculos: 'Pectoral inferior, tríceps, deltoides anterior'
    },
    {
      id: 'ej_pullover_mancuerna',
      nombre: 'Pullover con mancuerna',
      grupo: 'pecho',
      grupos: ['pecho', 'espalda'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Recuéstate a lo largo de una banca plana sujetando una mancuerna con ambas manos sobre el pecho. Con los codos ligeramente flexionados, lleva la mancuerna por detrás de la cabeza hasta sentir el estiramiento de las costillas y el dorsal. Regresa jalando con el pecho hasta la vertical sin pasar de ella.',
      consejos: 'No arquees la espalda baja para ganar rango: la caja torácica se abre, la cadera se queda quieta.',
      musculos: 'Pectoral mayor, dorsal ancho, serrato anterior'
    },
    {
      id: 'ej_aperturas_banda',
      nombre: 'Aperturas con banda elástica',
      grupo: 'pecho',
      grupos: ['pecho', 'hombros'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Fija la banda a la altura del pecho detrás de ti y toma un extremo con cada mano dando un paso al frente. Con los codos suaves, junta las manos al frente en arco hasta que se toquen. Aprieta el pectoral y regresa resistiendo la tensión de la banda.',
      consejos: 'Ideal para entrenar en casa o para calentar el hombro antes del press: busca tensión constante, no repeticiones rápidas.',
      musculos: 'Pectoral mayor, deltoides anterior'
    },
    {
      id: 'ej_press_piso_mancuernas',
      nombre: 'Press de piso con mancuernas',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Acuéstate boca arriba en el piso con las rodillas flexionadas y las mancuernas sobre el pecho. Baja hasta que la parte de atrás del brazo toque el suelo y haz una pausa breve. Empuja hacia arriba de forma explosiva sin despegar la espalda alta del piso.',
      consejos: 'La pausa abajo elimina el rebote y es perfecta para hombros sensibles porque limita el rango sin sacrificar carga.',
      musculos: 'Pectoral mayor, tríceps, deltoides anterior'
    },
    {
      id: 'ej_lagartijas_palmada',
      nombre: 'Lagartijas con palmada',
      grupo: 'pecho',
      grupos: ['pecho', 'triceps', 'cuerpo_completo'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Parte de una plancha alta sólida con el abdomen y el glúteo apretados. Baja controlado y empuja con toda la fuerza para despegar las manos del piso. Da una palmada rápida y vuelve a apoyar las manos amortiguando la caída con los codos.',
      consejos: 'Solo súbete a esta variante si haces veinte lagartijas limpias; de lo contrario aterrizarás con la muñeca desprotegida.',
      musculos: 'Pectoral mayor, tríceps, core, deltoides anterior'
    },

    /* ====================== ESPALDA ====================== */
    {
      id: 'ej_dominadas',
      nombre: 'Dominadas',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Cuélgate de la barra con agarre prono un poco más abierto que los hombros y los brazos extendidos. Baja los omóplatos y jala con los codos hacia las costillas hasta pasar la barbilla por encima de la barra. Desciende controlado hasta la extensión completa sin balancear el cuerpo.',
      consejos: 'No arranques con las piernas: aprieta glúteo y abdomen para que el cuerpo quede rígido y jale solo la espalda.',
      musculos: 'Dorsal ancho, redondo mayor, bíceps, core'
    },
    {
      id: 'ej_dominadas_supinas',
      nombre: 'Dominadas supinas',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Toma la barra con las palmas hacia ti al ancho de los hombros y cuélgate con los brazos estirados. Jala llevando el pecho hacia la barra y los codos pegados al costado. Baja despacio hasta estirar por completo antes de la siguiente repetición.',
      consejos: 'El agarre supino da más participación del bíceps: úsalo para acumular repeticiones si aún no dominas la versión prona.',
      musculos: 'Dorsal ancho, bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_dominadas_asistidas',
      nombre: 'Dominadas asistidas en máquina',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'fuerza',
      instrucciones: 'Selecciona el contrapeso que te permita hacer entre ocho y doce repeticiones y apoya las rodillas en la plataforma. Sujeta la barra con agarre prono y jala hasta que la barbilla rebase la barra. Baja controlado en tres segundos aprovechando la asistencia.',
      consejos: 'Reduce el contrapeso cinco kilos cada vez que superes las doce repeticiones; así llegas a la dominada libre por progresión.',
      musculos: 'Dorsal ancho, redondo mayor, bíceps'
    },
    {
      id: 'ej_jalon_al_pecho',
      nombre: 'Jalón al pecho',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate y ajusta el rodillo para que sujete bien los muslos. Toma la barra con agarre prono abierto, saca el pecho e inclina el torso apenas hacia atrás. Jala la barra hasta la parte alta del pecho llevando los codos abajo y atrás, y regresa estirando por completo los brazos.',
      consejos: 'Nada de jalar detrás de la nuca ni de mecer el cuerpo: el recorrido termina en el pecho y la cadera no se mueve.',
      musculos: 'Dorsal ancho, redondo mayor, bíceps, trapecio medio'
    },
    {
      id: 'ej_jalon_agarre_neutro',
      nombre: 'Jalón con agarre neutro',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca el triángulo o barra de agarre neutro y siéntate con los muslos fijos bajo el rodillo. Jala el mango hacia la parte media del pecho manteniendo los codos pegados al cuerpo. Aprieta la espalda un segundo abajo y sube controlando hasta el estiramiento.',
      consejos: 'El agarre neutro es el más amable con el hombro: úsalo cuando la barra ancha te moleste en la articulación.',
      musculos: 'Dorsal ancho, romboides, bíceps'
    },
    {
      id: 'ej_jalon_agarre_supino',
      nombre: 'Jalón con agarre supino',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta la barra con las palmas hacia ti al ancho de los hombros y siéntate con el pecho alto. Jala la barra hacia la parte baja del pecho con los codos rozando las costillas. Sube resistiendo hasta que los brazos queden completamente extendidos.',
      consejos: 'Piensa en jalar con los codos, no con las manos, para que el dorsal trabaje más que el bíceps.',
      musculos: 'Dorsal ancho, bíceps braquial, trapecio inferior'
    },
    {
      id: 'ej_remo_barra',
      nombre: 'Remo con barra',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps', 'hombros'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'De pie con los pies al ancho de cadera, flexiona ligeramente las rodillas y lleva la cadera atrás hasta inclinar el torso unos 45 grados con la espalda recta. Jala la barra hacia el ombligo llevando los codos hacia atrás. Baja controlado hasta estirar los brazos sin redondear la espalda.',
      consejos: 'Si tienes que impulsar con las piernas o levantar el torso en cada repetición, quítale peso a la barra.',
      musculos: 'Dorsal ancho, romboides, trapecio medio, bíceps'
    },
    {
      id: 'ej_remo_pendlay',
      nombre: 'Remo Pendlay',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'barra',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Coloca la barra en el piso y párate con el torso casi paralelo al suelo y la espalda plana. Jala explosivo hasta tocar la parte baja del pecho y regresa la barra hasta el piso en cada repetición. Reinicia desde cero con el torso siempre en la misma posición.',
      consejos: 'El torso debe quedarse paralelo al piso todo el tiempo; si sube al jalar, ya no es remo Pendlay y pierdes el estímulo.',
      musculos: 'Dorsal ancho, trapecio medio, romboides, erectores'
    },
    {
      id: 'ej_remo_mancuerna_una_mano',
      nombre: 'Remo con mancuerna a una mano',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Apoya una rodilla y una mano en la banca dejando la espalda paralela al piso. Con la otra mano sujeta la mancuerna y jálala hacia la cadera manteniendo el codo cerca del cuerpo. Baja hasta estirar por completo el brazo y sentir el estiramiento del dorsal.',
      consejos: 'No gires el torso para levantar más peso: los hombros se mantienen paralelos al piso durante toda la serie.',
      musculos: 'Dorsal ancho, redondo mayor, romboides, bíceps'
    },
    {
      id: 'ej_remo_en_t',
      nombre: 'Remo en T',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca un extremo de la barra en una esquina o en el soporte de piso y carga discos en el otro. Toma el mango en V por debajo de la barra, inclina el torso con la espalda recta y jala hacia el abdomen. Baja controlado hasta estirar los brazos sin dejar caer el pecho.',
      consejos: 'Mantén el pecho abierto y el cuello neutro; mirar al frente en exceso arquea el cuello y te saca de posición.',
      musculos: 'Dorsal ancho, trapecio medio, romboides, bíceps'
    },
    {
      id: 'ej_remo_sentado_polea',
      nombre: 'Remo sentado en polea',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate con los pies en la plataforma y las rodillas ligeramente flexionadas, y toma el mango con la espalda recta. Jala hacia el ombligo llevando los codos pegados al torso y juntando los omóplatos. Regresa estirando los brazos hasta sentir el dorsal sin encorvarte.',
      consejos: 'La cadera no se columpia: el torso apenas se mueve unos grados y todo el trabajo lo hacen los brazos y la espalda.',
      musculos: 'Dorsal ancho, romboides, trapecio medio, bíceps'
    },
    {
      id: 'ej_remo_maquina',
      nombre: 'Remo en máquina',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el asiento para que los mangos queden a la altura del abdomen y apoya el pecho firmemente en el soporte. Jala los mangos hacia atrás juntando los omóplatos y llevando los codos junto al cuerpo. Regresa despacio hasta la extensión completa de los brazos.',
      consejos: 'El apoyo del pecho evita hacer trampa con la espalda baja: aprovéchalo para subir carga con seguridad.',
      musculos: 'Dorsal ancho, romboides, trapecio medio'
    },
    {
      id: 'ej_remo_invertido',
      nombre: 'Remo invertido',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Coloca una barra a la altura de la cadera en el rack o en el multipower y cuélgate por debajo con agarre prono. Con el cuerpo recto y los talones apoyados, jala el pecho hacia la barra apretando los omóplatos. Baja controlado hasta estirar los brazos sin dejar caer la cadera.',
      consejos: 'Entre más horizontal quede tu cuerpo, más difícil es: sube la barra para hacerlo accesible o bájala para complicarlo.',
      musculos: 'Dorsal ancho, romboides, trapecio medio, core'
    },
    {
      id: 'ej_remo_kettlebell',
      nombre: 'Remo con kettlebell',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps'],
      equipo: 'kettlebell',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Con los pies al ancho de cadera, lleva la cadera atrás e inclina el torso hasta casi paralelo al piso sujetando la kettlebell con una mano. Jala hacia la cadera manteniendo el codo cerca del costado y el hombro abajo. Baja hasta estirar el brazo controlando la pesa.',
      consejos: 'Aprieta el glúteo del lado libre para estabilizar la cadera y evitar que el torso rote en cada repetición.',
      musculos: 'Dorsal ancho, redondo mayor, romboides, core'
    },
    {
      id: 'ej_peso_muerto_convencional',
      nombre: 'Peso muerto convencional',
      grupo: 'espalda',
      grupos: ['espalda', 'piernas', 'gluteos', 'cuerpo_completo'],
      equipo: 'barra',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Coloca los pies al ancho de cadera con la barra sobre el medio del pie y toma el agarre por fuera de las rodillas. Baja la cadera hasta tensar la espalda, saca el pecho y despega la barra empujando el piso con las piernas. Extiende cadera y rodillas al mismo tiempo y baja la barra pegada a las piernas.',
      consejos: 'La espalda nunca se redondea: si no puedes mantenerla plana desde el arranque, sube la barra sobre bloques o baja el peso.',
      musculos: 'Erectores espinales, glúteo mayor, isquiotibiales, dorsal ancho, trapecio'
    },
    {
      id: 'ej_pullover_polea',
      nombre: 'Pullover en polea alta',
      grupo: 'espalda',
      grupos: ['espalda', 'pecho'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Colócate frente a la polea alta con una barra recta y los brazos casi extendidos por encima de la cabeza. Inclina el torso ligeramente al frente y baja la barra en arco hasta los muslos manteniendo los codos casi fijos. Regresa despacio hasta sentir el estiramiento del dorsal.',
      consejos: 'Si flexionas el codo lo conviertes en jalón de tríceps: el brazo permanece largo y el movimiento nace del hombro.',
      musculos: 'Dorsal ancho, redondo mayor, pectoral, tríceps largo'
    },
    {
      id: 'ej_encogimientos_barra',
      nombre: 'Encogimientos con barra',
      grupo: 'espalda',
      grupos: ['espalda', 'hombros'],
      equipo: 'barra',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'De pie, sujeta la barra por delante del cuerpo con agarre prono al ancho de hombros y los brazos estirados. Eleva los hombros lo más alto posible como si quisieras tocar las orejas. Aprieta un segundo arriba y baja controlado hasta el estiramiento del trapecio.',
      consejos: 'No hagas círculos con los hombros: el movimiento es recto hacia arriba y hacia abajo para cuidar el cuello.',
      musculos: 'Trapecio superior, elevador de la escápula'
    },
    {
      id: 'ej_encogimientos_mancuernas',
      nombre: 'Encogimientos con mancuernas',
      grupo: 'espalda',
      grupos: ['espalda', 'hombros'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta una mancuerna a cada costado con los brazos extendidos y la espalda recta. Encoge los hombros hacia arriba sin flexionar los codos y haz una pausa arriba. Baja despacio hasta sentir el jalón del trapecio.',
      consejos: 'Usa correas si el agarre se rinde antes que el trapecio; es el músculo objetivo el que debe fallar primero.',
      musculos: 'Trapecio superior, elevador de la escápula'
    },
    {
      id: 'ej_hiperextensiones',
      nombre: 'Hiperextensiones',
      grupo: 'espalda',
      grupos: ['espalda', 'gluteos', 'piernas'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'fuerza',
      instrucciones: 'Acomódate en el banco romano con el borde del apoyo justo debajo de la cadera y los tobillos asegurados. Baja el torso flexionando la cadera hasta sentir el estiramiento de los isquiotibiales. Sube hasta alinear el cuerpo apretando glúteo y espalda baja, sin pasar de la línea recta.',
      consejos: 'No hiperextiendas la zona lumbar al final: el cuerpo se detiene cuando queda recto, ni un grado más.',
      musculos: 'Erectores espinales, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_buenos_dias',
      nombre: 'Buenos días con barra',
      grupo: 'espalda',
      grupos: ['espalda', 'piernas', 'gluteos'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Coloca la barra sobre el trapecio como en sentadilla, con los pies al ancho de cadera y las rodillas suaves. Lleva la cadera hacia atrás bajando el torso hasta quedar casi paralelo al piso, con la espalda recta. Sube empujando la cadera al frente y apretando el glúteo arriba.',
      consejos: 'Empieza con la barra vacía: es un ejercicio de bisagra de cadera y la técnica pesa más que la carga.',
      musculos: 'Erectores espinales, isquiotibiales, glúteo mayor'
    },
    {
      id: 'ej_jalon_banda',
      nombre: 'Jalón con banda elástica',
      grupo: 'espalda',
      grupos: ['espalda', 'biceps', 'hombros'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ancla la banda por encima de la cabeza y toma un extremo con cada mano, arrodillado o de pie. Jala hacia abajo y hacia el pecho llevando los codos junto al torso y juntando los omóplatos. Regresa acompañando la banda hasta la extensión completa.',
      consejos: 'Perfecto para calentar la espalda antes de dominadas o para entrenar fuera del gimnasio con poco equipo.',
      musculos: 'Dorsal ancho, romboides, trapecio inferior, bíceps'
    },

    /* ====================== HOMBROS ====================== */
    {
      id: 'ej_press_militar_barra',
      nombre: 'Press militar con barra',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps', 'abdomen'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'De pie con los pies al ancho de cadera, sujeta la barra a la altura de las clavículas con las manos poco más abiertas que los hombros. Aprieta glúteo y abdomen y empuja la barra en línea recta hacia arriba, metiendo la cabeza cuando pase la frente. Baja controlada hasta la clavícula sin perder la postura.',
      consejos: 'No arquees la espalda baja para sacar la repetición: si el peso no sube recto, es momento de bajar la carga.',
      musculos: 'Deltoides anterior, deltoides medio, tríceps, core'
    },
    {
      id: 'ej_press_militar_sentado',
      nombre: 'Press militar sentado con barra',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate en una banca con respaldo casi vertical y saca la barra a la altura de la barbilla. Empuja hacia arriba hasta extender los codos sin bloquearlos de golpe. Desciende controlado hasta que la barra quede al nivel de la nariz o la barbilla.',
      consejos: 'Apoya bien la espalda alta pero no la conviertas en press inclinado: el respaldo va casi vertical.',
      musculos: 'Deltoides anterior, deltoides medio, tríceps'
    },
    {
      id: 'ej_press_hombros_mancuernas',
      nombre: 'Press de hombros con mancuernas',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Sentado con la espalda apoyada, sube las mancuernas a la altura de las orejas con las palmas al frente y los codos abiertos a 45 grados. Empuja hacia arriba juntando ligeramente las mancuernas sin chocarlas. Baja controlado hasta que el codo quede a la altura del hombro.',
      consejos: 'Evita bajar de más buscando estiramiento: el hombro se irrita cuando el codo cae muy por debajo de la línea del deltoides.',
      musculos: 'Deltoides anterior, deltoides medio, tríceps'
    },
    {
      id: 'ej_press_arnold',
      nombre: 'Press Arnold',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Comienza sentado con las mancuernas frente al pecho y las palmas mirándote, como al final de un curl. Sube girando las muñecas hacia afuera hasta terminar con las palmas al frente y los brazos extendidos. Regresa deshaciendo el giro hasta la posición inicial.',
      consejos: 'El giro debe ser suave y continuo; hacerlo de golpe al final castiga el manguito rotador sin sumar estímulo.',
      musculos: 'Deltoides anterior, deltoides medio, tríceps'
    },
    {
      id: 'ej_press_hombros_maquina',
      nombre: 'Press de hombros en máquina',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el asiento para que los mangos queden a la altura de los hombros y siéntate con la espalda apoyada. Empuja hacia arriba hasta casi extender los codos. Regresa controlado hasta que las manos queden al nivel de las orejas.',
      consejos: 'Es la variante más segura para trabajar cerca del fallo porque la máquina controla la trayectoria por ti.',
      musculos: 'Deltoides anterior, deltoides medio, tríceps'
    },
    {
      id: 'ej_elevaciones_laterales',
      nombre: 'Elevaciones laterales',
      grupo: 'hombros',
      grupos: ['hombros'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'De pie con una mancuerna en cada mano a los costados y los codos ligeramente flexionados. Sube los brazos hacia los lados hasta la altura de los hombros, guiando con el codo y no con la mano. Baja despacio resistiendo el peso durante tres segundos.',
      consejos: 'Si tienes que aventar el peso con la cadera, está muy pesado: el deltoides medio responde mejor a cargas ligeras bien controladas.',
      musculos: 'Deltoides medio, supraespinoso, trapecio superior'
    },
    {
      id: 'ej_elevaciones_laterales_polea',
      nombre: 'Elevaciones laterales en polea',
      grupo: 'hombros',
      grupos: ['hombros'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la polea en la posición más baja y párate de costado tomando el mango con la mano más lejana. Eleva el brazo cruzando por delante del cuerpo hasta la altura del hombro. Baja controlado sin dejar que el cable te regrese de golpe.',
      consejos: 'La polea da tensión constante desde el inicio del recorrido, justo donde la mancuerna casi no pesa: no necesitas mucha carga.',
      musculos: 'Deltoides medio, supraespinoso'
    },
    {
      id: 'ej_elevaciones_frontales',
      nombre: 'Elevaciones frontales con mancuernas',
      grupo: 'hombros',
      grupos: ['hombros', 'pecho'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'De pie con las mancuernas al frente de los muslos y las palmas hacia el cuerpo. Sube un brazo al frente hasta la altura de los ojos manteniendo el codo casi recto. Baja controlado y alterna con el otro brazo.',
      consejos: 'No balancees el torso hacia atrás para ayudarte: aprieta el abdomen y deja que el hombro haga todo el trabajo.',
      musculos: 'Deltoides anterior, pectoral superior'
    },
    {
      id: 'ej_elevaciones_frontales_barra',
      nombre: 'Elevaciones frontales con barra',
      grupo: 'hombros',
      grupos: ['hombros', 'pecho'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta la barra con agarre prono al ancho de hombros y déjala descansar sobre los muslos. Elévala al frente con los brazos casi extendidos hasta la altura de los ojos. Baja despacio hasta rozar los muslos sin soltar la tensión.',
      consejos: 'Da un paso corto al frente con un pie para estabilizarte y evitar mecer la cadera al subir la barra.',
      musculos: 'Deltoides anterior, pectoral superior'
    },
    {
      id: 'ej_pajaros_mancuernas',
      nombre: 'Pájaros con mancuernas',
      grupo: 'hombros',
      grupos: ['hombros', 'espalda'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Inclina el torso llevando la cadera atrás hasta quedar casi paralelo al piso, con las mancuernas colgando bajo el pecho. Abre los brazos hacia los lados con los codos suaves hasta la altura de los hombros. Baja controlado sin que las mancuernas toquen el piso.',
      consejos: 'Si juntas mucho los omóplatos conviertes el ejercicio en remo: piensa en abrir, no en jalar hacia atrás.',
      musculos: 'Deltoides posterior, romboides, trapecio medio'
    },
    {
      id: 'ej_face_pull',
      nombre: 'Face pull en polea',
      grupo: 'hombros',
      grupos: ['hombros', 'espalda'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la cuerda en la polea a la altura de la cara y tómala con agarre neutro dando un paso atrás. Jala hacia la frente separando las manos y llevando los codos altos y abiertos. Aprieta un segundo y regresa controlado con los hombros abajo.',
      consejos: 'Es el mejor seguro para el hombro de quien hace mucho press: inclúyelo dos veces por semana con peso moderado.',
      musculos: 'Deltoides posterior, trapecio medio, rotadores externos'
    },
    {
      id: 'ej_remo_al_menton',
      nombre: 'Remo al mentón',
      grupo: 'hombros',
      grupos: ['hombros', 'espalda', 'biceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta la barra con agarre prono un poco más abierto que los hombros y déjala frente a los muslos. Jala hacia arriba llevando los codos altos hasta que la barra llegue a la parte alta del pecho. Baja controlado hasta estirar los brazos.',
      consejos: 'No subas la barra más allá de la clavícula ni cierres mucho el agarre: eso pinza el hombro.',
      musculos: 'Deltoides medio, trapecio superior, bíceps'
    },
    {
      id: 'ej_deltoide_posterior_maquina',
      nombre: 'Deltoides posterior en máquina',
      grupo: 'hombros',
      grupos: ['hombros', 'espalda'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate de frente al respaldo de la máquina de mariposa y toma los mangos con los brazos extendidos al frente. Abre hacia atrás en arco hasta alinear los brazos con los hombros. Regresa controlado sin dejar que las placas choquen.',
      consejos: 'Baja el peso y sube las repeticiones: el deltoides posterior es un músculo pequeño que responde a series largas.',
      musculos: 'Deltoides posterior, romboides, trapecio medio'
    },
    {
      id: 'ej_elevaciones_laterales_banda',
      nombre: 'Elevaciones laterales con banda',
      grupo: 'hombros',
      grupos: ['hombros'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Párate sobre el centro de la banda con los pies juntos y toma un extremo con cada mano. Sube los brazos a los lados hasta la altura de los hombros con los codos suaves. Baja resistiendo la tensión de la banda de forma lenta.',
      consejos: 'Excelente para calentar el hombro antes de entrenar empuje o para series finales de bombeo sin cargar peso.',
      musculos: 'Deltoides medio, supraespinoso'
    },
    {
      id: 'ej_press_kettlebell',
      nombre: 'Press de hombro con kettlebell',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps', 'abdomen'],
      equipo: 'kettlebell',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Sujeta la kettlebell en posición de rack, con la pesa apoyada en el antebrazo y el codo pegado a las costillas. Empuja hacia arriba girando ligeramente la muñeca hasta terminar con la palma al frente y el brazo extendido. Baja controlado al rack manteniendo el abdomen apretado.',
      consejos: 'La kettlebell cae por detrás de la mano: si la muñeca se dobla, la posición del rack está mal acomodada.',
      musculos: 'Deltoides anterior, deltoides medio, tríceps, core'
    },
    {
      id: 'ej_lagartija_pino',
      nombre: 'Lagartija en pino',
      grupo: 'hombros',
      grupos: ['hombros', 'triceps', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Colócate en plancha y camina los pies hacia las manos hasta formar una V invertida con la cadera bien alta. Flexiona los codos para bajar la coronilla hacia el piso, entre las manos. Empuja hasta extender los brazos manteniendo la cadera arriba.',
      consejos: 'Entre más cerca lleves los pies a las manos, más peso cargan los hombros: ajusta la distancia según tu nivel.',
      musculos: 'Deltoides anterior, tríceps, trapecio superior, core'
    },

    /* ======================= BÍCEPS ====================== */
    {
      id: 'ej_curl_barra',
      nombre: 'Curl con barra',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'barra',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'De pie con los pies al ancho de cadera, sujeta la barra con agarre supino al ancho de los hombros. Flexiona los codos subiendo la barra hasta la altura del pecho sin mover los brazos del costado. Baja controlado hasta estirar por completo los codos.',
      consejos: 'Los codos se quedan pegados a las costillas: si se van al frente, el trabajo se pasa al hombro.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_barra_z',
      nombre: 'Curl con barra Z',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'barra',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Toma la barra Z por las curvas internas con agarre supino y los codos junto al torso. Sube flexionando los codos hasta que los antebrazos queden verticales. Desciende despacio hasta la extensión completa sin balancear el cuerpo.',
      consejos: 'La barra Z reduce la tensión en la muñeca: úsala si el curl con barra recta te molesta en el antebrazo.',
      musculos: 'Bíceps braquial, braquiorradial'
    },
    {
      id: 'ej_curl_mancuernas_alterno',
      nombre: 'Curl alterno con mancuernas',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'De pie con una mancuerna en cada mano y las palmas hacia el cuerpo. Sube una mancuerna girando la muñeca hacia afuera conforme flexionas el codo y aprieta arriba. Baja controlado deshaciendo el giro y repite con el otro brazo.',
      consejos: 'Completa el giro de la muñeca antes de la mitad del recorrido para aprovechar la supinación del bíceps.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_martillo',
      nombre: 'Curl martillo',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta las mancuernas con las palmas enfrentadas y mantén ese agarre neutro durante todo el ejercicio. Sube flexionando el codo hasta la altura del hombro sin girar la muñeca. Baja despacio hasta estirar el brazo por completo.',
      consejos: 'Es el mejor ejercicio para engrosar el braquial y el antebrazo: no lo hagas con impulso de cadera.',
      musculos: 'Braquiorradial, braquial anterior, bíceps'
    },
    {
      id: 'ej_curl_concentrado',
      nombre: 'Curl concentrado',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate en la orilla de una banca con las piernas abiertas y apoya el codo en la cara interna del muslo. Sube la mancuerna hasta el hombro apretando el bíceps arriba. Baja controlado hasta estirar el brazo sin despegar el codo del muslo.',
      consejos: 'El apoyo en el muslo elimina todo el impulso: úsalo para el pico de contracción, no para levantar cargas grandes.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_banco_scott',
      nombre: 'Curl en banco Scott',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Acomoda el banco predicador para que la axila quede apoyada en la parte alta del respaldo. Sujeta la barra Z con agarre supino y baja hasta estirar casi por completo el codo. Sube flexionando hasta que el antebrazo quede vertical y aprieta un segundo.',
      consejos: 'No estires el codo de golpe en la parte baja: bájalo controlado para no jalar el tendón del bíceps.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_inclinado',
      nombre: 'Curl inclinado con mancuernas',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate en una banca inclinada a 45 grados y deja los brazos colgando por detrás de la línea del cuerpo. Sube las mancuernas flexionando el codo sin adelantar el brazo. Baja hasta el estiramiento completo del bíceps.',
      consejos: 'La posición estirada del inicio es lo valioso del ejercicio: no acortes el rango subiendo los hombros.',
      musculos: 'Bíceps braquial, porción larga del bíceps'
    },
    {
      id: 'ej_curl_polea',
      nombre: 'Curl en polea baja',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la barra recta en la polea baja y párate a un paso del aparato con los codos junto al torso. Flexiona los codos subiendo la barra hasta el pecho. Regresa controlado resistiendo el jalón del cable hasta estirar los brazos.',
      consejos: 'La polea mantiene tensión constante en todo el recorrido, así que no descanses arriba: sigue de largo.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_arana',
      nombre: 'Curl araña',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Acuéstate boca abajo sobre una banca inclinada dejando los brazos colgando en vertical con las mancuernas. Sube flexionando los codos hasta la altura del pecho sin mover los brazos. Baja controlado hasta la extensión completa.',
      consejos: 'Al quedar el brazo perpendicular al piso, el pico de tensión ocurre arriba: aprieta dos segundos en cada repetición.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_banda',
      nombre: 'Curl con banda elástica',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Párate sobre el centro de la banda con los pies al ancho de cadera y toma un extremo con cada mano en supinación. Sube flexionando los codos hasta el pecho contra la tensión de la banda. Baja despacio sin dejar que la banda te regrese sola.',
      consejos: 'Sepárate más los pies para aumentar la tensión inicial cuando la banda te quede floja.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_21',
      nombre: 'Curl 21',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Con la barra en agarre supino, haz siete repeticiones desde abajo hasta la mitad del recorrido. Sigue con siete repeticiones desde la mitad hasta arriba. Termina con siete repeticiones completas sin soltar la barra.',
      consejos: 'Usa menos peso del que crees: las últimas siete repeticiones completas son las que realmente duelen.',
      musculos: 'Bíceps braquial, braquial anterior'
    },
    {
      id: 'ej_curl_invertido',
      nombre: 'Curl invertido con barra',
      grupo: 'biceps',
      grupos: ['biceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta la barra con agarre prono al ancho de los hombros y los brazos extendidos frente a los muslos. Sube flexionando los codos manteniendo las muñecas firmes y ligeramente extendidas. Baja controlado hasta la extensión total.',
      consejos: 'Baja bastante el peso comparado con el curl normal: el antebrazo es el eslabón débil en esta variante.',
      musculos: 'Braquiorradial, braquial anterior, extensores del antebrazo'
    },

    /* ====================== TRÍCEPS ====================== */
    {
      id: 'ej_extension_triceps_polea',
      nombre: 'Extensión de tríceps en polea',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la barra recta en la polea alta y tómala con agarre prono al ancho de los hombros. Con los codos pegados al torso, extiende los brazos hasta abajo apretando el tríceps. Regresa controlado hasta que el antebrazo quede paralelo al piso.',
      consejos: 'Si los codos se abren o el torso se mece hacia adelante, el peso es excesivo: aísla el codo y baja la carga.',
      musculos: 'Tríceps braquial, ancóneo'
    },
    {
      id: 'ej_extension_triceps_cuerda',
      nombre: 'Extensión de tríceps con cuerda',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Sujeta la cuerda en la polea alta con agarre neutro y los codos junto a las costillas. Extiende los brazos hacia abajo separando las manos al final del recorrido. Regresa despacio hasta sentir el estiramiento del tríceps.',
      consejos: 'La separación de las manos al final aumenta la contracción; hazla suave, sin jalonear la cuerda.',
      musculos: 'Tríceps braquial, ancóneo'
    },
    {
      id: 'ej_extension_triceps_supino',
      nombre: 'Extensión de tríceps agarre supino',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Toma la barra de la polea alta con las palmas hacia arriba y los codos pegados al cuerpo. Extiende los brazos hacia abajo hasta bloquear suavemente el codo. Regresa controlado sin dejar que el hombro se adelante.',
      consejos: 'Este agarre castiga más la cabeza medial del tríceps: úsalo con poco peso y muchas repeticiones.',
      musculos: 'Tríceps braquial, cabeza medial'
    },
    {
      id: 'ej_press_frances',
      nombre: 'Press francés con barra Z',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Acostado en banca plana, sostén la barra Z con los brazos extendidos ligeramente inclinados hacia la cabeza. Flexiona solo los codos para bajar la barra hacia la frente o un poco atrás. Extiende los brazos apretando el tríceps sin mover los hombros.',
      consejos: 'Mantén el brazo inclinado hacia atrás en lugar de perfectamente vertical: así el tríceps nunca pierde tensión.',
      musculos: 'Tríceps braquial, cabeza larga'
    },
    {
      id: 'ej_extension_triceps_sobre_cabeza',
      nombre: 'Extensión de tríceps sobre la cabeza',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Sentado o de pie, sujeta una mancuerna con ambas manos por encima de la cabeza con los brazos extendidos. Baja flexionando los codos por detrás de la nuca hasta sentir el estiramiento. Sube extendiendo los brazos sin abrir los codos.',
      consejos: 'Aprieta el abdomen para no arquear la espalda baja cuando la mancuerna pase por detrás de la cabeza.',
      musculos: 'Tríceps braquial, cabeza larga'
    },
    {
      id: 'ej_patada_triceps',
      nombre: 'Patada de tríceps',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Inclina el torso hasta casi paralelo al piso apoyando una mano en la banca. Lleva el codo del brazo que trabaja a la altura del torso y mantenlo fijo. Extiende el antebrazo hacia atrás hasta alinear el brazo y aprieta un segundo antes de regresar.',
      consejos: 'El codo no baja ni sube: si el brazo se mueve, estás haciendo un remo y no una patada de tríceps.',
      musculos: 'Tríceps braquial, cabeza lateral'
    },
    {
      id: 'ej_fondos_en_banca',
      nombre: 'Fondos en banca',
      grupo: 'triceps',
      grupos: ['triceps', 'pecho', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Siéntate en la orilla de una banca y apoya las manos junto a la cadera con los dedos al frente. Desliza la cadera fuera de la banca y baja flexionando los codos hasta 90 grados. Empuja para subir sin bloquear el codo de golpe.',
      consejos: 'Mantén la cadera cerca de la banca: alejarla castiga el hombro sin darle más trabajo al tríceps.',
      musculos: 'Tríceps braquial, deltoides anterior, pectoral'
    },
    {
      id: 'ej_fondos_paralelas',
      nombre: 'Fondos en paralelas',
      grupo: 'triceps',
      grupos: ['triceps', 'pecho'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Sujétate de las paralelas con el torso lo más vertical posible y los brazos extendidos. Baja flexionando los codos hacia atrás y pegados al cuerpo hasta formar 90 grados. Empuja hasta extender los brazos manteniendo el torso erguido.',
      consejos: 'Con el torso vertical el trabajo es de tríceps; si te inclinas al frente, el ejercicio se convierte en fondo de pecho.',
      musculos: 'Tríceps braquial, pectoral inferior, deltoides anterior'
    },
    {
      id: 'ej_press_banca_agarre_cerrado',
      nombre: 'Press de banca agarre cerrado',
      grupo: 'triceps',
      grupos: ['triceps', 'pecho', 'hombros'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Acuéstate en la banca y toma la barra al ancho de los hombros, no más cerrado. Baja controlado hacia la parte baja del pecho con los codos pegados al torso. Empuja hasta extender los brazos manteniendo la muñeca firme.',
      consejos: 'Cerrar demasiado el agarre castiga la muñeca sin sumar tríceps: el ancho de hombros es el punto ideal.',
      musculos: 'Tríceps braquial, pectoral, deltoides anterior'
    },
    {
      id: 'ej_lagartijas_diamante',
      nombre: 'Lagartijas diamante',
      grupo: 'triceps',
      grupos: ['triceps', 'pecho', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'En plancha alta, junta las manos bajo el pecho formando un triángulo con pulgares e índices. Baja el pecho hacia las manos con los codos rozando las costillas. Empuja hasta extender los brazos sin dejar caer la cadera.',
      consejos: 'Si te duele la muñeca, apoya sobre los puños o usa mancuernas como agarre neutro.',
      musculos: 'Tríceps braquial, pectoral, core'
    },
    {
      id: 'ej_extension_triceps_maquina',
      nombre: 'Extensión de tríceps en máquina',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el asiento para que el codo quede alineado con el eje de la máquina y apoya bien los brazos. Extiende los antebrazos hasta casi bloquear el codo. Regresa controlado hasta la flexión completa sin soltar el peso.',
      consejos: 'Perfecta para las últimas series del día, cuando el cansancio ya no permite estabilizar mancuernas.',
      musculos: 'Tríceps braquial'
    },
    {
      id: 'ej_extension_triceps_banda',
      nombre: 'Extensión de tríceps con banda',
      grupo: 'triceps',
      grupos: ['triceps'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ancla la banda por encima de la cabeza y toma un extremo con cada mano con los codos junto al torso. Extiende los brazos hacia abajo contra la resistencia. Regresa despacio hasta que el antebrazo quede paralelo al piso.',
      consejos: 'La banda da más tensión al final del recorrido: aprovecha para hacer una pausa de un segundo abajo.',
      musculos: 'Tríceps braquial, ancóneo'
    },

    /* ====================== PIERNAS ====================== */
    {
      id: 'ej_sentadilla_barra',
      nombre: 'Sentadilla con barra',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos', 'abdomen'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Coloca la barra sobre el trapecio, saca el pecho y da dos pasos atrás con los pies al ancho de los hombros y las puntas ligeramente abiertas. Baja llevando la cadera atrás y abajo hasta que el muslo quede al menos paralelo al piso, con las rodillas siguiendo la línea de los pies. Sube empujando el piso con todo el pie y extendiendo cadera y rodillas al mismo tiempo.',
      consejos: 'No dejes que las rodillas se metan hacia adentro ni despegues los talones: si pasa, abre más los pies o baja el peso.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales, core'
    },
    {
      id: 'ej_sentadilla_frontal',
      nombre: 'Sentadilla frontal',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos', 'abdomen'],
      equipo: 'barra',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Apoya la barra sobre los deltoides frontales con los codos bien altos y los dedos solo como soporte. Baja manteniendo el torso lo más vertical posible hasta pasar el paralelo. Sube empujando con las piernas sin dejar caer los codos.',
      consejos: 'Si los codos bajan, la barra rueda al frente: trabaja la movilidad de muñeca y hombro antes de subir carga.',
      musculos: 'Cuádriceps, glúteo mayor, core, erectores espinales'
    },
    {
      id: 'ej_sentadilla_bulgara',
      nombre: 'Sentadilla búlgara',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Apoya el empeine del pie trasero sobre una banca y da un paso largo al frente con la pierna que trabaja. Baja recto hasta que la rodilla trasera casi toque el piso y el muslo delantero quede paralelo. Sube empujando con el talón de la pierna adelantada sin apoyar peso en la de atrás.',
      consejos: 'Ajusta la distancia del pie delantero: muy cerca castiga la rodilla, más lejos reparte el trabajo al glúteo.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales, aductores'
    },
    {
      id: 'ej_sentadilla_goblet',
      nombre: 'Sentadilla goblet',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos', 'abdomen'],
      equipo: 'kettlebell',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Sujeta una kettlebell o mancuerna con ambas manos pegada al pecho, con los codos apuntando hacia abajo. Baja en sentadilla profunda manteniendo el torso erguido y los codos por dentro de las rodillas. Sube empujando el piso y apretando el glúteo arriba.',
      consejos: 'Es la mejor forma de enseñar la técnica de sentadilla: el peso al frente obliga a mantener el pecho arriba solo.',
      musculos: 'Cuádriceps, glúteo mayor, core, aductores'
    },
    {
      id: 'ej_sentadilla_smith',
      nombre: 'Sentadilla en máquina Smith',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la barra sobre el trapecio y adelanta los pies unos treinta centímetros respecto a la cadera. Baja controlado hasta que el muslo quede paralelo al piso con la espalda apoyada en la trayectoria de la barra. Sube empujando con los talones sin bloquear la rodilla de golpe.',
      consejos: 'Adelantar los pies carga más el glúteo y el cuádriceps distal; si los pones debajo de la cadera te vas de espaldas.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_sentadilla_hack',
      nombre: 'Sentadilla hack',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'maquina',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Colócate en la máquina con la espalda y los hombros bien apoyados y los pies a la mitad de la plataforma. Libera los seguros y baja hasta que el muslo pase el paralelo, sin despegar la espalda baja. Empuja con toda la planta del pie hasta casi extender las rodillas.',
      consejos: 'Cargar demasiado peso hace que la cadera se despegue del respaldo: prefiere rango completo con menos discos.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_prensa_piernas',
      nombre: 'Prensa de piernas',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate con la espalda y la cadera bien apoyadas y coloca los pies al ancho de hombros a media plataforma. Baja el peso flexionando las rodillas hasta formar un ángulo de 90 grados sin despegar la cadera. Empuja con toda la planta del pie hasta casi extender las piernas.',
      consejos: 'Nunca bloquees las rodillas al final ni bajes tanto que la espalda baja se despegue del respaldo.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_extension_cuadriceps',
      nombre: 'Extensión de cuádriceps',
      grupo: 'piernas',
      grupos: ['piernas'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el respaldo y el rodillo para que quede sobre el empeine y la rodilla alineada con el eje de la máquina. Extiende las piernas hasta arriba y aprieta el cuádriceps un segundo. Baja controlado sin dejar que las placas descansen entre repeticiones.',
      consejos: 'Evita el latigazo al subir: el movimiento se hace lento en las dos fases para no estresar el tendón rotuliano.',
      musculos: 'Cuádriceps, recto femoral'
    },
    {
      id: 'ej_curl_femoral_acostado',
      nombre: 'Curl femoral acostado',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Acuéstate boca abajo con el rodillo justo arriba del talón y la rodilla apenas fuera de la banca. Flexiona las rodillas llevando los talones hacia el glúteo y aprieta arriba. Baja despacio hasta casi extender las piernas.',
      consejos: 'Si la cadera se despega de la banca estás usando la espalda baja: reduce el peso y aprieta el abdomen.',
      musculos: 'Isquiotibiales, gemelo'
    },
    {
      id: 'ej_curl_femoral_sentado',
      nombre: 'Curl femoral sentado',
      grupo: 'piernas',
      grupos: ['piernas'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate con el respaldo ajustado, el rodillo sobre los tobillos y el soporte de muslos bien apretado. Flexiona las rodillas llevando los talones bajo el asiento tanto como puedas. Regresa controlado hasta la extensión sin soltar la tensión.',
      consejos: 'La posición sentada estira más la porción larga del isquiotibial: es la variante que más crece esa zona.',
      musculos: 'Isquiotibiales, gemelo'
    },
    {
      id: 'ej_peso_muerto_rumano',
      nombre: 'Peso muerto rumano',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos', 'espalda'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'De pie con la barra frente a los muslos, agarre prono al ancho de hombros y rodillas apenas flexionadas. Lleva la cadera hacia atrás bajando la barra pegada a las piernas hasta sentir el estiramiento del isquiotibial, alrededor de la rodilla. Sube empujando la cadera al frente y apretando el glúteo arriba.',
      consejos: 'No es sentadilla: las rodillas casi no se doblan y la espalda se mantiene plana; si se redondea, ahí termina tu rango.',
      musculos: 'Isquiotibiales, glúteo mayor, erectores espinales'
    },
    {
      id: 'ej_peso_muerto_sumo',
      nombre: 'Peso muerto sumo',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos', 'espalda'],
      equipo: 'barra',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Coloca los pies muy abiertos con las puntas hacia afuera y toma la barra con las manos por dentro de las rodillas. Baja la cadera, saca el pecho y abre las rodillas hacia las puntas de los pies. Despega empujando el piso hacia los lados y extiende cadera y rodillas juntas.',
      consejos: 'La barra se mantiene rozando las piernas todo el recorrido; si se despega, la cadera arrancó demasiado alta.',
      musculos: 'Glúteo mayor, aductores, cuádriceps, erectores espinales'
    },
    {
      id: 'ej_peso_muerto_una_pierna',
      nombre: 'Peso muerto a una pierna',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos', 'abdomen'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Sujeta una mancuerna con la mano contraria a la pierna de apoyo y flexiona ligeramente esa rodilla. Baja el torso llevando la pierna libre hacia atrás como un balancín, con la espalda recta. Sube apretando el glúteo de la pierna de apoyo hasta quedar erguido.',
      consejos: 'La cadera no rota: mantén los huesos de la cadera apuntando al piso para que trabaje el glúteo y no la espalda.',
      musculos: 'Isquiotibiales, glúteo mayor, core, estabilizadores del tobillo'
    },
    {
      id: 'ej_desplante_caminando',
      nombre: 'Desplante caminando',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Con una mancuerna en cada mano, da un paso largo al frente y baja hasta que la rodilla trasera casi toque el piso. Empuja con el talón de la pierna delantera para levantarte y lleva el pie de atrás al frente en el mismo movimiento. Sigue avanzando alternando piernas con el torso erguido.',
      consejos: 'Da pasos largos para cargar el glúteo y evitar que la rodilla delantera se adelante de la punta del pie.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales, core'
    },
    {
      id: 'ej_desplante_estatico',
      nombre: 'Desplante estático',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Coloca un pie adelante y otro atrás en una posición cómoda, con las mancuernas a los costados. Baja en vertical flexionando ambas rodillas hasta 90 grados sin mover los pies. Sube empujando con la pierna delantera y repite todas las repeticiones antes de cambiar de lado.',
      consejos: 'El tronco baja recto, no hacia adelante: imagina un elevador que sube y baja en el mismo punto.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_desplante_inverso',
      nombre: 'Desplante inverso',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'De pie con las mancuernas a los costados, da un paso largo hacia atrás y baja hasta que la rodilla trasera roce el piso. Mantén el peso sobre la pierna delantera y el torso erguido. Empuja con el talón delantero para regresar a la posición inicial.',
      consejos: 'Es más amable con la rodilla que el desplante al frente: la opción ideal si tienes molestias en la rótula.',
      musculos: 'Glúteo mayor, cuádriceps, isquiotibiales'
    },
    {
      id: 'ej_sentadilla_libre',
      nombre: 'Sentadilla libre',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Párate con los pies al ancho de los hombros y las puntas ligeramente abiertas, brazos al frente para equilibrio. Baja llevando la cadera atrás hasta que los muslos queden paralelos al piso. Sube empujando con toda la planta del pie y apretando el glúteo arriba.',
      consejos: 'Es la base de todo: domina veinte repeticiones limpias antes de cargar peso sobre los hombros.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_sentadilla_sumo_mancuerna',
      nombre: 'Sentadilla sumo con mancuerna',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Abre los pies bastante más que el ancho de hombros con las puntas hacia afuera y sujeta una mancuerna entre las piernas. Baja manteniendo el torso vertical y las rodillas abiertas hacia las puntas. Sube apretando glúteo y aductores al final del recorrido.',
      consejos: 'Si las rodillas se cierran hacia adentro, reduce la apertura de los pies hasta que puedas mantenerlas alineadas.',
      musculos: 'Aductores, glúteo mayor, cuádriceps'
    },
    {
      id: 'ej_pantorrilla_de_pie',
      nombre: 'Elevación de talones de pie',
      grupo: 'piernas',
      grupos: ['piernas'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la punta de los pies en la plataforma con los talones libres y las rodillas extendidas. Baja los talones hasta sentir el estiramiento completo del gemelo. Sube lo más alto que puedas y aprieta dos segundos arriba.',
      consejos: 'Nada de rebotar: la pantorrilla crece con pausas arriba y abajo, no con repeticiones rápidas.',
      musculos: 'Gemelos, sóleo'
    },
    {
      id: 'ej_pantorrilla_sentado',
      nombre: 'Elevación de talones sentado',
      grupo: 'piernas',
      grupos: ['piernas'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate con la almohadilla sobre los muslos, cerca de la rodilla, y la punta de los pies en la plataforma. Baja los talones al máximo y luego eleva contrayendo la pantorrilla. Sostén la contracción arriba antes de regresar.',
      consejos: 'Con la rodilla flexionada trabaja más el sóleo: combina esta variante con la de pie para desarrollar toda la pantorrilla.',
      musculos: 'Sóleo, gemelos'
    },
    {
      id: 'ej_pantorrilla_prensa',
      nombre: 'Elevación de talones en prensa',
      grupo: 'piernas',
      grupos: ['piernas'],
      equipo: 'maquina',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'En la prensa, apoya solo la punta de los pies en la parte baja de la plataforma con las piernas casi extendidas. Empuja con la punta estirando el tobillo al máximo y regresa hasta el estiramiento completo. Mantén las rodillas suaves durante todo el recorrido.',
      consejos: 'Asegura los seguros de la máquina antes de empezar; nunca dejes que la plataforma baje sin control.',
      musculos: 'Gemelos, sóleo'
    },
    {
      id: 'ej_subida_al_cajon',
      nombre: 'Subida al cajón',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Coloca un pie completo sobre un cajón a la altura de la rodilla con las mancuernas a los costados. Sube empujando solo con la pierna de arriba hasta quedar erguido, sin impulsarte con la de abajo. Baja controlado apoyando primero la punta del pie.',
      consejos: 'Si te ayudas con un brinco de la pierna de abajo, baja la altura del cajón: el estímulo está en la subida limpia.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_sentadilla_pared',
      nombre: 'Sentadilla isométrica en pared',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Apoya la espalda completa contra la pared y camina los pies al frente hasta formar 90 grados en rodilla y cadera. Mantén la posición con el abdomen apretado y la respiración constante. Sostén el tiempo indicado y sube deslizando la espalda por la pared.',
      consejos: 'Aguanta el tiempo, no la mueca: si las rodillas tiemblan sin control, sube un poco y reduce el ángulo.',
      musculos: 'Cuádriceps, glúteo mayor'
    },
    {
      id: 'ej_desplante_lateral',
      nombre: 'Desplante lateral',
      grupo: 'piernas',
      grupos: ['piernas', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'De pie con los pies juntos, da un paso amplio hacia un lado y flexiona esa rodilla llevando la cadera atrás. Mantén la otra pierna estirada y ambos pies apuntando al frente. Empuja con la pierna flexionada para volver al centro y alterna lados.',
      consejos: 'El pecho se mantiene arriba y la rodilla apunta a la punta del pie; no permitas que se vaya hacia adentro.',
      musculos: 'Aductores, cuádriceps, glúteo medio'
    },
    {
      id: 'ej_sentadilla_sissy',
      nombre: 'Sentadilla sissy',
      grupo: 'piernas',
      grupos: ['piernas'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'hipertrofia',
      instrucciones: 'Sujétate de un soporte con una mano y ponte de puntas con los pies juntos. Lleva las rodillas al frente inclinando el torso hacia atrás en una sola línea con el muslo. Baja hasta donde tengas control y sube apretando el cuádriceps.',
      consejos: 'Solo para rodillas sanas y con progresión lenta: empieza con poco rango y sujétate siempre de un apoyo.',
      musculos: 'Cuádriceps, recto femoral'
    },

    /* ====================== GLÚTEOS ====================== */
    {
      id: 'ej_empuje_cadera_barra',
      nombre: 'Empuje de cadera con barra',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'fuerza',
      instrucciones: 'Apoya la espalda alta en el borde de una banca con la barra acolchonada sobre la cadera y los pies al ancho de los hombros. Empuja la cadera hacia arriba hasta que el torso quede paralelo al piso y las rodillas a 90 grados. Aprieta el glúteo dos segundos arriba y baja controlado sin tocar el piso.',
      consejos: 'Mete un poco la pelvis y mira al frente al subir; si arqueas la espalda baja, el trabajo se va a la lumbar.',
      musculos: 'Glúteo mayor, isquiotibiales, cuádriceps'
    },
    {
      id: 'ej_puente_gluteo',
      nombre: 'Puente de glúteo',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Acuéstate boca arriba con las rodillas flexionadas, los pies al ancho de cadera y los brazos a los costados. Empuja con los talones para elevar la cadera hasta alinear rodillas, cadera y hombros. Aprieta el glúteo arriba y baja despacio sin dejar caer la cadera de golpe.',
      consejos: 'Si sientes el trabajo en los isquiotibiales, acerca un poco los talones al glúteo.',
      musculos: 'Glúteo mayor, isquiotibiales, core'
    },
    {
      id: 'ej_puente_gluteo_una_pierna',
      nombre: 'Puente de glúteo a una pierna',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Desde el puente de glúteo, extiende una pierna al frente manteniendo los muslos alineados. Sube la cadera empujando solo con el talón apoyado hasta alinear el cuerpo. Baja controlado sin dejar que la cadera se incline hacia un lado.',
      consejos: 'La cadera debe subir pareja: si un lado se cae, tienes un desbalance que conviene trabajar antes de cargar peso.',
      musculos: 'Glúteo mayor, glúteo medio, isquiotibiales, core'
    },
    {
      id: 'ej_puente_gluteo_banda',
      nombre: 'Puente de glúteo con banda',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca una banda circular justo arriba de las rodillas y acuéstate boca arriba con los pies apoyados. Sube la cadera empujando con los talones y abriendo las rodillas contra la banda. Sostén arriba dos segundos y baja controlado sin cerrar las rodillas.',
      consejos: 'La banda activa el glúteo medio: úsala como activación antes de sentadillas o peso muerto.',
      musculos: 'Glúteo mayor, glúteo medio, isquiotibiales'
    },
    {
      id: 'ej_empuje_cadera_una_pierna',
      nombre: 'Empuje de cadera a una pierna',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Apoya la espalda alta en una banca con un pie firme en el piso y la otra pierna elevada. Empuja la cadera hacia arriba con la pierna de apoyo hasta alinear el torso con el muslo. Aprieta arriba y baja controlado manteniendo la cadera nivelada.',
      consejos: 'Coloca una mancuerna ligera sobre la cadera solo cuando logres quince repeticiones sin que se ladee.',
      musculos: 'Glúteo mayor, glúteo medio, isquiotibiales'
    },
    {
      id: 'ej_patada_gluteo_polea',
      nombre: 'Patada de glúteo en polea',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'polea',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la tobillera en la polea baja y párate de frente al aparato sujetándote del soporte. Lleva la pierna hacia atrás extendiendo la cadera sin arquear la espalda. Aprieta el glúteo arriba y regresa controlado sin dejar que el peso te jale.',
      consejos: 'El rango es corto: llevar la pierna demasiado atrás solo arquea la lumbar y quita tensión al glúteo.',
      musculos: 'Glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_patada_gluteo_maquina',
      nombre: 'Patada de glúteo en máquina',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Apoya el pecho en el respaldo y coloca la planta del pie sobre la plataforma de la máquina. Empuja hacia atrás extendiendo la cadera hasta contraer el glúteo por completo. Regresa controlado hasta la flexión inicial sin soltar el peso.',
      consejos: 'Fija bien la cadera contra el soporte: cualquier balanceo del torso le quita trabajo al glúteo.',
      musculos: 'Glúteo mayor, isquiotibiales'
    },
    {
      id: 'ej_abduccion_maquina',
      nombre: 'Abducción de cadera en máquina',
      grupo: 'gluteos',
      grupos: ['gluteos'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Siéntate con la espalda apoyada y las almohadillas por fuera de los muslos. Abre las piernas de forma controlada hasta el rango máximo cómodo. Aprieta un segundo y regresa despacio sin dejar que las placas choquen.',
      consejos: 'Inclinarte al frente enfatiza el glúteo medio; recargarte atrás carga más el glúteo mayor: prueba las dos posiciones.',
      musculos: 'Glúteo medio, glúteo menor, tensor de la fascia lata'
    },
    {
      id: 'ej_caminata_lateral_banda',
      nombre: 'Caminata lateral con banda',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Coloca la banda circular arriba de las rodillas o en los tobillos y flexiona ligeramente las rodillas en media sentadilla. Da pasos laterales manteniendo la tensión de la banda y los pies apuntando al frente. Avanza y regresa el mismo número de pasos hacia cada lado.',
      consejos: 'No juntes los pies al terminar el paso: mantener la separación conserva la tensión sobre el glúteo medio.',
      musculos: 'Glúteo medio, glúteo menor, tensor de la fascia lata'
    },
    {
      id: 'ej_patada_burro',
      nombre: 'Patada de burro',
      grupo: 'gluteos',
      grupos: ['gluteos', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Colócate en cuadrupedia con las manos bajo los hombros y las rodillas bajo la cadera. Eleva una pierna manteniendo la rodilla a 90 grados y empuja el talón hacia el techo. Baja controlado sin apoyar la rodilla y repite todas las repeticiones antes de cambiar.',
      consejos: 'La espalda no se arquea: sube solo hasta donde la cadera se mantenga cuadrada con el piso.',
      musculos: 'Glúteo mayor, core'
    },
    {
      id: 'ej_abduccion_cuadrupedia',
      nombre: 'Abducción en cuadrupedia',
      grupo: 'gluteos',
      grupos: ['gluteos'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Desde cuadrupedia, con la rodilla flexionada, abre la pierna hacia el costado como si dibujaras un semicírculo. Sube hasta la altura de la cadera sin rotar el torso. Baja controlado sin apoyar la rodilla en el piso.',
      consejos: 'Apoya bien el core para que el tronco no se vaya al lado contrario mientras abres la pierna.',
      musculos: 'Glúteo medio, glúteo menor'
    },
    {
      id: 'ej_peso_muerto_rumano_mancuernas',
      nombre: 'Peso muerto rumano con mancuernas',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas', 'espalda'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'De pie con una mancuerna en cada mano frente a los muslos y las rodillas apenas flexionadas. Lleva la cadera hacia atrás bajando las mancuernas pegadas a las piernas hasta sentir el estiramiento del isquiotibial. Sube empujando la cadera al frente y apretando el glúteo.',
      consejos: 'Las mancuernas permiten un recorrido más natural: mantenlas rozando la pierna para no cargar la espalda baja.',
      musculos: 'Glúteo mayor, isquiotibiales, erectores espinales'
    },
    {
      id: 'ej_sentadilla_sumo_barra',
      nombre: 'Sentadilla sumo con barra',
      grupo: 'gluteos',
      grupos: ['gluteos', 'piernas'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Coloca la barra sobre el trapecio y abre los pies bastante más que el ancho de hombros con las puntas hacia afuera. Baja manteniendo el torso vertical y las rodillas siguiendo la línea de las puntas. Sube empujando el piso hacia los lados y apretando glúteo y aductores arriba.',
      consejos: 'Abrir de más los pies limita la profundidad: busca la apertura donde puedas pasar el paralelo con la espalda recta.',
      musculos: 'Glúteo mayor, aductores, cuádriceps'
    },
    {
      id: 'ej_hiperextension_gluteo',
      nombre: 'Hiperextensión enfocada en glúteo',
      grupo: 'gluteos',
      grupos: ['gluteos', 'espalda'],
      equipo: 'maquina',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Colócate en el banco romano con los pies rotados hacia afuera y la espalda ligeramente redondeada de forma consciente. Baja el torso hasta el estiramiento y sube extendiendo la cadera con la barbilla metida al pecho. Aprieta el glúteo arriba sin pasar de la línea recta del cuerpo.',
      consejos: 'Meter la barbilla y redondear un poco la espalda alta desactiva la lumbar y deja todo el trabajo al glúteo.',
      musculos: 'Glúteo mayor, isquiotibiales'
    },

    /* ====================== ABDOMEN ====================== */
    {
      id: 'ej_abdominales_crunch',
      nombre: 'Abdominales crunch',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Acuéstate boca arriba con las rodillas flexionadas y las manos a los costados de la cabeza sin jalar el cuello. Despega los omóplatos del piso enrollando la columna y llevando las costillas hacia la cadera. Baja controlado hasta rozar el piso sin soltar la tensión.',
      consejos: 'No jales la nuca con las manos ni subas todo el torso: el recorrido es corto y el abdomen es el que enrolla.',
      musculos: 'Recto abdominal, oblicuos'
    },
    {
      id: 'ej_crunch_polea',
      nombre: 'Crunch en polea',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Arrodíllate frente a la polea alta sujetando la cuerda a los lados de la cabeza. Enrolla la columna llevando los codos hacia los muslos, contrayendo el abdomen. Regresa controlado hasta estirar el abdomen sin dejar que el peso te levante.',
      consejos: 'La cadera se queda fija: si te doblas desde la cadera en lugar de enrollar la columna, trabaja la espalda y no el abdomen.',
      musculos: 'Recto abdominal, oblicuos'
    },
    {
      id: 'ej_elevacion_piernas_colgado',
      nombre: 'Elevación de piernas colgado',
      grupo: 'abdomen',
      grupos: ['abdomen', 'espalda'],
      equipo: 'peso_corporal',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Cuélgate de la barra con agarre prono y el cuerpo sin balanceo. Eleva las piernas rectas hasta que queden paralelas al piso o más arriba, enrollando la pelvis al final. Baja controlado sin dejar que el cuerpo se columpie.',
      consejos: 'Si te balanceas, empieza con las rodillas flexionadas hasta que domines el control del cuerpo colgado.',
      musculos: 'Recto abdominal, flexores de cadera, oblicuos'
    },
    {
      id: 'ej_elevacion_rodillas_paralelas',
      nombre: 'Elevación de rodillas en paralelas',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Apóyate en las paralelas del banco de fondos con la espalda pegada al respaldo. Eleva las rodillas hacia el pecho enrollando la pelvis al final del movimiento. Baja despacio hasta dejar las piernas colgando sin tocar el piso.',
      consejos: 'El truco está en enrollar la pelvis arriba: subir las rodillas sin ese detalle solo trabaja el flexor de cadera.',
      musculos: 'Recto abdominal, flexores de cadera'
    },
    {
      id: 'ej_elevacion_piernas_acostado',
      nombre: 'Elevación de piernas acostado',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Acuéstate boca arriba con las manos bajo el glúteo y las piernas extendidas. Sube las piernas juntas hasta la vertical manteniendo la espalda baja pegada al piso. Baja despacio hasta que los talones queden a un palmo del suelo.',
      consejos: 'Si la espalda baja se despega, reduce el rango o flexiona un poco las rodillas.',
      musculos: 'Recto abdominal inferior, flexores de cadera'
    },
    {
      id: 'ej_elevacion_piernas_declinado',
      nombre: 'Elevación de piernas en banca declinada',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'hipertrofia',
      instrucciones: 'Acuéstate en la banca declinada sujetándote del soporte por detrás de la cabeza. Eleva las piernas hasta que la cadera se despegue ligeramente del respaldo. Baja controlado hasta casi extender por completo sin tocar la banca.',
      consejos: 'Entre más pronunciada la inclinación, más difícil: empieza en el ángulo bajo y ve subiendo con las semanas.',
      musculos: 'Recto abdominal inferior, flexores de cadera'
    },
    {
      id: 'ej_plancha_frontal',
      nombre: 'Plancha frontal',
      grupo: 'abdomen',
      grupos: ['abdomen', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Apoya los antebrazos en el piso con los codos bajo los hombros y estira las piernas apoyando las puntas de los pies. Alinea cabeza, cadera y talones apretando abdomen y glúteo. Sostén la posición respirando de forma constante durante el tiempo indicado.',
      consejos: 'Mejor treinta segundos con la cadera alineada que dos minutos con la cadera hundida.',
      musculos: 'Recto abdominal, transverso, core, hombros'
    },
    {
      id: 'ej_plancha_lateral',
      nombre: 'Plancha lateral',
      grupo: 'abdomen',
      grupos: ['abdomen', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Recuéstate de lado apoyando el antebrazo con el codo bajo el hombro y los pies uno sobre el otro. Eleva la cadera hasta formar una línea recta de la cabeza a los talones. Sostén el tiempo indicado y cambia de lado.',
      consejos: 'No dejes que la cadera se vaya hacia atrás: el cuerpo debe quedar en un solo plano, como entre dos paredes.',
      musculos: 'Oblicuos, cuadrado lumbar, glúteo medio'
    },
    {
      id: 'ej_escaladores',
      nombre: 'Escaladores',
      grupo: 'abdomen',
      grupos: ['abdomen', 'cardio', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Colócate en plancha alta con las manos bajo los hombros y el cuerpo alineado. Lleva una rodilla al pecho y regrésala mientras la otra avanza, alternando con ritmo constante. Mantén la cadera baja y el abdomen apretado durante toda la serie.',
      consejos: 'Si la cadera sube y baja como acordeón, ve más lento: el ritmo no vale de nada sin control del tronco.',
      musculos: 'Recto abdominal, oblicuos, flexores de cadera, hombros'
    },
    {
      id: 'ej_abdominales_bicicleta',
      nombre: 'Abdominales bicicleta',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Acostado boca arriba, lleva las manos a los lados de la cabeza y eleva las piernas con las rodillas a 90 grados. Gira el torso llevando el codo hacia la rodilla contraria mientras estiras la otra pierna. Alterna lados de forma controlada sin jalar el cuello.',
      consejos: 'El giro nace del torso, no del codo: si solo mueves los brazos, los oblicuos ni se enteran.',
      musculos: 'Oblicuos, recto abdominal, flexores de cadera'
    },
    {
      id: 'ej_giro_ruso',
      nombre: 'Giro ruso',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'balon',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Siéntate con las rodillas flexionadas y el torso inclinado unos 45 grados hacia atrás, sujetando un balón medicinal. Gira el torso llevando el balón de un costado al otro tocando ligeramente el piso. Mantén la espalda recta y el abdomen apretado durante toda la serie.',
      consejos: 'La espalda baja no se redondea: si te encorvas, sube el torso unos grados o usa menos peso.',
      musculos: 'Oblicuos, recto abdominal, transverso'
    },
    {
      id: 'ej_rueda_abdominal',
      nombre: 'Rueda abdominal',
      grupo: 'abdomen',
      grupos: ['abdomen', 'espalda', 'hombros'],
      equipo: 'maquina',
      nivel: 'avanzado',
      tipo: 'fuerza',
      instrucciones: 'Arrodíllate sujetando la rueda con ambas manos bajo los hombros y la pelvis metida. Rueda hacia adelante estirando el cuerpo tanto como puedas sin que la cadera se hunda. Regresa jalando con el abdomen hasta la posición inicial.',
      consejos: 'Empieza con recorridos cortos frente a una pared: extenderse de más sin fuerza es la vía rápida a un tirón lumbar.',
      musculos: 'Recto abdominal, transverso, dorsal ancho, hombros'
    },
    {
      id: 'ej_abdominales_maquina',
      nombre: 'Abdominales en máquina',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'maquina',
      nivel: 'principiante',
      tipo: 'hipertrofia',
      instrucciones: 'Ajusta el asiento para que el pecho quede a la altura de las almohadillas y sujeta los mangos. Enrolla el torso llevando el pecho hacia la cadera con el abdomen, no con los brazos. Regresa controlado sin dejar que el peso te estire de golpe.',
      consejos: 'Es la forma más sencilla de aplicar sobrecarga progresiva al abdomen: sube peso cada par de semanas.',
      musculos: 'Recto abdominal, oblicuos'
    },
    {
      id: 'ej_lenador_polea',
      nombre: 'Leñador en polea',
      grupo: 'abdomen',
      grupos: ['abdomen', 'hombros'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Coloca la polea en alto y párate de costado sujetando el mango con ambas manos y los brazos casi extendidos. Gira el torso llevando el mango en diagonal hacia la cadera contraria mientras pivotas el pie trasero. Regresa controlado resistiendo el jalón del cable.',
      consejos: 'El giro nace del tronco y de la cadera, no de los brazos; mantén los codos casi rectos todo el recorrido.',
      musculos: 'Oblicuos, transverso, core, hombros'
    },
    {
      id: 'ej_posicion_hueca',
      nombre: 'Posición hueca',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Acuéstate boca arriba y pega la espalda baja al piso metiendo la pelvis. Eleva ligeramente hombros y piernas formando una banana con el cuerpo y estira los brazos junto a las orejas. Sostén la posición respirando corto sin que la espalda se despegue del piso.',
      consejos: 'En cuanto la lumbar se despegue, sube más las piernas o flexiona las rodillas: la espalda pegada es la regla.',
      musculos: 'Recto abdominal, transverso, flexores de cadera'
    },
    {
      id: 'ej_bicho_muerto',
      nombre: 'Bicho muerto',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Acostado boca arriba, sube los brazos al techo y las rodillas a 90 grados sobre la cadera. Estira al mismo tiempo un brazo hacia atrás y la pierna contraria hacia adelante, sin tocar el piso. Regresa al centro y alterna manteniendo la espalda baja pegada al suelo.',
      consejos: 'Es un ejercicio de control, no de velocidad: si la espalda se arquea, acorta el recorrido de la pierna.',
      musculos: 'Transverso abdominal, recto abdominal, core profundo'
    },
    {
      id: 'ej_abdominales_en_v',
      nombre: 'Abdominales en V',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Acuéstate boca arriba con brazos y piernas extendidos en línea. Sube al mismo tiempo el torso y las piernas rectas buscando tocar los pies con las manos, formando una V. Baja controlado hasta casi tocar el piso y repite sin descansar abajo.',
      consejos: 'Si no alcanzas los pies, flexiona un poco las rodillas antes que jalonear el cuello para llegar.',
      musculos: 'Recto abdominal, flexores de cadera, oblicuos'
    },
    {
      id: 'ej_crunch_inverso',
      nombre: 'Crunch inverso',
      grupo: 'abdomen',
      grupos: ['abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Acostado boca arriba con las manos a los costados, lleva las rodillas sobre la cadera a 90 grados. Enrolla la pelvis despegando el glúteo del piso y llevando las rodillas hacia el pecho. Baja controlado sin dejar caer las piernas de golpe.',
      consejos: 'El movimiento es corto y viene de la pelvis; no lo conviertas en un balanceo con impulso de piernas.',
      musculos: 'Recto abdominal inferior, transverso'
    },
    {
      id: 'ej_pallof_press',
      nombre: 'Pallof press en polea',
      grupo: 'abdomen',
      grupos: ['abdomen', 'hombros'],
      equipo: 'polea',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Párate de costado a la polea colocada a la altura del pecho y sujeta el mango con ambas manos al esternón. Extiende los brazos al frente resistiendo el giro que provoca el cable. Sostén dos segundos y regresa al pecho sin permitir que el torso rote.',
      consejos: 'Es un ejercicio antirrotación: el mérito está en no girar, no en usar mucho peso.',
      musculos: 'Oblicuos, transverso abdominal, core profundo'
    },

    /* ======================= CARDIO ====================== */
    {
      id: 'ej_caminadora_caminata',
      nombre: 'Caminata en caminadora',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas'],
      equipo: 'cardio',
      nivel: 'principiante',
      tipo: 'cardio',
      instrucciones: 'Sube a la caminadora y arranca a paso cómodo entre 4 y 6 kilómetros por hora. Sube la inclinación entre 5 y 10 por ciento para aumentar el gasto sin castigar las rodillas. Camina erguido, con los brazos sueltos y sin recargarte en los pasamanos.',
      consejos: 'Agarrarte del barandal reduce hasta un tercio del gasto calórico: si necesitas sujetarte, baja la inclinación.',
      musculos: 'Cuádriceps, glúteo mayor, gemelos, corazón'
    },
    {
      id: 'ej_caminadora_trote',
      nombre: 'Trote en caminadora',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas'],
      equipo: 'cardio',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Calienta cinco minutos caminando y sube la velocidad hasta un trote sostenido en el que puedas hablar entrecortado. Mantén el torso erguido, la pisada suave y la zancada corta. Termina con cinco minutos de caminata para bajar pulsaciones.',
      consejos: 'Apunta a la zona de 65 a 75 por ciento de tu frecuencia máxima; si no puedes decir una frase, vas muy rápido.',
      musculos: 'Cuádriceps, isquiotibiales, gemelos, corazón'
    },
    {
      id: 'ej_caminadora_sprints',
      nombre: 'Sprints en caminadora',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas'],
      equipo: 'cardio',
      nivel: 'avanzado',
      tipo: 'cardio',
      instrucciones: 'Después de calentar diez minutos, alterna 20 a 30 segundos a velocidad máxima controlada con 60 a 90 segundos de caminata. Sube y baja de la banda con cuidado usando los pasamanos entre intervalos. Completa entre seis y diez series según tu condición.',
      consejos: 'Nunca arranques el sprint sin calentar: el desgarro de isquiotibial es la lesión más común en intervalos.',
      musculos: 'Isquiotibiales, cuádriceps, glúteo mayor, corazón'
    },
    {
      id: 'ej_bicicleta_estatica',
      nombre: 'Bicicleta estática',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas'],
      equipo: 'cardio',
      nivel: 'principiante',
      tipo: 'cardio',
      instrucciones: 'Ajusta el asiento a la altura de la cadera para que la rodilla quede casi extendida abajo. Pedalea a cadencia constante entre 70 y 90 revoluciones por minuto con la resistencia que te acelere la respiración. Mantén la espalda recta y los hombros relajados.',
      consejos: 'Un asiento demasiado bajo es la causa número uno de dolor de rodilla en bici: revísalo antes de arrancar.',
      musculos: 'Cuádriceps, glúteo mayor, gemelos, corazón'
    },
    {
      id: 'ej_bicicleta_de_aire',
      nombre: 'Bicicleta de aire',
      grupo: 'cardio',
      grupos: ['cardio', 'cuerpo_completo'],
      equipo: 'cardio',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Siéntate con la altura ajustada y sujeta los manerales para empujar y jalar con los brazos mientras pedaleas. Arranca a ritmo moderado y aumenta la potencia según el objetivo del día. Para intervalos, alterna 30 segundos fuertes con 60 de recuperación.',
      consejos: 'La resistencia depende de tu esfuerzo: entre más rápido pedaleas, más duro se pone, así que dosifica el arranque.',
      musculos: 'Cuádriceps, glúteo mayor, dorsal ancho, hombros, corazón'
    },
    {
      id: 'ej_eliptica',
      nombre: 'Elíptica',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas'],
      equipo: 'cardio',
      nivel: 'principiante',
      tipo: 'cardio',
      instrucciones: 'Colócate con los pies completos en los pedales y sujeta los manerales móviles. Empuja y jala con brazos y piernas de forma coordinada manteniendo el torso erguido. Ajusta resistencia e inclinación para sostener el ritmo objetivo.',
      consejos: 'Ideal cuando hay molestias de rodilla o tobillo porque no hay impacto, pero no te recargues en el aparato.',
      musculos: 'Cuádriceps, glúteo mayor, isquiotibiales, corazón'
    },
    {
      id: 'ej_remadora',
      nombre: 'Remadora',
      grupo: 'cardio',
      grupos: ['cardio', 'espalda', 'piernas'],
      equipo: 'cardio',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Sujeta el mango con los brazos extendidos y las rodillas flexionadas al frente. Empuja primero con las piernas, luego inclina el torso hacia atrás y al final jala con los brazos al abdomen. Regresa en orden inverso: brazos, torso y piernas.',
      consejos: 'El orden piernas, torso y brazos es la clave: jalar primero con los brazos te cansa sin avanzar metros.',
      musculos: 'Cuádriceps, dorsal ancho, glúteo mayor, corazón'
    },
    {
      id: 'ej_escaladora',
      nombre: 'Escaladora',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas', 'gluteos'],
      equipo: 'cardio',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Súbete a la escaladora y arranca a velocidad baja hasta encontrar el ritmo. Sube apoyando el pie completo en cada escalón y mantén el torso erguido. Aumenta la velocidad de forma progresiva y termina con dos minutos suaves.',
      consejos: 'Si te cuelgas de los pasamanos pierdes casi todo el estímulo del glúteo: apenas apoya las manos para equilibrio.',
      musculos: 'Glúteo mayor, cuádriceps, gemelos, corazón'
    },
    {
      id: 'ej_salto_de_cuerda',
      nombre: 'Salto de cuerda',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas'],
      equipo: 'cardio',
      nivel: 'principiante',
      tipo: 'cardio',
      instrucciones: 'Ajusta la cuerda a tu estatura pisándola en el centro: los mangos deben llegar a las axilas. Salta con los pies juntos apenas unos centímetros del piso, girando la cuerda solo con las muñecas. Mantén los codos pegados al cuerpo y el abdomen firme.',
      consejos: 'Salta bajo y rápido; los saltos altos cansan de más y aumentan el impacto en rodilla y tobillo.',
      musculos: 'Gemelos, cuádriceps, hombros, corazón'
    },
    {
      id: 'ej_burpees',
      nombre: 'Burpees',
      grupo: 'cardio',
      grupos: ['cardio', 'cuerpo_completo', 'pecho'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Desde de pie, baja en cuclillas y apoya las manos en el piso, luego lanza los pies hacia atrás hasta plancha. Haz una lagartija completa, regresa los pies junto a las manos y salta hacia arriba con las manos por encima de la cabeza. Encadena repeticiones con ritmo constante.',
      consejos: 'Cuando te canses, la cadera se hunde en la plancha: baja el ritmo antes de romper la técnica.',
      musculos: 'Cuerpo completo, pectoral, cuádriceps, hombros, corazón'
    },
    {
      id: 'ej_rodillas_altas',
      nombre: 'Rodillas altas',
      grupo: 'cardio',
      grupos: ['cardio', 'abdomen'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'cardio',
      instrucciones: 'De pie con el torso erguido, corre en el mismo lugar subiendo las rodillas por encima de la cadera. Apoya con la parte delantera del pie y acompaña con el braceo. Mantén el ritmo alto durante el tiempo indicado.',
      consejos: 'No te vayas de espaldas al subir las rodillas: aprieta el abdomen y mantén el pecho al frente.',
      musculos: 'Flexores de cadera, cuádriceps, gemelos, corazón'
    },
    {
      id: 'ej_saltos_de_tijera',
      nombre: 'Saltos de tijera',
      grupo: 'cardio',
      grupos: ['cardio', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'cardio',
      instrucciones: 'Empieza de pie con los pies juntos y los brazos a los costados. Salta abriendo las piernas al ancho de los hombros mientras subes los brazos por encima de la cabeza. Regresa a la posición inicial con otro salto y mantén el ritmo.',
      consejos: 'Aterriza suave con la rodilla ligeramente flexionada para amortiguar el impacto en tobillos y rodillas.',
      musculos: 'Gemelos, deltoides, cuádriceps, corazón'
    },
    {
      id: 'ej_salto_al_cajon',
      nombre: 'Salto al cajón',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Colócate frente a un cajón estable a una altura que puedas superar con margen. Flexiona ligeramente rodillas y cadera, y salta con impulso de brazos aterrizando con los dos pies completos sobre el cajón. Baja caminando, nunca saltando, y repite.',
      consejos: 'Escoge una altura que domines: los raspones en la espinilla vienen de escoger cajones que no alcanzas.',
      musculos: 'Cuádriceps, glúteo mayor, gemelos, corazón'
    },
    {
      id: 'ej_cuerdas_de_batalla',
      nombre: 'Cuerdas de batalla',
      grupo: 'cardio',
      grupos: ['cardio', 'hombros', 'abdomen'],
      equipo: 'cardio',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Sujeta un extremo de la cuerda en cada mano y colócate en media sentadilla con el pecho arriba. Genera ondas alternando los brazos con movimientos rápidos desde el hombro. Mantén el ritmo entre 20 y 40 segundos por serie.',
      consejos: 'La fuerza viene de las piernas y el core, no solo de los brazos: mantén la posición atlética todo el intervalo.',
      musculos: 'Deltoides, core, antebrazos, corazón'
    },
    {
      id: 'ej_empuje_de_trineo',
      nombre: 'Empuje de trineo',
      grupo: 'cardio',
      grupos: ['cardio', 'piernas', 'cuerpo_completo'],
      equipo: 'maquina',
      nivel: 'intermedio',
      tipo: 'cardio',
      instrucciones: 'Sujeta los postes del trineo con los brazos extendidos y el torso inclinado al frente. Empuja dando pasos cortos y potentes con la vista al piso unos metros adelante. Recorre la distancia marcada y descansa el doble de tiempo antes de repetir.',
      consejos: 'Empieza con poco peso y buen ritmo: el trineo pesado convierte el trabajo cardiovascular en un ejercicio de fuerza pura.',
      musculos: 'Cuádriceps, glúteo mayor, gemelos, core, corazón'
    },

    /* =================== CUERPO COMPLETO ================= */
    {
      id: 'ej_swing_kettlebell',
      nombre: 'Balanceo con kettlebell',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'gluteos', 'espalda'],
      equipo: 'kettlebell',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Coloca la kettlebell a un paso frente a ti y toma el asa con ambas manos llevando la cadera atrás y la espalda plana. Lanza la pesa entre las piernas y empuja la cadera al frente con fuerza para que suba hasta la altura del pecho. Deja que caiga de regreso acompañando el movimiento con otra bisagra de cadera.',
      consejos: 'No es una sentadilla ni un levantamiento de brazos: la pesa vuela por el empujón de la cadera, no por jalarla.',
      musculos: 'Glúteo mayor, isquiotibiales, erectores espinales, core'
    },
    {
      id: 'ej_cargada_de_potencia',
      nombre: 'Cargada de potencia',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'piernas', 'hombros', 'espalda'],
      equipo: 'barra',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Coloca la barra a media espinilla con los pies al ancho de cadera y toma el agarre por fuera de las rodillas. Despega la barra pegada al cuerpo y, al pasar el muslo, extiende cadera, rodillas y tobillos de forma explosiva. Mete los codos rápido para recibir la barra en los deltoides en media sentadilla.',
      consejos: 'Aprende el movimiento con barra vacía y bajo supervisión: la técnica define todo y no se improvisa con carga.',
      musculos: 'Glúteo mayor, cuádriceps, trapecio, deltoides, core'
    },
    {
      id: 'ej_arranque_mancuerna',
      nombre: 'Arranque con mancuerna',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'hombros', 'gluteos'],
      equipo: 'mancuernas',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Coloca la mancuerna en el piso entre los pies y toma el mango con una mano llevando la cadera atrás. Impulsa con las piernas y la cadera para lanzar la mancuerna hacia arriba pegada al cuerpo. Recibe con el brazo extendido sobre la cabeza en media sentadilla y ponte de pie.',
      consejos: 'La mancuerna sube pegada al torso: si se aleja del cuerpo, el hombro recibe todo el impacto al recibirla.',
      musculos: 'Glúteo mayor, deltoides, trapecio, core'
    },
    {
      id: 'ej_thruster_barra',
      nombre: 'Thruster con barra',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'piernas', 'hombros'],
      equipo: 'barra',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Sostén la barra en los deltoides con los codos altos y los pies al ancho de hombros. Baja en sentadilla completa manteniendo el torso erguido y sube empujando el piso. Aprovecha el impulso de las piernas para empujar la barra por encima de la cabeza en un solo movimiento continuo.',
      consejos: 'Sentadilla y press son un solo gesto: si haces pausa arriba de la sentadilla, pierdes el impulso y se vuelve el doble de pesado.',
      musculos: 'Cuádriceps, glúteo mayor, deltoides, tríceps, core'
    },
    {
      id: 'ej_cargada_y_press_mancuernas',
      nombre: 'Cargada y press con mancuernas',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'hombros', 'piernas'],
      equipo: 'mancuernas',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Coloca las mancuernas en el piso junto a los pies y toma posición de peso muerto con la espalda recta. Levántalas con impulso de cadera hasta los hombros y, sin pausa, empújalas por encima de la cabeza. Baja al hombro y luego al piso de forma controlada.',
      consejos: 'Encadena las fases sin frenar: la potencia de la cadera es la que sube el peso hasta los hombros.',
      musculos: 'Glúteo mayor, cuádriceps, deltoides, tríceps, core'
    },
    {
      id: 'ej_levantada_turca',
      nombre: 'Levantada turca',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'hombros', 'abdomen'],
      equipo: 'kettlebell',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Acostado boca arriba, sostén la kettlebell con el brazo extendido al techo y flexiona la rodilla del mismo lado. Levántate por pasos: al codo, a la mano, sube la cadera, pasa la pierna atrás y ponte de pie sin perder la vertical del brazo. Regresa deshaciendo cada paso en el mismo orden.',
      consejos: 'Mantén la vista en la pesa durante todo el ascenso y practica primero sin peso o con un zapato en la mano.',
      musculos: 'Hombro, core, glúteo mayor, cuádriceps'
    },
    {
      id: 'ej_caminata_granjero',
      nombre: 'Caminata del granjero',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'espalda', 'abdomen'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Toma una mancuerna o kettlebell pesada en cada mano y ponte de pie con el pecho alto y los hombros atrás. Camina en línea recta con pasos cortos y firmes sin inclinarte hacia ningún lado. Recorre la distancia marcada, baja el peso controlado y descansa.',
      consejos: 'No encojas los hombros ni mires al piso: el agarre y el core trabajan mejor con la postura erguida.',
      musculos: 'Antebrazos, trapecio, core, glúteo mayor'
    },
    {
      id: 'ej_lanzamiento_balon_pared',
      nombre: 'Lanzamiento de balón a la pared',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'piernas', 'hombros'],
      equipo: 'balon',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Colócate a un paso de la pared sujetando el balón a la altura del pecho. Baja en sentadilla completa y, al subir, lanza el balón a un punto alto de la pared aprovechando el impulso. Recibe el balón amortiguando con los brazos y encadena la siguiente sentadilla.',
      consejos: 'Apunta siempre al mismo punto de la pared; si el balón cae lejos, estás lanzando solo con los brazos.',
      musculos: 'Cuádriceps, glúteo mayor, deltoides, core'
    },
    {
      id: 'ej_azote_de_balon',
      nombre: 'Azote de balón',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'abdomen', 'espalda'],
      equipo: 'balon',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Sujeta el balón con ambas manos y llévalo por encima de la cabeza extendiendo el cuerpo. Azótalo contra el piso con toda la fuerza acompañando con el abdomen y la cadera. Recoge el balón flexionando las rodillas con la espalda recta y repite.',
      consejos: 'Usa un balón que no rebote y recógelo doblando las rodillas, nunca con la espalda redondeada.',
      musculos: 'Recto abdominal, dorsal ancho, deltoides, core'
    },
    {
      id: 'ej_sentadilla_press_mancuernas',
      nombre: 'Sentadilla con press de mancuernas',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'piernas', 'hombros'],
      equipo: 'mancuernas',
      nivel: 'principiante',
      tipo: 'funcional',
      instrucciones: 'Coloca las mancuernas a la altura de los hombros con las palmas al frente y los pies al ancho de hombros. Baja en sentadilla hasta el paralelo manteniendo el pecho arriba. Sube y, en el mismo impulso, empuja las mancuernas por encima de la cabeza.',
      consejos: 'Excelente para circuitos de acondicionamiento; si el peso te obliga a arquear la espalda al empujar, redúcelo.',
      musculos: 'Cuádriceps, glúteo mayor, deltoides, tríceps'
    },
    {
      id: 'ej_remo_renegado',
      nombre: 'Remo renegado',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'espalda', 'abdomen'],
      equipo: 'mancuernas',
      nivel: 'avanzado',
      tipo: 'funcional',
      instrucciones: 'Colócate en plancha alta sujetando una mancuerna en cada mano con los pies un poco más abiertos que los hombros. Rema una mancuerna hacia la cadera sin permitir que la cadera rote. Apóyala de nuevo y repite alternando lados con el core apretado.',
      consejos: 'Abre más los pies para ganar estabilidad; si la cadera gira en cada remo, el peso es demasiado.',
      musculos: 'Dorsal ancho, core, oblicuos, hombros'
    },
    {
      id: 'ej_arrastre_de_oso',
      nombre: 'Arrastre de oso',
      grupo: 'cuerpo_completo',
      grupos: ['cuerpo_completo', 'abdomen', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'funcional',
      instrucciones: 'Colócate en cuadrupedia con las rodillas despegadas unos centímetros del piso y la espalda plana. Avanza moviendo mano y pie contrarios al mismo tiempo, con pasos cortos. Recorre la distancia marcada manteniendo la cadera baja y estable.',
      consejos: 'Si la cadera se mueve de lado a lado como péndulo, acorta los pasos y ve más despacio.',
      musculos: 'Core, hombros, cuádriceps, glúteo mayor'
    },

    /* ===================== MOVILIDAD ===================== */
    {
      id: 'ej_gato_camello',
      nombre: 'Gato y camello',
      grupo: 'movilidad',
      grupos: ['movilidad', 'espalda'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Colócate en cuadrupedia con las manos bajo los hombros y las rodillas bajo la cadera. Redondea la espalda metiendo la barbilla y la pelvis, y sostén dos segundos. Después arquea suavemente abriendo el pecho y llevando la mirada al frente, alternando con la respiración.',
      consejos: 'Acompaña el movimiento con la respiración: exhala al redondear e inhala al arquear, sin forzar el cuello.',
      musculos: 'Columna dorsal y lumbar, core'
    },
    {
      id: 'ej_estiramiento_isquiotibiales',
      nombre: 'Estiramiento de isquiotibiales',
      grupo: 'movilidad',
      grupos: ['movilidad', 'piernas'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Coloca un talón sobre un banco o escalón bajo con la pierna extendida y la punta del pie hacia arriba. Lleva la cadera atrás inclinando el torso con la espalda recta hasta sentir el estiramiento detrás del muslo. Sostén entre 30 y 45 segundos y cambia de pierna.',
      consejos: 'No redondees la espalda para tocar el pie: el estiramiento se busca desde la cadera, no desde la columna.',
      musculos: 'Isquiotibiales, gemelos'
    },
    {
      id: 'ej_estiramiento_cuadriceps',
      nombre: 'Estiramiento de cuádriceps',
      grupo: 'movilidad',
      grupos: ['movilidad', 'piernas'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'De pie, sujétate de un soporte con una mano y toma el empeine del pie del mismo lado con la otra. Lleva el talón hacia el glúteo manteniendo las rodillas juntas y la pelvis metida. Sostén de 30 a 45 segundos y cambia de lado.',
      consejos: 'Mete la pelvis y aprieta el glúteo para sentir el estiramiento en el muslo y no en la rodilla.',
      musculos: 'Cuádriceps, flexores de cadera'
    },
    {
      id: 'ej_rotacion_toracica',
      nombre: 'Rotación torácica en cuadrupedia',
      grupo: 'movilidad',
      grupos: ['movilidad', 'espalda', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Colócate en cuadrupedia y lleva una mano detrás de la nuca. Gira el torso llevando el codo hacia el techo y abriendo el pecho, siguiendo el codo con la mirada. Regresa llevando el codo hacia el brazo de apoyo y repite de diez a doce veces por lado.',
      consejos: 'El giro sale de la espalda alta, no de la cadera: mantén el peso repartido entre las dos rodillas.',
      musculos: 'Columna torácica, oblicuos, hombros'
    },
    {
      id: 'ej_estiramiento_psoas',
      nombre: 'Estiramiento de psoas',
      grupo: 'movilidad',
      grupos: ['movilidad', 'piernas'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Apoya una rodilla en el piso y coloca el otro pie al frente formando 90 grados en ambas piernas. Mete la pelvis apretando el glúteo del lado de la rodilla apoyada y empuja la cadera al frente. Sostén de 30 a 45 segundos por lado, subiendo el brazo del mismo lado para intensificar.',
      consejos: 'Si arqueas la espalda baja no estiras nada: la pelvis metida es la condición para sentir el psoas.',
      musculos: 'Psoas iliaco, recto femoral'
    },
    {
      id: 'ej_perro_boca_abajo',
      nombre: 'Perro boca abajo',
      grupo: 'movilidad',
      grupos: ['movilidad', 'espalda', 'piernas'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Desde plancha alta, empuja la cadera hacia arriba y atrás formando una V invertida con el cuerpo. Estira los brazos, alarga la columna y lleva los talones hacia el piso sin forzar. Sostén de 30 a 60 segundos respirando profundo, pedaleando ligeramente los talones.',
      consejos: 'Prioriza la espalda larga sobre los talones abajo: flexiona un poco las rodillas si los isquiotibiales están cortos.',
      musculos: 'Isquiotibiales, gemelos, dorsal ancho, hombros'
    },
    {
      id: 'ej_postura_del_nino',
      nombre: 'Postura del niño',
      grupo: 'movilidad',
      grupos: ['movilidad', 'espalda'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Arrodíllate con los dedos gordos juntos y las rodillas abiertas al ancho de la cadera. Siéntate sobre los talones y estira los brazos al frente apoyando la frente en el piso. Respira profundo y sostén de 45 a 90 segundos relajando la espalda.',
      consejos: 'Perfecta para cerrar la sesión o entre series pesadas de sentadilla: relaja lumbar, cadera y hombros al mismo tiempo.',
      musculos: 'Espalda baja, dorsal ancho, glúteos, cadera'
    },
    {
      id: 'ej_movilidad_hombros_banda',
      nombre: 'Movilidad de hombros con banda',
      grupo: 'movilidad',
      grupos: ['movilidad', 'hombros'],
      equipo: 'banda',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Sujeta una banda con las manos bien separadas y los brazos extendidos frente al cuerpo. Lleva la banda por encima de la cabeza hasta llevarla detrás de la espalda sin flexionar los codos. Regresa por el mismo camino y repite de diez a quince veces.',
      consejos: 'Empieza con las manos muy separadas y ve cerrando el agarre conforme mejore tu movilidad; nunca fuerces el hombro.',
      musculos: 'Deltoides, pectoral, manguito rotador'
    },
    {
      id: 'ej_cadera_90_90',
      nombre: 'Movilidad de cadera 90 90',
      grupo: 'movilidad',
      grupos: ['movilidad', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'intermedio',
      tipo: 'movilidad',
      instrucciones: 'Siéntate en el piso con una pierna al frente y otra al costado, ambas con 90 grados en rodilla y cadera. Mantén la espalda recta e inclínate hacia la pierna delantera hasta sentir el glúteo. Sostén 30 segundos y gira las piernas al otro lado sin usar las manos si puedes.',
      consejos: 'Si la espalda se redondea, siéntate sobre un disco o cojín para ganar altura y trabajar en buena posición.',
      musculos: 'Glúteo mayor, rotadores de cadera, aductores'
    },
    {
      id: 'ej_estiramiento_pectoral_marco',
      nombre: 'Estiramiento de pectoral en marco',
      grupo: 'movilidad',
      grupos: ['movilidad', 'pecho', 'hombros'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Apoya el antebrazo en el marco de una puerta o en un poste con el codo a la altura del hombro. Da un paso al frente girando suavemente el torso hacia el lado contrario. Sostén de 30 a 45 segundos por lado sin llegar al dolor.',
      consejos: 'Cambia la altura del codo para estirar las distintas fibras del pectoral: arriba, a la altura del hombro y abajo.',
      musculos: 'Pectoral mayor, pectoral menor, deltoides anterior'
    },
    {
      id: 'ej_circulos_de_cadera',
      nombre: 'Círculos de cadera',
      grupo: 'movilidad',
      grupos: ['movilidad', 'gluteos'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'De pie, sujétate de un soporte y eleva una rodilla a la altura de la cadera. Dibuja círculos amplios abriendo la pierna hacia afuera y regresándola al frente. Haz diez círculos en cada sentido y cambia de pierna.',
      consejos: 'Es un calentamiento ideal antes de piernas: mantén el torso quieto y deja que solo se mueva la cadera.',
      musculos: 'Rotadores de cadera, glúteo medio, psoas'
    },
    {
      id: 'ej_estiramiento_gemelos',
      nombre: 'Estiramiento de gemelos',
      grupo: 'movilidad',
      grupos: ['movilidad', 'piernas'],
      equipo: 'peso_corporal',
      nivel: 'principiante',
      tipo: 'movilidad',
      instrucciones: 'Coloca las manos en la pared y lleva una pierna hacia atrás con la rodilla extendida y el talón pegado al piso. Empuja la cadera al frente hasta sentir el estiramiento en la pantorrilla. Sostén 30 segundos, luego flexiona ligeramente esa rodilla otros 30 segundos para el sóleo.',
      consejos: 'El talón nunca se despega del piso; si lo hace, acerca el pie a la pared y busca menos rango.',
      musculos: 'Gemelos, sóleo, tendón de Aquiles'
    }
  ];

  /* -------------------------------------------------------------
     Catálogo de grupos musculares (11) con nombre, icono y color.
     ------------------------------------------------------------- */
  AG.Data.GRUPOS = [
    { id: 'pecho',           nombre: 'Pecho',          icono: 'escudo',    color: '#e4322b' },
    { id: 'espalda',         nombre: 'Espalda',        icono: 'pesa',      color: '#2f80ed' },
    { id: 'hombros',         nombre: 'Hombros',        icono: 'mancuerna', color: '#f2994a' },
    { id: 'biceps',          nombre: 'Bíceps',         icono: 'rayo',      color: '#9b51e0' },
    { id: 'triceps',         nombre: 'Tríceps',        icono: 'fuego',     color: '#eb5757' },
    { id: 'piernas',         nombre: 'Piernas',        icono: 'trofeo',    color: '#27ae60' },
    { id: 'gluteos',         nombre: 'Glúteos',        icono: 'meta',      color: '#d65c9c' },
    { id: 'abdomen',         nombre: 'Abdomen',        icono: 'cinta',     color: '#f2c94c' },
    { id: 'cardio',          nombre: 'Cardio',         icono: 'corazon',   color: '#ff5a5f' },
    { id: 'cuerpo_completo', nombre: 'Cuerpo completo', icono: 'clase',    color: '#00b8a9' },
    { id: 'movilidad',       nombre: 'Movilidad',      icono: 'estrella',  color: '#56ccf2' }
  ];

  /* -------------------------------------------------------------
     Catálogo de equipos (9).
     ------------------------------------------------------------- */
  AG.Data.EQUIPOS = [
    { id: 'barra',         nombre: 'Barra' },
    { id: 'mancuernas',    nombre: 'Mancuernas' },
    { id: 'maquina',       nombre: 'Máquina' },
    { id: 'polea',         nombre: 'Polea' },
    { id: 'peso_corporal', nombre: 'Peso corporal' },
    { id: 'kettlebell',    nombre: 'Kettlebell' },
    { id: 'banda',         nombre: 'Banda elástica' },
    { id: 'balon',         nombre: 'Balón' },
    { id: 'cardio',        nombre: 'Equipo de cardio' }
  ];

  /* -------------------------------------------------------------
     Utilidades internas
     ------------------------------------------------------------- */

  // Quita acentos y pasa a minúsculas para poder buscar sin diacríticos.
  var ACENTOS = {
    'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a',
    'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
    'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
    'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
    'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
    'ñ': 'n', 'ç': 'c'
  };

  function normalizar(texto) {
    if (texto === null || texto === undefined) return '';
    var s = String(texto).toLowerCase();
    var salida = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      salida += (ACENTOS[c] !== undefined ? ACENTOS[c] : c);
    }
    return salida;
  }

  // Índice por id para búsquedas inmediatas (conserva la primera aparición).
  var indice = {};
  (function construirIndice() {
    var lista = AG.Data.exercises;
    for (var i = 0; i < lista.length; i++) {
      var ej = lista[i];
      if (ej && ej.id && !Object.prototype.hasOwnProperty.call(indice, ej.id)) {
        indice[ej.id] = ej;
      }
    }
  })();

  // Texto normalizado de cada ejercicio para la búsqueda libre.
  var textoBusqueda = {};
  (function construirTextos() {
    var lista = AG.Data.exercises;
    for (var i = 0; i < lista.length; i++) {
      var ej = lista[i];
      if (!ej || !ej.id) continue;
      var grupos = (ej.grupos && ej.grupos.join) ? ej.grupos.join(' ') : '';
      textoBusqueda[ej.id] = normalizar(
        (ej.nombre || '') + ' ' + (ej.musculos || '') + ' ' + (ej.grupo || '') + ' ' +
        grupos + ' ' + (ej.equipo || '') + ' ' + (ej.nivel || '') + ' ' + (ej.tipo || '')
      );
    }
  })();

  /* -------------------------------------------------------------
     API pública
     ------------------------------------------------------------- */

  /**
   * Devuelve el ejercicio con ese id, o null si no existe.
   */
  AG.Data.ejercicio = function (id) {
    if (!id) return null;
    var ej = indice[String(id)];
    return ej || null;
  };

  /**
   * Filtra el catálogo. Filtro opcional: {grupo, equipo, nivel, texto}.
   * La búsqueda de texto ignora acentos y mayúsculas.
   */
  AG.Data.ejerciciosPor = function (filtro) {
    var f = filtro || {};
    var grupo = f.grupo && f.grupo !== 'todos' ? String(f.grupo) : '';
    var equipo = f.equipo && f.equipo !== 'todos' ? String(f.equipo) : '';
    var nivel = f.nivel && f.nivel !== 'todos' ? String(f.nivel) : '';
    var texto = normalizar(f.texto || '').trim();
    var palabras = texto ? texto.split(/\s+/) : [];

    return AG.Data.exercises.filter(function (ej) {
      if (!ej) return false;

      if (grupo) {
        var enGrupos = !!(ej.grupos && ej.grupos.indexOf && ej.grupos.indexOf(grupo) !== -1);
        if (ej.grupo !== grupo && !enGrupos) return false;
      }
      if (equipo && ej.equipo !== equipo) return false;
      if (nivel && ej.nivel !== nivel) return false;

      if (palabras.length) {
        var base = textoBusqueda[ej.id] || normalizar(ej.nombre || '');
        for (var i = 0; i < palabras.length; i++) {
          if (base.indexOf(palabras[i]) === -1) return false;
        }
      }
      return true;
    });
  };

  /**
   * Nombre legible de un ejercicio; 'Ejercicio' si no se encuentra.
   */
  AG.Data.nombreEjercicio = function (id) {
    var ej = AG.Data.ejercicio(id);
    return (ej && ej.nombre) ? ej.nombre : 'Ejercicio';
  };

  /**
   * Nombre bonito de un grupo muscular ('Cuerpo completo', 'Bíceps'...).
   */
  AG.Data.nombreGrupo = function (id) {
    for (var i = 0; i < AG.Data.GRUPOS.length; i++) {
      if (AG.Data.GRUPOS[i].id === id) return AG.Data.GRUPOS[i].nombre;
    }
    return 'General';
  };

  /**
   * Nombre legible de un equipo ('Peso corporal', 'Banda elástica'...).
   */
  AG.Data.nombreEquipo = function (id) {
    for (var i = 0; i < AG.Data.EQUIPOS.length; i++) {
      if (AG.Data.EQUIPOS[i].id === id) return AG.Data.EQUIPOS[i].nombre;
    }
    return 'Sin equipo';
  };

  /**
   * Datos del grupo (nombre, icono, color) o un objeto neutro si no existe.
   */
  AG.Data.grupo = function (id) {
    for (var i = 0; i < AG.Data.GRUPOS.length; i++) {
      if (AG.Data.GRUPOS[i].id === id) return AG.Data.GRUPOS[i];
    }
    return { id: 'general', nombre: 'General', icono: 'pesa', color: '#8a8f98' };
  };

  /**
   * Cuántos ejercicios hay por grupo: {pecho: 18, espalda: 21, ...}
   */
  AG.Data.conteoPorGrupo = function () {
    var conteo = {};
    for (var i = 0; i < AG.Data.GRUPOS.length; i++) conteo[AG.Data.GRUPOS[i].id] = 0;
    for (var j = 0; j < AG.Data.exercises.length; j++) {
      var g = AG.Data.exercises[j].grupo;
      if (Object.prototype.hasOwnProperty.call(conteo, g)) conteo[g]++;
    }
    return conteo;
  };

})(window.AG);
