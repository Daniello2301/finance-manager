# Implementation Plan: Transacciones

**Specification**: `.speckit/specs/transactions.md`
**User Stories Covered**: US1-US7 (US7 fuera de alcance MVP)
**Tech Stack**: Next.js 16, Mongoose (sesiones/transacciones), Zod, react-hook-form, React Query

---

## Phase 0: Research & Validation

### Constitution Check
- ✅ `Account.currentBalance` denormalizado, actualizado con `session.withTransaction()` (Principio 4, 8, 9)
- ✅ Dinero como enteros en unidades menores
- ✅ Aislamiento multi-tenant vía `userId` + validación de que `accountId`/`categoryId` pertenecen al usuario

### Technical Research
| Question | Answer | Confidence |
|----------|--------|-----------|
| ¿MongoDB Atlas (free tier M0 incluido) soporta transacciones multi-documento? | Sí, siempre que el clúster sea un replica set — Atlas siempre lo es, incluido M0 | High |
| ¿Cómo se calcula el `delta` a aplicar al balance? | `create`: `type==='income' ? +amount : -amount`. `update`: revertir delta viejo + aplicar delta nuevo (pueden ser dos cuentas distintas). `delete`: revertir delta original | High |
| ¿Qué pasa si `accountId` cambia en un `PATCH`? | Se revierte el delta en la cuenta original y se aplica en la nueva, ambas escrituras dentro de la misma sesión | High |
| ¿El servicio se expone como función reutilizable? | Sí — `src/lib/services/transactions.ts`, usado por las rutas API de este módulo y (Fase 2) por el generador de Gastos Recurrentes | High |

### Project Structure Review
- **Depende de**: `Account` (spec/plan `accounts.md`) y `Category` (spec/plan `categories.md`) deben estar implementados primero
- **Bloquea a**: Presupuestos (agrega sobre `Transaction`) y Dashboard (agrega sobre `Transaction`)

---

## Phase 1: Design & Architecture

### Database Schema (Mongoose)

`src/lib/models/Transaction.ts`
```typescript
interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId
  accountId: mongoose.Types.ObjectId
  categoryId: mongoose.Types.ObjectId
  type: 'income' | 'expense'
  amount: number
  currency: string
  date: Date
  description?: string
  recurringTransactionId?: mongoose.Types.ObjectId
  savingsGoalId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const transactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String, trim: true },
  recurringTransactionId: { type: Schema.Types.ObjectId, ref: 'RecurringTransaction' },
  savingsGoalId: { type: Schema.Types.ObjectId, ref: 'SavingsGoal' }
}, { timestamps: true })

transactionSchema.index({ userId: 1, date: -1 })
transactionSchema.index({ userId: 1, accountId: 1, date: -1 })
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 })
transactionSchema.index({ userId: 1, type: 1, date: -1 })
```

### Servicio Compartido

`src/lib/services/transactions.ts`
```typescript
function signedDelta(type: 'income' | 'expense', amount: number) {
  return type === 'income' ? amount : -amount
}

export async function createTransaction(userId, input) {
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const [tx] = await Transaction.create([{ ...input, userId }], { session })
      await Account.findOneAndUpdate(
        { _id: input.accountId, userId },
        { $inc: { currentBalance: signedDelta(input.type, input.amount) } },
        { session }
      )
      return tx
    })
  } finally {
    await session.endSession()
  }
}

export async function updateTransaction(userId, id, input) {
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const existing = await Transaction.findOne({ _id: id, userId }).session(session)
      if (!existing) throw new NotFoundError()

      // revertir delta original en la cuenta original
      await Account.findOneAndUpdate(
        { _id: existing.accountId, userId },
        { $inc: { currentBalance: -signedDelta(existing.type, existing.amount) } },
        { session }
      )
      // aplicar delta nuevo en la cuenta nueva (puede ser la misma)
      await Account.findOneAndUpdate(
        { _id: input.accountId, userId },
        { $inc: { currentBalance: signedDelta(input.type, input.amount) } },
        { session }
      )
      Object.assign(existing, input)
      await existing.save({ session })
      return existing
    })
  } finally {
    await session.endSession()
  }
}

export async function deleteTransaction(userId, id) {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const existing = await Transaction.findOneAndDelete({ _id: id, userId }).session(session)
      if (!existing) throw new NotFoundError()
      await Account.findOneAndUpdate(
        { _id: existing.accountId, userId },
        { $inc: { currentBalance: -signedDelta(existing.type, existing.amount) } },
        { session }
      )
    })
  } finally {
    await session.endSession()
  }
}
```

### API Routes Structure

```
src/app/api/transactions/
├── route.ts               # GET (list, filtros + paginación), POST (create)
├── [id]/
│   └── route.ts           # GET, PATCH, DELETE
└── __tests__/
```

**GET /api/transactions** — Zod `ListTransactionsQuerySchema` extiende `ListQuerySchema` común (`page, limit, dateFrom, dateTo`) con `accountId?, categoryId?, type?`. Response `{ data, pagination }`.

