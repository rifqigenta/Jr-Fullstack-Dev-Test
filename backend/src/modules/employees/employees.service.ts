import type { PoolConnection } from "mariadb";

import { pool } from "../../config/database.js";

import { createEmployeeSchema, type CreateEmployeeInput, type UpdateEmployeeInput } from "./employees.schema.js";

import { buildEmployeeQuery, jakartaToday, type EmployeeListQuery } from "./employees-query.js";

export type { EmployeeListQuery } from "./employees-query.js";

export class EmployeeServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "EmployeeServiceError";
  }
}

type CountRow = {
  total: number | bigint;
};

type EducationRow = {
  id: number;
  tingkat_pendidikan: string;
  nama_sekolah: string;
  tahun_lulus: number;
};

type EmployeeRow = {
  id: number;
  foto_pegawai: string | null;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string;
  tempat_lahir: string;
  tanggal_lahir: Date | string;
  jenis_kelamin: "Laki-laki" | "Perempuan" | null;
  id_kecamatan: number;
  alamat_lengkap: string;
  jarak_rumah_kantor: number | string;
  status_kawin: "kawin" | "tidak kawin";
  jumlah_anak: number;
  tanggal_masuk: Date | string;
  id_jabatan: number;
  id_departemen: number;
  status: "Aktif" | "Nonaktif";
  status_kontrak: "PKWTT" | "PKWT" | "Magang";
  usia: number | null;
  created_at: Date | string;
  updated_at: Date | string | null;
};

function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }

  return String(value).slice(0, 10);
}

function calculateAge(birthDate: string): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = jakartaToday().split("-").map(Number);

  let age = currentYear! - year!;

  if (currentMonth! < month! || (currentMonth === month && currentDay! < day!)) {
    age--;
  }

  return age;
}

function normalizeEmployee<T extends EmployeeRow>(employee: T) {
  const birthDate = toDateString(employee.tanggal_lahir);

  return {
    ...employee,
    tanggal_lahir: birthDate,
    tanggal_masuk: toDateString(employee.tanggal_masuk),
    jarak_rumah_kantor: Number(employee.jarak_rumah_kantor),
    jumlah_anak: Number(employee.jumlah_anak),
    usia: calculateAge(birthDate),
  };
}

function isDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === 1062;
}

async function recordActivity(connection: PoolConnection, title: string, content: string, actorId: number) {
  await connection.query(
    `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
    `,
    [title, content, actorId],
  );
}

async function validateReferences(connection: PoolConnection, input: CreateEmployeeInput) {
  const positions = await connection.query<{ id: number }[]>(
    `
      SELECT id
      FROM master_data
      WHERE id = ? AND tipe = 'jabatan'
      LIMIT 1
    `,
    [input.id_jabatan],
  );

  if (!positions.length) {
    throw new EmployeeServiceError("Jabatan tidak ditemukan.", 404);
  }

  const departments = await connection.query<{ id: number }[]>(
    `
      SELECT id
      FROM master_data
      WHERE id = ? AND tipe = 'departemen'
      LIMIT 1
    `,
    [input.id_departemen],
  );

  if (!departments.length) {
    throw new EmployeeServiceError("Departemen tidak ditemukan.", 404);
  }

  const regions = await connection.query<{ id: number }[]>(
    `
      SELECT id
      FROM master_wilayah
      WHERE id = ?
      LIMIT 1
    `,
    [input.id_kecamatan],
  );

  if (!regions.length) {
    throw new EmployeeServiceError("Kecamatan tidak ditemukan.", 404);
  }
}

async function validateUniqueness(connection: PoolConnection, input: CreateEmployeeInput, employeeId?: number) {
  const params: Array<string | number> = [input.nip, input.email];

  let excludeSql = "";

  if (employeeId !== undefined) {
    excludeSql = "AND id <> ?";
    params.push(employeeId);
  }

  const rows = await connection.query<{ id: number }[]>(
    `
      SELECT id
      FROM pegawai
      WHERE (nip = ? OR email = ?)
      ${excludeSql}
      LIMIT 1
    `,
    params,
  );

  if (rows.length) {
    throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
  }
}

async function insertEducation(connection: PoolConnection, employeeId: number, education: CreateEmployeeInput["pendidikan"]) {
  for (const item of education) {
    await connection.query(
      `
        INSERT INTO pegawai_pendidikan (
          id_pegawai,
          tingkat_pendidikan,
          nama_sekolah,
          tahun_lulus
        )
        VALUES (?, ?, ?, ?)
      `,
      [employeeId, item.tingkat_pendidikan, item.nama_sekolah, item.tahun_lulus],
    );
  }
}

