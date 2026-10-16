import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { AuthError, COOKIE_NAME, TOKEN_TTL, loginUser, logoutUser } from "./auth.service.js";

import { verifyCaptcha } from "./captcha.service.js";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
  captchaToken: z.string().min(1).max(2048),
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Input login tidak valid.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const { identifier, password, rememberMe } = parsed.data;

    const captchaValid = await verifyCaptcha(parsed.data.captchaToken, req.ip);

    if (!captchaValid) {
      res.status(400).json({
        success: false,
        message: "Verifikasi CAPTCHA gagal. Silakan coba lagi.",
      });
      return;
    }

    const result = await loginUser(identifier, password, rememberMe);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie(COOKIE_NAME, result.token, {
      ...cookieOptions,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: rememberMe ? TOKEN_TTL.remembered : TOKEN_TTL.normal,
    });

    res.json({
      success: true,
      message: "Login berhasil.",
      data: {
        user: result.user,
        rememberMe,
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
  res.json({
    success: true,
    data: {
      user: req.auth!.user,
    },
  });
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth!;

    await logoutUser(auth.sessionId, auth.user.id);

    res.clearCookie(COOKIE_NAME, cookieOptions);

    res.json({
      success: true,
      message: "Logout berhasil.",
    });
  } catch (error) {
    next(error);
  }
}
