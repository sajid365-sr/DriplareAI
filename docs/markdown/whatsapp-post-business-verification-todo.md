# WhatsApp Post-Business-Verification TODO

Business verification approve হওয়ার পর WhatsApp Premium UX পুরোপুরি চালু করতে এই কাজগুলো করতে হবে।

## Meta Dashboard

- [ ] App Settings > Basic সম্পূর্ণ আছে কিনা যাচাই করুন:
  - App domain
  - Privacy Policy URL
  - Terms URL
  - User data deletion URL
  - App icon/category
- [ ] Facebook Login for Business থেকে WhatsApp Embedded Signup configuration তৈরি করুন।
- [ ] Configuration ID কপি করুন।
- [ ] WhatsApp > Production setup > Configure Webhooks:
  - Callback URL: `https://YOUR_DOMAIN/api/webhooks/whatsapp`
  - Verify token: production `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- [ ] Webhook fields subscribe করুন, বিশেষ করে messages.
- [ ] Required permissions App Review-এ submit করুন:
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`
  - `business_management`, যদি Meta flow require করে
- [ ] App Live mode-এ নেওয়ার আগে demo video এবং review notes প্রস্তুত করুন।
- [ ] Tech Provider onboarding প্রয়োজন হলে complete করুন।

## Vercel / Environment Variables

- [ ] `NEXT_PUBLIC_META_APP_ID`
- [ ] `NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`
- [ ] `META_APP_SECRET`
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- [ ] `N8N_WHATSAPP_WEBHOOK_URL`
- [ ] `N8N_CALLBACK_SECRET`
- [ ] Optional: `WHATSAPP_GRAPH_VERSION`

## REMOVEDAI Verification

- [ ] `/dashboard/chatbots/[chatbotId]/integrations` থেকে WhatsApp Embedded Signup popup খুলছে কিনা verify করুন।
- [ ] Meta popup থেকে `code`, `phone_number_id`, `waba_id` পাওয়া যাচ্ছে কিনা browser console/network দিয়ে verify করুন।
- [ ] `/api/chatbots/[chatbotId]/integrations/whatsapp/embedded/connect` route DB-তে WhatsApp integration save করছে কিনা verify করুন।
- [ ] Integrations card-এ connected WhatsApp number দেখাচ্ছে কিনা verify করুন।
- [ ] Details modal-এ connected number/business/status দেখাচ্ছে কিনা verify করুন।

## n8n

- [ ] WhatsApp workflow webhook URL production করুন।
- [ ] DB query `platform = 'whatsapp'` এবং `config->>'phoneNumberId'` দিয়ে integration load করছে কিনা verify করুন।
- [ ] Text message receive/send test করুন।
- [ ] Image/audio/document branches test করুন।
- [ ] WhatsApp API auth error হলে `/api/webhooks/n8n-whatsapp/token-status` callback করছে কিনা verify করুন।

## Final Production Test

- [ ] Real customer-like Business account দিয়ে WhatsApp connect করুন।
- [ ] Real WhatsApp user থেকে inbound message পাঠান।
- [ ] AI reply WhatsApp-এ যাচ্ছে কিনা verify করুন।
- [ ] Disconnect এবং reconnect flow test করুন।
- [ ] Bengali/English UI text verify করুন।
