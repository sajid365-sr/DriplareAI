# Task 09: Bot-Centric Channel Integrations & Advanced Settings Modal

## Objective
Refactor `@app/(dashboard)/dashboard/integrations/page.tsx` from a static list of generic platforms into a dynamic, **Bot-Centric Channel Mapping System**. Users must be able to filter connected accounts by specific AI Agents, connect multiple accounts of the same platform (e.g., multiple Facebook Pages mapped to different bots), and access channel-specific configuration modals (including FB Comment Automation).

---

## 1. UI Architecture & Header Filtering

- **Top Toolbar**:
  - Add `Filter by Bot` dropdown selector (similar to Knowledge Base page UI). Options: `All Bots` or specific `Bot ID`.
  - Add `+ Connect New Channel` primary action button.

- **Dynamic Connected Channels Cards**:
  - Replace static generic cards with real connected channel instances.
  - Each card must display:
    - Channel Name (e.g., "Baby Mart FB Page", "WhatsApp Sales Line").
    - Platform Icon & Account ID / Phone handle.
    - Assigned AI Agent Badge (with a quick-select dropdown to change bot assignment).
    - Status Indicator (`Active`, `Needs Re-auth`).
    - Action Buttons: `⚙️ Configure` and `🗑️ Disconnect`.

---

## 2. Channel Configuration Modal (`ConfigureChannelModal.tsx`)

Clicking `⚙️ Configure` on a connected channel opens a tabbed settings modal:

### Tabs:
1. **General & Bot Assignment**:
   - Change assigned AI Agent.
   - Toggle Handover Protocol (Mute AI on human takeover).
2. **Comment Automation (Facebook/Instagram specific)**:
   - Toggle `Auto-reply to post comments`.
   - Toggle `Auto-DM commenter`.
   - Set trigger keywords (e.g., "Price", "Details", "দাম কত").
   - Set comment reply template.
3. **Webhook Health**:
   - Display Meta Token expiration status.
   - `Test Webhook` connection button.

---

## Checklist 📁
- [ ] `docs/tasks/09_ADVANCED_BOT_INTEGRATIONS.md`
- [ ] `app/(dashboard)/dashboard/integrations/page.tsx` (Refactor layout to bot-filtered dynamic grid)
- [ ] `components/integrations/ConfigureChannelModal.tsx` (Create Channel Settings Modal)