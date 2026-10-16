import { pool } from "../../config/database.js";

import type { ActivityQuery } from "./activities.schema.js";

type ActivityRow = {
  id: number;
  title: string;
  content: string | null;
  ua: string | null;
  ip: string | null;
  url: string | null;
  browser: string | null;
  platform: string | null;
  created_at: Date;
  created_by: number | bigint | null;
  username: string | null;
  nama_pengguna: string | null;
};

type CountRow = {
  total: number | bigint;
};

export async function getActivities(query: ActivityQuery) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (query.search) {
    conditions.push("(a.title LIKE ? OR a.content LIKE ?)");

    const keyword = `%${query.search}%`;
    params.push(keyword, keyword);
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
    conditions.push("a.created_at >= ?");
    params.push(`${query.start_date} 00:00:00`);
  }

  if (query.end_date) {
    // Eksklusif pada awal hari berikutnya.
    conditions.push("a.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(`${query.end_date} 00:00:00`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await pool.query<CountRow[]>(
    `
    SELECT COUNT(*) AS total
    FROM activities a
    ${whereClause}
    `,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  const offset = (query.page - 1) * query.limit;

  const activities = await pool.query<ActivityRow[]>(
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
      a.created_at,
      a.created_by,
      u.username,
      u.nama AS nama_pengguna
    FROM activities a
    LEFT JOIN user u
      ON u.id = a.created_by
    ${whereClause}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  const formattedActivities = activities.map((activity) => ({
    ...activity,
    id: String(activity.id),
    created_by: activity.created_by !== null ? String(activity.created_by) : null,
  }));

  return {
    activities: formattedActivities,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
