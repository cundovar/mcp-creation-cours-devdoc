# Agents de gestion de cours DevDoc

Service Node.js qui génère, vérifie, corrige et publie des cours HTML dans
DevDoc. La persistance passe soit par MySQL legacy, soit par l’API Symfony via
`REPOSITORY_DRIVER`.

## Installation rapide

```bash
npm install
cp .env.example .env
npm run http
```

## Connecteur MCP distant

Le serveur HTTP expose `/mcp` avec le transport MCP Streamable HTTP et une
authentification OAuth. La même URL peut être utilisée comme connecteur privé
dans Claude et ChatGPT.

Outils conversationnels exposés :

- `creer_brouillon_cours` : génère, vérifie et corrige un brouillon sans le publier ;
- `voir_brouillon_cours` : retourne son état et son rapport ;
- `publier_cours_devdoc` : publie uniquement après confirmation explicite ;
- `lister_cours_devdoc` : liste les cours récents ;
- `lister_catalogue_devdoc` : liste technologies, niveaux et menus.

La création est idempotente grâce au champ `requestId`. Un même identifiant
réutilise la génération existante.

Variables requises pour activer le connecteur :

```dotenv
MCP_PUBLIC_URL=https://mcp-devdoc.example.com
MCP_PASSWORD_HASH=sel:hash_scrypt
MCP_OAUTH_DATA_DIR=/app/data/oauth
```

Le dossier `MCP_OAUTH_DATA_DIR` doit être persistant en production afin de
conserver les clients et jetons OAuth après un redéploiement.

## API HTTP d’orchestration

Les routes `/api/*` restent disponibles pour n8n et exigent :

```http
Authorization: Bearer <ORCHESTRATION_API_TOKEN>
```

Exemple de génération d’un candidat non publié :

```js
const response = await fetch("http://localhost:3000/api/cours/creer", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    titre: "Introduction à Node.js",
    technologie: "Node.js",
    niveau: "Débutant",
    duree: "2h",
    description: "Découvrir les bases de Node.js"
  })
});
```

## Vérification

```bash
npm test
```

Consultez `docs/ORCHESTRATION.md` pour la séquence complète.
