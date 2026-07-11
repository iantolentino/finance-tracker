# Personal Finance Management System (PFMS) with SPayLater & Lending Tracker

A visually polished, full-stack personal finance application designed to organize transactions, track **SPayLater** customer balances, handle community/peer lending workflows, generate financial reports, and maintain fully encrypted or local JSON backup archives.

## 🌟 Key Modules & Features

1. **SPayLater Tracker**
   - Manage multiple customer profiles (e.g., Ian, Shannen, Claudine, Tatay Manuel).
   - Track micro-transactions, specific purchases, quantity, original costs, and installment plans.
   - Record GCash/cash payments, automatically calculating outstanding balances versus total settled transactions.
   - Profile notes, messenger communication shortcuts, and clean visual status badges (`Active`, `Fully Paid`, `Outstanding`).

2. **Lending / Peer Loans Module**
   - Record peer loans with detailed interest rates, start dates, and due dates.
   - View visual health logs, partial payment records, and dynamic payment trackers.

3. **Dynamic Analytics & Reports**
   - Beautiful visual summaries (using Recharts & D3-inspired elements) outlining outstanding cash flows, paid versus unpaid amounts, monthly margins, and overall transaction volume.
   - Categorized metrics with robust responsive bento-grids.

4. **Robust Database Backup & Seeding (Settings)**
   - **1-Click SPayLater Seeder**: Instantly load pre-configured tracker datasets directly into the system database from the Settings control panel.
   - **JSON Export / Import**: Download the entire system state (settings, cycles, customers, purchases, payments, loans, archives, activity logs) as a single portable JSON file, and restore it anytime.

5. **Visual Customization**
   - Pristine, adaptive **Light Mode** and high-contrast **Slate Dark Mode** setups.
   - Custom fluid typography ("Inter" paired with "JetBrains Mono" status metrics).

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18+ (TypeScript), Vite, Tailwind CSS, Motion (Animations), Lucide React (Icons).
- **Backend Server**: Express (Node.js/TypeScript) running a lightweight JSON database storage system under `/data` (e.g., `customers.json`, `purchases.json`, `settings.json`, `loans.json`).
- **Production Bundle**: Bundled via Vite (client) and Esbuild (Express server) into self-contained ESM/CommonJS modules (`dist/server.cjs`).

---

## 🚀 Installation & Local Development

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **npm** installed on your system.

### 2. Install Dependencies
```bash
npm install
```

### 3. Running in Development Mode
The dev server starts the unified Express application which proxies Vite's hot-reload middleware automatically.
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 4. Production Build & Execution
To compile the client-side single-page application and bundle the custom TypeScript backend server:
```bash
# Build the client SPA and compile server.ts to dist/server.cjs
npm run build

# Start the optimized Node server
npm start
```

---

## 📥 How to Import Your SPayLater Tracker Data

To instantly load your pre-populated SPayLater summary data:
1. Open the application and log in to your workspace.
2. Navigate to the **Settings** tab.
3. Locate the **Database Controls & Backups** card.
4. Click **"Load SPayLater Data (1-Click)"** in the **SPayLater Tracker Seeder** section.
5. The system will prompt you for confirmation and instantly populate the workspace with structured profiles (Ian, Shannen, Claudine, Tatay Manuel, Tricia, Ate She, Lecel) and their corresponding transactions.
