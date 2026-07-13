# Specification: Deudas

## Overview
Las Deudas permiten registrar dinero que el usuario debe a un tercero (un banco, una cooperativa, una plataforma de compra a plazos, o una persona) y llevar el control real de su pago: cuánto queda pendiente, cuánto de cada pago se fue en intereses y cuánto abonó al capital, y si un pago se quedó corto frente a los intereses del mes.

Se apoyan en Transacciones: **un pago de deuda ES una transacción de gasto** que lleva un `debtId`. El dinero sale de verdad de una cuenta, así que debe mover el saldo, aparecer en el historial y contar para los presupuestos, exactamente igual que cualquier otro gasto.

El módulo nace de un uso real que el MVP no sabía representar: el dueño tiene un préstamo informal a tasa mensual, un crédito bancario del que conoce la cuota pero no la tasa, y una compra a plazos en ADDI. Ninguno cabe en una `Category`, que es solo una etiqueta.

---

## User Stories (Priority Order)

### P1 - Critical

**[US1]** Como usuario, quiero registrar una deuda con los datos que tenga a mano, para no dejar de registrarla solo porque me falta un dato
- Aceptación: Solo el nombre es obligatorio. Monto original, tasa, cuota, número de cuotas, entidad y número de cuenta son todos opcionales

**[US2]** Como usuario, quiero registrar un pago de una deuda y que salga del saldo de mi cuenta, para que mis cuentas reflejen la realidad
- Aceptación: El pago crea una `Transaction` de tipo `expense` con `debtId`; `Account.currentBalance` baja; el pago aparece en el historial de transacciones

**[US3]** Como usuario, quiero ver cuánto llevo pagado de una deuda y cuánto me falta, para saber en qué voy
- Aceptación: La vista muestra el saldo pendiente, el total abonado a capital, el total pagado en intereses y el total desembolsado

**[US4]** Como usuario, quiero que cada pago se descomponga en intereses y abono a capital, para entender a dónde se va mi dinero
- Aceptación: Cada pago muestra su parte de interés y su parte de capital, calculadas contra el saldo pendiente del mes en que se hizo

**[US5]** Como usuario, quiero que me avise cuando un pago no alcanza a cubrir los intereses del mes, porque significa que la deuda no está bajando
- Aceptación: Alerta visible en la deuda y en el pago concreto. El capital **no** crece (ver Nota 3), pero los intereses no pagados se acumulan y se muestran

### P2 - Important

**[US6]** Como usuario, quiero que la app calcule la tasa de interés cuando no la sé, para no tener que adivinarla
- Aceptación: Si conozco monto original + valor de la cuota + número de cuotas, la app despeja la tasa mensual y la muestra marcada como *estimada*

**[US7]** Como usuario, quiero ver el total que debo pagar este mes en todas mis deudas, para planear mi mes
- Aceptación: Widget en el dashboard con la suma de las cuotas y cuánto llevo pagado este mes

**[US8]** Como usuario, quiero tener a mano el número de cuenta al que debo transferir, para no buscarlo cada vez
- Aceptación: Campo de texto libre, visible en la deuda

### P3 - Nice to Have

**[US9]** Como usuario, quiero ver el cuadro de amortización completo proyectado hasta el final
- Aceptación: Fuera de alcance de esta primera versión

**[US10]** Como usuario, quiero que la app conozca las tasas de los bancos colombianos automáticamente
- Aceptación: **Rechazado, no fuera de alcance.** No existe una fuente pública que dé la tasa de *tu contrato*: la Superfinanciera publica promedios de mercado y la tasa de usura, no lo que te cobra tu banco. Un número traído de ahí sería una invención presentada como dato. La tasa se introduce o se despeja de los propios números del usuario, o no se calcula

---

## Acceptance Scenarios

