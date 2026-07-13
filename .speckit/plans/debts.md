# Implementation Plan: Deudas

## Specification Reference
`.speckit/specs/debts.md` — ratificada 2026-07-13 (enmienda 1 de la constitución).

---

## Phase 0: Research & Validation

### Constitution Check

| Principio | Cumplimiento |
|---|---|
| 2. Database-First | `Debt` es un modelo Mongoose con su Zod correspondiente. Sin queries crudas |
| 3. Test-First | `debt-math.ts` se escribe **test-first sí o sí** — es la parte con riesgo real |
| 8. Multi-Tenant | `debtSchema.index({ userId: 1, isArchived: 1 })`, static `findForUser` copiado de `Account.ts` |
| 9. Money as Integer Minor Units | `principal`, `installmentAmount` y todos los importes derivados son enteros. **`monthlyRate` NO es dinero**: es un decimal (0.015), y va sin `toMinorUnits` |
| 4. No Premature Optimization | El saldo se calcula en lectura. Si algún día pesa, se denormaliza con datos, no por si acaso |

**Una tensión que vale la pena declarar**: el Principio 9 dice "todo el dinero en enteros". `monthlyRate` no es dinero y por tanto no aplica — pero los **productos** de una tasa por un importe sí lo son, y ahí es donde COP (exponente 0, sin decimales) muerde: `17.000.000 × 0.015 = 255.000` sale exacto, pero `14.255.000 × 0.015 = 213.825` también, y `100.001 × 0.015 = 1500.015` no. Por eso **se redondea en cada paso de la reproducción**, no al final: redondear al final acumula residuo y el saldo deja de cuadrar con la suma de los abonos.

### Technical Research

**Despeje de la tasa.** `cuota = P·i / (1 − (1+i)^−n)` no se puede despejar en `i` de forma cerrada. Newton-Raphson converge en pocas iteraciones para tasas razonables:

```
f(i)  = P·i / (1 − (1+i)^−n) − cuota
f'(i) = derivada numérica (secante) — evita derivar a mano y equivocarse
```

Detalles que importan y que son fuente clásica de bugs:
- **Semilla**: `i₀ = 0.01` (1% mensual). Una semilla de 0 hace que `f` sea indeterminada (0/0).
- **No converge siempre, y hay que aceptarlo**: si `cuota × n ≤ P`, el usuario nunca terminaría de pagar — no existe tasa positiva que lo satisfaga. Devolver `null`, no un número.
- **Acotar**: si el resultado sale negativo o absurdo (>100% mensual), devolver `null`. Mejor decir "no puedo" que dar una cifra falsa.
- Máximo 100 iteraciones, tolerancia 1e-9.

**Reproducción mes a mes.** Se recorre desde `startDate` (o desde el primer pago si no hay `startDate`) hasta el mes actual. Los meses se generan en **UTC**, reusando el criterio de `src/lib/period.ts` — `Transaction.date` se construye siempre desde `new Date("YYYY-MM-DD")`, que es medianoche **UTC**, y mezclar eso con aritmética en hora local ya causó un bug real en este repo (los pagos cerca del límite de mes caían en el mes equivocado).

### Project Structure Review
Se sigue el patrón ya establecido, sin inventar nada:
- Servicio (`src/lib/services/debts.ts`) porque la lógica cruza colecciones (`Debt` + `Transaction`) — misma regla que activó el servicio de Transacciones y el de Presupuestos.
- Widget de dashboard: los 5 pasos de siempre (servicio → ruta → hook → widget → componer en `page.tsx`).

---

## Phase 1: Design & Architecture

### Database Schema

`src/lib/models/Debt.ts` — copia literal del patrón de static tipado de `Account.ts` (`IDebtModel extends Model<IDebt>`, `QueryFilter<IDebt>` y no `FilterQuery`, que no existe en Mongoose 9).

`src/lib/models/Transaction.ts` — se añade `debtId?: ObjectId` (ref `Debt`) + índice `{ userId: 1, debtId: 1 }`. Es un campo nuevo **opcional** en una colección con datos en producción: no requiere migración (los documentos viejos simplemente no lo tienen).

### `src/lib/debt-math.ts` — funciones puras, sin Mongoose

Sin `import mongoose`, deliberadamente: `DebtForm.tsx` (componente cliente) necesita despejar la tasa en vivo mientras el usuario escribe, y meter mongoose en el bundle del cliente ya rompió el build una vez en este repo.

```typescript
export interface DebtPayment { amount: number; date: Date }

export interface DebtState {
  outstanding: number | null      // null = no hay datos suficientes
  arrears: number                 // intereses no pagados acumulados
  totalPaid: number               // desembolsado
  totalToPrincipal: number
  totalToInterest: number
  payments: SplitPayment[]        // cada pago con su interés/capital
  underpaid: boolean              // algún pago no cubrió los intereses del mes
}

export function replayDebt(...): DebtState
export function deriveMonthlyRate(principal, installment, count): number | null
export function effectiveRate(debt): { rate: number; estimated: boolean } | null
```

`effectiveRate` es la única puerta: usa `monthlyRate` si está, si no intenta despejarla, si no devuelve `null`. Ni el servicio ni la UI deciden esto por su cuenta.

### API Routes Structure
Ver la spec. Todas las rutas son el patrón de siempre: `requireSession()` → `parseObjectIdParam()` → Zod → servicio → `errorResponse()`.

