# Specification: Saldos honestos — sin sobregiros silenciosos

## Overview

Hoy la app te deja gastar dinero que no tienes: si el saldo no alcanza, pregunta *"¿lo registro de todos modos?"* y, si dices que sí, deja la cuenta en negativo y ahí se acaba la conversación. El negativo queda ahí, mudo, sin explicar de dónde salió ese dinero.

Este módulo cambia la regla: **el dinero no aparece de la nada**. Si pagaste con dinero que no tenías, salió de algún sitio — de otra cuenta, o prestado. La app deja de ofrecerte una escapatoria y empieza a hacerte la única pregunta que importa: **¿de dónde salió?**

Es un cambio de producto, no un ajuste: **invierte una decisión ya en producción** (el `confirmOverdraft` de la Fase A) y **exige una capacidad nueva en Deudas** (el desembolso). Bloquea a Gastos Recurrentes, que debe construirse encima de unas reglas de saldo que no mientan.

---

## Las cuatro decisiones que lo gobiernan

### 1. Al gastar, se bloquea. No hay "registrar de todos modos".

Cuando el usuario está registrando un gasto o un pago, **todavía puede decidir**. Ahí el bloqueo tiene sentido y es lo que pidió el dueño. El diálogo de "saldo insuficiente" deja de ser una escapatoria y pasa a ser una **bifurcación honesta**.

Si intentas gastar más de lo que la app cree que tienes y no fue un préstamo, **una de tres es cierta — no hay una cuarta**. El diálogo son exactamente esas cuatro salidas:

> **No tienes saldo suficiente.** Esta cuenta tiene 100.000 disponibles y el gasto es de 250.000.
> **¿De dónde salió ese dinero?**
> · **Lo pedí prestado** → crea una deuda que desembolsa en esta cuenta
> · **Me equivoqué de cuenta** → cambiar la cuenta del gasto
> · **Falta registrar un ingreso** → registrar el ingreso que falta (el caso más frecuente: el sueldo que aún no anotaste)
> · **El saldo de la app está mal** → un **ajuste de saldo**

**Sobre el ajuste de saldo, y por qué no es `confirmOverdraft` con otro nombre.** La diferencia no es cosmética: un ajuste **queda escrito**, con su propia categoría ("Ajuste de saldo"), su monto y su fecha, y aparece en el historial y en los reportes. Dice *"aquí la app y la realidad no cuadraban, y esto es lo que faltaba"* — eso es contabilidad. El `confirmOverdraft` no dejaba rastro: solo un saldo negativo mudo, sin explicación y sin forma de auditarlo. Eso era rendirse.

**El riesgo asumido conscientemente**: si el ajuste resulta demasiado cómodo, el usuario lo usará cada vez que la app le frene y en seis meses su historial será un desfile de "ajustes" sin significado. Se acepta porque la alternativa (obligarle a salir del flujo y arreglar el saldo a mano en otra pantalla) haría que abandonara el registro a medias, que es peor. Pero **el ajuste debe ser visible, nunca el botón por defecto, y nunca el primero de la lista.**

### 1-bis. La deuda que nace de un gasto sin saldo se propone por **el faltante**, no por el gasto entero.

Con 100.000 en la cuenta y un gasto de 250.000, la deuda propuesta es de **150.000**, no de 250.000.

**Por qué**: los 150.000 del faltante son **lo único que se puede demostrar que vino de fuera** — los otros 100.000 ya los tenías. Proponer 250.000 asume que el prestamista te dio el monto entero en efectivo (y entonces te sobrarían 100.000 en la cuenta), que es una suposición, no un dato. El monto es **editable**, y la descripción se hereda del gasto ("Préstamo para: Mercado"), para que el usuario solo tenga que corregir lo que la app no podía saber.

### 2. Corregir el pasado NO se recorta. Se marca en descubierto.

El dueño propuso recortar la corrección al saldo disponible (borrar un ingreso falso de 3.000.000 solo hasta dejar la cuenta en cero, dejándolo registrado en 2.000.000). **Rechazado, y esto es una decisión, no un aplazamiento.**

**Por qué**: si el ingreso real eran 1.000.000 y se tecleó un cero de más, esa regla dejaría escrito un ingreso de 2.000.000 — **un número que ni ocurrió ni lo tecleó nadie: se lo inventaría la app** para proteger un invariante. Para no enseñar un saldo feo, falsificaría el historial. Y el saldo se recalcula; el historial es lo que el usuario cree que pasó.

