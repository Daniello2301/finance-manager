# Specification: Cuentas y Tarjetas

## Overview
Cada usuario administra una o más cuentas (banco, efectivo, tarjeta de crédito) que representan dónde vive su dinero. Toda transacción se registra contra una cuenta, y el saldo de cada cuenta se mantiene actualizado automáticamente. Las cuentas son la base sobre la que se construyen Transacciones, Presupuestos y el Dashboard.

---

## User Stories (Priority Order)

### P1 - Critical (MVP)

**[US1]** Como usuario nuevo, quiero crear una cuenta (banco, efectivo o tarjeta de crédito) con un saldo inicial, para empezar a registrar mis movimientos
- Prerequisitos: Usuario autenticado
- Aceptación: Cuenta creada con `currentBalance = initialBalance`, visible en la lista de cuentas

**[US2]** Como usuario, quiero ver la lista de mis cuentas con su saldo actual, para saber cuánto dinero tengo disponible en cada una
- Aceptación: Lista muestra nombre, tipo, moneda y saldo de cada cuenta activa

**[US3]** Como usuario, quiero editar el nombre, tipo o color de una cuenta, para mantener mis datos organizados
- Aceptación: Cambios persisten; `currency` NO es editable después de creada (ver Notas)

**[US4]** Como usuario, quiero archivar una cuenta que ya no uso, para dejar de verla en mis listados activos sin perder el historial de transacciones
- Aceptación: Cuenta archivada desaparece de selectores activos pero sus transacciones históricas se conservan y siguen siendo consultables

### P2 - Important

**[US5]** Como usuario, quiero definir un límite de crédito al crear una tarjeta de crédito, para ver cuánto crédito disponible me queda
- Aceptación: Campo `creditLimit` solo aplica a `type = 'credit_card'`; UI muestra "disponible = creditLimit + currentBalance" (balance de tarjeta es negativo cuando hay deuda)

**[US6]** Como usuario, quiero recalcular manualmente el saldo de una cuenta, por si noto una inconsistencia
- Aceptación: Botón "Recalcular saldo" reagrega todas las transacciones de la cuenta y sobreescribe `currentBalance`

### P3 - Nice to Have

**[US7]** Como usuario, quiero reordenar mis cuentas en la lista, para ver primero las que más uso
- Aceptación: Orden persistido por usuario (fuera de alcance MVP)

---

## Acceptance Scenarios

### Scenario 1: Crear cuenta (Happy Path)
```
Given estoy autenticado y en la página "Cuentas"
When ingreso nombre "Bancolombia Ahorros", tipo "bank", moneda "COP", saldo inicial 500000
  And confirmo "Crear cuenta"
Then se crea la cuenta con currentBalance = 500000
  And aparece en mi lista de cuentas
```

### Scenario 2: Archivar cuenta con historial
```
Given tengo una cuenta "Efectivo" con 10 transacciones registradas
When la archivo
Then la cuenta ya no aparece en el selector de cuentas al crear una transacción nueva
  And sus 10 transacciones siguen visibles en el historial y en reportes
```

### Scenario 3: Intento de cambiar la moneda de una cuenta existente
```
Given tengo una cuenta "Ahorros" en COP con transacciones
When intento cambiar su moneda a USD
Then la operación es rechazada
  And veo un mensaje indicando que debo archivar la cuenta y crear una nueva si necesita otra moneda
```

