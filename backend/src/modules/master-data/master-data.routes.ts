import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { listPositions, listDepartments, listRegions } from "./master-data.controller.js";

const router = Router();

// Semua endpoint wajib login.
router.use(requireAuth);

// Semua endpoint membutuhkan akses baca pegawai.
router.use(requirePermission("employees", "read"));

router.get("/positions", listPositions);

router.get("/departments", listDepartments);

router.get("/regions", listRegions);

export default router;
