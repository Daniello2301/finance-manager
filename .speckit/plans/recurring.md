# Implementation Plan: Gastos e Ingresos Recurrentes

## Specification Reference
`.speckit/specs/recurring.md` — Fase 2. La spec ya prescribe la arquitectura (motor puro, generador
create-first/advance-after, índice único parcial, endpoints). Este plan la respeta y resuelve la única
tensión con lo ya construido.

---

## Phase 0: Constitution Check

| Principio | Cumplimiento |
|---|---|
| 2. Database-First | `RecurringTransaction` es un modelo Mongoose con su Zod. Idempotencia por índice único, no por confianza en el código |
| 3. Test-First | `recurrence.ts` (motor de fechas) se escribe **test-first sí o sí, al 100%** — un error ahí devuelve una fecha falsa, no revienta. Es el análogo de `debt-math.ts` |
| 5. TS Strict | Sin `any`, sin `@ts-ignore` |
| 8. Multi-Tenant | `userId` en cada índice; static `findForUser` copiado de `Debt.ts`. El sweep de `catch-up` cruza solo los recurrentes del usuario que abre la app, no un cron global |
| 9. Money as Integer Minor Units | `amount` entero. Confirmar con otro monto no toca la plantilla (FR-007) |

**La tensión, resuelta (ratificada en el Decision Log, 2026-07-15).** La spec original (FR-012) decía
que la generación automática pasa `confirmOverdraft: true`. Ese mecanismo fue **derogado** el 2026-07-14
(Saldos Honestos: el sobregiro en creación se bloquea sin override). Resolución: un cargo automático que
ya venció es un **hecho consumado** — se registra igual y deja la cuenta en descubierto, exactamente la
regla de Saldos. El mecanismo es una bandera de servicio **`allowOverdraft`** que **solo** activa el
generador y que **ninguna ruta HTTP expone**. Un recurrente **manual** que sobregira NO la usa: pasa por
la creación normal y hereda el diálogo de las cuatro salidas.

## Phase 1: Datos

**`RecurringTransaction`** (nueva colección). Campos de FR-002: `name`, `type`, `amount`, `accountId`,
`categoryId`, `frequency` (`weekly`/`biweekly`/`monthly`/`yearly`), `anchorDay`, `startDate`,
`nextDueDate`, `autoGenerate`, `endDate?`, `isPaused`, `isArchived`. Static `findForUser` (patrón `Debt.ts`).

**`Transaction.recurringOccurrenceKey?`** (nuevo, `immutable`, p. ej. `"2026-07-20"`). `recurringTransactionId`
ya existe. **No se puede usar `Transaction.date`** para la idempotencia: el usuario puede editar la fecha
después y la clave cambiaría, permitiendo un duplicado en la siguiente pasada. Índice único **parcial**:
`{ userId, recurringTransactionId, recurringOccurrenceKey }`, `partialFilterExpression` sobre los docs que
tienen `recurringTransactionId` (para no colisionar todas las transacciones normales, que no lo tienen).

## Phase 2: El motor de fechas (`src/lib/recurrence.ts` — puro, sin Mongoose)

Igual que `debt-math.ts`/`period.ts`/`card-cycle.ts`: puro, UTC, importable por el cliente.
- `nextOccurrence(from, frequency, anchorDay)` — con **clamp a fin de mes** (Scenario 8: día 31 → 28/29 en feb, vuelve al 31 en marzo).
- `firstDueDate(startDate, frequency, anchorDay, today)` — el primer vencimiento ≥ hoy (FR-003, sin backfill).
- `dueOccurrences(recurring, today)` — lista de vencimientos pendientes (`nextDueDate <= hoy`, respetando `endDate`), con **tope de seguridad** (p. ej. 60) contra un `startDate` mal tecleado.
- `occurrenceKey(date)` — `YYYY-MM-DD` en UTC.

## Phase 3: El generador (`src/lib/services/recurring.ts`)

**Orden contraintuitivo, y es el correcto**: crea la transacción **primero**, avanza `nextDueDate` **después**.
Si se avanzara primero y la creación fallara, el vencimiento se perdería. Al revés converge solo: si la
creación tiene éxito y el avance falla, la siguiente pasada reintenta, el **índice único la rechaza**
(error 11000), se captura *ese* error concreto y se avanza. Sin transacciones distribuidas, sin poder
duplicar dinero (Scenario 3).

- `catchUp(userId, today)` — materializa los vencidos de los `autoGenerate: true`, no pausados, no archivados.
  Reutiliza `createTransaction(userId, input, { allowOverdraft: true })`. Idempotente por diseño.
- `pendingConfirmations(userId, today)` — los vencidos de los `autoGenerate: false` (los muestra, no crea).
- `confirmOccurrence(userId, id, occurrenceKey, amount?)` — materializa un pendiente manual (monto opcional,
  FR-007: no toca la plantilla). Sin `allowOverdraft` → hereda el bloqueo/diálogo si sobregira.
- `skipOccurrence(userId, id, occurrenceKey)` — avanza sin crear nada (Scenario 6).

`createTransaction` gana un 3er parámetro `options?: { allowOverdraft?: boolean }` (default false), pasado a
`createTransactionInSession`. Solo `recurring.ts` lo usa con `true`. Transferencias y rutas jamás.

## Phase 4: API (patrón de rutas ya establecido)
- `GET/POST /api/recurring`
- `GET/PATCH/DELETE /api/recurring/[id]` (DELETE archiva — FR-010)
- `POST /api/recurring/[id]/confirm` (body `{ occurrenceKey, amount? }`)
- `POST /api/recurring/[id]/skip` (body `{ occurrenceKey }`)
- `POST /api/recurring/catch-up`
Toda ruta valida pertenencia de `accountId`/`categoryId` (FR-001), ajena → 404 (Scenario 9).

## Phase 5: Frontend (patrón Cuentas/Deudas)
`/dashboard/recurring` (lista + `RecurringForm` + `RecurringCard`), tarjeta de **pendientes por confirmar**
(con corrección de monto, US3), widget **"Próximos vencimientos"** en el panel (US5). `useSeedForm` para el
formulario. El **`catch-up` se dispara al cargar el panel** (una mutación que invalida accounts/transactions/
dashboard). `recurrence.ts` alimenta el widget en el cliente sin tocar el servidor.

## Success Criteria
Los 9 escenarios como tests. El 3 (no duplicar, idempotencia real contra el índice) y el 8 (día 31) con
test dedicado. `recurrence.ts` al 100%. Cobertura global ≥ 80%. E2E contra producción.

## Out of Scope (de la spec)
Backfill · notificaciones push · detección automática de recurrencias · montos variables previstos.
