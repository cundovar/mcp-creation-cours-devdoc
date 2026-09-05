import { IIAService } from "../../domain/ports/IIAService.js";

const MAX_CONTENT_CHARS = 7000;

export class BridgeIAService extends IIAService {
  constructor(bridgeClient) {
    super();
    this.bridge = bridgeClient;
  }

  async genererCandidat(specifications) {
    const data = await this.bridge.completeJson("course_creator", {
      sujet: specifications.sujet,
      technologie: specifications.technologie,
      niveau: specifications.niveau,
      duree: specifications.duree,
      brief: specifications.brief || ""
    });

    return this.validerCandidat(data);
  }

  async corrigerCandidat(candidate, commentaires, contexte) {
    const data = await this.bridge.completeJson("course_corrector", {
      html: candidate?.codeHTML || candidate?.html || "",
      objectives: this.objectifsEnTableau(candidate?.objectives),
      comments: commentaires,
      context: {
        titre: contexte?.titre,
        technologie: contexte?.technologie,
        niveau: contexte?.niveau,
        duree: contexte?.duree
      }
    });

    return this.validerCandidat(data);
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
      objectives: [
        "Maîtriser les notions techniques présentées",
        "Appliquer les exemples et exercices du cours"
      ],
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

    return this.formaterObjectifs(data?.objectives);
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

  validerCandidat(data) {
    const codeHTML = this.validerHTML(data?.html);
    const objectives = this.formaterObjectifs(data?.objectives);
    if (!objectives) throw new Error("Le candidat généré ne contient aucun objectif");
    const description = String(data?.description || "").trim();
    if (description.length < 30) throw new Error("Le candidat généré ne contient pas une description publique exploitable");
    return { codeHTML, objectives, description };
  }

  formaterObjectifs(values) {
    const objectives = Array.isArray(values)
      ? values.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    return objectives.map((objective) => `- ${objective.replace(/^[-*]\s*/, "")}`).join("\n");
  }

  objectifsEnTableau(value) {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    return String(value || "")
      .split(/\r?\n/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
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
