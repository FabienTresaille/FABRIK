# GUIDE DE MAINTENANCE & DÉPLOIEMENT

## Déploiement via GitHub Desktop
- Les secrets ne doivent jamais être pushés (utiliser `.env.example`).
- Toujours vérifier que le réseau `audit-app_web` est bien déclaré comme `external: true` dans le docker-compose.
- Procédure : `git pull` sur le VPS -> `docker-compose up -d --build`.

## Persistance
- Volumes Docker nommés pour PostgreSQL (`fabrik_db_data`) et n8n (`fabrik_n8n_data`).

## Identité Visuelle
- Le fichier `logo.png` sera fourni manuellement dans le dossier `public/` du frontend.


## Logs
- Si le SSL ne s'active pas : `docker logs -f traefik`.
- Les labels Traefik doivent utiliser `traefik.http.routers.[service].tls.certresolver=letsencrypt`.