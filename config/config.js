import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const config = {
  env: {
    env: process.env.NODE_ENV || "development",
    isDevelopment: (process.env.NODE_ENV || "development") === "development",
    isProduction: process.env.NODE_ENV === "production"
  },
  repositoryDriver: process.env.REPOSITORY_DRIVER || "mysql",
  database: {
    host: process.env.DB_HOST || "localhost",
    port: Number.parseInt(process.env.DB_PORT || "3306", 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },
  symfonyApi: {
    baseUrl: process.env.SYMFONY_API_BASE_URL || "http://localhost:8080",
    apiKey: process.env.N8N_API_KEY || "",
    niveauxPath: process.env.SYMFONY_API_NIVEAUX_PATH || "/api/admin/niveau-cours"
  },
  ai: {
    executionMode: process.env.AI_EXECUTION_MODE || "direct",
    bridge: {
      socketPath:
        process.env.CLI_AGENT_BRIDGE_SOCKET || "/run/cli-agent-bridge/bridge.sock",
      project: process.env.CLI_AGENT_BRIDGE_PROJECT || "devdoc",
      token: process.env.CLI_AGENT_BRIDGE_TOKEN || "",
      timeoutMs: Number.parseInt(process.env.CLI_AGENT_BRIDGE_TIMEOUT_MS || "310000", 10)
    }
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    verifierModel: process.env.OPENAI_VERIFIER_MODEL || "gpt-5-mini"
  },
  http: {
    port: Number.parseInt(process.env.HTTP_PORT || "3000", 10),
    corsOrigin: process.env.HTTP_CORS_ORIGIN || "*",
    orchestrationToken: process.env.ORCHESTRATION_API_TOKEN || ""
  },
  log: {
    level: process.env.LOG_LEVEL || "info"
  }
};

export function validateConfig() {
  const required = {};

  if (config.ai.executionMode === "bridge") {
    required.CLI_AGENT_BRIDGE_TOKEN = config.ai.bridge.token;
  } else {
    required.DEEPSEEK_API_KEY = config.deepseek.apiKey;
  }

  if (config.repositoryDriver === "mysql") {
    Object.assign(required, {
      DB_HOST: config.database.host,
      DB_NAME: config.database.name,
      DB_USER: config.database.user,
      DB_PASSWORD: config.database.password
    });
  }

  if (config.repositoryDriver === "symfony") {
    Object.assign(required, {
      SYMFONY_API_BASE_URL: config.symfonyApi.baseUrl,
      N8N_API_KEY: config.symfonyApi.apiKey
    });
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Variables manquantes dans .env: ${missing.join(", ")}`
    );
  }
}
