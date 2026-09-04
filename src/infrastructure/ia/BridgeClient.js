import net from "node:net";
import crypto from "node:crypto";

const HEADER_SIZE = 4;

export class BridgeClient {
  constructor({ socketPath, project, token, timeoutMs } = {}) {
    this.socketPath = socketPath;
    this.project = project;
    this.token = token;
    this.timeoutMs = timeoutMs || 310000;
  }

  async completeJson(agent, payload, attachments = []) {
    const response = await this.send({
      version: 1,
      operation: "complete_json",
      project: this.project,
      token: this.token,
      agent,
      requestId: crypto.randomUUID(),
      payload,
      attachments
    });

    if (response.ok === false) {
      const code = response.error?.code || "BRIDGE_ERROR";
      const message = response.error?.message || "Erreur inconnue du bridge";
      throw new Error(`Bridge ${agent} a echoue [${code}]: ${message}`);
    }

    return response.data;
  }

  send(message) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ path: this.socketPath });
      let buffer = Buffer.alloc(0);
      let expected = null;
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      const succeed = (value) => {
        if (settled) return;
        settled = true;
        socket.end();
        resolve(value);
      };

      socket.setTimeout(this.timeoutMs);
      socket.on("timeout", () => {
        fail(new Error(`Delai depasse (${this.timeoutMs} ms) sur ${this.socketPath}`));
      });
      socket.on("error", (error) => {
        fail(new Error(`Connexion au bridge impossible (${this.socketPath}): ${error.message}`));
      });

      socket.on("connect", () => {
        const body = Buffer.from(JSON.stringify(message), "utf8");
        const header = Buffer.alloc(HEADER_SIZE);
        header.writeUInt32BE(body.length, 0);
        socket.write(Buffer.concat([header, body]));
      });

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        if (expected === null) {
          if (buffer.length < HEADER_SIZE) return;
          expected = buffer.readUInt32BE(0);
          buffer = buffer.subarray(HEADER_SIZE);
        }

        if (buffer.length < expected) return;

        try {
          succeed(JSON.parse(buffer.subarray(0, expected).toString("utf8")));
        } catch (error) {
          fail(new Error(`Reponse du bridge illisible: ${error.message}`));
        }
      });

      socket.on("end", () => {
        fail(new Error("Le bridge a ferme la connexion sans reponse complete"));
      });
    });
  }
}
