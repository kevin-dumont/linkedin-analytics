import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EventPayload {
  post_id: string
  type: 'click' | 'rdv'
  metadata?: Record<string, any>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Non autorisé')
    }

    // Récupérer le payload
    const payload: EventPayload = await req.json()

    // Vérifier que le post appartient bien à l'utilisateur
    const { data: post, error: postError } = await supabaseClient
      .from('posts')
      .select('id')
      .eq('id', payload.post_id)
      .eq('user_id', user.id)
      .single()

    if (postError || !post) {
      throw new Error('Post non trouvé ou non autorisé')
    }

    // Enregistrer l'événement
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .insert({
        post_id: payload.post_id,
        type: payload.type,
        metadata: payload.metadata || {}
      })
      .select()
      .single()

    if (eventError) throw eventError

    return new Response(
      JSON.stringify({ success: true, event }),
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
        status: error.message === 'Non autorisé' ? 401 : 400,
      },
    )
  }
})