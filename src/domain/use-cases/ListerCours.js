export class ListerCours {
  constructor(coursRepository) {
    this.coursRepository = coursRepository;
  }

  async parTechnologie(technologieNom) {
    const technologie = await this.coursRepository.trouverTechnologieParNom(
      technologieNom
    );
    if (!technologie) {
      throw new Error("La technologie n'a pas été trouvée");
    }
    return this.coursRepository.listerParTechnologie(technologie.id);
  }

  async parNiveau(niveauNom) {
    const niveau = await this.coursRepository.trouverNiveauParNom(niveauNom);
    if (!niveau) {
      throw new Error("Le niveau n'a pas été trouvé");
    }
    return this.coursRepository.listerParNiveau(niveau.id);
  }

  async parStatut(statut) {
    const statuts = ["brouillon", "publie", "archive"];
    if (!statuts.includes(statut)) {
      throw new Error("Le statut est invalide");
    }
    return this.coursRepository.listerParStatut(statut);
  }

  async coursIA() {
    return this.coursRepository.listerCoursIA();
  }

  async coursAReviser() {
    const tousCours = await this.coursRepository.listerParStatut("publie");
    return tousCours.filter((cours) => cours.necessiteRevision());
  }

  async revisionsParCours(coursId) {
    return this.coursRepository.listerRevisions(coursId);
  }

  async technologies() {
    return this.coursRepository.listerTechnologies();
  }

  async niveaux() {
    return this.coursRepository.listerNiveaux();
  }

  async menus() {
    return this.coursRepository.listerMenus();
  }
}
