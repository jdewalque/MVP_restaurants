# Passaparola

Passaparola met en relation des restaurants de quartier milanais et des micro-créateurs locaux, qui viennent manger et publient un Reel Instagram.

Ce dépôt est un monorepo (espaces de travail npm) :

```
apps/landing/      Landing page statique (HTML/CSS/JS, IT + EN), sans étape de build
apps/dashboard/    Prototype du dashboard restaurateur (Next.js 16, App Router, TypeScript, Prisma + SQLite)
packages/shared/   Code commun : types, configuration, client API Meta, calcul des indicateurs, charte graphique
```

Le dashboard sert surtout à **valider l'intégration avec l'API Instagram de Meta** : récupérer les statistiques des Reels des créateurs, les stocker jour par jour et les afficher.

---

## 1. Installation

Prérequis : Node.js ≥ 22.12 et npm ≥ 10.

```sh
npm install                                    # installe tout le monorepo et génère le client Prisma
cp apps/dashboard/.env.example apps/dashboard/.env
# remplir apps/dashboard/.env (voir section 3)
npm run db:migrate                             # crée la base SQLite apps/dashboard/prisma/dev.db
npm run seed                                   # données de démonstration (facultatif)
npm run dev                                    # http://localhost:3000
```

Pour l'admin, renseigner au minimum `ADMIN_PASSWORD` et `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`) ; les pages `/dashboard` fonctionnent sans.

En cas d'erreur `Cannot find package '@/generated'` : le client Prisma n'a pas été généré. Lancer `npm run db:generate -w @passaparola/dashboard` (les commandes `dev`, `build`, `db:migrate` et `seed` le font déjà automatiquement).

Toutes les commandes se lancent depuis la racine :

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Dashboard en développement sur le port 3000 |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run dev:landing` | Landing page sur http://localhost:8000 |
| `npm run db:migrate` | Applique les migrations Prisma |
| `npm run seed` | (Re)crée les données de démo, sans toucher aux vraies données |
| `npm run sync` | Synchronise les statistiques de tous les créateurs connectés |
| `npm test` | Tests unitaires (Vitest) |
| `npm run typecheck` | Vérification TypeScript |

## 2. Pages

| URL | Contenu |
| --- | --- |
| `/dashboard` | Liste des restaurants (indicateurs des 30 derniers jours) |
| `/dashboard/[slug]` | Page d'un restaurant : indicateurs, graphique, tableau des Reels, récapitulatif par créateur |
| `/admin` | Vue d'ensemble, bouton de synchronisation, historique des synchros. Protégé par `ADMIN_PASSWORD` |
| `/admin/restaurants` | Création et modification des restaurants (prix mensuel, pseudo Instagram, date d'abonnement) |
| `/admin/creators` | Connexion des créateurs : token manuel (mode A) ou Facebook Login (mode B), expiration des tokens |
| `/admin/reels` | Association Reel ↔ restaurant, avec suggestions tirées de la légende |
| `/admin/debug` | Réponses JSON brutes de Meta pour un créateur et un Reel |
| `POST /api/sync` | Synchronisation (cookie admin ou `Authorization: Bearer $SYNC_SECRET`) |
| `/api/auth/meta/login`, `/api/auth/meta/callback` | Connexion OAuth (mode B) |

Toutes les routes sont sous `/dashboard`, `/admin` ou `/api` pour ne pas entrer en conflit avec la landing page lors de la fusion.

## 3. Variables d'environnement (`apps/dashboard/.env`)

| Variable | Description |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET` | developers.facebook.com → l'appli « passaparola » → Paramètres de l'appli → Général |
| `META_GRAPH_VERSION` | Version de l'API Graph, `v26.0` par défaut |
| `META_REDIRECT_URI` | URI de retour OAuth, par ex. `http://localhost:3000/api/auth/meta/callback` |
| `META_LOGIN_CONFIG_ID` | Facultatif : identifiant de configuration Facebook Login for Business (remplace la liste des permissions) |
| `DATABASE_URL` | `file:./prisma/dev.db` (chemin relatif à `apps/dashboard`) |
| `TOKEN_ENCRYPTION_KEY` | 32 octets pour chiffrer les tokens : `openssl rand -base64 32` |
| `ADMIN_PASSWORD` | Mot de passe des pages `/admin` |
| `SYNC_SECRET` | Facultatif : permet à une tâche programmée d'appeler `POST /api/sync` |
| `META_GRAPH_BASE_URL` | Tests uniquement : remplace `https://graph.facebook.com` par un faux serveur. Laisser vide |

