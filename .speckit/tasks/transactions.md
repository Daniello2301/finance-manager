# Task Breakdown: Transacciones

**Specification**: `.speckit/specs/transactions.md`
**Plan**: `.speckit/plans/transactions.md`
**User Stories Covered**: [US1]-[US6] (US7 fuera de alcance)

---

## Phase 0: Modelo

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T300] | Confirmar `Account` y `Category` implementados (`findForUser` disponible en ambos) | 0.2d | - | - | | ✅ |
| [T309.5] | Crear `src/lib/test-utils/mongoMemoryReplSet.ts` (`startTestReplSet`/`stopTestReplSet`, spike confirmó que `session.withTransaction()` funciona localmente vía `MongoMemoryReplSet`) | 0.3d | - | [T300] | | ✅ |
| [T301] | [UNIT TEST] Tests fallando para schema `Transaction` (validación, los 4 índices compuestos) | 0.5d | [P] | [T300] | | ✅ |
| [T302] | Crear modelo `Transaction` (`src/lib/models/Transaction.ts`) | 0.5d | - | [T301] | | ✅ |
| [T303] | Tests de modelo pasan | 0.2d | - | [T302] | | ✅ |

## Phase 1: Servicio de Transacciones Atómicas (núcleo técnico)

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T310] | [UNIT TEST] Tests fallando: `createTransaction()` crea doc + actualiza `Account.currentBalance` atómicamente | 0.7d | - | [T303] | | ✅ |
| [T311] | [US1] Implementar `createTransaction()` en `src/lib/services/transactions.ts` | 0.8d | - | [T310] | | ✅ |
| [T312] | [UNIT TEST] Tests fallando: fallo simulado a mitad de la transacción Mongo no deja balance inconsistente | 0.5d | - | [T311] | | ✅ |
| [T313] | Test de atomicidad pasa | 0.2d | - | [T312] | | ✅ |
| [T314] | [UNIT TEST] Tests fallando: `updateTransaction()` — solo monto, solo cuenta, solo tipo, monto+cuenta, tipo+cuenta (ampliado en sesión, ver plan) | 1d | - | [T313] | | ✅ |
| [T315] | [US3] Implementar `updateTransaction()` | 1d | - | [T314] | | ✅ |
| [T316] | [UNIT TEST] Test fallando: `deleteTransaction()` revierte delta | 0.3d | [P] | [T313] | | ✅ |
| [T317] | [US4] Implementar `deleteTransaction()` | 0.3d | - | [T316] | | ✅ |
| [T318] | Todos los tests del servicio pasan | 0.3d | - | [T315],[T317] | | ✅ |

## Phase 2: API

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T320] | [UNIT TEST] Tests fallando para Zod schemas de transacciones (incl. `listTransactionsQuerySchema` nuevo y validación de formato ObjectId) | 0.3d | [P] | [T303] | | ✅ |
| [T321] | Implementar `src/lib/validation/transactions.ts` | 0.3d | - | [T320] | | ✅ |
| [T322] | [UNIT TEST] Tests fallando: `GET /api/transactions` (filtros + paginación) | 0.7d | [P] | [T321] | | ✅ |
| [T323] | [US2] Implementar listado con filtros `accountId,categoryId,type,dateFrom,dateTo` + paginación | 1d | - | [T322] | | ✅ |
| [T324] | [UNIT TEST] Tests fallando: `POST /api/transactions` (incl. validación de pertenencia de accountId/categoryId) | 0.5d | [P] | [T318],[T321] | | ✅ |
| [T325] | [US1] Implementar `POST` sobre `createTransaction()` | 0.5d | - | [T324] | | ✅ |
| [T326] | [UNIT TEST] Tests fallando: `GET/PATCH/DELETE /api/transactions/[id]` | 0.5d | [P] | [T318] | | ✅ |
| [T327] | [US3][US4] Implementar `[id]/route.ts` sobre `updateTransaction()`/`deleteTransaction()` (incl. GET) | 0.7d | - | [T326] | | ✅ |

## Phase 3: Frontend

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T329.5] | Instalar `sweetalert2`, crear `src/lib/notifications.ts` (`confirmAction`/`notifySuccess`/`notifyError`) — primera dependencia nueva del proyecto fuera de shadcn, usada para confirmar el borrado permanente de una transacción | 0.3d | - | [T327] | | ✅ |
| [T330] | [US2] `TransactionList.tsx` + `TransactionRow.tsx` (React Query, paginación); incluye `useTransactions.ts`, `transactionFilters.store.ts`, `transactionModal.store.ts` como prerequisitos plegados en esta tarea | 1d | [P] | [T329.5] | | ✅ |
| [T331] | [US2] `TransactionFilters.tsx` (selects propios con opción "Todas", no `AccountSelect`/`CategorySelect`) | 0.7d | [P] | [T330] | | ✅ |
| [T332] | [US1][US3][US5] `TransactionForm.tsx` (usa `AccountSelect`/`CategorySelect` vía `Controller` de react-hook-form) | 1d | - | [T325],[T327] | | ✅ |
| [T333] | Página `src/app/dashboard/transactions/page.tsx` | 0.3d | - | [T330],[T332] | | ✅ |

## Phase 4: Integración

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T340] | Test de integración: crear → editar monto → editar cuenta → borrar, verificando saldo en cada paso (Escenarios 1-5 de la spec) | 1d | - | [T333] | | ✅ backend (incl. contra Atlas real); frontend cubierto por tests automatizados + smoke test de compilación (`next dev`) — sin click-through manual en navegador, sin herramienta de browser disponible en esta sesión |
| [T341] | Verificar aislamiento multi-tenant | 0.3d | - | [T340] | | ✅ |
| [T342] | Verificar cobertura >80%, con énfasis en `src/lib/services/transactions.ts` | 0.3d | - | [T341] | | ✅ (97.62% general, 92.85% en transactions.ts) |

---

## Legend
Igual que módulos anteriores.

## Critical Path
```
[T300] → [T301] → [T302] → [T303] → [T310] → [T311] → [T312] → [T313]
→ [T314] → [T315] → [T318] → [T322] → [T323] → [T324] → [T325]
→ [T330] → [T332] → [T333] → [T340] → [T341] → [T342]
```
**Duración estimada**: ~11 días secuenciales, ~8-9 días con paralelización — el módulo más largo de Fase 1

**Next Task**: Módulo de Transacciones completo (backend + frontend). Siguiente: `recompute-balance` de Cuentas u otro módulo del roadmap.
**Riesgo principal**: Fase 1 (servicio atómico) concentra el mayor riesgo técnico de todo el MVP — no comprimir su tiempo de testing.
