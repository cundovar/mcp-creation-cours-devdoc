export class ICoursRepository {
  async sauvegarder(_cours) {
    throw new Error("La méthode sauvegarder doit être implémentée");
  }

  async trouverParId(_id) {
    throw new Error("La méthode trouverParId doit être implémentée");
  }

  async listerParTechnologie(_technologyId) {
    throw new Error("La méthode listerParTechnologie doit être implémentée");
  }

  async listerParNiveau(_levelId) {
    throw new Error("La méthode listerParNiveau doit être implémentée");
  }

  async listerParStatut(_statut) {
    throw new Error("La méthode listerParStatut doit être implémentée");
  }

  async listerCoursIA() {
    throw new Error("La méthode listerCoursIA doit être implémentée");
  }

  async sauvegarderRevision(_revision) {
    throw new Error("La méthode sauvegarderRevision doit être implémentée");
  }

  async listerRevisions(_courseId) {
    throw new Error("La méthode listerRevisions doit être implémentée");
  }

  async trouverTechnologieParNom(_nom) {
    throw new Error("La méthode trouverTechnologieParNom doit être implémentée");
  }

  async trouverNiveauParNom(_nom) {
    throw new Error("La méthode trouverNiveauParNom doit être implémentée");
  }

  async listerTechnologies() {
    throw new Error("La méthode listerTechnologies doit être implémentée");
  }

  async listerNiveaux() {
    throw new Error("La méthode listerNiveaux doit être implémentée");
  }

  async listerMenus() {
    throw new Error("La méthode listerMenus doit être implémentée");
  }

  async trouverMenuParId(_id) {
    throw new Error("La méthode trouverMenuParId doit être implémentée");
  }

  async creerMenu(_data) {
    throw new Error("La méthode creerMenu doit être implémentée");
  }

  async mettreAJourMenu(_id, _data) {
    throw new Error("La méthode mettreAJourMenu doit être implémentée");
  }
}
