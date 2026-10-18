import { transportPaths, authPaths } from "./transport.openapi.js";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type Endpoint = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  roles?: string[];
  public?: boolean;
  csrf?: boolean;
  bodySchema?: string;
};

const endpoints: Endpoint[] = [
  // Health
  { method: "get", path: "/health", tag: "Health", summary: "Health check", public: true },
  { method: "get", path: "/health/db", tag: "Health", summary: "Database health check", public: true },

  // Authentication
  { method: "post", path: "/auth/login", tag: "Authentication", summary: "Login menggunakan username, email, atau nomor HP", public: true, bodySchema: "LoginRequest" },
  { method: "get", path: "/auth/me", tag: "Authentication", summary: "Informasi pengguna yang sedang login" },
  { method: "get", path: "/auth/csrf", tag: "Authentication", summary: "Mengambil CSRF token" },
  { method: "post", path: "/auth/logout", tag: "Authentication", summary: "Logout dan revoke session", csrf: true },

  // Users
  { method: "get", path: "/users", tag: "Users", summary: "Daftar pengguna", roles: ["Superadmin"] },
  { method: "get", path: "/users/employee-options", tag: "Users", summary: "Autocomplete pegawai untuk pengguna baru", roles: ["Superadmin"] },
  { method: "get", path: "/users/{id}", tag: "Users", summary: "Detail pengguna", roles: ["Superadmin"] },
  { method: "post", path: "/users", tag: "Users", summary: "Buat pengguna dan generate password", roles: ["Superadmin"], csrf: true },
  { method: "patch", path: "/users/{id}", tag: "Users", summary: "Perbarui pengguna", roles: ["Superadmin"], csrf: true },
  { method: "patch", path: "/users/{id}/status", tag: "Users", summary: "Aktifkan atau nonaktifkan pengguna", roles: ["Superadmin"], csrf: true },
  { method: "delete", path: "/users/{id}", tag: "Users", summary: "Soft delete pengguna", roles: ["Superadmin"], csrf: true },

  // Employees
  { method: "get", path: "/employees", tag: "Employees", summary: "Daftar pegawai dengan filter, pencarian, dan pagination", roles: ["Manager HRD", "Admin HRD"] },
  { method: "get", path: "/employees/export/excel", tag: "Employees", summary: "Export pegawai ke Excel", roles: ["Manager HRD", "Admin HRD"] },
  { method: "get", path: "/employees/export/pdf", tag: "Employees", summary: "Export pegawai ke PDF", roles: ["Manager HRD", "Admin HRD"] },
  { method: "get", path: "/employees/{id}", tag: "Employees", summary: "Detail pegawai dan pendidikan", roles: ["Manager HRD", "Admin HRD"] },
  { method: "post", path: "/employees", tag: "Employees", summary: "Tambah pegawai", roles: ["Admin HRD"], csrf: true },
  { method: "patch", path: "/employees/{id}", tag: "Employees", summary: "Perbarui pegawai", roles: ["Admin HRD"], csrf: true },
  { method: "delete", path: "/employees/{id}", tag: "Employees", summary: "Soft delete pegawai", roles: ["Admin HRD"], csrf: true },
  { method: "patch", path: "/employees/bulk/status", tag: "Employees", summary: "Ubah status beberapa pegawai", roles: ["Admin HRD"], csrf: true },
  { method: "post", path: "/employees/bulk/delete", tag: "Employees", summary: "Bulk soft delete pegawai", roles: ["Admin HRD"], csrf: true },

  // Master Data
  { method: "get", path: "/master-data/positions", tag: "Master Data", summary: "Daftar jabatan", roles: ["Manager HRD", "Admin HRD"] },
  { method: "get", path: "/master-data/departments", tag: "Master Data", summary: "Daftar departemen", roles: ["Manager HRD", "Admin HRD"] },
  { method: "get", path: "/master-data/regions", tag: "Master Data", summary: "Pencarian wilayah", roles: ["Manager HRD", "Admin HRD"] },

  // Dashboard
  { method: "get", path: "/dashboard/hrd", tag: "Dashboard", summary: "Statistik pegawai HRD dan pegawai terbaru", roles: ["Manager HRD", "Admin HRD"] },

  // Profile
  { method: "get", path: "/profile", tag: "Profile", summary: "Lihat profil sendiri" },
  { method: "patch", path: "/profile", tag: "Profile", summary: "Perbarui profil sendiri", csrf: true },

  // Roles
  { method: "get", path: "/roles", tag: "Roles", summary: "Daftar role", roles: ["Superadmin"] },
  { method: "get", path: "/roles/{id}/permissions", tag: "Roles", summary: "Daftar permission suatu role", roles: ["Superadmin"] },

  // Activities
  { method: "get", path: "/activities", tag: "Activities", summary: "Activity log dengan filter dan pagination", roles: ["Superadmin"] },

  // Transport
  { method: "get", path: "/transport/settings", tag: "Transport", summary: "Daftar tarif transport", roles: ["Admin HRD"] },
  { method: "post", path: "/transport/settings", tag: "Transport", summary: "Tambah tarif transport", roles: ["Admin HRD"], csrf: true, bodySchema: "TransportSetting" },
  { method: "patch", path: "/transport/settings/{id}", tag: "Transport", summary: "Perbarui tarif transport", roles: ["Admin HRD"], csrf: true },
  { method: "delete", path: "/transport/settings/{id}", tag: "Transport", summary: "Hapus tarif transport", roles: ["Admin HRD"], csrf: true },
  { method: "put", path: "/transport/attendance", tag: "Transport", summary: "Simpan kehadiran bulanan", roles: ["Admin HRD"], csrf: true, bodySchema: "AttendanceInput" },
  { method: "post", path: "/transport/calculate", tag: "Transport", summary: "Hitung tunjangan transport bulanan", roles: ["Admin HRD"], csrf: true, bodySchema: "CalculateTransportInput" },
  { method: "get", path: "/transport/me", tag: "Transport", summary: "Lihat tunjangan milik sendiri", roles: ["Manager HRD", "Admin HRD"] },
  { method: "get", path: "/transport/history", tag: "Transport", summary: "Riwayat tunjangan seluruh pegawai", roles: ["Admin HRD"] },

  { method: "post", path: "/employees/{id}/photo", tag: "Employees", summary: "Upload atau ganti foto pegawai", roles: ["Admin HRD"], csrf: true },
];

