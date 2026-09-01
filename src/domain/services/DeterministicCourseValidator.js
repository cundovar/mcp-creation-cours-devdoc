import { parseFragment } from "parse5";

const ALLOWED_TAGS = new Set([
  "main", "section", "article", "header", "footer", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
  "ul", "ol", "li", "dl", "dt", "dd", "blockquote", "pre", "code",
  "strong", "em", "b", "i", "u", "mark", "small", "kbd", "samp",
  "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td",
  "figure", "figcaption", "img", "a", "details", "summary"
]);

const GLOBAL_ATTRIBUTES = new Set(["class", "id", "title", "lang", "dir", "role", "aria-label"]);
const TAG_ATTRIBUTES = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "headers", "scope"]),
  ol: new Set(["start", "reversed"]),
  li: new Set(["value"]),
  details: new Set(["open"])
};

export class DeterministicCourseValidator {
  constructor({ allowedExternalHosts = [] } = {}) {
    this.allowedExternalHosts = new Set(allowedExternalHosts.map((host) => String(host).trim().toLowerCase()).filter(Boolean));
  }

  validate(candidate, images = []) {
    const html = String(candidate?.codeHTML || candidate?.html || "");
    const issues = [];
    const parseErrors = [];
    const document = parseFragment(html, { onParseError: (error) => parseErrors.push(error) });
    const referencedImages = new Map();
    let principalMainCount = 0;

    if (!html.trim()) {
      issues.push(this.issue("INVALID_HTML", "blocking", "document", "Le document HTML est vide.", "Fournir un document HTML complet."));
      return issues;
    }

    this.walk(document, (node) => {
      if (!node.tagName) return;
      const tag = node.tagName.toLowerCase();
      const attributes = new Map((node.attrs || []).map((attribute) => [attribute.name.toLowerCase(), attribute.value]));

      if (tag === "main" && this.classNames(attributes.get("class")).includes("principal")) principalMainCount += 1;
      if (!ALLOWED_TAGS.has(tag)) {
        const code = tag === "script" ? "UNSAFE_HTML" : "FORBIDDEN_TAG";
        issues.push(this.issue(code, "blocking", tag, `La balise <${tag}> n’est pas autorisée.`, "Utiliser uniquement les balises HTML pédagogiques autorisées."));
        return;
      }

      for (const [name, value] of attributes) {
        if (name.startsWith("on")) {
          issues.push(this.issue("UNSAFE_HTML", "blocking", tag, `L’attribut ${name} est interdit.`, "Retirer tout gestionnaire d’événement."));
          continue;
        }
        if (name === "style") {
          issues.push(this.issue("INLINE_STYLE", "blocking", tag, "Le HTML contient du style en ligne.", "Utiliser les classes CSS existantes."));
          continue;
        }
        if (!GLOBAL_ATTRIBUTES.has(name) && !TAG_ATTRIBUTES[tag]?.has(name)) {
          issues.push(this.issue("FORBIDDEN_ATTRIBUTE", "blocking", tag, `L’attribut ${name} n’est pas autorisé sur <${tag}>.`, "Retirer l’attribut ou utiliser un attribut explicitement autorisé."));
        }
        if ((tag === "a" && name === "href") || (tag === "img" && name === "src")) {
          const urlIssue = this.validateUrl(value, tag);
          if (urlIssue) issues.push(urlIssue);
        }
      }

      if (tag === "img") {
        const src = attributes.get("src") || "";
        const alt = String(attributes.get("alt") || "").trim();
        if (!alt) issues.push(this.issue("MISSING_ALT", "blocking", "illustration", "Une image du HTML ne possède pas de texte alternatif.", "Ajouter un attribut alt descriptif."));
        if (src) referencedImages.set(src, alt);
      }
    });

    if (principalMainCount !== 1) issues.push(this.issue("INVALID_HTML", "blocking", "document", "Le document doit contenir exactement une balise main.principal.", "Respecter la structure HTML attendue."));
    if (parseErrors.length) issues.push(this.issue("INVALID_HTML", "blocking", "document", "Le document contient du HTML mal formé.", "Corriger la syntaxe HTML avant vérification."));
    if (images.length > 3) issues.push(this.issue("TOO_MANY_IMAGES", "blocking", "illustrations", "Plus de trois illustrations sont demandées.", "Limiter le cours à trois illustrations."));

    for (const image of images) {
      if (!String(image.altText || "").trim()) issues.push(this.issue("MISSING_ALT", "blocking", "illustration", "Une image ne possède pas de texte alternatif.", "Ajouter un altText descriptif."));
      if (!image.url || !referencedImages.has(image.url)) issues.push(this.issue("MISSING_MEDIA_REFERENCE", "blocking", "illustration", "Un média stocké n’est pas référencé dans le HTML final.", "Insérer le média Symfony dans le cours ou le supprimer."));
    }

    return this.uniqueIssues(issues);
  }

  validateUrl(rawValue, tag) {
    const value = String(rawValue || "").trim();
    if (!value) return this.issue("UNSAFE_URL", "blocking", tag, "Une URL vide n’est pas autorisée.", "Fournir une URL interne valide.");
    const compact = value.replace(/[\u0000-\u0020\u007f]+/g, "");
    const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();

    if (scheme && !["http", "https"].includes(scheme)) {
      return this.issue("UNSAFE_URL", "blocking", tag, `Le protocole ${scheme}: n’est pas autorisé.`, "Utiliser une URL interne ou HTTPS explicitement autorisée.");
    }

    if (tag === "img" && !compact.startsWith("/uploads/course-media/")) {
      return this.issue("EXTERNAL_URL", "blocking", tag, "Une image ne provient pas de la médiathèque Symfony.", "Utiliser l’URL Symfony du média stocké.");
    }

    const isExternal = compact.startsWith("//") || Boolean(scheme);
    if (isExternal) {
      try {
        const url = new URL(compact.startsWith("//") ? `https:${compact}` : compact);
        if (!this.allowedExternalHosts.has(url.hostname.toLowerCase())) {
          return this.issue("EXTERNAL_URL", "blocking", tag, `Le domaine externe ${url.hostname} n’est pas autorisé.`, "Retirer le lien ou autoriser explicitement ce domaine.");
        }
      } catch {
        return this.issue("UNSAFE_URL", "blocking", tag, "L’URL est invalide.", "Fournir une URL valide.");
      }
    }

    return null;
  }

  walk(node, visitor) {
    visitor(node);
    for (const child of node.childNodes || []) this.walk(child, visitor);
  }

  classNames(value) { return String(value || "").split(/\s+/).filter(Boolean); }

  uniqueIssues(issues) {
    const seen = new Set();
    return issues.filter((issue) => {
      const key = `${issue.code}|${issue.location}|${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  issue(code, severity, location, message, correction) { return { code, severity, location, message, correction }; }
}
