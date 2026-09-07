import { afterEach, describe, expect, it, vi } from "vitest";
import { N8NCourseBatchClient } from "../../src/infrastructure/orchestration/N8NCourseBatchClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("N8NCourseBatchClient", () => {
  it("transmet un lot unique au webhook n8n avec le jeton configuré", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "Workflow was started"
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new N8NCourseBatchClient({
      url: "http://n8n:5678/webhook/devdoc-course-batch",
      token: "secret",
      headerName: "X-DevDoc-Workflow-Token",
      timeoutMs: 1000
    });

    const batch = {
      batchId: "batch-test-001",
      superMenu: "DevOps",
      category: "CI/CD",
      menus: [{ name: "Junior", level: "Junior", generationIds: [20, 21, 20] }]
    };
    await expect(client.enqueue(batch)).resolves.toEqual({ accepted: 2 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://n8n:5678/webhook/devdoc-course-batch");
    expect(options.headers["X-DevDoc-Workflow-Token"]).toBe("secret");
    expect(JSON.parse(options.body)).toEqual(batch);
  });

  it("remonte les refus du webhook sans exposer le jeton", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Authorization data is wrong"
    })));
    const client = new N8NCourseBatchClient({
      url: "http://n8n:5678/webhook/devdoc-course-batch",
      token: "secret"
    });

    await expect(client.enqueue({
      batchId: "batch-test-002",
      superMenu: "DevOps",
      category: "CI/CD",
      menus: [{ name: "Junior", level: "Junior", generationIds: [20] }]
    })).rejects.toThrow("n8n course batch 403");
  });
});
