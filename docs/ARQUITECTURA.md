# ALLIANCE GYM — Sistema de Gestión Integral
## Contrato de arquitectura (LEER COMPLETO ANTES DE ESCRIBIR CÓDIGO)

Este documento es la fuente de verdad. Todo archivo del proyecto DEBE respetarlo al pie de la letra.

---

## 0. Reglas duras

1. **Sin build, sin npm, sin CDN, sin frameworks.** HTML + CSS + JavaScript vanilla. La app debe abrir con doble clic en `index.html` (protocolo `file://`) y también servida por HTTP.
2. **Scripts clásicos, NO ES modules.** Nada de `import`/`export`/`type="module"`. Cada archivo empieza con:
   ```js
   window.AG = window.AG || {};
   (function (AG) {
     'use strict';
     // ... código ...
   })(window.AG);
   ```
3. **Todo en español** (es-MX): textos de interfaz, nombres de variables de dominio, comentarios.
4. **Persistencia:** `localStorage` bajo la llave `alliance_gym_db_v1` a través de `AG.DB`. NUNCA usar `localStorage` directamente fuera de `js/core/db.js` (excepto `js/core/auth.js` para la sesión).
5. **Sin dependencias externas de red.** Gráficas = SVG propio (`AG.Charts`). Iconos = SVG propio (`AG.Icons`). Ninguna etiqueta `<script src="http...">` ni `@import url(http...)`.
6. **Escapar SIEMPRE** el texto que venga del usuario con `AG.Utils.esc()` antes de meterlo en HTML.
7. **Un archivo = un responsable.** No edites archivos que no te fueron asignados.
8. Moneda y nombre del gimnasio salen SIEMPRE de `AG.DB.state.settings`, nunca hardcodeados.
9. Nada de `alert()`, `confirm()` ni `prompt()` nativos: usa `AG.Utils.toast` y `AG.Utils.modal` / `AG.Utils.confirmar`.

---

## 1. Estructura de archivos y orden de carga

```
index.html
css/styles.css
js/core/utils.js      -> AG.Utils
js/core/icons.js      -> AG.Icons
js/core/calc.js       -> AG.Calc
js/core/charts.js     -> AG.Charts
js/core/db.js         -> AG.DB
js/data/exercises.js  -> AG.Data.exercises
js/data/foods.js      -> AG.Data.foods
js/data/seed.js       -> AG.Seed
js/core/auth.js       -> AG.Auth
js/core/router.js     -> AG.Router
js/modules/*.js       -> AG.Mod.*   (registran rutas)
js/views/*.js         -> AG.Views.* (registran rutas)
js/app.js             -> arranque
```

El orden de `<script>` en `index.html` es exactamente ese. Un archivo solo puede usar en **tiempo de carga** lo que se cargó antes que él; dentro de funciones (que se ejecutan después del arranque) puede usar todo.

---

## 2. Roles

| Rol | id string | Qué ve |
|-----|-----------|--------|
| Director | `director` | TODO: finanzas, socios, coaches, reportes, calificaciones, configuración |
| Coach | `coach` | Sus socios asignados, mediciones, rutinas, planes de nutrición, agenda, sus calificaciones |
| Socio | `socio` | Su panel: pagos y membresía, mediciones y progreso, rutina del día/semana, nutrición, calculadora, calificar |

---

## 3. Modelo de datos (`AG.DB.state`)

```js
{
  meta:    { version: 1, creado: ISOString, actualizado: ISOString, folioPago: 1 },
  settings: {
    nombreGym: 'ALLIANCE GYM',
    lema: 'Más fuertes juntos',
    moneda: 'MXN', simbolo: '$', locale: 'es-MX',
    direccion, telefono, email, horario,
    tema: 'oscuro',            // 'oscuro' | 'claro'
    diasGraciaPago: 5,
    metaSociosMes: 20,
    metaIngresoMensual: 120000,
    costoFijoMensual: 45000
  },
  planes: [ Plan ],
  usuarios: [ Usuario ],
  pagos: [ Pago ],
  mediciones: [ Medicion ],
  rutinas: [ Rutina ],
  asignaciones: [ Asignacion ],
  bitacoras: [ Bitacora ],
  planesNutricion: [ PlanNutricion ],
  calificaciones: [ Calificacion ],
  asistencias: [ Asistencia ],
  avisos: [ Aviso ],
  clases: [ Clase ],
  notificaciones: [ Notificacion ]
}
```

