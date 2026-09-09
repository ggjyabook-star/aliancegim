# Integración con GYM HDeLeon 3.0

**Objetivo:** que cuando se dé de alta un socio en HDeLeon (la PC del gimnasio),
aparezca solo en Alliance Gym (`aliancegim.vercel.app`). Sin capturar dos veces.

La sincronización es **de una sola vía**: HDeLeon manda, Alliance Gym recibe.

---

## Regla de oro

Del sistema HDeLeon **solo se lee. Nunca se escribe en su base de datos.**
Es un producto comercial con licencia y soporte del proveedor: escribirle puede
romperlo o dejarlos sin garantía. Todas las consultas son `SELECT`.

---

## Qué es cada sistema

| | GYM HDeLeon 3.0 | Alliance Gym |
|---|---|---|
| Qué es | App de escritorio Windows | Sitio web estático |
| Tecnología | C# .NET + MySQL | HTML/JS sin backend |
| Dónde vive | PC del gimnasio, red local | Vercel |
| Datos | MySQL local | `localStorage`, llave `alliance_gym_db_v1` |
| Su fuerte | Cobros, acceso físico, reconocimiento facial, RFID | Rutina, nutrición, progreso, sesiones con entrenador |

**Reparto de responsabilidades:** HDeLeon es el sistema de registro (socios,
membresías, pagos, acceso). Alliance Gym es la app del socio (entrenamiento).

---

## Las tres piezas

```
PC del gimnasio                    Vercel                 Navegador del socio
┌──────────────────┐        ┌────────────────┐        ┌──────────────────┐
│ HDeLeon (MySQL)  │──lee──▶│ función que    │◀─fetch─│  Alliance Gym    │
│ + agente cada    │  POST  │ recibe y guarda│  con   │  mezcla socios   │
│   15 min         │  token │  los socios    │ sesión │  en su base      │
└──────────────────┘        └────────────────┘        └──────────────────┘
```

1. **Agente** (PC del gimnasio): tarea programada que lee el MySQL de HDeLeon
   y manda los socios como JSON.
2. **Función serverless en Vercel**: recibe con un token y guarda. Vercel ya
   hospeda el sitio, así que no hay que contratar nada nuevo.
3. **Receptor en Alliance Gym**: al iniciar sesión trae los socios y los mezcla.

### Por qué la pieza 2 no es opcional

Hoy Alliance Gym guarda todo en el `localStorage` de cada navegador, así que
cada dispositivo tiene su propia copia. Si el agente escribiera directo en un
navegador, los socios solo se verían en esa computadora. La pieza intermedia es
lo que hace que aparezcan para todos.

---

## Paso 1 — Conocer el esquema de HDeLeon · BLOQUEA TODO LO DEMÁS

No se puede escribir el agente sin saber cómo se llaman las tablas y columnas.
HDeLeon no publica su esquema, así que hay que leerlo de la instalación.

En la **PC del gimnasio**, buscar el nombre de la base:

```bash
mysql -u root -p -e "SHOW DATABASES;"
```

Y exportar **solo la estructura, sin datos**:

```bash
mysqldump --no-data -u root -p NOMBRE_DE_LA_BASE > C:\esquema_gym.sql
```

`--no-data` significa que solo salen nombres de tablas y columnas:
**ningún dato personal de los socios sale de esa PC.**

