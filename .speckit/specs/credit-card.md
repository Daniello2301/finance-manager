# Specification: Tarjeta de crédito — transferencias, ciclo y compras a cuotas

## Overview

Tres piezas que solo tienen sentido juntas:

1. **Transferencias entre cuentas** — la pieza que faltaba. **Hoy es imposible pagar una tarjeta en esta app**: el saldo de una tarjeta solo puede volverse más negativo, porque no hay forma de registrar que le pasaste dinero desde tus ahorros. Nadie lo notó porque hasta ahora la tarjeta era solo un sitio donde anotar gastos.
2. **Ciclo de facturación** — día de corte y día de pago. Responde la única pregunta que uno se hace frente a una tarjeta: *"¿cuánto pago y hasta cuándo, para que no me cobren intereses?"*.
3. **Compras a cuotas** — la transacción lleva escrito "12 cuotas".

## La decisión que gobierna el módulo (y una corrección)

**Una compra a cuotas NO crea una deuda.** Se dijo lo contrario antes de modelarlo, y era un error.

Compras una nevera de 2.000.000 a 12 cuotas. **Dos números distintos, los dos verdad:**
- **Le debes 2.000.000 al banco desde hoy**, y tu cupo baja 2.000.000 de una vez (confirmado por el dueño contra su propia tarjeta).
- **Tu extracto de este mes solo te cobra 166.666** (una cuota).

Si la tarjeta se debita 2.000.000 **y además** se crea una deuda de 2.000.000, **deberías 4.000.000**. Es exactamente el doble conteo por el que se rechazó "una deuda por cada compra con tarjeta" — colándose por la puerta de atrás, disfrazado de "solo las diferidas".

**Modelo correcto**: la compra es un gasto normal contra la tarjeta (debita los 2.000.000, baja el cupo — la verdad) **que además lleva `installmentCount: 12`**. Con ese dato la app calcula el pago del mes. **Deudas se queda para lo que es una deuda de verdad** (los 17M, el crédito bancario, ADDI) y no se llena de compras.

## Una transferencia no es un ingreso ni un gasto

Mover 500.000 de Ahorros a la tarjeta no es que hayas ganado ni gastado 500.000: es el mismo dinero, en otro sitio. Se modela como **dos transacciones enlazadas** (un gasto en el origen, un ingreso en el destino) con **`origin: "transfer"`** y un `transferId` común.

`origin` ya existe y ya sirve para esto: `getMonthlyTrend()` excluye todo lo que lo tenga (`origin: {$exists: false}`), así que **las transferencias quedan fuera de los reportes automáticamente**, sin tocar el dashboard. Es la tercera vez que ese campo se gana el sueldo.

**Atomicidad**: las dos patas se escriben dentro de **una sola transacción de Mongo**. Una transferencia a medias —el dinero sale de una cuenta y no llega a la otra— es dinero destruido. Para eso `createTransaction()` se refactoriza para aceptar una `session` opcional (algo que **Recurrentes también va a necesitar**).

**El saldo insuficiente aplica**: transferir dinero que no tienes es una *decisión*, así que se **bloquea** y sale el diálogo de las cuatro salidas, igual que cualquier gasto.

## Acceptance Scenarios

### Scenario 1: Pagar la tarjeta
**Dado** Ahorros con 2.000.000 y una Visa con saldo −800.000,
**Cuando** transfiero 800.000 de Ahorros a la Visa,
**Entonces** Ahorros queda en 1.200.000 y la Visa en **0**,
**Y** existen dos transacciones enlazadas con `origin: "transfer"`,
**Y** **ninguna de las dos aparece** en los ingresos ni los gastos del mes.

### Scenario 2: Una transferencia nunca queda a medias
**Dado** una transferencia cuyo segundo tramo falla,
**Entonces** **el primero se revierte**: el dinero no sale de ninguna cuenta.

### Scenario 3: Transferir lo que no tienes → se bloquea
**Dado** Ahorros con 100.000,
**Cuando** intento transferir 250.000,
**Entonces** **422**, ningún saldo se mueve, y sale el diálogo de las cuatro salidas.

