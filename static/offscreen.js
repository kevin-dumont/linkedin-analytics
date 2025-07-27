// Script pour le document offscreen qui fait le scraping invisible

// État du scraping
let isScrapingActive = false
let scrapedPosts = []

// Fonction pour mettre à jour le statut
function updateStatus(message) {
  const statusDiv = document.getElementById('status')
  if (statusDiv) {
    statusDiv.textContent = message
  }
  console.log(`[Offscreen] ${message}`)
}

// Fonction pour extraire les posts depuis une iframe
async function extractPostsFromIframe(iframe) {
  try {
    const iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document)
    if (!iframeDoc) return []

    const posts = []
    
    // Sélecteurs pour les posts LinkedIn
    const postSelectors = [
      '[data-id^="urn:li:activity:"]',
      '.feed-shared-update-v2',
      '[data-urn^="urn:li:activity:"]',
      'article.artdeco-card'
    ]
    
    let postElements: Element[] = []
    
    for (const selector of postSelectors) {
      const elements = Array.from(iframeDoc.querySelectorAll(selector))
      if (elements.length > 0) {
        postElements = elements
        break
      }
    }
    
    updateStatus(`${postElements.length} posts trouvés`)
    
    postElements.forEach((postElement, index) => {
      try {
        // Extraire l'ID du post
        const postId = postElement.getAttribute('data-id') || 
                     postElement.getAttribute('data-urn') ||
                     postElement.querySelector('[data-urn]')?.getAttribute('data-urn') ||
                     `post-${Date.now()}-${index}`
        
        const postUrl = postId.includes('urn:li:activity:') 
          ? `https://www.linkedin.com/feed/update/${postId}/`
          : iframe.src
        
        // Extraire le texte
        const textSelectors = [
          '.feed-shared-update-v2__description-wrapper',
          '.feed-shared-text',
          '.feed-shared-update-v2__description',
          '[data-test-id="main-feed-activity-card__commentary"]',
          '.feed-shared-update-v2__commentary',
          '.update-components-text'
        ]
        
        let text = ''
        for (const selector of textSelectors) {
          const textElement = postElement.querySelector(selector)
          if (textElement) {
            text = textElement.textContent?.trim() || ''
            break
          }
        }
        
        // Extraire la date
        const timeElement = postElement.querySelector('time')
        const postedAt = timeElement?.getAttribute('datetime') || 
                        timeElement?.textContent || 
                        new Date().toISOString()
        
        // Extraire les likes
        const likesSelectors = [
          '[data-test-id="social-actions__reaction-count"]',
          '.social-actions-button__reaction-count',
          '.reactions-count',
          '.social-counts-reactions__count'
        ]
        
        let likes = 0
        for (const selector of likesSelectors) {
          const likesElement = postElement.querySelector(selector)
          if (likesElement) {
            const likesText = likesElement.textContent || ''
            likes = parseInt(likesText.replace(/[^0-9]/g, '') || '0')
            break
          }
        }
        
        // Extraire les commentaires
        const commentsSelectors = [
          '[data-test-id="social-actions__comments"]',
          '.social-actions-button__comments',
          '.comments-count',
          'button[aria-label*="comment"]'
        ]
        
        let comments = 0
        for (const selector of commentsSelectors) {
          const commentsElement = postElement.querySelector(selector)
          if (commentsElement) {
            const commentsText = commentsElement.textContent || ''
            comments = parseInt(commentsText.replace(/[^0-9]/g, '') || '0')
            break
          }
        }
        
        // Extraire les impressions
        let impressions = 0
        const impressionsElement = postElement.querySelector('.feed-shared-update-v2__insights')
        if (impressionsElement) {
          const impressionsText = impressionsElement.textContent || ''
          impressions = parseInt(impressionsText.replace(/[^0-9]/g, '') || '0')
        }
        
        // Extraire les médias
        let mediaUrl
        let mediaUrls = []
        let mediaType
        
        // Images
        const imageElements = postElement.querySelectorAll('img[src*="media.licdn.com"]')
        if (imageElements.length > 0) {
          mediaUrls = Array.from(imageElements).map(img => img.src)
          mediaUrl = mediaUrls[0]
          mediaType = 'image'
        }
        
        // Vidéos
        const videoElement = postElement.querySelector('video')
        if (videoElement) {
          mediaUrl = videoElement.src || videoElement.getAttribute('data-sources')
          mediaType = 'video'
        }
        
        // Articles
        const articleElement = postElement.querySelector('.feed-shared-article')
        if (articleElement) {
          const articleImg = articleElement.querySelector('img')
          if (articleImg) {
            mediaUrl = articleImg.src
            mediaType = 'article'
          }
        }
        
        // Documents
        if (postElement.querySelector('.feed-shared-document')) {
          mediaType = 'document'
        }
        
        // Ajouter le post si valide
        if (text || postId.includes('urn:li:activity:')) {
          posts.push({
            text,
            post_url: postUrl,
            posted_at: postedAt,
            likes,
            comments,
            impressions,
            media_url: mediaUrl,
            media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
            media_type: mediaType
          })
        }
      } catch (error) {
        console.error('Erreur extraction post:', error)
      }
    })
    
    return posts
  } catch (error) {
    console.error('Erreur extraction iframe:', error)
    return []
  }
}

