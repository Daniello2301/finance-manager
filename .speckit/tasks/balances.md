# Task Breakdown: Saldos honestos

Spec: `.speckit/specs/balances.md` · Constitución: 4 entradas nuevas en el Decision Log (2026-07-14).

## Phase 0: El bug que este módulo destapa ⚠️

- [x] **T001** — Test primero: un ingreso con `debtId` NO se cuenta como pago. (`debts.integration.test.ts`)
- [x] **T002** — `paymentsFor()` filtra `type: "expense"`. Sin esto, el desembolso salda la deuda con el propio dinero que te prestó: una deuda de 17.000.000 reportaría cero. No revienta — solo devuelve un número falso sobre el dinero del usuario, que es el único bug que este módulo puede tener de verdad.

## Phase 1: La regla

- [x] **T010** — `Transaction.origin` (`"disbursement" | "adjustment"`), `immutable`. Distingue los ingresos que no son ingresos.
- [x] **T011** — `src/lib/balance.ts`: `availableBalance()` + `isOverdrawn()`, puras y **sin Mongoose** (las usa el navegador). La fórmula estaba duplicada a mano en `AccountCard`.
- [x] **T012** — `assertSufficientFunds()` deja de aceptar `confirmOverdraft`. Es una **regla**, no un aviso.
- [x] **T013** — `updateTransaction()` **ya no** valida saldo. Editar es corregir un hecho, no decidir un gasto: bloquearlo encerraba al usuario en su propio error. Test explícito de que una edición SÍ puede dejar en descubierto.
- [x] **T014** — `confirmOverdraft` fuera de `validation/transactions.ts`, `validation/debts.ts`, `payDebt()` y ambos formularios.
- [x] **T015** — Borrado el test que exigía bloquear la edición. Un test de una regla que ya no sostenemos es peor que ningún test.

## Phase 2: Las cuatro salidas

- [x] **T020** — `disburseDebt()` + `POST /api/debts/[id]/disbursement`. 409 si ya tiene desembolso. Delega en `createTransaction()`.
- [x] **T021** — `adjustAccountBalance()` + `POST /api/accounts/[id]/adjustment`. La categoría "Ajuste de saldo" se crea al vuelo (los usuarios existentes no la tienen entre sus 21 sembradas); el índice único `{userId,name,type}` es la red contra la carrera.
- [x] **T022** — `useDisburseDebt()` y `useAdjustBalance()`.
- [x] **T023** — `InsufficientFundsDialog`: las 4 salidas, con el préstamo propuesto **por el faltante**. Estado sembrado por `key` + inicializadores de `useState`, **no** por un `useEffect` (un `setState` síncrono en un efecto es un render en cascada, y `react-hooks/incompatible-library` lo rechaza con razón).
- [x] **T024** — Cableado en `TransactionForm` y `DebtPaymentForm`, con reintento automático tras resolver.

## Phase 3: El descubierto

- [x] **T030** — `AccountCard` marca la cuenta en descubierto (anillo + cifra en rojo + explicación). Una tarjeta dentro de su cupo **no** está en descubierto.

- [x] **T031** — `getMonthlyTrend()` excluye `origin` de los ingresos (`origin: {$exists: false}`). Un desembolso o un ajuste acreditan la cuenta igual que un sueldo, pero el usuario **no ganó** ese dinero: contarlos reportaría el mes en que te endeudaste como un mes en que te fue bien. Es la peor clase de error que esta app puede cometer, porque **se lee como una buena noticia**.

## Pendiente

- [ ] **T040** — Widget de descubierto en el panel (hoy solo se ve en la lista de cuentas).
- [ ] **T041** — Verificación end-to-end contra producción con los números reales del dueño.

## Legend
✅ hecho · ⚠️ crítico · 🚫 bloqueado
