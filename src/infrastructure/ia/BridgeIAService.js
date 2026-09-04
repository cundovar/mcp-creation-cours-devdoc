import { IIAService } from "../../domain/ports/IIAService.js";

export class BridgeIAService extends IIAService {
  constructor(client) {
    super();
    this.client = client;
  }

  async genererCours(specifications) {
    const { data } = await this.client.completeJson({
      agent: "course_creator",
      payload: { specifications }
    });
    return this.extractHtml(data);
  }

  async ameliorerCours(codeActuel, commentaires, contexte) {
    const { data } = await this.client.completeJson({
      agent: "course_corrector",
      payload: { codeActuel, commentaires, contexte }
    });
    return this.extractHtml(data);
  }

  async genererObjectifs(specifications) {
    const { data } = await this.client.completeJson({
      agent: "course_objectives",
      payload: { specifications }
    });
    const objectives = Array.isArray(data.objectives) ? data.objectives : [];
    return objectives.join("\n");
  }

  async genererExercices() {
    return "";
  }

  async genererPlanIllustrations(specifications, contenuCours) {
    const { data } = await this.client.completeJson({
      agent: "course_illustration_planner",
      payload: { specifications, contenuCours }
    });
    return (Array.isArray(data.illustrations) ? data.illustrations : [])
      .slice(0, 3)
      .filter((item) => item?.prompt && (item.altText || item.alt))
      .map((item) => ({
        prompt: item.prompt,
        altText: item.altText || item.alt,
        caption: item.caption || "",
        slot: item.slot,
        reason: item.reason
      }));
  }

  extractHtml(data) {
    const html = String(data?.html || data?.codeHTML || "").trim();
    if (!/<main\s+class=["']principal["']\s*>/i.test(html)) {
      throw new Error("Le bridge a renvoyé un cours sans main class principal");
    }
    return html;
  }
}
