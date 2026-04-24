# Project Scope: Advice Lab ATS

## Overview

A web-based Applicant Tracking System (ATS) that enables HR teams and hiring managers to manage the full recruitment lifecycle — from job creation through to candidate hire. Built and maintained by CognifyLabs.ai. Hosted at ats.advicelab.com.au.

The platform is built in phases, with the MVP focused on replacing manual spreadsheet-based workflows.

---

## Phase 1 — MVP ✅ Delivered

### 1. User & Access Management ✅

- User roles: Admin, Hiring Manager (role stored as `custom:role` in Cognito)
- Role-based access control (RBAC) on all routes — frontend and backend enforced
- Email authentication via AWS Cognito (JWT)
- First-login password reset flow: Cognito `NEW_PASSWORD_REQUIRED` challenge handled in `LoginPage`
- Admin user management: invite, enable/disable, delete, role update via `/users` routes
- Email is case-insensitive at login (normalised to lowercase before Cognito auth)
- Password minimum length: 8 characters

### 2. Job Requisition Management ✅

- Create and manage job requisitions: title, description, location, salary range, employment type
- Job status lifecycle: Draft → Open → Closed → On Hold → Archived
- Approval workflow and versioning: out of scope for Phase 1

### 3. Job Posting & Distribution ✅

- Jobs published to the public careers page immediately on status → Open
- External job board integrations (Seek, LinkedIn, JORA): Phase 2

### 4. Candidate Application Portal ✅

- Public-facing application form per role: personal details, resume upload, optional cover letter
- Apply via shareable link (`/careers/:jobId/apply`)
- Confirmation email sent on submission via async Lambda notification

### 5. Candidate Management ✅

- Candidate profile: personal info, resume, application history, tags, recruiter notes
- Candidate search and filtering on the Candidates page
- **Communication Score**: manual 1–10 rating set by recruiters in the Candidate Drawer; auto-saved on click; specific to each candidate (resets on drawer switch)
- Tags: add/remove inline in the Candidate Drawer

### 6. Hiring Pipeline ✅

- Kanban board view: Applied → Screening → Interview → Final Interview → Offer → Hired / Rejected
- Drag-and-drop stage moves via `@dnd-kit/core` with optimistic UI (instant move, reverts on API error)
- Stage move also available from inline card dropdown and Candidate Drawer
- Stage change history log per application (displayed in Candidate Drawer)
- **Fit Score**: manual 1–10 rating set per application; displayed as a progress bar on Kanban cards; auto-saved on click in the Candidate Drawer; audited on every change

### 7. Resume Handling ✅

- Resume upload to S3 via pre-signed URL (`POST /resumes/upload-url`)
- Secure storage in `s3://advicelab/ats/resumes/{env}/`
- Automated parsing: Phase 2

### 8. Interview Management ✅

- Manual interview scheduling with date/time, type, duration, panel members, location/link
- Interview types: Phone, Video, In-person
- Interview feedback forms with ratings, recommendation, and comments
- **One active interview per application**: creating a second Scheduled interview returns a 409 conflict; frontend shows a warning banner and disables submit
- **Cancel with reason**: admins and hiring managers can cancel a scheduled interview with a mandatory reason; cancellation is logged in the audit trail
- **Cancelled interviews are hidden**: excluded from all UI views (upcoming list, past list, calendar) but retained in DynamoDB for audit purposes
- **Calendar view**: `react-big-calendar` week view with clickable event panel (reschedule, cancel, feedback)
- **List view**: Upcoming (Scheduled) and Past (Completed, No-show) sections
- **Filters**: search by candidate name or job title; filter by position, panel member, date
- **Time-based row differentiation**: interviews currently in progress are highlighted with a green background and "Ongoing" pill badge

### 9. Communication & Notifications ✅

- Email templates: application received, interview invite, stage change, offer, rejection
- Async Lambda notifications (fire-and-forget, wrapped in `try/except` — email failures never affect API responses)
- Per-candidate communication history: Phase 2

### 10. Audit Trail ✅

- Audit items stored in DynamoDB: `PK=AUDIT#{entityId}`, `SK={timestamp}#{action}`
- Each entry captures: timestamp, action type, actor ID, actor name, detail text
- Actions audited: fit score updates, stage moves, interview cancellations (with reason)
- **Audit trail displayed in the Candidate Drawer** under the "Activity" section — lazy-loaded from `GET /audit/{applicationId}` when the drawer opens
- Query API: `GET /audit/{entityId}` (admin-only)

### 11. Reporting & Analytics ✅

- Hiring metrics: time-to-hire, time-in-stage, stage conversion rates
- Source tracking, recruiter performance metrics
- Dashboard with summary stat cards and ECharts visualisations

### 12. Careers Page ✅

- Public job listings at `/careers` with apply button per role
- Individual job detail page at `/careers/:jobId`
- Mobile responsive

### 13. Legal & Branding ✅

- Application name: **Advice Lab** (previously "Recruit" — fully replaced)
- Footer on all pages: copyright "AdviceLab Pty Ltd", built by CognifyLabs.ai with link
- Privacy Policy page (`/privacy`): covers Australian Privacy Act 1988, APPs, AWS Sydney storage, OAIC complaint pathway
- Terms of Use page (`/terms`): covers authorised use, candidate submissions, prohibited conduct, NSW law
- Both pages are placeholders and must be reviewed by a lawyer before going live with real candidates

---

## Phase 2 — Integrations

- Calendar integration: Google Calendar, Outlook
- Job board integrations: Seek, LinkedIn, JORA
- Automated resume parsing (name, experience, skills extraction)
- Per-candidate communication history log
- Bulk email capability

---

## Phase 3 — AI Features

- Resume scoring against job description
- Candidate ranking and auto-shortlisting
- Job description generator
- Interview question suggestions

---

## Out of Scope (for now)

- SSO / social login
- Payroll or onboarding workflows
- Multi-tenancy / white-labelling
- Mobile app
