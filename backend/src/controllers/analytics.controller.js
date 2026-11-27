/**
 * Analytics Controller
 */
import {
  getFinancialSummary,
  getUsageAnalytics,
  getMonthlyRevenue
} from "../services/analytics.service.js";
import { sendSuccess, sendError } from "../utils/response.util.js";

export async function getFinancialAnalytics(req, res, next) {
  try {
    const { from, to, currency } = req.query;
    const organizationId = req.organizationId;

    const summary = await getFinancialSummary(req.tenantDb, {
      organizationId,
      from,
      to,
      currency
    });

    return sendSuccess(res, summary, "Financial summary and trial balance retrieved.", 200);
  } catch (error) {
    next(error);
  }
}

export async function getUsageAnalyticsReport(req, res, next) {
  try {
    const { from, to, currency } = req.query;
    const organizationId = req.organizationId;

    const summary = await getUsageAnalytics(req.tenantDb, {
      organizationId,
      from,
      to,
      currency
    });

    return sendSuccess(res, summary, "Usage analytics retrieved.", 200);
  } catch (error) {
    next(error);
  }
}

export async function getMonthlyRevenueReport(req, res, next) {
  try {
    const currency = String(req.query.currency || "INR").trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      return sendError(
        res,
        "Currency must be a valid 3-letter uppercase code (e.g. INR, USD).",
        400,
        null,
        "INVALID_CURRENCY"
      );
    }

    const report = await getMonthlyRevenue(req.tenantDb, {
      organizationId: req.organizationId,
      currency
    });

    return sendSuccess(res, report, "Monthly revenue retrieved.", 200);
  } catch (error) {
    next(error);
  }
}
