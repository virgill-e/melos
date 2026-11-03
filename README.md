# Melos

Blind test de salon sur ta propre musique Spotify. Un appareil (ordinateur branché à la TV ou aux enceintes) diffuse la musique, les téléphones des joueurs servent de buzzers via un QR code sur le Wi-Fi local.

> **Projet personnel, usage strictement privé.** Melos n'est ni affilié à Spotify, ni approuvé ou sponsorisé par Spotify. Spotify est une marque de Spotify AB.
>
> La [Developer Policy de Spotify](https://developer.spotify.com/policy/) interdit les applications de type jeu ou quiz utilisant la plateforme Spotify. Ce projet n'est donc **pas conforme** à cette politique : il est destiné à un usage privé entre proches, sans diffusion publique, sans usage commercial, et chacun l'utilise sous sa propre responsabilité avec sa propre app développeur.

## État d'avancement

- [x] Connexion Spotify (OAuth côté serveur, refresh automatique, déconnexion)
- [x] Liste des playlists de l'utilisateur connecté
- [x] Paramétrage de la partie (nombre de manches, durée d'extrait)
- [x] Lecture via le Web Playback SDK, extrait aléatoire entre 20 % et 70 % du morceau
- [x] Partie solo sur l'écran principal : réponse tolérante, 1 point artiste + 1 point titre, révélation
- [x] Écran de résultats
- [x] Téléphones des joueurs (QR code, WebSocket local) : modes « buzz puis saisie » et « maître du jeu »

## Prérequis

- Node.js 22.22+ et [pnpm](https://pnpm.io)
- Un compte **Spotify Premium** pour l'appareil qui diffuse (obligatoire pour le Web Playback SDK et pour posséder une app en mode développement)
- Pour l'écran qui diffuse : Chrome ou Edge sur ordinateur (Firefox avec la lecture DRM activée). Le Web Playback SDK exige Widevine : il ne fonctionne ni sur mobile, ni dans les navigateurs qui en sont dépourvus (Helium, ungoogled-chromium, Brave sans Widevine activé, navigateurs intégrés aux apps).
- Pour les joueurs : n'importe quel téléphone sur le même Wi-Fi que l'ordinateur.

## 1. Créer ton app Spotify

1. Va sur le [dashboard développeur Spotify](https://developer.spotify.com/dashboard) et connecte-toi.
2. **Create app** :
   - **Redirect URI** : `http://127.0.0.1:3000/auth/spotify` (exactement, `localhost` est refusé par Spotify).
   - **APIs used** : coche *Web API* et *Web Playback SDK*.
3. Dans **Settings**, récupère le *Client ID* et le *Client Secret*.
4. En mode développement, seuls les comptes ajoutés dans **User Management** peuvent se connecter (5 maximum). Le propriétaire de l'app doit avoir Premium.

## 2. Configurer l'environnement

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `NUXT_OAUTH_SPOTIFY_CLIENT_ID` | Client ID de ton app Spotify |
| `NUXT_OAUTH_SPOTIFY_CLIENT_SECRET` | Client Secret (ne quitte jamais le serveur) |
| `NUXT_OAUTH_SPOTIFY_REDIRECT_URL` | `http://127.0.0.1:3000/auth/spotify`, identique au dashboard |
| `NUXT_APP_SECRET` | Secret de chiffrement de la session, 32 caractères minimum : `openssl rand -base64 32` |

Le fichier `.env` est ignoré par git. Ne le commite jamais.

## 3. Lancer

```bash
pnpm install
pnpm dev
```

Ouvre `http://127.0.0.1:3000` (pas `localhost`) sur l'ordinateur qui diffuse.

Le serveur écoute sur tout le réseau local (`0.0.0.0`) : les téléphones rejoignent la partie en scannant le QR code de l'écran d'attente, ou en allant sur `http://<ip-de-l-ordinateur>:3000/join` avec le code affiché. Au premier lancement, macOS peut demander d'autoriser les connexions entrantes pour Node : accepte, sinon les téléphones ne verront pas l'ordinateur.

Pour lancer la version compilée : `pnpm build` puis `NITRO_HOST=0.0.0.0 node --env-file=.env .output/server/index.mjs`.

## Modes de jeu

| Mode | Déroulé |
| --- | --- |
| **Buzz puis saisie** | Le premier qui buzze a 15 s pour taper sa réponse sur son téléphone, validée automatiquement. |
| **Maître du jeu** | Une personne ne joue pas : son téléphone affiche la réponse, elle valide les réponses orales de celui qui a buzzé. |
| **Solo** | La réponse se tape sur l'écran principal, sans téléphone. |

Dans tous les modes : 1 point pour l'artiste, 1 point pour le titre. Une mauvaise réponse ou une réponse partielle fait passer la main : la musique reprend et les autres joueurs peuvent buzzer pour ce qui reste à trouver. Un joueur ne buzze qu'une fois par manche.

## Fonctionnement et choix techniques

- **Nuxt 4** (front + serveur Nitro), **Tailwind CSS 4**, **TypeScript**.
- **OAuth** : Authorization Code flow côté serveur via [nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils). Les tokens Spotify sont stockés dans un cookie de session chiffré, dans la partie `secure` accessible uniquement côté serveur. Le refresh est fait automatiquement avant expiration.
- **Audio** : uniquement via le Web Playback SDK officiel. Aucun audio n'est téléchargé, stocké ou relayé. Aucune pochette ni fichier audio dans le dépôt : tout vient de l'API Spotify au moment du jeu.
- **Réponses** : la partie vit en mémoire du serveur local. Le navigateur ne reçoit le titre et l'artiste qu'au moment de la révélation, et c'est le serveur qui déclenche la lecture sur le lecteur de l'hôte.
- **Validation tolérante** : casse, accents, ponctuation, articles (« The », « Les »…), mentions « feat. », suffixes de version (« - Remastered ») et quelques fautes de frappe selon la longueur. Voir `shared/utils/answer.ts`.
- **Playlists utilisables** : depuis février 2026, l'API ne donne le contenu que des playlists dont tu es propriétaire ou collaborateur. Les playlists suivies (éditoriales Spotify, playlists d'amis) s'affichent mais ne sont pas sélectionnables : copie leurs titres dans une playlist à toi.

## Structure

```
app/
  pages/          index (connexion), playlists, game/[id] (écran principal), join (téléphones)
  composables/    useSpotifyPlayer (Web Playback SDK), useGameSocket (WebSocket), useCountdown
  components/     AppHeader, AppFooter, PlaylistCard, VinylDisc
  middleware/     auth (redirige vers l'accueil si non connecté)
server/
  routes/auth/    spotify.get.ts : flow OAuth Spotify
  api/spotify/    playlists, token (pour le Web Playback SDK)
  api/games/      actions de l'hôte : création, lancement, manche, révélation, manche suivante
  routes/_ws.ts   WebSocket : inscription des téléphones, buzz, réponses, validation du maître du jeu
  utils/          spotify.ts (client API, refresh), tracks.ts, games.ts (moteur de partie), realtime.ts (diffusion)
  middleware/     loopback.ts : redirige localhost vers 127.0.0.1
shared/          types et utilitaires partagés (validation des réponses, réglages)
test/            tests unitaires (pnpm test)
design/           prototypes HTML des directions visuelles
```

## Dépannage

- **`INVALID_CLIENT: Invalid redirect URI`** : la Redirect URI du dashboard et `NUXT_OAUTH_SPOTIFY_REDIRECT_URL` doivent être strictement identiques.
- **Erreur 403 après connexion** : le compte n'est pas ajouté dans *User Management* de l'app, ou le propriétaire n'a plus Premium.
- **Erreur 429** : quota du mode développement atteint, attends quelques minutes.
- **« Widevine » absent** : change de navigateur pour l'écran qui diffuse (voir Prérequis).
- **Les téléphones n'arrivent pas à se connecter** : vérifie qu'ils sont sur le même Wi-Fi (pas un réseau invité, qui isole souvent les appareils) et que macOS autorise les connexions entrantes pour Node.
- **Partie introuvable** : les parties vivent en mémoire, un redémarrage du serveur les efface.

## Licence

[MIT](LICENSE)
