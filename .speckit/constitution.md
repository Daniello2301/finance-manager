# Project Constitution: Personal Finance Manager

**Status**: Ratified
**Last Updated**: 2026-07-13
**Ratified By**: informatica@fabricato.com — 2026-07-08
**Last Amendment**: 2026-07-13 (Fase 2 scope: Deudas added — see Decision Log)

---

## Core Principles

### 1. Stack Lock
**Decision**: Next.js 16 (App Router) + React 19 + TypeScript (strict) + MongoDB + NextAuth

**Rationale**: Modern, stable, and proven for full-stack web apps. App Router enables better code organization. Strict TypeScript prevents runtime bugs.

**Amendment Threshold**: Breaking changes in Next.js major versions require owner approval.

### 2. Database-First Architecture
**Decision**: Mongoose schemas define the contract. API routes validate against schemas. Frontend consumes typed API responses.

**Rationale**: Single source of truth prevents sync issues. Zod validation on both client and server.

**Enforcement**: No raw MongoDB queries. All DB operations through Mongoose.

### 3. Test-First Development
**Decision**: Write tests BEFORE implementation code. Minimum 80% coverage.

**Rationale**: Specs define test cases. Tests serve as executable documentation.

**Enforcement**: CI/CD blocks merges if coverage < 80%.

### 4. No Premature Optimization
**Decision**: Correctness first. Performance optimization only after profiling shows bottleneck.

**Rationale**: Avoid complex caching/queuing logic until proven necessary. Exception: denormalized fields that back a read on nearly every page (e.g. `Account.currentBalance`) are decided up front, not added speculatively — see Principle 8.

### 5. TypeScript Strict Mode Only
**Decision**: `strict: true` in tsconfig.json. No `@ts-ignore` without approval.

**Rationale**: Catches class of bugs at compile-time. Enables safe refactoring.

**Enforcement**: Linter blocks commits with `@ts-ignore`.

### 6. Specification-Driven Development
**Decision**: Features start with detailed specs (PRDs). Specs include acceptance criteria (Given/When/Then). No `[NEEDS CLARIFICATION]` markers in signed-off specs.

**Rationale**: Reduces ambiguity. Specs are executable acceptance tests.

### 7. Zustand for Client State, React Query for Server State
**Decision**: Zustand for UI state (modals, filters, view toggles). React Query for server-side data (transactions, categories, balances).

**Rationale**: Clear separation of concerns. React Query handles caching + sync.

**Enforcement**: No useState for data fetching. No Redux or Context for simple state.

### 8. Multi-Tenant Data Isolation
**Decision**: The product is multi-tenant — many independent users with fully isolated data (no sharing/household features). Every tenant-scoped Mongoose collection carries a `userId` field that is always the **first** key of its compound indexes. Tenant scoping is enforced via explicit static model helpers (e.g. `Account.findForUser(userId, filter)`), not a global Mongoose query middleware — a hard middleware would block legitimate system-level queries (e.g. the recurring-transactions cron sweep across all users).

**Rationale**: Keeps every per-tenant query index-covered and prevents accidental cross-tenant data leaks, while still allowing the few legitimate cross-tenant system queries to exist explicitly and reviewably.

**Enforcement**: Code review checks that new API routes fetch data through the `findForUser`-style helper, never a bare `Model.find({...})` keyed only on a non-`userId` field.

### 9. Money as Integer Minor Units
**Decision**: All monetary fields (`amount`, `currentBalance`, `limitAmount`, `targetAmount`, etc.) are stored as integers in minor currency units (like Stripe cents), never as floats or `Decimal128`. Conversion/formatting goes through a shared `src/lib/money.ts` (currency → exponent map, `toMinorUnits`/`fromMinorUnits`/`formatMoney`).

**Rationale**: Exact `$inc` arithmetic for balances, no floating-point drift, and no per-schema `Decimal128` JSON serialization workarounds. Default currency is COP (0 decimal exponent); the exponent map keeps the door open for USD/EUR-style 2-decimal currencies in the multi-currency phase without a schema change.

---

## Architectural Boundaries

