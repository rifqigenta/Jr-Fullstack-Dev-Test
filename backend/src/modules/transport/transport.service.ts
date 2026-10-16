import { pool } from "../../config/database.js";

import type { CreateSettingInput, UpdateSettingInput, AttendanceInput, CalculateInput, HistoryQuery } from "./transport.schema.js";
import { calculateTransportAmount } from "./transport-calculator.js";

export class TransportError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

type SettingRow = {
  id: number;
  base_fare: string | number;
  berlaku_mulai: Date | string;
  minimum_km: number;
  maximum_km: number;
};

type EmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  status_kontrak: string | null;
  jarak_rumah_kantor: string | number;
  jumlah_hari_masuk: number;
};

type CountRow = {
  total: number | bigint;
};

function isDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === 1062;
}

function formatDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function calculateAmount(employee: EmployeeRow, setting: SettingRow) {
  const distance = Number(employee.jarak_rumah_kantor);
  const days = Number(employee.jumlah_hari_masuk);
  const fare = Number(setting.base_fare);

  // Aturan technical test: <= 5 km tidak mendapat tunjangan.
  // > 25 km dihitung maksimal 25 km.
  const cappedDistance = Math.min(distance, 25);
  const roundedDistance = Math.floor(cappedDistance + 0.5);

  const eligibleDistance = distance > 5;

  const eligibleAttendance = employee.status_kontrak !== "PKWTT" || days >= 19;

  const eligibleContract = employee.status_kontrak === "PKWTT" || employee.status_kontrak === "PKWT" || employee.status_kontrak === "Magang";

  const countedDistance = eligibleDistance ? roundedDistance : 0;

  const amount = eligibleDistance && eligibleAttendance && eligibleContract ? Math.round(fare * countedDistance * days * 100) / 100 : 0;

  return {
    jarak_asli_km: distance,
    jarak_dihitung_km: countedDistance,
    jumlah_hari_masuk: days,
    base_fare: fare,
    nominal: amount,
  };
}

// --------------------------------------------------
// TRANSPORT SETTINGS
// --------------------------------------------------

export async function listTransportSettings() {
  const rows = await pool.query<SettingRow[]>(
    `
    SELECT
      id,
      base_fare,
      berlaku_mulai,
      minimum_km,
      maximum_km
    FROM tunjangan_transport_setting
    ORDER BY berlaku_mulai DESC, id DESC
    `,
  );

  return rows.map((row) => ({
    ...row,
    base_fare: Number(row.base_fare),
    berlaku_mulai: formatDate(row.berlaku_mulai),
  }));
}

