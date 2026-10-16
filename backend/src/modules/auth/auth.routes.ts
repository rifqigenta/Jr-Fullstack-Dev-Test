import { Router } from "express";
import rateLimit from "express-rate-limit";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { login, logout, me } from "./auth.controller.js";

import { getCsrfToken, requireCsrf } from "../../middlewares/csrf.middleware.js";

const router = Router();

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

router.post("/login", loginLimiter, login);

router.get("/me", requireAuth, me);

router.post("/logout", requireAuth, requireCsrf, logout);

router.get("/csrf", requireAuth, getCsrfToken);

export default router;
