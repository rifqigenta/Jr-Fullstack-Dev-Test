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
  status: string;
  status_kontrak: string | null;
  nama_jabatan: string | null;
  nama_departemen: string | null;
};

function dateString(value: Date | string): string {
  if (value instanceof Date) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }

  return String(value).slice(0, 10);
}

export async function getHrdDashboard() {
  const results = await Promise.all([
    pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM pegawai
        WHERE deleted_at IS NULL
      `,
    ),

    pool.query<GroupRow[]>(
      `
        SELECT status_kontrak AS label, COUNT(*) AS total
        FROM pegawai
        WHERE deleted_at IS NULL
        GROUP BY status_kontrak
      `,
    ),

    pool.query<GroupRow[]>(
      `
        SELECT jenis_kelamin AS label, COUNT(*) AS total
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
        LEFT JOIN master_data j ON j.id = p.id_jabatan
        LEFT JOIN master_data d ON d.id = p.id_departemen
        WHERE p.deleted_at IS NULL
        ORDER BY p.tanggal_masuk DESC, p.id DESC
        LIMIT 5
      `,
    ),
  ] as const);

  const [counts, contractRows, genderRows, recentEmployees] = results;

  const contracts = {
    PKWTT: 0,
    PKWT: 0,
    Magang: 0,
    belum_diisi: 0,
  };

  for (const row of contractRows) {
    const count = Number(row.total);

    switch (row.label) {
      case "PKWTT":
        contracts.PKWTT += count;
        break;
      case "PKWT":
        contracts.PKWT += count;
        break;
      case "Magang":
        contracts.Magang += count;
        break;
      default:
        contracts.belum_diisi += count;
    }
  }

  const genders = {
    laki_laki: 0,
    perempuan: 0,
    belum_diisi: 0,
  };

  for (const row of genderRows) {
    const count = Number(row.total);

    switch (row.label) {
      case "Laki-laki":
        genders.laki_laki += count;
        break;
      case "Perempuan":
        genders.perempuan += count;
        break;
      default:
        genders.belum_diisi += count;
    }
  }

  return {
    total_pegawai: Number(counts[0]?.total || 0),
    berdasarkan_kontrak: contracts,
    berdasarkan_gender: genders,

    pegawai_terbaru: recentEmployees.map((employee) => ({
      ...employee,
      tanggal_masuk: dateString(employee.tanggal_masuk),
    })),
  };
}
