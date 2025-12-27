import { Routes, Route } from 'react-router-dom'
import Search from './pages/Search'
import Results from './pages/Results'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Ad Research Tool
          </h1>
          <p className="text-sm text-gray-500">
            Extract competitor ads from Meta Ad Library
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Search />} />
          <Route path="/results/:searchId" element={<Results />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