`POST /api/debts/[id]/payments` **no reimplementa nada**: valida que la cuenta sea del usuario y llama a `createTransaction(userId, { ..., debtId })`. Hereda gratis la transacción de Mongo, el `$inc` del saldo y —importante— la validación de saldo insuficiente que se añadió en la Fase A: pagar una deuda con dinero que no tienes pide confirmación como cualquier otro gasto.

**Categoría del pago.** `Transaction.categoryId` es obligatorio. Un pago de deuda necesita una categoría, así que el body la exige (`categoryId`) y la UI la preselecciona con una categoría de gasto llamada "Deudas" si existe. No se auto-crea una categoría a espaldas del usuario.

### Zod Schemas (`src/lib/validation/debts.ts`)
`objectIdSchema` desde `@/lib/validation/common` (ya unificado). Sin `mongoose`.

Reglas cruzadas que Zod **no** puede expresar bien y van en la ruta o en la math:
- `installmentCount > 0` si viene.
- `monthlyRate` entre 0 y 1 (0–100% mensual) — un usuario que escriba "1.5" pensando en porcentaje debe ver 1.5%, así que **la UI convierte porcentaje→decimal y el schema guarda decimal**. Ese es exactamente el tipo de confusión que produce un error de dos órdenes de magnitud en dinero real, así que el campo del formulario dice "% mensual" y la conversión ocurre en un solo sitio.

### Component Hierarchy
Ver la spec. `DebtForm.tsx` es el único con miga: muestra la tasa despejada en vivo (llamando a `deriveMonthlyRate` en el cliente) en cuanto los tres campos están, y la etiqueta como *estimada*.

### State Management
Zustand para el modal (`debtModal.store.ts`, copia de `budgetModal.store.ts`). React Query para los datos (`useDebts.ts`). Sin novedades.

---

## Phase 2: Implementation

### Complexity Assessment

| Pieza | Complejidad | Por qué |
|---|---|---|
| `debt-math.ts` | **Alta** | Único sitio con riesgo real. Un error aquí no revienta: devuelve un número falso sobre el dinero del usuario, que es peor |
| Modelo + Zod | Baja | Patrón copiado |
| API | Baja | Patrón copiado; los pagos delegan en `createTransaction` |
| Frontend | Media | `DebtForm` con la tasa en vivo |
| Widget dashboard | Baja | Los 5 pasos de siempre |

### Implementation Order (Test-First)
1. **`debt-math.ts` con sus tests primero.** Los tests se escriben con los números reales del dueño (17M al 1.5%, pagos de 210k y de 3M) antes de existir la implementación.
2. Modelo `Debt` + `Transaction.debtId`.
3. Zod.
4. Servicio.
5. API.
6. Frontend.
7. Widget + entrada en el sidebar.

### Critical Dependencies
`createTransaction()` debe seguir aceptando campos extra sin romperse — ya acepta `recurringTransactionId` y `savingsGoalId`, así que `debtId` entra por la misma puerta. **Ojo**: `UpdateTransactionServiceInput` **no** preserva `recurringTransactionId`; hay que asegurarse de que editar un pago no le borre el `debtId` (Mongoose `strict` no lo tocaría, pero un `Object.assign(existing, fields)` con un `debtId: undefined` explícito sí).

---

## Phase 3: Testing & Validation

- **`debt-math.test.ts`** — el test que importa. Casos: los tres escenarios reales del dueño; un pago corto (mora, sin capitalizar); un abono fuerte (el interés del mes siguiente baja); una deuda sin `principal` (devuelve `outstanding: null`, no 0 — **0 diría "ya no debes nada"**); despeje que converge; despeje que **no** converge (`cuota × n ≤ P` → `null`); redondeo (que la suma de los abonos cuadre exactamente con la caída del saldo).
- **Integración (`MongoMemoryReplSet`, obligatorio: los pagos usan `withTransaction`)** — un pago mueve `Account.currentBalance`; un pago que excede el saldo pide confirmación (heredado de la Fase A); borrar la deuda no borra los pagos.
- **Multi-tenant** — 404, nunca 403.
- Cobertura ≥80% (Principio 3).

### Acceptance Criteria Check
Los 7 escenarios de la spec se traducen 1:1 a tests.

---

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **La matemática da un número plausible pero falso** | Media | **Alto** — el usuario toma decisiones de dinero con él | Funciones puras, test-first, con los números reales del dueño. Un número derivado nunca se presenta como dato del contrato |
| Confusión porcentaje vs decimal (1.5 vs 0.015) | **Alta** | Alto — error de dos órdenes de magnitud | Una única conversión, en la UI. El schema solo conoce decimales |
| Residuo de redondeo (COP sin decimales) | Alta | Medio — el saldo no cuadra con la suma de abonos | Redondear en cada paso, no al final. Test explícito |
| Meses en hora local en vez de UTC | Media | Medio — pagos cerca del fin de mes caen en el mes equivocado | Reusar el criterio UTC de `period.ts`. Ya pasó una vez en este repo |
| Editar un pago le borra el `debtId` | Media | Medio | Test que edita un pago y comprueba que sigue ligado |

## Timeline & Resources
4 días. La mitad es `debt-math.ts` y sus tests.

---

## Notes & Decisions
1. `debt-math.ts` vive en `src/lib/`, no en `src/lib/services/`, y **no importa mongoose** — el formulario cliente lo necesita para despejar la tasa en vivo.
2. `deriveMonthlyRate` devuelve `null` con franqueza. No hay valor por defecto, no hay "aproximadamente". Si no se puede, no se puede.
3. `outstanding: null` ≠ `outstanding: 0`. La UI debe distinguirlos: `null` es "no sé", `0` es "ya no debes nada". Confundirlos sería el peor bug posible de este módulo.
