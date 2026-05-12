# Intégration API avec Vue.js

Ce document explique comment votre application Vue.js peut communiquer directement avec l'API Node.js des agents de cours.

## Configuration de base

Assurez-vous que le serveur Node.js est démarré :

```bash
npm run http
```

Par défaut, il écoute sur le port 3000. Dans votre application Vue.js, définissez une URL de base :

```js
const API_BASE_URL = "http://localhost:3000";
```

## Endpoints disponibles

### POST /api/cours/creer
**Description :** crée un cours HTML via l'agent créateur.

**Requête :**

```json
{
  "titre": "Introduction à Node.js",
  "technologie": "Node.js",
  "niveau": "Débutant",
  "duree": "2h",
  "description": "Découvrir les bases de Node.js"
}
```

**Réponse (201) :**

```json
{
  "success": true,
  "message": "Cours créé avec succès",
  "data": {
    "id": 123,
    "titre": "Introduction à Node.js",
    "technologie": "Node.js",
    "niveau": "Débutant",
    "duree": "2h",
    "statut": "brouillon",
    "genereParIA": true
  }
}
```

**Exemple Vue.js (fetch) :**

```js
const response = await fetch(`${API_BASE_URL}/api/cours/creer`, {
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
console.log(data.data.id);
```

### POST /api/cours/reviser
**Description :** crée une révision d'un cours existant.

**Requête :**

```json
{
  "coursId": 123,
  "typeRevision": "amelioration",
  "commentaire": "Ajouter un exemple pratique en section théorie",
  "appliquerDirectement": false
}
```

**Réponse (201) :**

```json
{
  "success": true,
  "message": "Révision créée avec succès",
  "data": {
    "revisionId": 77,
    "typeRevision": "amelioration",
    "commentaire": "Ajouter un exemple pratique en section théorie",
    "appliquee": false
  }
}
```

### GET /api/cours/:id
**Description :** récupère toutes les informations d'un cours.

**Réponse (200) :**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "Introduction à Node.js",
    "description": "Découvrir les bases de Node.js",
    "code": "<main class=\"principal\">...",
    "objectifs": "- ...",
    "exercices": null,
    "duration": "2h",
    "level": { "id": 1, "name": "Débutant" },
    "technology": { "id": 2, "name": "Node.js" },
    "statut": "brouillon",
    "genereParIA": true
  }
}
```

### GET /api/cours
**Description :** liste les cours avec filtres optionnels.

**Query params :** `technologie`, `niveau`, `statut`, `ia`, `aReviser`

**Réponse (200) :**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 123,
      "titre": "Introduction à Node.js",
      "technologie": "Node.js",
      "niveau": "Débutant",
      "duree": "2h",
      "statut": "publie",
      "genereParIA": true
    }
  ]
}
```

### GET /api/cours/:id/revisions
**Description :** liste les révisions d'un cours.

**Réponse (200) :**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 77,
      "courseId": 123,
      "typeRevision": "amelioration",
      "commentaire": "Ajouter un exemple pratique",
      "appliquee": false
    }
  ]
}
```

### POST /api/revisions/:id/appliquer
**Description :** applique une révision à un cours.

**Réponse (200) :**

```json
{
  "success": true,
  "message": "Révision appliquée",
  "data": { "id": 123, "titre": "Introduction à Node.js", "statut": "publie" }
}
```

### GET /api/technologies
**Description :** liste les technologies.

### GET /api/niveaux
**Description :** liste les niveaux.

## Exemple de composant Vue.js

```vue
<script setup>
import { ref, reactive } from "vue";

const API_BASE_URL = "http://localhost:3000";
const loading = ref(false);
const error = ref(null);
const success = ref(null);

const form = reactive({
  titre: "",
  technologie: "",
  niveau: "",
  duree: "",
  description: ""
});

const creerCours = async () => {
  try {
    loading.value = true;
    error.value = null;
    success.value = null;

    const response = await fetch(`${API_BASE_URL}/api/cours/creer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la création du cours");
    }

    const data = await response.json();
    success.value = `Cours créé avec l'ID ${data.data.id}`;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <section>
    <h1>Créer un cours</h1>

    <form @submit.prevent="creerCours">
      <input v-model="form.titre" placeholder="Titre" required />
      <input v-model="form.technologie" placeholder="Technologie" required />
      <input v-model="form.niveau" placeholder="Niveau" required />
      <input v-model="form.duree" placeholder="Durée" required />
      <textarea v-model="form.description" placeholder="Description"></textarea>

      <button type="submit" :disabled="loading">Créer</button>
    </form>

    <p v-if="loading">Génération en cours...</p>
    <p v-if="error" style="color: red;">{{ error }}</p>
    <p v-if="success" style="color: green;">{{ success }}</p>
  </section>
</template>
```

## Gestion des erreurs

- **400** : champs requis manquants ou invalides
- **404** : ressource introuvable
- **500** : erreur interne serveur

Exemple de gestion d'erreur :

```js
try {
  const response = await fetch(`${API_BASE_URL}/api/cours/creer`, { /* ... */ });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Erreur API");
  }
} catch (error) {
  console.error(error.message);
}
```

## Conseils d'intégration

- Utilisez un service centralisé pour les appels API plutôt que des `fetch` dispersés dans les composants.
- En production, configurez `HTTP_CORS_ORIGIN` dans le `.env` du serveur Node.js pour autoriser uniquement le domaine de votre application Vue.js.
- Ajoutez des indicateurs de chargement, la génération de cours peut prendre plusieurs secondes.

## Bloc d'intégration côté app Vue (existant)

Si votre application Vue est déjà liée à Symfony (proxy `/api` côté Vite), **évitez d'utiliser `/api`** pour l'agent Node.js. Utilisez une base URL dédiée pour ne pas passer par le proxy Symfony.

**Service recommandé (axios) :**

```js
// front/src/services/agentsCoursService.js
import axios from 'axios'

const baseURL = import.meta.env.VITE_AGENTS_API_URL || 'http://localhost:3000'

const agentsApi = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

export async function creerCours(payload) {
  const response = await agentsApi.post('/api/cours/creer', payload)
  return response.data?.data ?? response.data
}
```

**Configuration .env (front) :**

```
VITE_AGENTS_API_URL=http://localhost:3000
```

**Page Vue dédiée (exemple) :**
- Créez une page `front/src/views/AgentsCours.vue`
- Ajoutez la route `/agents-cours` dans `front/src/router/index.js`
- Placez le formulaire dans `front/src/components/features/agents/AgentsCoursForm.vue`
