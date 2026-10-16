import { z } from "zod";

const dateSchema = z.iso.date();

const settingFields = z.object({
  base_fare: z.coerce.number().positive().max(1_000_000),
  berlaku_mulai: dateSchema,
  minimum_km: z.coerce.number().int().min(0).max(25).default(5),
  maximum_km: z.coerce.number().int().min(1).max(127).default(25),
});

function validDistanceRange(data: { minimum_km: number; maximum_km: number }) {
  return data.minimum_km < data.maximum_km;
}

export const createSettingSchema = settingFields.strict().refine(validDistanceRange, {
  message: "Minimum km harus lebih kecil dari maksimum km.",
  path: ["maximum_km"],
});

export const updateSettingSchema = settingFields
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi.",
  });

export const attendanceSchema = z
  .object({
    id_pegawai: z.number().int().positive(),
    tahun: z.number().int().min(2000).max(2100),
    bulan: z.number().int().min(1).max(12),
    jumlah_hari_masuk: z.number().int().min(0).max(31),
  })
  .strict();

export const calculateSchema = z
  .object({
    tahun: z.number().int().min(2000).max(2100),
    bulan: z.number().int().min(1).max(12),
  })
  .strict();

export const monthQuerySchema = z
  .object({
    tahun: z.coerce.number().int().min(2000).max(2100),
    bulan: z.coerce.number().int().min(1).max(12),
  })
  .strict();

export const historyQuerySchema = monthQuerySchema
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).default(""),
  })
  .strict();

export type CreateSettingInput = z.infer<typeof createSettingSchema>;
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type CalculateInput = z.infer<typeof calculateSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
