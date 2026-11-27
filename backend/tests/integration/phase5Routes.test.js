import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { generateToken } from "../../src/services/auth.service.js";

test("Usage Routes: POST /api/v1/usage/events validates required fields", async () => {
  const token = generateToken({
    userId: "usr_usage_1",
    email: "user@acme.example",
    organizationId: "org_acme_001",
    role: "member"
  });

  // Missing eventId
  const resNoId = await request(app)
    .post("/api/v1/usage/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      metricType: "api_requests",
      quantityScaled: 100,
      unit: "request",
      unitPriceMinor: 2
    });

  assert.equal(resNoId.status, 400);
  assert.equal(resNoId.body.code, "MISSING_EVENT_ID");

  // Invalid quantity (negative)
  const resNeg = await request(app)
    .post("/api/v1/usage/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      eventId: "evt_neg",
      metricType: "api_requests",
      quantityScaled: -50,
      unit: "request",
      unitPriceMinor: 2
    });

  assert.equal(resNeg.status, 400);
  assert.equal(resNeg.body.code, "INVALID_QUANTITY");
});

test("Pricing Routes: POST /api/v1/pricing/plans requires admin role", async () => {
  // Member role should be denied
  const memberToken = generateToken({
    userId: "usr_mem_pricing",
    email: "member@acme.example",
    organizationId: "org_acme_001",
    role: "member"
  });

  const resForbidden = await request(app)
    .post("/api/v1/pricing/plans")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({
      planCode: "growth",
      name: "Growth Plan",
      rates: [{ metricType: "api_requests", unit: "req", unitPriceMinor: 2, currency: "INR" }],
      effectiveFrom: new Date()
    });

  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.body.code, "FORBIDDEN");
});

test("Pricing Routes: POST /api/v1/pricing/plans validates planCode and rates", async () => {
  const adminToken = generateToken({
    userId: "usr_admin_pricing",
    email: "admin@acme.example",
    organizationId: "org_acme_001",
    role: "admin"
  });

  const resMissing = await request(app)
    .post("/api/v1/pricing/plans")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "No Code Plan",
      rates: []
    });

  assert.equal(resMissing.status, 400);
  assert.equal(resMissing.body.code, "MISSING_PLAN_CODE");
});

test("Analytics Routes: GET /api/v1/analytics/financial requires authentication", async () => {
  const resNoAuth = await request(app).get("/api/v1/analytics/financial");
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.code, "UNAUTHORIZED");
});

test("Analytics Routes: GET /api/v1/analytics/revenue/monthly requires authentication and validates currency", async () => {
  const resNoAuth = await request(app).get("/api/v1/analytics/revenue/monthly");
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.code, "UNAUTHORIZED");

  const token = generateToken({
    userId: "usr_analytics_1",
    email: "analyst@acme.example",
    organizationId: "org_acme_001",
    role: "member"
  });

  const resInvalidCurrency = await request(app)
    .get("/api/v1/analytics/revenue/monthly?currency=INVALID")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(resInvalidCurrency.status, 400);
  assert.equal(resInvalidCurrency.body.code, "INVALID_CURRENCY");
});

test("Analytics Routes: GET /api/v1/analytics/usage requires authentication", async () => {
  const resNoAuth = await request(app).get("/api/v1/analytics/usage");
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.code, "UNAUTHORIZED");
});
