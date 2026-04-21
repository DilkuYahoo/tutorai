import KanbanCard from './KanbanCard'

export default function KanbanColumn({ stage, applications, candidates }) {
  return (
    <div className="flex flex-col w-64 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{stage}</span>
        <span className="text-xs font-bold text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
          {applications.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 min-h-[120px] p-2 rounded-xl bg-slate-900/40 border border-slate-800/60">
        {applications.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-slate-700">Empty</p>
          </div>
        ) : (
          applications.map(app => {
            const candidate = candidates.find(c => c.id === app.candidateId)
            if (!candidate) return null
            return <KanbanCard key={app.id} application={app} candidate={candidate} />
          })
        )}
      </div>
    </div>
  )
}
