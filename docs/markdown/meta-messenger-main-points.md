# Meta Messenger Setup Notes

## Main Points

- `Facebook Login for Business`:
  ইউজারকে Facebook দিয়ে login করায়, permission নেয়, page list access দেয়, এবং `pageId` / `pageToken` connect flow enable করে।

- `Webhooks`:
  Meta থেকে real-time event receive করার layer। Customer page-এ message দিলে event callback URL-এ পাঠায়।

- `Messenger`:
  Messenger platform feature layer। Messenger-related webhook fields, page messaging, এবং reply flow-এর platform settings এখানে থাকে।

## Our Current Architecture

- `Next.js / Vercel`:
  শুধু user onboarding + page connect UI।

- `Database`:
  selected page-এর `pageId`, `pageToken`, chatbot config save হয়।

- `n8n VPS Backend`:
  actual runtime processing এখানেই হয়।

- Runtime flow:
  `Meta Page Message -> Webhook Callback -> n8n -> DB Lookup -> AI Agent -> Messenger Reply`

## What Each Part Does

- Login/setup time:
  `Facebook Login for Business`

- Incoming customer messages:
  `Webhooks -> Page`

- Outgoing reply to Messenger:
  `Messenger Platform / Send API`

## Important Practical Notes

- `User` webhook আপনার Messenger page message flow-এর জন্য main requirement না।
- `Page` webhook object-টাই দরকার।
- Required webhook field:
  `messages`
- Common optional field:
  `message_reads`
- `webhook-test` URL সাধারণত testing-এর জন্য।
- production traffic-এর জন্য stable `webhook` URL use করা ভালো।
- App যদি `Development` mode-এ থাকে, public user testing সীমাবদ্ধ হতে পারে।

## Recommended Setup Focus

- `Facebook Login for Business` রাখুন login/connect flow-এর জন্য
- `Webhooks -> Page`-কে primary inbound event config হিসেবে ধরুন
- `Messenger` settings-এ callback / subscribed fields consistency check করুন
- final production callback ideally `n8n`-এ point করবে

## Official Documentation

- Facebook Login for Web (JS SDK):
  https://developers.facebook.com/docs/facebook-login/web

- Facebook Login section overview:
  https://developers.facebook.com/docs/facebook-login/

- Graph API Webhooks:
  https://developers.facebook.com/docs/graph-api/webhooks/

- Messenger Platform overview:
  https://developers.facebook.com/docs/messenger-platform

- Messenger Platform Webhooks:
  https://developers.facebook.com/docs/messenger-platform/webhooks

- Messenger Send API:
  https://developers.facebook.com/docs/messenger-platform/send-messages

- Page `subscribed_apps` reference:
  https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/

## Research / Learning Links

- YouTube search: Meta Messenger webhook tutorial
  https://www.youtube.com/results?search_query=meta+messenger+webhook+tutorial

- YouTube search: Facebook Messenger API tutorial
  https://www.youtube.com/results?search_query=facebook+messenger+api+tutorial

- YouTube search: n8n Facebook Messenger webhook
  https://www.youtube.com/results?search_query=n8n+facebook+messenger+webhook

- YouTube search: Facebook Login JavaScript SDK tutorial
  https://www.youtube.com/results?search_query=facebook+login+javascript+sdk+tutorial

## Suggested Learning Order

1. Facebook Login (JS SDK)
2. Graph API Webhooks
3. Messenger Platform Webhooks
4. Messenger Send API
5. n8n webhook + database lookup flow
