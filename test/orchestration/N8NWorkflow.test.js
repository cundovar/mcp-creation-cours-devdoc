import fs from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = JSON.parse(
  fs.readFileSync(
    new URL("../../n8n/50-devdoc-course-batch.json", import.meta.url),
    "utf8"
  )
);

describe("workflow n8n DevDoc", () => {
  it("traite les générations une par une", () => {
    const loop = workflow.nodes.find((node) => node.name === "Loop Over Courses");
    expect(loop.parameters.batchSize).toBe(1);
    expect(workflow.connections["Loop Over Courses"].main[1]).toEqual([
      { node: "Load Generation", type: "main", index: 0 }
    ]);
  });

  it("conserve un brouillon prêt sans publication automatique", () => {
    expect(workflow.nodes.some((node) => node.name === "Finalize Visible Course")).toBe(false);
    expect(JSON.stringify(workflow)).not.toContain("/finaliser");
    const stores = workflow.nodes.filter((node) =>
      ["Store Verification", "Store Corrected Verification"].includes(node.name)
    );
    expect(stores).toHaveLength(2);
    for (const node of stores) {
      expect(node.parameters.jsonBody).toContain("'ready'");
    }
  });

  it("prévoit des délais et reprises adaptés au bridge", () => {
    const longRunningNodes = workflow.nodes.filter(
      (node) => node.type === "n8n-nodes-base.httpRequest"
    );
    expect(longRunningNodes.length).toBeGreaterThan(0);
    for (const node of longRunningNodes) {
      expect(node.retryOnFail).toBe(true);
      expect(node.maxTries).toBe(3);
      expect(node.waitBetweenTries).toBe(15000);
      expect(node.parameters.options.timeout).toBe(330000);
    }
  });
});
