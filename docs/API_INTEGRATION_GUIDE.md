# LedgerGuard — Backend API Integration Guide

This guide is the complete API integration reference for connecting the LedgerGuard React frontend to the Express backend. It documents base URLs, authentication headers, request/response envelopes, financial invariants, and detailed contracts for all available endpoints.

---

## 1. Connection & Header Specifications

### 1.1 Base URL & Port
- **Default Local Server:** `http://localhost:4000`
- **API Version 1 Root:** `http://localhost:4000/api/v1`
- **Application Health Probe:** `GET http://localhost:4000/health` (also aliased at `/api/v1/health`)

### 1.2 Required Request Headers
All protected API endpoints require:

| Header Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `Authorization` | String | Standard Bearer token with RS256 JWT | `Bearer eyJhbGciOiJSUzI1NiIsIn...` |
| `x-tenant-id` | String | Organization tenant identifier | `org_acme_001` or `org_zenith_002` |
| `Content-Type` | String | Required for all POST/PUT requests with a JSON body | `application/json` |
| `idempotency-key` | String | Required for mutating financial requests (`/billing/transactions`, reversals) | `tx_req_uuid_948123` |

> [!NOTE]
> The backend supports tenant resolution through multiple channels: the `x-tenant-id` (or `x-organization-id`) request header, route parameters (`:organizationId`), or the validated `organizationId` claim signed inside the RS256 JWT. If a client attempts to pass an explicit header targeting a tenant different from their JWT claim, the backend immediately blocks the request with HTTP 403 (`TENANT_ACCESS_DENIED`).

---

## 2. Standard Response Envelopes

Every JSON response returned by the backend follows a uniform envelope structure.

### 2.1 Success Response (`2xx`)
```json
{
  "success": true,
  "message": "Human-readable status summary.",
  "data": { ... }
}
```

### 2.2 Error Response (`4xx` / `5xx`)
```json
{
  "success": false,
  "error": "Descriptive error message.",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "data": null
}
```

### Common Error Codes:
- `UNAUTHORIZED` (401): Missing or invalid RS256 Bearer token.
- `FORBIDDEN` (403): User lacks required role permissions (e.g. member attempting admin actions).
- `TENANT_ACCESS_DENIED` (403): Cross-tenant access violation.
- `INVALID_CURRENCY` (400): Currency code is not a valid 3-letter ISO code.
- `IDEMPOTENCY_PAYLOAD_MISMATCH` (409): Idempotency key reused with altered payload.
- `RATE_LIMIT_EXCEEDED` (429): Tenant or IP exceeded allowed request window.
- `DATABASE_NOT_CONFIGURED` (503): Backend cannot reach MongoDB Atlas or connection string is placeholder.

---

## 3. Monetary Standards: Minor Units & Rational Scaling

1. **Integer Minor Units:** All monetary values are represented strictly as 64-bit safe integers in the currency's minor denomination (e.g., paise for INR, cents for USD; `100` paise = ₹1.00). Floating-point arithmetic is forbidden in financial routes.
2. **Rational Quantity Scaling:** Fractional consumption units (e.g. 2.75 GB storage) are stored as two integers: `quantityScaled` (275) and `quantityScale` (100).
   - Rating cost uses deterministic half-up integer arithmetic:
     $$\text{costMinor} = \left\lfloor \frac{\text{quantityScaled} \times \text{unitPriceMinor} + \lfloor \frac{\text{quantityScale}}{2} \rfloor}{\text{quantityScale}} \right\rfloor$$
   - In analytics queries, unscaled quantities are returned via `$divide: ["$quantityScaled", "$quantityScale"]`.

---

## 4. Authentication Endpoints (`/api/v1/auth`)

