# Task Breakdown: User Authentication & Session Management

**Specification**: `.speckit/specs/authentication.md`  
**Plan**: `.speckit/plans/authentication.md`  
**User Stories Covered**: [US1], [US2], [US3], [US4], [US5], [US6]

---

## Phase 0: Research & Setup

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T001] | Set up .env.local with NEXTAUTH_SECRET and MONGODB_URI | 0.5d | - | - | | ✅ |
| [T002] | Verify MongoDB connection works (test query) | 0.5d | - | [T001] | | ✅ |
| [T003] | Read NextAuth.js v4 docs and authentication patterns | 1d | - | - | | ✅ |
| [T004] | Install & configure Vitest + RTL + jsdom + coverage-v8 (`vitest.config.ts`, `vitest-setup.ts`) | 0.5d | - | - | | ✅ |
| [T005] | Add `mongodb-memory-server` and shared test helper (`src/lib/test-utils/mongoMemoryServer.ts`) | 0.5d | - | [T004] | | ✅ |
| [T006] | Add `test`, `test:run`, `test:coverage`, `type-check` scripts to `package.json` | 0.25d | [P] | [T004] | | ✅ |
| [T007] | Create `src/lib/db.ts` (cached Mongoose connection + `getMongoClientPromise()`) | 0.5d | - | [T002] | | ✅ |
| [T008] | [UNIT TEST] Write failing tests for `src/lib/db.ts` | 0.25d | [P] | [T007] | | ✅ |
| [T009] | Implement `db.ts` tests — all pass | 0.25d | - | [T008] | | ✅ |

---

## Phase 1: Database & Backend Models

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T010] | Create User Mongoose model (`src/lib/models/User.ts`) with schema | 0.5d | - | [T009] | | ✅ |
| [T011] | [UNIT TEST] Write failing tests for User model validation | 0.5d | [P] | [T010] | | ✅ |
| [T012] | Implement User model tests — all pass | 0.5d | - | [T011] | | ✅ |
| [T013] | Create Zod validation schemas for signup/login (`src/lib/validation/auth.ts` — split by domain, see plan) | 0.5d | [P] | [T003] | | ✅ |
| [T014] | [UNIT TEST] Write failing tests for Zod schemas | 0.5d | [P] | [T013] | | ✅ |
| [T015] | Implement Zod schema tests — all pass | 0.5d | - | [T014] | | ✅ |

---

## Phase 2: Backend - Authentication API

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T019.5] | Spike: verify `@next-auth/mongodb-adapter@1.1.3` (peer `mongodb ^4\|^5`) works against installed `mongodb@7.4.0` — round-trip `createSession`/`getSessionAndUser`/`deleteSession` against memory-server. Stop and escalate to owner if it fails (Constitution Principle 1, stack lock) | 0.5d | - | [T012] | | ✅ **superseded** — spike passed, but wiring `NextAuth(authOptions)` for real (not just the adapter in isolation) surfaced `CALLBACK_CREDENTIALS_JWT_ERROR`: NextAuth v4's Credentials provider only supports the JWT session strategy, not `strategy: "database"`. Adapter removed entirely; see T020 |
| [T020] | Set up NextAuth.js configuration (`src/lib/auth.ts`, `verifyCredentials()` helper, `src/app/api/auth/[...nextauth]/route.ts`) — **corrected mid-session**: `session.strategy: "jwt"`, no `MongoDBAdapter`/`@next-auth/mongodb-adapter` (uninstalled). User records are owned solely by our own Mongoose `User` model via the signup route; `jwt()`/`session()` callbacks carry `user.id` into the token/session | 1d | - | [T012], [T019.5] | | ✅ |
| [T021] | [UNIT TEST] Write failing tests for signup endpoint | 0.5d | [P] | [T020] | | ✅ |
| [T022] | Create signup API route (`src/app/api/auth/signup/route.ts`) | 1d | - | [T021] | | ✅ |
| [T023] | Implement signup logic (validate, hash password, create user) | 1d | - | [T022] | | ✅ |
| [T024] | All signup tests pass | 0.5d | - | [T023] | | ✅ |
| [T025] | [UNIT TEST] Write failing tests for login endpoint | 0.5d | [P] | [T020] | | ✅ |
| [T026] | Create login API route (`src/app/api/auth/login/route.ts`) | 1d | - | [T025] | | ✅ |
| [T027] | Implement login logic (verify credentials via `verifyCredentials()`, return 200/401 — thin route, does NOT set the session cookie itself; frontend calls NextAuth's `signIn('credentials', ...)` against `[...nextauth]` for that, next session — see plan's "Diseño de /login" decision) | 1d | - | [T026] | | ✅ |
| [T028] | All login tests pass | 0.5d | - | [T027] | | ✅ |
| [T029] | [UNIT TEST] Write failing test for logout endpoint | 0.5d | [P] | [T020] | | ✅ |
| [T030] | Create logout API route (`src/app/api/auth/logout/route.ts`) | 0.5d | - | [T029] | | ✅ |
| [T031] | All logout tests pass | 0.5d | - | [T030] | | ✅ |

