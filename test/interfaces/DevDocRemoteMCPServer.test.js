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
  const container = {
    getCoursRepository: () => repository,
    getCourseOrchestrationService: () => orchestration,
    getListerCoursUseCase: () => listerCours
  };
  return {
    subject: new DevDocRemoteMCPServer(container),
    repository,
    orchestration
  };
}

describe("DevDocRemoteMCPServer", () => {
  it("crée, vérifie et conserve un brouillon sans le publier", async () => {
    const { subject, repository, orchestration } = createSubject();

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
    expect(orchestration.genererCandidat).toHaveBeenCalledOnce();
    expect(orchestration.verifierCandidat).toHaveBeenCalledOnce();
    expect(repository.finaliserGeneration).not.toHaveBeenCalled();
    expect(result.readyToPublish).toBe(true);
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
    const { subject, orchestration } = createSubject({
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
    expect(result.reused).toBe(true);
    expect(result.generationId).toBe(8);
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
});
