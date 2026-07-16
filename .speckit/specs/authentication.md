# Specification: User Authentication & Session Management

## Overview
Users can securely create accounts, log in with email/password, maintain sessions across sessions, and log out. Authentication is powered by NextAuth.js v4 with MongoDB for user storage. Passwords are hashed with bcryptjs and never stored in plain text.

---

## User Stories (Priority Order)

### P1 - Critical (MVP)

**[US1]** As a new user, I want to create an account with email and password so that I can access my personal finance data
- Prerequisites: Email validation, password strength requirements
- Acceptance: User created in DB, session established, redirected to dashboard

**[US2]** As an existing user, I want to log in with email and password so that I can access my saved data
- Prerequisites: Account exists, credentials correct
- Acceptance: Session created, user data loaded, redirected to dashboard

**[US3]** As a logged-in user, I want to see my name/email in the navbar so that I know I'm logged in
- Acceptance: Current user name displayed, logout button visible

**[US4]** As a logged-in user, I want to log out so that I can end my session
- Acceptance: Session cleared, redirected to login page, localStorage cleared

### P2 - Important

**[US5]** As a user, I want to see error messages when authentication fails (invalid email, wrong password) so that I know what went wrong
- Acceptance: Clear, user-friendly error messages without security leaks

**[US6]** As a user, I want my session to persist if I close and reopen the browser so that I don't have to log in repeatedly
- Acceptance: Session survives browser restart (24-48 hour max lifespan)

**[US7]** As a user, I want my session to expire automatically after inactivity so that my account is secure
- Acceptance: Session expires after 30 minutes of inactivity

### P3 - Nice to Have

**[US8]** As a user, I want to receive an email confirmation after signup to verify my email
- Acceptance: Email sent, user must click link to activate account

**[US9]** As a user, I want to reset my password if I forget it
- Acceptance: Email link sent, password reset form, new password saved

---

## Acceptance Scenarios

### Scenario 1: Successful Signup (Happy Path)
```
Given I'm on the signup page
  And the form is empty
When I enter:
  - Email: "user@example.com"
  - Password: "SecurePass123!"
  - Confirm Password: "SecurePass123!"
  And I click "Create Account"
Then:
  - A new user is created in MongoDB
  - The password is hashed (not plain text)
  - I'm automatically logged in
  - I'm redirected to /dashboard
  - My email appears in the navbar
```

### Scenario 2: Signup with Duplicate Email
```
Given a user "john@example.com" already exists
  And I'm on the signup page
When I enter:
  - Email: "john@example.com"
  - Password: "NewPass123!"
  And I click "Create Account"
Then:
  - I see error: "Email already in use"
  - No new user is created
  - I remain on the signup page
```

### Scenario 3: Signup with Weak Password
```
Given I'm on the signup page
When I enter:
  - Email: "user@example.com"
  - Password: "123"
  And I click "Create Account"
Then:
  - I see error: "Password must be at least 8 characters"
  - No user is created
  - I remain on the signup page with email filled
```

### Scenario 4: Successful Login
```
Given a user "alice@example.com" with password "AlicePass123!" exists
  And I'm on the login page
When I enter:
  - Email: "alice@example.com"
  - Password: "AlicePass123!"
  And I click "Log In"
Then:
  - A session is created
  - I'm redirected to /dashboard
  - The navbar shows "Alice" (user name) and a logout button
```

### Scenario 5: Login with Wrong Password
```
Given a user "bob@example.com" exists
  And I'm on the login page
When I enter:
  - Email: "bob@example.com"
  - Password: "WrongPassword"
  And I click "Log In"
Then:
  - I see error: "Invalid email or password"
  - No session is created
  - I remain on the login page
```

### Scenario 6: Logout
```
Given I'm logged in as "charlie@example.com"
  And I see the navbar with logout button
When I click "Log Out"
Then:
  - My session is destroyed
  - localStorage is cleared
  - I'm redirected to /login
  - The login page displays "You've been logged out"
```

