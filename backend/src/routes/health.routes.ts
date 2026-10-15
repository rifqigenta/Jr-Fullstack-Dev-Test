import { Router } from "express";
import { checkDatabaseConnection } from "../config/database.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "JMC Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/db", async (_req, res) => {
  const connected = await checkDatabaseConnection();

  if (!connected) {
    res.status(503).json({
      success: false,
      message: "Database connection unavailable",
    });

    return;
  }

  res.status(200).json({
    success: true,
    message: "MariaDB connection successful",
  });
});
