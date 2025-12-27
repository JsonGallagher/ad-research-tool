import { Routes, Route, Link } from 'react-router-dom'
import Search from './pages/Search'
import Results from './pages/Results'
import Advertiser from './pages/Advertiser'

function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-50" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
              Ad Research Tool
            </h1>
            <p className="text-sm text-gray-500">
              Extract competitor ads from Meta Ad Library
            </p>
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
