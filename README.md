# Ad Research Tool

A competitive ad intelligence tool that scrapes Meta Ad Library, captures screenshots, and provides AI-powered analysis of competitor advertising strategies.

## Features

- **Meta Ad Library Scraping** - Automatically browse and capture ads from Facebook/Instagram Ad Library
- **Screenshot Capture** - Save clean screenshots of each ad for reference
- **AI Relevance Filtering** - Optional GPT-4o-mini filter to skip irrelevant ads during scraping
- **Ad Analysis** - AI-powered insights on messaging, emotional appeals, copywriting techniques
- **Advertiser Profiles** - Deep dive into specific advertisers across all your searches
- **Advanced Filtering** - Filter by advertiser, CTA, format, ad age, and favorites
- **Longevity Tracking** - Identify "proven winners" based on how long ads have been running
- **Export** - Download results as CSV

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router
- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Scraping**: Playwright (headless browser automation)
- **AI**: OpenAI GPT-4o-mini

## Prerequisites

- Node.js 18+
- OpenAI API key (optional, for AI features)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd ad-research-tool

# Install all dependencies
npm run install-all

# Install Playwright browsers
cd server && npx playwright install chromium && cd ..
```

## Configuration

Create a `.env` file in the `server` directory:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

The OpenAI key is optional. Without it:
- AI relevance filtering will be skipped
- Ad analysis features will be disabled
- Core scraping functionality works fine

## Usage

```bash
# Start development server (runs both frontend and backend)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Running a Search

1. Select an industry (auto-populates keyword suggestions) or enter custom keywords
2. Choose location (country)
3. Set number of ads to capture (25/50/100)
4. Optionally enable "Filter irrelevant ads with AI"
5. Click "Start Research"

### Analyzing Results

- **Filter ads** by advertiser, CTA type, format, or age
- **Click any ad** to view full details in modal
- **Analyze with AI** to get copywriting insights
- **Click advertiser name** to see all their ads across searches
- **Export to CSV** for further analysis

## Project Structure

```
ad-research-tool/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   └── App.jsx        # Main app with routing
│   └── package.json
├── server/                 # Express backend
│   ├── ai/                # OpenAI integration
│   ├── db/                # SQLite database
│   ├── scrapers/          # Playwright scrapers
│   └── index.js           # API routes
├── screenshots/           # Captured ad images
├── data.db               # SQLite database
└── package.json          # Root package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/search` | Start a new ad search |
| GET | `/api/searches` | List all searches |
| GET | `/api/searches/:id/ads` | Get ads for a search |
| GET | `/api/ads` | Get all ads with filters |
| GET | `/api/advertiser/:name` | Get advertiser profile |
| POST | `/api/ads/:id/analyze` | Analyze ad with AI |
| POST | `/api/ads/:id/favorite` | Toggle favorite |
| GET | `/api/events/:searchId` | SSE stream for progress |

## Supported Locations

- United States, United Kingdom, Canada, Australia
- Germany, France, Spain, Brazil, Mexico

## Tips

- **City-level targeting**: Include city name in keywords (e.g., "Chicago real estate agent")
- **Find proven ads**: Sort by "Longest Running" - ads running 30+ days are likely profitable
- **Use AI filter**: Enable for broad searches to filter out irrelevant results
- **Keyword suggestions**: Click multiple suggestions to build comma-separated search terms

## License

MIT
