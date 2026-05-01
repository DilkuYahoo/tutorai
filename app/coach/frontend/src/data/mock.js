import { addDays, subDays, addHours, format, startOfWeek, addWeeks } from 'date-fns'

const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

// ─── Coaches ──────────────────────────────────────────────────────────────────
export const coaches = [
  {
    id: 'coach-1',
    name: 'Rahul Sharma',
    bio: 'Former state-level cricketer with 15 years of coaching experience. Specialises in batting technique and mental game.',
    photo: 'https://i.pravatar.cc/150?img=11',
    rate: 80,
    instagram: 'rahulsharma_cricket',
    youtube: 'RahulSharmaCoaching',
    active: true,
    email: 'rahul@example.com',
    packages: ['pkg-1', 'pkg-2'],
  },
  {
    id: 'coach-2',
    name: 'Priya Patel',
    bio: 'Pace bowling specialist. Works with junior and senior players on run-up mechanics, seam positioning, and variations.',
    photo: 'https://i.pravatar.cc/150?img=47',
    rate: 90,
    instagram: 'priyapatel_pace',
    youtube: null,
    active: true,
    email: 'priya@example.com',
    packages: ['pkg-1', 'pkg-3'],
  },
  {
    id: 'coach-3',
    name: 'James Thornton',
    bio: 'All-rounder coach focusing on fielding excellence, throwing technique, and ground fielding drills.',
    photo: 'https://i.pravatar.cc/150?img=15',
    rate: 75,
    instagram: null,
    youtube: 'JTCricketAcademy',
    active: true,
    email: 'james@example.com',
    packages: ['pkg-2'],
  },
]

export const superCoach = {
  id: 'super-1',
  name: 'Michael Clarke',
  bio: 'Head coach and founder. Former first-class cricketer. Oversees all coaching programs and player development.',
  photo: 'https://i.pravatar.cc/150?img=12',
  rate: 120,
  instagram: 'michaelclarke_hc',
  youtube: null,
  active: true,
  email: 'michael@example.com',
  packages: ['pkg-1', 'pkg-2', 'pkg-3'],
}

// ─── Package Templates ─────────────────────────────────────────────────────────
export const packageTemplates = [
  { id: 'pkg-1', name: 'Trial', tier: 'Trial', sessionCount: 1, price: 85, description: 'Single trial session to get started.' },
  { id: 'pkg-2', name: 'Standard', tier: 'Standard', sessionCount: 10, price: 750, description: '10 x 45-minute sessions. Best value for regular training.' },
  { id: 'pkg-3', name: 'Premium', tier: 'Premium', sessionCount: 20, price: 1400, description: '20 x 45-minute sessions with priority scheduling.' },
]

// ─── Players ───────────────────────────────────────────────────────────────────
export const players = [
  { id: 'player-1', name: 'Sam Wilson', email: 'sam@example.com', parentId: null, coachId: 'coach-1' },
  { id: 'player-2', name: 'Lily Chen', email: 'lily@example.com', parentId: 'parent-1', coachId: 'coach-1' },
  { id: 'player-3', name: 'Aiden Brooks', email: 'aiden@example.com', parentId: null, coachId: 'coach-2' },
  { id: 'player-4', name: 'Nina Park', email: 'nina@example.com', parentId: 'parent-2', coachId: 'super-1' },
]

export const parents = [
  { id: 'parent-1', name: 'Sandra Chen', email: 'sandra@example.com', childIds: ['player-2'] },
  { id: 'parent-2', name: 'David Park', email: 'david@example.com', childIds: ['player-4'] },
]

