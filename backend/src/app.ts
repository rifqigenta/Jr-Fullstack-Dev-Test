import express, { type ErrorRequestHandler } from "express";

import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";

import { requireAuth } from "./middlewares/auth.middleware.js";

import { requireCsrf } from "./middlewares/csrf.middleware.js";

import { recordReadActivity } from "./middlewares/activity-read.middleware.js";

import { healthRouter } from "./routes/health.routes.js";
import rbacTestRoutes from "./routes/rbac-test.routes.js";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import employeesRoutes from "./modules/employees/employees.routes.js";
import masterDataRoutes from "./modules/master-data/master-data.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import profileRoutes from "./modules/profile/profile.routes.js";
import rolesRoutes from "./modules/roles/roles.routes.js";
import activitiesRoutes from "./modules/activities/activities.routes.js";
import transportRoutes from "./modules/transport/transport.routes.js";
import swaggerRoutes from "./docs/swagger.routes.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === env.FRONTEND_URL) {
        callback(null, true);
        return;
      }

      const error = new Error("Origin tidak diizinkan.") as Error & { status: number };

      error.status = 403;
      callback(error);
    },

    credentials: true,

    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],

    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb",
  }),
);

app.use(cookieParser());

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Terlalu banyak request. Coba lagi nanti.",
    },
  }),
);

app.use("/api", (req, res, next) => {
  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  const origin = req.get("origin");

  if (unsafe && origin && origin !== env.FRONTEND_URL) {
    res.status(403).json({
      success: false,
      message: "Origin request tidak diizinkan.",
    });
    return;
  }

  next();
});

app.use(recordReadActivity);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRoutes);

if (env.NODE_ENV !== "production") {
  app.use("/api/test/rbac", rbacTestRoutes);
}

app.use("/api/users", requireAuth, requireCsrf, usersRoutes);

app.use("/api/employees", requireAuth, requireCsrf, employeesRoutes);

app.use("/api/master-data", masterDataRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use("/api/profile", requireAuth, requireCsrf, profileRoutes);

app.use("/api/roles", rolesRoutes);
app.use("/api/activities", activitiesRoutes);

app.use("/api/transport", requireAuth, requireCsrf, transportRoutes);

app.use("/api/docs", swaggerRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan.",
  });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const candidate = Number(error?.status ?? error?.statusCode);

  const status = Number.isInteger(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 ? "Terjadi kesalahan pada server." : error?.message || "Request tidak valid.",
  });
};

app.use(errorHandler);

export default app;
