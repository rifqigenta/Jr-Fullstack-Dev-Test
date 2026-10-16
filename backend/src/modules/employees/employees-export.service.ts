import { pool } from "../../config/database.js";

import { EmployeeServiceError } from "./employees.service.js";

import type { EmployeeExportQuery } from "./employees-bulk.schema.js";

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
  status: string;
  status_kontrak: string | null;
};

type CountRow = {
  total: number | bigint;
};

const MAX_EXPORT_ROWS = 10_000;

export async function getEmployeesForExport(query: EmployeeExportQuery): Promise<ExportEmployeeRow[]> {
  const conditions: string[] = ["p.deleted_at IS NULL"];

  const params: Array<string | number> = [];

  if (query.search) {
    const keyword = `%${query.search}%`;

    conditions.push("(p.nama_pegawai LIKE ? OR p.nip LIKE ? OR p.email LIKE ?)");

    params.push(keyword, keyword, keyword);
  }

  if (query.status) {
    conditions.push("p.status = ?");
    params.push(query.status);
  }

  if (query.status_kontrak) {
    conditions.push("p.status_kontrak = ?");
    params.push(query.status_kontrak);
  }

  if (query.id_jabatan !== undefined) {
    conditions.push("p.id_jabatan = ?");
    params.push(query.id_jabatan);
  }

  if (query.id_departemen !== undefined) {
    conditions.push("p.id_departemen = ?");
    params.push(query.id_departemen);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const countRows = await pool.query<CountRow[]>(
    `
    SELECT COUNT(*) AS total
    FROM pegawai p
    ${whereClause}
    `,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);

  if (total > MAX_EXPORT_ROWS) {
    throw new EmployeeServiceError(`Export maksimal ${MAX_EXPORT_ROWS} pegawai. Gunakan filter untuk memperkecil hasil.`, 400);
  }

  const sortColumns = {
    id: "p.id",
    nama_pegawai: "p.nama_pegawai",
    tanggal_masuk: "p.tanggal_masuk",
  } as const;

  const sortColumn = sortColumns[query.sortBy];

  const sortDirection = query.sortOrder === "asc" ? "ASC" : "DESC";

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
      p.status,
      p.status_kontrak
    FROM pegawai p
    LEFT JOIN master_data j
      ON j.id = p.id_jabatan
    LEFT JOIN master_data d
      ON d.id = p.id_departemen
    LEFT JOIN master_wilayah w
      ON w.id = p.id_kecamatan
    ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}, p.id DESC
    LIMIT ?
    `,
    [...params, MAX_EXPORT_ROWS],
  );

  return rows;
}
