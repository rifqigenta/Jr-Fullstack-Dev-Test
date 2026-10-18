import { date, z } from "zod";

const dateSchema = z.iso.date({
  error: "Tanggal tidak valid. Gunakan format YYYY-MM-DD.",
});

const educationSchema = z
  .object({
    tingkat_pendidikan: z.string().trim().min(1, "Tingkat peendidikan wajib diisi.").max(50, "Tingkat pendidikan maksimal 50 karakter."),
    nama_sekolah: z.string().trim().min(2, "Nama sekolah wajib diisi.").max(255, "Nama sekolah maksimal 255 karakter"),
    tahun_lulus: z.number().int("Tahun lulus harus berupa bilangan bulat").min(1900, "Tahun lulus minimal 1900").max(2100, "Tahun lulus maksimal 2100"),
  })
  .strict();

export const employeeFieldsSchema = z
  .object({
    nip: z.string().regex(/^\d{8,}$/, "NIP minimal 8 digit, hanya boleh angka dan tanpa spasi."),

    nama_pegawai: z.string().trim().min(1, "Nama pegawai wajib diisi.").max(150, "Nama pegawai maksimal 150 karakter."),

    email: z.email("Format email tidak valid.").max(255, "Email maksimal 255 karakter"),

    nomor_hp: z.string().regex(/^\+[1-9]\d{7,14}$/, "Nomor HP harus menggunakan format internasional, contoh +628xxx."),

    tempat_lahir: z.string().trim().min(2, "Tempat lahir wajib diisi.").max(100, "Tempat lahir maksimal 100 karakter."),

    tanggal_lahir: dateSchema,

    jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]).nullable().default(null),

    id_kecamatan: z.number().int("Kecamatan tidak valid.").positive("Kecamatan wajib dipilih."),

    alamat_lengkap: z.string().trim().min(5, "Alamat lengkap wajib diisi."),

    jarak_rumah_kantor: z.number().int().min(0, "Jarak tidak boleh negatif.").max(127, "Jarak maksimal 99,99 km."),

    status_kawin: z.enum(["kawin", "tidak kawin"]),

    jumlah_anak: z.number().int("Jumlah anak harus berupa bilangan bulat.").min(0, "Jumlah anak tidak boleh negatif.").max(30, "Jumlah anak maksimal 2 digit."),

    tanggal_masuk: dateSchema,

    id_jabatan: z.number().int("Jabatan tidak valid.").positive("Jabatan wajib dipilih."),

    id_departemen: z.number().int("Department tidak valid.").positive("Department wajib dipilih."),

    status: z.enum(["Aktif", "Nonaktif"]).default("Aktif"),

    status_kontrak: z.enum(["PKWTT", "PKWT", "Magang"]),

    pendidikan: z.array(educationSchema).max(20, "Minimal satu riwayat pendidikan wajib diisi.").max(20, "Maksimal 20 riwayat pendidikan."),
  })
  .strict();

function validateEmployeeDates(data: z.infer<typeof employeeFieldsSchema>, ctx: z.RefinementCtx) {
  const birthDate = new Date(`${data.tanggal_lahir}T00:00:00Z`);
  const joinDate = new Date(`${data.tanggal_masuk}T00:00:00Z`);

  if (!Number.isFinite(birthDate.getTime()) || !Number.isFinite(joinDate.getTime())) {
    return;
  }

  const today = new Date();
  const jakartaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => jakartaDate.find((part) => part.type === type)?.value;

  const todayString = [getPart("year"), getPart("month"), getPart("day")].join("-");

  if (data.tanggal_lahir > todayString) {
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

  const birthYear = birthDate.getUTCFullYear();

  for (const [index, education] of data.pendidikan.entries()) {
    if (education.tahun_lulus < birthYear) {
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
