# Specification: Gastos e Ingresos Recurrentes

## Overview

Un **recurrente** es una plantilla: "cada mes, el día 5, sale 1.500.000 de la cuenta Bancolombia hacia la categoría Arriendo". No es dinero. El dinero sigue siendo una `Transaction`, exactamente como un pago de deuda lo es (ratificado 2026-07-13) — así el saldo de la cuenta se mueve solo, el gasto aparece en el historial y cuenta contra el presupuesto, sin escribir nada nuevo.

El dueño lo pidió como "gastos fijos". Cubre también **ingresos** (el sueldo es lo más recurrente que tiene), porque es la misma entidad con un campo `type` y hace que el panel proyecte el mes de verdad.

**Estado del terreno**: `Transaction.recurringTransactionId` y `createTransaction(userId, {recurringTransactionId})` ya existen desde Fase 1, reservados a propósito para este módulo. Nada de eso hay que inventarlo.

---

## Las tres decisiones que definen el módulo

### 1. Cada recurrente declara si se cobra solo o si lo pagas tú (`autoGenerate`)

- `autoGenerate: true` — "se cobra solo" (Netflix domiciliado, la cuota que el banco descuenta). Al vencer, la app **registra la transacción sin preguntar**, porque el dinero se movió de verdad, lo mire el usuario o no. Aquí lo automático *es* la verdad.
- `autoGenerate: false` — "lo pago yo" (el arriendo que transfieres a mano). Al vencer, la app **no crea nada**: lo muestra como pendiente y el usuario confirma con un toque, pudiendo ajustar el monto antes de confirmar.

**Por qué no todo automático**: si un cron crea el arriendo el día 5 y ese mes no lo pagaste, o lo pagaste tarde, o subió, la app te ha inventado un movimiento y tu saldo deja de ser tu saldo. **Por qué no todo con confirmación**: obligaría a confirmar a mano cargos que realmente ocurrieron solos, y hasta que los confirmes tu saldo estaría *igual de mal*, solo que por el otro lado.

### 2. Nunca se rellena el pasado (no hay backfill)

Al crear un recurrente, su primer vencimiento es **el primero que cae de hoy en adelante**. `startDate` sirve para anclar el día (el 5 de cada mes), no para generar historial.

**Por qué**: la app no puede saber si los cargos anteriores ya están registrados a mano — y casi siempre lo están. Rellenar el pasado duplicaría meses de gastos y destrozaría el saldo. Además convierte un error de tecleo (`2021` en vez de `2026`) en sesenta transacciones falsas.

### 3. Un recurrente automático que deja la cuenta en rojo **se registra igual**

`createTransaction()` rechaza los sobregiros salvo `confirmOverdraft: true`. La generación automática **pasa siempre `confirmOverdraft: true`**.

**Por qué**: el cargo ya ocurrió en el banco. Negarse a anotarlo no impide el sobregiro — solo hace que la app te muestre un saldo *más* falso que el real. El propósito de esa validación es frenar al usuario antes de gastar; a un hecho consumado no hay nada que frenarle.

---

## User Stories (Priority Order)

### P1 - Critical

**US1 — Registrar un gasto fijo**
Como usuario, quiero declarar que el arriendo son 1.500.000 el día 5 de cada mes desde mi cuenta Bancolombia, para no tener que acordarme de anotarlo.

**US2 — Que lo automático se registre solo**
Como usuario, quiero que Netflix (que el banco me cobra solo) aparezca en mi historial sin que yo haga nada, para que mi saldo sea real cuando abro la app.

**US3 — Confirmar lo que pago yo**
Como usuario, quiero ver "Arriendo — vence hoy — 1.500.000" y confirmarlo de un toque, **pudiendo corregir el monto** (los servicios cambian cada mes), para que quede registrado lo que de verdad pagué.

**US4 — Saltarme un vencimiento**
Como usuario, quiero poder decir "este mes no lo pagué" y que el recurrente siga vivo para el mes siguiente, sin que se me quede atascado el pendiente para siempre.

### P2 - Important

**US5 — Ver qué viene**
Como usuario, quiero ver en el panel los próximos vencimientos del mes, para saber cuánto de mi saldo ya está comprometido.

**US6 — Ingresos recurrentes**
Como usuario, quiero declarar mi sueldo como ingreso recurrente.

**US7 — Pausar y archivar**
Como usuario, quiero pausar un recurrente (me di de baja de una suscripción tres meses) y archivarlo sin borrar el historial que ya generó.

### P3 - Nice to Have

**US8 — Fecha de fin**
Como usuario, quiero decir que un recurrente termina en tal fecha (una cuota a 12 meses), para que deje de vencer solo.

---

## Acceptance Scenarios

