# ALLIANCE GYM — Rediseño v2
## Menos texto, más ilustración, y sesiones con entrenador en vez de clases

Complemento de `ARQUITECTURA.md`. **Todo lo del contrato original sigue vigente**; esto lo extiende y
corrige. Léelo completo antes de escribir código.

---

## 1. Principios de la interfaz (aplican a TODA pantalla que toques)

El dueño dio esta retroalimentación textual: *"es como mucha información para el usuario de lleno… luego a
las personas no les gusta leer… que sea más intuitivo"*.

**Reglas duras de redacción y densidad:**

1. **Saludo humano primero.** Cada panel de inicio abre con un saludo cálido y corto:
   `Hola, Ana 👋` / `Hoy es jueves 6 de septiembre`. Nada de jerga ni de cifras en el saludo.
2. **Una sola acción principal.** Debajo del saludo va **una** tarjeta grande con lo único que esa persona
   tiene que hacer hoy, y un botón. Nada compite con ella.
3. **Máximo 5 bloques visibles al abrir.** Lo demás va colapsado (`<details>` estilizado o acordeón propio)
   o se mueve a su propia pantalla con un enlace.
4. **Sin párrafos.** Frases de una línea. Si necesitas explicar, usa una lista de 3 puntos cortos.
   Prohibido cualquier bloque de texto de más de 2 renglones en pantalla de inicio.
5. **Número grande + etiqueta corta.** En vez de "Has asistido 5 veces durante el mes de septiembre",
   pon `5` y debajo `visitas este mes`.
6. **Icono o ilustración antes que descripción.** Si un dibujo lo explica, no lo escribas.
7. **Progresivo.** El detalle se revela al pulsar, nunca de entrada. Patrón: resumen → "Ver detalle" → todo.
8. **Tono.** Cercano, mexicano, motivador y breve. Nada de tecnicismos ("adherencia" → "constancia";
   "déficit calórico" → "comes un poco menos de lo que gastas").

**Componentes nuevos disponibles** (los define `css/styles.css`, úsalos tal cual):
`.saludo .saludo-hola .saludo-fecha` · `.hoy .hoy-eyebrow .hoy-titulo .hoy-meta .hoy-accion .hoy-ilustra` ·
`.tiles .tile .tile-val .tile-label .tile-icono` · `.desplegable .desplegable-cab .desplegable-cuerpo` ·
`.paso .paso-num .paso-txt` · `.ilustra .ilustra-cap` · `.vacio-amable` · `.chip-dia(.on)` ·
`.slot(.libre/.ocupado/.mio)` · `.evento .evento-fecha .evento-cupo`

---

## 2. Sistema de ilustraciones de ejercicios

**Archivo nuevo:** `js/data/ilustraciones.js` → `AG.Ilustra`
Se carga en `index.html` **después** de `js/data/exercises.js`.

### API
```
AG.Ilustra.get(ejercicioId, opts)   -> string con <svg> completo
AG.Ilustra.porPatron(patronId, opts)-> string con <svg>
AG.Ilustra.patronDe(ejercicioId)    -> 'sentadilla' | 'press_banca' | ...
AG.Ilustra.PATRONES                 -> { id: { nombre, musculos, dibujo(fase) } }
AG.Ilustra.lista                    -> [ids de patrón]
```
`opts = { alto: 180, animado: true, fase: 'ambas'|'inicio'|'fin', color, fondo: true, id }`

### Cómo debe verse
- **Figura humana reconocible** (silueta con cabeza, torso, brazos, piernas y articulaciones), no un monigote
  de palitos descuidado. Trazo grueso y redondeado, estilo pictograma deportivo.
- **Dos fases**: `inicio` y `fin` del movimiento. Con `animado:true` alternan cada 1.6 s con una transición
  suave (dos `<g>` cuyo `opacity` se anima con CSS `@keyframes`), de modo que el dibujo **demuestra** el
  ejercicio. Respeta `prefers-reduced-motion`: si está activo, muestra las dos fases lado a lado, fijas.
- **Equipo visible**: barra con discos, mancuerna, polea con cable, banca, colchoneta o máquina según el patrón.
- Colores desde `var(--*)`: figura en `--texto`, equipo en `--rojo`, piso/guías en `--borde`.
- `viewBox` cuadrado o 4:3, `width:100%`, altura por `opts.alto`. Ids internos únicos (contador propio).
- Si el ejercicio no tiene patrón conocido, devuelve el patrón genérico de su grupo muscular. **Nunca vacío.**

