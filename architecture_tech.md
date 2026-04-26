# ARCHITECTURE TECHNIQUE - FABRIK

## Stack logicielle
- **Frontend** : Next.js 14+ (App Router).
- **Backend** : FastAPI (Python 3.11+).
- **Automation** : n8n (Instance dédiée).

## Réseau & Proxy (Traefik v3.1)
- **Réseau Docker Externe** : `audit-app_web` (Impératif pour le routage).
- **Certificat SSL** : Resolver `letsencrypt` (déjà configuré sur le VPS).
- **Entrypoints** : `websecure` (port 443).

## DNS & Routage
- `fabrik.alsek.fr` -> Service Frontend (port 3000 interne).
- `api.fabrik.alsek.fr` -> Service Backend (port 8000 interne).
- `n8n.fabrik.alsek.fr` -> Service n8n (port 5678 interne).

## Ports Exposés (Host)
- Database : 5433 (PostgreSQL).
- Backend : 8010 (Pour accès direct si besoin).
- Frontend : 3010 (Pour accès direct si besoin).