---

## Phase 3: Frontend - Components & Forms

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T040] | Create test files for SignupForm and LoginForm (empty) | 0.5d | [P] | [T028] | | ✅ |
| [T041] | [US1] Create SignupForm.tsx with react-hook-form + Zod | 1d | [P] | [T040] | | ✅ |
| [T042] | [US1] Implement signup form submission (POST to /api/auth/signup) | 1d | - | [T041] | | ✅ |
| [T043] | [US1] SignupForm tests pass — validation, submission, errors | 0.5d | - | [T042] | | ✅ |
| [T044] | [US2] Create LoginForm.tsx with react-hook-form + Zod | 1d | [P] | [T040] | | ✅ |
| [T045] | [US2] Implement login form submission (POST to /api/auth/login) | 1d | - | [T044] | | ✅ |
| [T046] | [US2] LoginForm tests pass — validation, submission, session creation | 0.5d | - | [T045] | | ✅ |
| [T047] | Create signup page (`src/app/(auth)/signup/page.tsx`) | 0.5d | [P] | [T043] | | ✅ |
| [T048] | Create login page (`src/app/(auth)/login/page.tsx`) | 0.5d | [P] | [T046] | | ✅ |
| [T049] | Create auth layout (no navbar) (`src/app/(auth)/layout.tsx`) | 0.5d | [P] | [T047], [T048] | | ✅ — also redirects to `/dashboard` if already authenticated (Scenario 7) |

---

## Phase 4: Navigation & Protected Routes

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T050] | [US3] Create Navbar.tsx component (user name + logout) | 0.5d | - | [T028] | | ✅ |
| [T051] | [US3] Wire Navbar to NextAuth session (useSession hook) | 0.5d | - | [T050] | | ✅ |
| [T052] | [US4] Implement logout button in Navbar (signOut callback) | 0.5d | - | [T051] | | ✅ — calls `next-auth/react`'s `signOut()` directly, not `/api/auth/logout` (that route stays available as a separate app-owned endpoint, just not wired to this button) |
| [T053] | Create ProtectedRoute wrapper component | 0.5d | - | [T028] | | ✅ — **corrected**: implemented as an async Server Component (`getServerSession` + `redirect`), not the spec's literal client `useSession()` wrapper — no flash of protected content, matches Next 16 App Router best practice. Confirmed with owner before implementation |
| [T054] | Apply ProtectedRoute to dashboard (`src/app/dashboard/`) | 0.5d | - | [T053] | | ✅ |
| [T055] | Create dashboard layout with Navbar | 0.5d | - | [T049], [T052] | | ✅ |
| [T056] | Create root layout with Navbar for non-auth pages | 0.5d | [P] | [T050] | | ✅ — **corrected**: Navbar lives in a new `src/app/(main)/layout.tsx`, not the literal root `layout.tsx` (which would also wrap the navbar-less `(auth)` group). True root layout only holds fonts/metadata/`<Providers>`. Landing page moved to `src/app/(main)/page.tsx` |

---

