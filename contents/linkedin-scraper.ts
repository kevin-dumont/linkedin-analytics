import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/*"],
  run_at: "document_idle"
}

// Content script minimal - juste pour fournir le cookie li_at au background
console.log('📍 LinkedIn Scraper - Content Script chargé')

// Écouter les demandes du background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_LINKEDIN_COOKIE') {
    // Récupérer le cookie li_at depuis le DOM
    const cookies = document.cookie.split(';')
    const liAtCookie = cookies.find(c => c.trim().startsWith('li_at='))
    
    if (liAtCookie) {
      const liAt = liAtCookie.split('=')[1]
      sendResponse({ liAt })
    } else {
      sendResponse({ error: 'Cookie li_at non trouvé' })
    }
  }
  
  return true
})