### Backend (Next.js API Routes)
- **Responsibility**: Database operations, validation, business logic, NextAuth
- **Framework**: Next.js API Routes + Mongoose
- **Validation**: Zod schemas for all inputs
- **Rate Limiting**: Not required for MVP. Before production launch, add a per-IP rate limiter (e.g. Upstash Ratelimit or an in-memory sliding-window limiter) on `/api/auth/signup` and `/api/auth/login` only — these are the only endpoints exposed to unauthenticated requests and thus the only brute-force surface. All other routes already require a valid session, which is a sufficient throttle for MVP.

### Frontend (React Components)
- **Responsibility**: UI rendering, user interactions, form handling
- **Framework**: React 19 + Tailwind CSS v4
- **State**: Zustand (UI) + React Query (data)
- **Form Validation**: react-hook-form + Zod
- **Charts**: Recharts for visualizations

### Database (MongoDB)
- **Responsibility**: Persistent data storage
- **ORM**: Mongoose v9.6+
- **Backup**: Use the hosting provider's automated backups (e.g. MongoDB Atlas continuous/daily backups on the cluster tier in use). Minimum retention: 7 days. No custom backup tooling is built by the app itself — this is an infrastructure/ops configuration, not application code.
- **Indexes**: Document performance-critical queries. Every tenant-scoped collection indexes `userId` as the first compound-index key (see Principle 8).

---

## Quality Gates

### Code Review Checklist
- [ ] Follows TypeScript strict mode
- [ ] Test coverage >= 80%
- [ ] No console.logs or TODOs left
- [ ] API endpoints documented
- [ ] Database migrations tested
- [ ] Security: No hardcoded secrets, proper auth checks
- [ ] Tenant-scoped queries go through a `findForUser`-style helper (Principle 8)
- [ ] Monetary fields use integer minor units, not floats (Principle 9)

### Deployment Requirements
- [ ] All tests pass
- [ ] No breaking changes to API (unless major version bump)
- [ ] Database migrations are reversible
- [ ] Performance acceptable (profiled if new queries added)

---

## Decision Log

