# Task Breakdown: Cuentas y Tarjetas

**Specification**: `.speckit/specs/accounts.md`
**Plan**: `.speckit/plans/accounts.md`
**User Stories Covered**: [US1]-[US7]

---

## Phase 0: Setup

`src/lib/api-auth.ts` y `src/lib/money.ts` NO existían (ninguna sesión anterior los creó pese a estar listados como "convenciones transversales") — se construyen aquí como prerequisitos reales, igual que `src/lib/db.ts` se construyó durante Autenticación. Se agrega además `src/lib/errors.ts` (no listado originalmente; Transacciones ya asume una clase `NotFoundError` y las rutas de Cuentas necesitan 404/422 consistentes).

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T099] | Crear `src/lib/errors.ts` (`UnauthorizedError`/`NotFoundError`/`ValidationError` + `errorResponse()`) | 0.3d | - | - | | ✅ |
| [T100] | Crear `src/lib/api-auth.ts` (`requireSession()`, reutiliza `getServerSession(authOptions)` de `ProtectedRoute.tsx`) | 0.3d | - | [T099] | | ✅ |
| [T100.5] | Crear `src/lib/money.ts` (`toMinorUnits`/`fromMinorUnits`/`formatMoney`, mapa de exponentes solo `COP` por ahora) | 0.3d | [P] | - | | ✅ |

## Phase 1: Modelo y Validación

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T101] | [UNIT TEST] Tests fallando para schema `Account` (validación, índice único implícito) | 0.5d | [P] | [T100] | | ✅ |
| [T102] | Crear modelo `Account` (`src/lib/models/Account.ts`) + `findForUser` estático | 0.5d | - | [T101] | | ✅ |
| [T103] | Tests de modelo pasan | 0.2d | - | [T102] | | ✅ |
| [T104] | [UNIT TEST] Tests fallando para Zod `CreateAccountSchema`/`UpdateAccountSchema` | 0.3d | [P] | [T100] | | ✅ |
| [T105] | Implementar schemas Zod (`src/lib/validation/accounts.ts`), incl. regla `creditLimit` solo en `credit_card` | 0.3d | - | [T104] | | ✅ |

## Phase 2: API

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T110] | [UNIT TEST] Tests fallando: `GET/POST /api/accounts` | 0.5d | [P] | [T103],[T105] | | ✅ |
| [T111] | [US1][US2] Implementar `route.ts` (listar con `includeArchived`, crear) | 1d | - | [T110] | | ✅ |
| [T112] | [UNIT TEST] Tests fallando: `PATCH/DELETE /api/accounts/[id]`, incl. rechazo de cambio de `currency` | 0.5d | [P] | [T111] | | ✅ |
| [T113] | [US3][US4] Implementar `[id]/route.ts` (editar, archivar; también incluye GET) | 1d | - | [T112] | | ✅ |
| [T114] | [UNIT TEST] Test fallando: `POST /api/accounts/[id]/recompute-balance` | 0.3d | [P] | [T111] | | ✅ (desbloqueado 2026-07-12 al completarse el modelo `Transaction`) |
| [T115] | [US6] Implementar endpoint de recálculo de saldo | 0.5d | - | [T114] | | ✅ |
| [T116] | Todos los tests de API pasan | 0.3d | - | [T113] | | ✅ |

## Phase 3: Frontend

Ruta real de páginas: `src/app/dashboard/accounts/` (no `(dashboard)/accounts/` como dice el plan — el dashboard construido en Autenticación es un directorio plano `src/app/dashboard/`, ya envuelto en `ProtectedRoute`+`Navbar` vía su propio `layout.tsx`, no hace falta uno nuevo).

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T119.5] | Extender `src/app/providers.tsx` con `QueryClientProvider`; instalar `dialog` de shadcn | 0.3d | - | [T116] | | ✅ |
| [T120] | [US2] `AccountList.tsx` + `AccountCard.tsx` (React Query, `src/hooks/useAccounts.ts`) | 1d | [P] | [T119.5] | | ✅ |
| [T120.5] | [US6] Botón "Recalcular saldo" en `AccountCard.tsx` (`useRecomputeBalance` en `useAccounts.ts`) | 0.2d | - | [T115],[T120] | | ✅ (2026-07-12) |
| [T121] | [US1][US3] `AccountForm.tsx` (modal, react-hook-form + Zod, crear/editar; `src/stores/accountModal.store.ts` con Zustand) | 1d | [P] | [T119.5] | | ✅ |
| [T122] | [US5] `AccountSelect.tsx` genérico (`src/components/`, reutilizable por Transacciones/Presupuestos) | 0.5d | - | [T120] | | ✅ |
| [T123] | Página `src/app/dashboard/accounts/page.tsx` | 0.3d | - | [T120],[T121] | | ✅ |

## Phase 4: Integración

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T130] | Test de integración: crear → editar → archivar → recompute-balance | 0.5d | - | [T123] | | ✅ |
| [T131] | Verificar aislamiento multi-tenant (usuario A no ve/edita cuentas de usuario B) | 0.3d | - | [T130] | | ✅ |
| [T132] | Verificar cobertura >80% | 0.2d | - | [T131] | | ✅ (98.32%) |

---

## Legend
| Symbol | Meaning |
|--------|---------|
| [TXXX] | Task ID | [P] | Puede correr en paralelo | [UNIT TEST] | Test antes que implementación | Status | ⬜ Pendiente 🔄 En progreso ✅ Completo |

## Critical Path
```
[T100] → [T101] → [T102] → [T103] → [T110] → [T111] → [T112] → [T113] → [T116]
→ [T120] → [T122] → [T123] → [T130] → [T131] → [T132]
```
**Duración estimada**: ~6 días secuenciales, ~4 días con paralelización

**Next Task**: [T100]
