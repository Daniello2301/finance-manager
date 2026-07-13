# Implementation Plan: Presupuestos por Categoría

**Specification**: `.speckit/specs/budgets.md`
**User Stories Covered**: US1-US6 (US6 fuera de alcance MVP)
**Tech Stack**: Next.js 16, Mongoose (agregaciones), Zod, react-hook-form, React Query

---

## Phase 0: Research & Validation

### Constitution Check
- ✅ Aislamiento multi-tenant vía `userId`
- ✅ Dinero como enteros en unidades menores
- ✅ No premature optimization: el gasto real **no** se denormaliza, se agrega en cada lectura (justificado — Presupuestos se consulta con mucha menor frecuencia que `Account.currentBalance`)

### Technical Research
| Question | Answer | Confidence |
|----------|--------|-----------|
| ¿Cómo se calcula `periodStart`/`periodEnd` desde `periodKey='YYYY-MM'`? | `periodStart = new Date(year, month-1, 1)`, `periodEnd = new Date(year, month, 1)` (exclusivo) — usado como rango en el `$match` de la agregación | High |
| ¿La agregación de gasto real corre en cada `GET /api/budgets`? | Sí — un solo `Transaction.aggregate()` por request, agrupando por `categoryId`, no N+1 por presupuesto | High |
| ¿Qué pasa con presupuestos de categorías archivadas? | Se siguen mostrando (el presupuesto y el gasto histórico no desaparecen), pero la categoría no aparece en `CategorySelect` para crear presupuestos nuevos | Medium |

### Project Structure Review
- **Depende de**: `Category` (tipo `expense`) y `Transaction` deben estar implementados
- **Reutilizado por**: Dashboard (`BudgetSummaryWidget` reutiliza `getBudgetProgress`)

---

## Phase 1: Design & Architecture

### Database Schema (Mongoose)

`src/lib/models/Budget.ts`
```typescript
interface IBudget extends Document {
  userId: mongoose.Types.ObjectId
  categoryId: mongoose.Types.ObjectId
  periodKey: string
  periodStart: Date
  limitAmount: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

const budgetSchema = new Schema<IBudget>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  periodKey: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  periodStart: { type: Date, required: true },
  limitAmount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true }
}, { timestamps: true })

budgetSchema.index({ userId: 1, categoryId: 1, periodKey: 1 }, { unique: true })
budgetSchema.index({ userId: 1, periodKey: 1 })
```

### Servicio de Agregación

`src/lib/services/budgets.ts`
```typescript
export async function getBudgetProgress(userId: string, periodKey: string) {
  const budgets = await Budget.findForUser(userId, { periodKey })
  const { periodStart, periodEnd } = periodRange(periodKey)

  const spentByCategory = await Transaction.aggregate([
    { $match: { userId, type: 'expense', date: { $gte: periodStart, $lt: periodEnd } } },
    { $group: { _id: '$categoryId', spent: { $sum: '$amount' } } }
  ])
  const spentMap = new Map(spentByCategory.map(s => [s._id.toString(), s.spent]))

  return budgets.map(b => ({
    ...b.toObject(),
    spentAmount: spentMap.get(b.categoryId.toString()) ?? 0,
    percentUsed: Math.round(((spentMap.get(b.categoryId.toString()) ?? 0) / b.limitAmount) * 100)
  }))
}

export async function copyBudgets(userId: string, fromPeriod: string, toPeriod: string) {
  const source = await Budget.findForUser(userId, { periodKey: fromPeriod })
  const existingCategoryIds = new Set(
    (await Budget.findForUser(userId, { periodKey: toPeriod })).map(b => b.categoryId.toString())
  )
  const toCreate = source
    .filter(b => !existingCategoryIds.has(b.categoryId.toString()))
    .map(b => ({ userId, categoryId: b.categoryId, periodKey: toPeriod, periodStart: periodRange(toPeriod).periodStart, limitAmount: b.limitAmount, currency: b.currency }))
  return Budget.insertMany(toCreate)
}
```