### Plan
```js
{ id:'pl_xxxx', nombre:'Mensual', precio:650, meses:1, descripcion:'',
  beneficios:['Acceso completo'], color:'#e4322b', activo:true, inscripcion:250 }
```

### Usuario
```js
{
  id: 'u_xxxx', rol: 'director'|'coach'|'socio',
  nombre, apellidos, email, telefono, password,   // password en claro: app local de demo
  avatarColor: '#hex', activo: true,
  creado: 'YYYY-MM-DD',
  // --- socio ---
  codigo: 'AG-0001',
  fechaNacimiento: 'YYYY-MM-DD', sexo: 'H'|'M',
  estaturaCm: Number,
  objetivo: 'perder_grasa'|'ganar_musculo'|'mantener'|'rendimiento'|'salud',
  nivel: 'principiante'|'intermedio'|'avanzado',
  nivelActividad: 'sedentario'|'ligero'|'moderado'|'alto'|'atleta',
  coachId: 'u_xxxx'|null,
  planId: 'pl_xxxx',
  fechaAlta: 'YYYY-MM-DD',
  fechaVencimiento: 'YYYY-MM-DD',
  estado: 'activo'|'vencido'|'congelado'|'baja',
  padecimientos: String, alergias: String,
  contactoEmergencia: { nombre, telefono, parentesco },
  notas: String,
  // --- coach ---
  especialidad: String, bio: String, certificaciones: [String],
  fechaContratacion: 'YYYY-MM-DD', sueldo: Number, cupoMaximo: Number, horario: String
}
```

### Pago
```js
{ id:'pg_xxxx', socioId, planId, monto, metodo:'efectivo'|'tarjeta'|'transferencia'|'app',
  fecha:'YYYY-MM-DD', periodoInicio:'YYYY-MM-DD', periodoFin:'YYYY-MM-DD',
  concepto:'mensualidad'|'inscripcion'|'clase'|'producto'|'personalizado',
  estado:'pagado'|'pendiente'|'cancelado', folio:'REC-000001',
  registradoPor:'u_xxxx', nota:String }
```

### Medicion — LA PIEZA CLAVE (inicio y fin de mes)
```js
{ id:'m_xxxx', socioId, coachId, fecha:'YYYY-MM-DD',
  periodo:'YYYY-MM',            // mes al que pertenece
  tipo:'inicial'|'final',       // inicial = principio de mes, final = cierre de mes
  pesoKg, estaturaCm, grasaPct, musculoKg, aguaPct, imc,
  medidas: { cuello, hombros, pecho, brazoDer, brazoIzq, cintura, cadera, musloDer, musloIzq, pantorrilla }, // cm
  pliegues: { triceps, subescapular, suprailiaco, abdominal, muslo }, // mm (opcional)
  presion:'120/80', fcReposo:Number,
  fuerza: { pressBanca, sentadilla, pesoMuerto },  // kg (opcional)
  notas:String, visibleParaSocio:true }
```
El **comparativo automático** lo calcula `AG.Calc.compararMediciones(inicial, final)`; NO se guarda, se deriva siempre.

### Rutina
```js
{ id:'r_xxxx', nombre, objetivo, nivel, diasPorSemana, descripcion,
  creadaPor:'u_xxxx', creada:'YYYY-MM-DD', esPlantilla:Boolean,
  dias: [
    { nombre:'Día 1', enfoque:'Pecho y Tríceps', calentamiento:String, cardio:String,
      ejercicios: [ { ejercicioId, series, reps:'8-10', descansoSeg, tempo, peso:'', notas } ] }
  ] }
```

### Asignacion
```js
{ id:'as_xxxx', socioId, rutinaId, coachId, fechaInicio, fechaFin, activa:Boolean, notas }
```

### Bitacora (entrenamiento registrado por el socio)
```js
{ id:'bt_xxxx', socioId, fecha:'YYYY-MM-DD', rutinaId, diaIndex:Number,
  ejercicios:[ { ejercicioId, series:[ { reps:Number, peso:Number, hecho:Boolean } ] } ],
  duracionMin, esfuerzo:1..10, notas, completada:Boolean }
```

### PlanNutricion
```js
{ id:'nu_xxxx', socioId, coachId, creado:'YYYY-MM-DD', objetivo:'definir'|'volumen'|'mantener',
  kcal, proteina, carbos, grasa, agua,
  comidas: [ { nombre:'Desayuno', hora:'08:00', alimentos:[ { alimentoId, gramos } ] } ],
  notas, activo:Boolean }
```

