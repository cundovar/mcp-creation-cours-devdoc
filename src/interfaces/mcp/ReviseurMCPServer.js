import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

export class ReviseurMCPServer {
  constructor(container) {
    this.container = container;
    this.reviserCoursUseCase = container.getReviserCoursUseCase();
    this.listerCoursUseCase = container.getListerCoursUseCase();
    this.coursRepository = container.getCoursRepository();

    this.server = new Server(
      { name: "agent-reviseur-cours", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.setupTools();
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "reviser_cours",
          description: "Réviser un cours existant.",
          inputSchema: {
            type: "object",
            properties: {
              cours_id: { type: "number", description: "ID du cours" },
              type_revision: {
                type: "string",
                enum: [
                  "correction",
                  "amelioration",
                  "retour_eleve",
                  "maj_techno"
                ]
              },
              commentaire: { type: "string", description: "Commentaire" },
              appliquer_directement: { type: "boolean" }
            },
            required: ["cours_id", "type_revision", "commentaire"]
          }
        },
        {
          name: "voir_cours",
          description: "Voir un cours par ID.",
          inputSchema: {
            type: "object",
            properties: {
              cours_id: { type: "number" },
              afficher_html: { type: "boolean" }
            },
            required: ["cours_id"]
          }
        },
        {
          name: "lister_revisions",
          description: "Lister les révisions d'un cours.",
          inputSchema: {
            type: "object",
            properties: { cours_id: { type: "number" } },
            required: ["cours_id"]
          }
        },
        {
          name: "appliquer_revision",
          description: "Appliquer une révision à un cours.",
          inputSchema: {
            type: "object",
            properties: { revision_id: { type: "number" } },
            required: ["revision_id"]
          }
        },
        {
          name: "cours_a_reviser",
          description: "Lister les cours à réviser.",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "reviser_cours":
            return this.handleReviserCours(args);
          case "voir_cours":
            return this.handleVoirCours(args);
          case "lister_revisions":
            return this.handleListerRevisions(args);
          case "appliquer_revision":
            return this.handleAppliquerRevision(args);
          case "cours_a_reviser":
            return this.handleCoursAReviser();
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

  async handleReviserCours(args) {
    const result = await this.reviserCoursUseCase.executer({
      coursId: args.cours_id,
      typeRevision: args.type_revision,
      commentaire: args.commentaire,
      appliquerDirectement: args.appliquer_directement
    });

    const pourcentage = result.revision.getPourcentageChangement();

    let response = "✅ Révision créée avec succès\n";
    response += `Type : ${result.revision.typeRevision}\n`;
    response += `Commentaire : ${result.revision.commentaire}\n`;
    response += `Changement : ${pourcentage}%\n`;
    response += `ID révision : ${result.revisionId}\n`;

    response += result.revision.appliquee
      ? "La révision a été appliquée immédiatement."
      : "La révision est en attente d'application.";

    return { content: [{ type: "text", text: response }] };
  }

  async handleVoirCours(args) {
    const cours = await this.coursRepository.trouverParId(args.cours_id);
    if (!cours) {
      throw new Error("Cours non trouvé");
    }

    let response = `📘 **${cours.title}**\n`;
    response += `🧪 Technologie : ${cours.technology?.name}\n`;
    response += `🎯 Niveau : ${cours.level?.name}\n`;
    response += `⏱️ Durée : ${cours.duration}\n`;
    response += `📌 Statut : ${cours.statut}\n`;
    response += `🤖 Généré par IA : ${cours.genereParIA ? "oui" : "non"}\n`;

    if (args.afficher_html) {
      const html = cours.code || "";
      const extrait = html.length > 2000 ? `${html.slice(0, 2000)}...` : html;
      response += `\nHTML :\n${extrait}`;
    }

    return { content: [{ type: "text", text: response }] };
  }

  async handleListerRevisions(args) {
    const revisions = await this.listerCoursUseCase.revisionsParCours(
      args.cours_id
    );

    if (!revisions.length) {
      return {
        content: [{ type: "text", text: "Aucune révision trouvée." }]
      };
    }

    const lignes = revisions.map((revision) => {
      const icon = revision.appliquee ? "✅" : "⏳";
      const date = new Date(revision.dateRevision).toLocaleDateString("fr-FR");
      return `${icon} #${revision.id} ${revision.typeRevision} - ${revision.commentaire} (${date}) - ${revision.getPourcentageChangement()}%`;
    });

    return {
      content: [
        {
          type: "text",
          text: `🧾 Révisions :\n${lignes.join("\n")}`
        }
      ]
    };
  }

  async handleAppliquerRevision(args) {
    const cours = await this.reviserCoursUseCase.appliquerRevision(
      args.revision_id
    );

    const message = `✅ Révision appliquée sur le cours "${cours.title}". L'ancienne version est conservée dans l'historique.`;
    return { content: [{ type: "text", text: message }] };
  }

  async handleCoursAReviser() {
    const cours = await this.listerCoursUseCase.coursAReviser();
    if (!cours.length) {
      return {
        content: [
          { type: "text", text: "✅ Aucun cours ne nécessite de révision." }
        ]
      };
    }

    const lignes = cours.map((item) => {
      const jours = Math.floor(
        (Date.now() - new Date(item.updatedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return `- ${item.title} (${item.technology?.name} / ${item.level?.name}) [ID ${item.id}] - ${jours} jours`;
    });

    const message =
      `🛠️ Cours à réviser :\n${lignes.join("\n")}\n\n` +
      "Ces cours n'ont pas été mis à jour depuis plus de 90 jours.";

    return { content: [{ type: "text", text: message }] };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Serveur MCP Agent Réviseur démarré");
  }
}
