# Personal Finance Management System (PFMS) with SPayLater & Lending Tracker

A full-stack personal finance application for tracking **SPayLater** customer balances, peer/cash lending, a monthly budget tracker, financial reports, and backups — deployed on Vercel with Postgres-backed storage.

## 🌟 Key Modules & Features

1. **SPayLater Tracker** 
   - Manage multiple customer profiles.
   - Track purchases, quantity, original costs, and installment plans.
   - Record GCash/cash/Maya payments, automatically calculating outstanding balances versus total settled transactions. 
   - Profile notes, messenger communication shortcuts, and status badges (`Active`, `Fully Paid`, `Overdue`).

2. **Lending / Cash Loans Module**
   - Record loans with fixed-amount or percentage interest, payment schedules, and due dates.
   - Track partial payments and auto-computed loan status.

3. **Monthly Budget Tracker**
   - Configure salary/additional income per billing cycle.
   - Create spending allocations, log expenses against them, roll over a budget layout from a previous month.

4. **Dynamic Reports**
   - Outstanding receivables, monthly collections, overdue customers, and the lending ledger, with print-friendly output.

5. **Archives & Billing Cycles**
   - Complete a billing cycle to archive it and carry forward outstanding balances into the next one.
   - Browse and restore archived cycles.

6. **Backup & Restore**
   - Manual and automatic (once-daily) backups.
   - Full JSON export/import of the entire system state.

7. **Light / Dark Mode**
   - Custom brand color theme, both modes.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19 (TypeScript), Vite, Tailwind CSS v4, Motion (animations), Lucide React (icons).
- **Backend**: Express (TypeScript). Locally it runs as a normal Node server (`server.ts`); on Vercel it runs as a single serverless function (`api/index.ts`) that imports the same Express app (`server/app.ts`) — no route logic differs between the two.
- **Storage**: Postgres, via [Neon](https://neon.tech)'s native Vercel integration (`server/postgresStore.ts`, using `@neondatabase/serverless`). Data is stored as a small set of JSONB documents (one per entity type: customers, purchases, payments, loans, budgets, archives, settings, activity logs) rather than a fully normalized relational schema — the relational logic already lives in `server/app.ts`'s route handlers.
- **Auth**: Single master password, compared directly against the stored value and used as the bearer token (documented tradeoff for a single-user personal app — see Security below).

---

## 🚀 Local Development

### 1. Prerequisites
Node.js v18+ and npm.

### 2. Install dependencies
```bash
npm install
```

### 3. Environment variables
Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres connection string. If you're running this against the same Vercel project, get it from **Vercel dashboard → Project → Settings → Environment Variables** (the value is marked "Sensitive" so `vercel env pull` won't retrieve it — copy it manually).

### 4. Run the dev server
```bash
npm run dev
```
Open `http://localhost:3000`. Default login password is `admin` on a fresh database — **change it immediately** via Settings.

### 5. Production build (standalone Node hosting, not Vercel)
```bash
npm run build
npm start
```

---

## ☁️ Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (**Add New → Project**). Framework preset: Vite; build command `vite build` (already configured via `vercel.json`); output directory `dist`.
2. In the Vercel dashboard, go to the project's **Storage** tab → **Create Database** → **Postgres (Neon)**, and connect it to this project. This auto-injects `DATABASE_URL` (and related `POSTGRES_*` vars) into Production and Preview environments — no manual env var setup needed.
3. Deploy. The Postgres schema (`kv_store`, `backups` tables) is created automatically on first request.
4. Log in with the default password `admin` and change it immediately from Settings.

`api/index.ts` is the single serverless entry point; `vercel.json` rewrites all `/api/*` requests to it, and Express does its own internal routing from there.

---

## 🔒 Security Notes

- Master password is stored in plaintext in the database and doubles as the bearer token — acceptable for a single-user personal tool, not for anything multi-tenant.
- Change the default `admin` password immediately after first deploy.
- The Postgres connection string is a Vercel "Sensitive" env var (hidden from the CLI/dashboard after creation) — this is Vercel's default handling for database credentials.
