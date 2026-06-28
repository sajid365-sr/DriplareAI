I need to implement a Credit System in my Driplare platform. 
Replace the existing message-based limit system with this credit system. 
You have access to my full codebase — find the relevant files yourself.

---

CURRENT TASK — TERMINAL BUILD ERROR
- [x] Reproduce `npm run build` terminal error
- [x] Identify failing `next/font/google` Google Fonts fetch in `app/layout.tsx`
- [x] Replace Google font runtime fetch with build-safe CSS font stacks
- [x] Fix stale pricing `perMessageLabel` reference after credit migration
- [x] Re-run build verification
- [x] Check existing `next dev` log and `/pricing` route response

---

TASK 1 — DATABASE
- Add `credits_balance` (INTEGER, default 500) to the users table
- Add `credits_reset_date` (TIMESTAMP) to the users table  
- Create a new `credit_transactions` table with these fields:
  id, user_id, chatbot_id, action_type, model_tier, credits_spent, created_at
- Update plan limits in the database/config to use credits instead of messages:
  Free = 500, Growth = 15000, Business = 50000

---

TASK 2 — MODEL TIERS
Create a model tier mapping in the codebase (alongside or inside the 
existing CHAT_MODELS config):

Economy (5 credits/reply):
  google/gemini-2.5-flash-lite, google/gemini-2.0-flash-lite-001,
  meta-llama/llama-3.1-8b-instruct, google/gemma-2-9b-it,
  deepseek/deepseek-chat

Standard (15 credits/reply):
  google/gemini-2.5-flash, openai/gpt-4o-mini,
  meta-llama/llama-3.3-70b-instruct, qwen/qwen-2.5-72b-instruct,
  anthropic/claude-3-haiku, anthropic/claude-3.5-haiku

Premium (50 credits/reply):
  openai/gpt-4o, anthropic/claude-3.5-sonnet, deepseek/deepseek-r1,
  openai/o1-preview, openai/o1-mini, google/gemini-pro-1.5,
  mistralai/mistral-large

---

TASK 3 — CREDIT COSTS PER ACTION
Define these constants in a central config file:

CREDIT_COSTS = {
  reply_economy: 5,
  reply_standard: 15,
  reply_premium: 50,
  test_chat_multiplier: 2,      // dashboard playground = model cost × 2
  compare_mode: "sum of both selected models",
  enhance_prompt: 30,
  file_embedding_per_100kb: 5,
  image_message: 15,            // added on top of reply cost
  audio_per_minute: 20          // added on top of reply cost
}

---

TASK 4 — API ENDPOINT
Create POST /api/credits/check-and-deduct with this logic:
1. Receive: { userId, action_type, model_tier, extra? }
2. Calculate total credits required based on action_type + model_tier + extras
3. Check if user's credits_balance >= required credits
4. If NO → return 402 with { error: "insufficient_credits" }
5. If YES → deduct from credits_balance, log to credit_transactions, return 200

---

TASK 5 — FRONTEND
- In the chatbot dashboard, wherever the model selector is shown,
  display the credit cost per reply next to each model:
  Example: "Gemini 2.5 Flash Lite · 5 credits/reply"
- Show a credit balance indicator in the sidebar 
  (similar to how messages usage is shown now)
- If credits run out, show an upgrade/top-up prompt instead of 
  blocking silently

---

TASK 6 — N8N INTEGRATION POINT
Before each n8n AI workflow executes a reply, it must call 
POST /api/credits/check-and-deduct first.
If the response is 402, n8n should NOT call OpenRouter and should 
return a fallback message to the user.
Find where n8n sends the webhook/API call in my codebase and add 
this check before the OpenRouter node executes.

---

IMPORTANT NOTES:
- Do not break existing functionality. 
- Migrate existing users' message balances to credits proportionally 
  (1 message = 30 credits as a migration default).
- Monthly credit reset logic should follow the same pattern as 
  the existing message reset logic.
- Keep a clear separation: credits_balance resets monthly, 
  but top-up credits (future feature, don't build now) will not reset.