### Cobertura mínima: 34 patrones
`sentadilla, sentadilla_frontal, prensa, zancada, peso_muerto, peso_muerto_rumano, hip_thrust,
extension_cuadriceps, curl_femoral, gemelo, press_banca, press_inclinado, apertura, flexion, fondo,
jalon, dominada, remo, remo_polea, pullover, press_hombro, elevacion_lateral, elevacion_frontal, pajaro,
curl_biceps, curl_martillo, extension_triceps, press_frances, plancha, abdominal, elevacion_piernas,
giro_ruso, correr, bici, kettlebell_swing, movilidad`

### Mapeo
`AG.Ilustra.patronDe(id)` resuelve por, en este orden: tabla explícita de excepciones → palabras clave del
nombre del ejercicio (sin acentos) → `grupo` + `equipo` del ejercicio → genérico del grupo.
**Los 156 ejercicios de `AG.Data.exercises` deben resolver a un patrón razonable.** Incluye una función
`AG.Ilustra.auditar()` que devuelve `{ sinPatron: [], porPatron: {} }` para poder verificarlo.

---

## 3. Se eliminan las CLASES. Entran SESIONES CON ENTRENADOR y EVENTOS

El gimnasio **no imparte clases grupales**. Lo que sí ofrece:

- **Sesión con entrenador**: cada socio puede agendar **una sesión por semana** (lunes a domingo) con un
  entrenador, en un horario disponible.
- **Eventos especiales**: actividades ocasionales (retos, clínicas de técnica, competencias internas,
  convivencias) a las que el socio se inscribe.

`js/modules/clases.js` **se elimina**. La colección `clases` deja de usarse.

### Colecciones nuevas en `AG.DB.state`

```js
disponibilidad: [
  { id:'dp_xxxx', coachId, dia:'lunes'|…|'domingo', desde:'07:00', hasta:'11:00',
    duracionMin:60, activa:true }
]

sesiones: [
  { id:'se_xxxx', socioId, coachId, fecha:'YYYY-MM-DD', hora:'HH:MM', duracionMin:60,
    tipo:'entrenamiento'|'valoracion'|'seguimiento',
    estado:'agendada'|'completada'|'cancelada'|'no_asistio',
    objetivo:String, notasCoach:String, notasSocio:String,
    creada:'YYYY-MM-DD', creadaPor:'u_xxxx' }
]

eventos: [
  { id:'ev_xxxx', nombre, descripcion, tipo:'reto'|'clinica'|'competencia'|'social'|'taller',
    fecha:'YYYY-MM-DD', hora:'HH:MM', duracionMin, lugar, cupo, inscritos:[socioId],
    coachId, color, costo:0, activo:true }
]
```

### Reglas de negocio
- **Una sesión agendada por socio por semana natural** (lunes a domingo). Al intentar una segunda, el sistema
  lo explica con cariño y ofrece cambiar la existente.
- Solo socios con membresía **activa** pueden agendar.
- Un hueco se ocupa cuando ya hay una sesión agendada de ese coach a esa fecha y hora.
- Cancelar con menos de 4 horas de anticipación se marca igual como cancelada, pero avisa que ese lugar
  ya no se puede reasignar.
- Al completarse una sesión, el coach puede dejar notas que el socio ve en su panel.

### Helpers obligatorios en `AG.DB`
```
AG.DB.disponibilidadDe(coachId)                 -> array
AG.DB.sesionesDe(socioId)                       -> array ordenado por fecha
AG.DB.sesionesDeCoach(coachId, desde, hasta)    -> array
AG.DB.sesionDeLaSemana(socioId, fechaRef)       -> sesion|null
AG.DB.huecosDe(coachId, fecha)                  -> [{hora, libre, sesionId}]
AG.DB.eventosProximos(limite)                   -> array
```

### Rutas (reemplazan a las de clases)
| Archivo | Rutas |
|---|---|
| `js/modules/sesiones.js` | `socio/entrenador`, `coach/sesiones`, `director/sesiones` |
| `js/modules/eventos.js` | `director/eventos` (el socio ve los eventos dentro de `socio/entrenador`) |

**Menú actualizado**
- Socio · Mi entrenamiento: Mi rutina(1), Mi progreso(2), Mi nutrición(3), Calculadora(4),
  **Mi entrenador(5)**, Ejercicios(6)
