# 🧠 DriplareAI — Master Task File

> **Branch:** `feature-update`
> **Reference:** `docs/feature-update/pending-features.md`
> **Version:** 1.1.0

---

## 📌 Overview

This master task file defines the **core global rules** that ALL 8 individual feature tasks must follow without exception. Every developer and AI agent working on the `feature-update` branch must read and adhere to these rules before making any changes.

The 8 feature categories being implemented are:

1. 🟦 [Inbox & Conversation UX (Completed)](./task-01-inbox-ux.md)
2. [AI Agent Capabilities](./task-02-ai-agent.md)
3. [Order Management](./task-03-order-management.md)
4. [Smart Follow-up & Lead Engine](./task-04-followup-leads.md)
5. [Support Ticket System](./task-05-support-tickets.md)
6. [AI Training & Feedback](./task-06-ai-training.md)
7. [Analytics & Reporting](./task-07-analytics.md)
8. [Service Business / Booking Module](./task-08-booking.md)

---

## ⚙️ Rule 1 — Responsive Design & UI/UX Excellence (MANDATORY)

Every component and page introduced or modified in this branch **MUST be fully responsive** across all device breakpoints:

| Breakpoint      | Target Devices                   |
| --------------- | -------------------------------- |
| `sm` (640px+)   | Mobile portrait & landscape      |
| `md` (768px+)   | Tablet portrait                  |
| `lg` (1024px+)  | Tablet landscape & small desktop |
| `xl` (1280px+)  | Desktop                          |
| `2xl` (1536px+) | Large/ultra-wide monitors        |

### Implementation Guidelines

- Use Tailwind CSS responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`).
- **Never** use fixed pixel widths for layout containers — use `w-full`, `max-w-*`, `flex`, `grid`.
- Test layouts at 375px (iPhone SE), 768px (iPad), 1280px (laptop), and 1920px (desktop).
- Use `overflow-x-hidden` on page root to prevent horizontal scroll on mobile.
- Touch targets must be minimum **44×44px** on mobile (`min-h-11 min-w-11`).

### 💎 UI/UX Priority & Merchant Journey Standards

- **Absolute UI/UX Priority:** UI/UX design and interaction quality must be treated with the highest priority across all features.
- **Professional Merchant Journey:** Every workflow, navigation flow, and interaction screen must be optimized to deliver a completely professional, seamless, and intuitive journey for merchants/customers.
- **Smoothness & Industry Standards:** Animations, transitions, loading states, error boundaries, and empty states must feel extremely smooth, fluid, and adhere strictly to modern SaaS design standards.

---

## 🌙 Rule 2 — Dark Mode (MANDATORY)

The UI must be designed **primarily for dark mode** with full light mode support.

### Implementation Guidelines

- **NEVER use hardcoded Tailwind color classes** (e.g., `bg-blue-500`, `text-gray-700`).
- **ALWAYS use CSS Variables** defined in `app/globals.css`:

```css
/* Correct usage examples */
bg-background         /* page/surface background */
bg-card               /* card/panel background */
bg-muted              /* subtle background */
text-foreground       /* primary text */
text-muted-foreground /* secondary text */
border-border         /* borders */
bg-primary            /* brand action color (violet/blue gradient) */
text-primary          /* brand text */
```

- Always verify the component looks correct in **both** dark and light mode before marking as done.
- Use `dark:` prefix only when a CSS variable is insufficient.
- Gradients must use the project's violet-blue theme: `from-violet-600 to-blue-600` or equivalent CSS variables.

---

## 🌐 Rule 3 — Dual Language Support / i18n (MANDATORY)

All user-facing text **MUST be internationalized** using `react-i18next`. The project supports **Bengali (bn)** and **English (en)**.

### File Structure

```
public/locales/
  en/{namespace}.json    ← English translations
  bn/{namespace}.json    ← Bengali translations
```

### Implementation Guidelines

- **NEVER hardcode user-facing strings** in JSX (e.g., `<p>Submit</p>`).
- Use the `useTranslation` hook with the appropriate namespace:
  ```tsx
  const { t } = useTranslation("namespace-name");
  // Then: t("key.subkey")
  ```
- Create a **new namespace JSON file** for each new major feature page (e.g., `support-tickets.json`, `booking.json`).
- Register new namespaces in the i18n config if needed.
- **Technical terms** must NOT be translated into Bengali — keep them in English (e.g., "AI Agent", "Dashboard", "Ticket", "Coupon", "WhatsApp", "Booking").
- Bengali translations must be natural, conversational Bengali — not literal translations.

---

## 🧩 Rule 4 — Modular Component Architecture (MANDATORY)

### For NEW Pages

Every new page created must follow this structure:

```
app/(dashboard)/dashboard/{feature}/
  page.tsx                   ← Page shell only (imports + layout)
  _components/
    {FeatureHeader}.tsx       ← Page header/title area
    {FeatureList}.tsx         ← List/table component
    {FeatureCard}.tsx         ← Individual item card
    {FeatureModal}.tsx        ← Modal/drawer/sheet
    {FeatureFilters}.tsx      ← Filter/search bar
    types.ts                  ← TypeScript interfaces for this feature
    index.ts                  ← Re-exports
