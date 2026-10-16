import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

import { showProfile, patchProfile, patchProfilePassword } from "./profile.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("profile", "read"), showProfile);

router.patch("/", requirePermission("profile", "update"), patchProfile);

router.patch("/password", requirePermission("profile", "update"), patchProfilePassword);

export default router;
