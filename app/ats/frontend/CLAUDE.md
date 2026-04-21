# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Serve the dist/ build locally
```

No linter or test suite is configured yet.

## Architecture

### Stack
React 18 + Vite 5, Tailwind CSS 3 (dark mode `class` strategy), React Router v6, ECharts 5 via `echarts-for-react`. Plain JS + JSX — no TypeScript.

### Two-layout routing pattern
`src/router.jsx` defines two nested route trees:
- **App layout** (`AppLayout`): sidebar + topbar + `<Outlet />`. Wraps all admin routes (`/dashboard`, `/jobs`, `/candidates`, `/pipeline`, `/interviews`, `/reports`). Guarded by `<RequireRole>`.
- **Public layout** (`PublicLayout`): minimal header only. Wraps `/careers` and `/careers/:jobId/apply`.

`RequireRole` reads from `AuthContext` and redirects candidates to `/careers`, non-admins away from `/reports`.

### State management
No external state library. Each domain has a Context + `useReducer` pair, with a matching `useXxx` hook:

| Context | Domain |
|---|---|
| `AuthContext` | Current user, role switching |
| `JobsContext` | Job requisitions, create/edit modal |
| `CandidatesContext` | Candidates, applications, filters, drawer |
| `InterviewsContext` | Interviews, feedback modal |
| `UIContext` | Sidebar collapsed state |

All providers are stacked in `src/main.jsx`. The pipeline page derives its Kanban columns directly from `CandidatesContext` — there is no separate pipeline context.

### Mock data
`src/data/mockData.js` is the single source of truth for all data. It exports `MOCK_USERS`, `MOCK_JOBS`, `MOCK_CANDIDATES`, `MOCK_APPLICATIONS`, `MOCK_INTERVIEWS`, and `MOCK_METRICS`. No API calls exist — all state mutations happen in-memory via context reducers. When wiring a real API, replace the initial state seeds in each context with fetched data and convert action handlers to async operations.

### `@` alias
`vite.config.js` maps `@` → `./src`. All imports use `@/` rather than relative paths.

### Tailwind conventions
- All styling is inline Tailwind utilities — no CSS modules.
- Dark mode is default: `class="dark"` is set on `<html>` in `index.html`, never toggled.
- Card pattern: `rounded-2xl border border-slate-800 bg-slate-900 p-5`
- Badge variants (`BaseBadge`): `indigo`, `emerald`, `amber`, `red`, `slate` — used consistently for job statuses and pipeline stages. Mappings live in `JobStatusBadge.jsx` and `StageBadge.jsx`.
- Animations (`animate-fade-in`, `animate-slide-in-right`) are defined as custom keyframes in `tailwind.config.js`.

### Charts
`FunnelChart`, `BarChart`, and `LineChart` in `src/components/charts/` are thin wrappers around `ReactECharts`. Each builds its own ECharts `option` object internally — pass only the data array and axis key names as props. Chart backgrounds are `'transparent'` so they inherit the card background.

### Role-based navigation
`AppSidebar` computes visible nav items from `currentUser.role`. The `RoleSwitcher` dropdown (top-right of topbar) calls `authStore.setRole()` to swap the mock user, which re-renders the sidebar and triggers router guards. Reports is admin-only; all other admin pages are visible to both `admin` and `hiring_manager`.

### Build output
Vite manual chunks split `vendor-react` (react, react-dom, react-router-dom) and `vendor-echarts` into separate files for long-term caching. The ECharts chunk exceeds 500 kB — this is expected and matches the RateScan sibling project.