```

**The `page.tsx` file must NOT contain:**

- Direct business logic
- Inline JSX longer than ~30 lines
- Raw `fetch`/`prisma` calls (use custom hooks or server actions)

### For EXISTING Pages Being Modified

Before modifying ANY existing page, first check if it is **monolithic**:

**Monolithic page signs:**

- `page.tsx` is > 200 lines of JSX
- No `_components/` folder exists
- Business logic mixed directly in the page render

**If the page IS monolithic → REFACTOR FIRST:**

1. Extract each logical UI section into its own component file in `_components/`
2. Move TypeScript interfaces to `types.ts`
3. Create custom hooks for data fetching (`use{Feature}Data.ts`)
4. Then implement the new feature changes

**If the page is already componentized → proceed directly.**

---

## 🔧 Rule 5 — Code Quality Standards

- **All code comments MUST be in English.**
- Use TypeScript strictly — no `any` types without explicit justification comment.
- New API routes follow the pattern: `app/api/{feature}/{action}/route.ts`
- New Prisma schema changes go in the appropriate schema file under `prisma/schema/`
- New i18n locale files go in `public/locales/{en|bn}/{namespace}.json`
- Use Framer Motion for all animations — keep transitions smooth (200–400ms).
- Use Shadcn UI components as the base — extend, don't replace.
- Use Zod for all form validation and API input validation.

---

## 🧪 Rule 6 — Quality Assurance & Automated Testing (MANDATORY)

Once a feature or task implementation is complete, the following checks and test commands **MUST** be executed and passed successfully before merging or marking the task as done:

1. **Vitest Unit & Integration Tests:**
   - Execute unit tests for all updated/created features to verify code logic:
     ```bash
     npx vitest run
     ```
2. **ESLint Validation:**
   - Ensure there are no code style, syntax, or linting errors:
     ```bash
     npx next lint
     ```
3. **TypeScript Type Checking:**
   - Ensure strict type safety and zero TypeScript errors:
     ```bash
     npx tsc --noEmit
     ```
4. **Development & Server Execution:**
   - Verify that the app builds and runs without runtime crashes:
     ```bash
     npm run dev
     ```

---

## 📋 Rule 7 — Task Completion Checklist & Automated Workflow

Each individual task file tracks completion with this checklist. Mark items as the feature is built:

```markdown
- [ ] Schema changes (Prisma)
- [ ] API routes implemented
- [ ] Core business logic / hooks
- [ ] UI components (modular, per Rule 4)
- [ ] i18n locale files (en + bn)
- [ ] Responsive design verified (mobile/tablet/desktop)
- [ ] Dark mode verified
- [ ] Vitest unit tests passed (`npx vitest run`)
- [ ] ESLint checks passed (`npx next lint`)
- [ ] TypeScript type checks passed (`npx tsc --noEmit`)
- [ ] Development build/server verified (`npm run dev`)
- [ ] Committed and pushed to remote `feature-update` branch
- [ ] 🟦 Mark item as complete with blue tick in task file
- [ ] Auto-commit and push changes to remote `feature-update` branch

### Automated Progress Tracking & Git Workflow

- **Automatic Status Update:** Whenever a specific feature or task within a category is completed and passes all quality checks, you must automatically update the respective task file by adding a blue tick emoji (🟦 or ☑️) next to the completed item in the checklist.
- **Sequential Feature Execution & Auto-Push:** Tasks must be executed sequentially (one feature at a time). Immediately upon completing a single feature and verifying all tests, you must commit the changes with a clear commit message and automatically push the commit to the remote `feature-update` branch before moving on to the next feature task.
```

---

## 🚫 Rule 8 — What NOT to Do

- ❌ Do NOT push directly to `main` or `dev` from this branch — use PRs.
- ❌ Do NOT use hardcoded colors (Rule 2).
- ❌ Do NOT write untranslated text in JSX (Rule 3).
- ❌ Do NOT create monolithic page files (Rule 4).
- ❌ Do NOT write comments in Bengali (Rule 5).
- ❌ Do NOT skip test executions or ignore lint/type errors (Rule 6).
- ❌ Do NOT modify `prisma/schema/*.prisma` files without running `npx prisma validate` afterward.

---

_Last updated: 2026-10-21 | Branch: feature-update_
