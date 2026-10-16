import type { Request, Response, NextFunction } from "express";

import { getRoles, getRolePermissions } from "./roles.service.js";

export async function listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await getRoles();

    res.status(200).json({
      success: true,
      message: "Daftar role berhasil diambil.",
      data: roles,
    });
  } catch (error) {
    next(error);
  }
}

export async function showRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID role tidak valid.",
      });
      return;
    }

    const role = await getRolePermissions(id);

    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role tidak ditemukan.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Permission role berhasil diambil.",
      data: role,
    });
  } catch (error) {
    next(error);
  }
}
