import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Industry keywords for auto-population
const INDUSTRY_KEYWORDS = {
  'Real Estate': {
    default: 'real estate agent',
    suggestions: ['real estate agent', 'home buying', 'realtor', 'sell my house', 'home for sale', 'property listing', 'mortgage', 'first time home buyer']
  },
  'E-commerce': {
    default: 'online shopping',
    suggestions: ['online store', 'shop now', 'free shipping', 'discount code', 'flash sale', 'buy online', 'limited time offer']
  },
  'SaaS / Software': {
    default: 'software',
    suggestions: ['software', 'SaaS', 'free trial', 'productivity app', 'business software', 'automation tool', 'project management', 'CRM']
  },
  'Health & Fitness': {
    default: 'fitness',
    suggestions: ['fitness', 'weight loss', 'personal trainer', 'gym membership', 'workout program', 'nutrition', 'wellness', 'supplements']
  },
  'Finance / Insurance': {
    default: 'insurance',
    suggestions: ['insurance quote', 'financial advisor', 'investment', 'loan', 'credit card', 'savings account', 'retirement planning', 'life insurance']
  },
  'Education': {
    default: 'online course',
    suggestions: ['online course', 'learn', 'certification', 'degree program', 'tutoring', 'training', 'education', 'skill development']
  },
  'Travel & Hospitality': {
    default: 'travel deals',
    suggestions: ['travel deals', 'vacation', 'hotel booking', 'flights', 'resort', 'travel agency', 'holiday packages', 'cruise']
  },
  'Food & Restaurant': {
    default: 'restaurant',
    suggestions: ['restaurant', 'food delivery', 'order online', 'meal prep', 'catering', 'menu', 'dining', 'takeout']
  },
  'Automotive': {
    default: 'car dealer',
    suggestions: ['car dealer', 'auto sales', 'new car', 'used car', 'car financing', 'auto repair', 'car lease', 'vehicle']
  },
  'Beauty & Cosmetics': {
    default: 'skincare',
    suggestions: ['skincare', 'makeup', 'beauty products', 'cosmetics', 'hair care', 'salon', 'anti-aging', 'beauty routine']
  },
  'Home Services': {
    default: 'home services',
    suggestions: ['home repair', 'plumber', 'electrician', 'HVAC', 'cleaning service', 'landscaping', 'roofing', 'home improvement']
  },
  'Legal Services': {
    default: 'lawyer',
    suggestions: ['lawyer', 'attorney', 'legal help', 'law firm', 'personal injury', 'divorce lawyer', 'legal advice', 'immigration lawyer']
  },
  'Other': {
    default: '',
    suggestions: []
  }
}

const INDUSTRIES = Object.keys(INDUSTRY_KEYWORDS)

const LOCATIONS = [
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'UK' },
  { label: 'Canada', value: 'Canada' },
  { label: 'Australia', value: 'Australia' },
  { label: 'Germany', value: 'Germany' },
  { label: 'France', value: 'France' },
  { label: 'Spain', value: 'Spain' },
  { label: 'Brazil', value: 'Brazil' },
  { label: 'Mexico', value: 'Mexico' },
]

const AD_COUNT_OPTIONS = [
  { label: '25 ads', value: 25, estimate: '~1 min' },
  { label: '50 ads', value: 50, estimate: '~2 min' },
  { label: '100 ads', value: 100, estimate: '~4 min' },
]

