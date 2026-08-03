# Task 11: Multi-Workspace / Multi-Business Architecture Setup

## Objective
Implement a Multi-Tenant Workspace model in Driplare dashboard similar to RepliBee/Vercel. A user can create and manage multiple businesses (Workspaces). Selecting a workspace from the Top Navbar dropdown dynamically filters all Chatbots, Channels, Automations, Orders, and Knowledge Bases to that specific business.

---

## Core Requirements

### 1. Database Schema (`workspaces` table)
- Create `workspaces` table/schema with `id`, `owner_id`, `name`, `logo_url`, `created_at`.
- Add `workspace_id` foreign key column to: `chatbots`, `channels`, `orders`, `leads`, `knowledge_bases`, and `automations`.

### 2. Workspace Context & Header Switcher Component
- Create `@components/dashboard/WorkspaceSwitcher.tsx` in the Top Navbar.
- Features:
  - Display current active workspace name & logo.
  - Dropdown listing all workspaces owned by the logged-in user.
  - Option to switch active workspace (persisted in Cookie / LocalStorage / React Context).
  - Modal to `+ Add New Business / Workspace`.

### 3. API Query Isolation
- Ensure all dashboard data queries (Inboxes, Orders, Chatbots, Integrations) are scoped to `WHERE workspace_id = activeWorkspace.id`.

---

## File Checklist 📁
- [ ] `docs/tasks/11_MULTI_WORKSPACE_ARCHITECTURE.md`
- [ ] `components/dashboard/WorkspaceSwitcher.tsx`
- [ ] Update Header / Navbar layout in `app/(dashboard)/layout.tsx`
- [ ] Create Context/Hook `useWorkspace()`