import { useNavigate } from 'react-router-dom'
import { coaches, superCoach, packageTemplates } from '@/data/mock'

const allCoaches = [superCoach, ...coaches]

export default function CoachDirectoryPage() {
  const navigate = useNavigate()

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Find a Coach</h1>
        <p className="text-slate-500 text-sm mt-1">Choose a coach to view their profile and book a session</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allCoaches.filter(c => c.active).map(coach => {
          const assignedPkgs = packageTemplates.filter(p => coach.packages.includes(p.id))
          return (
            <div
              key={coach.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-indigo-600 transition-colors cursor-pointer"
              onClick={() => navigate(`/coaches/${coach.id}`)}
            >
              <div className="flex items-start gap-3">
                <img src={coach.photo} alt={coach.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-slate-100 truncate">{coach.name}</h2>
                  <p className="text-xs text-indigo-400 font-medium mt-0.5">${coach.rate} / session</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {coach.instagram && (
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Instagram</span>
                    )}
                    {coach.youtube && (
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">YouTube</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-3 line-clamp-2">{coach.bio}</p>

              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-1.5">Available packages</p>
                <div className="flex gap-1.5 flex-wrap">
                  {assignedPkgs.map(p => (
                    <span key={p.id} className="text-xs bg-indigo-950/60 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">
                      {p.name} · {p.sessionCount}× · ${p.price}
                    </span>
                  ))}
                  <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
                    Pay per session
                  </span>
                </div>
              </div>

              <button className="mt-4 w-full text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors">
                View Profile & Book
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
