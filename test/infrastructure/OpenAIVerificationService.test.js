import { describe, expect, it, vi } from "vitest";
import { OpenAIVerificationService } from "../../src/infrastructure/ia/OpenAIVerificationService.js";

describe("OpenAIVerificationService", () => {
  it("transmet chaque fichier réel comme entrée vision", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ approved: true, score: 95, issues: [], summary: "Valide" }) } }]
    });
    const service = new OpenAIVerificationService("test-key", "gpt-5-mini");
    service.client = { chat: { completions: { create } } };

    await service.verify({
      candidate: { title: "Cours", codeHTML: '<main class="principal"></main>' },
      images: [{ id: 1, altText: "Diagramme", dataUrl: "data:image/png;base64,aW1hZ2U=" }],
      deterministicIssues: []
    });

    const userContent = create.mock.calls[0][0].messages[1].content;
    expect(userContent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image_url", image_url: { url: "data:image/png;base64,aW1hZ2U=", detail: "high" } })
    ]));
  });

  it("refuse un rapport approuvé contenant un problème bloquant", async () => {
    const service = new OpenAIVerificationService("test-key", "gpt-5-mini");
    service.client = { chat: { completions: { create: vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        approved: true,
        score: 90,
        issues: [{ code: "TECHNICAL_ERROR", severity: "blocking", location: "exemple", message: "Erreur", correction: "Corriger" }],
        summary: "À corriger"
      }) } }]
    }) } } };

    const report = await service.verify({ candidate: {}, images: [], deterministicIssues: [] });
    expect(report.approved).toBe(false);
  });
});
