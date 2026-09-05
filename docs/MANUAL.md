# 📘 Manual de operación — ALLIANCE GYM

Guía práctica para poner a trabajar el sistema en el gimnasio. Escrita para que la use cualquiera,
sin conocimientos técnicos.

---

## 1. Primer día: dejar el sistema listo

El sistema llega con un gimnasio de demostración (45 socios, 5 coaches y 8 meses de historia) para que
puedas ver cómo se ve todo funcionando. Cuando ya lo hayas explorado, vacíalo y captura tu información real:

1. Entra como **Dirección** (`director@alliancegym.mx` / `admin123`).
2. Ve a **Configuración → Gimnasio** y pon tus datos: nombre, lema, dirección, teléfono, horario y moneda.
3. Ve a **Configuración → Planes** y captura tus precios reales (mensual, trimestral, anual, visita…).
4. Ve a **Configuración → Metas** (misma pestaña de Gimnasio) y define:
   - Meta de socios nuevos por mes
   - Meta de ingreso mensual
   - Costo fijo mensual (renta, luz, agua, internet)
   - Días de gracia para pagos vencidos
5. Ve a **Configuración → Datos → Reiniciar** solo cuando quieras borrar la demostración
   *(te va a pedir escribir la palabra REINICIAR: es a propósito, para que nadie lo haga por accidente)*.
6. Da de alta a tus **coaches** en *Coaches → Nuevo coach*.
7. Da de alta a tus **socios** en *Socios → Nuevo socio*. Al terminar cada alta, el sistema te ofrece
   registrar el primer pago: acéptalo y la vigencia se calcula sola.

> **Cambia las contraseñas** de las cuentas de demostración desde *Configuración → Usuarios* antes de operar.

---

## 2. El día a día en recepción

### Registrar la entrada de un socio
**Asistencia → Recepción**. Escribe el nombre o el código (AG-0001) y pulsa **Registrar entrada**.

- Verde: membresía vigente → pasa.
- Ámbar: le quedan pocos días → aprovecha para recordarle.
- Rojo: vencida → el sistema te dice cuántos días lleva y te ofrece **cobrar en ese momento**.

### Cobrar una mensualidad
**Pagos → Registrar pago** (o el botón *Cobrar* desde la ficha del socio).
Eliges el plan y el sistema calcula solo el monto, el periodo cubierto y la nueva fecha de vencimiento.
Al guardar puedes imprimir el recibo con folio.

### Cobranza
**Pagos → Cobranza**: dos listas, *Vencidos* y *Por vencer esta semana*, con botón de recordatorio por
WhatsApp con el mensaje ya redactado.

---

## 3. El ciclo mensual de mediciones (el corazón del sistema)

Esto es lo que hace que el socio vea resultados y se quede.

### Primeros días del mes — medición inicial
Cada coach entra a **Mediciones**, ve la columna *"Pendiente de medición inicial"* con sus socios y captura:
peso, grasa, músculo, las 10 medidas corporales, presión y fuerza.

- Si no tienes báscula de bioimpedancia, captura cintura, cuello y cadera y pulsa
  **"Estimar grasa % (US Navy)"**: el sistema la calcula.
- Al guardar, al socio le llega la medición a su panel automáticamente.

### Últimos días del mes — cierre
El coach entra a la columna *"En curso"* y pulsa **Cerrar mes**. Captura la segunda medición y, al guardar,
el sistema **compara sola** las dos mediciones y genera:

- El cambio de cada dato (peso, grasa, músculo, cintura, brazo…) con su flecha y color.
- Un **puntaje de 0 a 100** del mes.
- Un **veredicto en español** explicando qué pasó y por qué.
- Las gráficas de comparación.

El socio lo ve al instante en **Mi progreso**, junto con su adherencia real del mes, para que entienda
la relación entre lo que hizo y lo que consiguió.

> **Regla de oro:** midan siempre en las mismas condiciones — mismo día del mes, misma hora,
> en ayunas, sin haber entrenado. Si no, los números mienten.

---

## 4. Rutinas

1. **Rutinas → Nueva rutina**: le pones nombre, objetivo, nivel y días por semana.
2. En cada día defines el enfoque (*Pecho y tríceps*), el calentamiento y agregas ejercicios
   de la biblioteca (más de 150) con sus series, repeticiones, descanso y tempo.
3. **Asignar** la rutina al socio desde su ficha o desde *Rutinas → Asignaciones*.

El socio la ve en **Mi rutina**, con el día que le toca, y va marcando cada serie con el peso que levantó.
El sistema le lleva el temporizador de descanso, su volumen total y sus récords.

Puedes duplicar cualquier rutina existente para no empezar de cero.

---

## 5. Nutrición

**Nutrición → Crear plan** para un socio. El asistente:

1. Calcula su gasto calórico real (TMB y TDEE) con sus datos.
2. Le aplica el déficit o superávit según el objetivo y la agresividad que elijas.
3. Reparte proteína, carbohidratos y grasa, y te arma las comidas.
   Puedes usar **"Generar automáticamente"** y después ajustar los gramos a mano.

El socio lo ve en **Mi nutrición**, con gramos, medidas caseras y lista de compras.

Si un socio no tiene plan, en **Calculadora** puede hacerlo él mismo: elige si quiere
*bajar grasa, mantener o ganar músculo* y obtiene sus calorías, macros, agua y un menú de ejemplo.

---

## 6. Calificaciones

El socio califica a su coach (atención, conocimiento, puntualidad, motivación) y al gimnasio
(instalaciones, limpieza, equipo, ambiente).

Dirección lo ve en **Calificaciones**, con el promedio, la tendencia y el ranking de coaches.
Las reseñas de 1 y 2 estrellas se marcan como *"Requieren atención"*: contéstalas desde ahí.
El socio ve tu respuesta en su panel, y eso vale oro para la retención.

---

## 7. Reportes para el dueño

**Reportes** tiene cuatro pestañas:

| Pestaña | Qué te dice |
|---|---|
| **Finanzas** | Ingresos, MRR, ticket promedio, nómina, costo fijo, utilidad y margen |
| **Socios** | Altas, bajas, retención, churn, antigüedad, LTV y socios en riesgo |
| **Entrenamiento** | Mediciones capturadas, progreso promedio, adherencia y ocupación por hora |
| **Satisfacción** | Calificación global, tendencia, NPS y ranking de coaches |

Botón **Imprimir reporte ejecutivo**: te genera el resumen del periodo con conclusiones.

---

## 8. Respaldos (importante)

Los datos viven en el navegador de esta computadora. Si se formatea el equipo o se borran los datos
de navegación, se pierde la información.

**Cada viernes:** *Configuración → Datos → Exportar respaldo*. Guarda el archivo `.json` en una
memoria USB o en la nube. Para restaurarlo: *Importar respaldo*.

Para usarlo en otra computadora: copia la carpeta completa, ábrelo ahí e importa tu último respaldo.

---

## 9. Rutina de trabajo sugerida

| Cuándo | Quién | Qué |
|---|---|---|
| Cada entrada | Recepción | Registrar asistencia y detectar vencidos |
| Diario | Dirección | Revisar *"Requiere tu atención"* en el tablero |
| Días 1-5 del mes | Coaches | Mediciones iniciales de todos sus socios |
| Días 26-31 del mes | Coaches | Cierres de mes y entrega de resultados |
| Semanal | Coaches | Revisar adherencia y contactar a quien dejó de venir |
| Semanal | Dirección | Cobranza de vencidos y respuesta a reseñas |
| Mensual | Dirección | Reporte ejecutivo y ajuste de metas |
| Viernes | Dirección | Respaldo |
