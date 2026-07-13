# Implementation Plan: Categorías

**Specification**: `.speckit/specs/categories.md`
**User Stories Covered**: US1-US6
**Tech Stack**: Next.js 16, Mongoose, Zod, react-hook-form, React Query

---

## Phase 0: Research & Validation

### Constitution Check
- ✅ Copias por usuario (no tabla global) — mantiene queries `{userId}` simples (Principio 8)
- ✅ No borrado duro — `isArchived` porque `Transaction` referencia `Category`
- ✅ Sin dependencias nuevas

### Technical Research
| Question | Answer | Confidence |
|----------|--------|-----------|
| ¿Dónde vive el seed de categorías por defecto? | `src/lib/seed/defaultCategories.ts`, invocado desde el handler de `POST /api/auth/signup` (requiere coordinación con la spec de Autenticación) | High |
| ¿El seed corre dentro de la misma transacción Mongo que crea el `User`? | Sí — mismo patrón `session.withTransaction()`: crea `User` + inserta las ~20 categorías en un solo `insertMany` con `session` | High |
| ¿Cómo se evita duplicar nombres al sembrar? | No aplica — el seed corre una sola vez, justo tras crear el usuario, antes de que existan otras categorías | High |

### Project Structure Review
- **Depende de**: el endpoint de signup ya existente en la spec `authentication.md` (`src/app/api/auth/signup/route.ts`) — este plan **modifica** ese archivo para invocar el seed, no lo duplica
- **Bloquea a**: Transacciones y Presupuestos (ambos referencian `categoryId`)

---

## Phase 1: Design & Architecture

### Database Schema (Mongoose)

`src/lib/models/Category.ts`
```typescript
interface ICategory extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  type: 'income' | 'expense'
  icon?: string
  color?: string
  isDefault: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

const categorySchema = new Schema<ICategory>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  icon: String,
  color: String,
  isDefault: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true })

categorySchema.index({ userId: 1, type: 1, isArchived: 1 })
categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true })

categorySchema.statics.findForUser = function (userId, filter = {}) {
  return this.find({ ...filter, userId })
}
```

### Seed Module

`src/lib/seed/defaultCategories.ts` — exporta `DEFAULT_CATEGORIES` (ver spec) y `seedDefaultCategories(userId, session)`:
```typescript
export async function seedDefaultCategories(userId, session) {
  const docs = [
    ...DEFAULT_CATEGORIES.income.map(name => ({ userId, name, type: 'income', isDefault: true })),
    ...DEFAULT_CATEGORIES.expense.map(name => ({ userId, name, type: 'expense', isDefault: true }))
  ]
  await Category.insertMany(docs, { session })
}
```

**Integración con signup**: en `src/app/api/auth/signup/route.ts`, dentro del mismo `session.withTransaction()` que crea el `User`, llamar `await seedDefaultCategories(user._id, session)` antes de confirmar la transacción.

### API Routes Structure

```
src/app/api/categories/
├── route.ts              # GET (list, filtros type/includeArchived), POST (create)
├── [id]/
│   └── route.ts          # PATCH, DELETE (archive)
└── __tests__/
```

### Zod Schemas (`src/lib/validation/categories.ts`)
```typescript
const CreateCategorySchema = z.object({
  name: z.string().min(1).max(40),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  icon: z.string().optional()
})
const UpdateCategorySchema = CreateCategorySchema.omit({ type: true }).partial()
```
`type` no es editable tras crear — cambiar el tipo de una categoría con transacciones históricas rompería reportes por tipo (regla no explícita en la spec pero necesaria para consistencia con Presupuestos; documentar como decisión de este plan).

### Component Hierarchy

```
src/app/(dashboard)/categories/
├── page.tsx
└── components/
    ├── CategoryList.tsx        # tabs Ingreso/Gasto
    ├── CategoryForm.tsx
    └── CategorySelect.tsx      # reutilizado en Transacciones y Presupuestos (Presupuestos filtra type='expense')
```

---

## Phase 2: Implementation

### Complexity Assessment

| Aspect | Complexity | Justification |
|--------|-----------|----------------|
| Database | Baja | Schema simple |
| Seed | Media | Requiere tocar el flujo de signup existente dentro de una transacción compartida |
| API | Baja | CRUD estándar |
| Frontend | Baja | `CategorySelect` es la pieza más reutilizada del proyecto |

### Implementation Order (Test-First)

1. **Modelo** (0.5d): `Category.ts` + tests de índice único `userId+name+type`
2. **Seed module** (0.5d): test de `seedDefaultCategories` (crea las ~20 categorías esperadas)
3. **Integrar seed en signup** (0.5d): test de integración — signup exitoso deja categorías creadas
4. **Zod schemas** (0.5d)
5. **API — crear/listar/editar/archivar** (1.5d): test-first por endpoint
6. **Frontend — CategoryList + CategoryForm** (1d)
7. **Frontend — CategorySelect genérico** (0.5d)

### Critical Dependencies
- Modificar `src/app/api/auth/signup/route.ts` (de la spec de Autenticación) — coordinar para no romper sus tests existentes; agregar el seed como paso adicional dentro de la misma transacción, no como llamada separada post-commit (evita usuarios sin categorías si el seed falla)

---

## Phase 3: Testing & Validation

**Unit**: schema, unicidad de nombre por tipo, contenido exacto del seed
**Integration**: signup → usuario tiene categorías; archivar categoría con transacciones no las afecta
**E2E manual**: signup → ver categorías por defecto en el selector de una transacción nueva → crear categoría personalizada → aparece inmediatamente

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Seed falla a mitad de camino, usuario queda sin categorías | Baja | Alto | `insertMany` dentro de la misma `session.withTransaction()` del signup — si falla, se revierte todo (usuario tampoco se crea) |
| Cambiar `type` de una categoría con historial rompe reportes | Media | Medio | `type` inmutable tras crear (decisión de este plan, ver Zod schema) |

---

## Timeline & Resources
- **Duración estimada**: 4-5 días
- **Bloquea**: Transacciones y Presupuestos

---

## Notes & Decisions
1. El seed se implementa como parte de este módulo pero se **integra** en el endpoint de signup existente — requiere tocar código de la spec de Autenticación ya implementada.
2. `type` se vuelve inmutable tras la creación (extensión razonable no explícita en la spec original, documentada aquí).
