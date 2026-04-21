import { useInterviews } from '@/hooks/useInterviews'
import InterviewRow from '@/components/interviews/InterviewRow'
import FeedbackModal from '@/components/interviews/FeedbackModal'
import EmptyState from '@/components/ui/EmptyState'

export default function InterviewsPage() {
  const { upcomingInterviews, pastInterviews } = useInterviews()

  const Table = ({ interviews }) => (
    <div className="rounded-2xl border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Candidate</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Date & Time</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden lg:table-cell">Panel</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {interviews.map(i => <InterviewRow key={i.id} interview={i} />)}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Interviews</h1>
        <p className="text-sm text-slate-400 mt-0.5">{upcomingInterviews.length} upcoming</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Upcoming</h2>
        {upcomingInterviews.length === 0
          ? <EmptyState heading="No upcoming interviews" subtext="Schedule interviews from the Candidates page." />
          : <Table interviews={upcomingInterviews} />
        }
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Past</h2>
        {pastInterviews.length === 0
          ? <EmptyState heading="No past interviews" />
          : <Table interviews={pastInterviews} />
        }
      </section>

      <FeedbackModal />
    </div>
  )
}