### Calificacion
```js
{ id:'cf_xxxx', socioId, tipo:'coach'|'gimnasio', objetivoId:'u_xxxx'|'gym',
  estrellas:1..5, comentario, fecha:'YYYY-MM-DD',
  detalle: { atencion, conocimiento, puntualidad, motivacion, instalaciones, limpieza, equipo, ambiente },
  respuesta:{ texto, por, fecha }|null }
```

### Asistencia
```js
{ id:'at_xxxx', socioId, fecha:'YYYY-MM-DD', entrada:'HH:MM', salida:'HH:MM'|null }
```

### Clase
```js
{ id:'cl_xxxx', nombre:'Spinning', coachId, dia:'lunes', hora:'07:00', duracionMin:50,
  cupo:20, inscritos:[socioId], salon:'Salón 2', color:'#e4322b', activa:true }
```

### Aviso / Notificacion
```js
Aviso:        { id:'av_xxxx', titulo, cuerpo, para:'todos'|'socios'|'coaches', autorId, fecha, prioridad:'alta'|'normal', leidoPor:[ids] }
Notificacion: { id:'nt_xxxx', usuarioId, titulo, cuerpo, tipo:'pago'|'medicion'|'rutina'|'aviso'|'sistema', fecha, leida:Boolean, link:'#/...' }
```

### Ejercicio (`AG.Data.exercises`)
```js
{ id:'ej_sentadilla_barra', nombre:'Sentadilla con barra', grupo:'piernas',
  grupos:['piernas','gluteos'], equipo:'barra', nivel:'intermedio', tipo:'fuerza',
  instrucciones:String, consejos:String, musculos:String }
```
Grupos válidos: `pecho, espalda, hombros, biceps, triceps, piernas, gluteos, abdomen, cardio, cuerpo_completo, movilidad`.
Equipos válidos: `barra, mancuernas, maquina, polea, peso_corporal, kettlebell, banda, balon, cardio`.
Niveles: `principiante, intermedio, avanzado`. Tipos: `fuerza, hipertrofia, cardio, movilidad, funcional`.

### Alimento (`AG.Data.foods`)
```js
{ id:'al_pechuga_pollo', nombre:'Pechuga de pollo', categoria:'proteina',
  porcion:100, unidad:'g', kcal:165, proteina:31, carbos:0, grasa:3.6, fibra:0,
  medidaCasera:'1 pieza mediana ≈ 120 g', etiquetas:['magro'] }
```
Categorías: `proteina, carbohidrato, grasa, verdura, fruta, lacteo, bebida, suplemento, snack, preparado`.
**Valores nutricionales SIEMPRE por 100 g** (o por 100 ml en bebidas).

---

## 4. APIs de los módulos core

### `AG.Utils`
```
esc(str)                      -> escapa HTML
uid(prefijo)                  -> 'pg_k3f9a1'
hoy()                         -> 'YYYY-MM-DD'
ahora()                       -> ISO string
fecha(d, formato)             -> 'corto'|'largo'|'mesAnio'|'diaMes'|'hora'  ej. '05 sep 2026'
fechaRelativa(d)              -> 'hace 3 días'
mesActual()                   -> 'YYYY-MM'
mesDe(fecha)                  -> 'YYYY-MM'
nombreMes(mesKey)             -> 'Septiembre 2026'
sumaMeses(fecha, n)           -> 'YYYY-MM-DD'
sumaDias(fecha, n)            -> 'YYYY-MM-DD'
diasEntre(a, b)               -> Number
edad(fechaNacimiento)         -> Number
dinero(n)                     -> '$1,250.00'
num(n, dec)                   -> '12.5'
pct(n, dec)                   -> '12.5%'
signo(n, dec, unidad)         -> '+1.2 kg' / '−0.8 kg'
iniciales(nombre, apellidos)  -> 'JC'
colorDe(texto)                -> '#hex' determinista
nombreCompleto(usuario)       -> 'Julio César Ramírez'
avatar(usuario, tamano)       -> HTML del avatar ('sm'|''|'lg'|'xl')
badge(texto, tipo)            -> HTML
estrellas(n, opts)            -> HTML de 5 estrellas (opts: {editable, name, size})
toast(mensaje, tipo)          -> tipo: 'ok'|'error'|'info'|'warn'
modal(opciones)               -> {cerrar()}  opciones: {titulo, cuerpo, ancho:'md'|'lg'|'xl', acciones:[{texto,clase,onClick}], onOpen(root, api)}
confirmar(mensaje, titulo)    -> Promise<boolean>
formToObject(formEl)          -> {}
descargar(nombreArchivo, contenido, mime)
imprimir(htmlInterno, titulo)
agrupar(arr, fn)              -> {}
suma(arr, fn)                 -> Number
promedio(arr, fn)             -> Number
ordenar(arr, campo, dir)      -> arr nuevo
debounce(fn, ms)
$(sel, ctx) / $$(sel, ctx)    -> querySelector / [...querySelectorAll]
delegar(ctx, evento, sel, fn) -> delegación de eventos
copiar(texto)                 -> Promise
```

