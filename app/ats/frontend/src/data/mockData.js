// ─── LOOKUP TABLES ────────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Interview',
  'Final Interview',
  'Offer',
  'Hired',
  'Rejected',
]

export const JOB_STATUSES = ['Draft', 'Open', 'Closed', 'On Hold', 'Archived']

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Casual']

export const INTERVIEW_TYPES = ['Phone', 'Video', 'In-person']

export const SOURCE_CHANNELS = ['LinkedIn', 'Seek', 'Referral', 'Direct', 'JORA', 'Other']

// ─── USERS ────────────────────────────────────────────────────────────────────

export const MOCK_USERS = [
  {
    id: 'u1',
    name: 'Sarah Chen',
    email: 'sarah.chen@acme.com',
    role: 'admin',
    avatarInitials: 'SC',
    department: 'Human Resources',
  },
  {
    id: 'u2',
    name: 'James Okafor',
    email: 'james.okafor@acme.com',
    role: 'hiring_manager',
    avatarInitials: 'JO',
    department: 'Engineering',
  },
  {
    id: 'u3',
    name: 'Priya Nair',
    email: 'priya.nair@acme.com',
    role: 'hiring_manager',
    avatarInitials: 'PN',
    department: 'Product',
  },
  {
    id: 'u4',
    name: 'Tom Walsh',
    email: 'tom.walsh@email.com',
    role: 'candidate',
    avatarInitials: 'TW',
    department: null,
  },
]

// ─── JOBS ─────────────────────────────────────────────────────────────────────

export const MOCK_JOBS = [
  {
    id: 'j1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Sydney, NSW',
    employmentType: 'Full-time',
    salaryMin: 130000,
    salaryMax: 160000,
    salaryCurrency: 'AUD',
    status: 'Open',
    description:
      'We are looking for a Senior Frontend Engineer to lead UI development across our core products. You will work closely with design and backend teams to deliver polished, performant experiences.\n\nKey responsibilities:\n- Build and maintain React-based web applications\n- Define frontend architecture and coding standards\n- Mentor junior engineers\n- Collaborate with product and design on feature delivery',
    hiringManagerId: 'u2',
    createdAt: '2026-03-10',
    updatedAt: '2026-04-01',
    applicantCount: 24,
  },
  {
    id: 'j2',
    title: 'Product Manager',
    department: 'Product',
    location: 'Melbourne, VIC (Remote OK)',
    employmentType: 'Full-time',
    salaryMin: 120000,
    salaryMax: 145000,
    salaryCurrency: 'AUD',
    status: 'Open',
    description:
      'We are searching for an experienced Product Manager to own the roadmap for our B2B SaaS platform. You will work with engineering, design, and customer success to prioritise and deliver high-impact features.\n\nKey responsibilities:\n- Define and maintain product roadmap\n- Write clear product specifications\n- Conduct user research and synthesise insights\n- Track KPIs and report to leadership',
    hiringManagerId: 'u3',
    createdAt: '2026-03-18',
    updatedAt: '2026-04-05',
    applicantCount: 18,
  },
  {
    id: 'j3',
    title: 'UX Designer',
    department: 'Design',
    location: 'Remote',
    employmentType: 'Contract',
    salaryMin: 90000,
    salaryMax: 110000,
    salaryCurrency: 'AUD',
    status: 'Open',
    description:
      'Contract UX Designer role for a 6-month engagement to help us redesign our onboarding flow and design system. Strong Figma skills and experience with design systems required.',
    hiringManagerId: 'u2',
    createdAt: '2026-04-01',
    updatedAt: '2026-04-10',
    applicantCount: 11,
  },
  {
    id: 'j4',
    title: 'Data Engineer',
    department: 'Engineering',
    location: 'Sydney, NSW',
    employmentType: 'Full-time',
    salaryMin: 125000,
    salaryMax: 155000,
    salaryCurrency: 'AUD',
    status: 'Draft',
    description: 'Draft — role pending budget approval for upcoming data team expansion.',
    hiringManagerId: 'u2',
    createdAt: '2026-04-15',
    updatedAt: '2026-04-15',
    applicantCount: 0,
  },
  {
    id: 'j5',
    title: 'Customer Success Manager',
    department: 'Customer Success',
    location: 'Brisbane, QLD',
    employmentType: 'Full-time',
    salaryMin: 95000,
    salaryMax: 115000,
    salaryCurrency: 'AUD',
    status: 'Closed',
    description: 'Role has been filled. Closed 20 March 2026.',
    hiringManagerId: 'u3',
    createdAt: '2026-01-10',
    updatedAt: '2026-03-20',
    applicantCount: 42,
  },
]

