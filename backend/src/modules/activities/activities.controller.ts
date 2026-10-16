import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import { activityQuerySchema } from "./activities.schema.js";

import { getActivities } from "./activities.service.js";

export async function listActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = activityQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Filter activity log tidak valid.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await getActivities(parsed.data);

    res.status(200).json({
      success: true,
      message: "Activity log berhasil diambil.",
      data: result.activities,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}