## Phase 5: Integration & E2E Testing

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T060] | Write integration test: complete signup flow | 0.5d | - | [T043] | | ⬜ |
| [T061] | Write integration test: complete login flow | 0.5d | - | [T046] | | ⬜ |
| [T062] | Write integration test: session persistence (reload page) | 0.5d | - | [T051] | | ⬜ |
| [T063] | Write integration test: logout and redirect | 0.5d | - | [T052] | | ⬜ |
| [T064] | Manual E2E test: signup → login → dashboard → logout | 1d | - | [T062], [T063] | | ⬜ |
| [T065] | Test error scenarios (duplicate email, weak password, invalid credentials) | 1d | - | [T064] | | ⬜ |
| [T066] | Test security: no password leaks in logs/responses | 0.5d | - | [T065] | | ⬜ |
| [T067] | Verify test coverage >80% (run coverage report) | 0.5d | - | [T066] | | ⬜ |

---

## Phase 6: Code Review & Deployment

| ID | Task | Est. | [P] | Depends | Owner | Status |
|-------|------|-----|-----|---------|-------|--------|
| [T070] | Code review: all changes meet quality gates | 1d | - | [T067] | | ⬜ |
| [T071] | Fix code review feedback | TBD | - | [T070] | | ⬜ |
| [T072] | Final security checklist (OWASP auth) | 0.5d | - | [T071] | | ⬜ |
| [T073] | Merge to main and mark feature complete | 0.5d | - | [T072] | | ⬜ |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| [TXXX] | Task ID |
| [P] | Can run in parallel |
| [UNIT TEST] | Write test before implementation |
| [US1-6] | Linked user story |
| Est. | Estimated duration (days) |
| Depends | Prerequisites (task IDs) |
| Status | ⬜ Pending \| 🔄 In Progress \| ✅ Complete |

---

## Key Principles

1. ✅ **Test-First**: Tests written BEFORE implementation (see [UNIT TEST] marker)
2. ✅ **Parallelization**: Tasks with [P] can run concurrently
3. ✅ **Story Traceability**: Each task linked to [US1-6]
4. ✅ **Phase Gates**: Can't start Phase 3 until Phase 2 complete

---

## Critical Path

Minimum sequence to complete (without parallelization):

```
[T001] → [T002] → [T003] → [T010] → [T012] → [T020] 
→ [T021] → [T023] → [T024] → [T025] → [T027] → [T028] 
→ [T042] → [T043] → [T045] → [T046] → [T051] → [T052] 
→ [T062] → [T064] → [T067] → [T070] → [T073]
```

**Critical Path Duration**: ~20 days (sequential)  
**With Parallelization**: ~10-12 days (tasks marked [P] run concurrently)

---

## Task Groups by Day (Recommended Schedule)

### Day 1: Setup & Planning
- [T001] Set up environment
- [T002] Verify DB connection
- [T003] NextAuth research
- [T010] Create User model

### Day 2: Models & Validation
- [T011] User model tests
- [T012] User model implementation
- [T013-015] Zod schemas

### Days 3-4: Backend Authentication
- [T020] NextAuth setup
- [T021-024] Signup endpoint
- [T025-028] Login endpoint
- [T029-031] Logout endpoint

### Days 5-6: Frontend Forms
- [T040-043] SignupForm
- [T044-049] LoginForm + pages

### Day 7: Navigation & Protected Routes
- [T050-056] Navbar, ProtectedRoute, layouts

### Days 8-9: Testing & Integration
- [T060-067] E2E tests, coverage, security checks

### Day 10: Review & Deploy
- [T070-073] Code review, merge, done

---

## Progress Tracking

Update task status as you work:

```bash
# Run tests
npm run test -- --coverage

# Check TypeScript
npm run type-check

# Format code
npm run format

# When task complete, mark it ✅
# Check off in this file
```

---

## Phase 7: Acceso con Google (añadida 2026-07-16)

Enmienda, no módulo nuevo: la identidad sigue siendo **nuestro `User._id`** (el `sub` de Google se
guarda como enlace, nunca como identidad), así que el Principio 8 no se toca. Ratificada en el
Decision Log; reglas en FR-015..FR-018 de la spec.

