import { describe, expect, it } from "vitest";

import { api } from "./helpers/test-app.js";

describe("OpenAPI Documentation", () => {
  it("should expose valid OpenAPI metadata", async () => {
    const response = await api.get("/api/docs/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.info.title).toBe("JMC Kepegawaian API");
  });

  it("should document authentication", async () => {
    const response = await api.get("/api/docs/openapi.json");

    const paths = response.body.paths;

    expect(paths["/auth/login"].post).toBeDefined();
    expect(paths["/auth/logout"].post).toBeDefined();
    expect(paths["/auth/csrf"].get).toBeDefined();
  });

  it("should document transport module", async () => {
    const response = await api.get("/api/docs/openapi.json");

    const paths = response.body.paths;

    expect(paths["/transport/settings"].get).toBeDefined();

    expect(paths["/transport/attendance"].put).toBeDefined();

    expect(paths["/transport/calculate"].post).toBeDefined();

    expect(paths["/transport/me"].get).toBeDefined();
  });

  it("should document CSRF header on mutations", async () => {
    const response = await api.get("/api/docs/openapi.json");

    const operation = response.body.paths["/transport/attendance"].put;

    expect(operation.parameters.some((param: { name: string }) => param.name === "X-CSRF-Token")).toBe(true);
  });

  it("should provide Swagger UI", async () => {
    const response = await api.get("/api/docs/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("swagger-ui");
  });
});
