import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import { createEmployee, getEmployees, getEmployeeById, updateEmployee, deleteEmployee, EmployeeServiceError } from "./employees.service.js";
import { createEmployeeSchema, updateEmployeeSchema } from "./employees.schema.js";
import type { AuthRequest } from "../../middlewares/auth.middleware.js";

const employeeListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).default(""),

  status: z.enum(["Aktif", "Nonaktif"]).optional(),

  status_kontrak: z.enum(["PKWTT", "PKWT", "Magang"]).optional(),

  id_jabatan: z.coerce.number().int().positive().optional(),

  id_departemen: z.coerce.number().int().positive().optional(),

  sortBy: z.enum(["id", "nama_pegawai", "tanggal_masuk"]).default("id"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = employeeListSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Parameter daftar pegawai tidak valid.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await getEmployees(parsed.data);

    res.json({
      success: true,
      message: "Daftar pegawai berhasil diambil.",
      data: result.employees,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function detailEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID pegawai tidak valid.",
      });
      return;
    }

    const employee = await getEmployeeById(id);

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Pegawai tidak ditemukan.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Detail pegawai berhasil diambil.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function storeEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createEmployeeSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi data pegawai gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const employee = await createEmployee(parsed.data, req.auth!.user.id);

    res.status(201).json({
      success: true,
      message: "Pegawai berhasil dibuat.",
      data: employee,
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

export async function patchEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID pegawai tidak valid.",
      });
      return;
    }

    const parsed = updateEmployeeSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi update pegawai gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await updateEmployee(id, parsed.data, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Pegawai berhasil diperbarui.",
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

export async function destroyEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID pegawai tidak valid.",
      });
      return;
    }

    const result = await deleteEmployee(id, req.auth!.user.id);

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
