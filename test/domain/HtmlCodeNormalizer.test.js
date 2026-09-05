import { describe, expect, it } from "vitest";
import { HtmlCodeNormalizer } from "../../src/domain/services/HtmlCodeNormalizer.js";

describe("HtmlCodeNormalizer", () => {
  it.each([
    ["Array<number>", "Array&lt;number&gt;"],
    ["Promise<string>", "Promise&lt;string&gt;"],
    ["Map<string, number>", "Map&lt;string, number&gt;"],
    ["identite<T>(valeur: T)", "identite&lt;T&gt;(valeur: T)"],
    ["if (x < 10 && y > 2)", "if (x &lt; 10 &amp;&amp; y &gt; 2)"],
    ["Array&lt;number&gt;", "Array&lt;number&gt;"]
  ])("échappe le code %s sans créer de balise HTML", (source, expected) => {
    const normalizer = new HtmlCodeNormalizer();
    const html = `<main class="principal"><pre><code>${source}</code></pre></main>`;
    expect(normalizer.normalize(html)).toBe(
      `<main class="principal"><pre><code>${expected}</code></pre></main>`
    );
  });

  it("ne modifie pas le HTML situé hors des balises code", () => {
    const html = '<main class="principal"><h1>Titre</h1><p>Texte</p></main>';
    expect(new HtmlCodeNormalizer().normalize(html)).toBe(html);
  });
});
