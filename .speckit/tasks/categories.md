# Task Breakdown: Categorías

**Specification**: `.speckit/specs/categories.md`
**Plan**: `.speckit/plans/categories.md`
**User Stories Covered**: [US1]-[US6]

---

## Phase 0: Modelo y Seed

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T199.5] | Agregar `ConflictError` (409) + backstop de código Mongo `11000` a `src/lib/errors.ts` | 0.2d | - | - | | ✅ |
| [T200] | [UNIT TEST] Tests fallando para schema `Category` (unicidad `userId+name+type`) | 0.5d | [P] | [T199.5] | | ✅ |
| [T201] | Crear modelo `Category` (`src/lib/models/Category.ts`) + `findForUser` | 0.5d | - | [T200] | | ✅ |
| [T202] | Tests de modelo pasan | 0.2d | - | [T201] | | ✅ |
| [T203] | [UNIT TEST] Test fallando: `seedDefaultCategories()` crea el set esperado (~4 ingreso, ~16 gasto) | 0.3d | [P] | [T202] | | ✅ |
| [T204] | [US1] Implementar `src/lib/seed/defaultCategories.ts` | 0.3d | - | [T203] | | ✅ |

## Phase 1: Integración con Signup

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T210] | [UNIT TEST] Test de integración fallando: signup exitoso deja categorías creadas | 0.5d | - | [T204] | | ✅ |
| [T211] | [US1] Modificar `src/app/api/auth/signup/route.ts`: tras `User.create()`, llamar `seedDefaultCategories`; si falla, borrar el `User` recién creado (acción compensatoria, no transacción Mongo — decisión de sesión, ver plan) | 0.5d | - | [T210] | | ✅ |
| [T212] | Test de integración pasa; verificar que tests existentes de signup siguen pasando (no regresión) | 0.3d | - | [T211] | | ✅ |

## Phase 2: API y Zod

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T220] | [UNIT TEST] Tests fallando para Zod schemas de categorías | 0.3d | [P] | [T202] | | ✅ |
| [T221] | Implementar `src/lib/validation/categories.ts` | 0.3d | - | [T220] | | ✅ |
| [T222] | [UNIT TEST] Tests fallando: `GET/POST /api/categories` | 0.5d | [P] | [T221] | | ✅ |
| [T223] | [US2][US3] Implementar `route.ts` | 0.7d | - | [T222] | | ✅ |
| [T224] | [UNIT TEST] Tests fallando: `PATCH/DELETE /api/categories/[id]` | 0.3d | [P] | [T223] | | ✅ |
| [T225] | [US4] Implementar `[id]/route.ts` (editar, archivar) | 0.5d | - | [T224] | | ✅ |

## Phase 3: Frontend

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T230] | [US2] `CategoryList.tsx` (toggle ingreso/gasto de 2 botones, no tabs — decisión de sesión) | 0.7d | [P] | [T225] | | ✅ |
| [T231] | [US3][US4] `CategoryForm.tsx` (sin color/icon en la UI — decisión de sesión, campos siguen en el schema) | 0.7d | [P] | [T225] | | ✅ |
| [T232] | `CategorySelect.tsx` genérico (reutilizable por Transacciones/Presupuestos) | 0.5d | - | [T230] | | ✅ |
| [T233] | Página `src/app/dashboard/categories/page.tsx` | 0.3d | - | [T230],[T231] | | ✅ |

## Phase 4: Integración

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T240] | E2E manual: signup → ver categorías por defecto → crear personalizada → archivar | 0.3d | - | [T233] | | ✅ |
| [T241] | Verificar cobertura >80% | 0.2d | - | [T240] | | ✅ (97.84%) |

---

## Legend
Igual que `tasks/authentication.md` / `tasks/accounts.md`.

## Critical Path
```
[T200] → [T201] → [T202] → [T203] → [T204] → [T210] → [T211] → [T212]
→ [T220] → [T222] → [T223] → [T230] → [T232] → [T233] → [T240] → [T241]
```
**Duración estimada**: ~5 días secuenciales, ~3-4 días con paralelización

**Next Task**: [T200]
**Nota de dependencia**: [T211] toca código de la spec de Autenticación ya implementada — coordinar para no romper sus tests.
