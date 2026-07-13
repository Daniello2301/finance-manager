# Development Guide: Personal Finance Manager

## Quick Start

This project uses **Specification-Driven Development (SDD)** with GitHub Spec Kit.

### Before Writing Code

1. **Read the Spec** — Every feature starts with a detailed specification in `.speckit/specs/`
2. **Review the Plan** — Check `.speckit/plans/` for architecture and technical decisions
3. **Follow the Tasks** — Implement tasks in order from `.speckit/tasks/`
4. **Consult Constitution** — Review `.speckit/constitution.md` for project principles

### Workflow

```
Specification (PRD) → Plan (Design) → Tasks (Implementation) → Code
```

See `SPECKIT_GUIDE.md` for full workflow details.

---

## Tech Stack

- **Frontend**: Next.js 16 App Router, React 19, TypeScript (strict)
- **Backend**: Next.js API Routes, NextAuth v4
- **Database**: MongoDB + Mongoose v9.6
- **Styling**: Tailwind CSS v4
- **State**: Zustand (client) + React Query (server)
- **Forms**: react-hook-form + Zod validation
- **Charts**: Recharts

**IMPORTANT**: This is Next.js 16 — APIs differ significantly from your training data. Consult `node_modules/next/dist/docs/` when in doubt.

---

## Project Structure

```
src/app/                    # Next.js App Router pages & layouts
  └── api/                  # API routes (backend)
      ├── auth/             # NextAuth routes
      └── [resource]/       # Resource endpoints

src/app/components/         # React components
  ├── ui/                   # Reusable UI components
  └── features/             # Feature-specific components

src/lib/                    # Utilities & helpers
  ├── db.ts                 # MongoDB connection (Mongoose)
  ├── auth.ts               # NextAuth configuration
  └── api-client.ts         # Fetch wrapper for API calls

tests/                      # Test files (mirror src/ structure)
  ├── unit/
  ├── integration/
  └── e2e/

.speckit/                   # Specification-driven development
  ├── constitution.md       # Project governance (ratified principles)
  ├── specs/                # Feature specifications (PRDs)
  ├── plans/                # Implementation plans
  ├── tasks/                # Task breakdowns
  └── templates/            # Templates (don't edit)
```

---

## Code Rules (From Constitution)

✅ **Do**
- Write tests BEFORE implementation code (test-first / TDD)
- Use TypeScript strict mode (`strict: true`)
- Validate inputs with Zod schemas
- Use React Query for server state, Zustand for UI state
- Follow the spec's acceptance criteria

❌ **Don't**
- Use `any` types — use `unknown` or proper types
- Write `@ts-ignore` without approval
- Use plain MongoDB — always go through Mongoose
- Fetch data with `useState` — use React Query
- Skip tests to ship faster — 80% coverage minimum

---

## Before You Code

1. Check `.speckit/specs/[feature].md` for requirements
2. Check `.speckit/plans/[feature].md` for architecture decisions
3. Check `.speckit/tasks/[feature].md` for task order (test-first)
4. Check `.speckit/constitution.md` for quality gates

If a feature isn't yet specified, create the spec first (see `SPECKIT_GUIDE.md`).

---

## Key Files

- `SPECKIT_GUIDE.md` — Full guide to Specification-Driven Development
- `AGENTS.md` — Notes on Next.js 16 breaking changes
- `.speckit/constitution.md` — Project principles and quality gates
- `tsconfig.json` — TypeScript config (strict mode enabled)
