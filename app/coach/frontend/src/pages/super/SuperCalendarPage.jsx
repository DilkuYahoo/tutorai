import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format } from 'date-fns'
import { sessions, coaches, superCoach, getPlayerById, getCoachById, COACH_COLORS } from '@/data/mock'

const allCoaches = [superCoach, ...coaches]

export default function SuperCalendarPage() {
  const [visibleCoaches, setVisibleCoaches] = useState(new Set(allCoaches.map(c => c.id)))
  const [selectedEvent, setSelectedEvent] = useState(null)

  function toggleCoach(id) {
    setVisibleCoaches(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const events = sessions
    .filter(s => visibleCoaches.has(s.coachId))
    .map(s => {
      const color = COACH_COLORS[s.coachId]
      return {
        id: s.id,
        start: s.start,
        end: s.end,
        title: getPlayerById(s.playerId)?.name || 'Player',
        backgroundColor: color + '33',
        borderColor: color,
        textColor: '#fff',
        extendedProps: { session: s },
      }
    })

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Unified Calendar</h1>
        <p className="text-slate-500 text-sm mt-0.5">All coaches — drag to reschedule or reassign</p>
      </div>

      {/* Coach colour legend + toggles */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 mr-1">Show:</span>
        {allCoaches.map(coach => {
          const color = COACH_COLORS[coach.id]
          const active = visibleCoaches.has(coach.id)
          return (
            <button
              key={coach.id}
              onClick={() => toggleCoach(coach.id)}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                active ? 'border-slate-600' : 'border-slate-800 opacity-40'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
              {coach.name}
            </button>
          )
        })}
      </div>

      {/* Calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          events={events}
          eventClick={info => setSelectedEvent(info.event.extendedProps.session)}
          editable={true}
          eventDrop={info => console.log('Dropped:', info.event.id)}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          slotDuration="00:45:00"
          expandRows={true}
          nowIndicator={true}
        />
      </div>

      {/* Session detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Session Detail</h3>
            <p className="text-xs text-slate-500 mb-4">{format(selectedEvent.start, 'EEEE d MMMM yyyy, h:mm a')}</p>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Player</span>
                <span className="text-slate-200">{getPlayerById(selectedEvent.playerId)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coach</span>
                <span className="text-slate-200">{getCoachById(selectedEvent.coachId)?.name}</span>
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

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button className="text-xs border border-amber-800 text-amber-400 hover:bg-amber-950/50 py-2 rounded-lg transition-colors">Reschedule</button>
              <button className="text-xs border border-indigo-700 text-indigo-400 hover:bg-indigo-950/50 py-2 rounded-lg transition-colors">Reassign coach</button>
              <button className="text-xs border border-red-800 text-red-400 hover:bg-red-950/50 py-2 rounded-lg transition-colors">Cancel session</button>
              {selectedEvent.status === 'booked' && (
                <button className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded-lg transition-colors">Mark Complete</button>
              )}
            </div>

            <button onClick={() => setSelectedEvent(null)} className="w-full text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
