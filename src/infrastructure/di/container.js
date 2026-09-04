import { createRequire } from "module";
import { SymfonyApiCoursRepository } from "../api/SymfonyApiCoursRepository.js";
import { DeepSeekService } from "../ia/DeepSeekService.js";
import { BridgeClient } from "../ia/BridgeClient.js";
import { BridgeIAService } from "../ia/BridgeIAService.js";
import { BridgeVerificationService } from "../ia/BridgeVerificationService.js";
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

  getBridgeClient() {
    if (!this.instances.bridgeClient) {
      this.instances.bridgeClient = new BridgeClient(this.config.ai.bridge);
    }
    return this.instances.bridgeClient;
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

  getIAService() {
    if (!this.instances.iaService) {
      if (this.config.ai?.executionMode === "bridge") {
        this.instances.iaService = new BridgeIAService(this.getBridgeClient());
      } else {
        this.instances.iaService = new DeepSeekService(
          this.config.deepseek.apiKey
        );
      }
    }

    return this.instances.iaService;
  }

  getVerificationService() {
    if (!this.instances.verificationService) {
      this.instances.verificationService =
        this.config.ai?.executionMode === "bridge"
          ? new BridgeVerificationService(this.getBridgeClient())
          : new OpenAIVerificationService(
              this.config.openai.apiKey,
              this.config.openai.verifierModel
            );
    }
    return this.instances.verificationService;
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

  getCourseOrchestrationService() {
    if (!this.instances.courseOrchestration) {
      const imageService = this.config.openai.apiKey
        ? new OpenAIImageService(this.config.openai.apiKey, this.config.openai.imageModel)
        : null;
      this.instances.courseOrchestration = new OrchestrerCours(
        this.getCoursRepository(),
        this.getIAService(),
        imageService,
        this.getVerificationService(),
        new DeterministicCourseValidator()
      );
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
