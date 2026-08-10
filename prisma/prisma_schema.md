# Prisma Database Schema

এই ডকুমেন্টে প্রজেক্টের সম্পূর্ণ Prisma schema কনফিগারেশন, ডাটাবেস মডেলসমূহ এবং তাদের রিলেশনশিপ সুন্দরভাবে সাজানো আছে।

## Models Overview
নিচে স্কিমায় থাকা মূল মডেলগুলোর ক্যাটাগরি অনুযায়ী একটি সংক্ষিপ্ত তালিকা দেওয়া হলো:

* **User & Workspace Management:** `User`, `Workspace`
* **Chatbot Core & Sessions:** `Chatbot`, `Source`, `Chunk`, `Faq`, `SampleReply`, `ChatMessage`, `ChatSession`
* **Integrations & E-commerce:** `Integration`, `EcommerceConfig`, `Order`, `Product`, `AvailablePlatform`
* **Billing, Credits & Analytics:** `PaymentTransaction`, `AIUsageLog`, `CreditTransaction`
* **Miscellaneous:** `Notification`, `Referral`, `CourierConfig`

---

## Complete Prisma Schema

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  extensions = [vector]
}

model User {
  id            String               @id @default(cuid())
  userId        String               @unique
  email         String               @unique
  name          String
  picture       String?
  plan          String               @default("starter")
  region        String               @default("bd")
  planExpiresAt            DateTime?
  scheduledDowngradePlan   String?   // e.g. "starter", "growth" — billing period শেষে এই plan-এ নামবে
  scheduledDowngradeAt     DateTime? // scheduled downgrade effective হওয়ার তারিখ
  // Credit System Fields
  creditsBalance        Int            @default(500)         // বর্তমান credit balance
  includedCredits       Int            @default(500)         // plan অনুযায়ী মোট credits (bonus সহ)
  creditsUsedThisCycle  Int            @default(0)           // এই cycle-এ ব্যবহৃত credits
  creditsResetDate      DateTime       @default(now())       // পরবর্তী monthly reset তারিখ
  referralCode  String?              @unique
  referredBy    String?
  dataRetention String               @default("forever")
  lastDataExportAt DateTime?
  notificationSettings Json          @default("{}")
  supportCostPerHour   Float         @default(15.0)
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  messages      ChatMessage[]
  chatbots      Chatbot[]
  payments      PaymentTransaction[]
  aiUsageLogs   AIUsageLog[]
  referralsGot  Referral[]           @relation("ReferredUser")
  referralsMade Referral[]           @relation("ReferredBy")
  notifications Notification[]
  creditTransactions CreditTransaction[]
  workspaces    Workspace[]
  courierConfig CourierConfig?
}

// ── Multi-Business / Multi-Workspace ────────────────────────────────────────
// A Workspace = one business. Chatbots (and everything cascading from them —
// integrations, sources, sessions, orders) belong to a workspace, so scoping
// chatbots by workspaceId scopes the whole dashboard to that business.
model Workspace {
  id          String    @id @default(cuid())
  workspaceId String    @unique @default(cuid())
  userId      String // owner (Clerk userId)
  name        String
  logoUrl     String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [userId], onDelete: Cascade)
  chatbots    Chatbot[]

  @@index([userId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // payment, usage, plan, referral, system
  title     String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId])
}

model Chatbot {
  id           String        @id @default(cuid())
  chatbotId    String        @unique @default(cuid())
  userId       String
  workspaceId  String? // owning business/workspace (null = legacy, backfilled to default)
  name         String
  model        String        @default("gemini-2.5-flash-lite")
  provider     String        @default("gemini")
  temperature  Float         @default(0.7)
  maxTokens    Int           @default(2000)
  systemPrompt String        @default("You are a helpful assistant.")
  systemPromptRaw String?
  chatbotMode  String        @default("general") // e.g. "ecommerce", "support", "lead_gen", "general"
  status       String        @default("active")
  avatarColor  String        @default("#6d28d9")
  avatarBase64 String?       @db.Text
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  messages     ChatMessage[]
  user         User          @relation(fields: [userId], references: [userId], onDelete: Cascade)
  workspace    Workspace?    @relation(fields: [workspaceId], references: [workspaceId], onDelete: SetNull)
  integrations Integration[]
  sources      Source[]
  faqs         Faq[]
  sampleReplies SampleReply[]
  sessions     ChatSession[]
  orders       Order[]
  ecommerceConfig EcommerceConfig?
  products     Product[]

  @@index([workspaceId])
}

