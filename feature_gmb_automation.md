# MODULE : GMB AUTO-POSTER (MEGA TO GOOGLE)

## Description
Automatisation de la publication de contenus (Photos/Vidéos) sur Google My Business à partir d'un dossier source MEGA.

## Workflow Logique
1. **Source** : Un dossier MEGA par client. Les fichiers sont nommés par numéros (ex: `01.jpg`, `02.jpg`, `03.mp4`).
2. **Fréquence** : 2 fois par semaine (jours/heures configurables depuis l'interface Agence).
3. **Tracking** : La base de données PostgreSQL doit stocker le "Dernier numéro posté" pour chaque client afin de ne pas publier de doublons.
4. **Vue Agence (FABRIK)** : 
   - Toggle pour activer/désactiver l'option par client.
   - Champ pour l'URL du dossier MEGA.
   - Liaison avec l'API Google Business Profile du client (OAuth2).

## Détails Techniques
- **Backend (FastAPI)** : Gère les paramètres (jours de post, lien MEGA, état du module).
- **Automation (n8n)** : 
  - Trigger : Cron (2x/semaine).
  - Action 1 : Récupérer le contenu du dossier MEGA (via l'API MEGA ou node dédié).
  - Action 2 : Identifier le fichier correspondant au `Current_Index + 1`.
  - Action 3 : Poster sur Google Business Profile via l'API officielle.
  - Action 4 : Envoyer un callback à FastAPI pour incrémenter l'index du contenu posté.

## UI (Next.js)
- Une carte "Google My Business" dans le dashboard client/agence.
- Indicateur de statut (Prochain post prévu le : DD/MM).
- Bouton "Tester la connexion MEGA".

# MODULE : GMB REPUTATION & AI REPLY

## Description
Centralisation des avis Google Business Profile avec génération de réponses suggérées par IA (Gemini).

## Workflow des Avis
1. **Sync** : n8n récupère les nouveaux avis via l'API Google Business Profile (Polling toutes les 1h).
2. **Analyse IA** : 
   - Chaque nouvel avis est envoyé à FastAPI -> Gemini.
   - Gemini analyse le sentiment (Positif/Négatif) et génère une réponse personnalisée.
3. **Stockage DB** : Table `Reviews` liée au `Client_ID` avec champs : `author`, `rating`, `comment`, `ai_suggestion`, `status` (pending/replied), `is_read`.

## Vues Data (Dual-View)
- **Vue CLIENT** : Dashboard filtré sur ses propres avis. Possibilité de copier/modifier la suggestion IA pour répondre.
- **Vue ALSEK (Agence)** : 
   - **Global Review Feed** : Un flux centralisé affichant TOUS les avis de TOUS les clients par ordre chronologique.
   - Badge de notification pour les avis non lus ou avec une note < 3 étoiles.

## Spécificités IA
- Le prompt Gemini doit inclure le "Tone of Voice" de l'agence Marketing et les spécificités du métier du client (ex: si c'est un restaurant, mentionner la cuisine).