import { pool } from "../../config/database.js";
import { createEmployeeSchema, type CreateEmployeeInput, type UpdateEmployeeInput } from "./employees.schema.js";

export type EmployeeListQuery = {
  page: number;
  limit: number;
  search: string;
  status?: "Aktif" | "Nonaktif";
  status_kontrak?: "PKWTT" | "PKWT" | "Magang";
  id_jabatan?: number;
  id_departemen?: number;
  sortBy: "id" | "nama_pegawai" | "tanggal_masuk";
  sortOrder: "asc" | "desc";
};

type EmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string | null;
  tanggal_masuk: Date;
  status: "Aktif" | "Nonaktif";
  status_kontrak: "PKWTT" | "PKWT" | "Magang" | null;
  id_jabatan: number;
  nama_jabatan: string | null;
  id_departemen: number;
  nama_departemen: string | null;
  created_at: Date;
};

type CountRow = {
  total: number | bigint;
};

export async function getEmployees(query: EmployeeListQuery) {
  const { page, limit, search, status, status_kontrak, id_jabatan, id_departemen, sortBy, sortOrder } = query;

  const conditions: string[] = ["p.deleted_at IS NULL"];

  const params: Array<string | number> = [];

  if (search) {
    conditions.push(`
      (
        p.nama_pegawai LIKE ?
        OR p.nip LIKE ?
        OR p.email LIKE ?
      )
    `);

    const keyword = `%${search}%`;

    params.push(keyword, keyword, keyword);
  }

  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }

  if (status_kontrak) {
    conditions.push("p.status_kontrak = ?");
    params.push(status_kontrak);
  }

  if (id_jabatan !== undefined) {
    conditions.push("p.id_jabatan = ?");
    params.push(id_jabatan);
  }

  if (id_departemen !== undefined) {
    conditions.push("p.id_departemen = ?");
    params.push(id_departemen);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Aman karena sortBy dan sortOrder dibatasi
  // oleh Zod enum di controller.
  const sortColumns = {
    id: "p.id",
    nama_pegawai: "p.nama_pegawai",
    tanggal_masuk: "p.tanggal_masuk",
  } as const;

  const orderColumn = sortColumns[sortBy];
  const orderDirection = sortOrder.toUpperCase();

  const countRows = await pool.query<CountRow[]>(
    `
    SELECT COUNT(*) AS total
    FROM pegawai p
    ${whereClause}
    `,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  const offset = (page - 1) * limit;

  const rows = await pool.query<EmployeeRow[]>(
    `
    SELECT
      p.id,
      p.nip,
      p.nama_pegawai,
      p.email,
      p.nomor_hp,
      p.tanggal_masuk,
      p.status,
      p.status_kontrak,
      p.id_jabatan,
      j.nama AS nama_jabatan,
      p.id_departemen,
      d.nama AS nama_departemen,
      p.created_at
    FROM pegawai p
    LEFT JOIN master_data j
      ON j.id = p.id_jabatan
    LEFT JOIN master_data d
      ON d.id = p.id_departemen
    ${whereClause}
    ORDER BY ${orderColumn} ${orderDirection}, p.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  return {
    employees: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

type EmployeeDetailRow = {
  id: number;
  foto_pegawai: string | null;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string | null;

  tempat_lahir: string | null;
  tanggal_lahir: Date | string;
  usia: number | bigint | null;

  id_kecamatan: number;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  alamat_lengkap: string | null;
  jarak_rumah_kantor: number | null;

  status_kawin: "kawin" | "tidak kawin";
  jumlah_anak: number;

  tanggal_masuk: Date | string;

  id_jabatan: number;
  nama_jabatan: string | null;

  id_departemen: number;
  nama_departemen: string | null;

  status: "Aktif" | "Nonaktif";
  status_kontrak: "PKWTT" | "PKWT" | "Magang" | null;

  created_at: Date;
  updated_at: Date | null;
};

type EmployeeEducationRow = {
  id: number;
  tingkat_pendidikan: string;
  nama_sekolah: string;
  tahun_lulus: number;
};

function calculateAge(birthDate: Date | string): number {
  // Gunakan bagian tanggal saja untuk menghindari
  // pergeseran hari akibat konversi zona waktu.
  const dateString =
    birthDate instanceof Date ? [birthDate.getFullYear(), String(birthDate.getMonth() + 1).padStart(2, "0"), String(birthDate.getDate()).padStart(2, "0")].join("-") : String(birthDate).slice(0, 10);

  const [year, month, day] = dateString.split("-").map(Number);

  const today = new Date();

  // Perhitungan menggunakan tanggal kalender UTC.
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  let age = currentYear - year!;

  if (currentMonth < month! || (currentMonth === month! && currentDay < day!)) {
    age--;
  }

  return age;
}

export async function getEmployeeById(id: number) {
  const rows = await pool.query<EmployeeDetailRow[]>(
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
      p.usia,

      p.id_kecamatan,
      w.kecamatan,
      w.kabupaten,
      w.provinsi,
      p.alamat_lengkap,
      p.jarak_rumah_kantor,

      p.status_kawin,
      p.jumlah_anak,

      p.tanggal_masuk,

      p.id_jabatan,
      j.nama AS nama_jabatan,

      p.id_departemen,
      d.nama AS nama_departemen,

      p.status,
      p.status_kontrak,

      p.created_at,
      p.updated_at

    FROM pegawai p

    LEFT JOIN master_wilayah w
      ON w.id = p.id_kecamatan

    LEFT JOIN master_data j
      ON j.id = p.id_jabatan

    LEFT JOIN master_data d
      ON d.id = p.id_departemen

    WHERE p.id = ?
      AND p.deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  );

  const employee = rows[0];

  if (!employee) {
    return null;
  }

  const educationRows = await pool.query<EmployeeEducationRow[]>(
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
    ...employee,

    usia: employee.tanggal_lahir ? calculateAge(employee.tanggal_lahir) : null,

    pendidikan: educationRows,
  };
}

export class EmployeeServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

type ExistingEmployeeRow = {
  id: number;
};

type MasterReferenceRow = {
  id: number;
};

function calculateEmployeeAge(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);

  const today = new Date();

  let age = today.getUTCFullYear() - year!;

  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  if (currentMonth < month! || (currentMonth === month! && currentDay < day!)) {
    age--;
  }

  return age;
}

function isEmployeeDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === 1062;
}

export async function createEmployee(input: CreateEmployeeInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Validasi NIP dan email unik.
    const duplicates = await connection.query<ExistingEmployeeRow[]>(
      `
        SELECT id
        FROM pegawai
        WHERE nip = ?
           OR email = ?
        LIMIT 1
        `,
      [input.nip, input.email],
    );

    if (duplicates.length > 0) {
      throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
    }

    // 2. Validasi jabatan.
    const positions = await connection.query<MasterReferenceRow[]>(
      `
        SELECT id
        FROM master_data
        WHERE id = ?
          AND tipe = 'jabatan'
        LIMIT 1
        `,
      [input.id_jabatan],
    );

    if (!positions.length) {
      throw new EmployeeServiceError("Jabatan tidak ditemukan.", 404);
    }

    // 3. Validasi departemen.
    const departments = await connection.query<MasterReferenceRow[]>(
      `
        SELECT id
        FROM master_data
        WHERE id = ?
          AND tipe = 'departemen'
        LIMIT 1
        `,
      [input.id_departemen],
    );

    if (!departments.length) {
      throw new EmployeeServiceError("Departemen tidak ditemukan.", 404);
    }

    // 4. Validasi kecamatan.
    const regions = await connection.query<MasterReferenceRow[]>(
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

    // 5. Hitung usia.
    const usia = calculateEmployeeAge(input.tanggal_lahir);

    // 6. Simpan data pegawai.
    const insertResult = await connection.query(
      `
      INSERT INTO pegawai (
        foto_pegawai,
        nip,
        nama_pegawai,
        email,
        nomor_hp,
        tempat_lahir,
        id_kecamatan,
        alamat_lengkap,
        jarak_rumah_kantor,
        tanggal_lahir,
        status_kawin,
        jumlah_anak,
        tanggal_masuk,
        id_jabatan,
        id_departemen,
        usia,
        status,
        status_kontrak
      )
      VALUES (
        NULL,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
      `,
      [
        input.nip,
        input.nama_pegawai,
        input.email,
        input.nomor_hp,
        input.tempat_lahir,
        input.id_kecamatan,
        input.alamat_lengkap,
        input.jarak_rumah_kantor,
        input.tanggal_lahir,
        input.status_kawin,
        input.jumlah_anak,
        input.tanggal_masuk,
        input.id_jabatan,
        input.id_departemen,
        usia,
        input.status,
        input.status_kontrak,
      ],
    );

    const employeeId = Number(insertResult.insertId);

    // 7. Simpan riwayat pendidikan.
    for (const education of input.pendidikan) {
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
        [employeeId, education.tingkat_pendidikan, education.nama_sekolah, education.tahun_lulus],
      );
    }

    // 8. Catat aktivitas.
    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["CREATE_EMPLOYEE", `Membuat pegawai ${input.nama_pegawai} (ID: ${employeeId}, NIP: ${input.nip})`, actorId],
    );

    await connection.commit();

    return {
      id: employeeId,
      nip: input.nip,
      nama_pegawai: input.nama_pegawai,
      email: input.email,
      usia,
      status: input.status,
      status_kontrak: input.status_kontrak,
      pendidikan: input.pendidikan,
    };
  } catch (error) {
    await connection.rollback();

    if (isEmployeeDuplicateError(error)) {
      throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

type EditableEmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string;
  tempat_lahir: string;
  tanggal_lahir: Date | string;
  id_kecamatan: number;
  alamat_lengkap: string;
  jarak_rumah_kantor: number;
  status_kawin: "kawin" | "tidak kawin";
  jumlah_anak: number;
  tanggal_masuk: Date | string;
  id_jabatan: number;
  id_departemen: number;
  status: "Aktif" | "Nonaktif";
  status_kontrak: "PKWTT" | "PKWT" | "Magang";
};

type EditableEducationRow = {
  tingkat_pendidikan: string;
  nama_sekolah: string;
  tahun_lulus: number;
};

function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    return [value.getUTCFullYear(), String(value.getUTCMonth() + 1).padStart(2, "0"), String(value.getUTCDate()).padStart(2, "0")].join("-");
  }

  return String(value).slice(0, 10);
}

export async function updateEmployee(id: number, input: UpdateEmployeeInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Ambil pegawai lama dan lock row.
    const rows = await connection.query<EditableEmployeeRow[]>(
      `
      SELECT
        id,
        nip,
        nama_pegawai,
        email,
        nomor_hp,
        tempat_lahir,
        tanggal_lahir,
        id_kecamatan,
        alamat_lengkap,
        jarak_rumah_kantor,
        status_kawin,
        jumlah_anak,
        tanggal_masuk,
        id_jabatan,
        id_departemen,
        status,
        status_kontrak
      FROM pegawai
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [id],
    );

    const existing = rows[0];

    if (!existing) {
      throw new EmployeeServiceError("Pegawai tidak ditemukan.", 404);
    }

    // 2. Ambil pendidikan lama.
    const existingEducation = await connection.query<EditableEducationRow[]>(
      `
        SELECT
          tingkat_pendidikan,
          nama_sekolah,
          tahun_lulus
        FROM pegawai_pendidikan
        WHERE id_pegawai = ?
        ORDER BY id ASC
        `,
      [id],
    );

    // 3. Gabungkan data lama dengan input PATCH.
    const merged = {
      nip: input.nip ?? existing.nip,
      nama_pegawai: input.nama_pegawai ?? existing.nama_pegawai,
      email: input.email ?? existing.email,
      nomor_hp: input.nomor_hp ?? existing.nomor_hp,
      tempat_lahir: input.tempat_lahir ?? existing.tempat_lahir,
      tanggal_lahir: input.tanggal_lahir ?? toDateString(existing.tanggal_lahir),
      id_kecamatan: input.id_kecamatan ?? existing.id_kecamatan,
      alamat_lengkap: input.alamat_lengkap ?? existing.alamat_lengkap,
      jarak_rumah_kantor: input.jarak_rumah_kantor ?? existing.jarak_rumah_kantor,
      status_kawin: input.status_kawin ?? existing.status_kawin,
      jumlah_anak: input.jumlah_anak ?? existing.jumlah_anak,
      tanggal_masuk: input.tanggal_masuk ?? toDateString(existing.tanggal_masuk),
      id_jabatan: input.id_jabatan ?? existing.id_jabatan,
      id_departemen: input.id_departemen ?? existing.id_departemen,
      status: input.status ?? existing.status,
      status_kontrak: input.status_kontrak ?? existing.status_kontrak,
      pendidikan: input.pendidikan ?? existingEducation,
    };

    // 4. Validasi ulang seluruh data gabungan.
    const parsed = createEmployeeSchema.safeParse(merged);

    if (!parsed.success) {
      throw new EmployeeServiceError("Data pegawai setelah update tidak valid.", 400);
    }

    const data = parsed.data;

    // 5. Validasi NIP dan email unik.
    const duplicates = await connection.query<ExistingEmployeeRow[]>(
      `
        SELECT id
        FROM pegawai
        WHERE id <> ?
          AND (
            nip = ?
            OR email = ?
          )
        LIMIT 1
        `,
      [id, data.nip, data.email],
    );

    if (duplicates.length > 0) {
      throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
    }

    // 6. Validasi jabatan.
    const positions = await connection.query<MasterReferenceRow[]>(
      `
        SELECT id
        FROM master_data
        WHERE id = ?
          AND tipe = 'jabatan'
        LIMIT 1
        `,
      [data.id_jabatan],
    );

    if (!positions.length) {
      throw new EmployeeServiceError("Jabatan tidak ditemukan.", 404);
    }

    // 7. Validasi departemen.
    const departments = await connection.query<MasterReferenceRow[]>(
      `
        SELECT id
        FROM master_data
        WHERE id = ?
          AND tipe = 'departemen'
        LIMIT 1
        `,
      [data.id_departemen],
    );

    if (!departments.length) {
      throw new EmployeeServiceError("Departemen tidak ditemukan.", 404);
    }

    // 8. Validasi kecamatan.
    const regions = await connection.query<MasterReferenceRow[]>(
      `
        SELECT id
        FROM master_wilayah
        WHERE id = ?
        LIMIT 1
        `,
      [data.id_kecamatan],
    );

    if (!regions.length) {
      throw new EmployeeServiceError("Kecamatan tidak ditemukan.", 404);
    }

    // 9. Hitung ulang usia.
    const usia = calculateEmployeeAge(data.tanggal_lahir);

    // 10. Update data utama pegawai.
    await connection.query(
      `
      UPDATE pegawai
      SET
        nip = ?,
        nama_pegawai = ?,
        email = ?,
        nomor_hp = ?,
        tempat_lahir = ?,
        tanggal_lahir = ?,
        id_kecamatan = ?,
        alamat_lengkap = ?,
        jarak_rumah_kantor = ?,
        status_kawin = ?,
        jumlah_anak = ?,
        tanggal_masuk = ?,
        id_jabatan = ?,
        id_departemen = ?,
        usia = ?,
        status = ?,
        status_kontrak = ?,
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
      `,
      [
        data.nip,
        data.nama_pegawai,
        data.email,
        data.nomor_hp,
        data.tempat_lahir,
        data.tanggal_lahir,
        data.id_kecamatan,
        data.alamat_lengkap,
        data.jarak_rumah_kantor,
        data.status_kawin,
        data.jumlah_anak,
        data.tanggal_masuk,
        data.id_jabatan,
        data.id_departemen,
        usia,
        data.status,
        data.status_kontrak,
        id,
      ],
    );

    // 11. Replace pendidikan hanya jika dikirim.
    if (input.pendidikan !== undefined) {
      await connection.query(
        `
        DELETE FROM pegawai_pendidikan
        WHERE id_pegawai = ?
        `,
        [id],
      );

      for (const education of data.pendidikan) {
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
          [id, education.tingkat_pendidikan, education.nama_sekolah, education.tahun_lulus],
        );
      }
    }

    // 12. Catat activity log.
    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["UPDATE_EMPLOYEE", `Memperbarui pegawai ${data.nama_pegawai} (ID: ${id}, NIP: ${data.nip})`, actorId],
    );

    await connection.commit();

    return {
      id,
      nip: data.nip,
      nama_pegawai: data.nama_pegawai,
      email: data.email,
      usia,
      status: data.status,
      status_kontrak: data.status_kontrak,
      pendidikan: data.pendidikan,
    };
  } catch (error) {
    await connection.rollback();

    if (isEmployeeDuplicateError(error)) {
      throw new EmployeeServiceError("NIP atau email sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

type EmployeeDeleteRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
};

type LinkedUserRow = {
  id: number;
  nama_role: string;
};

export async function deleteEmployee(employeeId: number, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Ambil pegawai dan lock row.
    const employees = await connection.query<EmployeeDeleteRow[]>(
      `
        SELECT
          id,
          nip,
          nama_pegawai
        FROM pegawai
        WHERE id = ?
          AND deleted_at IS NULL
        FOR UPDATE
        `,
      [employeeId],
    );

    const employee = employees[0];

    if (!employee) {
      throw new EmployeeServiceError("Pegawai tidak ditemukan.", 404);
    }

    // 2. Cek relasi pegawai dengan akun pengguna.
    const linkedUsers = await connection.query<LinkedUserRow[]>(
      `
        SELECT
          u.id,
          r.nama_role
        FROM user u
        JOIN user_role r
          ON r.id = u.id_role
        WHERE u.id_pegawai = ?
          AND u.deleted_at IS NULL
        FOR UPDATE
        `,
      [employeeId],
    );

    // 3. Proteksi pegawai yang terhubung Superadmin.
    const hasSuperadmin = linkedUsers.some((user) => user.nama_role.toLowerCase() === "superadmin");

    if (hasSuperadmin) {
      throw new EmployeeServiceError("Pegawai yang terhubung dengan Superadmin tidak dapat dihapus.", 403);
    }

    // 4. Proteksi akun aktif lainnya.
    if (linkedUsers.length > 0) {
      throw new EmployeeServiceError("Pegawai masih terhubung dengan akun pengguna. Hapus atau lepaskan akun terlebih dahulu.", 409);
    }

    // 5. Soft delete pegawai.
    await connection.query(
      `
      UPDATE pegawai
      SET
        deleted_at = UTC_TIMESTAMP(),
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [employeeId],
    );

    // 6. Catat aktivitas.
    await connection.query(
      `
      INSERT INTO activities (
        title,
        content,
        created_by
      )
      VALUES (?, ?, ?)
      `,
      ["DELETE_EMPLOYEE", `Menghapus pegawai ${employee.nama_pegawai} (ID: ${employeeId}, NIP: ${employee.nip})`, actorId],
    );

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
