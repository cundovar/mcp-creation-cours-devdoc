export class N8NCourseBatchClient {
  constructor(config = {}) {
    this.url = String(config.url || "").trim();
    this.token = String(config.token || "").trim();
    this.headerName = String(
      config.headerName || "X-DevDoc-Workflow-Token"
    ).trim();
    this.timeoutMs = Number(config.timeoutMs) || 10000;
  }

  async enqueue(batch) {
    const generationIds = [
      ...new Set(
        (batch?.menus || [])
          .flatMap((menu) => menu.generationIds || [])
          .map(Number)
      )
    ].filter((id) => Number.isInteger(id) && id > 0);

    if (!generationIds.length) return { accepted: 0 };
    if (!batch?.superMenu || !batch?.category || !Array.isArray(batch?.menus)) {
      throw new Error("Le lot n8n doit contenir superMenu, category et menus");
    }
    if (!this.url || !this.token || !this.headerName) {
      throw new Error("Orchestration n8n des cours non configurée");
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [this.headerName]: this.token
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      const message = (await response.text()).trim().slice(0, 500);
      throw new Error(
        `n8n course batch ${response.status}: ${message || response.statusText}`
      );
    }

    return { accepted: generationIds.length };
  }
}
