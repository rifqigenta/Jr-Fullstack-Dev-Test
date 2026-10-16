import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { showHrdDashboard } from "./dashboard.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/hrd", requirePermission("employees", "read"), showHrdDashboard);

export default router;
