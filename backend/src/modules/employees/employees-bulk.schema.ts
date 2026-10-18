import { z } from "zod";

export { employeeExportQuerySchema } from "./employees-query.js";

export type { EmployeeExportQuery } from "./employees-query.js";

const employeeIdsSchema = z
  .array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
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

export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
