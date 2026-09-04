import { IIAService } from "../../domain/ports/IIAService.js";

const MAX_CONTENT_CHARS = 7000;

export class BridgeIAService extends IIAService {
  constructor(bridgeClient) {
    super();
    this.bridge = bridgeClient;
  }

  async genererCours(specifications) {
    const data = await this.bridge.completeJson("course_creator", {
      sujet: specifications.sujet,
      technologie: specifications.technologie,
      niveau: specifications.niveau,
      duree: specifications.duree
    });

    return this.validerHTML(data?.html);
  }

  async ameliorerCours(codeActuel, commentaires, contexte) {
    const data = await this.bridge.completeJson("course_corrector", {
      html: codeActuel,
      comments: commentaires,
      context: {
        titre: contexte?.titre,
        technologie: contexte?.technologie,
        niveau: contexte?.niveau,
        duree: contexte?.duree
      }
    });

    return this.validerHTML(data?.html);
  }

  async genererObjectifs(specifications) {
    const data = await this.bridge.completeJson("course_objectives", {
      sujet: specifications.sujet,
      technologie: specifications.technologie,
      niveau: specifications.niveau,
      duree: specifications.duree
    });

    const objectives = Array.isArray(data?.objectives) ? data.objectives : [];
    return objectives.map((objectif) => `- ${objectif}`).join("\n");
  }

  async genererExercices() {
    throw new Error("genererExercices n'est pas disponible via le bridge");
  }

  async genererPlanIllustrations(specifications, contenuCours) {
    const data = await this.bridge.completeJson("course_illustration_planner", {
      sujet: specifications.sujet,
      technologie: specifications.technologie,
      content: (contenuCours || "").slice(0, MAX_CONTENT_CHARS)
    });

    const illustrations = Array.isArray(data?.illustrations) ? data.illustrations : [];

    return illustrations
      .map((item) => ({
        prompt: item?.prompt,
        altText: item?.alt,
        caption: item?.caption
      }))
      .filter((item) => item.prompt && item.altText)
      .slice(0, 3);
  }

  validerHTML(html) {
    const contenu = (html || "").trim();

    if (!/<main\s+class=["']principal["']\s*>/i.test(contenu)) {
      throw new Error(
        "Le HTML généré ne contient pas de balise main class principal"
      );
    }

    return contenu;
  }
}
