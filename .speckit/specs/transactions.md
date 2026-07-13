# Specification: Transacciones

## Overview
El registro de ingresos y gastos es el núcleo del producto: cada transacción está ligada a una cuenta y una categoría, y actualiza el saldo de la cuenta de forma atómica. Esta spec también define el mecanismo compartido de creación/edición/borrado que mantiene `Account.currentBalance` correcto, usado también por Gastos Recurrentes en Fase 2.

---

## User Stories (Priority Order)

### P1 - Critical (MVP)

**[US1]** Como usuario, quiero registrar un gasto o ingreso indicando cuenta, categoría, monto y fecha, para llevar el control de mis movimientos
- Aceptación: Transacción creada, `Account.currentBalance` actualizado atómicamente en la misma operación

**[US2]** Como usuario, quiero ver el listado de mis transacciones ordenado por fecha, con filtros por cuenta, categoría, tipo y rango de fechas, para revisar mi actividad
- Aceptación: Listado paginado (`page`, `limit`), filtros combinables, orden `date desc` por defecto

**[US3]** Como usuario, quiero editar una transacción (monto, categoría, cuenta, fecha, descripción), para corregir errores de captura
- Aceptación: Al editar el monto o la cuenta, el saldo de la(s) cuenta(s) afectada(s) se recalcula atómicamente (ver Escenario 3)

**[US4]** Como usuario, quiero eliminar una transacción, para deshacer un registro incorrecto
- Aceptación: Al borrar, el saldo de la cuenta revierte el efecto de esa transacción

### P2 - Important

**[US5]** Como usuario, quiero agregar una descripción libre a una transacción, para recordar el detalle del movimiento
- Aceptación: Campo `description` opcional, buscable por texto en el listado

**[US6]** Como usuario, quiero recalcular el saldo de una cuenta si sospecho una inconsistencia, para confiar en los números mostrados
- Aceptación: Cubierto por `POST /api/accounts/[id]/recompute-balance` (spec de Cuentas), consume el mismo agregado que usa esta spec

### P3 - Nice to Have

**[US7]** Como usuario, quiero mover dinero entre dos de mis cuentas como una "transferencia", en vez de un gasto + un ingreso manual
- Aceptación: Fuera de alcance MVP — requiere tipo `transfer` y dos movimientos ligados; evaluar en Fase 2

---

## Acceptance Scenarios

### Scenario 1: Crear transacción de gasto (Happy Path)
```
Given tengo una cuenta "Efectivo" con saldo 100000 y categoría "Alimentación / Mercado"
When registro un gasto de 25000 en esa cuenta y categoría, con fecha hoy
Then la transacción se crea con type='expense', amount=25000
  And el saldo de "Efectivo" pasa a 75000
```

### Scenario 2: Filtrar transacciones por rango de fechas y categoría
```
Given tengo transacciones en enero y febrero, varias categorías
When filtro por categoría "Transporte" y rango 2026-02-01 a 2026-02-28
Then solo veo las transacciones de "Transporte" ocurridas en febrero
```

### Scenario 3: Editar el monto de una transacción existente
```
Given una transacción de gasto de 25000 en la cuenta "Efectivo" (saldo actual 75000)
When edito el monto a 40000
Then el saldo de "Efectivo" pasa a 60000 (75000 + 25000 - 40000)
  And la operación es atómica: si falla la actualización del saldo, la edición de la transacción también se revierte
```

### Scenario 4: Editar la cuenta de una transacción
```
Given una transacción de gasto de 20000 originalmente en "Cuenta A"
When la reasigno a "Cuenta B"
Then "Cuenta A" recupera los 20000 (se revierte)
  And "Cuenta B" descuenta los 20000 (se aplica)
  And ambas actualizaciones ocurren en la misma transacción de MongoDB
```

