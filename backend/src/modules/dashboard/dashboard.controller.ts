import type { Request, Response, NextFunction } from "express";

import { getHrdDashboard } from "./dashboard.service.js";

export async function showHrdDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getHrdDashboard();

    res.status(200).json({
      success: true,
      message: "Dashboard HRD berhasil diambil.",
      data,
    });
  } catch (error) {
    next(error);
  }
}