- Coach · Entrenamiento: Mis socios(1), **Sesiones(2)**, Mediciones(3), Rutinas(4), Nutrición(5), Ejercicios(6)
- Director · Operación: Socios(1), Pagos(2), Asistencia(3), **Sesiones(4)** · Negocio: Reportes(1),
  Calificaciones(2), Avisos(3), **Eventos(4)**

### Funciones compartidas
```
AG.Mod.Sesiones.agendar(socioId, opts)      // modal de reserva
AG.Mod.Sesiones.proximaDe(usuario)          // {sesion, cuando} para los paneles de inicio
AG.Mod.Sesiones.deCoach(coachId, desde, hasta)
AG.Mod.Sesiones.tarjeta(sesion, opts)       // HTML reutilizable
AG.Mod.Eventos.proximos(limite)             // array
AG.Mod.Eventos.tarjetas(usuario, limite)    // HTML para paneles de inicio
AG.Mod.Eventos.inscribir(eventoId, socioId)
```

`AG.Mod.Clases` deja de existir: quien lo llamaba debe usar `AG.Mod.Sesiones` / `AG.Mod.Eventos`.

---

## 4. Datos de demostración

`js/data/seed.js` debe dejar de generar `clases` y en su lugar generar:
- **Disponibilidad** de los 5 coaches (bloques realistas de mañana y tarde, lunes a sábado).
- **Sesiones**: historial de las últimas 8 semanas (la mayoría `completada`, algunas `cancelada` y
  `no_asistio`) más las agendadas de la semana en curso y la siguiente. Ana Sofía debe tener una sesión
  **agendada próximamente** y varias completadas con notas del coach.
- **Eventos**: 6 eventos (reto de 8 semanas, clínica de técnica de peso muerto, competencia interna de
  press de banca, taller de nutrición, rodada/carrera 5K, convivencia de aniversario), algunos ya pasados
  y otros próximos, con inscritos.
- Respeta la regla de una sesión por socio por semana al generar los datos.

---

## 5. Nutrición mexicana, de todos los días

Retroalimentación literal del dueño: *"la zona donde estoy es de ingreso medio… arroz, frijol, huevo,
tortilla, estamos en México… más enfocado a una dieta mexicana… como una recomendación de qué desayunar"*.

**Reglas:**
1. Toda recomendación de comida se arma con **básicos mexicanos accesibles primero**: huevo, frijol, tortilla
   de maíz, arroz, avena, plátano, papa, nopal, jitomate, cebolla, pollo, atún, lenteja, pan bolillo,
   leche, queso panela/fresco, yogur natural, manzana, naranja. El catálogo ya los trae etiquetados
   `mexicano` y `económico`: **priorízalos** en `generarMenu` y en cualquier sugerencia.
2. Los alimentos "de gimnasio caro" (salmón, quinoa, arándanos, crema de almendra…) solo aparecen si el
   usuario los busca; nunca en una recomendación automática.
3. Las comidas se nombran como platillos reales, no como listas de macros:
   *"2 huevos a la mexicana con frijoles y 2 tortillas"*, *"Pollo asado con arroz y nopales"*,
   *"Avena con plátano y leche"*, *"Tacos de atún con jitomate"*, *"Molletes con frijol y queso panela"*.
   La lista de ingredientes con gramos se muestra debajo, en pequeño, para quien quiera el detalle.
4. Cantidades en **medidas caseras primero** (2 tortillas, 1 taza de arroz, 1 pieza de plátano) y gramos
   en segundo plano.

### Recomendación del día
```
AG.Mod.Nutricion.recomendacionDelDia(socio, fecha) -> {
  entrenaHoy: Boolean, horario: 'manana'|'mediodia'|'tarde'|'noche'|'variable',
  comidas: [ { momento:'desayuno'|'colacion'|'comida'|'pre_entreno'|'post_entreno'|'cena',
               hora:'08:00', platillo:'2 huevos con frijoles y 2 tortillas', kcal, proteina, carbos, grasa,
               ingredientes:[{alimentoId, gramos, casera}], sustituto: producto|null } ],
  mensaje: String   // UNA línea, cálida
}
```
- Determinista por socio + fecha (misma recomendación todo el día, distinta mañana).
- Se adapta al **horario de entreno** del socio (sección 6): si entrena en la mañana, propone algo ligero
  antes (plátano, avena) y el desayuno fuerte después; si entrena en la tarde, colación pre-entreno a las
  16:30 y cena con proteína; si es variable, versión neutra.
