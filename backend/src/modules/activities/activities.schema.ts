import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid.");

export const activityQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(100).default(""),

    title: z.string().trim().max(100).optional(),

    created_by: z.coerce.number().int().positive().optional(),

    start_date: dateSchema.optional(),

    end_date: dateSchema.optional(),
  })
  .strict()
  .refine((data) => !data.start_date || !data.end_date || data.start_date <= data.end_date, {
    path: ["end_date"],
    message: "Tanggal akhir tidak boleh sebelum tanggal awal.",
  });

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
