import crypto from "node:crypto";

import type { Response, NextFunction } from "express";

import type { AuthRequest } from "./auth.middleware.js";

import { env } from "../config/env.js";

const CSRF_HEADER = "x-csrf-token";

function getSessionId(req: AuthRequest): string | null {
  // Gunakan sid dari JWT yang sudah diverifikasi oleh requireAuth.
  // Properti ini perlu ditambahkan ke req.auth pada auth.middleware.ts.
  return req.auth?.sessionId ?? null;
}

function createSignature(sessionId: string): string {
  return crypto.createHmac("sha256", env.CSRF_SECRET).update(`csrf:${sessionId}`).digest("hex");
}

export function generateCsrfToken(sessionId: string): string {
  return createSignature(sessionId);
}

export function getCsrfToken(req: AuthRequest, res: Response): void {
  const sessionId = getSessionId(req);

  if (!sessionId) {
    res.status(401).json({
      success: false,
      message: "Session tidak valid.",
    });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    data: {
      csrfToken: generateCsrfToken(sessionId),
    },
  });
}

export function requireCsrf(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const sessionId = getSessionId(req);
  const provided = req.get(CSRF_HEADER);

  if (!sessionId || !provided) {
    res.status(403).json({
      success: false,
      message: "CSRF token diperlukan.",
    });
    return;
  }

  const expected = generateCsrfToken(sessionId);

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    res.status(403).json({
      success: false,
      message: "CSRF token tidak valid.",
    });
    return;
  }

  next();
}
