import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "./openapi.js";

const router = Router();

router.get("/openapi.json", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(openApiDocument);
});

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    explorer: true,
    customSiteTitle: "JMC Kepegawaian API Docs",
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      filter: true,
    },
  }),
);

export default router;
