import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";

export type AuthUser = {
  id: number;
  id_role: number;
  username: string;
  nama: string;
  email: string | null;
  nama_role: string;
};

type LoginRow = AuthUser & {
  password_hash: string;
  disabled: number | bigint;
};

export const COOKIE_NAME = "jmc_token";
export const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export const TOKEN_TTL = {
  normal: 8 * 60 * 60 * 1000,
  remembered: 400 * 24 * 60 * 60 * 1000,
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function createSessionToken(userId: number, sessionId: string, rememberMe: boolean) {
  const ttl = rememberMe ? TOKEN_TTL.remembered : TOKEN_TTL.normal;

  return jwt.sign({ sid: sessionId }, env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: Math.floor(ttl / 1000),
    algorithm: "HS256",
  });
}

export async function recordActivity(userId: number, title: string, content: string) {
  await pool.query(
    `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
    `,
    [title, content, userId],
  );
}

export async function loginUser(identifier: string, password: string, rememberMe: boolean) {
  const users = await pool.query<LoginRow[]>(
    `
      SELECT
        u.id,
        u.id_role,
        u.username,
        u.nama,
        u.email,
        u.password_hash,
        u.disabled,
        r.nama_role
      FROM \`user\` u
      JOIN user_role r ON r.id = u.id_role
      LEFT JOIN pegawai p
        ON p.id = u.id_pegawai
        AND p.deleted_at IS NULL
      WHERE u.deleted_at IS NULL
        AND (
          u.username = ?
          OR u.email = ?
          OR p.nomor_hp = ?
        )
      LIMIT 2
    `,
    [identifier, identifier, identifier],
  );

  if (users.length !== 1) {
    throw new AuthError("Kredensial tidak valid.");
  }

  const user = users[0]!;

  if (Number(user.disabled) !== 0) {
    throw new AuthError("Akun dinonaktifkan.", 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new AuthError("Kredensial tidak valid.");
  }

  const sessionId = randomUUID();

  const ttl = rememberMe ? TOKEN_TTL.remembered : TOKEN_TTL.normal;

  const token = createSessionToken(user.id, sessionId, rememberMe);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO auth_sessions (
          id,
          id_user,
          remember_me,
          last_activity_at,
          expires_at
        )
        VALUES (
          ?, ?, ?,
          UTC_TIMESTAMP(3),
          DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND)
        )
      `,
      [sessionId, user.id, rememberMe ? 1 : 0, Math.floor(ttl / 1000)],
    );

    await connection.query(
      `
        UPDATE \`user\`
        SET
          last_login = UTC_TIMESTAMP(),
          last_session = UTC_TIMESTAMP()
        WHERE id = ?
      `,
      [user.id],
    );

    await connection.query(
      `
        INSERT INTO activities (title, content, created_by)
        VALUES (?, ?, ?)
      `,
      ["LOGIN", `Login berhasil: ${user.username}`, user.id],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    token,
    ttl,
    user: {
      id: user.id,
      id_role: user.id_role,
      username: user.username,
      nama: user.nama,
      email: user.email,
      nama_role: user.nama_role,
    } satisfies AuthUser,
  };
}

export async function logoutUser(sessionId: string, userId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await connection.query(
      `
        UPDATE auth_sessions
        SET revoked_at = UTC_TIMESTAMP(3)
        WHERE id = ?
          AND id_user = ?
          AND revoked_at IS NULL
      `,
      [sessionId, userId],
    );

    if (Number(result.affectedRows) > 0) {
      await connection.query(
        `
          INSERT INTO activities (title, content, created_by)
          VALUES (?, ?, ?)
        `,
        ["LOGOUT", "Pengguna melakukan logout.", userId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
