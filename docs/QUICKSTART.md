# Guide de démarrage rapide - 10 minutes

Ce guide permet de démarrer le système rapidement pour le tester.

## Prérequis

Vous devez avoir Node.js 18+ installé, un accès à votre base MySQL avec les bons identifiants, et une clé API DeepSeek valide.

## Étape 1 - Installation des dépendances (2 minutes)

Placez-vous dans le dossier du projet et installez les dépendances :

```bash
npm install
```

## Étape 2 - Configuration (2 minutes)

Copiez le fichier d'exemple puis ajoutez votre clé API DeepSeek :

```bash
cp .env.example .env
```

Éditez `.env` et remplacez `votre_cle_api_deepseek`. Les autres valeurs de base de données sont déjà correctes.

## Étape 3 - Migration de la base de données (1 minute)

Exécutez la migration SQL :

```bash
mysql -h egflbugcundo.mysql.db -u egflbugcundo -p egflbugcundo < migrations/001_add_revision_table.sql
```

Cette étape crée la table `revision` et ajoute les colonnes nécessaires sans modifier vos données existantes.

## Étape 4 - Test de la configuration (1 minute)

```bash
npm run test-config
```

Si le test échoue, vérifiez vos identifiants MySQL et la clé API DeepSeek.

## Étape 5 - Premier test avec la CLI (2 minutes)

```bash
npm run cli technologies
```

Puis créez un cours en mode interactif :

```bash
npm run cli creer -- --interactif
```

## Étape 6 - Démarrer le serveur HTTP (1 minute)

```bash
npm run http
```

Le serveur démarre sur `http://localhost:3000` et reste actif en attente de requêtes.

## Étape 7 - Tester l'API (1 minute)

```bash
curl http://localhost:3000/health
```

```bash
curl -X POST http://localhost:3000/api/cours/creer \
  -H "Content-Type: application/json" \
  -d '{
    "titre": "Introduction à Node.js",
    "technologie": "Node.js",
    "niveau": "Débutant",
    "duree": "2h",
    "description": "Découvrir les bases de Node.js"
  }'
```

## Prochaines étapes

Consultez `docs/API-VUEJS.md` pour l'intégration avec Vue.js, explorez les endpoints disponibles et configurez le serveur comme service systemd en production.

## Dépannage rapide

**Erreur de connexion MySQL :** vérifiez les identifiants et l'accessibilité du serveur MySQL.

**Erreur de clé API DeepSeek :** vérifiez que la clé est valide et active.

**Erreur lors de la migration :** assurez-vous que l'utilisateur MySQL a les droits `CREATE TABLE` et `ALTER TABLE`.
