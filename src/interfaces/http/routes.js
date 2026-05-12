export function setupRoutes(app, container) {
  const creerCoursUseCase = container.getCreerCoursUseCase();
  const reviserCoursUseCase = container.getReviserCoursUseCase();
  const listerCoursUseCase = container.getListerCoursUseCase();
  const coursRepository = container.getCoursRepository();

  app.post("/api/cours/creer", async (req, res, next) => {
    try {
      const { titre, description, technologie, niveau, duree, menuId, nouveauMenuLabel } = req.body || {};
      if (!titre || !technologie || !niveau || !duree) {
        return res.status(400).json({
          error: "Champs requis manquants",
          required: ["titre", "technologie", "niveau", "duree"]
        });
      }

      const result = await creerCoursUseCase.executer({
        titre,
        description,
        technologie,
        niveau,
        duree,
        menuId: menuId ? Number.parseInt(menuId, 10) : undefined,
        nouveauMenuLabel
      });

      return res.status(201).json({
        success: true,
        message: "Cours créé avec succès",
        data: {
          id: result.id,
          titre: result.cours.title,
          technologie: result.cours.technology?.name,
          niveau: result.cours.level?.name,
          duree: result.cours.duration,
          statut: result.cours.statut,
          genereParIA: result.cours.genereParIA
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/cours/reviser", async (req, res, next) => {
    try {
      const { coursId, typeRevision, commentaire, appliquerDirectement } =
        req.body || {};

      if (!coursId || !typeRevision || !commentaire) {
        return res.status(400).json({
          error: "Champs requis manquants",
          required: ["coursId", "typeRevision", "commentaire"]
        });
      }

      const result = await reviserCoursUseCase.executer({
        coursId,
        typeRevision,
        commentaire,
        appliquerDirectement
      });

      return res.status(201).json({
        success: true,
        message: "Révision créée avec succès",
        data: {
          revisionId: result.revisionId,
          typeRevision: result.revision.typeRevision,
          commentaire: result.revision.commentaire,
          appliquee: result.revision.appliquee
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/revisions/:id/appliquer", async (req, res, next) => {
    try {
      const revisionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(revisionId)) {
        return res.status(400).json({ error: "ID de révision invalide" });
      }

      const coursModifie = await reviserCoursUseCase.appliquerRevision(
        revisionId
      );

      return res.json({
        success: true,
        message: "Révision appliquée",
        data: {
          id: coursModifie.id,
          titre: coursModifie.title,
          statut: coursModifie.statut
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/revisions/:id", async (req, res, next) => {
    try {
      const revisionId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(revisionId)) {
        return res.status(400).json({ error: "ID de révision invalide" });
      }

      const { commentaire, nouveauCode, typeRevision } = req.body || {};
      const revisions = await coursRepository.listerRevisions(null);
      const revision = revisions.find((item) => item.id === revisionId);

      if (!revision) {
        return res.status(404).json({ error: "Révision non trouvée" });
      }

      if (commentaire !== undefined) {
        revision.commentaire = commentaire;
      }
      if (nouveauCode !== undefined) {
        revision.nouveauCode = nouveauCode;
      }
      if (typeRevision !== undefined) {
        revision.typeRevision = typeRevision;
      }

      await coursRepository.sauvegarderRevision(revision);

      return res.json({
        success: true,
        message: "Révision mise à jour",
        data: {
          id: revision.id,
          typeRevision: revision.typeRevision,
          commentaire: revision.commentaire,
          nouveauCode: revision.nouveauCode,
          appliquee: revision.appliquee
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/cours/:id", async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const cours = await coursRepository.trouverParId(id);
      if (!cours) {
        return res.status(404).json({ error: "Cours non trouvé" });
      }

      return res.json({ success: true, data: cours });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/cours", async (req, res, next) => {
    try {
      const { technologie, niveau, statut, ia, aReviser } = req.query || {};
      let cours = [];

      if (technologie) {
        cours = await listerCoursUseCase.parTechnologie(technologie);
      } else if (niveau) {
        cours = await listerCoursUseCase.parNiveau(niveau);
      } else if (statut) {
        cours = await listerCoursUseCase.parStatut(statut);
      } else if (ia) {
        cours = await listerCoursUseCase.coursIA();
      } else if (aReviser) {
        cours = await listerCoursUseCase.coursAReviser();
      } else {
        cours = await listerCoursUseCase.parStatut("publie");
      }

      const data = cours.map((item) => ({
        id: item.id,
        titre: item.title,
        technologie: item.technology?.name,
        niveau: item.level?.name,
        duree: item.duration,
        statut: item.statut,
        genereParIA: item.genereParIA,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/cours/:id/revisions", async (req, res, next) => {
    try {
      const courseId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(courseId)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const revisions = await listerCoursUseCase.revisionsParCours(courseId);

      const data = revisions.map((revision) => ({
        id: revision.id,
        courseId: revision.courseId,
        typeRevision: revision.typeRevision,
        commentaire: revision.commentaire,
        ancienCode: revision.ancienCode,
        nouveauCode: revision.nouveauCode,
        dateRevision: revision.dateRevision,
        appliquee: revision.appliquee
      }));

      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/technologies", async (_req, res, next) => {
    try {
      const technologies = await listerCoursUseCase.technologies();
      return res.json({ success: true, data: technologies });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/niveaux", async (_req, res, next) => {
    try {
      const niveaux = await listerCoursUseCase.niveaux();
      return res.json({ success: true, data: niveaux });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/menus", async (_req, res, next) => {
    try {
      const menus = await listerCoursUseCase.menus();
      return res.json({ success: true, data: menus });
    } catch (error) {
      return next(error);
    }
  });
}
