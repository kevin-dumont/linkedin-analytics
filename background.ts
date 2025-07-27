import { performBackgroundScraping, scrapingStatus } from "./background/scraper-service"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!
)

// Démarrage automatique au lancement de l'extension
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension LinkedIn Scraper démarrée')
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    // Vérifier si c'est le premier scraping
    const { data: lastFullScrape } = await supabase
      .rpc('get_last_full_scrape', { p_user_id: user.id })
    
    if (!lastFullScrape) {
      console.log('🎯 Démarrage du premier scraping complet')
      performBackgroundScraping('full')
    }
  }
})

// Installation de l'extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('📦 Extension installée')
    
    // Ouvrir le popup pour la connexion
    chrome.action.openPopup()
  }
})

// Écouter la connexion de l'utilisateur depuis le popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'USER_LOGGED_IN') {
    console.log('👤 Utilisateur connecté, démarrage du scraping initial')
    performBackgroundScraping('full')
    sendResponse({ success: true })
  }
  
  return true
})

// Alarme pour le scraping quotidien
chrome.alarms.create('daily-scraping', {
  periodInMinutes: 24 * 60 // 24 heures
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-scraping') {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: canScrape } = await supabase
        .rpc('can_user_scrape', { p_user_id: user.id })
      
      if (canScrape) {
        console.log('📅 Lancement du scraping quotidien')
        performBackgroundScraping('partial')
      }
    }
  }
})

// Export pour le popup
export { scrapingStatus }