type Schema = Record<string, unknown>;

const ref = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

const integer = (minimum: number, maximum: number, example: number): Schema => ({
  type: "integer",
  minimum,
  maximum,
  example,
});

const year = integer(2000, 2100, 2026);
const month = integer(1, 12, 10);

const id: Schema = {
  oneOf: [
    { type: "integer", minimum: 1 },
    { type: "string", pattern: "^[1-9][0-9]*$" },
  ],
  description: "ID dapat berupa string jika berasal dari BIGINT.",
  example: 1,
};

function object(properties: Record<string, unknown>, required: string[] = Object.keys(properties)): Schema {
  return {
    type: "object",
    properties,
    required,
  };
}

function input(properties: Record<string, unknown>, required: string[] = Object.keys(properties)): Schema {
  return {
    ...object(properties, required),
    additionalProperties: false,
  };
}

function query(name: string, schema: Schema, required = false, description?: string) {
  return {
    name,
    in: "query",
    required,
    schema,
    ...(description ? { description } : {}),
  };
}

const periodParameters = [query("tahun", year, true), query("bulan", month, true)];

const pathId = {
  name: "id",
  in: "path",
  required: true,
  schema: {
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  },
};

const csrfHeader = {
  name: "X-CSRF-Token",
  in: "header",
  required: true,
  description: "Ambil dari GET /auth/csrf setelah login. " + "Backend saat ini juga memerlukannya untuk mutasi dengan Bearer JWT.",
  schema: { type: "string" },
};

function jsonResponse(description: string, schema: Schema) {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}

function success(data: Schema, paginated = false): Schema {
  return object(
    {
      success: { type: "boolean", enum: [true] },
      message: { type: "string" },
      data,
      ...(paginated ? { pagination: ref("Pagination") } : {}),
    },
    ["success", "data", ...(paginated ? ["pagination"] : [])],
  );
}

function requestBody(schema: Schema) {
  return {
    required: true,
    content: {
      "application/json": { schema },
    },
  };
}

const errorResponses = Object.fromEntries(
  [
    ["400", "Parameter, CAPTCHA, atau isian tidak valid."],
    ["401", "Belum login atau sesi berakhir/dicabut."],
    ["403", "Hak akses atau CSRF ditolak."],
    ["404", "Data, pegawai terkait, atau tarif tidak ditemukan."],
    ["409", "Data duplikat atau periode sedang dihitung."],
    ["429", "Batas request terlampaui."],
    ["500", "Kesalahan server."],
  ].map(([status, description]) => [status, jsonResponse(description!, ref("ApiError"))]),
);

type OperationOptions = {
  summary: string;
  description: string;
  data: Schema;
  parameters?: unknown[];
  body?: Schema;
  mutation?: boolean;
  public?: boolean;
  paginated?: boolean;
  status?: number;
  tag?: string;
};

function operation(options: OperationOptions) {
  return {
    tags: [options.tag || "Transport"],
    summary: options.summary,
    description: options.description,

    security: options.public ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],

    parameters: [...(options.parameters || []), ...(options.mutation ? [csrfHeader] : [])],

    ...(options.body ? { requestBody: requestBody(options.body) } : {}),

    responses: {
      ...errorResponses,
      [String(options.status || 200)]: jsonResponse("Berhasil.", success(options.data, options.paginated)),
    },
  };
}

const settingFields = {
  base_fare: {
    type: "number",
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 1_000_000,
    multipleOf: 0.01,
    example: 5000,
    description: "Tarif Rupiah per km, maksimal dua desimal.",
  },

  berlaku_mulai: {
    type: "string",
    format: "date",
    example: "2026-10-01",
  },

  minimum_km: {
    type: "integer",
    enum: [5],
    example: 5,
  },

  maximum_km: {
    type: "integer",
    enum: [25],
    example: 25,
  },
};

const setting = object({
  id,
  ...settingFields,
});

const attendance = input({
  id_pegawai: {
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 10,
  },
  tahun: year,
  bulan: month,
  jumlah_hari_masuk: {
    ...integer(0, 31, 22),
    description: "Bilangan bulat, tidak boleh melebihi jumlah hari kalender bulan tersebut.",
  },
});

const detail = object(
  {
    id,
    id_pegawai: id,
    tahun: year,
    bulan: month,

    nip: { type: "string", example: "20260008" },

    nama_pegawai: {
      type: "string",
      example: "Pegawai Contoh",
    },

    status_kontrak: {
      type: "string",
      nullable: true,
      example: "PKWTT",
    },

    jarak_asli_km: {
      type: "number",
      example: 12.5,
    },

    jarak_dihitung_km: {
      type: "number",
      example: 13,
    },

    jumlah_hari_masuk: {
      type: "integer",
      example: 22,
    },

    base_fare: {
      type: "number",
      example: 5000,
    },

    nominal: {
      type: "number",
      example: 1430000,
    },

    calculated_at: {
      type: "string",
      format: "date-time",
    },
  },
  ["id", "tahun", "bulan", "nama_pegawai", "jarak_asli_km", "jarak_dihitung_km", "jumlah_hari_masuk", "base_fare", "nominal"],
);

