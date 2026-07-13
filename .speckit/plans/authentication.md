# Implementation Plan: User Authentication & Session Management

**Specification**: `.speckit/specs/authentication.md`  
**User Stories Covered**: US1, US2, US3, US4, US5, US6 (MVP phase)  
**Tech Stack**: Next.js 16, NextAuth.js v4, MongoDB/Mongoose, bcryptjs, Zod

---

## Phase 0: Research & Validation

### Constitution Check
- ✅ Aligns with project stack (NextAuth, MongoDB, TypeScript strict)
- ✅ Follows test-first principle (tests written before implementation)
- ✅ No conflicts with existing architecture
- ✅ Security requirements well-defined (bcryptjs hashing, httpOnly cookies)

### Technical Research
| Question | Answer | Confidence |
|----------|--------|-----------|
| Should we use NextAuth's database session adapter? | **Revised 2026-07-09, was "Yes"**: No — NextAuth v4's Credentials provider only supports the JWT strategy (`CALLBACK_CREDENTIALS_JWT_ERROR` on `strategy: 'database'`, confirmed against the real dev server, not just docs). JWT cookie provides the same persistence guarantee without an adapter. | High |
| Which bcryptjs cost factor? | Cost 10 (≈10ms per hash) — good balance of security vs performance | High |
| How to handle duplicate email checks? | In API handler with Mongoose unique index on email field | High |
| Should password reset be in MVP? | No — P3 feature, out of scope for initial release | High |
| How to validate email format? | Zod's `z.string().email()` + RFC 5322 via validator library | Medium |

### Project Structure Review
- **Existing similar features**: None (this is first auth implementation)
- **Reusable patterns**: 
  - API route structure (`src/app/api/`) already configured
  - Zod validation used in form components (pattern to follow)
  - Mongoose ORM ready in `src/lib/db.ts`
- **Library features to leverage**:
  - NextAuth.js built-in session management
  - bcryptjs for password hashing (already installed)
  - react-hook-form + Zod for form validation (already installed)

---

## Phase 1: Design & Architecture

### Database Schema (Mongoose)

**User Model** (`src/lib/models/User.ts`)
```typescript
import mongoose, { Schema, Document } from 'mongoose'

interface IUser extends Document {
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false // Never return password hash in queries by default
    }
  },
  { timestamps: true }
)

// Indexes
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ createdAt: -1 })

export default mongoose.model<IUser>('User', userSchema)
```

**Session Model** (NextAuth handles this, but stored in MongoDB)
```typescript
// NextAuth.js creates this automatically with database adapter
// Collections: users, accounts, sessions, verification_tokens
```

### API Routes Structure

```
src/app/api/auth/
├── signup/
│   ├── route.ts              # POST /api/auth/signup
│   └── __tests__/
│       └── route.test.ts     # Unit tests
├── login/
│   ├── route.ts              # POST /api/auth/login
│   └── __tests__/
│       └── route.test.ts     # Unit tests
├── logout/
│   ├── route.ts              # POST /api/auth/logout
│   └── __tests__/
│       └── route.test.ts     # Unit tests
└── [nextauth].ts             # NextAuth configuration
```

**POST /api/auth/signup** Logic
```typescript
// 1. Parse and validate request (Zod)
// 2. Check if email already exists in DB
// 3. Hash password with bcryptjs (cost 10)
// 4. Create user in MongoDB
// 5. Create NextAuth session
// 6. Return user object (no password)
// Error responses: 409 duplicate, 422 validation, 500 server error
```

**POST /api/auth/login** Logic
```typescript
// 1. Parse and validate request (Zod)
// 2. Find user by email in DB
// 3. Compare password with hash using bcryptjs.compare()
// 4. If match: create NextAuth session
// 5. Return user object
// Error response: 401 invalid credentials (generic message)
```

**POST /api/auth/logout** Logic
```typescript
// 1. Destroy NextAuth session
// 2. Clear httpOnly cookies
// 3. Return success response
```

### Component Hierarchy

```
src/app/
├── (auth)/                       # Auth route group (no navbar)
│   ├── login/
│   │   └── page.tsx             # Login page
│   │       └── LoginForm.tsx     # Form component
│   ├── signup/
│   │   └── page.tsx             # Signup page
│   │       └── SignupForm.tsx    # Form component
│   └── layout.tsx               # No navbar layout
├── dashboard/                    # Protected routes
│   ├── page.tsx                 # Dashboard (requires auth)
│   └── layout.tsx               # With navbar
└── components/
    ├── Navbar.tsx               # Shows user info + logout
    └── ProtectedRoute.tsx        # Route wrapper for auth check
```

