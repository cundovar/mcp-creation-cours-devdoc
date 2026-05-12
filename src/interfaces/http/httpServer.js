import { config, validateConfig } from "../../../config/config.js";
import { Container } from "../../infrastructure/di/container.js";
import { HTTPServer } from "./server.js";

async function main() {
  try {
    validateConfig();
    const container = new Container(config);
    const server = new HTTPServer(container, config);

    await server.start();

    const shutdown = async () => {
      await server.stop();
      await container.dispose();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Erreur fatale:", error);
    process.exit(1);
  }
}

main();
