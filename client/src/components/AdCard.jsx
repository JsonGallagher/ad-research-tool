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

// Get longevity badge color based on days running
function getLongevityColor(days) {
  if (days >= 30) return { bg: 'bg-green-100', text: 'text-green-800', label: 'Proven' }
  if (days >= 7) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Established' }
  return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'New' }
}

// Extract just the domain from a URL
function getDomain(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return null
  }
}

export default function AdCard({ ad, onClick }) {
  const advertiserName = ad.advertiser_name || ad.advertiserName || 'Unknown'
  const adCopy = ad.ad_copy || ad.adCopy || ''
  const screenshotPath = ad.screenshot_path || ad.screenshotPath
  const platform = ad.platform || 'meta'
  const mediaType = ad.media_type || ad.mediaType || 'image'
  // Only show CTA if it looks like an actual CTA button (short text, no URLs)
  const rawCtaText = ad.cta_text || ad.ctaText || ''
  const ctaText = (rawCtaText.length <= 25 && !rawCtaText.includes('.COM') && !rawCtaText.includes('.com')) ? rawCtaText : ''
  const landingUrl = ad.landing_url || ad.landingUrl || ''
  const landingDomain = getDomain(landingUrl)
  const isFavorite = ad.is_favorite
  const startDate = ad.start_date || ad.startDate
  const daysRunning = calculateDaysRunning(startDate)
  const longevityColor = daysRunning !== null ? getLongevityColor(daysRunning) : null

  // Format icon based on media type
  const formatIcon = {
    video: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>,
    carousel: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>,
    image: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow relative"
    >
      {isFavorite && (
        <div className="absolute top-2 right-2 z-10 bg-yellow-400 text-yellow-900 p-1 rounded-full">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
      )}
      {/* Screenshot */}
      {screenshotPath ? (
        <div className="bg-gray-50 flex items-center justify-center min-h-[200px] max-h-[400px] overflow-hidden">
          <img
            src={`/screenshots/${screenshotPath}`}
            alt={`Ad by ${advertiserName}`}
            className="w-full h-auto max-h-[400px] object-contain"
            onError={(e) => {
              e.target.parentElement.innerHTML = '<span class="text-gray-400 p-4">Image not found</span>'
            }}
          />
        </div>
      ) : (
        <div className="h-[200px] bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400">No preview</span>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 truncate flex-1 mr-2">
            {advertiserName}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {landingDomain && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded truncate max-w-[120px]" title={landingUrl}>
                {landingDomain}
              </span>
            )}
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize flex items-center gap-1">
              {formatIcon[mediaType] || formatIcon.image}
              {platform}
            </span>
          </div>
        </div>
        {ctaText && (
          <div className="mb-2">
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {ctaText}
            </span>
          </div>
        )}

        <p className="text-sm text-gray-600 line-clamp-3">
          {adCopy || 'Click to view details'}
        </p>

        {startDate && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              Started: {startDate}
            </p>
            {daysRunning !== null && longevityColor && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${longevityColor.bg} ${longevityColor.text}`}>
                {daysRunning}d running
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
