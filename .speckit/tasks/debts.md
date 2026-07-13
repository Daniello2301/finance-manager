# Task Breakdown: Deudas

**Specification**: `.speckit/specs/debts.md`
**Plan**: `.speckit/plans/debts.md`
**Constitution**: enmienda 1 (2026-07-13) — Deudas añadida a Fase 2, secuenciada primero
**User Stories Covered**: [US1]-[US8] (US9 fuera de alcance; US10 **rechazada**)

---

## Phase 0: La matemática (test-first, sin base de datos)

Esta fase va primero a propósito. Es la única parte del módulo con riesgo real: un error aquí no revienta la app, devuelve un número falso sobre el dinero del usuario.

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T500] | [UNIT TEST] Tests fallando para `deriveMonthlyRate()`: converge con (10M, 500k, 24); devuelve `null` si falta cualquiera de los 3 datos; devuelve `null` cuando `cuota × n ≤ P` (no existe tasa positiva) | 0.5d | [P] | - | | ✅ |
| [T501] | [US6/FR-007] Implementar `deriveMonthlyRate()` (Newton-Raphson, semilla 0.01, tope 100 iter, tol 1e-9) en `src/lib/debt-math.ts` | 0.5d | - | [T500] | | ✅ |
| [T502] | [UNIT TEST] Tests fallando para `replayDebt()` con los números reales del dueño: 17M al 1.5% → interés 255.000; pago de 255k → 0 a capital, saldo intacto; pago de 3M → 2.745.000 a capital, saldo 14.255.000, interés del mes siguiente 213.825 | 0.7d | [P] | - | | ✅ |
| [T503] | [UNIT TEST] Test fallando: pago corto (210k contra 255k de interés) → mora 45.000, capital **NO** crece (FR-005) | 0.3d | [P] | - | | ✅ |
| [T504] | [UNIT TEST] Test fallando: deuda sin `principal` → `outstanding: null`, **no** `0` (Nota 3 del plan: `0` diría "ya no debes nada") | 0.3d | [P] | - | | ✅ |
| [T505] | [UNIT TEST] Test fallando: el redondeo cuadra — la suma de los abonos a capital iguala exactamente la caída del saldo (COP no tiene decimales) | 0.3d | [P] | - | | ✅ |
| [T506] | [UNIT TEST] Test fallando: los meses se generan en UTC (un pago del día 31 no cae en el mes siguiente) | 0.3d | [P] | - | | ✅ |
| [T507] | [US4/FR-003/FR-004] Implementar `replayDebt()` + `effectiveRate()` | 1d | - | [T502]-[T506] | | ✅ |
| [T508] | Todos los tests de `debt-math` pasan | 0.2d | - | [T507] | | ✅ |

## Phase 1: Modelo

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T510] | [UNIT TEST] Tests fallando para el schema `Debt` (solo `name` obligatorio; `findForUser` aísla por usuario) | 0.3d | [P] | [T508] | | ✅ |
| [T511] | [US1/FR-001] Crear `src/lib/models/Debt.ts` (static tipado copiado de `Account.ts`) | 0.4d | - | [T510] | | ✅ |
| [T512] | [FR-002] Añadir `debtId?` + índice `{userId, debtId}` a `src/lib/models/Transaction.ts` | 0.2d | - | [T511] | | ✅ |
| [T513] | [UNIT TEST] Test: editar un pago **no** le borra el `debtId` (riesgo identificado en el plan) | 0.3d | - | [T512] | | ✅ |
| [T514] | Crear `src/lib/validation/debts.ts` (Zod, sin mongoose, `objectIdSchema` desde `common.ts`) | 0.3d | - | [T511] | | ✅ |

## Phase 2: Servicio

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T520] | [UNIT TEST] Test fallando: `getDebtState()` junta `Debt` + sus pagos y delega en `replayDebt()` | 0.4d | [P] | [T514] | | ✅ |
| [T521] | [FR-003] Implementar `getDebtState()` / `listDebtsWithState()` en `src/lib/services/debts.ts` | 0.6d | - | [T520] | | ✅ |
| [T522] | [UNIT TEST] Test fallando: `payDebt()` crea la transacción con `debtId` y mueve `Account.currentBalance` | 0.4d | - | [T521] | | ✅ |
| [T523] | [US2/FR-002] Implementar `payDebt()` — **delega en `createTransaction()`**, no reimplementa el `$inc` ni la transacción de Mongo | 0.4d | - | [T522] | | ✅ |
| [T524] | [UNIT TEST] Test: pagar con saldo insuficiente pide confirmación (heredado de la Fase A) | 0.3d | - | [T523] | | ✅ |
| [T525] | [US7/FR-010] Implementar `getDebtSummary()` para el widget del dashboard | 0.4d | - | [T521] | | ✅ |