### `AG.Icons`
```
AG.Icons.get(nombre, tamano)  -> string '<svg ...>...</svg>'  (tamano por defecto 20)
AG.Icons.lista                -> [nombres]
```
Nombres requeridos: `inicio, socios, coach, pesa, mancuerna, corazon, dinero, tarjeta, grafica, reporte, regla, balanza, manzana, calculadora, calendario, reloj, estrella, chat, campana, config, salir, buscar, mas, editar, basura, ojo, check, x, alerta, flecha-arriba, flecha-abajo, flecha-der, flecha-izq, descargar, subir, imprimir, usuario, candado, correo, telefono, ubicacion, trofeo, fuego, gota, luna, sol, menu, filtro, agua, sueno, foto, qr, whatsapp, info, historial, meta, cinta, rayo, escudo, clase, nutricion`.
Si piden un icono inexistente, devolver un círculo neutro (nunca romper).

### `AG.Calc` — motor de cálculo
```
imc(pesoKg, estaturaCm)                              -> Number
clasificacionIMC(imc)                                -> {texto, clase}
tmb(peso, estatura, edad, sexo)                      -> Mifflin-St Jeor
factorActividad(nivel)                               -> Number
tdee(peso, estatura, edad, sexo, nivelActividad)     -> Number
caloriasObjetivo(tdee, objetivo, agresividad)        -> Number   objetivo: 'definir'|'volumen'|'mantener'
macros(kcal, objetivo, pesoKg)                       -> {kcal, proteina, carbos, grasa, pctP, pctC, pctG}
distribucionComidas(macros, numComidas)              -> [{nombre, hora, kcal, proteina, carbos, grasa}]
grasaCorporalNavy(sexo, cintura, cuello, cadera, estaturaCm) -> %
grasaCorporalPliegues(sexo, edad, pliegues)          -> %
masaMagra(peso, grasaPct)                            -> kg
pesoIdeal(estaturaCm, sexo)                          -> {min, max}
aguaDiaria(pesoKg, nivelActividad)                   -> litros
rm1(peso, reps)                                      -> Epley
tablaRM(rm1)                                         -> [{pct, peso, reps}]
zonasCardio(edad)                                    -> [{nombre, min, max, color}]
compararMediciones(inicial, final)                   -> ver abajo
progresoObjetivo(socio, mediciones)                  -> {pct, texto}
mesesDeMembresia(socio, pagos)                       -> Number
antiguedadTexto(fechaAlta)                           -> '1 año 3 meses'
estadoMembresia(socio)                               -> {estado, diasRestantes, clase, texto}
adherencia(bitacoras, desde, hasta, diasPorSemana)   -> {pct, hechas, esperadas}
rachaDias(asistencias)                               -> Number
volumenEntrenamiento(bitacora)                       -> kg totales
caloriasQuemadasAprox(bitacora, pesoKg)              -> kcal
promedioCalificacion(calificaciones)                 -> {promedio, total, distribucion:{5,4,3,2,1}}
```

`compararMediciones(inicial, final)` devuelve:
```js
{
  ok: Boolean, dias: Number,
  campos: [ { clave, etiqueta, unidad, ini, fin, delta, pct, tendencia:'mejor'|'peor'|'igual', bueno:Boolean } ],
  resumen: { pesoDelta, grasaDelta, musculoDelta, cinturaDelta, puntaje:0..100, veredicto:String, nivel:'excelente'|'bueno'|'regular'|'atencion' }
}
```
La dirección "buena" de cada campo depende del `objetivo` del socio (bajar grasa vs. subir músculo); recibe el objetivo como tercer parámetro opcional.