export async function createTransportSetting(input: CreateSettingInput, actorId: number) {
  // Requirement menetapkan ambang 5 km dan batas 25 km.
  if (input.minimum_km !== 5 || input.maximum_km !== 25) {
    throw new TransportError("Minimum harus 5 km dan maksimum harus 25 km.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await connection.query(
      `
      INSERT INTO tunjangan_transport_setting (
        base_fare,
        berlaku_mulai,
        minimum_km,
        maximum_km
      )
      VALUES (?, ?, ?, ?)
      `,
      [input.base_fare, input.berlaku_mulai, input.minimum_km, input.maximum_km],
    );

    const id = Number(result.insertId);

    await connection.query(
      `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["CREATE_TRANSPORT_SETTING", `Membuat tarif transport ID ${id}, Rp${input.base_fare}/km, berlaku ${input.berlaku_mulai}`, actorId],
    );

    await connection.commit();

    return { id, ...input };
  } catch (error) {
    await connection.rollback();

    if (isDuplicateError(error)) {
      throw new TransportError("Tanggal efektif tarif sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function updateTransportSetting(id: number, input: UpdateSettingInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<SettingRow[]>(
      `
      SELECT *
      FROM tunjangan_transport_setting
      WHERE id = ?
      FOR UPDATE
      `,
      [id],
    );

    const existing = rows[0];

    if (!existing) {
      throw new TransportError("Pengaturan tarif tidak ditemukan.", 404);
    }

    const merged = {
      base_fare: input.base_fare ?? Number(existing.base_fare),
      berlaku_mulai: input.berlaku_mulai ?? formatDate(existing.berlaku_mulai),
      minimum_km: input.minimum_km ?? existing.minimum_km,
      maximum_km: input.maximum_km ?? existing.maximum_km,
    };

    if (merged.minimum_km !== 5 || merged.maximum_km !== 25) {
      throw new TransportError("Minimum harus 5 km dan maksimum harus 25 km.");
    }

    await connection.query(
      `
      UPDATE tunjangan_transport_setting
      SET
        base_fare = ?,
        berlaku_mulai = ?,
        minimum_km = ?,
        maximum_km = ?,
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
      `,
      [merged.base_fare, merged.berlaku_mulai, merged.minimum_km, merged.maximum_km, id],
    );

    await connection.query(
      `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["UPDATE_TRANSPORT_SETTING", `Memperbarui pengaturan tarif transport ID ${id}`, actorId],
    );

    await connection.commit();

    return { id, ...merged };
  } catch (error) {
    await connection.rollback();

    if (isDuplicateError(error)) {
      throw new TransportError("Tanggal efektif tarif sudah digunakan.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteTransportSetting(id: number, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const rows = await connection.query<SettingRow[]>(
      `
      SELECT *
      FROM tunjangan_transport_setting
      WHERE id = ?
      FOR UPDATE
      `,
      [id],
    );

    if (!rows.length) {
      throw new TransportError("Pengaturan tarif tidak ditemukan.", 404);
    }

    await connection.query(
      `
      DELETE FROM tunjangan_transport_setting
      WHERE id = ?
      `,
      [id],
    );

    await connection.query(
      `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["DELETE_TRANSPORT_SETTING", `Menghapus pengaturan tarif transport ID ${id}`, actorId],
    );

    await connection.commit();

    return { id, deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// --------------------------------------------------
// ATTENDANCE
// --------------------------------------------------

export async function saveMonthlyAttendance(input: AttendanceInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const employees = await connection.query<{ id: number }[]>(
      `
      SELECT id
      FROM pegawai
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [input.id_pegawai],
    );

    if (!employees.length) {
      throw new TransportError("Pegawai tidak ditemukan.", 404);
    }

    const daysInMonth = new Date(Date.UTC(input.tahun, input.bulan, 0)).getUTCDate();

    if (input.jumlah_hari_masuk > daysInMonth) {
      throw new TransportError(`Jumlah hari masuk tidak boleh melebihi ${daysInMonth} hari.`);
    }

    await connection.query(
      `
      INSERT INTO pegawai_kehadiran_bulanan (
        id_pegawai,
        tahun,
        bulan,
        jumlah_hari_masuk
      )
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        jumlah_hari_masuk = VALUES(jumlah_hari_masuk),
        updated_at = CURRENT_TIMESTAMP()
      `,
      [input.id_pegawai, input.tahun, input.bulan, input.jumlah_hari_masuk],
    );

    await connection.query(
      `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["UPSERT_EMPLOYEE_ATTENDANCE", `Menyimpan kehadiran pegawai ID ${input.id_pegawai}, ${input.bulan}/${input.tahun}: ${input.jumlah_hari_masuk} hari`, actorId],
    );

    await connection.commit();

    return input;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// --------------------------------------------------
// CALCULATE MONTHLY ALLOWANCE
// --------------------------------------------------

export async function calculateMonthlyTransport(input: CalculateInput, actorId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const monthEnd = `${input.tahun}-${String(input.bulan).padStart(2, "0")}-` + String(new Date(Date.UTC(input.tahun, input.bulan, 0)).getUTCDate()).padStart(2, "0");

    const settings = await connection.query<SettingRow[]>(
      `
      SELECT *
      FROM tunjangan_transport_setting
      WHERE berlaku_mulai <= ?
      ORDER BY berlaku_mulai DESC, id DESC
      LIMIT 1
      `,
      [monthEnd],
    );

    const setting = settings[0];

    if (!setting) {
      throw new TransportError("Tarif transport untuk periode tersebut belum tersedia.", 404);
    }

    const employees = await connection.query<EmployeeRow[]>(
      `
      SELECT
        p.id,
        p.nip,
        p.nama_pegawai,
        p.status_kontrak,
        p.jarak_rumah_kantor,
        k.jumlah_hari_masuk
      FROM pegawai_kehadiran_bulanan k
      JOIN pegawai p
        ON p.id = k.id_pegawai
      WHERE k.tahun = ?
        AND k.bulan = ?
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC
      FOR UPDATE
      `,
      [input.tahun, input.bulan],
    );

    if (!employees.length) {
      throw new TransportError("Belum ada data kehadiran pada periode ini.", 404);
    }

    let totalNominal = 0;

    for (const employee of employees) {
      const result = calculateTransportAmount({
        distanceKm: Number(employee.jarak_rumah_kantor),
        attendanceDays: Number(employee.jumlah_hari_masuk),
        baseFare: Number(setting.base_fare),
        contractStatus: employee.status_kontrak,
      });

      await connection.query(
        `
        INSERT INTO tunjangan_transport_detail (
          id_pegawai,
          tahun,
          bulan,
          jarak_asli_km,
          jarak_dihitung_km,
          jumlah_hari_masuk,
          base_fare,
          nominal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          jarak_asli_km = VALUES(jarak_asli_km),
          jarak_dihitung_km = VALUES(jarak_dihitung_km),
          jumlah_hari_masuk = VALUES(jumlah_hari_masuk),
          base_fare = VALUES(base_fare),
          nominal = VALUES(nominal),
          calculated_at = CURRENT_TIMESTAMP()
        `,
        [employee.id, input.tahun, input.bulan, result.jarak_asli_km, result.jarak_dihitung_km, result.jumlah_hari_masuk, result.base_fare, result.nominal],
      );

      totalNominal += result.nominal;
    }

    await connection.query(
      `
      INSERT INTO activities (title, content, created_by)
      VALUES (?, ?, ?)
      `,
      ["CALCULATE_TRANSPORT_ALLOWANCE", `Menghitung tunjangan transport ${input.bulan}/${input.tahun} untuk ${employees.length} pegawai`, actorId],
    );

    await connection.commit();

    return {
      tahun: input.tahun,
      bulan: input.bulan,
      setting_id: setting.id,
      base_fare: Number(setting.base_fare),
      calculated_count: employees.length,
      total_nominal: Math.round(totalNominal * 100) / 100,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// --------------------------------------------------
// OWN ALLOWANCE
// --------------------------------------------------

export async function getMyTransportAllowance(userId: number, tahun: number, bulan: number) {
  const users = await pool.query<{ id_pegawai: number | null }[]>(
    `
    SELECT id_pegawai
    FROM user
    WHERE id = ?
      AND deleted_at IS NULL
      AND disabled = 0
    LIMIT 1
    `,
    [userId],
  );

  const employeeId = users[0]?.id_pegawai;

  if (!employeeId) {
    throw new TransportError("Akun belum terhubung dengan data pegawai.", 404);
  }

  const rows = await pool.query(
    `
    SELECT
      t.id,
      t.tahun,
      t.bulan,
      t.jarak_asli_km,
      t.jarak_dihitung_km,
      t.jumlah_hari_masuk,
      t.base_fare,
      t.nominal,
      t.calculated_at,
      p.nip,
      p.nama_pegawai
    FROM tunjangan_transport_detail t
    JOIN pegawai p
      ON p.id = t.id_pegawai
    WHERE t.id_pegawai = ?
      AND t.tahun = ?
      AND t.bulan = ?
      AND p.deleted_at IS NULL
    LIMIT 1
    `,
    [employeeId, tahun, bulan],
  );

  return rows[0] ?? null;
}

// --------------------------------------------------
// HISTORY
// --------------------------------------------------

export async function getTransportHistory(query: HistoryQuery) {
  const conditions = ["t.tahun = ?", "t.bulan = ?", "p.deleted_at IS NULL"];

  const params: Array<string | number> = [query.tahun, query.bulan];

  if (query.search) {
    conditions.push("(p.nama_pegawai LIKE ? OR p.nip LIKE ?)");

    const keyword = `%${query.search}%`;
    params.push(keyword, keyword);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const counts = await pool.query<CountRow[]>(
    `
    SELECT COUNT(*) AS total
    FROM tunjangan_transport_detail t
    JOIN pegawai p ON p.id = t.id_pegawai
    ${where}
    `,
    params,
  );

  const total = Number(counts[0]?.total ?? 0);
  const offset = (query.page - 1) * query.limit;

  const rows = await pool.query(
    `
    SELECT
      t.id,
      t.tahun,
      t.bulan,
      t.jarak_asli_km,
      t.jarak_dihitung_km,
      t.jumlah_hari_masuk,
      t.base_fare,
      t.nominal,
      t.calculated_at,
      p.id AS id_pegawai,
      p.nip,
      p.nama_pegawai,
      p.status_kontrak
    FROM tunjangan_transport_detail t
    JOIN pegawai p ON p.id = t.id_pegawai
    ${where}
    ORDER BY p.nama_pegawai ASC, t.id ASC
    LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  return {
    rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
