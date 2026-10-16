import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { requireAdminHrd } from "../../middlewares/admin-hrd.middleware.js";

import { listSettings, storeSetting, patchSetting, destroySetting, putAttendance, calculateTransport, myTransport, transportHistory } from "./transport.controller.js";

const router = Router();

router.use(requireAuth);

// Pengaturan tarif: Admin HRD.
router.get("/settings", requirePermission("transport_settings", "read"), listSettings);

router.post("/settings", requirePermission("transport_settings", "create"), storeSetting);

router.patch("/settings/:id", requirePermission("transport_settings", "update"), patchSetting);

router.delete("/settings/:id", requirePermission("transport_settings", "delete"), destroySetting);

// Absensi dan perhitungan massal: Admin HRD.
router.put("/attendance", requireAdminHrd, putAttendance);

router.post("/calculate", requireAdminHrd, calculateTransport);

// Tunjangan sendiri: Admin HRD dan Manager HRD.
router.get("/me", requirePermission("transport", "read"), myTransport);

// Riwayat seluruh pegawai: Admin HRD saja.
router.get("/history", requireAdminHrd, transportHistory);

export default router;
