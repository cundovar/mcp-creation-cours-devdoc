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
        return {
          content: [
            {
              type: "text",
              text: error.message,
              isError: true
            }
          ]
        };
      }
    });
  }

  async handleCreerCours(args) {
    const { titre, description, technologie, niveau, duree } = args || {};

    const result = await this.creerCoursUseCase.executer({
      titre,
      description,
      technologie,
      niveau,
      duree
    });

    let response = `✅ **Cours créé**\n\n`;
    response += `📘 Titre : **${result.cours.title}**\n`;
    response += `🧪 Technologie : ${result.cours.technology?.name}\n`;
    response += `🎯 Niveau : ${result.cours.level?.name}\n`;
    response += `⏱️ Durée : ${result.cours.duration}\n`;
    response += `🆔 ID : ${result.id}\n`;
    response += `📌 Statut : brouillon\n`;

    if (result.cours.objectifs) {
      response += `\n🎯 Objectifs :\n${result.cours.objectifs}`;
    }

    return { content: [{ type: "text", text: response }] };
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
