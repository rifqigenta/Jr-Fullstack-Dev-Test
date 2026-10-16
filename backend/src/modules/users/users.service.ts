import { pool } from "../../config/database.js";
import bcrypt from "bcryptjs";
import { generatePassword } from "./password.util.js";

export type UserListQuery = {
  page: number;
  limit: number;
  search: string;
};

type UserRow = {
  id: number;
  username: string;
  nama: string;
  email: string | null;
  id_role: number;
  nama_role: string;
  id_pegawai: number | null;
  nama_pegawai: string | null;
  nip: string | null;
  disabled: number;
  created_at: Date;
};

export async function getUsers(query: UserListQuery) {
  const { page, limit, search } = query;

  const offset = (page - 1) * limit;

  const whereClause = search
    ? `
      WHERE u.deleted_at IS NULL 
      AND (
        u.username LIKE ?
        OR u.nama LIKE ?
        OR u.email LIKE ?
        OR p.nama_pegawai LIKE ?
      )
    `
    : "";

  const searchParams = search ? Array(4).fill(`%${search}%`) : [];

  const countRows = await pool.query<Array<{ total: number | bigint }>>(
    `
    SELECT COUNT(*) AS total
    FROM \`user\` u
    LEFT JOIN pegawai p ON p.id = u.id_pegawai
    ${whereClause}
    `,
    searchParams,
  );

  const total = Number(countRows[0]?.total ?? 0);

  const rows = await pool.query<UserRow[]>(
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
      p.nip,
      u.disabled,
      u.created_at

    FROM \`user\` u

    JOIN user_role r
      ON r.id = u.id_role

    LEFT JOIN pegawai p
      ON p.id = u.id_pegawai

    ${whereClause}

    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ? OFFSET ?
    `,
    [...searchParams, limit, offset],
  );

  return {
    users: rows.map((user) => ({
      ...user,
      disabled: Boolean(user.disabled),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

type UserDetailRow = {
  id: number;
  username: string;
  nama: string;
  email: string | null;
  id_role: number;
  nama_role: string;
  id_pegawai: number | null;
  nama_pegawai: string | null;
  nip: string | null;
  disabled: number;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date | null;
};

export async function getUserById(id: number) {
  const rows = await pool.query<UserDetailRow[]>(
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
      p.nip,
      u.disabled,
      u.last_login,
      u.created_at,
      u.updated_at
    FROM \`user\` u
    JOIN user_role r
      ON r.id = u.id_role
    LEFT JOIN pegawai p
      ON p.id = u.id_pegawai
    WHERE u.id = ?
      AND u.deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  );

  const user = rows[0];

  if (!user) {
    return null;
  }

  return {
    ...user,
    disabled: Boolean(user.disabled),
  };
}

type EmployeeOptionRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string | null;
};

export async function getEmployeeOptions(search: string, limit: number) {
  const keyword = `%${search}%`;

  const rows = await pool.query<EmployeeOptionRow[]>(
    `
    SELECT
      p.id,
      p.nip,
      p.nama_pegawai,
      p.email,
      p.nomor_hp
    FROM pegawai p
    WHERE p.deleted_at IS NULL
      (
        p.nama_pegawai LIKE ?
        OR p.nip LIKE ?
        OR p.email LIKE ?
      )
      AND NOT EXISTS (
        SELECT 1
        FROM \`user\` u
        WHERE u.id_pegawai = p.id
      )
    ORDER BY p.nama_pegawai ASC
    LIMIT ?
    `,
    [keyword, keyword, keyword, limit],
  );

  return rows;
}

export type CreateUserInput = {
  id_pegawai: number;
  id_role: number;
  username: string;
  nama: string;
  email: string;
};

export class UserServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

type ExistingUserRow = {
  id: number;
};

type RoleRow = {
  id: number;
  nama_role: string;
};

type EmployeeRow = {
  id: number;
  nama_pegawai: string;
  email: string;
};

export async function createUser(input: CreateUserInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const roles = await connection.query<RoleRow[]>(
      `
      SELECT id, nama_role
      FROM user_role
      WHERE id = ?
      LIMIT 1
      `,
      [input.id_role],
    );

    const role = roles[0];

    if (!role) {
      throw new UserServiceError("Role tidak ditemukan.", 404);
    }

    const employees = await connection.query<EmployeeRow[]>(
      `
      SELECT id, nama_pegawai, email
      FROM pegawai
      WHERE id = ?
      LIMIT 1
      `,
      [input.id_pegawai],
    );

    if (!employees[0]) {
      throw new UserServiceError("Pegawai tidak ditemukan.", 404);
    }

    const existingUsers = await connection.query<ExistingUserRow[]>(
      `
      SELECT id
      FROM \`user\`
      WHERE username = ?
         OR email = ?
         OR id_pegawai = ?
      LIMIT 1
      `,
      [input.username, input.email, input.id_pegawai],
    );

    if (existingUsers.length > 0) {
      throw new UserServiceError("Username, email, atau pegawai sudah digunakan.", 409);
    }

    const generatedPassword = generatePassword(12);

    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    const result = await connection.query(
      `
      INSERT INTO \`user\` (
        id_role,
        id_pegawai,
        username,
        password_hash,
        nama,
        email,
        disabled
      )
      VALUES (?, ?, ?, ?, ?, ?, 0)
      `,
      [input.id_role, input.id_pegawai, input.username, passwordHash, input.nama, input.email],
    );

    const newUserId = Number(result.insertId);

    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["CREATE_USER", `Membuat user ${input.username} (ID: ${newUserId})`, actorId],
    );

    await connection.commit();

    return {
      id: newUserId,
      username: input.username,
      nama: input.nama,
      email: input.email,
      id_role: input.id_role,
      nama_role: role.nama_role,
      id_pegawai: input.id_pegawai,
      disabled: false,
      generatedPassword,
    };
  } catch (error) {
    await connection.rollback();

    if (error && typeof error === "object" && "errno" in error && error.errno === 1062) {
      throw new UserServiceError("Data user sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export type UpdateUserInput = {
  username?: string;
  nama?: string;
  email?: string;
  id_role?: number;
  id_pegawai?: number | null;
};

type UserRecord = {
  id: number;
  username: string;
  nama: string;
  email: string | null;
  id_role: number;
  id_pegawai: number | null;
  disabled: number;
};

function isDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === 1062;
}

export async function updateUser(id: number, input: UpdateUserInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<UserRecord[]>(
      `
      SELECT
        id, username, nama, email,
        id_role, id_pegawai, disabled
      FROM \`user\`
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [id],
    );

    const existing = rows[0];

    if (!existing) {
      throw new UserServiceError("Pengguna tidak ditemukan.", 404);
    }

    const next = {
      username: input.username ?? existing.username,
      nama: input.nama ?? existing.nama,
      email: input.email ?? existing.email,
      id_role: input.id_role ?? existing.id_role,
      id_pegawai: input.id_pegawai === undefined ? existing.id_pegawai : input.id_pegawai,
    };

    // Jangan izinkan Superadmin mengganti role
    // akunnya sendiri melalui endpoint ini.
    if (id === actorId && next.id_role !== existing.id_role) {
      throw new UserServiceError("Tidak boleh mengubah role akun sendiri.", 403);
    }

    const roles = await connection.query<Array<{ id: number }>>(`SELECT id FROM user_role WHERE id = ? LIMIT 1`, [next.id_role]);

    if (!roles.length) {
      throw new UserServiceError("Role tidak ditemukan.", 404);
    }

    if (next.id_pegawai !== null) {
      const employees = await connection.query<Array<{ id: number }>>(`SELECT id FROM pegawai WHERE id = ? LIMIT 1`, [next.id_pegawai]);

      if (!employees.length) {
        throw new UserServiceError("Pegawai tidak ditemukan.", 404);
      }
    }

    const duplicates = await connection.query<Array<{ id: number }>>(
      `
      SELECT id
      FROM \`user\`
      WHERE id <> ?
        AND (
          username = ?
          OR email = ?
          OR (
            ? IS NOT NULL
            AND id_pegawai = ?
          )
        )
      LIMIT 1
      `,
      [id, next.username, next.email, next.id_pegawai, next.id_pegawai],
    );

    if (duplicates.length) {
      throw new UserServiceError("Username, email, atau pegawai sudah digunakan.", 409);
    }

    await connection.query(
      `
      UPDATE \`user\`
      SET
        username = ?,
        nama = ?,
        email = ?,
        id_role = ?,
        id_pegawai = ?,
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [next.username, next.nama, next.email, next.id_role, next.id_pegawai, id],
    );

    if (next.id_role !== existing.id_role) {
      await connection.query(
        `
    UPDATE auth_sessions
    SET revoked_at = UTC_TIMESTAMP(3)
    WHERE id_user = ?
      AND revoked_at IS NULL
    `,
        [id],
      );
    }

    await connection.query(
      `
      INSERT INTO activities
        (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["UPDATE_USER", `Memperbarui user ID ${id} (${next.username})`, actorId],
    );

    await connection.commit();

    return {
      id,
      ...next,
      disabled: Boolean(existing.disabled),
    };
  } catch (error) {
    await connection.rollback();

    if (isDuplicateError(error)) {
      throw new UserServiceError("Data user sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function changeUserStatus(id: number, disabled: boolean, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<UserRecord[]>(
      `
      SELECT
        id, username, nama, email,
        id_role, id_pegawai, disabled
      FROM \`user\`
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [id],
    );

    const user = rows[0];

    if (!user) {
      throw new UserServiceError("Pengguna tidak ditemukan.", 404);
    }

    // Hindari Superadmin mengunci akunnya sendiri.
    if (id === actorId && disabled) {
      throw new UserServiceError("Tidak boleh menonaktifkan akun sendiri.", 403);
    }

    await connection.query(
      `
      UPDATE \`user\`
      SET
        disabled = ?,
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [disabled ? 1 : 0, id],
    );

    // Saat disabled, semua sesi aktif dicabut.
    if (disabled) {
      await connection.query(
        `
        UPDATE auth_sessions
        SET revoked_at = UTC_TIMESTAMP(3)
        WHERE id_user = ?
          AND revoked_at IS NULL
        `,
        [id],
      );
    }

    await connection.query(
      `
      INSERT INTO activities
        (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      [disabled ? "DISABLE_USER" : "ENABLE_USER", `${disabled ? "Menonaktifkan" : "Mengaktifkan"} user ${user.username} (ID: ${id})`, actorId],
    );

    await connection.commit();

    return {
      id,
      username: user.username,
      disabled,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteUser(id: number, actorId: number) {
  if (id === actorId) {
    throw new UserServiceError("Tidak boleh menghapus akun sendiri.", 403);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<UserRecord[]>(
      `
      SELECT
        id, username, nama, email,
        id_role, id_pegawai, disabled
      FROM \`user\`
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [id],
    );

    const user = rows[0];

    if (!user) {
      throw new UserServiceError("Pengguna tidak ditemukan.", 404);
    }

    await connection.query(
      `
      UPDATE \`user\`
      SET
        disabled = 1,
        deleted_at = UTC_TIMESTAMP(),
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
      `,
      [id],
    );

    await connection.query(
      `
      UPDATE auth_sessions
      SET revoked_at = UTC_TIMESTAMP(3)
      WHERE id_user = ?
        AND revoked_at IS NULL
      `,
      [id],
    );

    await connection.query(
      `
      INSERT INTO activities
        (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["DELETE_USER", `Menghapus user ${user.username} (ID: ${id})`, actorId],
    );

    await connection.commit();

    return {
      id,
      username: user.username,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
