import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import { getPositions, getDepartments, getRegions } from "./master-data.service.js";

const regionQuerySchema = z.object({
  search: z.string().trim().max(100, "Pencarian maksimal 100 karakter.").default(""),

  limit: z.coerce.number().int().min(1).max(50).default(10),

  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
});

export async function listPositions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const positions = await getPositions();

    res.status(200).json({
      success: true,
      message: "Daftar jabatan berhasil diambil.",
      data: positions,
    });
  } catch (error) {
    next(error);
  }
}

export async function listDepartments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const departments = await getDepartments();

    res.status(200).json({
      success: true,
      message: "Daftar departemen berhasil diambil.",
      data: departments,
    });
  } catch (error) {
    next(error);
  }
}

export async function listRegions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = regionQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Parameter pencarian wilayah tidak valid.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const { search, limit, id } = parsed.data;

    if (id === undefined && search.length < 3) {
      res.status(200).json({
        success: true,
        message: "Ketik minimal 3 karakter nama kecamatan.",
        data: [],
      });
      return;
    }

    const regions = await getRegions(search, limit, id);

    res.status(200).json({
      success: true,
      message: "Daftar wilayah berhasil diambil.",
      data: regions,
    });
  } catch (error) {
    next(error);
  }
}
