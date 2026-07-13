# Specification: Presupuestos por Categoría

## Overview
Los presupuestos permiten a un usuario definir un límite de gasto mensual por categoría y ver en tiempo real cuánto ha gastado frente a ese límite. Se apoyan directamente en Transacciones (para calcular el gasto real) y Categorías (para el límite por categoría).

---

## User Stories (Priority Order)

### P1 - Critical (MVP)

**[US1]** Como usuario, quiero definir un límite de gasto mensual para una categoría, para controlar cuánto gasto en ella
- Aceptación: Presupuesto creado para `categoryId + periodKey` ('YYYY-MM'), único por combinación

**[US2]** Como usuario, quiero ver cuánto llevo gastado de mi presupuesto de cada categoría en el mes actual, para saber si me estoy pasando
- Aceptación: Vista muestra `limitAmount`, gasto real agregado desde `Transaction`, y porcentaje/barra de progreso

**[US3]** Como usuario, quiero editar o eliminar un presupuesto de un mes, para ajustar mis planes
- Aceptación: Cambios persisten; eliminar un presupuesto no afecta las transacciones ya registradas

### P2 - Important

**[US4]** Como usuario, quiero ver una alerta visual cuando supero el 80% y el 100% de un presupuesto, para reaccionar a tiempo
- Aceptación: Indicador visual (color) en `BudgetProgress`, sin notificaciones push en MVP

**[US5]** Como usuario, quiero copiar los presupuestos del mes anterior al mes actual, para no tener que recrearlos cada mes
- Aceptación: Acción "Copiar del mes anterior" crea presupuestos faltantes con el mismo `limitAmount`

### P3 - Nice to Have

**[US6]** Como usuario, quiero definir un presupuesto general (no por categoría) para todo el mes
- Aceptación: Fuera de alcance MVP

---

## Acceptance Scenarios

### Scenario 1: Crear presupuesto mensual (Happy Path)
```
Given estoy en julio 2026 y tengo la categoría "Alimentación / Mercado"
When defino un presupuesto de 600000 para esa categoría en el mes actual
Then se crea un Budget con periodKey='2026-07', limitAmount=600000
```

### Scenario 2: Ver progreso de presupuesto
```
Given tengo un presupuesto de 600000 para "Alimentación / Mercado" en julio 2026
  And he registrado transacciones de gasto en esa categoría por un total de 450000 en julio
When abro la vista de presupuestos
Then veo "450.000 / 600.000 (75%)" para esa categoría
```

### Scenario 3: Intento de presupuesto duplicado
```
Given ya tengo un presupuesto para "Transporte" en julio 2026
When intento crear otro presupuesto para "Transporte" en julio 2026
Then la operación es rechazada (409) — debo editar el existente en vez de duplicarlo
```

### Scenario 4: Copiar presupuestos del mes anterior
```
Given tengo 5 presupuestos definidos en junio 2026 y ninguno en julio 2026
When uso "Copiar del mes anterior" en julio 2026
Then se crean 5 presupuestos nuevos en julio 2026 con los mismos límites que junio
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Crear presupuesto con `categoryId, periodKey, limitAmount` | P1 | `currency` default = `User.settings.defaultCurrency` |
| FR-002 | Único por `userId + categoryId + periodKey` | P1 | Índice único compuesto, error 409 en duplicado |
| FR-003 | Listar presupuestos de un `periodKey` con gasto real agregado por categoría | P1 | Agregación sobre `Transaction` filtrando `type='expense', date` dentro del mes |
| FR-004 | Editar `limitAmount` de un presupuesto propio | P1 | |
| FR-005 | Eliminar presupuesto (borrado duro, no afecta transacciones) | P1 | `Budget` no es referenciado por `Transaction` |
| FR-006 | Solo aplica a categorías de tipo `expense` | P1 | Presupuestos de ingreso no tienen sentido en el MVP |
| FR-007 | Endpoint para copiar presupuestos de un período a otro | P2 | Solo crea los que falten, no sobreescribe existentes |
| FR-008 | Todas las queries filtran por `userId` | P1 | Vía `Budget.findForUser()` |

---

## Technical Context

### Database (MongoDB + Mongoose)

**Budget Model** (`src/lib/models/Budget.ts`)
```typescript
interface IBudget extends Document {
  userId: ObjectId
  categoryId: ObjectId
  periodKey: string            // 'YYYY-MM'
  periodStart: Date            // primer día del mes, para rangos/orden
  limitAmount: number          // entero, unidades menores
  currency: string             // default = User.settings.defaultCurrency
  createdAt: Date
  updatedAt: Date
}

