# Task Breakdown: Presupuestos por Categoría

**Specification**: `.speckit/specs/budgets.md`
**Plan**: `.speckit/plans/budgets.md`
**User Stories Covered**: [US1]-[US5] (US6 fuera de alcance)

---

## Phase 0: Modelo

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T400] | Confirmar `Category` y `Transaction` implementados | 0.2d | - | - | | ✅ |
| [T401] | [UNIT TEST] Tests fallando para schema `Budget` (unicidad `userId+categoryId+periodKey`) | 0.5d | [P] | [T400] | | ✅ |
| [T402] | Crear modelo `Budget` (`src/lib/models/Budget.ts`) | 0.5d | - | [T401] | | ✅ |
| [T403] | Tests de modelo pasan | 0.2d | - | [T402] | | ✅ |

## Phase 1: Servicio de Agregación

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T410] | [UNIT TEST] Test fallando: `periodRange('YYYY-MM')` calcula límites de mes correctos (casos borde día 1/último día) | 0.3d | [P] | [T403] | | ✅ |
| [T411] | Implementar `periodRange()` en `src/lib/services/budgets.ts` | 0.3d | - | [T410] | | ✅ |
| [T412] | [UNIT TEST] Test fallando: `getBudgetProgress()` agrega gasto real correctamente por categoría/mes | 0.7d | - | [T411] | | ✅ |
| [T413] | [US2] Implementar `getBudgetProgress()` | 0.7d | - | [T412] | | ✅ |
| [T414] | [UNIT TEST] Test fallando: `copyBudgets()` no duplica presupuestos existentes | 0.3d | [P] | [T413] | | ✅ |
| [T415] | [US5] Implementar `copyBudgets()` | 0.3d | - | [T414] | | ✅ |

## Phase 2: API

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T420] | [UNIT TEST] Tests fallando para Zod schemas de presupuestos | 0.3d | [P] | [T403] | | ✅ |
| [T421] | Implementar `src/lib/validation/budgets.ts` | 0.3d | - | [T420] | | ✅ |
| [T422] | [UNIT TEST] Tests fallando: `GET/POST /api/budgets` (incl. rechazo de categoría `type='income'`) | 0.5d | [P] | [T415],[T421] | | ✅ |
| [T423] | [US1][US2] Implementar `route.ts` (usa `getBudgetProgress`) | 0.7d | - | [T422] | | ✅ |
| [T424] | [UNIT TEST] Tests fallando: `PATCH/DELETE /api/budgets/[id]` | 0.3d | [P] | [T423] | | ✅ |
| [T425] | [US3] Implementar `[id]/route.ts` | 0.5d | - | [T424] | | ✅ |
| [T426] | [UNIT TEST] Test fallando: `POST /api/budgets/copy` | 0.3d | [P] | [T423] | | ✅ |
| [T427] | [US5] Implementar `copy/route.ts` | 0.3d | - | [T426] | | ✅ |

## Phase 3: Frontend

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T430] | [US2][US4] `BudgetList.tsx` + `BudgetProgress.tsx` (colores por umbral 80%/100%) | 1d | [P] | [T425] | | ✅ |
| [T431] | [US1][US3] `BudgetForm.tsx` (usa `CategorySelect` filtrado a `expense`) | 0.7d | [P] | [T425] | | ✅ |
| [T432] | `MonthSelector.tsx` compartido (también usado por Dashboard) | 0.5d | - | [T430] | | ✅ |
| [T433] | Página `src/app/dashboard/budgets/page.tsx` (ruta real, sin grupo `(dashboard)` — igual que Cuentas/Categorías/Transacciones) | 0.3d | - | [T430],[T431],[T432] | | ✅ |

## Phase 4: Integración

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T440] | Test de integración: crear presupuesto → registrar transacción de esa categoría → progreso se actualiza (Escenario 2) | 0.5d | - | [T433] | | ✅ |
| [T441] | Test de integración: copiar presupuestos del mes anterior (Escenario 4) | 0.3d | - | [T440] | | ✅ |
| [T442] | Verificar cobertura >80% | 0.2d | - | [T441] | | ✅ |

---

## Legend
Igual que módulos anteriores.

## Critical Path
```
[T400] → [T401] → [T402] → [T403] → [T410] → [T411] → [T412] → [T413]
→ [T422] → [T423] → [T430] → [T432] → [T433] → [T440] → [T441] → [T442]
```
**Duración estimada**: ~7 días secuenciales, ~5-6 días con paralelización

**Next Task**: Módulo de Presupuestos completo (backend + frontend). Siguiente: Dashboard (reutiliza `getBudgetProgress` y `MonthSelector.tsx`).
