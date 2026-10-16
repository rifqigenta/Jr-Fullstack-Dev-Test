import type { Response, NextFunction } from "express";

import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { updateProfileSchema } from "./profile.schema.js";

import { getProfile, updateProfile, ProfileServiceError } from "./profile.service.js";

export async function showProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await getProfile(req.auth!.user.id);

    if (!profile) {
      res.status(404).json({
        success: false,
        message: "Profil tidak ditemukan.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profil berhasil diambil.",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function patchProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi profil gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const profile = await updateProfile(req.auth!.user.id, parsed.data);

    res.status(200).json({
      success: true,
      message: "Profil berhasil diperbarui.",
      data: profile,
    });
  } catch (error) {
    if (error instanceof ProfileServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