### Scenario 4: Tarjeta de crédito con saldo negativo
```
Given creo una tarjeta de crédito con creditLimit = 2000000 y saldo inicial 0
When registro un gasto de 300000 en esa tarjeta
Then currentBalance de la cuenta = -300000
  And el crédito disponible mostrado en UI = 1700000
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Crear cuenta con `name, type, currency, initialBalance`, `creditLimit` opcional | P1 | `currency` default = `User.settings.defaultCurrency` |
| FR-002 | `currentBalance` se inicializa igual a `initialBalance` al crear | P1 | |
| FR-003 | Listar cuentas del usuario autenticado, excluyendo archivadas por defecto | P1 | Filtro opcional para incluir archivadas |
| FR-004 | Editar `name`, `type`, `color`, `icon`, `creditLimit` de una cuenta propia | P1 | `currency` inmutable tras creación (FR-006) |
| FR-005 | Archivar/desarchivar cuenta (`isArchived`) | P1 | Nunca borrado duro — hay transacciones que referencian la cuenta |
| FR-006 | Rechazar cambios de `currency` en una cuenta existente | P1 | Respuesta 422 con mensaje explicativo |
| FR-007 | Todas las queries de cuentas filtran por `userId` (aislamiento multi-tenant) | P1 | Vía helper `Account.findForUser()`, ver constitución Principio 8 |
| FR-008 | Endpoint de recálculo de saldo agrega todas las `Transaction` de la cuenta | P2 | Respaldo de corrección ante drift |
| FR-009 | `creditLimit` solo se acepta si `type === 'credit_card'` | P2 | Validación Zod con `.refine()` |

---

## Technical Context

### Database (MongoDB + Mongoose)

**Account Model** (`src/lib/models/Account.ts`)
```typescript
interface IAccount extends Document {
  userId: ObjectId            // ref User
  name: string
  type: 'bank' | 'cash' | 'credit_card'
  currency: string            // ISO 4217, default 'COP', inmutable tras creación
  initialBalance: number      // entero, unidades menores (ver src/lib/money.ts)
  currentBalance: number      // denormalizado, actualizado transaccionalmente
  creditLimit?: number        // solo type = 'credit_card'
  color?: string
  icon?: string
  isArchived: boolean         // default false
  createdAt: Date
  updatedAt: Date
}

accountSchema.index({ userId: 1, isArchived: 1 })
accountSchema.index({ userId: 1, createdAt: -1 })
```

### API Endpoints

- `GET /api/accounts` — lista cuentas del usuario (`?includeArchived=true` opcional)
- `POST /api/accounts` — crea cuenta
- `GET /api/accounts/[id]` — detalle de una cuenta
- `PATCH /api/accounts/[id]` — edita cuenta (rechaza cambios a `currency`)
- `DELETE /api/accounts/[id]` — en realidad archiva (`isArchived: true`), nunca borra
- `POST /api/accounts/[id]/recompute-balance` — recalcula `currentBalance` desde las transacciones

### Frontend Components

- `AccountList.tsx` — lista de cuentas activas con saldo, usa React Query
- `AccountForm.tsx` — crear/editar cuenta, react-hook-form + Zod
- `AccountCard.tsx` — tarjeta individual con saldo, tipo, acciones (editar/archivar)
- `AccountSelect.tsx` — selector reutilizable para formularios de Transacciones/Presupuestos

### Authentication
Todas las rutas requieren sesión activa vía `requireSession()` (`src/lib/api-auth.ts`). Toda query se filtra por `userId` de la sesión — nunca se acepta `userId` desde el cliente.

---

## Success Criteria

- [ ] Usuario puede crear, editar, archivar y listar cuentas (P1)
- [ ] `currentBalance` se mantiene correcto tras crear/editar/borrar transacciones (validado en la spec de Transacciones)
- [ ] Cambiar `currency` de una cuenta existente es rechazado (P1)
- [ ] Cuentas archivadas no aparecen en selectores activos pero su historial persiste (P1)
- [ ] Tests unitarios: >80% cobertura del modelo y rutas API
- [ ] Aislamiento multi-tenant verificado: un usuario no puede ver/editar cuentas de otro

---

## Out of Scope
- Sincronización bancaria automática / Open Banking (futuro)
- Reordenamiento manual de cuentas (P3, post-MVP)
- Cuentas compartidas entre usuarios (no aplica — producto es multi-tenant aislado)

## Dependencies
- **Interno**: Modelo `User` (con `settings.defaultCurrency`), `src/lib/api-auth.ts`, `src/lib/money.ts`
- **Externo**: Ninguna dependencia nueva — Mongoose, Zod, react-hook-form ya instalados

## Estimated Effort
- Días: 3-4
- Complejidad: Media (la denormalización transaccional de `currentBalance` es la parte más delicada, se implementa en la spec de Transacciones)

## Notes
1. La actualización de `currentBalance` ocurre en el servicio de Transacciones (`src/lib/services/transactions.ts`), no aquí — esta spec solo define el modelo y el CRUD de la cuenta en sí.
2. No cambiar `currency` tras la creación evita aritmética cross-currency en `currentBalance`; si el usuario necesita otra moneda, archiva y crea una cuenta nueva.
