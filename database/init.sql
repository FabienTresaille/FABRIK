-- ╔══════════════════════════════════════════════╗
-- ║     FABRIK — Initialisation PostgreSQL         ║
-- ╚══════════════════════════════════════════════╝

-- ==============================================
-- TABLE : USERS (Comptes agence & clients)
-- ==============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('admin', 'client')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE : CLIENTS (Entreprises auditées)
-- ==============================================
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    website_url VARCHAR(500),
    instagram_handle VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    notes TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE : AUDITS (Résultats d'audit 360°)
-- ==============================================
CREATE TABLE IF NOT EXISTS audits (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'complete', 'error')),

    -- Données brutes des APIs
    pagespeed_data JSONB,
    apify_data JSONB,

    -- Synthèse IA
    gemini_synthesis TEXT,

    -- Scores calculés
    score_global INTEGER CHECK (score_global >= 0 AND score_global <= 100),
    score_performance INTEGER CHECK (score_performance >= 0 AND score_performance <= 100),
    score_seo INTEGER CHECK (score_seo >= 0 AND score_seo <= 100),
    score_social INTEGER CHECK (score_social >= 0 AND score_social <= 100),

    -- Métadonnées
    error_message TEXT,
    n8n_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================
-- INDEX pour les requêtes fréquentes
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_audits_client_id ON audits(client_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==============================================
-- Note : Le compte admin est créé automatiquement
-- via l'inscription avec l'email admin@alsek.fr
-- Il recevra automatiquement le rôle 'admin' et sera actif immédiatement.
-- Tous les autres comptes seront en attente d'approbation.
-- ==============================================
