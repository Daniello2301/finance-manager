# Implementation Plan: Cuentas y Tarjetas

**Specification**: `.speckit/specs/accounts.md`
**User Stories Covered**: US1-US7
**Tech Stack**: Next.js 16, Mongoose, Zod, react-hook-form, React Query

---

## Phase 0: Research & Validation

### Constitution Check
- ✅ Aislamiento multi-tenant vía `userId`-prefixed indexes y `Account.findForUser()` (Principio 8)
- ✅ Dinero como enteros en unidades menores (Principio 9)
- ✅ No borrado duro — `isArchived` porque `Transaction` referencia `Account`
- ✅ Sin dependencias nuevas

### Technical Research
| Question | Answer | Confidence |
|----------|--------|-----------|
| ¿Por qué `currency` es inmutable tras crear la cuenta? | Evita aritmética cross-currency en `currentBalance`; si cambia de moneda, se archiva y se crea una cuenta nueva | High |
| ¿Cómo se refleja "crédito disponible" de una tarjeta? | Campo derivado en el frontend: `creditLimit + currentBalance` (balance negativo = deuda), no se guarda en DB | High |
| ¿`POST /recompute-balance` corre dentro de una transacción Mongo? | Sí, mismo patrón que `Transaction` — lee agregando `Transaction.find({accountId})` y sobreescribe `currentBalance` en una sola escritura | High |

### Project Structure Review
- **Depende de**: `src/lib/api-auth.ts` (`requireSession()`), `src/lib/money.ts` — ambos deben existir antes de escribir las rutas API (ver "Convenciones transversales" del plan general del proyecto)
- **Reutilizable en**: `AccountSelect.tsx` será usado por Transacciones y Presupuestos
- **Bloquea a**: Transacciones (necesita `Account` para validar `accountId` y actualizar `currentBalance`)

---

## Phase 1: Design & Architecture

### Database Schema (Mongoose)

`src/lib/models/Account.ts`
```typescript
import mongoose, { Schema, Document } from 'mongoose'

interface IAccount extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  type: 'bank' | 'cash' | 'credit_card'
  currency: string
  initialBalance: number
  currentBalance: number
  creditLimit?: number
  color?: string
  icon?: string
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

const accountSchema = new Schema<IAccount>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['bank', 'cash', 'credit_card'], required: true },
  currency: { type: String, required: true, default: 'COP', immutable: true },
  initialBalance: { type: Number, required: true, default: 0 },
  currentBalance: { type: Number, required: true, default: 0 },
  creditLimit: { type: Number },
  color: { type: String },
  icon: { type: String },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true })

accountSchema.index({ userId: 1, isArchived: 1 })
accountSchema.index({ userId: 1, createdAt: -1 })

accountSchema.statics.findForUser = function (userId, filter = {}) {
  return this.find({ ...filter, userId })
}

export default mongoose.models.Account || mongoose.model<IAccount>('Account', accountSchema)
```

### API Routes Structure

```
src/app/api/accounts/
├── route.ts                        # GET (list), POST (create)
├── [id]/
│   ├── route.ts                    # GET, PATCH, DELETE (archive)
│   └── recompute-balance/
│       └── route.ts                # POST
└── __tests__/
    ├── route.test.ts
    └── [id].route.test.ts
```

**GET /api/accounts** — query params `includeArchived?: boolean`; usa `Account.findForUser(session.user.id, filter)`
**POST /api/accounts** — Zod valida body, `currentBalance = initialBalance` al crear
**PATCH /api/accounts/[id]** — rechaza si `body.currency` está presente y difiere del valor actual (422)
**DELETE /api/accounts/[id]** — en realidad hace `findOneAndUpdate({_id,userId}, {isArchived: true})`
**POST /api/accounts/[id]/recompute-balance** — agrega `Transaction` de la cuenta, sobreescribe `currentBalance`

