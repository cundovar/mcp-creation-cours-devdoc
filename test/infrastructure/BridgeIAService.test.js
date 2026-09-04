import { describe, expect, it } from "vitest";
import { BridgeIAService } from "../../src/infrastructure/ia/BridgeIAService.js";

describe("BridgeIAService", () => {
  it("generates course html through the bridge", async () => {
    const service = new BridgeIAService({
      completeJson: async (request) => {
        expect(request.agent).toBe("course_creator");
        return { data: { html: '<main class="principal"><section>ok</section></main>' } };
      }
    });

    await expect(service.genererCours({ sujet: "n8n" })).resolves.toContain("principal");
  });

  it("normalizes illustration plan alt field", async () => {
    const service = new BridgeIAService({
      completeJson: async () => ({ data: { illustrations: [{ prompt: "draw workflow", alt: "workflow diagram", caption: "Workflow" }] } })
    });

    const plan = await service.genererPlanIllustrations({ sujet: "n8n" }, "html");

    expect(plan[0].altText).toBe("workflow diagram");
  });
});
