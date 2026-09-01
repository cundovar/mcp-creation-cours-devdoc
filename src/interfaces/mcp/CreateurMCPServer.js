import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

export class CreateurMCPServer {
  constructor(container) {
    this.container = container;
    this.creerCoursUseCase = container.getCreerCoursUseCase();
    this.listerCoursUseCase = container.getListerCoursUseCase();
    this.gererMenusUseCase = container.getGererMenusUseCase();
    this.coursRepository = container.getCoursRepository();
    this.orchestration = container.getCourseOrchestrationService();

    this.server = new Server(
      { name: "agent-createur-cours", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.setupTools();
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "preparer_formation",
          description: "Crée ou réutilise un supermenu, une catégorie et ses menus.",
          inputSchema: { type: "object", properties: { superMenu: { type: "string" }, category: { type: "string" }, menus: { type: "array", items: { type: "object" } } }, required: ["superMenu", "category"] }
        },
        {
          name: "lister_arborescence",
          description: "Liste les supermenus, catégories, menus et cours disponibles.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "generer_candidat_cours",
          description: "Génère un candidat de cours sans écrire de cours dans Symfony.",
          inputSchema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, technology: { type: "string" }, level: { type: "string" }, duration: { type: "string" } }, required: ["title", "technology", "level", "duration"] }
        },
        {
          name: "generer_illustrations",
          description: "Génère et stocke les illustrations temporaires d’une génération.",
          inputSchema: { type: "object", properties: { generationId: { type: "number" }, illustrations: { type: "array" } }, required: ["generationId", "illustrations"] }
        },
        {
          name: "associer_illustrations",
          description: "Insère des médias Symfony dans le HTML d’un candidat.",
          inputSchema: { type: "object", properties: { candidate: { type: "object" }, images: { type: "array" } }, required: ["candidate"] }
        },
        {
          name: "verifier_candidat",
          description: "Vérifie un candidat avec un contexte IA indépendant.",
          inputSchema: { type: "object", properties: { candidate: { type: "object" }, images: { type: "array" } }, required: ["candidate"] }
        },
        {
          name: "corriger_candidat",
          description: "Corrige uniquement les problèmes signalés par le vérificateur.",
          inputSchema: { type: "object", properties: { candidate: { type: "object" }, report: { type: "object" }, technology: { type: "string" }, level: { type: "string" } }, required: ["candidate", "report", "technology", "level"] }
        },
        {
          name: "voir_generation",
          description: "Retourne l’état complet d’une génération de cours.",
          inputSchema: { type: "object", properties: { generationId: { type: "number" } }, required: ["generationId"] }
        },
        {
          name: "finaliser_cours",
          description: "Crée le cours visible après un rapport de vérification positif.",
          inputSchema: { type: "object", properties: { generationId: { type: "number" } }, required: ["generationId"] }
        },
        {
          name: "signaler_echec",
          description: "Clôture une génération refusée sans créer de cours.",
          inputSchema: { type: "object", properties: { generationId: { type: "number" }, verificationReport: { type: "object" }, technicalError: { type: "string" } }, required: ["generationId"] }
        },
        {
          name: "creer_cours",
          description:
            "Crée un nouveau cours HTML selon les spécifications fournies.",
          inputSchema: {
            type: "object",
            properties: {
              titre: { type: "string", description: "Titre du cours" },
              description: {
                type: "string",
                description: "Description optionnelle"
              },
              technologie: {
                type: "string",
                description: "Technologie (ex: Node.js, PHP, React...)"
              },
              niveau: {
                type: "string",
                description: "Niveau (Débutant, Intermédiaire, Avancé)"
              },
              duree: {
                type: "string",
                description: "Durée (ex: 2h, 3h30, 1 journée)"
              }
            },
            required: ["titre", "technologie", "niveau", "duree"]
          }
        },
        {
          name: "lister_technologies",
          description: "Liste toutes les technologies disponibles.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "lister_niveaux",
          description: "Liste tous les niveaux disponibles.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "lister_cours_recents",
          description: "Liste les cours IA récents.",
          inputSchema: {
            type: "object",
            properties: {
              limite: {
                type: "number",
                description: "Nombre maximum de cours à retourner"
              }
            }
          }
        },
        {
          name: "lister_menus",
          description: "Liste les menus disponibles, avec filtres optionnels.",
          inputSchema: {
            type: "object",
            properties: {
              technologie: {
                type: "string",
                description: "Nom de la technologie parente"
              },
              niveau: {
                type: "string",
                description: "Nom du niveau de cours"
              },
              categoryId: {
                type: "number",
                description: "ID de catégorie"
              },
              niveauCoursId: {
                type: "number",
                description: "ID du niveau de cours"
              },
              positionMenusId: {
                type: "number",
                description: "ID de la position de menu"
              }
            }
          }
        },
        {
          name: "voir_menu",
          description: "Affiche un menu précis avec ses métadonnées.",
          inputSchema: {
            type: "object",
            properties: {
              menu_id: {
                type: "number",
                description: "Identifiant du menu"
              }
            },
            required: ["menu_id"]
          }
        },
        {
          name: "creer_menu",
          description: "Crée un nouveau menu.",
          inputSchema: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Libellé du menu"
              },
              technologie: {
                type: "string",
                description: "Nom de la technologie parente"
              },
              niveau: {
                type: "string",
                description: "Nom du niveau de cours"
              },
              categoryId: {
                type: "number",
                description: "ID de catégorie"
              },
              niveauCoursId: {
                type: "number",
                description: "ID du niveau de cours"
              },
              positionMenusId: {
                type: "number",
                description: "ID de la position de menu"
              }
            },
            required: ["label"]
          }
        },
        {
          name: "editer_menu",
          description: "Modifie un menu existant.",
          inputSchema: {
            type: "object",
            properties: {
              menu_id: {
                type: "number",
                description: "Identifiant du menu"
              },
              label: {
                type: "string",
                description: "Nouveau libellé du menu"
              },
              technologie: {
                type: "string",
                description: "Nom de la technologie parente"
              },
              niveau: {
                type: "string",
                description: "Nom du niveau de cours"
              },
              categoryId: {
                type: "number",
                description: "ID de catégorie"
              },
              niveauCoursId: {
                type: "number",
                description: "ID du niveau de cours"
              },
              positionMenusId: {
                type: "number",
                description: "ID de la position de menu"
              }
            },
            required: ["menu_id"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "preparer_formation":
            return this.json(await this.orchestration.preparerFormation(args));
          case "lister_arborescence":
            return this.json(await this.handleListerArborescence());
          case "generer_candidat_cours":
            return this.json(await this.orchestration.genererCandidat(args));
          case "generer_illustrations":
            return this.json(await this.orchestration.genererIllustrations(args));
          case "associer_illustrations":
            return this.json(this.orchestration.associerIllustrations(args));
          case "verifier_candidat":
            return this.json(await this.orchestration.verifierCandidat(args));
          case "corriger_candidat":
            return this.json(await this.orchestration.corrigerCandidat(args));
          case "voir_generation":
            return this.json(await this.coursRepository.voirGeneration(args.generationId));
          case "finaliser_cours":
            return this.json(await this.coursRepository.finaliserGeneration(args.generationId));
          case "signaler_echec":
            return this.json(await this.coursRepository.echouerGeneration(args.generationId, { verificationReport: args.verificationReport, technicalError: args.technicalError }));
          case "creer_cours":
            return this.handleCreerCours(args);
          case "lister_technologies":
            return this.handleListerTechnologies();
          case "lister_niveaux":
            return this.handleListerNiveaux();
          case "lister_cours_recents":
            return this.handleListerCoursRecents(args);
          case "lister_menus":
            return this.handleListerMenus(args);
          case "voir_menu":
            return this.handleVoirMenu(args);
          case "creer_menu":
            return this.handleCreerMenu(args);
          case "editer_menu":
            return this.handleEditerMenu(args);
          default:
            throw new Error("Outil inconnu");
        }
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }) }] };
      }
    });
  }

  json(data) { return { content: [{ type: "text", text: JSON.stringify(data) }] }; }

  async handleListerArborescence() {
    const [superMenus, categories, menus, courses] = await Promise.all([
      this.coursRepository.listerSuperMenus(),
      this.coursRepository.listerCategories(),
      this.coursRepository.listerMenus(),
      this.listerCoursUseCase.coursIA()
    ]);

    return { superMenus, categories, menus, courses };
  }

  async handleCreerCours(args) {
    const { titre, description, technologie, niveau, duree } = args || {};

    return this.json({
      deprecated: true,
      message: "La création directe est désactivée : utilisez le candidat, la vérification, puis finaliser_cours.",
      candidate: await this.orchestration.genererCandidat({ title: titre, description, technology: technologie, level: niveau, duration: duree })
    });
  }

  async handleListerTechnologies() {
    const technologies = await this.listerCoursUseCase.technologies();
    const liste = technologies.map((item) => `- ${item.name}`).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `🧰 Technologies disponibles :\n${liste}`
        }
      ]
    };
  }

  async handleListerNiveaux() {
    const niveaux = await this.listerCoursUseCase.niveaux();
    const liste = niveaux.map((item) => `- ${item.name}`).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `📚 Niveaux disponibles :\n${liste}`
        }
      ]
    };
  }

  async handleListerCoursRecents(args) {
    const limite = args?.limite ? Number(args.limite) : 10;
    const cours = await this.listerCoursUseCase.coursIA();
    const selection = cours.slice(0, limite);

    if (!selection.length) {
      return {
        content: [{ type: "text", text: "Aucun cours récent trouvé." }]
      };
    }

    const lignes = selection.map((item) => {
      const date = new Date(item.createdAt).toLocaleDateString("fr-FR");
      return `- ${item.title} (${item.technology?.name} / ${item.level?.name}) [${item.statut}] - ${date}`;
    });

    return {
      content: [
        {
          type: "text",
          text: `🗂️ Cours IA récents :\n${lignes.join("\n")}`
        }
      ]
    };
  }

  async handleListerMenus(args) {
    const menus = await this.gererMenusUseCase.lister(args || {});

    if (!menus.length) {
      return {
        content: [{ type: "text", text: "Aucun menu trouvé." }]
      };
    }

    const lignes = menus.map((item) => {
      const techno = item.categoryName || "sans technologie";
      const niveau = item.niveauCoursName || "sans niveau";
      return `- [${item.id}] ${item.label} (${techno} / ${niveau})`;
    });

    return {
      content: [
        {
          type: "text",
          text: `📂 Menus disponibles :\n${lignes.join("\n")}`
        }
      ]
    };
  }

  async handleVoirMenu(args) {
    const menu = await this.gererMenusUseCase.voir(args?.menu_id);

    let response = `📂 **${menu.label}**\n`;
    response += `🆔 ID : ${menu.id}\n`;
    response += `🧪 Technologie : ${menu.categoryName || "N/A"}\n`;
    response += `🎯 Niveau : ${menu.niveauCoursName || "N/A"}\n`;
    response += `📍 Position : ${menu.positionMenusName || "N/A"}\n`;
    response += `📄 Pages liées : ${menu.pagesCount}\n`;
    response += `📘 Cours liés : ${menu.coursCount}\n`;

    return { content: [{ type: "text", text: response }] };
  }

  async handleCreerMenu(args) {
    const menu = await this.gererMenusUseCase.creer(args || {});

    let response = `✅ **Menu créé**\n\n`;
    response += `📂 Libellé : ${menu.label}\n`;
    response += `🆔 ID : ${menu.id}\n`;
    response += `🧪 Technologie : ${menu.categoryName || "N/A"}\n`;
    response += `🎯 Niveau : ${menu.niveauCoursName || "N/A"}\n`;
    response += `📍 Position : ${menu.positionMenusName || "N/A"}\n`;

    return { content: [{ type: "text", text: response }] };
  }

  async handleEditerMenu(args) {
    const { menu_id, ...data } = args || {};
    const menu = await this.gererMenusUseCase.editer(menu_id, data);

    let response = `✏️ **Menu mis à jour**\n\n`;
    response += `📂 Libellé : ${menu.label}\n`;
    response += `🆔 ID : ${menu.id}\n`;
    response += `🧪 Technologie : ${menu.categoryName || "N/A"}\n`;
    response += `🎯 Niveau : ${menu.niveauCoursName || "N/A"}\n`;
    response += `📍 Position : ${menu.positionMenusName || "N/A"}\n`;

    return { content: [{ type: "text", text: response }] };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Serveur MCP Agent Créateur démarré");
  }
}
