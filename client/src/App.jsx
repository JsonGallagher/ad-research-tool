import { Routes, Route, Link } from 'react-router-dom'
import Search from './pages/Search'
import Results from './pages/Results'
import Advertiser from './pages/Advertiser'

function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-white via-blue-50/50 to-white backdrop-blur-xl sticky top-0 z-50 border-b border-blue-100/60" style={{ boxShadow: '0 1px 3px rgba(59, 130, 246, 0.08), 0 4px 20px rgba(59, 130, 246, 0.04)' }}>
        {/* Accent line */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-3 group">
            {/* Logo/Icon with glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/25 rounded-xl blur-xl group-hover:bg-blue-500/40 transition-all duration-500" />
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center" style={{ boxShadow: '0 4px 14px -3px rgba(59, 130, 246, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {/* Animated pulse dot */}
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" style={{ boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)' }} />
              </div>
            </div>

            {/* Text */}
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:via-blue-500 group-hover:to-indigo-500 transition-all duration-300">
                Ad Research Tool
              </h1>
              <p className="text-xs text-blue-600/70 tracking-wide font-medium">
                Meta Ad Library Intelligence
              </p>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Search />} />
          <Route path="/results/:searchId" element={<Results />} />
          <Route path="/results" element={<Results />} />
          <Route path="/advertiser/:name" element={<Advertiser />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
