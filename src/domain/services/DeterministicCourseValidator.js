export class DeterministicCourseValidator {
  validate(candidate, images = []) {
    const html = candidate?.codeHTML || candidate?.html || "";
    const issues = [];
    if (!/<main\s+class=["']principal["'][^>]*>/i.test(html)) issues.push(this.issue("INVALID_HTML", "blocking", "document", "La balise main.principal est absente.", "Respecter la structure HTML attendue."));
    if (/<script\b|on\w+\s*=/i.test(html)) issues.push(this.issue("UNSAFE_HTML", "blocking", "document", "Le HTML contient du script ou un gestionnaire d’événement.", "Retirer tout script et tout attribut on*."));
    if (/style\s*=/i.test(html)) issues.push(this.issue("INLINE_STYLE", "major", "document", "Le HTML contient du style en ligne.", "Utiliser les classes CSS existantes."));
    if (images.length > 3) issues.push(this.issue("TOO_MANY_IMAGES", "major", "illustrations", "Plus de trois illustrations sont demandées.", "Limiter le cours à trois illustrations."));
    for (const image of images) if (!image.altText) issues.push(this.issue("MISSING_ALT", "major", "illustration", "Une image ne possède pas de texte alternatif.", "Ajouter un altText descriptif."));
    return issues;
  }

  issue(code, severity, location, message, correction) { return { code, severity, location, message, correction }; }
}