export default function Search() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    industry: '',
    location: 'US',
    keywords: '',
    adCount: 25,
    filterRelevant: false
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Use industry default keyword if no keywords provided
    let searchKeywords = formData.keywords.trim()
    if (!searchKeywords) {
      if (formData.industry && INDUSTRY_KEYWORDS[formData.industry]) {
        searchKeywords = INDUSTRY_KEYWORDS[formData.industry].default
      }
      if (!searchKeywords) {
        alert('Please enter keywords, competitor names, or select an industry')
        return
      }
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, keywords: searchKeywords })
      })

      const data = await response.json()

      if (data.searchId) {
        navigate(`/results/${data.searchId}`)
      }
    } catch (error) {
      console.error('Error starting search:', error)
      alert('Failed to start search. Is the server running?')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        {/* Main Form - takes 2 columns on desktop */}
        <div className="lg:col-span-2 h-full">
          <div className="card-elevated p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-5">
              Start Ad Research
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
              {/* Industry & Location - side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Industry (optional)
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="input-styled"
                  >
                    <option value="">Select an industry...</option>
                    {INDUSTRIES.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Location
                  </label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-styled"
                  >
                    {LOCATIONS.map(loc => (
                      <option key={loc.value} value={loc.value}>{loc.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ad Count & AI Filter - side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Ads to Capture
                  </label>
                  <select
                    value={formData.adCount}
                    onChange={(e) => setFormData({ ...formData, adCount: parseInt(e.target.value) })}
                    className="input-styled"
                  >
                    {AD_COUNT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({opt.estimate})
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Relevance Filter - compact */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-purple-200/60 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.05) 0%, rgba(139, 92, 246, 0.08) 100%)' }}>
                  <input
                    type="checkbox"
                    id="filterRelevant"
                    checked={formData.filterRelevant}
                    onChange={(e) => setFormData({ ...formData, filterRelevant: e.target.checked })}
                    className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <label htmlFor="filterRelevant" className="cursor-pointer">
                    <span className="font-semibold text-purple-900 text-sm">AI Relevance Filter</span>
                    <p className="text-xs text-purple-700">Skip irrelevant ads</p>
                  </label>
                </div>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Keywords / Competitor Names
                  {formData.industry && INDUSTRY_KEYWORDS[formData.industry]?.default && (
                    <span className="text-gray-400 font-normal ml-2 text-xs">
                      (will use "{INDUSTRY_KEYWORDS[formData.industry].default}" if empty)
                    </span>
                  )}
                </label>
                <textarea
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder={formData.industry && INDUSTRY_KEYWORDS[formData.industry]?.default
                    ? `Leave empty to search "${INDUSTRY_KEYWORDS[formData.industry].default}" or enter custom keywords...`
                    : "Enter competitor names, brand keywords, or product terms..."
                  }
                  rows={2}
                  className="input-styled resize-none"
                />
                {formData.industry && INDUSTRY_KEYWORDS[formData.industry]?.suggestions?.length > 0 && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {INDUSTRY_KEYWORDS[formData.industry].suggestions.slice(0, 8).map(suggestion => {
                        const currentKeywords = formData.keywords.split(',').map(k => k.trim().toLowerCase())
                        const isSelected = currentKeywords.includes(suggestion.toLowerCase())

                        return (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                const newKeywords = formData.keywords
                                  .split(',')
                                  .map(k => k.trim())
                                  .filter(k => k.toLowerCase() !== suggestion.toLowerCase())
                                  .join(', ')
                                setFormData({ ...formData, keywords: newKeywords })
                              } else {
                                const current = formData.keywords.trim()
                                const newKeywords = current ? `${current}, ${suggestion}` : suggestion
                                setFormData({ ...formData, keywords: newKeywords })
                              }
                            }}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all duration-200 ${
                              isSelected
                                ? 'text-white shadow-md'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                            style={isSelected ? {
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              boxShadow: '0 2px 8px -2px rgba(59, 130, 246, 0.5)'
                            } : {}}
                          >
                            {suggestion}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Spacer to push button down */}
              <div className="flex-1" />

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 ${
                  isLoading ? 'cursor-not-allowed opacity-60' : ''
                }`}
                style={isLoading ? {
                  background: '#94a3b8'
                } : {
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  boxShadow: '0 4px 14px -3px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting...
                  </span>
                ) : (
                  'Start Research'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar - info cards */}
        <div className="space-y-4 flex flex-col">
          {/* How it works */}
          <div className="card-glass p-5" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How it works
            </h3>
            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
              <li>Select industry or enter keywords</li>
              <li>Browser opens Meta Ad Library</li>
              <li>Ads captured automatically</li>
              <li>Review, filter & export</li>
            </ol>
          </div>

          {/* Location Tip */}
          <div className="card-glass p-5" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              City-level tip
            </h3>
            <p className="text-sm text-amber-800">
              Include city in keywords for local targeting (e.g., "Chicago real estate agent").
            </p>
          </div>

          {/* Quick Stats */}
          <div className="card-glass p-5" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              What you get
            </h3>
            <ul className="text-sm text-emerald-800 space-y-1">
              <li>- Ad screenshots & copy</li>
              <li>- Landing page URLs</li>
              <li>- CTA buttons used</li>
              <li>- Days running (longevity)</li>
              <li>- AI analysis & insights</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