En su lugar: la corrección **se permite**, la cuenta queda en negativo y **se marca "en descubierto"**, ruidosamente, con la misma pregunta: *¿de dónde salieron esos 2.000.000?* No miente y no encierra al usuario en un error que no puede deshacer.

### 3. Un hecho consumado se anota. Una decisión se frena.

La distinción que ordena todo el módulo:

| | ¿Se puede evitar aún? | Qué hace la app |
|---|---|---|
| Gasto/pago que el usuario está registrando | **Sí** | **Bloquea** y ofrece resolverlo |
| Corrección de un movimiento pasado | No — ya pasó | **Anota** y marca descubierto |
| Cargo recurrente automático (el banco ya lo cobró) | No — ya pasó | **Anota** y marca descubierto |

Negarse a anotar un hecho consumado no lo deshace: solo hace que la app muestre un saldo **más falso** que el real, creyendo que protege.

### 4. Una tarjeta de crédito NO está en descubierto por tener saldo negativo.

Una tarjeta *funciona* gastando dinero que no tienes: su saldo negativo **es** lo que le debes al banco. Ya se mide contra `creditLimit + currentBalance`, no contra cero, y eso no se toca. Una tarjeta está en descubierto solo si **excede su cupo**.

---

## User Stories (Priority Order)

### P1 - Critical

**US1 — Que no me deje gastar lo que no tengo**
Como usuario, quiero que la app me frene si un gasto excede mi saldo, en vez de ofrecerme registrarlo igual.

**US2 — Decirle de dónde salió el dinero**
Como usuario, cuando me frene, quiero resolverlo ahí mismo: o el gasto salió de otra cuenta, o pedí prestado.

**US3 — Registrar un préstamo que entra a mi cuenta (desembolso)**
Como usuario, quiero registrar que pedí 500.000 prestados y que **ese dinero entre a mi cuenta**, para poder pagar con él — y que quede como una deuda que debo.

**US4 — Ver cuándo una cuenta está en descubierto**
Como usuario, quiero ver claramente qué cuenta está en negativo y cuánto, con una alerta que me invite a explicarlo.

### P2 - Important

**US5 — Corregir un error sin que la app me lo impida**
Como usuario, quiero poder borrar o corregir un movimiento equivocado aunque el saldo quede negativo, y que la app me lo señale en vez de prohibírmelo.

---

## Acceptance Scenarios

### Scenario 1: Gasto que excede el saldo (el bloqueo)
**Dado** una cuenta de ahorros con 100.000,
**Cuando** intento registrar un gasto de 250.000,
**Entonces** la app **no lo registra**, el saldo sigue en 100.000, y me ofrece dos salidas: cambiar de cuenta, o registrar una deuda.
**Y** no existe ninguna forma de forzar el registro (`confirmOverdraft` deja de existir en la API).

### Scenario 2: Resolverlo con un préstamo (desembolso)
**Dado** el escenario anterior,
**Cuando** elijo "lo pedí prestado" e indico una deuda de 200.000 desembolsada en esa misma cuenta,
**Entonces** se crea un **ingreso** de 200.000 en la cuenta ligado a la deuda (saldo: 300.000),
**Y** después se registra el gasto de 250.000 (saldo: 50.000),
**Y** la deuda muestra 200.000 pendientes.

### Scenario 3: El desembolso NO cuenta como un pago de la deuda ⚠️
**Dado** una deuda de 200.000 con su desembolso registrado,
**Cuando** consulto el estado de la deuda,
**Entonces** el saldo pendiente es **200.000**, no 0.
> Este escenario existe porque hoy `paymentsFor()` (`src/lib/services/debts.ts`) busca **todas** las transacciones con ese `debtId` **sin filtrar por tipo**. Sin arreglarlo, el ingreso del desembolso se contaría como un pago y **la deuda se saldaría con el propio dinero que te prestó**. Es un número falso sobre el dinero del usuario, y no revienta: solo miente.

### Scenario 4: Tarjeta de crédito dentro de su cupo
**Dado** una tarjeta con cupo 2.000.000 y saldo −500.000,
**Cuando** registro un gasto de 300.000,
**Entonces** **se registra** (saldo −800.000), sin bloqueo y **sin marca de descubierto**: está dentro del cupo.

### Scenario 5: Tarjeta que excede su cupo
**Dado** la misma tarjeta con saldo −1.900.000,
**Cuando** intento un gasto de 300.000,
**Entonces** la app **bloquea** (excedería el cupo) y ofrece las mismas salidas.

