import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";
import { createEmployee, getEmployees, getEmployeeById, updateEmployee, deleteEmployee, EmployeeServiceError } from "./employees.service.js";

import { createEmployeeSchema, updateEmployeeSchema } from "./employees.schema.js";

import { employeeListQuerySchema } from "./employees-query.js";

function parseEmployeeId(req: Request, res: Response): number | null {
  const value = req.params.id;

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    res.status(400).json({
      success: false,
      message: "ID pegawai tidak valid.",
    });
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    res.status(400).json({
      success: false,
      message: "ID pegawai tidak valid.",
    });
    return null;
  }

  return id;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof EmployeeServiceError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  next(error);
}

export async function listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = employeeListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Parameter daftar pegawai tidak valid.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await getEmployees(parsed.data);

    res.status(200).json({
      success: true,
      message: "Daftar pegawai berhasil diambil.",
      data: result.employees,
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function detailEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseEmployeeId(req, res);
    if (id === null) return;

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
    handleError(error, res, next);
  }
}

export async function storeEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        message: "Silakan login terlebih dahulu.",
      });
      return;
    }

    const parsed = createEmployeeSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi data pegawai gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const employee = await createEmployee(parsed.data, req.auth.user.id);

    res.status(201).json({
      success: true,
      message: "Pegawai berhasil dibuat.",
      data: employee,
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function patchEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseEmployeeId(req, res);
    if (id === null) return;

    if (!req.auth) {
      res.status(401).json({
        success: false,
        message: "Silakan login terlebih dahulu.",
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

    const employee = await updateEmployee(id, parsed.data, req.auth.user.id);

    res.status(200).json({
      success: true,
      message: "Pegawai berhasil diperbarui.",
      data: employee,
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function destroyEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseEmployeeId(req, res);
    if (id === null) return;

    if (!req.auth) {
      res.status(401).json({
        success: false,
        message: "Silakan login terlebih dahulu.",
      });
      return;
    }

    const result = await deleteEmployee(id, req.auth.user.id);

    res.status(200).json({
      success: true,
      message: "Pegawai berhasil dihapus.",
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
}