### Zod Schemas (`src/lib/validation/transactions.ts`)
```typescript
const CreateTransactionSchema = z.object({
  accountId: z.string(),
  categoryId: z.string(),
  type: z.enum(['income', 'expense']),
  amount: z.number().int().positive(),
  date: z.coerce.date(),
  description: z.string().max(200).optional()
})
const UpdateTransactionSchema = CreateTransactionSchema.partial()
```
Validación adicional en la ruta (no en Zod): `accountId` y `categoryId` deben pertenecer al `userId` de la sesión (`Account.findForUser` / `Category.findForUser`) antes de llamar al servicio — 404 si no.

### Component Hierarchy

```
src/app/(dashboard)/transactions/
├── page.tsx
└── components/
    ├── TransactionList.tsx
    ├── TransactionRow.tsx
    ├── TransactionForm.tsx      # usa AccountSelect + CategorySelect
    └── TransactionFilters.tsx
```

### State Management
- **React Query**: `useTransactions(filters)` con `keepPreviousData` para paginación fluida; mutaciones invalidan `['transactions']` **y** `['accounts']` (porque el balance cambia)
- **Zustand**: estado de filtros activos en la UI (`useTransactionFiltersStore`)

---

## Phase 2: Implementation

### Complexity Assessment

| Aspect | Complexity | Justification |
|--------|-----------|----------------|
| Database | Media | Cuatro índices compuestos, todos justificados por patrones de consulta reales |
| Servicio de transacciones atómicas | **Alta** | Núcleo técnico del módulo — sesiones Mongo, reversión de delta en edición con cambio de cuenta |
| API | Media | Validación cruzada de pertenencia de `accountId`/`categoryId` |
| Frontend | Media | Filtros + paginación combinados |
| Testing | Alta | Casos de edición de monto/cuenta son los más propensos a bugs de consistencia |

### Implementation Order (Test-First)

1. **Modelo `Transaction`** (0.5d) + tests de validación e índices
2. **Servicio `transactions.ts` — create** (1.5d): tests fallando (crea transacción + actualiza balance correctamente, falla completa si el `$inc` falla) → implementación → tests pasan
3. **Servicio `transactions.ts` — update** (2d): tests fallando cubriendo (a) editar solo monto, (b) editar solo cuenta, (c) editar monto y cuenta a la vez → implementación → tests pasan
4. **Servicio `transactions.ts` — delete** (0.5d)
5. **Zod schemas + validación de pertenencia** (0.5d)
6. **API routes** (1d): wiring de las rutas sobre el servicio, tests de integración de las rutas
7. **Frontend — TransactionList + filtros + paginación** (1.5d)
8. **Frontend — TransactionForm** (1d)
9. **Integración**: crear → editar monto → editar cuenta → borrar, verificando balance de cuenta(s) en cada paso (1d)

### Critical Dependencies
- `Account` y `Category` implementados y con `findForUser()` disponible
- MongoDB replica set (transacciones multi-documento)

---

## Phase 3: Testing & Validation

**Unit**: `signedDelta()`, validación Zod, schema Mongoose
**Integration** (la parte más importante de este módulo):
- Crear transacción → balance de cuenta correcto
- Editar monto → balance correcto (delta viejo revertido, delta nuevo aplicado)
- Editar cuenta → ambas cuentas correctas
- Borrar → balance revertido
- Fallo simulado a mitad de la transacción Mongo → ni el documento ni el balance cambian (verifica atomicidad real, no solo el happy path)
- Filtros combinados (cuenta + categoría + rango de fechas) devuelven el subconjunto correcto
**E2E manual**: flujo completo crear/editar/borrar con verificación visual del saldo de cuenta en cada paso

### Acceptance Criteria Check
- [ ] US1-US4 (P1) completas, incluyendo Escenarios 3 y 4 de la spec (edición de monto y de cuenta)
- [ ] Cobertura >80%, con énfasis en el servicio de transacciones atómicas

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Balance queda inconsistente si un `$inc` falla a mitad de una edición de cuenta | Baja (con transacciones Mongo) | Alto | `session.withTransaction()` garantiza todo-o-nada; test explícito que simula un fallo a mitad de camino |
| N+1 o queries lentas en listados con filtros combinados | Baja | Medio | Índices compuestos ya cubren los patrones de filtro documentados en la spec |
| Reutilización futura del servicio por Gastos Recurrentes (Fase 2) rompe si la firma cambia | Media | Bajo | Firma de `createTransaction` estable y documentada desde ahora |

---

## Timeline & Resources
- **Duración estimada**: 8-9 días (la más larga de Fase 1, es el módulo core)
- **Bloquea**: Presupuestos y Dashboard

---

## Notes & Decisions
1. El servicio de transacciones atómicas es la pieza de mayor riesgo técnico de todo el MVP — se le dedica más tiempo de testing que a cualquier otro módulo de Fase 1.
2. Se diseña `createTransaction` como función independiente reutilizable, anticipando su uso por Gastos Recurrentes en Fase 2, sin construir nada de Fase 2 todavía.
