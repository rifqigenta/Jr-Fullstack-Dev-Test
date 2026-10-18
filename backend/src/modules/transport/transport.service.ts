import type { PoolConnection } from "mariadb";

import { pool } from "../../config/database.js";

import { createSettingSchema, type CreateSettingInput, type UpdateSettingInput, type AttendanceInput, type CalculateInput, type HistoryQuery } from "./transport.schema.js";

import { calculateTransportAmount } from "./transport-calculator.js";

export class TransportError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TransportError";
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
  status_kontrak: string | null;
  jarak_rumah_kantor: string | number;
  jumlah_hari_masuk: number;
};

type DetailRow = {
  id: number;
  id_pegawai: number;
  tahun: number;
  bulan: number;
  jarak_asli_km: number | string;
  jarak_dihitung_km: number | string;
  jumlah_hari_masuk: number | string;
  base_fare: number | string;
  nominal: number | string;
  calculated_at: Date | string;
  nip: string;
  nama_pegawai: string;
  status_kontrak: string | null;
};

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }

  return String(value).slice(0, 10);
}

function normalizeDetail(row: DetailRow) {
  return {
    ...row,
    jarak_asli_km: Number(row.jarak_asli_km),
    jarak_dihitung_km: Number(row.jarak_dihitung_km),
    jumlah_hari_masuk: Number(row.jumlah_hari_masuk),
    base_fare: Number(row.base_fare),
    nominal: Number(row.nominal),
  };
}

function normalizeSetting(row: SettingRow) {
  return {
    ...row,
    base_fare: Number(row.base_fare),
    minimum_km: Number(row.minimum_km),
    maximum_km: Number(row.maximum_km),
    berlaku_mulai: formatDate(row.berlaku_mulai),
  };
}