const readScope =
  "Admin HRD melihat seluruh penerima; Manager HRD hanya melihat " +
  "pegawai yang terhubung dengan akun login. Scope ditentukan server, " +
  "bukan parameter request. Akses seluruh penerima oleh Admin HRD " +
  "merupakan asumsi operasional aplikasi.";

export const transportPaths = {
  "/transport/settings": {
    get: operation({
      summary: "Daftar pengaturan tarif",
      description: "Khusus Admin HRD. Diurutkan berdasarkan tanggal berlaku terbaru.",
      data: {
        type: "array",
        items: setting,
      },
    }),

    post: operation({
      summary: "Tambah pengaturan tarif",
      description: "Khusus Admin HRD. Minimum 5 km dan maksimum 25 km mengikuti aturan tes.",
      mutation: true,
      status: 201,
      body: input(settingFields),
      data: setting,
    }),
  },

  "/transport/settings/{id}": {
    patch: operation({
      summary: "Perbarui pengaturan tarif",
      description: "Khusus Admin HRD. Isi minimal satu field. " + "Perubahan tidak otomatis menghitung ulang tunjangan tersimpan.",
      parameters: [pathId],
      mutation: true,
      body: {
        ...input(settingFields, []),
        minProperties: 1,
      },
      data: setting,
    }),

    delete: operation({
      summary: "Hapus pengaturan tarif",
      description: "Khusus Admin HRD. Penghapusan dapat ditolak jika data masih direferensikan.",
      parameters: [pathId],
      mutation: true,
      data: object({
        id,
        deleted: { type: "boolean", enum: [true] },
      }),
    }),
  },

  "/transport/attendance": {
    put: operation({
      summary: "Simpan atau perbarui kehadiran bulanan",
      description: "Khusus Admin HRD. Request dengan pegawai, tahun, dan bulan " + "yang sama memperbarui data kehadiran. " + "Jalankan /transport/calculate untuk memperbarui nominal tunjangan.",
      mutation: true,
      body: attendance,
      data: attendance,
    }),
  },

  "/transport/calculate": {
    post: operation({
      summary: "Hitung ulang tunjangan satu bulan",
      description:
        "Khusus Admin HRD. Memeriksa seluruh pegawai aktif yang memiliki " +
        "kehadiran pada periode dan tanggal masuk tidak melewati akhir bulan. " +
        "Penerima harus PKWTT, masuk minimal 19 hari, dan jarak asli > 5 km. " +
        "Jarak dibulatkan half-up dan dibatasi 25 km. " +
        "Nominal = tarif × km dihitung × hari masuk. " +
        "Tarif terakhir yang berlaku sampai akhir bulan digunakan untuk seluruh bulan. " +
        "Snapshot periode diganti dalam transaksi; kegagalan membatalkan perubahan. " +
        "Perhitungan memakai data pegawai saat ini, bukan riwayat historisnya.",
      mutation: true,
      body: input({
        tahun: year,
        bulan: month,
      }),
      data: object({
        tahun: year,
        bulan: month,
        setting_id: id,
        base_fare: { type: "number", example: 5000 },
        calculated_count: {
          type: "integer",
          example: 10,
          description: "Jumlah pegawai yang diperiksa.",
        },
        recipient_count: {
          type: "integer",
          example: 6,
          description: "Jumlah pegawai dengan nominal lebih dari nol.",
        },
        total_nominal: {
          type: "number",
          example: 6000000,
        },
      }),
    }),
  },

  "/transport/months": {
    get: operation({
      summary: "Rekap 12 bulan berdasarkan tahun",
      description: `${readScope} Total penerima hanya menghitung nominal > 0. ` + "Bulan tanpa penerima tetap dikembalikan dengan nilai nol.",
      parameters: [query("tahun", year, true)],
      data: {
        type: "array",
        minItems: 12,
        maxItems: 12,
        items: object({
          tahun: year,
          bulan: month,
          nama_bulan: {
            type: "string",
            example: "Oktober",
          },
          total_penerima: {
            type: "integer",
            example: 6,
          },
          total_nominal: {
            type: "number",
            example: 6000000,
          },
        }),
      },
    }),
  },

  "/transport/history": {
    get: operation({
      summary: "Daftar penerima pada satu bulan",
      description: `${readScope} Hanya menampilkan nominal > 0. ` + "Mendukung pencarian nama/NIP, sorting, dan pagination.",
      parameters: [
        ...periodParameters,

        query("page", {
          ...integer(1, 1_000_000, 1),
          default: 1,
        }),

        query("limit", {
          ...integer(1, 100, 10),
          default: 10,
        }),

        query("search", {
          type: "string",
          maxLength: 100,
          default: "",
        }),

        query("sortBy", {
          type: "string",
          enum: ["nama", "km", "hari", "nominal"],
          default: "nama",
        }),

        query("sortOrder", {
          type: "string",
          enum: ["asc", "desc"],
          default: "asc",
        }),
      ],
      paginated: true,
      data: {
        type: "array",
        items: detail,
      },
    }),
  },

  "/transport/me": {
    get: operation({
      summary: "Tunjangan milik akun login",
      description:
        "Admin HRD dan Manager HRD. Selalu milik sendiri, termasuk untuk Admin. " +
        "Respons data null berarti belum ada snapshot perhitungan. " +
        "Nominal nol berarti ada hasil perhitungan tetapi tidak menerima tunjangan.",
      parameters: periodParameters,
      data: {
        ...detail,
        nullable: true,
      },
    }),
  },
};