// ─── CANDIDATES ───────────────────────────────────────────────────────────────

export const MOCK_CANDIDATES = [
  {
    id: 'c1',
    firstName: 'Alex',
    lastName: 'Murdoch',
    email: 'alex.murdoch@email.com',
    phone: '+61 412 000 001',
    location: 'Sydney, NSW',
    linkedinUrl: 'https://linkedin.com/in/alexmurdoch',
    resumeUrl: '#',
    coverLetterText:
      'I am very excited about the Senior Frontend Engineer opportunity. With 7 years of React experience and a strong eye for UI quality, I believe I can make an immediate impact on your team.',
    source: 'LinkedIn',
    tags: ['React', 'TypeScript', 'Senior'],
    notes: 'Strong portfolio. Referred by James. Fast responses to comms.',
    createdAt: '2026-03-12',
  },
  {
    id: 'c2',
    firstName: 'Bina',
    lastName: 'Sharma',
    email: 'bina.sharma@email.com',
    phone: '+61 412 000 002',
    location: 'Melbourne, VIC',
    linkedinUrl: '',
    resumeUrl: '#',
    coverLetterText:
      'As a product manager with 8 years experience in B2B SaaS, I have a proven track record of shipping products that customers love.',
    source: 'Seek',
    tags: ['B2B SaaS', 'Agile', 'Roadmapping'],
    notes: '',
    createdAt: '2026-03-20',
  },
  {
    id: 'c3',
    firstName: 'Chris',
    lastName: 'Tran',
    email: 'chris.tran@email.com',
    phone: '+61 412 000 003',
    location: 'Remote',
    linkedinUrl: 'https://linkedin.com/in/christran',
    resumeUrl: '#',
    coverLetterText: '',
    source: 'Referral',
    tags: ['Figma', 'User Research', 'Design Systems'],
    notes: 'Very strong design systems background. Worked at Atlassian previously.',
    createdAt: '2026-04-03',
  },
  {
    id: 'c4',
    firstName: 'Danielle',
    lastName: 'Kim',
    email: 'danielle.kim@email.com',
    phone: '+61 412 000 004',
    location: 'Sydney, NSW',
    linkedinUrl: '',
    resumeUrl: '#',
    coverLetterText:
      'I am applying for the Senior Frontend Engineer position. I have 4 years of experience with Vue and React and am eager to grow into a senior role.',
    source: 'Direct',
    tags: ['Vue', 'Node.js', 'Mid-level'],
    notes: '',
    createdAt: '2026-04-07',
  },
  {
    id: 'c5',
    firstName: 'Ethan',
    lastName: 'Brooks',
    email: 'ethan.brooks@email.com',
    phone: '+61 412 000 005',
    location: 'Brisbane, QLD',
    linkedinUrl: 'https://linkedin.com/in/ethanbrooks',
    resumeUrl: '#',
    coverLetterText: '',
    source: 'JORA',
    tags: ['Product', 'Analytics', 'Growth'],
    notes: 'Impressive metrics from previous role — grew NPS by 22 points. Highly recommended.',
    createdAt: '2026-03-25',
  },
]

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

export const MOCK_APPLICATIONS = [
  {
    id: 'a1',
    candidateId: 'c1',
    jobId: 'j1',
    stage: 'Interview',
    appliedAt: '2026-03-13',
    fitScore: 88,
    assignedInterviewerId: 'u2',
    stageHistory: [
      { stage: 'Applied',   movedAt: '2026-03-13', movedBy: 'system', note: 'Application received' },
      { stage: 'Screening', movedAt: '2026-03-15', movedBy: 'u1',     note: 'Phone screen booked' },
      { stage: 'Interview', movedAt: '2026-03-22', movedBy: 'u1',     note: 'Moved to panel interview' },
    ],
  },
  {
    id: 'a2',
    candidateId: 'c2',
    jobId: 'j2',
    stage: 'Screening',
    appliedAt: '2026-03-21',
    fitScore: 74,
    assignedInterviewerId: null,
    stageHistory: [
      { stage: 'Applied',   movedAt: '2026-03-21', movedBy: 'system', note: 'Application received' },
      { stage: 'Screening', movedAt: '2026-03-26', movedBy: 'u1',     note: '' },
    ],
  },
  {
    id: 'a3',
    candidateId: 'c3',
    jobId: 'j3',
    stage: 'Applied',
    appliedAt: '2026-04-04',
    fitScore: 81,
    assignedInterviewerId: null,
    stageHistory: [
      { stage: 'Applied', movedAt: '2026-04-04', movedBy: 'system', note: 'Application received' },
    ],
  },
  {
    id: 'a4',
    candidateId: 'c4',
    jobId: 'j1',
    stage: 'Screening',
    appliedAt: '2026-04-08',
    fitScore: 66,
    assignedInterviewerId: null,
    stageHistory: [
      { stage: 'Applied',   movedAt: '2026-04-08', movedBy: 'system', note: 'Application received' },
      { stage: 'Screening', movedAt: '2026-04-12', movedBy: 'u1',     note: '' },
    ],
  },
  {
    id: 'a5',
    candidateId: 'c5',
    jobId: 'j2',
    stage: 'Final Interview',
    appliedAt: '2026-03-26',
    fitScore: 92,
    assignedInterviewerId: 'u3',
    stageHistory: [
      { stage: 'Applied',         movedAt: '2026-03-26', movedBy: 'system', note: 'Application received' },
      { stage: 'Screening',       movedAt: '2026-03-28', movedBy: 'u1',     note: '' },
      { stage: 'Interview',       movedAt: '2026-04-02', movedBy: 'u3',     note: 'Strong candidate' },
      { stage: 'Final Interview', movedAt: '2026-04-10', movedBy: 'u3',     note: 'Recommend advancing' },
    ],
  },
]

