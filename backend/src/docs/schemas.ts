export const schemas = {
  ApiError: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: false,
      },
      message: {
        type: "string",
        example: "Request gagal.",
      },
      errors: {
        type: "object",
        additionalProperties: true,
      },
    },
  },

  Pagination: {
    type: "object",
    properties: {
      page: { type: "integer", example: 1 },
      limit: { type: "integer", example: 10 },
      total: { type: "integer", example: 50 },
      totalPages: { type: "integer", example: 5 },
    },
  },

  LoginRequest: {
    type: "object",
    required: ["identifier", "password", "captchaToken"],
    properties: {
      identifier: {
        type: "string",
        example: "superadmin",
      },
      password: {
        type: "string",
        format: "password",
        example: "ExamplePassword123!",
      },
      rememberMe: {
        type: "boolean",
        default: false,
      },
      captchaToken: {
        type: "string",
        description: "Token Cloudflare Turnstile dari frontend.",
      },
    },
  },

  CsrfTokenResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "object",
        properties: {
          csrfToken: {
            type: "string",
          },
        },
      },
    },
  },

  TransportSetting: {
    type: "object",
    properties: {
      id: { type: "integer" },
      base_fare: {
        type: "number",
        example: 2000,
      },
      berlaku_mulai: {
        type: "string",
        format: "date",
        example: "2026-10-01",
      },
      minimum_km: {
        type: "integer",
        example: 5,
      },
      maximum_km: {
        type: "integer",
        example: 25,
      },
    },
  },

  AttendanceInput: {
    type: "object",
    required: ["id_pegawai", "tahun", "bulan", "jumlah_hari_masuk"],
    properties: {
      id_pegawai: {
        type: "integer",
        example: 1,
      },
      tahun: {
        type: "integer",
        example: 2026,
      },
      bulan: {
        type: "integer",
        minimum: 1,
        maximum: 12,
        example: 10,
      },
      jumlah_hari_masuk: {
        type: "integer",
        minimum: 0,
        maximum: 31,
        example: 22,
      },
    },
  },

  CalculateTransportInput: {
    type: "object",
    required: ["tahun", "bulan"],
    properties: {
      tahun: {
        type: "integer",
        example: 2026,
      },
      bulan: {
        type: "integer",
        example: 10,
      },
    },
  },
} as const;
