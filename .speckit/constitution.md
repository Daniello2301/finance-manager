# Project Constitution: Personal Finance Manager

**Status**: Ratified
**Last Updated**: 2026-07-08
**Ratified By**: informatica@fabricato.com — 2026-07-08

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
