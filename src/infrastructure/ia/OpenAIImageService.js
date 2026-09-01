import OpenAI from "openai";

export class OpenAIImageService {
  constructor(apiKey, model) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate({ prompt }) {
    const result = await this.client.images.generate({ model: this.model, prompt, size: "1024x1024", output_format: "png" });
    const image = result.data?.[0];
    if (!image?.b64_json) throw new Error("Le générateur d’images n’a retourné aucun fichier");
    return Buffer.from(image.b64_json, "base64");
  }
}