### `AG.Charts` (SVG puro, responsivo, sin librerías). Todas devuelven **string** con `<svg>`.
```
AG.Charts.linea(series, opts)       series: [{nombre, color, puntos:[{x,y}]}]  |  [{x,y}]
AG.Charts.barras(datos, opts)       datos: [{etiqueta, valor, color}]
AG.Charts.dona(datos, opts)         datos: [{etiqueta, valor, color}]
AG.Charts.progreso(pct, opts)       anillo circular
AG.Charts.sparkline(valores, opts)
AG.Charts.comparativo(pares, opts)  pares: [{etiqueta, ini, fin, unidad, bueno}]
AG.Charts.radar(ejes, opts)         ejes: [{etiqueta, valor, max}]
AG.Charts.calendario(dias, opts)    dias: [{fecha, valor}] mapa de calor mensual
```
Usan `var(--*)` del CSS para colores por defecto. `opts` acepta `{alto, ancho, color, etiquetaY, sufijo, sinEjes, id}`.

### `AG.DB`
```
AG.DB.state                       objeto vivo
AG.DB.cargar()                    lee localStorage (o crea estructura vacía)
AG.DB.guardar()                   persiste + actualiza meta.actualizado + emite 'cambio'
AG.DB.sembrarSiVacio()            llama AG.Seed.construir() si no hay usuarios
AG.DB.reiniciar()                 borra y vuelve a sembrar
AG.DB.exportar()                  descarga JSON de respaldo
AG.DB.importar(fileOrJson)        Promise<boolean>
AG.DB.get(coleccion)              -> array
AG.DB.buscar(coleccion, id)       -> objeto|null
AG.DB.insertar(coleccion, obj)    -> obj (asigna id si falta, guarda)
AG.DB.actualizar(coleccion, id, cambios) -> obj
AG.DB.eliminar(coleccion, id)     -> boolean
AG.DB.donde(coleccion, fn)        -> array filtrado
AG.DB.usuario(id)                 -> Usuario|null
AG.DB.socios() / AG.DB.coaches()  -> arrays
AG.DB.sociosDe(coachId)           -> array
AG.DB.plan(id)                    -> Plan|null
AG.DB.pagosDe(socioId)            -> array ordenado desc por fecha
AG.DB.medicionesDe(socioId)       -> array ordenado asc por fecha
AG.DB.medicionDelMes(socioId, periodo, tipo) -> Medicion|null
AG.DB.rutinaActivaDe(socioId)     -> {asignacion, rutina}|null
AG.DB.planNutricionDe(socioId)    -> PlanNutricion|null
AG.DB.bitacorasDe(socioId)        -> array
AG.DB.asistenciasDe(socioId)      -> array
AG.DB.calificacionesDe(objetivoId)-> array
AG.DB.notificar(usuarioId, {titulo, cuerpo, tipo, link})
AG.DB.recalcularEstadoSocios()    -> actualiza estado/fechaVencimiento según pagos
AG.DB.on(evento, fn) / AG.DB.emitir(evento, datos)   // evento 'cambio'
```

### `AG.Auth`
```
AG.Auth.entrar(email, password)   -> {ok:true, usuario} | {ok:false, error}
AG.Auth.salir()
AG.Auth.actual()                  -> Usuario|null
AG.Auth.es(rol)                   -> Boolean
AG.Auth.esAlguno([roles])         -> Boolean
AG.Auth.restaurarSesion()         -> Usuario|null
AG.Auth.cambiarPassword(actual, nueva) -> {ok, error}
AG.Auth.on('login'|'logout', fn)
```
Sesión en `localStorage` bajo `alliance_gym_sesion`.

### `AG.Router`
```
AG.Router.registrar({ path, roles:[], titulo, nav:{etiqueta, icono, grupo, orden}|null, render(ctx) })
AG.Router.ir(path)                // navega (acepta 'socio/inicio' o '#/socio/inicio')
AG.Router.iniciar()               // engancha hashchange y pinta
AG.Router.rutasDe(rol)            // rutas con nav, ordenadas
AG.Router.construirNav(rol)       // HTML del sidebar
AG.Router.refrescar()             // vuelve a pintar la vista actual
AG.Router.actual()                // {path, params}
AG.Router.inicioDe(rol)           // ruta por defecto del rol
```
`render(ctx)` recibe `{ usuario, params, path }` y devuelve **string HTML**, `HTMLElement`, o `{ html, listo(root) }` cuando necesita enganchar eventos tras pintar.
Hash: `#/socio/inicio`, con parámetros `#/director/socios?id=u_123`.

