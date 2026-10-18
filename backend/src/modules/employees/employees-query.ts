import { z } from "zod";

const positiveId = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const positionIdsSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;

    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim());
    }

    return value;
  },
  z
    .array(positiveId)
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Jabatan tidak boleh duplikat.")
    .optional(),
);

const filterFields = {
  search: z.string().trim().max(100).default(""),

  status: z.enum(["Aktif", "Nonaktif"]).optional(),

  status_kontrak: z.enum(["PKWTT", "PKWT", "Magang"]).optional(),

  id_jabatan: positiveId.optional(),

  id_jabatan_in: positionIdsSchema,

  id_departemen: positiveId.optional(),

  masa_kerja_min: z.coerce.number().int().min(0).max(200).optional(),

  masa_kerja_max: z.coerce.number().int().min(0).max(200).optional(),

  sortBy: z.enum(["id", "nip", "nama_pegawai", "nama_jabatan", "tanggal_masuk", "masa_kerja"]).default("id"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

function validateFilters(
  data: {
    id_jabatan?: number | undefined;
    id_jabatan_in?: number[] | undefined;
    masa_kerja_min?: number | undefined;
    masa_kerja_max?: number | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (data.id_jabatan !== undefined && data.id_jabatan_in !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["id_jabatan_in"],
      message: "Gunakan salah satu filter jabatan.",
    });
  }

  if (data.masa_kerja_min !== undefined && data.masa_kerja_max !== undefined && data.masa_kerja_min > data.masa_kerja_max) {
    ctx.addIssue({
      code: "custom",
      path: ["masa_kerja_max"],
      message: "Masa kerja maksimum harus minimal sebesar minimum.",
    });
  }
}

export const employeeListQuerySchema = z
  .object({
    ...filterFields,

    page: z.coerce.number().int().min(1).max(1_000_000).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict()
  .superRefine(validateFilters);

export const employeeExportQuerySchema = z.object(filterFields).strict().superRefine(validateFilters);

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

export type EmployeeExportQuery = z.infer<typeof employeeExportQuerySchema>;

export function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function buildEmployeeQuery(query: EmployeeExportQuery) {
  const today = jakartaToday();

  const tenureSql = `GREATEST(0, TIMESTAMPDIFF(YEAR, p.tanggal_masuk, '${today}'))`;

  const conditions = ["p.deleted_at IS NULL"];
  const params: Array<string | number> = [];

  if (query.search) {
    const escaped = query.search.replace(/[=%_]/g, (character) => `=${character}`);

    const keyword = `%${escaped}%`;

    conditions.push(`
      (
        p.nama_pegawai LIKE ? ESCAPE '='
        OR p.nip LIKE ? ESCAPE '='
        OR j.nama LIKE ? ESCAPE '='
      )
    `);

    params.push(keyword, keyword, keyword);
  }

  if (query.status !== undefined) {
    conditions.push("p.status = ?");
    params.push(query.status);
  }

  if (query.status_kontrak !== undefined) {
    conditions.push("p.status_kontrak = ?");
    params.push(query.status_kontrak);
  }

  if (query.id_jabatan !== undefined) {
    conditions.push("p.id_jabatan = ?");
    params.push(query.id_jabatan);
  }

  if (query.id_jabatan_in?.length) {
    const placeholders = query.id_jabatan_in.map(() => "?").join(", ");

    conditions.push(`p.id_jabatan IN (${placeholders})`);
    params.push(...query.id_jabatan_in);
  }

  if (query.id_departemen !== undefined) {
    conditions.push("p.id_departemen = ?");
    params.push(query.id_departemen);
  }

  if (query.masa_kerja_min !== undefined) {
    conditions.push(`${tenureSql} >= ?`);
    params.push(query.masa_kerja_min);
  }

  if (query.masa_kerja_max !== undefined) {
    conditions.push(`${tenureSql} <= ?`);
    params.push(query.masa_kerja_max);
  }

  const sortColumns = {
    id: "p.id",
    nip: "p.nip",
    nama_pegawai: "p.nama_pegawai",
    nama_jabatan: "j.nama",
    tanggal_masuk: "p.tanggal_masuk",
    masa_kerja: `GREATEST(0, DATEDIFF('${today}', p.tanggal_masuk))`,
  } as const;

  const sortColumn = sortColumns[query.sortBy];
  const direction = query.sortOrder === "asc" ? "ASC" : "DESC";

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    orderSql: `${sortColumn} ${direction}, p.id DESC`,
    tenureSql,
    params,
  };
}
