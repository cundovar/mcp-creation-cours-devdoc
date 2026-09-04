import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeClient } from "../../src/infrastructure/ia/BridgeClient.js";
import { BridgeIAService } from "../../src/infrastructure/ia/BridgeIAService.js";

const HEADER_SIZE = 4;

let serveur = null;
let socketPath = null;

function encoder(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

async function demarrerBridgeFactice(repondre) {
  socketPath = path.join(os.tmpdir(), `bridge-test-${crypto.randomUUID()}.sock`);
  const requetes = [];

  serveur = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let attendu = null;

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (attendu === null) {
        if (buffer.length < HEADER_SIZE) return;
        attendu = buffer.readUInt32BE(0);
        buffer = buffer.subarray(HEADER_SIZE);
      }

      if (buffer.length < attendu) return;

      const requete = JSON.parse(buffer.subarray(0, attendu).toString("utf8"));
      requetes.push(requete);
      socket.end(encoder(repondre(requete)));
    });
  });

  await new Promise((resolve) => serveur.listen(socketPath, resolve));

  const client = new BridgeClient({
    socketPath,
    project: "devdoc",
    token: "jeton-test",
    timeoutMs: 5000
  });

  return { service: new BridgeIAService(client), requetes };
}

afterEach(async () => {
  if (serveur) {
    await new Promise((resolve) => serveur.close(resolve));
    serveur = null;
  }
  if (socketPath && fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
    socketPath = null;
  }
});

const specifications = {
  sujet: "Les hooks React",
  technologie: "React",
  niveau: "Intermédiaire",
  duree: "2h"
};

describe("BridgeIAService", () => {
  it("envoie une requête complete_json correctement encadrée et retourne le HTML", async () => {
    const html = `<main class="principal"><section class="introduction">Contenu</section></main>`;
    const { service, requetes } = await demarrerBridgeFactice(() => ({ ok: true, data: { html } }));

    const resultat = await service.genererCours(specifications);

    expect(resultat).toBe(html);
    expect(requetes).toHaveLength(1);
    expect(requetes[0]).toMatchObject({
      version: 1,
      operation: "complete_json",
      project: "devdoc",
      token: "jeton-test",
      agent: "course_creator",
      payload: { sujet: "Les hooks React", technologie: "React" }
    });
    expect(requetes[0].requestId).toEqual(expect.any(String));
  });

  it("refuse un HTML sans balise main class principal", async () => {
    const { service } = await demarrerBridgeFactice(() => ({ ok: true, data: { html: "<div>Contenu</div>" } }));

    await expect(service.genererCours(specifications)).rejects.toThrow(
      /main class principal/
    );
  });

  it("transforme le tableau d'objectifs en chaîne à tirets", async () => {
    const { service } = await demarrerBridgeFactice(() => ({
      ok: true,
      data: { objectives: ["Implémenter useState", "Configurer useEffect"] }
    }));

    const resultat = await service.genererObjectifs(specifications);

    expect(resultat).toBe("- Implémenter useState\n- Configurer useEffect");
  });

  it("mappe alt vers altText et filtre les illustrations incomplètes", async () => {
    const { service, requetes } = await demarrerBridgeFactice(() => ({
      ok: true,
      data: {
        illustrations: [
          { slot: "theorie", prompt: "React hooks lifecycle diagram", alt: "Diagramme", caption: "Cycle de vie", reason: "Clarifie" },
          { slot: "pratique", prompt: "Sans texte alternatif", alt: "", caption: "Ignorée", reason: "Aucune" },
          { slot: "resume", alt: "Sans prompt", caption: "Ignorée", reason: "Aucune" }
        ]
      }
    }));

    const resultat = await service.genererPlanIllustrations(specifications, "<main>contenu</main>");

    expect(resultat).toEqual([
      { prompt: "React hooks lifecycle diagram", altText: "Diagramme", caption: "Cycle de vie" }
    ]);
    expect(requetes[0].agent).toBe("course_illustration_planner");
    expect(requetes[0].payload.content).toBe("<main>contenu</main>");
  });

  it("propage le code d'erreur renvoyé par le bridge", async () => {
    const { service } = await demarrerBridgeFactice(() => ({
      ok: false,
      error: { code: "SCHEMA_VALIDATION_FAILED", message: "champ html manquant" }
    }));

    await expect(service.genererObjectifs(specifications)).rejects.toThrow(
      /SCHEMA_VALIDATION_FAILED/
    );
  });

  it("envoie le HTML et les commentaires au correcteur", async () => {
    const html = `<main class="principal">corrigé</main>`;
    const { service, requetes } = await demarrerBridgeFactice(() => ({ ok: true, data: { html } }));

    const resultat = await service.ameliorerCours("<main class=\"principal\">avant</main>", "Corriger l'exemple", {
      titre: "Les hooks React",
      technologie: "React",
      niveau: "Intermédiaire",
      duree: "2h"
    });

    expect(resultat).toBe(html);
    expect(requetes[0].agent).toBe("course_corrector");
    expect(requetes[0].payload.comments).toBe("Corriger l'exemple");
    expect(requetes[0].payload.context.titre).toBe("Les hooks React");
  });
});
