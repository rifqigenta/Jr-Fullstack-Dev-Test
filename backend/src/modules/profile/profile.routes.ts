import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { showProfile, patchProfile } from "./profile.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("profile", "read"), showProfile);

router.patch("/", requirePermission("profile", "update"), patchProfile);

export default router;
