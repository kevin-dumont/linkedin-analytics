import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScrapingStatus {
  isRunning: boolean;
  currentUser: string | null;
  startTime: Date | null;
  postsScraped: number;
  lastUpdate: Date | null;
  scrapeType: "full" | "partial" | "manual";
  historyId: string | null;
  currentTabId?: number;
}

interface Post {
  text: string;
  post_url: string;
  posted_at: string;
  likes: number;
  comments: number;
  impressions: number;
  media_url?: string;
  media_urls?: string[];
  media_type?: "image" | "video" | "document" | "article";
}

// État global du scraping
let scrapingStatus: ScrapingStatus = {
  isRunning: false,
  currentUser: null,
  startTime: null,
  postsScraped: 0,
  lastUpdate: null,
  scrapeType: "manual",
  historyId: null,
  currentTabId: undefined,
};

// Fonction pour créer une entrée dans l'historique
async function createScrapingHistory(
  userId: string,
  scrapeType: "full" | "partial" | "manual"
) {
  const { data, error } = await supabase
    .from("scraping_history")
    .insert({
      user_id: userId,
      scrape_type: scrapeType,
      status: "running",
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur création historique:", error);
    return null;
  }

  return data;
}

// Fonction pour mettre à jour l'historique
async function updateScrapingHistory(historyId: string, updates: any) {
  await supabase.from("scraping_history").update(updates).eq("id", historyId);
}

// Fonction pour créer un délai
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Variable pour tracker si l'offscreen document existe
let offscreenDocumentCreated = false;

// Fonction pour créer le document offscreen
async function createOffscreenDocument(): Promise<void> {
  if (offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.createDocument({
      url: "static/offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Scraping LinkedIn posts in background",
    });
    offscreenDocumentCreated = true;
  } catch (error) {
    // Le document existe peut-être déjà
    if (error.message?.includes("already exists")) {
      offscreenDocumentCreated = true;
    } else {
      throw error;
    }
  }
}

// Fonction pour fermer le document offscreen
async function closeOffscreenDocument(): Promise<void> {
  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
  } catch (error) {
    // Ignorer si déjà fermé
  }
}

// Fonction principale de scraping en background avec offscreen
async function performBackgroundScraping(
  scrapeType: "full" | "partial" | "manual" = "partial"
) {
  try {
    // Vérifier l'utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("❌ Utilisateur non connecté");
      return;
    }

    // Vérifier si on peut scraper
    const { data: canScrape } = await supabase.rpc("can_user_scrape", {
      p_user_id: user.id,
    });

    if (!canScrape && scrapeType !== "manual") {
      console.log("⏳ Scraping déjà effectué récemment");
      return;
    }

    // Créer l'entrée d'historique
    const history = await createScrapingHistory(user.id, scrapeType);
    if (!history) return;

    // Mettre à jour le statut
    scrapingStatus = {
      isRunning: true,
      currentUser: user.id,
      startTime: new Date(),
      postsScraped: 0,
      lastUpdate: new Date(),
      scrapeType,
      historyId: history.id,
    };

    console.log(`🚀 Démarrage du scraping ${scrapeType} avec offscreen API`);

    // Créer le document offscreen
    await createOffscreenDocument();

    // Calculer la date limite pour le scraping partiel
    const dateLimit =
      scrapeType === "partial"
        ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 jours
        : null;

    // Promise pour attendre les résultats
    const scrapingResult = await new Promise<Post[]>((resolve, reject) => {
      // Listener pour les messages de l'offscreen
      const messageListener = (message: any) => {
        if (message.action === "OFFSCREEN_SCRAPING_COMPLETE") {
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve(message.posts || []);
        } else if (message.action === "OFFSCREEN_SCRAPING_ERROR") {
          chrome.runtime.onMessage.removeListener(messageListener);
          reject(new Error(message.error));
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);

      // Envoyer le message pour démarrer le scraping
      chrome.runtime.sendMessage({
        action: "START_OFFSCREEN_SCRAPING",
        url: "https://www.linkedin.com/in/me/recent-activity/all/",
        scrapeType,
        dateLimit: dateLimit?.toISOString(),
      });

      // Timeout après 5 minutes
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error("Timeout du scraping offscreen"));
      }, 5 * 60 * 1000);
    });

    // Mettre à jour le statut
    scrapingStatus.postsScraped = scrapingResult.length;
    scrapingStatus.lastUpdate = new Date();

    // Sauvegarder les posts
    const savedCount = await savePosts(
      scrapingResult,
      user.id,
      scrapeType === "full"
    );

    // Mettre à jour l'historique
    await updateScrapingHistory(history.id, {
      completed_at: new Date(),
      posts_scraped: savedCount,
      status: "completed",
    });

    console.log(`✅ Scraping terminé: ${savedCount} posts sauvegardés`);
  } catch (error) {
    console.error("❌ Erreur scraping:", error);

    if (scrapingStatus.historyId) {
      await updateScrapingHistory(scrapingStatus.historyId, {
        completed_at: new Date(),
        status: "failed",
        error_message: error.message,
      });
    }
  } finally {
    scrapingStatus.isRunning = false;

    // Fermer le document offscreen
    await closeOffscreenDocument();
  }
}