### Scenario 7: Session Persistence
```
Given I'm logged in and close my browser
When I reopen the application within 24 hours
Then:
  - My session is restored
  - I'm automatically redirected to /dashboard
  - I don't need to log in again
```

### Scenario 8: Session Expiry (Inactivity)
```
Given I'm logged in
When I don't interact with the app for 30 minutes
Then:
  - My session expires
  - On next action, I'm redirected to /login
  - I see message: "Your session expired. Please log in again."
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|----|----------|-------|
| FR-001 | User signup endpoint validates email format | P1 | RFC 5322 or similar standard |
| FR-002 | User signup endpoint validates password strength (min 8 chars, number, uppercase, special char) | P1 | UX: show requirements live |
| FR-003 | User signup checks if email already exists | P1 | Return 409 Conflict if duplicate |
| FR-004 | User passwords are hashed with bcryptjs (bcrypt cost 10+) | P1 | Never store plain text |
| FR-005 | User login validates credentials against hashed password | P1 | Use bcryptjs.compare() |
| FR-006 | NextAuth session created on successful login | P1 | Session expires in 24 hours |
| FR-007 | Session persists across browser restarts | P1 | JWT session strategy (see "Notes & Decisions" — NextAuth v4's Credentials provider only supports JWT, not database sessions), 24h `maxAge` on the cookie |
| FR-008 | Session token stored in httpOnly cookie (not localStorage) | P1 | CSRF protection via same-site cookie |
| FR-009 | Logout clears session and cookies | P1 | No residual session tokens |
| FR-010 | Login/signup forms clear sensitive data on error | P1 | Password fields cleared, email preserved |
| FR-011 | Protected routes redirect unauthenticated users to /login | P1 | Middleware or wrapper component |
| FR-012 | Current user data available in API routes via session | P1 | `getServerSession()` in API routes |
| FR-013 | Inactive sessions expire after 30 minutes | P2 | Sliding window or absolute timeout |
| FR-014 | Error messages don't leak info (no "user not found" etc) | P1 | Security: return "Invalid email or password" |
| FR-015 | Entrar con Google crea el `User` si no existe, **y le siembra las 21 categorías por defecto** | P1 | Añadido 2026-07-16. El sembrado vivía solo en `/api/auth/signup`, que un login OAuth **nunca toca**: sin esto el usuario entra con cero categorías y no puede registrar ni un gasto (toda `Transaction`/`Budget` exige `categoryId`). Mismo borrado compensatorio que el signup si la siembra falla |
| FR-016 | Si el correo de Google **ya existe** como cuenta, se **vincula** a esa misma cuenta (no se crea una segunda) | P1 | Añadido 2026-07-16. Solo si Google reporta `email_verified: true`. Conserva todos los datos de la cuenta existente |
| FR-017 | Un perfil de Google **sin `email_verified`** no puede entrar | P1 | Añadido 2026-07-16. **Es la regla que sostiene FR-016**: sin ella, cualquiera que registre ese correo en Google sin probarlo se apropiaría de la cuenta por coincidencia de correo. Es apropiación de cuenta, no un detalle |
| FR-018 | Una cuenta creada con Google **no puede entrar con contraseña** | P1 | Añadido 2026-07-16. No tiene `passwordHash`. Devuelve `null` como cualquier credencial inválida — **no** un mensaje distinto, que delataría qué correos existen (FR-014) |

---

## Technical Context

### Database (MongoDB + Mongoose)

**User Model:**
```typescript
interface User {
  _id: ObjectId
  email: string              // Unique, lowercase
  name: string               // First + last name
  passwordHash: string       // bcryptjs hash (cost 10+)
  createdAt: Date
  updatedAt: Date
}
```

**Indexes:**
```javascript
db.users.createIndex({ email: 1 }, { unique: true })
db.sessions.createIndex({ expires: 1 }, { expireAfterSeconds: 0 })
```

### API Endpoints

**POST /api/auth/signup**
- Request: `{ email: string, password: string, confirmPassword: string, name: string }`
- Validations: Zod schema, email format, password strength, no duplicate email
- Response: `{ success: true, user: { id, email, name } }` (201) or error (409, 422)
- Side effect: User created in DB, session established

**POST /api/auth/login**
- Request: `{ email: string, password: string }`
- Validations: Email exists, password matches
- Response: `{ success: true, user: { id, email, name } }` (200) or error (401)
- Side effect: NextAuth session created (cookie)

**POST /api/auth/logout**
- Request: (body empty)
- Response: `{ success: true }` (200)
- Side effect: Session destroyed, cookies cleared

**GET /api/auth/session** (NextAuth built-in)
- Returns: Current session or null
- Used by: Frontend to check if user is logged in

### Frontend Components

**LoginForm.tsx**
- Inputs: email, password
- Submit: POST /api/auth/login → redirect to /dashboard on success
- Errors: Display validation errors
- Links: "Don't have account? Sign up" → /signup

**SignupForm.tsx**
- Inputs: name, email, password, confirmPassword
- Validations: Live password strength indicator
- Submit: POST /api/auth/signup → redirect to /dashboard on success
- Error handling: Duplicate email, weak password, etc.
- Link: "Already have account? Log in" → /login

**Navbar.tsx**
- If authenticated: Show user name + "Log Out" button
- If not authenticated: Show "Log In" and "Sign Up" links
- Logout: calls `next-auth/react`'s `signOut({ callbackUrl: '/login' })` directly (corrected 2026-07-09, was "POST /api/auth/logout" — that route still exists and is tested, just not wired to this button, since `signOut()` already clears the session cookie and redirects in one call)

**ProtectedRoute.tsx** (Wrapper)
- **Corrected 2026-07-09**: implemented as an async Server Component — `getServerSession(authOptions)` + `redirect('/login')` from `next/navigation` — instead of a client `useSession()` wrapper. No flash of protected content before redirecting, no client JS needed for the check itself; matches Next.js 16 App Router best practice. Confirmed with the owner before implementation since it deviates from this section's original literal wording.
- If authenticated: render children
- If not: redirect to /login before anything renders

### Authentication Flow

1. User fills signup form → validates on client (Zod)
2. Submits to POST /api/auth/signup
3. Server validates (email, password, duplicate check)
4. Server hashes password with bcryptjs
5. Server creates User in MongoDB
6. Server creates NextAuth session (httpOnly cookie)
7. Client redirected to /dashboard
8. Dashboard uses `useSession()` to show user info

### NextAuth Configuration

**Corrected during implementation (2026-07-09)**: NextAuth v4's Credentials
provider only supports the JWT session strategy — `strategy: 'database'`
throws `CALLBACK_CREDENTIALS_JWT_ERROR` (a hard library limitation, not
something this app controls). No adapter is used; the `users` collection
is owned entirely by our own Mongoose `User` model via the signup route.

```typescript
// src/lib/auth.ts
export const authOptions = {
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        // Verify email + password against DB
        // Return user object or null
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
      session.user.id = token.id
      return session
    }
  },
  session: {
    strategy: 'jwt',              // Only strategy Credentials supports
    maxAge: 24 * 60 * 60,        // 24 hours
    updateAge: 60 * 60           // Refresh if older than 1 hour
  }
}
```

### Security Checklist

- [ ] Passwords hashed with bcryptjs (bcrypt cost 10+)
- [ ] No plain-text passwords in logs or responses
- [ ] Session tokens in httpOnly cookies (not localStorage)
- [ ] CSRF protection (NextAuth handles this)
- [ ] Email validation (RFC 5322)
- [ ] Password strength enforced (8+ chars, complexity)
- [ ] Duplicate email check on signup
- [ ] Error messages don't leak info
- [ ] Rate limiting on login attempts (optional but recommended)
- [ ] HTTPS only in production
- [ ] Environment variables for secrets (NEXTAUTH_SECRET, DATABASE_URL)

---

## Success Criteria

- [ ] Users can sign up with email/password (P1)
- [ ] Users can log in with valid credentials (P1)
- [ ] Failed logins return generic error (no "user not found") (P1)
- [ ] Sessions persist across browser restarts (P1)
- [ ] Logout clears session and redirects to /login (P1)
- [ ] Current user info available in navbar (P1)
- [ ] Protected routes redirect to /login if not authenticated (P1)
- [ ] Passwords stored as bcryptjs hashes, never plain text (P1)
- [ ] All signup/login forms have client-side validation (P1)
- [ ] API endpoints have server-side Zod validation (P1)
- [ ] Unit tests: >80% coverage for auth endpoints (P1)
- [ ] Integration tests: full auth flow (signup → login → logout) (P1)
- [ ] No security leaks (check OWASP authentication checklist) (P1)
- [ ] Session expires after 30 minutes inactivity (P2)
- [ ] Duplicate email signup returns 409 Conflict (P2)

---

## Out of Scope

- Email verification / confirmation links (P3 feature)
- Password reset / forgot password (P3 feature)
- Social login (Google, GitHub) (future)
- Two-factor authentication (future)
- Account recovery options (future)
- SAML/OAuth2 (future)

---

## Dependencies

**Internal:**
- User data model (MongoDB via Mongoose)
- Database connection (src/lib/db.ts)

**External:**
- NextAuth.js v4.x (already in package.json)
- bcryptjs v3.x (already in package.json)
- Zod v4.x (already in package.json)
- react-hook-form (already in package.json)

**No new dependencies needed** — all libraries already installed.

---

## Estimated Effort

- **Design & Planning**: 1 day (this spec + tech plan)
- **Backend Implementation**: 2-3 days (API + DB + session setup)
- **Frontend Implementation**: 1-2 days (forms + navigation)
- **Testing & Fixes**: 1 day (unit + integration tests)
- **Total**: ~5-7 days for MVP (US1-US4)

---

## Notes & Decisions

1. **httpOnly Cookies**: Session tokens must be in httpOnly cookies (not localStorage) to prevent XSS attacks
2. **JWT Sessions** (corrected 2026-07-09, was "Database Sessions"): NextAuth v4's Credentials provider only supports the JWT strategy — attempting `strategy: 'database'` throws `CALLBACK_CREDENTIALS_JWT_ERROR`. The signed, httpOnly JWT cookie itself survives server restarts and browser restarts within its 24h `maxAge`, same user-facing guarantee as originally intended — only the storage mechanism changed, not the acceptance criteria. No `@next-auth/mongodb-adapter` is used; the `User` collection is owned solely by our Mongoose model.
3. **Password Hashing**: bcryptjs bcrypt cost of 10+ ensures brute-force resistance (≈10ms per hash)
4. **No Email Verification in MVP**: P3 feature — users can fake emails for now
5. **Error Messages**: Generic "Invalid email or password" on login failure prevents user enumeration attacks
6. **Rate Limiting**: Not included in MVP but should be added before production (prevents brute-force attacks on login)
7. **Google como proveedor adicional** (añadido 2026-07-16, ratificado en el Decision Log de la constitución). Se añade `GoogleProvider` al NextAuth existente — **no** se reemplaza el login por correo y contraseña, que sigue siendo de primera clase. Cuatro reglas nuevas, en FR-015..FR-018 abajo. La razón de que esto quepa en una enmienda y no en un módulo nuevo: la identidad del usuario **sigue siendo nuestro `User._id`**, y por tanto el Principio 8 (todo cuelga de nuestro `userId`) no se toca. Fue exactamente el motivo por el que se rechazó Clerk (2026-07-13): allí la identidad *no* era nuestro ObjectId.

---

## Acceptance

This specification is complete and ready for planning when all user stories and acceptance criteria are understood and agreed upon.

**Reviewed By**: [Developer]  
**Approved By**: [Owner]  
**Approved Date**: [Date]
