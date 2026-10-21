# 📅 Task 08 — Service Business / Booking Module

> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 8 rules apply to every item below.
> **Priority:** 🩵 LOW
> **Pending Features from Analysis:** #42

---

## Scope Summary

Implement the appointment and booking management module for service-based businesses (e.g., clinics, salons, consultancies, agencies). The AI agent acts as a receptionist that takes bookings, records advance payment transaction IDs, sends reminders, and manages schedules.

---

## Feature #42 — Service Business Booking & Receptionist System

**VideoScript:** _"Service ব্যবসা হলে এই agentই আপনার receptionist। Booking নেয়, advance transaction ID রাখে, আগের দিন মনে করিয়ে দেয়।"_

### What to Build

A dedicated Appointments/Bookings module inside the dashboard and conversational booking handling by the AI:

1. Booking intake via AI (date, time slot, service name, customer contact)
2. Advance payment capture (transaction ID / screenshot)
3. Dashboard view of scheduled appointments with status (Pending, Confirmed, Completed, Cancelled)
4. Automated 24h pre-appointment reminder notifications to customer

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — Add `Appointment` / `Booking` model
- `app/api/appointments/route.ts` — GET / POST appointments
- `app/api/appointments/[id]/route.ts` — PATCH status / notes
- `app/(dashboard)/dashboard/appointments/page.tsx` — Modular booking page shell
- `app/(dashboard)/dashboard/appointments/_components/` — Calendar/Table view, AppointmentSheet, BookingStatusBadge, etc.
- `public/locales/en/appointments.json` & `public/locales/bn/appointments.json` — Localization

### Schema Design

```prisma
model Appointment {
  id              String   @id @default(cuid())
  workspaceId     String
  chatbotId       String
  sessionId       String?
  customerName    String
  customerPhone   String
  serviceName     String
  scheduledAt     DateTime
  advanceAmount   Float?   @default(0)
  transactionId   String?
  status          String   @default("pending") // pending | confirmed | completed | cancelled
  notes           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([workspaceId, scheduledAt])
  @@schema("merchant")
}
```

### Completion Checklist

- [ ] Schema: `Appointment` model added & migrated
- [ ] API: CRUD routes for appointments
- [ ] UI: Modular appointment dashboard (`_components/` architecture)
- [ ] Cron / Reminder: Pre-appointment automated reminder check
- [ ] i18n: en + bn localization
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

_Task file: `task-08-booking.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`_
