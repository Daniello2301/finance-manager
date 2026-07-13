# Project Constitution: Personal Finance Manager

**Status**: [NEEDS CLARIFICATION - Ratify by X date]  
**Last Updated**: 2026-05-22  
**Ratified By**: [NEEDS CLARIFICATION - Name & Date]

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

**Rationale**: Avoid complex caching/queuing logic until proven necessary.

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

---

## Architectural Boundaries

### Backend (Next.js API Routes)
- **Responsibility**: Database operations, validation, business logic, NextAuth
- **Framework**: Next.js API Routes + Mongoose
- **Validation**: Zod schemas for all inputs
- **Rate Limiting**: [NEEDS CLARIFICATION - implement per endpoint]

### Frontend (React Components)
- **Responsibility**: UI rendering, user interactions, form handling
- **Framework**: React 19 + Tailwind CSS v4
- **State**: Zustand (UI) + React Query (data)
- **Form Validation**: react-hook-form + Zod
- **Charts**: Recharts for visualizations

### Database (MongoDB)
- **Responsibility**: Persistent data storage
- **ORM**: Mongoose v9.6+
- **Backup**: [NEEDS CLARIFICATION - backup strategy]
- **Indexes**: Document performance-critical queries

---

## Quality Gates

### Code Review Checklist
- [ ] Follows TypeScript strict mode
- [ ] Test coverage >= 80%
- [ ] No console.logs or TODOs left
- [ ] API endpoints documented
- [ ] Database migrations tested
- [ ] Security: No hardcoded secrets, proper auth checks

### Deployment Requirements
- [ ] All tests pass
- [ ] No breaking changes to API (unless major version bump)
- [ ] Database migrations are reversible
- [ ] Performance acceptable (profiled if new queries added)

---

## Decision Log

| Date | Decision | Owner | Rationale |
|------|----------|-------|-----------|
| 2026-05-22 | [NEEDS CLARIFICATION]: Initial stack decisions | [User] | [NEEDS CLARIFICATION] |

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

**Reviewed By**: [NEEDS CLARIFICATION]  
**Ratified**: [NEEDS CLARIFICATION]  
**Effective Date**: [NEEDS CLARIFICATION]
