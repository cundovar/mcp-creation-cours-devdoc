import { describe, expect, it } from "vitest";
import { OrchestrerCours } from "../../src/domain/use-cases/OrchestrerCours.js";
import { DeterministicCourseValidator } from "../../src/domain/services/DeterministicCourseValidator.js";

describe("OrchestrerCours", () => {
  it("réutilise l’arborescence et crée le menu par défaut", async () => {
    const created = [];
    const repository = {
      listerSuperMenus: async () => [], creerSuperMenu: async (name) => ({ id: 1, name }),
      listerCategories: async () => [], creerTechnologie: async (data) => ({ id: 2, ...data }),
      listerNiveaux: async () => [], listerMenus: async () => [],
      creerMenu: async (data) => { created.push(data); return { id: 3, ...data }; }
    };
    const service = new OrchestrerCours(repository, {}, null, {}, new DeterministicCourseValidator());
    const result = await service.preparerFormation({ superMenu: "AUTOMATISATION", category: "n8n" });
    expect(result.menus).toHaveLength(1);
    expect(created[0].label).toBe("Cours");
    expect(created[0].categoryId).toBe(2);
  });

  it("bloque un candidat contenant un script", () => {
    const issues = new DeterministicCourseValidator().validate({ codeHTML: '<main class="principal"><script>alert(1)</script></main>' });
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNSAFE_HTML", severity: "blocking" })]));
  });
});
