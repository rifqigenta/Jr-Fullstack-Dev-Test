import { describe, expect, it } from "vitest";

import { api } from "./helpers/test-app.js";

describe("Health API", () => {
  it("GET /api/health should return 200", async () => {
    const response = await api.get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it("unknown API endpoint should return 404", async () => {
    const response = await api.get("/api/endpoint-that-does-not-exist");

    expect(response.status).toBe(404);
  });
});
