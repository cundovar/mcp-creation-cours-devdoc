import { describe, expect, it } from "vitest";
import { OrchestrerCours } from "../../src/domain/use-cases/OrchestrerCours.js";
import { DeterministicCourseValidator } from "../../src/domain/services/DeterministicCourseValidator.js";

describe("OrchestrerCours", () => {
  it("réutilise l’arborescence et crée le menu par défaut", async () => {
    const created = [];
    const repository = {
      listerSuperMenus: async () => [], creerSuperMenu: async (name) => ({ id: 1, name }),
      listerCategories: async () => [], creerTechnologie: async (data) => ({ id: 2, ...data }),
      listerNiveaux: async () => [], listerPositionsMenus: async () => [], listerMenus: async () => [],
      creerMenu: async (data) => { created.push(data); return { id: 3, ...data }; }
    };
    const service = new OrchestrerCours(repository, {}, null, {}, new DeterministicCourseValidator());
    const result = await service.preparerFormation({ superMenu: "AUTOMATISATION", category: "n8n" });
    expect(result.menus).toHaveLength(1);
    expect(created[0].label).toBe("Cours");
    expect(created[0].categoryId).toBe(2);
  });

  it("ne crée qu’un menu pour deux demandes identiques avec la même position", async () => {
    const menus = [];
    const repository = {
      listerSuperMenus: async () => [{ id: 1, name: "AUTOMATISATION" }],
      listerCategories: async () => [{ id: 2, name: "n8n", superMenu: { id: 1 } }],
      listerNiveaux: async () => [{ id: 3, name: "Débutant" }],
      listerPositionsMenus: async () => [],
      creerPositionMenu: async (position) => ({ id: 4, position }),
      listerMenus: async () => [],
      creerMenu: async (data) => { const menu = { id: 5, ...data }; menus.push(menu); return menu; }
    };
    const service = new OrchestrerCours(repository, {}, null, {}, new DeterministicCourseValidator());
    const result = await service.preparerFormation({ superMenu: "AUTOMATISATION", category: "n8n", menus: [
      { name: "Cours", level: "Débutant", position: "Principal" },
      { name: "Cours", level: "Débutant", position: "Principal" }
    ] });
    expect(menus).toHaveLength(1);
    expect(result.menus[0].id).toBe(result.menus[1].id);
  });

  it("génère un candidat sans appeler le planificateur d’illustrations", async () => {
    let plannerCalled = false;
    const iaService = {
      genererCandidat: async () => ({
        codeHTML: '<main class="principal"><h1>Python</h1></main>',
        objectives: "- Comprendre Python"
      }),
      genererPlanIllustrations: async () => {
        plannerCalled = true;
        return [{ prompt: "image" }];
      }
    };
    const service = new OrchestrerCours({}, iaService, null, {}, new DeterministicCourseValidator());

    const result = await service.genererCandidat({
      title: "Python",
      technology: "Python",
      level: "Débutant",
      duration: "2h"
    });

    expect(plannerCalled).toBe(false);
    expect(result.illustrations).toEqual([]);
  });

  it("insère les illustrations même si le HTML contient un commentaire final", () => {
    const service = new OrchestrerCours({}, {}, null, {}, new DeterministicCourseValidator());
    const result = service.associerIllustrations({
      candidate: { codeHTML: '<main class="principal"><p>Texte</p></main><!-- fin -->' },
      images: [{ id: 1, url: "/uploads/course-media/schema.png", altText: "Schéma" }]
    });
    expect(result.codeHTML).toContain('src="/uploads/course-media/schema.png"');
    expect(result.codeHTML).toContain("<!-- fin -->");
  });

  it("bloque un candidat contenant un script", () => {
    const issues = new DeterministicCourseValidator().validate({ codeHTML: '<main class="principal"><script>alert(1)</script></main>' });
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNSAFE_HTML", severity: "blocking" })]));
  });

  it.each([
    ['<main class="principal"><a href="javascript:alert(1)">Lien</a></main>', "UNSAFE_URL"],
    ['<main class="principal"><a href="&#x6a;avascript:alert(1)">Lien</a></main>', "UNSAFE_URL"],
    ['<main class="principal"><iframe src="/interne"></iframe></main>', "FORBIDDEN_TAG"],
    ['<main class="principal"><object data="/interne"></object></main>', "FORBIDDEN_TAG"],
    ['<main class="principal"><embed src="/interne"></main>', "FORBIDDEN_TAG"],
    ['<main class="principal"><a href="https://example.org/piege">Externe</a></main>', "EXTERNAL_URL"]
  ])("bloque le HTML dangereux %#", (codeHTML, expectedCode) => {
    const issues = new DeterministicCourseValidator().validate({ codeHTML });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: expectedCode, severity: "blocking" })
    ]));
  });

  it("autorise les tableaux et schémas HTML sans image", () => {
    const codeHTML = '<main class="principal"><h1>Python</h1><table><caption>Flux</caption><tbody><tr><th>Entrée</th><td>Traitement → résultat</td></tr></tbody></table></main>';
    expect(new DeterministicCourseValidator().validate({ codeHTML, illustrations: [] })).toEqual([]);
  });

  it("bloque toute image ou demande d’illustration", () => {
    const validator = new DeterministicCourseValidator();
    expect(validator.validate({
      codeHTML: '<main class="principal"><img src="/uploads/course-media/cours.png" alt="Schéma"></main>',
      illustrations: [{ prompt: "image" }]
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "FORBIDDEN_TAG", severity: "blocking" }),
      expect.objectContaining({ code: "IMAGES_NOT_ALLOWED", severity: "blocking" })
    ]));
  });
});
