import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { listActivities } from "./activities.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("activities", "read"), listActivities);

export default router;
