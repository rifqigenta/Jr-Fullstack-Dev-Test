import { pool } from "../../config/database.js";

import type { UpdateProfileInput } from "./profile.schema.js";

type ProfileRow = {
  id: number;
  username: string;
  nama: string;
  email: string;
  id_role: number;
  nama_role: string;
  id_pegawai: number | null;
  nama_pegawai: string | null;
  foto_pegawai: string | null;
  disabled: number | boolean;
  created_at: Date;
  last_login: Date | null;
};

type ExistingUserRow = {
  id: number;
};

export class ProfileServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

export async function getProfile(userId: number) {
  const rows = await pool.query<ProfileRow[]>(
    `
    SELECT
      u.id,
      u.username,
      u.nama,
      u.email,
      u.id_role,
      r.nama_role,
      u.id_pegawai,
      p.nama_pegawai,
      p.foto_pegawai,
      u.disabled,
      u.created_at,
      u.last_login
    FROM user u
    JOIN user_role r
      ON r.id = u.id_role
    LEFT JOIN pegawai p
      ON p.id = u.id_pegawai
      AND p.deleted_at IS NULL
    WHERE u.id = ?
      AND u.deleted_at IS NULL
    LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const users = await connection.query<ExistingUserRow[]>(
      `
      SELECT id
      FROM user
      WHERE id = ?
        AND deleted_at IS NULL
        AND disabled = 0
      FOR UPDATE
      `,
      [userId],
    );

    if (!users.length) {
      throw new ProfileServiceError("Pengguna tidak ditemukan.", 404);
    }

    if (input.email !== undefined) {
      const duplicates = await connection.query<ExistingUserRow[]>(
        `
          SELECT id
          FROM user
          WHERE email = ?
            AND id <> ?
            AND deleted_at IS NULL
          LIMIT 1
          `,
        [input.email, userId],
      );

      if (duplicates.length) {
        throw new ProfileServiceError("Email sudah digunakan.", 409);
      }
    }

    const updates: string[] = [];
    const params: Array<string | number> = [];

    if (input.nama !== undefined) {
      updates.push("nama = ?");
      params.push(input.nama);
    }

    if (input.email !== undefined) {
      updates.push("email = ?");
      params.push(input.email);
    }

    updates.push("updated_at = UTC_TIMESTAMP()");

    await connection.query(
      `
      UPDATE user
      SET ${updates.join(", ")}
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [...params, userId],
    );

    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["UPDATE_PROFILE", `Memperbarui profil pengguna ID ${userId}`, userId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    if (typeof error === "object" && error !== null && "errno" in error && error.errno === 1062) {
      throw new ProfileServiceError("Email sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }

  return getProfile(userId);
}