| Date | Decision | Owner | Rationale |
|------|----------|-------|-----------|
| 2026-05-22 | Initial stack decisions: Next.js 16 + Mongoose + NextAuth v4 | informatica@fabricato.com | Modern, well-supported full-stack combination for a small team building a web-only app. |
| 2026-07-08 | Product scope defined: multi-tenant personal finance manager, Spanish UI, COP default currency, web-only on Vercel. MVP = Auth + Cuentas + Categorías + Transacciones + Presupuestos + Dashboard; Fase 2 = Recurrentes + Metas de ahorro + Multi-moneda. | informatica@fabricato.com | Established via product Q&A before writing module specs, to avoid rework across the shared data model. |
| 2026-07-08 | `Account.currentBalance` is denormalized and updated inside Mongoose multi-document transactions, not computed on read. | informatica@fabricato.com | Balance is read on nearly every page (navbar, dashboard, transaction form); MongoDB replica sets (including Atlas free tier) support ACID transactions, removing the historical objection to denormalization. A `recomputeAccountBalance` utility exists as a correctness backstop. |
| 2026-07-08 | Multi-tenant isolation enforced via `userId`-prefixed indexes + explicit `findForUser` helpers, not global Mongoose middleware. | informatica@fabricato.com | Global find-middleware can't cleanly allow the legitimate cross-tenant query needed by the recurring-transactions cron sweep. |
| 2026-07-08 | Money stored as integer minor units across all schemas. | informatica@fabricato.com | Avoids floating-point drift in balance arithmetic and `Decimal128` JSON-serialization friction. |
| 2026-07-13 | **Fase 2 scope amended**: Fase 2 = Deudas + Recurrentes + Metas de ahorro + Multi-moneda. Deudas is added and sequenced **first**. | informatica@fabricato.com | Emerged from real use of the MVP. The owner carries several debts (an informal loan at a monthly rate, a bank loan of known instalment but unknown rate, a BNPL plan) and the app could not represent any of them: a debt has a principal, a rate, an instalment and a payoff — none of which fit on a `Category`, which is only a label. Sequenced first because it is the largest gap between what the app records and what the owner actually needs to decide. |
| 2026-07-13 | A **debt payment is a `Transaction`** (an expense carrying a `debtId`), not a separate payment entity. | informatica@fabricato.com | The money genuinely leaves an account, so it must move `Account.currentBalance`, appear in the transaction history and count against budgets. Modelling payments separately would have created a second, silent ledger. Reuses `createTransaction` wholesale. |
| 2026-07-13 | A debt's **outstanding balance is computed on read**, never denormalized — replayed month by month from `principal`, the rate and the payment history. | informatica@fabricato.com | Deliberately the opposite call to `Account.currentBalance` (see 2026-07-08), and for the opposite reasons: interest accrues with the calendar rather than with a write, so a denormalized figure would need a monthly cron to stay true and would silently drift whenever a past payment was edited. Same reasoning as Presupuestos' `spentAmount`. Read volume is low (one module page + one dashboard widget). |
| 2026-07-13 | **Unpaid interest is tracked as arrears, and is NOT capitalized into the principal.** | informatica@fabricato.com | When a payment does not cover the month's interest, most real lenders capitalize the shortfall; the owner's informal lender does not. Capitalizing would overstate the debt for the owner's actual case. But dropping the shortfall silently would understate it, so the accrued unpaid interest is carried and surfaced as its own figure. The principal reflects the owner's reality; the arrears figure keeps the model honest. |
| 2026-07-14 | **El dinero no aparece de la nada.** `confirmOverdraft` (Fase A) queda **derogado**: un gasto que excede el saldo disponible ya no se puede forzar. La línea que ordena el módulo es **si el usuario todavía puede evitarlo**: una *decisión* (un gasto que está registrando) se **frena** y se le pregunta de dónde salió el dinero; un *hecho consumado* (corregir un movimiento pasado, un cargo automático que el banco ya hizo) se **anota** y deja la cuenta marcada **en descubierto**, en rojo. | informatica@fabricato.com | Petición del dueño: "no tiene sentido que la cuenta me quede en negativo; más bien que el usuario preste dinero y cree una deuda". `confirmOverdraft` no dejaba rastro — solo un saldo negativo mudo, sin explicación ni auditoría. Pero negarse a anotar un hecho consumado tampoco lo deshace: solo hace que la app muestre un saldo *más* falso que el real, creyendo que protege. De ahí la distinción. Una tarjeta de crédito dentro de su cupo **no** está en descubierto: gastar dinero que no tienes es su función, y ya se mide contra `creditLimit`. |
| 2026-07-14 | Un gasto sin saldo se resuelve con **cuatro salidas explícitas**, no con una escapatoria: *lo pedí prestado* (crea una deuda que **desembolsa** en la cuenta), *me equivoqué de cuenta*, *falta registrar un ingreso*, o *el saldo de la app está mal* (**ajuste de saldo**). La deuda se propone por **el faltante**, no por el gasto entero. | informatica@fabricato.com | El faltante es lo único que se puede *demostrar* que vino de fuera; el resto ya lo tenías. Sobre el ajuste: es `confirmOverdraft` disfrazado y se acepta a sabiendas, porque la diferencia es real — un ajuste **queda escrito**, con categoría, monto y fecha, visible en el historial y auditable. Eso es contabilidad; un saldo negativo mudo era rendirse. Va el último de la lista y nunca como botón por defecto. |
| 2026-07-14 | El **desembolso** de una deuda (el dinero prestado entrando a una cuenta) es **opcional y solo para deudas que nacen desde este flujo**. Las deudas ya registradas no lo llevan ni lo llevarán, y ninguna migración las toca. | informatica@fabricato.com | Las deudas existentes del dueño (17.000.000 informales, el crédito bancario, ADDI) son dinero que llegó hace meses, fuera de la app, y ya está gastado. Darles un desembolso les inyectaría un saldo fantasma en una cuenta. Corolario crítico: `paymentsFor()` **debe filtrar `type: "expense"`** — sin eso, el ingreso del desembolso se contaría como un pago y **la deuda se saldaría con el propio dinero que te prestó**. |
| 2026-07-14 | **Rechazado** (no pospuesto): recortar la corrección de un movimiento pasado al saldo disponible. | informatica@fabricato.com | El dueño lo propuso: borrar un ingreso falso de 3.000.000 solo hasta dejar la cuenta en cero. Si el ingreso real eran 1.000.000, esa regla dejaría escrito un ingreso de **2.000.000 — un número que ni ocurrió ni tecleó nadie**. Para no enseñar un saldo feo, la app falsificaría el historial. El saldo se recalcula; el historial es lo que el usuario cree que pasó. |
| 2026-07-14 | **Rechazado** (no pospuesto): crear una deuda por cada compra con tarjeta de crédito. | informatica@fabricato.com | Una tarjeta **ya es** una deuda: es una `Account` con `creditLimit` cuyo saldo negativo es lo que se le debe al banco. Una deuda por compra lo contaría dos veces, y cinco cafés serían cinco deudas con su tasa y su cuota, dejando el módulo inservible para lo que importa. Lo que el dueño necesita de verdad se cubre con el **ciclo de facturación** (día de corte, día de pago) y con marcar **una compra concreta como "a cuotas"** — que ahí sí es una deuda real, con capital, plazo y tasa. |
| 2026-07-14 | The app is **installable (PWA)**: a web manifest plus a service worker. This does not change the 2026-07-08 "web-only on Vercel" scope — there is no native codebase and no app store; it is the same Next.js app, which the OS is now allowed to keep an icon for. | informatica@fabricato.com | Ratified because a service worker is an architectural pattern under the Amendment Process: it sits in front of *every* request the app makes, which is not a change that should arrive unannounced in a diff. The owner uses this on his phone daily and wants it on the home screen without browser chrome. |
| 2026-07-14 | The service worker caches the **app shell only, and must NEVER cache `/api/`** — data always comes from the network or not at all. | informatica@fabricato.com | This is a money app. A cached balance is a number that was true once, presented as if it were true now — strictly worse than an error, because an error is honest and the user knows to retry. The shell (content-hashed `/_next/static/` bundles, icons, manifest) is immutable, so a cache hit there can never be stale. When a navigation cannot reach the network the user gets an explicit "sin conexión" page, not yesterday's dashboard. Genuine offline support — a queued-write log with idempotency keys — remains separate, unbuilt, and deliberately out of this decision's scope. |
| 2026-07-13 | Every field of a debt except its **name is optional**; the interest rate may be **derived** when principal + instalment + term are all known. | informatica@fabricato.com | The owner knows different subsets of the facts for different debts (for one he knows the rate; for another only the instalment and the term). A form that demanded everything would simply not be filled in. Where the rate is unknown *and* underivable, the debt is still recorded — it just carries no interest projection, rather than a fabricated one. Deriving a rate requires all three of principal, instalment and term: with only two the equation has two unknowns and any number produced would be invented. |

