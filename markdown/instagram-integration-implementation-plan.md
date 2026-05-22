# Instagram Integration Implementation Plan

REMOVEDAI Instagram integration Facebook Page-linked Instagram Professional accounts দিয়ে চালু করা হবে। n8n runtime DB থেকে saved credential নিয়ে Instagram DM automation করবে।

## Customer Flow

1. Customer Dashboard > Chatbot > Integrations খুলবে।
2. Instagram card থেকে `Connect` চাপবে।
3. Meta/Facebook login popup খুলবে।
4. Customer Instagram professional account linked আছে এমন Facebook Page permission দেবে।
5. REMOVEDAI linked Instagram accounts দেখাবে।
6. Customer account select করে connect করবে।
7. n8n incoming webhook থেকে Instagram account id নিয়ে DB lookup করবে।

## Requirements

- Instagram account must be Professional: Business or Creator.
- Instagram account must be linked to a Facebook Page.
- Customer must have permission to manage that Page/account.
- Meta App Review permissions needed:
  - `instagram_basic`
  - `instagram_manage_messages`
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_metadata`

## Next.js Backend

Implemented:

- `lib/services/instagram.ts`
- `/api/chatbots/[chatbotId]/integrations/instagram/accounts`
- `/api/chatbots/[chatbotId]/integrations/instagram/connect`
- `/api/webhooks/instagram`
- `/api/webhooks/n8n-instagram/token-status`

Saved config shape:

```json
{
  "connectionSource": "facebook_page_linked_instagram",
  "instagramAccountId": "1784...",
  "instagramUsername": "business_username",
  "instagramName": "Business Name",
  "instagramProfilePictureUrl": "https://...",
  "pageId": "123...",
  "pageName": "Business Page",
  "pageAccessToken": "EAAG...",
  "userAccessTokenLongLived": "EAAG...",
  "connectedAt": "2026-05-16T00:00:00.000Z"
}
```

Sensitive fields not returned to frontend:

- `pageAccessToken`
- `userAccessTokenLongLived`

## n8n Runtime Query

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
  i.config->>'pageId' AS "pageId",
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

## Webhook

Meta webhook should point to:

```text
https://YOUR_DOMAIN/api/webhooks/instagram
```

Verify token env:

```env
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=
N8N_INSTAGRAM_WEBHOOK_URL=
N8N_CALLBACK_SECRET=
```

## Error Callback

n8n should call:

```text
POST /api/webhooks/n8n-instagram/token-status
```

Body:

```json
{
  "instagramAccountId": "1784...",
  "errorMessage": "Instagram permission expired",
  "errorCode": 190,
  "secret": "{{N8N_CALLBACK_SECRET}}"
}
```

## Send Reply (n8n / runtime)

Use Page token on `/me/messages`, not `/{instagramAccountId}/messages`:

```http
POST https://graph.facebook.com/v20.0/me/messages?access_token=<pageAccessToken>
```

Body: `{ "recipient": { "id": "<sender IGSID>" }, "message": { "text": "..." } }`

## Post Meta Review TODO

- [ ] Add Instagram product/webhooks in Meta app if not already active.
- [ ] Add webhook callback URL and verify token.
- [ ] Subscribe Instagram messaging webhook fields.
- [ ] Submit App Review for Instagram messaging permissions.
- [ ] Test real Instagram DM inbound webhook.
- [ ] Test n8n reply via Instagram Messaging API.
