import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { listRoles, showRolePermissions } from "./roles.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("roles", "read"), listRoles);

router.get("/:id/permissions", requirePermission("roles", "read"), showRolePermissions);

export default router;
