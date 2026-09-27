# Task — Merchant Feedback System

Approved plan: `C:\Users\User\.claude\plans\pasted-content-id-86da-please-analyze-curried-quilt.md`

## সিদ্ধান্ত (User-approved, 2026-09-25)
| বিষয় | সিদ্ধান্ত |
|---|---|
| Entry point | Header-এ "Feedback" button → Dialog (Refer & Earn-এর পাশে) |
| Attachment | ছবি + অডিও + ভিডিও · সর্বোচ্চ ৫টি · প্রতি ফাইল ২৫MB |
| Auto context | URL + Browser/OS + Workspace/Bot + শেষ console error + auto screenshot |
| বাড়তি ফিচার | দুইমুখী reply thread · merchant-এর "My Feedback history" |
| বাদ | Category/Priority · admin stats dashboard · internal note |
| Thread | একটাই `FeedbackReply` table, `authorType: merchant \| admin` |
| Upload | Browser → Cloudinary সরাসরি (server শুধু signature দেয়) — Vercel-এর ৪.৫MB body limit এড়াতে |

---

## ধাপ ১ — Prisma model ✅ (কোড লেখা শেষ, push বাকি)
- [x] `prisma/schema/admin.prisma` — `Feedback`, `FeedbackAttachment`, `FeedbackReply`
- [x] `prisma/schema/auth.prisma` — `User.feedback Feedback[]` relation
- [x] ✅ `npx prisma db push` — **ইউজার নিজে চালিয়েছেন**। প্রমাণ: dev server log-এ
      `GET /api/feedback 200` — পুরনো client-এ `db.feedback` undefined থাকত, ফলে
      TypeError → 500 আসত। 200 মানে client হালনাগাদ।

## ধাপ ২ — Server ✅
- [x] `lib/domain/feedback-constants.ts` — limits + MIME map (zod-মুক্ত, client-safe)
- [x] `lib/domain/feedback-schema.ts` — zod schemas
- [x] `lib/services/feedback.ts` — create / list / thread / reply / setStatus / notify
- [x] `lib/core/cloudinary.ts` — `createFeedbackUploadSignature()`
- [x] `lib/services/mail.ts` — `feedbackReceived`, `feedbackReply` template
- [x] `app/api/feedback/route.ts` — POST (create) + GET (own list + unread count)
- [x] `app/api/feedback/[id]/route.ts` — GET (thread) + PATCH (mark_read)
- [x] `app/api/feedback/[id]/reply/route.ts` — POST (merchant reply)
- [x] `app/api/feedback/upload-signature/route.ts` — POST
- [x] `app/api/admin/feedback/route.ts` — GET (list + filter + search + stats)
- [x] `app/api/admin/feedback/[id]/route.ts` — GET + PATCH (reply | set_status)

## ধাপ ৩ — Merchant UI ✅
- [x] `lib/feedback/screenshot.ts` — html2canvas-pro wrapper (best-effort)
- [x] `lib/feedback/console-capture.ts` — console.error ring buffer (৫টি)
- [x] `lib/feedback/context.ts` — browser/OS/viewport/theme capture
- [x] `lib/feedback/upload.ts` — Cloudinary direct-upload (XHR progress)
- [x] `components/feedback/types.ts` — shared client types
- [x] `components/feedback/status-styles.ts` — status → CSS-variable badge class
- [x] `components/feedback/FeedbackDialog.tsx` — ২টি tab (New / My Feedback)
- [x] `components/feedback/FeedbackComposer.tsx`
- [x] `components/feedback/FeedbackAttachmentPicker.tsx`
- [x] `components/feedback/ScreenshotAnnotator.tsx` — canvas pen/arrow/rect/ellipse + undo
- [x] `components/feedback/FeedbackThread.tsx` — merchant ও admin দুই view-ই এটাই ব্যবহার করে
- [x] `components/feedback/FeedbackHistoryList.tsx`
- [x] `components/layout/dashboardHeader.tsx` — Feedback button + unread dot + capture spinner
- [x] `app/(dashboard)/layout.tsx` — dialog state + pre-open screenshot + console capture install

## ধাপ ৪ — Admin UI ✅
- [x] `app/(admin)/admin/feedback/page.tsx` — stat cards + search + status filter + queue
- [x] `components/admin/feedback/FeedbackDetailDialog.tsx` — context + attachment player + thread + status
- [x] `components/admin/AdminSidebar.tsx` — Content group-এ nav entry

## ধাপ ৫ — i18n ✅
- [x] `public/locales/{en,bn}/feedback.json` — নতুন namespace
- [x] `lib/core/i18n.ts` — namespace register
- [x] `public/locales/{en,bn}/admin.json` — `sidebar.feedback` + `feedback.*`

## ধাপ ৬ — Dependency ⏳
- [x] `package.json`-এ `"html2canvas-pro": "^1.0.0"` যোগ করা হয়েছে
- [ ] ⚠️ `npm install` — **ইউজারকে নিজে চালাতে হবে** (shell blocked)