### Scenario 5: Eliminar transacción
```
Given una transacción de ingreso de 50000 en "Ahorros" (saldo actual 550000)
When la elimino
Then el saldo de "Ahorros" vuelve a 500000
  And la transacción ya no aparece en el listado
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Crear transacción con `accountId, categoryId, type, amount, date`, `description` opcional | P1 | `amount` siempre positivo; signo se deriva de `type` |
| FR-002 | Crear/editar/borrar transacción actualiza `Account.currentBalance` en la misma transacción MongoDB (`session.withTransaction`) | P1 | Ver constitución Principio 4 y 9 |
| FR-003 | Listar transacciones del usuario con filtros `accountId, categoryId, type, dateFrom, dateTo` y paginación `page, limit` | P1 | Response envelope `{ data, pagination }` |
| FR-004 | `accountId` y `categoryId` deben pertenecer al usuario autenticado | P1 | 404/403 si no |
| FR-005 | `currency` de la transacción se hereda de `Account.currency` en el momento de creación, no es editable directamente | P1 | Evita aritmética cross-currency en balance |
| FR-006 | Editar `amount`, `type` o `accountId` recalcula el/los saldo(s) afectado(s) atómicamente | P1 | Ver Escenario 3 y 4 |
| FR-007 | Borrar transacción revierte su efecto sobre el saldo de su cuenta, atómicamente | P1 | |
| FR-008 | Montos se almacenan y validan como enteros en unidades menores | P1 | Vía `src/lib/money.ts`, ver constitución Principio 9 |
| FR-009 | Todas las queries filtran por `userId` | P1 | Vía `Transaction.findForUser()` |
| FR-010 | Búsqueda de texto libre sobre `description` | P2 | Índice de texto opcional si el volumen lo justifica |

---

## Technical Context

### Database (MongoDB + Mongoose)

**Transaction Model** (`src/lib/models/Transaction.ts`)
```typescript
interface ITransaction extends Document {
  userId: ObjectId
  accountId: ObjectId
  categoryId: ObjectId
  type: 'income' | 'expense'
  amount: number               // entero positivo, unidades menores
  currency: string             // heredada de Account.currency al crear
  date: Date                   // fecha de la transacción (distinta de createdAt)
  description?: string
  recurringTransactionId?: ObjectId  // null en Fase 1, usado por Gastos Recurrentes (Fase 2)
  savingsGoalId?: ObjectId           // null en Fase 1, usado por Metas de Ahorro (Fase 2)
  createdAt: Date
  updatedAt: Date
}

transactionSchema.index({ userId: 1, date: -1 })
transactionSchema.index({ userId: 1, accountId: 1, date: -1 })
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 })
transactionSchema.index({ userId: 1, type: 1, date: -1 })
```

### Servicio compartido (no expuesto directamente como API)

`src/lib/services/transactions.ts` — usado por las rutas API de esta spec y, en Fase 2, por el generador de Gastos Recurrentes:
```typescript
async function createTransaction(input): Promise<ITransaction>   // aplica delta al Account dentro de una sesión
async function updateTransaction(id, input): Promise<ITransaction>  // revierte delta viejo, aplica delta nuevo
async function deleteTransaction(id): Promise<void>               // revierte delta
```

### API Endpoints

- `GET /api/transactions` — lista con filtros y paginación (ver FR-003)
- `POST /api/transactions` — crea transacción (usa `createTransaction`)
- `GET /api/transactions/[id]` — detalle
- `PATCH /api/transactions/[id]` — edita (usa `updateTransaction`)
- `DELETE /api/transactions/[id]` — elimina (usa `deleteTransaction`)

### Frontend Components

- `TransactionList.tsx` — listado paginado con filtros, React Query + Zustand (estado de filtros en UI)
- `TransactionForm.tsx` — crear/editar, react-hook-form + Zod, usa `AccountSelect` y `CategorySelect`
- `TransactionFilters.tsx` — controles de filtro (cuenta, categoría, tipo, rango de fechas)
- `TransactionRow.tsx` — fila individual con acciones editar/borrar

### Authentication
Requiere sesión (`requireSession()`). `accountId`/`categoryId` se validan contra el usuario de la sesión antes de cualquier escritura.

---

## Success Criteria

- [ ] Usuario puede crear, listar, editar y borrar transacciones (P1)
- [ ] `Account.currentBalance` permanece consistente ante cualquier combinación de crear/editar/borrar (P1)
- [ ] Las actualizaciones de saldo son atómicas — un fallo a mitad de camino no deja el saldo inconsistente (P1)
- [ ] Filtros y paginación funcionan combinados (P1)
- [ ] Tests unitarios e de integración: >80% cobertura, incluyendo casos de edición de monto/cuenta
- [ ] Aislamiento multi-tenant verificado

---

## Out of Scope
- Transferencias entre cuentas propias como tipo dedicado (`transfer`) — P3, Fase 2
- Adjuntar comprobantes/fotos a una transacción
- Importación masiva desde CSV/OFX (evaluado como módulo aparte, no incluido en Fase 1 ni Fase 2 de este roadmap)
- Transacciones recurrentes (spec separada, Fase 2) — esta spec solo expone el servicio compartido que ese módulo reutilizará

## Dependencies
- **Interno**: Modelos `Account` y `Category` (specs `accounts.md`, `categories.md`), `src/lib/api-auth.ts`, `src/lib/money.ts`
- **Externo**: Ninguna nueva — Mongoose (transacciones multi-documento requieren MongoDB como replica set, ya el caso en Atlas)

## Estimated Effort
- Días: 5-6
- Complejidad: Alta (la parte crítica es el manejo correcto de la transacción atómica multi-documento en creación/edición/borrado)

## Notes
1. Esta es la colección más consultada del sistema — todos los índices llevan `userId` como primer campo (constitución Principio 8).
2. El servicio `src/lib/services/transactions.ts` es deliberadamente reutilizable: Gastos Recurrentes (Fase 2) llamará a `createTransaction` en vez de duplicar la lógica de actualización de saldo.
3. Editar `accountId` es el caso más delicado: requiere revertir el delta en la cuenta original y aplicarlo en la nueva, ambas dentro de la misma `session.withTransaction()`.