---

## 5. Contrato de CSS (clases que TODOS deben usar)

Variables en `:root` (tema oscuro por defecto; tema claro bajo `[data-tema="claro"]`):
`--rojo, --rojo-2, --rojo-oscuro, --negro, --carbon, --carbon-2, --panel, --panel-2, --borde, --borde-2, --texto, --texto-2, --texto-3, --ok, --warn, --error, --info, --acento, --sombra, --sombra-lg, --radio, --radio-sm, --radio-lg, --trans`

Componentes disponibles (los escribe `css/styles.css`, úsalos tal cual):
- Layout: `.page .page-head .page-title .page-sub .page-acciones .grid .g2 .g3 .g4 .g5 .span2 .span3`
- Tarjetas: `.card .card-head .card-title .card-sub .card-body .card-foot .card-accion .card-rojo`
- KPIs: `.kpi .kpi-icono .kpi-val .kpi-label .kpi-trend .kpi-trend.up .kpi-trend.down`
- Botones: `.btn .btn-primary .btn-ghost .btn-outline .btn-danger .btn-ok .btn-sm .btn-lg .btn-icono .btn-block`
- Formularios: `.field .label .input .select .textarea .help .form-row .form-grid .switch .check .radio-cards .radio-card`
- Tablas: `.table-wrap .table .table-compacta`, `th.sortable`
- Badges/chips: `.badge .badge-ok .badge-warn .badge-danger .badge-info .badge-muted .chip .chip.on .pill`
- Avatar: `.avatar .avatar-sm .avatar-lg .avatar-xl`
- Tabs: `.tabs .tab .tab.active`
- Progreso: `.bar .bar-fill .anillo`
- Listas: `.list .list-item .list-item-main .list-item-side`
- Estados: `.empty .empty-icono .empty-texto .loading .skeleton`
- Modal: `.modal-backdrop .modal .modal-head .modal-body .modal-foot .modal-lg .modal-xl`
- Toast: `.toast-wrap .toast .toast-ok .toast-error .toast-info .toast-warn`
- Estrellas: `.stars .star .star.on .stars-input`
- Timeline: `.timeline .timeline-item .timeline-punto`
- Utilidades: `.stack .stack-sm .row .row-sm .between .center .wrap .muted .mini .bold .mono .txt-ok .txt-error .txt-warn .txt-rojo .mt .mb .nowrap .flex1 .oculto .solo-movil .solo-escritorio .scroll-x`
- Shell: `.shell .sidebar .sidebar-logo .nav .nav-grupo .nav-item .nav-item.active .topbar .contenido .backdrop-nav`

**Móvil primero.** Todo debe verse bien en 380 px: sidebar colapsable con `.sidebar.abierto`, tablas con scroll horizontal.

---

## 6. Cómo registra una vista sus rutas

```js
window.AG = window.AG || {};
(function (AG) {
  'use strict';
  AG.Mod = AG.Mod || {};

  AG.Mod.Pagos = {
    render: function (ctx) {
      return { html: '<div class="page">...</div>', listo: function (root) { /* eventos */ } };
    }
  };

  AG.Router.registrar({
    path: 'director/pagos',
    roles: ['director'],
    titulo: 'Pagos y finanzas',
    nav: { etiqueta: 'Pagos', icono: 'dinero', grupo: 'Operación', orden: 3 },
    render: AG.Mod.Pagos.render
  });
})(window.AG);
```
Las rutas de detalle sin menú se registran con `nav: null`.

Grupos de menú permitidos (en este orden): `Principal`, `Mi entrenamiento`, `Mi cuenta`, `Operación`, `Entrenamiento`, `Negocio`, `Sistema`.

---

## 8. Mapa de rutas — quién registra qué (NO invadir rutas ajenas)

