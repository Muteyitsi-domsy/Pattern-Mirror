# Development Setup

## Prerequisites

- Node.js 20+ and npm
- Firebase CLI (`npm install -g firebase-tools`), logged in: `firebase login`
- A Lemon Squeezy account + store (for payment work, Phase 1+)
- An Anthropic API key with Zero Data Retention enabled (for extraction/narrative work, Phase 1+)

## First-time setup

```bash
git clone <repo-url>
cd "Pattern Mirror"
npm install
cp .env.example .env   # fill in real values — never commit .env
```

## Firebase projects

Only `pattern-mirror-dev` exists so far (Firestore + Email/Password Auth enabled, Spark/free plan). `staging` and `prod` are deferred until closer to launch — see `.firebaserc`.

```bash
firebase use dev        # switch to the dev project
firebase emulators:start   # run Firestore/Auth/Functions emulators locally
```

Always develop and test against `dev` or the emulators. When `staging`/`prod` are created later, never point local work at them directly.

## Running the app locally

```bash
# Backend API (reads .env; defaults to port 8000)
npm run dev

# Frontend (separate npm project — has its own package.json/.env.local)
cd frontend
npm install   # first time only
npm run dev   # http://localhost:3000
```

To run the backend against the Firestore/Auth emulators instead of the real
`pattern-mirror-dev` project (recommended for anything that writes data):

```bash
firebase emulators:start --only auth,firestore
# in another terminal:
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run dev
```

To also exercise Cloud Functions / the job queue (`backend/functions`'s
`api` and `processReportJob` functions) via the Functions emulator instead
of `npm run dev`'s plain Express server:

```bash
cd backend/functions && npm install && npm run build   # first time / after changes
cd ../..
firebase emulators:start --only auth,firestore,functions
# api is served at http://127.0.0.1:5001/pattern-mirror-dev/us-central1/api
```

The Functions emulator does **not** auto-rebuild on source changes — rerun
`npm run build` inside `backend/functions` after editing `backend/functions/src/**`
**and restart** `firebase emulators:start` to pick it up (a rebuild alone,
without restarting, silently keeps serving the old routes).

**`backend/functions/.env`:** needed for any config the Functions runtime
doesn't auto-detect (e.g. the Storage bucket — project ID auto-detects
fine, bucket doesn't). `FIREBASE_*`/`GCLOUD_*`/`X_GOOGLE_*`/`EXT_*` are
reserved prefixes there — using one makes the *entire* `.env` file fail to
load (silently, as "Failed to load function definition from source" deep
in the emulator log, not an obvious error), which is why
`STORAGE_BUCKET_NAME` is used instead of `FIREBASE_STORAGE_BUCKET` in that
specific file even though the root-level `.env` uses the latter.

**Generating Storage signed URLs locally** (`POST /api/reports/upload-url`,
Phase 1.1): `getSignedUrl()` needs real signing credentials — either a
private key file, or (what deployed Cloud Functions get) the ability to call
the IAM `signBlob` API as its own identity. Neither is available to the
emulator by default, which fails with `Cannot sign data without
client_email`. The fix is a dedicated local-only service account:
`pattern-mirror-dev-signer@pattern-mirror-dev.iam.gserviceaccount.com`,
scoped to **Storage Object Admin on the dev bucket only** (granted at the
bucket level, not project-wide). Its JSON key lives at
`backend/functions/dev-signer-key.json` (gitignored, never commit it) and
`backend/functions/.env` points `STORAGE_SIGNING_KEY_PATH` at it —
`uploadService.ts`'s `signingBucket()` helper uses that path to build a
dedicated `@google-cloud/storage` client for signing only, falling back to
the normal Admin SDK bucket (which works fine in production) when the var
isn't set.

**Important:** this is deliberately *not* named
`GOOGLE_APPLICATION_CREDENTIALS`. The Firebase CLI's own emulator startup
sets that exact variable to the CLI login's ADC file before the function
process's `.env` ever loads, and a preset env var isn't overridden by a
later `.env` load — so a same-named value here would be silently shadowed.
Confirmed empirically with a temporary debug log before landing on the
dedicated-client approach instead. Not needed and not used in production —
see `Coding Build Docs/DEPLOYMENT.md` section 6 for the deployed-environment
equivalent (an IAM role grant, not a key file).

**Enqueueing a task from a plain host script** (e.g. a one-off debug/admin
script run via `ts-node`, not through a deployed/emulated function) needs
real Application Default Credentials and will fail with
`ENOTFOUND metadata.google.internal` otherwise — code running *inside* an
emulated function doesn't have this problem. If you need to trigger
`enqueueJob()` for manual testing, do it from a temporary route on the
already-emulated `api` function rather than a standalone script.

**Testing `/auth/logout` locally:** its revocation check (`verifyIdToken(token, true)`)
calls `getUser()`, which needs real Admin SDK credentials when *not* running
against the Auth emulator. Without a service account key or
`gcloud auth application-default login`, that call fails and the endpoint
returns an error — harmless for local dev (the frontend catches it and still
clears the client-side session), but don't be surprised by it. It works
without any extra setup inside deployed Cloud Functions (credentials are
automatic there) and against the Auth emulator.

## Running tests

```bash
npm test              # run all Jest tests
npm run test:watch    # watch mode
firebase emulators:exec 'npm test'   # run tests against the Firestore/Auth emulator
```

## Linting & formatting

```bash
npm run lint
npm run format
```

## Project layout

```
/Coding Build Docs      — specs (read PHASE_SPECS.md first)
/backend/functions      — deployable Cloud Functions bundle (own package.json, compiles src/ -> lib/)
  /src                  — Express API + job queue worker (analysis engines land in Phase 1-2)
/frontend               — Next.js app (login page so far; full UI lands in Phase 3.3) — own package.json/.env.local
firebase.json            — Firebase project config (hosting, functions, emulators)
firestore.rules          — Firestore security rules
firestore.indexes.json  — Firestore composite indexes
```

Root `package.json` covers local dev/test tooling (runs `backend/functions/src`
directly via `ts-node`/`jest`, no build step needed for that). `backend/functions/package.json`
is the separate, minimal bundle Firebase actually deploys — keep both in sync
when adding a new runtime dependency (e.g. a new npm package the API code
imports needs adding to *both* package.jsons, since deploy only installs
from the inner one).

## Debugging

```bash
# Tail Cloud Function logs
gcloud functions log processReportJob --limit 100

# Check a job's state directly
firebase firestore:get jobs/<jobId>
```

See `Coding Build Docs/CODING_ASSISTANT_GUIDE.md` section 12 for more debugging patterns.
