# LinkedIn Scraper Extension

Extension Chrome pour scraper automatiquement vos posts LinkedIn et les sauvegarder dans une base de données Supabase.

## Fonctionnalités

- ✅ Scraping automatique des posts LinkedIn lors de la navigation
- ✅ Sauvegarde des données : texte, date, URL, likes, commentaires, impressions
- ✅ Authentification via Supabase Auth
- ✅ Rescraping automatique tous les 7 jours pour les posts < 45 jours
- ✅ API pour tracker les événements (clics, RDV)
- 🚧 Intégration Meilisearch pour la recherche
- 🚧 Dashboard Next.js

## Stack Technique

- **Extension**: Plasmo Framework + TypeScript
- **Base de données**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth
- **API**: Supabase Edge Functions
- **Cron**: Supabase Cron Jobs
- **Recherche**: Meilisearch (à venir)
- **Dashboard**: Next.js (à venir)

## Installation

### 1. Configuration Supabase

1. Créez un projet sur [Supabase](https://supabase.com)
2. Copiez vos clés API dans `.env.local`:
   ```
   PLASMO_PUBLIC_SUPABASE_URL=votre-url-supabase
   PLASMO_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
   ```
3. Exécutez les migrations :
   ```bash
   npx supabase db push
   ```
4. Déployez les Edge Functions :
   ```bash
   npx supabase functions deploy rescrape-posts
   npx supabase functions deploy track-event
   ```

### 2. Installation de l'extension

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Lancez le mode développement :
   ```bash
   npm run dev
   ```

3. Chargez l'extension dans Chrome :
   - Allez dans `chrome://extensions/`
   - Activez le "Mode développeur"
   - Cliquez sur "Charger l'extension non empaquetée"
   - Sélectionnez le dossier `build/chrome-mv3-dev`

## Utilisation

1. Cliquez sur l'icône de l'extension et connectez-vous avec votre compte
2. Naviguez sur LinkedIn - vos posts seront automatiquement scrapés
3. Les données sont synchronisées en temps réel avec Supabase

## Structure de la base de données

### Table `posts`
- `id`: UUID (PK)
- `user_id`: UUID (FK vers auth.users)
- `text`: Contenu du post
- `post_url`: URL unique du post
- `posted_at`: Date de publication
- `likes`: Nombre de likes
- `comments`: Nombre de commentaires
- `impressions`: Nombre d'impressions
- `last_scraped_at`: Dernière date de scraping

### Table `events`
- `id`: UUID (PK)
- `post_id`: UUID (FK vers posts)
- `type`: Type d'événement (click/rdv)
- `metadata`: Données additionnelles (JSONB)
- `created_at`: Date de l'événement

## API Endpoints

### Track Event
```bash
POST /functions/v1/track-event
Authorization: Bearer <user-token>
{
  "post_id": "uuid",
  "type": "click" | "rdv",
  "metadata": {}
}
```

### Rescrape Posts (Cron)
```bash
POST /functions/v1/rescrape-posts
Authorization: Bearer <service-role-key>
```

## Développement

```bash
# Mode dev
npm run dev

# Build pour production
npm run build

# Package pour distribution
npm run package
```

## Roadmap

- [ ] Améliorer la détection des impressions (nécessite ouverture du détail)
- [ ] Intégrer Meilisearch pour la recherche full-text
- [ ] Créer le dashboard Next.js
- [ ] Ajouter des graphiques d'analytics
- [ ] Export des données (CSV, PDF)
- [ ] Notifications pour les posts performants