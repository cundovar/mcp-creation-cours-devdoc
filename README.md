# Agents de Gestion de Cours - Le Pôle S

Système de gestion de cours par agents IA utilisant DeepSeek pour automatiser la création et la révision de cours HTML.

## Architecture
Le projet repose sur une architecture hexagonale avec Node.js. La persistence peut passer soit par MySQL legacy, soit par l'API Symfony via `REPOSITORY_DRIVER`.

## Installation rapide

```bash
npm install
```

```bash
cp .env.example .env
# Puis éditez .env pour ajouter votre clé API DeepSeek
# et la configuration Symfony API si vous utilisez REPOSITORY_DRIVER=symfony
```

```bash
npm run http
```

## Utilisation avec Vue.js

```js
const response = await fetch("http://localhost:3000/api/cours/creer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    titre: "Introduction à Node.js",
    technologie: "Node.js",
    niveau: "Débutant",
    duree: "2h",
    description: "Découvrir les bases de Node.js"
  })
});

const data = await response.json();
console.log("ID du cours créé:", data?.data?.id);
```

## Documentation
Consultez le dossier `docs` pour la documentation complète des endpoints API.