### Zod Schemas (`src/lib/validation/accounts.ts`)
```typescript
const CreateAccountSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(['bank', 'cash', 'credit_card']),
  currency: z.string().length(3).default('COP'),
  initialBalance: z.number().int(),
  creditLimit: z.number().int().positive().optional(),
  color: z.string().optional(),
  icon: z.string().optional()
}).refine(
  data => data.type === 'credit_card' || data.creditLimit === undefined,
  { message: 'creditLimit solo aplica a credit_card', path: ['creditLimit'] }
)

const UpdateAccountSchema = CreateAccountSchema.partial().omit({ currency: true })
```

### Component Hierarchy

```
src/app/(dashboard)/accounts/
├── page.tsx                    # AccountList
└── components/
    ├── AccountList.tsx
    ├── AccountCard.tsx
    ├── AccountForm.tsx         # modal/drawer, crear + editar
    └── AccountSelect.tsx       # reutilizado fuera de este módulo (Transacciones, Presupuestos)
```

### State Management
- **React Query**: `useAccounts()`, `useCreateAccount()`, `useUpdateAccount()`, `useArchiveAccount()` — invalidan `['accounts']` en mutate
- **Zustand**: solo estado de UI (modal abierto/cerrado, cuenta en edición)
- **react-hook-form + Zod**: `AccountForm`

---

## Phase 2: Implementation

### Complexity Assessment

| Aspect | Complexity | Justification |
|--------|-----------|----------------|
| Database | Baja | Schema simple, sin relaciones complejas propias |
| API | Media | Validación de inmutabilidad de `currency`, endpoint de recálculo |
| Frontend | Media | `AccountSelect` debe ser genérico desde el inicio para reutilización |
| Testing | Baja-Media | Casos de borde: recálculo, rechazo de cambio de moneda |

### Implementation Order (Test-First)

1. **Modelo** (0.5d): `Account.ts` + tests de validación de schema
2. **Zod schemas** (0.5d): create/update + tests
3. **API — crear/listar** (1d): tests fallando → `route.ts` GET/POST → tests pasan
4. **API — editar/archivar** (1d): tests fallando (incluye rechazo de cambio de `currency`) → `[id]/route.ts` → tests pasan
5. **API — recompute-balance** (0.5d): test fallando → implementación → test pasa
6. **Frontend — AccountList + AccountCard** (1d)
7. **Frontend — AccountForm** (1d)
8. **Frontend — AccountSelect genérico** (0.5d) — diseñado para reutilizarse en Transacciones/Presupuestos
9. **Integración**: flujo crear → editar → archivar → recompute (0.5d)

### Critical Dependencies
- `src/lib/api-auth.ts` y `src/lib/money.ts` deben existir (convenciones transversales del proyecto)
- MongoDB debe soportar transacciones (replica set) — ya asumido por Atlas

---

## Phase 3: Testing & Validation

**Unit**: schema Mongoose, Zod schemas, lógica de rechazo de cambio de moneda
**Integration**: crear cuenta → aparece en listado; archivar → desaparece de listado activo pero GET directo sigue funcionando; recompute-balance con transacciones previas
**E2E manual**: crear cuenta banco, crear tarjeta de crédito con límite, editar nombre, archivar, verificar que no aparece en `AccountSelect` de una transacción nueva

### Acceptance Criteria Check
- [ ] US1-US4 (P1) completas
- [ ] US5-US6 (P2) completas
- [ ] Cobertura >80%

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `currency` inmutable no se valida en `PATCH` y rompe balances de otros módulos | Baja | Alto | Test explícito de rechazo + `immutable: true` a nivel de schema Mongoose como segunda capa |
| `AccountSelect` diseñado sin pensar en reutilización, se duplica en Transacciones | Media | Medio | Construirlo genérico desde el día 1 (Paso 8), no como parte interna de `AccountList` |

---

## Timeline & Resources
- **Duración estimada**: 6 días (3-4 con paralelización de frontend/backend)
- **Bloquea**: Transacciones no puede empezar hasta que el modelo `Account` y `findForUser()` existan

---

## Notes & Decisions
1. `currentBalance` se actualiza desde el servicio de Transacciones, no desde este módulo — aquí solo se inicializa al crear y se sobreescribe en el recálculo manual.
2. `AccountSelect.tsx` se construye como componente compartido desde el inicio para evitar duplicación en Transacciones y Presupuestos.
