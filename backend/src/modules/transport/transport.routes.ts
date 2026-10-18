import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { requireAdminHrd } from "../../middlewares/admin-hrd.middleware.js";

import { listSettings, storeSetting, patchSetting, destroySetting, putAttendance, calculateTransport, myTransport, transportMonths, transportHistory } from "./transport.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/settings", requirePermission("transport_settings", "read"), listSettings);

router.post("/settings", requirePermission("transport_settings", "create"), storeSetting);

router.patch("/settings/:id", requirePermission("transport_settings", "update"), patchSetting);

router.delete("/settings/:id", requirePermission("transport_settings", "delete"), destroySetting);

router.put("/attendance", requireAdminHrd, putAttendance);

router.post("/calculate", requireAdminHrd, calculateTransport);

router.get("/months", requirePermission("transport", "read"), transportMonths);

router.get("/me", requirePermission("transport", "read"), myTransport);

router.get("/history", requirePermission("transport", "read"), transportHistory);

export default router;