| ID | Task | [P] | Status |
|-------|------|-----|--------|
| [T080] | `User`: `passwordHash` deja de ser obligatorio (una cuenta de Google no tiene) + `googleId` con índice **sparse** unique (solo indexa a los vinculados; sin migración). **No** un enum `provider`: un usuario puede tener contraseña **y** Google, y el enum tendría que mentir sobre uno de los dos | - | ✅ |
| [T081] | `src/lib/auth/googleUser.ts` **test-first** (8 tests): busca por `googleId` → por correo (vincula) → crea. **FR-015**: siembra las 21 categorías con el mismo borrado compensatorio que el signup — un login OAuth nunca pasa por `/api/auth/signup`, y sin esto el usuario entra con cero categorías y no puede registrar ni un gasto | - | ✅ |
| [T082] | **FR-017**: sin `email_verified` de Google no se entra ni se vincula. Es la regla que sostiene FR-016: vincular por correo sin la garantía de Google es regalar la cuenta a quien registre ese correo | - | ✅ |
| [T083] | **FR-018**: `verifyCredentials` devuelve `null` si no hay `passwordHash`. Sin el guard, bcryptjs recibía `undefined` y **lanzaba** → 500 en vez de login rechazado. Devuelve el **mismo** 401 que cualquier credencial inválida: un mensaje propio delataría qué correos existen (FR-014). Test en la ruta de login | - | ✅ |
| [T084] | `auth.ts`: `GoogleProvider` **junto** a Credentials. El callback `signIn` es el único que puede **denegar**, así que ahí va el gate y el find-or-create; normaliza `user.id` a **nuestro ObjectId** antes de que `jwt` lo lea (si el `sub` de Google llegara a `session.user.id`, las 7 colecciones buscarían un usuario inexistente) | - | ✅ |
| [T085] | `GoogleButton` (5 tests) en login y signup, con el mensaje de la denegación: NextAuth devuelve a `/login?error=AccessDenied` y sin esto la refusal se traga en silencio | - | ✅ |
| [T086] | El botón **no se pinta** si faltan `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (leído en el Server Component; solo cruza el booleano). Un botón visible que no puede funcionar es peor que ninguno, y desacopla desplegar de configurar | - | ✅ |
| [T087] | Gates: type-check, lint, suite completa, build | - | ✅ |
| [T088] | Credenciales en Google Cloud Console + env vars en `.env.local` y Vercel. Hecho por el dueño (2026-07-16). Verificado: `/api/auth/providers` **lista `google` en producción** | - | ✅ |
| [T089] | Click-through real en navegador (dev): `signin/google` → `callback/google` **302** → `/dashboard` 200. **FR-016 verificado contra la BD, no de vista**: la cuenta del dueño (creada 2026-07-10) quedó con contraseña **Y** `googleId`, conservando sus 3 cuentas, 9 transacciones y 4 deudas — entró a SU cuenta, no a una nueva, y la contraseña le sigue sirviendo. **FR-015 verificado de paso**: una cuenta solo-Google creada el mismo día salió con sus **21 categorías sembradas** | - | ✅ |

---

## Blockers & Risks

- **[T001 Blocker]**: NEXTAUTH_SECRET and MONGODB_URI must be set or other tasks blocked
- **[T002 Blocker]**: If MongoDB doesn't connect, all DB tasks blocked
- **[T020 Blocker]**: NextAuth config must be complete before API routes work
- ~~**[T088/T089 Blocker]**: sin las credenciales de Google no hay flujo que probar~~ → **RESUELTO
  2026-07-16**: credenciales puestas, flujo probado en navegador y vinculación verificada contra la BD.

---

## Handoff Notes

When passing work to another developer:
1. Read `.speckit/specs/authentication.md` first (requirements)
2. Read `.speckit/plans/authentication.md` second (design)
3. Start with the next uncompleted [T] task
4. Follow test-first principle: write tests before code
5. Update status as you go

---

**Next Task**: [T001] Set up .env.local  
**Start Date**: [NEEDS CLARIFICATION]  
**Target Completion**: ~10 days with parallelization