`.env` et la base SQLite sont ignorés par git. Si vous changez `TOKEN_ENCRYPTION_KEY`, les tokens enregistrés deviennent illisibles : reconnectez les créateurs.

## 4. Configurer l'appli Meta

L'appli « passaparola » (type Entreprise, mode développement) utilise le cas d'utilisation « Gérer les messages et les contenus sur Instagram », **API Instagram avec Facebook Login** (hôte `graph.facebook.com`).

1. **Permissions** : `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`. En mode développement, elles fonctionnent sans App Review pour les personnes qui ont un rôle sur l'appli.
2. **Testeurs** : Rôles de l'appli → Rôles → ajouter chaque créateur de test comme *Testeur* (ou Développeur). La personne doit accepter l'invitation sur developers.facebook.com/requests. Son compte Instagram doit être **professionnel** (Créateur ou Entreprise) et **lié à une Page Facebook** dont elle est administratrice.
3. **URI de redirection OAuth valides** (Facebook Login → Paramètres) : ajouter exactement la valeur de `META_REDIRECT_URI`, par ex. `http://localhost:3000/api/auth/meta/callback`.
4. **Si Meta exige HTTPS** (message « URL bloquée » ou « Insecure login blocked ») : exposer le dashboard par un tunnel HTTPS.
   ```sh
   cloudflared tunnel --url http://localhost:3000     # ou : ngrok http 3000
   ```
   Puis mettre `META_REDIRECT_URI=https://<sous-domaine-du-tunnel>/api/auth/meta/callback`, ajouter cette URI dans l'appli Meta (et le domaine dans « Domaines de l'appli »), redémarrer `npm run dev` et **ouvrir le dashboard par l'URL du tunnel** : le cookie anti-CSRF (`state`) est lié au domaine utilisé pour lancer la connexion.

## 5. Tester avec un token de l'Explorateur de l'API Graph (mode A)

1. Remplir `.env`, lancer `npm run db:migrate` puis `npm run dev`.
2. Ouvrir https://developers.facebook.com/tools/explorer/ :
   - Application Meta : **passaparola** ;
   - Utilisateur ou Page : **Token utilisateur** ;
   - ajouter les 5 permissions ci-dessus, puis **Generate Access Token** et accepter ;
   - vérifier avec `me/accounts?fields=name,instagram_business_account` que la Page et le compte Instagram apparaissent.
3. Aller sur http://localhost:3000/admin/creators (mot de passe : `ADMIN_PASSWORD`), coller le token dans « Paste a Graph API Explorer token » et cliquer sur **Connect**.
   L'app échange le token contre un token longue durée (≈ 60 jours), lit son expiration et ses permissions (`debug_token`), récupère les comptes Instagram liés et les enregistre comme créateurs (token chiffré).
4. Cliquer sur **Sync** sur la ligne du créateur (ou `npm run sync`).
5. Ouvrir **API debug** pour voir les réponses brutes de chaque appel (`debug_token`, `me/accounts`, profil, médias, statistiques groupées puis métrique par métrique).
6. Créer un restaurant dans **Restaurants**, associer les Reels dans **Reels ↔ restaurants**, puis ouvrir `/dashboard`.

Mode B : le bouton **Connect my Instagram** de la même page ouvre Facebook Login avec les mêmes permissions ; la route de callback échange le `code`, puis le token, et enregistre les comptes de la même façon.

Un avertissement apparaît dans l'admin quand un token expire dans moins de 10 jours (ou a expiré). Il suffit de reconnecter le compte.

## 6. Synchronisation

Pour chaque créateur qui a un token :

1. mise à jour du pseudo et du nombre d'abonnés ;
2. liste de tous ses médias (pagination suivie), filtrés sur `media_product_type === "REELS"` ;
3. statistiques de chaque Reel : `views, reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time, ig_reels_video_view_total_time` ;
4. enregistrement d'un **instantané par Reel et par jour (UTC)**. Une deuxième synchro le même jour met à jour l'instantané du jour ; les jours précédents ne sont jamais modifiés.

