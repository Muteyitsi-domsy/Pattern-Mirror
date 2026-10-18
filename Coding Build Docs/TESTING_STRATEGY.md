# Pattern Mirror: Testing Strategy

**Version:** 1.0
**Stack:** Jest + Supertest (per CODING_ASSISTANT_GUIDE.md section 11)

---

## 1. The Three Layers

### Unit tests
Pure logic, mocked dependencies. Fast, no network, no emulator. This is the bulk of the suite.

Pattern established in Phase 0.3 (`backend/functions/src/middleware/__tests__/auth.test.ts`, `services/__tests__/rateLimitService.test.ts`): `jest.mock('../../firebaseAdmin', () => ({ ... }))` to stub out `db`/`auth`, then test the function's branches directly — success path, every error path, every edge case the spec calls out.

### Integration tests
Real Express app (`createApp()`), real HTTP semantics via `supertest`, but Firebase still mocked. Verifies routing, middleware ordering, and request/response shape match API_SPEC.md — without needing a live project or emulator.

Pattern established in `backend/functions/src/api/__tests__/auth.test.ts`. Every new API endpoint gets at least one of these hitting the real route through `supertest(app)`, not just the handler function in isolation — routing/middleware wiring bugs don't show up in a pure unit test.

### Emulator-based tests (manual + CI)
Real Firestore/Auth emulators, no mocks. Catches the things mocks can't: actual Firestore query/index behavior, real Firebase Auth token semantics (see the `checkRevoked` second-resolution gotcha found in Phase 0.3 — a mocked `verifyIdToken` would never have surfaced that).

```bash
firebase emulators:start --only auth,firestore
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run dev
# then exercise the running server directly (curl, a script, or firebase emulators:exec 'npm test')
```

This layer isn't (yet) automated into the Jest suite itself — it's the live-verification pass done by hand (or scripted ad hoc) before calling a feature done, per CODING_ASSISTANT_GUIDE.md's "test error paths, not just the happy path" standard. Phase 1+ should consider wiring `firebase emulators:exec 'npm test'` into CI once there's enough surface area (job queue, Firestore writes) that mocked unit tests alone stop being convincing.

### End-to-end tests
Full user flow through the actual frontend (upload → extraction → analysis → report → download). Not set up yet — no browser automation framework (Playwright/Cypress) is in the repo. This is realistically a Phase 3.3+ concern, once there's a UI worth automating. Until then, "e2e" verification is done manually via `claude-in-chrome` or by hand against the dev emulators/project, as was done for the Phase 0.3 login/logout flow.

---

## 2. Coverage Targets

Per CODING_ASSISTANT_GUIDE.md section 4: **>80% line coverage per function/module**, enforced via `jest.config.js`'s `coverageThreshold`. Run `npm test -- --coverage` to check; CI's `npm test -- --ci` does not currently enforce the threshold (no `--coverage` flag) — add it once coverage gaps from early scaffolding work are closed, otherwise early CI runs fail on files that are intentionally thin (e.g. `index.ts`'s one-line Cloud Functions export).

Every error case named in a component's spec (PHASE_SPECS.md's per-task "Tests:" lists, API_SPEC.md's documented error responses) needs a corresponding test — not just the happy path. This is non-negotiable per CODING_ASSISTANT_GUIDE.md's acceptance checklist ("All error cases handled... Tests passing (100%)").

---

## 3. What to Mock vs. What Not To

- **Mock:** `firebase-admin` (`db`, `auth`) in unit and integration tests — real Firestore/Auth calls belong in the emulator layer, not in every test run.
- **Mock:** outbound third-party calls in unit tests (Claude API, Lemon Squeezy, SendGrid) — use fixture responses matching their documented schemas.
- **Don't mock:** Express routing/middleware composition — use `supertest` against the real `createApp()`, not a hand-rolled fake router. (Matches [[project-pattern-mirror-scope]]'s payment-flow feedback: integration tests should exercise real wiring, not reimplementations of it.)
- **Don't mock:** the thing the live-verification pass exists to catch — token revocation semantics, Firestore composite-index requirements, TTL field behavior. These are Firebase's actual runtime behavior, not reproducible by a mock without the mock itself becoming a second, divergent spec of that behavior.

---

## 4. Test File Conventions

- Colocated: `__tests__/<name>.test.ts` next to the module it tests (not a parallel top-level `/tests` tree) — established in `backend/functions/src/{middleware,api,services}/__tests__/`.
- One `describe` block per exported function; one `it` per case (happy path, each validation failure, each documented error response).
- Integration tests import `createApp()` fresh per file (not per test) and rely on `jest.clearAllMocks()` in `beforeEach`/`afterEach` to avoid cross-test mock state leaking — see `auth.test.ts` for the pattern.

---

## 5. Running Tests

```bash
npm test                              # all tests, mocked Firebase
npm run test:watch                    # watch mode
npm test -- --coverage                # with coverage report
firebase emulators:exec 'npm test'    # against live emulators (once emulator-aware tests exist)
```

---

## 6. Related Documents

- **CODING_ASSISTANT_GUIDE.md** section 4 — code quality standards tests must satisfy
- **PHASE_SPECS.md** — each subphase's "Tests:" list is the authoritative source of required test cases for that component
