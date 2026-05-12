import { Cours } from "../entities/Cours.js";

export class CreerCours {
  constructor(coursRepository, iaService) {
    this.coursRepository = coursRepository;
    this.iaService = iaService;
  }

  async executer(demande) {
    this.validerDemande(demande);

    const technology = await this.coursRepository.trouverTechnologieParNom(
      demande.technologie
    );
    if (!technology) {
      throw new Error("La technologie n'a pas été trouvée");
    }

    const level = await this.coursRepository.trouverNiveauParNom(demande.niveau);
    if (!level) {
      throw new Error("Le niveau n'a pas été trouvé");
    }

    const specifications = {
      sujet: demande.titre,
      technologie: technology.name,
      niveau: level.name,
      duree: demande.duree
    };

    const codeHTML = await this.iaService.genererCours(specifications);
    const objectifs = await this.iaService.genererObjectifs(specifications);

    const cours = new Cours({
      title: demande.titre,
      description: demande.description || `Cours ${demande.titre} généré automatiquement`,
      code: codeHTML,
      objectifs,
      duration: demande.duree,
      level,
      technology,
      statut: "brouillon",
      genereParIA: true
    });

    cours.valider();

    const coursId = await this.coursRepository.sauvegarder(cours, {
      menuId: demande.menuId,
      nouveauMenuLabel: demande.nouveauMenuLabel
    });

    return {
      id: coursId,
      cours: cours.clone({ id: coursId })
    };
  }

  validerDemande(demande) {
    if (!demande?.titre) {
      throw new Error("Le titre est requis");
    }
    if (!demande?.technologie) {
      throw new Error("La technologie est requise");
    }
    if (!demande?.niveau) {
      throw new Error("Le niveau est requis");
    }
    if (!demande?.duree) {
      throw new Error("La durée est requise");
    }
  }
}
