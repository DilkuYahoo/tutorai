import { useState, useMemo } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import enAU from 'date-fns/locale/en-AU'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useInterviews } from '@/hooks/useInterviews'
import { useCandidates } from '@/hooks/useCandidates'
import { useUsers } from '@/hooks/useUsers'
import { useJobs } from '@/hooks/useJobs'
import InterviewRow from '@/components/interviews/InterviewRow'
import EmptyState from '@/components/ui/EmptyState'
import BaseBadge from '@/components/ui/BaseBadge'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-AU': enAU },
})

const STATUS_VARIANT = { Scheduled: 'indigo', Completed: 'emerald', Cancelled: 'red' }

export default function InterviewsPage() {
  const { upcomingInterviews, pastInterviews, openScheduleModal, updateInterview } = useInterviews()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const { candidates } = useCandidates()
  const { users, userById } = useUsers()
  const { jobs } = useJobs()
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const handleSelectEvent = (e) => { setSelectedEvent(e.resource); setConfirmCancel(false) }

  const allInterviews = useMemo(
    () => [...upcomingInterviews, ...pastInterviews],
    [upcomingInterviews, pastInterviews]
  )

  const candidateById = useMemo(() => {
    const m = {}
    candidates.forEach(c => { m[c.id] = c })
    return m
  }, [candidates])

  const jobById = useMemo(() => {
    const m = {}
    jobs.forEach(j => { m[j.id] = j })
    return m
  }, [jobs])

  const getName = (interview) => {
    const c = candidateById[interview.candidateId]
    return c ? `${c.firstName} ${c.lastName}` : ''
  }

  const getJobTitle = (interview) => {
    const j = jobById[interview.jobId]
    return j?.title ?? interview.jobTitle ?? ''
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return allInterviews
    const q = search.toLowerCase()
    return allInterviews.filter(i => {
      const name = getName(i).toLowerCase()
      const title = getJobTitle(i).toLowerCase()
      return name.includes(q) || title.includes(q)
    })
  }, [allInterviews, search, candidateById, jobById])

  const filteredUpcoming = useMemo(
    () => filtered.filter(i => upcomingInterviews.some(u => u.id === i.id)),
    [filtered, upcomingInterviews]
  )
  const filteredPast = useMemo(
    () => filtered.filter(i => pastInterviews.some(p => p.id === i.id)),
    [filtered, pastInterviews]
  )

  const calendarEvents = useMemo(() =>
    filtered.map(i => ({
      id: i.id,
      title: `${getName(i)} — ${getJobTitle(i)}`,
      start: new Date(i.scheduledAt),
      end: new Date(new Date(i.scheduledAt).getTime() + i.durationMinutes * 60000),
      resource: i,
    })),
    [filtered, candidateById, jobById]
  )

  const Table = ({ interviews }) => (
    <div className="rounded-2xl border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Candidate</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Date &amp; Time</th>
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
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Interviews</h1>
          <p className="text-sm text-slate-400 mt-0.5">{upcomingInterviews.length} upcoming</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search candidate or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-56 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
          />
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-700 overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Upcoming</h2>
            {filteredUpcoming.length === 0
              ? <EmptyState heading="No upcoming interviews" subtext={search ? 'No matches for your search.' : 'Schedule interviews from the Candidates page.'} />
              : <Table interviews={filteredUpcoming} />
            }
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Past</h2>
            {filteredPast.length === 0
              ? <EmptyState heading="No past interviews" />
              : <Table interviews={filteredPast} />
            }
          </section>
        </>
      ) : (
        <div className="flex gap-6">
          {/* Calendar */}
          <div className="flex-1 min-w-0 rbc-dark">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              onSelectEvent={handleSelectEvent}
              views={['month', 'week', 'day']}
              defaultView="week"
            />
          </div>

          {/* Right panel */}
          {selectedEvent && (
            <div className="w-72 shrink-0 rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4 animate-slide-in-right">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white text-sm">{getName(selectedEvent)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{getJobTitle(selectedEvent)}</p>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-slate-500 hover:text-white text-lg leading-none">&times;</button>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="Type" value={selectedEvent.type} />
                <Row label="Date" value={format(new Date(selectedEvent.scheduledAt), 'd MMM yyyy')} />
                <Row label="Time" value={format(new Date(selectedEvent.scheduledAt), 'h:mm a')} />
                <Row label="Duration" value={`${selectedEvent.durationMinutes} min`} />
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <BaseBadge variant={STATUS_VARIANT[selectedEvent.status] ?? 'slate'}>{selectedEvent.status}</BaseBadge>
                </div>
                {selectedEvent.meetingLink && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Link</span>
                    <a href={selectedEvent.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-400 truncate text-xs hover:underline">
                      {selectedEvent.meetingLink}
                    </a>
                  </div>
                )}
                <div className="pt-1">
                  <p className="text-slate-500 text-xs mb-1">Panel</p>
                  {(selectedEvent.panelIds ?? []).length === 0
                    ? <p className="text-slate-600 text-xs">—</p>
                    : (selectedEvent.panelIds).map(id => (
                        <p key={id} className="text-slate-300 text-xs">{userById(id)?.name ?? id}</p>
                      ))
                  }
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    const c = candidateById[selectedEvent.candidateId]
                    openScheduleModal({
                      applicationId: selectedEvent.applicationId,
                      candidateName: c ? `${c.firstName} ${c.lastName}` : '',
                      jobTitle: getJobTitle(selectedEvent),
                    }, selectedEvent.id)
                    setSelectedEvent(null)
                  }}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:border-indigo-500/50 transition-colors"
                >
                  Reschedule
                </button>
                {selectedEvent.status === 'Scheduled' && (
                  confirmCancel ? (
                    <span className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => {
                          updateInterview(selectedEvent.id, { status: 'Cancelled' })
                          setSelectedEvent(null)
                          setConfirmCancel(false)
                        }}
                        className="text-red-400 hover:text-red-300 font-medium"
                      >
                        Confirm cancel
                      </button>
                      <button onClick={() => setConfirmCancel(false)} className="text-slate-500 hover:text-slate-300">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmCancel(true)}
                      className="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Cancel
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  )
}
