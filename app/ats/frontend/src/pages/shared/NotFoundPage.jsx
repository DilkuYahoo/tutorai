import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 animate-fade-in">
      <p className="text-8xl font-bold text-slate-800 mb-6">404</p>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-slate-400 mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Link
        to="/dashboard"
        className="px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
