# REMOVEDAI Instagram n8n Runtime Contract

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

Meta must deliver the **`messages`** webhook field (App Dashboard → Webhooks or Instagram → Configure webhooks). If only `comments` / `live_comments` are subscribed, DMs will not include `message.text`.

DM text paths:

- `entry[0].messaging[0].message.text` — normal incoming DM
- `entry[0].messaging[0].message_edit.text` — edited message (edits only)

If you see `message_edit` with `mid` but **no `text`**, the `messages` field is not subscribed — enable it and use Callback URL `https://<your-app>/api/webhooks/instagram` (Next.js forwards to n8n).

Normalize early in n8n (see `n8n-workflow-instagram-agent.json`):

```js
const messaging = entry?.messaging?.[0];
const messageText =
  messaging?.message?.text || messaging?.message_edit?.text;
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

## Connection sources

| `connectionSource` | Connect flow | Reply token / host |
|---|---|---|
| `facebook_page_linked_instagram` | Facebook SDK login → Page-linked IG | `pageAccessToken` on `graph.facebook.com` `/me/messages` |
| `instagram_login` | Instagram OAuth (`/api/.../instagram/oauth/start`) | `instagramAccessToken` on `graph.instagram.com` `/{instagramAccountId}/messages` |

DB lookup must also select `connectionSource`, `instagramAccessToken`.

## Send Reply

### Facebook Page–linked (`facebook_page_linked_instagram`)

Use the **Page access token** from DB (`pageAccessToken`).

`POST https://graph.facebook.com/<VERSION>/<pageId>/messages?access_token=<PAGE_ACCESS_TOKEN>`

n8n: AI Agent output only contains `output` — merge bot config in **Prepare Instagram Reply** before **Send Reply to Instagram** (`$('Merge Config and Message').item.json` + agent output).

### Instagram Login (`instagram_login`)

Use the long-lived **Instagram user access token** (`instagramAccessToken`) with Bearer auth:

`POST https://graph.instagram.com/<VERSION>/<instagramAccountId>/messages`

Header: `Authorization: Bearer <instagramAccessToken>`

```json
{
  "recipient": { "id": "<IGSID>" },
  "message": { "text": "..." }
}
```

- `recipient.id` = customer's Instagram-scoped ID (`senderId` from webhook)
- For Page-linked flow, do **not** use `/{instagramAccountId}/messages` on `graph.facebook.com`

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
