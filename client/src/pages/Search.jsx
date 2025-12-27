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
    adCount: 25
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Start Ad Research
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Industry (optional)
            </label>
            <select
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an industry...</option>
              {INDUSTRIES.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {LOCATIONS.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
          </div>

          {/* Ad Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Ads to Capture
            </label>
            <select
              value={formData.adCount}
              onChange={(e) => setFormData({ ...formData, adCount: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {AD_COUNT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.estimate})
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              More ads = longer scrape time but better research data
            </p>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keywords / Competitor Names
              {formData.industry && INDUSTRY_KEYWORDS[formData.industry]?.default && (
                <span className="text-gray-400 font-normal ml-2">
                  (optional - will use "{INDUSTRY_KEYWORDS[formData.industry].default}" if empty)
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
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Examples: "Zillow", "Chicago real estate", "home buying tips"
            </p>
            {formData.industry && INDUSTRY_KEYWORDS[formData.industry]?.suggestions?.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">Suggestions: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {INDUSTRY_KEYWORDS[formData.industry].suggestions.slice(0, 6).map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setFormData({ ...formData, keywords: suggestion })}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
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

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Select an industry (keywords auto-fill) or enter your own keywords</li>
          <li>Watch as the browser navigates to Meta Ad Library</li>
          <li>Ads are automatically captured and saved</li>
          <li>Review, filter, analyze with AI, and export your research</li>
        </ol>
      </div>

      {/* Location Tip */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-medium text-amber-900 mb-1">City-level search tip</h3>
        <p className="text-sm text-amber-800">
          Meta Ad Library only filters by country. To find ads in a specific city, include the city name in your keywords (e.g., "Chicago real estate agent" or "Miami personal injury lawyer").
        </p>
      </div>
    </div>
  )
}
