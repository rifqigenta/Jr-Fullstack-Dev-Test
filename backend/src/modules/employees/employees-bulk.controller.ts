import type { Response, NextFunction } from "express";

import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { EmployeeServiceError } from "./employees.service.js";

import { bulkStatusSchema, bulkDeleteSchema } from "./employees-bulk.schema.js";

import { bulkUpdateEmployeeStatus, bulkDeleteEmployees } from "./employees-bulk.service.js";

export async function bulkUpdateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = bulkStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi bulk update status gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await bulkUpdateEmployeeStatus(parsed.data, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Status pegawai berhasil diperbarui.",
      data: result,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = bulkDeleteSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi bulk delete gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await bulkDeleteEmployees(parsed.data, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Pegawai berhasil dihapus.",
      data: result,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
