import type { Request, Response, NextFunction } from "express";

import { env } from "../config/env.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");

  if (origin && origin !== env.FRONTEND_URL) {
    res.status(403).json({
      success: false,
      message: "Origin tidak diizinkan.",
    });
    return;
  }

  next();
}

export function validateRequestOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!unsafeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  const allowedOrigin = process.env.FRONTEND_URL;

  if (origin && origin !== allowedOrigin) {
    res.status(403).json({
      success: false,
      message: "Origin request tidak diizinkan.",
    });
    return;
  }

  next();
}
