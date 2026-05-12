import { Revision } from "../entities/Revision.js";

export class ReviserCours {
  constructor(coursRepository, iaService) {
    this.coursRepository = coursRepository;
    this.iaService = iaService;
  }

  async executer(demande) {
    this.validerDemande(demande);

    const cours = await this.coursRepository.trouverParId(demande.coursId);
    if (!cours) {
      throw new Error("Le cours n'a pas été trouvé");
    }

    const contexte = {
      titre: cours.title,
      technologie: cours.technology.name,
      niveau: cours.level.name,
      duree: cours.duration
    };

    const nouveauCode = await this.iaService.ameliorerCours(
      cours.code,
      demande.commentaire,
      contexte
    );

    const revision = new Revision({
      courseId: demande.coursId,
      typeRevision: demande.typeRevision,
      commentaire: demande.commentaire,
      ancienCode: cours.code,
      nouveauCode,
      appliquee: demande.appliquerDirectement || false
    });

    revision.valider();

    const revisionId = await this.coursRepository.sauvegarderRevision(revision);

    let coursModifie = null;
    if (demande.appliquerDirectement) {
      coursModifie = cours.clone({
        code: nouveauCode,
        updatedAt: new Date()
      });
      await this.coursRepository.sauvegarder(coursModifie);
    }

    return { revisionId, revision, coursModifie };
  }

  async appliquerRevision(revisionId) {
    const revisions = await this.coursRepository.listerRevisions(null);
    const revision = revisions.find((item) => item.id === revisionId);

    if (!revision) {
      throw new Error("La révision n'a pas été trouvée");
    }

    if (revision.appliquee) {
      throw new Error("La révision a déjà été appliquée");
    }

    const cours = await this.coursRepository.trouverParId(revision.courseId);
    if (!cours) {
      throw new Error("Le cours n'a pas été trouvé");
    }

    const coursModifie = cours.clone({
      code: revision.nouveauCode,
      updatedAt: new Date()
    });

    await this.coursRepository.sauvegarder(coursModifie);

    revision.appliquer();
    await this.coursRepository.sauvegarderRevision(revision);

    return coursModifie;
  }

  validerDemande(demande) {
    if (!demande?.coursId) {
      throw new Error("L'identifiant du cours est requis");
    }

    const types = ["correction", "amelioration", "retour_eleve", "maj_techno"];
    if (!types.includes(demande?.typeRevision)) {
      throw new Error("Le type de révision est invalide");
    }

    if (!demande?.commentaire) {
      throw new Error("Le commentaire est requis");
    }
  }
}
