import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.routes.js";

import authRoutes from "./modules/auth/auth.routes.js";
import { requireTrustedOrigin, validateRequestOrigin } from "./middlewares/origin.middleware.js";
import rbacTestRoutes from "./routes/rbac-test.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import employeesRoutes from "./modules/employees/employees.routes.js";
import masterDataRoutes from "./modules/master-data/master-data.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import profileRoutes from "./modules/profile/profile.routes.js";
import rolesRoutes from "./modules/roles/roles.routes.js";
import activitiesRoutes from "./modules/activities/activities.routes.js";
import transportRoutes from "./modules/transport/transport.routes.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import { requireCsrf } from "./middlewares/csrf.middleware.js";
import swaggerRoutes from "./docs/swagger.routes.js";

import type { ErrorRequestHandler } from "express";

const app = express();

const allowedOrigins = [process.env.FRONTEND_URL].filter((value): value is string => Boolean(value));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 ? "Terjadi kesalahan pada server." : err.message,
  });
};

app.use(errorHandler);

// Security headers
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error("Origin tidak diizinkan.") as Error & {
        status: number;
        statusCode: number;
      };

      error.status = 403;
      error.statusCode = 403;

      callback(error);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

const corsErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof Error && err.message === "Origin tidak diizinkan.") {
    res.status(403).json({
      success: false,
      message: "Origin tidak diizinkan.",
    });
    return;
  }

  next(err);
};

app.use(corsErrorHandler);

// Request body parsing
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Basic API rate limit
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

// API routes
app.use("/api/health", healthRouter);

// app.use("/api", requireTrustedOrigin);
app.use("/api", validateRequestOrigin);

app.use("/api/auth", authRoutes);

app.use("/api/test/rbac", rbacTestRoutes);

app.use("/api/users", requireAuth, requireCsrf, usersRoutes);

app.use("/api/employees", requireAuth, requireCsrf, employeesRoutes);

app.use("/api/master-data", masterDataRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/profile", requireAuth, requireCsrf, profileRoutes);

app.use("/api/roles", rolesRoutes);

app.use("/api/activities", activitiesRoutes);

app.use("/api/transport", requireAuth, requireCsrf, transportRoutes);

app.use("/api/docs", swaggerRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
// app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
//   console.error(err);

//   res.status(500).json({
//     success: false,
//     message: "Internal server error",
//   });
// });
app.use(errorHandler);

export default app;
