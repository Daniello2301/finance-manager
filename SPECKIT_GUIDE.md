# Spec-Kit Guide: Specification-Driven Development

This project uses **GitHub Spec Kit** to implement Specification-Driven Development (SDD).

## Quick Start

### What is SDD?
Instead of writing code first and documenting later, SDD makes specifications the primary artifact:
> *"Specifications don't serve code — code serves specifications."*

### The SDD Workflow

1. **Define Constitution** — Immutable project principles (tech stack, quality gates)
2. **Write Specification** — Feature PRD with user stories and acceptance criteria
3. **Create Plan** — Technical design and architecture from the spec
4. **Break into Tasks** — Granular, testable, parallelizable work items
5. **Implement** — Code that matches the spec (test-first)

---

## How to Use in This Project

### Templates Location
All spec-kit templates are in `.speckit/templates/`:
- `spec-template.md` — Use for feature specifications
- `plan-template.md` — Use for implementation planning
- `tasks-template.md` — Use for task breakdown
- `constitution-template.md` — Project governance

### Workflow 1: Define the Constitution (Do This First)

1. Copy `.speckit/templates/constitution-template.md` to `.speckit/constitution.md`
2. Fill in:
   - Core principles (already drafted for this project)
   - Architectural boundaries
   - Quality gates and code review checklist
   - Get owner approval and ratify
3. Commit: `git add .speckit/constitution.md && git commit -m "docs: ratify project constitution"`

### Workflow 2: Write a Feature Specification

1. Create a new file: `.speckit/specs/[feature-name].md`
2. Copy content from `.speckit/templates/spec-template.md`
3. Fill in:
   - **Overview**: 1-2 sentences on what and why
   - **User Stories**: Prioritized P1/P2/P3
   - **Acceptance Scenarios**: Given/When/Then format
   - **Functional Requirements**: Numbered FR-001, FR-002...
   - Mark unknowns with `[NEEDS CLARIFICATION]`
4. Once clear, remove all `[NEEDS CLARIFICATION]` markers before sharing with team

### Workflow 3: Create Implementation Plan

1. Create: `.speckit/plans/[feature-name].md`
2. Copy from `.speckit/templates/plan-template.md`
3. Include:
   - **Phase 0**: Research questions and constitution check
   - **Phase 1**: Database schema, API design, component structure
   - **Phase 2**: Implementation complexity and order
   - **Phase 3**: Testing and acceptance criteria
4. Answer ALL `[NEEDS CLARIFICATION]` items in the plan
5. This becomes the roadmap for implementation

### Workflow 4: Break into Tasks

1. Create: `.speckit/tasks/[feature-name].md`
2. Copy from `.speckit/templates/tasks-template.md`
3. Create granular tasks (1-2 day chunks) with:
   - `[TXXX]` identifiers
   - `[P]` markers for parallelizable tasks
   - `[US1]`, `[US2]` markers linking to stories
   - Dependencies between tasks
4. Follow test-first approach: tests written before implementation
5. Use in sprint planning and daily progress tracking

---

## Key Principles (Project Constitution)

### Stack Lock ✅
```
Frontend: Next.js 16 App Router + React 19 + TypeScript (strict)
Backend: Next.js API Routes + NextAuth v4
Database: MongoDB + Mongoose v9.6+
Styling: Tailwind CSS v4
State: Zustand (client) + React Query (server)
Validation: Zod + react-hook-form
Charts: Recharts
```

### Test-First Development ✅
- Write tests BEFORE implementation code
- Minimum 80% test coverage
- CI/CD blocks merges below 80% coverage

### TypeScript Strict Mode ✅
- `strict: true` in tsconfig.json
- No `@ts-ignore` without approval
- Linter blocks commits with `@ts-ignore`

### No Premature Optimization ✅
- Correctness first, performance later
- Only optimize after profiling shows bottleneck

### Specification-Driven ✅
- All features start with specs
- Acceptance criteria in Given/When/Then format
- No ambiguity markers (`[NEEDS CLARIFICATION]`) in signed-off specs

---

## Example: Build Authentication Feature

### Step 1: Constitution (Already Done)
Review `.speckit/constitution.md` and confirm it aligns with NextAuth requirements.

