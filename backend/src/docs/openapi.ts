import { schemas } from "./schemas.js";
import { buildPaths } from "./paths.js";

export const openApiDocument = {
  openapi: "3.0.3",

  info: {
    title: "JMC Kepegawaian API",
    version: "1.0.0",
    description: `
Backend API untuk JMC Junior Fullstack JavaScript Technical Test.

### Authentication
- Login menggunakan username, email, atau nomor HP.
- Ambil CAPTCHA dari GET /auth/captcha.
- Ketik enam digit pada gambar, lalu kirim captchaId dan captchaAnswer.
- CAPTCHA berlaku dua menit dan satu kali percobaan.
- Login menerbitkan JWT melalui cookie HttpOnly jmc_token.
- Tanpa Remember me, sesi berakhir setelah tidak aktif tiga menit.
- Remember me melewati idle timeout; cookie persisten tetap mengikuti batas browser.
- Sesi akun nonaktif, akun dihapus, atau sesi dicabut tidak dapat digunakan.

### Mencoba API melalui Swagger
1. Jalankan GET /auth/captcha.
2. Buka data URL pada field image untuk melihat gambar.
3. Jalankan POST /auth/login dengan kredensial dan CAPTCHA.
4. Jalankan GET /auth/csrf.
5. Salin data.csrfToken ke header X-CSRF-Token pada operasi perubahan data.

Cookie login dikirim otomatis ketika Swagger dan API memakai origin yang sama.
Cookie HttpOnly tidak diisi secara manual melalui tombol Authorize.
Bearer JWT didukung untuk token yang diperoleh melalui mekanisme terpisah;
endpoint login saat ini tidak mengembalikan JWT pada body.

### CSRF
POST, PUT, PATCH, dan DELETE yang terlindungi memerlukan X-CSRF-Token.
Implementasi backend saat ini juga memeriksa CSRF pada mutasi dengan Bearer JWT.
Login adalah pengecualian dan tetap memeriksa origin serta CAPTCHA.

### Hak akses tunjangan
- Admin HRD: mengelola tarif, mengisi kehadiran, menghitung tunjangan,
  serta melihat seluruh penerima.
- Manager HRD: membaca tunjangan miliknya sendiri.
- GET /transport/me selalu menampilkan tunjangan sendiri.
- Akses operasional Admin terhadap seluruh penerima merupakan asumsi
  implementasi untuk menjembatani matriks RO dan deskripsi daftar penerima.

### Aturan perhitungan
Hanya PKWTT, minimal 19 hari masuk, jarak asli lebih dari 5 km.
Jarak dibulatkan half-up dan dihitung maksimal 25 km.
Nominal = tarif per km × km dihitung × hari masuk.
Tarif terakhir yang berlaku sampai akhir bulan dipakai untuk bulan tersebut.
Hitung ulang mengganti snapshot periode secara transaksional.
Data pegawai saat ini digunakan; riwayat perubahan pegawai belum tersedia.
`,
  },

  servers: [
    {
      url: "/api",
      description: "Current API server",
    },
  ],

  tags: [
    { name: "Health" },
    { name: "Authentication" },
    { name: "Users" },
    { name: "Employees" },
    { name: "Master Data" },
    { name: "Dashboard" },
    { name: "Profile" },
    { name: "Roles" },
    { name: "Activities" },
    { name: "Transport" },
  ],

  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "jmc_token",
        description: "HttpOnly session cookie yang diterbitkan saat login.",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },

    schemas,
  },

  paths: buildPaths(),
} as const;
