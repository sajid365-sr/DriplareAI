---
name: driplare-antigravity-guide
description: >-
  Routes DriplareAI work to Antigravity Awesome Skills installed in
  ~/.cursor/skills. Use when planning features, building Next.js UI, n8n
  workflows, security review, or PRs for this repository.
---

# DriplareAI + Antigravity Skills

The full library (1,400+ skills) is installed globally at `~/.cursor/skills` via
`npx antigravity-awesome-skills --cursor`. Invoke skills in chat with `@skill-id`.

## Stack mapping

| Work | Skill(s) |
|------|----------|
| Feature planning / MVP scope | `@brainstorming` |
| Next.js App Router, pages, server actions | `@react-best-practices` |
| Premium UI, Tailwind, Framer Motion | `@frontend-design`, `@tailwind-patterns` |
| Zod forms and API validation | `@zod-validation-expert` |
| Prisma / Postgres patterns | Search catalog for `prisma` or `postgres` skills |
| Clerk auth | Search catalog for `clerk` |
| i18n / copy | Follow `AGENTS.md`; use `@frontend-design` for UX copy layout |
| n8n JSON workflows (`n8n JSON/`) | `@n8n-workflow-patterns`, `@n8n-validation-expert`, `@n8n-expression-syntax` |
| n8n Code nodes (JS) | `@n8n-code-javascript` |
| Debugging agent or app issues | `@debugging-strategies`, `@test-driven-development` |
| Security / webhooks / API | `@security-auditor` |
| PR packaging | `@create-pr` |

## Workflow

1. For non-trivial tasks, start with `@brainstorming` and align with `AGENTS.md`.
2. Implement with stack-specific skills above.
3. Validate with `@lint-and-validate` or project tests when applicable.
4. Finish with `@create-pr` when the user wants a pull request.

## Context discipline

Do not load many skills at once. Pick 1–3 skills per task. Browse
`C:\Users\User\.cursor\skills` or run a reduced install if context feels heavy:

```bash
npx antigravity-awesome-skills --path .cursor/skills --category development,backend --risk safe,none
```

## Updates

```bash
npx antigravity-awesome-skills --cursor
```

Catalog: https://sickn33.github.io/antigravity-awesome-skills/
