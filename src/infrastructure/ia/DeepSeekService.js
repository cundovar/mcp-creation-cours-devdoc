import OpenAI from "openai";
import { IIAService } from "../../domain/ports/IIAService.js";

export class DeepSeekService extends IIAService {
  constructor(apiKey) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com"
    });
  }

  async genererCours(specifications) {
    const prompt = this.construirePromptCreation(specifications);

    try {
      const response = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: this.getSystemPromptCreation() },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 8000
      });

      const contenu = response.choices[0].message.content;
      return this.extraireHTML(contenu);
    } catch (error) {
      throw new Error(`Échec de la génération du cours: ${error.message}`);
    }
  }

  async ameliorerCours(codeActuel, commentaires, contexte) {
    const prompt = this.construirePromptAmelioration(
      codeActuel,
      commentaires,
      contexte
    );

    try {
      const response = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: this.getSystemPromptRevision() },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 8000
      });

      const contenu = response.choices[0].message.content;
      return this.extraireHTML(contenu);
    } catch (error) {
      throw new Error(`Échec de l'amélioration du cours: ${error.message}`);
    }
  }

  async genererObjectifs(specifications) {
    const prompt = `Liste 3 à 5 compétences techniques concrètes pour "${specifications.sujet}" en ${specifications.technologie}.
Format : liste avec tirets, verbes d'action (Implémenter, Configurer, Débugger...).
Pas de contexte, juste les compétences.`;

    const response = await this.client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "Tu listes des compétences techniques. Pas d'introduction, pas de conclusion, juste la liste."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 500
    });

    return response.choices[0].message.content.trim();
  }

  async genererExercices(specifications, contenuCours) {
    const extrait = (contenuCours || "").slice(0, 2000);
    const prompt = `Génère 3 exercices progressifs en HTML basés sur le cours suivant (extrait) :\n\n${extrait}\n\nContexte : ${specifications.sujet}, technologie ${specifications.technologie}, niveau ${specifications.niveau}, durée ${specifications.duree}.`;

    const response = await this.client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "Tu es un formateur spécialisé dans la création d'exercices pédagogiques."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 1200
    });

    return this.extraireHTML(response.choices[0].message.content);
  }

  async genererPlanIllustrations(specifications, contenuCours) {
    const response = await this.client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Propose au maximum trois illustrations pédagogiques. Réponds uniquement par JSON {illustrations:[{prompt,altText,caption}]}. Si aucune image n'est utile, utilise un tableau vide." },
        { role: "user", content: `Cours : ${specifications.sujet}\nTechnologie : ${specifications.technologie}\n\nContenu :\n${(contenuCours || "").slice(0, 7000)}` }
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" }
    });
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    return (Array.isArray(parsed.illustrations) ? parsed.illustrations : []).slice(0, 3).filter((item) => item?.prompt && item?.altText);
  }

  construirePromptCreation(specs) {
    return `Crée un cours technique en HTML sur "${specs.sujet}" (${specs.technologie}).

STRUCTURE OBLIGATOIRE - Le HTML doit être encapsulé dans <main class="principal"> avec ces sections :
1. <section class="introduction"> - Contexte technique bref (2-3 phrases max, pas d'analogies)
2. <section class="theorie"> - Concepts clés avec exemples de code
3. <section class="pratique"> - Exercices progressifs
4. <section class="resume"> - Points essentiels à retenir

RÈGLES :
- HTML sémantique, AUCUN CSS inline
- Exemples de code dans <pre><code> avec commentaires français
- Aller droit au but, pas de métaphores ou d'analogies
- Ne PAS mentionner le niveau, la durée ou le public cible dans le contenu
- Commencer directement par le sujet technique`;
  }

  construirePromptAmelioration(codeActuel, commentaires, contexte) {
    return `Améliore le code HTML suivant selon les commentaires donnés, sans changer la structure principale.
Contexte : ${contexte.titre} (${contexte.technologie}, niveau ${contexte.niveau}, durée ${contexte.duree}).
Conserve la balise <main class="principal"> et n'améliore que les parties concernées par les commentaires.

Commentaires :
${commentaires}

HTML actuel :
${codeActuel}`;
  }

  getSystemPromptCreation() {
    return "Tu es un développeur senior qui rédige de la documentation technique. Tu vas droit au but sans analogies ni métaphores. Tu produis du HTML sémantique encapsulé dans <main class=\"principal\">, avec des exemples de code commentés en français. Tu ne mentionnes jamais le niveau, la durée ou le public cible.";
  }

  getSystemPromptRevision() {
    return "Tu améliores du contenu technique existant. Tu conserves la structure <main class=\"principal\">, tu ne rajoutes pas d'analogies ni de mentions de niveau/durée/public. Tu améliores uniquement ce qui est demandé.";
  }

  extraireHTML(texte) {
    let html = (texte || "").trim();
    html = html.replace(/```html\n/gi, "");
    html = html.replace(/\n```/g, "");
    html = html.replace(/```/g, "").trim();

    if (!/<main\s+class=["']principal["']\s*>/i.test(html)) {
      throw new Error(
        "Le HTML généré ne contient pas de balise main class principal"
      );
    }

    return html.trim();
  }
}
