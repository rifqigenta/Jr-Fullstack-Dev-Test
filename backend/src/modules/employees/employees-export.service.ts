import { pool } from "../../config/database.js";

import { EmployeeServiceError } from "./employees.service.js";

import { buildEmployeeQuery, type EmployeeExportQuery } from "./employees-query.js";

export type ExportEmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  email: string;
  nomor_hp: string | null;
  nama_jabatan: string | null;
  nama_departemen: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  tanggal_masuk: Date | string;
  masa_kerja: number;
  status: string;
  status_kontrak: string | null;
};

type CountRow = {
  total: number | bigint;
};

const MAX_EXPORT_ROWS = 10_000;

function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }

  return String(value).slice(0, 10);
}

export async function getEmployeesForExport(query: EmployeeExportQuery): Promise<ExportEmployeeRow[]> {
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

  if (total > MAX_EXPORT_ROWS) {
    throw new EmployeeServiceError(`Export maksimal ${MAX_EXPORT_ROWS} pegawai. Gunakan filter untuk memperkecil hasil.`, 400);
  }

  const rows = await pool.query<ExportEmployeeRow[]>(
    `
      SELECT
        p.id,
        p.nip,
        p.nama_pegawai,
        p.email,
        p.nomor_hp,
        j.nama AS nama_jabatan,
        d.nama AS nama_departemen,
        w.kecamatan,
        w.kabupaten,
        w.provinsi,
        p.tanggal_masuk,
        ${tenureSql} AS masa_kerja,
        p.status,
        p.status_kontrak
      FROM pegawai p
      LEFT JOIN master_data j ON j.id = p.id_jabatan
      LEFT JOIN master_data d ON d.id = p.id_departemen
      LEFT JOIN master_wilayah w ON w.id = p.id_kecamatan
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ?
    `,
    [...params, MAX_EXPORT_ROWS + 1],
  );

  if (rows.length > MAX_EXPORT_ROWS) {
    throw new EmployeeServiceError(`Export maksimal ${MAX_EXPORT_ROWS} pegawai. Gunakan filter untuk memperkecil hasil.`, 400);
  }

  return rows.map((row) => ({
    ...row,
    tanggal_masuk: toDateString(row.tanggal_masuk),
    masa_kerja: Number(row.masa_kerja),
  }));
}
