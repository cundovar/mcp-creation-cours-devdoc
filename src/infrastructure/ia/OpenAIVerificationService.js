import OpenAI from "openai";

const ALLOWED_SEVERITIES = new Set(["blocking", "major", "minor"]);

export class OpenAIVerificationService {
  constructor(apiKey, model) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async verify({ candidate, images = [], deterministicIssues = [] }) {
    if (deterministicIssues.length) return { approved: false, score: 0, issues: deterministicIssues, summary: "Le contenu échoue aux contrôles techniques." };
    for (const image of images) {
      if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(String(image.dataUrl || ""))) {
        throw new Error("Une illustration réelle est requise pour la vérification visuelle");
      }
    }

    const imageMetadata = images.map(({ dataUrl: _dataUrl, ...metadata }) => metadata);
    const content = [
      { type: "text", text: JSON.stringify({ candidate, images: imageMetadata }) },
      ...images.map((image) => ({ type: "image_url", image_url: { url: image.dataUrl, detail: "high" } }))
    ];
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Tu vérifies un cours technique indépendamment de son auteur. Réponds uniquement en JSON {approved:boolean,score:number,issues:[{code,severity,location,message,correction}],summary:string}. Refuse si une erreur technique, pédagogique ou une illustration incohérente est présente." },
        { role: "user", content }
      ]
    });
    const report = this.parseReport(response.choices?.[0]?.message?.content);
    if (report.issues.some((issue) => issue.severity === "blocking")) report.approved = false;
    return report;
  }

  parseReport(content) {
    let report;
    try {
      report = JSON.parse(content || "{}");
    } catch {
      throw new Error("Le vérificateur a renvoyé un rapport JSON invalide");
    }
    if (!report || typeof report !== "object" || Array.isArray(report)) throw new Error("Le vérificateur a renvoyé un rapport invalide");
    if (typeof report.approved !== "boolean" || !Number.isFinite(report.score) || report.score < 0 || report.score > 100 || !Array.isArray(report.issues) || typeof report.summary !== "string") {
      throw new Error("Le vérificateur a renvoyé un rapport invalide");
    }
    for (const issue of report.issues) {
      if (!issue || typeof issue !== "object" || !this.nonEmpty(issue.code) || !ALLOWED_SEVERITIES.has(issue.severity) || !this.nonEmpty(issue.location) || !this.nonEmpty(issue.message) || !this.nonEmpty(issue.correction)) {
        throw new Error("Le vérificateur a renvoyé un problème invalide");
      }
    }
    return { approved: report.approved, score: report.score, issues: report.issues, summary: report.summary };
  }

  nonEmpty(value) { return typeof value === "string" && value.trim() !== ""; }
}
