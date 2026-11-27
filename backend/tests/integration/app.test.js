import test, { after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { closeDatabaseConnections } from "../../src/config/db.js";
import { closeRedisConnection } from "../../src/config/redis.js";

after(async () => {
  await closeDatabaseConnections();
  await closeRedisConnection();
});

test("App Integration: GET /health returns 200 with distinguishable app and db status", async () => {
  const res = await request(app).get("/health");

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.status);
  assert.equal(res.body.data.application.status, "up");
  assert.equal(res.body.data.application.service, "ledgerguard-backend");
  assert.equal(res.body.data.application.version, "1.0.0");
  assert.ok(res.body.data.application.timestamp);
  assert.ok(res.body.data.database);
  assert.ok(res.body.data.database.readiness);
});

test("App Integration: GET /api/v1/health returns identical operational details", async () => {
  const res = await request(app).get("/api/v1/health");

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.application.status, "up");
  assert.ok(res.body.data.database.readiness);
});

test("App Integration: Unknown route returns 404 with structured error response", async () => {
  const res = await request(app).get("/api/v1/non-existent-endpoint");

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "NOT_FOUND");
  assert.match(res.body.message, /Route not found/);
});