// ─── Credit Ledger ─────────────────────────────────────────────────────────────
export const creditLedger = {
  'player-1': {
    available: 6,
    committed: 2,
    totalPurchased: 10,
    entries: [
      { id: 'l1', type: 'purchase', delta: 10, balanceAvailable: 10, balanceCommitted: 0, packageId: 'pkg-2', date: subDays(today, 30) },
      { id: 'l2', type: 'booking_reserve', delta: -1, balanceAvailable: 9, balanceCommitted: 1, sessionId: 's1', coachId: 'coach-1', date: subDays(today, 20) },
      { id: 'l3', type: 'session_complete', delta: -1, balanceAvailable: 8, balanceCommitted: 0, sessionId: 's1', coachId: 'coach-1', date: subDays(today, 14) },
      { id: 'l4', type: 'booking_reserve', delta: -1, balanceAvailable: 7, balanceCommitted: 1, sessionId: 's2', coachId: 'coach-1', date: subDays(today, 10) },
      { id: 'l5', type: 'session_complete', delta: -1, balanceAvailable: 6, balanceCommitted: 0, sessionId: 's2', coachId: 'coach-1', date: subDays(today, 7) },
      { id: 'l6', type: 'booking_reserve', delta: -1, balanceAvailable: 5, balanceCommitted: 1, sessionId: 's3', coachId: 'coach-1', date: subDays(today, 3) },
      { id: 'l7', type: 'booking_reserve', delta: -1, balanceAvailable: 6, balanceCommitted: 2, sessionId: 's4', coachId: 'coach-1', date: subDays(today, 1) },
    ],
  },
  'player-2': {
    available: 3,
    committed: 1,
    totalPurchased: 5,
    entries: [
      { id: 'l8', type: 'purchase', delta: 5, balanceAvailable: 5, balanceCommitted: 0, packageId: 'pkg-1', date: subDays(today, 20) },
      { id: 'l9', type: 'booking_reserve', delta: -1, balanceAvailable: 4, balanceCommitted: 1, sessionId: 's5', coachId: 'coach-1', date: subDays(today, 15) },
      { id: 'l10', type: 'session_complete', delta: -1, balanceAvailable: 3, balanceCommitted: 0, sessionId: 's5', coachId: 'coach-1', date: subDays(today, 8) },
      { id: 'l11', type: 'booking_reserve', delta: -1, balanceAvailable: 3, balanceCommitted: 1, sessionId: 's6', coachId: 'coach-1', date: today },
    ],
  },
}

// ─── Sessions ──────────────────────────────────────────────────────────────────
function slot(daysOffset, hour, minute = 0) {
  const d = new Date(today)
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

export const sessions = [
  // Completed sessions
  {
    id: 's1',
    playerId: 'player-1',
    coachId: 'coach-1',
    start: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0), 14),
    end: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45), 14),
    status: 'completed',
    type: 'recurring',
    venue: 'Central Park Cricket Ground — Net 3',
    summary: 'Focused on back-foot defensive shots. Sam showed great improvement in keeping his elbow up.',
    invoice: { id: 'inv-1', status: 'paid', amount: 80 },
    comments: [{ id: 'c1', body: 'Great session today Sam — keep working on that elbow.', coachId: 'coach-1', date: subDays(today, 14) }],
    videos: [
      { id: 'v1', url: '#', uploadedBy: 'coach', title: 'Back-foot defence drill walkthrough' },
    ],
  },
  {
    id: 's2',
    playerId: 'player-1',
    coachId: 'coach-1',
    start: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0), 7),
    end: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45), 7),
    status: 'completed',
    type: 'recurring',
    venue: 'College Oval #2',
    summary: 'Cover drive work. Footwork was excellent. Need to keep the head still on contact.',
    invoice: { id: 'inv-2', status: 'paid', amount: 80 },
    comments: [],
    videos: [],
  },
  // Upcoming sessions
  {
    id: 's3',
    playerId: 'player-1',
    coachId: 'coach-1',
    start: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0), 0),
    end: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45), 0),
    status: 'booked',
    type: 'recurring',
    venue: 'Central Park Cricket Ground — Net 3',
    summary: null,
    invoice: null,
    comments: [],
    videos: [],
  },
  {
    id: 's4',
    playerId: 'player-1',
    coachId: 'coach-1',
    start: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0), 7),
    end: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45), 7),
    status: 'booked',
    type: 'recurring',
    venue: 'Central Park Cricket Ground — Net 3',
    summary: null,
    invoice: null,
    comments: [],
    videos: [],
  },
  // Player 2 sessions
  {
    id: 's5',
    playerId: 'player-2',
    coachId: 'coach-1',
    start: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0), 8),
    end: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 45), 8),
    status: 'completed',
    type: 'adhoc',
    venue: 'School Indoor Facility',
    summary: 'Intro session. Assessed Lily\'s batting stance and grip. Good natural talent.',
    invoice: { id: 'inv-3', status: 'pending', amount: 80 },
    comments: [],
    videos: [],
  },
  {
    id: 's6',
    playerId: 'player-2',
    coachId: 'coach-1',
    start: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0), 2),
    end: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 45), 2),
    status: 'booked',
    type: 'adhoc',
    venue: 'School Indoor Facility',
    summary: null,
    invoice: null,
    comments: [],
    videos: [],
  },
  // Coach 2 sessions
  {
    id: 's7',
    playerId: 'player-3',
    coachId: 'coach-2',
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 45),
    status: 'booked',
    type: 'adhoc',
    venue: 'Riverside Sports Complex',
    summary: null,
    invoice: null,
    comments: [],
    videos: [],
  },
  {
    id: 's8',
    playerId: 'player-4',
    coachId: 'super-1',
    start: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0), 1),
    end: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 45), 1),
    status: 'booked',
    type: 'recurring',
    venue: 'Central Park Cricket Ground — Net 1',
    summary: null,
    invoice: null,
    comments: [],
    videos: [],
  },
]

