import crypto from "node:crypto";
import fs from "node:fs";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function secret() {
  return crypto.randomBytes(32).toString("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(":");
  if (!salt || !expected) return false;
  return safeEqual(
    crypto.scryptSync(password, salt, 64).toString("hex"),
    expected
  );
}

export class DevDocOAuthProvider {
  constructor({ stateFile, passwordHash, issuer, resource }) {
    this.stateFile = stateFile;
    this.passwordHash = passwordHash;
    this.issuer = issuer;
    this.resource = resource;
    this.pending = new Map();
    this.state = {
      clients: {},
      codes: {},
      tokens: {},
      refreshTokens: {}
    };

    try {
      this.state = {
        ...this.state,
        ...JSON.parse(fs.readFileSync(stateFile, "utf8"))
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    this.clientsStore = {
      getClient: async (clientId) => this.state.clients[clientId],
      registerClient: async (client) => {
        this.state.clients[client.client_id] = client;
        this.save();
        return client;
      }
    };
  }

  save() {
    const temporary = `${this.stateFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.state, null, 2), {
      mode: 0o600
    });
    fs.renameSync(temporary, this.stateFile);
  }

  async authorize(client, params, res) {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new Error("redirect_uri invalide");
    }
    if (params.resource && params.resource.href !== this.resource.href) {
      throw new Error("resource invalide");
    }

    const requestId = secret();
    this.pending.set(requestId, {
      client,
      params,
      createdAt: Date.now()
    });
    res.redirect(302, `/login?request=${encodeURIComponent(requestId)}`);
  }

  loginPage(req, res) {
    const requestId = String(req.query.request || "");
    const pending = this.pending.get(requestId);
    if (!pending || Date.now() - pending.createdAt > 10 * 60_000) {
      res
        .status(400)
        .send("Demande expirée. Relancez la connexion depuis votre assistant.");
      return;
    }

    const escapedRequestId = escapeHtml(requestId);

    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(`<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Autoriser DevDoc</title>
<style>
body{font:16px system-ui;background:#111827;color:#f9fafb;display:grid;place-items:center;min-height:100vh;margin:0}
.card{width:min(440px,90vw);background:#1f2937;padding:28px;border-radius:16px}
input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:12px;border-radius:8px;border:1px solid #4b5563}
button{background:#10b981;color:#06281e;font-weight:700;cursor:pointer}
.muted{color:#9ca3af;font-size:14px}
</style>
<div class="card">
<h1>Connecter DevDoc</h1>
<p>Votre assistant demande l’accès à la création et à la publication de cours DevDoc.</p>
<p class="muted">La création produit un brouillon vérifié. Une confirmation distincte reste obligatoire avant publication.</p>
<form method="post" action="/login">
<input type="hidden" name="request" value="${escapedRequestId}">
<label>Mot de passe MCP
<input name="password" type="password" required autofocus autocomplete="current-password">
</label>
<button type="submit">Autoriser la connexion</button>
</form>
</div>
</html>`);
  }

  approve(req, res) {
    const requestId = String(req.body.request || "");
    const pending = this.pending.get(requestId);
    if (!pending || Date.now() - pending.createdAt > 10 * 60_000) {
      res.status(400).send("Demande expirée.");
      return;
    }
    if (!verifyPassword(String(req.body.password || ""), this.passwordHash)) {
      res.status(401).send("Mot de passe incorrect.");
      return;
    }

    this.pending.delete(requestId);
    const code = secret();
    this.state.codes[code] = {
      ...pending.params,
      clientId: pending.client.client_id,
      expiresAt: Date.now() + 5 * 60_000
    };
    this.save();

    const target = new URL(pending.params.redirectUri);
    target.searchParams.set("code", code);
    if (pending.params.state) target.searchParams.set("state", pending.params.state);
    target.searchParams.set("iss", this.issuer.href);

    const escapedTarget = escapeHtml(target.href);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).type("html").send(`<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta http-equiv="refresh" content="1;url=${escapedTarget}">
<title>Autorisation DevDoc acceptée</title>
<style>
body{font:16px system-ui;background:#111827;color:#f9fafb;display:grid;place-items:center;min-height:100vh;margin:0}
.card{width:min(440px,90vw);background:#1f2937;padding:28px;border-radius:16px}
a{box-sizing:border-box;display:block;width:100%;padding:12px;margin-top:18px;border-radius:8px;background:#10b981;color:#06281e;font-weight:700;text-align:center;text-decoration:none}
.muted{color:#9ca3af;font-size:14px}
</style>
<div class="card">
<h1>Autorisation acceptée</h1>
<p>Retour automatique vers votre assistant…</p>
<p class="muted">Si la page reste affichée, utilisez le bouton ci-dessous.</p>
<a href="${escapedTarget}">Retourner à ChatGPT ou Claude</a>
</div>
</html>`);

  }

  async challengeForAuthorizationCode(_client, code) {
    const item = this.state.codes[code];
    if (!item || item.expiresAt < Date.now()) {
      throw new Error("Code invalide ou expiré");
    }
    return item.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client,
    code,
    _verifier,
    redirectUri,
    resource
  ) {
    const item = this.state.codes[code];
    if (
      !item ||
      item.expiresAt < Date.now() ||
      item.clientId !== client.client_id
    ) {
      throw new Error("Code invalide");
    }
    if (redirectUri && redirectUri !== item.redirectUri) {
      throw new Error("redirect_uri invalide");
    }
    if (resource && resource.href !== this.resource.href) {
      throw new Error("resource invalide");
    }

    delete this.state.codes[code];
    return this.issueTokens(client.client_id, item.scopes || []);
  }

  issueTokens(clientId, scopes) {
    const access = secret();
    const refresh = secret();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    this.state.tokens[access] = {
      clientId,
      scopes,
      expiresAt,
      resource: this.resource.href
    };
    this.state.refreshTokens[refresh] = {
      clientId,
      scopes,
      resource: this.resource.href
    };
    this.save();

    return {
      access_token: access,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: refresh,
      scope: scopes.join(" ")
    };
  }

  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const item = this.state.refreshTokens[refreshToken];
    if (!item || item.clientId !== client.client_id) {
      throw new Error("Refresh token invalide");
    }
    if (resource && resource.href !== this.resource.href) {
      throw new Error("resource invalide");
    }

    delete this.state.refreshTokens[refreshToken];
    return this.issueTokens(client.client_id, scopes || item.scopes);
  }

  async verifyAccessToken(token) {
    const item = this.state.tokens[token];
    if (!item || item.expiresAt < Math.floor(Date.now() / 1000)) {
      throw new Error("Token invalide ou expiré");
    }
    return {
      token,
      clientId: item.clientId,
      scopes: item.scopes,
      expiresAt: item.expiresAt,
      resource: new URL(item.resource)
    };
  }

  async revokeToken(_client, request) {
    delete this.state.tokens[request.token];
    delete this.state.refreshTokens[request.token];
    this.save();
  }
}
