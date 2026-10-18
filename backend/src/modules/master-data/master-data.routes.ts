import { Router } from "express";

import type { Response, NextFunction } from "express";

import { pool } from "../../config/database.js";

import { requireAuth, type AuthRequest } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { listPositions, listDepartments, listRegions } from "./master-data.controller.js";

const router = Router();

router.use(requireAuth);

async function requireMasterDataAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        message: "Silakan login terlebih dahulu.",
      });
      return;
    }

    const rows = await pool.query<
      Array<{
        akses: number | bigint;
        can_read: string;
      }>
    >(
      `
        SELECT
          akses,
          \`read\` AS can_read
        FROM role_permission
        WHERE id_role = ?
          AND modul_fitur IN ('users', 'employees')
      `,
      [req.auth.user.id_role],
    );

    const allowed = rows.some((row) => Number(row.akses) === 1 && row.can_read === "All");

    if (!allowed) {
      res.status(403).json({
        success: false,
        message: "Tidak memiliki akses master data.",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

router.get("/positions", requireMasterDataAccess, listPositions);

router.get("/departments", requireMasterDataAccess, listDepartments);

router.get("/regions", requirePermission("employees", "read"), listRegions);

export default router;
