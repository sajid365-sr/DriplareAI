# WhatsApp Integration Implementation Plan

এই ডকুমেন্টে DriplareAI-এর WhatsApp integration-এর দুইটি flow-এর implementation plan রাখা হলো:

1. Premium UX: Meta WhatsApp Embedded Signup
2. Normal/Fallback UX: Manual Cloud API credential setup

Primary production goal হবে Premium UX. Normal flow রাখা হবে internal support, early testing, বা advanced/manual customer setup-এর fallback হিসেবে।

---

## 1. Product Goal

DriplareAI customer যেন Dashboard থেকে Chatbot create করার পর WhatsApp Business connect করতে পারে, কোনো developer.facebook.com setup না করে।

Customer-facing target flow:

1. Customer logs in to DriplareAI.
2. Customer creates/selects a Chatbot.
3. Customer opens Integrations.
4. Customer clicks `Connect WhatsApp`.
5. Meta Embedded Signup popup opens.
6. Customer selects/creates Meta Business and WhatsApp Business Account.
7. Customer selects/verifies WhatsApp phone number.
8. DriplareAI automatically saves WhatsApp connection metadata.
9. n8n workflow receives messages and sends AI replies through WhatsApp Cloud API.

---

## 2. Integration Modes

### 2.1 Premium UX: Embedded Signup

This is the recommended production flow.

Customer does not copy:

- Access token
- Phone Number ID
- WABA ID
- Webhook URL
- App ID or App Secret

Customer only follows Meta popup steps.

### 2.2 Normal/Fallback UX: Manual Credential Setup

This is the fallback flow for:

- Internal testing
- Early production support
- Customers who already have Meta developer setup
- Support-assisted onboarding

Customer/support provides:

- Permanent/System User Access Token
- WhatsApp Phone Number ID
- WhatsApp Business Account ID, optional but recommended

This flow should be hidden behind an `Advanced setup` option once Embedded Signup is ready.

---

## 3. Meta Setup Requirements

### 3.1 Existing Meta App

Current status from screenshots:

- App exists: Driplare
- App type: Business
- App mode: Development
- Facebook Login for Business exists
- WhatsApp product exists
- WhatsApp production setup not complete
- Business verification pending

### 3.2 Required Before Production

Complete these before customer onboarding:

1. App Settings > Basic
   - App domain
   - Privacy Policy URL
   - Terms URL
   - User data deletion URL
   - App icon
   - Business category/use case

2. Business Verification
   - Submit company/business documents.
   - Wait for approval.

3. Facebook Login for Business
   - Enable Client OAuth Login.
   - Enable Web OAuth Login.
   - Enforce HTTPS.
   - Add Valid OAuth Redirect URIs.
   - Create WhatsApp Embedded Signup configuration.

4. WhatsApp Product
   - Configure production webhook.
   - Subscribe to WhatsApp messages/events.
   - Move app to Live mode after review/requirements.

5. App Review / Advanced Access
   - Request permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
     - `business_management`, if required by Embedded Signup/Business Login flow

6. Tech Provider / Partner Onboarding
   - Start `Become Tech Provider` flow if Meta requires it for onboarding customer WABAs at scale.

---

## 4. Environment Variables

Add these to local `.env` and Vercel production env.

```env
NEXT_PUBLIC_META_APP_ID=
NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=
META_APP_SECRET=

WHATSAPP_WEBHOOK_VERIFY_TOKEN=
N8N_WHATSAPP_WEBHOOK_URL=
N8N_CALLBACK_SECRET=
```

Optional:

```env
WHATSAPP_GRAPH_VERSION=v20.0
```

Implementation note: Keep Graph version centralized in `lib/whatsapp.ts`.

---

## 5. Database Design

Current `Integration` model can support WhatsApp without schema changes because it has:

- `chatbotId`
- `platform`
- `connected`
- `status`
- `lastError`
- `config Json`
- `connectedAt`

Recommended `Integration.config` for Premium Embedded Signup:

```json
{
  "connectionSource": "embedded_signup",
  "wabaId": "1234567890",
  "phoneNumberId": "1234567890",
  "displayPhoneNumber": "+8801XXXXXXXXX",
  "verifiedName": "Customer Business",
  "qualityRating": "GREEN",
  "accessToken": "EAAG...",
  "tokenType": "bearer",
  "connectedAt": "2026-05-16T00:00:00.000Z",
  "webhookSubscribedAt": "2026-05-16T00:00:00.000Z"
}
```

Recommended `Integration.config` for Normal/Manual flow:

