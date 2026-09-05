# 🛡️ ALLIANCE GYM — Sistema de Gestión Integral

Ecosistema completo para administrar el gimnasio: **socios, coaches y dirección** en un solo panel.
Sin instalaciones, sin internet, sin mensualidades de software. Todo corre en tu computadora.

---

## ▶️ Cómo abrirlo

**Opción 1 — la más fácil**
Doble clic en **`ABRIR-SISTEMA.bat`**. Se abre solo en tu navegador.

**Opción 2 — doble clic directo**
Abre **`index.html`** con Chrome o Edge.

**Opción 3 — desde la terminal**

```bash
node server.js
```

Luego entra a `http://localhost:5173`.

---

## 🔑 Cuentas de acceso

| Perfil | Correo | Contraseña |
|---|---|---|
| **Dirección** | `director@alliancegym.mx` | `admin123` |
| **Coach** | `coach@alliancegym.mx` | `coach123` |
| **Socio** | `socio@alliancegym.mx` | `socio123` |

En la pantalla de entrada hay tres botones que entran directo con cada perfil.

---

## 👤 Lo que ve cada quien

### Socio
- **Inicio** — su membresía, el entrenamiento de hoy, su nutrición, su progreso del mes y su racha.
- **Mi rutina** — el día que le toca, con registro de series, peso, repeticiones y temporizador de descanso.
- **Mi progreso** — la medición de inicio de mes, la de cierre y **el comparativo calculado automáticamente**
  con puntaje, veredicto y gráficas.
- **Mi nutrición** — el plan que le armó su coach, con comidas, gramos y macros.
- **Calculadora** — decide si quiere **bajar grasa, mantener o ganar músculo** y el sistema calcula sus calorías,
  macros, agua y le genera un menú de ejemplo con alimentos reales.
- **Ejercicios** — biblioteca con técnica, consejos y músculos trabajados.
- **Clases** — horario semanal e inscripción.
- **Mi membresía** — credencial digital, meses acumulados, historial de pagos y recibos.
- **Calificar** — califica a su coach y al gimnasio.
- **Mi perfil** — sus datos, objetivo, salud y contraseña.

### Coach
- **Inicio** — sus pendientes del día: a quién le falta medición inicial, a quién hay que cerrarle el mes,
  quién no tiene rutina o plan de alimentación, quién dejó de asistir.
- **Agenda** — sus clases, mediciones por hacer y cumpleaños de sus socios.
- **Mis socios** — expediente completo de cada uno.
- **Mediciones** — tablero del mes: *pendiente de inicio · en curso · mes cerrado*.
- **Rutinas** — constructor de rutinas y asignación.
- **Nutrición** — armado de planes con cálculo automático de calorías y macros.
- **Mis calificaciones** — lo que opinan sus socios.

### Dirección (dueño)
Ve **todo** lo anterior más:
- **Tablero general** con lo que requiere atención hoy.
- **Pagos y cobranza** — cobros, recibos, vencidos y recordatorios.
- **Coaches** — desempeño, calificación, retención y carga de trabajo.
- **Reportes** — finanzas, retención, churn, utilidad, progreso del gimnasio y satisfacción.
- **Asistencia** — control de acceso en recepción, horas pico y socios en riesgo.
- **Clases, avisos y configuración** — planes, precios, usuarios y respaldos.

---

## 🧮 Lo que el sistema calcula solo

- **Comparativo mensual**: al capturar la medición de cierre, compara contra la de inicio y saca los cambios de
  peso, grasa, músculo y todas las medidas, con un **puntaje de 0 a 100** y un veredicto en español.
- **Calorías y macros**: TMB (Mifflin-St Jeor), TDEE por nivel de actividad, déficit o superávit según el objetivo,
  reparto de proteína, carbohidratos y grasa, y distribución por comida.
- **Grasa corporal**: fórmula US Navy con medidas, o por pliegues cutáneos.
- **Membresía**: vigencia, días restantes, meses pagados y estado (activo, por vencer, vencido).
- **Fuerza**: 1RM estimado y tabla de porcentajes de carga.
- **Negocio**: ingresos, MRR, ticket promedio, retención, churn, utilidad y proyecciones.

---

## 💾 Dónde viven los datos

En el **navegador de esta computadora** (almacenamiento local). No se envía nada a internet.

- Para respaldar: **Configuración → Datos → Exportar respaldo** (genera un archivo `.json`).
- Para pasarlo a otra computadora: copia la carpeta y usa **Importar respaldo**.
- Haz respaldo una vez por semana.

> Si borras los datos de navegación del navegador, se borra la información del sistema. Respalda.

---

## 📁 Estructura del proyecto

```
index.html            Punto de entrada
css/styles.css        Diseño completo (tema oscuro y claro)
js/core/              Utilidades, iconos, cálculos, gráficas, base de datos, sesión y navegación
js/data/              Catálogo de ejercicios, catálogo de alimentos y datos de demostración
js/modules/           Módulos de gestión (socios, pagos, mediciones, rutinas, nutrición, reportes…)
js/views/             Paneles de cada rol
docs/ARQUITECTURA.md  Documentación técnica
server.js             Servidor local opcional
```

Todo es HTML, CSS y JavaScript sin librerías externas: no necesita internet ni instalación.
