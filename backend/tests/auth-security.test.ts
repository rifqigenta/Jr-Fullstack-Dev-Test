import { describe, expect, it } from "vitest";

import { api } from "./helpers/test-app.js";

describe("Authentication Security", () => {
  it("should reject unauthenticated /auth/me", async () => {
    const response = await api.get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("should reject unauthenticated users API", async () => {
    const response = await api.get("/api/users");

    expect(response.status).toBe(401);
  });

  it("should reject unauthenticated employees API", async () => {
    const response = await api.get("/api/employees");

    expect(response.status).toBe(401);
  });

  it("should reject unauthenticated transport API", async () => {
    const response = await api.get("/api/transport/me?tahun=2026&bulan=10");

    expect(response.status).toBe(401);
  });

  it("should reject invalid bearer token", async () => {
    const response = await api.get("/api/auth/me").set("Authorization", "Bearer invalid.jwt.token");

    expect(response.status).toBe(401);
  });

  it("should reject login without CAPTCHA", async () => {
    const response = await api.post("/api/auth/login").send({
      identifier: "testuser",
      password: "TestPassword123!",
      rememberMe: false,
    });

    expect(response.status).toBe(400);
  });

  it("should reject invalid request origin", async () => {
    const response = await api.post("/api/auth/login").set("Origin", "https://untrusted.example").send({
      identifier: "testuser",
      password: "TestPassword123!",
      rememberMe: false,
      captchaToken: "invalid",
    });

    expect(response.status).toBe(403);
  });
});
