import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import { getUsers, getUserById, getEmployeeOptions, createUser, UserServiceError, updateUser, changeUserStatus, deleteUser } from "./users.service.js";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).default(""),
});

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Parameter query tidak valid.",
      });
      return;
    }

    const result = await getUsers(parsed.data);

    res.json({
      success: true,
      message: "Daftar pengguna berhasil diambil.",
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

const userIdSchema = z.coerce.number().int().positive();

export async function detailUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = userIdSchema.safeParse(req.params.id);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "ID pengguna tidak valid.",
      });
      return;
    }

    const user = await getUserById(parsed.data);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Pengguna tidak ditemukan.",
      });
      return;
    }

    res.json({
      success: true,
      message: "Detail pengguna berhasil diambil.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

const employeeOptionsSchema = z.object({
  search: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function employeeOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = employeeOptionsSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Parameter pencarian tidak valid.",
      });
      return;
    }

    const employees = await getEmployeeOptions(parsed.data.search, parsed.data.limit);

    res.json({
      success: true,
      message: "Pilihan pegawai berhasil diambil.",
      data: employees,
    });
  } catch (error) {
    next(error);
  }
}

const createUserSchema = z.object({
  id_pegawai: z.number().int().positive(),

  id_role: z.number().int().positive(),

  username: z
    .string()
    .min(6, "Username minimal 6 karakter.")
    .max(50)
    .regex(/^[a-z0-9]+$/, "Username hanya boleh huruf kecil dan angka."),

  nama: z.string().trim().min(2).max(100),

  email: z.email().max(255),
});

export async function storeUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi data pengguna gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await createUser(parsed.data, req.auth!.user.id);

    res.setHeader("Cache-Control", "no-store");

    res.status(201).json({
      success: true,
      message: "Pengguna berhasil dibuat.",
      data: result,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

const updateUserSchema = z
  .object({
    username: z
      .string()
      .min(6)
      .max(50)
      .regex(/^[a-z0-9]+$/)
      .optional(),

    nama: z.string().trim().min(2).max(100).optional(),

    email: z.email().max(255).optional(),

    id_role: z.number().int().positive().optional(),

    id_pegawai: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Minimal satu field harus diisi.");

const statusSchema = z
  .object({
    disabled: z.boolean(),
  })
  .strict();

export async function patchUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID pengguna tidak valid.",
      });
      return;
    }

    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validasi update pengguna gagal.",
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await updateUser(id, parsed.data, req.auth!.user.id);

    res.json({
      success: true,
      message: "Pengguna berhasil diperbarui.",
      data: result,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function patchUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID pengguna tidak valid.",
      });
      return;
    }

    const parsed = statusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Status harus berupa boolean.",
      });
      return;
    }

    const result = await changeUserStatus(id, parsed.data.disabled, req.auth!.user.id);

    res.json({
      success: true,
      message: parsed.data.disabled ? "Pengguna berhasil dinonaktifkan." : "Pengguna berhasil diaktifkan.",
      data: result,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function destroyUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID pengguna tidak valid.",
      });
      return;
    }

    const result = await deleteUser(id, req.auth!.user.id);

    res.json({
      success: true,
      message: "Pengguna berhasil dihapus.",
      data: result,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
