import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format } from 'date-fns'
import { coaches, superCoach, packageTemplates, coachAvailability, sessions } from '@/data/mock'
import { useAuth } from '@/context/AuthContext'

const allCoaches = [superCoach, ...coaches]

export default function CoachProfilePage() {
  const { coachId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const coach = allCoaches.find(c => c.id === coachId)
  const [showBookModal, setShowBookModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [bookingMode, setBookingMode] = useState('adhoc')
  const [bookingDone, setBookingDone] = useState(false)

  if (!coach) return <p className="text-slate-400">Coach not found.</p>

  const assignedPkgs = packageTemplates.filter(p => coach.packages.includes(p.id))
  const avail = coachAvailability[coachId] || []
  const booked = sessions.filter(s => s.coachId === coachId && s.status === 'booked')

  const availEvents = avail.map((slot, i) => ({
    id: `avail-${i}`,
    start: slot.start,
    end: slot.end,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: '#4f46e5',
    textColor: '#a5b4fc',
    title: 'Available',
    extendedProps: { type: 'available', slot },
  }))

  const bookedEvents = booked.map(s => ({
    id: s.id,
    start: s.start,
    end: s.end,
    backgroundColor: '#374151',
    borderColor: '#4b5563',
    textColor: '#6b7280',
    title: 'Booked',
    extendedProps: { type: 'booked' },
  }))

  function handleSlotClick(info) {
    if (info.event.extendedProps.type !== 'available') return
    setSelectedSlot(info.event.extendedProps.slot)
    setShowBookModal(true)
  }

  function confirmBooking() {
    setShowBookModal(false)
    setBookingDone(true)
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate('/coaches')} className="text-slate-500 hover:text-slate-300 text-sm mb-4 flex items-center gap-1">
        ← Back to coaches
      </button>

      {/* Profile header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <img src={coach.photo} alt={coach.name} className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-xl font-bold text-slate-100">{coach.name}</h1>
                <p className="text-indigo-400 font-semibold text-sm mt-0.5">${coach.rate} / session</p>
              </div>
              <div className="flex gap-2">
                {coach.instagram && (
                  <a href="#" className="text-xs bg-slate-800 border border-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                    Instagram
                  </a>
                )}
                {coach.youtube && (
                  <a href="#" className="text-xs bg-slate-800 border border-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                    YouTube
                  </a>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-sm mt-3">{coach.bio}</p>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-100 mb-3">Packages & Pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border border-slate-700 rounded-lg p-3 hover:border-indigo-600 transition-colors cursor-pointer">
            <p className="text-xs text-slate-500">Pay per session</p>
            <p className="text-lg font-bold text-slate-100 mt-1">${coach.rate}</p>
            <p className="text-xs text-slate-500 mt-1">Invoiced after each session</p>
          </div>
          {assignedPkgs.map(pkg => (
            <div key={pkg.id} className="border border-slate-700 rounded-lg p-3 hover:border-indigo-600 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <p className="text-xs text-indigo-400 font-medium">{pkg.tier}</p>
                <span className="text-xs bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded">{pkg.sessionCount} sessions</span>
              </div>
              <p className="text-lg font-bold text-slate-100 mt-1">${pkg.price}</p>
              <p className="text-xs text-slate-500 mt-1">{pkg.description}</p>
              <button className="mt-2 w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded transition-colors">
                Purchase via Stripe
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Booking calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-100">Availability — Click a slot to book</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-600/30 inline-block border border-indigo-500"></span> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-700 inline-block border border-slate-600"></span> Booked</span>
          </div>
        </div>

        {bookingDone && (
          <div className="mb-4 bg-emerald-950/50 border border-emerald-700 text-emerald-400 rounded-lg px-4 py-3 text-sm">
            ✓ Session booked for {selectedSlot && format(selectedSlot.start, 'EEEE d MMM, h:mm a')}. Confirmation email sent.
          </div>
        )}

        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={[...availEvents, ...bookedEvents]}
          eventClick={handleSlotClick}
          height="auto"
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          weekends={true}
          slotDuration="00:45:00"
          expandRows={true}
        />
      </div>

      {/* Book modal */}
      {showBookModal && selectedSlot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-4">Confirm Booking</h3>

            <div className="bg-slate-800 rounded-lg p-3 mb-4 text-sm">
              <p className="text-slate-400">Coach: <span className="text-slate-200">{coach.name}</span></p>
              <p className="text-slate-400 mt-1">Date: <span className="text-slate-200">{format(selectedSlot.start, 'EEEE, d MMMM yyyy')}</span></p>
              <p className="text-slate-400 mt-1">Time: <span className="text-slate-200">{format(selectedSlot.start, 'h:mm a')} – {format(selectedSlot.end, 'h:mm a')}</span></p>
              <p className="text-slate-400 mt-1">Duration: <span className="text-slate-200">45 minutes</span></p>
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">Booking mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBookingMode('adhoc')}
                  className={`text-xs py-2 rounded-lg border transition-colors ${bookingMode === 'adhoc' ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300' : 'border-slate-700 text-slate-400'}`}
                >
                  Ad-hoc (once)
                </button>
                <button
                  onClick={() => setBookingMode('recurring')}
                  className={`text-xs py-2 rounded-lg border transition-colors ${bookingMode === 'recurring' ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300' : 'border-slate-700 text-slate-400'}`}
                >
                  Recurring weekly
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowBookModal(false)} className="flex-1 text-sm border border-slate-700 text-slate-400 hover:text-slate-200 py-2 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={confirmBooking} className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors">
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
