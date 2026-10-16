import { z } from "zod";

export const updateProfileSchema = z
  .object({
    nama: z.string().trim().min(2).max(150).optional(),
    email: z.email().max(255).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Minimal satu field harus diisi.");

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Minimal 8 karakter.")
      .max(128, "Maksimal 128 karakter.")
      .regex(/^\S+$/, "Password tidak boleh mengandung spasi.")
      .regex(/[A-Z]/, "Harus ada huruf besar.")
      .regex(/[a-z]/, "Harus ada huruf kecil.")
      .regex(/[0-9]/, "Harus ada angka.")
      .regex(/[^A-Za-z0-9\s]/, "Harus ada karakter khusus."),
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "Password baru harus berbeda dari password lama.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