| Archivo | Rutas que registra |
|---|---|
| `js/views/login.js` | (ninguna: lo monta `AG.App`) |
| `js/views/director.js` | `director/inicio` |
| `js/views/coach.js` | `coach/inicio`, `coach/agenda` |
| `js/views/socio_inicio.js` | `socio/inicio` |
| `js/views/socio_progreso.js` | `socio/progreso` |
| `js/views/socio_rutina.js` | `socio/rutina` |
| `js/views/socio_nutricion.js` | `socio/nutricion`, `socio/calculadora` |
| `js/views/socio_pagos.js` | `socio/membresia` |
| `js/views/socio_calificar.js` | `socio/calificar` |
| `js/views/socio_perfil.js` | `socio/perfil` |
| `js/modules/socios.js` | `director/socios`, `coach/socios`, `director/socio` (nav:null), `coach/socio` (nav:null) |
| `js/modules/pagos.js` | `director/pagos` |
| `js/modules/mediciones.js` | `director/mediciones`, `coach/mediciones` |
| `js/modules/ejercicios.js` | `director/ejercicios`, `coach/ejercicios`, `socio/ejercicios` |
| `js/modules/rutinas.js` | `director/rutinas`, `coach/rutinas`, `coach/rutina` (nav:null), `director/rutina` (nav:null) |
| `js/modules/nutricion.js` | `director/nutricion`, `coach/nutricion` |
| `js/modules/coaches.js` | `director/coaches`, `director/coach` (nav:null) |
| `js/modules/calificaciones.js` | `director/calificaciones`, `coach/calificaciones` |
| `js/modules/asistencia.js` | `director/asistencia` |
| `js/modules/clases.js` | `director/clases`, `coach/clases`, `socio/clases` |
| `js/modules/avisos.js` | `director/avisos` |
| `js/modules/reportes.js` | `director/reportes` |
| `js/modules/config.js` | `director/config` |

### Orden del menú

**Director** — Principal: Inicio(1) · Operación: Socios(1), Pagos(2), Asistencia(3), Clases(4) · Entrenamiento: Coaches(1), Mediciones(2), Rutinas(3), Nutrición(4), Ejercicios(5) · Negocio: Reportes(1), Calificaciones(2), Avisos(3) · Sistema: Configuración(1)

**Coach** — Principal: Inicio(1), Agenda(2) · Entrenamiento: Mis socios(1), Mediciones(2), Rutinas(3), Nutrición(4), Ejercicios(5), Clases(6) · Negocio: Mis calificaciones(1)

**Socio** — Principal: Inicio(1) · Mi entrenamiento: Mi rutina(1), Mi progreso(2), Mi nutrición(3), Calculadora(4), Ejercicios(5), Clases(6) · Mi cuenta: Mi membresía(1), Calificar(2), Mi perfil(3)

### Funciones compartidas que cada módulo DEBE exponer (las usan otras pantallas)

```
AG.Mod.Socios.formulario(socioId|null)        // modal de alta/edición
AG.Mod.Socios.tarjeta(socio)                  // HTML de tarjeta de socio
AG.Mod.Pagos.registrar(socioId)               // modal de cobro
AG.Mod.Pagos.recibo(pagoId)                   // imprime/descarga recibo
AG.Mod.Mediciones.capturar(socioId, tipo, periodo)  // modal de medición
AG.Mod.Mediciones.comparativo(socioId, periodo)     // HTML del comparativo automático
AG.Mod.Mediciones.historial(socioId)                // HTML de evolución
AG.Mod.Ejercicios.detalle(ejercicioId)        // modal con técnica
AG.Mod.Ejercicios.selector(callback)          // modal para elegir ejercicio
AG.Mod.Rutinas.editor(rutinaId|null)          // constructor de rutina
AG.Mod.Rutinas.asignar(socioId)               // modal de asignación
AG.Mod.Rutinas.vistaDia(rutina, indice, opts) // HTML del día de entrenamiento
AG.Mod.Nutricion.editorPlan(socioId)          // constructor de plan alimenticio
AG.Mod.Nutricion.planHTML(plan, opts)         // HTML del plan
AG.Mod.Calificaciones.resumen(tipo, objetivoId) // HTML resumen de estrellas
AG.Mod.Asistencia.checkIn(socioId)            // registra entrada
AG.Mod.Avisos.paraUsuario(usuario)            // array de avisos vigentes
```

---

## 7. Cuentas demo (las crea `js/data/seed.js`)

| Rol | Email | Password |
|-----|-------|----------|
| Director | `director@alliancegym.mx` | `admin123` |
| Coach | `coach@alliancegym.mx` | `coach123` |
| Socio | `socio@alliancegym.mx` | `socio123` |

Además: 5 coaches y ~45 socios con historial realista de 8 meses (pagos, mediciones inicial/final por mes, bitácoras, calificaciones, asistencias, clases).
