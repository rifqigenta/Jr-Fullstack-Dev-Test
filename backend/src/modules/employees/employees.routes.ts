import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";

import { requirePermission } from "../../middlewares/permission.middleware.js";

import { listEmployees, detailEmployee, storeEmployee, destroyEmployee, patchEmployee } from "./employees.controller.js";

import { uploadEmployeePhoto } from "../../middlewares/upload.middleware.js";

import { uploadPhoto, deletePhoto, handlePhotoUploadError } from "./employees-photo.controller.js";

import { bulkUpdateStatus, bulkDelete } from "./employees-bulk.controller.js";

import { exportEmployeesExcel, exportEmployeesPdf } from "./employees-export.controller.js";

import { exportEmployeeDetailPdf } from "./employees-detail-export.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("employees", "read"), listEmployees);

router.get("/export/excel", requirePermission("employees", "read"), exportEmployeesExcel);

router.get("/export/pdf", requirePermission("employees", "read"), exportEmployeesPdf);

router.patch("/bulk/status", requirePermission("employees", "update"), bulkUpdateStatus);

router.post("/bulk/delete", requirePermission("employees", "delete"), bulkDelete);

router.get("/:id/pdf", requirePermission("employees", "read"), exportEmployeeDetailPdf);

router.get("/:id", requirePermission("employees", "read"), detailEmployee);

router.post("/", requirePermission("employees", "create"), storeEmployee);

router.patch("/:id", requirePermission("employees", "update"), patchEmployee);

router.post("/:id/photo", requirePermission("employees", "update"), uploadEmployeePhoto, handlePhotoUploadError, uploadPhoto);

router.delete("/:id/photo", requirePermission("employees", "update"), deletePhoto);

router.delete("/:id", requirePermission("employees", "delete"), destroyEmployee);

export default router;