```json
{
  "connectionSource": "manual_cloud_api",
  "wabaId": "1234567890",
  "phoneNumberId": "1234567890",
  "displayPhoneNumber": "+8801XXXXXXXXX",
  "verifiedName": "Customer Business",
  "accessToken": "EAAG...",
  "connectedAt": "2026-05-16T00:00:00.000Z"
}
```

Sensitive fields:

- `accessToken`

Never return sensitive fields to frontend.

Safe frontend metadata:

```json
{
  "connectionSource": "embedded_signup",
  "wabaId": "1234567890",
  "phoneNumberId": "1234567890",
  "displayPhoneNumber": "+8801XXXXXXXXX",
  "verifiedName": "Customer Business",
  "qualityRating": "GREEN",
  "connectedAt": "2026-05-16T00:00:00.000Z",
  "webhookSubscribedAt": "2026-05-16T00:00:00.000Z"
}
```

---

## 6. Next.js Backend Plan

### 6.1 Shared WhatsApp Helper

Create:

```text
lib/whatsapp.ts
```

Responsibilities:

- Read Meta credentials.
- Build Graph API URLs.
- Exchange Embedded Signup code for token.
- Fetch WhatsApp phone number details.
- Validate manual credentials.
- Subscribe customer WhatsApp account/phone to app webhook where required.
- Normalize Graph API errors.
- Detect token/permission errors.

Suggested functions:

```ts
exchangeWhatsAppEmbeddedSignupCode(code: string)
fetchWhatsAppPhoneNumber(phoneNumberId: string, accessToken: string)
fetchWhatsAppBusinessAccount(wabaId: string, accessToken: string)
validateWhatsAppCloudCredentials(options)
subscribeWhatsAppBusinessAccount(wabaId: string, accessToken: string)
buildWhatsAppIntegrationConfig(options)
buildPublicWhatsAppConfig(config)
isWhatsAppAuthError(error)
```

### 6.2 Embedded Signup Connect Route

Create:

```text
app/api/chatbots/[chatbotId]/integrations/whatsapp/embedded/connect/route.ts
```

Request body:

```json
{
  "code": "...",
  "wabaId": "...",
  "phoneNumberId": "..."
}
```

Backend steps:

1. Authenticate with Clerk.
2. Confirm user owns `chatbotId`.
3. Check plan/integration limits using `canAddIntegration(userId, "whatsapp", chatbotId)`.
4. Validate request body with Zod.
5. Exchange `code` with Meta for access token.
6. Fetch phone number metadata.
7. Fetch WABA metadata if useful.
8. Subscribe webhook if required.
9. Upsert `Integration`:
   - `platform: "whatsapp"`
   - `connected: true`
   - `status: "active"`
   - `lastError: null`
   - safe metadata + encrypted/secure token in `config`
10. Return safe integration metadata.

### 6.3 Manual Connect Route

Current route:

```text
app/api/chatbots/[chatbotId]/integrations/whatsapp/connect/route.ts
```

Upgrade behavior:

1. Authenticate with Clerk.
2. Confirm chatbot ownership.
3. Validate required fields:
   - `accessToken`
   - `phoneNumberId`
   - optional `wabaId`
4. Call Meta Graph API to validate token/phone access.
5. Fetch display phone number and verified name.
6. Save config with `connectionSource: "manual_cloud_api"`.
7. Return safe metadata only.

### 6.4 WhatsApp Webhook Route

Create:

```text
app/api/webhooks/whatsapp/route.ts
```

GET:

- Verify Meta webhook challenge.
- Compare `hub.verify_token` with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- Return `hub.challenge`.

POST:

Two options:

Option A, recommended:

- Meta sends webhook to Next.js.
- Next.js validates/logs payload.
- Next.js forwards payload to n8n via `N8N_WHATSAPP_WEBHOOK_URL`.
- n8n processes AI response.

Option B:

- Meta sends webhook directly to n8n.
- Simpler, but less control and less observability inside DriplareAI.

Recommended for DriplareAI production: Option A.

### 6.5 n8n Error Callback Route

Create:

```text
app/api/webhooks/n8n-whatsapp/token-status/route.ts
```

Request body:

```json
{
  "phoneNumberId": "...",
  "errorMessage": "...",
  "errorCode": 190,
  "secret": "..."
}
```

Backend behavior:

1. Validate `N8N_CALLBACK_SECRET`.
2. Find integration by:
   - `platform = "whatsapp"`
   - `config.phoneNumberId = payload.phoneNumberId`