### 4.1 Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "organizationId": "org_acme_001",
    "email": "alice@acme.example",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "data": {
      "user": {
        "userId": "usr_acme_01",
        "email": "alice@acme.example",
        "organizationId": "org_acme_001",
        "role": "admin"
      },
      "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### 4.2 Current User Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User profile retrieved.",
    "data": {
      "user": {
        "userId": "usr_acme_01",
        "email": "alice@acme.example",
        "organizationId": "org_acme_001",
        "role": "admin"
      }
    }
  }
  ```

---

## 5. Analytics & Dashboard Endpoints (`/api/v1/analytics`)

### 5.1 Monthly Revenue Report (Revenue Overview Chart)
- **Endpoint:** `GET /api/v1/analytics/revenue/monthly`
- **Headers:** `Authorization`, `x-tenant-id`
- **Query Parameters:**
  - `currency` *(optional, string, default: `"INR"`)*: 3-letter currency code (e.g. `INR`, `USD`).
- **Accounting Engine Logic:**
  - Computes net revenue over a trailing 6-calendar-month sliding window.
  - Aggregated from immutable double-entry ledger entries in the `revenue` account:
    $$\text{netRevenueMinor} = \sum \text{Credits} - \sum \text{Debits}$$
  - Reversals and refunds are debited against the revenue account, automatically decreasing net revenue.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Monthly revenue retrieved.",
    "data": {
      "organizationId": "org_acme_001",
      "currency": "INR",
      "totalRevenueMinor": 1250000,
      "period": {
        "from": "2026-06-01T00:00:00.000Z",
        "to": "2026-12-01T00:00:00.000Z"
      },
      "months": [
        {
          "month": "Jun 2026",
          "monthKey": "2026-06",
          "grossRevenueMinor": 0,
          "reversalMinor": 0,
          "revenueMinor": 0
        },
        {
          "month": "Jul 2026",
          "monthKey": "2026-07",
          "grossRevenueMinor": 250000,
          "reversalMinor": 0,
          "revenueMinor": 250000
        },
        {
          "month": "Aug 2026",
          "monthKey": "2026-08",
          "grossRevenueMinor": 500000,
          "reversalMinor": 50000,
          "revenueMinor": 450000
        },
        {
          "month": "Sep 2026",
          "monthKey": "2026-09",
          "grossRevenueMinor": 300000,
          "reversalMinor": 0,
          "revenueMinor": 300000
        },
        {
          "month": "Oct 2026",
          "monthKey": "2026-10",
          "grossRevenueMinor": 100000,
          "reversalMinor": 0,
          "revenueMinor": 100000
        },
        {
          "month": "Nov 2026",
          "monthKey": "2026-11",
          "grossRevenueMinor": 150000,
          "reversalMinor": 0,
          "revenueMinor": 150000
        }
      ]
    }
  }
  ```

### 5.2 Usage Analytics (Consumption Cards & Metrics)
- **Endpoint:** `GET /api/v1/analytics/usage`
- **Headers:** `Authorization`, `x-tenant-id`
- **Query Parameters:**
  - `currency` *(optional, string, default: `"INR"`)*
  - `from` *(optional, ISO Date string)*
  - `to` *(optional, ISO Date string)*
- **Canonical Metrics Enforced:**
  Guarantees that `byMetric` always contains all 3 canonical metrics:
  1. `api_requests` (Label: `"API requests"`, default unit: `"requests"`)
  2. `compute_units` (Label: `"Compute units"`, default unit: `"compute_units"`)
  3. `storage` (Label: `"Storage"`, default unit: `"GB-day"`)
  *(If an organization has 0 events recorded for a metric, the entry is automatically zero-filled so frontend widgets never crash on undefined properties).*
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Usage analytics retrieved.",
    "data": {
      "organizationId": "org_acme_001",
      "currency": "INR",
      "reportingPeriod": {
        "from": null,
        "to": null
      },
      "totalEvents": 45,
      "totalCostMinor": 12500,
      "byMetric": [
        {
          "metricType": "api_requests",
          "label": "API requests",
          "eventCount": 42,
          "totalQuantity": 840,
          "totalCostMinor": 8400,
          "currency": "INR",
          "unit": "requests",
          "lastRecordedAt": "2026-11-27T10:15:00.000Z"
        },
        {
          "metricType": "compute_units",
          "label": "Compute units",
          "eventCount": 3,
          "totalQuantity": 4.1,
          "totalCostMinor": 4100,
          "currency": "INR",
          "unit": "compute_units",
          "lastRecordedAt": "2026-11-27T11:30:00.000Z"
        },
        {
          "metricType": "storage",
          "label": "Storage",
          "eventCount": 0,
          "totalQuantity": 0,
          "totalCostMinor": 0,
          "currency": "INR",
          "unit": "GB-day",
          "lastRecordedAt": null
        }
      ]
    }
  }
  ```

### 5.3 Financial Summary & Trial Balance
- **Endpoint:** `GET /api/v1/analytics/financial`
- **Headers:** `Authorization`, `x-tenant-id`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Financial summary and trial balance retrieved.",
    "data": {
      "organizationId": "org_acme_001",
      "trialBalance": {
        "totalDebits": 1500000,
        "totalCredits": 1500000,
        "isBalanced": true
      },
      "accounts": {
        "accounts_receivable": { "debits": 1500000, "credits": 250000, "balance": 1250000 },
        "revenue": { "debits": 50000, "credits": 1300000, "balance": 1250000 }
      },
      "transactions": {
        "totalCount": 8,
        "byStatus": {
          "completed": { "count": 7, "totalAmountMinor": 1450000 },
          "reversed": { "count": 1, "totalAmountMinor": 50000 }
        }
      }
    }
  }
  ```

---

## 6. Billing & Ledger Endpoints (`/api/v1/billing`)

