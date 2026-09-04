import crypto from "crypto";
import net from "net";

const HEADER_SIZE = 4;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;

export class CliAgentBridgeClient {
  constructor({ socketPath, project, token, timeoutMs = 310000 }) {
    this.socketPath = socketPath;
    this.project = project;
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  async health() {
    return this.request({ operation: "health" });
  }

  async completeJson({ agent, payload = {}, attachments = [] }) {
    return this.request({ operation: "complete_json", agent, payload, attachments });
  }

  async request({ operation, agent, payload = {}, attachments = [] }) {
    const requestId = crypto.randomUUID();
    const message = {
      version: 1,
      requestId,
      project: this.project,
      token: this.token,
      operation,
      agent,
      payload,
      attachments
    };
    const response = await this.sendFrame(message);
    if (!response?.ok) {
      const error = response?.error || {};
      throw new Error(`Bridge ${error.code || "ERROR"}: ${error.message || "unknown error"}`);
    }
    return response;
  }

  sendFrame(message) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ path: this.socketPath });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("Bridge timeout"));
      }, this.timeoutMs);
      const chunks = [];
      let total = 0;

      socket.on("connect", () => {
        const body = Buffer.from(JSON.stringify(message), "utf8");
        const header = Buffer.alloc(HEADER_SIZE);
        header.writeUInt32BE(body.length, 0);
        socket.write(Buffer.concat([header, body]));
      });

      socket.on("data", (chunk) => {
        chunks.push(chunk);
        total += chunk.length;
        if (total > MAX_RESPONSE_BYTES + HEADER_SIZE) {
          socket.destroy();
          reject(new Error("Bridge response too large"));
        }
      });

      socket.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      socket.on("end", () => {
        clearTimeout(timer);
        try {
          resolve(decodeFrame(Buffer.concat(chunks)));
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

function decodeFrame(buffer) {
  if (buffer.length < HEADER_SIZE) throw new Error("Bridge response is truncated");
  const length = buffer.readUInt32BE(0);
  if (length <= 0 || length > MAX_RESPONSE_BYTES) throw new Error("Bridge response length is invalid");
  if (buffer.length < HEADER_SIZE + length) throw new Error("Bridge response body is truncated");
  return JSON.parse(buffer.subarray(HEADER_SIZE, HEADER_SIZE + length).toString("utf8"));
}
