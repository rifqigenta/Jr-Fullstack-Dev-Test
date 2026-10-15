import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.routes.js";

export const app = express();

// Security headers
app.use(helmet());

// Allow Nuxt frontend
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// Request body parsing
app.use(express.json({ limit: "1mb" }));
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});
