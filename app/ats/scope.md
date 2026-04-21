# Project Scope: Recruitment Platform (ATS)

## Overview

A web-based Applicant Tracking System (ATS) that enables HR teams and hiring managers to manage the full recruitment lifecycle — from job creation through to candidate hire. The platform is built in phases, with an MVP focused on replacing manual spreadsheet-based workflows.

---

## Phase 1 — MVP

**Target delivery: 6–8 weeks**

The MVP delivers the core hiring workflow sufficient to onboard real users and replace spreadsheets.

### 1. User & Access Management

- User roles: Admin (HR), Hiring Manager, Candidate
- Role-based access control (RBAC)
- Email authentication (SSO optional in a later phase)
- Activity and audit logs for candidate actions and status changes

### 2. Job Requisition Management

- Create and manage job requisitions with the following details:
  - Title, description, location, salary range
  - Employment type (full-time, part-time, contract, etc.)
- Job status lifecycle: Draft → Open → Closed → On Hold → Archived
- Approval workflow: Hiring Manager → HR → Approval
- Versioning of job descriptions

### 3. Job Posting & Distribution

- Publish jobs internally and to external job boards (manual in Phase 1, API-based in Phase 2)
- Basic employer branding: company logo and description

### 4. Candidate Application Portal

- Public-facing application form per role:
  - Personal details
  - Resume upload
  - Optional cover letter
- Apply via shareable link
- Confirmation email sent on submission

### 5. Candidate Management

- Candidate profile containing:
  - Personal information
  - Uploaded resume and supporting documents
  - Full application history
  - Tags (skills, role fit, priority)
  - Recruiter notes and comments
- Candidate search and filtering

### 6. Hiring Pipeline

- Customisable pipeline stages:
  - Applied → Screening → Interview → Final Interview → Offer → Hired / Rejected
- Status change history log per candidate

### 7. Resume Handling

- Resume upload and secure storage
- Manual review in Phase 1; automated parsing in Phase 2

### 8. Interview Management

- Manual interview scheduling
- Interview types: Phone, Video, In-person
- Interview feedback forms with ratings and comments
- Interview panel assignment

### 9. Communication & Notifications

- Email templates for: application received, interview invite, rejection, offer
- Bulk email capability
- Automated notifications for stage changes and interview reminders
- Per-candidate communication history

### 10. Audit Trail

- Full candidate journey tracking: Application → Screening → HR Review → HM Review → Interview → Offer
- Action-level visibility: who performed each action (HR, Hiring Manager, or system)
- Each entry captures: timestamp, reviewer name, and feedback

### 11. Reporting & Analytics

- Hiring metrics: time-to-hire, time-in-stage, stage conversion rates
- Source tracking (where candidates originated)
- Recruiter performance metrics

### 12. Careers Page

- Public job listings page with apply button per role
- Basic branding: logo and company description
- Mobile responsive

---

## Phase 2 — Integrations

- Calendar integration: Google Calendar, Outlook
- Job board integrations: Seek, LinkedIn, JORA
- Automated resume parsing (name, experience, skills extraction)

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
