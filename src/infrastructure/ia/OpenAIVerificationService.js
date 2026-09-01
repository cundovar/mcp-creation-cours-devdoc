import OpenAI from "openai";

export class OpenAIVerificationService {
  constructor(apiKey, model) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async verify({ candidate, images, deterministicIssues }) {
    if (deterministicIssues.length) return { approved: false, score: 0, issues: deterministicIssues, summary: "Le contenu échoue aux contrôles techniques." };
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Tu vérifies un cours technique indépendamment de son auteur. Réponds uniquement en JSON {approved:boolean,score:number,issues:[{code,severity,location,message,correction}],summary:string}. Refuse si une erreur technique, pédagogique ou une illustration incohérente est présente." },
        { role: "user", content: JSON.stringify({ candidate, images }) }
      ]
    });
    const report = JSON.parse(response.choices[0].message.content || "{}");
    if (typeof report.approved !== "boolean" || !Array.isArray(report.issues)) throw new Error("Le vérificateur a renvoyé un rapport invalide");
    return { approved: report.approved, score: Number(report.score || 0), issues: report.issues, summary: String(report.summary || "") };
  }
}
