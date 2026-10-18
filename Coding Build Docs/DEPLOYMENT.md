# Pattern Mirror: Deployment Guide

**Version:** 1.0
**Status:** Reflects actual infrastructure as of 2026-10-18 (Phase 0)

---

## 1. Environments

| Environment | Firebase Project | Status |
|---|---|---|
| dev | `pattern-mirror-dev` | Live. Firestore (Native, `us-central1`), Email/Password Auth, security rules + indexes deployed, TTL policies on `jobs`/`extraction_cache`, Blaze plan. |
| staging | `pattern-mirror-staging` | Not created yet. Deliberately deferred past Phase 0 (see `.firebaserc` once it exists). |
| prod | `pattern-mirror-prod` | Not created yet. |

`pattern-mirror-dev` lives under a secondary Google account (not the primary `dmuteyitsi@gmail.com`) because the primary account was at its GCP project-creation quota. The primary account is an Owner on the project, so `firebase` CLI and GitHub Actions service-account auth both work normally against it regardless of which account originally created it.

**Before creating `staging`/`prod`:** decide the project-ID naming (`pattern-mirror-staging`, `pattern-mirror-prod` by convention, matching `dev`), and budget for the fact each one needs its own Blaze upgrade, Firestore database, security rules deploy, and Auth provider setup — repeat Phase 0.1-0.2's steps against the new project ID.

---

## 2. Deployment Pipeline (Intended)

```
GitHub Push (main) → CI runs lint + test → Deploy to staging
  → Manual approval → Deploy to production
```

Reality right now: CI (`.github/workflows/ci.yml`) runs lint + test on every push to `main` and on PRs. The deploy jobs are present in the file but **commented out** — they need:
1. `pattern-mirror-staging` / `pattern-mirror-prod` to exist
2. A Firebase service account JSON per environment, stored as a GitHub Actions secret (`FIREBASE_SERVICE_ACCOUNT_STAGING`, `FIREBASE_SERVICE_ACCOUNT_PROD`)
3. Cloud Functions to actually exist to deploy (Phase 0.5+)

Uncomment and wire those up once all three are true — don't flip them on piecemeal, since a deploy job with no functions to deploy will just fail loudly for no benefit.

---

## 3. Manual Deploy Commands

Until CI/CD deploy jobs are live, deploys are manual via the Firebase CLI.

```bash
firebase use dev                                  # select target project

firebase deploy --only firestore:rules            # security rules only
firebase deploy --only firestore:indexes          # composite indexes only
firebase deploy --only functions                  # Cloud Functions (once they exist, Phase 0.5+)
firebase deploy --only hosting                    # frontend static hosting (Phase 3.3+)

firebase deploy                                   # everything firebase.json declares
```

Frontend (`/frontend`) isn't wired to Firebase Hosting yet — it's a standalone Next.js app today (`cd frontend && npm run build`). Hosting setup is Phase 3.3 work.

**Always `firebase use <alias>` and read the printed project ID before deploying.** There is no interactive confirmation step for `firebase deploy` beyond that — a `firebase use prod` typo deploys to the wrong place silently.

---

## 4. Required Secrets (once CI deploy jobs are enabled)

| Secret | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | Service account JSON (Firebase Admin), scoped to `pattern-mirror-staging` |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | Service account JSON, scoped to `pattern-mirror-prod` |
| `ANTHROPIC_API_KEY` | For Cloud Functions that call Claude (extraction, narrative gen) |
| `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET` | Payment integration |
| `SENDGRID_API_KEY` | Email notifications |

Set these via Cloud Functions secrets (`firebase functions:secrets:set <NAME>`) for values the backend reads at runtime, and as GitHub Actions repo secrets for anything the CI deploy step itself needs. Don't put real secrets in `.env` files committed to git — `.env`/`.env.local` are gitignored; only `.env.example`/`.env.local.example` (no real values) are tracked.

---

## 5. Rollback

**Cloud Functions:** Firebase keeps previous function revisions. To roll back:
```bash
firebase functions:log                      # find the last-known-good deploy time
git revert <bad-commit>                     # revert the code
firebase deploy --only functions            # redeploy the reverted code
```
There's no one-command "rollback to previous" for Functions — it's revert-and-redeploy.

**Firestore rules:** The Firebase console (Firestore → Rules → History) keeps every previously published ruleset and lets you republish an older one directly, no redeploy needed. Fastest path for a bad rules push.

**Firestore indexes:** Deleting an index is safe (just loses the query-speed benefit, doesn't lose data) but can't be "rolled back" to a prior exact state automatically — redeploy `firestore.indexes.json` from the last-good commit.

**Hosting:** Firebase Hosting has native rollback — `firebase hosting:clone <site>:<sourceVersion> <site>:live`, or use the console's one-click "rollback" on a prior release. (Phase 3.3+, once Hosting is actually set up.)

**Data:** No automated Firestore backups are configured yet on `dev` (Blaze plan supports scheduled backups — not yet turned on; revisit before `prod` exists, since Phase 0 deliberately treats `dev` as disposable/reseedable).

---

## 6. Pre-Launch Checklist

See `PHASE_SPECS.md`'s "Final Launch & Deployment" section for the full pre-launch checklist (load testing, security audit, monitoring, etc.) — not reproduced here to avoid the two documents drifting out of sync.

---

## 7. Related Documents

- **DEVELOPMENT.md** — local dev setup (this is deploy; that is local)
- **PHASE_SPECS.md** — phase-by-phase roadmap, including Phase 0.1's infra setup steps (reusable template for standing up staging/prod)
- **ARCHITECTURE.md** — section 10, deployment architecture overview
