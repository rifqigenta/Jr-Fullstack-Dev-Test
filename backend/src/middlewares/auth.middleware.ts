import type { Request, Response, NextFunction } from "express";

import jwt, { type JwtPayload } from "jsonwebtoken";

import { pool } from "../config/database.js";
import { env } from "../config/env.js";

import { COOKIE_NAME, IDLE_TIMEOUT_MS, type AuthUser } from "../modules/auth/auth.service.js";

export type AuthRequest = Request & {
  auth?: {
    user: AuthUser;
    sessionId: string;
  };
};

type SessionRow = AuthUser & {
  session_id: string;
  remember_me: number | bigint;
  idle_seconds: number | bigint;
  expired: number | bigint;
  revoked: number | bigint;
  disabled: number | bigint;
  deleted_at: Date | null;
};

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const bearer = req.headers.authorization;

    const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : req.cookies?.[COOKIE_NAME];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Silakan login terlebih dahulu.",
      });
      return;
    }

    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;

    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      res.status(401).json({
        success: false,
        message: "Token tidak valid.",
      });
      return;
    }

    const rows = await pool.query<SessionRow[]>(
      `
      SELECT
        s.id AS session_id,
        s.remember_me,

        TIMESTAMPDIFF(
          SECOND,
          s.last_activity_at,
          UTC_TIMESTAMP(3)
        ) AS idle_seconds,

        (s.expires_at <= UTC_TIMESTAMP(3)) AS expired,
        (s.revoked_at IS NOT NULL) AS revoked,
        u.deleted_at AS deleted_at,

        u.id,
        u.id_role,
        u.username,
        u.nama,
        u.email,
        u.disabled,
        r.nama_role

      FROM auth_sessions s

      JOIN \`user\` u
        ON u.id = s.id_user

      JOIN user_role r
        ON r.id = u.id_role

      WHERE s.id = ?
        AND s.id_user = ?

      LIMIT 1
      `,
      [payload.sid, payload.sub],
    );

    const session = rows[0];

    if (!session || session.disabled || session.revoked || session.expired) {
      res.status(401).json({
        success: false,
        message: "Sesi tidak aktif. Silakan login kembali.",
      });
      return;
    }

    if (session.deleted_at !== null) {
      res.status(401).json({
        success: false,
        message: "Sesi tidak valid. Akun sudah dihapus.",
      });
      return;
    }

    if (!session.remember_me && Number(session.idle_seconds) * 1000 >= IDLE_TIMEOUT_MS) {
      await pool.query(
        `
        UPDATE auth_sessions
        SET revoked_at = UTC_TIMESTAMP(3)
        WHERE id = ?
        `,
        [session.session_id],
      );

      res.status(401).json({
        success: false,
        message: "Sesi berakhir karena tidak aktif 3 menit.",
      });
      return;
    }

    await pool.query(
      `
      UPDATE auth_sessions
      SET last_activity_at = UTC_TIMESTAMP(3)
      WHERE id = ?
        AND revoked_at IS NULL
      `,
      [session.session_id],
    );

    req.auth = {
      sessionId: session.session_id,
      user: {
        id: session.id,
        id_role: session.id_role,
        username: session.username,
        nama: session.nama,
        email: session.email,
        nama_role: session.nama_role,
      },
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
      return;
    }

    next(error);
  }
}
