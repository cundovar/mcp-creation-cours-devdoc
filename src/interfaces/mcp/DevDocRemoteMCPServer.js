import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

export class DevDocRemoteMCPServer {
  constructor(container) {
    this.repository = container.getCoursRepository();
    this.orchestration = container.getCourseOrchestrationService();
    this.listerCours = container.getListerCoursUseCase();
    this.n8nCourseBatch = container.getN8NCourseBatchClient();
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
          case "decrire_capacites_devdoc":
            return this.result(this.describeCapabilities());
          case "creer_brouillon_cours":
            return this.result(await this.createDraft(args));
          case "creer_lot_brouillons_cours":
            return this.result(await this.createDraftBatch(args));
          case "voir_brouillon_cours":
            return this.result(await this.getDraft(args));
          case "preparer_emplacement_devdoc":
            return this.result(await this.preparePlacement(args));
          case "reaffecter_brouillon_cours":
            return this.result(await this.reassignDraft(args));
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
        name: "decrire_capacites_devdoc",
        title: "Décrire les capacités et le parcours DevDoc",
        description:
          "Appelez cet outil avant toute demande complexe. Il décrit précisément ce qui peut être créé, les confirmations requises et le rôle de n8n.",
        inputSchema: { type: "object", additionalProperties: false, properties: {} },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "creer_brouillon_cours",
        title: "Créer et vérifier un brouillon de cours DevDoc",
        description:
          "Utilisez cet outil lorsqu’un utilisateur demande de créer un cours. Il démarre une génération en arrière-plan et retourne immédiatement generationId. Consultez ensuite voir_brouillon_cours avec cet identifiant. Ne rédigez pas le cours vous-même et ne créez pas un second brouillon pendant le traitement. Il ne publie jamais le cours.",
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
        name: "creer_lot_brouillons_cours",
        title: "Préparer ou lancer une formation DevDoc complète via n8n",
        description:
          "Transforme une demande simple en arborescence supermenu → catégorie → menus → cours. Appelez d’abord avec confirmation=false pour présenter le plan. Après confirmation explicite, rappelez avec confirmation=true : n8n crée l’arborescence et traite les brouillons séquentiellement sans les publier.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            batchId: { type: "string", minLength: 8, maxLength: 100, pattern: "^[A-Za-z0-9._:-]+$" },
            superMenu: { type: "string", minLength: 2, maxLength: 100 },
            categorie: { type: "string", minLength: 1, maxLength: 100 },
            confirmation: {
              type: "boolean",
              description: "Doit rester false pour la proposition, puis être true après validation explicite de l’utilisateur."
            },
            menus: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  nom: { type: "string", minLength: 1, maxLength: 150 },
                  niveau: { type: "string", minLength: 1, maxLength: 100 },
                  position: { type: "string", minLength: 1, maxLength: 100 },
                  cours: {
                    type: "array",
                    minItems: 1,
                    maxItems: 20,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        requestId: { type: "string", minLength: 8, maxLength: 100, pattern: "^[A-Za-z0-9._:-]+$" },
                        titre: { type: "string", minLength: 3, maxLength: 180 },
                        description: { type: "string", maxLength: 2000 },
                        duree: { type: "string", minLength: 1, maxLength: 100 }
                      },
                      required: ["requestId", "titre", "duree"]
                    }
                  }
                },
                required: ["nom", "niveau", "cours"]
              }
            }
          },
          required: ["batchId", "superMenu", "categorie", "menus", "confirmation"]
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
          "Utilisez cet outil avec le generationId reçu lors de la création. Tant que processing vaut true, conservez le même identifiant et consultez de nouveau plus tard sans recréer ni improviser le cours.",
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
        name: "preparer_emplacement_devdoc",
        title: "Préparer un emplacement DevDoc",
        description:
          "Utilisez cet outil quand la technologie demandée n’existe pas encore ou quand l’utilisateur ne sait pas où classer le cours. Sans confirmation, il propose les créations. Avec confirmation=true, il crée uniquement le supermenu, la catégorie et les menus indiqués ; il ne crée ni ne publie de cours.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            superMenu: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "Supermenu souhaité, par exemple Automatisation."
            },
            category: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Nouvelle technologie ou catégorie, par exemple n8n."
            },
            menus: {
              type: "array",
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 150 },
                  level: { type: "string", minLength: 1, maxLength: 100 },
                  position: { type: "string", minLength: 1, maxLength: 100 }
                },
                required: ["name"]
              }
            },
            confirmation: {
              type: "boolean",
              default: false,
              description: "Obligatoire à true pour créer l’arborescence proposée."
            }
          },
          required: ["superMenu", "category"]
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
        }
      },
      {
        name: "reaffecter_brouillon_cours",
        title: "Réaffecter un brouillon DevDoc",
        description:
          "Utilisez cet outil pour rattacher un brouillon non publié à un autre menu existant. Le menu doit appartenir à la même technologie et au même niveau que le brouillon.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            generationId: { type: "integer", minimum: 1 },
            menuId: { type: "integer", minimum: 1 }
          },
          required: ["generationId", "menuId"]
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
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

  async resumePendingGenerations() {
    // n8n owns durable execution and retries. A pending generation does not
    // contain enough context to recreate a whole formation safely at startup.
    return 0;
  }

  describeCapabilities() {
    return {
      version: 2,
      architecture: {
        mcp: "Comprend la demande, propose un plan, attend la confirmation et enregistre les générations.",
        n8n: "Crée ou réutilise le supermenu, la catégorie et les menus, puis génère et vérifie les cours un par un.",
        devdoc: "Conserve les brouillons vérifiés et publie uniquement après une confirmation séparée."
      },
      can: [
        "lister le catalogue, les niveaux et les menus",
        "proposer une formation sans modifier DevDoc",
        "créer ou réutiliser un supermenu, une catégorie et plusieurs menus",
        "générer et vérifier un ou plusieurs brouillons via n8n",
        "consulter, réaffecter et publier un brouillon vérifié"
      ],
      safeguards: [
        "confirmation explicite avant de créer l’arborescence ou les générations d’un lot",
        "traitement séquentiel des cours dans n8n",
        "aucune publication automatique",
        "confirmation explicite et distincte pour chaque publication"
      ],
      recommendedFlow: [
        "Appeler lister_catalogue_devdoc si le classement existant est utile.",
        "Construire le plan pédagogique et appeler creer_lot_brouillons_cours avec confirmation=false.",
        "Présenter le plan et attendre l’accord explicite de l’utilisateur.",
        "Rappeler exactement le même lot avec confirmation=true.",
        "Suivre les generationId avec voir_brouillon_cours.",
        "Ne publier qu’après une nouvelle confirmation explicite."
      ]
    };
  }

  async preparePlacement({ superMenu, category, menus = [], confirmation = false }) {
    this.validatePlacementArgs({ superMenu, category, menus });
    const [superMenus, categories] = await Promise.all([
      this.repository.listerSuperMenus(),
      this.repository.listerCategories()
    ]);
    const existingSuperMenu = superMenus.find((item) => this.same(item.name, superMenu));
    const existingCategory = categories.find((item) => this.same(item.name, category));
    if (existingCategory?.superMenu?.id && existingSuperMenu?.id && existingCategory.superMenu.id !== existingSuperMenu.id) {
      throw new Error("Cette catégorie appartient déjà à un autre supermenu.");
    }

    const requestedMenus = menus.length ? menus : [{ name: "Cours", level: "newbie", position: "menu-gauche" }];
    const categoryId = existingCategory?.id;
    const existingMenus = categoryId
      ? await this.repository.listerMenus({ categoryId })
      : [];
    const missingMenus = requestedMenus.filter((request) => !existingMenus.some((menu) =>
      this.same(menu.label, request.name) &&
      (!request.level || this.same(menu.niveauCoursName, request.level))
    ));
    const changes = [
      ...(!existingSuperMenu ? [{ type: "supermenu", name: superMenu }] : []),
      ...(!existingCategory ? [{ type: "category", name: category, superMenu: superMenu }] : []),
      ...missingMenus.map((request) => ({
        type: "menu",
        name: request.name,
        level: request.level || null,
        position: request.position || null
      }))
    ];

    if (changes.length && confirmation !== true) {
      return {
        requiresConfirmation: true,
        confirmationRequired: true,
        changes,
        message: "Confirmez ces créations pour modifier l’arborescence DevDoc."
      };
    }

    const formation = await this.orchestration.preparerFormation({
      superMenu,
      category,
      menus: requestedMenus
    });
    return {
      requiresConfirmation: false,
      confirmationRequired: false,
      created: changes,
      ...formation,
      message: "L’emplacement DevDoc est prêt. Utilisez le menu retourné pour créer le brouillon."
    };
  }

  async createDraft(args) {
    this.validateDraftArgs(args);
    const payload = {
      title: args.titre.trim(),
      brief: String(args.description || "").trim(),
      technology: args.technologie.trim(),
      level: args.niveau.trim(),
      duration: args.duree.trim(),
      ...(args.menuId ? { menuId: Number(args.menuId) } : {}),
      ...(args.nouveauMenuLabel
        ? { newMenuLabel: args.nouveauMenuLabel.trim() }
        : {})
    };

    if (typeof this.repository.trouverTechnologieParNom === "function") {
      const technology = await this.repository.trouverTechnologieParNom(payload.technology);
      if (!technology) {
        const suggestedSuperMenu = this.same(payload.technology, "n8n")
          ? "Automatisation"
          : "Nouvelles technologies";
        return {
          requiresPlacement: true,
          placement: {
            superMenu: suggestedSuperMenu,
            category: payload.technology,
            menus: [{ name: payload.title, level: payload.level, position: "menu-gauche" }]
          },
          message: "Cette technologie n’existe pas encore dans DevDoc. Utilisez preparer_emplacement_devdoc pour proposer sa création, puis demandez confirmation avant de relancer le cours."
        };
      }
    }

    const plan = await this.buildSingleCoursePlan(args, payload);
    const generation = await this.repository.creerGeneration({
      batchId: "mcp-devdoc",
      externalId: args.requestId,
      payload: {
        ...payload,
        superMenu: plan.superMenu,
        menuName: plan.menus[0].name,
        menuPosition: plan.menus[0].position
      }
    });

    if (generation.courseId || generation.status === "succeeded") {
      return this.summarizeGeneration(generation, {
        reused: true,
        message: "Cette demande est déjà publiée. Aucun doublon n’a été créé."
      });
    }

    if (generation.status === "ready" || generation.verificationReport?.approved === true) {
      return this.summarizeGeneration(generation, {
        reused: true,
        readyToPublish: true,
        message: "Ce brouillon est déjà vérifié. Demandez une confirmation explicite avant publication."
      });
    }

    if (["queued", "generating", "verifying"].includes(generation.status)) {
      return this.summarizeGeneration(generation, {
        reused: true,
        processing: true,
        pollAfterSeconds: 15,
        message: "Cette génération est déjà orchestrée par n8n. Consultez voir_brouillon_cours avec le même generationId."
      });
    }

    await this.queueWithN8N([generation], {
      ...plan,
      menus: [{ ...plan.menus[0], generationIds: [Number(generation.id)] }]
    });
    return this.summarizeGeneration(generation, {
      reused: false,
      processing: true,
      pollAfterSeconds: 15,
      message: "La génération a été transmise à n8n. Conservez generationId et consultez voir_brouillon_cours ; ne recréez pas le contenu dans la conversation."
    });
  }

  async createDraftBatch({ batchId, superMenu, categorie, menus, confirmation = false }) {
    if (!/^[A-Za-z0-9._:-]{8,100}$/.test(String(batchId || ""))) {
      throw new Error("batchId invalide");
    }
    if (typeof superMenu !== "string" || !superMenu.trim()) throw new Error("superMenu est requis");
    if (typeof categorie !== "string" || !categorie.trim()) throw new Error("categorie est requise");
    if (!Array.isArray(menus) || menus.length < 1 || menus.length > 20) {
      throw new Error("Le lot doit contenir entre 1 et 20 menus");
    }

    const normalizedMenus = menus.map((menu) => {
      if (!menu || typeof menu.nom !== "string" || !menu.nom.trim()) throw new Error("Chaque menu doit avoir un nom");
      if (typeof menu.niveau !== "string" || !menu.niveau.trim()) throw new Error("Chaque menu doit avoir un niveau");
      if (!Array.isArray(menu.cours) || menu.cours.length < 1 || menu.cours.length > 20) {
        throw new Error("Chaque menu doit contenir entre 1 et 20 cours");
      }
      return {
        name: menu.nom.trim(),
        level: menu.niveau.trim(),
        position: String(menu.position || "menu-gauche").trim(),
        courses: menu.cours.map((course) => ({
          requestId: course.requestId,
          title: typeof course.titre === "string" ? course.titre.trim() : course.titre,
          brief: String(course.description || "").trim(),
          duration: typeof course.duree === "string" ? course.duree.trim() : course.duree
        }))
      };
    });
    const courses = normalizedMenus.flatMap((menu) => menu.courses);
    if (courses.length > 50) throw new Error("Le lot doit contenir au plus 50 cours");
    for (const course of courses) {
      this.validateDraftArgs({
        requestId: course.requestId,
        titre: course.title,
        technologie: categorie,
        niveau: "défini par le menu",
        duree: course.duration
      });
    }
    const requestIds = courses.map((course) => course.requestId);
    if (new Set(requestIds).size !== requestIds.length) {
      throw new Error("Chaque requestId du lot doit être unique");
    }

    const preview = {
      batchId,
      superMenu: superMenu.trim(),
      category: categorie.trim(),
      menus: normalizedMenus.map((menu) => ({
        name: menu.name,
        level: menu.level,
        position: menu.position,
        courses: menu.courses
      }))
    };
    if (confirmation !== true) {
      return {
        requiresConfirmation: true,
        confirmationRequired: true,
        count: courses.length,
        plan: preview,
        message: "Aucune donnée n’a été créée. Présentez ce plan puis rappelez le même lot avec confirmation=true après l’accord explicite de l’utilisateur."
      };
    }

    const generations = [];
    const generationMenus = [];
    for (const menu of normalizedMenus) {
      const generationIds = [];
      for (const course of menu.courses) {
        const generation = await this.repository.creerGeneration({
          batchId,
          externalId: course.requestId,
          payload: {
            title: course.title,
            brief: course.brief,
            technology: categorie.trim(),
            level: menu.level,
            duration: course.duration,
            superMenu: superMenu.trim(),
            menuName: menu.name,
            menuPosition: menu.position
          }
        });
        generations.push(generation);
        if (["pending", "failed"].includes(generation.status)) {
          generationIds.push(Number(generation.id));
        }
      }
      if (generationIds.length) {
        generationMenus.push({
          name: menu.name,
          level: menu.level,
          position: menu.position,
          generationIds
        });
      }
    }

    const dispatchable = generations.filter((generation) =>
      ["pending", "failed"].includes(generation.status)
    );
    if (dispatchable.length) {
      await this.queueWithN8N(dispatchable, {
        batchId,
        superMenu: superMenu.trim(),
        category: categorie.trim(),
        menus: generationMenus
      });
    }

    return {
      batchId,
      processing: dispatchable.length > 0,
      count: generations.length,
      generations: generations.map((generation) =>
        this.summarizeGeneration(generation, {
          processing: [
            "pending",
            "failed",
            "queued",
            "generating",
            "verifying"
          ].includes(generation.status)
        })
      ),
      message: dispatchable.length
        ? `${dispatchable.length} génération(s) transmise(s) à n8n dans un seul lot.`
        : "Toutes les générations de ce lot étaient déjà en cours ou terminées."
    };
  }

  async queueWithN8N(generations, plan) {
    const ids = generations.map((generation) => Number(generation.id));
    await Promise.all(
      ids.map((id) =>
        this.repository.mettreAJourGeneration(id, { status: "queued" })
      )
    );
    try {
      await this.n8nCourseBatch.enqueue(plan);
    } catch (error) {
      await Promise.allSettled(
        ids.map((id) =>
          this.repository.mettreAJourGeneration(id, { status: "pending" })
        )
      );
      throw error;
    }
  }

  async buildSingleCoursePlan(args, payload) {
    const categories = await this.repository.listerCategories();
    const category = categories.find((item) => this.same(item.name, payload.technology));
    if (!category) throw new Error(`Technologie DevDoc inconnue: ${payload.technology}`);
    const superMenu = category.superMenu?.name;
    if (!superMenu) throw new Error(`La catégorie ${payload.technology} n’est rattachée à aucun supermenu`);
    const menu = args.menuId
      ? await this.repository.trouverMenuParId(Number(args.menuId))
      : null;
    if (menu && menu.categoryId !== category.id) {
      throw new Error("Le menu choisi n’appartient pas à la technologie demandée");
    }
    return {
      batchId: "mcp-devdoc",
      superMenu,
      category: payload.technology,
      menus: [{
        name: menu?.label || String(args.nouveauMenuLabel || payload.title).trim(),
        level: payload.level,
        position: menu?.positionMenusName || "menu-gauche"
      }]
    };
  }

  async getDraft({ generationId, inclureHtml = false }) {
    const id = this.requirePositiveInteger(generationId, "generationId");
    const generation = await this.repository.voirGeneration(id);
    const processing = ["pending", "queued", "generating", "verifying"].includes(generation.status);
    return this.summarizeGeneration(generation, {
      includeHtml: inclureHtml === true,
      processing,
      pollAfterSeconds: processing ? 15 : undefined,
      message: processing
        ? "Le serveur travaille encore. Réutilisez ce generationId dans voir_brouillon_cours ; ne générez pas un autre cours."
        : generation.status === "ready"
          ? "Le brouillon est vérifié et prêt. Une confirmation explicite est requise avant publication."
          : generation.status === "failed"
            ? "La génération a échoué. Relancez creer_brouillon_cours avec le même requestId pour réessayer sans créer de doublon."
            : undefined
    });
  }

  async reassignDraft({ generationId, menuId }) {
    const id = this.requirePositiveInteger(generationId, "generationId");
    const targetMenuId = this.requirePositiveInteger(menuId, "menuId");
    const generation = await this.repository.voirGeneration(id);
    if (generation.courseId) throw new Error("Un cours déjà publié ne peut pas être réaffecté par cet outil.");

    const [menu, technology, level] = await Promise.all([
      this.repository.trouverMenuParId(targetMenuId),
      this.repository.trouverTechnologieParNom(generation.payload?.technology),
      this.repository.trouverNiveauParNom(generation.payload?.level)
    ]);
    if (!technology || menu.categoryId !== technology.id) {
      throw new Error("Le menu choisi n’appartient pas à la technologie du brouillon.");
    }
    if (level && menu.niveauCoursId && menu.niveauCoursId !== level.id) {
      throw new Error("Le menu choisi n’appartient pas au niveau du brouillon.");
    }

    const payload = { ...generation.payload, menuId: targetMenuId };
    delete payload.newMenuLabel;
    const updated = await this.repository.mettreAJourGeneration(id, {
      status: generation.verificationReport?.approved === true ? "ready" : generation.status,
      payload
    });
    return this.summarizeGeneration(updated, {
      message: "Le brouillon a été réaffecté au menu demandé."
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
    const validMenus = menus.filter((menu) => menu.categoryId);
    return { technologies, niveaux, menus: validMenus, ignoredMenusSansCategorie: menus.length - validMenus.length };
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
      processing: options.processing ?? false,
      pollAfterSeconds: options.pollAfterSeconds,
      verificationAttempts: generation?.verificationAttempts,
      verificationReport: generation?.verificationReport || null,
      candidate,
      technicalError: generation?.technicalError || null,
      message: options.message
    };
  }

  validatePlacementArgs({ superMenu, category, menus }) {
    if (typeof superMenu !== "string" || superMenu.trim() === "") throw new Error("superMenu est requis");
    if (typeof category !== "string" || category.trim() === "") throw new Error("category est requis");
    if (!Array.isArray(menus) || menus.length > 20) throw new Error("menus doit contenir au plus 20 éléments");
    for (const menu of menus) {
      if (!menu || typeof menu.name !== "string" || menu.name.trim() === "") throw new Error("Chaque menu doit avoir un nom");
    }
  }

  same(left, right) {
    return String(left || "").trim().toLocaleLowerCase("fr") === String(right || "").trim().toLocaleLowerCase("fr");
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