Si `mysql` no se reconoce, suele estar en `C:\xampp\mysql\bin\` o en
`C:\Program Files\MySQL\MySQL Server 8.0\bin\`.

### Si no se tiene la contraseña de root de MySQL

No hay que pedírsela al proveedor. En orden:

1. **Buscarla en la config del propio HDeLeon.** El sistema necesita la cadena
   de conexión para arrancar, así que está guardada en su carpeta de
   instalación: revisar `App.config`, `*.exe.config`, `appsettings.json`,
   `*.ini` o `web.config`. La contraseña suele venir en texto plano dentro de
   un `connectionString` (`Server=...;Database=...;Uid=root;Pwd=...`).
   Buscar también en `C:\xampp\`, `C:\Program Files\`, `C:\Program Files (x86)\`
   y la carpeta donde esté instalado el sistema.
2. **XAMPP con root sin contraseña.** Si usa XAMPP, probar root con contraseña
   vacía: `mysql -u root` (sin `-p`). Es el default de XAMPP.
3. **Plan B — sin MySQL (ver abajo).** Si nada funciona, usar la exportación de
   reportes de HDeLeon. No requiere la contraseña ni tocar la base.

### Plan B — importación por archivo (si no se puede leer MySQL)

HDeLeon exporta reportes a Excel/CSV. En vez del agente automático:

- Recepción exporta la lista de socios (diario o semanal).
- Alliance Gym tiene una pantalla **"Importar socios"** (solo director) que lee
  ese CSV y aplica la misma lógica de mezcla que el sync automático.

No es en tiempo real (alguien sube el archivo), pero no necesita contraseña de
MySQL, no toca el sistema de HDeLeon y para un gimnasio suele ser suficiente.
El contrato de datos y las reglas de mezcla son los mismos; solo cambia de
dónde llegan los datos (CSV subido a mano en vez de POST del agente).

### Qué hay que identificar en ese esquema

- Tabla de **socios / clientes / miembros**: nombre, apellidos, teléfono,
  correo, número de socio o matrícula, fecha de nacimiento, sexo, fecha de alta
- Tabla de **membresías**: tipo de plan y fecha de vencimiento
- Tabla de **pagos** (para saber si está al corriente)
- Cómo se marca que un socio está **activo, vencido, congelado o de baja**

---

## Paso 2 — El contrato de datos

Lo que Alliance Gym necesita de cada socio. Esta es la forma normalizada que
el agente debe mandar, sin importar cómo se llamen las columnas en HDeLeon:

```json
{
  "externoId": "id del socio en HDeLeon",
  "codigo": "número de socio o matrícula",
  "nombre": "Ana Sofía",
  "apellidos": "Delgado",
  "email": "ana@correo.com",
  "telefono": "33 1234 5678",
  "fechaNacimiento": "1995-03-12",
  "sexo": "F",
  "fechaAlta": "2026-01-15",
  "fechaVencimiento": "2026-10-20",
  "estado": "activo",
  "planExterno": "nombre del plan tal cual viene en HDeLeon"
}
```

`estado` se normaliza a uno de estos cuatro: `activo`, `vencido`, `congelado`,
`baja`. Es lo que ya entiende `AG.Calc.estadoMembresia()`.

### Campos que HDeLeon manda y Alliance Gym actualiza

`nombre`, `apellidos`, `email`, `telefono`, `codigo`, `fechaNacimiento`,
`sexo`, `fechaAlta`, `fechaVencimiento`, `estado`, `activo`, `planId`.

### Campos que son SOLO de Alliance Gym y el sync NUNCA debe tocar

`coachId`, `objetivo`, `nivel`, `nivelActividad`, `estaturaCm`,
`horarioEntreno`, `diasMeta`, `desayunaAntes`, `bienvenidaHecha`, `password`.

Y por supuesto nada de las otras colecciones: `rutinas`, `asignaciones`,
`bitacoras`, `mediciones`, `sesiones`, `planesNutricion`, `calificaciones`.
Esos datos nacen en Alliance Gym y se perderían si el sync los pisa.

**El emparejamiento se hace por `externoId`**, no por correo ni por nombre
(en HDeLeon el correo puede venir vacío o repetido).

---

## Cómo entra el socio nuevo · DECIDIDO

El socio sincronizado no trae contraseña (HDeLeon no guarda credenciales web),
así que la página le arma el acceso sola:

- **Usuario:** su número de socio (`codigo`). Si HDeLeon trae correo, también
  se acepta el correo.
- **Primera entrada:** con su fecha de nacimiento como contraseña temporal.
- **En cuanto entra**, la página le pide crear su contraseña y enseguida corre
  la bienvenida de 3 preguntas que ya existe (el campo `bienvenidaHecha` ya
  está en el modelo de usuario, se reutiliza tal cual).

Así recepción solo dice una vez: *"entra con tu número de socio y tu fecha de
nacimiento"*. Sin repartir contraseñas ni mandar correos.

Marcar estos socios con `passwordTemporal: true` para forzar el cambio en la
primera entrada.

### Seguridad de las contraseñas

Hoy las contraseñas viven en texto plano en el `localStorage` (venía del demo
con datos inventados). **En cuanto entren socios reales, la validación tiene
que pasar al servidor**, junto con la función de Vercel de la pieza 2. No se
puede dejar así con gente real.

## Decisiones pendientes

1. **Mapeo de planes.** Los planes de HDeLeon hay que casarlos con la colección
   `planes` de Alliance Gym. Se resuelve con una tabla de equivalencias una vez
   que se vean los nombres reales.

2. **¿Qué pasa con los socios que hoy existen solo en Alliance Gym?**
   Se quedan como están (sin `externoId`); el sync no los borra.

## Cada cuánto sincroniza

Cada 5 minutos (configurable). La PC del gimnasio **solo sale** a internet a
dejar los datos: no recibe conexiones, no hay que abrir puertos ni exponer la
red del gimnasio. Si se cae el internet o apagan la PC, el agente reintenta y
se pone al corriente solo cuando vuelve.

---

## Estado

- [ ] Paso 1 — esquema de HDeLeon
- [ ] Mapeo de columnas HDeLeon → contrato
- [ ] Agente en la PC del gimnasio
- [ ] Función serverless en Vercel
- [ ] Receptor y mezcla en Alliance Gym
- [ ] Primera entrada: número de socio + fecha de nacimiento → crear contraseña
- [ ] Mover la validación de contraseñas al servidor
- [ ] Pantalla de "socios sincronizados" para el director

---

## Notas para quien retome esto en la PC del gimnasio

- El repo es `ggjyabook-star/aliancegim`. Este documento es el plan completo.
- Solo `SELECT` sobre la base de HDeLeon. Nunca `INSERT`, `UPDATE` ni `DELETE`.
- Antes de escribir el agente, llenar aquí abajo el mapeo real de columnas.
- El agente conviene hacerlo en PowerShell: esa PC ya tiene todo lo necesario y
  así no hay que instalar Node ni compilar nada.

### Mapeo real de columnas (llenar tras el Paso 1)

| Contrato | Tabla de HDeLeon | Columna |
|---|---|---|
| `externoId` | | |
| `codigo` | | |
| `nombre` | | |
| `apellidos` | | |
| `email` | | |
| `telefono` | | |
| `fechaNacimiento` | | |
| `sexo` | | |
| `fechaAlta` | | |
| `fechaVencimiento` | | |
| `estado` | | |
| `planExterno` | | |