---

## Amendment Process

To change this constitution:

1. **Proposal Phase**: Document the change and rationale
2. **Review Phase**: Owner reviews with technical lead
3. **Ratification Phase**: Update this document with approval + date
4. **Communication**: Notify team of new rules

**Require Ratification For**:
- Technology choices (frameworks, languages)
- Minimum quality standards (coverage, type checking)
- Architectural patterns (state management, API design)

**Can Change Without Ratification**:
- Tool versions (tsconfig, eslint rules)
- Directory structure
- Naming conventions
- Temporary workarounds (with clear removal date)

---

## Notes

This constitution ensures the project remains maintainable, testable, and scalable as it grows. Break these rules only with explicit approval documented below.

### Documented Exceptions
[None yet]

---

## Approval

**Reviewed By**: informatica@fabricato.com
**Ratified**: 2026-07-08
**Effective Date**: 2026-07-08

**Amendment 1** — 2026-07-13, ratified by informatica@fabricato.com.
Scope only: Fase 2 gains a **Deudas** module, sequenced first, with the five
decisions recorded in the Decision Log above. No Core Principle is changed, and
no Documented Exception is required — Deudas is built inside the existing rules
(integer minor units per Principle 9, `userId`-first indexes and a `findForUser`
static per Principle 8, test-first at ≥80% coverage per Principle 3).
