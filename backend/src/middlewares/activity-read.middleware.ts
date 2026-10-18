import type { Response, NextFunction } from "express";

import type { AuthRequest } from "./auth.middleware.js";

import { pool } from "../config/database.js";

const modules = [
  { prefix: "/api/users", name: "USERS" },
  { prefix: "/api/employees", name: "EMPLOYEES" },
  { prefix: "/api/master-data", name: "MASTER_DATA" },
  { prefix: "/api/dashboard", name: "DASHBOARD" },
  { prefix: "/api/profile", name: "PROFILE" },
  { prefix: "/api/roles", name: "ROLES" },
  { prefix: "/api/transport", name: "TRANSPORT" },
  { prefix: "/api/activities", name: "ACTIVITIES" },
];

export function recordReadActivity(req: AuthRequest, res: Response, next: NextFunction): void {
  const path = req.originalUrl.split("?")[0] || "";

  const module = modules.find((item) => path === item.prefix || path.startsWith(`${item.prefix}/`));

  if (req.method === "GET" && module) {
    res.once("finish", () => {
      const actorId = req.auth?.user.id;

      if (!actorId || res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      void pool
        .query(
          `
          INSERT INTO activities (
            title,
            content,
            created_by,
            created_at,
            url
          )
          VALUES (?, ?, ?, UTC_TIMESTAMP(), ?)
        `,
          [`READ_${module.name}`, `Membaca modul ${module.name}: ${path.slice(0, 180)}`, actorId, path.slice(0, 255)],
        )
        .catch((error: unknown) => {
          console.error("Gagal mencatat akses baca:", error);
        });
    });
  }

  next();
}