### Scenario 1: Crear un recurrente automático (Happy Path)
**Dado** que hoy es el 14 de julio de 2026,
**Cuando** creo "Netflix, 44.900, mensual, día 20, cuenta Nu, categoría Suscripciones, se cobra solo",
**Entonces** el próximo vencimiento es el **20 de julio de 2026**, no se crea ninguna transacción todavía, y **no aparece ninguna transacción de meses anteriores** (sin backfill).

### Scenario 2: El vencimiento automático se materializa
**Dado** el recurrente anterior y que hoy es el 21 de julio,
**Cuando** abro la app,
**Entonces** existe una transacción de gasto de 44.900 con fecha 20 de julio ligada a ese recurrente, el saldo de Nu bajó 44.900, y el próximo vencimiento pasa a ser el **20 de agosto**.

### Scenario 3: Abrir la app dos veces no duplica nada
**Dado** el escenario anterior,
**Cuando** recargo la app, o la tengo abierta en dos pestañas a la vez,
**Entonces** sigue existiendo **exactamente una** transacción del 20 de julio para ese recurrente.

### Scenario 4: Ponerse al día tras dos meses sin abrir la app
**Dado** un recurrente automático mensual día 5, y que la última vez que abrí la app fue en mayo,
**Cuando** la abro el 14 de julio,
**Entonces** se crean las transacciones de **junio y julio** (una por vencimiento), y el próximo vencimiento es el 5 de agosto.

### Scenario 5: Confirmar un manual, corrigiendo el monto
**Dado** un recurrente manual "Energía, 180.000, día 10" que ya venció,
**Cuando** lo confirmo cambiando el monto a **214.300**,
**Entonces** se crea una transacción de 214.300 (no de 180.000), el saldo baja 214.300, el próximo vencimiento avanza, y **el monto guardado en la plantilla sigue siendo 180.000** (una factura alta un mes no redefine el gasto fijo).

### Scenario 6: Saltarse un vencimiento
**Dado** un recurrente manual vencido,
**Cuando** lo salto,
**Entonces** **no se crea ninguna transacción**, el saldo no cambia, y el próximo vencimiento avanza al periodo siguiente.

### Scenario 7: Un automático que deja la cuenta en rojo
**Dado** un recurrente automático de 300.000 sobre una cuenta con 100.000,
**Cuando** vence,
**Entonces** la transacción **se crea igual** (saldo −200.000), sin diálogo de confirmación — el cargo ya ocurrió.

### Scenario 8: El día 31 en un mes que no lo tiene
**Dado** un recurrente mensual anclado al **día 31**,
**Cuando** vence en febrero,
**Entonces** vence el **28** (o 29 en bisiesto) — el último día del mes — y en marzo vuelve al 31. Nunca se desplaza al 1 de marzo ni se salta el mes.

### Scenario 9: Aislamiento entre usuarios
**Dado** un recurrente de otro usuario,
**Cuando** intento verlo, editarlo o confirmarlo,
**Entonces** recibo **404** (nunca 403 — no se filtra ni la existencia), y su generación automática jamás toca mis cuentas.

---

## Functional Requirements

- **FR-001** — Un `RecurringTransaction` pertenece a un `userId` y referencia una `Account` y una `Category` del mismo usuario. Toda ruta valida ambas pertenencias.
- **FR-002** — Campos: `name`, `type` (`income`/`expense`), `amount` (unidades menores), `accountId`, `categoryId`, `frequency` (`weekly`/`biweekly`/`monthly`/`yearly`), `anchorDay` (derivado de `startDate`), `startDate`, `nextDueDate`, `autoGenerate`, `endDate?`, `isPaused`, `isArchived`.
- **FR-003** — `nextDueDate` se calcula al crear como **el primer vencimiento ≥ hoy**. Nunca se generan vencimientos anteriores a la creación.
- **FR-004** — Un recurrente `autoGenerate: true` materializa sus vencimientos vencidos (`nextDueDate <= hoy`) automáticamente, poniéndose al día si hay varios pendientes.
- **FR-005** — Un recurrente `autoGenerate: false` **nunca** crea transacciones por su cuenta: expone sus vencimientos vencidos como *pendientes*, que el usuario **confirma** (opcionalmente con otro monto) o **salta**.
- **FR-006** — **Idempotencia**: un mismo vencimiento no puede generar dos transacciones, ni con dos pestañas abiertas ni con dos peticiones concurrentes. Garantizado por índice único en base de datos, no por confianza en el código.
- **FR-007** — Confirmar con un monto distinto **no modifica** el `amount` de la plantilla.
- **FR-008** — Un recurrente pausado (`isPaused`) no vence ni acumula pendientes; al reanudarlo, su próximo vencimiento se recalcula hacia adelante (no rellena lo pausado).
- **FR-009** — Con `endDate`, no se generan vencimientos posteriores a esa fecha; al pasarla, el recurrente se considera terminado.
- **FR-010** — DELETE **archiva** (`isArchived`), nunca borra: las transacciones que ya generó son historial real y no pueden quedar colgando.
- **FR-011** — Todas las fechas se calculan en **UTC**, igual que `src/lib/period.ts` y `debt-math.ts`. Un vencimiento no puede depender de la zona horaria del servidor.
- **FR-012** — La generación automática invoca `createTransaction()` de modo que un sobregiro se **registra igual** (ver decisión 3). ~~`confirmOverdraft: true`~~ **[Corregido 2026-07-15]**: `confirmOverdraft` fue derogado el 2026-07-14 (Saldos Honestos). El mecanismo es ahora una bandera de servicio **`allowOverdraft`** que **solo** activa el generador automático y que **ninguna ruta HTTP expone**. La cuenta queda en descubierto (saldo negativo derivado), sin diálogo. Un recurrente **manual** que sobregira NO usa esta bandera: pasa por la creación normal y recibe el diálogo de las cuatro salidas. Ratificado en el Decision Log de la constitución (2026-07-15).

