import { describe, expect, it, vi } from "vitest";
import { BridgeVerificationService } from "../../src/infrastructure/ia/BridgeVerificationService.js";

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16)
]);

describe("BridgeVerificationService", () => {
  it("transmet les images réelles au bridge avec leur empreinte", async () => {
    const completeJson = vi.fn().mockResolvedValue({
      approved: true,
      score: 95,
      visionChecked: true,
      issues: [],
      summary: "Valide"
    });
    const service = new BridgeVerificationService({ completeJson });
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    await service.verify({
      candidate: { title: "Cours", codeHTML: '<main class="principal"></main>' },
      images: [{ id: 1, altText: "Diagramme", dataUrl }],
      deterministicIssues: []
    });

    expect(completeJson).toHaveBeenCalledWith(
      "course_verifier",
      expect.objectContaining({
        images: [{ id: 1, altText: "Diagramme" }],
        deterministicIssues: []
      }),
      [
        expect.objectContaining({
          name: "illustration-1.png",
          mimeType: "image/png",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          dataBase64: png.toString("base64")
        })
      ]
    );
  });

  it("ne contacte pas l'IA quand le contrôle déterministe échoue", async () => {
    const completeJson = vi.fn();
    const service = new BridgeVerificationService({ completeJson });
    const report = await service.verify({
      candidate: {},
      images: [],
      deterministicIssues: [
        {
          code: "UNSAFE_HTML",
          severity: "blocking",
          location: "script",
          message: "Script interdit",
          correction: "Retirer le script"
        }
      ]
    });

    expect(report.approved).toBe(false);
    expect(report.visionChecked).toBe(false);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("refuse l'approbation si le bridge retourne un problème bloquant", async () => {
    const service = new BridgeVerificationService({
      completeJson: vi.fn().mockResolvedValue({
        approved: true,
        score: 80,
        visionChecked: false,
        issues: [
          {
            code: "TECHNICAL_ERROR",
            severity: "blocking",
            location: "exemple",
            message: "Erreur",
            correction: "Corriger"
          }
        ],
        summary: "À corriger"
      })
    });

    const report = await service.verify({ candidate: {}, images: [] });
    expect(report.approved).toBe(false);
  });
});
