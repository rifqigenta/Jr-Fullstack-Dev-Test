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

export async function getRegions(search: string, limit: number, id?: number): Promise<RegionRow[]> {
  if (id !== undefined) {
    return pool.query<RegionRow[]>(
      `
        SELECT
          id,
          kecamatan,
          kabupaten,
          provinsi
        FROM master_wilayah
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );
  }

  const normalizedSearch = search.trim();

  if (normalizedSearch.length < 3) {
    return [];
  }

  const escapedSearch = normalizedSearch.replace(/[=%_]/g, (character) => `=${character}`);

  const keyword = `%${escapedSearch}%`;

  return pool.query<RegionRow[]>(
    `
      SELECT
        id,
        kecamatan,
        kabupaten,
        provinsi
      FROM master_wilayah
      WHERE kecamatan LIKE ? ESCAPE '='
      ORDER BY
        kecamatan ASC,
        kabupaten ASC,
        provinsi ASC,
        id ASC
      LIMIT ?
    `,
    [keyword, limit],
  );
}
