import { z } from "zod";

export const userIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const usernameSchema = z
  .string()
  .min(6, "Username minimal 6 karakter.")
  .max(50, "Username maksimal 50 karakter.")
  .regex(/^[a-z0-9]+$/, "Username hanya boleh huruf kecil dan angka, tanpa spasi.");

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(72, "Password maksimal 72 karakter.")
  .regex(/^\S+$/, "Password tidak boleh mengandung spasi.")
  .regex(/[A-Z]/, "Password harus memiliki huruf besar.")
  .regex(/[a-z]/, "Password harus memiliki huruf kecil.")
  .regex(/[^A-Za-z0-9\s]/, "Password harus memiliki karakter khusus.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password maksimal 72 byte.");

export const userListSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(100).default(""),

    sortBy: z.enum(["id", "nama", "username", "status"]).default("id"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const employeeOptionsSchema = z
  .object({
    search: z.string().trim().max(100).default(""),

    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export const createUserSchema = z
  .object({
    id_pegawai: userIdSchema,
    id_role: userIdSchema,
    id_jabatan: userIdSchema,
    id_departemen: userIdSchema,
    username: usernameSchema,
    password: passwordSchema,
    disabled: z.boolean().default(false),
  })
  .strict();

export const updateUserSchema = z
  .object({
    id_pegawai: userIdSchema.optional(),
    id_role: userIdSchema.optional(),
    id_jabatan: userIdSchema.optional(),
    id_departemen: userIdSchema.optional(),
    username: usernameSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi.");

export const userStatusSchema = z
  .object({
    disabled: z.boolean(),
  })
  .strict();

export const usernameQuerySchema = z
  .object({
    username: usernameSchema,
    excludeId: userIdSchema.optional(),
  })
  .strict();

export type UserListQuery = z.infer<typeof userListSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
