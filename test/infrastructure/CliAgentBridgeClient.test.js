import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { CliAgentBridgeClient } from "../../src/infrastructure/ia/CliAgentBridgeClient.js";

const sockets = [];

afterEach(async () => {
  await Promise.all(
    sockets.splice(0).map(
      ({ server, directory }) =>
        new Promise((resolve) => server.close(() => {
          fs.rmSync(directory, { recursive: true, force: true });
          resolve();
        }))
    )
  );
});

describe("CliAgentBridgeClient", () => {
  it("encodes requests and decodes a fragmented length-prefixed response", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devdoc-bridge-test-"));
    const socketPath = path.join(directory, "bridge.sock");
    let received;
    let responded = false;
    const server = net.createServer((socket) => {
      const chunks = [];
      socket.on("data", (chunk) => chunks.push(chunk));
      socket.on("data", () => {
        const frame = Buffer.concat(chunks);
        if (frame.length < 4) return;
        const length = frame.readUInt32BE(0);
        if (frame.length < length + 4 || responded) return;
        responded = true;
        received = JSON.parse(frame.subarray(4, length + 4).toString("utf8"));
        const body = Buffer.from(
          JSON.stringify({ ok: true, requestId: received.requestId, data: { result: "ok" } })
        );
        const header = Buffer.alloc(4);
        header.writeUInt32BE(body.length);
        socket.write(header.subarray(0, 2));
        socket.write(Buffer.concat([header.subarray(2), body.subarray(0, 3)]));
        socket.end(body.subarray(3));
      });
    });
    await new Promise((resolve) => server.listen(socketPath, resolve));
    sockets.push({ server, directory });
    const client = new CliAgentBridgeClient({
      socketPath,
      project: "devdoc",
      token: "project-token",
      timeoutMs: 1000
    });

    const response = await client.completeJson({
      agent: "course_creator",
      payload: { title: "Course" }
    });

    expect(received).toMatchObject({
      version: 1,
      project: "devdoc",
      token: "project-token",
      operation: "complete_json",
      agent: "course_creator",
      payload: { title: "Course" },
      attachments: []
    });
    expect(response.data).toEqual({ result: "ok" });
  });

  it("rejects a response for another request", async () => {
    const client = new CliAgentBridgeClient({
      socketPath: "/unused",
      project: "devdoc",
      token: "project-token"
    });
    client.sendFrame = async () => ({ ok: true, requestId: "another-request" });

    await expect(client.health()).rejects.toThrow("requestId mismatch");
  });
});
