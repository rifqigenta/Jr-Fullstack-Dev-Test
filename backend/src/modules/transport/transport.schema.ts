import { z } from "zod";

const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const year = z.number().int().min(2000).max(2100);
const month = z.number().int().min(1).max(12);

const settingFields = z.object({
  base_fare: z.coerce
    .number()
    .positive()
    .max(1_000_000)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Tarif maksimal dua angka desimal."),

  berlaku_mulai: z.iso.date(),

  minimum_km: z.coerce.number().pipe(z.literal(5)),
  maximum_km: z.coerce.number().pipe(z.literal(25)),
});

export const createSettingSchema = settingFields.strict();

export const updateSettingSchema = settingFields
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi.");

export const attendanceSchema = z
  .object({
    id_pegawai: idSchema,
    tahun: year,
    bulan: month,
    jumlah_hari_masuk: z.number().int().min(0).max(31),
  })
  .strict()
  .superRefine((value, ctx) => {
    const maximum = new Date(Date.UTC(value.tahun, value.bulan, 0)).getUTCDate();

    if (value.jumlah_hari_masuk > maximum) {
      ctx.addIssue({
        code: "custom",
        path: ["jumlah_hari_masuk"],
        message: `Jumlah hari masuk maksimal ${maximum} pada bulan ini.`,
      });
    }
  });

export const calculateSchema = z.object({ tahun: year, bulan: month }).strict();

export const yearQuerySchema = z
  .object({
    tahun: z.coerce.number().int().min(2000).max(2100),
  })
  .strict();

export const monthQuerySchema = yearQuerySchema
  .extend({
    bulan: z.coerce.number().int().min(1).max(12),
  })
  .strict();

export const historyQuerySchema = monthQuerySchema
  .extend({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(100).default(""),

    sortBy: z.enum(["nama", "km", "hari", "nominal"]).default("nama"),

    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

export type CreateSettingInput = z.infer<typeof createSettingSchema>;
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type CalculateInput = z.infer<typeof calculateSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
