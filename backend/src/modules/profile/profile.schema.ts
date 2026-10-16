import { z } from "zod";

export const updateProfileSchema = z
  .object({
    nama: z.string().trim().min(2).max(150).optional(),
    email: z.email().max(255).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Minimal satu field harus diisi.");

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