### Scenario 6: Corregir un ingreso equivocado
**Dado** un ingreso de 3.000.000 (falso) y gastos por 2.000.000 — saldo 1.000.000,
**Cuando** borro el ingreso,
**Entonces** **se borra entero**, el saldo queda en **−2.000.000**,
**Y** la cuenta se marca **en descubierto** con la pregunta de a dónde pertenece ese dinero.
**Y** no se recorta la corrección ni se reescribe el monto del ingreso.

### Scenario 7: La deuda se propone por el faltante, no por el gasto
**Dado** una cuenta con 100.000 y un gasto bloqueado de 250.000,
**Cuando** elijo "lo pedí prestado",
**Entonces** el formulario de deuda viene con **150.000** (el faltante), no con 250.000,
**Y** la descripción heredada del gasto,
**Y** ambos campos son editables.

### Scenario 8: Falta un ingreso por registrar (el caso más frecuente)
**Dado** una cuenta con 100.000 y un gasto bloqueado de 250.000,
**Cuando** elijo "falta registrar un ingreso" y anoto mi sueldo de 3.000.000,
**Entonces** el ingreso se registra (saldo 3.100.000) **y el gasto se registra a continuación** (saldo 2.850.000), sin que yo tenga que volver a teclearlo.

### Scenario 9: Un ajuste de saldo deja rastro
**Dado** una cuenta con 100.000 que en realidad tiene 400.000,
**Cuando** resuelvo un gasto bloqueado con un ajuste de 300.000,
**Entonces** existe una transacción de ingreso de 300.000 con `origin: "adjustment"`, en la categoría **"Ajuste de saldo"**, **visible en el historial** — no un saldo negativo mudo,
**Y** esa categoría se crea sola si el usuario no la tenía.

### Scenario 10: Una deuda vieja no tiene ni pide desembolso
**Dado** la deuda de 17.000.000 del dueño, registrada antes de este módulo,
**Cuando** consulto su estado,
**Entonces** funciona **exactamente igual que hoy**: 17.000.000 de capital, sus pagos, su mora. **Sin desembolso, sin saldo fantasma en ninguna cuenta, y sin que la app se lo pida.**

### Scenario 11: Aislamiento entre usuarios
**Dado** una deuda o cuenta de otro usuario,
**Cuando** intento desembolsar o ajustar contra ella,
**Entonces** recibo **404**.

---

## Functional Requirements

- **FR-001** — **`createTransaction()` rechaza** cualquier movimiento que deje la cuenta por debajo de su mínimo (0 para efectivo/banco; `−creditLimit` para tarjeta). `InsufficientFundsError` (422) sigue siendo el error, con `available` y `currency`. Aplica también a `payDebt()`, que delega en él.
- **FR-002** — **`confirmOverdraft` se elimina** de la API, de los schemas de Zod y del servicio. No hay forma de forzar un sobregiro al crear.
- **FR-003** — **`updateTransaction()` y `deleteTransaction()` NO aplican FR-001**: pueden dejar la cuenta en negativo, y entonces se marca en descubierto (FR-009).
  > **Por qué la línea cae exactamente aquí.** Una transacción que ya existe es dinero que **ya se movió**: editarla o borrarla es corregir el registro de un hecho, no decidir un gasto. Si se bloqueara la edición, el usuario quedaría **encerrado en su propio error** — registra 100.000 lo que en realidad fueron 250.000, y al ir a corregirlo la app se lo impide porque "no tiene saldo". Ese encierro es el mismo trapo, ya sea sobre un ingreso o sobre un gasto: la trampa no está en el tipo del movimiento, sino en editar.
  >
  > **El agujero que esto deja, asumido a conciencia**: crear un gasto de 1.000 y luego editarlo a 250.000 esquiva el bloqueo. Se acepta. Alguien dispuesto a ese baile de dos pasos no está siendo protegido por el bloqueo — solo estorbado; y el resultado (una cuenta en descubierto, marcada en rojo, pidiendo explicación) es exactamente el mismo. El bloqueo existe para atrapar al usuario **en el momento de la decisión**, no para hacer inmutable la aritmética.
