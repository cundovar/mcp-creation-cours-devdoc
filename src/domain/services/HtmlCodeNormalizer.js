const CODE_BLOCK = /(<code\b[^>]*>)([\s\S]*?)(<\/code\s*>)/gi;

export class HtmlCodeNormalizer {
  normalize(html) {
    return String(html || "").replace(CODE_BLOCK, (_match, opening, source, closing) => {
      const decoded = this.decodeEntities(source);
      return `${opening}${this.escapeCode(decoded)}${closing}`;
    });
  }

  decodeEntities(value) {
    return String(value)
      .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&");
  }

  escapeCode(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
