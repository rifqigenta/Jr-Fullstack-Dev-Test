import { Router } from "express";
import rateLimit from "express-rate-limit";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { getCsrfToken, requireCsrf } from "../../middlewares/csrf.middleware.js";

import { captcha, login, logout, me, activity } from "./auth.controller.js";

const router = Router();

const captchaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu sering meminta CAPTCHA. Coba sebentar lagi.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan login. Coba lagi nanti.",
  },
});

router.get("/captcha", captchaLimiter, captcha);

router.post("/login", loginLimiter, login);

router.get("/me", requireAuth, me);

router.get("/csrf", requireAuth, getCsrfToken);

router.post("/activity", requireAuth, requireCsrf, activity);

router.post("/logout", requireAuth, requireCsrf, logout);

export default router;
