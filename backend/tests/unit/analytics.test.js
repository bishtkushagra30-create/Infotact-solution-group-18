import test from "node:test";
import assert from "node:assert/strict";
import {
  getMonthlyRevenue,
  getUsageAnalytics,
  getFinancialSummary,
  CANONICAL_METRICS
} from "../../src/services/analytics.service.js";

test("Analytics Service: CANONICAL_METRICS contains required metric types", () => {
  const metricTypes = CANONICAL_METRICS.map(m => m.metricType);
  assert.ok(metricTypes.includes("api_requests"));
  assert.ok(metricTypes.includes("compute_units"));
  assert.ok(metricTypes.includes("storage"));
});

test("Analytics Service: getMonthlyRevenue computes net revenue (credit - debit) for 6 calendar months", async () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Mock tenant DB with Ledger model aggregation
  const mockTenantDb = {
    models: {
      LedgerEntry: {
        aggregate: async (pipeline) => {
          // Check that pipeline filters by revenue account and specified currency
          const match = pipeline[0].$match;
          assert.equal(match.accountType, "revenue");
          assert.equal(match.currency, "INR");
          assert.equal(match.organizationId, "org_acme_001");

          // Return mock aggregation data for current month:
          // 1 credit of 100,000 paise (₹1000) and 1 reversal debit of 20,000 paise (₹200)
          return [
            {
              _id: { year: currentYear, month: currentMonth, entryType: "credit" },
              totalAmountMinor: 100000,
              count: 1
            },
            {
              _id: { year: currentYear, month: currentMonth, entryType: "debit" },
              totalAmountMinor: 20000,
              count: 1
            }
          ];
        }
      }
    }
  };

  const report = await getMonthlyRevenue(mockTenantDb, {
    organizationId: "org_acme_001",
    currency: "INR"
  });

  assert.equal(report.organizationId, "org_acme_001");
  assert.equal(report.currency, "INR");
  assert.equal(report.months.length, 6);

  // The latest month (current month) should reflect net revenue: 100,000 - 20,000 = 80,000
  const latestMonth = report.months[5];
  assert.equal(latestMonth.grossRevenueMinor, 100000);
  assert.equal(latestMonth.reversalMinor, 20000);
  assert.equal(latestMonth.revenueMinor, 80000);
  assert.equal(report.totalRevenueMinor, 80000);
});

test("Analytics Service: getMonthlyRevenue isolates currency and does not mix monetary amounts", async () => {
  const mockTenantDb = {
    models: {
      LedgerEntry: {
        aggregate: async (pipeline) => {
          const match = pipeline[0].$match;
          assert.equal(match.currency, "USD");
          return [];
        }
      }
    }
  };

  const report = await getMonthlyRevenue(mockTenantDb, {
    organizationId: "org_acme_001",
    currency: "USD"
  });

  assert.equal(report.currency, "USD");
  assert.equal(report.totalRevenueMinor, 0);
  assert.equal(report.months.length, 6);
  for (const m of report.months) {
    assert.equal(m.revenueMinor, 0);
  }
});

test("Analytics Service: getUsageAnalytics guarantees all 3 canonical metrics and rational quantities", async () => {
  const mockTenantDb = {
    models: {
      UsageRecord: {
        aggregate: async () => {
          // Return aggregated data for compute_units and api_requests, leaving storage empty
          return [
            {
              _id: "compute_units",
              eventCount: 5,
              totalQuantity: 13.75, // e.g. 5 * 2.75
              totalCostMinor: 140,
              currency: "INR",
              unit: "compute_units",
              lastRecordedAt: new Date("2026-11-20T10:00:00Z")
            },
            {
              _id: "api_requests",
              eventCount: 100,
              totalQuantity: 1000,
              totalCostMinor: 2000,
              currency: "INR",
              unit: "requests",
              lastRecordedAt: new Date("2026-11-22T15:30:00Z")
            }
          ];
        }
      }
    }
  };

  const report = await getUsageAnalytics(mockTenantDb, {
    organizationId: "org_zenith_002",
    currency: "INR"
  });

  assert.equal(report.organizationId, "org_zenith_002");
  assert.equal(report.currency, "INR");
  assert.equal(report.totalEvents, 105);
  assert.equal(report.totalCostMinor, 2140);
  assert.equal(report.byMetric.length, 3);

  // Check compute_units
  const compute = report.byMetric.find(m => m.metricType === "compute_units");
  assert.ok(compute);
  assert.equal(compute.eventCount, 5);
  assert.equal(compute.totalQuantity, 13.75);
  assert.equal(compute.totalCostMinor, 140);

  // Check api_requests
  const api = report.byMetric.find(m => m.metricType === "api_requests");
  assert.ok(api);
  assert.equal(api.eventCount, 100);
  assert.equal(api.totalQuantity, 1000);
  assert.equal(api.totalCostMinor, 2000);

  // Check storage (was unrecorded, should default gracefully with 0s)
  const storage = report.byMetric.find(m => m.metricType === "storage");
  assert.ok(storage);
  assert.equal(storage.eventCount, 0);
  assert.equal(storage.totalQuantity, 0);
  assert.equal(storage.totalCostMinor, 0);
  assert.equal(storage.lastRecordedAt, null);
  assert.equal(storage.unit, "GB-day");
});

test("Analytics Service: getFinancialSummary isolates ledger and transactions by currency", async () => {
  const observedMatches = [];

  const mockTenantDb = {
    models: {
      LedgerEntry: {
        aggregate: async (pipeline) => {
          observedMatches.push(pipeline[0].$match);

          return [
            {
              _id: { accountType: "receivable", entryType: "debit" },
              totalAmountMinor: 50000,
              count: 1
            },
            {
              _id: { accountType: "revenue", entryType: "credit" },
              totalAmountMinor: 50000,
              count: 1
            }
          ];
        }
      },
      BillingTransaction: {
        aggregate: async (pipeline) => {
          observedMatches.push(pipeline[0].$match);

          return [
            {
              _id: "success",
              count: 1,
              totalAmountMinor: 50000
            }
          ];
        }
      }
    }
  };

  const report = await getFinancialSummary(mockTenantDb, {
    organizationId: "org_acme_001",
    currency: " usd "
  });

  assert.equal(observedMatches.length, 2);

  for (const match of observedMatches) {
    assert.equal(match.organizationId, "org_acme_001");
    assert.equal(match.currency, "USD");
  }

  assert.equal(report.currency, "USD");
  assert.equal(report.accounts.receivable.balanceMinor, 50000);
  assert.equal(report.accounts.revenue.balanceMinor, 50000);
  assert.equal(report.trialBalance.isBalanced, true);
  assert.equal(report.transactions.totalCount, 1);
});