// ─── INTERVIEWS ───────────────────────────────────────────────────────────────

export const MOCK_INTERVIEWS = [
  {
    id: 'i1',
    applicationId: 'a1',
    candidateId: 'c1',
    jobId: 'j1',
    type: 'Video',
    scheduledAt: '2026-04-22T10:00:00+10:00',
    durationMinutes: 60,
    panelIds: ['u2'],
    meetingLink: 'https://meet.google.com/mock-link-1',
    status: 'Scheduled',
    feedback: null,
  },
  {
    id: 'i2',
    applicationId: 'a5',
    candidateId: 'c5',
    jobId: 'j2',
    type: 'In-person',
    scheduledAt: '2026-04-24T14:00:00+10:00',
    durationMinutes: 90,
    panelIds: ['u3', 'u1'],
    meetingLink: null,
    status: 'Scheduled',
    feedback: null,
  },
  {
    id: 'i3',
    applicationId: 'a2',
    candidateId: 'c2',
    jobId: 'j2',
    type: 'Phone',
    scheduledAt: '2026-04-18T09:00:00+10:00',
    durationMinutes: 30,
    panelIds: ['u1'],
    meetingLink: null,
    status: 'Completed',
    feedback: {
      rating: 4,
      strengths: 'Clear product thinking, strong stakeholder management examples.',
      concerns: 'Limited technical depth on data-driven prioritisation.',
      recommendation: 'Advance',
      submittedBy: 'u1',
      submittedAt: '2026-04-18T10:05:00+10:00',
    },
  },
]

// ─── DASHBOARD METRICS ────────────────────────────────────────────────────────

export const MOCK_METRICS = {
  asOf: '2026-04-21',
  openRoles: 3,
  totalCandidates: 53,
  inPipeline: 21,
  avgTimeToHireDays: 28,
  offerAcceptanceRate: 0.82,
  stageFunnel: [
    { stage: 'Applied',         count: 53 },
    { stage: 'Screening',       count: 31 },
    { stage: 'Interview',       count: 18 },
    { stage: 'Final Interview', count: 9  },
    { stage: 'Offer',           count: 5  },
    { stage: 'Hired',           count: 4  },
  ],
  timeToHireTrend: [
    { week: 'W1 Mar', days: 35 },
    { week: 'W2 Mar', days: 32 },
    { week: 'W3 Mar', days: 30 },
    { week: 'W4 Mar', days: 28 },
    { week: 'W1 Apr', days: 27 },
    { week: 'W2 Apr', days: 29 },
    { week: 'W3 Apr', days: 26 },
    { week: 'W4 Apr', days: 28 },
  ],
  timeInStage: [
    { stage: 'Applied → Screening',   avgDays: 3.2 },
    { stage: 'Screening → Interview', avgDays: 6.8 },
    { stage: 'Interview → Final',     avgDays: 7.4 },
    { stage: 'Final → Offer',         avgDays: 4.1 },
    { stage: 'Offer → Hired',         avgDays: 5.5 },
  ],
  sourceBreakdown: [
    { source: 'LinkedIn', count: 22 },
    { source: 'Seek',     count: 14 },
    { source: 'Referral', count: 9  },
    { source: 'Direct',   count: 5  },
    { source: 'JORA',     count: 3  },
  ],
}