### Scenario 1: Registrar una deuda con todos los datos (Happy Path)
```
Given tengo un préstamo de 17.000.000 al 1.5% mensual
When registro la deuda con monto original 17000000 y tasa 1.5
Then se crea la Deuda y su saldo pendiente es 17.000.000
  And el interés proyectado del primer mes es 255.000
```

### Scenario 2: Un pago que solo cubre intereses
```
Given tengo una deuda de 17.000.000 al 1.5% mensual (interés mensual = 255.000)
When registro un pago de 255.000
Then el pago se descompone en 255.000 de interés y 0 de abono a capital
  And el saldo pendiente sigue siendo 17.000.000
  And el saldo de la cuenta desde la que pagué baja 255.000
```

### Scenario 3: Un pago que NO alcanza a cubrir los intereses
```
Given tengo una deuda de 17.000.000 al 1.5% mensual (interés mensual = 255.000)
When registro un pago de 210.000
Then el pago se descompone en 210.000 de interés y 0 de abono a capital
  And se acumulan 45.000 de intereses no pagados
  And la deuda muestra una alerta: el pago no cubrió los intereses
  And el saldo pendiente NO crece: sigue en 17.000.000 (ver Nota 3)
```

### Scenario 4: Un abono fuerte a capital
```
Given tengo una deuda de 17.000.000 al 1.5% mensual (interés mensual = 255.000)
When registro un pago de 3.000.000
Then el pago se descompone en 255.000 de interés y 2.745.000 de abono a capital
  And el saldo pendiente pasa a 14.255.000
  And el interés del mes siguiente baja a 213.825
```

### Scenario 5: Despejar la tasa que no conozco
```
Given tengo un crédito bancario: me prestaron 10.000.000, pago 500.000 al mes, son 24 cuotas
  And no sé la tasa de interés
When registro la deuda con esos tres datos y dejo la tasa vacía
Then la app despeja una tasa mensual de ~1.51% y la muestra marcada como estimada
```

### Scenario 6: Una deuda de la que sé muy poco
```
Given tengo una deuda en ADDI pero no recuerdo el monto original
When registro la deuda solo con nombre y valor de la cuota
Then la deuda se crea igualmente
  And no se muestra saldo pendiente ni intereses — se muestra "sin datos suficientes para calcular intereses"
  And puedo registrar pagos y ver el total desembolsado
```

