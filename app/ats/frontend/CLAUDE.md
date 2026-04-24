# CLAUDE.md — ATS Frontend

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173 (mock data)
npm run build     # Production build → dist/
npm run preview   # Serve the dist/ build locally
```

No linter or test suite is configured yet.

## Dependencies

All dependencies are tracked in `package.json`. Always use `--save` when installing new packages — a bare `npm install <pkg>` without `--save` will not persist the entry and the next `npm install` will remove it.

| Package | Purpose |
|---------|---------|
| `react`, `react-dom`, `react-router-dom` | Core framework |
| `echarts`, `echarts-for-react` | Charts (dashboard/reports) |
| `amazon-cognito-identity-js` | Cognito login, logout, new password challenge |
| `@dnd-kit/core`, `@dnd-kit/utilities` | Drag-and-drop on the Kanban pipeline board |
| `react-big-calendar` | Calendar view on the Interviews page |
| `date-fns` | Date formatting (localiser for react-big-calendar) |

## Architecture

### Stack
React 18 + Vite 5, Tailwind CSS 3 (dark mode `class` strategy), React Router v6, ECharts 5 via `echarts-for-react`. Plain JS + JSX — no TypeScript.

### Two-layout routing pattern
`src/router.jsx` defines two nested route trees:
- **AppLayout**: sidebar + topbar + compact footer + `<Outlet />`. Wraps all admin routes. Guarded by `<RequireRole allowed={['admin', 'hiring_manager']}>`.
- **PublicLayout**: minimal header + full footer + `<Outlet />`. Wraps all public routes.

`RequireRole` reads from `AuthContext` and redirects candidates to `/careers`, non-admins away from `/reports` and `/users`.

### Routes
| Path | Page | Auth |
|------|------|------|
| `/careers` | CareersPage | None |
| `/careers/:jobId` | JobDetailPage | None |
| `/careers/:jobId/apply` | ApplicationPage | None |
| `/privacy` | PrivacyPolicyPage | None |
| `/terms` | TermsOfUsePage | None |
| `/login` | LoginPage | None |
| `/dashboard` | DashboardPage | admin, hiring_manager |
| `/jobs` | JobsPage | admin, hiring_manager |
| `/candidates` | CandidatesPage | admin, hiring_manager |
| `/pipeline` | PipelinePage | admin, hiring_manager |
| `/interviews` | InterviewsPage | admin, hiring_manager |
| `/reports` | ReportsPage | admin only |
| `/users` | UsersPage | admin only |

### State management
No external state library. Each domain has a Context + `useReducer` pair with a matching `useXxx` hook:

| Context | Hook | Domain |
|---------|------|--------|
| `AuthContext` | `useAuth` | Current user, role, Cognito session |
| `JobsContext` | `useJobs` | Job requisitions, create/edit modal |
| `CandidatesContext` | `useCandidates` | Candidates, applications, filters, drawer |
| `InterviewsContext` | `useInterviews` | Interviews, schedule modal, feedback modal |
| `UsersContext` | `useUsers` | Platform users, invite/edit/enable/disable/delete |
| `UIContext` | `useUI` | Sidebar collapsed state |

All providers are stacked in `src/main.jsx`.

### Key context behaviours

**InterviewsContext:**
- `upcomingInterviews` = `Scheduled` only, sorted ascending.
- `pastInterviews` = `Completed` and `No-show` only. **Cancelled is excluded** — cancelled interviews disappear from the UI entirely.
- `updateInterview` is exposed in the provider value — do not remove it.
- `openScheduleModal(context, interviewId?)` — pass `interviewId` for reschedule mode.

**UsersContext:**
- `userById(id)` helper resolves a user UUID to a user object — use this in any component displaying panel member names.
- Available to both `admin` and `hiring_manager` (hiring managers need it for panel name resolution).

### Mock data
`src/data/mockData.js` exports `MOCK_USERS`, `MOCK_JOBS`, `MOCK_CANDIDATES`, `MOCK_APPLICATIONS`, `MOCK_INTERVIEWS`, `MOCK_METRICS`, and lookup constants. Used when `VITE_API_URL` is not set (dev mode). When wiring a real API, replace context seeds and convert handlers to async.

### `@` alias
`vite.config.js` maps `@` → `./src`. All imports use `@/` rather than relative paths.

### Tailwind conventions
- All styling is inline Tailwind utilities — no CSS modules.
- Dark mode is default: `class="dark"` is set on `<html>` in `index.html`, never toggled.
- Card pattern: `rounded-2xl border border-slate-800 bg-slate-900 p-5`
- Badge variants (`BaseBadge`): `indigo`, `emerald`, `amber`, `red`, `slate`.
- Animations: `animate-fade-in`, `animate-fade-up`, `animate-slide-in-right`, `animate-slide-in-left` — defined in `tailwind.config.js`.
- Light mode overrides live in `src/index.css`.

### Branding
App name is **Advice Lab** everywhere. Do not use "Recruit" — it was the original placeholder and has been fully replaced.

### Footer
`AppFooter` component at `src/components/layout/AppFooter.jsx`:
- `variant="admin"` — compact, offset for sidebar, used in `AppLayout`.
- `variant="public"` — full footer with Privacy/Terms/Careers links, used in `PublicLayout`.

### Calendar (InterviewsPage)
`react-big-calendar` with `date-fns` localiser. Import the locale directly:
```js
import enAU from 'date-fns/locale/en-AU'  // ✓ correct
import { enAU } from 'date-fns/locale'     // ✗ Vite cannot resolve this barrel export
```
Calendar dark theme is applied via the `.rbc-dark` wrapper class — overrides are in `src/index.css`.

### Drag-and-drop (PipelinePage)
`@dnd-kit/core` with `PointerSensor` (5 px activation threshold). `KanbanBoard` → `DndContext`, `KanbanColumn` → `useDroppable`, `KanbanCard` → `useDraggable`. Pass `isDragOverlay` to the ghost card rendered in `DragOverlay`.

### Charts
`FunnelChart`, `BarChart`, `LineChart` in `src/components/charts/` are thin wrappers around `ReactECharts`. Chart backgrounds are `'transparent'`.

### Role-based navigation
`AppSidebar` computes visible nav items from `currentUser.role`. Reports and Users are admin-only. `RoleSwitcher` (topbar) swaps the mock user in dev mode.

### Build output
Vite manual chunks split `vendor-react` and `vendor-echarts` for long-term caching. The ECharts chunk exceeds 500 kB — expected.
