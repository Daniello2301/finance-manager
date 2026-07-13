# Task Breakdown: Dashboard y Reportes

**Specification**: `.speckit/specs/dashboard.md`
**Plan**: `.speckit/plans/dashboard.md`
**User Stories Covered**: [US1]-[US6] (US7 fuera de alcance)

---

## Phase 0: Setup

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T500] | Confirmar Cuentas, Categorías, Transacciones y Presupuestos implementados con datos de prueba | 0.2d | - | - | | ✅ |

## Phase 1: Servicios de Agregación

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T510] | [UNIT TEST] Test fallando: `getBalanceSummary()` agrupa correctamente por moneda | 0.5d | [P] | [T500] | | ✅ |
| [T511] | [US1] Implementar `getBalanceSummary()` en `src/lib/services/dashboard.ts` | 0.5d | - | [T510] | | ✅ |
| [T512] | [UNIT TEST] Test fallando: `getMonthlyTrend()` — incluye meses sin transacciones como 0, no los omite | 0.7d | [P] | [T500] | | ✅ |
| [T513] | [US2][US5] Implementar `getMonthlyTrend()` | 0.7d | - | [T512] | | ✅ |
| [T514] | [UNIT TEST] Test fallando: `getCategoryBreakdown()` — orden descendente, `$lookup` de nombre de categoría | 0.5d | [P] | [T500] | | ✅ |
| [T515] | [US3] Implementar `getCategoryBreakdown()` | 0.5d | - | [T514] | | ✅ |

## Phase 2: API

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T520] | [UNIT TEST] Tests fallando: `GET /api/dashboard/summary` (balance + top presupuestos vía `getBudgetProgress`) | 0.5d | [P] | [T511] | | ✅ |
| [T521] | [US1][US4] Implementar `summary/route.ts` | 0.5d | - | [T520] | | ✅ |
| [T522] | [UNIT TEST] Test fallando: `GET /api/dashboard/trend?months=` | 0.3d | [P] | [T513] | | ✅ |
| [T523] | [US2][US5] Implementar `trend/route.ts` | 0.3d | - | [T522] | | ✅ |
| [T524] | [UNIT TEST] Test fallando: `GET /api/dashboard/category-breakdown?period=` | 0.3d | [P] | [T515] | | ✅ |
| [T525] | [US3] Implementar `category-breakdown/route.ts` | 0.3d | - | [T524] | | ✅ |
| [T526] | [UNIT TEST] Test fallando: `GET /api/dashboard/recent-transactions?limit=` | 0.3d | [P] | [T500] | | ✅ |
| [T527] | [US6] Implementar `recent-transactions/route.ts` (reutiliza query de listado de Transacciones) | 0.3d | - | [T526] | | ✅ |

## Phase 3: Frontend

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T530] | [US1] `BalanceSummaryCard.tsx` | 0.5d | [P] | [T521] | | ✅ |
| [T531] | [US2][US5] `TrendChart.tsx` (Recharts, selector de rango) | 1d | [P] | [T523] | | ✅ |
| [T532] | [US3] `CategoryBreakdownChart.tsx` (Recharts) | 1d | [P] | [T525] | | ✅ |
| [T533] | [US4] `BudgetSummaryWidget.tsx` | 0.5d | [P] | [T521] | | ✅ |
| [T534] | [US6] `RecentTransactionsWidget.tsx` | 0.5d | [P] | [T527] | | ✅ |
| [T535] | `EmptyDashboardState.tsx` | 0.3d | - | [T530] | | ✅ |
| [T536] | Página `src/app/dashboard/page.tsx` ensamblando todos los widgets | 0.5d | - | [T530]-[T535] | | ✅ |

## Phase 4: Integración

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T540] | Test de integración: usuario con datos de varios meses ve tendencia/distribución correctas (Escenarios 1-3) | 0.5d | - | [T536] | | ✅ |
| [T541] | Test de integración: usuario nuevo sin datos ve `EmptyDashboardState`, sin errores 500 (Escenario 4) | 0.3d | - | [T540] | | ✅ |
| [T542] | Verificar cobertura >80% | 0.2d | - | [T541] | | ✅ |

---

## Legend
Igual que módulos anteriores.

## Critical Path
```
[T500] → [T510] → [T511] → [T520] → [T521] → [T530] → [T535] → [T536]
→ [T540] → [T541] → [T542]
```
**Duración estimada**: ~7 días secuenciales, ~6-7 días con paralelización (el frontend tiene alto grado de paralelismo entre widgets)

**Next Task**: Ninguna — Dashboard completo. **Fase 1 (MVP) terminada**: Autenticación, Cuentas, Categorías, Transacciones, Presupuestos y Dashboard, todos backend + frontend. Siguiente hito: Fase 2 (Gastos recurrentes, Metas de ahorro, Multi-moneda) — aún sin specs.
