import type { Response, NextFunction } from "express";

import { pool } from "../config/database.js";

import type { AuthRequest } from "./auth.middleware.js";

type Action = "create" | "read" | "update" | "delete";
type Scope = "All" | "Own" | "No";

type PermissionRow = {
  akses: number | bigint | boolean;
  can_create: number | bigint | boolean;
  can_read: Scope;
  can_update: Scope;
  can_delete: Scope;
};

function enabled(value: number | bigint | boolean): boolean {
  return value === true || Number(value) === 1;
}

export function requirePermission(moduleName: string, action: Action) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({
          success: false,
          message: "Silakan login terlebih dahulu.",
        });
        return;
      }

      const rows = await pool.query<PermissionRow[]>(
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
        [req.auth.user.id_role, moduleName],
      );

      const permission = rows[0];

      if (rows.length !== 1 || !permission || !enabled(permission.akses)) {
        res.status(403).json({
          success: false,
          message: "Akses modul ditolak.",
        });
        return;
      }

      if (action === "create") {
        if (!enabled(permission.can_create)) {
          res.status(403).json({
            success: false,
            message: "Tidak memiliki izin membuat data.",
          });
          return;
        }

        next();
        return;
      }

      const scope = action === "read" ? permission.can_read : action === "update" ? permission.can_update : permission.can_delete;

      if (scope !== "All" && scope !== "Own") {
        res.status(403).json({
          success: false,
          message: "Tidak memiliki izin untuk aksi ini.",
        });
        return;
      }

      const ownScopeSupported = moduleName === "profile" || moduleName === "transport";

      if (scope === "Own" && !ownScopeSupported) {
        res.status(403).json({
          success: false,
          message: "Aksi ini memerlukan pemeriksaan kepemilikan yang belum tersedia.",
        });
        return;
      }

      res.locals.permission = {
        moduleName,
        action,
        scope,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
