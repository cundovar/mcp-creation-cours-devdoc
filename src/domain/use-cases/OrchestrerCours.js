export class OrchestrerCours {
  constructor(repository, iaService, imageService, verifier, validator) {
    this.repository = repository;
    this.iaService = iaService;
    this.imageService = imageService;
    this.verifier = verifier;
    this.validator = validator;
  }

  async preparerFormation({ superMenu, category, menus = [] }) {
    if (!superMenu || !category) throw new Error("superMenu et category sont requis");
    let targetSuperMenu = (await this.repository.listerSuperMenus()).find((item) => this.same(item.name, superMenu));
    if (!targetSuperMenu) targetSuperMenu = await this.repository.creerSuperMenu(superMenu);

    let targetCategory = (await this.repository.listerCategories()).find((item) => this.same(item.name, category));
    if (!targetCategory) targetCategory = await this.repository.creerTechnologie({ name: category, superMenuId: targetSuperMenu.id });
    if (targetCategory.superMenu?.id && targetCategory.superMenu.id !== targetSuperMenu.id) throw new Error("La catégorie demandée appartient déjà à un autre supermenu");

    const levels = await this.repository.listerNiveaux();
    const existingMenus = await this.repository.listerMenus({ categoryId: targetCategory.id });
    const requestedMenus = menus.length ? menus : [{ name: "Cours" }];
    const resolvedMenus = [];
    for (const request of requestedMenus) {
      const level = request.level ? levels.find((item) => this.same(item.name, request.level)) : null;
      if (request.level && !level) throw new Error(`Niveau introuvable: ${request.level}`);
      let menu = existingMenus.find((item) => this.same(item.label, request.name || "Cours") && (!level || item.niveauCoursId === level.id));
      if (!menu) menu = await this.repository.creerMenu({ label: request.name || "Cours", categoryId: targetCategory.id, niveauCoursId: level?.id ?? null });
      resolvedMenus.push(menu);
    }
    return { superMenu: targetSuperMenu, category: targetCategory, menus: resolvedMenus };
  }

  async genererCandidat({ title, description, technology, level, duration }) {
    const specifications = { sujet: title, technologie: technology, niveau: level, duree: duration };
    const [codeHTML, objectives] = await Promise.all([this.iaService.genererCours(specifications), this.iaService.genererObjectifs(specifications)]);
    const illustrations = await this.iaService.genererPlanIllustrations(specifications, codeHTML);
    return { title, description: description || `Cours ${title} généré automatiquement`, codeHTML, objectives, duration, illustrations };
  }

  async genererIllustrations({ generationId, illustrations = [] }) {
    if (!this.imageService) throw new Error("Le générateur d’images n’est pas configuré");
    const media = [];
    for (let index = 0; index < illustrations.slice(0, 3).length; index += 1) {
      const illustration = illustrations[index];
      const buffer = await this.imageService.generate(illustration);
      media.push(await this.repository.envoyerMedia({ buffer, filename: `course-${generationId}-${index + 1}.png`, altText: illustration.altText, caption: illustration.caption, prompt: illustration.prompt, generationId }));
    }
    return media;
  }

  associerIllustrations({ candidate, images = [] }) {
    if (!images.length) return candidate;
    const figures = images.map((image) => `<figure class="course-illustration"><img src="${image.url}" alt="${this.escapeAttribute(image.altText)}">${image.caption ? `<figcaption>${this.escapeText(image.caption)}</figcaption>` : ""}</figure>`).join("\n");
    const codeHTML = String(candidate.codeHTML || candidate.html || "").replace(/<\/main>\s*$/i, `${figures}\n</main>`);
    return { ...candidate, codeHTML };
  }

  async verifierCandidat({ candidate, images = [] }) {
    const deterministicIssues = this.validator.validate(candidate, images);
    return this.verifier.verify({ candidate, images, deterministicIssues });
  }

  async corrigerCandidat({ candidate, report, technology, level }) {
    const codeHTML = await this.iaService.ameliorerCours(candidate.codeHTML, report.issues.map((issue) => issue.correction || issue.message).join("\n"), { titre: candidate.title, technologie: technology, niveau: level, duree: candidate.duration });
    return { ...candidate, codeHTML };
  }

  same(left, right) { return String(left || "").trim().toLocaleLowerCase("fr") === String(right || "").trim().toLocaleLowerCase("fr"); }
  escapeAttribute(value) { return this.escapeText(value).replace(/"/g, "&quot;"); }
  escapeText(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
}
