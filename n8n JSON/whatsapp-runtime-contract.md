# DriplareAI WhatsApp n8n Runtime Contract

এই ফাইলটি n8n WhatsApp workflow implement করার সময় ব্যবহার করার জন্য। Next.js side ইতিমধ্যে নিচের routes/config ধরে প্রস্তুত।

## 1. Incoming Webhook Source

Recommended production route:

```text
Meta WhatsApp -> Next.js /api/webhooks/whatsapp -> n8n workflow
```

Next.js forwards the original Meta payload to:

```env
N8N_WHATSAPP_WEBHOOK_URL=
```

## 2. Extract Phone Number ID

Meta payload থেকে connected business phone number id বের করতে হবে:

```js
const value = $json.entry?.[0]?.changes?.[0]?.value;
const phoneNumberId = value?.metadata?.phone_number_id;
const displayPhoneNumber = value?.metadata?.display_phone_number;
const message = value?.messages?.[0];
const senderWhatsAppId = message?.from;
```

## 3. Integration Lookup Query

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
  AND i.config->>'phoneNumberId' = '{{ $json.phoneNumberId }}';
```

## 4. Send WhatsApp Reply

Endpoint:

```text
POST https://graph.facebook.com/v20.0/{{phoneNumberId}}/messages
```

Headers:

```json
{
  "Authorization": "Bearer {{accessToken}}",
  "Content-Type": "application/json"
}
```

Body:

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

## 5. Auth/Error Callback To DriplareAI

If WhatsApp Graph API returns an auth/permission/token error, call:

```text
POST https://YOUR_DOMAIN/api/webhooks/n8n-whatsapp/token-status
```

Body:

```json
{
  "phoneNumberId": "{{phoneNumberId}}",
  "errorMessage": "{{error.message}}",
  "errorCode": 190,
  "errorSubcode": 0,
  "secret": "{{N8N_CALLBACK_SECRET}}"
}
```

Next.js will:

- mark the WhatsApp integration as disconnected/error
- save `lastError`
- create owner notification

## 6. Message Types

Recommended branches:

- `text`: use `message.text.body`
- `audio`: fetch media URL, download, transcribe, pass transcript to AI
- `image`: fetch media URL, download/analyze, pass visual context to AI
- `document`: fetch media URL, download, extract text, pass document context to AI

## 7. Temporary Errors

Do not disconnect integration for:

- rate limits
- 5xx Graph API errors
- temporary network failures

Use retry/backoff first. Only call token-status callback for auth/permission/token issues.
