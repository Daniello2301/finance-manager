# Implementation Plan: Tarjeta de crédito (transferencias, ciclo y cuotas)

## Specification Reference
`.speckit/specs/credit-card.md` — ratificada en el Decision Log de la constitución (2026-07-13/14).

> **Nota de proceso:** este plan se redactó **después** de la implementación, para cerrar el ledger
> SDD (spec→plan→tasks→code). Describe la arquitectura tal como quedó construida, no una propuesta
> previa. El detalle tarea-a-tarea está en `.speckit/tasks/credit-card.md`.

---

## Phase 0: Constitution Check

| Principio | Cumplimiento |
|---|---|
| 2. Database-First | Campos nuevos en los modelos `Account`/`Transaction` con su Zod. Sin queries crudas |
| 3. Test-First | La lógica con riesgo real (`card-cycle.ts`, servicio de transferencias) tiene tests que prueban su comportamiento. Los tests de rutas/UI se añadieron en el cierre — desviación registrada en tasks |
| 5. TS Strict | Sin `any`, sin `@ts-ignore` |
| 8. Multi-Tenant | Toda consulta cuelga de `userId`; transferir hacia/desde cuenta ajena → 404. Índice `{userId, transferId}` |
| 9. Money as Integer Minor Units | Montos de transferencia y cuotas son enteros; las cuotas se redondean para **sumar exacto** a la compra (la última absorbe el residuo) |

**Tensión declarada:** una transferencia mueve dinero pero **no** es ingreso ni gasto. Se resuelve con
`origin: "transfer"`, que `getMonthlyTrend` ya excluye — así las dos patas quedan fuera de los reportes
sin tocar el dashboard.

## Phase 1: Arquitectura

**Transferencias.** Dos transacciones enlazadas (un gasto en origen, un ingreso en destino) con un
`transferId` común, escritas en **una sola** `session.withTransaction()`. Para reutilizar la lógica de
`createTransaction` sin anidar transacciones de Mongo, se extrae `createTransactionInSession(userId,
input, session)` — el mismo primitivo que Recurrentes necesitará. El saldo insuficiente en el origen
lanza desde dentro y revierte todo: transferir lo que no tienes es una decisión, se bloquea.

**Ciclo de facturación.** `card-cycle.ts` puro y sin Mongoose (lo consume el navegador), en UTC, con
clamp a fin de mes — mismo criterio que `period.ts`/`recurrence`. `cycleFor(config, date)` da el
extracto donde cae una compra; `amountDue(config, movements, asOf)` calcula el pago sin intereses:
gastos no diferidos del ciclo cerrado + **una cuota** de cada compra diferida viva, nunca el saldo total.

**Compras a cuotas.** `Transaction.installmentCount` (≥2). La compra debita la tarjeta **en su
totalidad** (el cupo baja por todo el importe el día que compras — la verdad); el `installmentCount`
solo cambia lo que **el extracto del mes** exige. Modelar una `Debt` además sería doble conteo.

## Phase 2: Superficie

- **Modelos**: `Account` (`statementDay?`/`paymentDay?`), `Transaction` (`origin:"transfer"`,
  `transferId?`, `installmentCount?`).
- **Servicios**: `transfers.ts`, `statements.ts`, `systemCategories.ts`, `card-cycle.ts`.
- **Rutas**: `POST /api/transfers`, `GET /api/accounts/[id]/statement`.
- **UI/estado**: `TransferForm`, `CardStatement`, `AccountForm` (+ciclo), `AccountCard` (+extracto),
  `TransactionForm` (+cuotas), `useTransfers`, `useStatement`, `transferModal.store`.

## Out of Scope
Intereses de la tarjeta al no pagar el total · pago mínimo · una deuda por cada compra a cuotas.
Todo esto exige la fórmula del contrato del banco, que la app no inventa.
