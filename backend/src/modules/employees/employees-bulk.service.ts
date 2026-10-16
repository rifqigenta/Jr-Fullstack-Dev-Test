import { pool } from "../../config/database.js";

import { EmployeeServiceError } from "./employees.service.js";

import type { BulkStatusInput, BulkDeleteInput } from "./employees-bulk.schema.js";

type EmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
};

type LinkedUserRow = {
  id: number;
  id_pegawai: number;
  nama_role: string;
};

function placeholders(count: number): string {
  return Array(count).fill("?").join(", ");
}

export async function bulkUpdateEmployeeStatus(input: BulkStatusInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const marks = placeholders(input.ids.length);

    // Lock semua pegawai yang akan diubah.
    const employees = await connection.query<EmployeeRow[]>(
      `
      SELECT id, nip, nama_pegawai
      FROM pegawai
      WHERE id IN (${marks})
        AND deleted_at IS NULL
      ORDER BY id ASC
      FOR UPDATE
      `,
      input.ids,
    );

    if (employees.length !== input.ids.length) {
      throw new EmployeeServiceError("Sebagian pegawai tidak ditemukan atau sudah dihapus.", 404);
    }

    await connection.query(
      `
      UPDATE pegawai
      SET
        status = ?,
        updated_at = UTC_TIMESTAMP()
      WHERE id IN (${marks})
        AND deleted_at IS NULL
      `,
      [input.status, ...input.ids],
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
      ["BULK_UPDATE_EMPLOYEE_STATUS", `Mengubah status ${input.ids.length} pegawai menjadi ${input.status}. ID: ${input.ids.join(", ")}`, actorId],
    );

    await connection.commit();

    return {
      updated_count: employees.length,
      status: input.status,
      ids: input.ids,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function bulkDeleteEmployees(input: BulkDeleteInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const marks = placeholders(input.ids.length);

    // Lock pegawai agar operasi bulk konsisten.
    const employees = await connection.query<EmployeeRow[]>(
      `
      SELECT id, nip, nama_pegawai
      FROM pegawai
      WHERE id IN (${marks})
        AND deleted_at IS NULL
      ORDER BY id ASC
      FOR UPDATE
      `,
      input.ids,
    );

    if (employees.length !== input.ids.length) {
      throw new EmployeeServiceError("Sebagian pegawai tidak ditemukan atau sudah dihapus.", 404);
    }

    // Cek relasi akun pengguna.
    const linkedUsers = await connection.query<LinkedUserRow[]>(
      `
      SELECT
        u.id,
        u.id_pegawai,
        r.nama_role
      FROM user u
      JOIN user_role r
        ON r.id = u.id_role
      WHERE u.id_pegawai IN (${marks})
        AND u.deleted_at IS NULL
      ORDER BY u.id ASC
      FOR UPDATE
      `,
      input.ids,
    );

    const superadminLink = linkedUsers.find((user) => user.nama_role.toLowerCase() === "superadmin");

    if (superadminLink) {
      throw new EmployeeServiceError(`Pegawai ID ${superadminLink.id_pegawai} terhubung dengan Superadmin dan tidak dapat dihapus.`, 403);
    }

    if (linkedUsers.length > 0) {
      const linkedIds = [...new Set(linkedUsers.map((user) => user.id_pegawai))];

      throw new EmployeeServiceError(`Pegawai ID ${linkedIds.join(", ")} masih terhubung dengan akun pengguna.`, 409);
    }

    // Soft delete semua pegawai sekaligus.
    await connection.query(
      `
      UPDATE pegawai
      SET
        deleted_at = UTC_TIMESTAMP(),
        updated_at = UTC_TIMESTAMP()
      WHERE id IN (${marks})
        AND deleted_at IS NULL
      `,
      input.ids,
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
      ["BULK_DELETE_EMPLOYEE", `Menghapus ${input.ids.length} pegawai. ID: ${input.ids.join(", ")}`, actorId],
    );

    await connection.commit();

    return {
      deleted_count: employees.length,
      ids: input.ids,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
