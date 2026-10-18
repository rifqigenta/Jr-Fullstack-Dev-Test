import { describe, expect, it } from "vitest";

import { openApiDocument } from "../src/docs/openapi.js";

type Operation = {
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
  }>;
  requestBody?: {
    content: {
      "application/json": {
        schema: {
          required?: string[];
          additionalProperties?: boolean;
        };
      };
    };
  };
  responses: Record<string, unknown>;
  security?: Array<Record<string, unknown>>;
};

function operation(path: string, method: string): Operation {
  const paths = openApiDocument.paths;

  return paths[path]?.[method] as Operation;
}

describe("Dokumentasi autentikasi dan tunjangan", () => {
  it("mendokumentasikan payload CAPTCHA yang digunakan login", () => {
    const login = operation("/auth/login", "post");

    const required = login.requestBody?.content["application/json"].schema.required;

    expect(required).toContain("captchaId");
    expect(required).toContain("captchaAnswer");
    expect(required).not.toContain("captchaToken");

    expect(login.security).toEqual([]);
    expect(operation("/auth/captcha", "get")).toBeDefined();
  });

  it("mewajibkan tahun dan bulan pada pembacaan detail", () => {
    for (const path of ["/transport/me", "/transport/history"]) {
      const parameters = operation(path, "get").parameters || [];

      for (const name of ["tahun", "bulan"]) {
        expect(parameters).toContainEqual(
          expect.objectContaining({
            name,
            in: "query",
            required: true,
          }),
        );
      }
    }
  });

  it("tidak menawarkan parameter pembuka scope seluruh pegawai", () => {
    const parameters = operation("/transport/history", "get").parameters || [];

    const names = parameters.map((parameter) => parameter.name);

    expect(names).toContain("sortBy");
    expect(names).toContain("sortOrder");

    expect(names).not.toContain("userId");
    expect(names).not.toContain("id_pegawai");
    expect(names).not.toContain("scope");
  });

  it("mendokumentasikan CSRF pada seluruh mutasi tunjangan", () => {
    const mutations = [
      ["/transport/settings", "post"],
      ["/transport/settings/{id}", "patch"],
      ["/transport/settings/{id}", "delete"],
      ["/transport/attendance", "put"],
      ["/transport/calculate", "post"],
    ];

    for (const [path, method] of mutations) {
      const current = operation(path!, method!);

      expect(current.parameters).toContainEqual(
        expect.objectContaining({
          name: "X-CSRF-Token",
          in: "header",
          required: true,
        }),
      );

      expect(current.security).toEqual([{ cookieAuth: [] }, { bearerAuth: [] }]);
    }
  });

  it("mendokumentasikan status 201 untuk penambahan tarif", () => {
    const current = operation("/transport/settings", "post");

    expect(current.responses["201"]).toBeDefined();
    expect(current.responses["200"]).toBeUndefined();
  });

  it("mendokumentasikan rekap bulanan dan respons detail", () => {
    expect(operation("/transport/months", "get")).toBeDefined();

    for (const path of ["/transport/months", "/transport/history", "/transport/me"]) {
      expect(operation(path, "get").responses["200"]).toHaveProperty("content.application/json.schema");
    }
  });
});
