-- Ajouter la colonne media_url pour stocker les médias (images/vidéos)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Ajouter un array pour stocker plusieurs médias si nécessaire
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';

-- Ajouter le type de média
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video', 'document', 'article', NULL));

-- Ajouter une contrainte unique sur post_url pour éviter les doublons
ALTER TABLE posts 
ADD CONSTRAINT unique_post_url UNIQUE (post_url);

-- Ajouter des colonnes pour le tracking du scraping
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS is_full_scrape BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scrape_version INTEGER DEFAULT 1;

-- Créer un index sur posted_at pour les requêtes de date
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at DESC);

-- Créer un index sur user_id et posted_at pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_posts_user_posted ON posts(user_id, posted_at DESC);

-- Ajouter une table pour tracker l'historique de scraping
CREATE TABLE IF NOT EXISTS scraping_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    posts_scraped INTEGER DEFAULT 0,
    scrape_type TEXT CHECK (scrape_type IN ('full', 'partial', 'manual')),
    status TEXT CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour l'historique
CREATE INDEX IF NOT EXISTS idx_scraping_history_user ON scraping_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraping_history_status ON scraping_history(status, created_at DESC);

-- Fonction pour obtenir le dernier scraping complet d'un utilisateur
CREATE OR REPLACE FUNCTION get_last_full_scrape(p_user_id UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN (
        SELECT completed_at 
        FROM scraping_history 
        WHERE user_id = p_user_id 
        AND scrape_type = 'full' 
        AND status = 'completed'
        ORDER BY completed_at DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur peut faire un nouveau scraping
CREATE OR REPLACE FUNCTION can_user_scrape(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_scrape TIMESTAMP WITH TIME ZONE;
    running_scrapes INTEGER;
BEGIN
    -- Vérifier s'il y a un scraping en cours
    SELECT COUNT(*) INTO running_scrapes
    FROM scraping_history
    WHERE user_id = p_user_id
    AND status = 'running';
    
    IF running_scrapes > 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Vérifier le dernier scraping
    SELECT completed_at INTO last_scrape
    FROM scraping_history
    WHERE user_id = p_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;
    
    -- Si jamais scrappé ou dernier scraping > 1 jour
    RETURN last_scrape IS NULL OR last_scrape < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;