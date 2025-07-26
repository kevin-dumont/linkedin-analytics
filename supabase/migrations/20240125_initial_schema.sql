-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT,
    post_url TEXT UNIQUE NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('click', 'rdv')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX idx_posts_last_scraped_at ON posts(last_scraped_at);
CREATE INDEX idx_events_post_id ON events(post_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policies for posts
CREATE POLICY "Users can view their own posts" ON posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for events
CREATE POLICY "Users can view events for their posts" ON events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = events.post_id 
            AND posts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert events for their posts" ON events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = events.post_id 
            AND posts.user_id = auth.uid()
        )
    );

-- Function to get posts that need rescraping
CREATE OR REPLACE FUNCTION get_posts_to_rescrape()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    post_url TEXT,
    posted_at TIMESTAMP WITH TIME ZONE,
    last_scraped_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.post_url,
        p.posted_at,
        p.last_scraped_at
    FROM posts p
    WHERE 
        -- Post is less than 45 days old
        p.posted_at > NOW() - INTERVAL '45 days'
        -- And hasn't been scraped in the last 7 days
        AND p.last_scraped_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;