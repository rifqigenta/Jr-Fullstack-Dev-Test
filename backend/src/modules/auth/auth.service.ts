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
  disabled: number;
};

export const COOKIE_NAME = "jmc_token";
export const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export const TOKEN_TTL = {
  normal: 8 * 60 * 60 * 1000,
  remembered: 7 * 24 * 60 * 60 * 1000,
};

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode = 401,
  ) {
    super(message);
  }
}

export async function recordActivity(userId: number, title: string, content: string) {
  await pool.query(
    `INSERT INTO activities
       (title, content, created_by)
     VALUES (?, ?, ?)`,
    [title, content, userId],
  );
}

export async function loginUser(identifier: string, password: string, rememberMe: boolean) {
  const users = await pool.query<LoginRow[]>(
    `SELECT
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
     LEFT JOIN pegawai p ON p.id = u.id_pegawai
     WHERE u.username = ?
        AND u.deleted_at IS NULL
        OR u.email = ?
        OR p.nomor_hp = ?
     LIMIT 2`,
    [identifier, identifier, identifier],
  );

  if (users.length !== 1) {
    throw new AuthError("Kredensial tidak valid.");
  }

  const user = users[0];

  if (user.disabled) {
    throw new AuthError("Akun dinonaktifkan.", 403);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new AuthError("Kredensial tidak valid.");
  }

  const sessionId = randomUUID();
  const ttl = rememberMe ? TOKEN_TTL.remembered : TOKEN_TTL.normal;

  const expiresAt = new Date(Date.now() + ttl);

  await pool.query(
    `
  INSERT INTO auth_sessions (
    id,
    id_user,
    remember_me,
    last_activity_at,
    expires_at
  )
  VALUES (
    ?,
    ?,
    ?,
    UTC_TIMESTAMP(3),
    DATE_ADD(
      UTC_TIMESTAMP(3),
      INTERVAL ? SECOND
    )
  )
  `,
    [sessionId, user.id, rememberMe ? 1 : 0, Math.floor(ttl / 1000)],
  );

  const token = jwt.sign({ sid: sessionId }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: rememberMe ? "7d" : "8h",
    algorithm: "HS256",
  });

  await pool.query(
    `UPDATE \`user\`
     SET last_login = UTC_TIMESTAMP(),
         last_session = UTC_TIMESTAMP()
     WHERE id = ?`,
    [user.id],
  );

  try {
    await recordActivity(user.id, "LOGIN", `Login berhasil: ${user.username}`);
  } catch (error) {
    console.error("Gagal mencatat aktivitas login:", error);
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
  await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = UTC_TIMESTAMP(3)
     WHERE id = ?
       AND id_user = ?
       AND revoked_at IS NULL`,
    [sessionId, userId],
  );

  try {
    await recordActivity(userId, "LOGOUT", "Pengguna melakukan logout.");
  } catch (error) {
    console.error("Gagal mencatat aktivitas logout:", error);
  }
}
