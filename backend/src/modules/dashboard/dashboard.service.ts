import { pool } from "../../config/database.js";

type CountRow = {
  total: number | bigint;
};

type GroupRow = {
  label: string | null;
  total: number | bigint;
};

type RecentEmployeeRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  foto_pegawai: string | null;
  tanggal_masuk: Date | string;
  status: "Aktif" | "Nonaktif";
  status_kontrak: "PKWTT" | "PKWT" | "Magang" | null;
  nama_jabatan: string | null;
  nama_departemen: string | null;
};

export async function getHrdDashboard() {
  const [countRows, contractRows, genderRows, recentEmployees] = await Promise.all([
    pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM pegawai
        WHERE deleted_at IS NULL
        `,
    ),

    pool.query<GroupRow[]>(
      `
        SELECT
          status_kontrak AS label,
          COUNT(*) AS total
        FROM pegawai
        WHERE deleted_at IS NULL
        GROUP BY status_kontrak
        `,
    ),

    pool.query<GroupRow[]>(
      `
        SELECT
          jenis_kelamin AS label,
          COUNT(*) AS total
        FROM pegawai
        WHERE deleted_at IS NULL
        GROUP BY jenis_kelamin
        `,
    ),

    pool.query<RecentEmployeeRow[]>(
      `
        SELECT
          p.id,
          p.nip,
          p.nama_pegawai,
          p.foto_pegawai,
          p.tanggal_masuk,
          p.status,
          p.status_kontrak,
          j.nama AS nama_jabatan,
          d.nama AS nama_departemen
        FROM pegawai p
        LEFT JOIN master_data j
          ON j.id = p.id_jabatan
        LEFT JOIN master_data d
          ON d.id = p.id_departemen
        WHERE p.deleted_at IS NULL
        ORDER BY p.tanggal_masuk DESC, p.id DESC
        LIMIT 5
        `,
    ),
  ]);

  const contracts = {
    PKWTT: 0,
    PKWT: 0,
    Magang: 0,
    belum_diisi: 0,
  };

  for (const row of contractRows) {
    const count = Number(row.total);

    if (row.label === "PKWTT") contracts.PKWTT = count;
    else if (row.label === "PKWT") contracts.PKWT = count;
    else if (row.label === "Magang") contracts.Magang = count;
    else contracts.belum_diisi = count;
  }

  const genders = {
    laki_laki: 0,
    perempuan: 0,
    belum_diisi: 0,
  };

  for (const row of genderRows) {
    const count = Number(row.total);

    if (row.label === "Laki-laki") {
      genders.laki_laki = count;
    } else if (row.label === "Perempuan") {
      genders.perempuan = count;
    } else {
      genders.belum_diisi = count;
    }
  }

  return {
    total_pegawai: Number(countRows[0]?.total ?? 0),
    berdasarkan_kontrak: contracts,
    berdasarkan_gender: genders,
    pegawai_terbaru: recentEmployees,
  };
}
