import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import { pool } from "../../config/database.js";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { AuthError, COOKIE_NAME, IDLE_TIMEOUT_MS, TOKEN_TTL, cookieOptions, loginUser, logoutUser } from "./auth.service.js";

import { createCaptcha, verifyCaptcha } from "./captcha.service.js";

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255),
    password: z.string().min(1).max(256),
    rememberMe: z.boolean().default(false),
    captchaId: z.uuid(),
    captchaAnswer: z.string().regex(/^\d{6}$/),
  })
  .strict();

export async function captcha(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const challenge = await createCaptcha();

    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Lengkapi kredensial dan 6 digit kode CAPTCHA.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const { identifier, password, rememberMe, captchaId, captchaAnswer } = parsed.data;

    const valid = await verifyCaptcha(captchaId, captchaAnswer);

    if (!valid) {
      res.status(400).json({
        success: false,
        message: "CAPTCHA salah, sudah dipakai, atau kedaluwarsa.",
      });
      return;
    }

    const result = await loginUser(identifier, password, rememberMe);

    res.cookie(COOKIE_NAME, result.token, {
      ...cookieOptions,
      ...(rememberMe ? { maxAge: TOKEN_TTL.remembered } : {}),
    });

    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      message: "Login berhasil.",
      data: {
        user: result.user,
        rememberMe,
        lastActivityAt: Date.now(),
        idleTimeoutMs: IDLE_TIMEOUT_MS,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    data: {
      user: req.auth!.user,
      rememberMe: req.auth!.rememberMe,
      lastActivityAt: req.auth!.lastActivityAt,
      idleTimeoutMs: IDLE_TIMEOUT_MS,
    },
  });
}

export async function activity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth!;

    const result = await pool.query(
      `
        UPDATE auth_sessions
        SET last_activity_at = UTC_TIMESTAMP(3)
        WHERE id = ?
          AND id_user = ?
          AND revoked_at IS NULL
          AND (
            remember_me = 1
            OR last_activity_at > DATE_SUB(
              UTC_TIMESTAMP(3),
              INTERVAL ? MICROSECOND
            )
          )
      `,
      [auth.sessionId, auth.user.id, IDLE_TIMEOUT_MS * 1000],
    );

    if (Number(result.affectedRows) === 0) {
      res.status(401).json({
        success: false,
        message: "Sesi sudah berakhir. Silakan login kembali.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        lastActivityAt: Date.now(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await logoutUser(req.auth!.sessionId, req.auth!.user.id);

    res.clearCookie(COOKIE_NAME, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logout berhasil.",
    });
  } catch (error) {
    next(error);
  }
}