3. Update:
   - `connected: false`
   - `status: "error"`
   - `lastError: customer-friendly message`
4. Create notification for owner.

---

## 7. Next.js Frontend Plan

### 7.1 WhatsApp Card Behavior

In:

```text
app/(dashboard)/dashboard/chatbots/[chatbotId]/integrations/page.tsx
```

For WhatsApp:

- Primary button: `Connect WhatsApp`
- If Embedded Signup env vars exist, open Embedded Signup.
- If not configured, show setup unavailable message or Advanced setup modal.

Connected card should show:

- `Connected`
- phone number if available
- info icon for details
- disconnect button

### 7.2 Embedded Signup UI

Customer flow:

1. Click `Connect WhatsApp`.
2. Load Facebook JS SDK if not loaded.
3. Call Meta Embedded Signup with:
   - app ID
   - config ID
   - response type/code mode
4. Receive callback payload.
5. Send `code`, `wabaId`, `phoneNumberId` to backend route.
6. Show success toast.
7. Reload integrations.

Frontend should never ask customer for:

- WABA ID
- Phone Number ID
- Access Token

### 7.3 Advanced Manual Setup Modal

Keep a small link/button:

```text
Advanced setup
```

Only open manual form if:

- Internal support asks customer to use it.
- Embedded Signup is unavailable.
- Customer already has Cloud API credentials.

Manual form fields:

- WhatsApp Phone Number ID
- Permanent Access Token
- WhatsApp Business Account ID, optional

Use friendly helper text:

- "Use this only if you already have Meta Cloud API credentials."

### 7.4 WhatsApp Details Modal

For WhatsApp, show only customer-friendly data:

- Connected WhatsApp number
- Business display name
- Connected date
- Connection status
- Reconnect guidance

Do not show:

- Access token
- Graph API terms
- Internal IDs unless needed for support

If showing IDs, place under an expandable `Support details` section.

---

## 8. n8n Workflow Plan

### 8.1 Incoming Message Flow

n8n receives payload from either:

- Next.js webhook proxy, recommended
- Direct Meta webhook, fallback

Extract:

- `phone_number_id`
- sender WhatsApp ID
- message type
- text/audio/image/document payload

DB query:

```sql
SELECT
  c."chatbotId",
  c."userId",
  c."provider",
  c."model",
  c."systemPrompt",
  c."temperature",
  c."maxTokens",
  u."includedMessages" AS "totalMessagesLimit",
  u."messagesUsedThisCycle" AS "messagesUsed",
  GREATEST(0, u."includedMessages" - u."messagesUsedThisCycle") AS "messagesRemaining",
  i."connected",
  i."status",
  i.config->>'accessToken' AS "accessToken",
  i.config->>'phoneNumberId' AS "phoneNumberId",
  i.config->>'displayPhoneNumber' AS "displayPhoneNumber",
  i.config->>'verifiedName' AS "verifiedName"
FROM "Integration" i
JOIN "Chatbot" c ON i."chatbotId" = c."chatbotId"
JOIN "User" u ON c."userId" = u."userId"
WHERE i.platform = 'whatsapp'
  AND i."connected" = true
  AND i.config->>'phoneNumberId' = '{{ $json.phone_number_id }}';
```

### 8.2 Message Type Handling

Handle:

- Text
- Audio/voice
- Image
- Document/PDF

Suggested n8n branches:

1. Text path
   - Use message body directly.

2. Audio path
   - Get media URL from WhatsApp Graph API.
   - Download audio.
   - Transcribe.
   - Send transcript to AI agent.

3. Image path
   - Get media URL.
   - Download image.
   - Analyze image if model supports vision.
   - Send extracted context to AI agent.

4. Document path
   - Get media URL.
   - Download document.
   - Extract text if PDF/doc supported.
   - Send extracted context to AI agent.

### 8.3 AI Response Flow

1. Load chatbot sources/RAG context.
2. Apply user plan/message limits.
3. Generate AI response.
4. Save chat session/message logs.
5. Send response through WhatsApp Cloud API:

```http
POST https://graph.facebook.com/v20.0/{phoneNumberId}/messages
Authorization: Bearer {accessToken}
Content-Type: application/json
```

Payload:

```json
{
  "messaging_product": "whatsapp",
  "to": "{{senderWhatsAppId}}",
  "type": "text",
  "text": {
    "body": "{{aiResponse}}"
  }
}
```

### 8.4 Runtime Error Handling

If WhatsApp send fails with auth/permission/token error:

1. Call:

```text
POST /api/webhooks/n8n-whatsapp/token-status
```

