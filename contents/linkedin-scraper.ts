import type { PlasmoCSConfig } from "plasmo"
import { createClient } from "@supabase/supabase-js"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/*"],
  run_at: "document_idle"
}

const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!
)

interface Post {
  text: string
  post_url: string
  posted_at: string
  likes: number
  comments: number
  impressions: number
}

function extractPostData(): Post[] {
  const posts: Post[] = []
  
  // Sélecteur pour les posts LinkedIn
  const postElements = document.querySelectorAll('[data-id^="urn:li:activity:"]')
  
  postElements.forEach((postElement) => {
    try {
      // Extraire l'URL du post
      const postId = postElement.getAttribute('data-id')
      const postUrl = `https://www.linkedin.com/feed/update/${postId}/`
      
      // Extraire le texte du post
      const textElement = postElement.querySelector('.feed-shared-update-v2__description-wrapper')
      const text = textElement?.textContent?.trim() || ''
      
      // Extraire la date
      const timeElement = postElement.querySelector('time')
      const postedAt = timeElement?.getAttribute('datetime') || new Date().toISOString()
      
      // Extraire les statistiques
      const likesElement = postElement.querySelector('[data-test-id="social-actions__reaction-count"]')
      const likes = parseInt(likesElement?.textContent?.replace(/[^0-9]/g, '') || '0')
      
      const commentsElement = postElement.querySelector('[data-test-id="social-actions__comments"]')
      const comments = parseInt(commentsElement?.textContent?.replace(/[^0-9]/g, '') || '0')
      
      // Les impressions nécessitent d'ouvrir le détail du post
      const impressionsElement = postElement.querySelector('.feed-shared-update-v2__insights')
      const impressions = parseInt(impressionsElement?.textContent?.replace(/[^0-9]/g, '') || '0')
      
      posts.push({
        text,
        post_url: postUrl,
        posted_at: postedAt,
        likes,
        comments,
        impressions
      })
    } catch (error) {
      console.error('Erreur lors de l\'extraction du post:', error)
    }
  })
  
  return posts
}

async function sendPostsToSupabase(posts: Post[]) {
  try {
    // Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('Utilisateur non connecté')
      return
    }
    
    // Préparer les données pour l'insertion
    const postsWithUser = posts.map(post => ({
      ...post,
      user_id: user.id,
      last_scraped_at: new Date().toISOString()
    }))
    
    // Insérer ou mettre à jour les posts
    const { data, error } = await supabase
      .from('posts')
      .upsert(postsWithUser, {
        onConflict: 'post_url',
        ignoreDuplicates: false
      })
    
    if (error) {
      console.error('Erreur lors de l\'envoi vers Supabase:', error)
    } else {
      console.log(`${posts.length} posts synchronisés avec succès`)
    }
  } catch (error) {
    console.error('Erreur générale:', error)
  }
}

// Observer les changements dans le feed LinkedIn
const observer = new MutationObserver(() => {
  const posts = extractPostData()
  if (posts.length > 0) {
    sendPostsToSupabase(posts)
  }
})

// Démarrer l'observation lorsque le feed est chargé
const feedElement = document.querySelector('[role="main"]')
if (feedElement) {
  observer.observe(feedElement, {
    childList: true,
    subtree: true
  })
  
  // Extraction initiale
  const posts = extractPostData()
  if (posts.length > 0) {
    sendPostsToSupabase(posts)
  }
}