### Scenario 4: No a la misma cuenta
**Cuando** intento transferir de una cuenta a sí misma → **422**.

### Scenario 5: Lo que compras hoy, ¿cuándo lo pagas?
**Dado** una Visa con corte el **día 20** y pago el **día 5**,
**Cuando** compro el **14 de julio** (antes del corte),
**Entonces** esa compra entra en el extracto que corta el **20 de julio** y se paga el **5 de agosto**.
**Cuando** compro el **25 de julio** (después del corte),
**Entonces** entra en el extracto del **20 de agosto** y se paga el **5 de septiembre**.

### Scenario 6: Corte el día 31 en febrero
**Dado** corte el **día 31**,
**Entonces** en febrero corta el **28** (o 29). Nunca se desplaza al 1 de marzo ni se salta el mes. Mismo *clamp* a fin de mes que `recurrence`.

### Scenario 7: Cuánto pagar sin intereses
**Dado** una Visa con corte el 20, y en el ciclo cerrado: un gasto normal de 300.000 y una compra de **2.400.000 a 12 cuotas**,
**Entonces** el pago para no generar intereses es **300.000 + 200.000 = 500.000**, no 2.700.000.
**Y** el **saldo** de la tarjeta sigue siendo **−2.700.000** (lo que le debes al banco). Los dos números se muestran, etiquetados, porque los dos son verdad.

### Scenario 8: Sin fechas configuradas, no se inventa nada
**Dado** una tarjeta **sin** día de corte ni de pago (el caso del dueño hoy),
**Entonces** la app **no muestra ciclo ni fecha de pago**, y lo dice. No estima.

### Scenario 9: Aislamiento
Transferir hacia/desde una cuenta ajena → **404**.

## Functional Requirements

- **FR-001** — `Transaction.origin` gana `"transfer"`. `Transaction.transferId?` enlaza las dos patas.
- **FR-002** — Las dos patas se escriben en **una sola transacción de Mongo**. Nunca media transferencia.
- **FR-003** — Origen y destino deben ser cuentas **distintas** del **mismo usuario**. Ajena → 404. Misma → 422.
- **FR-004** — Saldo insuficiente en el origen → `InsufficientFundsError` (422). Sin escapatoria (es una decisión).
- **FR-005** — Las categorías "Transferencia" (una de gasto, una de ingreso) se crean **al vuelo**, como "Ajuste de saldo".
- **FR-006** — `Account.statementDay?` y `Account.paymentDay?` (1–31), **solo con sentido en `credit_card`**. Opcionales: sin ellos no hay ciclo (Scenario 8).
- **FR-007** — `Transaction.installmentCount?` (≥2), solo en gastos contra una tarjeta. **No crea ninguna `Debt`.**
- **FR-008** — `src/lib/card-cycle.ts`: puro, **sin Mongoose** (lo consume el cliente), en **UTC**, con *clamp* a fin de mes.
- **FR-009** — El pago sin intereses = gastos no diferidos del ciclo cerrado + **una cuota** de cada compra diferida viva. **Nunca** el saldo total.
- **FR-010** — Saldo (`currentBalance`) y pago-del-mes son **dos cifras distintas y ambas se muestran, etiquetadas**. Confundirlas es el error central de este módulo.

## Out of Scope

- **Una deuda por compra a cuotas** — *rechazado* (ver arriba): doble conteo.
- **Intereses de la tarjeta** cuando NO pagas el total. Necesita la tasa del contrato y reglas de causación por banco; la app no la va a inventar (misma razón por la que se rechazó traer las tasas de internet).
- **Pago mínimo**. Lo fija el banco con su propia fórmula. Presentar una estimación como si fuera el mínimo es exactamente el tipo de mentira que esta app no cuenta.

## Dependencies

`Account`, `Transaction`, `createTransaction()`, `origin`, `InsufficientFundsError`. **Ninguna dependencia nueva.**
