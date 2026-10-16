import type { Response, NextFunction } from "express";

import { pool } from "../config/database.js";

import type { AuthRequest } from "./auth.middleware.js";

type Action = "create" | "read" | "update" | "delete";

type PermissionRow = {
  akses: number;
  can_create: number;
  can_read: "All" | "Own" | "No";
  can_update: "All" | "Own" | "No";
  can_delete: "All" | "Own" | "No";
};

export function requirePermission(moduleName: string, action: Action) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = req.auth;

      if (!auth) {
        res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
        return;
      }

      const permissions = await pool.query<PermissionRow[]>(
        `
        SELECT
          akses,
          \`create\` AS can_create,
          \`read\` AS can_read,
          \`update\` AS can_update,
          \`delete\` AS can_delete

        FROM role_permission

        WHERE id_role = ?
          AND modul_fitur = ?
        `,
        [auth.user.id_role, moduleName],
      );

      if (permissions.length !== 1 || !permissions[0].akses) {
        res.status(403).json({
          success: false,
          message: "Akses modul ditolak.",
        });
        return;
      }

      const permission = permissions[0];

      const allowed =
        action === "create" ? Boolean(permission.can_create) : action === "read" ? permission.can_read !== "No" : action === "update" ? permission.can_update !== "No" : permission.can_delete !== "No";

      if (!allowed) {
        res.status(403).json({
          success: false,
          message: "Tidak memiliki izin untuk aksi ini.",
        });
        return;
      }

      // Permission Own wajib divalidasi lagi
      // berdasarkan pemilik data di service.
      next();
    } catch (error) {
      next(error);
    }
  };
}
