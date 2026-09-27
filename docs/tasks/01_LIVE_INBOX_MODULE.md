# Task 01: Omnichannel Live Inbox & Real-time Handoff Engine

## Visual & Design References 🖼️
- **Live Inbox Layout**: `docs/ui-references/LazyChat Inbox.png`
- **Dashboard Sidebar Context**: `docs/ui-references/RepliBee 1.png`
- **Design Instruction**: Replicate the dark-themed 3-column Live Inbox structure shown in `LazyChat Inbox.png` using Tailwind CSS and shadcn/ui. Maintain consistency with the current Driplare AI violet theme.

## Key Requirements
1. **Layout & UI Structure (3-Column Layout)**:
   - **Left Column**: Channel filter (All, Facebook, Instagram, WhatsApp), Lead status tags (`High Prospect`, `Priority`, `Risky`), and active chat sessions.
   - **Middle Column**: Real-time conversation thread, message status tags (`Replied by Driplare AI`), and a prominent **`Stop AI / Pause Agent`** toggle button at the top bar.
   - **Right Column**: Customer CRM info, AI context summary, and an embedded **Quick Order Creation Form**.

2. **Real-Time Integration**:
   - Set up Socket.io or Pusher client listener on Next.js frontend.
   - Listen for incoming `new_message` events and update chat state without requiring a manual page refresh.

3. **Hybrid Handoff State**:
   - Toggle `conversations.is_ai_active` boolean in Neon Postgres when human agent clicks "Stop AI".
   - When `is_ai_active == false`, bypass n8n AI response node and enable manual input field for human agent.