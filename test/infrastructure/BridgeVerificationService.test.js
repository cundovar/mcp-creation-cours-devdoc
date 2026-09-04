import { describe, expect, it } from "vitest";
import { BridgeVerificationService } from "../../src/infrastructure/ia/BridgeVerificationService.js";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAA";

describe("BridgeVerificationService", () => {
  it("fails deterministic issues before calling the bridge", async () => {
    const client = { completeJson: async () => { throw new Error("should not be called"); } };
    const service = new BridgeVerificationService(client);

    const report = await service.verify({
      candidate: {},
      deterministicIssues: [{ code: "HTML_SCRIPT", severity: "blocking", location: "html", message: "bad", correction: "fix" }]
    });

    expect(report.approved).toBe(false);
    expect(report.score).toBe(0);
    expect(report.visionChecked).toBe(false);
  });

  it("passes real image attachments to the bridge", async () => {
    let received;
    const client = {
      completeJson: async (request) => {
        received = request;
        return { data: { approved: true, score: 95, issues: [], summary: "ok", visionChecked: true } };
      }
    };
    const service = new BridgeVerificationService(client);

    const report = await service.verify({ candidate: { title: "Cours" }, images: [{ dataUrl: PNG_DATA_URL, altText: "Alt" }] });

    expect(report.approved).toBe(true);
    expect(received.agent).toBe("course_verifier");
    expect(received.attachments).toHaveLength(1);
    expect(received.attachments[0].mimeType).toBe("image/png");
    expect(received.attachments[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects reports that do not confirm vision when images exist", async () => {
    const client = {
      completeJson: async () => ({ data: { approved: true, score: 90, issues: [], summary: "ok", visionChecked: false } })
    };
    const service = new BridgeVerificationService(client);

    const report = await service.verify({ candidate: {}, images: [{ dataUrl: PNG_DATA_URL }] });

    expect(report.approved).toBe(false);
    expect(report.issues.some((issue) => issue.code === "VISION_NOT_EXECUTED")).toBe(true);
  });
});
