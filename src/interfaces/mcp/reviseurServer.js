#!/usr/bin/env node
import { config, validateConfig } from "../../../config/config.js";
import { Container } from "../../infrastructure/di/container.js";
import { ReviseurMCPServer } from "./ReviseurMCPServer.js";

async function main() {
  try {
    validateConfig();
    const container = new Container(config);
    const server = new ReviseurMCPServer(container);
    await server.start();
  } catch (error) {
    console.error("Erreur fatale:", error);
    process.exit(1);
  }
}

main();