### Step 2: Specification
Create `.speckit/specs/authentication.md`:
```markdown
# Specification: User Authentication

## Overview
Users can sign up, log in, and maintain secure sessions using NextAuth.js v4.

## User Stories

### P1 - Critical
- **[US1]** As a new user, I want to create an account with email/password
- **[US2]** As an existing user, I want to log in with email/password

### P2 - Important
- **[US3]** As a logged-in user, I want to see my name in the UI
- **[US4]** As a user, I want to log out

## Acceptance Scenarios
### Scenario 1: Happy Path Signup
Given I'm on the signup page
When I enter email, password, and confirm password
Then I'm created in the database and automatically logged in

### Scenario 2: Invalid Email
Given I'm on the signup page
When I enter an invalid email format
Then I see an error message

## Functional Requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Password hashing with bcryptjs | P1 |
| FR-002 | Session management via NextAuth | P1 |
| FR-003 | Email validation | P1 |
| FR-004 | Account exists check | P1 |

## Success Criteria
- [ ] Users can sign up
- [ ] Users can log in
- [ ] Sessions persist across page reloads
- [ ] Passwords are hashed (never plain text)
```

### Step 3: Implementation Plan
Create `.speckit/plans/authentication.md` with:
- Database schema (User model in Mongoose)
- API endpoints (`/api/auth/signup`, `/api/auth/login`)
- NextAuth configuration
- Frontend components (LoginForm, SignupForm)

### Step 4: Task Breakdown
Create `.speckit/tasks/authentication.md` with test-first tasks:
```
[T001] Write failing tests for User signup endpoint → ⬜
[T002] Implement User Mongoose schema → ⬜
[T003] Implement signup endpoint with Zod validation → ⬜
[T004] Write failing tests for login endpoint → ⬜
[T005] Implement login with password hashing → ⬜
[T006] Test NextAuth session management → ⬜
... (frontend components follow)
```

### Step 5: Implement
For each task:
1. Write failing tests first
2. Implement code to pass tests
3. Review against acceptance criteria
4. Move to next task

---

## File Structure

```
personal-finance-manager/
├── .speckit/                          # Spec-kit configuration and templates
│   ├── config.json                    # Project configuration
│   ├── constitution.md                # Ratified project governance
│   ├── specs/                         # Feature specifications
│   │   ├── authentication.md
│   │   ├── dashboard.md
│   │   └── ...
│   ├── plans/                         # Implementation plans
│   │   ├── authentication.md
│   │   └── ...
│   ├── tasks/                         # Task breakdowns
│   │   ├── authentication.md
│   │   └── ...
│   ├── templates/                     # Templates (don't edit directly)
│   │   ├── spec-template.md
│   │   ├── plan-template.md
│   │   ├── tasks-template.md
│   │   └── constitution-template.md
│   └── commands/                      # CLI commands (if integrating with Claude Code)
├── src/
│   ├── app/
│   │   ├── api/                       # Next.js API routes
│   │   ├── [routes]/                  # Page routes
│   │   └── components/                # Reusable components
│   ├── lib/
│   │   ├── db.ts                      # MongoDB connection
│   │   ├── auth.ts                    # NextAuth config
│   │   └── api-client.ts              # Fetch wrapper
│   └── types/
│       └── index.ts                   # TypeScript types
├── tests/
│   ├── unit/                          # Component & utility tests
│   ├── integration/                   # API endpoint tests
│   └── e2e/                           # End-to-end flows
└── SPECKIT_GUIDE.md                   # This file
```

---

## Commands

### View Constitution
```bash
cat .speckit/constitution.md
```

### List All Specs
```bash
ls .speckit/specs/
```

### View a Spec
```bash
cat .speckit/specs/authentication.md
```

### View Task Progress
```bash
cat .speckit/tasks/authentication.md
```

### Track Progress
Use the task breakdown markdown — check off tasks as you complete them:
```markdown
| [T001] | Description | [P] | | Owner | ✅ |
```

---

## Integration with Claude Code

When fully integrated with Claude Code, you can use slash-commands:
```
/speckit.specify "feature name"      → Generate a new spec
/speckit.plan "feature name"         → Generate implementation plan
/speckit.tasks "feature name"        → Generate task breakdown
/speckit.constitution                → Review/update constitution
```

For now, you can manually create the files using the templates.

---

## Next Steps

1. ✅ Ratify the Constitution (`.speckit/constitution.md`)
2. 📝 Write your first Specification (`.speckit/specs/authentication.md`)
3. 🎯 Create an Implementation Plan (`.speckit/plans/authentication.md`)
4. ✂️ Break into Tasks (`.speckit/tasks/authentication.md`)
5. 🚀 Implement with Test-First approach

---

## Resources

- GitHub Spec Kit: https://github.com/github/spec-kit
- Specification-Driven Development: Read `.speckit/constitution.md` for philosophy
- Test-First (TDD): Write tests that express acceptance criteria from your spec

Good luck! 🎉
