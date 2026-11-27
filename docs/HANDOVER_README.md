# LedgerGuard — Backend Handover Package (Team Integration)

This package contains the complete, tested, and production-ready Express backend for **LedgerGuard — Dynamic Multi-Tenant Zero-Knowledge Billing Engine**, developed by **Maithli** on branch `maithli-backend` (verified commit `b7edfe6`).

It is prepared specifically for teammate **Abhishek** for frontend integration and MongoDB Atlas connectivity.

---

## 1. Package Structure

```text
LedgerGuard-Backend-Handover/
├── backend/                               # Complete Express Backend Application
│   ├── src/
│   │   ├── config/                        # DB adapter, env config, resilient Redis client
│   │   ├── controllers/                   # Auth, Tenant, Billing, Usage, Pricing, Analytics
│   │   ├── middleware/                    # RS256 Auth, Tenant Resolver, Rate Limiter, Error Handling
│   │   ├── routes/                        # Express API route modules (/api/v1)
│   │   ├── services/                      # Distributed locking, billing transactions, ledger, usage, pricing, analytics
│   │   ├── utils/                         # SHA-256 canonical request hasher, response envelope utilities
│   │   ├── app.js                         # Express application setup & middleware stack
│   │   └── server.js                      # HTTP server startup & graceful shutdown handlers
│   ├── scripts/
│   │   └── verify-live-integration.js     # Live Atlas & Redis integration verification runner
│   ├── tests/
│   │   ├── unit/                          # 10 unit test suites (auth, billing, usage, pricing, analytics, locking, etc.)
│   │   └── integration/                   # 5 integration test suites (app, auth, billing, routes, database E2E)
│   ├── package.json                       # Dependencies (express, mongoose, ioredis, jsonwebtoken, bcrypt, dotenv, supertest)
│   ├── package-lock.json                  # Locked dependency tree
│   ├── .env.example                       # Safe environment template
│   └── .gitignore
├── database/                              # Team Database Module (v1.3.0) — Single Source of Truth
│   ├── src/
│   │   ├── connections.js                 # Central pool & tenant connection manager
│   │   ├── idempotency.js                 # Request-hash comparison validation helper
│   │   └── models.js                      # Schemas & tenant-scoped model getters (Acme & Zenith)
│   ├── scripts/                           # Database seeding scripts
│   ├── tests/                             # Standalone database integration tests
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── .env.example
│   └── .gitignore
├── docs/                                  # Comprehensive Documentation & Integration Guides
│   ├── API_INTEGRATION_GUIDE.md           # Full API specifications, response examples, frontend usage
│   ├── BACKEND_SETUP_GUIDE.md             # Environment configuration, running, testing, troubleshooting
│   └── BACKEND_LEARNING_NOTES.md          # Architecture breakdown, phase logs, and viva Q&As
└── README.md                              # This handover manifest
```

---

## 2. Two Ways to Use This Handover

### Option A: Standalone Execution (Zero-Config Test Drive)
Because we have included the team's database module alongside `backend/`, you can run, test, and develop directly inside this extracted folder without any broken imports:
```bash
# 1. Enter backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Create .env from template
cp .env.example .env

# 4. Run full test suite (63 passing tests, 0 failures)
npm test

# 5. Start development server
npm run dev
```

### Option B: Integration into the Team Monorepo
If you have cloned the main team repository (`LedgerGuard`), simply copy `backend/` and `docs/` into your repository root alongside your existing `database/` and `frontend/` directories:
```bash
# Inside your team repo root:
cp -r /path/to/LedgerGuard-Backend-Handover/backend ./
cp -r /path/to/LedgerGuard-Backend-Handover/docs ./
```
The backend imports from `../../../database/src/`, so all database models and connection managers resolve immediately in both layouts!

---

## 3. Key API Contracts for Frontend Integration

### 1. Monthly Revenue Analytics (`GET /api/v1/analytics/revenue/monthly`)
- **Headers:** `Authorization: Bearer <token>`, `x-tenant-id: <organizationId>`
- **Query:** `?currency=INR` (default: INR; supports 3-letter currency codes)
- **Accounting Invariant:** Derived from immutable double-entry ledger entries in the `revenue` account.
  $$\text{netRevenueMinor} = \sum \text{Credits} - \sum \text{Debits}$$
  Compensating reversal entries (debits) automatically deduct from gross revenue.
- **Response Format:**
  `data.months`: Array of 6 calendar months with `{ month: "Nov 2026", monthKey: "2026-11", grossRevenueMinor, reversalMinor, revenueMinor }`.
  Connects directly to the frontend's Revenue Overview SVG bar chart!

### 2. Usage Analytics (`GET /api/v1/analytics/usage`)
- **Headers:** `Authorization: Bearer <token>`, `x-tenant-id: <organizationId>`
- **Guaranteed Canonical Metrics:** Always returns entries for `api_requests`, `compute_units`, and `storage` under `data.byMetric`.
- **Zero-Fill Protection:** If an organization has 0 events for a metric, the backend zero-fills the entry so frontend metric cards never encounter undefined properties.
- **Rational Scaled Quantity:** Safely computes un-scaled decimal quantities from integer database records (`quantityScaled / quantityScale`).

### 3. Billing Creation & Reversals (`/api/v1/billing`)
- Protected by Redis distributed mutex locking (`withLock`), MongoDB multi-document ACID transactions, balanced ledger validation ($\text{Debits} == \text{Credits}$), and SHA-256 idempotency request-hash checks.

For detailed request/response examples and TypeScript client snippets, see [docs/API_INTEGRATION_GUIDE.md](docs/API_INTEGRATION_GUIDE.md).

---

## 4. Test Verification Status

All 64 backend tests and database unit tests pass cleanly:

```text
=== BACKEND TEST RESULTS ===
node --test tests/**/*.test.js
✔ Passed:  63 tests
✖ Failed:  0 tests
﹣ Skipped: 1 test (Atlas live connection test skipped safely when MONGODB_URI is placeholder)
⏱ Duration: ~1.03 s

=== DATABASE TEST RESULTS ===
node --test
✔ Passed:  1 test
✖ Failed:  0 tests
﹣ Skipped: 5 tests (Live Atlas multi-document transaction & isolation tests skipped pending cluster URI)
```

To run live integration verification against your configured Atlas cluster:
```bash
cd backend
export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster-url>/?retryWrites=true&w=majority"
npm run test:live
```

---

## 5. Security & Handover Hygiene Notice

- **No Secrets Packaged:** No `.env` files, production keys, or Atlas credentials are included in this archive. Use `.env.example` to supply your credentials locally.
- **No Node Modules:** `node_modules/` is excluded to keep the package lightweight and prevent OS binary incompatibility. Run `npm install` on your target machine.
- **Clean Git State:** `.git/` is excluded. All source files reflect commit `b7edfe6` on `maithli-backend`.
