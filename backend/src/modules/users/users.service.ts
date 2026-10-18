import bcrypt from "bcryptjs";
import type { PoolConnection } from "mariadb";

import { pool } from "../../config/database.js";

import type { UserListQuery, CreateUserInput, UpdateUserInput } from "./users.schema.js";

export class UserServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

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
  disabled: number | bigint;
  id_jabatan: number | null;
  id_departemen: number | null;
  nama_jabatan: string | null;
  nama_departemen: string | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date | null;
};

type EmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string | null;
  id_jabatan: number;
  id_departemen: number;
};

type UserRecord = {
  id: number;
  username: string;
  id_role: number;
  id_pegawai: number | null;
  disabled: number | bigint;
};

const userSelect = `
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
    p.id_jabatan,
    p.id_departemen,
    j.nama AS nama_jabatan,
    d.nama AS nama_departemen,
    u.disabled,
    u.last_login,
    u.created_at,
    u.updated_at
  FROM \`user\` u
  JOIN user_role r ON r.id = u.id_role
  LEFT JOIN pegawai p ON p.id = u.id_pegawai
  LEFT JOIN master_data j ON j.id = p.id_jabatan
  LEFT JOIN master_data d ON d.id = p.id_departemen
`;

function isDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === 1062;
}

function escapeLike(value: string): string {
  return value.replace(/[=%_]/g, (character) => `=${character}`);
}

async function log(connection: PoolConnection, title: string, content: string, actorId: number) {
  await connection.query(
    `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
    `,
    [title, content, actorId],
  );
}

async function revokeSessions(connection: PoolConnection, userId: number) {
  await connection.query(
    `
      UPDATE auth_sessions
      SET revoked_at = UTC_TIMESTAMP(3)
      WHERE id_user = ? AND revoked_at IS NULL
    `,
    [userId],
  );
}

async function requireRole(connection: PoolConnection, roleId: number) {
  const rows = await connection.query<Array<{ id: number; nama_role: string }>>("SELECT id, nama_role FROM user_role WHERE id = ? LIMIT 1", [roleId]);

  if (!rows[0]) {
    throw new UserServiceError("Role tidak ditemukan.", 404);
  }

  return rows[0];
}

async function requireEmployee(connection: PoolConnection, employeeId: number) {
  const rows = await connection.query<EmployeeRow[]>(
    `
      SELECT
        id, nip, nama_pegawai, email, nomor_hp,
        id_jabatan, id_departemen
      FROM pegawai
      WHERE id = ? AND deleted_at IS NULL
      FOR UPDATE
    `,
    [employeeId],
  );

  if (!rows[0]) {
    throw new UserServiceError("Pegawai tidak ditemukan.", 404);
  }

  return rows[0];
}

async function validateMaster(connection: PoolConnection, id: number, type: "jabatan" | "departemen") {
  const rows = await connection.query<Array<{ id: number }>>(
    `
      SELECT id
      FROM master_data
      WHERE id = ? AND tipe = ?
      LIMIT 1
    `,
    [id, type],
  );

  if (!rows.length) {
    throw new UserServiceError(`${type === "jabatan" ? "Jabatan" : "Departemen"} tidak ditemukan.`, 404);
  }
}

async function validateUnique(connection: PoolConnection, username: string, email: string, employeeId: number, excludeId = 0) {
  const rows = await connection.query<Array<{ id: number }>>(
    `
      SELECT id
      FROM \`user\`
      WHERE id <> ?
        AND (
          username = ?
          OR email = ?
          OR id_pegawai = ?
        )
      LIMIT 1
    `,
    [excludeId, username, email, employeeId],
  );

  if (rows.length) {
    throw new UserServiceError("Username, email, atau pegawai sudah digunakan.", 409);
  }
}

async function lockUser(connection: PoolConnection, id: number) {
  const rows = await connection.query<UserRecord[]>(
    `
      SELECT id, username, id_role, id_pegawai, disabled
      FROM \`user\`
      WHERE id = ? AND deleted_at IS NULL
      FOR UPDATE
    `,
    [id],
  );

  if (!rows[0]) {
    throw new UserServiceError("Pengguna tidak ditemukan.", 404);
  }

  return rows[0];
}