### Form Validation Schema (Zod)

**Signup Schema**
```typescript
const SignupSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[!@#$%^&*]/, 'Password must contain special character'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})
```

**Login Schema**
```typescript
const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required')
})
```

### NextAuth Configuration

**Corrected during implementation (2026-07-09)**: the original draft below
used `adapter: MongoDBAdapter(clientPromise)` + `strategy: 'database'`.
Wiring `NextAuth(authOptions)` for real against the dev server threw
`CALLBACK_CREDENTIALS_JWT_ERROR` — NextAuth v4's Credentials provider only
supports the JWT strategy; database sessions require an OAuth-style linked
account that credentials logins don't have. `@next-auth/mongodb-adapter`
and the standalone `mongodb` package were both removed from
`package.json` as a result — no longer needed. `authorize()` also now
delegates to a separately-testable `verifyCredentials()` helper
(`src/lib/auth/verifyCredentials.ts`) that returns `null` uniformly for
both "no such user" and "wrong password" (never `throw`, to avoid
NextAuth surfacing distinguishable error paths — FR-014).

**File**: `src/lib/auth.ts`
```typescript
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyCredentials } from '@/lib/auth/verifyCredentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        return verifyCredentials(credentials.email, credentials.password)
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
      }
      return session
    }
  },
  session: {
    strategy: 'jwt',           // Only strategy Credentials supports
    maxAge: 24 * 60 * 60,      // 24 hours
    updateAge: 60 * 60         // Refresh token if older than 1 hour
  },
  secret: process.env.NEXTAUTH_SECRET
}
```

### State Management

- **Client State (Zustand)**: Form UI state (loading, error messages, form visibility)
- **Server State (React Query)**: User session (cached after login, refetched on mount)
- **Form State (react-hook-form)**: Form field values, validation errors, touched fields
- **NextAuth Session**: Managed by NextAuth, accessed via `useSession()` hook

### Security Checklist

- ✅ Passwords hashed with bcryptjs (cost 10+)
- ✅ No plain-text passwords in logs or responses
- ✅ Session tokens in httpOnly cookies (NextAuth handles)
- ✅ CSRF protection via NextAuth
- ✅ Email validation (Zod)
- ✅ Password strength enforced (8+ chars, complexity)
- ✅ Duplicate email check via MongoDB unique index
- ✅ Generic error messages ("Invalid email or password")
- ⚠️ Rate limiting not in MVP (add before production)
- ✅ Environment variables for secrets

---

## Phase 2: Implementation

### Complexity Assessment

| Aspect | Complexity | Justification |
|--------|-----------|---------------|
| Database | Low | Simple User schema, Mongoose handles rest |
| API | Medium | Signup + login logic, error handling, validation |
| Frontend | Medium | Two forms with validation, styling, error display |
| NextAuth Integration | Medium | Configuration, session callbacks, adapter setup |
| Testing | Medium | Mock DB, test auth flows, edge cases |

### Implementation Order (Test-First)

#### Step 1: Database Setup (1 day)
1. Create User Mongoose model in `src/lib/models/User.ts`
2. Export from `src/lib/models/index.ts`
3. Write unit tests for User schema validation
4. Test unique email index creation

#### Step 2: Backend - Signup (1.5 days)
1. **Write failing tests** for `POST /api/auth/signup`
   - Valid signup creates user
   - Duplicate email returns 409
   - Weak password returns 422
   - Password hashed correctly
2. Implement API route: `src/app/api/auth/signup/route.ts`
3. Implement validation schemas (Zod)
4. All tests pass

#### Step 3: Backend - Login (1.5 days)
1. **Write failing tests** for login endpoint
   - Valid credentials return user
   - Invalid password returns 401
   - User not found returns 401 (generic)
   - Session created on success
2. Implement API route: `src/app/api/auth/login/route.ts`
3. Implement NextAuth configuration
4. All tests pass

#### Step 4: Backend - Logout (0.5 day)
1. **Write failing test** for logout endpoint
2. Implement API route: `src/app/api/auth/logout/route.ts`
3. Test passes

#### Step 5: Frontend - Signup Form (1 day)
1. **Write component tests** (empty component initially)
2. Create `SignupForm.tsx` component
3. Add react-hook-form + Zod validation
4. Wire to `POST /api/auth/signup`
5. Handle error display and success redirect
6. Tests pass

#### Step 6: Frontend - Login Form (1 day)
1. **Write component tests** (empty component initially)
2. Create `LoginForm.tsx` component
3. Add react-hook-form + Zod validation
4. Wire to `POST /api/auth/login`
5. Handle session setup and redirect
6. Tests pass