model Source {
  id        String   @id @default(cuid())
  sourceId  String   @unique @default(cuid())
  chatbotId String
  type      String
  name      String
  content   String?
  charCount Int      @default(0)
  createdAt DateTime @default(now())
  chunks    Chunk[]
  chatbot   Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)

  @@map("Source")
}

model Chunk {
  id         String                 @id @default(dbgenerated("gen_random_uuid()::text"))
  sourceId   String?
  chatbotId  String?
  content    String
  embedding  Unsupported("vector")?
  chunkIndex Int?
  metadata   Json?
  createdAt  DateTime               @default(now())
  source     Source?                @relation(fields: [sourceId], references: [sourceId], onDelete: Cascade)

  @@map("Chunk")
}

model Faq {
  id        String   @id @default(cuid())
  faqId     String   @unique @default(cuid())
  chatbotId String
  question  String
  answer    String
  archived  Boolean  @default(false) // soft-archive: hides from active training without deletion
  sourceId  String? // pointer to companion Source carrying the embeddings
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  chatbot   Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)

  @@index([chatbotId])
}

model SampleReply {
  id              String   @id @default(cuid())
  sampleReplyId   String   @unique @default(cuid())
  chatbotId       String
  customerMessage String
  reply           String
  archived        Boolean  @default(false) // soft-archive: hides from active training without deletion
  sourceId        String? // pointer to companion Source carrying the embeddings
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  chatbot         Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)

  @@index([chatbotId])
}

model ChatMessage {
  id           String   @id @default(cuid())
  chatbotId    String
  userId       String
  sessionId    String
  role         String
  content      String
  // Distinguishes human agent replies from AI-generated replies
  sentByHuman  Boolean  @default(false)
  timestamp    DateTime @default(now())
  chatbot      Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)
  user         User     @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([chatbotId, sessionId])
}

model Integration {
  id            String    @id @default(cuid())
  integrationId String    @unique @default(cuid())
  chatbotId     String
  platform      String
  connected     Boolean   @default(false)
  status        String    @default("active") // "active", "error", "disconnected"
  lastError     String?
  config        Json      @default("{}")
  connectedAt   DateTime?
  chatbot       Chatbot   @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)
  sessions      ChatSession[]

  @@unique([chatbotId, platform])
}

model PaymentTransaction {
  id            String    @id @default(cuid())
  sessionId     String    @unique
  userId        String
  packageId     String
  amount        Float
  currency      String
  gateway       String
  paymentStatus String    @default("initiated")
  status        String    @default("pending")
  metadata      Json      @default("{}")
  createdAt     DateTime  @default(now())
  completedAt   DateTime?
  user          User      @relation(fields: [userId], references: [userId], onDelete: Cascade)
}

model Referral {
  id             String   @id @default(cuid())
  referrerId     String
  referredUserId String
  referralCode   String
  rewardPoints   Int      @default(100)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @default(now()) @updatedAt
  referredUser   User     @relation("ReferredUser", fields: [referredUserId], references: [userId], onDelete: Cascade)
  referrer       User     @relation("ReferredBy", fields: [referrerId], references: [userId], onDelete: Cascade)
}

model ChatSession {
  id           String   @id @default(cuid())
  chatbotId    String
  sessionId    String
  platform     String   @default("web")
  integrationId String?
  guestName    String?
  profilePhoto String?
  isActive     Boolean  @default(true)
  isArchived   Boolean  @default(false)
  // AI-detected lead status: high_prospect, priority, risky, successful, none
  leadStatus   String?  @default("none")
  // Latest message preview text for session list
  lastMessage  String?
  sentiment    String?  // positive, neutral, negative
  topic        String?
  analysisAt   DateTime?
  // AI real-time extraction data: phone, address, cart items, order status
  aiExtractionData Json? @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  chatbot      Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)
  integration  Integration? @relation(fields: [integrationId], references: [integrationId], onDelete: SetNull)
  orders       Order[]

  @@unique([chatbotId, sessionId])
}

// ── Social Commerce Order Model ─────────────────────────────────────────────
model Order {
  id              String   @id @default(cuid())
  orderId         String   @unique // Human-readable: ORD-XXXX
  chatbotId       String
  sessionId       String   // Reference to ChatSession.sessionId
  customerName    String
  customerPhone   String?
  deliveryAddress String?
  district        String?
  items           Json     // Array of { name, qty, price }
  totalAmount     Float    @default(0)
  paymentMethod   String   @default("COD")
  paymentStatus   String   @default("pending") // pending, paid, failed
  courierName     String?  // Steadfast, Pathao, etc.
  courierTrackingId String? // e.g. STEAD-99128
  status          String   @default("Processing") // Processing, Shipped, Delivered, Returned
  internalNotes   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  chatbot         Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)
  session         ChatSession @relation(fields: [chatbotId, sessionId], references: [chatbotId, sessionId], onDelete: Cascade)

  @@index([chatbotId])
  @@index([sessionId])
}

