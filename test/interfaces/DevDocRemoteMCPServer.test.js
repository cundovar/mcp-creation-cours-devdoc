import { describe, expect, it, vi } from "vitest";
import { DevDocRemoteMCPServer } from "../../src/interfaces/mcp/DevDocRemoteMCPServer.js";

function createSubject(overrides = {}) {
  const generation = {
    id: 17,
    status: "pending",
    verificationAttempts: 0,
    candidate: null,
    verificationReport: null,
    courseId: null
  };
  const repository = {
    creerGeneration: vi.fn(async () => generation),
    mettreAJourGeneration: vi.fn(async (_id, data) => ({
      ...generation,
      ...data
    })),
    voirGeneration: vi.fn(async () => ({
      ...generation,
      status: "verifying",
      verificationAttempts: 1,
      candidate: {
        title: "Python",
        duration: "2h",
        codeHTML: '<main class="principal"><h1>Python</h1></main>'
      },
      verificationReport: { approved: true, issues: [] }
    })),
    echouerGeneration: vi.fn(),
    trouverMenuParId: vi.fn(async () => ({ id: 92, categoryId: 28, niveauCoursId: 3 })),
    trouverTechnologieParNom: vi.fn(async () => ({ id: 28, name: "typescript" })),
    trouverNiveauParNom: vi.fn(async () => ({ id: 3, name: "newbie" })),
    finaliserGeneration: vi.fn(async () => ({
      ...generation,
      status: "succeeded",
      courseId: 42,
      verificationReport: { approved: true, issues: [] }
    })),
    ...overrides.repository
  };
  const orchestration = {
    genererCandidat: vi.fn(async () => ({
      title: "Python",
      duration: "2h",
      codeHTML: '<main class="principal"><h1>Python</h1></main>'
    })),
    verifierCandidat: vi.fn(async () => ({ approved: true, issues: [] })),
    corrigerCandidat: vi.fn(),
    ...overrides.orchestration
  };
  const listerCours = {
    technologies: vi.fn(async () => []),
    niveaux: vi.fn(async () => []),
    menus: vi.fn(async () => []),
    coursIA: vi.fn(async () => []),
    ...overrides.listerCours
  };
  const processor = {
    enqueue: vi.fn(() => true),
    resume: vi.fn(async () => 0),
    ...overrides.processor
  };
  const container = {
    getCoursRepository: () => repository,
    getCourseOrchestrationService: () => orchestration,
    getListerCoursUseCase: () => listerCours,
    getCourseGenerationProcessor: () => processor
  };
  return {
    subject: new DevDocRemoteMCPServer(container),
    repository,
    orchestration,
    processor
  };
}

describe("DevDocRemoteMCPServer", () => {
  it("crée et met en file un brouillon sans bloquer la requête", async () => {
    const { subject, repository, orchestration, processor } = createSubject();

    const result = await subject.createDraft({
      requestId: "chat-python-001",
      titre: "Découvrir Python",
      technologie: "Python",
      niveau: "Débutant",
      duree: "2h"
    });

    expect(repository.creerGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: "mcp-devdoc",
        externalId: "chat-python-001"
      })
    );
    expect(processor.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 17 }));
    expect(orchestration.genererCandidat).not.toHaveBeenCalled();
    expect(orchestration.verifierCandidat).not.toHaveBeenCalled();
    expect(repository.finaliserGeneration).not.toHaveBeenCalled();
    expect(result.processing).toBe(true);
    expect(result.generationId).toBe(17);
  });

  it("réutilise un brouillon existant lors d’une nouvelle tentative", async () => {
    const existing = {
      id: 8,
      status: "verifying",
      candidate: { title: "Python", codeHTML: "<main></main>" },
      verificationReport: { approved: true },
      courseId: null
    };
    const { subject, orchestration, processor } = createSubject({
      repository: { creerGeneration: vi.fn(async () => existing) }
    });

    const result = await subject.createDraft({
      requestId: "chat-python-002",
      titre: "Python",
      technologie: "Python",
      niveau: "Débutant",
      duree: "1h"
    });

    expect(orchestration.genererCandidat).not.toHaveBeenCalled();
    expect(processor.enqueue).not.toHaveBeenCalled();
    expect(result.reused).toBe(true);
    expect(result.generationId).toBe(8);
  });

  it("régénère un brouillon précédemment échoué avec le même requestId", async () => {
    const failed = {
      id: 8,
      status: "failed",
      candidate: {
        title: "Python",
        codeHTML: "<main class=\"principal\"><h1>Ancien échec</h1></main>",
        illustrations: [{ prompt: "ancienne image" }]
      },
      verificationReport: { approved: false },
      courseId: null
    };
    const { subject, orchestration, processor } = createSubject({
      repository: { creerGeneration: vi.fn(async () => failed) }
    });

    const result = await subject.createDraft({
      requestId: "chat-python-003",
      titre: "Python",
      technologie: "Python",
      niveau: "Débutant",
      duree: "1h"
    });

    expect(orchestration.genererCandidat).not.toHaveBeenCalled();
    expect(processor.enqueue).toHaveBeenCalledWith(failed);
    expect(result.processing).toBe(true);
  });

  it("refuse la publication sans confirmation explicite", async () => {
    const { subject, repository } = createSubject();

    await expect(
      subject.publishCourse({ generationId: 17, confirmation: false })
    ).rejects.toThrow("confirmation explicite");
    expect(repository.finaliserGeneration).not.toHaveBeenCalled();
  });

  it("publie uniquement le brouillon confirmé", async () => {
    const { subject, repository } = createSubject();

    const result = await subject.publishCourse({
      generationId: 17,
      confirmation: true
    });

    expect(repository.finaliserGeneration).toHaveBeenCalledWith(17);
    expect(result.courseId).toBe(42);
    expect(result.published).toBe(true);
  });

  it("déclare correctement les annotations des outils sensibles", () => {
    const { subject } = createSubject();
    const tools = subject.toolDefinitions();
    const draft = tools.find((tool) => tool.name === "creer_brouillon_cours");
    const publish = tools.find((tool) => tool.name === "publier_cours_devdoc");

    expect(draft.annotations.idempotentHint).toBe(true);
    expect(draft.annotations.destructiveHint).toBe(false);
    expect(publish.annotations.destructiveHint).toBe(true);
  });
  it("réaffecte un brouillon uniquement vers un menu compatible", async () => {
    const { subject, repository } = createSubject({
      repository: {
        voirGeneration: vi.fn(async () => ({
          id: 17,
          status: "ready",
          payload: { technology: "typescript", level: "newbie", newMenuLabel: "Ancien" },
          verificationReport: { approved: true },
          courseId: null
        }))
      }
    });

    await subject.reassignDraft({ generationId: 17, menuId: 92 });

    expect(repository.mettreAJourGeneration).toHaveBeenCalledWith(17, {
      status: "ready",
      payload: { technology: "typescript", level: "newbie", menuId: 92 }
    });
  });

  it("masque du catalogue les menus sans catégorie ou sans niveau", async () => {
    const { subject } = createSubject({
      listerCours: {
        menus: vi.fn(async () => [
          { id: 1, categoryId: 28, niveauCoursId: 3 },
          { id: 2, categoryId: null, niveauCoursId: 3 },
          { id: 3, categoryId: 28, niveauCoursId: null }
        ])
      }
    });

    const result = await subject.listCatalog();

    expect(result.menus).toEqual([{ id: 1, categoryId: 28, niveauCoursId: 3 }]);
    expect(result.ignoredInvalidMenus).toBe(2);
  });

});
