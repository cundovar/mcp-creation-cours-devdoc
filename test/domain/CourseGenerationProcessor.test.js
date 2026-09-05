import { describe, expect, it, vi } from "vitest";
import { CourseGenerationProcessor } from "../../src/domain/services/CourseGenerationProcessor.js";

function subject(overrides = {}) {
  const generation = {
    id: 17,
    status: "pending",
    payload: {
      title: "Python",
      description: "Cours Python",
      technology: "Python",
      level: "newbie",
      duration: "2h"
    },
    courseId: null
  };
  const repository = {
    voirGeneration: vi.fn(async () => generation),
    mettreAJourGeneration: vi.fn(async (_id, data) => ({ ...generation, ...data })),
    echouerGeneration: vi.fn(),
    listerGenerations: vi.fn(async () => []),
    ...overrides.repository
  };
  const orchestration = {
    genererCandidat: vi.fn(async () => ({
      title: "Python",
      codeHTML: '<main class="principal"><h1>Python</h1></main>',
      objectives: "- Comprendre Python"
    })),
    verifierCandidat: vi.fn(async () => ({ approved: true, issues: [] })),
    corrigerCandidat: vi.fn(),
    ...overrides.orchestration
  };
  return {
    processor: new CourseGenerationProcessor(repository, orchestration, {
      logger: { error: vi.fn() }
    }),
    repository,
    orchestration,
    generation
  };
}

describe("CourseGenerationProcessor", () => {
  it("marque ready un brouillon approuvé sans le publier", async () => {
    const { processor, repository } = subject();

    await processor.process(17);

    expect(repository.mettreAJourGeneration).toHaveBeenNthCalledWith(1, 17, {
      status: "generating"
    });
    expect(repository.mettreAJourGeneration).toHaveBeenNthCalledWith(
      2,
      17,
      expect.objectContaining({
        status: "ready",
        verificationReport: { approved: true, issues: [] }
      })
    );
  });

  it("corrige le candidat et ses objectifs avant une nouvelle vérification", async () => {
    const firstReport = {
      approved: false,
      issues: [{ message: "Objectif absent du contenu" }]
    };
    const corrected = {
      title: "Python",
      codeHTML: '<main class="principal"><h1>Python corrigé</h1></main>',
      objectives: "- Objectif aligné"
    };
    const { processor, orchestration } = subject({
      orchestration: {
        verifierCandidat: vi.fn()
          .mockResolvedValueOnce(firstReport)
          .mockResolvedValueOnce({ approved: true, issues: [] }),
        corrigerCandidat: vi.fn(async () => corrected)
      }
    });

    await processor.process(17);

    expect(orchestration.corrigerCandidat).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: expect.any(Object), report: firstReport })
    );
    expect(orchestration.verifierCandidat).toHaveBeenLastCalledWith({
      candidate: corrected,
      images: []
    });
  });

  it("reprend les générations persistées et évite deux traitements simultanés", async () => {
    const { processor, repository, generation } = subject({
      repository: { listerGenerations: vi.fn(async () => [generation]) }
    });
    vi.spyOn(processor, "enqueue").mockReturnValue(true);

    const count = await processor.resume();

    expect(count).toBe(1);
    expect(repository.listerGenerations).toHaveBeenCalledWith({
      statuses: ["pending", "generating", "verifying"],
      limit: 100
    });
  });
});
