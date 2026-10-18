import type { Response, NextFunction } from "express";

import { z } from "zod";

import type { AuthRequest } from "../../middlewares/auth.middleware.js";

import { getUsers, getUserById, getEmployeeOptions, usernameAvailable, createUser, updateUser, changeUserStatus, deleteUser, UserServiceError } from "./users.service.js";

import { generatePassword } from "./password.util.js";

import { userIdSchema, userListSchema, employeeOptionsSchema, createUserSchema, updateUserSchema, userStatusSchema, usernameQuerySchema } from "./users.schema.js";

type Handler = (req: AuthRequest, res: Response) => Promise<void>;

function wrap(handler: Handler) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Periksa kembali data pengguna.",
          errors: z.flattenError(error),
        });
        return;
      }

      next(error);
    }
  };
}

export const listUsers = wrap(async (req, res) => {
  const query = userListSchema.parse(req.query);
  const result = await getUsers(query);

  res.status(200).json({
    success: true,
    message: "Daftar pengguna berhasil diambil.",
    data: result.users,
    pagination: result.pagination,
  });
});

export const detailUser = wrap(async (req, res) => {
  const id = userIdSchema.parse(req.params.id);
  const user = await getUserById(id);

  if (!user) {
    throw new UserServiceError("Pengguna tidak ditemukan.", 404);
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const employeeOptions = wrap(async (req, res) => {
  const query = employeeOptionsSchema.parse(req.query);

  const employees = await getEmployeeOptions(query.search, query.limit);

  res.status(200).json({
    success: true,
    data: employees,
  });
});

export const checkUsername = wrap(async (req, res) => {
  const query = usernameQuerySchema.parse(req.query);

  res.status(200).json({
    success: true,
    data: {
      available: await usernameAvailable(query.username, query.excludeId),
    },
  });
});

export const generateUserPassword = wrap(async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    data: {
      password: generatePassword(12),
    },
  });
});

export const storeUser = wrap(async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const user = await createUser(input, req.auth!.user.id);

  res.setHeader("Cache-Control", "no-store");

  res.status(201).json({
    success: true,
    message: "Pengguna berhasil dibuat.",
    data: user,
  });
});

export const patchUser = wrap(async (req, res) => {
  const id = userIdSchema.parse(req.params.id);
  const input = updateUserSchema.parse(req.body);

  const user = await updateUser(id, input, req.auth!.user.id);

  res.status(200).json({
    success: true,
    message: "Pengguna berhasil diperbarui.",
    data: user,
  });
});

export const patchUserStatus = wrap(async (req, res) => {
  const id = userIdSchema.parse(req.params.id);
  const input = userStatusSchema.parse(req.body);

  const result = await changeUserStatus(id, input.disabled, req.auth!.user.id);

  res.status(200).json({
    success: true,
    message: input.disabled ? "Pengguna berhasil dinonaktifkan." : "Pengguna berhasil diaktifkan.",
    data: result,
  });
});

export const destroyUser = wrap(async (req, res) => {
  const id = userIdSchema.parse(req.params.id);

  const result = await deleteUser(id, req.auth!.user.id);

  res.status(200).json({
    success: true,
    message: "Pengguna berhasil dihapus.",
    data: result,
  });
});