// Fonction pour scroller dans l'iframe
async function scrollIframe(iframe) {
  try {
    const iframeWindow = iframe.contentWindow
    if (!iframeWindow) return false
    
    const currentHeight = iframeWindow.document.body.scrollHeight
    
    // Scroll progressif
    const scrollStep = iframeWindow.innerHeight * 0.8
    let currentScroll = iframeWindow.scrollY
    
    while (currentScroll < currentHeight - iframeWindow.innerHeight) {
      currentScroll += scrollStep
      iframeWindow.scrollTo({
        top: currentScroll,
        behavior: 'smooth'
      })
      await new Promise(r => setTimeout(r, 500))
    }
    
    // Attendre le chargement du nouveau contenu
    await new Promise(r => setTimeout(r, 3000))
    
    const newHeight = iframeWindow.document.body.scrollHeight
    return newHeight > currentHeight
  } catch (error) {
    console.error('Erreur scroll:', error)
    return false
  }
}

// Fonction principale de scraping
async function performOffscreenScraping(url, scrapeType, dateLimit) {
  updateStatus('Démarrage du scraping offscreen...')
  
  const iframe = document.getElementById('linkedin-frame')
  if (!iframe) {
    throw new Error('Iframe non trouvée')
  }
  
  // Charger l'URL dans l'iframe
  iframe.src = url
  
  // Attendre le chargement
  await new Promise((resolve) => {
    iframe.onload = () => {
      setTimeout(resolve, 5000) // Attendre 5s pour le contenu dynamique
    }
  })
  
  const allPosts = []
  let scrollCount = 0
  const maxScrolls = scrapeType === 'full' ? 20 : 5
  let hasMoreContent = true
  
  while (hasMoreContent && scrollCount < maxScrolls) {
    // Extraire les posts
    const posts = await extractPostsFromIframe(iframe)
    
    // Filtrer par date si nécessaire
    const filteredPosts = posts.filter(post => {
      if (!dateLimit) return true
      const postDate = new Date(post.posted_at)
      return postDate >= dateLimit
    })
    
    // Ajouter les nouveaux posts (déduplication)
    for (const post of filteredPosts) {
      if (!allPosts.some(p => p.post_url === post.post_url)) {
        allPosts.push(post)
      }
    }
    
    updateStatus(`${allPosts.length} posts collectés`)
    
    // Vérifier si on doit continuer
    if (dateLimit && filteredPosts.length < posts.length) {
      break
    }
    
    // Scroller pour charger plus
    hasMoreContent = await scrollIframe(iframe)
    scrollCount++
    
    // Attendre un peu
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
  }
  
  scrapedPosts = allPosts
  updateStatus(`Scraping terminé: ${allPosts.length} posts`)
}

// Écouter les messages du background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_OFFSCREEN_SCRAPING') {
    const { url, scrapeType, dateLimit } = message
    
    isScrapingActive = true
    
    performOffscreenScraping(url, scrapeType, dateLimit ? new Date(dateLimit) : undefined)
      .then(() => {
        // Envoyer les résultats au background
        chrome.runtime.sendMessage({
          action: 'OFFSCREEN_SCRAPING_COMPLETE',
          posts: scrapedPosts
        })
      })
      .catch((error) => {
        chrome.runtime.sendMessage({
          action: 'OFFSCREEN_SCRAPING_ERROR',
          error: error.message
        })
      })
      .finally(() => {
        isScrapingActive = false
      })
    
    sendResponse({ success: true })
  }
  
  return true
})

updateStatus('Offscreen document prêt')