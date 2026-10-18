import type { Response, NextFunction } from "express";
import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { createSettingSchema, updateSettingSchema, attendanceSchema, calculateSchema, monthQuerySchema, yearQuerySchema, historyQuerySchema } from "./transport.schema.js";

import {
  TransportError,
  listTransportSettings,
  createTransportSetting,
  updateTransportSetting,
  deleteTransportSetting,
  saveMonthlyAttendance,
  calculateMonthlyTransport,
  getMyTransportAllowance,
  getTransportMonths,
  getTransportHistory,
} from "./transport.service.js";

const idSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

type Handler = (req: AuthRequest, res: Response) => Promise<void>;

function wrap(handler: Handler) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const originalJson = res.json.bind(res);

      res.json = ((body: unknown) => {
        const safeBody = JSON.parse(JSON.stringify(body, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value)));

        return originalJson(safeBody);
      }) as typeof res.json;

      await handler(req, res);
    } catch (error) {
      if (error instanceof TransportError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Periksa kembali parameter atau isian tunjangan.",
          errors: z.flattenError(error),
        });
        return;
      }

      next(error);
    }
  };
}

export const listSettings = wrap(async (_req, res) => {
  res.json({
    success: true,
    data: await listTransportSettings(),
  });
});

export const storeSetting = wrap(async (req, res) => {
  const input = createSettingSchema.parse(req.body);

  const data = await createTransportSetting(input, req.auth!.user.id);

  res.status(201).json({
    success: true,
    message: "Pengaturan tarif berhasil dibuat.",
    data,
  });
});

export const patchSetting = wrap(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = updateSettingSchema.parse(req.body);

  const data = await updateTransportSetting(id, input, req.auth!.user.id);

  res.json({
    success: true,
    message: "Pengaturan tarif berhasil diperbarui.",
    data,
  });
});

export const destroySetting = wrap(async (req, res) => {
  const id = idSchema.parse(req.params.id);

  const data = await deleteTransportSetting(id, req.auth!.user.id);

  res.json({
    success: true,
    message: "Pengaturan tarif berhasil dihapus.",
    data,
  });
});

export const putAttendance = wrap(async (req, res) => {
  const input = attendanceSchema.parse(req.body);

  const data = await saveMonthlyAttendance(input, req.auth!.user.id);

  res.json({
    success: true,
    message: "Kehadiran berhasil disimpan. Hitung ulang untuk memperbarui tunjangan.",
    data,
  });
});

export const calculateTransport = wrap(async (req, res) => {
  const input = calculateSchema.parse(req.body);

  const data = await calculateMonthlyTransport(input, req.auth!.user.id);

  res.json({
    success: true,
    message: "Tunjangan transport berhasil dihitung ulang.",
    data,
  });
});

export const myTransport = wrap(async (req, res) => {
  const query = monthQuerySchema.parse(req.query);

  const data = await getMyTransportAllowance(req.auth!.user.id, query.tahun, query.bulan);

  res.json({
    success: true,
    message: data ? "Tunjangan berhasil diambil." : "Belum ada perhitungan untuk periode ini.",
    data,
  });
});

export const transportMonths = wrap(async (req, res) => {
  const query = yearQuerySchema.parse(req.query);

  res.json({
    success: true,
    data: await getTransportMonths(req.auth!.user.id, query.tahun),
  });
});

export const transportHistory = wrap(async (req, res) => {
  const query = historyQuerySchema.parse(req.query);

  const result = await getTransportHistory(query, req.auth!.user.id);

  res.json({
    success: true,
    data: result.rows,
    pagination: result.pagination,
  });
});