## Phase 3: API

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T530] | [INTEGRATION TEST] Tests fallando para `GET/POST /api/debts` (incluye aislamiento multi-tenant: 404, nunca 403) | 0.4d | [P] | [T525] | | ✅ |
| [T531] | Implementar `src/app/api/debts/route.ts` | 0.4d | - | [T530] | | ✅ |
| [T532] | [INTEGRATION TEST] Tests fallando para `GET/PATCH/DELETE /api/debts/[id]` (DELETE archiva; los pagos sobreviven — FR-009) | 0.4d | [P] | [T531] | | ✅ |
| [T533] | Implementar `src/app/api/debts/[id]/route.ts` (con `parseObjectIdParam`) | 0.4d | - | [T532] | | ✅ |
| [T534] | [INTEGRATION TEST] Test fallando: `POST /api/debts/[id]/payments` (usa `MongoMemoryReplSet` — `withTransaction`) | 0.4d | - | [T533] | | ✅ |
| [T535] | [US2] Implementar `src/app/api/debts/[id]/payments/route.ts` | 0.4d | - | [T534] | | ✅ |
| [T536] | [US7] Implementar `src/app/api/dashboard/debts/route.ts` | 0.3d | - | [T525] | | ✅ |

## Phase 4: Frontend

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T540] | `src/hooks/useDebts.ts` (React Query; `parseJsonOrThrow` desde `@/lib/api-client`) | 0.4d | [P] | [T536] | | ✅ |
| [T541] | `src/stores/debtModal.store.ts` (Zustand, copia de `budgetModal.store.ts`) | 0.2d | [P] | - | | ✅ |
| [T542] | [COMPONENT TEST] Tests fallando para `DebtForm` (solo el nombre obligatorio; la tasa despejada aparece en vivo y se marca **estimada**) | 0.5d | - | [T540] | | ✅ |
| [T543] | [US1/US6/FR-008] `DebtForm.tsx` — conversión %→decimal **en un solo sitio** (riesgo alto del plan) | 0.7d | - | [T542] | | ✅ |
| [T544] | [COMPONENT TEST] Tests fallando para `DebtCard`/`DebtList` (alerta de mora; `outstanding: null` se muestra como "sin datos", nunca como 0) | 0.4d | [P] | [T540] | | ✅ |
| [T545] | [US3/US5/US8] `DebtList.tsx` + `DebtCard.tsx` | 0.6d | - | [T544] | | ✅ |
| [T546] | [US2] `DebtPaymentForm.tsx` (reusa `AccountSelect`; maneja el 422 de saldo insuficiente igual que `TransactionForm`) | 0.5d | - | [T545] | | ✅ |
| [T547] | [US4] `DebtPaymentList.tsx` — cada pago con su interés/capital | 0.4d | - | [T545] | | ✅ |
| [T548] | `src/app/dashboard/debts/page.tsx` | 0.3d | - | [T545] | | ✅ |
| [T549] | Entrada en `Sidebar.tsx` (icono `Landmark`) | 0.1d | - | [T548] | | ✅ |

## Phase 5: Dashboard + cierre

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T550] | [COMPONENT TEST] Tests fallando para `DebtSummaryWidget` | 0.3d | [P] | [T536] | | ✅ |
| [T551] | [US7] `DebtSummaryWidget.tsx` + componer en `src/app/dashboard/page.tsx` | 0.4d | - | [T550] | | ✅ |
| [T552] | Cobertura ≥80% verificada (Principio 3) | 0.2d | - | [T551] | | ✅ |
| [T553] | `type-check` + `lint` + `build` limpios | 0.2d | - | [T552] | | ✅ |
| [T554] | Verificación end-to-end contra producción con los números reales del dueño | 0.3d | - | [T553] | | ✅ |

---

## Legend
- ✅ Completado · ⬜ Pendiente · 🚫 Bloqueado
- `[P]` = puede hacerse en paralelo con otras tareas del mismo bloque
- `[UNIT TEST]` / `[INTEGRATION TEST]` / `[COMPONENT TEST]` = se escribe **antes** que la implementación (Principio 3)

## Critical Path

```
T500-T508 (la matemática)  →  T510-T514 (modelo)  →  T520-T525 (servicio)
   →  T530-T536 (API)  →  T540-T549 (frontend)  →  T550-T554 (dashboard + cierre)
```

La ruta crítica **empieza y se juega en la Fase 0**. Todo lo demás es patrón conocido, copiado de módulos que ya funcionan. Si `debt-math.ts` está bien, el resto del módulo es CRUD; si está mal, el módulo miente y nadie lo nota.