---

## Technical Context

### Database (MongoDB + Mongoose)

Nueva colección `recurringtransactions`. `Transaction` gana **un campo nuevo** (`recurringOccurrenceKey`) — `recurringTransactionId` ya existe.

**`recurringOccurrenceKey`** (p. ej. `"2026-07-20"`) es lo que hace posible la idempotencia (FR-006): identifica *qué vencimiento* materializó esta transacción. **No se puede usar `Transaction.date` para eso**, porque el usuario puede editar la fecha de una transacción después — y entonces la clave cambiaría y una segunda pasada la duplicaría. El campo es `immutable`.

Índice único parcial: `{ userId, recurringTransactionId, recurringOccurrenceKey }`, solo sobre los documentos que tienen `recurringTransactionId`.

### El motor de fechas (`src/lib/recurrence.ts` — funciones puras, sin Mongoose)

Igual que `debt-math.ts`: puro, testeable, y **sin importar Mongoose** (lo consume un componente cliente, y meter Mongoose en el bundle del navegador ya rompió el build una vez).

- `nextOccurrence(from, frequency, anchorDay)` — con **clamp a fin de mes** (Scenario 8).
- `firstDueDate(startDate, frequency, anchorDay, today)` — el primer vencimiento ≥ hoy (FR-003).
- `dueOccurrences(recurring, today)` — la lista de vencimientos pendientes, con tope de seguridad.
- `occurrenceKey(date)` — `YYYY-MM-DD` en UTC.

### El generador (`src/lib/services/recurring.ts`)

**El orden importa, y es lo contrario de lo intuitivo**: se crea la transacción **primero** y se avanza `nextDueDate` **después**.

Si se avanzara primero y la creación fallara, el vencimiento quedaría perdido para siempre. Al revés, si la creación tiene éxito y el avance falla, la siguiente pasada reintenta la creación, el **índice único la rechaza** (duplicate key), se captura ese error concreto y se avanza. El resultado converge solo, sin transacciones distribuidas y sin poder duplicar dinero.

Reutiliza `createTransaction()` sin reimplementar nada — hereda gratis la transacción de Mongo y el `$inc` de `Account.currentBalance`.

### API Endpoints

- `GET/POST /api/recurring`
- `GET/PATCH/DELETE /api/recurring/[id]` (DELETE archiva)
- `POST /api/recurring/[id]/confirm` — materializa un vencimiento pendiente (body: `occurrenceKey`, `amount?`)
- `POST /api/recurring/[id]/skip` — avanza sin crear nada (body: `occurrenceKey`)
- `POST /api/recurring/catch-up` — materializa los vencidos de los `autoGenerate`. Idempotente por diseño.

### Frontend

`/dashboard/recurring` (lista + formulario, patrón de Cuentas/Deudas), un widget de "Próximos vencimientos" en el panel, y una tarjeta de pendientes por confirmar. El `catch-up` se dispara al cargar el panel.

---

## Success Criteria

- Los 9 escenarios pasan como tests automatizados. El 3 (no duplicar) y el 8 (día 31) llevan test dedicado: son los que rompen en producción y no en una demo.
- Cobertura ≥ 80%. `recurrence.ts` al 100%: un error ahí no revienta, devuelve una fecha falsa.
- Verificado end-to-end contra producción con datos reales del dueño.

## Out of Scope

- **Backfill de historial** — rechazado, no pospuesto (decisión 2).
- **Notificaciones push** de vencimiento. La PWA ya está instalada, pero el permiso de notificaciones es una conversación aparte.
- **Detección automática de recurrencias** a partir del historial ("parece que pagas Netflix todos los meses, ¿lo declaro?"). Interesante, pero es adivinar; primero que el usuario declare.
- **Montos variables previstos** (IPC, escalonados). El usuario corrige al confirmar; eso basta.

## Dependencies

`Account`, `Category`, `Transaction` y `createTransaction()` — todos existen y están en producción. Ninguna dependencia nueva.
