import crypto from "node:crypto";

const ALLOWED_SEVERITIES = new Set(["blocking", "major", "minor"]);
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i;

export class BridgeVerificationService {
  constructor(bridgeClient) {
    this.bridge = bridgeClient;
  }

  async verify({ candidate, images = [], deterministicIssues = [] }) {
    if (deterministicIssues.length) {
      return {
        approved: false,
        score: 0,
        visionChecked: false,
        issues: deterministicIssues,
        summary: "Le contenu échoue aux contrôles techniques."
      };
    }

    const attachments = images.map((image, index) => this.toAttachment(image, index));
    const imageMetadata = images.map(({ dataUrl: _dataUrl, ...metadata }) => metadata);
    const report = await this.bridge.completeJson(
      "course_verifier",
      { candidate, images: imageMetadata, deterministicIssues },
      attachments
    );

    this.validateReport(report, attachments.length > 0);
    if (report.issues.some((issue) => issue.severity === "blocking")) {
      report.approved = false;
    }
    return report;
  }

  toAttachment(image, index) {
    const match = String(image.dataUrl || "").match(DATA_URL_PATTERN);
    if (!match) {
      throw new Error("Une illustration réelle est requise pour la vérification visuelle");
    }
    const data = Buffer.from(match[2], "base64");
    if (!data.length) {
      throw new Error("Une illustration réelle est requise pour la vérification visuelle");
    }
    return {
      name: `illustration-${index + 1}.${match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1]}`,
      mimeType: match[1].toLowerCase(),
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
      dataBase64: match[2]
    };
  }

  validateReport(report, imagesProvided) {
    if (
      !report ||
      typeof report !== "object" ||
      typeof report.approved !== "boolean" ||
      !Number.isInteger(report.score) ||
      report.score < 0 ||
      report.score > 100 ||
      typeof report.visionChecked !== "boolean" ||
      !Array.isArray(report.issues) ||
      typeof report.summary !== "string"
    ) {
      throw new Error("Le bridge a renvoyé un rapport de vérification invalide");
    }
    if (report.visionChecked !== imagesProvided) {
      throw new Error("Le contrôle visuel déclaré ne correspond pas aux images transmises");
    }
    for (const issue of report.issues) {
      if (
        !issue ||
        typeof issue !== "object" ||
        !this.nonEmpty(issue.code) ||
        !ALLOWED_SEVERITIES.has(issue.severity) ||
        !this.nonEmpty(issue.location) ||
        !this.nonEmpty(issue.message) ||
        !this.nonEmpty(issue.correction)
      ) {
        throw new Error("Le bridge a renvoyé un problème de vérification invalide");
      }
    }
  }

  nonEmpty(value) {
    return typeof value === "string" && value.trim() !== "";
  }
}
