import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SymfonyApiCoursRepository } from "../../src/infrastructure/api/SymfonyApiCoursRepository.js";

describe("SymfonyApiCoursRepository.lireMedia", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lit le média Symfony et vérifie son empreinte avant la vision", async () => {
    const bytes = Buffer.from("image");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { headers: { "content-type": "image/png", "content-length": String(bytes.length) } })));
    const repository = new SymfonyApiCoursRepository({ baseUrl: "https://devdoc.test", apiKey: "secret" });
    const dataUrl = await repository.lireMedia({
      url: "/uploads/course-media/schema.png",
      mimeType: "image/png",
      checksum: createHash("sha256").update(bytes).digest("hex")
    });
    expect(dataUrl).toBe(`data:image/png;base64,${bytes.toString("base64")}`);
    expect(fetch).toHaveBeenCalledWith(new URL("https://devdoc.test/uploads/course-media/schema.png"), expect.any(Object));
  });

  it("refuse une URL qui ne pointe pas vers la médiathèque Symfony", async () => {
    const repository = new SymfonyApiCoursRepository({ baseUrl: "https://devdoc.test" });
    await expect(repository.lireMedia({ url: "https://evil.test/image.png" })).rejects.toThrow("non autorisée");
  });
});

describe("SymfonyApiCoursRepository.listerGenerations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("transmet les statuts récupérables et la limite", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: 1, status: "pending" }]),
      { status: 200, headers: { "content-type": "application/json" } }
    )));
    const repository = new SymfonyApiCoursRepository({ baseUrl: "https://devdoc.test" });

    const result = await repository.listerGenerations({
      statuses: ["pending", "generating"],
      limit: 20
    });

    expect(result).toEqual([{ id: 1, status: "pending" }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://devdoc.test/api/admin/agent-cours/generations?status=pending%2Cgenerating&limit=20",
      expect.any(Object)
    );
  });
});
