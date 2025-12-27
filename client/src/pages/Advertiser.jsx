import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdCard from '../components/AdCard'

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
]

export default function Advertiser() {
  const { name } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAd, setSelectedAd] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [sortBy, setSortBy] = useState('newest')

  // AI Analysis state
  const [adAnalysis, setAdAnalysis] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)


  useEffect(() => {
    const fetchAdvertiser = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/advertiser/${encodeURIComponent(name)}`)
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to load advertiser data')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAdvertiser()
  }, [name])

  // Sort ads
  const sortedAds = useMemo(() => {
    if (!data?.ads) return []
    const sorted = [...data.ads]
    switch (sortBy) {
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.start_date || 0)
          const dateB = new Date(b.start_date || 0)
          return dateA - dateB
        })
      case 'longevity':
        return sorted.sort((a, b) => {
          const daysA = calculateDaysRunning(a.start_date) || 0
          const daysB = calculateDaysRunning(b.start_date) || 0
          return daysB - daysA
        })
      case 'newest':
      default:
        return sorted.sort((a, b) => {
          const dateA = new Date(a.start_date || 0)
          const dateB = new Date(b.start_date || 0)
          return dateB - dateA
        })
    }
  }, [data?.ads, sortBy])

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

  // Clear analysis when changing ads
  useEffect(() => {
    setAdAnalysis(null)
  }, [selectedAd?.id])

  const selectAd = (ad, index) => {
    setSelectedAd(ad)
    setSelectedIndex(index)
    // Load existing analysis if available
    if (ad.analysis) {
      setAdAnalysis(ad.analysis)
    }
  }

  // AI Analysis
  const analyzeCurrentAd = async () => {
    if (!selectedAd?.id) return

    setIsAnalyzing(true)
    setAdAnalysis(null)

    try {
      const response = await fetch(`/api/ads/${selectedAd.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      if (result.error) {
        setAdAnalysis({ error: result.error })
      } else {
        setAdAnalysis(result.analysis)
      }
    } catch (err) {
      setAdAnalysis({ error: err.message })
    } finally {
      setIsAnalyzing(false)
    }
  }


  // Aggregate analysis from all analyzed ads
  const aggregateAnalysis = useMemo(() => {
    if (!data?.ads) return null

    const analyzedAds = data.ads.filter(ad => ad.analysis)
    if (analyzedAds.length === 0) return null

    const techniques = {}
    const appeals = {}
    const themes = []

    analyzedAds.forEach(ad => {
      const a = ad.analysis
      if (a.copywritingTechniques) {
        a.copywritingTechniques.forEach(t => {
          techniques[t] = (techniques[t] || 0) + 1
        })
      }
      if (a.emotionalAppeal) {
        appeals[a.emotionalAppeal] = (appeals[a.emotionalAppeal] || 0) + 1
      }
      if (a.messagingTheme) {
        themes.push(a.messagingTheme)
      }
    })

    return {
      analyzedCount: analyzedAds.length,
      topTechniques: Object.entries(techniques).sort((a, b) => b[1] - a[1]).slice(0, 5),
      emotionalAppeals: Object.entries(appeals).sort((a, b) => b[1] - a[1]),
      avgScore: Math.round(analyzedAds.reduce((sum, ad) => sum + (ad.analysis.overallScore || 0), 0) / analyzedAds.length * 10) / 10
    }
  }, [data?.ads])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">Loading advertiser data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 inline-block">
          <p className="text-red-800 mb-4">{error}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            &larr; Back to search
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
        >
          &larr; Back to Search
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{data.advertiser}</h2>
            <p className="text-gray-500">Advertiser Profile - All ads across searches</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">{data.totalAds}</div>
          <div className="text-blue-100 text-sm">Total Ads</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">{data.avgDaysRunning}</div>
          <div className="text-green-100 text-sm">Avg Days Running</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">{data.ctaDistribution.length}</div>
          <div className="text-purple-100 text-sm">Different CTAs</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">{data.landingDomains.length}</div>
          <div className="text-orange-100 text-sm">Landing Domains</div>
        </div>
      </div>

      {/* Analysis Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* CTA Preferences */}
        {data.ctaDistribution.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              CTA Preferences
            </h3>
            <div className="space-y-3">
              {data.ctaDistribution.map(({ cta, count, percent }) => (
                <div key={cta}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{cta}</span>
                    <span className="text-gray-500">{count} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-400 h-2.5 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Landing Page Strategy */}
        {data.landingDomains.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
              Landing Page Strategy
            </h3>
            <div className="space-y-2">
              {data.landingDomains.map(({ domain, count }) => (
                <div key={domain} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 truncate">{domain}</span>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{count} ads</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis Summary */}
        {aggregateAnalysis && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5 lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Analysis Summary
              <span className="text-xs font-normal text-gray-500">({aggregateAnalysis.analyzedCount} ads analyzed)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Average Score */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Average Ad Score</h4>
                <div className={`text-3xl font-bold ${
                  aggregateAnalysis.avgScore >= 7 ? 'text-green-600' :
                  aggregateAnalysis.avgScore >= 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {aggregateAnalysis.avgScore}/10
                </div>
              </div>

              {/* Emotional Appeals */}
              {aggregateAnalysis.emotionalAppeals.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Emotional Appeals</h4>
                  <div className="flex flex-wrap gap-1">
                    {aggregateAnalysis.emotionalAppeals.map(([appeal, count]) => (
                      <span key={appeal} className="px-2 py-1 bg-pink-100 text-pink-800 rounded text-xs">
                        {appeal} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Techniques */}
              {aggregateAnalysis.topTechniques.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Top Techniques</h4>
                  <div className="flex flex-wrap gap-1">
                    {aggregateAnalysis.topTechniques.map(([tech, count]) => (
                      <span key={tech} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                        {tech} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ad Grid */}
      <h3 className="font-semibold text-gray-900 mb-4">All Ads ({sortedAds.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedAds.map((ad, index) => (
          <AdCard
            key={ad.id || index}
            ad={ad}
            onClick={() => selectAd(ad, index)}
          />
        ))}
      </div>

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
                <h3 className="font-semibold text-gray-900 text-lg">
                  {selectedAd.advertiser_name || 'Ad Details'}
                </h3>
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
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => { setSelectedAd(null); setSelectedIndex(-1) }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 ml-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4">
              {selectedAd.screenshot_path && (
                <div className="bg-gray-50 rounded-lg p-2 mb-4">
                  <img
                    src={`/screenshots/${selectedAd.screenshot_path}`}
                    alt="Ad screenshot"
                    className="w-full max-h-[50vh] object-contain rounded-lg"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">Ad Copy:</span>
                  <p className="text-gray-900 mt-1">{selectedAd.ad_copy || 'No copy extracted'}</p>
                </div>

                {selectedAd.cta_text && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">CTA:</span>
                    <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {selectedAd.cta_text}
                    </span>
                  </div>
                )}

                {selectedAd.landing_url && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Landing Page:</span>
                    <a
                      href={selectedAd.landing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-600 hover:text-blue-800 text-sm mt-1 truncate"
                    >
                      {selectedAd.landing_url}
                    </a>
                  </div>
                )}

                {selectedAd.start_date && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Started:</span>
                    <p className="text-gray-900">{selectedAd.start_date}</p>
                  </div>
                )}

                {selectedAd.industry && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Found in search:</span>
                    <p className="text-gray-900">{selectedAd.industry} - {selectedAd.keywords}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
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
                    navigator.clipboard.writeText(selectedAd.ad_copy || '')
                    alert('Ad copy copied to clipboard!')
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  Copy Ad Text
                </button>
                {selectedAd.landing_url && (
                  <a
                    href={selectedAd.landing_url}
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
                    <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{adAnalysis.error}</div>
                  ) : (
                    <div className="space-y-3 text-sm">
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

                      {adAnalysis.messagingTheme && (
                        <div>
                          <span className="font-medium text-gray-700">Messaging Theme:</span>
                          <p className="text-gray-600 mt-1">{adAnalysis.messagingTheme}</p>
                        </div>
                      )}

                      {adAnalysis.emotionalAppeal && (
                        <div>
                          <span className="font-medium text-gray-700">Emotional Appeal:</span>
                          <span className="ml-2 px-2 py-1 bg-pink-100 text-pink-800 rounded text-xs">
                            {adAnalysis.emotionalAppeal}
                          </span>
                        </div>
                      )}

                      {adAnalysis.targetAudience && (
                        <div>
                          <span className="font-medium text-gray-700">Target Audience:</span>
                          <p className="text-gray-600 mt-1">{adAnalysis.targetAudience}</p>
                        </div>
                      )}

                      {adAnalysis.copywritingTechniques?.length > 0 && (
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

                      {adAnalysis.suggestedImprovements?.length > 0 && (
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