model AIUsageLog {
  id               String   @id @default(cuid())
  userId           String
  chatbotId        String
  sessionId        String
  platform         String   @default("web")
  model            String
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  totalTokens      Int      @default(0)
  actualCostUSD    Float    @default(0)
  chargedAmount    Float    @default(0)
  chargedCurrency  String   @default("BDT")
  isFreeMessage    Boolean  @default(false)
  createdAt        DateTime @default(now())
  user             User     @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([chatbotId, createdAt])
}

model AvailablePlatform {
  id           String   @id @default(cuid())
  platformId   String   @unique // e.g. "facebook", "whatsapp"
  name         String
  description  String
  iconKey      String   // To map to ICONS object
  color        String   @default("#6d28d9")
  isComingSoon Boolean  @default(false)
  isActive     Boolean  @default(true)
  category     String   @default("social") // social, messaging, automation, website
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model EcommerceConfig {
  id                    String   @id @default(cuid())
  chatbotId             String   @unique
  // Google Sheets configuration
  productSheetUrl       String?  // Google Sheets URL for product list
  orderSheetUrl         String?  // Google Sheets URL for order confirmation
  productSheetId        String?  // Extracted Google Sheets ID for API access
  orderSheetId          String?  // Extracted Google Sheets ID for API access
  productSheetName      String?  @default("Products") // Sheet tab name
  orderSheetName        String?  @default("Orders") // Sheet tab name
  // SteadFast Courier
  steadfastEnabled      Boolean  @default(false)
  steadfastApiKey       String?
  steadfastSecretKey    String?
  // Pathao Courier
  pathaoEnabled         Boolean  @default(false)
  pathaoClientId        String?
  pathaoClientSecret    String?
  pathaoMerchantId      String?
  // Shared
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  chatbot               Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)
}

// ── Product Catalog ─────────────────────────────────────────────────────────
// প্রতিটি Chatbot-এর product catalog এখানে store হয়।
// Facebook posts থেকে AI দিয়ে extract করা অথবা manually add করা products।
model Product {
  id           String   @id @default(cuid())
  productId    String   @unique @default(cuid())
  chatbotId    String

  // Core product info (AI-extracted or manually added)
  name         String
  description  String?  @db.Text
  price        Float?
  currency     String   @default("BDT")
  stock        Int      @default(0)

  // Variant info stored as flexible JSON
  // Example: { "colors": ["White", "Black"], "sizes": ["S", "M", "L", "XL"] }
  variants     Json?

  // Source tracking
  sourceType   String   @default("fb_post") // fb_post | manual | csv
  sourcePostId String?  // Original Facebook post ID
  imageUrl     String?  // Primary product/post image URL (legacy fallback)
  imageUrls    String[] @default([]) // Multiple product gallery image URLs
  postUrl      String?  // Original Facebook post permalink

  // Status
  isActive     Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  chatbot      Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)

  @@index([chatbotId])
  @@map("Product")
}

// Credit System — প্রতিটি credit deduction এখানে log হয়
model CreditTransaction {
  id           String   @id @default(cuid())
  userId       String
  chatbotId    String?
  action_type  String   // reply_economy, reply_standard, reply_premium, enhance_prompt, file_embedding, image_message, audio_per_minute, test_chat
  model_tier   String?  // economy, standard, premium
  credits_spent Int
  metadata     Json?    // extra info (model name, session id, etc.)
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([chatbotId, createdAt])
}

// ── Merchant Courier Credentials Configuration ────────────────────────────
model CourierConfig {
  id                 String   @id @default(cuid())
  userId             String   @unique
  workspaceId        String?
  // Steadfast Courier
  steadfastEnabled   Boolean  @default(false)
  steadfastApiKey    String?
  steadfastSecretKey String?
  // Pathao Courier
  pathaoEnabled      Boolean  @default(false)
  pathaoClientId     String?
  pathaoClientSecret String?
  pathaoUsername     String?
  pathaoPassword     String?
  pathaoStoreId      String?
  // RedX Courier
  redxEnabled        Boolean  @default(false)
  redxApiToken       String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  user               User     @relation(fields: [userId], references: [userId], onDelete: Cascade)
}
```
