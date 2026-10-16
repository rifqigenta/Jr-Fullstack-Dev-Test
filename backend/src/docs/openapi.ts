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
- Login membutuhkan Cloudflare Turnstile CAPTCHA.
- Authentication menggunakan JWT dan session database.
- Cookie bersifat HttpOnly.
- Idle timeout 3 menit jika Remember Me tidak aktif.

### CSRF
Untuk request POST, PUT, PATCH, dan DELETE yang membutuhkan
cookie session, ambil token dari GET /api/auth/csrf lalu kirim
melalui header X-CSRF-Token.

### RBAC
Role:
- Superadmin
- Manager HRD
- Admin HRD

Permission divalidasi pada backend.
Akses Own dibatasi berdasarkan akun yang sedang login.
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
