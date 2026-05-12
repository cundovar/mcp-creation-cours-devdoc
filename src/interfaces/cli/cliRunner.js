#!/usr/bin/env node
import { config, validateConfig } from "../../../config/config.js";
import { Container } from "../../infrastructure/di/container.js";
import { CLI } from "./cli.js";

async function main() {
  try {
    validateConfig();
    const container = new Container(config);
    const cli = new CLI(container);
    await cli.run();
  } catch (error) {
    console.error("Erreur:", error);
    process.exit(1);
  }
}

main();
