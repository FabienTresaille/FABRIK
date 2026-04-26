# MODULE : AUDIT AUTOMATISÉ 360°

## Workflow de données
1. **Saisie** : URL Site Web + @Handle Instagram.
2. **Extraction Technique (Parallèle)** :
   - **Google PageSpeed API** : Score Performance, SEO, Accessibilité.
   - **Apify API (Instagram Scraper)** : Taux d'engagement, fréquence de post, analyse des Reels.
3. **Analyse IA** :
   - Envoi du JSON (PageSpeed + Apify) à l'API **Gemini**.
   - Génération d'une synthèse stratégique "Business Partner".
4. **Output** :
   - Création du client en base de données.
   - Génération d'une page d'audit interactive sur `fabrik.alsek.fr`.
   - Webhook envoyé au n8n local pour notification agence.