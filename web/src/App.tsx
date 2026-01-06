import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

// Lazy load - Load on demand
const ConversationPage = lazy(() => import('./pages/ConversationPage'))

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">로딩 중...</div>
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<ConversationPage />} />
      </Routes>
    </Suspense>
  )
}

export default App
