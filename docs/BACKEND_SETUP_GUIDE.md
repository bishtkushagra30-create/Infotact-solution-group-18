# LedgerGuard — Backend Setup & Local Execution Guide

This guide provides step-by-step instructions for setting up, configuring, running, and testing the LedgerGuard backend application. It is designed to get the backend running quickly alongside the MongoDB Atlas database and React frontend.

---

## 1. System Requirements

- **Node.js:** Node.js v18.18+ or v20+ LTS (Native ES Module support required).
- **Package Manager:** `npm` (v9+ or v10+).
- **MongoDB:** MongoDB Atlas cluster (M0 free tier or higher) or local replica set supporting multi-document transactions.
- **Redis (Optional for local dev):** Local Redis server (`redis://127.0.0.1:6379`) or Redis Cloud instance. In local development/testing, an automatic in-memory fallback is provided if Redis is not running.

---

## 2. Directory Layout & Placement

The backend imports database models and connection utilities from the team's `database/` module using the relative path `../../../database/src/`.

### Recommended Workspace Layout:
```text
LedgerGuard/
├── backend/          # LedgerGuard Express Application
├── database/         # Team Database Module (v1.3.0)
├── frontend/         # Team React / Vite Application
└── docs/             # Technical Documentation & Guides
```

When placed in this arrangement, all imports resolve immediately out of the box without changing any configuration.

---

## 3. Dependency Installation

Navigate into the `backend/` directory and install dependencies:

```bash
cd backend
npm install
```

If you also wish to run the standalone database test suite or seeder:
```bash
cd ../database
npm install
cd ../backend
```

---

## 4. Environment Configuration

Copy the template environment file in `backend/`:

```bash
cp .env.example .env
```

Open `.env` and configure the following variables:

```ini
# Server Port & Mode
PORT=4000
NODE_ENV=development

# JWT RS256 Asymmetric Cryptography
# If left commented out, an ephemeral RS256 keypair is automatically generated on boot for development
JWT_EXPIRES_IN=1d
# JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
# JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

# Redis Configuration (Distributed Mutex & Rate Limiting)
# If local Redis is not installed, development mode falls back to an in-memory lock manager
REDIS_URL=redis://127.0.0.1:6379

# MongoDB Atlas Connection
# Replace with your actual Atlas cluster connection string
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
PLATFORM_DB_NAME=platform_db
```

> [!IMPORTANT]
> **Production Safety Invariant:** In development mode (`NODE_ENV=development`), the backend gracefully uses an in-memory fallback if Redis is unavailable. In `NODE_ENV=production`, this fallback is strictly prohibited to prevent race conditions across multi-instance deployments.

---

## 5. Starting the Express Backend

### Development Mode (with hot-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

Upon successful startup, the console will display:
```text
[Server] LedgerGuard API running on port 4000 (NODE_ENV=development)
[DB Bridge] Connecting to MongoDB Atlas...
[Redis] Connected to redis://127.0.0.1:6379 (or using in-memory fallback)
```

---

## 6. Health Probing & Connectivity Check

The backend distinguishes between application health and database connection readyState:

```bash
curl http://localhost:4000/health
```

**Expected Response (when Atlas is connected):**
```json
{
  "status": "healthy",
  "app": "operational",
  "database": {
    "status": "connected",
    "platformDb": "platform_db",
    "readyState": 1,
    "pingLatencyMs": 42
  },
  "uptime": 12.4,
  "timestamp": "2026-11-27T12:00:00.000Z"
}
```

If `MONGODB_URI` is unconfigured, the application returns HTTP 200 with `"status": "unconfigured"`, allowing the API to boot safely during unit testing.

---

## 7. Running Backend Tests

The backend includes a comprehensive test suite covering all 5 architectural phases, authentication guards, billing idempotency, distributed locking, double-entry ledger balancing, and analytics aggregation.

### Run Automated Unit & Integration Tests:
```bash
npm test
```

**Test Suite Coverage:**
- 63 unit and route integration tests passing.
- 1 live Atlas test skipped safely when `MONGODB_URI` contains placeholder credentials.

### Run Standalone Live Readiness Verifier:
```bash
npm run test:live
```
This utility evaluates password hashing, RS256 token lifecycle, distributed mutex acquisition, double-entry ledger balance invariants, request hash validation, and multi-tenant health probes across Acme and Zenith databases.

---

## 8. Connecting the React Frontend

1. Ensure the backend is running on `http://localhost:4000`.
2. In the `frontend/` directory, set the base URL in `.env.local` or `.env`:
   ```ini
   VITE_API_BASE_URL=http://localhost:4000/api/v1
   ```
3. Alternatively, if using Vite proxy in `frontend/vite.config.ts`:
   ```typescript
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:4000',
           changeOrigin: true
         }
       }
     }
   });
   ```
4. Authenticate via `POST /api/v1/auth/login`. Store `token` and `organizationId` in localStorage or React context and attach them to outgoing requests:
   - `Authorization: Bearer <token>`
   - `x-tenant-id: <organizationId>`

---

## 9. Common Integration Issues & Troubleshooting

### 1. `503 Service Unavailable: Database connection not configured`
- **Cause:** `MONGODB_URI` in `.env` is either missing or contains the placeholder string `<username>:<password>`.
- **Solution:** Add your real Atlas connection string to `backend/.env` with readWrite permissions.

### 2. `401 Unauthorized: Invalid or missing token`
- **Cause:** The request does not supply a valid `Authorization: Bearer <token>` header, or the token was signed by a different keypair.
- **Solution:** Call `POST /api/v1/auth/login` to obtain a fresh token and ensure the token is attached to headers.

### 3. `403 Forbidden: Cross-tenant access violation`
- **Cause:** The `x-tenant-id` header does not match the `organizationId` claim embedded in the authenticated JWT.
- **Solution:** Ensure the active organization selected in the frontend matches the logged-in user's tenant organization.

### 4. `409 Conflict: Idempotency payload mismatch`
- **Cause:** An `idempotencyKey` was reused for a billing transaction, but the request payload differed from the initial request.
- **Solution:** Each new distinct billing transaction must generate a unique `idempotencyKey` (e.g. `crypto.randomUUID()`). Only reuse the key when retrying an identical failed request.

### 5. `429 Too Many Requests: Rate limit exceeded`
- **Cause:** More than 100 requests per minute were submitted by the same tenant organization or client IP.
- **Solution:** Wait for the rate limit window to reset (inspect `Retry-After` response header) or adjust limit in `backend/src/middleware/rateLimiter.middleware.js` for development testing.

### 6. `EADDRINUSE: address already in use :::4000`
- **Cause:** Another process is already running on port 4000.
- **Solution:** Terminate the existing process using `lsof -i :4000` and `kill -9 <PID>`, or set `PORT=4001` in `backend/.env`.