budgetSchema.index({ userId: 1, categoryId: 1, periodKey: 1 }, { unique: true })
budgetSchema.index({ userId: 1, periodKey: 1 })
```

### Agregación de gasto real (no es un modelo, es una función de servicio)

`src/lib/services/budgets.ts`
```typescript
async function getBudgetProgress(userId, periodKey) {
  // 1. Budget.findForUser(userId, { periodKey })
  // 2. Transaction.aggregate: $match {userId, type:'expense', date in [periodStart, periodEnd]}
  //    $group by categoryId -> sum(amount)
  // 3. merge: cada Budget + su gasto real agregado (0 si no hay transacciones)
}
```

### API Endpoints

- `GET /api/budgets?period=2026-07` — lista presupuestos del período con progreso agregado (usa `getBudgetProgress`)
- `POST /api/budgets` — crea presupuesto
- `PATCH /api/budgets/[id]` — edita `limitAmount`
- `DELETE /api/budgets/[id]` — elimina
- `POST /api/budgets/copy` — body `{ fromPeriod, toPeriod }`, copia los faltantes

### Frontend Components

- `BudgetList.tsx` — lista de presupuestos del mes con barra de progreso
- `BudgetForm.tsx` — crear/editar presupuesto, react-hook-form + Zod, usa `CategorySelect` (filtrado a `type='expense'`)
- `BudgetProgress.tsx` — barra de progreso con color según % (verde <80%, amarillo 80-100%, rojo >100%)
- `MonthSelector.tsx` — selector de período reutilizable (también usado en Dashboard)

### Authentication
Requiere sesión (`requireSession()`). `categoryId` validado contra el usuario de la sesión.

---

## Success Criteria

- [ ] Usuario puede crear, editar, eliminar presupuestos por categoría y mes (P1)
- [ ] El progreso mostrado refleja el gasto real agregado de Transacciones (P1)
- [ ] No se permiten presupuestos duplicados por categoría+mes (P1)
- [ ] Copiar presupuestos del mes anterior funciona sin duplicar existentes (P2)
- [ ] Tests unitarios: >80% cobertura, incluyendo la agregación de progreso
- [ ] Aislamiento multi-tenant verificado

---

## Out of Scope
- Presupuesto general no ligado a categoría (P3)
- Notificaciones push/email al superar el presupuesto (evaluar en Fase 2 junto con Gastos Recurrentes)
- Presupuestos multi-mes o anuales

## Dependencies
- **Interno**: Modelos `Category` y `Transaction` (specs `categories.md`, `transactions.md`), `src/lib/api-auth.ts`, `src/lib/money.ts`
- **Externo**: Ninguna nueva

## Estimated Effort
- Días: 3
- Complejidad: Media (la agregación de progreso es la parte no trivial; el CRUD del modelo es simple)

## Notes
1. `periodKey` como string `'YYYY-MM'` simplifica la unicidad y el filtrado; `periodStart` se guarda además como `Date` para ordenar/rangos sin parsear el string.
2. El gasto real nunca se denormaliza en `Budget` — siempre se calcula agregando `Transaction` en el momento de la consulta, ya que los presupuestos se ven con poca frecuencia (no es un campo de alta lectura como `Account.currentBalance`) y así se evita mantener sincronizado un segundo campo derivado.