### API Routes Structure

```
src/app/api/budgets/
├── route.ts            # GET (?period=YYYY-MM, con progreso), POST (create)
├── [id]/
│   └── route.ts        # PATCH, DELETE
├── copy/
│   └── route.ts        # POST { fromPeriod, toPeriod }
└── __tests__/
```

### Zod Schemas (`src/lib/validation/budgets.ts`)
```typescript
const CreateBudgetSchema = z.object({
  categoryId: z.string(),
  periodKey: z.string().regex(/^\d{4}-\d{2}$/),
  limitAmount: z.number().int().positive()
})
const UpdateBudgetSchema = z.object({ limitAmount: z.number().int().positive() })
const CopyBudgetsSchema = z.object({
  fromPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  toPeriod: z.string().regex(/^\d{4}-\d{2}$/)
})
```
Validación adicional en la ruta: `categoryId` debe pertenecer al usuario y ser `type='expense'` (404/422 si no).

### Component Hierarchy

```
src/app/(dashboard)/budgets/
├── page.tsx
└── components/
    ├── BudgetList.tsx
    ├── BudgetForm.tsx        # usa CategorySelect filtrado a type='expense'
    ├── BudgetProgress.tsx    # barra de progreso, color por umbral
    └── MonthSelector.tsx     # compartido con Dashboard
```

---

## Phase 2: Implementation

### Complexity Assessment

| Aspect | Complexity | Justification |
|--------|-----------|----------------|
| Database | Baja | Schema simple, único índice compuesto relevante |
| Agregación de progreso | Media | Un solo `$match + $group`, sin joins complejos |
| API | Baja-Media | Endpoint de copia requiere lógica de "solo insertar faltantes" |
| Frontend | Baja | `MonthSelector` se construye pensando en reutilizarse en Dashboard |

### Implementation Order (Test-First)

1. **Modelo `Budget`** (0.5d) + tests de unicidad `userId+categoryId+periodKey`
2. **`periodRange()` util + `getBudgetProgress`** (1d): tests fallando con datos de transacciones fixture → implementación → tests pasan
3. **`copyBudgets`** (0.5d): test de "no duplica existentes"
4. **Zod schemas + validación categoryId type='expense'** (0.5d)
5. **API routes** (1d)
6. **Frontend — BudgetList + BudgetProgress** (1d)
7. **Frontend — BudgetForm + MonthSelector** (1d)
8. **Integración**: crear presupuesto → registrar transacción de esa categoría → progreso se actualiza (0.5d)

### Critical Dependencies
- `Category` y `Transaction` implementados

---

## Phase 3: Testing & Validation

**Unit**: `periodRange()`, cálculo de `percentUsed`, unicidad de schema
**Integration**: progreso refleja transacciones reales del período correcto (no cuenta transacciones de otros meses); copiar presupuestos no duplica; rechazo de presupuesto para categoría de tipo `income`
**E2E manual**: crear presupuesto → registrar gastos → ver barra de progreso actualizarse → copiar al mes siguiente

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Rango de fechas del período mal calculado (off-by-one en el mes) | Media | Alto | Test unitario explícito de `periodRange()` con casos límite (día 1 y último día del mes) |
| Agregación lenta si un usuario tiene miles de transacciones | Baja (escala de app personal) | Bajo | Índice `userId+type+date` ya cubre el `$match`; no se optimiza más sin evidencia de problema real (Principio 4) |

---

## Timeline & Resources
- **Duración estimada**: 5-6 días
- **Bloquea**: Dashboard (widget de resumen de presupuestos reutiliza `getBudgetProgress`)

---

## Notes & Decisions
1. `getBudgetProgress` se diseña para ser reutilizada directamente por el endpoint de resumen del Dashboard, sin duplicar la lógica de agregación.
2. Se decide explícitamente NO denormalizar `spentAmount` en `Budget` — se recalcula en cada lectura porque la frecuencia de consulta no lo justifica (a diferencia de `Account.currentBalance`).
