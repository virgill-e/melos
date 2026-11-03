# Melos

Blind test de salon sur ta propre musique Spotify. Un appareil (ordinateur branché à la TV ou aux enceintes) diffuse la musique, les téléphones des joueurs servent de buzzers via un QR code sur le Wi-Fi local.

> **Projet personnel, usage strictement privé.** Melos n'est ni affilié à Spotify, ni approuvé ou sponsorisé par Spotify. Spotify est une marque de Spotify AB.
>
> La [Developer Policy de Spotify](https://developer.spotify.com/policy/) interdit les applications de type jeu ou quiz utilisant la plateforme Spotify. Ce projet n'est donc **pas conforme** à cette politique : il est destiné à un usage privé entre proches, sans diffusion publique, sans usage commercial, et chacun l'utilise sous sa propre responsabilité avec sa propre app développeur.

## État d'avancement

- [x] Connexion Spotify (OAuth côté serveur, refresh automatique, déconnexion)
- [x] Liste des playlists de l'utilisateur connecté
- [ ] Paramétrage de la partie (nombre de manches, durée d'extrait, mode buzzer ou texte)
- [ ] Lecture via le Web Playback SDK
- [ ] Buzzers sur téléphone (QR code, WebSocket local)
- [ ] Écran de résultats

## Prérequis

- Node.js 22.22+ et [pnpm](https://pnpm.io)
- Un compte **Spotify Premium** pour l'appareil qui diffuse (obligatoire pour le Web Playback SDK et pour posséder une app en mode développement)
- Un navigateur desktop récent (Chrome, Edge ou Firefox). Le Web Playback SDK ne fonctionne pas sur mobile ; Safari n'est pas recommandé.

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

Ouvre `http://127.0.0.1:3000` (pas `localhost`).

## Fonctionnement et choix techniques

- **Nuxt 4** (front + serveur Nitro), **Tailwind CSS 4**, **TypeScript**.
- **OAuth** : Authorization Code flow côté serveur via [nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils). Les tokens Spotify sont stockés dans un cookie de session chiffré, dans la partie `secure` accessible uniquement côté serveur. Le refresh est fait automatiquement avant expiration.
- **Audio** : uniquement via le Web Playback SDK officiel. Aucun audio n'est téléchargé, stocké ou relayé. Aucune pochette ni fichier audio dans le dépôt : tout vient de l'API Spotify au moment du jeu.
- **Playlists utilisables** : depuis février 2026, l'API ne donne le contenu que des playlists dont tu es propriétaire ou collaborateur. Les playlists suivies (éditoriales Spotify, playlists d'amis) s'affichent mais ne sont pas sélectionnables : copie leurs titres dans une playlist à toi.

## Structure

```
app/
  pages/          index (connexion), playlists
  components/     AppHeader, AppFooter, PlaylistCard, VinylDisc
  middleware/     auth (redirige vers l'accueil si non connecté)
server/
  routes/auth/    spotify.get.ts : flow OAuth Spotify
  api/spotify/    playlists.get.ts : playlists de l'utilisateur
  utils/          spotify.ts : scopes, refresh token, client API
  middleware/     loopback.ts : redirige localhost vers 127.0.0.1
shared/types/     types partagés client / serveur
design/           prototypes HTML des directions visuelles
```

## Dépannage

- **`INVALID_CLIENT: Invalid redirect URI`** : la Redirect URI du dashboard et `NUXT_OAUTH_SPOTIFY_REDIRECT_URL` doivent être strictement identiques.
- **Erreur 403 après connexion** : le compte n'est pas ajouté dans *User Management* de l'app, ou le propriétaire n'a plus Premium.
- **Erreur 429** : quota du mode développement atteint, attends quelques minutes.

## Licence

[MIT](LICENSE)
