export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-01",

  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      appName: process.env.APP_NAME,
      appClient: process.env.APP_CLIENT,
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
  },

  css: ["@tabler/core/dist/css/tabler.min.css", "~/assets/css/backend.css"],

  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      link: [
        {
          rel: "icon",
          type: "image/x-icon",
          href: "/favicon.png",
        },
      ],
      script: [
        {
          src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
          async: true,
          defer: true,
        },
      ],
    },
  },

  routeRules: {
    "/api/**": {
      proxy: `${process.env.API_BASE_URL || "http://localhost:3001"}/api/**`,
    },
  },

  plugins: ["~/plugins/jquery.client.js", "~/plugins/tabler.client.js", "~/plugins/apexcharts.client.js"],

  vite: {
    optimizeDeps: {
      include: ["apexcharts"],
    },
  },
});
