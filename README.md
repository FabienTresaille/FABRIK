# FABRIK — Business Partner IA

> SaaS d'audit digital automatisé 360° pour agences de marketing.

## 🏗️ Architecture

| Service | Technologie | Domaine | Port interne |
|---|---|---|---|
| `fabrik-front` | Next.js 14 | `fabrik.alsek.fr` | 3000 |
| `fabrik-back` | FastAPI (Python 3.11) | `api.fabrik.alsek.fr` | 8000 |
| `fabrik-n8n` | n8n | `n8n.fabrik.alsek.fr` | 5678 |
| `fabrik-db` | PostgreSQL 15 | — (interne) | 5432 |

## 🚀 Déploiement

### 1. Prérequis
- Docker & Docker Compose installés sur le VPS
- Traefik v3.1 en fonctionnement avec le réseau `audit-app_web`
- DNS configuré pour les 3 sous-domaines

### 2. Configuration
```bash
cp .env.example .env
# Éditer .env avec vos vraies clés API
```

### 3. Lancement
```bash
docker-compose up -d --build
```

### 4. Vérification
```bash
docker-compose ps
curl https://api.fabrik.alsek.fr/
```

## 📂 Structure du projet

```
FABRIK/
├── docker-compose.yml
├── .env.example
├── backend/          # FastAPI
│   ├── Dockerfile
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       └── services/
│           ├── apify_service.py
│           ├── pagespeed_service.py
│           ├── gemini_service.py
│           └── n8n_service.py
├── frontend/         # Next.js
│   ├── Dockerfile
│   ├── public/
│   │   └── logo.png  ← Placer le logo ici
│   └── src/
│       ├── app/
│       └── components/
└── database/
    └── init.sql
```

## 🔑 APIs requises

| API | Variable | Obtenir |
|---|---|---|
| Apify | `APIFY_API_TOKEN` | [apify.com](https://apify.com) |
| Google PageSpeed | `PAGESPEED_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) |
| Google Gemini | `GEMINI_API_KEY` | [AI Studio](https://aistudio.google.com) |

## 📌 Logo

Placer le fichier `logo.png` dans :
```
frontend/public/logo.png
```

---

*Développé par [Alsek](https://alsek.fr) — Business Partner IA*
