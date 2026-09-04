import crypto from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const MAX_CORRECTIONS = 3;

export class DevDocRemoteMCPServer {
  constructor(container) {
    this.repository = container.getCoursRepository();
    this.orchestration = container.getCourseOrchestrationService();
    this.listerCours = container.getListerCoursUseCase();
  }

  createServer() {
    const server = new Server(
      { name: "devdoc-course-creator", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolDefinitions()
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      try {
        switch (name) {
          case "creer_brouillon_cours":
            return this.result(await this.createDraft(args));
          case "voir_brouillon_cours":
            return this.result(await this.getDraft(args));
          case "publier_cours_devdoc":
            return this.result(await this.publishCourse(args));
          case "lister_cours_devdoc":
            return this.result(await this.listCourses(args));
          case "lister_catalogue_devdoc":
            return this.result(await this.listCatalog());
          default:
            throw new Error(`Outil DevDoc inconnu: ${name}`);
        }
      } catch (error) {
        return this.error(error);
      }
    });

    return server;
  }

  toolDefinitions() {
    return [
      {
        name: "creer_brouillon_cours",
        title: "Créer et vérifier un brouillon de cours DevDoc",
        description:
          "Utilisez cet outil lorsqu’un utilisateur demande de créer un cours. Il génère le contenu, le vérifie et le corrige, puis conserve un brouillon. Il ne publie jamais le cours.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            requestId: {
              type: "string",
              minLength: 8,
              maxLength: 100,
              pattern: "^[A-Za-z0-9._:-]+$",
              description:
                "Identifiant unique et stable de cette demande, à réutiliser lors d’une nouvelle tentative."
            },
            titre: { type: "string", minLength: 3, maxLength: 180 },
            description: { type: "string", maxLength: 2000 },
            technologie: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Technologie, par exemple Python, React ou Symfony."
            },
            niveau: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Niveau pédagogique, par exemple Débutant."
            },
            duree: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Durée cible, par exemple 2 heures."
            },
            menuId: {
              type: "integer",
              minimum: 1,
              description: "Menu DevDoc existant auquel rattacher le cours."
            },
            nouveauMenuLabel: {
              type: "string",
              minLength: 1,
              maxLength: 150,
              description: "Nouveau menu à créer lors de la publication."
            }
          },
          required: ["requestId", "titre", "technologie", "niveau", "duree"]
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
        }
      },
      {
        name: "voir_brouillon_cours",
        title: "Consulter un brouillon de cours",
        description:
          "Utilisez cet outil pour consulter l’état, le rapport de vérification et un aperçu d’un brouillon avant de proposer sa publication.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            generationId: { type: "integer", minimum: 1 },
            inclureHtml: {
              type: "boolean",
              default: false,
              description: "Retourner le HTML intégral au lieu d’un simple aperçu."
            }
          },
          required: ["generationId"]
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "publier_cours_devdoc",
        title: "Publier un cours DevDoc vérifié",
        description:
          "Utilisez cet outil uniquement après que l’utilisateur a explicitement confirmé la publication du brouillon indiqué. La publication est refusée si le dernier rapport n’est pas positif.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            generationId: { type: "integer", minimum: 1 },
            confirmation: {
              type: "boolean",
              description: "Doit être vrai après confirmation explicite de l’utilisateur."
            }
          },
          required: ["generationId", "confirmation"]
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true
        }
      },
      {
        name: "lister_cours_devdoc",
        title: "Lister les cours DevDoc récents",
        description:
          "Utilisez cet outil pour retrouver les cours DevDoc générés récemment.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            limite: { type: "integer", minimum: 1, maximum: 50, default: 10 }
          }
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "lister_catalogue_devdoc",
        title: "Lister le catalogue DevDoc",
        description:
          "Utilisez cet outil avant une création lorsque la technologie, le niveau ou le menu demandé doit être vérifié.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {}
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      }
    ];
  }

  async createDraft(args) {
    this.validateDraftArgs(args);
    const payload = {
      title: args.titre.trim(),
      description: String(args.description || "").trim(),
      technology: args.technologie.trim(),
      level: args.niveau.trim(),
      duration: args.duree.trim(),
      ...(args.menuId ? { menuId: Number(args.menuId) } : {}),
      ...(args.nouveauMenuLabel
        ? { newMenuLabel: args.nouveauMenuLabel.trim() }
        : {})
    };

    const generation = await this.repository.creerGeneration({
      batchId: "mcp-devdoc",
      externalId: args.requestId,
      payload
    });

    if (generation.courseId || generation.candidate) {
      return this.summarizeGeneration(generation, {
        reused: true,
        message:
          "Cette demande existait déjà. Le brouillon enregistré a été réutilisé."
      });
    }

    let candidate = null;
    let report = null;

    try {
      await this.repository.mettreAJourGeneration(generation.id, {
        status: "generating"
      });

      candidate = await this.orchestration.genererCandidat({
        title: payload.title,
        description: payload.description,
        technology: payload.technology,
        level: payload.level,
        duration: payload.duration
      });

      for (let attempt = 0; attempt <= MAX_CORRECTIONS; attempt += 1) {
        report = await this.orchestration.verifierCandidat({
          candidate,
          images: []
        });

        await this.repository.mettreAJourGeneration(generation.id, {
          status: "verifying",
          candidate,
          verificationReport: report
        });

        if (report?.approved === true) {
          const saved = await this.repository.voirGeneration(generation.id);
          return this.summarizeGeneration(saved, {
            readyToPublish: true,
            message:
              "Brouillon généré et vérifié. Demandez une confirmation explicite avant d’utiliser publier_cours_devdoc."
          });
        }

        if (attempt === MAX_CORRECTIONS || !Array.isArray(report?.issues) || report.issues.length === 0) {
          break;
        }

        candidate = await this.orchestration.corrigerCandidat({
          candidate,
          report,
          technology: payload.technology,
          level: payload.level
        });
      }

      const failed = await this.repository.echouerGeneration(generation.id, {
        verificationReport: report,
        technicalError:
          "Le brouillon n’a pas satisfait la vérification après trois corrections."
      });
      return this.summarizeGeneration(failed, {
        readyToPublish: false,
        message:
          "Le brouillon a été conservé comme échec et ne peut pas être publié."
      });
    } catch (error) {
      try {
        await this.repository.echouerGeneration(generation.id, {
          verificationReport: report,
          technicalError:
            error instanceof Error ? error.message : "Erreur de génération"
        });
      } catch {
        // L’erreur initiale reste prioritaire.
      }
      throw error;
    }
  }

  async getDraft({ generationId, inclureHtml = false }) {
    const generation = await this.repository.voirGeneration(
      this.requirePositiveInteger(generationId, "generationId")
    );
    return this.summarizeGeneration(generation, {
      includeHtml: inclureHtml === true
    });
  }

  async publishCourse({ generationId, confirmation }) {
    if (confirmation !== true) {
      throw new Error(
        "Publication annulée : une confirmation explicite de l’utilisateur est obligatoire."
      );
    }
    const published = await this.repository.finaliserGeneration(
      this.requirePositiveInteger(generationId, "generationId")
    );
    return this.summarizeGeneration(published, {
      published: true,
      message: "Le cours vérifié est maintenant publié dans DevDoc."
    });
  }

  async listCourses({ limite = 10 } = {}) {
    const safeLimit = Math.min(
      50,
      this.requirePositiveInteger(limite, "limite")
    );
    const courses = await this.listerCours.coursIA();
    return {
      count: Math.min(courses.length, safeLimit),
      courses: courses.slice(0, safeLimit).map((course) => ({
        id: course.id,
        titre: course.title,
        technologie: course.technology?.name,
        niveau: course.level?.name,
        duree: course.duration,
        statut: course.statut,
        createdAt: course.createdAt
      }))
    };
  }

  async listCatalog() {
    const [technologies, niveaux, menus] = await Promise.all([
      this.listerCours.technologies(),
      this.listerCours.niveaux(),
      this.listerCours.menus()
    ]);
    return { technologies, niveaux, menus };
  }

  summarizeGeneration(generation, options = {}) {
    const html = String(
      generation?.candidate?.codeHTML || generation?.candidate?.html || ""
    );
    const candidate = generation?.candidate
      ? {
          title: generation.candidate.title,
          description: generation.candidate.description,
          duration: generation.candidate.duration,
          objectives: generation.candidate.objectives,
          html:
            options.includeHtml === true
              ? html
              : undefined,
          htmlPreview:
            options.includeHtml === true
              ? undefined
              : html.replace(/\s+/g, " ").slice(0, 1800)
        }
      : null;

    return {
      generationId: generation?.id,
      status: generation?.status,
      courseId: generation?.courseId || null,
      readyToPublish:
        options.readyToPublish ??
        (generation?.verificationReport?.approved === true &&
          !generation?.courseId),
      published: options.published ?? Boolean(generation?.courseId),
      reused: options.reused ?? false,
      verificationAttempts: generation?.verificationAttempts,
      verificationReport: generation?.verificationReport || null,
      candidate,
      technicalError: generation?.technicalError || null,
      message: options.message
    };
  }

  validateDraftArgs(args) {
    for (const [key, value] of Object.entries({
      requestId: args.requestId,
      titre: args.titre,
      technologie: args.technologie,
      niveau: args.niveau,
      duree: args.duree
    })) {
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${key} est requis`);
      }
    }
    if (!/^[A-Za-z0-9._:-]{8,100}$/.test(args.requestId)) {
      throw new Error(
        "requestId doit contenir 8 à 100 caractères alphanumériques, points, tirets, deux-points ou underscores."
      );
    }
  }

  requirePositiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error(`${label} doit être un entier positif`);
    }
    return number;
  }

  result(data) {
    const structuredContent = this.cleanUndefined(data);
    return {
      structuredContent,
      content: [
        {
          type: "text",
          text: JSON.stringify(structuredContent)
        }
      ]
    };
  }

  error(error) {
    const message =
      error instanceof Error ? error.message : "Erreur DevDoc inconnue";
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: message }) }]
    };
  }

  cleanUndefined(value) {
    return JSON.parse(JSON.stringify(value));
  }
}
