import type { Response, NextFunction } from "express";

import multer from "multer";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { EmployeeServiceError } from "./employees.service.js";

import { validateImageBuffer } from "../../utils/image.util.js";

import { saveEmployeePhoto, removeEmployeePhoto } from "./employees-photo.service.js";

function getEmployeeId(value: string | undefined): number | null {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function uploadPhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getEmployeeId(typeof req.params.id === "string" ? req.params.id : undefined);

    if (!id) {
      res.status(400).json({
        success: false,
        message: "ID pegawai tidak valid.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "File foto wajib diunggah.",
      });
      return;
    }

    const isValid = await validateImageBuffer(req.file.buffer);

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Foto harus berformat JPEG, PNG, atau WebP.",
      });
      return;
    }

    const result = await saveEmployeePhoto(id, req.file.buffer, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Foto pegawai berhasil diunggah.",
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

export async function deletePhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getEmployeeId(typeof req.params.id === "string" ? req.params.id : undefined);

    if (!id) {
      res.status(400).json({
        success: false,
        message: "ID pegawai tidak valid.",
      });
      return;
    }

    const result = await removeEmployeePhoto(id, req.auth!.user.id);

    res.status(200).json({
      success: true,
      message: "Foto pegawai berhasil dihapus.",
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

/**
 * Error handler khusus Multer.
 */
export function handlePhotoUploadError(error: unknown, _req: AuthRequest, res: Response, next: NextFunction): void {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE" ? "Ukuran foto maksimal 2 MB." : "Upload foto tidak valid.",
    });
    return;
  }

  next(error);
}
