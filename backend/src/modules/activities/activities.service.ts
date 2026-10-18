import { pool } from "../../config/database.js";

import type { ActivityQuery } from "./activities.schema.js";

type ActivityRow = {
  id: number | bigint;
  title: string;
  content: string | null;
  ua: string | null;
  ip: string | null;
  url: string | null;
  browser: string | null;
  platform: string | null;
  created_at: string;
  created_by: number | bigint | null;
  username: string | null;
  nama_pengguna: string | null;
};

export async function getActivities(query: ActivityQuery) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (query.search) {
    const escaped = query.search.replace(/[=%_]/g, (character) => `=${character}`);

    const keyword = `%${escaped}%`;

    conditions.push(`
      (
        a.title LIKE ? ESCAPE '='
        OR a.content LIKE ? ESCAPE '='
        OR u.username LIKE ? ESCAPE '='
        OR u.nama LIKE ? ESCAPE '='
      )
    `);

    params.push(keyword, keyword, keyword, keyword);
  }

  if (query.title) {
    conditions.push("a.title = ?");
    params.push(query.title);
  }

  if (query.created_by !== undefined) {
    conditions.push("a.created_by = ?");
    params.push(query.created_by);
  }

  if (query.start_date) {
    conditions.push(`
      a.created_at >= DATE_SUB(
        ?,
        INTERVAL 7 HOUR
      )
    `);

    params.push(`${query.start_date} 00:00:00`);
  }

  if (query.end_date) {
    conditions.push(`
      a.created_at < DATE_SUB(
        DATE_ADD(?, INTERVAL 1 DAY),
        INTERVAL 7 HOUR
      )
    `);

    params.push(`${query.end_date} 00:00:00`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const counts = await pool.query<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM activities a
      LEFT JOIN \`user\` u ON u.id = a.created_by
      ${where}
    `,
    params,
  );

  const total = Number(counts[0]?.total || 0);

  const rows = await pool.query<ActivityRow[]>(
    `
      SELECT
        a.id,
        a.title,
        a.content,
        a.ua,
        a.ip,
        a.url,
        a.browser,
        a.platform,
        DATE_FORMAT(
          a.created_at,
          '%Y-%m-%dT%H:%i:%sZ'
        ) AS created_at,
        a.created_by,
        u.username,
        u.nama AS nama_pengguna
      FROM activities a
      LEFT JOIN \`user\` u ON u.id = a.created_by
      ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, (query.page - 1) * query.limit],
  );

  return {
    activities: rows.map((row) => ({
      ...row,
      id: String(row.id),
      created_by: row.created_by === null ? null : String(row.created_by),
    })),

    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
