import { pool } from "../../config/database.js";

type MasterDataRow = {
  id: number;
  nama: string;
};

type RegionRow = {
  id: number;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
};

/**
 * Mengambil daftar jabatan.
 */
export async function getPositions(): Promise<MasterDataRow[]> {
  const rows = await pool.query<MasterDataRow[]>(
    `
    SELECT
      id,
      nama
    FROM master_data
    WHERE tipe = ?
    ORDER BY nama ASC, id ASC
    `,
    ["jabatan"],
  );

  return rows;
}

/**
 * Mengambil daftar departemen.
 */
export async function getDepartments(): Promise<MasterDataRow[]> {
  const rows = await pool.query<MasterDataRow[]>(
    `
    SELECT
      id,
      nama
    FROM master_data
    WHERE tipe = ?
    ORDER BY nama ASC, id ASC
    `,
    ["departemen"],
  );

  return rows;
}

/**
 * Autocomplete wilayah.
 *
 * Bisa mencari berdasarkan:
 * - Kecamatan
 * - Kabupaten/kota
 * - Provinsi
 */
export async function getRegions(search: string, limit: number): Promise<RegionRow[]> {
  const keyword = `%${search}%`;

  const rows = await pool.query<RegionRow[]>(
    `
    SELECT
      id,
      kecamatan,
      kabupaten,
      provinsi
    FROM master_wilayah
    WHERE
      kecamatan LIKE ?
      OR kabupaten LIKE ?
      OR provinsi LIKE ?
    ORDER BY
      provinsi ASC,
      kabupaten ASC,
      kecamatan ASC,
      id ASC
    LIMIT ?
    `,
    [keyword, keyword, keyword, limit],
  );

  return rows;
}