## ধাপ ৭ — কোড রিভিউতে পাওয়া সমস্যা ✅ (এই সেশনে ঠিক করা)
- [x] `FeedbackComposer.tsx` — hardcoded `text-amber-500` → `text-warning`
      (AGENTS.md §3 লঙ্ঘন ছিল)
- [x] `app/(dashboard)/layout.tsx` — dialog বন্ধ করলে captured screenshot-এর
      `File` state-এ পড়ে থাকত (কয়েকশো KB–১MB মেমরি) → এখন clear হয়
- [x] `FeedbackDialog.tsx` — JSX ফরম্যাটিং ঠিক (`>` ও `<DialogHeader` এক লাইনে ছিল)

## ধাপ ৮ — `npx tsc --noEmit`-এর ২৬টি এরর ✅ (ঠিক করা, যাচাই বাকি)

সব এরর ৫টি root cause-এ পড়ে — **এর একটিও feedback ফিচারের কারণে হয়নি**,
সবই dependency upgrade ও migration-এর অবশিষ্ট।

| # | Root cause | এরর | ফাইল |
|---|---|---|---|
| ১ | **Base UI `Select.onValueChange`-এ `\| null` যোগ হয়েছে** (v1.4.1) — রেডিক্স-ধাঁচের `(v: string) => void` আর খাটে না | ১৮ | ১৩টি ফাইল |
| ২ | `cb.avatar` — Prisma-তে ফিল্ডের নাম `avatarBase64` | ১ | `app/api/admin/workspaces/[id]/route.ts` |
| ৩ | `log.chatbotId` nullable, অথচ index হিসেবে ব্যবহৃত | ২ | `app/api/usage/route.ts` |
| ৪ | Clerk v7-এ `UserButton` থেকে `afterSignOutUrl` সরানো হয়েছে | ১ | `components/admin/AdminHeader.tsx` |
| ৫ | বাকি আলাদা আলাদা | ৪ | `button.tsx` · `admin-credits.ts` · `prisma.config.ts` |

**গৃহীত নীতি (Base UI `null`):**
- **ফিল্টার** → `null` মানে "কিছুই ফিল্টার হয়নি" → `?? "all"` sentinel-এ ফেরানো।
  এটি কোডবেসের বিদ্যমান রীতি ([SearchFilterBar.tsx:47](app/(dashboard)/dashboard/chatbots/_components/SearchFilterBar.tsx#L47))।
- **ফর্ম** → `null` মানে "clear" → আগের মানটাই রাখা (`v ?? f.field`), নাহলে
  ব্যবহারকারীর অসম্পূর্ণ ফর্ম মুছে যেত।
- **Typed union** (`"topup" | "deduct"`, tier) → falsy হলে কিছুই করা হয় না।

**আলাদা ৪টি:**
- [button.tsx](components/ui/button.tsx#L58) — `cloneElement`-এ `"data-slot"` পাঠাতে
  cast-করা props টাইপে কী-টি যোগ করা হলো
- [admin-credits.ts:7](lib/services/admin-credits.ts#L7) — `getPaymentPackage`
  import করা হয়নি (Stripe সরানোর সময় বাদ পড়েছিল)। `payments.ts` এখনো এটি
  re-export করে, তাই `uddoktapay/charge` route অক্ষত
- [prisma.config.ts](prisma.config.ts) — Prisma 7-এ `datasource.directUrl` নেই, সরানো
  হলো। `db push` যেভাবে সফল হয়েছিল (`DATABASE_URL`) ঠিক সেভাবেই থাকল — শূন্য
  behaviour change

---

## Verification
- [x] ✅ `npx prisma db push` (ইউজার চালিয়েছেন — `GET /api/feedback 200` প্রমাণ)
- [ ] ⚠️ `npm install` — **এই মুহূর্তের একমাত্র ব্লকার**
- [ ] ⚠️ `npx tsc --noEmit`
- [ ] ⚠️ `npm run build`
- [ ] dev server restart (Turbopack-এ পুরনো Prisma client ক্যাশ থাকে)
- [ ] Dashboard → Feedback button → dialog + auto screenshot
- [ ] ছবি + অডিও + ভিডিও আপলোড; ২৬MB ফাইল client-side-এ আটকায়
- [ ] `/admin/feedback` → দেখা + reply + status
- [ ] Admin reply → merchant bell + email + header dot
- [ ] Merchant পাল্টা reply → admin thread-এ দেখা যায়
- [ ] Mobile (৩৭৫px) + Dark/Light দুই mode

### ⚠️ Shell অবস্থা
`Bash`/`PowerShell` মাঝেমধ্যে classifier outage-এ আটকায়
("deepseek-v4-flash is temporarily unavailable")। সাধারণ read-only কমান্ড
(`ls`, `cat`, `rm` একবার) কখনো পার হয়, কিন্তু `npx prisma db push` /
`npm install` বারবার আটকেছে। তাই উপরের যাচাই ধাপগুলো এখনো **চালানো হয়নি** —
কখনো "সফল" লেখা হবে না যতক্ষণ না সত্যিই চালানো হয়।