// ─── Availability Slots (Coach 1 — this week) ──────────────────────────────────
function availSlot(daysOffset, hour) {
  const s = slot(daysOffset, hour)
  const e = slot(daysOffset, hour)
  e.setMinutes(45)
  return { start: new Date(s), end: new Date(e) }
}

export const coachAvailability = {
  'coach-1': [0, 1, 2, 3, 4].flatMap(d =>
    [13, 14, 15, 16, 17].map(h => availSlot(d, h))
  ),
  'coach-2': [1, 2, 3].flatMap(d =>
    [9, 10, 11, 13, 14].map(h => availSlot(d, h))
  ),
  'coach-3': [0, 2, 4].flatMap(d =>
    [14, 15, 16].map(h => availSlot(d, h))
  ),
  'super-1': [0, 1, 2, 3, 4].flatMap(d =>
    [8, 9, 10].map(h => availSlot(d, h))
  ),
}

// ─── Invoices ──────────────────────────────────────────────────────────────────
export const invoices = [
  { id: 'inv-1', playerId: 'player-1', coachId: 'coach-1', amount: 80, status: 'paid', date: subDays(today, 14), sessionId: 's1' },
  { id: 'inv-2', playerId: 'player-1', coachId: 'coach-1', amount: 80, status: 'paid', date: subDays(today, 7), sessionId: 's2' },
  { id: 'inv-3', playerId: 'player-2', coachId: 'coach-1', amount: 80, status: 'pending', date: subDays(today, 8), sessionId: 's5' },
]

// ─── Reconciliation report entries ────────────────────────────────────────────
// ─── Late cancellations ────────────────────────────────────────────────────────
export const lateCancellations = [
  {
    id: 'lc-1',
    playerId: 'player-1',
    coachId: 'coach-1',
    sessionStart: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0), 3),
    cancelledAt: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0), 3),
    hoursNotice: 6,
    creditForfeited: 1,
  },
  {
    id: 'lc-2',
    playerId: 'player-3',
    coachId: 'coach-2',
    sessionStart: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0), 1),
    cancelledAt: subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30), 1),
    hoursNotice: 3.5,
    creditForfeited: 1,
  },
]

export const reconciliationEntries = [
  { id: 'r1', date: subDays(today, 30), player: 'Sam Wilson', parent: null, coach: 'Rahul Sharma', type: 'purchase', credits: +10, balance: 10, reference: 'Standard Package' },
  { id: 'r2', date: subDays(today, 20), player: 'Sam Wilson', parent: null, coach: 'Rahul Sharma', type: 'booking_reserve', credits: -1, balance: 9, reference: format(subDays(today, 14), 'dd MMM yyyy') + ' 3:00 pm' },
  { id: 'r3', date: subDays(today, 14), player: 'Sam Wilson', parent: null, coach: 'Rahul Sharma', type: 'session_complete', credits: -1, balance: 8, reference: format(subDays(today, 14), 'dd MMM yyyy') + ' 3:00 pm' },
  { id: 'r4', date: subDays(today, 20), player: 'Lily Chen', parent: 'Sandra Chen', coach: 'Rahul Sharma', type: 'purchase', credits: +5, balance: 5, reference: 'Trial Package' },
  { id: 'r5', date: subDays(today, 15), player: 'Lily Chen', parent: 'Sandra Chen', coach: 'Rahul Sharma', type: 'booking_reserve', credits: -1, balance: 4, reference: format(subDays(today, 8), 'dd MMM yyyy') + ' 10:00 am' },
  { id: 'r6', date: subDays(today, 8), player: 'Lily Chen', parent: 'Sandra Chen', coach: 'Rahul Sharma', type: 'session_complete', credits: -1, balance: 3, reference: format(subDays(today, 8), 'dd MMM yyyy') + ' 10:00 am' },
  { id: 'r7', date: subDays(today, 3), player: 'Sam Wilson', parent: null, coach: 'Rahul Sharma', type: 'manual_adjustment', credits: +1, balance: 7, reference: 'Make-up session credit', adjustedBy: 'Michael Clarke' },
]

export const COACH_COLORS = {
  'coach-1': '#6366f1',
  'coach-2': '#10b981',
  'coach-3': '#f59e0b',
  'super-1': '#ec4899',
}

export function getCoachById(id) {
  if (id === 'super-1') return superCoach
  return coaches.find(c => c.id === id)
}

export function getPlayerById(id) {
  return players.find(p => p.id === id)
}

export function getSessionsByCoach(coachId) {
  return sessions.filter(s => s.coachId === coachId)
}

export function getSessionsByPlayer(playerId) {
  return sessions.filter(s => s.playerId === playerId)
}
