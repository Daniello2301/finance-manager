# Task Breakdown: Tarjeta de crédito (transferencias, ciclo y compras a cuotas)

Spec: `.speckit/specs/credit-card.md` · Plan: `.speckit/plans/credit-card.md` · Constitución:
tarjeta de crédito ratificada en el Decision Log (2026-07-13/14: "ciclo de facturación, compras a
cuotas", "una deuda por compra → rechazada").

> **Nota de proceso (honestidad SDD):** la implementación se escribió **antes** que este `tasks.md`
> y el `plan.md` — se apartó del orden spec→plan→tasks→code. Estos dos documentos se redactan **a
> posteriori** para cerrar el ledger, dejando constancia de lo construido y de las desviaciones. La
> capa de lógica pura (`card-cycle.ts`, servicio de transferencias) **sí** quedó cubierta por tests
> que prueban su comportamiento; los tests de las rutas HTTP y del frontend se añadieron en el cierre.

## Phase 0: La decisión que gobierna el módulo

- [x] **T001** — Una compra a cuotas **NO** crea una `Debt`. La compra es un gasto normal contra la
  tarjeta (debita el total, baja el cupo — la verdad) que **además** lleva `installmentCount`. Modelar
  una `Debt` además sería el doble conteo que ya se rechazó ("una deuda por compra"). `Transaction`
  gana `installmentCount?` (`min: 2`, `immutable` no — se puede corregir).
- [x] **T002** — Saldo (`currentBalance`, lo que debes al banco) y pago-del-mes son **dos cifras
  distintas, ambas verdad, ambas etiquetadas**. Confundirlas es el error central que este módulo
  existe para evitar (FR-010).

## Phase 1: Transferencias — la primitiva que faltaba

- [x] **T010** — `Transaction.origin` gana `"transfer"`; `Transaction.transferId?` enlaza las dos
  patas; índice `{userId, transferId}`. Una transferencia **no** es ingreso ni gasto: `getMonthlyTrend`
  ya excluye todo lo que tenga `origin`, así que quedan fuera de los reportes sin tocar el dashboard
  (FR-001). Tercera vez que `origin` se gana el sueldo.
- [x] **T011** — `createTransaction()` se parte en **`createTransactionInSession(userId, input,
  session)`** reutilizable, sin cambio de comportamiento. Mongo no anida `withTransaction`, así que la
  sesión se pasa en vez de arrancarla otra vez. **Recurrentes va a querer lo mismo.**
- [x] **T012** — `src/lib/services/transfers.ts`: `transferMoney()` escribe las dos patas dentro de
  **una sola transacción de Mongo** (FR-002). Media transferencia es dinero destruido. El saldo
  insuficiente en el origen lanza desde dentro y revierte todo (FR-004) — transferir lo que no tienes
  es una *decisión*, se bloquea igual que cualquier gasto.
- [x] **T013** — Origen y destino deben ser cuentas **distintas** del **mismo usuario**: ajena → 404
  (sin fuga de existencia), misma → 422 (FR-003). Validado en el servicio y en Zod (`.refine`).
- [x] **T014** — `src/lib/services/systemCategories.ts`: `findOrCreateCategory()` + `TRANSFER_CATEGORY`
  / `ADJUSTMENT_CATEGORY`. Las categorías "Transferencia" (gasto e ingreso) se crean al vuelo (FR-005),
  como "Ajuste de saldo". `adjustments.ts` se simplificó para compartir este helper (antes tenía su
  propia copia de find-or-create).
- [x] **T015** — `POST /api/transfers` (`validation/transfers.ts`), `useTransfer()` (invalida
  accounts/transactions/categories/dashboard), `transferModal.store.ts`, `TransferForm.tsx` (con la
  rama de `InsufficientFundsDialog` para el reintento).

## Phase 2: Ciclo de facturación

- [x] **T020** — `Account.statementDay?` / `paymentDay?` (1–31), **opcionales**: sin **ambos** no hay
  ciclo y la app lo dice, no estima (FR-006, Scenario 8). El dueño tiene una tarjeta y no sabe sus
  propias fechas — inventarlas sería inventar una fecha de pago.
- [x] **T021** — `src/lib/card-cycle.ts`: `cycleFor()` / `amountDue()` / `installment()`, **puras y
  sin Mongoose** (las consume el navegador), en **UTC**, con *clamp* a fin de mes — corte el 31 corta
  el 28/29 en febrero, no se desplaza ni se salta el mes (FR-008, Scenarios 5/6). Test-first en
  `card-cycle.test.ts`.
- [x] **T022** — El pago sin intereses = gastos no diferidos del ciclo cerrado + **una cuota** de cada
  compra diferida viva. **Nunca** el saldo total (FR-009, Scenario 7). Las cuotas se redondean para que
  **sumen exacto** a la compra (la última absorbe el residuo).
- [x] **T023** — `services/statements.ts` + `GET /api/accounts/[id]/statement`: devuelve `currentBalance`
  y `amountDue` **por separado** (FR-010). 422 si la cuenta no es tarjeta o no tiene días de ciclo.
- [x] **T024** — `useStatement()` (solo consulta cuando la tarjeta tiene ambos días) + `CardStatement.tsx`
  (las dos cifras etiquetadas + botón "Pagar tarjeta" que abre una transferencia prellenada). Campos de
  ciclo en `AccountForm.tsx`; extracto en `AccountCard.tsx`.

## Phase 3: Compras a cuotas

- [x] **T030** — `validation/transactions.ts` gana `installmentCount?` (2–48). `TransactionForm.tsx`
  ofrece diferir un gasto contra una tarjeta. **No** crea ninguna `Debt` (T001).

## Phase 4: Cierre (añadido a posteriori)

- [x] **T040** — Arreglo de correctitud (FR-006): `PATCH /api/accounts/[id]` valida `statementDay`/
  `paymentDay` contra el tipo **efectivo**, igual que `creditLimit`. Antes un PATCH podía sembrar un día
  de corte en una cuenta que no es tarjeta (el schema de update es parcial y no tiene `.refine`).
- [x] **T041** — Tests de las rutas HTTP y del frontend que faltaban:
  `api/transfers/route.test.ts`, `api/accounts/[id]/statement/route.test.ts`,
  `useTransfers.test.tsx`, `transferModal.store.test.ts`, `TransferForm.test.tsx`, + los dos casos de
  regresión de T040 en `api/accounts/[id]/route.test.ts`.
- [x] **T042** — Gates: `type-check`, `lint`, `test:run`, `test:coverage` (≥80%), `build` limpios.
- [ ] **T043** — Verificación end-to-end contra producción (Scenarios 1, 5/7, 8 + el 422 del arreglo
  T040). *Pendiente de datos reales del dueño / navegador.*

## Desviaciones frente a la spec (registradas en sitio)
- El `.refine` de ciclo en el schema de **create** usa `path: ["statementDay"]`; el schema de **update**
  no lleva refine y la validación de tipo efectivo vive en la ruta (mismo patrón que `creditLimit`).
- `systemCategories.ts` unifica el find-or-create que antes estaba solo en `adjustments.ts`.

## Out of Scope (ratificado en la spec — NO implementar)
Intereses de la tarjeta cuando no pagas el total · pago mínimo · una deuda por cada compra a cuotas.

## Legend
✅ hecho · ⚠️ crítico · 🚫 bloqueado · ⬜ pendiente
