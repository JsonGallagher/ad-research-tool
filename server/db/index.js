import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

export function initDb() {
  const dbPath = join(__dirname, '..', '..', 'data.db');
  db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      industry TEXT,
      location TEXT,
      keywords TEXT,
      status TEXT DEFAULT 'running',
      total_ads INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_id INTEGER,
      platform TEXT DEFAULT 'meta',
      advertiser_name TEXT,
      ad_copy TEXT,
      screenshot_path TEXT,
      ad_url TEXT,
      start_date TEXT,
      end_date TEXT,
      media_type TEXT,
      cta_text TEXT,
      landing_url TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (search_id) REFERENCES searches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ads_search_id ON ads(search_id);
    CREATE INDEX IF NOT EXISTS idx_ads_platform ON ads(platform);
    CREATE INDEX IF NOT EXISTS idx_ads_advertiser ON ads(advertiser_name);
  `);

  // Add columns if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE ads ADD COLUMN cta_text TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE ads ADD COLUMN landing_url TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE ads ADD COLUMN is_favorite INTEGER DEFAULT 0`);
  } catch {}

  // Create index for favorites after ensuring column exists
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ads_favorite ON ads(is_favorite)`);
  } catch {}

  // Create ad_insights table for AI analysis
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER NOT NULL,
      insight_type TEXT NOT NULL,
      insight_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ad_id) REFERENCES ads(id)
    );
    CREATE INDEX IF NOT EXISTS idx_ad_insights_ad_id ON ad_insights(ad_id);
  `);

  // Create landing_pages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      headline TEXT,
      primary_cta TEXT,
      key_messaging TEXT,
      screenshot_path TEXT,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_landing_pages_url ON landing_pages(url);
  `);

  console.log('Database initialized');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function insertAd(searchId, adData) {
  const stmt = db.prepare(`
    INSERT INTO ads (search_id, platform, advertiser_name, ad_copy, screenshot_path, ad_url, start_date, end_date, media_type, cta_text, landing_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    searchId,
    adData.platform || 'meta',
    adData.advertiserName || 'Unknown',
    adData.adCopy || '',
    adData.screenshotPath || '',
    adData.adUrl || '',
    adData.startDate || '',
    adData.endDate || '',
    adData.mediaType || 'image',
    adData.ctaText || '',
    adData.landingUrl || ''
  );

  // Convert BigInt to Number for JSON serialization compatibility
  return Number(result.lastInsertRowid);
}

export function toggleFavorite(adId) {
  const ad = db.prepare('SELECT is_favorite FROM ads WHERE id = ?').get(adId);
  if (!ad) return null;

  const newValue = ad.is_favorite ? 0 : 1;
  db.prepare('UPDATE ads SET is_favorite = ? WHERE id = ?').run(newValue, adId);
  return newValue;
}

export function getFavorites() {
  return db.prepare('SELECT * FROM ads WHERE is_favorite = 1 ORDER BY created_at DESC').all();
}

export function updateSearchStatus(searchId, status, totalAds = null) {
  let query = 'UPDATE searches SET status = ?';
  const params = [status];

  if (totalAds !== null) {
    query += ', total_ads = ?';
    params.push(totalAds);
  }

  query += ' WHERE id = ?';
  params.push(searchId);

  db.prepare(query).run(...params);
}

// AI Insights functions
export function saveInsight(adId, insightType, insightData) {
  const stmt = db.prepare(`
    INSERT INTO ad_insights (ad_id, insight_type, insight_data)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(adId, insightType, JSON.stringify(insightData));
  return result.lastInsertRowid;
}

export function getInsightsForAd(adId) {
  const insights = db.prepare('SELECT * FROM ad_insights WHERE ad_id = ? ORDER BY created_at DESC').all(adId);
  return insights.map(i => ({
    ...i,
    insight_data: JSON.parse(i.insight_data)
  }));
}

export function getLatestInsightForAd(adId, insightType = 'full_analysis') {
  const insight = db.prepare(
    'SELECT * FROM ad_insights WHERE ad_id = ? AND insight_type = ? ORDER BY created_at DESC LIMIT 1'
  ).get(adId, insightType);

  if (insight) {
    return {
      ...insight,
      insight_data: JSON.parse(insight.insight_data)
    };
  }
  return null;
}

export function getAdById(adId) {
  return db.prepare('SELECT * FROM ads WHERE id = ?').get(adId);
}

export function getAdsForSearch(searchId) {
  return db.prepare('SELECT * FROM ads WHERE search_id = ? ORDER BY created_at DESC').all(searchId);
}

// Landing page functions
export function saveLandingPage(pageData) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO landing_pages (url, title, description, headline, primary_cta, key_messaging, screenshot_path, scraped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const result = stmt.run(
    pageData.url,
    pageData.title || '',
    pageData.description || '',
    pageData.headline || '',
    pageData.primaryCta || '',
    JSON.stringify(pageData.keyMessaging || []),
    pageData.screenshotPath || ''
  );

  return result.lastInsertRowid;
}

export function getLandingPageByUrl(url) {
  const page = db.prepare('SELECT * FROM landing_pages WHERE url = ?').get(url);
  if (page && page.key_messaging) {
    try {
      page.key_messaging = JSON.parse(page.key_messaging);
    } catch {
      page.key_messaging = [];
    }
  }
  return page;
}