2. Mark integration error.
3. Notify customer.

If rate limit or temporary failure:

- Retry in n8n with backoff.
- Do not disconnect immediately.

---

## 9. Webhook and Routing Architecture

Recommended production architecture:

```text
Meta WhatsApp Webhook
        |
        v
Next.js /api/webhooks/whatsapp
        |
        v
n8n WhatsApp Workflow
        |
        v
DriplareAI DB + AI + WhatsApp Cloud API
```

Benefits:

- Central verification in Next.js.
- Better logging.
- Easier security checks.
- Future analytics and abuse protection.
- n8n URL can remain private.

---

## 10. Security Plan

1. Never return `accessToken` to frontend.
2. Do not log full tokens in Next.js or n8n.
3. Mask tokens in admin/debug screens.
4. Validate all webhook secrets.
5. Validate chatbot ownership in every route.
6. Keep App Secret server-only.
7. Store only required WhatsApp data.
8. Add disconnect flow that clears runtime error state and marks integration disconnected.

Future improvement:

- Encrypt `Integration.config.accessToken` before saving.
- Add key rotation policy.
- Add audit logs for connect/disconnect/reconnect.

---

## 11. Customer UX Copy

### Premium Connect Modal

Title:

```text
Connect WhatsApp
```

Description:

```text
Connect your WhatsApp Business number securely through Meta. You will not need to copy any API keys.
```

Button:

```text
Continue with Meta
```

### Manual Advanced Setup

Title:

```text
Advanced WhatsApp setup
```

Description:

```text
Use this only if you already have Meta WhatsApp Cloud API credentials.
```

### Reconnect Guidance

```text
Reconnect if your WhatsApp number is removed from Meta, permissions are changed, or DriplareAI shows a reconnect warning.
```

Bengali:

```text
Meta থেকে WhatsApp number remove হলে, permission পরিবর্তন হলে, অথবা DriplareAI reconnect warning দেখালে আবার connect করুন।
```

---

## 12. Implementation Checklist

### Phase 1: Manual Flow Hardening

- [ ] Refactor WhatsApp manual modal copy to customer-friendly text.
- [ ] Validate manual credentials before saving.
- [ ] Save WhatsApp safe metadata.
- [ ] Hide sensitive token from integrations API response.
- [ ] Show WhatsApp connected number in card/details modal.
- [ ] Add n8n WhatsApp token-status callback.

### Phase 2: Embedded Signup

- [ ] Add Meta env vars.
- [ ] Add Facebook JS SDK Embedded Signup launcher.
- [ ] Add WhatsApp embedded connect API route.
- [ ] Exchange code for access token server-side.
- [ ] Fetch phone/WABA metadata.
- [ ] Save embedded signup integration config.
- [ ] Add reconnect flow using Embedded Signup.
- [ ] Add fallback to manual advanced setup.

### Phase 3: Webhook/N8N Production Flow

- [ ] Add Next.js WhatsApp webhook GET verification.
- [ ] Add Next.js WhatsApp webhook POST forwarder to n8n.
- [ ] Update n8n DB query by `phoneNumberId`.
- [ ] Add text/audio/image/document branches.
- [ ] Add message send node using `accessToken` and `phoneNumberId`.
- [ ] Add auth error callback to Next.js.
- [ ] Add retry policy for temporary Graph API errors.

### Phase 4: Customer UX and Notifications

- [ ] Add WhatsApp details modal metadata.
- [ ] Add reconnect required badge.
- [ ] Add owner notification on token/permission error.
- [ ] Add bilingual translations for all WhatsApp integration UI.
- [ ] Add support details section for IDs if needed.

### Phase 5: Meta Production Readiness

- [ ] Complete Business Verification.
- [ ] Configure WhatsApp webhook in Meta dashboard.
- [ ] Create Embedded Signup Configuration ID.
- [ ] Submit App Review permissions.
- [ ] Prepare demo video.
- [ ] Move app to Live mode.
- [ ] Start/complete Tech Provider onboarding if required.

---

## 13. Recommended Final Customer Flow

Final DriplareAI production flow should be:

1. Customer clicks `Connect WhatsApp`.
2. Meta Embedded Signup opens.
3. Customer connects/verifies number.
4. DriplareAI receives phone/WABA metadata.
5. DriplareAI saves connection.
6. Meta webhook sends WhatsApp messages to DriplareAI.
7. DriplareAI/n8n sends AI replies.
8. If permissions break, customer sees `Reconnect required`.

Manual credential setup should remain hidden as advanced support-only fallback.

