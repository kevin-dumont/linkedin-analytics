// Configuration du scraper pour optimiser les performances et éviter la détection

export interface ScraperConfig {
  // Timing
  debounceDelay: number
  scrollDelay: number
  navigationDelay: number
  processingTimeout: number
  
  // Limites
  maxScrolls: number
  maxPostsPerBatch: number
  maxRetries: number
  
  // Sélecteurs
  postSelectors: string[]
  textSelectors: string[]
  likesSelectors: string[]
  commentsSelectors: string[]
  impressionsSelectors: string[]
  
  // Options
  enableAutoNavigation: boolean
  enableAutoScroll: boolean
  enableConsoleLogging: boolean
  respectRateLimit: boolean
}

export const DEFAULT_CONFIG: ScraperConfig = {
  // Timing optimisé pour être discret
  debounceDelay: 3000,          // 3 secondes entre les scraping
  scrollDelay: 2000,            // 2 secondes après scroll
  navigationDelay: 3000,        // 3 secondes avant navigation auto
  processingTimeout: 30000,     // 30 secondes max par traitement
  
  // Limites raisonnables
  maxScrolls: 10,               // Max 10 scrolls automatiques
  maxPostsPerBatch: 50,         // Max 50 posts par batch
  maxRetries: 3,                // 3 tentatives max
  
  // Sélecteurs robustes pour LinkedIn
  postSelectors: [
    '[data-id^="urn:li:activity:"]',
    '.feed-shared-update-v2',
    '[data-urn^="urn:li:activity:"]',
    '.artdeco-card[data-id]',
    '.feed-shared-update-v2__content'
  ],
  
  textSelectors: [
    '.feed-shared-update-v2__description-wrapper',
    '.feed-shared-text',
    '.feed-shared-update-v2__description',
    '[data-test-id="main-feed-activity-card__commentary"]',
    '.feed-shared-update-v2__commentary',
    '.feed-shared-text__text-view'
  ],
  
  likesSelectors: [
    '[data-test-id="social-actions__reaction-count"]',
    '.social-actions-button__reaction-count',
    '.react-count__count',
    '.social-actions__reaction-count',
    '.social-counts-reactions__count'
  ],
  
  commentsSelectors: [
    '[data-test-id="social-actions__comments"]',
    '.social-actions-button__comment-count',
    '.comment-count',
    '.social-actions__comment-count',
    '.social-counts-comments__count'
  ],
  
  impressionsSelectors: [
    '.feed-shared-update-v2__insights',
    '.feed-shared-social-counts',
    '.social-counts-reactions__count',
    '.feed-shared-update-v2__social-counts',
    '.impression-count'
  ],
  
  // Options par défaut
  enableAutoNavigation: true,
  enableAutoScroll: true,
  enableConsoleLogging: true,
  respectRateLimit: true
}

// Utilitaires pour la configuration
export class ScraperConfigManager {
  private static instance: ScraperConfigManager
  private config: ScraperConfig
  
  private constructor() {
    this.config = { ...DEFAULT_CONFIG }
  }
  
  static getInstance(): ScraperConfigManager {
    if (!ScraperConfigManager.instance) {
      ScraperConfigManager.instance = new ScraperConfigManager()
    }
    return ScraperConfigManager.instance
  }
  
  getConfig(): ScraperConfig {
    return { ...this.config }
  }
  
  updateConfig(updates: Partial<ScraperConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveToStorage()
  }
  
  async loadFromStorage(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get('scraperConfig')
      if (stored.scraperConfig) {
        this.config = { ...DEFAULT_CONFIG, ...stored.scraperConfig }
      }
    } catch (error) {
      console.warn('Impossible de charger la config:', error)
    }
  }
  
  private async saveToStorage(): Promise<void> {
    try {
      await chrome.storage.local.set({ scraperConfig: this.config })
    } catch (error) {
      console.warn('Impossible de sauvegarder la config:', error)
    }
  }
  
  // Méthodes utilitaires
  shouldLog(): boolean {
    return this.config.enableConsoleLogging
  }
  
  getPostSelectors(): string[] {
    return this.config.postSelectors
  }
  
  getTextSelectors(): string[] {
    return this.config.textSelectors
  }
  
  getLikesSelectors(): string[] {
    return this.config.likesSelectors
  }
  
  getCommentsSelectors(): string[] {
    return this.config.commentsSelectors
  }
  
  getImpressionsSelectors(): string[] {
    return this.config.impressionsSelectors
  }
  
  getDebounceDelay(): number {
    return this.config.debounceDelay
  }
  
  getScrollDelay(): number {
    return this.config.scrollDelay
  }
  
  getNavigationDelay(): number {
    return this.config.navigationDelay
  }
  
  getMaxScrolls(): number {
    return this.config.maxScrolls
  }
  
  getMaxPostsPerBatch(): number {
    return this.config.maxPostsPerBatch
  }
  
  shouldAutoNavigate(): boolean {
    return this.config.enableAutoNavigation
  }
  
  shouldAutoScroll(): boolean {
    return this.config.enableAutoScroll
  }
  
  shouldRespectRateLimit(): boolean {
    return this.config.respectRateLimit
  }
}

// Fonction pour créer un délai avec timeout
export function createDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Fonction pour retry avec délai exponentiel
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      
      const delay = baseDelay * Math.pow(2, i)
      await createDelay(delay)
    }
  }
  throw new Error('Max retries exceeded')
}

// Fonction pour détecter si on est en train d'être rate-limited
export function detectRateLimit(): boolean {
  // Vérifier les signes de rate limiting LinkedIn
  const rateLimitSignals = [
    'too many requests',
    'rate limit',
    'temporarily unavailable',
    'please wait',
    'try again later'
  ]
  
  const pageText = document.body.textContent?.toLowerCase() || ''
  return rateLimitSignals.some(signal => pageText.includes(signal))
}

// Fonction pour randomiser les délais (humanisation)
export function randomizeDelay(baseDelay: number, variance: number = 0.3): number {
  const min = baseDelay * (1 - variance)
  const max = baseDelay * (1 + variance)
  return Math.random() * (max - min) + min
}