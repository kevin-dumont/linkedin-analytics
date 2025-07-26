import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Récupérer les posts à rescraper
    const { data: posts, error } = await supabaseClient
      .rpc('get_posts_to_rescrape')

    if (error) throw error

    console.log(`${posts.length} posts à rescraper`)

    // Ici, on devrait idéalement envoyer ces posts à un service de scraping
    // Pour l'instant, on retourne juste la liste
    // Dans la pratique, vous pourriez utiliser un service comme Puppeteer ou Playwright
    // hébergé sur un serveur externe pour faire le scraping réel

    return new Response(
      JSON.stringify({
        message: `${posts.length} posts identifiés pour rescraping`,
        posts: posts.map(p => ({
          id: p.id,
          url: p.post_url,
          last_scraped_at: p.last_scraped_at
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})