const authUser = object({
  id,
  id_role: id,
  username: { type: "string" },
  nama: { type: "string" },
  email: {
    type: "string",
    format: "email",
    nullable: true,
  },
  nama_role: { type: "string" },
});

const sessionData = object({
  user: authUser,
  rememberMe: { type: "boolean" },
  lastActivityAt: {
    type: "number",
    description: "Timestamp Unix dalam milidetik.",
  },
  idleTimeoutMs: {
    type: "integer",
    example: 180000,
  },
});

export const authPaths = {
  "/auth/captcha": {
    get: operation({
      tag: "Authentication",
      summary: "Ambil gambar CAPTCHA",
      description: "Public. CAPTCHA enam digit berlaku 120 detik dan satu kali percobaan.",
      public: true,
      data: object({
        id: {
          type: "string",
          format: "uuid",
        },
        image: {
          type: "string",
          description: "Data URL gambar PNG.",
          example: "data:image/png;base64,...",
        },
        expiresInSeconds: {
          type: "integer",
          example: 120,
        },
      }),
    }),
  },

  "/auth/login": {
    post: operation({
      tag: "Authentication",
      summary: "Login dengan kredensial dan CAPTCHA",
      description:
        "Public. Isi CAPTCHA dari /auth/captcha. " +
        "Setiap percobaan login yang mencapai verifikasi CAPTCHA menghabiskan kode. " +
        "Respons menerbitkan cookie HttpOnly jmc_token; JWT tidak dikembalikan di body.",
      public: true,
      body: input(
        {
          identifier: {
            type: "string",
            minLength: 1,
            maxLength: 255,
            description: "Username, email, atau nomor HP internasional.",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 1,
            maxLength: 256,
          },
          rememberMe: {
            type: "boolean",
            default: false,
          },
          captchaId: {
            type: "string",
            format: "uuid",
          },
          captchaAnswer: {
            type: "string",
            pattern: "^[0-9]{6}$",
            description: "Enam digit, termasuk nol di awal jika ada.",
          },
        },
        ["identifier", "password", "captchaId", "captchaAnswer"],
      ),
      data: sessionData,
    }),
  },

  "/auth/me": {
    get: operation({
      tag: "Authentication",
      summary: "Periksa sesi login",
      description: "Mengembalikan identitas dan pengaturan sesi. " + "Tidak memperbarui waktu aktivitas pengguna.",
      data: sessionData,
    }),
  },

  "/auth/csrf": {
    get: operation({
      tag: "Authentication",
      summary: "Ambil token CSRF sesi",
      description: "Memerlukan login. Kirim token pada header X-CSRF-Token untuk mutasi.",
      data: object({
        csrfToken: { type: "string" },
      }),
    }),
  },

  "/auth/activity": {
    post: operation({
      tag: "Authentication",
      summary: "Laporkan aktivitas pengguna",
      description: "Memperbarui waktu aktivitas sesi yang masih valid. " + "Tidak dapat menghidupkan kembali sesi yang telah idle 3 menit.",
      mutation: true,
      data: object({
        lastActivityAt: { type: "number" },
      }),
    }),
  },

  "/auth/logout": {
    post: {
      ...operation({
        tag: "Authentication",
        summary: "Logout",
        description: "Mencabut sesi login dan menghapus cookie.",
        mutation: true,
        data: {},
      }),
      responses: {
        ...errorResponses,
        "200": jsonResponse(
          "Logout berhasil.",
          object({
            success: { type: "boolean", enum: [true] },
            message: { type: "string" },
          }),
        ),
      },
    },
  },
};
