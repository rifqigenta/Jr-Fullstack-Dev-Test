import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import { getPositions, getDepartments, getRegions } from "./master-data.service.js";

const regionQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),

  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * GET /api/master-data/positions
 */
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

/**
 * GET /api/master-data/departments
 */
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

/**
 * GET /api/master-data/regions
 */
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

    const regions = await getRegions(parsed.data.search, parsed.data.limit);

    res.status(200).json({
      success: true,
      message: "Daftar wilayah berhasil diambil.",
      data: regions,
    });
  } catch (error) {
    next(error);
  }
}
