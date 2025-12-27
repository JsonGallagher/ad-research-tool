import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdCard from '../components/AdCard'

// Common words to exclude from keyword analysis
// Calculate days running from start date
function calculateDaysRunning(startDate) {
  if (!startDate) return null
  try {
    const start = new Date(startDate)
    if (isNaN(start.getTime())) return null
    const now = new Date()
    const diffTime = now - start
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 0 ? diffDays : null
  } catch {
    return null
  }
}

// Sort options
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'longevity', label: 'Longest Running' },
  { value: 'advertiser', label: 'By Advertiser' },
]

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'your', 'our', 'my',
  'their', 'its', 'as', 'if', 'into', 'about', 'out', 'up', 'down', 'off', 'over',
  'under', 'again', 'then', 'once', 'here', 'there', 'any', 'also', 'get', 'got'
])

export default function Results() {
  const { searchId } = useParams()
  const [ads, setAds] = useState([])
  const [status, setStatus] = useState('connecting')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Connecting to server...')
  const [selectedAd, setSelectedAd] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [sortBy, setSortBy] = useState('newest')

  // AI Analysis state
  const [adAnalysis, setAdAnalysis] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)
  const [aggregateInsights, setAggregateInsights] = useState(null)

  // Filter state
  const [filters, setFilters] = useState({
    searchText: '',
    advertiser: '',
    ctaType: '',
    adFormat: '', // 'image', 'video', 'carousel'
    longevity: '', // 'new', 'established', 'proven'
    favoritesOnly: false
  })
  const [showFilters, setShowFilters] = useState(true) // Show filters by default


  // Get unique advertisers, CTAs, and formats for filter dropdowns
  const filterOptions = useMemo(() => {
    const advertisers = [...new Set(ads.map(a => a.advertiser_name || a.advertiserName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
    const ctas = [...new Set(ads.map(a => a.cta_text || a.ctaText).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
    const formats = [...new Set(ads.map(a => a.media_type || a.mediaType || 'image').filter(Boolean))]
    return { advertisers, ctas, formats }
  }, [ads])

  // Filter ads based on filter state
  const filteredAds = useMemo(() => {
    if (ads.length === 0) return ads

    return ads.filter(ad => {
      // Text search in ad copy
      if (filters.searchText) {
        const copy = (ad.ad_copy || ad.adCopy || '').toLowerCase()
        const advertiser = (ad.advertiser_name || ad.advertiserName || '').toLowerCase()
        const searchLower = filters.searchText.toLowerCase()
        if (!copy.includes(searchLower) && !advertiser.includes(searchLower)) {
          return false
        }
      }

      // Advertiser filter
      if (filters.advertiser) {
        const adAdvertiser = ad.advertiser_name || ad.advertiserName
        if (adAdvertiser !== filters.advertiser) return false
      }

      // CTA filter
      if (filters.ctaType) {
        const adCta = ad.cta_text || ad.ctaText
        if (adCta !== filters.ctaType) return false
      }

      // Ad format filter
      if (filters.adFormat) {
        const format = ad.media_type || ad.mediaType || 'image'
        if (format !== filters.adFormat) return false
      }

      // Longevity filter
      if (filters.longevity) {
        const days = calculateDaysRunning(ad.start_date || ad.startDate) || 0
        if (filters.longevity === 'proven' && days < 30) return false
        if (filters.longevity === 'established' && (days < 7 || days >= 30)) return false
        if (filters.longevity === 'new' && days >= 7) return false
      }

      // Favorites only
      if (filters.favoritesOnly && !ad.is_favorite) return false

      return true
    })
  }, [ads, filters])

  // Sort filtered ads based on selected option
  const sortedAds = useMemo(() => {
    if (filteredAds.length === 0) return filteredAds

    const sorted = [...filteredAds]
    switch (sortBy) {
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.start_date || a.startDate || 0)
          const dateB = new Date(b.start_date || b.startDate || 0)
          return dateA - dateB
        })
      case 'longevity':
        return sorted.sort((a, b) => {
          const daysA = calculateDaysRunning(a.start_date || a.startDate) || 0
          const daysB = calculateDaysRunning(b.start_date || b.startDate) || 0
          return daysB - daysA
        })
      case 'advertiser':
        return sorted.sort((a, b) => {
          const nameA = (a.advertiser_name || a.advertiserName || '').toLowerCase()
          const nameB = (b.advertiser_name || b.advertiserName || '').toLowerCase()
          return nameA.localeCompare(nameB)
        })
      case 'newest':
      default:
        return sorted.sort((a, b) => {
          const dateA = new Date(a.start_date || a.startDate || 0)
          const dateB = new Date(b.start_date || b.startDate || 0)
          return dateB - dateA
        })
    }
  }, [filteredAds, sortBy])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.searchText) count++
    if (filters.advertiser) count++
    if (filters.ctaType) count++
    if (filters.adFormat) count++
    if (filters.longevity) count++
    if (filters.favoritesOnly) count++
    return count
  }, [filters])

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      searchText: '',
      advertiser: '',
      ctaType: '',
      adFormat: '',
      longevity: '',
      favoritesOnly: false
    })
  }

  // Comprehensive ad analysis
  const analysis = useMemo(() => {
    if (ads.length === 0) return null

    const wordCounts = {}
    const phraseCounts = {}
    const advertiserCounts = {}
    const ctaCounts = {}
    const domainCounts = {}
    const copyLengths = []
    const offerPatterns = []
    const longevityData = []

    // Power words to detect
    const POWER_WORDS = ['free', 'new', 'proven', 'guaranteed', 'exclusive', 'limited',
      'save', 'discount', 'bonus', 'secret', 'instant', 'easy', 'fast', 'best',
      'amazing', 'ultimate', 'premium', 'professional', 'expert', 'trusted']
    const powerWordCounts = {}

    // Offer patterns to detect
    const OFFER_PATTERNS = [
      { pattern: /(\d+)%\s*off/gi, type: 'Percentage Off' },
      { pattern: /free\s+(shipping|trial|consultation|quote|estimate)/gi, type: 'Free Offer' },
      { pattern: /\$\d+\s*off/gi, type: 'Dollar Off' },
      { pattern: /buy\s*\d*\s*get\s*\d*/gi, type: 'BOGO' },
      { pattern: /limited\s*time/gi, type: 'Urgency' },
      { pattern: /today\s*only/gi, type: 'Urgency' },
      { pattern: /ends\s*(soon|today|tomorrow)/gi, type: 'Urgency' },
      { pattern: /no\s*(credit|money)\s*(check|down)/gi, type: 'Financing' },
    ]

    ads.forEach(ad => {
      // Track advertisers
      const name = ad.advertiser_name || ad.advertiserName
      if (name && name !== 'Unknown') {
        advertiserCounts[name] = (advertiserCounts[name] || 0) + 1
      }

      // Track longevity
      const startDate = ad.start_date || ad.startDate
      const daysRunning = calculateDaysRunning(startDate)
      if (daysRunning !== null) {
        longevityData.push({
          id: ad.id,
          advertiser: name,
          days: daysRunning,
          startDate
        })
      }

      // Track CTAs
      const cta = ad.cta_text || ad.ctaText
      if (cta) {
        const normalizedCta = cta.trim()
        ctaCounts[normalizedCta] = (ctaCounts[normalizedCta] || 0) + 1
      }

      // Track landing page domains
      const url = ad.landing_url || ad.landingUrl
      if (url) {
        try {
          const domain = new URL(url).hostname.replace('www.', '')
          domainCounts[domain] = (domainCounts[domain] || 0) + 1
        } catch {}
      }

      // Analyze ad copy
      const copy = ad.ad_copy || ad.adCopy || ''
      const copyLower = copy.toLowerCase()

      // Word count for length analysis
      const wordCount = copy.split(/\s+/).filter(w => w.length > 0).length
      if (wordCount > 0) copyLengths.push(wordCount)

      // Extract words
      const words = copyLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))

      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
        if (POWER_WORDS.includes(word)) {
          powerWordCounts[word] = (powerWordCounts[word] || 0) + 1
        }
      })

      // Extract bigrams (2-word phrases)
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`
        if (words[i].length > 2 && words[i + 1].length > 2) {
          phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1
        }
      }

      // Detect offer patterns
      OFFER_PATTERNS.forEach(({ pattern, type }) => {
        const matches = copy.match(pattern)
        if (matches) {
          matches.forEach(match => {
            offerPatterns.push({ type, match: match.trim(), advertiser: name })
          })
        }
      })
    })

    // Process results
    const topKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }))

    const topPhrases = Object.entries(phraseCounts)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([phrase, count]) => ({ phrase, count }))

    const topAdvertisers = Object.entries(advertiserCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    const ctaDistribution = Object.entries(ctaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cta, count]) => ({ cta, count, percent: Math.round((count / ads.length) * 100) }))

    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count }))

    const topPowerWords = Object.entries(powerWordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word, count]) => ({ word, count }))

    // Offer type summary
    const offerTypeCounts = {}
    offerPatterns.forEach(({ type }) => {
      offerTypeCounts[type] = (offerTypeCounts[type] || 0) + 1
    })
    const offerSummary = Object.entries(offerTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }))

    // Copy length stats
    const avgLength = copyLengths.length > 0
      ? Math.round(copyLengths.reduce((a, b) => a + b, 0) / copyLengths.length)
      : 0
    const minLength = copyLengths.length > 0 ? Math.min(...copyLengths) : 0
    const maxLength = copyLengths.length > 0 ? Math.max(...copyLengths) : 0

    // Longevity stats - deduplicate by advertiser (keep longest-running ad per advertiser)
    const advertiserBestAd = {}
    const advertiserAdCount = {}
    longevityData.forEach(item => {
      const key = (item.advertiser || 'Unknown').toLowerCase()
      advertiserAdCount[key] = (advertiserAdCount[key] || 0) + 1
      if (!advertiserBestAd[key] || item.days > advertiserBestAd[key].days) {
        advertiserBestAd[key] = item
      }
    })
    const longestRunning = Object.values(advertiserBestAd)
      .map(item => ({
        ...item,
        adCount: advertiserAdCount[(item.advertiser || 'Unknown').toLowerCase()]
      }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 8)

    const avgDaysRunning = longevityData.length > 0
      ? Math.round(longevityData.reduce((sum, d) => sum + d.days, 0) / longevityData.length)
      : 0

    const provenAds = longevityData.filter(d => d.days >= 30).length
    const establishedAds = longevityData.filter(d => d.days >= 7 && d.days < 30).length
    const newAds = longevityData.filter(d => d.days < 7).length

    return {
      totalAds: ads.length,
      uniqueAdvertisers: Object.keys(advertiserCounts).length,
      topKeywords,
      topPhrases,
      topAdvertisers,
      ctaDistribution,
      topDomains,
      topPowerWords,
      offerSummary,
      copyLength: { avg: avgLength, min: minLength, max: maxLength },
      hasOffers: offerPatterns.length > 0,
      longevity: {
        longest: longestRunning,
        avgDays: avgDaysRunning,
        proven: provenAds,
        established: establishedAds,
        new: newAds
      }
    }
  }, [ads])

  // Export to CSV
  const exportToCSV = () => {
    if (ads.length === 0) return

    // Helper to clean text - remove emojis and special chars for Excel compatibility
    const cleanText = (text) => {
      if (!text) return ''
      return text
        // Remove emojis and special unicode characters
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
        .replace(/[\u{FE00}-\u{FEFF}]/gu, '')   // Variation Selectors
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols Extended-A
        .replace(/[\u{200B}-\u{200D}]/gu, '')   // Zero-width chars
        .replace(/[\u{FE0F}]/gu, '')            // Variation selector
        .replace(/"/g, '""')                     // Escape quotes for CSV
        .replace(/\n/g, ' ')                     // Replace newlines
        .trim()
    }

    const headers = ['Advertiser', 'Ad Copy', 'CTA', 'Landing URL', 'Start Date', 'Platform', 'Favorite', 'Screenshot']
    const rows = ads.map(ad => [
      cleanText(ad.advertiser_name || ad.advertiserName || 'Unknown'),
      cleanText(ad.ad_copy || ad.adCopy || ''),
      ad.cta_text || ad.ctaText || '',
      ad.landing_url || ad.landingUrl || '',
      ad.start_date || ad.startDate || '',
      ad.platform || 'meta',
      ad.is_favorite ? 'Yes' : 'No',
      ad.screenshot_path || ad.screenshotPath || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Add UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ad-research-${searchId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Keyboard navigation for modal
  useEffect(() => {
    if (!selectedAd || sortedAds.length === 0) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const nextIndex = (selectedIndex + 1) % sortedAds.length
        setSelectedIndex(nextIndex)
        setSelectedAd(sortedAds[nextIndex])
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const prevIndex = selectedIndex <= 0 ? sortedAds.length - 1 : selectedIndex - 1
        setSelectedIndex(prevIndex)
        setSelectedAd(sortedAds[prevIndex])
      } else if (e.key === 'Escape') {
        setSelectedAd(null)
        setSelectedIndex(-1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAd, selectedIndex, sortedAds])

  // Helper to select an ad with index tracking
  const selectAd = (ad, index) => {
    setSelectedAd(ad)
    setSelectedIndex(index)
  }

  useEffect(() => {
    if (!searchId) {
      // Load all ads if no search ID
      loadAllAds()
      return
    }

    // Connect to SSE for real-time updates
    const eventSource = new EventSource(`/api/events/${searchId}`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'status':
          setStatus('running')
          setMessage(data.message)
          if (data.step && data.totalSteps) {
            setProgress((data.step / data.totalSteps) * 50)
          }
          break

        case 'scroll':
          setMessage(data.message)
          setProgress(25 + (data.progress / 100) * 25)
          break

        case 'ad_captured':
          setMessage(data.message)
          setProgress(50 + (data.progress / 100) * 50)
          setAds(prev => [...prev, data.ad])
          break

        case 'complete':
          setStatus('complete')
          setMessage(data.message)
          setProgress(100)
          eventSource.close()
          break

        case 'error':
          setStatus('error')
          setMessage(data.message)
          eventSource.close()
          break

        case 'warning':
          console.warn(data.message)
          break
      }
    }

    eventSource.onerror = () => {
      if (status !== 'complete' && status !== 'error') {
        setStatus('error')
        setMessage('Connection lost. Refreshing...')
        // Try to load existing ads
        loadAdsForSearch(searchId)
      }
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [searchId])

  const loadAllAds = async () => {
    try {
      const response = await fetch('/api/ads')
      const data = await response.json()
      setAds(data)
      setStatus('complete')
      setMessage(`Showing ${data.length} ads`)
    } catch (error) {
      console.error('Error loading ads:', error)
    }
  }

  const loadAdsForSearch = async (id) => {
    try {
      const response = await fetch(`/api/searches/${id}/ads`)
      const data = await response.json()
      setAds(data)
      setStatus('complete')
      setMessage(`Loaded ${data.length} ads`)
    } catch (error) {
      console.error('Error loading ads:', error)
    }
  }

  // AI Analysis functions
  const analyzeCurrentAd = async () => {
    console.log('analyzeCurrentAd called, selectedAd:', selectedAd)
    if (!selectedAd?.id) {
      console.log('No selectedAd.id, returning early')
      return
    }

    setIsAnalyzing(true)
    setAdAnalysis(null)

    try {
      console.log('Making API call to /api/ads/' + selectedAd.id + '/analyze')
      const response = await fetch(`/api/ads/${selectedAd.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('API response data:', data)
      if (data.error) {
        setAdAnalysis({ error: data.error })
      } else {
        console.log('Setting adAnalysis to:', data.analysis)
        setAdAnalysis(data.analysis)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setAdAnalysis({ error: error.message })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzeAllAds = async () => {
    if (!searchId || batchAnalyzing) return

    setBatchAnalyzing(true)
    setBatchProgress({ current: 0, total: ads.length })

    try {
      const response = await fetch(`/api/searches/${searchId}/analyze-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      setBatchProgress({ current: data.analyzed, total: data.total, complete: true })

      // Now get aggregate insights
      const aggResponse = await fetch(`/api/searches/${searchId}/aggregate-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const aggData = await aggResponse.json()
      if (!aggData.error) {
        setAggregateInsights(aggData.insights)
      }
    } catch (error) {
      console.error('Batch analysis error:', error)
    } finally {
      setBatchAnalyzing(false)
    }
  }

  // Clear analysis when changing ads
  useEffect(() => {
    setAdAnalysis(null)
  }, [selectedAd?.id])

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            &larr; New Search
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">
            Research Results
          </h2>
        </div>

        {status === 'complete' && ads.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={analyzeAllAds}
              disabled={batchAnalyzing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                batchAnalyzing
                  ? 'bg-purple-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white`}
            >
              {batchAnalyzing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyze All with AI
                </>
              )}
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      {status === 'complete' && ads.length > 0 && (
        <div className="mb-6">
          {/* Filter Toggle Button */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  Showing {sortedAds.length} of {ads.length} ads
                </span>
                <button
                  onClick={clearFilters}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Text Search */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Search in ads</label>
                  <input
                    type="text"
                    value={filters.searchText}
                    onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                    placeholder="Search ad copy..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Advertiser Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Advertiser</label>
                  <select
                    value={filters.advertiser}
                    onChange={(e) => setFilters({ ...filters, advertiser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All advertisers</option>
                    {filterOptions.advertisers.map(adv => (
                      <option key={adv} value={adv}>{adv}</option>
                    ))}
                  </select>
                </div>

                {/* CTA Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CTA Type</label>
                  <select
                    value={filters.ctaType}
                    onChange={(e) => setFilters({ ...filters, ctaType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All CTAs</option>
                    {filterOptions.ctas.map(cta => (
                      <option key={cta} value={cta}>{cta}</option>
                    ))}
                  </select>
                </div>

                {/* Ad Format Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Format</label>
                  <select
                    value={filters.adFormat}
                    onChange={(e) => setFilters({ ...filters, adFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Formats</option>
                    {filterOptions.formats.map(format => (
                      <option key={format} value={format} className="capitalize">{format}</option>
                    ))}
                  </select>
                </div>

                {/* Longevity Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ad Age</label>
                  <select
                    value={filters.longevity}
                    onChange={(e) => setFilters({ ...filters, longevity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Any age</option>
                    <option value="proven">Proven (30+ days)</option>
                    <option value="established">Established (7-30 days)</option>
                    <option value="new">New (&lt;7 days)</option>
                  </select>
                </div>

                {/* Favorites Toggle */}
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.favoritesOnly}
                      onChange={(e) => setFilters({ ...filters, favoritesOnly: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Favorites only</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comprehensive Analysis Dashboard */}
      {status === 'complete' && analysis && (
        <div className="mb-6 space-y-4">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <div className="text-3xl font-bold">{analysis.totalAds}</div>
              <div className="text-blue-100 text-sm">Total Ads</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
              <div className="text-3xl font-bold">{analysis.uniqueAdvertisers}</div>
              <div className="text-purple-100 text-sm">Advertisers</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
              <div className="text-3xl font-bold">{analysis.copyLength.avg}</div>
              <div className="text-green-100 text-sm">Avg Words/Ad</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
              <div className="text-3xl font-bold">{analysis.ctaDistribution.length}</div>
              <div className="text-orange-100 text-sm">CTA Types</div>
            </div>
          </div>

          {/* Longevity Overview - Focus on winners */}
          {analysis.longevity && analysis.longevity.longest.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Proven Winners
                <span className="text-xs font-normal text-gray-500 ml-2">(Ads running longest = likely profitable)</span>
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                These ads have been running the longest in your results. Long-running ads typically indicate profitability - study their copy, offers, and angles.
              </p>
              <div className="space-y-2">
                {analysis.longevity.longest.map((item, i) => (
                  <Link
                    key={item.id || i}
                    to={`/advertiser/${encodeURIComponent(item.advertiser || 'Unknown')}`}
                    className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-gray-300 text-gray-700' :
                        i === 2 ? 'bg-amber-600 text-white' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-medium text-gray-800 group-hover:text-blue-600">{item.advertiser || 'Unknown'}</span>
                        {item.adCount > 1 && (
                          <span className="text-xs text-gray-400 ml-2">({item.adCount} ads)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                        {item.days} days
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
              {analysis.longevity.proven > 0 && (
                <p className="text-xs text-emerald-700 mt-3 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {analysis.longevity.proven} ad{analysis.longevity.proven > 1 ? 's' : ''} running 30+ days in this sample
                </p>
              )}
            </div>
          )}

          {/* Main Analysis Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CTA Distribution */}
            {analysis.ctaDistribution.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  CTA Distribution
                </h3>
                <div className="space-y-3">
                  {analysis.ctaDistribution.map(({ cta, count, percent }) => (
                    <div key={cta}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{cta}</span>
                        <span className="text-gray-500">{count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-2.5 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Advertisers */}
            {analysis.topAdvertisers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Top Advertisers
                </h3>
                <div className="space-y-2">
                  {analysis.topAdvertisers.map(({ name, count }, i) => (
                    <Link
                      key={name}
                      to={`/advertiser/${encodeURIComponent(name)}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors group"
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-800 truncate group-hover:text-blue-600">{name}</span>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{count} ads</span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Common Phrases */}
            {analysis.topPhrases.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Common Phrases
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.topPhrases.map(({ phrase, count }) => (
                    <span
                      key={phrase}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium"
                    >
                      "{phrase}"
                      <span className="text-green-500 text-xs bg-green-100 px-1.5 py-0.5 rounded">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Power Words & Keywords */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Power Words & Keywords
              </h3>
              {analysis.topPowerWords.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Persuasive Words</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.topPowerWords.map(({ word, count }) => (
                      <span
                        key={word}
                        className="px-2.5 py-1 bg-red-50 text-red-700 rounded-md text-sm font-medium"
                      >
                        {word} <span className="text-red-400">({count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Top Keywords</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.topKeywords.map(({ word, count }) => (
                    <span
                      key={word}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-sm"
                    >
                      {word} <span className="text-blue-400">({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row - Offers & Domains */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Offers Detected */}
            {analysis.offerSummary.length > 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  Offers Detected
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.offerSummary.map(({ type, count }) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-800 rounded-lg text-sm font-medium shadow-sm"
                    >
                      {type}
                      <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-xs">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Landing Page Domains */}
            {analysis.topDomains.length > 0 && (
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Landing Page Domains
                </h3>
                <div className="space-y-2">
                  {analysis.topDomains.map(({ domain, count }) => (
                    <div key={domain} className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <span className="text-sm font-medium text-gray-700 truncate">{domain}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copy Length Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Ad Copy Length
              </h3>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <div className="text-gray-500">Min</div>
                  <div className="font-bold text-gray-900">{analysis.copyLength.min} words</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">Average</div>
                  <div className="font-bold text-indigo-600 text-lg">{analysis.copyLength.avg} words</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">Max</div>
                  <div className="font-bold text-gray-900">{analysis.copyLength.max} words</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Aggregate Insights */}
          {aggregateInsights && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI-Powered Competitive Insights
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dominant Themes */}
                {aggregateInsights.dominantThemes && (
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Dominant Messaging Themes</h4>
                    <div className="flex flex-wrap gap-2">
                      {aggregateInsights.dominantThemes.map((theme, i) => (
                        <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-sm">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Techniques */}
                {aggregateInsights.topTechniques && (
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Top Copywriting Techniques</h4>
                    <div className="flex flex-wrap gap-2">
                      {aggregateInsights.topTechniques.map((tech, i) => (
                        <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md text-sm">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audience Patterns */}
                {aggregateInsights.audiencePatterns && (
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Target Audience Patterns</h4>
                    <p className="text-gray-700 text-sm">{aggregateInsights.audiencePatterns}</p>
                  </div>
                )}

                {/* Competitive Landscape */}
                {aggregateInsights.competitiveLandscape && (
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Competitive Landscape</h4>
                    <p className="text-gray-700 text-sm">{aggregateInsights.competitiveLandscape}</p>
                  </div>
                )}

                {/* Opportunity Gaps */}
                {aggregateInsights.opportunityGaps && aggregateInsights.opportunityGaps.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm md:col-span-2">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Opportunity Gaps</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {aggregateInsights.opportunityGaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key Takeaways */}
                {aggregateInsights.keyTakeaways && aggregateInsights.keyTakeaways.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 shadow-sm md:col-span-2 border border-green-200">
                    <h4 className="text-sm font-medium text-green-800 mb-2">Key Takeaways for Your Ads</h4>
                    <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                      {aggregateInsights.keyTakeaways.map((takeaway, i) => (
                        <li key={i}>{takeaway}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Batch Analysis Progress */}
          {batchProgress && !batchProgress.complete && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="animate-spin w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-purple-800">Analyzing ads with AI... ({batchProgress.current} / {batchProgress.total})</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {status !== 'complete' && status !== 'error' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="animate-pulse w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
            <span className="text-gray-700">{message}</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {ads.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              {ads.length} ads captured so far...
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{message}</p>
          <Link
            to="/"
            className="text-red-600 hover:text-red-800 text-sm mt-2 inline-block"
          >
            Try again
          </Link>
        </div>
      )}

      {/* Ad Grid */}
      {sortedAds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedAds.map((ad, index) => (
            <AdCard
              key={ad.id || index}
              ad={ad}
              onClick={() => selectAd(ad, index)}
            />
          ))}
        </div>
      ) : status === 'complete' ? (
        <div className="text-center py-12 text-gray-500">
          No ads found. Try different keywords.
        </div>
      ) : null}

      {/* Modal */}
      {selectedAd && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => { setSelectedAd(null); setSelectedIndex(-1) }}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <Link
                  to={`/advertiser/${encodeURIComponent(selectedAd.advertiser_name || selectedAd.advertiserName || 'Unknown')}`}
                  className="font-semibold text-gray-900 text-lg hover:text-blue-600 hover:underline"
                >
                  {selectedAd.advertiser_name || selectedAd.advertiserName || 'Ad Details'}
                </Link>
                <span className="text-sm text-gray-500">
                  {selectedIndex + 1} of {sortedAds.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const prevIndex = selectedIndex <= 0 ? sortedAds.length - 1 : selectedIndex - 1
                    setSelectedIndex(prevIndex)
                    setSelectedAd(sortedAds[prevIndex])
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="Previous (Left Arrow)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const nextIndex = (selectedIndex + 1) % sortedAds.length
                    setSelectedIndex(nextIndex)
                    setSelectedAd(sortedAds[nextIndex])
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="Next (Right Arrow)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => { setSelectedAd(null); setSelectedIndex(-1) }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 ml-2"
                  title="Close (Escape)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4">
              {selectedAd.screenshot_path || selectedAd.screenshotPath ? (
                <div className="bg-gray-50 rounded-lg p-2 mb-4">
                  <img
                    src={`/screenshots/${selectedAd.screenshot_path || selectedAd.screenshotPath}`}
                    alt="Ad screenshot"
                    className="w-full max-h-[50vh] object-contain rounded-lg"
                  />
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">Ad Copy:</span>
                  <p className="text-gray-900 mt-1">
                    {selectedAd.ad_copy || selectedAd.adCopy || 'No copy extracted'}
                  </p>
                </div>

                {(selectedAd.cta_text || selectedAd.ctaText) && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">CTA:</span>
                    <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {selectedAd.cta_text || selectedAd.ctaText}
                    </span>
                  </div>
                )}

                {(selectedAd.landing_url || selectedAd.landingUrl) && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Landing Page:</span>
                    <a
                      href={selectedAd.landing_url || selectedAd.landingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-600 hover:text-blue-800 text-sm mt-1 truncate"
                    >
                      {selectedAd.landing_url || selectedAd.landingUrl}
                    </a>
                  </div>
                )}

                {(selectedAd.start_date || selectedAd.startDate) && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Started:</span>
                    <p className="text-gray-900">{selectedAd.start_date || selectedAd.startDate}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm font-medium text-gray-500">Platform:</span>
                  <p className="text-gray-900 capitalize">{selectedAd.platform || 'meta'}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    if (!selectedAd.id) return
                    try {
                      const res = await fetch(`/api/ads/${selectedAd.id}/favorite`, { method: 'POST' })
                      const data = await res.json()
                      // Update the ad in the list
                      setAds(prev => prev.map(ad =>
                        ad.id === selectedAd.id ? { ...ad, is_favorite: data.is_favorite } : ad
                      ))
                      setSelectedAd(prev => ({ ...prev, is_favorite: data.is_favorite }))
                    } catch (err) {
                      console.error('Error toggling favorite:', err)
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                    selectedAd.is_favorite
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill={selectedAd.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {selectedAd.is_favorite ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={analyzeCurrentAd}
                  disabled={isAnalyzing}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                    isAnalyzing
                      ? 'bg-purple-200 cursor-not-allowed text-purple-600'
                      : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Analyze with AI
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedAd.ad_copy || selectedAd.adCopy || '')
                    alert('Ad copy copied to clipboard!')
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  Copy Ad Text
                </button>
                {(selectedAd.landing_url || selectedAd.landingUrl) && (
                  <a
                    href={selectedAd.landing_url || selectedAd.landingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    Visit Landing Page
                  </a>
                )}
              </div>

              {/* AI Analysis Results */}
              {adAnalysis && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </h4>

                  {adAnalysis.error ? (
                    <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">
                      {adAnalysis.error}
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {/* Score */}
                      {adAnalysis.overallScore && (
                        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                          <div className={`text-2xl font-bold ${
                            adAnalysis.overallScore >= 7 ? 'text-green-600' :
                            adAnalysis.overallScore >= 5 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {adAnalysis.overallScore}/10
                          </div>
                          <div className="text-gray-600">{adAnalysis.scoreReasoning}</div>
                        </div>
                      )}

                      {/* Messaging Theme */}
                      {adAnalysis.messagingTheme && (
                        <div>
                          <span className="font-medium text-gray-700">Messaging Theme:</span>
                          <p className="text-gray-600 mt-1">{adAnalysis.messagingTheme}</p>
                        </div>
                      )}

                      {/* Emotional Appeal */}
                      {adAnalysis.emotionalAppeal && (
                        <div>
                          <span className="font-medium text-gray-700">Emotional Appeal:</span>
                          <span className="ml-2 px-2 py-1 bg-pink-100 text-pink-800 rounded text-xs">
                            {adAnalysis.emotionalAppeal}
                          </span>
                        </div>
                      )}

                      {/* Target Audience */}
                      {adAnalysis.targetAudience && (
                        <div>
                          <span className="font-medium text-gray-700">Target Audience:</span>
                          <p className="text-gray-600 mt-1">{adAnalysis.targetAudience}</p>
                        </div>
                      )}

                      {/* Copywriting Techniques */}
                      {adAnalysis.copywritingTechniques && adAnalysis.copywritingTechniques.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Copywriting Techniques:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {adAnalysis.copywritingTechniques.map((tech, i) => (
                              <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hook Analysis */}
                      {adAnalysis.hookAnalysis && (
                        <div>
                          <span className="font-medium text-gray-700">Hook Analysis:</span>
                          <p className="text-gray-600 mt-1">{adAnalysis.hookAnalysis}</p>
                        </div>
                      )}

                      {/* Suggested Improvements */}
                      {adAnalysis.suggestedImprovements && adAnalysis.suggestedImprovements.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <span className="font-medium text-green-800">Suggested Improvements:</span>
                          <ul className="list-disc list-inside mt-1 text-green-700 space-y-1">
                            {adAnalysis.suggestedImprovements.map((suggestion, i) => (
                              <li key={i}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
