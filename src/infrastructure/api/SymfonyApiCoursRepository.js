import { ICoursRepository } from "../../domain/ports/ICoursRepository.js";
import { Cours } from "../../domain/entities/Cours.js";
import { Revision } from "../../domain/entities/Revision.js";

export class SymfonyApiCoursRepository extends ICoursRepository {
  constructor(config) {
    super();
    this.baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
    this.apiKey = config.apiKey || null;
    this.niveauxPath = config.niveauxPath || "/api/admin/niveau-cours";
  }

  async listerMenus(filters = {}) {
    const query = new URLSearchParams();

    if (filters.categoryId) {
      query.set("categoryId", String(filters.categoryId));
    }

    if (filters.niveauCoursId) {
      query.set("niveauCoursId", String(filters.niveauCoursId));
    }

    if (filters.positionMenusId) {
      query.set("positionMenusId", String(filters.positionMenusId));
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = await this.requestJson(`/api/admin/menus${suffix}`);

    return this.normalizeCollection(data).map((item) => this.mapMenu(item));
  }

  async trouverMenuParId(id) {
    const data = await this.requestJson(`/api/admin/menus/${id}`);
    return this.mapMenu(data);
  }

  async creerMenu(data) {
    const response = await this.requestJson("/api/admin/menus", {
      method: "POST",
      body: JSON.stringify(data)
    });

    return this.mapMenu(response);
  }

  async mettreAJourMenu(id, data) {
    const response = await this.requestJson(`/api/admin/menus/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });

    return this.mapMenu(response);
  }

  async listerTechnologies() {
    const data = await this.requestJson("/api/admin/categories");
    return this.normalizeCollection(data).map((item) => this.mapReference(item));
  }

  async listerCategories() {
    return this.normalizeCollection(await this.requestJson("/api/admin/categories"));
  }

  async listerSuperMenus() {
    return this.normalizeCollection(await this.requestJson("/api/admin/super-menus"));
  }

  async creerSuperMenu(name) {
    return this.requestJson("/api/admin/super-menus", { method: "POST", body: JSON.stringify({ name }) });
  }

  async creerTechnologie(data) {
    return this.requestJson("/api/admin/categories", { method: "POST", body: JSON.stringify(data) });
  }

  async listerPositionsMenus() {
    return this.normalizeCollection(await this.requestJson("/api/admin/positions-menus"));
  }

  async creerPositionMenu(position) {
    return this.requestJson("/api/admin/positions-menus", { method: "POST", body: JSON.stringify({ position }) });
  }

  async trouverTechnologieParNom(nom) {
    const technologies = await this.listerTechnologies();
    return this.findByName(technologies, nom);
  }

  async listerNiveaux() {
    const data = await this.requestJson(this.niveauxPath);
    return this.normalizeCollection(data).map((item) => this.mapReference(item));
  }

  async trouverNiveauParNom(nom) {
    const niveaux = await this.listerNiveaux();
    return this.findByName(niveaux, nom);
  }

  async sauvegarder() {
    const [cours, options = {}] = arguments;

    if (cours?.id) {
      const response = await this.requestJson(`/api/admin/agent-cours/${cours.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: cours.title,
          description: cours.description,
          codeHTML: cours.code,
          statut: cours.statut
        })
      });

