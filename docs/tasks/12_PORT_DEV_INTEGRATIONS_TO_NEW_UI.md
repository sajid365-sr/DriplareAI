# Task 10: Port Backend Integrations from `dev` Branch to New UI Layout

## Objective
Restore and merge the backend Facebook, WhatsApp, and Instagram integration setup (API routes, webhook handlers, DB helpers, Meta tokens handling) from the `dev` branch into the current `feature/ui-layout-overhaul` branch, connecting them seamlessly to the newly refactored Integrations UI.

---

## Execution Strategy

### 1. Identify Integration Files in `dev` Branch
Check and extract integration logic from `dev` branch without overwriting current UI layout:
- Webhook routes (e.g., `app/api/webhooks/facebook/route.ts`, `app/api/webhooks/whatsapp/route.ts`)
- OAuth & Token connection routes (e.g., `app/api/integrations/...`)
- Service helpers / Meta API clients (e.g., `lib/integrations/`, `services/meta.ts`, etc.)

### 2. Integration Porting Guidelines
- **DO NOT** overwrite the new UI layout files in `app/(dashboard)/dashboard/integrations/`.
- **DO** import/copy the backend API routes and service methods from `dev`.
- Connect the button actions (e.g., `Connect Facebook Page`, `Save Comment Settings`, `Disconnect`) on the new UI cards/modals to trigger these restored API routes.

---

## File Checklist 📁
- [ ] `docs/tasks/10_PORT_DEV_INTEGRATIONS_TO_NEW_UI.md`
- [ ] Restore integration API routes from `dev` branch
- [ ] Connect restored endpoints to `@app/(dashboard)/dashboard/integrations/page.tsx` & `ConfigureChannelModal.tsx`