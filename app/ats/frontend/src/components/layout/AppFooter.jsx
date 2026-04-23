import { Link } from 'react-router-dom'

const YEAR = new Date().getFullYear()

export default function AppFooter({ variant = 'public' }) {
  if (variant === 'admin') {
    return (
      <footer className="md:pl-60 border-t border-slate-800/60 px-6 py-4">
        <p className="text-xs text-slate-600 text-center">
          © {YEAR} AdviceLab. All rights reserved. Built and maintained by{' '}
          <a
            href="https://cognifylabs.ai"
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-indigo-400 transition-colors"
          >
            CognifyLabs.ai
          </a>
        </p>
      </footer>
    )
  }

  return (
    <footer className="border-t border-slate-800/60 bg-slate-950 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Brand */}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">AdviceLab</p>
            <p className="text-xs text-slate-500">
              Built and maintained by{' '}
              <a
                href="https://cognifylabs.ai"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                CognifyLabs.ai
              </a>
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link
              to="/privacy"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Terms of Use
            </Link>
            <Link
              to="/careers"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Careers
            </Link>
          </nav>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800/60">
          <p className="text-xs text-slate-600 text-center">
            © {YEAR} AdviceLab Pty Ltd. All rights reserved. ABN — advicelab.com.au
          </p>
        </div>
      </div>
    </footer>
  )
}
