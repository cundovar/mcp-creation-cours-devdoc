import crypto from "crypto";

export class BridgeVerificationService {
  constructor(client) {
    this.client = client;
  }

  async verify({ candidate, images = [], deterministicIssues = [] }) {
    if (deterministicIssues.length) {
      return {
        approved: false,
        score: 0,
        issues: deterministicIssues,
        summary: "Le contenu échoue aux contrôles techniques.",
        visionChecked: false
      };
    }

    const attachments = images.map((image, index) => this.toAttachment(image, index));
    const imageMetadata = images.map(({ dataUrl: _dataUrl, ...metadata }) => metadata);
    const { data } = await this.client.completeJson({
      agent: "course_verifier",
      payload: { candidate, images: imageMetadata, deterministicIssues },
      attachments
    });
    const report = this.normalizeReport(data);
    if (attachments.length > 0 && report.visionChecked !== true) {
      return {
        ...report,
        approved: false,
        issues: [
          ...report.issues,
          {
            code: "VISION_NOT_EXECUTED",
            severity: "blocking",
            location: "illustrations",
            message: "Le vérificateur n'a pas confirmé l'inspection visuelle des images.",
            correction: "Relancer la vérification avec les images réelles."
          }
        ],
        summary: "Vérification visuelle non confirmée."
      };
    }
    return report;
  }

  toAttachment(image, index) {
    const match = String(image.dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
    if (!match) throw new Error("Une illustration réelle est requise pour la vérification visuelle");
    const data = Buffer.from(match[2], "base64");
    return {
      name: image.filename || `illustration-${index + 1}`,
      mimeType: match[1].toLowerCase(),
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
      dataBase64: data.toString("base64")
    };
  }

  normalizeReport(report) {
    if (!report || typeof report !== "object") throw new Error("Le bridge a renvoyé un rapport invalide");
    const issues = Array.isArray(report.issues) ? report.issues : [];
    return {
      approved: report.approved === true,
      score: Number.isFinite(report.score) ? report.score : 0,
      issues,
      summary: String(report.summary || ""),
      visionChecked: report.visionChecked === true
    };
  }
}
