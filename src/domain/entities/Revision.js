export class Revision {
  constructor({
    id = null,
    courseId,
    typeRevision,
    commentaire,
    ancienCode,
    nouveauCode,
    dateRevision = new Date(),
    appliquee = false
  }) {
    this.id = id;
    this.courseId = courseId;
    this.typeRevision = typeRevision;
    this.commentaire = commentaire;
    this.ancienCode = ancienCode;
    this.nouveauCode = nouveauCode;
    this.dateRevision = dateRevision;
    this.appliquee = appliquee;
  }

  valider() {
    if (!this.courseId) {
      throw new Error("L'identifiant du cours est requis");
    }

    const types = ["correction", "amelioration", "retour_eleve", "maj_techno"];
    if (!types.includes(this.typeRevision)) {
      throw new Error("Le type de révision est invalide");
    }
    if (!this.commentaire) {
      throw new Error("Le commentaire est requis");
    }
    if (!this.ancienCode) {
      throw new Error("L'ancien code est requis");
    }
    if (!this.nouveauCode) {
      throw new Error("Le nouveau code est requis");
    }
  }

  appliquer() {
    this.valider();
    this.appliquee = true;
  }

  getPourcentageChangement() {
    const ancienLength = (this.ancienCode || "").length;
    const nouveauLength = (this.nouveauCode || "").length;

    if (ancienLength === 0) {
      return 100;
    }

    const diff = Math.abs(nouveauLength - ancienLength);
    return Math.round((diff / ancienLength) * 100);
  }

  getSummary() {
    const statut = this.appliquee ? "[Appliquée]" : "[En attente]";
    const extrait = (this.commentaire || "").slice(0, 50);
    const suffixe = this.commentaire && this.commentaire.length > 50 ? "..." : "";
    return `${statut} ${this.typeRevision} - ${extrait}${suffixe}`;
  }
}
