# DriplareAI Instagram n8n Runtime Contract

## Incoming Payload

Next.js route:

```text
/api/webhooks/instagram
```

forwards original Meta payload to:

```env
N8N_INSTAGRAM_WEBHOOK_URL=
```

## Extract Account and Sender

Exact payload shape can vary by subscribed Instagram messaging fields. Normalize early in n8n:

```js
const entry = $json.entry?.[0];
const messaging = entry?.messaging?.[0];

return [{
  json: {
    instagramAccountId: entry?.id || messaging?.recipient?.id,
    senderId: messaging?.sender?.id,
    messageText: messaging?.message?.text,
    raw: $json
  }
}];
```

## DB Lookup

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
  i.config->>'pageAccessToken' AS "pageAccessToken",
  i.config->>'instagramAccountId' AS "instagramAccountId",
  i.config->>'instagramUsername' AS "instagramUsername"
FROM "Integration" i
JOIN "Chatbot" c ON i."chatbotId" = c."chatbotId"
JOIN "User" u ON c."userId" = u."userId"
WHERE i.platform = 'instagram'
  AND i."connected" = true
  AND i.config->>'instagramAccountId' = '{{ $json.instagramAccountId }}';
```

## Send Reply

Instagram Messaging API send endpoint depends on Meta Graph version and messaging payload approval. Use saved `pageAccessToken` from DB.

If auth/permission fails, call:

```text
POST /api/webhooks/n8n-instagram/token-status
```

```json
{
  "instagramAccountId": "{{instagramAccountId}}",
  "errorMessage": "{{error.message}}",
  "errorCode": 190,
  "secret": "{{N8N_CALLBACK_SECRET}}"
}
```