#### Step 7: Frontend - Navigation (0.5 day)
1. Create `Navbar.tsx` component
2. Show user name + logout button when authenticated
3. Show login/signup links when not authenticated
4. Wire logout button to NextAuth signout

#### Step 8: Frontend - Protected Routes (0.5 day)
1. Create `ProtectedRoute.tsx` wrapper component
2. Redirect to `/login` if not authenticated
3. Apply to dashboard and other protected pages

#### Step 9: Integration Tests (1 day)
1. Full flow: signup → login → navigate → logout
2. Session persistence across page reloads
3. Redirect logic (unauthenticated → /login)

#### Step 10: Security & Fixes (0.5 day)
1. OWASP checklist review
2. Fix any edge cases from testing
3. Verify no security leaks

### Critical Dependencies

- MongoDB connection must be working (src/lib/db.ts)
- NextAuth.js must be installed and NEXTAUTH_SECRET set
- bcryptjs must be installed
- Zod and react-hook-form must be installed (already are)

---

## Phase 3: Testing & Validation

### Test Coverage (Target: >85%)

**Unit Tests**
- User model validation
- Password hashing (bcryptjs integration)
- Zod schema validation (email format, password strength)
- API route logic (duplicate check, hash comparison)

**Integration Tests**
- Complete signup flow: form → API → DB → session
- Complete login flow: form → API → session
- Complete logout flow: button → API → session cleared
- Session persistence (reload page)
- Error scenarios (duplicate email, weak password, invalid credentials)

**E2E Tests** (Manual browser testing)
- User can sign up from landing page
- User can log in after signup
- Navbar shows user name when logged in
- Logout button works and clears session
- Accessing /dashboard while logged out redirects to /login
- Session persists after browser close/reopen

### Acceptance Criteria Check

All from spec:
- [ ] Users can sign up (US1)
- [ ] Users can log in (US2)
- [ ] Logged-in users see their name in navbar (US3)
- [ ] Logout works and clears session (US4)
- [ ] Error messages are generic (US5)
- [ ] Session persists across restarts (US6)
- [ ] Tests: >80% coverage
- [ ] No regressions in existing features
- [ ] Code review approved
- [ ] Security: OWASP checklist passed

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| MongoDB connection issues | Low | High | Test DB connection at startup, clear error messages |
| NextAuth session persistence | Medium | High | JWT strategy (only one Credentials supports) with stable `NEXTAUTH_SECRET`; confirmed end-to-end via real `signIn`/`session` smoke test |
| Race condition on duplicate email | Low | Medium | MongoDB unique index + error handling |
| Password hash timing leak | Low | Low | bcryptjs timing-safe by default |
| Brute-force attack on login | Medium | High | Add rate limiting (post-MVP) |

---

## Timeline & Resources

- **Estimated Duration**: 7 days (can be 4-5 days with parallelization)
- **Team Size**: 1 developer (or 2 for parallelization)
- **Blockers**: None — all dependencies already installed

### Parallelization Opportunities
- [T015-T018]: Signup form can be built in parallel with login form
- Backend tests can be written in parallel with frontend work

---

## Success Metrics

- ✅ Feature shipped and working end-to-end
- ✅ All user stories (US1-US4) complete
- ✅ All acceptance scenarios passing
- ✅ Test coverage >80%
- ✅ No console errors or warnings
- ✅ Code review approved
- ✅ Security checklist passed
- ✅ Performance acceptable (<200ms per auth operation)

---

## Notes & Decisions

1. **Test-First Approach**: Every component and API route has tests written BEFORE implementation code
2. **JWT Sessions** (corrected 2026-07-09, was "Database Sessions"): NextAuth v4's Credentials provider only supports JWT — no adapter, no `sessions` collection. The signed httpOnly cookie itself carries the session and survives server restarts/multiple instances as long as `NEXTAUTH_SECRET` stays stable, same guarantee as originally intended
3. **Strict Error Messages**: "Invalid email or password" prevents attacker from enumerating valid email addresses
4. **No Email Verification in MVP**: Users can use any email for now — verification is P3 feature
5. **bcryptjs Cost**: Cost 10 provides good security (≈10ms per hash) without being too slow (<100ms login)
6. **Environment Variables**: NEXTAUTH_SECRET, MONGODB_URI, etc. must be set in `.env.local`

---

## Next Steps After Implementation

1. Add rate limiting to prevent brute-force attacks (post-MVP)
2. Implement email verification (P3)
3. Implement password reset (P3)
4. Add social login options (future)
5. Monitor auth error rates in production
6. Regular security audits

---

## Approval

**Designed By**: [Developer]  
**Reviewed By**: [Owner]  
**Approved**: [Date]
