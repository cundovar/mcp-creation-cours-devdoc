const MAX_CORRECTIONS = 3;

export class CourseGenerationProcessor {
  constructor(repository, orchestration, { logger = console } = {}) {
    this.repository = repository;
    this.orchestration = orchestration;
    this.logger = logger;
    this.inFlight = new Set();
  }

  enqueue(generation) {
    const id = Number(generation?.id);
    if (!Number.isInteger(id) || id < 1 || generation?.courseId || generation?.status === "ready" || generation?.status === "succeeded") {
      return false;
    }
    if (this.inFlight.has(id)) return false;

    this.inFlight.add(id);
    setImmediate(() => {
      this.process(id)
        .catch((error) => this.logger.error("Generation " + id + " failed", error))
        .finally(() => this.inFlight.delete(id));
    });
    return true;
  }

  async resume() {
    const generations = await this.repository.listerGenerations({
      statuses: ["pending", "generating", "verifying"],
      limit: 100
    });
    return generations.filter((generation) => this.enqueue(generation)).length;
  }

  async process(generationId) {
    const generation = await this.repository.voirGeneration(generationId);
    if (generation.courseId || generation.status === "ready" || generation.status === "succeeded") return generation;

    const payload = generation.payload || {};
    let candidate = null;
    let report = null;

    try {
      await this.repository.mettreAJourGeneration(generationId, { status: "generating" });
      candidate = await this.orchestration.genererCandidat({
        title: payload.title,
        description: payload.brief || payload.description,
        technology: payload.technology,
        level: payload.level,
        duration: payload.duration
      });

      for (let attempt = 0; attempt <= MAX_CORRECTIONS; attempt += 1) {
        report = await this.orchestration.verifierCandidat({ candidate, images: [] });
        const approved = report?.approved === true;

        await this.repository.mettreAJourGeneration(generationId, {
          status: approved ? "ready" : "verifying",
          candidate,
          verificationReport: report
        });

        if (approved) return this.repository.voirGeneration(generationId);
        if (attempt === MAX_CORRECTIONS || !Array.isArray(report?.issues) || report.issues.length === 0) break;

        candidate = await this.orchestration.corrigerCandidat({
          candidate,
          report,
          technology: payload.technology,
          level: payload.level
        });
      }

      return this.repository.echouerGeneration(generationId, {
        verificationReport: report,
        technicalError: "Le brouillon n’a pas satisfait la vérification après trois corrections."
      });
    } catch (error) {
      try {
        await this.repository.echouerGeneration(generationId, {
          verificationReport: report,
          technicalError: error instanceof Error ? error.message : "Erreur de génération"
        });
      } catch {
        // L’erreur initiale reste prioritaire.
      }
      throw error;
    }
  }

  isProcessing(generationId) {
    return this.inFlight.has(Number(generationId));
  }
}
