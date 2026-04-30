import { useState } from 'react'
import { coaches, packageTemplates } from '@/data/mock'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

export default function CoachManagementPage() {
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [editCoach, setEditCoach] = useState(null)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Coaches</h1>
          <p className="text-slate-500 text-sm mt-0.5">Register, edit, and manage coach accounts</p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          + Register coach
        </button>
      </div>

      {/* Coach list */}
      <div className="space-y-3">
        {coaches.map(coach => {
          const assignedPkgs = packageTemplates.filter(p => coach.packages.includes(p.id))
          return (
            <div key={coach.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <img src={coach.photo} alt={coach.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-100">{coach.name}</h3>
                    <Badge label="Active" colour="green" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{coach.email} · ${coach.rate}/session</p>
                  <p className="text-sm text-slate-400 mt-2 line-clamp-1">{coach.bio}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {assignedPkgs.map(p => (
                      <span key={p.id} className="text-xs bg-indigo-950/60 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditCoach(coach)}
                    className="text-xs border border-slate-700 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button className="text-xs border border-red-800 text-red-400 hover:bg-red-950/50 px-3 py-1.5 rounded-lg transition-colors">
                    Deregister
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Register modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md animate-fade-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-semibold text-slate-100 mb-4">Register New Coach</h3>
            <div className="space-y-3">
              {[
                { label: 'Full name', placeholder: 'e.g. Alex Thompson' },
                { label: 'Email address', placeholder: 'coach@example.com' },
                { label: 'Per-session rate ($)', placeholder: '80' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                  <input type="text" placeholder={f.placeholder} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Bio</label>
                <textarea rows={3} placeholder="Coach background and specialties..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-2">Assign packages</label>
                <div className="space-y-1.5">
                  {packageTemplates.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-indigo-500" />
                      <span className="text-sm text-slate-300">{p.name} — {p.sessionCount} sessions · ${p.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">An invite email with a temporary password will be sent to the coach.</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRegisterModal(false)} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Cancel</button>
              <button onClick={() => setShowRegisterModal(false)} className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors">Send invite</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editCoach && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md animate-fade-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-semibold text-slate-100 mb-4">Edit Coach — {editCoach.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Full name</label>
                <input defaultValue={editCoach.name} type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Per-session rate ($)</label>
                <input defaultValue={editCoach.rate} type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Bio</label>
                <textarea defaultValue={editCoach.bio} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-2">Assigned packages</label>
                <div className="space-y-1.5">
                  {packageTemplates.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-indigo-500" defaultChecked={editCoach.packages.includes(p.id)} />
                      <span className="text-sm text-slate-300">{p.name} — {p.sessionCount} sessions · ${p.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditCoach(null)} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Cancel</button>
              <button onClick={() => setEditCoach(null)} className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
