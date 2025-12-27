# Ad Research Tool - Competitor Research Improvements

## Goal
Enhance the ad research tool with deeper analysis capabilities and expanded data collection for more effective competitor research.

## Current State
- Scrapes Meta Ad Library (20 ads max, 5 scrolls)
- Captures: advertiser, ad copy, CTA, landing URL, start date, screenshots
- Basic analysis: CTA distribution, top advertisers, common phrases, power words, offer detection
- Features: favorites, CSV export, real-time progress

---

## Phase 1: Expand Data Collection

### 1.1 Increase Ad Capture Limit
**Files:** `server/scrapers/meta.js`, `client/src/pages/Search.jsx`

- Add "Number of ads" slider to search form (25, 50, 100)
- Increase MAX_SCROLLS from 5 to 15
- Remove hardcoded 20 ad limit
- Add timeout handling for large scrapes (extend from 30s)
- Show estimated scrape time based on selection

### 1.2 Ad Longevity Tracking
**Files:** `server/scrapers/meta.js`, `server/db/index.js`, `client/src/components/AdCard.jsx`, `client/src/pages/Results.jsx`

- Calculate `days_running` from start_date
- Add visual badge: "Running X days" with color coding
  - Green (30+ days) = proven winner
  - Yellow (7-30 days) = established
  - Gray (<7 days) = new
- Add "Sort by longevity" option
- Add to analysis: "Longest running ads" section

### 1.3 Enhanced Metadata Extraction
**Files:** `server/scrapers/meta.js`

- Detect ad format (image, video, carousel) from DOM structure
- Extract any visible audience/targeting hints
- Capture ad ID for deduplication on re-scrapes
- Clean up advertiser name extraction (handle edge cases)

---

## Phase 2: AI-Powered Analysis

### 2.1 Claude API Integration
**Files:** `server/index.js` (new endpoint), `server/ai/analyze.js` (new file), `client/src/pages/Results.jsx`

- Add Anthropic SDK dependency
- Create `/api/ads/:id/analyze` endpoint
- Create `/api/search/:id/analyze-all` for batch analysis
- Store insights in new `ad_insights` table

**Analysis types to implement:**
- **Messaging Theme**: What's the core value proposition?
- **Emotional Appeal**: Fear, aspiration, urgency, social proof, etc.
- **Target Audience**: Who is this ad speaking to?
- **Copywriting Techniques**: Hooks, CTAs, persuasion patterns
- **Competitive Positioning**: How do they differentiate?

### 2.2 Analysis UI
**Files:** `client/src/pages/Results.jsx`, `client/src/components/AdCard.jsx`

- Add "Analyze with AI" button in ad modal
- Show loading state during analysis
- Display insights in expandable sections
- Add "Analyze All Ads" button for batch processing
- Cache results to avoid re-analyzing

### 2.3 Aggregate AI Insights
**Files:** `client/src/pages/Results.jsx`

- After batch analysis, generate summary:
  - Most common messaging themes across competitors
  - Emotional appeal breakdown (pie chart)
  - Audience targeting patterns
  - Top copywriting techniques used

---

## Phase 3: Landing Page Intelligence

### 3.1 Landing Page Scraper
**Files:** `server/scrapers/landing.js` (new file), `server/db/index.js`

- Create new `landing_pages` table
- Use Playwright to visit landing URLs
- Capture screenshot of above-fold content
- Extract: page title, meta description, H1, primary CTA
- Handle redirects and tracking URL unwrapping
- Cache by URL (don't re-scrape same pages)

### 3.2 Landing Page Preview
**Files:** `client/src/pages/Results.jsx`

- Add "View Landing Page" tab in ad modal
- Show landing page screenshot
- Display extracted headline and CTA
- Compare ad messaging vs landing page messaging
- Add to analysis: "Landing Page Domains" with more detail

---

## Phase 4: Enhanced Filtering & Organization

### 4.1 Results Filtering
**Files:** `client/src/pages/Results.jsx`

- Add filter bar above ad grid
- Filters: advertiser (multi-select), date range, CTA type, days running
- Add text search within ad copy
- Add "Favorites only" toggle
- Persist filters in URL params

### 4.2 Advertiser Deep Dive
**Files:** `client/src/pages/Advertiser.jsx` (new), `server/index.js`, `client/src/App.jsx`

- Add `/advertiser/:name` route
- Show all ads from one advertiser across all searches
- Dedicated analysis for single competitor:
  - Their CTA preferences
  - Messaging evolution over time
  - Offer patterns
  - Landing page strategy

---

## Database Schema Additions

```sql
-- Add to ads table
ALTER TABLE ads ADD COLUMN days_running INTEGER;
ALTER TABLE ads ADD COLUMN ad_format TEXT DEFAULT 'image';
ALTER TABLE ads ADD COLUMN ad_hash TEXT; -- for dedup

-- New tables
CREATE TABLE ad_insights (
  id INTEGER PRIMARY KEY,
  ad_id INTEGER NOT NULL,
  insight_type TEXT NOT NULL,
  insight_data TEXT NOT NULL, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ad_id) REFERENCES ads(id)
);

CREATE TABLE landing_pages (
  id INTEGER PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  screenshot_path TEXT,
  title TEXT,
  description TEXT,
  headline TEXT,
  primary_cta TEXT,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Link ads to landing pages
ALTER TABLE ads ADD COLUMN landing_page_id INTEGER REFERENCES landing_pages(id);
```

---

## New Dependencies

```json
{
  "server": {
    "@anthropic-ai/sdk": "latest"
  }
}
```

**Environment variable needed:** `ANTHROPIC_API_KEY`

---

## Implementation Order

1. **Phase 1.1-1.2** - More ads + longevity (foundational, no new deps)
2. **Phase 2.1-2.2** - AI analysis (high value, uses existing data)
3. **Phase 4.1** - Filtering (makes large datasets usable)
4. **Phase 3** - Landing pages (extends data collection)
5. **Phase 2.3 + 4.2** - Aggregate insights + advertiser view

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `server/scrapers/meta.js` | More scrolls, longevity calc, format detection |
| `server/db/index.js` | New tables, schema updates |
| `server/index.js` | New API endpoints |
| `server/ai/analyze.js` | NEW - Claude API integration |
| `server/scrapers/landing.js` | NEW - Landing page scraper |
| `client/src/pages/Search.jsx` | Ad count selector |
| `client/src/pages/Results.jsx` | Filters, AI UI, landing preview |
| `client/src/components/AdCard.jsx` | Longevity badge |
| `client/src/pages/Advertiser.jsx` | NEW - Advertiser profile page |
| `client/src/App.jsx` | New routes |