// Sauvegarder les posts avec déduplication
async function savePosts(
  posts: Post[],
  userId: string,
  isFullScrape: boolean
): Promise<number> {
  if (posts.length === 0) return 0;

  // Préparer les posts avec user_id
  const postsWithUser = posts.map((post) => ({
    ...post,
    user_id: userId,
    last_scraped_at: new Date().toISOString(),
    is_full_scrape: isFullScrape,
    scrape_version: 2, // Version 2 avec médias
  }));

  // Utiliser upsert avec gestion des conflits
  const { data, error } = await supabase
    .from("posts")
    .upsert(postsWithUser, {
      onConflict: "post_url",
      ignoreDuplicates: false, // On veut mettre à jour les stats
    })
    .select();

  if (error) {
    console.error("Erreur sauvegarde posts:", error);
    return 0;
  }

  return data?.length || 0;
}

// Gestionnaire de messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "START_SCRAPING":
      if (!scrapingStatus.isRunning) {
        performBackgroundScraping(message.scrapeType || "manual");
        sendResponse({ success: true, status: "started" });
      } else {
        sendResponse({ success: false, status: "already_running" });
      }
      break;

    case "GET_SCRAPING_STATUS":
      sendResponse({
        ...scrapingStatus,
        postsScraped: scrapingStatus.postsScraped,
      });
      break;

    case "STOP_SCRAPING":
      if (scrapingStatus.isRunning && scrapingStatus.historyId) {
        updateScrapingHistory(scrapingStatus.historyId, {
          completed_at: new Date(),
          status: "cancelled",
          posts_scraped: scrapingStatus.postsScraped,
        });
        scrapingStatus.isRunning = false;
        sendResponse({ success: true });
      }
      break;
  }

  return true; // Garder le canal ouvert pour les réponses async
});

// Vérifier périodiquement pour le scraping automatique quotidien
setInterval(async () => {
  if (!scrapingStatus.isRunning) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Vérifier le dernier scraping complet
      const { data: lastFullScrape } = await supabase.rpc(
        "get_last_full_scrape",
        { p_user_id: user.id }
      );

      // Si jamais fait de scraping complet, le faire
      if (!lastFullScrape) {
        console.log("🎯 Premier scraping complet détecté");
        performBackgroundScraping("full");
      } else {
        // Sinon, faire un scraping partiel si éligible
        const { data: canScrape } = await supabase.rpc("can_user_scrape", {
          p_user_id: user.id,
        });

        if (canScrape) {
          console.log("📅 Scraping quotidien partiel");
          performBackgroundScraping("partial");
        }
      }
    }
  }
}, 60 * 60 * 1000); // Vérifier toutes les heures

export { scrapingStatus, performBackgroundScraping };