export async function getUsers(query: UserListQuery) {
  const conditions = ["u.deleted_at IS NULL"];
  const params: string[] = [];

  if (query.search) {
    const keyword = `%${escapeLike(query.search)}%`;

    conditions.push(`
      (
        u.username LIKE ? ESCAPE '='
        OR u.nama LIKE ? ESCAPE '='
        OR u.email LIKE ? ESCAPE '='
        OR p.nama_pegawai LIKE ? ESCAPE '='
      )
    `);

    params.push(keyword, keyword, keyword, keyword);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const counts = await pool.query<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM \`user\` u
      JOIN user_role r ON r.id = u.id_role
      LEFT JOIN pegawai p ON p.id = u.id_pegawai
      ${where}
    `,
    params,
  );

  const total = Number(counts[0]?.total || 0);

  const sortBy = query.sortBy;

  const sortColumn = sortBy === "nama" ? "u.nama" : sortBy === "username" ? "u.username" : sortBy === "status" ? "u.disabled" : "u.id";

  const direction = query.sortOrder === "asc" ? "ASC" : "DESC";

  const rows = await pool.query<UserRow[]>(
    `
      ${userSelect}
      ${where}
      ORDER BY ${sortColumn} ${direction}, u.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, (query.page - 1) * query.limit],
  );

  return {
    users: rows.map((row) => ({
      ...row,
      disabled: Number(row.disabled) !== 0,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getUserById(id: number) {
  const rows = await pool.query<UserRow[]>(
    `
      ${userSelect}
      WHERE u.id = ? AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return rows[0]
    ? {
        ...rows[0],
        disabled: Number(rows[0].disabled) !== 0,
      }
    : null;
}

export async function getEmployeeOptions(search: string, limit: number) {
  if (search.trim().length < 2) return [];

  const keyword = `%${escapeLike(search.trim())}%`;

  return pool.query<EmployeeRow[]>(
    `
      SELECT
        p.id, p.nip, p.nama_pegawai, p.email, p.nomor_hp,
        p.id_jabatan, p.id_departemen
      FROM pegawai p
      WHERE p.deleted_at IS NULL
        AND (
          p.nama_pegawai LIKE ? ESCAPE '='
          OR p.nip LIKE ? ESCAPE '='
        )
        AND NOT EXISTS (
          SELECT 1
          FROM \`user\` u
          WHERE u.id_pegawai = p.id
        )
      ORDER BY p.nama_pegawai ASC, p.id ASC
      LIMIT ?
    `,
    [keyword, keyword, limit],
  );
}

export async function usernameAvailable(username: string, excludeId = 0) {
  const rows = await pool.query<Array<{ id: number }>>(
    `
      SELECT id
      FROM \`user\`
      WHERE username = ? AND id <> ?
      LIMIT 1
    `,
    [username, excludeId],
  );

  return rows.length === 0;
}

export async function createUser(input: CreateUserInput, actorId: number) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const role = await requireRole(connection, input.id_role);
    const employee = await requireEmployee(connection, input.id_pegawai);

    await validateMaster(connection, input.id_jabatan, "jabatan");
    await validateMaster(connection, input.id_departemen, "departemen");

    await validateUnique(connection, input.username, employee.email, employee.id);

    const result = await connection.query(
      `
        INSERT INTO \`user\` (
          id_role, id_pegawai, username, password_hash,
          nama, email, disabled
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [input.id_role, employee.id, input.username, passwordHash, employee.nama_pegawai, employee.email, input.disabled ? 1 : 0],
    );

    await connection.query(
      `
        UPDATE pegawai
        SET
          id_jabatan = ?,
          id_departemen = ?,
          updated_at = CURRENT_TIMESTAMP()
        WHERE id = ?
      `,
      [input.id_jabatan, input.id_departemen, employee.id],
    );

    const id = Number(result.insertId);

    await log(connection, "CREATE_USER", `Membuat user ${input.username} (ID: ${id})`, actorId);

    await connection.commit();

    return {
      id,
      username: input.username,
      nama: employee.nama_pegawai,
      email: employee.email,
      id_role: input.id_role,
      nama_role: role.nama_role,
      id_pegawai: employee.id,
      id_jabatan: input.id_jabatan,
      id_departemen: input.id_departemen,
      disabled: input.disabled,
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

export async function updateUser(id: number, input: UpdateUserInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existing = await lockUser(connection, id);

    const roleId = input.id_role ?? existing.id_role;
    const employeeId = input.id_pegawai ?? existing.id_pegawai;
    const username = input.username ?? existing.username;

    if (!employeeId) {
      throw new UserServiceError("Pilih pegawai untuk akun ini.");
    }

    if (id === actorId && roleId !== existing.id_role) {
      throw new UserServiceError("Tidak boleh mengubah role akun sendiri.", 403);
    }

    await requireRole(connection, roleId);

    const employee = await requireEmployee(connection, employeeId);

    const positionId = input.id_jabatan ?? employee.id_jabatan;
    const departmentId = input.id_departemen ?? employee.id_departemen;

    await validateMaster(connection, positionId, "jabatan");
    await validateMaster(connection, departmentId, "departemen");

    await validateUnique(connection, username, employee.email, employee.id, id);

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
      `,
      [username, employee.nama_pegawai, employee.email, roleId, employee.id, id],
    );

    await connection.query(
      `
        UPDATE pegawai
        SET
          id_jabatan = ?,
          id_departemen = ?,
          updated_at = CURRENT_TIMESTAMP()
        WHERE id = ?
      `,
      [positionId, departmentId, employee.id],
    );

    if (roleId !== existing.id_role || employee.id !== existing.id_pegawai) {
      await revokeSessions(connection, id);
    }

    await log(connection, "UPDATE_USER", `Memperbarui user ${username} (ID: ${id})`, actorId);

    await connection.commit();

    return {
      id,
      username,
      nama: employee.nama_pegawai,
      email: employee.email,
      id_role: roleId,
      id_pegawai: employee.id,
      id_jabatan: positionId,
      id_departemen: departmentId,
      disabled: Number(existing.disabled) !== 0,
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
  if (id === actorId && disabled) {
    throw new UserServiceError("Tidak boleh menonaktifkan akun sendiri.", 403);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const user = await lockUser(connection, id);

    await connection.query(
      `
        UPDATE \`user\`
        SET disabled = ?, updated_at = CURRENT_TIMESTAMP()
        WHERE id = ?
      `,
      [disabled ? 1 : 0, id],
    );

    if (disabled) {
      await revokeSessions(connection, id);
    }

    await log(connection, disabled ? "DISABLE_USER" : "ENABLE_USER", `${disabled ? "Menonaktifkan" : "Mengaktifkan"} user ${user.username} (ID: ${id})`, actorId);

    await connection.commit();

    return { id, username: user.username, disabled };
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

    const user = await lockUser(connection, id);

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

    await revokeSessions(connection, id);

    await log(connection, "DELETE_USER", `Menghapus user ${user.username} (ID: ${id})`, actorId);

    await connection.commit();

    return { id, username: user.username };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