### 6.1 Create Billing Transaction (Atomic Double-Entry)
- **Endpoint:** `POST /api/v1/billing/transactions`
- **Headers:** `Authorization`, `x-tenant-id`, `idempotency-key`
- **Security & Reliability Protections:**
  1. **Redis Distributed Lock:** Serializes concurrent requests per tenant and idempotency key (`lock:billing:<orgId>:<idempotencyKey>`).
  2. **Multi-Document ACID Session:** Executes within a MongoDB transaction session with write concern `majority`.
  3. **Balanced Ledger Enforcement:** Automatically constructs and posts balanced double-entry ledger entries ($\sum \text{Debits} == \sum \text{Credits}$). If unbalanced, transaction aborts.
  4. **Cryptographic Idempotency Hash:** SHA-256 canonical hash of the request payload is stored. Reusing a key with altered parameters returns HTTP 409 (`IDEMPOTENCY_PAYLOAD_MISMATCH`). Reusing with identical payload replays the cached transaction.
- **Request Body:**
  ```json
  {
    "transactionId": "tx_invoice_1001",
    "idempotencyKey": "idem_inv_1001_v1",
    "amountMinor": 250000,
    "currency": "INR",
    "description": "Standard SaaS Subscription (November)",
    "customerId": "cust_acme_99"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Billing transaction created and ledger posted.",
    "data": {
      "transaction": {
        "transactionId": "tx_invoice_1001",
        "organizationId": "org_acme_001",
        "amountMinor": 250000,
        "currency": "INR",
        "status": "completed",
        "idempotencyKey": "idem_inv_1001_v1"
      },
      "ledgerEntries": [
        {
          "accountType": "accounts_receivable",
          "entryType": "debit",
          "amountMinor": 250000,
          "currency": "INR"
        },
        {
          "accountType": "revenue",
          "entryType": "credit",
          "amountMinor": 250000,
          "currency": "INR"
        }
      ]
    }
  }
  ```

### 6.2 Reverse Billing Transaction
- **Endpoint:** `POST /api/v1/billing/transactions/:transactionId/reversal`
- **Headers:** `Authorization`, `x-tenant-id`, `idempotency-key`
- **Access:** Admin or Manager only
- **Request Body:**
  ```json
  {
    "idempotencyKey": "idem_rev_1001",
    "reason": "Customer requested cancellation"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Transaction reversed successfully.",
    "data": {
      "transactionId": "tx_invoice_1001",
      "status": "reversed",
      "reversalEntries": [
        {
          "accountType": "revenue",
          "entryType": "debit",
          "amountMinor": 250000,
          "currency": "INR"
        },
        {
          "accountType": "accounts_receivable",
          "entryType": "credit",
          "amountMinor": 250000,
          "currency": "INR"
        }
      ]
    }
  }
  ```

---

## 7. Usage & Pricing Endpoints

### 7.1 Record Usage Event
- **Endpoint:** `POST /api/v1/usage/events`
- **Headers:** `Authorization`, `x-tenant-id`
- **Request Body:**
  ```json
  {
    "eventId": "evt_req_8921",
    "metricType": "api_requests",
    "quantityScaled": 250,
    "quantityScale": 1,
    "unit": "requests",
    "unitPriceMinor": 2,
    "currency": "INR"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Usage event recorded.",
    "data": {
      "eventId": "evt_req_8921",
      "costMinor": 500,
      "currency": "INR"
    }
  }
  ```

### 7.2 Create Pricing Plan
- **Endpoint:** `POST /api/v1/pricing/plans`
- **Headers:** `Authorization`, `x-tenant-id`
- **Access:** Admin only
- **Request Body:**
  ```json
  {
    "planCode": "growth_tier_v1",
    "name": "Growth Tier Plan",
    "rates": [
      { "metricType": "api_requests", "unit": "requests", "unitPriceMinor": 2, "currency": "INR" },
      { "metricType": "compute_units", "unit": "compute_units", "unitPriceMinor": 100, "currency": "INR" },
      { "metricType": "storage", "unit": "GB-day", "unitPriceMinor": 10, "currency": "INR" }
    ],
    "effectiveFrom": "2026-11-01T00:00:00.000Z"
  }
  ```

---

## 8. Frontend React Integration Blueprint

In the React frontend (`frontend/src/services/api.ts`), configure the API client:

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('organizationId');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { 'x-tenant-id': orgId } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  // Returns data payload directly
  return payload.data as T;
}
```

### Feeding Components:
- **Revenue Overview Chart (`Revenue()` in `App.tsx`):**
  ```typescript
  const { data } = await apiRequest<{ months: MonthlyRevenue[] }>('/analytics/revenue/monthly');
  // data.months contains: [{ month: "Jun 2026", monthKey: "2026-06", revenueMinor: 250000 }, ...]
  ```
- **Usage Metrics Cards (`useUsageSummary()` in `App.tsx`):**
  ```typescript
  const usage = await apiRequest<UsageSummary>('/analytics/usage');
  // usage.byMetric contains guaranteed [api_requests, compute_units, storage]
  ```
