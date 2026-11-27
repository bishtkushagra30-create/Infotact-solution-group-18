/**
 * Analytics & Reporting Service
 *
 * Runs aggregation pipelines over the double-entry ledger and usage records
 * for financial reporting, trial balances, and meter consumption analysis.
 */
import {
  getLedgerEntryModel,
  getBillingTransactionModel,
  getUsageRecordModel
} from "../config/db.js";

export const CANONICAL_METRICS = [
  { metricType: "api_requests", defaultUnit: "requests", label: "API requests" },
  { metricType: "compute_units", defaultUnit: "compute_units", label: "Compute units" },
  { metricType: "storage", defaultUnit: "GB-day", label: "Storage" }
];

function normalizeCurrency(currency = "INR") {
  const normalized = String(currency || "INR").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw Object.assign(
      new Error("Currency must be a valid three-letter code."),
      { statusCode: 400, code: "INVALID_CURRENCY" }
    );
  }

  return normalized;
}

/**
 * Computes financial ledger balances (Receivables, Revenue, Cash).
 * All monetary calculations are isolated to one currency.
 */
export async function getFinancialSummary(
  tenantDb,
  { organizationId, from, to, currency = "INR" }
) {
  const Ledger = getLedgerEntryModel(tenantDb);
  const Tx = getBillingTransactionModel(tenantDb);
  const normalizedCurrency = normalizeCurrency(currency);

  const match = {
    organizationId,
    currency: normalizedCurrency
  };

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  // 1. Double-entry balances by accountType and entryType.
  const ledgerAggregation = await Ledger.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          accountType: "$accountType",
          entryType: "$entryType"
        },
        totalAmountMinor: { $sum: "$amountMinor" },
        count: { $sum: 1 }
      }
    }
  ]);

  let totalDebits = 0;
  let totalCredits = 0;

  const accounts = {
    receivable: { debit: 0, credit: 0, balanceMinor: 0 },
    revenue: { debit: 0, credit: 0, balanceMinor: 0 },
    cash: { debit: 0, credit: 0, balanceMinor: 0 }
  };

  for (const item of ledgerAggregation) {
    const { accountType, entryType } = item._id;
    const amount = item.totalAmountMinor;

    if (accounts[accountType]) {
      accounts[accountType][entryType] = amount;
    }

    if (entryType === "debit") totalDebits += amount;
    if (entryType === "credit") totalCredits += amount;
  }

  // Double-entry calculated balances.
  accounts.receivable.balanceMinor =
    accounts.receivable.debit - accounts.receivable.credit;

  accounts.revenue.balanceMinor =
    accounts.revenue.credit - accounts.revenue.debit;

  accounts.cash.balanceMinor =
    accounts.cash.debit - accounts.cash.credit;

  // 2. Transaction status breakdown in the same currency.
  const txStatusAggregation = await Tx.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmountMinor: { $sum: "$amountMinor" }
      }
    }
  ]);

  const transactions = {
    totalCount: 0,
    byStatus: {}
  };

  for (const item of txStatusAggregation) {
    transactions.totalCount += item.count;
    transactions.byStatus[item._id] = {
      count: item.count,
      totalAmountMinor: item.totalAmountMinor
    };
  }

  return {
    organizationId,
    currency: normalizedCurrency,
    trialBalance: {
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits
    },
    accounts,
    transactions
  };
}

/**
 * Computes aggregated usage metrics and consumption trends.
 * Supports canonical metrics, currency filtering and rational quantities.
 */