### Scenario 7: Aislamiento entre usuarios
```
Given otro usuario tiene una deuda
When intento consultarla, editarla o pagarla
Then obtengo 404 (nunca 403 — no se filtra la existencia del recurso)
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Crear deuda con `name` obligatorio; todo lo demás opcional | P1 | `creditor`, `principal`, `monthlyRate`, `installmentAmount`, `installmentCount`, `accountNumber`, `startDate` |
| FR-002 | Un pago de deuda es una `Transaction` de tipo `expense` con `debtId` | P1 | Reusa `createTransaction()` sin modificarla; el saldo de la cuenta se mueve solo |
| FR-003 | El saldo pendiente se **calcula en cada lectura**, nunca se denormaliza | P1 | Se reproduce mes a mes desde `startDate`: se acumula interés, se restan los pagos del mes |
| FR-004 | Cada pago se descompone en interés y abono a capital | P1 | `interés = round(saldo × tasa)`; `capital = max(0, pago − interés)` |
| FR-005 | Los intereses no pagados se acumulan como **mora**, y NO se capitalizan | P1 | Decisión ratificada 2026-07-13. El capital no crece; la mora es visible |
| FR-006 | Si no hay `principal` o no hay tasa (ni dada ni despejable), no se calculan intereses | P1 | La deuda se registra igual; se muestran solo los totales desembolsados |
| FR-007 | Despejar la tasa desde `principal` + `installmentAmount` + `installmentCount` | P2 | Newton-Raphson sobre la fórmula de anualidad. Requiere **los tres**; con dos es imposible |
| FR-008 | Marcar visiblemente una tasa despejada como *estimada* | P2 | Nunca presentar un número derivado como si fuera un dato del contrato |
| FR-009 | Eliminar una deuda no borra sus pagos | P1 | Los pagos son transacciones reales; quedan, con `debtId` colgando. Se advierte al usuario |
| FR-010 | Widget de dashboard: cuota total del mes y cuánto se lleva pagado | P2 | Reusa `getDebtSummary()` |
| FR-011 | Todas las queries filtran por `userId` | P1 | Vía `Debt.findForUser()` (Principio 8) |
| FR-012 | Montos como enteros en unidades menores | P1 | Principio 9. La tasa NO es dinero: se guarda como número decimal |

---

## Technical Context

### Database (MongoDB + Mongoose)

**Debt Model** (`src/lib/models/Debt.ts`)
```typescript
interface IDebt extends Document {
  userId: ObjectId
  name: string                    // "Crédito moto" — lo único obligatorio
  creditor?: string               // "Banco X", "ADDI", "Juan"
  principal?: number              // monto original, entero, unidades menores
  monthlyRate?: number            // 0.015 = 1.5% mensual. NO es dinero: decimal
  installmentAmount?: number      // valor de la cuota, entero, unidades menores
  installmentCount?: number       // número de cuotas
  accountNumber?: string          // texto libre, para transferir. No se valida
  startDate?: Date                // desde cuándo corre el interés
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

debtSchema.index({ userId: 1, isArchived: 1 })
```

**Transaction** gana un campo (`src/lib/models/Transaction.ts`)
```typescript
debtId?: ObjectId   // ref 'Debt' — presente solo si esta transacción es un pago de deuda
debtSchema.index({ userId: 1, debtId: 1 })   // para traer los pagos de una deuda
```

### La matemática (`src/lib/debt-math.ts` — funciones puras, sin Mongoose)

Separado del servicio a propósito: es la parte con riesgo real de estar mal, y siendo pura se puede probar exhaustivamente sin base de datos.

```typescript
// Reproduce la vida de la deuda mes a mes. Devuelve el saldo pendiente hoy,
// cada pago descompuesto, y la mora acumulada.
function replayDebt(debt, payments): DebtState

// Despeja la tasa mensual de cuota = P·i / (1 − (1+i)^−n).
// No tiene solución cerrada: Newton-Raphson. Devuelve null si no converge
// o si falta cualquiera de los tres datos.
function deriveMonthlyRate(principal, installment, count): number | null
```

Reglas de la reproducción, mes a mes desde `startDate` hasta hoy:
1. `interés_del_mes = round(saldo × tasa)`
2. `pagado_en_el_mes = suma de los pagos con fecha en ese mes`
3. `interés_cubierto = min(pagado, interés_del_mes)`
4. `mora += interés_del_mes − interés_cubierto`
5. `abono_a_capital = pagado − interés_cubierto`
6. `saldo = max(0, saldo − abono_a_capital)`

`round` en cada paso porque COP no tiene decimales (exponente 0 en `money.ts`) — Principio 9.

### API Endpoints

- `GET /api/debts` — lista con estado calculado (`?includeArchived=true`)
- `POST /api/debts` — crea
- `GET /api/debts/[id]` — una deuda con su estado y sus pagos descompuestos
- `PATCH /api/debts/[id]` — edita (incluye `isArchived` para archivar/desarchivar)
- `DELETE /api/debts/[id]` — archiva (no borra: los pagos son transacciones reales)
- `POST /api/debts/[id]/payments` — registra un pago. Body: `{ accountId, amount, date, description? }`. Delega en `createTransaction()` con `debtId`
- `GET /api/dashboard/debts` — resumen para el widget

### Frontend Components

- `src/app/dashboard/debts/page.tsx` — página del módulo
- `DebtList.tsx` / `DebtCard.tsx` — deudas con saldo, progreso y alerta de mora
- `DebtForm.tsx` — crear/editar. Todos los campos opcionales salvo el nombre. Muestra la tasa despejada en vivo cuando se dan los tres datos
- `DebtPaymentForm.tsx` — registrar un pago. Usa `AccountSelect` (ya existe)
- `DebtPaymentList.tsx` — pagos con su descomposición interés/capital
- `DebtSummaryWidget.tsx` — widget del dashboard
- Entrada nueva en `Sidebar.tsx` (icono `Landmark` de `lucide-react`)

### Authentication
Requiere sesión (`requireSession()`). `accountId` validado contra el usuario de la sesión antes de registrar un pago.

---

## Success Criteria

- [ ] Se puede registrar una deuda sabiendo solo su nombre (P1)
- [ ] Un pago mueve el saldo de la cuenta y aparece en el historial de transacciones (P1)
- [ ] Cada pago se descompone correctamente en interés y capital (P1)
- [ ] Un pago que no cubre los intereses genera alerta y acumula mora, sin inflar el capital (P1)
- [ ] La tasa se despeja correctamente cuando se dan los tres datos, y se marca como estimada (P2)
- [ ] Una deuda sin datos suficientes se registra igual y no inventa números (P1)
- [ ] Tests: >80% cobertura. La matemática (`debt-math.ts`) se prueba con los números reales del dueño
- [ ] Aislamiento multi-tenant verificado (404, nunca 403)

---

## Out of Scope
- Cuadro de amortización proyectado hasta el final (US9)
- Traer tasas de bancos desde internet (US10 — **rechazado**, no pospuesto)
- Tasas variables en el tiempo (una deuda tiene una tasa, no un histórico)
- Capitalización de la mora (decisión ratificada: no se capitaliza)
- Fechas de corte de tarjeta de crédito — es su propio módulo, sobre `Account`, no sobre `Debt`
- Recordatorios / notificaciones de vencimiento

## Dependencies
- **Interno**: `Transaction` + `createTransaction()` (spec `transactions.md`), `Account` (spec `accounts.md`), `src/lib/money.ts`, `src/lib/period.ts`, `src/lib/api-auth.ts`, `src/lib/errors.ts`, `AccountSelect.tsx`
- **Externo**: Ninguna nueva. Newton-Raphson se implementa a mano (son ~15 líneas); no se añade una librería financiera para una sola fórmula

## Estimated Effort
- Días: 4
- Complejidad: Alta — no por el CRUD (que es el de siempre) sino por `debt-math.ts`: la reproducción mes a mes y el despeje de la tasa son donde de verdad se puede estar equivocado, y donde un error silencioso le da al usuario un número falso sobre su propio dinero

## Notes
1. **El saldo pendiente nunca se denormaliza.** Es la decisión contraria a `Account.currentBalance`, y a propósito: el interés corre con el calendario, no con una escritura. Un campo guardado necesitaría un cron mensual para no mentir, y se desincronizaría en cuanto se editara un pago viejo. Misma filosofía que el gasto real de Presupuestos.
2. **Un pago de deuda es una transacción, no una entidad aparte.** El dinero sale de verdad de la cuenta. Modelarlo aparte habría creado un segundo libro contable en silencio.
3. **La mora no se capitaliza** (decisión ratificada 2026-07-13). La mayoría de los acreedores reales sí capitalizarían el faltante; el prestamista informal del dueño no. Capitalizar sobreestimaría *su* deuda; ignorar el faltante la subestimaría. Por eso el capital no crece **y** la mora se lleva aparte y se muestra.
4. **Una tasa despejada se marca siempre como estimada.** Es un número derivado, no un dato del contrato, y confundirlos es exactamente el error que hace que una app de finanzas pierda la confianza del usuario.
5. **Despejar la tasa exige los tres datos** (monto original, cuota, número de cuotas). Con dos hay dos incógnitas y una sola ecuación: cualquier número sería inventado. La app dice que no puede, en vez de adivinar.
