import { createRequire } from "module";
import { SymfonyApiCoursRepository } from "../api/SymfonyApiCoursRepository.js";
import { DeepSeekService } from "../ia/DeepSeekService.js";
import { BridgeIAService } from "../ia/BridgeIAService.js";
import { BridgeVerificationService } from "../ia/BridgeVerificationService.js";
import { CliAgentBridgeClient } from "../ia/CliAgentBridgeClient.js";
import { CreerCours } from "../../domain/use-cases/CreerCours.js";
import { ReviserCours } from "../../domain/use-cases/ReviserCours.js";
import { ListerCours } from "../../domain/use-cases/ListerCours.js";
import { GererMenus } from "../../domain/use-cases/GererMenus.js";
import { OrchestrerCours } from "../../domain/use-cases/OrchestrerCours.js";
import { OpenAIImageService } from "../ia/OpenAIImageService.js";
import { OpenAIVerificationService } from "../ia/OpenAIVerificationService.js";
import { DeterministicCourseValidator } from "../../domain/services/DeterministicCourseValidator.js";

const require = createRequire(import.meta.url);

export class Container {
  constructor(config) {
    this.config = config;
    this.instances = {};
  }

  getDatabasePool() {
    if (!this.instances.databasePool) {
      // Lazy-load MySQL only when the legacy driver is explicitly selected.
      // This keeps the Symfony bootstrap free of missing database modules.
      const { createPool } = require("../database/connection.js");
      this.instances.databasePool = createPool({
        host: this.config.database.host,
        port: this.config.database.port,
        database: this.config.database.name,
        user: this.config.database.user,
        password: this.config.database.password
      });
    }

    return this.instances.databasePool;
  }

  getCoursRepository() {
    if (!this.instances.coursRepository) {
      if (this.config.repositoryDriver === "symfony") {
        this.instances.coursRepository = new SymfonyApiCoursRepository(
          this.config.symfonyApi
        );
      } else {
        const { MySQLCoursRepository } = require("../database/MySQLCoursRepository.js");
        const pool = this.getDatabasePool();
        this.instances.coursRepository = new MySQLCoursRepository(pool);
      }
    }

    return this.instances.coursRepository;
  }

  getBridgeClient() {
    if (!this.instances.bridgeClient) {
      this.instances.bridgeClient = new CliAgentBridgeClient(this.config.cliAgentBridge);
    }
    return this.instances.bridgeClient;
  }

  getIAService() {
    if (!this.instances.iaService) {
      if (this.config.aiExecutionMode === "bridge") {
        this.instances.iaService = new BridgeIAService(this.getBridgeClient());
      } else {
        this.instances.iaService = new DeepSeekService(
          this.config.deepseek.apiKey
        );
      }
    }

    return this.instances.iaService;
  }

  getCreerCoursUseCase() {
    return new CreerCours(this.getCoursRepository(), this.getIAService());
  }

  getReviserCoursUseCase() {
    return new ReviserCours(this.getCoursRepository(), this.getIAService());
  }

  getListerCoursUseCase() {
    return new ListerCours(this.getCoursRepository());
  }

  getGererMenusUseCase() {
    return new GererMenus(this.getCoursRepository());
  }

  getVerificationService() {
    if (!this.instances.verifier) {
      if (this.config.aiExecutionMode === "bridge") {
        this.instances.verifier = new BridgeVerificationService(this.getBridgeClient());
      } else {
        this.instances.verifier = new OpenAIVerificationService(this.config.openai.apiKey, this.config.openai.verifierModel);
      }
    }
    return this.instances.verifier;
  }

  getCourseOrchestrationService() {
    if (!this.instances.courseOrchestration) {
      const imageService = this.config.openai.apiKey ? new OpenAIImageService(this.config.openai.apiKey, this.config.openai.imageModel) : null;
      this.instances.courseOrchestration = new OrchestrerCours(this.getCoursRepository(), this.getIAService(), imageService, this.getVerificationService(), new DeterministicCourseValidator());
    }
    return this.instances.courseOrchestration;
  }

  async dispose() {
    if (this.instances.databasePool) {
      await this.instances.databasePool.end();
    }

    this.instances = {};
  }
}
