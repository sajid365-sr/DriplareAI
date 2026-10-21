# DRIPLARE AI Agent Guidelines

You must strictly adhere to the following guidelines when working on this project. DRIPLARE AI is a powerful SaaS platform designed to automate customer interactions across multiple channels (Facebook, WhatsApp, and Web) using state-of-the-art LLMs and RAG (Retrieval-Augmented Generation), and all code quality and user experience must be state-of-the-art.

## 1. Core Development Principles & UI/UX Excellence

- **Latest Next.js Standard**: Always follow the latest Next.js (App Router) conventions and file structures.
- **Absolute UI/UX Priority**: UI/UX design and interaction quality must be treated with the highest priority across all features.
- **Professional Merchant Journey**: Every workflow, navigation flow, and interaction screen must be optimized to deliver a completely professional, seamless, and intuitive journey for merchants/customers.
- **Smoothness & Industry Standards**: Animations, transitions, loading states, error boundaries, and empty states must feel extremely smooth, fluid, and adhere strictly to modern SaaS design standards.
- **Component-Driven Architecture**: Break down every page into small, reusable, and modular components. Avoid large, monolithic files. If an existing page is monolithic, refactor it into smaller components before making changes.
- **Clean Code & Comments**: Write self-documenting code and add clear comments. All code comments MUST be in English.
- **Responsive Design**: Ensure every page and component is 100% responsive across all devices (Mobile, Tablet, PC, Large monitors) using Tailwind CSS responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`).

## 2. Technology Stack & Quality Standards

Follow best practices for the project's core technologies and strict typing:

- **Framework**: Next.js (App Router)
- **Database**: Prisma ORM with Neon/PostgreSQL (always validate schema changes)
- **Styling**: Tailwind CSS (v4) with CSS Variables
- **Auth**: Clerk
- **Email**: Resend
- **Animations**: Framer Motion
- **UI Components**: Shadcn UI (extend, don't replace)
- **i18n**: react-i18next
- **State Management**: Zustand
- **Validation**: Zod
- **TypeScript**: Strict typing mandatory — zero `any` types without explicit justification.

## 3. Design & Aesthetics

- **Modern & Premium UI**: Follow a Modern, Simple, and User-Friendly design strategy.
- **Animations**: Add smooth and premium animations using Framer Motion for every interaction (200–400ms).
- **Global Theme System**: The main theme color is a **Violet & Blue Gradient** (`from-violet-600 to-blue-600`).
  - Never use 'Hard-coded' colors (e.g., `bg-blue-500`, `text-gray-700`).
  - Use CSS Variables defined in `globals.css` (e.g., `bg-background`, `bg-card`, `text-foreground`, `border-border`).
- **Dark/Light Mode**: Optimized primarily for dark mode with full light mode support. Always check the appearance in both themes.

## 4. Localization & Regional Logic (i18n)

- **Dual Language Support**: The website supports Bengali and English. All text must be dynamic using `react-i18next`.
- **File-Based Translation**: Do not store translations in a single TypeScript file. Use separate JSON files for each page or major component.
  - **Structure**: Store files in `public/locales/{en|bn}/{namespace}.json` (e.g., `public/locales/en/support-tickets.json`).
  - **Technical Term Preservation**: When translating to Bengali, keep technical words in English (e.g., "AI Agent", "Dashboard", "Ticket", "Coupon", "WhatsApp", "Booking"). Do not translate these terms directly into Bengali.
- **Regional Logic**:
  - If Region is 'BD': Default language is Bengali, and a language toggle dropdown is visible in the header.
  - If Region is 'Global': The website is English-only, and the language toggle is hidden.

## 5. Mandatory Testing & Quality Assurance

Once a feature or task implementation is complete, the following checks and test commands **MUST** be executed and passed successfully before proceeding:

1. **Vitest Unit & Integration Tests**: `npx vitest run`
2. **ESLint Check**: `npx next lint`
3. **TypeScript Type Verification**: `npx tsc --noEmit`
4. **Development Server Check**: `npm run dev`

## 6. Branching & Automated Git Workflow

- **Branch Strategy**: The base project branch is always `dev` (and production is `main`). When working on specific feature updates, create a dedicated feature branch from `dev`. Do NOT push directly to `main` from feature branches — use Pull Requests (PRs).
- **Sequential Feature Execution**: Implement features one by one.
- **Automatic Progress Tracking**: Upon completing a feature and passing all checks, automatically mark it with a blue tick emoji (🟦) in the task file.
- **Auto-Commit & Push**: Immediately after completing a feature and verifying tests, commit the changes with a clear commit message and automatically push to the remote branch.

## 7. Agent Communication & Efficiency

- **Communication Language**: Always communicate with the USER in **Bengali**.
- **To-The-Point & Token Efficient**: Keep all responses strictly **to the point**. Avoid unnecessary length or filler text to save output tokens.
- **Walkthrough Policy**: Provide a detailed walkthrough **only** if the user explicitly asks for it; otherwise, provide concise, direct status updates and bullet points upon task completion.
- **Implementation Planning**: Create a brief Implementation Plan (in Bengali) for major changes and obtain user approval before proceeding.
- **Task Tracking**: Track progress using master and individual task files.

---

_Every action and decision must be governed by these guidelines._
