# Orchestration des cours DevDoc

Le service MCP ne crée jamais un cours lors de la génération. La séquence est :

1. préparer l'arborescence ;
2. enregistrer une génération Symfony avec `batchId` et `externalId` ;
3. générer le candidat et, si utile, ses illustrations ;
4. vérifier le candidat ;
5. corriger uniquement les problèmes signalés, au maximum trois fois ;
6. finaliser le cours visible si le dernier rapport est accepté, sinon conserver l'échec sans cours.

## Variables nécessaires

```dotenv
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_VERIFIER_MODEL=gpt-5-mini
ORCHESTRATION_API_TOKEN=
SYMFONY_API_URL=http://localhost:8000
SYMFONY_API_KEY=
```

L'interface HTTP ne laisse passer que `/health` sans jeton. Tous les autres appels
doivent contenir `Authorization: Bearer <ORCHESTRATION_API_TOKEN>`.

Les images sont obtenues depuis OpenAI, décodées par le service MCP puis envoyées
à Symfony. Symfony est la seule source d'URL de média conservée dans le HTML.
