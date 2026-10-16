import type { Response, NextFunction } from "express";

import { pool } from "../config/database.js";

import type { AuthRequest } from "./auth.middleware.js";

type RoleRow = {
  nama_role: string;
};

export async function requireAdminHrd(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.user.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication diperlukan.",
      });
      return;
    }

    const rows = await pool.query<RoleRow[]>(
      `
      SELECT r.nama_role
      FROM user u
      JOIN user_role r ON r.id = u.id_role
      WHERE u.id = ?
        AND u.deleted_at IS NULL
        AND u.disabled = 0
      LIMIT 1
      `,
      [userId],
    );

    if (rows[0]?.nama_role !== "Admin HRD") {
      res.status(403).json({
        success: false,
        message: "Hanya Admin HRD yang dapat melakukan aksi ini.",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
