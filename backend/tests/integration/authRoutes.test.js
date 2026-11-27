import test, { after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { generateToken, generatePlatformAdminToken } from "../../src/services/auth.service.js";
import { closeDatabaseConnections } from "../../src/config/db.js";
import { closeRedisConnection } from "../../src/config/redis.js";

test("Auth Routes: POST /api/v1/auth/register rejects unauthenticated public registration", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Malicious Stranger",
      email: "stranger@acme.example",
      password: "password123",
      organizationId: "org_acme_001"
    });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "UNAUTHORIZED");
});

test("Auth Routes: POST /api/v1/auth/register requires admin/manager role", async () => {
  const memberToken = generateToken({
    userId: "usr_member_1",
    email: "member@acme.example",
    organizationId: "org_acme_001",
    role: "member"
  });

  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({
      name: "New Member",
      email: "newmember@acme.example",
      password: "password123"
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, "FORBIDDEN");
});

test("Auth Routes: Manager cannot escalate privileges by creating an admin", async () => {
  const managerToken = generateToken({
    userId: "usr_manager_1",
    email: "manager@acme.example",
    organizationId: "org_acme_001",
    role: "manager"
  });

  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      name: "Escalated Admin",
      email: "escalated@acme.example",
      password: "password123",
      role: "admin"
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, "ROLE_ESCALATION_DENIED");
  assert.match(res.body.message, /Managers may only register users with the 'member' role/);
});

test("Auth Routes: POST /api/v1/auth/login fails with 400 when organizationId is missing", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({
      email: "test@example.com",
      password: "password123"
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "MISSING_TENANT_ID");
});

test("Auth Routes: GET /api/v1/auth/me requires valid RS256 Bearer token", async () => {
  // Missing Authorization header
  const resNoAuth = await request(app).get("/api/v1/auth/me");
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.code, "UNAUTHORIZED");

  // Invalid token
  const resBadAuth = await request(app)
    .get("/api/v1/auth/me")
    .set("Authorization", "Bearer invalid-token-value");
  assert.equal(resBadAuth.status, 401);
  assert.equal(resBadAuth.body.code, "INVALID_TOKEN");

  // Valid RS256 token returns profile claims
  const token = generateToken({
    userId: "usr_token_test_1",
    email: "testuser@zenith.example",
    organizationId: "org_zenith_002",
    role: "manager"
  });

  const resOk = await request(app)
    .get("/api/v1/auth/me")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(resOk.status, 200);
  assert.equal(resOk.body.success, true);
  assert.equal(resOk.body.data.email, "testuser@zenith.example");
  assert.equal(resOk.body.data.role, "manager");
  assert.equal(resOk.body.data.organizationId, "org_zenith_002");
});

test("Tenant Routes: POST /api/v1/tenants rejects regular tenant admin and forged claims", async () => {
  // Regular tenant admin (should be rejected from platform tenant creation)
  const tenantAdminToken = generateToken({
    userId: "usr_tenant_admin_1",
    email: "admin@acme.example",
    organizationId: "org_acme_001",
    role: "admin",
    isPlatformAdmin: false
  });

  const resTenantAdmin = await request(app)
    .post("/api/v1/tenants")
    .set("Authorization", `Bearer ${tenantAdminToken}`)
    .send({
      organizationId: "org_new_01",
      name: "New Org",
      email: "new@org.example",
      databaseName: "tenant_new_db"
    });

  assert.equal(resTenantAdmin.status, 403);
  assert.equal(resTenantAdmin.body.code, "PLATFORM_ADMIN_REQUIRED");
  assert.match(resTenantAdmin.body.message, /platform administrator privileges are required/i);

  // Forged claim: token says isPlatformAdmin: true, but belongs to tenant organizationId
  const forgedToken = generateToken({
    userId: "usr_forged",
    email: "forged@acme.example",
    organizationId: "org_acme_001",
    role: "admin",
    isPlatformAdmin: true // Attempted forgery
  });

  const resForged = await request(app)
    .get("/api/v1/tenants")
    .set("Authorization", `Bearer ${forgedToken}`);

  assert.equal(resForged.status, 403);
  assert.equal(resForged.body.code, "PLATFORM_ADMIN_REQUIRED");

  // Trusted platform admin generated via platform secret passes the authorization gate
  const platformAdminToken = generatePlatformAdminToken("ledgerguard-platform-root-secret-2026");

  const resPlatformAdmin = await request(app)
    .get("/api/v1/tenants")
    .set("Authorization", `Bearer ${platformAdminToken}`);

  // Passes auth and platform admin guard (database connection placeholder returns 503 or 200 depending on DB state)
  assert.notEqual(resPlatformAdmin.status, 401);
  assert.notEqual(resPlatformAdmin.status, 403);
});

test("Tenant Middleware: Cross-tenant access violation is prevented with HTTP 403", async () => {
  const token = generateToken({
    userId: "usr_org1_user",
    email: "user@org1.com",
    organizationId: "org_acme_001",
    role: "admin"
  });

  // Attempting to access another organization's resources while authenticated as org_acme_001
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Authorization", `Bearer ${token}`)
    .send({
      organizationId: "org_zenith_002",
      name: "Malicious Cross-Tenant",
      email: "intruder@zenith.com",
      password: "secretPassword123"
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, "TENANT_ACCESS_DENIED");
  assert.match(res.body.message, /Cross-tenant access violation/);
});
after(async () => {
  await closeDatabaseConnections();
  await closeRedisConnection();
});
