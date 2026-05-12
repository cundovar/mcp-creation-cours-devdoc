export class GererMenus {
  constructor(coursRepository) {
    this.coursRepository = coursRepository;
  }

  async lister(filtres = {}) {
    const resolvedFilters = await this.resolveFilters(filtres);
    return this.coursRepository.listerMenus(resolvedFilters);
  }

  async voir(menuId) {
    if (!menuId) {
      throw new Error("L'identifiant du menu est requis");
    }

    const menu = await this.coursRepository.trouverMenuParId(Number(menuId));
    if (!menu) {
      throw new Error("Le menu n'a pas été trouvé");
    }

    return menu;
  }

  async creer(data = {}) {
    if (!data.label) {
      throw new Error("Le libellé du menu est requis");
    }

    const resolvedData = await this.resolveData(data);
    return this.coursRepository.creerMenu(resolvedData);
  }

  async editer(menuId, data = {}) {
    if (!menuId) {
      throw new Error("L'identifiant du menu est requis");
    }

    const menu = await this.coursRepository.trouverMenuParId(Number(menuId));
    if (!menu) {
      throw new Error("Le menu n'a pas été trouvé");
    }

    const resolvedData = await this.resolveData(data, true);
    return this.coursRepository.mettreAJourMenu(Number(menuId), resolvedData);
  }

  async resolveFilters(filtres = {}) {
    const resolved = {};

    if (filtres.technologie) {
      const technologie = await this.coursRepository.trouverTechnologieParNom(
        filtres.technologie
      );
      if (!technologie) {
        throw new Error("La technologie n'a pas été trouvée");
      }
      resolved.categoryId = technologie.id;
    }

    if (filtres.niveau) {
      const niveau = await this.coursRepository.trouverNiveauParNom(
        filtres.niveau
      );
      if (!niveau) {
        throw new Error("Le niveau n'a pas été trouvé");
      }
      resolved.niveauCoursId = niveau.id;
    }

    if (filtres.categoryId) {
      resolved.categoryId = Number(filtres.categoryId);
    }

    if (filtres.niveauCoursId) {
      resolved.niveauCoursId = Number(filtres.niveauCoursId);
    }

    if (filtres.positionMenusId) {
      resolved.positionMenusId = Number(filtres.positionMenusId);
    }

    return resolved;
  }

  async resolveData(data = {}, partial = false) {
    const resolved = {};

    if (Object.prototype.hasOwnProperty.call(data, "label")) {
      resolved.label = data.label;
    } else if (!partial) {
      throw new Error("Le libellé du menu est requis");
    }

    if (Object.prototype.hasOwnProperty.call(data, "categoryId")) {
      resolved.categoryId = data.categoryId;
    } else if (data.technologie) {
      const technologie = await this.coursRepository.trouverTechnologieParNom(
        data.technologie
      );
      if (!technologie) {
        throw new Error("La technologie n'a pas été trouvée");
      }
      resolved.categoryId = technologie.id;
    }

    if (Object.prototype.hasOwnProperty.call(data, "niveauCoursId")) {
      resolved.niveauCoursId = data.niveauCoursId;
    } else if (data.niveau) {
      const niveau = await this.coursRepository.trouverNiveauParNom(data.niveau);
      if (!niveau) {
        throw new Error("Le niveau n'a pas été trouvé");
      }
      resolved.niveauCoursId = niveau.id;
    }

    if (Object.prototype.hasOwnProperty.call(data, "positionMenusId")) {
      resolved.positionMenusId = data.positionMenusId;
    }

    return resolved;
  }
}
