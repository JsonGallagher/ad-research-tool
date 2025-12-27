import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb, getDb, toggleFavorite, getFavorites, saveInsight, getInsightsForAd, getLatestInsightForAd, getAdById, getAdsForSearch } from './db/index.js';
import { scrapeMetaAds } from './scrapers/meta.js';
import { analyzeAd, analyzeMultipleAds, generateAggregateInsights } from './ai/analyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/screenshots', express.static(join(__dirname, '..', 'screenshots')));

// Initialize database
initDb();

// Root route
app.get('/', (req, res) => {
  const db = getDb();
  const searchCount = db.prepare('SELECT COUNT(*) as count FROM searches').get().count;
  const adCount = db.prepare('SELECT COUNT(*) as count FROM ads').get().count;

  res.json({
    status: 'Ad Research Tool API',
    endpoints: {
      'POST /api/search': 'Start a new ad search',
      'GET /api/searches': 'List all searches',
      'GET /api/searches/:id/ads': 'Get ads for a search',
      'GET /api/ads': 'Get all ads',
      'GET /api/events/:searchId': 'SSE stream for search progress'
    },
    stats: {
      totalSearches: searchCount,
      totalAds: adCount
    }
  });
});

// Store active SSE connections
const clients = new Map();

// SSE endpoint for real-time updates
app.get('/api/events/:searchId', (req, res) => {
  const { searchId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.set(searchId, res);

  req.on('close', () => {
    clients.delete(searchId);
  });
});

// Send SSE message to client
export function sendProgress(searchId, data) {
  const client = clients.get(searchId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// Start a new search
app.post('/api/search', async (req, res) => {
  const { industry, location, keywords, adCount = 25, filterRelevant = false } = req.body;

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO searches (industry, location, keywords)
    VALUES (?, ?, ?)
  `).run(industry, location, keywords);

  const searchId = result.lastInsertRowid.toString();

  res.json({ searchId, status: 'started' });

  // Start scraping in background
  scrapeMetaAds(searchId, { industry, location, keywords, adCount, filterRelevant }, sendProgress)
    .catch(err => {
      console.error('Scraping error:', err);
      sendProgress(searchId, { type: 'error', message: err.message });
    });
});

// Get search results
app.get('/api/searches', (req, res) => {
  const db = getDb();
  const searches = db.prepare('SELECT * FROM searches ORDER BY created_at DESC').all();
  res.json(searches);
});

// Get ads for a search
app.get('/api/searches/:searchId/ads', (req, res) => {
  const { searchId } = req.params;
  const db = getDb();
  const ads = db.prepare('SELECT * FROM ads WHERE search_id = ? ORDER BY created_at DESC').all(searchId);
  res.json(ads);
});

// Get all ads
app.get('/api/ads', (req, res) => {
  const db = getDb();
  const { platform, advertiser } = req.query;

  let query = 'SELECT * FROM ads WHERE 1=1';
  const params = [];

  if (platform) {
    query += ' AND platform = ?';
    params.push(platform);
  }
  if (advertiser) {
    query += ' AND advertiser_name LIKE ?';
    params.push(`%${advertiser}%`);
  }

  query += ' ORDER BY created_at DESC';

  const ads = db.prepare(query).all(...params);
  res.json(ads);
});

// Toggle favorite status
app.post('/api/ads/:id/favorite', (req, res) => {
  const { id } = req.params;
  const newValue = toggleFavorite(id);
  if (newValue === null) {
    return res.status(404).json({ error: 'Ad not found' });
  }
  res.json({ id, is_favorite: newValue });
});

// Get all favorites
app.get('/api/favorites', (req, res) => {
  const favorites = getFavorites();
  res.json(favorites);
});

// Get all ads for a specific advertiser (across all searches)
app.get('/api/advertiser/:name', (req, res) => {
  const { name } = req.params;
  const db = getDb();

  // Get all ads from this advertiser
  const ads = db.prepare(`
    SELECT ads.*, searches.industry, searches.keywords
    FROM ads
    LEFT JOIN searches ON ads.search_id = searches.id
    WHERE LOWER(ads.advertiser_name) = LOWER(?)
    ORDER BY ads.start_date DESC
  `).all(name);

  if (ads.length === 0) {
    return res.status(404).json({ error: 'No ads found for this advertiser' });
  }

  // Get AI insights for these ads
  const adIds = ads.map(a => a.id);
  const insights = db.prepare(`
    SELECT ad_id, insight_type, insight_data, created_at
    FROM ad_insights
    WHERE ad_id IN (${adIds.map(() => '?').join(',')})
    AND insight_type = 'full_analysis'
    ORDER BY created_at DESC
  `).all(...adIds);

  // Map insights to ads
  const insightMap = {};
  insights.forEach(i => {
    if (!insightMap[i.ad_id]) {
      try {
        insightMap[i.ad_id] = JSON.parse(i.insight_data);
      } catch {
        insightMap[i.ad_id] = null;
      }
    }
  });

  // Calculate aggregate stats
  const ctaCounts = {};
  const landingDomains = {};
  let totalDaysRunning = 0;
  let adsWithDates = 0;

  ads.forEach(ad => {
    // CTA tracking
    if (ad.cta_text) {
      ctaCounts[ad.cta_text] = (ctaCounts[ad.cta_text] || 0) + 1;
    }

    // Landing domain tracking
    if (ad.landing_url) {
      try {
        const domain = new URL(ad.landing_url).hostname.replace('www.', '');
        landingDomains[domain] = (landingDomains[domain] || 0) + 1;
      } catch {}
    }

    // Days running calculation
    if (ad.start_date) {
      const start = new Date(ad.start_date);
      if (!isNaN(start.getTime())) {
        const days = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
          totalDaysRunning += days;
          adsWithDates++;
        }
      }
    }
  });

  // Format stats
  const ctaDistribution = Object.entries(ctaCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cta, count]) => ({ cta, count, percent: Math.round((count / ads.length) * 100) }));

  const domains = Object.entries(landingDomains)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, count }));

  res.json({
    advertiser: name,
    totalAds: ads.length,
    avgDaysRunning: adsWithDates > 0 ? Math.round(totalDaysRunning / adsWithDates) : 0,
    ctaDistribution,
    landingDomains: domains,
    ads: ads.map(ad => ({
      ...ad,
      analysis: insightMap[ad.id] || null
    }))
  });
});

// AI Analysis endpoints

// Analyze a single ad
app.post('/api/ads/:id/analyze', async (req, res) => {
  const { id } = req.params;
  const { force = false } = req.body || {};

  try {
    const ad = getAdById(id);
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Check for existing analysis unless force refresh
    if (!force) {
      const existingInsight = getLatestInsightForAd(id, 'full_analysis');
      if (existingInsight) {
        return res.json({
          adId: id,
          cached: true,
          analysis: existingInsight.insight_data,
          createdAt: existingInsight.created_at
        });
      }
    }

    // Perform new analysis
    const analysis = await analyzeAd(ad);

    // Save to database
    saveInsight(id, 'full_analysis', analysis);

    res.json({
      adId: id,
      cached: false,
      analysis
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get stored insights for an ad
app.get('/api/ads/:id/insights', (req, res) => {
  const { id } = req.params;

  try {
    const insights = getInsightsForAd(id);
    res.json(insights);
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze all ads in a search
app.post('/api/searches/:searchId/analyze-all', async (req, res) => {
  const { searchId } = req.params;
  const { force = false } = req.body || {};

  try {
    const ads = getAdsForSearch(searchId);
    if (ads.length === 0) {
      return res.status(404).json({ error: 'No ads found for this search' });
    }

    // Filter to only ads that need analysis (unless force)
    let adsToAnalyze = ads;
    if (!force) {
      adsToAnalyze = ads.filter(ad => {
        const existing = getLatestInsightForAd(ad.id, 'full_analysis');
        return !existing;
      });
    }

    if (adsToAnalyze.length === 0) {
      // Return cached results
      const results = ads.map(ad => {
        const insight = getLatestInsightForAd(ad.id, 'full_analysis');
        return {
          adId: ad.id,
          advertiser: ad.advertiser_name,
          analysis: insight?.insight_data || null,
          cached: true
        };
      });
      return res.json({
        total: ads.length,
        analyzed: 0,
        results
      });
    }

    // Analyze new ads
    const newAnalyses = await analyzeMultipleAds(adsToAnalyze);

    // Save new analyses to database
    for (const result of newAnalyses) {
      if (result.analysis && !result.error) {
        saveInsight(result.adId, 'full_analysis', result.analysis);
      }
    }

    // Combine with existing analyses
    const allResults = ads.map(ad => {
      const newResult = newAnalyses.find(r => r.adId === ad.id);
      if (newResult) {
        return { ...newResult, cached: false };
      }
      const existing = getLatestInsightForAd(ad.id, 'full_analysis');
      return {
        adId: ad.id,
        advertiser: ad.advertiser_name,
        analysis: existing?.insight_data || null,
        cached: true
      };
    });

    res.json({
      total: ads.length,
      analyzed: adsToAnalyze.length,
      results: allResults
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate aggregate insights for a search
app.post('/api/searches/:searchId/aggregate-insights', async (req, res) => {
  const { searchId } = req.params;

  try {
    const ads = getAdsForSearch(searchId);
    if (ads.length === 0) {
      return res.status(404).json({ error: 'No ads found for this search' });
    }

    // Get all existing analyses
    const analyses = ads.map(ad => {
      const insight = getLatestInsightForAd(ad.id, 'full_analysis');
      return {
        adId: ad.id,
        advertiser: ad.advertiser_name,
        analysis: insight?.insight_data || null
      };
    }).filter(a => a.analysis);

    if (analyses.length === 0) {
      return res.status(400).json({
        error: 'No analyzed ads found. Run analyze-all first.'
      });
    }

    const aggregateInsights = await generateAggregateInsights(analyses);

    res.json({
      totalAds: ads.length,
      analyzedAds: analyses.length,
      insights: aggregateInsights
    });
  } catch (error) {
    console.error('Aggregate insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