const writableColumns = [
  "nip",
  "nama_pegawai",
  "email",
  "nomor_hp",
  "tempat_lahir",
  "tanggal_lahir",
  "jenis_kelamin",
  "id_kecamatan",
  "alamat_lengkap",
  "jarak_rumah_kantor",
  "status_kawin",
  "jumlah_anak",
  "tanggal_masuk",
  "id_jabatan",
  "id_departemen",
  "status",
  "status_kontrak",
] as const;

function employeeValues(input: CreateEmployeeInput) {
  return [...writableColumns.map((column) => input[column]), calculateAge(input.tanggal_lahir)];
}

export async function getEmployees(query: EmployeeListQuery) {
  const { whereSql, orderSql, tenureSql, params } = buildEmployeeQuery(query);

  const counts = await pool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM pegawai p
      LEFT JOIN master_data j ON j.id = p.id_jabatan
      ${whereSql}
    `,
    params,
  );

  const total = Number(counts[0]?.total ?? 0);
  const offset = (query.page - 1) * query.limit;

  const rows = await pool.query<
    Array<
      EmployeeRow & {
        nama_jabatan: string | null;
        nama_departemen: string | null;
        masa_kerja: number;
      }
    >
  >(
    `
      SELECT
        p.*,
        j.nama AS nama_jabatan,
        d.nama AS nama_departemen,
        ${tenureSql} AS masa_kerja
      FROM pegawai p
      LEFT JOIN master_data j ON j.id = p.id_jabatan
      LEFT JOIN master_data d ON d.id = p.id_departemen
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  return {
    employees: rows.map((row) => {
      return {
        id: row.id,
        nip: row.nip,
        nama_pegawai: row.nama_pegawai,
        email: row.email,
        nomor_hp: row.nomor_hp,
        tanggal_masuk: toDateString(row.tanggal_masuk),
        status: row.status,
        status_kontrak: row.status_kontrak,
        id_jabatan: row.id_jabatan,
        nama_jabatan: row.nama_jabatan,
        id_departemen: row.id_departemen,
        nama_departemen: row.nama_departemen,
        masa_kerja: Number(row.masa_kerja),
        created_at: row.created_at,
      };
    }),

    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getEmployeeById(id: number) {
  const rows = await pool.query<
    Array<
      EmployeeRow & {
        kecamatan: string | null;
        kabupaten: string | null;
        provinsi: string | null;
        nama_jabatan: string | null;
        nama_departemen: string | null;
      }
    >
  >(
    `
      SELECT
        p.id,
        p.foto_pegawai,
        p.nip,
        p.nama_pegawai,
        p.email,
        p.nomor_hp,
        p.tempat_lahir,
        p.tanggal_lahir,
        p.jenis_kelamin,
        p.id_kecamatan,
        p.alamat_lengkap,
        p.jarak_rumah_kantor,
        p.status_kawin,
        p.jumlah_anak,
        p.tanggal_masuk,
        p.id_jabatan,
        p.id_departemen,
        p.status,
        p.status_kontrak,
        p.usia,
        p.created_at,
        p.updated_at,
        w.kecamatan,
        w.kabupaten,
        w.provinsi,
        j.nama AS nama_jabatan,
        d.nama AS nama_departemen
      FROM pegawai p
      LEFT JOIN master_wilayah w ON w.id = p.id_kecamatan
      LEFT JOIN master_data j ON j.id = p.id_jabatan
      LEFT JOIN master_data d ON d.id = p.id_departemen
      WHERE p.id = ? AND p.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  const employee = rows[0];

  if (!employee) return null;

  const education = await pool.query<EducationRow[]>(
    `
      SELECT
        id,
        tingkat_pendidikan,
        nama_sekolah,
        tahun_lulus
      FROM pegawai_pendidikan
      WHERE id_pegawai = ?
      ORDER BY tahun_lulus DESC, id DESC
    `,
    [id],
  );

  return {
    ...normalizeEmployee(employee),
    pendidikan: education.map((item) => ({
      ...item,
      tahun_lulus: Number(item.tahun_lulus),
    })),
  };
}

export async function createEmployee(input: CreateEmployeeInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await validateReferences(connection, input);
    await validateUniqueness(connection, input);

    const columns = [...writableColumns, "usia"];
    const placeholders = columns.map(() => "?").join(", ");

    const result = await connection.query(
      `
        INSERT INTO pegawai (${columns.join(", ")})
        VALUES (${placeholders})
      `,
      employeeValues(input),
    );

    const employeeId = Number(result.insertId);

    await insertEducation(connection, employeeId, input.pendidikan);

    await recordActivity(connection, "CREATE_EMPLOYEE", `Membuat pegawai ${input.nama_pegawai} (ID: ${employeeId}, NIP: ${input.nip})`, actorId);

    await connection.commit();

    return {
      id: employeeId,
      ...input,
      usia: calculateAge(input.tanggal_lahir),
    };
  } catch (error) {
    await connection.rollback();

    if (isDuplicateError(error)) {
      throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function updateEmployee(id: number, input: UpdateEmployeeInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<EmployeeRow[]>(
      `
        SELECT *
        FROM pegawai
        WHERE id = ? AND deleted_at IS NULL
        FOR UPDATE
      `,
      [id],
    );

    const existing = rows[0];

    if (!existing) {
      throw new EmployeeServiceError("Pegawai tidak ditemukan.", 404);
    }

    const education = await connection.query<EducationRow[]>(
      `
        SELECT
          id,
          tingkat_pendidikan,
          nama_sekolah,
          tahun_lulus
        FROM pegawai_pendidikan
        WHERE id_pegawai = ?
        ORDER BY id ASC
      `,
      [id],
    );

    const normalized = normalizeEmployee(existing);

    const existingFields = Object.fromEntries(writableColumns.map((column) => [column, normalized[column]]));

    const parsed = createEmployeeSchema.safeParse({
      ...existingFields,
      ...input,
      pendidikan:
        input.pendidikan ??
        education.map((item) => ({
          tingkat_pendidikan: item.tingkat_pendidikan,
          nama_sekolah: item.nama_sekolah,
          tahun_lulus: Number(item.tahun_lulus),
        })),
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];

      throw new EmployeeServiceError(firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Data pegawai setelah update tidak valid.", 400);
    }

    const data = parsed.data;

    await validateReferences(connection, data);
    await validateUniqueness(connection, data, id);

    const assignments = [...writableColumns.map((column) => `${column} = ?`), "usia = ?", "updated_at = CURRENT_TIMESTAMP()"];

    await connection.query(
      `
        UPDATE pegawai
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      [...employeeValues(data), id],
    );

    if (input.pendidikan !== undefined) {
      await connection.query("DELETE FROM pegawai_pendidikan WHERE id_pegawai = ?", [id]);

      await insertEducation(connection, id, data.pendidikan);
    }

    await recordActivity(connection, "UPDATE_EMPLOYEE", `Memperbarui pegawai ${data.nama_pegawai} (ID: ${id}, NIP: ${data.nip})`, actorId);

    await connection.commit();

    return {
      id,
      ...data,
      usia: calculateAge(data.tanggal_lahir),
    };
  } catch (error) {
    await connection.rollback();

    if (isDuplicateError(error)) {
      throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteEmployee(employeeId: number, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const employees = await connection.query<
      Array<{
        id: number;
        nip: string;
        nama_pegawai: string;
      }>
    >(
      `
        SELECT id, nip, nama_pegawai
        FROM pegawai
        WHERE id = ? AND deleted_at IS NULL
        FOR UPDATE
      `,
      [employeeId],
    );

    const employee = employees[0];

    if (!employee) {
      throw new EmployeeServiceError("Pegawai tidak ditemukan.", 404);
    }

    const linkedUsers = await connection.query<Array<{ id: number; nama_role: string }>>(
      `
        SELECT u.id, r.nama_role
        FROM user u
        JOIN user_role r ON r.id = u.id_role
        WHERE u.id_pegawai = ?
          AND u.deleted_at IS NULL
        FOR UPDATE
      `,
      [employeeId],
    );

    if (linkedUsers.some((user) => user.nama_role.trim().toLowerCase() === "superadmin")) {
      throw new EmployeeServiceError("Pegawai yang terhubung dengan Superadmin tidak dapat dihapus.", 403);
    }

    if (linkedUsers.length > 0) {
      throw new EmployeeServiceError("Pegawai masih terhubung dengan akun pengguna. Hapus atau lepaskan akun terlebih dahulu.", 409);
    }

    await connection.query(
      `
        UPDATE pegawai
        SET
          deleted_at = UTC_TIMESTAMP(),
          updated_at = CURRENT_TIMESTAMP()
        WHERE id = ? AND deleted_at IS NULL
      `,
      [employeeId],
    );

    await recordActivity(connection, "DELETE_EMPLOYEE", `Menghapus pegawai ${employee.nama_pegawai} (ID: ${employeeId}, NIP: ${employee.nip})`, actorId);

    await connection.commit();

    return {
      id: employeeId,
      nip: employee.nip,
      nama_pegawai: employee.nama_pegawai,
      deleted: true,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
