export class IIAService {
  async genererCours(_specifications) {
    throw new Error("La méthode genererCours doit être implémentée");
  }

  async ameliorerCours(_codeActuel, _commentaires, _contexte) {
    throw new Error("La méthode ameliorerCours doit être implémentée");
  }

  async genererObjectifs(_specifications) {
    throw new Error("La méthode genererObjectifs doit être implémentée");
  }

  async genererExercices(_specifications, _contenuCours) {
    throw new Error("La méthode genererExercices doit être implémentée");
  }
}
