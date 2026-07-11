# PFMS — Task List

## Done
- [x] Swap local-filesystem JSON storage for GitHub-Contents-API storage (`server/githubStore.ts`), so data survives on Vercel's read-only/ephemeral filesystem. All existing route logic kept as-is, only the storage boundary changed.
- [x] Split `server.ts` into `server/app.ts` (shared Express app) + thin `server.ts` (local dev/prod entry) + `api/index.ts` (Vercel serverless entry).
- [x] Add `vercel.json`, `resolveJsonModule` in `tsconfig.json`, GitHub env vars in `.env.example`.
- [x] Fixed real bugs found in audit (see below) — `tsc --noEmit` and `npm run build` both pass clean.

## Bugs fixed this pass
- **[blocker, pre-existing]** `PUT /api/settings` returned the raw partial request body instead of the merged settings object — every settings save (including the dark-mode toggle, which only sends `{theme}`) was wiping out the rest of the client's settings state until a page reload. Fixed in `server/app.ts`.
- **[should-fix]** Daily auto-backup check on login was fire-and-forget; on Vercel's serverless runtime, work left running after the response is sent isn't guaranteed to finish. Now awaited before responding.
- **[should-fix, pre-existing]** Several update endpoints (purchases, payments, loans, loan-payments) used `parseFloat(x) || existing`, so editing a numeric field down to `0` silently reverted to the old value. Replaced with a proper "field present vs. absent" check (`numOrExisting` helper in `server/app.ts`).
- **[nice-to-have]** `BudgetTracker.tsx` captured API errors into state but never rendered them — a failed budget load looked like a stuck blank screen. Now shows an error message with a retry button.

## Backlog (not blocking launch — noted, not fixed)
- Customer balance math (`purchases − payments + carriedOverBalance`) is independently re-implemented in `Dashboard.tsx`, `SPayLater.tsx`, `Reports.tsx`, `Archives.tsx`, and server-side in `updateCustomerStatus`. All five agree today; worth extracting into one shared helper before any future tweak to the calculation causes them to drift apart.
- Main JS bundle is ~938kB (258kB gzipped) — Vite's default code-splitting warning. Not a correctness issue, just a "consider lazy-loading routes later" note.

## Remaining before deploy
1. **You**: paste your GitHub PAT into `finance-tracker/.env` (`GITHUB_TOKEN=`).
2. **Me**: local smoke test with `npm run dev` — login, add a customer/purchase/payment, create+restore a backup — confirm it's actually committing to your private `iantolentino/finance-tracker` repo.
3. Push this branch to GitHub, connect the repo to Vercel, add the same 4 `GITHUB_*` env vars in the Vercel project settings.
4. Deploy, repeat the smoke test against the live Vercel URL.
5. Change the default `admin` master password immediately after first login.
