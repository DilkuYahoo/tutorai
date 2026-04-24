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
  const { candidates } = useCandidates()
  const { users, userById } = useUsers()
  const { jobs } = useJobs()

  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [filterJobId, setFilterJobId] = useState('')
  const [filterPanelId, setFilterPanelId] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [calendarCancelOpen, setCalendarCancelOpen] = useState(false)
  const [calendarCancelReason, setCalendarCancelReason] = useState('')
  const [calendarCancelSaving, setCalendarCancelSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const handleSelectEvent = (e) => { setSelectedEvent(e.resource); setCalendarCancelOpen(false); setCalendarCancelReason('') }

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

  const getJobTitle = (interview) => jobById[interview.jobId]?.title ?? interview.jobTitle ?? ''

  const allInterviews = useMemo(
    () => [...upcomingInterviews, ...pastInterviews],
    [upcomingInterviews, pastInterviews]
  )

  const filtered = useMemo(() => {
    return allInterviews.filter(i => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const name = getName(i).toLowerCase()
        const title = getJobTitle(i).toLowerCase()
        if (!name.includes(q) && !title.includes(q)) return false
      }
      if (filterJobId && i.jobId !== filterJobId) return false
      if (filterPanelId && !(i.panelIds ?? []).includes(filterPanelId)) return false
      if (filterDate) {
        const iDate = new Date(i.scheduledAt).toISOString().slice(0, 10)
        if (iDate !== filterDate) return false
      }
      return true
    })
  }, [allInterviews, search, filterJobId, filterPanelId, filterDate, candidateById, jobById])

  // Past: interviews with feedback go to bottom
  const filteredUpcoming = useMemo(
    () => filtered.filter(i => upcomingInterviews.some(u => u.id === i.id)),
    [filtered, upcomingInterviews]
  )
  const filteredPast = useMemo(() => {
    const past = filtered.filter(i => pastInterviews.some(p => p.id === i.id))
    return [
      ...past.filter(i => !i.feedback),
      ...past.filter(i => i.feedback),
    ]
  }, [filtered, pastInterviews])

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

  const handleCalendarCancel = async () => {
    if (!calendarCancelReason.trim()) return
    setCalendarCancelSaving(true)
    try {
      await updateInterview(selectedEvent.id, { status: 'Cancelled', cancellationReason: calendarCancelReason.trim() })
      setSelectedEvent(null)
      setCalendarCancelOpen(false)
    } finally {
      setCalendarCancelSaving(false)
    }
  }

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
          {interviews.map(i => (
            <InterviewRow
              key={i.id}
              interview={i}
              expanded={expandedId === i.id}
              onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )

  const hasFilters = search || filterJobId || filterPanelId || filterDate
  const clearFilters = () => { setSearch(''); setFilterJobId(''); setFilterPanelId(''); setFilterDate('') }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Interviews</h1>
          <p className="text-sm text-slate-400 mt-0.5">{upcomingInterviews.length} upcoming</p>
        </div>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search candidate or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
        />
        <select
          value={filterJobId}
          onChange={e => setFilterJobId(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All positions</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <select
          value={filterPanelId}
          onChange={e => setFilterPanelId(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All panel members</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
        />
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear filters ×
          </button>
        )}
      </div>

      {view === 'list' ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Upcoming</h2>
            {filteredUpcoming.length === 0
              ? <EmptyState heading="No upcoming interviews" subtext={hasFilters ? 'No matches for your filters.' : 'Schedule interviews from the Candidates page.'} />
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
                    : selectedEvent.panelIds.map(id => (
                        <p key={id} className="text-slate-300 text-xs">{userById(id)?.name ?? id}</p>
                      ))
                  }
                </div>
                {selectedEvent.feedback && (
                  <div className="pt-1 border-t border-slate-800">
                    <p className="text-slate-500 text-xs mb-1">Feedback</p>
                    <p className="text-emerald-400 text-xs">{'★'.repeat(selectedEvent.feedback.rating)} {selectedEvent.feedback.recommendation}</p>
                    {selectedEvent.feedback.notes && <p className="text-slate-400 text-xs mt-1">{selectedEvent.feedback.notes}</p>}
                  </div>
                )}
              </div>

              {selectedEvent.status === 'Scheduled' && (
                <div className="space-y-2 pt-1">
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
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:border-indigo-500/50 transition-colors"
                  >
                    Reschedule
                  </button>

                  {calendarCancelOpen ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        className="w-full rounded-xl border border-red-500/30 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500/50 resize-none"
                        rows={3}
                        placeholder="Reason for cancellation (required)…"
                        value={calendarCancelReason}
                        onChange={e => setCalendarCancelReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCalendarCancel}
                          disabled={!calendarCancelReason.trim() || calendarCancelSaving}
                          className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {calendarCancelSaving ? 'Cancelling…' : 'Confirm Cancel'}
                        </button>
                        <button
                          onClick={() => setCalendarCancelOpen(false)}
                          className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setCalendarCancelOpen(true); setCalendarCancelReason('') }}
                      className="w-full rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Cancel Interview
                    </button>
                  )}
                </div>
              )}
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
