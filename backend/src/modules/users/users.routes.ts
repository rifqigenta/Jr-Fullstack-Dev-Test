import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { listUsers, detailUser, employeeOptions, storeUser, patchUser, patchUserStatus, destroyUser } from "./users.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/employee-options", requirePermission("users", "read"), employeeOptions);

router.get("/", requirePermission("users", "read"), listUsers);

router.post("/", requirePermission("users", "create"), storeUser);

router.patch("/:id/status", requirePermission("users", "update"), patchUserStatus);

router.patch("/:id", requirePermission("users", "update"), patchUser);

router.delete("/:id", requirePermission("users", "delete"), destroyUser);

router.get("/:id", requirePermission("users", "read"), detailUser);

export default router;