      return response.id;
    }

    const response = await this.requestJson("/api/admin/agent-cours/creer", {
      method: "POST",
      body: JSON.stringify({
        titre: cours.title,
        description: cours.description,
        technologie: cours.technology?.name,
        niveau: cours.level?.name,
        duree: cours.duration,
        menuId: options.menuId ?? null,
        nouveauMenuLabel: options.nouveauMenuLabel ?? null,
        codeHTML: cours.code,
        objectifs: cours.objectifs,
        statut: cours.statut
      })
    });

    return response.id;
  }

  async trouverParId() {
    const [id] = arguments;
    const data = await this.requestJson(`/api/admin/agent-cours/${id}`);
    return this.mapCourse(data);
  }

  async listerParTechnologie() {
    const [technologyId] = arguments;
    const data = await this.requestJson(`/api/admin/agent-cours?categoryId=${technologyId}`);
    return this.normalizeCollection(data).map((item) => this.mapCourse(item));
  }

  async listerParNiveau() {
    const [levelId] = arguments;
    const data = await this.requestJson(`/api/admin/agent-cours?niveauCoursId=${levelId}`);
    return this.normalizeCollection(data).map((item) => this.mapCourse(item));
  }

  async listerParStatut() {
    const [statut] = arguments;
    const data = await this.requestJson(`/api/admin/agent-cours?statut=${encodeURIComponent(statut)}`);
    return this.normalizeCollection(data).map((item) => this.mapCourse(item));
  }

  async listerCoursIA() {
    const data = await this.requestJson("/api/admin/agent-cours?type=agent-cours");
    return this.normalizeCollection(data).map((item) => this.mapCourse(item));
  }

  async sauvegarderRevision() {
    const [revision] = arguments;
    const path = revision?.id
      ? `/api/admin/agent-cours/revisions/${revision.id}`
      : "/api/admin/agent-cours/revisions";
    const method = revision?.id ? "PUT" : "POST";
    const data = await this.requestJson(path, {
      method,
      body: JSON.stringify({
        courseId: revision.courseId,
        typeRevision: revision.typeRevision,
        commentaire: revision.commentaire,
        ancienCode: revision.ancienCode,
        nouveauCode: revision.nouveauCode,
        appliquee: revision.appliquee
      })
    });

    return data.id;
  }

  async listerRevisions() {
    const [courseId] = arguments;

    const data = courseId
      ? await this.requestJson(`/api/admin/agent-cours/${courseId}/revisions`)
      : await this.requestJson("/api/admin/agent-cours/revisions");

    return this.normalizeCollection(data).map((item) => this.mapRevision(item));
  }

  async creerGeneration(data) {
    return this.requestJson("/api/admin/agent-cours/generations", { method: "POST", body: JSON.stringify(data) });
  }

  async voirGeneration(id) {
    return this.requestJson(`/api/admin/agent-cours/generations/${id}`);
  }

  async mettreAJourGeneration(id, data) {
    return this.requestJson(`/api/admin/agent-cours/generations/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async finaliserGeneration(id) {
    return this.requestJson(`/api/admin/agent-cours/generations/${id}/finaliser`, { method: "POST", body: "{}" });
  }

  async echouerGeneration(id, data) {
    return this.requestJson(`/api/admin/agent-cours/generations/${id}/echouer`, { method: "POST", body: JSON.stringify(data) });
  }

  async envoyerMedia({ buffer, filename, altText, caption, prompt, generationId }) {
    const form = new FormData();
    form.set("file", new Blob([buffer], { type: "image/png" }), filename || "illustration.png");
    form.set("altText", altText);
    if (caption) form.set("caption", caption);
    if (prompt) form.set("prompt", prompt);
    if (generationId) form.set("generationId", String(generationId));
    const response = await fetch(`${this.baseUrl}/api/admin/course-media`, { method: "POST", headers: this.apiKey ? { "X-API-KEY": this.apiKey } : {}, body: form });
    if (!response.ok) throw new Error(`Symfony API ${response.status}: ${await this.extractErrorMessage(response)}`);
    return response.json();
  }

  async requestJson(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json, application/ld+json",
        "Content-Type": "application/json",
        ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const message = await this.extractErrorMessage(response);
      throw new Error(`Symfony API ${response.status}: ${message}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async extractErrorMessage(response) {
    try {
      const data = await response.json();
      return data.error || data.message || JSON.stringify(data);
    } catch {
      return response.statusText || "Erreur HTTP";
    }
  }

  normalizeCollection(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.["hydra:member"])) {
      return data["hydra:member"];
    }

    if (Array.isArray(data?.member)) {
      return data.member;
    }

    return [];
  }

  findByName(items, name) {
    const normalizedName = String(name || "").trim().toLowerCase();

    return (
      items.find(
        (item) => String(item.name || "").trim().toLowerCase() === normalizedName
      ) || null
    );
  }

  mapReference(item) {
    return {
      id: item.id,
      name: item.name
    };
  }

  mapMenu(item) {
    return {
      id: item.id,
      label: item.label,
      categoryId: item.category?.id ?? null,
      categoryName: item.category?.name ?? null,
      positionMenusId: item.positionMenus?.id ?? null,
      positionMenusName: item.positionMenus?.position ?? null,
      niveauCoursId: item.niveauCours?.id ?? null,
      niveauCoursName: item.niveauCours?.name ?? null,
      pagesCount: Array.isArray(item.pages) ? item.pages.length : 0,
      coursCount: Array.isArray(item.pageContents) ? item.pageContents.length : 0
    };
  }

  mapCourse(item) {
    return new Cours({
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      code: item.code,
      objectifs: item.objectifs ?? null,
      exercices: item.exercices ?? null,
      duration: item.duration || "N/A",
      level: item.level ?? null,
      technology: item.technology ?? null,
      modules: [],
      statut: item.status || "brouillon",
      genereParIA: Boolean(item.genereParIA),
      createdAt: item.createdAt ?? new Date(),
      updatedAt: item.updatedAt ?? new Date()
    });
  }

  mapRevision(item) {
    return new Revision({
      id: item.id,
      courseId: item.courseId,
      typeRevision: item.typeRevision,
      commentaire: item.commentaire,
      ancienCode: item.ancienCode,
      nouveauCode: item.nouveauCode,
      dateRevision: item.dateRevision ?? new Date(),
      appliquee: Boolean(item.appliquee)
    });
  }
}