async function transaction<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await action(connection);

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();

    if (typeof error === "object" && error !== null && "errno" in error) {
      if (error.errno === 1062) {
        throw new TransportError("Data atau tanggal efektif sudah digunakan.", 409);
      }

      if (error.errno === 1451) {
        throw new TransportError("Data masih digunakan oleh data lainnya.", 409);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
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

async function ownEmployeeId(userId: number): Promise<number> {
  const rows = await pool.query<Array<{ id_pegawai: number }>>(
    `
      SELECT u.id_pegawai
      FROM \`user\` u
      JOIN pegawai p ON p.id = u.id_pegawai
      WHERE u.id = ?
        AND u.disabled = 0
        AND u.deleted_at IS NULL
        AND p.deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  if (!rows[0]?.id_pegawai) {
    throw new TransportError("Akun belum terhubung dengan data pegawai aktif dalam sistem.", 404);
  }

  return rows[0].id_pegawai;
}

export async function listTransportSettings() {
  const rows = await pool.query<SettingRow[]>(
    `
      SELECT id, base_fare, berlaku_mulai, minimum_km, maximum_km
      FROM tunjangan_transport_setting
      ORDER BY berlaku_mulai DESC, id DESC
    `,
  );

  return rows.map(normalizeSetting);
}

export async function createTransportSetting(input: CreateSettingInput, actorId: number) {
  const parsed = createSettingSchema.safeParse(input);

  if (!parsed.success) {
    throw new TransportError("Pengaturan tarif tidak valid.");
  }

  return transaction(async (connection) => {
    const result = await connection.query(
      `
        INSERT INTO tunjangan_transport_setting (
          base_fare, berlaku_mulai, minimum_km, maximum_km
        )
        VALUES (?, ?, ?, ?)
      `,
      [input.base_fare, input.berlaku_mulai, input.minimum_km, input.maximum_km],
    );

    const id = Number(result.insertId);

    await log(connection, "CREATE_TRANSPORT_SETTING", `Membuat tarif transport ID ${id}, berlaku ${input.berlaku_mulai}`, actorId);

    return { id, ...input };
  });
}

export async function updateTransportSetting(id: number, input: UpdateSettingInput, actorId: number) {
  return transaction(async (connection) => {
    const rows = await connection.query<SettingRow[]>(
      `
        SELECT *
        FROM tunjangan_transport_setting
        WHERE id = ?
        FOR UPDATE
      `,
      [id],
    );

    if (!rows[0]) {
      throw new TransportError("Pengaturan tarif tidak ditemukan.", 404);
    }

    const existing = normalizeSetting(rows[0]);

    const parsed = createSettingSchema.safeParse({
      base_fare: input.base_fare ?? existing.base_fare,
      berlaku_mulai: input.berlaku_mulai ?? existing.berlaku_mulai,
      minimum_km: input.minimum_km ?? existing.minimum_km,
      maximum_km: input.maximum_km ?? existing.maximum_km,
    });

    if (!parsed.success) {
      throw new TransportError("Pengaturan tarif tidak valid.");
    }

    const data = parsed.data;

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
      [data.base_fare, data.berlaku_mulai, data.minimum_km, data.maximum_km, id],
    );

    await log(connection, "UPDATE_TRANSPORT_SETTING", `Memperbarui tarif transport ID ${id}`, actorId);

    return { id, ...data };
  });
}

export async function deleteTransportSetting(id: number, actorId: number) {
  return transaction(async (connection) => {
    const rows = await connection.query<Array<{ id: number }>>(
      `
        SELECT id
        FROM tunjangan_transport_setting
        WHERE id = ?
        FOR UPDATE
      `,
      [id],
    );

    if (!rows.length) {
      throw new TransportError("Pengaturan tarif tidak ditemukan.", 404);
    }

    await connection.query("DELETE FROM tunjangan_transport_setting WHERE id = ?", [id]);

    await log(connection, "DELETE_TRANSPORT_SETTING", `Menghapus tarif transport ID ${id}`, actorId);

    return { id, deleted: true };
  });
}

export async function saveMonthlyAttendance(input: AttendanceInput, actorId: number) {
  return transaction(async (connection) => {
    const employees = await connection.query<Array<{ id: number }>>(
      `
        SELECT id
        FROM pegawai
        WHERE id = ? AND deleted_at IS NULL
        FOR UPDATE
      `,
      [input.id_pegawai],
    );

    if (!employees.length) {
      throw new TransportError("Pegawai tidak ditemukan.", 404);
    }

    const daysInMonth = new Date(Date.UTC(input.tahun, input.bulan, 0)).getUTCDate();

    if (!Number.isInteger(input.jumlah_hari_masuk) || input.jumlah_hari_masuk < 0 || input.jumlah_hari_masuk > daysInMonth) {
      throw new TransportError(`Jumlah hari masuk harus antara 0–${daysInMonth}.`);
    }

    await connection.query(
      `
        INSERT INTO pegawai_kehadiran_bulanan (
          id_pegawai, tahun, bulan, jumlah_hari_masuk
        )
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          jumlah_hari_masuk = VALUES(jumlah_hari_masuk),
          updated_at = CURRENT_TIMESTAMP()
      `,
      [input.id_pegawai, input.tahun, input.bulan, input.jumlah_hari_masuk],
    );

    await log(connection, "UPSERT_EMPLOYEE_ATTENDANCE", `Kehadiran pegawai ID ${input.id_pegawai}, ${input.bulan}/${input.tahun}: ${input.jumlah_hari_masuk} hari`, actorId);

    return input;
  });
}

export async function calculateMonthlyTransport(input: CalculateInput, actorId: number) {
  const connection = await pool.getConnection();
  let locked = false;
  let started = false;

  const lockExpression = `
    SHA2(
      CONCAT(DATABASE(), ':transport:', ?, ':', ?),
      256
    )
  `;

  try {
    const locks = await connection.query<Array<{ acquired: number | null }>>(`SELECT GET_LOCK(${lockExpression}, 10) AS acquired`, [input.tahun, input.bulan]);

    locked = Number(locks[0]?.acquired) === 1;

    if (!locked) {
      throw new TransportError("Periode ini sedang dihitung. Coba lagi sebentar.", 409);
    }

    await connection.beginTransaction();
    started = true;

    const daysInMonth = new Date(Date.UTC(input.tahun, input.bulan, 0)).getUTCDate();

    const monthEnd = `${input.tahun}-${String(input.bulan).padStart(2, "0")}-` + String(daysInMonth).padStart(2, "0");

    const settings = await connection.query<SettingRow[]>(
      `
        SELECT *
        FROM tunjangan_transport_setting
        WHERE berlaku_mulai <= ?
        ORDER BY berlaku_mulai DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [monthEnd],
    );

    const setting = settings[0];

    if (!setting) {
      throw new TransportError("Tarif untuk periode tersebut belum tersedia.", 404);
    }

    if (Number(setting.minimum_km) !== 5 || Number(setting.maximum_km) !== 25) {
      throw new TransportError("Perbaiki pengaturan tarif: minimum 5 km dan maksimum 25 km.");
    }

    const employees = await connection.query<EmployeeRow[]>(
      `
        SELECT
          p.id,
          p.status_kontrak,
          p.jarak_rumah_kantor,
          k.jumlah_hari_masuk
        FROM pegawai_kehadiran_bulanan k
        JOIN pegawai p ON p.id = k.id_pegawai
        WHERE k.tahun = ?
          AND k.bulan = ?
          AND p.deleted_at IS NULL
          AND p.status = 'Aktif'
          AND p.tanggal_masuk <= ?
        ORDER BY p.id ASC
        FOR UPDATE
      `,
      [input.tahun, input.bulan, monthEnd],
    );

    await connection.query(
      `
        DELETE FROM tunjangan_transport_detail
        WHERE tahun = ? AND bulan = ?
      `,
      [input.tahun, input.bulan],
    );

    let totalNominal = 0;
    let recipientCount = 0;

    for (const employee of employees) {
      const days = Number(employee.jumlah_hari_masuk);

      if (days > daysInMonth) {
        throw new TransportError(`Data kehadiran pegawai ID ${employee.id} melebihi jumlah hari dalam bulan.`);
      }

      const result = calculateTransportAmount({
        distanceKm: Number(employee.jarak_rumah_kantor),
        attendanceDays: days,
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
        `,
        [employee.id, input.tahun, input.bulan, result.jarak_asli_km, result.jarak_dihitung_km, result.jumlah_hari_masuk, result.base_fare, result.nominal],
      );

      totalNominal += result.nominal;

      if (result.nominal > 0) recipientCount++;
    }

    await log(connection, "CALCULATE_TRANSPORT_ALLOWANCE", `Menghitung ${input.bulan}/${input.tahun}: ${employees.length} pegawai diperiksa, ${recipientCount} penerima`, actorId);

    await connection.commit();
    started = false;

    return {
      tahun: input.tahun,
      bulan: input.bulan,
      setting_id: setting.id,
      base_fare: Number(setting.base_fare),
      calculated_count: employees.length,
      recipient_count: recipientCount,
      total_nominal: Math.round(totalNominal * 100) / 100,
    };
  } catch (error) {
    if (started) await connection.rollback();
    throw error;
  } finally {
    if (locked) {
      try {
        await connection.query(`SELECT RELEASE_LOCK(${lockExpression})`, [input.tahun, input.bulan]);
      } catch (error) {
        console.error("Gagal melepas lock perhitungan:", error);
      }
    }

    connection.release();
  }
}

export async function getMyTransportAllowance(userId: number, tahun: number, bulan: number) {
  const employeeId = await ownEmployeeId(userId);

  const rows = await pool.query<DetailRow[]>(
    `
      SELECT
        t.*,
        p.nip,
        p.nama_pegawai,
        p.status_kontrak
      FROM tunjangan_transport_detail t
      JOIN pegawai p ON p.id = t.id_pegawai
      WHERE t.id_pegawai = ?
        AND t.tahun = ?
        AND t.bulan = ?
        AND p.deleted_at IS NULL
      LIMIT 1
    `,
    [employeeId, tahun, bulan],
  );

  return rows[0] ? normalizeDetail(rows[0]) : null;
}

export async function getTransportMonths(userId: number, tahun: number) {
  const employeeId = await ownEmployeeId(userId);

  const rows = await pool.query<
    Array<{
      bulan: number;
      total_penerima: number | bigint;
      total_nominal: number | string;
    }>
  >(
    `
      SELECT
        bulan,
        COUNT(*) AS total_penerima,
        SUM(nominal) AS total_nominal
      FROM tunjangan_transport_detail
      WHERE tahun = ?
        AND id_pegawai = ?
        AND nominal > 0
      GROUP BY bulan
    `,
    [tahun, employeeId],
  );

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  return monthNames.map((nama_bulan, index) => {
    const row = rows.find((item) => Number(item.bulan) === index + 1);

    return {
      tahun,
      bulan: index + 1,
      nama_bulan,
      total_penerima: Number(row?.total_penerima || 0),
      total_nominal: Number(row?.total_nominal || 0),
    };
  });
}

export async function getTransportHistory(query: HistoryQuery, userId: number) {
  const employeeId = await ownEmployeeId(userId);

  const conditions = ["t.tahun = ?", "t.bulan = ?", "t.id_pegawai = ?", "t.nominal > 0", "p.deleted_at IS NULL"];

  const params: Array<string | number> = [query.tahun, query.bulan, employeeId];

  if (query.search) {
    const escaped = query.search.replace(/[=%_]/g, (character) => `=${character}`);

    conditions.push(`
      (
        p.nama_pegawai LIKE ? ESCAPE '='
        OR p.nip LIKE ? ESCAPE '='
      )
    `);

    params.push(`%${escaped}%`, `%${escaped}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const counts = await pool.query<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM tunjangan_transport_detail t
      JOIN pegawai p ON p.id = t.id_pegawai
      ${where}
    `,
    params,
  );

  const sortBy = query.sortBy;

  const sortColumn = sortBy === "km" ? "t.jarak_dihitung_km" : sortBy === "hari" ? "t.jumlah_hari_masuk" : sortBy === "nominal" ? "t.nominal" : "p.nama_pegawai";

  const direction = query.sortOrder === "desc" ? "DESC" : "ASC";

  const rows = await pool.query<DetailRow[]>(
    `
      SELECT
        t.*,
        p.nip,
        p.nama_pegawai,
        p.status_kontrak
      FROM tunjangan_transport_detail t
      JOIN pegawai p ON p.id = t.id_pegawai
      ${where}
      ORDER BY ${sortColumn} ${direction}, t.id ASC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, (query.page - 1) * query.limit],
  );

  const total = Number(counts[0]?.total || 0);

  return {
    rows: rows.map(normalizeDetail),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