- Si el socio tiene plan del coach, la recomendación del día **respeta sus kcal y macros**; si no, usa la
  calculadora con su perfil.

## 6. Productos del gimnasio como sustituto

El gimnasio **vende productos de entreno** (licuados de proteína, barras, avena preparada, etc.).

**Colección nueva** `productos` en `AG.DB.state`:
```js
{ id:'pr_xxxx', nombre:'Licuado de proteína con plátano', descripcion:'Proteína de suero, plátano, avena y leche',
  precio:65, kcal:380, proteina:32, carbos:42, grasa:8,
  sustituye:['desayuno','post_entreno'],   // momentos que puede reemplazar
  disponible:true, icono:'gota' }
```
- El **director** los administra en `director/config` (pestaña nueva **Productos**): alta, edición, precio,
  disponible/no disponible.
- El **socio** ve, en su nutrición y en la recomendación del día, un **letrero amable** cuando aplica:
  *"¿No alcanzaste a desayunar? En recepción tenemos el Licuado de proteína con plátano ($65) — te cubre
  el desayuno."* Se muestra junto al desayuno y junto al post-entreno, nunca de forma insistente
  (una tarjeta pequeña `.sustituto`, no un anuncio).
- `AG.Mod.Nutricion.productosQueSustituyen(momento)` -> array de productos disponibles para ese momento.
- El seed crea 6 productos realistas (licuado de proteína, licuado verde, avena con fruta, barra de
  proteína, sándwich de pavo, agua de coco / bebida hidratante).

## 7. Horario de entreno y bienvenida con preguntas

Campos nuevos en `Usuario` (socio):
```js
horarioEntreno: 'manana'|'mediodia'|'tarde'|'noche'|'variable',
diasMeta: 3,            // cuántos días a la semana quiere venir (2-6)
desayunaAntes: true,    // ¿desayuna antes de entrenar?
bienvenidaHecha: false  // ya respondió las preguntas
```
- **Bienvenida**: la primera vez que un socio entra (`bienvenidaHecha` falso), `socio/inicio` muestra —
  en lugar del panel — una tarjeta cálida de 3 preguntas con .radio-cards grandes e ilustradas:
  1. *"¿A qué hora sueles venir?"* (Mañana · Mediodía · Tarde · Noche · Depende del día)
  2. *"¿Cuántos días a la semana quieres venir?"* (2 · 3 · 4 · 5 · 6)
  3. *"¿Desayunas antes de entrenar?"* (Sí · No · A veces)
  Guarda en el usuario, marca `bienvenidaHecha`, y entra al panel con un *"¡Listo, Ana! Ya te acomodé el
  día."* Se puede cambiar después en `socio/perfil`, sección "Mis horarios".
- El seed deja a Ana Sofía con `bienvenidaHecha:true` (para que el demo abra directo) y al resto de socios
  también, salvo 3 socios recientes con `false` para poder probar el flujo.

## 8. Tono: nadie se siente regañado

Retroalimentación literal: *"si no marcaste algunos días… que la persona quiera seguir yendo… un día de
descanso no es decirle a la gente que no vaya"*.

**Reglas de redacción para todos los paneles del socio:**
- **Días perdidos**: nunca "llevas 5 días sin venir". Sí: *"Te extrañamos. Hoy es un buen día para volver 💪"*,
  y la tarjeta HOY ofrece algo corto y fácil (*"Empieza con 20 minutos"*).
- **Racha rota**: no se muestra el cero. Se muestra *"Nueva racha desde hoy"*.
- **Día de descanso**: la tarjeta HOY nunca dice "no vengas". Dice *"Hoy toca descanso activo"* y ofrece
  dos opciones con botón: *"Cardio ligero 20 min"* o *"Movilidad y estiramiento"* (ambas con ilustración),
  además de *"Si prefieres descansar por completo, también está bien"*. Si el socio quiere, puede registrar
  la sesión ligera igual que cualquier entrenamiento.
- **Fin de semana**: mismo trato que descanso activo si no le toca rutina; si el gimnasio abre, se le
  recuerda el horario del sábado/domingo.
- **Adherencia baja**: no se muestra el porcentaje en rojo en el inicio. Se muestra *"Esta semana llevas 1 de
  3"* con una barra amable y el botón para agendar su sesión con el entrenador.
- **Palabras prohibidas en el panel del socio**: adherencia, déficit, superávit, retroceso, fallo, incumplido.
