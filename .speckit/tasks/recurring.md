# Task Breakdown: Gastos e Ingresos Recurrentes

Spec: `.speckit/specs/recurring.md` · Plan: `.speckit/plans/recurring.md` · Constitución: entrada nueva
en el Decision Log (2026-07-15, sobregiro automático = hecho consumado).

## Phase 0: La bandera de hecho consumado

- [x] **T001** — `createTransaction()` gana un 3er param `options?: { allowOverdraft?: boolean }`, pasado
  a `createTransactionInSession`. Con `true` se salta `assertSufficientFunds`. Default `false`. **Ninguna
  ruta HTTP lo expone.** Test: crear con `allowOverdraft` deja la cuenta en negativo sin lanzar; sin él,
  lanza `InsufficientFundsError`.

## Phase 1: Datos

- [x] **T010** — `src/lib/models/RecurringTransaction.ts` (FR-002), static `findForUser` (patrón `Debt.ts`),
  índice `{ userId, isArchived }` y `{ userId, isPaused, nextDueDate }` (para el sweep de catch-up).
- [x] **T011** — `Transaction.recurringOccurrenceKey?` (`immutable`). Índice único **parcial**
  `{ userId, recurringTransactionId, recurringOccurrenceKey }` con `partialFilterExpression:
  { recurringTransactionId: { $exists: true } }`. Test: dos inserts con la misma terna → el 2º da 11000.

## Phase 2: El motor (`src/lib/recurrence.ts`) — TEST-FIRST, 100%

- [x] **T020** — Test primero: `occurrenceKey` (UTC), `nextOccurrence` (las 4 frecuencias + **clamp día 31
  → 28/29 feb → vuelve al 31**, Scenario 8), `firstDueDate` (primer venc. ≥ hoy, sin backfill, FR-003),
  `dueOccurrences` (varios pendientes, respeta `endDate`, **tope de seguridad** contra `startDate` mal tecleado).
- [x] **T021** — Implementación. Puro, sin Mongoose (lo consume el cliente), UTC.

## Phase 3: El generador (`src/lib/services/recurring.ts`)

- [x] **T030** — `catchUp(userId, today)`: materializa vencidos de `autoGenerate:true` no pausados/archivados.
  **Crea la transacción primero, avanza `nextDueDate` después.** Reusa `createTransaction(..., {allowOverdraft:true})`.
- [x] **T031** ⚠️ — **Idempotencia (Scenario 3)**: si la creación tuvo éxito y el avance falló, la siguiente
  pasada la reintenta, el índice único la rechaza (11000), se captura *ese* error y se avanza. Test: dos
  `catchUp` seguidos → **exactamente una** transacción por vencimiento. Test de puesta al día tras 2 meses
  (Scenario 4) → una transacción por vencimiento, `nextDueDate` al siguiente.
- [x] **T032** — Scenario 7: un automático de 300.000 sobre 100.000 → se crea igual (saldo −200.000), sin diálogo.
- [x] **T033** — `pendingConfirmations(userId, today)` (los vencidos de `autoGenerate:false`).
- [x] **T034** — `confirmOccurrence(userId, id, occurrenceKey, amount?)` (FR-007: monto opcional, **no toca la
  plantilla**; Scenario 5). Sin `allowOverdraft`. `skipOccurrence(...)` (Scenario 6: no crea, avanza).
- [x] **T035** — Pausa (FR-008: no vence ni acumula; al reanudar recalcula hacia adelante) y `endDate` (FR-009).

## Phase 4: API

- [x] **T040** — `validation/recurring.ts` (create/update, `objectIdSchema` de `validation/common.ts`).
- [x] **T041** — `GET/POST /api/recurring`; `POST` valida pertenencia de account+category (FR-001), calcula
  `nextDueDate` con `firstDueDate` (FR-003). + tests.
- [x] **T042** — `GET/PATCH/DELETE /api/recurring/[id]` (DELETE archiva, FR-010; ajena → 404, Scenario 9). + tests.
- [x] **T043** — `POST /api/recurring/[id]/confirm`, `/skip`, `POST /api/recurring/catch-up`. + tests (replset).

## Phase 5: Frontend

- [x] **T050** — `useRecurring.ts` (list/create/update/archive + confirm/skip/catchUp), `recurringModal.store.ts`.
- [x] **T051** — `RecurringList` / `RecurringCard` / `RecurringForm` (`useSeedForm`; toggle tipo y autoGenerate;
  select de frecuencia). Patrón Deudas.
- [x] **T052** — Tarjeta de **pendientes por confirmar** (corrección de monto, US3) y su flujo confirm/skip.
- [x] **T053** — Widget **"Próximos vencimientos"** del panel (US5), alimentado por `recurrence.ts` en el cliente.
- [x] **T054** — `catch-up` disparado al cargar el panel (mutación que invalida accounts/transactions/dashboard).
- [x] **T055** — Página `/dashboard/recurring` + enlace en el `Sidebar`.

## Phase 6: Cierre

- [x] **T060** — Gates: type-check ✅, lint ✅ (0 errores), 781 tests ✅, cobertura **82.22%** ✅,
  **`recurrence.ts` al 100%** en stmts/branches/funcs/lines ✅, build ✅ (27+ rutas, sin errores de
  bundle cliente — el motor puro sin Mongoose cumplió su función).
- [x] **T061** — E2E contra producción: **22/22 checks PASS**. Scenario 1 (sin backfill), 5 (monto corregido sin tocar la plantilla), 6 (saltar), 7 (el automático en descubierto se registra), 9 (404 ajeno) + id malformado → 422. **Scenario 3/4 (idempotencia) probados de verdad, no vacuamente**: catch-up ×2 sobre un vencimiento real → created 1/0, una sola transacción, el saldo baja UNA vez; y forzando 2 meses de atraso → 3 transacciones, todas con clave única, repetir crea 0. Datos borrados de Atlas.
- [x] **T062** — Commit `3da8232` + push (desplegado). Memoria actualizada.

## Legend
✅ hecho · ⚠️ crítico · 🚫 bloqueado · ⬜ pendiente
