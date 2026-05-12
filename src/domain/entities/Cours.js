export class Cours {
  constructor({
    id = null,
    title,
    description = null,
    code,
    objectifs = null,
    exercices = null,
    duration,
    level,
    technology,
    modules = [],
    statut = "brouillon",
    genereParIA = false,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.code = code;
    this.objectifs = objectifs;
    this.exercices = exercices;
    this.duration = duration;
    this.level = level;
    this.technology = technology;
    this.modules = modules;
    this.statut = statut;
    this.genereParIA = genereParIA;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  valider() {
    if (!this.title) {
      throw new Error("Le titre du cours est requis");
    }
    if (!this.code) {
      throw new Error("Le contenu HTML du cours est requis");
    }
    if (!this.level || !this.level.id) {
      throw new Error("Le niveau est requis");
    }
    if (!this.technology || !this.technology.id) {
      throw new Error("La technologie est requise");
    }
    if (!this.duration) {
      throw new Error("La durée est requise");
    }
    if (!this.isValidHTML(this.code)) {
      throw new Error("Le HTML du cours n'est pas valide");
    }

    const statuts = ["brouillon", "publie", "archive"];
    if (!statuts.includes(this.statut)) {
      throw new Error("Le statut du cours est invalide");
    }
  }

  isValidHTML(html) {
    if (!html || (!html.includes("<") && !html.includes(">"))) {
      return false;
    }

    return /<main\s+class=["']principal["']\s*>/i.test(html);
  }

  publier() {
    this.valider();
    if (!this.code) {
      throw new Error("Impossible de publier un cours sans contenu");
    }
    this.statut = "publie";
    this.updatedAt = new Date();
  }

  archiver() {
    this.statut = "archive";
    this.updatedAt = new Date();
  }

  estRecent() {
    const now = Date.now();
    const createdAt = new Date(this.createdAt).getTime();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    return diffDays < 30;
  }

  necessiteRevision() {
    const now = Date.now();
    const updatedAt = new Date(this.updatedAt).getTime();
    const diffDays = (now - updatedAt) / (1000 * 60 * 60 * 24);
    return diffDays > 90;
  }

  getSummary() {
    return `${this.title} - ${this.technology?.name} - ${this.level?.name} - ${this.duration}`;
  }

  clone(overrides = {}) {
    return new Cours({
      id: this.id,
      title: this.title,
      description: this.description,
      code: this.code,
      objectifs: this.objectifs,
      exercices: this.exercices,
      duration: this.duration,
      level: this.level,
      technology: this.technology,
      modules: this.modules,
      statut: this.statut,
      genereParIA: this.genereParIA,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...overrides
    });
  }
}