Les statistiques sont demandées en un seul appel. Si Meta le refuse (souvent à cause d'une métrique non prise en charge), l'app redemande métrique par métrique. Une métrique absente est stockée en `null` et affichée « n/a », jamais 0. La réponse brute de Meta est gardée dans l'instantané (`rawJson`, tokens masqués).

Erreurs : token expiré ou permission manquante → le créateur est marqué en erreur et la synchro passe au suivant ; limite d'usage atteinte → la synchro s'arrête. Les en-têtes `X-App-Usage` et `X-Business-Use-Case-Usage` sont journalisés à chaque appel, et le maximum atteint est visible dans l'historique des synchros.

Tâche programmée (exemples) :

```sh
# crontab : tous les jours à 6 h 07
7 6 * * * cd /chemin/vers/MVP_restaurants && npm run sync >> sync.log 2>&1

# ou depuis l'hébergeur
curl -X POST -H "Authorization: Bearer $SYNC_SECRET" https://<domaine>/api/sync
```

## 7. Indicateurs du dashboard

Une période compte les **Reels publiés pendant la période**, avec leurs **dernières statistiques connues** (cumulées depuis la publication).

- **Interactions** = likes + commentaires + partages + enregistrements.
- **Taux d'engagement** = interactions / portée, calculé sur les Reels dont ces cinq valeurs sont connues (le nombre de Reels utilisés est indiqué).
- **Coût pour 1 000 vues** = coût de la période / vues totales × 1 000, où le coût de la période = prix mensuel × jours d'abonnement dans la période / 30.
- Le **graphique** additionne, jour par jour, le dernier instantané connu de chaque Reel : il faut au moins deux jours de synchro pour voir une courbe.

## 8. Modèle de données (`apps/dashboard/prisma/schema.prisma`)

- `Restaurant` : nom, slug, quartier, prix mensuel (centimes), pseudo Instagram, date de début d'abonnement.
- `Creator` : identifiant et pseudo Instagram, abonnés, Page liée, mode de connexion (`manual`, `oauth`, `demo`), token chiffré (AES-256-GCM), expiration du token et de l'accès aux données, permissions, dernière synchro et dernière erreur.
- `Reel` : identifiant du média, créateur, restaurant (facultatif), lien, miniature, légende, date de publication.
- `ReelMetricSnapshot` : un par Reel et par jour, 9 métriques facultatives, mode d'obtention, réponse brute.
- `SyncRun` : historique des synchronisations.

Pour passer à PostgreSQL / Supabase : `provider = "postgresql"` dans le schéma, `@prisma/adapter-pg` dans `src/lib/db.ts`, nouvelle migration.

## 9. Sécurité

- Tous les appels à Meta se font côté serveur. Le secret de l'appli et les tokens ne sont jamais envoyés au navigateur, et la page de debug masque les tokens dans les réponses.
- Les tokens sont chiffrés en base et n'apparaissent jamais en entier dans les journaux (`EAAGtk…9FzD (212 chars)`).
- `/admin`, `/api/sync` et `/api/auth/meta/*` sont protégés par `ADMIN_PASSWORD` (cookie signé, `src/proxy.ts`). `/dashboard` n'a pas encore d'authentification : l'emplacement prévu est `src/lib/restaurant-access.ts`.

## 10. Tests

`npm test` lance les tests unitaires (Vitest) :

- `packages/shared/src/meta/parse.test.ts` : lecture des réponses Meta (statistiques, médias, comptes, tokens) ;
- `packages/shared/src/meta/client.test.ts` : pagination, repli métrique par métrique, classement des erreurs, en-têtes d'usage, absence de token dans les journaux ;
- `packages/shared/src/metrics.test.ts` : indicateurs, prorata du prix, récapitulatif par créateur, série journalière ;
- `packages/shared/src/matching.test.ts` : suggestion de restaurant et chiffrement des tokens ;
- `apps/dashboard/src/lib/period.test.ts` : périodes du dashboard.

## 11. Intégration future avec la landing page

- Les couleurs et polices viennent de `packages/shared/src/theme.css`, copiées de `apps/landing/styles.css` : le dashboard a déjà la charte de la landing.
- Les types, la configuration et le client Meta sont dans `packages/shared`, importables par n'importe quelle app du monorepo.
- Pour fusionner : convertir la landing en pages Next.js dans `apps/dashboard` (ou une app commune), qui importent `theme.css` ; les routes du dashboard (`/dashboard`, `/admin`, `/api`) ne chevauchent pas celles de la landing.
- Le passage à la connexion unifiée de Meta (Facebook Login for Business) touche `packages/shared/src/meta/login.ts` et la route `/api/auth/meta/login` ; `META_LOGIN_CONFIG_ID` est déjà pris en charge.
