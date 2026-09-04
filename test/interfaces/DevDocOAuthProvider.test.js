import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DevDocOAuthProvider } from "../../src/interfaces/mcp/DevDocOAuthProvider.js";

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("DevDocOAuthProvider", () => {
  it("retourne l’issuer dans le callback OAuth ChatGPT", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devdoc-oauth-"));
    temporaryDirectories.push(directory);
    const issuer = new URL("https://mcp-devdoc.example.com/");
    const salt = "test-salt";
    const passwordHash = `${salt}:${crypto
      .scryptSync("secret", salt, 64)
      .toString("hex")}`;
    const provider = new DevDocOAuthProvider({
      stateFile: path.join(directory, "state.json"),
      passwordHash,
      issuer,
      resource: new URL("/mcp", issuer)
    });
    const client = {
      client_id: "chatgpt-client",
      redirect_uris: ["https://chatgpt.com/connector/oauth/test"]
    };
    let loginLocation;
    await provider.authorize(
      client,
      {
        redirectUri: client.redirect_uris[0],
        state: "oauth-state",
        scopes: ["mcp:devdoc"]
      },
      {
        redirect: (_status, location) => {
          loginLocation = location;
        }
      }
    );

    const requestId = new URL(loginLocation, issuer).searchParams.get("request");
    let confirmationPage;
    const response = {
      setHeader: () => response,
      status: () => response,
      type: () => response,
      send: (body) => {
        confirmationPage = body;
        return response;
      }
    };
    provider.approve(
      { body: { request: requestId, password: "secret" } },
      response
    );

    expect(confirmationPage).toContain("Autorisation acceptée");
    expect(confirmationPage).toContain("Retourner à ChatGPT ou Claude");
    const encodedLocation = confirmationPage.match(/<a href="([^"]+)"/)[1];
    const callback = new URL(encodedLocation.replaceAll("&amp;", "&"));
    expect(callback.searchParams.get("code")).toBeTruthy();
    expect(callback.searchParams.get("state")).toBe("oauth-state");
    expect(callback.searchParams.get("iss")).toBe(issuer.href);
  });
});
