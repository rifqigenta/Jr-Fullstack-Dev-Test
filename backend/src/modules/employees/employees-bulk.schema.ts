import { z } from "zod";

const employeeIdsSchema = z
  .array(z.number().int().positive())
  .min(1, "Pilih minimal satu pegawai.")
  .max(100, "Maksimal 100 pegawai per request.")
  .refine((ids) => new Set(ids).size === ids.length, "ID pegawai tidak boleh duplikat.");

export const bulkStatusSchema = z
  .object({
    ids: employeeIdsSchema,
    status: z.enum(["Aktif", "Nonaktif"]),
  })
  .strict();

export const bulkDeleteSchema = z
  .object({
    ids: employeeIdsSchema,
  })
  .strict();

export const employeeExportQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(""),

    status: z.enum(["Aktif", "Nonaktif"]).optional(),

    status_kontrak: z.enum(["PKWTT", "PKWT", "Magang"]).optional(),

    id_jabatan: z.coerce.number().int().positive().optional(),

    id_departemen: z.coerce.number().int().positive().optional(),

    sortBy: z.enum(["id", "nama_pegawai", "tanggal_masuk"]).default("id"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

export type EmployeeExportQuery = z.infer<typeof employeeExportQuerySchema>;