- **FR-004** — **Desembolso**: `Debt` puede registrar un desembolso, que crea una `Transaction` de tipo `income` con `debtId` y `origin: "disbursement"`, acreditando una cuenta del usuario.
- **FR-005** — ⚠️ `paymentsFor()` **debe filtrar `type: "expense"`**. Un desembolso jamás puede contarse como pago. (Ver Scenario 3.)
- **FR-006** — Una deuda registra **como máximo un desembolso**. Un segundo intento → 409.
- **FR-007** — ⚠️ **El desembolso es opcional, y las deudas existentes NO lo llevan ni lo llevarán.** Solo lo tienen las deudas que **nacen ahora**, como respuesta a un gasto sin saldo. Las deudas ya registradas (la de 17.000.000 del dueño, la del banco, ADDI) son dinero que llegó **hace meses y fuera de la app**, y ya está gastado: darles un desembolso les inyectaría un saldo fantasma en una cuenta. Ninguna migración toca las deudas existentes.
- **FR-008** — **Ajuste de saldo**: una `Transaction` de tipo `income` con `origin: "adjustment"`, en una categoría "Ajuste de saldo" que se crea al vuelo la primera vez (los usuarios existentes no la tienen entre sus 21 categorías sembradas).
- **FR-009** — Una cuenta está **en descubierto** si `availableBalance(account) < 0`. Se expone en la API de cuentas y se muestra en la UI (tarjeta de cuenta, panel). Una tarjeta dentro de su cupo **no** está en descubierto (decisión 4).
- **FR-010** — Ningún saldo se denormaliza de más: el descubierto es una lectura derivada de `currentBalance` y `creditLimit`, no un campo guardado.

---

## Technical Context

Todo el punto de apoyo ya existe:

- **`availableBalance(account)`** y **`assertSufficientFunds()`** (`src/lib/services/transactions.ts`) ya implementan la regla correcta, incluida la de la tarjeta contra `creditLimit`. **Lo que se quita es la escapatoria, no la lógica.**
- **`InsufficientFundsError`** (422, con `available`/`currency`/`code`) y **`isInsufficientFunds()`** (`src/lib/api-client.ts`) ya existen y ya los consume el diálogo. Cambia el diálogo, no el error.
- **`createTransaction()`** ya acepta `debtId` y ya corre dentro de una transacción de Mongo con el `$inc` del saldo. El desembolso **delega en él**, igual que `payDebt()` — sin reimplementar nada.

### Cambios en el modelo

- **`Transaction.origin?: "disbursement" | "adjustment"`** — nuevo, opcional, `immutable`. Un solo campo en vez de dos banderas: distingue los ingresos que **no son ingresos de verdad** (no ganaste ese dinero: te lo prestaron, o la app se había equivocado) de los que sí. Sin él, el desembolso sería un ingreso indistinguible de un sueldo, y contaminaría cualquier reporte de "cuánto ingresé este mes".
  - Para FR-005 el filtro por `type: "expense"` ya bastaría por sí solo. `origin` existe para que el error sea **imposible**, no meramente improbable — y porque el dashboard va a necesitar excluir estos ingresos de sus totales.

### API

- `POST /api/debts/[id]/disbursement` — `{ accountId }`. Crea el ingreso por `debt.principal`. **409** si la deuda ya tiene desembolso.
- `POST /api/accounts/[id]/adjustment` — `{ amount, description? }`. Crea el ingreso de ajuste (FR-008).
- Se elimina `confirmOverdraft` de `POST/PATCH /api/transactions` y de `POST /api/debts/[id]/payments`.
- El diálogo de saldo insuficiente pasa a ofrecer las **cuatro** salidas (decisión 1).

---

## Success Criteria

- Los 7 escenarios como tests automatizados. El **Scenario 3 es innegociable**: sin él, el módulo introduce un bug que le regala al usuario una deuda saldada que no ha pagado.
- Cobertura ≥ 80%.
- Verificado end-to-end contra producción.

## Out of Scope

- **Recortar correcciones al saldo disponible** — *rechazado* (decisión 2), no pospuesto.
- **Una deuda por cada compra con tarjeta** — *rechazado*: la tarjeta ya es la deuda; duplicaría el saldo y llenaría Deudas de basura. Lo que sí se hará, en su propio módulo (backlog #4): **ciclo de facturación** (día de corte, día de pago) y **marcar una compra concreta como "a cuotas"**, que ahí sí crea una deuda de verdad.
- Sobregiro pactado con el banco (cupo negativo permitido en cuentas de ahorro). No es el caso del dueño.

## Dependencies

`Account`, `Transaction`, `Debt`, `createTransaction()`, `InsufficientFundsError` — todo en producción. **Ninguna dependencia nueva.**

## Notes

Requiere **enmendar la constitución**: el `confirmOverdraft` de la Fase A está en producción y esta spec lo revierte. La regla nueva ("el dinero no aparece de la nada; un hecho consumado se anota, una decisión se frena") es una decisión de producto que debe quedar en el Decision Log, no enterrada en un diff.
