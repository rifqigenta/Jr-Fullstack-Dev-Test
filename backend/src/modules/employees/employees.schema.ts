import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(Date.UTC(year!, month! - 1, day!));

    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
  }, "Tanggal tidak valid.");

const educationSchema = z
  .object({
    tingkat_pendidikan: z.string().trim().min(1).max(50),
    nama_sekolah: z.string().trim().min(2).max(255),
    tahun_lulus: z.number().int().min(1900).max(2100),
  })
  .strict();

export const employeeFieldsSchema = z
  .object({
    nip: z.string().regex(/^\d{8,}$/, "NIP minimal 8 digit angka."),

    nama_pegawai: z.string().trim().min(2).max(150),

    email: z.email().max(255),

    nomor_hp: z.string().regex(/^\+[1-9]\d{7,14}$/, "Nomor HP harus menggunakan format internasional."),

    tempat_lahir: z.string().trim().min(2).max(100),

    tanggal_lahir: dateSchema,

    jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]).nullable().default(null),

    id_kecamatan: z.number().int().positive(),

    alamat_lengkap: z.string().trim().min(5),

    jarak_rumah_kantor: z.number().int().min(0).max(127),

    status_kawin: z.enum(["kawin", "tidak kawin"]),

    jumlah_anak: z.number().int().min(0).max(30),

    tanggal_masuk: dateSchema,

    id_jabatan: z.number().int().positive(),

    id_departemen: z.number().int().positive(),

    status: z.enum(["Aktif", "Nonaktif"]).default("Aktif"),

    status_kontrak: z.enum(["PKWTT", "PKWT", "Magang"]),

    pendidikan: z.array(educationSchema).max(20).default([]),
  })
  .strict();

function validateEmployeeDates(data: z.infer<typeof employeeFieldsSchema>, ctx: z.RefinementCtx) {
  const birthDate = new Date(`${data.tanggal_lahir}T00:00:00Z`);
  const joinDate = new Date(`${data.tanggal_masuk}T00:00:00Z`);

  if (birthDate > new Date()) {
    ctx.addIssue({
      code: "custom",
      path: ["tanggal_lahir"],
      message: "Tanggal lahir tidak boleh di masa depan.",
    });
  }

  if (joinDate < birthDate) {
    ctx.addIssue({
      code: "custom",
      path: ["tanggal_masuk"],
      message: "Tanggal masuk tidak boleh sebelum tanggal lahir.",
    });
  }

  const joinYear = joinDate.getUTCFullYear();

  for (const [index, education] of data.pendidikan.entries()) {
    if (education.tahun_lulus > joinYear + 1) {
      ctx.addIssue({
        code: "custom",
        path: ["pendidikan", index, "tahun_lulus"],
        message: "Tahun lulus tidak valid terhadap tanggal masuk.",
      });
    }
  }
}

export const createEmployeeSchema = employeeFieldsSchema.superRefine(validateEmployeeDates);

export const updateEmployeeSchema = employeeFieldsSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Minimal satu field harus diisi.");

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