export async function getUsageAnalytics(
  tenantDb,
  { organizationId, from, to, currency = "INR" }
) {
  const Usage = getUsageRecordModel(tenantDb);
  const normalizedCurrency = normalizeCurrency(currency);

  const match = {
    organizationId,
    currency: normalizedCurrency
  };

  if (from || to) {
    match.recordedAt = {};
    if (from) match.recordedAt.$gte = new Date(from);
    if (to) match.recordedAt.$lte = new Date(to);
  }

  const aggregation = await Usage.aggregate([
    { $match: match },
    {
      $project: {
        metricType: 1,
        totalCostMinor: 1,
        currency: 1,
        unit: 1,
        recordedAt: 1,
        quantity: {
          $cond: [
            { $gt: ["$quantityScale", 0] },
            { $divide: ["$quantityScaled", "$quantityScale"] },
            "$quantityScaled"
          ]
        }
      }
    },
    {
      $group: {
        _id: "$metricType",
        eventCount: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
        totalCostMinor: { $sum: "$totalCostMinor" },
        currency: { $first: "$currency" },
        unit: { $first: "$unit" },
        lastRecordedAt: { $max: "$recordedAt" }
      }
    },
    { $sort: { totalCostMinor: -1 } }
  ]);

  const aggregatedMap = new Map();

  for (const item of aggregation) {
    aggregatedMap.set(item._id, item);
  }

  const byMetric = CANONICAL_METRICS.map((definition) => {
    const existing = aggregatedMap.get(definition.metricType);

    if (!existing) {
      return {
        metricType: definition.metricType,
        label: definition.label,
        eventCount: 0,
        totalQuantity: 0,
        totalCostMinor: 0,
        currency: normalizedCurrency,
        unit: definition.defaultUnit,
        lastRecordedAt: null
      };
    }

    return {
      metricType: definition.metricType,
      label: definition.label,
      eventCount: existing.eventCount,
      totalQuantity: Math.round(existing.totalQuantity * 10000) / 10000,
      totalCostMinor: existing.totalCostMinor,
      currency: existing.currency || normalizedCurrency,
      unit: existing.unit || definition.defaultUnit,
      lastRecordedAt: existing.lastRecordedAt
    };
  });

  const totalCostMinor = byMetric.reduce(
    (total, item) => total + item.totalCostMinor,
    0
  );

  const totalEvents = byMetric.reduce(
    (total, item) => total + item.eventCount,
    0
  );

  return {
    organizationId,
    currency: normalizedCurrency,
    reportingPeriod: {
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to).toISOString() : null
    },
    totalEvents,
    totalCostMinor,
    byMetric
  };
}

/**
 * Returns monthly net revenue for the last six calendar months.
 * Net Revenue = Credits - Debits.
 */
export async function getMonthlyRevenue(
  tenantDb,
  { organizationId, currency = "INR" }
) {
  const Ledger = getLedgerEntryModel(tenantDb);
  const normalizedCurrency = normalizeCurrency(currency);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const aggregation = await Ledger.aggregate([
    {
      $match: {
        organizationId,
        accountType: "revenue",
        currency: normalizedCurrency,
        createdAt: { $gte: startDate, $lt: endDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          entryType: "$entryType"
        },
        totalAmountMinor: { $sum: "$amountMinor" },
        count: { $sum: 1 }
      }
    }
  ]);

  const monthlyTotals = new Map();

  for (const item of aggregation) {
    const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
    const current = monthlyTotals.get(key) || { credit: 0, debit: 0 };

    current[item._id.entryType] = item.totalAmountMinor;
    monthlyTotals.set(key, current);
  }

  const months = [];
  let totalRevenueMinor = 0;

  for (let offset = 0; offset < 6; offset++) {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + offset,
      1
    );

    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    const totals = monthlyTotals.get(monthKey) || {
      credit: 0,
      debit: 0
    };

    const grossRevenueMinor = totals.credit;
    const reversalMinor = totals.debit;
    const netRevenueMinor = grossRevenueMinor - reversalMinor;

    totalRevenueMinor += netRevenueMinor;

    months.push({
      month: date.toLocaleString("en-IN", { month: "short" }),
      monthKey,
      grossRevenueMinor,
      reversalMinor,
      revenueMinor: netRevenueMinor
    });
  }

  return {
    organizationId,
    currency: normalizedCurrency,
    totalRevenueMinor,
    period: {
      from: startDate.toISOString(),
      to: new Date(endDate.getTime() - 1).toISOString()
    },
    months
  };
}
