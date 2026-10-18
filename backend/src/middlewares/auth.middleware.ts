import type { Request, Response, NextFunction } from "express";

import jwt from "jsonwebtoken";

import { pool } from "../config/database.js";
import { env } from "../config/env.js";

import { COOKIE_NAME, IDLE_TIMEOUT_MS, TOKEN_TTL, cookieOptions, createSessionToken, type AuthUser } from "../modules/auth/auth.service.js";

export type AuthRequest = Request & {
  auth?: {
    user: AuthUser;
    sessionId: string;
    rememberMe: boolean;
    lastActivityAt: number;
  };
};

type SessionRow = AuthUser & {
  session_id: string;
  remember_me: number | bigint;
  idle_ms: number | bigint;
  expired: number | bigint;
  revoked: number | bigint;
  disabled: number | bigint;
  deleted_at: Date | null;
};

function unauthorized(res: Response, message: string): void {
  res.clearCookie(COOKIE_NAME, cookieOptions);

  res.status(401).json({
    success: false,
    message,
  });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.auth) {
      next();
      return;
    }

    const authorization = req.headers.authorization;
    const usingBearer = authorization?.startsWith("Bearer ");

    const token = usingBearer ? authorization?.slice(7) : req.cookies?.[COOKIE_NAME];

    if (typeof token !== "string" || !token) {
      unauthorized(res, "Silakan login terlebih dahulu.");
      return;
    }

    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

    if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.sid !== "string" || !/^[1-9]\d*$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub))) {
      unauthorized(res, "Token tidak valid.");
      return;
    }

    const rows = await pool.query<SessionRow[]>(
      `
        SELECT
          s.id AS session_id,
          s.remember_me,
          TIMESTAMPDIFF(
            MICROSECOND,
            s.last_activity_at,
            UTC_TIMESTAMP(3)
          ) / 1000 AS idle_ms,
          (s.expires_at <= UTC_TIMESTAMP(3)) AS expired,
          (s.revoked_at IS NOT NULL) AS revoked,
          u.deleted_at,
          u.id,
          u.id_role,
          u.username,
          u.nama,
          u.email,
          u.disabled,
          r.nama_role
        FROM auth_sessions s
        JOIN \`user\` u ON u.id = s.id_user
        JOIN user_role r ON r.id = u.id_role
        WHERE s.id = ? AND s.id_user = ?
        LIMIT 1
      `,
      [payload.sid, payload.sub],
    );

    const session = rows[0];

    if (!session || Number(session.disabled) !== 0 || Number(session.revoked) !== 0 || Number(session.expired) !== 0 || session.deleted_at !== null) {
      unauthorized(res, "Sesi tidak aktif. Silakan login kembali.");
      return;
    }

    const rememberMe = Number(session.remember_me) === 1;
    const idleMs = Math.max(0, Number(session.idle_ms));

    if (!rememberMe && idleMs >= IDLE_TIMEOUT_MS) {
      await pool.query(
        `
          UPDATE auth_sessions
          SET revoked_at = UTC_TIMESTAMP(3)
          WHERE id = ?
            AND revoked_at IS NULL
            AND last_activity_at <= DATE_SUB(
              UTC_TIMESTAMP(3),
              INTERVAL ? MICROSECOND
            )
        `,
        [session.session_id, IDLE_TIMEOUT_MS * 1000],
      );

      unauthorized(res, "Sesi berakhir karena tidak aktif 3 menit.");
      return;
    }

    const ttl = rememberMe ? TOKEN_TTL.remembered : TOKEN_TTL.normal;

    await pool.query(
      `
        UPDATE auth_sessions
        SET expires_at = DATE_ADD(
          UTC_TIMESTAMP(3),
          INTERVAL ? SECOND
        )
        WHERE id = ? AND revoked_at IS NULL
      `,
      [Math.floor(ttl / 1000), session.session_id],
    );

    if (!usingBearer) {
      res.cookie(COOKIE_NAME, createSessionToken(session.id, session.session_id, rememberMe), {
        ...cookieOptions,
        ...(rememberMe ? { maxAge: ttl } : {}),
      });
    }

    req.auth = {
      sessionId: session.session_id,
      rememberMe,
      lastActivityAt: Date.now() - idleMs,
      user: {
        id: session.id,
        id_role: session.id_role,
        username: session.username,
        nama: session.nama,
        email: session.email,
        nama_role: session.nama_role,
      },
    };

    res.setHeader("Cache-Control", "no-store");
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      unauthorized(res, "Token tidak valid atau sudah kedaluwarsa.");
      return;
    }

    next(error);
  }
}
