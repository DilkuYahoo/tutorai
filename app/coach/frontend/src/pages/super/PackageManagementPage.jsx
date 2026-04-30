import { useState } from 'react'
import { packageTemplates, coaches, superCoach } from '@/data/mock'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

const allCoaches = [superCoach, ...coaches]

export default function PackageManagementPage() {
  const [showModal, setShowModal] = useState(false)
  const [editPkg, setEditPkg] = useState(null)

  const modal = editPkg || (showModal ? {} : null)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Package Templates</h1>
          <p className="text-slate-500 text-sm mt-0.5">Platform-wide packages assigned to coaches</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          + New package
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {packageTemplates.map(pkg => {
          const assignedCoaches = allCoaches.filter(c => c.packages.includes(pkg.id))
          return (
            <div key={pkg.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{pkg.name}</h3>
                  <Badge label={pkg.tier} colour="indigo" />
                </div>
                <button
                  onClick={() => setEditPkg(pkg)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sessions</span>
                  <span className="text-slate-200 font-medium">{pkg.sessionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Price</span>
                  <span className="text-slate-200 font-medium">${pkg.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Per session</span>
                  <span className="text-slate-400">${(pkg.price / pkg.sessionCount).toFixed(0)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-3">{pkg.description}</p>

              <div>
                <p className="text-xs text-slate-500 mb-1.5">Assigned to coaches</p>
                <div className="flex gap-1 flex-wrap">
                  {assignedCoaches.map(c => (
                    <span key={c.id} className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
                      {c.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create/edit modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-4">
              {editPkg ? `Edit Package — ${editPkg.name}` : 'New Package Template'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Package name</label>
                <input defaultValue={editPkg?.name} type="text" placeholder="e.g. Premium" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Number of sessions</label>
                <input defaultValue={editPkg?.sessionCount} type="number" placeholder="10" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Price ($)</label>
                <input defaultValue={editPkg?.price} type="number" placeholder="750" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Description</label>
                <textarea defaultValue={editPkg?.description} rows={2} placeholder="Short description..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Assign to coaches</label>
                <div className="space-y-1.5">
                  {allCoaches.map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-indigo-500" defaultChecked={editPkg ? c.packages.includes(editPkg.id) : false} />
                      <span className="text-sm text-slate-300">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowModal(false); setEditPkg(null) }} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Cancel</button>
              <button onClick={() => { setShowModal(false); setEditPkg(null) }} className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
