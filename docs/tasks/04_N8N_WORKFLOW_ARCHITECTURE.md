# Task 04: n8n Workflow Restructuring & Real-Time Triggers

## Objective
Modularize n8n automation pipelines to handle Webhook routing, AI tool execution, and frontend real-time broadcasting.

## Required Workflows
1. **Webhook Router Workflow**:
   - Receive incoming webhooks from Meta / WhatsApp.
   - Check `is_ai_active` status from Neon DB.
   - If `true` -> Pass to AI Agent Workflow.
   - If `false` -> Store message in DB and trigger real-time broadcast.

2. **AI Agent with Tool Calling**:
   - Attach sub-tools to n8n AI Agent Node:
     - `Search_Products_Tool` (Queries Postgres / Vector DB).
     - `Process_Vision_Tool` (Handles customer product image lookup).
     - `Create_Order_Tool` (Creates order in DB & requests Courier tracking).

3. **Real-time Event Dispatcher**:
   - Issue an HTTP POST to Next.js API `/api/realtime-event` whenever a new message is saved to trigger WebSocket broadcasts to the Live Inbox.