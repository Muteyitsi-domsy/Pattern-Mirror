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
/Coding Build Docs     — specs (read PHASE_SPECS.md first)
/backend/functions      — Firebase Cloud Functions (API, workers, analysis engines) — added in Phase 0.5+
/frontend               — Next.js app — added in Phase 3.3
firebase.json           — Firebase project config (hosting, functions, emulators)
firestore.rules          — Firestore security rules
firestore.indexes.json  — Firestore composite indexes
```

## Debugging

```bash
# Tail Cloud Function logs
gcloud functions log processReportJob --limit 100

# Check a job's state directly
firebase firestore:get jobs/<jobId>
```

See `Coding Build Docs/CODING_ASSISTANT_GUIDE.md` section 12 for more debugging patterns.
