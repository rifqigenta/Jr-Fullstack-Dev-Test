import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware.js";

import { requirePermission } from "../middlewares/permission.middleware.js";

const router = Router();

router.get("/users", requireAuth, requirePermission("users", "read"), (req, res) => {
  res.json({
    success: true,
    message: "Diizinkan membaca modul users.",
  });
});

router.get("/employees", requireAuth, requirePermission("employees", "read"), (req, res) => {
  res.json({
    success: true,
    message: "Diizinkan membaca modul employees.",
  });
});

router.post("/employees", requireAuth, requirePermission("employees", "create"), (req, res) => {
  res.json({
    success: true,
    message: "Diizinkan membuat pegawai.",
  });
});

export default router;
