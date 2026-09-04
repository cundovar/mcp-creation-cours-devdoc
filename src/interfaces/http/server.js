import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { setupRoutes } from "./routes.js";
import { DevDocRemoteMCPServer } from "../mcp/DevDocRemoteMCPServer.js";
import { DevDocOAuthProvider } from "../mcp/DevDocOAuthProvider.js";

export class HTTPServer {
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.app = express();
    this.mcpTransports = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    const originConfig = this.config.http.corsOrigin || "*";
    const allowedOrigins = originConfig.includes(",")
      ? originConfig.split(",").map((value) => value.trim())
      : originConfig;

    this.app.set("trust proxy", 1);
    this.app.use(
      cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "Mcp-Session-Id",
          "MCP-Protocol-Version"
        ],
        exposedHeaders: ["Mcp-Session-Id"]
      })
    );
    this.app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
      })
    );
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: false, limit: "8kb" }));

    this.app.use((req, _res, next) => {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path}`
      );
      next();
    });

    this.app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        mcp: Boolean(process.env.MCP_PUBLIC_URL && process.env.MCP_PASSWORD_HASH),
        timestamp: new Date().toISOString()
      });
    });

    this.setupRemoteMcp();

    this.app.use((req, res, next) => {
      const expected = this.config.http.orchestrationToken;
      if (!expected) {
        return res
          .status(503)
          .json({ error: "ORCHESTRATION_API_TOKEN non configuré" });
      }
      const received =
        req.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      const valid =
        received.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
      if (!valid) {
        return res.status(401).json({ error: "Jeton d’orchestration invalide" });
      }
      return next();
    });
  }

  setupRemoteMcp() {
    const configuredPublicUrl = process.env.MCP_PUBLIC_URL;
    const passwordHash = process.env.MCP_PASSWORD_HASH;
    if (!configuredPublicUrl || !passwordHash) {
      console.warn(
        "MCP distant désactivé: MCP_PUBLIC_URL ou MCP_PASSWORD_HASH manquant"
      );
      return;
    }

    const publicBase = new URL(configuredPublicUrl);
    const mcpUrl = new URL("/mcp", publicBase);
    const dataDir =
      process.env.MCP_OAUTH_DATA_DIR || path.resolve(process.cwd(), "data");
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

    const provider = new DevDocOAuthProvider({
      stateFile: path.join(dataDir, "devdoc-oauth-state.json"),
      passwordHash,
      issuer: publicBase,
      resource: mcpUrl
    });

    this.app.get("/login", (req, res) => provider.loginPage(req, res));
    this.app.post("/login", (req, res) => provider.approve(req, res));
    this.app.use(
      mcpAuthRouter({
        provider,
        issuerUrl: publicBase,
        resourceServerUrl: mcpUrl,
        scopesSupported: ["mcp:devdoc"],
        resourceName: "DevDoc — création et publication de cours"
      })
    );

    const auth = requireBearerAuth({
      verifier: provider,
      requiredScopes: [],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl)
    });

    const handleMcpRequest = async (req, res) => {
      try {
        const sessionId = req.headers["mcp-session-id"];
        let transport = sessionId
          ? this.mcpTransports.get(sessionId)
          : undefined;

        if (!transport && !sessionId && isInitializeRequest(req.body)) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) =>
              this.mcpTransports.set(id, transport)
          });
          transport.onclose = () => {
            if (transport.sessionId) {
              this.mcpTransports.delete(transport.sessionId);
            }
          };

          const remoteMcp = new DevDocRemoteMCPServer(this.container);
          await remoteMcp.createServer().connect(transport);
        }

        if (!transport) {
          return res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Session MCP invalide" },
            id: null
          });
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("Erreur MCP:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Erreur interne MCP" },
            id: null
          });
        }
      }
    };

    this.app.post("/mcp", auth, handleMcpRequest);
    this.app.get("/mcp", auth, async (req, res) => {
      const transport = this.mcpTransports.get(req.headers["mcp-session-id"]);
      if (!transport) return res.status(400).send("Session MCP invalide");
      await transport.handleRequest(req, res);
    });
    this.app.delete("/mcp", auth, async (req, res) => {
      const transport = this.mcpTransports.get(req.headers["mcp-session-id"]);
      if (!transport) return res.status(400).send("Session MCP invalide");
      await transport.handleRequest(req, res);
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
    await Promise.allSettled(
      [...this.mcpTransports.values()].map((transport) => transport.close())
    );
    this.mcpTransports.clear();

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