export { endpoints };

export function buildPaths(): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of endpoints) {
    const { method, path, tag, summary, roles, csrf, bodySchema } = endpoint;

    const operation: Record<string, unknown> = {
      tags: [tag],
      summary,
      description: roles?.length ? `Role yang diizinkan: ${roles.join(", ")}.` : "Memerlukan autentikasi kecuali dinyatakan public.",
      security: endpoint.public ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],
      responses: {
        "200": { description: "Berhasil" },
        "400": {
          description: "Request tidak valid",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden" },
        "404": { description: "Not Found" },
        "409": { description: "Conflict" },
        "429": { description: "Too Many Requests" },
        "500": { description: "Internal Server Error" },
      },
    };

    const pathParameters = [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
      name: match[1],
      in: "path",
      required: true,
      schema: {
        type: "integer",
        minimum: 1,
      },
    }));

    if (pathParameters.length) {
      operation.parameters = pathParameters;
    }

    if (csrf) {
      operation.parameters = [
        ...pathParameters,
        {
          name: "X-CSRF-Token",
          in: "header",
          required: true,
          description: "Token dari GET /api/auth/csrf.",
          schema: { type: "string" },
        },
      ];
    }

    if (bodySchema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: `#/components/schemas/${bodySchema}`,
            },
          },
        },
      };
    }

    paths[path] ??= {};
    paths[path][method] = operation;
  }

  const photoUpload = paths["/employees/{id}/photo"]?.post as Record<string, unknown> | undefined;

  if (photoUpload) {
    photoUpload.requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["photo"],
            properties: {
              photo: {
                type: "string",
                format: "binary",
                description: "Foto pegawai (JPEG, PNG, atau WebP, maksimal 2 MB).",
              },
            },
          },
        },
      },
    };
  }

  return {
    ...paths,
    ...transportPaths,
    ...authPaths,
  };
}
