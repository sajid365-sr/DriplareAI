# REMOVED AI Agent Guidelines

You must strictly adhere to the following guidelines when working on this project. REMOVED AI is a premium AI SaaS platform, and all code quality and user experience must be state-of-the-art.

## 1. Core Development Principles
- **Latest Next.js Standard**: Always follow the latest Next.js (App Router) conventions and file structures.
- **Component-Driven Architecture**: Break down every page into small, reusable, and modular components. Avoid large, monolithic files.
- **Clean Code & Comments**: Write self-documenting code and add clear comments. All code comments MUST be in English.
- **Responsive Design**: Ensure every page and component is 100% responsive across all devices (Mobile, Tablet, PC, Large monitors).

## 2. Technology Stack
Follow best practices for the project's core technologies:
- **Framework**: Next.js (App Router)
- **Database**: Prisma ORM with Neon/PostgreSQL
- **Styling**: Tailwind CSS (v4) with CSS Variables
- **Auth**: Clerk
- **Email**: Resend
- **Animations**: Framer Motion
- **UI Components**: Shadcn UI
- **i18n**: react-i18next
- **State Management**: Zustand
- **Validation**: Zod

## 3. Design & Aesthetics
- **Modern & Premium UI**: Follow a Modern, Simple, and User-Friendly design strategy.
- **Animations**: Add smooth and premium animations using Framer Motion for every interaction.
- **Global Theme System**: The main theme color is a **Violet & Blue Gradient**.
    - Never use 'Hard-coded' colors (e.g., `bg-blue-500`).
    - Use CSS Variables defined in `globals.css` (e.g., `--primary`, `--secondary`, `--accent`).
- **Dark/Light Mode**: Full support for both modes. Always check the appearance in both themes when creating new code.

## 4. Localization & Regional Logic (i18n)
- **Dual Language Support**: The website supports Bengali and English. All text must be dynamic using `react-i18next`.
- **File-Based Translation**: Do not store translations in a single TypeScript file. Use separate JSON files for each page or major component.
    - **Structure**: Store files in `public/locales/{en|bn}/{namespace}.json` (e.g., `public/locales/en/overview.json`).
    - **Technical Term Preservation**: When translating to Bengali, keep technical words in English (e.g., "AI Agent", "Starter", "Growth", "Facebook", "WhatsApp", "Dashboard"). Do not translate these terms directly into Bengali.
- **Regional Logic**: 
    - If Region is 'BD': Default language is Bengali, and a language toggle dropdown is visible in the header.
    - If Region is 'Global': The website is English-only, and the language toggle is hidden.

## 5. Agent Workflow
- **Communication Language**: Always communicate with the USER in **Bengali**.
- **Implementation Planning**: Create an **Implementation Plan** (in Bengali) for major changes and obtain user approval before proceeding.
- **Task Tracking**: Track progress using a `task.md` file.
- **Walkthrough**: Provide a detailed **Walkthrough** (in Bengali) upon task completion.

## 6. Legacy Updates
- If an existing file or component does not follow these guidelines, refactor it to meet these standards whenever you need to update it.

---
*Every action and decision must be governed by these guidelines.*
