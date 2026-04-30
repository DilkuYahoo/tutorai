import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { sessions, coachAvailability, getPlayerById } from '@/data/mock'

export default function CoachCalendarPage() {
  const { user } = useAuth()
  const coachId = user?.id || 'coach-1'
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [blockoutModal, setBlockoutModal] = useState(false)

  const mySessions = sessions.filter(s => s.coachId === coachId)
  const avail = coachAvailability[coachId] || []

  const availEvents = avail.map((slot, i) => ({
    id: `avail-${i}`,
    start: slot.start,
    end: slot.end,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: '#3730a3',
    textColor: '#818cf8',
    title: 'Open',
    extendedProps: { type: 'available' },
  }))

  const sessionEvents = mySessions.map(s => ({
    id: s.id,
    start: s.start,
    end: s.end,
    backgroundColor: s.status === 'completed' ? '#064e3b' : '#312e81',
    borderColor: s.status === 'completed' ? '#059669' : '#6366f1',
    textColor: '#fff',
    title: getPlayerById(s.playerId)?.name || 'Player',
    extendedProps: { type: 'session', session: s },
  }))

  function handleEventClick(info) {
    if (info.event.extendedProps.type === 'session') {
      setSelectedEvent(info.event.extendedProps.session)
    }
  }

  function handleEventDrop(info) {
    // In real app: API call to reschedule
    console.log('Rescheduled:', info.event.id, 'to', info.event.start)
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">My Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your availability and sessions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBlockoutModal(true)}
            className="text-sm border border-red-800 text-red-400 hover:bg-red-950/50 px-3 py-2 rounded-lg transition-colors"
          >
            + Block out dates
          </button>
          <button className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors">
            + Add availability
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-900/50 border border-indigo-700 inline-block"></span> Open slot</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-900 border border-indigo-500 inline-block"></span> Booked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-900 border border-emerald-600 inline-block"></span> Completed</span>
        <span className="text-xs text-slate-600 italic">Drag sessions to reschedule</span>
      </div>

      {/* Calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          events={[...availEvents, ...sessionEvents]}
          eventClick={handleEventClick}
          editable={true}
          eventDrop={handleEventDrop}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          weekends={true}
          slotDuration="00:45:00"
          expandRows={true}
          nowIndicator={true}
        />
      </div>

      {/* Session detail panel */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Session Detail</h3>
            <p className="text-xs text-slate-500 mb-4">{format(selectedEvent.start, 'EEEE d MMMM yyyy, h:mm a')}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Player</span>
                <span className="text-slate-200">{getPlayerById(selectedEvent.playerId)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="text-slate-200 capitalize">{selectedEvent.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={`font-medium capitalize ${selectedEvent.status === 'completed' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {selectedEvent.status}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setSelectedEvent(null)} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Close</button>
              {selectedEvent.status === 'booked' && (
                <button onClick={() => setSelectedEvent(null)} className="flex-1 text-sm bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded-lg transition-colors">
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block-out modal */}
      {blockoutModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-4">Block Out Dates</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">From</label>
                <input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">To</label>
                <input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Reason (optional)</label>
                <input type="text" placeholder="e.g. School holidays" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <p className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800 rounded-lg px-3 py-2 mt-3">
              ⚠️ Any booked sessions during this period must be resolved first.
            </p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBlockoutModal(false)} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Cancel</button>
              <button onClick={() => setBlockoutModal(false)} className="flex-1 text-sm bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg transition-colors">Confirm Block-out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
