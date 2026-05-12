import express from "express";
import cors from "cors";
import helmet from "helmet";
import { setupRoutes } from "./routes.js";

export class HTTPServer {
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    const originConfig = this.config.http.corsOrigin || "*";
    const allowedOrigins = originConfig.includes(",")
      ? originConfig.split(",").map((value) => value.trim())
      : originConfig;

    this.app.use(
      cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
      })
    );
    this.app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
      })
    );
    this.app.use(express.json({ limit: "10mb" }));

    this.app.use((req, _res, next) => {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path}`
      );
      next();
    });

    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });
  }

  setupRoutes() {
    setupRoutes(this.app, this.container);
  }

  setupErrorHandling() {
    this.app.use((req, res) => {
      res.status(404).json({ error: "Route non trouvée", path: req.path });
    });

    this.app.use((err, _req, res, _next) => {
      console.error("Erreur serveur:", err);
      const statusCode = err.statusCode || 500;
      const message = err.message || "Erreur interne du serveur";

      const response = { error: message };
      if (process.env.NODE_ENV === "development") {
        response.stack = err.stack;
      }

      res.status(statusCode).json(response);
    });
  }

  async start() {
    const port = this.config.http.port || 3000;

    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(
          `Serveur HTTP démarré sur le port ${port} (http://localhost:${port})`
        );
        resolve();
      });
    });
  }

  async stop() {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        console.log("Serveur HTTP arrêté");
        resolve();
      });
    });
  }
}
