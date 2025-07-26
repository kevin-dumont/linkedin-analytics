-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job for rescraping posts
-- This job runs every day at 2 AM
SELECT cron.schedule(
    'rescrape-linkedin-posts',  -- job name
    '0 2 * * *',                -- cron expression: every day at 2 AM
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/rescrape-posts',
        headers := jsonb_build_object(
            'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Note: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values
-- You can find these in your Supabase dashboard under Settings > API