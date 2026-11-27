/**
 * Analytics Routes (/api/v1/analytics)
 */
import { Router } from "express";
import {
  getFinancialAnalytics,
  getUsageAnalyticsReport,
  getMonthlyRevenueReport
} from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { resolveTenant } from "../middleware/tenant.middleware.js";
import { sendError } from "../utils/response.util.js";

const router = Router();

function validateAnalyticsQuery(req, res, next) {
  if (req.query.currency) {
    const currency = String(req.query.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return sendError(
        res,
        "Currency must be a valid 3-letter uppercase code (e.g. INR, USD).",
        400,
        null,
        "INVALID_CURRENCY"
      );
    }
  }
  next();
}

router.use(authenticate);
router.use(validateAnalyticsQuery);
router.use(resolveTenant);

router.get("/financial", getFinancialAnalytics);
router.get("/usage", getUsageAnalyticsReport);
router.get("/revenue/monthly", getMonthlyRevenueReport);

export default router;
