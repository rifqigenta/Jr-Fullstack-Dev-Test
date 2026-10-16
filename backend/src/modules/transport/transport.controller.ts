import type { Response, NextFunction } from "express";
import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { createSettingSchema, updateSettingSchema, attendanceSchema, calculateSchema, monthQuerySchema, historyQuerySchema } from "./transport.schema.js";

import {
  TransportError,
  listTransportSettings,
  createTransportSetting,
  updateTransportSetting,
  deleteTransportSetting,
  saveMonthlyAttendance,
  calculateMonthlyTransport,
  getMyTransportAllowance,
  getTransportHistory,
} from "./transport.service.js";

function sendError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof TransportError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  next(error);
}

function parseId(value: unknown): number {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TransportError("ID tidak valid.", 400);
  }

  return id;
}

// Normalisasi bigint dan DECIMAL agar aman untuk JSON.
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item))) as T;
}

export async function listSettings(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listTransportSettings();

    res.status(200).json({
      success: true,
      data: jsonSafe(data),
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function storeSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSettingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const data = await createTransportSetting(parsed.data, req.auth!.user.id);

    res.status(201).json({
      success: true,
      message: "Pengaturan tarif berhasil dibuat.",
      data: jsonSafe(data),
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function patchSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const parsed = updateSettingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const data = await updateTransportSetting(id, parsed.data, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Pengaturan tarif berhasil diperbarui.",
      data: jsonSafe(data),
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function destroySetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await deleteTransportSetting(parseId(req.params.id), req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Pengaturan tarif berhasil dihapus.",
      data,
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function putAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = attendanceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const data = await saveMonthlyAttendance(parsed.data, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Kehadiran berhasil disimpan.",
      data,
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function calculateTransport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = calculateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const data = await calculateMonthlyTransport(parsed.data, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Tunjangan transport berhasil dihitung.",
      data,
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function myTransport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const data = await getMyTransportAllowance(req.auth!.user.id, parsed.data.tahun, parsed.data.bulan);

    res.status(200).json({
      success: true,
      message: data ? "Tunjangan berhasil diambil." : "Belum ada perhitungan tunjangan untuk periode ini.",
      data: jsonSafe(data),
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

export async function transportHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = historyQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await getTransportHistory(parsed.data);

    res.status(200).json({
      success: true,
      data: jsonSafe(result.rows),
      pagination: result.pagination,
    });
  } catch (error) {
    sendError(error, res, next);
  }
}
